/** Shared helpers for the site's Node test suite. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { CodonTable, standardCodonList, standardAminoAcid } from '../../site/js/core/codon-table.js';
import { loadDataset, loadDatasetStaged } from '../../site/js/core/dataset.js';
import { organismById } from '../../site/js/core/organisms.js';
import { buildFixture } from '../fixtures/make_fixture.mjs';

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

/** The second organism's record. */
export const ECOLI = organismById('ecoli-k12-mg1655');

/** Where the page reads the second organism's files from, as an absolute address. */
export const ECOLI_DATA_URL = `https://example.test/site/${ECOLI.dataDirectory}`;

let cachedEcoliFiles = null;
/**
 * The second organism's fixture, built in memory by the fixture generator: each
 * published file's exact text by name, its content manifest among them.
 */
export function ecoliFixtureFiles() {
  cachedEcoliFiles ??= buildFixture({ organism: ECOLI.id, genes: 120 }).files;
  return cachedEcoliFiles;
}

/**
 * A `fetch` over an in-memory directory, which records every address asked for.
 * @param {string} base the directory's address.
 * @param {Record<string, string>} files each file's text by name.
 * @returns {{fetchImpl: typeof fetch, requested: string[]}} `requested` holds
 *   the file names asked for, in order, without their cache key.
 */
export function memoryDirectory(base, files) {
  const requested = [];
  const fetchImpl = async (url) => {
    const address = new URL(url);
    const name = address.href.startsWith(base) ? address.pathname.split('/').pop() : null;
    requested.push(name ?? address.href);
    return name !== null && Object.hasOwn(files, name)
      ? new Response(files[name], { status: 200 }) : new Response('', { status: 404 });
  };
  return { fetchImpl, requested };
}

let cachedAnnotatedFiles = null;
/**
 * The second organism's annotated fixture: the same release plus
 * `annotations.json`, `go-term-names-v1.json`, and the `meta.annotationRelease`
 * that makes the first of them mandatory. This is the shape the real E. coli
 * release takes once its annotation layer is published.
 */
export function ecoliAnnotatedFixtureFiles() {
  cachedAnnotatedFiles ??= buildFixture({
    organism: ECOLI.id, genes: 120, annotations: true,
  }).files;
  return cachedAnnotatedFiles;
}

let cachedAnnotated = null;
/** The annotated E. coli fixture, loaded the way the page loads it. */
export async function ecoliAnnotatedFixtureDataset() {
  if (!cachedAnnotated) {
    const { fetchImpl, requested } = memoryDirectory(
      ECOLI_DATA_URL, ecoliAnnotatedFixtureFiles(),
    );
    const staged = loadDatasetStaged({ baseUrl: ECOLI_DATA_URL, fetchImpl, organism: ECOLI });
    cachedAnnotated = staged.core.then(async (dataset) => {
      await staged.settled;
      return { dataset, requested };
    });
  }
  return cachedAnnotated;
}

let cachedEcoli = null;
/**
 * The second organism's dataset, loaded the way the page loads it: through the
 * staged loader, from its own directory, under its own organism record.
 */
export async function ecoliFixtureDataset() {
  if (!cachedEcoli) {
    const { fetchImpl } = memoryDirectory(ECOLI_DATA_URL, ecoliFixtureFiles());
    const staged = loadDatasetStaged({ baseUrl: ECOLI_DATA_URL, fetchImpl, organism: ECOLI });
    cachedEcoli = staged.core.then(async (dataset) => {
      await staged.settled;
      return dataset;
    });
  }
  return cachedEcoli;
}
