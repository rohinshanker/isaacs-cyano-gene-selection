/**
 * One paint-order rule, shared by the chromosome view and the scatter maps.
 *
 * When many genes land on the same pixels, something has to be seen and
 * everything else has to be underneath it. That decision is made here, once,
 * and both views sort by it: a gene the filters hide is at the bottom, a gene
 * with no value for the selected colour is above it, a gene that carries a
 * value is above that, and the marks the reader has singled out are above
 * everything. Painting ascending puts the highest priority on top.
 *
 * The rule is a pure function of one gene's state, so it is testable without a
 * canvas, and neither view carries a second copy of it. What a view supplies is
 * its own reading of that state — which genes pass the filters, what value the
 * colour channel holds, whether the category came from review or from a
 * derivation — through the accessor object {@link paintPriority} takes.
 *
 * Ties break by locus order, with the earlier locus on top, which is what owner
 * decision D2 asks for and what both views disclose. Without a last word a
 * re-render could swap two genes that coincide exactly and make the picture
 * flicker between two equally valid answers.
 */

/** The draw directions the reader can choose, and the one a fresh view uses. */
export const DRAW_DIRECTIONS = Object.freeze(['highest', 'lowest']);
export const DEFAULT_DRAW_DIRECTION = 'highest';

/** Labels for the draw-direction control, in the order {@link DRAW_DIRECTIONS} lists. */
export const DRAW_DIRECTION_LABELS = Object.freeze({
  highest: 'Highest value',
  lowest: 'Lowest value',
});

/**
 * Why a function-category colour cannot choose a draw direction. Category
 * colours are a set of names, not an ordered quantity, so "highest" has no
 * meaning to reverse; the reviewed-above-derived rule applies instead.
 */
export const CATEGORICAL_DIRECTION_REASON = 'Function category has no value order to reverse: '
  + 'its colours are named categories, not a ramp over values. Overlapping marks there are '
  + 'ordered lab-reviewed above source-derived, above genes with no category.';

/** An unknown or absent direction is the default, never an error. */
export function normalizeDrawDirection(value) {
  return DRAW_DIRECTIONS.includes(value) ? value : DEFAULT_DRAW_DIRECTION;
}

/**
 * The four tiers, lowest painted first. A gene's tier is decided before
 * anything inside it is compared, so no value, however extreme, lifts a
 * filtered-out gene above one the filters keep.
 */
export const PAINT_TIER = Object.freeze({
  filteredOut: 0,
  noValue: 1,
  valued: 2,
  emphasised: 3,
});

/**
 * Order within the emphasised tier. These are the marks the reader singled out,
 * and they rank by how immediate the attention is: a shortlist entry is a
 * standing choice, the keyboard cursor and the pointer are where the reader is
 * looking now, and the pinned gene is the one the whole workspace is open on.
 */
export const EMPHASIS_RANK = Object.freeze({
  none: 0,
  shortlisted: 1,
  active: 2,
  hovered: 3,
  pinned: 4,
});

/** Evidence order inside the valued tier in category colour: derived below reviewed. */
export const EVIDENCE_RANK = Object.freeze({ derived: 0, reviewed: 1 });

/**
 * The paint priority of one gene, as a record the comparator reads.
 *
 * @param {number} index the gene's dataset index, which is its locus order.
 * @param {{categorical: boolean, direction?: string,
 *   passes: (index: number) => boolean,
 *   hasValue: (index: number) => boolean,
 *   valueOf?: (index: number) => number,
 *   isDerived?: (index: number) => boolean,
 *   columnMajority?: (index: number) => number,
 *   emphasis?: (index: number) => number}} model the view's reading of the
 *   shared colour and selection state. `columnMajority` is owner decision D2's
 *   count — how many genes share this gene's category in the one column being
 *   resolved — and is 0 for a view that has no columns, and for a caller
 *   ordering genes rather than deciding one column. `emphasis` is
 *   {@link EMPHASIS_RANK}; a view that draws its selection marks as a separate
 *   pass above everything leaves it at `none` and gets the same picture.
 * @returns {{tier: number, evidence: number, value: number, majority: number,
 *   emphasis: number, index: number}}
 */
export function paintPriority(index, model) {
  const emphasis = model.emphasis ? model.emphasis(index) : EMPHASIS_RANK.none;
  const base = {
    evidence: 0, value: 0, majority: 0, emphasis, index,
  };
  if (!model.passes(index)) return { ...base, tier: PAINT_TIER.filteredOut, emphasis: 0 };
  if (emphasis !== EMPHASIS_RANK.none) return { ...base, tier: PAINT_TIER.emphasised };
  if (!model.hasValue(index)) return { ...base, tier: PAINT_TIER.noValue };
  if (model.categorical) {
    return {
      ...base,
      tier: PAINT_TIER.valued,
      evidence: model.isDerived?.(index) ? EVIDENCE_RANK.derived : EVIDENCE_RANK.reviewed,
      majority: model.columnMajority ? model.columnMajority(index) : 0,
    };
  }
  // `valueOf` is optional, and a view that reports a value it cannot give a
  // number for is not an error either: the finiteness guard below makes both
  // cases 0, so the comparator stays a total order in every tier.
  const value = model.valueOf?.(index);
  // "Lowest on top" reverses the valued tier and nothing else: a gene with no
  // value stays underneath either way, because absence is not a low value.
  const signed = normalizeDrawDirection(model.direction) === 'lowest' ? -value : value;
  return { ...base, tier: PAINT_TIER.valued, value: Number.isFinite(signed) ? signed : 0 };
}

/**
 * Ascending paint order: a negative result means `a` is painted first and so
 * ends up underneath `b`.
 *
 * Every field is compared, in one order, for every tier. The fields a tier does
 * not use are zero for every gene in it, so they fall through without a branch
 * and the comparator stays a total order — which is what makes the locus-order
 * tie-break the last word rather than one of several.
 *
 * That last word is `b.index - a.index`, not the other way round, because this
 * order is painted ascending: the smaller index has to sort *last* for the
 * earlier locus to be the one on top. Owner decision D2 ends "then the earlier
 * locus", and both views say so in their descriptions.
 */
export function comparePaintPriority(a, b) {
  return a.tier - b.tier
    || a.emphasis - b.emphasis
    || a.evidence - b.evidence
    || a.value - b.value
    || a.majority - b.majority
    || b.index - a.index;
}

/**
 * `indices` in ascending paint order, as a new array. The input is not mutated,
 * because both views hold their index lists across frames.
 *
 * @param {Iterable<number>} indices
 * @param {object} model as {@link paintPriority} takes.
 * @returns {number[]}
 */
export function sortByPaintOrder(indices, model) {
  return [...indices]
    .map((index) => paintPriority(index, model))
    .sort(comparePaintPriority)
    .map((entry) => entry.index);
}

/**
 * The gene that ends up on top among `indices`: the last one this rule would
 * paint, or -1 for an empty list.
 *
 * Where a view has to answer for one place in the picture rather than order
 * everything, this is the question it is really asking — which gene does that
 * place show. The chromosome view resolves each shared column with it, because
 * owner decision D2's majority is a property of a column and not of a gene, and
 * a gene wider than a column can be the majority category in one column and a
 * minority in the next. No single order over the genes can put the right one on
 * top of both columns; resolving them one at a time can.
 *
 * @param {Iterable<number>} indices
 * @param {object} model as {@link paintPriority} takes.
 * @returns {number}
 */
export function topByPaintOrder(indices, model) {
  let top = -1;
  let topPriority = null;
  for (const index of indices) {
    const priority = paintPriority(index, model);
    if (topPriority === null || comparePaintPriority(topPriority, priority) < 0) {
      top = index;
      topPriority = priority;
    }
  }
  return top;
}

/**
 * The order a view that batches its marks issues those batches in, from this
 * same rule and this same comparator.
 *
 * A view that groups marks by quantized colour to keep panning fast cannot sort
 * marks one at a time, but it can still take its order from here rather than
 * decide one of its own. Each batch is described by the state every mark in it
 * shares — whether the filters keep them, whether they carry a value for the
 * selected colour, whether the category came from a derivation, and one
 * representative value monotonic in the real ones — and those descriptions are
 * ordered by {@link comparePaintPriority}.
 *
 * **The one permitted difference from a view that sorts marks.** Two batches
 * that tie on every field the rule compares keep the order the caller declared
 * them in. The rule's last word is the earlier locus, and a batch has no single
 * locus; `Array.prototype.sort` is stable, so the caller's declared sequence is
 * the tie-break instead. It is deterministic, and the view that uses it states
 * it in its drawing contract.
 *
 * @param {{passes?: boolean, hasValue?: boolean, derived?: boolean,
 *   value?: number}[]} batches one descriptor per batch, in the order the
 *   caller wants ties resolved in.
 * @param {{categorical: boolean, direction?: string}} model
 * @returns {number[]} positions into `batches`, first issued first.
 */
export function paintBatchOrder(batches, { categorical, direction } = {}) {
  // Every descriptor is priced at the same index, so the comparator's locus
  // term is always zero and the stable sort keeps the declared order.
  const priorities = batches.map((batch) => paintPriority(0, {
    categorical,
    direction,
    passes: () => batch.passes !== false,
    hasValue: () => batch.hasValue !== false,
    isDerived: () => batch.derived === true,
    valueOf: () => batch.value ?? 0,
  }));
  return batches
    .map((_batch, position) => position)
    .sort((a, b) => comparePaintPriority(priorities[a], priorities[b]));
}

/**
 * Where each gene lands in the painted order: gene index to rank, 0 at the
 * bottom. This is what lets a hit test answer with the gene the picture
 * actually shows rather than with whichever gene the geometry reaches first.
 *
 * @param {Iterable<number>} indices
 * @param {object} model as {@link paintPriority} takes.
 * @returns {Map<number, number>}
 */
export function paintRanks(indices, model) {
  const ranks = new Map();
  sortByPaintOrder(indices, model).forEach((index, rank) => ranks.set(index, rank));
  return ranks;
}

/**
 * How the ordering reads in a sentence, for both canvases' accessible
 * descriptions and for the collapsed colour explanation the Draw on top control
 * sits in. Kept beside the rule so the wording cannot describe an order the
 * comparator does not produce.
 *
 * Those are the only places it appears. A short clause for the legend note lived
 * here until the owner decided on 2026-09-30, after seeing the first render, that
 * the legend states none of this; there is no second, shorter wording to keep in
 * step with this one.
 *
 * @param {{categorical: boolean, direction?: string, metricLabel?: string|null}} model
 * @returns {string}
 */
export function describeDrawOrder({ categorical, direction, metricLabel = null }) {
  if (categorical) {
    return 'Where marks overlap, a lab-reviewed category draws over a source-derived one, '
      + 'and both draw over genes with no category.';
  }
  const label = metricLabel ? `${metricLabel} ` : '';
  return normalizeDrawDirection(direction) === 'lowest'
    ? `Where marks overlap, the lowest ${label}value draws on top; genes with no value stay under `
      + 'the coloured ones.'
    : `Where marks overlap, the highest ${label}value draws on top; genes with no value stay under `
      + 'the coloured ones.';
}
