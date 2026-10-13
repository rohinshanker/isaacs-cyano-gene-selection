import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_ORGANISM } from '../../site/js/core/organisms.js';
import { indexNativeSites, buildNeighborSiteIndex, neighborSiteModel, passesNeighborSiteFilter,
  neighborSiteOffset, describeNeighborSite } from '../../site/js/core/neighbor-sites.js';
import { defaultState, encodeState, decodeState, viewStateOf } from '../../site/js/core/url-state.js';
import { clearedFilterState } from '../../site/js/ui/filters.js';
const organism = { ...DEFAULT_ORGANISM, genome: { accession: 'GCF_test.1', replicons: [
  { accession: 'NZ_TEST.1', lengthBp: 100 }, { accession: 'NZ_OTHER.1', lengthBp: 100 },
] } };
const gene = (id, strand = '+', segments = null, seqid = 'NZ_TEST.1') => ({ id, strand, seqid,
  start: 10, end: 30, cdsSegments: segments });
const site = (position, locus = 'other', extra = {}) => ({ locus, layer: 'test', source: { doi: 'study' }, row: {
  id: `s${position}`, type: 'gTSS', position, replicon: 'TEST', strand: '+', ...extra,
} });
const modelFor = (genes, records) => neighborSiteModel({ genes, neighborSites: indexNativeSites(genes, records, organism) }, { sources: ['TAN2018_TSS_CONTROL'] });

test('inclusive segment union excludes outer padding and joined gaps on both strands', () => {
  const genes = [gene('focal', '+', [[10, 15], [25, 30]]), gene('reverse', '-', [[10, 15], [25, 30]])];
  const model = modelFor(genes, [9,10,15,16,24,25,30,31].map((bp) => site(bp)));
  for (const focal of genes) assert.deepEqual(model.forGene(focal).sites.map((row) => row.position), [10,15,25,30]);
  assert.equal(model.forGene(genes[0]).count, 4);
  assert.equal(neighborSiteOffset(genes[0], site(25).row), 15);
  assert.equal(neighborSiteOffset(genes[1], site(25).row), 5);
});

test('origin joins and exact native organism/assembly/replicon identity', () => {
  const focal = gene('wrap', '-', [[1, 5], [96, 100]]);
  const index = indexNativeSites([focal], [site(1), site(100), site(50),
    site(2, 'other', { replicon: 'OTHER' }), site(3, 'other', { assembly: 'GCF_test.2' }),
    site(4, 'other', { organismId: 'other' }), site(5, 'other', { replicon: 'NZ_TEST.2' }), site(101)], organism);
  assert.deepEqual(index.byGene.get('wrap').sites.map((row) => row.position), [1, 100]);
  assert.equal(neighborSiteOffset(gene('native-wrap', '-', [[1,5], [7840,7842]], 'NZ_CP006473.1'), { position: 1 }), 4);
  // The standard helper uses the declared actual replicon length; actual published origin cases are checked below.
});

test('self-only excluded, multiple associations retained, dedup conditions and provenance, orphan explicit', () => {
  const focal = gene('focal');
  const other = gene('other');
  const records = [site(10, 'focal'), site(11, 'focal'), site(11, 'other', { strand: '-' }),
    site(12, 'focal'), site(12, 'other'), site(12, 'other', { condition: 'dark', rawReads: { dark: [0, 2] } }),
    site(12, 'hidden-not-plotted'), site(13, null, { type: 'nTSS' })];
  const model = modelFor([focal, other], records);
  const relation = model.forGene(focal);
  assert.equal(relation.count, 2);
  const multi = relation.sites.find((row) => row.position === 12);
  assert.deepEqual(multi.associations.map((owner) => owner.id), ['focal', 'other', 'hidden-not-plotted']);
  assert.equal(multi.records.length, 4);
  assert.deepEqual(multi.records[2].row.rawReads.dark, [0, 2]);
  assert.equal(relation.unassigned[0].position, 13);
  assert.match(describeNeighborSite(multi, focal), /multiple associations/);
  assert.match(describeNeighborSite(relation.sites[0], focal), /opposite strand/);
  assert.equal(relation.count, model.forGene(focal).count, 'visibility is never an input');
});

test('one status drives filtering/counts/colour; unavailable remains distinct and narrowing suspended', () => {
  const genes = [gene('focal'), gene('self')];
  const model = modelFor(genes, [site(12, 'self')]);
  assert.deepEqual([...model.values], [1, 0]);
  assert.deepEqual(model.counts, [1,1,0]);
  assert.equal(passesNeighborSiteFilter(model, 0, 'with'), true);
  assert.equal(passesNeighborSiteFilter(model, 1, 'with'), false);
  assert.equal(passesNeighborSiteFilter(model, 1, 'without'), true);
  for (const options of [{ sources: [] }, { sources: ['TAN2018_TSS_DARK'], pending: 'loading' },
    { sources: ['TAN2018_TSS_HIGH_LIGHT'], pending: 'failed' },
    { sources: ['TAN2018_TSS_CONTROL'], sourcePending: 'failed' }]) {
    const unknown = neighborSiteModel({ genes, neighborSites: model.index }, options);
    assert.deepEqual([...unknown.values], [2,2]);
    assert.deepEqual(unknown.counts, [0,0,2]);
    assert.equal(unknown.forGene(genes[0]), null);
    assert.equal(unknown.marks.length, 0);
    assert.equal(passesNeighborSiteFilter(unknown, 1, 'without'), true);
    assert.equal(passesNeighborSiteFilter(unknown, 0, 'unavailable'), true);
  }
  for (const id of ['TAN2018_TSS_DARK', 'TAN2018_TSS', 'TAN2018_TSS_HIGH_TEMPERATURE']) {
    assert.deepEqual([...neighborSiteModel({ genes, neighborSites: model.index }, { sources: [id] }).values], [1,0]);
  }
});

test('saved filter round-trips, default/invalid values and clear follow the existing state contract', () => {
  for (const mode of ['any','with','without','unavailable']) {
    const state = { ...defaultState(), neighborSiteFilter: mode, colorBy: 'neighborTssOverlap' };
    assert.equal(decodeState(encodeState(state)).neighborSiteFilter ?? 'any', mode);
  }
  assert.equal(decodeState('#ns=wrong').neighborSiteFilter, undefined);
  assert.equal(clearedFilterState().neighborSiteFilter, 'any');
  assert.equal(viewStateOf({ ...defaultState(), neighborSiteFilter: 'with' }).neighborSiteFilter, 'with');
});

test('shipped full Tan inventory agrees with independent base membership, includes mapped non-gTSS and isolates other organisms', async () => {
  const read = async (file) => JSON.parse(await readFile(new URL(`../../site/data/${file}.json`, import.meta.url)));
  const dataset = { genes: await read('genes'), meta: await read('meta'), organism: DEFAULT_ORGANISM,
    tssSiteRecords: await read('tss_evidence'), regulatoryTss: await read('regulatory_tss') };
  const index = buildNeighborSiteIndex(dataset);
  assert.ok(index);
  let mappedRegulatory = 0;
  for (const focal of dataset.genes) {
    const expected = new Set();
    for (const [owner, rows] of Object.entries(dataset.tssSiteRecords)) {
      if (owner === focal.id) continue;
      for (const row of rows) if (focal.seqid.replace(/^NZ_/, '').split('.')[0] === row.replicon
        && (focal.cdsSegments ?? [[focal.start, focal.end]]).some(([a,b]) => row.position >= a && row.position <= b)) {
        expected.add(`${row.type}:${row.strand}:${row.position}`);
      }
    }
    for (const row of dataset.regulatoryTss.rows) {
      if (row.mapping_status !== 'mapped' || row.source_locus_tag === focal.id) continue;
      if (focal.seqid.replace(/^NZ_/, '').split('.')[0] === row.replicon
        && (focal.cdsSegments ?? [[focal.start, focal.end]]).some(([a,b]) => Number(row.position) >= a && Number(row.position) <= b)) {
        expected.add(`${row.type}:${row.strand}:${row.position}`);
      }
    }
    assert.equal(index.byGene.get(focal.id).count, expected.size, focal.id);
    mappedRegulatory += index.byGene.get(focal.id).sites.filter((row) => row.type !== 'gTSS').length;
    for (const row of index.byGene.get(focal.id).sites) assert.ok(Number.isFinite(neighborSiteOffset(focal, row)));
  }
  assert.equal(mappedRegulatory, 10);
  assert.equal(index.marks.length, 805);
  assert.equal([...index.byGene.values()].filter((entry) => entry.count > 0).length, 603);
  assert.equal(new Set(index.marks.map((mark) => mark.site.key)).size, 802);
  assert.equal(buildNeighborSiteIndex({ ...dataset, meta: { genome: { accession: 'other' } } }), null);
  assert.equal(buildNeighborSiteIndex({ ...dataset, regulatoryTss: null }), null);
});

test('unresolved native source association is explicit and never counted as another native gene', () => {
  const focal = gene('focal');
  const unresolved = { ...site(12, 'old-source-locus'), nativeAssociation: false };
  const model = modelFor([focal], [unresolved]);
  assert.equal(model.forGene(focal).count, 0);
  assert.equal(model.forGene(focal).unassigned.length, 1);
  assert.match(describeNeighborSite(model.forGene(focal).unassigned[0], focal), /unresolved native association/);
});
