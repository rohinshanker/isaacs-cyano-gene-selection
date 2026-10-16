import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standardTable, expressionFixtureDataset } from './helpers.mjs';
import { compileScheme, replacementAt } from '../../site/js/core/scheme.js';
import { DEFAULT_ORGANISM } from '../../site/js/core/organisms.js';
import { indexNativeSites, neighborSiteModel } from '../../site/js/core/neighbor-sites.js';
import { evaluateTssRecoding, tssRecodingModel, tssRecodingMetrics, describeTssEdit, TSS_EDIT_KEY, TSS_EVALUATED_KEY } from '../../site/js/core/tss-recoding.js';
import { buildMetricRegistry } from '../../site/js/core/metric-registry.js';
import { computeLiveMetrics } from '../../site/js/core/live-metrics.js';
import { buildPanelExport } from '../../site/js/core/panel-export.js';
import { describePanelSources } from '../../site/js/core/panel-sources.js';
import { buildExport, parseCsv } from '../../site/js/core/export-manifest.js';
import { metricHelp } from '../../site/js/core/metric-help.js';
import { buildPanelSpace } from '../../site/js/core/panel-features.js';
import { normaliseConfig, resolveConstraints, designPanel } from '../../site/js/core/panel-design.js';
import { metricFileKeys, metricPendingState } from '../../site/js/core/data-files.js';
import { panelInputKey, constrainableMetrics } from '../../site/js/ui/panel-designer.js';
import { encodeState, decodeState, defaultState, applyDecoded, viewStateOf } from '../../site/js/core/url-state.js';
import { genomicPositions } from '../../site/js/core/gene-sequence-model.js';
import { ShortlistPanel } from '../../site/js/ui/shortlist.js';
import { renderGeneViewer } from '../../site/js/ui/gene-viewer.js';
import { GeneSequenceView } from '../../site/js/ui/gene-sequence-view.js';
import { TssEditPanel } from '../../site/js/ui/tss-recoding.js';
import { drawNeighborSiteMarks } from '../../site/js/ui/neighbor-sites.js';
import { withFakeDocument } from './fake-dom.mjs';

const table = standardTable();
const pack = (codons) => table.encode(codons.map((codon) => table.indexOf(codon)));
const gene = (extra = {}) => ({ id: 'focal', seqid: 'NZ_CP006471.1', strand: '+', start: 10, end: 24,
  lengthNt: 15, codons: pack(['GTG', 'TCG', 'TCG', 'AAA']), terminalStop: 'TAG', ...extra });
const record = (position, strand = '+', locus = 'focal', extra = {}) => ({ locus,
  source: { doi: 'study' }, layer: 'tssEvidence', row: { id: `site-${position}-${strand}`, position,
    replicon: 'NZ_CP006471.1', strand, type: 'gTSS', ...extra } });
function setup(genes = [gene()], records = [record(13), record(14), record(15), record(24)]) {
  const index = indexNativeSites(genes, records, DEFAULT_ORGANISM);
  const dataset = { genes, table, neighborSites: index };
  return { dataset, evidence: neighborSiteModel(dataset, { sources: ['TAN2018_TSS_CONTROL'] }) };
}
const scheme = (map = { TCG: 'AGC', TAG: 'TAA', GTG: 'GTT' }) => compileScheme(map, table);

test('physical identity, self/neighbor/unassigned, both strands and unchanged bases', () => {
  const records = [record(13), record(13, '+', 'other', { id: 'repeat-condition' }),
    record(13, '-', null), record(14, '+', 'other'), record(15), record(10), record(24), record(9), record(25)];
  const { dataset, evidence } = setup([gene()], records);
  const result = tssRecodingModel(dataset, scheme(), { evidence }).forGene(gene());
  assert.equal(result.evaluated, 6);
  assert.equal(result.edited, 5);
  assert.deepEqual(result.sites.find((s) => s.position === 13 && s.strand === '+').ids,
    ['site-13-+', 'repeat-condition']);
  const opposite = result.sites.find((s) => s.strand === '-');
  assert.deepEqual([opposite.original, opposite.recoded, opposite.siteOriginal, opposite.siteRecoded], ['T', 'A', 'A', 'T']);
  assert.match(describeTssEdit(opposite, gene()), /CDS \(\+\).*site strand \(-\) A → T/);
  assert.equal(result.sites.find((s) => s.position === 10).edited, false, 'non-ATG start never edited');
  assert.equal(result.sites.find((s) => s.position === 24).edited, true, 'terminal stop is edited');
  assert.equal(dataset.neighborSites.byGene.get('focal').count, 2, 'neighbor-only count preserved');
});

test('minus-strand coordinate map and site-oriented complements', () => {
  const focal = gene({ strand: '-' });
  const { dataset, evidence } = setup([focal], [record(21), record(20, '-'), record(10)]);
  const result = tssRecodingModel(dataset, scheme(), { evidence }).forGene(focal);
  assert.equal(result.edited, 3);
  const opposite = result.sites.find((s) => s.position === 21);
  assert.deepEqual([opposite.original, opposite.recoded, opposite.siteOriginal, opposite.siteRecoded], ['T', 'A', 'A', 'T']);
  assert.match(describeTssEdit(opposite, focal), /CDS \(-\)/);
});

test('split CDS excludes gaps and includes exact boundaries', () => {
  const focal = gene({ start: 10, end: 39, cdsSegments: [[10, 15], [31, 39]] });
  const { dataset, evidence } = setup([focal], [record(9), record(10), record(15), record(16), record(30), record(31), record(39), record(40)]);
  const result = tssRecodingModel(dataset, scheme(), { evidence }).forGene(focal);
  assert.deepEqual(result.sites.map((s) => s.position), [10, 15, 31, 39]);
  assert.equal(result.edited, 3);
});

test('origin-crossing CDS keeps transcription order on both strands', () => {
  const length = DEFAULT_ORGANISM.genome.replicons[0].lengthBp;
  for (const strand of ['+', '-']) {
    const focal = gene({ strand, start: 1, end: length, cdsSegments: [[1, 9], [length - 5, length]] });
    const records = [record(1), record(9), record(length - 5), record(length), record(10), record(length - 6)];
    const { dataset, evidence } = setup([focal], records);
    const result = tssRecodingModel(dataset, scheme(), { evidence }).forGene(focal);
    assert.equal(result.evaluated, 4);
    assert.equal(result.status, 'evaluated');
    const first = result.sites.find((s) => s.position === (strand === '+' ? length - 5 : 9));
    assert.equal(first.edited, false, 'origin order locates the protected start');
  }
});

test('custom distributions resolve per gene and occurrence, not the dominant replacement', () => {
  const focal = gene({ codons: pack(['GTG', ...Array(100).fill('TCG')]), end: 315, lengthNt: 306 });
  const compiled = scheme({ TCG: [['AGC', 60], ['AGT', 40]] });
  const { dataset, evidence } = setup([focal, { ...focal, id: 'copy' }], Array.from({ length: 300 }, (_, i) => record(13 + i)));
  const model = tssRecodingModel(dataset, compiled, { evidence });
  for (const row of model.forGene(focal).sites) {
    const offset = row.position - 13;
    const destination = table.codons[replacementAt(compiled, table.indexOf('TCG'), Math.floor(offset / 3))];
    assert.equal(row.recoded, destination[offset % 3]);
  }
  assert.deepEqual(model.forGene(focal).sites, model.forGene({ id: 'copy' }).sites);
  assert.deepEqual(new Set(model.forGene(focal).sites.filter((s) => (s.position - 13) % 3 === 2).map((s) => s.recoded)), new Set(['C', 'T']));
});

test('zero recorded sites and identity comparisons are evaluated, invalid coordinates are not zero', () => {
  const valid = gene();
  const { dataset, evidence } = setup([valid], []);
  assert.deepEqual([tssRecodingModel(dataset, scheme({}), { evidence }).editedCounts[0], tssRecodingModel(dataset, scheme({}), { evidence }).evaluatedCounts[0]], [0, 0]);
  for (const focal of [gene({ end: 25 }), gene({ start: 10.5, end: 24.5 }), gene({ cdsSegments: [[10, 18], [16, 21]] }), gene({ lengthNt: 18 }), gene({ codons: '?' }), gene({ strand: '?' }), gene({ codons: '' })]) {
    const result = evaluateTssRecoding(focal, table, scheme(), []);
    assert.equal(result.status, 'coordinate-invalid');
    assert.ok(Number.isNaN(result.edited));
    assert.ok(Number.isNaN(result.evaluated));
  }
  const unchanged = setup();
  const result = tssRecodingModel(unchanged.dataset, scheme({}), { evidence: unchanged.evidence }).forGene(valid);
  assert.equal(result.edited, 0);
  assert.equal(result.evaluated, 4);
  assert.ok(result.sites.every((s) => s.original === s.recoded));
});

test('loading/failure/deselection/unsupported suspend counts; scheme/payload/organism changes invalidate safely', () => {
  const { dataset, evidence } = setup();
  const active = scheme();
  const first = tssRecodingModel(dataset, active, { evidence });
  assert.equal(tssRecodingModel(dataset, active, { evidence }), first, 'no per-base reconstruction on app renders');
  for (const options of [{ sources: [] }, { sources: ['TAN2018_TSS_CONTROL'], pending: 'loading' }, { sources: ['TAN2018_TSS_CONTROL'], pending: 'failed' }, { sources: ['TAN2018_TSS_CONTROL'], sourcePending: 'failed' }]) {
    const model = tssRecodingModel(dataset, active, { evidence: neighborSiteModel(dataset, options) });
    assert.ok(Number.isNaN(model.editedCounts[0]));
    assert.ok(Number.isNaN(model.evaluatedCounts[0]));
    assert.equal(model.forGene(gene()), null);
    assert.ok(model.reason);
  }
  assert.equal(tssRecodingModel(dataset, active, { evidence }), first, 'retry restores only valid cache');
  assert.equal(tssRecodingModel(dataset, scheme({}), { evidence }).editedCounts[0], 0);
  const replacement = setup([gene()], [record(10)]);
  assert.equal(tssRecodingModel(dataset, active, { evidence: replacement.evidence }).editedCounts[0], 0);
  const unsupported = tssRecodingModel({ ...dataset, neighborSites: null }, active, { evidence: neighborSiteModel({ ...dataset, neighborSites: null }, { sources: ['TAN2018_TSS_CONTROL'] }) });
  assert.equal(unsupported.available, false);
  assert.ok(Number.isNaN(unsupported.editedCounts[0]));
});

test('registry, custom numeric filters, help, CSV per-scheme values and blank missing cells', async () => {
  const dataset = await expressionFixtureDataset();
  const focal = dataset.genes[0];
  const tcg = [...dataset.table.decode(focal.codons)].findIndex((codon, i) => i > 0 && dataset.table.codons[codon] === 'TCG');
  assert.ok(tcg > 0);
  const position = genomicPositions(focal, focal.lengthNt)[tcg * 3];
  const sites = indexNativeSites(dataset.genes, [record(position, focal.strand, focal.id)], DEFAULT_ORGANISM);
  const evidence = { available: true, index: sites };
  let model = tssRecodingModel(dataset, compileScheme({}, dataset.table), { evidence });
  const registry = buildMetricRegistry(dataset.meta, dataset.genes, computeLiveMetrics(dataset, compileScheme({}, dataset.table)).fields, tssRecodingMetrics(() => model));
  for (const key of [TSS_EDIT_KEY, TSS_EVALUATED_KEY]) {
    assert.equal(constrainableMetrics(registry).some((m) => m.key === key), false);
    const metric = registry.byKey.get(key);
    assert.match(metricHelp(metric, dataset).origin, /Tan 2018 Table S1.*active scheme/);
    assert.equal(metric.integer, true);
  }
  const result = buildExport({ dataset, registry, ids: [focal.id], schemes: [{ map: {} }, { map: { TCG: 'AGC', TAG: 'TAA' } }], tssRecodingEvidence: evidence });
  assert.equal(result.rows[0][TSS_EDIT_KEY], 0);
  assert.equal(result.rows[0][TSS_EVALUATED_KEY], 1);
  assert.equal(result.rows[1][TSS_EVALUATED_KEY], 1);
  assert.equal(result.rows[1][TSS_EDIT_KEY], 1, 'each exported scheme is recomputed independently');
  const panelExport = ShortlistPanel.prototype.buildExport.call({
    state: { ids: [focal.id], dataset, registry, tssRecodingEvidence: evidence },
    schemesToExport: () => [{ map: { TCG: 'AGC' } }], folding: { handoffs: () => [] },
  });
  assert.equal(panelExport.rows[0][TSS_EDIT_KEY], 1, 'actual shortlist panel carries the evidence gate');
  const space = buildPanelSpace({ dataset, registry, baselineFeatures: ['lengthNt'], schemeFeatures: [] });
  const design = designPanel({ dataset, registry, space, config: { size: 6, seeds: [focal.id] } });
  const sourcesFor = (tssRecodingEvidence) => describePanelSources({
    registry, config: design.config, geneCount: dataset.genes.length, tssRecodingEvidence,
  });
  const panel = buildPanelExport({ dataset, registry, design, space,
    schemes: [{ map: {} }, { map: { TCG: 'AGC' } }], tssRecodingEvidence: evidence,
    sources: sourcesFor(evidence) });
  const panelRows = panel.rows.filter((row) => row.id === focal.id);
  assert.deepEqual(panelRows.map((row) => [row[TSS_EDIT_KEY], row[TSS_EVALUATED_KEY], row.tssRecodingStatus]),
    [[0, 1, 'evaluated'], [1, 1, 'evaluated']], 'panel export recomputes each scheme using the selected evidence');
  assert.equal(panel.manifest.dataset.tssRecoding.evidenceAvailable, true);
  const deselected = { available: false, reason: 'deselected' };
  const panelMissing = buildPanelExport({ dataset, registry, design, space,
    schemes: [{ map: {} }], tssRecodingEvidence: deselected, sources: sourcesFor(deselected) });
  assert.ok(panelMissing.rows.every((row) => row[TSS_EVALUATED_KEY] === '' && row.tssRecodingReason === 'deselected'));
  assert.equal(panelMissing.manifest.dataset.tssRecoding.evidenceAvailable, false);
  assert.equal(result.rows[0].tssRecodingStatus, 'evaluated');
  assert.match(result.manifest.dataset.tssRecoding.definition, /not a prediction/);
  assert.equal(parseCsv(result.csv).rows.length, 2);
  model = tssRecodingModel(dataset, compileScheme({}, dataset.table), { evidence: { available: false, reason: 'deselected' } });
  assert.ok(Number.isNaN(registry.byKey.get(TSS_EDIT_KEY).read(0)));
  const missing = buildExport({ dataset, registry, ids: [focal.id], schemes: [{ map: {} }], tssRecodingEvidence: { available: false, reason: 'deselected' } });
  assert.equal(missing.rows[0][TSS_EDIT_KEY], '');
  assert.equal(missing.rows[0][TSS_EVALUATED_KEY], '');
  assert.equal(missing.rows[0].tssRecodingReason, 'deselected');
});

test('shared state preserves new colors and numeric range filters', () => {
  const state = defaultState();
  state.colorBy = TSS_EDIT_KEY;
  state.filters = { [TSS_EDIT_KEY]: { min: 1, max: 4, includeMissing: false } };
  state.schemeMap = { TCG: 'AGC' };
  const next = defaultState();
  applyDecoded(next, decodeState(encodeState(state)));
  assert.equal(next.colorBy, TSS_EDIT_KEY);
  assert.deepEqual(next.filters, state.filters);
  assert.deepEqual(next.schemeMap, state.schemeMap);
});

test('inspection disclosure and one-base marks state edits with text, native positions and exact bases', async () => {
  const { dataset, evidence } = setup();
  const model = tssRecodingModel(dataset, scheme(), { evidence });
  await withFakeDocument((document) => {
    const panel = new TssEditPanel();
    panel.update(model, gene());
    assert.match(panel.summary.textContent, /4 edited \/ 4 evaluated/);
    assert.equal(panel.list.children.length, 4);
    assert.match(panel.list.textContent, /Edited TSS base: T → A/);
    const root = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    drawNeighborSiteMarks(root, model.forGene(gene()).sites, gene(), (s) => s.position * 10, 20, { baseWidth: 10, baseRows: [40, 60] });
    for (const mark of root.querySelectorAll('.neighbor-site-mark')) {
      assert.equal(mark.getAttribute('data-edit-status'), 'edited');
      assert.match(mark.getAttribute('aria-label'), /Edited TSS base/);
      assert.equal(mark.querySelectorAll('.neighbor-site-base').length, 2);
      const underline = mark.querySelector('.neighbor-site-base');
      assert.equal(Number(underline.getAttribute('x2')) - Number(underline.getAttribute('x1')), 10);
    }
    panel.update(model, gene(), false);
    assert.match(panel.note.textContent, /marks are hidden/);
    panel.update(tssRecodingModel(dataset, scheme(), { evidence: { available: false, reason: 'failed' } }), gene());
    assert.match(panel.summary.textContent, /not evaluated/);
    const empty = setup([gene()], []);
    panel.update(tssRecodingModel(empty.dataset, scheme(), { evidence: empty.evidence }), gene());
    assert.match(panel.summary.textContent, /0 recorded sites/);
  });
});

test('all-site line keys name the drawn set while neighbor counts keep their own meaning', async () => {
  const { dataset, evidence } = setup();
  const comparison = tssRecodingModel(dataset, scheme(), { evidence });
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    renderGeneViewer(host, gene(), { table, tssRecoding: comparison, neighborSites: evidence });
    assert.match(host.querySelector('.gene-view-key-neighbor-site').parentNode.textContent, /Recorded Tan TSS in CDS/);
    const state = { tssRecoding: comparison, gene: gene(), markersVisible: true };
    const text = GeneSequenceView.prototype.tssLineNote.call(state);
    assert.match(text, /including self, neighbouring and unassigned associations/);
    assert.match(text, /Diamonds identify sites with edited bases/);
    assert.match(GeneSequenceView.prototype.tssLineNote.call(state, false), /TSS edit inspection/);
    assert.equal(dataset.neighborSites.byGene.get('focal').count, 0);
  });
});


test('panel hard constraints reject restored edit counts while fixed metrics keep their input contract', () => {
  const { dataset, evidence } = setup();
  let model = tssRecodingModel(dataset, scheme(), { evidence });
  const metrics = tssRecodingMetrics(() => model);
  const fixed = { key: 'lengthNt', label: 'CDS length', family: 'Genomic context', source: 'pipeline', read: () => 15 };
  const registry = { metrics: [...metrics, fixed], byKey: new Map([...metrics, fixed].map((m) => [m.key, m])) };
  assert.ok(!constrainableMetrics(registry).some((m) => m.key === TSS_EDIT_KEY));
  assert.ok(!constrainableMetrics(registry).some((m) => m.key === TSS_EVALUATED_KEY));
  for (const range of [{ min: 0, max: 0 }, { includeMissing: false }]) {
    const config = normaliseConfig({ ranges: { [TSS_EDIT_KEY]: range } });
    const resolved = resolveConstraints({ registry, config });
    assert.ok(!resolved.active.some((c) => c.key === TSS_EDIT_KEY));
    assert.match(resolved.blocked.find((c) => c.id === `range:${TSS_EDIT_KEY}`).reason, /changes with the recoding scheme/);
  }
  const config = normaliseConfig({ ranges: { [TSS_EVALUATED_KEY]: { min: 1 }, lengthNt: { min: 10 } } });
  const schemes = [{ map: { TAG: 'TAA' } }];
  const before = panelInputKey(config, schemes);
  const allowed = resolveConstraints({ registry, config });
  assert.deepEqual(allowed.active.filter((c) => c.kind === 'range').map((c) => c.key), ['lengthNt']);
  assert.match(allowed.blocked.find((c) => c.id === `range:${TSS_EVALUATED_KEY}`).reason, /selected Tan evidence/);
  const denominator = registry.byKey.get(TSS_EVALUATED_KEY).read(0);
  assert.equal(registry.byKey.get(TSS_EDIT_KEY).read(0), 4, 'interactive metric still reads active scheme');
  model = tssRecodingModel(dataset, scheme({}), { evidence });
  assert.equal(registry.byKey.get(TSS_EDIT_KEY).read(0), 0, 'interactive filtering remains available');
  assert.equal(registry.byKey.get(TSS_EVALUATED_KEY).read(0), denominator);
  assert.equal(panelInputKey(config, schemes), before, 'fixed constraints do not need display scheme in input');
  model = tssRecodingModel(dataset, scheme({}), { evidence: { available: false, reason: 'deselected' } });
  assert.ok(Number.isNaN(registry.byKey.get(TSS_EVALUATED_KEY).read(0)));
  assert.ok(!resolveConstraints({ registry, config }).active.some((c) => c.key === TSS_EVALUATED_KEY),
    'source deselection cannot silently alter an active fixed TSS constraint');
  fixed.constrainable = false;
  assert.ok(!constrainableMetrics(registry).some((m) => m.key === fixed.key));
  assert.match(resolveConstraints({ registry, config }).blocked.find((c) => c.id === 'range:lengthNt').reason,
    /cannot be a fixed panel constraint/);

});

test('scheme comparisons and per-scheme exports reuse native validation without evicting active results', async () => {
  const dataset = await expressionFixtureDataset();
  const evidence = { available: true, index: indexNativeSites(dataset.genes, [], DEFAULT_ORGANISM) };
  let decoded = 0;
  const decode = dataset.table.decode.bind(dataset.table);
  dataset.table.decode = (...args) => { decoded++; return decode(...args); };
  const active = compileScheme({ TCG: 'AGC' }, dataset.table);
  const initial = tssRecodingModel(dataset, active, { evidence });
  assert.equal(decoded, dataset.genes.length, 'every gene validated even with zero recorded sites');
  const nativeDecodes = decoded;
  for (const map of [{}, { TAG: 'TAA' }, { TCG: [['TCC', 50], ['TCT', 50]] }]) {
    const result = tssRecodingModel(dataset, compileScheme(map, dataset.table), { evidence });
    assert.equal(result.evaluatedCounts[0], 0);
  }
  assert.equal(decoded, nativeDecodes, 'changing scheme never decodes full CDSs again');
  const registry = buildMetricRegistry(dataset.meta, dataset.genes,
    computeLiveMetrics(dataset, active).fields, tssRecodingMetrics(() => initial));
  buildExport({ dataset, registry, ids: [dataset.genes[0].id], schemes: [{ map: {} }, { map: { TAG: 'TAA' } }], tssRecodingEvidence: evidence });
  assert.equal(tssRecodingModel(dataset, active, { evidence }), initial, 'export cannot evict the active model');
  const beforeReturn = decoded;
  tssRecodingModel(dataset, compileScheme({}, dataset.table), { evidence });
  assert.equal(decoded, beforeReturn, 'export preserves native preparation too');
  dataset.genes = dataset.genes.map((gene, i) => i ? gene : { ...gene, end: gene.end + 1 });
  const invalid = tssRecodingModel(dataset, active, { evidence });
  assert.ok(Number.isNaN(invalid.editedCounts[0]), 'changed gene identity is revalidated even with no sites');
  dataset.genes[0] = { ...dataset.genes[0], end: dataset.genes[0].end - 1 };
  assert.equal(tssRecodingModel(dataset, active, { evidence }).editedCounts[0], 0,
    'individual gene replacement is revalidated even inside the same genes array');
});

test('both metric keys declare both files and remain pending whichever payload is delayed', () => {
  for (const metric of tssRecodingMetrics(() => null)) {
    assert.deepEqual(metricFileKeys(metric), ['tssEvidence', 'regulatoryTss']);
    for (const key of metricFileKeys(metric)) {
      const dataset = { files: { tssEvidence: { state: 'ready' }, regulatoryTss: { state: 'ready' } } };
      dataset.files[key].state = 'loading';
      assert.equal(metricPendingState(dataset, metric), 'loading');
      dataset.files[key].state = 'failed';
      assert.equal(metricPendingState(dataset, metric), 'failed');
      dataset.files[key].state = 'ready';
      assert.equal(metricPendingState(dataset, metric), null);
    }
  }
});
