/**
 * The keyboard/zoom state machine behind the canvas map, tested without a
 * canvas or a browser. `findNeighbor`, `clampZoom`, `enterTarget`, and
 * `shortlistTarget` are pure functions `ScatterPlot` delegates to; importing
 * scatter.js has no DOM side effects until a `ScatterPlot` is constructed, so
 * these can run under plain `node --test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findNeighbor, clampZoom, projectionCanZoom, enterTarget, togglePinTarget, shortlistTarget,
  buildMarkerBuckets, formatTick, tickTarget, fitAxisTitle, MIN_ZOOM, MAX_ZOOM,
  SQUARE_TO_CIRCLE_RADIUS, ScatterPlot,
} from '../../site/js/ui/scatter.js';
import { buildCategoryColorScale } from '../../site/js/ui/colors.js';
import {
  categoryBucketId, MULTIPLE_CATEGORY_ID, UNKNOWN_CATEGORY_ID,
} from '../../site/js/core/function-categories.js';

/** A deterministic stand-in for CanvasRenderingContext2D.measureText: fixed-width glyphs. */
function fixedWidthContext(charWidth = 6) {
  return { measureText: (text) => ({ width: text.length * charWidth }) };
}

// Four points around the origin: right, left, up, down, one screen unit apart.
const projection = {
  x: Float64Array.from([1, -1, 0, 0]),
  y: Float64Array.from([0, 0, 1, -1]),
};
const identity = { k: 1, cx: 0, cy: 0, ox: 0, oy: 0 };

test('with nothing active yet, neighbor finds the first unmasked point', () => {
  assert.equal(findNeighbor(projection, null, identity, -1, 'right'), 0);
});

test('a mask excludes hidden points from becoming a neighbor', () => {
  const mask = Uint8Array.from([0, 1, 1, 1]);
  assert.equal(findNeighbor(projection, mask, identity, -1, 'right'), 1);
});

test('category marker buckets split excluded unknowns from excluded reviewed genes', () => {
  const scale = buildCategoryColorScale(2);
  const values = Int16Array.from([-1, 0, 2]);
  const buckets = buildMarkerBuckets(
    Float64Array.from([1, 2, 3]), Float64Array.from([1, 2, 3]),
    Uint8Array.from([0, 0, 0]), scale, values,
  );
  assert.deepEqual([...buckets.hiddenMissing], [0]);
  // Back to front inside a batch, so the earlier locus is painted last there
  // too — the same tie-break the shared rule applies between batches. Every
  // point in a batch shares its colour, so the picture is unchanged.
  assert.deepEqual([...buckets.hidden], [2, 1]);

  const model = { categoryIds: ['first', 'second'], values };
  assert.deepEqual(
    Array.from(values, (_, index) => categoryBucketId(model, index)),
    [UNKNOWN_CATEGORY_ID, 'first', MULTIPLE_CATEGORY_ID],
  );
});

test('included circles preserve the area of the square marker they replaced', () => {
  assert.equal(SQUARE_TO_CIRCLE_RADIUS, Math.sqrt(4 / Math.PI));
  assert.ok(Math.abs(Math.PI * SQUARE_TO_CIRCLE_RADIUS ** 2 - 4) < Number.EPSILON * 4);
});

test('numeric marker buckets keep every excluded point in the outlined-square bucket', () => {
  const scale = { categorical: false, buckets: ['#123456'], bucketOf: () => -1 };
  const buckets = buildMarkerBuckets(
    Float64Array.from([1]), Float64Array.from([1]), Uint8Array.from([0]),
    scale, Float64Array.from([NaN]),
  );
  assert.deepEqual([...buckets.hidden], [0]);
  assert.deepEqual([...buckets.hiddenMissing], []);
});

test('moving right from the origin-adjacent point lands on the point to its right', () => {
  // Screen y is flipped (up is negative dy), matching ScatterPlot's toScreen.
  const from = findNeighbor(projection, null, identity, -1, 'right');
  assert.equal(from, 0);
  const next = findNeighbor(projection, null, identity, 0, 'up');
  assert.equal(next, 2);
});

test('there is no neighbor behind the direction of travel', () => {
  // From point 0 (screen x=0,y=0 in this transform... use a two-point case).
  const twoPoints = { x: Float64Array.from([0, 5]), y: Float64Array.from([0, 0]) };
  assert.equal(findNeighbor(twoPoints, null, identity, 1, 'right'), -1);
  assert.equal(findNeighbor(twoPoints, null, identity, 0, 'right'), 1);
});

test('a point with a non-finite coordinate is never a neighbor', () => {
  const withGap = { x: Float64Array.from([0, NaN, 5]), y: Float64Array.from([0, 0, 0]) };
  assert.equal(findNeighbor(withGap, null, identity, 0, 'right'), 2);
});

test('keyboard navigation measures distance after independent axis scaling', () => {
  const points = { x: Float64Array.from([0, 1, 0.2]), y: Float64Array.from([0, 0.1, 10]) };
  const stretched = { kx: 100, ky: 100, cx: 0, cy: 0, ox: 0, oy: 0 };
  assert.equal(findNeighbor(points, null, stretched, 0, 'right'), 1);
});

test('zoom is clamped to the range the plot can render', () => {
  assert.equal(clampZoom(MIN_ZOOM / 10), MIN_ZOOM);
  assert.equal(clampZoom(MAX_ZOOM * 10), MAX_ZOOM);
  assert.equal(clampZoom(1), 1);
});

test('an unavailable projection cannot enter the zoom path', () => {
  assert.equal(projectionCanZoom(null), false);
  assert.equal(projectionCanZoom({ available: false }), false);
  assert.equal(projectionCanZoom({ available: true }), false);
  assert.equal(projectionCanZoom({ available: true, x: projection.x, y: projection.y }), true);
});

/** Bind actual map events to a canvas stand-in, retaining the real camera math. */
function wheelHarness() {
  const listeners = new Map();
  const canvasRect = { left: 130, top: 240, width: 800, height: 400 };
  let changed = 0;
  const plot = Object.assign(Object.create(ScatterPlot.prototype), {
    canvas: {
      addEventListener: (type, listener) => listeners.set(type, listener),
      getBoundingClientRect: () => canvasRect,
    },
    width: canvasRect.width,
    height: canvasRect.height,
    projection: { ...projection, available: true },
    handlers: { onViewChange: () => { changed += 1; } },
    zoom: 1, panX: 0, panY: 0, fit: null,
    draw: () => {},
  });
  plot.bindEvents();
  return {
    plot, canvasRect,
    get changed() { return changed; },
    wheel(x, y) {
      let prevented = false;
      listeners.get('wheel')({
        clientX: canvasRect.left + x, clientY: canvasRect.top + y, deltaY: -100,
        preventDefault: () => { prevented = true; },
      });
      return prevented;
    },
  };
}

test('wheel zoom uses the grid boundary on all four sides and leaves margins scrollable', () => {
  const scene = wheelHarness();
  const { left, top, width, height } = scene.plot.plotRect;
  const right = left + width;
  const bottom = top + height;
  const middleX = left + width / 2;
  const middleY = top + height / 2;
  const outside = [[left - 0.5, middleY], [right + 0.5, middleY],
    [middleX, top - 0.5], [middleX, bottom + 0.5], [0, 0], [800, 400]];
  for (const [x, y] of outside) {
    assert.equal(scene.wheel(x, y), false, `page can scroll at ${x}, ${y}`);
  }
  assert.equal(scene.plot.zoom, 1);
  assert.equal(scene.plot.panX, 0);
  assert.equal(scene.plot.panY, 0);
  assert.equal(scene.changed, 0, 'margin scrolling must not persist a new camera');
  const inside = [[left, middleY], [right, middleY], [middleX, top],
    [middleX, bottom], [left, top], [right, bottom], [middleX, middleY]];
  for (const [x, y] of inside) {
    assert.equal(scene.wheel(x, y), true, `grid zooms at ${x}, ${y}`);
  }
  assert.equal(scene.changed, inside.length);
  assert.ok(scene.plot.zoom > 1);
});

test('accepted wheel zoom keeps the pointed data position fixed for shared scatter projections', () => {
  for (const independentAxes of [false, true]) {
    const scene = wheelHarness();
    scene.plot.projection.independentAxes = independentAxes;
    const pointer = { x: 210, y: 160 };
    const before = scene.plot.toData(pointer.x, pointer.y);
    assert.equal(scene.wheel(pointer.x, pointer.y), true);
    const after = scene.plot.toScreen(before.x, before.y);
    assert.ok(Math.abs(after.x - pointer.x) < 1e-9);
    assert.ok(Math.abs(after.y - pointer.y) < 1e-9);
  }
});

test('wheel bounds follow current canvas size and page position after resizing or scrolling', () => {
  const scene = wheelHarness();
  assert.equal(scene.wheel(650, 300), true);
  scene.plot.width = 500;
  scene.plot.height = 250;
  scene.canvasRect.left = 25;
  scene.canvasRect.top = -90;
  scene.plot.invalidate();
  const zoom = scene.plot.zoom;
  assert.equal(scene.wheel(490, 100), false, 'new right margin');
  assert.equal(scene.wheel(200, 230), false, 'new bottom margin');
  assert.equal(scene.plot.zoom, zoom);
  assert.equal(scene.wheel(300, 100), true, 'new grid with moved canvas');
  scene.plot.width = 900;
  scene.plot.height = 500;
  scene.plot.invalidate();
  assert.equal(scene.wheel(650, 300), true, 'expanded grid');
});

test('wheel events never prevent page scrolling while the projection is unavailable', () => {
  const scene = wheelHarness();
  for (const value of [null, { available: false }, { available: true }]) {
    scene.plot.projection = value;
    assert.equal(scene.wheel(200, 100), false);
  }
  assert.equal(scene.plot.zoom, 1);
  assert.equal(scene.changed, 0);
});

test('Enter only ever pins the explicitly active gene, never the pinned one by default', () => {
  assert.equal(enterTarget(-1), -1);
  assert.equal(enterTarget(3), 3);
});

test('clicking the pinned point clears it while clicking another point moves the pin', () => {
  assert.equal(togglePinTarget(3, -1), 3);
  assert.equal(togglePinTarget(3, 3), -1);
  assert.equal(togglePinTarget(4, 3), 4);
});

test('S targets the active gene when there is one, else falls back to pinned', () => {
  assert.equal(shortlistTarget(3, 7), 3);
  assert.equal(shortlistTarget(-1, 7), 7);
  assert.equal(shortlistTarget(-1, -1), -1);
});

test('a six-figure axis tick is abbreviated so it clears the rotated axis title', () => {
  assert.equal(formatTick(300000), '300k');
  assert.equal(formatTick(12500), '12.5k');
  assert.equal(formatTick(2_500_000), '2.5M');
  // Below ten thousand the exact number still fits the gutter.
  assert.equal(formatTick(5400), '5400');
  assert.equal(formatTick(0.125), '0.125');
  assert.equal(formatTick(-45000), '-45k');
  assert.equal(formatTick(NaN), '');
});

test('no two neighbouring ticks can print the same label, however far the map is zoomed', () => {
  // The regression: zoomed in, a 200-unit spacing used to round five
  // neighbouring ticks to "162k".
  const labelsFor = (first, step, count) => Array.from(
    { length: count }, (_, i) => formatTick(first + i * step, step),
  );
  for (const [first, step] of [[161000, 1000], [161000, 200], [161000, 100],
    [161000, 50], [161000, 20], [1_250_000, 50000], [2_000_000, 500000],
    [0.1, 0.02], [5000, 1000]]) {
    const labels = labelsFor(first, step, 6);
    assert.equal(new Set(labels).size, labels.length,
      `step ${step} repeated a label: ${labels.join(', ')}`);
  }
  assert.deepEqual(labelsFor(161000, 200, 3), ['161k', '161.2k', '161.4k']);
  // An abbreviation that would need two decimals gives way to the plain number.
  assert.deepEqual(labelsFor(161000, 50, 3), ['161000', '161050', '161100']);
  assert.equal(formatTick(2_500_000, 500000), '2.5M');
});

test('log10 and percentile axes keep neighbouring ticks distinct at every zoom level too', () => {
  // formatTick has no notion of "scale": a log10 or percentile axis just feeds
  // it already-transformed numbers, so the same distinctness contract as a
  // raw linear metric must hold over their typical ranges.
  const labelsFor = (first, step, count) => Array.from(
    { length: count }, (_, i) => formatTick(first + i * step, step),
  );
  // A log10(TSS initiation) axis spans roughly [-1, 5.5] across the dataset;
  // zoomed in, spacing gets far finer than one decade.
  for (const [first, step] of [[-1, 0.5], [0, 0.25], [2, 0.1], [3.2, 0.01], [-0.5, 0.001]]) {
    const labels = labelsFor(first, step, 6);
    assert.equal(new Set(labels).size, labels.length,
      `log10 step ${step} repeated a label: ${labels.join(', ')}`);
  }
  // A percentile axis is always [0, 100]; check the same at coarse and
  // zoomed-in spacing, including a spacing finer than one point.
  for (const [first, step] of [[0, 20], [40, 5], [50, 1], [50, 0.1], [50, 0.01]]) {
    const labels = labelsFor(first, step, 6);
    assert.equal(new Set(labels).size, labels.length,
      `percentile step ${step} repeated a label: ${labels.join(', ')}`);
  }
});

test('a narrow axis asks for fewer ticks so its labels cannot run together', () => {
  // A 390 px phone leaves roughly 250 px of plot width.
  assert.equal(tickTarget(250, 74), 3);
  assert.equal(tickTarget(960, 74), 6);
  // Never fewer than two, whatever the geometry, and never a broken input.
  assert.equal(tickTarget(20, 74), 2);
  assert.equal(tickTarget(NaN, 74), 6);
  assert.equal(tickTarget(250, 0), 6);
});

test('a title that already fits is left untouched', () => {
  const context = fixedWidthContext();
  const full = 'Downstream-neighbor distance, percentile';
  assert.equal(fitAxisTitle(context, full, ', percentile', full.length * 6), full);
});

test('a narrow axis shortens the metric name but never the scale suffix', () => {
  const context = fixedWidthContext();
  const full = 'Downstream-neighbor distance, percentile';
  const suffix = ', percentile';
  // Narrow enough that the full title cannot fit, wide enough for a shortened name.
  const shortened = fitAxisTitle(context, full, suffix, 30 * 6);
  assert.ok(shortened.endsWith(suffix), `expected "${shortened}" to keep "${suffix}"`);
  assert.ok(shortened.includes('…'), `expected "${shortened}" to be shortened`);
  assert.ok(shortened.length < full.length);
});

test('a title with a unit suffix instead of a scale is shortened the same way', () => {
  const context = fixedWidthContext();
  const full = 'TSS initiation (UTEX 2973) (counts)';
  const suffix = ' (counts)';
  const shortened = fitAxisTitle(context, full, suffix, 20 * 6);
  assert.ok(shortened.endsWith(suffix));
  assert.ok(shortened.includes('…'));
});

test('no suffix falls back to shortening the whole title, unchanged from before', () => {
  const context = fixedWidthContext();
  const full = 'A very long metric label with no unit or scale suffix at all';
  const shortened = fitAxisTitle(context, full, '', 20 * 6);
  assert.ok(shortened.endsWith('…'));
  assert.ok(shortened.length < full.length);
});

test('a width too narrow for "…, suffix" falls back to the bare suffix', () => {
  const context = fixedWidthContext();
  const full = 'Downstream-neighbor distance, percentile';
  const suffix = ', percentile';
  // '…, percentile' is 13 chars (78px, fixedWidthContext default charWidth 6);
  // the bare suffix ', percentile' is 12 chars (72px). 75px fits only the latter.
  const shortened = fitAxisTitle(context, full, suffix, 75);
  assert.equal(shortened, suffix);
});

test('a width too narrow even for the bare suffix draws nothing, not a clipped claim', () => {
  const context = fixedWidthContext();
  const full = 'Downstream-neighbor distance, percentile';
  const suffix = ', percentile';
  const shortened = fitAxisTitle(context, full, suffix, 10);
  assert.equal(shortened, '');
});
