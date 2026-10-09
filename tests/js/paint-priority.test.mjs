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
  EMPHASIS_RANK, EVIDENCE_RANK, PAINT_TIER, comparePaintPriority, describeDrawOrder,
  normalizeDrawDirection, paintBatchOrder, paintPriority, paintRanks, sortByPaintOrder,
  topByPaintOrder,
} from '../../site/js/core/paint-priority.js';
import { describePaintOrder } from '../../site/js/core/chromosome-model.js';

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
  // Genes 0 and 1 are both filtered out and tie on every field, so the earlier
  // locus is painted last *within that tier* and stays under everything above it.
  assert.deepEqual(sortByPaintOrder([0, 1, 2, 3, 4], metricModel()), [1, 0, 2, 3, 4]);
  assert.deepEqual(
    sortByPaintOrder([0, 1, 2, 3, 4], metricModel({ direction: 'lowest' })),
    [1, 0, 2, 4, 3],
  );
});

test('a non-finite value inside the valued tier does not poison the comparison', () => {
  // `hasValue` is the gate, so a model that disagrees with its own values still
  // yields a total order rather than a NaN comparison that leaves a sort
  // implementation-defined.
  const model = metricModel({ hasValue: () => true, valueOf: () => NaN });
  assert.equal(paintPriority(3, model).value, 0);
  assert.deepEqual(sortByPaintOrder([4, 3, 2], model), [4, 3, 2]);
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

test('owner decision D2: an equal majority falls through to the earlier locus', () => {
  const model = categoryModel({ columnMajority: () => 2 });
  // Gene 1 is the earlier locus, so it is painted last and is what the column
  // shows. The disclosure and the validation documents say "then the earlier
  // locus"; the comparator used to leave the later one on top instead.
  assert.deepEqual(sortByPaintOrder([2, 1], model), [2, 1]);
  assert.deepEqual(sortByPaintOrder([1, 2], model), [2, 1]);
  assert.equal(topByPaintOrder([1, 2], model), 1);
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
  assert.deepEqual(sortByPaintOrder([2, 1, 0], bare), [0, 2, 1]);
});

test('ties break by the earlier locus, so a re-render never flickers', () => {
  const model = metricModel({ passes: () => true, hasValue: () => true, valueOf: () => 7 });
  // Painted ascending, so the earliest locus is last and is the one seen. Two
  // different input orders give the same answer, which is what stops a flicker.
  assert.deepEqual(sortByPaintOrder([4, 0, 2, 3, 1], model), [4, 3, 2, 1, 0]);
  assert.deepEqual(sortByPaintOrder([0, 1, 2, 3, 4], model), [4, 3, 2, 1, 0]);
  assert.equal(topByPaintOrder([4, 0, 2, 3, 1], model), 0);
  assert.ok(comparePaintPriority(paintPriority(0, model), paintPriority(1, model)) > 0,
    'the earlier locus compares greater, so it sorts last and lands on top');
});

test('the top of an empty list is nothing, not a gene', () => {
  assert.equal(topByPaintOrder([], metricModel()), -1);
});

test('the top of a list is the gene the full sort would paint last', () => {
  const model = metricModel();
  for (const indices of [[0, 1, 2, 3, 4], [4, 3], [2], [0, 1]]) {
    assert.equal(topByPaintOrder(indices, model), sortByPaintOrder(indices, model).at(-1));
  }
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

test('there is no second, shorter wording for a legend to carry', async () => {
  // The legend note carried a short clause for one commit. The owner removed it
  // from the visible interface on 2026-09-30, so the module exports one wording
  // and only one: a second form is what would let the legend's sentence drift
  // from the description's, and there is no longer a caller for it.
  const module = await import('../../site/js/core/paint-priority.js');
  assert.equal(module.drawOrderNote, undefined);
  assert.ok(!Object.keys(module).some((name) => /note|clause/i.test(name)),
    `no short-form export may return: ${Object.keys(module).join(', ')}`);
});

test('the reason a category colour cannot choose a direction is stated, not implied', () => {
  assert.match(CATEGORICAL_DIRECTION_REASON, /no value order to reverse/);
  assert.match(CATEGORICAL_DIRECTION_REASON, /lab-reviewed above source-derived/);
});

test('a category model with no evidence accessor reads every category as reviewed', () => {
  // `isDerived` is optional, so a view that has no derivation to report must
  // still get a total order rather than an undefined evidence rank.
  const bare = {
    categorical: true,
    passes: () => true,
    hasValue: () => true,
  };
  assert.equal(paintPriority(0, bare).evidence, EVIDENCE_RANK.reviewed);
  assert.deepEqual(sortByPaintOrder([0, 1], bare), [1, 0]);
});

test('the disclosure drops the metric name when there is none to give', () => {
  assert.match(describeDrawOrder({ categorical: false }),
    /^Where marks overlap, the highest value draws on top/);
  assert.match(describeDrawOrder({ categorical: false, direction: 'lowest' }),
    /^Where marks overlap, the lowest value draws on top/);
});

/**
 * The batch order a view that groups marks by colour issues, from this same
 * rule. The fields are what a batch of marks shares; the sequence comes back
 * from {@link comparePaintPriority}, not from the caller's own opinion.
 */
const BATCHES = Object.freeze([
  { passes: false, hasValue: false },
  { passes: false, hasValue: true },
  { hasValue: false },
  { derived: true, value: 0 },
  { derived: true, value: 1 },
  { value: 0 },
  { value: 1 },
]);

test('batches are issued by tier, then evidence, then value', () => {
  assert.deepEqual(
    paintBatchOrder(BATCHES, { categorical: true }),
    [0, 1, 2, 3, 4, 5, 6],
    'in category colour every derived batch precedes every reviewed one',
  );
  assert.deepEqual(
    paintBatchOrder(BATCHES, { categorical: false }),
    [0, 1, 2, 3, 5, 4, 6],
    'in metric colour the value decides, and evidence is not part of the rule',
  );
});

test('the lowest direction reverses the valued batches and nothing above them', () => {
  const order = paintBatchOrder(BATCHES, { categorical: false, direction: 'lowest' });
  assert.deepEqual(order, [0, 1, 2, 4, 6, 3, 5]);
  assert.deepEqual(order.slice(0, 3), [0, 1, 2],
    'the filtered-out and no-value batches stay at the bottom in either direction',
  );
});

test('two batches the rule cannot separate keep the order the caller declared', () => {
  // The rule's last word is the earlier locus, and a batch has no single locus.
  // This is the one permitted difference from a view that sorts marks, so it is
  // pinned: the declared sequence is the tie-break, and it is deterministic.
  const tied = [{ value: 7 }, { value: 7 }, { value: 7 }];
  assert.deepEqual(paintBatchOrder(tied, { categorical: false }), [0, 1, 2]);
  assert.deepEqual(paintBatchOrder(tied, { categorical: false, direction: 'lowest' }), [0, 1, 2]);
  assert.deepEqual(paintBatchOrder(tied, { categorical: true }), [0, 1, 2]);
});

test('a batch that omits every field is a passing, valued, reviewed batch at value 0', () => {
  const [only] = paintBatchOrder([{}]);
  assert.equal(only, 0);
  assert.deepEqual(paintBatchOrder([{ value: 1 }, {}]), [1, 0],
    'defaults put it below a batch of higher value, so "no fields" is not "no tier"',
  );
  assert.deepEqual(paintBatchOrder([]), []);
});

test('the lowest direction survives a value the model cannot give a number for', () => {
  // Both the `-value` and the finiteness guard, in the reversed direction: the
  // negation of a non-finite value is still non-finite, and the comparator has
  // to stay total either way.
  const nanModel = metricModel({
    direction: 'lowest', hasValue: () => true, valueOf: () => NaN,
  });
  assert.equal(paintPriority(3, nanModel).value, 0);
  const bareLowest = {
    categorical: false,
    direction: 'lowest',
    passes: () => true,
    hasValue: () => true,
  };
  assert.equal(paintPriority(2, bareLowest).value, 0,
    'a model with no value accessor at all is 0, not NaN, in either direction');
  assert.deepEqual(sortByPaintOrder([2, 1], bareLowest), [2, 1]);
  const finiteLowest = metricModel({ direction: 'lowest', hasValue: () => true });
  assert.equal(paintPriority(4, finiteLowest).value, -90);
});

test('a categorical channel with one kind of evidence is not told it has two', () => {
  // The function-category channel resolves a category from a lab review or
  // from a derivation, and the rule names both.
  assert.match(describeDrawOrder({ categorical: true, direction: 'highest' }),
    /a lab-reviewed category draws over a source-derived one/);
  // The overlapping-gene classes come from the annotation and nothing else, so
  // the sentence must not claim a distinction this channel does not have.
  const single = describeDrawOrder({
    categorical: true, direction: 'highest', derivedEvidence: false,
  });
  assert.equal(single, 'Where marks overlap, a gene with a class draws over a gene with none.');
  assert.ok(!/reviewed|derived/.test(single));
  // And the same for the per-column rule the chromosome view discloses.
  const columns = { occupied: 10, shared: 3, median: 1, max: 2 };
  const withBoth = describePaintOrder({
    categorical: true, order: 'x', accession: 'chr', columns, alike: null,
  }).join(' ');
  assert.match(withBoth, /a lab-reviewed category over a source-derived one, then the category/);
  const withOne = describePaintOrder({
    categorical: true, derivedEvidence: false, order: 'x', accession: 'chr', columns, alike: null,
  }).join(' ');
  assert.match(withOne, /the column shows the category with more CDSs in that column/);
  assert.ok(!/reviewed|derived/.test(withOne));
});
