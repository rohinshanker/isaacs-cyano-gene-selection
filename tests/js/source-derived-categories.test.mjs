/**
 * Source-derived categories: the pinned file must validate against the real
 * release, colour resolution must follow reviewed-wins precedence and the
 * disagreement rule under every toggle combination, and the legend, canvas,
 * detail model, and export must all label derived colour as derived.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadDataset } from '../../site/js/core/dataset.js';
import {
  categoryResolutionFor, derivedCategoryIdFor, resolveCategoryBucket, resolveFunctionCategories,
  validateSourceDerivedCategories, EVIDENCE_LABELS, THRESHOLDS,
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
import { fileFetch } from './helpers.mjs';

const ROOT = new URL('../../', import.meta.url);
const DATA = new URL('site/data/', ROOT);
const ALL = ['utex-2973', 'pcc-7942', 'go-iea'];
const REVIEWED_ID = 'M744_RS00265'; // psaC: reviewed, and both sources agree
const DERIVED_ONLY_ID = 'M744_RS00560'; // petN: PCC product only, no GO terms
const DISAGREE_ID = 'M744_RS01175'; // RbfA: PCC translation, GO rRNA processing
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

test('reviewed wins when UTEX is on; derived sources fill in otherwise; disagreement is multiple', () => {
  const derived = { 'pcc-7942': 'stress-and-repair', 'go-iea': 'transport-and-envelope' };
  assert.deepEqual(resolveCategoryBucket(['other-characterized'], derived, ALL),
    { bucketId: 'other-characterized', evidence: ['reviewed'] });
  assert.deepEqual(resolveCategoryBucket(['a', 'b'], derived, ALL),
    { bucketId: 'multiple-functions', evidence: ['reviewed'] });
  // A reviewed unknown is still a reviewed decision and still wins.
  assert.deepEqual(resolveCategoryBucket(['unknown-or-unclassified'], derived, ALL),
    { bucketId: 'unknown-or-unclassified', evidence: ['reviewed'] });
  assert.deepEqual(resolveCategoryBucket(null, derived, ALL),
    { bucketId: 'multiple-functions', evidence: ['pcc-7942-derived', 'go-iea-derived'] });
  assert.deepEqual(resolveCategoryBucket(['other-characterized'], derived, ['pcc-7942', 'go-iea']),
    { bucketId: 'multiple-functions', evidence: ['pcc-7942-derived', 'go-iea-derived'] });
  assert.deepEqual(resolveCategoryBucket(null, derived, ['pcc-7942']),
    { bucketId: 'stress-and-repair', evidence: ['pcc-7942-derived'] });
  assert.deepEqual(resolveCategoryBucket(null, derived, ['go-iea']),
    { bucketId: 'transport-and-envelope', evidence: ['go-iea-derived'] });
  assert.deepEqual(resolveCategoryBucket(null, { 'pcc-7942': 'stress-and-repair', 'go-iea': 'stress-and-repair' }, ALL),
    { bucketId: 'stress-and-repair', evidence: ['pcc-7942-derived', 'go-iea-derived'] });
  assert.deepEqual(resolveCategoryBucket(null, { 'pcc-7942': null, 'go-iea': null }, ALL),
    { bucketId: 'unknown-or-unclassified', evidence: [] });
  assert.deepEqual(resolveCategoryBucket(['other-characterized'], derived, []),
    { bucketId: 'unknown-or-unclassified', evidence: [] });
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
    assert.equal(model.evidenceCounts.reviewed, expected.byEvidence.reviewed ?? 0, sources.join('+'));
    assert.equal(model.evidenceCounts['both-derived'],
      expected.byEvidence['pcc-7942-derived+go-iea-derived'] ?? 0, sources.join('+'));
  }
});

test('the UTEX-only toggle is exactly the reviewed table, and all sources keeps the 13 reviewed rows', async () => {
  const dataset = await realDataset();
  const reviewed = dataset.functionCategories;
  const utexOnly = resolveFunctionCategories({
    reviewed, derived: dataset.sourceDerivedCategories, genes: dataset.genes, sources: ['utex-2973'],
  });
  assert.deepEqual([...utexOnly.counts], [...reviewed.counts]);
  assert.deepEqual([...utexOnly.values], [...reviewed.values]);
  assert.equal(utexOnly.unknownCount, reviewed.unknownCount);
  assert.equal(utexOnly.derivedCount, 0);
  assert.ok(utexOnly.derived.every((flag) => flag === 0));
  const all = resolveFunctionCategories({
    reviewed, derived: dataset.sourceDerivedCategories, genes: dataset.genes, sources: ALL,
  });
  assert.equal(all.reviewedCount, 13);
  for (const [locus, row] of reviewed.assignmentsById) {
    const index = dataset.indexById.get(locus);
    assert.equal(all.derived[index], 0, `${locus} keeps its reviewed marker`);
    assert.equal(categoryBucketId(all, index),
      row.categoryIds.length > 1 ? 'multiple-functions' : row.categoryIds[0]);
  }
  const disagreeIndex = dataset.indexById.get(DISAGREE_ID);
  assert.equal(categoryBucketId(all, disagreeIndex), 'multiple-functions');
  assert.equal(all.derived[disagreeIndex], 1);
  assert.equal(passesCategoryFilter(all, disagreeIndex, ['multiple-functions']), true);
  assert.equal(passesCategoryFilter(all, disagreeIndex, ['translation-and-protein-maintenance']), false);
  const pccOnly = resolveFunctionCategories({
    reviewed, derived: dataset.sourceDerivedCategories, genes: dataset.genes, sources: ['pcc-7942'],
  });
  assert.equal(categoryBucketId(pccOnly, disagreeIndex), 'translation-and-protein-maintenance');
  assert.equal(pccOnly.reviewedCount, 0);
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

test('the detail model names the evidence and every enabled source\'s own category', async () => {
  const dataset = await realDataset();
  const resolve = (locusId, sources) => categoryResolutionFor({
    reviewed: dataset.functionCategories, derived: dataset.sourceDerivedCategories, sources, locusId,
  });
  const reviewed = resolve(REVIEWED_ID, ALL);
  assert.equal(reviewed.label, 'Photosynthetic light reactions');
  assert.deepEqual(reviewed.evidence, ['reviewed']);
  assert.equal(reviewed.perSource['utex-2973'].reviewed, true);
  assert.equal(reviewed.perSource['pcc-7942'].label, 'Photosynthetic light reactions');
  assert.equal(reviewed.perSource['go-iea'].label, 'Photosynthetic light reactions');

  const derivedOnly = resolve(DERIVED_ONLY_ID, ALL);
  assert.deepEqual(derivedOnly.evidence, ['pcc-7942-derived']);
  assert.equal(derivedOnly.perSource['utex-2973'].reviewed, false);
  assert.equal(derivedOnly.perSource['go-iea'].judged, false);
  assert.equal(derivedOnly.perSource['go-iea'].reason, 'no GO IEA terms');
  assert.equal(derivedOnly.perSource['pcc-7942'].pccLocusTag, 'SYNPCC7942_RS02420');

  const disagree = resolve(DISAGREE_ID, ALL);
  assert.equal(disagree.bucketId, 'multiple-functions');
  assert.equal(disagree.disagreement, true);
  assert.deepEqual(disagree.evidence, ['pcc-7942-derived', 'go-iea-derived']);
  assert.equal(disagree.perSource['pcc-7942'].label, 'Translation and protein maintenance');
  assert.equal(disagree.perSource['go-iea'].label, 'DNA and RNA processing');

  const reviewedUnknown = resolve(REVIEWED_UNKNOWN_ID, ALL);
  assert.equal(reviewedUnknown.bucketId, 'unknown-or-unclassified');
  assert.deepEqual(reviewedUnknown.evidence, ['reviewed']);
  assert.equal(reviewedUnknown.perSource['pcc-7942'].judged, true);
  assert.equal(reviewedUnknown.perSource['pcc-7942'].categoryId, null);

  const off = resolve(DERIVED_ONLY_ID, ['go-iea']);
  assert.equal(off.perSource['pcc-7942'].enabled, false);
  assert.equal(off.anyJudged, false);
  assert.deepEqual(off.evidence, []);
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
    reviewed: 13, 'pcc-7942-derived': 332, 'go-iea-derived': 268, 'both-derived': 752, none: 1350,
  }, true), '13 coloured by lab review, 1,352 by a derived source (332 PCC 7942 only, 268 GO IEA only, '
    + '752 both), 1,350 by neither.');
});

test('the export records enabled sources, the resolved category, its evidence, and every per-source category', async () => {
  const dataset = await realDataset();
  const live = computeLiveMetrics(dataset, compileScheme({}, dataset.table)).fields;
  const registry = buildMetricRegistry(dataset.meta, dataset.genes, live);
  const ids = [REVIEWED_ID, DERIVED_ONLY_ID, DISAGREE_ID];
  const all = buildExport({
    dataset, registry, ids, schemes: [{ map: {} }], generatedAt: new Date('2026-09-22T20:00:00Z'),
    annotationSources: ALL,
  });
  assert.deepEqual(all.manifest.annotationSource, { id: 'all', label: 'All sources', enabled: ALL });
  assert.equal(all.manifest.dataset.sourceDerivedCategories.datasetVersion, 'source-derived-categories-v1');
  assert.ok(all.columns.includes('functionCategoryEvidence'));
  const [reviewedRow, derivedRow, disagreeRow] = all.rows;
  assert.equal(reviewedRow.functionCategory, 'Photosynthetic light reactions');
  assert.equal(reviewedRow.functionCategoryEvidence, 'reviewed');
  assert.equal(reviewedRow.functionReviewStatus, 'reviewed');
  assert.equal(reviewedRow.pcc7942DerivedCategory, 'Photosynthetic light reactions');
  assert.equal(reviewedRow.goIeaDerivedProbability, 1);
  assert.equal(derivedRow.functionCategory, 'Photosynthetic light reactions');
  assert.equal(derivedRow.functionCategoryEvidence, 'pcc-7942-derived');
  assert.equal(derivedRow.functionReviewStatus, 'unreviewed');
  assert.equal(derivedRow.goIeaDerivedCategory, '');
  assert.equal(derivedRow.goIeaDerivedProbability, '');
  assert.equal(disagreeRow.functionCategory, 'Multiple functions');
  assert.equal(disagreeRow.functionCategoryEvidence, 'pcc-7942-derived; go-iea-derived');
  assert.equal(disagreeRow.pcc7942DerivedCategory, 'Translation and protein maintenance');
  assert.equal(disagreeRow.goIeaDerivedCategory, 'DNA and RNA processing');
  assert.deepEqual(all.manifest.genes[2].functionCategoryEvidence, ['pcc-7942-derived', 'go-iea-derived']);
  assert.equal(all.manifest.genes[2].derivedFunctionCategories['go-iea'].mostLikely, 'dna-and-rna-processing');
  assert.equal(all.manifest.genes[1].reviewedFunctionAssignment, null);
  assert.ok(all.manifest.caveats.some((line) => /pcc7942DerivedCategory and goIeaDerivedCategory are computational/.test(line)));

  const pccOnly = buildExport({
    dataset, registry, ids, schemes: [{ map: {} }], generatedAt: new Date('2026-09-22T20:00:00Z'),
    annotationSources: ['pcc-7942'],
  });
  assert.equal(pccOnly.rows[0].annotationSource, 'pcc-7942');
  assert.equal(pccOnly.rows[0].functionCategory, 'Photosynthetic light reactions');
  assert.equal(pccOnly.rows[0].functionCategoryEvidence, 'pcc-7942-derived');
  assert.equal(pccOnly.rows[0].reviewedFunctionCategories, '');
  assert.equal(pccOnly.rows[0].functionReviewStatus, '');
  assert.equal(pccOnly.rows[0].goIeaDerivedCategory, '');
  assert.equal(pccOnly.rows[2].functionCategory, 'Translation and protein maintenance');
  assert.equal(pccOnly.manifest.genes[0].reviewedFunctionAssignment, null);
  assert.equal(pccOnly.manifest.genes[0].derivedFunctionCategories['go-iea'], null);

  const goOnly = buildExport({
    dataset, registry, ids, schemes: [{ map: {} }],
    generatedAt: new Date('2026-09-22T20:00:00Z'), annotationSources: ['go-iea'],
  });
  // petN has no GO terms, so GO alone says nothing: blank, never unknown-as-a-value.
  assert.equal(goOnly.rows[1].functionCategory, '');
  assert.equal(goOnly.rows[1].functionCategoryEvidence, '');
  assert.equal(goOnly.rows[2].functionCategory, 'DNA and RNA processing');

  const none = buildExport({
    dataset, registry, ids, schemes: [{ map: {} }], generatedAt: new Date('2026-09-22T20:00:00Z'),
    annotationSources: [],
  });
  assert.equal(none.manifest.annotationSource.id, 'none');
  assert.deepEqual(none.manifest.annotationSource.enabled, []);
  assert.equal(none.rows[0].functionCategory, '');
  assert.equal(none.rows[0].product, '');
  assert.ok(none.manifest.caveats.some((line) => /No annotation source is enabled/.test(line)));
});
