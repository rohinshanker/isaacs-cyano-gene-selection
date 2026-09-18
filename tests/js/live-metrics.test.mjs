import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeLiveMetrics, buildFeatureMatrix, isCountMetric,
  LIVE_METRICS, LIVE_METRIC_KEYS, WINDOW_CODONS, RAMP_CODONS, CLUSTER_GAP_CODONS,
  INITIATION_INDEX,
} from '../../site/js/core/live-metrics.js';
import { compileScheme } from '../../site/js/core/scheme.js';
import { buildCaiWeights, buildTaiWeights, buildCodonPairScores } from '../../site/js/core/codon-metrics.js';
import { standardTable, fixtureDataset } from './helpers.mjs';

const table = standardTable();

/** One 120-codon gene with targets at positions chosen so every field is checkable by hand. */
function handBuiltDataset(targetPositions, { terminalStop = 'TAA' } = {}) {
  const length = 120;
  const packed = new Uint8Array(length).fill(table.indexOf('GCT'));
  packed[0] = table.indexOf('ATG');
  for (const position of targetPositions) packed[position] = table.indexOf('TCG');
  const counts = new Float64Array(64);
  const pairCounts = new Float64Array(4096);
  for (let i = 0; i < length; i += 1) {
    counts[packed[i]] += 1;
    if (i > 0) pairCounts[packed[i - 1] * 64 + packed[i]] += 1;
  }
  return {
    table,
    packed,
    offsets: Int32Array.from([0, length]),
    lengthsNt: Float64Array.from([length * 3 + 3]),
    stopCodons: Int8Array.from([terminalStop ? table.indexOf(terminalStop) : -1]),
    genes: [{ id: 'TEST_0001', lengthCodons: length, lengthNt: length * 3 + 3, terminalStop }],
    caiWeights: buildCaiWeights(counts, table),
    taiWeights: buildTaiWeights({ AGC: 3, AGA: 2, CGA: 1 }, {}, table).weights,
    cpsScores: buildCodonPairScores(pairCounts, counts, table),
  };
}

test('the registry describes exactly the fields the scan produces', () => {
  assert.equal(LIVE_METRICS.length, LIVE_METRIC_KEYS.length);
  assert.equal(new Set(LIVE_METRIC_KEYS).size, LIVE_METRIC_KEYS.length);
  for (const metric of LIVE_METRICS) {
    assert.ok(metric.label && metric.unit && metric.desc && metric.family);
  }
  assert.equal(isCountMetric('targetCount'), true);
  assert.equal(isCountMetric('targetFraction'), false);
});

test('target counts, ramp, clusters, and window density match hand calculation', () => {
  const dataset = handBuiltDataset([1, 2, 40, 100, 105, 118]);
  const scheme = compileScheme({ TCG: 'AGC' }, table);
  const { fields } = computeLiveMetrics(dataset, scheme);

  assert.equal(fields.targetCount[0], 6);
  assert.equal(fields.targetStopEdit[0], 0, 'this scheme does not touch stops');
  assert.equal(fields.targetFraction[0].toFixed(6), (6 / 120).toFixed(6));
  assert.equal(fields.targetPerKb[0].toFixed(4), ((6 * 1000) / 363).toFixed(4));
  assert.equal(RAMP_CODONS, 50);
  assert.equal(fields.targetFirstRamp[0], 3, 'positions 1, 2, and 40 are inside the ramp');
  assert.equal(WINDOW_CODONS, 50);
  assert.equal(fields.maxLocalTargetDensity[0].toFixed(6), (3 / 50).toFixed(6));
  assert.equal(CLUSTER_GAP_CODONS, 10);
  // {1, 2}, {40}, {100, 105}, {118}: four groups, since 118 is 13 codons after 105.
  assert.equal(fields.targetClusters[0], 4);
  assert.equal(fields.maxClusterSpan[0], 6, 'positions 100 and 105 span six codons');
});

test('the initiation codon is never a target, whatever triplet it is', () => {
  assert.equal(INITIATION_INDEX, 0);
  // GTG reads as methionine at position zero, so recoding it is not synonymous.
  const dataset = handBuiltDataset([1]);
  dataset.packed[0] = table.indexOf('GTG');
  const scheme = compileScheme({ GTG: 'GTC', TCG: 'AGC' }, table);
  const { fields } = computeLiveMetrics(dataset, scheme);
  assert.equal(fields.targetCount[0], 1, 'only the internal TCG counts');
  assert.equal(fields.targetFirstRamp[0], 1);
});

test('a reassigned terminal stop counts as an edit but joins no window or cluster', () => {
  const dataset = handBuiltDataset([1, 2], { terminalStop: 'TAG' });
  const plain = computeLiveMetrics(dataset, compileScheme({ TCG: 'AGC' }, table)).fields;
  const withStop = computeLiveMetrics(
    dataset, compileScheme({ TCG: 'AGC', TAG: 'TAA' }, table),
  ).fields;

  assert.equal(plain.targetCount[0], 2);
  assert.equal(withStop.targetCount[0], 3, 'the terminal stop adds exactly one edit');
  assert.equal(withStop.targetStopEdit[0], 1);
  assert.equal(withStop.targetFraction[0].toFixed(6), (3 / 120).toFixed(6));
  assert.equal(withStop.targetFirstRamp[0], plain.targetFirstRamp[0]);
  assert.equal(withStop.targetClusters[0], plain.targetClusters[0]);
  assert.equal(withStop.maxClusterSpan[0], plain.maxClusterSpan[0]);
  assert.equal(withStop.maxLocalTargetDensity[0], plain.maxLocalTargetDensity[0]);
  assert.equal(withStop.recodedGc3[0], plain.recodedGc3[0], 'the stop is outside the sense codons');
});

test('a gene whose stop is not targeted contributes no stop edit', () => {
  const dataset = handBuiltDataset([1], { terminalStop: 'TGA' });
  const { fields } = computeLiveMetrics(dataset, compileScheme({ TAG: 'TAA' }, table));
  assert.equal(fields.targetStopEdit[0], 0);
  assert.equal(fields.targetCount[0], 0);
});

test('a gene with no targets reports zeros rather than gaps', () => {
  const dataset = handBuiltDataset([]);
  const { fields } = computeLiveMetrics(dataset, compileScheme({ TCG: 'AGC' }, table));
  assert.equal(fields.targetCount[0], 0);
  assert.equal(fields.targetFraction[0], 0);
  assert.equal(fields.targetClusters[0], 0);
  assert.equal(fields.maxClusterSpan[0], 0);
  assert.equal(fields.maxLocalTargetDensity[0], 0);
});

test('recoded values move and deltas are measured against the same baseline', () => {
  const dataset = handBuiltDataset([1, 2, 3, 40, 100, 105, 118]);
  const identity = compileScheme({}, table);
  const { fields: baseline } = computeLiveMetrics(dataset, identity);
  const scheme = compileScheme({ TCG: 'AGC' }, table);
  const { fields } = computeLiveMetrics(dataset, scheme, { baseline });

  // TCG and AGC both end in a G or C, so GC3 cannot move; CAI must.
  assert.equal(fields.dGc3[0].toFixed(12), '0.000000000000');
  assert.notEqual(fields.recodedCai[0], baseline.recodedCai[0]);
  assert.equal(
    fields.dCai[0].toFixed(12),
    (fields.recodedCai[0] - baseline.recodedCai[0]).toFixed(12),
  );
  const identityRun = computeLiveMetrics(dataset, identity, { baseline });
  for (const key of ['dGc3', 'dCai', 'dTai', 'dEnc', 'dCps']) {
    assert.equal(identityRun.fields[key][0], 0, `${key} is zero when nothing is recoded`);
  }
});

test('GC3 moves when the replacement changes the third base', () => {
  const dataset = handBuiltDataset([1, 2, 3, 40]);
  const identity = compileScheme({}, table);
  const { fields: baseline } = computeLiveMetrics(dataset, identity);
  const { fields } = computeLiveMetrics(dataset, compileScheme({ TCG: 'TCA' }, table), { baseline });
  assert.equal(fields.dGc3[0].toFixed(6), (-4 / 120).toFixed(6));
});

test('every gene in the fixture agrees with a brute-force target count', async () => {
  const dataset = await fixtureDataset();
  const scheme = compileScheme({ TCG: 'AGC', CTG: 'CTC', GCG: 'GCC' }, dataset.table);
  const { fields } = computeLiveMetrics(dataset, scheme, { baseline: dataset.baseline });
  const targets = new Set(['TCG', 'CTG', 'GCG'].map((codon) => dataset.table.indexOf(codon)));
  for (let g = 0; g < dataset.genes.length; g += 1) {
    let expected = 0;
    // The start codon is skipped; no stop codon is targeted by this scheme.
    for (let i = dataset.offsets[g] + 1; i < dataset.offsets[g + 1]; i += 1) {
      if (targets.has(dataset.packed[i])) expected += 1;
    }
    assert.equal(fields.targetCount[g], expected, `gene ${dataset.genes[g].id}`);
  }
});

test('a genome-sized scan stays well inside the interaction budget', async () => {
  const fixture = await fixtureDataset();
  // Repeat the fixture until it is the size of the real analysis set.
  const copies = Math.ceil(2711 / fixture.genes.length);
  const total = fixture.packed.length * copies;
  const packed = new Uint8Array(total);
  const offsets = new Int32Array(fixture.genes.length * copies + 1);
  const lengthsNt = new Float64Array(fixture.genes.length * copies);
  const genes = [];
  let cursor = 0;
  let gene = 0;
  for (let copy = 0; copy < copies; copy += 1) {
    for (let g = 0; g < fixture.genes.length; g += 1) {
      const start = fixture.offsets[g];
      const end = fixture.offsets[g + 1];
      packed.set(fixture.packed.subarray(start, end), cursor);
      offsets[gene] = cursor;
      lengthsNt[gene] = fixture.lengthsNt[g];
      genes.push(fixture.genes[g]);
      cursor += end - start;
      gene += 1;
    }
  }
  offsets[gene] = cursor;
  const scaled = { ...fixture, packed, offsets, lengthsNt, genes };
  const scheme = compileScheme({ TCG: 'AGC', TCA: 'AGT', CTG: 'CTC' }, fixture.table);

  computeLiveMetrics(scaled, scheme);
  const { elapsedMs, codonsScanned } = computeLiveMetrics(scaled, scheme);
  assert.ok(genes.length >= 2711, `scaled to ${genes.length} genes`);
  assert.ok(
    elapsedMs < 400,
    `scan of ${codonsScanned} codons took ${elapsedMs.toFixed(1)} ms`,
  );
});

test('the feature matrix fills gaps with the column mean', () => {
  const columns = [
    { key: 'a', values: Float64Array.from([1, NaN, 3]) },
    { key: 'b', values: Float64Array.from([NaN, NaN, NaN]) },
  ];
  const { matrix, keys, cols } = buildFeatureMatrix(columns, 3);
  assert.deepEqual(keys, ['a', 'b']);
  assert.equal(cols, 2);
  assert.equal(matrix[2], 2, 'the missing value takes the mean of 1 and 3');
  assert.equal(matrix[1], 0, 'a column with no values at all becomes zero');
});
