/**
 * Row-aligned values for an explicit X-versus-Y metric scatter plot.
 *
 * This is deliberately separate from PCA: choosing axes only reads the metric
 * registry and never fits or transforms coordinates.
 */
import { metricValues, orderMeasuredFirst, isMeasuredMetric } from './metric-registry.js';
import { percentileRank } from './stats.js';

/**
 * The fresh-view axes: CDS length against the strongest measured evidence this
 * release publishes for UTEX 2973 (Tan 2018 TSS initiation today).
 *
 * A codon-usage convention such as CAI or tAI is never a fresh-view axis. It
 * stays selectable, and an encoded `ay=cai` link still wins over this default,
 * because `applyDecoded` writes explicit URL fields after the defaults.
 */
export const DEFAULT_METRIC_AXES = Object.freeze({ x: 'lengthNt', y: 'tssInitiation' });

/** Axis keys that must not open a fresh view, however available they are. */
const NON_DEFAULT_AXIS_KEYS = Object.freeze(['cai', 'tai', 'expressionProxy']);

/**
 * The default axes this dataset can actually draw.
 *
 * X keeps CDS length when it is published. Y prefers the declared default,
 * then any measurement this organism has, then a borrowed measurement with
 * its caveat, then the first published metric that is not a codon-usage
 * convention. Only a dataset publishing nothing else falls back to one of
 * those conventions, and then only because the alternative is an empty plot.
 *
 * @param {{byKey: Map<string, object>, metrics: object[]}} registry
 * @returns {{x: string, y: string}} keys that exist in `registry`.
 */
export function resolveDefaultMetricAxes(registry) {
  const metrics = registry.metrics ?? [];
  if (metrics.length === 0) return { ...DEFAULT_METRIC_AXES };
  const first = metrics[0].key;
  const x = registry.byKey.has(DEFAULT_METRIC_AXES.x) ? DEFAULT_METRIC_AXES.x : first;
  const measured = orderMeasuredFirst(metrics.filter(isMeasuredMetric));
  const preferred = [
    DEFAULT_METRIC_AXES.y,
    ...measured.map((metric) => metric.key),
    ...metrics
      .filter((metric) => !NON_DEFAULT_AXIS_KEYS.includes(metric.key) && metric.key !== x)
      .map((metric) => metric.key),
    first,
  ];
  const y = preferred.find((key) => registry.byKey.has(key)) ?? first;
  return { x, y };
}

function unavailableValues(rowCount) {
  return new Float64Array(rowCount).fill(NaN);
}

/** The three ways an axis can present a metric's numbers. Linear is the fresh default. */
export const AXIS_SCALES = Object.freeze(['linear', 'log10', 'percentile']);
export const DEFAULT_AXIS_SCALE = 'linear';
export const DEFAULT_AXIS_SCALES = Object.freeze({ x: DEFAULT_AXIS_SCALE, y: DEFAULT_AXIS_SCALE });

/**
 * Whether a column of raw metric reads can be shown on a log10 axis: every
 * finite value must be strictly positive, because log10 of zero or a negative
 * number is undefined. Reports the count so the option can explain itself
 * instead of quietly dropping genes.
 *
 * @param {Float64Array} values
 * @returns {{available: boolean, finiteCount: number, nonPositiveCount: number}}
 */
export function log10Availability(values) {
  let finiteCount = 0;
  let nonPositiveCount = 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!Number.isFinite(value)) continue;
    finiteCount += 1;
    if (value <= 0) nonPositiveCount += 1;
  }
  return { available: finiteCount > 0 && nonPositiveCount === 0, finiteCount, nonPositiveCount };
}

/** Convenience wrapper for a single registry metric, used by axis-scale controls. */
export function metricLog10Availability(metric, rowCount) {
  if (!metric) return { available: false, finiteCount: 0, nonPositiveCount: 0 };
  return log10Availability(metricValues(metric, rowCount));
}

/** A short, human sentence explaining why log10 is disabled for `label`. */
export function log10DisabledReason(label, availability) {
  if (availability.available) return null;
  if (availability.finiteCount === 0) return `${label} has no finite values on this axis.`;
  const count = availability.nonPositiveCount;
  return `log10 is unavailable for ${label}: ${count} value${count === 1 ? '' : 's'} `
    + `${count === 1 ? 'is' : 'are'} zero or negative.`;
}

/** log10 of strictly positive values; non-positive and non-finite values become NaN. */
function toLog10(values) {
  const out = new Float64Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    out[index] = Number.isFinite(value) && value > 0 ? Math.log10(value) : NaN;
  }
  return out;
}

/**
 * The visible cohort's finite values on this axis, sorted ascending. `mask`
 * selects the cohort, 1 per visible row; `null` means every row is in the
 * cohort. An empty result means every filter-visible gene lacks this metric
 * (or every gene is filtered out), so nothing can be ranked against it.
 */
function percentileCohort(values, mask) {
  const cohort = [];
  for (let index = 0; index < values.length; index += 1) {
    if (mask && !mask[index]) continue;
    const value = values[index];
    if (Number.isFinite(value)) cohort.push(value);
  }
  cohort.sort((a, b) => a - b);
  return cohort;
}

/**
 * Percentile rank (0-100) of each value against `cohort`. A row outside the
 * cohort still receives a rank against it, so a filtered-out gene keeps a map
 * coordinate exactly like every other axis scale does. An empty cohort ranks
 * every row NaN, including rows with a finite raw value: there is nothing to
 * rank against, not a missing measurement.
 */
function toPercentile(values, cohort) {
  const out = new Float64Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    out[index] = Number.isFinite(value) ? percentileRank(cohort, value) * 100 : NaN;
  }
  return out;
}

/** `scale`'s name as it appears in an axis title, or null for the plain linear axis. */
export function axisScaleName(scale) {
  if (scale === 'log10') return 'log10';
  if (scale === 'percentile') return 'percentile';
  return null;
}

/**
 * The part of an axis title after the metric name: a nonlinear scale always
 * wins over the native unit, per the explicit-metric-axes contract, because
 * the plotted numbers are no longer in that unit. Empty for a plain linear
 * axis with no declared unit. Kept separate from `axisTitle` so a renderer
 * that must shorten the title can shorten the metric name and never this
 * suffix.
 */
export function axisTitleSuffix(axis) {
  const scaleName = axisScaleName(axis.scale);
  if (scaleName) return `, ${scaleName}`;
  return axis.unit ? ` (${axis.unit})` : '';
}

/** The axis title a plot draws: the metric name plus `axisTitleSuffix`. */
export function axisTitle(axis) {
  return `${axis.label}${axisTitleSuffix(axis)}`;
}

function buildAxis(registry, key, rowCount, requestedScale, mask) {
  const metric = registry.byKey.get(key) ?? null;
  const raw = metric ? metricValues(metric, rowCount) : unavailableValues(rowCount);
  const log10 = log10Availability(raw);
  const scale = AXIS_SCALES.includes(requestedScale) ? requestedScale : DEFAULT_AXIS_SCALE;
  // A stale or hand-edited link asking for log10 on a metric that cannot take
  // it falls back to linear rather than drawing every gene as unavailable.
  const effectiveScale = scale === 'log10' && !log10.available ? DEFAULT_AXIS_SCALE : scale;
  const cohort = effectiveScale === 'percentile' ? percentileCohort(raw, mask) : null;
  const values = effectiveScale === 'log10' ? toLog10(raw)
    : effectiveScale === 'percentile' ? toPercentile(raw, cohort)
      : raw;
  return {
    key,
    metric,
    label: metric?.label ?? key,
    unit: metric?.unit ?? '',
    available: metric !== null,
    scale: effectiveScale,
    requestedScale: scale,
    log10Availability: log10,
    // Only meaningful when `scale === 'percentile'`: true means the ranking
    // cohort itself was empty, so this axis's NaNs are unranked, not missing.
    percentileCohortEmpty: cohort !== null && cohort.length === 0,
    rawValues: raw,
    values,
  };
}

/**
 * Build a deterministic, row-preserving projection from two registry metrics.
 * Missing values and unavailable metrics remain NaN in their original row
 * slots; `finitePairCount` says how many rows a scatter plot can draw. Each
 * axis carries its own scale, applied after the raw metric values are read.
 *
 * @param {{byKey: Map<string, object>}} registry result of buildMetricRegistry.
 * @param {number} rowCount number of gene rows to read.
 * @param {{x?: string, y?: string}} [keys] requested registry keys.
 * @param {{x?: string, y?: string}} [scales] requested per-axis scales.
 * @param {Uint8Array|null} [mask] visible cohort for percentile ranking; null
 *   treats every row as visible.
 * @returns {{x: object, y: object, rowCount: number, finitePairCount: number,
 *   available: boolean}}
 */
export function buildMetricAxesProjection(
  registry,
  rowCount,
  keys = DEFAULT_METRIC_AXES,
  scales = DEFAULT_AXIS_SCALES,
  mask = null,
) {
  const x = buildAxis(registry, keys.x ?? DEFAULT_METRIC_AXES.x, rowCount, scales?.x ?? DEFAULT_AXIS_SCALE, mask);
  const y = buildAxis(registry, keys.y ?? DEFAULT_METRIC_AXES.y, rowCount, scales?.y ?? DEFAULT_AXIS_SCALE, mask);
  let finitePairCount = 0;
  for (let index = 0; index < rowCount; index += 1) {
    if (Number.isFinite(x.values[index]) && Number.isFinite(y.values[index])) {
      finitePairCount += 1;
    }
  }
  return {
    x,
    y,
    rowCount,
    finitePairCount,
    available: x.available && y.available,
  };
}

/**
 * Whether the same registry key on both axes actually draws a diagonal: only
 * true when both axes also share their effective scale. Matching keys under
 * different scales (e.g. linear against percentile) trace a curve, not a
 * line, because the two axes are no longer the same transform of the metric.
 *
 * @param {{x: object, y: object}} axes result of buildMetricAxesProjection.
 */
export function isDiagonalAxisPair(axes) {
  return axes.x.key === axes.y.key && axes.x.scale === axes.y.scale;
}

/**
 * The reason an axes projection has nothing to plot, distinguishing a
 * genuinely unavailable metric from an empty percentile ranking cohort: the
 * latter still has metric values, they are just unranked because no visible
 * gene remains to rank them against. Returns null when the projection has
 * finite pairs to plot.
 *
 * @param {{x: object, y: object, available: boolean, finitePairCount: number}} axes
 * @returns {string|null}
 */
export function axesUnavailableMessage(axes) {
  if (axes.finitePairCount > 0) return null;
  if (!axes.available) {
    return 'A selected metric is unavailable in this dataset. Choose another axis.';
  }
  const emptyCohortAxis = axes.x.percentileCohortEmpty ? axes.x
    : axes.y.percentileCohortEmpty ? axes.y
      : null;
  if (emptyCohortAxis) {
    return `No visible genes remain to rank ${emptyCohortAxis.label} by percentile. `
      + 'Relax the filters to restore a ranking cohort.';
  }
  return 'No genes have values on both selected axes. Choose another pair of metrics.';
}
