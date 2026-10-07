import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dataset } from './data-sources-fixture.mjs';
import {
  assayKind, buildTypeMetrics, contributingDatasets, defaultDatasetsOfType, defaultInforming,
  informingDataset, isDatasetOwnKey, isTypeKey, normalizeTypeSources, typeGroups, typeKeyFor, typeKeyOf, typeLabelFor,
} from '../../site/js/core/type-metrics.js';

function datasets() {
  const rows = [
    dataset({ id: 'GSE205444', datasetId: 'GSE205444', metricKey: 'expression', group: 'biofilm' }),
    dataset({ id: 'TAN', datasetId: 'TAN2018_TSS', metricKey: 'tssInitiation', group: 'other' }),
    dataset({ id: 'GSE9', row: 5, group: 'standard' }),
    dataset({ id: 'ARR', group: 'standard', platform: 'array' }),
    dataset({ id: 'PXD1', group: 'standard', dataType: 'proteomics', platform: 'LC-MS/MS' }),
  ];
  rows[1].source = { ...rows[1].source, assay: 'dRNA-seq transcription initiation strength' };
  return rows;
}

test('a dataset collapses into a type by data type, platform and the kind of quantity', () => {
  const [abundance, initiation, , array, protein] = datasets();
  assert.equal(assayKind(abundance), 'abundance');
  assert.equal(assayKind(initiation), 'initiation');
  assert.equal(typeKeyFor(abundance), 'type.transcriptomics.rna-seq.abundance');
  assert.equal(typeKeyFor(initiation), 'type.transcriptomics.rna-seq.initiation');
  assert.equal(typeKeyFor(array), 'type.transcriptomics.array.abundance');
  assert.equal(typeKeyFor(protein), 'type.proteomics.lc-ms-ms.abundance');
  assert.equal(typeLabelFor(abundance), 'Transcript abundance (RNA-seq)');
  assert.equal(typeLabelFor(initiation), 'Transcription initiation (RNA-seq)');
  assert.equal(typeLabelFor(array), 'Transcript abundance (array)');
  assert.equal(typeLabelFor(protein), 'Protein abundance (LC-MS/MS)');
  assert.equal(isTypeKey('type.x.y.z'), true);
  assert.equal(isTypeKey('gc3'), false);
  assert.equal(typeKeyOf('expression', datasets()), 'type.transcriptomics.rna-seq.abundance');
  assert.equal(typeKeyOf('gc3', datasets()), 'gc3', 'a computed key is left alone');
});

test('the shipped original informs its type by default, else the first selected dataset', () => {
  const all = datasets();
  const groups = typeGroups(all);
  assert.deepEqual([...groups.keys()], [
    'type.transcriptomics.rna-seq.abundance', 'type.transcriptomics.rna-seq.initiation',
    'type.transcriptomics.array.abundance', 'type.proteomics.lc-ms-ms.abundance',
  ]);
  const abundance = groups.get('type.transcriptomics.rna-seq.abundance');
  assert.equal(defaultInforming(abundance, ['GSE9.5', 'GSE205444']).id, 'GSE205444');
  assert.equal(defaultInforming(abundance, ['GSE9.5']).id, 'GSE9.5');
  assert.equal(defaultInforming(abundance, ['PXD1.1']), null, 'no selected dataset of the type');
});

test('a named dataset survives only while selected and of the type; several selected pool unless one is named', () => {
  const all = datasets();
  const selection = ['GSE205444', 'GSE9.5', 'TAN2018_TSS', 'PXD1.1'];
  const key = 'type.transcriptomics.rna-seq.abundance';
  assert.deepEqual(normalizeTypeSources({ [key]: 'GSE9.5' }, all, selection), { [key]: 'GSE9.5' });
  assert.deepEqual(normalizeTypeSources({ [key]: 'GSE205444' }, all, selection), { [key]: 'GSE205444' }, 'naming one of two is a choice');
  assert.deepEqual(normalizeTypeSources({ [key]: 'PXD1.1' }, all, selection), {}, 'wrong type');
  assert.deepEqual(normalizeTypeSources({ [key]: 'ARR.1' }, all, selection), {}, 'not selected');
  assert.deepEqual(normalizeTypeSources({ 'type.nope': 'GSE9.5' }, all, selection), {}, 'unknown type');
  const lone = 'type.transcriptomics.rna-seq.initiation';
  assert.deepEqual(normalizeTypeSources({ [lone]: 'TAN2018_TSS' }, all, selection), {}, 'the only selected dataset needs no naming');
  assert.equal(informingDataset(key, { [key]: 'GSE9.5' }, all, selection).id, 'GSE9.5');
  assert.equal(informingDataset(key, {}, all, selection), null, 'two selected and none named: pooled');
  assert.equal(informingDataset(lone, {}, all, selection).id, 'TAN2018_TSS', 'one selected informs alone');
  assert.equal(informingDataset(key, { [key]: 'ARR.1' }, all, selection), null, 'an unselected choice pools');
  assert.equal(informingDataset('type.transcriptomics.array.abundance', {}, all, selection), null);
  assert.deepEqual(contributingDatasets(key, {}, all, selection).map((d) => d.id), ['GSE205444', 'GSE9.5']);
  assert.deepEqual(contributingDatasets(key, { [key]: 'GSE9.5' }, all, selection).map((d) => d.id), ['GSE9.5']);
  assert.deepEqual(contributingDatasets('type.transcriptomics.array.abundance', {}, all, selection), []);
});

test('a type metric pools its selected datasets by within-dataset rank, or reads the one named', () => {
  const all = datasets();
  // Three genes; the second dataset reports the third gene only as missing.
  const values = { expression: [1, 2, 3], 'GSE9.5': [30, 10, NaN] };
  const metricsByKey = new Map([
    ['expression', { key: 'expression', unit: 'counts', desc: 'A', scale: 'sequential', provenance: { id: 'GSE205444', citationId: 'a-2022', organism: 'PCC 7942', condition: 'c1' }, read: (i) => values.expression[i] }],
    [all[2].metricKey, { key: all[2].metricKey, unit: 'TPM', desc: 'B', scale: 'sequential', provenance: { id: 'GSE9.5', citationId: 'b-2023', organism: 'PCC 7942', condition: 'c2' }, read: (i) => values['GSE9.5'][i] }],
  ]);
  let typeSources = {};
  const selection = ['GSE205444', 'GSE9.5'];
  const metrics = buildTypeMetrics(all, {
    contributing: (typeKey) => contributingDatasets(typeKey, typeSources, all, selection),
    metricOf: (d) => metricsByKey.get(d.metricKey) ?? null,
    geneCount: 3,
  });
  const abundance = metrics.find((m) => m.key === 'type.transcriptomics.rna-seq.abundance');
  assert.equal(abundance.family, 'Expression');
  assert.equal(abundance.isType, true);
  assert.equal(abundance.pooled, true);
  assert.equal(abundance.informing, null);
  // Pooled: the mean of each dataset's mid-rank percentile. Gene 0 ranks 1/6 in
  // the first (lowest of three) and 3/4 in the second (highest of two).
  assert.ok(Math.abs(abundance.read(0) - ((1 / 6) + (3 / 4)) / 2) < 1e-12);
  // Gene 2 is missing from the second dataset, so only the first contributes.
  assert.ok(Math.abs(abundance.read(2) - (5 / 6)) < 1e-12);
  assert.match(abundance.unit, /^pooled percentile across 2 datasets/);
  assert.equal(abundance.provenance.id, 'pooled: GSE205444, GSE9.5');
  assert.deepEqual(abundance.provenance.citationIds, ['a-2022', 'b-2023']);
  assert.match(abundance.provenance.caveat, /ranked within itself before averaging/);
  assert.equal(abundance.scale, 'sequential');
  // Naming one dataset reads its own values again, through the same object.
  typeSources = { 'type.transcriptomics.rna-seq.abundance': 'GSE9.5' };
  assert.equal(abundance.pooled, false);
  assert.equal(abundance.read(0), 30);
  assert.equal(abundance.unit, 'TPM');
  assert.equal(abundance.informing.id, 'GSE9.5');
  assert.equal(abundance.provenance.id, 'GSE9.5');
  // A type none of whose datasets has a registry metric reads as unknown.
  const protein = metrics.find((m) => m.key === 'type.proteomics.lc-ms-ms.abundance');
  assert.ok(Number.isNaN(protein.read(0)));
  assert.equal(protein.unit, '');
  assert.equal(protein.provenance, null);
});

test('a signed fitness type pools as the mean of its values, which share a scale', () => {
  const screens = [
    dataset({ id: 'F1', datasetId: 'F1', metricKey: 'fitA', dataType: 'fitness', platform: 'RB-TnSeq' }),
    dataset({ id: 'F2', datasetId: 'F2', metricKey: 'fitB', dataType: 'fitness', platform: 'RB-TnSeq' }),
  ];
  const byKey = new Map([
    ['fitA', { key: 'fitA', unit: 'fitness', desc: '', scale: 'diverging', provenance: { id: 'F1' }, read: (i) => [-2, 1][i] }],
    ['fitB', { key: 'fitB', unit: 'fitness', desc: '', scale: 'diverging', provenance: { id: 'F2' }, read: (i) => [0, NaN][i] }],
  ]);
  const [fitness] = buildTypeMetrics(screens, {
    contributing: (key) => contributingDatasets(key, {}, screens, ['F1', 'F2']),
    metricOf: (d) => byKey.get(d.metricKey), geneCount: 2,
  });
  assert.equal(fitness.family, 'Fitness');
  assert.equal(fitness.read(0), -1);
  assert.equal(fitness.read(1), 1);
  assert.match(fitness.unit, /^mean gene fitness across 2 fractions/);
  assert.equal(fitness.scale, 'diverging');
});

test('a fitness screen is its own family; abundance and initiation are expression', () => {
  const all = datasets();
  const screen = dataset({ id: 'GSE205443', datasetId: 'GSE205443', metricKey: 'fitGse205443', dataType: 'fitness', platform: 'RB-TnSeq' });
  const metrics = buildTypeMetrics([...all, screen], { contributing: () => [], metricOf: () => null });
  const families = Object.fromEntries(metrics.map((m) => [m.key, m.family]));
  assert.equal(families['type.fitness.rb-tnseq.fitness'], 'Fitness');
  assert.equal(families['type.transcriptomics.rna-seq.abundance'], 'Expression');
  assert.equal(families['type.transcriptomics.rna-seq.initiation'], 'Expression');
  assert.equal(typeLabelFor(screen), 'Gene fitness (RB-TnSeq)');
});

test('a type asked for with nothing selected starts from its originals and standard sets, else all of it', () => {
  const all = datasets();
  const screen = dataset({ id: 'F1', datasetId: 'F1', metricKey: 'fitA', dataType: 'fitness', platform: 'RB-TnSeq', group: 'biofilm' });
  const ids = (list) => list.map((d) => d.id);
  assert.deepEqual(ids(defaultDatasetsOfType('type.transcriptomics.rna-seq.abundance', all)), ['GSE205444', 'GSE9.5']);
  assert.deepEqual(ids(defaultDatasetsOfType('type.transcriptomics.rna-seq.initiation', all)), ['TAN2018_TSS']);
  assert.deepEqual(ids(defaultDatasetsOfType('type.fitness.rb-tnseq.fitness', [...all, screen])), ['F1'], 'no standard set: every dataset of the type');
  assert.deepEqual(defaultDatasetsOfType('type.nope', all), []);
});

test('a default-pooled study wins the default, and does not drag in other studies', () => {
  const all = datasets();
  const pooled = (id, group) => dataset({
    id, datasetId: id, metricKey: id, dataType: 'fitness', platform: 'RB-TnSeq',
    group, studyId: 'FitnessBrowser_SynE',
  });
  const biofilm = dataset({
    id: 'B1', datasetId: 'B1', metricKey: 'fitB1', dataType: 'fitness',
    platform: 'RB-TnSeq', group: 'biofilm', studyId: 'GSE205443',
  });
  const standard = dataset({
    id: 'S1', datasetId: 'S1', metricKey: 'fitS1', dataType: 'fitness',
    platform: 'RB-TnSeq', group: 'standard', studyId: 'GSE205443',
  });
  const ids = (list) => list.map((d) => d.id).sort();
  const withPool = [...all, biofilm, standard, pooled('P1', 'stress'), pooled('P2', 'standard')];
  // The pooled study takes the default whole, including its stress arms, and
  // the other study's standard set does not join it.
  assert.deepEqual(ids(defaultDatasetsOfType('type.fitness.rb-tnseq.fitness', withPool)), ['P1', 'P2']);
  // Without that study the older rule still applies.
  assert.deepEqual(
    ids(defaultDatasetsOfType('type.fitness.rb-tnseq.fitness', [...all, biofilm, standard])),
    ['S1'],
  );
});

test('a dataset\'s own metric and its derived percentile are both the dataset\'s, a type or a computed metric is not', () => {
  const all = datasets();
  assert.equal(isDatasetOwnKey('expression', all), true);
  assert.equal(isDatasetOwnKey('expressionPercentile', all), true, 'the single-dataset rank is offered through its type instead');
  assert.equal(isDatasetOwnKey('tssInitiation', all), true);
  assert.equal(isDatasetOwnKey('type.transcriptomics.rna-seq.abundance', all), false);
  assert.equal(isDatasetOwnKey('expressionProxy', all), false, 'the codon-adaptation proxy is this genome\'s own');
  assert.equal(isDatasetOwnKey('gc3', all), false);
});
