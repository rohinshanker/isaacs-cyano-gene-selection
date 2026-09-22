/**
 * Presentation model for Tan et al. 2018 transcription-start-site evidence.
 *
 * Each start site remains independent: these measurements describe promoter
 * initiation, not gene-body RNA abundance, so this module never combines them
 * into a gene-level fold change.
 */

const CONDITIONS = Object.freeze([
  Object.freeze({ key: 'control', label: 'Control' }),
  Object.freeze({ key: 'dark', label: 'Dark' }),
  Object.freeze({ key: 'highLight', label: 'High light' }),
  Object.freeze({ key: 'highTemperature', label: 'High temperature' }),
]);

const COMPARISONS = CONDITIONS.slice(1);

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function readsFor(entry, key) {
  const values = entry?.rawReads?.[key];
  return [finiteOrNull(values?.[0]), finiteOrNull(values?.[1])];
}

/** Keep tiny adjusted p-values legible without rounding them to zero. */
export function formatTssStatistic(value) {
  if (!Number.isFinite(value)) return 'Unknown';
  if (value !== 0 && Math.abs(value) < 0.001) return value.toExponential(3);
  return value.toLocaleString('en-US', { maximumSignificantDigits: 4 });
}

/**
 * Explain whether the separate pooled initiation score and Table S1 site layer
 * agree for one gene. Neither artifact is allowed to fill the other.
 */
export function tssInitiationBasis(gene, value = gene?.tssInitiation) {
  const siteCount = Array.isArray(gene?.tssEvidence) ? gene.tssEvidence.length : 0;
  if (Number.isFinite(value)) {
    if (siteCount === 0) {
      return {
        basis: 'measured',
        short: 'pooled score; no exact Table S1 site',
        text: 'The separate TAN2018_TSS pooled initiation table has a value, but Table S1 has no gTSS row '
          + 'that maps to this current locus by exact locus tag.',
        siteCount,
      };
    }
    return {
      basis: 'measured',
      short: 'measured',
      text: 'The separate TAN2018_TSS pooled initiation table has a value; mapped Table S1 sites remain '
        + 'independent promoter-level evidence.',
      siteCount,
    };
  }
  if (siteCount > 0) {
    return {
      basis: 'none',
      short: `${siteCount} mapped ${siteCount === 1 ? 'site' : 'sites'}; pooled score absent`,
      text: `Table S1 maps ${siteCount} ${siteCount === 1 ? 'gTSS row' : 'gTSS rows'} to this `
        + 'current locus by exact locus tag, but the separate pooled initiation table has no '
        + 'row for it. Site counts do not backfill that metric.',
      siteCount,
    };
  }
  return {
    basis: 'none',
    short: 'no pooled score or mapped site',
    text: 'Neither the separate pooled initiation table nor the exact-locus Table S1 join has '
      + 'evidence for this current locus.',
    siteCount,
  };
}

/** Return a display-ready model while preserving missing measurements as null. */
export function tssEvidenceModel(gene) {
  const evidence = Array.isArray(gene?.tssEvidence) ? gene.tssEvidence : [];
  return {
    count: evidence.length,
    entries: evidence.map((entry) => ({
      id: entry?.id ?? 'TSS identifier not recorded',
      type: entry?.type ?? 'type not recorded',
      replicon: entry?.replicon ?? 'replicon not recorded',
      strand: entry?.strand ?? 'strand not recorded',
      position: finiteOrNull(entry?.position),
      sourceStartDistanceNt: finiteOrNull(entry?.sourceStartDistanceNt),
      rawReads: CONDITIONS.map(({ key, label }) => ({
        key,
        label,
        cultures: readsFor(entry, key),
      })),
      differential: COMPARISONS.map(({ key, label }) => ({
        key,
        label,
        log2FoldChange: finiteOrNull(entry?.differential?.[key]?.log2FoldChange),
        padj: finiteOrNull(entry?.differential?.[key]?.padj),
      })),
    })),
  };
}
