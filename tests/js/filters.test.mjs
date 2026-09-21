/**
 * Low-traffic threshold ordering: a rule from the data contract, not a UI
 * accident. A metric actually measured in this organism must outrank this
 * genome's own codon-adaptation proxy, which must outrank any other
 * expression evidence, including a borrowed measurement.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderTrafficCandidates, clearedFilterState } from '../../site/js/ui/filters.js';

function metric(key, overrides = {}) {
  return {
    key,
    label: overrides.label ?? key,
    family: overrides.family ?? 'Other',
    provenance: overrides.provenance ?? null,
  };
}

function registryOf(metrics) {
  return { metrics, byKey: new Map(metrics.map((m) => [m.key, m])) };
}

test('native measured evidence outranks this genome\'s own CAI/tAI proxies', () => {
  const tss = metric('tssInitiation', {
    label: 'TSS initiation (UTEX 2973)', family: 'Expression',
    provenance: { id: 'TAN2018_TSS', isTargetOrganism: true },
  });
  const cai = metric('cai', { family: 'Translation' });
  const tai = metric('tai', { family: 'Translation' });
  const borrowed = metric('expression', {
    label: 'Expression (PCC 7942)', family: 'Expression',
    provenance: { id: 'GSE205444', isTargetOrganism: false },
  });
  const proxy = metric('expressionProxy', { label: 'Expression proxy rank' });

  const order = orderTrafficCandidates(registryOf([borrowed, proxy, cai, tai, tss]))
    .map((m) => m.key);
  assert.deepEqual(order, ['tssInitiation', 'cai', 'tai', 'expression', 'expressionProxy']);
});

test('a future native measurement is preferred automatically, by provenance alone', () => {
  // No code change should be needed for a second native source to win the same
  // priority as TSS initiation: the ranking reads `provenance.isTargetOrganism`,
  // never a fixed key.
  const futureNative = metric('transcriptAbundance', {
    label: 'Transcript abundance (UTEX 2973)', family: 'Expression',
    provenance: { id: 'FUTURE_SOURCE', isTargetOrganism: true },
  });
  const cai = metric('cai', { family: 'Translation' });

  const order = orderTrafficCandidates(registryOf([cai, futureNative])).map((m) => m.key);
  assert.deepEqual(order, ['transcriptAbundance', 'cai']);
});

test('with no CAI/tAI in the registry, native evidence still comes first and nothing crashes', () => {
  const tss = metric('tssInitiation', {
    family: 'Expression', provenance: { id: 'TAN2018_TSS', isTargetOrganism: true },
  });
  const borrowed = metric('expression', {
    family: 'Expression', provenance: { id: 'GSE205444', isTargetOrganism: false },
  });
  const order = orderTrafficCandidates(registryOf([borrowed, tss])).map((m) => m.key);
  assert.deepEqual(order, ['tssInitiation', 'expression']);
});

test('with no expression evidence at all, the candidate list is simply empty', () => {
  const gc3 = metric('gc3', { family: 'Base composition' });
  assert.deepEqual(orderTrafficCandidates(registryOf([gc3])), []);
});

test('clearing filters also clears the remembered traffic-metric choice', () => {
  assert.equal(clearedFilterState().trafficKey, null);
});
