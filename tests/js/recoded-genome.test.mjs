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
import { PRESETS } from '../../site/js/core/scheme.js';
import { defaultValueScale, valueScaleTransform } from '../../site/js/core/value-scales.js';
import { buildColorScale } from '../../site/js/ui/colors.js';
import { renderRecodedGenomePanel } from '../../site/js/ui/recoded-genome.js';
import { standardTable } from './helpers.mjs';
import { withFakeDocument } from './fake-dom.mjs';

const SYN61 = organismById('ecoli-syn61-delta3-ev5');
const SYN57 = organismById('ecoli-syn57-design');
const NATIVE = organismById('ecoli-k12-mg1655');
const DATA = new URL('../../site/data/organisms/ecoli-syn61-delta3-ev5/', import.meta.url);
const DESIGN_DATA = new URL('../../site/data/organisms/ecoli-syn57-design/', import.meta.url);

let actualDatasetPromise = null;
function actualDataset() {
  actualDatasetPromise ??= Promise.all([
    readFile(new URL('meta.json', DATA), 'utf8'),
    readFile(new URL('genes.json', DATA), 'utf8'),
  ]).then(([meta, genes]) => buildCoreDataset(JSON.parse(meta), JSON.parse(genes), null));
  return actualDatasetPromise;
}

let designDatasetPromise = null;
function designDataset() {
  designDatasetPromise ??= Promise.all([
    readFile(new URL('meta.json', DESIGN_DATA), 'utf8'),
    readFile(new URL('genes.json', DESIGN_DATA), 'utf8'),
  ]).then(([meta, genes]) => buildCoreDataset(JSON.parse(meta), JSON.parse(genes), null));
  return designDatasetPromise;
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

test('the complete Syn57 design uses its own seven targets and design-only labels', async () => {
  const dataset = await designDataset();
  const model = buildRecodedGenomeModel(SYN57, dataset);
  assert.ok(model);
  assert.equal(model.recordType, 'design');
  assert.deepEqual(model.targets, ['AGC', 'AGT', 'TTA', 'TTG', 'AGA', 'AGG', 'TAG']);
  assert.equal(model.includedGeneCount, 3588);
  assert.equal(model.total, 446);
  assert.ok(!JSON.stringify(model).includes('Syn61'));
  const ownPreset = PRESETS.find(({ id }) => id === SYN57.recoding.schemeId);
  assert.ok(ownPreset, 'the Syn57 record resolves to its declared recoding preset');
  assert.deepEqual(ownPreset.targets, model.targets);
  assert.notEqual(ownPreset.id, SYN61.recoding.schemeId);

  await withFakeDocument(() => {
    const host = document.createElement('section');
    renderRecodedGenomePanel(host, model);
    assert.equal(host.hidden, false);
    assert.match(host.textContent, /complete published design/i);
    assert.match(host.textContent, /Design and scheme source/i);
    assert.match(host.textContent, /Design only.*no omics, growth, or fitness/i);
    assert.match(host.textContent, /native design coordinates/i);
    assert.match(host.textContent, /Design replacements.*3,490 matched design\/MG1655 CDS pairs/i);
    assert.doesNotMatch(host.textContent, /deposited recoded strain|Syn61/i);
  });
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
    assert.match(host.textContent, /Historical replacements.*TCG → AGC/);
    assert.match(host.textContent, /not an ev5 per-locus edit history/);
    assert.match(host.textContent, /Native codon space refits its axes.*surviving synonymous variation/i);
  });
});

test('recoded information lives inside the standard movable scheme panel', async () => {
  const html = await readFile(new URL('../../site/index.html', import.meta.url), 'utf8');
  const infoAt = html.indexOf('id="recoded-genome-panel"');
  const schemeAt = html.indexOf('data-panel-id="scheme"');
  const editorAt = html.indexOf('id="scheme-editor"');
  assert.ok(schemeAt >= 0 && schemeAt < infoAt && infoAt < editorAt);
  assert.ok(!LEFT_PANEL_IDS.includes('recoded-genome'));
  assert.deepEqual(defaultState(SYN61).panelOrder, defaultState(NATIVE).panelOrder);
  assert.deepEqual(defaultState(SYN61).panelCollapsed, defaultState(NATIVE).panelCollapsed);
  assert.deepEqual(defaultState(SYN57).panelOrder, defaultState(NATIVE).panelOrder);
  assert.deepEqual(defaultState(SYN57).panelCollapsed, defaultState(NATIVE).panelCollapsed);
  assert.notDeepEqual(storageKeys(SYN61), storageKeys(NATIVE));
  assert.notDeepEqual(storageKeys(SYN57), storageKeys(SYN61));
});
