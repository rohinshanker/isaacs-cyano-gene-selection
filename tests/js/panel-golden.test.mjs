/**
 * The golden case: a real ten-gene panel, against the baselines it has to beat.
 *
 * A space-filling objective is easy to claim and easy to get wrong, so this runs
 * the real dataset and compares the design with the three things a sceptical
 * reader would reach for instead: drawing genes at random, the same greedy rule
 * applied to raw units with no scaling, and plain maximin with no stratification.
 * Every baseline is reproduced by this test rather than quoted from a past run.
 *
 * That third baseline is why the objective has a stratification rule at all.
 * Plain maximin fills the extremes of every feature and skips the middle, and on
 * this dataset it covers fewer quantile bins than an average random draw.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadDataset } from '../../site/js/core/dataset.js';
import { computeLiveMetrics } from '../../site/js/core/live-metrics.js';
import { compileScheme } from '../../site/js/core/scheme.js';
import { buildMetricRegistry, expressionBasisOf } from '../../site/js/core/metric-registry.js';
import { buildPanelSpace, coverageOf, featureDistance } from '../../site/js/core/panel-features.js';
import {
  designPanel, eligibleGenes, resolveConstraints, normaliseConfig,
} from '../../site/js/core/panel-design.js';
import { describeSchemes } from '../../site/js/core/panel-export.js';
import { fileFetch } from './helpers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, '../../site/data');

/** The Syn61-style scheme, the one the lab's design question is usually about. */
const SYN61 = { TCG: 'AGC', TCA: 'AGT', TAG: 'TAA' };

/** The seed set a bench scientist brings: genes already committed to the run. */
const SEEDS = ['M744_RS00005', 'M744_RS05000'];

const PANEL_SIZE = 10;

/**
 * The exact panel this configuration produced before CAI and tAI were moved to
 * the end of the default feature list, pinned so a reordering can never pass as
 * "still deterministic" while quietly choosing different genes. The feature
 * space is percentile-scaled and weighted equally, so order is presentation;
 * this is the assertion that says so.
 */
const PRE_PATCH_SELECTION = Object.freeze([
  'M744_RS00005', 'M744_RS05000', 'M744_RS08940', 'M744_RS04425', 'M744_RS11260',
  'M744_RS04990', 'M744_RS00880', 'M744_RS13875', 'M744_RS14230', 'M744_RS13830',
]);

/** The baseline feature order shipped before that change. */
const PRE_PATCH_FEATURES = Object.freeze([
  'cai', 'tai', 'gc3', 'enc', 'rareFraction', 'cps', 'mfeStart', 'lengthCodons',
  'neighborUpstreamNt',
]);
const RANDOM_DRAWS = 400;
const RANDOM_SEED = 20260918;

let cached = null;
async function realContext() {
  if (cached) return cached;
  const dataset = await loadDataset({ baseUrl: `file://${DATA_DIR}/`, fetchImpl: fileFetch() });
  cached = contextFor(dataset);
  return cached;
}

/** The registry and feature space built from one dataset, exactly as the app does. */
function contextFor(dataset) {
  const live = computeLiveMetrics(dataset, compileScheme({}, dataset.table)).fields;
  const registry = buildMetricRegistry(dataset.meta, dataset.genes, live);
  const schemes = describeSchemes([{ name: 'Syn61-style', map: SYN61 }]);
  const schemeFields = new Map(schemes.map((scheme) => [
    scheme.schemeId,
    computeLiveMetrics(
      dataset, compileScheme(scheme.map, dataset.table), { baseline: dataset.baseline },
    ).fields,
  ]));
  const space = buildPanelSpace({ dataset, registry, schemes, schemeFields });
  return { dataset, registry, space, schemes, schemeFields };
}

/** A small deterministic generator, so the random baseline is the same every run. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Baseline one: draw the rest of the panel uniformly from the eligible genes. */
function randomPanels(pool, anchors, size, draws) {
  const random = mulberry32(RANDOM_SEED);
  const panels = [];
  for (let draw = 0; draw < draws; draw += 1) {
    const chosen = [...anchors];
    const available = pool.filter((index) => !chosen.includes(index));
    while (chosen.length < size && available.length > 0) {
      chosen.push(...available.splice(Math.floor(random() * available.length), 1));
    }
    panels.push(chosen);
  }
  return panels;
}

function greedy(pool, anchors, size, score) {
  const chosen = [...anchors];
  const available = pool.filter((index) => !chosen.includes(index));
  while (chosen.length < size && available.length > 0) {
    let best = -1;
    let bestScore = -Infinity;
    for (const candidate of available) {
      const value = score(candidate, chosen);
      if (value > bestScore) {
        bestScore = value;
        best = candidate;
      }
    }
    chosen.push(best);
    available.splice(available.indexOf(best), 1);
  }
  return chosen;
}

/**
 * Baseline two: the same greedy farthest-point rule on raw values with no
 * scaling. This is what picking "the most different genes" looks like when the
 * units are left alone, and it is the trap the percentile scaling exists to avoid.
 */
function naiveFarthestPoint(space, pool, anchors, size) {
  const { raw, dims } = space;
  const distance = (a, b) => {
    let sum = 0;
    let shared = 0;
    for (let c = 0; c < dims; c += 1) {
      const x = raw[a * dims + c];
      const y = raw[b * dims + c];
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      sum += (x - y) * (x - y);
      shared += 1;
    }
    return shared === 0 ? 0 : Math.sqrt((sum * dims) / shared);
  };
  return greedy(pool, anchors, size, (candidate, chosen) => (chosen.length === 0
    ? 0
    : Math.min(...chosen.map((other) => distance(candidate, other)))));
}

/** Baseline three: maximin on the scaled space with the stratification removed. */
function plainMaximin(space, pool, anchors, size) {
  return greedy(pool, anchors, size, (candidate, chosen) => (chosen.length === 0
    ? 0
    : Math.min(...chosen.map((other) => featureDistance(space, candidate, other)))));
}

/** Mean width, in percentile units, that a panel spans on each feature. */
function meanSpread(coverage) {
  const widths = coverage.perFeature.map((entry) => entry.spread).filter(Number.isFinite);
  return widths.reduce((sum, value) => sum + value, 0) / widths.length;
}

test('the golden panel expands the seed set to exactly ten genes', async () => {
  const { dataset, registry, space } = await realContext();
  for (const id of SEEDS) assert.ok(dataset.indexById.has(id), `${id} should exist in the dataset`);

  const design = designPanel({
    dataset, registry, space, config: { size: PANEL_SIZE, seeds: SEEDS },
  });
  assert.equal(design.feasible, true);
  assert.deepEqual(design.problems, []);
  assert.equal(design.selected.length, PANEL_SIZE);
  assert.equal(new Set(design.selected).size, PANEL_SIZE);
  assert.deepEqual(design.selected.slice(0, SEEDS.length), SEEDS);
  assert.deepEqual(
    designPanel({ dataset, registry, space, config: { size: PANEL_SIZE, seeds: SEEDS } }).selected,
    design.selected,
  );
  // Not merely repeatable: the same ten loci this configuration chose before the
  // default feature list was reordered.
  assert.deepEqual(design.selected, PRE_PATCH_SELECTION);
});

test('reordering the default features changes the listing, never the panel', async () => {
  const { dataset, registry, schemes, schemeFields } = await realContext();
  const config = { size: PANEL_SIZE, seeds: SEEDS };
  const spaceFor = (baselineFeatures) => buildPanelSpace({
    dataset, registry, schemes, schemeFields, baselineFeatures,
  });

  for (const features of [PRE_PATCH_FEATURES, [...PRE_PATCH_FEATURES].reverse()]) {
    const design = designPanel({ dataset, registry, space: spaceFor(features), config });
    assert.deepEqual(design.selected, PRE_PATCH_SELECTION,
      `feature order ${features.join(',')} changed the panel`);
  }
});

test('the panel objective ignores the GO IEA essentiality fallback', async () => {
  const { dataset, registry, space } = await realContext();
  assert.ok(dataset.goIeaEssentiality, 'the real dataset loads the GO IEA tiers');
  const config = { size: PANEL_SIZE, seeds: SEEDS };
  const baseline = designPanel({ dataset, registry, space, config }).selected;
  const everyLocusGo = structuredClone(dataset.goIeaEssentiality);
  for (const row of Object.values(everyLocusGo.byLocus)) {
    row.tier = 'go-iea-context';
    row.goContext = { label: 'core-cellular-process', pCore: 1 };
  }
  for (const variant of [null, everyLocusGo]) {
    // Rebuild the registry and feature space from the variant, so a GO-aware
    // metric or feature could not slip past a space built from the real file.
    const changed = contextFor({ ...dataset, goIeaEssentiality: variant });
    assert.deepEqual(designPanel({ ...changed, config }).selected, baseline);
  }
});

test('the golden panel violates no constraint', async () => {
  const { dataset, registry, space } = await realContext();
  const config = normaliseConfig({
    size: PANEL_SIZE,
    seeds: SEEDS,
    ranges: { cai: { min: 0.3 }, lengthCodons: { min: 100, max: 900 } },
  });
  const design = designPanel({ dataset, registry, space, config });
  assert.equal(design.feasible, true);
  assert.equal(design.selected.length, PANEL_SIZE);

  const cai = registry.byKey.get('cai');
  const length = registry.byKey.get('lengthCodons');
  for (const id of design.selected) {
    const index = dataset.indexById.get(id);
    const gene = dataset.genes[index];
    if (SEEDS.includes(id)) continue;
    assert.ok(cai.read(index) >= 0.3, `${id} CAI`);
    assert.ok(length.read(index) >= 100 && length.read(index) <= 900, `${id} length`);
    assert.equal(gene.translationalException ?? null, null, `${id} exception`);
    assert.notEqual(gene.overlapsNeighbor, true, `${id} overlap`);
  }
});

test('the golden panel covers more of the feature space than every baseline', async () => {
  const { dataset, registry, space } = await realContext();
  const config = normaliseConfig({ size: PANEL_SIZE, seeds: SEEDS });
  const constraints = resolveConstraints({ registry, config });
  const { pool } = eligibleGenes({ dataset, constraints: constraints.active, config });
  const anchors = SEEDS.map((id) => dataset.indexById.get(id));
  assert.ok(pool.length > 1000, 'the constrained pool should still be most of the genome');

  const design = designPanel({ dataset, registry, space, config });
  const ours = coverageOf(space, design.indices);

  const random = randomPanels(pool, anchors, PANEL_SIZE, RANDOM_DRAWS)
    .map((panel) => coverageOf(space, panel));
  const bestRandomBins = Math.max(...random.map((entry) => entry.filledBins));
  const bestRandomMinPair = Math.max(...random.map((entry) => entry.minPairDistance));
  const meanRandomBins = random.reduce((sum, entry) => sum + entry.filledBins, 0) / random.length;
  const meanRandomSpread = random.reduce((sum, entry) => sum + meanSpread(entry), 0) / random.length;

  const naive = coverageOf(space, naiveFarthestPoint(space, pool, anchors, PANEL_SIZE));
  const plain = coverageOf(space, plainMaximin(space, pool, anchors, PANEL_SIZE));

  // Quantile-bin coverage, which the objective's first rule serves.
  assert.ok(
    ours.filledBins > bestRandomBins,
    `design ${ours.filledBins} bins against the best of ${RANDOM_DRAWS} random ${bestRandomBins}`,
  );
  assert.ok(
    ours.filledBins > naive.filledBins,
    `design ${ours.filledBins} bins against naive ${naive.filledBins}`,
  );
  assert.equal(ours.filledBins, ours.totalBins, 'every quantile bin of every feature is occupied');

  // Separation, which maximin serves. Holding above the best random draw is what
  // shows the coverage was not bought by bunching genes together.
  assert.ok(
    ours.minPairDistance > bestRandomMinPair,
    `design ${ours.minPairDistance} against the best random ${bestRandomMinPair}`,
  );
  assert.ok(
    ours.minPairDistance > naive.minPairDistance,
    `design ${ours.minPairDistance} against naive ${naive.minPairDistance}`,
  );

  // Range spanned per feature, which neither rule optimizes directly.
  assert.ok(meanSpread(ours) > meanRandomSpread);
  assert.ok(meanSpread(ours) > meanSpread(naive));

  // And the reason the objective is not plain maximin.
  assert.ok(
    ours.filledBins > plain.filledBins,
    `design ${ours.filledBins} bins against plain maximin ${plain.filledBins}`,
  );
  assert.ok(
    plain.filledBins < meanRandomBins,
    'plain maximin should be the weaker coverage this objective exists to fix',
  );
});

test('adding genes to the seeds is what widens the coverage', async () => {
  const { dataset, registry, space } = await realContext();
  const design = designPanel({
    dataset, registry, space, config: { size: PANEL_SIZE, seeds: SEEDS },
  });
  assert.equal(design.coverageBefore.members, SEEDS.length);
  assert.ok(design.coverageAfter.filledBins > design.coverageBefore.filledBins);
  for (const gene of design.genes.slice(SEEDS.length)) {
    assert.ok(gene.expands.length > 0, `${gene.id} should reach a part of the space nothing did`);
    assert.ok(gene.nearestId !== null);
  }
});

test('the golden panel carries no borrowed expression unless it is asked for', async () => {
  const { dataset, registry, space } = await realContext();
  assert.ok(!space.keys.includes('expression'), 'borrowed expression stays out of the space');
  assert.ok(!space.keys.includes('expressionPercentile'));
  assert.equal(space.borrowed.length, 0);

  const withBorrowed = buildPanelSpace({
    dataset,
    registry,
    baselineFeatures: ['cai', 'expression'],
    allowBorrowed: true,
  });
  assert.deepEqual(withBorrowed.borrowed, ['expression']);

  const design = designPanel({
    dataset,
    registry,
    space,
    config: {
      size: PANEL_SIZE,
      seeds: SEEDS,
      requireMeasuredExpression: true,
      allowBorrowedExpression: true,
    },
  });
  for (const id of design.selected) {
    if (SEEDS.includes(id)) continue;
    const gene = dataset.genes[dataset.indexById.get(id)];
    assert.equal(expressionBasisOf(gene).basis, 'measured');
  }
});
