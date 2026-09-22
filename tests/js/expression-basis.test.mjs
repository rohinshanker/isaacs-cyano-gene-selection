/**
 * Expression basis and colour-ramp family: two contract rules the site must not
 * guess at. A proxy rank is never presented as a measurement, and a ramp family
 * comes from the dataset's declaration rather than from the metric's direction.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  expressionBasisOf, expressionBasisCounts, isExpressionMetric, isExpressionProxyMetric,
  buildMetricRegistry, EXPRESSION_BASES,
} from '../../site/js/core/metric-registry.js';
import { buildColorScale, CATEGORICAL } from '../../site/js/ui/colors.js';
import { describeRamp, describeBasisCounts } from '../../site/js/ui/legend.js';
import { LIVE_METRICS } from '../../site/js/core/live-metrics.js';
import { encodeState, decodeState } from '../../site/js/core/url-state.js';

test('a measured gene names its source; a proxy gene says it is standing in', () => {
  const measured = expressionBasisOf({ expressionBasis: 'measured', expressionSourceId: 'GSE205444' });
  assert.equal(measured.basis, 'measured');
  assert.match(measured.text, /GSE205444/);

  const proxy = expressionBasisOf({ expressionBasis: 'proxy' });
  assert.equal(proxy.basis, 'proxy');
  assert.match(proxy.short, /proxy/);
  assert.match(proxy.text, /different quantity in a different unit/);
});

test('an absent basis is an explicit unknown, never assumed to be measured', () => {
  // The contract's null: neither a measurement nor a proxy exists.
  assert.equal(expressionBasisOf({ expressionBasis: null }).basis, 'none');
  // A dataset that predates the field. This is the live case until the pipeline
  // lands, and it must not be silently read as a measurement.
  const unrecorded = expressionBasisOf({ expression: 1284.6 });
  assert.equal(unrecorded.basis, 'unrecorded');
  assert.match(unrecorded.text, /does not record/);
  assert.equal(expressionBasisOf(null).basis, 'unrecorded');
  // A value the site does not know is reported as unknown rather than accepted.
  assert.equal(expressionBasisOf({ expressionBasis: 'imputed' }).basis, 'unrecorded');
});

test('basis counts cover every gene and report whether the field exists at all', () => {
  const genes = [
    { expressionBasis: 'measured' }, { expressionBasis: 'measured' },
    { expressionBasis: 'proxy' }, { expressionBasis: null },
  ];
  const { counts, recorded } = expressionBasisCounts(genes);
  assert.equal(recorded, true);
  assert.equal(counts.get('measured'), 2);
  assert.equal(counts.get('proxy'), 1);
  assert.equal(counts.get('none'), 1);
  let total = 0;
  for (const basis of EXPRESSION_BASES) total += counts.get(basis);
  assert.equal(total, genes.length);

  // A dataset with no basis field at all: a measured-only filter would be a lie,
  // so `recorded` is false and the interface hides the control.
  const older = expressionBasisCounts([{ expression: 1 }, { expression: null }]);
  assert.equal(older.recorded, false);
  assert.equal(older.counts.get('unrecorded'), 2);
  assert.equal(describeBasisCounts(older), null);
});

test('the basis summary counts each state in plain language', () => {
  const text = describeBasisCounts(expressionBasisCounts([
    { expressionBasis: 'measured' }, { expressionBasis: 'proxy' }, { expressionBasis: null },
  ]));
  assert.match(text, /1 measured/);
  assert.match(text, /1 proxy only/);
  assert.match(text, /1 with neither/);
});

test('a native TSS metric is measured by its own finite value, never by the PCC proxy state', () => {
  const tss = {
    key: 'tssInitiation', label: 'TSS initiation (UTEX 2973)',
    provenance: { id: 'TAN2018_TSS', isTargetOrganism: true },
    tssEvidenceSource: { pooledScoreSourceId: 'TAN2018_TSS' },
  };
  // A PCC-proxy gene (no PCC measurement) that does carry a native TSS value
  // must show that TSS value as measured, not inherit the PCC "proxy only" tag.
  const proxyGeneWithTss = { expressionBasis: 'proxy', tssInitiation: 4.2 };
  const tssMeasured = expressionBasisOf(proxyGeneWithTss, tss, 4.2);
  assert.equal(tssMeasured.basis, 'measured');
  assert.match(tssMeasured.text, /TAN2018_TSS/);

  // A gene with a real PCC measurement but no TSS score must not borrow the
  // PCC "measured" state either: TSS is absent for it, plainly.
  const measuredGeneNoTss = {
    expressionBasis: 'measured', expressionSourceId: 'GSE205444', tssEvidence: [],
  };
  const tssAbsent = expressionBasisOf(measuredGeneNoTss, tss, NaN);
  assert.equal(tssAbsent.basis, 'none');
  assert.notEqual(tssAbsent.basis, 'proxy');
  assert.match(tssAbsent.short, /no pooled score or mapped site/);

  // The primary PCC metric itself is unaffected: it still reads its own
  // gene-level basis and never the metric-scoped logic.
  const pcc = { key: 'expression', label: 'Expression' };
  const pccBasis = expressionBasisOf(proxyGeneWithTss, pcc, NaN);
  assert.equal(pccBasis.basis, 'proxy');
});

test('TSS mismatch wording follows provenance when the metric key or source id is renamed', () => {
  for (const { key, sourceId } of [
    { key: 'renamedTssScore', sourceId: 'TAN2018_TSS' },
    { key: 'tssInitiation', sourceId: 'RENAMED_TSS_SOURCE' },
  ]) {
    const genes = [{ [key]: 12.5, tssEvidence: [] }];
    const meta = {
      metrics: { [key]: { label: 'Renamed TSS score', family: 'Expression' } },
      expressionSources: [{ id: sourceId, metricKey: key, isTargetOrganism: true }],
      tssEvidenceSource: { pooledScoreSourceId: sourceId },
    };
    const metric = buildMetricRegistry(meta, genes, {}).byKey.get(key);
    const basis = expressionBasisOf(genes[0], metric, metric.read(0));
    assert.match(basis.short, /pooled score; no exact Table S1 site/);
    assert.match(basis.text, new RegExp(sourceId));
  }
});

test('a TSS legend counts TSS coverage, not the PCC field it happens to sit beside', () => {
  const tss = {
    key: 'tssInitiation', label: 'TSS initiation',
    provenance: { id: 'TAN2018_TSS' },
    tssEvidenceSource: { pooledScoreSourceId: 'TAN2018_TSS' },
    read: (i) => genes[i].tssInitiation,
  };
  const genes = [
    { expressionBasis: 'measured', tssInitiation: 1 },
    { expressionBasis: 'proxy', tssInitiation: 2 },
    { expressionBasis: 'proxy', tssInitiation: NaN },
    { expressionBasis: 'measured', tssInitiation: NaN },
  ];
  const pccCounts = expressionBasisCounts(genes);
  assert.equal(pccCounts.counts.get('measured'), 2);
  assert.equal(pccCounts.counts.get('proxy'), 2);

  const tssCounts = expressionBasisCounts(genes, tss);
  assert.equal(tssCounts.counts.get('measured'), 2);
  assert.equal(tssCounts.counts.get('proxy'), 0);
  assert.equal(tssCounts.counts.get('none'), 2);
});

test('the proxy metric is told apart from a measured one', () => {
  const proxy = { key: 'expressionProxy', label: 'Expression proxy', unit: 'rank 0-1', family: 'Expression' };
  const measured = { key: 'expression', label: 'Expression', unit: 'normalized counts', family: 'Expression' };
  assert.equal(isExpressionMetric(proxy), true);
  assert.equal(isExpressionProxyMetric(proxy), true);
  assert.equal(isExpressionProxyMetric(measured), false);
  assert.equal(isExpressionMetric({ key: 'gc3', label: 'GC3', unit: 'fraction' }), false);
});

test('only a measured metric carries the borrowed-measurement warning', () => {
  const meta = {
    expressionSource: { organismMeasured: 'PCC 7942', isTargetOrganism: false },
    metrics: {
      expression: { label: 'Expression', unit: 'normalized counts', family: 'Expression', desc: 'x' },
      expressionProxy: { label: 'Expression proxy', unit: 'rank 0-1', family: 'Expression', desc: 'y' },
    },
  };
  const genes = [{ expression: 5, expressionProxy: 0.4 }, { expression: 6, expressionProxy: 0.5 }];
  const registry = buildMetricRegistry(meta, genes, {});
  assert.ok(registry.byKey.get('expression').provenance);
  // The proxy is computed from this genome, so it carries no foreign-source notice.
  assert.equal(registry.byKey.get('expressionProxy').provenance, undefined);
});

test('the declared ramp family is used, and an undeclared one is marked inferred', () => {
  const signed = [-2, -1, 0, 1, 2];
  const unsigned = [1, 2, 3, 4];

  const declaredDiverging = buildColorScale(unsigned, { scale: 'diverging' });
  assert.equal(declaredDiverging.diverging, true);
  assert.equal(declaredDiverging.scaleSource, 'declared');

  // A declared sequential ramp wins even over signed data: the dataset decides.
  const declaredSequential = buildColorScale(signed, { scale: 'sequential' });
  assert.equal(declaredSequential.diverging, false);
  assert.equal(declaredSequential.scaleSource, 'declared');

  const inferred = buildColorScale(signed, { scale: null });
  assert.equal(inferred.diverging, true);
  assert.equal(inferred.scaleSource, 'inferred');
  assert.equal(buildColorScale(unsigned, {}).scaleSource, 'inferred');
  // An unrecognised declaration is not trusted; it falls back to inference.
  assert.equal(buildColorScale(signed, { scale: 'rainbow' }).scaleSource, 'inferred');
});

test('the ramp note says which family and where the choice came from', () => {
  const metric = { label: 'ΔGC3' };
  const declared = describeRamp(metric, buildColorScale([-1, 1], { scale: 'diverging' }));
  assert.match(declared, /diverging/);
  assert.match(declared, /as the dataset declares/);
  // Colour reads a value; it never claims a direction is good.
  assert.match(declared, /does not say whether high is good/);
  const inferred = describeRamp(metric, buildColorScale([1, 2], {}));
  assert.match(inferred, /inferred/);
});

test('a metric direction is never consulted when choosing a ramp', () => {
  // `direction` is documentation in the contract. Passing it must change nothing.
  const values = [1, 2, 3];
  const plain = buildColorScale(values, { scale: 'sequential' });
  const withDirection = buildColorScale(values, { scale: 'sequential', direction: 'higher-is-better' });
  assert.equal(plain.diverging, withDirection.diverging);
  assert.equal(plain.color(2), withDirection.color(2));
});

test('a missing value has a distinct colour, not a ramp position', () => {
  const scale = buildColorScale([1, 2, 3], { scale: 'sequential' });
  assert.notEqual(scale.color(NaN), scale.color(2));
  assert.equal(scale.bucketOf(NaN), -1);
});

test('every live metric declares its own ramp family', () => {
  for (const metric of LIVE_METRICS) {
    assert.ok(['sequential', 'diverging'].includes(metric.scale), `${metric.key} declares no scale`);
  }
  // A signed change reads on a diverging ramp; a magnitude does not.
  const byKey = new Map(LIVE_METRICS.map((metric) => [metric.key, metric]));
  assert.equal(byKey.get('dCai').scale, 'diverging');
  assert.equal(byKey.get('targetCount').scale, 'sequential');
});

test('a registry metric exposes the declared scale, defaulting to null not a guess', () => {
  const meta = {
    metrics: {
      cps: { label: 'Codon-pair score', unit: 'log odds', desc: 'x', scale: 'diverging' },
      gc3: { label: 'GC3', unit: 'fraction', desc: 'y' },
    },
  };
  const registry = buildMetricRegistry(meta, [{ cps: -0.1, gc3: 0.6 }], {});
  assert.equal(registry.byKey.get('cps').scale, 'diverging');
  assert.equal(registry.byKey.get('gc3').scale, null);
});

test('the measured-only choice survives a shared link', () => {
  const state = {
    panel: 'native', colorBy: 'gc3', schemeMap: {}, schemeName: '', filters: {},
    shortlist: [], pinnedId: null, compareTab: 'radar', showHidden: true,
    exceptionFilter: 'any', expressionFilter: 'measured',
  };
  const decoded = decodeState(`#${encodeState(state)}`);
  assert.equal(decoded.expressionFilter, 'measured');
  // The default is not written into the link, and an unknown mode is ignored.
  assert.ok(!encodeState({ ...state, expressionFilter: 'any' }).includes('m='));
  assert.equal(decodeState('#m=nonsense').expressionFilter, undefined);
});

test('the categorical palette is long enough for the lab’s largest panel', () => {
  assert.ok(CATEGORICAL.length >= 10);
});
