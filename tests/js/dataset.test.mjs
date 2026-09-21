import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadDataset } from '../../site/js/core/dataset.js';
import { RECOMPUTATION_TOLERANCE } from '../../site/js/core/conventions.js';
import { fixtureDataset, fileFetch, FIXTURE_DIR } from './helpers.mjs';

test('the fixture loads and indexes into the shapes the site expects', async () => {
  const dataset = await fixtureDataset();
  assert.equal(dataset.genes.length, dataset.meta.geneCount);
  assert.equal(dataset.offsets.length, dataset.genes.length + 1);
  assert.equal(dataset.packed.length, dataset.offsets[dataset.genes.length]);
  assert.equal(dataset.counts.length, dataset.genes.length * 64);
  assert.equal(dataset.indexById.get(dataset.genes[7].id), 7);
  assert.equal(dataset.excluded.length, 3);
  assert.equal(dataset.provenance.loadedGeneCount, dataset.genes.length);
  assert.equal(dataset.provenance.excludedCount, 3);
});

test('per-gene codon counts match the packed sequence', async () => {
  const dataset = await fixtureDataset();
  for (const index of [0, 1, 42, dataset.genes.length - 1]) {
    const counts = dataset.counts.subarray(index * 64, index * 64 + 64);
    let total = 0;
    for (let i = 0; i < 64; i += 1) total += counts[i];
    assert.equal(total, dataset.genes[index].lengthCodons);
    const manual = new Uint32Array(64);
    for (let i = dataset.offsets[index]; i < dataset.offsets[index + 1]; i += 1) {
      manual[dataset.packed[i]] += 1;
    }
    assert.deepEqual([...counts], [...manual]);
  }
});

test('recomputed wild-type values agree with the published ones', async () => {
  const dataset = await fixtureDataset();
  for (const entry of dataset.provenance.agreement) {
    assert.ok(entry.compared > 250, `${entry.key} compared ${entry.compared} genes`);
    assert.ok(
      entry.worst < 1e-6,
      `${entry.key} differs by ${entry.worst} at worst, in ${entry.worstGene}`,
    );
  }
  assert.equal(dataset.baseline.recodedGc3[3].toFixed(9), dataset.genes[3].gc3.toFixed(9));
  assert.equal(dataset.baseline.recodedCai[3].toFixed(9), dataset.genes[3].cai.toFixed(9));
  assert.equal(dataset.baseline.recodedEnc[3].toFixed(9), dataset.genes[3].enc.toFixed(9));
  assert.equal(dataset.baseline.recodedTai[3].toFixed(9), dataset.genes[3].tai.toFixed(9));
});

test('every recomputation carries its own verdict, not a bare magnitude', async () => {
  const dataset = await fixtureDataset();
  for (const entry of dataset.provenance.agreement) {
    assert.equal(typeof entry.agrees, 'boolean', `${entry.key} has no verdict`);
    assert.equal(entry.tolerance, RECOMPUTATION_TOLERANCE);
    assert.equal(entry.agrees, entry.worst <= entry.tolerance);
    assert.ok(entry.agrees, `${entry.key} differs by ${entry.worst} at worst`);
  }
});

test('the published ENC family flag is reproduced for every gene', async () => {
  const dataset = await fixtureDataset();
  assert.equal(dataset.provenance.encFlagMismatches, 0);
  assert.ok(dataset.genes.some((gene) => gene.encHasSubstitutedFamilies === true),
    'the fixture must contain a gene that leaned on a class average');
  assert.ok(dataset.genes.some((gene) => gene.encHasSubstitutedFamilies === false));
});

test('tAI weights reproduce the substitution and zero-weight set meta publishes', async () => {
  const dataset = await fixtureDataset();
  const report = dataset.provenance.taiReport;
  assert.equal(report.substitutionAgrees, true);
  assert.equal(report.zeroWeightCodonsAgree, true);
  assert.deepEqual(report.zeroWeightCodons, dataset.meta.tai.zeroWeightCodons);
  // The modified wobble bases are the reason this cannot be derived by reverse
  // complement, so the fixture must exercise them.
  assert.ok(report.modifiedAnticodons.length > 0);
});

test('conventions come from meta.json, and any assumption is named', async () => {
  const dataset = await fixtureDataset();
  const report = dataset.provenance.conventionReport;
  const labels = report.fromMeta.map((entry) => entry.label);
  assert.ok(labels.includes('tAI excluded amino acids'));
  assert.ok(labels.includes('tAI zero-weight substitution'));
  assert.ok(labels.includes('CAI zero-count adjustment'));
  assert.equal(report.unknownExcludedAminoAcids.length, 0);
  for (const entry of report.fallbacks) {
    assert.ok(entry.label && entry.detail, 'an assumed convention must say what it assumed');
  }
});

test('a convention change in meta.json changes the numbers with no code edit', async () => {
  // Excluding tryptophan as well as methionine from tAI must move tAI, which is
  // what proves the exclusion list is read rather than compiled in.
  const base = await loadDataset({ baseUrl: `file://${FIXTURE_DIR}/`, fetchImpl: fileFetch() });
  const altered = await loadDataset({
    baseUrl: `file://${FIXTURE_DIR}/`,
    fetchImpl: async (url) => {
      const response = await fileFetch()(url);
      if (!url.endsWith('meta.json')) return response;
      const meta = await response.json();
      meta.tai.excludedAminoAcids = ['M', 'W'];
      return { ok: true, status: 200, json: async () => meta };
    },
  });
  assert.deepEqual(altered.conventions.tai.excludedAminoAcids, ['M', 'W']);
  const moved = altered.genes.some((gene, i) => altered.baseline.recodedTai[i]
    !== base.baseline.recodedTai[i]);
  assert.ok(moved, 'excluding another amino acid must change tAI');
});

test('the wild-type baseline is computed once and carries no target load', async () => {
  const dataset = await fixtureDataset();
  for (let i = 0; i < dataset.genes.length; i += 1) {
    assert.equal(dataset.baseline.targetCount[i], 0);
    assert.equal(dataset.baseline.dCai[i], 0);
  }
});

test('a missing optional file is tolerated but a missing required one is not', async () => {
  const fetchImpl = fileFetch();
  const partial = async (url) => (url.endsWith('codon_pca.json') || url.endsWith('excluded.json')
    ? { ok: false, status: 404, json: async () => null }
    : fetchImpl(url));
  const dataset = await loadDataset({ baseUrl: `file://${FIXTURE_DIR}/`, fetchImpl: partial });
  assert.equal(dataset.codonPca, null);
  assert.deepEqual(dataset.excluded, []);
  assert.equal(dataset.provenance.excludedCount, 0);

  await assert.rejects(
    loadDataset({ baseUrl: 'file:///nowhere/', fetchImpl }),
    /could not read/,
  );
});

test('the terminal stop is carried beside the packed sense codons', async () => {
  const dataset = await fixtureDataset();
  assert.equal(dataset.stopCodons.length, dataset.genes.length);
  const seen = new Set();
  for (let i = 0; i < dataset.genes.length; i += 1) {
    const index = dataset.stopCodons[i];
    assert.ok(index >= 0, `gene ${dataset.genes[i].id} has a stop`);
    assert.equal(dataset.table.isStop[index], 1);
    assert.equal(dataset.table.codons[index], dataset.genes[i].terminalStop);
    seen.add(dataset.genes[i].terminalStop);
  }
  assert.deepEqual([...seen].sort(), ['TAA', 'TAG', 'TGA']);
  assert.equal(dataset.provenance.genesWithoutTerminalStop, 0);
  // No stop codon appears inside the packed string, which is why it is carried apart.
  for (let i = 0; i < dataset.packed.length; i += 1) {
    assert.equal(dataset.table.isStop[dataset.packed[i]], 0);
  }
});

test('a terminalStop that is not a stop codon is rejected', async () => {
  const meta = JSON.parse(await readFile(`${FIXTURE_DIR}/meta.json`, 'utf8'));
  const genes = JSON.parse(await readFile(`${FIXTURE_DIR}/genes.json`, 'utf8'));
  genes[5].terminalStop = 'GCT';
  const fetchImpl = async (url) => ({
    ok: true,
    status: 200,
    json: async () => (url.endsWith('meta.json') ? meta : url.endsWith('genes.json') ? genes : null),
  });
  await assert.rejects(
    loadDataset({ baseUrl: 'file:///fixture/', fetchImpl }),
    /is not a stop codon/,
  );
});

test('a dataset without terminalStop still loads, and says how many genes lack it', async () => {
  const meta = JSON.parse(await readFile(`${FIXTURE_DIR}/meta.json`, 'utf8'));
  const genes = JSON.parse(await readFile(`${FIXTURE_DIR}/genes.json`, 'utf8'))
    .map((gene) => ({ ...gene, terminalStop: undefined }));
  const fetchImpl = async (url) => ({
    ok: true,
    status: 200,
    json: async () => (url.endsWith('meta.json') ? meta : url.endsWith('genes.json') ? genes : null),
  });
  const dataset = await loadDataset({ baseUrl: 'file:///fixture/', fetchImpl });
  assert.equal(dataset.provenance.genesWithoutTerminalStop, genes.length);
  assert.equal(dataset.stopCodons[0], -1);
});

test('a gene whose declared length disagrees with its packed string is rejected', async () => {
  const meta = JSON.parse(await readFile(`${FIXTURE_DIR}/meta.json`, 'utf8'));
  const genes = JSON.parse(await readFile(`${FIXTURE_DIR}/genes.json`, 'utf8'));
  genes[2].lengthCodons += 1;
  const fetchImpl = async (url) => ({
    ok: true,
    status: 200,
    json: async () => (url.endsWith('meta.json') ? meta : url.endsWith('genes.json') ? genes : null),
  });
  await assert.rejects(
    loadDataset({ baseUrl: 'file:///fixture/', fetchImpl }),
    /does not match/,
  );
});

test('an empty gene list is rejected rather than rendered as an empty page', async () => {
  const meta = JSON.parse(await readFile(`${FIXTURE_DIR}/meta.json`, 'utf8'));
  const fetchImpl = async (url) => ({
    ok: true,
    status: 200,
    json: async () => (url.endsWith('meta.json') ? meta : []),
  });
  await assert.rejects(loadDataset({ baseUrl: 'file:///fixture/', fetchImpl }), /empty/);
});

test('CAI weights fall back to genome-wide usage when the reference set is absent', async () => {
  const meta = JSON.parse(await readFile(`${FIXTURE_DIR}/meta.json`, 'utf8'));
  const genes = JSON.parse(await readFile(`${FIXTURE_DIR}/genes.json`, 'utf8'));
  meta.caiReferenceSet = { method: 'none', locusTags: [], n: 0 };
  const fetchImpl = async (url) => ({
    ok: url.endsWith('meta.json') || url.endsWith('genes.json'),
    status: 200,
    json: async () => (url.endsWith('meta.json') ? meta : genes),
  });
  const dataset = await loadDataset({ baseUrl: 'file:///fixture/', fetchImpl });
  assert.equal(dataset.provenance.caiReferenceFallback, true);
  assert.equal(dataset.provenance.caiReferenceGenes, 0);
});

test('TSS evidence is joined by exact locus and unknown genes get an empty list', async () => {
  const meta = JSON.parse(await readFile(`${FIXTURE_DIR}/meta.json`, 'utf8'));
  const genes = JSON.parse(await readFile(`${FIXTURE_DIR}/genes.json`, 'utf8'));
  meta.tssEvidenceSource = { id: 'TAN2018_TABLE_S1' };
  const tssRows = [{ id: 'gTSS+100', position: 100 }];
  const evidence = { [genes[0].id]: tssRows };
  const fetchImpl = async (url) => ({
    ok: ['meta.json', 'genes.json', 'tss_evidence.json'].some((name) => url.endsWith(name)),
    status: 200,
    json: async () => url.endsWith('meta.json') ? meta
      : url.endsWith('genes.json') ? genes : evidence,
  });
  const dataset = await loadDataset({ baseUrl: 'file:///fixture/', fetchImpl });
  assert.deepEqual(dataset.genes[0].tssEvidence, tssRows);
  assert.deepEqual(dataset.genes[1].tssEvidence, []);
});

test('declared TSS evidence must exist and have array rows', async () => {
  const meta = JSON.parse(await readFile(`${FIXTURE_DIR}/meta.json`, 'utf8'));
  const genes = JSON.parse(await readFile(`${FIXTURE_DIR}/genes.json`, 'utf8'));
  meta.tssEvidenceSource = { id: 'TAN2018_TABLE_S1' };
  const fetchImpl = async (url) => ({
    ok: !url.endsWith('tss_evidence.json'),
    status: 404,
    json: async () => url.endsWith('meta.json') ? meta : genes,
  });
  await assert.rejects(
    loadDataset({ baseUrl: 'file:///fixture/', fetchImpl }),
    /tss_evidence.json is required/,
  );
  const malformed = async (url) => ({
    ok: ['meta.json', 'genes.json', 'tss_evidence.json'].some((name) => url.endsWith(name)),
    status: 200,
    json: async () => url.endsWith('meta.json') ? meta
      : url.endsWith('genes.json') ? genes : { [genes[0].id]: 'not an array' },
  });
  await assert.rejects(
    loadDataset({ baseUrl: 'file:///fixture/', fetchImpl: malformed }),
    /invalid rows/,
  );
  const arrayPayload = async (url) => ({
    ok: ['meta.json', 'genes.json', 'tss_evidence.json'].some((name) => url.endsWith(name)),
    status: 200,
    json: async () => url.endsWith('meta.json') ? meta
      : url.endsWith('genes.json') ? genes : [],
  });
  await assert.rejects(
    loadDataset({ baseUrl: 'file:///fixture/', fetchImpl: arrayPayload }),
    /tss_evidence.json is required/,
  );
});
