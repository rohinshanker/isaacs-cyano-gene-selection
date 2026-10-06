/**
 * What the gene visualizer says, and draws, about Tan 2018 start-site evidence.
 *
 * Two contracts live here. The first is the recorded absence: no
 * ribosome-occupancy, translation-initiation-site, transcription-termination-site,
 * or start-site data set beyond Tan 2018 is admitted for this strain or its
 * admitted sister strains, and the view states that in its text equivalent rather
 * than leaving an unexplained empty space. The sweep behind it returned no new
 * candidate for any of those tracks; the one termination-site hit it named is
 * ranked in the roadmap and not admitted, so the statement is about what is
 * admitted and says nothing about what has been deposited.
 *
 * The second is completeness, over the shipped data rather than a fixture, and
 * measured on the picture rather than on the model: every mapped site of every
 * gene reaches the drawing exactly once, carrying its own identity, and none of
 * them lands outside the domain the drawing covers. Both halves need the real
 * thing. A count taken off `model.tss` would stand while `drawTss` was deleted
 * and nothing was painted, and `fractionOf` clamps, so a site past either end of
 * the domain is not dropped — it is painted onto the edge, at a distance the
 * source never published. Only a check against the real file, read back out of
 * the real SVG, catches either.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describeGeneView, geneViewSvg, renderGeneViewer } from '../../site/js/ui/gene-viewer.js';
import { geneViewModel, fractionOf, tssMarks } from '../../site/js/core/gene-view-model.js';
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

/** Every shipped gene that carries at least one evidence row. */
function genesWithEvidence() {
  return Object.keys(evidence).map((id) => joined(id));
}

const ABSENCE = /No ribosome-occupancy, translation-initiation-site, transcription-termination-site, or start-site data set beyond Tan 2018 is admitted for this strain or its admitted sister strains, so none of those tracks is drawn\./;

const WITH_SITES = 'M744_RS08615';
const WITHOUT_SITES = 'M744_RS00005';
/** Two sites on one gene, which is what a duplicate can be built to stand in for. */
const TWO_SITES = 'M744_RS06365';

test('the viewer states the absent evidence instead of leaving an unexplained gap', () => {
  assert.ok(!(WITHOUT_SITES in evidence), `${WITHOUT_SITES} is the no-site case`);
  for (const id of [WITH_SITES, WITHOUT_SITES]) {
    assert.match(describeGeneView(geneViewModel(joined(id))), ABSENCE);
  }
  // The statement is about what is admitted, not about the organism. It must not
  // read as "this strain has no translation-initiation sites".
  const text = describeGeneView(geneViewModel(joined(WITHOUT_SITES)));
  assert.match(text, /is admitted for this strain or its admitted sister strains/);
  assert.doesNotMatch(text, /do(?:es)? not (?:exist|occur)|absent from|has no (?:ribosome|translation|transcription)/);
  // Date-free wording: the only year in the description names the shipped study.
  // A sweep date would go stale the next time the sweep is repeated.
  const years = new Set([...text.matchAll(/\b(?:19|20)\d{2}\b/g)].map((match) => match[0]));
  assert.deepEqual([...years], ['2018']);
  // Nothing is selected: there is no view to explain, so there is no caveat.
  assert.equal(describeGeneView(null), 'No gene is selected.');
});

test('the absence is not stated while the start-site file is still in flight', () => {
  // It rests on Tan 2018 being the one admitted start-site data set, which is a
  // claim about what has landed. Beside "still loading" it would contradict the
  // loading wording, so it waits for the file either way.
  for (const pending of ['loading', 'failed']) {
    for (const id of [WITH_SITES, WITHOUT_SITES]) {
      const text = describeGeneView(geneViewModel(joined(id)), pending);
      assert.doesNotMatch(text, ABSENCE);
      assert.doesNotMatch(text, /is admitted for this strain/);
    }
  }
  // The loading wording itself is untouched, and the statement returns once the
  // file has landed.
  const model = geneViewModel(joined(WITHOUT_SITES));
  assert.match(describeGeneView(model, 'loading'), /still loading, so none is drawn yet/);
  assert.match(describeGeneView(model, 'failed'), /could not be loaded, so none is drawn/);
  assert.match(describeGeneView(model, null), ABSENCE);
});

test('the absence reaches the accessible description and adds no visible text', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    for (const id of [WITH_SITES, WITHOUT_SITES]) {
      renderGeneViewer(host, joined(id));
      const svg = host.querySelector('svg');
      assert.match(svg.getAttribute('aria-label'), ABSENCE);
      assert.match(svg.querySelector('desc').textContent, ABSENCE);
      // Everything outside the SVG is what a sighted reader reads. The owner
      // rejected explanatory interface text, so the statement stays out of it:
      // no note, no legend row, no badge, no disclosure button.
      const visible = host.children
        .filter((child) => child.tagName !== 'svg')
        .map((child) => child.textContent)
        .join(' ');
      assert.doesNotMatch(visible, ABSENCE);
      assert.doesNotMatch(visible, /is admitted for this strain/);
      assert.equal(host.querySelectorAll('button').length, 0);
      assert.equal(host.querySelectorAll('details').length, 0);
    }
  });
});

/** How often each id occurs, which is what comparing two multisets needs. */
function tally(ids) {
  const counts = new Map();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/** The identity a drawn mark carries, which is its `<title>` and nothing else. */
const MARK_TITLE = /^(.+): published (-?\d+) nt upstream of the Tan 2018 gene-model start(?:; its published genome coordinate, where the chromosome view draws it, is -?\d+ nt from this release's start, \d+ nt away)?$/;

/**
 * One layer of the drawing, by the class it is drawn with, or null when the
 * builder drew no such layer. An SVG node carries its class as an attribute,
 * which is not what a class selector reads, so the layers are found by the
 * attribute the builder actually sets.
 */
function layer(root, className) {
  return root.children.find((node) => node.getAttribute?.('class') === className) ?? null;
}

/**
 * The start-site marks the real SVG builder drew, read back out of the picture.
 *
 * Reading `model.tss` would audit the model and call it the drawing: with
 * `drawTss` deleted from `geneViewSvg` that array is unchanged and nothing is
 * painted. These marks come from the nodes instead. The ruler's axis line spans
 * the drawn width, which is what turns a circle's `cx` back into the offset it
 * stands at without reaching for the view's private constants.
 */
function drawnMarks(model) {
  const root = geneViewSvg(model);
  const axis = layer(root, 'gene-view-ruler').children[0];
  const left = Number(axis.getAttribute('x1'));
  const right = Number(axis.getAttribute('x2'));
  const marks = (layer(root, 'gene-view-tss')?.children ?? []).map((node) => {
    const parsed = MARK_TITLE.exec(node.querySelector('title')?.textContent ?? '');
    const circle = node.querySelector('circle');
    return {
      id: parsed?.[1] ?? null,
      distanceNt: parsed ? Number(parsed[2]) : null,
      x: circle ? Number(circle.getAttribute('cx')) : null,
      // Present in the DOM is not painted: a mark needs both its stem and its head.
      glyphs: Boolean(circle && node.querySelector('line')),
    };
  });
  return { marks, at: (offset) => left + fractionOf(model.domain, offset) * (right - left) };
}

/**
 * Audit one gene's drawn start-site marks against its own source rows.
 *
 * Returns one string per problem, and an empty list when the drawing is
 * faithful, so the shipped-data pass and the injected failures put the same
 * function to the same question. Comparing the two multisets is the point of it:
 * equal counts with every drawn id present would accept the same site drawn
 * twice in place of a sibling that was dropped.
 *
 * Needs a `document`, because it builds the SVG rather than trusting the model.
 *
 * @returns {{problems: string[], drawn: number}}
 */
function auditGeneDrawing(gene) {
  const problems = [];
  const say = (text) => problems.push(`${gene.id}: ${text}`);
  const sites = Array.isArray(gene.tssEvidence) ? gene.tssEvidence : [];
  const model = geneViewModel(gene);
  // A gene with evidence but no drawable model would take its sites down with
  // it, so that is an omission too, not a skipped case.
  if (!model) {
    say(`${sites.length} evidence rows and no view model`);
    return { problems, drawn: 0 };
  }
  if (JSON.stringify(model.tss) !== JSON.stringify(tssMarks(gene))) {
    say('the model does not carry tssMarks() unchanged');
  }
  const { marks, at } = drawnMarks(model);

  // A site id names one published site, so a row carrying an id another row
  // already carries is a row standing in for a site that is now gone without
  // trace. That is what one mark drawn in place of another looks like in the
  // file, and every count still agrees when it happens, so the ids have to be
  // required distinct before any count means anything.
  const source = tally(sites.map((site) => site.id));
  for (const [id, rows] of source) {
    if (rows > 1) say(`${id} appears in ${rows} source rows`);
  }

  // Every source row against every drawn mark, counted in both directions.
  const drawn = tally(marks.map((mark) => mark.id));
  for (const id of new Set([...source.keys(), ...drawn.keys()])) {
    const rows = source.get(id) ?? 0;
    const painted = drawn.get(id) ?? 0;
    if (rows !== painted) say(`${id} is ${rows} source row(s) and ${painted} drawn mark(s)`);
  }

  // The drawing follows the model mark for mark, in the model's own order.
  if (marks.length !== model.tss.length) {
    say(`${model.tss.length} marks in the model and ${marks.length} drawn`);
  }
  model.tss.forEach((mark, index) => {
    const painted = marks[index];
    if (!painted) return;
    if (painted.id !== mark.id || painted.distanceNt !== mark.distanceNt) {
      say(`mark ${index} is ${mark.id} at ${mark.distanceNt} nt in the model and `
        + `${painted.id} at ${painted.distanceNt} nt in the drawing`);
    }
    if (!painted.glyphs) say(`${mark.id} is drawn with no stem or no head`);
    if (!(Math.abs(painted.x - at(mark.offset)) <= 1e-9)) {
      say(`${mark.id} is painted at ${painted.x}, not at ${at(mark.offset)}`);
    }
  });

  // Where each mark sits, against the domain the drawing covers.
  const width = model.domain.max - model.domain.min;
  for (const mark of model.tss) {
    if (mark.offset < model.domain.min || mark.offset > model.domain.max) {
      say(`${mark.id} at ${mark.offset} is outside [${model.domain.min}, ${model.domain.max}]`);
    }
    // Clamping is the quiet failure: a mark past an end still draws, at a
    // position the source never reported. Comparing the clamped fraction with
    // the unclamped one catches it even if the bound check ever softens.
    const exact = (mark.offset - model.domain.min) / width;
    if (Math.abs(fractionOf(model.domain, mark.offset) - exact) > 1e-12) {
      say(`${mark.id} at ${mark.offset} would be clamped onto an edge`);
    }
    // Drawn as published. A mark that renamed, re-measured, or re-stranded its
    // row is not the evidence the file holds.
    const site = sites.find((candidate) => candidate.id === mark.id);
    if (!site
      || mark.distanceNt !== site.sourceStartDistanceNt
      || mark.offset !== -site.sourceStartDistanceNt
      || mark.strand !== (site.strand ?? null)
      || mark.position !== (Number.isFinite(site.position) ? site.position : null)
      || mark.replicon !== (site.replicon ?? null)) {
      say(`${mark.id} does not match its source row`);
    }
  }
  return { problems, drawn: marks.length };
}

test('every mapped Tan site of every shipped gene becomes exactly one drawn mark', async () => {
  await withFakeDocument(() => {
    const problems = [];
    let siteRows = 0;
    let painted = 0;

    for (const gene of genesWithEvidence()) {
      siteRows += gene.tssEvidence.length;
      const audit = auditGeneDrawing(gene);
      problems.push(...audit.problems);
      painted += audit.drawn;
    }

    assert.deepEqual(problems, [], 'start-site marks the drawing does not place faithfully');
    assert.equal(painted, siteRows);
    // File-wide, each site id names one site. Without that the comparison above
    // has nothing to hold on to: a row replaced by a copy of its sibling would be
    // drawn faithfully, twice, with every count still agreeing.
    const ids = genesWithEvidence().flatMap((gene) => gene.tssEvidence.map((site) => site.id));
    assert.equal(new Set(ids).size, siteRows, 'two rows share a site id');
    // The totals the contract already pins, counted on the marks the SVG drew.
    assert.equal(siteRows, 2432);
    assert.equal(Object.keys(evidence).length, 1789);
    // A gene with no evidence draws no start-site layer at all, so an empty
    // group cannot stand in for a drawn one.
    const bare = geneViewSvg(geneViewModel(joined(WITHOUT_SITES)));
    assert.equal(layer(bare, 'gene-view-tss'), null);
    assert.ok(layer(bare, 'gene-view-ruler'), 'the rest of the drawing is still there');
  });
});

test('the completeness audit covers every case class, and none of them is empty', async () => {
  await withFakeDocument(() => {
    const withEvidence = genesWithEvidence();
    const classes = {
      multipleSites: withEvidence.filter((gene) => gene.tssEvidence.length > 1),
      // A pooled initiation score and an exact site are separate layers: an
      // absent score must never suppress a mapped site.
      siteOnly: withEvidence.filter((gene) => !Number.isFinite(gene.tssInitiation)),
      minusStrand: withEvidence.filter((gene) => gene.strand === '-'),
      plusStrand: withEvidence.filter((gene) => gene.strand !== '-'),
      spliced: withEvidence.filter((gene) => (gene.cdsSegments ?? []).length > 1),
      // A site the study published at the start itself, which has to draw at
      // offset zero rather than be read as a missing distance.
      atAnnotatedStart: withEvidence.filter((gene) => gene.tssEvidence
        .some((site) => site.sourceStartDistanceNt === 0)),
      plasmid: withEvidence.filter((gene) => gene.seqid !== 'NZ_CP006471.1'),
    };
    for (const [name, members] of Object.entries(classes)) {
      assert.ok(members.length > 0, `${name} has no shipped example, so it is untested`);
      for (const gene of members) {
        const audit = auditGeneDrawing(gene);
        assert.deepEqual(audit.problems, [], `${name}: ${gene.id}`);
        assert.equal(audit.drawn, gene.tssEvidence.length, `${name}: ${gene.id}`);
      }
    }

    // The widest and narrowest upstream distances in the file, which are what set
    // the domain's upstream end and what sit closest to the annotated start.
    const all = withEvidence.flatMap((gene) => gene.tssEvidence
      .map((site) => ({ gene, site })));
    const byDistance = [...all].sort(
      (a, b) => a.site.sourceStartDistanceNt - b.site.sourceStartDistanceNt,
    );
    for (const { gene, site } of [byDistance[0], byDistance[byDistance.length - 1]]) {
      const model = geneViewModel(gene);
      const mark = model.tss.find((candidate) => candidate.id === site.id);
      assert.ok(mark, `${gene.id} ${site.id} is not drawn`);
      assert.equal(model.domain.min <= mark.offset, true);
      assert.equal(mark.distanceNt, site.sourceStartDistanceNt);
    }
    // The furthest site sets the upstream end of its own domain, so it is drawn
    // at the very left edge rather than off it.
    const furthest = byDistance[byDistance.length - 1];
    const furthestModel = geneViewModel(furthest.gene);
    assert.equal(furthestModel.domain.min, -furthest.site.sourceStartDistanceNt);
    assert.equal(fractionOf(furthestModel.domain, -furthest.site.sourceStartDistanceNt), 0);
  });
});

test('the origin-crossing plasmid genes draw on their own short track', () => {
  // `M744_RS13290` is complement(join(45877..46366,1..2510)) and `M744_RS13620`
  // is join(7830..7842,1..281). Their `start` and `end` span almost the whole
  // replicon, so a domain built from those would put any mark tens of kilobases
  // from where it belongs. Neither carries a Tan row in the shipped file; the
  // completeness rule is asserted over whatever rows they do carry, so a row
  // added later is covered without editing this test.
  for (const id of ['M744_RS13290', 'M744_RS13620']) {
    const gene = joined(id);
    const model = geneViewModel(gene);
    assert.ok(model, `${id} draws nothing`);
    assert.ok((gene.cdsSegments ?? []).length > 1, `${id} is no longer a join`);
    assert.equal(model.tss.length, gene.tssEvidence.length);
    const codingEnd = model.segments[model.segments.length - 1].to;
    assert.equal(codingEnd, gene.lengthNt - 1, `${id}: the track is the coding length`);
    assert.ok(model.domain.max - model.domain.min < gene.end - gene.start,
      `${id}: the domain spans the replicon instead of the gene`);
    for (const mark of model.tss) {
      assert.ok(mark.offset >= model.domain.min && mark.offset <= model.domain.max);
    }
  }
});

test('the audit rejects a dropped row, a duplicate standing in for one, and a clamp', async () => {
  await withFakeDocument(() => {
    // A check over data that happens to be clean proves nothing unless it would
    // notice data that is not. Each injected row is a failure the audit claims
    // to catch, and each one is put to the audit itself rather than to a
    // restatement of it.
    const base = joined(WITH_SITES);
    const [row] = base.tssEvidence;
    assert.deepEqual(auditGeneDrawing(base).problems, [], 'the unmodified gene passes');

    // No published distance: nowhere to draw, so the site is left out by design,
    // and the audit reports the row that reached no mark.
    for (const missing of [null, undefined, Number.NaN, '105']) {
      const gene = { ...base, tssEvidence: [{ ...row, sourceStartDistanceNt: missing }] };
      assert.equal(tssMarks(gene).length, 0);
      assert.equal(geneViewModel(gene).tss.length, 0);
      assert.deepEqual(auditGeneDrawing(gene).problems,
        [`${gene.id}: ${row.id} is 1 source row(s) and 0 drawn mark(s)`]);
    }

    // One site standing in for another: the second row of a two-site gene
    // replaced by a copy of the first. The count still says two, both drawn ids
    // are real published sites, and each one looks up to a row that matches it,
    // so a count-and-lookup audit accepts it and the omitted site leaves no
    // trace. Requiring the ids distinct is what finds it.
    const pair = joined(TWO_SITES);
    assert.equal(pair.tssEvidence.length, 2, `${TWO_SITES} is the two-site case`);
    const [kept, omitted] = pair.tssEvidence;
    assert.notEqual(kept.id, omitted.id);
    const duplicated = { ...pair, tssEvidence: [kept, { ...kept }] };
    assert.equal(geneViewModel(duplicated).tss.length, duplicated.tssEvidence.length,
      'the counts still agree, which is why the count is not the audit');
    assert.ok(geneViewModel(duplicated).tss.every((mark) => mark.id === kept.id));
    assert.deepEqual(auditGeneDrawing(duplicated).problems,
      [`${TWO_SITES}: ${kept.id} appears in 2 source rows`]);
    // The same substitution over the whole file: the audit names that gene and no
    // other, and the file's distinct-id count falls one short of its row count.
    const swept = genesWithEvidence().map((gene) => (gene.id === TWO_SITES ? duplicated : gene));
    const problems = swept.flatMap((gene) => auditGeneDrawing(gene).problems);
    assert.deepEqual(problems, [`${TWO_SITES}: ${kept.id} appears in 2 source rows`]);
    const sweptIds = swept.flatMap((gene) => gene.tssEvidence.map((site) => site.id));
    assert.equal(sweptIds.length, 2432);
    assert.equal(new Set(sweptIds).size, 2431);

    // Downstream of the annotated start by more than the drawn track: a positive
    // offset the domain cannot reach, which `fractionOf` would clamp onto the
    // right edge and draw as though it were the last base.
    const past = { ...base, tssEvidence: [{ ...row, sourceStartDistanceNt: -1_000_000 }] };
    const pastModel = geneViewModel(past);
    const mark = pastModel.tss[0];
    assert.equal(mark.offset, 1_000_000);
    assert.ok(mark.offset > pastModel.domain.max, 'the injected site is outside the domain');
    assert.equal(fractionOf(pastModel.domain, mark.offset), 1);
    assert.deepEqual(auditGeneDrawing(past).problems, [
      `${past.id}: ${mark.id} at ${mark.offset} is outside `
        + `[${pastModel.domain.min}, ${pastModel.domain.max}]`,
      `${past.id}: ${mark.id} at ${mark.offset} would be clamped onto an edge`,
    ]);

    // Upstream sites always fit, because the domain is opened to the furthest of
    // them. That is the invariant the shipped-data check confirms holds.
    const far = { ...base, tssEvidence: [{ ...row, sourceStartDistanceNt: 50_000 }] };
    const farModel = geneViewModel(far);
    assert.equal(farModel.domain.min, -50_000);
    assert.equal(farModel.tss[0].offset, -50_000);
    assert.equal(fractionOf(farModel.domain, farModel.tss[0].offset), 0);
    assert.deepEqual(auditGeneDrawing(far).problems, []);
  });
});

/**
 * Data-use audit A-02: the gene view draws the published upstream distance and
 * the chromosome view the published genome coordinate. The two disagree for a
 * minority of sites, and the viewer must say so per site rather than let a
 * reader assume one picture is the other. The counts the audit measured are
 * pinned here so a change in either placement is seen in review.
 */
test('the placement divergence between the two views is counted and named per site', () => {
  const marks = genesWithEvidence().flatMap((gene) => tssMarks(gene));
  assert.equal(marks.length, 2432);
  const apart = marks.filter((mark) => mark.placementGapNt > 0);
  const gaps = apart.map((mark) => mark.placementGapNt).sort((a, b) => a - b);
  assert.equal(apart.length, 236);
  assert.equal(gaps[0], 3);
  assert.equal(gaps[gaps.length - 1], 198);
  assert.equal(apart.filter((mark) => mark.impliedDistanceNt < 0).length, 15,
    'published coordinates that fall inside the current CDS');

  // A gene whose coordinate implies a start inside the CDS names the gap and
  // the lab's decision; one whose placements agree says so in one sentence.
  const inside = joined('M744_RS04380');
  const text = describeGeneView(geneViewModel(inside));
  assert.match(text, /chromosome view draws the published genome coordinate instead, which differs from this placement for gTSS\+849362 by 168 nt; that coordinate falls inside the current coding sequence\. Which placement a construct boundary should follow is for the lab to decide\./);
  const agreeing = genesWithEvidence().find((gene) => tssMarks(gene).every((mark) => mark.placementGapNt === 0));
  assert.match(describeGeneView(geneViewModel(agreeing)),
    /chromosome view draws the same sites? at the published genome coordinate, which agrees with this placement\./);

  // The per-site title carries the same gap, and only where there is one.
  withFakeDocument((document) => {
    const titles = (gene) => geneViewSvg(geneViewModel(gene), document)
      .querySelectorAll('title').map((node) => node.textContent)
      .filter((title) => title.includes('gTSS'));
    assert.ok(titles(inside).some((title) => /gTSS\+849362: published 22 nt upstream of the Tan 2018 gene-model start; its published genome coordinate, where the chromosome view draws it, is -146 nt from this release's start, 168 nt away/.test(title)));
    assert.ok(titles(agreeing).every((title) => !title.includes('chromosome view')));
  });
});
