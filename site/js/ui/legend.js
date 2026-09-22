/** Colour legend for the active map: scale, units, and what an open marker means. */
import { formatValue, formatCount } from './format.js';
import { CATEGORY_UNKNOWN_COLOR, MISSING_COLOR, GHOST_BORDER, GHOST_COLOR } from './colors.js';

/** A key for human-reviewed category assignments, including empty categories. */
export function renderCategoryLegend(host, {
  labels, multipleLabel, scale, counts, unknownCount, multipleCount, hiddenCount, showHidden,
}) {
  host.replaceChildren();
  host.classList.add('category-mode');
  const title = document.createElement('p');
  title.className = 'legend-title';
  title.textContent = 'Reviewed function categories (whole CDS set)';
  const list = document.createElement('ul');
  list.className = 'legend-notes category-legend';
  const row = (label, color, count = null, open = false, fill = color, shape = '') => {
    const item = document.createElement('li');
    const swatch = document.createElement('span');
    swatch.className = `legend-swatch-box${open ? ' open' : ''}${shape ? ` ${shape}` : ''}`;
    swatch.style.borderColor = color;
    if (!open) swatch.style.background = fill;
    item.append(swatch, document.createTextNode(
      count === null ? label : `${label} (${formatCount(count)})`,
    ));
    list.append(item);
  };
  labels.forEach((label, index) => row(label, scale.buckets[index], counts[index]));
  row(multipleLabel, scale.buckets[labels.length], multipleCount);
  row('Unknown or unclassified', CATEGORY_UNKNOWN_COLOR, unknownCount, true);
  if (showHidden) {
    row('Excluded by filters: grey outlined squares', GHOST_BORDER, hiddenCount,
      false, GHOST_COLOR);
  }
  row('Shortlisted: diamond outline', '#1b2733', null, true, '', 'diamond');
  row('Pinned: ring with crosshairs', '#b3261e', null, true, '', 'pin');
  const note = document.createElement('p');
  note.className = 'legend-ramp-note';
  note.textContent = 'Only lab-reviewed locus assignments receive a category colour. '
    + 'GO IEA suggestions alone leave a gene unclassified.';
  host.append(title, list, note);
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
  const addNote = (swatchClass, color, text, shape, fill = color) => {
    const item = document.createElement('li');
    const swatch = document.createElement('span');
    swatch.className = `legend-swatch-box ${swatchClass}`;
    swatch.style.borderColor = color;
    if (shape !== 'open') swatch.style.background = fill;
    item.append(swatch, document.createTextNode(` ${text}`));
    notes.append(item);
  };
  addNote(
    'open', MISSING_COLOR,
    `${formatCount(state.missingCount)} genes have no value: open circles`, 'open',
  );
  // Only true when those grey dots are actually drawn: with "Show filtered-out
  // genes" unchecked, the map has nothing this note could be describing.
  if (state.showHidden) {
    addNote(
      'ghost', GHOST_BORDER,
      `${formatCount(state.hiddenCount)} excluded by filters: grey outlined squares`,
      'filled', GHOST_COLOR,
    );
  }
  addNote('diamond', '#1b2733', 'Shortlisted: diamond outline', 'open');
  addNote('pin', '#b3261e', 'Pinned: ring with crosshairs', 'open');

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
