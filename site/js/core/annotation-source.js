/**
 * Annotation-source toggles and the source-scoped view over a gene.
 *
 * Three independent toggles, UTEX 2973, PCC 7942, and GO IEA, decide which
 * datasets annotate the view. All three on is the combined "all sources"
 * view; exactly one on is that dataset alone. The detail panel, list/table
 * views, search suggestions, category colour, and the export all read a
 * gene's annotation fields through this one accessor so they agree on what
 * each enabled source annotated. A field no enabled source annotates for a
 * gene comes back null (or an empty list), never filled in from a disabled
 * source and never rendered as if "unknown" were that source's own value.
 *
 * "All sources" is not produced by filtering here: callers keep reading the
 * gene and dataset fields directly for that view, exactly as before toggles
 * existed, so the combined view stays byte-identical to the prior behaviour.
 */
import { functionCategoryLabel, reviewedFunctionLabels } from './function-categories.js';

export const ALL_SOURCES = 'all';
export const NO_SOURCES = 'none';
export const UTEX_SOURCE = 'utex-2973';
export const PCC_SOURCE = 'pcc-7942';
export const GO_IEA_SOURCE = 'go-iea';

/** The three toggles, in display and canonical order. */
export const SOURCE_TOGGLES = Object.freeze([
  { id: UTEX_SOURCE, label: 'UTEX 2973' },
  { id: PCC_SOURCE, label: 'PCC 7942' },
  { id: GO_IEA_SOURCE, label: 'GO IEA' },
]);

/** Every source id a view can name, the combined view first. */
export const ANNOTATION_SOURCES = Object.freeze([
  { id: ALL_SOURCES, label: 'All sources' },
  ...SOURCE_TOGGLES,
]);

/** A fresh view starts with every source on. */
export const DEFAULT_ANNOTATION_SOURCES = Object.freeze(SOURCE_TOGGLES.map((entry) => entry.id));

const TOGGLE_IDS = new Set(DEFAULT_ANNOTATION_SOURCES);
const SINGLE_LABELS = new Map(SOURCE_TOGGLES.map((entry) => [entry.id, entry.label]));

/** True for one of the three toggle ids or the combined "all". */
export function isAnnotationSource(id) {
  return id === ALL_SOURCES || TOGGLE_IDS.has(id);
}

/**
 * The enabled-source list in canonical order, from an array, a legacy single
 * id ("all", one toggle id, or "none"), or nothing (the fresh default).
 * Unknown ids are dropped rather than trusted.
 */
export function normalizeAnnotationSources(value) {
  if (value === undefined || value === null) return [...DEFAULT_ANNOTATION_SOURCES];
  if (typeof value === 'string') {
    if (value === ALL_SOURCES) return [...DEFAULT_ANNOTATION_SOURCES];
    if (value === NO_SOURCES) return [];
    return TOGGLE_IDS.has(value) ? [value] : [...DEFAULT_ANNOTATION_SOURCES];
  }
  const wanted = new Set(Array.isArray(value) ? value : []);
  return DEFAULT_ANNOTATION_SOURCES.filter((id) => wanted.has(id));
}

/**
 * Parse the URL field: a comma list of toggle ids, a legacy single id, "all",
 * or "none". Returns null when nothing in the text is a known source, so the
 * caller leaves the field unspecified rather than trusting it.
 */
export function parseAnnotationSources(text) {
  if (typeof text !== 'string') return null;
  if (text === ALL_SOURCES) return [...DEFAULT_ANNOTATION_SOURCES];
  if (text === NO_SOURCES) return [];
  const ids = text.split(',').filter((id) => TOGGLE_IDS.has(id));
  return ids.length === 0 ? null : normalizeAnnotationSources(ids);
}

/** True when a toggle is on in the given list. */
export function hasSource(sources, id) {
  return normalizeAnnotationSources(sources).includes(id);
}

/** True when every source is on: the combined view. */
export function isAllSources(sources) {
  return normalizeAnnotationSources(sources).length === DEFAULT_ANNOTATION_SOURCES.length;
}

/**
 * One id naming the enabled set: "all", "none", a single toggle id, or the
 * enabled ids joined with "+". Used by the URL, export rows, and manifests.
 */
export function annotationSourceId(sources) {
  const enabled = normalizeAnnotationSources(sources);
  if (enabled.length === DEFAULT_ANNOTATION_SOURCES.length) return ALL_SOURCES;
  if (enabled.length === 0) return NO_SOURCES;
  return enabled.join('+');
}

/** Reader-facing label for an id or an enabled-source list. */
export function annotationSourceLabel(value) {
  if (value === ALL_SOURCES) return 'All sources';
  if (value === NO_SOURCES) return 'No sources';
  if (typeof value === 'string' && SINGLE_LABELS.has(value)) return SINGLE_LABELS.get(value);
  if (typeof value === 'string' && value.includes('+')) {
    return annotationSourceLabel(value.split('+'));
  }
  if (!Array.isArray(value)) return null;
  const enabled = normalizeAnnotationSources(value);
  if (enabled.length === DEFAULT_ANNOTATION_SOURCES.length) return 'All sources';
  if (enabled.length === 0) return 'No sources';
  return enabled.map((id) => SINGLE_LABELS.get(id)).join(' + ');
}

const EVIDENCE_NOTES = Object.freeze({
  [UTEX_SOURCE]: 'UTEX 2973 RefSeq annotation (NCBI): product, gene symbol, and the lab’s '
    + 'reviewed function category.',
  [PCC_SOURCE]: 'PCC 7942 essentiality (Adomako et al. 2022 Data Set S1, republishing Rubin et al. '
    + '2015, CC BY 4.0) and a function category derived from the joined PCC 7942 RefSeq product '
    + 'name. Applying a PCC 7942 call or category to a UTEX 2973 locus is a cross-strain '
    + 'assumption, not a UTEX 2973 measurement.',
  [GO_IEA_SOURCE]: 'Gene Ontology IEA computational annotations (Gene Ontology Consortium, CC BY '
    + '4.0), assigned by RefSeq, and a function category derived from them. Evidence code IEA '
    + 'means inferred from electronic annotation, not experimentally verified in this organism.',
});

const NO_SOURCE_NOTE = 'No annotation source is enabled: every annotation field is blank and every '
  + 'CDS is uncoloured until a source is turned on.';

/**
 * Evidence, citation, and licence wording for the enabled sources; null for
 * the combined view, which needs no scoping note.
 */
export function annotationSourceEvidenceNote(value) {
  if (value === ALL_SOURCES) return null;
  if (typeof value === 'string' && SINGLE_LABELS.has(value)) return EVIDENCE_NOTES[value];
  const enabled = normalizeAnnotationSources(
    typeof value === 'string' && value.includes('+') ? value.split('+') : value,
  );
  if (enabled.length === DEFAULT_ANNOTATION_SOURCES.length) return null;
  if (enabled.length === 0) return NO_SOURCE_NOTE;
  return enabled.map((id) => EVIDENCE_NOTES[id]).join(' ');
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
 * A display-ready, source-scoped model for one gene under the enabled sources.
 * `sources` may be an enabled-source array or a legacy single id.
 * @returns {{source: string, sources: string[], product: string|null, name: string|null,
 *   reviewedFunctionLabels: string[], functionCategoryLabel: string|null,
 *   reviewedFunctionCategories: string[], essentialityStatus: string|null,
 *   pccLocusTag: string|null, pccMappingStatus: string|null, pccMappingReason: string|null,
 *   goAnnotations: object[], evidenceNote: string|null}}
 */
export function annotationSourceView(gene, dataset, sources) {
  const enabled = normalizeAnnotationSources(sources);
  const utex = enabled.includes(UTEX_SOURCE) ? utexFields(gene, dataset) : BLANK_UTEX;
  const pcc = enabled.includes(PCC_SOURCE) ? pccFields(gene, dataset) : BLANK_PCC;
  const go = enabled.includes(GO_IEA_SOURCE) ? goFields(gene) : BLANK_GO;
  return {
    source: annotationSourceId(enabled),
    sources: enabled,
    ...utex,
    ...pcc,
    ...go,
    evidenceNote: annotationSourceEvidenceNote(enabled),
  };
}
