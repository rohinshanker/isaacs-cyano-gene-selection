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
 * A synonymous family observed fewer than twice has no unbiased homozygosity
 * estimate. It is omitted from its degeneracy class's mean rather than assumed
 * maximally biased, which would drag a short gene's Nc down for want of data. A
 * degeneracy class with no estimable family falls back to its neutral
 * expectation F = 1/k. Each F is floored at 1/k, since a family cannot be more
 * even than uniform. This is `meta.encFamilyConvention`; the pipeline computes
 * Nc the same way and the two must agree.
 *
 * @param {ArrayLike<number>} counts 64-bin codon counts, initiator convention
 *   already applied.
 * @param {import('./codon-table.js').CodonTable} table
 * @param {{hasSubstitutedFamilies?: boolean}|null} report filled in when given,
 *   so a caller can compare against the pipeline's per-gene flag without a
 *   second pass.
 */
export function encFromCounts(counts, table, report = null) {
  let counted = 0;
  for (let i = 0; i < 64; i += 1) if (!table.isStop[i]) counted += counts[i];
  if (counted === 0) {
    if (report) report.hasSubstitutedFamilies = false;
    return NaN;
  }

  // Non-degenerate amino acids contribute exactly one effective codon each.
  let nc = 0;
  const byDegeneracy = new Map();
  for (const [aa, indices] of table.family) {
    if (aa === '*') continue;
    const degeneracy = indices.length;
    if (degeneracy < 2) {
      nc += 1;
      continue;
    }
    let entry = byDegeneracy.get(degeneracy);
    if (!entry) {
      entry = { families: 0, estimable: 0, sum: 0 };
      byDegeneracy.set(degeneracy, entry);
    }
    entry.families += 1;

    let n = 0;
    for (const index of indices) n += counts[index];
    if (n < 2) continue;
    let sumSquares = 0;
    for (const index of indices) {
      const p = counts[index] / n;
      sumSquares += p * p;
    }
    entry.estimable += 1;
    entry.sum += Math.max((n * sumSquares - 1) / (n - 1), 1 / degeneracy);
  }

  let substituted = false;
  for (const [degeneracy, entry] of byDegeneracy) {
    if (entry.estimable !== entry.families) substituted = true;
    const meanF = entry.estimable > 0 ? entry.sum / entry.estimable : 1 / degeneracy;
    nc += entry.families / meanF;
  }
  if (report) report.hasSubstitutedFamilies = substituted;
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
 *
 * Within each synonymous family, a codon's weight is its reference count over
 * the family's largest. A codon absent from the reference set takes the Sharp
 * and Li half count instead of zero, so one missing codon cannot drive a whole
 * gene's CAI to zero. A family absent from the reference set entirely therefore
 * has every member on the same adjusted count, giving weight 1 throughout: no
 * evidence means no penalty. Non-degenerate families get weight 1 for the same
 * reason and are excluded from the gene mean by {@link caiFromCounts}.
 *
 * @param {ArrayLike<number>} referenceCounts 64-bin counts over the reference set.
 * @param {import('./codon-table.js').CodonTable} table
 * @param {number} zeroCountAdjustment from `meta.caiReferenceSet.zeroCountAdjustment`.
 */
export function buildCaiWeights(referenceCounts, table, zeroCountAdjustment) {
  if (!Number.isFinite(zeroCountAdjustment) || zeroCountAdjustment <= 0) {
    throw new Error(`CAI zero-count adjustment must be positive, got ${zeroCountAdjustment}`);
  }
  const weights = new Float64Array(64);
  for (const [aa, indices] of table.family) {
    if (aa === '*') continue;
    let max = 0;
    for (const index of indices) {
      const count = referenceCounts[index];
      const adjusted = count > 0 ? count : zeroCountAdjustment;
      if (adjusted > max) max = adjusted;
    }
    if (max <= 0) continue;
    for (const index of indices) {
      const count = referenceCounts[index];
      weights[index] = (count > 0 ? count : zeroCountAdjustment) / max;
    }
  }
  return weights;
}

/**
 * CAI as the geometric mean of relative adaptiveness over a gene's codons.
 *
 * @param {ArrayLike<number>} counts 64-bin codon counts, initiator convention
 *   already applied.
 * @param {ArrayLike<number>} weights from {@link buildCaiWeights}.
 * @param {ArrayLike<number>|null} excludedMask 1 for codons the convention
 *   leaves out, from `conventions.cai.excludedMask`.
 */
export function caiFromCounts(counts, weights, excludedMask = null) {
  let logSum = 0;
  let n = 0;
  for (let i = 0; i < 64; i += 1) {
    const count = counts[i];
    if (count === 0) continue;
    if (excludedMask && excludedMask[i]) continue;
    if (!(weights[i] > 0)) continue;
    logSum += count * Math.log(weights[i]);
    n += count;
  }
  return n === 0 ? NaN : Math.exp(logSum / n);
}

/**
 * tRNA adaptation index weights from anticodon gene copy numbers.
 *
 * Absolute adaptiveness for a codon is the copy number of every tRNA that can
 * read it: full copies for a Watson-Crick wobble pairing, and `copies * (1 - s)`
 * for a constrained one. Anticodons are written 5' to 3', so the anticodon's
 * third and second bases must complement the codon's first and second exactly
 * before any pairing is possible.
 *
 * Anticodon keys are taken as published, never derived by reverse-complementing
 * a codon. That matters because a modified wobble base is not a DNA base:
 * `meta.tai.tRNAGeneCopies` writes the inosine-modified arginine tRNA as `ICG`
 * and the lysidine-modified isoleucine tRNA as `LAT`, and those are precisely
 * the species that decode CGN and ATA. Reverse-complementing would look for
 * `ACG` and `TAT`, find nothing, and silently leave five codons unweighted.
 * `meta.tai.sValues` keys its constraints by the same letters, so the modified
 * bases need no special case here.
 *
 * @param {Record<string, number>} tRNAGeneCopies from `meta.tai.tRNAGeneCopies`.
 * @param {Record<string, number>} sValues resolved constraints, keyed
 *   `anticodonWobbleBase:codonThirdBase`.
 * @param {import('./codon-table.js').CodonTable} table
 * @param {{publishedSubstitution?: number|null, publishedZeroWeightCodons?: string[]|null}} options
 * @returns {{weights: Float64Array, report: object}}
 */
export function buildTaiWeights(tRNAGeneCopies, sValues, table, options = {}) {
  const complement = { A: 'T', T: 'A', C: 'G', G: 'C' };
  const copies = Object.entries(tRNAGeneCopies ?? {})
    .filter(([anticodon, n]) => typeof anticodon === 'string' && anticodon.length === 3
      && Number.isFinite(n) && n > 0);
  const constraints = sValues ?? {};
  const unconstrainedPairings = new Set();

  const absolute = new Float64Array(64);
  for (let i = 0; i < 64; i += 1) {
    if (table.isStop[i]) continue;
    const codon = table.codons[i];
    let total = 0;
    for (const [anticodon, n] of copies) {
      if (complement[anticodon[2]] !== codon[0]) continue;
      if (complement[anticodon[1]] !== codon[1]) continue;
      const wobble = anticodon[0];
      if (wobble in complement && complement[wobble] === codon[2]) {
        total += n;
        continue;
      }
      const key = `${wobble}:${codon[2]}`;
      if (key in constraints) total += n * (1 - constraints[key]);
      else unconstrainedPairings.add(key);
    }
    absolute[i] = total;
  }

  let max = 0;
  for (let i = 0; i < 64; i += 1) if (!table.isStop[i] && absolute[i] > max) max = absolute[i];
  const relative = new Float64Array(64);
  if (max > 0) {
    for (let i = 0; i < 64; i += 1) relative[i] = table.isStop[i] ? 0 : absolute[i] / max;
  }

  // A codon no tRNA reads would otherwise take the logarithm of zero and void
  // the whole gene. dos Reis substitutes the geometric mean of the weights that
  // do exist. The pipeline publishes the value it used; prefer it, so a change
  // to that rule needs no edit here, and compare to confirm this construction
  // produced the same weights the published number was derived from.
  const zeroWeightCodons = [];
  const nonZero = [];
  for (let i = 0; i < 64; i += 1) {
    if (table.isStop[i]) continue;
    if (relative[i] > 0) nonZero.push(relative[i]);
    else zeroWeightCodons.push(table.codons[i]);
  }
  const recomputedSubstitution = nonZero.length > 0 ? geometricMean(nonZero) : 0;
  const publishedSubstitution = Number.isFinite(options.publishedSubstitution)
    ? options.publishedSubstitution : null;
  const substitution = publishedSubstitution ?? recomputedSubstitution;

  const weights = new Float64Array(64);
  for (let i = 0; i < 64; i += 1) {
    if (table.isStop[i]) continue;
    weights[i] = relative[i] > 0 ? relative[i] : substitution;
  }

  const published = Array.isArray(options.publishedZeroWeightCodons)
    ? options.publishedZeroWeightCodons : null;
  const sorted = (list) => [...list].sort();
  const modifiedAnticodons = copies
    .filter(([anticodon]) => [...anticodon].some((base) => !(base in complement)))
    .map(([anticodon, n]) => `${anticodon} x${n}`);

  return {
    weights,
    report: {
      zeroWeightCodons,
      substitution,
      recomputedSubstitution,
      publishedSubstitution,
      // Published against recomputed. A mismatch means the browser built
      // different weights from the same inputs, so it must not read as agreement.
      substitutionAgrees: publishedSubstitution === null
        || Math.abs(publishedSubstitution - recomputedSubstitution) <= 1e-6,
      publishedZeroWeightCodons: published,
      zeroWeightCodonsAgree: published === null
        || sorted(published).join() === sorted(zeroWeightCodons).join(),
      unconstrainedPairings: [...unconstrainedPairings].sort(),
      modifiedAnticodons,
    },
  };
}

/**
 * tAI as the geometric mean of tRNA weights over a gene's codons.
 *
 * @param {ArrayLike<number>} counts 64-bin codon counts, initiator convention
 *   already applied.
 * @param {ArrayLike<number>} weights from {@link buildTaiWeights}.
 * @param {import('./codon-table.js').CodonTable} table
 * @param {ArrayLike<number>|null} excludedMask 1 for codons the convention
 *   leaves out, from `conventions.tai.excludedMask`. dos Reis excludes
 *   methionine, whose single codon carries no choice of tRNA.
 */
export function taiFromCounts(counts, weights, table, excludedMask = null) {
  let logSum = 0;
  let n = 0;
  for (let i = 0; i < 64; i += 1) {
    const count = counts[i];
    if (count === 0 || table.isStop[i]) continue;
    if (excludedMask && excludedMask[i]) continue;
    if (!(weights[i] > 0)) continue;
    logSum += count * Math.log(weights[i]);
    n += count;
  }
  return n === 0 ? NaN : Math.exp(logSum / n);
}

/**
 * Codon-pair scores from genome-wide wild-type counts.
 *
 * Coleman-style log odds conditioned on the amino-acid pair: the expected count
 * of codon pair AB is the observed count of amino-acid pair XY scaled by each
 * codon's share of its own amino acid's usage. The score is
 * `ln((observed + c) / (expected + c))`, so a pair that never occurs scores very
 * negative rather than infinitely so, and a pair whose amino acids are absent
 * from the genome scores against the smoothing constant alone.
 *
 * @param {ArrayLike<number>} pairCounts 4096 entries, index `a * 64 + b`,
 *   initiator convention already applied.
 * @param {ArrayLike<number>} codonCounts 64 genome-wide codon counts, likewise.
 * @param {import('./codon-table.js').CodonTable} table
 * @param {number} smoothing additive constant, from `conventions.cps.smoothing`.
 * @returns {Float64Array} 4096 entries, index `a * 64 + b`.
 */
export function buildCodonPairScores(pairCounts, codonCounts, table, smoothing) {
  if (!Number.isFinite(smoothing) || smoothing <= 0) {
    throw new Error(`codon-pair smoothing must be positive, got ${smoothing}`);
  }
  const aas = [...table.family.keys()];
  const aaIndex = new Map(aas.map((aa, i) => [aa, i]));
  const codonAa = new Int32Array(64);
  for (let i = 0; i < 64; i += 1) codonAa[i] = aaIndex.get(table.aas[i]);

  const aaCount = new Float64Array(aas.length);
  const aaPairCount = new Float64Array(aas.length * aas.length);
  for (let a = 0; a < 64; a += 1) {
    aaCount[codonAa[a]] += codonCounts[a];
    for (let b = 0; b < 64; b += 1) {
      const n = pairCounts[a * 64 + b];
      if (n === 0) continue;
      aaPairCount[codonAa[a] * aas.length + codonAa[b]] += n;
    }
  }

  const scores = new Float64Array(4096);
  for (let a = 0; a < 64; a += 1) {
    const x = codonAa[a];
    const shareA = aaCount[x] > 0 ? codonCounts[a] / aaCount[x] : 0;
    for (let b = 0; b < 64; b += 1) {
      const y = codonAa[b];
      const usable = aaCount[x] > 0 && aaCount[y] > 0;
      const expected = usable
        ? aaPairCount[x * aas.length + y] * shareA * (codonCounts[b] / aaCount[y])
        : 0;
      scores[a * 64 + b] =
        Math.log((pairCounts[a * 64 + b] + smoothing) / (expected + smoothing));
    }
  }
  return scores;
}
