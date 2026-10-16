/**
 * The data sources a panel design was evaluated against.
 *
 * A type metric reads whichever datasets Data Sources selects at call time, and
 * an expression layer's values land after the page loads, so the same metric
 * key can mean different numbers a minute apart. A design therefore captures
 * two things when it runs: a frozen copy of the metrics it can read, so its
 * result and export keep the values that chose the genes, and a description of
 * the sources behind the metrics that decide it, so the panel is marked stale
 * the moment those change and the export names them.
 *
 * Which metrics decide a design: every constrained metric and every default
 * feature. A source change that alters none of them leaves the panel current.
 */
import { canonicalJson, fnv1a64 } from './export-manifest.js';
import { defaultBaselineFeatures, isBorrowedMetric } from './panel-features.js';

/**
 * A metric whose getters are evaluated once and whose values are copied, so
 * later source selections, joined files and evidence loads cannot reach it.
 */
export function freezeMetric(metric, geneCount) {
  const frozen = {};
  for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(metric))) {
    frozen[name] = descriptor.get ? descriptor.get.call(metric) : descriptor.value;
  }
  const values = new Float64Array(geneCount);
  for (let index = 0; index < geneCount; index += 1) values[index] = metric.read(index);
  frozen.read = (index) => (index >= 0 && index < geneCount ? values[index] : NaN);
  if (typeof metric.availabilityReason === 'function') {
    const reason = metric.availabilityReason();
    frozen.availabilityReason = () => reason;
  }
  return Object.freeze(frozen);
}

/**
 * The registry as a design sees it: every offered metric frozen, and any
 * `extraKeys` (constrained metrics the list does not offer) frozen beside them.
 * Any other key is absent, so nothing later reads a live value through it.
 */
export function freezeRegistry(registry, geneCount, extraKeys = []) {
  const frozenOf = new Map();
  const freeze = (metric) => {
    if (!frozenOf.has(metric)) frozenOf.set(metric, freezeMetric(metric, geneCount));
    return frozenOf.get(metric);
  };
  const metrics = registry.metrics.map(freeze);
  const byKey = new Map(metrics.map((metric) => [metric.key, metric]));
  for (const key of extraKeys) {
    const metric = registry.byKey.get(key);
    if (metric && !byKey.has(key)) byKey.set(key, freeze(metric));
  }
  return { ...registry, metrics, byKey };
}

/** The metric keys whose values decide a design under this configuration. */
export function panelDecidingKeys(registry, config) {
  return [...new Set([
    ...Object.keys(config.ranges ?? {}),
    ...defaultBaselineFeatures(registry, config.allowBorrowedExpression === true),
  ])];
}

/** The immutable identity of one dataset: enough to fetch and check it again. */
export function datasetDefinition(dataset) {
  const record = dataset.record ?? {};
  const source = dataset.source ?? {};
  return {
    id: dataset.id,
    metricKey: dataset.metricKey,
    studyId: record.studyId ?? null,
    conditionSet: record.conditionSet ?? null,
    dataType: record.dataType ?? null,
    platform: record.platform ?? null,
    quantity: source.quantity ?? null,
    file: source.file ?? null,
    sha256: source.sha256 ?? null,
  };
}

/**
 * Every value as text, a missing one as nothing, so a gene changing from 0 to
 * unknown, a file landing, or one number moving all change the digest.
 */
function valueSummary(metric, geneCount) {
  const cells = [];
  let finite = 0;
  for (let index = 0; index < geneCount; index += 1) {
    const value = metric.read(index);
    if (Number.isFinite(value)) {
      finite += 1;
      cells.push(String(value));
    } else cells.push('');
  }
  return { valueCount: finite, missingCount: geneCount - finite, valueDigest: fnv1a64(cells.join(',')) };
}

function sortedObject(value) {
  return Object.fromEntries(Object.entries(value ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/**
 * Describe the sources and values that decide a design.
 *
 * @param {{registry: object, config: object, geneCount: number,
 *   sources?: {selection: string[], selected: (key: string) => object[],
 *     contributing: (key: string) => object[]}|null,
 *   typeSources?: Record<string, string>, tssRecodingEvidence?: object|null}} options
 *   `sources` is the resolved Data Sources membership; without it a type
 *   metric is described by its values alone.
 * @returns {{selection: string[], typeSources: object, metrics: object[],
 *   tssRecodingEvidence: {available: boolean, reason: string|null}}}
 */
export function describePanelSources({
  registry, config, geneCount, sources = null, typeSources = {}, tssRecodingEvidence = null,
}) {
  const metrics = panelDecidingKeys(registry, config).map((key) => {
    const metric = registry.byKey.get(key);
    if (!metric) return { key, available: false };
    const entry = {
      key,
      available: true,
      label: metric.label,
      unit: metric.unit ?? '',
      // A type reading no dataset has no organism to be borrowed from.
      borrowed: metric.isType && !metric.provenance ? null : isBorrowedMetric(metric),
      provenanceId: metric.provenance?.id ?? null,
      ...valueSummary(metric, geneCount),
    };
    if (!metric.isType) return entry;
    const contributing = sources?.contributing(key) ?? [];
    return {
      ...entry,
      reading: contributing.length > 1 ? 'pooled' : contributing.length === 1 ? 'single' : 'none',
      named: typeSources?.[key] ?? null,
      selected: (sources?.selected(key) ?? []).map((dataset) => dataset.id),
      contributing: contributing.map(datasetDefinition),
    };
  });
  return {
    selection: [...(sources?.selection ?? [])],
    typeSources: sortedObject(typeSources),
    metrics,
    tssRecodingEvidence: {
      available: Boolean(tssRecodingEvidence?.available),
      reason: tssRecodingEvidence?.reason ?? null,
    },
  };
}

/**
 * The part of a description that decides the panel and its export: the
 * deciding metrics and the TSS evidence state. The whole selection is recorded
 * but left out, so deselecting a dataset no deciding metric reads is not a
 * change to this panel.
 */
export function panelSourceKey(description) {
  return canonicalJson({
    metrics: description.metrics,
    tssRecodingEvidence: description.tssRecodingEvidence,
  });
}

/** One short identifier for a description, written on every exported row. */
export function panelSourceStateId(description) {
  return fnv1a64(panelSourceKey(description));
}

/** The datasets each source-dependent deciding metric read, as one CSV cell. */
export function designMetricSourcesCell(description) {
  const parts = description.metrics
    .filter((entry) => entry.reading)
    .map((entry) => `${entry.key}=${entry.reading}`
      + (entry.contributing.length ? `:${entry.contributing.map((dataset) => dataset.id).join('+')}` : ''));
  return parts.length ? parts.join('; ') : 'none';
}
