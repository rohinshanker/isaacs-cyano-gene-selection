/**
 * The chromosome view: every plotted CDS at its UTEX 2973 coordinate.
 *
 * Canvas rather than inline SVG, and for the opposite reason the gene
 * visualizer is SVG: this view draws 2,715 marks and pans and zooms
 * continuously, so a DOM node per CDS could not hold a frame rate. The canvas
 * therefore carries the same accessible treatment the scatter map does — a
 * sentence-level `aria-label` rebuilt on every render, described-by
 * instructions, and keyboard navigation that announces each gene it lands on.
 *
 * Geometry and every coordinate decision live in `core/chromosome-model.js`.
 * This module only turns that model into pixels and events.
 */
import {
  MIN_WINDOW_BP, clampWindow, describeChromosomeView, formatBasePairs, formatCoordinate,
  fullWindow, locateIndex, navigationLanes, neighborMark, operonBrackets, panWindow,
  positionTicks, repliconScale, tssPositions, visibleMarks, zoomWindow,
} from '../core/chromosome-model.js';
import {
  ACTIVE_FOCUS_COLOR, CATEGORY_UNKNOWN_COLOR, DERIVED_MARKER_FILL, GHOST_BORDER, GHOST_COLOR,
  HOVER_FOCUS_COLOR, MISSING_COLOR, PINNED_COLOR, REVIEWED_MARKER_BORDER, SHORTLIST_COLOR,
} from './colors.js';
import { confirmedReset } from './confirm-dialog.js';
import { syncScaleSelect } from './scale-select.js';
import { formatCount } from './format.js';

export const CHROMOSOME_TAB = Object.freeze({
  id: 'chromosome',
  name: 'Chromosome',
  blurb: 'Every plotted CDS at its position on the genome of record: the 2.69 Mb chromosome as '
    + 'the primary linear track, with both plasmids beneath it as explicit secondary tracks at '
    + 'their own scales. Selecting a CDS opens it in the gene visualizer.',
  source: 'Drawn from the release-pinned RefSeq coordinates in genes.json. No coordinate from '
    + 'another strain is ever placed on these axes.',
});

const PADDING = Object.freeze({ left: 16, right: 16, top: 8, bottom: 6 });
const BAND_GAP = 18;
const TRACK_LABEL_HEIGHT = 18;
const TSS_ROW_HEIGHT = 10;
const BRACKET_ROW_HEIGHT = 8;
const AXIS_HEIGHT = 1;
const TICK_LABEL_HEIGHT = 15;
const PRIMARY_LANE_HEIGHT = 17;
const SECONDARY_LANE_HEIGHT = 13;

/** Narrowest operon bracket worth drawing. Below this it is a smear, not a bracket. */
const MIN_BRACKET_PX = 4;
/** Vertical room a wrap marker needs beside the lane. */
const WRAP_MARKER_PX = 5;
/** Room each start-site tick needs before the row stops being separate ticks. */
const MIN_TSS_SPACING_PX = 3;
/** The clipped-edge chevron reads against any colour the bar beneath it takes. */
const WRAP_MARKER_FILL = '#ffffff';
const WRAP_MARKER_STROKE = '#1b2733';

const AXIS_COLOR = '#536774';
const LABEL_COLOR = '#4a5568';
const OPERON_COLOR = '#687583';
/** The gene visualizer's Tan 2018 colour, so one evidence layer reads as one colour. */
const TSS_COLOR = '#6b4f9e';

/** Vertical layout of one replicon band, in pixels from the band's top edge. */
export function bandLayout(top, laneHeight) {
  const tssTop = top + TRACK_LABEL_HEIGHT;
  const bracketAboveTop = tssTop + TSS_ROW_HEIGHT;
  const laneAboveTop = bracketAboveTop + BRACKET_ROW_HEIGHT;
  const axisY = laneAboveTop + laneHeight;
  const laneBelowTop = axisY + AXIS_HEIGHT;
  const bracketBelowTop = laneBelowTop + laneHeight;
  return {
    top,
    labelBaseline: top + 13,
    tssTop,
    tssBottom: bracketAboveTop,
    bracketAboveTop,
    laneAboveTop,
    axisY,
    laneBelowTop,
    bracketBelowTop,
    laneHeight,
    tickBaseline: bracketBelowTop + BRACKET_ROW_HEIGHT + 11,
    height: TRACK_LABEL_HEIGHT + TSS_ROW_HEIGHT + BRACKET_ROW_HEIGHT * 2
      + laneHeight * 2 + AXIS_HEIGHT + TICK_LABEL_HEIGHT,
  };
}

/** Total canvas height for a set of tracks, so the host can size the element. */
export function canvasHeightFor(tracks) {
  const bands = tracks.map((track) => (track.primary ? PRIMARY_LANE_HEIGHT : SECONDARY_LANE_HEIGHT));
  const stacked = bands.reduce((total, laneHeight) => total + bandLayout(0, laneHeight).height, 0);
  return PADDING.top + PADDING.bottom + stacked + BAND_GAP * Math.max(0, tracks.length - 1);
}

/**
 * The track's caption, longest form first.
 *
 * A caption that runs past the edge of the canvas loses whichever fact happens
 * to be last, so the variants drop facts in a chosen order instead: the role
 * word, then the plotted-CDS count, then the length. The accession is never
 * dropped, because it is what says which sequence this axis is.
 */
export function trackLabelVariants(track) {
  const length = formatBasePairs(track.lengthBp);
  const plotted = `${formatCount(track.cdsCount)} plotted CDS${track.cdsCount === 1 ? '' : 's'}`;
  return [
    `${track.label} ${track.accession} · ${length} · ${plotted}`,
    `${track.accession} · ${length} · ${plotted}`,
    `${track.accession} · ${length}`,
    track.accession,
  ];
}

/** The longest caption variant that fits, or the accession clipped to fit. */
export function fitTrackLabel(measure, track, maxWidth) {
  const variants = trackLabelVariants(track);
  for (const variant of variants) {
    if (measure(variant) <= maxWidth) return variant;
  }
  let clipped = variants[variants.length - 1];
  while (clipped.length > 1 && measure(`${clipped}…`) > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}…`;
}

/**
 * Which tick labels an axis has room to write, with the anchor each one uses.
 *
 * Every tick keeps its mark; only the labels thin out. Choosing a smaller tick
 * count instead would work through round 1/2/5 steps, so a narrow axis jumps
 * from five labels straight to one. Dropping the labels that would collide
 * keeps the ruler as dense as the width actually allows.
 *
 * An end label is nudged inward by its own half-width, so it stays on the
 * canvas rather than being clipped by the element's edge.
 */
export function fitTickLabels(ticks, { measure, x, left, right, gap = 8 }) {
  const placed = [];
  let lastRight = -Infinity;
  for (const tick of ticks) {
    const half = measure(tick.label) / 2;
    const anchor = Math.min(right - half, Math.max(left + half, x(tick.bp)));
    if (anchor - half < lastRight + gap) continue;
    lastRight = anchor + half;
    placed.push({ ...tick, anchor });
  }
  return placed;
}

/**
 * The rectangle one annotated piece of a CDS draws into, in drawing units.
 *
 * A sub-pixel CDS is snapped to a whole device column and given a whole pixel
 * of width. At whole-genome zoom a 1 kb gene is a third of a pixel, and drawn
 * at a fractional edge it anti-aliases into a pale smear that loses its colour
 * entirely. This is the horizontal extent only; `ChromosomeView.barRect` adds
 * the lane rows and is what every glyph on the piece is placed on and clipped
 * to.
 *
 * @param {{bpToX: (bp: number) => number}} scale
 * @param {{from: number, to: number}} piece
 * @return {{left: number, width: number}}
 */
export function pieceRect(scale, piece) {
  const x0 = scale.bpToX(piece.from);
  const exact = scale.bpToX(piece.to + 1) - x0;
  return { left: exact < 1.5 ? Math.round(x0) : x0, width: Math.max(1, exact) };
}

export class ChromosomeView {
  /**
   * @param {HTMLElement} host the tab panel, emptied and rebuilt on first use.
   * @param {{onHover: (index: number) => void, onPreview: (index: number) => void,
   *   onSelect: (index: number) => void, onShortlistToggle: (index: number) => void,
   *   onColorChange: (key: string) => void, onColorScaleChange: (scale: string) => void,
   *   onShowHiddenChange: (value: boolean) => void,
   *   onDetailJump: () => void, onAnnounce: (message: string) => void}} handlers
   */
  constructor(host, handlers = {}) {
    this.host = host;
    this.handlers = handlers;
    this.built = false;
    this.model = null;
    this.windows = new Map();
    this.lanes = [];
    this.cursor = null;
    // The shared selection this view last reconciled its camera and its
    // keyboard cursor against. -1 is "nothing", which is also what an empty
    // selection reports, so the first non-empty one is always a change.
    this.reconciledSelection = -1;
    this.dragging = null;
    this.pendingFrame = 0;
  }

  /**
   * @param {{tracks: object[], problems: string[], verified: boolean, genes: object[],
   *   mask: Uint8Array|null, showHidden: boolean, colors: object, colorLabel: string,
   *   colorOptions: {value: string, label: string, group: string}[], colorKey: string,
   *   colorScaleOptions: {value: string, label: string, disabled: boolean,
   *     reason: string|null}[], colorScale: string, colorScaleClause: string,
   *   pinned: number, hovered: number, active: number, shortlist: Set<number>,
   *   passing: number, total: number, categoryFilterLabels: string[],
   *   hasSelection: boolean}} model
   */
  update(model) {
    if (!this.built) this.build();
    this.model = model;
    if (!model.verified) {
      this.showProblems(model.problems);
      return;
    }
    this.figure.hidden = false;
    this.unavailable.hidden = true;
    this.lanes = navigationLanes(model.tracks);
    // Operon grouping and the gTSS join depend on the dataset, not on the
    // camera, so they are resolved once per render rather than once per frame.
    this.layers = new Map(model.tracks.map((track) => [track.accession, {
      brackets: operonBrackets(track, model.genes),
      tss: tssPositions(track, model.genes),
    }]));
    for (const track of model.tracks) {
      if (!this.windows.has(track.accession)) {
        this.windows.set(track.accession, fullWindow(track.lengthBp));
      }
    }
    // The cursor is a keyboard preview, not state, and it is a local copy of a
    // selection the rest of the workspace owns. So it is reconciled whenever
    // that selection changes — a pin made in another tab, a search result, a
    // live hash — and not only when it happens to be unset: a stale cursor
    // would send the next arrow key off from a gene the reader left behind.
    const selected = model.active >= 0 ? model.active : model.pinned;
    const incoming = selected >= 0 && selected !== this.reconciledSelection;
    this.reconciledSelection = selected;
    if (incoming) this.cursor = locateIndex(this.lanes, selected);
    else if (this.cursor === null && selected >= 0) {
      this.cursor = locateIndex(this.lanes, selected);
    }
    this.syncControls();
    this.renderSummaries();
    this.resize();
    // A selection that arrived from elsewhere has to be brought into the
    // window, or a zoomed track answers a search by showing the reader a
    // stretch of genome the gene they asked for is not on.
    if (incoming) this.revealIndex(selected);
    this.draw();
  }

  showProblems(problems) {
    this.figure.hidden = true;
    this.unavailable.hidden = false;
    const heading = document.createElement('p');
    heading.textContent = 'This view cannot be drawn against this dataset, because an axis drawn '
      + 'from an unverified replicon length would misplace every mark on it.';
    const list = document.createElement('ul');
    for (const problem of problems) {
      const item = document.createElement('li');
      item.textContent = problem;
      list.append(item);
    }
    this.unavailable.replaceChildren(heading, list);
  }

  /** The primary track, which the zoom, pan and reset controls act on. */
  primaryTrack() {
    return this.model.tracks.find((track) => track.primary) ?? this.model.tracks[0];
  }

  windowFor(track) {
    return this.windows.get(track.accession) ?? fullWindow(track.lengthBp);
  }

  build() {
    this.host.replaceChildren();

    const copyNumber = document.createElement('p');
    copyNumber.className = 'panel-note';
    copyNumber.textContent = 'Every per-gene value on this view is per genome copy. This '
      + 'chromosome is present in many copies per cell, that number changes with growth '
      + 'condition, and no source in this release records it, so nothing here is a per-cell '
      + 'dosage.';

    this.unavailable = document.createElement('div');
    this.unavailable.className = 'chromosome-unavailable';
    this.unavailable.hidden = true;

    this.figure = document.createElement('div');
    this.figure.className = 'chromosome-figure';

    const toolbar = document.createElement('div');
    toolbar.className = 'chromosome-toolbar';

    const colorField = document.createElement('span');
    colorField.className = 'field-row field-row-colour';
    const colorLabel = document.createElement('label');
    colorLabel.htmlFor = 'chromosome-color-by';
    colorLabel.textContent = 'Colour by';
    this.colorSelect = document.createElement('select');
    this.colorSelect.id = 'chromosome-color-by';
    this.colorSelect.addEventListener('change', () => {
      this.handlers.onColorChange?.(this.colorSelect.value);
    });
    colorField.append(colorLabel, this.colorSelect);

    // Scale sits beside Colour by, reading the one shared value the scatter map
    // and the legend read, and the colour explanation stays directly beneath the
    // toolbar as this tab's own copy of the map's order.
    const scaleField = document.createElement('span');
    scaleField.className = 'field-row field-row-scale';
    const scaleLabel = document.createElement('label');
    scaleLabel.htmlFor = 'chromosome-color-scale';
    scaleLabel.textContent = 'Scale';
    this.colorScaleSelect = document.createElement('select');
    this.colorScaleSelect.id = 'chromosome-color-scale';
    this.colorScaleSelect.addEventListener('change', () => {
      this.handlers.onColorScaleChange?.(this.colorScaleSelect.value);
    });
    scaleField.append(scaleLabel, this.colorScaleSelect);

    this.zoomIn = this.chip('Zoom in (+)', 'Zoom in', () => this.zoomByCentre(1.6));
    this.zoomOut = this.chip('Zoom out (−)', 'Zoom out', () => this.zoomByCentre(1 / 1.6));
    // Every reset asks first; see docs/validation/controls-column-and-resets.md.
    // The double-click and `0` shortcuts stay direct, as the scatter map's do:
    // a modal on a pointer gesture is noise, and the control is the gate.
    this.resetButton = this.chip('Reset view', 'Reset the chromosome view');
    confirmedReset(this.resetButton, {
      title: 'Reset the chromosome view?',
      body: 'Every track returns to its full length, discarding the windows you zoomed and '
        + 'panned to. Your pinned gene, shortlist, filters, and colour are not affected.',
      confirmLabel: 'Reset view',
      action: () => this.resetView(),
    });

    const showHiddenRow = document.createElement('span');
    showHiddenRow.className = 'checkbox-row';
    this.showHidden = document.createElement('input');
    this.showHidden.type = 'checkbox';
    this.showHidden.id = 'chromosome-show-hidden';
    this.showHidden.addEventListener('change', () => {
      this.handlers.onShowHiddenChange?.(this.showHidden.checked);
    });
    const showHiddenLabel = document.createElement('label');
    showHiddenLabel.htmlFor = 'chromosome-show-hidden';
    showHiddenLabel.textContent = 'Show filtered-out genes';
    showHiddenRow.append(this.showHidden, showHiddenLabel);

    toolbar.append(colorField, scaleField, this.zoomIn, this.zoomOut, this.resetButton,
      showHiddenRow);

    this.colourHelp = document.createElement('details');
    this.colourHelp.className = 'method-help';
    this.colourHelp.id = 'chromosome-colour-help';
    this.colourHelp.hidden = true;
    const colourHelpSummary = document.createElement('summary');
    colourHelpSummary.textContent = 'Colour metric explanation';
    const colourHelpContent = document.createElement('div');
    colourHelpContent.className = 'help-content';
    this.colourHelp.append(colourHelpSummary, colourHelpContent);

    this.windowReadout = document.createElement('p');
    this.windowReadout.className = 'chromosome-window';
    this.windowReadout.setAttribute('role', 'status');

    this.canvasHost = document.createElement('div');
    this.canvasHost.className = 'chromosome-canvas-host';
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'chromosome-canvas';
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-describedby', 'chromosome-instructions');
    this.context = this.canvas.getContext('2d');
    this.canvasHost.append(this.canvas);

    this.instructions = document.createElement('p');
    this.instructions.className = 'hint';
    this.instructions.id = 'chromosome-instructions';
    this.instructions.textContent = 'Drag a track to pan it and scroll over it to zoom it; each '
      + 'replicon keeps its own scale and its own window. The Zoom in and Zoom out buttons, and '
      + 'the plus and minus keys, act on the chromosome track. Double-click, 0, or Reset view '
      + 'returns every track to its full length. With a track focused: Left and Right move along '
      + 'one strand lane and announce the CDS without pinning it, Up and Down cross to the next '
      + 'lane or replicon, Shift and an arrow pans the chromosome, Enter pins the active CDS, and '
      + 'S adds or removes it from the shortlist.';

    this.detailJump = document.createElement('button');
    this.detailJump.type = 'button';
    this.detailJump.className = 'chip-button detail-jump';
    this.detailJump.id = 'chromosome-detail-jump';
    this.detailJump.textContent = 'Jump to selected gene detail';
    this.detailJump.hidden = true;
    this.detailJump.addEventListener('click', () => this.handlers.onDetailJump?.());

    this.legendHost = document.createElement('div');
    this.legendHost.className = 'legend';

    this.markerNote = document.createElement('p');
    this.markerNote.className = 'panel-note';

    this.trackSummaries = document.createElement('ul');
    this.trackSummaries.className = 'chromosome-tracks';

    this.evidenceNote = document.createElement('p');
    this.evidenceNote.className = 'panel-note';
    this.evidenceNote.textContent = 'Coordinates do not transfer between strains, so no '
      + 'sister-strain position is placed on these axes; such evidence reaches the viewer only as '
      + 'an offset against a named UTEX locus, in the gene visualizer. A value a source does not '
      + 'report is absent here, never zero.';

    this.figure.append(toolbar, this.colourHelp, this.windowReadout, this.canvasHost,
      this.instructions, this.detailJump, this.legendHost, this.markerNote, this.trackSummaries,
      this.evidenceNote);
    this.host.append(copyNumber, this.unavailable, this.figure);

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
      this.draw();
    });
    this.resizeObserver.observe(this.canvasHost);
    this.bindEvents();
    this.built = true;
  }

  /** A toolbar chip. A chip whose click is wired elsewhere passes no action. */
  chip(text, ariaLabel, action = null) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip-button';
    button.textContent = text;
    button.setAttribute('aria-label', ariaLabel);
    if (action) button.addEventListener('click', action);
    return button;
  }

  /** The host for the shared colour legend, so this view uses the map's key. */
  legendElement() {
    return this.legendHost;
  }

  /** The host for the shared colour-metric explanation disclosure. */
  colourHelpElement() {
    return this.colourHelp;
  }

  syncControls() {
    const { colorOptions, colorKey, showHidden } = this.model;
    const signature = colorOptions.map((option) => `${option.group}\u0000${option.value}`).join('\u0001');
    if (this.colorSignature !== signature) {
      this.colorSignature = signature;
      this.colorSelect.replaceChildren();
      let group = null;
      let groupName = null;
      for (const option of colorOptions) {
        if (option.group !== groupName) {
          groupName = option.group;
          group = document.createElement('optgroup');
          group.label = groupName;
          this.colorSelect.append(group);
        }
        const node = document.createElement('option');
        node.value = option.value;
        node.textContent = option.label;
        group.append(node);
      }
    }
    this.colorSelect.value = colorKey;
    syncScaleSelect(this.colorScaleSelect, this.model.colorScaleOptions, this.model.colorScale);
    this.showHidden.checked = showHidden;
    this.detailJump.hidden = !this.model.hasSelection;
  }

  /**
   * The drawing conventions this view uses, in its own shapes.
   *
   * The shared colour key above it says what the colours mean; it deliberately
   * omits the scatter map's point-shape rows, because the same evidence states
   * are bars on an axis here, and a legend naming circles and squares would
   * describe a picture that is not on screen.
   */
  markerConventions() {
    const { colors, mask, genes, showHidden } = this.model;
    let missing = 0;
    let excluded = 0;
    for (let i = 0; i < genes.length; i += 1) {
      if (mask && !mask[i]) excluded += 1;
      const value = colors.values ? colors.values[i] : NaN;
      const known = colors.scale?.categorical
        ? colors.scale.bucketOf(value) >= 0 : Number.isFinite(value);
      if (!known) missing += 1;
    }
    const parts = [
      'Plus-strand CDSs sit above each axis and minus-strand CDSs below it, each drawn as one '
        + 'bar per annotated segment.',
      `${formatCount(missing)} CDS${missing === 1 ? ' has' : 's have'} no value for this colour `
        + 'and draw as an empty outline, never as a colour that would imply a measurement.',
    ];
    if (showHidden) {
      parts.push(`${formatCount(excluded)} excluded by the current filters keep their coordinates `
        + 'and draw grey behind the rest.');
    }
    parts.push('A source-derived function category draws as an outlined bar with a pale fill, '
      + 'never as a solid reviewed one. Shortlisted CDSs carry a dark diamond beside the bar, and '
      + 'the pinned CDS is outlined in red with a line through its band.');
    parts.push('Operon brackets from the annotation’s adjacent same-strand call, and '
      + 'Tan 2018 gene-linked start sites on the tick row above each axis, appear once the window '
      + 'is narrow enough to tell them apart, so they fill in as you zoom. The start-site '
      + 'positions were measured on this assembly and are drawn where that study published them.');
    return parts.join(' ');
  }

  renderSummaries() {
    this.markerNote.textContent = this.markerConventions();
    const primary = this.primaryTrack();
    const window = this.windowFor(primary);
    this.windowReadout.textContent = `${primary.accession} ${formatCoordinate(window.from)}–`
      + `${formatCoordinate(window.to)} of ${formatCoordinate(primary.lengthBp)} bp `
      + `(${formatBasePairs(window.to - window.from + 1)} in view) · `
      + `${formatCount(this.model.passing)} of ${formatCount(this.model.total)} plotted CDSs pass `
      + 'all filters.';

    this.trackSummaries.replaceChildren();
    for (const track of this.model.tracks) {
      const item = document.createElement('li');
      const name = document.createElement('strong');
      name.textContent = `${track.accession} · ${track.role}`;
      const facts = document.createElement('span');
      const passing = track.marks.filter((mark) => this.passes(mark)).length;
      const view = this.windowFor(track);
      const whole = view.from === 1 && view.to === track.lengthBp;
      facts.textContent = ` — ${formatCoordinate(track.lengthBp)} bp, `
        + `${formatCount(track.cdsCount)} plotted CDS${track.cdsCount === 1 ? '' : 's'}, `
        + `${formatCount(passing)} passing the current filters`
        + (track.wrapCount > 0
          ? `, ${formatCount(track.wrapCount)} crossing the circular origin`
          : '')
        + (track.primary
          ? '. Primary track; base 1 is the origin.'
          : '. Secondary track at its own scale, never concatenated onto the chromosome axis.')
        + (whole
          ? ' Showing the whole replicon.'
          : ` Showing ${formatCoordinate(view.from)}–${formatCoordinate(view.to)}.`);
      item.append(name, facts);
      this.trackSummaries.append(item);
    }
  }

  resize() {
    if (!this.model?.verified) return;
    const ratio = window.devicePixelRatio || 1;
    // The canvas, not its host: the host's border box also covers a border and
    // padding the canvas does not, and `pointerPosition` reads every pointer
    // coordinate against the canvas. Sizing the drawing from the wider box
    // stretches it past the element a click is measured on, so the mark under
    // the cursor and the mark the hit test finds drift apart across the track.
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || this.width || 0;
    if (width === 0) return;
    const height = canvasHeightFor(this.model.tracks);
    this.width = width;
    this.height = height;
    this.canvas.style.height = `${height}px`;
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  /** Bands with their layouts and scales, top to bottom. */
  bands() {
    const left = PADDING.left;
    const width = Math.max(40, this.width - PADDING.left - PADDING.right);
    const bands = [];
    let top = PADDING.top;
    for (const track of this.model.tracks) {
      const layout = bandLayout(top, track.primary ? PRIMARY_LANE_HEIGHT : SECONDARY_LANE_HEIGHT);
      const view = this.windowFor(track);
      bands.push({ track, layout, scale: repliconScale(view, left, width), window: view, left, width });
      top += layout.height + BAND_GAP;
    }
    return bands;
  }

  draw() {
    if (!this.model?.verified || !this.width) return;
    if (this.pendingFrame) return;
    this.pendingFrame = window.requestAnimationFrame(() => {
      this.pendingFrame = 0;
      this.paint();
    });
  }

  paint() {
    const ctx = this.context;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.font = '11px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.textBaseline = 'alphabetic';
    for (const band of this.bands()) {
      this.paintBand(ctx, band);
    }
    this.canvas.setAttribute('aria-label', describeChromosomeView({
      tracks: this.model.tracks,
      window: this.windowFor(this.primaryTrack()),
      colorLabel: this.model.colorLabel,
      colorScaleClause: this.model.colorScaleClause,
      passing: this.model.passing,
      total: this.model.total,
      selected: this.selectedId(),
      categoryFilterLabels: this.model.categoryFilterLabels,
    }));
  }

  selectedId() {
    const index = this.model.active >= 0 ? this.model.active
      : this.model.hovered >= 0 ? this.model.hovered : this.model.pinned;
    return index >= 0 ? this.model.genes[index]?.id ?? null : null;
  }

  paintBand(ctx, band) {
    const { track, layout, scale, window: view } = band;

    ctx.fillStyle = LABEL_COLOR;
    ctx.textAlign = 'left';
    ctx.fillText(
      fitTrackLabel((text) => ctx.measureText(text).width, track, band.width),
      band.left, layout.labelBaseline,
    );

    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(band.left, layout.axisY + 0.5);
    ctx.lineTo(band.left + band.width, layout.axisY + 0.5);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = LABEL_COLOR;
    const ticks = positionTicks(view, track.primary ? 7 : 5)
      .filter((tick) => {
        const x = scale.bpToX(tick.bp);
        return x >= band.left - 1 && x <= band.left + band.width + 1;
      });
    for (const tick of ticks) {
      const x = scale.bpToX(tick.bp);
      ctx.beginPath();
      ctx.moveTo(x, layout.bracketBelowTop + BRACKET_ROW_HEIGHT);
      ctx.lineTo(x, layout.bracketBelowTop + BRACKET_ROW_HEIGHT + 3);
      ctx.stroke();
    }
    for (const tick of fitTickLabels(ticks, {
      measure: (text) => ctx.measureText(text).width,
      x: (bp) => scale.bpToX(bp),
      left: band.left,
      right: band.left + band.width,
    })) {
      ctx.fillText(tick.label, tick.anchor, layout.tickBaseline);
    }
    ctx.textAlign = 'left';

    const marks = visibleMarks(track.marks, view);
    // Filtered-out CDSs first, so a passing gene is never buried under one.
    if (this.model.showHidden) {
      for (const mark of marks) {
        if (this.passes(mark)) continue;
        this.paintMark(ctx, band, mark, GHOST_COLOR, GHOST_BORDER);
      }
    }
    // Valued CDSs last. In category mode most loci have no reviewed or derived
    // category, and their empty outlines would otherwise bury the few that do
    // under a wash of grey at whole-genome zoom.
    const styled = marks.filter((mark) => this.passes(mark))
      .map((mark) => ({ mark, ...this.markStyle(mark) }));
    for (const entry of styled) {
      if (entry.fill !== null) continue;
      this.paintMark(ctx, band, entry.mark, entry.fill, entry.stroke);
    }
    for (const entry of styled) {
      if (entry.fill === null) continue;
      this.paintMark(ctx, band, entry.mark, entry.fill, entry.stroke);
    }

    this.paintOperons(ctx, band);
    this.paintTss(ctx, band);
    this.paintSelectionMarks(ctx, band, marks);
  }

  passes(mark) {
    return !this.model.mask || this.model.mask[mark.index] === 1;
  }

  /**
   * Fill and outline for one CDS, matching the scatter map's conventions so a
   * gene reads the same in both: a reviewed or measured value is solid, a
   * source-derived category is outlined over a pale fill, and a value the
   * release does not have is an empty outline rather than a colour that would
   * imply a measurement.
   */
  markStyle(mark) {
    const { colors } = this.model;
    const scale = colors.scale;
    const value = colors.values ? colors.values[mark.index] : NaN;
    const derived = Boolean(colors.derived && colors.derived[mark.index]);
    if (!scale) return { fill: MISSING_COLOR, stroke: MISSING_COLOR };
    if (scale.categorical) {
      const bucket = scale.bucketOf(value);
      if (bucket < 0) return { fill: null, stroke: CATEGORY_UNKNOWN_COLOR };
      const color = scale.buckets[bucket];
      return derived
        ? { fill: DERIVED_MARKER_FILL, stroke: color }
        : { fill: color, stroke: REVIEWED_MARKER_BORDER };
    }
    if (!Number.isFinite(value)) return { fill: null, stroke: MISSING_COLOR };
    const color = scale.color(value);
    return derived ? { fill: DERIVED_MARKER_FILL, stroke: color } : { fill: color, stroke: color };
  }

  laneTop(layout, mark) {
    return mark.lane === 'below' ? layout.laneBelowTop : layout.laneAboveTop;
  }

  /**
   * Draw one CDS as one rectangle per annotated piece.
   *
   * A null `fill` outlines the bar instead of filling it, which is how a value
   * the release does not have is drawn. A gap between pieces is left empty: the
   * three discontinuous CDSs really are discontinuous, and the two that cross
   * the origin get their wrap marker rather than a bar spanning the replicon.
   */
  paintMark(ctx, band, mark, fill, stroke) {
    ctx.fillStyle = fill ?? 'transparent';
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    for (const piece of mark.pieces) {
      const { left, top, width, height } = this.barRect(band, mark, piece);
      if (left + width < band.left || left > band.left + band.width) continue;
      if (fill) ctx.fillRect(left, top, width, height);
      if (!fill || width >= 3) {
        ctx.strokeRect(left + 0.5, top + 0.5, Math.max(1, width - 1), height - 1);
      }
    }
    if (mark.wraps) this.paintWrapMarker(ctx, band, mark);
  }

  /**
   * The whole rectangle one annotated piece of a CDS owns: `pieceRect`'s snapped
   * column, and the lane rows its bar fills.
   *
   * Every glyph belonging to the piece is placed on this rectangle *and clipped
   * to it*. Bounding a marker's path vertices is not enough on its own, because
   * `ctx.stroke()` centres a line on the path and extends a mitered join well
   * past the vertex it joins: on a bar about a pixel wide the chevron's tip
   * miter alone reaches a column to its left and its base miters a few rows
   * above and below. The clip is what makes "on the bar" true of the painted
   * pixels rather than only of the coordinates.
   */
  barRect(band, mark, piece) {
    const { left, width } = pieceRect(band.scale, piece);
    return {
      left,
      width,
      top: this.laneTop(band.layout, mark) + (mark.lane === 'below' ? 1 : 2),
      height: band.layout.laneHeight - 3,
    };
  }

  /**
   * The wrap marker for an origin-crossing CDS: a clipped-edge chevron on the
   * gene's own bar at each end of the replicon, pointing outward.
   *
   * It sits inside the track, on the lane, not beyond the ends of the axis: a
   * glyph hanging off the axis reads as an axis terminator rather than as this
   * gene continuing. It says the two drawn pieces are one CDS crossing the
   * coordinate boundary, without drawing a span the replicon does not have.
   *
   * Each chevron is clipped to `barRect`, the rectangle of the piece it
   * annotates. `M744_RS13620` opens with 13 bp on a 7,842 bp plasmid — about a
   * pixel at full extent — and a marker drawn at its full width would cover
   * empty track beside that bar and read as a free-floating arrowhead pointing
   * at nothing. The clip covers the fill, the outline and the outline's miters,
   * which the vertices alone do not: at that width the tip's miter is the
   * sharpest join on the canvas and spikes furthest past its vertex.
   */
  paintWrapMarker(ctx, band, mark) {
    const opening = mark.pieces.find((piece) => piece.from === 1);
    const closing = mark.pieces.find((piece) => piece.to === band.track.lengthBp);
    const ends = [];
    if (opening) ends.push({ rect: this.barRect(band, mark, opening), direction: 1 });
    if (closing) ends.push({ rect: this.barRect(band, mark, closing), direction: -1 });
    ctx.fillStyle = WRAP_MARKER_FILL;
    ctx.strokeStyle = WRAP_MARKER_STROKE;
    ctx.lineWidth = 1;
    for (const { rect, direction } of ends) {
      if (rect.left + rect.width < band.left || rect.left > band.left + band.width) continue;
      // Centred on the bar, reaching at most to its rows. The half-pixel inset
      // is the one `paintMark`'s `strokeRect` uses, so a 1 px outline lands on
      // whole rows instead of straddling two.
      const mid = rect.top + rect.height / 2;
      const reach = Math.min(WRAP_MARKER_PX, rect.height / 2 - 0.5);
      const tip = direction === 1 ? rect.left : rect.left + rect.width;
      const base = tip + direction * Math.min(WRAP_MARKER_PX, rect.width);
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect.left, rect.top, rect.width, rect.height);
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(tip, mid);
      ctx.lineTo(base, mid - reach);
      ctx.lineTo(base, mid + reach);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  paintOperons(ctx, band) {
    const { layout, scale } = band;
    ctx.strokeStyle = OPERON_COLOR;
    ctx.lineWidth = 1;
    for (const bracket of this.layers.get(band.track.accession)?.brackets ?? []) {
      const x0 = scale.bpToX(bracket.from);
      const x1 = scale.bpToX(bracket.to + 1);
      if (x1 - x0 < MIN_BRACKET_PX) continue;
      if (x1 < band.left || x0 > band.left + band.width) continue;
      const above = bracket.lane === 'above';
      const y = above ? layout.bracketAboveTop + 3 : layout.bracketBelowTop + BRACKET_ROW_HEIGHT - 3;
      const tick = above ? 4 : -4;
      ctx.beginPath();
      ctx.moveTo(x0, y + tick);
      ctx.lineTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.lineTo(x1, y + tick);
      ctx.stroke();
    }
  }

  /**
   * Tan 2018 gene-linked start sites, at the absolute positions that study
   * published on this assembly.
   *
   * Drawn only while the ticks are far enough apart to be separate ticks. At
   * whole-chromosome zoom 2,413 of them over a few hundred pixels merge into a
   * solid bar, which reads as continuous evidence across the genome rather than
   * as the discrete start sites it is.
   */
  paintTss(ctx, band) {
    const { layout, scale } = band;
    const sites = (this.layers.get(band.track.accession)?.tss ?? [])
      .filter((site) => site.position >= band.window.from && site.position <= band.window.to);
    if (sites.length * MIN_TSS_SPACING_PX > band.width) return;
    ctx.strokeStyle = TSS_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const site of sites) {
      const x = Math.round(scale.bpToX(site.position)) + 0.5;
      ctx.moveTo(x, layout.tssTop + 1);
      ctx.lineTo(x, layout.tssBottom - 1);
    }
    ctx.stroke();
  }

  paintSelectionMarks(ctx, band, marks) {
    const { layout, scale } = band;
    const { pinned, hovered, active, shortlist } = this.model;
    const outline = (mark, color, width) => {
      const top = this.laneTop(layout, mark);
      const first = mark.pieces[0];
      const last = mark.pieces[mark.pieces.length - 1];
      const x0 = scale.bpToX(first.from);
      const x1 = scale.bpToX(last.to + 1);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.strokeRect(
        Math.min(x0, x1) - 2, top - 1,
        Math.max(4, Math.abs(x1 - x0) + 4), layout.laneHeight + 1,
      );
    };
    for (const mark of marks) {
      if (!shortlist.has(mark.index)) continue;
      const top = this.laneTop(layout, mark);
      const x = scale.bpToX(mark.pieces[0].from);
      ctx.fillStyle = SHORTLIST_COLOR;
      ctx.beginPath();
      const y = mark.lane === 'below' ? top + layout.laneHeight + 2 : top - 2;
      ctx.moveTo(x, y - 3);
      ctx.lineTo(x + 3, y);
      ctx.lineTo(x, y + 3);
      ctx.lineTo(x - 3, y);
      ctx.closePath();
      ctx.fill();
    }
    for (const mark of marks) {
      if (mark.index === pinned) {
        ctx.strokeStyle = PINNED_COLOR;
        ctx.lineWidth = 1;
        const x = Math.round(scale.bpToX(mark.pieces[0].from)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, layout.tssTop);
        ctx.lineTo(x, layout.bracketBelowTop + BRACKET_ROW_HEIGHT);
        ctx.stroke();
        outline(mark, PINNED_COLOR, 2);
      }
      if (mark.index === active) outline(mark, ACTIVE_FOCUS_COLOR, 2);
      if (mark.index === hovered) outline(mark, HOVER_FOCUS_COLOR, 1.5);
    }
  }

  /** The band under a canvas y, or null between bands. */
  bandAt(y) {
    for (const band of this.bands()) {
      if (y >= band.layout.top && y <= band.layout.top + band.layout.height) return band;
    }
    return null;
  }

  /** The CDS under a canvas position, or -1. */
  hitTest(x, y) {
    const band = this.bandAt(y);
    if (!band) return -1;
    const { layout } = band;
    const above = y >= layout.laneAboveTop - 2 && y <= layout.axisY;
    const below = y >= layout.laneBelowTop && y <= layout.bracketBelowTop + 2;
    if (!above && !below) return -1;
    const lane = above ? 'above' : 'below';
    let best = -1;
    let bestDistance = Infinity;
    for (const mark of visibleMarks(band.track.marks, band.window)) {
      if (mark.lane !== lane) continue;
      if (!this.model.showHidden && !this.passes(mark)) continue;
      for (const piece of mark.pieces) {
        const x0 = band.scale.bpToX(piece.from);
        const x1 = Math.max(x0 + 2, band.scale.bpToX(piece.to + 1));
        const distance = x < x0 ? x0 - x : x > x1 ? x - x1 : 0;
        // A CDS the filters keep wins a tie against one they hide.
        const penalty = this.passes(mark) ? 0 : 3;
        if (distance <= 3 && distance + penalty < bestDistance) {
          bestDistance = distance + penalty;
          best = mark.index;
        }
      }
    }
    return best;
  }

  pointerPosition(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  bindEvents() {
    const canvas = this.canvas;
    canvas.addEventListener('pointermove', (event) => {
      if (!this.model?.verified) return;
      const { x, y } = this.pointerPosition(event);
      if (this.dragging) {
        const band = this.dragging.band;
        const delta = (this.dragging.x - x) / band.scale.perBase;
        this.windows.set(band.track.accession,
          panWindow(band.window, delta, band.track.lengthBp));
        this.dragging = { ...this.dragging, x, moved: true, band: this.rebind(band) };
        this.renderSummaries();
        this.draw();
        return;
      }
      const index = this.hitTest(x, y);
      canvas.style.cursor = index >= 0 ? 'pointer' : this.bandAt(y) ? 'grab' : 'default';
      this.handlers.onHover?.(index);
    });
    canvas.addEventListener('pointerleave', () => this.handlers.onHover?.(-1));
    canvas.addEventListener('pointerdown', (event) => {
      if (!this.model?.verified) return;
      const { x, y } = this.pointerPosition(event);
      const band = this.bandAt(y);
      if (!band) return;
      this.dragging = { x, band, moved: false, pointerId: event.pointerId };
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
    });
    const endDrag = (event) => {
      if (!this.dragging || this.dragging.pointerId !== event.pointerId) return;
      const { x, y } = this.pointerPosition(event);
      const moved = this.dragging.moved;
      this.dragging = null;
      canvas.releasePointerCapture?.(event.pointerId);
      canvas.style.cursor = 'grab';
      if (moved) return;
      const index = this.hitTest(x, y);
      if (index >= 0) {
        this.cursor = locateIndex(this.lanes, index);
        this.handlers.onSelect?.(index);
      }
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', (event) => {
      if (this.dragging?.pointerId === event.pointerId) this.dragging = null;
    });
    canvas.addEventListener('wheel', (event) => {
      if (!this.model?.verified) return;
      const { x, y } = this.pointerPosition(event);
      const band = this.bandAt(y);
      if (!band) return;
      event.preventDefault();
      this.zoomBand(band, Math.exp(-event.deltaY * 0.0016), band.scale.xToBp(x));
    }, { passive: false });
    canvas.addEventListener('dblclick', () => this.resetView());
    canvas.addEventListener('keydown', (event) => this.onKeyDown(event));
  }

  /** The same band recomputed after its window moved. */
  rebind(band) {
    return this.bands().find((next) => next.track.accession === band.track.accession) ?? band;
  }

  zoomBand(band, factor, anchorBp) {
    const next = zoomWindow(band.window, factor, anchorBp, band.track.lengthBp, MIN_WINDOW_BP);
    this.windows.set(band.track.accession, next);
    this.renderSummaries();
    this.draw();
    this.handlers.onAnnounce?.(`${band.track.accession} showing `
      + `${formatBasePairs(next.to - next.from + 1)}.`);
  }

  /** Zoom the chromosome track about its centre, for the buttons and keys. */
  zoomByCentre(factor) {
    const primary = this.primaryTrack();
    const band = this.bands().find((entry) => entry.track.accession === primary.accession);
    if (!band) return;
    this.zoomBand(band, factor, Math.round((band.window.from + band.window.to) / 2));
  }

  /**
   * Every track back to its full extent. Selections and filters are untouched.
   * A reset that comes from applying a shared link is silent, because the caller
   * announces the larger change it is part of.
   */
  resetView({ announce = true } = {}) {
    if (!this.model?.verified) {
      this.windows.clear();
      return;
    }
    for (const track of this.model.tracks) {
      this.windows.set(track.accession, fullWindow(track.lengthBp));
    }
    this.renderSummaries();
    this.draw();
    if (announce) this.handlers.onAnnounce?.('Chromosome view reset to the full replicons.');
  }

  /** Bring a gene into the chromosome window, used when it arrives from elsewhere. */
  revealIndex(index) {
    if (!this.model?.verified) return;
    const located = locateIndex(this.lanes, index);
    if (!located) return;
    const lane = this.lanes[located.laneIndex];
    const mark = lane.marks[located.markIndex];
    const track = this.model.tracks.find((entry) => entry.accession === lane.accession);
    if (!track) return;
    const view = this.windowFor(track);
    if (mark.anchorBp >= view.from && mark.anchorBp <= view.to) return;
    const span = view.to - view.from + 1;
    const from = Math.round(mark.anchorBp - (span - 1) / 2);
    this.windows.set(track.accession,
      clampWindow({ from, to: from + span - 1 }, track.lengthBp));
    this.renderSummaries();
    this.draw();
  }

  onKeyDown(event) {
    if (!this.model?.verified) return;
    const primary = this.primaryTrack();
    const directions = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    const direction = directions[event.key];
    if (direction) {
      event.preventDefault();
      if (event.shiftKey) {
        const band = this.bands().find((entry) => entry.track.primary) ?? this.bands()[0];
        const step = (band.window.to - band.window.from + 1) * 0.15;
        const delta = direction === 'left' ? -step : direction === 'right' ? step : 0;
        if (delta !== 0) {
          this.windows.set(band.track.accession,
            panWindow(band.window, delta, band.track.lengthBp));
          this.renderSummaries();
          this.draw();
        }
        return;
      }
      const allowed = (mark) => this.model.showHidden || this.passes(mark);
      const next = neighborMark(this.lanes, this.cursor, direction, allowed);
      if (!next) return;
      this.cursor = next;
      const mark = this.lanes[next.laneIndex].marks[next.markIndex];
      this.revealIndex(mark.index);
      this.draw();
      this.handlers.onPreview?.(mark.index);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.model.active >= 0) this.handlers.onSelect?.(this.model.active);
      else {
        this.handlers.onAnnounce?.('Move to a CDS with the arrow keys first, then press Enter to '
          + 'pin it.');
      }
      return;
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomByCentre(1.6);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.zoomByCentre(1 / 1.6);
    } else if (event.key === '0') {
      event.preventDefault();
      this.resetView();
    } else if (event.key.toLowerCase() === 's') {
      const target = this.model.active >= 0 ? this.model.active : this.model.pinned;
      if (target >= 0) {
        event.preventDefault();
        this.handlers.onShortlistToggle?.(target);
      }
    }
  }

  /** Move keyboard focus onto the track, for the jump-to-map control. */
  focusCanvas() {
    this.canvas?.focus({ preventScroll: true });
  }
}
