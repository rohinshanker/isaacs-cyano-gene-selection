/** Validation for a child-local projection onto a fixed parent codon-PCA frame. */

function object(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value;
}

function text(value, path) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${path} must be non-empty`);
  return value;
}

function positiveInteger(value, path) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${path} must be a positive integer`);
  return value;
}

function finiteVector(value, path, length, { positive = false, nonNegative = false } = {}) {
  if (!Array.isArray(value) || value.length !== length) {
    throw new Error(`${path} must contain exactly ${length} values`);
  }
  if (!value.every((entry) => Number.isFinite(entry))) {
    throw new Error(`${path} must contain only finite values`);
  }
  if (positive && !value.every((entry) => entry > 0)) {
    throw new Error(`${path} must contain only positive values`);
  }
  if (nonNegative && !value.every((entry) => entry >= 0)) {
    throw new Error(`${path} must contain only non-negative values`);
  }
  return value;
}

function sameArray(actual, expected, path) {
  if (!Array.isArray(actual) || actual.length !== expected.length
      || actual.some((value, index) => value !== expected[index])) {
    throw new Error(`${path} must match the child dataset in exact order`);
  }
}

function sourceArtifact(value, path) {
  const artifact = object(value, path);
  text(artifact.file, `${path}.file`);
  positiveInteger(artifact.bytes, `${path}.bytes`);
  if (typeof artifact.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(artifact.sha256)) {
    throw new Error(`${path}.sha256 must be a lowercase SHA-256 digest`);
  }
}

/**
 * Refuse a reference projection unless its identity, order, shape, and values
 * are exactly the child dataset and relationship the organism record declares.
 */
export function validateCodonPcaReference(document, dataset, organism = dataset?.organism) {
  const root = object(document, 'codon_pca_reference.json');
  const declared = organism?.referenceCodonPca;
  if (!declared) throw new Error('this organism does not declare a parent-reference codon PCA');
  if (root.schemaVersion !== 1 || root.projectionType !== 'fixed-parent-codon-pca') {
    throw new Error('codon_pca_reference.json has an unsupported schema or projection type');
  }

  const relationship = object(root.relationship, 'relationship');
  if (relationship.type !== 'recoded-derivative') {
    throw new Error('relationship.type must be recoded-derivative');
  }
  const parent = object(relationship.parent, 'relationship.parent');
  const child = object(relationship.child, 'relationship.child');
  const provenance = object(relationship.provenance, 'relationship.provenance');
  for (const field of ['recodingScheme', 'segmentSet', 'source', 'description']) {
    text(provenance[field], `relationship.provenance.${field}`);
  }
  for (const [field, expected] of Object.entries({
    organismId: declared.parentOrganismId,
    label: declared.parentLabel,
    genomeAccession: declared.parentGenomeAccession,
  })) {
    if (parent[field] !== expected) throw new Error(`relationship.parent.${field} is not declared`);
  }
  if (child.organismId !== organism.id || child.label !== declared.childLabel
      || child.genomeAccession !== dataset.meta.genome.accession) {
    throw new Error('relationship.child does not match the organism and loaded genome');
  }

  const reference = object(root.reference, 'reference');
  const genome = object(reference.genome, 'reference.genome');
  for (const [field, expected] of Object.entries({
    organismId: declared.parentOrganismId,
    label: declared.parentLabel,
    genomeAccession: declared.parentGenomeAccession,
    taxid: declared.parentTaxid,
  })) {
    if (genome[field] !== expected) throw new Error(`reference.genome.${field} is not declared`);
  }
  sourceArtifact(reference.sourceArtifact, 'reference.sourceArtifact');
  const nComponents = positiveInteger(reference.nComponents, 'reference.nComponents');
  finiteVector(reference.explainedVariance, 'reference.explainedVariance', nComponents,
    { nonNegative: true });

  const transform = object(reference.transform, 'reference.transform');
  const featureOrder = dataset.meta.rscuOrder ?? [];
  sameArray(transform.featureOrder, featureOrder, 'reference.transform.featureOrder');
  const width = featureOrder.length;
  const scaler = object(transform.scaler, 'reference.transform.scaler');
  finiteVector(scaler.mean, 'reference.transform.scaler.mean', width);
  finiteVector(scaler.scale, 'reference.transform.scaler.scale', width, { positive: true });
  const pca = object(transform.pca, 'reference.transform.pca');
  finiteVector(pca.mean, 'reference.transform.pca.mean', width);
  if (!Array.isArray(pca.components) || pca.components.length !== nComponents) {
    throw new Error('reference.transform.pca.components has the wrong component count');
  }
  pca.components.forEach((row, index) => finiteVector(
    row, `reference.transform.pca.components[${index}]`, width,
  ));

  if (!Array.isArray(reference.loadings) || reference.loadings.length !== width) {
    throw new Error('reference.loadings must contain one row per RSCU feature');
  }
  reference.loadings.forEach((loading, feature) => {
    object(loading, `reference.loadings[${feature}]`);
    if (loading.codon !== featureOrder[feature]) {
      throw new Error('reference.loadings must follow the child RSCU feature order');
    }
    text(loading.aa, `reference.loadings[${feature}].aa`);
    finiteVector(loading.pc, `reference.loadings[${feature}].pc`, nComponents);
    for (let component = 0; component < nComponents; component += 1) {
      if (loading.pc[component] !== pca.components[component][feature]) {
        throw new Error('reference.loadings disagree with the executable component matrix');
      }
    }
  });

  const childRecord = object(root.child, 'child');
  if (childRecord.organismId !== organism.id || childRecord.label !== declared.childLabel
      || childRecord.genomeAccession !== dataset.meta.genome.accession
      || childRecord.taxid !== dataset.meta.genome.taxid
      || childRecord.totalLength !== dataset.meta.genome.totalLength) {
    throw new Error('child identity does not match the loaded dataset');
  }
  sourceArtifact(childRecord.rscuSourceArtifact, 'child.rscuSourceArtifact');
  sameArray(root.geneIds, dataset.genes.map((gene) => gene.id), 'geneIds');
  if (!Array.isArray(root.coordinates) || root.coordinates.length !== root.geneIds.length) {
    throw new Error('coordinates must contain one row per gene');
  }
  root.coordinates.forEach((row, index) => finiteVector(
    row, `coordinates[${index}]`, nComponents,
  ));
  return root;
}
