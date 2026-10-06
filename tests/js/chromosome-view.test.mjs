import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHROMOSOME_TAB, ChromosomeView, MIN_HOLLOW_MARK_PX, MIN_TSS_SPACING_PX, bandLayout,
  canvasHeightFor, columnCrowding, columnOccupancy, columnOfKey, drawnColumns, fitTickLabels,
  fitTrackLabel, pieceColumns, pieceRect, resolveMarkPaint, trackLabelVariants,
} from '../../site/js/ui/chromosome-view.js';
import { describePaintOrder, repliconTracks } from '../../site/js/core/chromosome-model.js';
import {
  DERIVED_MARKER_FILL, buildCategoryColorScale, buildColorScale,
} from '../../site/js/ui/colors.js';
import {
  valueScaleAvailability, valueScaleClause, valueScaleTransform,
} from '../../site/js/core/value-scales.js';
import { CATEGORICAL_SCALE_REASON, scaleControlState } from '../../site/js/ui/scale-select.js';
import { drawDirectionControlState } from '../../site/js/ui/draw-direction.js';
import { resetConfirmDialogForTests } from '../../site/js/ui/confirm-dialog.js';
import { organismById } from '../../site/js/core/organisms.js';

const CHROMOSOME = 'NZ_CP006471.1';
const PLASMID_B = 'NZ_CP006472.1';
const PLASMID_C = 'NZ_CP006473.1';
const META = { genome: { accession: 'GCF_000817325.1', taxid: 1350461, totalLength: 2744626 } };
const CANVAS_WIDTH = 900;
/**
 * What the host's 1px border and 0.25rem padding add on each side, per the
 * stylesheet. The host is therefore wider than the canvas inside it, and a
 * fake that gave the two boxes the same width could not tell a drawing sized
 * from the right element from one sized from the wrong one.
 */
const HOST_CHROME = 10;
const DEVICE_PIXEL_RATIO = 2;
/**
 * The viewport the fake DOM currently reports. The canvas's own CSS width is
 * what every pointer coordinate is measured against and what the backing store
 * has to match, so tests that vary it are what hold that agreement at more than
 * one width.
 */
const stage = { canvasWidth: CANVAS_WIDTH, devicePixelRatio: DEVICE_PIXEL_RATIO };

/** No clip in effect: every paint call starts able to reach the whole canvas. */
const UNCLIPPED = {
  left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity,
};

/** The box a path covers, grown on every side by a stroke's own allowance. */
function pathBox(path, grow) {
  if (path.length === 0) return { left: 0, top: 0, right: 0, bottom: 0 };
  const xs = path.map((point) => point.x);
  const ys = path.map((point) => point.y);
  return {
    left: Math.min(...xs) - grow,
    top: Math.min(...ys) - grow,
    right: Math.max(...xs) + grow,
    bottom: Math.max(...ys) + grow,
  };
}

function intersectBoxes(a, b) {
  return {
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  };
}

/**
 * A DOM and canvas context just wide enough for this view, recording every draw
 * call so the geometry can be asserted. Anything the view touches that is not
 * modelled here throws, so a new DOM dependency fails loudly.
 */
class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.attributes = {};
    this.listeners = new Map();
    this.style = {};
    this.className = '';
    this.hidden = false;
    this.value = '';
    this.checked = false;
    this.focused = false;
  }

  append(...children) {
    for (const child of children) {
      child.parent = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }

  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  dispatch(name, event = {}) { this.listeners.get(name)?.(event); }
  focus() { this.focused = true; }
  setPointerCapture() {}
  releasePointerCapture() {}
  getBoundingClientRect() {
    const width = this.className === 'chromosome-canvas-host'
      ? stage.canvasWidth + HOST_CHROME : stage.canvasWidth;
    // The view sets the canvas's CSS height itself, so that box always matches
    // the drawing. Only the width comes from the layout.
    return { left: 0, top: 0, width, height: Number.parseFloat(this.style.height) || 400 };
  }

  getContext() {
    if (this.tagName !== 'canvas') throw new Error(`getContext on <${this.tagName}>`);
    this.ops = [];
    const record = (op) => this.ops.push(op);
    // The current path, the clip stack, and the region each paint call can
    // actually put pixels in. Vertices alone do not say what a canvas paints:
    // `stroke()` centres the line on the path and a miter runs past its vertex
    // by up to `miterLimit` line widths, so the painted region is the path box
    // grown by that allowance and then cut to the clip. A test that wants "no
    // pixel outside this rectangle" has to assert on that region.
    let path = [];
    const clips = [UNCLIPPED];
    const clip = () => clips[clips.length - 1];
    const context = {
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
      miterLimit: 10,
      clearRect: () => record({ op: 'clear' }),
      // The clip in force is recorded with the rectangle, because a paint that
      // is entirely outside it puts no pixel anywhere: the view repaints one
      // column of a bar by clipping to that column, and a test asking "what is
      // the last thing painted here" has to know which calls reached it.
      fillRect: (x, y, w, h) => record({
        op: 'fillRect', x, y, w, h, fill: context.fillStyle, clipBox: clip(),
      }),
      strokeRect: (x, y, w, h) => record({
        op: 'strokeRect', x, y, w, h, stroke: context.strokeStyle, clipBox: clip(),
      }),
      fillText: (text, x, y) => record({ op: 'text', text, x, y }),
      beginPath: () => { path = []; record({ op: 'beginPath' }); },
      closePath: () => record({ op: 'closePath' }),
      moveTo: (x, y) => { path.push({ x, y }); record({ op: 'moveTo', x, y }); },
      lineTo: (x, y) => { path.push({ x, y }); record({ op: 'lineTo', x, y }); },
      rect: (x, y, w, h) => {
        path.push({ x, y }, { x: x + w, y: y + h });
        record({ op: 'rect', x, y, w, h });
      },
      save: () => { clips.push(clip()); record({ op: 'save' }); },
      restore: () => { clips.pop(); record({ op: 'restore' }); },
      clip: () => {
        clips[clips.length - 1] = intersectBoxes(clip(), pathBox(path, 0));
        record({ op: 'clip', box: clip() });
      },
      stroke: () => record({
        op: 'stroke',
        stroke: context.strokeStyle,
        bounds: intersectBoxes(clip(),
          pathBox(path, (context.lineWidth / 2) * Math.max(1, context.miterLimit))),
      }),
      fill: () => record({
        op: 'fill',
        fill: context.fillStyle,
        bounds: intersectBoxes(clip(), pathBox(path, 0)),
      }),
      setTransform: () => record({ op: 'setTransform' }),
      // A stand-in metric: canvas text measurement is not available in Node, and
      // the layout only needs a width that grows with the string.
      measureText: (text) => ({ width: text.length * 6 }),
    };
    return context;
  }

  /** Every descendant matching a predicate, depth first. */
  find(predicate) {
    const out = [];
    const walk = (node) => {
      for (const child of node.children ?? []) {
        if (predicate(child)) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }

  text() {
    if (this.children.length === 0) return this.textContent ?? '';
    return this.children.map((child) => child.text?.() ?? '').join(' ');
  }
}

function install({ canvasWidth = CANVAS_WIDTH, devicePixelRatio = DEVICE_PIXEL_RATIO } = {}) {
  stage.canvasWidth = canvasWidth;
  stage.devicePixelRatio = devicePixelRatio;
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    ResizeObserver: globalThis.ResizeObserver,
  };
  const frames = [];
  let frameId = 0;
  const document = {
    activeElement: null,
    body: new FakeElement('body'),
    createElement: (name) => new FakeElement(name),
    createElementNS: (_ns, name) => new FakeElement(name),
  };
  globalThis.document = document;
  // The reset confirmation builds one dialog and keeps it; a dialog built
  // against a document a previous test threw away must not be reused here.
  resetConfirmDialogForTests();
  // `requestAnimationFrame` must return its id *before* the callback runs, as a
  // browser does; running it inline would leave the view's pending-frame handle
  // set forever and silently suppress every later redraw.
  globalThis.window = {
    devicePixelRatio,
    requestAnimationFrame: (callback) => {
      frames.push(callback);
      frameId += 1;
      return frameId;
    },
  };
  globalThis.ResizeObserver = class {
    observe() {}

    disconnect() {}
  };
  return {
    document,
    restore: () => {
      resetConfirmDialogForTests();
      stage.canvasWidth = CANVAS_WIDTH;
      stage.devicePixelRatio = DEVICE_PIXEL_RATIO;
      Object.assign(globalThis, previous);
    },
    frames,
  };
}

/**
 * Where a drawing-space x lands on screen, in the coordinates a pointer event
 * reports.
 *
 * The canvas holds a bitmap `canvas.width / devicePixelRatio` drawing units
 * wide and the stylesheet stretches it across the element's own width, so the
 * two only agree when the drawing was measured on the canvas. A pointer always
 * reports the element's coordinates, which is why this conversion is what the
 * reader's click actually goes through.
 */
function onScreenX(canvas, x) {
  const drawn = canvas.width / stage.devicePixelRatio;
  return (x * canvas.getBoundingClientRect().width) / drawn;
}

/** The open reset confirmation's backdrop and its two buttons. */
function confirmParts(document) {
  const backdrop = document.body.children.find((node) => node.className === 'confirm-backdrop');
  if (!backdrop) return null;
  const [cancel, confirm] = backdrop.find((node) => node.tagName === 'button');
  return { backdrop, cancel, confirm };
}

/** Let the awaited confirmation settle before asserting on what it did. */
const settled = () => new Promise((resolve) => { setTimeout(resolve, 0); });

function gene(overrides) {
  return {
    id: 'M744_RS00005',
    name: null,
    product: 'metallophosphoesterase',
    seqid: CHROMOSOME,
    start: 32,
    end: 799,
    strand: '+',
    cdsSegments: null,
    operonId: null,
    operonSize: null,
    cai: 0.5,
    ...overrides,
  };
}

const GENES = [
  gene({ id: 'PLUS', start: 100000, end: 101000, strand: '+', cai: 0.9 }),
  gene({ id: 'MINUS', start: 200000, end: 201000, strand: '-', cai: 0.2 }),
  gene({ id: 'NOVALUE', start: 300000, end: 301000, strand: '+', cai: null }),
  gene({
    id: 'OP1', start: 400000, end: 402000, strand: '+', operonId: 'op_1', operonSize: 2, cai: 0.4,
  }),
  gene({
    id: 'OP2', start: 402100, end: 404000, strand: '+', operonId: 'op_1', operonSize: 2, cai: 0.4,
  }),
  gene({
    id: 'M744_RS13290',
    seqid: PLASMID_B,
    start: 1,
    end: 46366,
    strand: '-',
    cdsSegments: [[45877, 46366], [1, 2510]],
    cai: 0.6,
  }),
  gene({
    id: 'M744_RS13620',
    seqid: PLASMID_C,
    start: 1,
    end: 7842,
    strand: '+',
    cdsSegments: [[7830, 7842], [1, 281]],
    cai: 0.7,
  }),
];

/** The CAI column, as app.js reads one out of the dataset. */
function colorValues(genes) {
  return Float64Array.from(genes.map((row) => (row.cai === null ? NaN : row.cai)));
}

/**
 * The colour channel app.js hands this view, built the way app.js builds it: the
 * ramp and the Scale control are derived from one column and one chosen scale,
 * so a fixture cannot describe a state the application could not produce.
 */
function colorModel(genes, { colorScale, categorical, categoryOf, derivedOf }) {
  const values = colorValues(genes);
  if (categorical) {
    const bucket = categoryOf ?? ((_row, index) => index % 2);
    return {
      values: Float64Array.from(genes.map((row, index) => bucket(row, index))),
      scale: buildCategoryColorScale(2),
      // The same shape app.js passes: one flag per gene saying its category came
      // from a derivation rather than from lab review.
      derived: Uint8Array.from(genes.map((row, index) => (derivedOf?.(row, index) ? 1 : 0))),
      label: 'Function category',
      categorical: true,
    };
  }
  return {
    values,
    scale: buildColorScale(values, {
      scale: 'sequential', transform: valueScaleTransform(colorScale, values),
    }),
    derived: null,
    label: 'CAI',
    categorical: false,
    valueScale: colorScale,
  };
}

/**
 * The Scale control state app.js hands this view: `scaleControlState` itself,
 * over the availability of the very column the ramp above was built from. The
 * map toolbar is pointed at the same call, so what this fixture asserts is the
 * application's own decision and not a restatement of it.
 */
function scaleControl(genes, { colorScale, categorical }) {
  if (categorical) {
    return scaleControlState({ categorical: true, scale: null, availability: null });
  }
  const values = colorValues(genes);
  return scaleControlState({
    categorical: false,
    scale: colorScale,
    availability: valueScaleAvailability(values, { label: 'CAI' }),
  });
}

/** The same genes with one negative CAI, which is what blocks a square root. */
const NEGATIVE_CAI_GENES = GENES.map(
  (row, index) => (index === 0 ? { ...row, cai: -0.1 } : row),
);

/**
 * The whole model `app.js` hands `update`, so a test that re-points the view at
 * another colour passes the same shape the application passes and not a partial
 * one patched over the last render.
 */
function viewModel({
  genes = GENES, meta = META, mask = null, showHidden = true,
  categoryFilterLabels = [], colorScale = 'log10', categorical = false,
  drawOnTop = 'highest', pinned = -1, hovered = -1, active = -1, shortlist = new Set(),
  categoryOf = null, derivedOf = null,
} = {}) {
  const colorMode = { colorScale, categorical, categoryOf, derivedOf };
  const colors = colorModel(genes, colorMode);
  const { tracks, problems, verified } = repliconTracks(genes, meta);
  return {
    tracks,
    problems,
    verified,
    genes,
    mask,
    showHidden,
    colors,
    colorLabel: categorical ? 'Function category' : 'CAI',
    colorOptions: [
      { group: 'Reviewed function', value: 'functionCategory', label: 'Function category' },
      { group: 'Codon adaptation', value: 'cai', label: 'CAI' },
    ],
    colorKey: categorical ? 'functionCategory' : 'cai',
    colorScaleControl: scaleControl(genes, colorMode),
    // Read off the model's own scale by the same call `app.js` makes, so a fixture
    // cannot describe the ramp as logarithmic while building a linear one.
    colorScaleClause: colors.categorical ? null : valueScaleClause(colors.valueScale),
    drawOnTop,
    // Built by the application's own call, so a fixture cannot offer the view a
    // control state the application would never hand it.
    drawDirectionControl: drawDirectionControlState({ categorical }, drawOnTop),
    pinned,
    hovered,
    active,
    shortlist,
    passing: genes.length,
    total: genes.length,
    categoryFilterLabels,
    hasSelection: false,
  };
}

function mount({ handlers = {}, viewport = undefined, ...modelOptions } = {}) {
  const fake = install(viewport);
  const { restore, frames } = fake;
  const host = new FakeElement('div');
  const view = new ChromosomeView(host, handlers);
  const model = viewModel(modelOptions);
  /** Run the queued frames and return only the draw calls they made. */
  const flush = () => {
    if (view.canvas?.ops) view.canvas.ops.length = 0;
    const queued = frames.splice(0, frames.length);
    for (const frame of queued) frame();
    return view.canvas?.ops ?? [];
  };
  view.update(model);
  const ops = flush();
  return { host, view, tracks: model.tracks, restore, flush, ops, document: fake.document };
}

/**
 * The sentences inside the collapsed colour explanation, beside the **Draw on
 * top** control — which by owner decision of 2026-09-30 is the only visible place
 * the ordering, the per-column rule, the crowding figure and owner decision D1's
 * notice appear. The legend and the conventions note carry none of them.
 */
function disclosureText(view) {
  const field = view.colourHelp.children.find((node) => node.className === 'draw-direction');
  const state = field.find((node) => String(node.className).includes('draw-direction-state'))[0];
  return state.children.map((node) => node.textContent).join(' ');
}

test('the tab descriptor is frozen and carries the permanent chromosome id', () => {
  assert.equal(CHROMOSOME_TAB.id, 'chromosome');
  assert.equal(CHROMOSOME_TAB.name, 'Chromosome');
  assert.ok(Object.isFrozen(CHROMOSOME_TAB));
  assert.ok(CHROMOSOME_TAB.blurb.length > 0);
  assert.ok(CHROMOSOME_TAB.source.length > 0);
});

test('a band reserves both strand lanes around one axis, in drawing order', () => {
  const layout = bandLayout(10, 17);
  assert.ok(layout.top < layout.tssTop);
  assert.ok(layout.tssTop < layout.bracketAboveTop);
  assert.ok(layout.bracketAboveTop < layout.laneAboveTop);
  assert.ok(layout.laneAboveTop < layout.axisY);
  assert.ok(layout.axisY < layout.laneBelowTop);
  assert.ok(layout.laneBelowTop < layout.bracketBelowTop);
  assert.ok(layout.bracketBelowTop < layout.tickBaseline);
  assert.equal(layout.axisY - layout.laneAboveTop, 17);
  assert.equal(layout.bracketBelowTop - layout.laneBelowTop, 17);
  assert.equal(layout.top + layout.height > layout.tickBaseline, true);
});

test('the canvas is tall enough for every track, chromosome first', () => {
  const { tracks, restore } = mount();
  try {
    const height = canvasHeightFor(tracks);
    const sum = tracks.reduce((total, track) => total
      + bandLayout(0, track.primary ? 17 : 13).height, 0);
    assert.ok(height > sum);
    assert.equal(tracks.length, 3);
  } finally {
    restore();
  }
});

test('three bands stack without overlapping, chromosome on top', () => {
  const { view, restore } = mount();
  try {
    const bands = view.bands();
    assert.deepEqual(bands.map((band) => band.track.accession),
      [CHROMOSOME, PLASMID_B, PLASMID_C]);
    assert.equal(bands[0].track.primary, true);
    for (let i = 1; i < bands.length; i += 1) {
      const previous = bands[i - 1].layout;
      assert.ok(bands[i].layout.top > previous.top + previous.height,
        'each band starts below the one above it');
    }
  } finally {
    restore();
  }
});

test('each track scales to its own replicon, so no plasmid coordinate lands on the chromosome axis', () => {
  const { view, restore } = mount();
  try {
    const [chromosome, plasmidB, plasmidC] = view.bands();
    // Every track starts at the same left edge and ends at the same right edge:
    // three independent axes, not one concatenated coordinate line.
    for (const band of [chromosome, plasmidB, plasmidC]) {
      assert.equal(band.scale.bpToX(1), 16);
      assert.ok(Math.abs(band.scale.bpToX(band.track.lengthBp + 1) - (16 + band.width)) < 1e-6);
    }
    // 7,842 bp is the whole of the smallest plasmid and a sliver of the chromosome.
    assert.ok(plasmidC.scale.perBase > chromosome.scale.perBase * 300);
    assert.ok(plasmidB.scale.perBase > chromosome.scale.perBase * 50);
  } finally {
    restore();
  }
});

test('plus-strand CDSs draw above the axis and minus-strand CDSs below it', () => {
  const { view, restore } = mount();
  try {
    const band = view.bands()[0];
    const rects = view.canvas.ops.filter((op) => op.op === 'fillRect');
    const plus = band.scale.bpToX(100000);
    const minus = band.scale.bpToX(200000);
    const plusRect = rects.find((rect) => Math.abs(rect.x - plus) < 0.5);
    const minusRect = rects.find((rect) => Math.abs(rect.x - minus) < 0.5);
    assert.ok(plusRect, 'the plus-strand CDS is drawn');
    assert.ok(minusRect, 'the minus-strand CDS is drawn');
    assert.ok(plusRect.y + plusRect.h <= band.layout.axisY);
    assert.ok(minusRect.y >= band.layout.axisY);
  } finally {
    restore();
  }
});

test('a CDS with no value for the colour metric is outlined, and drawn behind the rest', () => {
  const { view, restore, ops } = mount();
  try {
    const band = view.bands()[0];
    const x = band.scale.bpToX(300000);
    const fills = ops.filter((op) => op.op === 'fillRect' && Math.abs(op.x - x) < 0.5);
    const strokes = ops.filter((op) => op.op === 'strokeRect' && Math.abs(op.x - x - 0.5) < 0.5);
    assert.equal(fills.length, 0, 'a missing value is not painted as a measurement');
    assert.equal(strokes.length, 1);
    // The empty outline is painted before every coloured bar on its track, so a
    // wash of them cannot bury the CDSs that do carry a value.
    const lane = band.layout.laneAboveTop + 2;
    const painted = ops.filter((op) => (op.op === 'strokeRect' || op.op === 'fillRect')
      && Math.abs(op.y - lane) <= 0.5);
    assert.equal(painted[0].op, 'strokeRect');
    assert.ok(Math.abs(painted[0].x - x - 0.5) < 0.5);
  } finally {
    restore();
  }
});

test('an origin-crossing CDS draws its two segments inside the replicon, with a wrap marker', () => {
  const { view, restore } = mount();
  try {
    const plasmid = view.bands()[1];
    const right = plasmid.left + plasmid.width;
    const laneTop = plasmid.layout.laneBelowTop;
    const rects = view.canvas.ops.filter((op) => op.op === 'fillRect'
      && op.y >= laneTop && op.y < plasmid.layout.bracketBelowTop);
    assert.equal(rects.length, 2, 'both annotated segments are drawn');
    for (const rect of rects) {
      assert.ok(rect.x >= plasmid.left - 0.001, 'no segment starts left of the origin');
      assert.ok(rect.x + rect.w <= right + 0.001, 'no segment runs past the replicon length');
    }
    // One piece against the origin, one against the far end: not one bar
    // spanning the whole plasmid.
    const widths = rects.map((rect) => rect.w).sort((a, b) => a - b);
    assert.ok(widths[1] < plasmid.width * 0.9);
    // A clipped-edge chevron on the bar at each end, inside the track: a glyph
    // hanging off the axis would read as an axis terminator instead. Its rows
    // come from the bar the view actually drew, so the chevron is checked
    // against that rectangle rather than against a second copy of the formula.
    const mid = rects[0].y + rects[0].h / 2;
    const tips = view.canvas.ops.filter((op) => op.op === 'moveTo' && Math.abs(op.y - mid) < 0.001);
    assert.equal(tips.length, 2, 'one chevron at each end of the replicon');
    assert.ok(Math.abs(tips[0].x - plasmid.left) < 0.001);
    assert.ok(Math.abs(tips[1].x - right) < 0.001);
    const reach = Math.min(5, rects[0].h / 2 - 0.5);
    const chevronPoints = view.canvas.ops.filter((op) => op.op === 'lineTo'
      && Math.abs(Math.abs(op.y - mid) - reach) < 0.001);
    assert.equal(chevronPoints.length, 4);
    for (const point of chevronPoints) {
      assert.ok(point.x >= plasmid.left - 0.001 && point.x <= right + 0.001,
        'the chevron stays inside the track');
    }
    // Two ends each, for the one wrapping CDS on each of the two plasmids.
    assert.equal(view.canvas.ops.filter((op) => op.op === 'closePath').length, 4);
  } finally {
    restore();
  }
});

/**
 * `M744_RS13620` opens with 13 bp of a 7,842 bp plasmid, about a pixel at full
 * extent. A chevron drawn at its own full width would cover empty track beside
 * that bar and read as a free-floating arrowhead pointing at nothing, so it is
 * clipped to the piece it annotates.
 */
test('a wrap chevron on a sub-pixel segment is clipped to that segment', () => {
  const { view, restore } = mount();
  try {
    const plasmid = view.bands()[2];
    assert.equal(plasmid.track.accession, PLASMID_C);
    const laneTop = plasmid.layout.laneAboveTop;
    const bars = view.canvas.ops.filter((op) => op.op === 'fillRect'
      && op.y >= laneTop && op.y < plasmid.layout.axisY);
    assert.equal(bars.length, 2, 'both annotated segments are drawn');
    const closing = bars.reduce((a, b) => (a.x > b.x ? a : b));
    assert.ok(closing.w < 5, 'the 13 bp segment really is narrower than a full-width marker');
    const mid = closing.y + closing.h / 2;
    const reach = Math.min(5, closing.h / 2 - 0.5);

    const tips = view.canvas.ops.filter((op) => op.op === 'moveTo' && Math.abs(op.y - mid) < 0.001);
    const bases = view.canvas.ops.filter((op) => op.op === 'lineTo'
      && Math.abs(Math.abs(op.y - mid) - reach) < 0.001);
    assert.equal(tips.length, 2, 'one chevron at each end of the replicon');
    assert.equal(bases.length, 4);
    const outer = Math.max(...tips.map((tip) => tip.x));
    assert.ok(Math.abs(outer - (closing.x + closing.w)) < 0.001,
      'the outer chevron tips at the bar’s own outer edge');
    // Every point of that chevron is on the bar. Drawn at its full width it
    // would reach about four pixels left of the bar, over empty track.
    const outerHalf = plasmid.left + plasmid.width / 2;
    for (const point of [...tips, ...bases].filter((point) => point.x > outerHalf)) {
      assert.ok(point.x >= closing.x - 0.001 && point.x <= closing.x + closing.w + 0.001,
        'no part of the chevron is drawn beside its segment');
    }

    // Bounding the vertices is not bounding the paint. `ctx.stroke()` centres
    // its line on the path and a miter overshoots its vertex, so on a bar this
    // narrow the tip's join alone spikes a column to the left and several rows
    // above and below. These are the regions the fake reports as reachable —
    // path box plus the stroke's own allowance, cut to the clip in force — and
    // they have to sit inside the bar's own rectangle.
    // Located by the chevron's own tip, not by the clip, so that a clip which is
    // present but too generous fails on the bounds below rather than hiding.
    const ops = view.canvas.ops;
    const tip = ops.findIndex((op) => op.op === 'moveTo'
      && Math.abs(op.x - outer) < 0.001 && Math.abs(op.y - mid) < 0.001);
    assert.ok(tip > 0, 'the outer chevron is drawn');
    const end = ops.findIndex((op, i) => i > tip && op.op === 'restore');
    const block = ops.slice(ops.slice(0, tip).map((op) => op.op).lastIndexOf('save'), end);
    const painted = block.filter((op) => op.op === 'fill' || op.op === 'stroke');
    assert.equal(painted.length, 2, 'the outer chevron is filled and outlined');
    for (const op of painted) {
      assert.ok(op.bounds.left >= closing.x - 0.001 && op.bounds.right <= closing.x + closing.w + 0.001,
        `${op.op} reaches x ${op.bounds.left}–${op.bounds.right}, outside the bar`);
      assert.ok(op.bounds.top >= closing.y - 0.001 && op.bounds.bottom <= closing.y + closing.h + 0.001,
        `${op.op} reaches y ${op.bounds.top}–${op.bounds.bottom}, outside the bar`);
    }
    assert.ok(block.some((op) => op.op === 'clip'),
      'and it is a clip that bounds them, not a coincidence of the vertices');
  } finally {
    restore();
  }
});

test('the accessible description names the selected function categories', () => {
  const { view, restore } = mount({
    categoryFilterLabels: ['Stress and repair', 'Transport and envelope'],
  });
  try {
    // A screen-reader user has this sentence and nothing else, so a count of
    // selected categories would leave out the only thing the filter changed.
    assert.match(view.canvas.getAttribute('aria-label'),
      /2 function categories are selected: Stress and repair; Transport and envelope\./);
  } finally {
    restore();
  }
});

test('an operon bracket is drawn once its members are wide enough to read', () => {
  const { view, restore, flush, ops } = mount();
  try {
    // At whole-chromosome zoom a 4 kb operon is a pixel wide, so no bracket is
    // drawn rather than a smear that would read as one.
    const band = view.bands()[0];
    const bracketY = band.layout.bracketAboveTop + 3 + 4;
    assert.equal(ops.filter((op) => op.op === 'moveTo' && Math.abs(op.y - bracketY) < 0.001).length, 0);

    view.zoomBand(band, 400, 402000);
    const frame = flush();
    const zoomed = view.bands()[0];
    const drawn = frame.filter((op) => op.op === 'moveTo'
      && Math.abs(op.y - (zoomed.layout.bracketAboveTop + 3 + 4)) < 0.001);
    assert.equal(drawn.length, 1, 'the operon bracket appears at a legible width');
    assert.ok(Math.abs(drawn[0].x - zoomed.scale.bpToX(400000)) < 0.5,
      'the bracket starts at the first member, not at a promoter it cannot know');
    // It ends at the last member's final base, not at the wider gene span.
    const ends = frame.filter((op) => op.op === 'lineTo'
      && Math.abs(op.y - zoomed.layout.bracketAboveTop - 3) < 0.001);
    assert.ok(ends.some((op) => Math.abs(op.x - zoomed.scale.bpToX(404001)) < 0.5));
  } finally {
    restore();
  }
});

test('start-site ticks appear only once they are separate ticks, not a solid bar', () => {
  const genes = [];
  for (let i = 0; i < 600; i += 1) {
    genes.push(gene({
      id: `T${i}`,
      start: 1000 + i * 4000,
      end: 1500 + i * 4000,
      tssEvidence: [{
        id: `gTSS+${1000 + i * 4000}`,
        replicon: 'CP006471',
        strand: '+',
        position: 1000 + i * 4000,
        sourceStartDistanceNt: 10,
      }],
    }));
  }
  const { view, restore, flush, ops } = mount({ genes });
  try {
    const band = view.bands()[0];
    const tssRow = (frame) => frame.filter((op) => op.op === 'moveTo'
      && Math.abs(op.y - (band.layout.tssTop + 1)) < 0.001);
    assert.equal(tssRow(ops).length, 0,
      '600 sites across 868 pixels would merge into a continuous bar');
    view.zoomBand(band, 40, 1000000);
    assert.ok(tssRow(flush()).length > 0, 'zoomed in, the individual sites are drawn');
  } finally {
    restore();
  }
});

/** One gene per start site, so `count` ticks land in the chromosome's full window. */
function tickGenes(count) {
  return Array.from({ length: count }, (_, i) => {
    const position = 1000 + i * 1000;
    return gene({
      id: `T${i}`,
      start: position,
      end: position + 200,
      tssEvidence: [{
        id: `gTSS+${position}`,
        replicon: 'CP006471',
        strand: '+',
        position,
        sourceStartDistanceNt: 10,
      }],
    });
  });
}

test('the start-site row is drawn while every tick fits, and dropped one tick past that', () => {
  // The previous test holds the two ends of the rule, a whole chromosome against
  // a zoomed window. This one holds the threshold itself, which is the band's own
  // width over the room one tick needs, so the width is measured rather than
  // assumed and the two mounts sit either side of the count it allows. Both sides
  // are what pin the constant: a smaller spacing would draw the crowded row, a
  // larger one would drop the row that fits.
  const tickRow = ({ view, ops }) => {
    const { layout } = view.bands()[0];
    return ops.filter((op) => op.op === 'moveTo'
      && Math.abs(op.y - (layout.tssTop + 1)) < 0.001);
  };
  const measured = mount({ genes: tickGenes(1) });
  const { width } = measured.view.bands()[0];
  measured.restore();
  // The constant is pinned as a value too: both sides above are measured from it,
  // so they would move with it and a changed spacing would go unnoticed.
  assert.equal(MIN_TSS_SPACING_PX, 3);
  const fits = Math.floor(width / MIN_TSS_SPACING_PX);
  assert.ok(fits > 1, 'the band is wide enough for the rule to have two sides');

  const fitting = mount({ genes: tickGenes(fits) });
  try {
    assert.equal(tickRow(fitting).length, fits, 'every tick is drawn while they all fit');
  } finally {
    fitting.restore();
  }
  const crowded = mount({ genes: tickGenes(fits + 1) });
  try {
    assert.equal(tickRow(crowded).length, 0,
      'one tick past the width, the whole row is dropped rather than thinned');
  } finally {
    crowded.restore();
  }
});

test('the view states its own marker conventions, since the shared key omits them', () => {
  const { view, restore } = mount();
  try {
    const note = view.markerNote.textContent;
    assert.match(note, /Plus-strand CDSs sit above each axis/);
    assert.match(note, /1 CDS has no value for this colour/);
    assert.match(note, /empty outline, never as a colour that would imply a measurement/);
    assert.match(note, /0 excluded by the current filters/);
    assert.match(note, /Shortlisted CDSs carry a dark diamond/);
    assert.match(note, /pinned CDS is outlined in red/);
    assert.match(note, /outlined bar with a pale fill\. Shortlisted/);
    assert.doesNotMatch(note, /never as a solid reviewed one/);
    // And, by owner decision of 2026-09-30, nothing about paint order: no
    // ordering clause, no crowding figure, no owner decision D1 notice. Those
    // are in the accessible description and in the colour explanation only.
    assert.doesNotMatch(note, /Where marks overlap|draws on top|occupied columns|At this zoom/);
    // With filtered-out genes hidden there is nothing for that clause to describe.
    const hidden = mount({ mask: Uint8Array.from([1, 0, 1, 1, 1, 1, 1]), showHidden: false });
    try {
      assert.doesNotMatch(hidden.view.markerNote.textContent, /excluded by the current filters/);
    } finally {
      hidden.restore();
    }
  } finally {
    restore();
  }
});

test('the accessible description states the scale the colours are read under', () => {
  const { view, restore, flush } = mount();
  try {
    assert.match(view.canvas.getAttribute('aria-label'),
      /coloured by CAI on a logarithmic scale\./);

    // Through `update`, the entry point `app.js` calls: the sentence follows the
    // scale the ramp was built under rather than naming whichever one the view
    // opened on. The column here has a negative value, so a logarithm is not even
    // available for it and a description claiming one would be describing a ramp
    // the application cannot draw.
    view.update(viewModel({ genes: NEGATIVE_CAI_GENES, colorScale: 'linear' }));
    flush();
    assert.match(view.canvas.getAttribute('aria-label'),
      /coloured by CAI on a linear scale\./);

    // And a function category, which has no scale, names none.
    view.update(viewModel({ categorical: true }));
    flush();
    const label = view.canvas.getAttribute('aria-label');
    assert.match(label, /coloured by Function category\./);
    assert.doesNotMatch(label, /on a [a-z ]+ scale/);
  } finally {
    restore();
  }
});

test('the canvas label is the sentence-level description, rebuilt on each paint', () => {
  const { view, restore } = mount();
  try {
    const label = view.canvas.getAttribute('aria-label');
    assert.match(label, /coloured by CAI/);
    assert.match(label, /2\.69 Mb chromosome/);
    assert.match(label, /per genome copy/);
    assert.match(label, /No CDS is selected/);
    assert.equal(view.canvas.getAttribute('role'), 'img');
    assert.equal(view.canvas.getAttribute('aria-describedby'), 'chromosome-instructions');
  } finally {
    restore();
  }
});

test('every track is named with its accession, length, and plotted CDS count', () => {
  const { view, restore } = mount();
  try {
    const rows = view.trackSummaries.children.map((item) => item.text());
    assert.equal(rows.length, 3);
    assert.match(rows[0], /NZ_CP006471\.1 · chromosome/);
    assert.match(rows[0], /2,690,418 bp, 5 plotted CDSs/);
    assert.match(rows[0], /Primary track; base 1 is the origin/);
    assert.match(rows[1], /NZ_CP006472\.1 · plasmid/);
    assert.match(rows[1], /46,366 bp, 1 plotted CDS,/);
    assert.match(rows[1], /1 crossing the circular origin/);
    assert.match(rows[1], /never concatenated onto the chromosome axis/);
    assert.match(rows[2], /NZ_CP006473\.1 · plasmid/);
    for (const row of rows) assert.match(row, /Showing the whole replicon\./);
    // The plotted-CDS counts are also on the canvas, above each axis.
    const labels = view.canvas.ops.filter((op) => op.op === 'text').map((op) => op.text);
    assert.ok(labels.some((text) => text.includes('Chromosome NZ_CP006471.1')));
    assert.ok(labels.some((text) => text.includes('Plasmid NZ_CP006473.1')));
  } finally {
    restore();
  }
});

test('a track caption drops facts in order rather than running off the canvas', () => {
  const track = {
    label: 'Chromosome', accession: 'NZ_CP006471.1', lengthBp: 2690418, cdsCount: 2655,
  };
  const measure = (text) => text.length * 6;
  const variants = trackLabelVariants(track);
  assert.deepEqual(variants, [
    'Chromosome NZ_CP006471.1 · 2.69 Mb · 2,655 plotted CDSs',
    'NZ_CP006471.1 · 2.69 Mb · 2,655 plotted CDSs',
    'NZ_CP006471.1 · 2.69 Mb',
    'NZ_CP006471.1',
  ]);
  assert.equal(fitTrackLabel(measure, track, 1000), variants[0]);
  assert.equal(fitTrackLabel(measure, track, 280), variants[1]);
  assert.equal(fitTrackLabel(measure, track, 150), variants[2]);
  assert.equal(fitTrackLabel(measure, track, 90), variants[3]);
  // Narrower than even the accession, the label is clipped rather than
  // overflowing the canvas; it never silently loses a trailing fact.
  const clipped = fitTrackLabel(measure, track, 40);
  assert.ok(clipped.endsWith('…'));
  assert.ok(measure(clipped) <= 40);
});

test('tick labels thin out to fit the width while every tick keeps its mark', () => {
  const ticks = [500000, 1000000, 1500000, 2000000, 2500000]
    .map((bp) => ({ bp, label: `${bp / 1e6} Mb` }));
  const measure = (text) => text.length * 6;
  const wide = fitTickLabels(ticks, {
    measure, x: (bp) => bp / 2690418 * 868 + 16, left: 16, right: 884,
  });
  assert.deepEqual(wide.map((tick) => tick.label), ticks.map((tick) => tick.label));
  const narrow = fitTickLabels(ticks, {
    measure, x: (bp) => bp / 2690418 * 100 + 16, left: 16, right: 116,
  });
  assert.ok(narrow.length > 0 && narrow.length < ticks.length,
    'a narrow axis keeps some labels rather than dropping to one or overlapping');
  for (let i = 1; i < narrow.length; i += 1) {
    const gap = (narrow[i].anchor - measure(narrow[i].label) / 2)
      - (narrow[i - 1].anchor + measure(narrow[i - 1].label) / 2);
    assert.ok(gap >= 8, 'no two labels touch');
  }
  // End labels are nudged inward so they stay on the canvas.
  const edge = fitTickLabels([{ bp: 2690418, label: '2.5 Mb' }], {
    measure, x: () => 884, left: 16, right: 884,
  });
  assert.equal(edge[0].anchor, 884 - measure('2.5 Mb') / 2);
});

test('pointing at a CDS reports its index, and clicking selects it', () => {
  const hovered = [];
  const selected = [];
  const { view, restore } = mount({
    handlers: { onHover: (index) => hovered.push(index), onSelect: (index) => selected.push(index) },
  });
  try {
    const band = view.bands()[0];
    const x = band.scale.bpToX(200500);
    const y = band.layout.laneBelowTop + 4;
    assert.equal(view.hitTest(x, y), 1);
    // The same coordinate on the other side of the axis is a different lane.
    assert.equal(view.hitTest(x, band.layout.laneAboveTop + 4), -1);
    // Between two bands there is nothing to hit.
    assert.equal(view.hitTest(x, band.layout.top + band.layout.height + 4), -1);

    view.canvas.dispatch('pointermove', { clientX: x, clientY: y });
    assert.deepEqual(hovered, [1]);
    view.canvas.dispatch('pointerdown', { clientX: x, clientY: y, pointerId: 7 });
    view.canvas.dispatch('pointerup', { clientX: x, clientY: y, pointerId: 7 });
    assert.deepEqual(selected, [1]);
  } finally {
    restore();
  }
});

test('a drag pans instead of selecting, and the panned window stays inside the replicon', () => {
  const selected = [];
  const { view, restore } = mount({ handlers: { onSelect: (index) => selected.push(index) } });
  try {
    const band = view.bands()[0];
    view.zoomBand(band, 20, 100000);
    const before = view.windowFor(band.track);
    const y = view.bands()[0].layout.laneAboveTop + 4;
    view.canvas.dispatch('pointerdown', { clientX: 500, clientY: y, pointerId: 3 });
    view.canvas.dispatch('pointermove', { clientX: 300, clientY: y });
    view.canvas.dispatch('pointerup', { clientX: 300, clientY: y, pointerId: 3 });
    const after = view.windowFor(band.track);
    assert.ok(after.from > before.from, 'dragging left moves the window right');
    assert.equal(after.to - after.from, before.to - before.from, 'the span is unchanged');
    assert.ok(after.to <= band.track.lengthBp);
    assert.deepEqual(selected, [], 'a drag never pins a gene');
  } finally {
    restore();
  }
});

test('arrow keys preview without pinning, Enter pins, S shortlists, 0 resets', () => {
  const previewed = [];
  const selected = [];
  const shortlisted = [];
  const { view, restore } = mount({
    handlers: {
      onPreview: (index) => previewed.push(index),
      onSelect: (index) => selected.push(index),
      onShortlistToggle: (index) => shortlisted.push(index),
      onAnnounce: () => {},
    },
  });
  try {
    const prevented = [];
    const key = (name, extra = {}) => view.canvas.dispatch('keydown', {
      key: name, preventDefault: () => prevented.push(name), ...extra,
    });
    key('ArrowRight');
    assert.deepEqual(previewed, [0]);
    assert.deepEqual(selected, [], 'an arrow key never pins on its own');
    key('ArrowRight');
    assert.deepEqual(previewed, [0, 2], 'movement stays in the plus-strand lane');
    key('ArrowDown');
    assert.deepEqual(previewed, [0, 2, 1], 'down crosses to the minus-strand lane');

    // Enter pins only what the host says is active.
    key('Enter');
    assert.deepEqual(selected, []);
    view.model.active = 2;
    key('Enter');
    assert.deepEqual(selected, [2]);
    key('s');
    assert.deepEqual(shortlisted, [2]);

    const band = view.bands()[0];
    view.zoomBand(band, 30, 100000);
    assert.ok(view.windowFor(band.track).to < band.track.lengthBp);
    key('0');
    assert.deepEqual(view.windowFor(band.track), { from: 1, to: band.track.lengthBp });
    assert.ok(prevented.includes('ArrowRight') && prevented.includes('0'));
  } finally {
    restore();
  }
});

test('Shift and an arrow pans the chromosome track without moving the selection', () => {
  const previewed = [];
  const { view, restore } = mount({ handlers: { onPreview: (index) => previewed.push(index) } });
  try {
    const band = view.bands()[0];
    view.zoomBand(band, 10, 1000000);
    const before = view.windowFor(band.track);
    view.canvas.dispatch('keydown', { key: 'ArrowRight', shiftKey: true, preventDefault: () => {} });
    const after = view.windowFor(band.track);
    assert.ok(after.from > before.from);
    assert.deepEqual(previewed, []);
  } finally {
    restore();
  }
});

test('keyboard movement skips filtered-out CDSs when they are not shown', () => {
  const previewed = [];
  const mask = Uint8Array.from([1, 1, 0, 1, 1, 1, 1]);
  const { view, restore } = mount({
    mask,
    showHidden: false,
    handlers: { onPreview: (index) => previewed.push(index) },
  });
  try {
    const key = (name) => view.canvas.dispatch('keydown', { key: name, preventDefault: () => {} });
    key('ArrowRight');
    key('ArrowRight');
    assert.deepEqual(previewed, [0, 3], 'the hidden CDS at index 2 is stepped over');
  } finally {
    restore();
  }
});

test('a filtered-out CDS is drawn behind the passing ones, and only when shown', () => {
  const mask = Uint8Array.from([1, 0, 1, 1, 1, 1, 1]);
  const shown = mount({ mask, showHidden: true });
  try {
    const band = shown.view.bands()[0];
    const x = band.scale.bpToX(200000);
    const ghost = shown.view.canvas.ops.find((op) => op.op === 'fillRect'
      && Math.abs(op.x - x) < 0.5);
    assert.ok(ghost, 'the filtered-out CDS keeps its coordinate');
  } finally {
    shown.restore();
  }
  const hidden = mount({ mask, showHidden: false });
  try {
    const band = hidden.view.bands()[0];
    const x = band.scale.bpToX(200000);
    assert.equal(hidden.view.canvas.ops.some((op) => op.op === 'fillRect'
      && Math.abs(op.x - x) < 0.5), false);
    assert.equal(hidden.view.hitTest(x, band.layout.laneBelowTop + 4), -1);
  } finally {
    hidden.restore();
  }
});

test('the toolbar mirrors the shared colour, scale, and visibility state', () => {
  const changes = [];
  const { view, restore } = mount({
    handlers: {
      onColorChange: (key) => changes.push(['colour', key]),
      onColorScaleChange: (scale) => changes.push(['scale', scale]),
      onShowHiddenChange: (value) => changes.push(['showHidden', value]),
    },
  });
  try {
    assert.equal(view.colorSelect.value, 'cai');
    assert.deepEqual(view.colorSelect.children.map((group) => group.attributes.label ?? group.label),
      ['Reviewed function', 'Codon adaptation']);
    view.colorSelect.value = 'functionCategory';
    view.colorSelect.dispatch('change');
    view.colorScaleSelect.value = 'percentile';
    view.colorScaleSelect.dispatch('change');
    view.showHidden.checked = false;
    view.showHidden.dispatch('change');
    assert.deepEqual(changes, [
      ['colour', 'functionCategory'], ['scale', 'percentile'], ['showHidden', false],
    ]);
  } finally {
    restore();
  }
});

test('Scale sits beside Colour by, offers every scale, and disables the ones with a reason', () => {
  const { view, restore } = mount();
  try {
    // The map toolbar's structure: Colour by and Scale alone on the first row,
    // the scale note and the colour explanation beneath it, and the view buttons
    // on their own row last. DOM order is keyboard order, so this is the visual
    // order too. Flat, this toolbar wrapped a zoom button up beside Scale.
    const toolbar = view.figure.children[0];
    assert.equal(toolbar.className, 'chromosome-toolbar');
    const [fieldsRow, notice, help, viewRow] = toolbar.children;
    assert.equal(fieldsRow.className, 'chromosome-toolbar-row colour-scale-row');
    const [colourField, scaleField] = fieldsRow.children;
    assert.equal(fieldsRow.children.length, 2, 'nothing else shares the colour row');
    assert.equal(colourField.children[1], view.colorSelect);
    assert.equal(scaleField.children[0].textContent, 'Scale');
    assert.equal(scaleField.children[1], view.colorScaleSelect);
    assert.equal(notice, view.scaleNotice);
    assert.equal(help.id, 'chromosome-colour-help');
    assert.equal(viewRow.className, 'chromosome-toolbar-row');
    assert.deepEqual(viewRow.children.slice(0, 3).map((child) => child.textContent),
      ['Zoom in (+)', 'Zoom out (−)', 'Reset view']);
    assert.equal(viewRow.children[3].children[0], view.showHidden);
    assert.equal(viewRow.children.length, 4, 'and no field shares the button row');
    // The figure itself no longer carries the explanation: it lives in the
    // toolbar, directly beneath the row whose metric it explains.
    assert.equal(view.figure.children[1], view.windowReadout);

    assert.equal(view.colorScaleSelect.value, 'log10');
    assert.equal(view.colorScaleSelect.disabled, false);
    assert.equal(view.colorScaleSelect.title, '');
    assert.deepEqual(view.colorScaleSelect.children.map((option) => option.textContent),
      ['Linear', 'Logarithmic', 'Percentile', 'Square root', 'Symmetric log']);
    // Every CAI in this fixture is positive, so every scale is available.
    assert.deepEqual(view.colorScaleSelect.children.filter((option) => option.disabled), []);
    for (const option of view.colorScaleSelect.children) assert.equal(option.title, '');
  } finally {
    restore();
  }
});

test('a scale the column cannot take is listed and disabled with the reason the data gives', () => {
  // One negative CAI is what blocks a square root and a logarithm, and the
  // reasons come from the availability test over that very column rather than
  // from a hand-written fixture.
  const { view, restore } = mount({ genes: NEGATIVE_CAI_GENES, colorScale: 'linear' });
  try {
    const disabled = view.colorScaleSelect.children.filter((option) => option.disabled);
    assert.deepEqual(disabled.map((option) => option.value), ['log10', 'sqrt']);
    assert.equal(disabled[0].title,
      'Logarithmic is unavailable for CAI: 1 value is zero or negative.');
    assert.equal(disabled[1].title,
      'Square root is unavailable for CAI: 1 value is negative.');
    // Nothing is hidden: the reader still sees all five options.
    assert.equal(view.colorScaleSelect.children.length, 5);
    for (const option of view.colorScaleSelect.children.filter((each) => !each.disabled)) {
      assert.equal(option.title, '');
    }
    // And both reasons are visible beneath the row, because a title needs a
    // pointer and this select's disabled options cannot be reached without one.
    assert.equal(view.scaleNotice.hidden, false);
    assert.equal(view.scaleNotice.textContent,
      'Logarithmic is unavailable for CAI: 1 value is zero or negative. '
        + 'Square root is unavailable for CAI: 1 value is negative.');
    assert.equal(view.colorScaleSelect.getAttribute('aria-describedby'), view.scaleNotice.id);
  } finally {
    restore();
  }
});

/**
 * The note follows the metric, through `update` — the entry point `app.js` calls
 * on every render. A stale reason under a live selector is the same defect as a
 * stale title on it.
 */
test('the visible scale note follows the colour, and is gone when every scale is available', () => {
  const { view, restore } = mount({ genes: NEGATIVE_CAI_GENES, colorScale: 'linear' });
  try {
    assert.match(view.scaleNotice.textContent, /^Logarithmic is unavailable for CAI/);

    // The same view re-pointed at a column with nothing wrong with it: the note
    // empties and stops occupying space rather than keeping the old sentences.
    view.update(viewModel({ colorScale: 'log10' }));
    assert.equal(view.scaleNotice.textContent, '');
    assert.equal(view.scaleNotice.hidden, true);

    // And a function category, where no scale is in effect at all, shows the one
    // reason the whole control is disabled.
    view.update(viewModel({ categorical: true }));
    assert.equal(view.scaleNotice.hidden, false);
    assert.equal(view.scaleNotice.textContent, CATEGORICAL_SCALE_REASON);
  } finally {
    restore();
  }
});

/**
 * The defect this pins: the chromosome toolbar's Scale selector was left enabled
 * under a Function category colour, so all five options could be chosen and the
 * choice then snapped silently back. The check runs through `update`, with the
 * control state `app.js` itself builds, because a source assertion is what let
 * the two toolbars disagree in the first place.
 */
test('Function category disables the chromosome Scale selector, with its reason', () => {
  const changes = [];
  const { view, restore } = mount({
    categorical: true,
    handlers: { onColorScaleChange: (scale) => changes.push(scale) },
  });
  try {
    assert.equal(view.colorSelect.value, 'functionCategory');
    assert.equal(view.colorScaleSelect.disabled, true);
    assert.equal(view.colorScaleSelect.title, CATEGORICAL_SCALE_REASON);
    assert.match(view.colorScaleSelect.title, /no numeric scale/);
    // A disabled control cannot be the source of a change, so nothing can be
    // chosen here and silently snapped back to Linear.
    assert.deepEqual(changes, []);
    // The scatter map's selector is pointed at this same object, so the two
    // toolbars are disabled together or not at all.
    assert.deepEqual(
      scaleControl(GENES, { categorical: true }),
      scaleControlState({ categorical: true, scale: null, availability: null }),
    );
  } finally {
    restore();
  }
});

test('a selection exposes the detail shortcut, and no selection hides it', () => {
  const jumps = [];
  const { view, restore } = mount({ handlers: { onDetailJump: () => jumps.push(true) } });
  try {
    assert.equal(view.detailJump.hidden, true);
    view.update({ ...view.model, hasSelection: true });
    assert.equal(view.detailJump.hidden, false);
    view.detailJump.dispatch('click');
    assert.deepEqual(jumps, [true]);
  } finally {
    restore();
  }
});

test('an unverified genome refuses to draw and names every problem', () => {
  const { view, restore } = mount({ meta: { genome: { accession: 'GCF_000817745.1', totalLength: 1 } } });
  try {
    assert.equal(view.figure.hidden, true);
    assert.equal(view.unavailable.hidden, false);
    const text = view.unavailable.text();
    assert.match(text, /cannot be drawn against this dataset/);
    assert.match(text, /GCF_000817745\.1/);
    assert.match(text, /2,744,626 bp/);
  } finally {
    restore();
  }
});

test('each track reports its own visible window, since each has its own camera', () => {
  const announced = [];
  const { view, restore } = mount({ handlers: { onAnnounce: (text) => announced.push(text) } });
  try {
    const plasmid = view.bands()[1];
    view.zoomBand(plasmid, 4, 23000);
    const rows = view.trackSummaries.children.map((item) => item.text());
    assert.match(rows[0], /Showing the whole replicon\./,
      'zooming one replicon leaves the others where they were');
    assert.match(rows[1], /Showing [\d,]+–[\d,]+\./);
    assert.match(rows[2], /Showing the whole replicon\./);
    assert.deepEqual(announced, ['NZ_CP006472.1 showing 11.6 kb.']);
    // The buttons and keys act on the chromosome, whichever track was last zoomed.
    view.zoomByCentre(2);
    assert.equal(announced[1], 'NZ_CP006471.1 showing 1.35 Mb.');
  } finally {
    restore();
  }
});

test('a gene reached from another view is brought into the window', () => {
  const { view, restore } = mount();
  try {
    const band = view.bands()[0];
    view.zoomBand(band, 400, 100000);
    const before = view.windowFor(band.track);
    assert.ok(before.to < 400000);
    view.revealIndex(3);
    const after = view.windowFor(band.track);
    assert.ok(after.from <= 400000 && after.to >= 400000);
    assert.equal(after.to - after.from, before.to - before.from, 'the zoom level is preserved');
    // A gene already in view leaves the camera alone.
    const unchanged = view.windowFor(band.track);
    view.revealIndex(3);
    assert.deepEqual(view.windowFor(band.track), unchanged);
  } finally {
    restore();
  }
});

/**
 * Two plus-strand CDSs near the far end of the chromosome, about 32 kb apart.
 * At whole-genome zoom that is roughly ten pixels, which is what the host's
 * border and padding add, so a drawing measured on the wrong box puts the
 * pointer on the wrong one of the pair — exactly the far-right case where the
 * error has grown past the hit tolerance.
 */
const NEAR_END = [
  gene({ id: 'END_A', start: 2650000, end: 2651000, cai: 0.3 }),
  gene({ id: 'END_B', start: 2682000, end: 2683000, cai: 0.8 }),
];

test('the drawing is measured on the canvas, not on the wider box around it', () => {
  const { view, restore } = mount();
  try {
    assert.equal(view.canvasHost.getBoundingClientRect().width, CANVAS_WIDTH + HOST_CHROME,
      'the fake reproduces a host wider than its canvas, as the stylesheet makes it');
    assert.equal(view.canvas.getBoundingClientRect().width, CANVAS_WIDTH);
    assert.equal(view.width, CANVAS_WIDTH);
    assert.equal(view.canvas.width, CANVAS_WIDTH * DEVICE_PIXEL_RATIO);
    // The axis ends as far inside the canvas's right edge as it starts inside
    // its left one. Sized from the host, it would run past that margin and
    // every mark would be drawn wider of its coordinate the further right it
    // sits, while the pointer kept reporting the canvas.
    const band = view.bands()[0];
    assert.equal(band.left + band.width, CANVAS_WIDTH - band.left);
  } finally {
    restore();
  }
});

/**
 * The widths the rendered inspection measured. Ten device pixels of slack
 * between the backing store and the canvas's CSS box does two things at once:
 * it drifts the hit test by up to ten pixels at the right edge, and it makes
 * the browser resample the bitmap horizontally, which softens every one-pixel
 * bar the device-column snapping exists to keep sharp.
 */
const VIEWPORT_WIDTHS = [375, 768, 960, 1280, 1440];

test('the backing store is exactly the canvas CSS width at every viewport', () => {
  for (const canvasWidth of VIEWPORT_WIDTHS) {
    for (const devicePixelRatio of [1, 2]) {
      const { view, restore } = mount({ viewport: { canvasWidth, devicePixelRatio } });
      try {
        const where = `${canvasWidth} css px at dpr ${devicePixelRatio}`;
        assert.equal(view.canvasHost.getBoundingClientRect().width, canvasWidth + HOST_CHROME,
          `the host stays wider than its canvas at ${where}`);
        assert.equal(view.canvas.getBoundingClientRect().width, canvasWidth);
        assert.equal(view.canvas.width, canvasWidth * devicePixelRatio,
          `the backing store is one device pixel per css pixel at ${where}`);
        assert.equal(view.canvas.width / devicePixelRatio, canvasWidth,
          `no resampling at ${where}: a device column is a drawing unit`);
        assert.equal(view.width, canvasWidth);
      } finally {
        restore();
      }
    }
  }
});

test('clicking the centre of a CDS near the far end pins that CDS', () => {
  const selected = [];
  const hovered = [];
  const { view, restore } = mount({
    genes: NEAR_END,
    handlers: { onSelect: (index) => selected.push(index), onHover: (index) => hovered.push(index) },
  });
  try {
    const band = view.bands()[0];
    // Where the reader sees END_B: the view paints it here, and the browser
    // scales the bitmap onto the element the pointer is measured against.
    const x = onScreenX(view.canvas, band.scale.bpToX(2682500));
    const y = band.layout.laneAboveTop + 4;
    view.canvas.dispatch('pointermove', { clientX: x, clientY: y });
    view.canvas.dispatch('pointerdown', { clientX: x, clientY: y, pointerId: 11 });
    view.canvas.dispatch('pointerup', { clientX: x, clientY: y, pointerId: 11 });
    assert.deepEqual(selected, [1], 'the CDS under the cursor is the one that gets pinned');
    assert.deepEqual(hovered, [1], 'and the one the hover reports on the way in');
  } finally {
    restore();
  }
});

test('a selection arriving from another view is brought into a zoomed window', () => {
  const { view, restore } = mount({ handlers: { onAnnounce: () => {} } });
  try {
    const band = view.bands()[0];
    view.zoomBand(band, 400, 100000);
    const before = view.windowFor(band.track);
    assert.ok(before.to < 400000, 'OP1 is off screen before the pin arrives');

    // What the application does on any render: hand the view the workspace's
    // selection. Nothing here calls the camera helper itself.
    view.update({ ...view.model, pinned: 3, hasSelection: true });

    const after = view.windowFor(band.track);
    assert.ok(after.from <= 400000 && after.to >= 400000, 'the pinned CDS is in the window');
    assert.equal(after.to - after.from, before.to - before.from, 'the zoom level is preserved');

    // A render that repeats the same selection leaves the camera where the
    // reader has since panned it.
    view.zoomBand(view.bands()[0], 1, 100000);
    const panned = panAway(view);
    view.update({ ...view.model, pinned: 3, hasSelection: true });
    assert.deepEqual(view.windowFor(band.track), panned);
  } finally {
    restore();
  }
});

/** Pan the chromosome away from wherever it is, and report the new window. */
function panAway(view) {
  const band = view.bands()[0];
  const span = band.window.to - band.window.from + 1;
  view.windows.set(band.track.accession, { from: 1, to: span });
  return view.windowFor(band.track);
}

test('a pin made elsewhere replaces the keyboard cursor, not just an empty one', () => {
  const previewed = [];
  const { view, restore } = mount({
    handlers: { onPreview: (index) => previewed.push(index), onAnnounce: () => {} },
  });
  const key = (name) => view.canvas.dispatch('keydown', { key: name, preventDefault: () => {} });
  try {
    // Arrow onto OP2, so the cursor holds a gene of its own.
    key('ArrowRight');
    key('ArrowRight');
    key('ArrowRight');
    key('ArrowRight');
    assert.deepEqual(previewed, [0, 2, 3, 4]);

    // Then a pin arrives from a search in another tab: no active preview, a
    // different gene. Clearing the shared active index does not reach this
    // view's own copy of it, so `update` has to reconcile the cursor.
    view.update({ ...view.model, active: -1, pinned: 0, hasSelection: true });
    previewed.length = 0;
    key('ArrowRight');
    assert.deepEqual(previewed, [2], 'the arrow continues from the pinned CDS, not the old one');
  } finally {
    restore();
  }
});

test('Reset view acts at once, with no confirmation, by owner decision', async () => {
  const { view, document, restore } = mount({ handlers: { onAnnounce: () => {} } });
  try {
    const band = view.bands()[0];
    view.zoomBand(band, 400, 100000);
    assert.notDeepEqual(view.windowFor(band.track), { from: 1, to: band.track.lengthBp });

    view.resetButton.dispatch('click');
    await settled();
    const asked = confirmParts(document);
    assert.ok(!asked || asked.backdrop.hidden, 'no confirmation opens for Reset view');
    assert.deepEqual(view.windowFor(band.track), { from: 1, to: band.track.lengthBp });
  } finally {
    restore();
  }
});


/**
 * Four CDSs close enough together to snap onto one column at whole-genome zoom,
 * which the first test below asserts rather than assumes. Their categories and
 * their evidence are what the shared-column tests vary.
 */
const CROWDED = [
  gene({ id: 'SHARE_A', start: 100000, end: 100150, strand: '+' }),
  gene({ id: 'SHARE_B', start: 100200, end: 100350, strand: '+' }),
  gene({ id: 'SHARE_C', start: 100400, end: 100550, strand: '+' }),
  gene({ id: 'SHARE_D', start: 100600, end: 100750, strand: '+' }),
];

/** The paint calls that landed on one column of the plus-strand lane, in order. */
function columnPaints(view, ops, column) {
  const band = view.bands()[0];
  const top = band.layout.laneAboveTop + 2;
  return ops.filter((op) => (op.op === 'fillRect' || op.op === 'strokeRect')
    && Math.abs(op.y - top) <= 0.6
    && Math.abs(op.x - column) <= 1.1);
}

test('the crowded fixture really does put four CDSs on one column', () => {
  const { view, restore } = mount({ genes: CROWDED });
  try {
    const band = view.bands()[0];
    const columns = columnOccupancy(band.scale, band.track.marks);
    assert.deepEqual(columnCrowding(columns), {
      occupied: 1, shared: 1, median: 4, max: 4,
    });
    assert.deepEqual([...columns.values()][0], [0, 1, 2, 3]);
  } finally {
    restore();
  }
});

test('owner decision D1: the hollow style is kept at and above its threshold, dropped below', () => {
  const hollow = { fill: '#ffffff', stroke: '#0072b2', hollow: true };
  // Below: a white fill inside a 1 px ring needs a column for each edge and one
  // between them, so at two the ring is the whole bar and the fill is a gap.
  assert.deepEqual(resolveMarkPaint(hollow, MIN_HOLLOW_MARK_PX - 1),
    { fill: '#0072b2', stroke: '#0072b2' });
  assert.deepEqual(resolveMarkPaint(hollow, 1), { fill: '#0072b2', stroke: '#0072b2' });
  // At and above: the hollow style is legible, so it is what is drawn.
  assert.deepEqual(resolveMarkPaint(hollow, MIN_HOLLOW_MARK_PX),
    { fill: '#ffffff', stroke: '#0072b2' });
  assert.deepEqual(resolveMarkPaint(hollow, MIN_HOLLOW_MARK_PX + 8),
    { fill: '#ffffff', stroke: '#0072b2' });
  assert.equal(MIN_HOLLOW_MARK_PX, 3);
});

test('owner decision D1: a style that never asked to be hollow is untouched at any width', () => {
  const reviewed = { fill: '#0072b2', stroke: '#314254', hollow: false };
  const unknown = { fill: null, stroke: '#c6cdd5', hollow: false };
  for (const width of [0.5, 1, MIN_HOLLOW_MARK_PX, 40]) {
    assert.deepEqual(resolveMarkPaint(reviewed, width),
      { fill: '#0072b2', stroke: '#314254' });
    assert.deepEqual(resolveMarkPaint(unknown, width), { fill: null, stroke: '#c6cdd5' });
  }
});

test('a sub-pixel derived category paints its category colour, not a white column', () => {
  const { view, restore, ops } = mount({
    genes: CROWDED, categorical: true, categoryOf: () => 0, derivedOf: () => true,
  });
  try {
    const band = view.bands()[0];
    const column = Math.round(band.scale.bpToX(100000));
    const painted = columnPaints(view, ops, column);
    const fills = painted.filter((op) => op.op === 'fillRect');
    assert.ok(fills.length > 0, 'the column is painted at all');
    for (const fill of fills) {
      assert.equal(fill.fill, view.model.colors.scale.buckets[0]);
      assert.notEqual(fill.fill, '#ffffff');
    }
  } finally {
    restore();
  }
});

test('zoomed in until the bar is wide enough, the hollow derived style returns', () => {
  const { view, restore, flush } = mount({
    genes: CROWDED, categorical: true, categoryOf: () => 0, derivedOf: () => true,
  });
  try {
    view.zoomBand(view.bands()[0], 400, 100300);
    const ops = flush();
    const band = view.bands()[0];
    const wide = ops.filter((op) => op.op === 'fillRect'
      && Math.abs(op.y - (band.layout.laneAboveTop + 2)) <= 0.6);
    assert.ok(wide.length > 0);
    assert.ok(wide.every((op) => op.w >= MIN_HOLLOW_MARK_PX),
      'the fixture has to be zoomed past the threshold for this to mean anything');
    assert.ok(wide.every((op) => op.fill === '#ffffff'),
      'a bar wide enough to show the hollow style draws it again');
  } finally {
    restore();
  }
});

test('columns group by lane, so a plus-strand and a minus-strand CDS never share one', () => {
  const genes = [
    gene({ id: 'UP', start: 100000, end: 100600, strand: '+' }),
    gene({ id: 'DOWN', start: 100100, end: 100700, strand: '-' }),
  ];
  const { view, restore } = mount({ genes });
  try {
    const band = view.bands()[0];
    const columns = columnOccupancy(band.scale, band.track.marks);
    assert.equal(columnCrowding(columns).max, 1);
    assert.equal(columnCrowding(columns).shared, 0);
    assert.equal(columnCrowding(columns).occupied, 2);
  } finally {
    restore();
  }
});

test('an origin-crossing CDS occupies both of its segments’ columns, counted once each', () => {
  // Its two segments sit at opposite ends of the replicon, so a grouping that
  // dropped either would lose the gene from half the columns it is drawn in,
  // and one that counted their shared column twice would report a crowding the
  // picture does not have.
  const { view, restore } = mount();
  try {
    const plasmid = view.bands()[1];
    const wrap = plasmid.track.marks.find((mark) => mark.wraps);
    assert.ok(wrap, 'the fixture carries an origin-crossing CDS');
    assert.equal(wrap.pieces.length, 2);
    const columns = columnOccupancy(plasmid.scale, [wrap]);
    const held = [...columns.entries()].filter(([, list]) => list.includes(wrap.index));
    const ends = held.map(([key]) => Number(key.split('#')[1])).sort((a, b) => a - b);
    assert.ok(ends.length >= 2, 'both segments register');
    assert.ok(ends[ends.length - 1] - ends[0] > 1, 'and at opposite ends of the replicon');
    for (const [, list] of held) {
      assert.equal(list.filter((index) => index === wrap.index).length, 1,
        'one gene in a column is one gene, however many of its segments landed there');
    }
  } finally {
    restore();
  }
});

test('a piece covers one column when sub-pixel and its whole run when wide', () => {
  const scale = { bpToX: (bp) => bp / 100 };
  assert.deepEqual(pieceColumns(scale, { from: 1000, to: 1010 }), { first: 10, last: 10 });
  assert.deepEqual(pieceColumns(scale, { from: 1000, to: 1499 }), { first: 10, last: 14 });
});

test('crowding reports the occupied, shared, middle, and worst counts', () => {
  const columns = new Map([['above#1', [0]], ['above#2', [1, 2]], ['above#3', [3, 4, 5]]]);
  assert.deepEqual(columnCrowding(columns), {
    occupied: 3, shared: 2, median: 2, max: 3,
  });
  assert.deepEqual(columnCrowding(new Map()), {
    occupied: 0, shared: 0, median: 0, max: 0,
  });
});

test('owner decision D2: a reviewed category is what a shared column shows', () => {
  // Three derived CDSs of category 1 and one reviewed CDS of category 0, all on
  // one column. The reviewed CDS is both the minority and the *earliest* locus,
  // so it can only win on evidence: neither the majority rule nor the
  // locus-order tie-break would put it on top.
  const { view, restore, ops } = mount({
    genes: CROWDED,
    categorical: true,
    categoryOf: (_row, index) => (index === 0 ? 0 : 1),
    derivedOf: (_row, index) => index !== 0,
  });
  try {
    const band = view.bands()[0];
    const column = Math.round(band.scale.bpToX(100000));
    const painted = columnPaints(view, ops, column).filter((op) => op.op === 'fillRect');
    assert.ok(painted.length >= 4, 'every CDS in the column is still painted');
    assert.equal(painted[painted.length - 1].fill, view.model.colors.scale.buckets[0],
      'the reviewed category is painted last, so it is the colour the column shows');
  } finally {
    restore();
  }
});

test('owner decision D2: among derived categories the one with more CDSs in the column wins', () => {
  // Three derived CDSs of category 0 and one of category 1, every one derived.
  // The majority category holds the three *earlier* loci, so the locus-order
  // tie-break on its own would hand the column to the single later CDS: only
  // the majority rule produces this answer.
  const { view, restore, ops } = mount({
    genes: CROWDED,
    categorical: true,
    categoryOf: (_row, index) => (index === 3 ? 1 : 0),
    derivedOf: () => true,
  });
  try {
    const band = view.bands()[0];
    const column = Math.round(band.scale.bpToX(100000));
    const painted = columnPaints(view, ops, column).filter((op) => op.op === 'fillRect');
    assert.equal(painted[painted.length - 1].fill, view.model.colors.scale.buckets[0],
      'three CDSs of one category outrank the single, later CDS of the other');
  } finally {
    restore();
  }
});

test('owner decision D2: an even split falls through to the earlier locus', () => {
  const { view, restore, ops, flush } = mount({
    genes: CROWDED,
    categorical: true,
    categoryOf: (_row, index) => (index < 2 ? 0 : 1),
    derivedOf: () => true,
  });
  try {
    const band = view.bands()[0];
    const column = Math.round(band.scale.bpToX(100000));
    const last = () => {
      const painted = columnPaints(view, ops, column).filter((op) => op.op === 'fillRect');
      return painted[painted.length - 1].fill;
    };
    const first = last();
    // The disclosure and the validation documents both end owner decision D2
    // with "then the earlier locus", and this is the case that says which one
    // that is: two against two, so nothing above the tie-break can decide it.
    // The comparator used to leave the later locus on top here.
    assert.equal(first, view.model.colors.scale.buckets[0],
      'two against two: the earlier locus wins, which is SHARE_A of category 0');
    // A redraw with nothing changed repaints the same winner, so the picture
    // cannot flicker between two equally ranked CDSs.
    view.draw();
    const repeat = flush();
    const again = columnPaints(view, repeat, column).filter((op) => op.op === 'fillRect');
    assert.equal(again[again.length - 1].fill, first);
  } finally {
    restore();
  }
});

test('a filtered-out CDS stays underneath however extreme its value', () => {
  const genes = [
    gene({ id: 'HIDDEN_HIGH', start: 100000, end: 100600, strand: '+', cai: 0.99 }),
    gene({ id: 'SHOWN_LOW', start: 100200, end: 100800, strand: '+', cai: 0.01 }),
  ];
  const { view, restore, ops } = mount({ genes, mask: Uint8Array.from([0, 1]) });
  try {
    const band = view.bands()[0];
    const column = Math.round(band.scale.bpToX(100000));
    const painted = columnPaints(view, ops, column).filter((op) => op.op === 'fillRect');
    assert.equal(painted[painted.length - 1].fill,
      view.model.colors.scale.color(0.01),
      'the passing CDS is on top even though the hidden one has the higher value');
  } finally {
    restore();
  }
});

test('clicking a shared column selects the CDS that column shows', () => {
  const { view, restore } = mount({
    genes: CROWDED,
    categorical: true,
    categoryOf: (_row, index) => (index === 0 ? 0 : 1),
    derivedOf: (_row, index) => index !== 0,
  });
  try {
    const band = view.bands()[0];
    const x = band.scale.bpToX(100300);
    const y = band.layout.laneAboveTop + 4;
    // Index 0 is the reviewed CDS, which owner decision D2 puts on top. It is
    // also the earliest locus, so a hit test that merely took the first or the
    // nearest candidate could not agree with the picture by accident.
    assert.equal(view.hitTest(x, y), 0);
    // And every other CDS in the column is still reachable, so nothing is lost.
    for (const index of [0, 1, 2]) {
      assert.ok(view.model.genes[index], 'every CDS is still in the model');
    }
    assert.equal(view.paintRank.size, CROWDED.length);
  } finally {
    restore();
  }
});

test('the click follows the picture even when the winner is the last CDS in the column', () => {
  // The mirror of the test above: here the reviewed CDS is the *latest* locus,
  // so a hit test that took the first candidate at the same distance — which is
  // what it used to do — would answer with a CDS the column does not show.
  const { view, restore } = mount({
    genes: CROWDED,
    categorical: true,
    categoryOf: (_row, index) => (index === 3 ? 0 : 1),
    derivedOf: (_row, index) => index !== 3,
  });
  try {
    const band = view.bands()[0];
    const y = band.layout.laneAboveTop + 4;
    assert.equal(view.hitTest(band.scale.bpToX(100000), y), 3);
    assert.equal(view.hitTest(band.scale.bpToX(100700), y), 3);
  } finally {
    restore();
  }
});

test('the highest value owns a shared column, and the lowest direction reverses that', () => {
  const genes = [
    gene({ id: 'LOW', start: 100000, end: 100600, strand: '+', cai: 0.05 }),
    gene({ id: 'HIGH', start: 100200, end: 100800, strand: '+', cai: 0.95 }),
  ];
  const paintedTop = (drawOnTop) => {
    const { view, restore, ops } = mount({ genes, drawOnTop });
    try {
      const band = view.bands()[0];
      const column = Math.round(band.scale.bpToX(100000));
      const painted = columnPaints(view, ops, column).filter((op) => op.op === 'fillRect');
      return painted[painted.length - 1].fill;
    } finally {
      restore();
    }
  };
  const { view, restore } = mount({ genes });
  const scale = view.model.colors.scale;
  restore();
  assert.equal(paintedTop('highest'), scale.color(0.95));
  assert.equal(paintedTop('lowest'), scale.color(0.05));
});

test('the accessible description states the order, the crowding, and the D2 rule', () => {
  const { view, restore } = mount({
    genes: CROWDED,
    categorical: true,
    categoryOf: () => 0,
    derivedOf: () => true,
  });
  try {
    const label = view.canvas.getAttribute('aria-label');
    assert.match(label, /lab-reviewed category draws over a source-derived one/);
    // Singular at a count of one, which is what the crowding figure reaches as
    // soon as bars start separating: "1 of 632 occupied columns hold" was not
    // English.
    assert.match(label, /1 of 1 occupied columns holds more than one CDS/);
    assert.match(label, /then the category with more CDSs in that column, then the earlier locus/);
    assert.match(label, /a CDS wide enough to cross several can hold the majority in one/);
    // No lab-reviewed CDS is in this view, so the sentence cannot offer a count
    // of zero as something to compare the colour against.
    assert.match(label,
      /4 source-derived categories draw in the solid colour a lab-reviewed category takes, with/);
    assert.doesNotMatch(label, /the 0 lab-reviewed/);
    assert.match(label, /every CDS stays selectable, reachable by the arrow keys, and counted/);
  } finally {
    restore();
  }
});

test('the description states the direction in effect, and changes when it is reversed', () => {
  const labelFor = (drawOnTop) => {
    const { view, restore } = mount({ genes: CROWDED, drawOnTop });
    try {
      return view.canvas.getAttribute('aria-label');
    } finally {
      restore();
    }
  };
  assert.match(labelFor('highest'), /highest CAI value draws on top/);
  assert.match(labelFor('lowest'), /lowest CAI value draws on top/);
});

test('the colour explanation says derived and reviewed draw alike, and stops once they do not', () => {
  const { view, restore, flush } = mount({
    genes: CROWDED,
    categorical: true,
    categoryOf: () => 0,
    derivedOf: () => true,
  });
  try {
    assert.match(disclosureText(view),
      /4 source-derived categories draw in the solid colour a lab-reviewed category takes/);
    assert.match(disclosureText(view), /under 3 pixels wide/);
    assert.doesNotMatch(disclosureText(view), /the 0 lab-reviewed/);
    // The notice is owner decision D1's, so it goes when D1 is not in effect —
    // and it never had a replacement sentence: the conventions note says what a
    // derived category ordinarily looks like, and says it at every zoom.
    view.zoomBand(view.bands()[0], 400, 100300);
    flush();
    assert.doesNotMatch(disclosureText(view), /source-derived categor/);
    assert.match(view.markerNote.textContent, /outlined bar with a pale fill\. Shortlisted/);
    assert.doesNotMatch(view.markerNote.textContent, /never as a solid reviewed one/);
  } finally {
    restore();
  }
});

test('the disclosure carries the order, the crowding and the D2 rule, and the notes carry none', () => {
  const { view, restore } = mount({
    genes: CROWDED,
    categorical: true,
    categoryOf: () => 0,
    derivedOf: () => true,
  });
  try {
    const shown = disclosureText(view);
    assert.match(shown, /lab-reviewed category draws over a source-derived one/);
    assert.match(shown, /1 of 1 occupied columns holds more than one CDS/);
    assert.match(shown, /then the category with more CDSs in that column, then the earlier locus/);
    assert.match(shown, /4 source-derived categories draw in the solid colour/);
    assert.match(shown, /every CDS stays selectable, reachable by the arrow keys, and counted/);
    // Word for word what the canvas description says, because both come from
    // `describePaintOrder`; the disclosure is the visible copy, not a second
    // wording that could drift from the rule.
    const label = view.canvas.getAttribute('aria-label');
    for (const sentence of describePaintOrder(view.paintOrderFacts())) {
      assert.ok(label.includes(sentence), `the description is missing: ${sentence}`);
      assert.ok(shown.includes(sentence), `the disclosure is missing: ${sentence}`);
    }
    // None of it reaches the visible note beside the colour key.
    assert.doesNotMatch(view.markerNote.textContent,
      /draws over a source-derived one|occupied columns|solid colour a lab-reviewed/);
  } finally {
    restore();
  }
});

test('the disclosure follows the direction, and a reversed one is never silent', () => {
  for (const [drawOnTop, pattern] of [['highest', /highest CAI value draws on top/],
    ['lowest', /lowest CAI value draws on top/]]) {
    const { view, restore } = mount({ genes: CROWDED, drawOnTop });
    try {
      assert.match(disclosureText(view), pattern);
    } finally {
      restore();
    }
  }
});

test('the Draw on top control sits inside the closed colour explanation, never on a row', () => {
  const chosen = [];
  const { view, restore } = mount({
    handlers: { onDrawDirectionChange: (direction) => chosen.push(direction) },
  });
  try {
    const toolbar = view.host.find((node) => node.className === 'chromosome-toolbar')[0];
    const rows = toolbar.children.filter((node) => String(node.className).includes('toolbar-row'));
    for (const row of rows) {
      assert.equal(row.find((node) => node.className === 'draw-direction').length, 0,
        'the control must not be on a toolbar row');
    }
    const field = view.colourHelp.children.find((node) => node.className === 'draw-direction');
    assert.ok(field, 'it is mounted inside the colour explanation disclosure');
    // The disclosure is a `details` with no `open` attribute, so it is closed in
    // a fresh view and the control occupies no height.
    assert.equal(view.colourHelp.tagName, 'details');
    assert.equal(view.colourHelp.getAttribute('open'), null);

    const select = field.find((node) => node.tagName === 'select')[0];
    assert.equal(select.value, 'highest');
    assert.equal(select.disabled, false);
    select.value = 'lowest';
    select.dispatch('change');
    assert.deepEqual(chosen, ['lowest']);
  } finally {
    restore();
  }
});

test('in Function category colour the Draw on top control is disabled with its reason', () => {
  const { view, restore } = mount({ categorical: true });
  try {
    const field = view.colourHelp.children.find((node) => node.className === 'draw-direction');
    const select = field.find((node) => node.tagName === 'select')[0];
    assert.equal(select.disabled, true);
    const notice = field.find((node) => String(node.className).includes('draw-direction-notice'))[0];
    assert.equal(notice.hidden, false);
    assert.match(notice.textContent, /no value order to reverse/);
  } finally {
    restore();
  }
});

/**
 * Base pairs one CSS column covers on the primary band at whole-genome zoom,
 * for the default stage width. `repliconScale` spreads the replicon across the
 * band, and `pieceRect` snaps anything narrower than 1.5 px onto one column, so
 * this is what lets a fixture put a CDS on a *named* column.
 */
const CHROMOSOME_BP = 2690418;
const BAND_LEFT = 16;
const BAND_WIDTH = CANVAS_WIDTH - 32;
const BP_PER_COLUMN = CHROMOSOME_BP / BAND_WIDTH;

/** The first base whose drawn piece snaps onto column `column`. */
function bpAtColumn(column) {
  return Math.round(1 + (column - BAND_LEFT) * BP_PER_COLUMN);
}

/**
 * Paint calls that could put a pixel at drawing-space `x` in the plus-strand
 * lane, in the order they were issued. A call whose clip excludes `x` painted
 * nothing there and is left out.
 */
function paintsAt(view, ops, x) {
  const band = view.bands()[0];
  const top = band.layout.laneAboveTop + 2;
  return ops.filter((op) => op.op === 'fillRect'
    && Math.abs(op.y - top) <= 0.6
    && op.x <= x && op.x + op.w >= x
    && op.clipBox.left <= x && op.clipBox.right >= x);
}

test('the column fixture puts its CDSs on the columns it names', () => {
  const genes = [
    gene({ id: 'LEFT', start: bpAtColumn(200), end: bpAtColumn(200) + 150, strand: '+' }),
    gene({ id: 'RIGHT', start: bpAtColumn(201), end: bpAtColumn(201) + 150, strand: '+' }),
  ];
  const { view, restore } = mount({ genes });
  try {
    const band = view.bands()[0];
    const columns = [...columnOccupancy(band.scale, band.track.marks, band).keys()];
    assert.deepEqual(columns, ['above#200', 'above#201']);
    for (const mark of band.track.marks) {
      assert.equal(pieceRect(band.scale, mark.pieces[0]).width, 1, 'each bar is one column wide');
    }
  } finally {
    restore();
  }
});

test('a click inside a one-pixel bar selects that bar, not its higher-ranked neighbour', () => {
  // The defect this pins: a 1 px bar was given a 2 px hit rectangle, so the bar
  // in column 200 sat at distance zero from a pointer in column 201 and, being
  // reviewed where its neighbour is derived, won the click inside the bar the
  // reader was pointing at. 166 of 787 shared columns at 1440 px went that way.
  const genes = [
    gene({ id: 'REVIEWED_LEFT', start: bpAtColumn(200), end: bpAtColumn(200) + 150, strand: '+' }),
    gene({ id: 'DERIVED_RIGHT', start: bpAtColumn(201), end: bpAtColumn(201) + 150, strand: '+' }),
  ];
  for (const canvasWidth of [CANVAS_WIDTH]) {
    const { view, restore } = mount({
      genes,
      viewport: { canvasWidth },
      categorical: true,
      categoryOf: () => 0,
      derivedOf: (_row, index) => index === 1,
    });
    try {
      const band = view.bands()[0];
      const y = band.layout.laneAboveTop + 4;
      assert.ok(view.paintRank.get(0) > view.paintRank.get(1),
        'the reviewed CDS really is the higher-ranked one, or this proves nothing');
      assert.equal(view.hitTest(200.5, y), 0, 'its own column still selects the left bar');
      assert.equal(view.hitTest(201.5, y), 1, 'the right bar keeps the clicks inside it');
      // The reach that a 1 px bar needs is not lost: a column that drew nothing
      // still finds the nearest bar.
      assert.equal(view.hitTest(202.6, y), 1);
      assert.equal(view.hitTest(199.4, y), 0);
      assert.equal(view.hitTest(250, y), -1, 'and it does not reach across the whole track');
    } finally {
      restore();
    }
  }
});

test('the click follows the picture at every stage width and device pixel ratio', () => {
  // Widths stand in for the four rendered viewports; the ratio is threaded
  // through because the hit test is measured in CSS columns and the bitmap is
  // not. Both filter states, because "Show filtered-out genes" changes which
  // CDSs are drawn and therefore which column shows what.
  for (const canvasWidth of [343, 736, 1248, 1408]) {
    for (const devicePixelRatio of [1, 2]) {
      for (const showHidden of [true, false]) {
        const bandWidth = canvasWidth - 32;
        const perColumn = CHROMOSOME_BP / bandWidth;
        const atColumn = (column) => Math.round(1 + (column - BAND_LEFT) * perColumn);
        const genes = [
          gene({ id: 'A', start: atColumn(120), end: atColumn(120) + 120, strand: '+' }),
          gene({ id: 'B', start: atColumn(121), end: atColumn(121) + 120, strand: '+' }),
          gene({ id: 'C', start: atColumn(122), end: atColumn(122) + 120, strand: '+' }),
        ];
        const { view, restore } = mount({
          genes,
          viewport: { canvasWidth, devicePixelRatio },
          showHidden,
          mask: Uint8Array.from([1, 0, 1]),
          categorical: true,
          categoryOf: () => 0,
          derivedOf: (_row, index) => index !== 1,
        });
        try {
          const band = view.bands()[0];
          const y = band.layout.laneAboveTop + 4;
          const where = `${canvasWidth}px, ratio ${devicePixelRatio}, showHidden ${showHidden}`;
          assert.equal(view.hitTest(120.5, y), 0, `column 120 at ${where}`);
          assert.equal(view.hitTest(122.5, y), 2, `column 122 at ${where}`);
          // The filtered-out CDS in the middle column is what the column shows
          // while ghosts are drawn, and nothing is drawn there once they are not.
          assert.equal(view.hitTest(121.5, y), showHidden ? 1 : 0, `column 121 at ${where}`);
        } finally {
          restore();
        }
      }
    }
  }
});

/**
 * Owner decision D2's counterexample, from the review of `b6e21e9`: a CDS two
 * columns wide carrying category A, three of A in the left column, and two of
 * category B in the right one. The right column holds one A against two B, so
 * B is its majority — but scoring the wide CDS by the column its first piece
 * landed on gave it A's majority of three and painted A over both.
 */
const SPANNING = [
  gene({
    id: 'WIDE_A', strand: '+',
    start: bpAtColumn(200),
    end: bpAtColumn(200) + Math.round(2 * BP_PER_COLUMN) - 1,
  }),
  gene({ id: 'A1', start: bpAtColumn(200) + 100, end: bpAtColumn(200) + 250, strand: '+' }),
  gene({ id: 'A2', start: bpAtColumn(200) + 300, end: bpAtColumn(200) + 450, strand: '+' }),
  gene({ id: 'B1', start: bpAtColumn(201), end: bpAtColumn(201) + 150, strand: '+' }),
  gene({ id: 'B2', start: bpAtColumn(201) + 200, end: bpAtColumn(201) + 350, strand: '+' }),
];

/** The fixture's colour: WIDE_A, A1, A2 in bucket 0, B1 and B2 in bucket 1. */
const SPANNING_COLOR = {
  categorical: true,
  categoryOf: (_row, index) => (index >= 3 ? 1 : 0),
  derivedOf: () => true,
};

test('the spanning fixture really puts one A against two B in the right column', () => {
  const { view, restore } = mount({ genes: SPANNING, ...SPANNING_COLOR });
  try {
    const band = view.bands()[0];
    const columns = columnOccupancy(band.scale, band.track.marks, band);
    assert.deepEqual(columns.get('above#200'), [0, 1, 2]);
    assert.deepEqual(columns.get('above#201'), [0, 3, 4]);
    assert.equal(pieceColumns(band.scale, band.track.marks[0].pieces[0]).last, 201,
      'the wide CDS reaches the right column');
  } finally {
    restore();
  }
});

test('owner decision D2: each column shows its own majority, not another column’s', () => {
  const { view, restore, ops } = mount({ genes: SPANNING, ...SPANNING_COLOR });
  try {
    const buckets = view.model.colors.scale.buckets;
    assert.equal(paintsAt(view, ops, 200.5).at(-1).fill, buckets[0],
      'three of A against nothing: the left column shows A');
    assert.equal(paintsAt(view, ops, 201.5).at(-1).fill, buckets[1],
      'one A against two B: the right column shows B, not the wide CDS');
    // And the click agrees with the pixels in both columns.
    const y = view.bands()[0].layout.laneAboveTop + 4;
    assert.equal(view.hitTest(200.5, y), 0);
    assert.equal(view.hitTest(201.5, y), 3, 'B1 is the earlier of the two B loci');
  } finally {
    restore();
  }
});

test('a column majority counts only the CDSs the filters keep, in that column', () => {
  // Filtering out B2 leaves one A against one B in the right column, so the
  // majority no longer decides it and the earlier locus does — the wide A. An
  // excluded CDS that still voted would keep B on top, with the ghosts drawn
  // and with them hidden alike.
  for (const showHidden of [true, false]) {
    const { view, restore, ops } = mount({
      genes: SPANNING,
      ...SPANNING_COLOR,
      showHidden,
      mask: Uint8Array.from([1, 1, 1, 1, 0]),
    });
    try {
      const buckets = view.model.colors.scale.buckets;
      assert.equal(paintsAt(view, ops, 201.5).at(-1).fill, buckets[0],
        `one against one: the right column shows A with showHidden ${showHidden}`);
      assert.equal(paintsAt(view, ops, 200.5).at(-1).fill, buckets[0],
        `and the left column still shows A with showHidden ${showHidden}`);
    } finally {
      restore();
    }
  }
});

test('owner decision D1: a CDS with one narrow segment and one wide one is counted', () => {
  // `M744_RS00920` at 1280 px is drawn as segments of 1.9 and 27.9 px: the
  // narrow one is solid under D1 while the wide one keeps the hollow style.
  // Counting only the CDSs whose *every* segment was narrow left it out, so the
  // disclosure said no derived category was drawn solid while one was.
  const narrowFrom = bpAtColumn(200);
  const wideFrom = bpAtColumn(260);
  const genes = [
    gene({
      id: 'MIXED_WIDTHS',
      strand: '+',
      start: narrowFrom,
      end: wideFrom + Math.round(10 * BP_PER_COLUMN),
      cdsSegments: [
        [narrowFrom, narrowFrom + 150],
        [wideFrom, wideFrom + Math.round(10 * BP_PER_COLUMN)],
      ],
    }),
  ];
  const { view, restore, ops } = mount({
    genes, categorical: true, categoryOf: () => 0, derivedOf: () => true,
  });
  try {
    const band = view.bands()[0];
    const [narrow, wide] = band.track.marks[0].pieces
      .map((piece) => pieceRect(band.scale, piece));
    assert.ok(narrow.width < MIN_HOLLOW_MARK_PX, 'one segment is under the threshold');
    assert.ok(wide.width >= MIN_HOLLOW_MARK_PX, 'and the other is over it');
    const color = view.model.colors.scale.buckets[0];
    assert.equal(paintsAt(view, ops, narrow.left + 0.5).at(-1).fill, color,
      'the narrow segment is drawn in its full category colour');
    assert.equal(paintsAt(view, ops, wide.left + 2).at(-1).fill, DERIVED_MARKER_FILL,
      'the wide one keeps the pale hollow fill');
    assert.equal(view.drawStats.alikeDerived, 1, 'the CDS is counted once');
    assert.match(disclosureText(view),
      /1 source-derived category draws in the solid colour a lab-reviewed category takes/);
    assert.match(disclosureText(view), /segment by segment/);
  } finally {
    restore();
  }
});

test('crowding counts only the columns the band draws into', () => {
  // The review's case: at a 500 bp window one CDS spans 1,769 bp, and the
  // unclamped count reported 1,883 "occupied columns" on a canvas a few hundred
  // pixels wide. A figure the reader is told about the picture cannot count
  // columns outside it.
  const genes = [
    gene({ id: 'WIDER_THAN_THE_WINDOW', start: 99565, end: 101334, strand: '+' }),
    gene({ id: 'ELSEWHERE', start: 2000000, end: 2000500, strand: '+' }),
  ];
  const { view, restore, flush } = mount({ genes });
  try {
    view.windows.set(CHROMOSOME, { from: 100000, to: 100499 });
    view.draw();
    flush();
    const band = view.bands()[0];
    const drawn = columnOccupancy(band.scale, band.track.marks, band);
    const unbounded = columnOccupancy(band.scale, band.track.marks);
    assert.ok(unbounded.size > 3000, 'unclamped, one CDS claims thousands of columns');
    assert.equal(drawn.size, BAND_WIDTH, 'clamped, it claims the columns the band has');
    assert.deepEqual(view.drawStats.columns,
      { occupied: BAND_WIDTH, shared: 0, median: 1, max: 1 });
    assert.match(view.canvas.getAttribute('aria-label'),
      new RegExp(`each of the ${BAND_WIDTH.toLocaleString('en-US')} occupied columns`));
  } finally {
    restore();
  }
});

test('crowding leaves out the far piece of an origin-crossing CDS', () => {
  // `M744_RS13290` opens the plasmid at base 1 and closes it at 46,366. A
  // window over one end must not be told about the columns the other end would
  // take at this scale.
  const { view, restore, flush } = mount();
  try {
    view.windows.set(PLASMID_B, { from: 1, to: 3000 });
    view.draw();
    flush();
    const band = view.bands().find((entry) => entry.track.accession === PLASMID_B);
    const drawn = columnOccupancy(band.scale, band.track.marks, band);
    const columns = [...drawn.keys()].map(columnOfKey);
    const bounds = drawnColumns(band);
    assert.ok(columns.length > 0, 'the opening piece is drawn');
    assert.ok(Math.max(...columns) <= bounds.last,
      'and nothing is counted past the right edge of the band');
    assert.ok(Math.min(...columns) >= bounds.first, 'nor before its left edge');
    assert.deepEqual(bounds, { first: BAND_LEFT, last: BAND_LEFT + BAND_WIDTH - 1 });
  } finally {
    restore();
  }
});

test('a colour channel with no values reads NaN rather than throwing', () => {
  const { view, restore } = mount({ genes: CROWDED });
  try {
    assert.equal(Number.isFinite(view.colorValueOf(0)), true);
    view.model.colors = { ...view.model.colors, values: null };
    assert.ok(Number.isNaN(view.colorValueOf(0)),
      'the shared rule puts a gene with no value in its own tier, so this is not an error');
    assert.equal(view.hasColorValue(0), false);
    assert.equal(view.colorBucketOf(0), -1);
  } finally {
    restore();
  }
});

test('an uncategorised CDS in a resolved column votes for no category', () => {
  // `columnMajority` is asked about every CDS in the column, including one the
  // colour has no bucket for, and an unknown has no category to be a majority of.
  const { view, restore, ops } = mount({
    genes: CROWDED,
    categorical: true,
    // SHARE_A unknown, the rest all in category 0 and derived.
    categoryOf: (_row, index) => (index === 0 ? -1 : 0),
    derivedOf: () => true,
  });
  try {
    const band = view.bands()[0];
    const key = `above#${Math.round(band.scale.bpToX(100000))}`;
    const members = columnOccupancy(band.scale, band.track.marks, band).get(key);
    const majority = view.paintModel(members).columnMajority;
    assert.equal(view.colorBucketOf(0), -1, 'SHARE_A really has no category');
    assert.equal(majority(0), 0, 'an unknown counts for nothing');
    assert.equal(majority(1), 3, 'and the three categorised CDSs count for each other');
    const buckets = view.model.colors.scale.buckets;
    assert.equal(paintsAt(view, ops, Number(columnOfKey(key)) + 0.5).at(-1).fill, buckets[0],
      'so the column shows the category, not the unknown');
    assert.equal(view.drawStats.alikeDerived, 3, 'and only the categorised ones are counted');
  } finally {
    restore();
  }
});

test('owner decision D1 counts only the segments this band actually drew', () => {
  // A CDS with one segment in the window and one far outside it: the segment
  // the band never drew cannot make the CDS solid, and the one it drew can.
  const inWindow = bpAtColumn(200);
  const genes = [
    gene({
      id: 'HALF_OFFSCREEN',
      strand: '+',
      start: inWindow,
      end: inWindow + 1500000,
      cdsSegments: [[inWindow, inWindow + 150], [inWindow + 1400000, inWindow + 1500000]],
    }),
  ];
  const { view, restore, flush } = mount({
    genes, categorical: true, categoryOf: () => 0, derivedOf: () => true,
  });
  try {
    // Whole genome: both segments are on the canvas, the near one sub-pixel.
    assert.equal(view.drawStats.alikeDerived, 1);
    // A window holding only the wide far segment: nothing narrow is drawn.
    view.windows.set(CHROMOSOME, { from: inWindow + 1400000, to: inWindow + 1500000 });
    view.draw();
    flush();
    assert.equal(view.drawStats.alikeDerived, 0,
      'the off-screen narrow segment is not counted');
    assert.doesNotMatch(disclosureText(view), /source-derived categor/,
      'with nothing drawn solid there is no D1 notice to make');
  } finally {
    restore();
  }
});

test('a pointer between the two lanes hits nothing', () => {
  const { view, restore } = mount({ genes: CROWDED });
  try {
    const band = view.bands()[0];
    assert.equal(view.hitTest(200, band.layout.tssTop + 1), -1, 'above the plus lane');
    assert.equal(view.hitTest(200, band.layout.bracketBelowTop + 6), -1, 'below the minus lane');
  } finally {
    restore();
  }
});

test('the reach out of an empty column prefers a passing CDS and the mark on top', () => {
  // Nothing is drawn on the pointer's own column, so the enlarged target
  // applies. A ghost two columns away loses to a passing CDS the same distance
  // off, and between two equally distant passing bars the one the picture shows
  // on top wins.
  const genes = [
    gene({ id: 'GHOST_LEFT', start: bpAtColumn(198), end: bpAtColumn(198) + 120, strand: '+' }),
    gene({ id: 'PASSING_RIGHT', start: bpAtColumn(202), end: bpAtColumn(202) + 120, strand: '+' }),
  ];
  const { view, restore } = mount({
    genes,
    mask: Uint8Array.from([0, 1]),
    categorical: true,
    categoryOf: () => 0,
    derivedOf: () => false,
  });
  try {
    const band = view.bands()[0];
    const y = band.layout.laneAboveTop + 4;
    assert.equal(view.columnShown.get(`${CHROMOSOME}#above#200`), undefined,
      'column 200 really is empty');
    assert.equal(view.hitTest(200.0, y), 1,
      'two columns from each, the passing CDS wins over the ghost');
    // Far enough from both and the reach runs out.
    assert.equal(view.hitTest(210, y), -1);
  } finally {
    restore();
  }
});

test('outside an occupied column the higher-ranked of two equal distances wins', () => {
  const genes = [
    gene({ id: 'DERIVED_LEFT', start: bpAtColumn(199), end: bpAtColumn(199) + 120, strand: '+' }),
    gene({ id: 'REVIEWED_RIGHT', start: bpAtColumn(203), end: bpAtColumn(203) + 120, strand: '+' }),
  ];
  const { view, restore } = mount({
    genes,
    categorical: true,
    categoryOf: () => 0,
    derivedOf: (_row, index) => index === 0,
  });
  try {
    const band = view.bands()[0];
    const y = band.layout.laneAboveTop + 4;
    // Column 201 drew nothing and sits between the two bars. The left bar's
    // enlarged target reaches 201; the right bar's own left edge is 203, two
    // columns away, so the left bar is the nearer one.
    assert.equal(view.columnShown.get(`${CHROMOSOME}#above#201`), undefined);
    assert.equal(view.hitTest(201.5, y), 0);
    assert.ok(view.paintRank.get(1) > view.paintRank.get(0),
      'the reviewed CDS is the higher-ranked one');
    // Equidistant from both: the reviewed CDS is on top, so it takes the click.
    assert.equal(view.hitTest(202.0, y), 1);
  } finally {
    restore();
  }
});

test('an organism with no start-site layer gets no tick row and no copy-number claim', () => {
  const ecoli = organismById('ecoli-k12-mg1655');
  const meta = { genome: { accession: ecoli.genome.accession, totalLength: 4641652 } };
  const site = {
    id: 'gTSS-1', position: 100020, strand: '+', replicon: 'NC_000913.3', sourceStartDistanceNt: 20,
  };
  // Even a gene that somehow carries a start-site list draws none of it: the
  // layer is the organism's to declare, not the record's to supply.
  const genes = [
    gene({ id: 'b0001', seqid: 'NC_000913.3', start: 100040, end: 101000, tssEvidence: [site] }),
    gene({ id: 'b0002', seqid: 'NC_000913.3', start: 200000, end: 201000, strand: '-' }),
  ];
  const tracksFor = (organism) => repliconTracks(genes, meta, organism.genome);
  const { restore, frames } = install();
  try {
    const host = new FakeElement('div');
    const view = new ChromosomeView(host, {}, { organism: ecoli });
    view.update({ ...viewModel({ genes, meta }), ...tracksFor(ecoli) });
    for (const frame of frames.splice(0, frames.length)) frame();
    assert.equal(view.model.verified, true);
    assert.deepEqual(view.model.tracks.map((track) => track.accession), ['NC_000913.3']);
    assert.deepEqual(view.layers.get('NC_000913.3').tss, []);
    // The conventions note says nothing of a tick row that will never fill.
    assert.ok(!/start site/i.test(view.markerNote.textContent));
    assert.match(view.markerNote.textContent, /Operon brackets .* fill in as you zoom\./);
    // No copy-number paragraph, and none in the description either.
    const copyNumber = host.children[0];
    assert.equal(copyNumber.hidden, true);
    assert.equal(copyNumber.textContent, '');
    const description = view.canvas.getAttribute('aria-label');
    assert.match(description, /^Linear map of 2 plotted CDSs/);
    assert.match(description, /NC_000913\.3, the 4\.64 Mb chromosome/);
    assert.ok(!/per genome copy|copies per cell/.test(description));
    assert.equal(view.evidenceNote.textContent, ecoli.copy.coordinateEvidenceNote);
    assert.ok(!/UTEX|Tan 2018|sister-strain/.test(host.textContent));
  } finally {
    restore();
  }
});

test('the default organism still draws its start sites and states its copy number', () => {
  const site = {
    id: 'gTSS-1', position: 99980, strand: '+', replicon: 'CP006471', sourceStartDistanceNt: 20,
  };
  const genes = [gene({ id: 'PLUS', start: 100000, end: 101000, tssEvidence: [site] })];
  const { restore, frames } = install();
  try {
    const host = new FakeElement('div');
    const view = new ChromosomeView(host, {});
    view.update(viewModel({ genes }));
    for (const frame of frames.splice(0, frames.length)) frame();
    assert.equal(view.layers.get(CHROMOSOME).tss.length, 1);
    assert.equal(host.children[0].hidden, false);
    assert.match(host.children[0].textContent, /present in many copies per cell/);
    assert.match(view.canvas.getAttribute('aria-label'), /present in multiple copies per cell/);
    assert.match(view.evidenceNote.textContent, /offset against a named UTEX locus/);
    assert.match(view.markerNote.textContent, /Tan 2018 gene-linked start sites on the tick row/);
  } finally {
    restore();
  }
});
