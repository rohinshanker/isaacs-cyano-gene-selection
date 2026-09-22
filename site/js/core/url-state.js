/**
 * URL hash serialization.
 *
 * A link reproduces the exact view: panel, colour, metric axes, recoding
 * scheme, filters, shortlist, pinned gene, and comparison tab.
 */
import { serializeSchemeMap, parseSchemeMap } from './scheme.js';
import { CATEGORY_FILTER_IDS } from './function-categories.js';
import { DEFAULT_ANNOTATION_SOURCE, isAnnotationSource } from './annotation-source.js';

const KEYS = {
  panel: 'p', colorBy: 'c', scheme: 's', schemeName: 'n', highExpressed: 'x',
  filters: 'f', shortlist: 'l', pinned: 'g', compareTab: 't', showHidden: 'v',
  exceptionFilter: 'e', expressionFilter: 'm', trafficKey: 'k', version: 'ver',
  lengthCohort: 'lc', proteinFilter: 'pr', axisX: 'ax', axisY: 'ay',
  categoryFilter: 'cf', annotationSource: 'as',
};

/**
 * Encoding version. A hash carrying `ver` was produced by this encoder, so its
 * absence of a field (other than `ver` itself) means that field is genuinely
 * unset, not merely omitted by an older encoder. Bump this only when a change
 * to what gets encoded could make an older reader misinterpret a newer hash
 * (or vice versa) `l`'s explicit-empty behaviour below is why version 1 became 2.
 */
export const STATE_VERSION = 2;

/** Values the expression-basis filter can take. */
export const EXPRESSION_FILTERS = Object.freeze(['any', 'measured']);

/**
 * A fresh defaults object, not a shared reference: several of these fields
 * (`shortlist` above all) are mutated in place by the app, so reusing one
 * literal across calls would let a later mutation corrupt what "default"
 * means for the next reset.
 */
export function defaultState() {
  return {
    panel: 'native',
    colorBy: null,
    schemeMap: {},
    schemeName: '',
    highExpressed: false,
    filters: {},
    categoryFilter: [],
    annotationSource: DEFAULT_ANNOTATION_SOURCE,
    shortlist: [],
    pinnedId: null,
    compareTab: 'radar',
    showHidden: true,
    exceptionFilter: 'any',
    expressionFilter: 'any',
    trafficKey: null,
    lengthCohort: 'annotated',
    proteinFilter: 'any',
    axisX: 'lengthNt',
    axisY: 'cai',
  };
}

/** Clear committed gene choices while preserving the analytical view. */
export function clearSelections(state) {
  state.pinnedId = null;
  state.shortlist = [];
  return state;
}

/**
 * Apply a decoded (partial) hash onto `target`, in place, honouring
 * precedence: every field is reset to its default first, and only then does
 * an explicit `decoded` value override it.
 *
 * This reset-first order is the whole point. `encodeState` only ever writes
 * non-default fields (a plain view has a plain link), so a hash that means
 * "the scheme is cleared" or "the traffic metric is unset" says nothing
 * about `s` or `k` at all. Merging `decoded` onto whatever is already in
 * `target` — instead of onto a fresh default — would leave that old scheme
 * or traffic metric displayed forever: the address bar says one thing, the
 * page still shows another. That was a real, shipped bug.
 */
export function applyDecoded(target, decoded) {
  Object.assign(target, defaultState(), decoded);
  return target;
}

function encodeFilters(filters) {
  return Object.entries(filters)
    .map(([key, range]) => {
      const min = Number.isFinite(range.min) ? Number(range.min.toPrecision(8)) : '';
      const max = Number.isFinite(range.max) ? Number(range.max.toPrecision(8)) : '';
      // A trailing 0 records that genes with no measurement are dropped, which is
      // never the default and so must survive in a shared link.
      return `${key}:${min}:${max}${range.includeMissing === false ? ':0' : ''}`;
    })
    .join(',');
}

function decodeFilters(text) {
  const filters = {};
  if (!text) return filters;
  for (const part of text.split(',')) {
    const [key, min, max, missing] = part.split(':');
    if (!key) continue;
    filters[key] = {
      min: min === '' || min === undefined ? null : Number(min),
      max: max === '' || max === undefined ? null : Number(max),
      includeMissing: missing !== '0',
    };
  }
  return filters;
}

/** Serialize the shareable part of the application state into a hash string. */
export function encodeState(state) {
  const parts = [`${KEYS.version}=${STATE_VERSION}`];
  const push = (key, value) => {
    if (value === '' || value === null || value === undefined) return;
    parts.push(`${key}=${encodeURIComponent(value)}`);
  };
  push(KEYS.panel, state.panel);
  push(KEYS.colorBy, state.colorBy);
  push(KEYS.scheme, serializeSchemeMap(state.schemeMap));
  push(KEYS.schemeName, state.schemeName);
  if (state.highExpressed) push(KEYS.highExpressed, '1');
  push(KEYS.filters, encodeFilters(state.filters));
  push(KEYS.categoryFilter, [...(state.categoryFilter ?? [])].sort().join(','));
  if (state.annotationSource && state.annotationSource !== DEFAULT_ANNOTATION_SOURCE) {
    push(KEYS.annotationSource, state.annotationSource);
  }
  push(KEYS.trafficKey, state.trafficKey);
  if (state.lengthCohort !== 'annotated') push(KEYS.lengthCohort, state.lengthCohort);
  if (state.proteinFilter !== 'any') push(KEYS.proteinFilter, state.proteinFilter);
  if (state.axisX !== 'lengthNt') push(KEYS.axisX, state.axisX);
  if (state.axisY !== 'cai') push(KEYS.axisY, state.axisY);
  // Always present, and never through `push`: an omitted shortlist means "the
  // hash does not speak to this," which is how a recipient's own localStorage
  // shortlist survives an old-style partial link. Every state this app
  // produces is a complete snapshot, so it always says so explicitly, even
  // when the shortlist is empty.
  parts.push(`${KEYS.shortlist}=${encodeURIComponent(state.shortlist.join(','))}`);
  push(KEYS.pinned, state.pinnedId ?? '');
  push(KEYS.compareTab, state.compareTab);
  if (state.exceptionFilter && state.exceptionFilter !== 'any') {
    push(KEYS.exceptionFilter, state.exceptionFilter);
  }
  if (state.expressionFilter && state.expressionFilter !== 'any') {
    push(KEYS.expressionFilter, state.expressionFilter);
  }
  if (!state.showHidden) push(KEYS.showHidden, '0');
  return parts.join('&');
}

/** Parse a hash string into a partial state. Unknown or malformed parts are ignored. */
export function decodeState(hash) {
  const text = hash.startsWith('#') ? hash.slice(1) : hash;
  const values = new Map();
  for (const part of text.split('&')) {
    if (!part) continue;
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    try {
      values.set(part.slice(0, separator), decodeURIComponent(part.slice(separator + 1)));
    } catch {
      // One damaged field must not strand the whole viewer on its loading state.
      // Other well-formed fields in the same shared link remain usable.
    }
  }
  const state = {};
  if (values.has(KEYS.version)) state.version = Number(values.get(KEYS.version)) || undefined;
  if (values.has(KEYS.panel)) state.panel = values.get(KEYS.panel);
  if (values.has(KEYS.colorBy)) state.colorBy = values.get(KEYS.colorBy);
  if (values.has(KEYS.scheme)) state.schemeMap = parseSchemeMap(values.get(KEYS.scheme));
  if (values.has(KEYS.schemeName)) state.schemeName = values.get(KEYS.schemeName);
  if (values.has(KEYS.highExpressed)) state.highExpressed = values.get(KEYS.highExpressed) === '1';
  if (values.has(KEYS.filters)) state.filters = decodeFilters(values.get(KEYS.filters));
  if (values.has(KEYS.categoryFilter)) {
    const ids = values.get(KEYS.categoryFilter).split(',')
      .filter((id) => CATEGORY_FILTER_IDS.includes(id));
    state.categoryFilter = [...new Set(ids)].sort();
  }
  if (values.has(KEYS.shortlist)) {
    state.shortlist = values.get(KEYS.shortlist).split(',').filter(Boolean);
  }
  if (values.has(KEYS.pinned)) state.pinnedId = values.get(KEYS.pinned) || null;
  if (values.has(KEYS.compareTab)) state.compareTab = values.get(KEYS.compareTab);
  if (values.has(KEYS.exceptionFilter)) {
    const mode = values.get(KEYS.exceptionFilter);
    if (['any', 'only', 'none'].includes(mode)) state.exceptionFilter = mode;
  }
  if (values.has(KEYS.expressionFilter)) {
    const mode = values.get(KEYS.expressionFilter);
    if (EXPRESSION_FILTERS.includes(mode)) state.expressionFilter = mode;
  }
  if (values.has(KEYS.showHidden)) state.showHidden = values.get(KEYS.showHidden) !== '0';
  if (values.has(KEYS.trafficKey)) state.trafficKey = values.get(KEYS.trafficKey);
  if (values.has(KEYS.lengthCohort)) {
    const cohort = values.get(KEYS.lengthCohort);
    if (['annotated', 'coding', 'cds', 'refseq', 'rna', 'pseudogene'].includes(cohort)) {
      state.lengthCohort = cohort;
    }
  }
  if (values.get(KEYS.proteinFilter) === 'refseq') state.proteinFilter = 'refseq';
  if (values.has(KEYS.annotationSource)) {
    const source = values.get(KEYS.annotationSource);
    if (isAnnotationSource(source)) state.annotationSource = source;
  }
  if (values.has(KEYS.axisX)) state.axisX = values.get(KEYS.axisX);
  if (values.has(KEYS.axisY)) state.axisY = values.get(KEYS.axisY);
  return state;
}
