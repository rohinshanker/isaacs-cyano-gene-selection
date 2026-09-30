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

test('a fresh view colours with every source on, and the field stays absent from that link', () => {
  assert.deepEqual(defaultState().colorSources, ['utex-2973', 'pcc-7942', 'go-iea']);
  assert.ok(!/(^|&)cs=/.test(encodeState(defaultState())), 'the default toggles leave no cs= field');
  assert.deepEqual(viewStateOf(defaultState()).colorSources, ['utex-2973', 'pcc-7942', 'go-iea']);
});

test('a narrower colour-source set survives a shared link in canonical order', () => {
  for (const source of ['utex-2973', 'pcc-7942', 'go-iea']) {
    const hash = encodeState({ ...defaultState(), colorSources: [source] });
    assert.match(hash, new RegExp(`(^|&)cs=${source}(&|$)`));
    assert.deepEqual(decodeState(hash).colorSources, [source]);
  }
  const hash = encodeState({ ...defaultState(), colorSources: ['go-iea', 'utex-2973'] });
  assert.match(decodeURIComponent(hash), /(^|&)cs=utex-2973,go-iea(&|$)/);
  assert.deepEqual(decodeState(hash).colorSources, ['utex-2973', 'go-iea']);
});

test('every colour source off encodes as an explicit none, never as the default', () => {
  const hash = encodeState({ ...defaultState(), colorSources: [] });
  assert.match(hash, /(^|&)cs=none(&|$)/);
  assert.deepEqual(decodeState(hash).colorSources, []);
  assert.deepEqual(applyDecoded({}, decodeState(hash)).colorSources, []);
});

test('a version-3 link with the old single-source view field decodes without error and drops it', () => {
  const legacy = decodeState('#ver=3&p=native&c=gc3&as=pcc-7942&l=&t=radar');
  assert.equal(legacy.colorSources, undefined);
  assert.ok(!Object.hasOwn(legacy, 'annotationSources'));
  const applied = applyDecoded(defaultState(), legacy);
  assert.deepEqual(applied.colorSources, ['utex-2973', 'pcc-7942', 'go-iea']);
  assert.equal(applied.colorBy, 'gc3');
  assert.ok(!/(^|&)as=/.test(encodeState(applied)), 'the dropped field is never written back');
});

test('an unknown colour-source id in the hash is dropped rather than trusted', () => {
  const restored = decodeState('#cs=not-a-real-source');
  assert.equal(restored.colorSources, undefined);
  assert.deepEqual(applyDecoded({}, restored).colorSources, ['utex-2973', 'pcc-7942', 'go-iea']);
  assert.deepEqual(decodeState('#cs=go-iea,not-a-real-source').colorSources, ['go-iea']);
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

/**
 * The colour scale is a new field whose default depends on the metric's own
 * values, so a link cannot carry "linear by omission" the way the axis scales
 * can. Owner decision, 2026-09-29: a hash naming a colour but no scale opens on
 * that metric's default scale, which is what a fresh view shows, so an already
 * shared link and a fresh view agree.
 */
test('the colour scale round-trips, and a hash with a colour but no scale leaves it unresolved', () => {
  const target = defaultState();
  assert.equal(target.colorScale, null, 'a fresh state has not resolved a scale yet');

  const hash = encodeState({ ...target, colorBy: 'tssInitiation', colorScale: 'log10' });
  assert.match(hash, /(^|&)csc=log10(&|$)/);
  assert.equal(applyDecoded(defaultState(), decodeState(hash)).colorScale, 'log10');
  for (const scale of ['linear', 'percentile', 'sqrt', 'symlog']) {
    const round = applyDecoded(defaultState(), decodeState(
      encodeState({ ...target, colorBy: 'gc3', colorScale: scale }),
    ));
    assert.equal(round.colorScale, scale);
  }

  // A link shared before the field existed: the colour survives and the scale
  // stays unresolved, so the app can supply the metric's own default.
  const older = decodeState('#ver=6&p=native&c=tssInitiation&l=&t=radar');
  assert.equal(older.colorBy, 'tssInitiation');
  assert.equal('colorScale' in older, false);
  assert.equal(applyDecoded(defaultState(), older).colorScale, null);

  // An unresolved scale writes no field, so a function-category colour, which
  // has no scale at all, leaves nothing behind in the link.
  assert.equal(encodeState({ ...target, colorBy: 'gc3', colorScale: null }).includes('csc='), false);
  // And a hand-edited value this encoder never writes is ignored, not trusted.
  assert.equal('colorScale' in decodeState('#ver=6&csc=rainbow'), false);
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
  assert.equal(STATE_VERSION, 6);
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

test('the export view state carries the scale in effect beside the colour it scales', () => {
  const state = applyDecoded(defaultState(),
    decodeState('#ver=6&p=native&c=expression&csc=log10&l=&t=radar'));
  const viewState = viewStateOf(state);
  assert.equal(viewState.colorBy, 'expression');
  assert.equal(viewState.colorScale, 'log10');
  // A categorical colour has no scale in effect, and the manifest says so rather
  // than naming one nothing is drawing.
  assert.equal(viewStateOf({ ...state, colorScale: null }).colorScale, null);
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

test('a version 5 link carrying chosen comparison metrics opens on the defaults', () => {
  // Those metrics moved into browser storage to keep a shared link readable.
  // An older hash still naming them is read past and dropped, exactly as the
  // version 3 single-source field `as` was, so nothing in the view is left
  // describing a field this encoder no longer writes.
  const decoded = decodeState('#ver=5&p=native&cm=gc3,cai,tai');
  assert.ok(!Object.hasOwn(decoded, 'compareAxes'));
  assert.equal(decoded.panel, 'native');
  assert.ok(!encodeState(defaultState()).includes('cm='));
});

test('a fresh view draws the highest value on top and writes no draw-direction field', () => {
  assert.equal(defaultState().drawOnTop, 'highest');
  assert.ok(!encodeState(defaultState()).includes('dt='));
});

test('the reversed direction round-trips through a link', () => {
  const state = { ...defaultState(), drawOnTop: 'lowest' };
  const hash = encodeState(state);
  assert.ok(hash.includes('dt=lowest'));
  assert.equal(decodeState(hash).drawOnTop, 'lowest');
  assert.equal(applyDecoded(defaultState(), decodeState(hash)).drawOnTop, 'lowest');
  // And back again: choosing the default writes the field out of the link.
  assert.ok(!encodeState({ ...state, drawOnTop: 'highest' }).includes('dt='));
});

test('a hash with no draw-direction field means highest, whatever was on screen', () => {
  const decoded = decodeState(`#ver=${STATE_VERSION}&p=native&c=cai`);
  assert.ok(!Object.hasOwn(decoded, 'drawOnTop'));
  // `applyDecoded` resets first, so a link that does not speak to the direction
  // returns the reader to the default rather than leaving the previous choice.
  const target = { ...defaultState(), drawOnTop: 'lowest' };
  assert.equal(applyDecoded(target, decoded).drawOnTop, 'highest');
});

test('a hand-edited direction is ignored rather than drawn, and leaves the default', () => {
  for (const hash of ['#dt=sideways', '#dt=', '#dt=HIGHEST']) {
    const decoded = decodeState(hash);
    assert.ok(!Object.hasOwn(decoded, 'drawOnTop'), hash);
    assert.equal(applyDecoded(defaultState(), decoded).drawOnTop, 'highest');
  }
});

test('the draw direction did not bump the encoder version, and links stay readable both ways', () => {
  // An older link has no `dt`, which means highest — and highest is what every
  // earlier viewer drew, so the two agree and no reader can misread the other's
  // hash. That is the test the version number exists for.
  assert.equal(STATE_VERSION, 6);
  const older = decodeState('#ver=6&p=native&c=cai');
  assert.equal(applyDecoded(defaultState(), older).drawOnTop, 'highest');
  const newer = decodeState(encodeState({ ...defaultState(), drawOnTop: 'lowest' }));
  assert.equal(newer.version, 6);
});

test('the export manifest records the direction the picture was drawn in', () => {
  // It changes no number, but it decides which of two overlapping marks the
  // exported image shows, so a manifest without it could not reproduce it.
  assert.equal(viewStateOf({ ...defaultState(), drawOnTop: 'lowest' }).drawOnTop, 'lowest');
  assert.equal(viewStateOf(defaultState()).drawOnTop, 'highest');
  // A state object built before this field existed still describes a picture.
  const legacy = { ...defaultState() };
  delete legacy.drawOnTop;
  assert.equal(viewStateOf(legacy).drawOnTop, 'highest');
});
