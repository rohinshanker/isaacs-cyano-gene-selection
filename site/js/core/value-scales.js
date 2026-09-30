/**
 * The one way this interface rescales a column of metric reads.
 *
 * Both the Metric X vs Y axes and the colour ramp choose a scale from this
 * module: the same names, the same availability test, the same disabled-option
 * wording, and the same transform. A scale only ever changes where a value is
 * drawn or which colour it takes. Nothing here touches a stored value, so the
 * detail cards, tooltips, filters, thresholds, sorting, comparisons and the CSV
 * export all keep reading the metric's real numbers.
 *
 * `site/js/core/metric-axes.js` re-exports the log10 helpers it has always
 * exposed, so an axis caller needs no change; the axes offer a subset of the
 * scales the colour ramp offers, which is a display decision recorded in
 * docs/validation/explicit-metric-axes.md, not a second mechanism.
 */
import { percentileRank, quantileSorted } from './stats.js';

/**
 * Every scale the interface can apply to a metric column, in the order a
 * selector lists them. Linear first, because it is the fresh default for any
 * metric the default rule below does not find skewed.
 */
export const VALUE_SCALES = Object.freeze(['linear', 'log10', 'percentile', 'sqrt', 'symlog']);

/** The scale a metric falls back to when nothing else applies. */
export const DEFAULT_VALUE_SCALE = 'linear';

/** The scales a Metric X vs Y axis offers, a subset of {@link VALUE_SCALES}. */
export const AXIS_SCALES = Object.freeze(['linear', 'log10', 'percentile']);

/** What a scale is called in a control, a legend, or a spoken description. */
export const VALUE_SCALE_LABELS = Object.freeze({
  linear: 'Linear',
  log10: 'Logarithmic',
  percentile: 'Percentile',
  sqrt: 'Square root',
  symlog: 'Symmetric log',
});

/**
 * The scale named as a clause an accessible description can carry, e.g. "on a
 * logarithmic scale". Always stated, linear included: a reader who cannot see
 * the ramp has no other way to learn which colour a value takes.
 *
 * @param {string} scale a key in {@link VALUE_SCALES}.
 * @returns {string}
 */
export function valueScaleClause(scale) {
  const label = VALUE_SCALE_LABELS[scale] ?? VALUE_SCALE_LABELS[DEFAULT_VALUE_SCALE];
  return `on a ${label.toLowerCase()} scale`;
}

/**
 * The share of a metric's valued genes that must fall in the lowest tenth of
 * its linear range before the ramp defaults to a logarithmic scale.
 *
 * One constant, because the rule is the thing that ships and not the list of
 * metrics it happens to select today; tests/js/color-scale-defaults.test.mjs
 * pins which metrics it selects on the shipped release so a change in the data
 * that moves a metric across this line is seen in review.
 */
export const SKEWED_DEFAULT_SHARE = 0.9;

/**
 * The share of finite values falling in the lowest tenth of the linear range —
 * the share a linear ramp paints in very nearly the same colour.
 *
 * `null` means there is no measurable range: either no gene has a value, or
 * every valued gene has the same one, and in both cases a tenth of the range is
 * not a tenth of anything.
 *
 * @param {Float64Array|number[]} values
 * @returns {number|null} a fraction in [0, 1], or null.
 */
export function lowestTenthShare(values) {
  let min = Infinity;
  let max = -Infinity;
  let finiteCount = 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!Number.isFinite(value)) continue;
    finiteCount += 1;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (finiteCount === 0 || min === max) return null;
  const cut = min + (max - min) / 10;
  let inside = 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (Number.isFinite(value) && value <= cut) inside += 1;
  }
  return inside / finiteCount;
}

/**
 * Whether a column of raw metric reads can be shown on a log10 scale: every
 * finite value must be strictly positive, because log10 of zero or a negative
 * number is undefined. Reports the count so the option can explain itself
 * instead of quietly dropping genes.
 *
 * @param {Float64Array|number[]} values
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

/**
 * Whether a column can be shown on a square-root scale: every finite value
 * must be non-negative. Zero is fine, which is the whole reason this scale is
 * offered beside log10 for counts.
 *
 * @param {Float64Array|number[]} values
 * @returns {{available: boolean, finiteCount: number, negativeCount: number}}
 */
export function sqrtAvailability(values) {
  let finiteCount = 0;
  let negativeCount = 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!Number.isFinite(value)) continue;
    finiteCount += 1;
    if (value < 0) negativeCount += 1;
  }
  return { available: finiteCount > 0 && negativeCount === 0, finiteCount, negativeCount };
}

/** One sentence naming a scale, the metric, and why the scale cannot be used. */
function unavailableSentence(scaleName, label, detail) {
  return `${scaleName} is unavailable for ${label}: ${detail}.`;
}

/** The sentence for a column with nothing to scale at all. */
function noValuesSentence(label) {
  return `${label} has no finite values to scale.`;
}

/** How many zero or negative values block log10, as a clause. */
function nonPositiveClause(count) {
  return `${count} value${count === 1 ? '' : 's'} ${count === 1 ? 'is' : 'are'} zero or negative`;
}

/** How many negative values block a square root, as a clause. */
function negativeClause(count) {
  return `${count} value${count === 1 ? '' : 's'} ${count === 1 ? 'is' : 'are'} negative`;
}

/**
 * A short, human sentence explaining why log10 is disabled for `label`, in the
 * terse register a plot axis uses — the axis title itself reads "log10", so the
 * note beside it does too. A control that names the scale in words passes
 * through {@link valueScaleAvailability} instead.
 *
 * @param {string} label
 * @param {{available: boolean, finiteCount: number, nonPositiveCount: number}} availability
 * @returns {string|null} null when log10 is available.
 */
export function log10DisabledReason(label, availability) {
  if (availability.available) return null;
  if (availability.finiteCount === 0) return noValuesSentence(label);
  return unavailableSentence('log10', label, nonPositiveClause(availability.nonPositiveCount));
}

/**
 * The transition scale a symmetric-log scale uses for one metric: the median of
 * the non-zero absolute finite values, rounded down to a power of ten.
 *
 * It is a transition scale and not a linear threshold: the transform is one
 * smooth formula everywhere, approximately linear for magnitudes well under this
 * value and logarithmic for magnitudes well over it, with the bend spread around
 * ±this value rather than a straight segment that stops at it. A piecewise
 * transform would give the exact linear interval instead, at the price of a kink
 * in the colour ramp at the transition, which the owner chose against.
 *
 * The rule is one deterministic value per metric, derived from that metric's own
 * data, and it is what the legend states. Rounding down to a decade is what
 * makes it legible and stable: the legend reads "±10 nt" rather than "±53 nt",
 * and it only moves when the metric's typical magnitude crosses a decade, so an
 * ordinary data refresh does not silently repaint the map. The median is the
 * centre of the choice: roughly half of the valued genes fall below it, where
 * small signed differences near zero are read very nearly as they are rather
 * than exaggerated, while the long tail above it is compressed logarithmically
 * — which is the whole reason a signed, heavily skewed metric needs this scale.
 *
 * A column with no non-zero finite value has nothing to take a median of and
 * gets 1, which makes the transform `log10(1 + |v|)` on a column that is all
 * zeros anyway.
 *
 * @param {Float64Array|number[]} values
 * @returns {number} a strictly positive power of ten.
 */
export function symlogTransition(values) {
  const magnitudes = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (Number.isFinite(value) && value !== 0) magnitudes.push(Math.abs(value));
  }
  if (magnitudes.length === 0) return 1;
  magnitudes.sort((a, b) => a - b);
  const median = quantileSorted(magnitudes, 0.5);
  if (!Number.isFinite(median) || median <= 0) return 1;
  return 10 ** Math.floor(Math.log10(median));
}

/**
 * Which scales a metric column can take, and why each blocked one cannot.
 *
 * Nothing is ever hidden: a caller renders every entry and disables the ones
 * that report `available: false`, showing `reason` so a reader learns something
 * about the metric instead of wondering where an option went. No offset is ever
 * added to make a logarithm work; a metric with a zero simply offers Square root
 * or Symmetric log instead.
 *
 * `centred` says the consumer draws this metric centred on zero — the diverging
 * colour ramp does. A logarithm has no value at zero, so it cannot hold that
 * centre and is refused rather than approximated.
 *
 * @param {Float64Array|number[]} values
 * @param {{label?: string, centred?: boolean}} [options]
 * @returns {Map<string, {available: boolean, reason: string|null}>} one entry
 *   per {@link VALUE_SCALES} key, in that order.
 */
export function valueScaleAvailability(values, options = {}) {
  const label = options.label ?? 'This metric';
  const centred = options.centred === true;
  const log10 = log10Availability(values);
  const sqrt = sqrtAvailability(values);
  const empty = log10.finiteCount === 0;
  const entries = new Map();
  const add = (scale, available, reason) => entries.set(scale, {
    available, reason: available ? null : reason,
  });

  if (empty) {
    for (const scale of VALUE_SCALES) add(scale, false, noValuesSentence(label));
    return entries;
  }
  add('linear', true, null);
  // What the data itself forbids is named first, because it is the more concrete
  // fact about the metric; the centre is the reason that remains for a diverging
  // metric whose values happen to be strictly positive.
  if (!log10.available) {
    add('log10', false, unavailableSentence(
      VALUE_SCALE_LABELS.log10, label, nonPositiveClause(log10.nonPositiveCount),
    ));
  } else {
    add('log10', !centred, unavailableSentence(
      VALUE_SCALE_LABELS.log10, label,
      'its ramp is centred on zero and a logarithm has no value there',
    ));
  }
  add('percentile', true, null);
  add('sqrt', sqrt.available, unavailableSentence(
    VALUE_SCALE_LABELS.sqrt, label, negativeClause(sqrt.negativeCount),
  ));
  add('symlog', true, null);
  return entries;
}

/**
 * The scale a metric opens on, as a rule rather than a list.
 *
 * A metric defaults to Logarithmic when every finite value is strictly positive
 * and at least {@link SKEWED_DEFAULT_SHARE} of its valued genes fall in the
 * lowest tenth of its linear range — the condition under which a linear ramp
 * paints nearly every gene the same colour and hides the measurement it is
 * meant to show. A metric that meets the same skew test but carries a zero or a
 * negative value, where a logarithm is undefined, defaults to Symmetric log.
 * Everything else opens Linear.
 *
 * @param {Float64Array|number[]} values
 * @param {{centred?: boolean}} [options] as {@link valueScaleAvailability}.
 * @returns {string} a key in {@link VALUE_SCALES}.
 */
export function defaultValueScale(values, options = {}) {
  const share = lowestTenthShare(values);
  if (share === null || share < SKEWED_DEFAULT_SHARE) return DEFAULT_VALUE_SCALE;
  return valueScaleAvailability(values, options).get('log10').available ? 'log10' : 'symlog';
}

/** The finite values of `values`, ascending, for a rank-based scale. */
function sortedFinite(values) {
  const cohort = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (Number.isFinite(value)) cohort.push(value);
  }
  cohort.sort((a, b) => a - b);
  return cohort;
}

const IDENTITY_TRANSFORM = Object.freeze({
  scale: 'linear',
  transition: null,
  apply: (value) => (Number.isFinite(value) ? value : NaN),
  invert: (position) => position,
});

/**
 * The monotone transform one scale applies to a metric's values, with its own
 * inverse so a legend can label a ramp position in the metric's real units.
 *
 * Every transform maps a non-finite value to NaN, so a gene with no value stays
 * absent under every scale rather than being given a position or a colour. The
 * signed transforms (`linear`, `sqrt`, `symlog`) are odd and send 0 to 0, which
 * is what lets a diverging ramp keep its centre; `log10` is neither, which is
 * why {@link valueScaleAvailability} refuses it for a centred ramp.
 *
 * @param {string} scale a key in {@link VALUE_SCALES}; anything else is linear.
 * @param {Float64Array|number[]} values the column the scale is fitted to.
 * @param {{cohort?: number[]}} [options] `cohort` is the ascending finite values a
 *   rank-based scale ranks against, for a caller that ranks within a subset —
 *   the percentile axis ranks the filter-visible cohort, while the colour ramp
 *   ranks every valued gene. Omitted means every finite value in `values`.
 * @returns {{scale: string, transition: number|null, apply: (value: number) => number,
 *   invert: (position: number) => number}}
 */
export function valueScaleTransform(scale, values, options = {}) {
  if (scale === 'log10') {
    return {
      scale,
      transition: null,
      apply: (value) => (Number.isFinite(value) && value > 0 ? Math.log10(value) : NaN),
      invert: (position) => 10 ** position,
    };
  }
  if (scale === 'sqrt') {
    // Signed on purpose. The scale is only offered when no value is negative,
    // so on the data this is the plain square root; the odd extension exists so
    // a diverging ramp's domain, which reaches below zero, still inverts.
    return {
      scale,
      transition: null,
      apply: (value) => (Number.isFinite(value) ? Math.sign(value) * Math.sqrt(Math.abs(value)) : NaN),
      invert: (position) => Math.sign(position) * position * position,
    };
  }
  if (scale === 'symlog') {
    // One smooth formula over the whole line, with no piecewise join: the slope
    // falls off gradually, so there is no magnitude at which the colour ramp
    // kinks. Near zero it is very nearly a straight line; far out it is a
    // logarithm; `transition` is where it turns from one into the other.
    const transition = symlogTransition(values);
    return {
      scale,
      transition,
      apply: (value) => (Number.isFinite(value)
        ? Math.sign(value) * Math.log10(1 + Math.abs(value) / transition) : NaN),
      invert: (position) => Math.sign(position) * (10 ** Math.abs(position) - 1) * transition,
    };
  }
  if (scale === 'percentile') {
    const cohort = options.cohort ?? sortedFinite(values);
    return {
      scale,
      transition: null,
      // The same mid-rank convention the percentile axis uses, so the two
      // controls mean one thing.
      apply: (value) => (Number.isFinite(value) && cohort.length > 0
        ? percentileRank(cohort, value) * 100 : NaN),
      // The cohort's own value at that rank, never an interpolation between two
      // ranks: a rank scale is a step function, and a value halfway between two
      // ranks is a measurement no gene has. `apply` puts `cohort[i]` at rank
      // `(i + 0.5) / n`, so this reads the rank back as an index and rounds to
      // the nearest one, which returns a real measurement and inverts `apply`
      // exactly for every value in the cohort, ties included. A rank outside the
      // cohort's own range — a diverging ramp pads its domain past it — clamps to
      // the nearest end value rather than inventing one.
      invert: (position) => {
        if (cohort.length === 0) return NaN;
        const index = Math.round((position / 100) * cohort.length - 0.5);
        return cohort[Math.min(cohort.length - 1, Math.max(0, index))];
      },
    };
  }
  return IDENTITY_TRANSFORM;
}
