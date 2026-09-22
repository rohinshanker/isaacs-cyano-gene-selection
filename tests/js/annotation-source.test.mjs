import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANNOTATION_SOURCES, DEFAULT_ANNOTATION_SOURCE, ALL_SOURCES, UTEX_SOURCE, PCC_SOURCE,
  GO_IEA_SOURCE, isAnnotationSource, annotationSourceLabel, annotationSourceEvidenceNote,
  annotationSourceView, registerAllSourcesAugmenter,
} from '../../site/js/core/annotation-source.js';

test('exposes exactly the four required sources, defaulting to all', () => {
  assert.deepEqual(ANNOTATION_SOURCES.map((s) => s.id), [ALL_SOURCES, UTEX_SOURCE, PCC_SOURCE, GO_IEA_SOURCE]);
  assert.equal(DEFAULT_ANNOTATION_SOURCE, ALL_SOURCES);
  assert.equal(isAnnotationSource('all'), true);
  assert.equal(isAnnotationSource('nonsense'), false);
  assert.equal(annotationSourceLabel('pcc-7942'), 'PCC 7942');
  assert.equal(annotationSourceLabel('nonsense'), null);
});

test('each single source carries its own evidence/citation/licence wording; all has none', () => {
  assert.match(annotationSourceEvidenceNote(UTEX_SOURCE), /RefSeq/);
  assert.match(annotationSourceEvidenceNote(PCC_SOURCE), /cross-strain/);
  assert.match(annotationSourceEvidenceNote(PCC_SOURCE), /CC BY 4.0/);
  assert.match(annotationSourceEvidenceNote(GO_IEA_SOURCE), /Gene Ontology/);
  assert.equal(annotationSourceEvidenceNote(ALL_SOURCES), null);
});

function fixtureDataset() {
  return {
    functionCategories: {
      assignmentsById: new Map([['g1', { categoryIds: ['stress-and-repair'] }]]),
      source: { vocabulary: { categories: [{ id: 'stress-and-repair', label: 'Stress and repair' }] } },
    },
    candidateEvidence: {
      borrowedEssentiality: {
        byLocus: {
          g1: { status: 'essential', pccLocusTag: 'Synpcc7942_0001', mappingStatus: 'accepted' },
          g2: { status: 'unknown', mappingStatus: 'unmapped', mappingReason: 'no crosswalk entry' },
        },
      },
    },
  };
}

function fixtureGene(overrides = {}) {
  return {
    id: 'g1', name: 'rpsL', product: '30S ribosomal protein S12',
    reviewedFunctionLabels: ['Stress and repair'],
    annotationEvidence: { goAnnotations: [{ goId: 'GO:0000001', qualifier: 'enables', aspect: 'F' }] },
    ...overrides,
  };
}

test('UTEX view carries product/name/category only, blank essentiality and GO', () => {
  const dataset = fixtureDataset();
  const view = annotationSourceView(fixtureGene(), dataset, UTEX_SOURCE);
  assert.equal(view.source, UTEX_SOURCE);
  assert.equal(view.product, '30S ribosomal protein S12');
  assert.equal(view.name, 'rpsL');
  assert.deepEqual(view.reviewedFunctionLabels, ['Stress and repair']);
  assert.equal(view.essentialityStatus, null);
  assert.equal(view.pccLocusTag, null);
  assert.deepEqual(view.goAnnotations, []);
});

test('PCC view carries essentiality only, blank product/name/category/GO', () => {
  const dataset = fixtureDataset();
  const view = annotationSourceView(fixtureGene(), dataset, PCC_SOURCE);
  assert.equal(view.source, PCC_SOURCE);
  assert.equal(view.product, null);
  assert.equal(view.name, null);
  assert.deepEqual(view.reviewedFunctionLabels, []);
  assert.equal(view.functionCategoryLabel, null);
  assert.equal(view.essentialityStatus, 'essential');
  assert.equal(view.pccLocusTag, 'Synpcc7942_0001');
  assert.deepEqual(view.goAnnotations, []);
});

test('PCC view leaves an unjoined locus blank rather than showing "unknown" as a value', () => {
  const dataset = fixtureDataset();
  const view = annotationSourceView(fixtureGene({ id: 'g2' }), dataset, PCC_SOURCE);
  assert.equal(view.essentialityStatus, null);
  assert.equal(view.pccLocusTag, null);
});

test('GO IEA view carries GO relationships only, blank everything else', () => {
  const dataset = fixtureDataset();
  const view = annotationSourceView(fixtureGene(), dataset, GO_IEA_SOURCE);
  assert.equal(view.source, GO_IEA_SOURCE);
  assert.equal(view.product, null);
  assert.equal(view.essentialityStatus, null);
  assert.equal(view.goAnnotations.length, 1);
  assert.equal(view.goAnnotations[0].goId, 'GO:0000001');
});

test('a locus none of the sources cover comes back blank, not defaulted', () => {
  const dataset = { functionCategories: null, candidateEvidence: null };
  const gene = { id: 'g3' };
  for (const source of [UTEX_SOURCE, PCC_SOURCE, GO_IEA_SOURCE]) {
    const view = annotationSourceView(gene, dataset, source);
    assert.equal(view.product, null);
    assert.equal(view.essentialityStatus, null);
    assert.deepEqual(view.goAnnotations, []);
  }
});

test('all-sources view composes every source and matches direct field reads', () => {
  const dataset = fixtureDataset();
  const gene = fixtureGene();
  const view = annotationSourceView(gene, dataset, ALL_SOURCES);
  assert.equal(view.product, gene.product);
  assert.equal(view.name, gene.name);
  assert.equal(view.essentialityStatus, 'essential');
  assert.equal(view.pccLocusTag, 'Synpcc7942_0001');
  assert.equal(view.goAnnotations.length, 1);
  assert.equal(view.evidenceNote, null);
});

test('an unknown or unrecognised source id falls back to all', () => {
  const dataset = fixtureDataset();
  const gene = fixtureGene();
  const view = annotationSourceView(gene, dataset, 'not-a-source');
  assert.equal(view.source, ALL_SOURCES);
  assert.equal(view.product, gene.product);
});

test('the all-sources augmenter hook lets a later branch extend only the all view', (t) => {
  t.after(() => registerAllSourcesAugmenter(null));
  const dataset = fixtureDataset();
  const gene = fixtureGene();
  registerAllSourcesAugmenter((view) => ({ ...view, fallbackNote: 'go-iea fallback applied' }));
  const all = annotationSourceView(gene, dataset, ALL_SOURCES);
  assert.equal(all.fallbackNote, 'go-iea fallback applied');
  const utex = annotationSourceView(gene, dataset, UTEX_SOURCE);
  assert.equal(utex.fallbackNote, undefined);
  const pcc = annotationSourceView(gene, dataset, PCC_SOURCE);
  assert.equal(pcc.fallbackNote, undefined);
});
