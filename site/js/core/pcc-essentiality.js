/**
 * The PCC 7942 essentiality colour channel and filter.
 *
 * DOM-free. It reads exactly one field, `candidateEvidence.borrowedEssentiality
 * .byLocus[locus].status`: the Rubin et al. 2015 call that Adomako et al. 2022
 * republished, joined to a UTEX 2973 CDS only through the admitted exact
 * crosswalk. No tested UTEX allele, GO IEA context or other evidence ever
 * enters it, and nothing here changes a call.
 *
 * Seven source statuses are grouped into four display buckets. The grouping is
 * for colour and filtering only: the detail panel and the export keep the exact
 * status, and an unresolved call is never shown or counted as non-essential.
 * See docs/validation/pcc-essentiality.md.
 */

/** The `Colour by` key, the way `functionCategory` and `overlapClass` are. */
export const PCC_ESSENTIALITY_COLOR_KEY = 'pccEssentiality';

/** The channel's name wherever a reader sees it. */
export const PCC_ESSENTIALITY_LABEL = 'PCC 7942 essentiality';

/** Every status the admitted data can carry, in the source vocabulary's order. */
export const PCC_ESSENTIALITY_STATUSES = Object.freeze([
  'essential', 'beneficial', 'non-essential', 'ambiguous', 'not_analyzed', 'missing', 'unknown',
]);

/** Reader-facing names for the exact statuses, which the unresolved bucket lists. */
export const PCC_STATUS_LABELS = Object.freeze({
  essential: 'essential',
  beneficial: 'beneficial',
  'non-essential': 'non-essential',
  ambiguous: 'ambiguous',
  not_analyzed: 'not analysed',
  missing: 'missing source call',
  unknown: 'no admitted join',
});

/**
 * The display buckets, in legend order. The first three are determinate calls
 * and take a colour; the last holds every status without one and draws as the
 * open no-value ring, so it can never read as a call.
 */
export const PCC_ESSENTIALITY_BUCKETS = Object.freeze([
  Object.freeze({ id: 'essential', label: 'Essential', statuses: Object.freeze(['essential']) }),
  Object.freeze({ id: 'beneficial', label: 'Beneficial', statuses: Object.freeze(['beneficial']) }),
  Object.freeze({
    id: 'non-essential', label: 'Non-essential', statuses: Object.freeze(['non-essential']),
  }),
  Object.freeze({
    id: 'unresolved',
    label: 'Unresolved',
    statuses: Object.freeze(['ambiguous', 'not_analyzed', 'missing', 'unknown']),
  }),
]);

export const PCC_ESSENTIALITY_BUCKET_IDS = Object.freeze(
  PCC_ESSENTIALITY_BUCKETS.map((bucket) => bucket.id),
);

/** How many buckets take a colour; the rest draw as the open ring. */
export const PCC_COLOURED_BUCKET_COUNT = 3;

const BUCKET_BY_STATUS = new Map(PCC_ESSENTIALITY_BUCKETS
  .flatMap((bucket, position) => bucket.statuses.map((status) => [status, position])));

/** The bucket position of one exact status; throws on a status outside the vocabulary. */
export function pccBucketPosition(status) {
  const position = BUCKET_BY_STATUS.get(status);
  if (position === undefined) throw new Error(`Unknown PCC 7942 essentiality status: ${status}`);
  return position;
}

/** A selection reduced to known bucket ids, deduplicated and sorted. */
export function normalizePccEssentialitySelection(ids) {
  return [...new Set((ids ?? []).filter((id) => PCC_ESSENTIALITY_BUCKET_IDS.includes(id)))].sort();
}

/** Toggle one bucket id in a selection. */
export function togglePccEssentialitySelection(selected, id) {
  const next = new Set(selected ?? []);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return normalizePccEssentialitySelection([...next]);
}

/**
 * Every CDS's bucket, colour value and counts, or the pending state.
 *
 * `values` is what the colour scale reads: 0–2 for the coloured buckets, -1 for
 * unresolved, which every categorical view draws as the open no-value ring, and
 * one past the coloured buckets for every CDS while the calls are not read.
 * `positions` is the bucket each CDS is filtered and previewed by.
 *
 * @param {{candidateEvidence: object|null, genes: object[],
 *   pending?: 'loading'|'failed'|'absent'|null}} options
 * @returns {{pending: string|null, values: Int16Array, positions: Int8Array|null,
 *   counts: Int32Array, statusCounts: Record<string, number>, source: object|null}}
 */
export function resolvePccEssentiality({ candidateEvidence, genes, pending = null }) {
  const total = genes.length;
  const byLocus = candidateEvidence?.borrowedEssentiality?.byLocus ?? null;
  if (pending || !byLocus) {
    return {
      pending: pending ?? 'absent',
      values: new Int16Array(total).fill(PCC_COLOURED_BUCKET_COUNT),
      positions: null,
      counts: new Int32Array(PCC_ESSENTIALITY_BUCKETS.length),
      statusCounts: {},
      source: null,
    };
  }
  const values = new Int16Array(total);
  const positions = new Int8Array(total);
  const counts = new Int32Array(PCC_ESSENTIALITY_BUCKETS.length);
  const statusCounts = Object.fromEntries(PCC_ESSENTIALITY_STATUSES.map((status) => [status, 0]));
  for (let i = 0; i < total; i += 1) {
    const call = byLocus[genes[i].id];
    if (!call) throw new Error(`No PCC 7942 essentiality record for ${genes[i].id}`);
    const position = pccBucketPosition(call.status);
    positions[i] = position;
    values[i] = position < PCC_COLOURED_BUCKET_COUNT ? position : -1;
    counts[position] += 1;
    statusCounts[call.status] += 1;
  }
  return {
    pending: null,
    values,
    positions,
    counts,
    statusCounts,
    source: candidateEvidence.borrowedEssentiality.source,
  };
}

/** The bucket id one CDS falls in, or null while the calls are not read. */
export function pccBucketIdAt(model, index) {
  if (!model?.positions) return null;
  return PCC_ESSENTIALITY_BUCKET_IDS[model.positions[index]];
}

/**
 * OR across the selected buckets; an empty selection excludes nothing, and so
 * does a model whose calls are not read: hiding genes then would turn a file
 * still in flight into a claim about their essentiality.
 */
export function passesPccEssentialityFilter(model, index, selected) {
  if (!selected || selected.length === 0 || !model?.positions) return true;
  return selected.includes(pccBucketIdAt(model, index));
}

/** One bucket's exact statuses with their counts, for the legend and the filter. */
export function describeBucketStatuses(bucket, statusCounts) {
  return bucket.statuses
    .map((status) => `${PCC_STATUS_LABELS[status]} ${(statusCounts[status] ?? 0).toLocaleString('en-US')}`)
    .join(', ');
}

/** The sentence a pending channel shows instead of counts. */
export function pccPendingSentence(pending) {
  if (pending === 'failed') {
    return 'The PCC 7942 essentiality calls could not be loaded, so no CDS is classed. Retry '
      + 'the candidate evidence from the notice above the map.';
  }
  if (pending === 'loading') {
    return 'The PCC 7942 essentiality calls are still loading, so no CDS is classed yet.';
  }
  return 'This deployment does not publish the PCC 7942 essentiality calls, so no CDS is classed.';
}
