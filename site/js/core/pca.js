/**
 * Principal component analysis for the live map panels.
 *
 * The matrices here are about 2,700 rows by at most 20 columns, so a covariance
 * matrix plus a cyclic Jacobi eigendecomposition is both exact enough and far
 * faster than any iterative alternative.
 */
import { standardizeColumns } from './stats.js';

/**
 * Eigendecomposition of a symmetric matrix by the cyclic Jacobi method.
 * @param {Float64Array} symmetric row-major n by n, not modified.
 * @param {number} n
 * @returns {{values: Float64Array, vectors: Float64Array}} vectors row-major,
 *   row `k` is the eigenvector for `values[k]`, sorted by descending value.
 */
export function jacobiEigen(symmetric, n) {
  const a = Float64Array.from(symmetric);
  const v = new Float64Array(n * n);
  for (let i = 0; i < n; i += 1) v[i * n + i] = 1;

  for (let sweep = 0; sweep < 100; sweep += 1) {
    let offDiagonal = 0;
    for (let p = 0; p < n - 1; p += 1) {
      for (let q = p + 1; q < n; q += 1) offDiagonal += a[p * n + q] * a[p * n + q];
    }
    if (offDiagonal <= 1e-22) break;

    for (let p = 0; p < n - 1; p += 1) {
      for (let q = p + 1; q < n; q += 1) {
        const apq = a[p * n + q];
        if (Math.abs(apq) < 1e-18) continue;
        const theta = (a[q * n + q] - a[p * n + p]) / (2 * apq);
        const t =
          Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k += 1) {
          const akp = a[k * n + p];
          const akq = a[k * n + q];
          a[k * n + p] = c * akp - s * akq;
          a[k * n + q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k += 1) {
          const apk = a[p * n + k];
          const aqk = a[q * n + k];
          a[p * n + k] = c * apk - s * aqk;
          a[q * n + k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k += 1) {
          const vkp = v[k * n + p];
          const vkq = v[k * n + q];
          v[k * n + p] = c * vkp - s * vkq;
          v[k * n + q] = s * vkp + c * vkq;
        }
      }
    }
  }

  const order = Array.from({ length: n }, (_, i) => i).sort(
    (i, j) => a[j * n + j] - a[i * n + i],
  );
  const values = new Float64Array(n);
  const vectors = new Float64Array(n * n);
  order.forEach((source, target) => {
    values[target] = a[source * n + source];
    for (let k = 0; k < n; k += 1) vectors[target * n + k] = v[k * n + source];
  });
  return { values, vectors };
}

/**
 * PCA on a row-major matrix, standardizing columns first.
 *
 * @param {Float64Array} matrix row-major `rows` by `cols`.
 * @param {number} rows
 * @param {number} cols
 * @param {number} components number of components to return.
 * @returns {{scores: Float64Array, loadings: Float64Array, explained: Float64Array,
 *   components: number, rows: number, cols: number}}
 *   `scores` is row-major rows by components; `loadings` is row-major
 *   components by cols; `explained` is the fraction of total variance per component.
 */
export function pca(matrix, rows, cols, components = 2) {
  const k = Math.min(components, cols);
  const { matrix: z } = standardizeColumns(matrix, rows, cols);

  const covariance = new Float64Array(cols * cols);
  for (let i = 0; i < cols; i += 1) {
    for (let j = i; j < cols; j += 1) {
      let sum = 0;
      for (let r = 0; r < rows; r += 1) sum += z[r * cols + i] * z[r * cols + j];
      const value = rows > 1 ? sum / (rows - 1) : 0;
      covariance[i * cols + j] = value;
      covariance[j * cols + i] = value;
    }
  }

  const { values, vectors } = jacobiEigen(covariance, cols);
  let total = 0;
  for (let i = 0; i < cols; i += 1) total += Math.max(0, values[i]);

  const loadings = new Float64Array(k * cols);
  for (let c = 0; c < k; c += 1) {
    // Sign is arbitrary in PCA; fix it so a given matrix always plots the same way.
    let dominant = 0;
    for (let j = 1; j < cols; j += 1) {
      if (Math.abs(vectors[c * cols + j]) > Math.abs(vectors[c * cols + dominant])) dominant = j;
    }
    const flip = vectors[c * cols + dominant] < 0 ? -1 : 1;
    for (let j = 0; j < cols; j += 1) loadings[c * cols + j] = vectors[c * cols + j] * flip;
  }

  const scores = new Float64Array(rows * k);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < k; c += 1) {
      let sum = 0;
      for (let j = 0; j < cols; j += 1) sum += z[r * cols + j] * loadings[c * cols + j];
      scores[r * k + c] = sum;
    }
  }

  const explained = new Float64Array(k);
  for (let c = 0; c < k; c += 1) {
    explained[c] = total > 0 ? Math.max(0, values[c]) / total : 0;
  }
  return { scores, loadings, explained, components: k, rows, cols };
}
