/** Native point-in-CDS relationships. Associations are source links, never regulation edges. */
import { cdsPieces } from './chromosome-model.js';
import { offsetPieces } from './gene-view-model.js';
import { layerOf, organismOf } from './organisms.js';

export const NEIGHBOR_SITE_COLOR_KEY = 'neighborTssOverlap';
export const NEIGHBOR_SITE_LABEL = 'Neighbouring-gene TSS in CDS';
export const NEIGHBOR_SITE_COLORS = Object.freeze(['#56b4e9', '#882255', '#b7c2cd']);
export const NEIGHBOR_SITE_FILTERS = Object.freeze(['any', 'with', 'without', 'unavailable']);
export const NEIGHBOR_SITE_BUCKETS = Object.freeze([
  'No recorded neighbouring-gene TSS', 'Recorded neighbouring-gene TSS', 'Evidence unavailable',
]);
export const SITE_CAVEAT = 'Native site positions inside actual CDS segments; source associations do not establish regulation or a promoter footprint. RBS coordinates are unavailable.';
const TAN_SOURCES = Object.freeze([
  'TAN2018_TSS', 'TAN2018_TSS_CONTROL', 'TAN2018_TSS_DARK',
  'TAN2018_TSS_HIGH_LIGHT', 'TAN2018_TSS_HIGH_TEMPERATURE',
]);
const EMPTY = Object.freeze([]);

/** Only the pinned genome's own versioned accession or its published unversioned alias. */
function nativeReplicon(value, organism) {
  return organism.genome.replicons.find(({ accession }) => value === accession
    || value === accession.replace(/^NZ_/, '').replace(/\.\d+$/, ''))?.accession ?? null;
}

/** Rebuild only when a source payload lands/replaces. Keep the full source records. */
export function buildNeighborSiteIndex(dataset) {
  const organism = organismOf(dataset);
  if (!layerOf(organism, 'tssEvidence') || !layerOf(organism, 'regulatoryTss')
    || dataset.meta.genome.accession !== organism.genome.accession
    || !dataset.tssSiteRecords || !dataset.regulatoryTss) return null;
  const records = [];
  const nativeLoci = new Set(dataset.genes.map((gene) => gene.id));
  for (const [locus, rows] of Object.entries(dataset.tssSiteRecords)) {
    for (const row of rows) records.push({ row, locus, nativeAssociation: nativeLoci.has(locus),
      layer: 'tssEvidence', source: dataset.meta.tssEvidenceSource });
  }
  for (const row of dataset.regulatoryTss.rows) {
    records.push({ sourceRow: row, row: { ...row, id: row.tss_id, position: Number(row.position) },
      locus: row.mapping_status === 'mapped' ? row.mapped_locus_tag : row.source_locus_tag || null,
      nativeAssociation: row.mapping_status === 'mapped',
      warnings: dataset.regulatoryTss.sourceWarnings?.filter((warning) => warning.tssId === row.tss_id) ?? [],
      layer: 'regulatoryTss', source: dataset.regulatoryTss.source });
  }
  return indexNativeSites(dataset.genes, records, organism);
}

/** Physical site identity includes study, type, strand, exact replicon and base, not condition or owner. */
export function indexNativeSites(genes, records, organism) {
  const sites = new Map();
  const selectable = new Map(genes.map((gene, index) => [gene.id, index]));
  for (const record of records) {
    const { row } = record;
    if ((row.organismId && row.organismId !== organism.id)
      || (row.assembly && row.assembly !== organism.genome.accession)) continue;
    const replicon = nativeReplicon(row.replicon, organism);
    const length = organism.genome.replicons.find((entry) => entry.accession === replicon)?.lengthBp;
    if (!replicon || !Number.isInteger(row.position) || row.position < 1 || row.position > length) continue;
    const key = JSON.stringify([record.source?.doi ?? 'Tan 2018 Table S1', row.type, replicon, row.position, row.strand]);
    let site = sites.get(key);
    if (!site) {
      site = { key, type: row.type, replicon, position: row.position, strand: row.strand,
        ids: [], associations: [], records: [], unassigned: false };
      sites.set(key, site);
    }
    if (row.id && !site.ids.includes(row.id)) site.ids.push(row.id);
    if (!record.locus) site.unassigned = true;
    else if (!site.associations.some((entry) => entry.id === record.locus)) {
      site.associations.push({ id: record.locus, index: selectable.get(record.locus) ?? null,
        selectable: selectable.has(record.locus), native: record.nativeAssociation !== false });
    }
    const association = site.associations.find(({ id }) => id === record.locus);
    if (association && record.nativeAssociation !== false) association.native = true;
    site.records.push(record);
  }
  const allSites = [...sites.values()].sort((a, b) => a.replicon.localeCompare(b.replicon)
    || a.position - b.position || a.key.localeCompare(b.key));
  const byGene = new Map();
  const marks = [];
  for (let index = 0; index < genes.length; index += 1) {
    const gene = genes[index];
    const pieces = cdsPieces(gene);
    const contained = allSites.filter((site) => site.replicon === gene.seqid
      && pieces.some(({ from, to }) => site.position >= from && site.position <= to));
    const linked = contained.filter((site) => site.associations.some(({ id, native }) => native && id !== gene.id));
    const unassigned = contained.filter((site) => site.associations.length === 0 || site.unassigned || site.associations.some(({ native }) => !native));
    const relation = Object.freeze({ geneId: gene.id, sites: Object.freeze(linked), contained: Object.freeze(contained), unassigned: Object.freeze(unassigned), count: linked.length });
    byGene.set(gene.id, relation);
    for (const site of linked) marks.push(Object.freeze({ site, geneId: gene.id, index, strand: gene.strand }));
  }
  return Object.freeze({ byGene, sites: Object.freeze(allSites), marks: Object.freeze(marks) });
}

/** Whether the reader's source selection lets the site evidence be used at all. */
export function neighborSiteSourcesSelected(sources = []) {
  return sources.some((id) => TAN_SOURCES.includes(id));
}

/** Selection gates evidence access; condition-specific scores never replace site coordinates. */
export function neighborSiteModel(dataset, { sources = [], pending = null, sourcePending = null } = {}) {
  const selected = neighborSiteSourcesSelected(sources);
  const index = dataset.neighborSites;
  const organism = organismOf(dataset);
  const declared = layerOf(organism, 'tssEvidence') && layerOf(organism, 'regulatoryTss');
  const reason = !declared ? 'Native Tan 2018 TSS evidence is unavailable for this organism.'
    : !selected ? 'Select a Tan 2018 initiation source to use these site records.'
    : pending === 'failed' || sourcePending === 'failed' ? 'Tan 2018 site evidence failed to load; retry the failed data file.'
      : pending === 'loading' || sourcePending === 'loading' ? 'Tan 2018 site evidence is loading.'
        : !index ? 'Native Tan 2018 TSS evidence is unavailable for this organism.' : null;
  const available = reason === null;
  const values = Int16Array.from(dataset.genes, (gene) => !available ? 2
    : index.byGene.get(gene.id)?.count > 0 ? 1 : 0);
  const counts = [0, 0, 0];
  for (const value of values) counts[value] += 1;
  // The number of distinct admitted sites inside each CDS, from either strand;
  // unknown, never zero, while the evidence cannot be read.
  const siteCounts = Float64Array.from(dataset.genes, (gene) => (available
    ? index.byGene.get(gene.id)?.count ?? Number.NaN : Number.NaN));
  return { index: available ? index : null, available, reason, values, counts, siteCounts,
    forGene: (gene) => available ? index.byGene.get(gene?.id) ?? null : null,
    marks: available ? index.marks : EMPTY };
}

export const NEIGHBOR_SITE_COUNT_UNIT = 'sites';

/**
 * The count as a colour metric: a nonnegative integer per gene, NaN while the
 * evidence is unavailable. `fileKey` names a site file still loading, so the
 * scale chosen over no values is chosen again when it lands.
 */
export function neighborSiteCountMetric(model, fileKey = null) {
  return {
    key: NEIGHBOR_SITE_COLOR_KEY,
    label: NEIGHBOR_SITE_LABEL,
    unit: NEIGHBOR_SITE_COUNT_UNIT,
    integer: true,
    scale: 'sequential',
    family: 'Genomic context',
    source: 'derived',
    fileKey,
    desc: 'Distinct admitted Tan 2018 TSS sites inside this gene\'s actual CDS segments that a '
      + 'source associates with another gene, counting same- and opposite-strand sites alike. '
      + SITE_CAVEAT,
    read: (index) => model.siteCounts?.[index] ?? Number.NaN,
  };
}

/** Each distinct count present and how many genes carry it, ascending, then unavailable genes. */
export function neighborSiteCountTally(model) {
  const tally = new Map();
  let unavailable = 0;
  for (const value of model.siteCounts ?? []) {
    if (!Number.isFinite(value)) unavailable += 1;
    else tally.set(value, (tally.get(value) ?? 0) + 1);
  }
  return { rows: [...tally.entries()].sort((a, b) => a[0] - b[0]).map(([count, genes]) => ({ count, genes })),
    unavailable };
}

/**
 * An inclusive count range, `{min, max}` with nonnegative integer bounds and
 * either open, or null when both are open. Anything else is no range.
 */
export function normalizeNeighborSiteCountFilter(value) {
  if (!value || typeof value !== 'object') return null;
  const bound = (raw) => (Number.isInteger(raw) && raw >= 0 ? raw : null);
  const min = bound(value.min);
  const max = bound(value.max);
  return min === null && max === null ? null : { min, max };
}

/** `nc` in a link: `min:max`, either side blank when open. */
export function encodeNeighborSiteCountFilter(filter) {
  const range = normalizeNeighborSiteCountFilter(filter);
  return range ? `${range.min ?? ''}:${range.max ?? ''}` : null;
}

export function decodeNeighborSiteCountFilter(text) {
  const match = /^(\d*):(\d*)$/.exec(text ?? '');
  if (!match) return null;
  return normalizeNeighborSiteCountFilter({
    min: match[1] === '' ? null : Number(match[1]), max: match[2] === '' ? null : Number(match[2]),
  });
}

/**
 * Inclusive at both ends. Like the shortcuts, a saved range is suspended, not
 * applied, while the evidence cannot be read, and an unavailable gene is never
 * counted as zero.
 */
export function passesNeighborSiteCountFilter(model, geneIndex, filter) {
  const range = normalizeNeighborSiteCountFilter(filter);
  if (!range || !model.available) return true;
  const value = model.siteCounts[geneIndex];
  if (!Number.isFinite(value)) return false;
  return (range.min === null || value >= range.min) && (range.max === null || value <= range.max);
}

export function passesNeighborSiteFilter(model, geneIndex, filter = 'any') {
  if (filter === 'any' || !NEIGHBOR_SITE_FILTERS.includes(filter)) return true;
  if (filter === 'unavailable') return model.values[geneIndex] === 2;
  if (!model.available) return true; // Preserve saved narrowing, suspended until evidence is readable.
  return model.values[geneIndex] === (filter === 'with' ? 1 : 0);
}

/** Preserve the requested saved view while exports identify actual narrowing. */
export function neighborSiteFilterSummary(model, requested = 'any', countFilter = null) {
  const suspended = !model.available && ['with', 'without'].includes(requested);
  const countRange = normalizeNeighborSiteCountFilter(countFilter);
  const countSuspended = Boolean(countRange) && !model.available;
  return { requested, effective: suspended ? 'any' : requested, suspended,
    countRange, effectiveCountRange: countSuspended ? null : countRange, countSuspended,
    evidenceAvailable: model.available, reason: model.reason };
}

/** Exact compact offset including real join gaps, with origin order supplied by the shared helper. */
export function neighborSiteOffset(gene, site) {
  const piece = offsetPieces(gene).find(({ low, high }) => site.position >= low && site.position <= high);
  return piece ? piece.offset + (gene.strand === '-' ? piece.high - site.position : site.position - piece.low) : null;
}

export function describeNeighborSite(site, gene) {
  const relation = !['+', '-'].includes(gene?.strand) || !['+', '-'].includes(site.strand)
    ? 'strand relation unrecorded' : gene.strand === site.strand ? 'same strand as CDS' : 'opposite strand to CDS';
  const owners = site.associations.map(({ id, selectable, native }) => `${id}${native ? selectable ? '' : ' (not selectable)' : ' (unresolved native association)'}`).join(', ') || 'unassigned';
  return `${site.ids.join(', ') || 'Site'} · ${site.type} · ${site.replicon}:${site.position} (${site.strand}) · ${relation} · inside ${gene?.id ?? 'CDS'} · source-associated: ${owners}${site.unassigned ? '; includes an unassigned source row' : ''} · Tan 2018 Table S1${site.associations.length > 1 ? ' · multiple associations' : ''}.`;
}
