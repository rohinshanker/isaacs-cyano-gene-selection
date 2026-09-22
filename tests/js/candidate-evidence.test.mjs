import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  candidateEvidenceFor, validateCandidateEvidence,
} from '../../site/js/core/candidate-evidence.js';

const data = JSON.parse(readFileSync(new URL('../../site/data/candidate_evidence.json', import.meta.url)));
const genes = JSON.parse(readFileSync(new URL('../../site/data/genes.json', import.meta.url)));

test('tested UTEX alleles and PCC calls retain separate strain evidence', () => {
  assert.equal(validateCandidateEvidence(data, genes, data.annotationRelease), data);
  const tested = candidateEvidenceFor(data, 'M744_RS01270');
  assert.match(tested.tested.claim, /AtpA allele/);
  assert.match(tested.testedSource.condition, /900 micromol/);
  assert.equal(tested.borrowedEssentiality.status, 'available');
  assert.equal(tested.pccCall.status, 'unknown');
  const borrowed = candidateEvidenceFor(data, 'M744_RS00005');
  assert.equal(borrowed.tested, null);
  assert.equal(borrowed.pccCall.status, 'non-essential');
  assert.equal(borrowed.pccCall.pccLocusTag, 'SYNPCC7942_RS02980');
  assert.equal(borrowed.borrowedEssentiality.source.rubinDoi,
    '10.1073/pnas.1519220112');
  assert.equal(candidateEvidenceFor(data, 'M744_RS00030').tested, null);
  assert.equal(candidateEvidenceFor(null, 'M744_RS01270'), null);
});

test('invalid release, PCC join, or allele evidence fails closed', () => {
  assert.throws(() => validateCandidateEvidence(null, genes, data.annotationRelease));
  assert.throws(() => validateCandidateEvidence(data, genes, 'different release'));
  assert.throws(() => validateCandidateEvidence({
    ...data, borrowedEssentiality: { status: 'unavailable' },
  }, genes, data.annotationRelease));
  assert.throws(() => validateCandidateEvidence({
    ...data, borrowedEssentiality: {
      ...data.borrowedEssentiality,
      byLocus: { ...data.borrowedEssentiality.byLocus,
        M744_RS00005: { status: 'essential', mappingStatus: 'accepted' } },
    },
  }, genes, data.annotationRelease));
  assert.throws(() => validateCandidateEvidence({
    ...data, borrowedEssentiality: {
      ...data.borrowedEssentiality,
      byLocus: { ...data.borrowedEssentiality.byLocus, M744_RS00005: undefined },
    },
  }, genes, data.annotationRelease));
  assert.throws(() => validateCandidateEvidence({
    ...data, testedAlleles: { ...data.testedAlleles, MISSING: data.testedAlleles.M744_RS01270 },
  }, genes, data.annotationRelease));
  assert.throws(() => validateCandidateEvidence({
    ...data, testedAlleles: {
      ...data.testedAlleles, M744_RS01270: { ...data.testedAlleles.M744_RS01270, claim: '' },
    },
  }, genes, data.annotationRelease));
});
