/**
 * What the scatter map actually issues, in order, when points overlap.
 *
 * The order is the whole subject, so these tests drive a real `ScatterPlot`
 * against a recording 2D context rather than asserting on the bucket lists
 * alone: the lists could be right and the draw loop still issue them in the
 * wrong sequence, which is exactly the defect the baseline measured — the open
 * markers for genes with no value were issued last and crossed the coloured
 * points they should have been under.
 *
 * The fake throws on anything the plot touches that is not modelled, so a new
 * drawing dependency fails loudly instead of being silently skipped.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ScatterPlot, bucketDrawOrder, buildMarkerBuckets,
} from '../../site/js/ui/scatter.js';
import { buildCategoryColorScale, MISSING_COLOR } from '../../site/js/ui/colors.js';

const WIDTH = 400;
const HEIGHT = 300;

/** A 2D context that records the fill colour of every batch, in issue order. */
function recordingContext(ops) {
  const context = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    clearRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    fillText: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    rect: () => {},
    clip: () => {},
    save: () => {},
    restore: () => {},
    setTransform: () => {},
    translate: () => {},
    rotate: () => {},
    measureText: (text) => ({ width: text.length * 6 }),
    fill: () => ops.push({ op: 'fill', color: context.fillStyle }),
    stroke: () => ops.push({ op: 'stroke', color: context.strokeStyle }),
  };
  return context;
}

function fakeCanvas(ops) {
  const context = recordingContext(ops);
  return {
    width: 0,
    height: 0,
    style: {},
    parentElement: null,
    getContext: () => context,
    addEventListener: () => {},
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    focus: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: WIDTH, height: HEIGHT }),
  };
}

/**
 * Drive a plot to one finished frame and hand back the batches it issued.
 *
 * `requestAnimationFrame` is queued rather than run inline, as a browser does,
 * so the plot's own frame handle clears and later redraws are not suppressed.
 */
function paint(setUp) {
  const previous = {
    window: globalThis.window,
    ResizeObserver: globalThis.ResizeObserver,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    performance: globalThis.performance,
  };
  const frames = [];
  globalThis.window = { devicePixelRatio: 1 };
  globalThis.requestAnimationFrame = (callback) => frames.push(callback);
  globalThis.ResizeObserver = class {
    observe() {}

    disconnect() {}
  };
  globalThis.performance = previous.performance ?? { now: () => 0 };
  const ops = [];
  try {
    const plot = new ScatterPlot(fakeCanvas(ops), {});
    setUp(plot);
    ops.length = 0;
    const queued = frames.splice(0, frames.length);
    for (const frame of queued) frame();
    return ops;
  } finally {
    Object.assign(globalThis, previous);
  }
}

/** Five points on a line: values 1, 2, 3, no value, 5. */
const PROJECTION = {
  available: true,
  x: Float64Array.from([0, 1, 2, 3, 4]),
  y: Float64Array.from([0, 0, 0, 0, 0]),
  xLabel: 'x',
  yLabel: 'y',
};
const VALUES = Float64Array.from([1, 2, 3, NaN, 5]);

/** Value 1 lands in bucket 0, value 5 in bucket 4, anything outside is clamped. */
const bucketIndex = (value) => Math.min(4, Math.max(0, Math.round(value) - 1));

/** A five-bucket ramp whose colours name their own bucket, so order is readable. */
const RAMP = {
  categorical: false,
  buckets: ['b0', 'b1', 'b2', 'b3', 'b4'],
  bucketOf: (value) => (Number.isFinite(value) ? bucketIndex(value) : -1),
  color: (value) => `b${bucketIndex(value)}`,
};

/** The colour of each batch that painted something, in issue order. */
function fills(ops) {
  return ops.filter((entry) => entry.op === 'fill').map((entry) => entry.color);
}

test('the bucket order ascends by value under the default direction', () => {
  assert.deepEqual([...bucketDrawOrder(4, RAMP, 'highest')], [0, 1, 2, 3]);
  assert.deepEqual([...bucketDrawOrder(4, RAMP, undefined)], [0, 1, 2, 3]);
});

test('the lowest direction reverses the bucket order, and only for a value ramp', () => {
  assert.deepEqual([...bucketDrawOrder(4, RAMP, 'lowest')], [3, 2, 1, 0]);
  const categories = buildCategoryColorScale(3);
  assert.deepEqual([...bucketDrawOrder(4, categories, 'lowest')], [0, 1, 2, 3]);
});

test('the order travels with the buckets, so a frame replays it and never sorts', () => {
  const buckets = buildMarkerBuckets(
    PROJECTION.x, PROJECTION.y, null, RAMP, VALUES, null, 'lowest',
  );
  assert.deepEqual([...buckets.order], [4, 3, 2, 1, 0]);
  assert.deepEqual([...buckets.missing], [3]);
});

test('a point with no value is issued before every coloured batch, so it is under them', () => {
  const ops = paint((plot) => {
    plot.setProjection(PROJECTION);
    plot.setColor({ values: VALUES, scale: RAMP, derived: null });
  });
  const missingAt = ops.findIndex(
    (entry) => entry.op === 'stroke' && entry.color === MISSING_COLOR,
  );
  const firstColorAt = ops.findIndex((entry) => entry.op === 'fill' && entry.color.startsWith('b'));
  assert.ok(missingAt >= 0 && firstColorAt >= 0);
  assert.ok(missingAt < firstColorAt,
    'the missing-value markers must be issued before the coloured points');
});

test('coloured batches are issued lowest value first, so the highest lands on top', () => {
  const ops = paint((plot) => {
    plot.setProjection(PROJECTION);
    plot.setColor({ values: VALUES, scale: RAMP, derived: null });
  });
  assert.deepEqual(fills(ops).filter((color) => color.startsWith('b')), ['b0', 'b1', 'b2', 'b4']);
});

test('the lowest direction issues them the other way round, and nothing else moves', () => {
  const ops = paint((plot) => {
    plot.setProjection(PROJECTION);
    plot.setColor({ values: VALUES, scale: RAMP, derived: null });
    plot.setDrawDirection('lowest');
  });
  assert.deepEqual(fills(ops).filter((color) => color.startsWith('b')), ['b4', 'b2', 'b1', 'b0']);
  const missingAt = ops.findIndex(
    (entry) => entry.op === 'stroke' && entry.color === MISSING_COLOR,
  );
  const firstColorAt = ops.findIndex((entry) => entry.op === 'fill' && entry.color.startsWith('b'));
  assert.ok(missingAt < firstColorAt, 'absence is not a low value: it stays underneath');
});

test('setting the same direction again does not drop the cached buckets', () => {
  paint((plot) => {
    plot.setProjection(PROJECTION);
    plot.setColor({ values: VALUES, scale: RAMP, derived: null });
    plot.rebuildBuckets();
    const cached = plot.buckets;
    plot.setDrawDirection('highest');
    assert.equal(plot.buckets, cached);
    plot.setDrawDirection('lowest');
    assert.equal(plot.buckets, null, 'a real change has to rebuild the recorded order');
  });
});

test('in category colour a reviewed category is issued after the derived ones', () => {
  const scale = buildCategoryColorScale(2);
  // Genes 0 and 1 are derived, gene 2 is reviewed, gene 3 has no category.
  const values = Int16Array.from([0, 1, 0, -1]);
  const derived = Uint8Array.from([1, 1, 0, 0]);
  const ops = paint((plot) => {
    plot.setProjection({
      available: true,
      x: Float64Array.from([0, 1, 2, 3]),
      y: Float64Array.from([0, 0, 0, 0]),
      xLabel: 'x',
      yLabel: 'y',
    });
    plot.setColor({ values, scale, derived });
  });
  const colours = fills(ops);
  // The hollow derived marker fills white first; the reviewed category colour
  // is issued after it, so a reviewed point is the one seen where they overlap.
  const lastDerived = colours.lastIndexOf('#ffffff');
  const reviewed = colours.lastIndexOf(scale.buckets[0]);
  assert.ok(lastDerived >= 0, 'the derived hollow discs are drawn');
  assert.ok(reviewed > lastDerived,
    'the reviewed batch must be issued after the derived one');
});
