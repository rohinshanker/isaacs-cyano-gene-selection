/** Independent dataset selections for the two explicit metric axes. */
import {
  contributingDatasets, defaultDatasetsOfType, isTypeKey, typeGroups,
} from './type-metrics.js';

/** Every admitted dataset that can inform one type metric, in catalogue order. */
export function availableAxisDatasets(metricKey, datasets) {
  if (!isTypeKey(metricKey)) return [];
  return typeGroups(datasets).get(metricKey)?.datasets ?? [];
}

/**
 * Keep only unique datasets of the axis metric's exact type. Catalogue order
 * makes pooling and the deterministic first choice for non-pooling quantities
 * stable across links and browsers.
 */
export function normalizeAxisDatasetSelection(metricKey, ids, datasets) {
  if (!Array.isArray(ids)) return null;
  const chosen = new Set(ids);
  return availableAxisDatasets(metricKey, datasets)
    .filter((dataset) => chosen.has(dataset.id))
    .map((dataset) => dataset.id);
}

/** The independent selection a newly chosen type metric starts with. */
export function defaultAxisDatasetSelection(metricKey, datasets) {
  return defaultDatasetsOfType(metricKey, datasets).map((dataset) => dataset.id);
}

/**
 * Copy what an older link actually read into one axis. This is a one-time
 * migration value: callers store the returned ids on that axis, so later
 * global colour/PCA changes cannot move it.
 */
export function legacyAxisDatasetSelection(
  metricKey,
  datasets,
  globalSelection,
  globalTypeSources,
) {
  if (!isTypeKey(metricKey)) return [];
  const contributors = contributingDatasets(
    metricKey,
    globalTypeSources,
    datasets,
    globalSelection,
  );
  return (contributors.length ? contributors : defaultDatasetsOfType(metricKey, datasets))
    .map((dataset) => dataset.id);
}

/**
 * Resolve the requested contributors separately from the contributors whose
 * values can be read now. A loading or retryable file remains requested but is
 * excluded from the calculation until it settles, so a partial pool cannot
 * present one ready dataset as if every selected dataset contributed.
 */
export function resolveAxisContributors(
  metricKey,
  ids,
  datasets,
  { metricOf, resourceStateOf },
) {
  const selected = normalizeAxisDatasetSelection(metricKey, ids, datasets) ?? [];
  const requested = isTypeKey(metricKey)
    ? contributingDatasets(metricKey, {}, datasets, selected) : [];
  const available = [];
  const affected = [];
  for (const dataset of requested) {
    const metric = metricOf(dataset);
    const state = metric ? resourceStateOf(metric) : null;
    if (state === 'loading' || state === 'failed') affected.push({ dataset, state });
    else if (metric) available.push(dataset);
  }
  const state = affected.some((entry) => entry.state === 'failed') ? 'failed'
    : affected.some((entry) => entry.state === 'loading') ? 'loading' : null;
  return { selected, requested, available, affected, state };
}

/** URL readiness follows requested inputs, including unreadable pending layers. */
export function requestedAxisFileKeys(contributors, metricOf) {
  return [...new Set(contributors.requested
    .map((dataset) => metricOf(dataset)?.fileKey)
    .filter((key) => typeof key === 'string' && key.length > 0))];
}

/** Reader-facing summary for the compact axis control. */
export function axisDatasetSelectionLabel(metricKey, ids, datasets, pools = true) {
  const available = availableAxisDatasets(metricKey, datasets);
  const selected = normalizeAxisDatasetSelection(metricKey, ids, datasets) ?? [];
  if (selected.length === 0) return `Choose datasets (0 of ${available.length})`;
  if (selected.length === 1) {
    const dataset = available.find((candidate) => candidate.id === selected[0]);
    return `${dataset?.record?.studyId ?? selected[0]} · ${dataset?.record?.conditionSet ?? 'selected dataset'}`;
  }
  if (pools) return `Pooled (${selected.length} of ${available.length} datasets)`;
  const first = available.find((candidate) => candidate.id === selected[0]);
  return `${first?.record?.studyId ?? selected[0]} reads alone (${selected.length} selected)`;
}
