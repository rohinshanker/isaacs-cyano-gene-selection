/**
 * Exporting a panel design so it can be rebuilt exactly.
 *
 * A list of gene names is not a design. What made the panel is the size, the
 * seeds, every constraint including the ones that were blocked, the objective,
 * the feature set, and the dataset the numbers came from. All of that rides in
 * the same versioned manifest the shortlist export already writes, so a panel
 * and a shortlist stay one format, and the flat CSV keeps its one row per gene
 * and scheme with the design columns repeated on each.
 *
 * Nothing here calls the output a prediction of fitness. It is a design and a
 * record of how it was chosen.
 */
import { buildExport, canonicalJson, fnv1a64, schemeIdOf } from './export-manifest.js';
import { csvField } from '../ui/format.js';
import { OBJECTIVE_ID, SELECTION_ORDER, normaliseConfig } from './panel-design.js';

export const PANEL_DESIGN_VERSION = 1;
export const PANEL_EXPORT_BASENAME = 'gene-panel';

/** Columns added to each row so the CSV alone says why the gene is in the panel. */
export const PANEL_COLUMNS = Object.freeze([
  'panelOrder', 'panelRole', 'nearestSelected', 'nearestDistance', 'missingFeatures',
]);

/**
 * The gene-by-scheme matrix: what each selected scheme would do to each selected
 * gene. One cell per gene and scheme, never a wider row, so a rename cannot
 * change which scheme a number belongs to.
 *
 * @param {{dataset: object, registry: object, ids: string[],
 *   schemes: Array<{schemeId: string, name?: string|null, map: object}>,
 *   schemeFields: Map<string, Record<string, Float64Array>>, metricKeys?: string[]}} options
 * @returns {{metrics: object[], schemes: object[], rows: Array<object>}}
 */
export function buildSchemeMatrix({
  dataset, registry, ids, schemes, schemeFields,
  metricKeys = ['targetCount', 'targetFraction', 'maxLocalTargetDensity', 'dCai', 'dTai'],
}) {
  const metrics = metricKeys
    .map((key) => registry.byKey.get(key))
    .filter(Boolean);
  const rows = [];
  for (const id of ids) {
    const index = dataset.indexById.get(id);
    if (index === undefined) continue;
    const gene = dataset.genes[index];
    const cells = [];
    for (const scheme of schemes) {
      const fields = schemeFields.get(scheme.schemeId);
      cells.push({
        schemeId: scheme.schemeId,
        schemeName: scheme.name ?? null,
        values: metrics.map((metric) => {
          const value = fields?.[metric.key]?.[index];
          return Number.isFinite(value) ? value : NaN;
        }),
      });
    }
    rows.push({ id, name: gene.name ?? null, index, cells });
  }
  return { metrics, schemes, rows };
}

function designBlock(design, space) {
  const { config, constraints } = design;
  return {
    panelDesignVersion: PANEL_DESIGN_VERSION,
    objective: OBJECTIVE_ID,
    objectiveDescription: 'Greedy constrained stratified maximin over percentile-scaled '
      + 'features: each added gene reaches the most quantile bins no selected gene occupies, and '
      + 'among those is the gene whose nearest already-selected gene is farthest away. This is a '
      + 'coverage design, not a prediction of how a recoded strain will perform.',
    selectionOrder: SELECTION_ORDER,
    size: config.size,
    seeds: config.seeds,
    include: config.include,
    exclude: config.exclude,
    flags: {
      excludeTranslationalExceptions: config.excludeTranslationalExceptions,
      excludeAmbiguousLoci: config.excludeAmbiguousLoci,
      requireMeasuredExpression: config.requireMeasuredExpression,
      allowBorrowedExpression: config.allowBorrowedExpression,
    },
    replicons: config.replicons,
    ranges: Object.fromEntries(Object.entries(config.ranges).map(([key, range]) => [key, {
      min: Number.isFinite(range?.min) ? Number(range.min) : null,
      max: Number.isFinite(range?.max) ? Number(range.max) : null,
      includeMissing: range?.includeMissing !== false,
    }])),
    features: space.keys.map((key, i) => ({ key, label: space.labels[i] })),
    droppedFeatures: space.dropped,
    scaling: 'Each feature is replaced by its percentile among all genes in this dataset. A gene '
      + 'with no value for a feature is compared on the features it has; it is never given a '
      + 'stand-in number.',
    constraintsApplied: constraints.active.map((entry) => ({
      id: entry.id,
      label: entry.label,
      borrowed: entry.borrowed === true,
      missingPolicy: entry.missingPolicy ?? null,
    })),
    constraintsBlocked: constraints.blocked.map((entry) => ({
      id: entry.id, label: entry.label, reason: entry.reason,
    })),
    eligibleGeneCount: design.eligibility.pool.length,
    feasible: design.feasible,
    shortfall: design.shortfall,
    problems: design.problems,
    genes: design.genes.map((gene) => ({
      id: gene.id,
      order: gene.order,
      role: gene.role,
      nearestSelected: gene.nearestId,
      nearestDistance: gene.nearestDistance,
      missingFeatures: gene.missingFeatures,
      expands: gene.expands.map((entry) => ({
        key: entry.key, label: entry.label, percentile: entry.percentile,
        bin: entry.bin, newBin: entry.newBin, direction: entry.direction,
      })),
      satisfies: gene.satisfies,
      caveats: gene.caveats,
    })),
    coverageBefore: summariseCoverage(design.coverageBefore),
    coverageAfter: summariseCoverage(design.coverageAfter),
  };
}

function summariseCoverage(coverage) {
  return {
    members: coverage.members,
    filledBins: coverage.filledBins,
    totalBins: coverage.totalBins,
    binFraction: Number.isFinite(coverage.binFraction) ? coverage.binFraction : null,
    minPairDistance: Number.isFinite(coverage.minPairDistance) ? coverage.minPairDistance : null,
    meanPairDistance: Number.isFinite(coverage.meanPairDistance) ? coverage.meanPairDistance : null,
    perFeature: coverage.perFeature.map((entry) => ({
      key: entry.key,
      label: entry.label,
      binCount: entry.binCount,
      bins: entry.bins,
      min: Number.isFinite(entry.min) ? entry.min : null,
      max: Number.isFinite(entry.max) ? entry.max : null,
      missing: entry.missing,
    })),
  };
}

/** Filename stem: what it is, under which schemes, when, and which manifest. */
export function panelFileBase(manifest) {
  const { schemes } = manifest;
  const part = schemes.length === 1
    ? (schemes[0].name ? schemes[0].name.replace(/[^A-Za-z0-9+-]+/g, '_') : schemes[0].schemeId
      .replace(/^scheme:/, '').replace(/\./g, '+')).slice(0, 48) || 'unnamed'
    : `${schemes.length}-schemes`;
  const stamp = manifest.generatedAt.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `${PANEL_EXPORT_BASENAME}_${manifest.panelDesign.size}-genes_${part}_${stamp}`
    + `_${manifest.manifestId.slice(0, 10)}`;
}

/**
 * Build the panel's manifest and CSV.
 *
 * @param {{dataset: object, registry: object, design: object, space: object,
 *   schemes: Array<{name?: string|null, map: object}>, generatedAt?: Date}} options
 * @returns {{manifest: object, csv: string, columns: string[], rows: object[],
 *   baseName: string, files: Array<{name: string, type: string, content: string}>}}
 */
export function buildPanelExport({
  dataset, registry, design, space, schemes, generatedAt = new Date(),
}) {
  const base = buildExport({
    dataset, registry, ids: design.selected, schemes, generatedAt,
  });
  const byId = new Map(design.genes.map((gene) => [gene.id, gene]));
  const columns = [...base.columns, ...PANEL_COLUMNS];
  const rows = base.rows.map((row) => {
    const gene = byId.get(row.id);
    return {
      ...row,
      panelOrder: gene ? gene.order + 1 : '',
      panelRole: gene ? gene.role : '',
      nearestSelected: gene?.nearestId ?? '',
      nearestDistance: Number.isFinite(gene?.nearestDistance) ? gene.nearestDistance : '',
      missingFeatures: gene ? gene.missingFeatures : '',
    };
  });

  const manifest = {
    ...base.manifest,
    manifestId: '',
    generator: 'recoding-diversity-map panel design',
    columns,
    panelDesign: designBlock(design, space),
  };
  manifest.caveats = [
    ...base.manifest.caveats,
    'This panel is a coverage design over measured and computed gene properties. It is not a '
      + 'prediction of recoded fitness, and becomes one only when measured outcomes exist and a '
      + 'model has been validated against them.',
    'Feature percentiles are computed over every gene in this dataset, so they do not change when '
      + 'a constraint changes.',
  ];

  const csvFor = (manifestId) => {
    const lines = [columns.map(csvField).join(',')];
    for (const row of rows) {
      lines.push(columns
        .map((column) => csvField(column === 'manifestId' ? manifestId : row[column]))
        .join(','));
    }
    return `${lines.join('\n')}\n`;
  };

  manifest.contentDigest = fnv1a64(csvFor(''));
  const { manifestId: _ignored, ...body } = manifest;
  manifest.manifestId = fnv1a64(canonicalJson(body));
  for (const row of rows) row.manifestId = manifest.manifestId;

  const csv = csvFor(manifest.manifestId);
  const baseName = panelFileBase(manifest);
  return {
    manifest,
    csv,
    columns,
    rows,
    baseName,
    files: [
      { name: `${baseName}.csv`, type: 'text/csv;charset=utf-8', content: csv },
      {
        name: `${baseName}.manifest.json`,
        type: 'application/json;charset=utf-8',
        content: `${JSON.stringify(manifest, null, 2)}\n`,
      },
    ],
  };
}

/**
 * Read a panel manifest back into the configuration that produced it, so the
 * same design can be rebuilt and checked rather than taken on trust.
 *
 * @param {object} manifest parsed from a `.manifest.json` this module wrote.
 * @returns {{config: object, selected: string[], schemes: Array<object>,
 *   features: string[], dataset: object, coverageAfter: object}}
 */
export function readPanelDesign(manifest) {
  const design = manifest?.panelDesign;
  if (!design) throw new Error('this manifest carries no panel design');
  if (design.panelDesignVersion !== PANEL_DESIGN_VERSION) {
    throw new Error(`panel design version ${design.panelDesignVersion} is not version `
      + `${PANEL_DESIGN_VERSION}`);
  }
  const config = normaliseConfig({
    size: design.size,
    seeds: design.seeds,
    include: design.include,
    exclude: design.exclude,
    ranges: design.ranges,
    replicons: design.replicons,
    ...design.flags,
  });
  return {
    config,
    selected: design.genes.map((gene) => gene.id),
    schemes: manifest.schemes.map((scheme) => ({
      schemeId: scheme.schemeId, name: scheme.name, map: scheme.map,
    })),
    features: design.features.map((feature) => feature.key),
    dataset: manifest.dataset,
    coverageAfter: design.coverageAfter,
  };
}

/** The scheme descriptors a design should compute per-scheme features for. */
export function describeSchemes(schemes) {
  const seen = new Map();
  for (const entry of schemes ?? []) {
    const map = entry?.map ?? {};
    const schemeId = schemeIdOf(map);
    if (seen.has(schemeId)) continue;
    seen.set(schemeId, { schemeId, name: entry?.name || null, map });
  }
  if (seen.size === 0) {
    const schemeId = schemeIdOf({});
    seen.set(schemeId, { schemeId, name: null, map: {} });
  }
  return [...seen.values()];
}
