/** Independent release-data enumeration; no production recoding/coordinate helper in the reference. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CodonTable } from '../../site/js/core/codon-table.js';
import { compileScheme } from '../../site/js/core/scheme.js';
import { DEFAULT_ORGANISM } from '../../site/js/core/organisms.js';
import { buildNeighborSiteIndex, neighborSiteModel } from '../../site/js/core/neighbor-sites.js';
import { tssRecodingModel } from '../../site/js/core/tss-recoding.js';

const DATA = new URL('../../site/data/', import.meta.url);
const LENGTHS = { 'NZ_CP006471.1': 2690418, 'NZ_CP006472.1': 46366, 'NZ_CP006473.1': 7842 };
const COMPLEMENT = { A: 'T', C: 'G', G: 'C', T: 'A' };
const sourceReplicon = (value) => value.replace(/^NZ_/, '').split('.')[0];
const identity = (site) => `${site.type}:${sourceReplicon(site.replicon)}:${site.position}:${site.strand}`;

async function release() {
  const read = async (name) => JSON.parse(await readFile(new URL(`${name}.json`, DATA), 'utf8'));
  const [genes, meta, tssSiteRecords, regulatoryTss] = await Promise.all([
    read('genes'), read('meta'), read('tss_evidence'), read('regulatory_tss'),
  ]);
  return { genes, meta, tssSiteRecords, regulatoryTss, organism: DEFAULT_ORGANISM,
    table: new CodonTable(meta.codonAlphabet) };
}

/** Enumerate actual source rows without consulting the production site index. */
function physicalSites(dataset) {
  const sites = new Map();
  const rows = [...Object.values(dataset.tssSiteRecords).flat(), ...dataset.regulatoryTss.rows];
  for (const row of rows) {
    const site = { type: row.type, replicon: row.replicon, position: Number(row.position), strand: row.strand };
    const key = identity(site);
    if (!sites.has(key)) sites.set(key, { ...site, ids: new Set() });
    sites.get(key).ids.add(row.id ?? row.tss_id);
  }
  return [...sites.values()];
}

/** Build sequence-position pairs directly from published intervals and alphabet. */
function referenceGene(gene, alphabet, sites, mode) {
  let segments = (gene.cdsSegments ?? [[gene.start, gene.end]])
    .map((segment) => [...segment]).sort((a, b) => a[0] - b[0]);
  if (segments.length > 1 && segments[0][0] === 1
    && segments.at(-1)[1] === LENGTHS[gene.seqid]) {
    segments = [...segments.slice(1), segments[0]];
  }
  const positions = segments.flatMap(([low, high]) => Array.from({ length: high - low + 1 }, (_, i) => low + i));
  if (gene.strand === '-') positions.reverse();
  const codons = [...gene.codons].map((symbol) => alphabet.get(symbol));
  if (gene.terminalStop) codons.push(gene.terminalStop);
  const original = codons.join('');
  assert.equal(positions.length, original.length, `reference length for ${gene.id}`);
  let tcgOccurrence = 0;
  const recoded = codons.map((codon, index) => {
    if (index === 0 || mode === 'identity') return codon;
    if (mode === 'alternating') {
      if (codon !== 'TCG') return codon;
      const replacement = tcgOccurrence % 2 === 0 ? 'TCC' : 'TCT';
      tcgOccurrence += 1;
      return replacement;
    }
    if (codon === 'TAG') return 'TAA';
    if (mode === 'syn61' && codon === 'TCG') return 'AGC';
    if (mode === 'syn61' && codon === 'TCA') return 'AGT';
    return codon;
  }).join('');
  const offsets = new Map(positions.map((position, offset) => [position, offset]));
  return sites.filter((site) => site.replicon === sourceReplicon(gene.seqid) && offsets.has(site.position))
    .map((site) => {
      const offset = offsets.get(site.position);
      const before = original[offset];
      const after = recoded[offset];
      const opposite = gene.strand !== site.strand;
      return { key: identity(site), ids: [...site.ids].sort(), original: before, recoded: after,
        siteOriginal: opposite ? COMPLEMENT[before] : before,
        siteRecoded: opposite ? COMPLEMENT[after] : after, edited: before !== after };
    }).sort((a, b) => a.key.localeCompare(b.key));
}

test('all shipped CDSs: exact TSS changes match independent source/sequence enumeration', async () => {
  const dataset = await release();
  dataset.neighborSites = buildNeighborSiteIndex(dataset);
  const evidence = neighborSiteModel(dataset, { sources: ['TAN2018_TSS_CONTROL'] });
  assert.equal(evidence.available, true);
  const sites = physicalSites(dataset);
  const alphabet = new Map(dataset.meta.codonAlphabet.map(({ sym, codon }) => [sym, codon]));
  const schemes = [
    ['identity', {}, 0, 0],
    ['amber', { TAG: 'TAA' }, 1, 1],
    ['syn61', { TCG: 'AGC', TCA: 'AGT', TAG: 'TAA' }, 35, 35],
    ['alternating', { TCG: [{ codon: 'TCC', share: 50 }, { codon: 'TCT', share: 50 }] }, null, null],
  ];
  for (const [mode, map, expectedEdits, expectedChangedGenes] of schemes) {
    const model = tssRecodingModel(dataset, compileScheme(map, dataset.table), { evidence });
    let evaluated = 0;
    let edited = 0;
    let changedGenes = 0;
    let emptyGenes = 0;
    for (const [index, gene] of dataset.genes.entries()) {
      const expected = referenceGene(gene, alphabet, sites, mode);
      const actual = model.forGene(gene);
      assert.equal(actual.status, 'evaluated', `${mode} ${gene.id}`);
      const actualSites = actual.sites.map((site) => ({ key: identity(site), ids: [...site.ids].sort(),
        original: site.original, recoded: site.recoded, siteOriginal: site.siteOriginal,
        siteRecoded: site.siteRecoded, edited: site.edited })).sort((a, b) => a.key.localeCompare(b.key));
      assert.deepEqual(actualSites, expected, `${mode} ${gene.id}: original coordinates and exact oriented bases`);
      const count = expected.filter((site) => site.edited).length;
      assert.equal(model.editedCounts[index], count, `${mode} ${gene.id}: numerator`);
      assert.equal(model.evaluatedCounts[index], expected.length, `${mode} ${gene.id}: denominator`);
      evaluated += expected.length;
      edited += count;
      changedGenes += Number(count > 0);
      emptyGenes += Number(expected.length === 0);
    }
    assert.equal(evaluated, 2773, 'site/gene observations, including sites shared by several CDSs');
    assert.equal(emptyGenes, 1139, 'zero recorded sites is separate from an unevaluated CDS');
    if (expectedEdits !== null) assert.equal(edited, expectedEdits, mode);
    if (expectedChangedGenes !== null) assert.equal(changedGenes, expectedChangedGenes, mode);
  }
});
