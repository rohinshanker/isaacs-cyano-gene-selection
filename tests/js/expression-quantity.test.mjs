/**
 * The browser's half of the declared-quantity contract.
 *
 * One transcriptomics deposit publishes an abundance, a read count, one or more
 * log2 fold changes, a p-value and sometimes a translation-efficiency ratio, and
 * `dataType` plus the assay sentence cannot separate them. A source may declare
 * the `quantity` its values are; the pipeline resolves what follows
 * (`scripts/expression_table.py`) and publishes it, and these tests pin that the
 * browser reads that declaration rather than parsing prose, that the three
 * quantities which are not abundances stay out of the abundance rules, and that
 * none of them is pooled across contrasts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dataset, quantityFacts } from './data-sources-fixture.mjs';
import { withFakeDocument } from './fake-dom.mjs';
import { FIXTURE_DIR } from './helpers.mjs';
import {
  assayKind, buildTypeMetrics, contributingDatasets, informingDataset, normalizeTypeSources,
  selectedDatasetsOfType, typeGroups, typeKeyFor, typeLabelFor, typePools,
} from '../../site/js/core/type-metrics.js';
import {
  buildMetricRegistry, hasDeclaredMeasurement, isExpressionMetric, isMeasuredMetric,
  measurementLimitClauses, orderMeasuredFirst,
} from '../../site/js/core/metric-registry.js';
import { DATA_APPLIERS, buildCoreDataset } from '../../site/js/core/dataset.js';
import { DataSourcesPanel } from '../../site/js/ui/data-sources.js';
import { orderTrafficCandidates } from '../../site/js/ui/filters.js';

const QUANTITIES = [
  'rpkm', 'read_count', 'log2_fold_change', 'edger_log2_fold_change', 'p_value',
  'translation_efficiency_log2_fold_change',
];

/** One dataset per quantity, all on one platform, as the manifest would list them. */
function declaredDatasets(platform = 'RNA-seq') {
  return QUANTITIES.map((quantity, index) => dataset({
    id: 'GSE1', row: index + 1, platform, quantity, metricKey: `m${index}`,
  }));
}

test('a declared quantity, not an assay sentence, decides the kind and the label', () => {
  const rows = declaredDatasets();
  assert.deepEqual(rows.map(assayKind), [
    'abundance', 'read-count', 'log2-fold-change', 'edger-log2-fold-change', 'p-value',
    'te-log2-fold-change',
  ]);
  assert.deepEqual(rows.map(typeLabelFor), [
    'RNA abundance', 'RNA read count', 'RNA log2FC', 'RNA log2FC (EdgeR)',
    'RNA reported P-value (adjustment unspecified)', 'TE log2FC',
  ]);
  // The platform distinguishes the molecule that was counted.
  const ribo = declaredDatasets('Ribo-seq');
  assert.deepEqual(ribo.slice(0, 2).map(typeLabelFor), ['Ribosome occupancy', 'Ribosome footprint count']);
  assert.deepEqual(ribo.slice(2, 4).map(typeLabelFor), ['Ribosome log2FC', 'Ribosome log2FC (EdgeR)']);
  assert.equal(typeLabelFor(ribo[5]), 'TE log2FC', 'a ratio of the two names neither');

  // A declared quantity is never reached through the assay prose, even when the
  // prose would have said something else.
  const misleading = dataset({
    id: 'GSE2', quantity: 'p_value', source: { assay: 'dRNA-seq transcription initiation strength' },
  });
  assert.equal(assayKind(misleading), 'p-value');
  assert.equal(typeLabelFor(misleading), 'RNA reported P-value (adjustment unspecified)');
});

test('a source that declares no quantity keeps reading its data type and assay', () => {
  const abundance = dataset({ id: 'GSE205444', datasetId: 'GSE205444', metricKey: 'expression' });
  const initiation = dataset({ id: 'TAN', datasetId: 'TAN2018_TSS', metricKey: 'tssInitiation' });
  initiation.source = { ...initiation.source, assay: 'dRNA-seq transcription initiation strength' };
  const profiling = dataset({ id: 'RIBO', platform: 'Ribo-seq' });
  profiling.source = { ...profiling.source, assay: 'ribosome profiling footprints' };
  const fitness = dataset({ id: 'FIT', dataType: 'fitness', platform: 'RB-TnSeq' });
  assert.deepEqual([abundance, initiation, profiling, fitness].map(assayKind),
    ['abundance', 'initiation', 'occupancy', 'fitness']);
  assert.equal(typeLabelFor(abundance), 'Transcript abundance (RNA-seq)');
  assert.equal(typeLabelFor(initiation), 'Transcription initiation (RNA-seq)');
});

test('six quantities on one platform are six type metrics, and never group', () => {
  const rows = declaredDatasets();
  const keys = rows.map(typeKeyFor);
  assert.deepEqual(keys, [
    'type.transcriptomics.rna-seq.abundance',
    'type.transcriptomics.rna-seq.read-count',
    'type.transcriptomics.rna-seq.log2-fold-change',
    'type.transcriptomics.rna-seq.edger-log2-fold-change',
    'type.transcriptomics.rna-seq.p-value',
    'type.transcriptomics.rna-seq.te-log2-fold-change',
  ]);
  assert.equal(new Set(keys).size, 6);
  assert.equal(typeGroups(rows).size, 6);
  // The same quantity on the other platform is a seventh and eighth metric.
  const mixed = [...rows, ...declaredDatasets('Ribo-seq')];
  assert.equal(typeGroups(mixed).size, 12);
  // Two deposits of one quantity do group: they are the same measurement.
  const pair = [
    dataset({ id: 'GSE3', row: 1, quantity: 'rpkm' }),
    dataset({ id: 'GSE4', row: 1, quantity: 'rpkm' }),
  ];
  assert.equal(typeGroups(pair).size, 1);
});

test('a fold change, a p-value and a ratio are not abundances anywhere in the registry', async () => {
  const meta = JSON.parse(await readFile(`${FIXTURE_DIR}/meta.json`, 'utf8'));
  const genes = JSON.parse(await readFile(`${FIXTURE_DIR}/genes.json`, 'utf8'));
  const sources = QUANTITIES.map((quantity, index) => ({
    id: `S${index}`,
    metricKey: `m${index}`,
    label: quantity,
    organism: 'E. coli',
    isTargetOrganism: true,
    condition: 'recoded against parent',
    units: quantity,
    coverage: { withValue: 1, total: genes.length },
    payload: 'expression_layers.json',
    record: { dataType: 'transcriptomics', platform: 'RNA-seq', conditions: {} },
    citationId: 'test-2026',
    ...quantityFacts(quantity),
  }));
  meta.expressionSources = sources;
  for (const source of sources) {
    meta.metrics[source.metricKey] = {
      label: source.label, unit: source.units, desc: 'A layer.',
      family: source.quantityFamily, scale: source.signed ? 'diverging' : 'sequential',
      missingPolicy: 'null renders as unknown', direction: 'contextual',
    };
  }
  const registry = buildMetricRegistry(meta, genes, {});
  const byQuantity = (quantity) => registry.byKey.get(`m${QUANTITIES.indexOf(quantity)}`);

  assert.equal(isExpressionMetric(byQuantity('rpkm')), true);
  assert.equal(isExpressionMetric(byQuantity('read_count')), true);
  for (const quantity of ['log2_fold_change', 'edger_log2_fold_change', 'p_value',
    'translation_efficiency_log2_fold_change']) {
    const metric = byQuantity(quantity);
    assert.equal(isExpressionMetric(metric), false, quantity);
    assert.equal(isMeasuredMetric(metric), false, quantity);
    // It is still a declared measurement, so its provenance is still reported.
    assert.equal(hasDeclaredMeasurement(metric), true, quantity);
    assert.deepEqual(measurementLimitClauses(metric, String),
      ['condition: recoded against parent', `1 of ${genes.length} genes have a value`]);
  }
  // The low-traffic threshold is about how busy a gene is, so none of the three
  // may answer it, and neither may they lead a measured-first ordering.
  const candidates = orderTrafficCandidates(registry).map((metric) => metric.key);
  assert.ok(candidates.includes(byQuantity('rpkm').key));
  for (const quantity of ['log2_fold_change', 'p_value', 'translation_efficiency_log2_fold_change']) {
    assert.ok(!candidates.includes(byQuantity(quantity).key), quantity);
  }
  assert.deepEqual(
    orderMeasuredFirst([byQuantity('p_value'), byQuantity('rpkm')]).map((m) => m.key),
    [byQuantity('rpkm').key, byQuantity('p_value').key],
  );
  // A key that reads like an abundance cannot talk its way back in.
  const sneaky = { ...byQuantity('p_value'), key: 'rpkmAdjustedPValue' };
  assert.equal(isExpressionMetric(sneaky), false);
});

test('a quantity that does not pool reads one dataset and says so', () => {
  const rows = [
    dataset({ id: 'GSE1', row: 1, quantity: 'p_value', metricKey: 'pA' }),
    dataset({ id: 'GSE2', row: 1, quantity: 'p_value', metricKey: 'pB' }),
    dataset({ id: 'GSE1', row: 2, quantity: 'rpkm', metricKey: 'rA' }),
    dataset({ id: 'GSE2', row: 2, quantity: 'rpkm', metricKey: 'rB' }),
  ];
  const pKey = 'type.transcriptomics.rna-seq.p-value';
  const rKey = 'type.transcriptomics.rna-seq.abundance';
  assert.equal(typePools(pKey, rows), false);
  assert.equal(typePools(rKey, rows), true);
  assert.equal(typePools('type.nope', rows), true, 'an unknown type pools, as before');

  const selection = ['GSE1.1', 'GSE2.1', 'GSE1.2', 'GSE2.2'];
  // The abundance pools: nothing is named, so there is no informing dataset.
  assert.equal(informingDataset(rKey, {}, rows, selection), null);
  assert.deepEqual(contributingDatasets(rKey, {}, rows, selection).map((d) => d.id),
    ['GSE1.2', 'GSE2.2']);
  // The p-value does not: the first selected one is read, deterministically.
  assert.equal(informingDataset(pKey, {}, rows, selection).id, 'GSE1.1');
  assert.deepEqual(contributingDatasets(pKey, {}, rows, selection).map((d) => d.id), ['GSE1.1']);
  // The reader can still name the other one.
  assert.equal(informingDataset(pKey, { [pKey]: 'GSE2.1' }, rows, selection).id, 'GSE2.1');
  assert.deepEqual(normalizeTypeSources({ [pKey]: 'GSE2.1' }, rows, selection), { [pKey]: 'GSE2.1' });
  // And with nothing of the type selected there is nothing to read.
  assert.equal(informingDataset(pKey, {}, rows, ['GSE1.2']), null);
  assert.deepEqual(selectedDatasetsOfType(pKey, rows, selection).map((d) => d.id),
    ['GSE1.1', 'GSE2.1']);

  const values = { pA: [0.5, 0.01], pB: [0.02, 0.04], rA: [1, 2], rB: [40, 10] };
  const metricOf = (d) => ({
    key: d.metricKey,
    unit: d.metricKey,
    desc: `${d.metricKey} desc.`,
    scale: 'sequential',
    provenance: { id: d.id, condition: `c-${d.id}` },
    read: (i) => values[d.metricKey][i],
  });
  const metrics = buildTypeMetrics(rows, {
    contributing: (key) => contributingDatasets(key, {}, rows, selection),
    selected: (key) => selectedDatasetsOfType(key, rows, selection),
    metricOf,
    geneCount: 2,
  });
  const pValue = metrics.find((metric) => metric.key === pKey);
  const abundance = metrics.find((metric) => metric.key === rKey);

  assert.equal(pValue.family, 'Significance');
  assert.equal(abundance.family, 'Expression');
  assert.equal(pValue.pools, false);
  assert.equal(abundance.pools, true);
  // One dataset read, unpooled, with its own unit and provenance.
  assert.equal(pValue.pooled, false);
  assert.equal(pValue.unit, 'pA');
  assert.equal(pValue.provenance.id, 'GSE1.1');
  assert.equal(pValue.read(0), 0.5, 'the value is that dataset’s own, not a mean');
  assert.match(pValue.selectionNote, /2 datasets of this kind are selected, and GSE1\.1 alone is read/);
  assert.match(pValue.selectionNote, /never averaged across contrasts/);
  assert.match(pValue.desc, /^pA desc\. 2 datasets of this kind are selected/);
  // The abundance still pools, as it always has.
  assert.equal(abundance.pooled, true);
  assert.equal(abundance.selectionNote, null);
  assert.equal(abundance.read(0), 0.5, 'mean of each dataset’s within-dataset mid-rank');
  assert.match(abundance.unit, /pooled percentile across 2 datasets/);

  // With one selected there is nothing to say: no note, and the same value.
  const single = buildTypeMetrics(rows, {
    contributing: (key) => contributingDatasets(key, {}, rows, ['GSE1.1']),
    selected: (key) => selectedDatasetsOfType(key, rows, ['GSE1.1']),
    metricOf,
    geneCount: 2,
  }).find((metric) => metric.key === pKey);
  assert.equal(single.selectionNote, null);
  assert.equal(single.desc, 'pA desc.');
  assert.equal(single.read(1), 0.01);
});

test('a signed quantity opens on a diverging ramp before any dataset is selected', () => {
  const rows = [
    dataset({ id: 'GSE1', row: 1, quantity: 'log2_fold_change', metricKey: 'fcA' }),
    dataset({ id: 'GSE1', row: 2, quantity: 'p_value', metricKey: 'pA' }),
  ];
  const metrics = buildTypeMetrics(rows, {
    contributing: () => [],
    selected: () => [],
    metricOf: () => null,
    geneCount: 0,
  });
  assert.equal(metrics.find((m) => m.key.endsWith('log2-fold-change')).scale, 'diverging');
  assert.equal(metrics.find((m) => m.key.endsWith('p-value')).scale, 'sequential');
});

test('an expression layer is checked against the bounds its quantity admits', async () => {
  const meta = JSON.parse(await readFile(`${FIXTURE_DIR}/meta.json`, 'utf8'));
  const genes = JSON.parse(await readFile(`${FIXTURE_DIR}/genes.json`, 'utf8'));
  const declare = (quantity) => {
    const source = {
      id: 'Q', metricKey: 'q', payload: 'expression_layers.json',
      organism: 'E. coli', isTargetOrganism: true, condition: 'test', units: quantity,
      ...quantityFacts(quantity),
    };
    const next = structuredClone(meta);
    next.expressionSources = [source];
    next.metrics.q = {
      label: 'Q', unit: quantity, desc: 'A layer.', family: source.quantityFamily,
      scale: 'sequential', missingPolicy: 'null renders as unknown', direction: 'contextual',
    };
    return buildCoreDataset(next, structuredClone(genes), null);
  };
  const apply = (quantity, values) => {
    const target = declare(quantity);
    const ids = target.genes.map((gene) => gene.id);
    const column = ids.map((_, index) => values[index % values.length]);
    DATA_APPLIERS.expressionLayers(target, { schemaVersion: 1, geneIds: ids, layers: { q: column } });
    return target;
  };

  // A count is whole and non-negative.
  assert.equal(apply('read_count', [0, 931]).genes[1].q, 931);
  assert.throws(() => apply('read_count', [12.5]), /invalid value for q/);
  assert.throws(() => apply('read_count', [-3]), /invalid value for q/);
  // A fold change may be either sign, and an exact zero is a real no-change.
  assert.equal(apply('log2_fold_change', [-4.5, 0]).genes[0].q, -4.5);
  assert.equal(apply('log2_fold_change', [0, -4.5]).genes[0].q, 0);
  // A p-value is a probability, and a tiny one survives the join exactly.
  assert.equal(apply('p_value', [3.2e-18, 1]).genes[0].q, 3.2e-18);
  assert.throws(() => apply('p_value', [1.2]), /invalid value for q/);
  assert.throws(() => apply('p_value', [-0.1]), /invalid value for q/);
  // An RPKM is non-negative; a null is still absent rather than zero.
  assert.throws(() => apply('rpkm', [-1]), /invalid value for q/);
  assert.equal(apply('rpkm', [null, 2.5]).genes[0].q, undefined);
});

test('the source selector offers no pooled row for a quantity that does not pool', async () => {
  await withFakeDocument(async (document) => {
    const rows = [
      dataset({ id: 'GSE1', row: 1, quantity: 'p_value', metricKey: 'pA' }),
      dataset({ id: 'GSE2', row: 1, quantity: 'p_value', metricKey: 'pB' }),
    ];
    const host = document.createElement('div');
    document.body.append(host);
    const storage = { getItem: () => null, setItem: () => {} };
    const panel = new DataSourcesPanel(host, { datasets: rows, onChange: () => {}, storage });
    const selection = ['GSE1.1', 'GSE2.1'];
    const key = 'type.transcriptomics.rna-seq.p-value';
    const informing = {
      typeOf: (d) => ({ key: typeKeyFor(d), label: typeLabelFor(d) }),
      chosen: (typeKey) => informingDataset(typeKey, {}, rows, selection),
      onInform: () => {},
      colorTypeKey: key,
      allOfType: (typeKey) => typeGroups(rows).get(typeKey)?.datasets ?? [],
      isSelected: (id) => selection.includes(id),
      onSelect: () => {},
      poolsType: (typeKey) => typePools(typeKey, rows),
    };
    panel.update({ selection, colorMetricKey: key, informing });

    const radios = host.querySelectorAll('input').filter((input) => input.type === 'radio');
    assert.deepEqual(radios.map((radio) => [radio.id, radio.checked]), [
      [`ds-inform-${key}-GSE1.1`, true],
      [`ds-inform-${key}-GSE2.1`, false],
    ], 'no pooled radio, and the dataset actually read is the one checked');
    const note = host.querySelector('li.data-sources-note');
    assert.match(note.textContent, /do not pool: one of the 2 included datasets is read/);
    const items = host.querySelectorAll('li.data-sources-item');
    assert.ok(items[0].textContent.includes('colouring the map'));
    assert.ok(!items[1].textContent.includes('colouring the map'));
    assert.ok(host.querySelectorAll('li.data-sources-type')
      .some((li) => li.textContent.includes('RNA reported P-value (adjustment unspecified)')));

    // An abundance keeps its pooled row and its pooled default.
    const abundances = [
      dataset({ id: 'GSE1', row: 2, quantity: 'rpkm', metricKey: 'rA' }),
      dataset({ id: 'GSE2', row: 2, quantity: 'rpkm', metricKey: 'rB' }),
    ];
    const abundanceKey = 'type.transcriptomics.rna-seq.abundance';
    const pooledHost = document.createElement('div');
    document.body.append(pooledHost);
    const pooledPanel = new DataSourcesPanel(pooledHost,
      { datasets: abundances, onChange: () => {}, storage });
    const pooledSelection = ['GSE1.2', 'GSE2.2'];
    pooledPanel.update({
      selection: pooledSelection,
      colorMetricKey: abundanceKey,
      informing: {
        ...informing,
        colorTypeKey: abundanceKey,
        chosen: (typeKey) => informingDataset(typeKey, {}, abundances, pooledSelection),
        allOfType: (typeKey) => typeGroups(abundances).get(typeKey)?.datasets ?? [],
        isSelected: (id) => pooledSelection.includes(id),
        poolsType: (typeKey) => typePools(typeKey, abundances),
      },
    });
    assert.ok(pooledHost.querySelectorAll('input')
      .some((input) => input.id === `ds-inform-${abundanceKey}-pooled`));
    assert.equal(pooledHost.querySelector('li.data-sources-note'), null);
  });
});
