import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CELL_PX_PER_NT, CODON_HIT_PADDING_PX, EDGE_PAD_NT, FALLBACK_WIDTH, GeneSequenceView, LABEL_WIDTH,
  LETTER_PX_PER_NT, MAX_PX_PER_NT, MIN_OPENING_CDS_NT, OPEN_PX_PER_NT, cameraWindow,
  clampCamera, fittingCamera, openingCamera, residueTicks,
} from '../../site/js/ui/gene-sequence-view.js';
import { compileScheme } from '../../site/js/core/scheme.js';
import { DEFAULT_ORGANISM } from '../../site/js/core/organisms.js';
import { withFakeDocument } from './fake-dom.mjs';
import { standardTable } from './helpers.mjs';

const table = standardTable();
const STRIP_WIDTH = 780;
const AREA_WIDTH = STRIP_WIDTH - LABEL_WIDTH;

function pack(codons) {
  return table.encode(codons.map((codon) => table.indexOf(codon)));
}

const UPSTREAM = 'ACGTACGTACGTACGTACGTACGTACGTAC';

function gene(overrides = {}) {
  const sense = ['ATG', 'GCT', 'TCG', 'AAA', 'GTG', 'TCA', 'TGG', 'CCC'];
  return {
    id: 'M744_RS00005', name: 'abcA', product: 'test protein', seqid: 'NZ_CP006471.1',
    strand: '+', start: 1001, end: 1027, lengthNt: 27, lengthCodons: 8, terminalStop: 'TAG',
    translationalException: null, cdsSegments: null, rnaContext: { upstream: UPSTREAM },
    codons: pack(sense), ...overrides,
  };
}

/** A 1,000-codon gene, long enough that fitting it drops below a cell per base. */
function longGene() {
  const sense = Array.from({ length: 1000 }, (_, i) => (i === 0 ? 'ATG' : i % 7 === 0 ? 'TCG' : 'GCT'));
  return gene({
    id: 'M744_RS00010', name: null, end: 4003, lengthNt: 3003, lengthCodons: 1000, codons: pack(sense),
  });
}

function mount(document, handlers = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const view = new GeneSequenceView(host, handlers);
  view.update({ gene: null, table, scheme: null, schemeVersion: 0 });
  view.strip.clientWidth = STRIP_WIDTH;
  return view;
}

const codonCells = (view) => view.strip.querySelectorAll('g.gene-sequence-codon');
const svgOf = (view) => view.strip.querySelector('svg');
const keydown = (view, key, extra = {}) => view.strip.dispatch('keydown', { key, preventDefault() {}, ...extra });

test('camera arithmetic: opening, fitting, clamping and the window', () => {
  const domain = { min: -30, max: 27 };
  const opening = openingCamera(domain, AREA_WIDTH);
  assert.equal(opening.perNt, OPEN_PX_PER_NT);
  // 61 nt at the opening zoom is wider than the strip, so it opens at the left edge.
  assert.equal(opening.from, domain.min - EDGE_PAD_NT);
  const extent = domain.max - domain.min + 2 * EDGE_PAD_NT;
  // The scale never drops below the one that fits the gene, so a short gene
  // fills the strip; only one shorter than the strip at the closest zoom is centred.
  const short = { min: -30, max: 6 };
  assert.equal(openingCamera(short, AREA_WIDTH).perNt, AREA_WIDTH / 40);
  const tiny = { min: 0, max: 10 };
  const centred = openingCamera(tiny, AREA_WIDTH);
  assert.equal(centred.perNt, MAX_PX_PER_NT);
  const span = AREA_WIDTH / MAX_PX_PER_NT;
  assert.ok(Math.abs(centred.from - (tiny.min - EDGE_PAD_NT - (span - 14) / 2)) < 1e-9);
  const fitting = fittingCamera(domain, AREA_WIDTH);
  assert.ok(fitting.perNt <= MAX_PX_PER_NT);
  assert.ok(Math.abs(cameraWindow(fitting, AREA_WIDTH).spanNt - extent) < 1e-9);
  const tooClose = clampCamera({ from: 0, perNt: 1000 }, domain, AREA_WIDTH);
  assert.equal(tooClose.perNt, MAX_PX_PER_NT);
  const long = { min: -30, max: 3003 };
  const pastEnd = clampCamera({ from: 5000, perNt: OPEN_PX_PER_NT }, long, AREA_WIDTH);
  assert.ok(Math.abs(pastEnd.from + AREA_WIDTH / OPEN_PX_PER_NT - (long.max + EDGE_PAD_NT)) < 1e-9);
  const beforeStart = clampCamera({ from: -500, perNt: OPEN_PX_PER_NT }, long, AREA_WIDTH);
  assert.equal(beforeStart.from, long.min - EDGE_PAD_NT);
});

test('residue ticks start at one and continue in round steps', () => {
  assert.deepEqual(residueTicks(0, 25, 3), [1, 10, 20]);
  assert.deepEqual(residueTicks(0, 5, 10), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(residueTicks(96, 104, 3), [100, 105]);
});

test('nothing pinned shows the empty note and no strip', async () => {
  await withFakeDocument((document) => {
    const view = mount(document);
    assert.equal(view.empty.hidden, false);
    assert.equal(view.figure.hidden, true);
    assert.equal(view.strip.children.length, 0);
    assert.equal(view.readout.textContent, '');
    // Navigation with nothing pinned is a no-op rather than an error.
    keydown(view, '+');
    view.zoomBy(2);
    view.panBy(10);
    view.goToStart();
    view.goToEnd();
    view.fitGene();
    view.selectCodon(1);
    assert.equal(view.strip.children.length, 0);
  });
});

test('a pinned gene opens readable at its start with every row drawn', async () => {
  await withFakeDocument((document) => {
    const view = mount(document);
    view.update({ gene: gene(), table, scheme: null, schemeVersion: 0 });
    assert.equal(view.figure.hidden, false);
    assert.equal(view.empty.hidden, true);
    assert.equal(view.identity.textContent, 'M744_RS00005 abcA');
    assert.equal(view.facts.textContent, 'plus strand, 27 nt, 8 codons');
    assert.equal(view.product.textContent, 'test protein');
    const svg = svgOf(view);
    assert.equal(svg.getAttribute('role'), 'group');
    assert.match(svg.getAttribute('aria-label'), /M744_RS00005 abcA on the plus strand/);
    assert.match(svg.querySelector('desc').textContent, /Showing nucleotides −30 to \+26/);
    // Every base has a letter at the opening zoom; the short gene fits whole.
    const cells = codonCells(view);
    assert.equal(cells.length, 9);
    assert.equal(view.strip.querySelectorAll('g.gene-sequence-upstream').length, 30);
    const letters = cells[1].querySelectorAll('text').map((node) => node.textContent);
    assert.deepEqual(letters.slice(0, 3), ['G', 'C', 'T']);
    assert.ok(letters.includes('A'), 'the residue letter is drawn');
    assert.ok(cells[0].hasClass('gene-sequence-codon-start'));
    assert.ok(cells[8].hasClass('gene-sequence-codon-stop'));
    assert.equal(cells[8].querySelectorAll('text.gene-sequence-residue-letter')[0].textContent, '*');
    // Residue 1 is numbered, the stop is not.
    const numbers = view.strip.querySelectorAll('text.gene-sequence-residue-number').map((n) => n.textContent);
    assert.equal(numbers[0], '1');
    assert.ok(!cells[8].querySelectorAll('text.gene-sequence-residue-number').length);
    // No scheme: no recoded row and the base row is labelled plainly.
    assert.equal(view.strip.querySelectorAll('rect.gene-sequence-recoded').length, 0);
    const labels = view.strip.querySelector('g.gene-sequence-labels').querySelectorAll('text').map((n) => n.textContent);
    assert.deepEqual(labels, ['Bases', 'Protein']);
    assert.equal(view.readout.textContent, 'Nucleotides −30 to +26 of 27; genomic 971 to 1,027 on the plus strand.');
    // Codon tooltips carry the full readout.
    assert.match(cells[1].querySelector('title').textContent, /Codon 2 of 8: GCT, Alanine \(A\)\. CDS \+3 to \+5; genomic 1,004 to 1,006 on the plus strand\./);
    assert.match(cells[0].querySelector('title').textContent, /initiation triplet ATG, translated as Methionine \(M\); never recoded/);
    assert.match(cells[8].querySelector('title').textContent, /Terminal stop TAG\. CDS \+24 to \+26/);
    assert.match(view.strip.querySelector('g.gene-sequence-upstream').querySelector('title').textContent,
      /Upstream base −30, genomic 971/);
    for (const annotation of [cells[0], cells[8]]) {
      assert.equal(annotation.getAttribute('tabindex'), '0');
      assert.equal(annotation.getAttribute('role'), 'img');
      assert.ok(annotation.getAttribute('aria-label'));
    }
  });
});

test('the upstream selector starts at 30 and expands only to exact loaded extents', async () => {
  await withFakeDocument((document) => {
    const announcements = [];
    const view = mount(document, { onAnnounce: (message) => announcements.push(message) });
    const extendedUpstream = `${'G'.repeat(30)}${UPSTREAM}`;
    view.update({
      gene: gene({ extendedUpstream }), table, scheme: null, schemeVersion: 0,
      organism: {
        ...DEFAULT_ORGANISM,
        sequenceContext: { maxUpstreamNt: 60, optionsNt: [30, 60, 120] },
      },
    });
    assert.equal(view.upstreamNt, 30);
    assert.deepEqual(view.upstreamSelect.children.map((option) => option.value), ['30', '60']);
    assert.equal(view.upstreamSelect.disabled, false);

    view.upstreamSelect.value = '60';
    view.upstreamSelect.dispatch('change');
    assert.equal(view.upstreamNt, 60);
    assert.equal(view.model.domain.min, -60);
    assert.equal(view.model.upstream.length, 60);
    assert.ok(view.strip.querySelectorAll('g.gene-sequence-upstream').length > 30);
    assert.deepEqual(announcements, ['Showing 60 upstream nucleotides.']);
  });
});

test('hover re-renders cost nothing: the same gene and scheme keep the drawn strip', async () => {
  await withFakeDocument((document) => {
    const view = mount(document);
    view.update({ gene: gene(), table, scheme: null, schemeVersion: 0 });
    const before = svgOf(view);
    view.update({ gene: gene(), table, scheme: null, schemeVersion: 0 });
    assert.equal(svgOf(view), before);
  });
});

test('pinning another gene resets the camera and the selection; unpinning empties the strip', async () => {
  await withFakeDocument((document) => {
    const view = mount(document);
    view.update({ gene: longGene(), table, scheme: null, schemeVersion: 0 });
    view.panBy(300);
    view.selectCodon(120);
    assert.equal(view.selectedCodon, 120);
    assert.equal(view.selection.hidden, false);
    const moved = view.camera.from;
    view.update({ gene: gene(), table, scheme: null, schemeVersion: 0 });
    assert.notEqual(view.camera.from, moved);
    assert.equal(view.selectedCodon, null);
    assert.equal(view.selection.hidden, true);
    assert.equal(view.identity.textContent, 'M744_RS00005 abcA');
    view.update({ gene: null, table, scheme: null, schemeVersion: 0 });
    assert.equal(view.figure.hidden, true);
    assert.equal(view.strip.children.length, 0);
    assert.equal(view.model, null);
  });
});

test('zoom keys and buttons change the scale within the limits and announce it', async () => {
  await withFakeDocument((document) => {
    const messages = [];
    const view = mount(document, { onAnnounce: (message) => messages.push(message) });
    view.update({ gene: longGene(), table, scheme: null, schemeVersion: 0 });
    const opening = view.camera.perNt;
    keydown(view, '+');
    assert.ok(view.camera.perNt > opening);
    assert.match(messages.at(-1), /Sequence showing \d+ nucleotides\./);
    keydown(view, '+');
    keydown(view, '+');
    assert.equal(view.camera.perNt, MAX_PX_PER_NT);
    keydown(view, '-');
    assert.ok(view.camera.perNt < MAX_PX_PER_NT);
    view.zoomOutButton.dispatch('click');
    view.zoomInButton.dispatch('click');
    keydown(view, '=');
    keydown(view, '_');
    view.fitButton.dispatch('click');
    const window = view.visibleWindow();
    assert.ok(window.from <= -30 && window.to >= 3003, 'the whole gene fits');
    assert.ok(view.camera.perNt < CELL_PX_PER_NT);
    // Fitted, the strip draws bars, not cells, and marks the start and stop.
    assert.equal(codonCells(view).length, 0);
    assert.ok(view.strip.querySelector('g.gene-sequence-bars'));
    assert.equal(view.strip.querySelectorAll('rect.gene-sequence-cds-bar').length, 1);
    const startMark = view.strip.querySelector('rect.gene-sequence-start-mark');
    const stopMark = view.strip.querySelector('rect.gene-sequence-stop-mark');
    assert.ok(startMark);
    assert.ok(stopMark);
    const [startTarget, stopTarget] = view.strip
      .querySelectorAll('rect.gene-sequence-codon-hit-target');
    assert.equal(Number(startTarget.getAttribute('x')),
      Number(startMark.getAttribute('x')) - CODON_HIT_PADDING_PX);
    assert.equal(Number(startTarget.getAttribute('width')),
      Number(startMark.getAttribute('width')) + CODON_HIT_PADDING_PX);
    assert.equal(Number(stopTarget.getAttribute('x')), Number(stopMark.getAttribute('x')));
    assert.equal(Number(stopTarget.getAttribute('width')),
      Number(stopMark.getAttribute('width')) + CODON_HIT_PADDING_PX);
    for (const [target, mark] of [[startTarget, startMark], [stopTarget, stopMark]]) {
      assert.equal(target.querySelector('title').textContent, mark.getAttribute('aria-label'));
      target.dispatch('pointerenter');
      assert.ok(mark.hasClass('is-hit-hovered'));
      target.dispatch('pointerleave');
      assert.ok(!mark.hasClass('is-hit-hovered'));
    }
    assert.ok(view.strip.querySelector('rect.gene-sequence-upstream-bar'));
    view.startButton.dispatch('click');
    assert.equal(view.camera.perNt, OPEN_PX_PER_NT);
    assert.equal(view.camera.from, -30 - EDGE_PAD_NT);
  });
});

test('arrow keys pan by a fraction of the window, Shift by a whole window, and the ends clamp', async () => {
  await withFakeDocument((document) => {
    const view = mount(document);
    view.update({ gene: longGene(), table, scheme: null, schemeVersion: 0 });
    const start = view.camera.from;
    const span = view.visibleWindow().spanNt;
    keydown(view, 'ArrowRight');
    assert.ok(Math.abs(view.camera.from - (start + span * 0.15)) < 1e-9);
    keydown(view, 'ArrowRight', { shiftKey: true });
    assert.ok(Math.abs(view.camera.from - (start + span * 1.15)) < 1e-9);
    keydown(view, 'ArrowLeft');
    keydown(view, 'ArrowLeft', { shiftKey: true });
    assert.ok(Math.abs(view.camera.from - start) < 1e-9, 'a pan is reversible');
    keydown(view, 'ArrowLeft');
    assert.equal(view.camera.from, start, 'the left edge clamps at the upstream context');
    keydown(view, 'End');
    const end = view.visibleWindow();
    assert.ok(Math.abs(end.to - (3003 + EDGE_PAD_NT)) < 1e-9, 'End shows the stop at the right edge');
    assert.match(view.readout.textContent, /to \+3,002 of 3,003; genomic [\d,]+ to 4,003/);
    keydown(view, 'Home');
    assert.equal(view.camera.from, start);
    keydown(view, '0');
    assert.equal(view.camera.from, start);
    keydown(view, 'ArrowRight');
    view.strip.dispatch('dblclick');
    assert.equal(view.camera.from, start);
    // An unrelated key does nothing.
    keydown(view, 'q');
    assert.equal(view.camera.from, start);
  });
});

test('the wheel zooms about the pointer and pans with Shift or a horizontal delta', async () => {
  await withFakeDocument((document) => {
    const view = mount(document);
    view.update({ gene: longGene(), table, scheme: null, schemeVersion: 0 });
    const before = view.camera;
    let prevented = 0;
    const wheel = (extra) => view.strip.dispatch('wheel', { preventDefault: () => { prevented += 1; }, ...extra });
    // Zoom in about the offset under the pointer, which keeps its screen position.
    const pointerPx = 300;
    const anchor = before.from + (pointerPx - LABEL_WIDTH) / before.perNt;
    wheel({ deltaY: -200, clientX: pointerPx });
    assert.ok(view.camera.perNt > before.perNt);
    const anchorAfter = view.camera.from + (pointerPx - LABEL_WIDTH) / view.camera.perNt;
    assert.ok(Math.abs(anchorAfter - anchor) < 1e-6);
    const zoomed = view.camera;
    wheel({ deltaY: 100, shiftKey: true, clientX: pointerPx });
    assert.equal(view.camera.perNt, zoomed.perNt, 'Shift and wheel pans without zooming');
    assert.ok(view.camera.from > zoomed.from);
    const panned = view.camera.from;
    wheel({ deltaX: -100, deltaY: 10, clientX: pointerPx });
    assert.ok(view.camera.from < panned, 'a mostly horizontal wheel pans');
    assert.equal(prevented, 3);
  });
});

test('a click selects the codon under the pointer; a drag pans and selects nothing', async () => {
  await withFakeDocument((document) => {
    const view = mount(document);
    view.update({ gene: gene(), table, scheme: null, schemeVersion: 0 });
    const { from, perNt } = view.camera;
    const xOf = (offset) => LABEL_WIDTH + (offset - from) * perNt;
    // Codon 2 (index 1) spans offsets 3 to 5; click in the middle of offset 4.
    view.strip.dispatch('pointerdown', { pointerId: 1, clientX: xOf(4.5) });
    view.strip.dispatch('pointerup', { pointerId: 1, clientX: xOf(4.5) });
    assert.equal(view.selectedCodon, 1);
    assert.equal(view.selection.hidden, false);
    assert.match(view.selection.textContent, /^Codon 2 of 8: GCT, Alanine \(A\)\./);
    assert.ok(codonCells(view)[1].hasClass('gene-sequence-selected'));
    // A click on the upstream context clears the selection.
    view.strip.dispatch('pointerdown', { pointerId: 2, clientX: xOf(-10.5) });
    view.strip.dispatch('pointerup', { pointerId: 2, clientX: xOf(-10.5) });
    assert.equal(view.selectedCodon, null);
    assert.equal(view.selection.hidden, true);
    // A drag pans and leaves the selection alone.
    view.update({ gene: longGene(), table, scheme: null, schemeVersion: 0 });
    view.selectCodon(3);
    const start = view.camera.from;
    view.strip.dispatch('pointerdown', { pointerId: 3, clientX: 400 });
    assert.ok(view.strip.hasClass('is-dragging'));
    view.strip.dispatch('pointermove', { pointerId: 3, clientX: 360 });
    assert.ok(Math.abs(view.camera.from - (start + 40 / view.camera.perNt)) < 1e-9);
    view.strip.dispatch('pointerup', { pointerId: 3, clientX: 360 });
    assert.ok(!view.strip.hasClass('is-dragging'));
    assert.equal(view.selectedCodon, 3, 'a drag is not a click');
    // A move from a different pointer, or after a cancel, is ignored.
    view.strip.dispatch('pointerdown', { pointerId: 4, clientX: 400 });
    view.strip.dispatch('pointermove', { pointerId: 9, clientX: 100 });
    view.strip.dispatch('pointercancel', { pointerId: 4 });
    view.strip.dispatch('pointermove', { pointerId: 4, clientX: 100 });
    assert.ok(Math.abs(view.camera.from - (start + 40 / view.camera.perNt)) < 1e-9);
    // A sub-2px wobble still counts as a click.
    const { from: f2, perNt: p2 } = view.camera;
    const x2 = LABEL_WIDTH + (9.5 - f2) * p2;
    view.strip.dispatch('pointerdown', { pointerId: 5, clientX: x2 });
    view.strip.dispatch('pointermove', { pointerId: 5, clientX: x2 + 1 });
    view.strip.dispatch('pointerup', { pointerId: 5, clientX: x2 + 1 });
    assert.equal(view.selectedCodon, 3);
    // A selection survives zooming out into bar mode, as an outline.
    view.fitGene();
    assert.ok(view.strip.querySelector('rect.gene-sequence-selected-mark'));
  });
});

test('pointer clicks on padded start and stop targets select their codons and preserve focus', async () => {
  await withFakeDocument((document) => {
    const view = mount(document);
    view.update({ gene: gene(), table, scheme: null, schemeVersion: 0 });
    view.selectCodon(1);

    let start = codonCells(view)[0];
    let hit = start.querySelector('rect.gene-sequence-codon-hit-target');
    const startBase = start.querySelector('rect.gene-sequence-bases');
    assert.equal(Number(hit.getAttribute('x')),
      Number(startBase.getAttribute('x')) - CODON_HIT_PADDING_PX);
    assert.equal(Number(hit.getAttribute('width')),
      Number(startBase.getAttribute('width')) + CODON_HIT_PADDING_PX);
    assert.equal(hit.querySelector('title').textContent, start.getAttribute('aria-label'));
    hit.dispatch('pointerenter');
    assert.ok(start.hasClass('is-hit-hovered'));
    hit.dispatch('pointerleave');
    assert.ok(!start.hasClass('is-hit-hovered'));
    hit.dispatch('pointerdown', { stopPropagation() {} });
    hit.dispatch('click', { stopPropagation() {} });
    start = codonCells(view)[0];
    assert.equal(view.selectedCodon, 0);
    assert.match(view.selection.textContent, /^Codon 1: initiation triplet ATG/);
    assert.equal(document.activeElement, start);
    assert.equal(document.activeElement.isConnected, true);

    let stop = codonCells(view)[8];
    hit = stop.querySelector('rect.gene-sequence-codon-hit-target');
    const stopBase = stop.querySelector('rect.gene-sequence-bases');
    assert.equal(Number(hit.getAttribute('x')), Number(stopBase.getAttribute('x')));
    assert.equal(Number(hit.getAttribute('width')),
      Number(stopBase.getAttribute('width')) + CODON_HIT_PADDING_PX);
    assert.equal(hit.querySelector('title').textContent, stop.getAttribute('aria-label'));
    hit.dispatch('pointerenter');
    assert.ok(stop.hasClass('is-hit-hovered'));
    hit.dispatch('pointerleave');
    assert.ok(!stop.hasClass('is-hit-hovered'));
    hit.dispatch('pointerdown', { stopPropagation() {} });
    hit.dispatch('click', { stopPropagation() {} });
    stop = codonCells(view)[8];
    assert.equal(view.selectedCodon, 8);
    assert.match(view.selection.textContent, /^Terminal stop TAG\./);
    assert.equal(document.activeElement, stop);
    assert.equal(document.activeElement.isConnected, true);
  });
});

test('an active scheme adds the recoded row, marks each change by shape, and keeps the camera', async () => {
  await withFakeDocument((document) => {
    const view = mount(document);
    const scheme = compileScheme({ TCG: 'AGC', TAG: 'TAA' }, table);
    view.update({ gene: gene(), table, scheme: null, schemeVersion: 0 });
    view.selectCodon(2);
    view.zoomBy(1.2);
    const camera = view.camera;
    view.update({ gene: gene(), table, scheme, schemeVersion: 1 });
    assert.deepEqual(view.camera, camera, 'a scheme change keeps the camera');
    assert.equal(view.selectedCodon, 2, 'and the selection');
    const labels = view.strip.querySelector('g.gene-sequence-labels').querySelectorAll('text').map((n) => n.textContent);
    assert.deepEqual(labels, ['Original', 'Recoded', 'Protein']);
    const cells = codonCells(view);
    assert.equal(view.strip.querySelectorAll('rect.gene-sequence-recoded').length, 9);
    assert.ok(cells[2].hasClass('gene-sequence-changed'));
    assert.ok(cells[2].querySelector('path.gene-sequence-change-mark'));
    assert.ok(!cells[1].hasClass('gene-sequence-changed'));
    assert.ok(!cells[1].querySelector('path.gene-sequence-change-mark'));
    assert.ok(cells[8].hasClass('gene-sequence-changed'), 'the reassigned stop is a change');
    const recodedLetters = cells[2].querySelectorAll('text').map((n) => n.textContent);
    assert.deepEqual(recodedLetters.slice(0, 6), ['T', 'C', 'G', 'A', 'G', 'C']);
    assert.match(view.selection.textContent, /Recoded to AGC by the active scheme\./);
    assert.match(cells[1].querySelector('title').textContent, /Unchanged by the active scheme\./);
    assert.match(cells[0].querySelector('title').textContent, /never recoded/);
    assert.match(svgOf(view).getAttribute('aria-label'), /changes 2 codons, including the terminal stop/);
    // Zoomed out, changes are ticks on the recoded bar.
    view.update({ gene: longGene(), table, scheme, schemeVersion: 1 });
    view.fitGene();
    assert.equal(view.strip.querySelectorAll('rect.gene-sequence-cds-bar').length, 2);
    assert.ok(view.strip.querySelectorAll('rect.gene-sequence-change-tick').length > 0);
    // Clearing the scheme removes the row again.
    view.update({ gene: gene(), table, scheme: compileScheme({}, table), schemeVersion: 2 });
    assert.equal(view.strip.querySelectorAll('rect.gene-sequence-recoded').length, 0);
  });
});

test('letters give way to cells as the strip zooms out', async () => {
  await withFakeDocument((document) => {
    const view = mount(document);
    view.update({ gene: longGene(), table, scheme: null, schemeVersion: 0 });
    view.setCamera({ from: -32, perNt: LETTER_PX_PER_NT - 1 });
    const cells = codonCells(view);
    assert.ok(cells.length > 0);
    const letters = cells[1].querySelectorAll('text');
    assert.equal(letters.filter((n) => !n.hasClass('gene-sequence-residue-letter')
      && !n.hasClass('gene-sequence-residue-number')).length, 0, 'no base letters');
    assert.equal(letters.filter((n) => n.hasClass('gene-sequence-residue-letter')).length, 1);
    view.setCamera({ from: -32, perNt: CELL_PX_PER_NT });
    assert.equal(codonCells(view)[1].querySelectorAll('text.gene-sequence-residue-letter').length, 0);
  });
});

test('junctions are drawn where the strip shows them, the origin named as such', async () => {
  await withFakeDocument((document) => {
    const view = mount(document);
    const sense = Array.from({ length: 97 }, (_, i) => (i === 0 ? 'ATG' : 'GCT'));
    const wrap = gene({
      id: 'M744_RS13620', seqid: 'NZ_CP006473.1', start: 1, end: 7842,
      lengthNt: 294, lengthCodons: 97, cdsSegments: [[7830, 7842], [1, 281]], codons: pack(sense),
    });
    view.update({ gene: wrap, table, scheme: null, schemeVersion: 0 });
    const junctions = view.strip.querySelector('g.gene-sequence-junctions').querySelectorAll('text');
    assert.equal(junctions.length, 1);
    assert.equal(junctions[0].textContent, 'origin');
    assert.match(view.readout.textContent, /genomic 7,800 to /);
    view.goToEnd();
    assert.equal(view.strip.querySelectorAll('g.gene-sequence-junctions').length, 0, 'out of the window');
    // Long enough that fitting it reaches bar mode, where each segment is a bar.
    const spliced = gene({
      start: 1001, end: 4004, lengthNt: 3003, lengthCodons: 1000,
      cdsSegments: [[1001, 1072], [1074, 4004]],
      codons: pack(Array.from({ length: 1000 }, (_, i) => (i === 0 ? 'ATG' : 'GCT'))),
    });
    view.update({ gene: spliced, table, scheme: null, schemeVersion: 0 });
    view.fitGene();
    assert.ok(view.camera.perNt < CELL_PX_PER_NT);
    assert.equal(view.strip.querySelector('g.gene-sequence-junctions').querySelector('text').textContent,
      '1 nt skipped');
    assert.equal(view.strip.querySelectorAll('rect.gene-sequence-cds-bar').length, 2);
  });
});

test('a strip with no measured width falls back rather than drawing nothing', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    const view = new GeneSequenceView(host);
    view.update({ gene: gene(), table, scheme: null, schemeVersion: 0 });
    assert.equal(view.width(), FALLBACK_WIDTH - LABEL_WIDTH);
    assert.equal(svgOf(view).getAttribute('width'), String(FALLBACK_WIDTH));
    view.strip.clientWidth = 0;
    assert.equal(view.width(), FALLBACK_WIDTH - LABEL_WIDTH);
  });
});

test('a gene with no upstream context and unknown coordinates still reads', async () => {
  await withFakeDocument((document) => {
    const view = mount(document);
    view.update({
      gene: gene({ rnaContext: null, cdsSegments: [[1001, 1010], [1020, 1027]] }),
      table, scheme: null, schemeVersion: 0,
    });
    assert.equal(view.strip.querySelectorAll('g.gene-sequence-upstream').length, 0);
    assert.equal(view.readout.textContent, 'Nucleotides start to +26 of 27.');
    view.selectCodon(1);
    assert.equal(view.selection.textContent, 'Codon 2 of 8: GCT, Alanine (A). CDS +3 to +5.');
    view.fitGene();
    assert.equal(view.strip.querySelectorAll('rect.gene-sequence-upstream-bar').length, 0);
  });
});

/**
 * The base row and the protein row sit on different backgrounds, so the
 * stylesheet has to colour their letters separately. It can only do that if
 * every letter says which row it belongs to. Selecting each `text` in a start
 * or stop cell instead painted the first codon's residue letter and its residue
 * number white on the white protein cell, which is how the "M" and the "1"
 * disappeared at 1280 px. These assertions hold the classes the rule needs and
 * read the stylesheet back to confirm the rule is keyed on them.
 */
test('every letter names its row, so the start and stop cells colour only their bases', async () => {
  await withFakeDocument((document) => {
    const view = mount(document);
    const scheme = compileScheme({ TAG: 'TAA' }, table);
    view.update({ gene: gene(), table, scheme, schemeVersion: 1 });
    for (const index of [0, 8]) {
      const cell = codonCells(view)[index];
      const letters = cell.querySelectorAll('text');
      const original = letters.filter((node) => node.hasClass('gene-sequence-letter-original'));
      const recoded = letters.filter((node) => node.hasClass('gene-sequence-letter-recoded'));
      const residue = letters.filter((node) => node.hasClass('gene-sequence-residue-letter'));
      const numbers = letters.filter((node) => node.hasClass('gene-sequence-residue-number'));
      assert.equal(original.length, 3, `codon ${index} original bases`);
      assert.equal(recoded.length, 3, `codon ${index} recoded bases`);
      assert.equal(residue.length, 1, `codon ${index} residue letter`);
      // Every letter carries exactly one of the four classes, so the stylesheet
      // can reach each row without reaching the others.
      assert.equal(original.length + recoded.length + residue.length + numbers.length,
        letters.length, `codon ${index} has no unclassified letter`);
      for (const node of residue) {
        assert.ok(!node.hasClass('gene-sequence-letter-original'));
        assert.ok(!node.hasClass('gene-sequence-letter-recoded'));
      }
    }
    // The residue number is its own class again, on the cell that carries one.
    const first = codonCells(view)[0];
    assert.equal(first.querySelectorAll('text.gene-sequence-residue-number').length, 1);
  });
});

test('the stylesheet colours those letters by class, not by every text in the cell', async () => {
  const css = await readFile(new URL('../../site/css/app.css', import.meta.url), 'utf8');
  assert.ok(!/\.gene-sequence-codon-(start|stop)\s+text\s*[,{]/.test(css),
    'no rule may select every text in a start or stop cell');
  assert.match(css, /\.gene-sequence-codon-start \.gene-sequence-letter-original/);
  assert.match(css, /\.gene-sequence-codon-stop \.gene-sequence-letter-recoded/);
  // A changed codon is amber, so its recoded letters return to dark ink.
  assert.match(css, /\.gene-sequence-changed \.gene-sequence-letter-recoded \{ fill: var\(--ink\); \}/);
});

/**
 * A narrow strip cannot hold the 30 upstream bases and the start together at a
 * readable zoom. Opening at the upstream edge then filled a 375 px strip with
 * context and showed none of the gene, so the window gives up upstream bases
 * rather than the start.
 */
test('a narrow strip opens on the start rather than on upstream context alone', () => {
  const domain = { min: -30, max: 3003 };
  const narrow = 375 - LABEL_WIDTH;
  const opening = openingCamera(domain, narrow);
  const window = cameraWindow(opening, narrow);
  assert.ok(window.from < 0, 'some upstream context is still shown');
  assert.ok(window.to >= MIN_OPENING_CDS_NT, 'the start and the first coding bases are in view');
  assert.equal(opening.perNt, OPEN_PX_PER_NT, 'and the letters stay readable');
  // A strip wide enough for both still opens at the upstream edge.
  const wide = openingCamera(domain, 1440 - LABEL_WIDTH);
  assert.equal(wide.from, domain.min - EDGE_PAD_NT);
  // A gene with no upstream context opens at its own first base either way.
  const bare = openingCamera({ min: 0, max: 3003 }, narrow);
  assert.equal(bare.from, -EDGE_PAD_NT);
});

test('the protein row is labelled only where residues are drawn', async () => {
  await withFakeDocument((document) => {
    const view = mount(document);
    view.update({ gene: longGene(), table, scheme: null, schemeVersion: 0 });
    const labelsOf = () => view.strip.querySelector('g.gene-sequence-labels')
      .querySelectorAll('text').map((node) => node.textContent);
    assert.deepEqual(labelsOf(), ['Bases', 'Protein']);
    view.fitGene();
    assert.ok(view.camera.perNt < CELL_PX_PER_NT);
    // Bar mode has no residues, so naming the row would describe an empty row.
    assert.deepEqual(labelsOf(), ['Bases']);
    view.goToStart();
    assert.deepEqual(labelsOf(), ['Bases', 'Protein']);
  });
});
