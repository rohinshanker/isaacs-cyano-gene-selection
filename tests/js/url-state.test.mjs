import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeState, decodeState, applyDecoded, defaultState, STATE_VERSION,
} from '../../site/js/core/url-state.js';

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

test('an empty or malformed hash decodes to an empty patch, with no shortlist key at all', () => {
  assert.deepEqual(decodeState(''), {});
  assert.deepEqual(decodeState('#'), {});
  assert.deepEqual(decodeState('#garbage&also'), {});
  assert.ok(!('shortlist' in decodeState('')), 'no hash at all must leave local persistence in charge');
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
