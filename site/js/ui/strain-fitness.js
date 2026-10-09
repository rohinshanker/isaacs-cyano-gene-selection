/**
 * The Strain fitness tab: whole-strain growth and Biolog environment values.
 *
 * This is the one view whose rows are strains rather than genes. Nothing here
 * reaches a colour, metric, or axis registry, and the tab's own blurb says so
 * above the panel, because a reader who has spent the session colouring genes
 * would otherwise reasonably expect to be able to colour by these numbers.
 *
 * Two rules shape every value on screen:
 *
 * - **Nothing is shown without the unit the file declares.** The site holds no
 *   default unit for any of these quantities, so each table repeats the source's
 *   own words — including for the Biolog values, whose scale and reference the
 *   source states and this build never assumes.
 * - **Every value names its strain, scheme, condition and source.** Each table
 *   row carries strain, scheme and condition, and the selected context line
 *   above them repeats the selection and the source for the table as a whole.
 *
 * The layer is organism-neutral: any release may publish `strain_fitness.json`,
 * and a release that does not gets the page's usual short sentence for an
 * optional file that is absent. `docs/validation/strain-fitness.md` is the
 * runbook.
 */
import { pendingNote } from './loading-note.js';
import { tanDisclosure } from './disclosures.js';
import { formatCount, formatValue, MISSING } from './format.js';
import {
  GROWTH_STATUS, GROWTH_STATUS_LABELS, growthSummary, growthTsv, selectGrowth, selectWells,
  selectionLabels, wellsTsv,
} from '../core/strain-fitness.js';

export const STRAIN_FITNESS_TAB = Object.freeze({
  id: 'strain-fitness',
  name: 'Strain fitness',
  blurb: 'Each row is a whole strain grown in one condition, not a gene. These measurements '
    + 'describe strains, so none of them colours the map or appears on a gene axis.',
  source: '',
});

/** Wells per page. Several thousand rows cannot be put on screen at once. */
const PAGE_SIZE = 40;

/** What the panel says when the release does not publish the layer. */
export const UNAVAILABLE_TEXT = 'Strain fitness measurements are unavailable in this dataset.';

function paragraph(text, className = 'panel-note') {
  const note = document.createElement('p');
  note.className = className;
  note.textContent = text;
  return note;
}

/** `1 well` / `24 wells`, so a filtered table does not read as a typo. */
function plural(count, noun) {
  return `${formatCount(count)} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * A metadata key as a reader sees it: the file's own key, split at its humps
 * and given a leading capital. The words are the source's; only the shape
 * changes, so nothing is renamed on the file's behalf.
 */
function humanise(key) {
  if (/^[A-Z0-9]+$/.test(key)) return key;
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function option(value, label) {
  const element = document.createElement('option');
  element.value = value;
  element.textContent = label;
  return element;
}

function field(labelText, control) {
  const label = document.createElement('label');
  label.textContent = labelText;
  label.append(control);
  return label;
}

/** A numbered replicate series as `24.1 · 25.0 · 24.4`, missing values included. */
function replicateText(series) {
  if (series.length === 0) return MISSING;
  return series.map((entry) => `${entry.replicate}: ${formatValue(null, entry.value)}`).join(' · ');
}

/**
 * `1.82 ± 0.05`, or the value alone, or the missing mark.
 *
 * A null never becomes a zero and a measured zero never becomes the missing
 * mark, which is the whole reason this does not go through a metric formatter.
 */
function withSd(value, sd) {
  if (value === null) return MISSING;
  const text = formatValue(null, value);
  return sd === null ? text : `${text} ± ${formatValue(null, sd)}`;
}

/**
 * A table with fixed columns inside a horizontal scroller.
 *
 * Fixed rather than automatic, with an explicit share per column: these cells
 * hold source labels that may be one long word, and a column sized to its own
 * content would be free to collapse to a single character under the wrapping
 * these labels need. The widths are the layout; the scroller is what absorbs a
 * narrow screen.
 *
 * @param {Array<{label: string, unit?: string, width: number, numeric?: boolean}>} headers
 */
function table(headers, rows, caption) {
  const scroll = document.createElement('div');
  scroll.className = 'table-scroll';
  const element = document.createElement('table');
  element.className = 'fitness-table';
  const captionElement = document.createElement('caption');
  captionElement.textContent = caption;
  element.append(captionElement);
  const group = document.createElement('colgroup');
  for (const { width } of headers) {
    const column = document.createElement('col');
    column.style.width = `${width}%`;
    group.append(column);
  }
  element.append(group);
  const head = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (const { label, unit, numeric } of headers) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.append(label);
    // The declared unit rides under its column name rather than inside it, so
    // a long one stays readable and the name stays scannable.
    if (unit) {
      const note = document.createElement('span');
      note.className = 'fitness-unit';
      note.textContent = unit;
      cell.append(note);
    }
    if (numeric) cell.className = 'numeric';
    headerRow.append(cell);
  }
  head.append(headerRow);
  const body = document.createElement('tbody');
  for (const row of rows) {
    const line = document.createElement('tr');
    row.forEach((value, index) => {
      const cell = document.createElement(index === 0 ? 'th' : 'td');
      if (index === 0) cell.scope = 'row';
      if (headers[index]?.numeric) cell.className = 'numeric';
      cell.textContent = value;
      line.append(cell);
    });
    body.append(line);
  }
  element.append(head, body);
  scroll.append(element);
  return scroll;
}

/** The strain column's text: the exact label, with its scheme beneath it. */
function strainCell(record) {
  const segments = record.strain.scheme.segments;
  return `${record.strain.label} — ${record.strain.scheme.label}`
    + (segments ? ` (${segments})` : '');
}

function downloadTsv(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/tab-separated-values;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** A file-name fragment: lower case, words joined by hyphens. */
function slug(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'all';
}

export class StrainFitnessPanel {
  /**
   * @param {HTMLElement} host
   * @param {{organism?: object, onAnnounce?: (message: string) => void}} options
   */
  constructor(host, { organism = null, onAnnounce = () => {} } = {}) {
    this.host = host;
    this.organism = organism;
    this.onAnnounce = onAnnounce;
    this.selection = { strainId: 'all', conditionId: 'all', query: '' };
    this.page = 0;
    this.built = false;
    this.layer = null;
  }

  /**
   * @param {object|null} layer the validated layer, or null when the release
   *   does not publish it or it has not landed.
   * @param {'loading'|'failed'|null} pending the file's unsettled state.
   */
  update(layer, pending = null) {
    if (!layer) {
      // Loading and failed are not "unavailable": one is unknown and the other
      // is a layer that exists and could not be read.
      this.host.replaceChildren(pending
        ? pendingNote(pending, 'strain fitness measurements')
        : paragraph(UNAVAILABLE_TEXT, 'panel-note'));
      this.built = false;
      this.layer = null;
      return;
    }
    const changed = this.layer !== layer;
    this.layer = layer;
    if (changed) {
      this.selection = { strainId: 'all', conditionId: 'all', query: '' };
      this.page = 0;
      this.built = false;
    }
    if (!this.built) this.build();
    this.renderResults();
  }

  build() {
    const layer = this.layer;
    this.host.replaceChildren();
    const title = document.createElement('h2');
    title.textContent = 'Strain fitness';
    // The tab's own blurb already stands above the panel and says what these
    // rows are; repeating it here would be the same sentence twice on screen.
    const children = [title];
    if (layer.provenanceClass !== 'published') {
      children.push(tanDisclosure(paragraph('These values are synthetic test data, not measurements. '
        + 'They exist so the interface can be exercised and must not be read as evidence.',
      'provenance-warning'), 'Evidence status'));
    }
    children.push(this.buildSource(), this.buildMetadata(), this.buildControls());
    this.context = paragraph('', 'fitness-context');
    this.context.setAttribute('role', 'status');
    this.summary = paragraph('', 'length-summary');
    this.growthHost = document.createElement('div');
    this.growthHost.className = 'fitness-section';
    this.wellHost = document.createElement('div');
    this.wellHost.className = 'fitness-section';
    children.push(this.context, this.summary, this.growthHost, this.wellHost);
    this.host.append(...children);
    this.built = true;
  }

  /** The citation, the pinned source file, and the comparison the source made. */
  buildSource() {
    const { source } = this.layer;
    const block = document.createElement('div');
    block.className = 'fitness-source';
    const citation = document.createElement('p');
    citation.className = 'panel-note';
    citation.append('Source: ');
    if (source.doi) {
      const link = document.createElement('a');
      link.href = `https://doi.org/${source.doi}`;
      link.textContent = source.citation;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      citation.append(link);
    } else {
      citation.append(source.citation);
    }
    citation.append(`. ${source.sourceFile}`);
    if (source.sheet) citation.append(`, sheet ${source.sheet}`);
    citation.append(`, retrieved ${source.retrieved}.`);
    const pin = paragraph(`Pinned by SHA-256 ${source.sourceFileSha256}.`);
    block.append(citation, pin);
    if (source.comparedAgainst) {
      block.append(paragraph(`The source compares these strains against ${source.comparedAgainst}.`));
    }
    return block;
  }

  /** Each layer's declared units and its measurement metadata, as the file states them. */
  buildMetadata() {
    const details = document.createElement('details');
    details.className = 'fitness-metadata';
    const summary = document.createElement('summary');
    summary.textContent = 'Units and measurement metadata';
    const list = document.createElement('dl');
    list.className = 'fitness-definitions';
    const entries = [];
    if (this.layer.growth) {
      entries.push(['Doubling time', this.layer.growth.units.doublingTime],
        ['Maximum OD600', this.layer.growth.units.maximumOd600],
        ...Object.entries(this.layer.growth.metadata)
          .map(([key, value]) => [humanise(key), String(value)]));
    }
    if (this.layer.biolog) {
      entries.push(['Biolog value', this.layer.biolog.units.value],
        ['Biolog reference', this.layer.biolog.units.reference],
        ['Biolog normalization', this.layer.biolog.units.normalization],
        ...Object.entries(this.layer.biolog.metadata)
          .map(([key, value]) => [humanise(key), String(value)]));
    }
    for (const [term, definition] of entries) {
      const name = document.createElement('dt');
      name.textContent = term;
      const value = document.createElement('dd');
      value.textContent = definition;
      list.append(name, value);
    }
    details.append(summary, list);
    return details;
  }

  buildControls() {
    const controls = document.createElement('div');
    controls.className = 'fitness-controls';
    this.strain = document.createElement('select');
    this.strain.append(option('all', 'All strains'));
    for (const strain of this.layer.strains) {
      this.strain.append(option(strain.id, `${strain.label} — ${strain.scheme.label}`));
    }
    this.strain.value = 'all';
    this.strain.addEventListener('change', () => {
      this.selection = { ...this.selection, strainId: this.strain.value };
      this.page = 0;
      this.renderResults();
    });
    this.condition = document.createElement('select');
    this.condition.append(option('all', 'All conditions'));
    for (const condition of this.layer.conditions) {
      this.condition.append(option(condition.id, condition.label));
    }
    this.condition.value = 'all';
    this.condition.addEventListener('change', () => {
      this.selection = { ...this.selection, conditionId: this.condition.value };
      this.page = 0;
      this.renderResults();
    });
    controls.append(field('Strain and scheme', this.strain), field('Condition', this.condition));
    if (this.layer.biolog) {
      this.query = document.createElement('input');
      this.query.type = 'search';
      this.query.placeholder = 'Substrate, well, or plate';
      this.query.addEventListener('input', () => {
        this.selection = { ...this.selection, query: this.query.value };
        this.page = 0;
        this.renderResults();
      });
      controls.append(field('Find an environment', this.query));
    }
    return controls;
  }

  /** The persistent selected-context line every table below it is read under. */
  renderContext(growthCount, wellCount) {
    const labels = selectionLabels(this.layer, this.selection);
    const parts = [
      `Strain: ${labels.strain}`,
      `Scheme: ${labels.scheme}${labels.segments
        ? ` (${labels.segments})` : ''}`,
      `Condition: ${labels.condition}`,
      `Source: ${this.layer.source.studyId ?? this.layer.source.sourceFile}`,
    ];
    this.context.textContent = parts.join(' · ');
    const summary = growthSummary(selectGrowth(this.layer, this.selection));
    const counted = [plural(growthCount, 'growth record'), plural(summary.strains, 'growth strain')];
    if (summary.noGrowth > 0) counted.push(`${formatCount(summary.noGrowth)} with no growth detected`);
    if (this.layer.biolog) counted.push(plural(wellCount, 'Biolog well'));
    this.summary.textContent = `${counted.join(', ')}.`;
  }

  renderResults() {
    const growth = selectGrowth(this.layer, this.selection);
    const wells = selectWells(this.layer, this.selection);
    this.renderContext(growth.length, wells.length);
    this.renderGrowth(growth);
    this.renderWells(wells);
  }

  renderGrowth(records) {
    if (!this.layer.growth) {
      this.growthHost.replaceChildren(
        paragraph('This source publishes no growth-curve layer.'),
      );
      return;
    }
    const { units } = this.layer.growth;
    const heading = document.createElement('h3');
    heading.textContent = 'Growth';
    const headers = [
      { label: 'Strain and scheme', width: 20 },
      { label: 'Condition', width: 16 },
      { label: 'Status', width: 10 },
      { label: 'Doubling time', unit: units.doublingTime, width: 14, numeric: true },
      { label: 'Doubling-time replicates', width: 14, numeric: true },
      { label: 'Maximum OD600', unit: units.maximumOd600, width: 13, numeric: true },
      { label: 'Maximum-OD600 replicates', width: 13, numeric: true },
    ];
    const rows = records.map((record) => [
      strainCell(record),
      record.condition.label,
      GROWTH_STATUS_LABELS[record.growthStatus],
      // No growth has no doubling time: the cell is the missing mark, never a 0.
      record.growthStatus === GROWTH_STATUS.NO_GROWTH
        ? MISSING : withSd(record.doublingTimeMinutes, record.doublingTimeSdMinutes),
      replicateText(record.doublingTimeReplicates),
      withSd(record.maximumOd600, record.maximumOd600Sd),
      replicateText(record.maximumOd600Replicates),
    ]);
    const children = [heading];
    if (rows.length === 0) {
      children.push(paragraph('No growth record matches this selection.'));
    } else {
      children.push(table(headers, rows,
        `Growth of ${plural(rows.length, 'strain-condition pair')}. `
        + `Doubling time in ${units.doublingTime}; maximum OD600 as ${units.maximumOd600}.`));
      children.push(this.exportButton('growth', records.length,
        () => growthTsv(this.layer, this.selection)));
    }
    this.growthHost.replaceChildren(...children);
  }

  renderWells(records) {
    if (!this.layer.biolog) {
      this.wellHost.replaceChildren(paragraph('This source publishes no Biolog environment layer.'));
      return;
    }
    const { units } = this.layer.biolog;
    const heading = document.createElement('h3');
    heading.textContent = 'Biolog environments';
    const declared = paragraph(`Values are ${units.value}, referenced to ${units.reference}, `
      + `normalised as ${units.normalization}. A negative value is a real result and a measured `
      + 'zero is not a missing one.');
    const pages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
    this.page = Math.min(Math.max(0, this.page), pages - 1);
    const shown = records.slice(this.page * PAGE_SIZE, (this.page + 1) * PAGE_SIZE);
    const headers = [
      { label: 'Strain and scheme', width: 22 },
      { label: 'Condition', width: 16 },
      { label: 'Plate', width: 14 },
      { label: 'Well', width: 7 },
      { label: 'Substrate', width: 21 },
      { label: 'Value', unit: units.value, width: 20, numeric: true },
    ];
    const rows = shown.map((record) => [
      strainCell(record), record.condition.label, record.plate.label, record.well,
      record.substrate, formatValue(null, record.value),
    ]);
    const children = [heading, declared];
    if (rows.length === 0) {
      children.push(paragraph('No environment matches this selection.'));
    } else {
      children.push(table(headers, rows,
        `${plural(records.length, 'well')}, showing ${formatCount(shown.length)}. `
        + `Values in ${units.value}, referenced to ${units.reference}.`));
      children.push(this.buildPaging(pages, records.length));
      children.push(this.exportButton('biolog', records.length,
        () => wellsTsv(this.layer, this.selection)));
    }
    this.wellHost.replaceChildren(...children);
  }

  buildPaging(pages, total) {
    const paging = document.createElement('div');
    paging.className = 'fitness-paging';
    const move = (delta) => {
      this.page += delta;
      this.renderWells(selectWells(this.layer, this.selection));
    };
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'chip-button';
    previous.textContent = 'Previous';
    previous.disabled = this.page === 0;
    previous.addEventListener('click', () => move(-1));
    const label = document.createElement('span');
    label.textContent = `Page ${this.page + 1} of ${pages}, ${plural(total, 'well')}`;
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'chip-button';
    next.textContent = 'Next';
    next.disabled = this.page >= pages - 1;
    next.addEventListener('click', () => move(1));
    paging.append(previous, label, next);
    return paging;
  }

  /**
   * One download control. The file holds the whole selection, not the page on
   * screen: a page is a reading convenience and not a result.
   */
  exportButton(kind, rows, build) {
    const row = document.createElement('div');
    row.className = 'button-row';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip-button';
    button.textContent = kind === 'growth'
      ? 'Download growth summary (TSV)' : 'Download Biolog values (TSV)';
    const status = paragraph('', 'panel-note');
    status.setAttribute('role', 'status');
    button.addEventListener('click', () => {
      // A non-default organism's files carry its tag, as its other exports do.
      const tag = this.organism?.exportTag ?? null;
      const name = [tag, 'strain-fitness', kind, slug(this.selection.strainId),
        slug(this.selection.conditionId)].filter(Boolean).join('_');
      downloadTsv(build(), `${name}.tsv`);
      status.textContent = `Downloaded ${name}.tsv with ${plural(rows, 'row')}, `
        + 'its units and its source provenance.';
      this.onAnnounce(status.textContent);
    });
    row.append(button);
    const block = document.createElement('div');
    block.className = 'fitness-export';
    block.append(row, status);
    return block;
  }
}
