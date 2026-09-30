import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHROMOSOME_TAB, ChromosomeView, bandLayout, canvasHeightFor, fitTickLabels, fitTrackLabel,
  trackLabelVariants,
} from '../../site/js/ui/chromosome-view.js';
import { repliconTracks } from '../../site/js/core/chromosome-model.js';
import { buildCategoryColorScale, buildColorScale } from '../../site/js/ui/colors.js';
import {
  valueScaleAvailability, valueScaleClause, valueScaleTransform,
} from '../../site/js/core/value-scales.js';
import { CATEGORICAL_SCALE_REASON, scaleControlState } from '../../site/js/ui/scale-select.js';
import { resetConfirmDialogForTests } from '../../site/js/ui/confirm-dialog.js';

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
      fillRect: (x, y, w, h) => record({ op: 'fillRect', x, y, w, h, fill: context.fillStyle }),
      strokeRect: (x, y, w, h) => record({ op: 'strokeRect', x, y, w, h, stroke: context.strokeStyle }),
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
function colorModel(genes, { colorScale, categorical }) {
  const values = colorValues(genes);
  if (categorical) {
    return {
      values: Float64Array.from(genes.map((_, index) => index % 2),
      ),
      scale: buildCategoryColorScale(2),
      derived: new Map(),
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
} = {}) {
  const colorMode = { colorScale, categorical };
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
    pinned: -1,
    hovered: -1,
    active: -1,
    shortlist: new Set(),
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

test('Reset view asks first, as every reset control does', async () => {
  const { view, document, restore } = mount({ handlers: { onAnnounce: () => {} } });
  try {
    const band = view.bands()[0];
    view.zoomBand(band, 400, 100000);
    const zoomed = view.windowFor(band.track);

    view.resetButton.dispatch('click');
    await settled();
    const asked = confirmParts(document);
    assert.ok(asked, 'the reset control opens the shared confirmation');
    assert.equal(asked.backdrop.hidden, false);
    assert.equal(asked.confirm.textContent, 'Reset view');
    assert.deepEqual(view.windowFor(band.track), zoomed, 'nothing is discarded before the answer');

    asked.cancel.dispatch('click');
    await settled();
    assert.deepEqual(view.windowFor(band.track), zoomed, 'Cancel keeps the windows');

    view.resetButton.dispatch('click');
    await settled();
    confirmParts(document).confirm.dispatch('click');
    await settled();
    assert.deepEqual(view.windowFor(band.track), { from: 1, to: band.track.lengthBp });
  } finally {
    restore();
  }
});
