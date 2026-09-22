import { foldingSequences } from './folding-sequences.js';

export const TRROSETTA_URL = 'https://yanglab.qd.sdu.edu.cn/trRosettaRNA/';

function requireInteger(value, label) {
  if ((typeof value !== 'string' && typeof value !== 'number')
      || (typeof value === 'string' && value.trim() === '')) {
    throw new Error(`${label} must be an integer.`);
  }
  const number = Number(value);
  if (!Number.isInteger(number)) throw new Error(`${label} must be an integer.`);
  return number;
}

function cdsRna(gene, table, map, form) {
  if (!gene?.codons?.length) throw new Error('Gene has no coding sequence.');
  const codons = [...gene.codons].map((symbol) => {
    const index = table.symbolToIndex[symbol.charCodeAt(0)];
    if (!Number.isInteger(index) || index < 0 || table.isStop[index]) {
      throw new Error('Invalid packed sense codon.');
    }
    return table.codons[index];
  });
  const stopIndex = table.indexOf(gene.terminalStop);
  if (stopIndex < 0 || !table.isStop[stopIndex]) throw new Error('Missing terminal stop.');
  codons.push(gene.terminalStop);
  return codons.map((codon, index) => form === 'recoded' && index > 0
    ? (map[codon] ?? codon) : codon).join('').replaceAll('T', 'U');
}

function rangeFromMappedContext(context, startWindow, from, to) {
  const offsets = context.cdsOffsets;
  const mapped = offsets.filter((offset) => offset >= 0);
  if (!mapped.length) throw new Error('The supplied genomic context contains no transcript coordinates.');
  const lower = Math.min(...mapped);
  const upper = Math.max(...mapped);
  if (from < lower || to > upper) {
    throw new Error(`The supplied genomic context maps transcript coordinates ${lower} through ${upper}; requested ${from} through ${to}.`);
  }
  const indices = [];
  for (let coordinate = from; coordinate <= to; coordinate += 1) {
    const index = offsets.indexOf(coordinate);
    if (index < 0) {
      throw new Error(`The supplied genomic context stops at transcript coordinate ${coordinate - 1}; requested through ${to}.`);
    }
    indices.push(index);
  }
  const gap = indices.findIndex((index, offset) => offset > 0 && index !== indices[offset - 1] + 1);
  if (gap >= 0) {
    throw new Error(`The supplied genomic context is contiguous only through transcript coordinate ${from + gap - 1}; requested through ${to} crosses an intron.`);
  }
  return startWindow.slice(indices[0], indices.at(-1) + 1);
}

/** Exact strand-oriented RNA used by the folding path, with explicit context limits. */
export function handoffSequence({ gene, table, map = {}, form = 'wild-type', region = 'start', start, end }) {
  if (!['wild-type', 'recoded'].includes(form)) throw new Error('Choose wild type or recoded RNA.');
  const cds = cdsRna(gene, table, map, form);
  if (region === 'cds') return { sequence: cds, label: 'full_cds' };
  if (!['start', 'range'].includes(region)) throw new Error('Choose a supported RNA region.');
  const windows = foldingSequences(gene, table, map);
  if (region === 'start') return { sequence: windows.start[form === 'recoded' ? 'recoded' : 'wild'], label: 'start_-30_59' };
  const from = requireInteger(start, 'Range start');
  const to = requireInteger(end, 'Range end');
  if (from > to) throw new Error('Range start must not exceed range end.');
  if (from < -30 || to > 59) {
    throw new Error('The dataset supplies only transcript coordinates −30 through 59 outside the full CDS; choose a range inside that context.');
  }
  const startWindow = windows.start[form === 'recoded' ? 'recoded' : 'wild'];
  if (gene.rnaContext?.cdsOffsets) {
    return { sequence: rangeFromMappedContext(gene.rnaContext, startWindow, from, to), label: `range_${from}_${to}` };
  }
  return { sequence: startWindow.slice(from + 30, to + 31), label: `range_${from}_${to}` };
}

export function dotBracketToCt(sequence, structure, title = 'RNA', mfe) {
  if (!/^[ACGU]+$/.test(sequence) || structure.length !== sequence.length || !/^[().]+$/.test(structure)) {
    throw new Error('ViennaRNA dot bracket must match the exact RNA sequence.');
  }
  if (!Number.isFinite(mfe)) throw new Error('ViennaRNA MFE is required for a CT structure.');
  const stack = [];
  const pairs = Array(sequence.length).fill(0);
  for (let index = 0; index < structure.length; index += 1) {
    if (structure[index] === '(') stack.push(index);
    if (structure[index] === ')') {
      const mate = stack.pop();
      if (mate === undefined) throw new Error('ViennaRNA dot bracket is unbalanced.');
      pairs[index] = mate + 1;
      pairs[mate] = index + 1;
    }
  }
  if (stack.length) throw new Error('ViennaRNA dot bracket is unbalanced.');
  const lines = [`${sequence.length} ENERGY = ${mfe} ${title}`];
  for (let index = 0; index < sequence.length; index += 1) {
    lines.push([index + 1, sequence[index], index || 0, index + 1 === sequence.length ? 0 : index + 2,
      pairs[index], index + 1].join('\t'));
  }
  return `${lines.join('\n')}\n`;
}

export function writeHandoffFormats({ sequence, header, structure = null, mfe = null }) {
  if (!/^[ACGU]+$/.test(sequence)) throw new Error('Hand-off sequence must contain RNA bases only.');
  const safeHeader = String(header).replace(/[\r\n]+/g, ' ').trim();
  const fasta = `>${safeHeader}\n${sequence}\n`;
  const files = {
    sequence: `${sequence}\n`, fasta, a3m: fasta, a2m: fasta,
    stockholm: `# STOCKHOLM 1.0\n${safeHeader.replace(/\s+/g, '_')} ${sequence}\n//\n`,
  };
  if (structure !== null) {
    if (structure.length !== sequence.length || !/^[().]+$/.test(structure)) {
      throw new Error('ViennaRNA structure does not match the exact hand-off sequence.');
    }
    files.dotBracket = `>${safeHeader}\n${sequence}\n${structure}\n`;
    files.ct = dotBracketToCt(sequence, structure, safeHeader, mfe);
  }
  return files;
}

/** Prefer the async Clipboard API, then fall back to the browser's synchronous copy path. */
export async function copyTextWithFallback(text, {
  clipboard = globalThis.navigator?.clipboard, documentRef = globalThis.document,
} = {}) {
  try {
    if (!clipboard?.writeText) throw new Error('Clipboard API unavailable.');
    await clipboard.writeText(text);
    return;
  } catch (clipboardError) {
    if (!documentRef?.body || typeof documentRef.execCommand !== 'function') {
      throw new Error(`Could not copy to the clipboard: ${clipboardError.message}`);
    }
    const textarea = documentRef.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    documentRef.body.append(textarea);
    textarea.select();
    try {
      if (!documentRef.execCommand('copy')) throw new Error('Browser copy command was refused.');
    } catch (fallbackError) {
      throw new Error(`Could not copy to the clipboard: ${fallbackError.message}`);
    } finally {
      textarea.remove();
    }
  }
}

export async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function handoffHeader({ locus, strain, form, schemeName, region, siteVersion }) {
  const formLabel = form === 'recoded' ? `recoded:${schemeName || 'active-scheme'}` : 'wild-type';
  return [locus, `strain=${strain}`, `form=${formLabel}`, `region=${region}`, `site=${siteVersion}`].join(' ');
}
