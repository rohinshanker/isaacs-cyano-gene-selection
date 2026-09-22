/** Evidence tiers shown in candidate review, with no strain-level transfer. */
export function validateCandidateEvidence(data, genes, releaseId) {
  if (!data || data.schemaVersion !== 1 || data.annotationRelease !== releaseId) {
    throw new Error('Candidate evidence release does not match the annotated genes');
  }
  if (data.borrowedEssentiality?.status !== 'unavailable') {
    throw new Error('PCC essentiality must remain unavailable without admitted locus data');
  }
  const known = new Set(genes.map((gene) => gene.id));
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
  };
}
