import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCategoryColorScale, CATEGORICAL, MULTIPLE_FUNCTION_COLOR,
} from '../../site/js/ui/colors.js';

test('reviewed categories and multiple-functions have stable distinct buckets', () => {
  const scale = buildCategoryColorScale(10);
  assert.deepEqual(scale.buckets, [...CATEGORICAL, MULTIPLE_FUNCTION_COLOR]);
  assert.equal(new Set(scale.buckets).size, 11);
  assert.equal(scale.bucketOf(0), 0);
  assert.equal(scale.bucketOf(9), 9);
  assert.equal(scale.bucketOf(10), 10);
  assert.equal(scale.bucketOf(NaN), -1);
  assert.equal(scale.bucketOf(11), -1);
  assert.equal(scale.bucketOf(1.5), -1);
});

test('palette size is validated before any category colour is assigned', () => {
  assert.throws(() => buildCategoryColorScale(0), /category count/);
  assert.throws(() => buildCategoryColorScale(11), /category count/);
});
