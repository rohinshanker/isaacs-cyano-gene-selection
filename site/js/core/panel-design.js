/**
 * Choosing a 6-to-10-gene experimental panel.
 *
 * The question is not "which genes are best" — there is no single best gene, and
 * this is not a prediction of how a recoded strain will do. It is a design
 * question: which genes, taken together, spread across the properties that make
 * one recoding experiment tell you something a different one would not, while
 * every gene stays inside the constraints the bench imposes.
 *
 * The objective is constrained stratified maximin. Starting from the seeds the
 * user insists on, each step adds the feasible gene that reaches the most parts
 * of the feature space nothing selected has reached, and among those the gene
 * whose nearest already-selected neighbour is farthest away. Both halves matter:
 * maximin alone drives every choice to the extremes of the range and skips the
 * middle, while stratification alone would accept near-duplicates that happen to
 * fall in an empty bin. The full order is documented in {@link SELECTION_ORDER},
 * so the same inputs always give the same panel.
 *
 * Nothing here touches the DOM.
 */
import { expressionBasisOf } from './metric-registry.js';
import {
  featureDistance, distanceFromCentre, presentFeatureCount, coverageOf, binOf,
  isBorrowedMetric, parseSchemeFeatureKey, COVERAGE_BINS,
} from './panel-features.js';

/** The lab runs between six and ten constructs, so the panel size lives there. */
export const MIN_PANEL_SIZE = 6;
export const MAX_PANEL_SIZE = 10;
export const DEFAULT_PANEL_SIZE = 8;

/** The objective this module implements, named in the export and the interface. */
export const OBJECTIVE_ID = 'constrained-stratified-maximin';

/**
 * How a candidate is scored, in order. The first rule that separates two
 * candidates decides between them, so the whole order is the objective and the
 * tie-break at once, and the same inputs always give the same panel.
 *
 * Maximin distance alone is not enough, and the reason is worth stating. On a
 * bounded feature space the farthest-apart set is the set of corners: pure
 * maximin fills the extremes of every feature and skips the middle, so a panel
 * chosen that way spans the range but never samples inside it. Measured against
 * the real genome it filled fewer quantile bins than drawing genes at random.
 * Asking first for a bin nothing has occupied yet fixes that, and maximin then
 * decides between the candidates that offer the same new ground, which keeps the
 * panel spread out rather than merely stratified.
 */
export const SELECTION_ORDER = Object.freeze([
  'reaches more quantile bins no selected gene occupies',
  'farther from the nearest selected gene',
  'larger total distance to the selected genes',
  'more features with a measured value',
  'lower locus tag',
]);

/** Kept as the older name for the last four rules, which break a stratification tie. */
export const TIE_BREAK_ORDER = Object.freeze(SELECTION_ORDER.slice(1));

/** Flag constraints the workflow understands, with the wording the reader sees. */
export const FLAG_CONSTRAINTS = Object.freeze([
  {
    id: 'excludeTranslationalExceptions',
    label: 'Exclude translational exceptions',
    detail: 'Genes that translate only through a programmed ribosome event are poor recoding '
      + 'targets, so they are left out by default.',
    defaultOn: true,
  },
  {
    id: 'excludeAmbiguousLoci',
    label: 'Exclude overlapping or discontinuous loci',
    detail: 'A gene that overlaps its neighbour or has a split coding sequence cannot be edited '
      + 'without touching something else, so it is left out by default.',
    defaultOn: true,
  },
  {
    id: 'requireMeasuredExpression',
    label: 'Require a measured expression value',
    detail: 'Keeps only genes whose expression is a real measurement. It depends on borrowed '
      + 'data, so it needs borrowed expression switched on.',
    defaultOn: false,
    needsBorrowed: true,
  },
]);

/** A design configuration with every field filled in. */
export function normaliseConfig(config = {}) {
  const size = Math.round(Number(config.size ?? DEFAULT_PANEL_SIZE));
  const unique = (list) => [...new Set((list ?? []).filter((id) => typeof id === 'string' && id))];
  return {
    size: Number.isFinite(size) ? Math.min(MAX_PANEL_SIZE, Math.max(MIN_PANEL_SIZE, size)) : DEFAULT_PANEL_SIZE,
    seeds: unique(config.seeds),
    include: unique(config.include),
    exclude: unique(config.exclude),
    ranges: { ...(config.ranges ?? {}) },
    replicons: config.replicons ? [...config.replicons] : null,
    excludeTranslationalExceptions: config.excludeTranslationalExceptions !== false,
    excludeAmbiguousLoci: config.excludeAmbiguousLoci !== false,
    requireMeasuredExpression: config.requireMeasuredExpression === true,
    allowBorrowedExpression: config.allowBorrowedExpression === true,
    objective: OBJECTIVE_ID,
  };
}

/** True when the panel size the caller asked for is one the lab can run. */
export function validateSize(size) {
  return Number.isInteger(size) && size >= MIN_PANEL_SIZE && size <= MAX_PANEL_SIZE;
}

function rangeText(metric, range) {
  const parts = [];
  if (Number.isFinite(range.min)) parts.push(`at least ${range.min}`);
  if (Number.isFinite(range.max)) parts.push(`at most ${range.max}`);
  const body = parts.length > 0 ? parts.join(' and ') : 'any value';
  return `${metric.label} ${body}`;
}

/**
 * Turn a configuration into the list of constraints actually in force, plus the
 * ones that were asked for but cannot be applied.
 *
 * A borrowed measurement is never used silently: a range on a metric measured in
 * another organism, or the measured-expression requirement, is inactive unless
 * the user switched borrowed expression on, and says so either way.
 *
 * @returns {{active: object[], blocked: object[], borrowedInUse: object[]}}
 */
export function resolveConstraints({ registry, config }) {
  const active = [];
  const blocked = [];
  const borrowedInUse = [];

  for (const [key, range] of Object.entries(config.ranges)) {
    const metric = registry.byKey.get(key);
    if (!metric) {
      blocked.push({ id: `range:${key}`, label: key, reason: `${key} is not in this dataset.` });
      continue;
    }
    const normalised = {
      min: Number.isFinite(range?.min) ? Number(range.min) : null,
      max: Number.isFinite(range?.max) ? Number(range.max) : null,
      includeMissing: range?.includeMissing !== false,
    };
    if (normalised.min === null && normalised.max === null) continue;
    // A live metric is whatever the currently active scheme makes it, so a hard
    // constraint on one would mean something different the moment the scheme
    // changed. Constraints stay on the scheme-independent published metrics.
    if (metric.source === 'live') {
      blocked.push({
        id: `range:${key}`,
        label: metric.label,
        reason: `${metric.label} changes with the recoding scheme, so it cannot be a hard `
          + 'constraint. Constrain a published metric instead.',
      });
      continue;
    }
    const entry = {
      id: `range:${key}`,
      kind: 'range',
      key,
      metric,
      range: normalised,
      label: rangeText(metric, normalised),
      borrowed: isBorrowedMetric(metric),
      missingPolicy: normalised.includeMissing
        ? 'A gene with no value is kept: unknown is not out of range.'
        : 'A gene with no value is dropped, because this constraint was set to require one.',
    };
    if (entry.borrowed && !config.allowBorrowedExpression) {
      blocked.push({
        ...entry,
        reason: `${metric.label} is measured in another organism. Switch borrowed expression on `
          + 'to constrain on it.',
      });
      continue;
    }
    if (entry.borrowed) borrowedInUse.push(entry);
    active.push(entry);
  }

  if (config.replicons && config.replicons.length > 0) {
    active.push({
      id: 'replicons',
      kind: 'replicon',
      label: `On ${config.replicons.join(' or ')}`,
      replicons: new Set(config.replicons),
    });
  }

  for (const flag of FLAG_CONSTRAINTS) {
    if (!config[flag.id]) continue;
    if (flag.needsBorrowed && !config.allowBorrowedExpression) {
      blocked.push({
        id: flag.id,
        label: flag.label,
        reason: 'This depends on expression measured in another organism. Switch borrowed '
          + 'expression on to use it.',
      });
      continue;
    }
    const entry = { id: flag.id, kind: 'flag', label: flag.label, detail: flag.detail };
    if (flag.needsBorrowed) borrowedInUse.push(entry);
    active.push(entry);
  }

  return { active, blocked, borrowedInUse };
}

/** Why one gene fails one constraint, or null when it passes. */
function constraintFailure(constraint, gene, index) {
  if (constraint.kind === 'range') {
    const value = constraint.metric.read(index);
    if (!Number.isFinite(value)) {
      return constraint.range.includeMissing
        ? null
        : `${constraint.metric.label} has no value, and this constraint requires one.`;
    }
    if (constraint.range.min !== null && value < constraint.range.min) {
      return `${constraint.metric.label} is ${value}, below ${constraint.range.min}.`;
    }
    if (constraint.range.max !== null && value > constraint.range.max) {
      return `${constraint.metric.label} is ${value}, above ${constraint.range.max}.`;
    }
    return null;
  }
  if (constraint.kind === 'replicon') {
    return constraint.replicons.has(gene.seqid)
      ? null
      : `${gene.seqid} is not among the selected sequences.`;
  }
  if (constraint.id === 'excludeTranslationalExceptions') {
    return gene.translationalException
      ? `Translational exception: ${String(gene.translationalException).replace(/_/g, ' ')}.`
      : null;
  }
  if (constraint.id === 'excludeAmbiguousLoci') {
    if (gene.overlapsNeighbor === true) return 'Overlaps a neighbouring gene.';
    if (Array.isArray(gene.cdsSegments) && gene.cdsSegments.length > 1) {
      return `Coding sequence is split into ${gene.cdsSegments.length} segments.`;
    }
    return null;
  }
  if (constraint.id === 'requireMeasuredExpression') {
    const basis = expressionBasisOf(gene).basis;
    return basis === 'measured' ? null : `Expression basis is ${basis}, not a measurement.`;
  }
  return null;
}

/**
 * The genes a design may choose from, and why each excluded gene was excluded.
 *
 * @returns {{pool: number[], rejections: Map<number, string[]>, counts: Map<string, number>,
 *   excludedByUser: string[], unknownIds: string[]}}
 */
export function eligibleGenes({ dataset, constraints, config }) {
  const pool = [];
  const rejections = new Map();
  const counts = new Map();
  const excludedSet = new Set(config.exclude);
  const excludedByUser = [];
  const unknownIds = [];

  for (const id of [...config.seeds, ...config.include, ...config.exclude]) {
    if (!dataset.indexById.has(id)) unknownIds.push(id);
  }

  dataset.genes.forEach((gene, index) => {
    if (excludedSet.has(gene.id)) {
      rejections.set(index, ['Excluded by hand.']);
      excludedByUser.push(gene.id);
      counts.set('excluded', (counts.get('excluded') ?? 0) + 1);
      return;
    }
    const reasons = [];
    for (const constraint of constraints) {
      const failure = constraintFailure(constraint, gene, index);
      if (failure) {
        reasons.push(failure);
        counts.set(constraint.id, (counts.get(constraint.id) ?? 0) + 1);
      }
    }
    if (reasons.length === 0) pool.push(index);
    else rejections.set(index, reasons);
  });

  return { pool, rejections, counts, excludedByUser: [...new Set(excludedByUser)], unknownIds };
}

/**
 * Greedy constrained stratified maximin.
 *
 * With no anchor to start from, the first gene is the one farthest from the
 * centre of the scaled space: an ordinary gene in every feature would give the
 * rest of the search nothing to spread away from. After that each step takes the
 * candidate that reaches the most quantile bins no selected gene occupies, and
 * among those the one whose nearest selected neighbour is farthest. Both numbers
 * are recorded so the interface can explain the choice.
 *
 * @param {{space: object, pool: number[], size: number, anchors?: number[],
 *   idOf: (index: number) => string}} options
 * @returns {{selected: number[], steps: Array<object>, feasible: boolean,
 *   requested: number, shortfall: number}}
 */
export function selectPanel({ space, pool, size, anchors = [], idOf }) {
  const { scaled, dims } = space;
  const available = new Set(pool);
  const selected = [];
  const steps = [];
  const occupied = Array.from({ length: dims }, () => new Set());

  const occupy = (index) => {
    for (let c = 0; c < dims; c += 1) {
      const value = scaled[index * dims + c];
      if (Number.isFinite(value)) occupied[c].add(binOf(value, COVERAGE_BINS));
    }
  };
  const newBinsFor = (index) => {
    let count = 0;
    for (let c = 0; c < dims; c += 1) {
      const value = scaled[index * dims + c];
      if (Number.isFinite(value) && !occupied[c].has(binOf(value, COVERAGE_BINS))) count += 1;
    }
    return count;
  };

  for (const anchor of anchors) {
    if (selected.includes(anchor)) continue;
    const earlier = [...selected];
    const distances = earlier.map((other) => featureDistance(space, anchor, other));
    const nearestDistance = distances.length > 0 ? Math.min(...distances) : NaN;
    steps.push({
      index: anchor,
      order: steps.length,
      role: 'seed',
      newBins: newBinsFor(anchor),
      minDistance: nearestDistance,
      nearest: distances.length > 0 ? earlier[distances.indexOf(nearestDistance)] : -1,
    });
    selected.push(anchor);
    occupy(anchor);
    available.delete(anchor);
  }

  while (selected.length < size) {
    let best = null;
    for (const candidate of available) {
      let minDistance = Infinity;
      let total = 0;
      let nearest = -1;
      for (const chosen of selected) {
        const d = featureDistance(space, candidate, chosen);
        total += d;
        if (d < minDistance) {
          minDistance = d;
          nearest = chosen;
        }
      }
      // Nothing is selected yet, so every bin is unoccupied and stratification
      // cannot separate candidates. Distance from the centre picks the anchor.
      const first = selected.length === 0;
      if (first) {
        minDistance = distanceFromCentre(space, candidate);
        total = minDistance;
      }
      const entry = {
        index: candidate,
        newBins: first ? 0 : newBinsFor(candidate),
        minDistance,
        total,
        present: presentFeatureCount(space, candidate),
        id: idOf(candidate),
        nearest,
      };
      if (best === null || betterCandidate(entry, best)) best = entry;
    }
    if (best === null) break;
    steps.push({
      index: best.index,
      order: steps.length,
      role: selected.length === 0 ? 'anchor' : 'added',
      newBins: best.newBins,
      minDistance: best.minDistance,
      nearest: best.nearest,
    });
    selected.push(best.index);
    occupy(best.index);
    available.delete(best.index);
  }

  return {
    selected,
    steps,
    feasible: selected.length >= size,
    requested: size,
    shortfall: Math.max(0, size - selected.length),
  };
}

/** The documented order, applied exactly as {@link SELECTION_ORDER} states it. */
function betterCandidate(candidate, best) {
  if (candidate.newBins !== best.newBins) return candidate.newBins > best.newBins;
  if (candidate.minDistance !== best.minDistance) return candidate.minDistance > best.minDistance;
  if (candidate.total !== best.total) return candidate.total > best.total;
  if (candidate.present !== best.present) return candidate.present > best.present;
  return candidate.id < best.id;
}

/**
 * Why one gene earned its place: what it sits next to, which parts of the
 * feature space it reaches that nothing already selected reached, which
 * constraints it clears, and what a reader should be careful about.
 */
function explainGene({ space, dataset, index, step, earlier, constraints }) {
  const gene = dataset.genes[index];
  const { dims, scaled } = space;

  const expands = [];
  for (let c = 0; c < dims; c += 1) {
    const value = scaled[index * dims + c];
    if (!Number.isFinite(value)) continue;
    const bin = binOf(value, COVERAGE_BINS);
    let min = Infinity;
    let max = -Infinity;
    const seenBins = new Set();
    for (const other of earlier) {
      const previous = scaled[other * dims + c];
      if (!Number.isFinite(previous)) continue;
      seenBins.add(binOf(previous, COVERAGE_BINS));
      if (previous < min) min = previous;
      if (previous > max) max = previous;
    }
    const newBin = !seenBins.has(bin);
    const below = Number.isFinite(min) && value < min;
    const above = Number.isFinite(max) && value > max;
    if (!newBin && !below && !above) continue;
    expands.push({
      key: space.keys[c],
      label: space.labels[c],
      percentile: value,
      bin,
      newBin,
      direction: below ? 'below' : above ? 'above' : 'within',
      scheme: parseSchemeFeatureKey(space.keys[c])?.schemeId ?? null,
    });
  }
  expands.sort((a, b) => (b.newBin - a.newBin) || (a.label < b.label ? -1 : 1));

  const satisfies = constraints
    .filter((constraint) => constraintFailure(constraint, gene, index) === null)
    .map((constraint) => {
      if (constraint.kind !== 'range') return { id: constraint.id, label: constraint.label };
      const value = constraint.metric.read(index);
      return {
        id: constraint.id,
        label: constraint.label,
        value: Number.isFinite(value) ? value : null,
      };
    });

  const caveats = [];
  const missing = dims - presentFeatureCount(space, index);
  if (missing > 0) {
    caveats.push(`${missing} of ${dims} features have no value for this gene, so it was compared `
      + 'on the rest rather than being given a stand-in number.');
  }
  if (gene.translationalException) {
    caveats.push('This gene carries a translational exception and only translates correctly '
      + 'through a programmed ribosome event.');
  }
  if (Array.isArray(gene.cdsSegments) && gene.cdsSegments.length > 1) {
    caveats.push(`Its coding sequence is split into ${gene.cdsSegments.length} segments.`);
  }
  if (gene.overlapsNeighbor === true) caveats.push('It overlaps a neighbouring gene.');
  const basis = expressionBasisOf(gene);
  if (basis.basis !== 'measured') caveats.push(`Expression: ${basis.text}`);

  return {
    id: gene.id,
    index,
    name: gene.name ?? null,
    product: gene.product ?? null,
    role: step.role,
    order: step.order,
    nearestId: step.nearest >= 0 ? dataset.genes[step.nearest].id : null,
    nearestDistance: Number.isFinite(step.minDistance) ? step.minDistance : null,
    expands,
    satisfies,
    caveats,
    missingFeatures: missing,
  };
}

/**
 * Design a panel end to end: resolve the constraints, find the eligible genes,
 * run the objective from the seeds, and explain the result.
 *
 * @param {{dataset: object, registry: object, space: object, config: object}} options
 * @returns {{config: object, constraints: object, pool: number[], selected: string[],
 *   genes: object[], coverageBefore: object, coverageAfter: object, feasible: boolean,
 *   shortfall: number, problems: string[], objective: string}}
 */
export function designPanel({ dataset, registry, space, config: rawConfig }) {
  const config = normaliseConfig(rawConfig);
  const constraints = resolveConstraints({ registry, config });
  const eligibility = eligibleGenes({ dataset, constraints: constraints.active, config });

  const problems = [];
  for (const id of eligibility.unknownIds) {
    problems.push(`${id} is not in this dataset, so it was ignored.`);
  }

  // Seeds and includes are promises the user made, so a seed the constraints
  // reject is reported rather than quietly dropped or quietly kept.
  const forcedIds = [...new Set([...config.seeds, ...config.include])];
  const anchors = [];
  const violatingAnchors = [];
  for (const id of forcedIds) {
    const index = dataset.indexById.get(id);
    if (index === undefined) continue;
    if (config.exclude.includes(id)) {
      problems.push(`${id} is both required and excluded; the exclusion wins.`);
      continue;
    }
    const reasons = eligibility.rejections.get(index);
    if (reasons) violatingAnchors.push({ id, reasons });
    anchors.push(index);
  }
  for (const entry of violatingAnchors) {
    problems.push(`${entry.id} is required but fails: ${entry.reasons.join(' ')}`);
  }
  if (anchors.length > config.size) {
    problems.push(`${anchors.length} genes are required but the panel size is ${config.size}. `
      + 'Raise the size or release some of them.');
  }

  const pool = eligibility.pool.filter((index) => !anchors.includes(index));
  const result = selectPanel({
    space,
    pool,
    size: config.size,
    anchors,
    idOf: (index) => dataset.genes[index].id,
  });

  if (!result.feasible) {
    problems.push(`Only ${result.selected.length} gene${result.selected.length === 1 ? '' : 's'} `
      + `satisfy every constraint, but ${config.size} were asked for. Relax a constraint or lower `
      + 'the size.');
  }

  const genes = result.steps.map((step, position) => explainGene({
    space,
    dataset,
    index: step.index,
    step,
    earlier: result.steps.slice(0, position).map((entry) => entry.index),
    constraints: constraints.active,
  }));

  return {
    config,
    constraints,
    eligibility,
    pool,
    objective: OBJECTIVE_ID,
    selectionOrder: SELECTION_ORDER,
    tieBreak: TIE_BREAK_ORDER,
    selected: result.selected.map((index) => dataset.genes[index].id),
    indices: result.selected,
    genes,
    coverageBefore: coverageOf(space, anchors),
    coverageAfter: coverageOf(space, result.selected),
    feasible: result.feasible && violatingAnchors.length === 0 && anchors.length <= config.size,
    shortfall: result.shortfall,
    problems,
  };
}
