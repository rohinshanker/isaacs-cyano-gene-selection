/** Validate inherited annotations before changing any in-memory gene. */
import { organismById } from './organisms.js';
export const EXACT_PROTEIN_METHOD = 'unique-full-length-identical-protein-v1';
const STATUSES = new Set(['exact-protein', 'ambiguous-protein', 'unsupported-protein',
  'modified-or-nonidentical-protein', 'unmatched']);

export function validateFunctionalTransfers(annotations, dataset) {
  const declaration = dataset.organism?.functionalAnnotations;
  if (declaration && !annotations) throw new Error('Transferred annotations.json is required');
  for (const gene of dataset.genes) {
    const evidence = annotations?.[gene.id];
    const transfer = evidence?.functionalTransfer;
    if (!transfer && !declaration) continue;
    const fail = () => { throw new Error(`Invalid functional transfer for ${gene.id}`); };
    if (!transfer || !declaration || transfer.schemaVersion !== 1
      || transfer.targetAssembly !== dataset.meta.genome?.accession
      || !STATUSES.has(transfer.status) || !Array.isArray(transfer.sources)
      || !Array.isArray(transfer.inheritedFields) || !Array.isArray(transfer.disagreements)
      || transfer.categoryStatus !== 'unknown-no-admitted-category'
      || !transfer.fields || Object.keys(transfer.fields).some((key) => !['name', 'product'].includes(key))) fail();
    const native = gene.annotationEvidence?.functionalTransfer?.native ?? gene;
    if (['id', 'name', 'product', 'seqid', 'start', 'end', 'strand']
      .some((key) => (native[key] ?? null) !== (transfer.native?.[key] ?? null))) fail();
    const hasInherited = transfer.inheritedFields.length > 0;
    if (hasInherited && (transfer.status !== 'exact-protein' || !transfer.sources.length)) fail();
    const sourceIds = transfer.sources.map((source) => source.organismId);
    if (sourceIds.some((id, index) => id !== declaration.referenceOrganismIds[index])
      || transfer.sources.length > declaration.referenceOrganismIds.length) fail();
    for (const source of transfer.sources) {
      if (source.method !== EXACT_PROTEIN_METHOD || source.identity !== 1 || source.coverage !== 1
        || !source.locusTag || source.assembly !== organismById(source.organismId)?.genome.accession
        || !source.recordRelease?.length
        || !/^[a-f0-9]{64}$/.test(source.sha256)
        || !/^[a-f0-9]{64}$/.test(source.proteinSha256)
        || source.proteinSha256 !== transfer.sources[0].proteinSha256) fail();
    }
    for (const [key, value] of Object.entries(transfer.fields)) {
      if (typeof value !== 'string' || !value || !transfer.inheritedFields.includes(key)
        || (transfer.native[key] && !(key === 'name' && transfer.native.name === gene.id)
          && !(key === 'product' && transfer.nativeProduct === null
            && transfer.native.product === 'uncharacterized design CDS'))) fail();
    }
    if (!Array.isArray(evidence.goAnnotations)) fail();
    if (((evidence.goAnnotations.length && evidence.goAnnotationsOrigin !== 'native-source') || evidence.curatedFunction)
      && (sourceIds.at(-1) !== 'ecoli-k12-mg1655'
        || transfer.annotationRelease !== 'GCF_000005845.2-UniProtGOA_2026-07-28')) fail();
    if (evidence.goAnnotations.some((row) => !/^GO:\d{7}$/.test(row.goId)
      || !row.evidenceCode || row.mappingAmbiguity)) fail();
    const expectedFields = [...Object.keys(transfer.fields),
      ...(evidence.goAnnotations.length && evidence.goAnnotationsOrigin !== 'native-source' ? ['goAnnotations'] : []),
      ...(evidence.curatedFunction ? ['curatedFunction'] : [])];
    if (expectedFields.length !== transfer.inheritedFields.length
      || expectedFields.some((key) => !transfer.inheritedFields.includes(key))) fail();
    if (evidence.goAnnotationsOrigin === 'native-source'
      && (transfer.nativeGoCount !== evidence.goAnnotations.length
        || evidence.nativeAnnotation?.source?.assembly !== transfer.targetAssembly
        || evidence.goAnnotations.some((row) => row.mappingMethod !== 'native GenBank CDS note'))) fail();
  }
}

export function joinFunctionalTransfers(annotations, dataset) {
  validateFunctionalTransfers(annotations, dataset);
  for (const gene of dataset.genes) {
    const evidence = annotations[gene.id];
    const transfer = evidence.functionalTransfer;
    if (!transfer) {
      gene.annotationEvidence = evidence;
      continue;
    }
    // Existing direct fields always win. Keep their native values in the
    // provenance record even when a missing display field is filled.
    for (const [key, value] of Object.entries(transfer.fields)) {
      if (!gene[key] || (key === 'name' && gene.name === gene.id)
        || (key === 'product' && transfer.nativeProduct === null && gene.product === 'uncharacterized design CDS')) gene[key] = value;
    }
    const previous = gene.annotationEvidence;
    gene.annotationEvidence = { ...evidence, ...previous, functionalTransfer: transfer,
      goAnnotations: previous?.goAnnotations?.length ? previous.goAnnotations : evidence.goAnnotations,
      curatedFunction: previous?.curatedFunction ?? evidence.curatedFunction };
  }
}
