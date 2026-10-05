/**
 * The chromosome view: every plotted CDS at its coordinate on the organism's
 * genome of record.
 *
 * The replicons, the copy-number statement, and the start-site study it may
 * draw are organism facts: they come from the record handed to the constructor.
 *
 * Canvas rather than inline SVG, and for the opposite reason the gene
 * visualizer is SVG: this view draws thousands of marks and pans and zooms
 * continuously, so a DOM node per CDS could not hold a frame rate. The canvas
 * therefore carries the same accessible treatment the scatter map does — a
 * sentence-level `aria-label` rebuilt on every render, described-by
 * instructions, and keyboard navigation that announces each gene it lands on.
 *
 * Geometry and every coordinate decision live in `core/chromosome-model.js`.
 * This module only turns that model into pixels and events.
 */
import {
  MIN_WINDOW_BP, clampWindow, describeChromosomeView, describePaintOrder, formatBasePairs,
  formatCoordinate, fullWindow, locateIndex, navigationLanes, neighborMark, operonBrackets,
  panWindow, positionTicks, repliconScale, tssPositions, visibleMarks, zoomWindow,
} from '../core/chromosome-model.js';
import {
  ACTIVE_FOCUS_COLOR, CATEGORY_UNKNOWN_COLOR, DERIVED_MARKER_FILL, GHOST_BORDER, GHOST_COLOR,
  HOVER_FOCUS_COLOR, MISSING_COLOR, PINNED_COLOR, REVIEWED_MARKER_BORDER, SHORTLIST_COLOR,
} from './colors.js';
import {
  EMPHASIS_RANK, describeDrawOrder, normalizeDrawDirection, sortByPaintOrder, topByPaintOrder,
} from '../core/paint-priority.js';
import { confirmedReset } from './confirm-dialog.js';
import { syncScaleSelect } from './scale-select.js';
import { renderDrawDirection } from './draw-direction.js';
import { formatCount } from './format.js';
import { DEFAULT_ORGANISM, layerOf } from '../core/organisms.js';

export const CHROMOSOME_TAB = Object.freeze({
  id: 'chromosome',
  name: 'Chromosome',
  // The default organism's; `tabBlurb` in ui/panels.js words it per organism.
  blurb: DEFAULT_ORGANISM.copy.tabBlurbs.chromosome,
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
/**
 * Room each start-site tick needs before the row stops being separate ticks.
 * Exported so a test can pin both sides of that rule at the width it turns on.
 */
export const MIN_TSS_SPACING_PX = 3;
/**
 * Narrowest bar, in drawing units, on which the hollow source-derived style can
 * be read — and therefore the width at and above which it is drawn.
 *
 * Owner decision D1. The hollow style is a white fill inside a category-coloured
 * 1 px outline, so it needs an outline column on each side and at least one
 * column of fill between them: three. Below that `paintMark` cannot stroke a
 * filled bar at all, which is why a sub-pixel derived bar used to be its white
 * fill and nothing else — measured at whole-genome zoom as 0 of 916 to 1,634
 * derived-only columns keeping any category colour. Under the threshold a
 * derived category draws in its full category colour instead, and the hollow
 * style returns the moment a bar is wide enough to show it.
 *
 * The unit is the one `pieceRect` snaps to: a CSS pixel, which at
 * `devicePixelRatio` 2 is two device pixels. That is deliberate. The canvas
 * transform is set to the ratio, so `strokeRect`'s 1 px outline and the
 * half-pixel inset are CSS pixels too; a threshold in device pixels would be
 * compared against a width measured in something else, and two marks coincide
 * exactly only when they snap to the same CSS column.
 */
export const MIN_HOLLOW_MARK_PX = 3;

/** The clipped-edge chevron reads against any colour the bar beneath it takes. */
const WRAP_MARKER_FILL = '#ffffff';
const WRAP_MARKER_STROKE = '#1b2733';

const AXIS_COLOR = '#536774';
const LABEL_COLOR = '#4a5568';
const OPERON_COLOR = '#687583';
/** The gene visualizer's start-site colour, so one evidence layer reads as one colour. */
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

/**
 * The inclusive column range one drawn piece covers, in the unit `pieceRect`
 * snaps to: whole CSS pixels.
 *
 * `first` is the column a sub-pixel piece was snapped onto, and is the column
 * owner decision D2's majority is counted in — a piece that narrow occupies
 * exactly one, which is the case D2 exists for. A wider piece is by definition
 * not a shared-column case, and its own first column is where it is compared.
 */
export function pieceColumns(scale, piece) {
  const { left, width } = pieceRect(scale, piece);
  const first = Math.round(left);
  return { first, last: Math.max(first, Math.round(left + width) - 1) };
}

/**
 * The inclusive column range a band draws into, in the unit `pieceRect` snaps
 * to. Columns outside it are off-screen: `paintMark` skips the piece, and the
 * reader can neither see nor click it.
 */
export function drawnColumns(band) {
  return { first: Math.floor(band.left), last: Math.ceil(band.left + band.width) - 1 };
}

/**
 * Which marks land on which column of which lane: `"<lane>#<column>"` to the
 * gene indices drawn there, in coordinate order.
 *
 * This is what makes "the column shows the highest-priority gene among them"
 * measurable rather than a hope about paint order: the same grouping decides
 * owner decision D2's majority, the genes-per-column figure the view discloses,
 * and which gene a click on a shared column selects.
 *
 * `extent` is the band, and bounds the answer to the columns that band actually
 * draws into. Without it a CDS wider than the window contributes every column
 * it would span at this scale — 1,883 of them on a 564 px canvas at one
 * measured window — and the crowding figure counts columns nobody can see. The
 * clamp also drops the far piece of an origin-crossing CDS whose other piece is
 * what brought it into the window.
 *
 * @param {{bpToX: (bp: number) => number}} scale
 * @param {{index: number, lane: string, pieces: {from: number, to: number}[]}[]} marks
 * @param {{left: number, width: number}|null} extent the band, or null to leave
 *   the columns unbounded, which is what a caller measuring geometry alone wants.
 */
export function columnOccupancy(scale, marks, extent = null) {
  const bounds = extent ? drawnColumns(extent) : { first: -Infinity, last: Infinity };
  const columns = new Map();
  for (const mark of marks) {
    // Every earlier range is checked, not just the one before, so the grouping
    // does not depend on `cdsPieces` happening to sort its segments: an
    // origin-crossing CDS has one segment at each end of the replicon, and
    // dropping either would lose it from half the columns it is drawn in. A CDS
    // has at most three pieces, so this is two comparisons.
    const ranges = mark.pieces.map((piece) => pieceColumns(scale, piece));
    ranges.forEach((range, position) => {
      const first = Math.max(range.first, bounds.first);
      const last = Math.min(range.last, bounds.last);
      for (let column = first; column <= last; column += 1) {
        // One gene in a column is one gene, however many of its own segments
        // snapped onto it.
        const alreadyCounted = ranges.slice(0, position)
          .some((earlier) => column >= earlier.first && column <= earlier.last);
        if (alreadyCounted) continue;
        const key = `${mark.lane}#${column}`;
        const list = columns.get(key);
        if (list) list.push(mark.index);
        else columns.set(key, [mark.index]);
      }
    });
  }
  return columns;
}

/** The column number out of a `"<lane>#<column>"` occupancy key. */
export function columnOfKey(key) {
  return Number(key.slice(key.indexOf('#') + 1));
}

/**
 * How crowded the columns are, for the disclosure: how many are occupied, how
 * many hold more than one CDS, and the middle and worst crowding among them.
 */
export function columnCrowding(columns) {
  const sizes = [...columns.values()].map((list) => list.length).sort((a, b) => a - b);
  if (sizes.length === 0) return { occupied: 0, shared: 0, median: 0, max: 0 };
  return {
    occupied: sizes.length,
    shared: sizes.filter((size) => size > 1).length,
    median: sizes[Math.floor(sizes.length / 2)],
    max: sizes[sizes.length - 1],
  };
}

/**
 * The fill and outline one piece actually takes, given how wide it is.
 *
 * Owner decision D1 lives here and nowhere else: a source-derived category
 * narrower than {@link MIN_HOLLOW_MARK_PX} drops the hollow white fill and draws
 * in its full category colour, because at that width the hollow style is not a
 * pale marker but an unpainted white column. Everything else is drawn as
 * `markStyle` asked.
 */
export function resolveMarkPaint(style, width) {
  if (style.hollow && width < MIN_HOLLOW_MARK_PX) {
    return { fill: style.stroke, stroke: style.stroke };
  }
  return { fill: style.fill, stroke: style.stroke };
}


export class ChromosomeView {
  /**
   * @param {HTMLElement} host the tab panel, emptied and rebuilt on first use.
   * @param {{onHover: (index: number) => void, onPreview: (index: number) => void,
   *   onSelect: (index: number) => void, onShortlistToggle: (index: number) => void,
   *   onColorChange: (key: string) => void, onColorScaleChange: (scale: string) => void,
   *   onShowHiddenChange: (value: boolean) => void,
   *   onDetailJump: () => void, onAnnounce: (message: string) => void}} handlers
   * @param {{organism?: object}} [options] the record of the organism on screen.
   */
  constructor(host, handlers = {}, { organism = DEFAULT_ORGANISM } = {}) {
    this.host = host;
    this.handlers = handlers;
    this.organism = organism;
    /** The organism's start-site study, or null when it publishes none. */
    this.startSites = layerOf(organism, 'tssEvidence');
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
    // What the last paint actually drew: where each gene landed in the painted
    // order, and the figures the disclosure quotes. The hit test reads the
    // ranks so a click on a shared column answers with the gene the picture
    // shows, which is only knowable from the picture that was painted.
    this.paintRank = new Map();
    // What each drawn column ends the frame showing, keyed
    // `"<accession>#<lane>#<column>"`. A hit test reads the picture out of it
    // rather than guessing at the geometry a second time.
    this.columnShown = new Map();
    this.drawStats = { columns: null, alikeDerived: 0, reviewedDrawn: 0 };
  }

  /**
   * @param {{tracks: object[], problems: string[], verified: boolean, genes: object[],
   *   mask: Uint8Array|null, showHidden: boolean, colors: object, colorLabel: string,
   *   colorOptions: {value: string, label: string, group: string}[], colorKey: string,
   *   colorScaleControl: {options: {value: string, label: string, disabled: boolean,
   *     reason: string|null}[], value: string, disabled: boolean, reason: string|null},
   *   colorScaleClause: string, drawOnTop: string,
   *   drawDirectionControl: {options: {value: string, label: string}[], value: string,
   *     disabled: boolean, reason: string|null},
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
      // Start sites are drawn only for an organism whose record declares them.
      tss: this.startSites ? tssPositions(track, model.genes) : [],
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

    // An organism fact, so it is the organism's own sentence, or no paragraph.
    const copyNumber = document.createElement('p');
    copyNumber.className = 'panel-note';
    copyNumber.textContent = this.organism.copy.copyNumberNote ?? '';
    copyNumber.hidden = !this.organism.copy.copyNumberNote;

    this.unavailable = document.createElement('div');
    this.unavailable.className = 'chromosome-unavailable';
    this.unavailable.hidden = true;

    this.figure = document.createElement('div');
    this.figure.className = 'chromosome-figure';

    // The map toolbar's structure: Colour by and Scale on a row of their own,
    // the scale note and the colour explanation directly beneath it, and the view
    // buttons last on their own row. Flat, the row wrapped `Zoom in (+)` up
    // beside Scale at 375 px and left Colour by alone above it.
    const toolbar = document.createElement('div');
    toolbar.className = 'chromosome-toolbar';
    const fieldsRow = document.createElement('div');
    fieldsRow.className = 'chromosome-toolbar-row colour-scale-row';
    const viewRow = document.createElement('div');
    viewRow.className = 'chromosome-toolbar-row';

    const colorField = document.createElement('span');
    colorField.className = 'field-row';
    const colorLabel = document.createElement('label');
    colorLabel.htmlFor = 'chromosome-color-by';
    colorLabel.textContent = 'Colour by';
    this.colorSelect = document.createElement('select');
    this.colorSelect.id = 'chromosome-color-by';
    this.colorSelect.addEventListener('change', () => {
      this.handlers.onColorChange?.(this.colorSelect.value);
    });
    colorField.append(colorLabel, this.colorSelect);

    // Scale sits beside Colour by on their own row, reading the one shared value
    // the scatter map and the legend read.
    const scaleField = document.createElement('span');
    scaleField.className = 'field-row';
    const scaleLabel = document.createElement('label');
    scaleLabel.htmlFor = 'chromosome-color-scale';
    scaleLabel.textContent = 'Scale';
    this.colorScaleSelect = document.createElement('select');
    this.colorScaleSelect.id = 'chromosome-color-scale';
    this.colorScaleSelect.setAttribute('aria-describedby', 'chromosome-color-scale-notice');
    this.colorScaleSelect.addEventListener('change', () => {
      this.handlers.onColorScaleChange?.(this.colorScaleSelect.value);
    });
    scaleField.append(scaleLabel, this.colorScaleSelect);
    fieldsRow.append(colorField, scaleField);

    // Every reason a scale is unavailable, in visible text, because the titles
    // this view's selectors carry are unreachable without a pointer and a
    // disabled select takes no focus. `syncScaleSelect` writes it with the
    // selector, from the one control state both toolbars are handed.
    this.scaleNotice = document.createElement('p');
    this.scaleNotice.className = 'panel-note scale-notice';
    this.scaleNotice.id = 'chromosome-color-scale-notice';
    this.scaleNotice.hidden = true;

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

    viewRow.append(this.zoomIn, this.zoomOut, this.resetButton, showHiddenRow);

    this.colourHelp = document.createElement('details');
    this.colourHelp.className = 'method-help';
    this.colourHelp.id = 'chromosome-colour-help';
    this.colourHelp.hidden = true;
    const colourHelpSummary = document.createElement('summary');
    colourHelpSummary.textContent = 'Colour metric explanation';
    const colourHelpContent = document.createElement('div');
    colourHelpContent.className = 'help-content';
    this.colourHelp.append(colourHelpSummary, colourHelpContent);

    toolbar.append(fieldsRow, this.scaleNotice, this.colourHelp, viewRow);

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
    this.evidenceNote.textContent = this.organism.copy.coordinateEvidenceNote;

    // The pinned gene's sequence close-up sits at the foot of the figure, by
    // owner decision of 2026-09-30, below the tracks and their key. The app
    // mounts its own view here through `sequenceElement`, as it does the legend.
    this.sequenceHost = document.createElement('div');
    this.sequenceHost.className = 'chromosome-sequence';

    this.figure.append(toolbar, this.windowReadout, this.canvasHost,
      this.instructions, this.detailJump, this.legendHost, this.markerNote, this.trackSummaries,
      this.evidenceNote, this.sequenceHost);
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

  /** The host for the pinned gene's sequence close-up, at the foot of the figure. */
  sequenceElement() {
    return this.sequenceHost;
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
    syncScaleSelect(this.colorScaleSelect, this.model.colorScaleControl, this.scaleNotice);
    this.syncDrawDirection();
    this.showHidden.checked = showHidden;
    this.detailJump.hidden = !this.model.hasSelection;
  }

  /**
   * The **Draw on top** control and, beside it, what the picture is currently
   * doing about overlapping marks.
   *
   * Both live inside the colour explanation, which is closed in a fresh view, so
   * neither adds a row, a label, or any height to this toolbar. By owner decision
   * of 2026-09-30 that disclosure is the only visible place the ordering, the
   * per-column rule, the crowding figure and owner decision D1's notice appear;
   * the legend and the conventions note carry none of them. The sentences come
   * from `describePaintOrder`, which the canvas's accessible description also
   * calls, so the two cannot disagree about the same picture.
   *
   * Called from `syncControls` and again from `paint`, because the crowding
   * figure and D1's counts are properties of the picture that was just painted
   * and are not knowable before it. See ui/draw-direction.js.
   */
  syncDrawDirection() {
    renderDrawDirection(this.colourHelp, this.model.drawDirectionControl, {
      idPrefix: 'chromosome-draw-direction',
      onChange: (direction) => this.handlers.onDrawDirectionChange?.(direction),
      explanation: describePaintOrder(this.paintOrderFacts()),
    });
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
    // While the function categories are pending every CDS sits in the one
    // not-loaded bucket, which counts as a value above. Reporting "0 CDSs have
    // no value" would be a resolved zero beside a legend that says not loaded.
    const pendingCategories = colors.categories?.pending ?? null;
    const parts = [
      'Plus-strand CDSs sit above each axis and minus-strand CDSs below it, each drawn as one '
        + 'bar per annotated segment.',
      pendingCategories
        ? `The function categories ${pendingCategories === 'failed' ? 'could not be loaded'
          : 'are still loading'}, so every CDS draws in one neutral colour that means not `
          + 'loaded, not unknown.'
        : `${formatCount(missing)} CDS${missing === 1 ? ' has' : 's have'} no value for this colour `
          + 'and draw as an empty outline, never as a colour that would imply a measurement.',
    ];
    if (showHidden) {
      parts.push(`${formatCount(excluded)} excluded by the current filters keep their coordinates `
        + 'and draw grey behind the rest.');
    }
    // "Never as a solid reviewed one" left this sentence on 2026-09-30: under
    // owner decision D1 a sub-pixel derived bar is solid, so the claim would be
    // false at whole-genome zoom. The count of such bars is in the description
    // and the colour explanation, not here.
    parts.push('A source-derived function category draws as an outlined bar with a pale fill. '
      + 'Shortlisted CDSs carry a dark diamond beside the bar, and '
      + 'the pinned CDS is outlined in red with a line through its band.');
    // The start-site file may not have landed. Saying the sites "fill in as you
    // zoom" would then promise marks no zoom can show, and an empty tick row
    // would read as a genome with no start sites.
    const { tssPending } = this.model;
    // Read from the record rather than a field the constructor set, so the
    // sentence is right for any receiver; with no organism it is the default's.
    const study = layerOf(this.organism ?? DEFAULT_ORGANISM, 'tssEvidence')?.label;
    const brackets = 'Operon brackets from the annotation’s adjacent same-strand call appear once '
      + 'the window is narrow enough to tell them apart, so they fill in as you zoom.';
    if (!study) {
      // No start-site layer for this organism: the tick row is not mentioned,
      // because an empty one would read as a genome with no start sites.
      parts.push(brackets);
    } else if (tssPending) {
      parts.push(`${brackets} `
        + (tssPending === 'failed'
          ? `The ${study} gene-linked start sites could not be loaded, so the tick row above `
            + 'each axis is empty.'
          : `The ${study} gene-linked start sites are still loading, so the tick row above `
            + 'each axis is empty for now.'));
    } else {
      parts.push('Operon brackets from the annotation’s adjacent same-strand call, and '
        + `${study} gene-linked start sites on the tick row above each axis, appear once the window `
        + 'is narrow enough to tell them apart, so they fill in as you zoom. The start-site '
        + 'positions were measured on this assembly and are drawn where that study published them.');
    }
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
    this.paintRank = new Map();
    this.columnShown = new Map();
    this.drawStats = { columns: null, alikeDerived: 0, reviewedDrawn: 0 };
    for (const band of this.bands()) {
      this.paintBand(ctx, band);
    }
    // Written after the bands, not with the other summaries: how many CDSs
    // share a column and how many derived categories lost their hollow style
    // are properties of the picture that was just painted, at the zoom it was
    // painted at, and are not knowable before it. The disclosure and the
    // description are the two places that carry them, and they are the only two.
    this.syncDrawDirection();
    this.canvas.setAttribute('aria-label', describeChromosomeView({
      tracks: this.model.tracks,
      window: this.windowFor(this.primaryTrack()),
      colorLabel: this.model.colorLabel,
      colorScaleClause: this.model.colorScaleClause,
      passing: this.model.passing,
      total: this.model.total,
      selected: this.selectedId(),
      categoryFilterLabels: this.model.categoryFilterLabels,
      paintOrder: this.paintOrderFacts(),
      copyNumberSentence: this.organism.copy.copyNumberSentence,
    }));
  }

  /** Whether the colour channel is a category set rather than a value ramp. */
  get categoricalColor() {
    return Boolean(this.model.colors?.scale?.categorical);
  }

  /**
   * What the last paint did about overlapping marks, for the accessible
   * description: the ordering rule in words, the crowding on the primary track
   * at the zoom it was drawn at, and — while owner decision D1's full-colour
   * drawing is in effect — how many categories of each evidence kind draw alike.
   */
  paintOrderFacts() {
    const categorical = this.categoricalColor;
    return {
      categorical,
      order: describeDrawOrder({
        categorical,
        direction: this.model.drawOnTop,
        metricLabel: categorical ? null : this.model.colorLabel,
      }),
      accession: this.primaryTrack().accession,
      columns: this.drawStats.columns,
      alike: categorical && this.drawStats.alikeDerived > 0
        ? {
          derived: this.drawStats.alikeDerived,
          reviewed: this.drawStats.reviewedDrawn,
          threshold: MIN_HOLLOW_MARK_PX,
        }
        : null,
    };
  }

  /** Whether the gene at `index` passes the current filters. */
  passesIndex(index) {
    return !this.model.mask || this.model.mask[index] === 1;
  }

  /** The colour bucket a gene falls in, or -1 where it has no value. */
  colorBucketOf(index) {
    const { colors } = this.model;
    if (!colors.scale || !colors.values) return -1;
    return colors.scale.bucketOf(colors.values[index]);
  }

  /**
   * The value the selected colour reads for a gene, or NaN where the channel
   * carries no values at all. A colour with no column is not an error: the
   * shared rule's finiteness guard puts such a gene in its no-value tier.
   */
  colorValueOf(index) {
    const { values } = this.model.colors;
    return values ? values[index] : NaN;
  }

  /** Whether a gene has a value for the selected colour at all. */
  hasColorValue(index) {
    const { colors } = this.model;
    if (!colors.scale) return false;
    const value = colors.values ? colors.values[index] : NaN;
    return colors.scale.categorical ? colors.scale.bucketOf(value) >= 0 : Number.isFinite(value);
  }

  /** Whether a gene's category colour came from a derivation rather than review. */
  isDerivedCategory(index) {
    return Boolean(this.model.colors.derived && this.model.colors.derived[index]);
  }

  /** How strongly the reader has singled a gene out; see EMPHASIS_RANK. */
  emphasisOf(index) {
    const { pinned, hovered, active, shortlist } = this.model;
    if (index === pinned) return EMPHASIS_RANK.pinned;
    if (index === hovered) return EMPHASIS_RANK.hovered;
    if (index === active) return EMPHASIS_RANK.active;
    return shortlist?.has(index) ? EMPHASIS_RANK.shortlisted : EMPHASIS_RANK.none;
  }

  /**
   * The shared paint-order rule, read against this view's own state.
   *
   * Everything in the rule comes from core/paint-priority.js, which the scatter
   * maps read too. What this view supplies is its reading of the colour channel
   * and the reader's selection, and — when it is resolving one column —
   * `columnMajority`, owner decision D2's count of how many CDSs in that column
   * carry the same category.
   *
   * `members` is what makes the difference between the two questions this rule
   * answers. With no members it is the order to paint the whole band in, where
   * no column has been named yet and no majority can be counted. With the CDSs
   * drawn in one column it is that column's own answer: a CDS wider than a
   * column lies in several, whose majorities differ, so a single order over the
   * CDSs cannot be right about all of them.
   *
   * @param {number[]|null} members the gene indices drawn in the column being
   *   resolved, or null to order a band.
   */
  paintModel(members = null) {
    const model = {
      categorical: this.categoricalColor,
      direction: normalizeDrawDirection(this.model.drawOnTop),
      passes: (index) => this.passesIndex(index),
      hasValue: (index) => this.hasColorValue(index),
      valueOf: (index) => this.colorValueOf(index),
      isDerived: (index) => this.isDerivedCategory(index),
      emphasis: (index) => this.emphasisOf(index),
    };
    if (!members) return model;
    return {
      ...model,
      columnMajority: (index) => {
        const bucket = this.colorBucketOf(index);
        if (bucket < 0) return 0;
        let count = 0;
        for (const other of members) {
          if (this.passesIndex(other) && this.colorBucketOf(other) === bucket) count += 1;
        }
        return count;
      },
    };
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
    this.paintMarks(ctx, band, marks);
    this.paintOperons(ctx, band);
    this.paintTss(ctx, band);
    this.paintSelectionMarks(ctx, band, marks);
  }

  passes(mark) {
    return this.passesIndex(mark.index);
  }

  /**
   * Every CDS in this band, painted lowest priority first, and then each
   * occupied column left showing the CDS owner decision D2 names for it.
   *
   * One sort per band per frame over the visible marks, by the one rule in
   * core/paint-priority.js. Sorting rather than the old two passes is what makes
   * "the column shows the highest-priority gene among them" true of the pixels:
   * the two passes could only separate a valued CDS from an unvalued one, and
   * left the winner among the valued ones to whichever happened to start last.
   *
   * The filtered-out CDSs are in that one sort rather than in a pass of their
   * own. They are the rule's bottom tier, so they come out underneath anyway,
   * and having them in it means every drawn CDS has a paint rank — which is
   * what makes "what does this column show" answerable for a column that holds
   * nothing else.
   */
  paintMarks(ctx, band, marks) {
    const drawn = this.model.showHidden ? marks : marks.filter((mark) => this.passes(mark));
    const byIndex = new Map(drawn.map((mark) => [mark.index, mark]));
    const columns = columnOccupancy(band.scale, drawn, band);
    if (band.track.primary) this.drawStats.columns = columnCrowding(columns);

    const order = sortByPaintOrder(byIndex.keys(), this.paintModel());
    const base = this.paintRank.size;
    order.forEach((index, rank) => this.paintRank.set(index, base + rank));

    for (const index of order) {
      const mark = byIndex.get(index);
      this.paintMark(ctx, band, mark, this.markStyleFor(mark));
      this.countEvidenceDrawn(band, mark);
    }
    this.paintColumnWinners(ctx, band, columns, byIndex);
  }

  /**
   * How one CDS is drawn in this frame: the ghost treatment where the filters
   * hide it and "Show filtered-out genes" is on, its own colour otherwise.
   */
  markStyleFor(mark) {
    return this.passes(mark)
      ? this.markStyle(mark)
      : { fill: GHOST_COLOR, stroke: GHOST_BORDER, hollow: false };
  }

  /**
   * Owner decision D1's disclosure counts, for the CDS just painted.
   *
   * A derived CDS counts once if *any* segment of it that this band drew came
   * out narrower than the hollow style needs. `some`, not `every`: a CDS drawn
   * as two segments can have one wide enough for the hollow style and one not —
   * `M744_RS00920` at 1280 px has segments of 1.9 and 27.9 px — and the narrow
   * one is solid on the screen whatever the wide one does. Counting only the
   * wholly narrow CDSs left that one uncounted, which made the disclosure say
   * no derived category was drawn solid while one was.
   */
  countEvidenceDrawn(band, mark) {
    if (!this.categoricalColor || !this.passes(mark)) return;
    if (this.colorBucketOf(mark.index) < 0) return;
    if (!this.isDerivedCategory(mark.index)) {
      this.drawStats.reviewedDrawn += 1;
      return;
    }
    const solid = mark.pieces.some((piece) => {
      const { left, width } = pieceRect(band.scale, piece);
      if (left + width < band.left || left > band.left + band.width) return false;
      return width < MIN_HOLLOW_MARK_PX;
    });
    if (solid) this.drawStats.alikeDerived += 1;
  }

  /**
   * Owner decision D2, resolved for each column rather than for each CDS, and
   * painted wherever the band's own order did not already settle it.
   *
   * The majority belongs to the column, not to the CDS. A CDS drawn across
   * several columns can hold the majority category in one and be a minority in
   * the next, so there is no single number to put in a band-wide order: scoring
   * a CDS by one of its columns paints it over the others, and a column then
   * shows a category that one CDS in it carries against two that do not. Each
   * occupied column is therefore asked its own question, and the answer is
   * painted clipped to that column when it is not already on top of it.
   *
   * Nothing else in the picture moves. The clip is one column wide, the CDS is
   * drawn by the same {@link paintMark} with the same style resolved at the same
   * piece width, so the column takes exactly the pixels that CDS would have put
   * there, and its outline and wrap marker stay its own.
   */
  paintColumnWinners(ctx, band, columns, byIndex) {
    for (const [key, members] of columns) {
      const winner = topByPaintOrder(members, this.paintModel(members));
      this.columnShown.set(`${band.track.accession}#${key}`, winner);
      const painted = members.reduce((top, index) => (
        this.paintRank.get(index) > this.paintRank.get(top) ? index : top));
      if (winner === painted) continue;
      this.paintColumnSlice(ctx, band, byIndex.get(winner), columnOfKey(key));
    }
  }

  /** One CDS's bar, painted over one column only, so that column shows it. */
  paintColumnSlice(ctx, band, mark, column) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(column, band.layout.top, 1, band.layout.height);
    ctx.clip();
    this.paintMark(ctx, band, mark, this.markStyleFor(mark));
    ctx.restore();
  }

  /**
   * Fill and outline for one CDS, matching the scatter map's conventions so a
   * gene reads the same in both: a reviewed or measured value is solid, a
   * source-derived category is outlined over a pale fill, and a value the
   * release does not have is an empty outline rather than a colour that would
   * imply a measurement.
   *
   * The pale fill is returned as a request, flagged `hollow`, not as a decision.
   * Whether it survives depends on how wide the bar turns out to be, which this
   * function cannot see; {@link resolveMarkPaint} settles it per piece under
   * owner decision D1.
   */
  markStyle(mark) {
    const { colors } = this.model;
    const scale = colors.scale;
    const value = colors.values ? colors.values[mark.index] : NaN;
    const derived = Boolean(colors.derived && colors.derived[mark.index]);
    if (!scale) return { fill: MISSING_COLOR, stroke: MISSING_COLOR, hollow: false };
    if (scale.categorical) {
      const bucket = scale.bucketOf(value);
      if (bucket < 0) return { fill: null, stroke: CATEGORY_UNKNOWN_COLOR, hollow: false };
      const color = scale.buckets[bucket];
      return derived
        ? { fill: DERIVED_MARKER_FILL, stroke: color, hollow: true }
        : { fill: color, stroke: REVIEWED_MARKER_BORDER, hollow: false };
    }
    if (!Number.isFinite(value)) return { fill: null, stroke: MISSING_COLOR, hollow: false };
    const color = scale.color(value);
    return derived
      ? { fill: DERIVED_MARKER_FILL, stroke: color, hollow: true }
      : { fill: color, stroke: color, hollow: false };
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
   *
   * Each piece resolves its own paint from `style`, because a CDS drawn as two
   * pieces can have one wide enough for the hollow derived style and one not.
   */
  paintMark(ctx, band, mark, style) {
    ctx.lineWidth = 1;
    for (const piece of mark.pieces) {
      const { left, top, width, height } = this.barRect(band, mark, piece);
      if (left + width < band.left || left > band.left + band.width) continue;
      const { fill, stroke } = resolveMarkPaint(style, width);
      ctx.fillStyle = fill ?? 'transparent';
      ctx.strokeStyle = stroke;
      if (fill) ctx.fillRect(left, top, width, height);
      // A filled bar narrower than the outline needs is left unstroked: the
      // stroke would be the whole bar. That is why a hollow style has to give
      // way to a solid one below MIN_HOLLOW_MARK_PX rather than stroke anyway —
      // there is no width at which a white fill and its ring both fit.
      if (!fill || width >= MIN_HOLLOW_MARK_PX) {
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
   * Gene-linked start sites, at the absolute positions their study published
   * on this assembly.
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

  /**
   * The CDS under a canvas position, or -1.
   *
   * The bar drawn under the pointer decides, and only where none was drawn does
   * the pointer reach for a nearby one. Every occupied column ends a frame
   * showing the CDS {@link paintColumnWinners} resolved for it, across the whole
   * column, so looking that answer up *is* the containment test — and it is the
   * same answer the picture gives, by construction.
   *
   * The enlarged target below is what a 1 px bar needs to be clickable at all,
   * and it was the whole of the old answer. That let a bar in column *c* sit at
   * distance zero from a pointer in column *c+1*: wherever the neighbour ranked
   * higher it won the click inside a bar the reader could see, on 166 of 787
   * shared columns at 1440 px. Reaching out of a column only when that column
   * drew nothing keeps the reach and drops the theft.
   */
  hitTest(x, y) {
    const band = this.bandAt(y);
    if (!band) return -1;
    const { layout } = band;
    const above = y >= layout.laneAboveTop - 2 && y <= layout.axisY;
    const below = y >= layout.laneBelowTop && y <= layout.bracketBelowTop + 2;
    if (!above && !below) return -1;
    const lane = above ? 'above' : 'below';
    const shown = this.columnShown.get(`${band.track.accession}#${lane}#${Math.floor(x)}`);
    if (shown !== undefined) return shown;
    let best = -1;
    let bestDistance = Infinity;
    let bestRank = -1;
    for (const mark of visibleMarks(band.track.marks, band.window)) {
      if (mark.lane !== lane) continue;
      // Only a CDS this frame painted can take a click, and having a paint rank
      // is exactly what that means: with "Show filtered-out genes" off, the
      // ghosts were never drawn and are not there to be reached.
      //
      // Where two CDSs are then the same distance from the pointer, the one the
      // picture shows wins. Every other CDS stays reachable by the arrow keys
      // and by zooming in.
      const rank = this.paintRank.get(mark.index);
      if (rank === undefined) continue;
      for (const piece of mark.pieces) {
        // Measured against the rectangle the piece was drawn into, not against
        // its unsnapped coordinates. Four CDSs snapped onto one column are one
        // column to the reader, and sub-pixel differences between their true
        // coordinates would otherwise decide the click while the picture had
        // already decided something else.
        const { left, width } = pieceRect(band.scale, piece);
        const x0 = left;
        const x1 = Math.max(x0 + 2, left + width);
        const distance = x < x0 ? x0 - x : x > x1 ? x - x1 : 0;
        // A CDS the filters keep wins a tie against one they hide.
        const penalty = this.passes(mark) ? 0 : 3;
        if (distance > 3) continue;
        const score = distance + penalty;
        if (score < bestDistance || (score === bestDistance && rank > bestRank)) {
          bestDistance = score;
          bestRank = rank;
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
