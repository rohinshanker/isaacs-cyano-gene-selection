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
import { orderMetricFamilies, buildMetricRegistry } from '../../site/js/core/metric-registry.js';
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
