/**
 * The data files the site reads, the tier each one loads in, and the content
 * manifest that addresses them.
 *
 * DOM-free. Every file starts downloading at once; a tier says what the page
 * waits for and what it draws first, never what it delays.
 *
 * The tiers follow what each file's own validation needs, not only what it
 * feeds. The fresh view colours by function category, and a derived category
 * cannot be checked without the annotation and candidate-evidence files it is
 * derived from, so those three land together in tier 2. Drawing the map on
 * tier 1 alone with the reviewed table would colour about a dozen genes and
 * call some 1,350 categorised ones unknown, which is why the category channel
 * reads as loading until tier 2 lands rather than being drawn early.
 */

import { DEFAULT_ORGANISM, layerOf, publishesLayer } from './organisms.js';

/** The content manifest, read before any other file. */
export const DATA_MANIFEST_NAME = 'data-manifest.json';

/** The states a file is in, as every consumer reads them. */
export const FILE_STATE = Object.freeze({
  /** Requested and not yet validated. Its values are unknown, not absent. */
  LOADING: 'loading',
  /** Validated and joined. */
  READY: 'ready',
  /** An optional file this deployment does not publish. */
  ABSENT: 'absent',
  /** Could not be read, or failed its validation. */
  FAILED: 'failed',
});

function file(key, name, tier, label, { required = false, needs = [] } = {}) {
  return Object.freeze({ key, name, tier, label, required, needs: Object.freeze(needs) });
}

/**
 * Every file `loadDatasetStaged` requests, in tier order.
 *
 * `needs` names the files whose joined data this file's validation reads, so it
 * is applied only after they have settled. `required` marks the two files the
 * page cannot draw anything without; `annotations` and `tssEvidence` become
 * required when `meta.json` declares them, which their appliers enforce.
 */
export const DATA_FILES = Object.freeze([
  file('meta', 'meta.json', 1, 'release metadata', { required: true }),
  file('genes', 'genes.json', 1, 'genes', { required: true }),
  file('functionCategories', 'function-categories-v1.json', 1, 'reviewed function categories'),
  file('annotations', 'annotations.json', 2, 'annotation evidence'),
  file('candidateEvidence', 'candidate_evidence.json', 2, 'candidate evidence'),
  file('sourceDerivedCategories', 'source-derived-categories-v1.json', 2,
    'derived function categories', { needs: ['annotations', 'candidateEvidence'] }),
  file('lengthCohorts', 'length_cohorts.json', 2, 'length inventory'),
  file('codonPca', 'codon_pca.json', 2, 'codon-space loadings'),
  file('excluded', 'excluded.json', 2, 'excluded loci'),
  file('tssEvidence', 'tss_evidence.json', 3, 'start sites'),
  file('expressionLayers', 'expression_layers.json', 3, 'expression layers'),
  file('goIeaEssentiality', 'go-iea-essentiality-v1.json', 3, 'GO IEA essentiality context',
    { needs: ['candidateEvidence'] }),
  file('goTerms', 'go-term-names-v1.json', 3, 'GO term names', { needs: ['annotations'] }),
  file('regulatoryTss', 'regulatory_tss.json', 4, 'regulatory start sites'),
]);

/** Files by key, for consumers that ask about one. */
export const DATA_FILE_BY_KEY = Object.freeze(
  Object.fromEntries(DATA_FILES.map((entry) => [entry.key, entry])),
);

/** The files the page cannot draw without. */
export const CORE_FILE_KEYS = Object.freeze(
  DATA_FILES.filter((entry) => entry.tier === 1).map((entry) => entry.key),
);

/**
 * Whether a loader showing `organism` asks for this file at all.
 *
 * The loader's own rule, exported so that everything which has to predict the
 * loader's requests reaches them by the same test rather than by a second
 * reading of it: a required file is always asked for, a study-bound layer only
 * for an organism whose record declares it, and a loader with no organism asks
 * for everything, which is how tools read a directory on its own terms.
 *
 * @param {object|null} organism the registry record, or null for no organism.
 * @param {{key: string, required: boolean}} file an entry of `DATA_FILES`.
 */
export function publishesFile(organism, file) {
  return !organism || file.required || publishesLayer(organism, file.key);
}

/**
 * The tier 1 file names one organism's loader asks for, in tier order.
 *
 * This is what the classic inline script in `site/index.html` starts
 * downloading before any module runs, so the script holds the same list for
 * each organism and `tests/js/organisms.test.mjs` runs the two together and
 * fails when they diverge.
 */
export function coreFileNames(organism = DEFAULT_ORGANISM) {
  return DATA_FILES
    .filter((entry) => entry.tier === 1 && publishesFile(organism, entry))
    .map((entry) => entry.name);
}

/** What each tier is, in the plain words the loading bar uses. */
export const TIER_LABELS = Object.freeze({
  1: 'genes',
  2: 'function categories and filters',
  3: 'per-gene evidence',
  4: 'regulatory sites',
});

/** What tier 2 is for an organism that publishes no function categories. */
const TIER_2_WITHOUT_CATEGORIES = 'annotation and filters';

/**
 * The tier names for one organism, so the bar never says it is loading a layer
 * that organism does not publish.
 */
export function tierLabelsFor(organism = DEFAULT_ORGANISM) {
  return publishesLayer(organism, 'functionCategories')
    ? TIER_LABELS : Object.freeze({ ...TIER_LABELS, 2: TIER_2_WITHOUT_CATEGORIES });
}

/**
 * A file's name in a sentence. A study-bound file is named for the study the
 * organism's record gives it, so the wording is that organism's own.
 */
export function dataFileLabel(file, organism = DEFAULT_ORGANISM) {
  return layerOf(organism, file.key)?.fileLabel ?? file.label;
}

/** Characters of the digest that address a file. Sixteen hex is 64 bits. */
export const VERSION_KEY_LENGTH = 16;

/**
 * A manifest as the loader uses it, or null when the published one is unusable.
 *
 * An unusable manifest is not an error: the loader then asks for every file by
 * its plain name and revalidates each one, which is exactly how the site loaded
 * before the manifest existed. Only a well-formed entry can become a cache key.
 *
 * @returns {{files: Map<string, {bytes: number, sha256: string}>}|null}
 */
export function normalizeManifest(raw) {
  if (!raw || typeof raw !== 'object' || raw.schemaVersion !== 1) return null;
  const { files } = raw;
  if (!files || typeof files !== 'object' || Array.isArray(files)) return null;
  const entries = new Map();
  for (const [name, entry] of Object.entries(files)) {
    if (!entry || typeof entry !== 'object') return null;
    const { bytes, sha256 } = entry;
    if (!Number.isInteger(bytes) || bytes < 0) return null;
    if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256)) return null;
    entries.set(name, { bytes, sha256 });
  }
  return entries.size > 0 ? { files: entries } : null;
}

/** The cache key for one manifest entry: a prefix of its content digest. */
export function versionKey(entry) {
  return entry.sha256.slice(0, VERSION_KEY_LENGTH);
}

/**
 * How to ask for one data file.
 *
 * With a manifest entry the address carries the content digest, so the browser
 * may answer from its cache without asking the server: a changed file has a
 * changed address. Without one the plain name is revalidated on every visit.
 * `plainUrl` is the address without the key, for messages a reader sees.
 *
 * @param {URL} base the data directory.
 * @param {string} name the file name.
 * @param {{bytes: number, sha256: string}|null} entry its manifest entry.
 * @param {number} [tier] its tier, which sets the request's priority hint.
 * @returns {{url: string, plainUrl: string, init: object}}
 */
export function dataRequest(base, name, entry, tier = 2) {
  const plain = new URL(name, base);
  const init = { cache: entry ? 'force-cache' : 'no-cache' };
  if (tier === 1) init.priority = 'high';
  else if (tier >= 3) init.priority = 'low';
  if (!entry) return { url: plain.href, plainUrl: plain.href, init };
  const keyed = new URL(plain.href);
  keyed.searchParams.set('v', versionKey(entry));
  return { url: keyed.href, plainUrl: plain.href, init };
}

/**
 * `'loading'` or `'failed'` for a file that cannot be read yet, else null.
 * A dataset with no record of the file is settled, and reads as null.
 */
export function pendingState(dataset, key) {
  const state = dataset?.files?.[key]?.state;
  return state === FILE_STATE.LOADING || state === FILE_STATE.FAILED ? state : null;
}

/** Whether a dataset is still waiting on a file. A dataset with no record is settled. */
export function isLoading(dataset, key) {
  return dataset?.files?.[key]?.state === FILE_STATE.LOADING;
}

/** Whether a file could not be loaded. */
export function hasFailed(dataset, key) {
  return dataset?.files?.[key]?.state === FILE_STATE.FAILED;
}

/**
 * The first of `keys` that is not usable yet, as `{key, state, file}`, or null
 * when every one has settled without failing. Consumers that read several
 * files, such as an export, name the file they are waiting on from this,
 * through {@link dataFileLabel}.
 */
export function firstUnsettled(dataset, keys) {
  for (const key of keys) {
    const state = dataset?.files?.[key]?.state;
    if (state === FILE_STATE.LOADING || state === FILE_STATE.FAILED) {
      return { key, state, file: DATA_FILE_BY_KEY[key] };
    }
  }
  return null;
}
