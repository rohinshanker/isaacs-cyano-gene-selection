import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeState, decodeState, applyDecoded, defaultState, clearSelections, STATE_VERSION,
  LEGACY_METRIC_AXES, MEASURED_AXES_VERSION, viewStateOf,
} from '../../site/js/core/url-state.js';
import { DEFAULT_METRIC_AXES } from '../../site/js/core/metric-axes.js';

const full = {
  panel: 'risk',
  colorBy: 'targetFraction',
  schemeMap: { TCG: 'AGC', TAG: 'TAA' },
  schemeName: 'Syn61-style',
  highExpressed: true,
  filters: {
    gc3: { min: 0.4, max: 0.8, includeMissing: true },
    cai: { min: null, max: 0.9, includeMissing: false },
  },
  trafficKey: 'tai',
  shortlist: ['M744_RS00005', 'M744_RS00010'],
  pinnedId: 'M744_RS00005',
  compareTab: 'parallel',
  showHidden: false,
  exceptionFilter: 'only',
};

test('a full state round-trips through the hash', () => {
  const decoded = decodeState(`#${encodeState(full)}`);
  assert.equal(decoded.version, STATE_VERSION);
  assert.equal(decoded.panel, 'risk');
  assert.equal(decoded.colorBy, 'targetFraction');
  assert.deepEqual(decoded.schemeMap, full.schemeMap);
  assert.equal(decoded.schemeName, 'Syn61-style');
  assert.equal(decoded.highExpressed, true);
  assert.deepEqual(decoded.filters, full.filters);
  assert.equal(decoded.trafficKey, 'tai');
  assert.deepEqual(decoded.shortlist, full.shortlist);
  assert.equal(decoded.pinnedId, 'M744_RS00005');
  assert.equal(decoded.compareTab, 'parallel');
  assert.equal(decoded.showHidden, false);
  assert.equal(decoded.filters.cai.includeMissing, false);
  assert.equal(decoded.filters.gc3.includeMissing, true);
  assert.equal(decoded.exceptionFilter, 'only');
});

test('dropping unmeasured genes survives a shared link', () => {
  const hash = encodeState({ ...full, filters: { cai: { min: 0.2, max: null, includeMissing: false } } });
  assert.match(decodeURIComponent(hash), /cai:0\.2::0/);
  assert.equal(decodeState(hash).filters.cai.includeMissing, false);
});

test('length and protein-record choices survive a shared link', () => {
  const chosen = {
    ...defaultState(),
    panel: 'lengths',
    lengthCohort: 'refseq',
    proteinFilter: 'refseq',
    filters: { lengthNt: { min: 201, max: 2001, includeMissing: true } },
  };
  const restored = decodeState(encodeState(chosen));
  assert.equal(restored.panel, 'lengths');
  assert.equal(restored.lengthCohort, 'refseq');
  assert.equal(restored.proteinFilter, 'refseq');
  assert.deepEqual(restored.filters.lengthNt, chosen.filters.lengthNt);
  assert.equal(decodeState('#pr=detected').proteinFilter, undefined);
});

test('selected legend categories survive a shared link, sorted and deduped', () => {
  const state = { ...defaultState(), categoryFilter: ['unknown-or-unclassified', 'stress-and-repair'] };
  const restored = decodeState(encodeState(state));
  assert.deepEqual(restored.categoryFilter, ['stress-and-repair', 'unknown-or-unclassified']);
  assert.ok(!/(^|&)cf=/.test(encodeState(defaultState())), 'an empty selection leaves no cf= field');
});

test('an unknown or malformed category id in the hash is dropped rather than trusted', () => {
  const restored = decodeState('#cf=stress-and-repair,not-a-real-category,stress-and-repair');
  assert.deepEqual(restored.categoryFilter, ['stress-and-repair']);
});

test('a fresh view starts with every source on, and the field stays absent from that link', () => {
  assert.deepEqual(defaultState().annotationSources, ['utex-2973', 'pcc-7942', 'go-iea']);
  assert.ok(!/(^|&)as=/.test(encodeState(defaultState())), 'the default toggles leave no as= field');
  assert.deepEqual(viewStateOf(defaultState()).annotationSources, ['utex-2973', 'pcc-7942', 'go-iea']);
});

test('a single enabled source survives a shared link, in the old single-id form', () => {
  for (const source of ['utex-2973', 'pcc-7942', 'go-iea']) {
    const state = { ...defaultState(), annotationSources: [source] };
    const hash = encodeState(state);
    assert.match(hash, new RegExp(`(^|&)as=${source}(&|$)`));
    assert.deepEqual(decodeState(hash).annotationSources, [source]);
  }
});

test('two enabled sources encode as a canonical comma list whatever order they were toggled', () => {
  const state = { ...defaultState(), annotationSources: ['go-iea', 'utex-2973'] };
  const hash = encodeState(state);
  assert.match(decodeURIComponent(hash), /(^|&)as=utex-2973,go-iea(&|$)/);
  assert.deepEqual(decodeState(hash).annotationSources, ['utex-2973', 'go-iea']);
});

test('every source off encodes as an explicit none, never as the default', () => {
  const hash = encodeState({ ...defaultState(), annotationSources: [] });
  assert.match(hash, /(^|&)as=none(&|$)/);
  assert.deepEqual(decodeState(hash).annotationSources, []);
  assert.deepEqual(applyDecoded({}, decodeState(hash)).annotationSources, []);
});

test('a version-3 link with one source id keeps meaning that source alone', () => {
  const legacy = decodeState('#ver=3&p=native&c=gc3&as=pcc-7942&l=&t=radar');
  assert.deepEqual(legacy.annotationSources, ['pcc-7942']);
  assert.deepEqual(applyDecoded(defaultState(), legacy).annotationSources, ['pcc-7942']);
  assert.deepEqual(decodeState('#as=all').annotationSources, ['utex-2973', 'pcc-7942', 'go-iea']);
});

test('an unknown annotation source id in the hash is dropped rather than trusted', () => {
  const restored = decodeState('#as=not-a-real-source');
  assert.equal(restored.annotationSources, undefined);
  const applied = applyDecoded({}, restored);
  assert.deepEqual(applied.annotationSources, ['utex-2973', 'pcc-7942', 'go-iea']);
  assert.deepEqual(decodeState('#as=go-iea,not-a-real-source').annotationSources, ['go-iea']);
});

test('explicit metric axes survive a shared link and reset to their defaults', () => {
  const state = defaultState();
  state.panel = 'axes';
  state.axisX = 'gc3';
  state.axisY = 'lengthNt';
  const restored = decodeState(encodeState(state));
  assert.equal(restored.panel, 'axes');
  assert.equal(restored.axisX, 'gc3');
  assert.equal(restored.axisY, 'lengthNt');
  applyDecoded(state, decodeState(encodeState(defaultState())));
  assert.deepEqual(
    { x: state.axisX, y: state.axisY },
    { x: DEFAULT_METRIC_AXES.x, y: DEFAULT_METRIC_AXES.y },
  );
});

test('a nondefault axis scale survives a shared link, and linear stays out of the hash', () => {
  const state = defaultState();
  state.panel = 'axes';
  state.axisX = 'gc3';
  state.axisXScale = 'log10';
  state.axisYScale = 'percentile';
  const hash = encodeState(state);
  assert.match(hash, /xs=log10/);
  assert.match(hash, /ys=percentile/);
  const restored = decodeState(`#${hash}`);
  assert.equal(restored.axisXScale, 'log10');
  assert.equal(restored.axisYScale, 'percentile');

  // A fresh view (both axes linear) never encodes the scale fields.
  const fresh = encodeState(defaultState());
  assert.doesNotMatch(fresh, /xs=/);
  assert.doesNotMatch(fresh, /ys=/);
});

test('an unknown or malformed axis scale in the hash is dropped rather than trusted', () => {
  const decoded = decodeState('#ver=3&p=axes&xs=exponential&ys=&l=');
  assert.equal('axisXScale' in decoded, false);
  assert.equal('axisYScale' in decoded, false);
  const target = defaultState();
  applyDecoded(target, decoded);
  assert.equal(target.axisXScale, 'linear');
  assert.equal(target.axisYScale, 'linear');
});

test('an old hash with no scale fields decodes to linear, unchanged from before the feature existed', () => {
  const legacy = '#ver=2&p=axes&c=gc3&l=&t=radar';
  const decoded = decodeState(legacy);
  assert.equal('axisXScale' in decoded, false);
  assert.equal('axisYScale' in decoded, false);
  const target = defaultState();
  applyDecoded(target, decoded);
  assert.equal(target.axisXScale, 'linear');
  assert.equal(target.axisYScale, 'linear');
});

test('a link shared before the measured axes still plots the pair its author saw', () => {
  // Exactly the hash the old encoder wrote for length against CAI: the axes are
  // absent because they were the default then.
  const shared = '#ver=2&p=axes&c=gc3&l=&t=radar';
  const decoded = decodeState(shared);
  assert.deepEqual({ x: decoded.axisX, y: decoded.axisY }, LEGACY_METRIC_AXES);

  const target = defaultState();
  applyDecoded(target, decoded);
  assert.equal(target.panel, 'axes');
  assert.equal(target.axisX, 'lengthNt');
  assert.equal(target.axisY, 'cai');
});

test('an explicit axis in an old link still wins over both defaults', () => {
  const decoded = decodeState('#ver=2&p=axes&ay=gc3&l=&t=radar');
  assert.equal(decoded.axisY, 'gc3');
  assert.equal(decoded.axisX, LEGACY_METRIC_AXES.x);
  assert.equal(applyDecoded(defaultState(), decoded).axisY, 'gc3');
});

test('a fresh view, and a hash this encoder did not write, keep the measured default', () => {
  // No hash at all, and a hand-written fragment with no version: neither is an
  // old snapshot, so neither is migrated.
  assert.equal(applyDecoded(defaultState(), decodeState('')).axisY, 'tssInitiation');
  const handWritten = decodeState('#p=axes&c=gc3');
  assert.ok(!Object.hasOwn(handWritten, 'axisY'));
  assert.equal(applyDecoded(defaultState(), handWritten).axisY, 'tssInitiation');
});

test('this encoder writes the migrated version and round-trips its own snapshot', () => {
  assert.equal(STATE_VERSION, 4);
  assert.ok(STATE_VERSION >= MEASURED_AXES_VERSION);
  const state = defaultState();
  state.panel = 'axes';
  const hash = encodeState(state);
  assert.ok(hash.startsWith(`ver=${STATE_VERSION}`), hash);
  const restored = applyDecoded(defaultState(), decodeState(hash));
  assert.equal(restored.axisX, 'lengthNt');
  assert.equal(restored.axisY, 'tssInitiation');

  // A current snapshot that really wants CAI says so, and says so explicitly.
  state.axisY = 'cai';
  const explicit = encodeState(state);
  assert.ok(explicit.includes('ay=cai'), explicit);
  assert.equal(applyDecoded(defaultState(), decodeState(explicit)).axisY, 'cai');
});

test('the fresh-view axes are CDS length against measured evidence, never CAI or tAI', () => {
  const state = defaultState();
  assert.deepEqual({ x: state.axisX, y: state.axisY }, { x: 'lengthNt', y: 'tssInitiation' });
  assert.ok(!['cai', 'tai'].includes(state.axisY));
  // A plain view carries no axis fields at all.
  const hash = encodeState(state);
  assert.ok(!hash.includes('ax='), hash);
  assert.ok(!hash.includes('ay='), hash);
});

test('an encoded CAI axis still wins over the new measured default', () => {
  const shared = encodeState({ ...defaultState(), panel: 'axes', axisY: 'cai' });
  assert.ok(shared.includes('ay=cai'), shared);
  const target = defaultState();
  target.axisY = 'gc3';
  applyDecoded(target, decodeState(shared));
  assert.equal(target.axisY, 'cai');
  assert.equal(target.axisX, DEFAULT_METRIC_AXES.x);
});

test('defaults are left out of the hash so a plain view has a plain link', () => {
  const hash = encodeState({
    panel: 'native', colorBy: 'gc3', schemeMap: {}, schemeName: '', highExpressed: false,
    filters: {}, trafficKey: null, shortlist: [], pinnedId: null, compareTab: 'radar',
    showHidden: true, exceptionFilter: 'any',
  });
  assert.equal(hash, `ver=${STATE_VERSION}&p=native&c=gc3&l=&t=radar`);
});

test('an explicitly empty shortlist round-trips as empty, not as absent', () => {
  const hash = encodeState({ ...full, shortlist: [] });
  const decoded = decodeState(hash);
  assert.ok('shortlist' in decoded, 'the shortlist key must survive even when the list is empty');
  assert.deepEqual(decoded.shortlist, []);
});

test('reset selections clears pin and shortlist without changing the analysis', () => {
  const state = structuredClone(full);
  clearSelections(state);
  assert.equal(state.pinnedId, null);
  assert.deepEqual(state.shortlist, []);
  assert.deepEqual(state.schemeMap, full.schemeMap);
  assert.deepEqual(state.filters, full.filters);
  assert.equal(state.panel, full.panel);
  assert.equal(state.colorBy, full.colorBy);
  const hash = encodeState(state);
  assert.match(hash, /(?:^|&)l=(?:&|$)/);
  assert.ok(!hash.includes('&g='));
});

test('an empty or malformed hash decodes to an empty patch, with no shortlist key at all', () => {
  assert.deepEqual(decodeState(''), {});
  assert.deepEqual(decodeState('#'), {});
  assert.deepEqual(decodeState('#garbage&also'), {});
  assert.deepEqual(decodeState('#n=%E0%A4%A'), {});
  assert.ok(!('shortlist' in decodeState('')), 'no hash at all must leave local persistence in charge');
});

test('one malformed percent-encoded field does not discard valid fields beside it', () => {
  assert.deepEqual(decodeState('#p=risk&n=%E0%A4%A&t=parallel'), {
    panel: 'risk',
    compareTab: 'parallel',
  });
});

test('a scheme name with separators survives encoding', () => {
  const hash = encodeState({ ...full, schemeName: 'test & one=two' });
  assert.equal(decodeState(hash).schemeName, 'test & one=two');
});

test('the traffic metric is absent from the hash when unset', () => {
  const hash = encodeState({ ...full, trafficKey: null });
  assert.ok(!/(^|&)k=/.test(hash));
  assert.ok(!('trafficKey' in decodeState(hash)));
});

// `encodeState` only ever writes non-default fields, so navigating to a hash
// that means "back to defaults" says nothing about the scheme, filters, pin,
// or traffic metric at all. `applyDecoded` is what must clear them anyway;
// a merge that only overlays `decoded` onto whatever the target already
// holds would leave every one of these stale on screen. This is a
// regression test for exactly that shipped bug.
test('applying a plain hash after a full one clears every field to its default, not the prior state', () => {
  const state = defaultState();
  applyDecoded(state, decodeState(`#${encodeState(full)}`));
  assert.equal(state.panel, 'risk');
  assert.equal(state.pinnedId, 'M744_RS00005');

  const plainHash = encodeState({
    panel: 'native', colorBy: 'gc3', schemeMap: {}, schemeName: '', highExpressed: false,
    filters: {}, trafficKey: null, shortlist: [], pinnedId: null, compareTab: 'radar',
    showHidden: true, exceptionFilter: 'any',
  });
  applyDecoded(state, decodeState(`#${plainHash}`));
  assert.equal(state.panel, 'native');
  assert.equal(state.colorBy, 'gc3');
  assert.deepEqual(state.schemeMap, {});
  assert.equal(state.schemeName, '');
  assert.equal(state.highExpressed, false);
  assert.deepEqual(state.filters, {});
  assert.equal(state.trafficKey, null);
  assert.deepEqual(state.shortlist, []);
  assert.equal(state.pinnedId, null);
  assert.equal(state.compareTab, 'radar');
  assert.equal(state.showHidden, true);
  assert.equal(state.exceptionFilter, 'any');
});

test('applyDecoded resets a field to default even when the new hash omits it entirely', () => {
  const state = defaultState();
  applyDecoded(state, { trafficKey: 'tai', pinnedId: 'M744_RS00005' });
  assert.equal(state.trafficKey, 'tai');
  applyDecoded(state, {});
  assert.equal(state.trafficKey, null);
  assert.equal(state.pinnedId, null);
});

test('defaultState returns an independent object every call, so mutating one shortlist cannot leak into the next reset', () => {
  const a = defaultState();
  a.shortlist.push('M744_RS00005');
  const b = defaultState();
  assert.deepEqual(b.shortlist, []);
});
