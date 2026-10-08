/**
 * Whole-strain fitness measurements: the first admitted layer whose row unit is
 * not a gene.
 *
 * DOM-free. A record here describes one strain grown in one condition, so it
 * colours no gene and must never reach a metric, colour, or axis registry: the
 * only thing that reads this file is the Strain fitness tab. The layer is
 * organism-neutral — any release may publish `strain_fitness.json` — and the
 * file itself declares which organism and assembly it belongs to, so a file
 * dropped into the wrong data directory fails rather than being drawn under
 * another organism's labels.
 *
 * Validation is fail-closed. Every unit, reference and normalisation a reader
 * will see is declared in the file; nothing here supplies a default for one,
 * because a unit the site invented would be the site's claim and not the
 * source's. Two distinctions the validator exists to protect:
 *
 * - **null is not zero.** A quantity that was not measured is `null`. A
 *   measured zero is `0`. Numbers are accepted only as JSON numbers, so a
 *   `"0"` that really meant "no value" cannot enter as a measurement.
 * - **no growth is not a doubling time of 0 minutes.** A strain that did not
 *   grow carries `growthStatus: 'no_growth_detected'` and a null doubling
 *   time. Zero minutes would read as infinitely fast growth.
 *
 * `docs/validation/strain-fitness.md` is the schema and the runbook.
 */
import { organismOf } from './organisms.js';

/** The one schema version this build reads. */
export const STRAIN_FITNESS_SCHEMA_VERSION = 1;

/** What a growth record says happened. */
export const GROWTH_STATUS = Object.freeze({
  /** The source reports a measurement, whether or not every field is present. */
  REPORTED: 'reported',
  /** The source reports that the strain did not grow. Doubling time is null. */
  NO_GROWTH: 'no_growth_detected',
});

const GROWTH_STATUSES = Object.freeze([GROWTH_STATUS.REPORTED, GROWTH_STATUS.NO_GROWTH]);

/** How a reader sees each status. */
export const GROWTH_STATUS_LABELS = Object.freeze({
  [GROWTH_STATUS.REPORTED]: 'Reported',
  [GROWTH_STATUS.NO_GROWTH]: 'No growth detected',
});

/** How a file describes where its values came from. */
export const PROVENANCE_CLASSES = Object.freeze(['published', 'synthetic-test-fixture']);

/** A Biolog well identifier: a 96-well plate's row letter and column number. */
const WELL = /^[A-H](?:0[1-9]|1[0-2])$/;

const SHA256 = /^[0-9a-f]{64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function fail(what) {
  throw new Error(`strain_fitness.json ${what}`);
}

function plainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** A required non-empty, non-blank string. */
function requireLabel(value, what) {
  if (typeof value !== 'string' || value.trim() === '') fail(`has no ${what}`);
  return value;
}

/** A field that is either absent, null, or a non-empty string. */
function optionalLabel(value, what) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.trim() === '') fail(`has an invalid ${what}`);
  return value;
}

/**
 * A measurement: a finite JSON number, or null for "not measured".
 *
 * A string is refused however numeric it looks, so the null-versus-zero
 * distinction cannot be lost in a spreadsheet export that wrote `""` or `"0"`.
 */
function requireMeasurement(value, what, { nonNegative = false, positive = false } = {}) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`has a non-numeric ${what}`);
  if (positive && value <= 0) fail(`has a ${what} that is not above zero`);
  if (nonNegative && value < 0) fail(`has a negative ${what}`);
  return value;
}

/** A metadata block: present, an object, and not empty. */
function requireMetadata(value, what) {
  if (!plainObject(value) || Object.keys(value).length === 0) fail(`has no ${what} metadata`);
  return value;
}

/**
 * One numbered replicate series, as `[{replicate, value}]` sorted by number.
 *
 * Replicate numbers are explicit rather than positional so that a source which
 * reports replicates 1 and 3 cannot be read as 1 and 2.
 */
function requireReplicates(value, what, recordId, bounds) {
  const where = `${what} of record ${recordId}`;
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail(`has a ${where} that is not an array`);
  const seen = new Set();
  const series = value.map((entry) => {
    if (!plainObject(entry)) fail(`has a malformed entry in the ${where}`);
    const { replicate } = entry;
    if (!Number.isInteger(replicate) || replicate < 1) {
      fail(`has an entry with no positive replicate number in the ${where}`);
    }
    if (seen.has(replicate)) fail(`repeats replicate ${replicate} in the ${where}`);
    seen.add(replicate);
    return { replicate, value: requireMeasurement(entry.value, `replicate in the ${where}`, bounds) };
  });
  return series.sort((a, b) => a.replicate - b.replicate);
}

function requireSource(raw) {
  if (!plainObject(raw)) fail('has no source block');
  return Object.freeze({
    citation: requireLabel(raw.citation, 'source citation'),
    doi: optionalLabel(raw.doi, 'source doi'),
    studyId: optionalLabel(raw.studyId, 'source study id'),
    sheet: optionalLabel(raw.sheet, 'source sheet name'),
    sourceFile: requireLabel(raw.sourceFile, 'source file name'),
    sourceFileSha256: SHA256.test(raw.sourceFileSha256 ?? '')
      ? raw.sourceFileSha256 : fail('has no SHA-256 for its source file'),
    retrieved: ISO_DATE.test(raw.retrieved ?? '')
      ? raw.retrieved : fail('has no ISO retrieval date'),
    // What the values are measured against, when the source states one. Null
    // is "the source names no reference", never "there is none".
    comparedAgainst: optionalLabel(raw.comparedAgainst, 'comparison strain'),
  });
}

/**
 * The recoding scheme a strain carries.
 *
 * `native` is stated explicitly rather than implied by an absent field: an
 * unmodified parent is a labelled arm of the experiment, and a row whose scheme
 * cell were empty would read as unknown.
 */
function requireScheme(raw, strainId) {
  if (!plainObject(raw)) fail(`has no scheme for strain ${strainId}`);
  if (typeof raw.recoded !== 'boolean') fail(`has no recoded flag for strain ${strainId}`);
  return Object.freeze({
    label: requireLabel(raw.label, `scheme label for strain ${strainId}`),
    recoded: raw.recoded,
    segments: optionalLabel(raw.segments, `segment label for strain ${strainId}`),
  });
}

function requireIndex(raw, what, build) {
  if (!Array.isArray(raw) || raw.length === 0) fail(`has no ${what}`);
  const byId = new Map();
  const labels = new Set();
  const order = [];
  for (const entry of raw) {
    if (!plainObject(entry)) fail(`has a malformed ${what} entry`);
    const id = requireLabel(entry.id, `${what} id`);
    if (byId.has(id)) fail(`repeats ${what} id ${id}`);
    const label = requireLabel(entry.label, `label for ${what} ${id}`);
    // Two rows under one label could not be told apart in the interface, and a
    // reader comparing them would be comparing two things with one name.
    if (labels.has(label)) fail(`repeats the ${what} label ${label}`);
    labels.add(label);
    const built = Object.freeze(build(entry, id, label));
    byId.set(id, built);
    order.push(built);
  }
  return { byId, order: Object.freeze(order) };
}

function resolve(index, id, what, recordId) {
  const found = index.byId.get(requireLabel(id, `${what} for record ${recordId}`));
  if (!found) fail(`record ${recordId} names unknown ${what} ${id}`);
  return found;
}

function requireGrowth(raw, { strains, conditions, ids }) {
  if (raw === undefined || raw === null) return null;
  if (!plainObject(raw)) fail('has a malformed growth block');
  const units = plainObject(raw.units) ? raw.units : fail('has no growth units');
  const resolved = Object.freeze({
    doublingTime: requireLabel(units.doublingTime, 'declared doubling-time unit'),
    maximumOd600: requireLabel(units.maximumOd600, 'declared maximum-OD600 unit'),
  });
  if (!Array.isArray(raw.records)) fail('has a growth block with no records array');
  const records = raw.records.map((entry) => {
    if (!plainObject(entry)) fail('has a malformed growth record');
    const id = requireLabel(entry.id, 'growth record id');
    if (ids.has(id)) fail(`repeats record id ${id}`);
    ids.add(id);
    if (!GROWTH_STATUSES.includes(entry.growthStatus)) {
      fail(`record ${id} has no reported or no_growth_detected growth status`);
    }
    const noGrowth = entry.growthStatus === GROWTH_STATUS.NO_GROWTH;
    const doublingTimeMinutes = requireMeasurement(
      entry.doublingTimeMinutes, `doubling time for record ${id}`, { positive: true },
    );
    // A strain that did not grow has no doubling time at all. Zero minutes
    // would be read, and plotted, as infinitely fast growth.
    if (noGrowth && doublingTimeMinutes !== null) {
      fail(`record ${id} reports no growth and a doubling time`);
    }
    const doublingTimeSdMinutes = requireMeasurement(
      entry.doublingTimeSdMinutes, `doubling-time SD for record ${id}`, { nonNegative: true },
    );
    if (doublingTimeMinutes === null && doublingTimeSdMinutes !== null) {
      fail(`record ${id} has a doubling-time SD with no doubling time`);
    }
    const maximumOd600 = requireMeasurement(
      entry.maximumOd600, `maximum OD600 for record ${id}`, { nonNegative: true },
    );
    const maximumOd600Sd = requireMeasurement(
      entry.maximumOd600Sd, `maximum-OD600 SD for record ${id}`, { nonNegative: true },
    );
    if (maximumOd600 === null && maximumOd600Sd !== null) {
      fail(`record ${id} has a maximum-OD600 SD with no maximum OD600`);
    }
    const doublingTimeReplicates = requireReplicates(
      entry.doublingTimeReplicates, 'doubling-time replicates', id, { positive: true },
    );
    if (noGrowth && doublingTimeReplicates.some((replicate) => replicate.value !== null)) {
      fail(`record ${id} reports no growth and a measured doubling-time replicate`);
    }
    return Object.freeze({
      id,
      strain: resolve(strains, entry.strainId, 'strain', id),
      condition: resolve(conditions, entry.conditionId, 'condition', id),
      growthStatus: entry.growthStatus,
      doublingTimeMinutes,
      doublingTimeSdMinutes,
      doublingTimeReplicates: Object.freeze(
        doublingTimeReplicates,
      ),
      maximumOd600,
      maximumOd600Sd,
      maximumOd600Replicates: Object.freeze(
        requireReplicates(entry.maximumOd600Replicates, 'maximum-OD600 replicates', id, { nonNegative: true }),
      ),
    });
  });
  return Object.freeze({
    units: resolved,
    metadata: requireMetadata(raw.metadata, 'growth'),
    records: Object.freeze(records),
  });
}

function requireBiolog(raw, { strains, conditions, ids }) {
  if (raw === undefined || raw === null) return null;
  if (!plainObject(raw)) fail('has a malformed biolog block');
  const units = plainObject(raw.units) ? raw.units : fail('has no biolog units');
  // Nothing here supplies a default. An OD scale the site assumed would be the
  // site's claim; the source states the quantity, what it is referenced to,
  // and how it was normalised, or the file does not load.
  const resolved = Object.freeze({
    value: requireLabel(units.value, 'declared biolog value unit'),
    reference: requireLabel(units.reference, 'declared biolog value reference'),
    normalization: requireLabel(units.normalization, 'declared biolog normalization'),
  });
  const plates = requireIndex(raw.plates, 'plate', (entry, id, label) => ({ id, label }));
  if (!Array.isArray(raw.records)) fail('has a biolog block with no records array');
  const wells = new Set();
  const records = raw.records.map((entry) => {
    if (!plainObject(entry)) fail('has a malformed biolog record');
    const id = requireLabel(entry.id, 'biolog record id');
    if (ids.has(id)) fail(`repeats record id ${id}`);
    ids.add(id);
    if (typeof entry.well !== 'string' || !WELL.test(entry.well)) {
      fail(`record ${id} has no 96-well plate position`);
    }
    const strain = resolve(strains, entry.strainId, 'strain', id);
    const condition = resolve(conditions, entry.conditionId, 'condition', id);
    const plate = resolve(plates, entry.plateId, 'plate', id);
    const place = `${strain.id}/${condition.id}/${plate.id}/${entry.well}`;
    if (wells.has(place)) fail(`measures ${place} twice`);
    wells.add(place);
    return Object.freeze({
      id,
      strain,
      condition,
      plate,
      well: entry.well,
      substrate: requireLabel(entry.substrate, `substrate for record ${id}`),
      // Signed on purpose: a value below its reference is a real result, and a
      // measured zero is not a missing one.
      value: requireMeasurement(entry.value, `biolog value for record ${id}`),
    });
  });
  return Object.freeze({
    units: resolved,
    metadata: requireMetadata(raw.metadata, 'biolog'),
    plates: plates.order,
    records: Object.freeze(records),
  });
}

/**
 * Validate `strain_fitness.json` against the dataset it was published beside.
 *
 * @param {object} raw the parsed file.
 * @param {object} dataset the dataset being loaded, for the organism it is
 *   showing and the assembly its `meta.json` declares.
 * @returns {object} the frozen layer, with strain, condition and plate records
 *   resolved onto every measurement so no view has to join them again.
 */
export function validateStrainFitness(raw, dataset) {
  if (!plainObject(raw)) fail('is not an object');
  if (raw.schemaVersion !== STRAIN_FITNESS_SCHEMA_VERSION) {
    fail(`declares schema version ${raw.schemaVersion}, not ${STRAIN_FITNESS_SCHEMA_VERSION}`);
  }
  // The layer loads for any organism, so the file is what says whose it is. A
  // mismatch is a file in the wrong data directory, and drawing it would show
  // one organism's strains under another organism's labels.
  const organism = organismOf(dataset);
  if (raw.organismId !== organism.id) {
    fail(`declares organism ${raw.organismId ?? 'none'}, not ${organism.id}`);
  }
  const accession = dataset?.meta?.genome?.accession;
  if (raw.genome?.accession !== accession) {
    fail(`declares assembly ${raw.genome?.accession ?? 'none'}, not ${accession ?? 'none'}`);
  }
  if (!PROVENANCE_CLASSES.includes(raw.provenanceClass)) {
    fail(`declares provenance class ${raw.provenanceClass ?? 'none'}, which is not one of `
      + PROVENANCE_CLASSES.join(', '));
  }
  const source = requireSource(raw.source);
  const strains = requireIndex(raw.strains, 'strain', (entry, id, label) => ({
    id, label, scheme: requireScheme(entry.scheme, id),
  }));
  const conditions = requireIndex(raw.conditions, 'condition', (entry, id, label) => ({
    id, label, description: optionalLabel(entry.description, `description for condition ${id}`),
  }));
  const ids = new Set();
  const growth = requireGrowth(raw.growth, { strains, conditions, ids });
  const biolog = requireBiolog(raw.biolog, { strains, conditions, ids });
  if (!growth && !biolog) fail('carries neither a growth nor a biolog layer');
  // A declared strain or condition nobody measures is a label with no evidence
  // behind it, and would appear in the filters as a choice that matches nothing.
  const used = new Set([...(growth?.records ?? []), ...(biolog?.records ?? [])]
    .flatMap((record) => [`strain:${record.strain.id}`, `condition:${record.condition.id}`]));
  for (const strain of strains.order) {
    if (!used.has(`strain:${strain.id}`)) fail(`declares strain ${strain.id} and measures it nowhere`);
  }
  for (const condition of conditions.order) {
    if (!used.has(`condition:${condition.id}`)) {
      fail(`declares condition ${condition.id} and measures it nowhere`);
    }
  }
  return Object.freeze({
    schemaVersion: raw.schemaVersion,
    organismId: raw.organismId,
    genome: Object.freeze({ accession: raw.genome.accession }),
    provenanceClass: raw.provenanceClass,
    source,
    strains: strains.order,
    conditions: conditions.order,
    growth,
    biolog,
  });
}

/** Whether a record passes a `{strainId, conditionId}` selection. `'all'` matches everything. */
function selected(record, { strainId = 'all', conditionId = 'all' } = {}) {
  if (strainId !== 'all' && record.strain.id !== strainId) return false;
  return conditionId === 'all' || record.condition.id === conditionId;
}

/** The growth records a selection shows, in the file's order. */
export function selectGrowth(layer, selection = {}) {
  return (layer?.growth?.records ?? []).filter((record) => selected(record, selection));
}

/**
 * The Biolog wells a selection shows.
 *
 * `query` matches the substrate, the well, and the plate label, which is how a
 * reader finds one environment among several thousand.
 */
export function selectWells(layer, selection = {}) {
  const needle = (selection.query ?? '').trim().toLowerCase();
  return (layer?.biolog?.records ?? []).filter((record) => {
    if (!selected(record, selection)) return false;
    if (!needle) return true;
    return [record.substrate, record.well, record.plate.label, record.plate.id]
      .some((field) => field.toLowerCase().includes(needle));
  });
}

/**
 * What a selection's growth records add up to, for the summary line.
 *
 * Counted, never averaged: a mean doubling time across different strains and
 * conditions would be a number no experiment produced.
 */
export function growthSummary(records) {
  return {
    records: records.length,
    strains: new Set(records.map((record) => record.strain.id)).size,
    conditions: new Set(records.map((record) => record.condition.id)).size,
    noGrowth: records.filter((record) => record.growthStatus === GROWTH_STATUS.NO_GROWTH).length,
    withDoublingTime: records.filter((record) => record.doublingTimeMinutes !== null).length,
  };
}

/** The strain and condition a selection names, as the interface states them. */
export function selectionLabels(layer, { strainId = 'all', conditionId = 'all' } = {}) {
  const strain = layer?.strains.find((entry) => entry.id === strainId) ?? null;
  const condition = layer?.conditions.find((entry) => entry.id === conditionId) ?? null;
  return {
    strain: strain?.label ?? 'All strains',
    scheme: strain ? strain.scheme.label : 'All schemes',
    segments: strain?.scheme.segments ?? null,
    condition: condition?.label ?? 'All conditions',
  };
}

// --- Export ---------------------------------------------------------------

/**
 * What a cell with no value says.
 *
 * Not an empty cell: an empty field and a zero look alike to a reader skimming
 * a column, and the whole point of the layer's null handling is that they are
 * not the same measurement.
 */
export const EXPORT_MISSING = 'NA';

/** Tabs and newlines inside a source label would end the field or the row. */
function cell(value) {
  if (value === null || value === undefined) return EXPORT_MISSING;
  if (typeof value === 'number') return String(value);
  return String(value).replace(/[\t\r\n]+/g, ' ');
}

/** Locale-independent text order, so one selection always exports one byte string. */
function compareText(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function compareBy(keys) {
  return (a, b) => {
    for (const key of keys) {
      const order = compareText(key(a), key(b));
      if (order !== 0) return order;
    }
    return 0;
  };
}

/** `1=24.1;2=NA;3=25` — numbered, sorted, and explicit about a missing replicate. */
function replicateSeries(series) {
  if (series.length === 0) return EXPORT_MISSING;
  return series.map((entry) => `${entry.replicate}=${cell(entry.value)}`).join(';');
}

/** The short source name a row carries; the citation and checksum are above it. */
function rowSource(layer) {
  return layer.source.studyId ?? layer.source.sourceFile;
}

/**
 * The `#` preamble both exports begin with.
 *
 * Every line is a fixed key and one value, in a fixed order, so two exports of
 * the same selection are the same bytes. The selection is stated here because a
 * filtered table is not the whole layer, and a file that did not say so would
 * read as if it were.
 */
function preamble(layer, title, selection, extra, rows) {
  const labels = selectionLabels(layer, selection);
  const lines = [
    ['table', title],
    ['organism', `${layer.organismId} ${layer.genome.accession}`],
    ['provenance', layer.provenanceClass],
    ['source', layer.source.citation],
    ['sourceDoi', layer.source.doi],
    ['sourceStudyId', layer.source.studyId],
    ['sourceFile', layer.source.sourceFile],
    ['sourceSheet', layer.source.sheet],
    ['sourceFileSha256', layer.source.sourceFileSha256],
    ['sourceRetrieved', layer.source.retrieved],
    ['comparedAgainst', layer.source.comparedAgainst],
    ...extra,
    ['selectedStrain', labels.strain],
    ['selectedScheme', labels.scheme],
    ['selectedSegments', labels.segments],
    ['selectedCondition', labels.condition],
    ['rows', rows],
  ];
  return lines.map(([key, value]) => `# ${key}\t${cell(value)}`);
}

function tsv(lines) {
  return `${lines.join('\n')}\n`;
}

/** The columns of the growth export, in order. */
export const GROWTH_COLUMNS = Object.freeze([
  'strain', 'scheme', 'recoded', 'segments', 'condition', 'growthStatus',
  'doublingTime', 'doublingTimeUnit', 'doublingTimeSd', 'doublingTimeReplicates',
  'maximumOd600', 'maximumOd600Unit', 'maximumOd600Sd', 'maximumOd600Replicates',
  'recordId', 'source',
]);

/** The columns of the Biolog export, in order. */
export const WELL_COLUMNS = Object.freeze([
  'strain', 'scheme', 'recoded', 'segments', 'condition', 'plate', 'plateLabel', 'well',
  'substrate', 'value', 'valueUnit', 'valueReference', 'valueNormalization',
  'recordId', 'source',
]);

/**
 * The growth summary as TSV: the preamble, the header, then one row per record.
 *
 * Rows are sorted by strain, condition and record id rather than left in the
 * file's order, so the bytes depend on the selection alone.
 */
export function growthTsv(layer, selection = {}) {
  const records = [...selectGrowth(layer, selection)].sort(compareBy([
    (record) => record.strain.label, (record) => record.condition.label, (record) => record.id,
  ]));
  const { units } = layer.growth;
  return tsv([
    ...preamble(layer, 'strain fitness — growth', selection, [
      ['doublingTimeUnit', units.doublingTime],
      ['maximumOd600Unit', units.maximumOd600],
    ], records.length),
    GROWTH_COLUMNS.join('\t'),
    ...records.map((record) => [
      record.strain.label, record.strain.scheme.label, record.strain.scheme.recoded,
      record.strain.scheme.segments, record.condition.label, record.growthStatus,
      record.doublingTimeMinutes, units.doublingTime, record.doublingTimeSdMinutes,
      replicateSeries(record.doublingTimeReplicates),
      record.maximumOd600, units.maximumOd600, record.maximumOd600Sd,
      replicateSeries(record.maximumOd600Replicates),
      record.id, rowSource(layer),
    ].map(cell).join('\t')),
  ]);
}

/** The Biolog wells as TSV, sorted by strain, condition, plate and well. */
export function wellsTsv(layer, selection = {}) {
  const records = [...selectWells(layer, selection)].sort(compareBy([
    (record) => record.strain.label, (record) => record.condition.label,
    (record) => record.plate.id, (record) => record.well, (record) => record.id,
  ]));
  const { units } = layer.biolog;
  return tsv([
    ...preamble(layer, 'strain fitness — biolog wells', selection, [
      ['valueUnit', units.value],
      ['valueReference', units.reference],
      ['valueNormalization', units.normalization],
      ['substrateQuery', selection.query || null],
    ], records.length),
    WELL_COLUMNS.join('\t'),
    ...records.map((record) => [
      record.strain.label, record.strain.scheme.label, record.strain.scheme.recoded,
      record.strain.scheme.segments, record.condition.label, record.plate.id, record.plate.label,
      record.well, record.substrate, record.value,
      units.value, units.reference, units.normalization,
      record.id, rowSource(layer),
    ].map(cell).join('\t')),
  ]);
}
