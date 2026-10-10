/**
 * URL hash serialization.
 *
 * A link reproduces the exact view: panel, colour, metric axes, recoding
 * scheme, filters, shortlist, pinned gene, and comparison tab.
 *
 * The hash is read under the organism the address names in `?org=`, never the
 * other way round: it carries no organism of its own. The one field whose
 * vocabulary is an organism fact is the colour-source set `cs`, so every
 * function that touches it takes the organism and defaults to the default one.
 */
import { serializeSchemeMap, parseSchemeMap } from './scheme.js';
import { DEFAULT_AXIS_SCALE, AXIS_SCALES } from './metric-axes.js';
import { VALUE_SCALES } from './value-scales.js';
import { CATEGORY_FILTER_IDS } from './function-categories.js';
import { OVERLAP_CLASS_IDS } from './gene-overlaps.js';
import {
  defaultColorSources, isAllSources, normalizeAnnotationSources, parseAnnotationSources,
  NO_SOURCES,
} from './annotation-source.js';
import { DEFAULT_ORGANISM } from './organisms.js';
import {
  DEFAULT_PANEL_ORDER, DEFAULT_PANEL_COLLAPSED, NO_PANELS_COLLAPSED,
  normalizePanelOrder, normalizeCollapsed, isDefaultPanelOrder, isDefaultCollapsed,
} from './left-panels.js';
import { DRAW_DIRECTIONS, DEFAULT_DRAW_DIRECTION } from './paint-priority.js';
import { normalizeHiddenMarkers } from './marker-layers.js';

const KEYS = {
  panel: 'p', colorBy: 'c', scheme: 's', schemeName: 'n', highExpressed: 'x',
  filters: 'f', shortlist: 'l', pinned: 'g', compareTab: 't', showHidden: 'v',
  exceptionFilter: 'e', expressionFilter: 'm', trafficKey: 'k', version: 'ver',
  lengthCohort: 'lc', proteinFilter: 'pr', axisX: 'ax', axisY: 'ay',
  categoryFilter: 'cf', colorSources: 'cs', axisXScale: 'xs', axisYScale: 'ys',
  panelOrder: 'po', panelCollapsed: 'pc', colorScale: 'csc', drawOnTop: 'dt',
  sources: 'ds',
  typeSources: 'src',
  fitnessDatasetId: 'fd',
  strainFitnessSources: 'fds',
  axisXSources: 'xds', axisYSources: 'yds',
  hiddenMarkers: 'mk',
  overlapClassFilter: 'og',
};

/**
 * Encoding version. A hash carrying `ver` was produced by this encoder, so its
 * absence of a field (other than `ver` itself) means that field is genuinely
 * unset, not merely omitted by an older encoder. Bump this only when a change
 * to what gets encoded could make an older reader misinterpret a newer hash
 * (or vice versa) `l`'s explicit-empty behaviour below is why version 1 became 2,
 * the fresh-view metric axes are why version 2 became 3, dropping the
 * single-source view field `as` for the colour-source toggles `cs` is why
 * version 3 became 4, the controls-column layout (`po`, `pc`) with the chosen
 * comparison metrics (`cm`) is why version 4 became 5, moving those chosen
 * metrics out of the link into browser storage is why version 5 became 6, and
 * independent X/Y dataset contributor lists are why version 6 became 7.
 *
 * The colour scale `csc` deliberately did not bump it. A version number is only
 * useful where the absence of a field has to mean two different things to two
 * readers, and here it never does: a hash with no `csc` means "the colour
 * metric's own default scale", which is exactly what a fresh view shows, so a
 * link shared before the field existed and one shared after it agree. That is
 * the owner's decision of 2026-09-29, recorded in
 * docs/validation/current-design-answers.md, and it is why no migration branch
 * reads this number for the colour scale. An older deployed reader shown a newer
 * hash ignores `csc` and draws linear, which no version number here could
 * change. The per-axis `xs`/`ys` scales were added on the same reasoning.
 *
 * The draw direction `dt` did not bump it either, on that same test: a hash with
 * no `dt` has to mean one thing, and it does — highest value on top, which is
 * the fresh view. It does *not* mean "the picture this link used to draw", and
 * no number here could make it. Before this field existed the chromosome view
 * put whichever CDS started last on top rather than the highest value, and the
 * no-value and evidence layers moved on both views; `dt=highest` is a different
 * picture from the one an old link drew, and a version bump would not have
 * brought the old one back because there is no code left that draws it. What
 * the test asks is only whether an *omitted* field is ambiguous, and this one
 * is not: it has exactly one meaning and no older one to preserve.
 *
 * The data-source selection `ds` passes the same test. A hash with no `ds`
 * means the fresh-view selection: the sources the site shipped before the
 * Data Sources window existed plus the standard-growth group, which is what an
 * older link drew, since the colour metric it names is encoded separately and
 * still colours the map. The field is written only when the selection differs
 * from that default (owner decision, 2026-10-05).
 *
 * The hidden marker views `mk` pass it too. A hash with no `mk` means every
 * admitted marker layer is drawn in every view, which is the fresh view and
 * is also what every link written before the field existed drew: the marks
 * were visible by default then and had no persisted state at all. So an
 * omitted `mk` has exactly one meaning and no older one to preserve.
 */
export const STATE_VERSION = 7;

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
export function defaultState(organism = DEFAULT_ORGANISM) {
  return {
    panel: 'native',
    colorBy: null,
    // null means "whatever the colour metric's own default scale is", which is
    // resolved once the dataset is loaded and the metric is known. Keeping it
    // null until then is what lets a hash carrying no `csc` be told apart from
    // one that explicitly asks for a linear ramp.
    colorScale: null,
    schemeMap: {},
    schemeName: '',
    highExpressed: false,
    filters: {},
    categoryFilter: [],
    colorSources: defaultColorSources(organism.annotationSources),
    shortlist: [],
    pinnedId: null,
    compareTab: 'radar',
    showHidden: true,
    exceptionFilter: 'any',
    expressionFilter: 'any',
    // The overlapping-gene selection: the OG classes the reader is keeping, as
    // a set, which is the one channel both the OG filter's three states and the
    // colour key's per-class rows write. An omitted `og` means the empty set,
    // which hides nothing — the fresh view, and also what every link written
    // before the field existed drew, so its absence has exactly one meaning
    // and the encoder version did not move for it.
    overlapClassFilter: [],
    trafficKey: null,
    lengthCohort: 'annotated',
    proteinFilter: 'any',
    axisX: organism.freshAxes.x,
    axisY: organism.freshAxes.y,
    axisXScale: DEFAULT_AXIS_SCALE,
    axisYScale: DEFAULT_AXIS_SCALE,
    panelOrder: [...DEFAULT_PANEL_ORDER],
    panelCollapsed: [...DEFAULT_PANEL_COLLAPSED],
    drawOnTop: DEFAULT_DRAW_DIRECTION,
    // Empty means the fresh-view selection; the app resolves it once the
    // dataset is loaded and the sources are known.
    sources: [],
    // Which dataset informs each type metric, where it differs from the default;
    // empty means the defaults. Resolved by the app against the loaded sources.
    typeSources: {},
    // The local whole-strain dataset choice. It is resolved against the
    // organism catalogue after data loads; a valid shared selection may
    // temporarily override it without erasing it.
    fitnessDatasetId: null,
    // Explicit whole-strain choices made in Data Sources. This separate typed
    // collection cannot contain or alias a per-gene measurement source.
    strainFitnessSources: [],
    // Null means this axis has not yet copied an older link's contributors or
    // received the defaults for a newly selected metric. The app resolves it
    // once against the loaded catalogue, then keeps an independent array.
    axisXSources: null,
    axisYSources: null,
    // Which admitted marker layers the reader has hidden, and in which of the
    // four views. Empty is the fresh view: every mark drawn everywhere. Each
    // view is its own entry, so one choice never moves another's picture.
    hiddenMarkers: [],
  };
}

/** Restore the controls column to its fresh order and collapsed set. */
export function resetPanelLayout(state) {
  state.panelOrder = [...DEFAULT_PANEL_ORDER];
  state.panelCollapsed = [...DEFAULT_PANEL_COLLAPSED];
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
export function applyDecoded(target, decoded, organism = DEFAULT_ORGANISM) {
  Object.assign(target, defaultState(organism), decoded);
  return target;
}

/**
 * The subset of application state an export manifest records as `viewState`:
 * the panel and axis choices that change how the plotted numbers read,
 * without the filter or shortlist fields exported separately. Kept here, next
 * to the fields' URL encoding, so a field added to one is added to the other
 * in the same place rather than drifting apart across two hand-kept lists.
 */
export function viewStateOf(state, organism = DEFAULT_ORGANISM) {
  return {
    panel: state.panel,
    colorBy: state.colorBy,
    // The scale in effect, so an exported view can be reproduced. It is resolved
    // by the time a manifest is built, so this is never the unresolved null.
    colorScale: state.colorScale,
    axisX: state.axisX,
    axisY: state.axisY,
    axisXScale: state.axisXScale,
    axisYScale: state.axisYScale,
    axisXSources: Array.isArray(state.axisXSources) ? [...state.axisXSources] : [],
    axisYSources: Array.isArray(state.axisYSources) ? [...state.axisYSources] : [],
    categoryFilter: state.categoryFilter,
    colorSources: normalizeAnnotationSources(state.colorSources, organism.annotationSources),
    // Which of two overlapping marks the exported picture shows. It changes no
    // number, but it decides what is visible in the image, so a manifest that
    // omitted it could not reproduce the figure it describes.
    drawOnTop: state.drawOnTop ?? DEFAULT_DRAW_DIRECTION,
    fitnessDatasetId: state.fitnessDatasetId ?? null,
    strainFitnessSources: [...(state.strainFitnessSources ?? [])],
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
export function encodeState(state, organism = DEFAULT_ORGANISM) {
  const toggles = organism.annotationSources;
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
  if (!isAllSources(state.colorSources, toggles)) {
    const enabled = normalizeAnnotationSources(state.colorSources, toggles);
    push(KEYS.colorSources, enabled.length === 0 ? NO_SOURCES : enabled.join(','));
  }
  // Written whenever it is resolved, unlike the axis scales: the colour scale's
  // default depends on the metric's own values, so "omitted" cannot mean linear
  // here, and a link that records which scale its author saw is the point.
  if (VALUE_SCALES.includes(state.colorScale)) push(KEYS.colorScale, state.colorScale);
  push(KEYS.trafficKey, state.trafficKey);
  if (state.lengthCohort !== 'annotated') push(KEYS.lengthCohort, state.lengthCohort);
  if (state.proteinFilter !== 'any') push(KEYS.proteinFilter, state.proteinFilter);
  // Only a nondefault axis is encoded, and a decoded one is applied after the
  // defaults, so an explicit `ax`/`ay` in a link always wins over the
  // fresh-view axes.
  if (state.axisX !== organism.freshAxes.x) push(KEYS.axisX, state.axisX);
  if (state.axisY !== organism.freshAxes.y) push(KEYS.axisY, state.axisY);
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
  push(KEYS.overlapClassFilter, [...(state.overlapClassFilter ?? [])].sort().join(','));
  if (state.exceptionFilter && state.exceptionFilter !== 'any') {
    push(KEYS.exceptionFilter, state.exceptionFilter);
  }
  if (state.expressionFilter && state.expressionFilter !== 'any') {
    push(KEYS.expressionFilter, state.expressionFilter);
  }
  if (!state.showHidden) push(KEYS.showHidden, '0');
  // Written only when reversed. Omitted means highest on top, which is the
  // fresh view and what every earlier encoder's link showed; see STATE_VERSION.
  if (state.drawOnTop && state.drawOnTop !== DEFAULT_DRAW_DIRECTION) {
    push(KEYS.drawOnTop, state.drawOnTop);
  }
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
  // The app keeps `sources` empty while the selection is the default, so a
  // written `ds` always names a selection that differs from the fresh view.
  if (Array.isArray(state.sources) && state.sources.length > 0) {
    push(KEYS.sources, state.sources.join(','));
  }
  if (typeof state.fitnessDatasetId === 'string') {
    push(KEYS.fitnessDatasetId, state.fitnessDatasetId);
  }
  if (Array.isArray(state.strainFitnessSources) && state.strainFitnessSources.length > 0) {
    push(KEYS.strainFitnessSources, state.strainFitnessSources.join(','));
  }
  // Likewise `src` names only the informing datasets that differ from the default.
  const informing = Object.entries(state.typeSources ?? {});
  if (informing.length > 0) {
    push(KEYS.typeSources, informing.map(([type, id]) => `${type}=${id}`).join(','));
  }
  // A type metric's applied axis contributors are always written. Older links
  // omitted these fields and are migrated once from `ds`/`src`; current links
  // carry the independent copies so colour/PCA state can change separately.
  if (Array.isArray(state.axisXSources) && state.axisXSources.length > 0) {
    push(KEYS.axisXSources, state.axisXSources.join(','));
  }
  if (Array.isArray(state.axisYSources) && state.axisYSources.length > 0) {
    push(KEYS.axisYSources, state.axisYSources.join(','));
  }
  // Only the views a reader has put marks away in, in the registry's canonical
  // order, so two readers who made the same choice write the same link. Every
  // mark visible everywhere writes no field at all.
  const hiddenMarkers = normalizeHiddenMarkers(state.hiddenMarkers);
  if (hiddenMarkers.length > 0) push(KEYS.hiddenMarkers, hiddenMarkers.join(','));
  return parts.join('&');
}

/** Parse a hash string into a partial state. Unknown or malformed parts are ignored. */
export function decodeState(hash, organism = DEFAULT_ORGANISM) {
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
  if (values.has(KEYS.overlapClassFilter)) {
    const ids = values.get(KEYS.overlapClassFilter).split(',')
      .filter((id) => OVERLAP_CLASS_IDS.includes(id));
    state.overlapClassFilter = [...new Set(ids)].sort();
  }
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
    const sources = parseAnnotationSources(values.get(KEYS.colorSources),
      organism.annotationSources);
    if (sources !== null) state.colorSources = sources;
  }
  // An unknown or absent value leaves `colorScale` unset, so `applyDecoded`
  // restores the null default and the metric's own default scale is resolved.
  if (values.has(KEYS.colorScale)) {
    const scale = values.get(KEYS.colorScale);
    if (VALUE_SCALES.includes(scale)) state.colorScale = scale;
  }
  // An unknown value leaves the field unset, so `applyDecoded` restores the
  // default rather than drawing an order nothing in the app can produce.
  if (values.has(KEYS.drawOnTop)) {
    const direction = values.get(KEYS.drawOnTop);
    if (DRAW_DIRECTIONS.includes(direction)) state.drawOnTop = direction;
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
  // Dataset ids are validated against the loaded sources by the app; here only
  // the shape is read, and an empty or malformed field means the default.
  if (values.has(KEYS.sources)) {
    state.sources = values.get(KEYS.sources).split(',').filter((id) => /^[\w.-]+$/.test(id));
  }
  if (values.has(KEYS.fitnessDatasetId)
    && /^[\w.-]+$/.test(values.get(KEYS.fitnessDatasetId))) {
    state.fitnessDatasetId = values.get(KEYS.fitnessDatasetId);
  }
  if (values.has(KEYS.strainFitnessSources)) {
    state.strainFitnessSources = values.get(KEYS.strainFitnessSources).split(',')
      .filter((id) => /^[\w.-]+$/.test(id));
  }
  // An unknown layer or view name is dropped rather than kept: a hash from a
  // build that drew a layer this one does not have cannot hide it here, and a
  // typo must not leave a view permanently blank.
  if (values.has(KEYS.hiddenMarkers)) {
    state.hiddenMarkers = normalizeHiddenMarkers(values.get(KEYS.hiddenMarkers).split(','));
  }
  if (values.has(KEYS.typeSources)) {
    state.typeSources = Object.fromEntries(values.get(KEYS.typeSources).split(',')
      .map((pair) => /^(type\.[\w.-]+)=([\w.-]+)$/.exec(pair))
      .filter(Boolean)
      .map((match) => [match[1], match[2]]));
  }
  if (values.has(KEYS.axisXSources)) {
    state.axisXSources = values.get(KEYS.axisXSources).split(',')
      .filter((id) => /^[\w.-]+$/.test(id));
  }
  if (values.has(KEYS.axisYSources)) {
    state.axisYSources = values.get(KEYS.axisYSources).split(',')
      .filter((id) => /^[\w.-]+$/.test(id));
  }
  // Version 5 wrote `cm` for the chosen comparison metrics. Those now live in
  // browser storage instead, to keep a shared link readable, so a version 5
  // hash carrying `cm` is read past and dropped exactly as `as` was at
  // version 4: the recipient sees the comparison's own defaults.
  if (Number.isFinite(state.version) && state.version < MEASURED_AXES_VERSION) {
    if (!values.has(KEYS.axisX)) state.axisX = LEGACY_METRIC_AXES.x;
    if (!values.has(KEYS.axisY)) state.axisY = LEGACY_METRIC_AXES.y;
  }
  return state;
}
