/**
 * Source-derived categories: the pinned file must validate against the real
 * release, colour resolution must follow UTEX > PCC > GO precedence under
 * every toggle combination with conflicts named rather than bucketed, and the
 * legend, canvas, detail model, and export must all label derived colour as
 * derived.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadDataset } from '../../site/js/core/dataset.js';
import {
  categoryResolutionFor, conflictNote, derivedCategoryIdFor, resolveCategoryBucket,
  resolveFunctionCategories, validateSourceDerivedCategories, EVIDENCE_LABELS, THRESHOLDS,
} from '../../site/js/core/source-derived-categories.js';
import { categoryBucketId, passesCategoryFilter } from '../../site/js/core/function-categories.js';
import { buildMarkerBuckets, derivedDotRadius } from '../../site/js/ui/scatter.js';
import {
  categoryEvidenceSummary, categoryLegendTitle, legendMarkerDescription,
} from '../../site/js/ui/legend.js';
import { buildCategoryColorScale } from '../../site/js/ui/colors.js';
import { computeLiveMetrics } from '../../site/js/core/live-metrics.js';
import { compileScheme } from '../../site/js/core/scheme.js';
import { buildMetricRegistry } from '../../site/js/core/metric-registry.js';
import { buildExport } from '../../site/js/core/export-manifest.js';
import { functionCategoryHelp } from '../../site/js/core/metric-help.js';
import { renderMetricHelp } from '../../site/js/ui/metric-help.js';
import { renderCategoryLegend } from '../../site/js/ui/legend.js';
import { fileFetch } from './helpers.mjs';
import { withFakeDocument } from './fake-dom.mjs';

const ROOT = new URL('../../', import.meta.url);
const DATA = new URL('site/data/', ROOT);
const ALL = ['utex-2973', 'pcc-7942', 'go-iea'];
const REVIEWED_ID = 'M744_RS00265'; // psaC: reviewed, and both sources agree
const DERIVED_ONLY_ID = 'M744_RS00560'; // petN: PCC product only, no GO terms
const CONFLICT_ID = 'M744_RS01175'; // RbfA: PCC translation, GO rRNA processing
const REVIEWED_UNKNOWN_ID = 'M744_RS00030'; // reviewed as unknown; PCC judged unknown

let cached = null;
/** The real published dataset, loaded through the same loader the page uses. */
async function realDataset() {
  if (!cached) cached = await loadDataset({ baseUrl: DATA, fetchImpl: fileFetch() });
  return cached;
}

async function summary() {
  return JSON.parse(await readFile(new URL('data/audits/source-derived-categories/summary.json', ROOT), 'utf8'));
}

test('the pinned derived file loads, validates, and exposes both sources for every CDS', async () => {
  const dataset = await realDataset();
  const derived = dataset.sourceDerivedCategories;
  assert.ok(derived, 'the derived file is published');
  assert.equal(Object.keys(derived.byLocus).length, dataset.genes.length);
  assert.deepEqual(derived.policy.evidenceLabels, [...EVIDENCE_LABELS]);
  assert.equal(derived.policy.thresholds.derivedProbabilityAtLeast, THRESHOLDS.derivedProbabilityAtLeast);
  assert.equal(derived.attribution.goIea.license, 'CC BY 4.0');
  assert.ok(derived.attribution.pcc7942.attributedStudies.includes('Adomako et al. 2022'));
  assert.ok(derived.attribution.pcc7942.attributedStudies.includes('Rubin et al. 2015'));
  assert.equal(derived.byLocus[DERIVED_ONLY_ID]['go-iea'], null);
  assert.equal(derived.byLocus[DERIVED_ONLY_ID]['pcc-7942'].categoryId, 'photosynthetic-light-reactions');
});

test('a supplied category is never trusted: it must equal the one re-derived from its probability', async () => {
  const dataset = await realDataset();
  const release = dataset.meta.annotationRelease.releaseId;
  const reviewed = dataset.functionCategories;
  const evidence = dataset.candidateEvidence;
  const valid = structuredClone(dataset.sourceDerivedCategories);
  assert.equal(validateSourceDerivedCategories(valid, dataset.genes, reviewed, evidence, release), valid);

  const trusted = structuredClone(valid);
  trusted.byLocus[DERIVED_ONLY_ID]['pcc-7942'].probability = 0.5;
  assert.throws(() => validateSourceDerivedCategories(trusted, dataset.genes, reviewed, evidence, release),
    /disagrees with its probability/);
  const relabelled = structuredClone(valid);
  relabelled.byLocus[DERIVED_ONLY_ID]['pcc-7942'].categoryId = 'stress-and-repair';
  assert.throws(() => validateSourceDerivedCategories(relabelled, dataset.genes, reviewed, evidence, release),
    /disagrees with its probability/);
  const threshold = structuredClone(valid);
  threshold.policy.thresholds.derivedProbabilityAtLeast = 0.5;
  assert.throws(() => validateSourceDerivedCategories(threshold, dataset.genes, reviewed, evidence, release),
    /thresholds differ/);
  const vocabulary = structuredClone(valid);
  vocabulary.vocabulary.categories[0].label = 'Photosynthesis';
  assert.throws(() => validateSourceDerivedCategories(vocabulary, dataset.genes, reviewed, evidence, release),
    /vocabulary differs/);
  const join = structuredClone(valid);
  join.byLocus[DERIVED_ONLY_ID]['pcc-7942'] = null;
  assert.throws(() => validateSourceDerivedCategories(join, dataset.genes, reviewed, evidence, release),
    /disagrees with its join/);
  const terms = structuredClone(valid);
  terms.byLocus[DERIVED_ONLY_ID]['go-iea'] = { mostLikely: 'stress-and-repair', probability: 0.9, categoryId: 'stress-and-repair' };
  assert.throws(() => validateSourceDerivedCategories(terms, dataset.genes, reviewed, evidence, release),
    /disagrees with its GO terms/);
  const attribution = structuredClone(valid);
  attribution.attribution.pcc7942.attributedStudies = ['Adomako et al. 2022'];
  assert.throws(() => validateSourceDerivedCategories(attribution, dataset.genes, reviewed, evidence, release),
    /Adomako and Rubin/);
  assert.throws(() => validateSourceDerivedCategories(valid, dataset.genes, null, evidence, release),
    /require the reviewed/);
  assert.throws(() => validateSourceDerivedCategories(valid, dataset.genes, reviewed, evidence, 'other'),
    /release does not match/);
});

test('the assignment rule: unknown never assigns, and only the threshold admits a category', () => {
  assert.equal(derivedCategoryIdFor({ mostLikely: 'stress-and-repair', probability: 0.8 }), 'stress-and-repair');
  assert.equal(derivedCategoryIdFor({ mostLikely: 'stress-and-repair', probability: 0.79 }), null);
  assert.equal(derivedCategoryIdFor({ mostLikely: 'unknown-or-unclassified', probability: 1 }), null);
  assert.equal(derivedCategoryIdFor(null), null);
  assert.equal(derivedCategoryIdFor({ mostLikely: 'stress-and-repair', probability: 'high' }), null);
});

test('UTEX > PCC > GO among the enabled sources; a lower source that differs is a named conflict', () => {
  const derived = { 'pcc-7942': 'stress-and-repair', 'go-iea': 'transport-and-envelope' };
  assert.deepEqual(resolveCategoryBucket(['other-characterized'], derived, ALL), {
    bucketId: 'other-characterized', evidence: 'reviewed', source: 'utex-2973',
    conflicts: [{ source: 'pcc-7942', categoryId: 'stress-and-repair' },
      { source: 'go-iea', categoryId: 'transport-and-envelope' }],
  });
  // Two reviewed ids are the only route into the multiple-functions bucket.
  assert.equal(resolveCategoryBucket(['a', 'b'], derived, ALL).bucketId, 'multiple-functions');
  // A reviewed unknown is still a reviewed decision and still wins.
  assert.equal(resolveCategoryBucket(['unknown-or-unclassified'], derived, ALL).bucketId, 'unknown-or-unclassified');
  assert.equal(resolveCategoryBucket(['unknown-or-unclassified'], derived, ALL).evidence, 'reviewed');
  assert.deepEqual(resolveCategoryBucket(null, derived, ALL), {
    bucketId: 'stress-and-repair', evidence: 'pcc-7942-derived', source: 'pcc-7942',
    conflicts: [{ source: 'go-iea', categoryId: 'transport-and-envelope' }],
  });
  assert.deepEqual(resolveCategoryBucket(['other-characterized'], derived, ['pcc-7942', 'go-iea']).bucketId,
    'stress-and-repair');
  assert.deepEqual(resolveCategoryBucket(null, derived, ['go-iea']), {
    bucketId: 'transport-and-envelope', evidence: 'go-iea-derived', source: 'go-iea', conflicts: [],
  });
  assert.deepEqual(resolveCategoryBucket(null, { 'pcc-7942': 'stress-and-repair', 'go-iea': 'stress-and-repair' }, ALL).conflicts, []);
  assert.deepEqual(resolveCategoryBucket(null, { 'pcc-7942': null, 'go-iea': null }, ALL),
    { bucketId: 'unknown-or-unclassified', evidence: null, source: null, conflicts: [] });
  assert.equal(resolveCategoryBucket(['other-characterized'], derived, []).bucketId, 'unknown-or-unclassified');
});

const TOGGLE_SETS = [
  ['utex-2973'], ['pcc-7942'], ['go-iea'],
  ['utex-2973', 'pcc-7942'], ['utex-2973', 'go-iea'], ['pcc-7942', 'go-iea'], ALL, [],
];

test('legend counts under every toggle combination equal the build tool\'s independent resolution', async () => {
  const dataset = await realDataset();
  const audit = await summary();
  const expectedByKey = { ...audit.legendByToggle, 'utex-2973+pcc-7942+go-iea': audit.counts.allSourcesLegend };
  for (const sources of TOGGLE_SETS) {
    const model = resolveFunctionCategories({
      reviewed: dataset.functionCategories, derived: dataset.sourceDerivedCategories,
      genes: dataset.genes, sources,
    });
    const total = [...model.counts].reduce((sum, n) => sum + n, 0) + model.multipleCount + model.unknownCount;
    assert.equal(total, dataset.genes.length, sources.join('+'));
    if (sources.length === 0) {
      assert.equal(model.unknownCount, dataset.genes.length);
      assert.equal(model.derivedCount, 0);
      continue;
    }
    const expected = expectedByKey[sources.join('+')];
    assert.ok(expected, `pinned legend for ${sources.join('+')}`);
    model.categoryIds.forEach((id, index) => {
      assert.equal(model.counts[index], expected.byCategory[id], `${sources.join('+')} ${id}`);
    });
    assert.equal(model.multipleCount, expected.multipleFunctions, sources.join('+'));
    assert.equal(model.unknownCount, expected.unknownOrUnclassified, sources.join('+'));
    assert.equal(model.colouredCount, expected.coloured, sources.join('+'));
    assert.equal(model.conflictCount, expected.conflicts, sources.join('+'));
    for (const label of ['reviewed', 'pcc-7942-derived', 'go-iea-derived', 'none']) {
      assert.equal(model.evidenceCounts[label], expected.byEvidence[label] ?? 0, `${sources.join('+')} ${label}`);
    }
  }
});

test('UTEX alone colours few, UTEX with PCC many more, all three the most; conflicts never bucket', async () => {
  const dataset = await realDataset();
  const reviewed = dataset.functionCategories;
  const resolve = (sources) => resolveFunctionCategories({
    reviewed, derived: dataset.sourceDerivedCategories, genes: dataset.genes, sources,
  });
  const utexOnly = resolve(['utex-2973']);
  assert.deepEqual([...utexOnly.counts], [...reviewed.counts]);
  assert.deepEqual([...utexOnly.values], [...reviewed.values]);
  assert.equal(utexOnly.unknownCount, reviewed.unknownCount);
  assert.equal(utexOnly.colouredCount, 12);
  assert.equal(utexOnly.derivedCount, 0);
  assert.ok(utexOnly.derived.every((flag) => flag === 0));
  const withPcc = resolve(['utex-2973', 'pcc-7942']);
  const all = resolve(ALL);
  assert.ok(utexOnly.colouredCount < withPcc.colouredCount && withPcc.colouredCount < all.colouredCount);
  assert.equal(all.reviewedCount, 13);
  assert.equal(all.multipleCount, 0, 'conflicts never enter the multiple-functions bucket');
  assert.equal(all.conflictCount, 13);
  for (const [locus, row] of reviewed.assignmentsById) {
    const index = dataset.indexById.get(locus);
    assert.equal(all.derived[index], 0, `${locus} keeps its reviewed marker`);
    assert.equal(categoryBucketId(all, index),
      row.categoryIds.length > 1 ? 'multiple-functions' : row.categoryIds[0]);
  }
  const conflictIndex = dataset.indexById.get(CONFLICT_ID);
  assert.equal(categoryBucketId(all, conflictIndex), 'translation-and-protein-maintenance');
  assert.equal(all.derived[conflictIndex], 1);
  assert.equal(passesCategoryFilter(all, conflictIndex, ['translation-and-protein-maintenance']), true);
  assert.equal(passesCategoryFilter(all, conflictIndex, ['dna-and-rna-processing']), false);
  const goOnly = resolve(['go-iea']);
  assert.equal(categoryBucketId(goOnly, conflictIndex), 'dna-and-rna-processing');
  assert.equal(goOnly.reviewedCount, 0);
});

test('without a derived file the resolution is the reviewed table gated by the UTEX toggle', async () => {
  const dataset = await realDataset();
  const reviewed = dataset.functionCategories;
  const on = resolveFunctionCategories({ reviewed, derived: null, genes: dataset.genes, sources: ALL });
  assert.deepEqual([...on.counts], [...reviewed.counts]);
  assert.equal(on.hasDerivedData, false);
  const off = resolveFunctionCategories({ reviewed, derived: null, genes: dataset.genes, sources: ['pcc-7942'] });
  assert.equal(off.unknownCount, dataset.genes.length);
});

test('the detail model names the winning source, every source\'s own category, and conflicts', async () => {
  const dataset = await realDataset();
  const resolve = (locusId, sources) => categoryResolutionFor({
    reviewed: dataset.functionCategories, derived: dataset.sourceDerivedCategories, sources, locusId,
  });
  const reviewed = resolve(REVIEWED_ID, ALL);
  assert.equal(reviewed.label, 'Photosynthetic light reactions');
  assert.equal(reviewed.evidence, 'reviewed');
  assert.equal(reviewed.source, 'utex-2973');
  assert.deepEqual(reviewed.conflicts, []);
  assert.equal(reviewed.perSource['utex-2973'].reviewed, true);
  assert.equal(reviewed.perSource['pcc-7942'].label, 'Photosynthetic light reactions');
  assert.equal(reviewed.perSource['go-iea'].label, 'Photosynthetic light reactions');

  const derivedOnly = resolve(DERIVED_ONLY_ID, ALL);
  assert.equal(derivedOnly.evidence, 'pcc-7942-derived');
  assert.equal(derivedOnly.perSource['utex-2973'].reviewed, false);
  assert.equal(derivedOnly.perSource['go-iea'].judged, false);
  assert.equal(derivedOnly.perSource['go-iea'].reason, 'no GO IEA terms');
  assert.equal(derivedOnly.perSource['pcc-7942'].pccLocusTag, 'SYNPCC7942_RS02420');

  const conflict = resolve(CONFLICT_ID, ALL);
  assert.equal(conflict.bucketId, 'translation-and-protein-maintenance');
  assert.equal(conflict.evidence, 'pcc-7942-derived');
  assert.deepEqual(conflict.conflicts, [{
    source: 'go-iea', categoryId: 'dna-and-rna-processing', label: 'DNA and RNA processing',
  }]);
  assert.equal(conflictNote(conflict), 'GO IEA derived: DNA and RNA processing');
  assert.equal(conflictNote(reviewed), '');

  const reviewedUnknown = resolve(REVIEWED_UNKNOWN_ID, ALL);
  assert.equal(reviewedUnknown.bucketId, 'unknown-or-unclassified');
  assert.equal(reviewedUnknown.evidence, 'reviewed');
  assert.equal(reviewedUnknown.perSource['pcc-7942'].judged, true);
  assert.equal(reviewedUnknown.perSource['pcc-7942'].categoryId, null);

  // A disabled source is still listed with its judgment, just not used for colour.
  const off = resolve(DERIVED_ONLY_ID, ['go-iea']);
  assert.equal(off.perSource['pcc-7942'].enabled, false);
  assert.equal(off.perSource['pcc-7942'].label, 'Photosynthetic light reactions');
  assert.equal(off.evidence, null);
  assert.equal(off.label, 'Unknown or unclassified');
  assert.equal(resolve(DERIVED_ONLY_ID, []).sources.length, 0);
});

test('the canvas groups derived points apart from reviewed ones in the same colour bucket', () => {
  const scale = buildCategoryColorScale(10);
  const x = Float64Array.from([0, 1, 2, 3, 4]);
  const y = Float64Array.from([0, 1, 2, 3, 4]);
  const values = Int16Array.from([0, 0, 10, -1, 3]);
  const derived = Uint8Array.from([0, 1, 1, 0, 0]);
  const mask = Uint8Array.from([1, 1, 1, 1, 0]);
  const buckets = buildMarkerBuckets(x, y, mask, scale, values, derived);
  assert.deepEqual([...buckets.lists[0]], [0]);
  assert.deepEqual([...buckets.derivedLists[0]], [1]);
  assert.deepEqual([...buckets.derivedLists[10]], [2]);
  assert.deepEqual([...buckets.missing], [3]);
  assert.deepEqual([...buckets.hidden], [4]);
  const plain = buildMarkerBuckets(x, y, mask, scale, values);
  assert.deepEqual([...plain.lists[0]], [0, 1]);
  assert.ok(plain.derivedLists.every((list) => list.length === 0));
  assert.ok(derivedDotRadius(4) < 4 && derivedDotRadius(4) > 0);
  assert.equal(derivedDotRadius(0.5), 0.9);
});

test('the legend has a derived swatch, names the counted sources, and summarises the evidence', () => {
  const swatch = legendMarkerDescription('derived-circle', '#123456', '#ffffff');
  assert.equal(swatch.elements.length, 2);
  assert.equal(swatch.elements[0].attributes.fill, '#ffffff');
  assert.equal(swatch.elements[0].attributes.stroke, '#123456');
  assert.equal(swatch.elements[1].attributes.fill, '#123456');
  assert.equal(categoryLegendTitle(ALL, true),
    'Function categories, counted under UTEX 2973 reviewed + PCC 7942 derived + GO IEA derived (whole CDS set)');
  assert.equal(categoryLegendTitle(['utex-2973'], true),
    'Function categories, counted under UTEX 2973 reviewed (whole CDS set)');
  assert.equal(categoryLegendTitle(['pcc-7942', 'go-iea'], false),
    'Function categories (no source enabled: every CDS unknown)');
  assert.equal(categoryLegendTitle([], true), 'Function categories (no source enabled: every CDS unknown)');
  assert.equal(categoryEvidenceSummary(null, true), null);
  assert.equal(categoryEvidenceSummary({ reviewed: 1 }, false), null);
  assert.equal(categoryEvidenceSummary({
    reviewed: 13, 'pcc-7942-derived': 1084, 'go-iea-derived': 268, none: 1350,
  }, true, 13), '13 coloured by lab review, 1,084 by PCC 7942, 268 by GO IEA, 1,350 by no enabled '
    + 'source; 13 coloured by a higher-priority source over a conflicting one.');
  assert.equal(categoryEvidenceSummary({
    reviewed: 13, 'pcc-7942-derived': 0, 'go-iea-derived': 0, none: 2702,
  }, true, 0), '13 coloured by lab review, 0 by PCC 7942, 0 by GO IEA, 2,702 by no enabled source.');
});

test('the export records the colour sources, the resolved category, its evidence, conflicts, and every per-source category', async () => {
  const dataset = await realDataset();
  const live = computeLiveMetrics(dataset, compileScheme({}, dataset.table)).fields;
  const registry = buildMetricRegistry(dataset.meta, dataset.genes, live);
  const ids = [REVIEWED_ID, DERIVED_ONLY_ID, CONFLICT_ID];
  const all = buildExport({
    dataset, registry, ids, schemes: [{ map: {} }], generatedAt: new Date('2026-09-22T20:00:00Z'),
    colorSources: ALL,
  });
  assert.deepEqual(all.manifest.functionColourSources, { id: 'all', label: 'All sources', enabled: ALL });
  assert.equal(all.manifest.dataset.sourceDerivedCategories.datasetVersion, 'source-derived-categories-v1');
  assert.ok(all.columns.includes('functionCategoryConflict'));
  assert.ok(!all.columns.includes('annotationSource'));
  const [reviewedRow, derivedRow, conflictRow] = all.rows;
  assert.equal(reviewedRow.functionCategory, 'Photosynthetic light reactions');
  assert.equal(reviewedRow.functionCategoryEvidence, 'reviewed');
  assert.equal(reviewedRow.functionCategoryConflict, '');
  assert.equal(reviewedRow.functionReviewStatus, 'reviewed');
  assert.equal(reviewedRow.pcc7942DerivedCategory, 'Photosynthetic light reactions');
  assert.equal(reviewedRow.goIeaDerivedProbability, 1);
  assert.equal(derivedRow.functionCategory, 'Photosynthetic light reactions');
  assert.equal(derivedRow.functionCategoryEvidence, 'pcc-7942-derived');
  assert.equal(derivedRow.functionReviewStatus, 'unreviewed');
  assert.equal(derivedRow.goIeaDerivedCategory, '');
  assert.equal(derivedRow.goIeaDerivedProbability, '');
  assert.equal(conflictRow.functionCategory, 'Translation and protein maintenance');
  assert.equal(conflictRow.functionCategoryEvidence, 'pcc-7942-derived');
  assert.equal(conflictRow.functionCategoryConflict, 'GO IEA derived: DNA and RNA processing');
  assert.equal(conflictRow.pcc7942DerivedCategory, 'Translation and protein maintenance');
  assert.equal(conflictRow.goIeaDerivedCategory, 'DNA and RNA processing');
  assert.equal(all.manifest.genes[2].functionCategoryEvidence, 'pcc-7942-derived');
  assert.equal(all.manifest.genes[2].functionCategoryConflicts[0].source, 'go-iea');
  assert.equal(all.manifest.genes[2].derivedFunctionCategories['go-iea'].mostLikely, 'dna-and-rna-processing');
  assert.equal(all.manifest.genes[1].reviewedFunctionAssignment, null);
  assert.ok(all.manifest.caveats.some((line) => /pcc7942DerivedCategory and goIeaDerivedCategory are computational/.test(line)));

  // With GO IEA alone colouring, the conflict locus is coloured by GO and every
  // source's judgment is still exported; nothing outside the colour is blanked.
  const goOnly = buildExport({
    dataset, registry, ids, schemes: [{ map: {} }], generatedAt: new Date('2026-09-22T20:00:00Z'),
    colorSources: ['go-iea'],
  });
  assert.deepEqual(goOnly.manifest.functionColourSources.enabled, ['go-iea']);
  assert.equal(goOnly.rows[0].functionCategory, 'Photosynthetic light reactions');
  assert.equal(goOnly.rows[0].functionCategoryEvidence, 'go-iea-derived');
  assert.equal(goOnly.rows[0].reviewedFunctionCategories, 'Photosynthetic light reactions');
  assert.equal(goOnly.rows[0].functionReviewStatus, 'reviewed');
  assert.equal(goOnly.rows[1].functionCategory, 'Unknown or unclassified');
  assert.equal(goOnly.rows[1].functionCategoryEvidence, '');
  assert.equal(goOnly.rows[1].pcc7942DerivedCategory, 'Photosynthetic light reactions');
  assert.equal(goOnly.rows[2].functionCategory, 'DNA and RNA processing');
  assert.equal(goOnly.rows[2].functionCategoryConflict, '');
  assert.equal(goOnly.manifest.genes[1].derivedFunctionCategories['pcc-7942'].enabledForColouring, false);

  const none = buildExport({
    dataset, registry, ids, schemes: [{ map: {} }], generatedAt: new Date('2026-09-22T20:00:00Z'),
    colorSources: [],
  });
  assert.equal(none.manifest.functionColourSources.id, 'none');
  assert.equal(none.rows[0].functionCategory, 'Unknown or unclassified');
  assert.equal(none.rows[0].product, dataset.genes[dataset.indexById.get(REVIEWED_ID)].product);
  assert.ok(none.manifest.caveats.some((line) => /enabled for colouring: No sources/.test(line)));
});

function resolvedUnder(dataset, sources) {
  return resolveFunctionCategories({
    reviewed: dataset.functionCategories, derived: dataset.sourceDerivedCategories,
    genes: dataset.genes, sources,
  });
}

test('the filled-circle legend count excludes the row reviewed as unknown', async () => {
  const dataset = await realDataset();
  const all = resolvedUnder(dataset, ALL);
  // Thirteen rows are resolved by review, but the one reviewed as unknown
  // draws the open unknown circle, so only twelve carry a filled marker.
  assert.equal(all.evidenceCounts.reviewed, 13);
  assert.equal(all.reviewedColouredCount, 12);
  assert.equal(resolvedUnder(dataset, ['utex-2973']).reviewedColouredCount, 12);
  assert.equal(resolvedUnder(dataset, ['pcc-7942', 'go-iea']).reviewedColouredCount, 0);
  assert.equal(resolvedUnder(dataset, []).reviewedColouredCount, 0);

  await withFakeDocument((document) => {
    const host = document.createElement('div');
    renderCategoryLegend(host, {
      ...all,
      scale: buildCategoryColorScale(all.labels.length),
      hiddenReviewedCount: 0,
      hiddenUnknownCount: 0,
      showHidden: false,
      derivedThreshold: THRESHOLDS.derivedProbabilityAtLeast,
    });
    const rows = host.querySelectorAll('li').map((item) => item.textContent);
    assert.ok(rows.includes('Reviewed (lab) category: filled circle (12)'), rows.join(' | '));
    assert.ok(rows.includes('Derived (computational) category: ring with centre dot (1,352)'));
    assert.match(host.querySelector('.legend-evidence').textContent, /^13 coloured by lab review, 1,084 by PCC 7942/);
  });
});

test('the colour explanation states the enabled-source precedence and the conflict rule', async () => {
  const dataset = await realDataset();
  const reviewed = dataset.functionCategories;
  const derived = dataset.sourceDerivedCategories;
  const help = functionCategoryHelp({ reviewed, derived, categories: resolvedUnder(dataset, ALL) });
  assert.equal(help.title, 'Function category');
  assert.match(help.summary, /when that source is enabled and a reviewed row exists/);
  assert.match(help.method, /^The lab approved 13 exact locus decisions on 2026-09-22\./);
  assert.match(help.method, /UTEX 2973 > PCC 7942 > GO IEA/);
  assert.match(help.method, /colours its CDS only while UTEX 2973 is enabled/);
  assert.match(help.method, /TypeSafe jev-1\.13\.0 judgments .* at probability 0\.80 or above/);
  assert.match(help.method, /highest-priority enabled source colours the CDS and the detail panel and export name the conflict/);
  assert.match(help.method, /never use the multiple-functions bucket, which only two reviewed labels reach/);
  assert.doesNotMatch(help.method, /always wins/);
  assert.doesNotMatch(help.method, /Two derived sources that disagree/);
  assert.match(help.origin, /PCC 7942 RefSeq product names .* Gene Ontology IEA relationships/);
  assert.equal(help.coverage, 'Under All sources: 13 coloured by lab review, 1,352 by a derived '
    + 'source, 0 in multiple functions, and 1,351 unknown or unclassified.');
  assert.deepEqual(help.citations, ['ncbi-utex-2973']);

  const pccAndGo = functionCategoryHelp({
    reviewed, derived, categories: resolvedUnder(dataset, ['pcc-7942', 'go-iea']),
  });
  assert.equal(pccAndGo.coverage, 'Under PCC 7942 + GO IEA: 0 coloured by lab review, 1,363 by a '
    + 'derived source, 0 in multiple functions, and 1,352 unknown or unclassified.');

  // Without a derived file the reviewed rule still reads correctly and GO stays passive.
  const reviewedOnly = functionCategoryHelp({
    reviewed, derived: null, categories: resolvedUnder({ ...dataset, sourceDerivedCategories: null }, ALL),
  });
  assert.match(reviewedOnly.method, /GO IEA suggestions never assign a category colour by themselves\.$/);
  assert.doesNotMatch(reviewedOnly.method, /TypeSafe/);
  assert.match(reviewedOnly.origin, /lab review table\.$/);

  // The rendered disclosure carries the same text, row by row.
  await withFakeDocument((document) => {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    const body = document.createElement('div');
    body.className = 'help-content';
    details.append(summary, body);
    renderMetricHelp(details, help, null);
    assert.equal(details.hidden, false);
    assert.equal(summary.textContent, 'Function category explanation');
    const rendered = Object.fromEntries(body.querySelector('dl').children
      .map((row) => [row.querySelector('dt').textContent, row.querySelector('dd').textContent]));
    assert.equal(rendered.Calculation, help.method);
    assert.equal(rendered.Meaning, help.summary);
    assert.equal(rendered['Missing values'], help.coverage);
    assert.match(rendered.Calculation, /only while UTEX 2973 is enabled/);
    assert.doesNotMatch(rendered.Calculation, /always wins|multiple-functions bucket\.$/);
  });
});
