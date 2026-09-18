/** Shared helpers for the site's Node test suite. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { CodonTable, standardCodonList, standardAminoAcid } from '../../site/js/core/codon-table.js';
import { loadDataset } from '../../site/js/core/dataset.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const FIXTURE_DIR = resolve(HERE, '../fixtures/data');
export const SYMBOLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** The standard alphabet, shaped exactly like `meta.codonAlphabet`. */
export function standardAlphabet() {
  return standardCodonList().map((codon, i) => ({
    sym: SYMBOLS[i], codon, aa: standardAminoAcid(codon),
  }));
}

export function standardTable() {
  return new CodonTable(standardAlphabet());
}

/** A `fetch` that reads the fixture directory, so dataset loading is testable. */
export function fileFetch() {
  return async (url) => {
    const path = url.startsWith('file:') ? fileURLToPath(url) : url;
    try {
      const text = await readFile(path, 'utf8');
      return { ok: true, status: 200, json: async () => JSON.parse(text) };
    } catch (error) {
      if (error.code === 'ENOENT') return { ok: false, status: 404, json: async () => null };
      throw error;
    }
  };
}

let cached = null;
/** The fixture dataset, loaded once per test process. */
export async function fixtureDataset() {
  if (!cached) {
    cached = await loadDataset({ baseUrl: `file://${FIXTURE_DIR}/`, fetchImpl: fileFetch() });
  }
  return cached;
}
