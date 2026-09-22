/**
 * The export must be reproducible: every live metric recomputable from the row,
 * and two schemes distinguishable without reading the filename.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLiveMetrics } from '../../site/js/core/live-metrics.js';
import { compileScheme } from '../../site/js/core/scheme.js';
import { buildMetricRegistry } from '../../site/js/core/metric-registry.js';
import { loadDataset } from '../../site/js/core/dataset.js';
import { toggleCategorySelection, passesCategoryFilter } from '../../site/js/core/function-categories.js';
import {
  decodeState, applyDecoded, defaultState, viewStateOf,
} from '../../site/js/core/url-state.js';
import {
  buildExport, parseCsv, schemeIdOf, canonicalJson, fnv1a64, recodedSequence,
  WILD_TYPE_SCHEME_ID, MANIFEST_VERSION,
} from '../../site/js/core/export-manifest.js';
import { expressionFixtureDataset, fileFetch } from './helpers.mjs';

const SYN61 = { TCG: 'AGC', TCA: 'AGT', TAG: 'TAA' };
const AMBER = { TAG: 'TAA' };

let cached = null;
/** The expression fixture, which carries basis, proxy, spliced genes and exceptions. */
async function context() {
  if (cached) return cached;
  const dataset = await expressionFixtureDataset();
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

test('exports preserve the current cohort filter and each shortlisted row pass state', async () => {
  const { dataset, registry } = await context();
  const ids = dataset.genes.slice(0, 2).map((gene) => gene.id);
  const mask = new Uint8Array(dataset.genes.length);
  mask[0] = 1;
  const filterState = {
    ranges: { lengthNt: { min: 201, max: 2001, includeMissing: true } },
    categoryFilter: ['photosynthetic-light-reactions', 'unknown-or-unclassified'],
    proteinEvidence: 'refseq',
  };
  const result = buildExport({
    dataset, registry, ids, schemes: [{ map: {} }],
    filterState, filterMask: mask,
  });
  assert.deepEqual(result.manifest.filterState, filterState);
  assert.deepEqual(result.rows.map((row) => row.passesCurrentFilters), ['true', 'false']);
});

test('category-filtered exports wire through the real reducer and dataset join, not a hand-'
  + 'authored mask', async () => {
  // The previous test hand-types `categoryFilter` and `mask` as literals. This one derives
  // both the same way app.js's `toggleCategoryFilter` and `computeMask` do: the real
  // production category join, the real `toggleCategorySelection` reducer, and the real
  // `passesCategoryFilter` predicate, so drift in any of those three would fail this test.
  const dataset = await loadDataset({
    baseUrl: new URL('../../site/data/', import.meta.url).href, fetchImpl: fileFetch(),
  });
  const live = computeLiveMetrics(dataset, compileScheme({}, dataset.table)).fields;
  const registry = buildMetricRegistry(dataset.meta, dataset.genes, live);

  // Signaling and circadian regulation is a lab-reviewed category; this locus is
  // one of its 13 reviewed rows (tests/js/function-categories.test.mjs).
  const inCategoryId = 'M744_RS10050';
  const outOfCategoryId = 'M744_RS00005';
  let categoryFilter = [];
  categoryFilter = toggleCategorySelection(categoryFilter, 'signaling-and-circadian-regulation');

  const categories = dataset.functionCategories;
  const mask = new Uint8Array(dataset.genes.length);
  for (let i = 0; i < dataset.genes.length; i += 1) {
    mask[i] = passesCategoryFilter(categories, i, categoryFilter) ? 1 : 0;
  }

  const result = buildExport({
    dataset, registry, ids: [inCategoryId, outOfCategoryId], schemes: [{ map: {} }],
    filterState: { categoryFilter }, filterMask: mask,
    generatedAt: new Date('2026-09-22T00:00:00Z'),
  });
  assert.deepEqual(result.manifest.filterState.categoryFilter, categoryFilter);
  assert.deepEqual(result.rows.map((row) => row.passesCurrentFilters), ['true', 'false']);
});

test('an export records the displayed metric axes without changing the CSV values', async () => {
  const { dataset, registry } = await context();
  const id = dataset.genes[0].id;
  const viewState = {
    panel: 'axes', colorBy: 'gc3', axisX: 'lengthNt', axisY: 'cai', categoryFilter: [],
  };
  const result = buildExport({ dataset, registry, ids: [id], schemes: [{ map: {} }], viewState });
  assert.deepEqual(result.manifest.viewState, viewState);
  assert.equal(result.rows[0].lengthNt, dataset.genes[0].lengthNt);
  // Deprioritized as a default, never dropped: a chosen CAI axis, both values,
  // and both definitions still leave the page in the export.
  assert.equal(result.rows[0].cai, dataset.genes[0].cai);
  assert.equal(result.rows[0].tai, dataset.genes[0].tai);
  for (const key of ['cai', 'tai']) {
    assert.ok(result.manifest.metrics.some((entry) => entry.key === key), key);
  }
});

test('an export records nondefault axis scales beside the axis keys, so a file cannot be mistaken for a linear plot', async () => {
  const { dataset, registry } = await context();
  const id = dataset.genes[0].id;
  const viewState = {
    panel: 'axes', colorBy: 'gc3', axisX: 'lengthNt', axisY: 'tssInitiation',
    axisXScale: 'log10', axisYScale: 'percentile', categoryFilter: [],
  };
  const result = buildExport({ dataset, registry, ids: [id], schemes: [{ map: {} }], viewState });
  assert.deepEqual(result.manifest.viewState, viewState);
  assert.equal(result.manifest.viewState.axisXScale, 'log10');
  assert.equal(result.manifest.viewState.axisYScale, 'percentile');
  // The scale is metadata about the plot, not the metric: the raw numeric
  // value in the CSV is untouched by how the axis was displayed.
  assert.equal(result.rows[0].lengthNt, dataset.genes[0].lengthNt);
});

test('an axis-scale export wires through the real URL-state decode and app viewState builder, '
  + 'not a hand-authored viewState object', async () => {
  // The previous test hand-types `viewState` as a literal, so app.js forgetting to carry
  // axisXScale/axisYScale into its own viewState() builder would not fail it. This one decodes
  // a real shared-link hash with the production decoder and builds `viewState` with the same
  // `viewStateOf` function app.js calls, so an app wiring omission in either place fails here.
  const { dataset, registry } = await context();
  const id = dataset.genes[0].id;
  const decoded = decodeState('ver=3&p=axes&ax=lengthNt&ay=tssInitiation&xs=log10&ys=percentile');
  const state = applyDecoded(defaultState(), decoded);
  assert.equal(state.axisXScale, 'log10');
  assert.equal(state.axisYScale, 'percentile');

  const viewState = viewStateOf(state);
  const result = buildExport({ dataset, registry, ids: [id], schemes: [{ map: {} }], viewState });
  assert.equal(result.manifest.viewState.axisXScale, 'log10');
  assert.equal(result.manifest.viewState.axisYScale, 'percentile');
  assert.equal(result.manifest.viewState.axisX, 'lengthNt');
  assert.equal(result.manifest.viewState.axisY, 'tssInitiation');
});

test('single, multiple, and unreviewed categories survive CSV and manifest export', async () => {
  const { dataset: original, registry } = await context();
  const [reviewed, multiple, unreviewed] = original.genes.slice(0, 3).map((gene) => gene.id);
  const assignment = { locusTag: reviewed, categoryIds: ['photosynthetic-light-reactions'],
    classificationBasis: 'explicit-user-review' };
  const multipleAssignment = { locusTag: multiple,
    categoryIds: ['photosynthetic-light-reactions', 'carbon-and-nutrient-metabolism'],
    classificationBasis: 'explicit-user-review' };
  const categoryData = {
    datasetVersion: 'function-categories-v1', provenance: { userReview: { date: '2030-01-01' } },
    policy: { assignmentMethod: 'explicit-user-review-only' },
    vocabulary: {
      categories: [
        { id: 'photosynthetic-light-reactions', label: 'Photosynthetic light reactions' },
        { id: 'carbon-and-nutrient-metabolism', label: 'Carbon and nutrient metabolism' },
      ],
      multipleFunctionsBucket: { id: 'multiple-functions', label: 'Multiple functions' },
    },
    coverage: { reviewedRows: 2 },
  };
  const dataset = { ...original, functionCategories: {
    source: categoryData, assignmentsById: new Map([
      [reviewed, assignment], [multiple, multipleAssignment],
    ]),
  } };
  const filterMask = new Uint8Array(original.genes.length).fill(1);
  filterMask[original.indexById.get(reviewed)] = 0;
  filterMask[original.indexById.get(unreviewed)] = 0;
  const result = buildExport({ dataset, registry, ids: [reviewed, multiple, unreviewed],
    schemes: [{ map: {} }], viewState: { colorBy: 'functionCategory' }, filterMask });
  assert.deepEqual(result.rows.map((row) => row.functionCategory),
    ['Photosynthetic light reactions', 'Multiple functions', 'Unknown or unclassified']);
  assert.deepEqual(result.rows.map((row) => row.functionReviewStatus),
    ['reviewed', 'reviewed', 'unreviewed']);
  assert.deepEqual(result.rows.map((row) => row.passesCurrentFilters),
    ['false', 'true', 'false']);
  assert.deepEqual(result.rows.map((row) => row.reviewedFunctionCategories),
    ['Photosynthetic light reactions',
      'Photosynthetic light reactions; Carbon and nutrient metabolism', '']);
  assert.equal(result.manifest.genes[0].reviewedFunctionAssignment.locusTag, reviewed);
  assert.equal(result.manifest.genes[2].reviewedFunctionAssignment, null);
  assert.deepEqual(result.manifest.genes.map((gene) => gene.functionCategory),
    ['Photosynthetic light reactions', 'Multiple functions', 'Unknown or unclassified']);
  assert.deepEqual(result.manifest.genes[0].reviewedFunctionCategories,
    ['Photosynthetic light reactions']);
  assert.deepEqual(result.manifest.genes[1].reviewedFunctionCategories,
    ['Photosynthetic light reactions', 'Carbon and nutrient metabolism']);
  assert.equal(result.manifest.dataset.functionCategories.datasetVersion, 'function-categories-v1');
  assert.equal(result.manifest.viewState.colorBy, 'functionCategory');
  assert.match(result.manifest.caveats.join(' '), /2 exact UTEX 2973 locus decisions/);
  assert.match(result.manifest.caveats.join(' '), /2030-01-01/);
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
    assert.ok(entry.method && entry.origin && entry.coverage);
    assert.ok(entry.citationIds.length > 0);
  }
  assert.match(manifest.metrics.find((entry) => entry.key === 'cai').method, /71-locus/);
  assert.ok(manifest.caveats.some((line) => /never recoded/.test(line)));
  assert.ok(manifest.caveats.some((line) => /never zero/.test(line)));
  assert.ok(manifest.caveats.some((line) => /proxy/.test(line)));
  assert.equal(manifest.expressionSource.accession, dataset.meta.expressionSource.accession);
  assert.equal(manifest.genes[0].id, dataset.genes[0].id);
  assert.deepEqual(manifest.columns.slice(0, 3), ['manifestId', 'schemeId', 'schemeName']);
  assert.equal(manifest.rowCount, 1);
});

test('the manifest selects exact trRosettaRNA fields and applies provenance defaults', async () => {
  const { dataset, registry } = await context();
  const handoffs = [
    { locus: dataset.genes[0].id, form: 'wild-type', region: 'range_0_14',
      formats: ['sequence'], sequenceHash: 'a'.repeat(64), ignored: 'not exported' },
    { locus: dataset.genes[0].id, form: 'recoded', schemeName: 'Syn61',
      region: 'start_-30_59', formats: ['ct'], sequenceHash: 'b'.repeat(64),
      viennaRnaVersion: '2.7.2', ignored: 'not exported' },
  ];
  const result = buildExport({ dataset, registry, ids: [dataset.genes[0].id],
    schemes: [{ name: 'Syn61', map: SYN61 }], trRosettaRnaHandoffs: handoffs });
  assert.deepEqual(result.manifest.trRosettaRnaHandoffs, [
    { locus: dataset.genes[0].id, form: 'wild-type', schemeName: null,
      region: 'range_0_14', formats: ['sequence'], sequenceHash: 'a'.repeat(64),
      viennaRnaVersion: null },
    { locus: dataset.genes[0].id, form: 'recoded', schemeName: 'Syn61',
      region: 'start_-30_59', formats: ['ct'], sequenceHash: 'b'.repeat(64),
      viennaRnaVersion: '2.7.2' },
  ]);
});

test('a Tan TSS source is pinned in the export without calling it gene abundance', async () => {
  const { dataset, registry } = await context();
  const tssEvidenceSource = {
    id: 'TAN2018_TABLE_S1', derivedTableSha256: 'abc', replicatesPerCondition: 2,
    isGeneBodyAbundance: false,
  };
  const augmented = {
    ...dataset,
    meta: { ...dataset.meta, tssEvidenceSource },
  };
  const result = exportFor(augmented, registry, [dataset.genes[0].id], [{ map: {} }]);
  assert.deepEqual(result.manifest.dataset.tssEvidenceSource, tssEvidenceSource);
  assert.ok(result.manifest.caveats.some((line) => /two biological cultures/.test(line)));
  assert.ok(result.manifest.caveats.some((line) => /not whole-gene RNA abundance/.test(line)));
});

test('UTEX allele and borrowed PCC call retain separate provenance in CSV and manifest', async () => {
  const { dataset, registry } = await context();
  const id = dataset.genes[0].id;
  const unknownId = dataset.genes[1].id;
  const candidateEvidence = {
    manifestSha256: 'abc',
    testedSource: { id: 'ungerer-2018', condition: 'source condition' },
    testedAlleles: { [id]: { evidenceId: 'tested-allele', claim: 'Specific UTEX allele' } },
    borrowedEssentiality: {
      status: 'available', source: { adomakoDoi: '10.1128/mbio.00862-22',
        rubinDoi: '10.1073/pnas.1519220112' },
      summary: { exactJoined: 1 },
      byLocus: { [id]: { status: 'essential', pccLocusTag: 'SYNPCC7942_RS00005',
        mappingStatus: 'accepted' },
      [unknownId]: { status: 'unknown', pccLocusTag: null,
        mappingStatus: 'unmatched', mappingReason: 'No exact join' } },
    },
  };
  const result = exportFor({ ...dataset, candidateEvidence }, registry,
    [id, unknownId], [{ map: {} }]);
  assert.equal(result.manifest.genes[0].testedAllele.evidenceId, 'tested-allele');
  assert.deepEqual(result.manifest.dataset.candidateEvidence.testedSource,
    candidateEvidence.testedSource);
  assert.equal(result.rows[0].pcc7942Essentiality, 'essential');
  assert.equal(result.rows[0].pcc7942LocusTag, 'SYNPCC7942_RS00005');
  assert.equal(result.manifest.genes[0].pcc7942Essentiality.status, 'essential');
  assert.equal(result.rows[1].pcc7942Essentiality, 'unknown');
  assert.equal(result.rows[1].pcc7942LocusTag, '');
  assert.equal(result.manifest.genes[1].pcc7942Essentiality.status, 'unknown');
  assert.equal(result.manifest.dataset.candidateEvidence.borrowedEssentiality.byLocus, undefined);
  assert.match(result.manifest.caveats.join(' '), /cross-strain assumption/);
});

test('evidence tier, GO IEA context, and discrepancies survive CSV and manifest export', async () => {
  const { dataset, registry } = await context();
  const [fallbackId, plainId] = dataset.genes.slice(0, 2).map((gene) => gene.id);
  const note = 'GO IEA terms disagree with the UTEX 2973 RefSeq product \u201cx\u201d.';
  const goIeaEssentiality = {
    datasetVersion: 'go-iea-essentiality-v1',
    attribution: { creator: 'Gene Ontology Consortium', license: 'CC BY 4.0' },
    judgment: { model: 'jev-1.13.0', rubricVersion: '2026-09-22.1' },
    policy: { precedence: ['tested-utex-allele', 'admitted-pcc-call', 'go-iea-context', 'unknown'] },
    counts: { byTier: { 'go-iea-context': 1 } },
    byLocus: {
      [fallbackId]: {
        tier: 'go-iea-context', pcc7942Status: 'unknown',
        goContext: { label: 'core-cellular-process', pCore: 0.97 },
        discrepancies: [
          { kind: 'utex-product', probability: 0.9, note },
          { kind: 'pcc7942-call', probability: null, note: 'second note' },
        ],
      },
      [plainId]: { tier: 'unknown', pcc7942Status: 'unknown', goContext: null, discrepancies: [] },
    },
  };
  const result = exportFor({ ...dataset, goIeaEssentiality }, registry,
    [fallbackId, plainId], [{ map: {} }]);
  const { rows } = parseCsv(result.csv);
  assert.equal(rows[0].essentialityEvidenceTier, 'go-iea-context');
  assert.equal(rows[0].goIeaEssentialityContext, 'core-cellular-process');
  assert.equal(rows[0].goIeaCoreProcessProbability, '0.97');
  assert.equal(rows[0].annotationDiscrepancies, `${note} | second note`);
  assert.equal(rows[1].essentialityEvidenceTier, 'unknown');
  assert.equal(rows[1].goIeaEssentialityContext, '');
  assert.equal(rows[1].annotationDiscrepancies, '');
  assert.equal(result.manifest.genes[0].essentialityEvidence.discrepancies.length, 2);
  assert.equal(result.manifest.dataset.goIeaEssentiality.attribution.license, 'CC BY 4.0');
  assert.equal(result.manifest.dataset.goIeaEssentiality.byLocus, undefined);
  const caveats = result.manifest.caveats.join(' ');
  assert.match(caveats, /tested UTEX allele > PCC 7942 call > GO IEA context > unknown/);
  assert.match(caveats, /not a knockout result/);
  assert.match(caveats, /never enters the panel objective/);
  assert.match(caveats, /Gene Ontology Consortium, CC BY 4.0/);

  const without = exportFor(dataset, registry, [fallbackId], [{ map: {} }]);
  assert.equal(without.rows[0].essentialityEvidenceTier, '');
  assert.equal(without.rows[0].goIeaCoreProcessProbability, '');
  assert.equal(without.manifest.genes[0].essentialityEvidence, null);
  assert.equal(without.manifest.dataset.goIeaEssentiality, null);
});

test('a single-source export leaves the GO IEA tier, context, probability, discrepancies, and '
  + 'gene-detail essentiality blank; All sources keeps them', async () => {
  const { dataset, registry } = await context();
  const { dataset: scoped, coveredId } = sourceScopedFixture(dataset);
  const note = 'GO IEA terms disagree with the UTEX 2973 RefSeq product.';
  const goIeaEssentiality = {
    datasetVersion: 'go-iea-essentiality-v1',
    attribution: { creator: 'Gene Ontology Consortium', license: 'CC BY 4.0' },
    judgment: { model: 'jev-1.13.0', rubricVersion: '2026-09-22.1' },
    policy: { precedence: ['tested-utex-allele', 'admitted-pcc-call', 'go-iea-context', 'unknown'] },
    counts: { byTier: { 'go-iea-context': 1 } },
    byLocus: {
      [coveredId]: {
        tier: 'go-iea-context', pcc7942Status: 'unknown',
        goContext: { label: 'core-cellular-process', pCore: 0.97 },
        discrepancies: [{ kind: 'utex-product', probability: 0.9, note }],
      },
    },
  };
  const withEvidence = { ...scoped, goIeaEssentiality };

  const allResult = buildExport({
    dataset: withEvidence, registry, ids: [coveredId], schemes: [{ map: {} }],
    generatedAt: new Date('2026-09-18T20:00:00Z'), annotationSource: 'all',
  });
  assert.equal(allResult.rows[0].essentialityEvidenceTier, 'go-iea-context');
  assert.equal(allResult.rows[0].goIeaEssentialityContext, 'core-cellular-process');
  assert.equal(allResult.rows[0].goIeaCoreProcessProbability, 0.97);
  assert.equal(allResult.rows[0].annotationDiscrepancies, note);
  assert.equal(allResult.manifest.genes[0].essentialityEvidence.tier, 'go-iea-context');

  for (const annotationSource of ['utex-2973', 'pcc-7942', 'go-iea']) {
    const result = buildExport({
      dataset: withEvidence, registry, ids: [coveredId], schemes: [{ map: {} }],
      generatedAt: new Date('2026-09-18T20:00:00Z'), annotationSource,
    });
    assert.equal(result.rows[0].essentialityEvidenceTier, '', annotationSource);
    assert.equal(result.rows[0].goIeaEssentialityContext, '', annotationSource);
    assert.equal(result.rows[0].goIeaCoreProcessProbability, '', annotationSource);
    assert.equal(result.rows[0].annotationDiscrepancies, '', annotationSource);
    assert.equal(result.manifest.genes[0].essentialityEvidence, null, annotationSource);
  }
});

test('GO relationships export as evidence-coded suggestions with pinned names', async () => {
  const { dataset, registry } = await context();
  const id = dataset.genes[0].id;
  const gene = { ...dataset.genes[0], annotationEvidence: {
    goAnnotations: [{ goId: 'GO:0009522', evidenceCode: 'IEA', qualifier: 'enables' }],
  } };
  const genes = [gene, ...dataset.genes.slice(1)];
  const goTerms = {
    source: { ontology: { releaseDate: '2026-05-19' } },
    terms: { 'GO:0009522': { name: 'photosystem I', isObsolete: false } },
  };
  const result = exportFor({ ...dataset, genes, goTerms }, registry, [id], [{ map: {} }]);
  assert.deepEqual(result.manifest.dataset.goTermNames, goTerms.source);
  assert.equal(result.manifest.genes[0].goAnnotations[0].name, 'photosystem I');
  assert.equal(result.manifest.genes[0].goAnnotations[0].evidenceCode, 'IEA');
  assert.ok(result.manifest.caveats.some((line) => /IEA computational suggestions/.test(line)));
});

function sourceScopedFixture(dataset) {
  const coveredId = dataset.genes[0].id;
  const uncoveredId = dataset.genes[1].id;
  const genes = dataset.genes.map((gene, index) => (index === 0
    ? { ...gene, name: 'thrA', reviewedFunctionLabels: ['Stress and repair'],
      annotationEvidence: { goAnnotations: [{ goId: 'GO:0009522', evidenceCode: 'IEA', qualifier: 'enables' }] } }
    : gene));
  const functionCategories = {
    assignmentsById: new Map([[coveredId, { categoryIds: ['stress-and-repair'] }]]),
    source: { vocabulary: {
      categories: [{ id: 'stress-and-repair', label: 'Stress and repair' }],
      multipleFunctionsBucket: { id: 'multiple-functions', label: 'Multiple functions' },
    }, coverage: { reviewedRows: 1 }, provenance: { userReview: { date: '2026-09-22' } } },
  };
  const candidateEvidence = {
    testedAlleles: {},
    borrowedEssentiality: {
      status: 'available',
      source: { adomakoDoi: '10.1128/mbio.00862-22', rubinDoi: '10.1073/pnas.1519220112' },
      byLocus: {
        [coveredId]: { status: 'essential', pccLocusTag: 'SYNPCC7942_RS00005', mappingStatus: 'accepted' },
        [uncoveredId]: { status: 'unknown', pccLocusTag: null, mappingStatus: 'unmatched' },
      },
    },
  };
  const goTerms = {
    source: { ontology: { releaseDate: '2026-05-19' } },
    terms: { 'GO:0009522': { name: 'photosystem I', isObsolete: false } },
  };
  return {
    dataset: { ...dataset, genes, functionCategories, candidateEvidence, goTerms },
    coveredId, uncoveredId,
  };
}

test('all sources is unaffected by the new parameter: identical with or without it', async () => {
  const { dataset, registry } = await context();
  const { dataset: scoped, coveredId } = sourceScopedFixture(dataset);
  const withDefault = exportFor(scoped, registry, [coveredId], [{ map: {} }]);
  const withExplicitAll = buildExport({
    dataset: scoped, registry, ids: [coveredId], schemes: [{ map: {} }],
    generatedAt: new Date('2026-09-18T20:00:00Z'), annotationSource: 'all',
  });
  assert.equal(withDefault.manifest.manifestId, withExplicitAll.manifest.manifestId);
  assert.equal(withDefault.csv, withExplicitAll.csv);
  assert.equal(withDefault.manifest.annotationSource.id, 'all');
  assert.equal(withDefault.rows[0].annotationSource, 'all');
});

test('a single source records itself in the manifest so a file cannot be mistaken for "all"', async () => {
  const { dataset, registry } = await context();
  const { dataset: scoped, coveredId } = sourceScopedFixture(dataset);
  const result = buildExport({
    dataset: scoped, registry, ids: [coveredId], schemes: [{ map: {} }],
    generatedAt: new Date('2026-09-18T20:00:00Z'), annotationSource: 'utex-2973',
  });
  assert.deepEqual(result.manifest.annotationSource,
    { id: 'utex-2973', label: 'UTEX 2973', enabled: ['utex-2973'] });
  assert.equal(result.rows[0].annotationSource, 'utex-2973');
  assert.ok(result.manifest.caveats.some((line) => /annotationSource is "utex-2973"/.test(line)));
});

test('a UTEX-only export carries product, name, and category, blank PCC and GO', async () => {
  const { dataset, registry } = await context();
  const { dataset: scoped, coveredId } = sourceScopedFixture(dataset);
  const result = buildExport({
    dataset: scoped, registry, ids: [coveredId], schemes: [{ map: {} }],
    generatedAt: new Date('2026-09-18T20:00:00Z'), annotationSource: 'utex-2973',
  });
  assert.equal(result.rows[0].name, 'thrA');
  assert.equal(result.rows[0].functionCategory, 'Stress and repair');
  assert.equal(result.rows[0].pcc7942Essentiality, '');
  assert.equal(result.rows[0].pcc7942LocusTag, '');
  assert.deepEqual(result.manifest.genes[0].goAnnotations, []);
});

test('a PCC-only export carries essentiality, blank product, name, category, and GO', async () => {
  const { dataset, registry } = await context();
  const { dataset: scoped, coveredId } = sourceScopedFixture(dataset);
  const result = buildExport({
    dataset: scoped, registry, ids: [coveredId], schemes: [{ map: {} }],
    generatedAt: new Date('2026-09-18T20:00:00Z'), annotationSource: 'pcc-7942',
  });
  assert.equal(result.rows[0].pcc7942Essentiality, 'essential');
  assert.equal(result.rows[0].pcc7942LocusTag, 'SYNPCC7942_RS00005');
  assert.equal(result.rows[0].name, '');
  assert.equal(result.rows[0].product, '');
  assert.equal(result.rows[0].functionCategory, '');
  assert.deepEqual(result.manifest.genes[0].goAnnotations, []);
  assert.match(result.manifest.caveats.join(' '), /cross-strain assumption/);
});

test('a PCC-only export leaves an unjoined locus blank, never showing "unknown" as if it were a call', async () => {
  const { dataset, registry } = await context();
  const { dataset: scoped, uncoveredId } = sourceScopedFixture(dataset);
  const result = buildExport({
    dataset: scoped, registry, ids: [uncoveredId], schemes: [{ map: {} }],
    generatedAt: new Date('2026-09-18T20:00:00Z'), annotationSource: 'pcc-7942',
  });
  assert.equal(result.rows[0].pcc7942Essentiality, '');
  assert.equal(result.rows[0].pcc7942LocusTag, '');
  assert.equal(result.manifest.genes[0].pcc7942Essentiality, null);
});

test('a GO-IEA-only export carries GO relationships, blank product, name, category, and PCC', async () => {
  const { dataset, registry } = await context();
  const { dataset: scoped, coveredId } = sourceScopedFixture(dataset);
  const result = buildExport({
    dataset: scoped, registry, ids: [coveredId], schemes: [{ map: {} }],
    generatedAt: new Date('2026-09-18T20:00:00Z'), annotationSource: 'go-iea',
  });
  assert.equal(result.manifest.genes[0].goAnnotations[0].name, 'photosystem I');
  assert.equal(result.rows[0].name, '');
  assert.equal(result.rows[0].product, '');
  assert.equal(result.rows[0].pcc7942Essentiality, '');
  assert.match(result.manifest.caveats.join(' '), /Gene Ontology/);
});

test('a locus PCC and GO are both silent on exports blank for both of those sources', async () => {
  const { dataset, registry } = await context();
  const { dataset: scoped, uncoveredId } = sourceScopedFixture(dataset);
  for (const annotationSource of ['pcc-7942', 'go-iea']) {
    const result = buildExport({
      dataset: scoped, registry, ids: [uncoveredId], schemes: [{ map: {} }],
      generatedAt: new Date('2026-09-18T20:00:00Z'), annotationSource,
    });
    assert.equal(result.rows[0].product, '');
    assert.equal(result.rows[0].pcc7942Essentiality, '');
    assert.deepEqual(result.manifest.genes[0].goAnnotations, []);
  }
});

test('the CSV parser handles the shapes the writer can emit', () => {
  const { header, rows } = parseCsv('a,b\n1,"x,y"\n2,"he said ""hi"""\n3,"line\nbreak"\n');
  assert.deepEqual(header, ['a', 'b']);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].b, 'x,y');
  assert.equal(rows[1].b, 'he said "hi"');
  assert.equal(rows[2].b, 'line\nbreak');
});
