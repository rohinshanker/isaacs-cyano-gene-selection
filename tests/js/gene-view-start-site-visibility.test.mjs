/**
 * The gene visualizer's own show/hide for the Tan 2018 start-site marks.
 *
 * It is the same contract the chromosome view's control has, held to in a view
 * that is redrawn on every hover: it governs **marks only**, it is **this
 * view's own** choice, and the picture **says which state it is in**.
 *
 * Marks only is the load-bearing one. Hiding them must not move a coordinate,
 * change the drawn domain, alter a value the panel reports, filter a gene, or
 * drop a published row from the inspection list — the sites are admitted
 * evidence and this is a reader putting a layer away. What does go with the
 * marks is every claim about where a mark is: a `<title>` nothing draws, a
 * legend key for an absent mark, and the cluster labels that say where this
 * width draws two heads that overlap.
 *
 * This view's own means per mount. The component is on the page twice, in the
 * controls column and in the gene detail column, and neither of them follows
 * the other or the chromosome view. Because both callers rebuild the host —
 * the controls column on every hover, the detail column with the whole panel —
 * the choice is the caller's to hold and the control has to be found again
 * afterwards, so the choice surviving a redraw and keyboard focus surviving
 * one are pinned here over both mounts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import {
  START_SITES_CONTROL, describeGeneView, renderGeneViewer,
} from '../../site/js/ui/gene-viewer.js';
import { SidePanel } from '../../site/js/ui/side-panel.js';
import { organismById } from '../../site/js/core/organisms.js';
import { withFakeDocument } from './fake-dom.mjs';

const genes = JSON.parse(readFileSync(new URL('../../site/data/genes.json', import.meta.url)));
const evidence = JSON.parse(
  readFileSync(new URL('../../site/data/tss_evidence.json', import.meta.url)),
);
const geneById = new Map(genes.map((gene) => [gene.id, gene]));

/** One shipped gene with its own evidence rows joined, as the loader joins them. */
function joined(id) {
  const gene = geneById.get(id);
  assert.ok(gene, `${id} is not in the shipped annotation`);
  return { ...gene, tssEvidence: evidence[id] ?? [] };
}

/** The densest shipped locus: twenty rows, whose heads overlap into clusters. */
const DENSE = 'M744_RS01695';
/** A minus-strand gene carrying sites, so the control is held on both strands. */
const MINUS = 'M744_RS09240';
/** A gene with no mapped site at all. */
const NO_SITES = 'M744_RS00005';

const ECOLI = organismById('ecoli-k12-mg1655');

const CONTROL = `[data-detail-action="${START_SITES_CONTROL}"]`;

/** The control a render built, or null when it built none. */
function control(host) {
  return host.querySelector(CONTROL);
}

/** The start-site list's rows, as a reader reads them. */
function rowTexts(host) {
  const list = host.querySelector('details.gene-view-sites');
  return list === null ? [] : list.querySelector('ol').children.map((row) => row.textContent);
}

/** The list's own note, which says what the picture is doing with the marks. */
function listNote(host) {
  return host.querySelector('details.gene-view-sites').querySelector('p').textContent;
}

/** What the picture says about itself, which is what a screen reader is given. */
function said(host) {
  return host.querySelector('svg').getAttribute('aria-label');
}

/**
 * The SVG children of one class. The builder writes a `class` attribute rather
 * than a property, which is what the drawn shapes are found by here.
 */
function shapes(host, tag, className) {
  return host.querySelectorAll(tag)
    .filter((node) => (node.getAttribute('class') ?? '').split(' ').includes(className));
}

/**
 * Everything in the view that is not a start-site mark: the drawn track and its
 * scale, the ruler and its labels, the gene's own facts, and the identity of
 * every published row. Hiding the marks must leave all of it identical.
 */
function everythingElse(host) {
  const geometry = (node) => ['x', 'width', 'd', 'x1', 'x2', 'y1', 'y2']
    .map((name) => node.getAttribute(name)).join('/');
  const ruler = shapes(host, 'g', 'gene-view-ruler')[0];
  assert.ok(ruler, 'the ruler is drawn');
  return JSON.stringify({
    cds: shapes(host, 'rect', 'gene-view-cds').map(geometry),
    codons: shapes(host, 'rect', 'gene-view-codon').map(geometry),
    arrow: shapes(host, 'path', 'gene-view-arrow').map(geometry),
    zero: shapes(host, 'line', 'gene-view-zero').map(geometry),
    rulerTicks: ruler.querySelectorAll('line').map(geometry),
    rulerLabels: ruler.querySelectorAll('text').map((label) => `${label.getAttribute('x')}:${label.textContent}`),
    scale: host.querySelector('p.gene-view-scale').textContent,
    facts: host.querySelector('dl.gene-view-facts').textContent,
    heading: host.querySelector('p.gene-view-heading').textContent,
    rows: rowTexts(host).map((text) => text.split(' · ')[0]),
  });
}

/** Where every mark is drawn, and what each one answers to a pointer. */
function marks(host) {
  return JSON.stringify({
    heads: host.querySelectorAll('circle').map((head) => `${head.getAttribute('cx')}@${head.getAttribute('r')}`),
    titles: host.querySelectorAll('title').map((title) => title.textContent),
  });
}

/**
 * One mount of the view, with a caller that holds the choice the way both real
 * mounts do: it records what the view reports and hands the recorded value back
 * on the next render. `draw` is that next render, for this gene or another.
 */
function mount(document, gene, options = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const held = { visible: true, reports: 0 };
  const draw = (next = gene) => renderGeneViewer(host, next, {
    ...options,
    startSitesVisible: held.visible,
    onStartSitesVisibleChange: (visible) => {
      held.visible = visible;
      held.reports += 1;
    },
  });
  draw();
  return { host, held, draw };
}

/** Toggle through the control a reader uses, not the state behind it. */
function toggle(host) {
  const box = control(host);
  assert.ok(box, 'there is a control to toggle');
  box.checked = !box.checked;
  box.dispatch('change');
}

test('the marks have their own control, and it opens showing them', async () => {
  await withFakeDocument((document) => {
    const { host } = mount(document, joined(DENSE));
    const box = control(host);
    assert.ok(box, 'a locus with mapped sites has the control');
    assert.equal(box.checked, true, 'the marks open visible, as the ticket requires');
    assert.equal(host.querySelectorAll('circle').length, evidence[DENSE].length);

    // Named by the label that wraps it rather than by an id and a `for`: this
    // component is mounted twice on one page, and two elements cannot share an
    // id. The words are part of the control, so they are part of its hit target.
    const row = box.parentNode;
    assert.equal(row.tagName, 'label');
    assert.ok(row.hasClass('gene-view-layer'));
    assert.equal(row.textContent, ' Show Tan 2018 start sites');
    assert.equal(box.getAttribute('id'), null, 'no id to collide with the other mount');
    // The checkbox sits between the picture it governs and the legend of what
    // is in it, which is where a reader looking at a mark finds it.
    const order = host.children.indexOf(row);
    assert.ok(order > host.children.indexOf(host.querySelector('svg')));
    assert.ok(order < host.children.indexOf(host.querySelector('ul.gene-view-legend')));
  });
});

test('hiding the marks takes them and everything that answered for them, and nothing else', async () => {
  const gene = joined(DENSE);
  const untouched = structuredClone(gene);
  await withFakeDocument((document) => {
    const { host } = mount(document, gene);
    const shown = { rest: everythingElse(host), marks: marks(host) };
    assert.match(said(host), /20 Tan 2018 start sites upstream at /);

    toggle(host);

    // Not one mark, and not one target that spoke for a mark: a head left at
    // zero opacity would still answer a pointer and still be read out.
    assert.equal(host.querySelectorAll('circle').length, 0);
    assert.deepEqual(shapes(host, 'g', 'gene-view-tss'), [], 'the mark group is not built at all');
    assert.equal(host.querySelectorAll('title')
      .filter((title) => /nt upstream/.test(title.textContent)).length, 0);
    assert.equal(host.querySelector('span.gene-view-key-tss'), null,
      'no legend key for a mark the picture is not drawing');

    // The drawing, the domain it is drawn over, this gene's facts and every
    // published row's identity are what they were.
    assert.equal(everythingElse(host), shown.rest);

    // And the picture says so, in its own description, rather than leaving an
    // empty space to read as a locus with no start site.
    assert.match(said(host), /20 Tan 2018 start sites map to this locus, and this view's "Show Tan 2018 start sites" control is off, so no mark is drawn for them\./);
    assert.match(said(host), /The sites are unchanged, and so are this gene's coordinates, its drawn span, its values and which genes are on screen\./);
    assert.match(said(host), /Every one of them is listed under "Tan 2018 start sites \(20\)" below\./);
    assert.ok(!/upstream at |share drawn space/.test(said(host)),
      'nothing claims a distance is drawn or that two heads overlap');

    // Showing them again returns the same marks to the same places.
    toggle(host);
    assert.equal(marks(host), shown.marks);
    assert.equal(everythingElse(host), shown.rest);
    assert.equal(shapes(host, 'g', 'gene-view-tss').length, 1);
    assert.match(said(host), /20 Tan 2018 start sites upstream at /);
  });
  assert.deepEqual(gene, untouched, 'the gene record itself is never written to');
});

test('the metadata list stays readable while the marks are hidden, and says they are', async () => {
  await withFakeDocument((document) => {
    const { host } = mount(document, joined(DENSE));
    const rows = rowTexts(host);
    assert.equal(rows.length, evidence[DENSE].length);
    const labelled = rows.filter((text) => /overlapping cluster/.test(text));
    assert.ok(labelled.length > 1, `${DENSE} draws overlapping clusters`);

    toggle(host);

    // Every row, with every field it had: the list is the metadata, not the
    // drawing, so a reader who has put the marks away can still read it.
    const hidden = rowTexts(host);
    assert.equal(hidden.length, rows.length);
    assert.deepEqual(hidden.map((text) => text.split(' · ')[0]),
      rows.map((text) => text.split(' · ')[0]));
    for (const text of hidden) assert.match(text, /published [\d,]+ nt upstream|no published upstream distance/);

    // Clearly labelled, which is the condition for keeping it open.
    assert.match(listNote(host),
      /The marks are hidden in the picture by this view's "Show Tan 2018 start sites" control, so no row says where it is drawn/);
    assert.match(listNote(host), /hiding the marks filters no gene and changes no value/);
    // And no row claims a position in a cluster, because nothing is drawn to be
    // in one. A label that outlived its mark would be the stale target again.
    assert.equal(hidden.filter((text) => /overlapping cluster|drawn in/.test(text)).length, 0);
    assert.ok(!/one mark head overlap in the picture/.test(listNote(host)));

    toggle(host);
    assert.deepEqual(rowTexts(host).filter((text) => /overlapping cluster/.test(text)), labelled,
      'the cluster labels come back exactly as they were, numbering included');
  });
});

test('the choice is reported once, and survives every later redraw of the view', async () => {
  await withFakeDocument((document) => {
    const { host, held, draw } = mount(document, joined(DENSE));
    toggle(host);
    assert.equal(held.visible, false);
    assert.equal(held.reports, 1, 'reported once, for the one change the reader made');

    // The hover redraw: the caller renders again with what it was told.
    draw();
    assert.equal(control(host).checked, false);
    assert.equal(host.querySelectorAll('circle').length, 0);
    // Repeating that redraw changes nothing, in either direction.
    const after = everythingElse(host);
    draw();
    draw();
    assert.equal(control(host).checked, false);
    assert.equal(everythingElse(host), after);
    assert.equal(held.reports, 1, 'a redraw is not a change, and reports none');

    // A locus change keeps it, including through a locus with no site of its
    // own — where there is no control, because there is no mark to govern.
    draw(joined(MINUS));
    assert.equal(control(host).checked, false);
    assert.equal(host.querySelectorAll('circle').length, 0);
    draw(joined(NO_SITES));
    assert.equal(control(host), null);
    assert.match(said(host), /No Tan 2018 start site maps to this locus by exact locus tag\./);
    draw(joined(DENSE));
    assert.equal(control(host).checked, false, 'the gene in between did not reset the choice');
    assert.equal(held.visible, false);

    toggle(host);
    assert.equal(held.visible, true);
    assert.equal(held.reports, 2);
    assert.equal(host.querySelectorAll('circle').length, evidence[DENSE].length);
  });
});

test('keyboard focus stays on the control across the repaint it causes and the caller’s next one', async () => {
  await withFakeDocument((document) => {
    const { host, draw } = mount(document, joined(DENSE));
    control(host).focus();
    assert.equal(document.activeElement, control(host));

    // Space on a focused checkbox: the view repaints under the reader's hand,
    // and the hand must still be on the control afterwards.
    toggle(host);
    assert.equal(document.activeElement, control(host), 'focus moved to the rebuilt control');
    assert.equal(document.activeElement.isConnected, true, 'and not to a detached one');
    assert.equal(document.activeElement.checked, false, 'which is in the state just chosen');

    // The hover redraw the caller drives, while the reader is still holding it.
    draw();
    assert.equal(document.activeElement, control(host));
    assert.equal(document.activeElement.isConnected, true);

    // Tab away and a redraw leaves focus where the reader put it: the carry-over
    // is for the control the reader is holding, not a grab on every render.
    const elsewhere = document.createElement('button');
    document.body.append(elsewhere);
    elsewhere.focus();
    draw();
    assert.equal(document.activeElement, elsewhere);
  });
});

test('each mount decides for itself, and holds its own state', async () => {
  await withFakeDocument((document) => {
    // The controls column and the gene detail column, drawn from one record.
    const left = mount(document, joined(DENSE));
    const right = mount(document, joined(DENSE));
    toggle(left.host);
    assert.equal(left.host.querySelectorAll('circle').length, 0);
    assert.equal(right.host.querySelectorAll('circle').length, evidence[DENSE].length,
      'the other view is not following this one');
    assert.equal(right.held.visible, true);
    assert.equal(control(right.host).checked, true);
    // And the hidden one stays hidden when the other is redrawn.
    right.draw();
    assert.equal(left.host.querySelectorAll('circle').length, 0);
  });
});

test('the controls mount retains focus when its checkbox disappears or selection clears', async () => {
  await withFakeDocument((document) => {
    const { host, draw } = mount(document, joined(DENSE));
    control(host).focus();
    draw(joined(NO_SITES));
    assert.equal(control(host), null);
    assert.equal(document.activeElement, host);
    assert.equal(host.isConnected, true);
    assert.equal(host.tabIndex, -1);
    assert.equal(host.getAttribute('role'), 'group');
    assert.equal(host.getAttribute('aria-label'), 'Gene visualizer');
    draw(joined(DENSE));
    assert.equal(document.activeElement, host, 'later redraws retain the stable fallback');
    control(host).focus();
    draw(null);
    assert.equal(document.activeElement, host);
    assert.equal(control(host), null);
    assert.match(host.textContent, /Pin a gene/);
  });
});

test('unmapped-only evidence is unavailable for drawing, even with a retained hidden preference', async () => {
  const unmapped = {
    ...joined(NO_SITES),
    tssEvidence: [{ id: 'gTSS+9', type: 'gTSS', strand: '+',
      replicon: 'CP006471', position: 900 }],
  };
  await withFakeDocument((document) => {
    const { host, held, draw } = mount(document, joined(DENSE));
    toggle(host);
    draw(unmapped);
    assert.equal(held.visible, false, 'the view preference is retained');
    assert.equal(control(host), null);
    assert.equal(host.querySelectorAll('circle').length, 0);
    assert.equal(rowTexts(host).length, 1);
    assert.match(said(host), /1 Tan 2018 source row is associated with this locus/);
    assert.match(said(host), /no valid published upstream distance is available/);
    assert.doesNotMatch(said(host), /No Tan 2018 start site maps|control is off/);
    assert.doesNotMatch(listNote(host), /hidden|Show Tan|overlap in the picture/);
    assert.match(listNote(host), /no published upstream distance and so no mark/);
    draw(joined(DENSE));
    assert.equal(control(host).checked, false);
    assert.equal(host.querySelectorAll('circle').length, 0);
  });
});

test('a minus-strand locus has the control and its own marks, like a plus-strand one', async () => {
  const minus = joined(MINUS);
  assert.equal(minus.strand, '-');
  assert.ok(evidence[MINUS].length > 0);
  await withFakeDocument((document) => {
    const { host } = mount(document, minus);
    assert.equal(control(host).checked, true);
    assert.equal(host.querySelectorAll('circle').length, minus.tssEvidence.length);
    const rest = everythingElse(host);
    toggle(host);
    assert.equal(host.querySelectorAll('circle').length, 0);
    assert.equal(everythingElse(host), rest);
    for (const text of rowTexts(host)) assert.match(text, /minus strand/);
    assert.match(said(host), /start sites? maps? to this locus, and this view's "Show Tan 2018 start sites" control is off/);
  });
});

test('no control where there is no mark for it to govern, and each of those states still says itself', async () => {
  const unmappedOnly = {
    ...joined(NO_SITES),
    tssEvidence: [{ id: 'gTSS+9', type: 'gTSS', replicon: 'CP006471', strand: '+', position: 900 }],
  };
  await withFakeDocument((document) => {
    // Still loading, and failed: the file has not landed, so there is no mark
    // to hide and the note that says so is what the reader gets.
    for (const [pending, sentence] of [
      ['loading', /still loading, so none is drawn yet/],
      ['failed', /could not be loaded, so none is drawn/],
    ]) {
      const { host } = mount(document, joined(NO_SITES), { tssPending: pending });
      assert.equal(control(host), null);
      assert.ok(host.querySelector('p.evidence-pending') !== null);
      assert.match(said(host), sentence);
    }

    // Nothing maps to this locus: an absence, not a hidden layer.
    const absent = mount(document, joined(NO_SITES));
    assert.equal(control(absent.host), null);
    assert.match(said(absent.host), /No Tan 2018 start site maps to this locus by exact locus tag\./);

    // A published row with nowhere to be drawn: the row is listed, and there is
    // still no control, because no mark exists either way.
    const unmapped = mount(document, unmappedOnly);
    assert.equal(control(unmapped.host), null);
    assert.equal(unmapped.host.querySelectorAll('circle').length, 0);
    assert.equal(rowTexts(unmapped.host).length, 1);
    assert.match(listNote(unmapped.host), /1 row has no published upstream distance and so no mark/);

    // An organism with no start-site layer is not offered one.
    const ecoli = mount(document, { ...joined(DENSE), seqid: 'NC_000913.3' }, { organism: ECOLI });
    assert.equal(control(ecoli.host), null);
    assert.ok(!/start site/i.test(ecoli.host.textContent), 'no Tan control and no Tan copy');
    assert.ok(!/control is off/.test(describeGeneView(null, null, ECOLI, false)));
  });
});

test('the gene detail column keeps the choice and the focus through its own rebuild', async () => {
  // That column rebuilds everything for every hover, so the viewer's host is a
  // new element each time: the choice cannot live on the host, and the control
  // has to be found again. Both are checked here through the real panel.
  const registry = {
    families: ['Size'],
    metrics: [{
      key: 'lengthNt', label: 'Length', desc: 'coding length', unit: 'nt', family: 'Size',
      read: () => 1500,
    }],
  };
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    document.body.append(host);
    const panel = new SidePanel(host, { onShortlistToggle() {}, onUnpin() {} });
    const update = (gene) => panel.update({
      index: 0,
      isPinned: false,
      dataset: { genes: [gene], meta: {}, files: {} },
      registry,
      percentileOf: () => 0.5,
      schemeActive: false,
      live: {},
      inShortlist: false,
      colorSources: [],
    });

    update(joined(DENSE));
    assert.equal(panel.startSitesVisible, true, 'this column opens showing the marks');
    assert.equal(host.querySelectorAll('circle').length, evidence[DENSE].length);
    const values = host.querySelector('table.metric-table').textContent;
    const shortlist = host.querySelector('[data-detail-action="shortlist"]').textContent;

    control(host).focus();
    toggle(host);
    assert.equal(panel.startSitesVisible, false, 'the column recorded the reader’s choice');
    assert.equal(host.querySelectorAll('circle').length, 0);
    // Marks only: this gene's reported values and the pin's own actions are the
    // text they were, so nothing was filtered, rescored or reselected.
    assert.equal(host.querySelector('table.metric-table').textContent, values);
    assert.equal(host.querySelector('[data-detail-action="shortlist"]').textContent, shortlist);
    assert.equal(document.activeElement, control(host));

    // The hover rebuild, and a locus change: both keep the choice, and the
    // reader keeps the control they were holding.
    update(joined(DENSE));
    assert.equal(control(host).checked, false);
    assert.equal(host.querySelectorAll('circle').length, 0);
    assert.equal(document.activeElement, control(host));
    assert.equal(document.activeElement.isConnected, true);
    update(joined(MINUS));
    assert.equal(control(host).checked, false);
    assert.equal(host.querySelectorAll('circle').length, 0);

    // A second column starts from the default: the state is the instance's own,
    // not the module's, so one reader's choice is not everyone's.
    const other = document.createElement('div');
    document.body.append(other);
    const second = new SidePanel(other, { onShortlistToggle() {}, onUnpin() {} });
    assert.equal(second.startSitesVisible, true);
  });
});

test('each view reports its choice up and reads it back from the one shared field', async () => {
  // The choice is shareable state: `state.hiddenMarkers` holds it, a link
  // carries it and a reload restores it, so it reaches a view through the same
  // render that carries the pin and the filters, and leaves it through a
  // handler. Checked over the source, because the point is which code can
  // write it at all: a view that kept its own copy would drift from the link.
  const app = await readFile(new URL('../../site/js/app.js', import.meta.url), 'utf8');
  const panel = await readFile(new URL('../../site/js/ui/side-panel.js', import.meta.url), 'utf8');
  const viewer = await readFile(new URL('../../site/js/ui/gene-viewer.js', import.meta.url), 'utf8');
  const manifest = await readFile(
    new URL('../../site/js/core/export-manifest.js', import.meta.url), 'utf8',
  );

  // One pair of helpers reads and writes the field, so a fifth view cannot
  // invent a fifth way to store the same choice.
  assert.equal((app.match(/state\.hiddenMarkers\s*=[^=]/g) ?? []).length, 1,
    'written in exactly one place, the helper that records a reader\'s change');
  assert.match(app, /function setMarkersVisibleIn\(viewId, visible, layerId = 'tss'\) \{/);
  assert.match(app, /state\.hiddenMarkers = withMarkerVisible\(state\.hiddenMarkers, layerId, viewId, visible\);/);
  assert.match(app, /persist\(\);/);
  // Each of the four views, named once as a reader and once as a writer.
  for (const view of ['gene-controls', 'gene-detail', 'chromosome', 'sequence']) {
    assert.match(app, new RegExp(`markersVisibleIn\\('${view}'\\)`), `${view} reads the field`);
    assert.match(app, new RegExp(`setMarkersVisibleIn\\('${view}',`), `${view} writes the field`);
  }

  // The gene visualizer itself still stores nothing: it is rebuilt on every
  // hover, so a choice kept there would last until the next pointer move.
  assert.ok(!/localStorage|sessionStorage/.test(viewer));
  assert.match(panel, /this\.startSitesVisible = state\.startSitesVisible;/);
  assert.match(panel, /this\.handlers\.onStartSitesVisibleChange\?\.\(visible\);/);

  // The link is the only persistence. No browser storage holds it, and the
  // export manifest, which records the numbers a figure was made from, does
  // not: hiding a mark changes no value it reports.
  assert.ok(!/hiddenMarkers|startSitesVisible|showStartSites/.test(manifest));
  assert.ok(!/STORAGE_\w+\s*,\s*state\.hiddenMarkers|hiddenMarkers\)/.test(app));
});

test('no reset clears the choice, and every reset still does its own job', async () => {
  // Reset view is the camera, Reset selections is the pin and the shortlist,
  // Clear all filters is the filter channels, and Reset panel layout is the
  // column's order. None of them is a visibility control, so none of them may
  // touch the field; a reader who put a layer away does not get it back by
  // reframing a picture.
  const urlState = await readFile(new URL('../../site/js/core/url-state.js', import.meta.url), 'utf8');
  const { clearSelections, resetPanelLayout, defaultState } = await import('../../site/js/core/url-state.js');

  for (const name of ['clearSelections', 'resetPanelLayout']) {
    const body = urlState.slice(urlState.indexOf(`export function ${name}(`));
    assert.ok(!body.slice(0, body.indexOf('\n}')).includes('hiddenMarkers'),
      `${name} does not touch the marker visibility`);
  }
  const hidden = ['tss.chromosome', 'tss.sequence'];
  const afterSelections = clearSelections({ ...defaultState(), hiddenMarkers: hidden });
  assert.deepEqual(afterSelections.hiddenMarkers, hidden);
  assert.equal(afterSelections.pinnedId, null);
  const afterLayout = resetPanelLayout({ ...defaultState(), hiddenMarkers: hidden });
  assert.deepEqual(afterLayout.hiddenMarkers, hidden);
});
