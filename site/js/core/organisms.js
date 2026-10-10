/**
 * The organism registry: one frozen record per organism the site can show.
 *
 * DOM-free. Everything that is true of one organism and not of another lives in
 * a record here or in that organism's own `meta.json`, never in a module that
 * draws: the selector label, the page title, the data directory, the storage
 * namespace, the genome of record, the search aliases, the colour-source
 * universe, the study-bound evidence layers it publishes, and the sentences
 * that name it. `docs/validation/organism-selector.md` is the runbook.
 *
 * A record's fields:
 *
 * - `id`, `label`: the `?org=` value and the selector's option text.
 * - `species`, `strain`, `shortName`: the names copy is composed from.
 * - `title`, `description`: the document title, header, and meta description.
 * - `dataDirectory`: where its files are, relative to the page.
 * - `storageNamespace`: the prefix of every key it keeps in browser storage.
 * - `exportTag`: the organism part of an export file name, or null.
 * - `handoffStrain`: its identity in a trRosettaRNA hand-off header.
 * - `genome`: the assembly accession and replicons the chromosome view draws,
 *   checked against `meta.json` before anything is placed on an axis.
 * - `genomeCitation`, `citationLabels`: citation ids and their fallback labels.
 * - `searchAliases`, `searchAliasExample`, `locusExample`: gene-search wording.
 * - `freshAxes`: the metric pair the Metric X vs Y tab opens on.
 * - `annotationSources`: the function-category colour sources, in precedence
 *   order, each with the `role` its evidence plays (`reviewed`, `product`,
 *   `go`); empty when the organism has no such colour.
 * - `layers`: the study-bound evidence layers it publishes, keyed by data-file
 *   key, each with the labels its views read. A layer that is not declared is
 *   never requested, whatever its data directory holds.
 * - `strainFitnessDatasets`: admitted whole-strain payloads, separate from all
 *   gene metric registries. Data Sources carries their ids in a separately
 *   typed whole-strain selection, never through per-gene source aliases.
 * - `sequenceContext`: the optional expanded upstream-sequence payload and the
 *   selectable extents it supports, or null when only the core 30 nt exist.
 * - `copy`: whole sentences that state organism facts.
 */
import { UTEX2973 } from './organisms/utex2973.js';
import { ECOLI_K12_MG1655 } from './organisms/ecoli-k12-mg1655.js';
import { ECOLI_MDS42_PUBLIC_REFERENCE } from './organisms/ecoli-mds42-public-reference.js';
import { ECOLI_DH10B_PUBLIC_REFERENCE } from './organisms/ecoli-dh10b-public-reference.js';
import { ECOLI_SYN61_DELTA3_EV5 } from './organisms/ecoli-syn61-delta3-ev5.js';

/** The query parameter that names the organism. Its absence means the default. */
export const ORGANISM_PARAM = 'org';

/** The query parameter that overrides the data directory. */
export const DATA_PARAM = 'data';

/**
 * Data files that carry one study's evidence in that study's own schema.
 *
 * Their readers name the study, so each is loaded only for an organism whose
 * record declares it. Every other file is organism-neutral and loads whenever
 * it is published.
 */
export const STUDY_LAYER_KEYS = Object.freeze([
  'functionCategories', 'sourceDerivedCategories', 'candidateEvidence', 'goIeaEssentiality',
  'tssEvidence', 'trnaLoci', 'regulatoryTss',
]);

/** The names a record keeps in browser storage, under its namespace. */
const STORAGE_NAMES = Object.freeze({
  schemes: 'schemes.v1',
  shortlist: 'shortlist.v1',
  compareAxes: 'compare-axes.v1',
  panelWidths: 'panel-widths.v1',
  lastView: 'last-view.v1',
});

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** Every organism, default first, which is the selector's order. */
export const ORGANISMS = deepFreeze([
  UTEX2973,
  ECOLI_K12_MG1655,
  ECOLI_MDS42_PUBLIC_REFERENCE,
  ECOLI_DH10B_PUBLIC_REFERENCE,
  ECOLI_SYN61_DELTA3_EV5,
]);

/** The organism a link with no `org` means. */
export const DEFAULT_ORGANISM = ORGANISMS[0];

/** The record with this id, or null. */
export function organismById(id) {
  return ORGANISMS.find((organism) => organism.id === id) ?? null;
}

/**
 * The organism a dataset belongs to.
 *
 * The page's loader stamps it. A dataset built by hand, as tests and tools
 * build them, carries none and is the default organism's.
 */
export function organismOf(dataset) {
  return dataset?.organism ?? DEFAULT_ORGANISM;
}

/**
 * The organism a query string names.
 *
 * @param {string} search `location.search`, with or without its `?`.
 * @returns {{organism: object, requestedId: string|null, recognised: boolean}}
 *   `recognised` is false only when `org` is present and names no organism;
 *   the default is returned then, and the caller corrects the address.
 */
export function resolveOrganism(search) {
  const requestedId = new URLSearchParams(search).get(ORGANISM_PARAM);
  if (requestedId === null) return { organism: DEFAULT_ORGANISM, requestedId, recognised: true };
  const organism = organismById(requestedId);
  return { organism: organism ?? DEFAULT_ORGANISM, requestedId, recognised: Boolean(organism) };
}

/**
 * Where the page reads its data from, relative to the page.
 *
 * `?data=` overrides the directory and never the organism. The inline script in
 * `site/index.html` applies the same rule before any module has loaded;
 * `tests/js/organisms.test.mjs` holds the two together.
 */
export function resolveDataDirectory(search) {
  const override = new URLSearchParams(search).get(DATA_PARAM);
  if (override) return override.endsWith('/') ? override : `${override}/`;
  return resolveOrganism(search).organism.dataDirectory;
}

function withOrganism(search, organism, { keepData }) {
  const params = new URLSearchParams(search);
  params.delete(ORGANISM_PARAM);
  if (!keepData) params.delete(DATA_PARAM);
  const rest = params.toString();
  const own = organism === DEFAULT_ORGANISM
    ? '' : `${ORGANISM_PARAM}=${encodeURIComponent(organism.id)}`;
  const joined = [own, rest].filter(Boolean).join('&');
  return joined ? `?${joined}` : '';
}

/**
 * The query string an address should carry, or null when it already does.
 *
 * The default organism's canonical address has no `org`, so a link that spells
 * it out is shortened; an `org` that names nothing is removed, because the page
 * is showing the default and must not sit under an address that says otherwise.
 */
export function canonicalSearch(search) {
  const { organism, requestedId } = resolveOrganism(search);
  if (requestedId === null || (organism.id === requestedId && organism !== DEFAULT_ORGANISM)) {
    return null;
  }
  return withOrganism(search, organism, { keepData: true });
}

/**
 * The query string that opens another organism from this address.
 *
 * A data-directory override belongs to the organism it was written for, so it
 * does not follow the switch. Every other parameter does.
 */
export function switchSearch(search, organism) {
  return withOrganism(search, organism, { keepData: false });
}

/** Whether an organism publishes the data file with this key. */
export function publishesLayer(organism, key) {
  return !STUDY_LAYER_KEYS.includes(key) || Boolean(organism.layers[key]);
}

/** The labels an organism's record gives one study-bound layer, or null. */
export function layerOf(organism, key) {
  return organism.layers[key] ?? null;
}

/**
 * An organism's colour sources as copy names them: each label by its role, and
 * the precedence among them as a chain and as a sentence fragment.
 */
export function sourceLabels(organism) {
  const labels = organism.annotationSources.map((source) => source.label);
  return {
    ...Object.fromEntries(organism.annotationSources.map((source) => [source.role, source.label])),
    precedence: labels.join(' > '),
    sequence: labels.join(', then '),
  };
}

/** The id of each of an organism's colour sources, by the role it plays. */
export function sourceIds(organism) {
  return Object.fromEntries(organism.annotationSources.map((source) => [source.role, source.id]));
}

/** A record's sentence with each `{name}` replaced by its value. */
export function fillTemplate(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, name) => (
    Object.hasOwn(values, name) ? String(values[name]) : match));
}

/** The browser-storage keys one organism reads and writes. */
export function storageKeys(organism) {
  return Object.fromEntries(Object.entries(STORAGE_NAMES)
    .map(([name, suffix]) => [name, `${organism.storageNamespace}.${suffix}`]));
}

/** The replicon with this accession in any organism's genome of record, or null. */
export function repliconByAccession(accession) {
  for (const organism of ORGANISMS) {
    const replicon = organism.genome.replicons.find((entry) => entry.accession === accession);
    if (replicon) return replicon;
  }
  return null;
}

/** "about 2,700" for a large gene count, the exact count for a small one. */
export function approximateGeneCount(count) {
  if (!Number.isFinite(count)) return 'an unknown number';
  if (count < 1000) return count.toLocaleString('en-US');
  return `about ${(Math.round(count / 100) * 100).toLocaleString('en-US')}`;
}

/** The organism as the selector and the exports name it. */
export function organismIdentity(organism) {
  return {
    id: organism.id,
    label: organism.label,
    species: organism.species,
    strain: organism.strain,
    assembly: organism.genome.accession,
  };
}
