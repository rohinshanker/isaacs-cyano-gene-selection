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
} from '../../site/js/ui/scatter.js';

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
  const scale = {
    categorical: true,
    buckets: ['#123456'],
    bucketOf: (value) => value,
  };
  const buckets = buildMarkerBuckets(
    Float64Array.from([1, 2, 3, 4]),
    Float64Array.from([1, 2, 3, 4]),
    Uint8Array.from([0, 0, 1, 1]),
    scale,
    Int16Array.from([-1, 0, -1, 0]),
  );
  assert.deepEqual([...buckets.hiddenMissing], [0]);
  assert.deepEqual([...buckets.hidden], [1]);
  assert.deepEqual([...buckets.missing], [2]);
  assert.deepEqual([...buckets.lists[0]], [3]);
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
