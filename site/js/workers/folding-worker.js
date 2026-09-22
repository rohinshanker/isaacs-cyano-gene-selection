/** No sequence leaves this origin. Terminating this worker cancels native work. */
import { loadFoldingEngine } from '../core/folding-engine.js';

let engine;
self.onmessage = async ({ data: { id, windows } }) => {
  try {
    engine ??= await loadFoldingEngine();
    const result = {};
    for (const [name, { wild, recoded }] of Object.entries(windows)) {
      const wildMfe = engine(wild);
      const wildStructure = engine.lastStructure;
      const recodedMfe = wild === recoded ? wildMfe : engine(recoded);
      const recodedStructure = wild === recoded ? wildStructure : engine.lastStructure;
      result[name] = { wildMfe, recodedMfe, wildStructure, recodedStructure,
        wildSequence: wild, recodedSequence: recoded,
        delta: recodedMfe - wildMfe, length: wild.length };
    }
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
