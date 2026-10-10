/**
 * The organism selector and the page's statement of which organism it shows.
 *
 * Rendered against the test document. What the browser adds on top of this,
 * the focus ring, the navigation itself, and the layout at each width, is the
 * rendered check in docs/validation/organism-selector.md.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ORGANISM, organismById, storageKeys,
} from '../../site/js/core/organisms.js';
import {
  applyGeneCount, applyOrganismIdentity, dataDirectoryPath, rememberView, renderOrganismSelector,
  searchCopy,
} from '../../site/js/ui/organism-selector.js';
import { describeGeneView, renderGeneViewer } from '../../site/js/ui/gene-viewer.js';
import { geneViewModel } from '../../site/js/core/gene-view-model.js';
import { RegulatorySitesPanel } from '../../site/js/ui/regulatory-sites.js';
import { CITATIONS_TAB, CitationsPanel, citationsBlurb } from '../../site/js/ui/citations.js';
import { FakeElement, withFakeDocument } from './fake-dom.mjs';

const ECOLI = organismById('ecoli-k12-mg1655');
const MDS42 = organismById('ecoli-mds42-public-reference');
const DH10B = organismById('ecoli-dh10b-public-reference');
const SYN61 = organismById('ecoli-syn61-delta3-ev5');

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

/** A window whose `storage` events the selector can be made to hear. */
function fakeView() {
  const listeners = [];
  return {
    addEventListener: (type, listener) => {
      assert.equal(type, 'storage', 'the selector listens for nothing else on the window');
      listeners.push(listener);
    },
    /** Another tab wrote `key`, as the browser reports it to this one. */
    wrote: (key) => { for (const listener of listeners) listener({ key }); },
    listeners,
  };
}

/** Draw the selector for `current` on the page at `search`. */
function selectorFor(current, search, store = memoryStore(), view = fakeView()) {
  const host = new FakeElement('nav');
  const handle = renderOrganismSelector(host, {
    current, location: { pathname: '/site/', search }, store, view,
  });
  const options = host.querySelectorAll('a');
  const optionFor = (organism) => options.find((option) => option.dataset.organism === organism.id);
  return {
    host, options, optionFor, store, view, handle,
    identity: host.querySelector('span.organism-identity'),
    trigger: host.querySelector('button.organism-group-trigger'),
    menu: host.querySelector('ul.organism-strain-menu'),
    dropdown: host.querySelector('div.organism-dropdown'),
  };
}

test('the selector has three ordered top-level controls and grouped strain links', async () => {
  await withFakeDocument(() => {
    const { host, options, trigger, menu, identity } = selectorFor(DEFAULT_ORGANISM, '');
    const topLevel = host.querySelectorAll('.organism-top-level');
    assert.deepEqual(topLevel.map((option) => option.tagName), ['a', 'a', 'button']);
    assert.deepEqual(topLevel.map((option) => option.textContent), [
      'Cyanobacteria', 'E. coli Syn61', 'E. coli · MG1655\u25be',
    ]);
    assert.deepEqual(options.map((option) => option.textContent),
      ['Cyanobacteria', 'E. coli Syn61', 'MG1655',
        'MDS42 public reference', 'DH10B public reference']);
    assert.deepEqual(options.map((option) => option.dataset.organism), [
      DEFAULT_ORGANISM.id, SYN61.id, ECOLI.id, MDS42.id, DH10B.id,
    ]);
    assert.deepEqual(options.map((option) => option.getAttribute('aria-current')),
      ['page', null, null, null, null]);
    assert.ok(options[0].classList.contains('active'));
    assert.ok(!trigger.classList.contains('active'));
    assert.equal(trigger.getAttribute('aria-label'), 'E. coli strains; selected MG1655');
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(menu.hidden, true);
    assert.equal(menu.getAttribute('aria-label'), 'Conventional E. coli strains');
    // Every destination remains an ordinary link with a usable deep-link address.
    for (const option of options) {
      assert.equal(option.tagName, 'a');
      assert.ok(option.classList.contains('organism-option'));
    }
    assert.deepEqual(options.map((option) => option.href), [
      '/site/', '/site/?org=ecoli-syn61-delta3-ev5',
      '/site/?org=ecoli-k12-mg1655',
      '/site/?org=ecoli-mds42-public-reference',
      '/site/?org=ecoli-dh10b-public-reference',
    ]);
    // The strain and reference assembly of the organism in view, species in italics.
    assert.equal(identity.id, 'organism-identity');
    assert.equal(identity.textContent, 'Synechococcus elongatus UTEX 2973 · GCF_000817325.1');
    assert.equal(identity.querySelector('i').textContent, 'Synechococcus elongatus');
  });
});

test('in the native E. coli view the selector names that strain and nothing of the others', async () => {
  await withFakeDocument(() => {
    const { options, trigger, identity } = selectorFor(ECOLI, '?org=ecoli-k12-mg1655');
    assert.deepEqual(options.map((option) => option.getAttribute('aria-current')),
      [null, null, 'page', null, null]);
    assert.ok(options[2].classList.contains('active'));
    assert.ok(trigger.classList.contains('active'));
    assert.equal(trigger.getAttribute('aria-current'), 'page');
    assert.equal(trigger.getAttribute('aria-label'), 'E. coli strains; selected MG1655');
    assert.deepEqual(options.map((option) => option.href), [
      '/site/', '/site/?org=ecoli-syn61-delta3-ev5',
      '/site/?org=ecoli-k12-mg1655',
      '/site/?org=ecoli-mds42-public-reference',
      '/site/?org=ecoli-dh10b-public-reference',
    ]);
    assert.equal(identity.textContent, 'Escherichia coli K-12 MG1655 · GCF_000005845.2');
    assert.ok(!/Synechococcus|UTEX|GCF_000817325/.test(identity.textContent));
  });
});

test('in the recoded E. coli view the selector and identity name the deposited strain', async () => {
  await withFakeDocument(() => {
    const { options, trigger, identity } = selectorFor(SYN61, '?org=ecoli-syn61-delta3-ev5');
    assert.deepEqual(options.map((option) => option.getAttribute('aria-current')),
      [null, 'page', null, null, null]);
    assert.ok(options[1].classList.contains('active'));
    assert.ok(!trigger.classList.contains('active'));
    assert.equal(trigger.getAttribute('aria-label'), 'E. coli strains; selected MG1655');
    assert.equal(identity.textContent,
      'Escherichia coli Syn61 substr. delta 3 (ev5) · GCA_028355435.1');
    assert.ok(!/Synechococcus|UTEX|GCF_000817325|MG1655/.test(identity.textContent));
  });
});

test('a public-reference view keeps its caveat in the trigger and selected link', async () => {
  await withFakeDocument(() => {
    const { optionFor, trigger, identity } = selectorFor(
      MDS42, '?org=ecoli-mds42-public-reference',
    );
    assert.equal(trigger.textContent, 'E. coli · MDS42 public reference\u25be');
    assert.equal(trigger.getAttribute('aria-label'),
      'E. coli strains; selected MDS42 public reference');
    assert.equal(trigger.getAttribute('aria-current'), 'page');
    assert.equal(optionFor(MDS42).getAttribute('aria-current'), 'page');
    assert.equal(identity.textContent,
      'Escherichia coli K-12 MDS42 public reference · GCF_000350185.1');
  });
});

test('the option for the organism in view goes nowhere, and the other follows its link', async () => {
  await withFakeDocument(() => {
    const { optionFor } = selectorFor(DEFAULT_ORGANISM, '');
    let prevented = 0;
    optionFor(DEFAULT_ORGANISM).dispatch('click', { preventDefault: () => { prevented += 1; } });
    assert.equal(prevented, 1, 'already here: a reload would discard the view on screen');
    let followed = 0;
    optionFor(SYN61).dispatch('click', { preventDefault: () => { followed += 1; } });
    assert.equal(followed, 0, 'the other organism is an ordinary navigation');
  });
});

test('the strain disclosure opens, navigates, dismisses, and restores focus by keyboard', async () => {
  await withFakeDocument((page) => {
    const { trigger, menu, dropdown, optionFor } = selectorFor(ECOLI, '?org=ecoli-k12-mg1655');
    let prevented = 0;
    trigger.dispatch('keydown', {
      key: 'ArrowDown', preventDefault: () => { prevented += 1; },
    });
    assert.equal(menu.hidden, false);
    assert.equal(trigger.getAttribute('aria-expanded'), 'true');
    assert.equal(page.activeElement, optionFor(ECOLI));
    assert.equal(prevented, 1);

    menu.dispatch('keydown', {
      key: 'ArrowDown', target: optionFor(ECOLI), preventDefault() {},
    });
    assert.equal(page.activeElement, optionFor(MDS42));
    menu.dispatch('keydown', {
      key: 'End', target: optionFor(MDS42), preventDefault() {},
    });
    assert.equal(page.activeElement, optionFor(DH10B));
    menu.dispatch('keydown', {
      key: 'Escape', target: optionFor(DH10B), preventDefault() {},
    });
    assert.equal(menu.hidden, true);
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(page.activeElement, trigger, 'Escape returns focus to the disclosure');

    trigger.dispatch('click');
    assert.equal(menu.hidden, false, 'pointer activation opens the disclosure');
    page.dispatch('pointerdown', { target: new FakeElement('main') });
    assert.equal(menu.hidden, true, 'a pointer press outside dismisses it');
    trigger.dispatch('click');
    dropdown.dispatch('focusout', { relatedTarget: new FakeElement('button') });
    assert.equal(menu.hidden, true, 'tabbing out dismisses it');

    trigger.dispatch('click');
    let currentPrevented = 0;
    optionFor(ECOLI).dispatch('click', {
      preventDefault: () => { currentPrevented += 1; },
    });
    assert.equal(currentPrevented, 1);
    assert.equal(menu.hidden, true);
    assert.equal(page.activeElement, trigger, 'selecting the current strain returns focus');
  });
});

test('a switch returns to the view that organism was last left in, as saved by any tab', async () => {
  await withFakeDocument(() => {
    const store = memoryStore();
    rememberView(store, ECOLI, 'ver=6&p=umap&g=b0002');
    const { optionFor } = selectorFor(DEFAULT_ORGANISM, '?load-min=0', store);
    const ecoli = optionFor(ECOLI);
    assert.equal(ecoli.href, '/site/?org=ecoli-k12-mg1655&load-min=0#ver=6&p=umap&g=b0002');
    // Another tab leaves E. coli on a different view after this page drew its link.
    rememberView(store, ECOLI, 'ver=6&p=chromosome');
    ecoli.dispatch('click', {});
    assert.equal(ecoli.href, '/site/?org=ecoli-k12-mg1655&load-min=0#ver=6&p=chromosome',
      'the address is refreshed as the link is activated');
    // The view this page is leaving is its own organism's, never carried across.
    assert.ok(!/M744|cs=/.test(ecoli.href));
  });
});

test('a link is current whenever its address can be read, not only when followed', async () => {
  await withFakeDocument(() => {
    const store = memoryStore();
    const { optionFor, view, handle } = selectorFor(DEFAULT_ORGANISM, '', store);
    const ecoli = optionFor(ECOLI);
    assert.equal(ecoli.href, '/site/?org=ecoli-k12-mg1655', 'nothing saved yet');

    // Another tab leaves E. coli on the chromosome with a gene pinned. This tab
    // hears only the storage event, and copying the address must not lose it.
    rememberView(store, ECOLI, 'ver=6&p=chromosome&g=b0002&l=b0002');
    view.wrote(storageKeys(ECOLI).lastView);
    const remembered = '/site/?org=ecoli-k12-mg1655#ver=6&p=chromosome&g=b0002&l=b0002';
    assert.equal(ecoli.href, remembered, 'the storage event alone keeps the address current');

    // And before anything that can read the attribute, whatever the event order:
    // the context menu's copy, a middle or modified click, a drag, Enter.
    for (const type of ['contextmenu', 'pointerdown', 'keydown', 'click']) {
      rememberView(store, ECOLI, `ver=6&p=umap&src=${type}`);
      ecoli.href = '/site/stale';
      ecoli.dispatch(type, { preventDefault() {} });
      assert.equal(ecoli.href, `/site/?org=ecoli-k12-mg1655#ver=6&p=umap&src=${type}`, type);
    }

    // The option for the organism in view is kept current the same way, and
    // still goes nowhere when it is followed.
    rememberView(store, DEFAULT_ORGANISM, 'ver=6&p=native');
    view.wrote(storageKeys(DEFAULT_ORGANISM).lastView);
    assert.equal(optionFor(DEFAULT_ORGANISM).href, '/site/#ver=6&p=native');
    let prevented = 0;
    optionFor(DEFAULT_ORGANISM).dispatch('click', { preventDefault: () => { prevented += 1; } });
    assert.equal(prevented, 1);

    // A key neither organism keeps a view under is no reason to rewrite anything.
    rememberView(store, ECOLI, 'ver=6&p=lengths');
    view.wrote('cyano.schemes.v1');
    assert.equal(ecoli.href, '/site/?org=ecoli-k12-mg1655#ver=6&p=umap&src=click');
    // Storage being cleared is reported with no key at all, and does refresh.
    view.wrote(null);
    assert.equal(ecoli.href, '/site/?org=ecoli-k12-mg1655#ver=6&p=lengths');

    // The returned handle is the same refresh, for a caller that knows better.
    rememberView(store, ECOLI, 'ver=6&p=citations');
    handle.refresh();
    assert.equal(ecoli.href, '/site/?org=ecoli-k12-mg1655#ver=6&p=citations');
  });
});

test('the selector works where a window cannot be reached, and listens for nothing else', async () => {
  await withFakeDocument(() => {
    const store = memoryStore();
    rememberView(store, ECOLI, 'ver=6&p=umap');
    const host = new FakeElement('nav');
    // No view at all: the links are still drawn and still refresh on interaction.
    renderOrganismSelector(host, {
      current: DEFAULT_ORGANISM, location: { pathname: '/site/', search: '' }, store, view: null,
    });
    const ecoli = host.querySelectorAll('a')
      .find((option) => option.dataset.organism === ECOLI.id);
    assert.equal(ecoli.href, '/site/?org=ecoli-k12-mg1655#ver=6&p=umap');
    rememberView(store, ECOLI, 'ver=6&p=chromosome');
    ecoli.dispatch('pointerdown', {});
    assert.equal(ecoli.href, '/site/?org=ecoli-k12-mg1655#ver=6&p=chromosome');
    const view = fakeView();
    selectorFor(DEFAULT_ORGANISM, '', store, view);
    assert.equal(view.listeners.length, 1, 'one window listener, for storage');
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
  node('data-directory-path', 'site/data', 'code');
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
  // The footer says where this organism's files are, not where another's are.
  assert.equal(page.nodes.get('data-directory-path').textContent,
    'site/data/organisms/ecoli-k12-mg1655');
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
    'Each checkbox enables one annotation source for function-category colouring and '
      + 'the legend counts only. The detail panel, lists, search, and export always show every source.');
  // Unchanged: the static footer already says the default organism's directory.
  assert.equal(page.nodes.get('data-directory-path').textContent, 'site/data');
  assert.equal(dataDirectoryPath(DEFAULT_ORGANISM), 'site/data');
  assert.equal(dataDirectoryPath(ECOLI), 'site/data/organisms/ecoli-k12-mg1655');
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

test('an absent citations ledger is a short unavailable state, with no blurb', async () => {
  await withFakeDocument(() => {
    const host = document.createElement('div');
    const panel = new CitationsPanel(host);
    panel.render(null);
    assert.equal(host.textContent, 'The source ledger is unavailable in this dataset.');
    assert.equal(host.querySelectorAll('p').length, 1, 'one short line, not a paragraph of advice');
    // No instruction to publish anything, and so no directory to name wrongly:
    // the ledger a release does not publish is not a deployment to be fixed.
    assert.ok(!/citations\.json|publish|data\/|deployment|will be listed/.test(host.textContent));
    assert.equal(citationsBlurb(null), '', 'nothing to introduce');

    // Still loading is not "unavailable in this dataset", and keeps the blurb.
    panel.render(undefined);
    assert.equal(host.textContent, 'Loading the source ledger\u2026');
    assert.equal(citationsBlurb(undefined), CITATIONS_TAB.blurb);

    // A published ledger is unchanged, blurb and entries alike.
    const manifest = { sections: [{ id: 's', title: 'Primary data', description: '', items: [] }] };
    panel.render(manifest);
    assert.equal(citationsBlurb(manifest), CITATIONS_TAB.blurb);
    assert.match(host.textContent, /Primary data/);
    panel.render({ sections: [] });
    assert.equal(host.textContent, 'The source ledger is published but currently lists no sources.');
    assert.equal(citationsBlurb({ sections: [] }), CITATIONS_TAB.blurb);
  });
});
