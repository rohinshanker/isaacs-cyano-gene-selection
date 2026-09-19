/** Integrity-checked local ViennaRNA build; imported only inside the requested worker. */
export const WASM_SHA256 = '5ebadc41700fc83237c1b1213ecb925c4ef852558e810ede0b174aabca7a3786';

export async function loadFoldingEngine({ fetchImpl = fetch,
  importEngine = () => import('../../vendor/viennarna/vienna.js') } = {}) {
  let module;
  try {
    const response = await fetchImpl(new URL('../../vendor/viennarna/vienna.wasm', import.meta.url));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const wasmBinary = await response.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', wasmBinary);
    const actual = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
    if (actual !== WASM_SHA256) throw new Error('Engine integrity check failed');
    const { default: initialize } = await importEngine();
    module = await initialize({ wasmBinary });
  } catch (error) {
    throw new Error(`Local RNA engine unavailable: ${error.message}. If offline, reconnect once to load this site's engine, then retry. No remote folding service is used.`);
  }
  return (sequence) => {
    if (typeof sequence !== 'string' || !/^[ACGU]{1,100}$/.test(sequence)) {
      throw new Error('Folding requires 1–100 unambiguous RNA bases.');
    }
    const energy = module.ccall('fold_mfe', 'number', ['string'], [sequence]);
    if (!Number.isFinite(energy)) throw new Error('ViennaRNA returned an invalid energy.');
    return energy;
  };
}
