/**
 * Application wiring.
 *
 * Holds the shared state, recomputes scheme-dependent metrics once per scheme
 * change, and keeps every panel looking at the same selection.
 */
import { loadDataset } from './core/dataset.js';
import { compileScheme, validateSchemeMap, verifyProteinsUnchanged, prefillReplacement } from './core/scheme.js';
import { computeLiveMetrics } from './core/live-metrics.js';
import { RECOMPUTATION_TOLERANCE } from './core/conventions.js';
import {
  buildMetricRegistry, rebindLiveMetrics, metricValues, describeExpressionSource,
  expressionBasisOf, expressionBasisCounts, isExpressionMetric, isExpressionProxyMetric,
} from './core/metric-registry.js';
import {
  encodeState, decodeState, defaultState, applyDecoded,
} from './core/url-state.js';
import { sortedFinite, percentileRank } from './core/stats.js';
import { PANELS, buildProjection } from './ui/panels.js';
import { renderLoadings } from './ui/loadings.js';
import { renderLegend } from './ui/legend.js';
import { buildColorScale } from './ui/colors.js';
import { ScatterPlot } from './ui/scatter.js';
import { SchemeEditor } from './ui/scheme-editor.js';
import { FilterPanel } from './ui/filters.js';
import { SidePanel } from './ui/side-panel.js';
import { ShortlistPanel } from './ui/shortlist.js';
import { GeneSearchResults } from './ui/gene-search-results.js';
import { ComparePanel } from './ui/compare.js';
import { PanelDesigner } from './ui/panel-designer.js';
import { formatCount } from './ui/format.js';

const STORAGE_SCHEMES = 'cyano.schemes.v1';
const STORAGE_SHORTLIST = 'cyano.shortlist.v1';

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
  hint.textContent = 'Check that the pipeline has written meta.json and genes.json into the '
    + 'folder this page reads, and that the server can serve them.';
  status.append(hint);
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
  return [];
}

function projectionFor(panelId) {
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

function renderMap() {
  const projection = projectionFor(state.panel);
  const panel = PANELS.find((entry) => entry.id === state.panel);
  element('panel-blurb').textContent = `${panel.blurb} ${panel.source}`;

  plot.setProjection(projection, { keepView: plot.projectionId === state.panel });
  plot.projectionId = state.panel;

  const metric = context.registry.byKey.get(state.colorBy) ?? context.registry.metrics[0];
  state.colorBy = metric.key;
  const values = metricValues(metric, context.dataset.genes.length);
  // The ramp family is whatever the metric declares; undeclared is inferred and
  // the legend says so. `direction` is never read.
  const scale = buildColorScale(values, { scale: metric.scale });
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
  if (projection.available) {
    let missing = 0;
    for (let i = 0; i < values.length; i += 1) if (!Number.isFinite(values[i])) missing += 1;
    renderLegend(legendHost, {
      metric,
      scale,
      missingCount: missing,
      hiddenCount: context.dataset.genes.length - context.passing,
      showHidden: state.showHidden,
      provenanceNote: describeExpressionSource(metric.provenance),
      basisCounts: isExpressionMetric(metric) && !isExpressionProxyMetric(metric)
        ? context.basisCounts : null,
    });
  }

  const loadingsHost = element('loadings-details');
  loadingsHost.hidden = !projection.available;
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
    ? `Filters are hiding ${formatCount(hidden)} of ${formatCount(context.dataset.genes.length)} genes.`
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
  computeMask();
  renderMap();
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
  });
  shortlistPanel.update({
    ids: state.shortlist,
    dataset: context.dataset,
    registry: context.registry,
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
  const gene = index >= 0 ? context.dataset.genes[index] : null;
  state.pinnedId = gene ? gene.id : null;
  context.hoveredIndex = -1;
  renderAll();
  if (gene) {
    announce(`Pinned ${gene.id}${gene.name ? ` ${gene.name}` : ''}. ${gene.product ?? ''}`);
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
  announce(`${gene.id}${gene.name ? ` ${gene.name}` : ''} active. `
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
  const buttons = PANELS.map((panel, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tab';
    button.textContent = panel.name;
    button.setAttribute('role', 'tab');
    button.id = `panel-tab-${panel.id}`;
    button.addEventListener('click', () => {
      state.panel = panel.id;
      updatePanelTabs();
      renderMap();
      persist();
      announce(`${panel.name}. ${panel.blurb}`);
    });
    button.addEventListener('keydown', (event) => {
      const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (offset === 0) return;
      event.preventDefault();
      const next = PANELS[(i + offset + PANELS.length) % PANELS.length];
      state.panel = next.id;
      updatePanelTabs();
      renderMap();
      persist();
      element(`panel-tab-${next.id}`).focus();
    });
    host.append(button);
    return button;
  });
  context.panelTabs = buttons;
}

function updatePanelTabs() {
  PANELS.forEach((panel, i) => {
    const selected = panel.id === state.panel;
    const button = context.panelTabs[i];
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    button.classList.toggle('active', selected);
  });
}

function buildColorSelect() {
  const select = element('color-by');
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
  select.value = state.colorBy;
  select.addEventListener('change', () => {
    state.colorBy = select.value;
    renderMap();
    persist();
  });
}

function buildGeneSearch() {
  // No datalist: it could only complete a locus tag prefix, it put 2,715 option
  // elements in the document, and its native dropdown covered the result list
  // that replaced it.
  searchResults = new GeneSearchResults(element('gene-search-results'), {
    onPin: (index) => setPinned(index),
    // toggleShortlist re-renders, and that refreshes this list's buttons.
    onShortlist: (index) => toggleShortlist(index),
    isShortlisted: (id) => state.shortlist.includes(id),
  });
  searchResults.setGenes(context.dataset.genes);

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
    add('Expression data', describeExpressionSource(provenance.expressionSource));
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
  if (!PANELS.some((panel) => panel.id === state.panel)) state.panel = 'native';
  if (!context.basisCounts.recorded) state.expressionFilter = 'any';

  const schemeErrors = recomputeScheme();
  if (schemeErrors.length > 0) {
    state.schemeMap = {};
    recomputeScheme();
  }
  if (!context.registry) {
    context.registry = buildMetricRegistry(context.dataset.meta, context.dataset.genes, context.live);
  }
  if (!state.colorBy || !context.registry.byKey.has(state.colorBy)) {
    state.colorBy = context.registry.byKey.has('gc3') ? 'gc3' : context.registry.metrics[0].key;
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
  element('show-hidden').checked = state.showHidden;
  renderAll();
  announce('View updated from the address bar.');
}

async function boot() {
  let dataset;
  try {
    dataset = await loadDataset({ baseUrl: resolveDataBase() });
  } catch (error) {
    showLoadError(error);
    return;
  }
  context.dataset = dataset;
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
    onSelect: (index) => setPinned(index),
    onPreview: (index) => previewActive(index),
    onEnterWithNothingActive: () => announce('Nothing is active yet. Use the arrow keys to move '
      + 'to a gene before pressing Enter to pin it.'),
    onShortlistToggle: (index) => toggleShortlist(index),
    onViewChange: scheduleTiming,
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
  });

  sidePanel = new SidePanel(element('detail'), {
    onShortlistToggle: (index) => toggleShortlist(index),
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

  buildPanelTabs();
  updatePanelTabs();
  buildColorSelect();
  buildGeneSearch();
  renderMetricAgreement();
  renderProvenance();

  element('reset-view').addEventListener('click', () => {
    plot.resetFrameStats();
    plot.resetView();
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
  announce(`${formatCount(dataset.genes.length)} genes loaded.`);
}

boot();
