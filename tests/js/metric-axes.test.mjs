import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_METRIC_AXES,
  DEFAULT_AXIS_SCALES,
  AXIS_SCALES,
  buildMetricAxesProjection,
  resolveDefaultMetricAxes,
  log10Availability,
  metricLog10Availability,
  log10DisabledReason,
  axisScaleName,
  axisTitle,
  axisTitleSuffix,
  isDiagonalAxisPair,
  axesUnavailableMessage,
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

test('linear stays the default scale and leaves values untouched', () => {
  assert.deepEqual(DEFAULT_AXIS_SCALES, { x: 'linear', y: 'linear' });
  assert.deepEqual(AXIS_SCALES, ['linear', 'log10', 'percentile']);
  const registry = registryOf([
    metric('lengthNt', 'CDS length', 'nt', [300, 600, 900]),
    metric('cai', 'CAI', 'index', [0.4, 0.6, 0.8]),
  ]);
  const projection = buildMetricAxesProjection(registry, 3, { x: 'lengthNt', y: 'cai' });

  assert.equal(projection.x.scale, 'linear');
  assert.equal(projection.y.scale, 'linear');
  assert.deepEqual([...projection.x.values], [300, 600, 900]);
  assert.equal(axisTitle(projection.x), 'CDS length (nt)');
});

test('log10 transforms strictly positive values and names the scale in the title', () => {
  const registry = registryOf([
    metric('lengthNt', 'CDS length', 'nt', [10, 100, 1000]),
  ]);
  const projection = buildMetricAxesProjection(
    registry, 3, { x: 'lengthNt', y: 'lengthNt' }, { x: 'log10', y: 'linear' },
  );

  assert.equal(projection.x.scale, 'log10');
  assert.deepEqual([...projection.x.values], [1, 2, 3]);
  assert.equal(axisTitle(projection.x), 'CDS length, log10');
  assert.equal(axisScaleName('log10'), 'log10');
});

test('log10 is unavailable when a metric has a zero or negative finite value, and reports the count', () => {
  const values = [10, 0, -5, 20, NaN];
  const availability = log10Availability(values);
  assert.equal(availability.available, false);
  assert.equal(availability.finiteCount, 4);
  assert.equal(availability.nonPositiveCount, 2);
  assert.equal(
    log10DisabledReason('GC skew', availability),
    'log10 is unavailable for GC skew: 2 values are zero or negative.',
  );

  const registry = registryOf([
    metric('gcSkew', 'GC skew', 'index', values),
  ]);
  assert.equal(
    metricLog10Availability(registry.byKey.get('gcSkew'), values.length).available, false,
  );
  // A requested log10 axis on a metric that cannot take it falls back to
  // linear instead of turning every gene into an unavailable NaN.
  const projection = buildMetricAxesProjection(
    registry, values.length, { x: 'gcSkew', y: 'gcSkew' }, { x: 'log10', y: 'linear' },
  );
  assert.equal(projection.x.scale, 'linear');
  assert.equal(projection.x.requestedScale, 'log10');
  assert.deepEqual([...projection.x.values], values.map((v) => (Number.isFinite(v) ? v : NaN)));
});

test('a metric with only positive finite values allows log10, and disabled reason is null', () => {
  const availability = log10Availability([1, 2, NaN, 3]);
  assert.equal(availability.available, true);
  assert.equal(log10DisabledReason('CDS length', availability), null);
});

test('percentile ranks the visible cohort, not the whole dataset, and still ranks a hidden gene', () => {
  const registry = registryOf([
    metric('tss', 'TSS initiation', 'counts', [10, 20, 30, 40, 100]),
  ]);
  // Genes 0-3 are visible; gene 4 (value 100, the maximum) is filtered out but
  // still gets a coordinate, ranked against the visible cohort only.
  const mask = Uint8Array.from([1, 1, 1, 1, 0]);
  const projection = buildMetricAxesProjection(
    registry, 5, { x: 'tss', y: 'tss' }, { x: 'percentile', y: 'linear' }, mask,
  );

  const [p0, p1, p2, p3, p4] = projection.x.values;
  assert.equal(p0, 12.5);
  assert.equal(p1, 37.5);
  assert.equal(p2, 62.5);
  assert.equal(p3, 87.5);
  // Ranked against [10, 20, 30, 40]: 100 is above every visible value.
  assert.equal(p4, 100);
  assert.equal(axisTitle(projection.x), 'TSS initiation, percentile');
});

test('percentile leaves missing values as NaN and drops out of the finite pair count', () => {
  const registry = registryOf([
    metric('tss', 'TSS initiation', 'counts', [10, NaN, 30]),
  ]);
  const projection = buildMetricAxesProjection(
    registry, 3, { x: 'tss', y: 'tss' }, { x: 'percentile', y: 'percentile' }, null,
  );
  assert.ok(Number.isNaN(projection.x.values[1]));
  assert.equal(projection.finitePairCount, 2);
});

test('an unmeasured axis stays unavailable under every scale', () => {
  const registry = registryOf([metric('cai', 'CAI', 'index', [0.4, 0.6])]);
  for (const scale of AXIS_SCALES) {
    const projection = buildMetricAxesProjection(
      registry, 2, { x: 'notShipped', y: 'cai' }, { x: scale, y: 'linear' },
    );
    assert.equal(projection.x.available, false);
    assert.deepEqual([...projection.x.values], [NaN, NaN]);
  }
});

test('axisTitleSuffix isolates the scale/unit tail so a renderer can shorten only the name', () => {
  const registry = registryOf([
    metric('lengthNt', 'CDS length', 'nt', [10, 100, 1000]),
  ]);
  const linear = buildMetricAxesProjection(registry, 3, { x: 'lengthNt', y: 'lengthNt' });
  assert.equal(axisTitleSuffix(linear.x), ' (nt)');
  assert.equal(axisTitle(linear.x), `CDS length${axisTitleSuffix(linear.x)}`);

  const log = buildMetricAxesProjection(
    registry, 3, { x: 'lengthNt', y: 'lengthNt' }, { x: 'log10', y: 'linear' },
  );
  assert.equal(axisTitleSuffix(log.x), ', log10');
  assert.equal(axisTitle(log.x), `CDS length${axisTitleSuffix(log.x)}`);
});

test('an empty percentile cohort is a distinct, explicit axis state, not a missing measurement', () => {
  const registry = registryOf([
    metric('lengthNt', 'CDS length', 'nt', [100, 200, 300]),
  ]);
  // Every row is filtered out: the reference cohort to rank against is empty,
  // even though every gene has a finite raw length.
  const mask = Uint8Array.from([0, 0, 0]);
  const projection = buildMetricAxesProjection(
    registry, 3, { x: 'lengthNt', y: 'lengthNt' }, { x: 'percentile', y: 'linear' }, mask,
  );

  assert.equal(projection.x.percentileCohortEmpty, true);
  assert.deepEqual([...projection.x.values], [NaN, NaN, NaN]);
  // The other axis has a real cohort (percentile ranking is per-axis, not
  // shared), so it must not be flagged empty just because its sibling is.
  assert.equal(projection.y.percentileCohortEmpty, false);

  assert.equal(
    axesUnavailableMessage(projection),
    'No visible genes remain to rank CDS length by percentile. Relax the filters to restore a ranking cohort.',
  );
});

test('a non-empty cohort is never reported as an empty one, and a real gap keeps the generic message', () => {
  const registry = registryOf([
    metric('tss', 'TSS initiation', 'counts', [10, 20, 30]),
  ]);
  const nonEmpty = buildMetricAxesProjection(
    registry, 3, { x: 'tss', y: 'tss' }, { x: 'percentile', y: 'linear' },
  );
  assert.equal(nonEmpty.x.percentileCohortEmpty, false);
  assert.equal(axesUnavailableMessage(nonEmpty), null);

  const registryTwo = registryOf([
    metric('a', 'Metric A', 'nt', [1, NaN]),
    metric('b', 'Metric B', 'nt', [NaN, 1]),
  ]);
  const disjoint = buildMetricAxesProjection(registryTwo, 2, { x: 'a', y: 'b' });
  assert.equal(disjoint.finitePairCount, 0);
  assert.equal(
    axesUnavailableMessage(disjoint),
    'No genes have values on both selected axes. Choose another pair of metrics.',
  );
});

test('an unavailable metric reports its own message ahead of any cohort or pairing reason', () => {
  const registry = registryOf([metric('cai', 'CAI', 'index', [0.4, 0.6])]);
  const projection = buildMetricAxesProjection(registry, 2, { x: 'notShipped', y: 'cai' });
  assert.equal(
    axesUnavailableMessage(projection),
    'A selected metric is unavailable in this dataset. Choose another axis.',
  );
});

test('identical axis keys are a diagonal only when both axes also share their effective scale', () => {
  const registry = registryOf([
    metric('tss', 'TSS initiation', 'counts', [10, 20, 30, 40]),
  ]);
  const sameScale = buildMetricAxesProjection(
    registry, 4, { x: 'tss', y: 'tss' }, { x: 'linear', y: 'linear' },
  );
  assert.equal(isDiagonalAxisPair(sameScale), true);

  const differentScale = buildMetricAxesProjection(
    registry, 4, { x: 'tss', y: 'tss' }, { x: 'percentile', y: 'linear' },
  );
  assert.equal(isDiagonalAxisPair(differentScale), false);

  const differentKeys = buildMetricAxesProjection(
    registryOf([
      metric('tss', 'TSS initiation', 'counts', [10, 20, 30, 40]),
      metric('lengthNt', 'CDS length', 'nt', [1, 2, 3, 4]),
    ]),
    4,
    { x: 'tss', y: 'lengthNt' },
  );
  assert.equal(isDiagonalAxisPair(differentKeys), false);
});
