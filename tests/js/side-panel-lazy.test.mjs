import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SidePanel } from '../../site/js/ui/side-panel.js';
import { withFakeDocument } from './fake-dom.mjs';

const shippedGenes = JSON.parse(
  readFileSync(new URL('../../site/data/genes.json', import.meta.url)),
);

function disclosure(host, family) {
  return host.querySelector(`details[data-disclosure="metric:${family}"]`);
}

test('closed metric families defer current values and percentiles until opened', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    document.body.append(host);
    const reads = new Map();
    const percentiles = new Map();
    const values = {
      Size: [100, 101],
      Fitness: [200, 201],
      Other: [300, 301],
    };
    const metric = (family) => ({
      key: family.toLowerCase(),
      label: `${family} value`,
      desc: `${family} description`,
      unit: 'unit',
      family,
      read: (index) => {
        reads.set(family, (reads.get(family) ?? 0) + 1);
        return values[family][index];
      },
    });
    const registry = {
      families: ['Size', 'Fitness', 'Other'],
      metrics: ['Size', 'Fitness', 'Other'].map(metric),
    };
    const panel = new SidePanel(host, { onShortlistToggle() {}, onUnpin() {} });
    const update = (index) => panel.update({
      index,
      isPinned: false,
      dataset: { genes: shippedGenes.slice(0, 2), meta: {}, files: {} },
      registry,
      percentileOf: (key, value) => {
        percentiles.set(key, (percentiles.get(key) ?? 0) + 1);
        return value / 1000;
      },
      schemeActive: false,
      live: {},
      inShortlist: false,
      colorSources: [],
    });

    update(0);
    assert.equal(reads.get('Size'), 1, 'the default-open family is current immediately');
    assert.equal(percentiles.get('size'), 1);
    assert.equal(reads.has('Fitness'), false, 'a closed family does no metric work');
    assert.equal(percentiles.has('fitness'), false, 'a closed family prepares no percentile');
    assert.equal(disclosure(host, 'Fitness').querySelector('table.metric-table'), null);

    const fitness = disclosure(host, 'Fitness');
    const summary = fitness.querySelector('summary');
    summary.focus();
    fitness.open = true;
    fitness.dispatch('toggle');
    assert.equal(document.activeElement, summary, 'opening the family keeps focus on its summary');
    assert.equal(reads.get('Fitness'), 1);
    assert.equal(percentiles.get('fitness'), 1);
    assert.match(fitness.querySelector('table.metric-table').textContent, /200/);
    fitness.dispatch('toggle');
    assert.equal(reads.get('Fitness'), 1, 'a delivered duplicate toggle cannot rebuild the table');

    values.Fitness[1] = 909;
    update(1);
    const currentFitness = disclosure(host, 'Fitness');
    assert.equal(currentFitness.open, true, 'the reader\'s expanded state survives a gene change');
    assert.match(currentFitness.querySelector('table.metric-table').textContent, /909/,
      'an expanded family reads the current gene and late value');
    assert.equal(reads.get('Fitness'), 2);
    assert.equal(percentiles.get('fitness'), 2);

    const staleOther = disclosure(host, 'Other');
    update(0);
    staleOther.open = true;
    staleOther.dispatch('toggle');
    assert.equal(staleOther.querySelector('table.metric-table'), null,
      'a detached queued toggle cannot build obsolete rows');
    assert.equal(panel.disclosureState.has('metric:Other'), false,
      'a detached queued toggle cannot change the current disclosure state');
    assert.equal(reads.has('Other'), false);

    values.Other[0] = 707;
    const currentOther = disclosure(host, 'Other');
    currentOther.open = true;
    currentOther.dispatch('toggle');
    assert.match(currentOther.querySelector('table.metric-table').textContent, /707/,
      'the attached disclosure reads the current source value when opened');
    assert.equal(reads.get('Other'), 1);
    assert.equal(percentiles.get('other'), 1);
  });
});
