import assert from 'node:assert/strict';
import test from 'node:test';

import { computeLiveMetrics } from '../../site/js/core/live-metrics.js';
import { compileScheme } from '../../site/js/core/scheme.js';
import { buildMetricRegistry } from '../../site/js/core/metric-registry.js';
import { buildExport, schemeIdOf } from '../../site/js/core/export-manifest.js';
import { describeSchemes } from '../../site/js/core/panel-export.js';
import {
  panelInputKey, panelResultIsStale, reconcileSchemeSelection, savedSchemeKey, selectedSchemes,
} from '../../site/js/ui/panel-designer.js';
import { savedSchemeControlState } from '../../site/js/ui/scheme-editor.js';
import { expressionFixtureDataset } from './helpers.mjs';

const AMBER = { TAG: 'TAA' };
const SYN61 = { TCA: 'AGT', TCG: 'AGC' };

function state(saved) {
  return { active: { name: '', map: {} }, saved };
}

function computedSchemes(schemes, selected) {
  return describeSchemes(selectedSchemes(schemes, selected));
}

test('saved scheme selection survives insertion before it and arbitrary reordering', () => {
  const syn61 = { name: 'Syn61 B', map: SYN61 };
  const amber = { name: 'Amber A', map: AMBER };
  let selected = new Set([savedSchemeKey(syn61)]);

  selected = reconcileSchemeSelection(selected, state([amber, syn61]));
  assert.deepEqual(computedSchemes(state([amber, syn61]), selected).map((entry) => entry.schemeId), [
    schemeIdOf(SYN61),
  ]);

  selected = reconcileSchemeSelection(selected, state([syn61, amber]));
  assert.deepEqual(computedSchemes(state([syn61, amber]), selected).map((entry) => entry.schemeId), [
    schemeIdOf(SYN61),
  ]);
});

test('saved schemes with different names remain distinct when their maps match', () => {
  const first = { name: 'Syn61 first', map: SYN61 };
  const second = { name: 'Syn61: second / β', map: { ...SYN61 } };
  const schemes = state([first, second]);

  assert.notEqual(savedSchemeKey(first), savedSchemeKey(second));

  const selected = reconcileSchemeSelection(new Set([savedSchemeKey(second)]), schemes);
  assert.deepEqual(selectedSchemes(schemes, selected), [second]);
  assert.deepEqual(computedSchemes(schemes, selected).map((entry) => entry.name), [second.name]);
});

test('deleting a selected saved scheme clears its identity instead of selecting its neighbour', () => {
  const selected = new Set([savedSchemeKey({ name: 'Syn61 B', map: SYN61 })]);
  const remaining = state([{ name: 'Amber A', map: AMBER }]);

  const reconciled = reconcileSchemeSelection(selected, remaining);
  assert.deepEqual([...reconciled], []);
  assert.deepEqual(computedSchemes(remaining, reconciled).map((entry) => entry.schemeId), [
    schemeIdOf({}),
  ]);
});

test('the current-scheme key remains stable and map deduplication is unchanged', () => {
  const schemes = {
    active: { name: 'Current Syn61', map: SYN61 },
    saved: [{ name: 'Saved copy', map: { ...SYN61 } }],
  };
  const selected = reconcileSchemeSelection(
    new Set(['active', savedSchemeKey(schemes.saved[0])]), schemes,
  );

  const computed = computedSchemes(schemes, selected);
  assert.deepEqual([...selected], ['active', savedSchemeKey(schemes.saved[0])]);
  assert.equal(computed.length, 1);
  assert.equal(computed[0].name, 'Current Syn61');
  assert.equal(computed[0].schemeId, schemeIdOf(SYN61));
});

test('computed and exported scheme remains the selected map after reorder', async () => {
  const syn61 = { name: 'Syn61 B', map: SYN61 };
  const schemes = state([{ name: 'Amber A', map: AMBER }, syn61]);
  const selected = reconcileSchemeSelection(new Set([savedSchemeKey(syn61)]), schemes);
  const [descriptor] = computedSchemes(schemes, selected);

  assert.equal(descriptor.name, 'Syn61 B');
  assert.equal(descriptor.schemeId, schemeIdOf(SYN61));
  assert.deepEqual(descriptor.map, SYN61);

  const dataset = await expressionFixtureDataset();
  const live = computeLiveMetrics(dataset, compileScheme({}, dataset.table)).fields;
  const registry = buildMetricRegistry(dataset.meta, dataset.genes, live);
  const exported = buildExport({
    dataset,
    registry,
    ids: [dataset.genes[0].id],
    schemes: [descriptor],
    generatedAt: new Date('2026-09-19T00:00:00Z'),
  });
  assert.deepEqual(exported.manifest.schemes.map((entry) => entry.schemeId), [schemeIdOf(SYN61)]);
  assert.deepEqual(exported.manifest.schemes[0].map, SYN61);
});

test('panel results become stale only when a result-defining input changes', () => {
  const config = { size: 8, seeds: ['M744_RS00005'], ranges: { cai: { min: 0.4 } } };
  const schemes = [{ name: 'Syn61', map: SYN61 }];
  const key = panelInputKey(config, schemes);

  assert.equal(panelResultIsStale(key, {
    ranges: { cai: { min: 0.4 } }, seeds: ['M744_RS00005'], size: 8,
  }, schemes), false, 'object property order does not make an unchanged result stale');
  assert.equal(panelResultIsStale(key, { ...config, size: 9 }, schemes), true);
  assert.equal(panelResultIsStale(key, config, [{ name: 'Syn61', map: AMBER }]), true);
  assert.equal(panelResultIsStale(key, config, [{ name: 'Renamed Syn61', map: SYN61 }]), true,
    'the scheme name is part of the exported result');
  assert.equal(panelResultIsStale('', config, schemes), false,
    'there is no stale state before a result exists');
});

test('saved-scheme controls only enable actions for an existing selection', () => {
  assert.deepEqual(savedSchemeControlState([], ''), {
    selected: '', selectDisabled: true, actionsDisabled: true,
  });
  assert.deepEqual(savedSchemeControlState(['Amber', 'Syn61'], ''), {
    selected: '', selectDisabled: false, actionsDisabled: true,
  });
  assert.deepEqual(savedSchemeControlState(['Amber', 'Syn61'], 'Syn61'), {
    selected: 'Syn61', selectDisabled: false, actionsDisabled: false,
  });
});

test('deleting the selected saved scheme clears and disables its actions', () => {
  assert.deepEqual(savedSchemeControlState(['Amber'], 'Syn61'), {
    selected: '', selectDisabled: false, actionsDisabled: true,
  });
  assert.deepEqual(savedSchemeControlState([], 'Syn61'), {
    selected: '', selectDisabled: true, actionsDisabled: true,
  });
});
