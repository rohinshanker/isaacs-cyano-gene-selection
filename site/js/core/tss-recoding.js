/** Exact sequence edits at admitted physical native Tan TSS coordinates. */
import { geneSequenceModel } from './gene-sequence-model.js';

export const TSS_EDIT_KEY = 'editedTssSitesInCds';
export const TSS_EVALUATED_KEY = 'evaluatedTssSitesInCds';
export const TSS_EDIT_LABEL = 'Edited TSS sites in CDS';
export const TSS_EDIT_DESCRIPTION = 'Distinct recorded Tan 2018 TSS identities inside actual CDS segments, on either strand and with any source association, whose nucleotide changes under the exact active scheme, independently recoding this focal CDS as in sequence export/live metrics. This is not a conflict-resolved whole-genome recoding across overlapping CDSs. Strand-distinct sites count separately. Evaluated recorded sites are the denominator. Zero recorded sites means only that no admitted sites occur in this CDS; it is not a prediction of promoter absence. Sequence edits do not establish lost or disrupted function or predict new promoters. Unavailable, loading, failed, deselected or coordinate-invalid comparisons are not evaluated.';
const cache = new WeakMap();
const complement = (base) => ({ A: 'T', T: 'A', C: 'G', G: 'C' })[base];

/** DOM-free per-gene comparison. Bases are in focal CDS transcription orientation. */
export function evaluateTssRecoding(gene, table, scheme, sites) {
  const sequence = geneSequenceModel(gene, table, scheme, { upstreamNt: 0 });
  if (!['+', '-'].includes(gene?.strand) || !sequence?.coordinatesKnown
    || !sequence.codons.every((codon) => codon.positions.every((position) => Number.isInteger(position) && position > 0))
    || (new Set(sequence.codons.flatMap((codon) => codon.positions))).size !== sequence.cdsLengthNt
    || (Number.isFinite(gene.lengthNt) && gene.lengthNt !== sequence.cdsLengthNt)) {
    return { geneId: gene?.id, status: 'coordinate-invalid', reason: 'CDS sequence and native coordinates cannot be compared exactly.', edited: NaN, evaluated: NaN, sites: [] };
  }
  const at = new Map();
  // Only site-bearing genes need a sequence scan. No per-base model survives this call.
  const wanted = new Set(sites.map((site) => site.position));
  for (const codon of sequence.codons) {
    codon.positions.forEach((position, i) => {
      if (wanted.has(position)) at.set(position, { original: codon.codon[i], recoded: (codon.recoded ?? codon.codon)[i] });
    });
  }
  const rows = sites.map((site) => {
    const bases = at.get(site.position);
    if (!bases) return null;
    const opposite = gene.strand !== site.strand;
    return { ...site, ...bases, edited: bases.original !== bases.recoded,
      siteOriginal: opposite ? complement(bases.original) : bases.original,
      siteRecoded: opposite ? complement(bases.recoded) : bases.recoded };
  });
  if (rows.some((row) => !row)) return { geneId: gene.id, status: 'coordinate-invalid', reason: 'A recorded TSS cannot be mapped to an exact CDS base.', edited: NaN, evaluated: NaN, sites: [] };
  return { geneId: gene.id, status: 'evaluated', reason: null,
    edited: rows.filter((row) => row.edited).length, evaluated: rows.length, sites: rows };
}

/** Cache by payload identity and compiled scheme; source suspension never returns cached values. */
export function tssRecodingModel(dataset, scheme, { evidence } = {}) {
  if (!evidence?.available) return {
    available: false, reason: evidence?.reason ?? 'Native Tan 2018 TSS evidence is unavailable.',
    editedCounts: new Float64Array(dataset.genes.length).fill(NaN),
    evaluatedCounts: new Float64Array(dataset.genes.length).fill(NaN), forGene: () => null,
  };
  const previous = cache.get(dataset);
  if (previous?.index === evidence.index && previous.scheme === scheme && previous.table === dataset.table
    && previous.genes === dataset.genes) return previous.model;
  const byGene = new Map(dataset.genes.map((gene) => [gene.id,
    evaluateTssRecoding(gene, dataset.table, scheme, evidence.index.byGene.get(gene.id)?.contained ?? [])]));
  const model = { available: true, reason: null,
    editedCounts: Float64Array.from(dataset.genes, (gene) => byGene.get(gene.id).edited),
    evaluatedCounts: Float64Array.from(dataset.genes, (gene) => byGene.get(gene.id).evaluated),
    forGene: (gene) => byGene.get(gene?.id) ?? null };
  cache.set(dataset, { index: evidence.index, scheme, table: dataset.table, genes: dataset.genes, model });
  return model;
}

/** Dynamic readers allow ordinary registry numeric filters, axes and exports. */
export function tssRecodingMetrics(getModel) {
  return [
    { key: TSS_EDIT_KEY, label: TSS_EDIT_LABEL, field: 'editedCounts' },
    { key: TSS_EVALUATED_KEY, label: 'Evaluated recorded TSS in CDS', field: 'evaluatedCounts' },
  ].map(({ field, ...definition }) => ({ ...definition, unit: 'sites', integer: true,
    scale: 'sequential', family: 'Genomic context', source: 'derived', constrainable: true, fileKey: 'tssEvidence',
    desc: TSS_EDIT_DESCRIPTION, availabilityReason: () => getModel()?.reason ?? null, read: (index) => getModel()?.[field]?.[index] ?? NaN }));
}

export function describeTssEdit(site, gene) {
  return `${site.edited ? 'Edited' : 'Unchanged'} TSS base: ${site.original} → ${site.recoded} in focal CDS (${gene.strand}) transcription orientation; site strand (${site.strand}) ${site.siteOriginal} → ${site.siteRecoded}. Original native position retained.`;
}
