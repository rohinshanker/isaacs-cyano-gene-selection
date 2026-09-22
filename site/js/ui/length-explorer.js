/** Accessible, release-pinned length histogram and CDS range control. */
import {
  LENGTH_COHORTS, cohortValues, countInRange, lengthBins, passingLengthBins,
} from '../core/length-cohorts.js';
import { formatCount } from './format.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
export const LENGTH_TAB = Object.freeze({
  id: 'lengths',
  name: 'Lengths',
  blurb: 'Compare RefSeq gene spans with joined CDS lengths and choose an inclusive map length range.',
  source: '',
});

function svgElement(name, attributes) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

export class LengthExplorer {
  constructor(host, { onCohortChange, onRangeChange }) {
    this.host = host;
    this.onCohortChange = onCohortChange;
    this.onRangeChange = onRangeChange;
    this.built = false;
  }

  update({ inventory, cohortId, range, mapPassing, mapCount }) {
    if (!inventory) {
      const note = document.createElement('p');
      note.textContent = 'The pinned length inventory is unavailable in this dataset.';
      this.host.replaceChildren(note);
      this.built = false;
      return;
    }
    if (!this.built) this.build();
    const selected = LENGTH_COHORTS.some((entry) => entry.id === cohortId) ? cohortId : 'annotated';
    const { cohort, values, total, unknown } = cohortValues(inventory, selected);
    this.select.value = selected;
    this.definition.textContent = cohort.field === 'geneSpanNt'
      ? 'Gene span: inclusive RefSeq feature coordinates, including any gaps within the span.'
      : 'CDS length: joined coding segments in nucleotides, including the terminal stop.';
    this.summary.textContent = `${formatCount(total)} loci · ${formatCount(values.length)} lengths · `
      + `${formatCount(unknown)} unknown`;
    if (cohort.field === 'cdsLengthNt') {
      this.summary.textContent += ` · ${formatCount(countInRange(values, range?.min ?? null, range?.max ?? null))} within the selected length range`;
    }
    this.chartHost.replaceChildren(
      this.histogram(values, inventory.qc?.shortCdsBelowNt ?? 75, cohort, range),
    );
    this.inputs.min.value = range?.min ?? '';
    this.inputs.max.value = range?.max ?? '';
    this.mapSummary.textContent = `${formatCount(mapPassing)} of ${formatCount(mapCount)} plotted CDSs pass all filters.`;
    const threshold = inventory.qc?.shortCdsBelowNt ?? 75;
    const shortCount = inventory.records.filter((row) => row.cdsLengthNt !== null
      && row.cdsLengthNt < threshold).length;
    this.qc.textContent = `Annotation review flag: CDSs below ${threshold} nt `
      + `(${shortCount} in this release). This is a quality check, not an exclusion rule.`;
  }

  build() {
    this.host.replaceChildren();
    const title = document.createElement('h2');
    title.textContent = 'Length distribution';
    const intro = document.createElement('p');
    intro.className = 'panel-note';
    intro.textContent = 'Choose an annotation cohort to compare lengths. The map remains the '
      + 'screened protein-coding CDS set. The range below filters the map; exports retain '
      + 'the shortlist and record which rows pass.';
    const chooser = document.createElement('div');
    chooser.className = 'field-row';
    const label = document.createElement('label');
    label.htmlFor = 'length-cohort';
    label.textContent = 'Show lengths for';
    this.select = document.createElement('select');
    this.select.id = 'length-cohort';
    for (const choice of LENGTH_COHORTS) {
      const option = document.createElement('option');
      option.value = choice.id;
      option.textContent = choice.label;
      this.select.append(option);
    }
    this.select.addEventListener('change', () => {
      const value = this.select.value;
      // Let the browser finish moving keyboard focus before the shared view
      // rerenders controls elsewhere on the page.
      setTimeout(() => this.onCohortChange(value), 0);
    });
    chooser.append(label, this.select);

    this.definition = document.createElement('p');
    this.definition.className = 'panel-note';
    this.summary = document.createElement('p');
    this.summary.className = 'length-summary';
    this.chartHost = document.createElement('div');
    const rangeHeading = document.createElement('h3');
    rangeHeading.textContent = 'Filter map by CDS length';
    const rangeNote = document.createElement('p');
    rangeNote.className = 'panel-note';
    rangeNote.textContent = 'Inclusive endpoints in nucleotides. Leave a field blank for no bound.';
    const controls = document.createElement('div');
    controls.className = 'length-range-controls';
    this.inputs = {};
    const makeInput = (bound, text) => {
      const wrapper = document.createElement('label');
      wrapper.textContent = text;
      const input = document.createElement('input');
      input.id = `length-range-${bound}`;
      input.type = 'number';
      input.min = '0';
      input.step = '1';
      input.addEventListener('change', () => {
        const raw = input.value.trim();
        const value = raw === '' ? null : Number(raw);
        if (input.validity.badInput || (value !== null && (!Number.isInteger(value) || value < 0))) {
          input.setCustomValidity('Enter a nonnegative whole number.');
          input.reportValidity();
          return;
        }
        input.setCustomValidity('');
        setTimeout(() => this.onRangeChange(bound, value), 0);
      });
      wrapper.append(input);
      this.inputs[bound] = input;
      return wrapper;
    };
    controls.append(makeInput('min', 'At least (nt)'), makeInput('max', 'At most (nt)'));
    this.mapSummary = document.createElement('p');
    this.mapSummary.className = 'panel-note';
    this.qc = document.createElement('p');
    this.qc.className = 'panel-note';
    this.host.append(title, intro, chooser, this.definition, this.summary, this.chartHost,
      rangeHeading, rangeNote, controls, this.mapSummary, this.qc);
    this.built = true;
  }

  histogram(values, threshold, cohort, range) {
    const histogram = lengthBins(values);
    const { min, max, bins } = histogram;
    const passed = passingLengthBins(
      values, histogram,
      cohort.field === 'cdsLengthNt' ? (range?.min ?? null) : null,
      cohort.field === 'cdsLengthNt' ? (range?.max ?? null) : null,
    );
    const frame = document.createElement('div');
    frame.className = 'length-chart';
    const svg = svgElement('svg', {
      viewBox: '0 0 800 270',
      role: 'img',
      'aria-label': `Histogram of ${cohort.label.toLowerCase()} in nucleotides; ${bins.length} equal-width bins from ${min ?? 'unknown'} to ${max ?? 'unknown'} nt. Blue shows loci inside the selected range; grey shows the rest.`,
    });
    const peak = Math.max(1, ...bins);
    bins.forEach((count, index) => {
      const x = 38 + index * 23;
      const height = (count / peak) * 200;
      const bar = svgElement('rect', {
        x, y: 215 - height, width: 21, height, fill: '#d8dde3',
      });
      const title = svgElement('title', {});
      title.textContent = `Bin ${index + 1}: ${passed[index]} of ${count} loci within range`;
      bar.append(title);
      svg.append(bar);
      const passingHeight = (passed[index] / peak) * 200;
      const passingBar = svgElement('rect', {
        x, y: 215 - passingHeight, width: 21, height: passingHeight, fill: '#2f6f8f',
      });
      const passingTitle = svgElement('title', {});
      passingTitle.textContent = title.textContent;
      passingBar.append(passingTitle);
      svg.append(passingBar);
    });
    svg.append(svgElement('line', { x1: 38, y1: 215, x2: 774, y2: 215, stroke: '#536774' }));
    const endpoints = [[min, 38, 'start'], [max, 774, 'end']];
    for (const [value, x, anchor] of endpoints) {
      const tick = svgElement('text', { x, y: 238, 'text-anchor': anchor, fill: '#536774' });
      tick.textContent = value === null ? 'No values' : `${formatCount(value)} nt`;
      svg.append(tick);
    }
    if (cohort.field === 'cdsLengthNt' && min !== null && threshold >= min && threshold <= max) {
      const x = 38 + ((threshold - min) / (max - min || 1)) * 736;
      svg.append(svgElement('line', {
        x1: x, y1: 8, x2: x, y2: 215, stroke: '#a75c06', 'stroke-dasharray': '5 4',
      }));
      svg.append(svgElement('rect', {
        x: Math.min(x + 3, 648), y: 5, width: 168, height: 20, fill: '#ffffff',
      }));
      const marker = svgElement('text', { x: Math.min(x + 5, 650), y: 21, fill: '#774001' });
      marker.textContent = `${threshold} nt review marker`;
      svg.append(marker);
    }
    frame.append(svg);
    const caption = document.createElement('p');
    caption.className = 'panel-note';
    caption.textContent = `${bins.length} equal-width bins; blue counts loci inside the selected range, `
      + `grey counts the rest. The ${threshold} nt marker appears on CDS charts when it falls within the axis.`;
    frame.append(caption);
    return frame;
  }
}
