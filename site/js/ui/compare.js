/**
 * Candidate comparison: three views over one shared sortable table.
 *
 * Radar and parallel coordinates both need a comparable scale, so both use a
 * robust z-score against the genome median. Series are told apart by colour,
 * line pattern, and a named legend together, never by colour alone.
 */
import { CATEGORICAL, divergingColor } from './colors.js';
import { formatValue, formatDelta, formatCount, MISSING } from './format.js';
import { metricValues } from '../core/metric-registry.js';
import { sortedFinite, medianSorted, quantileSorted } from '../core/stats.js';

const TABS = [
  { id: 'radar', label: 'Radar' },
  { id: 'parallel', label: 'Parallel coordinates' },
  { id: 'delta', label: 'Pairwise delta' },
];

/** Metrics the comparison views prefer when the user has not chosen. */
const DEFAULT_AXES = [
  'gc3', 'enc', 'cai', 'tai', 'rareFraction', 'cps', 'mfeStart', 'targetFraction',
];

const DASHES = [[], [7, 4], [2, 3], [10, 3, 2, 3], [5, 3, 1, 3], [1, 3], [12, 4], [4, 2, 8, 2]];

/** Median and scaled median absolute deviation, a spread that outliers cannot inflate. */
function robustScale(values) {
  const sorted = sortedFinite(values);
  if (sorted.length === 0) return { median: NaN, spread: NaN };
  const median = medianSorted(sorted);
  const deviations = sortedFinite(Float64Array.from(sorted, (value) => Math.abs(value - median)));
  const mad = medianSorted(deviations) * 1.4826;
  const spread = mad > 1e-12
    ? mad
    : (quantileSorted(sorted, 0.75) - quantileSorted(sorted, 0.25)) || 1;
  return { median, spread };
}

function fitCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 600;
  const height = canvas.clientHeight || 320;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  return { context, width, height };
}

export class ComparePanel {
  /**
   * @param {HTMLElement} host
   * @param {{onSelect: (id: string) => void, onTabChange: (tab: string) => void}} handlers
   */
  constructor(host, handlers) {
    this.host = host;
    this.handlers = handlers;
    this.tab = 'radar';
    this.axisKeys = null;
    this.brushes = new Map();
    this.sort = { key: 'id', direction: 1 };
    this.deltaPair = [null, null];
    this.build();
    this.resizeObserver = new ResizeObserver(() => this.drawActive());
    this.resizeObserver.observe(this.chartHost);
  }

  build() {
    this.host.replaceChildren();

    this.tablist = document.createElement('div');
    this.tablist.className = 'tablist';
    this.tablist.setAttribute('role', 'tablist');
    this.tablist.setAttribute('aria-label', 'Candidate comparison view');
    this.tabButtons = TABS.map((tab, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tab';
      button.id = `compare-tab-${tab.id}`;
      button.textContent = tab.label;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', 'compare-panel');
      button.addEventListener('click', () => this.setTab(tab.id));
      button.addEventListener('keydown', (event) => {
        const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (offset === 0) return;
        event.preventDefault();
        const next = TABS[(i + offset + TABS.length) % TABS.length];
        this.setTab(next.id);
        this.tabButtons[TABS.indexOf(next)].focus();
      });
      this.tablist.append(button);
      return button;
    });

    this.axisPicker = document.createElement('details');
    this.axisPicker.className = 'axis-picker';
    const summary = document.createElement('summary');
    summary.textContent = 'Choose metrics to compare';
    this.axisOptions = document.createElement('div');
    this.axisOptions.className = 'axis-options';
    this.axisPicker.append(summary, this.axisOptions);

    this.panel = document.createElement('div');
    this.panel.id = 'compare-panel';
    this.panel.setAttribute('role', 'tabpanel');
    this.panel.className = 'compare-panel';

    this.chartHost = document.createElement('div');
    this.chartHost.className = 'chart-host';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'compare-canvas';
    this.canvas.setAttribute('role', 'img');
    this.chartHost.append(this.canvas);

    this.legend = document.createElement('ul');
    this.legend.className = 'series-legend';

    this.note = document.createElement('p');
    this.note.className = 'panel-note';

    this.deltaControls = document.createElement('div');
    this.deltaControls.className = 'delta-controls';

    this.deltaTableHost = document.createElement('div');
    this.deltaTableHost.className = 'table-scroll';

    this.panel.append(this.deltaControls, this.chartHost, this.legend, this.note, this.deltaTableHost);

    this.tableHeading = document.createElement('h3');
    this.tableHeading.className = 'table-heading';
    this.tableHeading.textContent = 'Shortlisted genes';
    this.tableHost = document.createElement('div');
    this.tableHost.className = 'table-scroll';

    this.host.append(this.tablist, this.axisPicker, this.panel, this.tableHeading, this.tableHost);

    this.canvas.addEventListener('pointerdown', (event) => this.onBrushStart(event));
    this.canvas.addEventListener('pointermove', (event) => this.onBrushMove(event));
    this.canvas.addEventListener('pointerup', (event) => this.onBrushEnd(event));
  }

  setTab(tab) {
    this.tab = tab;
    this.handlers.onTabChange?.(tab);
    this.render();
  }

  /** Metrics currently on the radar and parallel axes. */
  activeAxes() {
    const available = this.registry.metrics.filter((metric) => metric.key !== 'lengthNt');
    if (this.axisKeys) {
      const chosen = this.axisKeys
        .map((key) => this.registry.byKey.get(key))
        .filter(Boolean);
      if (chosen.length >= 3) return chosen;
    }
    const defaults = DEFAULT_AXES
      .map((key) => this.registry.byKey.get(key))
      .filter(Boolean);
    return defaults.length >= 3 ? defaults : available.slice(0, 8);
  }

  /**
   * @param {{ids: string[], dataset: object, registry: object, tab?: string}} state
   */
  update(state) {
    this.state = state;
    this.registry = state.registry;
    if (state.tab && state.tab !== this.tab) this.tab = state.tab;
    this.scales = new Map();
    this.render();
  }

  scaleFor(metric) {
    if (!this.scales.has(metric.key)) {
      const values = metricValues(metric, this.state.dataset.genes.length);
      this.scales.set(metric.key, { ...robustScale(values), values });
    }
    return this.scales.get(metric.key);
  }

  zScore(metric, index) {
    const { median, spread } = this.scaleFor(metric);
    const value = metric.read(index);
    if (!Number.isFinite(value) || !Number.isFinite(median) || !Number.isFinite(spread)) return NaN;
    return Math.max(-3, Math.min(3, (value - median) / spread));
  }

  render() {
    TABS.forEach((tab, i) => {
      const selected = tab.id === this.tab;
      this.tabButtons[i].setAttribute('aria-selected', String(selected));
      this.tabButtons[i].tabIndex = selected ? 0 : -1;
      this.tabButtons[i].classList.toggle('active', selected);
    });
    this.panel.setAttribute('aria-labelledby', `compare-tab-${this.tab}`);

    const isDelta = this.tab === 'delta';
    this.axisPicker.hidden = isDelta;
    this.chartHost.hidden = isDelta;
    this.legend.hidden = isDelta;
    this.deltaControls.hidden = !isDelta;
    this.deltaTableHost.hidden = !isDelta;

    this.renderAxisPicker();
    this.renderTable();
    if (isDelta) this.renderDelta();
    else this.drawActive();
  }

  renderAxisPicker() {
    const active = new Set(this.activeAxes().map((metric) => metric.key));
    this.axisOptions.replaceChildren();
    for (const family of this.registry.families) {
      const group = document.createElement('fieldset');
      group.className = 'axis-group';
      const legend = document.createElement('legend');
      legend.textContent = family;
      group.append(legend);
      for (const metric of this.registry.metrics.filter((entry) => entry.family === family)) {
        const label = document.createElement('label');
        label.className = 'axis-option';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = active.has(metric.key);
        input.addEventListener('change', () => {
          const next = new Set(this.activeAxes().map((entry) => entry.key));
          if (input.checked) next.add(metric.key);
          else next.delete(metric.key);
          this.axisKeys = this.registry.metrics
            .filter((entry) => next.has(entry.key))
            .map((entry) => entry.key);
          this.brushes.clear();
          this.render();
        });
        label.append(input, document.createTextNode(` ${metric.label}`));
        group.append(label);
      }
      this.axisOptions.append(group);
    }
  }

  seriesFor() {
    const { ids, dataset } = this.state;
    return ids
      .map((id, order) => ({ id, index: dataset.indexById.get(id), order }))
      .filter((entry) => entry.index !== undefined)
      .map((entry) => ({
        ...entry,
        gene: dataset.genes[entry.index],
        color: CATEGORICAL[entry.order % CATEGORICAL.length],
        dash: DASHES[entry.order % DASHES.length],
      }));
  }

  drawActive() {
    if (!this.state) return;
    if (this.tab === 'radar') this.drawRadar();
    else if (this.tab === 'parallel') this.drawParallel();
  }

  emptyChart(context, width, height, message) {
    context.fillStyle = '#4a5568';
    context.font = '14px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(message, width / 2, height / 2);
    this.legend.replaceChildren();
  }

  renderLegend(series, extra = []) {
    this.legend.replaceChildren();
    for (const entry of series) {
      const item = document.createElement('li');
      const swatch = document.createElement('canvas');
      swatch.width = 34;
      swatch.height = 12;
      swatch.className = 'legend-swatch';
      const context = swatch.getContext('2d');
      context.strokeStyle = entry.color;
      context.lineWidth = 2.5;
      context.setLineDash(entry.dash);
      context.beginPath();
      context.moveTo(1, 6);
      context.lineTo(33, 6);
      context.stroke();
      const label = document.createElement('span');
      label.textContent = entry.gene.name ? `${entry.id} ${entry.gene.name}` : entry.id;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip-link';
      button.append(swatch, label);
      button.addEventListener('click', () => this.handlers.onSelect(entry.id));
      item.append(button);
      if (extra.includes(entry.id)) item.classList.add('dimmed');
      this.legend.append(item);
    }
  }

  drawRadar() {
    const { context, width, height } = fitCanvas(this.canvas);
    const series = this.seriesFor();
    const axes = this.activeAxes();
    this.canvas.setAttribute(
      'aria-label',
      `Radar chart of ${series.length} shortlisted genes across ${axes.length} metrics, `
        + 'z-scored against the genome median. The same numbers are in the table below.',
    );
    this.note.textContent = 'Each spoke is one metric, scaled so the genome median sits on the '
      + 'middle ring. Further out means higher than typical, further in means lower.';
    if (series.length === 0) {
      this.emptyChart(context, width, height, 'Shortlist a gene to compare it here.');
      return;
    }
    const cx = width / 2;
    const cy = height / 2 + 6;
    const radius = Math.max(40, Math.min(width, height) / 2 - 58);

    context.strokeStyle = '#e3e8ee';
    context.lineWidth = 1;
    for (let ring = 1; ring <= 3; ring += 1) {
      context.beginPath();
      context.arc(cx, cy, (radius * ring) / 3, 0, Math.PI * 2);
      context.stroke();
    }
    context.fillStyle = '#4a5568';
    context.font = '11px system-ui, sans-serif';
    axes.forEach((metric, i) => {
      const angle = (i / axes.length) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      context.strokeStyle = '#e3e8ee';
      context.beginPath();
      context.moveTo(cx, cy);
      context.lineTo(x, y);
      context.stroke();
      const labelX = cx + Math.cos(angle) * (radius + 14);
      const labelY = cy + Math.sin(angle) * (radius + 14);
      context.textAlign = Math.abs(Math.cos(angle)) < 0.3
        ? 'center' : Math.cos(angle) > 0 ? 'left' : 'right';
      context.textBaseline = Math.abs(Math.cos(angle)) < 0.3
        ? (Math.sin(angle) > 0 ? 'top' : 'bottom') : 'middle';
      context.fillText(metric.label, labelX, labelY);
    });

    for (const entry of series) {
      context.strokeStyle = entry.color;
      context.lineWidth = 2.2;
      context.setLineDash(entry.dash);
      context.beginPath();
      axes.forEach((metric, i) => {
        const angle = (i / axes.length) * Math.PI * 2 - Math.PI / 2;
        const z = this.zScore(metric, entry.index);
        const r = Number.isFinite(z) ? radius * ((z + 3) / 6) : radius / 2;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.closePath();
      context.stroke();
      context.setLineDash([]);
      axes.forEach((metric, i) => {
        const angle = (i / axes.length) * Math.PI * 2 - Math.PI / 2;
        const z = this.zScore(metric, entry.index);
        if (!Number.isFinite(z)) return;
        const r = radius * ((z + 3) / 6);
        context.fillStyle = entry.color;
        context.beginPath();
        context.arc(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 2.6, 0, Math.PI * 2);
        context.fill();
      });
    }
    this.renderLegend(series);
  }

  parallelGeometry(width, height, axisCount) {
    const left = 62;
    const right = width - 62;
    const top = 26;
    const bottom = height - 54;
    const step = axisCount > 1 ? (right - left) / (axisCount - 1) : 0;
    return { left, right, top, bottom, step };
  }

  drawParallel() {
    const { context, width, height } = fitCanvas(this.canvas);
    const series = this.seriesFor();
    const axes = this.activeAxes();
    this.canvas.setAttribute(
      'aria-label',
      `Parallel coordinates of ${series.length} shortlisted genes across ${axes.length} metrics. `
        + 'The same numbers are in the table below.',
    );
    if (series.length === 0) {
      this.emptyChart(context, width, height, 'Shortlist a gene to compare it here.');
      this.note.textContent = 'Each line is one candidate crossing every metric axis.';
      return;
    }
    const geometry = this.parallelGeometry(width, height, axes.length);
    this.geometry = geometry;
    this.axesCache = axes;

    context.font = '11px system-ui, sans-serif';
    axes.forEach((metric, i) => {
      const x = geometry.left + geometry.step * i;
      context.strokeStyle = '#c8d0d8';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x, geometry.top);
      context.lineTo(x, geometry.bottom);
      context.stroke();
      const brush = this.brushes.get(metric.key);
      if (brush) {
        context.fillStyle = 'rgba(47, 111, 143, 0.18)';
        context.fillRect(x - 7, Math.min(brush.a, brush.b), 14, Math.abs(brush.b - brush.a));
        context.strokeStyle = '#2f6f8f';
        context.strokeRect(x - 7, Math.min(brush.a, brush.b), 14, Math.abs(brush.b - brush.a));
      }
      // The end axes sit against the edges, so their labels align inward.
      context.textAlign = i === 0 ? 'left' : i === axes.length - 1 ? 'right' : 'center';
      const anchor = i === 0 ? x - 8 : i === axes.length - 1 ? x + 8 : x;
      context.textBaseline = 'top';
      context.fillStyle = '#4a5568';
      context.fillText('+3', anchor, geometry.top - 15);
      context.fillText('−3', anchor, geometry.bottom + 6);
      context.fillStyle = '#1b2733';
      const label = metric.label.length > 18 ? `${metric.label.slice(0, 17)}…` : metric.label;
      context.fillText(label, anchor, geometry.bottom + 22);
    });

    const brushed = this.brushedIds(axes, geometry);
    for (const entry of series) {
      const dim = brushed !== null && !brushed.has(entry.id);
      context.globalAlpha = dim ? 0.18 : 1;
      context.strokeStyle = entry.color;
      context.lineWidth = dim ? 1.2 : 2.2;
      context.setLineDash(entry.dash);
      context.beginPath();
      axes.forEach((metric, i) => {
        const x = geometry.left + geometry.step * i;
        const z = this.zScore(metric, entry.index);
        const y = this.zToY(z, geometry);
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.stroke();
      context.setLineDash([]);
      context.globalAlpha = 1;
    }

    this.note.textContent = brushed === null
      ? 'Each line is one candidate. Drag up or down on an axis to brush a range; lines outside it fade.'
      : `Brushing keeps ${formatCount(brushed.size)} of ${formatCount(series.length)} candidates. `
        + 'Drag again to adjust, or use Clear brushes.';
    this.renderLegend(series, brushed === null ? [] : series.filter((entry) => !brushed.has(entry.id)).map((entry) => entry.id));

    if (this.brushes.size > 0 && !this.clearBrushButton) {
      this.clearBrushButton = document.createElement('button');
      this.clearBrushButton.type = 'button';
      this.clearBrushButton.className = 'chip-button';
      this.clearBrushButton.textContent = 'Clear brushes';
      this.clearBrushButton.addEventListener('click', () => {
        this.brushes.clear();
        this.clearBrushButton.remove();
        this.clearBrushButton = null;
        this.drawParallel();
      });
      this.note.after(this.clearBrushButton);
    }
  }

  zToY(z, geometry) {
    const clamped = Number.isFinite(z) ? z : 0;
    return geometry.bottom - ((clamped + 3) / 6) * (geometry.bottom - geometry.top);
  }

  brushedIds(axes, geometry) {
    if (this.brushes.size === 0) return null;
    const kept = new Set();
    for (const entry of this.seriesFor()) {
      let passes = true;
      for (const metric of axes) {
        const brush = this.brushes.get(metric.key);
        if (!brush) continue;
        const y = this.zToY(this.zScore(metric, entry.index), geometry);
        const low = Math.min(brush.a, brush.b);
        const high = Math.max(brush.a, brush.b);
        if (y < low || y > high) {
          passes = false;
          break;
        }
      }
      if (passes) kept.add(entry.id);
    }
    return kept;
  }

  axisAt(x) {
    if (!this.geometry || !this.axesCache) return -1;
    for (let i = 0; i < this.axesCache.length; i += 1) {
      if (Math.abs(this.geometry.left + this.geometry.step * i - x) <= 9) return i;
    }
    return -1;
  }

  onBrushStart(event) {
    if (this.tab !== 'parallel') return;
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const axis = this.axisAt(x);
    if (axis < 0) return;
    this.activeBrush = { key: this.axesCache[axis].key, a: y, b: y };
    this.brushes.set(this.activeBrush.key, this.activeBrush);
    this.canvas.setPointerCapture(event.pointerId);
    this.drawParallel();
  }

  onBrushMove(event) {
    if (!this.activeBrush) {
      if (this.tab === 'parallel') {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.style.cursor = this.axisAt(event.clientX - rect.left) >= 0 ? 'ns-resize' : 'default';
      }
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    this.activeBrush.b = event.clientY - rect.top;
    this.drawParallel();
  }

  onBrushEnd(event) {
    if (!this.activeBrush) return;
    if (Math.abs(this.activeBrush.a - this.activeBrush.b) < 4) {
      this.brushes.delete(this.activeBrush.key);
    }
    this.activeBrush = null;
    this.canvas.releasePointerCapture?.(event.pointerId);
    this.drawParallel();
  }

  renderDelta() {
    const series = this.seriesFor();
    this.deltaControls.replaceChildren();
    this.deltaTableHost.replaceChildren();
    this.note.textContent = 'Signed difference for every metric, A minus B. Bars run left for '
      + 'lower and right for higher, and the sign is printed as well.';

    if (series.length < 2) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'Shortlist at least two genes to compare them one against one.';
      this.deltaTableHost.append(empty);
      return;
    }
    const ids = series.map((entry) => entry.id);
    if (!ids.includes(this.deltaPair[0])) [this.deltaPair[0]] = ids;
    if (!ids.includes(this.deltaPair[1]) || this.deltaPair[1] === this.deltaPair[0]) {
      this.deltaPair[1] = ids.find((id) => id !== this.deltaPair[0]) ?? ids[0];
    }

    const makeSelect = (slot, labelText) => {
      const wrapper = document.createElement('span');
      wrapper.className = 'field-row';
      const label = document.createElement('label');
      label.htmlFor = `delta-${slot}`;
      label.textContent = labelText;
      const select = document.createElement('select');
      select.id = `delta-${slot}`;
      for (const entry of series) {
        const option = document.createElement('option');
        option.value = entry.id;
        option.textContent = entry.gene.name ? `${entry.id} ${entry.gene.name}` : entry.id;
        select.append(option);
      }
      select.value = this.deltaPair[slot];
      select.addEventListener('change', () => {
        this.deltaPair[slot] = select.value;
        this.renderDelta();
      });
      wrapper.append(label, select);
      return wrapper;
    };
    this.deltaControls.append(makeSelect(0, 'Gene A'), makeSelect(1, 'Gene B'));

    const indexA = this.state.dataset.indexById.get(this.deltaPair[0]);
    const indexB = this.state.dataset.indexById.get(this.deltaPair[1]);
    const table = document.createElement('table');
    table.className = 'data-table';
    const caption = document.createElement('caption');
    caption.textContent = `${this.deltaPair[0]} minus ${this.deltaPair[1]}, every metric`;
    const head = document.createElement('thead');
    head.innerHTML = '<tr><th scope="col">Metric</th><th scope="col">A</th><th scope="col">B</th>'
      + '<th scope="col">A − B</th><th scope="col">Size of the difference</th></tr>';
    const body = document.createElement('tbody');
    for (const metric of this.registry.metrics) {
      const a = metric.read(indexA);
      const b = metric.read(indexB);
      const difference = Number.isFinite(a) && Number.isFinite(b) ? a - b : NaN;
      const { spread } = this.scaleFor(metric);
      const z = Number.isFinite(difference) && spread > 0 ? difference / spread : NaN;
      const row = document.createElement('tr');
      const label = document.createElement('th');
      label.scope = 'row';
      label.textContent = metric.label;
      const unit = document.createElement('span');
      unit.className = 'row-unit';
      unit.textContent = metric.unit ?? '';
      label.append(' ', unit);

      const bar = document.createElement('td');
      bar.className = 'delta-bar-cell';
      const track = document.createElement('span');
      track.className = 'delta-track';
      const fill = document.createElement('span');
      fill.className = 'delta-fill';
      const magnitude = Number.isFinite(z) ? Math.min(1, Math.abs(z) / 3) : 0;
      fill.style.width = `${magnitude * 50}%`;
      fill.style.background = Number.isFinite(z) ? divergingColor(0.5 + Math.sign(z) * magnitude * 0.5) : 'transparent';
      fill.style.left = Number.isFinite(z) && z < 0 ? `${50 - magnitude * 50}%` : '50%';
      track.append(fill);
      const magnitudeText = document.createElement('span');
      magnitudeText.className = 'delta-magnitude';
      magnitudeText.textContent = Number.isFinite(z)
        ? `${formatDelta({ integer: false }, Number(z.toFixed(2)))} spreads`
        : MISSING;
      bar.append(track, magnitudeText);

      row.append(
        label,
        Object.assign(document.createElement('td'), { className: 'numeric', textContent: formatValue(metric, a) }),
        Object.assign(document.createElement('td'), { className: 'numeric', textContent: formatValue(metric, b) }),
        Object.assign(document.createElement('td'), { className: 'numeric', textContent: formatDelta(metric, difference) }),
        bar,
      );
      body.append(row);
    }
    table.append(caption, head, body);
    this.deltaTableHost.append(table);
  }

  renderTable() {
    const series = this.seriesFor();
    this.tableHost.replaceChildren();
    if (series.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'The shared table lists every shortlisted gene and every metric. '
        + 'It fills in as you shortlist candidates.';
      this.tableHost.append(empty);
      return;
    }
    const metrics = this.registry.metrics;
    const table = document.createElement('table');
    table.className = 'data-table sortable';
    const caption = document.createElement('caption');
    caption.textContent = `${formatCount(series.length)} shortlisted genes. `
      + 'Select a column heading to sort. This table is shared by all three views above.';
    const head = document.createElement('thead');
    const headRow = document.createElement('tr');

    const columns = [
      { key: 'id', label: 'Locus tag', unit: '', read: (entry) => entry.id },
      { key: 'name', label: 'Gene', unit: '', read: (entry) => entry.gene.name ?? '' },
      { key: 'product', label: 'Product', unit: '', read: (entry) => entry.gene.product ?? '' },
      ...metrics.map((metric) => ({
        key: metric.key,
        label: metric.label,
        unit: metric.unit ?? '',
        metric,
        read: (entry) => metric.read(entry.index),
      })),
    ];

    for (const column of columns) {
      const th = document.createElement('th');
      th.scope = 'col';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sort-button';
      button.textContent = column.label;
      if (column.unit) {
        const unit = document.createElement('span');
        unit.className = 'row-unit';
        unit.textContent = column.unit;
        button.append(' ', unit);
      }
      if (this.sort.key === column.key) {
        th.setAttribute('aria-sort', this.sort.direction > 0 ? 'ascending' : 'descending');
        const arrow = document.createElement('span');
        arrow.className = 'sort-arrow';
        arrow.textContent = this.sort.direction > 0 ? ' ▲' : ' ▼';
        button.append(arrow);
      }
      button.addEventListener('click', () => {
        this.sort = this.sort.key === column.key
          ? { key: column.key, direction: -this.sort.direction }
          : { key: column.key, direction: 1 };
        this.renderTable();
      });
      th.append(button);
      headRow.append(th);
    }
    head.append(headRow);

    const column = columns.find((entry) => entry.key === this.sort.key) ?? columns[0];
    const rows = [...series].sort((a, b) => {
      const va = column.read(a);
      const vb = column.read(b);
      if (typeof va === 'string' || typeof vb === 'string') {
        return String(va).localeCompare(String(vb)) * this.sort.direction;
      }
      const fa = Number.isFinite(va) ? va : -Infinity;
      const fb = Number.isFinite(vb) ? vb : -Infinity;
      return (fa - fb) * this.sort.direction;
    });

    const body = document.createElement('tbody');
    for (const entry of rows) {
      const tr = document.createElement('tr');
      const first = document.createElement('th');
      first.scope = 'row';
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'chip-link';
      link.textContent = entry.id;
      link.addEventListener('click', () => this.handlers.onSelect(entry.id));
      first.append(link);
      tr.append(first);
      tr.append(Object.assign(document.createElement('td'), { textContent: entry.gene.name ?? MISSING }));
      tr.append(Object.assign(document.createElement('td'), { textContent: entry.gene.product ?? MISSING }));
      for (const metric of metrics) {
        tr.append(Object.assign(document.createElement('td'), {
          className: 'numeric',
          textContent: formatValue(metric, metric.read(entry.index)),
        }));
      }
      body.append(tr);
    }
    table.append(caption, head, body);
    this.tableHost.append(table);
  }
}
