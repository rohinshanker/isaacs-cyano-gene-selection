import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { annotationEvidenceModel } from '../../site/js/core/annotation-evidence.js';
import { loadDataset } from '../../site/js/core/dataset.js';
import { fileFetch, FIXTURE_DIR } from './helpers.mjs';

test('annotation evidence retains risk relationships and evidence-coded GO semantics', () => {
  const gene = {
    annotationEvidence: {
      releaseId: 'release-1',
      repliconType: 'plasmid',
      repliconName: 'unnamed',
      annotationMethods: ['Protein Homology'],
      inferences: ['similar to RefSeq:WP_1'],
      overlappingCds: [{ locusTag: 'gene-b', overlapNt: 7 }],
      nearbyNoncodingRnas: [{ locusTag: 'rna-a', biotype: 'tRNA', distanceNt: 8 }],
      goAnnotations: [{
        goId: 'GO:0000001', qualifier: 'enables', aspect: 'F', evidenceCode: 'IEA',
        reference: 'PMID:1', withFrom: 'HMM:1', mappingMethod: 'exact protein id',
        mappingAmbiguity: '',
      }],
    },
  };
  const attribution = { creator: 'Gene Ontology Consortium', license: 'CC BY 4.0' };
  const model = annotationEvidenceModel(gene, {
    annotationRelease: { releaseId: 'release-1', goAttribution: attribution },
  });

  assert.equal(model.releaseId, 'release-1');
  assert.equal(model.replicon, 'plasmid — unnamed');
  assert.match(model.overlaps[0].text, /7 shared nt/);
  assert.match(model.nearby[0].text, /tRNA, 8 nt away/);
  assert.match(model.go[0].text, /molecular function · IEA/);
  assert.match(model.go[0].text, /PMID:1 · HMM:1 · via exact protein id/);
  assert.equal(model.attribution, attribution);
  const withName = annotationEvidenceModel(gene, {}, {
    'GO:0000001': { name: 'example process', isObsolete: true },
  });
  assert.match(withName.go[0].text, /example process \[obsolete ID in pinned GO name release\]/);
});

test('annotation evidence is optional and malformed lists stay explicit and empty', () => {
  assert.equal(annotationEvidenceModel({}, {}), null);
  const model = annotationEvidenceModel({ annotationEvidence: {
    repliconType: 'chromosome', annotationMethods: null, goAnnotations: {},
  } });
  assert.equal(model.replicon, 'chromosome');
  assert.deepEqual(model.methods, []);
  assert.deepEqual(model.go, []);
});

test('the dataset loader joins declared annotation evidence by exact locus tag', async () => {
  const meta = JSON.parse(await readFile(`${FIXTURE_DIR}/meta.json`, 'utf8'));
  const genes = JSON.parse(await readFile(`${FIXTURE_DIR}/genes.json`, 'utf8'));
  meta.annotationRelease = { releaseId: 'fixture-release' };
  const annotations = Object.fromEntries(genes.map((gene) => [gene.id, {
    repliconType: 'chromosome', goAnnotations: [],
  }]));
  const fallback = fileFetch();
  const fetchImpl = async (url) => {
    if (url.endsWith('meta.json')) return { ok: true, json: async () => meta };
    if (url.endsWith('genes.json')) return { ok: true, json: async () => genes };
    if (url.endsWith('annotations.json')) return { ok: true, json: async () => annotations };
    return fallback(url);
  };
  const dataset = await loadDataset({ baseUrl: `file://${FIXTURE_DIR}/`, fetchImpl });
  assert.equal(dataset.genes[0].annotationEvidence, annotations[dataset.genes[0].id]);

  delete annotations[genes[0].id];
  await assert.rejects(
    loadDataset({ baseUrl: `file://${FIXTURE_DIR}/`, fetchImpl }),
    new RegExp(`annotations.json has no evidence for ${genes[0].id}`),
  );
});

test('GO names must cover every joined relation when a name lookup is present', async () => {
  const meta = JSON.parse(await readFile(`${FIXTURE_DIR}/meta.json`, 'utf8'));
  const genes = JSON.parse(await readFile(`${FIXTURE_DIR}/genes.json`, 'utf8'));
  meta.annotationRelease = { releaseId: 'fixture-release' };
  const annotations = Object.fromEntries(genes.map((gene) => [gene.id, {
    goAnnotations: gene.id === genes[0].id ? [{ goId: 'GO:0009522' }] : [],
  }]));
  const lookup = { schemaVersion: 1, terms: {
    'GO:0009522': { name: 'photosystem I', isObsolete: false },
  } };
  const fallback = fileFetch();
  const fetchImpl = async (url) => {
    if (url.endsWith('meta.json')) return { ok: true, json: async () => meta };
    if (url.endsWith('genes.json')) return { ok: true, json: async () => genes };
    if (url.endsWith('annotations.json')) return { ok: true, json: async () => annotations };
    if (url.endsWith('go-term-names-v1.json')) return { ok: true, json: async () => lookup };
    return fallback(url);
  };
  const dataset = await loadDataset({ baseUrl: `file://${FIXTURE_DIR}/`, fetchImpl });
  assert.equal(dataset.goTerms.terms['GO:0009522'].name, 'photosystem I');
  delete lookup.terms['GO:0009522'];
  await assert.rejects(loadDataset({ baseUrl: `file://${FIXTURE_DIR}/`, fetchImpl }),
    /go-term-names-v1.json has no name for GO:0009522/);
});
