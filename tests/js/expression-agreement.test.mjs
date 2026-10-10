import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  agreementExportEvidence, validateExpressionAgreement,
} from '../../site/js/core/expression-agreement.js';

const DATA = new URL('../../site/data/', import.meta.url);

async function published() {
  const [payload, meta] = await Promise.all([
    readFile(new URL('expression_agreement.json', DATA), 'utf8').then(JSON.parse),
    readFile(new URL('meta.json', DATA), 'utf8').then(JSON.parse),
  ]);
  return { payload, meta };
}

test('the published agreement payload joins every admitted RNA-seq source by exact id', async () => {
  const { payload, meta } = await published();
  const agreement = validateExpressionAgreement(payload, meta);
  assert.equal(agreement.sources.length, 55);
  assert.equal(agreement.sources.filter((source) => source.agreement).length, 53);
  assert.deepEqual(agreement.sources.filter((source) => !source.agreement).map((source) => source.id),
    ['GSE205444', 'TAN2018_TSS']);
  const pair = agreement.levelPair(
    'GSE103462_wt_subjective_dawn', 'GSE103462_wt_subjective_dusk',
  );
  assert.equal(pair.sharedGeneCount, 2551);
  assert.equal(pair.spearman, 0.9449029665554857);
  const dawn = agreement.sourceById.get('GSE103462_wt_subjective_dawn').agreement;
  assert.equal(dawn.strain, 'PCC 7942');
  assert.equal(dawn.strata[0].sampleCorrelations[0].sharedGeneCount, 2551);
  assert.equal(dawn.empiricalSampleRange.definedCorrelationCount, 1);
  const responses = agreement.responsePairsForSources(
    'GSE103462_wt_subjective_dawn', 'GSE103463_rel_relA_subjective_dawn',
  );
  assert.equal(responses.length, 1);
  assert.equal(responses[0].leftContrast.label, 'Subjective dusk relative to subjective dawn');
  assert.deepEqual(responses[0].leftContrast.control,
    ['wild type replicate 1 dawn', 'wild type replicate 2 dawn']);
  assert.equal(responses[0].sameDirectionCount, 1486);
  assert.deepEqual(agreement.responsePairsForSources(
    'GSE103462_wt_subjective_dawn', 'GSE103462_wt_subjective_dusk',
  ), [], 'an absent explicit response pair stays absent');
});

test('the browser validator refuses malformed, partial, and unknown source joins', async () => {
  const { payload, meta } = await published();
  const unknown = structuredClone(payload);
  unknown.sources[2].id = 'UNKNOWN';
  assert.throws(() => validateExpressionAgreement(unknown, meta), /expected GSE288532_subjective_day/);

  const partial = structuredClone(payload);
  partial.levelPairs.pop();
  assert.throws(() => validateExpressionAgreement(partial, meta), /every report-backed level pair/);

  const badNull = structuredClone(payload);
  badNull.levelPairs[0].spearman = null;
  assert.throws(() => validateExpressionAgreement(badNull, meta), /spearmanReason/);

  const stale = structuredClone(payload);
  stale.sources[2].studyId = 'STALE';
  assert.throws(() => validateExpressionAgreement(stale, meta), /stale studyId/);

  const denominator = structuredClone(payload);
  denominator.sources[2].agreement.empiricalSampleRange.definedCorrelationCount += 1;
  assert.throws(() => validateExpressionAgreement(denominator, meta),
    /sample-pair count disagrees/);

  const overlappingArms = structuredClone(payload);
  overlappingArms.contrasts[0].control = [...overlappingArms.contrasts[0].treatment];
  assert.throws(() => validateExpressionAgreement(overlappingArms, meta),
    /empty, duplicate, or overlapping arms/);
});

test('exports carry agreement provenance only for loaded report-backed contributors', async () => {
  const { payload, meta } = await published();
  const agreement = validateExpressionAgreement(payload, meta);
  assert.equal(agreementExportEvidence(null, ['GSE103462_wt_subjective_dawn']), undefined);
  assert.equal(agreementExportEvidence(agreement, ['GSE205444']), undefined,
    'an explicit coverage gap is not claimed as evidence');
  const evidence = agreementExportEvidence(agreement, [
    'GSE103463_rel_relA_subjective_dawn', 'GSE103462_wt_subjective_dawn',
    'GSE103462_wt_subjective_dawn', 'UNKNOWN',
  ]);
  assert.deepEqual(evidence.sources,
    ['GSE103462_wt_subjective_dawn', 'GSE103463_rel_relA_subjective_dawn']);
  assert.equal(evidence.report.sha256, payload.sourceReport.sha256);
  assert.equal(evidence.statisticsImplementation.sha256,
    payload.statisticsImplementation.sha256);
  assert.equal(evidence.inputs.plan.sha256, payload.inputs.plan.sha256);
});
