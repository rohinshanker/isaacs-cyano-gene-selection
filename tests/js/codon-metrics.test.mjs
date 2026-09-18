import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gc3FromCounts, encFromCounts, encExpected, buildCaiWeights, caiFromCounts,
  buildTaiWeights, taiFromCounts, buildCodonPairScores, reverseComplement,
  resolveTaiS, DEFAULT_TAI_S,
} from '../../site/js/core/codon-metrics.js';
import { standardTable } from './helpers.mjs';

const table = standardTable();

function counts(entries) {
  const out = new Float64Array(64);
  for (const [codon, n] of Object.entries(entries)) out[table.indexOf(codon)] = n;
  return out;
}

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

test('ENC rescales when a short gene cannot estimate a degeneracy class', () => {
  const partial = counts({ TTT: 20, TTC: 20, GCT: 20, GCC: 20, GCA: 20, GCG: 20 });
  const value = encFromCounts(partial, table);
  assert.ok(Number.isFinite(value));
  assert.ok(value > 20 && value <= 61);
  assert.ok(Number.isNaN(encFromCounts(new Float64Array(64), table)));
});

test('expected ENC follows Wright’s curve and peaks at balanced GC3', () => {
  assert.equal(encExpected(0.5).toFixed(2), '60.50');
  assert.ok(encExpected(0.5) > encExpected(0.9));
  assert.ok(Number.isNaN(encExpected(NaN)));
});

test('CAI weights are relative to the family maximum, with a half-count floor', () => {
  const reference = counts({ TTT: 10, TTC: 40, TCT: 0, TCC: 100 });
  const weights = buildCaiWeights(reference, table);
  assert.equal(weights[table.indexOf('TTC')], 1);
  assert.equal(weights[table.indexOf('TTT')], 0.25);
  assert.equal(weights[table.indexOf('TCT')], 0.005);
  assert.equal(weights[table.indexOf('ATG')], 0, 'single-codon families carry no weight');

  const gene = counts({ TTC: 2, TTT: 2 });
  assert.equal(caiFromCounts(gene, weights).toFixed(4), Math.sqrt(0.25).toFixed(4));
  assert.ok(Number.isNaN(caiFromCounts(new Float64Array(64), weights)));
});

test('reverse complement maps a codon to its Watson-Crick anticodon', () => {
  assert.equal(reverseComplement('TCG'), 'CGA');
  assert.equal(reverseComplement('ATG'), 'CAT');
});

test('tAI s-values fall back to the published defaults and report which', () => {
  const supplied = resolveTaiS({ 'G:U': 0.2, iC: 0.3 });
  assert.equal(supplied.s[4], 0.2);
  assert.equal(supplied.s[5], 0.3);
  assert.deepEqual(supplied.supplied, ['GU', 'IC']);
  assert.equal(supplied.defaulted.length, 7);
  const none = resolveTaiS(undefined);
  assert.equal(none.s[6], DEFAULT_TAI_S.IA);
  assert.equal(none.supplied.length, 0);
});

test('tAI weights follow tRNA supply and substitute for unread codons', () => {
  const copies = { AGC: 4, GCT: 1, CAT: 2, GAA: 3 };
  const { weights, report } = buildTaiWeights(copies, {}, table);
  assert.equal(Math.max(...weights), 1);
  assert.equal(weights[table.indexOf('TAA')], 0, 'stops carry no tAI weight');
  assert.ok(weights[table.indexOf('GCT')] > 0, 'a codon with a matching tRNA is read');
  assert.ok(report.zeroWeightCodons.length > 0);
  assert.equal(report.ataResolved, false);
  assert.ok(weights[table.indexOf('ATA')] > 0, 'unread codons take the substitute weight');
  assert.equal(report.sDefaulted.length, 9);

  const gene = counts({ GCT: 3 });
  assert.equal(taiFromCounts(gene, weights, table).toFixed(6), weights[table.indexOf('GCT')].toFixed(6));
  assert.ok(Number.isNaN(taiFromCounts(counts({ TAA: 4 }), weights, table)));
});

test('methionine is not read by the isoleucine wobble term', () => {
  // Anticodon AGC fixes the maximum, CAT supplies methionine, TAT supplies
  // isoleucine ATA. Adding isoleucine tRNA must not change methionine's weight.
  const base = { AGC: 20, CAT: 2 };
  const without = buildTaiWeights(base, {}, table).weights;
  const withIle = buildTaiWeights({ ...base, TAT: 9 }, {}, table).weights;
  assert.equal(without[table.indexOf('ATG')].toFixed(6), '0.100000');
  assert.equal(withIle[table.indexOf('ATG')].toFixed(6), '0.100000');
  assert.ok(withIle[table.indexOf('ATA')] > without[table.indexOf('ATA')]);
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
  const scores = buildCodonPairScores(pairCounts, codonCounts, table);
  assert.ok(scores[table.indexOf('TTT') * 64 + table.indexOf('GCT')] > 0);
  assert.ok(scores[table.indexOf('TTT') * 64 + table.indexOf('GCC')] < 0);
  assert.equal(scores.length, 4096);
  assert.ok(Number.isFinite(scores[0]), 'smoothing keeps unobserved pairs finite');
});
