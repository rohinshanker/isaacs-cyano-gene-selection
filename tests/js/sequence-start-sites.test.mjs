/**
 * Tan 2018 start sites on the pinned gene's sequence close-up.
 *
 * At one letter per column the placement basis stops being a nuance. The small
 * gene visualizer draws each site at the distance the study published against
 * **its own** gene model, which is the evidence that study reported; this
 * release's annotated start can differ from that model, and at base resolution
 * a distance measured against the other model points at the wrong letter. So
 * this strip places a mark only where it has a base at the site's **own
 * published genome coordinate**, carries the other basis beside it, and names
 * the gap instead of choosing. 63 of the 869 placeable rows in the shipped file
 * disagree by 1 nt or more, and `M744_RS00920` — the one spliced gene with a
 * site — disagrees by 67.
 *
 * A row this strip has no base for is the common case, not an error: the
 * release ships 30 upstream bases and Tan distances run to 999 nt, so 1,563 of
 * the 2,432 published rows land outside the strip entirely. Those rows stay in
 * the list with an explicit reason, because a dropped row is indistinguishable
 * from a row the study never published.
 *
 * The rest is the contract the other three views already hold to: marks only,
 * a control built only where there is a mark to govern, hidden said out loud as
 * its own state, and the complete list as the keyboard and touch path.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MARKER_CONTROL, MARKER_HEAD_PX, MARKER_HIT_PADDING_PX, MARKER_ROW_HEIGHT,
  GeneSequenceView, LABEL_WIDTH, OPEN_PX_PER_NT,
} from '../../site/js/ui/gene-sequence-view.js';
import {
  describeSequenceMarkers, geneSequenceModel, markerPlacement, sequenceColumns, sequenceMarkers,
} from '../../site/js/core/gene-sequence-model.js';
import { markerCoversPosition, markerLayerForKey, markerOf } from '../../site/js/core/marker-layers.js';
import { CodonTable } from '../../site/js/core/codon-table.js';
import { DEFAULT_ORGANISM, organismById } from '../../site/js/core/organisms.js';
import { withFakeDocument } from './fake-dom.mjs';
import { standardTable } from './helpers.mjs';

const dataUrl = (name) => new URL(`../../site/data/${name}`, import.meta.url);
const meta = JSON.parse(readFileSync(dataUrl('meta.json')));
const genes = JSON.parse(readFileSync(dataUrl('genes.json')));
const evidence = JSON.parse(readFileSync(dataUrl('tss_evidence.json')));
const sequenceContext = JSON.parse(readFileSync(dataUrl('sequence_context.json')));
const table = new CodonTable(meta.codonAlphabet);
const geneById = new Map(genes.map((gene) => [gene.id, gene]));
const expandedUpstream = new Map(sequenceContext.geneIds
  .map((id, index) => [id, sequenceContext.upstream[index]]));
const ECOLI = organismById('ecoli-k12-mg1655');
const TAN = markerLayerForKey('tssEvidence');

/** A shipped gene with its published rows joined, as the loader joins them. */
function joined(id) {
  return { ...geneById.get(id), tssEvidence: evidence[id] ?? [] };
}

/** The same gene after the optional exact 1,000-nt sidecar lands. */
function expanded(id) {
  return { ...joined(id), extendedUpstream: expandedUpstream.get(id) };
}

const modelOf = (gene) => geneSequenceModel(gene, table, null);
const rowsOf = (gene) => sequenceMarkers(gene, modelOf(gene));
const placedOf = (gene) => rowsOf(gene).filter((row) => row.placement.status === 'placed');

/** Every shipped gene that publishes at least one row. */
function genesWithEvidence() {
  return Object.keys(evidence).filter((id) => geneById.has(id)).map(joined);
}

const STRIP_WIDTH = 900;

function mount(document, gene, overrides = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const changes = [];
  const announced = [];
  const view = new GeneSequenceView(host, {
    onAnnounce: (message) => announced.push(message),
    onMarkersVisibleChange: (visible) => changes.push(visible),
  });
  view.update({ gene: null, table, scheme: null, schemeVersion: 0, organism: DEFAULT_ORGANISM });
  view.strip.clientWidth = STRIP_WIDTH;
  view.update({
    gene, table, scheme: null, schemeVersion: 1, organism: DEFAULT_ORGANISM, ...overrides,
  });
  return { view, host, changes, announced };
}

const markGroups = (view) => view.strip.querySelectorAll('g.gene-sequence-marker');
const siteRows = (view) => view.markerListHost.querySelectorAll('li');
const toggleOf = (view) => view.markerControlHost.querySelector(`input[data-sequence-action="${MARKER_CONTROL}"]`);
const descriptionOf = (view) => view.strip.querySelector('svg').attributes['aria-label'];

/* ------------------------------------------------------------------ model */

test('a column exists for every base the strip shows, and for no other position', () => {
  // Built from the model's own position tables, so the minus strand counts
  // down and a splice gap is skipped rather than filled in.
  const plus = joined('M744_RS01695');
  const plusColumns = sequenceColumns(modelOf(plus));
  assert.equal(plusColumns.size, 30 + modelOf(plus).cdsLengthNt);
  assert.equal(plusColumns.get(plus.start), 0, 'the annotated start is offset zero');
  assert.equal(plusColumns.get(plus.start - 1), -1);
  assert.equal(plusColumns.get(plus.start - 30), -30);
  assert.equal(plusColumns.get(plus.start - 31), undefined, 'no 31st upstream base is shipped');

  const minus = joined('M744_RS09575');
  const minusColumns = sequenceColumns(modelOf(minus));
  assert.equal(minusColumns.get(minus.end), 0);
  assert.equal(minusColumns.get(minus.end + 1), -1, 'upstream counts away from the start');
  assert.equal(minusColumns.get(minus.end + 30), -30);

  // The spliced gene: the skipped base has no column, and the piece after the
  // gap carries on from the offset the gap ended at.
  const spliced = joined('M744_RS00920');
  const splicedColumns = sequenceColumns(modelOf(spliced));
  assert.deepEqual(spliced.cdsSegments, [[169621, 169692], [169694, 170743]]);
  assert.equal(splicedColumns.get(169692), 71);
  assert.equal(splicedColumns.get(169693), undefined, 'the skipped base is not a column');
  assert.equal(splicedColumns.get(169694), 72);

  // A gene whose upstream context the release does not ship has only coding
  // columns, so an upstream coordinate has nowhere to go rather than being
  // placed on the start.
  const bare = modelOf({ ...spliced, rnaContext: null });
  assert.equal(sequenceColumns(bare).get(169620), undefined);
  assert.equal(sequenceColumns(bare).get(169621), 0);
  assert.equal(sequenceColumns(null).size, 0);
});

test('an origin-crossing gene continues its columns across base 1, upstream included', () => {
  // `M744_RS13620` is join(7830..7842,1..281) on the 7,842 bp plasmid: its
  // upstream bases run back from 7,829 and its coding columns cross base 1.
  // Both of the shipped origin-crossing genes publish no Tan row, so this is
  // where the wrap is pinned and a fixture row is what exercises placement.
  const gene = joined('M744_RS13620');
  assert.equal(gene.tssEvidence.length, 0);
  const columns = sequenceColumns(modelOf(gene));
  assert.equal(columns.get(7830), 0);
  assert.equal(columns.get(7842), 12);
  assert.equal(columns.get(1), 13, 'the coding sequence continues across the origin');
  assert.equal(columns.get(7829), -1, 'and so does the upstream context');
  assert.equal(columns.get(7800), -30);

  const model = modelOf(gene);
  const atWrap = markerOf({
    id: 'gTSS+7829', type: 'gTSS', replicon: 'CP006473', strand: '+', position: 7829,
  }, TAN);
  assert.deepEqual(markerPlacement(model, atWrap).fromOffset, -1);
  const pastWrap = markerOf({
    id: 'gTSS+1', type: 'gTSS', replicon: 'CP006473', strand: '+', position: 1,
  }, TAN);
  assert.equal(markerPlacement(model, pastWrap).fromOffset, 13);
  // A coordinate in the gap between the upstream window and nothing: 7,799 is
  // one base further than the shipped context.
  const beyond = markerOf({
    id: 'gTSS+7799', type: 'gTSS', replicon: 'CP006473', strand: '+', position: 7799,
  }, TAN);
  assert.equal(markerPlacement(model, beyond).status, 'unplaceable');
  assert.equal(markerPlacement(model, beyond).reason, 'outside-shown-sequence');
});

test('a point is placed on its own coordinate, and on nothing else', () => {
  const gene = joined('M744_RS01695');
  const model = modelOf(gene);
  const [row] = placedOf(gene);
  assert.equal(row.id, 'gTSS+320187');
  assert.equal(row.position, 320187);
  assert.equal(row.placement.fromOffset, -15);
  assert.equal(row.placement.toOffset, -15, 'a point occupies one column');
  assert.equal(row.placement.shownNt, 1);
  assert.equal(row.placement.spanNt, 1);

  // Every refusal has its own reason, and none of them is a placement.
  const unmapped = markerOf({ id: 'u', type: 'gTSS', replicon: 'CP006471' }, TAN);
  assert.equal(markerPlacement(model, unmapped).reason, 'no-native-coordinate');
  const elsewhere = markerOf({
    id: 'e', type: 'gTSS', replicon: 'CP006472', position: 320187,
  }, TAN);
  assert.equal(markerPlacement(model, elsewhere).reason, 'other-replicon',
    'the same number on another replicon is not this gene\'s base');
  for (const refused of [markerPlacement(model, unmapped), markerPlacement(model, elsewhere)]) {
    assert.deepEqual([refused.fromOffset, refused.toOffset, refused.shownNt],
      [null, null, 0]);
  }
  assert.equal(markerPlacement(null, unmapped).status, 'unplaceable');
});

test('an interval covers the columns the strip shows of it, and says when that is fewer', () => {
  const gene = joined('M744_RS01695');
  const model = modelOf(gene);
  // A promoter straddling the start: 320,192 is offset −10 and 320,205 is +4.
  const straddling = markerOf({
    id: 'P-1', type: 'promoter', replicon: 'CP006471', strand: '+',
    position: gene.start - 10, endPosition: gene.start + 4,
  }, TAN);
  const placement = markerPlacement(model, straddling);
  assert.equal(placement.status, 'placed');
  assert.deepEqual([placement.fromOffset, placement.toOffset], [-10, 4]);
  assert.equal(placement.spanNt, 15);
  assert.equal(placement.shownNt, 15);

  // One running off the upstream edge is placed over the part that is shown,
  // and reports how much of itself that is. It is never extended to the edge.
  const clipped = markerOf({
    id: 'P-2', type: 'promoter', replicon: 'CP006471', strand: '+',
    position: gene.start - 40, endPosition: gene.start - 20,
  }, TAN);
  const partial = markerPlacement(model, clipped);
  assert.deepEqual([partial.fromOffset, partial.toOffset], [-30, -20]);
  assert.equal(partial.spanNt, 21);
  assert.equal(partial.shownNt, 11, '11 of its 21 bases are inside the strip');

  // One wholly outside is unplaceable rather than clamped to an edge.
  const away = markerOf({
    id: 'P-3', type: 'promoter', replicon: 'CP006471', strand: '+',
    position: gene.start - 400, endPosition: gene.start - 380,
  }, TAN);
  assert.equal(markerPlacement(model, away).reason, 'outside-shown-sequence');

  // An interval across the splice gap spans both pieces and counts only the
  // bases that are columns: the skipped base is not one of them.
  const spliced = joined('M744_RS00920');
  const across = markerOf({
    id: 'P-4', type: 'promoter', replicon: 'CP006471', strand: '+',
    position: 169690, endPosition: 169696,
  }, TAN);
  const span = markerPlacement(modelOf(spliced), across);
  assert.deepEqual([span.fromOffset, span.toOffset], [69, 74]);
  assert.equal(span.spanNt, 7);
  assert.equal(span.shownNt, 6, 'the skipped genomic base is not a column');
});

test('every published row of every shipped gene reaches the list exactly once', () => {
  // The audit that makes a dropped row impossible to miss. It runs over the
  // shipped file rather than a fixture, so a change to either the data or the
  // placement rule is caught here.
  let placed = 0;
  let unplaceable = 0;
  let disagreeing = 0;
  const genesWithPlaced = new Set();
  const reasons = new Map();
  for (const gene of genesWithEvidence()) {
    const model = modelOf(gene);
    assert.ok(model, `${gene.id} builds a sequence model`);
    const rows = sequenceMarkers(gene, model);
    const ids = rows.map((entry) => entry.id);
    assert.deepEqual([...ids].sort(), gene.tssEvidence.map((site) => site.id).sort(),
      `${gene.id} lists exactly its own published rows`);
    assert.equal(new Set(ids).size, ids.length, `${gene.id} lists no row twice`);
    const columns = sequenceColumns(model);
    for (const entry of rows) {
      if (entry.placement.status !== 'placed') {
        unplaceable += 1;
        reasons.set(entry.placement.reason, (reasons.get(entry.placement.reason) ?? 0) + 1);
        assert.equal(columns.get(entry.position), undefined,
          `${entry.id} is refused only because this strip has no base for it`);
        continue;
      }
      placed += 1;
      genesWithPlaced.add(gene.id);
      // The column map is the authority, and the arithmetic against the
      // published distance agrees with it on every admitted row.
      assert.equal(entry.placement.fromOffset, columns.get(entry.position));
      assert.equal(entry.basisGapNt, entry.placementGapNt,
        `${entry.id}: the drawn gap is the gap the gene view already reported`);
      if (entry.basisGapNt > 0) disagreeing += 1;
    }
  }
  assert.equal(placed, 869);
  assert.equal(unplaceable, 1563);
  assert.equal(placed + unplaceable, 2432, 'every published row is accounted for');
  assert.equal(genesWithPlaced.size, 853);
  assert.deepEqual([...reasons], [['outside-shown-sequence', 1563]],
    'every refusal in the shipped file is a coordinate the strip has no base for');
  assert.equal(disagreeing, 63,
    'the two bases disagree for 63 rows, which is why neither is substituted for the other');
});

test('a disagreeing row is drawn at its own coordinate, never at the published distance', () => {
  // The spliced gene is the clearest case: Tan published 87 nt upstream
  // against their gene model, and their own coordinate is 20 nt upstream of
  // this release's start. The gene visualizer draws −87; this strip draws −20.
  const gene = joined('M744_RS00920');
  const [row] = placedOf(gene);
  assert.equal(row.id, 'gTSS+169601');
  assert.equal(row.position, 169601);
  assert.equal(row.distanceNt, 87);
  assert.equal(row.sourceOffset, -87, 'where the gene visualizer draws it');
  assert.equal(row.placement.fromOffset, -20, 'where this strip draws it');
  assert.equal(row.basisGapNt, 67);
  assert.equal(sequenceColumns(modelOf(gene)).get(169601), -20);

  // A published coordinate inside the current coding sequence is placed there
  // rather than forced upstream: that disagreement is the finding, not a bug.
  const inside = joined('M744_RS08390');
  const [coding] = placedOf(inside);
  assert.equal(coding.distanceNt, 33);
  assert.equal(coding.placement.fromOffset, 54);
  assert.equal(coding.basisGapNt, 87);

  // A site published at the annotated start itself is offset zero, read as a
  // position and not as a missing value.
  const [atStart] = placedOf(joined('M744_RS01280'));
  assert.equal(atStart.distanceNt, 0);
  assert.equal(atStart.placement.fromOffset, 0);
  assert.equal(atStart.basisGapNt, 0);
});

test('both strands place their own rows, and a minus-strand gene reads the same way', () => {
  const minus = joined('M744_RS09575');
  assert.equal(minus.strand, '-');
  assert.deepEqual(placedOf(minus).map((row) => [row.id, row.placement.fromOffset]),
    [['gTSS-1923859', -27], ['gTSS-1923851', -19]]);
  // Ordered by the column the strip draws at, not by the order the file lists.
  assert.deepEqual(minus.tssEvidence.map((site) => site.id),
    ['gTSS-1923851', 'gTSS-1923859']);

  const plus = joined('M744_RS10630');
  assert.equal(plus.strand, '+');
  assert.deepEqual(placedOf(plus).map((row) => [row.id, row.placement.fromOffset]),
    [['gTSS+2142025', -22], ['gTSS+2142035', -12]]);
});

test('the six states the description tells apart', () => {
  const gene = joined('M744_RS01695');
  const model = modelOf(gene);
  const rows = rowsOf(gene);
  const marks = (overrides) => ({
    label: 'Tan 2018', controlLabel: 'Show Tan 2018 start sites', rows, visible: true,
    pending: null, crowded: 0, ...overrides,
  });

  // 1. No layer at all: nothing is said, because nothing was looked for.
  assert.deepEqual(describeSequenceMarkers(model, null), []);

  // 2 and 3. Not loaded is not none.
  assert.match(describeSequenceMarkers(model, marks({ pending: 'loading' }))[0], /still loading/);
  assert.match(describeSequenceMarkers(model, marks({ pending: 'failed' }))[0], /could not be loaded/);

  // 4. Landed with no row for this locus: an exact-locus statement, not a
  // claim about the biology.
  assert.match(describeSequenceMarkers(model, marks({ rows: [] }))[0],
    /No Tan 2018 start site maps to this locus by exact locus tag\./);

  // 5. Drawn: where each mark is, on which basis, and what the other basis says.
  const shown = describeSequenceMarkers(model, marks()).join(' ');
  assert.match(shown, /1 Tan 2018 start site is marked on the sequence at the base each one's own published genome coordinate names: gTSS\+320187 at −15\./);
  assert.match(shown, /19 further published rows have coordinates that are not a base this close-up shows/);
  assert.match(shown, /All 20 Tan 2018 start sites published for this locus are listed below the strip\./);
  // One row reads as one row rather than "All 1 … are".
  assert.match(describeSequenceMarkers(modelOf(joined('M744_RS00920')),
    marks({ rows: rowsOf(joined('M744_RS00920')) })).join(' '),
  /The one Tan 2018 start site published for this locus is listed below the strip\./);
  assert.match(shown, /puts it at the same base, so this placement and the gene visualizer's agree/);

  // The disagreeing locus names the gap and takes no side.
  const spliced = joined('M744_RS00920');
  const divergent = describeSequenceMarkers(modelOf(spliced),
    marks({ rows: rowsOf(spliced) })).join(' ');
  assert.match(divergent, /67 nt away for gTSS\+169601/);
  assert.match(divergent, /for the lab to decide/);

  // 6. Hidden: its own state, naming the control and leaving the sites alone.
  const hidden = describeSequenceMarkers(model, marks({ visible: false })).join(' ');
  assert.match(hidden, /"Show Tan 2018 start sites" control is off, so no mark is drawn/);
  assert.match(hidden, /The sites, this sequence, its coordinates and the window shown are unchanged\./);
  assert.ok(!/marked on the sequence at the base/.test(hidden),
    'nothing about where a mark is, because none is drawn');

  // 7. Rows published but none placeable, which is none of the above.
  const away = joined('M744_RS09240');
  const nowhere = describeSequenceMarkers(modelOf(away), marks({ rows: rowsOf(away) })).join(' ');
  assert.match(nowhere, /its published genome coordinate is not a base this close-up shows, so no mark is drawn on the sequence/);
  assert.match(nowhere, /no mark is placed at a base their source did not report/);
  assert.ok(!/No Tan 2018 start site maps to this locus/.test(nowhere),
    'rows exist, so absence is never claimed');
});

/* ------------------------------------------------------------------- view */

test('the marks are drawn on the columns their coordinates name, with their own titles', async () => {
  await withFakeDocument(async (document) => {
    const { view } = mount(document, joined('M744_RS09575'));
    const marks = markGroups(view);
    assert.equal(marks.length, 2);
    assert.deepEqual(marks.map((mark) => mark.attributes['data-marker-id']),
      ['gTSS-1923859', 'gTSS-1923851']);

    // Each mark's column outline is exactly one base wide, at the x the strip
    // gives that offset: the geometry the letters are drawn at, not a second
    // derivation of it.
    const { from, perNt } = view.camera;
    for (const [index, offset] of [-27, -19].entries()) {
      const column = marks[index].querySelector('rect.gene-sequence-marker-column');
      assert.ok(Math.abs(Number(column.attributes.x) - (LABEL_WIDTH + (offset - from) * perNt)) < 1e-9);
      assert.ok(Math.abs(Number(column.attributes.width) - perNt) < 1e-9);
      assert.equal(Number(column.attributes.y), view.rowLayout().bases);
      // A point draws a head and a stem, not a span.
      assert.equal(marks[index].querySelectorAll('path.gene-sequence-marker-head').length, 1);
      assert.equal(marks[index].querySelectorAll('line.gene-sequence-marker-stem').length, 1);
      assert.equal(marks[index].querySelectorAll('rect.gene-sequence-marker-span').length, 0);
      const hit = marks[index].querySelector('rect.gene-sequence-marker-hit-target');
      assert.ok(hit, 'the tag has an invisible pointer target');
      assert.equal(Number(hit.attributes.width), MARKER_HEAD_PX + MARKER_HIT_PADDING_PX * 2);
      assert.equal(Number(hit.attributes.height), MARKER_ROW_HEIGHT);
      assert.equal(hit.attributes['pointer-events'], 'all');
      assert.equal(hit.attributes.fill, 'transparent');
    }

    // The title is the row's own account of itself, on both bases.
    const title = marks[0].querySelector('title').textContent;
    assert.match(title, /^gTSS-1923859: gene-linked transcription start site marked at −27, the base its own published genome coordinate 1,923,859 names, not remeasured from a distance\./);
    assert.match(title, /puts it at this same base, where the gene visualizer draws it/);

    // The row is reserved above the ruler, and the ruler and the bases sit
    // below it rather than being overdrawn.
    const rows = view.rowLayout();
    assert.equal(rows.markers, 0);
    assert.equal(rows.bases, MARKER_ROW_HEIGHT + 20);
    assert.equal(view.strip.querySelector('g.gene-sequence-labels').children.length, 3);
  });
});

test('a short sequence explains an excluded site and reveals it through the existing window', async () => {
  await withFakeDocument(async (document) => {
    const { view, announced } = mount(document, expanded('M744_RS00025'));
    assert.equal(view.upstreamNt, 30, 'the initial exact context remains 30 nt');
    assert.equal(markGroups(view).length, 0);
    assert.ok(toggleOf(view), 'a site revealable in a declared exact window keeps its control');
    const navigation = view.markerControlHost.querySelector('div.gene-sequence-marker-navigation');
    const button = navigation.querySelector('button');
    const status = navigation.querySelector('span.gene-sequence-facts');
    assert.equal(button.textContent, 'Show nearest site');
    assert.match(status.textContent, /beyond the current 30 nt sequence/);
    assert.match(status.textContent, /existing 60 nt upstream window/);

    button.click();

    assert.equal(view.upstreamNt, 60);
    assert.equal(markGroups(view).length, 1);
    const [row] = view.placedMarkers();
    assert.equal(view.markerInWindow(row), true);
    assert.match(announced.at(-1), /Tan 2018 start site .* shown at .* with 60 upstream nucleotides/);
  });
});

test('mixed rows promise only sites a larger exact sequence can actually reveal', async () => {
  await withFakeDocument(async (document) => {
    const base = expanded('M744_RS00025');
    const { view } = mount(document, {
      ...base,
      tssEvidence: [
        ...base.tssEvidence,
        {
          id: 'no-coordinate', type: 'gTSS', replicon: base.seqid, strand: base.strand,
          position: null, sourceStartDistanceNt: 15,
        },
        {
          id: 'other-replicon', type: 'gTSS', replicon: 'NZ_CP006472.1', strand: base.strand,
          position: base.start, sourceStartDistanceNt: 15,
        },
      ],
    });
    const navigation = view.markerControlHost.querySelector('div.gene-sequence-marker-navigation');
    const status = navigation.querySelector('span.gene-sequence-facts');
    assert.match(status.textContent, /1 published site lies beyond the current 30 nt sequence/);
    assert.match(status.textContent, /2 published rows cannot be placed in the available exact sequence/);
    assert.doesNotMatch(status.textContent, /3 published sites lie beyond/);

    navigation.querySelector('button').click();

    assert.equal(view.placedMarkers().length, 1);
    assert.match(view.markerControlHost.querySelector('span.gene-sequence-facts').textContent,
      /2 published rows cannot be placed in the available exact sequence/);
  });
});

test('successive actions reveal every longer-window site on the minus strand', async () => {
  await withFakeDocument(async (document) => {
    const { view } = mount(document, expanded('M744_RS00045'));
    assert.equal(view.model.strand, '-');
    assert.equal(view.markerRows.length, 3);
    assert.equal(view.placedMarkers().length, 0);

    let actions = 0;
    while (view.placedMarkers().length < view.markerRows.length && actions < 6) {
      const button = view.markerControlHost.querySelector('button');
      assert.equal(button.hidden, false);
      button.click();
      actions += 1;
    }

    assert.equal(view.placedMarkers().length, 3);
    assert.equal(view.upstreamNt, 1000);
    assert.ok(actions >= 2, 'more distant rows require more than the first short expansion');
    assert.match(view.markerControlHost.querySelector('span.gene-sequence-facts').textContent,
      /3 placeable sites are in the current window|outside the current camera window/);
  });
});

test('a narrow opening camera explains off-screen sites and pans to the nearest one', async () => {
  await withFakeDocument(async (document) => {
    const { view } = mount(document, joined('M744_RS09575'));
    view.strip.clientWidth = 375;
    view.camera = null;
    view.render();
    assert.equal(markGroups(view).length, 0, 'both placeable sites open left of the narrow camera');
    const navigation = view.markerControlHost.querySelector('div.gene-sequence-marker-navigation');
    const button = navigation.querySelector('button');
    assert.equal(button.hidden, false);
    assert.match(navigation.querySelector('span.gene-sequence-facts').textContent,
      /2 of 2 placeable sites are outside the current camera window/);

    button.click();

    assert.ok(markGroups(view).length > 0);
    assert.equal(view.placedMarkers().some((row) => view.markerInWindow(row)), true);
  });
});

test('a saved hidden state remains explicit and does not navigate or draw', async () => {
  await withFakeDocument(async (document) => {
    const { view } = mount(document, expanded('M744_RS00025'), { markersVisible: false });
    assert.equal(toggleOf(view).checked, false);
    assert.equal(markGroups(view).length, 0);
    const navigation = view.markerControlHost.querySelector('div.gene-sequence-marker-navigation');
    const button = navigation.querySelector('button');
    assert.equal(button.disabled, true);
    assert.match(navigation.querySelector('span.gene-sequence-facts').textContent,
      /Tan 2018 sites are hidden in this view/);
    button.click();
    assert.equal(view.upstreamNt, 30);
    assert.equal(markGroups(view).length, 0);
  });
});

test('a disagreeing mark lands on the letter its coordinate names, and says where the other basis puts it', async () => {
  await withFakeDocument(async (document) => {
    const { view } = mount(document, joined('M744_RS00920'));
    const [mark] = markGroups(view);
    const { from, perNt } = view.camera;
    const column = mark.querySelector('rect.gene-sequence-marker-column');
    // −20, the published coordinate's own column, and not −87.
    assert.ok(Math.abs(Number(column.attributes.x) - (LABEL_WIDTH + (-20 - from) * perNt)) < 1e-9);
    const atDistance = LABEL_WIDTH + (-87 - from) * perNt;
    assert.ok(Math.abs(Number(column.attributes.x) - atDistance) > perNt,
      'the mark is not where the published distance would put it');
    assert.match(mark.querySelector('title').textContent,
      /87 nt upstream distance the study published against its own gene model puts it 67 nt away, which is where the gene visualizer draws it/);
  });
});

test('hiding the marks takes the marks and nothing else', async () => {
  await withFakeDocument(async (document) => {
    const { view, changes, announced } = mount(document, joined('M744_RS09575'));
    const before = {
      rows: view.rowLayout(),
      camera: { ...view.camera },
      readout: view.readout.textContent,
      cells: view.strip.querySelectorAll('g.gene-sequence-codon').length,
      upstream: view.strip.querySelectorAll('g.gene-sequence-upstream').length,
      ruler: view.strip.querySelector('g.gene-sequence-ruler').children.length,
      height: view.strip.querySelector('svg').attributes.height,
      list: siteRows(view).map((item) => item.textContent),
    };
    assert.equal(markGroups(view).length, 2);

    toggleOf(view).checked = false;
    toggleOf(view).dispatch('change');

    // Nothing of the mark is left behind: no head, no stem, no outline, and no
    // `<title>` for a pointer to find where a mark was.
    assert.equal(markGroups(view).length, 0);
    assert.equal(view.strip.querySelectorAll('rect.gene-sequence-marker-column').length, 0);
    assert.equal(view.strip.querySelectorAll('g.gene-sequence-markers').length, 0);

    // Every other thing the reader was looking at is identical, including the
    // reserved row height, so the letters do not move under their eyes.
    assert.deepEqual(view.rowLayout(), before.rows);
    assert.deepEqual({ ...view.camera }, before.camera);
    assert.equal(view.readout.textContent, before.readout);
    assert.equal(view.strip.querySelectorAll('g.gene-sequence-codon').length, before.cells);
    assert.equal(view.strip.querySelectorAll('g.gene-sequence-upstream').length, before.upstream);
    assert.equal(view.strip.querySelector('g.gene-sequence-ruler').children.length, before.ruler);
    assert.equal(view.strip.querySelector('svg').attributes.height, before.height);
    // The list is the metadata, not the drawing, so it stays — unchanged row
    // for unchanged row, because a row never said where it was drawn.
    assert.deepEqual(siteRows(view).map((item) => item.textContent), before.list);

    // The gutter stops naming a row it is not drawing: a labelled empty band
    // would read as a locus with no start site.
    assert.equal(view.strip.querySelector('g.gene-sequence-labels').children.length, 2);
    assert.match(descriptionOf(view), /control is off, so no mark is drawn/);

    // Reported up once, and announced.
    assert.deepEqual(changes, [false]);
    assert.deepEqual(announced, ['Tan 2018 start sites hidden on the sequence close-up.']);

    toggleOf(view).checked = true;
    toggleOf(view).dispatch('change');
    assert.equal(markGroups(view).length, 2);
    assert.deepEqual(changes, [false, true]);
  });
});

test('keyboard focus stays on the control across the repaint it causes', async () => {
  await withFakeDocument(async (document) => {
    const { view } = mount(document, joined('M744_RS09575'));
    const toggle = toggleOf(view);
    toggle.focus();
    assert.equal(document.activeElement, toggle);

    toggle.checked = false;
    toggle.dispatch('change');
    // The checkbox itself is not rebuilt, so focus is not merely restored: it
    // never left.
    assert.equal(toggleOf(view), toggle);
    assert.equal(document.activeElement, toggle);
    assert.equal(toggle.checked, false);

    // And it survives the caller's own next render, which rebuilds the host.
    view.update({
      gene: joined('M744_RS09575'), table, scheme: null, schemeVersion: 2,
      organism: DEFAULT_ORGANISM, markersVisible: false,
    });
    assert.equal(document.activeElement, toggleOf(view));
    assert.equal(toggleOf(view).checked, false);
  });
});

test('the caller owns the choice, so a link, a reload and a locus change all reach the picture', async () => {
  await withFakeDocument(async (document) => {
    // Opened from a link that hides this view's marks: the first paint has
    // none, without the reader touching anything.
    const { view, changes } = mount(document, joined('M744_RS09575'), { markersVisible: false });
    assert.equal(markGroups(view).length, 0);
    assert.equal(toggleOf(view).checked, false);
    assert.deepEqual(changes, [], 'reading the state is not a change to report');

    // A later render that says to show them does, and the control follows.
    view.update({
      gene: joined('M744_RS09575'), table, scheme: null, schemeVersion: 1,
      organism: DEFAULT_ORGANISM, markersVisible: true,
    });
    assert.equal(markGroups(view).length, 2);
    assert.equal(toggleOf(view).checked, true);

    // A locus with no mark to govern has no control, and the choice is not
    // lost in passing through it.
    view.update({
      gene: joined('M744_RS09240'), table, scheme: null, schemeVersion: 1,
      organism: DEFAULT_ORGANISM, markersVisible: false,
    });
    assert.equal(toggleOf(view), null);
    assert.equal(markGroups(view).length, 0);
    assert.equal(siteRows(view).length, 1, 'its one published row is still listed');
    view.update({
      gene: joined('M744_RS09575'), table, scheme: null, schemeVersion: 1,
      organism: DEFAULT_ORGANISM, markersVisible: false,
    });
    assert.equal(toggleOf(view).checked, false);
  });
});

test('no control where there is no mark for it to govern, and each of those states says itself', async () => {
  await withFakeDocument(async (document) => {
    // A locus whose every published row is outside the strip: no control, the
    // rows still listed, and the description says why rather than claiming
    // there is no site.
    const away = mount(document, joined('M744_RS09240'));
    assert.equal(toggleOf(away.view), null);
    assert.equal(away.view.rowLayout().markers, null, 'and no reserved row');
    assert.equal(siteRows(away.view).length, 1);
    assert.match(descriptionOf(away.view), /is not a base this close-up shows/);

    // A file in flight, and one that failed: a note instead of a control, and
    // no list, because a list built now would read as the complete set.
    for (const [state, text] of [['loading', /Loading the Tan 2018 start sites…/],
      ['failed', /Tan 2018 start sites could not be loaded\./]]) {
      const pending = mount(document, joined('M744_RS09575'), { markerPending: state });
      assert.equal(toggleOf(pending.view), null);
      assert.equal(markGroups(pending.view).length, 0);
      assert.equal(siteRows(pending.view).length, 0);
      assert.match(pending.view.markerControlHost.querySelector('p').textContent, text);
      assert.match(descriptionOf(pending.view), state === 'failed'
        ? /could not be loaded, so none is marked on the sequence/
        : /still loading, so none is marked on the sequence yet/);
    }

    // The organism with no such study: no control, no list, and nothing said
    // about a start site at all.
    const other = mount(document, joined('M744_RS09575'), { organism: ECOLI });
    assert.equal(toggleOf(other.view), null);
    assert.equal(siteRows(other.view).length, 0);
    assert.ok(!/start site/i.test(descriptionOf(other.view)));

    // Nothing pinned: the hosts are emptied, so no control outlives the figure.
    const { view } = mount(document, joined('M744_RS09575'));
    view.update({ gene: null, table, scheme: null, schemeVersion: 1, organism: DEFAULT_ORGANISM });
    assert.equal(toggleOf(view), null);
    assert.equal(siteRows(view).length, 0);
  });
});

test('the list names every field of every row, placed or not', async () => {
  await withFakeDocument(async (document) => {
    const { view } = mount(document, joined('M744_RS00920'));
    assert.match(view.markerListHost.querySelector('summary').textContent,
      /^Tan 2018 start sites \(1\)$/);
    const [item] = siteRows(view);
    const text = item.textContent;
    assert.match(text, /^gTSS\+169601 · gene-linked transcription start site · plus strand · CP006471 169,601/);
    assert.match(text, /marked here at −20/);
    assert.match(text, /published 87 nt upstream of the published gene-model start, where the gene visualizer draws it, 67 nt from this mark/);
    assert.match(text, /measured site · 8 condition read counts in this row/);

    // A row the strip cannot place says so, in its own words, and keeps every
    // field it does carry.
    const dense = mount(document, joined('M744_RS01695')).view;
    const rows = siteRows(dense).map((entry) => entry.textContent);
    assert.equal(rows.length, 20);
    assert.equal(rows.filter((row) => /marked here at /.test(row)).length, 1);
    assert.equal(
      rows.filter((row) => /its published coordinate is not a base this close-up shows, so no mark is drawn here/.test(row)).length,
      19,
    );
    for (const row of rows) {
      assert.match(row, /^gTSS\+\d+ · gene-linked transcription start site · (plus|minus) strand · CP006471 \d/);
      assert.match(row, /published \d+ nt upstream of the published gene-model start/);
      assert.match(row, /measured site/);
    }
    // The note states the basis the rows are read on, once.
    assert.match(dense.markerListHost.querySelector('p').textContent,
      /A mark on this strip sits on the base that row's own published genome coordinate names; the gene visualizer draws the same row at the distance the study published against its own gene model/);
  });
});

test('marks that share drawn space are labelled as a cluster and separate when zoomed in', async () => {
  await withFakeDocument(async (document) => {
    // At the opening zoom the two marks of this locus are 8 nt apart and well
    // clear of each other; fitting the whole gene brings them together.
    const { view } = mount(document, joined('M744_RS10630'));
    assert.equal(view.camera.perNt, OPEN_PX_PER_NT);
    let marks = markGroups(view);
    assert.equal(marks.length, 2);
    assert.equal(marks.filter((mark) => mark.hasClass('gene-sequence-marker-shared')).length, 0);
    assert.ok(!/share drawn space/.test(descriptionOf(view)));

    view.fitGene();
    marks = markGroups(view);
    const separation = 10 * view.camera.perNt;
    assert.ok(separation < MARKER_HEAD_PX, 'the whole gene puts the two heads inside one head');
    assert.equal(marks.filter((mark) => mark.hasClass('gene-sequence-marker-shared')).length, 2);
    assert.match(descriptionOf(view), /2 of those marks share drawn space at this zoom/);
    assert.match(descriptionOf(view), /not one site and not continuous evidence/);
    // Each still keeps its own column, its own title and its own row.
    assert.equal(new Set(marks.map((mark) => mark.querySelector('rect.gene-sequence-marker-column')
      .attributes.x)).size, 2);
    assert.match(marks[0].querySelector('title').textContent,
      /shares drawn space with 1 other mark at this zoom, which is display only/);
    assert.equal(siteRows(view).length, joined('M744_RS10630').tssEvidence.length,
      'every published row is still listed, crowded or not');

    // Zooming back in separates them, which is what the sentence promised.
    view.goToStart();
    assert.equal(markGroups(view).filter((mark) => mark.hasClass('gene-sequence-marker-shared')).length, 0);
  });
});

test('a mark outside the window is not drawn, and the ones inside it are', async () => {
  await withFakeDocument(async (document) => {
    const { view } = mount(document, joined('M744_RS09575'));
    assert.equal(markGroups(view).length, 2);
    // Pan past the upstream context: both marks are behind the left edge.
    view.setCamera({ from: 200, perNt: OPEN_PX_PER_NT });
    assert.equal(markGroups(view).length, 0);
    assert.ok(!/share drawn space/.test(descriptionOf(view)));
    // The rows are still all listed; only the drawing follows the camera.
    assert.equal(siteRows(view).length, 2);
    view.goToStart();
    assert.equal(markGroups(view).length, 2);
  });
});

test('an interval marker draws as a span over its columns', async () => {
  await withFakeDocument(async (document) => {
    // No admitted layer publishes an interval today, so this is the shared
    // representation's geometry exercised through the renderer that consumes
    // it: a promoter straddling the start of a real gene.
    const gene = joined('M744_RS01695');
    const { view } = mount(document, {
      ...gene,
      tssEvidence: [{
        id: 'P-1', type: 'promoter', replicon: 'CP006471', strand: '+',
        position: gene.start - 10, endPosition: gene.start + 4,
      }],
    });
    const [mark] = markGroups(view);
    assert.equal(mark.querySelectorAll('path.gene-sequence-marker-head').length, 0);
    const span = mark.querySelector('rect.gene-sequence-marker-span');
    const { from, perNt } = view.camera;
    assert.ok(Math.abs(Number(span.attributes.x) - (LABEL_WIDTH + (-10 - from) * perNt)) < 1e-9);
    assert.ok(Math.abs(Number(span.attributes.width) - 15 * perNt) < 1e-9);
    const column = mark.querySelector('rect.gene-sequence-marker-column');
    assert.ok(Math.abs(Number(column.attributes.width) - 15 * perNt) < 1e-9);
    assert.match(mark.querySelector('title').textContent,
      /^P-1: promoter marked at −10 to \+4, the bases its own published genome coordinate 320,192 to 320,206 names/);
    assert.match(siteRows(view)[0].textContent,
      /promoter · plus strand · CP006471 320,192 to 320,206, 15 nt · marked here over −10 to \+4/);
  });
});

test('a row with no coordinate and a row on another replicon are listed, not placed', async () => {
  await withFakeDocument(async (document) => {
    const gene = joined('M744_RS01695');
    const { view } = mount(document, {
      ...gene,
      tssEvidence: [
        { id: 'gTSS+320187', type: 'gTSS', replicon: 'CP006471', strand: '+', position: 320187, sourceStartDistanceNt: 15 },
        { id: 'no-coord', type: 'gTSS', replicon: 'CP006471', strand: '+', position: null, sourceStartDistanceNt: 15 },
        { id: 'elsewhere', type: 'gTSS', replicon: 'CP006472', strand: '+', position: 320187, sourceStartDistanceNt: 15 },
      ],
    });
    assert.equal(markGroups(view).length, 1);
    const rows = siteRows(view).map((item) => item.textContent);
    assert.equal(rows.length, 3);
    assert.match(rows.find((row) => row.startsWith('no-coord')),
      /no published genome coordinate · no published genome coordinate to place it on a base, so no mark is drawn here/);
    assert.match(rows.find((row) => row.startsWith('elsewhere')),
      /measured on another replicon than this gene, so no mark is drawn here/);
    // The one placeable row is unaffected by its neighbours.
    assert.match(rows.find((row) => row.startsWith('gTSS+320187')), /marked here at −15/);
  });
});

test('two rows on one base keep both marks, both titles and both rows', async () => {
  await withFakeDocument(async (document) => {
    // The exact-collision case the shipped file does not contain: nothing is
    // merged, dropped or moved to make room.
    const gene = joined('M744_RS01695');
    const { view } = mount(document, {
      ...gene,
      tssEvidence: [
        { id: 'source', type: 'gTSS', replicon: 'CP006471', strand: '+', position: 320187, sourceStartDistanceNt: 15, origin: 'source', producer: 'fixture source' },
        { id: 'computed', type: 'gTSS', replicon: 'CP006471', strand: '+', position: 320187, sourceStartDistanceNt: 15, origin: 'computed', producer: 'fixture computation' },
      ],
    });
    const marks = markGroups(view);
    assert.equal(marks.length, 2);
    assert.deepEqual(marks.map((mark) => mark.attributes['data-marker-id']), ['computed', 'source'],
      'the supplementary computation paints below source evidence');
    assert.ok(marks[0].hasClass('gene-sequence-marker-supplementary'));
    assert.ok(marks[1].hasClass('gene-sequence-marker-primary'));
    for (const mark of marks) {
      assert.equal(mark.getAttribute('tabindex'), '0');
      assert.equal(mark.getAttribute('role'), 'img');
      assert.ok(mark.getAttribute('aria-label'));
    }
    assert.equal(new Set(marks.map((mark) => mark.attributes['data-marker-id'])).size, 2);
    assert.equal(new Set(marks.map((mark) => mark.querySelector('rect.gene-sequence-marker-column')
      .attributes.x)).size, 1, 'one base, so one column, and both marks on it');
    assert.equal(marks.filter((mark) => mark.hasClass('gene-sequence-marker-shared')).length, 2);
    assert.match(descriptionOf(view), /2 of those marks share drawn space at this zoom/);
    assert.equal(siteRows(view).length, 2);
  });
});

test('a gene with no coordinates at all places nothing and says why', () => {
  // A record whose segments do not add up to its coding length has no position
  // for any base, so no mark can be placed on one. The close-up already says
  // the coordinates are not shown; the marks follow that, rather than being
  // placed on a letter whose coordinate the view will not stand behind.
  const sense = ['ATG', 'GCT', 'TCG', 'AAA'];
  const packed = standardTable();
  const gene = {
    id: 'M744_RS99999', name: null, product: null, seqid: 'NZ_CP006471.1', strand: '+',
    start: 1000, end: 1008, lengthNt: 12, lengthCodons: 4, terminalStop: 'TAG',
    cdsSegments: null, rnaContext: { upstream: 'ACGTACGTACGTACGTACGTACGTACGTAC' },
    codons: packed.encode(sense.map((codon) => packed.indexOf(codon))),
    tssEvidence: [{ id: 'gTSS+1000', type: 'gTSS', replicon: 'CP006471', strand: '+', position: 1000, sourceStartDistanceNt: 0 }],
  };
  const model = geneSequenceModel(gene, packed, null);
  assert.equal(model.coordinatesKnown, false);
  const columns = sequenceColumns(model);
  assert.equal(columns.get(1000), undefined, 'no coding base carries a position');
  const [row] = sequenceMarkers(gene, model);
  assert.equal(row.placement.status, 'unplaceable');
  assert.equal(row.placement.reason, 'outside-shown-sequence');
});

test('a native coordinate places a mark even where the published distance is missing', () => {
  // The two mappings are independent in both directions. The gene visualizer
  // needs the published distance and draws nothing without one; this strip
  // needs the native coordinate and does not read the distance at all. A row
  // carrying one and not the other is therefore drawn in exactly one view, and
  // listed in both.
  const gene = joined('M744_RS01695');
  const distanceless = {
    ...gene,
    tssEvidence: [{
      id: 'gTSS+320187', type: 'gTSS', replicon: 'CP006471', strand: '+', position: 320187,
      sourceStartDistanceNt: null,
    }],
  };
  const [row] = sequenceMarkers(distanceless, modelOf(distanceless));
  assert.equal(row.placement.status, 'placed');
  assert.equal(row.placement.fromOffset, -15);
  assert.equal(row.distanceNt, null);
  assert.equal(row.drawn, false, 'the gene visualizer has no offset to draw it at');
  assert.equal(row.basisGapNt, null, 'and so there is no gap between two bases');

  // And the reverse: a published distance with no coordinate draws on the
  // gene-relative track and nowhere here.
  const positionless = {
    ...gene,
    tssEvidence: [{
      id: 'gTSS+320187', type: 'gTSS', replicon: 'CP006471', strand: '+', position: null,
      sourceStartDistanceNt: 15,
    }],
  };
  const [other] = sequenceMarkers(positionless, modelOf(positionless));
  assert.equal(other.drawn, true);
  assert.equal(other.placement.reason, 'no-native-coordinate');
});

test('selecting a codon while the marks are hidden leaves them hidden', async () => {
  await withFakeDocument(async (document) => {
    const { view } = mount(document, joined('M744_RS09575'), { markersVisible: false });
    assert.equal(markGroups(view).length, 0);
    view.selectCodon(0);
    assert.equal(markGroups(view).length, 0, 'a redraw does not bring back a hidden mark');
    assert.match(view.selection.textContent, /^Codon 1: initiation triplet/);
    assert.equal(toggleOf(view).checked, false);
    // And the camera controls redraw the same way.
    view.fitGene();
    assert.equal(markGroups(view).length, 0);
    assert.equal(view.rowLayout().markers, 0, 'the row is still reserved by the data');
  });
});

/* ----------------------------------------------- disjoint covered stretches */

test('an interval that wraps the origin covers disjoint runs, and only those', () => {
  // The chromosome is circular, so an interval whose end precedes its start
  // runs across base 1 — and a strip showing a window on *this* side of the
  // origin then shows two separate stretches of it, with uncovered bases in
  // between. `M744_RS01695` starts at 320,202, so 320,212..320,206 covers the
  // 30 upstream bases and the first five coding bases, skips 320,207..320,211
  // (offsets +5 to +9), and resumes at 320,212.
  const gene = joined('M744_RS01695');
  assert.equal(gene.start, 320202);
  const model = modelOf(gene);
  const wrapping = markerOf({
    id: 'wrap', type: 'promoter', replicon: 'CP006471', strand: '+',
    position: 320212, endPosition: 320206,
  }, TAN);
  const placement = markerPlacement(model, wrapping);
  assert.equal(placement.status, 'placed');
  assert.deepEqual(placement.runs, [
    { fromOffset: -30, toOffset: 4, shownNt: 35 },
    { fromOffset: 10, toOffset: 227, shownNt: 218 },
  ]);
  assert.equal(placement.shownNt, 253, 'which is 35 + 218, not the 258 between the ends');
  assert.deepEqual([placement.fromOffset, placement.toOffset], [-30, 227],
    'the envelope is kept for the window and crowding tests, and is wider than the coverage');

  // The runs are exactly the covered columns, checked against the shared
  // membership test rather than against the arithmetic that produced them.
  const columns = sequenceColumns(model);
  const inRuns = new Set(placement.runs
    .flatMap(({ fromOffset, toOffset }) => Array.from(
      { length: toOffset - fromOffset + 1 }, (_, k) => fromOffset + k)));
  const covered = [...columns]
    .filter(([position]) => markerCoversPosition(wrapping, position))
    .map(([, offset]) => offset);
  assert.deepEqual([...inRuns].sort((a, b) => a - b), covered.sort((a, b) => a - b));
  for (const [position, offset] of columns) {
    assert.equal(inRuns.has(offset), markerCoversPosition(wrapping, position),
      `offset ${offset} at ${position}`);
  }
  assert.deepEqual([5, 6, 7, 8, 9].filter((offset) => inRuns.has(offset)), [],
    'the five excluded bases are in no run');
});

test('the minus strand counts its runs the same way, and a splice gap makes none', () => {
  // The excluded band is contiguous in genomic coordinates, so on a
  // minus-strand gene it is contiguous in columns too — counted down instead of
  // up. `M744_RS09575` ends at 1,923,832, which is its offset zero.
  const minus = joined('M744_RS09575');
  assert.equal(minus.strand, '-');
  const wrapping = markerOf({
    id: 'wrap-minus', type: 'promoter', replicon: 'CP006471', strand: '-',
    position: 1923828, endPosition: 1923822,
  }, TAN);
  const model = modelOf(minus);
  const placement = markerPlacement(model, wrapping);
  assert.deepEqual(placement.runs, [
    { fromOffset: -30, toOffset: 4, shownNt: 35 },
    { fromOffset: 10, toOffset: 1799, shownNt: 1790 },
  ]);
  assert.equal(placement.shownNt, 1825);
  const columns = sequenceColumns(model);
  const excluded = [...columns]
    .filter(([position, offset]) => offset >= placement.fromOffset
      && offset <= placement.toOffset && !markerCoversPosition(wrapping, position))
    .map(([, offset]) => offset)
    .sort((a, b) => a - b);
  assert.deepEqual(excluded, [5, 6, 7, 8, 9], 'and they are the bases between the runs');

  // A splice gap removes genomic bases, not columns: the columns either side of
  // it are consecutive, so an interval across it is one run and not two.
  const spliced = joined('M744_RS00920');
  const across = markerOf({
    id: 'P-4', type: 'promoter', replicon: 'CP006471', strand: '+',
    position: 169690, endPosition: 169696,
  }, TAN);
  assert.deepEqual(markerPlacement(modelOf(spliced), across).runs,
    [{ fromOffset: 69, toOffset: 74, shownNt: 6 }]);
});

test('a wrapping interval draws one outline per covered run, over no excluded base', async () => {
  await withFakeDocument(async (document) => {
    const gene = joined('M744_RS01695');
    const { view } = mount(document, {
      ...gene,
      tssEvidence: [{
        id: 'wrap', type: 'promoter', replicon: 'CP006471', strand: '+',
        position: 320212, endPosition: 320206,
      }],
    });
    const [mark] = markGroups(view);
    const { from, perNt } = view.camera;
    const x = (offset) => LABEL_WIDTH + (offset - from) * perNt;
    const runs = [[-30, 5], [10, 228]];
    for (const selector of ['rect.gene-sequence-marker-span', 'rect.gene-sequence-marker-column']) {
      const drawn = mark.querySelectorAll(selector)
        .map((node) => [Number(node.attributes.x), Number(node.attributes.width)])
        .sort((a, b) => a[0] - b[0]);
      assert.equal(drawn.length, 2, `${selector} is drawn once per covered run`);
      drawn.forEach(([left, width], index) => {
        const [fromOffset, pastEnd] = runs[index];
        assert.ok(Math.abs(left - x(fromOffset)) < 1e-9, `${selector} starts at the run`);
        assert.ok(Math.abs(width - (pastEnd - fromOffset) * perNt) < 1e-9,
          `${selector} is as wide as the run and no wider`);
      });
      // Nothing is painted over the five bases the interval does not cover.
      for (const offset of [5, 6, 7, 8, 9]) {
        const centre = x(offset) + perNt / 2;
        assert.ok(drawn.every(([left, width]) => centre < left || centre > left + width),
          `${selector} leaves offset ${offset} alone`);
      }
    }
    // One mark, one identity, one description: the separate outlines are how
    // the coverage is drawn and never two sites.
    assert.equal(markGroups(view).length, 1);
    assert.equal(mark.querySelectorAll('title').length, 1);
    assert.match(mark.querySelector('title').textContent,
      /^wrap: promoter marked at −30 to \+4 and \+10 to \+227, the bases its own published genome coordinate 320,212 to 320,206 names, not remeasured from a distance\. Its covered bases reach this close-up in 2 separate stretches, and the bases between them are outside what it covers, so each stretch is outlined on its own\./);
    assert.match(siteRows(view)[0].textContent,
      /marked here over −30 to \+4 and \+10 to \+227, 2 separate stretches with the bases between them not covered, 253 of its 2,690,413 bases shown/);
  });
});

test('a contiguous interval and a point still draw one run each', async () => {
  await withFakeDocument(async (document) => {
    // The disjoint case must not cost the ordinary one an extra outline.
    const gene = joined('M744_RS01695');
    const { view } = mount(document, {
      ...gene,
      tssEvidence: [
        {
          id: 'P-1', type: 'promoter', replicon: 'CP006471', strand: '+',
          position: gene.start - 10, endPosition: gene.start + 4,
        },
        {
          id: 'gTSS+320187', type: 'gTSS', replicon: 'CP006471', strand: '+',
          position: 320187, sourceStartDistanceNt: 15,
        },
      ],
    });
    for (const mark of markGroups(view)) {
      assert.equal(mark.querySelectorAll('rect.gene-sequence-marker-column').length, 1);
      assert.equal(mark.querySelectorAll('line.gene-sequence-marker-stem').length, 1);
      assert.doesNotMatch(mark.querySelector('title').textContent, /separate stretches/);
    }
    assert.deepEqual(
      rowsOf({ ...gene, tssEvidence: [{ id: 'P-1', type: 'promoter', replicon: 'CP006471', strand: '+', position: gene.start - 10, endPosition: gene.start + 4 }] })[0]
        .placement.runs,
      [{ fromOffset: -10, toOffset: 4, shownNt: 15 }],
    );
  });
});

/* ------------------------------------------- the other mapping, or its lack */

test('agreement is claimed only where there is a distance to compare', async () => {
  const gene = joined('M744_RS01695');
  const rowAt = (overrides) => ({
    id: 'gTSS+320187', type: 'gTSS', replicon: 'CP006471', strand: '+', position: 320187,
    ...overrides,
  });
  const describe = (tssEvidence) => {
    const subject = { ...gene, tssEvidence };
    const model = modelOf(subject);
    return describeSequenceMarkers(model, {
      label: 'Tan 2018',
      controlLabel: 'Show Tan 2018 start sites',
      rows: sequenceMarkers(subject, model),
      visible: true,
      pending: null,
    }).join(' ');
  };

  // A row with no published distance is placed here and nowhere else, so
  // there is no second base and nothing to agree with. Reading its absent
  // distance as "the same base" would credit the study with an agreement
  // about an annotation it never saw.
  const nativeOnly = describe([rowAt({ sourceStartDistanceNt: null })]);
  assert.doesNotMatch(nativeOnly, /the same base/);
  assert.doesNotMatch(nativeOnly, /agree/);
  assert.match(nativeOnly, /That site has no distance published against the study's own gene model, so the gene visualizer draws no mark for it and there is nothing to compare this placement with\./);
  assert.match(nativeOnly, /The row is kept as published, and no distance is derived from the coordinate to stand in for one\./);

  // A distance that lands on the same base still says they agree.
  assert.match(describe([rowAt({ sourceStartDistanceNt: 15 })]),
    /puts it at the same base, so this placement and the gene visualizer's agree\./);
  // And one that does not still names the gap, unchanged.
  assert.match(describe([rowAt({ sourceStartDistanceNt: 40 })]),
    /25 nt away for gTSS\+320187/);

  // Mixed: each row is accounted for by name, and the agreement sentence
  // covers only the row it is true of.
  const mixed = describe([
    rowAt({ id: 'agreeing', sourceStartDistanceNt: 15 }),
    rowAt({ id: 'apart', position: 320186, sourceStartDistanceNt: 40 }),
    rowAt({ id: 'native-only', position: 320185, sourceStartDistanceNt: null }),
  ]);
  assert.match(mixed, /24 nt away for apart/);
  assert.match(mixed, /puts agreeing at the same base, so that placement and the gene visualizer's agree\./);
  assert.match(mixed, /native-only has no distance published against the study's own gene model/);
  assert.doesNotMatch(mixed, /puts each of them at the same base/);
});

test('a mark and its row say which mappings the row publishes', async () => {
  await withFakeDocument(async (document) => {
    const gene = joined('M744_RS01695');
    const { view } = mount(document, {
      ...gene,
      tssEvidence: [{
        id: 'native-only', type: 'gTSS', replicon: 'CP006471', strand: '+', position: 320187,
        sourceStartDistanceNt: null,
      }],
    });
    const title = markGroups(view)[0].querySelector('title').textContent;
    assert.match(title, /No distance against the study's own gene model is published for this row, so the gene visualizer draws no mark for it and there is nothing to compare this base with\./);
    assert.doesNotMatch(title, /same base/);
    assert.match(siteRows(view)[0].textContent,
      /marked here at −15 · no published upstream distance, so the gene visualizer draws no mark either/);
    assert.doesNotMatch(descriptionOf(view), /agree/);
  });
});

/* -------------------------------------------- focus across every transition */

/**
 * The labelled thing focus landed on, or null.
 *
 * Named by its accessible label rather than by node identity, because what the
 * contract owes a reader is somewhere labelled that survived — not a
 * particular element.
 */
function focusedLabel(document) {
  const active = document.activeElement;
  if (!active) return null;
  return active.getAttribute?.('aria-label') ?? null;
}

const relabel = (gene) => ({
  gene, table, scheme: null, organism: DEFAULT_ORGANISM,
});

test('the control taking focus with it leaves the reader on the labelled strip', async () => {
  await withFakeDocument(async (document) => {
    // `M744_RS09240` publishes rows and this strip can place none of them, so
    // the control goes while the reader is standing on it. Every other way the
    // control can disappear ends in the same place.
    const { view } = mount(document, joined('M744_RS09575'));
    const transitions = [
      ['a locus whose rows are all off this window', { ...relabel(joined('M744_RS09240')), schemeVersion: 2 }],
      ['the layer still loading', { ...relabel(joined('M744_RS09575')), schemeVersion: 3, markerPending: 'loading' }],
      ['the layer failed', { ...relabel(joined('M744_RS09575')), schemeVersion: 4, markerPending: 'failed' }],
      ['an organism with no such layer', { ...relabel(joined('M744_RS09575')), schemeVersion: 5, organism: ECOLI }],
    ];
    for (const [what, input] of transitions) {
      view.update({ ...relabel(joined('M744_RS09575')), schemeVersion: 1 });
      const toggle = toggleOf(view);
      assert.ok(toggle, `${what}: the control is there to be held first`);
      toggle.focus();
      view.update(input);
      assert.equal(toggleOf(view), null, `${what}: the control is gone`);
      assert.equal(document.activeElement, view.strip, `${what}: focus is on the strip`);
      assert.equal(focusedLabel(document), 'Sequence close-up',
        `${what}: and the strip says what it is`);
    }
  });
});

test('unpinning the gene leaves the reader on this view, not on the document', async () => {
  await withFakeDocument(async (document) => {
    const { view, host } = mount(document, joined('M744_RS09575'));
    toggleOf(view).focus();
    view.update({ gene: null, table, scheme: null, schemeVersion: 9, organism: DEFAULT_ORGANISM });
    // The strip is inside the hidden figure, so the fallback is the view's own
    // host — which is labelled, takes focus, and holds the note that says
    // there is nothing pinned.
    assert.equal(view.figure.hidden, true);
    assert.equal(document.activeElement, host);
    assert.equal(focusedLabel(document), 'Gene sequence close-up');
    assert.equal(host.tabIndex, -1, 'focusable on purpose, and not in the Tab order');
    assert.equal(view.empty.hidden, false);
  });
});

test('the open site list keeps its identity, its state and its focus across a rerender', async () => {
  await withFakeDocument(async (document) => {
    const { view } = mount(document, joined('M744_RS09575'));
    const details = view.markerListHost.querySelector('details');
    const summary = details.querySelector('summary');
    details.open = true;
    summary.focus();

    // Any unrelated change to the page re-renders this view — another view's
    // marker visibility, a recompiled scheme, a hover somewhere else. None of
    // them is a reason to close what the reader opened.
    for (const schemeVersion of [2, 3]) {
      view.update({ ...relabel(joined('M744_RS09575')), schemeVersion });
      assert.equal(view.markerListHost.querySelector('details'), details, 'the same disclosure');
      assert.equal(details.querySelector('summary'), summary);
      assert.equal(details.open, true, 'still open');
      assert.equal(document.activeElement, summary, 'and still focused');
      assert.equal(details.hidden, false);
    }
    // Its contents do follow the locus, and the rows are the new gene's.
    view.update({ ...relabel(joined('M744_RS01695')), schemeVersion: 4 });
    assert.equal(view.markerListHost.querySelector('details'), details);
    assert.equal(details.open, true);
    assert.equal(siteRows(view).length, joined('M744_RS01695').tssEvidence.length);

    // A locus with no rows hides it and empties it, rather than leaving the
    // last gene's rows behind a closed summary; focus comes back to the strip.
    summary.focus();
    view.update({ ...relabel(joined('M744_RS00010')), schemeVersion: 5 });
    assert.equal(details.hidden, true);
    assert.equal(siteRows(view).length, 0);
    assert.equal(document.activeElement, view.strip);
    assert.equal(focusedLabel(document), 'Sequence close-up');
  });
});

test('toggling the marks leaves the open list open and the control focused', async () => {
  await withFakeDocument(async (document) => {
    const { view } = mount(document, joined('M744_RS09575'));
    const details = view.markerListHost.querySelector('details');
    details.open = true;
    const toggle = toggleOf(view);
    toggle.focus();
    toggle.checked = false;
    toggle.dispatch('change');
    assert.equal(document.activeElement, toggle, 'the checkbox is not rebuilt');
    assert.equal(view.markerListHost.querySelector('details'), details);
    assert.equal(details.open, true, 'hiding the marks does not close the list');
    assert.match(view.markerNote.textContent, /control is off, so no mark is drawn/);
    assert.equal(siteRows(view).length, 2, 'and every row is still listed');
  });
});

test('focus outside this view is left where the reader put it', async () => {
  await withFakeDocument(async (document) => {
    const { view } = mount(document, joined('M744_RS09575'));
    const elsewhere = document.createElement('button');
    elsewhere.setAttribute('aria-label', 'Somewhere else entirely');
    document.body.append(elsewhere);
    elsewhere.focus();
    // Every transition that would have moved focus had the reader been inside
    // this view: the control goes, the list goes, the gene goes.
    view.update({ ...relabel(joined('M744_RS09240')), schemeVersion: 2 });
    view.update({ ...relabel(joined('M744_RS09575')), schemeVersion: 3, markerPending: 'loading' });
    view.update({ gene: null, table, scheme: null, schemeVersion: 4, organism: DEFAULT_ORGANISM });
    assert.equal(document.activeElement, elsewhere);
    assert.notEqual(view.strip.focused, true, 'the strip was never asked to take focus');
    assert.notEqual(view.host.focused, true);
  });
});
