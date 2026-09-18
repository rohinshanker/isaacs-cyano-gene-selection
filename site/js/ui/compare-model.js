/**
 * The comparison charts' model: scale, series identity, and missing geometry.
 *
 * Nothing here touches the DOM, so every rule the radar and parallel-coordinate
 * views share is testable in Node. The one rule that matters most: a missing
 * value has no position. It is never the median, never zero, never anything a
 * reader could mistake for a measurement.
 */
import { CATEGORICAL } from './colors.js';
import { sortedFinite, medianSorted, quantileSorted } from '../core/stats.js';

/** Metrics the comparison views prefer when the user has not chosen. */
export const DEFAULT_AXES = [
  'gc3', 'enc', 'cai', 'tai', 'rareFraction', 'cps', 'mfeStart', 'targetFraction',
];

/** Fewest axes a comparison can be drawn with. */
export const MIN_AXES = 3;

/** How many axes the defaults fall back to when nothing preferred is present. */
const FALLBACK_AXIS_COUNT = 8;

/** z-scores are clamped to this many robust spreads either side of the median. */
export const Z_LIMIT = 3;

/** Marker shapes, one per series, so two series never share both colour and shape. */
export const MARKERS = Object.freeze([
  'circle', 'square', 'triangle', 'diamond', 'cross', 'plus', 'triangleDown', 'star',
  'hexagon', 'bar',
]);

const DASHES = Object.freeze([
  [], [7, 4], [2, 3], [10, 3, 2, 3], [5, 3, 1, 3], [1, 3], [12, 4], [4, 2, 8, 2],
  [9, 3, 1, 3, 1, 3], [3, 5],
]);

/**
 * Ten combined encodings. Every pair differs in colour, dash, and marker, so a
 * panel of ten candidates, the lab's upper target, stays distinguishable even when
 * one channel is hard to read. Beyond ten the styles repeat and `repeated` says so,
 * so the legend can warn rather than silently reuse an identity.
 */
export const SERIES_STYLES = Object.freeze(CATEGORICAL.map((color, i) => Object.freeze({
  color,
  dash: DASHES[i % DASHES.length],
  marker: MARKERS[i % MARKERS.length],
})));

/** Style for the series at shortlist position `order`. */
export function seriesStyle(order) {
  const style = SERIES_STYLES[order % SERIES_STYLES.length];
  return { ...style, repeated: order >= SERIES_STYLES.length };
}

/** Median and scaled median absolute deviation, a spread that outliers cannot inflate. */
export function robustScale(values) {
  const sorted = sortedFinite(values);
  if (sorted.length === 0) {
    return { median: NaN, spread: NaN, constant: true, finiteCount: 0 };
  }
  const median = medianSorted(sorted);
  const constant = sorted[0] === sorted[sorted.length - 1];
  const deviations = sortedFinite(Float64Array.from(sorted, (value) => Math.abs(value - median)));
  const mad = medianSorted(deviations) * 1.4826;
  const spread = mad > 1e-12
    ? mad
    : (quantileSorted(sorted, 0.75) - quantileSorted(sorted, 0.25)) || 1;
  return { median, spread, constant, finiteCount: sorted.length };
}

/**
 * Robust z-score of one value, clamped to ±Z_LIMIT. NaN when the value or the
 * scale is missing: a missing value must stay missing all the way to the pixel.
 */
export function zScore(value, scale) {
  if (!Number.isFinite(value) || !Number.isFinite(scale.median) || !Number.isFinite(scale.spread)) {
    return NaN;
  }
  return Math.max(-Z_LIMIT, Math.min(Z_LIMIT, (value - scale.median) / scale.spread));
}

/**
 * Why a metric cannot serve as a default comparison axis, or null when it can.
 * @param {{constant: boolean, finiteCount: number, median: number}} scale
 */
export function axisUnavailableReason(metric, scale) {
  if (scale.finiteCount === 0) return `${metric.label}: no gene has a value.`;
  if (scale.constant) {
    const value = Number.isInteger(scale.median) ? String(scale.median) : scale.median.toPrecision(3);
    return `${metric.label}: every gene is ${value}, so there is nothing to compare.`;
  }
  return null;
}

/**
 * Pick the axes to draw when the user has not chosen.
 *
 * Preferred metrics with no spread are left out and named, so the reader learns
 * that an axis is unavailable rather than seeing a flat spoke of identical points.
 *
 * @param {{metrics: object[], byKey: Map<string, object>}} registry
 * @param {(metric: object) => object} scaleFor returns a `robustScale` result.
 * @returns {{axes: object[], dropped: Array<{metric: object, reason: string}>}}
 */
export function defaultAxes(registry, scaleFor) {
  const dropped = [];
  const usable = (metric) => {
    const reason = axisUnavailableReason(metric, scaleFor(metric));
    if (reason) dropped.push({ metric, reason });
    return !reason;
  };
  const preferred = DEFAULT_AXES
    .map((key) => registry.byKey.get(key))
    .filter(Boolean)
    .filter(usable);
  if (preferred.length >= MIN_AXES) return { axes: preferred, dropped };
  const fallback = registry.metrics
    .filter((metric) => metric.key !== 'lengthNt' && !preferred.includes(metric))
    .filter(usable);
  return { axes: [...preferred, ...fallback].slice(0, FALLBACK_AXIS_COUNT), dropped };
}

/**
 * Split a sequence of points into runs of consecutive present points.
 *
 * A gap in the data becomes a gap in the line. For a closed shape such as a radar
 * polygon, the run that ends at the last point joins the run that starts at the
 * first, so a fully present series still closes while a series with one missing
 * axis is drawn open.
 *
 * @param {boolean[]} present
 * @param {{closed?: boolean}} options
 * @returns {number[][]} index runs, each of length ≥ 1, in drawing order.
 */
export function presentRuns(present, { closed = false } = {}) {
  const runs = [];
  let current = [];
  present.forEach((isPresent, i) => {
    if (isPresent) {
      current.push(i);
    } else if (current.length > 0) {
      runs.push(current);
      current = [];
    }
  });
  if (current.length > 0) runs.push(current);
  if (closed && runs.length > 1 && present[0] && present[present.length - 1]) {
    const first = runs.shift();
    runs[runs.length - 1].push(...first);
  }
  return runs;
}

/**
 * Count missing values per series and in total.
 * @param {Array<{id: string, index: number}>} series
 * @param {object[]} axes
 * @param {(metric: object, index: number) => number} read
 * @returns {{total: number, bySeries: Map<string, number>, byAxis: Map<string, number>}}
 */
export function countMissing(series, axes, read) {
  const bySeries = new Map();
  const byAxis = new Map();
  let total = 0;
  for (const entry of series) {
    let missing = 0;
    for (const metric of axes) {
      if (Number.isFinite(read(metric, entry.index))) continue;
      missing += 1;
      byAxis.set(metric.key, (byAxis.get(metric.key) ?? 0) + 1);
    }
    bySeries.set(entry.id, missing);
    total += missing;
  }
  return { total, bySeries, byAxis };
}

/**
 * Break a label into at most two lines that each fit `maxWidth`, measured with the
 * caller's text metrics. A label that cannot be split stays whole so it is never
 * truncated; the caller widens the chart instead.
 * @param {string} text
 * @param {number} maxWidth
 * @param {(text: string) => number} measure
 * @returns {string[]}
 */
export function wrapLabel(text, maxWidth, measure) {
  if (measure(text) <= maxWidth) return [text];
  const words = text.split(' ');
  if (words.length < 2) return [text];
  let best = null;
  for (let split = 1; split < words.length; split += 1) {
    const first = words.slice(0, split).join(' ');
    const second = words.slice(split).join(' ');
    const width = Math.max(measure(first), measure(second));
    if (!best || width < best.width) best = { width, lines: [first, second] };
  }
  return best.lines;
}

/** Plain-language count of missing values for a description or legend entry. */
export function describeMissing(count) {
  if (count === 0) return 'no missing values';
  return `${count} missing value${count === 1 ? '' : 's'}`;
}

/**
 * Draw a series marker centred on (x, y). Filled shapes use `fill`, stroked
 * shapes use `stroke`; both are the series colour, set by the caller.
 */
export function drawMarker(context, marker, x, y, size) {
  const s = size;
  context.beginPath();
  switch (marker) {
    case 'square':
      context.rect(x - s, y - s, s * 2, s * 2);
      context.fill();
      break;
    case 'triangle':
      context.moveTo(x, y - s * 1.2);
      context.lineTo(x + s * 1.15, y + s * 0.85);
      context.lineTo(x - s * 1.15, y + s * 0.85);
      context.closePath();
      context.fill();
      break;
    case 'triangleDown':
      context.moveTo(x, y + s * 1.2);
      context.lineTo(x + s * 1.15, y - s * 0.85);
      context.lineTo(x - s * 1.15, y - s * 0.85);
      context.closePath();
      context.fill();
      break;
    case 'diamond':
      context.moveTo(x, y - s * 1.3);
      context.lineTo(x + s * 1.3, y);
      context.lineTo(x, y + s * 1.3);
      context.lineTo(x - s * 1.3, y);
      context.closePath();
      context.fill();
      break;
    case 'cross':
      context.moveTo(x - s, y - s);
      context.lineTo(x + s, y + s);
      context.moveTo(x + s, y - s);
      context.lineTo(x - s, y + s);
      context.stroke();
      break;
    case 'plus':
      context.moveTo(x - s * 1.2, y);
      context.lineTo(x + s * 1.2, y);
      context.moveTo(x, y - s * 1.2);
      context.lineTo(x, y + s * 1.2);
      context.stroke();
      break;
    case 'star':
      for (let i = 0; i < 10; i += 1) {
        const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? s * 1.4 : s * 0.6;
        const px = x + Math.cos(angle) * r;
        const py = y + Math.sin(angle) * r;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
      break;
    case 'hexagon':
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2;
        const px = x + Math.cos(angle) * s * 1.2;
        const py = y + Math.sin(angle) * s * 1.2;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
      break;
    case 'bar':
      context.rect(x - s * 0.5, y - s * 1.4, s, s * 2.8);
      context.fill();
      break;
    case 'circle':
    default:
      context.arc(x, y, s, 0, Math.PI * 2);
      context.fill();
  }
}

/**
 * The missing-value glyph: an open cross the series colour, distinct from every
 * data marker, drawn only where no value could sit.
 */
export function drawMissingGlyph(context, x, y, size) {
  context.beginPath();
  context.moveTo(x - size, y - size);
  context.lineTo(x + size, y + size);
  context.moveTo(x + size, y - size);
  context.lineTo(x - size, y + size);
  context.stroke();
  context.beginPath();
  context.arc(x, y, size * 1.7, 0, Math.PI * 2);
  context.stroke();
}
