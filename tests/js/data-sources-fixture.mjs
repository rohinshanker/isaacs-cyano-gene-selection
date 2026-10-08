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

/**
 * The quantity facts the pipeline resolves and publishes onto a source entry,
 * mirroring `scripts/expression_table.py` for the quantities the tests use.
 * The browser reads these rather than re-deriving them, so a fixture that sets
 * them is exactly what a declared source looks like to it.
 */
const QUANTITY_FACTS = {
  rpkm: {
    'RNA-seq': ['abundance', 'RNA abundance'],
    'Ribo-seq': ['occupancy', 'Ribosome occupancy'],
  },
  read_count: {
    'RNA-seq': ['read-count', 'RNA read count'],
    'Ribo-seq': ['footprint-count', 'Ribosome footprint count'],
  },
  log2_fold_change: {
    'RNA-seq': ['log2-fold-change', 'RNA log2FC'],
    'Ribo-seq': ['log2-fold-change', 'Ribosome log2FC'],
  },
  edger_log2_fold_change: {
    'RNA-seq': ['edger-log2-fold-change', 'RNA log2FC (EdgeR)'],
    'Ribo-seq': ['edger-log2-fold-change', 'Ribosome log2FC (EdgeR)'],
  },
  p_value: {
    'RNA-seq': ['p-value', 'RNA reported P-value (adjustment unspecified)'],
    'Ribo-seq': ['p-value', 'Ribosome reported P-value (adjustment unspecified)'],
  },
  translation_efficiency_log2_fold_change: {
    'RNA-seq': ['te-log2-fold-change', 'TE log2FC'],
    'Ribo-seq': ['te-log2-fold-change', 'TE log2FC'],
  },
};

const QUANTITY_RULES = {
  rpkm: ['Expression', true, false, { nonnegative: true, integral: false, unitInterval: false }],
  read_count: ['Expression', true, false, { nonnegative: true, integral: true, unitInterval: false }],
  log2_fold_change: ['Fold change', false, true, { nonnegative: false, integral: false, unitInterval: false }],
  edger_log2_fold_change: ['Fold change', false, true, { nonnegative: false, integral: false, unitInterval: false }],
  p_value: ['Significance', false, false, { nonnegative: true, integral: false, unitInterval: true }],
  translation_efficiency_log2_fold_change: ['Translation efficiency', false, true, { nonnegative: false, integral: false, unitInterval: false }],
};

/** The published source fields a declared quantity resolves to. */
export function quantityFacts(quantity, platform = 'RNA-seq') {
  const [kind, label] = QUANTITY_FACTS[quantity][platform];
  const [family, pools, signed, bounds] = QUANTITY_RULES[quantity];
  return {
    quantity,
    quantityKind: kind,
    quantityLabel: label,
    quantityFamily: family,
    quantityPools: pools,
    quantityBounds: bounds,
    signed,
    logScale: false,
  };
}

/**
 * A dataset as `datasetsFrom` would build it.
 *
 * `datasetId`, `metricKey`, `quantity` and `source` belong to the manifest
 * entry rather than to the condition record, so they are kept out of it; every
 * other option overrides a record field.
 */
export function dataset(options = {}) {
  const { datasetId, metricKey, quantity, source, ...recordOptions } = options;
  const record = conditionRecord(recordOptions);
  return {
    id: datasetId ?? `${record.studyId}.${record.conditionTableRow}`,
    metricKey: metricKey ?? `m${record.studyId}${record.conditionTableRow}`,
    label: record.conditionSet,
    record,
    source: {
      provenanceDoc: 'data/expression/test.md',
      ...(quantity ? quantityFacts(quantity, record.platform) : {}),
      ...(source ?? {}),
    },
  };
}
