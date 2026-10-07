/**
 * Application wiring.
 *
 * Holds the shared state, recomputes scheme-dependent metrics once per scheme
 * change, and keeps every panel looking at the same selection.
 */
import { loadDatasetStaged } from './core/dataset.js';
import {
  CORE_FILE_KEYS, DATA_FILES, DATA_FILE_BY_KEY, FILE_STATE, dataFileLabel, dataRequest,
  hasFailed, isLoading, pendingState, tierLabelsFor,
} from './core/data-files.js';
import {
  canonicalSearch, layerOf, resolveDataDirectory, resolveOrganism, storageKeys,
} from './core/organisms.js';
import {
  applyGeneCount, applyOrganismIdentity, rememberView, renderOrganismSelector,
} from './ui/organism-selector.js';
import { adoptingFetch } from './core/early-data.js';
import { geneIdentity, geneMapLabel } from './core/gene-identity.js';
import { compileScheme, validateSchemeMap, verifyProteinsUnchanged, prefillReplacement } from './core/scheme.js';
import { computeLiveMetrics } from './core/live-metrics.js';
import { RECOMPUTATION_TOLERANCE } from './core/conventions.js';
import {
  buildMetricRegistry, rebindLiveMetrics, metricValues,
  expressionBasisOf, expressionBasisCounts, isExpressionMetric, isExpressionProxyMetric,
  orderMeasuredFirst, freshViewColorKey,
} from './core/metric-registry.js';
import {
  encodeState, decodeState, defaultState, applyDecoded, clearSelections, viewStateOf,
  resetPanelLayout,
} from './core/url-state.js';
import { sortedFinite, percentileRank } from './core/stats.js';
import { PANELS, buildProjection, tabBlurb } from './ui/panels.js';
import {
  CITATIONS_TAB, CitationsPanel, citationDownloadResourceKey, citationsBlurb, fetchCitationBlob,
  loadCitationsManifest,
} from './ui/citations.js';
import { LENGTH_TAB, LengthExplorer, lengthsBlurb } from './ui/length-explorer.js';
import { REGULATORY_TAB, RegulatorySitesPanel } from './ui/regulatory-sites.js';
import { CHROMOSOME_TAB, ChromosomeView } from './ui/chromosome-view.js';
import { renderMeasurementSources } from './ui/measurement-provenance.js';
import { describePaintOrder, repliconTracks } from './core/chromosome-model.js';
import { metricHelp, functionCategoryHelp } from './core/metric-help.js';
import {
  FUNCTION_COLOR_KEY, categoryBucketId, passesCategoryFilter, toggleCategorySelection,
  UNKNOWN_CATEGORY_ID,
} from './core/function-categories.js';
import {
  buildMetricAxesProjection, resolveDefaultMetricAxes, axisTitle, axisTitleSuffix,
  isDiagonalAxisPair, axesUnavailableMessage,
  metricLog10Availability, log10DisabledReason, AXIS_SCALES, DEFAULT_AXIS_SCALE,
} from './core/metric-axes.js';
import {
  VALUE_SCALES, VALUE_SCALE_LABELS, defaultValueScale,
  valueScaleAvailability, valueScaleClause, valueScaleTransform,
} from './core/value-scales.js';
import { projectionHelp } from './core/projection-help.js';
import { renderMetricHelp, renderProjectionHelp } from './ui/metric-help.js';
import { renderLoadings } from './ui/loadings.js';
import { renderLegend, renderCategoryLegend } from './ui/legend.js';
import { buildColorScale, buildCategoryColorScale, isDivergingRamp } from './ui/colors.js';
import { scaleControlState, syncScaleSelect } from './ui/scale-select.js';
import { drawDirectionControlState, renderDrawDirection } from './ui/draw-direction.js';
import {
  DRAW_DIRECTION_LABELS, describeDrawOrder, normalizeDrawDirection,
} from './core/paint-priority.js';
import { colorAnnouncement, installColorControls } from './ui/color-controls.js';
import { ScatterPlot, togglePinTarget } from './ui/scatter.js';
import { SchemeEditor } from './ui/scheme-editor.js';
import { FilterPanel, clearedFilterState, orderTrafficCandidates } from './ui/filters.js';
import { SidePanel } from './ui/side-panel.js';
import { ShortlistPanel } from './ui/shortlist.js';
import { GeneSearchResults } from './ui/gene-search-results.js';
import { WorkspaceResizer } from './ui/workspace-resize.js';
import { ComparePanel } from './ui/compare.js';
import { normalizeCompareAxes } from './ui/compare-model.js';
import { LeftPanels } from './ui/left-panels.js';
import { renderGeneViewer } from './ui/gene-viewer.js';
import { GeneSequenceView } from './ui/gene-sequence-view.js';
import { confirmedReset, confirmReset } from './ui/confirm-dialog.js';
import { DataSourcesPanel } from './ui/data-sources.js';
import {
  datasetsFrom, dataTypeOfMetric, isDefaultSelection, normalizeSelection, selectedMetricKeys,
} from './core/data-sources.js';
import {
  buildTypeMetrics, contributingDatasets, defaultDatasetsOfType, informingDataset, isDatasetOwnKey, isTypeKey,
  normalizeTypeSources, typeGroups, typeKeyFor, typeKeyOf, typeLabelFor,
} from './core/type-metrics.js';
import { PanelDesigner } from './ui/panel-designer.js';
import { formatCount, formatExpressionSource } from './ui/format.js';
import { axisPairsNote, axisTitlesNote, filterBannerText } from './ui/axis-copy.js';
import {
  annotationSourceLabel, isAllSources, normalizeAnnotationSources,
} from './core/annotation-source.js';
import {
  resolveFunctionCategories, pendingFunctionCategories, categoryLabelFor,
  THRESHOLDS as DERIVED_THRESHOLDS,
} from './core/source-derived-categories.js';
import { LoadProgress } from './ui/load-progress.js';
import { prefersReducedMotion, resolveLoadReview, resolveLoadTiming } from './ui/load-timing.js';
import { TextScramble } from './ui/text-scramble.js';
import { installInstantHints } from './ui/instant-hints.js';

installInstantHints();

/**
 * The organism this address names, known before anything is asked for.
 *
 * `?org=` names it; no `org` is the default organism, so every link written
 * before there was a second organism keeps its meaning. Everything below reads
 * this one record: which data directory, which storage keys, which copy.
 */
const { organism, requestedId: requestedOrganismId, recognised: organismRecognised } =
  resolveOrganism(window.location.search);

// An address must not name one organism while the page shows another. The
// default organism's canonical address carries no `org`, so a link that spells
// it out is shortened; an `org` that names nothing is removed along with its
// hash, which was written under an organism this page cannot identify and so
// cannot be read as the default's.
const canonical = canonicalSearch(window.location.search);
if (canonical !== null) {
  window.history.replaceState(null, '',
    `${window.location.pathname}${canonical}${organismRecognised ? window.location.hash : ''}`);
}

/**
 * This organism's keys in browser storage: saved schemes, the shortlist, the
 * comparison's chosen metrics, the panel widths, and the view it was last left
 * in. The default organism's are the keys the site has always used. No key is
 * shared between organisms, so nothing saved under one can be read under the
 * other.
 *
 * The comparison's chosen metrics are kept here rather than in the link: they
 * are a reading preference that would otherwise add a long list of metric keys
 * to every shared URL, and a colleague opening that link is better served by
 * the comparison's own dataset-aware defaults.
 */
const STORAGE = storageKeys(organism);
const STORAGE_SCHEMES = STORAGE.schemes;
const STORAGE_SHORTLIST = STORAGE.shortlist;
const STORAGE_COMPARE_AXES = STORAGE.compareAxes;

/** The organism's colour-source toggles, empty when it has no category colour. */
const COLOR_SOURCE_TOGGLES = organism.annotationSources;

/**
 * The shared tablist: map panels, then the chromosome, length, regulatory, and
 * source views. A tab's id is the permanent `p` token in the URL hash.
 */
const ALL_TABS = [...PANELS, CHROMOSOME_TAB, LENGTH_TAB, REGULATORY_TAB, CITATIONS_TAB];

const element = (id) => document.getElementById(id);

/** localStorage that degrades quietly when the browser refuses it. */
const store = {
  read(key, fallback) {
    try {
      const text = localStorage.getItem(key);
      return text === null ? fallback : JSON.parse(text);
    } catch {
      return fallback;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
};

const state = defaultState(organism);
let pendingMapJump = false;

/** The staged load in progress, its progress surfaces, and what has landed since the last render. */
let staged = null;
let loadProgress = null;
let foldingActivityId = 0;
const landed = new Set();
let landingFlush = false;
/** True once the page has been built on tier 1 and can take a re-render. */
let booted = false;
/** True once the empty shell has given way to the page. */
let revealed = false;
const loadTiming = resolveLoadTiming(window.location.search);
const loadReview = resolveLoadReview(window.location.search);
const reducedMotion = prefersReducedMotion(window);
const textScramble = new TextScramble({ timing: loadTiming.scramble });

const context = {
  // The filters' threshold follows the colouring metric until the reader says otherwise.
  trafficFollowsColor: true,
  dataset: null,
  registry: null,
  live: null,
  scheme: null,
  verification: null,
  mask: null,
  passing: 0,
  hoveredIndex: -1,
  activeIndex: -1,
  schemeVersion: 0,
  projections: new Map(),
  percentiles: new Map(),
  // A colour scale defaulted while its metric's file was loading, re-chosen on landing.
  scaleAwaitsFile: null,
  timings: { scheme: NaN, projection: NaN, codons: 0 },
};

function announce(message) {
  element('announcer').textContent = message;
}

/**
 * Where the data files live: the organism's own directory beside the page
 * unless `?data=` says otherwise. The page's inline script resolves the same
 * directory by the same rule, which is what lets its requests be adopted.
 */
function resolveDataBase() {
  return resolveDataDirectory(window.location.search);
}

function showLoadError(error) {
  const status = element('load-status');
  // The shell shows no text of its own, so this notice is visually hidden until
  // it has a failure to report.
  status.className = 'load-status error';
  status.hidden = false;
  status.replaceChildren();
  // The shell stays up, so the selector is uncovered: the way to the other
  // organism must not be lost with this one's data.
  document.body.classList.add('load-failed');
  const heading = document.createElement('strong');
  heading.textContent = 'The gene data could not be loaded. ';
  const detail = document.createElement('span');
  detail.textContent = error.message;
  status.append(heading, detail);
  const hint = document.createElement('p');
  hint.textContent = layerOf(organism, 'tssEvidence')
    ? 'Check that the pipeline wrote meta.json, genes.json, and the declared '
      + 'annotation and TSS evidence files into this page’s data folder, and that the server '
      + 'can serve them.'
    : 'Check that the pipeline wrote meta.json, genes.json, and every file meta.json declares '
      + 'into this page’s data folder, and that the server can serve them.';
  status.append(hint);
  // Nothing was built, so the whole load can simply be run again. The files
  // that did arrive come back from the browser cache.
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'chip-button';
  retry.textContent = 'Retry';
  retry.addEventListener('click', () => {
    document.body.classList.remove('load-failed');
    status.className = 'load-status visually-hidden';
    status.textContent = 'Loading gene data…';
    loadProgress.restart();
    boot();
  });
  status.append(retry);
}

/**
 * Move to the map without replacing the URL hash, which is application state.
 * A jump requested while the dataset is loading is completed after the map is
 * revealed. The controls are buttons, so even a click before this module loads
 * cannot navigate to a fragment and erase that state.
 */
function jumpToMap() {
  if (element('main').hidden) {
    pendingMapJump = true;
    return;
  }
  pendingMapJump = false;
  // The chromosome view is a map of the same genes, so a jump lands on it
  // rather than switching the reader off the tab they chose.
  const onAMap = PANELS.some((panel) => panel.id === state.panel)
    || state.panel === CHROMOSOME_TAB.id;
  if (!onAMap) {
    state.panel = 'native';
    updatePanelTabs();
    renderCurrentView();
    persist();
  }
  element('map-section').scrollIntoView({ block: 'start' });
  // The canvas is `[hidden]` while the citations tab is showing; focusing a
  // hidden element is a no-op in every browser, but skip it explicitly so
  // this stays correct if that ever changes.
  if (state.panel === CHROMOSOME_TAB.id) chromosomeView?.focusCanvas();
  else if (!element('map-view').hidden) element('map-canvas').focus({ preventScroll: true });
}

function installMapJumps() {
  for (const control of document.querySelectorAll('.map-jump')) {
    control.addEventListener('click', (event) => {
      event.preventDefault();
      jumpToMap();
    });
  }
}

/** Reach the selected gene's detail card without replacing application state. */
function jumpToDetail() {
  const detail = element('detail');
  detail.scrollIntoView({ block: 'start' });
  detail.focus({ preventScroll: true });
}

function percentileOf(key, value) {
  if (!Number.isFinite(value)) return NaN;
  if (!context.percentiles.has(key)) {
    const metric = context.registry.byKey.get(key);
    if (!metric) return NaN;
    context.percentiles.set(key, sortedFinite(metricValues(metric, context.dataset.genes.length)));
  }
  return percentileRank(context.percentiles.get(key), value);
}

function clearLivePercentiles() {
  for (const metric of context.registry.metrics) {
    if (metric.source === 'live') context.percentiles.delete(metric.key);
  }
}

/**
 * Resolve every gene's category bucket under the enabled annotation sources:
 * reviewed rows first, then each derived source in the organism's precedence
 * order, each only while enabled; a disagreement keeps the highest-priority
 * colour and is named, never
 * bucketed. Recomputed whenever the toggles change; the legend, filter,
 * preview, and canvas all read this one model.
 */
function resolveCategoryModel() {
  const { dataset } = context;
  const reviewed = dataset.functionCategories;
  // The derived categories' file carries most of the colour. Until it lands,
  // or if it cannot, resolving on the reviewed table alone would draw some
  // 1,350 categorised CDSs as unknown, so the channel is pending instead.
  const pending = isLoading(dataset, 'sourceDerivedCategories') ? FILE_STATE.LOADING
    : hasFailed(dataset, 'sourceDerivedCategories') ? FILE_STATE.FAILED : null;
  if (!reviewed) context.categories = null;
  else if (pending) {
    context.categories = pendingFunctionCategories({
      reviewed, genes: dataset.genes, sources: state.colorSources, pending,
    });
  } else {
    context.categories = resolveFunctionCategories({
      reviewed,
      derived: dataset.sourceDerivedCategories,
      genes: dataset.genes,
      sources: state.colorSources,
    });
  }
  return context.categories;
}

/** Flip one colour-source checkbox: only colouring and the legend counts change. */
function toggleColorSource(id, enabled) {
  const next = new Set(state.colorSources);
  if (enabled) next.add(id);
  else next.delete(id);
  state.colorSources = normalizeAnnotationSources([...next], COLOR_SOURCE_TOGGLES);
  renderAll();
  announce(isAllSources(state.colorSources, COLOR_SOURCE_TOGGLES)
    ? 'Category colour: every annotation source enabled.'
    : state.colorSources.length === 0
      ? 'Category colour: no source enabled; every CDS is unknown until a source is turned on.'
      : `Category colour: ${annotationSourceLabel(state.colorSources, COLOR_SOURCE_TOGGLES)} `
        + 'enabled. Every other view still shows every source.');
}

function computeMask() {
  resolveCategoryModel();
  const { dataset, registry } = context;
  const count = dataset.genes.length;
  const mask = new Uint8Array(count).fill(1);
  const missingHidden = new Map();
  const entries = Object.entries(state.filters)
    .map(([key, range]) => ({ key, metric: registry.byKey.get(key), range }))
    .filter((entry) => entry.metric);

  for (const { key, metric, range } of entries) {
    let droppedForMissing = 0;
    for (let i = 0; i < count; i += 1) {
      if (!mask[i]) continue;
      const value = metric.read(i);
      if (!Number.isFinite(value)) {
        // No measurement means unknown, not zero. Keep the gene unless the user
        // has asked otherwise, and count what that choice hides either way.
        if (range.includeMissing === false) {
          mask[i] = 0;
          droppedForMissing += 1;
        }
        continue;
      }
      if (range.min !== null && value < range.min) mask[i] = 0;
      else if (range.max !== null && value > range.max) mask[i] = 0;
    }
    missingHidden.set(key, droppedForMissing);
  }

  if (state.exceptionFilter !== 'any') {
    for (let i = 0; i < count; i += 1) {
      if (!mask[i]) continue;
      const flagged = Boolean(dataset.genes[i].translationalException);
      if (state.exceptionFilter === 'only' ? !flagged : flagged) mask[i] = 0;
    }
  }

  // Measured-only keeps genes whose expression basis is a real measurement. A
  // proxy, nothing, or an unrecorded basis all fail it: none of them is a measurement.
  if (state.expressionFilter === 'measured') {
    for (let i = 0; i < count; i += 1) {
      if (!mask[i]) continue;
      if (expressionBasisOf(dataset.genes[i]).basis !== 'measured') mask[i] = 0;
    }
  }
  // While the length inventory is still loading there is no record set to
  // filter on, and filtering on an empty one would hide every gene. The filter
  // is applied when the file lands; the filter panel says it is waiting.
  if (state.proteinFilter === 'refseq' && dataset.lengthCohorts) {
    for (let i = 0; i < count; i += 1) {
      if (mask[i] && !context.proteinRecordIds.has(dataset.genes[i].id)) mask[i] = 0;
    }
  }

  // Kept separate from the category-filtered mask below: a legend hover
  // preview narrows this base mask to one category without ever touching
  // `state.categoryFilter`, so numeric/exception/expression/protein filters
  // still apply during a preview but the current category selection does not.
  context.baseMask = mask;

  let finalMask = mask;
  const categories = context.categories;
  // A pending category model has no categories to filter by; the selection is
  // kept and applied when the categories land.
  if (state.categoryFilter.length > 0 && categories && !categories.pending) {
    finalMask = new Uint8Array(count);
    for (let i = 0; i < count; i += 1) {
      finalMask[i] = mask[i] && passesCategoryFilter(categories, i, state.categoryFilter) ? 1 : 0;
    }
  }

  let passing = 0;
  for (let i = 0; i < count; i += 1) passing += finalMask[i];
  context.mask = finalMask;
  context.passing = passing;
  context.missingHidden = missingHidden;
}

/**
 * Hover/focus preview: one category's genes, still bound by every other filter.
 * A preview is a camera-level change, never filter or URL state, so it is
 * pushed straight at whichever view is on screen.
 */
function previewCategory(id) {
  const apply = (mask) => {
    if (state.panel === CHROMOSOME_TAB.id) {
      if (!chromosomeView?.model?.verified) return;
      chromosomeView.model.mask = mask;
      chromosomeView.draw();
      return;
    }
    plot.setMask(mask);
  };
  if (!id) {
    apply(context.mask);
    return;
  }
  const categories = context.categories;
  if (!categories) return;
  const base = context.baseMask;
  const preview = new Uint8Array(base.length);
  for (let i = 0; i < base.length; i += 1) {
    preview[i] = base[i] && categoryBucketId(categories, i) === id ? 1 : 0;
  }
  apply(preview);
}

// Hover (mouse) and keyboard focus are independent preview channels. Losing
// one (mouse leaves the legend, or a row blurs) must fall back to whichever
// other channel is still active, not straight to the committed selection.
let hoverCategoryId = null;
let focusCategoryId = null;

function updateCategoryPreview() {
  previewCategory(hoverCategoryId ?? focusCategoryId ?? null);
}

function hoverCategory(id) {
  hoverCategoryId = id;
  updateCategoryPreview();
}

function focusCategory(id) {
  focusCategoryId = id;
  updateCategoryPreview();
}

function toggleCategoryFilter(id) {
  state.categoryFilter = toggleCategorySelection(state.categoryFilter, id);
  renderAll();
  announce(state.categoryFilter.length === 0
    ? 'Category filter cleared.'
    : `Category filter: ${state.categoryFilter.length} selected.`);
}

function clearCategoryFilter() {
  if (state.categoryFilter.length === 0) return;
  state.categoryFilter = [];
  renderAll();
  announce('Category filter cleared.');
}

function recomputeScheme() {
  const { dataset } = context;
  const validation = validateSchemeMap(state.schemeMap, dataset.table);
  if (!validation.ok) return validation.errors;
  context.scheme = compileScheme(state.schemeMap, dataset.table);
  const result = computeLiveMetrics(dataset, context.scheme, { baseline: dataset.baseline });
  context.live = result.fields;
  context.timings.scheme = result.elapsedMs;
  context.timings.codons = result.codonsScanned;
  context.verification = context.scheme.active
    ? verifyProteinsUnchanged(dataset, context.scheme)
    : null;
  if (context.registry) {
    rebindLiveMetrics(context.registry, context.live);
    clearLivePercentiles();
  }
  context.schemeVersion += 1;
  context.projections.delete('risk');
  context.projections.delete('perturbation');
  context.projections.delete('axes');
  return [];
}

function projectionFor(panelId) {
  if (panelId === 'axes') {
    // Never cached: percentile ranks the visible cohort, so a filter change
    // must be able to move every point on this axis, not just show/hide them.
    const axes = buildMetricAxesProjection(context.registry, context.dataset.genes.length, {
      x: state.axisX, y: state.axisY,
    }, { x: state.axisXScale, y: state.axisYScale }, context.mask);
    const projection = {
      available: axes.available && axes.finitePairCount > 0,
      message: axesUnavailableMessage(axes),
      x: axes.x.values,
      y: axes.y.values,
      independentAxes: true,
      xLabel: axisTitle(axes.x),
      yLabel: axisTitle(axes.y),
      xLabelSuffix: axisTitleSuffix(axes.x),
      yLabelSuffix: axisTitleSuffix(axes.y),
      isDiagonalPair: isDiagonalAxisPair(axes),
      labels: context.dataset.genes.map(geneMapLabel),
      loadings: [],
      loadingNote: 'These are direct metric axes, not PCA components. There are no loadings.',
      finitePairCount: axes.finitePairCount,
    };
    context.timings.projection = NaN;
    return projection;
  }
  const cached = context.projections.get(panelId);
  if (cached) return cached;
  const projection = buildProjection(panelId, {
    dataset: context.dataset,
    registry: context.registry,
    schemeActive: context.scheme.active,
  });
  context.timings.projection = projection.elapsedMs ?? NaN;
  context.projections.set(panelId, projection);
  return projection;
}

function pinnedIndex() {
  if (!state.pinnedId) return -1;
  const index = context.dataset.indexById.get(state.pinnedId);
  return index === undefined ? -1 : index;
}

// `replaceState` never fires `hashchange`/`popstate` in any browser, so the
// live-hash listener below cannot loop back on this call. The flag is a
// defensive belt for that guarantee, since a broken loop here would be a
// silent, expensive one: every render would re-decode and re-render forever.
let applyingHash = false;

function persist() {
  store.write(STORAGE_SHORTLIST, state.shortlist);
  const hash = encodeState(state, organism);
  // The view this organism is being left in, for the selector to return to.
  rememberView(store, organism, hash);
  const target = `${window.location.pathname}${window.location.search}${hash ? `#${hash}` : ''}`;
  applyingHash = true;
  window.history.replaceState(null, '', target);
  applyingHash = false;
}

let plot = null;
let schemeEditor = null;
let filterPanel = null;
let dataSourcesPanel = null;
let chromosomeDataSourcesPanel = null;
let sidePanel = null;
let shortlistPanel = null;
let searchResults = null;
let comparePanel = null;
let panelDesigner = null;
let citationsPanel = null;
let lengthExplorer = null;
let regulatorySitesPanel = null;
let chromosomeView = null;
let geneSequenceView = null;
let workspaceResizer = null;
let leftPanels = null;
/** Chosen comparison metrics for this browser, or null for the defaults. */
let compareAxes = null;
// `undefined` while the manifest fetch is in flight, `null` once it resolves
// to nothing usable, otherwise the sanitized `{sections: [...]}` document.
let citationsManifest;
let retryCitations = null;
let timingHandle = 0;

function updateTiming() {
  const stats = plot.frameStats();
  const parts = [];
  if (Number.isFinite(context.timings.scheme)) {
    parts.push(`Scheme scan ${context.timings.scheme.toFixed(1)} ms over `
      + `${formatCount(context.timings.codons)} codons`);
  }
  if (Number.isFinite(context.timings.projection)) {
    parts.push(`Projection ${context.timings.projection.toFixed(1)} ms`);
  }
  if (stats.frames > 0) {
    parts.push(`Draw ${stats.median.toFixed(1)} ms median, ${stats.worst.toFixed(1)} ms worst `
      + `over ${stats.frames} frames`);
  }
  element('timing').textContent = parts.join(' · ');
}

function scheduleTiming() {
  if (timingHandle) return;
  timingHandle = window.setTimeout(() => {
    timingHandle = 0;
    updateTiming();
  }, 250);
}

/**
 * The colour scale in effect, and the availability of every scale the current
 * Colour by could take.
 *
 * One resolution, read by the ramp, both toolbars, the legend, the accessible
 * descriptions and the export manifest, so none of them can describe a scale
 * another one is not drawing. `state.colorScale` is written back here: a null
 * value — a fresh view, a hash that names a colour but no scale, or a Colour by
 * the reader just changed — resolves to the metric's own default, and a scale
 * the metric cannot take (a hand-edited link) resolves the same way rather than
 * drawing a ramp the data does not support.
 *
 * @returns {{categorical: boolean, metric: object|null, values: Float64Array|number[],
 *   scale: string|null, availability: Map<string, object>|null}}
 */
function resolveColorScale() {
  const categories = context.categories ?? resolveCategoryModel();
  if (state.colorBy === FUNCTION_COLOR_KEY && categories) {
    // No scale is in effect, so the link and the export manifest say so rather
    // than carrying a scale that nothing is drawing.
    state.colorScale = null;
    return {
      categorical: true, metric: null, values: categories.values, scale: null, availability: null,
    };
  }
  const metric = context.registry.byKey.get(state.colorBy) ?? context.registry.metrics[0];
  state.colorBy = metric.key;
  const values = metricValues(metric, context.dataset.genes.length);
  const options = {
    label: metric.label,
    centred: isDivergingRamp(values, metric.scale),
  };
  const availability = valueScaleAvailability(values, options);
  const requested = state.colorScale;
  const pinned = VALUE_SCALES.includes(requested) && availability.get(requested).available;
  // A default chosen while the metric's own file is still loading was chosen
  // over no values at all; it is chosen again, from the real values, once the
  // file lands. A scale the reader or the link asked for stays.
  if (!pinned && metric.fileKey && isLoading(context.dataset, metric.fileKey)) {
    context.scaleAwaitsFile = { key: metric.key, fileKey: metric.fileKey };
  }
  const scale = pinned ? requested : defaultValueScale(values, options);
  state.colorScale = scale;
  return { categorical: false, metric, values, scale, availability };
}

/**
 * The colour channel every view shares: the resolved category model or the
 * selected metric, its values, the scale the reader chose, and the ramp built
 * over them. The scatter map and the chromosome view read this one model, so a
 * gene is the same colour in both and neither can drift into its own colour
 * rules.
 */
function colorModel() {
  const resolved = resolveColorScale();
  const categories = context.categories ?? resolveCategoryModel();
  const pendingCategories = resolved.categorical && categories.pending;
  const metric = resolved.categorical
    ? { label: pendingCategories ? 'Function category (not loaded yet)' : 'Function category' }
    : resolved.metric;
  const { values } = resolved;
  // The ramp family is whatever the metric declares; undeclared is inferred and
  // the legend says so. `direction` is never read. The scale only changes which
  // ramp position a value takes; the value itself is untouched.
  const scale = resolved.categorical
    ? buildCategoryColorScale(categories.labels.length, { pending: Boolean(pendingCategories) })
    : buildColorScale(values, {
      scale: metric.scale,
      transform: valueScaleTransform(resolved.scale, values),
    });
  return {
    categories,
    categorical: resolved.categorical,
    metric,
    values,
    scale,
    valueScale: resolved.scale,
    // One control state for both toolbars, decided where the scales are defined.
    scaleControl: scaleControlState(resolved),
    // The same arrangement for Draw on top: one state, both surfaces.
    drawDirectionControl: drawDirectionControlState(resolved, state.drawOnTop),
    drawOnTop: normalizeDrawDirection(state.drawOnTop),
    derived: resolved.categorical ? categories.derived : null,
    label: metric.label,
  };
}

/**
 * Adopt a draw direction from either surface: one shared value, both views, the
 * legend, the accessible descriptions, the link, and the export manifest.
 */
function setDrawDirection(direction) {
  const next = normalizeDrawDirection(direction);
  if (next === state.drawOnTop) return;
  state.drawOnTop = next;
  renderCurrentView();
  persist();
  announce(`Overlapping marks now draw ${DRAW_DIRECTION_LABELS[next].toLowerCase()} on top.`);
}

/**
 * Point the map toolbar's Scale selector, and the note beneath its row, at the
 * one control state the colour model resolved. The chromosome tab's own selector
 * and note are handed the same object through its model, so the two cannot
 * disagree about an option, a reason, or which reasons a reader can see.
 */
function syncColorScaleControl(colors) {
  syncScaleSelect(element('color-scale'), colors.scaleControl, element('color-scale-notice'));
}

/** The clause an accessible description adds for the scale in effect, if any. */
function colorScaleClause(colors) {
  return colors.categorical ? null : valueScaleClause(colors.valueScale);
}

/**
 * How overlapping marks are ordered, in one sentence, for the map canvas's
 * accessible description and for the disclosure the Draw on top control sits in.
 *
 * It comes from the rule itself, in core/paint-priority.js, so it cannot describe
 * an order the views do not paint. By owner decision of 2026-09-30 the legend
 * carries no clause about it: the description states it whatever the reader has
 * open, and the disclosure states it where the control that reverses it is.
 */
function drawOrderSentence(colors) {
  return describeDrawOrder({
    categorical: colors.categorical,
    direction: colors.drawOnTop,
    metricLabel: colors.categorical ? null : colors.label,
  });
}

/**
 * The same sentences, for the map's colour explanation disclosure, which by owner
 * decision of 2026-09-30 is the only visible place on this view that explains the
 * order. A scatter map has no device columns, so it passes none: the crowding
 * figure and the per-column majority belong to the chromosome view, and what is
 * left is the ordering in effect and that nothing is hidden by it.
 */
function drawOrderExplanation(colors) {
  return describePaintOrder({
    categorical: colors.categorical,
    order: drawOrderSentence(colors),
    accession: null,
    columns: null,
    alike: null,
  });
}

/**
 * The colour key for one view's legend host, in whichever colour mode is on.
 *
 * `markerConventions` false leaves out the rows naming the scatter map's point
 * shapes, for a view that draws the same evidence states differently and states
 * its own conventions beside the key.
 */
function renderColorLegend(host, colors, { markerConventions = true } = {}) {
  const { categorical, categories, metric, values, scale } = colors;
  if (categorical) {
    let hiddenReviewedCount = 0;
    let hiddenUnknownCount = 0;
    for (let i = 0; i < context.mask.length; i += 1) {
      if (context.mask[i]) continue;
      if (categoryBucketId(categories, i) === UNKNOWN_CATEGORY_ID) {
        hiddenUnknownCount += 1;
      } else {
        hiddenReviewedCount += 1;
      }
    }
    renderCategoryLegend(host, {
      ...categories,
      organism,
      hasDerivedData: categories.hasDerivedData,
      derivedThreshold: DERIVED_THRESHOLDS.derivedProbabilityAtLeast,
      onToggleSource: (id, enabled) => toggleColorSource(id, enabled),
      scale,
      hiddenReviewedCount,
      hiddenUnknownCount,
      showHidden: state.showHidden,
      selected: state.categoryFilter,
      onHoverCategory: (id) => hoverCategory(id),
      onFocusCategory: (id) => focusCategory(id),
      onToggleCategory: (id) => toggleCategoryFilter(id),
      onResetCategoryFilter: () => clearCategoryFilter(),
      markerConventions,
    });
    return;
  }
  let missing = 0;
  for (let i = 0; i < values.length; i += 1) if (!Number.isFinite(values[i])) missing += 1;
  // Scoped to the metric on screen: a TSS legend counts TSS coverage, not the
  // primary abundance field's, even though both share the same basis states.
  const isMeasuredExpressionMetric = isExpressionMetric(metric) && !isExpressionProxyMetric(metric);
  renderLegend(host, {
    metric,
    scale,
    missingCount: missing,
    hiddenCount: context.dataset.genes.length - context.passing,
    showHidden: state.showHidden,
    provenanceNote: formatExpressionSource(metric.provenance),
    basisCounts: isMeasuredExpressionMetric
      ? expressionBasisCounts(context.dataset.genes, metric) : null,
    markerConventions,
  });
}

/** Grouped options for a Colour by selector, in the registry's own order. */
/**
 * A selector entry for a metric. A type metric's unit is whichever dataset
 * informs it, shown by the legend and the help, so the entry names the type
 * alone; every other metric carries its unit.
 */
function optionLabel(metric) {
  return metric.unit && !metric.isType ? `${metric.label} (${metric.unit})` : metric.label;
}

function colorSelectOptions() {
  const options = [];
  if (context.dataset.functionCategories) {
    options.push({ group: 'Reviewed function', value: FUNCTION_COLOR_KEY, label: 'Function category' });
  }
  for (const family of context.registry.families) {
    for (const metric of familyMetrics(family)) {
      options.push({ group: family, value: metric.key, label: optionLabel(metric) });
    }
  }
  return options;
}

function renderColorHelp(host) {
  const categories = context.categories ?? resolveCategoryModel();
  if (state.colorBy === FUNCTION_COLOR_KEY && categories) {
    renderMetricHelp(host, functionCategoryHelp({
      reviewed: context.dataset.functionCategories,
      derived: context.dataset.sourceDerivedCategories,
      categories,
      organism,
    }), citationsManifest, organism);
    return;
  }
  renderMetricHelp(host,
    metricHelp(context.registry.byKey.get(state.colorBy), context.dataset), citationsManifest,
    organism);
}

/**
 * Replicate and coverage limits for the measurements now on the axes, one short
 * clause each, in axis order and never repeated for a diagonal. The full
 * wording lives in the metric's own explanation disclosure.
 */
function axisLimitNotes() {
  const keys = state.axisX === state.axisY ? [state.axisX] : [state.axisX, state.axisY];
  return keys
    .map((key) => {
      const metric = context.registry.byKey.get(key);
      const limits = metricHelp(metric, context.dataset)?.limits;
      return limits ? `${metric.label}: ${limits}.` : null;
    })
    .filter(Boolean);
}

/**
 * Disable an axis's Log10 option when its current metric has a zero or
 * negative finite value, and fall the requested scale back to linear rather
 * than let the select claim a scale the projection cannot actually draw.
 */
function syncAxisScaleAvailability(axis) {
  const metricKey = axis === 'x' ? 'axisX' : 'axisY';
  const scaleKey = axis === 'x' ? 'axisXScale' : 'axisYScale';
  const select = element(`axis-${axis}-scale`);
  const metric = context.registry.byKey.get(state[metricKey]);
  const availability = metricLog10Availability(metric, context.dataset.genes.length);
  const logOption = [...select.options].find((option) => option.value === 'log10');
  if (logOption) {
    logOption.disabled = !availability.available;
    logOption.title = availability.available ? ''
      : log10DisabledReason(metric?.label ?? state[metricKey], availability) ?? '';
  }
  if (state[scaleKey] === 'log10' && !availability.available) state[scaleKey] = DEFAULT_AXIS_SCALE;
  select.value = state[scaleKey];
  return availability;
}

function renderMap() {
  const projection = projectionFor(state.panel);
  const panel = PANELS.find((entry) => entry.id === state.panel);
  element('panel-blurb').textContent = `${tabBlurb(panel, organism)} ${panel.source}`;
  element('axis-chooser').hidden = state.panel !== 'axes';
  if (state.panel === 'axes') {
    element('axis-x').value = state.axisX;
    element('axis-y').value = state.axisY;
    const xLog = syncAxisScaleAvailability('x');
    const yLog = syncAxisScaleAvailability('y');
    const pairs = axisPairsNote(projection);
    const scaleNotes = [...new Set([
      log10DisabledReason(context.registry.byKey.get(state.axisX)?.label ?? state.axisX, xLog),
      log10DisabledReason(context.registry.byKey.get(state.axisY)?.label ?? state.axisY, yLog),
    ].filter(Boolean))];
    // A measured axis states its replicate and condition limits here, beside
    // the plot, rather than leaving a thin measurement to look like a deep one.
    element('axis-note').textContent = [pairs, axisTitlesNote(projection), ...axisLimitNotes(), ...scaleNotes]
      .join(' ');
  }

  plot.setProjection(projection, { keepView: plot.projectionId === state.panel });
  plot.projectionId = state.panel;

  const colors = colorModel();
  const { categories, categorical, metric, values, scale } = colors;
  syncColorScaleControl(colors);
  renderColorHelp(element('colour-help'));
  // After the colour explanation, which rewrites that disclosure's body: the
  // control is mounted beside the body rather than inside it, so it survives the
  // rewrite and keyboard focus stays on the select the reader just used. The
  // chromosome view mounts its own copy in its own toolbar the same way.
  renderDrawDirection(element('colour-help'), colors.drawDirectionControl, {
    idPrefix: 'draw-direction',
    onChange: (direction) => setDrawDirection(direction),
    explanation: drawOrderExplanation(colors),
  });
  renderProjectionHelp(element('features-used'),
    projectionHelp(state.panel, context.dataset, context.registry,
      { x: state.axisX, y: state.axisY }), citationsManifest, organism);
  plot.setColor({ values, scale, derived: colors.derived });
  plot.setDrawDirection(colors.drawOnTop);
  plot.setMask(context.mask);
  plot.setShowHidden(state.showHidden);
  plot.setMarks({
    pinned: pinnedIndex(),
    hovered: context.hoveredIndex,
    active: context.activeIndex,
    shortlist: new Set(
      state.shortlist
        .map((id) => context.dataset.indexById.get(id))
        .filter((index) => index !== undefined),
    ),
  });

  // With nothing plotted there is nothing for a colour key to explain.
  const legendHost = element('legend');
  legendHost.hidden = !projection.available;
  element('reset-view').disabled = !projection.available;
  element('zoom-in').disabled = !projection.available;
  element('zoom-out').disabled = !projection.available;
  if (projection.available) renderColorLegend(legendHost, colors);

  const loadingsHost = element('loadings-details');
  loadingsHost.hidden = !projection.available;
  loadingsHost.querySelector('summary').textContent = state.panel === 'axes'
    ? 'About these axes' : 'What drives these axes';
  if (projection.available) {
    renderLoadings(element('loadings'), projection, {
      pending: state.panel === 'native' ? pendingState(context.dataset, 'codonPca') : null,
    });
  }

  const canvas = element('map-canvas');
  // The scale belongs in this sentence: which colour a value takes depends on
  // it, so a reader who cannot see the ramp has no other way to learn it.
  const scaleClause = colorScaleClause(colors);
  canvas.setAttribute(
    'aria-label',
    projection.available
      ? `${panel.name}: ${formatCount(context.passing)} of `
        + `${formatCount(context.dataset.genes.length)} genes shown, coloured by `
        + `${metric.label}${scaleClause ? ` ${scaleClause}` : ''}. `
        + `${drawOrderSentence(colors)} Nothing is hidden by that order: every gene stays `
        + 'selectable, reachable by the arrow keys, and counted.'
      : `${panel.name}: ${projection.message}`,
  );

  const hidden = context.dataset.genes.length - context.passing;
  const banner = element('filter-banner');
  banner.classList.toggle('active', hidden > 0);
  banner.textContent = filterBannerText({
    hidden,
    total: context.dataset.genes.length,
    showHidden: state.showHidden,
    projectionAvailable: projection.available,
    projectionMessage: projection.message,
    colorBy: state.colorBy,
    functionColorKey: FUNCTION_COLOR_KEY,
  });
  scheduleTiming();
}

/**
 * The names of the function categories the filter is currently restricted to.
 *
 * A count alone cannot be read: a description saying one category is selected
 * leaves a reader who is not looking at the legend without the one fact that
 * changed. Empty when no reviewed category model is loaded, which is also when
 * the filter cannot apply.
 */
function selectedCategoryLabels() {
  const categories = context.categories;
  if (!categories) return [];
  return state.categoryFilter.map((id) => categoryLabelFor(categories, id));
}

/**
 * The chromosome tab.
 *
 * Every gene, colour, filter, pin, and shortlist entry is the one the rest of
 * the workspace is looking at; this view adds only its own camera. The replicon
 * tracks are resolved on each render because the filter mask they report
 * against changes with the filters.
 */
function renderChromosomeView() {
  const { tracks, problems, verified } = repliconTracks(
    context.dataset.genes, context.dataset.meta, organism.genome,
  );
  const colors = colorModel();
  chromosomeView.update({
    tracks,
    problems,
    verified,
    genes: context.dataset.genes,
    mask: context.mask,
    showHidden: state.showHidden,
    colors,
    colorLabel: colors.label,
    colorOptions: colorSelectOptions(),
    colorKey: state.colorBy,
    colorScaleControl: colors.scaleControl,
    colorScaleClause: colorScaleClause(colors),
    drawOnTop: colors.drawOnTop,
    drawDirectionControl: colors.drawDirectionControl,
    pinned: pinnedIndex(),
    hovered: context.hoveredIndex,
    active: context.activeIndex,
    shortlist: new Set(
      state.shortlist
        .map((id) => context.dataset.indexById.get(id))
        .filter((index) => index !== undefined),
    ),
    passing: context.passing,
    total: context.dataset.genes.length,
    categoryFilterLabels: selectedCategoryLabels(),
    hasSelection: pinnedIndex() >= 0 || context.activeIndex >= 0 || context.hoveredIndex >= 0,
    tssPending: pendingState(context.dataset, 'tssEvidence'),
  });
  // After `update`, which is what builds this view's own hosts on first use.
  renderColorHelp(chromosomeView.colourHelpElement());
  if (verified) {
    renderColorLegend(chromosomeView.legendElement(), colors, { markerConventions: false });
  }
  // The sequence close-up follows the pinned gene only, never a hover or a
  // keyboard preview, and re-renders only when that gene or the scheme changes.
  geneSequenceView ??= new GeneSequenceView(chromosomeView.sequenceElement(), {
    onAnnounce: (message) => announce(message),
  });
  const pinned = pinnedIndex();
  geneSequenceView.update({
    gene: pinned >= 0 ? context.dataset.genes[pinned] : null,
    table: context.dataset.table,
    scheme: context.scheme,
    schemeVersion: context.schemeVersion,
  });
  // The toolbar exists once the view has rendered, so its section follows.
  chromosomeDataSources()?.update(dataSourcesState());
}

/**
 * Point the controls that two views share at the state they describe.
 *
 * Colour and Show filtered-out genes are one piece of state with two sets of
 * controls: the map's, in the controls column, and the chromosome view's own
 * copies in its toolbar. The chromosome view resyncs its pair on every render,
 * so this is the other direction — whoever writes the state from the
 * chromosome toolbar, or from a link the address bar just changed, calls this
 * so the map's controls cannot be left describing the previous analysis.
 */
function syncSharedControls() {
  element('color-by').value = state.colorBy;
  syncColorScaleControl(colorModel());
  element('show-hidden').checked = state.showHidden;
}

function renderDetail() {
  // Pointer hover wins over keyboard preview, which wins over the pinned gene:
  // whichever one the user is actively looking at now is the one this panel
  // should describe.
  const index = context.hoveredIndex >= 0 ? context.hoveredIndex
    : context.activeIndex >= 0 ? context.activeIndex
      : pinnedIndex();
  element('detail-jump').hidden = index < 0;
  sidePanel.update({
    index,
    isPinned: index >= 0 && index === pinnedIndex()
      && context.hoveredIndex < 0 && context.activeIndex < 0,
    dataset: context.dataset,
    registry: scopedRegistry(),
    percentileOf,
    schemeActive: context.scheme.active,
    live: context.live,
    inShortlist: index >= 0 && state.shortlist.includes(context.dataset.genes[index].id),
    colorSources: state.colorSources,
  });
  renderControlsGeneViewer(index);
}

/**
 * Whether the controls-column gene visualizer draws its start-site marks.
 *
 * This view's own choice, and only this one: the gene detail column's copy
 * keeps its own, and the chromosome view's layer control is separate again.
 * Held here because that viewer is redrawn on every hover, so it cannot hold
 * the choice itself. Deliberately not in `state`: like the panel disclosures
 * it is how one reader is looking right now, not part of the view a shared
 * link reproduces, so no reset, filter or link touches it.
 */
let controlsStartSitesVisible = true;

/**
 * Draw the controls-column copy of the gene visualizer.
 *
 * Skipped while that panel is collapsed: this runs on every hover, and drawing
 * into a hidden subtree would cost the same as drawing a visible one for
 * nothing. Expanding the panel re-renders through the layout change.
 */
function renderControlsGeneViewer(index) {
  const body = leftPanels?.bodyFor('gene-viewer');
  if (!body || body.hidden) return;
  const host = body.querySelector('#gene-viewer-controls');
  if (!host) return;
  renderGeneViewer(host, index >= 0 ? context.dataset.genes[index] : null, {
    tssPending: pendingState(context.dataset, 'tssEvidence'),
    organism,
    startSitesVisible: controlsStartSitesVisible,
    onStartSitesVisibleChange: (visible) => { controlsStartSitesVisible = visible; },
  });
}

/** The filter set with the length range replaced; both bounds open removes it. */
function lengthFilters(bounds) {
  const current = state.filters.lengthNt ?? { min: null, max: null, includeMissing: true };
  const next = { ...state.filters };
  if (bounds.min === null && bounds.max === null) delete next.lengthNt;
  else next.lengthNt = { ...current, min: bounds.min, max: bounds.max };
  return next;
}

let liveFilterFrame = 0;
let liveFilterPending = null;

/**
 * A filter moving under the reader's hand. The newest values are applied at
 * most once per animation frame: the mask is recomputed and the current view
 * repainted with it, and the filter panel's passing count follows. Nothing is
 * rebuilt, announced, or written to the address; the release does that
 * through the ordinary `onChange` path (owner decision, 2026-10-05: points
 * switch at once, with no fade).
 */
function applyFiltersLive(filters) {
  liveFilterPending = filters;
  if (liveFilterFrame) return;
  liveFilterFrame = requestAnimationFrame(() => {
    liveFilterFrame = 0;
    const next = liveFilterPending;
    liveFilterPending = null;
    if (!next) return;
    state.filters = next;
    renderLiveFilters();
  });
}

/** Drop a pending live frame: the committed state is about to render in full. */
function cancelLiveFilters() {
  if (liveFilterFrame) cancelAnimationFrame(liveFilterFrame);
  liveFilterFrame = 0;
  liveFilterPending = null;
}

function renderLiveFilters() {
  computeMask();
  if (state.panel === CHROMOSOME_TAB.id) {
    chromosomeView.setFilterMask(context.mask, context.passing);
  } else if (state.panel === LENGTH_TAB.id) {
    lengthExplorer.update({
      inventory: context.dataset.lengthCohorts,
      cohortId: state.lengthCohort,
      range: state.filters.lengthNt,
      mapPassing: context.passing,
      mapCount: context.dataset.genes.length,
      pending: pendingState(context.dataset, 'lengthCohorts'),
    }, { live: true });
  } else if (![CITATIONS_TAB.id, REGULATORY_TAB.id].includes(state.panel)) {
    plot.setMask(context.mask);
  }
  filterPanel.renderSummary(context.dataset.genes.length, context.passing);
}

function renderAll({ schemeErrors = [] } = {}) {
  element('reset-selections').disabled = !state.pinnedId && state.shortlist.length === 0;
  computeMask();
  renderCurrentView();
  renderDetail();
  schemeEditor.update({
    map: state.schemeMap,
    highExpressed: state.highExpressed,
    name: state.schemeName,
    savedNames: Object.keys(store.read(STORAGE_SCHEMES, {})).sort(),
    errors: schemeErrors,
    verification: context.verification,
    genesWithoutTerminalStop: context.dataset.provenance.genesWithoutTerminalStop,
  });
  followColourForTraffic();
  filterPanel.update({
    registry: scopedRegistry(),
    colorMetricKey: state.colorBy,
    followColor: context.trafficFollowsColor,
    filters: state.filters,
    categoryFilter: state.categoryFilter,
    count: context.dataset.genes.length,
    passing: context.passing,
    missingHidden: context.missingHidden,
    exceptionFilter: state.exceptionFilter,
    exceptionCount: context.exceptionCount,
    expressionFilter: state.expressionFilter,
    basisCounts: context.basisCounts,
    trafficKey: state.trafficKey,
    proteinFilter: state.proteinFilter,
    proteinEvidence: context.dataset.lengthCohorts ? {
      count: context.proteinRecordIds.size,
      unavailableReason: context.dataset.lengthCohorts.directDetection.reason,
      directDetectionLabel: organism.copy.directProteomicsLabel,
    } : null,
    proteinEvidencePending: pendingState(context.dataset, 'lengthCohorts'),
  });
  shortlistPanel.update({
    ids: state.shortlist,
    pinnedId: state.pinnedId,
    dataset: context.dataset,
    registry: context.registry,
    colorSources: state.colorSources,
    filterState: {
      ranges: state.filters,
      categoryFilter: state.categoryFilter,
      proteinEvidence: state.proteinFilter,
      expression: state.expressionFilter,
      translationalException: state.exceptionFilter,
    },
    filterMask: context.mask,
    viewState: () => ({
      ...viewStateOf(state, organism), dataSources: sourceSelection(), typeSources: state.typeSources,
    }),
    // With no scheme set there is no burden to report, so the rows say nothing
    // rather than showing a column of zeros that looks like a measurement.
    schemeActive: Object.keys(state.schemeMap).length > 0,
    schemes: {
      active: { name: state.schemeName, map: state.schemeMap },
      saved: Object.entries(store.read(STORAGE_SCHEMES, {}))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, map]) => ({ name, map })),
    },
  });
  if (searchResults) searchResults.refresh();
  // The comparison and the designer offer measured sources the way the menus
  // do: only the ones selected under Data Sources.
  comparePanel.update({
    ids: state.shortlist,
    dataset: context.dataset,
    registry: scopedRegistry(),
    tab: state.compareTab,
    axisKeys: compareAxes,
  });
  if (panelDesigner) {
    panelDesigner.update({
      dataset: context.dataset,
      registry: scopedRegistry(),
      shortlist: state.shortlist,
      pinnedId: state.pinnedId,
      colorSources: state.colorSources,
      schemes: {
        active: { name: state.schemeName, map: state.schemeMap },
        saved: Object.entries(store.read(STORAGE_SCHEMES, {}))
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, map]) => ({ name, map })),
      },
    });
  }
  dataSourcesPanel?.update(dataSourcesState());
  persist();
}

/**
 * The filters' "Use same source as colouring" rule: while it is on and the
 * colour metric can stand in for gene activity, the low-traffic threshold
 * judges activity by that same metric, and a threshold set on the previous
 * one is dropped rather than silently kept on a metric no longer named.
 */
function followColourForTraffic() {
  if (!context.trafficFollowsColor) return;
  const candidates = orderTrafficCandidates(scopedRegistry());
  if (!candidates.some((metric) => metric.key === state.colorBy)) return;
  if (state.trafficKey === state.colorBy) return;
  if (state.trafficKey) delete state.filters[state.trafficKey];
  state.trafficKey = state.colorBy;
}

function setScheme(map, { name } = {}) {
  const previous = state.schemeMap;
  state.schemeMap = map;
  if (name !== undefined) state.schemeName = name;
  const errors = recomputeScheme();
  if (errors.length > 0) {
    state.schemeMap = previous;
    recomputeScheme();
    renderAll({ schemeErrors: errors });
    announce(`Scheme rejected. ${errors[0]}`);
    return;
  }
  renderAll();
  const targets = context.scheme.targets.length;
  announce(targets === 0
    ? 'Recoding scheme cleared.'
    : `Scheme applied: ${targets} target codon${targets === 1 ? '' : 's'}. `
      + `${context.verification?.ok ? 'Protein identity verified.' : ''}`);
}

function setPinned(index) {
  const previousId = state.pinnedId;
  const gene = index >= 0 ? context.dataset.genes[index] : null;
  state.pinnedId = gene ? gene.id : null;
  context.hoveredIndex = -1;
  // A committed pointer/search/keyboard selection supersedes an old keyboard
  // preview. Otherwise the detail panel keeps describing the stale active gene
  // while the URL and announcer correctly name the newly pinned one.
  context.activeIndex = -1;
  renderAll();
  if (gene) {
    const hasSymbol = geneIdentity(gene)?.kind === 'Gene symbol';
    announce(`Pinned ${geneMapLabel(gene)}.${hasSymbol && gene.product ? ` ${gene.product}` : ''}`);
  } else if (previousId) {
    announce(`Unpinned ${previousId}.`);
  }
}

/**
 * Arrow-key navigation moves this without pinning anything. It is what Enter
 * pins and what S adds to the shortlist when nothing is pinned yet, and it
 * drives the same detail panel a pointer hover would, so a keyboard user gets
 * the same information a mouse user does.
 */
/** What a keyboard preview says, wherever the preview came from. */
function announceActive(index) {
  if (index < 0) return;
  const gene = context.dataset.genes[index];
  announce(`${geneMapLabel(gene)} active. `
    + 'Press Enter to pin, S to add or remove it from the shortlist.');
}

function previewActive(index) {
  context.activeIndex = index;
  plot.setMarks({ active: index });
  renderDetail();
  announceActive(index);
}

function toggleShortlist(index) {
  if (index < 0) return;
  const id = context.dataset.genes[index].id;
  const position = state.shortlist.indexOf(id);
  if (position >= 0) state.shortlist.splice(position, 1);
  else state.shortlist.push(id);
  renderAll();
  announce(position >= 0
    ? `${id} removed from the shortlist. ${state.shortlist.length} remain.`
    : `${id} added to the shortlist. ${state.shortlist.length} candidate${state.shortlist.length === 1 ? '' : 's'}.`);
}

function buildPanelTabs() {
  const host = element('panel-tabs');
  host.replaceChildren();
  const buttons = ALL_TABS.map((panel, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tab';
    button.textContent = panel.name;
    button.setAttribute('role', 'tab');
    button.id = `panel-tab-${panel.id}`;
    button.addEventListener('click', () => {
      state.panel = panel.id;
      updatePanelTabs();
      renderCurrentView();
      persist();
      announce(`${panel.name}. ${tabBlurb(panel, organism)}`);
    });
    button.addEventListener('keydown', (event) => {
      const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (offset === 0) return;
      event.preventDefault();
      const next = ALL_TABS[(i + offset + ALL_TABS.length) % ALL_TABS.length];
      state.panel = next.id;
      updatePanelTabs();
      renderCurrentView();
      persist();
      element(`panel-tab-${next.id}`).focus();
    });
    host.append(button);
    return button;
  });
  context.panelTabs = buttons;
}

function updatePanelTabs() {
  ALL_TABS.forEach((panel, i) => {
    const selected = panel.id === state.panel;
    const button = context.panelTabs[i];
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    button.classList.toggle('active', selected);
  });
  const mapTab = PANELS.find((panel) => panel.id === state.panel);
  element('map-view').setAttribute('aria-labelledby', `panel-tab-${mapTab?.id ?? 'native'}`);
}

/**
 * Draw the citations tab, blurb and body together.
 *
 * The blurb introduces the entries, so it goes when there are none to
 * introduce: an organism whose release publishes no ledger gets the short
 * unavailable state and nothing else, as the Lengths and Regulatory sites tabs
 * do for a layer their dataset does not carry.
 */
function renderCitationsTab(manifest) {
  element('panel-blurb').textContent = citationsBlurb(manifest);
  citationsPanel.render(manifest);
}

/**
 * Switch between the map view and the citations ledger, hiding whichever one
 * is not on screen. The tablist, the URL, and localStorage persistence are
 * shared across both, so a link to a map panel or to the citations tab round-
 * trips through the same `state.panel` field either way.
 */
function renderCurrentView() {
  const citationsActive = state.panel === CITATIONS_TAB.id;
  const lengthsActive = state.panel === LENGTH_TAB.id;
  const regulatoryActive = state.panel === REGULATORY_TAB.id;
  const chromosomeActive = state.panel === CHROMOSOME_TAB.id;
  const mapActive = !citationsActive && !lengthsActive && !regulatoryActive && !chromosomeActive;
  element('features-used').hidden = !mapActive;
  element('main').classList.toggle('citations-active', citationsActive);
  element('main').classList.toggle('lengths-active', lengthsActive);
  element('main').classList.toggle('regulatory-active', regulatoryActive);
  element('main').classList.toggle('chromosome-active', chromosomeActive);
  workspaceResizer?.update();
  element('map-view').hidden = !mapActive;
  element('chromosome-view').hidden = !chromosomeActive;
  element('length-view').hidden = !lengthsActive;
  element('regulatory-view').hidden = !regulatoryActive;
  element('citations-view').hidden = !citationsActive;
  if (chromosomeActive) {
    element('panel-blurb').textContent = `${tabBlurb(CHROMOSOME_TAB, organism)} ${CHROMOSOME_TAB.source}`;
    renderChromosomeView();
    return;
  }
  if (citationsActive) {
    renderCitationsTab(citationsManifest);
    return;
  }
  if (lengthsActive) {
    const lengthsPending = pendingState(context.dataset, 'lengthCohorts');
    element('panel-blurb').textContent = lengthsBlurb(context.dataset.lengthCohorts, lengthsPending);
    lengthExplorer.update({
      inventory: context.dataset.lengthCohorts,
      cohortId: state.lengthCohort,
      range: state.filters.lengthNt,
      mapPassing: context.passing,
      mapCount: context.dataset.genes.length,
      pending: lengthsPending,
    });
    return;
  }
  if (regulatoryActive) {
    element('panel-blurb').textContent = tabBlurb(REGULATORY_TAB, organism);
    regulatorySitesPanel.update(context.dataset.regulatoryTss,
      pendingState(context.dataset, 'regulatoryTss'));
    return;
  }
  renderMap();
}

/**
 * One family's metrics for a grouped selector, this organism's measurements
 * first. Family order already puts measured evidence ahead of the
 * codon-adaptation indices; this keeps the same rule inside a family.
 */
function familyMetrics(family) {
  return orderMeasuredFirst(
    context.registry.metrics.filter((metric) => metric.family === family && metricInScope(metric)),
  );
}

/**
 * What the Data Sources section shows: the dataset selection and the colouring
 * metric, plus, while the map is coloured by function category, the
 * organism's annotation-source toggles, which are data sources too (owner
 * decision, 2026-10-06).
 */
function dataSourcesState() {
  const annotation = state.colorBy === FUNCTION_COLOR_KEY && context.dataset.functionCategories
    ? { toggles: COLOR_SOURCE_TOGGLES, sources: state.colorSources, onToggle: toggleColorSource }
    : null;
  const informing = {
    typeOf: (dataset) => ({ key: typeKeyFor(dataset), label: typeLabelFor(dataset) }),
    chosen: (typeKey) => informingDataset(typeKey, state.typeSources, context.datasets, sourceSelection()),
    onInform: (typeKey, id) => setInforming(typeKey, id),
    // The colouring type's full dataset list, with inclusion edited in place.
    colorTypeKey: isTypeKey(state.colorBy) ? state.colorBy : null,
    allOfType: (typeKey) => typeGroups(context.datasets).get(typeKey)?.datasets ?? [],
    isSelected: (id) => sourceSelection().includes(id),
    onSelect: (id, on) => {
      const current = sourceSelection();
      setSources(on ? [...current, id] : current.filter((other) => other !== id));
      announce(`${id} ${on ? 'added to' : 'removed from'} the data selection.`);
    },
  };
  return { selection: sourceSelection(), colorMetricKey: state.colorBy, annotation, informing };
}

/** The chromosome tab's own Data Sources section, built once its toolbar exists. */
function chromosomeDataSources() {
  if (!chromosomeDataSourcesPanel && chromosomeView?.dataSourcesElement()) {
    let storage = null;
    try { storage = window.localStorage; } catch { storage = null; }
    chromosomeDataSourcesPanel = new DataSourcesPanel(chromosomeView.dataSourcesElement(), {
      datasets: context.datasets,
      judgements: context.dataset.meta.pairJudgements ?? [],
      storage,
      onChange: (ids) => setSources(ids),
    });
  }
  return chromosomeDataSourcesPanel;
}

/** The resolved data-source selection: ids of the datasets the menus offer. */
function sourceSelection() {
  return normalizeSelection(state.sources, context.datasets ?? []);
}

/**
 * Whether a metric is offered by the colour, axis and filter selectors. A
 * metric that belongs to a dataset is offered only while that dataset is
 * selected in Data Sources; every computed metric is always offered. The
 * gene detail, the comparison and the provenance list keep showing every
 * source, so hiding a dataset here never hides evidence elsewhere.
 */
function metricInScope(metric) {
  if (!metric || !context.datasets?.length) return true;
  // A dataset's own metric, or the percentile derived from that one dataset,
  // is never offered directly: its type is, informed by the dataset chosen
  // under Data Sources (owner decision, 2026-10-06).
  if (isDatasetOwnKey(metric.key, context.datasets)) return false;
  // A type is offered whenever the release has a dataset of it; asking for a
  // type none of whose datasets is selected selects its defaults (owner
  // report, 2026-10-06: the fitness type was invisible until a set was picked).
  if (metric.isType) return typeGroups(context.datasets).has(metric.key);
  return true;
}

/** Select a type's default datasets when a view asks for the type with none selected. */
function ensureTypeSelected(key) {
  if (!isTypeKey(key) || !context.datasets?.length) return;
  if (contributingDatasets(key, state.typeSources, context.datasets, sourceSelection()).length > 0) return;
  const defaults = defaultDatasetsOfType(key, context.datasets).map((d) => d.id);
  if (!defaults.length) return;
  const next = normalizeSelection([...sourceSelection(), ...defaults], context.datasets);
  state.sources = isDefaultSelection(next, context.datasets) ? [] : next;
  state.typeSources = normalizeTypeSources(state.typeSources, context.datasets, sourceSelection());
  for (const metric of context.registry.metrics) if (metric.isType) context.percentiles.delete(metric.key);
}

/** The registry as the selectors see it: the same lookup, fewer offered metrics. */
function scopedRegistry() {
  return { ...context.registry, metrics: context.registry.metrics.filter(metricInScope) };
}

/**
 * Apply a new data-source selection: the menus narrow or widen, a colour or
 * axis metric that was just deselected falls back to the fresh-view choice,
 * and the link records the selection only when it differs from the default.
 */
function setSources(ids) {
  const next = normalizeSelection(ids, context.datasets);
  state.sources = isDefaultSelection(next, context.datasets) ? [] : next;
  state.typeSources = normalizeTypeSources(state.typeSources, context.datasets, sourceSelection());
  // A type's pooled value changes with the selection; its cached ranks go.
  for (const metric of context.registry.metrics) if (metric.isType) context.percentiles.delete(metric.key);
  if (!metricInScope(context.registry.byKey.get(state.colorBy))) {
    state.colorBy = freshViewColorKey(scopedRegistry(), context.dataset.functionCategories);
    state.colorScale = null;
    resolveColorScale();
  }
  const axes = resolveDefaultMetricAxes(scopedRegistry());
  if (!metricInScope(context.registry.byKey.get(state.axisX))) state.axisX = axes.x;
  if (!metricInScope(context.registry.byKey.get(state.axisY))) state.axisY = axes.y;
  buildColorSelect();
  fillAxisSelects();
  syncAxisSourceSelects();
  plot.projectionId = null;
  renderMap();
  renderAll();
  announce(`Data sources: ${sourceSelection().length} selected.`);
}

/**
 * A metric with several selected sources of its data type gets a source
 * selector beside its axis; one with a single source, or a computed metric,
 * does not. Choosing a source switches the axis to that source's metric.
 */
function syncAxisSourceSelects() {
  for (const [axis, key] of [['x', 'axisX'], ['y', 'axisY']]) {
    const row = element(`axis-${axis}-source-row`);
    const select = element(`axis-${axis}-source`);
    const group = isTypeKey(state[key]) ? typeGroups(context.datasets ?? []).get(state[key]) : null;
    const chosen = new Set(sourceSelection());
    const candidates = group ? group.datasets.filter((dataset) => chosen.has(dataset.id)) : [];
    if (candidates.length < 2) {
      row.hidden = true;
      continue;
    }
    select.replaceChildren();
    for (const dataset of candidates) {
      const option = document.createElement('option');
      option.value = dataset.id;
      option.textContent = `${dataset.record.studyId} · ${dataset.record.conditionSet}`;
      select.append(option);
    }
    const pooled = document.createElement('option');
    pooled.value = '';
    pooled.textContent = `Pooled (${candidates.length} datasets)`;
    select.prepend(pooled);
    select.value = informingDataset(state[key], state.typeSources, context.datasets, chosen)?.id ?? '';
    row.hidden = false;
  }
}

function buildColorSelect() {
  const select = element('color-by');
  select.replaceChildren();
  let group = null;
  let groupName = null;
  for (const option of colorSelectOptions()) {
    if (option.group !== groupName) {
      groupName = option.group;
      group = document.createElement('optgroup');
      group.label = groupName;
      select.append(group);
    }
    const node = document.createElement('option');
    node.value = option.value;
    node.textContent = option.label;
    group.append(node);
  }
  select.value = state.colorBy;
}

/**
 * The map toolbar's Colour by and Scale selectors. Both write the one shared
 * colour selection every view and the legend read, and both are wired by
 * {@link installColorControls}, which owns the scale-clearing rule and the
 * sentence each change announces; {@link syncColorScaleControl} keeps the Scale
 * options and the disabled state pointed at whatever Colour by now holds.
 */
function buildColorControls() {
  buildColorSelect();
  let storage = null;
  try { storage = window.localStorage; } catch { storage = null; }
  dataSourcesPanel = new DataSourcesPanel(element('data-sources'), {
    datasets: context.datasets,
    judgements: context.dataset.meta.pairJudgements ?? [],
    storage,
    onChange: (ids) => setSources(ids),
  });
  dataSourcesPanel.update(dataSourcesState());
  installColorControls({
    colorBy: element('color-by'),
    scale: element('color-scale'),
    model: colorModel,
    announce,
    onChange: ({ colorBy, colorScale }) => {
      state.colorBy = colorBy;
      state.colorScale = colorScale;
      ensureTypeSelected(colorBy);
      renderAll();
    },
  });
  syncColorScaleControl(colorModel());
}

/** Say which metric and scale the colours now read, for a screen reader. */
function announceColorScale() {
  announce(colorAnnouncement(colorModel()));
}

/** Fill both axis selectors with the metrics in scope; listeners are installed once. */
function fillAxisSelects() {
  for (const [axis, key] of [['x', 'axisX'], ['y', 'axisY']]) {
    const select = element(`axis-${axis}`);
    select.replaceChildren();
    for (const family of context.registry.families) {
      const group = document.createElement('optgroup');
      group.label = family;
      for (const metric of familyMetrics(family)) {
        const option = document.createElement('option');
        option.value = metric.key;
        option.textContent = optionLabel(metric);
        group.append(option);
      }
      if (group.children.length > 0) select.append(group);
    }
    select.value = state[key];
  }
}

function buildAxisSelects() {
  fillAxisSelects();
  for (const [axis, key] of [['x', 'axisX'], ['y', 'axisY']]) {
    const select = element(`axis-${axis}`);
    const onAxisChange = (value) => {
      state[key] = value;
      ensureTypeSelected(value);
      syncAxisSourceSelects();
      plot.projectionId = null;
      renderMap();
      persist();
      announce(`Metric plot: ${element('axis-x').selectedOptions[0].textContent} on X, `
        + `${element('axis-y').selectedOptions[0].textContent} on Y.`);
    };
    select.addEventListener('change', () => onAxisChange(select.value));
    element(`axis-${axis}-source`).addEventListener('change', (event) => {
      // The axis keeps its type; the chosen dataset informs it, or the empty
      // choice pools every selected dataset of the type again.
      setInforming(state[key], event.target.value || null);
    });
  }
  syncAxisSourceSelects();
}

/** Build the per-axis scale selectors once; their availability is kept in
 * sync with the current metric by {@link syncAxisScaleAvailability}. The option
 * names come from the shared scale set, so the axis and colour controls call the
 * same scale by the same name. */
function buildAxisScaleSelects() {
  for (const axis of ['x', 'y']) {
    const scaleKey = axis === 'x' ? 'axisXScale' : 'axisYScale';
    const select = element(`axis-${axis}-scale`);
    select.replaceChildren();
    for (const scale of AXIS_SCALES) {
      const option = document.createElement('option');
      option.value = scale;
      option.textContent = VALUE_SCALE_LABELS[scale];
      select.append(option);
    }
    select.value = state[scaleKey];
    select.addEventListener('change', () => {
      state[scaleKey] = select.value;
      renderMap();
      persist();
      announce(`Metric plot: ${axis.toUpperCase()} axis scale set to `
        + `${select.selectedOptions[0].textContent}.`);
    });
  }
}

function buildGeneSearch() {
  // No datalist: it could only complete a locus tag prefix, it put one option
  // elements in the document, and its native dropdown covered the result list
  // that replaced it.
  searchResults = new GeneSearchResults(element('gene-search-results'), {
    onPin: (index) => setPinned(togglePinTarget(index, pinnedIndex())),
    // toggleShortlist re-renders, and that refreshes this list's buttons.
    onShortlist: (index) => toggleShortlist(index),
    isShortlisted: (id) => state.shortlist.includes(id),
    isPinned: (id) => state.pinnedId === id,
  });
  searchResults.setGenes(context.dataset.genes, context.dataset.goTerms?.terms, context.dataset);

  const input = element('gene-search');
  const run = () => {
    const result = searchResults.search(input.value);
    if (!result) return;
    announce(result.total === 0
      ? `Nothing matches ${input.value.trim()}.`
      : `${result.total} gene${result.total === 1 ? '' : 's'} match ${input.value.trim()}.`);
  };
  input.addEventListener('input', () => searchResults.search(input.value));
  input.addEventListener('change', run);
  input.addEventListener('search', run);
}

/** One line per metric: how far the browser's recomputation sits from the pipeline's. */
function describeDivergence(entry, meta) {
  // meta.metrics carries the reader-facing name, so tAI does not become TAI.
  const label = meta.metrics?.[entry.key]?.label ?? entry.key;
  return `${label}: worst ${entry.worst.toExponential(2)} at `
    + `${entry.worstGene}, mean ${entry.meanAbsDifference.toExponential(2)}, over `
    + `${formatCount(entry.compared)} genes`;
}

/**
 * Collect everything that says the browser and the pipeline computed one quantity
 * two different ways: a metric outside tolerance, tAI weights that do not
 * reproduce the published substitution, or an ENC family flag that disagrees.
 */
function recomputationProblems() {
  const { provenance, meta } = context.dataset;
  const checked = provenance.agreement.filter((entry) => entry.compared > 0);
  const problems = checked
    .filter((entry) => !entry.agrees)
    .map((entry) => describeDivergence(entry, meta));
  const tai = provenance.taiReport;
  if (!tai.substitutionAgrees) {
    problems.push('tAI zero-weight substitution: this page computes '
      + `${tai.recomputedSubstitution.toFixed(6)} from the published tRNA copies, but `
      + `meta.json publishes ${tai.publishedSubstitution}`);
  }
  if (!tai.zeroWeightCodonsAgree) {
    problems.push('tAI zero-weight codons: this page finds '
      + `${tai.zeroWeightCodons.join(', ') || 'none'}, meta.json publishes `
      + `${(tai.publishedZeroWeightCodons ?? []).join(', ') || 'none'}`);
  }
  if (provenance.encFlagMismatches > 0) {
    problems.push(`ENC family substitution: ${formatCount(provenance.encFlagMismatches)} genes `
      + 'disagree with the published encHasSubstitutedFamilies flag');
  }
  return { checked, problems };
}

/**
 * Show a banner when a recomputed metric does not match the pipeline.
 *
 * A difference here is not a tolerance to be reported as agreement. The maps and
 * the deltas are drawn from the browser's numbers while the filters, the colour
 * scales and the Translation section show the pipeline's, so a disagreement means
 * one gene carries two values for one quantity and the controls no longer
 * describe the picture. That has to be impossible to miss.
 */
function renderMetricAgreement() {
  const banner = element('metric-agreement');
  const { checked, problems } = recomputationProblems();
  banner.replaceChildren();
  if (problems.length === 0) {
    banner.hidden = true;
    return;
  }
  banner.hidden = false;
  const heading = document.createElement('strong');
  heading.textContent = 'These numbers disagree with the published dataset. Do not trust the '
    + 'absolute values on this page.';
  const what = document.createElement('p');
  what.textContent = `${problems.length} recomputation check`
    + `${problems.length === 1 ? '' : 's'} of ${formatCount(checked.length)} metrics failed. `
    + 'This page recomputes each metric so a recoded gene can be compared with wild type. '
    + 'Where that recomputation differs from the pipeline, the maps and deltas are built from '
    + 'one set of numbers while the filters, the colour scale and the Translation section show '
    + 'the other, so the same gene can display two values for one quantity.';
  const list = document.createElement('ul');
  for (const problem of problems) {
    const item = document.createElement('li');
    item.textContent = problem;
    list.append(item);
  }
  const tolerance = document.createElement('p');
  tolerance.textContent = 'Anything above '
    + `${checked[0]?.tolerance ?? RECOMPUTATION_TOLERANCE} is a convention the two sides do not `
    + 'share, not rounding: genes.json publishes six decimals, so rounding alone cannot exceed '
    + '5e-7. Differences between two schemes are computed browser against browser and stay '
    + 'internally consistent, so scheme comparisons remain meaningful.';
  banner.append(heading, what, list, tolerance);
}

function renderProvenance() {
  const host = element('provenance');
  const { meta, provenance } = context.dataset;
  host.replaceChildren();
  const list = document.createElement('dl');
  list.className = 'provenance-list';
  const add = (term, description) => {
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = description;
    list.append(dt, dd);
    return dd;
  };
  add('Genome', `${meta.genome?.accession ?? 'unknown'} · taxid ${meta.genome?.taxid ?? '?'}`);
  add('Built', meta.builtAt ?? 'unknown');
  add('Genes loaded', `${formatCount(provenance.loadedGeneCount)}`
    + (provenance.declaredGeneCount && provenance.declaredGeneCount !== provenance.loadedGeneCount
      ? ` (meta.json declares ${formatCount(provenance.declaredGeneCount)})` : ''));
  // A count of zero is a claim, so it is not made before the file has landed.
  add('Excluded CDS', isLoading(context.dataset, 'excluded') ? 'loading…'
    : hasFailed(context.dataset, 'excluded') ? 'could not be loaded'
      : formatCount(provenance.excludedCount));
  add('CAI reference set', provenance.caiReferenceFallback
    ? 'not found in this dataset, so weights come from genome-wide usage'
    : `${formatCount(provenance.caiReferenceGenes)} genes`);

  const { checked, problems } = recomputationProblems();
  const check = add('Recomputation check', problems.length === 0
    ? `${formatCount(checked.length)} metrics recomputed here match the pipeline to `
      + `${checked[0]?.tolerance ?? RECOMPUTATION_TOLERANCE}, the rounding limit of the `
      + 'six decimals genes.json publishes'
    : `${problems.length} check${problems.length === 1 ? '' : 's'} failed. See the warning at `
      + 'the top of the page.');
  if (problems.length > 0) check.className = 'provenance-warning';

  const report = provenance.conventionReport;
  add('Metric conventions',
    `${report.fromMeta.length} read from meta.json, ${report.fallbacks.length} not published `
    + 'and assumed here');

  if (meta.encFamilyConvention) add('ENC families', meta.encFamilyConvention);

  const tai = provenance.taiReport;
  add('tAI zero-weight codons', tai.zeroWeightCodons.length === 0
    ? 'none: every sense codon has a tRNA that reads it'
    : `${tai.zeroWeightCodons.join(', ')} `
      + `${tai.zeroWeightCodons.length === 1 ? 'takes' : 'take'} the substituted weight `
      + `${tai.substitution.toFixed(6)}`);
  if (provenance.conventionReport.sDefaulted.length > 0) {
    add('tAI constraints', `${provenance.conventionReport.sDefaulted.length} selective-constraint `
      + `value${provenance.conventionReport.sDefaulted.length === 1 ? '' : 's'} `
      + `(${provenance.conventionReport.sDefaulted.join(', ')}) were not published and use the `
      + 'dos Reis fitted defaults');
  }
  if (tai.modifiedAnticodons.length > 0 && meta.tai?.lysidineConvention) {
    add('Modified anticodons', `${tai.modifiedAnticodons.join(', ')}. `
      + meta.tai.lysidineConvention);
  }
  if (tai.unconstrainedPairings.length > 0) {
    add('tAI pairings without a constraint',
      `${tai.unconstrainedPairings.length} anticodon-codon pairings have no published s value, `
      + 'so they are scored as unable to decode, as the pipeline does');
  }

  if (provenance.expressionSources.length) {
    renderMeasurementSources(add('Measurement data', ''), provenance.expressionSources);
  }
  if (provenance.genesWithoutTerminalStop > 0) {
    add('Terminal stops', `${formatCount(provenance.genesWithoutTerminalStop)} genes carry no `
      + 'terminalStop field, so a stop-reassignment scheme cannot be costed for them');
  }
  host.append(list);

  // The convention list carries long field names, so it sits outside the
  // two-column definition grid where a narrow value cell would break it a
  // character at a time.
  const details = document.createElement('details');
  details.className = 'convention-details';
  const summary = document.createElement('summary');
  summary.textContent = 'Which convention came from where';
  details.append(summary);
  const conventionList = document.createElement('ul');
  for (const entry of [...report.fromMeta, ...report.fallbacks]) {
    const item = document.createElement('li');
    const label = document.createElement('b');
    label.textContent = entry.label;
    item.append(label, document.createTextNode(` — ${entry.detail}`));
    conventionList.append(item);
  }
  details.append(conventionList);
  host.append(details);
}

/**
 * Apply a decoded (partial) state, honouring precedence once: an explicit URL
 * value wins; a field the URL truly leaves unspecified falls back to local
 * persistence (only the shortlist has any); anything still unset falls back
 * to a default. Called from boot with the initial hash and again from the
 * live hash/popstate handlers, so both paths normalize identically.
 *
 * Every call rebuilds from a fresh `defaultState()` before layering `decoded`
 * on top, rather than patching whatever is already on screen. `encodeState`
 * only ever writes non-default fields, so a hash that means "back to
 * defaults" for, say, the scheme or the filters says nothing about them at
 * all; patching onto live state would leave that old scheme or filter
 * displayed forever, which is exactly the "address bar says one thing, the
 * page shows another" bug this whole mechanism exists to prevent.
 */
function normalizeAndApply(decoded) {
  applyDecoded(state, decoded, organism);
  // The shortlist is the one field with a second, local source of truth: a
  // hash that never mentions it (a bare initial load, or a partial/legacy
  // link) defers to what this browser last saved, not to the empty default
  // and not to whatever was on screen a moment ago.
  if (!('shortlist' in decoded)) state.shortlist = store.read(STORAGE_SHORTLIST, []);

  // Drop any shortlisted or pinned gene that is not in this dataset, so a stale link degrades cleanly.
  state.shortlist = state.shortlist.filter((id) => context.dataset.indexById.has(id));
  if (state.pinnedId && !context.dataset.indexById.has(state.pinnedId)) state.pinnedId = null;
  if (!ALL_TABS.some((panel) => panel.id === state.panel)) state.panel = 'native';
  // A link's protein filter survives while the inventory is still loading, and
  // while it has failed and may be retried; it is dropped only once the file is
  // known not to be published.
  if (!context.dataset.lengthCohorts && !pendingState(context.dataset, 'lengthCohorts')) {
    state.proteinFilter = 'any';
  }
  if (!context.basisCounts.recorded) state.expressionFilter = 'any';
  // A category selection means nothing in a dataset with no function
  // categories, so it is not kept in the state, the address, or an export.
  if (!context.dataset.functionCategories) state.categoryFilter = [];

  const schemeErrors = recomputeScheme();
  if (schemeErrors.length > 0) {
    state.schemeMap = {};
    recomputeScheme();
  }
  if (!context.registry) {
    context.registry = buildMetricRegistry(context.dataset.meta, context.dataset.genes, context.live);
  }
  context.datasets = datasetsFrom(context.dataset.meta);
  state.sources = isDefaultSelection(state.sources, context.datasets)
    ? [] : normalizeSelection(state.sources, context.datasets);
  installTypeMetrics();
  // A link that names a dataset's own metric (an older link, or one written by
  // the per-dataset menus) means that type informed by that dataset.
  adoptLegacyMetricKeys();
  state.typeSources = normalizeTypeSources(state.typeSources, context.datasets, sourceSelection());
  // A link that colours, plots or filters by a type selects that type's
  // defaults when it carries no dataset of it.
  for (const key of [state.colorBy, state.axisX, state.axisY, state.trafficKey, ...Object.keys(state.filters)]) {
    if (key && context.registry.byKey.has(key)) ensureTypeSelected(key);
  }
  // A filter or a traffic metric this dataset has no metric for cannot act, so
  // it is dropped rather than carried in the address as if it were in effect.
  state.filters = Object.fromEntries(Object.entries(state.filters)
    .filter(([key]) => context.registry.byKey.has(key)));
  if (state.trafficKey && !context.registry.byKey.has(state.trafficKey)) state.trafficKey = null;
  if (!state.colorBy || !((context.registry.byKey.has(state.colorBy)
    && metricInScope(context.registry.byKey.get(state.colorBy)))
    || (state.colorBy === FUNCTION_COLOR_KEY && context.dataset.functionCategories))) {
    state.colorBy = freshViewColorKey(scopedRegistry(), context.dataset.functionCategories);
  }
  // Colour by is settled, so the scale can be: a hash naming `csc` keeps it, and
  // anything else — a fresh view, an older link, a scale this metric cannot take
  // — becomes the metric's own default. Resolved here rather than at first paint
  // so a link written before any view renders already records the real scale.
  resolveColorScale();
  const freshAxes = {
    x: typeKeyOf(organism.freshAxes.x, context.datasets),
    y: typeKeyOf(organism.freshAxes.y, context.datasets),
  };
  const axes = resolveDefaultMetricAxes(scopedRegistry(), freshAxes);
  if (!metricInScope(context.registry.byKey.get(state.axisX))) state.axisX = axes.x;
  if (!metricInScope(context.registry.byKey.get(state.axisY))) state.axisY = axes.y;
}

/**
 * Add the data-type metrics to the registry, once per dataset. Each reads the
 * dataset that informs its type at call time, so the reader's choice under
 * Data Sources changes what is drawn without any rebuild.
 */
function installTypeMetrics() {
  const registry = context.registry;
  if (registry.metrics.some((metric) => metric.isType)) return;
  const typeMetrics = buildTypeMetrics(context.datasets, {
    contributing: (typeKey) => contributingDatasets(typeKey, state.typeSources, context.datasets, sourceSelection()),
    metricOf: (dataset) => registry.byKey.get(dataset.metricKey) ?? null,
    geneCount: context.dataset.genes.length,
  });
  // Placed before the first dataset metric so the Expression family keeps its
  // position in every default order.
  const first = registry.metrics.findIndex((metric) => metric.family === 'Expression');
  registry.metrics.splice(first < 0 ? registry.metrics.length : first, 0, ...typeMetrics);
  for (const metric of typeMetrics) registry.byKey.set(metric.key, metric);
}

/**
 * Read a dataset's own metric key out of the view state as its type, informed
 * by that dataset: the colour, both axes, the traffic metric and the filters.
 * The dataset joins the selection if the link left it out, so the link still
 * shows what its author saw.
 */
function adoptLegacyMetricKeys() {
  const adopt = (key) => {
    const dataset = context.datasets.find((d) => d.metricKey === key);
    if (!dataset) return key;
    const typeKey = typeKeyFor(dataset);
    if (!sourceSelection().includes(dataset.id)) {
      state.sources = normalizeSelection([...sourceSelection(), dataset.id], context.datasets);
    }
    state.typeSources = { ...state.typeSources, [typeKey]: dataset.id };
    return typeKey;
  };
  // Two keys of one type can disagree on the dataset; the colour is what the
  // reader saw, so it is adopted last and wins.
  state.filters = Object.fromEntries(Object.entries(state.filters).map(([key, range]) => [adopt(key), range]));
  if (state.trafficKey) state.trafficKey = adopt(state.trafficKey);
  state.axisX = adopt(state.axisX);
  state.axisY = adopt(state.axisY);
  state.colorBy = adopt(state.colorBy);
}

/**
 * Name the dataset that informs one type metric, or `null` to pool every
 * selected dataset of the type again. The type's cached ranks and a defaulted
 * colour scale are recomputed from the new values.
 */
function setInforming(typeKey, datasetId) {
  const group = typeGroups(context.datasets).get(typeKey);
  if (!group) return;
  const next = { ...state.typeSources };
  if (datasetId) next[typeKey] = datasetId; else delete next[typeKey];
  state.typeSources = normalizeTypeSources(next, context.datasets, sourceSelection());
  context.percentiles.delete(typeKey);
  if (state.colorBy === typeKey) { state.colorScale = null; resolveColorScale(); }
  renderAll();
  const dataset = informingDataset(typeKey, state.typeSources, context.datasets, sourceSelection());
  const count = contributingDatasets(typeKey, state.typeSources, context.datasets, sourceSelection()).length;
  announce(dataset
    ? `${group.label} now reads ${dataset.record.studyId}: ${dataset.record.conditionSet}.`
    : `${group.label} now pools ${count} selected datasets.`);
}


/**
 * Apply a hash the address bar now carries, live: a shared link pasted or
 * edited into an already-open tab, or a back/forward navigation across two
 * such links. Without this, the viewer only ever reads its hash once, in
 * `boot`, and the address bar can claim one analysis while every panel still
 * shows another until the page is reloaded.
 */
function applyLiveHash() {
  if (applyingHash || !context.dataset) return;
  const decoded = decodeState(window.location.hash, organism);
  normalizeAndApply(decoded);
  context.hoveredIndex = -1;
  context.activeIndex = -1;
  // Forces renderMap's own `setProjection` call to treat this as a fresh
  // panel and reset pan/zoom, since a pasted link should show what it
  // encodes at a known scale rather than whatever view the old panel was
  // left at.
  plot.projectionId = null;
  // The same rule for the chromosome camera: a pasted link shows the whole
  // genome, not whatever window the previous view was left at.
  chromosomeView?.resetView({ announce: false });
  updatePanelTabs();
  buildColorSelect();
  fillAxisSelects();
  syncAxisSourceSelects();
  syncSharedControls();
  element('axis-x').value = state.axisX;
  element('axis-y').value = state.axisY;
  element('axis-x-scale').value = state.axisXScale;
  element('axis-y-scale').value = state.axisYScale;
  // The controls column is view state like any other, so a pasted link or a
  // Back button rearranges it too. Without this the address bar would describe
  // one layout while the page kept the previous one.
  leftPanels?.apply({ order: state.panelOrder, collapsed: state.panelCollapsed });
  renderAll();
  announce('View updated from the address bar.');
}

/** The set of protein-record loci the protein filter reads, from the length inventory. */
function refreshProteinRecords() {
  context.proteinRecordIds = new Set((context.dataset.lengthCohorts?.records ?? [])
    .filter((record) => record.refseqProteinRecord).map((record) => record.id));
}

/**
 * The later files this view cannot be shown without, beyond tier 1.
 *
 * A shared link changes what the page waits for. A link that filters by
 * category, filters by protein evidence, opens the Lengths or Regulatory sites
 * tab, or pins a gene promotes the files that view reads, so it never opens
 * onto a view still missing its own data. A fresh view waits for none: its map
 * draws on tier 1 and its colour arrives as the category files land.
 *
 * @param {object} view the state the link asks for. It is read from the hash
 *   alone, before any data has arrived, so the loading bar can measure the
 *   files this visit waits for from its first frame instead of changing its
 *   denominator part way.
 */
function promotedFileKeys(view) {
  const keys = new Set();
  if (view.categoryFilter.length > 0) keys.add('sourceDerivedCategories');
  if (view.proteinFilter !== 'any' || view.panel === LENGTH_TAB.id) keys.add('lengthCohorts');
  if (view.panel === REGULATORY_TAB.id) keys.add('regulatoryTss');
  if (view.pinnedId) {
    for (const key of ['sourceDerivedCategories', 'annotations', 'candidateEvidence',
      'goIeaEssentiality', 'goTerms', 'tssEvidence']) keys.add(key);
  }
  return [...keys];
}

/**
 * The later files whose metrics the view reads, known once `meta.json` has
 * named which metric arrives in which file: a link coloured, plotted,
 * filtered, or traffic-lit by a metric from the expression-layer payload waits
 * for that payload the way a pinned gene waits for its evidence.
 */
function promotedMetricFileKeys(view, registry) {
  const named = [view.colorBy, view.axisX, view.axisY, view.trafficKey,
    ...Object.keys(view.filters ?? {})];
  const keys = new Set();
  for (const key of named) {
    const fileKey = registry.byKey.get(key)?.fileKey;
    if (fileKey) keys.add(fileKey);
  }
  return [...keys];
}

/** A later file settled. Renders are coalesced, since several often land together. */
function fileLanded(key) {
  landed.add(key);
  if (!booted || landingFlush) return;
  landingFlush = true;
  queueMicrotask(flushLandings);
}

/**
 * Bring the page up to date with every file that settled since the last render.
 *
 * Most of the page reads the dataset afresh on each render, so a re-render is
 * all a landing needs. The few values computed once at start-up are recomputed
 * here, each against the file it was computed from.
 */
function flushLandings() {
  landingFlush = false;
  if (landed.size === 0) return;
  const keys = new Set(landed);
  landed.clear();
  const { dataset } = context;
  if (keys.has('lengthCohorts')) {
    refreshProteinRecords();
    // Kept while the inventory was loading or had failed; dropped only now
    // that it is known not to be published.
    if (!dataset.lengthCohorts && !pendingState(dataset, 'lengthCohorts')) {
      state.proteinFilter = 'any';
    }
  }
  // The native projection's axis labels and loadings come from this file.
  if (keys.has('codonPca')) context.projections.clear();
  if (keys.has('goTerms') || keys.has('annotations')) {
    searchResults?.setGenes(dataset.genes, dataset.goTerms?.terms, dataset);
  }
  if (keys.has('excluded')) renderProvenance();
  // Percentile ranks cached while a layer's values were still unknown would
  // stay empty; the layer's metrics rank afresh from the values that landed.
  if (keys.has('expressionLayers')) {
    for (const metric of context.registry.metrics) {
      if (metric.fileKey === 'expressionLayers') context.percentiles.delete(metric.key);
    }
  }
  const awaiting = context.scaleAwaitsFile;
  if (awaiting && keys.has(awaiting.fileKey)) {
    context.scaleAwaitsFile = null;
    if (state.colorBy === awaiting.key) state.colorScale = null;
  }
  loadProgress.setFiles(staged.files);
  renderAll();
  if (loadReview && revealed && !reducedMotion) {
    // Data landings may replace whole panels. Preserve the original deadline
    // for unchanged content and give genuinely new content one local reveal.
    textScramble.refresh(scrambleRoots());
  }
  // The categories arrived after the points had already appeared in the
  // not-loaded colour: let them take their real colours the way the intro does,
  // rather than all at once. An intro still running picks the colours up itself.
  if (revealed && keys.has('sourceDerivedCategories') && state.colorBy === FUNCTION_COLOR_KEY
    && !isLoading(dataset, 'sourceDerivedCategories') && !plot.introActive) {
    startMapIntro({ appearMs: 0, colourMs: loadTiming.mapIntro.colourMs });
  }
}

/** Ask again for one later file that could not be loaded. */
function retryFile(key) {
  if (!staged?.retry(key)) return;
  loadProgress.beginRetry([key], dataFileLabel(DATA_FILE_BY_KEY[key], organism));
  loadProgress.setFiles(staged.files);
  renderAll();
  announce(`Retrying ${dataFileLabel(DATA_FILE_BY_KEY[key], organism)}.`);
}

/**
 * The empty shell gives way to the page.
 *
 * Everything was built while the shell hid it, so this only uncovers it: the
 * text appears, the sections below the workspace are shown, and the stage with
 * the grid and the chromosome bar is replaced by the map it stood in for.
 */
function revealPage() {
  revealed = true;
  document.body.classList.remove('is-loading');
  for (const id of ['compare-section', 'panel-section', 'site-footer']) element(id).hidden = false;
  loadProgress.setFiles(staged.files);
  loadProgress.reveal();
  // The canvases were built inside a frame that was not displayed. Their sizes
  // are real only now, so the first true picture is drawn here.
  workspaceResizer?.update();
  renderAll();
  loadProgress.completePreparation('final-geometry');
  // The status line said the data was loading, to assistive technology only.
  // It is no longer true, so it leaves; a failure would have replaced it.
  element('load-status').hidden = true;
  performance.mark('cyano:revealed');
  // The visit starts at the top of the page, by owner decision of 2026-09-30:
  // the shell may have been scrolled, and on one column it led with the grid.
  window.scrollTo({ top: 0, behavior: 'instant' });
  startMapIntro(loadTiming.mapIntro);
  startTextReveal();
}

/**
 * Type the page's text in as flipping base letters that settle into the words.
 *
 * Presentation only, so it is skipped under reduced motion. The real text is in
 * the document throughout and the animated regions are hidden from assistive
 * technology while they flip, so a screen reader reads the final text once. A
 * panel the page re-renders during the run simply shows its final text.
 */
function startTextReveal() {
  if (reducedMotion) return;
  try {
    textScramble.run(scrambleRoots());
  } catch (error) {
    // The animation is decoration over real text. If it cannot run, the text
    // must still be there: cancelling restores every node it had touched.
    textScramble.cancel();
    console.error(error);
  }
}

function scrambleRoots() {
  return [
    document.querySelector('.site-header'), element('main'), element('compare-section'),
    element('panel-section'), element('site-footer'),
  ];
}

/** Yield all synchronous preparation and begin the reveal on a clean frame. */
function cleanRevealFrame() {
  return new Promise((resolve) => requestAnimationFrame((time) => {
    performance.mark('cyano:reveal-frame');
    resolve(time);
  }));
}

/** Whether the tab on screen is one of the scatter maps. */
function mapTabActive() {
  return PANELS.some((panel) => panel.id === state.panel);
}

/**
 * Fill the map's points in, and let them take their colour.
 *
 * Presentation only: skipped under reduced motion and on any tab that is not a
 * scatter map. While the function categories are still loading the points
 * appear in the one neutral colour that means not loaded, and `flushLandings`
 * runs the colour half again when the categories arrive.
 */
function startMapIntro({ appearMs, colourMs }) {
  if (reducedMotion || !mapTabActive()) return;
  plot.startIntro({ appearMs, colourMs });
}

/**
 * Load timings in the console, behind `?load-log`.
 *
 * The three marks are always recorded, because they cost nothing and the
 * browser's own performance panel reads them; the table is printed only when
 * asked for, so that "still fast" can be measured on a real device.
 */
function logLoadTimings() {
  performance.mark('cyano:settled');
  if (!new URLSearchParams(window.location.search).has('load-log')) return;
  const round = (value) => (Number.isFinite(value) ? Math.round(value) : null);
  console.table(DATA_FILES.map((file) => {
    const record = staged.files[file.key];
    return {
      file: file.name, tier: file.tier, state: record.state, bytes: record.bytes,
      startMs: round(record.startedAt), endMs: round(record.endedAt),
    };
  }));
  console.table(performance.getEntriesByType('mark')
    .filter((mark) => mark.name.startsWith('cyano:'))
    .map((mark) => ({ milestone: mark.name, ms: round(mark.startTime) })));
}

async function boot() {
  // The minimum bar time is presentation, so reduced motion has none.
  loadProgress ??= new LoadProgress({
    stage: element('load-stage'), presentation: element('load-progress-presentation'),
    bar: element('load-progress'), status: element('load-progress-status'), tail: element('load-tail'),
  }, { onRetry: (key) => (key === 'citations' ? retryCitations?.() : retryFile(key)) }, {
    minimumMs: reducedMotion ? 0 : loadTiming.minimumBarMs,
    tierLabels: tierLabelsFor(organism),
    organism,
    review: loadReview,
    terminalHoldMs: reducedMotion || loadReview?.name === 'B' ? 0 : 150,
  });
  for (const [key, label] of [
    ['context', 'data context'],
    ['state', 'view state'],
    ['initial-view', 'initial view'],
    ['final-geometry', 'final geometry'],
  ]) loadProgress.registerPreparation(key, label);
  // The link decides when the usable page may be revealed. The bar measures the
  // whole cycle, so later tiers continue in the same chromosome presentation.
  const requested = defaultState(organism);
  applyDecoded(requested, decodeState(window.location.hash, organism), organism);
  const promoted = promotedFileKeys(requested);
  loadProgress.setBlocking(null);
  loadProgress.beginResource('citations', { label: 'source ledger' });
  // The page's inline script has already asked for the manifest and the tier 1
  // files; this hands those requests to the loader instead of repeating them.
  const fetchImpl = adoptingFetch(window.__cyanoEarlyData, (url, init) => fetch(url, init));
  const dataBase = new URL(resolveDataBase(), document.baseURI);
  staged = loadDatasetStaged({
    baseUrl: dataBase,
    fetchImpl,
    onProgress: (snapshot) => loadProgress.update(snapshot),
    onFile: (key) => fileLanded(key),
    // Refuses another organism's assembly, and never asks for a study-bound
    // layer this organism does not declare.
    organism,
  });
  const load = staged;

  // Started beside the dataset so both are in flight together; a missing or
  // broken manifest must never hold up the map. It is addressed through the
  // content manifest like every other data file.
  const loadCitations = async () => {
    let published = true;
    let loadError = null;
    const citationsFetch = async () => {
      const manifest = await load.manifest;
      const entry = manifest?.files.get('citations.json') ?? null;
      // The manifest lists everything this deployment publishes, so a ledger it
      // does not list is absent and needs no request to find that out.
      if (manifest && !entry) {
        published = false;
        return new Response(null, { status: 404 });
      }
      if (entry) loadProgress.updateResource('citations', { totalBytes: entry.bytes });
      const request = dataRequest(dataBase, 'citations.json', entry, 4);
      try {
        const response = await fetchImpl(request.url, request.init);
        if (!response.ok) loadError = new Error(`could not read citations.json: HTTP ${response.status}`);
        return response;
      } catch (error) {
        loadError = new Error(`could not read citations.json: ${error.message}`, { cause: error });
        throw error;
      }
    };
    const manifest = await loadCitationsManifest({ baseUrl: dataBase, fetchImpl: citationsFetch });
    if (manifest === null && published && !loadError) {
      loadError = new Error('citations.json is not a valid source ledger');
    }
    loadProgress.settleResource('citations', manifest !== null
      ? FILE_STATE.READY : (published ? FILE_STATE.FAILED : FILE_STATE.ABSENT), loadError);
    if (manifest !== null) {
      citationsManifest = manifest;
      if (citationsPanel && state.panel === CITATIONS_TAB.id) renderCitationsTab(manifest);
      if (context.dataset && PANELS.some((panel) => panel.id === state.panel)) {
        renderColorHelp(element('colour-help'));
        renderProjectionHelp(element('features-used'),
          projectionHelp(state.panel, context.dataset, context.registry,
            { x: state.axisX, y: state.axisY }), manifest, organism);
      }
      if (context.dataset && chromosomeView && state.panel === CHROMOSOME_TAB.id) {
        renderColorHelp(chromosomeView.colourHelpElement());
      }
    } else {
      citationsManifest = null;
      if (citationsPanel && state.panel === CITATIONS_TAB.id) renderCitationsTab(null);
    }
    return manifest;
  };
  retryCitations = () => {
    loadProgress.beginResource('citations', { label: 'source ledger' });
    void loadCitations();
  };
  const citationsLoaded = loadCitations();

  let dataset;
  try {
    dataset = await load.core;
  } catch (error) {
    showLoadError(error);
    return;
  }
  performance.mark('cyano:core');
  performance.mark('cyano:prepare-start');
  context.dataset = dataset;
  applyGeneCount(document, dataset.genes.length);
  loadProgress.setIdentity({
    releaseId: dataset.meta.annotationRelease?.releaseId ?? null,
    geneCount: dataset.genes.length,
  });
  refreshProteinRecords();
  context.exceptionCount = dataset.genes
    .filter((gene) => Boolean(gene.translationalException)).length;
  context.basisCounts = expressionBasisCounts(dataset.genes);
  loadProgress.completePreparation('context');

  normalizeAndApply(decodeState(window.location.hash, organism));
  loadProgress.completePreparation('state');

  plot = new ScatterPlot(element('map-canvas'), {
    onHover: (index) => {
      if (index === context.hoveredIndex) return;
      context.hoveredIndex = index;
      plot.setMarks({ hovered: index });
      renderDetail();
    },
    onSelect: (index) => setPinned(togglePinTarget(index, pinnedIndex())),
    onPreview: (index) => previewActive(index),
    onEnterWithNothingActive: () => announce('Nothing is active yet. Use the arrow keys to move '
      + 'to a gene before pressing Enter to pin it.'),
    onShortlistToggle: (index) => toggleShortlist(index),
    onViewChange: scheduleTiming,
  });
  workspaceResizer = new WorkspaceResizer(element('main'), {
    leftHandle: element('resize-controls'),
    rightHandle: element('resize-detail'),
    resetButton: element('reset-panel-widths'),
    storage: store,
    storageKey: STORAGE.panelWidths,
    confirm: () => confirmReset({
      title: 'Reset panel widths?',
      body: 'The controls and gene-detail columns return to their default widths. '
        + 'Any width you dragged or set with the keyboard is discarded.',
      confirmLabel: 'Reset widths',
      opener: element('reset-panel-widths'),
    }),
  });

  leftPanels = new LeftPanels(element('controls-column'), {
    onChange: ({ order, collapsed }) => {
      state.panelOrder = order;
      state.panelCollapsed = collapsed;
      // The visualizer is not drawn while collapsed, so expanding it has to
      // ask for the current gene rather than waiting for the next hover.
      renderDetail();
      persist();
    },
    announce,
  });
  leftPanels.apply({ order: state.panelOrder, collapsed: state.panelCollapsed });

  element('detail-jump').addEventListener('click', () => jumpToDetail());

  // Chromium does not consistently route paging keys into a focused overflow
  // landmark. Handle them only on the landmark itself, leaving controls inside
  // it native, and hand movement back to the page at either scroll boundary.
  element('detail').addEventListener('keydown', (event) => {
    if (event.target !== event.currentTarget) return;
    const detail = event.currentTarget;
    const page = Math.max(80, detail.clientHeight * 0.8);
    const steps = {
      ArrowDown: 40,
      ArrowUp: -40,
      PageDown: page,
      PageUp: -page,
    };
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      detail.scrollTop = event.key === 'Home' ? 0 : detail.scrollHeight;
      return;
    }
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    const max = detail.scrollHeight - detail.clientHeight;
    const canScroll = step > 0 ? detail.scrollTop < max : detail.scrollTop > 0;
    if (canScroll) detail.scrollBy({ top: step });
    else window.scrollBy({ top: step });
  });

  schemeEditor = new SchemeEditor(element('scheme-editor'), dataset, {
    onChange: (map) => setScheme(map),
    onClear: () => setScheme({}, { name: '' }),
    // A name typed here is a draft: it belongs in state the moment it is
    // typed, not only once Save is clicked, or a re-render triggered by an
    // unrelated edit (adding a target, say) would wipe it back to whatever
    // was last saved, since the editor's own DOM value never survived a
    // render pass on its own.
    onNameChange: (name) => {
      state.schemeName = name;
      persist();
    },
    onHighExpressedChange: (value) => {
      state.highExpressed = value;
      const targets = Object.keys(state.schemeMap);
      const map = {};
      for (const codon of targets) {
        const replacement = prefillReplacement(codon, dataset.meta, dataset.table, value, targets);
        if (replacement) map[codon] = replacement;
      }
      setScheme(map);
    },
    onSaveScheme: (name) => {
      const schemes = store.read(STORAGE_SCHEMES, {});
      schemes[name] = state.schemeMap;
      state.schemeName = name;
      const saved = store.write(STORAGE_SCHEMES, schemes);
      renderAll();
      announce(saved
        ? `Scheme saved as ${name}.`
        : 'This browser refused to store the scheme; the link in the address bar still carries it.');
    },
    onLoadScheme: (name) => {
      const schemes = store.read(STORAGE_SCHEMES, {});
      if (schemes[name]) setScheme(schemes[name], { name });
    },
    onDeleteScheme: (name) => {
      const schemes = store.read(STORAGE_SCHEMES, {});
      delete schemes[name];
      store.write(STORAGE_SCHEMES, schemes);
      if (state.schemeName === name) state.schemeName = '';
      renderAll();
      announce(`Scheme ${name} deleted.`);
    },
  });

  filterPanel = new FilterPanel(element('filters'), {
    onChange: (filters) => {
      cancelLiveFilters();
      state.filters = filters;
      for (const key of Object.keys(filters)) ensureTypeSelected(key);
      renderAll();
    },
    onLiveChange: (filters) => applyFiltersLive(filters),
    onClear: () => {
      Object.assign(state, clearedFilterState());
      renderAll();
      announce(`All filters cleared. Showing all ${formatCount(context.dataset.genes.length)} genes.`);
    },
    onExceptionFilterChange: (mode) => {
      state.exceptionFilter = mode;
      renderAll();
      announce(mode === 'any'
        ? 'Showing genes with and without translational exceptions.'
        : mode === 'only'
          ? 'Showing only genes with a translational exception.'
          : 'Hiding genes with a translational exception.');
    },
    onExpressionFilterChange: (mode) => {
      state.expressionFilter = mode;
      renderAll();
      announce(mode === 'measured'
        ? `Showing only the ${formatCount(context.passing)} genes with a measured expression value.`
        : 'Showing genes whatever their expression basis.');
    },
    onTrafficKeyChange: (key, filters) => {
      state.trafficKey = key;
      state.filters = filters;
      ensureTypeSelected(key);
      renderAll();
    },
    onTrafficFollowChange: (follow) => {
      context.trafficFollowsColor = follow;
      renderAll();
      announce(follow
        ? 'The low-traffic threshold now judges activity by the colouring metric.'
        : 'The low-traffic threshold now keeps its own source.');
    },
    onSelectSource: async (dataType, current, opener) => {
      const key = await dataSourcesPanel.open({
        mode: 'single', dataType, current, opener, title: 'Select the source the filter judges activity by',
      });
      if (!key) return;
      const dataset = context.datasets.find((d) => d.metricKey === key);
      if (!dataset) return;
      const typeKey = typeKeyFor(dataset);
      if (state.trafficKey !== typeKey) {
        const filters = { ...state.filters };
        if (state.trafficKey) delete filters[state.trafficKey];
        state.trafficKey = typeKey;
        state.filters = filters;
      }
      setInforming(typeKey, dataset.id);
    },
    onProteinFilterChange: (mode) => {
      state.proteinFilter = mode;
      renderAll();
    },
  });

  lengthExplorer = new LengthExplorer(element('length-view'), {
    onCohortChange: (cohort) => {
      state.lengthCohort = cohort;
      renderAll();
    },
    onRangeChange: (bound, value) => {
      const current = state.filters.lengthNt ?? { min: null, max: null, includeMissing: true };
      const next = { ...current, [bound]: value };
      if (next.min !== null && next.max !== null && next.min > next.max) {
        announce('Minimum length exceeds maximum length; no CDSs pass this range.');
      }
      cancelLiveFilters();
      state.filters = lengthFilters(next);
      renderAll();
    },
    // The slider's thumbs: every movement redraws, the release records.
    onRangeInput: (bounds) => applyFiltersLive(lengthFilters(bounds)),
    onRangeCommit: (bounds) => {
      cancelLiveFilters();
      state.filters = lengthFilters(bounds);
      renderAll();
    },
  });

  chromosomeView = new ChromosomeView(element('chromosome-view'), {
    onHover: (index) => {
      if (context.hoveredIndex === index) return;
      context.hoveredIndex = index;
      renderChromosomeView();
      renderDetail();
    },
    onPreview: (index) => {
      context.activeIndex = index;
      renderChromosomeView();
      renderDetail();
      announceActive(index);
    },
    onSelect: (index) => setPinned(togglePinTarget(index, pinnedIndex())),
    onShortlistToggle: (index) => toggleShortlist(index),
    onColorChange: (key) => {
      state.colorBy = key;
      // As on the map: the new metric opens on its own default scale.
      state.colorScale = null;
      syncSharedControls();
      renderCurrentView();
      persist();
    },
    onColorScaleChange: (scale) => {
      state.colorScale = scale;
      syncSharedControls();
      renderCurrentView();
      persist();
      announceColorScale();
    },
    onDrawDirectionChange: (direction) => setDrawDirection(direction),
    onShowHiddenChange: (value) => {
      state.showHidden = value;
      syncSharedControls();
      renderAll();
    },
    onDetailJump: () => jumpToDetail(),
    onAnnounce: announce,
  }, { organism });

  regulatorySitesPanel = new RegulatorySitesPanel(element('regulatory-view'), {
    organism,
    onShowGene: (id) => {
      const index = context.dataset.indexById.get(id);
      if (index === undefined) return;
      setPinned(index);
      jumpToMap();
      announce(`${id} pinned and shown on the map.`);
    },
  });

  sidePanel = new SidePanel(element('detail'), {
    onShortlistToggle: (index) => toggleShortlist(index),
    onUnpin: () => setPinned(-1),
  });

  shortlistPanel = new ShortlistPanel(element('shortlist'), {
    onRemove: (id) => {
      state.shortlist = state.shortlist.filter((entry) => entry !== id);
      renderAll();
    },
    onClear: () => {
      state.shortlist = [];
      renderAll();
      announce('Shortlist cleared.');
    },
    onSelect: (id) => {
      const index = context.dataset.indexById.get(id);
      if (index !== undefined) setPinned(index);
    },
    runActivity: async (label, operation) => {
      const key = `rna-folding:${++foldingActivityId}`;
      loadProgress.beginResource(key, { label, reportFailure: false });
      try {
        const result = await operation();
        loadProgress.settleResource(key, FILE_STATE.READY);
        return result;
      } catch (error) {
        // The folding panel owns its actionable explanation and retry control.
        loadProgress.settleResource(key, FILE_STATE.FAILED, error);
        throw error;
      }
    },
  });

  // A reading preference, restored once at boot. It is not part of the hash,
  // so a live hash change must not disturb it.
  compareAxes = normalizeCompareAxes(store.read(STORAGE_COMPARE_AXES, null));

  comparePanel = new ComparePanel(element('compare'), {
    onSelect: (id) => {
      const index = context.dataset.indexById.get(id);
      if (index !== undefined) setPinned(index);
    },
    onTabChange: (tab) => {
      state.compareTab = tab;
      persist();
    },
    // A chosen metric set is this browser's reading preference. A null set
    // means the comparison is back on its own defaults, and clears the stored
    // value rather than saving an empty one.
    onAxesChange: (keys) => {
      compareAxes = normalizeCompareAxes(keys);
      store.write(STORAGE_COMPARE_AXES, compareAxes);
    },
  });

  panelDesigner = new PanelDesigner(element('panel-designer'), {
    onSelect: (id) => {
      const index = context.dataset.indexById.get(id);
      if (index !== undefined) setPinned(index);
    },
    onAnnounce: announce,
    onShortlist: (ids) => {
      const added = ids.filter((id) => !state.shortlist.includes(id));
      state.shortlist = [...state.shortlist, ...added];
      renderAll();
      announce(`${formatCount(added.length)} gene${added.length === 1 ? '' : 's'} added to the `
        + `shortlist. ${formatCount(state.shortlist.length)} in total.`);
    },
  });

  citationsPanel = new CitationsPanel(element('citations-view'), {
    fetchDownload: async (download, requestId) => {
      const key = citationDownloadResourceKey(download, requestId);
      loadProgress.beginResource(key, { label: download.filename, reportFailure: false });
      try {
        const blob = await fetchCitationBlob(download);
        loadProgress.settleResource(key, FILE_STATE.READY);
        return blob;
      } catch (error) {
        loadProgress.settleResource(key, FILE_STATE.FAILED, error);
        throw error;
      }
    },
  });

  buildPanelTabs();
  updatePanelTabs();
  buildColorControls();
  buildAxisSelects();
  buildAxisScaleSelects();
  buildGeneSearch();
  renderMetricAgreement();
  renderProvenance();
  // The source-ledger fetch is optional; a slow response must not delay map boot.
  void citationsLoaded;

  // Reset view acts at once, by owner decision of 2026-10-05: a camera framing
  // is recovered by zooming again, so a question before it was noise. Every
  // other reset asks first, because each discards something the page cannot
  // give back: a shortlist, an arrangement, a set of chosen metrics.
  element('reset-view').addEventListener('click', () => {
    plot.resetFrameStats();
    plot.resetView();
    announce('Map view reset.');
  });
  confirmedReset(element('reset-selections'), {
    title: 'Reset selections?',
    body: 'This clears the pinned gene and every gene on the candidate shortlist. '
      + 'The shortlist cannot be recovered afterwards.',
    confirmLabel: 'Reset selections',
    action: () => {
      clearSelections(state);
      context.hoveredIndex = -1;
      context.activeIndex = -1;
      renderAll();
      element('reset-view').focus({ preventScroll: true });
      announce('Selections reset. The pinned gene and candidate shortlist were cleared.');
    },
  });
  confirmedReset(element('reset-panel-layout'), {
    title: 'Reset panel layout?',
    body: 'The controls column returns to its original order, with the gene visualizer '
      + 'collapsed and the other panels open.',
    confirmLabel: 'Reset layout',
    action: () => {
      resetPanelLayout(state);
      leftPanels.apply({ order: state.panelOrder, collapsed: state.panelCollapsed });
      renderDetail();
      persist();
      announce('Panel layout reset.');
    },
  });
  element('zoom-in').addEventListener('click', () => plot.zoomStep(1.4));
  element('zoom-out').addEventListener('click', () => plot.zoomStep(1 / 1.4));
  const showHidden = element('show-hidden');
  showHidden.checked = state.showHidden;
  showHidden.addEventListener('change', () => {
    state.showHidden = showHidden.checked;
    // A full render, not just `plot.setShowHidden`: the legend's hidden-dot
    // note must disappear along with the dots it describes, and only
    // `renderMap` (via `renderAll`) rebuilds the legend.
    renderAll();
  });
  const helpToggle = element('help-toggle');
  helpToggle.addEventListener('click', () => {
    const open = element('help').hidden;
    element('help').hidden = !open;
    helpToggle.setAttribute('aria-expanded', String(open));
    // Scroll the header, not the help section. The help section is taller than
    // the viewport, so bringing *it* into view pushed this button off the top
    // of the screen: the control that opened the panel disappeared, and the
    // one that closes it could not be found. Anchoring on the header keeps the
    // toggle visible with the panel opening below it.
    if (open) {
      document.querySelector('.site-header').scrollIntoView({ block: 'start' });
    }
  });

  window.addEventListener('hashchange', applyLiveHash);
  // Belt for the browsers/paths where a hash-only history navigation fires
  // `popstate` without also firing `hashchange`; `applyLiveHash` reads the
  // current hash either way, so a duplicate call is a harmless no-op render.
  window.addEventListener('popstate', applyLiveHash);

  renderAll();
  loadProgress.completePreparation('initial-view');
  booted = true;
  flushLandings();

  // The reveal waits for any file this view was opened onto, and then for the
  // bar to finish: it fills in uneven blocks over its minimum time and is held
  // full for a moment so it is seen. Neither ever delays a request. Files named
  // through a metric are known only now that the registry exists.
  const promotedByMetric = promotedMetricFileKeys(state, context.registry)
    .filter((key) => !promoted.includes(key));
  if (promotedByMetric.length > 0) {
    promoted.push(...promotedByMetric);
  }
  const ready = load.when(promoted);
  if (loadReview?.reveal === 'half') {
    // A measured halfway point is only an additional latch. Core, URL context,
    // promoted dependencies, and the prepared initial view remain mandatory.
    // An unknown or unreachable transfer threshold releases to readiness;
    // failure remains actionable after the page is revealed.
    await Promise.all([ready, loadProgress.whenTransferAtLeast(0.5)]);
  } else {
    await ready;
  }
  if (!loadReview) await loadProgress.ready();
  if (loadReview?.holdMs > 0 && !reducedMotion) {
    await new Promise((resolve) => setTimeout(resolve, loadReview.holdMs));
  }
  await cleanRevealFrame();
  revealPage();
  if (pendingMapJump) jumpToMap();
  announce(organismRecognised
    ? `${formatCount(dataset.genes.length)} genes loaded.`
    : `No organism is called ${requestedOrganismId}. Showing ${organism.label}: `
      + `${formatCount(dataset.genes.length)} genes loaded.`);
  load.settled.then(logLoadTimings);
}

// The page says which organism it is, and offers the other, before any data is
// asked for: the static document is the default organism's.
applyOrganismIdentity(document, organism);
renderOrganismSelector(element('organism-selector'), {
  current: organism, location: window.location, store, view: window,
});

// Install these handlers before boot reaches its first await so a click during
// the data fetch can be completed once the map is visible.
installMapJumps();
boot();
