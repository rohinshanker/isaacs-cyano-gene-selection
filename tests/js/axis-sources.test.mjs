import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dataset } from './data-sources-fixture.mjs';
import {
  availableAxisDatasets, axisDatasetSelectionLabel, defaultAxisDatasetSelection,
  legacyAxisDatasetSelection, normalizeAxisDatasetSelection, requestedAxisFileKeys,
  resolveAxisContributors,
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
