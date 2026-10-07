/**
 * The sequence a pinned gene is read from, base by base.
 *
 * DOM-free, so the decoding, translation, and coordinate arithmetic are
 * testable in Node and the close-up view only draws. Every offset here is a
 * nucleotide offset from the first base of the annotated coding sequence in
 * transcription orientation, the same frame the small gene visualizer uses:
 * zero is the first base of the initiation triplet, negative is upstream, and
 * the terminal stop occupies the last three offsets.
 *
 * It shows only what the release ships exactly: the packed sense codons, the
 * separately stored terminal stop, and the 30 upstream bases of `rnaContext`.
 * No flank is padded, no gap base is invented, and position zero is always
 * translated as methionine and never recoded, per the data contract.
 */
import { repliconLength } from './chromosome-model.js';
import { transcriptionPieces, UPSTREAM_CONTEXT_NT } from './gene-view-model.js';
import { replacementAt, occurrenceCounter } from './scheme.js';

/** Full residue names, so a one-letter row can be read out in words. */
export const AMINO_ACID_NAMES = Object.freeze({
  A: 'Alanine', R: 'Arginine', N: 'Asparagine', D: 'Aspartate', C: 'Cysteine',
  Q: 'Glutamine', E: 'Glutamate', G: 'Glycine', H: 'Histidine', I: 'Isoleucine',
  L: 'Leucine', K: 'Lysine', M: 'Methionine', F: 'Phenylalanine', P: 'Proline',
  S: 'Serine', T: 'Threonine', W: 'Tryptophan', Y: 'Tyrosine', V: 'Valine',
  '*': 'Stop',
});

function isDna(text, length) {
  return typeof text === 'string' && text.length === length && /^[ACGT]+$/.test(text);
}

/**
 * Genomic position of each transcribed base, in transcription order.
 *
 * Built from the transcription-ordered pieces so a spliced CDS keeps its gap,
 * a minus-strand gene counts downwards, and an origin-crossing gene continues
 * across base 1. Returns null when the pieces do not add up to the coding
 * length, because a position table that disagrees with the sequence would
 * label every base with the wrong coordinate.
 */
export function genomicPositions(gene, cdsLengthNt) {
  const positions = [];
  for (const piece of transcriptionPieces(gene)) {
    const length = piece.high - piece.low + 1;
    for (let k = 0; k < length; k += 1) {
      positions.push(gene.strand === '-' ? piece.high - k : piece.low + k);
    }
  }
  return positions.length === cdsLengthNt ? positions : null;
}

/** The first transcribed base of a gene, in genomic coordinates. */
export function firstTranscribedBase(gene) {
  const [first] = transcriptionPieces(gene);
  if (!first) return null;
  return gene.strand === '-' ? first.high : first.low;
}

/**
 * Genomic position of an upstream offset, wrapping at the replicon origin.
 * Every replicon is circular, so base −1 of a gene starting at base 1 is the
 * replicon's last base. Null when the replicon length is unknown.
 */
export function upstreamPosition(gene, offset, length = repliconLength(gene.seqid)) {
  const anchor = firstTranscribedBase(gene);
  if (!(length > 0) || !(offset < 0) || anchor === null) return null;
  const raw = gene.strand === '-' ? anchor - offset : anchor + offset;
  return ((raw - 1) % length + length) % length + 1;
}

/**
 * Splice junctions as the CDS offset that begins each later piece, with the
 * number of genomic bases skipped before it: zero where the join is only the
 * circular origin.
 */
export function junctionsOf(gene) {
  const junctions = [];
  let offset = 0;
  for (const [i, piece] of transcriptionPieces(gene).entries()) {
    if (i > 0) junctions.push({ atOffset: offset, gapNt: piece.gapBefore, bases: null });
    offset += piece.high - piece.low + 1;
  }
  return junctions;
}

/**
 * The upstream context, and any junction bases the start window happens to
 * contain, read from either `rnaContext` form.
 *
 * The `upstream` form is the 30 bases before the start, already in
 * transcription orientation. The `sequence` form is the [-30,60) genomic window
 * with a CDS offset per base, or -1 outside this gene; its first 30 bases are
 * the upstream context only when base 30 is the start, and a run of -1 between
 * two consecutive CDS offsets is the genomic gap of a junction. Any other shape
 * yields no upstream rather than a guess.
 */
export function upstreamContext(gene, junctions) {
  const context = gene.rnaContext;
  if (!context || typeof context !== 'object') return null;
  if (context.upstream !== undefined) {
    return isDna(context.upstream, UPSTREAM_CONTEXT_NT) ? context.upstream : null;
  }
  const { sequence, cdsOffsets } = context;
  if (!isDna(sequence, 90) || !Array.isArray(cdsOffsets) || cdsOffsets.length !== 90) return null;
  const upstream = cdsOffsets[UPSTREAM_CONTEXT_NT] === 0
    && cdsOffsets.slice(0, UPSTREAM_CONTEXT_NT).every((offset) => offset === -1)
    ? sequence.slice(0, UPSTREAM_CONTEXT_NT)
    : null;
  // Gap bases: a run of -1 strictly between offset a and offset a + 1.
  let index = UPSTREAM_CONTEXT_NT;
  while (index < 90) {
    const offset = cdsOffsets[index];
    if (offset >= 0) {
      let end = index + 1;
      while (end < 90 && cdsOffsets[end] === -1) end += 1;
      if (end > index + 1 && end < 90 && cdsOffsets[end] === offset + 1) {
        const junction = junctions.find((entry) => entry.atOffset === offset + 1);
        if (junction && junction.gapNt === end - index - 1) {
          junction.bases = sequence.slice(index + 1, end);
        }
      }
      index = end;
    } else {
      index += 1;
    }
  }
  return upstream;
}

/**
 * A complete, renderer-agnostic description of one gene's readable sequence.
 *
 * @param {object} gene a `genes.json` record.
 * @param {import('./codon-table.js').CodonTable} table the dataset's codon table.
 * @param {{active: boolean, replacement: Uint8Array}|null} scheme the compiled
 *   recoding scheme, or null for the original sequence alone.
 * @returns {object|null} null when the record has no packed sequence.
 */
export function geneSequenceModel(gene, table, scheme = null) {
  if (!gene || typeof gene.codons !== 'string' || gene.codons.length === 0 || !table) return null;
  if (!Number.isFinite(gene.start) || !Number.isFinite(gene.end)) return null;
  let indices;
  try {
    indices = table.decode(gene.codons);
  } catch {
    return null;
  }
  const stopIndex = table.indexOf(gene.terminalStop);
  const hasStop = stopIndex >= 0 && table.isStop[stopIndex] === 1;
  const codonCount = indices.length + (hasStop ? 1 : 0);
  const cdsLengthNt = codonCount * 3;
  const active = Boolean(scheme?.active) && scheme.rotation instanceof Uint8Array;
  const positions = genomicPositions(gene, cdsLengthNt);
  const junctions = junctionsOf(gene);
  const upstream = upstreamContext(gene, junctions);

  const codons = [];
  let changedCodons = 0;
  // Per-occurrence resolution over this gene, skipping the start triplet, which
  // is the rule the live metrics and the sequence export both follow. The drawn
  // recoded row has to be the sequence those numbers describe.
  const occurrences = occurrenceCounter();
  const codonAt = (index, sequenceIndex, kind) => {
    const codon = table.codons[sequenceIndex];
    let replacementIndex = sequenceIndex;
    if (active && kind !== 'start') {
      replacementIndex = replacementAt(scheme, sequenceIndex, occurrences[sequenceIndex]);
      occurrences[sequenceIndex] += 1;
    }
    const recoded = active ? table.codons[replacementIndex] : null;
    const changed = active && replacementIndex !== sequenceIndex;
    if (changed) changedCodons += 1;
    const aa = kind === 'start' ? 'M' : table.aas[sequenceIndex];
    const offset = index * 3;
    return {
      index,
      offset,
      codon,
      aa,
      aaName: AMINO_ACID_NAMES[aa] ?? aa,
      kind,
      recoded,
      changed,
      positions: positions ? positions.slice(offset, offset + 3) : null,
    };
  };
  for (let i = 0; i < indices.length; i += 1) {
    codons.push(codonAt(i, indices[i], i === 0 ? 'start' : 'sense'));
  }
  if (hasStop) codons.push(codonAt(indices.length, stopIndex, 'stop'));

  const upstreamBases = upstream
    ? [...upstream].map((base, i) => {
      const offset = i - UPSTREAM_CONTEXT_NT;
      return { offset, base, position: upstreamPosition(gene, offset) };
    })
    : [];

  return {
    id: gene.id,
    name: gene.name ?? null,
    product: gene.product ?? null,
    replicon: gene.seqid ?? null,
    strand: gene.strand === '-' ? '-' : '+',
    start: gene.start,
    end: gene.end,
    lengthNt: Number.isFinite(gene.lengthNt) ? gene.lengthNt : cdsLengthNt,
    lengthCodons: indices.length,
    cdsLengthNt,
    terminalStop: hasStop ? gene.terminalStop : null,
    startCodon: codons[0].codon,
    nonStandardStart: codons[0].codon !== 'ATG',
    translationalException: gene.translationalException ?? null,
    spliced: junctions.length > 0,
    junctions,
    upstream: upstreamBases,
    codons,
    protein: codons.filter((entry) => entry.kind !== 'stop').map((entry) => entry.aa).join(''),
    coordinatesKnown: positions !== null,
    scheme: {
      active,
      changedCodons,
      stopChanged: hasStop && codons[codons.length - 1].changed,
    },
    domain: { min: upstreamBases.length > 0 ? -UPSTREAM_CONTEXT_NT : 0, max: cdsLengthNt },
  };
}

/** The codon that holds a CDS offset, or null outside the coding sequence. */
export function codonAtOffset(model, offset) {
  if (!model || !(offset >= 0) || offset >= model.cdsLengthNt) return null;
  return model.codons[Math.floor(offset / 3)] ?? null;
}

/** Signed nucleotide offset the way the rows label it: −30, start, +12. */
export function signedOffset(offset) {
  if (offset === 0) return 'start';
  const text = Math.abs(offset).toLocaleString('en-US');
  return offset > 0 ? `+${text}` : `−${text}`;
}

/**
 * One paragraph naming what the close-up shows, for its accessible description.
 * The visible strip is a picture; this is its text equivalent.
 */
export function describeGeneSequence(model, window = null) {
  if (!model) return 'No gene is pinned.';
  const identity = model.name ? `${model.id} ${model.name}` : model.id;
  const parts = [];
  parts.push(`${identity} on the ${model.strand === '-' ? 'minus' : 'plus'} strand of `
    + `${model.replicon ?? 'its replicon'}: ${model.lengthCodons.toLocaleString('en-US')} sense `
    + `codons${model.terminalStop ? ` and the terminal stop ${model.terminalStop}` : ''}, read in `
    + 'transcription orientation from the annotated start.');
  parts.push(`Initiation triplet ${model.startCodon}, translated as methionine`
    + `${model.nonStandardStart ? ' although it is not ATG' : ''}.`);
  if (model.upstream.length > 0) {
    parts.push(`${model.upstream.length} upstream bases precede it.`);
  } else {
    parts.push('No upstream context is shipped for this gene.');
  }
  if (model.spliced) {
    const gaps = model.junctions.map((junction) => `${junction.gapNt.toLocaleString('en-US')} nt `
      + `before offset ${junction.atOffset.toLocaleString('en-US')}`).join(', ');
    parts.push(`The coding sequence is a join of ${model.junctions.length + 1} genomic segments, `
      + `skipping ${gaps}.`);
  }
  if (model.translationalException) {
    parts.push(`Translational exception: ${model.translationalException.replace(/_/g, ' ')}.`);
  }
  if (!model.coordinatesKnown) {
    parts.push('Genomic coordinates are not shown because the annotated segments do not add up '
      + 'to the coding length.');
  }
  if (model.scheme.active) {
    parts.push(model.scheme.changedCodons === 0
      ? 'The active recoding scheme changes no codon in this gene.'
      : `The active recoding scheme changes ${model.scheme.changedCodons.toLocaleString('en-US')} `
        + `codon${model.scheme.changedCodons === 1 ? '' : 's'}`
        + `${model.scheme.stopChanged ? ', including the terminal stop' : ''}.`);
  }
  if (window) {
    parts.push(`Showing nucleotides ${signedOffset(window.from)} to ${signedOffset(window.to)}.`);
  }
  return parts.join(' ');
}
