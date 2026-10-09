import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  clusterTrnaMarkers, matchesTrnaFilters, overlappingTrnas, validateTrnaPayload,
} from '../../site/js/core/trna-loci.js';
import { TrnaViewer } from '../../site/js/ui/trna-viewer.js';
import { FakeElement, withFakeDocument } from './fake-dom.mjs';

const payload = JSON.parse(readFileSync(
  new URL('../../site/data/trna-loci-v1.json', import.meta.url),
));
const appCss = readFileSync(new URL('../../site/css/app.css', import.meta.url), 'utf8');

function detailFact(viewer, label) {
  const facts = viewer.detail.querySelector('dl');
  const termIndex = facts.children.findIndex((node) => node.textContent === label);
  assert.notEqual(termIndex, -1, `${label} is absent from the tRNA detail`);
  return facts.children[termIndex + 1].textContent;
}

test('published payload preserves 44 annotated loci and one distinct candidate', () => {
  assert.equal(validateTrnaPayload(payload, {
    organismId: 'utex2973', assembly: 'GCF_000817325.1',
  }), payload);
  assert.deepEqual(payload.counts, { annotated: 44, predictedCandidates: 1, totalRecords: 45 });
  const candidate = payload.loci.find((locus) => locus.kind === 'scan-only-candidate');
  assert.equal(candidate.locusTag, null);
  assert.equal(candidate.pseudo, true);
  assert.equal(candidate.scanIsotype, 'Undet');
  assert.equal(candidate.scanAnticodon, 'NNN');
  assert.match(candidate.id, /trnascan-se-2\.0\.12.*NZ_CP006471\.1:2275064-2275124:\+$/);
  assert.deepEqual(new Set(payload.loci.map((locus) => locus.strand)), new Set(['+', '-']));
  assert.equal(payload.loci.every((locus) => locus.sequence.length === locus.lengthNt), true);
});

test('payload validation refuses identity drift, candidate fabrication, and sequence drift', () => {
  assert.throws(() => validateTrnaPayload(payload, { organismId: 'other' }), /belongs to/);
  const fabricated = structuredClone(payload);
  fabricated.loci.find((locus) => locus.kind === 'scan-only-candidate').locusTag = 'FAKE_RS00001';
  assert.throws(() => validateTrnaPayload(fabricated), /scan-only pseudogene candidate/);
  const brokenSequence = structuredClone(payload);
  brokenSequence.loci[0].sequence = brokenSequence.loci[0].sequence.slice(1);
  assert.throws(() => validateTrnaPayload(brokenSequence), /invalid sequence or length/);
});

test('search and recorded-field filters preserve source-specific labels', () => {
  const ile2 = payload.loci.find((locus) => locus.scanIsotype === 'Ile2');
  const fmet = payload.loci.find((locus) => locus.scanIsotype === 'fMet');
  assert.equal(matchesTrnaFilters(ile2, { query: 'ile2' }), true);
  assert.equal(matchesTrnaFilters(fmet, { query: 'fmet', strand: '-' }), true);
  assert.equal(matchesTrnaFilters(ile2, { query: 'LAT' }), true);
  assert.equal(matchesTrnaFilters(ile2, { anticodon: 'CAT' }), true);
  assert.equal(matchesTrnaFilters(ile2, { isotype: 'Ile2' }), true);
  assert.equal(matchesTrnaFilters(ile2, { isotype: 'Ile' }), true);
  assert.equal(matchesTrnaFilters(fmet, { isotype: 'fMet' }), true);
  assert.equal(matchesTrnaFilters(fmet, { isotype: 'Met' }), true);
  assert.equal(matchesTrnaFilters(ile2, { strand: '-' }), false);
});

test('track clustering discloses shared pixels and separates as the window narrows', () => {
  const loci = [
    { id: 'a', kind: 'refseq', replicon: 'chr', start: 100, end: 110 },
    { id: 'b', kind: 'refseq', replicon: 'chr', start: 120, end: 130 },
    { id: 'c', kind: 'scan-only-candidate', replicon: 'chr', start: 900, end: 910 },
  ];
  const whole = clusterTrnaMarkers(loci, { replicon: 'chr', from: 1, to: 1000 }, 100);
  assert.deepEqual(whole.map((group) => group.loci.map((locus) => locus.id)), [['a', 'b'], ['c']]);
  assert.equal(whole[1].candidate, true);
  const zoomed = clusterTrnaMarkers(loci, { replicon: 'chr', from: 80, to: 160 }, 300);
  assert.deepEqual(zoomed.map((group) => group.loci.map((locus) => locus.id)), [['a'], ['b']]);
});

test('overlap checks are inclusive and never join to a nearby CDS', () => {
  const a = { id: 'a', replicon: 'chr', start: 10, end: 20 };
  const b = { id: 'b', replicon: 'chr', start: 20, end: 25 };
  const c = { id: 'c', replicon: 'chr', start: 21, end: 30 };
  assert.deepEqual(overlappingTrnas(a, [a, b, c]).map((row) => row.id), ['b']);
});

async function withTrnaDom(body) {
  const previous = { ResizeObserver: globalThis.ResizeObserver, CSS: globalThis.CSS };
  globalThis.ResizeObserver = class {
    constructor(callback) { this.callback = callback; }
    observe() {}
  };
  globalThis.CSS = { escape: (value) => value };
  const previousRect = FakeElement.prototype.getBoundingClientRect;
  FakeElement.prototype.getBoundingClientRect = () => ({ width: 600, left: 0, top: 0 });
  try {
    return await withFakeDocument(body);
  } finally {
    globalThis.ResizeObserver = previous.ResizeObserver;
    globalThis.CSS = previous.CSS;
    FakeElement.prototype.getBoundingClientRect = previousRect;
  }
}

test('viewer distinguishes loading, failure with retry, unavailable, and ready states', async () => {
  await withTrnaDom((document) => {
    const host = new FakeElement('div');
    document.body.append(host);
    let retries = 0;
    const viewer = new TrnaViewer(host, { onRetry: () => { retries += 1; } });
    viewer.update({ fileState: 'loading' });
    assert.match(viewer.status.textContent, /Loading the optional tRNA layer/);
    viewer.update({ fileState: 'failed', fileError: new Error('network') });
    assert.match(viewer.status.textContent, /could not be loaded: network/);
    viewer.status.querySelector('button').dispatch('click');
    assert.equal(retries, 1);
    viewer.update({ fileState: 'absent' });
    assert.match(viewer.status.textContent, /does not publish/);
    viewer.update({ payload, fileState: 'ready', viewport: {
      replicon: 'NZ_CP006471.1', from: 1, to: 2690418,
    } });
    assert.match(viewer.countSummary.textContent, /44 RefSeq-annotated loci/);
    assert.match(viewer.countSummary.textContent, /1 additional predicted pseudogene candidate/);
    assert.equal(viewer.resultsSummary.textContent, '44 loci are shown.');
    assert.equal(viewer.list.children.length, 44, 'candidate is hidden by default');
    viewer.filters.query = 'no such locus';
    viewer.renderContent();
    assert.equal(viewer.resultsSummary.textContent, '0 loci are shown.');
    viewer.filters.query = 'M744_RS00070';
    viewer.renderContent();
    assert.equal(viewer.resultsSummary.textContent, '1 locus is shown.');
  });
});

test('viewer keeps RefSeq and scan isotype labels separate in filters and detail', async () => {
  await withTrnaDom((document) => {
    const host = new FakeElement('div');
    document.body.append(host);
    const viewer = new TrnaViewer(host);
    viewer.update({ payload, fileState: 'ready', viewport: {
      replicon: 'NZ_CP006471.1', from: 1, to: 2690418,
    } });
    const options = viewer.isotype.select.children.map((node) => node.textContent);
    for (const label of ['Ile', 'Ile2', 'Met', 'fMet']) assert.ok(options.includes(label));

    const fmet = payload.loci.find((locus) => locus.scanIsotype === 'fMet');
    viewer.selectLocus(fmet);
    assert.equal(detailFact(viewer, 'RefSeq isotype'), 'Met');
    assert.equal(detailFact(viewer, 'Scan isotype'), 'fMet');

    const ile2 = payload.loci.find((locus) => locus.scanIsotype === 'Ile2');
    viewer.selectLocus(ile2);
    assert.equal(detailFact(viewer, 'RefSeq isotype'), 'Ile');
    assert.equal(detailFact(viewer, 'Scan isotype'), 'Ile2');
  });
});

test('filtered tracks contain only reachable list loci and clusters focus a matching row', async () => {
  await withTrnaDom((document) => {
    const host = new FakeElement('div');
    document.body.append(host);
    const announcements = [];
    const viewer = new TrnaViewer(host, { onAnnounce: (message) => announcements.push(message) });
    viewer.update({ payload, fileState: 'ready', viewport: {
      replicon: 'NZ_CP006471.1', from: 1, to: 2690418,
    } });

    viewer.filters.strand = '+';
    viewer.renderContent();
    const plusRows = new Set(viewer.list.querySelectorAll('.trna-row')
      .map((row) => row.dataset.trnaId));
    const plusMarkers = viewer.trackMarkers.querySelectorAll('.trna-marker');
    for (const marker of plusMarkers) {
      const ids = marker.dataset.trnaIds.split('\n');
      assert.equal(ids.every((id) => plusRows.has(id)), true);
      assert.equal(ids.some((id) => id.includes('M744_RS11570')), false);
    }

    viewer.filters.strand = '-';
    viewer.renderContent();
    const target = viewer.trackMarkers.querySelectorAll('.trna-marker')
      .find((marker) => marker.dataset.trnaIds.includes('M744_RS11570'));
    assert.ok(target, 'the filtered minus-strand cluster remains on the track');
    assert.equal(target.dataset.trnaIds.split('\n').length, 3);
    target.dispatch('click');
    assert.equal(document.activeElement.hasClass('trna-row'), true);
    assert.ok(target.dataset.trnaIds.split('\n').includes(document.activeElement.dataset.trnaId));
    assert.match(announcements.at(-1), /first locus in the filtered list is focused/);
  });
});

test('track marker focus survives the resize observer rerender', async () => {
  await withTrnaDom((document) => {
    const host = new FakeElement('div');
    document.body.append(host);
    const viewer = new TrnaViewer(host);
    viewer.update({ payload, fileState: 'ready', viewport: {
      replicon: 'NZ_CP006471.1', from: 1, to: 2690418,
    } });
    const original = viewer.trackMarkers.querySelector('.trna-marker');
    const originalIds = original.dataset.trnaIds.split('\n');
    original.focus();
    viewer.resizeObserver.callback();
    assert.notEqual(document.activeElement, original);
    assert.equal(document.activeElement.hasClass('trna-marker'), true);
    assert.equal(document.activeElement.isConnected, true);
    assert.equal(document.activeElement.dataset.trnaIds.split('\n')
      .some((id) => originalIds.includes(id)), true);
  });
});

test('tRNA filters use an even stacked-label grid without narrow select columns', () => {
  const rules = appCss.slice(appCss.indexOf('.trna-filters {'), appCss.indexOf('#length-view'));
  assert.match(rules, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(rules, /\.trna-filters \.field-row \{\n  display: grid;\n  grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(rules, /\.trna-search-field \{ grid-column: 1 \/ -1; \}/);
  assert.match(rules, /\.trna-filters select \{ width: 100%; min-width: 0; \}/);
  assert.match(rules, /@media \(max-width: 600px\) \{\n  \.trna-filters \{ grid-template-columns: 1fr; \}\n  \.trna-search-field \{ grid-column: auto; \}/);
});

test('viewer selection is independent and retained across filters', async () => {
  await withTrnaDom((document) => {
    const host = new FakeElement('div');
    document.body.append(host);
    const revealed = [];
    const viewer = new TrnaViewer(host, { onReveal: (locus) => revealed.push(locus.id) });
    viewer.update({ payload, fileState: 'ready', viewport: {
      replicon: 'NZ_CP006471.1', from: 1, to: 2690418,
    } });
    const first = payload.loci.find((locus) => locus.kind === 'refseq');
    viewer.selectLocus(first);
    assert.deepEqual(revealed, [first.id]);
    assert.equal(viewer.selectedId, first.id);
    assert.match(viewer.detail.textContent, new RegExp(first.locusTag));
    viewer.filters.query = 'no such locus';
    viewer.renderContent();
    assert.equal(viewer.list.children.length, 1);
    assert.match(viewer.resultsSummary.textContent, /selected locus is retained/);
    assert.equal(viewer.selectedId, first.id, 'filters do not change selection');
  });
});

test('candidate opt-in exposes an undetermined, pseudo, scan-only detail without a RefSeq id', async () => {
  await withTrnaDom((document) => {
    const host = new FakeElement('div');
    document.body.append(host);
    const viewer = new TrnaViewer(host);
    viewer.update({ payload, fileState: 'ready', viewport: {
      replicon: 'NZ_CP006471.1', from: 2200000, to: 2300000,
    } });
    viewer.showCandidate = true;
    viewer.renderContent();
    const candidate = payload.loci.find((locus) => locus.kind === 'scan-only-candidate');
    viewer.selectLocus(candidate);
    assert.match(viewer.detail.textContent, /Scan-only predicted pseudogene candidate/);
    assert.match(viewer.detail.textContent, /None — scan-only candidate/);
    assert.match(viewer.detail.textContent, /Undetermined \(Undet\)/);
    assert.match(viewer.detail.textContent, /Undetermined \(NNN\)/);
    assert.doesNotMatch(viewer.detail.textContent, /probability|mature structure|3D/i);
  });
});
