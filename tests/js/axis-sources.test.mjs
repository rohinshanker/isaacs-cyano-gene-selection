import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dataset } from './data-sources-fixture.mjs';
import {
  availableAxisDatasets, axisDatasetSelectionLabel, defaultAxisDatasetSelection,
  legacyAxisDatasetSelection, normalizeAxisDatasetSelection, requestedAxisFileKeys,
  resolveAxisContributors, createAxisContributorResolver,
} from '../../site/js/core/axis-sources.js';
import { buildTypeMetrics, typeKeyFor } from '../../site/js/core/type-metrics.js';

function fixture() {
  return [
    dataset({ id: 'A', datasetId: 'A', metricKey: 'a', group: 'standard' }),
    dataset({ id: 'B', datasetId: 'B', metricKey: 'b', group: 'standard' }),
    dataset({ id: 'C', datasetId: 'C', metricKey: 'c', dataType: 'proteomics', platform: 'LC-MS/MS' }),
  ];
}

test('URL readiness retains pending requested layers and deduplicates their files', () => {
  const contributors = { requested: [{ metricKey: 'a' }, { metricKey: 'b' }, { metricKey: 'c' }] };
  const metrics = new Map([['a', {}], ['b', { fileKey: 'expressionLayers' }],
    ['c', { fileKey: 'expressionLayers' }]]);
  assert.deepEqual(requestedAxisFileKeys(contributors, (entry) => metrics.get(entry.metricKey)),
    ['expressionLayers']);
  assert.deepEqual(requestedAxisFileKeys({ requested: [] }, () => null), []);
});

test('each axis normalizes an independent catalogue-ordered selection of the exact type', () => {
  const rows = fixture();
  const key = typeKeyFor(rows[0]);
  const x = normalizeAxisDatasetSelection(key, ['B', 'C', 'A', 'B'], rows);
  const y = normalizeAxisDatasetSelection(key, ['B'], rows);
  assert.deepEqual(x, ['A', 'B']);
  assert.deepEqual(y, ['B']);
  x.pop();
  assert.deepEqual(y, ['B'], 'mutating X cannot mutate Y');
  assert.deepEqual(availableAxisDatasets(key, rows).map((row) => row.id), ['A', 'B']);
  assert.deepEqual(availableAxisDatasets('gc3', rows), []);
});

test('an older pooled or named global choice is copied without becoming a fallback', () => {
  const rows = fixture();
  const key = typeKeyFor(rows[0]);
  assert.deepEqual(legacyAxisDatasetSelection(key, rows, ['A', 'B'], {}), ['A', 'B']);
  assert.deepEqual(legacyAxisDatasetSelection(key, rows, ['A', 'B'], { [key]: 'B' }), ['B']);
  const copied = legacyAxisDatasetSelection(key, rows, ['A', 'B'], {});
  const changedGlobal = ['B'];
  assert.deepEqual(copied, ['A', 'B']);
  assert.deepEqual(changedGlobal, ['B']);
});

test('defaults, one-source types and summaries stay truthful', () => {
  const rows = fixture();
  const abundance = typeKeyFor(rows[0]);
  const protein = typeKeyFor(rows[2]);
  assert.deepEqual(defaultAxisDatasetSelection(abundance, rows), ['A', 'B']);
  assert.deepEqual(defaultAxisDatasetSelection(protein, rows), ['C']);
  assert.equal(axisDatasetSelectionLabel(abundance, ['A', 'B'], rows, true), 'Pooled (2 of 2 datasets)');
  assert.match(axisDatasetSelectionLabel(abundance, ['B'], rows, true), /^B ·/);
  assert.equal(axisDatasetSelectionLabel('not-a-type', [], rows), 'Choose datasets (0 of 0)');
});

test('a mixed-file pool uses ready contributors while failed/loading inputs remain requested for retry', () => {
  const rows = fixture().slice(0, 2);
  const key = typeKeyFor(rows[0]);
  const states = new Map([['expressionLayers', 'failed']]);
  const metrics = new Map([
    ['a', { key: 'a', unit: 'counts', provenance: { id: 'A' }, read: (index) => [1, 3][index] }],
    ['b', {
      key: 'b', unit: 'counts', fileKey: 'expressionLayers', provenance: { id: 'B' },
      read: (index) => [3, 1][index],
    }],
  ]);
  const resolve = () => resolveAxisContributors(key, ['A', 'B'], rows, {
    metricOf: (entry) => metrics.get(entry.metricKey),
    resourceStateOf: (metric) => states.get(metric.fileKey) ?? null,
  });
  const [typeMetric] = buildTypeMetrics(rows, {
    contributing: () => resolve().available,
    selected: () => rows,
    metricOf: (entry) => metrics.get(entry.metricKey),
    geneCount: 2,
  });

  for (const state of ['failed', 'loading']) {
    states.set('expressionLayers', state);
    const result = resolve();
    assert.equal(result.state, state);
    assert.deepEqual(result.requested.map((entry) => entry.id), ['A', 'B']);
    assert.deepEqual(result.available.map((entry) => entry.id), ['A']);
    assert.deepEqual(requestedAxisFileKeys(result, (entry) => metrics.get(entry.metricKey)),
      ['expressionLayers'], 'URL readiness includes the requested unreadable layer');
    assert.deepEqual([typeMetric.read(0), typeMetric.read(1)], [1, 3]);
    assert.equal(typeMetric.provenance.id, 'A');
  }

  states.set('expressionLayers', null);
  const retried = resolve();
  assert.equal(retried.state, null);
  assert.deepEqual(retried.available.map((entry) => entry.id), ['A', 'B']);
  assert.deepEqual([typeMetric.read(0), typeMetric.read(1)], [0.5, 0.5]);
  assert.deepEqual(typeMetric.provenance.pooled, ['A', 'B']);
});

test('a non-pooling quantity never substitutes a different selected contrast when its input fails', () => {
  const rows = [
    dataset({ id: 'D', datasetId: 'D', metricKey: 'd', quantity: 'log2_fold_change' }),
    dataset({ id: 'E', datasetId: 'E', metricKey: 'e', quantity: 'log2_fold_change' }),
  ];
  const key = typeKeyFor(rows[0]);
  const result = resolveAxisContributors(key, ['D', 'E'], rows, {
    metricOf: (entry) => ({ key: entry.metricKey, fileKey: entry.id === 'D' ? 'layer' : null }),
    resourceStateOf: (metric) => (metric.fileKey === 'layer' ? 'failed' : null),
  });
  assert.deepEqual(result.selected, ['D', 'E']);
  assert.deepEqual(result.requested.map((entry) => entry.id), ['D']);
  assert.deepEqual(result.available, []);
  assert.deepEqual(result.affected.map(({ dataset: entry }) => entry.id), ['D']);
});


test('axis membership is reused for gene reads while metrics and file readiness stay live', () => {
  const rows = fixture();
  let catalogueReads = 0;
  const platform = rows[0].record.platform;
  Object.defineProperty(rows[0].record, 'platform', {
    get: () => { catalogueReads += 1; return platform; },
  });
  const key = typeKeyFor(rows[0]);
  const ids = ['B'];
  let fileState = 'loading';
  let metric = { read: () => 1 };
  const readers = { metricOf: () => metric, resourceStateOf: () => fileState };
  const resolve = createAxisContributorResolver();
  const first = resolve(key, ids, rows, readers);
  const reads = catalogueReads;
  for (let gene = 0; gene < 2715; gene += 1) {
    const current = resolve(key, ids, rows, readers);
    assert.equal(current.selected, first.selected);
    assert.equal(current.requested, first.requested);
    assert.equal(current.state, 'loading');
    assert.equal(current.available.length, 0);
  }
  assert.equal(catalogueReads, reads, 'a whole gene scan must not rescan the catalogue');
  assert.throws(() => ids.push('A'), TypeError, 'selection snapshots are immutable');
  assert.throws(() => rows.pop(), TypeError, 'catalogue snapshots are immutable');
  fileState = 'failed';
  assert.equal(resolve(key, ids, rows, readers).state, 'failed');
  fileState = null;
  assert.deepEqual(resolve(key, ids, rows, readers).available.map(row => row.id), ['B']);
  metric = null;
  assert.equal(resolve(key, ids, rows, readers).available.length, 0, 'metric lookup stays live');
  metric = { read: () => 2 };
  assert.equal(resolve(key, ids, rows, readers).available.length, 1);

  assert.deepEqual(resolve(key, ['A'], rows, readers).selected, ['A']);
  assert.deepEqual(resolve(typeKeyFor(rows[2]), ['C'], rows, readers).selected, ['C']);
  assert.deepEqual(resolve(key, ['B'], rows.filter(row => row.id !== 'B'), readers).selected, []);
  assert.deepEqual(resolve('cai', null, rows, readers).requested, []);
  assert.deepEqual(resolve('cai', undefined, rows, readers).available, []);
  const otherAxis = createAxisContributorResolver();
  assert.deepEqual(otherAxis(key, ['A'], rows, readers).selected, ['A']);
  assert.deepEqual(resolve(key, ids, rows, readers).selected, ['B']);
});
