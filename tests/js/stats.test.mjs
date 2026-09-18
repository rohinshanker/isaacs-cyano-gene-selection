import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mean, stdev, sortedFinite, quantileSorted, medianSorted, percentileRank,
  standardizeColumns, geometricMean,
} from '../../site/js/core/stats.js';

test('mean and standard deviation skip non-finite values', () => {
  assert.equal(mean([1, 2, 3, NaN]), 2);
  assert.ok(Number.isNaN(mean([NaN, NaN])));
  assert.equal(stdev([2, 4, 4, 4, 5, 5, 7, 9]).toFixed(4), '2.0000');
  assert.ok(Number.isNaN(stdev([5])));
  assert.ok(Number.isNaN(stdev([NaN])));
});

test('quantiles interpolate and handle degenerate input', () => {
  const sorted = sortedFinite([4, 1, NaN, 3, 2]);
  assert.deepEqual([...sorted], [1, 2, 3, 4]);
  assert.equal(quantileSorted(sorted, 0), 1);
  assert.equal(quantileSorted(sorted, 1), 4);
  assert.equal(quantileSorted(sorted, 0.5), 2.5);
  assert.equal(medianSorted(sorted), 2.5);
  assert.ok(Number.isNaN(quantileSorted(sortedFinite([]), 0.5)));
  assert.equal(quantileSorted(Float64Array.from([7]), 0.9), 7);
  assert.equal(quantileSorted(sorted, 2), 4);
});

test('percentile rank uses the mid-rank convention for ties', () => {
  const sorted = sortedFinite([1, 2, 2, 2, 3]);
  assert.equal(percentileRank(sorted, 1), 0.1);
  assert.equal(percentileRank(sorted, 2), 0.5);
  assert.equal(percentileRank(sorted, 3), 0.9);
  assert.ok(Number.isNaN(percentileRank(sorted, NaN)));
  assert.ok(Number.isNaN(percentileRank(sortedFinite([]), 1)));
});

test('standardizing zeroes a constant column instead of dividing by zero', () => {
  const matrix = Float64Array.from([1, 5, 2, 5, 3, 5]);
  const { matrix: z, means, sds } = standardizeColumns(matrix, 3, 2);
  assert.equal(means[0], 2);
  assert.equal(sds[1], 0);
  assert.equal(z[1], 0);
  assert.equal(z[3], 0);
  assert.ok(Math.abs(z[0] + 1.2247) < 1e-3);
});

test('geometric mean ignores zero and negative values', () => {
  assert.equal(geometricMean([1, 4]), 2);
  assert.equal(geometricMean([1, 4, 0, -3]), 2);
  assert.ok(Number.isNaN(geometricMean([0])));
});
