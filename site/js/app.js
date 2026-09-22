/**
 * Application wiring.
 *
 * Holds the shared state, recomputes scheme-dependent metrics once per scheme
 * change, and keeps every panel looking at the same selection.
 */
import { loadDataset } from './core/dataset.js';
import { geneIdentity, geneMapLabel } from './core/gene-identity.js';
import { compileScheme, validateSchemeMap, verifyProteinsUnchanged, prefillReplacement } from './core/scheme.js';
import { computeLiveMetrics } from './core/live-metrics.js';
import { RECOMPUTATION_TOLERANCE } from './core/conventions.js';
import {
  buildMetricRegistry, rebindLiveMetrics, metricValues,
  expressionBasisOf, expressionBasisCounts, isExpressionMetric, isExpressionProxyMetric,
} from './core/metric-registry.js';
import {
  encodeState, decodeState, defaultState, applyDecoded, clearSelections,
} from './core/url-state.js';
import { sortedFinite, percentileRank } from './core/stats.js';
import { PANELS, buildProjection } from './ui/panels.js';
import { CITATIONS_TAB, loadCitationsManifest, CitationsPanel } from './ui/citations.js';
import { LENGTH_TAB, LengthExplorer } from './ui/length-explorer.js';
import { REGULATORY_TAB, RegulatorySitesPanel } from './ui/regulatory-sites.js';
import { metricHelp } from './core/metric-help.js';
import { FUNCTION_COLOR_KEY } from './core/function-categories.js';
import { buildMetricAxesProjection, DEFAULT_METRIC_AXES } from './core/metric-axes.js';
import { projectionHelp } from './core/projection-help.js';
import { renderMetricHelp, renderProjectionHelp } from './ui/metric-help.js';
import { renderLoadings } from './ui/loadings.js';
import { renderLegend, renderCategoryLegend } from './ui/legend.js';
import { buildColorScale, buildCategoryColorScale } from './ui/colors.js';
import { ScatterPlot, togglePinTarget } from './ui/scatter.js';
import { SchemeEditor } from './ui/scheme-editor.js';
import { FilterPanel, clearedFilterState } from './ui/filters.js';
import { SidePanel } from './ui/side-panel.js';
import { ShortlistPanel } from './ui/shortlist.js';
import { GeneSearchResults } from './ui/gene-search-results.js';
import { WorkspaceResizer } from './ui/workspace-resize.js';
import { ComparePanel } from './ui/compare.js';
import { PanelDesigner } from './ui/panel-designer.js';
import { formatCount, formatExpressionSource } from './ui/format.js';

const STORAGE_SCHEMES = 'cyano.schemes.v1';
const STORAGE_SHORTLIST = 'cyano.shortlist.v1';

/** The shared tablist: map panels, then length, regulatory, and source views. */
const ALL_TABS = [...PANELS, LENGTH_TAB, REGULATORY_TAB, CITATIONS_TAB];

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

const state = defaultState();
let pendingMapJump = false;

const context = {
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
  timings: { scheme: NaN, projection: NaN, codons: 0 },
};

function announce(message) {
  element('announcer').textContent = message;
}

/** Where the data files live: `data/` beside the page unless `?data=` says otherwise. */
function resolveDataBase() {
  const override = new URL(window.location.href).searchParams.get('data');
  return override ? (override.endsWith('/') ? override : `${override}/`) : 'data/';
}

function showLoadError(error) {
  const status = element('load-status');
  status.classList.add('error');
  status.replaceChildren();
  const heading = document.createElement('strong');
  heading.textContent = 'The gene data could not be loaded. ';
  const detail = document.createElement('span');
  detail.textContent = error.message;
  status.append(heading, detail);
  const hint = document.createElement('p');
  hint.textContent = 'Check that the pipeline wrote meta.json, genes.json, and the declared '
    + 'annotation and TSS evidence files into this page’s data folder, and that the server '
    + 'can serve them.';
  status.append(hint);
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
  if (!PANELS.some((panel) => panel.id === state.panel)) {
    state.panel = 'native';
    updatePanelTabs();
    renderCurrentView();
    persist();
  }
  element('map-section').scrollIntoView({ block: 'start' });
  // The canvas is `[hidden]` while the citations tab is showing; focusing a
  // hidden element is a no-op in every browser, but skip it explicitly so
  // this stays correct if that ever changes.
  if (!element('map-view').hidden) element('map-canvas').focus({ preventScroll: true });
}

function installMapJumps() {
  for (const control of document.querySelectorAll('.map-jump')) {
    control.addEventListener('click', (event) => {
      event.preventDefault();
      jumpToMap();
    });
  }
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

function computeMask() {
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
  if (state.proteinFilter === 'refseq') {
    for (let i = 0; i < count; i += 1) {
      if (mask[i] && !context.proteinRecordIds.has(dataset.genes[i].id)) mask[i] = 0;
    }
  }

  let passing = 0;
  for (let i = 0; i < count; i += 1) passing += mask[i];
  context.mask = mask;
  context.passing = passing;
  context.missingHidden = missingHidden;
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
  const cached = context.projections.get(panelId);
  if (cached) return cached;
  if (panelId === 'axes') {
    const axes = buildMetricAxesProjection(context.registry, context.dataset.genes.length, {
      x: state.axisX, y: state.axisY,
    });
    const label = (axis) => axis.unit ? `${axis.label} (${axis.unit})` : axis.label;
    const projection = {
      available: axes.available && axes.finitePairCount > 0,
      message: axes.available
        ? 'No genes have values on both selected axes. Choose another pair of metrics.'
        : 'A selected metric is unavailable in this dataset. Choose another axis.',
      x: axes.x.values,
      y: axes.y.values,
      independentAxes: true,
      xLabel: label(axes.x),
      yLabel: label(axes.y),
      labels: context.dataset.genes.map(geneMapLabel),
      loadings: [],
      loadingNote: 'These are direct metric axes, not PCA components. There are no loadings.',
      finitePairCount: axes.finitePairCount,
    };
    context.projections.set(panelId, projection);
    context.timings.projection = NaN;
    return projection;
  }
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
  const hash = encodeState(state);
  const target = `${window.location.pathname}${window.location.search}${hash ? `#${hash}` : ''}`;
  applyingHash = true;
  window.history.replaceState(null, '', target);
  applyingHash = false;
}

let plot = null;
let schemeEditor = null;
let filterPanel = null;
let sidePanel = null;
let shortlistPanel = null;
let searchResults = null;
let comparePanel = null;
let panelDesigner = null;
let citationsPanel = null;
let lengthExplorer = null;
let regulatorySitesPanel = null;
let workspaceResizer = null;
// `undefined` while the manifest fetch is in flight, `null` once it resolves
// to nothing usable, otherwise the sanitized `{sections: [...]}` document.
let citationsManifest;
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

function renderColorHelp() {
  const categories = context.dataset.functionCategories;
  if (state.colorBy === FUNCTION_COLOR_KEY && categories) {
    renderMetricHelp(element('colour-help'), {
      title: 'Reviewed function category',
      summary: 'A broad cyanobacterial function assigned to an exact UTEX 2973 locus '
        + 'after lab review. The same colour has the same category on every map tab.',
      unit: 'category (not a numeric metric)',
      method: `The lab approved ${formatCount(categories.reviewedCount)} exact locus decisions `
        + `on ${categories.source.provenance.userReview.date}. A gene with `
        + 'two or more reviewed categories uses the multiple-functions bucket. '
        + 'GO IEA suggestions never assign a category colour by themselves.',
      origin: `UTEX 2973 RefSeq ${categories.source.provenance.annotationRelease} `
        + 'product records and the lab review table.',
      coverage: `${formatCount(categories.reviewedCount)} reviewed rows; `
        + `${formatCount(categories.unknownCount)} genes are unknown or unclassified, `
        + `including ${formatCount(categories.explicitUnknownCount)} reviewed as unknown.`,
      citations: ['ncbi-utex-2973'],
    }, citationsManifest);
    return;
  }
  renderMetricHelp(element('colour-help'),
    metricHelp(context.registry.byKey.get(state.colorBy), context.dataset), citationsManifest);
}

function renderMap() {
  const projection = projectionFor(state.panel);
  const panel = PANELS.find((entry) => entry.id === state.panel);
  element('panel-blurb').textContent = `${panel.blurb} ${panel.source}`;
  element('axis-chooser').hidden = state.panel !== 'axes';
  if (state.panel === 'axes') {
    element('axis-x').value = state.axisX;
    element('axis-y').value = state.axisY;
    element('axis-note').textContent = state.axisX === state.axisY
      ? `${formatCount(projection.finitePairCount)} genes have this metric. Identical axes place points on a diagonal.`
      : `${formatCount(projection.finitePairCount)} genes have values on both axes; missing pairs are not plotted.`;
  }

  plot.setProjection(projection, { keepView: plot.projectionId === state.panel });
  plot.projectionId = state.panel;

  const categorical = state.colorBy === FUNCTION_COLOR_KEY
    && Boolean(context.dataset.functionCategories);
  const metric = categorical ? { label: 'Reviewed function category' }
    : context.registry.byKey.get(state.colorBy) ?? context.registry.metrics[0];
  if (!categorical) state.colorBy = metric.key;
  renderColorHelp();
  renderProjectionHelp(element('features-used'),
    projectionHelp(state.panel, context.dataset, context.registry,
      { x: state.axisX, y: state.axisY }), citationsManifest);
  const values = categorical ? context.dataset.functionCategories.values
    : metricValues(metric, context.dataset.genes.length);
  // The ramp family is whatever the metric declares; undeclared is inferred and
  // the legend says so. `direction` is never read.
  const scale = categorical
    ? buildCategoryColorScale(context.dataset.functionCategories.labels.length)
    : buildColorScale(values, { scale: metric.scale });
  plot.setColor({ values, scale });
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
  if (projection.available) {
    if (categorical) {
      renderCategoryLegend(legendHost, {
        ...context.dataset.functionCategories,
        scale,
        hiddenCount: context.dataset.genes.length - context.passing,
        showHidden: state.showHidden,
      });
    } else {
      let missing = 0;
      for (let i = 0; i < values.length; i += 1) if (!Number.isFinite(values[i])) missing += 1;
      // Scoped to the metric on screen: a TSS legend counts TSS coverage, not the
      // primary PCC abundance field's, even though both share the same basis states.
      const isMeasuredExpressionMetric = isExpressionMetric(metric) && !isExpressionProxyMetric(metric);
      renderLegend(legendHost, {
        metric,
        scale,
        missingCount: missing,
        hiddenCount: context.dataset.genes.length - context.passing,
        showHidden: state.showHidden,
        provenanceNote: formatExpressionSource(metric.provenance),
        basisCounts: isMeasuredExpressionMetric
          ? expressionBasisCounts(context.dataset.genes, metric) : null,
      });
    }
  }

  const loadingsHost = element('loadings-details');
  loadingsHost.hidden = !projection.available;
  loadingsHost.querySelector('summary').textContent = state.panel === 'axes'
    ? 'About these axes' : 'What drives these axes';
  if (projection.available) renderLoadings(element('loadings'), projection);

  const canvas = element('map-canvas');
  canvas.setAttribute(
    'aria-label',
    projection.available
      ? `${panel.name}: ${formatCount(context.passing)} of `
        + `${formatCount(context.dataset.genes.length)} genes shown, coloured by ${metric.label}.`
      : `${panel.name}: ${projection.message}`,
  );

  const hidden = context.dataset.genes.length - context.passing;
  const banner = element('filter-banner');
  banner.classList.toggle('active', hidden > 0);
  banner.textContent = hidden > 0
    ? state.showHidden
      ? `Filters exclude ${formatCount(hidden)} of ${formatCount(context.dataset.genes.length)} genes from the active set; grey outlined squares remain on the map.`
      : `Filters hide ${formatCount(hidden)} of ${formatCount(context.dataset.genes.length)} genes.`
    : '';
  scheduleTiming();
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
    registry: context.registry,
    percentileOf,
    schemeActive: context.scheme.active,
    live: context.live,
    inShortlist: index >= 0 && state.shortlist.includes(context.dataset.genes[index].id),
  });
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
  filterPanel.update({
    registry: context.registry,
    filters: state.filters,
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
    } : null,
  });
  shortlistPanel.update({
    ids: state.shortlist,
    pinnedId: state.pinnedId,
    dataset: context.dataset,
    registry: context.registry,
    filterState: {
      ranges: state.filters,
      proteinEvidence: state.proteinFilter,
      expression: state.expressionFilter,
      translationalException: state.exceptionFilter,
    },
    filterMask: context.mask,
    viewState: () => ({
      panel: state.panel,
      colorBy: state.colorBy,
      axisX: state.axisX,
      axisY: state.axisY,
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
  comparePanel.update({
    ids: state.shortlist,
    dataset: context.dataset,
    registry: context.registry,
    tab: state.compareTab,
  });
  if (panelDesigner) {
    panelDesigner.update({
      dataset: context.dataset,
      registry: context.registry,
      shortlist: state.shortlist,
      pinnedId: state.pinnedId,
      schemes: {
        active: { name: state.schemeName, map: state.schemeMap },
        saved: Object.entries(store.read(STORAGE_SCHEMES, {}))
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, map]) => ({ name, map })),
      },
    });
  }
  persist();
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
function previewActive(index) {
  context.activeIndex = index;
  plot.setMarks({ active: index });
  renderDetail();
  if (index < 0) return;
  const gene = context.dataset.genes[index];
  announce(`${geneMapLabel(gene)} active. `
    + 'Press Enter to pin, S to add or remove it from the shortlist.');
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
      announce(`${panel.name}. ${panel.blurb}`);
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
 * Switch between the map view and the citations ledger, hiding whichever one
 * is not on screen. The tablist, the URL, and localStorage persistence are
 * shared across both, so a link to a map panel or to the citations tab round-
 * trips through the same `state.panel` field either way.
 */
function renderCurrentView() {
  const citationsActive = state.panel === CITATIONS_TAB.id;
  const lengthsActive = state.panel === LENGTH_TAB.id;
  const regulatoryActive = state.panel === REGULATORY_TAB.id;
  element('features-used').hidden = citationsActive || lengthsActive || regulatoryActive;
  element('main').classList.toggle('citations-active', citationsActive);
  element('main').classList.toggle('lengths-active', lengthsActive);
  element('main').classList.toggle('regulatory-active', regulatoryActive);
  workspaceResizer?.update();
  element('map-view').hidden = citationsActive || lengthsActive || regulatoryActive;
  element('length-view').hidden = !lengthsActive;
  element('regulatory-view').hidden = !regulatoryActive;
  element('citations-view').hidden = !citationsActive;
  if (citationsActive) {
    element('panel-blurb').textContent = CITATIONS_TAB.blurb;
    citationsPanel.render(citationsManifest);
    return;
  }
  if (lengthsActive) {
    element('panel-blurb').textContent = LENGTH_TAB.blurb;
    lengthExplorer.update({
      inventory: context.dataset.lengthCohorts,
      cohortId: state.lengthCohort,
      range: state.filters.lengthNt,
      mapPassing: context.passing,
      mapCount: context.dataset.genes.length,
    });
    return;
  }
  if (regulatoryActive) {
    element('panel-blurb').textContent = REGULATORY_TAB.blurb;
    regulatorySitesPanel.update(context.dataset.regulatoryTss);
    return;
  }
  renderMap();
}

function buildColorSelect() {
  const select = element('color-by');
  select.replaceChildren();
  if (context.dataset.functionCategories) {
    const group = document.createElement('optgroup');
    group.label = 'Reviewed function';
    const option = document.createElement('option');
    option.value = FUNCTION_COLOR_KEY;
    option.textContent = 'Function category';
    group.append(option);
    select.append(group);
  }
  for (const family of context.registry.families) {
    const group = document.createElement('optgroup');
    group.label = family;
    for (const metric of context.registry.metrics.filter((entry) => entry.family === family)) {
      const option = document.createElement('option');
      option.value = metric.key;
      option.textContent = metric.unit ? `${metric.label} (${metric.unit})` : metric.label;
      group.append(option);
    }
    select.append(group);
  }
  select.value = state.colorBy;
  select.addEventListener('change', () => {
    state.colorBy = select.value;
    renderMap();
    persist();
  });
}

function buildAxisSelects() {
  for (const [axis, key] of [['x', 'axisX'], ['y', 'axisY']]) {
    const select = element(`axis-${axis}`);
    select.replaceChildren();
    for (const family of context.registry.families) {
      const group = document.createElement('optgroup');
      group.label = family;
      for (const metric of context.registry.metrics.filter((entry) => entry.family === family)) {
        const option = document.createElement('option');
        option.value = metric.key;
        option.textContent = metric.unit ? `${metric.label} (${metric.unit})` : metric.label;
        group.append(option);
      }
      select.append(group);
    }
    select.value = state[key];
    select.addEventListener('change', () => {
      state[key] = select.value;
      context.projections.delete('axes');
      plot.projectionId = null;
      renderMap();
      persist();
      announce(`Metric plot: ${element('axis-x').selectedOptions[0].textContent} on X, `
        + `${element('axis-y').selectedOptions[0].textContent} on Y.`);
    });
  }
}

function buildGeneSearch() {
  // No datalist: it could only complete a locus tag prefix, it put 2,715 option
  // elements in the document, and its native dropdown covered the result list
  // that replaced it.
  searchResults = new GeneSearchResults(element('gene-search-results'), {
    onPin: (index) => setPinned(togglePinTarget(index, pinnedIndex())),
    // toggleShortlist re-renders, and that refreshes this list's buttons.
    onShortlist: (index) => toggleShortlist(index),
    isShortlisted: (id) => state.shortlist.includes(id),
    isPinned: (id) => state.pinnedId === id,
  });
  searchResults.setGenes(context.dataset.genes, context.dataset.goTerms?.terms);

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
  add('Excluded CDS', formatCount(provenance.excludedCount));
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

  if (provenance.expressionSource) {
    add('Expression data', formatExpressionSource(provenance.expressionSource));
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
  applyDecoded(state, decoded);
  // The shortlist is the one field with a second, local source of truth: a
  // hash that never mentions it (a bare initial load, or a partial/legacy
  // link) defers to what this browser last saved, not to the empty default
  // and not to whatever was on screen a moment ago.
  if (!('shortlist' in decoded)) state.shortlist = store.read(STORAGE_SHORTLIST, []);

  // Drop any shortlisted or pinned gene that is not in this dataset, so a stale link degrades cleanly.
  state.shortlist = state.shortlist.filter((id) => context.dataset.indexById.has(id));
  if (state.pinnedId && !context.dataset.indexById.has(state.pinnedId)) state.pinnedId = null;
  if (!ALL_TABS.some((panel) => panel.id === state.panel)) state.panel = 'native';
  if (!context.dataset.lengthCohorts) state.proteinFilter = 'any';
  if (!context.basisCounts.recorded) state.expressionFilter = 'any';

  const schemeErrors = recomputeScheme();
  if (schemeErrors.length > 0) {
    state.schemeMap = {};
    recomputeScheme();
  }
  if (!context.registry) {
    context.registry = buildMetricRegistry(context.dataset.meta, context.dataset.genes, context.live);
  }
  if (!state.colorBy || !(context.registry.byKey.has(state.colorBy)
    || (state.colorBy === FUNCTION_COLOR_KEY && context.dataset.functionCategories))) {
    state.colorBy = context.registry.byKey.has('gc3') ? 'gc3' : context.registry.metrics[0].key;
  }
  if (!context.registry.byKey.has(state.axisX)) {
    state.axisX = context.registry.byKey.has(DEFAULT_METRIC_AXES.x)
      ? DEFAULT_METRIC_AXES.x : context.registry.metrics[0].key;
  }
  if (!context.registry.byKey.has(state.axisY)) {
    state.axisY = context.registry.byKey.has(DEFAULT_METRIC_AXES.y)
      ? DEFAULT_METRIC_AXES.y : context.registry.metrics[0].key;
  }
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
  const decoded = decodeState(window.location.hash);
  normalizeAndApply(decoded);
  context.hoveredIndex = -1;
  context.activeIndex = -1;
  // Forces renderMap's own `setProjection` call to treat this as a fresh
  // panel and reset pan/zoom, since a pasted link should show what it
  // encodes at a known scale rather than whatever view the old panel was
  // left at.
  plot.projectionId = null;
  updatePanelTabs();
  element('color-by').value = state.colorBy;
  element('axis-x').value = state.axisX;
  element('axis-y').value = state.axisY;
  element('show-hidden').checked = state.showHidden;
  renderAll();
  announce('View updated from the address bar.');
}

async function boot() {
  // Started before the (required) gene dataset fetch so both requests are in
  // flight together; a missing or broken manifest must never hold up the map.
  const citationsLoaded = loadCitationsManifest({ baseUrl: resolveDataBase() })
    .then((manifest) => {
      citationsManifest = manifest;
      if (citationsPanel && state.panel === CITATIONS_TAB.id) citationsPanel.render(manifest);
      if (context.dataset && PANELS.some((panel) => panel.id === state.panel)) {
        renderColorHelp();
        renderProjectionHelp(element('features-used'),
          projectionHelp(state.panel, context.dataset, context.registry,
            { x: state.axisX, y: state.axisY }), manifest);
      }
    })
    .catch(() => {
      citationsManifest = null;
      if (citationsPanel && state.panel === CITATIONS_TAB.id) citationsPanel.render(null);
    });

  let dataset;
  try {
    dataset = await loadDataset({ baseUrl: resolveDataBase() });
  } catch (error) {
    showLoadError(error);
    return;
  }
  context.dataset = dataset;
  context.proteinRecordIds = new Set((dataset.lengthCohorts?.records ?? [])
    .filter((record) => record.refseqProteinRecord).map((record) => record.id));
  context.exceptionCount = dataset.genes
    .filter((gene) => Boolean(gene.translationalException)).length;
  context.basisCounts = expressionBasisCounts(dataset.genes);

  normalizeAndApply(decodeState(window.location.hash));

  element('load-status').hidden = true;
  element('main').hidden = false;
  element('compare-section').hidden = false;
  element('panel-section').hidden = false;
  element('site-footer').hidden = false;

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
  });

  element('detail-jump').addEventListener('click', () => {
    const detail = element('detail');
    detail.scrollIntoView({ block: 'start' });
    detail.focus({ preventScroll: true });
  });

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
      state.filters = filters;
      renderAll();
    },
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
      renderAll();
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
      if (next.min === null && next.max === null) delete state.filters.lengthNt;
      else state.filters.lengthNt = next;
      renderAll();
    },
  });

  regulatorySitesPanel = new RegulatorySitesPanel(element('regulatory-view'), {
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
  });

  comparePanel = new ComparePanel(element('compare'), {
    onSelect: (id) => {
      const index = context.dataset.indexById.get(id);
      if (index !== undefined) setPinned(index);
    },
    onTabChange: (tab) => {
      state.compareTab = tab;
      persist();
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

  citationsPanel = new CitationsPanel(element('citations-view'));

  buildPanelTabs();
  updatePanelTabs();
  buildColorSelect();
  buildAxisSelects();
  buildGeneSearch();
  renderMetricAgreement();
  renderProvenance();
  // The source-ledger fetch is optional; a slow response must not delay map boot.
  void citationsLoaded;

  element('reset-view').addEventListener('click', () => {
    plot.resetFrameStats();
    plot.resetView();
  });
  element('reset-selections').addEventListener('click', () => {
    clearSelections(state);
    context.hoveredIndex = -1;
    context.activeIndex = -1;
    renderAll();
    element('reset-view').focus({ preventScroll: true });
    announce('Selections reset. The pinned gene and candidate shortlist were cleared.');
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
    if (open) element('help').scrollIntoView({ block: 'nearest' });
  });

  window.addEventListener('hashchange', applyLiveHash);
  // Belt for the browsers/paths where a hash-only history navigation fires
  // `popstate` without also firing `hashchange`; `applyLiveHash` reads the
  // current hash either way, so a duplicate call is a harmless no-op render.
  window.addEventListener('popstate', applyLiveHash);

  renderAll();
  if (pendingMapJump) jumpToMap();
  announce(`${formatCount(dataset.genes.length)} genes loaded.`);
}

// Install these handlers before boot reaches its first await so a click during
// the data fetch can be completed once the map is visible.
installMapJumps();
boot();
