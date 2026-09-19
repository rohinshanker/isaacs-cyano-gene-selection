import assert from 'node:assert/strict';
import test from 'node:test';

import {
  trafficThresholdLabel, trafficThresholdReadout,
} from '../../site/js/ui/filters.js';
import { foldInputsInvalidateResult } from '../../site/js/ui/folding-panel.js';
import { metricFamilyStartsOpen } from '../../site/js/ui/side-panel.js';

test('activity threshold copy preserves metric capitalization and avoids calling proxies measured', () => {
  const metric = { label: 'CAI', unit: 'index', integer: false };
  assert.equal(trafficThresholdLabel(metric), 'Hide genes below: CAI (index)');
  assert.equal(
    trafficThresholdReadout(metric, 0.348, 2715, 2715),
    '0.348 index — keeps 2,715 of 2,715 genes with a value',
  );
});

test('folding inputs are not called stale before the first folding request', () => {
  assert.equal(foldInputsInvalidateResult('[[],""]', '[["gene"],""]', false), false);
  assert.equal(foldInputsInvalidateResult(undefined, '[["gene"],""]', true), false);
  assert.equal(foldInputsInvalidateResult('[[],""]', '[["gene"],""]', true), true);
});

test('scheme-only metric families stay collapsed until a scheme is active', () => {
  assert.equal(metricFamilyStartsOpen('Size', false), true);
  assert.equal(metricFamilyStartsOpen('Translation', false), true);
  assert.equal(metricFamilyStartsOpen('Recoding load', false), false);
  assert.equal(metricFamilyStartsOpen('Change from wild type', false), false);
  assert.equal(metricFamilyStartsOpen('Recoding load', true), true);
  assert.equal(metricFamilyStartsOpen('Change from wild type', true), true);
});
