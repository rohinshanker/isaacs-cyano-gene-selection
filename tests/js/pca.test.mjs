import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jacobiEigen, pca } from '../../site/js/core/pca.js';

test('Jacobi recovers known eigenvalues of a symmetric matrix', () => {
  const matrix = Float64Array.from([2, 1, 1, 2]);
  const { values, vectors } = jacobiEigen(matrix, 2);
  assert.equal(values[0].toFixed(6), '3.000000');
  assert.equal(values[1].toFixed(6), '1.000000');
  assert.equal(Math.abs(vectors[0]).toFixed(4), '0.7071');
});

test('PCA of a two-dimensional plane puts all variance in two components', () => {
  const rows = 120;
  const cols = 4;
  const matrix = new Float64Array(rows * cols);
  for (let r = 0; r < rows; r += 1) {
    const a = Math.cos(r / 7);
    const b = Math.sin(r / 5);
    matrix[r * cols] = a;
    matrix[r * cols + 1] = 2 * a;
    matrix[r * cols + 2] = b;
    matrix[r * cols + 3] = -b;
  }
  const result = pca(matrix, rows, cols, 2);
  assert.ok(result.explained[0] + result.explained[1] > 0.999);
  assert.equal(result.scores.length, rows * 2);
  assert.equal(result.loadings.length, 2 * cols);
});

test('component signs are fixed, so the same matrix always plots the same way', () => {
  const rows = 60;
  const cols = 3;
  const matrix = new Float64Array(rows * cols);
  for (let r = 0; r < rows; r += 1) {
    matrix[r * cols] = -r;
    matrix[r * cols + 1] = r * 0.5;
    matrix[r * cols + 2] = Math.sin(r);
  }
  const first = pca(matrix, rows, cols, 2);
  const second = pca(Float64Array.from(matrix), rows, cols, 2);
  assert.deepEqual([...first.loadings], [...second.loadings]);
  let dominant = 0;
  for (let j = 1; j < cols; j += 1) {
    if (Math.abs(first.loadings[j]) > Math.abs(first.loadings[dominant])) dominant = j;
  }
  assert.ok(first.loadings[dominant] > 0);
});

test('a constant column contributes no variance and does not break the decomposition', () => {
  const rows = 30;
  const cols = 2;
  const matrix = new Float64Array(rows * cols);
  for (let r = 0; r < rows; r += 1) {
    matrix[r * cols] = r;
    matrix[r * cols + 1] = 9;
  }
  const result = pca(matrix, rows, cols, 2);
  assert.ok(Number.isFinite(result.scores[0]));
  assert.equal(result.explained[1].toFixed(6), '0.000000');
});

test('asking for more components than columns returns only what exists', () => {
  const result = pca(Float64Array.from([1, 2, 3, 4, 5, 6]), 3, 2, 5);
  assert.equal(result.components, 2);
});
