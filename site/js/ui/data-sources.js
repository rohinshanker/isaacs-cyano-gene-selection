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
 * A study that ships more condition sets than a reader can scan, such as the
 * Fitness Browser's 90, is a compendium: it shows as one row, pooled over all
 * of its sets, and "Choose conditions" opens a second peek stacked over the
 * first holding a grid of checkboxes, compound down the side and dose across
 * (owner decision, 2026-10-07). Peeks are a stack, not a pair: whichever is
 * topmost owns focus and Escape, and everything under it is inert.
 *
 * Nothing drawn here decides comparability: the rows and subgroups are the
 * condition record arranged by `core/data-sources.js`, and an unreported axis is
 * drawn as missing, never as zero.
 */
import {
  CONDITION_SCALES, DATA_TYPES, FILTER_FIELDS, compendiumStudies, conditionGrid, conditionRange,
  datasetChoiceLabel, dataTypeOfMetric, emptyFilter, formatRange, groupDatasets, normalizeSelection, passesFilters,
  regimeOf, studyColors, summariseSet,
} from '../core/data-sources.js';
import { renderSourceToggles } from './legend.js';
import { ConditionGuides } from './condition-guides.js';

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
let PANEL_SERIAL = 0;

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
      if (child.hidden || child.disabled || child.getAttribute?.('tabindex') === '-1') continue;
      if (['BUTTON', 'INPUT', 'SELECT', 'A', 'TEXTAREA'].includes(String(child.tagName).toUpperCase())) out.push(child);
      walk(child);
    }
  };
  walk(root);
  return out;
}

/** Match reading/focus order to responsive footer placement. */
export function arrangePeekBody(body, { list, foot, side }, footerLast) {
  const order = footerLast ? [list, side, foot] : [list, foot, side];
  if (order.every((node, index) => body.children[index] === node)) return;
  const active = body.contains(document.activeElement) ? document.activeElement : null;
  body.insertBefore(foot, footerLast ? null : side);
  if (active && document.activeElement !== active) active.focus({ preventScroll: true });
  const pane = list.contains(active) ? list : side.contains(active) ? side : null;
  if (!pane || !active?.getBoundingClientRect || !pane.getBoundingClientRect) return;
  const target = active.getBoundingClientRect();
  const visible = pane.getBoundingClientRect();
  const header = pane === list ? list.querySelector('thead')?.querySelector('th') : null;
  const top = Math.max(visible.top + (pane.clientTop ?? 0),
    header?.getBoundingClientRect?.().bottom ?? visible.top);
  const bottom = pane.clientHeight === undefined ? visible.bottom
    : visible.top + (pane.clientTop ?? 0) + pane.clientHeight;
  const left = visible.left + (pane.clientLeft ?? 0);
  const right = pane.clientWidth === undefined ? visible.right
    : visible.left + (pane.clientLeft ?? 0) + pane.clientWidth;
  const row = pane === list ? active.closest?.('tr') : null;
  const rowBounds = row?.getBoundingClientRect?.();
  const context = rowBounds && rowBounds.height <= bottom - top ? rowBounds : target;
  // Reflow can move a control below the viewport even without detaching its pane.
  // Leave one pixel inside the usable area to accommodate integer scroll rounding.
  if (context.top < top) pane.scrollTop = Math.floor(pane.scrollTop + context.top - top - 1);
  else if (context.bottom > bottom) pane.scrollTop = Math.ceil(pane.scrollTop + context.bottom - bottom + 1);
  if (target.left < left) pane.scrollLeft = Math.floor(pane.scrollLeft + target.left - left - 1);
  else if (target.right > right) pane.scrollLeft = Math.ceil(pane.scrollLeft + target.right - right + 1);
}

/** Keep keyboard focus inside a peek when a focused control is replaced. */
function restoreAfterRender(root, fallback) {
  const active = document.activeElement;
  if (!root.contains(active)) return () => {};
  const identity = (node) => `${node.tagName}:${node.getAttribute('aria-label')
    ?? node.getAttribute('id') ?? node.textContent}`;
  const key = identity(active);
  return () => {
    const controls = focusables(root);
    (controls.find((node) => identity(node) === key) ?? fallback ?? controls[0])
      ?.focus({ preventScroll: true });
  };
}

/**
 * The section and the peek. One instance per page; `update` re-renders the
 * section from the current selection, `open` shows the peek.
 */
export class DataSourcesPanel {
  /**
   * @param {HTMLElement} host the toolbar row the section renders into.
   * @param {{datasets: object[], judgements?: object[], onChange?: function(string[]): void,
   *   wholeStrainDatasets?: object[], wholeStrainSelection?: string[],
   *   onWholeStrainChange?: function(string[]): void,
   *   storage?: {getItem: function, setItem: function}|null, section?: boolean}} options
   */
  constructor(host, {
    datasets, judgements = [], onChange, wholeStrainDatasets = [], wholeStrainSelection = [],
    onWholeStrainChange, storage = null, section = true,
  }) {
    this.host = host;
    this.datasets = datasets;
    this.judgements = judgements;
    this.onChange = onChange;
    this.wholeStrainDatasets = wholeStrainDatasets;
    this.wholeStrainSelection = wholeStrainSelection;
    this.onWholeStrainChange = onWholeStrainChange;
    this.storage = storage;
    this.selection = normalizeSelection([], datasets);
    this.colorMetricKey = null;
    this.annotation = null;
    this.agreement = { state: 'absent', value: null, error: null, retry: null };
    this.hidden = this.readHidden();
    this.peek = null;
    this.gridPeek = null;
    /** Open modals, outermost first; the last entry owns focus and Escape. */
    this.modals = [];
    this.compendia = compendiumStudies(datasets);
    this.idPrefix = `data-selection-${++PANEL_SERIAL}`;
    this.sectionEnabled = section;
    if (section) this.build();
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
    this.annotationExplanation = el('p', { className: 'data-sources-annotation-explanation' });
    this.annotationExplanation.hidden = true;
    this.changeButton = el('button', { className: 'chip-button data-sources-change', text: 'Change Data Selection', attrs: { type: 'button' } });
    this.changeButton.addEventListener('click', () => this.open({ opener: this.changeButton }));
    this.actions = el('div', { className: 'data-sources-actions', children: [this.changeButton] });
    this.details.append(
      this.summary, this.toggles, this.annotationExplanation, this.list, this.actions,
    );
    this.hideButton = el('button', { className: 'chip-button data-sources-hide', attrs: { type: 'button' } });
    this.hideButton.addEventListener('click', () => {
      this.hidden = !this.hidden;
      this.writeHidden(this.hidden);
      this.renderSection();
    });
    this.host.append(this.details, this.hideButton);
    if (this.sectionEnabled) this.renderSection();
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
  update({
    selection, colorMetricKey = this.colorMetricKey, annotation = null, informing = null,
    wholeStrainSelection = null, agreement = this.agreement,
  } = {}) {
    if (selection) this.selection = normalizeSelection(selection, this.datasets);
    this.colorMetricKey = colorMetricKey;
    this.annotation = annotation;
    this.agreement = agreement;
    if (Array.isArray(wholeStrainSelection)) this.wholeStrainSelection = wholeStrainSelection;
    // `{typeOf(dataset) → {key, label}, chosen(typeKey) → dataset|null, onInform(typeKey, id)}`:
    // which dataset informs each type metric, chosen here when a type has
    // more than one selected dataset.
    this.informing = informing;
    if (this.sectionEnabled) this.renderSection();
    // Later-tier evidence can settle while the picker is open. Keep its side
    // panel on the same file state as the rest of the page so loading, failure,
    // retry, and success never leave stale agreement copy on screen.
    if (this.peek) this.renderSide();
  }

  /**
   * Whether the colouring metric has a data selection behind it: a dataset
   * metric, or function category with its annotation sources. A computed
   * metric such as GC3 has none, and the section is not shown for it
   * (owner decision, 2026-10-06).
   */
  relevant() {
    if (this.annotation) return true;
    return this.wholeStrainDatasets.length > 0
      || Boolean(dataTypeOfMetric(this.colorMetricKey, this.datasets));
  }

  selectedDatasets() {
    const chosen = new Set(this.selection);
    return this.datasets.filter((d) => chosen.has(d.id));
  }

  /** Explicit whole-strain choices; never inferred from per-gene source rows. */
  renderWholeStrainRows() {
    if (this.wholeStrainDatasets.length === 0) return;
    this.list.append(el('li', {
      className: 'data-sources-type', text: 'Whole-strain fitness (separate from gene metrics)',
    }));
    const selected = new Set(this.wholeStrainSelection);
    for (const dataset of this.wholeStrainDatasets) {
      const item = el('li', { className: 'data-sources-item data-sources-whole-strain' });
      item.dataset.id = dataset.id;
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = selected.has(dataset.id);
      input.setAttribute('aria-label', `Select whole-strain fitness dataset ${dataset.label}`);
      input.addEventListener('change', () => {
        if (input.checked) selected.add(dataset.id); else selected.delete(dataset.id);
        this.wholeStrainSelection = this.wholeStrainDatasets
          .filter((entry) => selected.has(entry.id)).map((entry) => entry.id);
        this.onWholeStrainChange?.([...this.wholeStrainSelection]);
        // The app callback synchronously rerenders all shared controls. Rebuild
        // once more from the settled selection, then return keyboard focus to
        // the checkbox that initiated the change rather than dropping it on
        // the document body.
        this.renderSection();
        const replacement = [...this.list.querySelectorAll('li.data-sources-whole-strain')]
          .find((row) => row.dataset.id === dataset.id)?.querySelector('input');
        replacement?.focus({ preventScroll: true });
      });
      item.append(input, ' ', el('span', { className: 'data-sources-acc', text: dataset.id }),
        ' ', el('span', { className: 'data-sources-label', text: dataset.label }));
      if (input.checked) item.append(' ', chip('shared whole-strain choice', 'ds-chip ds-chip-active'));
      this.list.append(item);
    }
  }

  renderSection() {
    // Shown only where a data selection informs the colour: a dataset with no
    // measured source has nothing to choose among, and a computed metric has
    // no source behind it.
    this.host.hidden = !this.relevant();
    this.toggles.replaceChildren();
    this.list.replaceChildren();
    this.annotationExplanation.hidden = true;
    this.annotationExplanation.textContent = '';
    if (this.annotation) {
      const { toggles, sources, onToggle, explanation } = this.annotation;
      const names = toggles.filter((t) => sources.includes(t.id)).map((t) => t.label);
      const base = `Data Sources (${names.length ? names.join(', ') : 'no annotation source'})`;
      this.summary.textContent = this.wholeStrainDatasets.length
        ? base.replace(/\)$/, `; ${this.wholeStrainSelection.length} whole-strain selected)`)
        : base;
      this.toggles.append(renderSourceToggles(sources, onToggle, toggles));
      this.annotationExplanation.textContent = explanation;
      this.annotationExplanation.hidden = !explanation;
      this.renderWholeStrainRows();
      this.actions.hidden = true;
      this.details.hidden = this.hidden;
      this.hideButton.textContent = this.hidden ? 'Show Data Sources' : 'Hide';
      this.hideButton.setAttribute('aria-expanded', String(!this.hidden));
      return;
    }
    this.actions.hidden = false;
    const chosen = this.selectedDatasets();
    const chosenIds = new Set(chosen.map((d) => d.id));
    const colorType = this.informing?.colorTypeKey ?? null;
    const forType = colorType ? this.informing.allOfType(colorType) : [];
    const kindLabel = forType.length ? this.informing.typeOf(forType[0]).label : null;
    const included = forType.filter((d) => chosenIds.has(d.id));
    const baseSummary = colorType
      ? `Data Sources (${included.length} of ${forType.length} for ${kindLabel}; ${chosen.length} selected in all)`
      : `Data Sources (${chosen.length} selected)`;
    this.summary.textContent = this.wholeStrainDatasets.length
      ? baseSummary.replace(/\)$/, `; ${this.wholeStrainSelection.length} whole-strain selected)`)
      : baseSummary;

    this.renderWholeStrainRows();

    // The colouring type first: every dataset of it, included or not (owner
    // report, 2026-10-06), with inclusion edited here and the one that informs
    // the type alone chosen among the included.
    const rendered = new Set();
    if (colorType && forType.length) {
      this.list.append(el('li', { className: 'data-sources-type', text: `${kindLabel}: ${included.length} of ${forType.length} included` }));
      const named = this.informing.chosen(colorType);
      // A fold change, a p-value and a translation-efficiency ratio each belong
      // to one contrast evaluated by one method, so this kind offers no pooled
      // row: one included dataset is read, and the row says which it is.
      const pools = this.informing.poolsType?.(colorType) ?? true;
      if (!pools && included.length > 1) {
        this.list.append(el('li', {
          className: 'data-sources-note',
          text: `These values do not pool: one of the ${included.length} included datasets is read, `
            + 'because a fold change, a p-value and a translation-efficiency ratio each belong to '
            + 'one contrast evaluated by one method.',
        }));
      }
      if (pools && included.length > 1) {
        const row = el('li', { className: 'data-sources-item data-sources-pooled' });
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = `ds-inform-${colorType}`;
        radio.id = `ds-inform-${colorType}-pooled`;
        radio.checked = !named;
        radio.setAttribute('aria-label', `Pool the ${included.length} included datasets for ${kindLabel}`);
        radio.addEventListener('change', () => { if (radio.checked) this.informing.onInform(colorType, null); });
        row.append(radio, ' ', el('span', { className: 'data-sources-label', text: `Pooled: ${kindLabel} over ${included.length} datasets` }));
        if (!named) row.append(' ', chip('colouring the map', 'ds-chip ds-chip-active'));
        this.list.append(row);
      }
      const renderOne = (dataset) => {
        rendered.add(dataset.id);
        const item = el('li', { className: 'data-sources-item' });
        item.dataset.id = dataset.id;
        const include = document.createElement('input');
        include.type = 'checkbox';
        include.id = `ds-include-${dataset.id}`;
        include.checked = chosenIds.has(dataset.id);
        include.setAttribute('aria-label', `Include ${dataset.record.studyId} ${datasetChoiceLabel(dataset)}`);
        include.addEventListener('change', () => this.informing.onSelect(dataset.id, include.checked));
        item.append(include, ' ');
        if (include.checked && included.length > 1) {
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = `ds-inform-${colorType}`;
          radio.id = `ds-inform-${colorType}-${dataset.id}`;
          radio.checked = named?.id === dataset.id;
          radio.setAttribute('aria-label', `${dataset.record.studyId} ${datasetChoiceLabel(dataset)} alone informs ${kindLabel}`);
          radio.addEventListener('change', () => { if (radio.checked) this.informing.onInform(colorType, dataset.id); });
          item.append(radio, ' ');
        }
        item.append(el('span', { className: 'data-sources-acc', text: dataset.record.studyId }), ' ',
          el('span', { className: 'data-sources-label', text: datasetChoiceLabel(dataset) }));
        if (dataset.record.group === 'engineered') item.append(' ', chip('engineered strain', 'ds-chip'));
        if (include.checked && (named ? named.id === dataset.id : included.length === 1)) {
          item.append(' ', chip('colouring the map', 'ds-chip ds-chip-active'));
        }
        this.list.append(item);
      };
      // A compendium is one row here too, by owner decision of 2026-10-07: its
      // 90 condition sets are pooled and a reader who wants a subset opens the
      // grid rather than scrolling ninety checkboxes in the toolbar.
      this.walkCollapsed(forType, {
        onOne: renderOne,
        onGroup: (study, members) => {
          members.forEach((d) => rendered.add(d.id));
          this.list.append(this.compendiumItem(study, members, chosenIds, kindLabel));
        },
      });
    }

    // Everything else selected, by data type, as a record of the selection.
    const rest = chosen.filter((d) => !rendered.has(d.id));
    if (!chosen.length && !forType.length) {
      this.list.append(el('li', { className: 'data-sources-empty', text: 'No per-gene data source selected.' }));
    }
    for (const type of DATA_TYPES) {
      const ofType = rest.filter((d) => d.record.dataType === type.id);
      if (!ofType.length) continue;
      this.list.append(el('li', { className: 'data-sources-type', text: colorType ? `Also selected: ${type.name}` : type.name }));
      this.walkCollapsed(ofType, {
        onOne: (dataset) => {
          const item = el('li', { className: 'data-sources-item' });
          item.dataset.id = dataset.id;
          item.append(el('span', { className: 'data-sources-acc', text: dataset.record.studyId }), ' ',
            el('span', { className: 'data-sources-label', text: datasetChoiceLabel(dataset) }));
          if (dataset.record.group === 'engineered') item.append(' ', chip('engineered strain', 'ds-chip'));
          if (dataset.metricKey === this.colorMetricKey) item.append(' ', chip('colouring the map', 'ds-chip ds-chip-active'));
          this.list.append(item);
        },
        onGroup: (study, members) => {
          const item = el('li', { className: 'data-sources-item data-sources-compendium' });
          item.dataset.study = study;
          item.append(el('span', { className: 'data-sources-acc', text: study }), ' ',
            el('span', { className: 'data-sources-label', text: `${members.length} condition sets, pooled` }));
          this.list.append(item);
        },
      });
    }
    this.details.hidden = this.hidden;
    this.hideButton.textContent = this.hidden ? 'Show Data Sources' : 'Hide';
    this.hideButton.setAttribute('aria-expanded', String(!this.hidden));
  }

  /**
   * The compendium's single row in the Data Sources section: one include box
   * covering every condition set it ships, a note of how many are in, and the
   * button that opens the grid. It carries no "alone informs" radio, because a
   * pooled compendium is not one dataset to promote.
   */
  compendiumItem(study, members, chosenIds, kindLabel) {
    const ids = members.map((d) => d.id);
    const on = ids.filter((id) => chosenIds.has(id)).length;
    const item = el('li', { className: 'data-sources-item data-sources-compendium' });
    item.dataset.study = study;
    const include = document.createElement('input');
    include.type = 'checkbox';
    include.id = `ds-include-${study}`;
    include.checked = on === ids.length;
    include.indeterminate = on > 0 && on < ids.length;
    include.setAttribute('aria-label', `Include all ${members.length} conditions of ${study} for ${kindLabel}`);
    include.addEventListener('change', () => {
      ids.forEach((id) => this.informing.onSelect(id, include.checked));
    });
    item.append(include, ' ',
      el('span', { className: 'data-sources-acc', text: study }), ' ',
      el('span', { className: 'data-sources-label', text: `${members.length} condition sets, pooled` }));
    item.append(' ', chip(on === ids.length ? 'all conditions' : `${on} of ${members.length}`, 'ds-chip'));
    const choose = el('button', { className: 'chip-button ds-choose', text: 'Choose conditions', attrs: { type: 'button' } });
    choose.addEventListener('click', async () => {
      const picked = await this.openGrid(study, members, { chosen: ids.filter((id) => chosenIds.has(id)), opener: choose });
      if (!picked) return;
      ids.forEach((id) => this.informing.onSelect(id, picked.has(id)));
    });
    item.append(' ', choose);
    return item;
  }

  /**
   * Open the peek. In `multi` mode the global selection is edited in place and
   * handed to `onChange` on Done. `subset` edits only `candidateIds` and
   * resolves to their selected dataset ids without touching the global panel.
   * In `single` mode the reader picks one dataset and receives its metric key.
   *
   * @param {{mode?: 'multi'|'subset'|'single', dataType?: string|null,
   *   opener?: HTMLElement|null, title?: string, current?: string|string[]|null,
   *   candidateIds?: string[]|null}} options
   * @returns {Promise<string[]|string|null>}
   */
  open({
    mode = 'multi', dataType = null, opener = null, title = null, current = null,
    candidateIds = null,
  } = {}) {
    if (!this.peek) this.peek = this.buildPeek();
    const peek = this.peek;
    if (peek.active) peek.settle(null);
    const allowed = Array.isArray(candidateIds) ? new Set(candidateIds) : null;
    const candidates = allowed ? this.datasets.filter((dataset) => allowed.has(dataset.id)) : this.datasets;
    const fallbackType = dataType ?? dataTypeOfMetric(this.colorMetricKey, candidates)
      ?? candidates[0]?.record?.dataType ?? DATA_TYPES[0].id;
    const selected = mode === 'multi' ? this.selection
      : mode === 'subset' ? (Array.isArray(current) ? current : [])
        : current ? [current] : [];
    peek.state = {
      mode,
      type: fallbackType,
      selected: new Set(selected),
      allowed,
      filters: [],
      arrays: mode === 'subset' && candidates.some((dataset) => dataset.record.platform === 'array'),
      flat: false,
      info: null,
    };
    peek.title.textContent = title ?? (mode === 'multi' ? 'Data selection' : 'Select a source');
    peek.done.textContent = mode === 'single' ? 'Use this source'
      : mode === 'subset' ? 'Use these datasets' : 'Done';
    this.renderPeek();
    this.pushModal(peek);
    const opening = opener ?? (typeof document.activeElement?.focus === 'function' ? document.activeElement : null);
    return new Promise((resolve) => {
      peek.active = { resolve, opener: opening };
      peek.close.focus();
    });
  }

  /**
   * Apply the modal stack to the document.
   *
   * With any modal open, every top-level region that is not one of their
   * backdrops is inert. Within the stack only the topmost dialog is live: the
   * ones beneath it are inert too, so Tab and the screen reader stay in the
   * peek the reader is actually looking at, while their backdrops keep dimming
   * the page. With nothing open the page is handed back untouched.
   */
  applyModals() {
    const open = this.modals;
    const backdrops = new Set(open.map((modal) => modal.backdrop));
    for (const node of document.body.children ?? []) {
      if (backdrops.has(node)) {
        node.removeAttribute?.('inert');
        node.removeAttribute?.('aria-hidden');
        continue;
      }
      if (open.length) {
        node.setAttribute('inert', '');
        node.setAttribute('aria-hidden', 'true');
      } else {
        node.removeAttribute?.('inert');
        node.removeAttribute?.('aria-hidden');
      }
    }
    open.forEach((modal, index) => {
      const topmost = index === open.length - 1;
      if (topmost) {
        modal.dialog.removeAttribute?.('inert');
        modal.dialog.removeAttribute?.('aria-hidden');
      } else {
        modal.dialog.setAttribute('inert', '');
        modal.dialog.setAttribute('aria-hidden', 'true');
      }
    });
  }

  /** Put a modal on top of the stack and show it. */
  pushModal(modal) {
    if (!this.modals.includes(modal)) this.modals.push(modal);
    modal.backdrop.hidden = false;
    this.applyModals();
  }

  /** Take a modal off the stack and hide it, whatever its position. */
  popModal(modal) {
    const at = this.modals.indexOf(modal);
    if (at >= 0) this.modals.splice(at, 1);
    modal.backdrop.hidden = true;
    this.applyModals();
  }

  /** True while this modal is the one the reader is working in. */
  isTopModal(modal) {
    return this.modals[this.modals.length - 1] === modal;
  }

  buildPeek() {
    const backdrop = el('div', { className: 'peek-backdrop data-selection-backdrop' });
    backdrop.hidden = true;
    const titleId = `${this.idPrefix}-title`;
    const dialog = el('div', { className: 'peek data-selection', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId } });
    const title = el('h2', { className: 'peek-title', text: 'Data selection', attrs: { id: titleId } });
    const tabs = el('div', { className: 'peek-tabs', attrs: { role: 'tablist', 'aria-label': 'Data type' } });
    const close = el('button', { className: 'chip-button peek-close', text: 'Close', attrs: { type: 'button', 'aria-label': 'Close data selection' } });
    const head = el('div', { className: 'peek-head', children: [title, tabs, close] });
    const bar = el('div', { className: 'peek-bar' });
    const legend = el('div', { className: 'peek-legend' });
    const list = el('div', { className: 'peek-list', attrs: { 'aria-label': 'Datasets' } });
    const side = el('div', { className: 'peek-side', attrs: { 'aria-live': 'polite' } });
    const count = el('span', { className: 'peek-count' });
    const done = el('button', { className: 'chip-button active peek-done', text: 'Done', attrs: { type: 'button' } });
    const foot = el('div', { className: 'peek-foot', children: [count, done] });
    const body = el('div', { className: 'peek-body', children: [list, foot, side] });
    const stacked = globalThis.window?.matchMedia?.('(max-width: 1320px)');
    const phone = globalThis.window?.matchMedia?.('(max-width: 600px)');
    const arrange = () => arrangePeekBody(body, { list, foot, side },
      stacked ? (!stacked.matches || phone?.matches)
        : ((globalThis.window?.innerWidth ?? 0) > 1320
          || (globalThis.window?.innerWidth ?? Infinity) <= 600));
    if (stacked?.addEventListener) stacked.addEventListener('change', arrange);
    else globalThis.window?.addEventListener?.('resize', arrange);
    phone?.addEventListener?.('change', arrange);
    arrange();
    dialog.append(head, bar, legend, body);
    backdrop.append(dialog);
    document.body.append(backdrop);

    const guides = new ConditionGuides({ dialog, list, count });
    const peek = { backdrop, dialog, title, tabs, close, bar, legend, list, side, count, done, guides, active: null, state: null };
    peek.settle = (answer) => {
      if (!peek.active) return;
      const { resolve, opener } = peek.active;
      peek.active = null;
      guides.clear();
      this.popModal(peek);
      if (typeof opener?.focus === 'function') opener.focus({ preventScroll: true });
      resolve(answer);
    };
    close.addEventListener('click', () => peek.settle(null));
    done.addEventListener('click', () => this.finish());
    backdrop.addEventListener('pointerdown', (event) => {
      if (event.target === backdrop && this.isTopModal(peek)) peek.settle(null);
    });
    dialog.addEventListener('keydown', (event) => {
      // A peek stacked on top owns the keyboard until it closes.
      if (!this.isTopModal(peek)) return;
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

  /** The compendium a dataset belongs to, or null for an ordinary study. */
  compendiumOf(dataset) {
    // Declared omics fields include replicates and distinct statistical bases,
    // not a compound/dose compendium. Keep their source choices individually
    // visible, including the one informing a non-pooling quantity.
    if (dataset.source?.quantity != null) return null;
    const study = dataset.record.studyId;
    return this.compendia.has(study) ? study : null;
  }

  /**
   * Walk a list of datasets in order, handing each compendium to `onGroup`
   * once, at the position of its first member, and every other dataset to
   * `onOne`. Order is otherwise preserved, so a collapsed study sits where its
   * rows would have started rather than being hoisted somewhere else.
   */
  walkCollapsed(datasets, { onOne, onGroup }) {
    const members = new Map();
    for (const dataset of datasets) {
      const study = this.compendiumOf(dataset);
      if (!study) continue;
      if (!members.has(study)) members.set(study, []);
      members.get(study).push(dataset);
    }
    const done = new Set();
    for (const dataset of datasets) {
      const study = this.compendiumOf(dataset);
      if (!study) { onOne(dataset); continue; }
      if (done.has(study)) continue;
      done.add(study);
      onGroup(study, members.get(study));
    }
  }

  /**
   * Build the stacked grid peek once. It is a second modal over the data
   * selection, not a replacement for it: the selection stays on screen behind,
   * dimmed and inert, and closing this one hands the reader back to it.
   */
  buildGridPeek() {
    const backdrop = el('div', { className: 'peek-backdrop peek-backdrop-stacked' });
    backdrop.hidden = true;
    const titleId = `${this.idPrefix}-condition-grid-title`;
    const dialog = el('div', { className: 'peek condition-grid', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId } });
    const title = el('h2', { className: 'peek-title', text: 'Choose conditions', attrs: { id: titleId } });
    const close = el('button', { className: 'chip-button peek-close', text: 'Close', attrs: { type: 'button', 'aria-label': 'Close the condition grid' } });
    const head = el('div', { className: 'peek-head', children: [title, close] });
    const note = el('p', { className: 'cg-note' });
    const bar = el('div', { className: 'cg-bar' });
    const body = el('div', { className: 'cg-body', attrs: { 'aria-label': 'Conditions by compound and dose' } });
    const count = el('span', { className: 'peek-count' });
    const done = el('button', { className: 'chip-button active peek-done', text: 'Done', attrs: { type: 'button' } });
    const foot = el('div', { className: 'peek-foot', children: [count, done] });
    dialog.append(head, note, bar, body, foot);
    backdrop.append(dialog);
    document.body.append(backdrop);

    const grid = { backdrop, dialog, title, note, bar, body, count, done, close, active: null, state: null };
    grid.settle = (answer) => {
      if (!grid.active) return;
      const { resolve, opener } = grid.active;
      grid.active = null;
      this.popModal(grid);
      if (typeof opener?.focus === 'function') opener.focus({ preventScroll: true });
      resolve(answer);
    };
    close.addEventListener('click', () => grid.settle(null));
    done.addEventListener('click', () => {
      const chosen = new Set(grid.state.chosen);
      grid.settle(chosen);
    });
    backdrop.addEventListener('pointerdown', (event) => {
      if (event.target === backdrop && this.isTopModal(grid)) grid.settle(null);
    });
    dialog.addEventListener('keydown', (event) => {
      if (!this.isTopModal(grid)) return;
      if (event.key === 'Escape') { event.preventDefault(); grid.settle(null); return; }
      if (event.key !== 'Tab') return;
      const order = focusables(dialog);
      if (!order.length) return;
      const index = order.indexOf(document.activeElement);
      const first = order[0];
      const last = order[order.length - 1];
      if (event.shiftKey && index <= 0) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (index === -1 || index === order.length - 1)) { event.preventDefault(); first.focus(); }
    });
    return grid;
  }

  /**
   * Open the grid over whatever is already open and resolve to the chosen ids,
   * or to null if the reader backed out.
   *
   * @returns {Promise<Set<string>|null>}
   */
  openGrid(study, members, { chosen, opener = null } = {}) {
    if (!this.gridPeek) this.gridPeek = this.buildGridPeek();
    const grid = this.gridPeek;
    if (grid.active) grid.settle(null);
    grid.state = { study, members, layout: conditionGrid(members), chosen: new Set(chosen) };
    grid.title.textContent = `${study}: choose conditions`;
    this.renderGrid();
    this.pushModal(grid);
    return new Promise((resolve) => {
      grid.active = { resolve, opener: opener ?? (typeof document.activeElement?.focus === 'function' ? document.activeElement : null) };
      grid.close.focus();
    });
  }

  /** One checkbox per condition: compound down the side, dose across. */
  renderGrid() {
    const grid = this.gridPeek;
    const { members, layout, chosen } = grid.state;
    const restore = restoreAfterRender(grid.body, grid.close);
    grid.note.textContent = `${members.length} conditions from one study. Rows are compounds, columns are the doses that compound was tested at, so a row is as wide as that compound has doses.`;

    grid.bar.replaceChildren();
    const all = el('button', { className: 'chip-button', text: 'Select all', attrs: { type: 'button' } });
    all.addEventListener('click', () => { members.forEach((d) => chosen.add(d.id)); this.renderGrid(); });
    const none = el('button', { className: 'chip-button', text: 'Clear all', attrs: { type: 'button' } });
    none.addEventListener('click', () => { chosen.clear(); this.renderGrid(); });
    grid.bar.append(all, none);

    const cell = (dataset, label) => {
      const wrap = el('label', { className: chosen.has(dataset.id) ? 'cg-cell cg-on' : 'cg-cell' });
      const box = el('input', { attrs: { type: 'checkbox', 'aria-label': `${datasetChoiceLabel(dataset)}` } });
      box.checked = chosen.has(dataset.id);
      box.addEventListener('change', () => {
        if (box.checked) chosen.add(dataset.id); else chosen.delete(dataset.id);
        this.renderGrid();
      });
      wrap.append(box, el('span', { className: 'cg-dose', text: label }));
      return wrap;
    };

    const table = el('div', { className: 'cg-grid' });
    for (const row of layout.compounds) {
      const line = el('div', { className: 'cg-row' });
      const on = row.cells.filter((c) => chosen.has(c.dataset.id)).length;
      const head = el('div', { className: 'cg-rowhead' });
      const box = el('input', { attrs: { type: 'checkbox', 'aria-label': `Select every dose of ${row.compound}` } });
      box.checked = on === row.cells.length;
      box.indeterminate = on > 0 && on < row.cells.length;
      box.addEventListener('change', () => {
        row.cells.forEach((c) => (box.checked ? chosen.add(c.dataset.id) : chosen.delete(c.dataset.id)));
        this.renderGrid();
      });
      head.append(box, el('span', { className: 'cg-compound', text: row.compound }));
      line.append(head);
      const cells = el('div', { className: 'cg-cells' });
      row.cells.forEach((c) => cells.append(cell(c.dataset, c.dose)));
      line.append(cells);
      table.append(line);
    }
    if (layout.loose.length) {
      const line = el('div', { className: 'cg-row cg-row-loose' });
      line.append(el('div', { className: 'cg-rowhead', children: [el('span', { className: 'cg-compound', text: 'No added compound' })] }));
      const cells = el('div', { className: 'cg-cells' });
      layout.loose.forEach((d) => cells.append(cell(d, datasetChoiceLabel(d))));
      line.append(cells);
      table.append(line);
    }
    grid.body.replaceChildren(table);
    const picked = members.filter((d) => chosen.has(d.id)).length;
    grid.count.textContent = picked === members.length
      ? `All ${members.length} conditions selected, pooled`
      : `${picked} of ${members.length} conditions selected`;
    restore();
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
    if (mode === 'subset') {
      const next = this.datasets.filter((dataset) => selected.has(dataset.id)).map((dataset) => dataset.id);
      peek.settle(next);
      return;
    }
    const id = [...selected][0] ?? null;
    peek.settle(id ? this.datasets.find((d) => d.id === id)?.metricKey ?? null : null);
  }

  typeDatasets() {
    const { type, allowed } = this.peek.state;
    return this.datasets.filter((dataset) => dataset.record.dataType === type
      && (!allowed || allowed.has(dataset.id)));
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
    const restore = restoreAfterRender(tabs);
    tabs.replaceChildren();
    const types = state.allowed ? DATA_TYPES.filter((type) => this.datasets.some((dataset) =>
      dataset.record.dataType === type.id && state.allowed.has(dataset.id))) : DATA_TYPES;
    for (const type of types) {
      const n = this.datasets.filter((dataset) => dataset.record.dataType === type.id
        && (!state.allowed || state.allowed.has(dataset.id))).length;
      const tab = el('button', { className: 'chip-button peek-tab', text: `${type.name} (${n})`, attrs: { type: 'button', role: 'tab', tabindex: state.type === type.id ? 0 : -1, 'aria-selected': String(state.type === type.id) } });
      if (state.type === type.id) tab.classList.add('active');
      tab.addEventListener('click', () => {
        state.type = type.id;
        state.filters = [];
        state.info = null;
        this.renderPeek();
      });
      tab.addEventListener('keydown', (event) => {
        const index = types.indexOf(type);
        const next = event.key === 'ArrowRight' ? (index + 1) % types.length
          : event.key === 'ArrowLeft' ? (index + types.length - 1) % types.length
            : event.key === 'Home' ? 0 : event.key === 'End' ? types.length - 1 : null;
        if (next === null) return;
        event.preventDefault();
        state.type = types[next].id;
        state.filters = [];
        state.info = null;
        this.renderPeek();
        tabs.querySelector('.active').focus({ preventScroll: true });
      });
      tabs.append(tab);
    }
    restore();
  }

  renderBar() {
    const { bar, state } = this.peek;
    const restore = restoreAfterRender(bar);
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
      const arrays = el('input', {
        attrs: { type: 'checkbox', id: `${this.idPrefix}-peek-arrays` },
      });
      arrays.checked = state.arrays;
      arrays.addEventListener('change', () => { state.arrays = arrays.checked; this.renderList(); });
      const count = this.typeDatasets().filter((dataset) => dataset.record.platform === 'array').length;
      bar.append(el('label', { className: 'checkbox-row', children: [arrays, el('span', { text: ` Include array datasets (${count})` })] }));
    }
    const flat = el('input', {
      attrs: { type: 'checkbox', id: `${this.idPrefix}-peek-flat` },
    });
    flat.checked = state.flat;
    flat.addEventListener('change', () => { state.flat = flat.checked; this.renderList(); });
    bar.append(el('label', { className: 'checkbox-row', children: [flat, el('span', { text: ' Flat table' })] }));
    if (state.mode !== 'single') {
      const all = el('button', { className: 'chip-button', text: 'Select all shown', attrs: { type: 'button' } });
      all.addEventListener('click', () => { this.shownDatasets().forEach((d) => state.selected.add(d.id)); this.renderList(); this.renderSide(); });
      const clear = el('button', { className: 'chip-button', text: 'Clear selection', attrs: { type: 'button' } });
      clear.addEventListener('click', () => { state.selected.clear(); this.renderList(); this.renderSide(); });
      bar.append(all, clear);
    }
    restore();
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
    const box = el('input', { attrs: { type: state.mode === 'single' ? 'radio' : 'checkbox', name: 'ds-pick', 'aria-label': `Show ${dataset.record.studyId}: ${datasetChoiceLabel(dataset)}` } });
    box.checked = state.selected.has(dataset.id);
    box.addEventListener('change', () => { this.selectRow(dataset, box.checked); this.renderList(); if (!state.info) this.renderSide(); });
    row.append(el('td', { children: [box] }));
    const name = el('td', { className: 'ds-name' });
    const top = el('div', { className: 'ds-name-top' });
    const id = el('span', { className: 'ds-name-id', children: [el('span', { className: 'ds-acc', text: dataset.record.studyId }), ' ', chip(dataset.record.strain)] });
    const platform = chip(dataset.record.platform, dataset.record.platform === 'array' ? 'ds-chip ds-chip-array' : 'ds-chip',
      dataset.record.platform === 'array' ? 'An array measures a chosen set of targets, not the whole transcriptome' : null);
    id.append(platform);
    const info = el('button', { className: 'ds-info', text: 'i', attrs: { type: 'button', title: 'Source details and citation', 'aria-label': `Source details and citation for ${dataset.record.studyId}: ${datasetChoiceLabel(dataset)}` } });
    info.addEventListener('click', () => { state.info = dataset.id; state.infoOpener = info; this.renderSide(); });
    top.append(id, info);
    name.append(top, el('span', { className: 'ds-label', text: datasetChoiceLabel(dataset) }));
    row.append(name);
    for (const axis of ['temperature', 'lightIntensity', 'co2']) row.append(el('td', { children: [trackCell(dataset, axis)] }));
    row.append(el('td', { children: [regimeCell(dataset)] }), el('td', { children: [mediumCell(dataset)] }), el('td', { children: [phaseCell(dataset)] }));
    const treatments = el('td');
    if (dataset.record.treatments.length) dataset.record.treatments.forEach((t) => treatments.append(chip(t, 'ds-chip ds-chip-wrap')));
    else treatments.append(el('span', { className: 'ds-none', text: 'none recorded' }));
    row.append(treatments);
    return row;
  }

  /**
   * One row standing for a whole compendium: a checkbox that takes all of its
   * conditions in or out, and a button opening the grid for a subset. The
   * condition columns are not drawn, because a row covering 90 condition sets
   * has no single temperature or medium to show.
   */
  compendiumRowFor(study, members, colors) {
    const { state } = this.peek;
    const ids = members.map((d) => d.id);
    const on = ids.filter((id) => state.selected.has(id)).length;
    const row = el('tr', { className: on ? 'ds-compendium ds-selected' : 'ds-compendium' });
    row.dataset.study = study;
    row.style.borderLeft = `4px solid ${colors.get(study)}`;
    const box = el('input', { attrs: { type: 'checkbox', 'aria-label': `Show all ${members.length} conditions of ${study}` } });
    box.checked = on === ids.length;
    box.indeterminate = on > 0 && on < ids.length;
    box.addEventListener('change', () => {
      ids.forEach((id) => (box.checked ? state.selected.add(id) : state.selected.delete(id)));
      this.renderList();
      if (!state.info) this.renderSide();
    });
    row.append(el('td', { children: [box] }));
    const name = el('td', { className: 'ds-name', attrs: { colspan: 8 } });
    const top = el('div', { className: 'ds-name-top' });
    const first = members[0];
    top.append(el('span', { className: 'ds-name-id', children: [
      el('span', { className: 'ds-acc', text: study }), ' ', chip(first.record.strain), chip(first.record.platform),
    ] }));
    name.append(top);
    name.append(el('span', { className: 'ds-label', text: `${members.length} condition sets, pooled. ${on} selected.` }));
    const choose = el('button', { className: 'chip-button ds-choose', text: 'Choose conditions', attrs: { type: 'button' } });
    choose.addEventListener('click', async () => {
      const picked = await this.openGrid(study, members, { chosen: ids.filter((id) => state.selected.has(id)), opener: choose });
      if (!picked) return;
      ids.forEach((id) => (picked.has(id) ? state.selected.add(id) : state.selected.delete(id)));
      this.renderList();
      if (!state.info) this.renderSide();
    });
    name.append(choose);
    row.append(name);
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
    const restore = restoreAfterRender(list, this.peek.close);
    this.peek.guides.clear();
    const shown = this.shownDatasets();
    const colors = studyColors(this.typeDatasets());
    const table = el('table', { className: 'ds-table' });
    const head = el('thead');
    const headRow = el('tr');
    headRow.append(el('th', { attrs: { scope: 'col' }, children: [el('span', { className: 'visually-hidden', text: 'Show' })] }));
    headRow.append(el('th', { attrs: { scope: 'col' }, text: 'Dataset · condition set' }));
    for (const axis of ['temperature', 'lightIntensity', 'co2']) {
      headRow.append(el('th', { className: 'ds-axis-header', attrs: { scope: 'col', 'data-condition-axis': axis }, children: [el('span', { text: CONDITION_SCALES[axis].name }), conditionAxis(axis)] }));
    }
    for (const text of ['Light regime', 'Medium', 'Format · phase', 'Treatments']) headRow.append(el('th', { attrs: { scope: 'col' }, text }));
    head.append(headRow);
    const body = el('tbody');
    // A compendium is collapsed before grouping, not inside it: its condition
    // sets fall in several groups at once, so collapsing per group would draw
    // one row per group instead of the single row the owner asked for.
    const pooled = new Map();
    const rest = [];
    for (const dataset of shown) {
      const study = this.compendiumOf(dataset);
      if (!study) { rest.push(dataset); continue; }
      if (!pooled.has(study)) pooled.set(study, []);
      pooled.get(study).push(dataset);
    }
    for (const [study, members] of pooled) body.append(this.compendiumRowFor(study, members, colors));
    if (!shown.length) {
      body.append(el('tr', { children: [el('td', { className: 'ds-empty', text: 'No dataset matches the filters.', attrs: { colspan: 9 } })] }));
    } else if (state.flat) {
      rest.forEach((d) => body.append(this.rowFor(d, colors)));
    } else if (rest.length) {
      for (const group of groupDatasets(rest, { judgements: this.judgements })) {
        const studies = new Set(group.datasets.map((d) => d.record.studyId)).size;
        const selected = group.datasets.filter((d) => state.selected.has(d.id)).length;
        body.append(this.headerRow('ds-group', {
          box: group.selectAll && state.mode !== 'single' ? this.selectAllBox(group.datasets, group.name) : null,
          title: group.name,
          rule: group.rule,
          note: `${group.datasets.length} condition set${group.datasets.length === 1 ? '' : 's'} · ${studies} stud${studies === 1 ? 'y' : 'ies'} · ${selected} selected`,
        }));
        const emit = (datasets) => datasets.forEach((d) => body.append(this.rowFor(d, colors)));
        if (!group.split) { emit(group.datasets); continue; }
        group.sets.forEach((set, index) => {
          const name = `Comparable set ${index + 1}`;
          body.append(this.headerRow('ds-subgroup', {
            box: state.mode !== 'single' ? this.selectAllBox(set, `${name} of ${group.name}`) : null,
            title: name,
            rule: `${set.length} condition sets · ${summariseSet(set)}`,
          }));
          emit(set);
        });
        if (group.singles.length) {
          body.append(this.headerRow('ds-subgroup', { title: 'No comparable partner in this group', rule: `${group.singles.length} condition set${group.singles.length === 1 ? '' : 's'}, each chosen on its own` }));
          emit(group.singles);
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
    count.textContent = state.mode === 'single'
      ? `${shown.length} of ${total} condition sets shown · choose one`
      : state.mode === 'subset'
        ? `${shown.length} of ${total} available datasets shown · ${state.selected.size} selected for this axis`
        : `${shown.length} of ${total} condition sets shown in this tab · ${state.selected.size} selected across all tabs`;
    this.peek.done.disabled = state.mode === 'subset' && state.selected.size === 0;
    restore();
  }

  compareRow(label, sub, node) {
    const row = el('div', { className: 'ds-cmp-row' });
    const who = el('span', { className: 'ds-cmp-who', text: label });
    if (sub) who.append(el('small', { text: sub }));
    row.append(who, node);
    return row;
  }

  agreementSourceCard(source) {
    const card = el('article', { className: 'ds-agreement-source' });
    card.append(el('h5', { text: `${source.studyId} · ${source.conditionSet}` }));
    if (!source.agreement) {
      card.append(el('p', {
        className: 'panel-note',
        text: 'No summary for this admitted RNA-seq source is present in the current agreement report.',
      }));
      return card;
    }
    const evidence = source.agreement;
    card.append(el('p', {
      text: `${evidence.replicates.text} · ${evidence.meanGeneCount.toLocaleString()} genes in the layer mean.`,
    }));
    const range = evidence.empiricalSampleRange;
    if (evidence.biologicalBandAvailable) {
      card.append(el('p', {
        className: 'ds-agreement-range',
        text: `Empirical within-condition sample Spearman range: ${formatStatistic(range.min)}–${formatStatistic(range.median)}–${formatStatistic(range.max)} `
          + `(min / median / max across ${range.definedCorrelationCount.toLocaleString()} defined within-stratum sample pair${range.definedCorrelationCount === 1 ? '' : 's'}; not a confidence interval).`,
      }));
    } else if (range.definedCorrelationCount > 0) {
      card.append(el('p', {
        className: 'ds-agreement-range',
        text: `Processed sample correlations span ${formatStatistic(range.min)}–${formatStatistic(range.max)}, `
          + `across ${range.definedCorrelationCount.toLocaleString()} defined within-stratum sample pair${range.definedCorrelationCount === 1 ? '' : 's'}, `
          + `but no biological-replicate band is claimed because replication is ${evidence.replicateType}.`,
      }));
    } else {
      card.append(el('p', {
        className: 'ds-agreement-range',
        text: `No within-condition replicate correlation is defined (${range.reason.replaceAll('_', ' ')}); `
          + `replication type: ${evidence.replicateType}.`,
      }));
    }
    const evidenceDetail = el('details', { className: 'ds-agreement-caveat' });
    evidenceDetail.append(el('summary', { text: 'Source evidence and sample-pair counts' }));
    evidenceDetail.append(el('p', {
      text: `Strain: ${evidence.strain}. Units: ${evidence.units}. Normalization: ${evidence.normalization}.`,
    }));
    for (const stratum of evidence.strata) {
      evidenceDetail.append(el('p', {
        className: 'ds-agreement-stratum',
        text: `Stratum ${stratum.id}: ${stratum.columns.join('; ')}.`,
      }));
      if (stratum.sampleCorrelations.length === 0) {
        evidenceDetail.append(el('p', { text: 'No within-stratum sample pair is available.' }));
      } else {
        const pairs = el('ul', { className: 'ds-agreement-sample-pairs' });
        for (const pair of stratum.sampleCorrelations) {
          pairs.append(el('li', {
            text: `${pair.sampleLeft} ↔ ${pair.sampleRight}: Spearman ${formatStatistic(pair.spearman)} `
              + `over ${pair.sharedGeneCount.toLocaleString()} shared genes.`,
          }));
        }
        evidenceDetail.append(pairs);
      }
    }
    evidenceDetail.append(el('p', { text: `Caveat: ${evidence.caveat}` }));
    card.append(evidenceDetail);
    return card;
  }

  agreementLimitations(agreement) {
    const block = el('div', { className: 'ds-agreement-limitations' });
    block.append(el('p', {
      className: 'panel-note ds-agreement-no-threshold',
      text: 'Descriptive processed-data statistics only. No value is a pass/fail threshold or a comparability decision.',
    }));
    const details = el('details', { className: 'ds-agreement-caveat' });
    details.append(el('summary', { text: 'Report scope and caveats' }));
    const list = el('ul');
    for (const method of Object.values(agreement.methods)) list.append(el('li', { text: method }));
    for (const limitation of agreement.limitations) list.append(el('li', { text: limitation }));
    list.append(el('li', {
      text: 'One observed within-stratum correlation does not estimate a correlation sampling distribution.',
    }));
    details.append(list);
    block.append(details);
    return block;
  }

  agreementSelector(className, label, sources, value, selectedIds) {
    const wrapper = el('label', { className: 'ds-agreement-select', text: `${label} ` });
    const select = document.createElement('select');
    select.className = className;
    select.setAttribute('aria-label', `${label} for expression agreement`);
    for (const source of sources) {
      const option = document.createElement('option');
      option.value = source.id;
      option.textContent = `${source.studyId} · ${source.conditionSet}`
        + (source.agreement ? '' : ' · not covered')
        + (selectedIds.has(source.id) ? ' · selected' : '');
      option.selected = source.id === value;
      select.append(option);
    }
    select.value = value;
    wrapper.append(select);
    return { wrapper, select };
  }

  renderAgreement(chosen) {
    const { side, state } = this.peek;
    side.append(el('h4', { className: 'ds-agreement-heading', text: 'Processed-expression agreement' }));
    const status = this.agreement?.state ?? 'absent';
    if (status === 'loading') {
      side.append(el('p', {
        className: 'panel-note', text: 'Loading the validated statistics-only agreement report…',
        attrs: { role: 'status' },
      }));
      return;
    }
    if (status === 'failed') {
      const note = el('div', { className: 'ds-agreement-error', attrs: { role: 'alert' } });
      note.append(el('p', {
        text: 'The agreement report could not be loaded or validated. No agreement statistic is shown.',
      }));
      const retry = el('button', {
        className: 'chip-button', text: 'Retry agreement report', attrs: { type: 'button' },
      });
      retry.addEventListener('click', () => this.agreement?.retry?.());
      note.append(retry);
      side.append(note);
      return;
    }
    const agreement = this.agreement?.value;
    if (status === 'absent' || !agreement) {
      side.append(el('p', {
        className: 'panel-note',
        text: 'No processed-expression agreement report is published for this organism.',
      }));
      return;
    }
    if (state.type !== 'transcriptomics') {
      side.append(el('p', {
        className: 'panel-note',
        text: 'The current agreement report covers admitted RNA-seq sources only, not this data type.',
      }));
      return;
    }

    const sources = agreement.sources;
    if (sources.length < 2) {
      side.append(el('p', { className: 'panel-note', text: 'Fewer than two RNA-seq sources are available to compare.' }));
      return;
    }
    const selectedIds = new Set(chosen.map((source) => source.id));
    const preferred = [...sources.filter((source) => selectedIds.has(source.id)), ...sources]
      .filter((source, index, all) => all.findIndex((entry) => entry.id === source.id) === index);
    let [leftId, rightId] = state.agreementPair ?? [];
    if (!agreement.sourceById.has(leftId)) leftId = preferred[0].id;
    if (!agreement.sourceById.has(rightId) || rightId === leftId) {
      rightId = preferred.find((source) => source.id !== leftId).id;
    }
    state.agreementPair = [leftId, rightId];

    const controls = el('div', { className: 'ds-agreement-controls' });
    const left = this.agreementSelector('ds-agreement-left', 'Source A', sources, leftId, selectedIds);
    const right = this.agreementSelector('ds-agreement-right', 'Source B', sources, rightId, selectedIds);
    const changed = (which, select) => {
      const next = [...state.agreementPair];
      next[which] = select.value;
      state.agreementPair = next;
      this.renderSide();
      side.querySelector(which === 0 ? 'select.ds-agreement-left' : 'select.ds-agreement-right')
        ?.focus({ preventScroll: true });
    };
    left.select.addEventListener('change', () => changed(0, left.select));
    right.select.addEventListener('change', () => changed(1, right.select));
    controls.append(left.wrapper, right.wrapper);
    side.append(controls);

    const leftSource = agreement.sourceById.get(leftId);
    const rightSource = agreement.sourceById.get(rightId);
    side.append(this.agreementSourceCard(leftSource), this.agreementSourceCard(rightSource));
    // Report-wide limitations apply even when this particular lookup ends in
    // a coverage gap or undefined pair statistic.
    side.append(this.agreementLimitations(agreement));
    const pair = agreement.levelPair(leftId, rightId);
    if (!pair) {
      side.append(el('p', {
        className: 'panel-note',
        text: 'No layer-level statistic is present for this pair because at least one source is outside the current report.',
      }));
      return;
    }
    side.append(el('p', {
      className: 'ds-agreement-pair',
      text: pair.spearman === null
        ? `Layer-level Spearman is undefined (${pair.spearmanReason.replaceAll('_', ' ')}); ${pair.sharedGeneCount.toLocaleString()} shared genes.`
        : `Layer-level Spearman ${formatStatistic(pair.spearman)} over ${pair.sharedGeneCount.toLocaleString()} shared genes.`,
    }));

    const responses = agreement.responsePairsForSources(leftId, rightId);
    side.append(el('h5', { text: 'Explicit control-relative responses' }));
    side.append(el('p', {
      className: 'panel-note',
      text: 'These are recorded study contrasts discovered from the selected studies; they are not necessarily the two selected layer conditions.',
    }));
    if (responses.length === 0) {
      side.append(el('p', {
        className: 'panel-note',
        text: 'No response comparison with an explicit control arm is recorded for these two studies.',
      }));
    } else {
      const list = el('ul', { className: 'ds-agreement-responses' });
      for (const response of responses) {
        const item = el('li');
        item.append(el('strong', {
          text: `${response.leftContrast.studyId}: ${response.leftContrast.label} ↔ `
            + `${response.rightContrast.studyId}: ${response.rightContrast.label}`,
        }));
        item.append(el('span', {
          text: `Spearman ${formatNullable(response.spearman, response.spearmanReason)} · `
            + `Pearson ${formatNullable(response.pearson, response.pearsonReason)} · `
            + `same direction ${formatNullable(response.signAgreementFraction, response.signAgreementReason)} `
            + `(${response.sameDirectionCount.toLocaleString()} of ${response.nonzeroDirectionGeneCount.toLocaleString()}; `
            + `${response.sharedGeneCount.toLocaleString()} shared responses).`,
        }));
    const caveat = el('details', { className: 'ds-agreement-caveat' });
        caveat.append(el('summary', { text: 'Arms and response caveats' }));
        for (const contrast of [response.leftContrast, response.rightContrast]) {
          caveat.append(el('p', {
            text: `${contrast.studyId} — ${contrast.label}. Treatment: ${contrast.treatment.join('; ')}. `
              + `Control: ${contrast.control.join('; ')}. Caveat: ${contrast.caveat}`,
          }));
        }
        caveat.append(el('p', { text: `Pair caveat: ${response.caveat}` }));
        item.append(caveat);
        list.append(item);
      }
      side.append(list);
    }
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
    // Keep the bounded evidence lookup at the top of this independently
    // scrolling pane. The condition comparison below can be several screens
    // tall when many sources are selected, especially on a phone.
    this.renderAgreement(chosen);
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
    back.addEventListener('click', () => {
      state.info = null;
      this.renderSide();
      (state.infoOpener?.isConnected ? state.infoOpener : this.peek.close).focus({ preventScroll: true });
    });
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
    if (this.agreement?.state === 'ready' && this.agreement.value) {
      side.append(el('h4', { text: 'Processed-expression agreement' }));
      const source = this.agreement.value.sourceById.get(dataset.id);
      side.append(source
        ? this.agreementSourceCard(source)
        : el('p', { className: 'panel-note', text: 'This source is outside the agreement report’s RNA-seq scope.' }));
    } else if (this.agreement?.state === 'loading') {
      side.append(el('p', { className: 'panel-note', text: 'Agreement evidence is still loading.', attrs: { role: 'status' } }));
    }
  }
}

function formatStatistic(value) {
  return Number(value).toFixed(3);
}

function formatNullable(value, reason) {
  return value === null ? `undefined (${String(reason).replaceAll('_', ' ')})` : formatStatistic(value);
}
