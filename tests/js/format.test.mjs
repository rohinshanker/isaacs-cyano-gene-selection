import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatValue, formatDelta, formatExpressionSource, formatPercentile, formatCount,
  formatSpan, csvField, MISSING, ordinalSuffix,
} from '../../site/js/ui/format.js';

test('a missing value renders as an em-space, never as zero', () => {
  assert.equal(MISSING, ' ');
  for (const value of [null, undefined, NaN, Infinity]) {
    assert.equal(formatValue({ integer: false }, value), MISSING);
  }
  assert.equal(formatValue({ integer: false }, 0), '0');
});

test('precision follows the size of the number', () => {
  const metric = { integer: false };
  assert.equal(formatValue(metric, 0.6483), '0.648');
  assert.equal(formatValue(metric, 4.21), '4.21');
  assert.equal(formatValue(metric, 48.23), '48.2');
  assert.equal(formatValue(metric, 2744626), '2,744,626');
  assert.equal(formatValue(metric, 0.00004), '4.0e-5');
  assert.equal(formatValue({ integer: true }, 1234.6), '1,235');
});

test('deltas carry an explicit sign', () => {
  const metric = { integer: false };
  assert.equal(formatDelta(metric, 0.25), '+0.250');
  assert.equal(formatDelta(metric, -0.25), '−0.250');
  assert.equal(formatDelta(metric, 0), '0');
  assert.equal(formatDelta(metric, NaN), MISSING);
});

test('percentiles read as plain rank language', () => {
  assert.equal(formatPercentile(0.78), '78th pct');
  // A rank reads as English: 1st, 2nd, 3rd, and the eleven-to-thirteen exceptions.
  assert.equal(formatPercentile(0.01), '1st pct');
  assert.equal(formatPercentile(0.02), '2nd pct');
  assert.equal(formatPercentile(0.03), '3rd pct');
  assert.equal(formatPercentile(0.04), '4th pct');
  assert.equal(formatPercentile(0.11), '11th pct');
  assert.equal(formatPercentile(0.12), '12th pct');
  assert.equal(formatPercentile(0.13), '13th pct');
  assert.equal(formatPercentile(0.21), '21st pct');
  assert.equal(formatPercentile(0.22), '22nd pct');
  assert.equal(formatPercentile(0.23), '23rd pct');
  assert.equal(formatPercentile(0.999), 'top 1%');
  assert.equal(formatPercentile(0.001), 'bottom 1%');
  assert.equal(formatPercentile(NaN), MISSING);
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 101, 111].map(ordinalSuffix),
    ['st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'st', 'th']);
});

test('counts, spans, and CSV fields are shaped for reading and for machines', () => {
  assert.equal(formatCount(2711), '2,711');
  assert.equal(formatSpan(812345, 813100, '+'), '812,345–813,100 (+)');
  assert.equal(csvField('plain'), 'plain');
  assert.equal(csvField('with,comma'), '"with,comma"');
  assert.equal(csvField('say "hi"'), '"say ""hi"""');
  assert.equal(csvField(null), '');
  assert.equal(csvField(undefined), '');
});

test('expression provenance formats coverage counts for the interface', () => {
  const source = {
    organism: 'Synechococcus elongatus PCC 7942',
    isTargetOrganism: false,
    coverage: { withValue: 2551, total: 2715 },
  };
  assert.match(formatExpressionSource(source), /2,551 of 2,715 genes carry a value/);
});
