import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dataset } from './data-sources-fixture.mjs';
import {
  assayKind, buildTypeMetrics, defaultInforming, informingDataset, isTypeKey, normalizeTypeSources,
  typeGroups, typeKeyFor, typeKeyOf, typeLabelFor,
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

test('an informing choice survives only while it is selected, of the type, and not the default', () => {
  const all = datasets();
  const selection = ['GSE205444', 'GSE9.5', 'TAN.1', 'PXD1.1'];
  const key = 'type.transcriptomics.rna-seq.abundance';
  assert.deepEqual(normalizeTypeSources({ [key]: 'GSE9.5' }, all, selection), { [key]: 'GSE9.5' });
  assert.deepEqual(normalizeTypeSources({ [key]: 'GSE205444' }, all, selection), {}, 'the default is not recorded');
  assert.deepEqual(normalizeTypeSources({ [key]: 'PXD1.1' }, all, selection), {}, 'wrong type');
  assert.deepEqual(normalizeTypeSources({ [key]: 'ARR.1' }, all, selection), {}, 'not selected');
  assert.deepEqual(normalizeTypeSources({ 'type.nope': 'GSE9.5' }, all, selection), {}, 'unknown type');
  assert.equal(informingDataset(key, { [key]: 'GSE9.5' }, all, selection).id, 'GSE9.5');
  assert.equal(informingDataset(key, {}, all, selection).id, 'GSE205444');
  assert.equal(informingDataset(key, { [key]: 'ARR.1' }, all, selection).id, 'GSE205444', 'an unselected choice falls back');
  assert.equal(informingDataset('type.transcriptomics.array.abundance', {}, all, selection), null);
});

test('a type metric reads the informing dataset at call time and changes with it', () => {
  const all = datasets();
  const values = { expression: [1, 2, 3], 'GSE9.5': [10, 20, 30] };
  const metricsByKey = new Map([
    ['expression', { key: 'expression', unit: 'counts', desc: 'A', scale: 'sequential', provenance: { id: 'GSE205444' }, read: (i) => values.expression[i] }],
    [all[2].metricKey, { key: all[2].metricKey, unit: 'TPM', desc: 'B', scale: 'sequential', provenance: { id: 'GSE9.5' }, read: (i) => values['GSE9.5'][i] }],
  ]);
  let typeSources = {};
  const selection = ['GSE205444', 'GSE9.5'];
  const metrics = buildTypeMetrics(all, {
    inform: (typeKey) => informingDataset(typeKey, typeSources, all, selection),
    metricOf: (d) => metricsByKey.get(d.metricKey) ?? null,
  });
  const abundance = metrics.find((m) => m.key === 'type.transcriptomics.rna-seq.abundance');
  assert.equal(abundance.family, 'Expression');
  assert.equal(abundance.isType, true);
  assert.equal(abundance.label, 'Transcript abundance (RNA-seq)');
  assert.equal(abundance.read(1), 2);
  assert.equal(abundance.unit, 'counts');
  assert.equal(abundance.provenance.id, 'GSE205444');
  typeSources = { 'type.transcriptomics.rna-seq.abundance': 'GSE9.5' };
  assert.equal(abundance.read(1), 20, 'the same metric object now reads the chosen dataset');
  assert.equal(abundance.unit, 'TPM');
  assert.equal(abundance.informing.id, 'GSE9.5');
  // A type none of whose datasets has a registry metric reads as unknown.
  const protein = metrics.find((m) => m.key === 'type.proteomics.lc-ms-ms.abundance');
  assert.ok(Number.isNaN(protein.read(0)));
  assert.equal(protein.unit, '');
  assert.equal(protein.provenance, null);
});

test('a fitness screen is its own family; abundance and initiation are expression', () => {
  const all = datasets();
  const screen = dataset({ id: 'GSE205443', datasetId: 'GSE205443', metricKey: 'fitGse205443', dataType: 'fitness', platform: 'RB-TnSeq' });
  const metrics = buildTypeMetrics([...all, screen], { inform: () => null, metricOf: () => null });
  const families = Object.fromEntries(metrics.map((m) => [m.key, m.family]));
  assert.equal(families['type.fitness.rb-tnseq.fitness'], 'Fitness');
  assert.equal(families['type.transcriptomics.rna-seq.abundance'], 'Expression');
  assert.equal(families['type.transcriptomics.rna-seq.initiation'], 'Expression');
  assert.equal(typeLabelFor(screen), 'Gene fitness (RB-TnSeq)');
});
