import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dataset } from './data-sources-fixture.mjs';
import { normalizeSelection } from '../../site/js/core/data-sources.js';
import { buildTypeMetrics, contributingDatasets, typeKeyFor } from '../../site/js/core/type-metrics.js';
import { createSourceSelectionResolver } from '../../site/js/core/source-selection.js';

const abundance = 'type.transcriptomics.rna-seq.abundance';

function fixtures() {
  return [
    dataset({ id: 'A', datasetId: 'A', metricKey: 'a', group: 'standard' }),
    dataset({ id: 'B', datasetId: 'B', metricKey: 'b', group: 'stress' }),
    dataset({ id: 'P', datasetId: 'P', metricKey: 'p', dataType: 'proteomics', platform: 'LC-MS/MS' }),
  ];
}

test('resolved membership matches uncached selection for defaults, subsets and named sources', () => {
  const all = fixtures();
  const resolve = createSourceSelectionResolver();
  for (const sources of [undefined, [], ['unknown'], ['B', 'A', 'A'], ['P'], ['A', 'B', 'P']]) {
    for (const named of [undefined, {}, { [abundance]: 'B' }, { [abundance]: 'P' }]) {
      const result = resolve(all, sources, named);
      assert.deepEqual(result.selection, normalizeSelection(sources, all));
      for (const key of [abundance, typeKeyFor(all[2]), 'type.unknown']) {
        assert.deepEqual(result.contributing(key), contributingDatasets(key, named, all, result.selection));
      }
    }
  }
});

test('selection, named source and catalogue replacement each refresh membership', () => {
  const all = fixtures();
  const resolve = createSourceSelectionResolver();
  const sources = ['A', 'B'];
  const names = {};
  const initial = resolve(all, sources, names);
  assert.equal(resolve(all, sources, names), initial);
  assert.throws(() => sources.push('P'), TypeError);
  assert.throws(() => { names[abundance] = 'B'; }, TypeError);
  assert.throws(() => all.pop(), TypeError);
  const ids = (result) => result.contributing(abundance).map((d) => d.id);
  assert.deepEqual(ids(resolve(all, ['B'], names)), ['B']);
  assert.deepEqual(ids(resolve(all, sources, { [abundance]: 'B' })), ['B']);
  assert.deepEqual(ids(resolve(all, sources, {})), ['A', 'B']);
  assert.deepEqual(ids(resolve([all[0]], sources, names)), ['A']);
  assert.deepEqual(ids(resolve(all, sources, names)), ['A', 'B']);
  assert.throws(() => initial.selection.push('P'), TypeError);
  assert.throws(() => initial.contributing(abundance).pop(), TypeError);
});

test('whole-genome reads reuse membership while late values and metric replacements remain live', () => {
  const all = fixtures();
  let catalogueReads = 0;
  for (const d of all) {
    const record = d.record;
    Object.defineProperty(d, 'record', { get: () => { catalogueReads += 1; return record; } });
  }
  const sources = ['A', 'B'];
  let names = {};
  const resolve = createSourceSelectionResolver();
  const values = { a: [1, 2, 3], b: [NaN, NaN, NaN] };
  const own = new Map(['a', 'b'].map((key) => [key, { key, read: (i) => values[key][i] }]));
  const metrics = buildTypeMetrics(all, {
    contributing: (key) => resolve(all, sources, names).contributing(key),
    metricOf: (d) => own.get(d.metricKey), geneCount: 3,
  });
  const metric = metrics.find((m) => m.key === abundance);
  assert.equal(metric.read(0), 1 / 6);
  const readsAfterFirst = catalogueReads;
  for (let i = 0; i < 2715; i += 1) metric.read(i % 3);
  assert.equal(catalogueReads, readsAfterFirst, 'gene reads must not rescan the source catalogue');
  // Unknown layers have no finite value and therefore no cached rank array.
  values.b = [30, 10, NaN];
  assert.equal(metric.read(0), ((1 / 6) + (3 / 4)) / 2);
  assert.equal(metric.read(2), 5 / 6, 'missing contributors never become zero');
  names = { [abundance]: 'B' };
  assert.equal(metric.read(0), 30);
  own.set('b', { key: 'b', read: () => 70 });
  assert.equal(metric.read(0), 70, 'a membership cache must not retain a registry metric');
  names = {};
  assert.equal(metric.read(0), ((1 / 6) + 0.5) / 2);
});

test('ratio membership stays separate from protein abundance', () => {
  const protein = fixtures()[2];
  const ratio = { ...protein, id: 'R', metricKey: 'r', source: { assay: 'protein abundance ratio' } };
  const result = createSourceSelectionResolver()([protein, ratio], ['P', 'R'], {});
  assert.deepEqual(result.contributing('type.proteomics.lc-ms-ms.abundance'), [protein]);
  assert.deepEqual(result.contributing('type.proteomics.lc-ms-ms.ratio'), [ratio]);
});
