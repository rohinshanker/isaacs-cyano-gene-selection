/**
 * Turn filters off: a reversible bypass that keeps every criterion, includes
 * every gene, and ends on the reader's next criteria change and never on a
 * redraw.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withFakeDocument } from './fake-dom.mjs';
import {
  filterCriteriaSignature, reconcileFilterBypass, effectiveFilterMask, filterStatusVisible,
  filterStatusTitle, bypassedStatusText, chromosomeFilterStatusText,
  FILTER_STATUS_TITLE, FILTER_STATUS_BYPASSED_TITLE,
} from '../../site/js/core/filter-bypass.js';
import { FilterStatus, filterStatusElement } from '../../site/js/ui/filter-status.js';
import {
  encodeState, decodeState, applyDecoded, defaultState, viewStateOf,
} from '../../site/js/core/url-state.js';
import { clearedFilterState } from '../../site/js/ui/filters.js';

const configured = () => ({
  ...defaultState(),
  filters: { gc3: { min: 0.3, max: null, includeMissing: true } },
  exceptionFilter: 'none',
});

test('the signature moves for every criterion and for nothing else', () => {
  const base = configured();
  const signature = filterCriteriaSignature(base);
  // View-only changes: none of these is a filtering criterion.
  for (const change of [
    { panel: 'chromosome' }, { showHidden: false }, { colorBy: 'cai' },
    { trafficKey: 'cai' }, { panelCollapsed: [] }, { pinnedId: 'x' }, { shortlist: ['x'] },
    { filtersBypassed: true }, { goTerm: 'GO:0000001' },
  ]) {
    assert.equal(filterCriteriaSignature({ ...base, ...change }), signature, JSON.stringify(change));
  }
  // Every criterion, built-in or custom, including the source a range is judged by.
  for (const change of [
    { filters: { gc3: { min: 0.4, max: null, includeMissing: true } } },
    { filters: { gc3: { min: 0.3, max: null, includeMissing: false } } },
    { filters: {} },
    { filters: { ...base.filters, cai: { min: null, max: null, includeMissing: true } } },
    { typeSources: { gc3: 'OTHER_SOURCE' } },
    { typeSources: { gc3: 'OTHER_SOURCE', cai: 'X' } },
    { exceptionFilter: 'any' }, { expressionFilter: 'measured' }, { proteinFilter: 'refseq' },
    { neighborSiteFilter: 'with' }, { neighborSiteCountFilter: { min: 2, max: null } },
    { overlapClassFilter: ['convergent'] },
    { overlapLengthFilter: { end: '5prime', min: 1, max: null } },
    { pccEssentialityFilter: ['essential'] }, { categoryFilter: ['photosynthesis'] },
    { goTerm: 'GO:0000001', goEvidenceFilter: 'with' },
  ]) {
    assert.notEqual(filterCriteriaSignature({ ...base, ...change }), signature, JSON.stringify(change));
  }
  // The requested datasets a filtered type reads, in any order, are part of it.
  const pools = (ids) => ({ contributorsOf: (key) => (key === 'gc3' ? ids : null) });
  assert.notEqual(filterCriteriaSignature(base, pools(['A'])), filterCriteriaSignature(base, pools(['A', 'B'])));
  assert.equal(filterCriteriaSignature(base, pools(['B', 'A'])), filterCriteriaSignature(base, pools(['A', 'B'])));
  // Other reader choices an active channel reads are part of it too (R5).
  const deps = (dependencies) => filterCriteriaSignature(base, { dependencies });
  assert.notEqual(deps({ categorySources: ['a'] }), deps({ categorySources: ['a', 'b'] }));
  assert.notEqual(deps({ neighborSources: true }), deps({ neighborSources: false }));
  assert.equal(deps({ categorySources: null }), deps({ categorySources: null }));
  // Set order is not a change.
  assert.equal(
    filterCriteriaSignature({ ...base, categoryFilter: ['b', 'a'] }),
    filterCriteriaSignature({ ...base, categoryFilter: ['a', 'b'] }),
  );
});

test('a bypass is kept across redraws and ended by a criteria change', () => {
  const off = reconcileFilterBypass({ bypassed: false, recorded: 'x' }, 's1');
  assert.deepEqual(off, { bypassed: false, recorded: null, reactivated: false });
  const adopted = reconcileFilterBypass({ bypassed: true, recorded: null }, 's1');
  assert.deepEqual(adopted, { bypassed: true, recorded: 's1', reactivated: false },
    'a bypass read from a link adopts its criteria');
  assert.deepEqual(reconcileFilterBypass(adopted, 's1'), adopted, 'a redraw keeps it');
  assert.deepEqual(reconcileFilterBypass(adopted, 's2'),
    { bypassed: false, recorded: null, reactivated: true });
});

test('the effective mask includes every gene only while bypassed', () => {
  const mask = Uint8Array.from([1, 0, 1, 0]);
  assert.equal(effectiveFilterMask(mask, false), mask);
  const all = effectiveFilterMask(mask, true);
  assert.deepEqual([...all], [1, 1, 1, 1]);
  assert.deepEqual([...mask], [1, 0, 1, 0], 'the configured mask is not altered');
});

test('the section stays visible while bypassed, even when nothing would be hidden', () => {
  assert.equal(filterStatusVisible({ configuredHidden: 0, bypassed: false }), false);
  assert.equal(filterStatusVisible({ configuredHidden: 3, bypassed: false }), true);
  assert.equal(filterStatusVisible({ configuredHidden: 0, bypassed: true }), true);
  assert.equal(filterStatusTitle(false), FILTER_STATUS_TITLE);
  assert.equal(filterStatusTitle(true), 'Filter status (temporarily disabled)');
  assert.match(bypassedStatusText({ total: 2715, configuredHidden: 900 }),
    /all 2,715 genes are included\. Turned back on, the configured filters hide 900 of them\./);
  assert.match(bypassedStatusText({ total: 10, configuredHidden: 0 }), /hide none of them/);
  assert.equal(chromosomeFilterStatusText({ hidden: 0, total: 9, showHidden: true }), '');
  assert.equal(chromosomeFilterStatusText({ hidden: 2, total: 9, showHidden: false }),
    'Filters hide 2 of 9 genes.');
  assert.match(chromosomeFilterStatusText({ hidden: 2, total: 9, showHidden: true }), /muted marks/);
});

test('a bypass round-trips through a link and an export view, and is silent when off', () => {
  const state = configured();
  assert.ok(!encodeState(state).includes('fo='), 'filters on writes no field');
  state.filtersBypassed = true;
  const hash = encodeState(state);
  assert.match(hash, /(^|&)fo=1(&|$)/);
  const restored = applyDecoded(defaultState(), decodeState(hash));
  assert.equal(restored.filtersBypassed, true);
  assert.deepEqual(restored.filters, state.filters, 'the configured criteria come back too');
  assert.equal(restored.exceptionFilter, 'none');
  assert.equal(applyDecoded(defaultState(), decodeState('#ver=9&p=native')).filtersBypassed, false);
  assert.equal(viewStateOf(state).filtersBypassed, true);
  assert.equal(viewStateOf(configured()).filtersBypassed, false);
  assert.equal(clearedFilterState().filtersBypassed, false, 'Clear all filters also ends a bypass');
});

test('the shared section updates in place, keeping its element, open state and toggle', async () => {
  await withFakeDocument(async (document) => {
    const details = filterStatusElement('chromosome-filter-status');
    document.body.append(details);
    const changes = [];
    const status = new FilterStatus(details, { idPrefix: 'chromosome-filter-status', onBypassChange: (v) => changes.push(v) });
    assert.equal(details.hidden, true);
    status.update({ visible: true, bypassed: false, text: 'Filters hide 2 of 9 genes.' });
    const toggle = details.querySelector('input.filter-bypass');
    const summary = details.querySelector('summary');
    assert.equal(details.hidden, false);
    assert.equal(summary.textContent, FILTER_STATUS_TITLE);
    assert.equal(toggle.checked, false);
    assert.equal(details.querySelector('label').textContent, 'Turn filters off');
    assert.equal(details.querySelector('label').htmlFor, toggle.id);
    assert.equal(details.querySelector('p.filter-banner').getAttribute('role'), 'status');

    details.open = true;
    toggle.checked = true;
    toggle.dispatch('change');
    assert.deepEqual(changes, [true]);
    status.update({ visible: true, bypassed: true, text: 'Filters are temporarily off.' });
    assert.equal(summary.textContent, FILTER_STATUS_BYPASSED_TITLE);
    assert.equal(details.querySelector('input.filter-bypass'), toggle, 'the toggle element is kept');
    assert.equal(details.open, true, 'an update does not close it');
    assert.equal(toggle.checked, true);

    status.update({ visible: false, bypassed: false, text: '' });
    assert.equal(details.hidden, true);
    assert.equal(details.open, false, 'a hidden section does not come back open');
  });
});
