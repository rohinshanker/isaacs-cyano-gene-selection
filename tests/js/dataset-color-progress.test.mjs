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
      fileKeys: ['expressionLayers'], metricLabel: 'Protein abundance', host,
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
      fileKeys: ['expressionLayers'], metricLabel: 'Transcript abundance', host,
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
      fileKeys: ['expressionLayers'], metricLabel: 'Transcript abundance', host,
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
      fileKeys: ['expressionLayers'], metricLabel: 'Protein abundance', host,
      snapshot: snapshot(record()),
    });
    const wait = progress.waitForPaint(first.token);
    const second = progress.begin({
      fileKeys: ['expressionLayers'], metricLabel: 'Transcript initiation', host,
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

test('failure landing after selection keeps its Retry visible until a successful retry paints', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    const progress = new DatasetColorProgress();
    const operation = progress.begin({
      fileKeys: ['expressionLayers'], metricLabel: 'Protein abundance', host,
      snapshot: snapshot(record()),
    });

    progress.update(snapshot(record({ state: FILE_STATE.FAILED, settled: true })));
    progress.applied(operation.token);
    assert.equal(progress.root.hidden, false, 'a failed landing remains actionable');
    assert.equal(progress.retry.hidden, false);
    assert.match(progress.label.textContent, /Could not load expression_layers\.json/);

    progress.update(snapshot(record({
      state: FILE_STATE.READY, settled: true, actualReceivedBytes: 1024 * 1024,
    })));
    progress.applied(operation.token);
    assert.equal(progress.root.hidden, true, 'only a painted successful landing ends the operation');
  });
});

test('multiple required files report aggregate measured progress and wait for every landing', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    const progress = new DatasetColorProgress();
    const files = {
      annotations: record({ label: 'annotations.json', bytes: 2 * 1024 * 1024,
        actualReceivedBytes: 1024 * 1024 }),
      candidateEvidence: record({ label: 'candidate_evidence.json', bytes: 1024 * 1024,
        actualReceivedBytes: 512 * 1024 }),
      sourceDerivedCategories: record({ label: 'source-derived-categories-v1.json',
        bytes: 1024 * 1024, actualReceivedBytes: 0 }),
    };
    const operation = progress.begin({
      fileKeys: Object.keys(files), metricLabel: 'Function category', host, snapshot: { files },
    });
    assert.equal(progress.label.textContent,
      'Loading Function category from annotations.json, candidate_evidence.json, and '
        + 'source-derived-categories-v1.json · 1.5 MB of 4.0 MB');
    assert.equal(progress.meter.getAttribute('aria-valuenow'), '37');

    progress.update({ files: {
      ...files,
      annotations: { ...files.annotations, state: FILE_STATE.READY, settled: true,
        actualReceivedBytes: 2 * 1024 * 1024 },
      candidateEvidence: { ...files.candidateEvidence, state: FILE_STATE.READY, settled: true,
        actualReceivedBytes: 1024 * 1024 },
    } });
    progress.applied(operation.token);
    assert.equal(progress.root.hidden, false, 'one remaining dependency keeps the operation visible');

    progress.update({ files: Object.fromEntries(Object.entries(files).map(([key, value]) => [key, {
      ...value, state: FILE_STATE.READY, settled: true, actualReceivedBytes: value.bytes,
    }])) });
    progress.applied(operation.token);
    assert.equal(progress.root.hidden, true);
  });
});

test('a cached operation supersedes stale feedback without fabricating another cycle', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    const progress = new DatasetColorProgress();
    progress.begin({
      fileKeys: ['expressionLayers'], metricLabel: 'Pooled transcript abundance', host,
      snapshot: snapshot(record()),
    });
    const cached = progress.begin({
      fileKeys: ['genes'], metricLabel: 'GSE205444 transcript abundance', host,
      snapshot: { files: { genes: record({ label: 'genes.json', state: FILE_STATE.READY,
        settled: true }) } },
    });
    assert.equal(cached.pending, false);
    assert.equal(progress.root.hidden, true);
    assert.deepEqual(progress.fileKeys, []);
  });
});

test('an optional dependency landing as absent completes after its fallback paints', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    const progress = new DatasetColorProgress();
    const operation = progress.begin({
      fileKeys: ['sourceDerivedCategories'], metricLabel: 'Function category', host,
      snapshot: { files: { sourceDerivedCategories: record({
        label: 'source-derived-categories-v1.json',
      }) } },
    });
    progress.update({ files: { sourceDerivedCategories: record({
      label: 'source-derived-categories-v1.json', state: FILE_STATE.ABSENT, settled: true,
    }) } });
    assert.match(progress.label.textContent, /^Preparing Function category/);
    progress.applied(operation.token);
    assert.equal(progress.root.hidden, true);
  });
});
