import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dataset } from './data-sources-fixture.mjs';
import {
  availableAxisDatasets, axisDatasetSelectionLabel, defaultAxisDatasetSelection,
  legacyAxisDatasetSelection, normalizeAxisDatasetSelection,
} from '../../site/js/core/axis-sources.js';
import { typeKeyFor } from '../../site/js/core/type-metrics.js';

function fixture() {
  return [
    dataset({ id: 'A', datasetId: 'A', metricKey: 'a', group: 'standard' }),
    dataset({ id: 'B', datasetId: 'B', metricKey: 'b', group: 'standard' }),
    dataset({ id: 'C', datasetId: 'C', metricKey: 'c', dataType: 'proteomics', platform: 'LC-MS/MS' }),
  ];
}

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
