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
 * An admitted marker layer is drawn above the ruler, each mark on the base its
 * own published genome coordinate names — never on the base a distance
 * published against another gene model would imply, because at one letter per
 * column that distance would point at the wrong letter. A row this strip has
 * no base for keeps an explicit unplaceable state in the list beneath, and the
 * marks have their own show/hide.
 *
 * The camera lives in memory only. It survives a tab change, returns to the
 * start when another gene is pinned, and is never written to the URL. The
 * marker layer's visibility is the opposite: it is the reader's choice about
 * what the picture contains, so it is state the caller holds and a link
 * carries.
 */
import {
  availableUpstreamNt, codonAtOffset, describeGeneSequence, describeSequenceMarkers, geneSequenceModel,
  placementRangesText, sequenceMarkers, signedOffset,
} from '../core/gene-sequence-model.js';
import {
  overlapGroups, paddedHitRange, tickStep, ticksFor,
} from '../core/gene-view-model.js';
import {
  markerLayersOf, markerPaintOrder, markerPresentation, markerSpanNt,
} from '../core/marker-layers.js';
import { DEFAULT_ORGANISM } from '../core/organisms.js';
import { pendingNote } from './loading-note.js';
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
/**
 * Height of the marker row above the ruler, in pixels.
 *
 * Reserved whenever this locus has a mark this strip can place, whether or not
 * the reader is showing it, so hiding the marks moves no other row and the
 * letters stay where the reader left them. The chromosome view's tick row
 * holds the same rule.
 */
export const MARKER_ROW_HEIGHT = 16;
/**
 * Drawn width of one marker head, in pixels.
 *
 * Also what decides whether two heads share drawn space: unlike the small gene
 * visualizer this strip has no viewBox scaling, so the head is this wide at
 * every zoom and two heads closer than this overlap at that zoom and no other.
 */
export const MARKER_HEAD_PX = 9;
/** Invisible padding around a marker tag, in pixels. */
export const MARKER_HIT_PADDING_PX = 5;
/** Padding outside start/stop codons; the gene-facing edge stays exact. */
export const CODON_HIT_PADDING_PX = 5;
/**
 * The `data-sequence-action` value the marker checkbox carries, so a rebuild
 * can find the control a reader was holding.
 */
export const MARKER_CONTROL = 'gene-sequence-start-sites';

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

/** Whether a node is in the document and no ancestor has it hidden. */
function visibleAndConnected(node) {
  if (!node?.isConnected) return false;
  for (let at = node; at && at.nodeType === 1; at = at.parentNode) {
    if (at.hidden) return false;
  }
  return true;
}

/**
 * The nearest visible ancestor that is already labelled and already takes
 * focus, for the case where this whole view is hidden.
 *
 * Nothing is made focusable and nothing is labelled here: a view does not
 * change another view's nodes to find somewhere to put focus. Null when there
 * is no such ancestor, which leaves focus where it is.
 */
function labelledFocusableAncestor(node) {
  for (let at = node?.parentNode; at && at.nodeType === 1; at = at.parentNode) {
    const labelled = at.getAttribute('aria-label') || at.getAttribute('aria-labelledby');
    const focusable = typeof at.tabIndex === 'number' && at.tabIndex >= 0;
    if (labelled && focusable && visibleAndConnected(at)) return at;
  }
  return null;
}

function element(tag, className, textContent) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textContent !== undefined) node.textContent = textContent;
  return node;
}

/** Make a drawn SVG annotation inspectable by pointer, touch, and keyboard. */
function interactiveAnnotation(node, label, activate = null) {
  node.setAttribute('tabindex', '0');
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', label);
  node.addEventListener('pointerdown', (event) => {
    event.stopPropagation?.();
    node.focus?.({ preventScroll: true });
  });
  node.addEventListener('click', (event) => {
    // Do not let the strip's coordinate-click handler rebuild this annotation
    // before touch/pointer focus can expose its own metadata.
    event.stopPropagation?.();
    if (activate) activate();
    else node.focus?.({ preventScroll: true });
  });
  return node;
}

/** A pointer-only rectangle that invokes the same annotation as its visible mark. */
function annotationHitTarget(annotation, attributes, activate = null) {
  const target = svg('rect', {
    ...attributes,
    fill: 'transparent',
    stroke: 'none',
    'pointer-events': 'all',
    'aria-hidden': 'true',
  });
  target.addEventListener('pointerdown', (event) => {
    event.stopPropagation?.();
    annotation.focus?.({ preventScroll: true });
  });
  target.addEventListener('click', (event) => {
    event.stopPropagation?.();
    if (activate) activate();
    else annotation.focus?.({ preventScroll: true });
  });
  const title = svg('title');
  title.textContent = annotation.getAttribute('aria-label');
  target.append(title);
  target.addEventListener('pointerenter', () => annotation.classList.add('is-hit-hovered'));
  target.addEventListener('pointerleave', () => annotation.classList.remove('is-hit-hovered'));
  return target;
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
   * @param {{onAnnounce?: (message: string) => void,
   *   onMarkersVisibleChange?: (visible: boolean) => void}} handlers
   *   `onMarkersVisibleChange` is how the reader's show/hide reaches whoever
   *   holds that state; this view redraws itself and does not wait to be
   *   re-rendered.
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
    /** The organism's marker layer, or null when it publishes none. */
    this.markerLayer = null;
    /** `'loading'` or `'failed'` while that layer's file has not landed. */
    this.markerPending = null;
    /** Whether this view draws the layer's marks. Default visible. */
    this.markersVisible = true;
    /** Every published row of the layer for this gene, placed or not. */
    this.markerRows = [];
    /** Cached reachability; camera-only redraws must not rebuild models. */
    this.markerReachabilityCache = undefined;
    this.gene = null;
    this.table = null;
    this.scheme = null;
    this.organism = DEFAULT_ORGANISM;
    this.upstreamNt = 30;
    this.availableUpstream = 0;
    this.sequenceContextPending = null;
  }

  /**
   * @param {{gene: object|null, table: object, scheme: object|null,
   *   schemeVersion: number, organism?: object,
   *   markerPending?: 'loading'|'failed'|null,
   *   sequenceContextPending?: 'loading'|'failed'|null, markersVisible?: boolean}} input
   *   the pinned gene, or null when nothing is pinned; the dataset's codon
   *   table; the compiled scheme and the version that changes whenever the
   *   scheme does; the organism on screen, whose record says which marker
   *   layer there is; that layer's load state; and whether this view draws its
   *   marks, which is the caller's state and not this view's.
   */
  update({
    gene, table, scheme, schemeVersion, organism = DEFAULT_ORGANISM,
    markerPending = null, sequenceContextPending = null, markersVisible = true,
  }) {
    if (!this.built) this.build();
    const id = gene?.id ?? null;
    const geneChanged = id !== this.geneId;
    const schemeChanged = schemeVersion !== this.schemeVersion;
    const nextAvailableUpstream = availableUpstreamNt(gene);
    const contextChanged = nextAvailableUpstream !== this.availableUpstream
      || sequenceContextPending !== this.sequenceContextPending;
    const [layer = null] = markerLayersOf(organism);
    const markerChanged = layer?.id !== this.markerLayer?.id
      || markerPending !== this.markerPending
      || markersVisible !== this.markersVisible;
    // Hover re-renders the tab; nothing here depends on hover, so they cost nothing.
    if (!geneChanged && !schemeChanged && !markerChanged && !contextChanged) return;
    this.gene = gene;
    this.table = table;
    this.scheme = scheme;
    this.organism = organism;
    this.geneId = id;
    this.schemeVersion = schemeVersion;
    this.markerLayer = layer;
    this.markerPending = markerPending;
    this.markersVisible = markersVisible;
    this.availableUpstream = nextAvailableUpstream;
    this.sequenceContextPending = sequenceContextPending;
    if (geneChanged || this.upstreamNt > nextAvailableUpstream) this.upstreamNt = 30;
    this.model = gene ? geneSequenceModel(gene, table, scheme, { upstreamNt: this.upstreamNt }) : null;
    // Every row the layer publishes for this gene, with where this strip can
    // place it. Held rather than recomputed per frame: it depends on the gene
    // and the layer, not on the camera.
    this.markerRows = this.markerLayer && !markerPending && this.model
      ? sequenceMarkers(gene, this.model) : [];
    this.markerReachabilityCache = undefined;
    if (geneChanged) {
      this.camera = null;
      this.selectedCodon = null;
    }
    this.render();
  }

  /** Extents the organism contract and the loaded sidecar both make available. */
  upstreamOptions() {
    const declared = this.organism?.sequenceContext?.optionsNt ?? [30];
    return [...new Set([30, ...declared])]
      .filter((value) => Number.isInteger(value) && value <= this.availableUpstream)
      .sort((a, b) => a - b);
  }

  setUpstreamNt(value) {
    const next = Number(value);
    if (!this.gene || next === this.upstreamNt || !this.upstreamOptions().includes(next)) return;
    this.upstreamNt = next;
    this.model = geneSequenceModel(this.gene, this.table, this.scheme, { upstreamNt: next });
    this.markerRows = this.markerLayer && !this.markerPending && this.model
      ? sequenceMarkers(this.gene, this.model) : [];
    this.markerReachabilityCache = undefined;
    this.camera = null;
    this.render();
    this.handlers.onAnnounce?.(`Showing ${formatCount(next)} upstream nucleotides.`);
  }

  /** Smallest declared sequence extent that can place at least one published row. */
  markerRevealExtent() {
    if (!this.gene || !this.markerLayer || this.markerPending || this.markerRows.length === 0) {
      return null;
    }
    if (this.markerRowShown()) return this.upstreamNt;
    return this.markerExpansionExtent();
  }

  /** Next declared exact extent that can place more of this locus's rows. */
  markerExpansionExtent() {
    if (!this.gene || !this.markerLayer || this.markerPending) return null;
    return this.markerReachability().nextExtent;
  }

  /** Rows a larger exact sequence can reveal, kept apart from permanently unplaceable rows. */
  markerReachability() {
    if (!this.gene || !this.markerLayer || this.markerPending) {
      return { nextExtent: null, expandable: 0, unplaceable: 0 };
    }
    if (this.markerReachabilityCache !== undefined) return this.markerReachabilityCache;
    const currentCount = this.placedMarkers().length;
    let nextExtent = null;
    let maximumCount = currentCount;
    for (const upstreamNt of this.upstreamOptions()) {
      if (upstreamNt <= this.upstreamNt) continue;
      const model = geneSequenceModel(this.gene, this.table, this.scheme, { upstreamNt });
      const placed = sequenceMarkers(this.gene, model)
        .filter((row) => row.placement.status === 'placed').length;
      if (nextExtent === null && placed > currentCount) nextExtent = upstreamNt;
      maximumCount = Math.max(maximumCount, placed);
    }
    this.markerReachabilityCache = {
      nextExtent,
      expandable: maximumCount - currentCount,
      unplaceable: this.markerRows.length - maximumCount,
    };
    return this.markerReachabilityCache;
  }

  /** Whether a placed row overlaps the camera's current nucleotide window. */
  markerInWindow(row, window = this.visibleWindow()) {
    return Boolean(window) && row.placement.toOffset + 1 >= window.from
      && row.placement.fromOffset <= window.to;
  }

  /** Nearest placed row to the annotated start, optionally outside the camera. */
  nearestPlacedMarker(outsideWindow = false) {
    const window = this.visibleWindow();
    const candidates = this.placedMarkers()
      .filter((row) => !outsideWindow || !this.markerInWindow(row, window));
    const middle = (row) => (row.placement.fromOffset + row.placement.toOffset) / 2;
    return candidates.sort((a, b) => Math.abs(middle(a)) - Math.abs(middle(b)))[0] ?? null;
  }

  /** Expand if necessary, then centre the nearest published site in the camera. */
  revealNearestMarker() {
    if (!this.markersVisible) return;
    const placed = this.placedMarkers();
    const visible = placed.filter((row) => this.markerInWindow(row));
    const expansion = this.markerExpansionExtent();
    const useExpansion = placed.length === 0 || (expansion !== null && visible.length > 0);
    const offscreen = this.nearestPlacedMarker(true);
    const extent = useExpansion ? expansion : offscreen ? this.upstreamNt : null;
    if (extent === null && !offscreen) return;
    const expanded = extent !== this.upstreamNt;
    const alreadyPlaced = new Set(this.placedMarkers().map((row) => row.id));
    if (expanded) {
      this.upstreamNt = extent;
      this.model = geneSequenceModel(this.gene, this.table, this.scheme, { upstreamNt: extent });
      this.markerRows = sequenceMarkers(this.gene, this.model);
      this.markerReachabilityCache = undefined;
      this.camera = openingCamera(this.model.domain, this.width());
      this.render();
    }
    const newlyPlaced = expanded
      ? this.placedMarkers().filter((row) => !alreadyPlaced.has(row.id)) : [];
    const middleOf = (row) => (row.placement.fromOffset + row.placement.toOffset) / 2;
    const target = expanded
      ? newlyPlaced.sort((a, b) => Math.abs(middleOf(a)) - Math.abs(middleOf(b)))[0]
      : offscreen;
    if (!target) return;
    const middle = middleOf(target);
    const perNt = this.camera?.perNt ?? OPEN_PX_PER_NT;
    this.setCamera({ from: middle - this.width() / perNt / 2, perNt });
    this.handlers.onAnnounce?.(`${this.markerLayer.label} start site ${target.id ?? ''} shown at `
      + `${placementRangesText(target.placement)}`
      + `${expanded ? ` with ${formatCount(extent)} upstream nucleotides` : ''}.`);
  }

  /** The rows this strip has a base for, in drawn order. */
  placedMarkers() {
    return this.markerRows.filter((row) => row.placement.status === 'placed');
  }

  /**
   * Whether the marker row is reserved above the ruler.
   *
   * It takes a landed layer and at least one row this strip can place: a band
   * no mark could ever fill would read as a locus with no start site, and the
   * reader's own show/hide must not be what moves the letters.
   */
  markerRowShown() {
    return this.placedMarkers().length > 0;
  }

  /** What this layer's marks are called wherever this view names them. */
  markerControlLabel() {
    return `Show ${this.markerLayer.label} start sites`;
  }

  /**
   * Show or hide this view's marker row.
   *
   * The checkbox is not rebuilt, so a reader holding it keeps keyboard focus
   * and pointer capture across the change. What is rebuilt is the picture and
   * the list's note, each of which says what the picture is doing with the
   * marks.
   */
  setMarkersVisible(visible) {
    const next = Boolean(visible);
    if (this.markersVisible === next) return;
    this.markersVisible = next;
    if (this.markerToggle) this.markerToggle.checked = next;
    this.handlers.onMarkersVisibleChange?.(next);
    if (!this.model) return;
    this.draw();
    this.writeMarkerList();
    this.handlers.onAnnounce?.(`${this.markerLayer.label} start sites `
      + `${next ? 'shown' : 'hidden'} on the sequence close-up.`);
  }

  build() {
    this.host.replaceChildren();
    this.host.classList.add('gene-sequence');
    // A labelled region this view can put focus on when the node a reader was
    // holding stops existing, the same contract the gene visualizer's host
    // keeps. It is the surviving fallback with nothing pinned, where the strip
    // itself is hidden, and it carries the note that says so.
    this.host.tabIndex = -1;
    this.host.setAttribute('role', 'group');
    this.host.setAttribute('aria-label', 'Gene sequence close-up');

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
    this.upstreamLabel = element('label', 'gene-sequence-upstream-control', 'Upstream ');
    this.upstreamSelect = document.createElement('select');
    this.upstreamSelect.setAttribute('aria-label', 'Upstream sequence window');
    this.upstreamSelect.addEventListener('change', () => this.setUpstreamNt(this.upstreamSelect.value));
    this.upstreamLabel.append(this.upstreamSelect);
    toolbar.append(this.zoomInButton, this.zoomOutButton, this.fitButton, this.startButton,
      this.upstreamLabel);

    this.readout = element('p', 'chromosome-window');
    this.readout.setAttribute('role', 'status');

    this.strip = element('div', 'gene-sequence-strip');
    this.strip.tabIndex = 0;
    this.strip.setAttribute('role', 'group');
    this.strip.setAttribute('aria-label', 'Sequence close-up');
    this.strip.setAttribute('aria-describedby', 'gene-sequence-instructions');

    // The marker layer's own show/hide and, below everything, the complete
    // list of its published rows. Both are filled per gene, so they live in
    // hosts the build keeps and the render empties: a control that came and
    // went with the whole figure could not be found again after a repaint.
    this.markerControlHost = element('div', 'gene-sequence-marker-row');
    this.markerListHost = element('div');

    // The disclosure itself is built once and only ever refilled, never
    // replaced. A reader who opened it is holding an open/closed state and
    // possibly keyboard focus on its summary, and both belong to them: any
    // unrelated change to the page re-renders this view, so a rebuilt
    // `<details>` would close under their hand and drop their focus. Only its
    // contents say which gene and which rows, so only its contents change.
    this.markerDetails = element('details', 'method-help gene-sequence-sites');
    this.markerSummary = document.createElement('summary');
    this.markerNote = element('p', 'panel-note');
    this.markerRowList = element('ol', 'gene-view-site-rows');
    this.markerDetails.append(this.markerSummary, this.markerNote, this.markerRowList);
    this.markerDetails.hidden = true;
    this.markerListHost.append(this.markerDetails);

    this.selection = element('p', 'gene-sequence-selection');
    this.selection.setAttribute('role', 'status');
    this.selection.hidden = true;

    this.instructions = element('p', 'hint');
    this.instructions.id = 'gene-sequence-instructions';
    this.instructions.textContent = 'Drag the strip to pan it and scroll over it to zoom. With the '
      + 'strip focused: Left and Right pan, Shift and an arrow pans a whole window, plus and minus '
      + 'zoom, 0 or Home returns to the start, and End goes to the stop. Click a codon to read it out.';

    this.figure.append(this.heading, toolbar, this.readout, this.strip, this.markerControlHost,
      this.selection, this.instructions, this.markerListHost);
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
      // Through the same writers as any other render, so a reader holding the
      // control or the open list when the gene is unpinned lands on this
      // view's labelled host rather than on the document body.
      this.writeMarkerControl();
      this.writeMarkerList();
      this.writeSelection();
      return;
    }
    this.identity.textContent = model.name ? `${model.id} ${model.name}` : model.id;
    this.facts.textContent = `${model.strand === '-' ? 'minus' : 'plus'} strand, `
      + `${formatCount(model.lengthNt)} nt, ${formatCount(model.lengthCodons)} codons`;
    this.product.textContent = model.product ?? '';
    this.product.hidden = !model.product;
    this.writeUpstreamControl();
    if (!this.camera) this.camera = openingCamera(model.domain, this.width());
    // A scheme change rewrites what the selected codon says about itself.
    this.writeSelection();
    this.writeMarkerControl();
    this.writeMarkerList();
    this.draw();
  }

  writeUpstreamControl() {
    const options = this.upstreamOptions();
    this.upstreamSelect.replaceChildren();
    if (options.length === 0) {
      const option = document.createElement('option');
      option.value = '0';
      option.textContent = 'Unavailable';
      this.upstreamSelect.append(option);
      this.upstreamSelect.disabled = true;
      return;
    }
    for (const value of options) {
      const option = document.createElement('option');
      option.value = String(value);
      option.textContent = `${formatCount(value)} nt`;
      option.selected = value === this.upstreamNt;
      this.upstreamSelect.append(option);
    }
    this.upstreamSelect.value = String(this.upstreamNt);
    this.upstreamSelect.disabled = options.length === 1;
    this.upstreamSelect.dataset.loadState = this.sequenceContextPending ?? 'ready';
  }

  /**
   * The marker layer's show/hide and a route to the nearest placeable row.
   *
   * An organism with no such layer, a file still in flight or failed, and a
   * locus whose rows cannot fit any declared exact sequence get no control.
   * A row beyond the current short sequence keeps the control and gets an
   * explicit expansion action, because the larger exact window can show it.
   *
   * The condition is on the rows rather than on the current choice, so the
   * control does not vanish when a reader unchecks it.
   */
  writeMarkerControl() {
    const host = this.markerControlHost;
    const held = this.heldIn(host);
    const heldNavigation = document.activeElement === this.markerNavigationButton;
    host.replaceChildren();
    this.markerToggle = null;
    this.markerNavigationButton = null;
    this.markerNavigationStatus = null;
    const revealExtent = this.markerRevealExtent();
    if (!this.markerLayer || this.markerPending || revealExtent === null) {
      if (this.markerLayer && this.markerPending) {
        host.append(pendingNote(this.markerPending, `the ${this.markerLayer.fileLabel}`));
      }
      // Loading, failed, no landed layer and no revealable row all take the
      // control away while the reader may be standing on it.
      this.carryFocus(held);
      return;
    }
    const row = document.createElement('label');
    row.className = 'checkbox-row gene-sequence-layer';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = this.markersVisible;
    box.dataset.sequenceAction = MARKER_CONTROL;
    box.addEventListener('change', () => this.setMarkersVisible(box.checked));
    row.append(box, document.createTextNode(` ${this.markerControlLabel()}`));
    host.append(row);
    this.markerToggle = box;

    const navigation = element('div', 'chromosome-toolbar-row gene-sequence-marker-navigation');
    const button = this.chip('Go to nearest site', 'Show the nearest start site in the sequence',
      () => this.revealNearestMarker());
    const status = element('span', 'gene-sequence-facts');
    status.setAttribute('role', 'status');
    navigation.append(button, status);
    host.append(navigation);
    this.markerNavigationButton = button;
    this.markerNavigationStatus = status;
    this.writeMarkerNavigationStatus();
    if (held) {
      const target = heldNavigation && !button.hidden && !button.disabled ? button : box;
      target.focus({ preventScroll: true });
    }
  }

  /** Keep hidden, short-sequence and off-camera states explicit beside the control. */
  writeMarkerNavigationStatus() {
    const button = this.markerNavigationButton;
    const status = this.markerNavigationStatus;
    if (!button || !status) return;
    const held = document.activeElement === button;
    button.disabled = !this.markersVisible;
    if (!this.markersVisible) {
      if (held) this.markerToggle.focus({ preventScroll: true });
      button.hidden = false;
      status.textContent = `${this.markerLayer.label} sites are hidden in this view.`;
      return;
    }
    const placed = this.placedMarkers();
    const reachability = this.markerReachability();
    if (placed.length === 0) {
      const extent = reachability.nextExtent;
      button.hidden = false;
      button.textContent = 'Show nearest site';
      status.textContent = `${formatCount(reachability.expandable)} published `
        + `${reachability.expandable === 1 ? 'site lies' : 'sites lie'} beyond the current `
        + `${formatCount(this.upstreamNt)} nt sequence; the action uses the existing `
        + `${formatCount(extent)} nt upstream window.`
        + this.unplaceableMarkerStatus(reachability.unplaceable);
      return;
    }
    const outside = placed.filter((row) => !this.markerInWindow(row));
    const expansion = reachability.nextExtent;
    if (outside.length > 0 && outside.length === placed.length) {
      button.hidden = false;
      button.textContent = 'Go to nearest site';
      status.textContent = `${formatCount(outside.length)} of ${formatCount(placed.length)} placeable `
        + `${placed.length === 1 ? 'site is' : 'sites are'} outside the current camera window.`
        + this.unplaceableMarkerStatus(reachability.unplaceable);
      return;
    }
    if (expansion !== null) {
      const beyond = reachability.expandable;
      button.hidden = false;
      button.textContent = 'Show next site';
      status.textContent = `${formatCount(beyond)} published ${beyond === 1 ? 'site remains' : 'sites remain'} `
        + `beyond the current ${formatCount(this.upstreamNt)} nt sequence; the action uses the `
        + `existing ${formatCount(expansion)} nt upstream window.`
        + this.unplaceableMarkerStatus(reachability.unplaceable);
      return;
    }
    if (outside.length > 0) {
      button.hidden = false;
      button.textContent = 'Go to nearest site';
      status.textContent = `${formatCount(outside.length)} of ${formatCount(placed.length)} placeable `
        + `${placed.length === 1 ? 'site is' : 'sites are'} outside the current camera window.`
        + this.unplaceableMarkerStatus(reachability.unplaceable);
      return;
    }
    const unplaceable = reachability.unplaceable;
    // A camera update can finish the action after the control was rebuilt.
    // Keep keyboard focus in the controls when there is no further action.
    if (held) this.markerToggle.focus({ preventScroll: true });
    button.hidden = true;
    status.textContent = `${formatCount(placed.length)} placeable `
      + `${placed.length === 1 ? 'site is' : 'sites are'} in the current window.`
      + (unplaceable > 0
        ? ` ${formatCount(unplaceable)} published ${unplaceable === 1 ? 'row cannot' : 'rows cannot'} `
          + 'be placed in the available exact sequence; the list below gives each reason.'
        : '');
  }

  /** Status suffix for rows no available exact sequence can ever place. */
  unplaceableMarkerStatus(count) {
    if (count <= 0) return '';
    return ` ${formatCount(count)} published ${count === 1 ? 'row cannot' : 'rows cannot'} be placed `
      + 'in the available exact sequence; the list below gives each reason.';
  }

  /**
   * Whether the reader is standing on something inside one of this view's own
   * hosts, read before a rebuild detaches it.
   *
   * Scoped to the host on purpose: a render runs on every unrelated change to
   * the page, and a view that moved focus because *someone else* had it would
   * take the reader out of whatever they were actually using.
   */
  heldIn(host) {
    const active = document.activeElement;
    return Boolean(active) && active !== document.body && host.contains(active);
  }

  /**
   * Put focus on the labelled part of this view that survived the rebuild.
   *
   * The strip first: it is focusable, it is labelled "Sequence close-up", and
   * it is what the reader was reading beside the control. With nothing pinned
   * the whole figure is hidden, so the view's own host takes it, carrying the
   * note that says why there is nothing to show. If this view is hidden
   * altogether the nearest visible labelled ancestor that already takes focus
   * does, and if there is none, focus is left exactly where it is rather than
   * moved somewhere arbitrary.
   */
  carryFocus(held) {
    if (!held) return;
    const target = [this.strip, this.host].find((node) => visibleAndConnected(node))
      ?? labelledFocusableAncestor(this.host);
    target?.focus({ preventScroll: true });
  }

  /**
   * The complete list of this layer's published rows for the pinned gene.
   *
   * Every row, whether or not this strip can place it, in one place that works
   * by pointer, by touch and by keyboard: a `<title>` on a head needs a
   * pointer and answers for whichever head is on top. A row says where this
   * strip draws it, or why it cannot, and never borrows a coordinate from a
   * neighbour.
   *
   * A disclosure rather than an open list because a dense locus publishes
   * twenty rows and this view sits at the foot of a tab; closed, it adds one
   * line. Nothing in it is a control and nothing here changes what is drawn,
   * filtered or ranked.
   */
  writeMarkerList() {
    const details = this.markerDetails;
    const held = this.heldIn(this.markerListHost);
    if (!this.markerLayer || this.markerPending || this.markerRows.length === 0) {
      // Hidden rather than removed, so the node a reader opened and may be
      // standing on keeps its identity and its open state for the next locus
      // that has rows. Its own contents go, because a hidden list still
      // holding the last gene's rows would be read out on the way back.
      details.hidden = true;
      this.markerSummary.textContent = '';
      this.markerNote.textContent = '';
      this.markerRowList.replaceChildren();
      this.carryFocus(held);
      return;
    }
    const layer = this.markerLayer;
    details.hidden = false;
    this.markerSummary.textContent = `${layer.label} start sites `
      + `(${formatCount(this.markerRows.length)})`;
    this.markerNote.textContent =
      describeSequenceMarkers(this.model, this.markerDescription()).join(' ')
      + ` Each row is as ${layer.citation} published it. A mark on this strip sits on the base `
      + 'that row\'s own published genome coordinate names; the gene visualizer draws the same '
      + 'row at the distance the study published against its own gene model, and a row says how '
      + 'far apart the two put it, or that one of the two mappings is not published.';
    this.markerRowList.replaceChildren(...this.markerRows.map((row) => {
      const item = document.createElement('li');
      const id = element('span', 'gene-view-site-id', row.id ?? 'identifier not recorded');
      item.append(id, document.createTextNode(` · ${this.markerRowText(row)}`));
      return item;
    }));
  }

  /**
   * What the description and the list's note are told about the layer.
   *
   * `crowded` is how many drawn heads share space at the camera's current
   * zoom, which only the picture knows; the list's note leaves it out, because
   * the note is read at every zoom and the rows it introduces carry their own
   * exact offsets.
   */
  markerDescription(crowded = 0) {
    if (!this.markerLayer) return null;
    return {
      label: this.markerLayer.label,
      controlLabel: this.markerControlLabel(),
      rows: this.markerRows,
      visible: this.markersVisible,
      pending: this.markerPending,
      crowded,
    };
  }

  /**
   * One row of the marker list, as a reader reads it.
   *
   * Every field is the row's own: its type, strand, the replicon and
   * coordinate its source measured it at, what it records, where this strip
   * draws it or why it cannot, and the other basis beside it. A field the row
   * does not carry says so.
   */
  markerRowText(row) {
    const parts = [];
    parts.push(row.typeLabel ?? row.type ?? 'site type not recorded');
    parts.push(row.strand === '+' || row.strand === '-'
      ? `${row.strand === '-' ? 'minus' : 'plus'} strand` : 'strand not recorded');
    const span = markerSpanNt(row);
    parts.push(row.coordinateStatus !== 'mapped'
      ? 'no published genome coordinate'
      : `${row.replicon ?? 'replicon not recorded'} ${formatCount(row.position)}`
        + (row.geometry === 'interval'
          ? ` to ${formatCount(row.endPosition)}, ${formatCount(span)} nt` : ''));
    const { placement } = row;
    if (placement.status === 'placed') {
      parts.push(row.geometry === 'interval'
        ? `marked here over ${placementRangesText(placement)}`
          + (placement.runs.length > 1
            ? `, ${formatCount(placement.runs.length)} separate stretches with the bases between `
              + 'them not covered' : '')
          + (placement.shownNt < span
            ? `, ${formatCount(placement.shownNt)} of its ${formatCount(span)} bases shown` : '')
        : `marked here at ${placementRangesText(placement)}`);
    } else if (placement.reason === 'other-replicon') {
      parts.push('measured on another replicon than this gene, so no mark is drawn here');
    } else if (placement.reason === 'no-native-coordinate') {
      parts.push('no published genome coordinate to place it on a base, so no mark is drawn here');
    } else {
      parts.push('its published coordinate is not a base this close-up shows, so no mark is '
        + 'drawn here');
    }
    parts.push(row.distanceNt === null
      ? 'no published upstream distance, so the gene visualizer draws no mark either'
      : `published ${formatCount(row.distanceNt)} nt upstream of the published gene-model start, `
        + `where the gene visualizer draws it`
        + (row.basisGapNt === null ? ''
          : row.basisGapNt === 0 ? ', which is this same base'
            : `, ${formatCount(row.basisGapNt)} nt from this mark`));
    parts.push(row.measurement === 'predicted' ? 'predicted site' : 'measured site');
    if (row.origin === 'computed') {
      parts.push(`computed by ${row.producer ?? 'an unrecorded producer'}; supplementary `
        + 'presentation with lower overlap priority');
    }
    parts.push(row.evidence === 'measured'
      ? `${formatCount(row.readCount)} condition read ${row.readCount === 1 ? 'count' : 'counts'} `
        + 'in this row'
      : 'no condition read count in this row');
    return parts.join(' · ');
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

  /** The redrawn start or stop annotation for a codon, if it is in view. */
  codonAnnotation(index) {
    return [...this.strip.querySelectorAll('.gene-sequence-annotation')]
      .find((node) => node.getAttribute('data-codon-index') === String(index)) ?? null;
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
    const firstVisible = Math.floor(window.from);
    const lastVisible = Math.ceil(window.to);
    const crowding = this.markerCrowding(x, firstVisible, lastVisible);

    const root = svg('svg', {
      class: 'gene-sequence-svg',
      viewBox: `0 0 ${total} ${rows.height}`,
      width: total,
      height: rows.height,
      role: 'group',
      preserveAspectRatio: 'xMinYMin meet',
    });
    const description = describeGeneSequence(model, this.shownRange(window),
      this.markerDescription(crowding.crowded));
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
    this.drawRuler(area, rows, x, firstVisible, lastVisible, width);
    if (cells) this.drawCells(area, rows, x, perNt, firstVisible, lastVisible, width);
    else this.drawBars(area, rows, x, perNt, firstVisible, lastVisible);
    this.drawJunctions(area, rows, x, firstVisible, lastVisible);
    // Last, so a mark sits over the letter it names rather than under it.
    this.drawMarkers(area, rows, x, crowding);
    root.append(area);
    this.strip.replaceChildren(root);
    this.writeReadout(window);
    this.writeMarkerNavigationStatus();
  }

  rowLayout() {
    const active = this.model.scheme.active;
    // Reserved by whether this locus has a placeable mark at all, not by
    // whether the reader is showing it: the geometry a reader is reading must
    // not move when they put the marks away.
    const markers = this.markerRowShown() ? 0 : null;
    const bases = (markers === null ? 0 : MARKER_ROW_HEIGHT) + RULER_HEIGHT;
    const recoded = active ? bases + ROW_HEIGHT + ROW_GAP : null;
    const residues = (active ? recoded : bases) + ROW_HEIGHT + ROW_GAP;
    const residueRuler = residues + ROW_HEIGHT;
    return {
      markers, bases, recoded, residues, residueRuler, height: residueRuler + RESIDUE_RULER_HEIGHT,
    };
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
    // Named only where marks are actually drawn: a labelled empty band would
    // read as a locus with no start site, which is the one thing the reserved
    // row must not say. What an empty band means is in the description.
    if (rows.markers !== null && this.markersVisible) {
      labels.append(text(LABEL_WIDTH - 6, MARKER_ROW_HEIGHT - 4, 'Sites', { 'text-anchor': 'end' }));
    }
    label(rows.bases, this.model.scheme.active ? 'Original' : 'Bases');
    if (rows.recoded !== null) label(rows.recoded, 'Recoded');
    if (cells) label(rows.residues, 'Protein');
    root.append(labels);
  }

  drawRuler(area, rows, x, firstVisible, lastVisible, width) {
    const ruler = svg('g', { class: 'gene-sequence-ruler' });
    const y = rows.bases - 4;
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
      if (codon.kind === 'start' || codon.kind === 'stop') classes.push('gene-sequence-annotation');
      const cell = svg('g', { class: classes.join(' '), 'data-codon-index': index });
      let activate = null;
      if (codon.kind === 'start' || codon.kind === 'stop') {
        activate = () => {
          this.selectCodon(index);
          this.codonAnnotation(index)?.focus({ preventScroll: true });
        };
        interactiveAnnotation(cell, this.describeCodon(codon), activate);
        cell.append(annotationHitTarget(cell, {
          class: 'gene-sequence-codon-hit-target',
          'data-codon-index': index,
          x: codon.kind === 'start' ? left - CODON_HIT_PADDING_PX : left,
          y: Math.max(0, rows.bases - CODON_HIT_PADDING_PX),
          width: cellWidth + CODON_HIT_PADDING_PX,
          height: rows.residues + ROW_HEIGHT - rows.bases + CODON_HIT_PADDING_PX * 2,
        }, activate));
      }

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
      const activate = () => {
        this.selectCodon(codon.index);
        this.codonAnnotation(codon.index)?.focus({ preventScroll: true });
      };
      const node = interactiveAnnotation(svg('rect', {
        class: `${className} gene-sequence-annotation`,
        'data-codon-index': codon.index,
        x: left, y, width, height: ROW_HEIGHT,
      }), this.describeCodon(codon), activate);
      group.append(annotationHitTarget(node, {
        class: 'gene-sequence-codon-hit-target',
        'data-codon-index': codon.index,
        x: codon.kind === 'start' ? left - CODON_HIT_PADDING_PX : left,
        y: Math.max(0, y - CODON_HIT_PADDING_PX),
        width: width + CODON_HIT_PADDING_PX,
        height: ROW_HEIGHT + CODON_HIT_PADDING_PX * 2,
      }, activate));
      const title = svg('title');
      title.textContent = this.describeCodon(codon);
      node.append(title);
      group.append(node);
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

  /**
   * Which drawn marker heads share space at the camera's current zoom.
   *
   * Grouped by single linkage over the drawn axis, the same rule the small
   * gene visualizer uses: a run of heads less than one head apart is one
   * visual cluster even where its two ends are further apart than that. The
   * grouping is a fact about the picture at this zoom and never a claim that
   * one feature, or one continuous stretch of evidence, is behind it — every
   * mark keeps its own column and its own row in the list.
   *
   * Only marks the window actually draws are counted, because a mark off the
   * left or right edge shares space with nothing. Whether the reader is
   * showing them is not asked here: {@link GeneSequenceView#drawMarkers} is
   * the one place that decides, and the hidden description never reaches the
   * crowding sentence.
   */
  markerCrowding(x, firstVisible, lastVisible) {
    const inWindow = this.markerRowShown()
      ? this.placedMarkers().filter((row) => row.placement.toOffset + 1 >= firstVisible
        && row.placement.fromOffset <= lastVisible)
      : [];
    const groups = overlapGroups(
      inWindow.map((row) => ({ offset: row.placement.fromOffset, row })),
      x, MARKER_HEAD_PX,
    );
    const sharedWith = new Map();
    let crowded = 0;
    for (const group of groups) {
      if (group.length < 2) continue;
      crowded += group.length;
      for (const entry of group) sharedWith.set(entry.row, group.length);
    }
    return { drawn: inWindow, sharedWith, crowded };
  }

  /**
   * The marker row: each mark on the base its own published genome coordinate
   * names, or nothing at all when the reader has hidden them.
   *
   * Hidden means not built: no head, no stem, no outlined column and no
   * `<title>`. A mark left in the tree at zero opacity would still answer a
   * pointer and still be read out, so the picture would disagree with itself.
   *
   * A point marker names one column; an interval is drawn over each contiguous
   * stretch of columns this strip shows of it, separately, and says in its
   * `<title>` when that is fewer bases than it covers. The stretches are what
   * is drawn rather than the range around them, because an interval crossing
   * the circular origin of a short replicon can cover two stretches with
   * uncovered bases between: one bar across the whole range would outline
   * bases the source never reported.
   *
   * Nothing is moved to make room: the outlined column underneath is what ties
   * a head to the letter it is about, which is also how two heads sharing
   * space stay tellable apart at a closer zoom.
   */
  drawMarkers(area, rows, x, crowding) {
    if (rows.markers === null || !this.markersVisible) return;
    const group = svg('g', { class: 'gene-sequence-markers' });
    const top = rows.markers + 2;
    const bottom = rows.markers + MARKER_ROW_HEIGHT - 3;
    const ordered = markerPaintOrder(crowding.drawn);
    const targets = ordered.flatMap((row) => row.placement.runs.map((run) => {
      const left = x(run.fromOffset);
      const right = x(run.toOffset + 1);
      const centre = (left + right) / 2;
      return {
        row,
        run,
        from: row.geometry === 'interval' ? left : centre - MARKER_HEAD_PX / 2,
        to: row.geometry === 'interval' ? right : centre + MARKER_HEAD_PX / 2,
      };
    }));
    const targetRanges = targets.map(({ from, to }) => ({ from, to }));
    for (const row of ordered) {
      const shared = crowding.sharedWith.get(row) ?? 0;
      const presentation = markerPresentation(row);
      const classes = ['gene-sequence-marker', 'gene-sequence-annotation',
        `gene-sequence-marker-${presentation.id}`];
      if (shared > 0) classes.push('gene-sequence-marker-shared');
      const label = this.describeMarker(row, shared);
      const mark = interactiveAnnotation(svg('g', {
        class: classes.join(' '),
        'data-marker-id': row.id ?? '',
        'data-marker-origin': row.origin ?? '',
        'data-marker-producer': row.producer ?? '',
      }), label);
      for (const run of row.placement.runs) {
        const left = x(run.fromOffset);
        const right = x(run.toOffset + 1);
        const centre = (left + right) / 2;
        const targetIndex = targets.findIndex((entry) => entry.row === row && entry.run === run);
        const hit = paddedHitRange(targetRanges, targetIndex, MARKER_HIT_PADDING_PX);
        mark.append(svg('rect', {
          class: 'gene-sequence-marker-hit-target',
          'data-marker-id': row.id ?? '',
          x: hit.from,
          y: Math.max(0, top - MARKER_HIT_PADDING_PX),
          width: hit.to - hit.from,
          height: MARKER_ROW_HEIGHT,
          fill: 'transparent',
          stroke: 'none',
          'pointer-events': 'all',
          'aria-hidden': 'true',
        }));
        if (row.geometry === 'interval') {
          mark.append(svg('rect', {
            class: 'gene-sequence-marker-span',
            x: left, y: top, width: Math.max(2, right - left), height: bottom - top,
          }));
        } else {
          mark.append(svg('path', {
            class: 'gene-sequence-marker-head',
            d: `M ${centre - MARKER_HEAD_PX / 2} ${top} L ${centre + MARKER_HEAD_PX / 2} ${top} `
              + `L ${centre} ${bottom} Z`,
          }));
        }
        mark.append(svg('line', {
          class: 'gene-sequence-marker-stem', x1: centre, x2: centre, y1: bottom, y2: rows.bases,
        }));
        mark.append(svg('rect', {
          class: 'gene-sequence-marker-column',
          x: left, y: rows.bases, width: Math.max(1, right - left), height: ROW_HEIGHT,
        }));
      }
      const title = svg('title');
      title.textContent = label;
      mark.append(title);
      group.append(mark);
    }
    if (group.children.length > 0) area.append(group);
  }

  /** What one mark says about itself to a pointer. */
  describeMarker(row, shared = 0) {
    const { placement } = row;
    const parts = [`${row.id ?? 'An unidentified row'}: `
      + `${row.typeLabel ?? row.type ?? 'site'} marked at ${placementRangesText(placement)}, the `
      + `${row.geometry === 'interval' ? 'bases' : 'base'} its own published genome coordinate `
      + `${formatCount(row.position)}`
      + (row.geometry === 'interval' ? ` to ${formatCount(row.endPosition)}` : '')
      + ` names, not remeasured from a distance.`];
    if (placement.runs.length > 1) {
      parts.push(`Its covered bases reach this close-up in `
        + `${formatCount(placement.runs.length)} separate stretches, and the bases between them `
        + 'are outside what it covers, so each stretch is outlined on its own.');
    }
    if (row.geometry === 'interval' && placement.shownNt < placement.spanNt) {
      parts.push(`${formatCount(placement.shownNt)} of its ${formatCount(placement.spanNt)} `
        + 'bases are inside this close-up.');
    }
    if (row.distanceNt === null) {
      parts.push('No distance against the study\'s own gene model is published for this row, so '
        + 'the gene visualizer draws no mark for it and there is nothing to compare this base '
        + 'with.');
    } else {
      parts.push(row.basisGapNt === 0
        ? `The ${formatCount(row.distanceNt)} nt upstream distance the study published against `
          + 'its own gene model puts it at this same base, where the gene visualizer draws it.'
        : `The ${formatCount(row.distanceNt)} nt upstream distance the study published against `
          + `its own gene model puts it ${formatCount(row.basisGapNt)} nt away, which is where `
          + 'the gene visualizer draws it.');
    }
    if (shared > 1) {
      parts.push(`Its head shares drawn space with ${formatCount(shared - 1)} other `
        + `${shared === 2 ? 'mark' : 'marks'} at this zoom, which is display only: zoom in, or `
        + 'read the list below, to tell them apart.');
    }
    if (row.origin === 'computed') {
      parts.push(`This row was computed by ${row.producer ?? 'an unrecorded producer'}; its tag is `
        + 'slightly transparent and painted below source records when marks overlap.');
    }
    return parts.join(' ');
  }

  drawJunctions(area, rows, x, firstVisible, lastVisible) {
    const group = svg('g', { class: 'gene-sequence-junctions' });
    for (const junction of this.model.junctions) {
      if (junction.atOffset < firstVisible || junction.atOffset > lastVisible) continue;
      const jx = x(junction.atOffset);
      group.append(svg('line', { x1: jx, x2: jx, y1: rows.bases - 2, y2: rows.residueRuler }));
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
    const codonIndex = Number(event.target?.dataset?.codonIndex);
    if ((event.key === 'Enter' || event.key === ' ') && Number.isInteger(codonIndex)) {
      event.preventDefault();
      this.selectCodon(codonIndex);
      this.codonAnnotation(codonIndex)?.focus({ preventScroll: true });
      return;
    }
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
