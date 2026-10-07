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
  MARKER_CONTROL, MARKER_HEAD_PX, MARKER_ROW_HEIGHT, GeneSequenceView, LABEL_WIDTH,
  OPEN_PX_PER_NT,
} from '../../site/js/ui/gene-sequence-view.js';
import {
  describeSequenceMarkers, geneSequenceModel, markerPlacement, sequenceColumns, sequenceMarkers,
} from '../../site/js/core/gene-sequence-model.js';
import { markerLayerForKey, markerOf } from '../../site/js/core/marker-layers.js';
import { CodonTable } from '../../site/js/core/codon-table.js';
import { DEFAULT_ORGANISM, organismById } from '../../site/js/core/organisms.js';
import { withFakeDocument } from './fake-dom.mjs';
import { standardTable } from './helpers.mjs';

const dataUrl = (name) => new URL(`../../site/data/${name}`, import.meta.url);
const meta = JSON.parse(readFileSync(dataUrl('meta.json')));
const genes = JSON.parse(readFileSync(dataUrl('genes.json')));
const evidence = JSON.parse(readFileSync(dataUrl('tss_evidence.json')));
const table = new CodonTable(meta.codonAlphabet);
const geneById = new Map(genes.map((gene) => [gene.id, gene]));
const ECOLI = organismById('ecoli-k12-mg1655');
const TAN = markerLayerForKey('tssEvidence');

/** A shipped gene with its published rows joined, as the loader joins them. */
function joined(id) {
  return { ...geneById.get(id), tssEvidence: evidence[id] ?? [] };
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
        { id: 'gTSS+320187', type: 'gTSS', replicon: 'CP006471', strand: '+', position: 320187, sourceStartDistanceNt: 15 },
        { id: 'gTSS+320187b', type: 'gTSS', replicon: 'CP006471', strand: '+', position: 320187, sourceStartDistanceNt: 15 },
      ],
    });
    const marks = markGroups(view);
    assert.equal(marks.length, 2);
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
