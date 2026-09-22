/**
 * The feature space a gene panel is spread across.
 *
 * Two rules decide everything here. Units must not choose the panel: a length in
 * nucleotides and a fraction in 0 to 1 would otherwise let the long-scale field
 * dominate every distance, so each feature is replaced by its percentile among
 * all genes in the dataset. That scaling is computed once over the whole genome,
 * not over whatever the constraints leave standing, so tightening a constraint
 * cannot silently rescale the space. And a missing value stays missing: it is
 * never the median, never zero. Two genes are compared over the features they
 * both have, and a pair sharing nothing is treated as no evidence of difference
 * rather than as maximal difference.
 */
import { percentileRank, sortedFinite } from './stats.js';
import { isExpressionMetric, isExpressionProxyMetric } from './metric-registry.js';

/**
 * The curated default feature set: one representative per thing that makes a
 * gene a different experiment from another. Adding two fields that measure the
 * same property would count that property twice in every distance, so the list
 * is deliberately short and spans composition, codon usage, rare codons, codon
 * pairs, start structure, size, genomic context, and translation.
 *
 * Every feature is percentile-scaled and weighted equally, so this order does
 * not change which panel is generated; it sets the order features are listed
 * in explanations and exports. CAI and tAI sit last, and a measured source
 * enabled by the reader is placed ahead of them by
 * {@link defaultBaselineFeatures}, so no default ordering shows a
 * convention-derived index above a measurement.
 */
export const DEFAULT_BASELINE_FEATURES = Object.freeze([
  'gc3', 'enc', 'rareFraction', 'cps', 'mfeStart', 'lengthCodons',
  'neighborUpstreamNt', 'cai', 'tai',
]);

/**
 * Per-scheme features, added once for every selected recoding scheme, so a panel
 * spans how differently the schemes would disturb the genes as well as where the
 * genes start. Edit burden, the worst local pile-up of edits, and the two
 * adaptation changes a recoding decision turns on.
 */
export const DEFAULT_SCHEME_FEATURES = Object.freeze([
  'targetFraction', 'maxLocalTargetDensity', 'dCai', 'dTai',
]);

/** Quantile bins per feature used to report coverage. */
export const COVERAGE_BINS = 5;

/** Percentile of the feature-space centre, used to pick an anchor with no seeds. */
const CENTRE = 0.5;

/** A feature key naming one metric under one scheme. */
export function schemeFeatureKey(schemeId, metricKey) {
  return `${schemeId}::${metricKey}`;
}

/** Split a scheme feature key back into its parts; null for a baseline feature. */
export function parseSchemeFeatureKey(key) {
  const at = key.indexOf('::');
  return at < 0 ? null : { schemeId: key.slice(0, at), metricKey: key.slice(at + 2) };
}

/**
 * True when a metric carries a measurement this genome was not measured for.
 * The panel workflow will not use one unless the user opts in, and labels it
 * wherever it appears.
 *
 * The check is by declaration, so a dataset that publishes more than one
 * measured source, or renames its expression field, needs no change here. When a
 * measured expression metric arrives with no provenance at all, it is treated as
 * borrowed rather than as this organism's own: the contract says never to assume
 * which dataset supplied a value, and the safe assumption is the one that keeps
 * an unverified measurement out of the design until the reader asks for it.
 */
export function isBorrowedMetric(metric) {
  if (!metric) return false;
  if (metric.provenance) return metric.provenance.isTargetOrganism === false;
  return isExpressionMetric(metric) && !isExpressionProxyMetric(metric);
}

/**
 * Curated default features plus one representative of each borrowed expression
 * source when the reader explicitly opts in. A raw measurement wins over a
 * percentile derived from the same values, so one source cannot count twice.
 *
 * An enabled measurement leads the list, ahead of the codon-usage conventions
 * it outranks. Order does not change the generated panel, because every
 * feature is percentile-scaled and weighted equally; it changes what a reader
 * sees first in the feature list and the export.
 */
export function defaultBaselineFeatures(registry, allowBorrowed = false) {
  const keys = [...DEFAULT_BASELINE_FEATURES];
  if (!allowBorrowed) return keys;

  const representatives = new Map();
  for (const metric of registry.metrics ?? []) {
    if (metric.source !== 'pipeline' || !isBorrowedMetric(metric)) continue;
    const group = metric.provenance
      ?? metric.key.replace(/Percentile$/i, '').toLowerCase();
    const previous = representatives.get(group);
    const isDerivedRank = /percentile/i.test(`${metric.key} ${metric.label}`);
    if (!previous || (previous.isDerivedRank && !isDerivedRank)) {
      representatives.set(group, { key: metric.key, isDerivedRank });
    }
  }
  const measured = [];
  for (const { key } of representatives.values()) {
    if (!keys.includes(key)) measured.push(key);
  }
  return [...measured, ...keys];
}

function columnPercentiles(read, count) {
  const raw = new Float64Array(count);
  for (let i = 0; i < count; i += 1) raw[i] = read(i);
  const sorted = sortedFinite(raw);
  const scaled = new Float64Array(count);
  for (let i = 0; i < count; i += 1) {
    scaled[i] = Number.isFinite(raw[i]) ? percentileRank(sorted, raw[i]) : NaN;
  }
  return { raw, scaled, finiteCount: sorted.length, constant: sorted.length > 0
    && sorted[0] === sorted[sorted.length - 1] };
}

/**
 * Build the percentile-scaled feature space.
 *
 * @param {{dataset: object, registry: object,
 *   schemes?: Array<{schemeId: string, name?: string|null, map: object}>,
 *   schemeFields?: Map<string, Record<string, Float64Array>>,
 *   baselineFeatures?: string[], schemeFeatures?: string[],
 *   allowBorrowed?: boolean}} options
 * @returns {{keys: string[], labels: string[], dims: number, count: number,
 *   scaled: Float64Array, raw: Float64Array, dropped: Array<{key: string, reason: string}>,
 *   borrowed: string[]}}
 *   `scaled` and `raw` are row-major `count × dims`. A non-finite entry is a
 *   value the dataset does not have, and every consumer must keep it that way.
 */
export function buildPanelSpace({
  dataset, registry, schemes = [], schemeFields = new Map(),
  baselineFeatures,
  schemeFeatures = DEFAULT_SCHEME_FEATURES,
  allowBorrowed = false,
} = {}) {
  const count = dataset.genes.length;
  const columns = [];
  const dropped = [];
  const borrowed = [];
  const selectedBaselineFeatures = baselineFeatures
    ?? defaultBaselineFeatures(registry, allowBorrowed);

  for (const key of selectedBaselineFeatures) {
    const metric = registry.byKey.get(key);
    if (!metric) {
      dropped.push({ key, reason: `${key} is not in this dataset.` });
      continue;
    }
    if (isBorrowedMetric(metric) && !allowBorrowed) {
      dropped.push({
        key,
        reason: `${metric.label} is measured in another organism, so it is left out until `
          + 'borrowed expression is switched on.',
      });
      continue;
    }
    if (isBorrowedMetric(metric)) borrowed.push(key);
    columns.push({ key, label: metric.label, read: (i) => metric.read(i), metric });
  }

  for (const scheme of schemes) {
    const fields = schemeFields.get(scheme.schemeId);
    if (!fields) continue;
    for (const metricKey of schemeFeatures) {
      const values = fields[metricKey];
      if (!values) continue;
      const metric = registry.byKey.get(metricKey);
      const key = schemeFeatureKey(scheme.schemeId, metricKey);
      columns.push({
        key,
        label: `${metric?.label ?? metricKey} under ${scheme.name || scheme.schemeId}`,
        read: (i) => values[i],
        metric,
        schemeId: scheme.schemeId,
      });
    }
  }

  const kept = [];
  for (const column of columns) {
    const stats = columnPercentiles(column.read, count);
    if (stats.finiteCount === 0) {
      dropped.push({ key: column.key, reason: `${column.label}: no gene has a value.` });
      continue;
    }
    if (stats.constant) {
      dropped.push({
        key: column.key,
        reason: `${column.label}: every gene has the same value, so it cannot separate genes.`,
      });
      continue;
    }
    kept.push({ ...column, ...stats });
  }

  const dims = kept.length;
  const scaled = new Float64Array(count * dims);
  const raw = new Float64Array(count * dims);
  kept.forEach((column, c) => {
    for (let i = 0; i < count; i += 1) {
      scaled[i * dims + c] = column.scaled[i];
      raw[i * dims + c] = column.raw[i];
    }
  });

  return {
    keys: kept.map((column) => column.key),
    labels: kept.map((column) => column.label),
    metrics: kept.map((column) => column.metric ?? null),
    dims,
    count,
    scaled,
    raw,
    dropped,
    borrowed,
  };
}

/**
 * Distance between two genes in the scaled space, over the features they both
 * have.
 *
 * The sum over shared features is rescaled to the full width of the space, so a
 * gene missing one feature is not automatically closer to everything than a gene
 * missing none. A pair sharing no feature returns 0: nothing measured says they
 * differ, and claiming the largest possible distance from no evidence would let
 * unknowns choose the panel.
 *
 * @param {{scaled: Float64Array, dims: number}} space
 */
export function featureDistance(space, a, b) {
  const { scaled, dims } = space;
  let sum = 0;
  let shared = 0;
  for (let c = 0; c < dims; c += 1) {
    const x = scaled[a * dims + c];
    const y = scaled[b * dims + c];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const delta = x - y;
    sum += delta * delta;
    shared += 1;
  }
  if (shared === 0) return 0;
  return Math.sqrt((sum * dims) / shared);
}

/** How far a gene sits from the centre of the space, used to pick an anchor. */
export function distanceFromCentre(space, index) {
  const { scaled, dims } = space;
  let sum = 0;
  let shared = 0;
  for (let c = 0; c < dims; c += 1) {
    const x = scaled[index * dims + c];
    if (!Number.isFinite(x)) continue;
    const delta = x - CENTRE;
    sum += delta * delta;
    shared += 1;
  }
  if (shared === 0) return 0;
  return Math.sqrt((sum * dims) / shared);
}

/** How many features a gene actually has a value for. */
export function presentFeatureCount(space, index) {
  const { scaled, dims } = space;
  let present = 0;
  for (let c = 0; c < dims; c += 1) if (Number.isFinite(scaled[index * dims + c])) present += 1;
  return present;
}

/** Which quantile bin a percentile falls in, or -1 when there is no value. */
export function binOf(percentile, bins = COVERAGE_BINS) {
  if (!Number.isFinite(percentile)) return -1;
  return Math.min(bins - 1, Math.max(0, Math.floor(percentile * bins)));
}

/**
 * How much of the feature space a set of genes occupies.
 *
 * Per feature: which quantile bins are occupied, and the spread between the
 * lowest and highest percentile present. Overall: the share of bins filled, and
 * the smallest distance between any two members, which is the quantity the
 * selection maximizes.
 *
 * @returns {{perFeature: Array<{key: string, label: string, bins: number[],
 *   binCount: number, min: number, max: number, spread: number, missing: number}>,
 *   binFraction: number, filledBins: number, totalBins: number,
 *   minPairDistance: number, meanPairDistance: number, members: number}}
 */
export function coverageOf(space, members, bins = COVERAGE_BINS) {
  const { dims, scaled } = space;
  const perFeature = [];
  let filled = 0;
  for (let c = 0; c < dims; c += 1) {
    const occupied = new Set();
    let min = Infinity;
    let max = -Infinity;
    let missing = 0;
    for (const index of members) {
      const value = scaled[index * dims + c];
      if (!Number.isFinite(value)) {
        missing += 1;
        continue;
      }
      occupied.add(binOf(value, bins));
      if (value < min) min = value;
      if (value > max) max = value;
    }
    filled += occupied.size;
    perFeature.push({
      key: space.keys[c],
      label: space.labels[c],
      bins: [...occupied].sort((a, b) => a - b),
      binCount: occupied.size,
      min: Number.isFinite(min) ? min : NaN,
      max: Number.isFinite(max) ? max : NaN,
      spread: Number.isFinite(min) && Number.isFinite(max) ? max - min : NaN,
      missing,
    });
  }

  let minPair = Infinity;
  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const d = featureDistance(space, members[i], members[j]);
      if (d < minPair) minPair = d;
      sum += d;
      pairs += 1;
    }
  }

  const totalBins = dims * bins;
  return {
    perFeature,
    filledBins: filled,
    totalBins,
    binFraction: totalBins > 0 ? filled / totalBins : NaN,
    minPairDistance: pairs > 0 ? minPair : NaN,
    meanPairDistance: pairs > 0 ? sum / pairs : NaN,
    members: members.length,
  };
}
