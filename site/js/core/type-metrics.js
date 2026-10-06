/**
 * Data-type metrics: one selectable metric per kind of measurement, informed
 * by one chosen dataset.
 *
 * Owner decision, 2026-10-06: Colour by, the axes and the filters name the
 * kind of data (transcript abundance by RNA-seq, by array, protein abundance,
 * transcription initiation, gene fitness), and the Data Sources section says
 * which dataset informs it. A type metric is a thin view over the informing
 * dataset's own metric: it reads that metric's values, unit, description,
 * scale and provenance at call time, so changing the informing dataset changes
 * nothing but the answer, and no registry is rebuilt.
 *
 * Several selected datasets of one type never pool: units differ between
 * deposits (CPM, TPM, RPKM, as deposited) and no normalisation across them is
 * stated, so exactly one dataset informs a type at a time.
 */

/** The kind of quantity a dataset measures, from its record's data type and its source's assay. */
export function assayKind(dataset) {
  if (dataset?.record?.dataType === 'fitness') return 'fitness';
  if (/initiation/i.test(dataset?.source?.assay ?? '')) return 'initiation';
  return 'abundance';
}

const slug = (text) => String(text ?? 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The type key a dataset's metric collapses into: `type.<dataType>.<platform>.<kind>`. */
export function typeKeyFor(dataset) {
  const { dataType, platform } = dataset.record;
  return `type.${slug(dataType)}.${slug(platform)}.${assayKind(dataset)}`;
}

/** Whether a metric key names a type metric rather than a dataset's own. */
export function isTypeKey(key) {
  return typeof key === 'string' && key.startsWith('type.');
}

/** The reader-facing name of a type: the quantity, then the platform in brackets. */
export function typeLabelFor(dataset) {
  const { dataType, platform } = dataset.record;
  const kind = assayKind(dataset);
  const quantity = kind === 'initiation' ? 'Transcription initiation'
    : kind === 'fitness' ? 'Gene fitness'
      : dataType === 'proteomics' ? 'Protein abundance'
        : dataType === 'transcriptomics' ? 'Transcript abundance'
          : `${dataType} measurement`;
  return `${quantity} (${platform})`;
}

/**
 * The types the datasets fall into, in first-seen order.
 * @returns {Map<string, {key: string, label: string, datasets: object[]}>}
 */
export function typeGroups(datasets) {
  const groups = new Map();
  for (const dataset of datasets) {
    const key = typeKeyFor(dataset);
    if (!groups.has(key)) groups.set(key, { key, label: typeLabelFor(dataset), datasets: [] });
    groups.get(key).datasets.push(dataset);
  }
  return groups;
}

/** The two sources the site shipped first; they inform their types unless the reader chooses. */
const LEGACY_PREFERRED = ['GSE205444', 'TAN2018_TSS'];

/** The datasets of one type that are selected, in selection order. */
export function selectedOfType(group, selection) {
  const chosen = new Set(selection);
  return group.datasets.filter((dataset) => chosen.has(dataset.id));
}

/** The dataset that informs a type when the reader has not chosen: a shipped original, else the first selected. */
export function defaultInforming(group, selection) {
  const candidates = selectedOfType(group, selection);
  return candidates.find((dataset) => LEGACY_PREFERRED.includes(dataset.id)) ?? candidates[0] ?? null;
}

/**
 * Coerce a decoded `typeSources` value into `{typeKey: datasetId}` holding only
 * choices that still make sense: a known type, a dataset of that type that is
 * selected, and one that differs from the default. Anything else falls back to
 * the default silently, as the selection itself does.
 */
export function normalizeTypeSources(value, datasets, selection) {
  const groups = typeGroups(datasets);
  const out = {};
  for (const [typeKey, datasetId] of Object.entries(value ?? {})) {
    const group = groups.get(typeKey);
    if (!group) continue;
    const dataset = selectedOfType(group, selection).find((d) => d.id === datasetId);
    if (!dataset || dataset === defaultInforming(group, selection)) continue;
    out[typeKey] = datasetId;
  }
  return out;
}

/** The dataset informing a type under the reader's choices, or null when none of its datasets is selected. */
export function informingDataset(typeKey, typeSources, datasets, selection) {
  const group = typeGroups(datasets).get(typeKey);
  if (!group) return null;
  const chosen = typeSources?.[typeKey];
  return selectedOfType(group, selection).find((d) => d.id === chosen) ?? defaultInforming(group, selection);
}

/** A dataset metric's type key; any other key is returned unchanged. */
export function typeKeyOf(metricKey, datasets) {
  const dataset = datasets.find((d) => d.metricKey === metricKey);
  return dataset ? typeKeyFor(dataset) : metricKey;
}

/**
 * The virtual metrics, one per type. `inform(typeKey)` returns the informing
 * dataset at call time, and `metricOf(dataset)` its own registry metric; every
 * property that depends on the dataset is a getter, so a change of informing
 * dataset is seen by the next read without rebuilding anything.
 */
export function buildTypeMetrics(datasets, { inform, metricOf }) {
  const metrics = [];
  for (const group of typeGroups(datasets).values()) {
    const current = () => {
      const dataset = inform(group.key);
      return dataset ? metricOf(dataset) ?? null : null;
    };
    metrics.push({
      key: group.key,
      label: group.label,
      // A fitness screen is its own family (owner decision, 2026-10-05); every
      // abundance and initiation measure is expression evidence.
      family: assayKind(group.datasets[0]) === 'fitness' ? 'Fitness' : 'Expression',
      source: 'pipeline',
      integer: false,
      isType: true,
      typeKey: group.key,
      get unit() { return current()?.unit ?? ''; },
      get desc() { return current()?.desc ?? `${group.label}, from the dataset chosen under Data Sources.`; },
      get scale() { return current()?.scale ?? 'sequential'; },
      get provenance() { return current()?.provenance ?? null; },
      get fileKey() { return current()?.fileKey ?? null; },
      get tssEvidenceSource() { return current()?.tssEvidenceSource; },
      get informing() { return inform(group.key); },
      read: (index) => {
        const metric = current();
        return metric ? metric.read(index) : NaN;
      },
    });
  }
  return metrics;
}
