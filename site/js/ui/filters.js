/**
 * Metric filters.
 *
 * Every filter is generated from the metric registry, so a metric added to
 * meta.json becomes filterable with no change here. Two rules from the data
 * contract shape the design: the low-traffic threshold defaults to a measure
 * derived from this genome rather than to borrowed expression data, and a gene
 * with no value for a metric is unknown rather than zero, so it is kept unless
 * the user says otherwise and the count is always visible.
 */
import {
  isExpressionMetric, isExpressionProxyMetric, metricValues,
  expressionSourceScope,
} from '../core/metric-registry.js';
import { formatCount, formatExpressionSource, formatValue } from './format.js';
import { sortedFinite, quantileSorted } from '../core/stats.js';

const HISTOGRAM_BINS = 44;

/** This genome's own codon-adaptation proxies, preferred over any borrowed measurement. */
const TRAFFIC_PREFERENCE = ['cai', 'tai'];

/**
 * Candidate axes for the low-traffic threshold, best first.
 *
 * A metric actually measured in this organism outranks a codon-adaptation
 * proxy derived from its genome, which in turn outranks any other expression
 * evidence (a borrowed measurement, or a percentile derived from one). The
 * ranking reads the registry's own `provenance.isTargetOrganism` flag rather
 * than a metric's name or key, so a future native measurement (gene-body
 * transcriptomics, say) is preferred with no change here; only its source
 * manifest needs to declare it.
 */
export function orderTrafficCandidates(registry) {
  const expression = registry.metrics.filter(isExpressionMetric);
  const native = expression.filter(
    (metric) => !isExpressionProxyMetric(metric) && metric.provenance?.isTargetOrganism === true,
  );
  const preferred = TRAFFIC_PREFERENCE
    .map((key) => registry.byKey.get(key))
    .filter(Boolean);
  const rest = expression.filter((metric) => !native.includes(metric));
  return [...native, ...preferred, ...rest];
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
    exceptionFilter: 'any',
    expressionFilter: 'any',
    trafficKey: null,
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
   *   onTrafficKeyChange: (key: string) => void}} handlers
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
      this.trafficHost, this.basisHost, this.exceptionHost, addRow, this.list, this.summary,
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

    const active = Object.keys(state.filters);
    const byFamily = new Map();
    for (const metric of state.registry.metrics) {
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
    this.renderBasisFilter(state);
    this.renderExceptionFilter(state);
    this.renderRows(state);

    const hidden = state.count - state.passing;
    this.summary.classList.toggle('hiding', hidden > 0);
    this.summary.textContent = hidden > 0
      ? `${formatCount(state.passing)} of ${formatCount(state.count)} genes pass. `
        + `${formatCount(hidden)} are hidden.`
      : `All ${formatCount(state.count)} genes pass. No filter is hiding anything.`;
    this.clearButton.disabled = active.length === 0 && state.exceptionFilter === 'any'
      && (state.expressionFilter ?? 'any') === 'any';
  }

  renderTraffic(state) {
    this.trafficHost.replaceChildren();
    const candidates = this.trafficCandidates();
    if (candidates.length === 0) {
      const note = document.createElement('p');
      note.className = 'panel-note';
      note.textContent = 'No metric in this dataset can stand in for gene activity, so the '
        + 'low-traffic threshold is unavailable.';
      this.trafficHost.append(note);
      return;
    }
    if (!this.trafficKey || !candidates.some((metric) => metric.key === this.trafficKey)) {
      this.trafficKey = candidates[0].key;
    }
    const metric = this.registry.byKey.get(this.trafficKey);

    const heading = document.createElement('h3');
    heading.className = 'traffic-heading';
    heading.textContent = 'Hide low-traffic genes';

    const chooser = document.createElement('div');
    chooser.className = 'field-row';
    const chooserLabel = document.createElement('label');
    chooserLabel.htmlFor = 'traffic-metric';
    chooserLabel.textContent = 'Judge activity by';
    const select = document.createElement('select');
    select.id = 'traffic-metric';
    for (const candidate of candidates) {
      const option = document.createElement('option');
      option.value = candidate.key;
      option.textContent = `${candidate.label} (${expressionSourceScope(candidate)})`;
      select.append(option);
    }
    select.value = this.trafficKey;
    select.addEventListener('change', () => {
      const filters = { ...state.filters };
      delete filters[this.trafficKey];
      this.trafficKey = select.value;
      this.handlers.onTrafficKeyChange(this.trafficKey, filters);
    });
    chooser.append(chooserLabel, select);
    this.trafficHost.append(heading, chooser);

    if (isExpressionMetric(metric) && !isExpressionProxyMetric(metric)) {
      const notice = document.createElement('p');
      notice.className = metric.provenance?.isTargetOrganism === false
        ? 'provenance-warning' : 'panel-note';
      notice.textContent = formatExpressionSource(metric.provenance)
        ?? 'This expression measurement carries no recorded provenance, so treat it with care.';
      this.trafficHost.append(notice);
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
    slider.addEventListener('input', () => describe(Number(slider.value)));
    slider.addEventListener('change', () => {
      const next = { ...state.filters };
      const existing = state.filters[this.trafficKey];
      next[this.trafficKey] = {
        min: Number(slider.value),
        max: existing?.max ?? finite[finite.length - 1] ?? null,
        includeMissing: existing?.includeMissing ?? true,
      };
      this.handlers.onChange(next);
    });

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

  renderRows(state) {
    this.list.replaceChildren();
    for (const key of Object.keys(state.filters)) {
      if (key === this.trafficKey) continue;
      const metric = state.registry.byKey.get(key);
      if (!metric) continue;
      const range = state.filters[key];
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
        row.append(notice);
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
        input.value = range[bound] === null ? '' : String(Number(range[bound].toPrecision(6)));
        input.addEventListener('change', () => {
          const next = { ...state.filters };
          const parsed = input.value === '' ? null : Number(input.value);
          next[key] = { ...range, [bound]: Number.isFinite(parsed) ? parsed : null };
          this.handlers.onChange(next);
        });
        wrapper.append(inputLabel, input);
        return wrapper;
      };
      inputs.append(makeInput('min'), makeInput('max'));
      row.append(canvas, inputs);

      const missing = state.count - finite.length;
      if (missing > 0) row.append(this.missingControl(state, key, missing, metric));

      this.list.append(row);
      drawHistogram(canvas, values, range.min, range.max);
    }
  }
}
