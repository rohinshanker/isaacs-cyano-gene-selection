/**
 * Row-aligned values for an explicit X-versus-Y metric scatter plot.
 *
 * This is deliberately separate from PCA: choosing axes only reads the metric
 * registry and never fits or transforms coordinates.
 */
import { metricValues } from './metric-registry.js';

export const DEFAULT_METRIC_AXES = Object.freeze({ x: 'lengthNt', y: 'cai' });

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
