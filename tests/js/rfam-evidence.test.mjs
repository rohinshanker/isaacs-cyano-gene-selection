import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRfamEvidence, rfamMarkers, rfamGeneRows, rfamNativeRuns, rfamSiteText } from '../../site/js/core/rfam-evidence.js';
import { DEFAULT_ORGANISM, organismById } from '../../site/js/core/organisms.js';
import { markerSpanNt, markerVisible, withMarkerVisible } from '../../site/js/core/marker-layers.js';
import { DATA_APPLIERS } from '../../site/js/core/dataset.js';
import { geneViewModel } from '../../site/js/core/gene-view-model.js';
import { RfamSitesPanel } from '../../site/js/ui/rfam-sites.js';
import { renderGeneViewer } from '../../site/js/ui/gene-viewer.js';
import { withFakeDocument } from './fake-dom.mjs';

export function familyPayload() {
  return {
    schemaVersion: 1, id: 'rfam-rf01116', label: 'RF01116 / Yfr1 family homology',
    origin: 'computed', measurement: 'predicted', assembly: 'GCF_000817325.1_ASM81732v1',
    family: { accession: 'RF01116', name: 'Yfr1', release: '15.1', gaBits: 38 },
    sites: [{ id: 'RF01116:NZ_CP006471.1:1364716:1364778:+', type: 'rnaFamily',
      replicon: 'NZ_CP006471.1', position: 1364716, endPosition: 1364778, strand: '+',
      origin: 'computed', measurement: 'predicted', producer: 'Infernal 1.1.5 / Rfam 15.1 RF01116',
      scoreBits: 62.1, evalue: 6.7e-12, truncation: 'no', modelStart: 1, modelEnd: 59,
      originSpanning: false, raw: { native_start: 1364716, native_end: 1364778 } }],
    provenance: { searchCoverage: { statement: 'All three native replicons searched on both strands.' },
      originJunctionSearch: { coverageNote: 'Circular junctions searched with the model window.' },
      coverageBoundary: 'Only RF01116 was evaluated.' },
    limitations: ['Family homology does not establish transcript boundaries or activity.'],
  };
}
const gene = { id: 'M744_RS07010', name: 'trxA', seqid: 'NZ_CP006471.1',
  start: 1364916, end: 1365239, strand: '+', lengthNt: 324, lengthCodons: 107,
  terminalStop: 'TAG', overlapPartners: [] };

test('loader validates native family identity, scores, coordinates and coverage without a gene join', () => {
  const payload = familyPayload();
  assert.equal(validateRfamEvidence(payload), payload);
  const snapshot = structuredClone(gene);
  const dataset = { organism: DEFAULT_ORGANISM, genes: [gene] };
  DATA_APPLIERS.rfamEvidence(dataset, payload);
  assert.equal(dataset.rfamEvidence, payload);
  assert.deepEqual(gene, snapshot);
  assert.equal(gene.rfamEvidence, undefined);
  const mutants = [
    (p) => { p.schemaVersion = 2; }, (p) => { p.assembly = 'donor'; },
    (p) => { p.family.accession = 'RF00001'; }, (p) => { p.family.gaBits = 0; },
    (p) => { p.origin = 'source'; }, (p) => { p.measurement = 'measured'; },
    (p) => { p.provenance.searchCoverage = null; }, (p) => { p.limitations = []; },
    (p) => { p.sites[0].position = 0; }, (p) => { p.sites[0].endPosition = 2690419; },
    (p) => { p.sites[0].strand = '.'; }, (p) => { p.sites[0].scoreBits = 37; },
    (p) => { p.sites[0].evalue = -1; }, (p) => { p.sites[0].modelEnd = 60; },
    (p) => { p.sites[0].originSpanning = true; }, (p) => { p.sites.push(p.sites[0]); },
    (p) => { p.sites[0].replicon = 'NC_000913.3'; }, (p) => { p.sites[0].raw = null; },
  ];
  for (const mutate of mutants) {
    const bad = familyPayload(); mutate(bad);
    assert.throws(() => validateRfamEvidence(bad), /invalid or unpinned/);
  }
  assert.throws(() => validateRfamEvidence(payload, organismById('ecoli-k12-mg1655')));
  const empty = familyPayload(); empty.sites = [];
  assert.equal(validateRfamEvidence(empty), empty, 'searched with no match remains a valid outcome');
});

test('native interval projects into existing context on both strands, clips without extending CDS', () => {
  const payload = familyPayload();
  const defaultModel = geneViewModel(gene);
  assert.deepEqual(rfamGeneRows(payload, gene, defaultModel.domain), []);
  const model = geneViewModel(gene, { upstreamNt: 240 });
  const [row] = rfamGeneRows(payload, gene, model.domain);
  assert.deepEqual(row.runs, [{ from: -200, to: -137 }]);
  assert.equal(markerSpanNt(row), 63);
  assert.deepEqual(model.segments, defaultModel.segments);
  assert.deepEqual(rfamGeneRows(payload, gene, { min: -160, max: 60 })[0].runs,
    [{ from: -160, to: -137 }]);
  const reverse = { ...gene, strand: '-', start: 1364200, end: 1364500 };
  assert.deepEqual(rfamGeneRows(payload, reverse, { min: -300, max: 300 })[0].runs,
    [{ from: -278, to: -215 }]);
  assert.deepEqual(rfamGeneRows(payload, { ...gene, seqid: 'NZ_CP006472.1' }, model.domain), []);
  assert.deepEqual(rfamGeneRows(payload, null, model.domain), []);
  assert.equal(rfamMarkers(payload)[0].geometry, 'interval');
  assert.equal(rfamMarkers(payload)[0].origin, 'computed');
  assert.match(rfamSiteText(row, payload), /62.1 bits.*GA 38 bits.*E-value 6.7e-12/);
});

test('circular family intervals retain two native pieces and oriented context at the origin', () => {
  const marker = { ...familyPayload().sites[0], replicon: 'NZ_CP006473.1', position: 7840,
    endPosition: 3, originSpanning: true, id: 'RF01116:NZ_CP006473.1:7840:3:+' };
  const payload = familyPayload(); payload.sites = [marker];
  validateRfamEvidence(payload);
  assert.deepEqual(rfamNativeRuns(marker), [{ from: 7840, to: 7842 }, { from: 1, to: 3 }]);
  assert.deepEqual(rfamGeneRows(payload, { ...gene, seqid: marker.replicon, start: 10, end: 100 },
    { min: -30, max: 90 })[0].runs, [{ from: -12, to: -9 }, { from: -9, to: -6 }]);
});

test('every RF01116 view visibility is independent of TSS, with a canonical shared-link key', () => {
  const hidden = withMarkerVisible([], 'rfam', 'gene-controls', false);
  assert.deepEqual(hidden, ['rfam.gene-controls']);
  assert.equal(markerVisible(hidden, 'rfam', 'gene-controls'), false);
  for (const view of ['chromosome', 'gene-detail', 'sequence']) assert.equal(markerVisible(hidden, 'rfam', view), true);
  assert.equal(markerVisible(hidden, 'tss', 'gene-controls'), true);
});

test('shared details distinguish loading, failure, no match, hidden evidence and unevaluated organism', async () => {
  await withFakeDocument((document) => {
    const panel = new RfamSitesPanel(); document.body.append(panel.element);
    panel.update({ organism: DEFAULT_ORGANISM, pending: 'loading' });
    assert.match(panel.status.textContent, /loading.*unknown/);
    assert.equal(panel.toggleRow.hidden, true);
    panel.update({ organism: DEFAULT_ORGANISM, pending: 'failed' });
    assert.match(panel.status.textContent, /could not be loaded.*unknown/);
    const payload = familyPayload();
    panel.update({ organism: DEFAULT_ORGANISM, payload });
    assert.match(panel.status.textContent, /No RF01116 match at GA.*does not establish no regulation/);
    let next;
    panel.update({ organism: DEFAULT_ORGANISM, payload, rows: payload.sites, visible: false,
      onChange: (value) => { next = value; } });
    assert.match(panel.status.textContent, /hidden in this view/);
    assert.match(panel.content.textContent, /full transcript ends, targets and regulatory activity are unknown/);
    const link = panel.content.querySelector('a');
    assert.equal(link.download, 'rfam_rf01116.json');
    assert.deepEqual(JSON.parse(decodeURIComponent(link.href.split(',')[1])), payload);
    panel.toggle.checked = true; panel.toggle.dispatch('change'); assert.equal(next, true);
    panel.update({ organism: organismById('ecoli-k12-mg1655'), payload });
    assert.match(panel.status.textContent, /not been evaluated/);
    assert.equal(panel.toggleRow.hidden, true); assert.equal(panel.details.hidden, true);
  });
});

test('both gene mounts draw native family context without assigning CDS ownership; hide removes focus targets', async () => {
  await withFakeDocument((document) => {
    const left = document.createElement('div'); const right = document.createElement('div');
    document.body.append(left, right);
    const payload = familyPayload();
    renderGeneViewer(left, gene, { rfamEvidence: payload, upstreamNt: 240 });
    renderGeneViewer(right, gene, { rfamEvidence: payload, upstreamNt: 240 });
    assert.equal(left.querySelectorAll('.rfam-marker').length, 1);
    assert.equal(right.querySelectorAll('.rfam-marker').length, 1);
    assert.match(left.querySelector('.rfam-marker').getAttribute('aria-label'), /1364716–1364778.*No CDS ownership assigned/);
    const control = left.querySelector('[data-detail-action="rfam-visibility"]');
    control.checked = false; control.dispatch('change');
    assert.equal(left.querySelectorAll('.rfam-marker').length, 0);
    assert.equal(right.querySelectorAll('.rfam-marker').length, 1);
    assert.match(left.textContent, /62.1 bits/);
  });
});

test('sequence uses actual columns and camera, preserves measured sites when RF01116 is hidden', async () => {
  const { GeneSequenceView } = await import('../../site/js/ui/gene-sequence-view.js');
  const { standardTable } = await import('./helpers.mjs');
  await withFakeDocument((document) => {
    const host = document.createElement('div'); document.body.append(host);
    const table = standardTable();
    const sequenceGene = { ...gene, codons: table.encode(Array(107).fill(table.indexOf('ATG'))),
      extendedUpstream: 'A'.repeat(240), rnaContext: { upstream: 'A'.repeat(30) },
      tssEvidence: [{ id: 'measured', type: 'gTSS', position: 1364730, replicon: gene.seqid,
        strand: '+', sourceStartDistanceNt: 186 }],
    };
    const view = new GeneSequenceView(host);
    view.update({ gene: sequenceGene, table: standardTable(), scheme: null, schemeVersion: 0,
      rfamEvidence: familyPayload() });
    assert.equal(host.querySelectorAll('.rfam-marker').length, 0, 'opening camera has only 30 upstream bases');
    view.setUpstreamNt(240);
    view.fitGene();
    assert.equal(host.querySelectorAll('.rfam-marker').length, 1);
    const measured = host.querySelectorAll('.gene-sequence-marker').length;
    assert.equal(measured, 1);
    const toggle = view.rfamPanel.toggle;
    toggle.checked = false; toggle.dispatch('change');
    assert.equal(host.querySelectorAll('.rfam-marker').length, 0);
    assert.equal(host.querySelectorAll('.gene-sequence-marker').length, measured);
    assert.match(view.rfamPanel.status.textContent, /hidden/);
    assert.match(view.rfamPanel.content.textContent, /not been recomputed for the active recoding scheme/);
  });
});

test('compact viewer retains RF01116 checkbox focus across caller rebuilds and returns it safely when context has no match', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div'); document.body.append(host);
    const options = { rfamEvidence: familyPayload(), upstreamNt: 240 };
    renderGeneViewer(host, gene, options);
    const checkbox = host.querySelector('[data-detail-action="rfam-visibility"]');
    checkbox.focus();
    renderGeneViewer(host, gene, options);
    assert.equal(document.activeElement, checkbox);
    renderGeneViewer(host, { ...gene, start: 10000, end: 10323 }, options);
    assert.equal(document.activeElement, host);
    renderGeneViewer(host, gene, options);
    host.querySelector('[data-detail-action="rfam-visibility"]').focus();
    renderGeneViewer(host, null, options);
    assert.equal(document.activeElement, host);
  });
});
