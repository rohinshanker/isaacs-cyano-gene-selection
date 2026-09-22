/**
 * GO IEA essentiality context: the lowest evidence tier above unknown.
 *
 * Precedence is tested UTEX allele > admitted PCC 7942 call > GO IEA context >
 * unknown. The GO tier is computational inference from IEA terms, never a
 * knockout result, and the panel objective never reads it. The pinned file is
 * checked against candidate evidence so a stale tier cannot load.
 */

export const EVIDENCE_TIERS = Object.freeze([
  'tested-utex-allele', 'admitted-pcc-call', 'go-iea-context', 'unknown',
]);

export const TIER_LABELS = Object.freeze({
  'tested-utex-allele': 'Tested UTEX 2973 allele',
  'admitted-pcc-call': 'Borrowed PCC 7942 call',
  'go-iea-context': 'GO IEA context (computational)',
  unknown: 'Unknown',
});

/**
 * Pinned in docs/validation/go-iea-essentiality-context.md. Held here so a
 * label is re-derived from its probability instead of trusted.
 */
export const THRESHOLDS = Object.freeze({
  coreProbabilityAtLeast: 0.9,
  notCoreProbabilityAtMost: 0.2,
  discrepancyProbabilityAtLeast: 0.8,
});

const DETERMINATE_PCC = new Set(['essential', 'beneficial', 'non-essential']);
const JUDGED_DISCREPANCIES = new Set(['utex-product', 'pcc7942-product', 'reviewed-category']);

/** Apply the published precedence to one locus. */
export function resolveEssentialityTier({ tested, pccStatus, goLabel }) {
  if (tested) return 'tested-utex-allele';
  if (DETERMINATE_PCC.has(pccStatus)) return 'admitted-pcc-call';
  if (goLabel === 'core-cellular-process') return 'go-iea-context';
  return 'unknown';
}

/** Apply the pinned core-process thresholds to one probability. */
export function contextLabelFor(pCore) {
  if (pCore >= THRESHOLDS.coreProbabilityAtLeast) return 'core-cellular-process';
  if (pCore <= THRESHOLDS.notCoreProbabilityAtMost) return 'not-core';
  return 'uncertain';
}

/** True when one discrepancy entry meets the pinned threshold or PCC-call rule. */
function discrepancyIsValid(entry, context, pccStatus) {
  if (!entry || !context || typeof entry.note !== 'string' || !entry.note) return false;
  if (entry.kind === 'pcc7942-call') {
    return entry.probability === null && context.label === 'core-cellular-process'
      && pccStatus === 'non-essential';
  }
  return JUDGED_DISCREPANCIES.has(entry.kind) && Number.isFinite(entry.probability)
    && entry.probability >= THRESHOLDS.discrepancyProbabilityAtLeast;
}

/** Validate the pinned file against the plotted genes and candidate evidence. */
export function validateGoIeaEssentiality(data, genes, candidateEvidence, releaseId) {
  if (!data || data.schemaVersion !== 1 || data.datasetVersion !== 'go-iea-essentiality-v1'
    || data.annotationRelease !== releaseId) {
    throw new Error('GO IEA essentiality release does not match the annotated genes');
  }
  if (data.attribution?.license !== 'CC BY 4.0'
    || data.attribution?.creator !== 'Gene Ontology Consortium') {
    throw new Error('GO IEA essentiality must carry Gene Ontology CC BY 4.0 attribution');
  }
  if (JSON.stringify(data.policy?.precedence) !== JSON.stringify(EVIDENCE_TIERS)) {
    throw new Error('GO IEA essentiality precedence differs from the site contract');
  }
  const thresholds = data.policy?.thresholds ?? {};
  if (Object.keys(THRESHOLDS).some((key) => thresholds[key] !== THRESHOLDS[key])) {
    throw new Error('GO IEA essentiality thresholds differ from the site contract');
  }
  const calls = candidateEvidence?.borrowedEssentiality?.byLocus;
  if (!calls) throw new Error('GO IEA essentiality requires candidate evidence');
  const rows = data.byLocus ?? {};
  if (Object.keys(rows).length !== genes.length) {
    throw new Error('GO IEA essentiality must represent every current UTEX CDS');
  }
  for (const { id } of genes) {
    const row = rows[id];
    const context = row?.goContext;
    if (!row || (context !== null && (!Number.isFinite(context?.pCore)
      || context.pCore < 0 || context.pCore > 1))) {
      throw new Error(`Invalid GO IEA essentiality record ${id}`);
    }
    if (context !== null && context.label !== contextLabelFor(context.pCore)) {
      throw new Error(`GO IEA context label for ${id} disagrees with its probability`);
    }
    const expected = resolveEssentialityTier({
      tested: Boolean(candidateEvidence.testedAlleles?.[id]),
      pccStatus: calls[id]?.status,
      goLabel: context?.label ?? null,
    });
    if (row.tier !== expected || row.pcc7942Status !== calls[id]?.status) {
      throw new Error(`GO IEA essentiality tier for ${id} disagrees with candidate evidence`);
    }
    if (!Array.isArray(row.discrepancies)
      || row.discrepancies.some((entry) => !discrepancyIsValid(entry, context, calls[id]?.status))) {
      throw new Error(`Invalid GO IEA discrepancy for ${id}`);
    }
    if (context?.label === 'core-cellular-process' && calls[id]?.status === 'non-essential'
      && !row.discrepancies.some((entry) => entry.kind === 'pcc7942-call')) {
      throw new Error(`GO IEA essentiality for ${id} omits its PCC-call disagreement`);
    }
  }
  return data;
}

/** Display model for one locus, or null when the dataset has no GO IEA file. */
export function essentialityEvidenceFor(data, locusId) {
  const row = data?.byLocus?.[locusId];
  if (!row) return null;
  const context = row.goContext;
  return {
    tier: row.tier,
    tierLabel: TIER_LABELS[row.tier],
    tierRank: EVIDENCE_TIERS.indexOf(row.tier) + 1,
    goContext: context,
    goContextText: goContextText(row),
    discrepancies: row.discrepancies,
  };
}

/** Plain wording for the GO context, stated as inference rather than a result. */
export function goContextText(row) {
  const context = row.goContext;
  if (!context) return 'No GO IEA terms are annotated for this locus.';
  const probability = `TypeSafe Jev core-process probability ${context.pCore.toFixed(2)}`;
  if (context.label === 'core-cellular-process') {
    return `GO IEA terms place this protein in a core cellular process (${probability}). `
      + 'This is computational inference from automated annotations, not a knockout '
      + 'result, an essentiality call, or a UTEX 2973 measurement.';
  }
  const reason = context.label === 'uncertain'
    ? 'are borderline for the core-process rule'
    : 'do not place it in a core cellular process';
  return `GO IEA terms ${reason} (${probability}), so they add no essentiality context. `
    + 'That is not evidence of non-essentiality.';
}

/** One export cell listing every discrepancy note. */
export function discrepancyCell(record) {
  return (record?.discrepancies ?? []).map((entry) => entry.note).join(' | ');
}
