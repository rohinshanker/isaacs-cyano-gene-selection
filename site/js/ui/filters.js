/**
 * Metric filters.
 *
 * Every filter is generated from the metric registry, so a metric added to
 * meta.json becomes filterable with no change here. Two rules from the data
 * contract shape the design: the low-traffic threshold defaults to a native
 * measurement, then a proxy derived from this genome, never implicitly to
 * borrowed expression data; a gene with no value for a metric is unknown
 * rather than zero, so it is kept unless the user says otherwise, and the
 * count is always visible.
 */
import { pendingNote } from './loading-note.js';
import {
  isExpressionMetric, isExpressionProxyMetric, metricValues,
  expressionSourceScope, metricsInDisplayOrder,
} from '../core/metric-registry.js';
import { formatCount, formatExpressionSource, formatValue } from './format.js';
import { sortedFinite, quantileSorted } from '../core/stats.js';
import { RangeSlider, hasUsableSpread } from './range-slider.js';
import { DEFAULT_ORGANISM } from '../core/organisms.js';
import { tanDisclosure } from './disclosures.js';
import {
  OVERLAP_CLASSES, OVERLAP_FILTERS, OVERLAP_FILTER_LABELS, OVERLAP_TAG_EXPANSION,
  OVERLAP_TAG_LABEL, OVERLAP_UNAVAILABLE, overlapFilterOf,
} from '../core/gene-overlaps.js';

const HISTOGRAM_BINS = 44;

/** This genome's own codon-adaptation proxies: real measurement outranks both. */
const TRAFFIC_PROXY_PREFERENCE = ['cai', 'tai'];

/**
 * Candidate axes for the low-traffic threshold, best first.
 *
 * A metric actually measured in this organism leads. Next is any other real
 * measurement of transcript abundance, even one borrowed from another strain
 * (one sister strain's, for the default organism): a measurement outranks a proxy regardless of organism, as
 * long as its borrowed-strain caveat stays attached wherever it is shown. This
 * genome's own codon-adaptation proxies (CAI/tAI) come next, then any
 * remaining expression evidence (a proxy rank derived from one of the above).
 * The native/borrowed split reads the registry's own
 * `provenance.isTargetOrganism` flag rather than a metric's name or key, so a
 * future native measurement (gene-body transcriptomics, say) is preferred
 * with no change here; only its source manifest needs to declare it and pass
 * this project's replication bar.
 */
export function orderTrafficCandidates(registry) {
  const expression = registry.metrics.filter(isExpressionMetric);
  const native = expression.filter(
    (metric) => !isExpressionProxyMetric(metric) && metric.provenance?.isTargetOrganism === true,
  );
  const borrowedMeasured = expression.filter(
    (metric) => !isExpressionProxyMetric(metric) && metric.provenance?.isTargetOrganism === false
      && !native.includes(metric),
  );
  const proxies = TRAFFIC_PROXY_PREFERENCE
    .map((key) => registry.byKey.get(key))
    .filter(Boolean);
  const rest = expression.filter(
    (metric) => !native.includes(metric) && !borrowedMeasured.includes(metric)
      && !proxies.includes(metric),
  );
  return [...native, ...borrowedMeasured, ...proxies, ...rest];
}

/** A safe implicit choice is native evidence or a local proxy, never a borrowed assay. */
export function defaultTrafficCandidate(candidates) {
  const native = candidates.find(
    (metric) => isExpressionMetric(metric) && !isExpressionProxyMetric(metric)
      && metric.provenance?.isTargetOrganism === true,
  );
  if (native) return native;
  for (const key of TRAFFIC_PROXY_PREFERENCE) {
    const proxy = candidates.find((metric) => metric.key === key);
    if (proxy) return proxy;
  }
  return candidates.find(isExpressionProxyMetric) ?? null;
}

/** Follow a colour metric without retaining the previous activity threshold. */
export function followColourTrafficState({
  enabled, colorKey, trafficKey, filters,
}, candidates) {
  if (!enabled || !candidates.some((metric) => metric.key === colorKey)) {
    return { trafficKey, filters };
  }
  // A null key follows the same safe native/proxy default as the traffic panel.
  // Candidate order alone must not remove a separate, explicitly added filter.
  const previousKey = trafficKey ?? defaultTrafficCandidate(candidates)?.key ?? null;
  if (previousKey === colorKey) return { trafficKey, filters };
  const nextFilters = { ...filters };
  if (previousKey) delete nextFilters[previousKey];
  return { trafficKey: colorKey, filters: nextFilters };
}

/** Reader-facing copy for a registry metric without destroying scientific capitalization. */
export function trafficThresholdLabel(metric) {
  return `Hide genes below: ${metric.label}${metric.unit ? ` (${metric.unit})` : ''}`;
}

/** The threshold population is every finite value, which is not always a measurement. */
export function trafficThresholdReadout(metric, value, kept, total) {
  return `${formatValue(metric, value)} ${metric.unit} — keeps ${formatCount(kept)} of `
    + `${formatCount(total)} genes with a value`;
}

/** Every independent filter channel reset by the control labelled "Clear all filters". */
export function clearedFilterState() {
  return {
    filters: {},
    categoryFilter: [],
    exceptionFilter: 'any',
    expressionFilter: 'any',
    trafficKey: null,
    proteinFilter: 'any',
    overlapClassFilter: [],
  };
}

function drawHistogram(canvas, values, min, max) {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 200;
  const height = canvas.clientHeight || 34;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);

  const finite = sortedFinite(values);
  if (finite.length === 0) return;
  const low = finite[0];
  const high = finite[finite.length - 1];
  const span = high - low || 1;
  const bins = new Float64Array(HISTOGRAM_BINS);
  for (let i = 0; i < finite.length; i += 1) {
    const bin = Math.min(HISTOGRAM_BINS - 1, Math.floor(((finite[i] - low) / span) * HISTOGRAM_BINS));
    bins[bin] += 1;
  }
  let peak = 0;
  for (const value of bins) peak = Math.max(peak, value);
  const barWidth = width / HISTOGRAM_BINS;
  for (let i = 0; i < HISTOGRAM_BINS; i += 1) {
    const binLow = low + (i / HISTOGRAM_BINS) * span;
    const binHigh = low + ((i + 1) / HISTOGRAM_BINS) * span;
    const passes = binHigh >= (min ?? -Infinity) && binLow <= (max ?? Infinity);
    context.fillStyle = passes ? '#2f6f8f' : '#d8dde3';
    const barHeight = peak > 0 ? (bins[i] / peak) * (height - 3) : 0;
    context.fillRect(i * barWidth, height - barHeight, Math.max(1, barWidth - 0.6), barHeight);
  }
}

/** A filter range with both ends open and unmeasured genes kept. */
function openRange(finite) {
  return {
    min: finite.length ? finite[0] : null,
    max: finite.length ? finite[finite.length - 1] : null,
    includeMissing: true,
  };
}

export class FilterPanel {
  /**
   * @param {HTMLElement} host
   * @param {{onChange: (filters: object) => void,
   *   onClear: () => void,
   *   onExceptionFilterChange: (mode: string) => void,
   *   onExpressionFilterChange: (mode: string) => void,
   *   onTrafficKeyChange: (key: string) => void,
   *   onTrafficFollowChange?: (follow: boolean) => void,
   *   onSelectSource?: (dataType: string|null, current: string|null, opener: HTMLElement) => void}} handlers
   */
  constructor(host, handlers) {
    this.host = host;
    this.handlers = handlers;
    // Mirrors `state.trafficKey` between updates; `update()` resyncs it from
    // the passed-in state so a value round-tripped through the URL wins over
    // whatever this instance last picked on its own.
    this.trafficKey = null;
    this.build();
  }

  build() {
    this.host.replaceChildren();

    this.trafficHost = document.createElement('section');
    this.trafficHost.className = 'traffic-filter';

    this.exceptionHost = document.createElement('div');
    this.exceptionHost.className = 'exception-filter';

    this.basisHost = document.createElement('div');
    this.basisHost.className = 'basis-filter';
    this.overlapHost = document.createElement('div');
    this.overlapHost.className = 'overlap-filter';
    this.proteinHost = document.createElement('div');

    const addRow = document.createElement('div');
    addRow.className = 'field-row';
    const label = document.createElement('label');
    label.htmlFor = 'filter-add';
    label.textContent = 'Add filter';
    this.addSelect = document.createElement('select');
    this.addSelect.id = 'filter-add';
    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'chip-button';
    addButton.textContent = 'Add';
    addButton.addEventListener('click', () => this.addFilter());
    addRow.append(label, this.addSelect, addButton);

    this.list = document.createElement('div');
    this.list.className = 'filter-list';

    this.summary = document.createElement('p');
    this.summary.className = 'filter-summary';
    this.summary.setAttribute('role', 'status');

    this.clearButton = document.createElement('button');
    this.clearButton.type = 'button';
    this.clearButton.className = 'chip-button';
    this.clearButton.textContent = 'Clear all filters';
    this.clearButton.addEventListener('click', () => this.handlers.onClear());

    this.host.append(
      this.trafficHost, this.proteinHost, this.basisHost, this.exceptionHost, this.overlapHost,
      addRow, this.list, this.summary,
      this.clearButton,
    );
  }

  addFilter() {
    const key = this.addSelect.value;
    if (!key) return;
    const metric = this.registry.byKey.get(key);
    const values = metricValues(metric, this.count);
    const next = { ...this.filters };
    next[key] = openRange(sortedFinite(values));
    this.addSelect.value = '';
    this.handlers.onChange(next);
  }

  /** Metrics the low-traffic threshold can be applied to, in preference order. */
  trafficCandidates() {
    return orderTrafficCandidates(this.registry);
  }

  /**
   * @param {{registry: object, filters: object, count: number, passing: number,
   *   exceptionFilter: string, exceptionCount: number,
   *   missingHidden: Map<string, number>, expressionFilter: string,
   *   basisCounts: {counts: Map<string, number>, recorded: boolean}, trafficKey: string|null}} state
   */
  update(state) {
    this.registry = state.registry;
    this.filters = state.filters;
    this.count = state.count;
    // Always resynced, including an explicit `null`: app state just came
    // back from a hash that does not mention a traffic metric, which means
    // "back to the default candidate," not "keep whatever this widget
    // remembers from before." `renderTraffic` below picks the default
    // candidate whenever this is falsy.
    this.trafficKey = state.trafficKey;
    this.colorMetricKey = state.colorMetricKey ?? null;
    this.followColor = state.followColor !== false;

    const active = Object.keys(state.filters);
    const byFamily = new Map();
    // Grouped in the shared display order, so the "Add filter" list offers
    // measured evidence before the codon-usage conventions.
    for (const metric of metricsInDisplayOrder(state.registry)) {
      if (active.includes(metric.key)) continue;
      if (!byFamily.has(metric.family)) byFamily.set(metric.family, []);
      byFamily.get(metric.family).push(metric);
    }
    const selected = this.addSelect.value;
    this.addSelect.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Choose a metric…';
    this.addSelect.append(placeholder);
    for (const [family, metrics] of byFamily) {
      const group = document.createElement('optgroup');
      group.label = family;
      for (const metric of metrics) {
        const option = document.createElement('option');
        option.value = metric.key;
        option.textContent = metric.unit ? `${metric.label} (${metric.unit})` : metric.label;
        group.append(option);
      }
      this.addSelect.append(group);
    }
    if (selected && !active.includes(selected)) this.addSelect.value = selected;

    this.renderTraffic(state);
    this.renderProteinFilter(state);
    this.renderBasisFilter(state);
    this.renderExceptionFilter(state);
    this.renderOverlapFilter(state);
    this.renderRows(state);

    this.renderSummary(state.count, state.passing);
    this.clearButton.disabled = active.length === 0 && state.exceptionFilter === 'any'
      && (state.expressionFilter ?? 'any') === 'any'
      && (state.proteinFilter ?? 'any') === 'any'
      && (state.overlapClassFilter ?? []).length === 0
      && (state.categoryFilter ?? []).length === 0;
  }

  /** The passing count; also refreshed alone while a filter is being dragged. */
  renderSummary(count, passing) {
    const hidden = count - passing;
    this.summary.classList.toggle('hiding', hidden > 0);
    this.summary.textContent = hidden > 0
      ? `${formatCount(passing)} of ${formatCount(count)} genes pass. `
        + `${formatCount(hidden)} are hidden.`
      : `All ${formatCount(count)} genes pass. No filter is hiding anything.`;
  }

  renderProteinFilter(state) {
    this.proteinHost.replaceChildren();
    // The length inventory this filter reads has not landed, or could not be
    // loaded. An absent fieldset would read as a filter this dataset lacks.
    if (!state.proteinEvidence && state.proteinEvidencePending) {
      const waiting = document.createElement('fieldset');
      waiting.className = 'flag-filter';
      const heading = document.createElement('legend');
      heading.textContent = 'Protein evidence';
      waiting.append(heading, pendingNote(state.proteinEvidencePending, 'the protein evidence filter'));
      this.proteinHost.append(waiting);
      return;
    }
    if (!state.proteinEvidence) return;
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'flag-filter';
    const legend = document.createElement('legend');
    legend.textContent = 'Protein evidence';
    fieldset.append(legend);
    const options = [
      ['any', 'All screened CDSs', false],
      ['refseq', `RefSeq protein record (${formatCount(state.proteinEvidence.count)} loci)`, false],
      // The option's name is the organism's own: it names the proteomics it lacks.
      ['detected', state.proteinEvidence.directDetectionLabel
        ?? DEFAULT_ORGANISM.copy.directProteomicsLabel, true],
    ];
    for (const [value, text, disabled] of options) {
      const row = document.createElement('div');
      row.className = 'checkbox-row';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'protein-filter';
      input.id = `protein-filter-${value}`;
      input.value = value;
      input.disabled = disabled;
      input.checked = state.proteinFilter === value;
      input.addEventListener('change', () => this.handlers.onProteinFilterChange(value));
      const label = document.createElement('label');
      label.htmlFor = input.id;
      label.textContent = text;
      row.append(input, label);
      fieldset.append(row);
    }
    const reason = document.createElement('p');
    reason.className = 'panel-note';
    reason.textContent = `Unavailable: ${state.proteinEvidence.unavailableReason}`;
    fieldset.append(reason);
    this.proteinHost.append(fieldset);
  }

  /**
   * The range control the reader is holding or stepping, if any: a thumb with
   * focus or under the pointer inside this panel. While one is live, the host
   * it sits in is synced in place rather than rebuilt, so the gesture and the
   * focus survive every intermediate update.
   */
  liveControl() {
    const active = document.activeElement;
    if (!active || !this.host.contains(active)) return null;
    if (active.id === 'traffic-threshold') return { host: 'traffic', key: this.trafficKey };
    if (active.className?.includes?.('range-slider-thumb') && active.dataset?.filterKey) {
      return { host: 'row', key: active.dataset.filterKey };
    }
    return null;
  }

  renderTraffic(state) {
    // The live check reads the metric the slider stands for, so the default
    // candidate is resolved first: an update that arrives with no remembered
    // key must not leave the held slider writing its threshold under none.
    const candidates = this.trafficCandidates();
    if (candidates.length > 0
      && (!this.trafficKey || !candidates.some((metric) => metric.key === this.trafficKey))) {
      this.trafficKey = defaultTrafficCandidate(candidates)?.key ?? null;
    }
    const held = this.liveControl();
    if (held?.host === 'traffic' && this.trafficSync && held.key === this.trafficKey) {
      this.trafficSync(state);
      return;
    }
    this.trafficSync = null;
    this.trafficHost.replaceChildren();
    if (candidates.length === 0) {
      const note = document.createElement('p');
      note.className = 'panel-note';
      note.textContent = 'No metric in this dataset can stand in for gene activity, so the '
        + 'low-traffic threshold is unavailable.';
      this.trafficHost.append(note);
      return;
    }

    const heading = document.createElement('h3');
    heading.className = 'traffic-heading';
    heading.textContent = 'Hide low-traffic genes';

    // "Use same source as colouring": on, the threshold judges activity by the
    // metric colouring the map whenever that metric can stand in for activity;
    // off, the reader picks the source here, in the chooser below or through
    // the data selection peek (owner decision, 2026-10-05).
    const followRow = document.createElement('label');
    followRow.className = 'checkbox-row traffic-follow';
    const follow = document.createElement('input');
    follow.type = 'checkbox';
    follow.id = 'traffic-follow-colour';
    follow.checked = this.followColor;
    follow.addEventListener('change', () => this.handlers.onTrafficFollowChange?.(follow.checked));
    const followText = document.createElement('span');
    followText.textContent = 'Use same source as colouring';
    followRow.append(follow, followText);
    const colourCandidate = candidates.find((metric) => metric.key === this.colorMetricKey) ?? null;

    const chooser = document.createElement('div');
    chooser.className = 'field-row';
    const chooserLabel = document.createElement('label');
    chooserLabel.htmlFor = 'traffic-metric';
    chooserLabel.textContent = 'Judge activity by';
    const select = document.createElement('select');
    select.id = 'traffic-metric';
    select.disabled = this.followColor && Boolean(colourCandidate);
    if (!this.trafficKey) {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Choose a metric…';
      select.append(placeholder);
    }
    for (const candidate of candidates) {
      const option = document.createElement('option');
      option.value = candidate.key;
      option.textContent = `${candidate.label} (${expressionSourceScope(candidate)})`;
      select.append(option);
    }
    select.value = this.trafficKey ?? '';
    select.addEventListener('change', () => {
      const filters = { ...state.filters };
      if (this.trafficKey) delete filters[this.trafficKey];
      this.trafficKey = select.value;
      this.handlers.onTrafficKeyChange(this.trafficKey, filters);
    });
    chooser.append(chooserLabel, select);
    this.trafficHost.append(heading, followRow);
    if (this.followColor && !colourCandidate) {
      const note = document.createElement('p');
      note.className = 'panel-note';
      note.textContent = 'The colouring metric is not a measure of gene activity, so the threshold keeps its own source.';
      this.trafficHost.append(note);
    }
    this.trafficHost.append(chooser);
    if (!(this.followColor && colourCandidate) && this.handlers.onSelectSource) {
      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'chip-button traffic-select-source';
      pick.textContent = 'Select source';
      pick.addEventListener('click', () => {
        const metric = this.registry.byKey.get(this.trafficKey);
        this.handlers.onSelectSource(metric?.provenance?.record?.dataType ?? null, this.trafficKey, pick);
      });
      chooser.append(pick);
    }

    if (!this.trafficKey) {
      const note = document.createElement('p');
      note.className = 'panel-note';
      note.textContent = 'Only measurements from another organism are available. '
        + 'Choose one explicitly to use it as a rough guide.';
      this.trafficHost.append(note);
      return;
    }
    const metric = this.registry.byKey.get(this.trafficKey);

    if (isExpressionMetric(metric) && !isExpressionProxyMetric(metric)) {
      const notice = document.createElement('p');
      notice.className = metric.provenance?.isTargetOrganism === false
        ? 'provenance-warning' : 'panel-note';
      notice.textContent = formatExpressionSource(metric.provenance)
        ?? 'This expression measurement carries no recorded provenance, so treat it with care.';
      this.trafficHost.append(metric.provenance?.isTargetOrganism === false
        ? tanDisclosure(notice, 'Source / information') : notice);
    } else if (isExpressionProxyMetric(metric)) {
      const notice = document.createElement('p');
      notice.className = 'panel-note';
      notice.textContent = 'A rank derived from codon adaptation in this genome, not a '
        + 'measurement. It is in a different unit from any abundance value.';
      this.trafficHost.append(notice);
    }

    const values = metricValues(metric, state.count);
    const finite = sortedFinite(values);
    const range = state.filters[this.trafficKey];
    const current = range?.min ?? finite[0] ?? 0;

    const sliderLabel = document.createElement('label');
    sliderLabel.className = 'traffic-label';
    sliderLabel.htmlFor = 'traffic-threshold';
    sliderLabel.textContent = trafficThresholdLabel(metric);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = 'traffic-threshold';
    slider.min = String(finite[0] ?? 0);
    slider.max = String(finite[finite.length - 1] ?? 1);
    slider.step = String(Math.max(1e-6, ((finite[finite.length - 1] ?? 1) - (finite[0] ?? 0)) / 400));
    slider.value = String(current);

    const readout = document.createElement('output');
    readout.htmlFor = 'traffic-threshold';
    readout.className = 'traffic-readout';
    const describe = (value) => {
      const index = finite.findIndex((entry) => entry >= value);
      const kept = index < 0 ? 0 : finite.length - index;
      readout.textContent = trafficThresholdReadout(metric, value, kept, finite.length);
    };
    describe(Number(slider.value));
    const thresholdFilters = () => {
      const next = { ...this.filters };
      const existing = this.filters[this.trafficKey];
      next[this.trafficKey] = {
        min: Number(slider.value),
        max: existing?.max ?? finite[finite.length - 1] ?? null,
        includeMissing: existing?.includeMissing ?? true,
      };
      return next;
    };
    // Every movement updates the picture; the release records the state.
    slider.addEventListener('input', () => {
      describe(Number(slider.value));
      this.handlers.onLiveChange?.(thresholdFilters());
    });
    slider.addEventListener('change', () => this.handlers.onChange(thresholdFilters()));
    // While the slider is held, an update only refreshes its readout.
    this.trafficSync = () => describe(Number(slider.value));

    const quartile = document.createElement('p');
    quartile.className = 'panel-note';
    quartile.textContent = `Median ${formatValue(metric, quantileSorted(finite, 0.5))}; `
      + `the lowest quarter of genes with a value sit below `
      + `${formatValue(metric, quantileSorted(finite, 0.25))}.`;

    this.trafficHost.append(sliderLabel, slider, readout, quartile);

    const missing = state.count - finite.length;
    if (missing > 0) {
      this.trafficHost.append(this.missingControl(state, this.trafficKey, missing, metric));
    }
  }

  /** The explicit include-or-drop control for genes with no measurement. */
  missingControl(state, key, missing, metric) {
    const wrapper = document.createElement('div');
    wrapper.className = 'checkbox-row missing-control';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = `include-missing-${key}`;
    input.checked = state.filters[key]?.includeMissing ?? true;
    input.addEventListener('change', () => {
      const next = { ...state.filters };
      const values = metricValues(metric, state.count);
      const existing = state.filters[key] ?? openRange(sortedFinite(values));
      next[key] = { ...existing, includeMissing: input.checked };
      this.handlers.onChange(next);
    });
    const label = document.createElement('label');
    label.htmlFor = input.id;
    const hiddenNow = state.missingHidden.get(key) ?? 0;
    label.textContent = `Include the ${formatCount(missing)} genes with no `
      + `${metric.label.toLowerCase()} measurement`
      + (input.checked ? '' : ` — currently hiding ${formatCount(hiddenNow)}`);
    wrapper.append(input, label);
    return wrapper;
  }

  /**
   * The measured-only control. Shown only when the dataset records an expression
   * basis at all; with no basis recorded there is nothing truthful to filter on.
   */
  renderBasisFilter(state) {
    this.basisHost.replaceChildren();
    const basisCounts = state.basisCounts;
    if (!basisCounts?.recorded) return;
    const measured = basisCounts.counts.get('measured');
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'flag-filter';
    const legend = document.createElement('legend');
    legend.textContent = 'Expression basis';
    fieldset.append(legend);
    const note = document.createElement('p');
    note.className = 'panel-note';
    const proxy = basisCounts.counts.get('proxy');
    const none = basisCounts.counts.get('none');
    note.textContent = `${formatCount(measured)} of ${formatCount(state.count)} genes carry a `
      + `measured expression value; ${formatCount(proxy)} have only the codon-adaptation proxy`
      + `${none > 0 ? ` and ${formatCount(none)} have neither` : ''}. A proxy rank is never shown `
      + 'as a measurement.';
    fieldset.append(note);
    const row = document.createElement('div');
    row.className = 'checkbox-row';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = 'expression-measured-only';
    input.checked = state.expressionFilter === 'measured';
    input.addEventListener('change', () => {
      this.handlers.onExpressionFilterChange(input.checked ? 'measured' : 'any');
    });
    const label = document.createElement('label');
    label.htmlFor = input.id;
    label.textContent = 'Only genes with a measured expression value';
    row.append(input, label);
    fieldset.append(row);
    this.basisHost.append(fieldset);
  }

  renderExceptionFilter(state) {
    this.exceptionHost.replaceChildren();
    if (state.exceptionCount === 0) return;
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'flag-filter';
    const legend = document.createElement('legend');
    legend.textContent = 'Translational exceptions';
    fieldset.append(legend);
    const note = document.createElement('p');
    note.className = 'panel-note';
    note.textContent = `${formatCount(state.exceptionCount)} `
      + `${state.exceptionCount === 1 ? 'gene needs' : 'genes need'} a programmed frameshift or `
      + 'a similar event to translate. Those are high-risk recoding targets.';
    fieldset.append(note);
    const options = [
      ['any', 'Show all genes'],
      ['only', 'Only genes with an exception'],
      ['none', 'Hide genes with an exception'],
    ];
    for (const [value, text] of options) {
      const row = document.createElement('div');
      row.className = 'checkbox-row';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'exception-filter';
      input.id = `exception-${value}`;
      input.value = value;
      input.checked = state.exceptionFilter === value;
      input.addEventListener('change', () => this.handlers.onExceptionFilterChange(value));
      const label = document.createElement('label');
      label.htmlFor = input.id;
      label.textContent = text;
      row.append(input, label);
      fieldset.append(row);
    }
    this.exceptionHost.append(fieldset);
  }

  /**
   * The overlapping-gene filter: all genes, only the overlapping ones, or only
   * the ones that overlap nothing.
   *
   * Built whatever the counts are, including zero, because the three states are
   * about what the reader wants to see and not about this organism. While the
   * overlap layer has not landed the fieldset says so and the options are
   * disabled: filtering on an unread layer would turn a file in flight into a
   * claim about which genes overlap. The counts quoted are of the whole plotted
   * set, not of what the other filters leave, so they do not move as the reader
   * narrows something else.
   */
  renderOverlapFilter(state) {
    this.overlapHost.replaceChildren();
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'flag-filter';
    const legend = document.createElement('legend');
    legend.textContent = `Overlapping genes (${OVERLAP_TAG_LABEL})`;
    fieldset.append(legend);
    const note = document.createElement('p');
    note.className = 'panel-note';
    const counts = state.overlapCounts ?? null;
    note.textContent = counts
      ? `${OVERLAP_TAG_LABEL} marks ${OVERLAP_TAG_EXPANSION}: a gene that shares at least one `
        + 'genomic base with another annotated gene on its replicon, on either strand. '
        + `${formatCount(counts.overlapping)} of ${formatCount(state.count)} plotted genes carry `
        + `the tag and ${formatCount(counts.nonOverlapping)} share no base with one. Every `
        + 'annotated gene is compared, tRNA, rRNA and pseudogene rows included, so a partner is '
        + 'not always a gene this map plots.'
      : OVERLAP_UNAVAILABLE.note;
    fieldset.append(note);
    const selection = state.overlapClassFilter ?? [];
    const chosen = overlapFilterOf(selection);
    for (const value of OVERLAP_FILTERS) {
      const row = document.createElement('div');
      row.className = 'checkbox-row';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'overlap-filter';
      input.id = `overlap-filter-${value}`;
      input.value = value;
      input.disabled = !counts && value !== 'any';
      input.checked = chosen === value;
      input.addEventListener('change', () => this.handlers.onOverlapFilterChange?.(value));
      const label = document.createElement('label');
      label.htmlFor = input.id;
      label.textContent = counts && value !== 'any'
        ? `${OVERLAP_FILTER_LABELS[value]} (${formatCount(
          value === 'only' ? counts.overlapping : counts.nonOverlapping)})`
        : OVERLAP_FILTER_LABELS[value];
      row.append(input, label);
      fieldset.append(row);
    }
    // A selection made from the colour key that none of the three options can
    // express. None of them is shown as chosen, and the classes being kept are
    // named here, so the panel never claims a state the map is not in.
    if (!counts && selection.length > 0) {
      const pending = document.createElement('p');
      pending.className = 'panel-note';
      pending.setAttribute('role', 'status');
      pending.textContent = `The saved ${OVERLAP_TAG_LABEL} filter is paused while overlap `
        + 'context is unavailable. It is not applied to the displayed genes and will apply '
        + 'when the layer is ready. Choose Show all genes to clear it.';
      fieldset.append(pending);
    } else if (chosen === null) {
      const labels = OVERLAP_CLASSES
        .filter((entry) => selection.includes(entry.id))
        .map((entry) => entry.label)
        .join('; ');
      const custom = document.createElement('p');
      custom.className = 'panel-note';
      custom.setAttribute('role', 'status');
      custom.textContent = `A class selection from the ${OVERLAP_TAG_LABEL} colour key is in `
        + `force, which none of these three options describes: ${labels}. Choose one of them, or `
        + 'clear the selection in the colour key, to leave it.';
      fieldset.append(custom);
    }
    this.overlapHost.append(fieldset);
  }

  renderRows(state) {
    const live = this.liveControl();
    const kept = live?.host === 'row' ? this.rowSyncs?.get(live.key) : null;
    const syncs = new Map();
    const rows = [];
    for (const key of Object.keys(state.filters)) {
      if (key === this.trafficKey) continue;
      const metric = state.registry.byKey.get(key);
      if (!metric) continue;
      const range = state.filters[key];
      if (kept && key === live.key) {
        // The row the reader is dragging keeps its element; only its readouts move.
        kept.sync(range);
        syncs.set(key, kept);
        rows.push(kept.row);
        continue;
      }
      const values = metricValues(metric, state.count);
      const finite = sortedFinite(values);

      const row = document.createElement('div');
      row.className = 'filter-row';

      const heading = document.createElement('div');
      heading.className = 'filter-heading';
      const title = document.createElement('span');
      title.className = 'filter-title';
      title.textContent = metric.label;
      const unit = document.createElement('span');
      unit.className = 'filter-unit';
      unit.textContent = metric.unit;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'icon-button';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove the ${metric.label} filter`);
      remove.addEventListener('click', () => {
        const next = { ...state.filters };
        delete next[key];
        this.handlers.onChange(next);
      });
      heading.append(title, unit, remove);
      row.append(heading);

      if (metric.provenance) {
        const notice = document.createElement('p');
        notice.className = metric.provenance.isTargetOrganism === false
          ? 'provenance-warning' : 'panel-note';
        notice.textContent = formatExpressionSource(metric.provenance);
        row.append(metric.provenance.isTargetOrganism === false
          ? tanDisclosure(notice, 'Source / information') : notice);
      }

      const canvas = document.createElement('canvas');
      canvas.className = 'filter-histogram';
      canvas.setAttribute('role', 'img');
      canvas.setAttribute(
        'aria-label',
        `Distribution of ${metric.label}. Filter keeps ${formatValue(metric, range.min)} `
          + `to ${formatValue(metric, range.max)}.`,
      );

      const inputs = document.createElement('div');
      inputs.className = 'filter-inputs';
      const step = finite.length > 1
        ? Math.max(1e-6, (finite[finite.length - 1] - finite[0]) / 500)
        : 1;
      const fieldText = (value) => (value === null ? '' : String(Number(value.toPrecision(6))));
      const fields = {};
      const makeInput = (bound) => {
        const wrapper = document.createElement('span');
        wrapper.className = 'filter-input';
        const inputLabel = document.createElement('label');
        inputLabel.htmlFor = `filter-${key}-${bound}`;
        inputLabel.textContent = bound === 'min' ? 'At least' : 'At most';
        const input = document.createElement('input');
        input.type = 'number';
        input.id = `filter-${key}-${bound}`;
        input.step = metric.integer ? '1' : String(step);
        input.value = fieldText(range[bound]);
        input.addEventListener('change', () => {
          const next = { ...this.filters };
          const parsed = input.value === '' ? null : Number(input.value);
          next[key] = { ...this.filters[key], [bound]: Number.isFinite(parsed) ? parsed : null };
          this.handlers.onChange(next);
        });
        fields[bound] = input;
        wrapper.append(inputLabel, input);
        return wrapper;
      };
      inputs.append(makeInput('min'), makeInput('max'));

      // The draggable range over the same bounds as the fields. Every movement
      // redraws the map and the histogram's kept band; the release records it.
      // The fields stay for an exact value, and a blank field is still no bound.
      let slider = null;
      const lo = finite[0]; const hi = finite[finite.length - 1];
      const describe = (next) => {
        canvas.setAttribute('aria-label',
          `Distribution of ${metric.label}. Filter keeps ${formatValue(metric, next.min)} `
            + `to ${formatValue(metric, next.max)}.`);
        drawHistogram(canvas, values, next.min, next.max);
      };
      const withBounds = (bounds) => ({ ...this.filters[key], min: bounds.min, max: bounds.max });
      if (hasUsableSpread(lo, hi)) {
        slider = new RangeSlider({
          lo, hi, integer: Boolean(metric.integer), idPrefix: `filter-${key}`,
          label: metric.label, format: (value) => formatValue(metric, value),
          onInput: (bounds) => {
            fields.min.value = fieldText(bounds.min);
            fields.max.value = fieldText(bounds.max);
            describe(bounds);
            this.handlers.onLiveChange?.({ ...this.filters, [key]: withBounds(bounds) });
          },
          onCommit: (bounds) => this.handlers.onChange({ ...this.filters, [key]: withBounds(bounds) }),
        });
        for (const thumb of Object.values(slider.thumbs)) thumb.dataset.filterKey = key;
        slider.setRange(range);
        row.append(canvas, slider.element, inputs);
      } else {
        row.append(canvas, inputs);
      }

      const missing = state.count - finite.length;
      if (missing > 0) row.append(this.missingControl(state, key, missing, metric));

      rows.push(row);
      syncs.set(key, {
        row,
        sync: (next) => {
          slider?.setRange(next);
          fields.min.value = fieldText(next.min);
          fields.max.value = fieldText(next.max);
          describe(next);
        },
      });
      drawHistogram(canvas, values, range.min, range.max);
    }
    this.rowSyncs = syncs;
    this.list.replaceChildren(...rows);
  }
}
