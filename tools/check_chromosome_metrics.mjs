/**
 * Replay the chromosome's whole-gene measurement reads against shipped data.
 * node tools/check_chromosome_metrics.mjs [--uncached] [--max-ms=100]
 * The optional bound applies to a warm sweep, not disk I/O or application boot.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildCoreDataset, DATA_APPLIERS } from '../site/js/core/dataset.js';
import { datasetsFrom, defaultSelection, normalizeSelection } from '../site/js/core/data-sources.js';
import { buildMetricRegistry, metricValues } from '../site/js/core/metric-registry.js';
import { buildTypeMetrics, contributingDatasets, typeGroups } from '../site/js/core/type-metrics.js';
import { createSourceSelectionResolver } from '../site/js/core/source-selection.js';

const uncached = process.argv.includes('--uncached');
const bound = Number(process.argv.find((arg) => arg.startsWith('--max-ms='))?.split('=')[1] ?? Infinity);
assert.ok(bound > 0, '--max-ms must be positive');
const stages = {};
const parsed = {};
for (const name of ['meta', 'genes', 'function-categories-v1', 'expression_layers']) {
  const raw = await readFile(new URL(`../site/data/${name}.json`, import.meta.url), 'utf8');
  const start = performance.now();
  parsed[name] = JSON.parse(raw);
  stages[`parse ${name}`] = performance.now() - start;
}
let start = performance.now();
const dataset = buildCoreDataset(parsed.meta, parsed.genes, parsed['function-categories-v1']);
stages.coreApplication = performance.now() - start;
start = performance.now();
DATA_APPLIERS.expressionLayers(dataset, parsed.expression_layers);
stages.expressionApplication = performance.now() - start;
const all = datasetsFrom(dataset.meta);
const registry = buildMetricRegistry(dataset.meta, dataset.genes, {});
const defaults = defaultSelection(all);
const groups = typeGroups(all);
const results = [];
for (const key of [
  'type.proteomics.lc-ms-ms.abundance',
  'type.transcriptomics.rna-seq.initiation',
  'type.transcriptomics.rna-seq.abundance',
]) {
  const ids = groups.get(key).datasets.map((d) => d.id);
  const choices = [['default', defaults]];
  if (ids.length > 1) {
    for (const count of [...new Set([1, 4, ids.length])]) {
      choices.push([String(count), [...defaults.filter((id) => !ids.includes(id)), ...ids.slice(0, count)]]);
    }
  }
  for (const [name, sources] of choices) {
    const named = {};
    const resolve = createSourceSelectionResolver();
    const contributing = uncached
      ? (type) => contributingDatasets(type, named, all, normalizeSelection(sources, all))
      : (type) => resolve(all, sources, named).contributing(type);
    const metric = buildTypeMetrics(all, {
      contributing, metricOf: (d) => registry.byKey.get(d.metricKey), geneCount: dataset.genes.length,
    }).find((m) => m.key === key);
    start = performance.now();
    const first = metricValues(metric, dataset.genes.length);
    const firstMs = performance.now() - start;
    const times = [];
    for (let pass = 0; pass < 5; pass += 1) {
      start = performance.now();
      assert.deepEqual(metricValues(metric, dataset.genes.length), first);
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const medianMs = times[2];
    assert.ok(medianMs <= bound, `${key}/${name}: ${medianMs.toFixed(1)} ms exceeds ${bound} ms`);
    results.push({
      key, selection: name, contributors: contributing(key).map((d) => d.id),
      firstMs, medianMs,
      sha256: createHash('sha256').update(new Uint8Array(first.buffer)).digest('hex'),
    });
  }
}
console.log(JSON.stringify({ uncached, genes: dataset.genes.length, stages, results }, null, 2));
