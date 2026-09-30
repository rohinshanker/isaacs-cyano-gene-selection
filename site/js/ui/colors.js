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

/**
 * Ten qualitative colours: the eight Okabe-Ito hues plus wine and teal from Tol's
 * muted set, all separable under the common colour-vision deficiencies. Ten is
 * the lab's largest candidate panel. Colour is one of three channels a series
 * carries; see SERIES_STYLES in compare-model.js for the dash and marker.
 */
export const CATEGORICAL = [
  '#0072b2', '#e69f00', '#009e73', '#cc79a7',
  '#56b4e9', '#d55e00', '#f0e442', '#333333',
  '#882255', '#44aa99',
];

/** Colour for a point with no value: an unsaturated grey, paired with an open marker. */
export const MISSING_COLOR = '#9aa3ad';
/** Colour for points hidden by a filter, drawn behind everything else. */
export const GHOST_COLOR = '#d8dde3';
export const GHOST_BORDER = '#687583';
/** A separate bucket for loci with multiple reviewed functions. */
export const MULTIPLE_FUNCTION_COLOR = '#7b3294';
export const CATEGORY_UNKNOWN_COLOR = '#c6cdd5';
/** Selection-marker colours shared by the canvas and its inline-SVG legend. */
export const SHORTLIST_COLOR = '#1b2733';
export const PINNED_COLOR = '#b3261e';
export const REVIEWED_MARKER_BORDER = '#314254';
/**
 * Derived (computational) category markers are hollow: a white disc with the
 * category colour as ring and centre dot, so they never read as reviewed.
 */
export const DERIVED_MARKER_FILL = '#ffffff';
export const HOVER_FOCUS_COLOR = '#4a5568';
export const ACTIVE_FOCUS_COLOR = '#2f6f8f';

/** Categorical colours use the same bucket interface as numeric canvas scales. */
export function buildCategoryColorScale(categoryCount) {
  if (!Number.isInteger(categoryCount) || categoryCount < 1 || categoryCount > CATEGORICAL.length) {
    throw new Error('category count exceeds the reviewed colour palette');
  }
  const buckets = [...CATEGORICAL.slice(0, categoryCount), MULTIPLE_FUNCTION_COLOR];
  return {
    buckets,
    categorical: true,
    bucketOf(value) {
      return Number.isInteger(value) && value >= 0 && value < buckets.length ? value : -1;
    },
  };
}

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

/** Ramp families a metric definition may declare in `meta.metrics[key].scale`. */
export const SCALE_FAMILIES = Object.freeze(['sequential', 'diverging']);

/**
 * Whether a metric's ramp is centred on zero: the family the pipeline declares
 * when it declares one, otherwise inferred from the sign of the data.
 *
 * Exported because the choice of value scale depends on it — a scale that cannot
 * hold a centre cannot be offered for a centred ramp — and that decision is made
 * before the ramp itself is built.
 *
 * @param {Float64Array|number[]} values
 * @param {string|null|undefined} declaredScale `meta.metrics[key].scale`.
 * @returns {boolean}
 */
export function isDivergingRamp(values, declaredScale) {
  if (SCALE_FAMILIES.includes(declaredScale)) return declaredScale === 'diverging';
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return min < 0 && max > 0;
}

/** Pre-quantized ramp buckets let the canvas batch its draws by fill style. */
export const RAMP_BUCKET_COUNT = 48;

/**
 * A colour scale over a set of values.
 *
 * The ramp family comes from the metric's declared `scale` when the pipeline
 * publishes one: diverging for signed quantities, sequential for magnitudes.
 * A ramp reads a value; it says nothing about whether high is good, so the
 * metric's `direction` is never consulted. When no scale is declared the family
 * is inferred from the sign of the data and `scaleSource` says so, so the
 * legend can tell the reader the choice was a guess rather than a contract.
 *
 * `transform` is the reader's chosen value scale from
 * `../core/value-scales.js`, and it changes only which ramp position a value
 * takes: the domain is measured in transformed space, and `min`, `max` and
 * `mid` are inverted back so a legend always labels a ramp position in the
 * metric's own units. Every one of those is a real measurement — a rank scale
 * inverts to the cohort's own value at that rank — but only an exactly
 * invertible scale puts it back at the position it was read from, so a legend
 * places a label at `normalize(value)` rather than assuming the position it
 * asked for; see `rampTicks` in ui/legend.js. A diverging ramp keeps zero at its midpoint under any
 * transform that sends zero to zero, which is every transform offered for a
 * diverging metric. A transform that cannot represent this column's extremes —
 * a hand-edited link asking for a logarithm of a zero — is refused here and the
 * ramp falls back to linear, reporting that in `scaleName` so the legend and the
 * accessible description name the scale actually drawn.
 *
 * @param {Float64Array|number[]} values
 * @param {{scale?: string|null, transform?: {scale: string, transition: number|null,
 *   apply: (value: number) => number, invert: (position: number) => number}}} options
 * @returns {{color(value: number): string, normalize(value: number): number,
 *   min: number, max: number, mid: number,
 *   diverging: boolean, buckets: string[], bucketOf(value: number): number,
 *   scaleSource: 'declared'|'inferred', scaleName: string, scaleTransition: number|null}}
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
  const declared = SCALE_FAMILIES.includes(options.scale) ? options.scale : null;
  // Inferred from the raw sign, not the transformed one: a rank-based transform
  // has no negative numbers left to infer from, and the question — does this
  // quantity have a sign — is about the measurement, not about how it is drawn.
  // `min`/`max` here are the raw extremes, widened only when the column is flat.
  const diverging = isDivergingRamp(values, options.scale);
  const scaleSource = declared ? 'declared' : 'inferred';
  const requested = options.transform ?? null;
  const zeroAt = requested ? requested.apply(0) : 0;
  const usable = requested === null || (
    Number.isFinite(requested.apply(min)) && Number.isFinite(requested.apply(max))
      && (!diverging || Number.isFinite(zeroAt))
  );
  const transform = usable && requested ? requested : null;
  const project = transform ? transform.apply : (value) => value;
  const unproject = transform ? transform.invert : (position) => position;
  let lo = project(min);
  let hi = project(max);
  if (lo === hi) hi = lo + 1;
  if (diverging) {
    // The centre is where the transform puts zero, and the two arms are given
    // the same reach, so grey always means zero and the sign of a colour is the
    // sign of the value under every scale a diverging metric is offered.
    const centre = transform ? zeroAt : 0;
    const half = Math.max(centre - lo, hi - centre);
    lo = centre - half;
    hi = centre + half;
  }
  const normalize = (value) => (project(value) - lo) / (hi - lo);
  // The three values a legend labels the ramp with, read back into the metric's
  // own units. Only these three are needed, so the inverse is not exposed: a
  // caller with a ramp position and no value to go with it has nothing truthful
  // to do with it under a scale whose inverse is not exact.
  const valueAt = (position) => unproject(lo + (hi - lo) * position);
  const ramp = diverging ? divergingColor : sequentialColor;

  const buckets = Array.from(
    { length: RAMP_BUCKET_COUNT }, (_, i) => ramp(i / (RAMP_BUCKET_COUNT - 1)),
  );
  const bucketOf = (value) => {
    const t = normalize(value);
    if (!Number.isFinite(t)) return -1;
    const clamped = Math.min(1, Math.max(0, t));
    return Math.min(RAMP_BUCKET_COUNT - 1, Math.round(clamped * (RAMP_BUCKET_COUNT - 1)));
  };
  return {
    min: valueAt(0),
    max: valueAt(1),
    mid: diverging ? 0 : valueAt(0.5),
    diverging,
    scaleSource,
    scaleName: transform ? transform.scale : 'linear',
    scaleTransition: transform ? transform.transition : null,
    normalize,
    buckets,
    bucketOf,
    color: (value) => {
      const t = normalize(value);
      return Number.isFinite(t) ? ramp(t) : MISSING_COLOR;
    },
  };
}
