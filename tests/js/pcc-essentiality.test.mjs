/**
 * The PCC 7942 essentiality colour and filter: the status-to-bucket mapping,
 * the per-CDS model over the shipped calls, its pending states, the filter,
 * the colour key, the Filters fieldset, the help, the link, the export, and
 * that none of it reaches an organism without the calls.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PCC_COLOURED_BUCKET_COUNT, PCC_ESSENTIALITY_BUCKETS, PCC_ESSENTIALITY_BUCKET_IDS,
  PCC_ESSENTIALITY_COLOR_KEY, PCC_ESSENTIALITY_LABEL, PCC_ESSENTIALITY_STATUSES,
  describeBucketStatuses, normalizePccEssentialitySelection, passesPccEssentialityFilter,
  pccBucketIdAt, pccBucketPosition, pccPendingSentence, resolvePccEssentiality,
  togglePccEssentialitySelection,
} from '../../site/js/core/pcc-essentiality.js';
import { validateCandidateEvidence } from '../../site/js/core/candidate-evidence.js';
import {
  CATEGORY_FILTER_IDS, passesCategoryFilter, joinFunctionCategories,
} from '../../site/js/core/function-categories.js';
import { OVERLAP_CLASS_IDS } from '../../site/js/core/gene-overlaps.js';
import {
  CATEGORY_UNKNOWN_COLOR, PCC_ESSENTIALITY_COLORS, PENDING_CATEGORY_COLOR,
  buildPccEssentialityColorScale,
} from '../../site/js/ui/colors.js';
import { renderPccEssentialityLegend } from '../../site/js/ui/legend.js';
import { FilterPanel, clearedFilterState } from '../../site/js/ui/filters.js';
import { filterBannerText } from '../../site/js/ui/axis-copy.js';
import { pccEssentialityHelp } from '../../site/js/core/metric-help.js';
import {
  applyDecoded, decodeState, defaultState, encodeState, viewStateOf,
} from '../../site/js/core/url-state.js';
import { DEFAULT_ORGANISM, ORGANISMS, layerOf } from '../../site/js/core/organisms.js';
import { loadDataset } from '../../site/js/core/dataset.js';
import { computeLiveMetrics } from '../../site/js/core/live-metrics.js';
import { compileScheme } from '../../site/js/core/scheme.js';
import { buildMetricRegistry } from '../../site/js/core/metric-registry.js';
import { buildExport, identityColumnsFor, parseCsv } from '../../site/js/core/export-manifest.js';
import { withFakeDocument } from './fake-dom.mjs';
import { fileFetch } from './helpers.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../../site/data/${name}`, import.meta.url)));
const evidence = read('candidate_evidence.json');
const genes = read('genes.json');
const ECOLI = ORGANISMS.find((organism) => organism.id !== DEFAULT_ORGANISM.id);
const COPY = layerOf(DEFAULT_ORGANISM, 'candidateEvidence').essentialityColour;

/** The shipped model, built once. */
const shipped = resolvePccEssentiality({ candidateEvidence: evidence, genes });

/** A three-CDS dataset with one call of each kind the tests need. */
function tinyEvidence(statuses) {
  return {
    borrowedEssentiality: {
      status: 'available',
      source: { rubinCondition: 'PCC 7942 study conditions.' },
      byLocus: Object.fromEntries(statuses.map((status, i) => [`G${i}`, { status }])),
    },
  };
}
const tinyGenes = (count) => Array.from({ length: count }, (_, i) => ({ id: `G${i}` }));

test('every source status falls in exactly one bucket, and unresolved is never non-essential', () => {
  assert.deepEqual(PCC_ESSENTIALITY_BUCKET_IDS,
    ['essential', 'beneficial', 'non-essential', 'unresolved']);
  assert.deepEqual(PCC_ESSENTIALITY_BUCKETS.map((bucket) => bucket.label),
    ['Essential', 'Beneficial', 'Non-essential', 'Unresolved']);
  const listed = PCC_ESSENTIALITY_BUCKETS.flatMap((bucket) => bucket.statuses);
  assert.deepEqual([...listed].sort(), [...PCC_ESSENTIALITY_STATUSES].sort());
  assert.equal(new Set(listed).size, listed.length);
  // The vocabulary is the admitted data's own, not a second copy that can drift.
  assert.deepEqual(PCC_ESSENTIALITY_STATUSES, read('pcc7942-essentiality-v1.json')
    .joinPolicy.statusVocabulary);
  const expected = {
    essential: 0, beneficial: 1, 'non-essential': 2,
    ambiguous: 3, not_analyzed: 3, missing: 3, unknown: 3,
  };
  for (const [status, position] of Object.entries(expected)) {
    assert.equal(pccBucketPosition(status), position, status);
  }
  for (const bad of ['Essential', 'nonessential', '', undefined, null]) {
    assert.throws(() => pccBucketPosition(bad), /Unknown PCC 7942 essentiality status/);
  }
  // No bucket id collides with another categorical channel's, so one preview
  // channel can serve all three.
  for (const id of PCC_ESSENTIALITY_BUCKET_IDS) {
    assert.ok(!CATEGORY_FILTER_IDS.includes(id) && !OVERLAP_CLASS_IDS.includes(id), id);
  }
});

test('the shipped calls resolve to the published counts, each exact status kept', () => {
  assert.equal(validateCandidateEvidence(evidence, genes, evidence.annotationRelease), evidence);
  const { byStatus } = evidence.borrowedEssentiality.summary;
  assert.equal(shipped.pending, null);
  assert.deepEqual(shipped.statusCounts, byStatus);
  assert.deepEqual([...shipped.counts], [
    byStatus.essential, byStatus.beneficial, byStatus['non-essential'],
    byStatus.ambiguous + byStatus.not_analyzed + byStatus.missing + byStatus.unknown,
  ]);
  assert.deepEqual([...shipped.counts], [660, 154, 1617, 284]);
  assert.equal(shipped.source, evidence.borrowedEssentiality.source);
  for (let i = 0; i < genes.length; i += 1) {
    const { status } = evidence.borrowedEssentiality.byLocus[genes[i].id];
    const position = pccBucketPosition(status);
    assert.equal(shipped.positions[i], position);
    assert.equal(pccBucketIdAt(shipped, i), PCC_ESSENTIALITY_BUCKET_IDS[position]);
    // Unresolved takes the open no-value ring, never a call's colour.
    assert.equal(shipped.values[i], position < PCC_COLOURED_BUCKET_COUNT ? position : -1);
  }
  assert.equal(shipped.values.filter((value) => value === -1).length, 284);
});

test('a CDS with no record, or a status outside the vocabulary, fails closed', () => {
  assert.throws(() => resolvePccEssentiality({
    candidateEvidence: tinyEvidence(['essential']), genes: tinyGenes(2),
  }), /No PCC 7942 essentiality record for G1/);
  assert.throws(() => resolvePccEssentiality({
    candidateEvidence: tinyEvidence(['essential', 'lethal']), genes: tinyGenes(2),
  }), /Unknown PCC 7942 essentiality status: lethal/);
});

test('loading, failed and absent calls class no CDS and hide no gene', () => {
  for (const [pending, candidateEvidence] of [
    ['loading', null], ['failed', null], [null, null], ['loading', evidence],
  ]) {
    const model = resolvePccEssentiality({ candidateEvidence, genes, pending });
    assert.equal(model.pending, pending ?? 'absent');
    assert.equal(model.positions, null);
    assert.ok(model.values.every((value) => value === PCC_COLOURED_BUCKET_COUNT),
      'every CDS sits in the one not-loaded bucket');
    assert.deepEqual([...model.counts], [0, 0, 0, 0]);
    assert.equal(pccBucketIdAt(model, 0), null);
    assert.ok(passesPccEssentialityFilter(model, 0, ['essential']),
      'a held selection waits for the calls instead of hiding everything');
  }
  assert.match(pccPendingSentence('loading'), /still loading/);
  assert.match(pccPendingSentence('failed'), /could not be loaded.*Retry/);
  assert.match(pccPendingSentence('absent'), /does not publish/);
});

test('late calls: a selection held while loading applies exactly once they land', () => {
  const candidateEvidence = tinyEvidence(['essential', 'missing', 'non-essential', 'unknown']);
  const g = tinyGenes(4);
  const selection = ['unresolved'];
  const before = resolvePccEssentiality({ candidateEvidence: null, genes: g, pending: 'loading' });
  assert.deepEqual(g.map((_, i) => passesPccEssentialityFilter(before, i, selection)),
    [true, true, true, true]);
  const after = resolvePccEssentiality({ candidateEvidence, genes: g });
  assert.deepEqual(g.map((_, i) => passesPccEssentialityFilter(after, i, selection)),
    [false, true, false, true]);
});

test('the filter is OR across buckets, empty keeps all, and selections normalise', () => {
  const kept = (selection) => genes.filter((_, i) => passesPccEssentialityFilter(shipped, i, selection)).length;
  assert.equal(kept([]), genes.length);
  assert.equal(kept(null), genes.length);
  assert.equal(kept(['essential']), 660);
  assert.equal(kept(['essential', 'beneficial']), 814);
  assert.equal(kept(['unresolved']), 284);
  assert.equal(kept(PCC_ESSENTIALITY_BUCKET_IDS), genes.length);
  assert.deepEqual(normalizePccEssentialitySelection(
    ['unresolved', 'bogus', 'essential', 'essential', 'ambiguous']), ['essential', 'unresolved']);
  assert.deepEqual(normalizePccEssentialitySelection(undefined), []);
  assert.deepEqual(togglePccEssentialitySelection(['essential'], 'beneficial'),
    ['beneficial', 'essential']);
  assert.deepEqual(togglePccEssentialitySelection(['beneficial', 'essential'], 'essential'),
    ['beneficial']);
  assert.deepEqual(togglePccEssentialitySelection(undefined, 'nope'), []);
});

test('the essentiality and function-category selections combine independently', () => {
  const reviewed = joinFunctionCategories(read('function-categories-v1.json'), genes,
    evidence.annotationRelease);
  const category = ['photosynthetic-light-reactions'];
  const both = genes.filter((_, i) => passesCategoryFilter(reviewed, i, category)
    && passesPccEssentialityFilter(shipped, i, ['essential']));
  const categoryOnly = genes.filter((_, i) => passesCategoryFilter(reviewed, i, category));
  // Each narrows only by its own channel: the intersection is exactly the
  // category's genes whose call is essential, whatever either colour shows.
  assert.ok(categoryOnly.length > 0);
  assert.deepEqual(both.map((gene) => gene.id), categoryOnly
    .filter((gene) => evidence.borrowedEssentiality.byLocus[gene.id].status === 'essential')
    .map((gene) => gene.id));
});

test('the colour scale has three call colours, a pending neutral, and no unresolved colour', () => {
  const scale = buildPccEssentialityColorScale();
  assert.deepEqual(scale.buckets, PCC_ESSENTIALITY_COLORS);
  assert.equal(scale.categorical, true);
  assert.deepEqual([0, 1, 2, -1, 3].map((value) => scale.bucketOf(value)), [0, 1, 2, -1, -1]);
  const pending = buildPccEssentialityColorScale({ pending: true });
  assert.deepEqual(pending.buckets, [...PCC_ESSENTIALITY_COLORS, PENDING_CATEGORY_COLOR]);
  assert.equal(pending.bucketOf(3), 3);
  assert.equal(new Set([...PCC_ESSENTIALITY_COLORS, PENDING_CATEGORY_COLOR,
    CATEGORY_UNKNOWN_COLOR]).size, 5, 'no call shares the unknown or pending grey');
});

test('the colour key counts each bucket, lists unresolved statuses and toggles the selection', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    const controls = document.createElement('div');
    document.body.append(host, controls);
    const events = [];
    const state = {
      scale: buildPccEssentialityColorScale(), model: shipped, note: COPY.legendNote,
      controlsHost: controls, selected: ['beneficial'],
      onHoverCategory: (id) => events.push(['hover', id]),
      onFocusCategory: (id) => events.push(['focus', id]),
      onToggleCategory: (id) => events.push(['toggle', id]),
      onResetCategoryFilter: () => events.push(['reset']),
    };
    renderPccEssentialityLegend(host, state);
    assert.equal(host.querySelector('p.legend-title').textContent,
      `${PCC_ESSENTIALITY_LABEL} (whole CDS set)`);
    const rows = host.querySelectorAll('div.category-legend-row');
    assert.deepEqual(rows.map((row) => row.textContent.trim()), [
      'Essential (660)', 'Beneficial (154)', 'Non-essential (1,617)', 'Unresolved (284)',
    ]);
    assert.deepEqual(rows.map((row) => row.getAttribute('aria-checked')),
      ['false', 'true', 'false', 'false']);
    assert.deepEqual(rows.map((row) => row.getAttribute('role')), Array(4).fill('checkbox'));
    // Unresolved draws the open ring, the calls a bordered filled circle.
    const circles = rows.map((row) => row.querySelector('circle'));
    assert.equal(circles[3].getAttribute('fill'), 'none');
    assert.equal(circles[3].getAttribute('stroke'), CATEGORY_UNKNOWN_COLOR);
    assert.deepEqual(circles.slice(0, 3).map((circle) => circle.getAttribute('fill')),
      PCC_ESSENTIALITY_COLORS);
    assert.match(rows[3].title, /ambiguous 71, not analysed 1, missing source call 39, no admitted join 173/);
    const text = host.textContent;
    assert.match(text, /Unresolved: ambiguous 71, not analysed 1, missing source call 39, no admitted join 173\./);
    assert.match(text, /cross-strain assumption, not a UTEX measurement/);
    assert.match(text, /unresolved is never non-essential/);
    assert.match(controls.textContent, /Hover or focus a call to preview it/);
    rows[2].dispatch('mouseenter');
    rows[2].dispatch('mouseleave');
    rows[0].dispatch('focus');
    rows[0].dispatch('blur');
    rows[3].click();
    let prevented = false;
    rows[0].dispatch('keydown', { key: 'Enter', preventDefault: () => { prevented = true; } });
    rows[0].dispatch('keydown', { key: 'a', preventDefault: () => assert.fail('only Enter/Space') });
    const reset = host.querySelector('button.category-legend-reset');
    assert.equal(reset.textContent, 'Clear essentiality selection');
    assert.equal(reset.disabled, false);
    reset.click();
    assert.ok(prevented);
    assert.deepEqual(events, [
      ['hover', 'non-essential'], ['hover', null], ['focus', 'essential'], ['focus', null],
      ['toggle', 'unresolved'], ['toggle', 'essential'], ['reset'],
    ]);
    // Rebuilding keeps the keyboard on the row that held it.
    host.querySelectorAll('div.category-legend-row')[2].focus();
    renderPccEssentialityLegend(host, { ...state, selected: [] });
    assert.equal(document.activeElement.dataset.categoryId, 'non-essential');
    assert.equal(host.querySelector('button.category-legend-reset').disabled, true);
  });
});

test('the colour key names excluded markers only when filtered genes are drawn', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    document.body.append(host);
    const base = {
      scale: buildPccEssentialityColorScale(), model: shipped, note: COPY.legendNote,
      hiddenCalledCount: 12, hiddenUnresolvedCount: 3,
    };
    renderPccEssentialityLegend(host, base);
    assert.match(host.textContent, /Excluded, with a call: grey outlined square \(12\)/);
    assert.match(host.textContent, /Excluded, unresolved: grey dot \(3\)/);
    renderPccEssentialityLegend(host, { ...base, showHidden: false });
    assert.doesNotMatch(host.textContent, /Excluded/);
    renderPccEssentialityLegend(host, { ...base, markerConventions: false });
    assert.doesNotMatch(host.textContent, /Excluded/, 'the chromosome view states its own');
    renderPccEssentialityLegend(host, { ...base, hiddenCalledCount: 0, hiddenUnresolvedCount: 0 });
    assert.doesNotMatch(host.textContent, /Excluded/);
  });
});

test('a pending colour key shows no rows or counts and says a held selection waits', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    document.body.append(host);
    for (const pending of ['loading', 'failed', 'absent']) {
      const model = resolvePccEssentiality({ candidateEvidence: null, genes, pending: pending === 'absent' ? null : pending });
      const scale = buildPccEssentialityColorScale({ pending: true });
      renderPccEssentialityLegend(host, { scale, model, note: COPY.legendNote, selected: [] });
      assert.equal(host.querySelectorAll('div.category-legend-row').length, 0);
      const status = host.querySelector('li.evidence-pending');
      assert.equal(status.dataset.pending, pending);
      assert.equal(status.getAttribute('role'), 'status');
      assert.equal(status.querySelector('circle').getAttribute('fill'), PENDING_CATEGORY_COLOR);
      assert.match(status.textContent, new RegExp(pccPendingSentence(pending).slice(0, 30)));
      assert.doesNotMatch(host.textContent, /\(\d/);
      assert.doesNotMatch(host.textContent, /is held/);
      assert.match(host.textContent, /cross-strain assumption/);
      renderPccEssentialityLegend(host, { scale, model, note: COPY.legendNote, selected: ['essential'] });
      assert.match(host.textContent, /An essentiality selection is held and hides no gene/);
    }
  });
});

/** A Filters panel with every channel quiet, and the essentiality fieldset under test. */
function panelState(overrides = {}) {
  return {
    registry: { metrics: [], byKey: new Map(), families: [] },
    filters: {},
    count: genes.length,
    passing: genes.length,
    missingHidden: new Map(),
    exceptionFilter: 'any',
    exceptionCount: 0,
    expressionFilter: 'any',
    basisCounts: null,
    trafficKey: null,
    proteinFilter: 'any',
    proteinEvidence: null,
    proteinEvidencePending: null,
    categoryFilter: [],
    overlapClassFilter: [],
    overlapCounts: null,
    pccEssentiality: { model: shipped, note: COPY.filterNote },
    pccEssentialityFilter: [],
    ...overrides,
  };
}

test('the Filters fieldset offers each bucket with its count, independent of Colour by', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    document.body.append(host);
    const chosen = [];
    const panel = new FilterPanel(host, {
      onChange: () => {}, onClear: () => {}, onExceptionFilterChange: () => {},
      onExpressionFilterChange: () => {}, onProteinFilterChange: () => {},
      onTrafficKeyChange: () => {},
      onPccEssentialityFilterChange: (selection) => chosen.push(selection),
    });
    for (const colorMetricKey of ['functionCategory', 'gc3', PCC_ESSENTIALITY_COLOR_KEY]) {
      panel.update(panelState({ colorMetricKey }));
      const fieldset = host.querySelector('div.essentiality-filter').querySelector('fieldset');
      assert.equal(fieldset.querySelector('legend').textContent, PCC_ESSENTIALITY_LABEL);
      assert.deepEqual(fieldset.querySelectorAll('label').map((node) => node.textContent), [
        'Essential (660)', 'Beneficial (154)', 'Non-essential (1,617)', 'Unresolved (284)',
      ]);
    }
    const fieldset = host.querySelector('div.essentiality-filter');
    const boxes = fieldset.querySelectorAll('input');
    assert.deepEqual(boxes.map((node) => node.type), Array(4).fill('checkbox'));
    assert.deepEqual(boxes.map((node) => node.checked), [false, false, false, false]);
    assert.ok(boxes.every((node) => !node.disabled));
    assert.match(fieldset.textContent, /cross-strain\s+assumption/);
    assert.match(fieldset.textContent, /Independent of Colour by/);
    assert.match(fieldset.textContent, /Unresolved: ambiguous 71/);
    boxes[1].dispatch('change');
    assert.deepEqual(chosen.at(-1), ['beneficial']);
    panel.update(panelState({ pccEssentialityFilter: ['beneficial', 'unresolved'] }));
    const checked = host.querySelector('div.essentiality-filter').querySelectorAll('input');
    assert.deepEqual(checked.map((node) => node.checked), [false, true, false, true]);
    checked[3].dispatch('change');
    assert.deepEqual(chosen.at(-1), ['beneficial'], 'unchecking removes only that bucket');
    assert.equal(panel.clearButton.disabled, false, 'Clear all filters clears it too');
    panel.update(panelState());
    assert.equal(panel.clearButton.disabled, true);
  });
});

test('the Filters fieldset withholds counts while pending and keeps a held box clearable', async () => {
  await withFakeDocument((document) => {
    const panel = Object.create(FilterPanel.prototype);
    panel.essentialityHost = document.createElement('div');
    const chosen = [];
    panel.handlers = { onPccEssentialityFilterChange: (selection) => chosen.push(selection) };
    document.body.append(panel.essentialityHost);
    const loading = resolvePccEssentiality({ candidateEvidence: null, genes, pending: 'loading' });
    panel.renderPccEssentialityFilter(panelState({
      pccEssentiality: { model: loading, note: COPY.filterNote }, pccEssentialityFilter: ['essential'],
    }));
    const inputs = panel.essentialityHost.querySelectorAll('input');
    assert.deepEqual(panel.essentialityHost.querySelectorAll('label').map((node) => node.textContent),
      ['Essential', 'Beneficial', 'Non-essential', 'Unresolved']);
    assert.deepEqual(inputs.map((node) => node.disabled), [false, true, true, true]);
    assert.match(panel.essentialityHost.textContent, /still loading/);
    assert.match(panel.essentialityHost.textContent, /saved essentiality filter is paused/);
    inputs[0].dispatch('change');
    assert.deepEqual(chosen, [[]]);
    // An organism without the calls has no fieldset at all.
    panel.renderPccEssentialityFilter(panelState({ pccEssentiality: null }));
    assert.equal(panel.essentialityHost.children.length, 0);
    // A rebuild keeps focus on the box the reader is toggling.
    panel.renderPccEssentialityFilter(panelState());
    panel.essentialityHost.querySelectorAll('input')[2].focus();
    panel.renderPccEssentialityFilter(panelState({ pccEssentialityFilter: ['non-essential'] }));
    assert.equal(document.activeElement.value, 'non-essential');
    assert.equal(document.activeElement.checked, true);
  });
  assert.deepEqual(clearedFilterState().pccEssentialityFilter, []);
});

test('the explanation states assay, assumption and every count, or why it cannot', () => {
  const help = pccEssentialityHelp(shipped, DEFAULT_ORGANISM);
  assert.equal(help.title, PCC_ESSENTIALITY_LABEL);
  assert.equal(help.unit, 'category (not a numeric metric)');
  assert.match(help.method, /Beneficial means insertions reduced PCC 7942 fitness/);
  assert.match(help.method, /never non-essential/);
  assert.match(help.method, /Tested UTEX alleles and GO IEA context never change this colour/);
  assert.match(help.origin, /30 C in BG-11/);
  assert.match(help.origin, /assumption, not a UTEX measurement/);
  assert.match(help.origin, /different growth optima/);
  assert.equal(help.coverage, 'Of 2,715 plotted CDSs: 660 essential, 154 beneficial, 1,617 '
    + 'non-essential, and 284 unresolved (ambiguous 71, not analysed 1, missing source call 39, '
    + 'no admitted join 173).');
  assert.deepEqual(help.citations,
    ['rubin-2015-assessed', 'adomako-2022-essentiality', 'ungerer-2018-mbio-growth']);
  const citations = new Set(read('citations.json').sections
    .flatMap((section) => section.items ?? []).map((item) => item.id));
  for (const id of help.citations) assert.ok(citations.has(id), id);
  const failed = pccEssentialityHelp(
    resolvePccEssentiality({ candidateEvidence: null, genes, pending: 'failed' }), DEFAULT_ORGANISM,
  );
  assert.match(failed.coverage, /^Not counted: The PCC 7942 essentiality calls could not be loaded/);
  assert.equal(pccEssentialityHelp(shipped, ECOLI), null);
  assert.equal(describeBucketStatuses(PCC_ESSENTIALITY_BUCKETS[0], {}), 'essential 0');
});

test('excluded unresolved genes are named as dots in the filter banner', () => {
  const banner = (colorBy) => filterBannerText({
    hidden: 4, total: 10, showHidden: true, projectionAvailable: true, projectionMessage: null,
    colorBy, functionColorKey: 'functionCategory',
  });
  assert.match(banner(PCC_ESSENTIALITY_COLOR_KEY), /grey dots and outlined squares/);
  assert.match(banner('gc3'), /; grey outlined squares remain/);
});

test('the link keeps the selection, drops unknown ids and ignores it for other organisms', () => {
  const state = defaultState();
  assert.deepEqual(state.pccEssentialityFilter, []);
  assert.doesNotMatch(encodeState(state), /pe=/, 'an empty selection writes no field');
  state.colorBy = PCC_ESSENTIALITY_COLOR_KEY;
  state.pccEssentialityFilter = ['unresolved', 'essential'];
  state.categoryFilter = ['stress-and-repair'];
  const hash = encodeState(state);
  assert.match(hash, /pe=essential%2Cunresolved/);
  assert.match(hash, /c=pccEssentiality/);
  const decoded = decodeState(`#${hash}`);
  assert.deepEqual(decoded.pccEssentialityFilter, ['essential', 'unresolved']);
  assert.deepEqual(decoded.categoryFilter, ['stress-and-repair'], 'the channels stay separate');
  assert.equal(decoded.colorBy, PCC_ESSENTIALITY_COLOR_KEY);
  assert.deepEqual(decodeState('#ver=7&pe=bogus,beneficial,beneficial').pccEssentialityFilter,
    ['beneficial']);
  // Back to an older entry with no field: the selection is cleared, not kept.
  const target = applyDecoded(defaultState(), decoded);
  applyDecoded(target, decodeState('#ver=7&p=native'));
  assert.deepEqual(target.pccEssentialityFilter, []);
  // The manifest's view state records it under the organism that has it.
  assert.deepEqual(viewStateOf(state).pccEssentialityFilter, ['essential', 'unresolved']);
  // An organism without the calls neither reads nor writes it.
  assert.equal(layerOf(ECOLI, 'candidateEvidence'), null);
  assert.equal(decodeState(`#${hash}`, ECOLI).pccEssentialityFilter, undefined);
  assert.doesNotMatch(encodeState(state, ECOLI), /pe=/);
  assert.equal('pccEssentialityFilter' in viewStateOf(state, ECOLI), false);
});

test('only the default organism declares the essentiality copy', () => {
  for (const organism of ORGANISMS) {
    const copy = layerOf(organism, 'candidateEvidence')?.essentialityColour ?? null;
    assert.equal(Boolean(copy), organism === DEFAULT_ORGANISM, organism.id);
  }
});

test('the export keeps exact statuses beside the display bucket and records the grouping', async () => {
  const dataset = await loadDataset({
    baseUrl: new URL('../../site/data/', import.meta.url).href, fetchImpl: fileFetch(),
  });
  const live = computeLiveMetrics(dataset, compileScheme({}, dataset.table)).fields;
  const registry = buildMetricRegistry(dataset.meta, dataset.genes, live);
  // One locus per exact status.
  const ids = PCC_ESSENTIALITY_STATUSES.map((status) => dataset.genes
    .find((gene) => dataset.candidateEvidence.borrowedEssentiality.byLocus[gene.id].status === status).id);
  const model = resolvePccEssentiality({ candidateEvidence: dataset.candidateEvidence, genes: dataset.genes });
  const selection = ['essential', 'unresolved'];
  const filterMask = Uint8Array.from(dataset.genes,
    (_, i) => (passesPccEssentialityFilter(model, i, selection) ? 1 : 0));
  const state = { ...defaultState(), colorBy: PCC_ESSENTIALITY_COLOR_KEY, colorScale: null,
    pccEssentialityFilter: selection };
  const result = buildExport({
    dataset, registry, ids, schemes: [{ map: {} }], generatedAt: new Date('2026-10-12T00:00:00Z'),
    filterState: { pcc7942Essentiality: selection }, filterMask, viewState: viewStateOf(state),
  });
  const parsed = parseCsv(result.csv);
  assert.ok(parsed.header.includes('pcc7942EssentialityBucket'));
  assert.equal(parsed.header.indexOf('pcc7942EssentialityBucket'),
    parsed.header.indexOf('pcc7942Essentiality') + 1);
  assert.deepEqual(parsed.rows.map((row) => row.pcc7942Essentiality), PCC_ESSENTIALITY_STATUSES);
  assert.deepEqual(parsed.rows.map((row) => row.pcc7942EssentialityBucket), [
    'Essential', 'Beneficial', 'Non-essential',
    'Unresolved', 'Unresolved', 'Unresolved', 'Unresolved',
  ]);
  assert.deepEqual(parsed.rows.map((row) => row.passesCurrentFilters),
    ['true', 'false', 'false', 'true', 'true', 'true', 'true']);
  const { manifest } = result;
  assert.deepEqual(manifest.dataset.candidateEvidence.borrowedEssentiality.displayBuckets,
    PCC_ESSENTIALITY_BUCKETS.map((bucket) => ({
      id: bucket.id, label: bucket.label, statuses: [...bucket.statuses],
    })));
  assert.deepEqual(manifest.filterState, { pcc7942Essentiality: selection });
  assert.equal(manifest.viewState.colorBy, PCC_ESSENTIALITY_COLOR_KEY);
  assert.deepEqual(manifest.viewState.pccEssentialityFilter, selection);
  assert.deepEqual(manifest.genes.map((gene) => gene.pcc7942Essentiality.status),
    PCC_ESSENTIALITY_STATUSES);
  assert.match(manifest.caveats.join(' '), /pcc7942EssentialityBucket groups ambiguous, not_analyzed, missing and unknown as Unresolved/);
  // Reading the manifest's view state back reproduces the exported view.
  const restored = applyDecoded(defaultState(), decodeState(`#${encodeState({
    ...defaultState(), ...manifest.viewState,
  })}`));
  assert.equal(restored.colorBy, PCC_ESSENTIALITY_COLOR_KEY);
  assert.deepEqual(restored.pccEssentialityFilter, selection);
  // Another organism's export carries no essentiality column.
  assert.ok(!identityColumnsFor(ECOLI).includes('pcc7942EssentialityBucket'));
});
