/**
 * Gene detail panel.
 *
 * Hovering previews a gene, clicking pins it. Every metric is shown with its
 * unit, its one-line description from the dataset, and its percentile against
 * the genome, because a bare number does not tell a bench scientist whether the
 * value is unusual.
 */
import { formatValue, formatDelta, formatPercentile, formatCount, formatSpan, MISSING } from './format.js';
import {
  describeExpressionSource, isExpressionMetric, isExpressionProxyMetric, expressionBasisOf,
} from '../core/metric-registry.js';
import { annotationEvidenceModel } from '../core/annotation-evidence.js';

/** Baseline context stays visible; scheme-only results open only when a scheme exists. */
const BASE_OPEN_FAMILIES = new Set(['Size', 'Translation']);
const SCHEME_OPEN_FAMILIES = new Set(['Recoding load', 'Change from wild type']);

export function metricFamilyStartsOpen(family, schemeActive) {
  return BASE_OPEN_FAMILIES.has(family)
    || (schemeActive && SCHEME_OPEN_FAMILIES.has(family));
}

const DELTA_ROWS = [
  { label: 'GC3', unit: 'fraction', wild: 'recodedGc3', recoded: 'recodedGc3', delta: 'dGc3' },
  { label: 'CAI', unit: 'index 0-1', wild: 'recodedCai', recoded: 'recodedCai', delta: 'dCai' },
  { label: 'tAI', unit: 'index 0-1', wild: 'recodedTai', recoded: 'recodedTai', delta: 'dTai' },
  { label: 'ENC', unit: 'codons', wild: 'recodedEnc', recoded: 'recodedEnc', delta: 'dEnc' },
  { label: 'Codon-pair score', unit: 'mean log ratio', wild: 'recodedCps', recoded: 'recodedCps', delta: 'dCps' },
];

function cell(text, className) {
  const element = document.createElement('td');
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function labelledList(label, values) {
  const row = document.createElement('div');
  const term = document.createElement('dt');
  term.textContent = label;
  const detail = document.createElement('dd');
  if (values.length === 0) {
    detail.textContent = 'None recorded';
  } else {
    const list = document.createElement('ul');
    for (const value of values) {
      const item = document.createElement('li');
      item.textContent = value;
      list.append(item);
    }
    detail.append(list);
  }
  row.append(term, detail);
  return row;
}

function annotationDisclosure(gene, meta) {
  const model = annotationEvidenceModel(gene, meta);
  if (!model) return null;
  const details = document.createElement('details');
  details.className = 'metric-group annotation-evidence';
  const summary = document.createElement('summary');
  summary.textContent = 'Annotation evidence and recoding context';
  const intro = document.createElement('p');
  intro.className = 'panel-note';
  intro.textContent = `Pinned RefSeq release ${model.releaseId}. Overlap and nearby-RNA rows are `
    + 'coordinate evidence, not proof of regulation. GO rows retain their evidence codes and are '
    + 'not collapsed into pathway or functional-category claims.';
  const list = document.createElement('dl');
  list.className = 'annotation-evidence-list';
  list.append(
    labelledList('Replicon', [model.replicon]),
    labelledList('Annotation method', model.methods),
    labelledList('Inference', model.inferences),
    labelledList('Overlapping CDS', model.overlaps.map((entry) => entry.text)),
    labelledList('Nearby non-coding RNA (≤250 nt)', model.nearby.map((entry) => entry.text)),
    labelledList('GO relationships', model.go.map((entry) => entry.text)),
  );
  details.append(summary, intro, list);
  if (model.attribution) {
    const source = document.createElement('p');
    source.className = 'panel-note';
    source.textContent = `GO: ${model.attribution.creator}; ${model.attribution.license}; `
      + `${model.attribution.source}`;
    details.append(source);
  }
  return details;
}

export class SidePanel {
  /**
   * @param {HTMLElement} host
   * @param {{onShortlistToggle: (index: number) => void}} handlers
   */
  constructor(host, handlers) {
    this.host = host;
    this.handlers = handlers;
  }

  /**
   * @param {{index: number, isPinned: boolean, dataset: object, registry: object,
   *   percentileOf: (key: string, value: number) => number, schemeActive: boolean,
   *   live: object, inShortlist: boolean}} state
   */
  update(state) {
    const { index, dataset } = state;
    this.host.replaceChildren();
    if (index < 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'Hover a gene on the map to preview it here. Click, or press Enter while '
        + 'the map has keyboard focus, to pin it.';
      this.host.append(empty);
      return;
    }

    const gene = dataset.genes[index];
    const header = document.createElement('div');
    header.className = 'gene-header';

    const title = document.createElement('h3');
    title.className = 'gene-title';
    title.textContent = gene.id;
    const name = document.createElement('span');
    name.className = 'gene-name';
    name.textContent = gene.name ?? MISSING;
    title.append(' ', name);

    const status = document.createElement('p');
    status.className = 'gene-status';
    status.textContent = state.isPinned ? 'Pinned' : 'Preview — click the dot to pin it';

    const product = document.createElement('p');
    product.className = 'gene-product';
    product.textContent = gene.product ?? MISSING;

    const location = document.createElement('p');
    location.className = 'gene-location';
    location.textContent = `${gene.seqid} ${formatSpan(gene.start, gene.end, gene.strand)} · `
      + `${formatCount(gene.lengthNt)} nt · ${formatCount(gene.lengthCodons)} sense codons`
      + (gene.terminalStop ? ` · stops with ${gene.terminalStop}` : '');

    const shortlistButton = document.createElement('button');
    shortlistButton.type = 'button';
    shortlistButton.className = state.inShortlist ? 'chip-button active' : 'chip-button';
    shortlistButton.textContent = state.inShortlist
      ? 'Remove from shortlist'
      : 'Add to shortlist';
    shortlistButton.addEventListener('click', () => this.handlers.onShortlistToggle(index));

    header.append(title, status, product, location);

    if (gene.translationalException) {
      const flag = document.createElement('p');
      flag.className = 'gene-flag';
      const label = document.createElement('strong');
      label.textContent = `Translational exception: ${gene.translationalException.replace(/_/g, ' ')}. `;
      const text = document.createElement('span');
      text.textContent = 'This gene only translates correctly through a programmed event in the '
        + 'ribosome, so recoding it is high risk.';
      flag.append(label, text);
      header.append(flag);
    }
    if (Array.isArray(gene.cdsSegments) && gene.cdsSegments.length > 1) {
      const spliced = document.createElement('p');
      spliced.className = 'gene-flag';
      const label = document.createElement('strong');
      label.textContent = `Discontinuous coding sequence: ${gene.cdsSegments.length} segments. `;
      const text = document.createElement('span');
      text.textContent = 'The coding length is shorter than the span between its coordinates.';
      spliced.append(label, text);
      header.append(spliced);
    }

    header.append(shortlistButton);
    this.host.append(header);

    const annotation = annotationDisclosure(gene, dataset.meta);
    if (annotation) this.host.append(annotation);

    if (state.schemeActive) {
      const section = document.createElement('section');
      section.className = 'delta-section';
      const heading = document.createElement('h4');
      heading.textContent = 'Wild type against recoded';
      const table = document.createElement('table');
      table.className = 'delta-table';
      const head = document.createElement('thead');
      head.innerHTML = '<tr><th scope="col">Metric</th><th scope="col">Wild type</th>'
        + '<th scope="col">Recoded</th><th scope="col">Change</th></tr>';
      const body = document.createElement('tbody');
      for (const row of DELTA_ROWS) {
        const metric = { integer: false };
        const wild = dataset.baseline[row.wild][index];
        const recoded = state.live[row.recoded][index];
        const delta = state.live[row.delta][index];
        const tr = document.createElement('tr');
        const label = document.createElement('th');
        label.scope = 'row';
        label.textContent = row.label;
        const unit = document.createElement('span');
        unit.className = 'row-unit';
        unit.textContent = row.unit;
        label.append(' ', unit);
        tr.append(
          label,
          cell(formatValue(metric, wild), 'numeric'),
          cell(formatValue(metric, recoded), 'numeric'),
          cell(formatDelta(metric, delta), delta < 0 ? 'numeric down' : delta > 0 ? 'numeric up' : 'numeric'),
        );
        body.append(tr);
      }
      table.append(head, body);
      const note = document.createElement('p');
      note.className = 'panel-note';
      note.textContent = 'Both columns are recomputed in your browser from the same sequence, so '
        + 'the change is directly comparable.';
      section.append(heading, table, note);
      this.host.append(section);
    }

    for (const family of state.registry.families) {
      const metrics = state.registry.metrics.filter((metric) => metric.family === family);
      if (metrics.length === 0) continue;
      const details = document.createElement('details');
      details.className = 'metric-group';
      details.open = metricFamilyStartsOpen(family, state.schemeActive);
      const summary = document.createElement('summary');
      summary.textContent = `${family} (${metrics.length})`;
      const table = document.createElement('table');
      table.className = 'metric-table';
      const body = document.createElement('tbody');
      for (const metric of metrics) {
        const value = metric.read(index);
        const tr = document.createElement('tr');
        const label = document.createElement('th');
        label.scope = 'row';
        const labelText = document.createElement('span');
        labelText.className = 'metric-label';
        labelText.textContent = metric.label;
        const desc = document.createElement('span');
        desc.className = 'metric-desc';
        desc.textContent = metric.desc ?? '';
        label.append(labelText, desc);

        const valueCell = document.createElement('td');
        valueCell.className = 'numeric';
        valueCell.textContent = formatValue(metric, value);
        const unit = document.createElement('span');
        unit.className = 'row-unit';
        unit.textContent = metric.unit ?? '';
        valueCell.append(' ', unit);
        if (!Number.isFinite(value)) {
          valueCell.classList.add('missing');
          const hidden = document.createElement('span');
          hidden.className = 'visually-hidden';
          hidden.textContent = 'no value';
          valueCell.append(hidden);
        }
        // A measured expression value says per gene whether it is a measurement,
        // a proxy standing in, or nothing at all. The proxy metric is its own row.
        if (isExpressionMetric(metric) && !isExpressionProxyMetric(metric)) {
          const { basis, short, text } = expressionBasisOf(gene, metric, value);
          const tag = document.createElement('span');
          tag.className = `basis-tag basis-${basis}`;
          tag.textContent = short;
          tag.title = text;
          valueCell.append(document.createElement('br'), tag);
        }

        const percentile = state.percentileOf(metric.key, value);
        const rankCell = document.createElement('td');
        rankCell.className = 'rank-cell';
        const rankText = document.createElement('span');
        rankText.className = 'rank-text';
        rankText.textContent = formatPercentile(percentile);
        const track = document.createElement('span');
        track.className = 'rank-track';
        const fill = document.createElement('span');
        fill.className = 'rank-fill';
        fill.style.width = Number.isFinite(percentile) ? `${percentile * 100}%` : '0%';
        track.append(fill);
        rankCell.append(rankText, track);

        tr.append(label, valueCell, rankCell);
        body.append(tr);

        // A borrowed measurement says so beside the number, not in a tooltip.
        if (metric.provenance) {
          const noteRow = document.createElement('tr');
          const noteCell = document.createElement('td');
          noteCell.colSpan = 3;
          noteCell.className = metric.provenance.isTargetOrganism === false
            ? 'provenance-warning' : 'panel-note';
          noteCell.textContent = describeExpressionSource(metric.provenance);
          noteRow.append(noteCell);
          body.append(noteRow);
        }
      }
      table.append(body);
      details.append(summary, table);
      this.host.append(details);
    }
  }
}
