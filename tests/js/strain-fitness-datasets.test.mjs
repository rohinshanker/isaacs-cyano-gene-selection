import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { FILE_STATE } from '../../site/js/core/data-files.js';
import {
  FITNESS_IDLE, StrainFitnessDatasetLoader, resolveStrainFitnessSelection,
} from '../../site/js/core/strain-fitness-datasets.js';
import { DEFAULT_ORGANISM } from '../../site/js/core/organisms.js';
import { buildFixture } from '../fixtures/make_fixture.mjs';

const raw = () => JSON.parse(buildFixture({ genes: 40, strainFitness: true })
  .files['strain_fitness.json']);
const host = () => ({
  organism: DEFAULT_ORGANISM,
  meta: { genome: { accession: DEFAULT_ORGANISM.genome.accession } },
  genes: [{ id: 'gene-1' }],
});
const catalogue = Object.freeze([
  Object.freeze({ id: 'fit-a', label: 'Fitness A', file: 'a.json' }),
  Object.freeze({ id: 'fit-b', label: 'Fitness B', file: 'b.json' }),
]);

function manifestFor(name, body) {
  return { files: new Map([[name, {
    bytes: Buffer.byteLength(body),
    sha256: createHash('sha256').update(body).digest('hex'),
  }]]) };
}

test('zero, one, and multiple catalogues keep a deterministic local choice', () => {
  assert.equal(resolveStrainFitnessSelection([]).dataset, null);
  assert.equal(resolveStrainFitnessSelection([catalogue[0]]).dataset.id, 'fit-a');
  assert.equal(resolveStrainFitnessSelection(catalogue, { localId: 'fit-b' }).dataset.id, 'fit-b');
  assert.equal(resolveStrainFitnessSelection(catalogue, { localId: 'missing' }).dataset.id, 'fit-a');
});

test('only one separately typed shared choice overrides the local dataset', () => {
  const unrelated = resolveStrainFitnessSelection(catalogue, {
    localId: 'fit-b', selectedDatasetIds: ['gene-expression'],
  });
  assert.equal(unrelated.dataset.id, 'fit-b');
  assert.equal(unrelated.origin, 'local');
  assert.equal(unrelated.showLocalSelector, true);

  const external = resolveStrainFitnessSelection(catalogue, {
    localId: 'fit-b', selectedDatasetIds: ['fit-a'],
  });
  assert.equal(external.dataset.id, 'fit-a');
  assert.equal(external.origin, 'external');
  assert.deepEqual([...external.originIds], ['fit-a']);
  assert.equal(external.showLocalSelector, false);

  const ambiguous = resolveStrainFitnessSelection(catalogue, {
    localId: 'fit-b', selectedDatasetIds: ['fit-a', 'fit-b'],
  });
  assert.equal(ambiguous.dataset.id, 'fit-b');
  assert.equal(ambiguous.origin, 'local');
  assert.deepEqual([...ambiguous.ambiguousIds], ['fit-a', 'fit-b']);
  assert.equal(ambiguous.showLocalSelector, true);
});

test('datasets load independently, and a late response cannot replace the active dataset', async () => {
  const resolvers = new Map();
  const fetchImpl = (url) => new Promise((resolve) => resolvers.set(new URL(url).pathname, resolve));
  const changes = [];
  const dataset = host();
  const loader = new StrainFitnessDatasetLoader({
    catalogue, baseUrl: 'https://example.test/data/', dataset, fetchImpl,
    onChange: (id, record) => changes.push([id, record.state]),
  });
  assert.equal(loader.snapshot('fit-a').state, FITNESS_IDLE);
  loader.ensure('fit-a');
  loader.ensure('fit-b');
  await Promise.resolve();
  resolvers.get('/data/b.json')(new Response(JSON.stringify(raw()), { status: 200 }));
  await loader.when('fit-b');
  assert.equal(loader.snapshot('fit-b').state, FILE_STATE.READY);
  assert.equal(loader.snapshot('fit-a').state, FILE_STATE.LOADING);
  const active = loader.snapshot('fit-b').data;
  resolvers.get('/data/a.json')(new Response(JSON.stringify(raw()), { status: 200 }));
  await loader.when('fit-a');
  assert.equal(loader.snapshot('fit-a').state, FILE_STATE.READY);
  assert.equal(loader.snapshot('fit-b').data, active);
  assert.deepEqual(dataset.genes, [{ id: 'gene-1' }], 'whole-strain data never joins onto genes');
  assert.ok(changes.some(([id, state]) => id === 'fit-a' && state === FILE_STATE.LOADING));
});

test('failure is per dataset and retry replaces no other payload', async () => {
  let attempts = 0;
  const loader = new StrainFitnessDatasetLoader({
    catalogue, baseUrl: 'https://example.test/data/', dataset: host(),
    fetchImpl: async (url) => {
      if (new URL(url).pathname.endsWith('/a.json') && attempts++ === 0) {
        return new Response('broken', { status: 500 });
      }
      return new Response(JSON.stringify(raw()), { status: 200 });
    },
  });
  loader.ensure('fit-a');
  await loader.when('fit-a');
  assert.equal(loader.snapshot('fit-a').state, FILE_STATE.FAILED);
  assert.match(loader.snapshot('fit-a').error.message, /fit-a.*HTTP 500/);
  assert.equal(loader.snapshot('fit-b').state, FITNESS_IDLE);
  assert.equal(loader.retry('fit-a'), true);
  assert.equal(loader.snapshot('fit-a').data, null, 'retry never shows the failed attempt');
  await loader.when('fit-a');
  assert.equal(loader.snapshot('fit-a').state, FILE_STATE.READY);
  assert.equal(loader.snapshot('fit-b').state, FITNESS_IDLE);
});

test('a stale cached payload is reloaded once and only verified bytes are shown', async () => {
  const good = JSON.stringify(raw());
  const calls = [];
  const loader = new StrainFitnessDatasetLoader({
    catalogue: [catalogue[0]], baseUrl: 'https://example.test/data/', dataset: host(),
    manifest: manifestFor('a.json', good),
    fetchImpl: async (url, init) => {
      calls.push([url, init.cache]);
      return new Response(calls.length === 1 ? `${good} ` : good, { status: 200 });
    },
  });
  loader.ensure('fit-a');
  await loader.when('fit-a');
  assert.equal(loader.snapshot('fit-a').state, FILE_STATE.READY);
  assert.equal(calls.length, 2);
  assert.equal(calls[1][1], 'reload');
});

test('schema and rejected requests identify the actual catalogue file', async () => {
  const invalid = raw();
  invalid.schemaVersion = 2;
  const networkError = new TypeError('Failed to fetch');
  for (const fetchImpl of [
    async () => new Response(JSON.stringify(invalid), { status: 200 }),
    async () => { throw networkError; },
    async () => { throw 'offline'; },
  ]) {
    const loader = new StrainFitnessDatasetLoader({
      catalogue, baseUrl: 'https://example.test/data/', dataset: host(), fetchImpl,
    });
    loader.ensure('fit-a');
    await loader.when('fit-a');
    const { state, error } = loader.snapshot('fit-a');
    assert.equal(state, FILE_STATE.FAILED);
    assert.match(error.message, /^could not load strain fitness dataset fit-a \(a\.json\): /);
    assert.doesNotMatch(error.message, /strain_fitness\.json/);
    assert.match(error.message, /declares schema version 2|Failed to fetch|offline/);
    assert.ok(error.cause, 'the original failure remains available for diagnosis');
  }
});

test('persistent tampering and malformed verified JSON fail closed', async () => {
  const good = JSON.stringify(raw());
  const tampered = `${good} `;
  const loader = new StrainFitnessDatasetLoader({
    catalogue: [catalogue[0]], baseUrl: 'https://example.test/data/', dataset: host(),
    manifest: manifestFor('a.json', good),
    fetchImpl: async () => new Response(tampered, { status: 200 }),
  });
  loader.ensure('fit-a');
  await loader.when('fit-a');
  assert.equal(loader.snapshot('fit-a').state, FILE_STATE.FAILED);
  assert.match(loader.snapshot('fit-a').error.message, /does not match the published data manifest/);

  const malformed = '{not json';
  const invalid = new StrainFitnessDatasetLoader({
    catalogue: [catalogue[0]], baseUrl: 'https://example.test/data/', dataset: host(),
    manifest: manifestFor('a.json', malformed),
    fetchImpl: async () => new Response(malformed, { status: 200 }),
  });
  invalid.ensure('fit-a');
  await invalid.when('fit-a');
  assert.equal(invalid.snapshot('fit-a').state, FILE_STATE.FAILED);
  assert.match(invalid.snapshot('fit-a').error.message, /invalid JSON/);
});
