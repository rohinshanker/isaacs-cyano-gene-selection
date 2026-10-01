import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  CORE_FILE_KEYS, DATA_FILES, DATA_FILE_BY_KEY, DATA_MANIFEST_NAME, FILE_STATE, TIER_LABELS,
  VERSION_KEY_LENGTH, dataRequest, firstUnsettled, hasFailed, isLoading, normalizeManifest,
  versionKey,
} from '../../site/js/core/data-files.js';
import {
  DATA_APPLIERS, TIER_LEAD_BYTES, buildCoreDataset, loadDataset, loadDatasetStaged,
} from '../../site/js/core/dataset.js';
import { FIXTURE_DIR } from './helpers.mjs';

const BASE = 'https://example.test/data/';
const SITE_DATA = new URL('../../site/data/', import.meta.url);
const SHA = 'a'.repeat(64);

const fixtureText = {};
async function fixture(name) {
  fixtureText[name] ??= await readFile(`${FIXTURE_DIR}/${name}`, 'utf8');
  return fixtureText[name];
}

const siteText = {};
async function site(name) {
  siteText[name] ??= await readFile(new URL(name, SITE_DATA), 'utf8');
  return siteText[name];
}

/**
 * A `fetch` over a table of routes, keyed by file name.
 *
 * A route is the body text, an `Error` to throw as a network failure, a
 * `Response`, or a function returning one of those. A name with no route is a
 * 404. Every call is logged with its exact URL and options.
 */
function memoryFetch(routes) {
  const log = [];
  const fetchImpl = async (url, init) => {
    log.push({ url, init, name: new URL(url).pathname.split('/').pop() });
    const name = log[log.length - 1].name;
    let route = routes[name];
    if (typeof route === 'function') route = await route(url, init);
    if (route === undefined) return new Response('', { status: 404 });
    if (route instanceof Error) throw route;
    if (route instanceof Response) return route;
    return new Response(route, { status: 200 });
  };
  return { fetchImpl, log };
}

/** A manifest describing exactly the bodies given. */
function manifestFor(bodies) {
  const files = {};
  for (const [name, text] of Object.entries(bodies)) {
    files[name] = {
      bytes: Buffer.byteLength(text),
      sha256: createHash('sha256').update(text).digest('hex'),
    };
  }
  return JSON.stringify({ schemaVersion: 1, files });
}

async function coreRoutes() {
  return { 'meta.json': await fixture('meta.json'), 'genes.json': await fixture('genes.json') };
}

/** A promise with its resolver, for holding one file back. */
function gate() {
  let open;
  const promise = new Promise((resolve) => { open = resolve; });
  return { promise, open };
}

test('the file registry orders dependencies before their dependents', () => {
  const seen = new Set();
  for (const file of DATA_FILES) {
    for (const key of file.needs) {
      assert.ok(seen.has(key), `${file.key} needs ${key}, which must be listed first`);
      assert.ok(DATA_FILE_BY_KEY[key], `${key} is a registered file`);
    }
    seen.add(file.key);
    assert.ok(TIER_LABELS[file.tier], `tier ${file.tier} has a label`);
    assert.equal(DATA_FILE_BY_KEY[file.key], file);
  }
  assert.deepEqual(CORE_FILE_KEYS, ['meta', 'genes', 'functionCategories']);
  assert.deepEqual(DATA_FILES.filter((file) => file.required).map((file) => file.key),
    ['meta', 'genes']);
  // Every later file has a validator-and-join, and the core files have none.
  assert.deepEqual(Object.keys(DATA_APPLIERS).sort(),
    DATA_FILES.filter((file) => file.tier > 1).map((file) => file.key).sort());
  // The derived category cannot be validated without the two files it is derived from.
  assert.deepEqual([...DATA_FILE_BY_KEY.sourceDerivedCategories.needs],
    ['annotations', 'candidateEvidence']);
  for (const key of ['annotations', 'candidateEvidence', 'sourceDerivedCategories']) {
    assert.equal(DATA_FILE_BY_KEY[key].tier, 2, `${key} lands with the category colour`);
  }
});

test('the site fetches every registered file and nothing the registry omits', async () => {
  const published = JSON.parse(await site(DATA_MANIFEST_NAME)).files;
  for (const file of DATA_FILES) assert.ok(published[file.name], `${file.name} is published`);
  // Published but never fetched by the page: citations has its own loader, and
  // the PCC 7942 table is an input to candidate_evidence.json, read by no module.
  const registered = new Set(DATA_FILES.map((file) => file.name));
  assert.deepEqual(Object.keys(published).filter((name) => !registered.has(name)).sort(),
    ['citations.json', 'pcc7942-essentiality-v1.json']);
});

test('a manifest is used only when every entry is well formed', () => {
  const good = { schemaVersion: 1, files: { 'genes.json': { bytes: 12, sha256: SHA } } };
  const manifest = normalizeManifest(good);
  assert.deepEqual(manifest.files.get('genes.json'), { bytes: 12, sha256: SHA });
  for (const bad of [
    null, 'text', [], { schemaVersion: 2, files: good.files }, { schemaVersion: 1 },
    { schemaVersion: 1, files: [] }, { schemaVersion: 1, files: {} },
    { schemaVersion: 1, files: { 'genes.json': null } },
    { schemaVersion: 1, files: { 'genes.json': { bytes: -1, sha256: SHA } } },
    { schemaVersion: 1, files: { 'genes.json': { bytes: 1.5, sha256: SHA } } },
    { schemaVersion: 1, files: { 'genes.json': { bytes: 1, sha256: 'ABC' } } },
    { schemaVersion: 1, files: { 'genes.json': { bytes: 1, sha256: 5 } } },
  ]) assert.equal(normalizeManifest(bad), null, JSON.stringify(bad));
});

test('a file with a manifest entry is addressed by its content and may come from cache', () => {
  const base = new URL(BASE);
  const entry = { bytes: 12, sha256: `0123456789abcdef${'f'.repeat(48)}` };
  assert.equal(versionKey(entry), '0123456789abcdef');
  assert.equal(versionKey(entry).length, VERSION_KEY_LENGTH);
  const keyed = dataRequest(base, 'genes.json', entry, 1);
  assert.equal(keyed.url, `${BASE}genes.json?v=0123456789abcdef`);
  assert.equal(keyed.plainUrl, `${BASE}genes.json`);
  assert.deepEqual(keyed.init, { cache: 'force-cache', priority: 'high' });
  // A changed file has a changed address, which is the whole safety argument.
  const changed = dataRequest(base, 'genes.json', { bytes: 12, sha256: 'b'.repeat(64) }, 1);
  assert.notEqual(changed.url, keyed.url);
  // Without an entry the plain name is revalidated on every visit, as before.
  const plain = dataRequest(base, 'genes.json', null, 3);
  assert.equal(plain.url, `${BASE}genes.json`);
  assert.deepEqual(plain.init, { cache: 'no-cache', priority: 'low' });
  assert.deepEqual(dataRequest(base, 'genes.json', null).init, { cache: 'no-cache' });
});

test('loading, failed and settled read differently, and a bare dataset reads as settled', () => {
  const dataset = { files: {
    tssEvidence: { state: FILE_STATE.LOADING },
    annotations: { state: FILE_STATE.FAILED },
    goTerms: { state: FILE_STATE.READY },
    excluded: { state: FILE_STATE.ABSENT },
  } };
  assert.equal(isLoading(dataset, 'tssEvidence'), true);
  assert.equal(isLoading(dataset, 'goTerms'), false);
  assert.equal(hasFailed(dataset, 'annotations'), true);
  assert.equal(hasFailed(dataset, 'excluded'), false);
  assert.equal(firstUnsettled(dataset, ['goTerms', 'excluded']), null);
  assert.deepEqual(firstUnsettled(dataset, ['goTerms', 'annotations', 'tssEvidence']),
    { key: 'annotations', state: 'failed', file: DATA_FILE_BY_KEY.annotations });
  assert.equal(firstUnsettled(dataset, ['tssEvidence']).state, 'loading');
  for (const bare of [null, undefined, {}, { files: {} }]) {
    assert.equal(isLoading(bare, 'tssEvidence'), false);
    assert.equal(hasFailed(bare, 'tssEvidence'), false);
    assert.equal(firstUnsettled(bare, ['tssEvidence']), null);
  }
});

test('the map is usable on tier 1 while a later file is still in flight', async () => {
  const held = gate();
  const tss = {};
  const { fetchImpl } = memoryFetch({
    ...await coreRoutes(),
    'tss_evidence.json': () => held.promise.then(() => JSON.stringify(tss)),
  });
  const landed = [];
  const staged = loadDatasetStaged({
    baseUrl: BASE, fetchImpl, onFile: (key, record) => landed.push([key, record.state]),
  });
  const dataset = await staged.core;
  assert.equal(dataset.genes.length, 300);
  assert.ok(dataset.baseline, 'the scheme baseline is computed on tier 1');
  for (const key of CORE_FILE_KEYS) assert.notEqual(dataset.files[key].state, 'loading');
  assert.equal(dataset.files.functionCategories.state, 'absent');
  // Not here yet is not the same as not there.
  assert.equal(isLoading(dataset, 'tssEvidence'), true);
  assert.equal(dataset.genes[0].tssEvidence, undefined);
  await staged.when(DATA_FILES.filter((file) => file.tier === 2).map((file) => file.key));
  assert.equal(staged.snapshot().currentTier, 3, 'the bar names the tier still in flight');

  tss[dataset.genes[0].id] = [{ id: 'TSS_1', sourceStartDistanceNt: 12 }];
  held.open();
  await staged.when(['tssEvidence']);
  assert.equal(dataset.files.tssEvidence.state, 'ready');
  assert.deepEqual(dataset.genes[0].tssEvidence, tss[dataset.genes[0].id]);
  assert.deepEqual(dataset.genes[1].tssEvidence, [], 'a gene with no rows has none, known');
  assert.equal(await staged.settled, dataset, 'later files join the same dataset');
  assert.equal(staged.snapshot().currentTier, null);
  assert.deepEqual(landed.at(-1), ['tssEvidence', 'ready']);
  // Every optional file this deployment does not publish settled as absent.
  for (const key of ['annotations', 'lengthCohorts', 'regulatoryTss', 'goTerms']) {
    assert.equal(dataset.files[key].state, 'absent', key);
  }
});

test('with a manifest every file is keyed by content and unlisted ones are not requested', async () => {
  const bodies = await coreRoutes();
  bodies['excluded.json'] = '[]';
  const { fetchImpl, log } = memoryFetch({ ...bodies, [DATA_MANIFEST_NAME]: manifestFor(bodies) });
  const staged = loadDatasetStaged({ baseUrl: BASE, fetchImpl });
  const manifest = await staged.manifest;
  const dataset = await staged.settled;
  assert.equal(manifest.files.size, 3);
  assert.deepEqual(log.map((entry) => entry.name).sort(),
    [DATA_MANIFEST_NAME, 'excluded.json', 'genes.json', 'meta.json']);
  assert.deepEqual(log[0].init, { cache: 'no-cache', priority: 'high' },
    'the manifest itself is always revalidated');
  const genes = log.find((entry) => entry.name === 'genes.json');
  assert.match(genes.url, /genes\.json\?v=[0-9a-f]{16}$/);
  assert.deepEqual(genes.init, { cache: 'force-cache', priority: 'high' });
  assert.equal(dataset.files.codonPca.state, 'absent', 'unlisted means not published');
  assert.equal(dataset.files.excluded.state, 'ready');
  const snapshot = staged.snapshot();
  assert.equal(snapshot.exact, true);
  assert.equal(snapshot.receivedBytes, snapshot.totalBytes);
  assert.equal(snapshot.totalBytes,
    Object.values(bodies).reduce((total, text) => total + Buffer.byteLength(text), 0));
  assert.equal(snapshot.settledFiles, snapshot.totalFiles);
});

test('without a manifest every file is asked for by name and revalidated', async () => {
  for (const manifest of [undefined, new Error('offline'), '{not json', '{"schemaVersion":2}']) {
    const { fetchImpl, log } = memoryFetch({ ...await coreRoutes(), [DATA_MANIFEST_NAME]: manifest });
    const staged = loadDatasetStaged({ baseUrl: BASE, fetchImpl });
    assert.equal(await staged.manifest, null);
    await staged.settled;
    assert.equal(log.length, DATA_FILES.length + 1, 'every registered file is requested');
    for (const entry of log.slice(1)) {
      assert.ok(!entry.url.includes('?'), entry.url);
      assert.equal(entry.init.cache, 'no-cache');
    }
    assert.equal(staged.snapshot().exact, false);
  }
});

test('progress counts decoded bytes against the manifest as a file streams in', async () => {
  const bodies = await coreRoutes();
  const { fetchImpl } = memoryFetch({ ...bodies, [DATA_MANIFEST_NAME]: manifestFor(bodies) });
  const seen = [];
  const staged = loadDatasetStaged({
    baseUrl: BASE, fetchImpl, onProgress: (snapshot) => seen.push(snapshot),
  });
  await staged.settled;
  const total = Buffer.byteLength(bodies['meta.json']) + Buffer.byteLength(bodies['genes.json']);
  assert.ok(seen.length > 3);
  assert.ok(seen.every((snapshot) => snapshot.totalBytes === total && snapshot.exact));
  assert.ok(seen.every((snapshot) => snapshot.receivedBytes <= total));
  for (let i = 1; i < seen.length; i += 1) {
    assert.ok(seen[i].receivedBytes >= seen[i - 1].receivedBytes, 'progress never runs backwards');
  }
  assert.ok(seen.some((snapshot) => snapshot.receivedBytes > 0 && snapshot.receivedBytes < total),
    'a partial state was reported, not only empty and full');
  assert.equal(seen.at(-1).receivedBytes, total);
  assert.equal(seen[0].tiers[1].total, 3);
  assert.ok(Number.isFinite(seen.at(-1).elapsedMs));
});

test('a copy that is not the size the manifest names is re-read from the server', async () => {
  const bodies = await coreRoutes();
  const stale = '[1, 2, 3]';
  const { fetchImpl, log } = memoryFetch({
    ...bodies,
    [DATA_MANIFEST_NAME]: manifestFor({ ...bodies, 'excluded.json': '[]' }),
    // The cache answers with another release's copy; the server has the current one.
    'excluded.json': (url, init) => (init.cache === 'reload' ? '[]' : stale),
  });
  const dataset = await loadDatasetStaged({ baseUrl: BASE, fetchImpl }).settled;
  const requests = log.filter((entry) => entry.name === 'excluded.json');
  assert.equal(requests.length, 2);
  assert.match(requests[0].url, /\?v=/);
  assert.equal(requests[0].init.cache, 'force-cache');
  // Asked for again under the same address, from the server, which also
  // replaces the stale copy the cache held there.
  assert.equal(requests[1].url, requests[0].url);
  assert.equal(requests[1].init.cache, 'reload');
  assert.deepEqual(dataset.excluded, [], 'the current file is the one that was read');
});

test('a missing optional file is absent; one that could not be read has failed', async () => {
  const { fetchImpl } = memoryFetch({
    ...await coreRoutes(),
    'codon_pca.json': new Response('', { status: 500 }),
    'excluded.json': new Error('connection reset'),
    'length_cohorts.json': '{not json',
  });
  const dataset = await loadDatasetStaged({ baseUrl: BASE, fetchImpl }).settled;
  assert.equal(dataset.files.regulatoryTss.state, 'absent');
  assert.equal(dataset.files.codonPca.state, 'failed');
  assert.equal(dataset.files.codonPca.error.message, `could not read ${BASE}codon_pca.json: HTTP 500`);
  assert.equal(dataset.files.excluded.state, 'failed');
  assert.equal(dataset.files.excluded.error.message,
    `could not read ${BASE}excluded.json: connection reset`);
  assert.equal(dataset.files.lengthCohorts.state, 'failed');
  assert.ok(dataset.files.lengthCohorts.error instanceof SyntaxError);
  assert.equal(hasFailed(dataset, 'codonPca'), true);
  // The single-step loader keeps its old rule: an unreadable optional file is absent,
  // and a file that is there but is not JSON is still an error.
  const lenient = memoryFetch({
    ...await coreRoutes(),
    'codon_pca.json': new Response('', { status: 500 }),
    'excluded.json': new Error('connection reset'),
  });
  const whole = await loadDataset({ baseUrl: BASE, fetchImpl: lenient.fetchImpl });
  assert.equal(whole.codonPca, null);
  assert.deepEqual(whole.excluded, []);
  const broken = memoryFetch({ ...await coreRoutes(), 'length_cohorts.json': '{not json' });
  await assert.rejects(loadDataset({ baseUrl: BASE, fetchImpl: broken.fetchImpl }), SyntaxError);
});

test('a tier 1 failure rejects core, settles everything, and never hangs', async () => {
  const cases = [
    [{ 'meta.json': await fixture('meta.json') }, /could not read .*genes\.json: HTTP 404/],
    [{ 'genes.json': await fixture('genes.json'), 'meta.json': new Error('offline') },
      /could not read .*meta\.json: offline/],
    [{ ...await coreRoutes(), 'genes.json': '[]' }, /genes\.json is empty/],
    [{ ...await coreRoutes(), 'genes.json': '{}' }, /genes\.json must be an array/],
  ];
  for (const [routes, message] of cases) {
    const { fetchImpl } = memoryFetch(routes);
    const staged = loadDatasetStaged({ baseUrl: BASE, fetchImpl });
    await assert.rejects(staged.core, message);
    assert.equal(await staged.settled, null);
    await staged.when(['genes', 'tssEvidence']);
    const snapshot = staged.snapshot();
    assert.equal(snapshot.settledFiles, snapshot.totalFiles, 'nothing is left loading');
    assert.equal(staged.files.tssEvidence.state, 'failed');
    assert.match(staged.files.tssEvidence.error.message,
      /was not read because the gene data could not be loaded/);
    assert.equal(staged.retry('genes'), false, 'tier 1 is retried by reloading the dataset');
    await assert.rejects(loadDataset({ baseUrl: BASE, fetchImpl: memoryFetch(routes).fetchImpl }),
      message);
  }
});

test('an unreadable reviewed-category table fails tier 1 rather than colouring without it', async () => {
  // The reviewed table is optional, so a deployment without one loads. One that
  // publishes it but cannot serve it must not draw every reviewed gene as unknown.
  const routes = () => coreRoutes().then((core) => ({
    ...core, 'function-categories-v1.json': new Response('', { status: 503 }),
  }));
  const staged = loadDatasetStaged({ baseUrl: BASE, fetchImpl: memoryFetch(await routes()).fetchImpl });
  await assert.rejects(staged.core, /could not read .*function-categories-v1\.json: HTTP 503/);
  assert.equal(staged.files.functionCategories.state, 'failed');
  // The single-step loader keeps its old rule for an optional file.
  const whole = await loadDataset({ baseUrl: BASE, fetchImpl: memoryFetch(await routes()).fetchImpl });
  assert.equal(whole.functionCategories, null);
  assert.equal(whole.files.functionCategories.state, 'absent');
});

test('a file declared by meta.json is required, and its absence is that file\'s failure', async () => {
  const meta = JSON.parse(await fixture('meta.json'));
  meta.tssEvidenceSource = { id: 'tan2018' };
  meta.annotationRelease = { releaseId: 'R1' };
  const routes = { ...await coreRoutes(), 'meta.json': JSON.stringify(meta) };
  const dataset = await loadDatasetStaged({ baseUrl: BASE, fetchImpl: memoryFetch(routes).fetchImpl })
    .settled;
  assert.equal(dataset.files.tssEvidence.error.message,
    'tss_evidence.json is required by meta.tssEvidenceSource');
  assert.equal(dataset.files.annotations.error.message,
    'annotations.json is required by meta.annotationRelease');
  // The map itself loaded: one unreadable evidence file no longer costs the visit.
  assert.equal(dataset.genes.length, 300);
  assert.equal(dataset.files.genes.state, 'ready');
  await assert.rejects(
    loadDataset({ baseUrl: BASE, fetchImpl: memoryFetch(routes).fetchImpl }),
    /annotations\.json is required by meta\.annotationRelease/,
  );
});

test('a failed validation leaves the dataset as it was', async () => {
  const dataset = buildCoreDataset(
    JSON.parse(await fixture('meta.json')), JSON.parse(await fixture('genes.json')), null,
  );
  const [first, second] = dataset.genes;
  assert.throws(() => DATA_APPLIERS.annotations(dataset, { [first.id]: { goAnnotations: [] } }),
    new RegExp(`annotations.json has no evidence for ${second.id}`));
  assert.equal(first.annotationEvidence, undefined, 'no gene is left half joined');
  assert.throws(() => DATA_APPLIERS.tssEvidence(dataset, { [first.id]: [], [second.id]: 'x' }),
    /tss_evidence.json has invalid rows/);
  assert.equal(first.tssEvidence, undefined);
  assert.throws(() => DATA_APPLIERS.goTerms(dataset, { schemaVersion: 2 }),
    /go-term-names-v1.json has an invalid lookup schema/);
  assert.equal(dataset.goTerms, null);
  // Absent optional files apply cleanly and leave their documented empty values.
  for (const key of Object.keys(DATA_APPLIERS)) DATA_APPLIERS[key](dataset, null);
  assert.deepEqual(dataset.excluded, []);
  assert.equal(dataset.provenance.excludedCount, 0);
  assert.equal(dataset.sourceDerivedCategories, null);
  assert.equal(dataset.goIeaEssentiality, null);
  DATA_APPLIERS.excluded(dataset, [{ id: 'x' }, { id: 'y' }]);
  assert.equal(dataset.provenance.excludedCount, 2);
  DATA_APPLIERS.codonPca(dataset, { explainedVariance: [0.5] });
  assert.deepEqual(dataset.codonPca, { explainedVariance: [0.5] });
});

/** A `fetch` over the published site data, with per-file overrides. */
function siteFetch(overrides = {}) {
  const log = [];
  const fetchImpl = async (url, init) => {
    const name = new URL(url).pathname.split('/').pop();
    log.push({ name, url, init });
    if (name in overrides) {
      let route = overrides[name];
      if (typeof route === 'function') route = await route(url, init);
      if (route instanceof Error) throw route;
      if (route instanceof Response) return route;
      if (route !== undefined) return new Response(route, { status: 200 });
    }
    return new Response(await site(name), { status: 200 });
  };
  return { fetchImpl, log };
}

test('the staged loader and the single-step loader build the same dataset', async () => {
  const staged = loadDatasetStaged({ baseUrl: BASE, fetchImpl: siteFetch().fetchImpl });
  const dataset = await staged.settled;
  const whole = await loadDataset({ baseUrl: BASE, fetchImpl: siteFetch().fetchImpl });
  for (const file of DATA_FILES) assert.equal(dataset.files[file.key].state, 'ready', file.key);
  assert.equal(dataset.genes.length, whole.genes.length);
  assert.deepEqual(dataset.genes[100], whole.genes[100]);
  assert.deepEqual(dataset.provenance, whole.provenance);
  assert.deepEqual(dataset.baseline.recodedCai, whole.baseline.recodedCai);
  assert.deepEqual(dataset.sourceDerivedCategories.counts, whole.sourceDerivedCategories.counts);
  assert.deepEqual(dataset.goTerms, whole.goTerms);
  assert.equal(dataset.regulatoryTss.sites?.length ?? Object.keys(dataset.regulatoryTss).length,
    whole.regulatoryTss.sites?.length ?? Object.keys(whole.regulatoryTss).length);
  const snapshot = staged.snapshot();
  assert.equal(snapshot.exact, true);
  assert.equal(snapshot.receivedBytes, snapshot.totalBytes);
});

test('a failed file blocks only the files that read it, and a retry re-runs them', async () => {
  let attempts = 0;
  const { fetchImpl, log } = siteFetch({
    'candidate_evidence.json': () => {
      attempts += 1;
      return attempts === 1 ? new Response('', { status: 502 }) : undefined;
    },
  });
  const events = [];
  const staged = loadDatasetStaged({
    baseUrl: BASE, fetchImpl, onFile: (key, record) => events.push(`${key}:${record.state}`),
  });
  const dataset = await staged.settled;
  assert.equal(dataset.files.candidateEvidence.state, 'failed');
  assert.match(dataset.files.candidateEvidence.error.message, /candidate_evidence\.json: HTTP 502/);
  for (const key of ['sourceDerivedCategories', 'goIeaEssentiality']) {
    assert.equal(dataset.files[key].state, 'failed', key);
    assert.equal(dataset.files[key].blockedBy, 'candidateEvidence');
    assert.match(dataset.files[key].error.message,
      /is waiting on candidate_evidence\.json, which could not be loaded/);
  }
  // Everything that does not read it loaded normally.
  for (const key of ['annotations', 'tssEvidence', 'goTerms', 'lengthCohorts', 'regulatoryTss']) {
    assert.equal(dataset.files[key].state, 'ready', key);
  }
  assert.equal(dataset.sourceDerivedCategories, null);
  // The single-step loader reports the cause, not a consequence of it.
  let again = 0;
  const failing = siteFetch({
    'candidate_evidence.json': () => {
      again += 1;
      return '{}';
    },
  });
  await assert.rejects(loadDataset({ baseUrl: BASE, fetchImpl: failing.fetchImpl }),
    (error) => !/is waiting on/.test(error.message));

  assert.equal(staged.retry('nonsense'), false);
  assert.equal(staged.retry('annotations'), false, 'a file that did not fail is not retried');
  assert.equal(staged.retry('candidateEvidence'), true);
  assert.equal(isLoading(dataset, 'candidateEvidence'), true);
  assert.equal(isLoading(dataset, 'sourceDerivedCategories'), true, 'its dependents wait again');
  await staged.when(['candidateEvidence', 'sourceDerivedCategories', 'goIeaEssentiality']);
  for (const key of ['candidateEvidence', 'sourceDerivedCategories', 'goIeaEssentiality']) {
    assert.equal(dataset.files[key].state, 'ready', key);
    assert.equal(dataset.files[key].error, null);
  }
  assert.ok(dataset.sourceDerivedCategories, 'the derived categories validated on the retry');
  const retried = log.filter((entry) => entry.name === 'candidate_evidence.json').at(-1);
  assert.match(retried.url, /candidate_evidence\.json\?v=[0-9a-f]{16}$/);
  assert.equal(retried.init.cache, 'reload', 'a retry asks the server, not the cache');
  assert.equal(log.filter((entry) => entry.name === 'source-derived-categories-v1.json').length, 1,
    'a dependent that was only waiting is re-applied, not re-downloaded');
  assert.ok(events.includes('candidateEvidence:failed') && events.at(-1).endsWith(':ready'));
  assert.equal(await staged.settled, dataset);
});

/** A response whose body the test delivers chunk by chunk. */
function streamed() {
  let controller;
  const body = new ReadableStream({ start(value) { controller = value; } });
  return {
    response: new Response(body, { status: 200 }),
    push: (bytes) => controller.enqueue(bytes),
    close: () => controller.close(),
  };
}

/** Let every pending promise callback and stream read run. */
const settleTurns = () => new Promise((resolve) => { setTimeout(resolve, 5); });

test('later tiers are not requested while the gene file still has far to go', async () => {
  // Every file asked for at once shares the link, so the largest file, the one
  // the map waits for, finished last. Each tier waits for the one before it.
  const core = await coreRoutes();
  const genesBytes = new TextEncoder().encode(core['genes.json']);
  assert.ok(genesBytes.length > 3 * TIER_LEAD_BYTES, 'the fixture is large enough to pace');
  const bodies = {
    ...core, 'excluded.json': '[]', 'codon_pca.json': '{}', 'tss_evidence.json': '{}',
    'regulatory_tss.json': '{}',
  };
  const genes = streamed();
  const { fetchImpl, log } = memoryFetch({
    ...bodies, [DATA_MANIFEST_NAME]: manifestFor(bodies), 'genes.json': genes.response,
  });
  const staged = loadDatasetStaged({ baseUrl: BASE, fetchImpl });
  const asked = () => log.map((entry) => entry.name);
  const tierOf = (name) => DATA_FILES.find((file) => file.name === name)?.tier;

  // All but the last 2 x lead has arrived: still too far out to release tier 2.
  genes.push(genesBytes.slice(0, genesBytes.length - 2 * TIER_LEAD_BYTES));
  await settleTurns();
  assert.deepEqual(asked().filter((name) => tierOf(name) > 1), [],
    'nothing past tier 1 competes with the gene file');
  assert.deepEqual(asked().sort(), [DATA_MANIFEST_NAME, 'genes.json', 'meta.json']);

  // Within the lead: tier 2 goes out while the last bytes are still arriving,
  // so the connection is never idle between tiers.
  genes.push(genesBytes.slice(genesBytes.length - 2 * TIER_LEAD_BYTES,
    genesBytes.length - TIER_LEAD_BYTES + 1));
  await settleTurns();
  assert.equal(staged.files.genes.state, 'loading', 'the gene file itself has not finished');
  assert.deepEqual(asked().filter((name) => tierOf(name) === 2).sort(),
    ['codon_pca.json', 'excluded.json']);
  // Tiers open in order: tier 2's small files are already in, so 3 and 4 follow.
  assert.ok(asked().indexOf('tss_evidence.json') > asked().indexOf('excluded.json'));
  assert.ok(asked().indexOf('regulatory_tss.json') > asked().indexOf('tss_evidence.json'));

  genes.push(genesBytes.slice(genesBytes.length - TIER_LEAD_BYTES + 1));
  genes.close();
  const dataset = await staged.core;
  await staged.settled;
  assert.equal(dataset.genes.length, 300);
  assert.equal(dataset.files.excluded.state, 'ready');
  // The first request of each tier comes no earlier than the tier before it.
  const firstAsk = [1, 2, 3, 4].map((tier) => asked().findIndex((name) => tierOf(name) === tier));
  assert.deepEqual([...firstAsk].sort((a, b) => a - b), firstAsk);
});

test('a retry is asked for at once, whatever tier it is in', async () => {
  const core = await coreRoutes();
  let attempts = 0;
  const bodies = { ...core, 'regulatory_tss.json': '{}' };
  const { fetchImpl, log } = memoryFetch({
    ...bodies,
    [DATA_MANIFEST_NAME]: manifestFor(bodies),
    'regulatory_tss.json': () => {
      attempts += 1;
      return new Response('', { status: 503 });
    },
  });
  const staged = loadDatasetStaged({ baseUrl: BASE, fetchImpl });
  await staged.settled;
  assert.equal(staged.files.regulatoryTss.state, 'failed');
  assert.equal(staged.retry('regulatoryTss'), true);
  await staged.when(['regulatoryTss']);
  assert.equal(attempts, 2);
  assert.equal(log.filter((entry) => entry.name === 'regulatory_tss.json').length, 2);
});

test('a stale copy of the same size is caught by its digest, not shown', async () => {
  // Two releases of a file can be the same length. Size alone would accept the
  // old one under the new key, and the cache would then keep answering with it.
  const core = await coreRoutes();
  const current = '[{"id":"a"}]';
  const stale = '[{"id":"b"}]';
  assert.equal(current.length, stale.length);
  const bodies = { ...core, 'excluded.json': current };
  const { fetchImpl, log } = memoryFetch({
    ...bodies,
    [DATA_MANIFEST_NAME]: manifestFor(bodies),
    'excluded.json': (url, init) => (init.cache === 'reload' ? current : stale),
  });
  const dataset = await loadDatasetStaged({ baseUrl: BASE, fetchImpl }).settled;
  const requests = log.filter((entry) => entry.name === 'excluded.json');
  assert.equal(requests.length, 2, 'the cached copy was rejected and the file re-read');
  assert.equal(requests[1].init.cache, 'reload');
  assert.deepEqual(dataset.excluded, [{ id: 'a' }]);
  // A copy that does match is read once.
  const clean = memoryFetch({ ...bodies, [DATA_MANIFEST_NAME]: manifestFor(bodies) });
  await loadDatasetStaged({ baseUrl: BASE, fetchImpl: clean.fetchImpl }).settled;
  assert.equal(clean.log.filter((entry) => entry.name === 'excluded.json').length, 1);
});

test('where the platform cannot hash, the size is still checked', async () => {
  const core = await coreRoutes();
  const bodies = { ...core, 'excluded.json': '[{"id":"a"}]' };
  const routes = (served) => ({
    ...bodies, [DATA_MANIFEST_NAME]: manifestFor(bodies),
    'excluded.json': (url, init) => (init.cache === 'reload' ? bodies['excluded.json'] : served),
  });
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
  try {
    // Same size, different content: undetectable without a digest, so it is read as served.
    const sameSize = memoryFetch(routes('[{"id":"b"}]'));
    const first = await loadDatasetStaged({ baseUrl: BASE, fetchImpl: sameSize.fetchImpl }).settled;
    assert.equal(sameSize.log.filter((entry) => entry.name === 'excluded.json').length, 1);
    assert.deepEqual(first.excluded, [{ id: 'b' }]);
    // A different size is still caught.
    const otherSize = memoryFetch(routes('[]'));
    const second = await loadDatasetStaged({ baseUrl: BASE, fetchImpl: otherSize.fetchImpl }).settled;
    assert.equal(otherSize.log.filter((entry) => entry.name === 'excluded.json').length, 2);
    assert.deepEqual(second.excluded, [{ id: 'a' }]);
  } finally {
    Object.defineProperty(globalThis, 'crypto', original);
  }
});

test('a file waits for a dependency that is being retried while it downloads', async () => {
  // The derived categories read the candidate evidence. If that file fails,
  // is retried, and is still on its way when the derived categories finish
  // downloading, validating at once would fail for want of data that is coming.
  let candidateAttempts = 0;
  const derivedHeld = gate();
  const retryHeld = gate();
  const { fetchImpl } = siteFetch({
    'candidate_evidence.json': async () => {
      candidateAttempts += 1;
      if (candidateAttempts === 1) return new Response('', { status: 502 });
      await retryHeld.promise;
      return undefined;
    },
    'source-derived-categories-v1.json': async () => {
      await derivedHeld.promise;
      return undefined;
    },
  });
  const staged = loadDatasetStaged({ baseUrl: BASE, fetchImpl });
  await staged.when(['candidateEvidence']);
  assert.equal(staged.files.candidateEvidence.state, 'failed');
  assert.equal(staged.files.sourceDerivedCategories.state, 'loading');
  assert.equal(staged.retry('candidateEvidence'), true);
  // The dependent finishes downloading while its dependency is still in flight.
  derivedHeld.open();
  await settleTurns();
  assert.equal(staged.files.sourceDerivedCategories.state, 'loading', 'it waits rather than failing');
  retryHeld.open();
  const dataset = await staged.settled;
  assert.equal(dataset.files.candidateEvidence.state, 'ready');
  assert.equal(dataset.files.sourceDerivedCategories.state, 'ready');
  assert.equal(dataset.files.sourceDerivedCategories.error, null);
  assert.ok(dataset.sourceDerivedCategories);
});

test('a server that keeps answering with the wrong bytes is a failure, never data', async () => {
  // The manifest reached this visitor before the data file did, and the server
  // goes on answering the new address with the old content. Accepting the
  // second answer would show bytes that cannot be tied to the published release.
  const core = await coreRoutes();
  const bodies = { ...core, 'codon_pca.json': '{"explainedVariance":[0.2,0.1]}' };
  const wrong = '{"explainedVariance":[0.9,0.8]}';
  assert.equal(wrong.length, bodies['codon_pca.json'].length);
  const routes = { ...bodies, [DATA_MANIFEST_NAME]: manifestFor(bodies), 'codon_pca.json': wrong };
  const { fetchImpl, log } = memoryFetch(routes);
  const staged = loadDatasetStaged({ baseUrl: BASE, fetchImpl });
  const dataset = await staged.settled;
  assert.equal(dataset.files.codonPca.state, 'failed');
  assert.equal(dataset.files.codonPca.error.message,
    `${BASE}codon_pca.json does not match the published data manifest; the site may be mid-update`);
  assert.equal(dataset.codonPca, null, 'the unverified content was not used');
  assert.equal(log.filter((entry) => entry.name === 'codon_pca.json').length, 2, 'asked twice, then stopped');
  // A retry is verified too, and recovers once the server has the right file.
  routes['codon_pca.json'] = bodies['codon_pca.json'];
  assert.equal(staged.retry('codonPca'), true);
  await staged.when(['codonPca']);
  assert.equal(dataset.files.codonPca.state, 'ready');
  assert.deepEqual(dataset.codonPca, { explainedVariance: [0.2, 0.1] });
  // The single-step loader does not turn it into an absent file either.
  await assert.rejects(
    loadDataset({ baseUrl: BASE, fetchImpl: memoryFetch({ ...routes, 'codon_pca.json': wrong }).fetchImpl }),
    /does not match the published data manifest/,
  );
});

test('a file the manifest lists is published, so a 404 for it is a failure', async () => {
  // Not found means not published only when nothing says otherwise. With the
  // shipped manifest, a 404 for the derived categories used to settle as
  // absent: 2,703 genes drew as unknown, nothing had failed, and an export was
  // allowed, all from one transient deployment fault.
  const missing = (name) => siteFetch({ [name]: new Response('', { status: 404 }) });
  const staged = loadDatasetStaged({
    baseUrl: BASE, fetchImpl: missing('source-derived-categories-v1.json').fetchImpl,
  });
  const dataset = await staged.settled;
  assert.equal(dataset.files.sourceDerivedCategories.state, 'failed');
  assert.match(dataset.files.sourceDerivedCategories.error.message,
    /source-derived-categories-v1\.json: HTTP 404/);
  assert.equal(dataset.sourceDerivedCategories, null);
  // Tier 1 is no exception: a listed reviewed-category table that is not served fails the load.
  const core = loadDatasetStaged({
    baseUrl: BASE, fetchImpl: missing('function-categories-v1.json').fetchImpl,
  });
  await assert.rejects(core.core, /function-categories-v1\.json: HTTP 404/);
  await core.settled;
  // The single-step loader keeps its leniency for an optional file it cannot fetch.
  const lenient = await loadDataset({ baseUrl: BASE, fetchImpl: missing('codon_pca.json').fetchImpl });
  assert.equal(lenient.codonPca, null);
  assert.equal(lenient.files.codonPca.state, 'absent');
});
