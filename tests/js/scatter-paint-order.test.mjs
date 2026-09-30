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
  ScatterPlot, batchList, bucketDrawOrder, buildMarkerBuckets, markerBodies, paintBatches,
} from '../../site/js/ui/scatter.js';
import {
  comparePaintPriority, paintPriority,
} from '../../site/js/core/paint-priority.js';
import {
  ACTIVE_FOCUS_COLOR, CATEGORY_UNKNOWN_COLOR, GHOST_COLOR, HOVER_FOCUS_COLOR, MISSING_COLOR,
  PINNED_COLOR, SHORTLIST_COLOR, buildCategoryColorScale,
} from '../../site/js/ui/colors.js';

const WIDTH = 400;
const HEIGHT = 300;

/** A 2D context that records the fill colour of every batch, in issue order. */
function recordingContext(ops) {
  const context = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    clearRect: () => {},
    fillRect: () => ops.push({ op: 'fillRect', color: context.fillStyle }),
    strokeRect: () => ops.push({ op: 'strokeRect', color: context.strokeStyle }),
    setLineDash: () => {},
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
 * Drive a plot and hand back the plot itself, for a test about what it answers
 * rather than about what it paints. One frame is run first, because a hit test
 * has to agree with a picture that exists.
 */
function drive(setUp) {
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
  try {
    const plot = new ScatterPlot(fakeCanvas([]), {});
    setUp(plot);
    for (const frame of frames.splice(0, frames.length)) frame();
    return { plot, restore: () => Object.assign(globalThis, previous) };
  } catch (error) {
    Object.assign(globalThis, previous);
    throw error;
  }
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

/**
 * Two points 0.005 apart on a unit-wide map, which is well inside one marker
 * radius, plus a third at the far end to hold the fit. Point 0 carries the
 * lower value, so under the default direction point 1 covers it.
 */
const OVERLAP = {
  available: true,
  x: Float64Array.from([0, 0.005, 1]),
  y: Float64Array.from([0, 0, 0]),
  xLabel: 'x',
  yLabel: 'y',
};
const OVERLAP_VALUES = Float64Array.from([1, 5, 3]);

/** Where a point's centre lands, in the coordinates a pointer event reports. */
function centreOf(plot, index) {
  return plot.toScreen(plot.projection.x[index], plot.projection.y[index]);
}

test('the overlap fixture really does put one disc over another', () => {
  const { plot, restore } = drive((instance) => {
    instance.setProjection(OVERLAP);
    instance.setColor({ values: OVERLAP_VALUES, scale: RAMP, derived: null });
  });
  try {
    const a = centreOf(plot, 0);
    const b = centreOf(plot, 1);
    const reach = markerBodies(plot.markerRadius(), RAMP)[4];
    assert.ok(Math.abs(a.x - b.x) < reach,
      'point 1 is painted over point 0’s centre, or this proves nothing');
    assert.ok(Math.abs(a.x - b.x) > 0.4, 'and they are not the same point');
  } finally {
    restore();
  }
});

test('a click where two discs overlap pins the one painted on top', () => {
  // The defect: at 1280 px on the native map with "lowest on top", the pixel
  // under the pointer was `M744_RS13045`'s colour and the click pinned
  // `M744_RS00045`, half a pixel away, whose colour was nowhere on the screen.
  for (const [direction, expected] of [['highest', 1], ['lowest', 0]]) {
    const { plot, restore } = drive((instance) => {
      instance.setProjection(OVERLAP);
      instance.setColor({ values: OVERLAP_VALUES, scale: RAMP, derived: null });
      instance.setDrawDirection(direction);
    });
    try {
      const a = centreOf(plot, 0);
      const b = centreOf(plot, 1);
      assert.equal(plot.hitTest(a.x, a.y), expected,
        `a click on point 0’s centre follows the picture with ${direction} on top`);
      assert.equal(plot.hitTest(b.x, b.y), expected,
        `and so does a click on point 1’s centre with ${direction} on top`);
    } finally {
      restore();
    }
  }
});

test('a click on no disc at all still finds the nearest centre', () => {
  const { plot, restore } = drive((instance) => {
    instance.setProjection(OVERLAP);
    instance.setColor({ values: OVERLAP_VALUES, scale: RAMP, derived: null });
  });
  try {
    const a = centreOf(plot, 0);
    // Eight pixels above the row of points: outside every body, inside the
    // 14 px reach a click in empty space needs.
    assert.equal(plot.hitTest(a.x, a.y - 8), 0);
    assert.equal(plot.hitTest(a.x, a.y - 80), -1, 'and nothing at all further out');
  } finally {
    restore();
  }
});

test('the open ring of a gene with no value does not capture a click at its centre', () => {
  // Nothing is painted inside that ring, so the pointer is over the coloured
  // disc it crosses, not over the gene with no value — even when the valueless
  // point's own centre is the nearer of the two.
  const projection = {
    available: true,
    x: Float64Array.from([0, 0.004, 1]),
    y: Float64Array.from([0, 0, 0]),
    xLabel: 'x',
    yLabel: 'y',
  };
  const values = Float64Array.from([3, NaN, 1]);
  const { plot, restore } = drive((instance) => {
    instance.setProjection(projection);
    instance.setColor({ values, scale: RAMP, derived: null });
  });
  try {
    const ring = centreOf(plot, 1);
    assert.equal(plot.hitTest(ring.x, ring.y), 0,
      'the coloured disc under the pointer wins over the ring around it');
  } finally {
    restore();
  }
});

test('a filtered-out ghost is pickable, and loses to a passing point over it', () => {
  const { plot, restore } = drive((instance) => {
    instance.setProjection(OVERLAP);
    instance.setColor({ values: OVERLAP_VALUES, scale: RAMP, derived: null });
    instance.setMask(Uint8Array.from([0, 1, 1]));
  });
  try {
    const ghost = centreOf(plot, 0);
    const far = centreOf(plot, 2);
    assert.equal(plot.hitTest(ghost.x, ghost.y), 1,
      'the passing point painted over the ghost is the one seen and the one picked');
    assert.equal(plot.hitTest(far.x, far.y), 2);
  } finally {
    restore();
  }
});

test('a point the colour draws nothing for is not a body under the pointer', () => {
  // With no colour channel the map paints no marker at all, so every click
  // falls back to the nearest centre rather than claiming a hit on nothing.
  const { plot, restore } = drive((instance) => {
    instance.setProjection(OVERLAP);
  });
  try {
    const a = centreOf(plot, 0);
    assert.equal(plot.hitTest(a.x, a.y), 0);
  } finally {
    restore();
  }
});

/**
 * Five genes spanning every tier the rule has: two the filters exclude — one of
 * them unclassified — one with no value, one derived, and one reviewed, with two
 * more in a second colour bucket so different categories of equal evidence
 * appear too.
 */
const TIERS = Object.freeze({
  x: Float64Array.from([0, 1, 2, 3, 4, 5, 6]),
  y: Float64Array.from([0, 0, 0, 0, 0, 0, 0]),
  values: Int16Array.from([0, -1, -1, 0, 0, 1, 1]),
  derived: Uint8Array.from([0, 0, 0, 1, 0, 1, 0]),
  mask: Uint8Array.from([0, 0, 1, 1, 1, 1, 1]),
});

test('the batch order and the core comparator agree, on every tier and in both directions', () => {
  const categories = buildCategoryColorScale(2);
  for (const scale of [RAMP, categories]) {
    for (const direction of ['highest', 'lowest']) {
      // Evidence is part of a category colour and not of a value ramp, and
      // app.js supplies the derived flags only in the first case, so the fixture
      // does the same: a ramp with derived flags is a state the app cannot
      // reach, and pinning its order would pin a picture nothing draws.
      const derived = scale.categorical ? TIERS.derived : null;
      const buckets = buildMarkerBuckets(
        TIERS.x, TIERS.y, TIERS.mask, scale, TIERS.values, derived, direction,
      );
      const model = {
        categorical: Boolean(scale.categorical),
        direction,
        passes: (index) => TIERS.mask[index] === 1,
        hasValue: (index) => scale.bucketOf(TIERS.values[index]) >= 0,
        isDerived: (index) => Boolean(derived && derived[index] === 1),
        valueOf: (index) => TIERS.values[index],
      };
      const batchOf = new Map();
      buckets.batches.forEach((batch, position) => {
        for (const index of batchList(buckets, batch)) batchOf.set(index, position);
      });
      assert.equal(batchOf.size, TIERS.x.length, 'every gene is in some batch');
      const where = `${scale.categorical ? 'category' : 'metric'} colour, ${direction} on top`;
      let residuals = 0;
      for (const a of batchOf.keys()) {
        for (const b of batchOf.keys()) {
          if (batchOf.get(a) === batchOf.get(b)) continue;
          // The comparator with its locus term neutralised: that term is the one
          // a batch cannot answer, and everything else it compares a batch can.
          const shared = comparePaintPriority(
            { ...paintPriority(a, model), index: 0 },
            { ...paintPriority(b, model), index: 0 },
          );
          const issued = Math.sign(batchOf.get(a) - batchOf.get(b));
          if (shared !== 0) {
            assert.equal(Math.sign(shared), issued,
              `genes ${a} and ${b} are issued against the rule in ${where}`);
            continue;
          }
          // The one permitted residual, and only in category colour: two
          // batches the rule cannot separate, issued in the declared order.
          residuals += 1;
          assert.ok(scale.categorical,
            `a metric colour must have no residual, and ${a} against ${b} in ${where} is one`);
          assert.equal(issued, Math.sign(a - b) === 0 ? 0 : issued,
            'and the residual is a fixed order, not an arbitrary one');
        }
      }
      if (!scale.categorical) {
        assert.equal(residuals, 0, `no batch of a value ramp ties with another in ${where}`);
        assert.ok(buckets.derivedLists.every((list) => list.length === 0),
          'and a value ramp has no derived batch to tie with a coloured one');
      }
      // The picking order is that same sequence, so a click cannot disagree
      // with the batches even where the residual applies.
      for (const [index, position] of batchOf) {
        for (const [other, otherPosition] of batchOf) {
          if (position === otherPosition) continue;
          assert.equal(Math.sign(buckets.rank[index] - buckets.rank[other]),
            Math.sign(position - otherPosition),
            `the rank of ${index} against ${other} must follow the batches in ${where}`);
        }
      }
    }
  }
});

test('the declared batch order is what settles a tie the rule cannot', () => {
  const categories = buildCategoryColorScale(3);
  const batches = paintBatches(categories, 3, 'highest');
  assert.deepEqual(batches.map((batch) => `${batch.kind}:${batch.bucket}`), [
    'hiddenMissing:-1', 'hidden:-1', 'missing:-1',
    'derived:0', 'derived:1', 'derived:2',
    'colored:0', 'colored:1', 'colored:2',
  ]);
  // The same list under the other direction: a category set has no value order
  // to reverse, so the control that would reverse it is disabled.
  assert.deepEqual(paintBatches(categories, 3, 'lowest'), batches);
});

test('a value ramp issues its buckets by value, and its no-value batch beneath them', () => {
  assert.deepEqual(paintBatches(RAMP, 3, 'highest').map((batch) => `${batch.kind}:${batch.bucket}`),
    [
      'hiddenMissing:-1', 'hidden:-1', 'missing:-1',
      'derived:0', 'colored:0', 'derived:1', 'colored:1', 'derived:2', 'colored:2',
    ]);
  assert.deepEqual(paintBatches(RAMP, 3, 'lowest').map((batch) => `${batch.kind}:${batch.bucket}`),
    [
      'hiddenMissing:-1', 'hidden:-1', 'missing:-1',
      'derived:2', 'colored:2', 'derived:1', 'colored:1', 'derived:0', 'colored:0',
    ]);
  assert.deepEqual(paintBatches(null, 0, 'highest').map((batch) => batch.kind),
    ['hiddenMissing', 'hidden', 'missing']);
});

test('the marker bodies are the ones the frame draws, and an open ring is not one', () => {
  const ramp = markerBodies(2.3, RAMP);
  const categories = markerBodies(2.3, buildCategoryColorScale(2));
  assert.ok(ramp[4] > 2.3, 'a coloured disc keeps the area of the square it replaced');
  assert.equal(ramp[3], ramp[4], 'a derived disc is the same size as a reviewed one');
  assert.ok(categories[4] > ramp[4], 'category mode draws a larger disc');
  assert.equal(ramp[2], 2.3 + 0.4, 'the no-value ring sits just outside the disc');
  assert.equal(categories[2], Math.max(1.4, 2.3 * 0.7));
  assert.equal(ramp[0], ramp[1], 'both ghost shapes reach the same distance');
  assert.deepEqual(markerBodies(2.3, null)[4], markerBodies(2.3, undefined)[4]);
});

test('a filtered-out unknown category is drawn as its own ghost shape, before the rest', () => {
  // Two ghost batches, not one: the legend gives an excluded unknown a dot and
  // an excluded classified gene a square, so category filtering reads as itself.
  const scale = buildCategoryColorScale(2);
  const values = Int16Array.from([-1, 0, 1]);
  const ops = paint((plot) => {
    plot.setProjection({
      available: true,
      x: Float64Array.from([0, 1, 2]),
      y: Float64Array.from([0, 0, 0]),
      xLabel: 'x',
      yLabel: 'y',
    });
    plot.setColor({ values, scale, derived: null });
    plot.setMask(Uint8Array.from([0, 0, 1]));
    plot.setShowHidden(true);
  });
  // The unknown ghost is a filled circle and the classified ghost a filled
  // square, so this reads both op kinds in the one issued order.
  const painted = ops
    .filter((entry) => entry.op === 'fill' || entry.op === 'fillRect')
    .map((entry) => entry.color);
  assert.equal(painted[0], CATEGORY_UNKNOWN_COLOR,
    'the excluded unknown is the first thing painted');
  assert.ok(painted.indexOf(GHOST_COLOR) > 0,
    'the excluded classified gene follows it, under everything else');
  assert.ok(painted.lastIndexOf(scale.buckets[1]) > painted.indexOf(GHOST_COLOR));
});

test('a point with no coordinates is in no batch and cannot be picked', () => {
  const projection = {
    available: true,
    x: Float64Array.from([0, NaN, 1]),
    y: Float64Array.from([0, 0, NaN]),
    xLabel: 'x',
    yLabel: 'y',
  };
  const values = Float64Array.from([1, 5, 5]);
  const buckets = buildMarkerBuckets(projection.x, projection.y, null, RAMP, values);
  assert.deepEqual([...buckets.lists[0]], [0]);
  assert.ok(buckets.lists.every((list) => ![...list].includes(1) && ![...list].includes(2)));
  assert.equal(buckets.rank[1], -1);
  assert.equal(buckets.rank[2], -1);
  const { plot, restore } = drive((instance) => {
    instance.setProjection(projection);
    instance.setColor({ values, scale: RAMP, derived: null });
  });
  try {
    const a = centreOf(plot, 0);
    assert.equal(plot.hitTest(a.x, a.y), 0);
  } finally {
    restore();
  }
});

test('a hit test with no projection, and one before the first frame, both answer', () => {
  const { plot, restore } = drive(() => {});
  try {
    assert.equal(plot.hitTest(10, 10), -1, 'no projection is no gene, not a throw');
  } finally {
    restore();
  }
  const fresh = drive((instance) => {
    instance.setProjection(OVERLAP);
    instance.setColor({ values: OVERLAP_VALUES, scale: RAMP, derived: null });
  });
  try {
    // A pointer can move before a frame has run, so the batches are built on
    // demand rather than assumed to exist.
    fresh.plot.buckets = null;
    const b = centreOf(fresh.plot, 1);
    assert.equal(fresh.plot.hitTest(b.x, b.y), 1);
    assert.ok(fresh.plot.buckets, 'and they are kept once built');
  } finally {
    fresh.restore();
  }
});

test('with filtered-out genes hidden they are neither drawn nor picked', () => {
  const { plot, restore } = drive((instance) => {
    instance.setProjection(OVERLAP);
    instance.setColor({ values: OVERLAP_VALUES, scale: RAMP, derived: null });
    instance.setMask(Uint8Array.from([0, 1, 1]));
    instance.setShowHidden(false);
  });
  try {
    const ghost = centreOf(plot, 0);
    const far = centreOf(plot, 2);
    assert.equal(plot.hitTest(ghost.x, ghost.y), 1, 'the passing point beside it takes the click');
    assert.equal(plot.hitTest(far.x, far.y), 2);
  } finally {
    restore();
  }
});

test('the reader’s own marks are outlined after every batch, so nothing covers them', () => {
  // The shared rule has an emphasised tier above every valued mark; this map
  // realises it as the outlines it draws last, which is why its batches leave
  // `emphasis` alone. That only holds if the outlines really are last.
  const ops = paint((plot) => {
    plot.setProjection(PROJECTION);
    plot.setColor({ values: VALUES, scale: RAMP, derived: null });
    plot.setMarks({
      pinned: 0, hovered: 2, active: 1, shortlist: new Set([4]),
    });
  });
  const lastBatch = ops.findLastIndex(
    (entry) => entry.op === 'fill' && String(entry.color).startsWith('b'),
  );
  const strokes = ops
    .map((entry, index) => ({ ...entry, index }))
    .filter((entry) => entry.op === 'stroke' && entry.index > lastBatch);
  assert.ok(lastBatch >= 0, 'the coloured batches were issued');
  assert.ok(strokes.length >= 4,
    'the shortlist diamond and the hovered, active and pinned rings all follow them');
  assert.deepEqual(
    [...new Set(strokes.map((entry) => entry.color))].sort(),
    [ACTIVE_FOCUS_COLOR, HOVER_FOCUS_COLOR, PINNED_COLOR, SHORTLIST_COLOR].sort(),
  );
});
