/**
 * Compact presentation model for release-pinned annotation evidence.
 *
 * The raw relationships stay intact in genes.json. This module only gives the
 * detail panel readable labels; it never promotes GO terms into categories or
 * turns coordinate proximity into a regulatory claim.
 */

const ASPECT_LABELS = Object.freeze({
  F: 'molecular function',
  P: 'biological process',
  C: 'cellular component',
});

/** Return a display-ready model, or null for an older dataset without evidence. */
export function annotationEvidenceModel(gene, meta = {}) {
  const evidence = gene?.annotationEvidence;
  if (!evidence || typeof evidence !== 'object') return null;
  const overlaps = Array.isArray(evidence.overlappingCds) ? evidence.overlappingCds : [];
  const nearby = Array.isArray(evidence.nearbyNoncodingRnas)
    ? evidence.nearbyNoncodingRnas : [];
  const go = Array.isArray(evidence.goAnnotations) ? evidence.goAnnotations : [];
  const methods = Array.isArray(evidence.annotationMethods) ? evidence.annotationMethods : [];
  const inferences = Array.isArray(evidence.inferences) ? evidence.inferences : [];
  const release = meta.annotationRelease ?? {};
  return {
    releaseId: release.releaseId ?? evidence.releaseId ?? 'release not recorded',
    replicon: [evidence.repliconType, evidence.repliconName]
      .filter(Boolean).filter((value, index, values) => values.indexOf(value) === index)
      .join(' — ') || 'not recorded',
    methods,
    inferences,
    overlaps: overlaps.map((entry) => ({
      locusTag: entry.locusTag,
      text: `${entry.locusTag} (${entry.overlapNt} shared nt)`,
    })),
    nearby: nearby.map((entry) => ({
      locusTag: entry.locusTag,
      text: `${entry.locusTag} — ${entry.biotype}, ${entry.distanceNt} nt away`,
    })),
    go: go.map((entry) => ({
      ...entry,
      aspectLabel: ASPECT_LABELS[entry.aspect] ?? entry.aspect ?? 'aspect not recorded',
      text: `${entry.goId} · ${entry.qualifier || 'relation not recorded'} · `
        + `${ASPECT_LABELS[entry.aspect] ?? entry.aspect ?? 'aspect not recorded'} · `
        + `${entry.evidenceCode || 'evidence not recorded'}`
        + `${entry.reference ? ` · ${entry.reference}` : ''}`
        + `${entry.withFrom ? ` · ${entry.withFrom}` : ''}`
        + `${entry.mappingMethod ? ` · via ${entry.mappingMethod}` : ''}`
        + `${entry.mappingAmbiguity ? ` · ${entry.mappingAmbiguity}` : ''}`,
    })),
    attribution: release.goAttribution ?? null,
  };
}
