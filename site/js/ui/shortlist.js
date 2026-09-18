/**
 * Candidate shortlist: a readable list, CSV export, and the disabled folding
 * affordance.
 *
 * The lab prunes the shortlist here rather than going back to the map, so each row
 * carries enough to judge the gene on: what it is, and what the active scheme
 * would cost it.
 */
import { csvField, formatCount, formatValue } from './format.js';

/**
 * Live metrics shown per row, in order, when a scheme is active. These are the two
 * a recoding decision turns on: how many edits, and how dense they get.
 */
const ROW_METRIC_KEYS = ['targetCount', 'maxLocalTargetDensity'];

/** Product text is the column that gives way first at a narrow viewport. */
const PRODUCT_LIMIT = 90;

function truncate(text, limit) {
  const value = String(text ?? '').trim();
  if (!value) return 'no product description';
  return value.length > limit ? `${value.slice(0, limit - 1)}\u2026` : value;
}

export class ShortlistPanel {
  /**
   * @param {HTMLElement} host
   * @param {{onRemove: (id: string) => void, onClear: () => void,
   *   onSelect: (id: string) => void}} handlers
   */
  constructor(host, handlers) {
    this.host = host;
    this.handlers = handlers;
    this.build();
  }

  build() {
    this.host.replaceChildren();
    this.list = document.createElement('ul');
    this.list.className = 'shortlist-list';

    const actions = document.createElement('div');
    actions.className = 'button-row';
    this.exportButton = document.createElement('button');
    this.exportButton.type = 'button';
    this.exportButton.className = 'chip-button';
    this.exportButton.textContent = 'Export CSV';
    this.exportButton.addEventListener('click', () => this.exportCsv());
    this.clearButton = document.createElement('button');
    this.clearButton.type = 'button';
    this.clearButton.className = 'chip-button danger';
    this.clearButton.textContent = 'Clear shortlist';
    this.clearButton.addEventListener('click', () => this.handlers.onClear());

    this.foldButton = document.createElement('button');
    this.foldButton.type = 'button';
    this.foldButton.className = 'chip-button';
    this.foldButton.textContent = 'Fold recoded RNA';
    this.foldButton.disabled = true;
    this.foldButton.id = 'fold-button';
    this.foldButton.setAttribute('aria-describedby', 'fold-note');
    const foldNote = document.createElement('p');
    foldNote.className = 'panel-note';
    foldNote.id = 'fold-note';
    foldNote.textContent = 'On-demand folding of recoded shortlisted genes is deliberately not '
      + 'available yet. Folding cannot run genome-wide in a browser, so it will arrive as a '
      + 'separate on-request calculation.';

    actions.append(this.exportButton, this.clearButton, this.foldButton);
    this.status = document.createElement('p');
    this.status.className = 'panel-note';
    this.status.setAttribute('role', 'status');

    this.host.append(this.list, this.status, actions, foldNote);
  }

  /**
   * @param {{ids: string[], dataset: object, registry: object}} state
   */
  update(state) {
    this.state = state;
    this.list.replaceChildren();
    if (state.ids.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'shortlist-empty';
      empty.textContent = 'Nothing shortlisted yet. Pin a gene and choose Add to shortlist, '
        + 'search for one and use its Shortlist button, or press S while the map has '
        + 'keyboard focus.';
      this.list.append(empty);
    }
    for (const id of state.ids) {
      this.list.append(this.renderRow(id, state));
    }
    this.status.textContent = `${formatCount(state.ids.length)} candidate`
      + `${state.ids.length === 1 ? '' : 's'} shortlisted.`;
    this.exportButton.disabled = state.ids.length === 0;
    this.clearButton.disabled = state.ids.length === 0;
  }

  /** One row: what the gene is, what the scheme costs it, and how to drop it. */
  renderRow(id, state) {
    const index = state.dataset.indexById.get(id);
    const gene = index === undefined ? null : state.dataset.genes[index];
    const item = document.createElement('li');
    item.className = 'shortlist-row';

    const text = document.createElement('div');
    text.className = 'shortlist-row-text';
    const select = document.createElement('button');
    select.type = 'button';
    select.className = 'shortlist-row-link';
    const tag = document.createElement('span');
    tag.className = 'locus-tag';
    tag.textContent = id;
    select.append(tag);
    if (gene?.name) {
      const name = document.createElement('b');
      name.textContent = ` ${gene.name}`;
      select.append(name);
    }
    select.setAttribute('aria-label', `Show ${id} in the gene panel`);
    select.addEventListener('click', () => this.handlers.onSelect(id));

    const product = document.createElement('p');
    product.className = 'shortlist-row-product';
    product.textContent = gene
      ? truncate(gene.product, PRODUCT_LIMIT)
      : 'not in this dataset';
    if (gene?.product) product.title = gene.product;
    text.append(select, product);

    const metrics = this.describeMetrics(index, state);
    if (metrics) {
      const burden = document.createElement('p');
      burden.className = 'shortlist-row-metrics';
      burden.textContent = metrics;
      text.append(burden);
    }

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'chip-button danger';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${id} from the shortlist`);
    remove.addEventListener('click', () => this.handlers.onRemove(id));

    item.append(text, remove);
    return item;
  }

  /**
   * The scheme-dependent figures for one row, or null when no scheme is set and
   * there is therefore nothing to report.
   */
  describeMetrics(index, state) {
    if (index === undefined || !state.schemeActive) return null;
    const parts = [];
    for (const key of ROW_METRIC_KEYS) {
      const metric = state.registry?.byKey.get(key);
      if (!metric) continue;
      const value = metric.read(index);
      if (!Number.isFinite(value)) continue;
      parts.push(`${metric.label} ${formatValue(metric, value)}`);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }

  /** Build the CSV text for the current shortlist: one row per gene, every metric. */
  buildCsv() {
    const { ids, dataset, registry } = this.state;
    const descriptive = ['id', 'name', 'product', 'seqid', 'start', 'end', 'strand'];
    const header = [...descriptive, ...registry.metrics.map((metric) => metric.key)];
    const units = [...descriptive.map(() => ''), ...registry.metrics.map((metric) => metric.unit ?? '')];
    const lines = [header.map(csvField).join(','), units.map(csvField).join(',')];
    for (const id of ids) {
      const index = dataset.indexById.get(id);
      if (index === undefined) continue;
      const gene = dataset.genes[index];
      const row = descriptive.map((key) => gene[key]);
      for (const metric of registry.metrics) {
        const value = metric.read(index);
        row.push(Number.isFinite(value) ? value : '');
      }
      lines.push(row.map(csvField).join(','));
    }
    return `${lines.join('\n')}\n`;
  }

  exportCsv() {
    const blob = new Blob([this.buildCsv()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'recoding-candidates.csv';
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
}
