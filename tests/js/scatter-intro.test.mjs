/**
 * The scatter map's deterministic loading reveal, driven without a browser.
 *
 * A manual animation-frame queue and injected clock make every phase exact.
 * The recording context counts the points in each batched path, so these tests
 * cover both reveal membership and paint order without weakening batching.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ScatterPlot, introThreshold } from '../../site/js/ui/scatter.js';
import {
  ACTIVE_FOCUS_COLOR, CATEGORY_UNKNOWN_COLOR, DERIVED_MARKER_FILL, GHOST_COLOR,
  HOVER_FOCUS_COLOR, MISSING_COLOR, PENDING_CATEGORY_COLOR, PINNED_COLOR, SHORTLIST_COLOR,
  buildCategoryColorScale,
} from '../../site/js/ui/colors.js';

const WIDTH = 400;
const HEIGHT = 300;

function recordingContext(ops) {
  let arcs = 0;
  const context = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    clearRect: () => ops.push({ op: 'clear' }),
    fillRect: () => ops.push({ op: 'fillRect', color: context.fillStyle }),
    strokeRect: () => ops.push({ op: 'strokeRect', color: context.strokeStyle }),
    setLineDash: () => {},
    fillText: (text) => ops.push({ op: 'fillText', color: context.fillStyle, text }),
    beginPath: () => { arcs = 0; },
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => { arcs += 1; },
    rect: () => {},
    clip: () => {},
    save: () => {},
    restore: () => {},
    setTransform: () => {},
    translate: () => {},
    rotate: () => {},
    measureText: (text) => ({ width: text.length * 6 }),
    fill: () => ops.push({ op: 'fill', color: context.fillStyle, arcs }),
    stroke: () => ops.push({ op: 'stroke', color: context.strokeStyle, arcs }),
  };
  return context;
}

function fakeCanvas(ops, size) {
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
    getBoundingClientRect: () => ({ left: 0, top: 0, width: size.width, height: size.height }),
  };
}

function projection(count, labels = null) {
  return {
    available: true,
    x: Float64Array.from({ length: count }, (_, index) => index),
    y: Float64Array.from({ length: count }, () => 0),
    xLabel: 'x',
    yLabel: 'y',
    labels,
  };
}

function ramp(count, prefix = 'b') {
  return {
    categorical: false,
    buckets: Array.from({ length: count }, (_, index) => `${prefix}${index}`),
    bucketOf: (value) => (Number.isFinite(value) ? value : -1),
  };
}

function harness({
  pointProjection = projection(5),
  colors = { values: Float64Array.from([0, 1, 2, 3, 4]), scale: ramp(5) },
  mask = null,
} = {}) {
  const previous = {
    window: globalThis.window,
    ResizeObserver: globalThis.ResizeObserver,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
    performance: globalThis.performance,
  };
  const frames = new Map();
  const ops = [];
  const size = { width: WIDTH, height: HEIGHT };
  let nextFrame = 1;
  let time = 0;

  globalThis.window = { devicePixelRatio: 1 };
  globalThis.ResizeObserver = class {
    observe() {}

    disconnect() {}
  };
  globalThis.requestAnimationFrame = (callback) => {
    const handle = nextFrame;
    nextFrame += 1;
    frames.set(handle, callback);
    return handle;
  };
  globalThis.cancelAnimationFrame = (handle) => frames.delete(handle);
  globalThis.performance = { now: () => 0 };

  try {
    const canvas = fakeCanvas(ops, size);
    const plot = new ScatterPlot(canvas, {});
    plot.setProjection(pointProjection);
    plot.setColor(colors);
    if (mask) plot.setMask(mask);

    const runNext = () => {
      const entry = frames.entries().next();
      assert.equal(entry.done, false, 'an animation frame should be queued');
      const [handle, callback] = entry.value;
      frames.delete(handle);
      callback(time);
    };
    runNext();
    ops.length = 0;

    return {
      canvas,
      frames,
      ops,
      plot,
      runNext,
      setTime(value) { time = value; },
      size,
      now: () => time,
      restore() { Object.assign(globalThis, previous); },
    };
  } catch (error) {
    Object.assign(globalThis, previous);
    throw error;
  }
}

function fills(ops) {
  return ops.filter((entry) => entry.op === 'fill').map((entry) => entry.color);
}

test('intro thresholds are stable, bounded, and evenly spread over all 2,715 genes', () => {
  const counts = Array(10).fill(0);
  for (let index = 0; index < 2715; index += 1) {
    const first = introThreshold(index);
    assert.equal(introThreshold(index), first);
    assert.ok(first >= 0 && first < 1, `threshold ${index} is in [0, 1)`);
    counts[Math.floor(first * 10)] += 1;
  }
  for (const count of counts) {
    const share = count / 2715;
    assert.ok(share >= 0.08 && share <= 0.12, `tenth share ${share} is evenly spread`);
  }
});

test('without an intro, redraw output and the one-frame queue remain unchanged', () => {
  const scene = harness();
  try {
    scene.plot.draw();
    scene.runNext();
    const first = structuredClone(scene.ops);
    scene.ops.length = 0;
    scene.plot.draw();
    scene.runNext();
    assert.deepEqual(scene.ops, first);
    assert.equal(scene.frames.size, 0);
    assert.equal(scene.plot.introActive, false);
    assert.equal(scene.plot.frameStats().frames, 3);
  } finally {
    scene.restore();
  }
});

test('appeared pending points paint once underneath real colours in existing batch order', () => {
  const scene = harness();
  let done = 0;
  try {
    scene.plot.startIntro({
      appearMs: 100,
      colourMs: 200,
      now: scene.now,
      onDone: () => { done += 1; },
    });
    assert.equal(scene.plot.introActive, true);

    scene.setTime(50);
    scene.runNext();
    assert.deepEqual(
      fills(scene.ops).filter((color) => color === PENDING_CATEGORY_COLOR || color.startsWith('b')),
      [PENDING_CATEGORY_COLOR, 'b0', 'b1'],
    );
    assert.equal(scene.ops.find(
      (entry) => entry.op === 'fill' && entry.color === PENDING_CATEGORY_COLOR,
    ).arcs, 1);
    assert.equal(scene.frames.size, 1, 'the intro requests its next frame');

    scene.ops.length = 0;
    scene.setTime(200);
    scene.runNext();
    assert.deepEqual(
      fills(scene.ops).filter((color) => color.startsWith('b')),
      ['b0', 'b1', 'b2', 'b3', 'b4'],
    );
    assert.ok(!fills(scene.ops).includes(PENDING_CATEGORY_COLOR));
    assert.equal(scene.plot.introActive, false);
    assert.equal(done, 1);
    assert.equal(scene.frames.size, 0, 'the terminal frame does not request another frame');
  } finally {
    scene.restore();
  }
});

test('ghosts and missing values follow appearance but never take the pending colour', () => {
  const scale = buildCategoryColorScale(4);
  const scene = harness({
    pointProjection: projection(4),
    colors: { values: Int16Array.from([0, -1, -1, 3]), scale },
    mask: Uint8Array.from([0, 0, 1, 1]),
  });
  try {
    scene.plot.startIntro({ appearMs: 100, colourMs: 180, now: scene.now });
    scene.setTime(90);
    scene.runNext();

    const pending = scene.ops.filter(
      (entry) => entry.op === 'fill' && entry.color === PENDING_CATEGORY_COLOR,
    );
    assert.deepEqual(pending.map((entry) => entry.arcs), [1], 'only the valued included point is pending');
    assert.ok(scene.ops.some(
      (entry) => entry.op === 'fill' && entry.color === CATEGORY_UNKNOWN_COLOR,
    ), 'the excluded unknown uses its real ghost style');
    assert.ok(scene.ops.some(
      (entry) => entry.op === 'fillRect' && entry.color === GHOST_COLOR,
    ), 'the excluded valued point uses its real square style');
    assert.ok(scene.ops.some(
      (entry) => entry.op === 'stroke' && entry.color === CATEGORY_UNKNOWN_COLOR,
    ), 'the included missing point uses its real open-ring style');

    scene.ops.length = 0;
    scene.plot.setShowHidden(false);
    scene.setTime(91);
    scene.runNext();
    assert.ok(!scene.ops.some((entry) => entry.op === 'fillRect' && entry.color === GHOST_COLOR));
    assert.equal(scene.ops.filter(
      (entry) => entry.op === 'fill' && entry.color === CATEGORY_UNKNOWN_COLOR,
    ).length, 0);
    scene.plot.cancelIntro();
  } finally {
    scene.restore();
  }
});

test('source-derived points use the same pending disc, then regain their real ring treatment', () => {
  const scale = buildCategoryColorScale(3);
  const scene = harness({
    pointProjection: projection(3),
    colors: {
      values: Int16Array.from([0, 1, 2]),
      scale,
      derived: Uint8Array.from([1, 0, 1]),
    },
  });
  try {
    scene.plot.startIntro({ appearMs: 0, colourMs: 100, now: scene.now });
    scene.setTime(25);
    scene.runNext();
    assert.deepEqual(
      fills(scene.ops).filter((color) => (
        color === PENDING_CATEGORY_COLOR
          || color === DERIVED_MARKER_FILL
          || scale.buckets.includes(color)
      )),
      [PENDING_CATEGORY_COLOR, DERIVED_MARKER_FILL, scale.buckets[0], scale.buckets[1]],
      'the unrevealed derived point is below both real derived and reviewed styles',
    );

    scene.ops.length = 0;
    scene.setTime(100);
    scene.runNext();
    assert.equal(
      scene.ops.filter(
        (entry) => entry.op === 'fill' && entry.color === DERIVED_MARKER_FILL,
      ).reduce((total, entry) => total + entry.arcs, 0),
      2,
      'both derived points use their hollow real style at completion',
    );
  } finally {
    scene.restore();
  }
});

test('zero-duration phases are complete from the first frame', () => {
  const scene = harness();
  try {
    scene.plot.startIntro({ appearMs: 0, colourMs: 100, now: scene.now });
    scene.runNext();
    const pending = scene.ops.find(
      (entry) => entry.op === 'fill' && entry.color === PENDING_CATEGORY_COLOR,
    );
    assert.equal(pending.arcs, 5, 'all points appear at once while colour still waits');

    scene.ops.length = 0;
    scene.setTime(100);
    scene.runNext();
    assert.equal(scene.plot.introActive, false);

    scene.ops.length = 0;
    scene.setTime(200);
    scene.plot.startIntro({ appearMs: 100, colourMs: 0, now: scene.now });
    scene.setTime(250);
    scene.runNext();
    assert.ok(!fills(scene.ops).includes(PENDING_CATEGORY_COLOR));
    assert.deepEqual(
      fills(scene.ops).filter((color) => color.startsWith('b')),
      ['b0', 'b1', 'b2'],
      'every point that has appeared already has its real colour',
    );
    scene.plot.cancelIntro();
  } finally {
    scene.restore();
  }
});

test('data, ordering, mask, and size changes are read on the next intro frame without restarting it', () => {
  const scene = harness();
  let done = 0;
  try {
    scene.plot.startIntro({
      appearMs: 100,
      colourMs: 200,
      now: scene.now,
      onDone: () => { done += 1; },
    });
    scene.setTime(150);
    scene.size.width = 520;
    scene.size.height = 360;
    scene.plot.setProjection(projection(3));
    scene.plot.setColor({ values: Float64Array.from([0, 1, 2]), scale: ramp(3, 'c') });
    scene.plot.setMask(Uint8Array.from([1, 1, 1]));
    scene.plot.setDrawDirection('lowest');
    scene.plot.resize();

    assert.equal(scene.plot.introActive, true);
    assert.equal(scene.frames.size, 1, 'all invalidations coalesce into the running intro frame');
    scene.runNext();
    assert.equal(scene.canvas.width, 520);
    assert.equal(scene.canvas.height, 360);
    assert.deepEqual(
      fills(scene.ops).filter((color) => color.startsWith('c')),
      ['c2', 'c1', 'c0'],
      'the frame uses the replacement data and draw direction',
    );
    assert.equal(done, 0);

    scene.ops.length = 0;
    scene.setTime(200);
    scene.runNext();
    assert.equal(done, 1, 'the original start time still controls completion');
    assert.equal(scene.plot.introActive, false);
    assert.equal(scene.frames.size, 0);
  } finally {
    scene.restore();
  }
});

test('cancel removes the queued frame, draws the final picture, and is idempotent', () => {
  const scene = harness();
  let done = 0;
  try {
    scene.plot.startIntro({
      appearMs: 100,
      colourMs: 200,
      now: scene.now,
      onDone: () => { done += 1; },
    });
    assert.equal(scene.frames.size, 1);
    scene.plot.cancelIntro();
    assert.equal(scene.plot.introActive, false);
    assert.equal(scene.frames.size, 0);
    assert.equal(done, 1);
    assert.ok(!fills(scene.ops).includes(PENDING_CATEGORY_COLOR));
    assert.deepEqual(
      fills(scene.ops).filter((color) => color.startsWith('b')),
      ['b0', 'b1', 'b2', 'b3', 'b4'],
    );

    const operationCount = scene.ops.length;
    scene.plot.cancelIntro();
    assert.equal(scene.ops.length, operationCount);
    assert.equal(done, 1);
  } finally {
    scene.restore();
  }
});

test('starting again finishes the replaced intro once and gives the frame loop to the new one', () => {
  const scene = harness();
  let firstDone = 0;
  let secondDone = 0;
  try {
    scene.plot.startIntro({
      appearMs: 100,
      colourMs: 100,
      now: scene.now,
      onDone: () => { firstDone += 1; },
    });
    scene.setTime(20);
    scene.plot.startIntro({
      appearMs: 50,
      colourMs: 50,
      now: scene.now,
      onDone: () => { secondDone += 1; },
    });
    assert.equal(firstDone, 1);
    assert.equal(scene.frames.size, 1);

    scene.setTime(70);
    scene.runNext();
    assert.equal(secondDone, 1);
    assert.equal(scene.plot.introActive, false);
    assert.equal(scene.frames.size, 0);
  } finally {
    scene.restore();
  }
});

test('hit testing and keyboard navigation still see points before they appear', () => {
  const scene = harness();
  try {
    const point = scene.plot.toScreen(
      scene.plot.projection.x[2], scene.plot.projection.y[2],
    );
    const hitBefore = scene.plot.hitTest(point.x, point.y);
    const neighborBefore = scene.plot.neighbor(-1, 'right');

    scene.plot.startIntro({ appearMs: 100, colourMs: 100, now: scene.now });
    assert.equal(scene.plot.hitTest(point.x, point.y), hitBefore);
    assert.equal(scene.plot.neighbor(-1, 'right'), neighborBefore);
    scene.runNext();
    assert.equal(scene.plot.introActive, true, 'at t=0 no threshold is below appearance progress');
    scene.plot.cancelIntro();
  } finally {
    scene.restore();
  }
});

test('focus rings, shortlist marks, and pinned labels draw throughout the intro', () => {
  const scene = harness({ pointProjection: projection(5, ['g0', 'g1', 'g2', 'g3', 'g4']) });
  try {
    scene.plot.startIntro({ appearMs: 100, colourMs: 100, now: scene.now });
    scene.plot.setMarks({
      hovered: 0,
      pinned: 1,
      active: 2,
      shortlist: new Set([3]),
    });
    scene.runNext();

    const strokeColors = scene.ops
      .filter((entry) => entry.op === 'stroke')
      .map((entry) => entry.color);
    assert.ok(strokeColors.includes(SHORTLIST_COLOR));
    assert.ok(strokeColors.includes(HOVER_FOCUS_COLOR));
    assert.ok(strokeColors.includes(ACTIVE_FOCUS_COLOR));
    assert.ok(strokeColors.includes(PINNED_COLOR));
    assert.ok(scene.ops.some((entry) => entry.op === 'fillText' && entry.text === 'g1'));
    scene.plot.cancelIntro();
  } finally {
    scene.restore();
  }
});

test('numeric missing-value rings retain their normal style during the intro', () => {
  const scene = harness({
    pointProjection: projection(2),
    colors: { values: Float64Array.from([NaN, 1]), scale: ramp(2) },
  });
  try {
    scene.plot.startIntro({ appearMs: 0, colourMs: 100, now: scene.now });
    scene.runNext();
    assert.ok(scene.ops.some(
      (entry) => entry.op === 'stroke' && entry.color === MISSING_COLOR,
    ));
    const pending = scene.ops.find(
      (entry) => entry.op === 'fill' && entry.color === PENDING_CATEGORY_COLOR,
    );
    assert.equal(pending.arcs, 1);
    scene.plot.cancelIntro();
  } finally {
    scene.restore();
  }
});
