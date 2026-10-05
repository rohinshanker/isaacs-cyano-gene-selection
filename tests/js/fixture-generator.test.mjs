/**
 * The fixture generator writes one fixture per organism.
 *
 * The second organism's fixture is what every isolation test runs on, so its
 * own shape is checked here: an independent locus namespace, one replicon, its
 * own genome of record, a manifest that omits the optional layers on purpose,
 * and no trace of the default organism.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { buildFixture } from '../fixtures/make_fixture.mjs';
import { DATA_FILES, normalizeManifest } from '../../site/js/core/data-files.js';
import { ECOLI, FIXTURE_DIR, ecoliFixtureFiles } from './helpers.mjs';

test('the second organism\'s fixture is E. coli K-12 MG1655 in every identifier', () => {
  const files = ecoliFixtureFiles();
  const meta = JSON.parse(files['meta.json']);
  const genes = JSON.parse(files['genes.json']);
  assert.deepEqual(meta.genome, { accession: 'GCF_000005845.2', taxid: 511145, totalLength: 4641652 });
  assert.equal(meta.genome.accession, ECOLI.genome.accession);
  assert.equal(meta.geneCount, 120);
  assert.equal(genes.length, 120);
  assert.deepEqual(genes.slice(0, 3).map((gene) => gene.id), ['b0001', 'b0002', 'b0003']);
  assert.ok(genes.every((gene) => /^b\d{4}$/.test(gene.id)));
  assert.equal(new Set(genes.map((gene) => gene.id)).size, genes.length);
  assert.deepEqual([...new Set(genes.map((gene) => gene.seqid))], ['NC_000913.3']);
  assert.ok(genes.every((gene) => gene.start >= 1 && gene.end <= 4641652));
  assert.ok(meta.caiReferenceSet.locusTags.every((tag) => /^b\d{4}$/.test(tag)));
  assert.ok(JSON.parse(files['excluded.json']).every((entry) => /^b\d{4}$/.test(entry.id)));
});

test('its manifest lists exactly what it publishes, so every optional layer is absent', () => {
  const files = ecoliFixtureFiles();
  const manifest = JSON.parse(files['data-manifest.json']);
  assert.ok(normalizeManifest(manifest), 'a manifest the loader accepts');
  assert.deepEqual(Object.keys(manifest.files).sort(),
    ['codon_pca.json', 'excluded.json', 'genes.json', 'meta.json']);
  for (const [name, entry] of Object.entries(manifest.files)) {
    const bytes = Buffer.from(files[name], 'utf8');
    assert.equal(entry.bytes, bytes.byteLength, name);
    assert.equal(entry.sha256, createHash('sha256').update(bytes).digest('hex'), name);
  }
  const optional = DATA_FILES.filter((file) => !file.required).map((file) => file.name);
  for (const name of ['function-categories-v1.json', 'annotations.json', 'candidate_evidence.json',
    'source-derived-categories-v1.json', 'length_cohorts.json', 'tss_evidence.json',
    'go-iea-essentiality-v1.json', 'go-term-names-v1.json', 'regulatory_tss.json']) {
    assert.ok(optional.includes(name));
    assert.ok(!(name in manifest.files), `${name} is intentionally not published`);
    assert.ok(!(name in files));
  }
  // No measured layer is declared either: the release is sequence and annotation only.
  const meta = JSON.parse(files['meta.json']);
  for (const key of ['expressionSource', 'expressionSources', 'tssEvidenceSource',
    'annotationRelease']) {
    assert.ok(!(key in meta), key);
  }
  assert.ok(!('expression' in meta.metrics));
  assert.ok(!('tssInitiation' in meta.metrics));
});

test('nothing in it carries cyanobacterial provenance', () => {
  const files = ecoliFixtureFiles();
  const forbidden = /UTEX|Synechococcus|elongatus|PCC|GSE205444|M744|NZ_CP|GCF_000817325|1350461|cyano|photosystem|phycobili|carboxysome|rubisco|ribulose|circadian|\bTan\b/i;
  const genes = JSON.parse(files['genes.json']);
  // The packed codon string is an alphabet of its own; everything else is prose or identifiers.
  const readable = genes.map(({ codons: _codons, ...rest }) => rest);
  for (const text of [files['meta.json'], files['excluded.json'], files['codon_pca.json'],
    files['data-manifest.json'], JSON.stringify(readable)]) {
    const hit = forbidden.exec(text);
    assert.equal(hit, null, hit ? text.slice(Math.max(0, hit.index - 40), hit.index + 40) : '');
  }
});

test('the default fixture is the one the generator has always written', async () => {
  const fixture = buildFixture();
  assert.deepEqual(fixture.options, {
    genes: 300, seed: 20260918, expression: false, organism: 'utex2973',
  });
  assert.deepEqual(Object.keys(fixture.files).sort(),
    ['codon_pca.json', 'excluded.json', 'genes.json', 'meta.json'], 'and no manifest');
  // Byte for byte what `npm run generate:test-fixtures` wrote to disk.
  for (const [name, text] of Object.entries(fixture.files)) {
    assert.equal(text, await readFile(`${FIXTURE_DIR}/${name}`, 'utf8'), name);
  }
  const genes = JSON.parse(fixture.files['genes.json']);
  assert.equal(genes[0].id, 'M744_RS00005');
  assert.equal(JSON.parse(fixture.files['meta.json']).genome.accession, 'GCF_000817325.1');
});

test('the generator is deterministic, and refuses what an organism does not have', () => {
  assert.deepEqual(buildFixture({ organism: 'ecoli-k12-mg1655', genes: 120 }).files,
    ecoliFixtureFiles());
  assert.notDeepEqual(buildFixture({ organism: 'ecoli-k12-mg1655', genes: 120, seed: 7 }).files,
    ecoliFixtureFiles());
  assert.ok('expressionSource' in JSON.parse(
    buildFixture({ genes: 60, expression: true }).files['meta.json'],
  ));
  assert.throws(() => buildFixture({ organism: 'ecoli-k12-mg1655', expression: true }),
    /ecoli-k12-mg1655 has no expression layer/);
  assert.throws(() => buildFixture({ organism: 'yeast' }), /unknown organism yeast/);
  assert.throws(() => buildFixture({ organism: 'constructor' }), /unknown organism constructor/);
  assert.throws(() => buildFixture({ genes: 0 }), /--genes must be a positive integer/);
  assert.throws(() => buildFixture({ genes: 1.5 }), /--genes must be a positive integer/);
});
