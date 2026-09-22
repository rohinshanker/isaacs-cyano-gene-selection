/**
 * Row-aligned values for an explicit X-versus-Y metric scatter plot.
 *
 * This is deliberately separate from PCA: choosing axes only reads the metric
 * registry and never fits or transforms coordinates.
 */
import { metricValues, orderMeasuredFirst, isMeasuredMetric } from './metric-registry.js';

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

function buildAxis(registry, key, rowCount) {
  const metric = registry.byKey.get(key) ?? null;
  return {
    key,
    metric,
    label: metric?.label ?? key,
    unit: metric?.unit ?? '',
    available: metric !== null,
    values: metric ? metricValues(metric, rowCount) : unavailableValues(rowCount),
  };
}

/**
 * Build a deterministic, row-preserving projection from two registry metrics.
 * Missing values and unavailable metrics remain NaN in their original row
 * slots; `finitePairCount` says how many rows a scatter plot can draw.
 *
 * @param {{byKey: Map<string, object>}} registry result of buildMetricRegistry.
 * @param {number} rowCount number of gene rows to read.
 * @param {{x?: string, y?: string}} [keys] requested registry keys.
 * @returns {{x: object, y: object, rowCount: number, finitePairCount: number,
 *   available: boolean}}
 */
export function buildMetricAxesProjection(
  registry,
  rowCount,
  keys = DEFAULT_METRIC_AXES,
) {
  const x = buildAxis(registry, keys.x ?? DEFAULT_METRIC_AXES.x, rowCount);
  const y = buildAxis(registry, keys.y ?? DEFAULT_METRIC_AXES.y, rowCount);
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
