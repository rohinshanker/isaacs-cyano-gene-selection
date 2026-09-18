/**
 * Codon-usage metrics computed from 64-bin codon count vectors.
 *
 * Everything here is pure and reference-table driven so the same code computes
 * wild-type and recoded values, which is what makes a delta meaningful.
 */
import { geometricMean } from './stats.js';

/** Fraction of codons whose third base is G or C. */
export function gc3FromCounts(counts, table) {
  let gc = 0;
  let total = 0;
  for (let i = 0; i < 64; i += 1) {
    const n = counts[i];
    if (n === 0) continue;
    total += n;
    if (table.isGc3[i]) gc += n;
  }
  return total === 0 ? NaN : gc / total;
}

/**
 * Wright's effective number of codons (Nc).
 *
 * A missing three-fold class takes the mean of the two- and four-fold classes,
 * as Wright prescribed. Any other class that a short gene leaves unestimable is
 * dropped and the remaining classes are rescaled to carry its weight, which is
 * better than discarding the gene. Nc is clamped to its theoretical [20, 61].
 */
export function encFromCounts(counts, table) {
  const classSums = new Map([[2, []], [3, []], [4, []], [6, []]]);
  for (const [aa, indices] of table.family) {
    if (aa === '*' || indices.length < 2) continue;
    let n = 0;
    for (const index of indices) n += counts[index];
    if (n < 2) continue;
    let sumSquares = 0;
    for (const index of indices) {
      const p = counts[index] / n;
      sumSquares += p * p;
    }
    const f = (n * sumSquares - 1) / (n - 1);
    if (!Number.isFinite(f) || f <= 0) continue;
    const bucket = classSums.get(indices.length);
    if (bucket) bucket.push(f);
  }
  const average = (size) => {
    const bucket = classSums.get(size);
    if (!bucket || bucket.length === 0) return NaN;
    return bucket.reduce((a, b) => a + b, 0) / bucket.length;
  };
  const f2 = average(2);
  const f4 = average(4);
  const f6 = average(6);
  let f3 = average(3);
  if (!Number.isFinite(f3)) f3 = (f2 + f4) / 2;

  const classes = [[9, f2], [1, f3], [5, f4], [3, f6]];
  let weightTotal = 0;
  let weightUsed = 0;
  let sum = 0;
  for (const [weight, f] of classes) {
    weightTotal += weight;
    if (!Number.isFinite(f) || f <= 0) continue;
    weightUsed += weight;
    sum += weight / f;
  }
  if (weightUsed === 0) return NaN;
  const nc = 2 + (sum * weightTotal) / weightUsed;
  if (!Number.isFinite(nc)) return NaN;
  return Math.min(61, Math.max(20, nc));
}

/** Wright's expected Nc for a given GC3, the neutral-drift reference curve. */
export function encExpected(gc3) {
  if (!Number.isFinite(gc3)) return NaN;
  const s = gc3;
  return 2 + s + 29 / (s * s + (1 - s) * (1 - s));
}

/**
 * Relative adaptiveness weights for CAI from a reference set's codon counts.
 * Zero-count codons take the Sharp and Li half-count adjustment rather than
 * zero, so one absent codon cannot drive a whole gene's CAI to zero.
 */
export function buildCaiWeights(referenceCounts, table) {
  const weights = new Float64Array(64);
  for (const [aa, indices] of table.family) {
    if (aa === '*' || indices.length < 2) continue;
    let max = 0;
    for (const index of indices) max = Math.max(max, referenceCounts[index]);
    if (max <= 0) continue;
    for (const index of indices) {
      const count = referenceCounts[index] > 0 ? referenceCounts[index] : 0.5;
      weights[index] = count / max;
    }
  }
  return weights;
}

/** CAI as the geometric mean of weights over codons that have one. */
export function caiFromCounts(counts, weights) {
  let logSum = 0;
  let n = 0;
  for (let i = 0; i < 64; i += 1) {
    const count = counts[i];
    if (count === 0 || weights[i] <= 0) continue;
    logSum += count * Math.log(weights[i]);
    n += count;
  }
  return n === 0 ? NaN : Math.exp(logSum / n);
}

/** Reverse complement of a DNA triplet. */
export function reverseComplement(seq) {
  const complement = { A: 'T', C: 'G', G: 'C', T: 'A' };
  let out = '';
  for (let i = seq.length - 1; i >= 0; i -= 1) out += complement[seq[i]];
  return out;
}

/**
 * Selective-constraint values for the nine codon-anticodon pairings, in the
 * order used by dos Reis et al. (2004). Defaults are that paper's fitted values.
 */
export const DEFAULT_TAI_S = Object.freeze({
  UA: 0, CG: 0, AU: 0, GC: 0, GU: 0.41, IC: 0.28, IA: 0.9999, UG: 0.68, LA: 0.89,
});

const S_KEY_ORDER = ['UA', 'CG', 'AU', 'GC', 'GU', 'IC', 'IA', 'UG', 'LA'];

/** Normalize a user-supplied s-value key such as `"G:T"` or `"g_u"` to `"GU"`. */
function normalizeSKey(key) {
  return key.replace(/[^A-Za-z]/g, '').toUpperCase().replace(/T/g, 'U');
}

/**
 * Resolve `meta.tai.sValues` against the published defaults.
 * @returns {{s: Float64Array, supplied: string[], defaulted: string[]}}
 */
export function resolveTaiS(sValues) {
  const supplied = [];
  const defaulted = [];
  const byKey = new Map();
  for (const [key, value] of Object.entries(sValues ?? {})) {
    if (Number.isFinite(value)) byKey.set(normalizeSKey(key), value);
  }
  const s = new Float64Array(9);
  S_KEY_ORDER.forEach((key, i) => {
    if (byKey.has(key)) {
      s[i] = byKey.get(key);
      supplied.push(key);
    } else {
      s[i] = DEFAULT_TAI_S[key];
      defaulted.push(key);
    }
  });
  return { s, supplied, defaulted };
}

/**
 * tRNA adaptation index weights from anticodon gene copy numbers.
 *
 * `tRNAGeneCopies` is keyed by anticodon, so the gene copy number available to a
 * codon is that of its Watson-Crick anticodon. Isoleucine ATA is decoded by a
 * lysidine-modified CAU anticodon that is indistinguishable by anticodon string
 * from initiator and elongator methionine tRNA; ATA therefore falls to the
 * zero-weight substitution below, and `report.ataResolved` records that.
 *
 * @returns {{weights: Float64Array, report: object}}
 */
export function buildTaiWeights(tRNAGeneCopies, sValues, table) {
  const { s, supplied, defaulted } = resolveTaiS(sValues);
  const p = Float64Array.from(s, (value) => 1 - value);
  const copies = new Float64Array(64);
  for (let i = 0; i < 64; i += 1) {
    const anticodon = reverseComplement(table.codons[i]);
    const value = tRNAGeneCopies?.[anticodon];
    copies[i] = Number.isFinite(value) ? value : 0;
  }

  const standardIndex = new Map(table.codons.map((codon, i) => [codon, i]));
  const at = (codon) => standardIndex.get(codon);
  const W = new Float64Array(64);
  const BASES = 'TCAG';
  for (const first of BASES) {
    for (const second of BASES) {
      const t = BASES.split('').map((third) => copies[at(first + second + third)]);
      const [iT, iC, iA, iG] = BASES.split('').map((third) => at(first + second + third));
      W[iT] = p[0] * t[0] + p[4] * t[1];
      W[iC] = p[1] * t[1] + p[5] * t[0];
      W[iA] = p[2] * t[2] + p[6] * t[0];
      W[iG] = p[3] * t[3] + p[7] * t[2];
    }
  }
  // Methionine is read only by its own tRNA; strip the isoleucine wobble term.
  W[at('ATG')] = p[3] * copies[at('ATG')];
  for (let i = 0; i < 64; i += 1) {
    if (table.isStop[i]) W[i] = 0;
  }

  let max = 0;
  for (let i = 0; i < 64; i += 1) max = Math.max(max, W[i]);
  const weights = new Float64Array(64);
  if (max > 0) {
    for (let i = 0; i < 64; i += 1) weights[i] = W[i] / max;
  }
  const nonZero = [];
  for (let i = 0; i < 64; i += 1) {
    if (!table.isStop[i] && weights[i] > 0) nonZero.push(weights[i]);
  }
  const substitute = nonZero.length > 0 ? geometricMean(nonZero) : 0;
  const zeroCodons = [];
  for (let i = 0; i < 64; i += 1) {
    if (!table.isStop[i] && weights[i] === 0) {
      weights[i] = substitute;
      zeroCodons.push(table.codons[i]);
    }
  }
  return {
    weights,
    report: {
      sSupplied: supplied,
      sDefaulted: defaulted,
      zeroWeightCodons: zeroCodons,
      zeroWeightSubstitute: substitute,
      ataResolved: copies[at('ATA')] > 0,
      anticodonsWithCopies: Object.keys(tRNAGeneCopies ?? {}).length,
    },
  };
}

/** tAI as the geometric mean of tRNA weights over a gene's sense codons. */
export function taiFromCounts(counts, weights, table) {
  let logSum = 0;
  let n = 0;
  for (let i = 0; i < 64; i += 1) {
    const count = counts[i];
    if (count === 0 || table.isStop[i] || weights[i] <= 0) continue;
    logSum += count * Math.log(weights[i]);
    n += count;
  }
  return n === 0 ? NaN : Math.exp(logSum / n);
}

/**
 * Codon-pair scores from genome-wide wild-type counts.
 *
 * CPS(AB) = ln( N(AB) / ( N(A)N(B)/(N(X)N(Y)) * N(XY) ) ) for codons A, B
 * encoding amino acids X, Y. Counts are Laplace-smoothed so an unobserved pair
 * scores very negative rather than infinitely so.
 *
 * @returns {Float64Array} 4096 entries, index `a * 64 + b`.
 */
export function buildCodonPairScores(pairCounts, codonCounts, table) {
  const aaIndex = new Map();
  const aas = [...table.family.keys()];
  aas.forEach((aa, i) => aaIndex.set(aa, i));
  const aaCount = new Float64Array(aas.length);
  const aaPairCount = new Float64Array(aas.length * aas.length);
  for (let a = 0; a < 64; a += 1) {
    aaCount[aaIndex.get(table.aas[a])] += codonCounts[a];
    for (let b = 0; b < 64; b += 1) {
      const n = pairCounts[a * 64 + b];
      if (n === 0) continue;
      aaPairCount[aaIndex.get(table.aas[a]) * aas.length + aaIndex.get(table.aas[b])] += n;
    }
  }
  const scores = new Float64Array(4096);
  for (let a = 0; a < 64; a += 1) {
    const x = aaIndex.get(table.aas[a]);
    for (let b = 0; b < 64; b += 1) {
      const y = aaIndex.get(table.aas[b]);
      const observed = pairCounts[a * 64 + b] + 1;
      const expected =
        ((codonCounts[a] + 1) * (codonCounts[b] + 1)) /
        ((aaCount[x] + 1) * (aaCount[y] + 1)) *
        (aaPairCount[x * aas.length + y] + 1);
      scores[a * 64 + b] = expected > 0 ? Math.log(observed / expected) : 0;
    }
  }
  return scores;
}
