/**
 * URL hash serialization.
 *
 * A link reproduces the exact view: panel, colour, metric axes, recoding
 * scheme, filters, shortlist, pinned gene, and comparison tab.
 */
import { serializeSchemeMap, parseSchemeMap } from './scheme.js';
import { DEFAULT_METRIC_AXES, DEFAULT_AXIS_SCALE, AXIS_SCALES } from './metric-axes.js';
import { CATEGORY_FILTER_IDS } from './function-categories.js';
import {
  DEFAULT_COLOR_SOURCES, isAllSources, normalizeAnnotationSources, parseAnnotationSources,
  NO_SOURCES,
} from './annotation-source.js';
import {
  DEFAULT_PANEL_ORDER, DEFAULT_PANEL_COLLAPSED, NO_PANELS_COLLAPSED,
  normalizePanelOrder, normalizeCollapsed, isDefaultPanelOrder, isDefaultCollapsed,
} from './left-panels.js';

const KEYS = {
  panel: 'p', colorBy: 'c', scheme: 's', schemeName: 'n', highExpressed: 'x',
  filters: 'f', shortlist: 'l', pinned: 'g', compareTab: 't', showHidden: 'v',
  exceptionFilter: 'e', expressionFilter: 'm', trafficKey: 'k', version: 'ver',
  lengthCohort: 'lc', proteinFilter: 'pr', axisX: 'ax', axisY: 'ay',
  categoryFilter: 'cf', colorSources: 'cs', axisXScale: 'xs', axisYScale: 'ys',
  panelOrder: 'po', panelCollapsed: 'pc', compareAxes: 'cm',
};

/**
 * Encoding version. A hash carrying `ver` was produced by this encoder, so its
 * absence of a field (other than `ver` itself) means that field is genuinely
 * unset, not merely omitted by an older encoder. Bump this only when a change
 * to what gets encoded could make an older reader misinterpret a newer hash
 * (or vice versa) `l`'s explicit-empty behaviour below is why version 1 became 2,
 * the fresh-view metric axes are why version 2 became 3, dropping the
 * single-source view field `as` for the colour-source toggles `cs` is why
 * version 3 became 4, and the controls-column layout (`po`, `pc`) with the
 * chosen comparison metrics (`cm`) is why version 4 became 5.
 */
export const STATE_VERSION = 5;

/**
 * The first encoder version whose omitted `ax`/`ay` mean today's measured
 * fresh-view axes. Up to and including version 2 an omitted axis pair meant CDS
 * length against CAI, so a link shared then must keep plotting that pair: the
 * hash is the experiment someone recorded, and re-reading it as a different
 * pair of metrics would silently change what a colleague was shown.
 */
export const MEASURED_AXES_VERSION = 3;

/** What an omitted `ax`/`ay` meant in encoder versions 1 and 2. */
export const LEGACY_METRIC_AXES = Object.freeze({ x: 'lengthNt', y: 'cai' });

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
    colorSources: [...DEFAULT_COLOR_SOURCES],
    shortlist: [],
    pinnedId: null,
    compareTab: 'radar',
    showHidden: true,
    exceptionFilter: 'any',
    expressionFilter: 'any',
    trafficKey: null,
    lengthCohort: 'annotated',
    proteinFilter: 'any',
    axisX: DEFAULT_METRIC_AXES.x,
    axisY: DEFAULT_METRIC_AXES.y,
    axisXScale: DEFAULT_AXIS_SCALE,
    axisYScale: DEFAULT_AXIS_SCALE,
    panelOrder: [...DEFAULT_PANEL_ORDER],
    panelCollapsed: [...DEFAULT_PANEL_COLLAPSED],
    compareAxes: null,
  };
}

/** Restore the controls column to its fresh order and collapsed set. */
export function resetPanelLayout(state) {
  state.panelOrder = [...DEFAULT_PANEL_ORDER];
  state.panelCollapsed = [...DEFAULT_PANEL_COLLAPSED];
  return state;
}

/** Drop a chosen comparison-metric set, returning the view to its defaults. */
export function resetCompareAxes(state) {
  state.compareAxes = null;
  return state;
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

/**
 * The subset of application state an export manifest records as `viewState`:
 * the panel and axis choices that change how the plotted numbers read,
 * without the filter or shortlist fields exported separately. Kept here, next
 * to the fields' URL encoding, so a field added to one is added to the other
 * in the same place rather than drifting apart across two hand-kept lists.
 */
export function viewStateOf(state) {
  return {
    panel: state.panel,
    colorBy: state.colorBy,
    axisX: state.axisX,
    axisY: state.axisY,
    axisXScale: state.axisXScale,
    axisYScale: state.axisYScale,
    categoryFilter: state.categoryFilter,
    colorSources: normalizeAnnotationSources(state.colorSources),
  };
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
  // Every colour source on is the fresh default and leaves no field. Otherwise
  // the enabled toggles are listed, or `none` when every toggle is off: an
  // empty value would be dropped by `push` and read back as the default.
  if (!isAllSources(state.colorSources)) {
    const enabled = normalizeAnnotationSources(state.colorSources);
    push(KEYS.colorSources, enabled.length === 0 ? NO_SOURCES : enabled.join(','));
  }
  push(KEYS.trafficKey, state.trafficKey);
  if (state.lengthCohort !== 'annotated') push(KEYS.lengthCohort, state.lengthCohort);
  if (state.proteinFilter !== 'any') push(KEYS.proteinFilter, state.proteinFilter);
  // Only a nondefault axis is encoded, and a decoded one is applied after the
  // defaults, so an explicit `ax`/`ay` in a link always wins over the
  // fresh-view axes.
  if (state.axisX !== DEFAULT_METRIC_AXES.x) push(KEYS.axisX, state.axisX);
  if (state.axisY !== DEFAULT_METRIC_AXES.y) push(KEYS.axisY, state.axisY);
  // A per-axis scale is a wholly new field with no legacy meaning to preserve,
  // so unlike `ax`/`ay` it is simply omitted when linear, the fresh default.
  if (state.axisXScale && state.axisXScale !== DEFAULT_AXIS_SCALE) {
    push(KEYS.axisXScale, state.axisXScale);
  }
  if (state.axisYScale && state.axisYScale !== DEFAULT_AXIS_SCALE) {
    push(KEYS.axisYScale, state.axisYScale);
  }
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
  // The controls-column layout encodes only when it differs from the fresh
  // view, so an ordinary link stays short. `pc` needs the explicit `none`
  // sentinel because "nothing is collapsed" is a deliberate arrangement, not
  // the default, and an empty value would be dropped by `push` and read back
  // as the gene visualizer being collapsed again.
  // Both fields are encoded only when the caller actually supplies them. A
  // state object that omits the layout entirely is not asserting an empty
  // collapsed set, and writing `pc=none` for it would turn silence into a
  // claim that every panel is open.
  if (Array.isArray(state.panelOrder) && !isDefaultPanelOrder(state.panelOrder)) {
    push(KEYS.panelOrder, normalizePanelOrder(state.panelOrder).join(','));
  }
  if (Array.isArray(state.panelCollapsed) && !isDefaultCollapsed(state.panelCollapsed)) {
    const collapsed = normalizeCollapsed(state.panelCollapsed);
    push(KEYS.panelCollapsed, collapsed.length === 0 ? NO_PANELS_COLLAPSED : collapsed.join(','));
  }
  // A null `compareAxes` means the comparison is on its own defaults, which
  // already adapt to the dataset, so it is left unsaid rather than frozen into
  // a link as whatever those defaults resolved to today.
  if (Array.isArray(state.compareAxes) && state.compareAxes.length > 0) {
    push(KEYS.compareAxes, state.compareAxes.join(','));
  }
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
  // Versions up to 3 wrote `as` for the single-source annotation view, which
  // no longer exists: that field is read past without error and dropped, so an
  // old link opens on the combined view. Version 4 writes `cs` for the
  // colour-source toggles as a comma list or `none`.
  if (values.has(KEYS.colorSources)) {
    const sources = parseAnnotationSources(values.get(KEYS.colorSources));
    if (sources !== null) state.colorSources = sources;
  }
  if (values.has(KEYS.axisX)) state.axisX = values.get(KEYS.axisX);
  if (values.has(KEYS.axisY)) state.axisY = values.get(KEYS.axisY);
  if (values.has(KEYS.axisXScale)) {
    const scale = values.get(KEYS.axisXScale);
    if (AXIS_SCALES.includes(scale)) state.axisXScale = scale;
  }
  if (values.has(KEYS.axisYScale)) {
    const scale = values.get(KEYS.axisYScale);
    if (AXIS_SCALES.includes(scale)) state.axisYScale = scale;
  }
  // A snapshot this viewer wrote before the measured fresh-view axes omits
  // `ax`/`ay` exactly when it plotted CDS length against CAI. Make that meaning
  // explicit, so `applyDecoded` writes it over today's default and an already
  // shared link keeps the axes its author saw. Only a declared older version
  // migrates: `encodeState` always writes `ver`, so a hash without one was not
  // produced here and leaves the axes genuinely unspecified; axes have no
  // local persistence, so precedence rule 3 supplies the fresh-view default
  // rather than a guessed legacy pair. A fresh view opens on the measured
  // axes, and an explicit `ax`/`ay` wins over both.
  if (values.has(KEYS.panelOrder)) {
    state.panelOrder = normalizePanelOrder(values.get(KEYS.panelOrder).split(','));
  }
  if (values.has(KEYS.panelCollapsed)) {
    const raw = values.get(KEYS.panelCollapsed);
    state.panelCollapsed = raw === NO_PANELS_COLLAPSED ? [] : normalizeCollapsed(raw.split(','));
  }
  if (values.has(KEYS.compareAxes)) {
    // Metric keys are validated against the live registry by the comparison
    // itself, which is the only place that knows which metrics this dataset
    // carries. Empty means "say nothing", not "choose no metrics", because a
    // comparison with no axes cannot be drawn.
    const keys = values.get(KEYS.compareAxes).split(',').filter(Boolean);
    if (keys.length > 0) state.compareAxes = [...new Set(keys)];
  }
  if (Number.isFinite(state.version) && state.version < MEASURED_AXES_VERSION) {
    if (!values.has(KEYS.axisX)) state.axisX = LEGACY_METRIC_AXES.x;
    if (!values.has(KEYS.axisY)) state.axisY = LEGACY_METRIC_AXES.y;
  }
  return state;
}
