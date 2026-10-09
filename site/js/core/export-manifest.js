/**
 * Reproducible export of the candidate shortlist: one manifest, one flat CSV.
 *
 * Every scheme-dependent number changes with the scheme, so a CSV that names only
 * the gene cannot be traced back to what produced it. Each row therefore carries
 * the manifest identifier and an explicit scheme identifier, and the manifest
 * carries everything needed to recompute the row: dataset identity and checksums,
 * the complete scheme map, the metric definitions, and the caveats. Multi-scheme
 * exports use one row per gene and scheme rather than widening the table.
 *
 * An export is one organism's: the manifest names it, a file name carries its
 * tag, and every column, manifest key, and caveat that belongs to a study-bound
 * layer is written only for an organism whose record declares that layer. An
 * empty column would say the layer was looked at and found empty.
 *
 * Nothing here touches the DOM, so the round trip is testable in Node.
 */
import { dataFileLabel, firstUnsettled } from './data-files.js';
import {
  fillTemplate, layerOf, organismById, organismIdentity, organismOf, sourceIds,
} from './organisms.js';
import {
  compileScheme, serializeSchemeMap, replacementAt, occurrenceCounter,
} from './scheme.js';
import { computeLiveMetrics, INITIATION_INDEX } from './live-metrics.js';
import { declaredMeasurementSources, expressionBasisOf } from './metric-registry.js';
import { tssInitiationBasis } from './tss-evidence.js';
import { metricHelp } from './metric-help.js';
import { reviewedFunctionLabels } from './function-categories.js';
import { discrepancyCell, essentialityEvidenceFor } from './go-iea-essentiality.js';
import {
  annotationSourceId, annotationSourceLabel, normalizeAnnotationSources,
} from './annotation-source.js';
import { categoryResolutionFor, conflictNote } from './source-derived-categories.js';
import { csvField } from '../ui/format.js';

export const MANIFEST_VERSION = 2;
export const WILD_TYPE_SCHEME_ID = 'wild-type';
export const EXPORT_BASENAME = 'recoding-candidates';

/** Columns that identify a row, before the metric columns. */
export const IDENTITY_COLUMNS = Object.freeze([
  'manifestId', 'schemeId', 'schemeName', 'id', 'name', 'product',
  'functionCategory', 'reviewedFunctionCategories', 'functionReviewStatus',
  'functionCategoryEvidence', 'functionCategoryConflict',
  'pcc7942DerivedCategory', 'pcc7942DerivedProbability',
  'goIeaDerivedCategory', 'goIeaDerivedProbability',
  'seqid', 'start', 'end',
  'strand', 'lengthNt', 'lengthCodons', 'startCodon', 'terminalStop', 'recodedTerminalStop',
  'translationalException', 'cdsSegmentCount', 'cdsSegments', 'overlapsNeighbor',
  'overlapClass', 'overlapPartnerCount', 'overlapSharedBases', 'overlapPartners', 'operonId',
  'expressionBasis', 'expressionSourceId', 'tssInitiationBasis',
  'tssInitiationBasisReason', 'tssMappedSiteCount', 'passesCurrentFilters',
  'pcc7942Essentiality', 'pcc7942LocusTag', 'pcc7942MappingStatus',
  'essentialityEvidenceTier', 'goIeaEssentialityContext', 'goIeaCoreProcessProbability',
  'annotationDiscrepancies',
]);

/** The identity columns each study-bound layer owns. */
const LAYER_COLUMNS = Object.freeze({
  functionCategories: ['functionCategory', 'reviewedFunctionCategories', 'functionReviewStatus',
    'functionCategoryEvidence', 'functionCategoryConflict'],
  sourceDerivedCategories: ['pcc7942DerivedCategory', 'pcc7942DerivedProbability',
    'goIeaDerivedCategory', 'goIeaDerivedProbability'],
  tssEvidence: ['tssInitiationBasis', 'tssInitiationBasisReason', 'tssMappedSiteCount'],
  candidateEvidence: ['pcc7942Essentiality', 'pcc7942LocusTag', 'pcc7942MappingStatus'],
  goIeaEssentiality: ['essentialityEvidenceTier', 'goIeaEssentialityContext',
    'goIeaCoreProcessProbability', 'annotationDiscrepancies'],
});

/** The `dataset` keys of a manifest each study-bound layer owns. */
const LAYER_DATASET_KEYS = Object.freeze({
  functionCategories: ['functionCategories'],
  sourceDerivedCategories: ['sourceDerivedCategories'],
  tssEvidence: ['tssEvidenceSource'],
  candidateEvidence: ['candidateEvidence'],
  goIeaEssentiality: ['goIeaEssentiality'],
});

/** The per-gene keys of a manifest each study-bound layer owns. */
const LAYER_GENE_KEYS = Object.freeze({
  functionCategories: ['functionCategory', 'functionCategoryEvidence', 'functionCategoryConflicts',
    'reviewedFunctionCategories', 'reviewedFunctionAssignment'],
  sourceDerivedCategories: ['derivedFunctionCategories'],
  tssEvidence: ['tssInitiationBasis', 'tssInitiationBasisDetail'],
  candidateEvidence: ['testedAllele', 'pcc7942Essentiality'],
  goIeaEssentiality: ['essentialityEvidence'],
});

/** Every name in `byLayer` whose layer this organism does not declare. */
function undeclared(byLayer, organism) {
  return Object.entries(byLayer)
    .filter(([key]) => !layerOf(organism, key))
    .flatMap(([, names]) => names);
}

/** A copy of `record` without the named keys. */
function without(record, names) {
  const copy = { ...record };
  for (const name of names) delete copy[name];
  return copy;
}

/** The identity columns one organism's export carries. */
export function identityColumnsFor(organism) {
  const omitted = new Set(undeclared(LAYER_COLUMNS, organism));
  return IDENTITY_COLUMNS.filter((column) => !omitted.has(column));
}

/** Columns after the metrics: the sequences that let every live metric be recomputed. */
export const SEQUENCE_COLUMNS = Object.freeze(['wildTypeCds', 'recodedCds']);

/** Resolve the pooled-score metric only through the site layer's declared source link. */
function tssLayerMetric(registry, siteSource) {
  const sourceId = siteSource?.pooledScoreSourceId;
  if (!sourceId) return null;
  return registry.metrics.find((metric) => metric.provenance?.id === sourceId) ?? null;
}

/** A stable identifier for a scheme map, independent of its name or key order. */
export function schemeIdOf(map) {
  const serialized = serializeSchemeMap(map);
  return serialized ? `scheme:${serialized}` : WILD_TYPE_SCHEME_ID;
}

/** JSON with object keys sorted at every level, so equal content hashes equal. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

/**
 * 64-bit FNV-1a as sixteen hex digits. It is a content identifier, not a security
 * primitive: two exports with different content get different identifiers, which is
 * what telling two scheme runs apart needs.
 */
export function fnv1a64(text) {
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  let hash = 0xcbf29ce484222325n;
  const bytes = new TextEncoder().encode(text);
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, '0');
}

/**
 * Wild-type and recoded coding sequences for one gene under a compiled scheme.
 * Position zero is never recoded; the terminal stop follows the scheme's stop map.
 * @returns {{wildType: string, recoded: string, wildTypeStop: string|null, recodedStop: string|null}}
 */
export function recodedSequence(dataset, index, scheme) {
  const { packed, offsets, table, stopCodons } = dataset;
  let wildType = '';
  let recoded = '';
  // Per-occurrence resolution, counted from the start of this gene and skipping
  // position zero, which is the same rule the live metrics apply. The exported
  // sequence must be the sequence those metrics were computed from.
  const occurrences = occurrenceCounter();
  for (let i = offsets[index]; i < offsets[index + 1]; i += 1) {
    const original = packed[i];
    wildType += table.codons[original];
    const position = i - offsets[index];
    let replacementIndex = original;
    if (position !== INITIATION_INDEX) {
      replacementIndex = replacementAt(scheme, original, occurrences[original]);
      occurrences[original] += 1;
    }
    recoded += table.codons[replacementIndex];
  }
  const stop = stopCodons ? stopCodons[index] : -1;
  const wildTypeStop = stop >= 0 ? table.codons[stop] : null;
  const recodedStop = stop >= 0
    ? table.codons[replacementAt(scheme, stop, occurrences[stop])]
    : null;
  return {
    wildType: wildType + (wildTypeStop ?? ''),
    recoded: recoded + (recodedStop ?? ''),
    wildTypeStop,
    recodedStop,
  };
}

/** Normalise the caller's scheme list: dedupe by identifier, keep first name seen. */
function normaliseSchemes(schemes) {
  const seen = new Map();
  for (const entry of schemes ?? []) {
    const map = entry?.map ?? {};
    const schemeId = schemeIdOf(map);
    if (seen.has(schemeId)) continue;
    seen.set(schemeId, {
      schemeId,
      name: entry?.name ? String(entry.name) : null,
      map: Object.fromEntries(Object.keys(map).sort().map((codon) => [codon, map[codon]])),
      targets: Object.keys(map).sort(),
    });
  }
  if (seen.size === 0) {
    seen.set(WILD_TYPE_SCHEME_ID, { schemeId: WILD_TYPE_SCHEME_ID, name: null, map: {}, targets: [] });
  }
  return [...seen.values()];
}

/** The pipeline's annotation release, when it publishes one; null is an explicit unknown. */
function annotationRelease(meta) {
  return meta.annotationRelease ?? meta.annotation?.release ?? null;
}

/** A filename-safe slug: codon pairs keep their case, everything else is simplified. */
function slug(text, limit = 48) {
  const cleaned = String(text).replace(/[^A-Za-z0-9+-]+/g, '_').replace(/^_+|_+$/g, '');
  return (cleaned || 'unnamed').slice(0, limit);
}

function timestampSlug(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/**
 * The organism part of an export file name, with its leading separator, or ''.
 *
 * The default organism's files keep the names they have always had; any other
 * organism's carry its tag, so two organisms' files cannot be mistaken on disk.
 */
export function organismFileTag(manifest) {
  const tag = organismById(manifest.organism?.id)?.exportTag ?? null;
  return tag ? `_${tag}` : '';
}

/** Filename stem: what was exported, of which organism, when, and which manifest. */
export function exportFileBase(manifest) {
  const { schemes } = manifest;
  const schemePart = schemes.length === 1
    ? slug(schemes[0].name ?? schemes[0].schemeId.replace(/^scheme:/, '').replace(/\./g, '+'))
    : `${schemes.length}-schemes`;
  return `${EXPORT_BASENAME}${organismFileTag(manifest)}_${schemePart}`
    + `_${timestampSlug(new Date(manifest.generatedAt))}_${manifest.manifestId.slice(0, 10)}`;
}

/** Provenance for the measurement columns actually written, without the source dossier. */
function measurementSourcesForExport(meta, metrics) {
  const ids = new Set(metrics.flatMap((metric) => {
    const source = metric.provenance;
    return Array.isArray(source?.pooled) ? source.pooled : [source?.id ?? source?.accession];
  }).filter((id) => typeof id === 'string'));
  const keys = new Set(metrics.map((metric) => metric.key));
  return declaredMeasurementSources(meta)
    .filter((source) => !Array.isArray(meta.expressionSources)
      || ids.has(source.id ?? source.accession) || keys.has(source.metricKey))
    .map(({ record: _dossier, ...source }) => source);
}

function caveatsFor(dataset, manifest, organism) {
  const { meta } = dataset;
  const layer = (key) => layerOf(organism, key);
  const caveats = [];
  const colourSources = manifest.functionColourSources;
  if (colourSources && dataset.functionCategories) {
    caveats.push(`functionCategory was resolved with these sources enabled for colouring: `
      + `${colourSources.label} (${colourSources.enabled.join(', ') || 'none'}). Every row still `
      + 'carries every source’s annotations; the toggles govern colour and legend counts only.');
  }
  caveats.push(
    'Codon position zero is the initiation triplet and is never recoded; it is excluded from '
      + 'every target count.',
    'targetCount and targetFraction include a reassigned terminal stop; density windows, '
      + 'clusters, and the ramp count are defined over sense codons only. lengthCodons excludes '
      + 'the stop.',
    'Pipeline metrics are scheme-independent and repeat across scheme rows for the same gene. '
      + 'Live metrics were recomputed in the browser for the scheme named on the row.',
    'An empty metric cell is a missing value, never zero.',
    'expressionBasis is one of measured, proxy, none, or unrecorded. A proxy is a codon-adaptation '
      + 'rank from this genome and is never written into the expression column.',
  );
  for (const source of manifest.expressionSources) {
    if (!source.caveat) continue;
    caveats.push(`Measurement${source.id ? ` (${source.id})` : ''}: ${source.caveat} Measured in `
      + `${source.organism ?? source.organismMeasured ?? 'an unstated organism'}`
      + `${source.condition ? `, ${source.condition}` : ''}.`);
  }
  // Each study-bound layer's caveat is the sentence its organism's record
  // gives it, and is written only where that organism declares the layer.
  if (layer('tssEvidence') && meta.tssEvidenceSource) {
    caveats.push(layer('tssEvidence').exportCaveat);
  }
  if (layer('candidateEvidence')
    && manifest.dataset.candidateEvidence?.borrowedEssentiality?.status === 'available') {
    caveats.push(layer('candidateEvidence').exportCaveat);
  }
  if (layer('goIeaEssentiality') && dataset.goIeaEssentiality) {
    caveats.push(fillTemplate(layer('goIeaEssentiality').exportCaveat,
      { model: dataset.goIeaEssentiality.judgment.model }));
  }
  if (dataset.goTerms) caveats.push(organism.copy.goTermsCaveat);
  if (layer('functionCategories') && dataset.functionCategories) {
    const categorySource = dataset.functionCategories.source;
    caveats.push(fillTemplate(layer('functionCategories').exportCaveat, {
      rows: categorySource.coverage.reviewedRows,
      date: categorySource.provenance.userReview.date,
    }));
  }
  if (layer('sourceDerivedCategories') && dataset.sourceDerivedCategories) {
    const derived = dataset.sourceDerivedCategories;
    caveats.push(fillTemplate(layer('sourceDerivedCategories').exportCaveat, {
      model: derived.judgment.model,
      rubric: derived.judgment.rubricVersion,
      threshold: derived.policy.thresholds.derivedProbabilityAtLeast,
    }));
  }
  if (manifest.dataset.annotationRelease === null) {
    caveats.push('meta.json does not publish the annotation release, so it is recorded as null '
      + 'rather than inferred.');
  }
  return caveats;
}

/** The later files an export reads a field from. */
export const EXPORT_FILE_KEYS = Object.freeze([
  'sourceDerivedCategories', 'annotations', 'candidateEvidence', 'goIeaEssentiality', 'goTerms',
  'tssEvidence',
]);

/**
 * Why an export cannot be written yet, or null when it can.
 *
 * An export records every field as it stands. A field whose file has not
 * landed would be written as empty, and an empty field in a manifest says the
 * evidence is absent, so nothing is written until every file it reads has
 * settled without failing.
 */
export function exportBlockedReason(dataset) {
  const waiting = firstUnsettled(dataset, EXPORT_FILE_KEYS);
  if (!waiting) return null;
  const label = dataFileLabel(waiting.file, organismOf(dataset));
  return waiting.state === 'failed'
    ? `The export cannot be written because the ${label} could not be loaded. `
      + 'Retry that file from the notice above the map.'
    : `The export is waiting on the ${label}, which is still loading.`;
}

/**
 * Build the manifest and CSV for a shortlist under one or more schemes.
 *
 * @param {{dataset: object, registry: object, ids: string[],
 *   schemes: Array<{name?: string, map: object}>, generatedAt?: Date}} options
 * @returns {{manifest: object, csv: string, columns: string[], rows: object[],
 *   baseName: string, files: Array<{name: string, type: string, content: string}>}}
 */
export function buildExport({
  dataset, registry, ids, schemes, generatedAt = new Date(),
  filterState = null, filterMask = null, viewState = null,
  colorSources = undefined, trRosettaRnaHandoffs = [],
}) {
  const blocked = exportBlockedReason(dataset);
  if (blocked) throw new Error(blocked);
  const organism = organismOf(dataset);
  const toggles = organism.annotationSources;
  const roleIds = sourceIds(organism);
  // The sources enabled for category colouring; every other field is unscoped.
  const sources = normalizeAnnotationSources(colorSources, toggles);
  const { meta, genes, indexById, table } = dataset;
  const schemeList = normaliseSchemes(schemes);
  const metrics = registry.metrics;
  const tssMetric = tssLayerMetric(registry, meta.tssEvidenceSource);
  const columns = [
    ...identityColumnsFor(organism), ...metrics.map((metric) => metric.key), ...SEQUENCE_COLUMNS,
  ];
  const omittedColumns = undeclared(LAYER_COLUMNS, organism);
  const omittedGeneKeys = undeclared(LAYER_GENE_KEYS, organism);

  const rows = [];
  for (const scheme of schemeList) {
    const compiled = compileScheme(scheme.map, table);
    const live = computeLiveMetrics(dataset, compiled, { baseline: dataset.baseline }).fields;
    for (const id of ids) {
      const index = indexById.get(id);
      if (index === undefined) continue;
      const gene = genes[index];
      const sequence = recodedSequence(dataset, index, compiled);
      const basis = expressionBasisOf(gene);
      const tssBasis = tssInitiationBasis(gene, {
        metric: tssMetric,
        siteSource: meta.tssEvidenceSource,
        value: tssMetric?.read(index),
      });
      const category = categoryResolutionFor({
        reviewed: dataset.functionCategories, derived: dataset.sourceDerivedCategories,
        sources, locusId: id, organism,
      });
      // Every judged source's own category is a data fact and is always exported,
      // whether or not that source is enabled for colouring.
      const derivedCell = (sourceId) => {
        const entry = category?.perSource[sourceId];
        return entry?.judged ? {
          category: entry.label ?? '', probability: entry.categoryId ? entry.probability : '',
        } : { category: '', probability: '' };
      };
      const pccDerived = derivedCell(roleIds.product);
      const goDerived = derivedCell(roleIds.go);
      const pccCall = dataset.candidateEvidence?.borrowedEssentiality?.byLocus?.[id] ?? null;
      const evidence = essentialityEvidenceFor(dataset.goIeaEssentiality, id, organism);
      const row = without({
        manifestId: '',
        schemeId: scheme.schemeId,
        schemeName: scheme.name ?? '',
        id: gene.id,
        name: gene.name ?? '',
        product: gene.product ?? '',
        // The colour bucket under the sources enabled for colouring.
        functionCategory: category?.label ?? '',
        reviewedFunctionCategories: reviewedFunctionLabels(dataset.functionCategories, gene.id).join('; '),
        functionReviewStatus: dataset.functionCategories
          ? dataset.functionCategories.assignmentsById.has(gene.id) ? 'reviewed' : 'unreviewed'
          : '',
        functionCategoryEvidence: category?.evidence ?? '',
        functionCategoryConflict: conflictNote(category, organism),
        pcc7942DerivedCategory: pccDerived.category,
        pcc7942DerivedProbability: pccDerived.probability,
        goIeaDerivedCategory: goDerived.category,
        goIeaDerivedProbability: goDerived.probability,
        seqid: gene.seqid ?? '',
        start: gene.start,
        end: gene.end,
        strand: gene.strand ?? '',
        lengthNt: gene.lengthNt,
        lengthCodons: gene.lengthCodons,
        startCodon: sequence.wildType.slice(0, 3),
        terminalStop: sequence.wildTypeStop ?? '',
        recodedTerminalStop: sequence.recodedStop ?? '',
        translationalException: gene.translationalException ?? '',
        cdsSegmentCount: Array.isArray(gene.cdsSegments) ? gene.cdsSegments.length : 1,
        cdsSegments: Array.isArray(gene.cdsSegments) ? JSON.stringify(gene.cdsSegments) : '',
        // The adjacent-CDS envelope flag the pipeline writes, kept under its
        // own name and its own meaning. The four columns beside it are the OG
        // relation: every annotated gene, exact segments, both strands.
        overlapsNeighbor: typeof gene.overlapsNeighbor === 'boolean' ? String(gene.overlapsNeighbor) : '',
        overlapClass: gene.overlapClass ?? '',
        overlapPartnerCount: Array.isArray(gene.overlapPartners)
          ? gene.overlapPartners.length : '',
        overlapSharedBases: Array.isArray(gene.overlapPartners)
          ? gene.overlapPartners.reduce((total, partner) => total + partner.sharedBases, 0) : '',
        overlapPartners: Array.isArray(gene.overlapPartners)
          ? gene.overlapPartners.map((partner) => `${partner.id}:${partner.biotype}:`
            + `${partner.strand ?? '?'}:${partner.sharedBases}:`
            + partner.sharedIntervals.map((piece) => `${piece.from}-${piece.to}`).join('+'))
            .join('; ')
          : '',
        operonId: gene.operonId ?? '',
        expressionBasis: basis.basis,
        expressionSourceId: gene.expressionSourceId ?? '',
        tssInitiationBasis: tssBasis.short,
        tssInitiationBasisReason: tssBasis.text,
        tssMappedSiteCount: tssBasis.siteCount ?? '',
        passesCurrentFilters: filterMask ? String(Boolean(filterMask[index])) : '',
        pcc7942Essentiality: pccCall?.status ?? '',
        pcc7942LocusTag: pccCall?.pccLocusTag ?? '',
        pcc7942MappingStatus: pccCall?.mappingStatus ?? '',
        essentialityEvidenceTier: evidence?.tier ?? '',
        goIeaEssentialityContext: evidence?.goContext?.label ?? '',
        goIeaCoreProcessProbability: evidence?.goContext?.pCore ?? '',
        annotationDiscrepancies: discrepancyCell(evidence),
        wildTypeCds: sequence.wildType,
        recodedCds: sequence.recoded,
      }, omittedColumns);
      for (const metric of metrics) {
        const value = metric.source === 'live' ? live[metric.key][index] : metric.read(index);
        row[metric.key] = Number.isFinite(value) ? value : '';
      }
      rows.push(row);
    }
  }

  const csvFor = (manifestId) => {
    const lines = [columns.map(csvField).join(',')];
    for (const row of rows) {
      lines.push(columns.map((column) => csvField(column === 'manifestId' ? manifestId : row[column])).join(','));
    }
    return `${lines.join('\n')}\n`;
  };

  const provenance = dataset.provenance ?? {};
  const manifest = {
    manifestVersion: MANIFEST_VERSION,
    manifestId: '',
    generatedAt: generatedAt.toISOString(),
    generator: 'recoding-diversity-map site export',
    // Which organism every row, checksum, and caveat below belongs to.
    organism: organismIdentity(organism),
    dataset: without({
      schemaVersion: meta.schemaVersion ?? null,
      builtAt: meta.builtAt ?? null,
      genome: meta.genome ?? null,
      annotationRelease: annotationRelease(meta),
      tssEvidenceSource: meta.tssEvidenceSource ?? null,
      candidateEvidence: dataset.candidateEvidence ? {
        manifestSha256: dataset.candidateEvidence.manifestSha256,
        testedSource: dataset.candidateEvidence.testedSource,
        borrowedEssentiality: dataset.candidateEvidence.borrowedEssentiality ? {
          status: dataset.candidateEvidence.borrowedEssentiality.status,
          source: dataset.candidateEvidence.borrowedEssentiality.source,
          summary: dataset.candidateEvidence.borrowedEssentiality.summary,
        } : null,
      } : null,
      goIeaEssentiality: dataset.goIeaEssentiality ? {
        datasetVersion: dataset.goIeaEssentiality.datasetVersion,
        attribution: dataset.goIeaEssentiality.attribution,
        judgment: dataset.goIeaEssentiality.judgment,
        policy: dataset.goIeaEssentiality.policy,
        counts: dataset.goIeaEssentiality.counts,
      } : null,
      goTermNames: dataset.goTerms?.source ?? null,
      sourceDerivedCategories: dataset.sourceDerivedCategories ? {
        datasetVersion: dataset.sourceDerivedCategories.datasetVersion,
        attribution: dataset.sourceDerivedCategories.attribution,
        judgment: dataset.sourceDerivedCategories.judgment,
        policy: dataset.sourceDerivedCategories.policy,
        counts: dataset.sourceDerivedCategories.counts,
      } : null,
      functionCategories: dataset.functionCategories ? {
        datasetVersion: dataset.functionCategories.source.datasetVersion,
        provenance: dataset.functionCategories.source.provenance,
        policy: dataset.functionCategories.source.policy,
        vocabulary: dataset.functionCategories.source.vocabulary,
        coverage: dataset.functionCategories.source.coverage,
      } : null,
      sourceChecksums: meta.sourceChecksums ?? {},
      geneCount: meta.geneCount ?? genes.length,
      loadedGeneCount: genes.length,
    }, undeclared(LAYER_DATASET_KEYS, organism)),
    expressionSource: meta.expressionSource ?? null,
    expressionSources: measurementSourcesForExport(meta, metrics),
    filterState: filterState ?? null,
    viewState: viewState ?? null,
    // Which sources were enabled for category colouring when this file was made.
    // An organism with no colour source has no such choice to record.
    ...(toggles.length > 0 ? {
      functionColourSources: {
        id: annotationSourceId(sources, toggles),
        label: annotationSourceLabel(sources, toggles),
        enabled: sources,
      },
    } : {}),
    trRosettaRnaHandoffs: trRosettaRnaHandoffs.map((entry) => ({
      locus: entry.locus,
      form: entry.form,
      schemeName: entry.schemeName ?? null,
      region: entry.region,
      formats: [...entry.formats],
      sequenceHash: entry.sequenceHash,
      viennaRnaVersion: entry.viennaRnaVersion ?? null,
    })),
    schemes: schemeList,
    genes: ids
      .filter((id) => indexById.has(id))
      .map((id) => {
        const index = indexById.get(id);
        const gene = genes[index];
        const tssBasis = tssInitiationBasis(gene, {
          metric: tssMetric,
          siteSource: meta.tssEvidenceSource,
          value: tssMetric?.read(index),
        });
        const category = categoryResolutionFor({
          reviewed: dataset.functionCategories, derived: dataset.sourceDerivedCategories,
          sources, locusId: id, organism,
        });
        const derivedEntry = (sourceId) => {
          const entry = category?.perSource[sourceId];
          if (!entry?.judged) return null;
          return {
            categoryId: entry.categoryId, label: entry.label, mostLikely: entry.mostLikely,
            probability: entry.probability, pccLocusTag: entry.pccLocusTag,
            enabledForColouring: entry.enabled,
          };
        };
        const goAnnotations = (gene.annotationEvidence?.goAnnotations ?? []).map((relation) => ({
          ...relation,
          name: dataset.goTerms?.terms?.[relation.goId]?.name ?? null,
          isObsoleteInNameRelease: Boolean(
            dataset.goTerms?.terms?.[relation.goId]?.isObsolete
          ),
        }));
        return without({
          id: gene.id,
          name: gene.name ?? null,
          product: gene.product ?? null,
          terminalStop: gene.terminalStop ?? null,
          translationalException: gene.translationalException ?? null,
          cdsSegments: gene.cdsSegments ?? null,
          expressionBasis: expressionBasisOf(gene).basis,
          tssInitiationBasis: tssBasis.short,
          tssInitiationBasisDetail: {
            basis: tssBasis.basis,
            reason: tssBasis.text || null,
            mappedSiteCount: tssBasis.siteCount,
          },
          testedAllele: dataset.candidateEvidence?.testedAlleles[id] ?? null,
          essentialityEvidence: dataset.goIeaEssentiality?.byLocus?.[id] ?? null,
          pcc7942Essentiality: dataset.candidateEvidence?.borrowedEssentiality?.byLocus?.[id] ?? null,
          functionCategory: category?.label ?? null,
          functionCategoryEvidence: category?.evidence ?? null,
          functionCategoryConflicts: category?.conflicts ?? [],
          reviewedFunctionCategories: reviewedFunctionLabels(dataset.functionCategories, id),
          reviewedFunctionAssignment: dataset.functionCategories?.assignmentsById.get(id) ?? null,
          derivedFunctionCategories: Object.fromEntries([roleIds.product, roleIds.go]
            .filter(Boolean).map((sourceId) => [sourceId, derivedEntry(sourceId)])),
          goAnnotations,
        }, omittedGeneKeys);
      }),
    metrics: metrics.map((metric) => {
      const help = metricHelp(metric, dataset);
      return {
        key: metric.key,
        label: metric.label,
        unit: metric.unit ?? '',
        desc: metric.desc ?? '',
        method: help.method,
        origin: help.origin,
        coverage: help.coverage,
        citationIds: help.citations,
        family: metric.family,
        source: metric.source,
        scale: metric.scale ?? null,
      };
    }),
    columns,
    rowCount: rows.length,
    contentDigest: fnv1a64(csvFor('')),
    provenance: {
      caiReferenceGenes: provenance.caiReferenceGenes ?? null,
      caiReferenceFallback: provenance.caiReferenceFallback ?? null,
      taiZeroWeightCodons: provenance.taiReport?.zeroWeightCodons ?? null,
      conventionsFromMeta: (provenance.conventionReport?.fromMeta ?? []).map((entry) => entry.label),
      conventionsAssumed: (provenance.conventionReport?.fallbacks ?? []).map((entry) => entry.label),
      recomputationAgreement: (provenance.agreement ?? []).map((entry) => ({
        key: entry.key, agrees: entry.agrees, worst: entry.worst,
      })),
    },
    caveats: [],
  };
  manifest.caveats = caveatsFor(dataset, manifest, organism);
  const { manifestId: _ignored, ...body } = manifest;
  manifest.manifestId = fnv1a64(canonicalJson(body));
  for (const row of rows) row.manifestId = manifest.manifestId;

  const csv = csvFor(manifest.manifestId);
  const baseName = exportFileBase(manifest);
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
 * Parse RFC 4180 CSV as written by `buildExport`: quoted fields may contain commas,
 * newlines, and doubled quotes. Returns objects keyed by the header row.
 * @returns {{header: string[], rows: Array<Record<string, string>>}}
 */
export function parseCsv(text) {
  const records = [];
  let record = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  const [header = [], ...body] = records;
  const rows = body.map((cells) => Object.fromEntries(header.map((key, i) => [key, cells[i] ?? ''])));
  return { header, rows };
}
