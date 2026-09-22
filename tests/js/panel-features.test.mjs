/**
 * The feature space must not let units, or unknowns, choose the panel.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLiveMetrics } from '../../site/js/core/live-metrics.js';
import { compileScheme } from '../../site/js/core/scheme.js';
import { buildMetricRegistry } from '../../site/js/core/metric-registry.js';
import {
  buildPanelSpace, featureDistance, distanceFromCentre, presentFeatureCount, coverageOf,
  binOf, schemeFeatureKey, parseSchemeFeatureKey, isBorrowedMetric, COVERAGE_BINS,
  DEFAULT_BASELINE_FEATURES, defaultBaselineFeatures,
} from '../../site/js/core/panel-features.js';
import { expressionFixtureDataset } from './helpers.mjs';

const SYN61 = { TCG: 'AGC', TCA: 'AGT', TAG: 'TAA' };

let cached = null;
async function context() {
  if (cached) return cached;
  const dataset = await expressionFixtureDataset();
  const live = computeLiveMetrics(dataset, compileScheme({}, dataset.table)).fields;
  const registry = buildMetricRegistry(dataset.meta, dataset.genes, live);
  cached = { dataset, registry };
  return cached;
}

/** A space built by hand, so a distance has a value that can be worked out. */
function syntheticSpace(rows, keys = rows[0].map((_, i) => `f${i}`)) {
  const dims = keys.length;
  const scaled = Float64Array.from(rows.flat());
  return {
    keys,
    labels: keys,
    metrics: keys.map(() => null),
    dims,
    count: rows.length,
    scaled,
    raw: scaled,
    dropped: [],
    borrowed: [],
  };
}

test('a feature key names its scheme and survives a round trip', () => {
  const key = schemeFeatureKey('scheme:TAG-TAA', 'targetFraction');
  assert.deepEqual(parseSchemeFeatureKey(key), {
    schemeId: 'scheme:TAG-TAA', metricKey: 'targetFraction',
  });
  assert.equal(parseSchemeFeatureKey('cai'), null);
});

test('distance is Euclidean when nothing is missing', () => {
  const space = syntheticSpace([[0, 0], [3 / Math.sqrt(2), 4 / Math.sqrt(2)]]);
  // With every feature present the rescaling factor is one, so this is the 3-4-5
  // triangle scaled by 1/sqrt(2) on each leg: sqrt(9/2 + 16/2).
  assert.ok(Math.abs(featureDistance(space, 0, 1) - Math.sqrt(12.5)) < 1e-12);
});

test('a missing feature is skipped, not replaced by a number', () => {
  const present = syntheticSpace([[0, 0], [1, 1]]);
  const missing = syntheticSpace([[0, NaN], [1, 1]]);
  // Both genes differ by 1 on the one shared feature; rescaling to the full
  // width of the space gives the same distance as differing by 1 on both.
  assert.ok(Math.abs(featureDistance(missing, 0, 1) - Math.sqrt(2)) < 1e-12);
  assert.ok(Math.abs(featureDistance(present, 0, 1) - Math.sqrt(2)) < 1e-12);
  // A zero would have made the pair look 1 apart on that axis, which it is not.
  assert.notEqual(featureDistance(missing, 0, 1), 1);
});

test('two genes sharing no feature are not claimed to be different', () => {
  const space = syntheticSpace([[0, NaN], [NaN, 1]]);
  assert.equal(featureDistance(space, 0, 1), 0);
});

test('distance from the centre ignores missing features too', () => {
  const space = syntheticSpace([[1, 1], [1, NaN], [0.5, 0.5]]);
  assert.ok(Math.abs(distanceFromCentre(space, 0) - Math.sqrt(0.5)) < 1e-12);
  assert.ok(Math.abs(distanceFromCentre(space, 1) - Math.sqrt(0.5)) < 1e-12);
  assert.equal(distanceFromCentre(space, 2), 0);
  assert.equal(presentFeatureCount(space, 1), 1);
});

test('bins split the percentile range and a missing value has no bin', () => {
  assert.equal(binOf(0), 0);
  assert.equal(binOf(0.19), 0);
  assert.equal(binOf(0.2), 1);
  assert.equal(binOf(1), COVERAGE_BINS - 1);
  assert.equal(binOf(NaN), -1);
});

test('coverage counts occupied bins, spread, and the maximin distance', () => {
  const space = syntheticSpace([[0.05, 0.5], [0.45, 0.5], [0.95, NaN]]);
  const coverage = coverageOf(space, [0, 1, 2]);
  assert.equal(coverage.members, 3);
  assert.deepEqual(coverage.perFeature[0].bins, [0, 2, 4]);
  assert.equal(coverage.perFeature[1].missing, 1);
  assert.ok(Math.abs(coverage.perFeature[0].spread - 0.9) < 1e-12);
  assert.equal(coverage.totalBins, 2 * COVERAGE_BINS);
  assert.equal(coverage.filledBins, 3 + 1);
  assert.ok(coverage.minPairDistance > 0);
  assert.ok(coverage.meanPairDistance >= coverage.minPairDistance);
});

test('the space is percentile-scaled, so a unit change cannot move a gene', async () => {
  const { dataset, registry } = await context();
  const base = buildPanelSpace({ dataset, registry, baselineFeatures: ['cai', 'lengthCodons'] });

  // The same data with one feature in different units and shifted: a strictly
  // increasing transform, which percentiles are invariant to.
  const rescaled = {
    metrics: registry.metrics,
    byKey: new Map(registry.byKey),
  };
  const original = registry.byKey.get('lengthCodons');
  rescaled.byKey.set('lengthCodons', {
    ...original,
    read: (index) => original.read(index) * 3 + 1000,
  });
  const moved = buildPanelSpace({
    dataset, registry: rescaled, baselineFeatures: ['cai', 'lengthCodons'],
  });
  assert.deepEqual([...moved.scaled], [...base.scaled]);
});

test('a feature no gene has, or every gene shares, is dropped and explained', async () => {
  const { dataset, registry } = await context();
  const constant = {
    metrics: registry.metrics,
    byKey: new Map(registry.byKey),
  };
  constant.byKey.set('cai', { ...registry.byKey.get('cai'), read: () => 0.5 });
  constant.byKey.set('tai', { ...registry.byKey.get('tai'), read: () => NaN });
  const space = buildPanelSpace({
    dataset, registry: constant, baselineFeatures: ['cai', 'tai', 'gc3', 'notAMetric'],
  });
  assert.deepEqual(space.keys, ['gc3']);
  const reasons = Object.fromEntries(space.dropped.map((entry) => [entry.key, entry.reason]));
  assert.match(reasons.cai, /same value/);
  assert.match(reasons.tai, /no gene has a value/);
  assert.match(reasons.notAMetric, /not in this dataset/);
});

test('a borrowed measurement stays out of the space until it is switched on', async () => {
  const { dataset, registry } = await context();
  const expression = registry.metrics.find((metric) => isBorrowedMetric(metric));
  assert.ok(expression, 'the expression fixture should carry a borrowed measurement');

  const withheld = buildPanelSpace({
    dataset, registry, baselineFeatures: ['cai', expression.key],
  });
  assert.deepEqual(withheld.keys, ['cai']);
  assert.match(
    withheld.dropped.find((entry) => entry.key === expression.key).reason,
    /measured in another organism/,
  );

  const allowed = buildPanelSpace({
    dataset, registry, baselineFeatures: ['cai', expression.key], allowBorrowed: true,
  });
  assert.deepEqual(allowed.keys, ['cai', expression.key]);
  assert.deepEqual(allowed.borrowed, [expression.key]);
});

test('the default space adds one borrowed-source representative only after opt-in', async () => {
  const { dataset, registry } = await context();
  const withheld = buildPanelSpace({ dataset, registry });
  const allowed = buildPanelSpace({ dataset, registry, allowBorrowed: true });

  assert.ok(!withheld.keys.includes('expression'));
  assert.ok(!withheld.keys.includes('expressionPercentile'));
  assert.ok(allowed.keys.includes('expression'));
  assert.ok(!allowed.keys.includes('expressionPercentile'));
  assert.deepEqual(allowed.borrowed, ['expression']);
});

test('the baseline feature order puts the codon-usage conventions last', async () => {
  const { registry } = await context();
  assert.deepEqual(DEFAULT_BASELINE_FEATURES.slice(-2), ['cai', 'tai']);
  assert.equal(defaultBaselineFeatures(registry).at(-1), 'tai');
  // An opted-in measurement leads the list, ahead of both conventions.
  const allowed = defaultBaselineFeatures(registry, true);
  assert.equal(allowed[0], 'expression');
  assert.ok(allowed.indexOf('expression') < allowed.indexOf('cai'));
  assert.deepEqual([...allowed].sort(), [...DEFAULT_BASELINE_FEATURES, 'expression'].sort());
});

test('feature order does not change the space, only what is listed first', async () => {
  const { dataset, registry } = await context();
  const declared = buildPanelSpace({ dataset, registry });
  const reversed = buildPanelSpace({
    dataset, registry, baselineFeatures: [...DEFAULT_BASELINE_FEATURES].reverse(),
  });

  assert.deepEqual([...declared.keys].sort(), [...reversed.keys].sort());
  assert.equal(declared.dims, reversed.dims);
  for (const key of declared.keys) {
    const here = declared.keys.indexOf(key);
    const there = reversed.keys.indexOf(key);
    for (let row = 0; row < declared.count; row += 1) {
      const left = declared.scaled[row * declared.dims + here];
      const right = reversed.scaled[row * reversed.dims + there];
      assert.ok(Object.is(left, right), `${key} row ${row} changed with feature order`);
    }
  }
});

test('each selected scheme contributes its own per-scheme features', async () => {
  const { dataset, registry } = await context();
  const compiled = compileScheme(SYN61, dataset.table);
  const fields = computeLiveMetrics(dataset, compiled, { baseline: dataset.baseline }).fields;
  const schemes = [{ schemeId: 'scheme:syn61', name: 'Syn61-style', map: SYN61 }];
  const space = buildPanelSpace({
    dataset,
    registry,
    baselineFeatures: ['cai'],
    schemes,
    schemeFields: new Map([['scheme:syn61', fields]]),
    schemeFeatures: ['targetFraction', 'dCai'],
  });
  assert.deepEqual(space.keys, [
    'cai', 'scheme:syn61::targetFraction', 'scheme:syn61::dCai',
  ]);
  assert.match(space.labels[1], /Syn61-style/);
  for (let i = 0; i < space.count; i += 1) {
    const percentile = space.scaled[i * space.dims + 1];
    assert.ok(percentile >= 0 && percentile <= 1);
  }
});

test('the wild type contributes no per-scheme features, because it changes nothing', async () => {
  const { dataset, registry } = await context();
  const fields = computeLiveMetrics(
    dataset, compileScheme({}, dataset.table), { baseline: dataset.baseline },
  ).fields;
  const space = buildPanelSpace({
    dataset,
    registry,
    baselineFeatures: ['cai'],
    schemes: [{ schemeId: 'wild-type', name: null, map: {} }],
    schemeFields: new Map([['wild-type', fields]]),
    schemeFeatures: ['targetFraction', 'dCai'],
  });
  assert.deepEqual(space.keys, ['cai']);
  assert.equal(space.dropped.length, 2);
  for (const entry of space.dropped) assert.match(entry.reason, /same value/);
});

test('a measured expression metric with no declared source counts as borrowed', async () => {
  const { dataset, registry } = await context();
  // A dataset that publishes an expression field but no provenance for it: the
  // contract forbids assuming which dataset supplied a value, so the safe read
  // is "not this organism's own" rather than "this genome's own".
  const undeclared = { metrics: registry.metrics, byKey: new Map(registry.byKey) };
  const expression = registry.metrics.find((metric) => isBorrowedMetric(metric));
  undeclared.byKey.set(expression.key, { ...expression, provenance: null });
  assert.equal(isBorrowedMetric(undeclared.byKey.get(expression.key)), true);

  const space = buildPanelSpace({
    dataset, registry: undeclared, baselineFeatures: ['cai', expression.key],
  });
  assert.deepEqual(space.keys, ['cai']);

  // The proxy is this genome's own rank, so it is never treated as borrowed.
  const proxy = registry.metrics.find((metric) => /proxy/i.test(metric.key));
  assert.ok(proxy, 'the fixture should publish the expression proxy');
  assert.equal(isBorrowedMetric(proxy), false);
  assert.equal(isBorrowedMetric(registry.byKey.get('cai')), false);
  assert.equal(isBorrowedMetric(null), false);
});

test('the space follows whatever metrics the dataset declares', async () => {
  const { dataset, registry } = await context();
  // A pipeline that adds a metric needs no change here: naming it is enough.
  const added = { metrics: registry.metrics, byKey: new Map(registry.byKey) };
  const source = registry.byKey.get('gc3');
  added.byKey.set('tssInitiation', {
    ...source, key: 'tssInitiation', label: 'TSS initiation', provenance: undefined,
  });
  const space = buildPanelSpace({
    dataset, registry: added, baselineFeatures: ['cai', 'tssInitiation'],
  });
  assert.deepEqual(space.keys, ['cai', 'tssInitiation']);
  assert.equal(space.dropped.length, 0);
});
