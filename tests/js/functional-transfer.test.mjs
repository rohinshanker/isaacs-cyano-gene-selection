import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { joinFunctionalTransfers, validateFunctionalTransfers } from '../../site/js/core/functional-transfer.js';
import { DATA_APPLIERS, buildCoreDataset } from '../../site/js/core/dataset.js';
import { buildMetricRegistry } from '../../site/js/core/metric-registry.js';
import { buildExport } from '../../site/js/core/export-manifest.js';
import { ORGANISMS } from '../../site/js/core/organisms.js';
import { searchGenes } from '../../site/js/core/gene-search.js';
import { annotationEvidenceModel } from '../../site/js/core/annotation-evidence.js';
import { passesCategoryFilter } from '../../site/js/core/function-categories.js';

const read = async (org, file) => JSON.parse(await readFile(
  new URL(`../../site/data/organisms/${org}/${file}`, import.meta.url), 'utf8'));
const declaration = { referenceOrganismIds: ['ecoli-k12-mg1655'] };

function fixture() {
  const gene = { id: 'target', name: null, product: 'native product', start: 10, end: 30,
    seqid: 'target-sequence', strand: '+' };
  const source = { organismId: 'ecoli-k12-mg1655', assembly: 'GCF_000005845.2',
    locusTag: 'b0001', method: 'unique-full-length-identical-protein-v1', identity: 1, coverage: 1,
    sha256: 'a'.repeat(64), proteinSha256: 'b'.repeat(64), recordRelease: [{ sequence: 'NC_000913.3' }] };
  const annotations = { target: { goAnnotations: [{ goId: 'GO:0000001', evidenceCode: 'IDA', mappingAmbiguity: '' }],
    curatedFunction: null, functionalTransfer: { schemaVersion: 1, targetAssembly: 'target-assembly',
      status: 'exact-protein', native: { ...gene }, sources: [source], fields: { name: 'symbol' },
      disagreements: [], inheritedFields: ['name', 'goAnnotations'],
      annotationRelease: 'GCF_000005845.2-UniProtGOA_2026-07-28',
      categoryStatus: 'unknown-no-admitted-category' } } };
  const dataset = { genes: [gene], organism: { functionalAnnotations: declaration },
    meta: { genome: { accession: 'target-assembly' } } };
  return { dataset, annotations, gene, transfer: annotations.target.functionalTransfer };
}

test('transfer fills missing display symbol, preserves native identity and direct GO, and is retry-safe', () => {
  const { dataset, annotations, gene, transfer } = fixture();
  const direct = [{ goId: 'GO:0000002', evidenceCode: 'IDA' }];
  gene.annotationEvidence = { goAnnotations: direct, curatedFunction: { accession: 'direct' } };
  joinFunctionalTransfers(annotations, dataset);
  assert.equal(gene.name, 'symbol');
  assert.equal(gene.product, 'native product');
  assert.equal(gene.start, 10);
  assert.equal(transfer.native.name, null);
  assert.equal(gene.annotationEvidence.goAnnotations, direct);
  assert.equal(gene.annotationEvidence.curatedFunction.accession, 'direct');
  joinFunctionalTransfers(annotations, dataset);
  assert.equal(gene.name, 'symbol');
});

test('malformed joins fail atomically and cannot write over native fields', () => {
  for (const mutate of [
    (t) => { t.targetAssembly = 'other'; },
    (t) => { t.status = 'ambiguous-protein'; },
    (t) => { t.sources[0].identity = 0.99; },
    (t) => { t.sources[0].proteinSha256 = 'invalid'; },
    (t) => { t.sources[0].organismId = 'other'; },
    (t) => { t.fields.product = 'overwrite'; },
    (t) => { t.fields.category = 'invented'; },
    (t) => { t.native.start = 11; },
    (t) => { t.annotationRelease = 'other'; },
  ]) {
    const { dataset, annotations, gene, transfer } = fixture();
    mutate(transfer);
    assert.throws(() => DATA_APPLIERS.annotations(dataset, annotations), /Invalid functional transfer/);
    assert.equal(gene.name, null);
    assert.equal(gene.annotationEvidence, undefined);
  }
  const { dataset, annotations, gene } = fixture();
  dataset.genes.push({ ...gene, id: 'second' });
  assert.throws(() => DATA_APPLIERS.annotations(dataset, annotations), /Invalid functional transfer/);
  assert.equal(gene.name, null);
});

test('declared recoded annotations are required; conventional annotations retain their contract', () => {
  const { dataset } = fixture();
  assert.throws(() => DATA_APPLIERS.annotations(dataset, null), /required/);
  for (const organism of ORGANISMS.filter((o) => !o.functionalAnnotations)) {
    const conventional = { genes: [{ id: 'native', name: 'original', product: 'original' }], meta: {}, organism };
    const evidence = { native: { goAnnotations: [{ goId: 'GO:0000001' }] } };
    DATA_APPLIERS.annotations(conventional, evidence);
    assert.equal(conventional.genes[0].annotationEvidence, evidence.native);
    assert.equal(conventional.genes[0].name, 'original');
    validateFunctionalTransfers(null, conventional);
  }
});

test('inherited-field labels distinguish UniProt metadata from an actual function description', () => {
  const { annotations, gene } = fixture();
  annotations.target.functionalTransfer.inheritedFields.push('curatedFunction');
  annotations.target.curatedFunction = { accession: 'P00001', function: [] };
  gene.annotationEvidence = annotations.target;
  assert.deepEqual(annotationEvidenceModel(gene).inheritedFieldLabels, ['Gene symbol', 'GO evidence', 'UniProt entry']);
  annotations.target.curatedFunction.function.push('A reference function description.');
  assert.deepEqual(annotationEvidenceModel(gene).inheritedFieldLabels, ['Gene symbol', 'GO evidence', 'UniProt entry', 'Curated function description']);
});

for (const organism of ORGANISMS.filter((o) => o.functionalAnnotations)) {
  test(`${organism.id}: admitted symbols and GO are searchable; categories remain unavailable`, async () => {
    const genes = await read(organism.id, 'genes.json');
    const meta = await read(organism.id, 'meta.json');
    const annotations = await read(organism.id, 'annotations.json');
    const names = await read(organism.id, 'go-term-names-v1.json');
    const dataset = buildCoreDataset(meta, genes, null);
    dataset.organism = organism;
    DATA_APPLIERS.annotations(dataset, annotations);
    DATA_APPLIERS.goTerms(dataset, names);
    for (const gene of genes) {
      const t = gene.annotationEvidence.functionalTransfer;
      assert.equal(gene.start, t.native.start);
      assert.equal(gene.end, t.native.end);
      assert.equal(gene.product, t.fields.product ?? t.native.product);
      if (t.fields.name) {
        const hits = searchGenes(genes, t.fields.name, { limit: Infinity });
        assert.ok(hits.shown.some((hit) => hit.gene.id === gene.id));
      }
    }
    const gene = genes.find((g) => g.annotationEvidence.goAnnotations.length > 0);
    const go = gene.annotationEvidence.goAnnotations[0];
    for (const query of [go.goId, names.terms[go.goId].name]) {
      const hits = searchGenes(genes, query, { goTerms: names.terms, limit: Infinity });
      assert.ok(hits.shown.some((hit) => hit.gene.id === gene.id));
    }
    const model = annotationEvidenceModel(gene, meta, names.terms);
    assert.equal(model.functionalTransfer, gene.annotationEvidence.functionalTransfer);
    assert.match(model.go[0].text, /via UniProtKB ordered locus/);
    assert.deepEqual(organism.annotationSources, []);
    assert.equal(organism.layers.functionCategories, undefined);
    assert.equal(passesCategoryFilter(null, 0, ['carbon-and-nutrient-metabolism']), true);
    const registry = buildMetricRegistry(meta, genes, dataset.baseline);
    const { manifest } = buildExport({ dataset, registry, ids: [gene.id], schemes: [{ map: {} }],
      viewState: { goTerm: go.goId, goEvidenceFilter: 'positive', colorBy: 'goTermEvidence' } });
    assert.deepEqual(manifest.genes[0].functionalAnnotationTransfer, gene.annotationEvidence.functionalTransfer);
    assert.deepEqual(manifest.genes[0].nativeAnnotation, gene.annotationEvidence.nativeAnnotation);
    assert.equal(manifest.genes[0].selectedGoTermEvidence.term, go.goId);
    assert.equal(manifest.genes[0].selectedGoTermEvidence.state, 'positive');
    assert.equal(manifest.viewState.goEvidenceFilter, 'positive');
  });
}
