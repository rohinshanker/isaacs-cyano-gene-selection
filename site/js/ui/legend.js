/** Colour legend for the active map: scale, units, and what an open marker means. */
import { formatValue, formatCount } from './format.js';
import {
  CATEGORY_UNKNOWN_COLOR, MISSING_COLOR, GHOST_BORDER, GHOST_COLOR,
  PINNED_COLOR, REVIEWED_MARKER_BORDER, SHORTLIST_COLOR,
} from './colors.js';
import { MULTIPLE_CATEGORY_ID, UNKNOWN_CATEGORY_ID } from '../core/function-categories.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Decorative legend marker using the same geometry and colours as the canvas. */
function makeSwatch(shape, color, fill = color) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add('legend-marker');
  svg.setAttribute('viewBox', '0 0 18 18');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const element = (name, attributes) => {
    const node = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    svg.append(node);
  };
  if (shape === 'ghost-square') {
    element('rect', { x: 5, y: 5, width: 8, height: 8, fill, stroke: color, 'stroke-width': 1.4 });
  } else if (shape === 'filled-dot') {
    element('circle', { cx: 9, cy: 9, r: 3, fill });
  } else if (shape === 'diamond') {
    element('path', { d: 'M9 2.5 15.5 9 9 15.5 2.5 9Z', fill: 'none', stroke: color, 'stroke-width': 1.6 });
  } else {
    const radius = shape === 'pin' ? 4.5 : 4;
    element('circle', {
      cx: 9, cy: 9, r: radius, fill: shape === 'filled-circle' ? fill : 'none',
      stroke: color, 'stroke-width': shape === 'filled-circle' ? 0.8 : 1.4,
    });
    if (shape === 'pin') {
      element('path', {
        d: 'M1 9h3M14 9h3M9 1v3M9 14v3', fill: 'none', stroke: color, 'stroke-width': 1.6,
      });
    }
  }
  return svg;
}

/**
 * A key for human-reviewed category assignments, including empty categories.
 * Category rows are interactive: hover/focus previews, click/Enter/Space toggles
 * a filter selection, and a scoped reset clears it.
 */
export function renderCategoryLegend(host, {
  labels, categoryIds, multipleLabel, scale, counts, unknownCount, multipleCount,
  hiddenReviewedCount, hiddenUnknownCount, showHidden, selected = [],
  onHoverCategory = () => {}, onFocusCategory = () => {},
  onToggleCategory = () => {}, onResetCategoryFilter = () => {},
}) {
  // A row rerender (every toggle calls renderAll) replaces every list element,
  // which would otherwise drop keyboard focus to BODY and break repeated
  // Enter/Space toggling on the same row. Remember which category id held
  // focus and restore it once the new rows exist.
  const focusedId = host.contains(document.activeElement)
    ? document.activeElement.dataset.categoryId ?? null
    : null;
  host.replaceChildren();
  host.classList.add('category-mode');
  const title = document.createElement('p');
  title.className = 'legend-title';
  title.textContent = 'Reviewed function categories (whole CDS set)';
  const list = document.createElement('ul');
  list.className = 'legend-notes category-legend';

  const staticRow = (label, shape, color, count = null, fill = color) => {
    const item = document.createElement('li');
    item.append(makeSwatch(shape, color, fill), document.createTextNode(
      count === null ? label : `${label} (${formatCount(count)})`,
    ));
    list.append(item);
  };

  /** A focusable, clickable row for one selectable category bucket. */
  const categoryRow = (id, label, color, count, shape = 'filled-circle') => {
    const item = document.createElement('li');
    const button = document.createElement('div');
    button.className = 'category-legend-row';
    button.setAttribute('role', 'checkbox');
    button.tabIndex = 0;
    const isSelected = selected.includes(id);
    button.setAttribute('aria-checked', String(isSelected));
    button.classList.toggle('selected', isSelected);
    button.dataset.categoryId = id;
    button.append(makeSwatch(shape, shape === 'filled-circle' ? REVIEWED_MARKER_BORDER : color, color), document.createTextNode(
      ` ${label} (${formatCount(count)})`,
    ));
    // Hover (mouse) and focus (keyboard) are separate preview channels: with a
    // category committed and a different row focused, hovering a third row and
    // leaving it must restore the focused row's preview, not the committed
    // selection. Each channel only ever reports its own state.
    button.addEventListener('mouseenter', () => onHoverCategory(id));
    button.addEventListener('mouseleave', () => onHoverCategory(null));
    button.addEventListener('focus', () => onFocusCategory(id));
    button.addEventListener('blur', () => onFocusCategory(null));
    button.addEventListener('click', () => onToggleCategory(id));
    button.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
      event.preventDefault();
      onToggleCategory(id);
    });
    item.append(button);
    list.append(item);
  };

  labels.forEach((label, index) => categoryRow(
    categoryIds[index], label, scale.buckets[index], counts[index],
  ));
  categoryRow(MULTIPLE_CATEGORY_ID, multipleLabel, scale.buckets[labels.length], multipleCount);
  categoryRow(UNKNOWN_CATEGORY_ID, 'Unknown or unclassified', CATEGORY_UNKNOWN_COLOR, unknownCount, 'open-circle');

  if (showHidden) {
    staticRow('Excluded, reviewed category: grey outlined square', 'ghost-square',
      GHOST_BORDER, hiddenReviewedCount, GHOST_COLOR);
    staticRow('Excluded, unknown: grey dot', 'filled-dot',
      CATEGORY_UNKNOWN_COLOR, hiddenUnknownCount);
  }
  staticRow('Shortlisted: diamond outline', 'diamond', SHORTLIST_COLOR);
  staticRow('Pinned: ring with crosshairs', 'pin', PINNED_COLOR);

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'chip-button category-legend-reset';
  resetButton.textContent = 'Clear category selection';
  resetButton.disabled = selected.length === 0;
  resetButton.addEventListener('click', () => onResetCategoryFilter());

  const note = document.createElement('p');
  note.className = 'legend-ramp-note';
  note.textContent = 'Only lab-reviewed locus assignments receive a category colour. '
    + 'GO IEA suggestions alone leave a gene unclassified. Hover or focus a category to '
    + 'preview it; click, Enter, or Space toggles it as a filter.';
  host.append(title, list, resetButton, note);

  // Restore focus only once the new row is actually attached to the document:
  // `.focus()` on a still-detached element is a silent no-op.
  if (focusedId !== null) {
    const toFocus = Array.from(list.querySelectorAll('.category-legend-row'))
      .find((row) => row.dataset.categoryId === focusedId);
    if (toFocus) toFocus.focus();
  }
}

/** One sentence naming the ramp family and where the choice came from. */
export function describeRamp(metric, scale) {
  const family = scale.diverging ? 'diverging, centred on zero' : 'sequential';
  if (scale.scaleSource === 'declared') {
    return `Ramp: ${family}, as the dataset declares for ${metric.label}. A ramp reads the value; `
      + 'it does not say whether high is good.';
  }
  return `Ramp: ${family}, inferred from the sign of the data because the dataset declares no `
    + `scale for ${metric.label}.`;
}

/** Plain-language count of expression bases, or null when the dataset records none. */
export function describeBasisCounts(basisCounts) {
  if (!basisCounts || !basisCounts.recorded) return null;
  const { counts } = basisCounts;
  const parts = [`${formatCount(counts.get('measured'))} measured`];
  if (counts.get('proxy') > 0) parts.push(`${formatCount(counts.get('proxy'))} proxy only`);
  if (counts.get('none') > 0) parts.push(`${formatCount(counts.get('none'))} with neither`);
  if (counts.get('unrecorded') > 0) parts.push(`${formatCount(counts.get('unrecorded'))} with no basis recorded`);
  return `Expression basis: ${parts.join(', ')}. Only measured values are coloured here.`;
}

/**
 * @param {HTMLElement} host
 * @param {{metric: object, scale: object, missingCount: number, hiddenCount: number,
 *   showHidden: boolean, provenanceNote: string|null,
 *   basisCounts?: {counts: Map<string, number>, recorded: boolean}}} state
 */
export function renderLegend(host, state) {
  host.replaceChildren();
  host.classList.remove('category-mode');
  const { metric, scale } = state;

  const title = document.createElement('p');
  title.className = 'legend-title';
  title.textContent = metric.label;
  const unit = document.createElement('span');
  unit.className = 'legend-unit';
  unit.textContent = metric.unit ? ` (${metric.unit})` : '';
  title.append(unit);

  const canvas = document.createElement('canvas');
  canvas.className = 'legend-ramp';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    `Colour scale from ${formatValue(metric, scale.min)} to ${formatValue(metric, scale.max)} `
      + `${metric.unit ?? ''}`.trim(),
  );
  const ratio = window.devicePixelRatio || 1;
  const width = 196;
  const height = 12;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  for (let x = 0; x < width; x += 1) {
    const bucket = scale.buckets[Math.round((x / (width - 1)) * (scale.buckets.length - 1))];
    context.fillStyle = bucket;
    context.fillRect(x, 0, 1, height);
  }

  const ticks = document.createElement('div');
  ticks.className = 'legend-ticks';
  for (const value of [scale.min, scale.mid, scale.max]) {
    const tick = document.createElement('span');
    tick.textContent = formatValue(metric, value);
    ticks.append(tick);
  }

  const notes = document.createElement('ul');
  notes.className = 'legend-notes';
  const addNote = (shape, color, text, fill = color) => {
    const item = document.createElement('li');
    item.append(makeSwatch(shape, color, fill), document.createTextNode(` ${text}`));
    notes.append(item);
  };
  addNote(
    'open-circle', MISSING_COLOR,
    `${formatCount(state.missingCount)} genes have no value: open circles`,
  );
  // Only true when those grey dots are actually drawn: with "Show filtered-out
  // genes" unchecked, the map has nothing this note could be describing.
  if (state.showHidden) {
    addNote(
      'ghost-square', GHOST_BORDER,
      `${formatCount(state.hiddenCount)} excluded by filters: grey outlined squares`,
      GHOST_COLOR,
    );
  }
  addNote('diamond', SHORTLIST_COLOR, 'Shortlisted: diamond outline');
  addNote('pin', PINNED_COLOR, 'Pinned: ring with crosshairs');

  const ramp = document.createElement('p');
  ramp.className = 'legend-ramp-note';
  ramp.textContent = describeRamp(metric, scale);

  host.append(title, canvas, ticks, notes, ramp);
  const basis = describeBasisCounts(state.basisCounts);
  if (basis) {
    const note = document.createElement('p');
    note.className = 'legend-ramp-note';
    note.textContent = basis;
    host.append(note);
  }
  if (state.provenanceNote) {
    const note = document.createElement('p');
    note.className = 'provenance-warning';
    note.textContent = state.provenanceNote;
    host.append(note);
  }
}
