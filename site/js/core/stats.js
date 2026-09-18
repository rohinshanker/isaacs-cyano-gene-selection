/** Small numeric helpers shared by metrics, filters, and plots. */

/** Arithmetic mean of the finite values in `values`; NaN when there are none. */
export function mean(values) {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (Number.isFinite(v)) {
      sum += v;
      n += 1;
    }
  }
  return n === 0 ? NaN : sum / n;
}

/** Population standard deviation over finite values; NaN when fewer than two. */
export function stdev(values) {
  const mu = mean(values);
  if (!Number.isFinite(mu)) return NaN;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (Number.isFinite(v)) {
      sum += (v - mu) * (v - mu);
      n += 1;
    }
  }
  return n < 2 ? NaN : Math.sqrt(sum / n);
}

/** Finite values only, ascending. */
export function sortedFinite(values) {
  const out = [];
  for (let i = 0; i < values.length; i += 1) {
    if (Number.isFinite(values[i])) out.push(values[i]);
  }
  out.sort((a, b) => a - b);
  return Float64Array.from(out);
}

/** Linear-interpolated quantile of an ascending array. `q` in [0, 1]. */
export function quantileSorted(sorted, q) {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * Math.min(1, Math.max(0, q));
  const low = Math.floor(position);
  const high = Math.ceil(position);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}

/** Median of an ascending array. */
export function medianSorted(sorted) {
  return quantileSorted(sorted, 0.5);
}

/**
 * Percentile rank of `value` within an ascending array, as a fraction in [0, 1].
 * Ties count as half, the usual mid-rank convention, so identical values on both
 * sides of the distribution do not report 0 % and 100 %.
 */
export function percentileRank(sorted, value) {
  if (!Number.isFinite(value) || sorted.length === 0) return NaN;
  let below = 0;
  let equal = 0;
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (sorted[mid] < value) low = mid + 1;
    else high = mid;
  }
  below = low;
  while (below + equal < sorted.length && sorted[below + equal] === value) equal += 1;
  return (below + equal / 2) / sorted.length;
}

/**
 * Column-standardize a row-major matrix in place-safe fashion.
 * Columns with zero or non-finite spread become all-zero, which keeps them from
 * dominating or breaking a covariance matrix.
 * @returns {{matrix: Float64Array, means: Float64Array, sds: Float64Array}}
 */
export function standardizeColumns(matrix, rows, cols) {
  const means = new Float64Array(cols);
  const sds = new Float64Array(cols);
  const out = new Float64Array(rows * cols);
  const column = new Float64Array(rows);
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) column[r] = matrix[r * cols + c];
    const mu = mean(column);
    const sd = stdev(column);
    means[c] = Number.isFinite(mu) ? mu : 0;
    sds[c] = Number.isFinite(sd) && sd > 1e-12 ? sd : 0;
    for (let r = 0; r < rows; r += 1) {
      const v = column[r];
      out[r * cols + c] = sds[c] === 0 || !Number.isFinite(v) ? 0 : (v - means[c]) / sds[c];
    }
  }
  return { matrix: out, means, sds };
}

/** Geometric mean of strictly positive values; NaN when none qualify. */
export function geometricMean(values) {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (Number.isFinite(v) && v > 0) {
      sum += Math.log(v);
      n += 1;
    }
  }
  return n === 0 ? NaN : Math.exp(sum / n);
}
