/**
 * The neighbouring-gene TSS count: distinct admitted sites inside a CDS, from
 * either strand, one total shared by colour, filter, viewers and exports.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_ORGANISM } from '../../site/js/core/organisms.js';
import {
  indexNativeSites, buildNeighborSiteIndex, neighborSiteModel, neighborSiteCountMetric,
  neighborSiteCountTally, normalizeNeighborSiteCountFilter, passesNeighborSiteCountFilter,
  passesNeighborSiteFilter, encodeNeighborSiteCountFilter, decodeNeighborSiteCountFilter,
  neighborSiteFilterSummary, NEIGHBOR_SITE_COLOR_KEY,
} from '../../site/js/core/neighbor-sites.js';
import {
  defaultState, encodeState, decodeState, applyDecoded, viewStateOf,
} from '../../site/js/core/url-state.js';
import { clearedFilterState, FilterPanel } from '../../site/js/ui/filters.js';
import { withFakeDocument } from './fake-dom.mjs';
import { filterCriteriaSignature } from '../../site/js/core/filter-bypass.js';

const organism = { ...DEFAULT_ORGANISM, genome: { accession: 'GCF_test.1', replicons: [
  { accession: 'NZ_TEST.1', lengthBp: 100 },
] } };
const gene = (id, strand = '+', segments = null) => ({ id, strand, seqid: 'NZ_TEST.1', start: 10, end: 30,
  cdsSegments: segments });
const site = (position, strand, locus = 'other', extra = {}) => ({ locus, layer: 'test',
  source: { doi: 'study' }, row: { id: `s${position}${strand}`, type: 'gTSS', position, replicon: 'TEST', strand, ...extra } });
const modelFor = (genes, records, options = { sources: ['TAN2018_TSS_CONTROL'] }) => neighborSiteModel(
  { genes, neighborSites: indexNativeSites(genes, records, organism) }, options);

test('two same-strand and three opposite-strand sites total five, relative to the focal CDS', () => {
  const focal = gene('focal', '-');
  const records = [site(11, '-'), site(12, '-'), site(13, '+'), site(14, '+'), site(15, '+')];
  const model = modelFor([focal, gene('other', '+')], records);
  assert.equal(model.siteCounts[0], 5);
  assert.equal(model.forGene(focal).count, 5, 'the viewers read the same total');
});

test('0, 1 and many; coincident opposite strands stay two; duplicates count once', () => {
  const genes = [gene('none', '+', [[40, 50]]), gene('one'), gene('many'), gene('other')];
  genes[2] = { ...genes[2], start: 60, end: 80, cdsSegments: [[60, 80]] };
  genes[1] = { ...genes[1], cdsSegments: [[10, 30]] };
  const records = [
    site(20, '+'),
    // One physical site seen under two conditions and two owners: one site.
    site(65, '+'), { ...site(65, '+', 'owner2'), row: { ...site(65, '+').row, id: 'dup' } },
    site(70, '+'), site(70, '-'), site(75, '-'),
  ];
  const model = modelFor(genes, records);
  assert.deepEqual([...model.siteCounts], [0, 1, 4, 0]);
  const tally = neighborSiteCountTally(model);
  assert.deepEqual(tally.rows, [{ count: 0, genes: 2 }, { count: 1, genes: 1 }, { count: 4, genes: 1 }]);
  assert.equal(tally.unavailable, 0);
});

test('inclusive CDS boundaries, coding gaps excluded, self-only sites never counted', () => {
  const focal = gene('focal', '+', [[10, 15], [25, 30]]);
  const records = [9, 10, 15, 16, 24, 25, 30, 31].map((bp) => site(bp, '+'));
  records.push(site(12, '-', 'focal'));
  assert.equal(modelFor([focal], records).siteCounts[0], 4);
});

test('unavailable evidence is unknown, never zero, in colour, filter and tally', () => {
  const genes = [gene('focal'), gene('other')];
  const model = modelFor(genes, [site(20, '+')], { sources: [] });
  assert.equal(model.available, false);
  assert.ok([...model.siteCounts].every(Number.isNaN));
  const metric = neighborSiteCountMetric(model, 'tssEvidence');
  assert.equal(metric.key, NEIGHBOR_SITE_COLOR_KEY);
  assert.equal(metric.integer, true);
  assert.equal(metric.fileKey, 'tssEvidence');
  assert.ok(Number.isNaN(metric.read(0)));
  assert.equal(neighborSiteCountTally(model).unavailable, 2);
  // A saved range is suspended, not applied, while nothing can be read.
  assert.equal(passesNeighborSiteCountFilter(model, 0, { min: 1, max: null }), true);
  const summary = neighborSiteFilterSummary(model, 'any', { min: 1, max: null });
  assert.equal(summary.countSuspended, true);
  assert.equal(summary.effectiveCountRange, null);
  assert.deepEqual(summary.countRange, { min: 1, max: null });
});

test('the count range is inclusive and agrees with the categorical shortcuts', () => {
  const genes = [gene('none', '+', [[40, 50]]), gene('one', '+', [[10, 30]]), gene('other', '+', [[60, 80]])];
  const model = modelFor(genes, [site(20, '+'), site(65, '+', 'one'), site(70, '-', 'one')]);
  assert.deepEqual([...model.siteCounts], [0, 1, 2]);
  const kept = (range) => genes.map((_, i) => passesNeighborSiteCountFilter(model, i, range));
  assert.deepEqual(kept({ min: 1, max: 2 }), [false, true, true]);
  assert.deepEqual(kept({ min: 2, max: null }), [false, false, true]);
  assert.deepEqual(kept({ min: null, max: 0 }), [true, false, false]);
  assert.deepEqual(kept({ min: 2, max: 1 }), [false, false, false], 'an inverted range keeps nothing');
  // With recorded overlap is at least 1; Without is at most 0.
  assert.deepEqual(genes.map((_, i) => passesNeighborSiteFilter(model, i, 'with')), kept({ min: 1, max: null }));
  assert.deepEqual(genes.map((_, i) => passesNeighborSiteFilter(model, i, 'without')), kept({ min: null, max: 0 }));
  assert.equal(normalizeNeighborSiteCountFilter({ min: null, max: null }), null);
  assert.equal(normalizeNeighborSiteCountFilter({ min: -1, max: 2.5 }), null);
  assert.deepEqual(normalizeNeighborSiteCountFilter({ min: 3, max: 'x' }), { min: 3, max: null });
});

test('saved state: a count range round-trips and an old categorical value is never rewritten', () => {
  assert.equal(encodeNeighborSiteCountFilter({ min: 2, max: null }), '2:');
  assert.equal(encodeNeighborSiteCountFilter(null), null);
  assert.deepEqual(decodeNeighborSiteCountFilter(':3'), { min: null, max: 3 });
  assert.equal(decodeNeighborSiteCountFilter('a:b'), null);
  const state = { ...defaultState(), neighborSiteFilter: 'with', neighborSiteCountFilter: { min: 2, max: 4 } };
  const hash = encodeState(state);
  assert.match(hash, /(^|&)ns=with(&|$)/);
  assert.match(hash, /(^|&)nc=2%3A4(&|$)/);
  const restored = applyDecoded(defaultState(), decodeState(hash));
  assert.equal(restored.neighborSiteFilter, 'with');
  assert.deepEqual(restored.neighborSiteCountFilter, { min: 2, max: 4 });
  const old = applyDecoded(defaultState(), decodeState('#ver=8&ns=without'));
  assert.equal(old.neighborSiteFilter, 'without', 'the old choice keeps its own meaning');
  assert.equal(old.neighborSiteCountFilter, null, 'and does not become a count range');
  assert.ok(!encodeState(defaultState()).includes('nc='));
  assert.deepEqual(viewStateOf(state).neighborSiteCountFilter, { min: 2, max: 4 });
  assert.equal(clearedFilterState().neighborSiteCountFilter, null);
  assert.notEqual(filterCriteriaSignature(state), filterCriteriaSignature({ ...state, neighborSiteCountFilter: null }),
    'editing the range ends a temporary bypass');
});

test('shipped data: colour and filter counts equal an independent enumeration', async () => {
  const read = async (file) => JSON.parse(await readFile(new URL(`../../site/data/${file}.json`, import.meta.url)));
  const base = { genes: await read('genes'), meta: await read('meta'), organism: DEFAULT_ORGANISM,
    tssSiteRecords: await read('tss_evidence'), regulatoryTss: await read('regulatory_tss') };
  const dataset = { ...base, neighborSites: buildNeighborSiteIndex(base) };
  const model = neighborSiteModel(dataset, { sources: ['TAN2018_TSS_CONTROL'] });
  assert.ok(model.available);
  const short = (seqid) => seqid.replace(/^NZ_/, '').split('.')[0];
  const inside = (focal, position) => short(focal.seqid) && (focal.cdsSegments ?? [[focal.start, focal.end]])
    .some(([a, b]) => position >= a && position <= b);
  const expected = dataset.genes.map((focal) => {
    const sites = new Set();
    for (const [owner, rows] of Object.entries(dataset.tssSiteRecords)) {
      if (owner === focal.id) continue;
      for (const row of rows) {
        if (short(focal.seqid) === row.replicon && inside(focal, row.position)) sites.add(`${row.type}:${row.strand}:${row.position}`);
      }
    }
    for (const row of dataset.regulatoryTss.rows) {
      if (row.mapping_status !== 'mapped' || row.source_locus_tag === focal.id) continue;
      if (short(focal.seqid) === row.replicon && inside(focal, Number(row.position))) sites.add(`${row.type}:${row.strand}:${row.position}`);
    }
    return sites.size;
  });
  assert.deepEqual([...model.siteCounts], expected, 'colour values');
  const metric = neighborSiteCountMetric(model);
  assert.ok(expected.every((count, i) => metric.read(i) === count));
  const atLeastTwo = expected.filter((count) => count >= 2).length;
  assert.equal(dataset.genes.filter((_, i) => passesNeighborSiteCountFilter(model, i, { min: 2, max: null })).length,
    atLeastTwo, 'count filter');
  assert.ok(atLeastTwo > 0, 'the shipped data has genes with several sites');
  assert.equal(Math.max(...expected) >= 2, true);
});

test('the Filters panel shows the saved range, reports edits, and offers Clear all for it', async () => {
  await withFakeDocument(async (document) => {
    const genes = [gene('none', '+', [[40, 50]]), gene('one', '+', [[10, 30]])];
    const model = modelFor(genes, [site(20, '+')]);
    const host = document.createElement('div');
    document.body.append(host);
    const ranges = [];
    const panel = new FilterPanel(host, {
      onChange: () => {}, onClear: () => {}, onExceptionFilterChange: () => {}, onExpressionFilterChange: () => {},
      onTrafficKeyChange: () => {}, onTrafficFollowChange: () => {}, onProteinFilterChange: () => {},
      onNeighborSiteCountFilterChange: (range) => ranges.push(range),
    });
    const registry = { metrics: [], byKey: new Map(), families: [] };
    const base = { registry, filters: {}, count: 2, passing: 1, missingHidden: new Map(), exceptionFilter: 'any',
      exceptionCount: 0, expressionFilter: 'any', basisCounts: { counts: new Map(), recorded: false },
      trafficKey: null, categoryFilter: [], proteinFilter: 'any', neighborSites: model };
    panel.update({ ...base, neighborSiteCountFilter: { min: 2, max: null } });
    const field = (bound) => host.querySelectorAll('input').find((input) => input.id === `neighbor-site-count-${bound}`);
    assert.equal(field('min').value, '2');
    assert.equal(field('max').value, '');
    assert.match(host.textContent, /Distinct sites in the CDS, both strands \(0 to 1 here\)/);
    const clear = host.querySelectorAll('button').find((button) => button.textContent === 'Clear all filters');
    assert.equal(clear.disabled, false, 'a count range alone is something to clear');
    field('max').value = '4';
    field('max').dispatch('change');
    assert.deepEqual(ranges.at(-1), { min: 2, max: 4 });
    field('min').value = '';
    field('max').value = '';
    field('max').dispatch('change');
    assert.equal(ranges.at(-1), null, 'two blank fields are no range');
    panel.update({ ...base, neighborSiteCountFilter: null });
    assert.equal(clear.disabled, true);
  });
});
