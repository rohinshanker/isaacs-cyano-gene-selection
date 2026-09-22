/** Exact, human-reviewed function categories for the pinned UTEX 2973 release. */
export const FUNCTION_COLOR_KEY = 'functionCategory';
export const UNKNOWN_CATEGORY_ID = 'unknown-or-unclassified';
const REVIEWED_LOCUS_IDS = Object.freeze([
  'M744_RS00265', 'M744_RS00815', 'M744_RS13625', 'M744_RS10050',
  'M744_RS10055', 'M744_RS10060', 'M744_RS13070', 'M744_RS00700',
  'M744_RS01270', 'M744_RS00020', 'M744_RS04595', 'M744_RS02500',
  'M744_RS00030',
]);
const REVIEWED_CATEGORY_IDS = Object.freeze([
  'photosynthetic-light-reactions', 'carbon-and-nutrient-metabolism',
  'atp-production-and-respiration', 'pigment-and-cofactor-biosynthesis',
  'translation-and-protein-maintenance', 'dna-and-rna-processing',
  'transport-and-envelope', 'signaling-and-circadian-regulation',
  'stress-and-repair', 'other-characterized', 'unknown-or-unclassified',
]);
const REVIEWED_CATEGORY_LABELS = Object.freeze([
  'Photosynthetic light reactions', 'Carbon and nutrient metabolism',
  'ATP production and respiration', 'Pigment and cofactor biosynthesis',
  'Translation and protein maintenance', 'DNA and RNA processing',
  'Transport and envelope', 'Signaling and circadian regulation',
  'Stress and repair', 'Other characterized', 'Unknown or unclassified',
]);

/** The exact category names reviewed for a locus, excluding unreviewed defaults. */
export function reviewedFunctionLabels(model, locusId) {
  if (!model) return [];
  const row = model.assignmentsById.get(locusId);
  if (!row) return [];
  const labels = new Map(model.source.vocabulary.categories.map((entry) => [entry.id, entry.label]));
  return row.categoryIds.map((id) => labels.get(id));
}

/** The visible bucket label, distinct from whether a locus was explicitly reviewed. */
export function functionCategoryLabel(model, locusId) {
  if (!model) return null;
  const row = model.assignmentsById.get(locusId);
  if (!row) return 'Unknown or unclassified';
  if (row.categoryIds.length > 1) return model.source.vocabulary.multipleFunctionsBucket.label;
  return model.source.vocabulary.categories.find((entry) => entry.id === row.categoryIds[0])?.label
    ?? 'Unknown or unclassified';
}

/** Join the sparse reviewed table to plotted CDS rows without functional inference. */
export function joinFunctionCategories(data, genes, releaseId) {
  if (!data || data.schemaVersion !== 1
    || data.datasetVersion !== 'function-categories-v1'
    || data.provenance?.annotationRelease !== releaseId
    || data.provenance?.userReview?.date !== '2026-09-22'
    || data.policy?.assignmentMethod !== 'explicit-user-review-only'
    || data.policy?.defaultCategoryId !== UNKNOWN_CATEGORY_ID) {
    throw new Error('Function category table has an invalid version, release, or review policy');
  }
  const vocabulary = data.vocabulary?.categories;
  if (!Array.isArray(vocabulary) || vocabulary.length !== 11
    || vocabulary.some((entry, index) => entry.id !== REVIEWED_CATEGORY_IDS[index]
      || entry.label !== REVIEWED_CATEGORY_LABELS[index])
    || vocabulary.at(-1)?.id !== UNKNOWN_CATEGORY_ID
    || data.vocabulary?.multipleFunctionsBucket?.id !== 'multiple-functions'
    || data.vocabulary?.multipleFunctionsBucket?.label !== 'Multiple functions') {
    throw new Error('Function category vocabulary is incomplete');
  }
  if (!Array.isArray(data.assignments)
    || data.assignments.length !== REVIEWED_LOCUS_IDS.length
    || new Set(data.assignments.map((row) => row?.locusTag)).size !== REVIEWED_LOCUS_IDS.length
    || data.assignments.some((row) => !REVIEWED_LOCUS_IDS.includes(row?.locusTag))) {
    throw new Error('Function category review set differs from the approved 13 loci');
  }
  const classified = vocabulary.slice(0, -1);
  const byCategory = new Map(vocabulary.map((entry) => [entry.id, entry.label]));
  if (byCategory.size !== vocabulary.length
    || vocabulary.some((entry) => !entry.id || !entry.label)) {
    throw new Error('Function category IDs and labels must be unique and nonempty');
  }
  const indexByCategory = new Map(classified.map((entry, index) => [entry.id, index]));
  const indexByGene = new Map(genes.map((gene, index) => [gene.id, index]));
  const values = new Int16Array(genes.length).fill(-1);
  const counts = new Int32Array(classified.length);
  const seen = new Set();
  let reviewed = 0;
  let explicitUnknown = 0;
  let multiple = 0;
  for (const row of data.assignments) {
    const index = indexByGene.get(row.locusTag);
    if (index === undefined || seen.has(row.locusTag)
      || row.classificationBasis !== 'explicit-user-review'
      || genes[index].product !== row.releaseProduct
      || (genes[index].name ?? null) !== row.releaseSymbol
      || !Array.isArray(row.categoryIds) || row.categoryIds.length === 0
      || new Set(row.categoryIds).size !== row.categoryIds.length
      || row.categoryIds.some((id) => !byCategory.has(id))
      || (row.categoryIds.includes(UNKNOWN_CATEGORY_ID) && row.categoryIds.length !== 1)) {
      throw new Error(`Invalid reviewed function assignment for ${row.locusTag}`);
    }
    seen.add(row.locusTag);
    reviewed += 1;
    genes[index].reviewedFunctionLabels = row.categoryIds.map((id) => byCategory.get(id));
    if (row.categoryIds[0] === UNKNOWN_CATEGORY_ID) {
      explicitUnknown += 1;
    } else if (row.categoryIds.length > 1) {
      values[index] = classified.length;
      multiple += 1;
    } else {
      const bucket = indexByCategory.get(row.categoryIds[0]);
      values[index] = bucket;
      counts[bucket] += 1;
    }
  }
  const classifiedCount = counts.reduce((sum, count) => sum + count, 0) + multiple;
  if (data.coverage?.totalCdsLoci !== genes.length
    || data.coverage.reviewedRows !== reviewed
    || data.coverage.classifiedLoci !== classifiedCount
    || data.coverage.explicitUnknownLoci !== explicitUnknown
    || data.coverage.runtimeUnknownLoci !== genes.length - classifiedCount
    || data.coverage.multipleFunctionLoci !== multiple) {
    throw new Error('Function category coverage differs from the joined genes');
  }
  return {
    source: data,
    labels: classified.map((entry) => entry.label),
    multipleLabel: data.vocabulary.multipleFunctionsBucket.label,
    values,
    counts,
    unknownCount: genes.length - classifiedCount,
    explicitUnknownCount: explicitUnknown,
    multipleCount: multiple,
    reviewedCount: reviewed,
    assignmentsById: new Map(data.assignments.map((row) => [row.locusTag, row])),
  };
}
