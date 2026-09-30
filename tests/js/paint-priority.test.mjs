/**
 * The one paint-order rule both views read.
 *
 * Every tier and every ordering inside a tier is exercised here rather than
 * through a canvas, because the rule is what decides which gene is seen and a
 * picture can only show that one answer at a time.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORICAL_DIRECTION_REASON, DEFAULT_DRAW_DIRECTION, DRAW_DIRECTIONS, DRAW_DIRECTION_LABELS,
  EMPHASIS_RANK, EVIDENCE_RANK, PAINT_TIER, comparePaintPriority, describeDrawOrder, drawOrderNote,
  normalizeDrawDirection, paintPriority, paintRanks, sortByPaintOrder,
} from '../../site/js/core/paint-priority.js';

/**
 * A metric colour over five genes: 0 and 1 are filtered out, 2 has no value,
 * 3 and 4 are valued. Every accessor answers from these arrays, so a test that
 * changes one fact changes exactly one thing.
 */
function metricModel(overrides = {}) {
  const values = [10, 20, NaN, 5, 90];
  const mask = [0, 0, 1, 1, 1];
  return {
    categorical: false,
    direction: DEFAULT_DRAW_DIRECTION,
    passes: (index) => mask[index] === 1,
    hasValue: (index) => Number.isFinite(values[index]),
    valueOf: (index) => values[index],
    isDerived: () => false,
    emphasis: () => EMPHASIS_RANK.none,
    ...overrides,
  };
}

/** A category colour: 0 unknown, 1 and 2 derived, 3 and 4 reviewed. */
function categoryModel(overrides = {}) {
  const bucket = [-1, 0, 1, 0, 1];
  const derived = [false, true, true, false, false];
  return {
    categorical: true,
    direction: DEFAULT_DRAW_DIRECTION,
    passes: () => true,
    hasValue: (index) => bucket[index] >= 0,
    valueOf: () => NaN,
    isDerived: (index) => derived[index],
    columnMajority: () => 0,
    emphasis: () => EMPHASIS_RANK.none,
    ...overrides,
  };
}

test('the draw directions are exactly two, with highest the fresh default', () => {
  assert.deepEqual([...DRAW_DIRECTIONS], ['highest', 'lowest']);
  assert.equal(DEFAULT_DRAW_DIRECTION, 'highest');
  assert.ok(Object.isFrozen(DRAW_DIRECTIONS));
  assert.deepEqual(DRAW_DIRECTIONS.map((value) => DRAW_DIRECTION_LABELS[value]),
    ['Highest value', 'Lowest value']);
});

test('an unknown, empty, or absent direction falls back to highest, never throws', () => {
  for (const value of ['sideways', '', null, undefined, 0, 'HIGHEST']) {
    assert.equal(normalizeDrawDirection(value), 'highest');
  }
  assert.equal(normalizeDrawDirection('lowest'), 'lowest');
});

test('a filtered-out gene is in the bottom tier whatever else is true of it', () => {
  const model = metricModel({ emphasis: () => EMPHASIS_RANK.pinned });
  const hidden = paintPriority(0, model);
  assert.equal(hidden.tier, PAINT_TIER.filteredOut);
  // Emphasis is cleared, not merely outranked: a pinned gene the filters hide
  // must not climb over a gene the filters keep.
  assert.equal(hidden.emphasis, EMPHASIS_RANK.none);
  assert.ok(comparePaintPriority(hidden, paintPriority(2, model)) < 0);
});

test('a gene with no value sits above filtered out and below every valued one', () => {
  const model = metricModel();
  const none = paintPriority(2, model);
  assert.equal(none.tier, PAINT_TIER.noValue);
  assert.ok(comparePaintPriority(paintPriority(0, model), none) < 0);
  assert.ok(comparePaintPriority(none, paintPriority(3, model)) < 0);
  assert.ok(comparePaintPriority(none, paintPriority(4, model)) < 0);
});

test('a gene with no value stays under the valued ones in the lowest direction too', () => {
  const model = metricModel({ direction: 'lowest' });
  const none = paintPriority(2, model);
  assert.equal(none.tier, PAINT_TIER.noValue);
  // 5 is the lowest value plotted, so it is the one on top under this
  // direction; absence still does not join the ordering.
  assert.ok(comparePaintPriority(none, paintPriority(3, model)) < 0);
  assert.deepEqual(sortByPaintOrder([2, 3, 4], model), [2, 4, 3]);
});

test('highest on top paints the valued genes ascending, lowest reverses only them', () => {
  assert.deepEqual(sortByPaintOrder([0, 1, 2, 3, 4], metricModel()), [0, 1, 2, 3, 4]);
  assert.deepEqual(
    sortByPaintOrder([0, 1, 2, 3, 4], metricModel({ direction: 'lowest' })),
    [0, 1, 2, 4, 3],
  );
});

test('a non-finite value inside the valued tier does not poison the comparison', () => {
  // `hasValue` is the gate, so a model that disagrees with its own values still
  // yields a total order rather than a NaN comparison that leaves a sort
  // implementation-defined.
  const model = metricModel({ hasValue: () => true, valueOf: () => NaN });
  assert.equal(paintPriority(3, model).value, 0);
  assert.deepEqual(sortByPaintOrder([4, 3, 2], model), [2, 3, 4]);
});

test('in category colour a derived category draws under a reviewed one', () => {
  const model = categoryModel();
  assert.equal(paintPriority(1, model).evidence, EVIDENCE_RANK.derived);
  assert.equal(paintPriority(3, model).evidence, EVIDENCE_RANK.reviewed);
  assert.deepEqual(sortByPaintOrder([3, 1, 0], model), [0, 1, 3]);
});

test('owner decision D2: among derived categories the bigger one in the column wins', () => {
  // Gene 1 and gene 2 are both derived and both in the column; the column holds
  // three of gene 2's category and one of gene 1's.
  const majority = { 1: 1, 2: 3 };
  const model = categoryModel({ columnMajority: (index) => majority[index] ?? 0 });
  assert.deepEqual(sortByPaintOrder([1, 2], model), [1, 2]);
});

test('owner decision D2: reviewed beats a bigger derived category, not the reverse', () => {
  const majority = { 1: 9, 3: 1 };
  const model = categoryModel({ columnMajority: (index) => majority[index] ?? 0 });
  assert.deepEqual(sortByPaintOrder([3, 1], model), [1, 3]);
});

test('owner decision D2: an equal majority falls through to locus order', () => {
  const model = categoryModel({ columnMajority: () => 2 });
  assert.deepEqual(sortByPaintOrder([2, 1], model), [1, 2]);
  assert.deepEqual(sortByPaintOrder([1, 2], model), [1, 2]);
});

test('emphasised marks sit above every valued one, in their own order', () => {
  const ranks = {
    0: EMPHASIS_RANK.shortlisted,
    1: EMPHASIS_RANK.active,
    2: EMPHASIS_RANK.hovered,
    3: EMPHASIS_RANK.pinned,
  };
  const model = metricModel({
    passes: () => true,
    hasValue: () => true,
    valueOf: (index) => [10, 20, 30, 5, 90][index],
    emphasis: (index) => ranks[index] ?? EMPHASIS_RANK.none,
  });
  assert.equal(paintPriority(0, model).tier, PAINT_TIER.emphasised);
  assert.equal(paintPriority(4, model).tier, PAINT_TIER.valued);
  assert.deepEqual(sortByPaintOrder([3, 2, 1, 0, 4], model), [4, 0, 1, 2, 3]);
});

test('a model that omits the optional accessors still orders', () => {
  const bare = {
    categorical: false,
    passes: () => true,
    hasValue: (index) => index > 0,
  };
  const entry = paintPriority(1, bare);
  assert.equal(entry.tier, PAINT_TIER.valued);
  assert.equal(entry.emphasis, EMPHASIS_RANK.none);
  assert.equal(entry.majority, 0);
  assert.deepEqual(sortByPaintOrder([2, 1, 0], bare), [0, 1, 2]);
});

test('ties break by locus order, so a re-render never flickers', () => {
  const model = metricModel({ passes: () => true, hasValue: () => true, valueOf: () => 7 });
  assert.deepEqual(sortByPaintOrder([4, 0, 2, 3, 1], model), [0, 1, 2, 3, 4]);
  assert.deepEqual(sortByPaintOrder([0, 1, 2, 3, 4], model), [0, 1, 2, 3, 4]);
});

test('sorting leaves the caller’s list alone, since both views keep theirs', () => {
  const indices = [4, 3, 2];
  sortByPaintOrder(indices, metricModel());
  assert.deepEqual(indices, [4, 3, 2]);
});

test('ranks number the painted order from the bottom up', () => {
  const ranks = paintRanks([0, 1, 2, 3, 4], metricModel());
  assert.equal(ranks.get(4), 4);
  assert.equal(ranks.get(3), 3);
  assert.equal(ranks.get(2), 2);
  assert.equal(ranks.size, 5);
});

test('the disclosure names the order, by what, and in which direction', () => {
  const order = (direction) => describeDrawOrder({
    categorical: false, direction, metricLabel: 'TSS initiation',
  });
  const highest = order('highest');
  assert.match(highest, /highest TSS initiation value draws on top/);
  assert.match(highest, /no value stay under/);
  const lowest = order('lowest');
  assert.match(lowest, /lowest TSS initiation value draws on top/);
  assert.notEqual(highest, lowest);
  // An unnamed metric still yields a grammatical sentence.
  assert.match(describeDrawOrder({ categorical: false, direction: 'highest' }),
    /highest value draws on top/);
});

test('the category disclosure names the evidence order, which has no direction', () => {
  const text = describeDrawOrder({ categorical: true, direction: 'lowest' });
  assert.equal(text, describeDrawOrder({ categorical: true, direction: 'highest' }));
  assert.match(text, /lab-reviewed category draws over a source-derived one/);
  assert.match(text, /over genes with no category/);
});

test('the legend clause is one short sentence and still says the direction', () => {
  const highest = drawOrderNote({ categorical: false, direction: 'highest' });
  const lowest = drawOrderNote({ categorical: false, direction: 'lowest' });
  assert.equal(highest, 'Overlapping marks: highest value on top.');
  assert.equal(lowest, 'Overlapping marks: lowest value on top.');
  assert.ok(highest.length < 60 && lowest.length < 60);
  assert.equal(drawOrderNote({ categorical: true, direction: 'lowest' }),
    'Overlapping marks: reviewed over derived, over no category.');
});

test('the reason a category colour cannot choose a direction is stated, not implied', () => {
  assert.match(CATEGORICAL_DIRECTION_REASON, /no value order to reverse/);
  assert.match(CATEGORICAL_DIRECTION_REASON, /lab-reviewed above source-derived/);
});
