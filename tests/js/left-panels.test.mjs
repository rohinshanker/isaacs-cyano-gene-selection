import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEFT_PANEL_IDS, DEFAULT_PANEL_ORDER, DEFAULT_PANEL_COLLAPSED,
  normalizePanelOrder, normalizeCollapsed, isDefaultPanelOrder, isDefaultCollapsed,
  movePanel, toggleCollapsed, panelTitle,
} from '../../site/js/core/left-panels.js';
import {
  encodeState, decodeState, applyDecoded, defaultState, resetPanelLayout,
} from '../../site/js/core/url-state.js';

test('the gene visualizer leads the column and only it and Custom filters start collapsed', () => {
  assert.equal(DEFAULT_PANEL_ORDER[0], 'gene-viewer');
  assert.deepEqual([...DEFAULT_PANEL_ORDER], ['gene-viewer', 'scheme', 'custom-filters', 'filters']);
  assert.deepEqual([...DEFAULT_PANEL_COLLAPSED], ['gene-viewer', 'custom-filters']);
  assert.equal(panelTitle('custom-filters'), 'Custom filters');
  assert.equal(panelTitle('gene-viewer'), 'Gene visualizer');
  assert.equal(panelTitle('not-a-panel'), null);
});

test('an order from a link always yields every panel exactly once', () => {
  // A link written before a panel existed, or naming one that no longer does,
  // must still produce a complete column: a control the user cannot find is
  // worse than one in an unexpected place.
  assert.deepEqual(normalizePanelOrder(['filters']),
    ['custom-filters', 'filters', 'gene-viewer', 'scheme']);
  assert.deepEqual(normalizePanelOrder(['ghost', 'scheme']),
    ['scheme', 'gene-viewer', 'custom-filters', 'filters']);
  assert.deepEqual(normalizePanelOrder(['scheme', 'scheme']),
    ['scheme', 'gene-viewer', 'custom-filters', 'filters']);
  assert.deepEqual(normalizePanelOrder(null), [...DEFAULT_PANEL_ORDER]);
  assert.deepEqual(normalizePanelOrder([...LEFT_PANEL_IDS]), [...LEFT_PANEL_IDS]);
});

test('a collapsed set is ordered and filtered, so equal sets encode identically', () => {
  assert.deepEqual(normalizeCollapsed(['filters', 'gene-viewer']), ['gene-viewer', 'filters']);
  assert.deepEqual(normalizeCollapsed(['gene-viewer', 'filters']), ['gene-viewer', 'filters']);
  assert.deepEqual(normalizeCollapsed(['ghost']), []);
  assert.ok(isDefaultCollapsed(['custom-filters', 'gene-viewer']));
  assert.ok(!isDefaultCollapsed(['gene-viewer']));
  assert.ok(!isDefaultCollapsed([]));
  assert.ok(!isDefaultCollapsed(['scheme']));
});

test('moving a panel clamps at both ends instead of wrapping', () => {
  const order = ['gene-viewer', 'scheme', 'custom-filters', 'filters'];
  assert.deepEqual(movePanel(order, 'gene-viewer', -1), order, 'the top panel cannot move up');
  assert.deepEqual(movePanel(order, 'filters', 1), order, 'the bottom panel cannot move down');
  assert.deepEqual(movePanel(order, 'gene-viewer', 1),
    ['scheme', 'gene-viewer', 'custom-filters', 'filters']);
  assert.deepEqual(movePanel(order, 'filters', -2),
    ['gene-viewer', 'filters', 'scheme', 'custom-filters']);
  assert.deepEqual(movePanel(order, 'custom-filters', -9),
    ['custom-filters', 'gene-viewer', 'scheme', 'filters']);
  assert.deepEqual(order, ['gene-viewer', 'scheme', 'custom-filters', 'filters'],
    'the input is not mutated');
});

test('collapsing toggles one panel and leaves the rest alone', () => {
  assert.deepEqual(toggleCollapsed(['gene-viewer'], 'scheme', true), ['gene-viewer', 'scheme']);
  assert.deepEqual(toggleCollapsed(['gene-viewer'], 'gene-viewer', false), []);
  assert.deepEqual(toggleCollapsed([], 'gene-viewer', false), []);
});

test('a default layout leaves no field in the hash', () => {
  const state = defaultState();
  const hash = encodeState(state);
  assert.ok(!hash.includes('po='), hash);
  assert.ok(!hash.includes('pc='), hash);
});

test('a rearranged column round-trips through a link', () => {
  const state = defaultState();
  state.panelOrder = ['filters', 'custom-filters', 'gene-viewer', 'scheme'];
  state.panelCollapsed = ['scheme'];
  const restored = applyDecoded(defaultState(), decodeState(encodeState(state)));
  assert.deepEqual(restored.panelOrder, ['filters', 'custom-filters', 'gene-viewer', 'scheme']);
  assert.deepEqual(restored.panelCollapsed, ['scheme'], 'an opened Custom filters stays open');
});

test('every panel expanded is a real arrangement, not the default, so it encodes', () => {
  // Without the explicit sentinel an empty collapsed set would be dropped from
  // the hash and read back as the gene visualizer collapsed again, so a link
  // would not reproduce the column it was copied from.
  const state = defaultState();
  state.panelCollapsed = [];
  const hash = encodeState(state);
  assert.ok(hash.includes('pc=none'), hash);
  const restored = applyDecoded(defaultState(), decodeState(hash));
  assert.deepEqual(restored.panelCollapsed, []);
});

test('a state object that says nothing about the layout writes no layout field', () => {
  const hash = encodeState({
    panel: 'native', colorBy: null, schemeMap: {}, schemeName: '', filters: {},
    shortlist: [], pinnedId: null, compareTab: 'radar', showHidden: true,
  });
  assert.ok(!hash.includes('pc='), hash);
  assert.ok(!hash.includes('po='), hash);
});

test('resetting the layout restores the fresh order and collapsed set', () => {
  const state = defaultState();
  state.panelOrder = ['filters', 'custom-filters', 'scheme', 'gene-viewer'];
  state.panelCollapsed = [];
  resetPanelLayout(state);
  assert.ok(isDefaultPanelOrder(state.panelOrder));
  assert.ok(isDefaultCollapsed(state.panelCollapsed));
});

test('a link written before Custom filters inserts it above Filters, collapsed', () => {
  // Version 8 knew three panels. Its explicit order and collapsed set are kept
  // for the panels it named; the new panel lands directly above Filters and
  // takes its fresh collapsed state, including under the all-open sentinel.
  const reordered = applyDecoded(defaultState(),
    decodeState('#ver=8&po=filters%2Cscheme%2Cgene-viewer&pc=none'));
  assert.deepEqual(reordered.panelOrder, ['custom-filters', 'filters', 'scheme', 'gene-viewer']);
  assert.deepEqual(reordered.panelCollapsed, ['custom-filters']);
  const collapsed = applyDecoded(defaultState(), decodeState('#ver=8&pc=scheme%2Cfilters'));
  assert.deepEqual(collapsed.panelOrder, [...DEFAULT_PANEL_ORDER]);
  assert.deepEqual(collapsed.panelCollapsed, ['scheme', 'custom-filters', 'filters']);
  const silent = applyDecoded(defaultState(), decodeState('#ver=8&p=native'));
  assert.deepEqual(silent.panelCollapsed, [...DEFAULT_PANEL_COLLAPSED]);
  const unversioned = decodeState('#pc=none');
  assert.deepEqual(unversioned.panelCollapsed, ['custom-filters'],
    'a collapsed set this encoder did not write cannot have opened the panel');
});

test('a current link keeps Custom filters explicitly opened or moved', () => {
  const state = defaultState();
  state.panelCollapsed = ['gene-viewer'];
  state.panelOrder = ['custom-filters', 'gene-viewer', 'scheme', 'filters'];
  const hash = encodeState(state);
  assert.match(hash, /ver=9/);
  const restored = applyDecoded(defaultState(), decodeState(hash));
  assert.deepEqual(restored.panelCollapsed, ['gene-viewer']);
  assert.deepEqual(restored.panelOrder, ['custom-filters', 'gene-viewer', 'scheme', 'filters']);
  const allOpen = defaultState();
  allOpen.panelCollapsed = [];
  assert.deepEqual(applyDecoded(defaultState(), decodeState(encodeState(allOpen))).panelCollapsed, []);
});
