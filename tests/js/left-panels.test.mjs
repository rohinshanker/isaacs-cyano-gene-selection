import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEFT_PANEL_IDS, DEFAULT_PANEL_ORDER, DEFAULT_PANEL_COLLAPSED,
  normalizePanelOrder, normalizeCollapsed, isDefaultPanelOrder, isDefaultCollapsed,
  movePanel, reorderPanel, toggleCollapsed, panelTitle,
} from '../../site/js/core/left-panels.js';
import {
  encodeState, decodeState, applyDecoded, defaultState, resetPanelLayout,
} from '../../site/js/core/url-state.js';

test('the gene visualizer leads the column and is the only panel collapsed at first', () => {
  assert.equal(DEFAULT_PANEL_ORDER[0], 'gene-viewer');
  assert.deepEqual([...DEFAULT_PANEL_COLLAPSED], ['gene-viewer']);
  assert.equal(panelTitle('gene-viewer'), 'Gene visualizer');
  assert.equal(panelTitle('not-a-panel'), null);
});

test('an order from a link always yields every panel exactly once', () => {
  // A link written before a panel existed, or naming one that no longer does,
  // must still produce a complete column: a control the user cannot find is
  // worse than one in an unexpected place.
  assert.deepEqual(normalizePanelOrder(['filters']), ['filters', 'gene-viewer', 'scheme']);
  assert.deepEqual(normalizePanelOrder(['ghost', 'scheme']), ['scheme', 'gene-viewer', 'filters']);
  assert.deepEqual(normalizePanelOrder(['scheme', 'scheme']), ['scheme', 'gene-viewer', 'filters']);
  assert.deepEqual(normalizePanelOrder(null), [...DEFAULT_PANEL_ORDER]);
  assert.deepEqual(normalizePanelOrder([...LEFT_PANEL_IDS]), [...LEFT_PANEL_IDS]);
});

test('a collapsed set is ordered and filtered, so equal sets encode identically', () => {
  assert.deepEqual(normalizeCollapsed(['filters', 'gene-viewer']), ['gene-viewer', 'filters']);
  assert.deepEqual(normalizeCollapsed(['gene-viewer', 'filters']), ['gene-viewer', 'filters']);
  assert.deepEqual(normalizeCollapsed(['ghost']), []);
  assert.ok(isDefaultCollapsed(['gene-viewer']));
  assert.ok(!isDefaultCollapsed([]));
  assert.ok(!isDefaultCollapsed(['scheme']));
});

test('moving a panel clamps at both ends instead of wrapping', () => {
  const order = ['gene-viewer', 'scheme', 'filters'];
  assert.deepEqual(movePanel(order, 'gene-viewer', -1), order, 'the top panel cannot move up');
  assert.deepEqual(movePanel(order, 'filters', 1), order, 'the bottom panel cannot move down');
  assert.deepEqual(movePanel(order, 'gene-viewer', 1), ['scheme', 'gene-viewer', 'filters']);
  assert.deepEqual(movePanel(order, 'filters', -2), ['filters', 'gene-viewer', 'scheme']);
  assert.deepEqual(movePanel(order, 'filters', -9), ['filters', 'gene-viewer', 'scheme']);
  assert.deepEqual(order, ['gene-viewer', 'scheme', 'filters'], 'the input is not mutated');
});

test('a drag places a panel at an index', () => {
  const order = ['gene-viewer', 'scheme', 'filters'];
  assert.deepEqual(reorderPanel(order, 'gene-viewer', 2), ['scheme', 'filters', 'gene-viewer']);
  assert.deepEqual(reorderPanel(order, 'filters', 0), ['filters', 'gene-viewer', 'scheme']);
  assert.deepEqual(reorderPanel(order, 'ghost', 0), order);
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
  state.panelOrder = ['filters', 'gene-viewer', 'scheme'];
  state.panelCollapsed = ['scheme'];
  const restored = applyDecoded(defaultState(), decodeState(encodeState(state)));
  assert.deepEqual(restored.panelOrder, ['filters', 'gene-viewer', 'scheme']);
  assert.deepEqual(restored.panelCollapsed, ['scheme']);
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
  state.panelOrder = ['filters', 'scheme', 'gene-viewer'];
  state.panelCollapsed = [];
  resetPanelLayout(state);
  assert.ok(isDefaultPanelOrder(state.panelOrder));
  assert.ok(isDefaultCollapsed(state.panelCollapsed));
});
