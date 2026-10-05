/**
 * The organism selector and the page's statement of which organism it shows.
 *
 * Rendered against the test document. What the browser adds on top of this,
 * the focus ring, the navigation itself, and the layout at each width, is the
 * rendered check in docs/validation/organism-selector.md.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ORGANISM, ORGANISMS, organismById } from '../../site/js/core/organisms.js';
import {
  applyGeneCount, applyOrganismIdentity, rememberView, renderOrganismSelector, searchCopy,
} from '../../site/js/ui/organism-selector.js';
import { describeGeneView, renderGeneViewer } from '../../site/js/ui/gene-viewer.js';
import { geneViewModel } from '../../site/js/core/gene-view-model.js';
import { RegulatorySitesPanel } from '../../site/js/ui/regulatory-sites.js';
import { FakeElement, withFakeDocument } from './fake-dom.mjs';

const ECOLI = organismById('ecoli-k12-mg1655');

function memoryStore() {
  const values = new Map();
  return {
    read: (key, fallback) => (values.has(key) ? values.get(key) : fallback),
    write: (key, value) => {
      values.set(key, value);
      return true;
    },
  };
}

/** Draw the selector for `current` on the page at `search`. */
function selectorFor(current, search, store = memoryStore()) {
  const host = new FakeElement('nav');
  renderOrganismSelector(host, { current, location: { pathname: '/site/', search }, store });
  const options = host.querySelectorAll('a');
  return { host, options, store, identity: host.querySelector('span') };
}

test('the selector offers both organisms, Cyanobacteria first and selected by default', async () => {
  await withFakeDocument(() => {
    const { options, identity } = selectorFor(DEFAULT_ORGANISM, '');
    assert.deepEqual(options.map((option) => option.textContent), ['Cyanobacteria', 'E. coli']);
    assert.deepEqual(options.map((option) => option.dataset.organism), ORGANISMS.map((o) => o.id));
    assert.deepEqual(options.map((option) => option.getAttribute('aria-current')), ['page', null]);
    assert.ok(options[0].classList.contains('active'));
    assert.ok(!options[1].classList.contains('active'));
    // Each is a link, which is what makes it keyboard-operable, styled as the page's chips are.
    for (const option of options) {
      assert.equal(option.tagName, 'a');
      assert.ok(option.classList.contains('chip-button'));
      assert.ok(option.classList.contains('organism-option'));
    }
    assert.deepEqual(options.map((option) => option.href), ['/site/', '/site/?org=ecoli-k12-mg1655']);
    // The strain and reference assembly of the organism in view, species in italics.
    assert.equal(identity.id, 'organism-identity');
    assert.equal(identity.textContent, 'Synechococcus elongatus UTEX 2973 · GCF_000817325.1');
    assert.equal(identity.querySelector('i').textContent, 'Synechococcus elongatus');
  });
});

test('in the E. coli view the selector names E. coli and nothing of the other organism', async () => {
  await withFakeDocument(() => {
    const { options, identity } = selectorFor(ECOLI, '?org=ecoli-k12-mg1655');
    assert.deepEqual(options.map((option) => option.getAttribute('aria-current')), [null, 'page']);
    assert.ok(options[1].classList.contains('active'));
    assert.deepEqual(options.map((option) => option.href), ['/site/', '/site/?org=ecoli-k12-mg1655']);
    assert.equal(identity.textContent, 'Escherichia coli K-12 MG1655 · GCF_000005845.2');
    assert.ok(!/Synechococcus|UTEX|GCF_000817325/.test(identity.textContent));
  });
});

test('the option for the organism in view goes nowhere, and the other follows its link', async () => {
  await withFakeDocument(() => {
    const { options } = selectorFor(DEFAULT_ORGANISM, '');
    let prevented = 0;
    options[0].dispatch('click', { preventDefault: () => { prevented += 1; } });
    assert.equal(prevented, 1, 'already here: a reload would discard the view on screen');
    let followed = 0;
    options[1].dispatch('click', { preventDefault: () => { followed += 1; } });
    assert.equal(followed, 0, 'the other organism is an ordinary navigation');
  });
});

test('a switch returns to the view that organism was last left in, as saved by any tab', async () => {
  await withFakeDocument(() => {
    const store = memoryStore();
    rememberView(store, ECOLI, 'ver=6&p=umap&g=b0002');
    const { options } = selectorFor(DEFAULT_ORGANISM, '?load-min=0', store);
    assert.equal(options[1].href, '/site/?org=ecoli-k12-mg1655&load-min=0#ver=6&p=umap&g=b0002');
    // Another tab leaves E. coli on a different view after this page drew its link.
    rememberView(store, ECOLI, 'ver=6&p=chromosome');
    options[1].dispatch('click', {});
    assert.equal(options[1].href, '/site/?org=ecoli-k12-mg1655&load-min=0#ver=6&p=chromosome',
      'the address is refreshed as the link is activated');
    // The view this page is leaving is its own organism's, never carried across.
    assert.ok(!/M744|cs=/.test(options[1].href));
  });
});

/** A page with the nodes the identity rewrite reaches, each by its id. */
function fakePage() {
  const nodes = new Map();
  const node = (id, text, tag = 'span') => {
    const element = new FakeElement(tag);
    element.textContent = text;
    nodes.set(id, element);
    return element;
  };
  const description = new FakeElement('meta');
  description.setAttribute('content', DEFAULT_ORGANISM.description);
  node('site-title', DEFAULT_ORGANISM.title, 'h1');
  node('organism-species', DEFAULT_ORGANISM.species, 'i');
  node('organism-strain', DEFAULT_ORGANISM.strain);
  node('gene-count-phrase', 'about 2,700');
  node('gene-search-hint', searchCopy(DEFAULT_ORGANISM).hint, 'p');
  node('annotation-source-hint', DEFAULT_ORGANISM.copy.annotationSourceHint, 'p');
  nodes.set('gene-search', new FakeElement('input'));
  const removed = [];
  nodes.get('annotation-source-hint').remove = () => {
    removed.push('annotation-source-hint');
    nodes.delete('annotation-source-hint');
  };
  return {
    title: DEFAULT_ORGANISM.title,
    documentElement: new FakeElement('html'),
    getElementById: (id) => nodes.get(id) ?? null,
    querySelector: (selector) => (selector === 'meta[name="description"]' ? description : null),
    nodes, removed, description,
  };
}

test('the page is rewritten for E. coli before any data is asked for', () => {
  const page = fakePage();
  applyOrganismIdentity(page, ECOLI);
  assert.equal(page.title, 'Escherichia coli recoding-diversity map');
  assert.equal(page.description.getAttribute('content'), ECOLI.description);
  assert.equal(page.documentElement.dataset.organism, 'ecoli-k12-mg1655');
  assert.equal(page.nodes.get('site-title').textContent, 'Escherichia coli recoding-diversity map');
  assert.equal(page.nodes.get('organism-species').textContent, 'Escherichia coli');
  assert.equal(page.nodes.get('organism-strain').textContent, 'K-12 MG1655');
  // It has no function categories to search, and no colour sources to describe.
  assert.equal(page.nodes.get('gene-search').getAttribute('placeholder'), 'Locus, product, or GO term');
  assert.ok(!/categor|rubisco/.test(page.nodes.get('gene-search-hint').textContent));
  assert.match(page.nodes.get('gene-search-hint').textContent, /nicknames such as rnap/);
  assert.deepEqual(page.removed, ['annotation-source-hint']);
  const all = [page.title, page.description.getAttribute('content'),
    ...[...page.nodes.values()].map((node) => node.textContent)].join(' ');
  assert.ok(!/Synechococcus|UTEX|PCC|GO IEA among/.test(all));
});

test('for the default organism the rewrite leaves the page saying what it said', () => {
  const page = fakePage();
  applyOrganismIdentity(page, DEFAULT_ORGANISM);
  assert.equal(page.title, 'Synechococcus elongatus recoding-diversity map');
  assert.equal(page.documentElement.dataset.organism, 'utex2973');
  assert.equal(page.nodes.get('organism-species').textContent, 'Synechococcus elongatus');
  assert.equal(page.nodes.get('organism-strain').textContent, 'UTEX 2973');
  assert.equal(page.nodes.get('gene-search').getAttribute('placeholder'),
    'Locus, product, category, or GO term');
  assert.equal(page.nodes.get('annotation-source-hint').textContent,
    DEFAULT_ORGANISM.copy.annotationSourceHint);
  assert.deepEqual(page.removed, []);
  // A page without one of these nodes is left alone rather than failing.
  assert.doesNotThrow(() => applyOrganismIdentity({
    title: '', documentElement: new FakeElement('html'),
    getElementById: () => null, querySelector: () => null,
  }, ECOLI));
});

test('the gene count in the help text is the loaded dataset\'s own', () => {
  const page = fakePage();
  applyGeneCount(page, 4305);
  assert.equal(page.nodes.get('gene-count-phrase').textContent, 'about 4,300');
  applyGeneCount(page, 2715);
  assert.equal(page.nodes.get('gene-count-phrase').textContent, 'about 2,700');
});

// --- Truthful absence, in the views that would otherwise claim a negative -----

const GENE = {
  id: 'b0002', name: 'thrA', product: 'aspartate kinase', seqid: 'NC_000913.3', strand: '+',
  start: 337, end: 2799, lengthNt: 2463, lengthCodons: 820, terminalStop: 'TGA',
  cdsSegments: null, translationalException: null,
};

test('a gene of an organism with no start-site layer is never said to have no start site', async () => {
  const model = geneViewModel({ ...GENE, tssEvidence: [] });
  const said = describeGeneView(model, null, ECOLI);
  assert.ok(!/start site maps|Tan 2018/.test(said));
  assert.ok(said.endsWith(ECOLI.copy.noAdmittedTrackData));
  // Not even while a file of that name is nominally pending: there is no layer to wait for.
  assert.ok(!/start sites are still loading/.test(describeGeneView(model, 'loading', ECOLI)));
  // The default organism still makes its claim, which its layer supports.
  assert.match(describeGeneView(model), /No Tan 2018 start site maps to this locus by exact locus tag\./);
  assert.ok(describeGeneView(model).endsWith(DEFAULT_ORGANISM.copy.noAdmittedTrackData));

  await withFakeDocument(() => {
    const site = { id: 'gTSS-9', sourceStartDistanceNt: 40, strand: '+', position: 297 };
    const host = document.createElement('div');
    // A record that carries sites draws none of them without a declared layer.
    renderGeneViewer(host, { ...GENE, tssEvidence: [site] }, { organism: ECOLI, tssPending: 'loading' });
    assert.equal(host.querySelectorAll('circle').length, 0);
    assert.ok(!/start site|Tan|loading/i.test(host.textContent));
    assert.equal(host.querySelectorAll('p.evidence-pending').length, 0);
    const cyano = document.createElement('div');
    renderGeneViewer(cyano, { ...GENE, tssEvidence: [site] });
    assert.equal(cyano.querySelectorAll('circle').length, 1);
    assert.match(cyano.textContent, /Tan 2018 start site/);
    assert.match(cyano.textContent, /values Tan et al\. 2018 published against/);
  });
});

test('the regulatory tab draws a table only for an organism that declares one', async () => {
  await withFakeDocument(() => {
    const inventory = {
      potentialTargets: [], sourceWarnings: [], rows: [],
      source: { conditions: { control: 'c', dark: 'd', high_light: 'h', high_temperature: 't' } },
    };
    const host = document.createElement('div');
    const panel = new RegulatorySitesPanel(host, { onShowGene() {}, organism: ECOLI });
    // Even handed a table, an organism with no such layer is told it has none.
    panel.update(inventory, null);
    assert.equal(host.textContent, 'The regulatory start-site table is unavailable in this dataset.');
    panel.update(null, null);
    assert.equal(host.textContent, 'The regulatory start-site table is unavailable in this dataset.');
  });
});
