/**
 * The Data Sources section and the data selection peek.
 *
 * The section sits directly under "Colour by" and lists the sources in the
 * current selection. "Change Data Selection" opens a centre peek over the page:
 * every data type is a tab, datasets are grouped by condition and, inside a
 * group, by comparable set, each row carries its conditions on shared scales
 * with tick marks, custom filters narrow the list, and an info button opens the
 * conditions as the paper reports them with a linked citation. While the peek
 * is open the page behind it is dimmed and inert, focus stays inside, and
 * Escape or Done returns focus to the button that opened it.
 *
 * The same peek, in single-choice mode, is how the filters, the axes and the
 * projection views pick a source of their own (owner decision, 2026-10-05).
 *
 * Nothing drawn here decides comparability: the rows and subgroups are the
 * condition record arranged by `core/data-sources.js`, and an unreported axis is
 * drawn as missing, never as zero.
 */
import {
  CONDITION_SCALES, DATA_TYPES, FILTER_FIELDS, conditionRange, dataTypeOfMetric, emptyFilter,
  formatRange, groupDatasets, normalizeSelection, passesFilters, regimeOf, studyColors,
  summariseSet,
} from '../core/data-sources.js';
import { renderSourceToggles } from './legend.js';

const SVG = 'http://www.w3.org/2000/svg';
const REGIME_COLOR = Object.freeze({
  standard: '#2a78d6', elevated: '#eb6834', ambient: '#1baf7a', outside: '#8b9199', unknown: '#8b9199',
});
const AXIS_NAMES = Object.freeze({
  temperature: 'Temperature', lightIntensity: 'Light intensity', lightRegime: 'Light regime',
  co2: 'CO₂', medium: 'Medium', format: 'Culture format', phase: 'Growth phase',
});
/** Where the section remembers that the reader hid it: presentation, not link state. */
export const HIDDEN_STORAGE_KEY = 'cyano.data-sources-hidden.v1';

function el(tag, { className, text, attrs, children } = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  for (const [name, value] of Object.entries(attrs ?? {})) node.setAttribute(name, String(value));
  for (const child of children ?? []) node.append(child);
  return node;
}

function svg(tag, attrs) {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attrs ?? {})) node.setAttribute(name, String(value));
  return node;
}

function xOf(scale, value, width) {
  const pad = 7;
  const span = width - 2 * pad;
  const t = scale.log
    ? (Math.log10(value) - Math.log10(scale.min)) / (Math.log10(scale.max) - Math.log10(scale.min))
    : (value - scale.min) / (scale.max - scale.min);
  return pad + Math.max(0, Math.min(1, t)) * span;
}

/** The "not reported" cell: hatched, labelled, never a zero. */
function missingCell(axis) {
  const label = axis?.status === 'not retrieved' ? 'not retrieved' : 'not reported';
  return el('span', { className: 'ds-missing', text: label, attrs: { title: axis?.text ?? label } });
}

/**
 * One condition track: the shared scale's bands and tick marks in every row, and
 * the value by position. Colour repeats the regime but position carries the
 * value, so a reader who cannot tell the hues apart loses nothing.
 */
export function conditionTrack(axisKey, range, text, width = 104, height = 24) {
  const scale = CONDITION_SCALES[axisKey];
  const mid = height / 2;
  const node = svg('svg', { class: 'ds-track', width, height, role: 'img' });
  for (const [a, b, regime] of scale.bands) {
    node.append(svg('rect', {
      x: xOf(scale, a, width), y: 3, width: xOf(scale, b, width) - xOf(scale, a, width),
      height: height - 6, fill: REGIME_COLOR[regime], opacity: 0.12,
    }));
  }
  for (const tick of scale.ticks) {
    const x = xOf(scale, tick, width);
    node.append(svg('line', { x1: x, x2: x, y1: 3, y2: height - 3, stroke: '#c9ced4', 'stroke-width': 1 }));
  }
  if (scale.rule) {
    const x = xOf(scale, scale.rule, width);
    node.append(svg('line', { x1: x, x2: x, y1: 1, y2: height - 1, stroke: '#7b828a', 'stroke-width': 1, 'stroke-dasharray': '2 2' }));
  }
  node.append(svg('line', { x1: 7, x2: width - 7, y1: mid, y2: mid, stroke: '#aab1b8', 'stroke-width': 1 }));
  const color = REGIME_COLOR[regimeOf(axisKey, range)];
  const x0 = xOf(scale, range[0], width);
  const x1 = xOf(scale, range[1], width);
  if (range[0] === range[1]) {
    node.append(svg('circle', { cx: x0, cy: mid, r: 5, fill: color, stroke: '#fff', 'stroke-width': 2 }));
  } else {
    node.append(svg('rect', { x: x0 - 4, y: mid - 5, width: x1 - x0 + 8, height: 10, rx: 5, fill: color, stroke: '#fff', 'stroke-width': 2 }));
  }
  const label = `${formatRange(range, scale.unit)}. As reported: ${text}`;
  node.setAttribute('aria-label', label);
  const title = svg('title');
  title.textContent = label;
  node.append(title);
  return node;
}

/** The labelled axis drawn once per column header, aligned with every row's ticks. */
export function conditionAxis(axisKey, width = 104) {
  const scale = CONDITION_SCALES[axisKey];
  const node = svg('svg', { class: 'ds-track', width, height: 20, 'aria-hidden': 'true' });
  for (const tick of scale.ticks) {
    const x = xOf(scale, tick, width);
    const labelled = scale.labels.includes(tick);
    node.append(svg('line', { x1: x, x2: x, y1: labelled ? 12 : 15, y2: 19, stroke: '#7b828a', 'stroke-width': 1 }));
    if (labelled) {
      const atEdge = x > width - 12;
      const text = svg('text', { x: atEdge ? width - 1 : x, y: 9, 'font-size': 10, 'text-anchor': atEdge ? 'end' : 'middle', fill: '#4a5568' });
      text.textContent = String(tick);
      node.append(text);
    }
  }
  return node;
}

function trackCell(dataset, axisKey) {
  const axis = dataset.record.conditions[axisKey];
  const range = conditionRange(dataset, axisKey);
  return range ? conditionTrack(axisKey, range, axis.text) : missingCell(axis);
}

function regimeCell(dataset) {
  const regime = dataset.record.conditions.lightRegime;
  if (!regime.kind && regime.status !== 'reported' && regime.status !== 'conflicting') return missingCell(regime);
  const main = regime.kind === 'diel'
    ? `diel${regime.photoperiod ? ` ${regime.photoperiod}` : ''}`
    : regime.kind === 'continuous'
      ? (regime.entrained ? 'continuous, after light–dark entrainment' : 'continuous')
      : regime.text;
  const node = el('div', { className: 'ds-two', text: main });
  node.append(el('small', { text: regime.spectrumClass ?? 'spectrum not reported' }));
  return node;
}

function chip(text, className = 'ds-chip', title = null) {
  const node = el('span', { className, text });
  if (title) node.setAttribute('title', title);
  return node;
}

function mediumCell(dataset) {
  const medium = dataset.record.conditions.medium;
  if (!medium.base) return missingCell(medium);
  const node = el('span');
  node.append(chip(medium.base, 'ds-chip', medium.text));
  if (medium.nitrogenAltered) node.append(chip('nitrogen altered'));
  if (medium.conditioned) node.append(chip('conditioned'));
  return node;
}

function phaseCell(dataset) {
  const { format, phase } = dataset.record.conditions;
  if (!format.value && !phase.label && phase.status !== 'reported') return missingCell(phase);
  const node = el('div', { className: 'ds-two', text: format.value ?? 'format not reported' });
  const od = phase.od ? ` · OD${phase.odNm ?? ''} ${phase.od[0] === phase.od[1] ? phase.od[0] : `${phase.od[0]}–${phase.od[1]}`}` : '';
  node.append(el('small', { text: `${phase.label ?? (phase.status === 'reported' ? phase.text : 'phase not reported')}${od}` }));
  return node;
}

/** Elements inside `root` that can take focus, in document order. */
function focusables(root) {
  const out = [];
  const walk = (node) => {
    for (const child of node.children ?? []) {
      if (child.hidden || child.disabled) continue;
      if (['BUTTON', 'INPUT', 'SELECT', 'A', 'TEXTAREA'].includes(String(child.tagName).toUpperCase())) out.push(child);
      walk(child);
    }
  };
  walk(root);
  return out;
}

/**
 * The section and the peek. One instance per page; `update` re-renders the
 * section from the current selection, `open` shows the peek.
 */
export class DataSourcesPanel {
  /**
   * @param {HTMLElement} host the toolbar row the section renders into.
   * @param {{datasets: object[], judgements?: object[], onChange: function(string[]): void,
   *   storage?: {getItem: function, setItem: function}|null}} options
   */
  constructor(host, { datasets, judgements = [], onChange, storage = null }) {
    this.host = host;
    this.datasets = datasets;
    this.judgements = judgements;
    this.onChange = onChange;
    this.storage = storage;
    this.selection = normalizeSelection([], datasets);
    this.colorMetricKey = null;
    this.annotation = null;
    this.hidden = this.readHidden();
    this.peek = null;
    this.build();
  }

  readHidden() {
    try { return this.storage?.getItem(HIDDEN_STORAGE_KEY) === '1'; } catch { return false; }
  }

  writeHidden(value) {
    try { this.storage?.setItem(HIDDEN_STORAGE_KEY, value ? '1' : '0'); } catch { /* storage is a convenience only */ }
  }

  build() {
    this.host.replaceChildren();
    this.host.classList.add('data-sources-row');
    this.details = el('details', { className: 'data-sources' });
    // Closed at the start, by owner decision of 2026-10-06; the summary says
    // what is selected without the list taking the toolbar's room.
    this.details.open = false;
    this.summary = el('summary', { className: 'data-sources-summary' });
    this.list = el('ul', { className: 'data-sources-list' });
    this.toggles = el('div', { className: 'data-sources-toggles' });
    this.changeButton = el('button', { className: 'chip-button data-sources-change', text: 'Change Data Selection', attrs: { type: 'button' } });
    this.changeButton.addEventListener('click', () => this.open({ opener: this.changeButton }));
    this.actions = el('div', { className: 'data-sources-actions', children: [this.changeButton] });
    this.details.append(this.summary, this.toggles, this.list, this.actions);
    this.hideButton = el('button', { className: 'chip-button data-sources-hide', attrs: { type: 'button' } });
    this.hideButton.addEventListener('click', () => {
      this.hidden = !this.hidden;
      this.writeHidden(this.hidden);
      this.renderSection();
    });
    this.host.append(this.details, this.hideButton);
    this.renderSection();
  }

  /**
   * Re-render the section after the selection, the colour metric, or the
   * annotation sources changed.
   *
   * `annotation` is set while the map is coloured by function category: the
   * organism's annotation-source toggles (`{toggles, sources, onToggle}`) are
   * data sources too (owner decision, 2026-10-06) and the section shows them
   * in place of the dataset list.
   */
  update({ selection, colorMetricKey = this.colorMetricKey, annotation = null, informing = null } = {}) {
    if (selection) this.selection = normalizeSelection(selection, this.datasets);
    this.colorMetricKey = colorMetricKey;
    this.annotation = annotation;
    // `{typeOf(dataset) → {key, label}, chosen(typeKey) → dataset|null, onInform(typeKey, id)}`:
    // which dataset informs each type metric, chosen here when a type has
    // more than one selected dataset.
    this.informing = informing;
    this.renderSection();
  }

  /**
   * Whether the colouring metric has a data selection behind it: a dataset
   * metric, or function category with its annotation sources. A computed
   * metric such as GC3 has none, and the section is not shown for it
   * (owner decision, 2026-10-06).
   */
  relevant() {
    if (this.annotation) return true;
    return Boolean(dataTypeOfMetric(this.colorMetricKey, this.datasets));
  }

  selectedDatasets() {
    const chosen = new Set(this.selection);
    return this.datasets.filter((d) => chosen.has(d.id));
  }

  renderSection() {
    // Shown only where a data selection informs the colour: a dataset with no
    // measured source has nothing to choose among, and a computed metric has
    // no source behind it.
    this.host.hidden = !this.relevant();
    this.toggles.replaceChildren();
    this.list.replaceChildren();
    if (this.annotation) {
      const { toggles, sources, onToggle } = this.annotation;
      const names = toggles.filter((t) => sources.includes(t.id)).map((t) => t.label);
      this.summary.textContent = `Data Sources (${names.length ? names.join(', ') : 'no annotation source'})`;
      this.toggles.append(renderSourceToggles(sources, onToggle, toggles));
      this.actions.hidden = true;
      this.details.hidden = this.hidden;
      this.hideButton.textContent = this.hidden ? 'Show Data Sources' : 'Hide';
      this.hideButton.setAttribute('aria-expanded', String(!this.hidden));
      return;
    }
    this.actions.hidden = false;
    const chosen = this.selectedDatasets();
    this.summary.textContent = `Data Sources (${chosen.length} selected)`;
    if (!chosen.length) {
      this.list.append(el('li', { className: 'data-sources-empty', text: 'No data source selected.' }));
    }
    for (const type of DATA_TYPES) {
      const ofType = chosen.filter((d) => d.record.dataType === type.id);
      if (!ofType.length) continue;
      this.list.append(el('li', { className: 'data-sources-type', text: type.name }));
      const pooledRows = new Set();
      for (const dataset of ofType) {
        const kind = this.informing?.typeOf(dataset) ?? null;
        const siblings = kind ? ofType.filter((d) => this.informing.typeOf(d).key === kind.key) : [];
        if (kind && siblings.length > 1 && !pooledRows.has(kind.key)) {
          // Several datasets of one type pool by default (owner, 2026-10-06);
          // the first choice says so and brings the pooled value back.
          pooledRows.add(kind.key);
          const pooledChosen = !this.informing.chosen(kind.key);
          const row = el('li', { className: 'data-sources-item data-sources-pooled' });
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = `ds-inform-${kind.key}`;
          radio.id = `ds-inform-${kind.key}-pooled`;
          radio.checked = pooledChosen;
          radio.setAttribute('aria-label', `Pool the ${siblings.length} selected datasets for ${kind.label}`);
          radio.addEventListener('change', () => { if (radio.checked) this.informing.onInform(kind.key, null); });
          row.append(radio, ' ', el('span', { className: 'data-sources-label', text: `Pooled: ${kind.label} over ${siblings.length} datasets` }));
          if (pooledChosen) {
            row.append(' ', chip(kind.key === this.colorMetricKey ? 'colouring the map' : `informs ${kind.label}`,
              kind.key === this.colorMetricKey ? 'ds-chip ds-chip-active' : 'ds-chip'));
          }
          this.list.append(row);
        }
        const item = el('li', { className: 'data-sources-item' });
        item.dataset.id = dataset.id;
        const informs = kind ? this.informing.chosen(kind.key)?.id === dataset.id : false;
        if (kind && siblings.length > 1) {
          // One dataset informs each type metric; the reader picks it here.
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = `ds-inform-${kind.key}`;
          radio.id = `ds-inform-${kind.key}-${dataset.id}`;
          radio.checked = informs;
          radio.setAttribute('aria-label', `${dataset.record.studyId} ${dataset.record.conditionSet} informs ${kind.label}`);
          radio.addEventListener('change', () => { if (radio.checked) this.informing.onInform(kind.key, dataset.id); });
          item.append(radio, ' ');
        }
        item.append(el('span', { className: 'data-sources-acc', text: dataset.record.studyId }), ' ',
          el('span', { className: 'data-sources-label', text: dataset.record.conditionSet }));
        if (kind && informs) {
          item.append(' ', chip(kind.key === this.colorMetricKey ? 'colouring the map' : `informs ${kind.label}`,
            kind.key === this.colorMetricKey ? 'ds-chip ds-chip-active' : 'ds-chip'));
        } else if (dataset.metricKey === this.colorMetricKey) {
          item.append(' ', chip('colouring the map', 'ds-chip ds-chip-active'));
        }
        this.list.append(item);
      }
    }
    this.details.hidden = this.hidden;
    this.hideButton.textContent = this.hidden ? 'Show Data Sources' : 'Hide';
    this.hideButton.setAttribute('aria-expanded', String(!this.hidden));
  }

  /**
   * Open the peek. In `multi` mode the selection is edited in place and handed
   * to `onChange` on Done; in `single` mode the reader picks one dataset of
   * one data type and the promise resolves to its metric key, or null.
   *
   * @param {{mode?: 'multi'|'single', dataType?: string|null, opener?: HTMLElement|null,
   *   title?: string, current?: string|null}} options
   * @returns {Promise<string[]|string|null>}
   */
  open({ mode = 'multi', dataType = null, opener = null, title = null, current = null } = {}) {
    if (!this.peek) this.peek = this.buildPeek();
    const peek = this.peek;
    if (peek.active) peek.settle(null);
    const fallbackType = dataTypeOfMetric(this.colorMetricKey, this.datasets) ?? DATA_TYPES[0].id;
    peek.state = {
      mode,
      type: dataType ?? fallbackType,
      selected: mode === 'multi' ? new Set(this.selection) : new Set(current ? [current] : []),
      filters: [],
      arrays: false,
      flat: false,
      info: null,
    };
    peek.title.textContent = title ?? (mode === 'multi' ? 'Data selection' : 'Select a source');
    peek.done.textContent = mode === 'multi' ? 'Done' : 'Use this source';
    this.renderPeek();
    peek.backdrop.hidden = false;
    this.setBackgroundInert(true);
    const opening = opener ?? (typeof document.activeElement?.focus === 'function' ? document.activeElement : null);
    return new Promise((resolve) => {
      peek.active = { resolve, opener: opening };
      peek.close.focus();
    });
  }

  /** Every top-level region but the peek is inert while it is open. */
  setBackgroundInert(on) {
    for (const node of document.body.children ?? []) {
      if (node === this.peek.backdrop) continue;
      if (on) {
        node.setAttribute('inert', '');
        node.setAttribute('aria-hidden', 'true');
      } else {
        node.removeAttribute?.('inert');
        node.removeAttribute?.('aria-hidden');
      }
    }
  }

  buildPeek() {
    const backdrop = el('div', { className: 'peek-backdrop' });
    backdrop.hidden = true;
    const dialog = el('div', { className: 'peek data-selection', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'data-selection-title' } });
    const title = el('h2', { className: 'peek-title', text: 'Data selection', attrs: { id: 'data-selection-title' } });
    const tabs = el('div', { className: 'peek-tabs', attrs: { role: 'tablist', 'aria-label': 'Data type' } });
    const close = el('button', { className: 'chip-button peek-close', text: 'Close', attrs: { type: 'button', 'aria-label': 'Close data selection' } });
    const head = el('div', { className: 'peek-head', children: [title, tabs, close] });
    const bar = el('div', { className: 'peek-bar' });
    const legend = el('div', { className: 'peek-legend' });
    const list = el('div', { className: 'peek-list', attrs: { 'aria-label': 'Datasets' } });
    const side = el('div', { className: 'peek-side', attrs: { 'aria-live': 'polite' } });
    const body = el('div', { className: 'peek-body', children: [list, side] });
    const count = el('span', { className: 'peek-count' });
    const done = el('button', { className: 'chip-button active peek-done', text: 'Done', attrs: { type: 'button' } });
    const foot = el('div', { className: 'peek-foot', children: [count, done] });
    dialog.append(head, bar, legend, body, foot);
    backdrop.append(dialog);
    document.body.append(backdrop);

    const peek = { backdrop, dialog, title, tabs, close, bar, legend, list, side, count, done, active: null, state: null };
    peek.settle = (answer) => {
      if (!peek.active) return;
      const { resolve, opener } = peek.active;
      peek.active = null;
      backdrop.hidden = true;
      this.setBackgroundInert(false);
      if (typeof opener?.focus === 'function') opener.focus({ preventScroll: true });
      resolve(answer);
    };
    close.addEventListener('click', () => peek.settle(null));
    done.addEventListener('click', () => this.finish());
    backdrop.addEventListener('pointerdown', (event) => { if (event.target === backdrop) peek.settle(null); });
    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); peek.settle(null); return; }
      if (event.key !== 'Tab') return;
      const order = focusables(dialog);
      if (!order.length) return;
      const index = order.indexOf(document.activeElement);
      const first = order[0];
      const last = order[order.length - 1];
      if (event.shiftKey && (index <= 0)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (index === -1 || index === order.length - 1)) { event.preventDefault(); first.focus(); }
    });
    return peek;
  }

  /** Done: hand the edited selection out, or the one chosen source. */
  finish() {
    const peek = this.peek;
    const { mode, selected } = peek.state;
    if (mode === 'multi') {
      const next = normalizeSelection([...selected], this.datasets);
      this.selection = next;
      this.renderSection();
      this.onChange?.(next);
      peek.settle(next);
      return;
    }
    const id = [...selected][0] ?? null;
    peek.settle(id ? this.datasets.find((d) => d.id === id)?.metricKey ?? null : null);
  }

  typeDatasets() {
    return this.datasets.filter((d) => d.record.dataType === this.peek.state.type);
  }

  shownDatasets() {
    const { filters, arrays, type } = this.peek.state;
    return this.typeDatasets().filter((d) => {
      if (type === 'transcriptomics' && !arrays && d.record.platform === 'array') return false;
      return passesFilters(d, filters);
    });
  }

  renderPeek() {
    this.renderTabs();
    this.renderBar();
    this.renderLegend();
    this.renderList();
    this.renderSide();
  }

  renderTabs() {
    const { tabs, state } = this.peek;
    tabs.replaceChildren();
    for (const type of DATA_TYPES) {
      const n = this.datasets.filter((d) => d.record.dataType === type.id).length;
      const tab = el('button', { className: 'chip-button peek-tab', text: `${type.name} (${n})`, attrs: { type: 'button', role: 'tab', 'aria-selected': String(state.type === type.id) } });
      if (state.type === type.id) tab.classList.add('active');
      tab.addEventListener('click', () => {
        state.type = type.id;
        state.filters = [];
        state.info = null;
        this.renderPeek();
      });
      tabs.append(tab);
    }
  }

  renderBar() {
    const { bar, state } = this.peek;
    bar.replaceChildren();
    const filters = el('div', { className: 'peek-filters' });
    state.filters.forEach((filter, index) => filters.append(this.filterChip(filter, index)));
    const add = el('select', { className: 'peek-add-filter', attrs: { 'aria-label': 'Add a filter' } });
    add.append(el('option', { text: '+ Add filter…', attrs: { value: '' } }));
    const used = new Set(state.filters.map((f) => f.field));
    for (const [field, spec] of Object.entries(FILTER_FIELDS)) {
      if (!used.has(field)) add.append(el('option', { text: spec.label, attrs: { value: field } }));
    }
    add.addEventListener('change', () => {
      const filter = emptyFilter(add.value);
      if (filter) { state.filters.push(filter); this.renderBar(); this.renderList(); }
    });
    bar.append(filters, add);
    if (state.type === 'transcriptomics') {
      const arrays = el('input', { attrs: { type: 'checkbox', id: 'peek-arrays' } });
      arrays.checked = state.arrays;
      arrays.addEventListener('change', () => { state.arrays = arrays.checked; this.renderList(); });
      const count = this.datasets.filter((d) => d.record.dataType === 'transcriptomics' && d.record.platform === 'array').length;
      bar.append(el('label', { className: 'checkbox-row', children: [arrays, el('span', { text: ` Include array datasets (${count})` })] }));
    }
    const flat = el('input', { attrs: { type: 'checkbox', id: 'peek-flat' } });
    flat.checked = state.flat;
    flat.addEventListener('change', () => { state.flat = flat.checked; this.renderList(); });
    bar.append(el('label', { className: 'checkbox-row', children: [flat, el('span', { text: ' Flat table' })] }));
    if (state.mode === 'multi') {
      const all = el('button', { className: 'chip-button', text: 'Select all shown', attrs: { type: 'button' } });
      all.addEventListener('click', () => { this.shownDatasets().forEach((d) => state.selected.add(d.id)); this.renderList(); this.renderSide(); });
      const clear = el('button', { className: 'chip-button', text: 'Clear selection', attrs: { type: 'button' } });
      clear.addEventListener('click', () => { state.selected.clear(); this.renderList(); this.renderSide(); });
      bar.append(all, clear);
    }
  }

  filterChip(filter, index) {
    const { state } = this.peek;
    const spec = FILTER_FIELDS[filter.field];
    const wrap = el('span', { className: 'peek-filter' });
    wrap.append(el('b', { text: spec.label }));
    const rerender = () => this.renderList();
    if (spec.kind === 'range') {
      for (const bound of ['min', 'max']) {
        const input = el('input', { attrs: { type: 'number', step: 'any', 'aria-label': `${spec.label} ${bound === 'min' ? 'minimum' : 'maximum'}`, placeholder: bound } });
        if (filter[bound] !== null) input.value = String(filter[bound]);
        input.addEventListener('input', () => { filter[bound] = input.value === '' ? null : Number(input.value); rerender(); });
        wrap.append(bound === 'max' ? ' to ' : ' ', input);
      }
      const missing = el('input', { attrs: { type: 'checkbox', 'aria-label': `${spec.label}: include datasets that do not report it` } });
      missing.checked = filter.includeMissing;
      missing.addEventListener('change', () => { filter.includeMissing = missing.checked; rerender(); });
      wrap.append(el('label', { className: 'checkbox-row', children: [missing, el('span', { text: ' include not reported' })] }));
    } else if (spec.kind === 'text') {
      const input = el('input', { attrs: { type: 'search', 'aria-label': spec.label } });
      input.value = filter.query;
      input.addEventListener('input', () => { filter.query = input.value; rerender(); });
      wrap.append(' ', input);
    } else {
      const values = [...new Set(this.typeDatasets().flatMap(spec.values))].sort();
      for (const value of values) {
        const box = el('input', { attrs: { type: 'checkbox' } });
        box.checked = filter.values.includes(value);
        box.addEventListener('change', () => {
          filter.values = box.checked ? [...filter.values, value] : filter.values.filter((v) => v !== value);
          rerender();
        });
        wrap.append(el('label', { className: 'checkbox-row', children: [box, el('span', { text: ` ${value}` })] }));
      }
    }
    const remove = el('button', { className: 'peek-filter-remove', text: '×', attrs: { type: 'button', 'aria-label': `Remove ${spec.label} filter` } });
    remove.addEventListener('click', () => { state.filters.splice(index, 1); this.renderBar(); this.renderList(); });
    wrap.append(remove);
    return wrap;
  }

  renderLegend() {
    const { legend } = this.peek;
    legend.replaceChildren();
    const entries = [
      ['standard', 'standard regime: 28–32 °C, ≤ 400 µmol, CO₂ ≥ 1%'],
      ['elevated', 'elevated: 36–40 °C, > 400 µmol'],
      ['ambient', 'ambient CO₂'],
      ['outside', 'outside the named regimes'],
    ];
    for (const [regime, text] of entries) {
      const swatch = el('span', { className: 'ds-swatch' });
      swatch.style.background = REGIME_COLOR[regime];
      legend.append(el('span', { children: [swatch, el('span', { text })] }));
    }
    legend.append(el('span', { children: [el('span', { className: 'ds-swatch ds-swatch-hatched' }), el('span', { text: 'not reported, never drawn as zero' })] }));
  }

  selectRow(dataset, on) {
    const { state } = this.peek;
    if (state.mode === 'single') {
      state.selected.clear();
      if (on) state.selected.add(dataset.id);
    } else if (on) state.selected.add(dataset.id);
    else state.selected.delete(dataset.id);
  }

  rowFor(dataset, colors) {
    const { state } = this.peek;
    const row = el('tr', { className: state.selected.has(dataset.id) ? 'ds-selected' : '' });
    row.dataset.id = dataset.id;
    row.style.borderLeft = `4px solid ${colors.get(dataset.record.studyId)}`;
    const box = el('input', { attrs: { type: state.mode === 'single' ? 'radio' : 'checkbox', name: 'ds-pick', 'aria-label': `Show ${dataset.record.studyId}: ${dataset.record.conditionSet}` } });
    box.checked = state.selected.has(dataset.id);
    box.addEventListener('change', () => { this.selectRow(dataset, box.checked); this.renderList(); if (!state.info) this.renderSide(); });
    row.append(el('td', { children: [box] }));
    const name = el('td', { className: 'ds-name' });
    const top = el('div', { className: 'ds-name-top' });
    const id = el('span', { className: 'ds-name-id', children: [el('span', { className: 'ds-acc', text: dataset.record.studyId }), ' ', chip(dataset.record.strain)] });
    const platform = chip(dataset.record.platform, dataset.record.platform === 'array' ? 'ds-chip ds-chip-array' : 'ds-chip',
      dataset.record.platform === 'array' ? 'An array measures a chosen set of targets, not the whole transcriptome' : null);
    id.append(platform);
    const info = el('button', { className: 'ds-info', text: 'i', attrs: { type: 'button', title: 'Source details and citation', 'aria-label': `Source details and citation for ${dataset.record.studyId}: ${dataset.record.conditionSet}` } });
    info.addEventListener('click', () => { state.info = dataset.id; this.renderSide(); });
    top.append(id, info);
    name.append(top, el('span', { className: 'ds-label', text: dataset.record.conditionSet }));
    row.append(name);
    for (const axis of ['temperature', 'lightIntensity', 'co2']) row.append(el('td', { children: [trackCell(dataset, axis)] }));
    row.append(el('td', { children: [regimeCell(dataset)] }), el('td', { children: [mediumCell(dataset)] }), el('td', { children: [phaseCell(dataset)] }));
    const treatments = el('td');
    if (dataset.record.treatments.length) dataset.record.treatments.forEach((t) => treatments.append(chip(t, 'ds-chip ds-chip-wrap')));
    else treatments.append(el('span', { className: 'ds-none', text: 'none recorded' }));
    row.append(treatments);
    return row;
  }

  selectAllBox(datasets, name) {
    const { state } = this.peek;
    const ids = datasets.map((d) => d.id);
    const n = ids.filter((id) => state.selected.has(id)).length;
    const box = el('input', { attrs: { type: 'checkbox', 'aria-label': `Select all in ${name}` } });
    box.checked = n === ids.length;
    box.indeterminate = n > 0 && n < ids.length;
    box.addEventListener('change', () => {
      ids.forEach((id) => (box.checked ? state.selected.add(id) : state.selected.delete(id)));
      this.renderList();
      if (!state.info) this.renderSide();
    });
    return box;
  }

  headerRow(className, { box = null, title, rule = null, note = null }) {
    const row = el('tr', { className });
    const cell = el('th', { attrs: { colspan: 9, scope: 'colgroup' } });
    if (box) cell.append(box, ' ');
    cell.append(el('span', { className: 'ds-group-name', text: title }));
    if (rule) cell.append(el('span', { className: 'ds-group-rule', text: ` — ${rule}` }));
    if (note) cell.append(el('span', { className: 'ds-group-n', text: note }));
    row.append(cell);
    return row;
  }

  renderList() {
    const { list, state, count } = this.peek;
    const shown = this.shownDatasets();
    const colors = studyColors(this.typeDatasets());
    const table = el('table', { className: 'ds-table' });
    const head = el('thead');
    const headRow = el('tr');
    headRow.append(el('th', { attrs: { scope: 'col' }, children: [el('span', { className: 'visually-hidden', text: 'Show' })] }));
    headRow.append(el('th', { attrs: { scope: 'col' }, text: 'Dataset · condition set' }));
    for (const axis of ['temperature', 'lightIntensity', 'co2']) {
      headRow.append(el('th', { attrs: { scope: 'col' }, children: [el('span', { text: CONDITION_SCALES[axis].name }), conditionAxis(axis)] }));
    }
    for (const text of ['Light regime', 'Medium', 'Format · phase', 'Treatments']) headRow.append(el('th', { attrs: { scope: 'col' }, text }));
    head.append(headRow);
    const body = el('tbody');
    if (!shown.length) {
      body.append(el('tr', { children: [el('td', { className: 'ds-empty', text: 'No dataset matches the filters.', attrs: { colspan: 9 } })] }));
    } else if (state.flat) {
      shown.forEach((d) => body.append(this.rowFor(d, colors)));
    } else {
      for (const group of groupDatasets(shown, { judgements: this.judgements })) {
        const studies = new Set(group.datasets.map((d) => d.record.studyId)).size;
        const selected = group.datasets.filter((d) => state.selected.has(d.id)).length;
        body.append(this.headerRow('ds-group', {
          box: group.selectAll && state.mode === 'multi' ? this.selectAllBox(group.datasets, group.name) : null,
          title: group.name,
          rule: group.rule,
          note: `${group.datasets.length} condition set${group.datasets.length === 1 ? '' : 's'} · ${studies} stud${studies === 1 ? 'y' : 'ies'} · ${selected} selected`,
        }));
        if (!group.split) { group.datasets.forEach((d) => body.append(this.rowFor(d, colors))); continue; }
        group.sets.forEach((set, index) => {
          const name = `Comparable set ${index + 1}`;
          body.append(this.headerRow('ds-subgroup', {
            box: state.mode === 'multi' ? this.selectAllBox(set, `${name} of ${group.name}`) : null,
            title: name,
            rule: `${set.length} condition sets · ${summariseSet(set)}`,
          }));
          set.forEach((d) => body.append(this.rowFor(d, colors)));
        });
        if (group.singles.length) {
          body.append(this.headerRow('ds-subgroup', { title: 'No comparable partner in this group', rule: `${group.singles.length} condition set${group.singles.length === 1 ? '' : 's'}, each chosen on its own` }));
          group.singles.forEach((d) => body.append(this.rowFor(d, colors)));
        }
      }
    }
    table.append(head, body);
    const legend = el('div', { className: 'ds-study-legend' });
    legend.append(el('span', { className: 'ds-study-legend-title', text: 'Row colours by study' }));
    for (const dataset of this.typeDatasets()) {
      const study = dataset.record.studyId;
      if (legend.querySelector?.(`span[data-study="${study}"]`)) continue;
      const swatch = el('span', { className: 'ds-swatch' });
      swatch.style.background = colors.get(study);
      const entry = el('span', { className: 'ds-study-entry', attrs: { 'data-study': study } });
      entry.dataset.study = study;
      entry.append(swatch, el('span', { text: `${study}: ${dataset.record.citation?.text ?? 'no publication linked'}` }));
      legend.append(entry);
    }
    list.replaceChildren(table, legend);
    const total = this.typeDatasets().length;
    count.textContent = state.mode === 'multi'
      ? `${shown.length} of ${total} condition sets shown in this tab · ${state.selected.size} selected across all tabs`
      : `${shown.length} of ${total} condition sets shown · choose one`;
  }

  compareRow(label, sub, node) {
    const row = el('div', { className: 'ds-cmp-row' });
    const who = el('span', { className: 'ds-cmp-who', text: label });
    if (sub) who.append(el('small', { text: sub }));
    row.append(who, node);
    return row;
  }

  renderSide() {
    const { side, state } = this.peek;
    side.replaceChildren();
    if (state.info) {
      const dataset = this.datasets.find((d) => d.id === state.info);
      if (dataset) { this.renderInfo(dataset); return; }
    }
    const chosen = this.typeDatasets().filter((d) => state.selected.has(d.id));
    side.append(el('h3', { className: 'ds-side-title', text: `Compare selected (${chosen.length})` }));
    if (!chosen.length) {
      side.append(el('p', { className: 'panel-note', text: 'Tick datasets on the left. Their conditions are laid on one enlarged scale per axis so they can be read against each other. Nothing here decides comparability.' }));
      return;
    }
    for (const axis of ['temperature', 'lightIntensity', 'co2']) {
      const scale = CONDITION_SCALES[axis];
      side.append(el('h4', { text: scale.name }));
      side.append(this.compareRow('', null, conditionAxis(axis, 230)));
      const have = chosen.filter((d) => conditionRange(d, axis));
      for (const d of chosen) {
        const range = conditionRange(d, axis);
        side.append(this.compareRow(d.record.studyId, d.record.conditionSet, range ? conditionTrack(axis, range, d.record.conditions[axis].text, 230, 22) : missingCell(d.record.conditions[axis])));
      }
      const spread = have.length
        ? `${formatRange([Math.min(...have.map((d) => conditionRange(d, axis)[0])), Math.max(...have.map((d) => conditionRange(d, axis)[1]))], scale.unit)} across ${have.length}`
        : 'no value reported';
      side.append(el('p', { className: 'ds-spread', text: `${spread}${have.length < chosen.length ? `; not reported for ${chosen.length - have.length}` : ''}` }));
    }
    side.append(el('h4', { text: 'Everything else' }));
    const table = el('table', { className: 'ds-kv' });
    for (const d of chosen) {
      const row = el('tr');
      const th = el('th', { attrs: { scope: 'row' }, text: d.record.studyId });
      th.append(el('span', { className: 'ds-where', text: d.record.conditionSet }));
      const td = el('td', { children: [regimeCell(d), mediumCell(d), phaseCell(d), el('span', { className: 'ds-where', text: d.record.replicates.text })] });
      row.append(th, td);
      table.append(row);
    }
    side.append(table);
  }

  renderInfo(dataset) {
    const { side, state } = this.peek;
    const back = el('button', { className: 'chip-button', text: '← Back to comparison', attrs: { type: 'button' } });
    back.addEventListener('click', () => { state.info = null; this.renderSide(); });
    side.append(back);
    const { record } = dataset;
    side.append(el('h3', { className: 'ds-side-title', children: [el('span', { text: `${record.studyId} ` }), chip(record.strain), chip(record.platform)] }));
    side.append(el('p', { text: record.conditionSet }));
    side.append(el('h4', { text: 'Conditions as the source reports them' }));
    const table = el('table', { className: 'ds-kv' });
    for (const [axisKey, name] of Object.entries(AXIS_NAMES)) {
      const axis = record.conditions[axisKey];
      const row = el('tr');
      row.append(el('th', { attrs: { scope: 'row' }, text: name }));
      const cell = el('td', { text: axis.text });
      if (axis.quote) cell.append(el('q', { text: axis.quote }));
      if (axis.where) cell.append(el('span', { className: 'ds-where', text: axis.where }));
      if (axis.status !== 'reported') cell.append(el('span', { className: 'ds-where', text: `status: ${axis.status}` }));
      row.append(cell);
      table.append(row);
    }
    const replicates = el('tr', { children: [el('th', { attrs: { scope: 'row' }, text: 'Replicates' }), el('td', { text: record.replicates.text })] });
    table.append(replicates);
    side.append(table);
    side.append(el('h4', { text: 'Source' }));
    if (record.citation) {
      const cite = el('p', { className: 'ds-cite', text: `${record.citation.text} ` });
      cite.append(el('a', { text: 'Open the paper', attrs: { href: record.citation.url, target: '_blank', rel: 'noopener' } }));
      if (record.citation.pmid) cite.append(` · PMID ${record.citation.pmid}`);
      side.append(cite);
    } else {
      side.append(el('p', { className: 'ds-cite', text: 'No publication is linked to this deposit.' }));
    }
    const archive = el('p', { className: 'ds-cite' });
    archive.append(el('a', { text: `Open the archive record ${record.studyId}`, attrs: { href: record.archiveUrl, target: '_blank', rel: 'noopener' } }));
    side.append(archive);
    if (dataset.source?.provenanceDoc) side.append(el('p', { className: 'ds-where', text: `Provenance: ${dataset.source.provenanceDoc}` }));
  }
}
