/**
 * The filter panel's live path: a slider movement reports through
 * `onLiveChange` and rebuilds nothing; the release reports through `onChange`;
 * an update that arrives mid-gesture keeps the control the reader is holding.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withFakeDocument } from './fake-dom.mjs';
import { FilterPanel } from '../../site/js/ui/filters.js';

const VALUES = { gc3: [0.2, 0.4, 0.6, 0.8, NaN], cai: [0.1, 0.3, 0.5, 0.7, 0.9] };

function metric(key, label, family) {
  return {
    key, label, unit: 'fraction', family, source: 'pipeline', integer: false, scale: 'sequential',
    desc: `${label} description.`, read: (index) => VALUES[key][index],
  };
}

function registry() {
  const metrics = [metric('gc3', 'GC3', 'Base composition'), metric('cai', 'CAI', 'Translation')];
  return { metrics, byKey: new Map(metrics.map((m) => [m.key, m])), families: ['Base composition', 'Translation'] };
}

function state(filters) {
  return {
    registry: registry(), filters, count: 5, passing: 5, missingHidden: new Map(),
    exceptionFilter: 'any', exceptionCount: 0, expressionFilter: 'any',
    basisCounts: { counts: new Map(), recorded: false }, trafficKey: null, categoryFilter: [],
    proteinFilter: 'any', proteinEvidence: null, proteinEvidencePending: null,
    colorMetricKey: 'gc3', followColor: true,
  };
}

function mount(document) {
  const host = document.createElement('div');
  document.body.append(host);
  const calls = { live: [], change: [] };
  const panel = new FilterPanel(host, {
    onChange: (filters) => calls.change.push(filters),
    onLiveChange: (filters) => calls.live.push(filters),
    onClear: () => {}, onExceptionFilterChange: () => {}, onExpressionFilterChange: () => {},
    onTrafficKeyChange: () => {}, onTrafficFollowChange: () => {}, onSelectSource: () => {},
    onProteinFilterChange: () => {},
  });
  return { host, panel, calls };
}

const thumbs = (host) => host.querySelectorAll('input.range-slider-thumb');

test('a metric range row carries a two-thumb slider in step with its fields', async () => {
  await withFakeDocument(async (document) => {
    const { host, panel, calls } = mount(document);
    panel.update(state({ gc3: { min: 0.3, max: null, includeMissing: true } }));
    const [min, max] = thumbs(host);
    assert.equal(min.dataset.filterKey, 'gc3');
    assert.equal(min.value, '0.3');
    assert.equal(max.value, '0.8', 'no upper bound puts the thumb at the top of the data');
    const fields = host.querySelectorAll('input').filter((input) => input.type === 'number');
    assert.deepEqual(fields.map((f) => f.value), ['0.3', '']);

    // Dragging the upper thumb: the fields and the histogram follow, the page is
    // told live, and nothing is committed.
    max.value = '0.6';
    max.dispatch('input');
    assert.deepEqual(fields.map((f) => f.value), ['0.3', '0.6']);
    assert.deepEqual(calls.live, [{ gc3: { min: 0.3, max: 0.6, includeMissing: true } }]);
    assert.deepEqual(calls.change, []);
    assert.match(host.querySelector('canvas').getAttribute('aria-label'), /keeps 0\.300 to 0\.600/);

    // The release commits the same values.
    max.dispatch('change');
    assert.deepEqual(calls.change, [{ gc3: { min: 0.3, max: 0.6, includeMissing: true } }]);
  });
});

test('an update during a drag keeps the held row and its slider element', async () => {
  await withFakeDocument(async (document) => {
    const { host, panel } = mount(document);
    panel.update(state({ gc3: { min: null, max: null, includeMissing: true } }));
    const [min] = thumbs(host);
    const row = host.querySelector('div.filter-row');
    min.focus();
    min.value = '0.4';
    min.dispatch('input');
    // The live path re-renders the panel's counts; here the whole update runs,
    // as a landing file would make it, and the gesture must survive.
    panel.update({ ...state({ gc3: { min: 0.4, max: null, includeMissing: true } }), passing: 3 });
    assert.equal(host.querySelector('div.filter-row'), row, 'the row element is kept');
    assert.equal(thumbs(host)[0], min, 'the thumb the reader holds is the same element');
    assert.equal(min.value, '0.4');
    assert.match(host.querySelector('p.filter-summary')?.textContent ?? host.textContent, /3 of 5 genes pass/);

    // Once the thumb is let go, the next update rebuilds as before.
    min.dispatch('blur');
    document.activeElement = null;
    panel.update(state({ gc3: { min: 0.4, max: null, includeMissing: true } }));
    assert.notEqual(host.querySelector('div.filter-row'), row);
  });
});

test('a metric with no spread gets fields but no slider', async () => {
  await withFakeDocument(async (document) => {
    VALUES.flat = [2, 2, 2, 2, 2];
    const { host, panel } = mount(document);
    const flat = metric('flat', 'Flat', 'Other');
    const reg = registry();
    reg.metrics.push(flat); reg.byKey.set('flat', flat);
    panel.update({ ...state({ flat: { min: null, max: null, includeMissing: true } }), registry: reg });
    assert.equal(thumbs(host).length, 0);
    assert.equal(host.querySelectorAll('input').filter((input) => input.type === 'number').length, 2);
  });
});

test('the activity threshold reports live on input and commits on change', async () => {
  await withFakeDocument(async (document) => {
    const { host, panel, calls } = mount(document);
    panel.update({ ...state({}), trafficKey: 'cai' });
    const slider = host.querySelectorAll('input').find((input) => input.id === 'traffic-threshold');
    assert.ok(slider, 'the threshold slider is drawn for the CAI candidate');
    slider.value = '0.5';
    slider.dispatch('input');
    assert.deepEqual(calls.live, [{ cai: { min: 0.5, max: 0.9, includeMissing: true } }]);
    assert.deepEqual(calls.change, []);
    slider.dispatch('change');
    assert.deepEqual(calls.change, [{ cai: { min: 0.5, max: 0.9, includeMissing: true } }]);
    // Held, an update refreshes the readout and leaves the slider in place.
    slider.focus();
    panel.update({ ...state({ cai: { min: 0.5, max: 0.9, includeMissing: true } }), trafficKey: 'cai' });
    assert.equal(host.querySelectorAll('input').find((input) => input.id === 'traffic-threshold'), slider);
    // The page forgets the key between renders (a fresh link carries none);
    // the held slider must still write its threshold under the default metric.
    panel.update({ ...state({ cai: { min: 0.5, max: 0.9, includeMissing: true } }), trafficKey: null });
    assert.equal(host.querySelectorAll('input').find((input) => input.id === 'traffic-threshold'), slider);
    slider.value = '0.7';
    slider.dispatch('change');
    assert.deepEqual(Object.keys(calls.change.at(-1)), ['cai']);
    assert.deepEqual(calls.change.at(-1).cai, { min: 0.7, max: 0.9, includeMissing: true });
  });
});
