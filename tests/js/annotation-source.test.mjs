import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANNOTATION_SOURCES, SOURCE_TOGGLES, DEFAULT_ANNOTATION_SOURCES, ALL_SOURCES, NO_SOURCES,
  UTEX_SOURCE, PCC_SOURCE, GO_IEA_SOURCE, isAnnotationSource, annotationSourceLabel,
  annotationSourceEvidenceNote, annotationSourceView, normalizeAnnotationSources,
  parseAnnotationSources, annotationSourceId, isAllSources, hasSource,
} from '../../site/js/core/annotation-source.js';

test('exposes three toggles, the combined id, and a fresh default with every toggle on', () => {
  assert.deepEqual(SOURCE_TOGGLES.map((s) => s.id), [UTEX_SOURCE, PCC_SOURCE, GO_IEA_SOURCE]);
  assert.deepEqual(ANNOTATION_SOURCES.map((s) => s.id), [ALL_SOURCES, UTEX_SOURCE, PCC_SOURCE, GO_IEA_SOURCE]);
  assert.deepEqual([...DEFAULT_ANNOTATION_SOURCES], [UTEX_SOURCE, PCC_SOURCE, GO_IEA_SOURCE]);
  assert.equal(isAnnotationSource('all'), true);
  assert.equal(isAnnotationSource('pcc-7942'), true);
  assert.equal(isAnnotationSource('nonsense'), false);
  assert.equal(annotationSourceLabel('pcc-7942'), 'PCC 7942');
  assert.equal(annotationSourceLabel('nonsense'), null);
});

test('normalisation accepts arrays, legacy single ids, all, and none, and drops unknown ids', () => {
  assert.deepEqual(normalizeAnnotationSources(undefined), [UTEX_SOURCE, PCC_SOURCE, GO_IEA_SOURCE]);
  assert.deepEqual(normalizeAnnotationSources(ALL_SOURCES), [UTEX_SOURCE, PCC_SOURCE, GO_IEA_SOURCE]);
  assert.deepEqual(normalizeAnnotationSources(NO_SOURCES), []);
  assert.deepEqual(normalizeAnnotationSources(PCC_SOURCE), [PCC_SOURCE]);
  assert.deepEqual(normalizeAnnotationSources('nonsense'), [UTEX_SOURCE, PCC_SOURCE, GO_IEA_SOURCE]);
  // Canonical order, deduplicated, unknown ids dropped.
  assert.deepEqual(normalizeAnnotationSources([GO_IEA_SOURCE, 'x', UTEX_SOURCE, GO_IEA_SOURCE]),
    [UTEX_SOURCE, GO_IEA_SOURCE]);
  assert.deepEqual(normalizeAnnotationSources([]), []);
});

test('the URL field parses lists, single ids, all, and none, and refuses pure nonsense', () => {
  assert.deepEqual(parseAnnotationSources('utex-2973,go-iea'), [UTEX_SOURCE, GO_IEA_SOURCE]);
  assert.deepEqual(parseAnnotationSources('go-iea'), [GO_IEA_SOURCE]);
  assert.deepEqual(parseAnnotationSources('all'), [UTEX_SOURCE, PCC_SOURCE, GO_IEA_SOURCE]);
  assert.deepEqual(parseAnnotationSources('none'), []);
  assert.equal(parseAnnotationSources('nonsense'), null);
  assert.equal(parseAnnotationSources(''), null);
  assert.equal(parseAnnotationSources(undefined), null);
});

test('one id names the enabled set and the label reads naturally', () => {
  assert.equal(annotationSourceId([UTEX_SOURCE, PCC_SOURCE, GO_IEA_SOURCE]), 'all');
  assert.equal(annotationSourceId([]), 'none');
  assert.equal(annotationSourceId([PCC_SOURCE]), 'pcc-7942');
  assert.equal(annotationSourceId([GO_IEA_SOURCE, UTEX_SOURCE]), 'utex-2973+go-iea');
  assert.equal(annotationSourceLabel([UTEX_SOURCE, PCC_SOURCE, GO_IEA_SOURCE]), 'All sources');
  assert.equal(annotationSourceLabel([]), 'No sources');
  assert.equal(annotationSourceLabel([PCC_SOURCE, GO_IEA_SOURCE]), 'PCC 7942 + GO IEA');
  assert.equal(annotationSourceLabel('utex-2973+go-iea'), 'UTEX 2973 + GO IEA');
  assert.equal(isAllSources([GO_IEA_SOURCE, PCC_SOURCE, UTEX_SOURCE]), true);
  assert.equal(isAllSources([PCC_SOURCE]), false);
  assert.equal(hasSource([PCC_SOURCE], PCC_SOURCE), true);
  assert.equal(hasSource('all', GO_IEA_SOURCE), true);
  assert.equal(hasSource([], UTEX_SOURCE), false);
});

test('each single source carries its own evidence/citation/licence wording; all has none', () => {
  assert.match(annotationSourceEvidenceNote(UTEX_SOURCE), /RefSeq/);
  assert.match(annotationSourceEvidenceNote(PCC_SOURCE), /cross-strain/);
  assert.match(annotationSourceEvidenceNote(PCC_SOURCE), /CC BY 4.0/);
  assert.match(annotationSourceEvidenceNote(PCC_SOURCE), /function category derived/);
  assert.match(annotationSourceEvidenceNote(GO_IEA_SOURCE), /Gene Ontology/);
  assert.equal(annotationSourceEvidenceNote(ALL_SOURCES), null);
  assert.equal(annotationSourceEvidenceNote([UTEX_SOURCE, PCC_SOURCE, GO_IEA_SOURCE]), null);
  assert.match(annotationSourceEvidenceNote([]), /No annotation source is enabled/);
  const two = annotationSourceEvidenceNote([PCC_SOURCE, GO_IEA_SOURCE]);
  assert.match(two, /cross-strain/);
  assert.match(two, /Gene Ontology/);
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
  const view = annotationSourceView(fixtureGene(), dataset, [UTEX_SOURCE]);
  assert.equal(view.source, UTEX_SOURCE);
  assert.deepEqual(view.sources, [UTEX_SOURCE]);
  assert.equal(view.product, '30S ribosomal protein S12');
  assert.equal(view.name, 'rpsL');
  assert.deepEqual(view.reviewedFunctionLabels, ['Stress and repair']);
  assert.equal(view.essentialityStatus, null);
  assert.equal(view.pccLocusTag, null);
  assert.deepEqual(view.goAnnotations, []);
  // The legacy single-id form still works for callers that kept it.
  assert.deepEqual(annotationSourceView(fixtureGene(), dataset, UTEX_SOURCE), view);
});

test('PCC view carries essentiality only, blank product/name/category/GO', () => {
  const dataset = fixtureDataset();
  const view = annotationSourceView(fixtureGene(), dataset, [PCC_SOURCE]);
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
  const view = annotationSourceView(fixtureGene({ id: 'g2' }), dataset, [PCC_SOURCE]);
  assert.equal(view.essentialityStatus, null);
  assert.equal(view.pccLocusTag, null);
});

test('GO IEA view carries GO relationships only, blank everything else', () => {
  const dataset = fixtureDataset();
  const view = annotationSourceView(fixtureGene(), dataset, [GO_IEA_SOURCE]);
  assert.equal(view.source, GO_IEA_SOURCE);
  assert.equal(view.product, null);
  assert.equal(view.essentialityStatus, null);
  assert.equal(view.goAnnotations.length, 1);
  assert.equal(view.goAnnotations[0].goId, 'GO:0000001');
});

test('two enabled sources compose their fields and blank the third', () => {
  const dataset = fixtureDataset();
  const view = annotationSourceView(fixtureGene(), dataset, [UTEX_SOURCE, GO_IEA_SOURCE]);
  assert.equal(view.source, 'utex-2973+go-iea');
  assert.equal(view.product, '30S ribosomal protein S12');
  assert.equal(view.goAnnotations.length, 1);
  assert.equal(view.essentialityStatus, null);
  assert.match(view.evidenceNote, /RefSeq/);
  assert.match(view.evidenceNote, /Gene Ontology/);
});

test('no enabled source leaves every field blank with the no-source note', () => {
  const view = annotationSourceView(fixtureGene(), fixtureDataset(), []);
  assert.equal(view.source, NO_SOURCES);
  assert.equal(view.product, null);
  assert.equal(view.essentialityStatus, null);
  assert.deepEqual(view.goAnnotations, []);
  assert.match(view.evidenceNote, /No annotation source is enabled/);
});

test('a locus none of the sources cover comes back blank, not defaulted', () => {
  const dataset = { functionCategories: null, candidateEvidence: null };
  const gene = { id: 'g3' };
  for (const source of [UTEX_SOURCE, PCC_SOURCE, GO_IEA_SOURCE]) {
    const view = annotationSourceView(gene, dataset, [source]);
    assert.equal(view.product, null);
    assert.equal(view.essentialityStatus, null);
    assert.deepEqual(view.goAnnotations, []);
  }
});

test('all-sources view composes every source and matches direct field reads', () => {
  const dataset = fixtureDataset();
  const gene = fixtureGene();
  const view = annotationSourceView(gene, dataset, [UTEX_SOURCE, PCC_SOURCE, GO_IEA_SOURCE]);
  assert.equal(view.source, ALL_SOURCES);
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
