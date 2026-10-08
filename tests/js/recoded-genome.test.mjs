import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCoreDataset } from '../../site/js/core/dataset.js';
import { buildMetricRegistry } from '../../site/js/core/metric-registry.js';
import { organismById, storageKeys } from '../../site/js/core/organisms.js';
import {
  RESIDUAL_TARGET_CODONS_KEY, buildRecodedGenomeModel, residualTargetCodonCounts,
} from '../../site/js/core/recoded-genome.js';
import { defaultState } from '../../site/js/core/url-state.js';
import { LEFT_PANEL_IDS } from '../../site/js/core/left-panels.js';
import { defaultValueScale, valueScaleTransform } from '../../site/js/core/value-scales.js';
import { buildColorScale } from '../../site/js/ui/colors.js';
import { renderRecodedGenomePanel } from '../../site/js/ui/recoded-genome.js';
import { standardTable } from './helpers.mjs';
import { withFakeDocument } from './fake-dom.mjs';

const SYN61 = organismById('ecoli-syn61-delta3-ev5');
const NATIVE = organismById('ecoli-k12-mg1655');
const DATA = new URL('../../site/data/organisms/ecoli-syn61-delta3-ev5/', import.meta.url);

let actualDatasetPromise = null;
function actualDataset() {
  actualDatasetPromise ??= Promise.all([
    readFile(new URL('meta.json', DATA), 'utf8'),
    readFile(new URL('genes.json', DATA), 'utf8'),
  ]).then(([meta, genes]) => buildCoreDataset(JSON.parse(meta), JSON.parse(genes), null));
  return actualDatasetPromise;
}

test('the pure counter includes the actual codon body and a terminal TAG, preserving 0 and 1', () => {
  const table = standardTable();
  const tca = table.indexOf('TCA');
  const tcg = table.indexOf('TCG');
  const aaa = table.indexOf('AAA');
  const taa = table.indexOf('TAA');
  const tag = table.indexOf('TAG');
  const dataset = {
    table,
    genes: [{}, {}, {}, {}],
    // Gene 0 proves position zero is part of the deposited-body count. Gene 1
    // proves the terminal stop is counted outside that body.
    packed: Uint8Array.from([tca, aaa, aaa, tcg, tca]),
    offsets: Int32Array.from([0, 1, 2, 3, 5]),
    stopCodons: Int8Array.from([taa, tag, taa, taa]),
  };
  assert.deepEqual(
    [...residualTargetCodonCounts(dataset, ['TCA', 'TCG', 'TAG'])],
    [1, 1, 0, 2],
  );
  assert.equal(residualTargetCodonCounts(dataset, []), null);
  assert.equal(residualTargetCodonCounts(dataset, ['TCA', 'TCA']), null);
  assert.equal(residualTargetCodonCounts({ ...dataset, stopCodons: null }, ['TCA']), null);
});

test('the deposited Syn61 genome exposes 148 residuals over 3,549 included coding genes', async () => {
  const dataset = await actualDataset();
  const model = buildRecodedGenomeModel(SYN61, dataset);
  assert.ok(model);
  assert.deepEqual(model.targets, ['TCA', 'TCG', 'TAG']);
  assert.equal(model.includedGeneCount, 3549);
  assert.equal(model.total, 148);
  assert.equal(model.total, model.values.reduce((sum, value) => sum + value, 0));
  assert.ok(model.values.some((value) => value === 0), 'zero is an observed value');
  assert.ok(model.values.some((value) => value === 1), 'a count of one is present');

  const scaleName = defaultValueScale(model.values);
  assert.equal(scaleName, 'symlog', 'the zero-heavy count opens on a scale that reveals small counts');
  const scale = buildColorScale(model.values, {
    scale: model.metric.scale,
    transform: valueScaleTransform(scaleName, model.values),
  });
  assert.notEqual(scale.bucketOf(0), scale.bucketOf(1), 'count 1 has a visible colour distinct from 0');

  const registry = buildMetricRegistry(dataset.meta, dataset.genes, dataset.baseline, [model.metric]);
  const metric = registry.byKey.get(RESIDUAL_TARGET_CODONS_KEY);
  assert.ok(metric);
  assert.equal(metric.integer, true);
  assert.equal(metric.read(model.values.findIndex((value) => value === 0)), 0);
  assert.equal(metric.read(model.values.findIndex((value) => value === 1)), 1);
  assert.match(metric.desc, /terminal target stop counted once per gene/i);
});

test('native and incomplete records fail closed with no panel or metric', async () => {
  const dataset = await actualDataset();
  assert.equal(buildRecodedGenomeModel(NATIVE, dataset), null);
  assert.equal(buildRecodedGenomeModel(SYN61, {
    ...dataset, meta: { genome: { accession: 'GCF_000005845.2' } },
  }), null);
  assert.ok(!buildMetricRegistry(dataset.meta, dataset.genes, dataset.baseline)
    .byKey.has(RESIDUAL_TARGET_CODONS_KEY));

  await withFakeDocument((document) => {
    const host = document.createElement('section');
    renderRecodedGenomePanel(host, null);
    assert.equal(host.hidden, true);
    assert.equal(host.textContent, '');

    const model = buildRecodedGenomeModel(SYN61, dataset);
    renderRecodedGenomePanel(host, model);
    assert.equal(host.hidden, false);
    assert.match(host.textContent, /Recoded Genome Scheme/);
    assert.match(host.textContent, /TCA, TCG, TAG/);
    assert.match(host.textContent, /148 across 3,549 included coding genes/);
    assert.match(host.textContent, /not a partial Ec_Syn57 segment set/);
    assert.match(host.textContent, /Historical replacements.*unavailable/i);
    assert.match(host.textContent, /Axes are refitted.*surviving synonymous variation/i);
  });
});

test('the recoded information panel stays above and outside persisted control layout', async () => {
  const html = await readFile(new URL('../../site/index.html', import.meta.url), 'utf8');
  const infoAt = html.indexOf('id="recoded-genome-panel"');
  const firstControlAt = html.indexOf('data-panel-id="gene-viewer"');
  assert.ok(infoAt >= 0 && infoAt < firstControlAt);
  assert.ok(!LEFT_PANEL_IDS.includes('recoded-genome'));
  assert.deepEqual(defaultState(SYN61).panelOrder, defaultState(NATIVE).panelOrder);
  assert.deepEqual(defaultState(SYN61).panelCollapsed, defaultState(NATIVE).panelCollapsed);
  assert.notDeepEqual(storageKeys(SYN61), storageKeys(NATIVE));
});
