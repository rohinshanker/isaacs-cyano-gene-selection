import assert from 'node:assert/strict';
import test from 'node:test';

import { loadDataset } from '../../site/js/core/dataset.js';
import { SidePanel } from '../../site/js/ui/side-panel.js';
import { withFakeDocument } from './fake-dom.mjs';
import { fileFetch } from './helpers.mjs';

const DATA = new URL('../../site/data/', import.meta.url);

test('function-category detail is collapsed while GO context keeps its own presentation', async () => {
  const dataset = await loadDataset({ baseUrl: DATA, fetchImpl: fileFetch() });
  const index = dataset.genes.findIndex((gene) => gene.id === 'M744_RS00005');
  assert.notEqual(index, -1);
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    document.body.append(host);
    const panel = new SidePanel(host, { onShortlistToggle() {}, onUnpin() {} });
    const update = (geneIndex) => panel.update({
      index: geneIndex, isPinned: false, dataset,
      registry: { families: [], metrics: [] }, percentileOf: () => NaN,
      schemeActive: false, live: {}, inShortlist: false,
      colorSources: ['utex-2973', 'pcc-7942', 'go-iea'],
    });
    update(index);

    const category = host.querySelector('.function-category-block');
    assert.ok(category);
    assert.equal(category.parentNode.tagName, 'details');
    assert.ok(category.parentNode.hasClass('tan-disclosure'));
    assert.equal(category.parentNode.open, undefined);
    assert.equal(category.parentNode.querySelector('summary').textContent,
      'Function category / information');
    assert.match(category.textContent, /probability/);

    const goContextIndex = dataset.genes.findIndex((gene) => gene.id === 'M744_RS00725');
    assert.notEqual(goContextIndex, -1);
    update(goContextIndex);
    const goContext = host.querySelector('.candidate-go-context');
    assert.ok(goContext);
    assert.ok(!goContext.parentNode.hasClass('tan-disclosure'));
    assert.notEqual(goContext.parentNode.querySelector('summary')?.textContent,
      'Function category / information');
  });
});

test('native neighbour disclosure keeps open state and focus through preview and unrelated updates', async () => {
  const dataset = await loadDataset({ baseUrl: DATA, fetchImpl: fileFetch() });
  const index = dataset.genes.findIndex((gene) => gene.id === 'M744_RS00005');
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    document.body.append(host);
    const panel = new SidePanel(host, { onOpenPartner() {} });
    const update = (geneIndex) => panel.update({
      index: geneIndex, isPinned: false, dataset,
      registry: { families: [], metrics: [] }, percentileOf: () => NaN,
      schemeActive: false, live: {}, inShortlist: false,
      colorSources: ['utex-2973', 'pcc-7942', 'go-iea'],
    });
    update(index);
    let details = host.querySelector('details.gene-neighbours');
    details.open = true;
    details.querySelector('summary').focus();
    update(index);
    details = host.querySelector('details.gene-neighbours');
    assert.equal(details.open, true);
    assert.strictEqual(document.activeElement, details.querySelector('summary'));
    assert.match(details.textContent, /rRNA \(noncoding gene\)/);
    assert.ok(details.querySelector('.gene-neighbour-noncoding'));
    update(index + 1);
    details = host.querySelector('details.gene-neighbours');
    assert.equal(details.open, true);
    assert.equal(details.querySelector('.gene-neighbours-schematic').querySelector('strong').getAttribute('aria-label'),
      'M744_RS00010, focal transcription direction');
    assert.strictEqual(document.activeElement, details.querySelector('summary'));
  });
});
