import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dataset } from './data-sources-fixture.mjs';
import { defaultSelection, normalizeSelection } from '../../site/js/core/data-sources.js';
import {
  buildTypeMetrics, contributingDatasets, defaultDatasetsOfType, informingDataset,
  nonPoolingReason, typeKeyFor, typePools,
} from '../../site/js/core/type-metrics.js';
import {
  axisDatasetSelectionLabel, defaultAxisDatasetSelection, resolveAxisContributors,
} from '../../site/js/core/axis-sources.js';
import { defaultState, decodeState, encodeState } from '../../site/js/core/url-state.js';

const CONTROL = 'TAN2018_TSS_CONTROL';
const DARK = 'TAN2018_TSS_DARK';
const POOLED = 'TAN2018_TSS';
const KEY = 'type.transcriptomics.rna-seq.initiation';

function conditions() {
  // The legacy aggregate precedes the new conditions in existing manifests.
  return [
    [POOLED, 'tssInitiation', 'Legacy four-condition pooled'],
    [CONTROL, 'tssInitiationControl', 'Control: 33 °C, continuous light'],
    [DARK, 'tssInitiationDark', 'Dark for 2 h'],
    ['TAN2018_TSS_HIGH_LIGHT', 'tssInitiationHighLight', 'High light'],
    ['TAN2018_TSS_HIGH_TEMPERATURE', 'tssInitiationHighTemperature', 'High temperature'],
  ].map(([id, metricKey, conditionSet]) => dataset({
    datasetId: id, id: 'PRJNA420395', metricKey, conditionSet,
    group: 'other', quantity: 'tss_initiation',
  }));
}

test('fresh global and axis selections choose the control without changing explicit legacy choices', () => {
  const rows = conditions();
  assert.deepEqual(defaultSelection(rows), [CONTROL]);
  assert.deepEqual(defaultDatasetsOfType(KEY, rows).map((row) => row.id), [CONTROL]);
  assert.deepEqual(defaultAxisDatasetSelection(KEY, rows), [CONTROL]);
  assert.deepEqual(normalizeSelection([POOLED], rows), [POOLED]);
  assert.deepEqual(defaultSelection(rows.slice(0, 1)), [POOLED], 'older releases retain their own default');
  assert.deepEqual(defaultDatasetsOfType(KEY, rows.slice(0, 1)).map((row) => row.id), [POOLED]);
});

test('all five Tan rows share the initiation type and never automatically pool', () => {
  const rows = conditions();
  for (const row of rows) assert.equal(typeKeyFor(row), KEY);
  assert.equal(typePools(KEY, rows), false);
  const selected = rows.map((row) => row.id);
  assert.equal(informingDataset(KEY, {}, rows, selected).id, CONTROL);
  assert.deepEqual(contributingDatasets(KEY, {}, rows, selected).map((row) => row.id), [CONTROL]);
  assert.equal(informingDataset(KEY, { [KEY]: DARK }, rows, selected).id, DARK);
  assert.equal(informingDataset(KEY, { [KEY]: POOLED }, rows, selected).id, POOLED);
  assert.equal(informingDataset(KEY, {}, rows, [DARK]).id, DARK);
  assert.equal(informingDataset(KEY, {}, rows, []), null);
});

test('condition changes read their actual counts and retain zeros and missing values', () => {
  const rows = conditions();
  const selected = rows.map((row) => row.id);
  let named = {};
  const values = { [CONTROL]: [0, 7, NaN], [DARK]: [100, NaN, 0], [POOLED]: [25, 30, NaN] };
  const metrics = new Map(rows.map((row) => [row.metricKey, {
    key: row.metricKey, unit: 'summed mean TSS counts', desc: row.record.conditionSet,
    provenance: { id: row.id, condition: row.record.conditionSet },
    read: (i) => (values[row.id] ?? [NaN, NaN, NaN])[i],
  }]));
  const [metric] = buildTypeMetrics(rows, {
    contributing: (key) => contributingDatasets(key, named, rows, selected),
    selected: () => rows, metricOf: (row) => metrics.get(row.metricKey), geneCount: 3,
  });
  assert.equal(metric.pooled, false);
  assert.equal(metric.read(0), 0);
  assert.ok(Number.isNaN(metric.read(2)));
  assert.match(metric.selectionNote, /different growth conditions/);
  assert.doesNotMatch(metric.selectionNote, /fold change|p-value|translation-efficiency/);
  named = { [KEY]: DARK };
  assert.equal(metric.read(0), 100);
  assert.ok(Number.isNaN(metric.read(1)));
  assert.equal(metric.read(2), 0);
  assert.equal(metric.provenance.id, DARK);
  assert.equal(metric.unit, 'summed mean TSS counts');
  named = { [KEY]: POOLED };
  assert.equal(metric.read(0), 25, 'legacy aggregate is read only when chosen');
  assert.match(nonPoolingReason(rows[0]), /legacy pooled score/);
});

test('multi-selected axes label the actual informing condition and keep X and Y independent', () => {
  const rows = conditions();
  const selected = rows.map((row) => row.id);
  const resolved = resolveAxisContributors(KEY, selected, rows, {
    metricOf: () => ({}), resourceStateOf: () => null,
  });
  assert.deepEqual(resolved.requested.map((row) => row.id), [CONTROL]);
  assert.match(axisDatasetSelectionLabel(KEY, selected, rows, false), /Control: 33 °C.*reads alone/);
  const dark = resolveAxisContributors(KEY, [DARK], rows, {
    metricOf: () => ({}), resourceStateOf: () => null,
  });
  assert.deepEqual(dark.requested.map((row) => row.id), [DARK]);
  assert.deepEqual(resolved.requested.map((row) => row.id), [CONTROL]);
});

test('fresh Y uses control while explicit pooled and condition-specific shared keys survive', () => {
  assert.equal(defaultState().axisY, 'tssInitiationControl');
  assert.equal(decodeState('#ay=tssInitiation').axisY, 'tssInitiation');
  for (const version of [3, 4, 5, 6, 7]) {
    assert.equal(decodeState(`#ver=${version}&p=axes`).axisY, 'tssInitiation');
    assert.equal(decodeState(`#ver=${version}&ay=tssInitiationDark`).axisY, 'tssInitiationDark');
  }
  assert.equal(decodeState('#ver=8&p=axes').axisY, undefined);
  assert.equal(decodeState('#ver=2&p=axes').axisY, 'cai');
  assert.equal(decodeState('#ay=tssInitiationDark').axisY, 'tssInitiationDark');
  const state = { ...defaultState(), axisY: KEY, axisYSources: [DARK] };
  assert.deepEqual(decodeState(encodeState(state)).axisYSources, [DARK]);
});
