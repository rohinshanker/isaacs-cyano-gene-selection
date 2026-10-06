/**
 * The datasets the Data Sources window offers, and the rules that arrange them.
 *
 * DOM-free on purpose: which datasets exist, how they group, which pairs count
 * as comparable, what a filter keeps, and what the default selection is are all
 * things a shared link encodes or a test pins, so they live here and the panel
 * in `ui/data-sources.js` renders whatever this module says.
 *
 * Every dataset is one entry of `meta.expressionSources` carrying the
 * structured condition `record` the pipeline validates. Nothing here invents a
 * value for an axis a record does not report: an unreported axis neither passes
 * nor fails a comparison, and is drawn as missing, never as zero.
 */

/** The three condition axes drawn as tracks, on one shared scale each. */
export const CONDITION_SCALES = Object.freeze({
  temperature: Object.freeze({
    name: 'Temp °C', unit: '°C', min: 15, max: 45, log: false,
    ticks: Object.freeze([20, 25, 30, 35, 40]), labels: Object.freeze([20, 30, 40]),
    bands: Object.freeze([[28, 32, 'standard'], [36, 40, 'elevated']]), rule: null,
  }),
  lightIntensity: Object.freeze({
    name: 'Light µmol m⁻² s⁻¹ (log)', unit: 'µmol', min: 3, max: 1000, log: true,
    ticks: Object.freeze([10, 30, 100, 300, 1000]), labels: Object.freeze([10, 100, 1000]),
    bands: Object.freeze([]), rule: 400,
  }),
  co2: Object.freeze({
    name: 'CO₂ %', unit: '%', min: 0, max: 5.5, log: false,
    ticks: Object.freeze([1, 2, 3, 4, 5]), labels: Object.freeze([1, 2, 3, 4, 5]),
    bands: Object.freeze([[1, 5.5, 'standard']]), rule: null,
  }),
});

/**
 * The regime a reported range sits in, which is what the mark's colour repeats
 * (position carries the value; colour is never the only channel).
 */
export function regimeOf(axis, range) {
  if (!range) return 'unknown';
  const [lo, hi] = range;
  if (axis === 'temperature') {
    if (lo >= 27 && hi <= 32.5) return 'standard';
    if (lo >= 36 && hi <= 40) return 'elevated';
    return 'outside';
  }
  if (axis === 'lightIntensity') return hi <= 400 ? 'standard' : lo > 400 ? 'elevated' : 'outside';
  if (hi < 0.5) return 'ambient';
  return lo >= 1 ? 'standard' : 'outside';
}

/** The advisory groups, in display order, with the rule each header states. */
export const DATASET_GROUPS = Object.freeze([
  Object.freeze({ id: 'biofilm', name: 'Biofilm, bioreactor and co-culture', rule: 'a biofilm assay, a bioreactor, or a second organism in the culture' }),
  Object.freeze({ id: 'elevated', name: 'Elevated temperature or high light', rule: 'temperature 36–40 °C, or light above 400 µmol photons m⁻² s⁻¹' }),
  Object.freeze({ id: 'stress', name: 'Stress and nutrient perturbation', rule: 'an applied stress or nutrient change' }),
  Object.freeze({ id: 'diel', name: 'Diel and circadian', rule: 'sampled across a light–dark cycle or a circadian free-run' }),
  Object.freeze({ id: 'standard', name: 'Standard photoautotrophic growth', rule: 'BG-11, 28–32 °C, ≤ 400 µmol, continuous light, planktonic, no applied stress' }),
  Object.freeze({ id: 'other', name: 'Other', rule: 'fits no group above, or too little is reported to place it' }),
]);

export const DATA_TYPES = Object.freeze([
  Object.freeze({ id: 'transcriptomics', name: 'Transcriptomics' }),
  Object.freeze({ id: 'proteomics', name: 'Proteomics' }),
  Object.freeze({ id: 'fitness', name: 'Fitness screen' }),
]);

/** Groups that never get a select-all control: the owner's "other section". */
export const NO_SELECT_ALL_GROUPS = Object.freeze(['other']);

/**
 * The datasets a loaded `meta.json` declares. Only an entry with a metric key
 * and a condition record counts; the registry decides separately whether the
 * metric has any values.
 * @param {object} meta
 * @returns {object[]}
 */
export function datasetsFrom(meta) {
  return (meta?.expressionSources ?? [])
    .filter((source) => source && typeof source.id === 'string'
      && typeof source.metricKey === 'string' && source.record && source.record.conditions)
    .map((source) => ({
      id: source.id,
      metricKey: source.metricKey,
      label: source.label ?? source.id,
      record: source.record,
      source,
    }));
}

const rangeOf = (axis) => (axis && (axis.status === 'reported' || axis.status === 'conflicting')
  && typeof axis.lo === 'number' && typeof axis.hi === 'number') ? [axis.lo, axis.hi] : null;

/** A reported numeric range for one of the three track axes, or null. */
export function conditionRange(dataset, axis) {
  return rangeOf(dataset.record.conditions[axis]);
}

const gap = (a, b) => Math.max(0, Math.max(a[0], b[0]) - Math.min(a[1], b[1]));
const ratio = (a, b) => { const lo = Math.max(a[0], b[0]); const hi = Math.min(a[1], b[1]); return lo <= hi ? 1 : lo / hi; };
const TOLERANCE = Object.freeze({
  default: Object.freeze({ temperature: 2, light: 1.25, co2: 2 }),
  wide: Object.freeze({ temperature: 3, light: 1.5, co2: 3 }),
});
const treatmentKey = (dataset) => dataset.record.treatments
  .filter((tag) => !/\(subset\)/.test(tag)).slice().sort().join('|');
const regimeKind = (dataset) => dataset.record.conditions.lightRegime.kind ?? null;
const spectrumClass = (dataset) => dataset.record.conditions.lightRegime.spectrumClass ?? null;

/**
 * The owner's judgement on a pair, if one is recorded. Pairs are named by study
 * and condition-table row, which is how the review sheet names them.
 */
function judgementFor(a, b, judgements) {
  const key = (d) => `${d.record.studyId}#${d.record.conditionTableRow ?? ''}`;
  const ka = key(a); const kb = key(b);
  return (judgements ?? []).find((j) => {
    const ja = `${j.a.studyId}#${j.a.row ?? ''}`; const jb = `${j.b.studyId}#${j.b.row ?? ''}`;
    return (ja === ka && jb === kb) || (ja === kb && jb === ka);
  }) ?? null;
}

/**
 * Whether two condition sets sit in one comparable subgroup.
 *
 * Owner decision, 2026-10-05: a recorded pair judgement wins, and a conditional
 * judgement wins only where its condition can be checked (today the one such
 * condition is "the same kind of light regime on both sides"). Otherwise every
 * axis both sides report must pass the default thresholds, an axis only one
 * side reports neither passes nor fails, at least three axes must be shared,
 * and the treatment tags must match. Widened tolerances are the scoring's
 * narrow-miss bounds, offered because the owner may redraw the boundary.
 */
export function comparable(a, b, { judgements = [], tolerance = 'default' } = {}) {
  const judged = judgementFor(a, b, judgements);
  if (judged?.call === 'share') return true;
  if (judged?.call === 'separate' || judged?.call === 'undecided') return false;
  if (judged?.call === 'conditional' && regimeKind(a) && regimeKind(b)) {
    return regimeKind(a) === regimeKind(b);
  }
  const tol = TOLERANCE[tolerance] ?? TOLERANCE.default;
  if (treatmentKey(a) !== treatmentKey(b)) return false;
  const ca = a.record.conditions; const cb = b.record.conditions;
  let shared = 0;
  const ta = rangeOf(ca.temperature); const tb = rangeOf(cb.temperature);
  if (ta && tb) {
    if (gap(ta, tb) > tol.temperature || regimeOf('temperature', ta) !== regimeOf('temperature', tb)) return false;
    shared += 1;
  }
  const ia = rangeOf(ca.lightIntensity); const ib = rangeOf(cb.lightIntensity);
  if (ia && ib) {
    if (ratio(ia, ib) > tol.light || regimeOf('lightIntensity', ia) !== regimeOf('lightIntensity', ib)) return false;
    shared += 1;
  }
  if (regimeKind(a) && regimeKind(b)) {
    if (regimeKind(a) !== regimeKind(b)) return false;
    const pa = ca.lightRegime.photoperiod; const pb = cb.lightRegime.photoperiod;
    if (pa && pb && pa !== pb) return false;
    shared += 1;
  }
  if (spectrumClass(a) && spectrumClass(b) && spectrumClass(a) !== spectrumClass(b)) return false;
  const xa = rangeOf(ca.co2); const xb = rangeOf(cb.co2);
  if (xa && xb) {
    if (regimeOf('co2', xa) !== regimeOf('co2', xb) || ratio(xa, xb) > tol.co2) return false;
    shared += 1;
  }
  if (ca.medium.base && cb.medium.base) {
    if (ca.medium.base !== cb.medium.base || ca.medium.conditioned !== cb.medium.conditioned
      || ca.medium.nitrogenAltered !== cb.medium.nitrogenAltered) return false;
    shared += 1;
  }
  if (ca.format.value && cb.format.value && ca.format.value !== cb.format.value) return false;
  const phases = new Set(['exponential', 'stationary']);
  if (phases.has(ca.phase.label) && phases.has(cb.phase.label) && ca.phase.label !== cb.phase.label) return false;
  return shared >= 3;
}

/**
 * Complete-linkage sets: every member is comparable with every other member.
 * Singletons are the sets with no partner, listed separately and never under a
 * select-all control.
 */
export function subgroups(datasets, options = {}) {
  const sets = [];
  for (const dataset of datasets) {
    const home = sets.find((set) => set.every((member) => comparable(dataset, member, options)));
    if (home) home.push(dataset); else sets.push([dataset]);
  }
  return {
    sets: sets.filter((set) => set.length > 1),
    singles: sets.filter((set) => set.length === 1).map((set) => set[0]),
  };
}

/** A range's text, in the axis unit, with a single value shown once. */
export function formatRange(range, unit) {
  return range[0] === range[1] ? `${range[0]} ${unit}` : `${range[0]}–${range[1]} ${unit}`;
}

/** One line naming what a comparable set has in common, for its header. */
export function summariseSet(datasets) {
  const span = (axis, unit) => {
    const ranges = datasets.map((d) => conditionRange(d, axis)).filter(Boolean);
    if (!ranges.length) return null;
    return formatRange([Math.min(...ranges.map((r) => r[0])), Math.max(...ranges.map((r) => r[1]))], unit);
  };
  const kinds = [...new Set(datasets.map(regimeKind).filter(Boolean))]
    .map((kind) => (kind === 'continuous' ? 'continuous light' : 'diel'));
  return [span('temperature', '°C'), span('lightIntensity', 'µmol'), span('co2', '% CO₂'), kinds.join(' / ')]
    .filter(Boolean).join(' · ');
}

/**
 * The groups of one data type, each with its subgroups. A group splits into
 * subgroups only when it has at least one comparable set and more than one
 * part in total; otherwise its rows are listed flat under the group header.
 */
export function groupDatasets(datasets, options = {}) {
  const groups = [];
  for (const group of DATASET_GROUPS) {
    const members = datasets.filter((d) => d.record.group === group.id);
    if (!members.length) continue;
    const { sets, singles } = subgroups(members, options);
    const split = sets.length > 0 && sets.length + (singles.length ? 1 : 0) > 1;
    groups.push({
      ...group,
      datasets: members,
      selectAll: !NO_SELECT_ALL_GROUPS.includes(group.id),
      split,
      sets: split ? sets : [],
      singles: split ? singles : [],
    });
  }
  return groups;
}

/**
 * Eight categorical hues, validated for colour-blind separation (see the
 * dataviz palette); a ninth study folds to the neutral slot, and the legend
 * names every colour, so no study is identified by colour alone.
 */
export const STUDY_PALETTE = Object.freeze([
  '#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948',
]);
export const STUDY_NEUTRAL = '#8b9199';

/** Study id → colour, assigned in a fixed order so a filter never repaints a row. */
export function studyColors(datasets) {
  const studies = [...new Set(datasets.map((d) => d.record.studyId))];
  return new Map(studies.map((study, index) => [study, STUDY_PALETTE[index] ?? STUDY_NEUTRAL]));
}

/** The custom filters a reader can add, and how each reads a dataset. */
export const FILTER_FIELDS = Object.freeze({
  temperature: Object.freeze({ label: 'Temperature °C', kind: 'range' }),
  lightIntensity: Object.freeze({ label: 'Light µmol', kind: 'range' }),
  co2: Object.freeze({ label: 'CO₂ %', kind: 'range' }),
  strain: Object.freeze({ label: 'Strain', kind: 'choice', values: (d) => [d.record.strain] }),
  platform: Object.freeze({ label: 'Platform', kind: 'choice', values: (d) => [d.record.platform] }),
  regime: Object.freeze({ label: 'Light regime', kind: 'choice', values: (d) => [regimeKind(d) ?? 'not reported'] }),
  medium: Object.freeze({ label: 'Medium', kind: 'choice', values: (d) => [d.record.conditions.medium.base ?? 'not reported'] }),
  treatment: Object.freeze({ label: 'Treatment', kind: 'choice', values: (d) => (d.record.treatments.length ? d.record.treatments : ['none recorded']) }),
  study: Object.freeze({ label: 'Study or label contains', kind: 'text' }),
});

/** A fresh, empty filter for a field. */
export function emptyFilter(field) {
  const kind = FILTER_FIELDS[field]?.kind;
  if (kind === 'range') return { field, min: null, max: null, includeMissing: false };
  if (kind === 'text') return { field, query: '' };
  if (kind === 'choice') return { field, values: [] };
  return null;
}

/** Whether one dataset passes every filter. A missing range value passes only on request. */
export function passesFilters(dataset, filters) {
  return (filters ?? []).every((filter) => {
    const field = FILTER_FIELDS[filter.field];
    if (!field) return true;
    if (field.kind === 'range') {
      const range = conditionRange(dataset, filter.field);
      if (!range) return Boolean(filter.includeMissing);
      return (filter.min === null || range[1] >= filter.min) && (filter.max === null || range[0] <= filter.max);
    }
    if (field.kind === 'text') {
      const query = (filter.query ?? '').trim().toLowerCase();
      return !query || `${dataset.record.studyId} ${dataset.id} ${dataset.record.conditionSet}`.toLowerCase().includes(query);
    }
    const chosen = filter.values ?? [];
    return chosen.length === 0 || field.values(dataset).some((value) => chosen.includes(value));
  });
}

/**
 * The fresh-view selection: the standard-growth group plus every dataset the
 * site shipped before the window existed, so an old link shows what it showed
 * before (owner decision, 2026-10-05). The shipped set is recognised by the
 * two legacy metric keys rather than listed here, so a rebuild that renames a
 * source does not silently change the default.
 */
export function defaultSelection(datasets) {
  const legacy = new Set(['expression', 'tssInitiation']);
  return datasets
    .filter((d) => d.record.group === 'standard' || legacy.has(d.metricKey))
    .map((d) => d.id)
    .sort();
}

/**
 * Coerce a decoded value into a sorted, duplicate-free list of known dataset
 * ids. Unknown ids are dropped without discarding neighbours; an empty result
 * falls back to the default, because a view with no source at all would hide
 * every measured metric for no reason a link could have meant.
 */
export function normalizeSelection(value, datasets) {
  const known = new Set(datasets.map((d) => d.id));
  const requested = Array.isArray(value) ? value : [];
  const kept = [...new Set(requested.filter((id) => known.has(id)))].sort();
  return kept.length ? kept : defaultSelection(datasets);
}

/** True when `ids` is exactly the fresh-view selection. */
export function isDefaultSelection(ids, datasets) {
  const fresh = defaultSelection(datasets);
  const given = normalizeSelection(ids, datasets);
  return fresh.length === given.length && fresh.every((id, i) => id === given[i]);
}

/** The metric keys the selected datasets supply, for scoping every menu. */
export function selectedMetricKeys(ids, datasets) {
  const chosen = new Set(normalizeSelection(ids, datasets));
  return new Set(datasets.filter((d) => chosen.has(d.id)).map((d) => d.metricKey));
}

/** Which data type the map's colour metric belongs to, or null for a computed metric. */
export function dataTypeOfMetric(metricKey, datasets) {
  return datasets.find((d) => d.metricKey === metricKey)?.record.dataType ?? null;
}
