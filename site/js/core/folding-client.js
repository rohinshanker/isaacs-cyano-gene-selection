/** One cancellable worker, with an in-memory cache scoped to exact input and model. */
import { FOLD_SETTINGS, foldingDatasetChecksum, foldingSequences } from './folding-sequences.js';
import { serializeSchemeMap } from './scheme.js';

export class FoldingClient {
  constructor({ workerFactory = () => new Worker(new URL('../workers/folding-worker.js', import.meta.url),
    { type: 'module' }), supported = () => typeof WebAssembly !== 'undefined'
      && typeof Worker !== 'undefined' && Boolean(globalThis.crypto?.subtle),
    checksum = foldingDatasetChecksum, timeoutMs = 30000 } = {}) {
    this.workerFactory = workerFactory;
    this.supported = supported;
    this.checksum = checksum;
    this.timeoutMs = timeoutMs;
    this.cache = new Map();
    this.datasetHashes = new WeakMap();
    this.sequence = 0;
    this.running = false;
  }

  cancel() {
    this.cancelled = true;
    this.stopWorker(new Error('Folding cancelled.'));
  }

  stopWorker(error) {
    this.worker?.terminate();
    this.worker = null;
    this.pending?.reject(error);
  }

  request(windows) {
    if (!this.worker) {
      this.worker = this.workerFactory();
      this.worker.onmessage = ({ data }) => {
        if (data.id !== this.pending?.id) return;
        if (data.error) this.pending.reject(new Error(data.error));
        else this.pending.resolve(data.result);
      };
      this.worker.onerror = (event) => {
        event.preventDefault();
        this.stopWorker(new Error('Local folding engine could not load. Check offline availability or browser support, then retry.'));
      };
    }
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const finish = (fn, value) => {
        clearTimeout(timer);
        this.pending = null;
        fn(value);
      };
      const timer = setTimeout(() => this.stopWorker(new Error('Folding engine timed out; retry the request.')), this.timeoutMs);
      this.pending = { id, resolve: (value) => finish(resolve, value), reject: (error) => finish(reject, error) };
      try { this.worker.postMessage({ id, windows }); } catch (error) { this.stopWorker(error); }
    });
  }

  async run({ dataset, ids, map, onProgress = () => {} }) {
    if (this.running) throw new Error('A folding request is already running.');
    if (!this.supported()) throw new Error('Local folding requires WebAssembly, module workers, and a secure browser context (HTTPS or localhost).');
    this.running = true;
    this.cancelled = false;
    const results = [];
    const capturedMap = { ...map };
    const capturedIds = [...ids];
    try {
      onProgress({ completed: 0, total: capturedIds.length, results: [], phase: 'loading' });
      if (!this.datasetHashes.has(dataset)) this.datasetHashes.set(dataset, await this.checksum(dataset));
      const datasetHash = this.datasetHashes.get(dataset);
      for (const id of capturedIds) {
        if (this.cancelled) break;
        const key = JSON.stringify([datasetHash, id, serializeSchemeMap(capturedMap), FOLD_SETTINGS]);
        let result;
        try {
          if (this.cache.has(key)) {
            result = { ...this.cache.get(key), cached: true };
          } else {
            const index = dataset.indexById.get(id);
            const windows = foldingSequences(dataset.genes[index], dataset.table, capturedMap);
            const values = await this.request(windows);
            if (this.cancelled) break;
            result = { id, windows: values, cached: false };
            this.cache.set(key, result);
            // Bound memory for long exploration sessions; oldest completed work goes first.
            if (this.cache.size > 1000) this.cache.delete(this.cache.keys().next().value);
          }
        } catch (error) {
          if (this.cancelled) break;
          result = { id, error: error.message };
        }
        results.push(result);
        onProgress({ completed: results.length, total: capturedIds.length, results: [...results], phase: 'folding' });
      }
      return { results, cancelled: this.cancelled, settings: FOLD_SETTINGS, datasetChecksum: datasetHash,
        map: capturedMap, ids: capturedIds };
    } finally {
      this.running = false;
    }
  }
}
