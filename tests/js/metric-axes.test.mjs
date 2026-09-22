import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_METRIC_AXES,
  buildMetricAxesProjection,
  resolveDefaultMetricAxes,
} from '../../site/js/core/metric-axes.js';

function registryOf(metrics) {
  return { metrics, byKey: new Map(metrics.map((metric) => [metric.key, metric])) };
}

function metric(key, label, unit, values, extra = {}) {
  return { key, label, unit, read: (index) => values[index], ...extra };
}

/** A metric declared as a measurement made in this organism. */
function nativeMeasurement(key, label, values) {
  return metric(key, label, 'counts', values, {
    family: 'Expression',
    provenance: { organism: 'Synechococcus elongatus UTEX 2973', isTargetOrganism: true },
  });
}

/** A metric declared as a measurement made in another strain. */
function borrowedMeasurement(key, label, values) {
  return metric(key, label, 'counts', values, {
    family: 'Expression',
    provenance: { organism: 'Synechococcus elongatus PCC 7942', isTargetOrganism: false },
  });
}

test('defaults to CDS length versus measured UTEX evidence and preserves registry units', () => {
  const registry = registryOf([
    metric('lengthNt', 'CDS length', 'nt', [300, 600]),
    metric('cai', 'CAI', 'index', [0.4, 0.8]),
    nativeMeasurement('tssInitiation', 'TSS initiation (UTEX 2973)', [12, 40]),
  ]);
  const projection = buildMetricAxesProjection(registry, 2);

  assert.deepEqual(DEFAULT_METRIC_AXES, { x: 'lengthNt', y: 'tssInitiation' });
  assert.deepEqual(resolveDefaultMetricAxes(registry), { x: 'lengthNt', y: 'tssInitiation' });
  assert.equal(projection.x.key, 'lengthNt');
  assert.equal(projection.x.label, 'CDS length');
  assert.equal(projection.x.unit, 'nt');
  assert.equal(projection.y.key, 'tssInitiation');
  assert.equal(projection.y.label, 'TSS initiation (UTEX 2973)');
  assert.equal(projection.y.unit, 'counts');
  assert.deepEqual([...projection.x.values], [300, 600]);
  assert.deepEqual([...projection.y.values], [12, 40]);
  assert.equal(projection.finitePairCount, 2);
  assert.equal(projection.available, true);
});

test('a requested CAI axis is still built exactly as asked', () => {
  const registry = registryOf([
    metric('lengthNt', 'CDS length', 'nt', [300, 600]),
    metric('cai', 'CAI', 'index', [0.4, 0.8]),
    nativeMeasurement('tssInitiation', 'TSS initiation (UTEX 2973)', [12, 40]),
  ]);
  const projection = buildMetricAxesProjection(registry, 2, { x: 'lengthNt', y: 'cai' });

  assert.equal(projection.y.key, 'cai');
  assert.deepEqual([...projection.y.values], [0.4, 0.8]);
  assert.equal(projection.available, true);
});

test('a borrowed measurement is the default only when no native one is published', () => {
  const registry = registryOf([
    metric('lengthNt', 'CDS length', 'nt', [300, 600]),
    metric('cai', 'CAI', 'index', [0.4, 0.8]),
    borrowedMeasurement('expression', 'Expression (PCC 7942)', [5, 9]),
  ]);

  assert.deepEqual(resolveDefaultMetricAxes(registry), { x: 'lengthNt', y: 'expression' });
});

test('a native measurement outranks a borrowed one whatever order they are declared in', () => {
  const registry = registryOf([
    metric('lengthNt', 'CDS length', 'nt', [300, 600]),
    borrowedMeasurement('expression', 'Expression (PCC 7942)', [5, 9]),
    nativeMeasurement('futureNativeAssay', 'Native assay (UTEX 2973)', [1, 2]),
  ]);

  assert.deepEqual(resolveDefaultMetricAxes(registry), { x: 'lengthNt', y: 'futureNativeAssay' });
});

test('with no measurement published the default Y is still not a codon-usage convention', () => {
  const registry = registryOf([
    metric('lengthNt', 'CDS length', 'nt', [300, 600]),
    metric('cai', 'CAI', 'index', [0.4, 0.8]),
    metric('tai', 'tAI', 'index', [0.3, 0.5]),
    metric('gc3', 'GC3', 'fraction', [0.5, 0.6]),
  ]);

  assert.deepEqual(resolveDefaultMetricAxes(registry), { x: 'lengthNt', y: 'gc3' });
});

test('a dataset publishing only conventions falls back rather than drawing nothing', () => {
  const registry = registryOf([metric('cai', 'CAI', 'index', [0.4, 0.8])]);

  assert.deepEqual(resolveDefaultMetricAxes(registry), { x: 'cai', y: 'cai' });
  assert.deepEqual(resolveDefaultMetricAxes({ metrics: [], byKey: new Map() }),
    { x: 'lengthNt', y: 'tssInitiation' });
});

test('keeps every row slot and counts only finite X/Y pairs', () => {
  const registry = registryOf([
    metric('x', 'X', 'x-unit', [1, NaN, 3, 4]),
    metric('y', 'Y', 'y-unit', [10, 20, NaN, 40]),
  ]);
  const projection = buildMetricAxesProjection(registry, 4, { x: 'x', y: 'y' });

  assert.ok(projection.x.values instanceof Float64Array);
  assert.ok(projection.y.values instanceof Float64Array);
  assert.equal(projection.x.values.length, 4);
  assert.equal(projection.y.values.length, 4);
  assert.deepEqual([...projection.x.values], [1, NaN, 3, 4]);
  assert.deepEqual([...projection.y.values], [10, 20, NaN, 40]);
  assert.equal(projection.finitePairCount, 2);
});

test('supports equal axes without changing row order or finite counts', () => {
  const registry = registryOf([
    metric('gc', 'GC content', 'fraction', [0.2, NaN, 0.7]),
  ]);
  const projection = buildMetricAxesProjection(registry, 3, { x: 'gc', y: 'gc' });

  assert.deepEqual([...projection.x.values], [0.2, NaN, 0.7]);
  assert.deepEqual([...projection.y.values], [0.2, NaN, 0.7]);
  assert.equal(projection.finitePairCount, 2);
  assert.equal(projection.x.unit, 'fraction');
  assert.equal(projection.y.unit, 'fraction');
});

test('represents an unavailable metric as NaN rows instead of throwing', () => {
  const registry = registryOf([
    metric('cai', 'CAI', 'index', [0.4, 0.6, 0.8]),
  ]);
  const projection = buildMetricAxesProjection(
    registry,
    3,
    { x: 'notShipped', y: 'cai' },
  );

  assert.equal(projection.available, false);
  assert.equal(projection.x.available, false);
  assert.equal(projection.x.metric, null);
  assert.equal(projection.x.label, 'notShipped');
  assert.equal(projection.x.unit, '');
  assert.deepEqual([...projection.x.values], [NaN, NaN, NaN]);
  assert.deepEqual([...projection.y.values], [0.4, 0.6, 0.8]);
  assert.equal(projection.finitePairCount, 0);
});

test('an empty projection is typed, available, and has no finite pairs', () => {
  const registry = registryOf([
    metric('lengthNt', 'CDS length', 'nt', []),
    nativeMeasurement('tssInitiation', 'TSS initiation (UTEX 2973)', []),
  ]);
  const projection = buildMetricAxesProjection(registry, 0);

  assert.ok(projection.x.values instanceof Float64Array);
  assert.ok(projection.y.values instanceof Float64Array);
  assert.equal(projection.x.values.length, 0);
  assert.equal(projection.y.values.length, 0);
  assert.equal(projection.finitePairCount, 0);
  assert.equal(projection.available, true);
});
