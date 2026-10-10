/**
 * Validation and bounded lookup for the processed-expression agreement report.
 *
 * The browser payload is statistics-only: no per-gene means or response vectors
 * are published. It joins to `meta.expressionSources` by exact source id and
 * refuses stale, duplicate, partial, or unknown joins rather than guessing.
 */

const SHA256 = /^[0-9a-f]{64}$/;
const GAP_REASON = 'not_present_in_current_statistics_report';

function fail(message) {
  throw new Error(`expression_agreement.json ${message}`);
}

function object(value, context) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${context} must be an object`);
  return value;
}

function array(value, context) {
  if (!Array.isArray(value)) fail(`${context} must be an array`);
  return value;
}

function text(value, context) {
  if (typeof value !== 'string' || value.length === 0) fail(`${context} must be non-empty text`);
  return value;
}

function count(value, context) {
  if (!Number.isInteger(value) || value < 0) fail(`${context} must be a non-negative integer`);
  return value;
}

function number(value, context, { nullable = false, min = -Infinity, max = Infinity } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    fail(`${context} must be ${nullable ? 'null or ' : ''}a finite number between ${min} and ${max}`);
  }
  return value;
}

function checksumRecord(value, context, { bytes = false } = {}) {
  const record = object(value, context);
  text(record.path, `${context}.path`);
  if (!SHA256.test(record.sha256)) fail(`${context}.sha256 must be lowercase SHA-256`);
  if (bytes) count(record.bytes, `${context}.bytes`);
  return record;
}

function optionalStatistic(record, field, context, min = -1, max = 1, reasonField = `${field}Reason`) {
  const value = number(record[field], `${context}.${field}`, { nullable: true, min, max });
  if (value === null) text(record[reasonField], `${context}.${reasonField}`);
  else if (Object.hasOwn(record, reasonField)) {
    fail(`${context}.${reasonField} accompanies a defined statistic`);
  }
  return value;
}

function sourceIds(meta) {
  return (meta?.expressionSources ?? [])
    .filter((source) => source?.record?.dataType === 'transcriptomics'
      && source.record.platform === 'RNA-seq')
    .map((source) => source.id);
}

function pairKey(left, right) {
  return left < right ? `${left}\u0000${right}` : `${right}\u0000${left}`;
}

function validateRange(value, sourceId) {
  const range = object(value, `source ${sourceId} empiricalSampleRange`);
  text(range.id, `source ${sourceId} empiricalSampleRange.id`);
  text(range.label, `source ${sourceId} empiricalSampleRange.label`);
  const defined = count(range.definedCorrelationCount,
    `source ${sourceId} empiricalSampleRange.definedCorrelationCount`);
  const values = ['min', 'median', 'max'].map((field) => number(
    range[field], `source ${sourceId} empiricalSampleRange.${field}`,
    { nullable: true, min: -1, max: 1 },
  ));
  if (defined === 0) {
    if (values.some((entry) => entry !== null)) fail(`source ${sourceId} has a range with no correlation`);
    text(range.reason, `source ${sourceId} empiricalSampleRange.reason`);
  } else {
    if (values.some((entry) => entry === null) || values[0] > values[1] || values[1] > values[2]) {
      fail(`source ${sourceId} empirical sample range is incomplete or unordered`);
    }
    if (Object.hasOwn(range, 'reason')) fail(`source ${sourceId} range has a reason despite being defined`);
  }
  return range;
}

function validateSource(value, metaSource, seen) {
  const source = object(value, 'source entry');
  const id = text(source.id, 'source id');
  if (seen.has(id)) fail(`repeats source id ${id}`);
  seen.add(id);
  if (id !== metaSource.id) fail(`source order/join expected ${metaSource.id}, found ${id}`);
  if (source.studyId !== metaSource.record.studyId) fail(`source ${id} has a stale studyId`);
  text(source.label, `source ${id} label`);
  if (source.agreement === null) {
    if (source.coverageGap !== GAP_REASON) fail(`source ${id} has no explicit coverage gap`);
    return source;
  }
  if (Object.hasOwn(source, 'coverageGap')) fail(`source ${id} has evidence and a coverage gap`);
  const agreement = object(source.agreement, `source ${id} agreement`);
  if (agreement.studyId !== source.studyId) fail(`source ${id} agreement has a stale studyId`);
  for (const field of ['label', 'conditionSet', 'strain', 'units', 'normalization', 'caveat', 'replicateType']) {
    text(agreement[field], `source ${id} agreement.${field}`);
  }
  if (typeof agreement.biologicalBandAvailable !== 'boolean') {
    fail(`source ${id} biologicalBandAvailable must be true or false`);
  }
  const replicates = object(agreement.replicates, `source ${id} agreement.replicates`);
  if (replicates.count !== null) count(replicates.count, `source ${id} agreement.replicates.count`);
  text(replicates.text, `source ${id} agreement.replicates.text`);
  count(agreement.meanGeneCount, `source ${id} agreement.meanGeneCount`);
  const range = validateRange(agreement.empiricalSampleRange, id);
  const strata = array(agreement.strata, `source ${id} agreement.strata`);
  let correlationCount = 0;
  for (const [stratumIndex, item] of strata.entries()) {
    const context = `source ${id} agreement.strata[${stratumIndex}]`;
    const stratum = object(item, context);
    text(stratum.id, `${context}.id`);
    const columns = array(stratum.columns, `${context}.columns`);
    const columnNames = new Set(columns.map((column, index) => text(column, `${context}.columns[${index}]`)));
    if (columnNames.size !== columns.length) fail(`${context}.columns repeats a sample name`);
    const pairNames = new Set();
    for (const [pairIndex, itemPair] of array(stratum.sampleCorrelations,
      `${context}.sampleCorrelations`).entries()) {
      const pairContext = `${context}.sampleCorrelations[${pairIndex}]`;
      const samplePair = object(itemPair, pairContext);
      const left = text(samplePair.sampleLeft, `${pairContext}.sampleLeft`);
      const right = text(samplePair.sampleRight, `${pairContext}.sampleRight`);
      if (left === right || !columnNames.has(left) || !columnNames.has(right)) {
        fail(`${pairContext} names an unknown or repeated sample`);
      }
      const key = pairKey(left, right);
      if (pairNames.has(key)) fail(`${context} repeats sample pair ${left} / ${right}`);
      pairNames.add(key);
      count(samplePair.sharedGeneCount, `${pairContext}.sharedGeneCount`);
      number(samplePair.spearman, `${pairContext}.spearman`, { min: -1, max: 1 });
      correlationCount += 1;
    }
  }
  if (correlationCount !== range.definedCorrelationCount) {
    fail(`source ${id} sample-pair count disagrees with its empirical range`);
  }
  if (agreement.biologicalBandAvailable) {
    if (agreement.biologicalBandId !== range.id) fail(`source ${id} biological band has a stale id`);
  } else if (Object.hasOwn(agreement, 'biologicalBandId')) {
    fail(`source ${id} names a biological band that is unavailable`);
  }
  return source;
}

/**
 * Validate and index a browser agreement payload against the loaded metadata.
 * @returns {object} payload plus `sourceById`, `levelPair`, and
 *   `responsePairsForSources` lookups.
 */
export function validateExpressionAgreement(payload, meta) {
  const root = object(payload, 'must be an object');
  if (root.schemaVersion !== 1) fail('has an unknown schemaVersion');
  if (root.reportFormat !== 'browser-expression-agreement') fail('has an unknown reportFormat');
  checksumRecord(root.sourceReport, 'sourceReport', { bytes: true });
  checksumRecord(root.metaInput, 'metaInput', { bytes: true });
  checksumRecord(root.promotion, 'promotion');
  checksumRecord(root.statisticsImplementation, 'statisticsImplementation');
  object(root.inputs, 'inputs');
  object(root.methods, 'methods');
  const limitations = array(root.limitations, 'limitations');
  if (limitations.length === 0) fail('limitations must not be empty');
  limitations.forEach((entry, index) => text(entry, `limitations[${index}]`));
  const omitted = object(root.omittedVectors, 'omittedVectors');
  if (omitted.layerField !== 'means' || omitted.contrastField !== 'vector') {
    fail('does not declare the omitted per-gene vectors');
  }

  const ids = sourceIds(meta);
  if (ids.length === 0) fail('cannot join because meta declares no RNA-seq sources');
  const metaById = new Map(meta.expressionSources.map((source) => [source.id, source]));
  const sources = array(root.sources, 'sources');
  if (sources.length !== ids.length) fail(`has ${sources.length} sources; meta declares ${ids.length}`);
  const seen = new Set();
  const validatedSources = sources.map((source, index) => (
    validateSource(source, metaById.get(ids[index]), seen)
  ));
  const sourceById = new Map(validatedSources.map((source) => [source.id, source]));
  const reportSources = validatedSources.filter((source) => source.agreement !== null);
  const reportIds = new Set(reportSources.map((source) => source.id));

  const coverage = object(root.coverage, 'coverage');
  if (count(coverage.admittedRnaSeqSourceCount, 'coverage.admittedRnaSeqSourceCount') !== sources.length
    || count(coverage.reportBackedSourceCount, 'coverage.reportBackedSourceCount') !== reportSources.length) {
    fail('coverage source counts disagree with sources');
  }
  const gaps = array(coverage.gaps, 'coverage.gaps');
  const expectedGaps = validatedSources.filter((source) => source.agreement === null);
  if (gaps.length !== expectedGaps.length || gaps.some((gap, index) => (
    gap?.sourceId !== expectedGaps[index].id || gap?.reason !== GAP_REASON
  ))) fail('coverage gaps disagree with source coverage');

  const levelPairs = array(root.levelPairs, 'levelPairs');
  const expectedPairCount = reportSources.length * (reportSources.length - 1) / 2;
  if (levelPairs.length !== expectedPairCount
    || coverage.levelPairCount !== expectedPairCount) fail('does not contain every report-backed level pair');
  const pairs = new Map();
  for (const [index, item] of levelPairs.entries()) {
    const pair = object(item, `levelPairs[${index}]`);
    const left = text(pair.left, `levelPairs[${index}].left`);
    const right = text(pair.right, `levelPairs[${index}].right`);
    if (left === right || !reportIds.has(left) || !reportIds.has(right)) {
      fail(`levelPairs[${index}] names an unknown or repeated source`);
    }
    const key = pairKey(left, right);
    if (pairs.has(key)) fail(`repeats level pair ${left} / ${right}`);
    count(pair.sharedGeneCount, `levelPairs[${index}].sharedGeneCount`);
    optionalStatistic(pair, 'spearman', `levelPairs[${index}]`);
    pairs.set(key, pair);
  }

  const contrasts = array(root.contrasts, 'contrasts');
  const contrastById = new Map();
  const reportStudies = new Set(reportSources.map((source) => source.studyId));
  for (const [index, item] of contrasts.entries()) {
    const contrast = object(item, `contrasts[${index}]`);
    const id = text(contrast.id, `contrasts[${index}].id`);
    if (contrastById.has(id)) fail(`repeats contrast ${id}`);
    if (!reportStudies.has(contrast.studyId)) fail(`contrast ${id} names unknown study ${contrast.studyId}`);
    for (const field of ['label', 'caveat']) text(contrast[field], `contrast ${id}.${field}`);
    const treatment = array(contrast.treatment, `contrast ${id}.treatment`)
      .map((name, nameIndex) => text(name, `contrast ${id}.treatment[${nameIndex}]`));
    const control = array(contrast.control, `contrast ${id}.control`)
      .map((name, nameIndex) => text(name, `contrast ${id}.control[${nameIndex}]`));
    if (treatment.length === 0 || control.length === 0
      || new Set(treatment).size !== treatment.length || new Set(control).size !== control.length
      || treatment.some((name) => control.includes(name))) {
      fail(`contrast ${id} has empty, duplicate, or overlapping arms`);
    }
    const measured = count(contrast.measuredIntersectionCount, `contrast ${id}.measuredIntersectionCount`);
    const positive = count(contrast.positiveGeneCount, `contrast ${id}.positiveGeneCount`);
    const excluded = count(contrast.excludedZeroCount, `contrast ${id}.excludedZeroCount`);
    if (measured !== positive + excluded) fail(`contrast ${id} denominators disagree`);
    contrastById.set(id, contrast);
  }

  const responsePairs = array(root.responsePairs, 'responsePairs');
  if (coverage.responsePairCount !== responsePairs.length) fail('coverage responsePairCount disagrees');
  const responseByStudies = new Map();
  for (const [index, item] of responsePairs.entries()) {
    const pair = object(item, `responsePairs[${index}]`);
    const left = contrastById.get(pair.left);
    const right = contrastById.get(pair.right);
    if (!left || !right || left === right) fail(`responsePairs[${index}] names an unknown contrast`);
    text(pair.caveat, `responsePairs[${index}].caveat`);
    const shared = count(pair.sharedGeneCount, `responsePairs[${index}].sharedGeneCount`);
    const directional = count(pair.nonzeroDirectionGeneCount,
      `responsePairs[${index}].nonzeroDirectionGeneCount`);
    const same = count(pair.sameDirectionCount, `responsePairs[${index}].sameDirectionCount`);
    if (directional > shared || same > directional) fail(`responsePairs[${index}] denominators disagree`);
    optionalStatistic(pair, 'spearman', `responsePairs[${index}]`);
    optionalStatistic(pair, 'pearson', `responsePairs[${index}]`);
    const sign = optionalStatistic(
      pair, 'signAgreementFraction', `responsePairs[${index}]`, 0, 1, 'signAgreementReason',
    );
    if ((sign === null) !== (directional === 0)) {
      fail(`responsePairs[${index}] sign statistic disagrees with its denominator`);
    }
    const key = pairKey(left.studyId, right.studyId);
    const decorated = { ...pair, leftContrast: left, rightContrast: right };
    if (!responseByStudies.has(key)) responseByStudies.set(key, []);
    responseByStudies.get(key).push(decorated);
  }

  return Object.freeze({
    ...root,
    sources: validatedSources,
    sourceById,
    levelPair: (left, right) => pairs.get(pairKey(left, right)) ?? null,
    responsePairsForSources: (left, right) => {
      const a = sourceById.get(left); const b = sourceById.get(right);
      return a && b ? [...(responseByStudies.get(pairKey(a.studyId, b.studyId)) ?? [])] : [];
    },
  });
}

/** Compact provenance for an export, only after the payload validated and loaded. */
export function agreementExportEvidence(agreement, sourceIdsForExport) {
  if (!agreement) return undefined;
  const ids = [...new Set(sourceIdsForExport ?? [])]
    .filter((id) => agreement.sourceById.get(id)?.agreement)
    .sort();
  if (ids.length === 0) return undefined;
  return {
    report: { ...agreement.sourceReport },
    promotion: { ...agreement.promotion },
    statisticsImplementation: { ...agreement.statisticsImplementation },
    inputs: agreement.inputs,
    sources: ids,
    caveats: [...agreement.limitations],
  };
}
