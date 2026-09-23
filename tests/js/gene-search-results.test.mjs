/**
 * The search result list must render every matching row. Its data assembly is
 * a pure model so a removed binding fails here before it throws in the page,
 * and the DOM wrapper is exercised through a fake document for the same reason.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { loadDataset } from '../../site/js/core/dataset.js';
import { searchGenes } from '../../site/js/core/gene-search.js';
import { GeneSearchResults, searchRowModel } from '../../site/js/ui/gene-search-results.js';
import { fileFetch } from './helpers.mjs';
import { withFakeDocument } from './fake-dom.mjs';

const DATA = new URL('../../site/data/', import.meta.url);
const PSAC = 'M744_RS00265';
const RBFA = 'M744_RS01175';

let cached = null;
async function realDataset() {
  if (!cached) cached = await loadDataset({ baseUrl: DATA, fetchImpl: fileFetch() });
  return cached;
}

function handlers({ pinnedId = null, shortlist = [] } = {}) {
  const calls = { pin: [], shortlist: [] };
  return {
    calls,
    isPinned: (id) => id === pinnedId,
    isShortlisted: (id) => shortlist.includes(id),
    onPin: (index) => calls.pin.push(index),
    onShortlist: (index) => calls.shortlist.push(index),
  };
}

function firstHit(dataset, query) {
  return searchGenes(dataset.genes, query, { goTerms: dataset.goTerms?.terms }).shown[0];
}

test('the row model carries identity, match, product, and action wording from the gene itself', async () => {
  const dataset = await realDataset();
  const row = searchRowModel(firstHit(dataset, 'psaC'), handlers());
  assert.equal(row.geneId, PSAC);
  assert.equal(row.symbol, 'psaC');
  assert.equal(row.matched, ' matched gene name');
  assert.equal(row.product, 'photosystem I iron-sulfur center protein PsaC');
  assert.equal(row.goLine, null);
  assert.equal(row.categoryLine, null);
  assert.deepEqual(row.labels, { pin: 'Pin', shortlist: 'Shortlist' });
  assert.equal(row.pinned, false);
  assert.equal(row.shortlisted, false);
  assert.match(row.pinDescription, /^Pin M744_RS00265 in the gene panel\. /);
  assert.match(row.shortlistDescription, /^Add M744_RS00265 to the shortlist\. /);

  const active = searchRowModel(firstHit(dataset, RBFA), handlers({ pinnedId: RBFA, shortlist: [RBFA] }));
  assert.equal(active.geneId, RBFA);
  assert.equal(active.matched, ' matched locus tag');
  assert.deepEqual(active.labels, { pin: 'Unpin', shortlist: 'Remove' });
  assert.match(active.pinDescription, /^Unpin M744_RS01175 from the gene panel\. /);
  assert.match(active.shortlistDescription, /^Remove M744_RS01175 from the shortlist\. /);
});

test('GO, alias, category, and missing-product hits each shape their own lines', async () => {
  const dataset = await realDataset();
  const go = searchRowModel(firstHit(dataset, 'GO:0009522'), handlers());
  assert.equal(go.matched, ' matched GO ID');
  assert.equal(go.goLine, 'GO:0009522 — photosystem I (IEA computational suggestion)');

  const alias = searchRowModel(firstHit(dataset, 'ribosome-binding'), handlers());
  assert.equal(alias.matched, ' matched product via ribosome');

  const gene = { id: 'M744_RS99999', name: null, product: undefined };
  const synthetic = searchRowModel({
    gene, index: 7, matchedOn: 'reviewed function category', alias: null,
    categoryMatch: 'Stress and repair',
    goMatch: {
      id: 'GO:0000001', name: null, evidenceCode: 'IEA', mappingAmbiguity: true, isObsolete: true,
    },
  }, handlers());
  assert.equal(synthetic.index, 7);
  assert.equal(synthetic.symbol, null);
  assert.equal(synthetic.product, 'no product description');
  assert.equal(synthetic.categoryLine, 'Lab-reviewed category: Stress and repair');
  assert.equal(synthetic.goLine, 'GO:0000001 (IEA computational suggestion; mapping ambiguous; '
    + 'obsolete GO ID in the pinned name release)');
});

test('every matching row renders through the DOM wrapper with its product and both actions', async () => {
  const dataset = await realDataset();
  await withFakeDocument(async (document) => {
    const host = document.createElement('div');
    const handled = handlers({ shortlist: [RBFA] });
    const results = new GeneSearchResults(host, handled);
    results.setGenes(dataset.genes, dataset.goTerms?.terms, dataset);

    for (const [query, id, product] of [
      ['psaC', PSAC, 'photosystem I iron-sulfur center protein PsaC'],
      [RBFA, RBFA, '30S ribosome-binding factor RbfA'],
      ['GO:0009522', 'M744_RS00905', 'photosystem I reaction center subunit PsaK'],
    ]) {
      const result = results.search(query);
      assert.ok(result.total >= 1, `${query} matches`);
      assert.equal(host.hidden, false);
      const rows = host.querySelectorAll('li.search-result');
      assert.equal(rows.length, result.shown.length, `${query} renders every shown row`);
      const row = rows.find((item) => item.querySelector('button[data-search-action="pin"]').dataset.geneId === id);
      assert.ok(row, `${query} renders ${id}`);
      assert.ok(row.textContent.includes(product), `${query} shows the product`);
      const pin = row.querySelector('button[data-search-action="pin"]');
      const shortlist = row.querySelector('button[data-search-action="shortlist"]');
      assert.equal(pin.textContent, 'Pin');
      assert.equal(shortlist.textContent, id === RBFA ? 'Remove' : 'Shortlist');
      assert.equal(shortlist.getAttribute('aria-pressed'), String(id === RBFA));
      assert.match(pin.getAttribute('aria-label'), new RegExp(`^Pin ${id} in the gene panel`));
    }

    // The buttons call back with the gene's dataset index, which the app uses to pin.
    results.search('psaC');
    const index = dataset.indexById.get(PSAC);
    host.querySelector('button[data-search-action="pin"]').dispatch('click');
    host.querySelector('button[data-search-action="shortlist"]').dispatch('click');
    assert.deepEqual(handled.calls, { pin: [index], shortlist: [index] });

    // Re-rendering the same query keeps rendering rows rather than throwing.
    results.refresh();
    assert.equal(host.querySelectorAll('li.search-result').length, 1);
    assert.equal(results.search(''), null);
    assert.equal(host.hidden, true);
  });
});
