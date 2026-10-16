/**
 * A panel is bound to the data sources it was designed from: a material source
 * change marks it stale, and its export keeps the captured values and names
 * the sources that chose it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLiveMetrics } from '../../site/js/core/live-metrics.js';
import { compileScheme } from '../../site/js/core/scheme.js';
import { buildMetricRegistry } from '../../site/js/core/metric-registry.js';
import { parseCsv } from '../../site/js/core/export-manifest.js';
import { buildPanelSpace, defaultBaselineFeatures } from '../../site/js/core/panel-features.js';
import { designPanel, resolveConstraints, normaliseConfig } from '../../site/js/core/panel-design.js';
import {
  buildPanelExport, describeSchemes, readPanelDesign, LEGACY_PANEL_DESIGN_VERSION, PANEL_DESIGN_VERSION,
} from '../../site/js/core/panel-export.js';
import {
  datasetDefinition, describePanelSources, designMetricSourcesCell, freezeMetric, freezeRegistry,
  panelDecidingKeys, panelSourceKey, panelSourceStateId,
} from '../../site/js/core/panel-sources.js';
import { buildTypeMetrics, typeKeyFor } from '../../site/js/core/type-metrics.js';
import { createSourceSelectionResolver } from '../../site/js/core/source-selection.js';
import { PanelDesigner, staleResultMessage } from '../../site/js/ui/panel-designer.js';
import { dataset as sourceDataset } from './data-sources-fixture.mjs';
import { withFakeDocument } from './fake-dom.mjs';
import { expressionFixtureDataset } from './helpers.mjs';

const WHEN = new Date('2026-10-15T12:00:00Z');
const SYN61 = { TCG: 'AGC', TCA: 'AGT', TAG: 'TAA' };

/**
 * The expression fixture with four measured datasets: two pooling abundance
 * sets (A, B) and two non-pooling initiation conditions (C, D). Values live in
 * mutable arrays so a test can change a number, remove one, or land a file.
 */
async function world() {
  const dataset = await expressionFixtureDataset();
  const n = dataset.genes.length;
  const values = {
    srcA: Array.from({ length: n }, (_, i) => ((i * 37) % 101) + 1),
    srcB: Array.from({ length: n }, (_, i) => ((i * 53) % 97) + 0.5),
    srcC: Array.from({ length: n }, (_, i) => (i % 3 === 0 ? NaN : (i * 29) % 89)),
    // Still loading: every value unknown until the test lands it.
    srcD: Array.from({ length: n }, () => NaN),
  };
  const datasets = [
    sourceDataset({ id: 'A', datasetId: 'A', metricKey: 'srcA', group: 'standard', source: { sha256: 'a'.repeat(64) } }),
    sourceDataset({ id: 'B', datasetId: 'B', metricKey: 'srcB', group: 'stress' }),
    sourceDataset({ id: 'C', datasetId: 'C', metricKey: 'srcC', quantity: 'tss_initiation', group: 'standard' }),
    sourceDataset({ id: 'D', datasetId: 'D', metricKey: 'srcD', quantity: 'tss_initiation', group: 'other' }),
  ];
  const own = datasets.map((entry) => ({
    key: entry.metricKey,
    label: `${entry.id} values`,
    unit: 'counts',
    family: 'Expression',
    source: 'pipeline',
    provenance: { id: entry.id, isTargetOrganism: true, condition: entry.id },
    read: (index) => values[entry.metricKey][index],
  }));
  const live = computeLiveMetrics(dataset, compileScheme({}, dataset.table)).fields;
  const registry = buildMetricRegistry(dataset.meta, dataset.genes, live, own);
  const sel = { selection: ['A', 'B', 'C'], typeSources: {} };
  const resolve = createSourceSelectionResolver();
  const sources = () => resolve(datasets, sel.selection, sel.typeSources);
  const types = buildTypeMetrics(datasets, {
    contributing: (key) => sources().contributing(key),
    metricOf: (entry) => registry.byKey.get(entry.metricKey) ?? null,
    selected: (key) => sources().selected(key),
    geneCount: n,
  });
  registry.metrics.unshift(...types);
  for (const metric of types) registry.byKey.set(metric.key, metric);
  // The panel sees the registry as the selectors do: no dataset's own metric.
  const scoped = () => ({ ...registry, metrics: registry.metrics.filter((m) => !own.some((o) => o.key === m.key)) });
  return {
    dataset, datasets, values, registry, scoped, sel, sources,
    abundance: typeKeyFor(datasets[0]),
    initiation: typeKeyFor(datasets[2]),
  };
}

function describe(w, config) {
  return describePanelSources({
    registry: w.scoped(), config: normaliseConfig(config), geneCount: w.dataset.genes.length,
    sources: w.sources(), typeSources: w.sel.typeSources,
  });
}

function design(w, config, schemes = describeSchemes([{ name: 'Syn61', map: SYN61 }])) {
  const normalised = normaliseConfig(config);
  const registry = freezeRegistry(w.scoped(), w.dataset.genes.length, Object.keys(normalised.ranges));
  const schemeFields = new Map(schemes.map((scheme) => [scheme.schemeId, computeLiveMetrics(
    w.dataset, compileScheme(scheme.map, w.dataset.table), { baseline: w.dataset.baseline },
  ).fields]));
  const space = buildPanelSpace({
    dataset: w.dataset, registry, schemes, schemeFields, allowBorrowed: normalised.allowBorrowedExpression,
  });
  const sources = describePanelSources({
    registry, config: normalised, geneCount: w.dataset.genes.length,
    sources: w.sources(), typeSources: w.sel.typeSources,
  });
  return {
    registry, schemes, space, sources,
    design: designPanel({ dataset: w.dataset, registry, space, config: normalised }),
  };
}

test('a frozen metric keeps its values, getters and availability after the live one changes', async () => {
  const w = await world();
  const live = w.registry.byKey.get(w.abundance);
  const frozen = freezeMetric(live, w.dataset.genes.length);
  const before = [0, 1, 2].map((i) => frozen.read(i));
  assert.equal(frozen.pooled, true);
  assert.match(frozen.provenance.id, /^pooled: A, B$/);
  w.sel.selection = ['A', 'C'];
  assert.equal(live.pooled, false, 'the live metric follows the new selection');
  assert.deepEqual([0, 1, 2].map((i) => frozen.read(i)), before);
  assert.equal(frozen.pooled, true);
  assert.ok(Number.isNaN(frozen.read(-1)) && Number.isNaN(frozen.read(1e9)), 'out of range is unknown');

  let reason = 'loading';
  const withReason = freezeMetric({ key: 'r', read: () => 0, availabilityReason: () => reason }, 2);
  reason = 'ready';
  assert.equal(withReason.availabilityReason(), 'loading');
  assert.equal(withReason.read(0), 0, 'zero stays zero, never unknown');
});

test('a frozen registry offers the listed metrics plus extra keys, and nothing live', async () => {
  const w = await world();
  const scoped = w.scoped();
  const frozen = freezeRegistry(scoped, w.dataset.genes.length, ['srcC', 'not-a-metric']);
  assert.equal(frozen.metrics.length, scoped.metrics.length);
  assert.ok(frozen.byKey.has('srcC'), 'an extra key the list does not offer is frozen too');
  assert.ok(!frozen.byKey.has('srcA'), 'an unlisted dataset metric is absent, not live');
  assert.ok(!frozen.byKey.has('not-a-metric'));
  assert.equal(frozen.byKey.get(w.abundance), frozen.metrics.find((m) => m.key === w.abundance));
  assert.ok(Object.isFrozen(frozen.byKey.get(w.abundance)));
});

test('deciding keys are the constrained metrics and the default features, once each', async () => {
  const w = await world();
  const keys = panelDecidingKeys(w.scoped(), normaliseConfig({ ranges: { gc3: {}, [w.initiation]: { min: 1 } } }));
  assert.deepEqual(keys.slice(0, 2), ['gc3', w.initiation]);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.includes('cai') && keys.includes('lengthCodons'));
});

test('a dataset definition carries identity and checksum, with null for what is unrecorded', async () => {
  const w = await world();
  assert.deepEqual(datasetDefinition(w.datasets[0]), {
    id: 'A', metricKey: 'srcA', studyId: 'A', conditionSet: 'A set 1', dataType: 'transcriptomics',
    platform: 'RNA-seq', quantity: null, file: null, sha256: 'a'.repeat(64),
  });
  assert.equal(datasetDefinition({ id: 'X', metricKey: 'x' }).studyId, null);
});

test('material selection, numeric, missingness and readiness changes change the source key', async () => {
  const w = await world();
  const config = { ranges: { [w.abundance]: { min: 0.2 }, [w.initiation]: { min: 1, includeMissing: false } } };
  const captured = describe(w, config);
  const key = panelSourceKey(captured);
  const changed = (label) => assert.notEqual(panelSourceKey(describe(w, config)), key, label);
  const same = (label) => assert.equal(panelSourceKey(describe(w, config)), key, label);

  const initiation = captured.metrics.find((entry) => entry.key === w.initiation);
  assert.equal(initiation.reading, 'single');
  assert.deepEqual(initiation.contributing.map((entry) => entry.id), ['C']);
  assert.equal(initiation.missingCount, w.dataset.genes.filter((_, i) => i % 3 === 0).length);
  assert.equal(captured.metrics.find((entry) => entry.key === w.abundance).reading, 'pooled');

  // Reordering and noise in the selection are no change.
  w.sel.selection = ['C', 'B', 'A', 'B', 'nonexistent'];
  same('reorder and noise');

  // Pooled to individual: naming one abundance dataset.
  w.sel.typeSources = { [w.abundance]: 'B' };
  changed('pooled to individual');
  w.sel.typeSources = {};
  same('back to pooled');

  // A numeric change in a contributing dataset.
  const old = w.values.srcA[5];
  w.values.srcA[5] = old + 1000;
  changed('numeric');
  w.values.srcA[5] = old;
  same('numeric restored');

  // Zero and unknown are different values.
  const index = w.values.srcC.findIndex((value) => value === 0);
  assert.ok(index >= 0, 'the fixture has a measured zero');
  w.values.srcC[index] = NaN;
  changed('zero to unknown');
  w.values.srcC[index] = 0;
  same('unknown back to zero');

  // Adding the still-loading initiation condition, then its file landing.
  w.sel.selection = ['A', 'B', 'C', 'D'];
  changed('another non-pooled condition selected changes which datasets are selected');
  const withD = panelSourceKey(describe(w, config));
  w.values.srcD = w.values.srcD.map((_, i) => i);
  assert.equal(panelSourceKey(describe(w, config)), withD,
    'D is selected but not read: initiation still reads C alone');
  w.sel.typeSources = { [w.initiation]: 'D' };
  const readingD = panelSourceKey(describe(w, config));
  w.values.srcD = w.values.srcD.map(() => NaN);
  assert.notEqual(panelSourceKey(describe(w, config)), readingD, 'readiness of the dataset read');

  // No initiation dataset at all: the constraint reads nothing.
  w.sel.selection = ['A', 'B'];
  w.sel.typeSources = {};
  const none = describe(w, config).metrics.find((entry) => entry.key === w.initiation);
  assert.equal(none.reading, 'none');
  assert.equal(none.valueCount, 0);
  assert.equal(none.borrowed, null, 'no dataset read, so neither native nor borrowed');
  assert.equal(initiation.borrowed, false);
  assert.equal(designMetricSourcesCell(describe(w, config)), `${w.abundance}=pooled:A+B; ${w.initiation}=none`);
});

test('a source change no deciding metric reads, and TSS readiness, are judged correctly', async () => {
  const w = await world();
  const config = { ranges: { gc3: { max: 0.9 } } };
  const key = panelSourceKey(describe(w, config));
  w.sel.selection = ['A', 'C'];
  assert.equal(panelSourceKey(describe(w, config)), key, 'no deciding metric reads a type');
  assert.equal(designMetricSourcesCell(describe(w, config)), 'none');

  const base = { registry: w.scoped(), config: normaliseConfig(config), geneCount: w.dataset.genes.length };
  const loading = describePanelSources({ ...base, tssRecodingEvidence: { available: false, reason: 'loading' } });
  const ready = describePanelSources({ ...base, tssRecodingEvidence: { available: true, reason: null } });
  assert.notEqual(panelSourceKey(loading), panelSourceKey(ready));
  assert.deepEqual(describePanelSources(base).tssRecodingEvidence, { available: false, reason: null });
  assert.equal(describePanelSources(base).metrics.every((entry) => !entry.reading), true,
    'without membership no type metric is described as reading anything');
});

test('a constrained metric missing from the registry is described, not dropped', async () => {
  const w = await world();
  const description = describe(w, { ranges: { vanished: { min: 1 } } });
  assert.deepEqual(description.metrics[0], { key: 'vanished', available: false });
});

test('a type constraint with no selected dataset is blocked with that reason', async () => {
  const w = await world();
  w.sel.selection = ['A', 'B'];
  const config = normaliseConfig({ ranges: { [w.initiation]: { min: 1, includeMissing: false } } });
  const constraints = resolveConstraints({ registry: w.scoped(), config });
  assert.equal(constraints.active.length, 2, 'only the two default flags remain active');
  const [blocked] = constraints.blocked;
  assert.equal(blocked.id, `range:${w.initiation}`);
  assert.match(blocked.reason, /No .* dataset is selected under Data Sources/);
  assert.doesNotMatch(blocked.reason, /another organism/);
  // A permissive row is still inert rather than blocked.
  const inert = resolveConstraints({
    registry: w.scoped(), config: normaliseConfig({ ranges: { [w.initiation]: {} } }),
  });
  assert.equal(inert.blocked.length, 0);
});

test('the export keeps the captured values and names its sources after the selection changes', async () => {
  const w = await world();
  const config = {
    size: 7,
    ranges: { [w.abundance]: { min: 0.1 }, [w.initiation]: { min: 1, includeMissing: false } },
  };
  const made = design(w, config);
  const evidence = {
    available: true, reason: null, index: { byGene: new Map() },
    siteCounts: Float64Array.from(w.dataset.genes, (_, i) => i % 4),
  };
  const exportNow = () => buildPanelExport({
    dataset: w.dataset, registry: made.registry, design: made.design, space: made.space,
    schemes: made.schemes, generatedAt: WHEN, sources: made.sources,
    tssRecodingEvidence: evidence, neighborSiteCounts: evidence.siteCounts,
  });
  const first = exportNow();

  // Every source changes after the design: values, membership and naming.
  w.values.srcA = w.values.srcA.map((value) => value * 3 + 1);
  w.values.srcC = w.values.srcC.map(() => NaN);
  w.sel.selection = ['A', 'D'];
  w.sel.typeSources = { [w.initiation]: 'D' };
  const second = exportNow();
  assert.equal(second.csv, first.csv, 'the captured export does not drift');
  assert.equal(second.manifest.manifestId, first.manifest.manifestId);

  const { rows } = parseCsv(first.csv);
  const capturedIds = rows.map((row) => row.id);
  assert.deepEqual([...new Set(capturedIds)], made.design.selected);
  for (const row of rows) {
    const index = w.dataset.indexById.get(row.id);
    assert.equal(row.designSourceStateId, panelSourceStateId(made.sources));
    assert.equal(row.designMetricSources, `${w.abundance}=pooled:A+B; ${w.initiation}=single:C`);
    assert.equal(row.neighborTssSitesInCds, String(index % 4), 'evaluated evidence is exported');
    assert.equal(Number(row[w.initiation]), made.registry.byKey.get(w.initiation).read(index));
  }
  const block = first.manifest.panelDesign.sourceSelection;
  assert.equal(block.stateId, panelSourceStateId(made.sources));
  assert.deepEqual(block.selection, ['A', 'B', 'C']);
  assert.deepEqual(block.metrics.find((entry) => entry.key === w.initiation).contributing.map((d) => d.id), ['C']);
  assert.ok(first.manifest.expressionSources !== undefined);
});

test('unavailable TSS evidence exports blank neighbour counts, never zeros', async () => {
  const w = await world();
  const made = design(w, { ranges: { gc3: { max: 0.9 } } });
  const result = buildPanelExport({
    dataset: w.dataset, registry: made.registry, design: made.design, space: made.space,
    schemes: made.schemes, generatedAt: WHEN, sources: made.sources,
    tssRecodingEvidence: { available: false, reason: 'not loaded' }, neighborSiteCounts: null,
  });
  for (const row of parseCsv(result.csv).rows) assert.equal(row.neighborTssSitesInCds, '');
  assert.equal(result.manifest.dataset.tssRecoding.evidenceAvailable, false);
});

test('the manifest round-trips the selection, policies and schemes that rebuild the same panel', async () => {
  const w = await world();
  w.sel.typeSources = { [w.abundance]: 'B' };
  const config = {
    size: 8,
    seeds: [w.dataset.genes[3].id],
    ranges: {
      [w.abundance]: { min: 20, max: 90, includeMissing: true },
      [w.initiation]: { min: 1, includeMissing: false },
    },
  };
  const schemes = describeSchemes([{ name: 'Syn61', map: SYN61 }, { name: 'Amber', map: { TAG: 'TAA' } }]);
  const made = design(w, config, schemes);
  const exported = buildPanelExport({
    dataset: w.dataset, registry: made.registry, design: made.design, space: made.space,
    schemes: made.schemes, generatedAt: WHEN, sources: made.sources,
  });
  const manifest = JSON.parse(exported.files.find((file) => file.name.endsWith('.json')).content);
  const restored = readPanelDesign(manifest);
  assert.deepEqual(restored.sources.selection, ['A', 'B', 'C']);
  assert.deepEqual(restored.sources.typeSources, { [w.abundance]: 'B' });
  assert.deepEqual(restored.config.ranges[w.initiation], { min: 1, max: null, includeMissing: false });
  assert.deepEqual(restored.config.ranges[w.abundance], { min: 20, max: 90, includeMissing: true });
  assert.deepEqual(restored.schemes.map((scheme) => scheme.name), ['Syn61', 'Amber']);

  // The reader wanders off, then restores the recorded selection.
  w.sel.selection = ['A'];
  w.sel.typeSources = {};
  assert.notEqual(panelSourceKey(describe(w, restored.config)), panelSourceKey(restored.sources));
  w.sel.selection = restored.sources.selection;
  w.sel.typeSources = restored.sources.typeSources;
  assert.equal(panelSourceKey(describe(w, restored.config)), panelSourceKey(restored.sources),
    'the recorded sources reproduce the same deciding values');
  const rebuilt = design(w, restored.config, describeSchemes(restored.schemes));
  assert.deepEqual(rebuilt.design.selected, made.design.selected);
  assert.deepEqual(rebuilt.space.keys, restored.features);
});

test('an export needs captured sources, and a legacy manifest never borrows today\'s', async () => {
  const w = await world();
  const made = design(w, { ranges: { gc3: { max: 0.9 } } });
  const options = {
    dataset: w.dataset, registry: made.registry, design: made.design, space: made.space,
    schemes: made.schemes, generatedAt: WHEN,
  };
  assert.throws(() => buildPanelExport(options), /needs the data sources captured/);

  const { manifest } = buildPanelExport({ ...options, sources: made.sources });
  assert.equal(manifest.panelDesign.panelDesignVersion, PANEL_DESIGN_VERSION);
  assert.equal(readPanelDesign(manifest).legacy, false);

  // A version 1 manifest has no sources; it reads back as legacy, with none.
  const { sourceSelection: _sources, ...v1 } = manifest.panelDesign;
  const legacy = readPanelDesign({
    ...manifest, panelDesign: { ...v1, panelDesignVersion: LEGACY_PANEL_DESIGN_VERSION },
  });
  assert.equal(legacy.legacy, true);
  assert.equal(legacy.sources, null);
  assert.deepEqual(legacy.selected, made.design.selected);

  // A current-version manifest that lost its sources is refused, not filled in.
  assert.throws(() => readPanelDesign({ ...manifest, panelDesign: v1 }), /no captured data sources/);
  assert.throws(() => readPanelDesign({ ...manifest, panelDesign: { ...v1, panelDesignVersion: 3 } }),
    /version 3 is not version 2 or legacy version 1/);
});

test('freezing keeps shared provenance, the borrowed representative and the panel unchanged', async () => {
  const dataset = await expressionFixtureDataset();
  const live = computeLiveMetrics(dataset, compileScheme({}, dataset.table)).fields;
  const registry = buildMetricRegistry(dataset.meta, dataset.genes, live);
  const frozen = freezeRegistry(registry, dataset.genes.length);
  const shared = registry.metrics.filter((metric) => metric.provenance
    && registry.metrics.some((other) => other !== metric && other.provenance === metric.provenance));
  assert.ok(shared.length >= 2, 'the fixture has a raw measurement and its rank sharing one source');
  for (const metric of shared) {
    assert.equal(frozen.byKey.get(metric.key).provenance, metric.provenance, 'the same source object');
  }
  for (const allowBorrowed of [false, true]) {
    assert.deepEqual(defaultBaselineFeatures(frozen, allowBorrowed), defaultBaselineFeatures(registry, allowBorrowed));
    const config = normaliseConfig({ size: 8, allowBorrowedExpression: allowBorrowed });
    const schemes = describeSchemes([{ name: 'Syn61', map: SYN61 }]);
    const schemeFields = new Map(schemes.map((scheme) => [scheme.schemeId, computeLiveMetrics(
      dataset, compileScheme(scheme.map, dataset.table), { baseline: dataset.baseline },
    ).fields]));
    const panelOf = (reg) => designPanel({
      dataset, registry: reg, config,
      space: buildPanelSpace({ dataset, registry: reg, schemes, schemeFields, allowBorrowed }),
    }).selected;
    assert.deepEqual(panelOf(frozen), panelOf(registry), `same panel, borrowed ${allowBorrowed}`);
  }
});

test('the stale message names what changed', () => {
  assert.equal(staleResultMessage({ settingsChanged: false, sourcesChanged: false }), null);
  assert.equal(staleResultMessage({ settingsChanged: true, sourcesChanged: false }).heading, 'Settings changed');
  assert.equal(staleResultMessage({ settingsChanged: false, sourcesChanged: true }).heading, 'Data sources changed');
  const both = staleResultMessage({ settingsChanged: true, sourcesChanged: true });
  assert.equal(both.heading, 'Settings and data sources changed');
  assert.match(both.detail, /data sources and values captured by the last design/);
  assert.match(staleResultMessage({ settingsChanged: true, sourcesChanged: false }).detail,
    /^These results and exports still use the settings from the last design\./);
});

function textOf(node) {
  if (!node) return '';
  if (node.nodeType === 3) return node.textContent;
  return node.children?.length ? node.children.map(textOf).join('') : (node.textContent ?? '');
}

/** The result's disclosure summaries: what a reader sees with every one collapsed. */
function summaries(designer) {
  return designer.resultHost.querySelectorAll('summary').map(textOf);
}

/** The stale heading shown as a summary, or null while the result is current. */
function staleHeading(designer) {
  return summaries(designer).find((text) => / changed$/.test(text)) ?? null;
}

test('the designer marks a source change stale, keeps its panel, and regenerates explicitly', async () => {
  const w = await world();
  await withFakeDocument(async (document) => {
    const host = document.createElement('div');
    document.body.append(host);
    const announced = [];
    const designer = new PanelDesigner(host, {
      onSelect: () => {}, onAnnounce: (message) => announced.push(message), onShortlist: () => {},
    });
    designer.resultHost.scrollIntoView = () => {};
    const evidence = { available: true, reason: null, siteCounts: new Float64Array(w.dataset.genes.length) };
    const update = () => designer.update({
      dataset: w.dataset, registry: w.scoped(), schemes: { active: { name: '', map: SYN61 }, saved: [] },
      shortlist: [], pinnedId: null, tssRecodingEvidence: evidence,
      sources: w.sources(), typeSources: w.sel.typeSources,
    });
    update();
    designer.config = normaliseConfig({
      ranges: { [w.initiation]: { min: 1, includeMissing: false } },
    });
    designer.run();
    const chosen = [...designer.design.selected];
    const capturedKey = designer.captured.sourceKey;
    assert.equal(designer.captured.neighborSiteCounts, evidence.siteCounts);
    assert.equal(staleHeading(designer), null);

    // An unrelated source change and a visual re-render are not stale.
    w.sel.selection = ['A', 'C'];
    update();
    assert.equal(staleHeading(designer), null);

    // Deselecting the constrained type's dataset is.
    w.sel.selection = ['A', 'B'];
    update();
    assert.equal(staleHeading(designer), 'Data sources changed');
    assert.deepEqual(designer.design.selected, chosen, 'the old panel stays until regenerated');
    assert.equal(designer.captured.sourceKey, capturedKey);

    // A settings change on top names both.
    designer.config = normaliseConfig({ ...designer.config, size: 9 });
    designer.renderResult();
    assert.equal(staleHeading(designer), 'Settings and data sources changed');

    // Regenerating captures the new sources and reports the blocked constraint.
    designer.run();
    assert.equal(staleHeading(designer), null);
    assert.notEqual(designer.captured.sourceKey, capturedKey);
    assert.ok(summaries(designer).includes('1 constraint not applied'));
    assert.match(textOf(designer.resultHost), /No .* dataset is selected under Data Sources/);
    assert.equal(designer.design.config.size, 9);
    assert.ok(announced.some((message) => /Panel of 9 genes designed/.test(message)));

    // Evidence still loading at design time captures no counts, and its
    // arrival is a readiness change to the captured export.
    designer.update({ ...designer.state, tssRecodingEvidence: { available: false, reason: 'loading' } });
    designer.run();
    assert.equal(designer.captured.neighborSiteCounts, null, 'unavailable evidence captures no counts');
    designer.update({ ...designer.state, tssRecodingEvidence: evidence });
    assert.equal(staleHeading(designer), 'Data sources changed');
  });
});

function findById(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

test('the range editor says a deselected type has no dataset, and keeps native and borrowed labels', async () => {
  const w = await world();
  // D measured in another organism: the borrowed positive control.
  w.registry.byKey.get('srcD').provenance = { id: 'D', isTargetOrganism: false, condition: 'D' };
  await withFakeDocument(async (document) => {
    const host = document.createElement('div');
    document.body.append(host);
    const designer = new PanelDesigner(host, { onSelect: () => {}, onAnnounce: () => {}, onShortlist: () => {} });
    const update = () => designer.update({
      dataset: w.dataset, registry: w.scoped(), schemes: { active: { name: '', map: {} }, saved: [] },
      shortlist: [], pinnedId: null, sources: w.sources(), typeSources: w.sel.typeSources,
    });
    designer.config = normaliseConfig({ ranges: { [w.initiation]: { min: 1, includeMissing: false } } });
    const rangeNotes = () => designer.form.querySelectorAll('.filter-row')
      .flatMap((row) => row.querySelectorAll('summary')).map(textOf);
    const borrowedList = () => {
      const note = findById(designer.form, 'panel-borrowed-note');
      return note ? note.querySelectorAll('li').map(textOf) : [];
    };
    const initiationLabel = w.registry.byKey.get(w.initiation).label;

    // Native: the constraint reads C, so it carries no source disclosure at all.
    update();
    assert.deepEqual(rangeNotes(), []);
    assert.ok(!borrowedList().includes(initiationLabel));

    // Deselected: no dataset, never "borrowed", and the reason is spelled out.
    w.sel.selection = ['A', 'B'];
    update();
    assert.deepEqual(rangeNotes(), ['No dataset selected']);
    assert.match(textOf(designer.form.querySelector('.filter-row')),
      /No Transcription initiation \(RNA-seq\) dataset is selected under Data Sources, so this constraint cannot apply/);
    assert.ok(!borrowedList().includes(initiationLabel), 'not listed as borrowed');

    // Switching borrowed expression on and off keeps the retained constraint.
    const toggle = findById(designer.form, 'panel-allow-borrowed');
    toggle.checked = true; toggle.dispatch('change');
    toggle.checked = false; findById(designer.form, 'panel-allow-borrowed').dispatch('change');
    assert.ok(Object.hasOwn(designer.config.ranges, w.initiation), 'the constraint is not silently dropped');

    // Borrowed: reading D, measured elsewhere, is labelled borrowed.
    w.sel.selection = ['A', 'B', 'D'];
    update();
    assert.deepEqual(rangeNotes(), ['Borrowed measurement']);
    assert.ok(borrowedList().includes(initiationLabel));
  });
});
