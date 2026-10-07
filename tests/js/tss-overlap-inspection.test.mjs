/**
 * How a start-site mark that lands on another one stays readable.
 *
 * The gene visualizer draws every mapped Tan 2018 site at the distance its
 * study published, so a dense locus draws a cluster of overlapping heads:
 * `M744_RS01695`'s tightest marks are 2.7 view units apart as 6-unit circles,
 * which is the crowding D1 found and did not repair. Nothing here moves,
 * thins, merges or drops a mark to fix that — the anchors are the evidence.
 * What it adds is the surface that answers *which site is which*, which a
 * `<title>` cannot: it needs a pointer and resolves to whichever head is on
 * top.
 *
 * Three contracts live here. The list is **complete**: one row per published
 * row, including a row with no distance to be drawn at, each carrying its own
 * identity, strand, published coordinate, published distance and what the row
 * recorded. The grouping is **display only**: a cluster is where this width
 * draws the marks and is labelled as such, and no row is folded into another.
 * And none of it **changes the drawing**: the same marks, at the same
 * coordinates, as before the list existed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TSS_MARK_RADIUS, describeGeneView, geneViewSvg, renderGeneViewer, startSiteClusters,
} from '../../site/js/ui/gene-viewer.js';
import { geneViewModel, overlapGroups, tssSiteRows } from '../../site/js/core/gene-view-model.js';
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

/** The densest shipped locus, and the one D1 named. */
const DENSE = 'M744_RS01695';
/** A minus-strand gene carrying sites, so both strands are drawn and listed. */
const MINUS = 'M744_RS09240';
/** A gene with no mapped site at all. */
const NO_SITES = 'M744_RS00005';

const ECOLI = organismById('ecoli-k12-mg1655');

/** The start-site list a render produced, or null when it built none. */
function siteList(host) {
  return host.querySelector('details.gene-view-sites');
}

/** The list's rows, as a reader reads them. */
function rowTexts(host) {
  const list = siteList(host);
  return list === null ? [] : list.querySelector('ol').children.map((row) => row.textContent);
}

test('every published row of the densest locus has its own row in the list', async () => {
  const rows = evidence[DENSE];
  assert.ok(rows.length >= 20, `${DENSE} is the dense case; it has ${rows.length} rows`);
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    renderGeneViewer(host, joined(DENSE));
    const texts = rowTexts(host);
    assert.equal(texts.length, rows.length, 'one row per published row, none folded away');
    // Identity first, and every published identity present exactly once: a
    // cluster that swallowed a site would show here as a missing id.
    const listed = texts.map((text) => text.split(' · ')[0]).sort();
    assert.deepEqual(listed, rows.map((row) => row.id).sort());
    // Every row carries the five fields an inspection needs.
    for (const row of rows) {
      const text = texts.find((candidate) => candidate.startsWith(`${row.id} · `));
      assert.match(text, /plus strand|minus strand/);
      assert.ok(text.includes(row.position.toLocaleString('en-US')), 'its published coordinate');
      assert.ok(text.includes(`published ${row.sourceStartDistanceNt.toLocaleString('en-US')} nt upstream`),
        'the distance its own study published');
      assert.match(text, /measured site/);
    }
  });
});

test('a colliding mark is labelled by where it is drawn, and the label says display only', async () => {
  const model = geneViewModel(joined(DENSE));
  const clusters = startSiteClusters(model).filter((group) => group.length > 1);
  assert.ok(clusters.length > 0, `${DENSE} is drawn with overlapping marks`);
  const crowded = clusters.flat();
  assert.ok(crowded.length > clusters.length, 'at least one cluster holds more than one mark');

  await withFakeDocument((document) => {
    const host = document.createElement('div');
    renderGeneViewer(host, joined(DENSE));
    const texts = rowTexts(host);
    const labelled = texts.filter((text) => /overlapping cluster/.test(text));
    assert.equal(labelled.length, crowded.length,
      'every mark that shares drawn space is labelled, and no other is');
    for (const text of labelled) {
      assert.match(text, /drawn in overlapping cluster \d+ of \d+, with \d+ other sites? \(display only\)/);
    }
    // The clusters are numbered over the overlapping ones only, so the number
    // in a row and the count in the description are the same count.
    const numbers = new Set(labelled.map((text) => /cluster (\d+) of (\d+)/.exec(text)[2]));
    assert.deepEqual([...numbers], [String(clusters.length)]);
    // Display only, said in the prose as well as in each label.
    const note = siteList(host).querySelector('p').textContent;
    assert.match(note, /group nothing else, so each site keeps its own coordinate and its own row/);
    assert.ok(!/one site|the same site/.test(note));
  });
});

test('the list changes no mark: the drawing is what it was without it', async () => {
  await withFakeDocument(() => {
    for (const id of [DENSE, MINUS]) {
      const model = geneViewModel(joined(id));
      const svg = geneViewSvg(model);
      const heads = svg.querySelectorAll('circle');
      assert.equal(heads.length, model.tss.length, 'one head per drawable site, still');
      assert.deepEqual(heads.map((head) => Number(head.getAttribute('r'))),
        heads.map(() => TSS_MARK_RADIUS));
      // Each head is still at the position its own published distance gives it,
      // not at a cluster's centre.
      const expected = model.tss.map((mark) => mark.offset);
      const drawn = heads.map((head) => Number(head.getAttribute('cx'))).sort((a, b) => a - b);
      assert.equal(drawn.length, expected.length);
      for (let i = 1; i < drawn.length; i += 1) {
        assert.ok(drawn[i] >= drawn[i - 1], 'drawn in the order the offsets run');
      }
      // And every head still carries its own title, which is the pointer path.
      assert.equal(svg.querySelectorAll('title').filter(
        (title) => /published \d+ nt upstream/.test(title.textContent),
      ).length, model.tss.length);
    }
  });
});

test('both strands are drawn and listed, and a minus-strand site reads as one', async () => {
  const minus = joined(MINUS);
  assert.equal(minus.strand, '-');
  assert.ok(evidence[MINUS].length > 0);
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    renderGeneViewer(host, minus);
    const texts = rowTexts(host);
    assert.equal(texts.length, evidence[MINUS].length);
    for (const text of texts) assert.match(text, /minus strand/);
    const plus = document.createElement('div');
    renderGeneViewer(plus, joined(DENSE));
    for (const text of rowTexts(plus)) assert.match(text, /plus strand/);
  });
});

test('a site-only gene lists its sites, and a gene with no site has no list', async () => {
  // The pooled initiation score and the site layer are separate: a site stands
  // without a score, so the list is built from the rows and nothing else.
  const siteOnly = Object.keys(evidence)
    .map((id) => joined(id))
    .find((gene) => !Number.isFinite(gene.tssInitiation) && gene.tssEvidence.length > 0);
  assert.ok(siteOnly, 'the shipped file has genes with sites and no pooled score');
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    renderGeneViewer(host, siteOnly);
    assert.equal(rowTexts(host).length, siteOnly.tssEvidence.length);
    // A score with no site creates nothing: there is no row to list.
    renderGeneViewer(host, { ...joined(NO_SITES), tssInitiation: 4.2 });
    assert.equal(siteList(host), null, 'a pooled score never invents a site row');
    assert.equal(rowTexts(host).length, 0);
  });
});

test('a row with no published distance is kept and said to have no mark', async () => {
  const gene = {
    ...joined(NO_SITES),
    tssEvidence: [
      {
        id: 'gTSS+1', type: 'gTSS', replicon: 'CP006471', strand: '+', position: 1200,
        sourceStartDistanceNt: 40, rawReads: { control: [7, 9] },
      },
      // Published, mapped to this locus, and with nothing to place it at.
      { id: 'gTSS+2', type: 'gTSS', replicon: 'CP006471', strand: '+', position: 900 },
    ],
  };
  const model = geneViewModel(gene);
  assert.equal(model.tss.length, 1, 'only the row with a distance is drawn');
  assert.equal(model.tssSites.length, 2, 'both rows are carried for inspection');
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    renderGeneViewer(host, gene);
    assert.equal(host.querySelectorAll('circle').length, 1);
    const texts = rowTexts(host);
    assert.equal(texts.length, 2);
    assert.match(texts[1], /^gTSS\+2 · /);
    assert.match(texts[1], /no published upstream distance, so no mark is drawn/);
    // Explicitly unmapped, never an absence of evidence and never a mark at 0.
    assert.match(siteList(host).querySelector('p').textContent,
      /1 row has no published upstream distance and so no mark; the row is kept rather than dropped/);
    assert.ok(!/0 nt upstream/.test(texts[1]));
  });
});

test('a malformed row is described by what it lacks, not filled in from its neighbours', async () => {
  const gene = {
    ...joined(NO_SITES),
    tssEvidence: [
      {
        id: 'gTSS+1', type: 'gTSS', replicon: 'CP006471', strand: '+', position: 1200,
        sourceStartDistanceNt: 40, rawReads: { control: [7, 9] },
      },
      // No id, no type, no strand, no coordinate, no replicon, no reads.
      { sourceStartDistanceNt: 25 },
    ],
  };
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    renderGeneViewer(host, gene);
    const texts = rowTexts(host);
    assert.equal(texts.length, 2);
    const malformed = texts.find((text) => text.startsWith('identifier not recorded'));
    assert.match(malformed, /site type not recorded/);
    assert.match(malformed, /strand not recorded/);
    assert.match(malformed, /no published genome coordinate/);
    assert.match(malformed, /measured site, no condition read count in this row/);
    // Nothing of the healthy neighbour has leaked into it.
    assert.ok(!/gTSS\+1|CP006471|1,200|plus strand/.test(malformed));
    // It is still drawn: it has a published distance, which is all a mark needs.
    assert.equal(host.querySelectorAll('circle').length, 2);
  });
});

test('the list waits for the start-site file rather than reading as a complete set', async () => {
  const gene = joined(DENSE);
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    for (const pending of ['loading', 'failed']) {
      renderGeneViewer(host, gene, { tssPending: pending });
      assert.equal(siteList(host), null,
        'a list built mid-join would read as this locus’s complete set of sites');
      assert.ok(host.querySelector('p.evidence-pending') !== null);
    }
    renderGeneViewer(host, gene);
    assert.equal(rowTexts(host).length, evidence[DENSE].length);
  });
});

test('an organism with no start-site layer gets no list and no overlap sentence', async () => {
  const gene = {
    id: 'b0001', name: null, product: null, seqid: 'NC_000913.3', strand: '+',
    start: 1000, end: 2000, lengthNt: 1001, lengthCodons: 333, terminalStop: 'TAA',
    cdsSegments: null, translationalException: null,
    tssEvidence: [
      { id: 'gTSS+1', strand: '+', position: 980, sourceStartDistanceNt: 20 },
      { id: 'gTSS+2', strand: '+', position: 979, sourceStartDistanceNt: 21 },
    ],
  };
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    renderGeneViewer(host, gene, { organism: ECOLI });
    assert.equal(siteList(host), null);
    assert.equal(host.querySelectorAll('circle').length, 0);
    assert.ok(!/Tan|start site|cluster/i.test(host.children.map((child) => child.textContent).join(' ')));
    const said = describeGeneView(geneViewModel(gene), null, ECOLI);
    assert.ok(!/overlapping cluster|share drawn space/.test(said));
    // The default organism, handed the same record, draws and lists both.
    const cyano = document.createElement('div');
    renderGeneViewer(cyano, gene);
    assert.equal(cyano.querySelectorAll('circle').length, 2);
    assert.equal(rowTexts(cyano).length, 2);
  });
});

test('the description points at the list only when marks actually collide', () => {
  const dense = describeGeneView(geneViewModel(joined(DENSE)));
  assert.match(dense, /share drawn space in \d+ overlapping clusters?, so their heads are not separately readable/);
  assert.match(dense, /Every site is listed on its own row/);
  assert.match(dense, /A cluster is where the marks are drawn at this width, not one site and not continuous evidence\./);
  // A gene whose sites are far apart has no cluster, so no sentence about one.
  const apart = geneViewModel({
    ...joined(NO_SITES),
    tssEvidence: [
      { id: 'a', strand: '+', position: 100, sourceStartDistanceNt: 900 },
      { id: 'b', strand: '+', position: 999, sourceStartDistanceNt: 1 },
    ],
  });
  assert.equal(startSiteClusters(apart).filter((group) => group.length > 1).length, 0);
  assert.ok(!/share drawn space|overlapping cluster/.test(describeGeneView(apart)));
  // And a gene with nothing to draw says nothing about overlap either.
  assert.ok(!/share drawn space/.test(describeGeneView(geneViewModel(joined(NO_SITES)))));
});

test('marks are grouped by single linkage at exactly one head width', () => {
  // The rule is the drawn head: two marks closer than a diameter overlap at
  // every rendered size, because the viewBox scales the gap and the head by the
  // same factor, and marks a diameter apart overlap at none.
  const at = (...xs) => overlapGroups(xs.map((x, i) => ({ id: i, offset: x })), (x) => x, 6);
  assert.deepEqual(at(0, 5.9).map((group) => group.length), [2], 'just inside a head width');
  assert.deepEqual(at(0, 6).map((group) => group.length), [1, 1], 'exactly a head width apart');
  // A chain is one cluster even where its ends are further apart than a head.
  assert.deepEqual(at(0, 5, 10, 15).map((group) => group.length), [4]);
  assert.deepEqual(at(0, 5, 20, 25, 40).map((group) => group.length), [2, 2, 1]);
  // Every mark lands in exactly one group, which is what lets a caller label
  // each of them and lose none.
  assert.deepEqual(at().length, 0);
  assert.deepEqual(at(0, 5, 20, 25, 40).flat().map((mark) => mark.id), [0, 1, 2, 3, 4]);
});

test('every shipped gene lists exactly the rows the file publishes for it', () => {
  // The audit D1 runs over the drawing, run over the list: a list that dropped
  // a row, or invented one, is a worse answer than the cluster it exists to
  // explain. Over the real file, because that is where a dense locus is.
  let rows = 0;
  for (const [id, published] of Object.entries(evidence)) {
    const model = geneViewModel(joined(id));
    assert.deepEqual(model.tssSites.map((row) => row.id).sort(),
      published.map((row) => row.id).sort(), `${id} lists its own rows`);
    assert.equal(model.tssSites.filter((row) => row.drawn).length, model.tss.length,
      `${id} draws every row it can place and no other`);
    rows += model.tssSites.length;
  }
  assert.equal(rows, Object.values(evidence).flat().length);
  assert.ok(rows > 2400, `the shipped file carries ${rows} rows`);
});

test('a row reports the read counts it carries, and never a count it does not', () => {
  const [row] = tssSiteRows({
    strand: '+',
    start: 100,
    end: 200,
    tssEvidence: [{
      id: 'gTSS+1',
      sourceStartDistanceNt: 10,
      rawReads: { control: [4, 7], dark: [null, 2], highLight: [null, null] },
    }],
  });
  assert.equal(row.readCount, 3, 'three finite counts across the conditions it reports');
  assert.equal(row.evidence, 'measured');
  const [none] = tssSiteRows({
    strand: '+', start: 100, end: 200, tssEvidence: [{ id: 'gTSS+2', sourceStartDistanceNt: 10 }],
  });
  assert.equal(none.readCount, 0);
  assert.equal(none.evidence, 'unrecorded');
});
