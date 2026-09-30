/**
 * The pinned gene's sequence close-up, at the foot of the Chromosome tab.
 *
 * One horizontal strip in transcription orientation, drawn as inline SVG so
 * the letters are real text: selectable, legible to a screen reader through
 * the description, and checkable under the fake DOM. Only the visible window
 * is drawn, so a five-kilobase gene costs the same as a short one.
 *
 * It follows the *pinned* gene alone. Hover and keyboard previews drive the
 * small visualizer and the detail panel, but a sequence being read must not
 * change under the pointer, so this view ignores them.
 *
 * Rows, top to bottom: a ruler in nucleotide offsets from the annotated start;
 * the original bases grouped into codons, with the shipped 30 upstream bases
 * before them; the recoded bases when a scheme is active, changed codons marked
 * by shape as well as colour; and the amino acid each codon encodes, with
 * residue numbers beneath. Position zero reads as methionine whatever the
 * triplet, and is never recoded, per the data contract.
 *
 * The camera lives in memory only. It survives a tab change, returns to the
 * start when another gene is pinned, and is never written to the URL.
 */
import {
  codonAtOffset, describeGeneSequence, geneSequenceModel, signedOffset,
} from '../core/gene-sequence-model.js';
import { tickStep, ticksFor } from '../core/gene-view-model.js';
import { formatCount } from './format.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Pixels per nucleotide the strip opens at: every base a readable letter. */
export const OPEN_PX_PER_NT = 12;
/** The closest zoom; letters stop getting more legible beyond it. */
export const MAX_PX_PER_NT = 24;
/** Base letters are drawn at or above this width per nucleotide. */
export const LETTER_PX_PER_NT = 8;
/** Codon cells are drawn at or above this width per nucleotide; bars below it. */
export const CELL_PX_PER_NT = 2;
/** An amino-acid letter needs this many pixels per codon. */
export const RESIDUE_LETTER_PX = 9;
/** Width used when the strip has none to report, as in a hidden tab. */
export const FALLBACK_WIDTH = 720;
/** Nucleotides of empty margin before the first and after the last base. */
export const EDGE_PAD_NT = 2;
/** Coding bases the opening window keeps beside the start on a narrow strip. */
export const MIN_OPENING_CDS_NT = 12;
/** Left gutter that names each row, in pixels. */
export const LABEL_WIDTH = 60;

const ZOOM_STEP = 1.6;
const PAN_FRACTION = 0.15;
const RULER_HEIGHT = 20;
const ROW_HEIGHT = 22;
const ROW_GAP = 3;
const RESIDUE_RULER_HEIGHT = 14;

function svg(name, attributes = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === null || value === undefined) continue;
    node.setAttribute(key, String(value));
    // An SVG element's `className` is an animated string the browser owns, so
    // the attribute is what sets it there; the test DOM matches on the plain
    // string, so it is written too wherever it is one.
    if (key === 'class' && typeof node.className === 'string') node.className = String(value);
  }
  return node;
}

function text(x, y, content, attributes = {}) {
  const node = svg('text', { x, y, ...attributes });
  node.textContent = content;
  return node;
}

function element(tag, className, textContent) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textContent !== undefined) node.textContent = textContent;
  return node;
}

/** Genomic range text for a pair of positions, in the order given. */
function genomicRange(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return from === to ? formatCount(from) : `${formatCount(from)} to ${formatCount(to)}`;
}

/**
 * The window a camera shows, in nucleotide offsets.
 * @param {{from: number, perNt: number}} camera
 * @param {number} width drawable pixels.
 */
export function cameraWindow(camera, width) {
  const span = width / camera.perNt;
  return { from: camera.from, to: camera.from + span, spanNt: span };
}

/**
 * Keep a camera inside the gene: no closer than `MAX_PX_PER_NT`, no wider
 * than the whole gene with its margins, and never showing empty space beyond
 * either end unless the gene is shorter than the strip, in which case it is
 * centred.
 */
export function clampCamera(camera, domain, width) {
  const min = domain.min - EDGE_PAD_NT;
  const max = domain.max + EDGE_PAD_NT;
  const fit = width / (max - min);
  const perNt = Math.min(MAX_PX_PER_NT, Math.max(fit, camera.perNt));
  const span = width / perNt;
  let from = camera.from;
  if (span >= max - min) from = min - (span - (max - min)) / 2;
  else from = Math.min(max - span, Math.max(min, from));
  return { from, perNt };
}

/**
 * The opening camera: readable letters, the upstream context at the left edge,
 * and the annotated start always in the window.
 *
 * A narrow strip is what makes the last clause load-bearing. At 375 px the
 * window holds about 26 nucleotides, fewer than the 30 upstream bases, so
 * opening at the upstream edge showed a screen of context and none of the gene.
 * When the window cannot hold both, it gives up upstream bases rather than the
 * start, and keeps `MIN_OPENING_CDS_NT` of coding sequence beside it.
 */
export function openingCamera(domain, width) {
  const span = width / OPEN_PX_PER_NT;
  const from = Math.max(domain.min - EDGE_PAD_NT, Math.min(0, MIN_OPENING_CDS_NT - span));
  return clampCamera({ from, perNt: OPEN_PX_PER_NT }, domain, width);
}

/** The camera that fits the whole gene into the strip. */
export function fittingCamera(domain, width) {
  return clampCamera({ from: domain.min - EDGE_PAD_NT, perNt: 0 }, domain, width);
}

/**
 * Residue-number labels for the amino-acid row: 1, then every round step.
 * @returns {number[]} one-based residue numbers.
 */
export function residueTicks(firstCodon, lastCodon, target) {
  const step = Math.max(1, tickStep({ min: firstCodon, max: lastCodon }, target));
  const ticks = [];
  for (let codon = Math.max(0, firstCodon); codon <= lastCodon; codon += 1) {
    const residue = codon + 1;
    if (residue === 1 || residue % step === 0) ticks.push(residue);
  }
  return ticks;
}

export class GeneSequenceView {
  /**
   * @param {HTMLElement} host emptied and rebuilt on first use.
   * @param {{onAnnounce?: (message: string) => void}} handlers
   */
  constructor(host, handlers = {}) {
    this.host = host;
    this.handlers = handlers;
    this.built = false;
    this.model = null;
    this.geneId = null;
    this.schemeVersion = null;
    this.camera = null;
    this.selectedCodon = null;
    this.dragging = null;
  }

  /**
   * @param {{gene: object|null, table: object, scheme: object|null,
   *   schemeVersion: number}} input the pinned gene, or null when nothing is
   *   pinned; the dataset's codon table; the compiled scheme and the version
   *   that changes whenever the scheme does.
   */
  update({ gene, table, scheme, schemeVersion }) {
    if (!this.built) this.build();
    const id = gene?.id ?? null;
    const geneChanged = id !== this.geneId;
    const schemeChanged = schemeVersion !== this.schemeVersion;
    // Hover re-renders the tab; nothing here depends on hover, so they cost nothing.
    if (!geneChanged && !schemeChanged) return;
    this.geneId = id;
    this.schemeVersion = schemeVersion;
    this.model = gene ? geneSequenceModel(gene, table, scheme) : null;
    if (geneChanged) {
      this.camera = null;
      this.selectedCodon = null;
    }
    this.render();
  }

  build() {
    this.host.replaceChildren();
    this.host.classList.add('gene-sequence');

    this.empty = element('p', 'panel-note', 'Pin a gene to read its sequence here.');

    this.figure = element('div', 'gene-sequence-figure');
    this.figure.hidden = true;

    this.heading = element('p', 'gene-view-heading');
    this.identity = element('strong');
    this.facts = element('span', 'gene-sequence-facts');
    this.product = element('span', 'gene-view-product');
    this.heading.append(this.identity, ' ', this.facts, document.createElement('br'), this.product);

    const toolbar = element('div', 'chromosome-toolbar-row');
    this.zoomInButton = this.chip('Zoom in (+)', 'Zoom in on the sequence', () => this.zoomBy(ZOOM_STEP));
    this.zoomOutButton = this.chip('Zoom out (−)', 'Zoom out of the sequence', () => this.zoomBy(1 / ZOOM_STEP));
    this.fitButton = this.chip('Fit gene', 'Fit the whole gene into the strip', () => this.fitGene());
    this.startButton = this.chip('Start (0)', 'Return to the start of the gene', () => this.goToStart());
    toolbar.append(this.zoomInButton, this.zoomOutButton, this.fitButton, this.startButton);

    this.readout = element('p', 'chromosome-window');
    this.readout.setAttribute('role', 'status');

    this.strip = element('div', 'gene-sequence-strip');
    this.strip.tabIndex = 0;
    this.strip.setAttribute('role', 'group');
    this.strip.setAttribute('aria-label', 'Sequence close-up');
    this.strip.setAttribute('aria-describedby', 'gene-sequence-instructions');

    this.selection = element('p', 'gene-sequence-selection');
    this.selection.setAttribute('role', 'status');
    this.selection.hidden = true;

    this.instructions = element('p', 'hint');
    this.instructions.id = 'gene-sequence-instructions';
    this.instructions.textContent = 'Drag the strip to pan it and scroll over it to zoom. With the '
      + 'strip focused: Left and Right pan, Shift and an arrow pans a whole window, plus and minus '
      + 'zoom, 0 or Home returns to the start, and End goes to the stop. Click a codon to read it out.';

    this.figure.append(this.heading, toolbar, this.readout, this.strip, this.selection,
      this.instructions);
    this.host.append(this.empty, this.figure);
    this.bindEvents();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.draw());
      this.resizeObserver.observe(this.strip);
    }
    this.built = true;
  }

  chip(label, ariaLabel, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip-button';
    button.textContent = label;
    button.setAttribute('aria-label', ariaLabel);
    button.addEventListener('click', action);
    return button;
  }

  /** Drawable width of the sequence area, to the right of the row labels. */
  width() {
    const measured = this.strip.clientWidth;
    const total = Number.isFinite(measured) && measured > 0 ? measured : FALLBACK_WIDTH;
    return Math.max(120, total - LABEL_WIDTH);
  }

  render() {
    const model = this.model;
    this.figure.hidden = !model;
    this.empty.hidden = Boolean(model);
    if (!model) {
      this.strip.replaceChildren();
      this.readout.textContent = '';
      this.writeSelection();
      return;
    }
    this.identity.textContent = model.name ? `${model.id} ${model.name}` : model.id;
    this.facts.textContent = `${model.strand === '-' ? 'minus' : 'plus'} strand, `
      + `${formatCount(model.lengthNt)} nt, ${formatCount(model.lengthCodons)} codons`;
    this.product.textContent = model.product ?? '';
    this.product.hidden = !model.product;
    if (!this.camera) this.camera = openingCamera(model.domain, this.width());
    // A scheme change rewrites what the selected codon says about itself.
    this.writeSelection();
    this.draw();
  }

  /** The readout for the selected codon, hidden when none is selected. */
  writeSelection() {
    const codon = this.selectedCodon === null ? null : this.model?.codons[this.selectedCodon] ?? null;
    this.selectedCodon = codon ? codon.index : null;
    this.selection.hidden = !codon;
    this.selection.textContent = codon ? this.describeCodon(codon) : '';
  }

  /** The window currently shown, in nucleotide offsets, or null when empty. */
  visibleWindow() {
    if (!this.model || !this.camera) return null;
    return cameraWindow(this.camera, this.width());
  }

  setCamera(camera) {
    if (!this.model) return;
    this.camera = clampCamera(camera, this.model.domain, this.width());
    this.draw();
  }

  /** Zoom about an offset, or about the centre of the window when none is given. */
  zoomBy(factor, anchorOffset = null) {
    if (!this.model || !this.camera) return;
    const window = this.visibleWindow();
    const anchor = anchorOffset ?? (window.from + window.to) / 2;
    const perNt = this.camera.perNt * factor;
    const fraction = (anchor - window.from) / window.spanNt;
    const span = this.width() / perNt;
    this.setCamera({ from: anchor - fraction * span, perNt });
    const shown = this.visibleWindow();
    this.handlers.onAnnounce?.(`Sequence showing ${formatCount(Math.round(shown.spanNt))} nucleotides.`);
  }

  panBy(deltaNt) {
    if (!this.model || !this.camera) return;
    this.setCamera({ from: this.camera.from + deltaNt, perNt: this.camera.perNt });
  }

  goToStart() {
    if (!this.model) return;
    this.setCamera(openingCamera(this.model.domain, this.width()));
  }

  /** The terminal stop at the right edge, at the opening zoom. */
  goToEnd() {
    if (!this.model) return;
    const perNt = Math.max(this.camera?.perNt ?? OPEN_PX_PER_NT, OPEN_PX_PER_NT);
    const span = this.width() / perNt;
    this.setCamera({ from: this.model.domain.max + EDGE_PAD_NT - span, perNt });
  }

  fitGene() {
    if (!this.model) return;
    this.setCamera(fittingCamera(this.model.domain, this.width()));
  }

  /** Select a codon by index, or clear with null; writes the readout. */
  selectCodon(index) {
    if (!this.model) return;
    this.selectedCodon = Number.isInteger(index) ? index : null;
    this.writeSelection();
    this.draw();
  }

  describeCodon(codon) {
    const model = this.model;
    const parts = [];
    if (codon.kind === 'stop') {
      parts.push(`Terminal stop ${codon.codon}.`);
    } else if (codon.kind === 'start') {
      parts.push(`Codon 1: initiation triplet ${codon.codon}, translated as Methionine (M)`
        + `${model.nonStandardStart ? ' although it is not ATG' : ''}; never recoded.`);
    } else {
      parts.push(`Codon ${formatCount(codon.index + 1)} of ${formatCount(model.lengthCodons)}: `
        + `${codon.codon}, ${codon.aaName} (${codon.aa}).`);
    }
    parts.push(`CDS ${signedOffset(codon.offset)} to ${signedOffset(codon.offset + 2)}`
      + `${codon.positions ? `; genomic ${genomicRange(codon.positions[0], codon.positions[2])} on the `
        + `${model.strand === '-' ? 'minus' : 'plus'} strand` : ''}.`);
    if (model.scheme.active && codon.kind !== 'start') {
      parts.push(codon.changed
        ? `Recoded to ${codon.recoded} by the active scheme.`
        : 'Unchanged by the active scheme.');
    }
    return parts.join(' ');
  }

  /** Genomic position of a base at an offset, or null outside the shipped sequence. */
  positionAt(offset) {
    const model = this.model;
    if (offset < 0) {
      const entry = model.upstream.find((base) => base.offset === offset);
      return entry ? entry.position : null;
    }
    const codon = codonAtOffset(model, offset);
    return codon?.positions ? codon.positions[offset - codon.offset] : null;
  }

  draw() {
    const model = this.model;
    if (!model || !this.camera) return;
    const width = this.width();
    this.camera = clampCamera(this.camera, model.domain, width);
    const { from, perNt } = this.camera;
    const window = cameraWindow(this.camera, width);
    const x = (offset) => LABEL_WIDTH + (offset - from) * perNt;
    const rows = this.rowLayout();
    const total = LABEL_WIDTH + width;

    const root = svg('svg', {
      class: 'gene-sequence-svg',
      viewBox: `0 0 ${total} ${rows.height}`,
      width: total,
      height: rows.height,
      role: 'img',
      preserveAspectRatio: 'xMinYMin meet',
    });
    const description = describeGeneSequence(model, this.shownRange(window));
    const desc = svg('desc');
    desc.textContent = description;
    root.append(desc);
    root.setAttribute('aria-label', description);

    const clipId = 'gene-sequence-clip';
    const defs = svg('defs');
    const clip = svg('clipPath', { id: clipId });
    clip.append(svg('rect', { x: LABEL_WIDTH, y: 0, width, height: rows.height }));
    defs.append(clip);
    root.append(defs);

    const cells = perNt >= CELL_PX_PER_NT;
    this.drawLabels(root, rows, cells);
    const area = svg('g', { 'clip-path': `url(#${clipId})` });
    const firstVisible = Math.floor(window.from);
    const lastVisible = Math.ceil(window.to);
    this.drawRuler(area, rows, x, firstVisible, lastVisible, width);
    if (cells) this.drawCells(area, rows, x, perNt, firstVisible, lastVisible, width);
    else this.drawBars(area, rows, x, perNt, firstVisible, lastVisible);
    this.drawJunctions(area, rows, x, firstVisible, lastVisible);
    root.append(area);
    this.strip.replaceChildren(root);
    this.writeReadout(window);
  }

  rowLayout() {
    const active = this.model.scheme.active;
    const bases = RULER_HEIGHT;
    const recoded = active ? bases + ROW_HEIGHT + ROW_GAP : null;
    const residues = (active ? recoded : bases) + ROW_HEIGHT + ROW_GAP;
    const residueRuler = residues + ROW_HEIGHT;
    return { bases, recoded, residues, residueRuler, height: residueRuler + RESIDUE_RULER_HEIGHT };
  }

  /**
   * The gutter names each row that is drawn.
   *
   * Zoomed out past a cell per base there are no residues to show, so the
   * protein row is not labelled either: a labelled empty row reads as a protein
   * this gene does not have, rather than as a scale this zoom cannot render.
   */
  drawLabels(root, rows, cells) {
    const labels = svg('g', { class: 'gene-sequence-labels' });
    const label = (y, content) => labels.append(text(LABEL_WIDTH - 6, y + ROW_HEIGHT / 2 + 4, content, {
      'text-anchor': 'end',
    }));
    label(rows.bases, this.model.scheme.active ? 'Original' : 'Bases');
    if (rows.recoded !== null) label(rows.recoded, 'Recoded');
    if (cells) label(rows.residues, 'Protein');
    root.append(labels);
  }

  drawRuler(area, rows, x, firstVisible, lastVisible, width) {
    const ruler = svg('g', { class: 'gene-sequence-ruler' });
    const y = RULER_HEIGHT - 4;
    ruler.append(svg('line', { x1: LABEL_WIDTH, x2: LABEL_WIDTH + width, y1: y, y2: y }));
    const domain = { min: firstVisible, max: lastVisible };
    for (const tick of ticksFor(domain, Math.max(2, Math.floor(width / 90)))) {
      const tx = x(tick);
      ruler.append(svg('line', { x1: tx, x2: tx, y1: y - 4, y2: y }));
      ruler.append(text(tx, y - 7, signedOffset(tick), { 'text-anchor': 'middle' }));
    }
    area.append(ruler);
  }

  /** Every base a cell; letters when they fit. */
  drawCells(area, rows, x, perNt, firstVisible, lastVisible, width) {
    const model = this.model;
    const letters = perNt >= LETTER_PX_PER_NT;
    const fontSize = perNt >= 11 ? 12 : 10;
    const group = svg('g', { class: 'gene-sequence-cells' });

    for (const base of model.upstream) {
      if (base.offset + 1 < firstVisible || base.offset > lastVisible) continue;
      const cell = svg('g', { class: 'gene-sequence-upstream' });
      cell.append(svg('rect', { x: x(base.offset), y: rows.bases, width: perNt, height: ROW_HEIGHT }));
      if (letters) {
        cell.append(text(x(base.offset) + perNt / 2, rows.bases + ROW_HEIGHT / 2 + 4, base.base, {
          'text-anchor': 'middle', 'font-size': fontSize,
        }));
      }
      const title = svg('title');
      title.textContent = `Upstream base ${signedOffset(base.offset)}`
        + `${base.position ? `, genomic ${formatCount(base.position)}` : ''}`;
      cell.append(title);
      group.append(cell);
    }

    const firstCodon = Math.max(0, Math.floor(firstVisible / 3));
    const lastCodon = Math.min(model.codons.length - 1, Math.floor(lastVisible / 3));
    const residueLetters = perNt * 3 >= RESIDUE_LETTER_PX;
    const ticks = new Set(residueTicks(firstCodon, lastCodon, Math.max(2, Math.floor(width / 70))));
    for (let index = firstCodon; index <= lastCodon; index += 1) {
      const codon = model.codons[index];
      const left = x(codon.offset);
      const cellWidth = perNt * 3;
      const classes = ['gene-sequence-codon', `gene-sequence-codon-${codon.kind}`];
      if (index % 2 === 1) classes.push('gene-sequence-codon-alt');
      if (codon.changed) classes.push('gene-sequence-changed');
      if (index === this.selectedCodon) classes.push('gene-sequence-selected');
      const cell = svg('g', { class: classes.join(' '), 'data-codon-index': index });

      cell.append(svg('rect', {
        class: 'gene-sequence-bases', x: left, y: rows.bases, width: cellWidth, height: ROW_HEIGHT,
      }));
      if (letters) {
        for (let k = 0; k < 3; k += 1) {
          cell.append(text(left + perNt * (k + 0.5), rows.bases + ROW_HEIGHT / 2 + 4, codon.codon[k], {
            'text-anchor': 'middle', 'font-size': fontSize, class: 'gene-sequence-letter-original',
          }));
        }
      }
      if (rows.recoded !== null) {
        cell.append(svg('rect', {
          class: 'gene-sequence-recoded', x: left, y: rows.recoded, width: cellWidth, height: ROW_HEIGHT,
        }));
        if (letters) {
          for (let k = 0; k < 3; k += 1) {
            cell.append(text(left + perNt * (k + 0.5), rows.recoded + ROW_HEIGHT / 2 + 4, codon.recoded[k], {
              'text-anchor': 'middle', 'font-size': fontSize, class: 'gene-sequence-letter-recoded',
            }));
          }
        }
        if (codon.changed) {
          // A change is marked by a shape under the row, not by colour alone.
          const mid = left + cellWidth / 2;
          const base = rows.recoded + ROW_HEIGHT;
          cell.append(svg('path', {
            class: 'gene-sequence-change-mark',
            d: `M ${mid - 4} ${base + 3} L ${mid} ${base - 1} L ${mid + 4} ${base + 3} Z`,
          }));
        }
      }
      cell.append(svg('rect', {
        class: 'gene-sequence-residue', x: left, y: rows.residues, width: cellWidth, height: ROW_HEIGHT,
      }));
      if (residueLetters) {
        cell.append(text(left + cellWidth / 2, rows.residues + ROW_HEIGHT / 2 + 4, codon.aa, {
          'text-anchor': 'middle', 'font-size': 12, class: 'gene-sequence-residue-letter',
        }));
      }
      if (ticks.has(index + 1) && codon.kind !== 'stop') {
        cell.append(text(left + 1, rows.residueRuler + 10, formatCount(index + 1), {
          class: 'gene-sequence-residue-number', 'font-size': 9,
        }));
      }
      const title = svg('title');
      title.textContent = this.describeCodon(codon);
      cell.append(title);
      group.append(cell);
    }
    area.append(group);
  }

  /** Zoomed out past a cell per base: bars per segment, marks for the exceptions. */
  drawBars(area, rows, x, perNt, firstVisible, lastVisible) {
    const model = this.model;
    const group = svg('g', { class: 'gene-sequence-bars' });
    if (model.upstream.length > 0) {
      const first = model.upstream[0].offset;
      group.append(svg('rect', {
        class: 'gene-sequence-upstream-bar',
        x: x(first), y: rows.bases, width: Math.max(1, perNt * model.upstream.length), height: ROW_HEIGHT,
      }));
    }
    const boundaries = [0, ...model.junctions.map((junction) => junction.atOffset), model.cdsLengthNt];
    for (let i = 0; i + 1 < boundaries.length; i += 1) {
      const left = x(boundaries[i]);
      const right = x(boundaries[i + 1]);
      group.append(svg('rect', {
        class: 'gene-sequence-cds-bar', x: left, y: rows.bases, width: Math.max(1, right - left), height: ROW_HEIGHT,
      }));
      if (rows.recoded !== null) {
        group.append(svg('rect', {
          class: 'gene-sequence-cds-bar', x: left, y: rows.recoded, width: Math.max(1, right - left), height: ROW_HEIGHT,
        }));
      }
    }
    const mark = (codon, y, className) => {
      const width = Math.max(4, perNt * 3);
      const left = codon.kind === 'stop' ? x(codon.offset + 3) - width : x(codon.offset);
      group.append(svg('rect', { class: className, x: left, y, width, height: ROW_HEIGHT }));
    };
    const start = model.codons[0];
    const stop = model.codons[model.codons.length - 1];
    mark(start, rows.bases, 'gene-sequence-start-mark');
    if (stop.kind === 'stop') mark(stop, rows.bases, 'gene-sequence-stop-mark');
    if (rows.recoded !== null) {
      mark(start, rows.recoded, 'gene-sequence-start-mark');
      if (stop.kind === 'stop') mark(stop, rows.recoded, 'gene-sequence-stop-mark');
      for (const codon of model.codons) {
        if (!codon.changed || codon.offset + 3 < firstVisible || codon.offset > lastVisible) continue;
        group.append(svg('rect', {
          class: 'gene-sequence-change-tick',
          x: x(codon.offset), y: rows.recoded, width: Math.max(1, perNt * 3), height: ROW_HEIGHT,
        }));
      }
    }
    if (this.selectedCodon !== null) {
      const codon = model.codons[this.selectedCodon];
      group.append(svg('rect', {
        class: 'gene-sequence-selected-mark',
        x: x(codon.offset), y: rows.bases - 2, width: Math.max(2, perNt * 3),
        height: rows.height - rows.bases - RESIDUE_RULER_HEIGHT + 2,
      }));
    }
    area.append(group);
  }

  drawJunctions(area, rows, x, firstVisible, lastVisible) {
    const group = svg('g', { class: 'gene-sequence-junctions' });
    for (const junction of this.model.junctions) {
      if (junction.atOffset < firstVisible || junction.atOffset > lastVisible) continue;
      const jx = x(junction.atOffset);
      group.append(svg('line', { x1: jx, x2: jx, y1: RULER_HEIGHT - 2, y2: rows.residueRuler }));
      const label = junction.gapNt === 0
        ? 'origin'
        : junction.bases ? `${formatCount(junction.gapNt)} nt skipped: ${junction.bases}`
          : `${formatCount(junction.gapNt)} nt skipped`;
      group.append(text(jx + 3, rows.residueRuler + 10, label, { 'font-size': 9 }));
    }
    if (group.children.length > 0) area.append(group);
  }

  /** The whole bases the window shows, clipped to the shipped sequence. */
  shownRange(window) {
    const { domain } = this.model;
    return {
      from: Math.max(domain.min, Math.ceil(window.from)),
      to: Math.min(domain.max - 1, Math.floor(window.to)),
    };
  }

  writeReadout(window) {
    const model = this.model;
    const { from, to } = this.shownRange(window);
    const parts = [`Nucleotides ${signedOffset(from)} to ${signedOffset(to)} of `
      + `${formatCount(model.cdsLengthNt)}`];
    const range = genomicRange(this.positionAt(from), this.positionAt(to));
    if (range) parts.push(`genomic ${range} on the ${model.strand === '-' ? 'minus' : 'plus'} strand`);
    this.readout.textContent = `${parts.join('; ')}.`;
  }

  /** Pointer x as an offset into the strip, measured against the strip itself. */
  pointerOffset(event) {
    const rect = this.strip.getBoundingClientRect?.();
    const px = (event.clientX ?? 0) - (rect?.left ?? 0) - LABEL_WIDTH;
    return this.camera.from + px / this.camera.perNt;
  }

  bindEvents() {
    const strip = this.strip;
    strip.addEventListener('pointerdown', (event) => {
      if (!this.model) return;
      this.dragging = {
        pointerId: event.pointerId, x: event.clientX ?? 0, from: this.camera.from, moved: false,
      };
      strip.setPointerCapture?.(event.pointerId);
      strip.classList.add('is-dragging');
    });
    strip.addEventListener('pointermove', (event) => {
      if (!this.dragging || this.dragging.pointerId !== event.pointerId) return;
      const delta = (this.dragging.x - (event.clientX ?? 0)) / this.camera.perNt;
      if (Math.abs(delta * this.camera.perNt) >= 2) this.dragging.moved = true;
      if (this.dragging.moved) this.setCamera({ from: this.dragging.from + delta, perNt: this.camera.perNt });
    });
    const endDrag = (event) => {
      if (!this.dragging || this.dragging.pointerId !== event.pointerId) return;
      const { moved } = this.dragging;
      this.dragging = null;
      strip.releasePointerCapture?.(event.pointerId);
      strip.classList.remove('is-dragging');
      if (moved || !this.model) return;
      const codon = codonAtOffset(this.model, Math.floor(this.pointerOffset(event)));
      this.selectCodon(codon ? codon.index : null);
    };
    strip.addEventListener('pointerup', endDrag);
    strip.addEventListener('pointercancel', (event) => {
      if (this.dragging?.pointerId === event.pointerId) this.dragging = null;
      strip.classList.remove('is-dragging');
    });
    strip.addEventListener('wheel', (event) => {
      if (!this.model) return;
      event.preventDefault();
      const deltaX = event.deltaX ?? 0;
      const deltaY = event.deltaY ?? 0;
      if (event.shiftKey || Math.abs(deltaX) > Math.abs(deltaY)) {
        this.panBy((deltaX || deltaY) / this.camera.perNt);
        return;
      }
      this.zoomBy(Math.exp(-deltaY * 0.0016), this.pointerOffset(event));
    }, { passive: false });
    strip.addEventListener('dblclick', () => this.goToStart());
    strip.addEventListener('keydown', (event) => this.onKeyDown(event));
  }

  onKeyDown(event) {
    if (!this.model) return;
    const window = this.visibleWindow();
    const step = event.shiftKey ? window.spanNt : window.spanNt * PAN_FRACTION;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.panBy(event.key === 'ArrowLeft' ? -step : step);
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomBy(ZOOM_STEP);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.zoomBy(1 / ZOOM_STEP);
    } else if (event.key === '0' || event.key === 'Home') {
      event.preventDefault();
      this.goToStart();
    } else if (event.key === 'End') {
      event.preventDefault();
      this.goToEnd();
    }
  }
}
