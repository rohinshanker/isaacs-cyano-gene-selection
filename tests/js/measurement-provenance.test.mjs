import { test } from 'node:test';
import assert from 'node:assert/strict';
import { declaredMeasurementSources, describeExpressionSource } from '../../site/js/core/metric-registry.js';
import { renderMeasurementSources } from '../../site/js/ui/measurement-provenance.js';
import { withFakeDocument } from './fake-dom.mjs';
import { fixtureDataset } from './helpers.mjs';

const sources = [
  { id: 'RNA.1', organism: 'PCC 7942', isTargetOrganism: false, units: 'CPM', condition: 'low light', caveat: 'Transferred by exact shared-protein match.' },
  { id: 'PXD.2', organism: 'PCC 7942', isTargetOrganism: false, units: 'spectral counts', condition: 'log phase', coverage: { total: 2715, withValue: 576 } },
];

test('per-condition declarations take precedence over legacy metadata, including an explicit empty list', () => {
  const legacy = { accession: 'OLD', organismMeasured: 'legacy organism' };
  assert.equal(declaredMeasurementSources({ expressionSources: sources, expressionSource: legacy }), sources);
  assert.deepEqual(declaredMeasurementSources({ expressionSource: legacy }), [legacy]);
  assert.deepEqual(declaredMeasurementSources({ expressionSources: [], expressionSource: legacy }), []);
  assert.deepEqual(declaredMeasurementSources({}), []);
  assert.deepEqual(declaredMeasurementSources(null), []);
});

test('the provenance disclosure carries every source with its own units, condition and caveat', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    renderMeasurementSources(host, sources);
    assert.equal(host.querySelector('summary').textContent, 'View measurement sources (2)');
    const lines = host.querySelectorAll('li').map((node) => node.textContent);
    assert.deepEqual(lines, sources.map((source) => describeExpressionSource(source, (value) => value.toLocaleString('en-US'))));
    assert.match(lines[0], /low light.*CPM.*RNA\.1.*Transferred/);
    assert.match(lines[1], /log phase.*spectral counts.*576 of 2,715.*PXD\.2/);
  });
});

test('the loaded dataset exposes the complete declaration array in provenance', async () => {
  const data = await fixtureDataset();
  assert.deepEqual(data.provenance.expressionSources, declaredMeasurementSources(data.meta));
});
