/** Keep tested UTEX alleles and borrowed PCC calls as separate evidence tiers. */
export function validateCandidateEvidence(data, genes, releaseId) {
  if (!data || data.schemaVersion !== 1 || data.annotationRelease !== releaseId) {
    throw new Error('Candidate evidence release does not match the annotated genes');
  }
  const borrowed = data.borrowedEssentiality;
  if (borrowed?.status !== 'available' || !borrowed.source
      || !borrowed.byLocus || typeof borrowed.byLocus !== 'object') {
    throw new Error('Candidate evidence requires admitted, source-labelled PCC calls');
  }
  for (const field of ['adomakoDoi', 'rubinDoi', 'growthDoi', 'rubinCondition']) {
    if (typeof borrowed.source[field] !== 'string' || !borrowed.source[field]) {
      throw new Error(`PCC source is missing ${field}`);
    }
  }
  const known = new Set(genes.map((gene) => gene.id));
  const calls = borrowed.byLocus;
  if (Object.keys(calls).length !== known.size) {
    throw new Error('PCC essentiality must represent every current UTEX CDS');
  }
  const statuses = new Set([
    'essential', 'beneficial', 'non-essential', 'ambiguous', 'not_analyzed', 'missing',
    'unknown',
  ]);
  for (const [id, call] of Object.entries(calls)) {
    if (!known.has(id) || !statuses.has(call?.status)
        || typeof call.mappingStatus !== 'string'
        || (call.status !== 'unknown'
          && (call.mappingStatus !== 'accepted' || !call.pccLocusTag))
        || (call.status === 'unknown' && call.mappingStatus === 'accepted')) {
      throw new Error(`Invalid borrowed PCC call ${id}`);
    }
  }
  const alleles = Object.entries(data.testedAlleles ?? {});
  if (alleles.length !== 3) throw new Error('Expected three admitted UTEX tested alleles');
  for (const [id, allele] of alleles) {
    if (!known.has(id) || !allele.evidenceId || !allele.claim || !allele.proteinId) {
      throw new Error(`Invalid tested allele ${id}`);
    }
  }
  return data;
}

export function candidateEvidenceFor(data, locusId) {
  if (!data) return null;
  return {
    tested: data.testedAlleles[locusId] ?? null,
    testedSource: data.testedSource,
    borrowedEssentiality: data.borrowedEssentiality,
    pccCall: data.borrowedEssentiality.byLocus[locusId] ?? null,
  };
}
