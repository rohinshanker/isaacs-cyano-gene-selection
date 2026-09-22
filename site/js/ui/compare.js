/**
 * Candidate comparison: three views over one shared sortable table.
 *
 * Radar and parallel coordinates both need a comparable scale, so both use a
 * robust z-score against the genome median. Series are told apart by colour, line
 * pattern, and marker shape together, never by colour alone, and one candidate can
 * be focused across chart, legend, and table.
 *
 * A missing value is drawn as a gap plus an open cross where no value could sit.
 * It is never placed at the median, so the picture and the table agree.
 */
import { divergingColor } from './colors.js';
import { formatValue, formatDelta, formatCount, MISSING } from './format.js';
import { ALL_SOURCES, annotationSourceView } from '../core/annotation-source.js';
import {
  metricValues, isExpressionMetric, isExpressionProxyMetric, expressionBasisOf,
  orderMeasuredFirst, metricsInDisplayOrder,
} from '../core/metric-registry.js';
import {
  robustScale, zScore, seriesStyle, defaultAxes, measurementLimitNote,
  MIN_AXES, Z_LIMIT, presentRuns,
  countMissing, missingRanks, wrapLabel, describeMissing, describeMissingSentence,
  describeDroppedAxes, pluralise, drawMarker, drawMissingGlyph,
} from './compare-model.js';

const TABS = [
  { id: 'radar', label: 'Radar' },
  { id: 'parallel', label: 'Parallel coordinates' },
  { id: 'delta', label: 'Pairwise delta' },
];

/** The signed result leads; raw inputs remain available to its right. */
export const DELTA_COLUMNS = Object.freeze([
  Object.freeze({ key: 'metric', label: 'Metric' }),
  Object.freeze({ key: 'difference', label: 'A − B' }),
  Object.freeze({ key: 'magnitude', label: 'Relative size' }),
  Object.freeze({ key: 'a', label: 'A' }),
  Object.freeze({ key: 'b', label: 'B' }),
]);

const FONT = '11px system-ui, sans-serif';
const LINE_HEIGHT = 13;
/** Labels wider than this wrap onto two lines before the chart is widened. */
const LABEL_MAX_WIDTH = 92;
/** Smallest radar the labels may squeeze; below this the chart scrolls instead. */
const RADAR_MIN_RADIUS = 84;
const RADAR_LABEL_GAP = 18;
/** Narrowest spacing between parallel axes before the chart scrolls. */
const PARALLEL_MIN_STEP = 88;
const PARALLEL_MARGIN = 58;
const PARALLEL_TOP = 26;
const PARALLEL_BOTTOM_MARGIN = 66;
const MARKER_SIZE = 3.2;
const MISSING_GLYPH_SIZE = 3;
/** Spacing between the markers of several candidates missing the same axis. */
const MISSING_GLYPH_STEP = 9;

const INK = '#1b2733';
const INK_MUTED = '#4a5568';
const GRID = '#e3e8ee';
const GRID_STRONG = '#b7c1cc';

function fitCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 600;
  const height = canvas.clientHeight || 320;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.font = FONT;
  return { context, width, height };
}

function seriesLabel(entry) {
  const name = (entry.displayGene ?? entry.gene).name;
  return name ? `${entry.id} ${name}` : entry.id;
}

/** A visually hidden span, for text a screen reader needs and a sighted reader does not. */
function hiddenText(text) {
  const span = document.createElement('span');
  span.className = 'visually-hidden';
  span.textContent = text;
  return span;
}

/** The small tag that says where an expression value came from. */
function basisTag(gene, metric, value) {
  const { basis, short, text } = expressionBasisOf(gene, metric, value);
  const tag = document.createElement('span');
  tag.className = `basis-tag basis-${basis}`;
  tag.textContent = short;
  tag.title = text;
  return tag;
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
    this.focusId = null;
    this.droppedAxes = [];
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

    this.unavailableNote = document.createElement('p');
    this.unavailableNote.className = 'panel-note axis-unavailable-note';

    // A measurement this view promotes must say how thin it is right here, not
    // only in the map's colour disclosure: the comparison is where a candidate
    // is read against its peers.
    this.measurementNote = document.createElement('p');
    this.measurementNote.className = 'panel-note measurement-limits';

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
    this.legend.setAttribute('aria-label', 'Candidates in the chart. Select one to focus it.');
    this.legend.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.focusId) this.setFocus(null);
    });

    this.focusBar = document.createElement('p');
    this.focusBar.className = 'focus-bar';
    this.focusBar.setAttribute('role', 'status');

    this.note = document.createElement('p');
    this.note.className = 'panel-note';

    this.deltaControls = document.createElement('div');
    this.deltaControls.className = 'delta-controls';

    this.deltaTableHost = document.createElement('div');
    this.deltaTableHost.className = 'table-region';

    this.panel.append(
      this.deltaControls, this.chartHost, this.legend, this.focusBar, this.note, this.deltaTableHost,
    );

    this.tableHeading = document.createElement('h3');
    this.tableHeading.className = 'table-heading';
    this.tableHeading.textContent = 'Shortlisted genes';
    this.tableHost = document.createElement('div');
    this.tableHost.className = 'table-region';

    this.host.append(
      this.tablist, this.axisPicker, this.unavailableNote, this.measurementNote,
      this.panel, this.tableHeading, this.tableHost,
    );

    this.canvas.addEventListener('pointerdown', (event) => this.onBrushStart(event));
    this.canvas.addEventListener('pointermove', (event) => this.onBrushMove(event));
    this.canvas.addEventListener('pointerup', (event) => this.onBrushEnd(event));
  }

  setTab(tab) {
    this.tab = tab;
    this.handlers.onTabChange?.(tab);
    this.render();
  }

  /**
   * Metrics currently on the radar and parallel axes. A chosen set wins; otherwise
   * the defaults, minus any metric with no spread, which `droppedAxes` explains.
   */
  activeAxes() {
    if (this.axisKeys) {
      const chosen = this.axisKeys
        .map((key) => this.registry.byKey.get(key))
        .filter(Boolean);
      if (chosen.length >= MIN_AXES) {
        this.droppedAxes = [];
        return chosen;
      }
    }
    const { axes, dropped } = defaultAxes(this.registry, (metric) => this.scaleFor(metric));
    this.droppedAxes = dropped;
    return axes;
  }

  /**
   * @param {{ids: string[], dataset: object, registry: object, tab?: string}} state
   */
  update(state) {
    this.state = state;
    this.registry = state.registry;
    if (state.tab && state.tab !== this.tab) this.tab = state.tab;
    if (this.focusId && !state.ids.includes(this.focusId)) this.focusId = null;
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
    return zScore(metric.read(index), this.scaleFor(metric));
  }

  render() {
    this.chartHost.classList.toggle('empty', this.state.ids.length === 0);
    TABS.forEach((tab, i) => {
      const selected = tab.id === this.tab;
      this.tabButtons[i].setAttribute('aria-selected', String(selected));
      this.tabButtons[i].tabIndex = selected ? 0 : -1;
      this.tabButtons[i].classList.toggle('active', selected);
    });
    this.panel.setAttribute('aria-labelledby', `compare-tab-${this.tab}`);

    const isDelta = this.tab === 'delta';
    this.axisPicker.hidden = isDelta;
    this.unavailableNote.hidden = isDelta;
    this.chartHost.hidden = isDelta;
    this.legend.hidden = isDelta;
    this.focusBar.hidden = isDelta || !this.focusId;
    this.deltaControls.hidden = !isDelta;
    this.deltaTableHost.hidden = !isDelta;

    this.renderAxisPicker();
    this.renderMeasurementNote();
    this.renderTable();
    if (isDelta) this.renderDelta();
    else this.drawActive();
  }

  /**
   * Replicate depth, condition, and coverage for every measurement this region
   * shows without the reader choosing it: the radar and parallel axes, and the
   * measured columns the shared table and the pairwise delta list first. A
   * metric with no declared limits contributes nothing, so the line disappears
   * when the comparison is all derived indices.
   */
  renderMeasurementNote() {
    const shown = [];
    if (this.state.ids.length > 0) {
      if (this.tab !== 'delta') shown.push(...this.activeAxes());
      shown.push(...metricsInDisplayOrder(this.registry));
    }
    const note = measurementLimitNote(shown, this.state.dataset);
    this.measurementNote.hidden = note === null;
    this.measurementNote.textContent = note ?? '';
  }

  renderAxisPicker() {
    const active = new Set(this.activeAxes().map((metric) => metric.key));
    const dropped = new Map(this.droppedAxes.map(({ metric, reason }) => [metric.key, reason]));
    this.axisOptions.replaceChildren();
    for (const family of this.registry.families) {
      const group = document.createElement('fieldset');
      group.className = 'axis-group';
      const legend = document.createElement('legend');
      legend.textContent = family;
      group.append(legend);
      const familyMetrics = orderMeasuredFirst(
        this.registry.metrics.filter((entry) => entry.family === family),
      );
      for (const metric of familyMetrics) {
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
        if (dropped.has(metric.key)) {
          const why = document.createElement('span');
          why.className = 'axis-unavailable';
          why.textContent = ' — left out of the defaults: no spread';
          label.append(why);
        }
        group.append(label);
      }
      this.axisOptions.append(group);
    }
    this.unavailableNote.textContent = describeDroppedAxes(this.droppedAxes);
    this.unavailableNote.hidden = this.tab === 'delta' || this.droppedAxes.length === 0;
  }

  seriesFor() {
    const { ids, dataset, annotationSource } = this.state;
    const source = annotationSource ?? ALL_SOURCES;
    return ids
      .map((id, order) => ({ id, index: dataset.indexById.get(id), order }))
      .filter((entry) => entry.index !== undefined)
      .map((entry) => {
        const gene = dataset.genes[entry.index];
        // The "Gene" and "Product" columns are a UTEX 2973 field; every other
        // column stays scheme- and dataset-derived, not annotation-sourced, so
        // only `displayGene` (never `gene`) is swapped for a single source.
        const displayGene = source !== ALL_SOURCES ? annotationSourceView(gene, dataset, source) : gene;
        return { ...entry, gene, displayGene, ...seriesStyle(entry.order) };
      });
  }

  /** Series in drawing order: the focused candidate last, so it sits on top. */
  drawOrder(series) {
    if (!this.focusId) return series;
    return [...series.filter((entry) => entry.id !== this.focusId),
      ...series.filter((entry) => entry.id === this.focusId)];
  }

  setFocus(id) {
    this.focusId = this.focusId === id ? null : id;
    this.focusBar.hidden = this.tab === 'delta' || !this.focusId;
    this.renderTable();
    this.drawActive();
  }

  drawActive() {
    if (!this.state) return;
    if (this.tab === 'radar') this.drawRadar();
    else if (this.tab === 'parallel') this.drawParallel();
  }

  /**
   * Give the canvas the width its labels need. When the host is narrower the
   * canvas keeps its minimum and the host scrolls, so no axis name is clipped.
   */
  sizeCanvas(neededWidth) {
    const hostWidth = this.chartHost.clientWidth;
    this.scrollsSideways = neededWidth > hostWidth;
    this.canvas.style.width = this.scrollsSideways ? `${Math.ceil(neededWidth)}px` : '100%';
    this.chartHost.classList.toggle('scrolls', this.scrollsSideways);
  }

  /** Said in the chart's own note, because a sideways scroll is easy to miss. */
  scrollHint() {
    return this.scrollsSideways
      ? ' This chart is wider than the screen so no axis name is cut off; scroll it sideways to '
        + 'see the rest.'
      : '';
  }

  emptyChart(message) {
    this.sizeCanvas(0);
    const { context, width, height } = fitCanvas(this.canvas);
    context.fillStyle = INK_MUTED;
    context.font = '14px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(message, width / 2, height / 2);
    this.legend.replaceChildren();
    this.focusBar.hidden = true;
  }

  /** Alpha and width for one series given focus and brushing. */
  emphasis(entry, brushedOut) {
    const focused = this.focusId === entry.id;
    const dimmed = brushedOut || (this.focusId && !focused);
    return {
      alpha: dimmed ? 0.22 : 1,
      lineWidth: focused ? 3.4 : dimmed ? 1.2 : 2.2,
      markerSize: focused ? MARKER_SIZE + 1.2 : MARKER_SIZE,
    };
  }

  renderLegend(series, missing, brushedOut = new Set()) {
    this.legend.replaceChildren();
    for (const entry of series) {
      const item = document.createElement('li');
      const focused = this.focusId === entry.id;
      item.classList.toggle('focused', focused);
      item.classList.toggle('dimmed', brushedOut.has(entry.id) || (Boolean(this.focusId) && !focused));

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip-link legend-entry';
      button.setAttribute('aria-pressed', String(focused));
      button.title = focused ? 'Clear focus' : `Focus ${entry.id} across the chart and the table`;
      button.append(this.swatch(entry));
      const label = document.createElement('span');
      label.textContent = seriesLabel(entry);
      button.append(label);
      const count = missing.bySeries.get(entry.id) ?? 0;
      if (count > 0) {
        const note = document.createElement('span');
        note.className = 'legend-missing';
        note.textContent = ` · ${count} missing`;
        button.append(note);
      }
      if (entry.repeated) {
        const warn = document.createElement('span');
        warn.className = 'legend-missing';
        warn.textContent = ' · repeats an earlier style';
        button.append(warn);
      }
      button.addEventListener('click', () => this.setFocus(entry.id));
      item.append(button);
      this.legend.append(item);
    }
    this.focusBar.replaceChildren();
    if (this.focusId) {
      this.focusBar.append(document.createTextNode(`Focused on ${this.focusId}. `));
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'chip-button';
      clear.textContent = 'Clear focus';
      clear.addEventListener('click', () => this.setFocus(null));
      this.focusBar.append(clear);
    }
  }

  /** The line-and-marker sample that identifies a series in legend and table. */
  swatch(entry) {
    const swatch = document.createElement('canvas');
    const ratio = window.devicePixelRatio || 1;
    swatch.width = Math.round(38 * ratio);
    swatch.height = Math.round(14 * ratio);
    swatch.className = 'legend-swatch';
    swatch.setAttribute('aria-hidden', 'true');
    const context = swatch.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.strokeStyle = entry.color;
    context.fillStyle = entry.color;
    context.lineWidth = 2.2;
    context.setLineDash(entry.dash);
    context.beginPath();
    context.moveTo(1, 7);
    context.lineTo(37, 7);
    context.stroke();
    context.setLineDash([]);
    context.lineWidth = 1.8;
    drawMarker(context, entry.marker, 19, 7, MARKER_SIZE);
    return swatch;
  }

  /** Wrapped label lines for every axis and the widest line among them. */
  measureLabels(context, axes) {
    const measure = (text) => context.measureText(text).width;
    const lines = axes.map((metric) => wrapLabel(metric.label, LABEL_MAX_WIDTH, measure));
    const widest = Math.max(0, ...lines.flat().map(measure));
    return { lines, widest };
  }

  drawRadar() {
    const series = this.seriesFor();
    const axes = this.activeAxes();
    const read = (metric, index) => metric.read(index);
    const missing = countMissing(series, axes, read);
    const ranks = missingRanks(series, axes, read);
    this.canvas.setAttribute(
      'aria-label',
      `Radar chart of ${pluralise(series.length, 'shortlisted gene')} across `
        + `${pluralise(axes.length, 'metric')}, `
        + `z-scored against the genome median. ${describeMissingSentence(missing.total)} `
        + `${missing.total > 0 ? 'Missing values are drawn as gaps with an open cross beyond the outer ring, never at the median. ' : ''}`
        + `${this.focusId ? `${this.focusId} is focused. ` : ''}`
        + 'The same numbers are in the table below.',
    );
    if (series.length === 0) {
      this.note.textContent = 'Each spoke is one metric, scaled so the genome median sits on the '
        + 'middle ring. Further out means higher than typical, further in means lower.';
      this.emptyChart('Shortlist a gene to compare it here.');
      return;
    }

    // Measure first so the radius leaves room for the widest label.
    const probe = this.canvas.getContext('2d');
    probe.font = FONT;
    const { lines, widest } = this.measureLabels(probe, axes);
    // Room for the label, plus the fan of markers for candidates missing that axis.
    const deepestFan = Math.max(0, ...[...missingRanks(series, axes, read).values()]
      .map((entry) => entry.size)) * MISSING_GLYPH_STEP;
    const labelRoom = RADAR_LABEL_GAP + deepestFan + widest + 8;
    this.sizeCanvas(2 * (RADAR_MIN_RADIUS + labelRoom));
    const { context, width, height } = fitCanvas(this.canvas);
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.max(
      RADAR_MIN_RADIUS,
      Math.min(width / 2 - labelRoom, height / 2 - 2 * LINE_HEIGHT - labelRoom),
    );
    const radiusFor = (z) => radius * ((z + Z_LIMIT) / (2 * Z_LIMIT));

    context.lineWidth = 1;
    for (const z of [-1, 1, 3]) {
      context.strokeStyle = GRID;
      context.beginPath();
      context.arc(cx, cy, radiusFor(z), 0, Math.PI * 2);
      context.stroke();
    }
    context.strokeStyle = GRID_STRONG;
    context.setLineDash([3, 3]);
    context.beginPath();
    context.arc(cx, cy, radiusFor(0), 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = INK_MUTED;
    context.textAlign = 'left';
    context.textBaseline = 'bottom';
    context.fillText('median', cx + 4, cy - radiusFor(0) - 2);

    const angleOf = (i) => (i / axes.length) * Math.PI * 2 - Math.PI / 2;
    axes.forEach((metric, i) => {
      const angle = angleOf(i);
      context.strokeStyle = GRID;
      context.beginPath();
      context.moveTo(cx, cy);
      context.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      context.stroke();
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const gap = RADAR_LABEL_GAP + (ranks.get(metric.key)?.size ?? 0) * MISSING_GLYPH_STEP;
      const labelX = cx + cos * (radius + gap);
      const labelY = cy + sin * (radius + gap);
      context.fillStyle = INK;
      context.textAlign = Math.abs(cos) < 0.3 ? 'center' : cos > 0 ? 'left' : 'right';
      context.textBaseline = 'middle';
      const block = lines[i];
      const firstY = labelY - ((block.length - 1) * LINE_HEIGHT) / 2 + (Math.abs(cos) < 0.3 ? sin * LINE_HEIGHT * (block.length - 1) / 2 : 0);
      block.forEach((line, k) => context.fillText(line, labelX, firstY + k * LINE_HEIGHT));
    });

    for (const entry of this.drawOrder(series)) {
      const { alpha, lineWidth, markerSize } = this.emphasis(entry, false);
      const points = axes.map((metric, i) => {
        const z = this.zScore(metric, entry.index);
        const angle = angleOf(i);
        const present = Number.isFinite(z);
        const r = present ? radiusFor(z) : NaN;
        const place = ranks.get(metric.key)?.get(entry.id);
        return {
          present,
          angle,
          // Several candidates missing one axis fan outward instead of stacking.
          missingRadius: radius + 7 + (place?.rank ?? 0) * MISSING_GLYPH_STEP,
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
        };
      });
      context.globalAlpha = alpha;
      context.strokeStyle = entry.color;
      context.fillStyle = entry.color;
      context.lineWidth = lineWidth;
      context.setLineDash(entry.dash);
      const runs = presentRuns(points.map((point) => point.present), { closed: true });
      const complete = runs.length === 1 && runs[0].length === axes.length;
      for (const run of runs) {
        if (run.length < 2 && !complete) continue;
        context.beginPath();
        run.forEach((index, k) => {
          const point = points[index];
          if (k === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        });
        if (complete) context.closePath();
        context.stroke();
      }
      context.setLineDash([]);
      context.lineWidth = 1.8;
      points.forEach((point) => {
        if (point.present) {
          drawMarker(context, entry.marker, point.x, point.y, markerSize);
        } else {
          const r = point.missingRadius;
          drawMissingGlyph(
            context, cx + Math.cos(point.angle) * r, cy + Math.sin(point.angle) * r, MISSING_GLYPH_SIZE,
          );
        }
      });
      context.globalAlpha = 1;
    }

    this.note.textContent = 'Each spoke is one metric, scaled so the genome median sits on the '
      + 'dashed ring. Further out means higher than typical, further in means lower. '
      + (missing.total > 0
        ? `${describeMissing(missing.total)}: a gap in the outline and an open cross just past the `
          + 'outer ring mark where a gene has no value; nothing is drawn at the median for it. '
        : 'Every plotted gene has a value on every axis. ')
      + 'Select a legend entry to focus one candidate; select a locus tag in the table to pin it.'
      + this.scrollHint();
    this.renderLegend(series, missing);
  }

  parallelGeometry(width, height, axisCount) {
    const left = PARALLEL_MARGIN;
    const right = width - PARALLEL_MARGIN;
    const top = PARALLEL_TOP;
    const bottom = height - PARALLEL_BOTTOM_MARGIN;
    const step = axisCount > 1 ? (right - left) / (axisCount - 1) : 0;
    return { left, right, top, bottom, step };
  }

  drawParallel() {
    const series = this.seriesFor();
    const axes = this.activeAxes();
    const read = (metric, index) => metric.read(index);
    const missing = countMissing(series, axes, read);
    const ranks = missingRanks(series, axes, read);
    this.canvas.setAttribute(
      'aria-label',
      `Parallel coordinates of ${pluralise(series.length, 'shortlisted gene')} across `
        + `${pluralise(axes.length, 'metric')}, `
        + `z-scored against the genome median. ${describeMissingSentence(missing.total)} `
        + `${missing.total > 0 ? 'Missing values are drawn as a break in the line with an open cross below the axis, never at the median. ' : ''}`
        + `${this.focusId ? `${this.focusId} is focused. ` : ''}`
        + 'The same numbers are in the table below.',
    );
    if (series.length === 0) {
      this.note.textContent = 'Each line is one candidate crossing every metric axis.';
      this.emptyChart('Shortlist a gene to compare it here.');
      return;
    }

    this.sizeCanvas(2 * PARALLEL_MARGIN + PARALLEL_MIN_STEP * (axes.length - 1));
    const { context, width, height } = fitCanvas(this.canvas);
    const geometry = this.parallelGeometry(width, height, axes.length);
    this.geometry = geometry;
    this.axesCache = axes;
    const { lines } = this.measureLabels(context, axes);

    // The z scale is drawn once, at the left, rather than on every axis.
    context.fillStyle = INK_MUTED;
    context.textAlign = 'right';
    context.textBaseline = 'middle';
    context.fillText(`+${Z_LIMIT}`, geometry.left - 10, geometry.top);
    context.fillText('median', geometry.left - 10, (geometry.top + geometry.bottom) / 2);
    context.fillText(`−${Z_LIMIT}`, geometry.left - 10, geometry.bottom);
    context.strokeStyle = GRID_STRONG;
    context.setLineDash([3, 3]);
    context.beginPath();
    context.moveTo(geometry.left, (geometry.top + geometry.bottom) / 2);
    context.lineTo(geometry.right, (geometry.top + geometry.bottom) / 2);
    context.stroke();
    context.setLineDash([]);

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
      context.fillStyle = INK;
      context.textAlign = 'center';
      context.textBaseline = 'top';
      lines[i].forEach((line, k) => {
        context.fillText(line, x, geometry.bottom + 20 + k * LINE_HEIGHT);
      });
    });

    const brushed = this.brushedIds(axes, geometry);
    const brushedOut = new Set(
      brushed === null ? [] : series.filter((entry) => !brushed.has(entry.id)).map((entry) => entry.id),
    );
    for (const entry of this.drawOrder(series)) {
      const { alpha, lineWidth, markerSize } = this.emphasis(entry, brushedOut.has(entry.id));
      const points = axes.map((metric, i) => {
        const z = this.zScore(metric, entry.index);
        const present = Number.isFinite(z);
        const place = ranks.get(metric.key)?.get(entry.id);
        const x = geometry.left + geometry.step * i;
        return {
          present,
          x,
          y: present ? this.zToY(z, geometry) : NaN,
          // Candidates missing one axis spread along it rather than stacking.
          missingX: x + ((place?.rank ?? 0) - ((place?.total ?? 1) - 1) / 2) * MISSING_GLYPH_STEP,
        };
      });
      context.globalAlpha = alpha;
      context.strokeStyle = entry.color;
      context.fillStyle = entry.color;
      context.lineWidth = lineWidth;
      context.setLineDash(entry.dash);
      for (const run of presentRuns(points.map((point) => point.present))) {
        if (run.length < 2) continue;
        context.beginPath();
        run.forEach((index, k) => {
          const point = points[index];
          if (k === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        });
        context.stroke();
      }
      context.setLineDash([]);
      context.lineWidth = 1.8;
      points.forEach((point) => {
        if (point.present) drawMarker(context, entry.marker, point.x, point.y, markerSize);
        else drawMissingGlyph(context, point.missingX, geometry.bottom + 9, MISSING_GLYPH_SIZE);
      });
      context.globalAlpha = 1;
    }

    const missingText = missing.total > 0
      ? ` ${describeMissing(missing.total)}: the line breaks and an open cross sits below the axis; `
        + 'a gene with no value on a brushed axis is never kept by that brush.'
      : '';
    this.note.textContent = brushed === null
      ? 'Each line is one candidate. Drag up or down on an axis to brush a range; lines outside '
        + `it fade.${missingText} Select a legend entry to focus one candidate.${this.scrollHint()}`
      : `Brushing keeps ${formatCount(brushed.size)} of ${formatCount(series.length)} candidates. `
        + `Drag again to adjust, or use Clear brushes.${missingText}${this.scrollHint()}`;
    this.renderLegend(series, missing, brushedOut);

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

  /** Pixel row for a finite z-score. Callers never pass a missing value here. */
  zToY(z, geometry) {
    return geometry.bottom - ((z + Z_LIMIT) / (2 * Z_LIMIT)) * (geometry.bottom - geometry.top);
  }

  brushedIds(axes, geometry) {
    if (this.brushes.size === 0) return null;
    const kept = new Set();
    for (const entry of this.seriesFor()) {
      let passes = true;
      for (const metric of axes) {
        const brush = this.brushes.get(metric.key);
        if (!brush) continue;
        const z = this.zScore(metric, entry.index);
        // Unknown is not inside any range.
        if (!Number.isFinite(z)) {
          passes = false;
          break;
        }
        const y = this.zToY(z, geometry);
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

  /** A table cell for a metric value: the number, or an explicit missing mark. */
  valueCell(metric, value, gene) {
    const td = document.createElement('td');
    td.className = 'numeric';
    if (Number.isFinite(value)) {
      td.textContent = formatValue(metric, value);
    } else {
      td.classList.add('missing');
      td.textContent = MISSING;
      td.append(hiddenText('no value'));
    }
    if (gene && isExpressionMetric(metric) && !isExpressionProxyMetric(metric)) {
      td.append(' ', basisTag(gene, metric, value));
    }
    return td;
  }

  renderDelta() {
    const series = this.seriesFor();
    this.deltaControls.replaceChildren();
    this.deltaTableHost.replaceChildren();
    this.note.textContent = 'Signed difference for every metric, A minus B. Bars run left for '
      + 'lower and right for higher, and the sign is printed as well. A missing value on '
      + 'either side leaves the difference missing.';

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
        option.textContent = seriesLabel(entry);
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

    const { dataset } = this.state;
    const indexA = dataset.indexById.get(this.deltaPair[0]);
    const indexB = dataset.indexById.get(this.deltaPair[1]);
    const table = document.createElement('table');
    table.className = 'data-table delta-data-table';
    const tableScroll = document.createElement('div');
    tableScroll.className = 'table-scroll';
    const captionText = `${this.deltaPair[0]} minus ${this.deltaPair[1]}. `
      + 'Signed differences come first; on narrow screens, scroll right for the raw A and B values.';
    const captionNote = document.createElement('p');
    captionNote.className = 'table-caption';
    captionNote.id = 'compare-delta-caption';
    captionNote.textContent = captionText;
    table.setAttribute('aria-describedby', captionNote.id);
    const caption = document.createElement('caption');
    caption.className = 'visually-hidden';
    caption.textContent = 'Pairwise metric differences';
    const head = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const column of DELTA_COLUMNS) {
      const heading = document.createElement('th');
      heading.scope = 'col';
      heading.className = `delta-column-${column.key}`;
      heading.textContent = column.label;
      headerRow.append(heading);
    }
    head.append(headerRow);
    const body = document.createElement('tbody');
    // Measured evidence leads this table too, so a pairwise read starts on a
    // measurement rather than on a codon-usage convention.
    for (const metric of metricsInDisplayOrder(this.registry)) {
      const a = metric.read(indexA);
      const b = metric.read(indexB);
      const difference = Number.isFinite(a) && Number.isFinite(b) ? a - b : NaN;
      const { spread } = this.scaleFor(metric);
      const z = Number.isFinite(difference) && spread > 0 ? difference / spread : NaN;
      const row = document.createElement('tr');
      const label = document.createElement('th');
      label.scope = 'row';
      label.className = 'delta-column-metric';
      label.textContent = metric.label;
      const unit = document.createElement('span');
      unit.className = 'row-unit';
      unit.textContent = metric.unit ?? '';
      label.append(' ', unit);

      const bar = document.createElement('td');
      bar.className = 'delta-bar-cell delta-column-magnitude';
      const track = document.createElement('span');
      track.className = 'delta-track';
      const fill = document.createElement('span');
      fill.className = 'delta-fill';
      const magnitude = Number.isFinite(z) ? Math.min(1, Math.abs(z) / Z_LIMIT) : 0;
      fill.style.width = `${magnitude * 50}%`;
      // A signed difference always reads on a diverging ramp, centred on no change.
      fill.style.background = Number.isFinite(z) ? divergingColor(0.5 + Math.sign(z) * magnitude * 0.5) : 'transparent';
      fill.style.left = Number.isFinite(z) && z < 0 ? `${50 - magnitude * 50}%` : '50%';
      track.append(fill);
      const magnitudeText = document.createElement('span');
      magnitudeText.className = 'delta-magnitude';
      magnitudeText.textContent = Number.isFinite(z)
        ? `${formatDelta({ integer: false }, Number(z.toFixed(2)))} spreads`
        : MISSING;
      if (!Number.isFinite(z)) magnitudeText.append(hiddenText('no value'));
      bar.append(track, magnitudeText);

      const deltaCell = this.valueCell(metric, difference, null);
      deltaCell.classList.add('delta-column-difference');
      if (Number.isFinite(difference)) deltaCell.textContent = formatDelta(metric, difference);
      const aCell = this.valueCell(metric, a, dataset.genes[indexA]);
      aCell.classList.add('delta-column-a');
      const bCell = this.valueCell(metric, b, dataset.genes[indexB]);
      bCell.classList.add('delta-column-b');
      const cells = { metric: label, difference: deltaCell, magnitude: bar, a: aCell, b: bCell };
      row.append(...DELTA_COLUMNS.map(({ key }) => cells[key]));
      body.append(row);
    }
    table.append(caption, head, body);
    tableScroll.append(table);
    this.deltaTableHost.append(captionNote, tableScroll);
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
    const metrics = metricsInDisplayOrder(this.registry);
    const missing = countMissing(series, metrics, (metric, index) => metric.read(index));
    const table = document.createElement('table');
    table.className = 'data-table sortable';
    const tableScroll = document.createElement('div');
    tableScroll.className = 'table-scroll';
    const captionText = `${pluralise(formatCount(series.length), 'shortlisted gene')}, `
      + `${describeMissing(missing.total)}`
      + `${missing.total > 0 ? ' shown as a blank cell' : ''}. `
      + 'Select a column heading to sort; missing values sort last. '
      + 'This table is shared by all three views above.';
    const captionNote = document.createElement('p');
    captionNote.className = 'table-caption';
    captionNote.id = 'compare-table-caption';
    captionNote.textContent = captionText;
    table.setAttribute('aria-describedby', captionNote.id);
    const caption = document.createElement('caption');
    caption.className = 'visually-hidden';
    caption.textContent = 'Shortlisted gene comparison';
    const head = document.createElement('thead');
    const headRow = document.createElement('tr');

    const columns = [
      { key: 'id', label: 'Locus tag', unit: '', read: (entry) => entry.id },
      { key: 'name', label: 'Gene', unit: '', read: (entry) => (entry.displayGene ?? entry.gene).name ?? '' },
      { key: 'product', label: 'Product', unit: '',
        read: (entry) => (entry.displayGene ?? entry.gene).product ?? '' },
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
      // Unknown has no rank, so it goes last whichever way the column is sorted.
      const missingA = !Number.isFinite(va);
      const missingB = !Number.isFinite(vb);
      if (missingA && missingB) return 0;
      if (missingA) return 1;
      if (missingB) return -1;
      return (va - vb) * this.sort.direction;
    });

    const body = document.createElement('tbody');
    for (const entry of rows) {
      const tr = document.createElement('tr');
      const focused = this.focusId === entry.id;
      tr.classList.toggle('focused', focused);
      tr.classList.toggle('dimmed', Boolean(this.focusId) && !focused);
      const first = document.createElement('th');
      first.scope = 'row';
      const focus = document.createElement('button');
      focus.type = 'button';
      focus.className = 'series-focus';
      focus.setAttribute('aria-pressed', String(focused));
      focus.setAttribute('aria-label', focused ? `Clear focus on ${entry.id}` : `Focus ${entry.id} in the chart`);
      focus.append(this.swatch(entry));
      focus.addEventListener('click', () => this.setFocus(entry.id));
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'chip-link';
      link.textContent = entry.id;
      link.setAttribute('aria-label', `Pin ${entry.id} in the gene panel`);
      link.addEventListener('click', () => this.handlers.onSelect(entry.id));
      first.append(focus, ' ', link);
      tr.append(first);
      const displayGene = entry.displayGene ?? entry.gene;
      tr.append(Object.assign(document.createElement('td'), { textContent: displayGene.name ?? MISSING }));
      tr.append(Object.assign(document.createElement('td'), { textContent: displayGene.product ?? MISSING }));
      for (const metric of metrics) {
        tr.append(this.valueCell(metric, metric.read(entry.index), entry.gene));
      }
      body.append(tr);
    }
    table.append(caption, head, body);
    tableScroll.append(table);
    this.tableHost.append(captionNote, tableScroll);
  }
}
