/**
 * Annotation-source-scoped view over a gene.
 *
 * The detail panel, list/table views, search suggestions, and the export all
 * read a gene's annotation fields through this one accessor so they agree on
 * what "UTEX 2973 only", "PCC 7942 only", and "GO IEA only" mean. A single
 * source shows only what that dataset actually annotated for the gene: a
 * field the source is silent on comes back null (or an empty list), never
 * filled in from another source and never rendered as if "unknown" were that
 * source's own value.
 *
 * "All sources" is not produced by filtering here — callers keep reading the
 * gene and dataset fields directly for that view, exactly as before this
 * module existed, so the combined view stays byte-identical to the prior
 * behaviour. `annotationSourceView` only exists to describe the three single
 * sources plus the current "all" fields, for callers (export, tests) that
 * want one shape regardless of which source is selected.
 */
import { functionCategoryLabel, reviewedFunctionLabels } from './function-categories.js';

export const ALL_SOURCES = 'all';
export const UTEX_SOURCE = 'utex-2973';
export const PCC_SOURCE = 'pcc-7942';
export const GO_IEA_SOURCE = 'go-iea';

export const ANNOTATION_SOURCES = Object.freeze([
  { id: ALL_SOURCES, label: 'All sources' },
  { id: UTEX_SOURCE, label: 'UTEX 2973' },
  { id: PCC_SOURCE, label: 'PCC 7942' },
  { id: GO_IEA_SOURCE, label: 'GO IEA' },
]);

export const DEFAULT_ANNOTATION_SOURCE = ALL_SOURCES;

const SOURCE_IDS = new Set(ANNOTATION_SOURCES.map((entry) => entry.id));

export function isAnnotationSource(id) {
  return SOURCE_IDS.has(id);
}

export function annotationSourceLabel(id) {
  return ANNOTATION_SOURCES.find((entry) => entry.id === id)?.label ?? null;
}

const EVIDENCE_NOTES = Object.freeze({
  [UTEX_SOURCE]: 'UTEX 2973 RefSeq annotation (NCBI): product, gene symbol, and the lab’s '
    + 'reviewed function category.',
  [PCC_SOURCE]: 'PCC 7942 essentiality (Adomako et al. 2022 Data Set S1, republishing Rubin et al. '
    + '2015, CC BY 4.0). Applying a PCC 7942 call to a UTEX 2973 locus is a cross-strain assumption, '
    + 'not a UTEX 2973 measurement.',
  [GO_IEA_SOURCE]: 'Gene Ontology IEA computational annotations (Gene Ontology Consortium, CC BY '
    + '4.0), assigned by RefSeq. Evidence code IEA means inferred from electronic annotation, not '
    + 'experimentally verified in this organism.',
});

/** Reader-facing evidence, citation, and licence wording for one source; null for "all". */
export function annotationSourceEvidenceNote(sourceId) {
  return EVIDENCE_NOTES[sourceId] ?? null;
}

/**
 * Extension point for the parallel GO-IEA-fallback work (essentiality context
 * drawn from GO IEA annotations, with discrepancy notes against UTEX/PCC).
 * That behaviour belongs only to the "All sources" view; a single-source view
 * must keep showing only its own source's values. Register a function here
 * `(view, gene, dataset) => view` that augments the "all" view in place (or
 * returns a replacement); by default nothing is registered and "all" stays
 * exactly the union of the three sources below.
 */
let allSourcesAugmenter = null;

export function registerAllSourcesAugmenter(fn) {
  allSourcesAugmenter = typeof fn === 'function' ? fn : null;
}

function utexFields(gene, dataset) {
  return {
    product: gene?.product ?? null,
    name: gene?.name ?? null,
    reviewedFunctionLabels: gene?.reviewedFunctionLabels ?? [],
    functionCategoryLabel: functionCategoryLabel(dataset?.functionCategories, gene?.id) ?? null,
    reviewedFunctionCategories: reviewedFunctionLabels(dataset?.functionCategories, gene?.id),
  };
}

function pccFields(gene, dataset) {
  const call = dataset?.candidateEvidence?.borrowedEssentiality?.byLocus?.[gene?.id] ?? null;
  const covered = Boolean(call) && call.status !== 'unknown';
  return {
    essentialityStatus: covered ? call.status : null,
    pccLocusTag: covered ? call.pccLocusTag ?? null : null,
    pccMappingStatus: covered ? call.mappingStatus ?? null : null,
    pccMappingReason: covered ? call.mappingReason ?? null : null,
  };
}

function goFields(gene) {
  const annotations = gene?.annotationEvidence?.goAnnotations;
  return { goAnnotations: Array.isArray(annotations) ? annotations : [] };
}

const BLANK_UTEX = Object.freeze({
  product: null, name: null, reviewedFunctionLabels: [], functionCategoryLabel: null,
  reviewedFunctionCategories: [],
});
const BLANK_PCC = Object.freeze({
  essentialityStatus: null, pccLocusTag: null, pccMappingStatus: null, pccMappingReason: null,
});
const BLANK_GO = Object.freeze({ goAnnotations: [] });

/**
 * A display-ready, source-scoped model for one gene.
 * @returns {{source: string, product: string|null, name: string|null,
 *   reviewedFunctionLabels: string[], functionCategoryLabel: string|null,
 *   reviewedFunctionCategories: string[], essentialityStatus: string|null,
 *   pccLocusTag: string|null, pccMappingStatus: string|null, pccMappingReason: string|null,
 *   goAnnotations: object[], evidenceNote: string|null}}
 */
export function annotationSourceView(gene, dataset, sourceId) {
  const source = isAnnotationSource(sourceId) ? sourceId : ALL_SOURCES;
  if (source === UTEX_SOURCE) {
    return { source, ...utexFields(gene, dataset), ...BLANK_PCC, ...BLANK_GO,
      evidenceNote: annotationSourceEvidenceNote(source) };
  }
  if (source === PCC_SOURCE) {
    return { source, ...BLANK_UTEX, ...pccFields(gene, dataset), ...BLANK_GO,
      evidenceNote: annotationSourceEvidenceNote(source) };
  }
  if (source === GO_IEA_SOURCE) {
    return { source, ...BLANK_UTEX, ...BLANK_PCC, ...goFields(gene),
      evidenceNote: annotationSourceEvidenceNote(source) };
  }
  const view = {
    source: ALL_SOURCES,
    ...utexFields(gene, dataset),
    ...pccFields(gene, dataset),
    ...goFields(gene),
    evidenceNote: null,
  };
  return allSourcesAugmenter ? allSourcesAugmenter(view, gene, dataset) ?? view : view;
}
