/** Shared fixture: a complete condition record and a dataset built on it. */

/** A valid record with any top-level field or condition axis overridden. */
export function conditionRecord({ id = 'GSE1', row = 1, group = 'standard', treatments = [], conditions = {}, ...rest } = {}) {
  const axis = (fields) => ({ status: 'reported', text: 'x', quote: 'x', where: 'test', ...fields });
  const base = {
    studyId: id, dataType: 'transcriptomics', platform: 'RNA-seq', strain: 'PCC 7942', basis: 'transferred',
    conditionSet: `${id} set ${row}`, samples: 'x', archiveUrl: 'https://example.org',
    citation: { text: `${id} et al. 2026`, url: 'https://doi.org/10.1/x', pmid: '1' },
    replicates: { count: 3, text: 'three', where: 'test' }, treatments, group, conditionTableRow: row,
    conditions: {
      temperature: axis({ lo: 30, hi: 30, unit: '°C' }),
      lightIntensity: axis({ lo: 40, hi: 40, unit: 'µmol photons m⁻² s⁻¹' }),
      lightRegime: axis({ kind: 'continuous', photoperiod: null, spectrumClass: null, entrained: false }),
      co2: axis({ lo: 1, hi: 1, unit: '%' }),
      medium: axis({ base: 'BG-11', modified: false, conditioned: false, nitrogenAltered: false }),
      format: axis({ value: 'planktonic liquid' }),
      phase: axis({ label: 'OD stated', od: [0.3, 0.3], odNm: 750 }),
    },
    ...rest,
  };
  for (const [name, fields] of Object.entries(conditions)) Object.assign(base.conditions[name], fields);
  return base;
}

/** A dataset as `datasetsFrom` would build it. */
export function dataset(options = {}) {
  const record = conditionRecord(options);
  return {
    id: options.datasetId ?? `${record.studyId}.${record.conditionTableRow}`,
    metricKey: options.metricKey ?? `m${record.studyId}${record.conditionTableRow}`,
    label: record.conditionSet,
    record,
    source: { provenanceDoc: 'data/expression/test.md' },
  };
}
