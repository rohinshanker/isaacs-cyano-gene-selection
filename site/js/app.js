/**
 * Application wiring.
 *
 * Holds the shared state, recomputes scheme-dependent metrics once per scheme
 * change, and keeps every panel looking at the same selection.
 */
import { loadDataset } from './core/dataset.js';
import { compileScheme, validateSchemeMap, verifyProteinsUnchanged, prefillReplacement } from './core/scheme.js';
import { computeLiveMetrics } from './core/live-metrics.js';
import {
  buildMetricRegistry, rebindLiveMetrics, metricValues, describeExpressionSource,
} from './core/metric-registry.js';
import { encodeState, decodeState } from './core/url-state.js';
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
import { ComparePanel } from './ui/compare.js';
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

const state = {
  panel: 'native',
  colorBy: null,
  schemeMap: {},
  schemeName: '',
  highExpressed: false,
  filters: {},
  shortlist: [],
  pinnedId: null,
  compareTab: 'radar',
  showHidden: true,
  exceptionFilter: 'any',
};

const context = {
  dataset: null,
  registry: null,
  live: null,
  scheme: null,
  verification: null,
  mask: null,
  passing: 0,
  hoveredIndex: -1,
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

function persist() {
  store.write(STORAGE_SHORTLIST, state.shortlist);
  const hash = encodeState(state);
  const target = `${window.location.pathname}${window.location.search}${hash ? `#${hash}` : ''}`;
  window.history.replaceState(null, '', target);
}

let plot = null;
let schemeEditor = null;
let filterPanel = null;
let sidePanel = null;
let shortlistPanel = null;
let comparePanel = null;
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
  const scale = buildColorScale(values, { diverging: metric.family === 'Change from wild type' });
  plot.setColor({ values, scale });
  plot.setMask(context.mask);
  plot.setShowHidden(state.showHidden);
  plot.setMarks({
    pinned: pinnedIndex(),
    hovered: context.hoveredIndex,
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
      provenanceNote: describeExpressionSource(metric.provenance),
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
        + `${formatCount(context.dataset.genes.length)} genes shown, coloured by ${metric.label}. `
        + 'Use the arrow keys to move between genes.'
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
  const index = context.hoveredIndex >= 0 ? context.hoveredIndex : pinnedIndex();
  sidePanel.update({
    index,
    isPinned: index >= 0 && index === pinnedIndex() && context.hoveredIndex < 0,
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
  });
  shortlistPanel.update({
    ids: state.shortlist,
    dataset: context.dataset,
    registry: context.registry,
  });
  comparePanel.update({
    ids: state.shortlist,
    dataset: context.dataset,
    registry: context.registry,
    tab: state.compareTab,
  });
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
  const list = element('gene-options');
  const fragment = document.createDocumentFragment();
  for (const gene of context.dataset.genes) {
    const option = document.createElement('option');
    option.value = gene.name ? `${gene.id} ${gene.name}` : gene.id;
    fragment.append(option);
  }
  list.replaceChildren(fragment);
  const input = element('gene-search');
  input.addEventListener('change', () => {
    const query = input.value.trim().split(/\s+/)[0];
    const index = context.dataset.indexById.get(query);
    if (index === undefined) {
      announce(`No gene matches ${input.value}.`);
      return;
    }
    setPinned(index);
    input.value = '';
  });
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
  const worst = provenance.agreement
    .filter((entry) => entry.compared > 0)
    .sort((a, b) => b.worst - a.worst)[0];
  add('Recomputation check', worst
    ? `Browser and pipeline agree to ${worst.worst.toExponential(1)} at worst, on ${worst.key}`
    : 'no comparable pipeline metrics');
  if (provenance.expressionSource) {
    add('Expression data', describeExpressionSource(provenance.expressionSource));
  }
  if (provenance.genesWithoutTerminalStop > 0) {
    add('Terminal stops', `${formatCount(provenance.genesWithoutTerminalStop)} genes carry no `
      + 'terminalStop field, so a stop-reassignment scheme cannot be costed for them');
  }
  if (provenance.taiReport.sDefaulted.length > 0) {
    add('tAI constraints', `${provenance.taiReport.sDefaulted.length} of 9 selective-constraint `
      + 'values were not supplied and use the published defaults');
  }
  host.append(list);
}

async function boot() {
  const saved = decodeState(window.location.hash);
  Object.assign(state, saved);
  if (!saved.shortlist) state.shortlist = store.read(STORAGE_SHORTLIST, []);

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

  // Drop any shortlisted gene that is not in this dataset, so a stale link degrades cleanly.
  state.shortlist = state.shortlist.filter((id) => dataset.indexById.has(id));
  if (state.pinnedId && !dataset.indexById.has(state.pinnedId)) state.pinnedId = null;
  if (!PANELS.some((panel) => panel.id === state.panel)) state.panel = 'native';

  const schemeErrors = recomputeScheme();
  if (schemeErrors.length > 0) {
    state.schemeMap = {};
    recomputeScheme();
  }
  context.registry = buildMetricRegistry(dataset.meta, dataset.genes, context.live);
  if (!state.colorBy || !context.registry.byKey.has(state.colorBy)) {
    state.colorBy = context.registry.byKey.has('gc3') ? 'gc3' : context.registry.metrics[0].key;
  }

  element('load-status').hidden = true;
  element('main').hidden = false;
  element('compare-section').hidden = false;
  element('site-footer').hidden = false;

  plot = new ScatterPlot(element('map-canvas'), {
    onHover: (index) => {
      if (index === context.hoveredIndex) return;
      context.hoveredIndex = index;
      plot.setMarks({ hovered: index });
      renderDetail();
    },
    onSelect: (index) => setPinned(index),
    onShortlistToggle: (index) => toggleShortlist(index),
    onViewChange: scheduleTiming,
  });

  schemeEditor = new SchemeEditor(element('scheme-editor'), dataset, {
    onChange: (map) => setScheme(map),
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

  buildPanelTabs();
  updatePanelTabs();
  buildColorSelect();
  buildGeneSearch();
  renderProvenance();

  element('reset-view').addEventListener('click', () => {
    plot.resetFrameStats();
    plot.resetView();
  });
  const showHidden = element('show-hidden');
  showHidden.checked = state.showHidden;
  showHidden.addEventListener('change', () => {
    state.showHidden = showHidden.checked;
    plot.setShowHidden(state.showHidden);
    persist();
  });
  const helpToggle = element('help-toggle');
  helpToggle.addEventListener('click', () => {
    const open = element('help').hidden;
    element('help').hidden = !open;
    helpToggle.setAttribute('aria-expanded', String(open));
    if (open) element('help').scrollIntoView({ block: 'nearest' });
  });

  renderAll();
  announce(`${formatCount(dataset.genes.length)} genes loaded.`);
}

boot();
