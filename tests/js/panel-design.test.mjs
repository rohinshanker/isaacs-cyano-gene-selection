/**
 * The design must be the same panel every time, for reasons it can state.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLiveMetrics } from '../../site/js/core/live-metrics.js';
import { compileScheme } from '../../site/js/core/scheme.js';
import { buildMetricRegistry, expressionBasisOf } from '../../site/js/core/metric-registry.js';
import { buildPanelSpace, coverageOf, featureDistance } from '../../site/js/core/panel-features.js';
import {
  designPanel, selectPanel, normaliseConfig, resolveConstraints, eligibleGenes,
  validateSize, MIN_PANEL_SIZE, MAX_PANEL_SIZE, OBJECTIVE_ID, SELECTION_ORDER,
} from '../../site/js/core/panel-design.js';
import { expressionFixtureDataset } from './helpers.mjs';

let cached = null;
async function context() {
  if (cached) return cached;
  const dataset = await expressionFixtureDataset();
  const live = computeLiveMetrics(dataset, compileScheme({}, dataset.table)).fields;
  const registry = buildMetricRegistry(dataset.meta, dataset.genes, live);
  const space = buildPanelSpace({ dataset, registry });
  cached = { dataset, registry, space };
  return cached;
}

function syntheticSpace(rows) {
  const dims = rows[0].length;
  const scaled = Float64Array.from(rows.flat());
  return {
    keys: rows[0].map((_, i) => `f${i}`),
    labels: rows[0].map((_, i) => `Feature ${i}`),
    metrics: rows[0].map(() => null),
    dims,
    count: rows.length,
    scaled,
    raw: scaled,
    dropped: [],
    borrowed: [],
  };
}

/** Gene ids that sort in index order, so the tie-break is easy to reason about. */
const idOf = (index) => `g${String(index).padStart(2, '0')}`;

test('a panel size outside what the lab runs is rejected and clamped', () => {
  assert.equal(validateSize(MIN_PANEL_SIZE), true);
  assert.equal(validateSize(MAX_PANEL_SIZE), true);
  assert.equal(validateSize(MIN_PANEL_SIZE - 1), false);
  assert.equal(validateSize(MAX_PANEL_SIZE + 1), false);
  assert.equal(validateSize(7.5), false);
  assert.equal(normaliseConfig({ size: 2 }).size, MIN_PANEL_SIZE);
  assert.equal(normaliseConfig({ size: 40 }).size, MAX_PANEL_SIZE);
  assert.equal(normaliseConfig({}).objective, OBJECTIVE_ID);
});

test('with a known optimum the objective finds it', () => {
  // Four corners of a square plus three points clustered near the middle. The
  // objective ranks a set by the quantile bins it fills and then by how far apart
  // its members are, so the best four are two opposite corners plus two of the
  // middle points, which reach bins the corners never do.
  const space = syntheticSpace([
    [0, 0], [0, 1], [1, 0], [1, 1],
    [0.5, 0.5], [0.4, 0.6], [0.55, 0.45],
  ]);
  const all = [0, 1, 2, 3, 4, 5, 6];
  const result = selectPanel({ space, pool: all, size: 4, idOf });
  assert.equal(result.feasible, true);

  // Brute force every four-gene subset: nothing fills more bins, and nothing
  // that fills as many keeps its members farther apart.
  const score = (subset) => {
    const coverage = coverageOf(space, subset);
    return [coverage.filledBins, coverage.minPairDistance];
  };
  const ours = score(result.selected);
  for (const subset of combinations(all, 4)) {
    const [bins, minPair] = score(subset);
    assert.ok(
      bins < ours[0] || (bins === ours[0] && minPair <= ours[1] + 1e-12),
      `${subset} scored ${bins}/${minPair} against ${ours[0]}/${ours[1]}`,
    );
  }
});

test('a gene reaching an empty part of the space beats a farther one that does not', () => {
  // The anchor sits at the bottom of both features. One candidate is farther
  // away but lands in bins the anchor already occupies on the second feature;
  // the other is nearer and opens a bin on both. Stratification decides.
  const space = syntheticSpace([[0, 0], [1, 0.05], [0.5, 0.5]]);
  const result = selectPanel({ space, pool: [1, 2], size: 2, anchors: [0], idOf });
  assert.ok(
    featureDistance(space, 0, 1) > featureDistance(space, 0, 2),
    'the rejected candidate really is the farther one',
  );
  assert.deepEqual(result.selected, [0, 2]);
  assert.equal(result.steps[1].newBins, 2);
});

function* combinations(items, k, start = 0, chosen = []) {
  if (chosen.length === k) {
    yield [...chosen];
    return;
  }
  for (let i = start; i < items.length; i += 1) {
    chosen.push(items[i]);
    yield* combinations(items, k, i + 1, chosen);
    chosen.pop();
  }
}

test('with no seed the anchor is the gene farthest from the centre', () => {
  const space = syntheticSpace([[0.5, 0.5], [0.52, 0.48], [0, 1], [0.5, 0.6]]);
  const result = selectPanel({ space, pool: [0, 1, 2, 3], size: 2, idOf });
  assert.equal(result.selected[0], 2);
  assert.equal(result.steps[0].role, 'anchor');
});

test('seeds stay in the panel and come first, whatever the objective would pick', () => {
  const space = syntheticSpace([[0, 0], [0, 1], [1, 0], [1, 1], [0.5, 0.5]]);
  const result = selectPanel({ space, pool: [0, 1, 2, 3], size: 3, anchors: [4], idOf });
  assert.equal(result.selected[0], 4);
  assert.equal(result.steps[0].role, 'seed');
  assert.equal(result.selected.length, 3);
  assert.ok(result.selected.includes(4));
});

test('a tie is broken the documented way, and never by input order', () => {
  // Both candidates open the same one new bin and sit exactly as far from the
  // anchor, so every rule above the last one is silent: the lower locus tag wins.
  const space = syntheticSpace([[0, 0.5], [1, 0.44], [1, 0.56]]);
  assert.ok(Math.abs(
    featureDistance(space, 0, 1) - featureDistance(space, 0, 2),
  ) < 1e-15);
  const forward = selectPanel({ space, pool: [1, 2], size: 2, anchors: [0], idOf });
  const reversed = selectPanel({ space, pool: [2, 1], size: 2, anchors: [0], idOf });
  assert.deepEqual(forward.selected, reversed.selected);
  assert.equal(forward.steps[1].newBins, 1);
  assert.equal(forward.steps[2 - 1].index, 1);
  assert.equal(SELECTION_ORDER[SELECTION_ORDER.length - 1], 'lower locus tag');
  assert.equal(SELECTION_ORDER[0], 'reaches more quantile bins no selected gene occupies');
});

test('the same inputs give the same panel every run', async () => {
  const { dataset, registry, space } = await context();
  const config = { size: 8, seeds: [dataset.genes[3].id] };
  const first = designPanel({ dataset, registry, space, config });
  const second = designPanel({ dataset, registry, space, config });
  assert.deepEqual(first.selected, second.selected);
  assert.equal(first.selected.length, 8);
  assert.equal(first.selected[0], dataset.genes[3].id);
  assert.equal(new Set(first.selected).size, 8);
});

test('a gene missing features is compared on the rest and says so', () => {
  // Both candidates open exactly one new bin, so the distance decides. The gene
  // with no second value is compared on the feature it has, rescaled to the full
  // width of the space, rather than being handed a stand-in number.
  const space = syntheticSpace([[0, 0], [1, NaN], [1, 0.05]]);
  const result = selectPanel({ space, pool: [1, 2], size: 2, anchors: [0], idOf });
  assert.deepEqual(result.selected, [0, 1]);
  assert.ok(Math.abs(result.steps[1].minDistance - Math.sqrt(2)) < 1e-12);
  // A zero standing in for the unknown would have made this the nearer gene.
  assert.ok(featureDistance(space, 0, 2) < Math.sqrt(2));
});

test('a duplicated feature does not evict the independent one', () => {
  const points = [[0, 0.5], [1, 0.5], [0.5, 0], [0.5, 1], [0.5, 0.5]];
  const plain = syntheticSpace(points);
  const correlated = syntheticSpace(points.map(([x, y]) => [x, x, x, y]));
  const pool = [0, 1, 2, 3, 4];
  const fromPlain = selectPanel({ space: plain, pool, size: 4, idOf }).selected;
  const fromCorrelated = selectPanel({ space: correlated, pool, size: 4, idOf }).selected;
  for (const extreme of [2, 3]) {
    assert.ok(fromPlain.includes(extreme), 'plain space keeps both ends of the second feature');
    assert.ok(fromCorrelated.includes(extreme), 'three copies of the first feature do not evict them');
  }
});

test('constraints that cannot be met are reported rather than silently relaxed', async () => {
  const { dataset, registry, space } = await context();
  const design = designPanel({
    dataset,
    registry,
    space,
    config: { size: 8, ranges: { cai: { min: 2, max: null } } },
  });
  assert.equal(design.feasible, false);
  assert.equal(design.selected.length, 0);
  assert.equal(design.shortfall, 8);
  assert.match(design.problems.join(' '), /Relax a constraint or lower the size/);
});

test('a hard range keeps every selected gene inside it', async () => {
  const { dataset, registry, space } = await context();
  const cai = registry.byKey.get('cai');
  const values = dataset.genes.map((_, i) => cai.read(i)).filter(Number.isFinite).sort((a, b) => a - b);
  const floor = values[Math.floor(values.length * 0.4)];
  const design = designPanel({
    dataset, registry, space, config: { size: 8, ranges: { cai: { min: floor } } },
  });
  assert.equal(design.feasible, true);
  for (const id of design.selected) {
    assert.ok(cai.read(dataset.indexById.get(id)) >= floor, `${id} should clear the CAI floor`);
  }
});

test('unknown is not out of range unless the reader says a value is required', async () => {
  const { dataset, registry, space } = await context();
  const mfe = registry.byKey.get('mfeStart');
  const withoutValue = dataset.genes.findIndex((_, i) => !Number.isFinite(mfe.read(i)));
  assert.ok(withoutValue >= 0, 'the fixture should contain a gene with no folding energy');

  const kept = eligibleGenes({
    dataset,
    config: normaliseConfig({}),
    constraints: resolveConstraints({
      registry, config: normaliseConfig({ ranges: { mfeStart: { min: -50 } } }),
    }).active,
  });
  assert.ok(kept.pool.includes(withoutValue));

  const dropped = eligibleGenes({
    dataset,
    config: normaliseConfig({}),
    constraints: resolveConstraints({
      registry,
      config: normaliseConfig({ ranges: { mfeStart: { min: -50, includeMissing: false } } }),
    }).active,
  });
  assert.ok(!dropped.pool.includes(withoutValue));
  assert.match(dropped.rejections.get(withoutValue).join(' '), /has no value/);
});

test('borrowed expression is refused until it is switched on, and labelled when it is', async () => {
  const { registry } = await context();
  const config = normaliseConfig({
    ranges: { expression: { min: 10 } }, requireMeasuredExpression: true,
  });
  const withheld = resolveConstraints({ registry, config });
  assert.equal(withheld.active.some((entry) => entry.id === 'range:expression'), false);
  assert.equal(withheld.borrowedInUse.length, 0);
  assert.equal(withheld.blocked.length, 2);
  for (const entry of withheld.blocked) assert.match(entry.reason, /another organism|borrowed/);

  const allowed = resolveConstraints({
    registry, config: { ...config, allowBorrowedExpression: true },
  });
  assert.equal(allowed.blocked.length, 0);
  assert.deepEqual(
    allowed.borrowedInUse.map((entry) => entry.id).sort(),
    ['range:expression', 'requireMeasuredExpression'],
  );
});

test('measured-only keeps only genes whose expression is a measurement', async () => {
  const { dataset, registry, space } = await context();
  const design = designPanel({
    dataset,
    registry,
    space,
    config: { size: 6, requireMeasuredExpression: true, allowBorrowedExpression: true },
  });
  assert.equal(design.feasible, true);
  for (const id of design.selected) {
    const gene = dataset.genes[dataset.indexById.get(id)];
    assert.equal(expressionBasisOf(gene).basis, 'measured');
  }
});

test('flagged and ambiguous loci are left out by default', async () => {
  const { dataset, registry, space } = await context();
  const design = designPanel({ dataset, registry, space, config: { size: 8 } });
  for (const id of design.selected) {
    const gene = dataset.genes[dataset.indexById.get(id)];
    assert.equal(gene.translationalException ?? null, null);
    assert.notEqual(gene.overlapsNeighbor, true);
    assert.ok(!(Array.isArray(gene.cdsSegments) && gene.cdsSegments.length > 1));
  }
});

test('an excluded gene never appears, and a required one that fails says why', async () => {
  const { dataset, registry, space } = await context();
  const flagged = dataset.genes.find((gene) => gene.translationalException);
  assert.ok(flagged, 'the fixture should carry a translational exception');

  const design = designPanel({
    dataset, registry, space, config: { size: 6, include: [flagged.id] },
  });
  assert.ok(design.selected.includes(flagged.id));
  assert.equal(design.feasible, false);
  assert.match(design.problems.join(' '), new RegExp(`${flagged.id} is required but fails`));

  const without = designPanel({
    dataset, registry, space, config: { size: 6, exclude: [design.selected[1]] },
  });
  assert.ok(!without.selected.includes(design.selected[1]));
});

test('every added gene is explained by what it sits next to and what it reaches', async () => {
  const { dataset, registry, space } = await context();
  const design = designPanel({
    dataset, registry, space, config: { size: 7, seeds: [dataset.genes[1].id] },
  });
  assert.equal(design.genes.length, 7);
  assert.equal(design.genes[0].role, 'seed');
  assert.equal(design.genes[0].nearestId, null);
  for (const gene of design.genes.slice(1)) {
    assert.ok(design.selected.includes(gene.nearestId));
    assert.ok(gene.nearestDistance > 0);
    assert.ok(gene.expands.length > 0, `${gene.id} should reach somewhere new`);
    assert.ok(gene.satisfies.length > 0);
    for (const entry of gene.expands) {
      assert.ok(space.keys.includes(entry.key));
      assert.ok(entry.percentile >= 0 && entry.percentile <= 1);
    }
  }
});

test('coverage grows from the seeds to the finished panel', async () => {
  const { dataset, registry, space } = await context();
  const design = designPanel({
    dataset,
    registry,
    space,
    config: { size: 9, seeds: [dataset.genes[2].id, dataset.genes[5].id] },
  });
  assert.equal(design.coverageBefore.members, 2);
  assert.equal(design.coverageAfter.members, 9);
  assert.ok(design.coverageAfter.filledBins > design.coverageBefore.filledBins);
  assert.ok(design.coverageAfter.binFraction > design.coverageBefore.binFraction);
  assert.equal(design.coverageAfter.totalBins, space.dims * 5);
});

test('a gene named that this dataset does not have is reported, not guessed at', async () => {
  const { dataset, registry, space } = await context();
  const design = designPanel({
    dataset, registry, space, config: { size: 6, seeds: ['NOT_A_GENE'] },
  });
  assert.match(design.problems.join(' '), /NOT_A_GENE is not in this dataset/);
  assert.equal(design.selected.length, 6);
});

test('a scheme-dependent metric cannot be a hard constraint', async () => {
  const { registry } = await context();
  const live = registry.metrics.find((metric) => metric.source === 'live');
  assert.ok(live, 'the registry should carry the browser-computed metrics');
  const resolved = resolveConstraints({
    registry,
    config: normaliseConfig({ ranges: { [live.key]: { min: 1 } } }),
  });
  assert.equal(resolved.active.some((entry) => entry.key === live.key), false);
  const blocked = resolved.blocked.find((entry) => entry.id === `range:${live.key}`);
  assert.ok(blocked);
  assert.match(blocked.reason, /changes with the recoding scheme/);
});

test('a published metric this dataset does not have is reported, not assumed', async () => {
  const { registry } = await context();
  const resolved = resolveConstraints({
    registry, config: normaliseConfig({ ranges: { notAMetric: { min: 1 } } }),
  });
  assert.equal(resolved.active.length, 2, 'only the two default flags stay active');
  assert.match(resolved.blocked[0].reason, /not in this dataset/);
});
