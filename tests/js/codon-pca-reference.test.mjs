import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCodonPcaReference } from '../../site/js/core/codon-pca-reference.js';
import { organismById } from '../../site/js/core/organisms.js';
import {
  buildProjection, panelName, panelsFor,
} from '../../site/js/ui/panels.js';

const SYN61 = organismById('ecoli-syn61-delta3-ev5');
const MDS42 = organismById('ecoli-mds42-public-reference');
const DATA = new URL('../../site/data/organisms/ecoli-syn61-delta3-ev5/', import.meta.url);

const [artifact, meta, genes] = await Promise.all([
  readFile(new URL('codon_pca_reference.json', DATA), 'utf8').then(JSON.parse),
  readFile(new URL('meta.json', DATA), 'utf8').then(JSON.parse),
  readFile(new URL('genes.json', DATA), 'utf8').then(JSON.parse),
]);

function dataset(document = artifact) {
  return {
    organism: SYN61,
    meta,
    genes,
    codonPcaReference: document,
  };
}

test('the shipped child-local artifact exactly matches Syn61 and its declared public parent', () => {
  assert.equal(validateCodonPcaReference(artifact, dataset(), SYN61), artifact);
  assert.equal(artifact.relationship.parent.genomeAccession, 'GCF_000350185.1');
  assert.match(artifact.relationship.provenance.description, /public MDS42 AP012306\.1/i);
  assert.match(artifact.relationship.provenance.description, /differs from the 2026 study stock/i);
  assert.equal(artifact.geneIds.length, genes.length);
  assert.equal(artifact.coordinates.length, genes.length);
});

test('the browser refuses identity, order, numeric, and relationship corruption', () => {
  const cases = [
    [(copy) => { copy.relationship.type = 'similar-strain'; }, /recoded-derivative/],
    [(copy) => { copy.relationship.parent.genomeAccession = 'WRONG'; }, /parent.*not declared/],
    [(copy) => { copy.child.genomeAccession = 'WRONG'; }, /child identity/],
    [(copy) => { copy.geneIds[0] = 'wrong-gene'; }, /geneIds.*exact order/],
    [(copy) => { copy.reference.transform.featureOrder.reverse(); }, /featureOrder.*exact order/],
    [(copy) => { copy.reference.transform.scaler.scale[0] = 0; }, /positive values/],
    [(copy) => { copy.coordinates[0][0] = Number.NaN; }, /finite values/],
    [(copy) => { copy.reference.loadings[0].pc[0] += 1; }, /component matrix/],
  ];
  for (const [mutate, pattern] of cases) {
    const copy = structuredClone(artifact);
    mutate(copy);
    assert.throws(() => validateCodonPcaReference(copy, dataset(copy), SYN61), pattern);
  }
});

test('the optional panel uses the artifact coordinate matrix and keeps native as the default', () => {
  assert.deepEqual(panelsFor(MDS42).map((panel) => panel.id).includes('reference'), false);
  const synPanels = panelsFor(SYN61);
  assert.equal(synPanels[0].id, 'native');
  const referencePanel = synPanels.find((panel) => panel.id === 'reference');
  assert.equal(panelName(referencePanel, SYN61), 'MDS42 public-reference codon space');

  const projection = buildProjection('reference', {
    dataset: dataset(), registry: { byKey: new Map() }, schemeActive: false,
  });
  assert.equal(projection.available, true);
  assert.equal(projection.x[0], artifact.coordinates[0][0]);
  assert.equal(projection.y.at(-1), artifact.coordinates.at(-1)[1]);
  assert.deepEqual(projection.loadings[0].pc, artifact.reference.loadings[0].pc);
  assert.match(projection.loadingNote, /do not measure fitness or expression/i);
});
