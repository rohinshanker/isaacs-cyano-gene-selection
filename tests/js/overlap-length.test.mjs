import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endOverlapLengths, parseOverlapLengthFilter, passesOverlapLengthFilter,
  OVERLAP_LENGTH_METRICS } from '../../site/js/core/overlap-length.js';
import { OverlapLengthFilter } from '../../site/js/ui/overlap-length-filter.js';
import { buildMetricRegistry } from '../../site/js/core/metric-registry.js';
import { defaultState, encodeState, decodeState, applyDecoded, viewStateOf } from '../../site/js/core/url-state.js';
import { withFakeDocument } from './fake-dom.mjs';

const gene = (strand = '+', cdsSegments = [[10, 20]]) => ({ strand, cdsSegments, seqid: 'chr' });
const partner = (...pairs) => ({ sharedIntervals: pairs.map(([from, to]) => ({ from, to })) });
const lengths = (fivePrimeNt, threePrimeNt) => ({ fivePrimeNt, threePrimeNt, totalNt: fivePrimeNt + threePrimeNt });

test('contiguous end unions are strand aware and ignore internal overlaps', () => {
  const partners = [partner([10, 11], [15, 16], [19, 20]), partner([11, 13]), partner([10, 12])];
  assert.deepEqual(endOverlapLengths(gene(), partners, 100), lengths(4, 2));
  assert.deepEqual(endOverlapLengths(gene('-'), partners, 100), lengths(2, 4));
  assert.deepEqual(endOverlapLengths(gene(), [partner([11, 19])], 100), lengths(0, 0));
  assert.deepEqual(endOverlapLengths(gene(), [partner([10, 10])], 100), lengths(1, 0));
  assert.deepEqual(endOverlapLengths(gene(), [partner([20, 20])], 100), lengths(0, 1));
  assert.deepEqual(endOverlapLengths(gene(), [], 100), lengths(0, 0));
});

test('full coverage is counted independently from both ends, once within each end', () => {
  const result = endOverlapLengths(gene(), [partner([10, 20]), partner([10, 20])], 100);
  assert.deepEqual(result, lengths(11, 11));
  assert.ok(Object.isFrozen(result));
  assert.deepEqual(endOverlapLengths(gene('+', [[10, 10]]), [partner([10, 10])], 100), lengths(1, 1));
});

test('real coding gaps stop both walks; adjacent segments are continuous', () => {
  const shared = [partner([10, 35])];
  for (const strand of ['+', '-']) {
    const result = endOverlapLengths(gene(strand, [[10, 15], [25, 35]]), shared, 100);
    assert.deepEqual(result, strand === '+' ? lengths(6, 11) : lengths(11, 6));
  }
  assert.deepEqual(endOverlapLengths(gene('+', [[10, 15], [16, 20]]), shared, 100), lengths(11, 11));
  assert.deepEqual(endOverlapLengths(gene('+', [[10, 15], [14, 20]]), shared, 100), lengths(11, 11));
});

test('circular origin is continuous in both orientations, with partial and full coverage', () => {
  const segments = [[1, 10], [95, 100]];
  const shared = [partner([95, 100]), partner([1, 3], [9, 10])];
  assert.deepEqual(endOverlapLengths(gene('+', segments), shared, 100), lengths(9, 2));
  assert.deepEqual(endOverlapLengths(gene('-', segments), shared, 100), lengths(2, 9));
  for (const strand of ['+', '-']) {
    assert.deepEqual(endOverlapLengths(gene(strand, segments), [partner([1, 10], [95, 100])], 100), lengths(16, 16));
  }
});

test('unavailable context and unsupported geometry never become zero', () => {
  for (const args of [
    [gene(), undefined, 100], [gene(), null, 100], [gene('?'), [], 100],
    [null, [], 100], [gene(), [], null], [gene(), [], 0],
    [gene('+', [[1, 5], [20, 30], [90, 100]]), [], 100],
    [gene('+', [[0, 20]]), [], 100], [gene('+', [[10, 101]]), [], 100],
    [gene('+', [[10, 10.5]]), [], 100], [gene(), [{}], 100],
    [gene(), [partner([1, 101])], 100],
  ]) assert.equal(endOverlapLengths(...args), null);
  assert.deepEqual(endOverlapLengths({ start: 10, end: 20, strand: '+' }, [], 100), lengths(0, 0));
});

test('all annotated partners contribute independent of display, strand and biotype', () => {
  const partners = [{ ...partner([10, 15]), strand: '-', biotype: 'tRNA', selectable: false },
    { ...partner([16, 20]), strand: null, pseudo: true, filtered: true }];
  assert.deepEqual(endOverlapLengths(gene(), partners, 100), lengths(11, 11));
  assert.deepEqual(endOverlapLengths(gene(), [...partners].reverse(), 100), lengths(11, 11));
});

test('inclusive exact ranges, one sided bounds, zero and unknown values', () => {
  const focal = { overlap5PrimeNt: 0, overlap3PrimeNt: 7 };
  assert.equal(passesOverlapLengthFilter(focal, { end: '5prime', min: 0, max: 0 }), true);
  assert.equal(passesOverlapLengthFilter(focal, { end: '3prime', min: 7, max: 7 }), true);
  assert.equal(passesOverlapLengthFilter(focal, { end: '3prime', min: 8, max: null }), false);
  assert.equal(passesOverlapLengthFilter(focal, { end: '3prime', min: null, max: 6 }), false);
  assert.equal(passesOverlapLengthFilter(focal, { end: '3prime', min: null, max: null }), true);
  assert.equal(passesOverlapLengthFilter(focal, null), true);
  assert.equal(passesOverlapLengthFilter({}, { end: '3prime', min: 8, max: null }), true);
  assert.equal(passesOverlapLengthFilter(focal, { end: '3prime', min: 8, max: null }, false), true);
});

test('invalid bp input is rejected without clamping, swapping or fractional rounding', () => {
  for (const text of ['-1', '1.1', '1e2', 'NaN', 'Infinity', 'abc', '9007199254740992']) {
    assert.ok(parseOverlapLengthFilter('5prime', text, '').error, text);
    assert.ok(parseOverlapLengthFilter('5prime', '', text).error, text);
  }
  assert.ok(parseOverlapLengthFilter('5prime', '8', '7').error);
  assert.ok(parseOverlapLengthFilter('other', '', '').error);
  assert.deepEqual(parseOverlapLengthFilter('3prime', ' 0 ', '9007199254740991').value,
    { end: '3prime', min: 0, max: Number.MAX_SAFE_INTEGER });
  assert.deepEqual(parseOverlapLengthFilter('5prime', '', '').value, { end: '5prime', min: null, max: null });
});

test('registry metrics exist before the late OG join and read cached values dynamically', () => {
  const genes = [{}];
  const registry = buildMetricRegistry({}, genes, {});
  for (const definition of OVERLAP_LENGTH_METRICS) {
    const metric = registry.byKey.get(definition.key);
    assert.ok(Number.isNaN(metric.read(0)));
    assert.equal(metric.unit, 'bp'); assert.equal(metric.integer, true);
    assert.equal(metric.family, 'Genomic context'); assert.equal(metric.fileKey, 'geneOverlaps');
    genes[0][metric.key] = 0; assert.equal(metric.read(0), 0);
    delete genes[0][metric.key]; assert.ok(Number.isNaN(metric.read(0)));
  }
});

test('URL and export view state round trip independently of colour without a version bump', () => {
  const state = defaultState();
  state.colorBy = 'overlapTotalNt';
  state.overlapLengthFilter = { end: '3prime', min: 0, max: 7 };
  const hash = encodeState(state);
  const restored = defaultState(); applyDecoded(restored, decodeState(hash));
  assert.equal(restored.colorBy, 'overlapTotalNt');
  assert.deepEqual(restored.overlapLengthFilter, state.overlapLengthFilter);
  assert.deepEqual(viewStateOf(restored).overlapLengthFilter, state.overlapLengthFilter);
  assert.equal(decodeState(hash).version, decodeState(encodeState(defaultState())).version);
  for (const hash of ['#ol=5prime,-1,7', '#ol=5prime,8,7', '#ol=5prime,1.1,', '#ol=other,,']) {
    const fresh = defaultState(); applyDecoded(fresh, decodeState(hash));
    assert.equal(fresh.overlapLengthFilter, null);
  }
  applyDecoded(restored, decodeState('#ver=7&c=overlap5PrimeNt'));
  assert.equal(restored.overlapLengthFilter, null, 'old and default links clear the range');
});

test('controls retain focus, invalid drafts and valid applied state across unrelated updates', async () => {
  await withFakeDocument((document) => {
    let applied = null; const owner = {};
    const ui = new OverlapLengthFilter((value) => { applied = value; });
    document.body.append(ui.element);
    ui.update({ available: true, owner });
    ui.fields.min.value = '5'; ui.commit();
    ui.update({ available: true, filter: applied, owner });
    ui.fields.min.focus();
    ui.fields.max.value = '2'; ui.commit();
    assert.equal(applied.min, 5); assert.equal(applied.max, null);
    assert.equal(ui.fields.max.getAttribute('aria-invalid'), 'true');
    ui.update({ available: false, pending: 'failed', filter: applied, owner });
    assert.equal(ui.fields.max.value, '2'); assert.equal(document.activeElement, ui.fields.min);
    assert.match(ui.note.textContent, /paused and hides no genes/);
    ui.fields.max.value = '6'; ui.commit();
    assert.deepEqual(applied, { end: '5prime', min: 5, max: 6 });
    ui.update({ available: true, filter: null, owner });
    assert.equal(ui.fields.min.value, ''); assert.equal(ui.error.hidden, true);
    ui.fields.min.value = '-1'; ui.commit();
    ui.update({ available: true, filter: null, owner: {} });
    assert.equal(ui.fields.min.value, '', 'organism/new state ownership resets an invalid draft');
  });
});

test('input, end-selection and clear events preserve bounds and announce unavailable states', async () => {
  await withFakeDocument((document) => {
    const changes = [];
    const ui = new OverlapLengthFilter((value) => changes.push(value));
    let drafts = 0;
    ui.onDraftChange = () => { drafts += 1; };
    document.body.append(ui.element);
    ui.update({ available: false, pending: 'loading' });
    assert.match(ui.note.textContent, /still loading/);
    assert.doesNotMatch(ui.note.textContent, /saved range is paused/);
    ui.fields.max.value = '0';
    ui.fields.max.dispatch('input');
    assert.deepEqual(changes.at(-1), { end: '5prime', min: null, max: 0 });
    ui.end.value = '3prime';
    ui.end.dispatch('change');
    assert.deepEqual(changes.at(-1), { end: '3prime', min: null, max: 0 });
    ui.fields.min.value = '0';
    ui.fields.min.dispatch('input');
    assert.deepEqual(changes.at(-1), { end: '3prime', min: 0, max: 0 });
    assert.equal(drafts, 3, 'each edit refreshes the parent clear-control state');
    ui.update({ available: false, filter: changes.at(-1) });
    assert.match(ui.note.textContent, /are unavailable/);
    assert.match(ui.note.textContent, /saved range is paused/);
    ui.clear.click();
    assert.equal(changes.at(-1), null);
    assert.equal(ui.end.value, '5prime');
    assert.equal(ui.fields.min.value, '');
    assert.equal(ui.fields.max.value, '');
    assert.equal(ui.clear.disabled, true);
    ui.update({ available: false, pending: 'failed' });
    assert.match(ui.note.textContent, /could not be loaded/);
    assert.doesNotMatch(ui.note.textContent, /saved range is paused/);
    ui.reset({ end: '3prime', min: null, max: 12 });
    assert.equal(ui.fields.min.value, '');
    assert.equal(ui.fields.max.value, '12');
    assert.equal(ui.end.value, '3prime');
  });
});
