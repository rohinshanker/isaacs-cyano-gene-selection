/** Exact sequence edits at admitted physical native Tan TSS coordinates. */
import { transcriptionPieces } from './gene-view-model.js';
import { replacementAt, occurrenceCounter } from './scheme.js';

export const TSS_EDIT_KEY = 'editedTssSitesInCds';
export const TSS_EVALUATED_KEY = 'evaluatedTssSitesInCds';
export const TSS_EDIT_LABEL = 'Edited TSS sites in CDS';
export const TSS_EDIT_DESCRIPTION = 'Distinct recorded Tan 2018 TSS identities inside actual CDS segments, on either strand and with any source association, whose nucleotide changes under the exact active scheme, independently recoding this focal CDS as in sequence export/live metrics. This is not a conflict-resolved whole-genome recoding across overlapping CDSs. Strand-distinct sites count separately. Evaluated recorded sites are the denominator. Zero recorded sites means only that no admitted sites occur in this CDS; it is not a prediction of promoter absence. Sequence edits do not establish lost or disrupted function or predict new promoters. Unavailable, loading, failed, deselected or coordinate-invalid comparisons are not evaluated.';
const cache = new WeakMap();
const complement = (base) => ({ A: 'T', T: 'A', C: 'G', G: 'C' })[base];
const EMPTY_SITES = Object.freeze([]);

function invalid(gene, reason = 'CDS sequence and native coordinates cannot be compared exactly.') {
  return Object.freeze({ geneId: gene?.id, status: 'coordinate-invalid', reason,
    edited: NaN, evaluated: NaN, sites: EMPTY_SITES });
}

/** Validate every sequence and segment once, including CDSs with no recorded sites. */
function prepareNativeSites(gene, table, sites) {
  if (!gene || !table || !['+', '-'].includes(gene.strand)
    || !Number.isFinite(gene.start) || !Number.isFinite(gene.end)
    || typeof gene.codons !== 'string' || !gene.codons.length) return invalid(gene);
  let indices;
  try { indices = table.decode(gene.codons); } catch { return invalid(gene); }
  const stop = table.indexOf(gene.terminalStop);
  const hasStop = stop >= 0 && table.isStop[stop] === 1;
  const length = (indices.length + Number(hasStop)) * 3;
  const pieces = transcriptionPieces(gene);
  const sorted = [...pieces].sort((a, b) => a.low - b.low);
  if (!pieces.length || pieces.some(({ low, high }) => !Number.isInteger(low)
    || !Number.isInteger(high) || low < 1 || high < low)
    || sorted.some((piece, i) => i > 0 && piece.low <= sorted[i - 1].high)
    || pieces.reduce((sum, piece) => sum + piece.high - piece.low + 1, 0) !== length
    || (Number.isFinite(gene.lengthNt) && gene.lengthNt !== length)) return invalid(gene);

  const occurrences = occurrenceCounter();
  const ordinals = new Uint32Array(indices.length + Number(hasStop));
  for (let i = 1; i < ordinals.length; i += 1) {
    const index = i < indices.length ? indices[i] : stop;
    ordinals[i] = occurrences[index]++;
  }
  const rows = [];
  for (const site of sites) {
    let offset = 0;
    let found = false;
    for (const { low, high } of pieces) {
      if (site.position >= low && site.position <= high) {
        offset += gene.strand === '-' ? high - site.position : site.position - low;
        found = true; break;
      }
      offset += high - low + 1;
    }
    if (!found || !Number.isInteger(offset)) {
      return invalid(gene, 'A recorded TSS cannot be mapped to an exact CDS base.');
    }
    const codonOffset = Math.floor(offset / 3);
    const codonIndex = codonOffset < indices.length ? indices[codonOffset] : stop;
    rows.push(Object.freeze({ site, codonIndex, baseIndex: offset % 3,
      original: table.codons[codonIndex][offset % 3], ordinal: ordinals[codonOffset],
      eligible: codonOffset !== 0, opposite: gene.strand !== site.strand }));
  }
  return Object.freeze({ geneId: gene.id, status: 'prepared', rows: Object.freeze(rows) });
}

/** Only recorded site bases are compared when the compiled scheme changes. */
function compareSites(native, table, scheme) {
  if (native.status === 'coordinate-invalid') return native;
  const active = Boolean(scheme?.active) && scheme.rotation instanceof Uint8Array;
  const sites = native.rows.map(({ site, codonIndex, baseIndex, original, ordinal, eligible, opposite }) => {
    const replacement = active && eligible ? replacementAt(scheme, codonIndex, ordinal) : codonIndex;
    const recoded = table.codons[replacement][baseIndex];
    return { ...site, original, recoded, edited: original !== recoded,
      siteOriginal: opposite ? complement(original) : original,
      siteRecoded: opposite ? complement(recoded) : recoded };
  });
  return { geneId: native.geneId, status: 'evaluated', reason: null,
    edited: sites.filter((site) => site.edited).length, evaluated: sites.length, sites };
}

/** DOM-free per-gene comparison. Bases use focal CDS transcription orientation. */
export function evaluateTssRecoding(gene, table, scheme, sites) {
  return compareSites(prepareNativeSites(gene, table, sites), table, scheme);
}

/** Native mappings survive scheme/export changes; weak scheme keys retain the active model. */
export function tssRecodingModel(dataset, scheme, { evidence } = {}) {
  if (!evidence?.available) return {
    available: false, reason: evidence?.reason ?? 'Native Tan 2018 TSS evidence is unavailable.',
    editedCounts: new Float64Array(dataset.genes.length).fill(NaN),
    evaluatedCounts: new Float64Array(dataset.genes.length).fill(NaN), forGene: () => null,
  };
  let native = cache.get(dataset);
  if (native?.index !== evidence.index || native.table !== dataset.table || native.genes !== dataset.genes
    || native.geneRefs.length !== dataset.genes.length
    || native.geneRefs.some((gene, index) => gene !== dataset.genes[index])) {
    native = { index: evidence.index, table: dataset.table, genes: dataset.genes, geneRefs: [...dataset.genes],
      mappings: dataset.genes.map((gene) => prepareNativeSites(gene, dataset.table,
        evidence.index.byGene.get(gene.id)?.contained ?? EMPTY_SITES)), models: new WeakMap() };
    cache.set(dataset, native);
  }
  const previous = scheme ? native.models.get(scheme) : native.identity;
  if (previous) return previous;
  const results = native.mappings.map((mapping) => compareSites(mapping, dataset.table, scheme));
  const byGene = new Map(results.map((result) => [result.geneId, result]));
  const model = { available: true, reason: null,
    editedCounts: Float64Array.from(results, (result) => result.edited),
    evaluatedCounts: Float64Array.from(results, (result) => result.evaluated),
    forGene: (gene) => byGene.get(gene?.id) ?? null };
  if (scheme) native.models.set(scheme, model);
  else native.identity = model;
  return model;
}

/** Dynamic readers allow ordinary registry numeric filters, axes and exports. */
export function tssRecodingMetrics(getModel) {
  return [
    { key: TSS_EDIT_KEY, label: TSS_EDIT_LABEL, field: 'editedCounts' },
    { key: TSS_EVALUATED_KEY, label: 'Evaluated recorded TSS in CDS', field: 'evaluatedCounts' },
  ].map(({ field, ...definition }) => ({ ...definition, unit: 'sites', integer: true,
    scale: 'sequential', family: 'Genomic context', source: 'derived', schemeDependent: definition.key === TSS_EDIT_KEY,
    constrainable: definition.key === TSS_EVALUATED_KEY, fileKey: 'tssEvidence',
    fileKeys: Object.freeze(['tssEvidence', 'regulatoryTss']),
    desc: TSS_EDIT_DESCRIPTION, availabilityReason: () => getModel()?.reason ?? null, read: (index) => getModel()?.[field]?.[index] ?? NaN }));
}

export function describeTssEdit(site, gene) {
  return `${site.edited ? 'Edited' : 'Unchanged'} TSS base: ${site.original} → ${site.recoded} in focal CDS (${gene.strand}) transcription orientation; site strand (${site.strand}) ${site.siteOriginal} → ${site.siteRecoded}. Original native position retained.`;
}
