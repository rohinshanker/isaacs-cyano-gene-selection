/** Exact sequence construction; all initiation triplets remain literal. */
import { validateSchemeMap } from './scheme.js';

export const FOLD_SETTINGS = Object.freeze({
  engine: 'ViennaRNA', version: '2.7.2', build: 'emscripten-4.0.15-v1',
  parameters: 'Turner2004', temperatureC: 37, dangles: 2,
  noLP: false, noGU: false, noGUclosure: false, circular: false,
  gquad: false, minLoopSize: 3, saltM: 1.021,
});

function requireDna(sequence, length) {
  if (typeof sequence !== 'string' || !/^[ACGT]+$/.test(sequence)
      || (length !== undefined && sequence.length !== length)) {
    throw new Error('Invalid or missing RNA folding sequence context; rebuild the dataset.');
  }
}

/** A synonymous map edits sense positions 1..N and optionally the terminal stop. */
export function foldingSequences(gene, table, map) {
  const validation = validateSchemeMap(map, table);
  if (!validation.ok) throw new Error(validation.errors.join(' '));
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
  const wild = codons.join('');
  const recoded = codons.map((codon, index) => index === 0 ? codon : (map[codon] ?? codon)).join('');
  const context = gene.rnaContext;
  let wildStart;
  let recodedStart;
  if (context?.upstream !== undefined) {
    requireDna(context.upstream, 30);
    requireDna(wild.slice(0, 60), 60);
    wildStart = context.upstream + wild.slice(0, 60);
    recodedStart = context.upstream + recoded.slice(0, 60);
  } else {
    requireDna(context?.sequence, 90);
    if (!Array.isArray(context.cdsOffsets) || context.cdsOffsets.length !== 90) {
      throw new Error('Invalid RNA genomic-to-CDS map.');
    }
    wildStart = context.sequence;
    recodedStart = [...wildStart].map((base, index) => {
      const offset = context.cdsOffsets[index];
      if (!Number.isInteger(offset) || offset < -1 || offset >= wild.length
          || (offset >= 0 && wild[offset] !== base)) {
        throw new Error('RNA context does not match the CDS.');
      }
      return offset === -1 ? base : recoded[offset];
    }).join('');
  }
  const rna = (dna) => dna.replaceAll('T', 'U');
  return {
    start: { wild: rna(wildStart), recoded: rna(recodedStart) },
    first100: { wild: rna(wild.slice(0, 100)), recoded: rna(recoded.slice(0, 100)) },
  };
}

/** Actual content hash: a changed CDS, context, alphabet, or source invalidates caches. */
export async function foldingDatasetChecksum(dataset) {
  const content = JSON.stringify([
    dataset.meta.sourceChecksums, dataset.meta.codonAlphabet,
    dataset.genes.map(({ id, codons, terminalStop, rnaContext }) => [id, codons, terminalStop, rnaContext]),
  ]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
