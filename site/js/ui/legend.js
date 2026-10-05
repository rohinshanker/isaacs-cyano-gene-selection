/** Colour legend for the active map: scale, units, and what an open marker means. */
import { CATEGORY_PENDING_LABELS } from '../core/source-derived-categories.js';
import { formatValue, formatCount } from './format.js';
import {
  CATEGORY_UNKNOWN_COLOR, DERIVED_MARKER_FILL, MISSING_COLOR, GHOST_BORDER, GHOST_COLOR,
  PINNED_COLOR, REVIEWED_MARKER_BORDER, SHORTLIST_COLOR,
} from './colors.js';
import { MULTIPLE_CATEGORY_ID, UNKNOWN_CATEGORY_ID } from '../core/function-categories.js';
import { VALUE_SCALE_LABELS } from '../core/value-scales.js';
import { defaultColorSources } from '../core/annotation-source.js';
import { DEFAULT_ORGANISM, sourceIds, sourceLabels } from '../core/organisms.js';
import { describeReviewed } from '../core/source-derived-categories.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Pure inline-SVG description for a decorative canvas-marker swatch. */
export function legendMarkerDescription(shape, color, fill = color) {
  const marker = {
    attributes: {
      class: 'legend-marker', viewBox: '0 0 18 18',
      'aria-hidden': 'true', focusable: 'false',
    },
    elements: [],
  };
  const element = (name, attributes) => marker.elements.push({ name, attributes });
  if (shape === 'ghost-square') {
    element('rect', {
      x: 6, y: 6, width: 6, height: 6, fill, stroke: color, 'stroke-width': 1.4,
    });
  } else if (shape === 'filled-dot') {
    element('circle', {
      cx: 9, cy: 9, r: 2.5, fill, stroke: color, 'stroke-width': 1.4,
    });
  } else if (shape === 'diamond') {
    element('path', {
      d: 'M9 5 13 9 9 13 5 9Z', fill: 'none', stroke: color, 'stroke-width': 1.4,
    });
  } else if (shape === 'pin') {
    element('circle', {
      cx: 9, cy: 9, r: 3.5, fill: 'none', stroke: color, 'stroke-width': 1.4,
    });
    element('path', {
      d: 'M2.5 9h3M12.5 9h3M9 2.5v3M9 12.5v3',
      fill: 'none', stroke: color, 'stroke-width': 1.4,
    });
  } else if (shape === 'derived-circle') {
    element('circle', {
      cx: 9, cy: 9, r: 4.5, fill, stroke: color, 'stroke-width': 1.3,
    });
    element('circle', { cx: 9, cy: 9, r: 1.9, fill: color, stroke: 'none' });
  } else if (shape === 'filled-circle' || shape === 'open-circle') {
    element('circle', {
      cx: 9, cy: 9, r: shape === 'filled-circle' ? 4.5 : 3.5,
      fill: shape === 'filled-circle' ? fill : 'none',
      stroke: color, 'stroke-width': shape === 'filled-circle' ? 0.8 : 1.4,
    });
  } else {
    throw new Error(`unknown legend marker shape: ${shape}`);
  }
  return marker;
}

/** Decorative legend marker using the same geometry and colours as the canvas. */
function makeSwatch(shape, color, fill = color) {
  const description = legendMarkerDescription(shape, color, fill);
  const svg = document.createElementNS(SVG_NS, 'svg');
  for (const [key, value] of Object.entries(description.attributes)) svg.setAttribute(key, value);
  for (const { name, attributes } of description.elements) {
    const node = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    svg.append(node);
  }
  return svg;
}

/** Excluded-marker rows that have visible members in the current category view. */
export function categoryExcludedLegendRows(showHidden, hiddenReviewedCount, hiddenUnknownCount) {
  if (!showHidden) return [];
  return [
    {
      label: 'Excluded, categorised (reviewed or derived): grey outlined square',
      shape: 'ghost-square', color: GHOST_BORDER, fill: GHOST_COLOR, count: hiddenReviewedCount,
    },
    {
      label: 'Excluded, unknown: grey dot',
      shape: 'filled-dot', color: CATEGORY_UNKNOWN_COLOR,
      fill: CATEGORY_UNKNOWN_COLOR, count: hiddenUnknownCount,
    },
  ].filter(({ count }) => count > 0);
}

/**
 * The legend title names exactly the sources the counts are taken under, in the
 * names the organism's record gives them.
 */
export function categoryLegendTitle(sources, hasDerivedData, organism = DEFAULT_ORGANISM) {
  const ids = sourceIds(organism);
  const names = sourceLabels(organism);
  const parts = [];
  if (sources.includes(ids.reviewed)) parts.push(`${names.reviewed} reviewed`);
  if (hasDerivedData && sources.includes(ids.product)) parts.push(`${names.product} derived`);
  if (hasDerivedData && sources.includes(ids.go)) parts.push(`${names.go} derived`);
  if (parts.length === 0) return 'Function categories (no source enabled: every CDS unknown)';
  return `Function categories, counted under ${parts.join(' + ')} (whole CDS set)`;
}

/** The evidence sentence under the counts, or null when nothing is derived. */
export function categoryEvidenceSummary(
  evidenceCounts, hasDerivedData, conflictCount = 0, reviewedColouredCount = null,
  organism = DEFAULT_ORGANISM,
) {
  if (!hasDerivedData || !evidenceCounts) return null;
  const names = sourceLabels(organism);
  return `${describeReviewed(evidenceCounts.reviewed, reviewedColouredCount)}, `
    + `${formatCount(evidenceCounts['pcc-7942-derived'])} by ${names.product}, `
    + `${formatCount(evidenceCounts['go-iea-derived'])} by ${names.go}, `
    + `${formatCount(evidenceCounts.none)} by no enabled source`
    + (conflictCount > 0
      ? `; ${formatCount(conflictCount)} coloured by a higher-priority source over a conflicting one.`
      : '.');
}

/**
 * The organism's colour-source checkboxes, rendered inside the legend above the
 * category rows. They govern colouring and these counts only.
 */
function renderSourceToggles(sources, onToggleSource, toggles) {
  const group = document.createElement('fieldset');
  group.className = 'source-toggles';
  group.id = 'annotation-sources';
  group.setAttribute('aria-describedby', 'annotation-source-hint');
  const legend = document.createElement('legend');
  legend.className = 'visually-hidden';
  legend.textContent = 'Annotation sources for colouring';
  const label = document.createElement('span');
  label.className = 'source-toggles-label';
  label.setAttribute('aria-hidden', 'true');
  label.textContent = 'Colour by sources';
  group.append(legend, label);
  for (const { id, label: text } of toggles) {
    const row = document.createElement('span');
    row.className = 'checkbox-row source-toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = `annotation-source-${id}`;
    input.value = id;
    input.dataset.sourceId = id;
    input.checked = sources.includes(id);
    input.addEventListener('change', () => onToggleSource(id, input.checked));
    const name = document.createElement('label');
    name.htmlFor = input.id;
    name.textContent = text;
    row.append(input, name);
    group.append(row);
  }
  return group;
}

/**
 * A key for the resolved category colour under the enabled sources: reviewed
 * assignments win while the reviewed source is enabled, then source-derived categories
 * with their distinct hollow marker. Category rows are interactive: hover/focus previews,
 * click/Enter/Space toggles a filter selection, and a scoped reset clears it.
 */
export function renderCategoryLegend(host, {
  labels, categoryIds, multipleLabel, scale, counts, unknownCount, multipleCount,
  hiddenReviewedCount, hiddenUnknownCount, showHidden, selected = [],
  organism = DEFAULT_ORGANISM,
  sources = defaultColorSources(organism.annotationSources), hasDerivedData = false,
  evidenceCounts = null, reviewedColouredCount = null, derivedThreshold = null, conflictCount = 0,
  markerConventions = true, pending = null,
  onHoverCategory = () => {}, onFocusCategory = () => {},
  onToggleCategory = () => {}, onResetCategoryFilter = () => {}, onToggleSource = () => {},
}) {
  // The categories have not landed, or could not be loaded. Every CDS is drawn
  // in one neutral colour, and the key says only that: no category rows, no
  // counts, and no source toggles, because any of them would describe a
  // resolution that has not happened.
  if (pending) {
    host.replaceChildren();
    host.classList.add('category-mode');
    const title = document.createElement('p');
    title.className = 'legend-title';
    title.textContent = 'Function categories';
    const list = document.createElement('ul');
    list.className = 'legend-notes category-legend';
    const item = document.createElement('li');
    item.className = 'evidence-pending';
    item.dataset.pending = pending;
    item.setAttribute('role', 'status');
    const color = scale.buckets[scale.buckets.length - 1];
    item.append(makeSwatch('filled-circle', color, color),
      document.createTextNode(CATEGORY_PENDING_LABELS[pending]));
    list.append(item);
    host.append(title, list);
    return;
  }
  // A row rerender (every toggle calls renderAll) replaces every list element,
  // which would otherwise drop keyboard focus to BODY and break repeated
  // Enter/Space toggling on the same row. Remember which category id or
  // source checkbox held focus and restore it once the new rows exist.
  const focusedId = host.contains(document.activeElement)
    ? document.activeElement.dataset.categoryId ?? null
    : null;
  const focusedSource = host.contains(document.activeElement)
    ? document.activeElement.dataset.sourceId ?? null
    : null;
  host.replaceChildren();
  host.classList.add('category-mode');
  const names = sourceLabels(organism);
  const toggles = renderSourceToggles(sources, onToggleSource, organism.annotationSources);
  const title = document.createElement('p');
  title.className = 'legend-title';
  title.textContent = categoryLegendTitle(sources, hasDerivedData, organism);
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

  // Only reviewed rows with a category draw filled; a row reviewed as unknown
  // is still resolved by review but shares the open unknown circle. These rows
  // name the scatter map's point shapes, so a view that draws the same states
  // as something else asks for `markerConventions: false` and says its own.
  if (markerConventions) {
    staticRow('Reviewed (lab) category: filled circle', 'filled-circle', REVIEWED_MARKER_BORDER,
      evidenceCounts ? reviewedColouredCount : null, scale.buckets[0]);
    if (hasDerivedData) {
      const derivedCount = evidenceCounts
        ? evidenceCounts['pcc-7942-derived'] + evidenceCounts['go-iea-derived']
        : null;
      staticRow('Derived (computational) category: ring with centre dot', 'derived-circle',
        scale.buckets[0], derivedCount, DERIVED_MARKER_FILL);
    }
    for (const row of categoryExcludedLegendRows(
      showHidden, hiddenReviewedCount, hiddenUnknownCount,
    )) {
      staticRow(row.label, row.shape, row.color, row.count, row.fill);
    }
    staticRow('Shortlisted: diamond outline', 'diamond', SHORTLIST_COLOR);
    staticRow('Pinned: ring with crosshairs', 'pin', PINNED_COLOR);
  }

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'chip-button category-legend-reset';
  resetButton.textContent = 'Clear category selection';
  resetButton.disabled = selected.length === 0;
  resetButton.addEventListener('click', () => onResetCategoryFilter());

  const note = document.createElement('p');
  note.className = 'legend-ramp-note';
  note.textContent = (hasDerivedData
    ? `Precedence ${names.precedence} among the enabled sources: a lab-reviewed `
      + `assignment wins, then a ${names.product} or ${names.go} category from a TypeSafe Jev judgment`
      + `${derivedThreshold === null ? '' : ` at probability ${derivedThreshold.toFixed(2)} or above`}`
      + ', labelled pcc-7942-derived or go-iea-derived. A lower source that disagrees never '
      + 'changes the colour; the detail panel and export name the conflict. '
    : 'Only lab-reviewed locus assignments receive a category colour. '
      + `${names.go} suggestions alone leave a gene unclassified. `)
    + 'Hover or focus a category to preview it; click, Enter, or Space toggles it as a filter.';
  host.append(toggles, title, list);
  const summary = categoryEvidenceSummary(
    evidenceCounts, hasDerivedData, conflictCount, reviewedColouredCount, organism,
  );
  if (summary) {
    const evidence = document.createElement('p');
    evidence.className = 'legend-ramp-note legend-evidence';
    evidence.textContent = summary;
    host.append(evidence);
  }
  host.append(resetButton, note);

  // Restore focus only once the new row is actually attached to the document:
  // `.focus()` on a still-detached element is a silent no-op.
  if (focusedId !== null) {
    const toFocus = Array.from(list.querySelectorAll('.category-legend-row'))
      .find((row) => row.dataset.categoryId === focusedId);
    if (toFocus) toFocus.focus();
  }
  if (focusedSource !== null) {
    const toFocus = toggles.querySelector(`input[data-source-id="${focusedSource}"]`);
    if (toFocus) toFocus.focus();
  }
}

/** The scale's own name, for a legend, a control, or a spoken description. */
export function rampScaleLabel(scale) {
  return VALUE_SCALE_LABELS[scale.scaleName] ?? VALUE_SCALE_LABELS.linear;
}

/** How close to an end the middle tick may sit before its label crowds that end's. */
const MID_TICK_MARGIN = 0.25;

/**
 * How far from a ramp end a tick may sit and still have its label pinned inside
 * the ramp's width rather than centred on its position.
 *
 * A tick's position comes out of the scale rather than being assumed, so an end
 * tick lands on 0 or 1 to within floating-point dust rather than exactly on it.
 * The tolerance is far below anything a real tick position could be, so it only
 * ever catches that dust.
 */
const EDGE_TOLERANCE = 1e-6;

/**
 * How many decades a logarithmic ramp must span before its middle tick is worth
 * snapping to a power of ten.
 *
 * The snap moves the label to the decade nearest the ramp's midpoint, so it can
 * move it by up to half a decade — which on a narrow ramp is most of the ramp's
 * width, and the label then sits on top of an end label. Two decades bounds that
 * move to a quarter of the ramp, and below two decades there is at most one
 * decade inside the domain anyway, so nothing is lost by labelling the true
 * midpoint instead.
 */
const MIN_SNAP_DECADES = 2;

/**
 * The ramp in CSS pixels, from `.legend-ticks` in app.css, and a conservative
 * width for one character of a tick label at the 0.75rem that rule sets.
 *
 * A tick label is digits, a sign, group separators and a decimal point; every
 * one of those is narrower than this in the interface's font, so counting
 * characters over-estimates a label's box, which is the safe direction for
 * deciding whether two labels collide. The gutter is the clear space two
 * neighbouring labels must keep to still read as two numbers.
 */
const RAMP_WIDTH_PX = 196;
const TICK_CHAR_PX = 7;
const TICK_GUTTER_PX = 4;

/**
 * One candidate tick: where the scale puts the value, the text that will be
 * drawn, and the horizontal box that text will occupy.
 *
 * The box follows app.css exactly — a label at either end of the ramp is pinned
 * inside it, and any other label is centred on its own position — so the
 * crowding test below is a test of the picture and not of an approximation of
 * it.
 */
function rampTickBox(scale, metric, value) {
  const position = scale.normalize(value);
  const text = formatValue(metric, value);
  const width = text.length * TICK_CHAR_PX;
  const anchor = Math.min(1, Math.max(0, position)) * RAMP_WIDTH_PX;
  let from = anchor - width / 2;
  if (position <= EDGE_TOLERANCE) from = anchor;
  else if (position >= 1 - EDGE_TOLERANCE) from = anchor - width;
  return { value, position, text, from, to: from + width };
}

/** Whether two tick labels would sit closer than the gutter, or overlap. */
function tickLabelsCollide(one, other) {
  return one.from < other.to + TICK_GUTTER_PX && other.from < one.to + TICK_GUTTER_PX;
}

/**
 * The ramp's tick labels: a value near each end of the ramp and one inside, each
 * placed where the scale actually puts that value.
 *
 * Every position is `scale.normalize(value)` and never an assumed 0, 0.5 or 1,
 * so a tick label cannot disagree with the colour beside it under any scale.
 * Two cases make that more than a formality. A percentile ramp is a step
 * function over ranks, so its tick values are measurements the cohort really
 * holds and each sits at the rank it really has; and a diverging ramp pads the
 * shorter of its two arms to keep zero at the centre, so the padded end stands
 * for no measurement at all and the extreme value is labelled where it truly
 * falls rather than at the edge.
 *
 * Every label is a value of the metric, read back through the scale, so a reader
 * never has to guess whether a colour difference is tenfold or ten units. A
 * diverging ramp labels its centre zero, because that is what its centre means.
 * A logarithmic ramp spanning at least {@link MIN_SNAP_DECADES} decades snaps
 * its middle label to the power of ten nearest the true midpoint, which reads as
 * a decade rather than as an arbitrary number, and keeps the untidy midpoint
 * when that decade would sit close enough to an end to crowd its label.
 *
 * Two ticks carrying the same value are one tick: `normalize` is a function of
 * the value, so equal values always share a position. A tick whose label would
 * collide with one already placed is never moved sideways — moving it is exactly
 * the lie this function exists to prevent — so it drops to a second row at the
 * same position instead, and `row` says which row it belongs on. The two ends
 * take the first row first, because they are what lets a reader turn any colour
 * on the ramp into a value; the inside tick is the one that hangs below. Only a
 * ramp with a padded arm ever needs the second row at all: an ordinary ramp has
 * its three ticks a third of its width apart.
 *
 * @param {{min: number, max: number, mid: number, diverging: boolean,
 *   scaleName: string, normalize: (value: number) => number}} scale
 * @param {{label: string, unit?: string|null, decimals?: number}} metric the
 *   metric being drawn, for formatting a value into the label it will carry.
 * @returns {{value: number, position: number, text: string, row: number}[]} in
 *   ramp order.
 */
export function rampTicks(scale, metric) {
  const middleValue = () => {
    if (scale.diverging) return 0;
    const exact = scale.mid;
    if (scale.scaleName !== 'log10' || !(exact > 0) || !(scale.min > 0)) return exact;
    if (Math.log10(scale.max / scale.min) < MIN_SNAP_DECADES) return exact;
    const decade = 10 ** Math.round(Math.log10(exact));
    const position = scale.normalize(decade);
    return position > MID_TICK_MARGIN && position < 1 - MID_TICK_MARGIN ? decade : exact;
  };
  const placed = [];
  for (const value of [scale.min, scale.max, middleValue()]) {
    if (placed.some((tick) => tick.value === value)) continue;
    const tick = rampTickBox(scale, metric, value);
    const clear = (row) => !placed.some(
      (other) => other.row === row && tickLabelsCollide(tick, other),
    );
    const row = clear(0) ? 0 : 1;
    if (row === 1 && !clear(1)) continue;
    placed.push({ ...tick, row });
  }
  return placed
    .sort((one, other) => one.position - other.position)
    .map(({ value, position, text, row }) => ({ value, position, text, row }));
}

/**
 * One sentence naming the value scale the ramp is drawn under, and whatever
 * that scale needs the reader to know to read a colour correctly: a symmetric
 * log's transition scale, or the cohort a percentile ranks against.
 */
export function describeValueScale(metric, scale) {
  const parts = [`Scale: ${rampScaleLabel(scale)}. The tick labels read ${metric.label} in its `
    + 'own units, at the positions this scale puts them; no stored value changes.'];
  if (scale.scaleName === 'symlog') {
    const unit = metric.unit ? ` ${metric.unit}` : '';
    const transition = `${formatValue(metric, scale.scaleTransition)}${unit}`;
    parts.push(`The scale is approximately linear for values well inside ±${transition} of zero `
      + `and logarithmic for values well outside it, turning from one into the other around `
      + `±${transition}. It is one smooth curve, so there is no exact linear interval and no `
      + 'kink in the colour at the transition.');
  }
  if (scale.scaleName === 'percentile') {
    parts.push('Colour is a rank against every gene that has a value, so it shows order rather '
      + 'than magnitude: two genes a thousandfold apart can take adjacent colours. Each tick is a '
      + 'value some gene really has, at the rank it holds.');
  }
  return parts.join(' ');
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
 *   showHidden: boolean, provenanceNote: string|null, markerConventions?: boolean,
 *   basisCounts?: {counts: Map<string, number>, recorded: boolean}}} state
 *   `markerConventions` false omits the rows naming the scatter map's point
 *   shapes, for a view that draws the same evidence states as something else.
 *   That caller states its own conventions; the colour key is what it shares.
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
    `${rampScaleLabel(scale)} colour scale from ${formatValue(metric, scale.min)} to `
      + `${formatValue(metric, scale.max)} ${metric.unit ?? ''}`.trim(),
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

  // The scale's name sits beside the ramp, not only in the note below it: a
  // reader glancing at a colour has to be able to see what the colour means.
  const rampRow = document.createElement('div');
  rampRow.className = 'legend-ramp-row';
  const scaleName = document.createElement('span');
  scaleName.className = 'legend-scale-name';
  scaleName.textContent = rampScaleLabel(scale);
  rampRow.append(canvas, scaleName);

  // Absolute placement, not even spacing: a tick is only honest where the scale
  // actually puts its value. `at-start`/`at-end` keep the two end labels inside
  // the ramp's width instead of centred on its edges.
  const ticks = document.createElement('div');
  ticks.className = 'legend-ticks';
  for (const tick of rampTicks(scale, metric)) {
    const label = document.createElement('span');
    label.textContent = tick.text;
    label.style.left = `${(Math.min(1, Math.max(0, tick.position)) * 100).toFixed(2)}%`;
    if (tick.position <= EDGE_TOLERANCE) label.classList.add('at-start');
    else if (tick.position >= 1 - EDGE_TOLERANCE) label.classList.add('at-end');
    // A ramp whose arms are padded can put two labels within a few pixels of each
    // other; the crowded one hangs below at its own position rather than being
    // nudged along the ramp to somewhere it does not belong.
    if (tick.row > 0) {
      label.classList.add('below');
      ticks.classList.add('stacked');
    }
    ticks.append(label);
  }

  const notes = document.createElement('ul');
  notes.className = 'legend-notes';
  const addNote = (shape, color, text, fill = color) => {
    const item = document.createElement('li');
    item.append(makeSwatch(shape, color, fill), document.createTextNode(` ${text}`));
    notes.append(item);
  };
  if (state.markerConventions !== false) {
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
  }

  const ramp = document.createElement('p');
  ramp.className = 'legend-ramp-note';
  ramp.textContent = describeRamp(metric, scale);

  const scaleNote = document.createElement('p');
  scaleNote.className = 'legend-ramp-note legend-scale-note';
  scaleNote.textContent = describeValueScale(metric, scale);

  host.append(title, rampRow, ticks, notes, scaleNote, ramp);
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
