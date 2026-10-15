/**
 * The low-traffic threshold pools datasets the way colouring does, can hold
 * its own selection without touching colouring, and explains itself inside one
 * collapsed Provenance box.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dataset } from './data-sources-fixture.mjs';
import { withFakeDocument } from './fake-dom.mjs';
import { buildTypeMetrics, contributingDatasets } from '../../site/js/core/type-metrics.js';
import { createAxisContributorResolver } from '../../site/js/core/axis-sources.js';
import {
  FilterPanel, trafficScale, trafficScaleKind, trafficThresholdLabel, trafficThresholdReadout, provenanceLinks,
  clearedFilterState,
} from '../../site/js/ui/filters.js';
import {
  encodeState, decodeState, applyDecoded, defaultState,
} from '../../site/js/core/url-state.js';

const KEY = 'type.transcriptomics.rna-seq.abundance';

function fixture() {
  const all = [
    dataset({ id: 'GSE205444', datasetId: 'GSE205444', metricKey: 'expression', group: 'biofilm' }),
    dataset({ id: 'GSE9', row: 5, group: 'standard' }),
    dataset({ id: 'GSE7', row: 2, group: 'standard' }),
  ];
  const values = { expression: [1, 2, 3, 4], [all[1].metricKey]: [30, 10, NaN, 5], [all[2].metricKey]: [0.5, 0.1, 0.9, 0.3] };
  const metricsByKey = new Map(all.map((d, i) => [d.metricKey, {
    key: d.metricKey, unit: ['counts', 'TPM', 'RPKM'][i], desc: d.id, scale: 'sequential', family: 'Expression',
    provenance: { id: d.id, organism: 'PCC 7942', condition: `c${i}`, isTargetOrganism: false,
      record: { studyId: d.id, archiveUrl: `https://example.org/${d.id}` } },
    read: (g) => values[d.metricKey][g],
  }]));
  return { all, metricOf: (d) => metricsByKey.get(d.metricKey) ?? null };
}

test('the threshold pools its own datasets exactly as colouring pools the same ones', () => {
  const { all, metricOf } = fixture();
  const selection = all.map((d) => d.id);
  const [colour] = buildTypeMetrics(all, {
    contributing: (key) => contributingDatasets(key, {}, all, selection), metricOf, geneCount: 4,
  });
  const resolve = createAxisContributorResolver();
  let own = [...selection];
  const readers = { metricOf, resourceStateOf: () => null };
  const [threshold] = buildTypeMetrics(all, {
    contributing: (key) => resolve(key, own, all, readers).available, metricOf, geneCount: 4,
  });
  assert.equal(threshold.pooled, true);
  for (let g = 0; g < 4; g += 1) assert.equal(threshold.read(g), colour.read(g), `gene ${g}`);
  assert.equal(trafficScale(threshold), 'pooled percentile, 0 to 1, over 3 datasets');

  // A different selection changes only the threshold's metric.
  own = [all[1].id];
  assert.equal(threshold.pooled, false);
  assert.equal(threshold.read(0), 30);
  assert.equal(colour.pooled, true, 'colouring keeps its own selection');
  assert.equal(trafficScale(threshold), 'TPM');

  // A loading contributor is requested but left out, never read as zero.
  own = [all[1].id, all[2].id];
  const pending = createAxisContributorResolver();
  const loading = pending(KEY, own, all, { metricOf, resourceStateOf: (m) => (m.unit === 'RPKM' ? 'loading' : null) });
  assert.deepEqual(loading.available.map((d) => d.id), [all[1].id]);
  assert.equal(loading.state, 'loading');
});

test('pooled scales are named briefly in the slider label and readout', () => {
  const pooled = { label: 'Transcript abundance (RNA-seq)', unit: 'pooled percentile across 2 datasets: mean of …',
    pooled: true, provenance: { pooling: { kind: 'percentile', datasetCount: 2 } } };
  assert.equal(trafficThresholdLabel(pooled),
    'Hide genes below: Transcript abundance (RNA-seq) (pooled percentile, 0 to 1, over 2 datasets)');
  assert.match(trafficThresholdReadout({ ...pooled, integer: false }, 0.25, 10, 40),
    /pooled percentile, 0 to 1, over 2 datasets — keeps 10 of 40 genes with a value/);
  assert.equal(trafficScale({ unit: 'index' }), 'index');
  const three = { ...pooled, provenance: { pooling: { kind: 'percentile', datasetCount: 3 } } };
  assert.equal(trafficScaleKind(pooled), trafficScaleKind(three), 'pool size does not change the scale');
  assert.notEqual(trafficScaleKind(pooled), trafficScaleKind({ unit: 'TPM' }));
  assert.notEqual(trafficScaleKind({ unit: 'CPM' }), trafficScaleKind({ unit: 'TPM' }));
  assert.deepEqual(provenanceLinks({ sourceLinks: [{ label: 'A', url: 'https://a' }, { label: 'A', url: 'https://a' }],
    record: { studyId: 'B', archiveUrl: 'https://b' } }).map((l) => l.url), ['https://a', 'https://b']);
  assert.deepEqual(provenanceLinks({ record: { archiveUrl: 'javascript:alert(1)' } }), [], 'only web links');
});

test('the threshold\'s datasets round-trip through a link and are cleared with the filters', () => {
  const state = { ...defaultState(), trafficKey: KEY, trafficSources: ['GSE9.5', 'GSE7.2'] };
  const hash = encodeState(state);
  assert.match(hash, /tds=GSE9\.5%2CGSE7\.2/);
  assert.deepEqual(applyDecoded(defaultState(), decodeState(hash)).trafficSources, ['GSE9.5', 'GSE7.2']);
  assert.ok(!encodeState(defaultState()).includes('tds='), 'no own selection writes nothing');
  assert.equal(applyDecoded(defaultState(), decodeState('#ver=9&p=native')).trafficSources, null);
  assert.equal(clearedFilterState().trafficSources, null);
});

function panelState(overrides = {}) {
  const metric = {
    key: KEY, label: 'Transcript abundance (RNA-seq)', unit: 'TPM', family: 'Expression', integer: false,
    provenance: { id: 'GSE9.5', organism: 'PCC 7942', condition: 'BG-11', isTargetOrganism: false,
      record: { studyId: 'GSE9', archiveUrl: 'https://example.org/GSE9' } },
    read: (i) => [5, 10, 20, NaN][i],
  };
  const registry = { metrics: [metric], byKey: new Map([[KEY, metric]]), families: ['Expression'] };
  return {
    registry, filters: {}, count: 4, passing: 4, missingHidden: new Map(),
    exceptionFilter: 'any', exceptionCount: 0, expressionFilter: 'any',
    basisCounts: { counts: new Map(), recorded: false }, trafficKey: KEY, categoryFilter: [],
    proteinFilter: 'any', proteinEvidence: null, colorMetricKey: 'gc3', followColor: false,
    trafficMetricFor: () => metric,
    trafficSelectionFor: () => ({ label: 'Pooled (2 of 3 datasets)', choosable: true,
      notice: '1 still loading of the 2 datasets; the threshold uses the 1 that can be read.',
      explanation: 'These datasets were chosen for this threshold alone; colouring keeps its own selection.' }),
    ...overrides,
  };
}

test('the threshold section keeps its controls outside one collapsed Provenance box', async () => {
  await withFakeDocument(async (document) => {
    const host = document.createElement('div');
    document.body.append(host);
    const chosen = [];
    const panel = new FilterPanel(host, {
      onChange: () => {}, onClear: () => {}, onExceptionFilterChange: () => {}, onExpressionFilterChange: () => {},
      onTrafficKeyChange: () => {}, onTrafficFollowChange: () => {}, onProteinFilterChange: () => {},
      onChooseTrafficDatasets: (key) => chosen.push(key),
    });
    panel.update(panelState());
    const traffic = host.querySelector('section.traffic-filter');
    const boxes = traffic.querySelectorAll('details.tan-disclosure');
    assert.equal(boxes.length, 1, 'one box, nothing nested');
    const box = boxes[0];
    assert.equal(box.querySelector('summary').textContent, 'Provenance');
    assert.equal(box.open, false, 'closed by default');
    const inside = box.textContent;
    assert.match(inside, /chosen for this threshold alone/);
    assert.match(inside, /a different organism/);
    assert.match(inside, /Condition: BG-11/);
    assert.match(inside, /Threshold scale: TPM\. With this selection 3 of 4 genes have a threshold value/);
    assert.equal(box.querySelector('a').href, 'https://example.org/GSE9');
    // Outside the box: the dataset summary, its control, the notice and the slider.
    const outside = [...traffic.children].filter((node) => node !== box).map((node) => node.textContent).join(' ');
    assert.match(outside, /Datasets: Pooled \(2 of 3 datasets\)/);
    assert.match(outside, /1 still loading/);
    const choose = traffic.querySelectorAll('button').find((b) => b.textContent === 'Choose datasets');
    assert.ok(choose);
    choose.dispatch('click');
    assert.deepEqual(chosen, [KEY]);
    assert.ok(traffic.querySelectorAll('input').some((input) => input.id === 'traffic-threshold'));

    // The open state survives an unrelated update.
    box.open = true;
    box.dispatch('toggle');
    panel.update(panelState({ passing: 3 }));
    assert.equal(host.querySelector('section.traffic-filter').querySelector('details.tan-disclosure').open, true);

    // Following colour: no chooser, and the box says the colour metric is read.
    panel.update(panelState({ followColor: true, colorMetricKey: KEY,
      trafficSelectionFor: () => ({ label: 'Pooled (2 of 3 datasets)', choosable: true, notice: null, explanation: null }) }));
    const following = host.querySelector('section.traffic-filter');
    assert.equal(following.querySelectorAll('button').find((b) => b.textContent === 'Choose datasets'), undefined);
    assert.match(following.textContent, /Same datasets as colouring: Pooled/);
    assert.match(following.querySelector('details').textContent, /reads the colouring metric itself/);
  });
});

test('Use same source as colouring is link state, so a saved own pool survives a reload (R1)', () => {
  const state = { ...defaultState(), trafficKey: KEY, trafficSources: ['GSE9.5'], trafficFollowsColor: false };
  const hash = encodeState(state);
  assert.match(hash, /(^|&)tf=0(&|$)/);
  const restored = applyDecoded(defaultState(), decodeState(hash));
  assert.equal(restored.trafficFollowsColor, false);
  assert.deepEqual(restored.trafficSources, ['GSE9.5']);
  assert.ok(!encodeState(defaultState()).includes('tf='), 'following, the fresh view, writes nothing');
  assert.equal(applyDecoded(defaultState(), decodeState('#ver=9&p=native')).trafficFollowsColor, true);
});

test('a pool with a contributor still loading keeps its pooled scale (R2)', () => {
  const { all, metricOf } = fixture();
  const resolve = createAxisContributorResolver();
  const own = [all[1].id, all[2].id];
  const loadingUnit = 'RPKM';
  const readers = { metricOf, resourceStateOf: (m) => (m.unit === loadingUnit ? 'loading' : null) };
  // As app.js builds it: every requested dataset with a registry metric.
  const [threshold] = buildTypeMetrics(all, {
    contributing: (key) => resolve(key, own, all, readers).requested.filter((d) => metricOf(d)),
    metricOf: (d) => {
      const metric = metricOf(d);
      return metric.unit === loadingUnit ? { ...metric, read: () => Number.NaN } : metric;
    },
    geneCount: 4,
  });
  assert.equal(threshold.pooled, true, 'still a pool of two');
  assert.equal(trafficScaleKind(threshold), 'pooled:percentile');
  assert.ok(threshold.read(0) >= 0 && threshold.read(0) <= 1, 'a percentile, not raw units');
});

test('focus inside the Provenance box survives a redraw (R7)', async () => {
  await withFakeDocument(async (document) => {
    const host = document.createElement('div');
    document.body.append(host);
    const panel = new FilterPanel(host, {
      onChange: () => {}, onClear: () => {}, onExceptionFilterChange: () => {}, onExpressionFilterChange: () => {},
      onTrafficKeyChange: () => {}, onTrafficFollowChange: () => {}, onProteinFilterChange: () => {},
      onChooseTrafficDatasets: () => {},
    });
    panel.update(panelState());
    const box = () => host.querySelector('section.traffic-filter').querySelector('details.tan-disclosure');
    box().open = true;
    box().dispatch('toggle');
    box().querySelector('a').focus();
    panel.update(panelState({ passing: 2 }));
    assert.equal(document.activeElement, box().querySelector('a'), 'the link in the new box has focus');
    box().querySelector('summary').focus();
    panel.update(panelState({ passing: 1 }));
    assert.equal(document.activeElement, box().querySelector('summary'));
  });
});
