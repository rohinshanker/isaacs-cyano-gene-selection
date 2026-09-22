/**
 * The comparison model, and above all the rule the lab named: a missing value
 * must never be drawn where a typical value would be.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  robustScale, zScore, seriesStyle, SERIES_STYLES, defaultAxes, axisUnavailableReason,
  presentRuns, countMissing, missingRanks, wrapLabel, describeMissing, pluralise,
  describeMissingSentence, describeDroppedAxes, Z_LIMIT, MIN_AXES, DEFAULT_AXES,
  measurementLimitNote,
} from '../../site/js/ui/compare-model.js';
import { CATEGORICAL } from '../../site/js/ui/colors.js';
import { readFileSync } from 'node:fs';
import { buildMetricRegistry } from '../../site/js/core/metric-registry.js';
import { LIVE_METRICS } from '../../site/js/core/live-metrics.js';

test('a missing value has no z-score, so it cannot land on the median ring', () => {
  const scale = robustScale([1, 2, 3, 4, 5]);
  assert.ok(Number.isFinite(zScore(3, scale)));
  // The median itself scores zero, which is exactly the position a missing value
  // must never take. Every flavour of absent stays NaN.
  assert.equal(zScore(3, scale), 0);
  for (const absent of [NaN, null, undefined, Infinity, -Infinity]) {
    assert.ok(Number.isNaN(zScore(absent, scale)), `${absent} produced a position`);
  }
});

test('a scale built from nothing yields no positions at all', () => {
  const scale = robustScale([NaN, NaN]);
  assert.equal(scale.finiteCount, 0);
  assert.ok(Number.isNaN(zScore(1, scale)));
});

test('z-scores clamp to the drawn range without becoming missing', () => {
  const scale = robustScale([1, 2, 3, 4, 5]);
  assert.equal(zScore(1e9, scale), Z_LIMIT);
  assert.equal(zScore(-1e9, scale), -Z_LIMIT);
});

test('spread survives outliers and a constant column', () => {
  const withOutlier = robustScale([1, 1, 1, 1, 1000]);
  assert.equal(withOutlier.median, 1);
  assert.ok(withOutlier.spread > 0);
  const constant = robustScale([7, 7, 7]);
  assert.equal(constant.constant, true);
  assert.ok(Number.isFinite(zScore(7, constant)));
});

test('ten candidates each get a distinct colour, dash, and marker', () => {
  const styles = Array.from({ length: 10 }, (_, i) => seriesStyle(i));
  assert.equal(new Set(styles.map((s) => s.color)).size, 10);
  assert.equal(new Set(styles.map((s) => s.dash.join(','))).size, 10);
  assert.equal(new Set(styles.map((s) => s.marker)).size, 10);
  // Combined identity, which is what the reader actually traces.
  const combined = styles.map((s) => `${s.color}|${s.dash.join(',')}|${s.marker}`);
  assert.equal(new Set(combined).size, 10);
  for (const style of styles) assert.equal(style.repeated, false);
});

test('the palette carries at least ten colour-blind-safe entries', () => {
  assert.ok(CATEGORICAL.length >= 10);
  assert.equal(new Set(CATEGORICAL).size, CATEGORICAL.length);
  assert.equal(SERIES_STYLES.length, CATEGORICAL.length);
});

test('an eleventh candidate is flagged as reusing a style rather than passed off as new', () => {
  const eleventh = seriesStyle(SERIES_STYLES.length);
  assert.equal(eleventh.repeated, true);
  assert.equal(eleventh.color, SERIES_STYLES[0].color);
});

test('a constant axis is dropped from the defaults and says why', () => {
  const metrics = [
    { key: 'gc3', label: 'GC3' }, { key: 'enc', label: 'ENC' },
    { key: 'cai', label: 'CAI' }, { key: 'tai', label: 'tAI' },
    { key: 'targetFraction', label: 'Target fraction' },
  ];
  const registry = { metrics, byKey: new Map(metrics.map((m) => [m.key, m])) };
  const scaleFor = (metric) => (metric.key === 'targetFraction'
    ? robustScale([0, 0, 0, 0])
    : robustScale([1, 2, 3, 4]));
  const { axes, dropped } = defaultAxes(registry, scaleFor);
  assert.ok(!axes.some((metric) => metric.key === 'targetFraction'));
  assert.equal(dropped.length, 1);
  assert.match(dropped[0].reason, /Target fraction/);
  assert.match(dropped[0].reason, /nothing to compare/);
  assert.ok(axes.length >= MIN_AXES);
});

test('an axis with no values at all is named as unavailable, not silently empty', () => {
  const reason = axisUnavailableReason({ label: 'Start-region MFE' }, robustScale([NaN]));
  assert.match(reason, /no gene has a value/);
  assert.equal(axisUnavailableReason({ label: 'GC3' }, robustScale([1, 2, 3])), null);
});

test('the default axis list is the documented one, measured evidence first', () => {
  assert.ok(DEFAULT_AXES.includes('gc3'));
  assert.ok(DEFAULT_AXES.includes('targetFraction'));
  assert.equal(DEFAULT_AXES[0], 'tssInitiation');
  // CAI and tAI stay available, below every other default axis.
  assert.deepEqual(DEFAULT_AXES.slice(-2), ['cai', 'tai']);
  assert.ok(DEFAULT_AXES.indexOf('tssInitiation') < DEFAULT_AXES.indexOf('cai'));
  // A borrowed measurement is never an implicit default axis.
  assert.ok(!DEFAULT_AXES.includes('expression'));
  assert.ok(!DEFAULT_AXES.includes('expressionPercentile'));
});

test('a gap in the data becomes a gap in the line', () => {
  assert.deepEqual(presentRuns([true, true, true]), [[0, 1, 2]]);
  assert.deepEqual(presentRuns([true, false, true]), [[0], [2]]);
  assert.deepEqual(presentRuns([false, true, true, false, true]), [[1, 2], [4]]);
  assert.deepEqual(presentRuns([false, false]), []);
});

test('a closed shape joins its wrapping run only when both ends are present', () => {
  // One missing axis leaves the polygon open rather than bridging the gap.
  assert.deepEqual(presentRuns([true, false, true, true], { closed: true }), [[2, 3, 0]]);
  // Fully present stays a single run the caller closes.
  assert.deepEqual(presentRuns([true, true, true], { closed: true }), [[0, 1, 2]]);
  // A break at the wrap point keeps two separate runs.
  assert.deepEqual(presentRuns([false, true, true, false], { closed: true }), [[1, 2]]);
});

test('missing values are counted per series, per axis, and in total', () => {
  const axes = [{ key: 'a' }, { key: 'b' }];
  const series = [{ id: 'g1', index: 0 }, { id: 'g2', index: 1 }];
  const values = { a: [1, NaN], b: [NaN, NaN] };
  const missing = countMissing(series, axes, (metric, index) => values[metric.key][index]);
  assert.equal(missing.total, 3);
  assert.equal(missing.bySeries.get('g1'), 1);
  assert.equal(missing.bySeries.get('g2'), 2);
  assert.equal(missing.byAxis.get('b'), 2);
});

test('candidates missing the same axis are ranked so their marks do not stack', () => {
  const axes = [{ key: 'mfeStart' }, { key: 'gc3' }];
  const series = [{ id: 'g1', index: 0 }, { id: 'g2', index: 1 }, { id: 'g3', index: 2 }];
  const values = { mfeStart: [NaN, 1.5, NaN], gc3: [0.5, 0.6, 0.7] };
  const ranks = missingRanks(series, axes, (metric, index) => values[metric.key][index]);
  const onMfe = ranks.get('mfeStart');
  // Two genes lack this metric, so they take distinct places and each knows the total.
  assert.equal(onMfe.size, 2);
  assert.deepEqual(onMfe.get('g1'), { rank: 0, total: 2 });
  assert.deepEqual(onMfe.get('g3'), { rank: 1, total: 2 });
  assert.equal(onMfe.get('g2'), undefined);
  // An axis every gene has produces no marks at all.
  assert.equal(ranks.get('gc3').size, 0);
});

test('counts read with the right singular or plural', () => {
  assert.equal(pluralise(1, 'shortlisted gene'), '1 shortlisted gene');
  assert.equal(pluralise(10, 'shortlisted gene'), '10 shortlisted genes');
  assert.equal(pluralise(0, 'metric'), '0 metrics');
  assert.equal(pluralise(1, 'match', 'matches'), '1 match');
  assert.equal(pluralise(3, 'match', 'matches'), '3 matches');
});

test('a long axis name wraps rather than being truncated', () => {
  const measure = (text) => text.length * 6;
  const lines = wrapLabel('Start-region MFE', 60, measure);
  assert.deepEqual(lines, ['Start-region', 'MFE']);
  for (const line of lines) assert.ok(!line.includes('…'));
  assert.equal(wrapLabel('GC3', 60, measure).length, 1);
  // A single unbreakable word is kept whole; the caller widens the chart instead.
  assert.deepEqual(wrapLabel('Supercalifragilistic', 20, measure), ['Supercalifragilistic']);
});

test('the missing count reads as plain language', () => {
  assert.equal(describeMissing(0), 'no missing values');
  assert.equal(describeMissing(1), '1 missing value');
  assert.equal(describeMissing(4), '4 missing values');
});

test('a missing count becomes a capitalized, punctuated chart sentence', () => {
  assert.equal(describeMissingSentence(0), 'No missing values.');
  assert.equal(describeMissingSentence(1), '1 missing value.');
  assert.equal(describeMissingSentence(4), '4 missing values.');
});

test('dropped-axis guidance separates its lead-in without a double colon', () => {
  assert.equal(describeDroppedAxes([]), '');
  const copy = describeDroppedAxes([
    { reason: 'Target fraction: every gene is 0, so there is nothing to compare.' },
  ]);
  assert.equal(
    copy,
    'Not on the default axes — Target fraction: every gene is 0, so there is nothing to compare. '
      + 'You can still add these under Choose metrics.',
  );
  assert.doesNotMatch(copy, /axes: [^:]+:/);
});

const shippedFile = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const shippedMeta = shippedFile('../../site/data/meta.json');
const shippedGenes = shippedFile('../../site/data/genes.json');
const shippedRegistry = buildMetricRegistry(shippedMeta, shippedGenes, Object.fromEntries(
  LIVE_METRICS.map((metric) => [metric.key, new Float64Array(shippedGenes.length)]),
));
const shippedDataset = { meta: shippedMeta, genes: shippedGenes };

test('a promoted measurement states its replicate depth and coverage in the comparison', () => {
  const tss = shippedRegistry.byKey.get('tssInitiation');
  const note = measurementLimitNote([tss], shippedDataset);

  assert.match(note, /^Measurement limits —/);
  assert.match(note, /TSS initiation \(UTEX 2973\)/);
  assert.match(note, /2 replicates per condition across 4 conditions/);
  assert.match(note, /1,727 of 2,715 genes have a value/);
});

test('every measurement on display is covered once, and conventions add nothing', () => {
  const metrics = ['tssInitiation', 'cai', 'tai', 'expression', 'tssInitiation']
    .map((key) => shippedRegistry.byKey.get(key));
  const note = measurementLimitNote(metrics, shippedDataset);

  assert.equal(note.match(/TSS initiation \(UTEX 2973\):/g).length, 1, 'no repeats');
  assert.match(note, /Expression \(PCC 7942\): WT, fresh BG-11, day 1, mean of 3 replicates/);
  // A percentile derived from the same study does not repeat that study's limits.
  const withPercentile = measurementLimitNote(
    ['expression', 'expressionPercentile'].map((key) => shippedRegistry.byKey.get(key)),
    shippedDataset,
  );
  assert.equal(withPercentile.match(/mean of 3 replicates/g).length, 1);
  assert.doesNotMatch(withPercentile, /Expression percentile/);
  assert.doesNotMatch(note, /CAI:/);
  assert.doesNotMatch(note, /tAI:/);
  // A comparison of derived indices alone has no measurement to qualify.
  assert.equal(
    measurementLimitNote(['cai', 'gc3'].map((key) => shippedRegistry.byKey.get(key)),
      shippedDataset),
    null,
  );
  assert.equal(measurementLimitNote([], shippedDataset), null);
});

test('the default comparison axes always come with a measurement note', () => {
  const { axes } = defaultAxes(shippedRegistry, (metric) => {
    const values = shippedGenes.map((gene) => gene[metric.key]);
    return robustScale(values);
  });
  assert.equal(axes[0].key, 'tssInitiation');
  assert.ok(measurementLimitNote(axes, shippedDataset));
});
