/**
 * "Constrain a metric" ordering: native measured evidence must lead the list,
 * ahead of the bench-scientist defaults (CAI, tAI, and the rest), the same
 * priority the low-traffic threshold uses.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { constrainableMetrics } from '../../site/js/ui/panel-designer.js';

function metric(key, overrides = {}) {
  return {
    key,
    label: overrides.label ?? key,
    family: overrides.family ?? 'Other',
    source: overrides.source ?? 'pipeline',
    provenance: overrides.provenance ?? null,
  };
}

function registryOf(metrics) {
  return { metrics, byKey: new Map(metrics.map((m) => [m.key, m])) };
}

test('native measured evidence leads the constraint list, ahead of CAI/tAI', () => {
  const tss = metric('tssInitiation', {
    label: 'TSS initiation (UTEX 2973)', family: 'Expression',
    provenance: { id: 'TAN2018_TSS', isTargetOrganism: true },
  });
  const cai = metric('cai', { family: 'Translation' });
  const tai = metric('tai', { family: 'Translation' });
  const gc3 = metric('gc3', { family: 'Base composition' });
  const borrowed = metric('expression', {
    label: 'Expression (PCC 7942)', family: 'Expression',
    provenance: { id: 'GSE205444', isTargetOrganism: false },
  });

  const order = constrainableMetrics(registryOf([borrowed, gc3, cai, tai, tss]))
    .map((m) => m.key);
  assert.deepEqual(order, ['tssInitiation', 'cai', 'tai', 'gc3', 'expression']);
});

test('a live metric never appears, regardless of provenance', () => {
  const live = metric('liveThing', { source: 'live', provenance: { isTargetOrganism: true } });
  const cai = metric('cai', { family: 'Translation' });
  const order = constrainableMetrics(registryOf([live, cai])).map((m) => m.key);
  assert.deepEqual(order, ['cai']);
});
