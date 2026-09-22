/**
 * Family display order for grouped selectors (colour-by, the compare axis
 * picker, the gene-detail metric groups): expression evidence must group
 * ahead of "Translation" (CAI/tAI), the same priority individual metrics get
 * from `orderTrafficCandidates` and `constrainableMetrics`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  orderMetricFamilies, buildMetricRegistry, orderMeasuredFirst, defaultColorMetricKey,
  measurementLimitClauses, isNativeMeasuredMetric, metricsInDisplayOrder,
} from '../../site/js/core/metric-registry.js';
import { loadDataset } from '../../site/js/core/dataset.js';
import { fileFetch } from './helpers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_DATA_DIR = resolve(HERE, '../../site/data');

test('Expression moves ahead of Translation when it would otherwise trail', () => {
  const families = ['Base composition', 'Codon usage', 'Translation', 'Rare codons', 'Expression'];
  assert.deepEqual(
    orderMetricFamilies(families),
    ['Base composition', 'Codon usage', 'Expression', 'Translation', 'Rare codons'],
  );
});

test('families with no Translation group are left exactly as declared', () => {
  const families = ['Base composition', 'Size', 'Expression'];
  assert.deepEqual(orderMetricFamilies(families), families);
});

test('families with no Expression group are left exactly as declared', () => {
  const families = ['Base composition', 'Translation', 'Size'];
  assert.deepEqual(orderMetricFamilies(families), families);
});

test('Expression already ahead of Translation is left in place', () => {
  const families = ['Expression', 'Base composition', 'Translation'];
  assert.deepEqual(orderMetricFamilies(families), families);
});

test('the production registry groups Expression ahead of Translation for colour-by and friends', async () => {
  const dataset = await loadDataset({ baseUrl: `file://${SITE_DATA_DIR}/`, fetchImpl: fileFetch() });
  const registry = buildMetricRegistry(dataset.meta, dataset.genes, dataset.baseline);
  const expressionAt = registry.families.indexOf('Expression');
  const translationAt = registry.families.indexOf('Translation');
  assert.notEqual(expressionAt, -1, 'fixture should declare an Expression family');
  assert.notEqual(translationAt, -1, 'fixture should declare a Translation family');
  assert.ok(expressionAt < translationAt, 'Expression should list before Translation');
});

test('a family holding a native measurement leads the whole list', () => {
  const families = ['Base composition', 'Translation', 'Expression', 'Size'];
  assert.deepEqual(
    orderMetricFamilies(families, ['Expression']),
    ['Expression', 'Base composition', 'Translation', 'Size'],
  );
});

test('promoted families keep their order relative to each other', () => {
  const families = ['Base composition', 'Native assays', 'Translation', 'Expression'];
  assert.deepEqual(
    orderMetricFamilies(families, ['Expression', 'Native assays']),
    ['Native assays', 'Expression', 'Base composition', 'Translation'],
  );
});

test('an unpromoted family list is untouched and the input array is not mutated', () => {
  const families = ['Base composition', 'Translation', 'Size'];
  assert.deepEqual(orderMetricFamilies(families, ['Expression']), families);
  assert.deepEqual(families, ['Base composition', 'Translation', 'Size']);
});

const measurement = (key, isTargetOrganism) => ({
  key, label: key, unit: 'counts', family: 'Expression',
  provenance: { organism: 'x', isTargetOrganism },
});
const convention = (key) => ({ key, label: key, unit: 'index', family: 'Translation' });

test('measured metrics sort ahead of conventions, native ahead of borrowed', () => {
  const cai = convention('cai');
  const tai = convention('tai');
  const native = measurement('tssInitiation', true);
  const borrowed = measurement('expression', false);
  const order = orderMeasuredFirst([cai, borrowed, tai, native]).map((metric) => metric.key);

  assert.deepEqual(order, ['tssInitiation', 'expression', 'cai', 'tai']);
  assert.equal(isNativeMeasuredMetric(native), true);
  assert.equal(isNativeMeasuredMetric(borrowed), false);
  assert.equal(isNativeMeasuredMetric(cai), false);
});

test('a measurement states its condition and coverage limits; a convention has none', () => {
  const native = measurement('tssInitiation', true);
  native.provenance.condition = 'control, dark, high light, high temperature';
  native.provenance.coverage = { withValue: 1727, total: 2715 };
  assert.deepEqual(
    measurementLimitClauses(native, (value) => value.toLocaleString('en-US')),
    ['condition: control, dark, high light, high temperature',
      '1,727 of 2,715 genes have a value'],
  );
  assert.deepEqual(measurementLimitClauses(convention('cai')), []);
  assert.deepEqual(measurementLimitClauses(null), []);
});

test('the fresh-view colour is GC3, never a convention, and never an unbounded count', () => {
  const counts = measurement('tssInitiation', true);
  const gc3 = { key: 'gc3', label: 'GC3', unit: 'fraction', family: 'Base composition' };
  const registry = (metrics) => ({
    metrics, byKey: new Map(metrics.map((metric) => [metric.key, metric])),
  });

  // A heavy-tailed count would put nine genes in ten in one ramp bucket.
  assert.equal(defaultColorMetricKey(registry([gc3, counts])), 'gc3');
  assert.equal(defaultColorMetricKey(registry([gc3, convention('cai')])), 'gc3');
  // A bounded native measurement is a usable ramp, so it does lead.
  const rank = measurement('futureNativePercentile', true);
  rank.unit = 'fraction';
  assert.equal(defaultColorMetricKey(registry([gc3, rank])), 'futureNativePercentile');
  // Only a dataset with nothing else falls back to whatever it publishes.
  assert.equal(defaultColorMetricKey(registry([convention('cai')])), 'cai');
});

test('the production registry leads with measured UTEX evidence, before Translation', async () => {
  const dataset = await loadDataset({ baseUrl: `file://${SITE_DATA_DIR}/`, fetchImpl: fileFetch() });
  const registry = buildMetricRegistry(dataset.meta, dataset.genes, dataset.baseline);

  assert.equal(registry.families[0], 'Expression');
  assert.ok(registry.families.indexOf('Expression') < registry.families.indexOf('Translation'));
  const expression = orderMeasuredFirst(
    registry.metrics.filter((metric) => metric.family === 'Expression'),
  ).map((metric) => metric.key);
  assert.deepEqual(expression, ['tssInitiation', 'expression']);
  assert.equal(defaultColorMetricKey(registry), 'gc3');
});

test('the whole-registry display order leads with measurements and keeps every metric', async () => {
  const dataset = await loadDataset({ baseUrl: `file://${SITE_DATA_DIR}/`, fetchImpl: fileFetch() });
  const registry = buildMetricRegistry(dataset.meta, dataset.genes, dataset.baseline);
  const order = metricsInDisplayOrder(registry).map((metric) => metric.key);

  assert.deepEqual(order.slice(0, 2), ['tssInitiation', 'expression']);
  assert.ok(order.indexOf('tssInitiation') < order.indexOf('cai'));
  assert.ok(order.indexOf('expression') < order.indexOf('tai'));
  // Nothing is dropped or shown twice: this replaces `registry.metrics` in
  // tables that list every metric.
  assert.equal(order.length, registry.metrics.length);
  assert.equal(new Set(order).size, registry.metrics.length);
});
