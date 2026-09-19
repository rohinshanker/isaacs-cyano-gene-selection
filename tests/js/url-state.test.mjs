import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeState, decodeState, STATE_VERSION } from '../../site/js/core/url-state.js';

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
