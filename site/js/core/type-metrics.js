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
 * Owner decision, 2026-10-06: several selected datasets of one type show a
 * pooled value unless the reader names one. Units differ between deposits (CPM,
 * TPM, RPKM, as deposited), so an abundance pools as the mean of each dataset's
 * within-dataset mid-rank percentile, a unitless 0 to 1; a signed fitness pools
 * as the mean of the values, which share the log2 scale. The pooling rule is
 * stated beside the value wherever it is shown.
 */
import { percentileRank, sortedFinite } from './stats.js';

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

/**
 * Studies whose condition sets pool with each other by default.
 *
 * A screen designed as one sweep is read as one sweep: the reader who has
 * chosen nothing gets the whole compendium rather than one arbitrary arm of it.
 * Listing the study here rather than marking its conditions `standard` keeps
 * each condition record truthful, so a chemical stress is still recorded as a
 * stress everywhere else in the interface.
 *
 * Owner decision, 2026-10-07, for the Fitness Browser compendium. The cost is
 * stated plainly because it is real: a gene harmed by one compound out of
 * ninety is diluted in the pooled mean and reads as unaffected until the reader
 * selects that condition. Pooling never reaches across studies, so the
 * GSE205443 biofilm fractions stay out of this mean.
 */
const DEFAULT_POOLED_STUDIES = ['FitnessBrowser_SynE'];

/**
 * The datasets a type starts with when the reader asks for it while none of
 * its datasets is selected: the shipped originals, the standard-growth sets and
 * any default-pooled study present, or every dataset of the type when it has
 * none of those.
 */
export function defaultDatasetsOfType(typeKey, datasets) {
  const group = typeGroups(datasets).get(typeKey);
  if (!group) return [];
  const pooled = group.datasets.filter(
    (d) => DEFAULT_POOLED_STUDIES.includes(d.record?.studyId),
  );
  if (pooled.length) return pooled;
  const preferred = group.datasets.filter((d) => LEGACY_PREFERRED.includes(d.id) || d.record.group === 'standard');
  return preferred.length ? preferred : group.datasets;
}

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
    const candidates = selectedOfType(group, selection);
    const dataset = candidates.find((d) => d.id === datasetId);
    // Naming the only selected dataset says nothing the default does not.
    if (!dataset || candidates.length < 2) continue;
    out[typeKey] = datasetId;
  }
  return out;
}

/**
 * The dataset the reader named for a type, or the only selected one; null when
 * the type pools several or none of its datasets is selected.
 */
export function informingDataset(typeKey, typeSources, datasets, selection) {
  const group = typeGroups(datasets).get(typeKey);
  if (!group) return null;
  const candidates = selectedOfType(group, selection);
  const chosen = candidates.find((d) => d.id === typeSources?.[typeKey]);
  if (chosen) return chosen;
  return candidates.length === 1 ? candidates[0] : null;
}

/** The datasets a type reads: the named one alone, else every selected dataset of the type. */
export function contributingDatasets(typeKey, typeSources, datasets, selection) {
  const group = typeGroups(datasets).get(typeKey);
  if (!group) return [];
  const named = informingDataset(typeKey, typeSources, datasets, selection);
  return named ? [named] : selectedOfType(group, selection);
}

/**
 * Whether a metric key is one dataset's own: its manifest metric, or the
 * percentile the pipeline derives from that one dataset. Neither is offered
 * where a type metric stands for the data type (owner decision, 2026-10-06).
 */
export function isDatasetOwnKey(key, datasets) {
  return datasets.some((d) => d.metricKey === key || `${d.metricKey}Percentile` === key);
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
export function buildTypeMetrics(datasets, { contributing, metricOf, geneCount = 0 }) {
  const metrics = [];
  // Within-dataset mid-rank percentiles, built once per dataset metric and kept
  // while that metric object lives; a dataset's values never change in a session.
  const rankCache = new WeakMap();
  const ranks = (metric) => {
    if (!rankCache.has(metric)) {
      const values = [];
      for (let i = 0; i < geneCount; i += 1) values.push(metric.read(i));
      rankCache.set(metric, sortedFinite(values));
    }
    return rankCache.get(metric);
  };
  for (const group of typeGroups(datasets).values()) {
    const signed = assayKind(group.datasets[0]) === 'fitness';
    const current = () => contributing(group.key).map((dataset) => metricOf(dataset) ?? null).filter(Boolean);
    const one = () => { const list = current(); return list.length === 1 ? list[0] : null; };
    const pooledProvenance = (list) => {
      const first = list[0].provenance ?? {};
      const ids = list.map((metric) => metric.provenance?.id ?? metric.key);
      return {
        ...first,
        // Spaces, so the id can wrap wherever it is printed; an unbroken token
        // widened a narrow column once.
        id: `pooled: ${ids.join(', ')}`,
        pooled: ids,
        isTargetOrganism: list.every((metric) => metric.provenance?.isTargetOrganism === true),
        organism: [...new Set(list.map((metric) => metric.provenance?.organism).filter(Boolean))].join('; '),
        condition: `${list.length} datasets pooled: ${list.map((metric) => metric.provenance?.condition ?? metric.key).join(' | ')}`,
        units: signed
          ? `mean gene fitness across ${list.length} fractions (shared log2 scale)`
          : `pooled percentile across ${list.length} datasets: mean of each dataset's within-dataset mid-rank, 0 to 1`,
        caveat: 'Pooled by owner decision of 2026-10-06. '
          + (signed ? 'Fitness values share a log2 scale and are averaged as published.'
            : 'The deposits report different units, so each is ranked within itself before averaging; the pooled value is a rank, not an abundance.')
          + ' Choose one dataset under Data Sources to read its own values.',
        citationIds: [...new Set(list.map((metric) => metric.provenance?.citationId).filter(Boolean))],
      };
    };
    metrics.push({
      key: group.key,
      label: group.label,
      // A fitness screen is its own family (owner decision, 2026-10-05); every
      // abundance and initiation measure is expression evidence.
      family: signed ? 'Fitness' : 'Expression',
      source: 'pipeline',
      integer: false,
      isType: true,
      typeKey: group.key,
      get unit() { const list = current(); return list.length === 1 ? list[0].unit : list.length > 1 ? pooledProvenance(list).units : ''; },
      get desc() {
        const list = current();
        if (list.length === 1) return list[0].desc;
        if (list.length > 1) return `${group.label}, pooled over ${list.length} selected datasets: ${pooledProvenance(list).units}.`;
        return `${group.label}, from the datasets selected under Data Sources.`;
      },
      get scale() { return one()?.scale ?? (signed ? 'diverging' : 'sequential'); },
      get provenance() { const list = current(); return list.length === 1 ? list[0].provenance : list.length > 1 ? pooledProvenance(list) : null; },
      get fileKey() { return current().find((metric) => metric.fileKey)?.fileKey ?? null; },
      get tssEvidenceSource() { return one()?.tssEvidenceSource; },
      get informing() { return one() ? contributing(group.key)[0] : null; },
      get pooled() { return current().length > 1; },
      read: (index) => {
        const list = current();
        if (list.length === 0) return NaN;
        if (list.length === 1) return list[0].read(index);
        let sum = 0; let n = 0;
        for (const metric of list) {
          const value = metric.read(index);
          if (!Number.isFinite(value)) continue;
          sum += signed ? value : percentileRank(ranks(metric), value);
          n += 1;
        }
        return n > 0 ? sum / n : NaN;
      },
    });
  }
  return metrics;
}
