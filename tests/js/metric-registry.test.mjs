import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMetricRegistry, rebindLiveMetrics, metricValues, isExpressionMetric,
  describeExpressionSource, expressionSourceScope,
} from '../../site/js/core/metric-registry.js';
import { LIVE_METRICS } from '../../site/js/core/live-metrics.js';
import { fixtureDataset } from './helpers.mjs';

test('pipeline and live metrics land in one list with families and readers', async () => {
  const dataset = await fixtureDataset();
  const registry = buildMetricRegistry(dataset.meta, dataset.genes, dataset.baseline);
  assert.ok(registry.metrics.length > 30);
  assert.equal(registry.byKey.get('gc3').source, 'pipeline');
  assert.equal(registry.byKey.get('gc3').label, dataset.meta.metrics.gc3.label);
  assert.equal(registry.byKey.get('targetCount').source, 'live');
  assert.equal(registry.byKey.get('targetCount').integer, true);
  assert.equal(registry.byKey.get('gc3').read(4), dataset.genes[4].gc3);
  assert.ok(registry.families.includes('Recoding load'));
  assert.equal(registry.declaredButMissing.length, 0);
  assert.equal(
    registry.metrics.filter((metric) => metric.source === 'live').length,
    LIVE_METRICS.length,
  );
});

test('a metric declared in meta but absent from the genes is reported, not guessed at', async () => {
  const dataset = await fixtureDataset();
  const meta = { ...dataset.meta, metrics: { ...dataset.meta.metrics, ghostMetric: { label: 'Ghost' } } };
  const registry = buildMetricRegistry(meta, dataset.genes, dataset.baseline);
  assert.deepEqual(registry.declaredButMissing, ['ghostMetric']);
  assert.equal(registry.byKey.has('ghostMetric'), false);
});

test('an unfamiliar pipeline metric still gets a family and its declared label', async () => {
  const dataset = await fixtureDataset();
  const genes = dataset.genes.map((gene) => ({ ...gene, novelScore: 1.5 }));
  const meta = {
    ...dataset.meta,
    metrics: { ...dataset.meta.metrics, novelScore: { label: 'Novel score', unit: 'z' } },
  };
  const registry = buildMetricRegistry(meta, genes, dataset.baseline);
  assert.equal(registry.byKey.get('novelScore').family, 'Other');
  assert.equal(registry.byKey.get('novelScore').label, 'Novel score');
});

test('an expression metric is recognised by family, by name, and by unit', () => {
  assert.equal(isExpressionMetric({ key: 'expressionTpm', unit: 'TPM', family: 'Expression' }), true);
  assert.equal(isExpressionMetric({ key: 'rnaSeqCounts', unit: 'counts', family: 'Other' }), true);
  assert.equal(isExpressionMetric({ key: 'abundance', unit: 'TPM', family: 'Other' }), true);
  assert.equal(isExpressionMetric({ key: 'gc3', unit: 'fraction', family: 'Base composition' }), false);
});

test('expression labels distinguish native, borrowed, proxy, and unknown sources', () => {
  assert.equal(expressionSourceScope({
    key: 'tssInitiation', family: 'Expression', provenance: { isTargetOrganism: true },
  }), 'measured in this organism');
  assert.equal(expressionSourceScope({
    key: 'expression', family: 'Expression', provenance: { isTargetOrganism: false },
  }), 'measured elsewhere');
  assert.equal(expressionSourceScope({
    key: 'expressionProxy', family: 'Expression', label: 'Expression proxy',
  }), 'proxy from this genome');
  assert.equal(expressionSourceScope({ key: 'expression', family: 'Expression' }),
    'measurement source unrecorded');
  assert.equal(expressionSourceScope({ key: 'gc3', family: 'Composition' }),
    'from this genome');
});

test('rebinding live metrics swaps the values without rebuilding the registry', async () => {
  const dataset = await fixtureDataset();
  const registry = buildMetricRegistry(dataset.meta, dataset.genes, dataset.baseline);
  const replacement = { ...dataset.baseline, targetCount: new Float64Array(dataset.genes.length).fill(9) };
  rebindLiveMetrics(registry, replacement);
  assert.equal(registry.byKey.get('targetCount').read(0), 9);
  assert.equal(registry.byKey.get('gc3').read(0), dataset.genes[0].gc3);
  const values = metricValues(registry.byKey.get('targetCount'), 5);
  assert.deepEqual([...values], [9, 9, 9, 9, 9]);
});

test('an expression metric carries the provenance the interface must display', async () => {
  const dataset = await fixtureDataset();
  const genes = dataset.genes.map((gene, i) => ({ ...gene, expression: i % 9 === 0 ? null : i }));
  const expressionSource = {
    accession: 'GSE205444',
    organismMeasured: 'Synechococcus elongatus PCC 7942',
    isTargetOrganism: false,
    condition: 'WT, fresh BG-11, day 1',
    normalization: 'DESeq2 normalized counts',
    coverage: { withValue: 2551, total: 2715 },
    caveat: 'Use as a rough guide only.',
  };
  const meta = {
    ...dataset.meta,
    expressionSource,
    metrics: {
      ...dataset.meta.metrics,
      expression: { label: 'Expression', unit: 'normalized counts', family: 'Expression', desc: '' },
    },
  };
  const registry = buildMetricRegistry(meta, genes, dataset.baseline);
  const metric = registry.byKey.get('expression');
  assert.equal(metric.provenance, expressionSource);
  assert.equal(registry.byKey.get('gc3').provenance, undefined);

  const sentence = describeExpressionSource(expressionSource);
  assert.match(sentence, /PCC 7942/);
  assert.match(sentence, /different organism/);
  assert.match(sentence, /2551 of 2715/);
  assert.match(sentence, /rough guide/);
  assert.equal(describeExpressionSource(null), null);
});

test('expression provenance is resolved per metric source', async () => {
  const dataset = await fixtureDataset();
  const genes = dataset.genes.map((gene, index) => ({
    ...gene,
    expression: index + 1,
    expressionPercentile: (index + 1) / dataset.genes.length,
    tssInitiation: index + 2,
  }));
  const borrowed = {
    id: 'BORROWED', metricKey: 'expression', isTargetOrganism: false,
    organism: 'another strain',
  };
  const native = {
    id: 'NATIVE', metricKey: 'tssInitiation', isTargetOrganism: true,
    organism: 'this strain',
  };
  const meta = {
    ...dataset.meta,
    expressionSource: borrowed,
    expressionSources: [borrowed, native],
    metrics: {
      ...dataset.meta.metrics,
      expression: { label: 'Expression', family: 'Expression' },
      expressionPercentile: { label: 'Expression percentile', family: 'Expression' },
      tssInitiation: { label: 'TSS initiation', family: 'Expression' },
    },
  };
  const registry = buildMetricRegistry(meta, genes, dataset.baseline);

  assert.equal(registry.byKey.get('expression').provenance, borrowed);
  assert.equal(registry.byKey.get('expressionPercentile').provenance, borrowed);
  assert.equal(registry.byKey.get('tssInitiation').provenance, native);
});

test('a measurement from this organism is described as such', () => {
  const sentence = describeExpressionSource({
    organismMeasured: 'Synechococcus elongatus UTEX 2973',
    isTargetOrganism: true,
    coverage: { withValue: 2715, total: 2715 },
  });
  assert.match(sentence, /this genome's own organism/);
});

test('describeExpressionSource reads the current shipped source schema, not just the legacy one', () => {
  // meta.expressionSources entries ship as organism/units/id, never as the
  // legacy organismMeasured/normalization/accession fields.
  const shipped = {
    id: 'TAN2018_TSS',
    organism: 'Synechococcus elongatus UTEX 2973',
    units: 'summed mean TSS counts',
    isTargetOrganism: true,
    condition: 'control, high light, high temperature, dark, pooled',
    coverage: { withValue: 1727, total: 2715 },
    caveat: 'Transcription initiation strength, not transcript abundance.',
  };
  const sentence = describeExpressionSource(shipped);
  assert.match(sentence, /UTEX 2973/);
  assert.match(sentence, /this genome's own organism/);
  assert.match(sentence, /summed mean TSS counts/);
  assert.match(sentence, /1727 of 2715/);
  assert.match(sentence, /Source: TAN2018_TSS\./);
  assert.match(sentence, /Transcription initiation strength/);

  // The legacy shape must still work: this is the boundary both feed through.
  const legacy = {
    accession: 'GSE205444',
    organismMeasured: 'Synechococcus elongatus PCC 7942',
    isTargetOrganism: false,
    normalization: 'DESeq2 normalized counts',
    coverage: { withValue: 2551, total: 2715 },
  };
  const legacySentence = describeExpressionSource(legacy);
  assert.match(legacySentence, /PCC 7942/);
  assert.match(legacySentence, /DESeq2 normalized counts/);
  assert.match(legacySentence, /Source: GSE205444\./);
});

test('a sparse metric is detected wherever its first finite value falls, not only in the first 200 genes', async () => {
  const dataset = await fixtureDataset();
  const genes = dataset.genes.map((gene, index) => ({
    ...gene,
    // 300 genes in the fixture; a lone finite value past index 199 must still
    // be found, however the genes happen to be ordered.
    sparseLateMetric: index === 250 ? 42 : null,
  }));
  const meta = {
    ...dataset.meta,
    metrics: {
      ...dataset.meta.metrics,
      sparseLateMetric: { label: 'Sparse late metric', unit: 'z' },
    },
  };
  assert.ok(genes.length > 200, 'fixture must exceed the old 200-gene sample to exercise this');
  const registry = buildMetricRegistry(meta, genes, dataset.baseline);
  assert.equal(registry.declaredButMissing.includes('sparseLateMetric'), false);
  assert.equal(registry.byKey.get('sparseLateMetric').read(250), 42);
});

test('discovery finds a declared metric regardless of gene order (permutation invariance)', async () => {
  const dataset = await fixtureDataset();
  const forward = dataset.genes.map((gene, index) => ({
    ...gene,
    permutedMetric: index === 299 ? 7 : null,
  }));
  const reversed = [...forward].reverse();
  const meta = {
    ...dataset.meta,
    metrics: { ...dataset.meta.metrics, permutedMetric: { label: 'Permuted metric', unit: 'z' } },
  };
  const forwardRegistry = buildMetricRegistry(meta, forward, dataset.baseline);
  const reversedRegistry = buildMetricRegistry(meta, reversed, dataset.baseline);
  assert.equal(forwardRegistry.declaredButMissing.includes('permutedMetric'), false);
  assert.equal(reversedRegistry.declaredButMissing.includes('permutedMetric'), false);
});
