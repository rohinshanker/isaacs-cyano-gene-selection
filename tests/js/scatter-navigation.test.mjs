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
  MIN_ZOOM, MAX_ZOOM,
} from '../../site/js/ui/scatter.js';

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
