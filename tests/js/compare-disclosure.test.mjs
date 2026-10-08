import assert from 'node:assert/strict';
import test from 'node:test';

import { ComparePanel } from '../../site/js/ui/compare.js';
import { withFakeDocument } from './fake-dom.mjs';

const metric = {
  key: 'expressionLong',
  label: 'Long experimental measurement',
  family: 'Expression',
  unit: 'reads',
  provenance: {
    id: 'long-study',
    condition: 'two replicates under a deliberately long condition description for wrapping',
    coverage: { withValue: 1, total: 2 },
  },
  read: (index) => index === 0 ? 7 : NaN,
};

const dataset = {
  meta: { genome: { accession: 'fixture' } },
  genes: [{}, {}],
};

test('measurement limits use one closed live disclosure and disappear without limits', async () => {
  const previousResizeObserver = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  try {
    await withFakeDocument(async (document) => {
      const host = document.createElement('div');
      document.body.append(host);
      const panel = new ComparePanel(host, {});
      const disclosure = panel.measurementDetails;

      assert.equal(disclosure.tagName, 'details');
      assert.equal(disclosure.getAttribute('open'), null, 'closed in a fresh view');
      assert.equal(disclosure.querySelector('summary').textContent, 'Measurement Limits');
      assert.equal(disclosure.querySelector('p'), panel.measurementNote);

      panel.tab = 'delta';
      panel.registry = {
        families: ['Expression'], metrics: [metric], byKey: new Map([[metric.key, metric]]),
      };
      panel.state = { ids: ['candidate'], dataset };
      panel.renderMeasurementNote();
      assert.equal(disclosure.hidden, false);
      assert.match(panel.measurementNote.textContent, /^Measurement limits —/);
      assert.match(panel.measurementNote.textContent, /deliberately long condition description/);

      disclosure.open = true;
      metric.provenance.condition = 'an updated condition after the comparison changes';
      panel.renderMeasurementNote();
      assert.equal(panel.measurementDetails, disclosure, 'updates reuse the disclosure');
      assert.equal(disclosure.open, true, 'a live copy update does not close it');
      assert.match(panel.measurementNote.textContent, /updated condition/);

      panel.state = { ids: [], dataset };
      panel.renderMeasurementNote();
      assert.equal(disclosure.hidden, true, 'no limits leave no disclosure or layout gap');
      assert.equal(panel.measurementNote.textContent, '');
    });
  } finally {
    globalThis.ResizeObserver = previousResizeObserver;
  }
});
