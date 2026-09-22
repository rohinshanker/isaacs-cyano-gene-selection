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
 * Nothing here touches the DOM, so the round trip is testable in Node.
 */
import { compileScheme, serializeSchemeMap } from './scheme.js';
import { computeLiveMetrics, INITIATION_INDEX } from './live-metrics.js';
import { expressionBasisOf } from './metric-registry.js';
import { metricHelp } from './metric-help.js';
import { functionCategoryLabel, reviewedFunctionLabels } from './function-categories.js';
import { csvField } from '../ui/format.js';

export const MANIFEST_VERSION = 1;
export const WILD_TYPE_SCHEME_ID = 'wild-type';
export const EXPORT_BASENAME = 'recoding-candidates';

/** Columns that identify a row, before the metric columns. */
export const IDENTITY_COLUMNS = Object.freeze([
  'manifestId', 'schemeId', 'schemeName', 'id', 'name', 'product',
  'functionCategory', 'reviewedFunctionCategories', 'functionReviewStatus',
  'seqid', 'start', 'end',
  'strand', 'lengthNt', 'lengthCodons', 'startCodon', 'terminalStop', 'recodedTerminalStop',
  'translationalException', 'cdsSegmentCount', 'cdsSegments', 'overlapsNeighbor', 'operonId',
  'expressionBasis', 'expressionSourceId', 'passesCurrentFilters',
]);

/** Columns after the metrics: the sequences that let every live metric be recomputed. */
export const SEQUENCE_COLUMNS = Object.freeze(['wildTypeCds', 'recodedCds']);

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
  for (let i = offsets[index]; i < offsets[index + 1]; i += 1) {
    const original = packed[i];
    wildType += table.codons[original];
    const position = i - offsets[index];
    recoded += table.codons[position === INITIATION_INDEX ? original : scheme.replacement[original]];
  }
  const stop = stopCodons ? stopCodons[index] : -1;
  const wildTypeStop = stop >= 0 ? table.codons[stop] : null;
  const recodedStop = stop >= 0 ? table.codons[scheme.replacement[stop]] : null;
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

/** Filename stem: what was exported, when, and which manifest it belongs to. */
export function exportFileBase(manifest) {
  const { schemes } = manifest;
  const schemePart = schemes.length === 1
    ? slug(schemes[0].name ?? schemes[0].schemeId.replace(/^scheme:/, '').replace(/\./g, '+'))
    : `${schemes.length}-schemes`;
  return `${EXPORT_BASENAME}_${schemePart}_${timestampSlug(new Date(manifest.generatedAt))}`
    + `_${manifest.manifestId.slice(0, 10)}`;
}

function caveatsFor(dataset, manifest) {
  const { meta } = dataset;
  const caveats = [
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
  ];
  if (meta.expressionSource?.caveat) {
    caveats.push(`Expression: ${meta.expressionSource.caveat} Measured in `
      + `${meta.expressionSource.organismMeasured ?? 'an unstated organism'}`
      + `${meta.expressionSource.condition ? `, ${meta.expressionSource.condition}` : ''}.`);
  }
  if (meta.tssEvidenceSource) {
    caveats.push('Tan 2018 TSS counts and DESeq2 comparisons have only two biological '
      + 'cultures per condition. They describe start-site initiation, not whole-gene '
      + 'RNA abundance; a gene can have multiple separately regulated TSSs.');
  }
  if (manifest.dataset.candidateEvidence?.borrowedEssentiality?.status === 'unavailable') {
    caveats.push('PCC 7942 essentiality is unavailable for this UTEX release; no '
      + 'locus-level status is inferred from the unverified Rubin Dataset S3.');
  }
  if (dataset.goTerms) {
    caveats.push('GO relationships are RefSeq IEA computational suggestions, not experimentally '
      + 'tested UTEX 2973 functions. Obsolete GO IDs retain their historical names and are not remapped.');
  }
  if (dataset.functionCategories) {
    const categorySource = dataset.functionCategories.source;
    caveats.push(`Function colours use only the ${categorySource.coverage.reviewedRows} exact `
      + 'UTEX 2973 locus decisions approved by the lab on '
      + `${categorySource.provenance.userReview.date}. Every other CDS remains unknown or unclassified; `
      + 'GO IEA relationships never assign a category. An unknown colour does not imply '
      + 'that a function was experimentally ruled out.');
  }
  if (manifest.dataset.annotationRelease === null) {
    caveats.push('meta.json does not publish the annotation release, so it is recorded as null '
      + 'rather than inferred.');
  }
  return caveats;
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
}) {
  const { meta, genes, indexById, table } = dataset;
  const schemeList = normaliseSchemes(schemes);
  const metrics = registry.metrics;
  const columns = [...IDENTITY_COLUMNS, ...metrics.map((metric) => metric.key), ...SEQUENCE_COLUMNS];

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
      const row = {
        manifestId: '',
        schemeId: scheme.schemeId,
        schemeName: scheme.name ?? '',
        id: gene.id,
        name: gene.name ?? '',
        product: gene.product ?? '',
        functionCategory: functionCategoryLabel(dataset.functionCategories, gene.id) ?? '',
        reviewedFunctionCategories:
          reviewedFunctionLabels(dataset.functionCategories, gene.id).join('; '),
        functionReviewStatus: dataset.functionCategories
          ? dataset.functionCategories.assignmentsById.has(gene.id) ? 'reviewed' : 'unreviewed'
          : '',
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
        overlapsNeighbor: typeof gene.overlapsNeighbor === 'boolean' ? String(gene.overlapsNeighbor) : '',
        operonId: gene.operonId ?? '',
        expressionBasis: basis.basis,
        expressionSourceId: gene.expressionSourceId ?? '',
        passesCurrentFilters: filterMask ? String(Boolean(filterMask[index])) : '',
        wildTypeCds: sequence.wildType,
        recodedCds: sequence.recoded,
      };
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
    dataset: {
      schemaVersion: meta.schemaVersion ?? null,
      builtAt: meta.builtAt ?? null,
      genome: meta.genome ?? null,
      annotationRelease: annotationRelease(meta),
      tssEvidenceSource: meta.tssEvidenceSource ?? null,
      candidateEvidence: dataset.candidateEvidence ? {
        manifestSha256: dataset.candidateEvidence.manifestSha256,
        testedSource: dataset.candidateEvidence.testedSource,
        borrowedEssentiality: dataset.candidateEvidence.borrowedEssentiality,
      } : null,
      goTermNames: dataset.goTerms?.source ?? null,
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
    },
    expressionSource: meta.expressionSource ?? null,
    filterState: filterState ?? null,
    viewState: viewState ?? null,
    schemes: schemeList,
    genes: ids
      .filter((id) => indexById.has(id))
      .map((id) => {
        const gene = genes[indexById.get(id)];
        return {
          id: gene.id,
          name: gene.name ?? null,
          product: gene.product ?? null,
          terminalStop: gene.terminalStop ?? null,
          translationalException: gene.translationalException ?? null,
          cdsSegments: gene.cdsSegments ?? null,
          expressionBasis: expressionBasisOf(gene).basis,
          testedAllele: dataset.candidateEvidence?.testedAlleles[id] ?? null,
          functionCategory: functionCategoryLabel(dataset.functionCategories, id),
          reviewedFunctionCategories: reviewedFunctionLabels(dataset.functionCategories, id),
          reviewedFunctionAssignment:
            dataset.functionCategories?.assignmentsById.get(id) ?? null,
          goAnnotations: (gene.annotationEvidence?.goAnnotations ?? []).map((relation) => ({
            ...relation,
            name: dataset.goTerms?.terms?.[relation.goId]?.name ?? null,
            isObsoleteInNameRelease: Boolean(
              dataset.goTerms?.terms?.[relation.goId]?.isObsolete
            ),
          })),
        };
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
  manifest.caveats = caveatsFor(dataset, manifest);
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
