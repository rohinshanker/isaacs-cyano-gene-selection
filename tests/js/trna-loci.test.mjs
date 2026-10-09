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
  globalThis.ResizeObserver = class { observe() {} };
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
    assert.equal(viewer.list.children.length, 44, 'candidate is hidden by default');
  });
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
