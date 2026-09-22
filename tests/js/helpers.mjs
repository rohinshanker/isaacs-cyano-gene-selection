/** Shared helpers for the site's Node test suite. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { CodonTable, standardCodonList, standardAminoAcid } from '../../site/js/core/codon-table.js';
import { loadDataset } from '../../site/js/core/dataset.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const FIXTURE_DIR = resolve(HERE, '../fixtures/data');
export const EXPRESSION_FIXTURE_DIR = resolve(HERE, '../fixtures/data-expression');
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

/** Test-only CT reader used to verify the generated connectivity table. */
export function parseCt(text) {
  const lines = text.trim().split(/\r?\n/);
  const length = Number(lines.shift()?.trim().split(/\s+/)[0]);
  if (!Number.isInteger(length) || lines.length !== length) throw new Error('Invalid CT file.');
  const sequence = [];
  const pairs = Array(length).fill(0);
  for (const line of lines) {
    const fields = line.trim().split(/\s+/);
    const index = Number(fields[0]);
    sequence[index - 1] = fields[1];
    pairs[index - 1] = Number(fields[4]);
  }
  return { sequence: sequence.join(''),
    structure: pairs.map((mate, index) => mate === 0 ? '.' : mate > index + 1 ? '(' : ')').join('') };
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

let cachedExpression = null;
/** The fixture with expression, basis, and proxy fields, loaded once per process. */
export async function expressionFixtureDataset() {
  if (!cachedExpression) {
    cachedExpression = await loadDataset({
      baseUrl: `file://${EXPRESSION_FIXTURE_DIR}/`, fetchImpl: fileFetch(),
    });
  }
  return cachedExpression;
}
