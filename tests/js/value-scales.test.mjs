/**
 * The one value-scale module the colour ramp and the Metric X vs Y axes share:
 * which scales a column can take, why a blocked one is blocked, what each
 * transform does, the symmetric-log threshold rule, and the rule that picks a
 * metric's default scale.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AXIS_SCALES, DEFAULT_VALUE_SCALE, SKEWED_DEFAULT_SHARE, VALUE_SCALES, VALUE_SCALE_LABELS,
  defaultValueScale, log10Availability, log10DisabledReason, lowestTenthShare,
  sqrtAvailability, symlogThreshold, valueScaleAvailability, valueScaleClause,
  valueScaleTransform,
} from '../../site/js/core/value-scales.js';

/** A column with `count` values at `low` and one at `high`. */
function skewedColumn(count, low, high) {
  return [...Array.from({ length: count }, () => low), high];
}

test('the five scales the interface offers, and the three an axis offers, are one set', () => {
  assert.deepEqual(VALUE_SCALES, ['linear', 'log10', 'percentile', 'sqrt', 'symlog']);
  assert.deepEqual(AXIS_SCALES, ['linear', 'log10', 'percentile']);
  for (const scale of AXIS_SCALES) {
    assert.ok(VALUE_SCALES.includes(scale), `${scale} must come from the shared set`);
  }
  assert.equal(DEFAULT_VALUE_SCALE, 'linear');
  assert.deepEqual(VALUE_SCALES.map((scale) => VALUE_SCALE_LABELS[scale]), [
    'Linear', 'Logarithmic', 'Percentile', 'Square root', 'Symmetric log',
  ]);
});

test('an accessible description names every scale, linear included', () => {
  assert.deepEqual(VALUE_SCALES.map(valueScaleClause), [
    'on a linear scale', 'on a logarithmic scale', 'on a percentile scale',
    'on a square root scale', 'on a symmetric log scale',
  ]);
  // An unknown scale never produces a silent empty clause.
  assert.equal(valueScaleClause('rainbow'), 'on a linear scale');
});

test('log10 needs strictly positive values and square root needs non-negative ones', () => {
  assert.deepEqual(log10Availability([1, 2, NaN, 3]),
    { available: true, finiteCount: 3, nonPositiveCount: 0 });
  assert.deepEqual(log10Availability([0, 1, -1]),
    { available: false, finiteCount: 3, nonPositiveCount: 2 });
  assert.deepEqual(log10Availability([NaN, NaN]),
    { available: false, finiteCount: 0, nonPositiveCount: 0 });

  // Zero blocks a logarithm and not a square root: that difference is the whole
  // reason both are offered for a count.
  assert.deepEqual(sqrtAvailability([0, 1, 2]),
    { available: true, finiteCount: 3, negativeCount: 0 });
  assert.deepEqual(sqrtAvailability([-1, 0, 2]),
    { available: false, finiteCount: 3, negativeCount: 1 });
});

test('the axis note names log10 in the register the axis title uses', () => {
  assert.equal(log10DisabledReason('GC skew', log10Availability([-1, 0, 1])),
    'log10 is unavailable for GC skew: 2 values are zero or negative.');
  assert.equal(log10DisabledReason('Rare codons', log10Availability([0, 1])),
    'log10 is unavailable for Rare codons: 1 value is zero or negative.');
  assert.equal(log10DisabledReason('CDS length', log10Availability([1, 2])), null);
  assert.equal(log10DisabledReason('Nothing', log10Availability([NaN])),
    'Nothing has no finite values to scale.');
});

test('a blocked scale is listed with a reason, never dropped from the set', () => {
  const availability = valueScaleAvailability([0, 5, 10, NaN], { label: 'Rare codons' });
  assert.deepEqual([...availability.keys()], [...VALUE_SCALES]);
  assert.equal(availability.get('linear').available, true);
  assert.equal(availability.get('linear').reason, null);
  assert.equal(availability.get('percentile').available, true);
  // A zero is exactly where a logarithm stops and a square root still works. No
  // offset is added to rescue the logarithm.
  assert.equal(availability.get('log10').available, false);
  assert.equal(availability.get('log10').reason,
    'Logarithmic is unavailable for Rare codons: 1 value is zero or negative.');
  assert.equal(availability.get('sqrt').available, true);
  assert.equal(availability.get('symlog').available, true);

  const signed = valueScaleAvailability([-3, 0, 4], { label: 'Downstream distance' });
  assert.equal(signed.get('sqrt').available, false);
  assert.equal(signed.get('sqrt').reason,
    'Square root is unavailable for Downstream distance: 1 value is negative.');
  // Symmetric log is defined everywhere, which is why a signed metric has it.
  assert.equal(signed.get('symlog').available, true);
});

test('a ramp centred on zero refuses a logarithm, because a logarithm has no zero', () => {
  const centred = valueScaleAvailability([1, 10, 100], { label: 'Delta', centred: true });
  assert.equal(centred.get('log10').available, false);
  assert.equal(centred.get('log10').reason,
    'Logarithmic is unavailable for Delta: its ramp is centred on zero and a logarithm has '
      + 'no value there.');
  // The same column drawn uncentred can take it.
  assert.equal(valueScaleAvailability([1, 10, 100], { label: 'Delta' }).get('log10').available, true);
  // When the data forbids it too, the concrete fact about the data is named.
  const both = valueScaleAvailability([-1, 0, 1], { label: 'Delta', centred: true });
  assert.equal(both.get('log10').reason,
    'Logarithmic is unavailable for Delta: 2 values are zero or negative.');
});

test('a column with nothing finite in it can take no scale at all', () => {
  const availability = valueScaleAvailability([NaN, NaN], { label: 'Absent metric' });
  for (const scale of VALUE_SCALES) {
    assert.equal(availability.get(scale).available, false, scale);
    assert.equal(availability.get(scale).reason, 'Absent metric has no finite values to scale.');
  }
});

test('the lowest-tenth share is the share a linear ramp would flatten', () => {
  // Ten values at 0 and one at 100: the bottom tenth of [0, 100] holds ten of
  // eleven.
  assert.equal(lowestTenthShare(skewedColumn(10, 0, 100)), 10 / 11);
  // Evenly spread values put one in ten in the lowest tenth.
  assert.equal(lowestTenthShare([0, 25, 50, 75, 100]), 1 / 5);
  // Missing values are not counted in either the numerator or the denominator.
  assert.equal(lowestTenthShare([0, NaN, 100]), 1 / 2);
  // No range means the question does not apply, and is not answered as 100%.
  assert.equal(lowestTenthShare([7, 7, 7]), null);
  assert.equal(lowestTenthShare([NaN]), null);
  assert.equal(lowestTenthShare([]), null);
});

test('the default scale is a rule on the data, with one named threshold', () => {
  assert.equal(SKEWED_DEFAULT_SHARE, 0.9);

  // Strictly positive and heavily skewed: a logarithm is both defined and needed.
  assert.equal(defaultValueScale(skewedColumn(99, 1, 1000)), 'log10');
  // The same skew with a zero in it: a logarithm is undefined, so symmetric log.
  assert.equal(defaultValueScale(skewedColumn(99, 0, 1000)), 'symlog');
  // And with a negative value in it.
  assert.equal(defaultValueScale([...skewedColumn(99, 1, 1000), -5]), 'symlog');
  // Not skewed enough: linear, whatever the magnitudes are.
  assert.equal(defaultValueScale([0, 25, 50, 75, 100]), 'linear');
  // A flat or empty column has no skew to correct.
  assert.equal(defaultValueScale([7, 7, 7]), 'linear');
  assert.equal(defaultValueScale([NaN, NaN]), 'linear');

  // The threshold is the line, and the rule reads it rather than a list: 90 of
  // 100 in the lowest tenth defaults logarithmic and 89 of 100 does not.
  const atThreshold = [...Array.from({ length: 90 }, () => 1),
    ...Array.from({ length: 9 }, () => 500), 1000];
  const belowThreshold = [...Array.from({ length: 89 }, () => 1),
    ...Array.from({ length: 10 }, () => 500), 1000];
  assert.ok(lowestTenthShare(atThreshold) >= SKEWED_DEFAULT_SHARE);
  assert.ok(lowestTenthShare(belowThreshold) < SKEWED_DEFAULT_SHARE);
  assert.equal(defaultValueScale(atThreshold), 'log10');
  assert.equal(defaultValueScale(belowThreshold), 'linear');

  // A centred ramp cannot take a logarithm, so a skewed one opens symmetric log.
  assert.equal(defaultValueScale(skewedColumn(99, 1, 1000), { centred: true }), 'symlog');
});

test('the symmetric-log threshold is the median non-zero magnitude, floored to a decade', () => {
  // Median |value| is 53, whose decade is 10.
  assert.equal(symlogThreshold([-116, 0, 21, 53, 85, 6375]), 10);
  // Median 0.4 floors to 0.1, so the rule holds below 1 as well.
  assert.equal(symlogThreshold([0.2, 0.4, 0.9]), 0.1);
  // Zeros are excluded from the median: they say nothing about a magnitude.
  assert.equal(symlogThreshold([0, 0, 0, 0, 4000]), 1000);
  // A column with no non-zero value has no median to take.
  assert.equal(symlogThreshold([0, 0, NaN]), 1);
  assert.equal(symlogThreshold([NaN]), 1);
  // Deterministic: the same column always gives the same threshold, and it only
  // moves when the median crosses a decade.
  assert.equal(symlogThreshold([9, 9, 9]), 1);
  assert.equal(symlogThreshold([10, 10, 10]), 10);
});

test('every transform sends a missing value to NaN and inverts its own positions', () => {
  const columns = {
    linear: [-4, 0, 9],
    log10: [1, 10, 1000],
    sqrt: [0, 4, 81],
    symlog: [-6375, 0, 53, 6375],
    percentile: [1, 2, 3, 4],
  };
  for (const [scale, values] of Object.entries(columns)) {
    const transform = valueScaleTransform(scale, values);
    assert.equal(transform.scale, scale);
    assert.ok(Number.isNaN(transform.apply(NaN)), `${scale} keeps a missing value missing`);
    assert.ok(Number.isNaN(transform.apply(Infinity)), `${scale} refuses an infinity`);
    // Monotone increasing, which is what makes a ramp position readable at all.
    const applied = values.map(transform.apply);
    for (let i = 1; i < applied.length; i += 1) {
      assert.ok(applied[i] > applied[i - 1], `${scale} is increasing at ${values[i]}`);
    }
    if (scale === 'percentile') continue;
    for (const value of values) {
      assert.ok(Math.abs(transform.invert(transform.apply(value)) - value) < 1e-9,
        `${scale} inverts ${value}`);
    }
  }
});

test('the signed transforms send zero to zero, so a diverging ramp keeps its centre', () => {
  for (const scale of ['linear', 'sqrt', 'symlog']) {
    const transform = valueScaleTransform(scale, [-9, 0, 9]);
    assert.equal(transform.apply(0), 0, scale);
    assert.equal(transform.apply(-9), -transform.apply(9), `${scale} is odd`);
  }
  // log10 is neither, which is why it is refused for a centred ramp.
  assert.ok(Number.isNaN(valueScaleTransform('log10', [1, 9]).apply(0)));
});

test('log10 and square root are the transforms their names claim', () => {
  assert.equal(valueScaleTransform('log10', [1, 1000]).apply(1000), 3);
  assert.equal(valueScaleTransform('sqrt', [0, 81]).apply(81), 9);
  // No offset is added to make a logarithm work on a zero: it stays undefined.
  assert.ok(Number.isNaN(valueScaleTransform('log10', [0, 1]).apply(0)));
});

test('symmetric log is linear inside its threshold and logarithmic outside it', () => {
  // Magnitudes 5, 12, 53, 116, 6375: median 53, whose decade is 10.
  const values = [-116, 0, 5, 12, 53, 6375];
  const transform = valueScaleTransform('symlog', values);
  assert.equal(transform.threshold, 10);
  // A decade above the threshold is one unit further along, as a logarithm is.
  const at = transform.apply(transform.threshold * (10 ** 1 - 1));
  const tenfold = transform.apply(transform.threshold * (10 ** 2 - 1));
  assert.ok(Math.abs(tenfold - at - 1) < 1e-12);
  // Well inside the threshold the transform is very nearly a straight line.
  const small = transform.apply(0.5) / 0.5;
  const smaller = transform.apply(0.25) / 0.25;
  assert.ok(Math.abs(small - smaller) < 1e-3, 'near zero the slope is constant');
});

test('percentile ranks against the cohort it is given, so an axis can rank a filtered view', () => {
  const values = [10, 20, 30, 40];
  const whole = valueScaleTransform('percentile', values);
  assert.equal(whole.apply(10), 12.5);
  assert.equal(whole.apply(40), 87.5);
  // Ranked against only the top half, the same value reads differently.
  const half = valueScaleTransform('percentile', values, { cohort: [30, 40] });
  assert.equal(half.apply(30), 25);
  assert.equal(half.apply(40), 75);
  // An empty cohort has nothing to rank against, and says so with NaN rather
  // than inventing a rank.
  const empty = valueScaleTransform('percentile', values, { cohort: [] });
  assert.ok(Number.isNaN(empty.apply(20)));
  assert.ok(Number.isNaN(empty.invert(50)));
  // Inverting a rank reads the cohort's own value at it, in the metric's units.
  assert.equal(whole.invert(50), 25);
  assert.equal(whole.invert(0), 10);
  assert.equal(whole.invert(100), 40);
});

test('an unrecognised scale is the identity, never a thrown error mid-render', () => {
  const transform = valueScaleTransform('rainbow', [1, 2, 3]);
  assert.equal(transform.scale, 'linear');
  assert.equal(transform.apply(2), 2);
  assert.equal(transform.invert(2), 2);
  assert.equal(transform.threshold, null);
});
