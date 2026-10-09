import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FILE_STATE } from '../../site/js/core/data-files.js';
import { DatasetColorProgress } from '../../site/js/ui/dataset-color-progress.js';
import { withFakeDocument } from './fake-dom.mjs';

const record = (overrides = {}) => ({
  label: 'expression_layers.json', bytes: 1024 * 1024, actualReceivedBytes: 256 * 1024,
  settled: false, state: FILE_STATE.LOADING, ...overrides,
});
const snapshot = (entry) => ({ files: { expressionLayers: entry } });

test('dataset colour progress reports measured transfer then preparation', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    const progress = new DatasetColorProgress();
    const operation = progress.begin({
      fileKey: 'expressionLayers', metricLabel: 'Protein abundance', host,
      snapshot: snapshot(record()),
    });
    assert.equal(operation.pending, true);
    assert.equal(progress.root.hidden, false);
    assert.equal(progress.label.textContent,
      'Loading Protein abundance from expression_layers.json · 256 KB of 1.0 MB');
    assert.equal(progress.meter.getAttribute('aria-valuenow'), '25');
    progress.update(snapshot(record({ actualReceivedBytes: 1024 * 1024 })));
    assert.equal(progress.label.textContent,
      'Preparing Protein abundance from expression_layers.json');
    assert.equal(progress.meter.getAttribute('aria-valuenow'), null);
  });
});

test('unknown sizes, failure, Retry and ready cache states remain truthful', async () => {
  await withFakeDocument((document) => {
    const retried = [];
    const host = document.createElement('div');
    const progress = new DatasetColorProgress({ onRetry: (key) => retried.push(key) });
    progress.begin({
      fileKey: 'expressionLayers', metricLabel: 'Transcript abundance', host,
      snapshot: snapshot(record({ bytes: 0, actualReceivedBytes: 100 })),
    });
    assert.match(progress.label.textContent, /size unavailable/);
    assert.equal(progress.meter.getAttribute('aria-valuenow'), null);
    progress.update(snapshot(record({ state: FILE_STATE.FAILED, settled: true })));
    assert.match(progress.label.textContent, /Could not load expression_layers\.json/);
    assert.equal(progress.retry.hidden, false);
    assert.equal(progress.retry.getAttribute('aria-label'),
      'Retry loading expression_layers.json for Transcript abundance');
    progress.retry.click();
    assert.deepEqual(retried, ['expressionLayers']);

    const cached = progress.begin({
      fileKey: 'expressionLayers', metricLabel: 'Transcript abundance', host,
      snapshot: snapshot(record({ state: FILE_STATE.READY, settled: true })),
    });
    assert.equal(cached.pending, false);
    assert.equal(progress.root.hidden, true, 'ready data never fabricates another cycle');
  });
});

test('superseded waits cannot hide or apply over a newer selection', async () => {
  await withFakeDocument(async (document) => {
    const frames = [];
    const progress = new DatasetColorProgress({ requestFrame: (callback) => frames.push(callback) });
    const host = document.createElement('div');
    const first = progress.begin({
      fileKey: 'expressionLayers', metricLabel: 'Protein abundance', host,
      snapshot: snapshot(record()),
    });
    const wait = progress.waitForPaint(first.token);
    const second = progress.begin({
      fileKey: 'expressionLayers', metricLabel: 'Transcript initiation', host,
      snapshot: snapshot(record()),
    });
    frames.shift()();
    frames.shift()();
    assert.equal(await wait, false);
    progress.applied(first.token);
    assert.equal(progress.root.hidden, false);
    assert.equal(progress.token, second.token);
    assert.match(progress.label.textContent, /Transcript initiation/);
  });
});
