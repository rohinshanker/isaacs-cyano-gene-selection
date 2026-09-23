/**
 * Source-derived function categories and the colour resolution under toggles.
 *
 * `site/data/source-derived-categories-v1.json` pins, for every plotted CDS,
 * the category TypeSafe Jev assigned from the joined PCC 7942 product name and
 * from the locus's GO IEA terms. These are computational judgments, never
 * reviewed assignments: they never enter the reviewed table, never change its
 * rows, and never colour a point without their evidence label. Precedence is
 * UTEX 2973 > PCC 7942 > GO IEA among the enabled sources; when a lower
 * source assigns a different category the point keeps the higher source's
 * colour and the conflict is named in the detail panel and export.
 */
import {
  MULTIPLE_CATEGORY_ID, UNKNOWN_CATEGORY_ID,
} from './function-categories.js';
import {
  GO_IEA_SOURCE, PCC_SOURCE, UTEX_SOURCE, normalizeAnnotationSources,
} from './annotation-source.js';

export const DERIVED_SOURCES = Object.freeze([PCC_SOURCE, GO_IEA_SOURCE]);

export const EVIDENCE_LABELS = Object.freeze(['reviewed', 'pcc-7942-derived', 'go-iea-derived']);

export const EVIDENCE_LABEL_OF_SOURCE = Object.freeze({
  [UTEX_SOURCE]: 'reviewed',
  [PCC_SOURCE]: 'pcc-7942-derived',
  [GO_IEA_SOURCE]: 'go-iea-derived',
});

export const SOURCE_DISPLAY_NAMES = Object.freeze({
  [UTEX_SOURCE]: 'UTEX 2973 reviewed',
  [PCC_SOURCE]: 'PCC 7942 derived',
  [GO_IEA_SOURCE]: 'GO IEA derived',
});

/**
 * Pinned in docs/validation/source-derived-categories.md. Held here so an
 * assigned category is re-derived from its probability instead of trusted.
 */
export const THRESHOLDS = Object.freeze({ derivedProbabilityAtLeast: 0.8 });

/** Apply the assignment rule to one pinned per-source entry. */
export function derivedCategoryIdFor(entry) {
  if (!entry || typeof entry.mostLikely !== 'string' || !Number.isFinite(entry.probability)) {
    return null;
  }
  if (entry.mostLikely === UNKNOWN_CATEGORY_ID) return null;
  return entry.probability >= THRESHOLDS.derivedProbabilityAtLeast ? entry.mostLikely : null;
}

/**
 * UTEX > PCC > GO precedence for one locus.
 * @param {string[]|null} reviewedIds the reviewed row's category ids, or null
 * @param {{[source: string]: string|null}} derivedIds assigned id per derived source
 * @param {string[]} sources enabled sources
 * @returns {{bucketId: string, evidence: string|null, source: string|null,
 *   conflicts: Array<{source: string, categoryId: string}>}} the bucket, the
 *   evidence label and id of the source that coloured it, and every enabled
 *   lower-priority source whose assigned category differs from that colour.
 */
export function resolveCategoryBucket(reviewedIds, derivedIds, sources) {
  const enabled = normalizeAnnotationSources(sources);
  const ranked = [];
  if (enabled.includes(UTEX_SOURCE) && Array.isArray(reviewedIds) && reviewedIds.length > 0) {
    ranked.push({
      source: UTEX_SOURCE,
      categoryId: reviewedIds.length > 1 ? MULTIPLE_CATEGORY_ID : reviewedIds[0],
    });
  }
  for (const source of DERIVED_SOURCES) {
    if (enabled.includes(source) && derivedIds?.[source]) {
      ranked.push({ source, categoryId: derivedIds[source] });
    }
  }
  if (ranked.length === 0) {
    return { bucketId: UNKNOWN_CATEGORY_ID, evidence: null, source: null, conflicts: [] };
  }
  const [winner, ...rest] = ranked;
  return {
    bucketId: winner.categoryId,
    evidence: EVIDENCE_LABEL_OF_SOURCE[winner.source],
    source: winner.source,
    conflicts: rest.filter((entry) => entry.categoryId !== winner.categoryId),
  };
}

function sameVocabulary(left, right) {
  const categories = (vocabulary) => (vocabulary?.categories ?? []).map((entry) => `${entry.id}\t${entry.label}`);
  return JSON.stringify(categories(left)) === JSON.stringify(categories(right))
    && left?.multipleFunctionsBucket?.id === right?.multipleFunctionsBucket?.id
    && left?.multipleFunctionsBucket?.label === right?.multipleFunctionsBucket?.label;
}

/**
 * Validate the pinned file against the plotted genes, the reviewed table, and
 * the PCC joins. A supplied category is never trusted: it must equal the one
 * re-derived from its probability at the pinned threshold.
 */
export function validateSourceDerivedCategories(data, genes, reviewed, candidateEvidence, releaseId) {
  if (!data || data.schemaVersion !== 1 || data.datasetVersion !== 'source-derived-categories-v1'
    || data.annotationRelease !== releaseId) {
    throw new Error('Source-derived categories release does not match the annotated genes');
  }
  if (!reviewed) {
    throw new Error('Source-derived categories require the reviewed function-category table');
  }
  if (data.attribution?.goIea?.license !== 'CC BY 4.0'
    || data.attribution?.goIea?.creator !== 'Gene Ontology Consortium') {
    throw new Error('Source-derived categories must carry Gene Ontology CC BY 4.0 attribution');
  }
  const pccAttribution = data.attribution?.pcc7942 ?? {};
  if (pccAttribution.license !== 'CC BY 4.0'
    || !['Adomako et al. 2022', 'Rubin et al. 2015'].every(
      (study) => (pccAttribution.attributedStudies ?? []).includes(study),
    )) {
    throw new Error('Source-derived categories must carry Adomako and Rubin PCC 7942 attribution');
  }
  if (JSON.stringify(data.policy?.evidenceLabels) !== JSON.stringify(EVIDENCE_LABELS)) {
    throw new Error('Source-derived category evidence labels differ from the site contract');
  }
  const thresholds = data.policy?.thresholds ?? {};
  if (Object.keys(THRESHOLDS).some((key) => thresholds[key] !== THRESHOLDS[key])) {
    throw new Error('Source-derived category thresholds differ from the site contract');
  }
  if (!sameVocabulary(data.vocabulary, reviewed.source?.vocabulary)) {
    throw new Error('Source-derived category vocabulary differs from the reviewed vocabulary');
  }
  const categoryIds = new Set(data.vocabulary.categories.map((entry) => entry.id));
  const calls = candidateEvidence?.borrowedEssentiality?.byLocus;
  if (!calls) throw new Error('Source-derived categories require candidate evidence');
  const rows = data.byLocus ?? {};
  if (Object.keys(rows).length !== genes.length) {
    throw new Error('Source-derived categories must represent every current UTEX CDS');
  }
  for (const gene of genes) {
    const row = rows[gene.id];
    if (!row || !Object.hasOwn(row, PCC_SOURCE) || !Object.hasOwn(row, GO_IEA_SOURCE)) {
      throw new Error(`Invalid source-derived category record ${gene.id}`);
    }
    const call = calls[gene.id];
    const joined = call?.mappingStatus === 'accepted';
    if ((row[PCC_SOURCE] !== null) !== joined
      || (joined && row[PCC_SOURCE].pccLocusTag !== call.pccLocusTag)) {
      throw new Error(`PCC 7942 category presence for ${gene.id} disagrees with its join`);
    }
    const hasGo = (gene.annotationEvidence?.goAnnotations?.length ?? 0) > 0;
    if ((row[GO_IEA_SOURCE] !== null) !== hasGo) {
      throw new Error(`GO IEA category presence for ${gene.id} disagrees with its GO terms`);
    }
    for (const source of DERIVED_SOURCES) {
      const entry = row[source];
      if (entry === null) continue;
      if (!categoryIds.has(entry.mostLikely) || !Number.isFinite(entry.probability)
        || entry.probability < 0 || entry.probability > 1) {
        throw new Error(`Invalid ${source} category judgment for ${gene.id}`);
      }
      if (entry.categoryId !== derivedCategoryIdFor(entry)) {
        throw new Error(`${source} category for ${gene.id} disagrees with its probability`);
      }
    }
  }
  return data;
}

/** The assigned id per derived source for one locus, or null entries. */
function derivedIdsFor(derived, locusId) {
  const row = derived?.byLocus?.[locusId];
  return {
    [PCC_SOURCE]: row?.[PCC_SOURCE]?.categoryId ?? null,
    [GO_IEA_SOURCE]: row?.[GO_IEA_SOURCE]?.categoryId ?? null,
  };
}

/**
 * Resolve every plotted gene's category bucket under the enabled sources.
 *
 * The result has the same shape the reviewed model exposes to the legend,
 * filter, and canvas (`values`, `categoryIds`, `counts`, ...), plus a
 * `derived` mask marking points whose colour is computational so the canvas
 * can draw them with the distinct derived treatment.
 *
 * @param {{reviewed: object, derived: object|null, genes: object[], sources: string[]}} options
 */
export function resolveFunctionCategories({ reviewed, derived, genes, sources }) {
  const enabled = normalizeAnnotationSources(sources);
  const classified = reviewed.categoryIds;
  const indexByCategory = new Map(classified.map((id, index) => [id, index]));
  const values = new Int16Array(genes.length).fill(-1);
  const derivedMask = new Uint8Array(genes.length);
  const counts = new Int32Array(classified.length);
  const evidenceCounts = { reviewed: 0, 'pcc-7942-derived': 0, 'go-iea-derived': 0, none: 0 };
  let multiple = 0;
  let unknown = 0;
  let conflictCount = 0;
  genes.forEach((gene, index) => {
    const reviewedRow = reviewed.assignmentsById.get(gene.id);
    const { bucketId, evidence, conflicts } = resolveCategoryBucket(
      reviewedRow ? reviewedRow.categoryIds : null,
      derivedIdsFor(derived, gene.id),
      enabled,
    );
    derivedMask[index] = evidence && evidence !== 'reviewed' ? 1 : 0;
    evidenceCounts[evidence ?? 'none'] += 1;
    if (conflicts.length > 0) conflictCount += 1;
    if (bucketId === UNKNOWN_CATEGORY_ID) {
      unknown += 1;
    } else if (bucketId === MULTIPLE_CATEGORY_ID) {
      values[index] = classified.length;
      multiple += 1;
    } else {
      const bucket = indexByCategory.get(bucketId);
      values[index] = bucket;
      counts[bucket] += 1;
    }
  });
  return {
    source: reviewed.source,
    labels: reviewed.labels,
    categoryIds: classified,
    multipleLabel: reviewed.multipleLabel,
    assignmentsById: reviewed.assignmentsById,
    values,
    derived: derivedMask,
    counts,
    unknownCount: unknown,
    multipleCount: multiple,
    reviewedCount: evidenceCounts.reviewed,
    derivedCount: evidenceCounts['pcc-7942-derived'] + evidenceCounts['go-iea-derived'],
    colouredCount: genes.length - unknown,
    conflictCount,
    evidenceCounts,
    sources: enabled,
    hasDerivedData: Boolean(derived),
  };
}

/** The display label for a category id, the multiple bucket, or unknown. */
export function categoryLabelFor(reviewed, id) {
  if (id === MULTIPLE_CATEGORY_ID) {
    return reviewed.multipleLabel ?? reviewed.source.vocabulary.multipleFunctionsBucket.label;
  }
  const entry = reviewed.source.vocabulary.categories.find((category) => category.id === id);
  return entry?.label ?? 'Unknown or unclassified';
}

function perSourceEntry(reviewed, entry, enabledNow, absentReason) {
  if (!entry) {
    return { enabled: enabledNow, judged: false, categoryId: null, label: null, reason: absentReason };
  }
  const categoryId = entry.categoryId ?? null;
  return {
    enabled: enabledNow,
    judged: true,
    categoryId,
    label: categoryId ? categoryLabelFor(reviewed, categoryId) : null,
    mostLikely: entry.mostLikely,
    mostLikelyLabel: categoryLabelFor(reviewed, entry.mostLikely),
    probability: entry.probability,
    pccLocusTag: entry.pccLocusTag ?? null,
    termCount: entry.termCount ?? null,
  };
}

/**
 * Everything the detail panel and export say about one locus's category:
 * the resolved bucket, the source and evidence label that coloured it, every
 * source's own judgment whether or not it is enabled for colouring, and the
 * enabled sources whose category conflicts with the colour.
 */
export function categoryResolutionFor({ reviewed, derived, sources, locusId }) {
  if (!reviewed) return null;
  const enabled = normalizeAnnotationSources(sources);
  const reviewedRow = reviewed.assignmentsById.get(locusId) ?? null;
  const derivedRow = derived?.byLocus?.[locusId] ?? null;
  const { bucketId, evidence, source, conflicts } = resolveCategoryBucket(
    reviewedRow ? reviewedRow.categoryIds : null,
    derivedIdsFor(derived, locusId),
    enabled,
  );
  const perSource = {
    [UTEX_SOURCE]: {
      enabled: enabled.includes(UTEX_SOURCE),
      reviewed: Boolean(reviewedRow),
      labels: reviewedRow ? reviewedRow.categoryIds.map((id) => categoryLabelFor(reviewed, id)) : [],
    },
    [PCC_SOURCE]: perSourceEntry(
      reviewed, derivedRow?.[PCC_SOURCE] ?? null, enabled.includes(PCC_SOURCE),
      derived ? 'no accepted PCC 7942 join' : 'no derived-category file',
    ),
    [GO_IEA_SOURCE]: perSourceEntry(
      reviewed, derivedRow?.[GO_IEA_SOURCE] ?? null, enabled.includes(GO_IEA_SOURCE),
      derived ? 'no GO IEA terms' : 'no derived-category file',
    ),
  };
  return {
    bucketId,
    label: categoryLabelFor(reviewed, bucketId),
    evidence,
    source,
    sources: enabled,
    conflicts: conflicts.map((entry) => ({
      source: entry.source,
      categoryId: entry.categoryId,
      label: categoryLabelFor(reviewed, entry.categoryId),
    })),
    perSource,
  };
}

/** One sentence naming every conflicting enabled source, or an empty string. */
export function conflictNote(resolution) {
  if (!resolution || resolution.conflicts.length === 0) return '';
  return resolution.conflicts
    .map((entry) => `${SOURCE_DISPLAY_NAMES[entry.source]}: ${entry.label}`)
    .join('; ');
}
