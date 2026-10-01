import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { adoptingFetch } from '../../site/js/core/early-data.js';
import {
  CORE_FILE_KEYS, DATA_FILE_BY_KEY, DATA_MANIFEST_NAME, dataRequest, normalizeManifest,
} from '../../site/js/core/data-files.js';
import { loadDatasetStaged } from '../../site/js/core/dataset.js';
import { FIXTURE_DIR } from './helpers.mjs';

const PAGE = 'https://example.test/site/';
const SHA = (digit) => digit.repeat(64);

/** The classic inline scripts of the page, in document order. */
async function inlineScripts() {
  const html = await readFile(new URL('../../site/index.html', import.meta.url), 'utf8');
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
}

/**
 * Run the page's early-fetch script against a fake window.
 * @returns {{early: object|undefined, calls: {url: string, init: object}[]}}
 */
async function runEarlyScript({ href = PAGE, manifest, protocol = 'https:' } = {}) {
  const scripts = await inlineScripts();
  const source = scripts.find((text) => text.includes('__cyanoEarlyData'));
  assert.ok(source, 'the page carries the early-fetch script');
  const calls = [];
  const fetchFake = (url, init) => {
    calls.push({ url, init });
    if (url.endsWith(DATA_MANIFEST_NAME)) {
      if (manifest instanceof Error) return Promise.reject(manifest);
      if (manifest === undefined) return Promise.resolve(new Response('', { status: 404 }));
      return Promise.resolve(new Response(JSON.stringify(manifest), { status: 200 }));
    }
    return Promise.resolve(new Response('{}', { status: 200 }));
  };
  const location = new URL(href);
  const window = { location: { protocol, search: location.search } };
  const document = { baseURI: href };
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'fetch', source)(window, document, fetchFake);
  if (window.__cyanoEarlyData) await window.__cyanoEarlyData.ready;
  return { early: window.__cyanoEarlyData, calls };
}

const MANIFEST = {
  schemaVersion: 1,
  files: {
    'meta.json': { bytes: 10, sha256: SHA('a') },
    'genes.json': { bytes: 20, sha256: SHA('b') },
    'function-categories-v1.json': { bytes: 30, sha256: SHA('c') },
    'annotations.json': { bytes: 40, sha256: SHA('d') },
  },
};

test('the page starts the manifest and every tier 1 file before any module runs', async () => {
  const scripts = await inlineScripts();
  assert.equal(scripts.length, 2, 'the file notice, then the early fetch, and no other inline script');
  assert.ok(scripts[0].includes("window.location.protocol === 'file:'"),
    'the file notice still runs first');
  const html = await readFile(new URL('../../site/index.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('__cyanoEarlyData') < html.indexOf('type="module"'),
    'the early fetch is ahead of the module script');

  const { early, calls } = await runEarlyScript({ manifest: MANIFEST });
  const base = new URL('data/', PAGE);
  const manifest = normalizeManifest(MANIFEST);
  const expected = [
    { url: new URL(DATA_MANIFEST_NAME, base).href, init: { cache: 'no-cache', priority: 'high' } },
    ...CORE_FILE_KEYS.map((key) => {
      const file = DATA_FILE_BY_KEY[key];
      const request = dataRequest(base, file.name, manifest.files.get(file.name), file.tier);
      return { url: request.url, init: request.init };
    }),
  ];
  // Address for address and option for option what the loader itself asks for,
  // which is what lets it adopt these requests instead of repeating them.
  assert.deepEqual(calls, expected);
  assert.deepEqual(Object.keys(early.responses).sort(), expected.map((call) => call.url).sort());
  assert.ok(!calls.some((call) => call.url.includes('annotations.json')), 'only tier 1 is started early');
});

test('the early script stands aside where the module must decide', async () => {
  // A page opened from a file, or pointed at another data folder.
  assert.equal((await runEarlyScript({ protocol: 'file:' })).early, undefined);
  const overridden = await runEarlyScript({ href: `${PAGE}?data=other/`, manifest: MANIFEST });
  assert.equal(overridden.early, undefined);
  assert.equal(overridden.calls.length, 0);
  // No usable manifest: only the manifest itself was asked for, and `ready` still settles.
  for (const manifest of [undefined, new Error('offline'), { schemaVersion: 2, files: {} },
    { schemaVersion: 1 }, { schemaVersion: 1, files: { 'genes.json': { bytes: 1 } } }]) {
    const { early, calls } = await runEarlyScript({ manifest });
    assert.equal(calls.length, 1, JSON.stringify(manifest));
    assert.equal(Object.keys(early.responses).length, 1);
  }
});

test('an adopted response is handed out once, and anything else goes to the network', async () => {
  const network = [];
  const fetchImpl = async (url, init) => {
    network.push({ url, init });
    return new Response('"network"');
  };
  const early = {
    ready: Promise.resolve(),
    responses: {
      'https://example.test/a': Promise.resolve(new Response('"early"')),
      'https://example.test/broken': Promise.reject(new Error('reset')),
    },
  };
  // The rejection is handled by the adopter; keep the runtime from flagging it first.
  early.responses['https://example.test/broken'].catch(() => {});
  const adopted = adoptingFetch(early, fetchImpl);
  assert.equal(await (await adopted('https://example.test/a', { cache: 'force-cache' })).json(), 'early');
  assert.equal(network.length, 0);
  assert.equal(await (await adopted('https://example.test/a', { cache: 'force-cache' })).json(),
    'network', 'the same address again is a new request');
  assert.equal(await (await adopted('https://example.test/b', { cache: 'no-cache' })).json(), 'network');
  assert.equal(await (await adopted('https://example.test/broken', {})).json(), 'network',
    'an early request that failed is asked again');
  assert.deepEqual(network.map((call) => call.url),
    ['https://example.test/a', 'https://example.test/b', 'https://example.test/broken']);
  assert.deepEqual(network[1].init, { cache: 'no-cache' });
});

test('with nothing to adopt the fetch is used unchanged', () => {
  const fetchImpl = async () => new Response('');
  for (const early of [null, undefined, {}, { ready: Promise.resolve() }, { responses: {} },
    { ready: 5, responses: {} }]) {
    assert.equal(adoptingFetch(early, fetchImpl), fetchImpl);
  }
});

test('the loader waits for the early script, so no file is requested twice', async () => {
  const text = {
    'meta.json': await readFile(`${FIXTURE_DIR}/meta.json`, 'utf8'),
    'genes.json': await readFile(`${FIXTURE_DIR}/genes.json`, 'utf8'),
  };
  const base = new URL('data/', PAGE);
  const manifestUrl = new URL(DATA_MANIFEST_NAME, base).href;
  const network = [];
  const serve = (url) => {
    network.push(url);
    const name = new URL(url).pathname.split('/').pop();
    return Promise.resolve(name in text
      ? new Response(text[name]) : new Response('', { status: 404 }));
  };
  // The early script, as the page runs it: the manifest first, then the tier 1
  // files registered only once the manifest has been read.
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  const responses = { [manifestUrl]: serve(manifestUrl) };
  const ready = held.then(() => {
    for (const name of ['meta.json', 'genes.json']) {
      const url = new URL(name, base).href;
      responses[url] = serve(url);
    }
  });
  const staged = loadDatasetStaged({
    baseUrl: base, fetchImpl: adoptingFetch({ ready, responses }, (url) => serve(url)),
  });
  // The loader is already waiting; only now does the early script register its files.
  await Promise.resolve();
  release();
  const dataset = await staged.core;
  await staged.settled;
  assert.equal(dataset.genes.length, 300);
  const requested = (name) => network.filter((url) => url.endsWith(name)).length;
  assert.equal(requested('genes.json'), 1, 'the gene file is downloaded once');
  assert.equal(requested('meta.json'), 1);
  assert.equal(requested(DATA_MANIFEST_NAME), 1);
});
