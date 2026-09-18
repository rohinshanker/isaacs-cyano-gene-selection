/**
 * Colour scales.
 *
 * Every scale here is legible under deuteranopia, protanopia, and tritanopia:
 * viridis for one-directional values, a blue-to-orange ramp for changes that
 * have a sign, and the Okabe-Ito set for categories. Colour never carries
 * meaning on its own; shape and text always repeat it.
 */

const VIRIDIS = [
  [68, 1, 84], [72, 40, 120], [62, 74, 137], [49, 104, 142],
  [38, 130, 142], [31, 158, 137], [53, 183, 121], [109, 205, 89],
  [180, 222, 44], [253, 231, 37],
];

/** Blue to light grey to orange: signed, and distinguishable without hue. */
const DIVERGING = [
  [5, 48, 97], [33, 102, 172], [67, 147, 195], [146, 197, 222],
  [222, 222, 222], [253, 200, 148], [244, 155, 70], [204, 108, 20], [140, 70, 8],
];

/** Okabe-Ito qualitative palette. */
export const CATEGORICAL = [
  '#0072b2', '#e69f00', '#009e73', '#cc79a7',
  '#56b4e9', '#d55e00', '#f0e442', '#333333',
];

/** Colour for a point with no value: an unsaturated grey, paired with an open marker. */
export const MISSING_COLOR = '#9aa3ad';
/** Colour for points hidden by a filter, drawn behind everything else. */
export const GHOST_COLOR = '#d8dde3';

function interpolate(stops, t) {
  const clamped = Math.min(1, Math.max(0, t));
  const position = clamped * (stops.length - 1);
  const low = Math.floor(position);
  const high = Math.min(stops.length - 1, low + 1);
  const f = position - low;
  const channel = (i) => Math.round(stops[low][i] + (stops[high][i] - stops[low][i]) * f);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

/** Viridis at `t` in [0, 1]. */
function sequentialColor(t) {
  return interpolate(VIRIDIS, t);
}

/** Diverging ramp at `t` in [0, 1], with 0.5 as the neutral midpoint. */
export function divergingColor(t) {
  return interpolate(DIVERGING, t);
}

/**
 * A colour scale over a set of values.
 *
 * @param {Float64Array|number[]} values
 * @param {{diverging?: boolean}} options
 * @returns {{color(value: number): string, normalize(value: number): number,
 *   min: number, max: number, mid: number, diverging: boolean, buckets: string[],
 *   bucketOf(value: number): number}}
 */
export function buildColorScale(values, options = {}) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min)) {
    min = 0;
    max = 1;
  }
  if (min === max) max = min + 1;
  const diverging = options.diverging ?? (min < 0 && max > 0);
  const extent = diverging ? Math.max(Math.abs(min), Math.abs(max)) : 0;
  const lo = diverging ? -extent : min;
  const hi = diverging ? extent : max;
  const normalize = (value) => (value - lo) / (hi - lo);
  const ramp = diverging ? divergingColor : sequentialColor;

  // Pre-quantized buckets let the canvas batch draws by fill style.
  const bucketCount = 48;
  const buckets = Array.from({ length: bucketCount }, (_, i) => ramp(i / (bucketCount - 1)));
  const bucketOf = (value) => {
    if (!Number.isFinite(value)) return -1;
    const t = Math.min(1, Math.max(0, normalize(value)));
    return Math.min(bucketCount - 1, Math.round(t * (bucketCount - 1)));
  };
  return {
    min: lo,
    max: hi,
    mid: diverging ? 0 : (lo + hi) / 2,
    diverging,
    normalize,
    buckets,
    bucketOf,
    color: (value) => (Number.isFinite(value) ? ramp(normalize(value)) : MISSING_COLOR),
  };
}
