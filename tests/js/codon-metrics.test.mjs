import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gc3FromCounts, encFromCounts, encExpected, buildCaiWeights, caiFromCounts,
  buildTaiWeights, taiFromCounts, buildCodonPairScores,
} from '../../site/js/core/codon-metrics.js';
import {
  DEFAULT_TAI_S_VALUES, DEFAULT_CAI_ZERO_COUNT_ADJUSTMENT, DEFAULT_CPS_SMOOTHING,
} from '../../site/js/core/conventions.js';
import { standardTable } from './helpers.mjs';

const table = standardTable();
const ADJUSTMENT = DEFAULT_CAI_ZERO_COUNT_ADJUSTMENT;
const SMOOTHING = DEFAULT_CPS_SMOOTHING;

function counts(entries) {
  const out = new Float64Array(64);
  for (const [codon, n] of Object.entries(entries)) out[table.indexOf(codon)] = n;
  return out;
}

function maskFor(aminoAcids) {
  const mask = new Uint8Array(64);
  for (const aa of aminoAcids) for (const index of table.family.get(aa)) mask[index] = 1;
  return mask;
}

const NON_DEGENERATE = maskFor(['M', 'W']);
const MET_ONLY = maskFor(['M']);

test('GC3 counts third-position G and C', () => {
  assert.equal(gc3FromCounts(counts({ TTT: 1, TTC: 1, TTG: 2 }), table), 0.75);
  assert.ok(Number.isNaN(gc3FromCounts(new Float64Array(64), table)));
});

test('ENC is 61 for even synonymous use and near 20 for one codon per amino acid', () => {
  const even = new Float64Array(64);
  for (let i = 0; i < 64; i += 1) even[i] = table.isStop[i] ? 0 : 12;
  assert.equal(encFromCounts(even, table).toFixed(2), '61.00');

  const single = new Float64Array(64);
  for (const [aa, indices] of table.family) {
    if (aa === '*') continue;
    single[indices[0]] = 30;
  }
  assert.equal(encFromCounts(single, table).toFixed(2), '20.00');
});

test('ENC omits a family observed once rather than calling it maximally biased', () => {
  // Phenylalanine is split evenly, so its own F is the class floor of 1/2.
  // Adding a single tyrosine codon gives that family one observation, which has
  // no unbiased estimate: it must not enter the two-fold mean at all. Treating
  // it as fully biased would pull the whole class towards F=1 and drop Nc.
  const even = counts({ TTT: 20, TTC: 20 });
  const plusSingleton = counts({ TTT: 20, TTC: 20, TAT: 1 });
  assert.equal(encFromCounts(even, table), encFromCounts(plusSingleton, table));

  // Two observations of the same codon do have an estimate, and being maximally
  // biased they raise the class mean F, which lowers Nc.
  const plusPair = counts({ TTT: 20, TTC: 20, TAT: 2 });
  assert.ok(encFromCounts(plusPair, table) < encFromCounts(even, table));
});

test('ENC floors each family at its uniform homozygosity', () => {
  // A four-fold family used once each has raw F of zero, which is not a
  // homozygosity a family can have. Floored at 1/4 it still contributes.
  const uniform = counts({ GCT: 1, GCC: 1, GCA: 1, GCG: 1 });
  const report = {};
  const value = encFromCounts(uniform, table, report);
  assert.ok(Number.isFinite(value));
  assert.equal(value.toFixed(2), '61.00', 'a perfectly even family is maximally even');
  assert.equal(report.hasSubstitutedFamilies, true, 'no other class was estimable');
});

test('ENC falls back to the neutral expectation for an unestimable class', () => {
  const partial = counts({ TTT: 20, TTC: 20, GCT: 20, GCC: 20, GCA: 20, GCG: 20 });
  const report = {};
  const value = encFromCounts(partial, table, report);
  assert.ok(Number.isFinite(value));
  assert.ok(value > 20 && value <= 61);
  assert.equal(report.hasSubstitutedFamilies, true);
  assert.ok(Number.isNaN(encFromCounts(new Float64Array(64), table)));
});

test('ENC reports no substitution when every family is estimable', () => {
  const full = new Float64Array(64);
  for (let i = 0; i < 64; i += 1) full[i] = table.isStop[i] ? 0 : 5;
  const report = {};
  encFromCounts(full, table, report);
  assert.equal(report.hasSubstitutedFamilies, false);
});

test('expected ENC follows Wright’s curve and peaks at balanced GC3', () => {
  assert.equal(encExpected(0.5).toFixed(2), '60.50');
  assert.ok(encExpected(0.5) > encExpected(0.9));
  assert.ok(Number.isNaN(encExpected(NaN)));
});

test('CAI weights are relative to the family maximum, with a half-count floor', () => {
  const reference = counts({ TTT: 10, TTC: 40, TCT: 0, TCC: 100 });
  const weights = buildCaiWeights(reference, table, ADJUSTMENT);
  assert.equal(weights[table.indexOf('TTC')], 1);
  assert.equal(weights[table.indexOf('TTT')], 0.25);
  assert.equal(weights[table.indexOf('TCT')], 0.005);

  const gene = counts({ TTC: 2, TTT: 2 });
  assert.equal(caiFromCounts(gene, weights, NON_DEGENERATE).toFixed(4), Math.sqrt(0.25).toFixed(4));
  assert.ok(Number.isNaN(caiFromCounts(new Float64Array(64), weights, NON_DEGENERATE)));
});

test('a family absent from the CAI reference set carries no penalty', () => {
  // Every codon of an unobserved family takes the same adjusted count, so the
  // family normalizes to weight 1 throughout. Leaving it at zero instead would
  // silently drop those codons out of the geometric mean.
  const reference = counts({ TTT: 10, TTC: 40 });
  const weights = buildCaiWeights(reference, table, ADJUSTMENT);
  for (const index of table.family.get('P')) assert.equal(weights[index], 1);
  assert.equal(caiFromCounts(counts({ CCT: 5 }), weights, NON_DEGENERATE), 1);
});

test('CAI excludes the amino acids the convention names', () => {
  const reference = counts({ TTT: 10, TTC: 40, ATG: 60, TGG: 60 });
  const weights = buildCaiWeights(reference, table, ADJUSTMENT);
  assert.equal(weights[table.indexOf('ATG')], 1, 'a lone codon is its own family maximum');
  // Methionine and tryptophan offer no synonymous choice, so they must not dilute
  // the mean towards 1. Without the mask they would.
  const gene = counts({ TTT: 2, ATG: 4, TGG: 4 });
  assert.equal(caiFromCounts(gene, weights, NON_DEGENERATE), 0.25);
  assert.ok(caiFromCounts(gene, weights, null) > 0.25);
});

test('CAI rejects a non-positive zero-count adjustment', () => {
  assert.throws(() => buildCaiWeights(counts({ TTT: 1 }), table, 0), /positive/);
  assert.throws(() => buildCaiWeights(counts({ TTT: 1 }), table, undefined), /positive/);
});

test('tAI reads anticodons as published rather than reverse-complementing codons', () => {
  // This is the defect that made the browser disagree with the pipeline. A
  // modified wobble base is not a DNA base, so the inosine arginine tRNA is
  // written ICG and the lysidine isoleucine tRNA LAT. Deriving an anticodon by
  // reverse-complementing CGT would look for ACG, find nothing, and leave all
  // four CGN codons unread.
  const copies = { AGC: 20, ICG: 1, LAT: 1, CAT: 2 };
  const { weights, report } = buildTaiWeights(copies, DEFAULT_TAI_S_VALUES, table, {});
  const at = (codon) => weights[table.indexOf(codon)];

  assert.ok(at('CGT') > 0, 'inosine reads CGT by Watson-Crick at the wobble position');
  assert.equal(at('CGC').toFixed(6), (at('CGT') * (1 - DEFAULT_TAI_S_VALUES['I:C'])).toFixed(6));
  assert.ok(at('CGA') > 0 && at('CGA') < at('CGC'), 'I:A is heavily constrained');
  assert.ok(!report.zeroWeightCodons.includes('CGT'));
  assert.deepEqual(report.modifiedAnticodons, ['ICG x1', 'LAT x1']);

  // Lysidine reads ATA; methionine's own CAT must not, and ATA must not be read
  // by methionine's tRNA either.
  assert.ok(at('ATA') > 0);
  assert.equal(at('ATA').toFixed(6), (at('CGT') * (1 - DEFAULT_TAI_S_VALUES['L:A'])).toFixed(6));
});

test('methionine is read only by its own tRNA', () => {
  // Methionine's weight comes from its own CAT copies alone. Adding the lysidine
  // isoleucine tRNA, whose anticodon string differs only in the modified base,
  // must leave methionine untouched while making ATA genuinely read.
  const base = { AGC: 20, CAT: 2 };
  const without = buildTaiWeights(base, DEFAULT_TAI_S_VALUES, table, {});
  const withIle = buildTaiWeights({ ...base, LAT: 9 }, DEFAULT_TAI_S_VALUES, table, {});
  assert.equal(without.weights[table.indexOf('ATG')].toFixed(6), '0.100000');
  assert.equal(withIle.weights[table.indexOf('ATG')].toFixed(6), '0.100000');
  assert.ok(without.report.zeroWeightCodons.includes('ATA'),
    'with no isoleucine tRNA, ATA falls to the substituted weight');
  assert.ok(!withIle.report.zeroWeightCodons.includes('ATA'),
    'lysidine reads ATA, so it is no longer a substituted codon');
  assert.equal(withIle.weights[table.indexOf('ATA')].toFixed(6),
    (9 * (1 - DEFAULT_TAI_S_VALUES['L:A']) / 20).toFixed(6));
});

test('tAI substitutes the geometric mean for a codon no tRNA reads', () => {
  const copies = { AGC: 4, GCT: 1, CAT: 2, GAA: 3 };
  const { weights, report } = buildTaiWeights(copies, DEFAULT_TAI_S_VALUES, table, {});
  assert.equal(Math.max(...weights), 1);
  assert.equal(weights[table.indexOf('TAA')], 0, 'stops carry no tAI weight');
  assert.ok(report.zeroWeightCodons.length > 0);
  assert.equal(report.substitution, report.recomputedSubstitution);
  for (const codon of report.zeroWeightCodons) {
    assert.equal(weights[table.indexOf(codon)], report.substitution);
  }

  const gene = counts({ GCT: 3 });
  assert.equal(
    taiFromCounts(gene, weights, table, MET_ONLY).toFixed(6),
    weights[table.indexOf('GCT')].toFixed(6),
  );
  assert.ok(Number.isNaN(taiFromCounts(counts({ TAA: 4 }), weights, table, MET_ONLY)));
});

test('tAI prefers the published substitution and flags a construction that disagrees', () => {
  const copies = { AGC: 4, GCT: 1, CAT: 2, GAA: 3 };
  const honest = buildTaiWeights(copies, DEFAULT_TAI_S_VALUES, table, {});
  const agreeing = buildTaiWeights(copies, DEFAULT_TAI_S_VALUES, table, {
    publishedSubstitution: honest.report.recomputedSubstitution,
    publishedZeroWeightCodons: honest.report.zeroWeightCodons,
  });
  assert.equal(agreeing.report.substitutionAgrees, true);
  assert.equal(agreeing.report.zeroWeightCodonsAgree, true);

  const disagreeing = buildTaiWeights(copies, DEFAULT_TAI_S_VALUES, table, {
    publishedSubstitution: 0.25,
    publishedZeroWeightCodons: ['TTA'],
  });
  assert.equal(disagreeing.report.substitutionAgrees, false);
  assert.equal(disagreeing.report.zeroWeightCodonsAgree, false);
  assert.equal(disagreeing.report.substitution, 0.25, 'the published value is the one used');
});

test('tAI excludes methionine from the geometric mean', () => {
  const copies = { AGC: 20, CAT: 2, GCT: 4 };
  const { weights } = buildTaiWeights(copies, DEFAULT_TAI_S_VALUES, table, {});
  const gene = counts({ GCT: 3, ATG: 3 });
  const alanineOnly = counts({ GCT: 3 });
  assert.equal(
    taiFromCounts(gene, weights, table, MET_ONLY),
    taiFromCounts(alanineOnly, weights, table, MET_ONLY),
  );
  assert.notEqual(taiFromCounts(gene, weights, table, null),
    taiFromCounts(alanineOnly, weights, table, null));
});

test('tAI records wobble pairings with no published constraint', () => {
  const { report } = buildTaiWeights({ ICG: 1 }, { 'I:C': 0.28 }, table, {});
  assert.ok(report.unconstrainedPairings.includes('I:A'));
  assert.ok(!report.unconstrainedPairings.includes('I:C'));
});

test('codon-pair scores are positive for over-used pairs and negative for avoided ones', () => {
  const codonCounts = counts({ TTT: 100, TTC: 100, GCT: 100, GCC: 100 });
  const pairCounts = new Float64Array(4096);
  const put = (a, b, n) => {
    pairCounts[table.indexOf(a) * 64 + table.indexOf(b)] = n;
  };
  put('TTT', 'GCT', 190);
  put('TTT', 'GCC', 10);
  put('TTC', 'GCT', 10);
  put('TTC', 'GCC', 190);
  const scores = buildCodonPairScores(pairCounts, codonCounts, table, SMOOTHING);
  assert.ok(scores[table.indexOf('TTT') * 64 + table.indexOf('GCT')] > 0);
  assert.ok(scores[table.indexOf('TTT') * 64 + table.indexOf('GCC')] < 0);
  assert.equal(scores.length, 4096);
  assert.ok(Number.isFinite(scores[0]), 'smoothing keeps unobserved pairs finite');
});

test('codon-pair expectation is the amino-acid pair scaled by each codon’s share', () => {
  // Two phenylalanine codons used equally, followed by one alanine codon. The
  // expected count of TTT-GCT is the Phe-Ala pair count times each codon's share
  // of its own amino acid, so 40 * 0.5 * 1.
  const codonCounts = counts({ TTT: 50, TTC: 50, GCT: 30 });
  const pairCounts = new Float64Array(4096);
  pairCounts[table.indexOf('TTT') * 64 + table.indexOf('GCT')] = 25;
  pairCounts[table.indexOf('TTC') * 64 + table.indexOf('GCT')] = 15;
  const scores = buildCodonPairScores(pairCounts, codonCounts, table, SMOOTHING);
  const expected = 40 * 0.5 * 1;
  assert.equal(
    scores[table.indexOf('TTT') * 64 + table.indexOf('GCT')].toFixed(9),
    Math.log((25 + SMOOTHING) / (expected + SMOOTHING)).toFixed(9),
  );
});

test('codon-pair scoring rejects a non-positive smoothing constant', () => {
  assert.throws(
    () => buildCodonPairScores(new Float64Array(4096), counts({ TTT: 1 }), table, 0),
    /positive/,
  );
});
