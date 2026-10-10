/**
 * Whole-strain fitness dataset catalogue, selection resolution, and loading.
 *
 * These datasets are deliberately separate from the per-gene measurement
 * catalogue: a whole-strain value can never become a gene axis, colour, or
 * filter merely because it is selectable here.
 */
import { FILE_STATE, dataRequest } from './data-files.js';
import { matchesManifest, readBody } from './dataset.js';
import { validateStrainFitness } from './strain-fitness.js';

export const FITNESS_IDLE = 'idle';

/** The admitted catalogue for one organism, already frozen by the registry. */
export function strainFitnessDatasetsFor(organism) {
  return organism?.strainFitnessDatasets ?? [];
}

/** Typed whole-strain ids only; gene-source ids have no path into this set. */
export function normalizeStrainFitnessDatasetIds(catalogue, ids) {
  const selected = new Set(Array.isArray(ids) ? ids : []);
  return catalogue.filter((dataset) => selected.has(dataset.id)).map((dataset) => dataset.id);
}

function localDataset(catalogue, requestedId) {
  return catalogue.find((dataset) => dataset.id === requestedId) ?? catalogue[0] ?? null;
}

/**
 * Resolve a local choice against whole-strain IDs selected in Data Sources.
 *
 * One selected dataset is authoritative. Two distinct selected datasets are
 * not pooled or guessed: the local selector remains authoritative and the
 * ambiguity is surfaced to the reader.
 */
export function resolveStrainFitnessSelection(catalogue, {
  localId = null, selectedDatasetIds = [],
} = {}) {
  const selected = normalizeStrainFitnessDatasetIds(catalogue, selectedDatasetIds);
  const matches = catalogue.filter((dataset) => selected.includes(dataset.id));
  if (matches.length === 1) {
    const dataset = matches[0];
    return Object.freeze({
      dataset,
      origin: 'external',
      originIds: Object.freeze([dataset.id]),
      ambiguousIds: Object.freeze([]),
      showLocalSelector: false,
    });
  }
  const dataset = localDataset(catalogue, localId);
  return Object.freeze({
    dataset,
    origin: 'local',
    originIds: Object.freeze(dataset ? [dataset.id] : []),
    ambiguousIds: Object.freeze(matches.map((entry) => entry.id)),
    showLocalSelector: true,
  });
}

function errorFor(dataset, message, cause = null) {
  return new Error(`could not load strain fitness dataset ${dataset.id} (${dataset.file}): ${message}`,
    cause ? { cause } : undefined);
}

/**
 * Independent, lazy load records for every admitted whole-strain dataset.
 * Attempt tokens make a retry authoritative over an older request that lands
 * later; switching datasets needs no cancellation because payloads never share
 * a storage slot.
 */
export class StrainFitnessDatasetLoader {
  constructor({ catalogue, baseUrl, dataset, fetchImpl = fetch, manifest = null, onChange = () => {} }) {
    this.catalogue = catalogue;
    this.baseUrl = new URL(baseUrl, globalThis.location?.href ?? 'http://localhost/');
    this.hostDataset = dataset;
    this.fetchImpl = fetchImpl;
    this.manifest = Promise.resolve(manifest);
    this.onChange = onChange;
    this.records = new Map(catalogue.map((entry) => [entry.id, {
      state: FITNESS_IDLE, data: null, error: null, attempt: 0,
    }]));
  }

  snapshot(id) {
    const record = this.records.get(id);
    return record ? Object.freeze({ state: record.state, data: record.data, error: record.error }) : null;
  }

  ensure(id) {
    const record = this.records.get(id);
    if (!record || record.state !== FITNESS_IDLE) return false;
    record.promise = this.#load(id);
    return true;
  }

  retry(id) {
    const record = this.records.get(id);
    if (!record || record.state !== FILE_STATE.FAILED) return false;
    record.promise = this.#load(id, true);
    return true;
  }

  when(id) {
    return this.records.get(id)?.promise ?? Promise.resolve();
  }

  async #load(id, fresh = false) {
    const entry = this.catalogue.find((dataset) => dataset.id === id);
    const record = this.records.get(id);
    const attempt = ++record.attempt;
    Object.assign(record, { state: FILE_STATE.LOADING, data: null, error: null });
    this.onChange(id, this.snapshot(id));
    try {
      const manifest = await this.manifest;
      const manifestEntry = manifest?.files.get(entry.file) ?? null;
      if (manifest && !manifestEntry) {
        throw errorFor(entry, 'the admitted file is missing from data-manifest.json');
      }
      const request = dataRequest(this.baseUrl, entry.file, manifestEntry, 5);
      const attemptFetch = async (reload) => {
        const response = await this.fetchImpl(request.url,
          reload ? { ...request.init, cache: 'reload' } : request.init);
        if (!response.ok) throw errorFor(entry, `HTTP ${response.status}`);
        try {
          return await readBody(response, () => {});
        } catch (cause) {
          throw errorFor(entry, 'could not read the response body', cause);
        }
      };
      let result = await attemptFetch(fresh);
      if (manifestEntry && result.raw && !(await matchesManifest(result.raw, manifestEntry))) {
        if (!fresh) result = await attemptFetch(true);
        if (result.raw && !(await matchesManifest(result.raw, manifestEntry))) {
          throw errorFor(entry, 'does not match the published data manifest; the site may be mid-update');
        }
      }
      let raw;
      try {
        raw = result.raw
          ? JSON.parse(new TextDecoder().decode(result.raw))
          : result.data;
      } catch (cause) {
        throw errorFor(entry, 'invalid JSON', cause);
      }
      const data = validateStrainFitness(raw, this.hostDataset);
      if (record.attempt !== attempt) return;
      Object.assign(record, { state: FILE_STATE.READY, data, error: null });
    } catch (cause) {
      if (record.attempt !== attempt) return;
      const error = cause instanceof Error ? cause : errorFor(entry, String(cause));
      Object.assign(record, { state: FILE_STATE.FAILED, data: null, error });
    }
    this.onChange(id, this.snapshot(id));
  }
}
