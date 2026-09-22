import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EVIDENCE_TIERS, THRESHOLDS, TIER_LABELS, contextLabelFor, discrepancyCell,
  essentialityEvidenceFor, goContextText, resolveEssentialityTier, validateGoIeaEssentiality,
} from '../../site/js/core/go-iea-essentiality.js';
import { loadDataset } from '../../site/js/core/dataset.js';
import { fileFetch } from './helpers.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../../site/data/${name}`, import.meta.url)));
const data = read('go-iea-essentiality-v1.json');
const candidate = read('candidate_evidence.json');
const genes = read('genes.json');
const release = data.annotationRelease;

test('precedence is tested allele > PCC call > GO IEA context > unknown', () => {
  const cases = [
    [{ tested: true, pccStatus: 'non-essential', goLabel: 'core-cellular-process' },
      'tested-utex-allele'],
    [{ tested: false, pccStatus: 'essential', goLabel: 'core-cellular-process' },
      'admitted-pcc-call'],
    [{ tested: false, pccStatus: 'beneficial', goLabel: null }, 'admitted-pcc-call'],
    [{ tested: false, pccStatus: 'non-essential', goLabel: 'not-core' }, 'admitted-pcc-call'],
    [{ tested: false, pccStatus: 'unknown', goLabel: 'core-cellular-process' },
      'go-iea-context'],
    [{ tested: false, pccStatus: 'ambiguous', goLabel: 'core-cellular-process' },
      'go-iea-context'],
    [{ tested: false, pccStatus: 'missing', goLabel: 'uncertain' }, 'unknown'],
    [{ tested: false, pccStatus: 'unknown', goLabel: null }, 'unknown'],
  ];
  for (const [input, tier] of cases) assert.equal(resolveEssentialityTier(input), tier);
  assert.deepEqual(EVIDENCE_TIERS, data.policy.precedence);
});

test('context labels are re-derived from probabilities at the pinned thresholds', () => {
  assert.deepEqual(data.policy.thresholds, THRESHOLDS);
  assert.equal(contextLabelFor(1), 'core-cellular-process');
  assert.equal(contextLabelFor(THRESHOLDS.coreProbabilityAtLeast), 'core-cellular-process');
  assert.equal(contextLabelFor(THRESHOLDS.coreProbabilityAtLeast - 0.01), 'uncertain');
  assert.equal(contextLabelFor(THRESHOLDS.notCoreProbabilityAtMost + 0.01), 'uncertain');
  assert.equal(contextLabelFor(THRESHOLDS.notCoreProbabilityAtMost), 'not-core');
  assert.equal(contextLabelFor(0), 'not-core');
  for (const row of Object.values(data.byLocus)) {
    if (row.goContext) assert.equal(row.goContext.label, contextLabelFor(row.goContext.pCore));
    for (const entry of row.discrepancies) {
      if (entry.kind === 'pcc7942-call') assert.equal(entry.probability, null);
      else assert.ok(entry.probability >= THRESHOLDS.discrepancyProbabilityAtLeast);
    }
  }
});

test('the pinned file agrees with candidate evidence for every CDS', () => {
  assert.equal(validateGoIeaEssentiality(data, genes, candidate, release), data);
  const tiers = Object.values(data.byLocus).reduce((counts, row) => {
    counts[row.tier] = (counts[row.tier] ?? 0) + 1;
    return counts;
  }, {});
  assert.deepEqual(tiers, data.counts.byTier);
});

test('each tier and discrepancy case has explicit display wording', () => {
  const tested = essentialityEvidenceFor(data, 'M744_RS01270');
  assert.equal(tested.tierLabel, TIER_LABELS['tested-utex-allele']);
  assert.equal(tested.tierRank, 1);
  const pcc = essentialityEvidenceFor(data, 'M744_RS00005');
  assert.equal(pcc.tier, 'admitted-pcc-call');
  assert.equal(pcc.tierRank, 2);
  const fallback = essentialityEvidenceFor(data, 'M744_RS08250');
  assert.equal(fallback.tier, 'go-iea-context');
  assert.equal(fallback.tierRank, 3);
  assert.match(fallback.goContextText, /computational inference/);
  assert.match(fallback.goContextText, /not a knockout result/);
  const unknown = essentialityEvidenceFor(data, 'M744_RS03575');
  assert.equal(unknown.tier, 'unknown');
  assert.equal(unknown.tierRank, 4);
  assert.match(unknown.goContextText, /borderline/);
  assert.match(unknown.goContextText, /not evidence of non-essentiality/);
  const nbla = essentialityEvidenceFor(data, 'M744_RS05510');
  assert.deepEqual(nbla.discrepancies.map((entry) => entry.kind), ['utex-product', 'pcc7942-product']);
  assert.match(discrepancyCell(nbla), /phycobilisome degradation protein NblA/);
  assert.match(discrepancyCell(nbla), /SYNPCC7942_RS10785, whose text is identical/);
  assert.equal(nbla.discrepancies[1].probability, nbla.discrepancies[0].probability);
  const hemh = essentialityEvidenceFor(data, 'M744_RS13955');
  assert.equal(hemh.discrepancies.length, 2);
  assert.equal(discrepancyCell(hemh).split(' | ').length, 2);
  assert.equal(essentialityEvidenceFor(null, 'M744_RS00005'), null);
  assert.equal(essentialityEvidenceFor(data, 'MISSING'), null);
  assert.equal(discrepancyCell(null), '');
});

test('context wording covers absent, core, uncertain, and not-core GO terms', () => {
  assert.match(goContextText({ goContext: null }), /No GO IEA terms/);
  assert.match(goContextText({ goContext: { label: 'core-cellular-process', pCore: 0.97 } }),
    /core cellular process \(TypeSafe Jev core-process probability 0.97\)/);
  assert.match(goContextText({ goContext: { label: 'uncertain', pCore: 0.5 } }), /borderline/);
  assert.match(goContextText({ goContext: { label: 'not-core', pCore: 0.01 } }),
    /do not place it in a core cellular process/);
});

test('stale, unattributed, or inconsistent files fail closed', () => {
  const clone = () => structuredClone(data);
  const expect = (mutate, pattern, evidence = candidate) => {
    const changed = clone();
    mutate(changed);
    assert.throws(() => validateGoIeaEssentiality(changed, genes, evidence, release), pattern);
  };
  assert.throws(() => validateGoIeaEssentiality(null, genes, candidate, release), /release/);
  assert.throws(() => validateGoIeaEssentiality(data, genes, candidate, 'other'), /release/);
  expect((d) => { d.datasetVersion = 'v2'; }, /release/);
  expect((d) => { d.attribution.license = 'none'; }, /CC BY 4.0/);
  expect((d) => { d.attribution.creator = 'someone'; }, /CC BY 4.0/);
  expect((d) => { d.policy.precedence.reverse(); }, /precedence/);
  expect((d) => { d.policy.thresholds.coreProbabilityAtLeast = 0.8; }, /thresholds/);
  expect((d) => { delete d.policy.thresholds; }, /thresholds/);
  expect(() => {}, /requires candidate evidence/, null);
  expect((d) => { delete d.byLocus.M744_RS00005; }, /every current UTEX CDS/);
  expect((d) => {
    delete d.byLocus.M744_RS00005;
    d.byLocus.EXTRA = d.byLocus.M744_RS00010;
  }, /Invalid GO IEA essentiality record M744_RS00005/);
  expect((d) => { d.byLocus.M744_RS08250.goContext.label = 'maybe'; }, /disagrees with its probability/);
  expect((d) => { d.byLocus.M744_RS08250.goContext.label = 'uncertain'; }, /disagrees with its probability/);
  expect((d) => { d.byLocus.M744_RS08250.goContext.pCore = null; }, /Invalid GO IEA/);
  expect((d) => { d.byLocus.M744_RS08250.goContext.pCore = 1.5; }, /Invalid GO IEA/);
  expect((d) => { d.byLocus.M744_RS08250.tier = 'unknown'; }, /disagrees/);
  expect((d) => { d.byLocus.M744_RS00005.pcc7942Status = 'essential'; }, /disagrees/);
  expect((d) => { d.byLocus.M744_RS00005.tier = 'go-iea-context'; }, /disagrees/);
  expect((d) => { d.byLocus.M744_RS05510.discrepancies[0].kind = 'x'; }, /discrepancy/);
  expect((d) => { d.byLocus.M744_RS05510.discrepancies[0].note = ''; }, /discrepancy/);
  expect((d) => { d.byLocus.M744_RS05510.discrepancies[0].probability = 0.79; }, /discrepancy/);
  expect((d) => { d.byLocus.M744_RS05510.discrepancies[0].probability = null; }, /discrepancy/);
  expect((d) => { d.byLocus.M744_RS05510.discrepancies = null; }, /discrepancy/);
  expect((d) => {
    d.byLocus.M744_RS00010.discrepancies = [{ kind: 'pcc7942-call', probability: null, note: 'x' }];
  }, /discrepancy/);
  expect((d) => { d.byLocus.M744_RS13955.discrepancies[1].probability = 0.9; }, /discrepancy/);
  expect((d) => { d.byLocus.M744_RS13955.discrepancies.pop(); }, /omits its PCC-call disagreement/);
});

test('the real site dataset loads the pinned GO IEA tiers', async () => {
  const dataset = await loadDataset({
    baseUrl: new URL('../../site/data/', import.meta.url).href, fetchImpl: fileFetch(),
  });
  assert.equal(dataset.goIeaEssentiality.counts.byTier['go-iea-context'],
    data.counts.byTier['go-iea-context']);
});
