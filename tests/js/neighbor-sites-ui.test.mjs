import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withFakeDocument } from './fake-dom.mjs';
import { NeighborSitePanel, renderNeighborSiteLegend, drawNeighborSiteMarks } from '../../site/js/ui/neighbor-sites.js';
import { indexNativeSites, neighborSiteModel } from '../../site/js/core/neighbor-sites.js';
import { DEFAULT_ORGANISM } from '../../site/js/core/organisms.js';
import { renderGeneViewer } from '../../site/js/ui/gene-viewer.js';
const focal = { id: 'focal', strand: '+', seqid: 'NZ_CP006471.1', start: 10, end: 30, lengthNt: 21,
  lengthCodons: 6, terminalStop: 'TGA', tssEvidence: [] };
const other = { ...focal, id: 'owner' };
const records = ['+', '-'].map((strand) => ({ locus: 'owner', row: { id: `site${strand}`, type: 'gTSS',
  position: 15, replicon: 'CP006471', strand, rawReads: { control: [0, 2] } }, source: { doi: 'test', conditions: { control: 'original condition' } } }));
const model = neighborSiteModel({ genes: [focal,other], neighborSites: indexNativeSites([focal,other], records, DEFAULT_ORGANISM) }, { sources: ['TAN2018_TSS_CONTROL'] });

test('dense/coincident lists retain both sites, navigate owners and expose complete lazy provenance', async () => {
  await withFakeDocument((document) => {
    const panel = new NeighborSitePanel(); document.body.append(panel.element);
    const opened = []; panel.update(model, focal, (id,index) => opened.push([id,index]));
    assert.match(panel.summary.textContent, /2 distinct sites/);
    assert.equal(panel.list.children.length, 2);
    panel.list.querySelector('button').click(); assert.deepEqual(opened, [['owner',1]]);
    const provenance = panel.list.querySelector('details');
    assert.equal(provenance.querySelectorAll('dl').length, 0);
    provenance.open = true; provenance.dispatch('toggle');
    assert.match(provenance.textContent, /original condition/);
    assert.match(provenance.textContent, /\[0,2\]/);
    provenance.dispatch('toggle'); assert.equal(provenance.querySelectorAll('dl').length, 2);
    panel.element.open = true; panel.summary.focus(); panel.update(model, focal, () => {});
    assert.equal(document.activeElement, panel.summary); assert.equal(panel.element.open, true);
    const unknown = neighborSiteModel({ genes:[focal,other] }); panel.update(unknown, focal, () => {});
    assert.equal(panel.list.children.length, 0); assert.match(panel.summary.textContent, /unavailable/);
    assert.equal(document.activeElement, panel.summary);
  });
});

test('compact marks stay exact, visibility hides targets but retains evidence and focus', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div'); document.body.append(host);
    renderGeneViewer(host, focal, { neighborSites:model, startSitesVisible: true });
    const marks = host.querySelectorAll('g.neighbor-site-mark');
    assert.equal(marks.length, 2);
    assert.equal(host.querySelectorAll('.gene-view-key-neighbor-site').length, 1);
    for (const mark of marks) {
      assert.equal(mark.getAttribute('data-position'), '15');
      assert.equal(mark.getAttribute('tabindex'), '0');
      assert.match(mark.getAttribute('aria-label'), /source-associated: owner/);
      assert.match(mark.getAttribute('aria-label'), /Purple line at the exact source base/);
      const tick = mark.querySelector('.neighbor-site-tick');
      assert.equal(tick.getAttribute('x1'), tick.getAttribute('x2'));
      assert.equal(Number(tick.getAttribute('y2')) - Number(tick.getAttribute('y1')), 10);
      assert.equal(mark.querySelectorAll('path').length, 0);
      assert.equal(mark.querySelector('.neighbor-site-halo').getAttribute('stroke'), '#ffffff');
    }
    const summary = host.querySelector('details.neighbor-site-details').querySelector('summary');
    summary.focus(); renderGeneViewer(host, focal, { neighborSites:model });
    assert.equal(document.activeElement, summary);
    renderGeneViewer(host, focal, { neighborSites:model, startSitesVisible:false });
    assert.equal(host.querySelectorAll('g.neighbor-site-mark').length, 0);
    assert.equal(host.querySelectorAll('.gene-view-key-neighbor-site').length, 0);
    assert.match(host.textContent, /marks are hidden/);
    renderGeneViewer(host, null, { neighborSites:model }); assert.equal(document.activeElement,host);
  });
});

test('legend lists each count present, coloured as drawn, with unknown apart from zero', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div'); renderNeighborSiteLegend(host, model);
    assert.deepEqual([...model.siteCounts], [2, 0],
      'opposite-strand sites at one base are two distinct sites; the owner holds none of another gene');
    assert.match(host.textContent, /0 sites \(1 gene\)/);
    assert.match(host.textContent, /2 sites \(1 gene\)/);
    assert.match(host.textContent, /Evidence unavailable \(0\)/, 'listed at zero, as the filter lists it');
    const colours = { 0: '#000000', 3: '#333333' };
    renderNeighborSiteLegend(host, { ...model, siteCounts: Float64Array.from([0, 3, 3, Number.NaN]) },
      { hiddenCount: 2112, scale: { color: (value) => colours[value] } });
    assert.match(host.textContent, /0 sites \(1 gene\)/);
    assert.match(host.textContent, /3 sites \(2 genes\)/);
    assert.match(host.textContent, /Evidence unavailable \(1\)/);
    assert.match(host.textContent, /same and opposite strand counted alike/);
    assert.match(host.textContent, /2,112 excluded by filters/);
    const root = document.createElementNS('svg','svg');
    drawNeighborSiteMarks(root, model.forGene(focal).sites, focal, () => null, 10);
    assert.equal(root.querySelectorAll('g.neighbor-site-mark').length, 0);
  });
});

test('unassigned and unresolved rows retain evidence without offering a nonexistent marker', async () => {
  await withFakeDocument((document) => {
    const unknownRecords = [
      { ...records[0], locus: null },
      { ...records[1], locus: 'unresolved', nativeAssociation: false },
    ];
    const unknown = neighborSiteModel({ genes: [focal],
      neighborSites: indexNativeSites([focal], unknownRecords, DEFAULT_ORGANISM),
    }, { sources: ['TAN2018_TSS_CONTROL'] });
    const panel = new NeighborSitePanel();
    panel.update(unknown, focal, () => {}, () => assert.fail('no marker can be revealed'));
    assert.equal(panel.list.children.length, 2);
    assert.equal(panel.list.querySelectorAll('button').length, 0);
    assert.match(panel.summary.textContent, /0 distinct sites/);
    assert.match(panel.list.textContent, /excluded from neighbouring-gene counts and markers/);
    assert.equal(panel.list.querySelectorAll('.neighbor-site-provenance').length, 2);
  });
});
