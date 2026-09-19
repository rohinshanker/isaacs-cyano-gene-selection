/** No sequence leaves this origin. Terminating this worker cancels native work. */
import { loadFoldingEngine } from '../core/folding-engine.js';

let engine;
self.onmessage = async ({ data: { id, windows } }) => {
  try {
    engine ??= await loadFoldingEngine();
    const result = {};
    for (const [name, { wild, recoded }] of Object.entries(windows)) {
      const wildMfe = engine(wild);
      const recodedMfe = wild === recoded ? wildMfe : engine(recoded);
      result[name] = { wildMfe, recodedMfe, delta: recodedMfe - wildMfe, length: wild.length };
    }
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
