/**
 * The export must be reproducible: every live metric recomputable from the row,
 * and two schemes distinguishable without reading the filename.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDataset } from '../../site/js/core/dataset.js';
import { computeLiveMetrics } from '../../site/js/core/live-metrics.js';
import { compileScheme } from '../../site/js/core/scheme.js';
import { buildMetricRegistry } from '../../site/js/core/metric-registry.js';
import {
  buildExport, parseCsv, schemeIdOf, canonicalJson, fnv1a64, recodedSequence,
  WILD_TYPE_SCHEME_ID, MANIFEST_VERSION,
} from '../../site/js/core/export-manifest.js';
import { fileFetch } from './helpers.mjs';

const SYN61 = { TCG: 'AGC', TCA: 'AGT', TAG: 'TAA' };
const AMBER = { TAG: 'TAA' };

let cached = null;
/** The expression fixture, which carries basis, proxy, spliced genes and exceptions. */
async function context() {
  if (cached) return cached;
  const dataset = await loadDataset({
    baseUrl: new URL('../fixtures/data-expression/', import.meta.url).href,
    fetchImpl: fileFetch(),
  });
  const live = computeLiveMetrics(dataset, compileScheme({}, dataset.table)).fields;
  const registry = buildMetricRegistry(dataset.meta, dataset.genes, live);
  cached = { dataset, registry };
  return cached;
}

function exportFor(dataset, registry, ids, schemes, generatedAt = new Date('2026-09-18T20:00:00Z')) {
  return buildExport({ dataset, registry, ids, schemes, generatedAt });
}

test('a scheme identifier is stable under reordering and names the wild type', () => {
  assert.equal(schemeIdOf({}), WILD_TYPE_SCHEME_ID);
  assert.equal(schemeIdOf({ TCG: 'AGC', TAG: 'TAA' }), schemeIdOf({ TAG: 'TAA', TCG: 'AGC' }));
  assert.notEqual(schemeIdOf(SYN61), schemeIdOf(AMBER));
});

test('canonical JSON and the digest ignore key order but not content', () => {
  assert.equal(canonicalJson({ b: 1, a: [2, { d: 4, c: 3 }] }), canonicalJson({ a: [2, { c: 3, d: 4 }], b: 1 }));
  assert.notEqual(fnv1a64('a'), fnv1a64('b'));
  assert.match(fnv1a64('a'), /^[0-9a-f]{16}$/);
});

test('every live metric in a row is reproducible from the manifest and the row', async () => {
  const { dataset, registry } = await context();
  const ids = dataset.genes.slice(0, 12).map((gene) => gene.id);
  const result = exportFor(dataset, registry, ids, [{ name: 'Syn61-style', map: SYN61 }]);
  const { rows } = parseCsv(result.csv);
  assert.equal(rows.length, ids.length);

  // Recompute from the manifest's scheme map alone, as a reader would.
  const [scheme] = result.manifest.schemes;
  const recomputed = computeLiveMetrics(
    dataset, compileScheme(scheme.map, dataset.table), { baseline: dataset.baseline },
  ).fields;
  const live = registry.metrics.filter((metric) => metric.source === 'live');
  assert.ok(live.length > 0);
  for (const row of rows) {
    const index = dataset.indexById.get(row.id);
    for (const metric of live) {
      const expected = recomputed[metric.key][index];
      if (!Number.isFinite(expected)) {
        assert.equal(row[metric.key], '', `${row.id} ${metric.key} should be blank`);
        continue;
      }
      assert.ok(
        Math.abs(Number(row[metric.key]) - expected) < 1e-12,
        `${row.id} ${metric.key}: ${row[metric.key]} against ${expected}`,
      );
    }
  }
});

test('the exported sequences reconstruct the recoding, start and stop included', async () => {
  const { dataset, registry } = await context();
  const ids = dataset.genes.slice(0, 6).map((gene) => gene.id);
  const result = exportFor(dataset, registry, ids, [{ name: 'Syn61-style', map: SYN61 }]);
  const { rows } = parseCsv(result.csv);
  const compiled = compileScheme(SYN61, dataset.table);
  for (const row of rows) {
    const index = dataset.indexById.get(row.id);
    const sequence = recodedSequence(dataset, index, compiled);
    assert.equal(row.wildTypeCds, sequence.wildType);
    assert.equal(row.recodedCds, sequence.recoded);
    assert.equal(row.wildTypeCds.length, Number(row.lengthNt));
    // Position zero is never recoded, whatever the triplet is.
    assert.equal(row.recodedCds.slice(0, 3), row.wildTypeCds.slice(0, 3));
    assert.equal(row.startCodon, row.wildTypeCds.slice(0, 3));
    // Amber reassignment must show in the stop column, not vanish.
    assert.equal(row.recodedTerminalStop, row.terminalStop === 'TAG' ? 'TAA' : row.terminalStop);
  }
});

test('two schemes over one shortlist stay distinguishable inside the file', async () => {
  const { dataset, registry } = await context();
  const ids = dataset.genes.slice(0, 5).map((gene) => gene.id);
  const result = exportFor(dataset, registry, ids, [
    { name: 'Syn61-style', map: SYN61 },
    { name: 'Amber only', map: AMBER },
  ]);
  const { rows } = parseCsv(result.csv);
  assert.equal(rows.length, ids.length * 2, 'one row per gene and scheme');
  const schemeIds = new Set(rows.map((row) => row.schemeId));
  assert.equal(schemeIds.size, 2);
  assert.ok(schemeIds.has(schemeIdOf(SYN61)));
  assert.ok(schemeIds.has(schemeIdOf(AMBER)));
  // The burden differs between schemes, and the row says which produced it.
  const [gene] = ids;
  const syn = rows.find((row) => row.id === gene && row.schemeId === schemeIdOf(SYN61));
  const amber = rows.find((row) => row.id === gene && row.schemeId === schemeIdOf(AMBER));
  assert.notEqual(syn.targetCount, amber.targetCount);
  assert.equal(syn.manifestId, amber.manifestId);
  assert.equal(result.manifest.schemes.length, 2);
  assert.deepEqual(result.manifest.schemes.map((entry) => entry.name), ['Syn61-style', 'Amber only']);
});

test('two exports under different schemes carry different manifest identifiers', async () => {
  const { dataset, registry } = await context();
  const ids = dataset.genes.slice(0, 4).map((gene) => gene.id);
  const at = new Date('2026-09-18T20:00:00Z');
  const syn = exportFor(dataset, registry, ids, [{ name: 'Syn61-style', map: SYN61 }], at);
  const amber = exportFor(dataset, registry, ids, [{ name: 'Amber only', map: AMBER }], at);
  assert.notEqual(syn.manifest.manifestId, amber.manifest.manifestId);
  assert.notEqual(syn.manifest.contentDigest, amber.manifest.contentDigest);
  assert.notEqual(syn.baseName, amber.baseName);
  // The same input twice is reproducible, so a digest change means a content change.
  const again = exportFor(dataset, registry, ids, [{ name: 'Syn61-style', map: SYN61 }], at);
  assert.equal(syn.manifest.manifestId, again.manifest.manifestId);
});

test('an unnamed scheme still exports with a usable identifier and filename', async () => {
  const { dataset, registry } = await context();
  const ids = [dataset.genes[0].id];
  const result = exportFor(dataset, registry, ids, [{ name: '', map: AMBER }]);
  const { rows } = parseCsv(result.csv);
  assert.equal(rows[0].schemeName, '');
  assert.equal(rows[0].schemeId, schemeIdOf(AMBER));
  assert.match(result.baseName, /TAG-TAA/);
  assert.ok(!result.baseName.includes('/'));
});

test('an export with no scheme is labelled wild type rather than left blank', async () => {
  const { dataset, registry } = await context();
  const result = exportFor(dataset, registry, [dataset.genes[0].id], [{ name: '', map: {} }]);
  const { rows } = parseCsv(result.csv);
  assert.equal(rows[0].schemeId, WILD_TYPE_SCHEME_ID);
  assert.equal(Number(rows[0].targetCount), 0);
});

test('filenames are collision-resistant across schemes and times', async () => {
  const { dataset, registry } = await context();
  const ids = [dataset.genes[0].id];
  const first = exportFor(dataset, registry, ids, [{ name: 'Syn61-style', map: SYN61 }], new Date('2026-09-18T20:00:00Z'));
  const later = exportFor(dataset, registry, ids, [{ name: 'Syn61-style', map: SYN61 }], new Date('2026-09-18T20:00:01Z'));
  assert.notEqual(first.baseName, later.baseName);
  assert.match(first.baseName, /^recoding-candidates_Syn61-style_20260918T200000Z_[0-9a-f]{10}$/);
  assert.deepEqual(first.files.map((file) => file.name), [
    `${first.baseName}.csv`, `${first.baseName}.manifest.json`,
  ]);
});

test('commas, quotes, and newlines in gene text survive the round trip', async () => {
  const { dataset, registry } = await context();
  const index = 0;
  const gene = dataset.genes[index];
  const original = gene.product;
  gene.product = 'kinase, "regulatory"\nsubunit';
  try {
    const result = exportFor(dataset, registry, [gene.id], [{ name: 'a,b"c', map: AMBER }]);
    const { rows } = parseCsv(result.csv);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].product, 'kinase, "regulatory"\nsubunit');
    assert.equal(rows[0].schemeName, 'a,b"c');
  } finally {
    gene.product = original;
  }
});

test('terminal stops, non-ATG starts, spliced CDSs and exceptions all export', async () => {
  const { dataset, registry } = await context();
  const ids = dataset.genes.map((gene) => gene.id);
  const result = exportFor(dataset, registry, ids, [{ name: 'Amber only', map: AMBER }]);
  const { rows } = parseCsv(result.csv);

  const stops = new Set(rows.map((row) => row.terminalStop));
  for (const stop of ['TAG', 'TAA', 'TGA']) assert.ok(stops.has(stop), `no gene ends ${stop}`);

  const starts = new Set(rows.map((row) => row.startCodon));
  assert.ok([...starts].some((codon) => codon !== 'ATG'), 'no non-ATG start exercised');

  const spliced = rows.filter((row) => Number(row.cdsSegmentCount) > 1);
  assert.ok(spliced.length > 0);
  assert.match(spliced[0].cdsSegments, /^\[\[/);

  const flagged = rows.filter((row) => row.translationalException !== '');
  assert.ok(flagged.length > 0);
  assert.equal(flagged[0].translationalException, 'ribosomal_slippage');

  // Amber touches only TAG-terminated genes, and the stop-edit column proves it.
  for (const row of rows) {
    assert.equal(Number(row.targetStopEdit), row.terminalStop === 'TAG' ? 1 : 0);
  }
});

test('every row carries its expression basis, and a proxy is never a measurement', async () => {
  const { dataset, registry } = await context();
  const ids = dataset.genes.map((gene) => gene.id);
  const result = exportFor(dataset, registry, ids, [{ name: '', map: {} }]);
  const { rows } = parseCsv(result.csv);
  const bases = new Set(rows.map((row) => row.expressionBasis));
  assert.ok(bases.has('measured'));
  assert.ok(bases.has('proxy'), 'the fixture must include a proxy-only gene');
  assert.ok(bases.has('none'), 'the fixture must include a gene with neither');
  for (const row of rows) {
    if (row.expressionBasis === 'measured') {
      assert.notEqual(row.expression, '');
      assert.notEqual(row.expressionSourceId, '');
    } else {
      // A gene without a measurement exports an empty expression cell, never the proxy.
      assert.equal(row.expression, '', `${row.id} exported a value without a measured basis`);
      assert.equal(row.expressionSourceId, '');
    }
  }
});

test('a missing metric exports as an empty cell, never as zero', async () => {
  const { dataset, registry } = await context();
  const withoutMfe = dataset.genes.find((gene) => gene.mfeStart === null);
  assert.ok(withoutMfe, 'the fixture must include a gene with no folding energy');
  const result = exportFor(dataset, registry, [withoutMfe.id], [{ name: '', map: {} }]);
  const { rows } = parseCsv(result.csv);
  assert.equal(rows[0].mfeStart, '');
  assert.notEqual(rows[0].mfeStart, '0');
});

test('the manifest carries dataset identity, checksums, definitions, and caveats', async () => {
  const { dataset, registry } = await context();
  const result = exportFor(dataset, registry, [dataset.genes[0].id], [{ name: 'Syn61-style', map: SYN61 }]);
  const manifest = result.manifest;
  assert.equal(manifest.manifestVersion, MANIFEST_VERSION);
  assert.match(manifest.manifestId, /^[0-9a-f]{16}$/);
  assert.equal(manifest.dataset.genome.accession, dataset.meta.genome.accession);
  assert.ok(Object.keys(manifest.dataset.sourceChecksums).length > 0);
  assert.equal(manifest.dataset.builtAt, dataset.meta.builtAt);
  // An unpublished annotation release is recorded as an explicit unknown.
  assert.ok(Object.hasOwn(manifest.dataset, 'annotationRelease'));
  assert.equal(manifest.metrics.length, registry.metrics.length);
  for (const entry of manifest.metrics) {
    assert.ok(entry.label && entry.key);
    assert.ok(Object.hasOwn(entry, 'unit'));
    assert.ok(Object.hasOwn(entry, 'scale'));
  }
  assert.ok(manifest.caveats.some((line) => /never recoded/.test(line)));
  assert.ok(manifest.caveats.some((line) => /never zero/.test(line)));
  assert.ok(manifest.caveats.some((line) => /proxy/.test(line)));
  assert.equal(manifest.expressionSource.accession, dataset.meta.expressionSource.accession);
  assert.equal(manifest.genes[0].id, dataset.genes[0].id);
  assert.deepEqual(manifest.columns.slice(0, 3), ['manifestId', 'schemeId', 'schemeName']);
  assert.equal(manifest.rowCount, 1);
});

test('the CSV parser handles the shapes the writer can emit', () => {
  const { header, rows } = parseCsv('a,b\n1,"x,y"\n2,"he said ""hi"""\n3,"line\nbreak"\n');
  assert.deepEqual(header, ['a', 'b']);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].b, 'x,y');
  assert.equal(rows[1].b, 'he said "hi"');
  assert.equal(rows[2].b, 'line\nbreak');
});
