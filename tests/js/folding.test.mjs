import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { standardTable, standardAlphabet } from './helpers.mjs';
import { foldingSequences, foldingDatasetChecksum } from '../../site/js/core/folding-sequences.js';
import { loadFoldingEngine } from '../../site/js/core/folding-engine.js';
import { FoldingClient } from '../../site/js/core/folding-client.js';

const references = JSON.parse(await readFile(new URL('../fixtures/rna-folding.json', import.meta.url)));
const binary = await readFile(new URL('../../site/vendor/viennarna/vienna.wasm', import.meta.url));
const fetchBinary = async () => ({ ok: true, arrayBuffer: async () => binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength) });
const table = standardTable();
const gene = references.cases[0].gene;
const dataset = { table, genes: [gene], indexById: new Map([[gene.id, 0]]), meta: { codonAlphabet: standardAlphabet(), sourceChecksums: { genome: 'abc' } } };

test('exact WASM agrees with independent Python for both strands, circular boundaries, overlaps, splice and short CDS, three schemes', async () => {
  const fold = await loadFoldingEngine({ fetchImpl: fetchBinary });
  for (const sample of references.cases) {
    const windows = foldingSequences(sample.gene, table, sample.map);
    for (const [name, values] of Object.entries(windows)) {
      for (const key of ['wild', 'recoded']) {
        assert.equal(values[key], sample.windows[name][key]);
        assert.ok(Math.abs(fold(values[key]) - sample.windows[name][`${key}Mfe`]) < references.toleranceKcalMol);
      }
    }
    assert.equal(windows.first100.wild.slice(0, 3), 'GUG');
    assert.equal(windows.first100.recoded.slice(0, 3), 'GUG');
    if (sample.gene.id.includes('short')) {
      const expectedStop = (sample.map.TAG ?? 'TAG').replaceAll('T', 'U');
      assert.equal(windows.first100.recoded.slice(-3), expectedStop);
    }
  }
  for (const invalid of ['', 'ATG', 'A'.repeat(101), null]) assert.throws(() => fold(invalid), /RNA bases/);
});

test('reject missing or corrupted sequence contracts and non-synonymous schemes', () => {
  const check = (replacement, pattern) => assert.throws(() => foldingSequences(replacement, table, {}), pattern);
  check(undefined, /no coding/);
  check({ ...gene, codons: '🚀' }, /packed/);
  check({ ...gene, codons: table.symbols[table.indexOf('TAG')] }, /packed/);
  check({ ...gene, terminalStop: 'AAA' }, /terminal stop/);
  check({ ...gene, terminalStop: '?' }, /terminal stop/);
  check({ ...gene, rnaContext: null }, /context/);
  check({ ...gene, rnaContext: { upstream: 'N'.repeat(30) } }, /context/);
  check({ ...gene, rnaContext: { upstream: 'A' } }, /context/);
  check({ ...gene, codons: gene.codons.slice(0, 2) }, /context/);
  const special = references.cases.find((c) => c.gene.rnaContext.cdsOffsets).gene;
  check({ ...special, rnaContext: { sequence: 'A'.repeat(90) } }, /map/);
  for (const offset of [-2, 1.5, 10000]) {
    const context = structuredClone(special.rnaContext);
    context.cdsOffsets[0] = offset;
    check({ ...special, rnaContext: context }, /does not match/);
  }
  const context = structuredClone(special.rnaContext);
  context.sequence = 'A'.repeat(90);
  check({ ...special, rnaContext: context }, /does not match/);
  assert.throws(() => foldingSequences(gene, table, { TCG: 'AAA' }), /protein/);
});

test('content checksum changes when context, CDS or source changes', async () => {
  const original = await foldingDatasetChecksum(dataset);
  assert.match(original, /^[a-f0-9]{64}$/);
  assert.equal(original, await foldingDatasetChecksum(structuredClone(dataset)));
  for (const mutate of [(d) => { d.genes[0].rnaContext.upstream = 'A'.repeat(30); },
    (d) => { d.genes[0].codons += 'A'; }, (d) => { d.meta.sourceChecksums.genome = 'different'; }]) {
    const changed = structuredClone(dataset);
    mutate(changed);
    assert.notEqual(original, await foldingDatasetChecksum(changed));
  }
});

test('engine reports HTTP, offline, integrity, initialization, and numerical failures', async () => {
  await assert.rejects(loadFoldingEngine({ fetchImpl: async () => ({ ok: false, status: 404 }) }), /HTTP 404/);
  await assert.rejects(loadFoldingEngine({ fetchImpl: async () => { throw new Error('offline'); } }), /offline/);
  await assert.rejects(loadFoldingEngine({ fetchImpl: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }) }), /integrity/);
  await assert.rejects(loadFoldingEngine({ fetchImpl: fetchBinary, importEngine: async () => { throw new Error('blocked'); } }), /blocked/);
  const fold = await loadFoldingEngine({ fetchImpl: fetchBinary, importEngine: async () => ({ default: async () => ({ ccall: () => NaN }) }) });
  assert.throws(() => fold('ACGU'), /invalid energy/);
});

function fakeClient({ mode = 'success', timeoutMs = 50, checksum = async () => 'checksum', supported = () => true } = {}) {
  const workers = [];
  const factory = () => {
    if (mode === 'construct') throw new Error('cannot construct');
    const worker = { terminated: false, calls: 0,
      terminate() { this.terminated = true; },
      postMessage({ id }) {
        this.calls++;
        if (mode === 'post') throw new Error('cannot post');
        if (mode === 'pending') return;
        queueMicrotask(() => {
          if (mode === 'crash') this.onerror({ preventDefault() {} });
          else {
            this.onmessage({ data: { id: -1 } });
            this.onmessage({ data: mode === 'error' ? { id, error: 'bad gene' }
              : { id, result: { start: { delta: 1 } } } });
          }
        });
      } };
    workers.push(worker);
    return worker;
  };
  return { client: new FoldingClient({ workerFactory: factory, supported, checksum, timeoutMs }), workers };
}
const input = { dataset, ids: [gene.id], map: {} };

test('client progress, repeated cache hit, settings/scheme/dataset keys and partial failure', async () => {
  const { client, workers } = fakeClient({ checksum: foldingDatasetChecksum });
  const progress = [];
  const first = await client.run({ ...input, ids: ['missing', gene.id], onProgress: (p) => progress.push(p) });
  assert.equal(first.results[0].error, 'Gene has no coding sequence.');
  assert.equal(first.results[1].cached, false);
  assert.deepEqual(progress.map((p) => p.completed), [0, 1, 2]);
  const cached = await client.run(input);
  assert.equal(cached.results[0].cached, true);
  assert.equal(workers[0].calls, 1);
  await client.run({ ...input, map: { TAG: 'TAA' } });
  assert.equal(workers[0].calls, 2);
  const changedDataset = { ...dataset, meta: { ...dataset.meta, sourceChecksums: { genome: 'new' } } };
  await client.run({ ...input, dataset: changedDataset });
  assert.equal(workers[0].calls, 3);
  client.cancel();
  assert.equal(workers[0].terminated, true);
});

test('client cancellation before hashing and during work, duplicate request and retry', async () => {
  const { client, workers } = fakeClient({ mode: 'pending' });
  const early = client.run(input);
  client.cancel();
  assert.equal((await early).cancelled, true);
  const pending = client.run(input);
  await Promise.resolve();
  await assert.rejects(client.run(input), /already running/);
  client.cancel();
  const report = await pending;
  assert.equal(report.cancelled, true);
  assert.equal(report.results.length, 0);
  assert.equal(workers[0].terminated, true);
  assert.equal(client.running, false);
});

test('client unsupported, failed hashes, native errors, load crashes and timeouts settle', async () => {
  const unsupported = fakeClient({ supported: () => false }).client;
  await assert.rejects(unsupported.run(input), /WebAssembly/);
  const badHash = fakeClient({ checksum: async () => { throw new Error('hash failed'); } }).client;
  await assert.rejects(badHash.run(input), /hash failed/);
  assert.equal(badHash.running, false);
  for (const mode of ['error', 'crash', 'post', 'construct', 'pending']) {
    const { client } = fakeClient({ mode, timeoutMs: 5 });
    const report = await client.run(input);
    assert.equal(report.results.length, 1);
    assert.ok(report.results[0].error);
    assert.equal(client.running, false);
  }
});

test('bounded cache evicts its oldest completed entry', async () => {
  const { client } = fakeClient();
  for (let index = 0; index < 1000; index++) client.cache.set(`old-${index}`, {});
  await client.run(input);
  assert.equal(client.cache.size, 1000);
  assert.equal(client.cache.has('old-0'), false);
});

test('default browser support/factory and cancellation immediately after delivery', async () => {
  const oldWorker = globalThis.Worker;
  const oldWasm = globalThis.WebAssembly;
  const messages = [];
  try {
    globalThis.Worker = class {
      constructor(url, options) { messages.push([url.pathname, options.type]); }
      terminate() {}
      postMessage({ id }) { queueMicrotask(() => this.onmessage({ data: { id, result: {} } })); }
    };
    const client = new FoldingClient();
    const report = await client.run(input);
    assert.equal(report.results.length, 1);
    assert.match(messages[0][0], /folding-worker.js$/);
    assert.equal(messages[0][1], 'module');
    client.cancel();
    globalThis.WebAssembly = undefined;
    await assert.rejects(new FoldingClient().run(input), /requires WebAssembly/);
    globalThis.WebAssembly = oldWasm;
    globalThis.Worker = undefined;
    await assert.rejects(new FoldingClient().run(input), /requires WebAssembly/);
  } finally {
    globalThis.Worker = oldWorker;
    globalThis.WebAssembly = oldWasm;
  }
  const { client, workers } = fakeClient({ mode: 'pending' });
  const pending = client.run(input);
  await Promise.resolve();
  workers[0].onmessage({ data: { id: 1, result: {} } });
  client.cancel();
  assert.equal((await pending).results.length, 0);
});

test('worker dispatch computes both windows, reuses engine, and isolates bad requests', async () => {
  const originalFetch = globalThis.fetch;
  const originalSelf = globalThis.self;
  const messages = [];
  try {
    globalThis.fetch = fetchBinary;
    globalThis.self = { postMessage: (message) => messages.push(message) };
    await import('../../site/js/workers/folding-worker.js');
    const windows = foldingSequences(gene, table, {});
    await self.onmessage({ data: { id: 1, windows } });
    assert.equal(messages[0].result.start.delta, 0);
    await self.onmessage({ data: { id: 2, windows: foldingSequences(gene, table, { TCG: 'AGC' }) } });
    assert.ok(Number.isFinite(messages[1].result.first100.recodedMfe));
    await self.onmessage({ data: { id: 3, windows: { bad: { wild: 'invalid', recoded: 'ACGU' } } } });
    assert.match(messages[2].error, /RNA bases/);
    await self.onmessage({ data: { id: 4, windows } });
    assert.equal(messages[3].result.start.delta, 0);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.self = originalSelf;
  }
});
