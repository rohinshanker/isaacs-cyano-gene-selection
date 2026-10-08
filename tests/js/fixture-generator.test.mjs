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
import { repliconTracks } from '../../site/js/core/chromosome-model.js';
import { DEFAULT_ORGANISM } from '../../site/js/core/organisms.js';
import {
  ECOLI, FIXTURE_DIR, ecoliAnnotatedFixtureFiles, ecoliFixtureFiles,
} from './helpers.mjs';

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
    ['codon_pca.json', 'codon_rscu.json', 'excluded.json', 'genes.json', 'meta.json']);
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

/**
 * The default fixture's files by SHA-256 of their exact bytes, first pinned at
 * `c56f1a8`, the commit this organism's work started from.
 *
 * Pinned, not regenerated: comparing the generator with its own current output
 * — whether in memory or through `tests/fixtures/data/`, which `pretest` has
 * just rewritten with this same generator — can only ever agree with itself,
 * and so cannot show that the cyanobacterial fixture is unchanged. These
 * digests are taken outside the generator, from a commit's own tree:
 *
 *     git archive <commit> | tar -x -C <scratch>
 *     cd <scratch> && node tests/fixtures/make_fixture.mjs --out <scratch>/out
 *     shasum -a 256 <scratch>/out/*
 *
 * Re-run that to re-establish them after an intended change to the default
 * fixture, and say in the commit why the bytes moved. The digests must be the
 * same on every platform: the first CI run after the organism merge showed the
 * mean codon-pair score differing in its last bit between arm64 and x64, so
 * the generator rounds it; a new float field needs the same care, checked by
 * generating once under linux/amd64 (for example in a node:24 container).
 *
 * Re-established when the per-gene RSCU vectors moved out of `genes.json` into
 * `codon_rscu.json`: `genes.json` lost the field and the new file carries the
 * same values under the same 1e-4 rounding, so no float is computed differently
 * and `codon_pca.json`, `excluded.json` and `meta.json` keep their digests.
 */
const BASELINE_DIGESTS = Object.freeze({
  'codon_pca.json': '3c552a2acbcb4a6b77bafd35ad03e93150d684430b16957482ab0c6f01e6d6c4',
  'codon_rscu.json': '3686732493ee239daa1cd53f3fe401ecf231cb542229490396027295cc997158',
  'excluded.json': 'f5812402efd22d2b1fcb41f0c131271ce1a93fff07e3980bbbcd02e4bf0c9cd5',
  'genes.json': 'bc7766127077e37c63250775cf06a45dcc7160e4bda9dfc6f3b32c94191ff493',
  'meta.json': '2b90d84dc5c9e2c327924140d6fd5644d5bf779396fb9dad7e18f279ae8e824a',
});

/** The SHA-256 of a fixture file's exact bytes. */
function digestOf(text) {
  return createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

test('the default fixture is the one the generator has always written', async () => {
  const fixture = buildFixture();
  assert.deepEqual(fixture.options, {
    genes: 300, seed: 20260918, expression: false, annotations: false, strainFitness: false,
    organism: 'utex2973',
  });
  assert.deepEqual(Object.keys(fixture.files).sort(),
    ['codon_pca.json', 'codon_rscu.json', 'excluded.json', 'genes.json', 'meta.json'],
    'and no manifest');
  // The RSCU vectors are published and keyed to the gene order, and no gene
  // record carries one: the browser reads only meta.rscuOrder.
  const codonRscu = JSON.parse(fixture.files['codon_rscu.json']);
  assert.equal(codonRscu.schemaVersion, 1);
  assert.deepEqual(codonRscu.geneIds,
    JSON.parse(fixture.files['genes.json']).map((gene) => gene.id));
  assert.equal(codonRscu.rscu.length, codonRscu.geneIds.length);
  const columns = JSON.parse(fixture.files['meta.json']).rscuOrder.length;
  assert.ok(codonRscu.rscu.every((vector) => vector.length === columns
    && vector.every((value) => Number.isFinite(value) && value >= 0)));
  assert.ok(JSON.parse(fixture.files['genes.json']).every((gene) => !('rscu' in gene)));
  // Byte for byte what the generator wrote at the baseline commit, above.
  for (const [name, text] of Object.entries(fixture.files)) {
    assert.equal(digestOf(text), BASELINE_DIGESTS[name], name);
  }
  assert.deepEqual(Object.keys(fixture.files).sort(), Object.keys(BASELINE_DIGESTS).sort());
  // And what `npm run generate:test-fixtures` put on disk for the rendered checks.
  for (const [name, text] of Object.entries(fixture.files)) {
    assert.equal(text, await readFile(`${FIXTURE_DIR}/${name}`, 'utf8'), name);
  }
  const genes = JSON.parse(fixture.files['genes.json']);
  assert.equal(genes[0].id, 'M744_RS00005');
  assert.equal(JSON.parse(fixture.files['meta.json']).genome.accession, 'GCF_000817325.1');
});

test('the expression variant is the one the generator has always written', () => {
  // The second default fixture `pretest` writes, pinned the same way: the
  // commands above with `--with-expression --out <scratch>/out-expression`.
  assert.deepEqual(
    Object.fromEntries(Object.entries(buildFixture({ expression: true }).files)
      .map(([name, text]) => [name, digestOf(text)])),
    {
      'codon_pca.json': '3c552a2acbcb4a6b77bafd35ad03e93150d684430b16957482ab0c6f01e6d6c4',
      'codon_rscu.json': '3686732493ee239daa1cd53f3fe401ecf231cb542229490396027295cc997158',
      'excluded.json': 'f5812402efd22d2b1fcb41f0c131271ce1a93fff07e3980bbbcd02e4bf0c9cd5',
      'genes.json': '3588fd5c2d87fba6a095bb021f1e8ca6660c15c39bb86a6cedd9c9668dd82d20',
      'meta.json': '96aa042183920957383d7eb95d23382ce34bd31a25f66768ece0d39e9899356b',
    },
  );
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

// --- Coordinates stay on the replicon, at the size the release really is ------

/** Every gene the fixture places, and the replicon lengths it placed them on. */
function placed(options, organism) {
  const files = buildFixture(options).files;
  const genes = JSON.parse(files['genes.json']);
  const lengths = new Map(organism.genome.replicons
    .map((replicon) => [replicon.accession, replicon.lengthBp]));
  return { files, genes, lengths, meta: JSON.parse(files['meta.json']) };
}

/** The genes that fall outside the replicon they name, by any of their pieces. */
function outOfBounds(genes, lengths) {
  return genes.filter((gene) => {
    const pieces = gene.cdsSegments?.length ? gene.cdsSegments : [[gene.start, gene.end]];
    const limit = lengths.get(gene.seqid);
    return limit === undefined
      || pieces.some(([from, to]) => from < 1 || to > limit || to < from);
  });
}

test('the E. coli fixture fits its chromosome at the size the release really is', () => {
  // 4,287 genes is the published gene count of the real dataset. Before the
  // generator bounded its layout, 309 of them ran past 4,641,652 bp and the
  // chromosome view correctly refused the fixture, so no integration check at a
  // realistic size was possible.
  const { genes, lengths, meta } = placed({ organism: ECOLI.id, genes: 4287 }, ECOLI);
  assert.equal(genes.length, 4287);
  assert.deepEqual(outOfBounds(genes, lengths).map((gene) => gene.id), []);
  const last = Math.max(...genes.map((gene) => gene.end));
  assert.ok(last <= 4641652, `the last gene ends at ${last}`);
  // Bounded, not crushed: the genes still fill most of the chromosome, so the
  // fixture exercises a realistic density rather than a packed prefix.
  assert.ok(last > 4641652 * 0.9, `the layout keeps its shape: ends at ${last}`);
  assert.ok(genes.every((gene, index) => index === 0
    || gene.seqid !== genes[index - 1].seqid || gene.start > genes[index - 1].start),
  'genes still advance along the replicon');

  // And the render model takes it: this is what the chromosome view draws from.
  const { tracks, problems, verified, plottedCount } = repliconTracks(genes, meta, ECOLI.genome);
  assert.deepEqual(problems, []);
  assert.equal(verified, true);
  assert.equal(plottedCount, 4287);
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].cdsCount, 4287);
  assert.equal(tracks[0].lengthBp, 4641652);
  // Every mark is inside the axis it is drawn on, which is what refused before.
  for (const mark of tracks[0].marks) {
    for (const piece of mark.pieces) {
      assert.ok(piece.from >= 1 && piece.to <= 4641652, `${mark.id ?? mark.index}`);
    }
  }
});

test('every organism\'s fixture stays on its replicons, at every size', () => {
  for (const [organism, sizes] of [
    [DEFAULT_ORGANISM, [1, 300, 2715]],
    [ECOLI, [1, 120, 4287]],
  ]) {
    for (const genes of sizes) {
      const where = `${organism.id} at ${genes} genes`;
      const fixture = placed({ organism: organism.id, genes }, organism);
      assert.equal(fixture.genes.length, genes, where);
      assert.deepEqual(outOfBounds(fixture.genes, fixture.lengths).map((gene) => gene.id), [], where);
      const { problems, verified } = repliconTracks(
        fixture.genes, fixture.meta, organism.genome,
      );
      assert.deepEqual(problems, [], where);
      assert.equal(verified, true, where);
    }
  }
});

test('a gene count no spacing could fit is refused, not written out of bounds', () => {
  // Past about 4,500 genes the coding sequence alone outgrows this chromosome,
  // and no scaling of the gaps can recover that: it is an impossible request,
  // and a fixture nothing could draw is better refused than written.
  assert.throws(() => buildFixture({ organism: ECOLI.id, genes: 6000 }),
    /6000 genes do not fit on NC_000913\.3 \(4641652 bp\) at any spacing: \d+ bp of coding/);
  // The cyanobacterial profile has three replicons and restarts its layout
  // whenever the draw moves between them, so its runs stay short by design;
  // that is existing behaviour and is what keeps its fixtures small.
  assert.ok(buildFixture({ genes: 2715 }).files['genes.json']);
});

test('the annotated E. coli variant publishes exactly the two files its release adds', () => {
  const plain = ecoliFixtureFiles();
  const files = ecoliAnnotatedFixtureFiles();
  assert.deepEqual(Object.keys(files).sort(), ['annotations.json', 'codon_pca.json',
    'codon_rscu.json', 'data-manifest.json', 'excluded.json', 'genes.json',
    'go-term-names-v1.json', 'meta.json']);
  // Only the annotation layer differs: the same genes, the same codon space.
  for (const name of ['genes.json', 'codon_pca.json', 'codon_rscu.json', 'excluded.json']) {
    assert.equal(files[name], plain[name], name);
  }
  // And the manifest really describes what is there, so the loader asks for both.
  const manifest = JSON.parse(files['data-manifest.json']);
  assert.ok(normalizeManifest(manifest));
  assert.deepEqual(Object.keys(manifest.files).sort(),
    Object.keys(files).filter((name) => name !== 'data-manifest.json').sort());
  for (const [name, entry] of Object.entries(manifest.files)) {
    const bytes = Buffer.from(files[name], 'utf8');
    assert.equal(entry.bytes, bytes.byteLength, name);
    assert.equal(entry.sha256, createHash('sha256').update(bytes).digest('hex'), name);
  }

  // Every gene has an evidence record, and every GO id used has a name: the two
  // things the loader's appliers refuse a release for.
  const genes = JSON.parse(files['genes.json']);
  const annotations = JSON.parse(files['annotations.json']);
  const { terms } = JSON.parse(files['go-term-names-v1.json']);
  assert.deepEqual(Object.keys(annotations).sort(), genes.map((gene) => gene.id).sort());
  const used = new Set(Object.values(annotations)
    .flatMap((record) => record.goAnnotations.map((relation) => relation.goId)));
  assert.ok(used.size > 1);
  for (const goId of used) assert.ok(terms[goId]?.name, goId);
  assert.deepEqual(Object.keys(terms).sort(), [...used].sort(),
    'no name is published for an id nothing uses');
  assert.ok(Object.values(terms).some((term) => term.isObsolete), 'one obsolete id, on purpose');

  // An overlap it reports is an overlap the coordinates really have.
  const byId = new Map(genes.map((gene) => [gene.id, gene]));
  for (const [id, record] of Object.entries(annotations)) {
    for (const overlap of record.overlappingCds) {
      const other = byId.get(overlap.locusTag);
      assert.ok(other && other.end >= byId.get(id).start, `${id} over ${overlap.locusTag}`);
    }
  }

  // Declaring the release and publishing the file are one decision.
  const meta = JSON.parse(files['meta.json']);
  assert.equal(meta.annotationRelease.releaseId, 'GCF_000005845.2-RS_2026_05_13');
  assert.ok(!('annotationRelease' in JSON.parse(plain['meta.json'])));

  // And no cyanobacterial provenance has come in with the new layer.
  const forbidden = /UTEX|Synechococcus|elongatus|PCC|GSE205444|M744|NZ_CP|GCF_000817325|1350461|cyano|photosystem|phycobili|carboxysome|\bTan\b/i;
  for (const name of ['annotations.json', 'go-term-names-v1.json', 'meta.json']) {
    const hit = forbidden.exec(files[name]);
    assert.equal(hit, null, hit ? `${name}: ${files[name].slice(Math.max(0, hit.index - 40), hit.index + 40)}` : '');
  }

  assert.throws(() => buildFixture({ annotations: true }),
    /utex2973 has no annotation layer, so --with-annotations does not apply/);
});
