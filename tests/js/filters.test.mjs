/**
 * Low-traffic threshold ordering: a rule from the data contract, not a UI
 * accident. A metric actually measured in this organism must outrank any
 * other real measurement (a borrowed one included), which must in turn
 * outrank this genome's own codon-adaptation proxy, which must outrank any
 * remaining expression evidence (a proxy rank derived from one of the above).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  orderTrafficCandidates, defaultTrafficCandidate, clearedFilterState,
} from '../../site/js/ui/filters.js';

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
  assert.deepEqual(order, ['tssInitiation', 'expression', 'cai', 'tai', 'expressionProxy']);
});

test('a borrowed real measurement outranks CAI/tAI even with no native evidence present', () => {
  const cai = metric('cai', { family: 'Translation' });
  const tai = metric('tai', { family: 'Translation' });
  const borrowed = metric('expression', {
    label: 'Expression (PCC 7942)', family: 'Expression',
    provenance: { id: 'GSE205444', isTargetOrganism: false },
  });
  const percentile = metric('expressionPercentile', {
    label: 'Expression percentile (PCC 7942)', family: 'Expression',
    provenance: { id: 'GSE205444', isTargetOrganism: false },
  });

  const order = orderTrafficCandidates(registryOf([cai, tai, percentile, borrowed]))
    .map((m) => m.key);
  assert.deepEqual(order, ['expressionPercentile', 'expression', 'cai', 'tai']);
});

test('default choice remains a local proxy when only borrowed measurements lead the menu', () => {
  const borrowed = metric('expression', {
    family: 'Expression', provenance: { isTargetOrganism: false },
  });
  const cai = metric('cai', { family: 'Translation' });
  const tai = metric('tai', { family: 'Translation' });
  const candidates = orderTrafficCandidates(registryOf([borrowed, tai, cai]));
  assert.equal(candidates[0].key, 'expression');
  assert.equal(defaultTrafficCandidate(candidates)?.key, 'cai');
});

test('borrowed-only evidence requires an explicit selection', () => {
  const borrowed = metric('expression', {
    family: 'Expression', provenance: { isTargetOrganism: false },
  });
  assert.equal(defaultTrafficCandidate([borrowed]), null);
});

test('a genome-derived expression proxy is safe when CAI and tAI are absent', () => {
  const borrowed = metric('expression', {
    family: 'Expression', provenance: { isTargetOrganism: false },
  });
  const proxy = metric('expressionProxy', { label: 'Expression proxy rank' });
  assert.equal(defaultTrafficCandidate([borrowed, proxy])?.key, 'expressionProxy');
});

test('native evidence defaults ahead of local proxies', () => {
  const tss = metric('tssInitiation', {
    family: 'Expression', provenance: { isTargetOrganism: true },
  });
  const cai = metric('cai', { family: 'Translation' });
  assert.equal(defaultTrafficCandidate([tss, cai])?.key, 'tssInitiation');
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
