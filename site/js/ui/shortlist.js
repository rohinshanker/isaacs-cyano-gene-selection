/** Candidate shortlist: chips, CSV export, and the disabled folding affordance. */
import { csvField, formatCount } from './format.js';

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
    this.list.className = 'shortlist-chips';

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
      empty.textContent = 'Nothing shortlisted yet. Pin a gene and choose Add to shortlist, or '
        + 'press S while the map has keyboard focus.';
      this.list.append(empty);
    }
    for (const id of state.ids) {
      const index = state.dataset.indexById.get(id);
      const gene = index === undefined ? null : state.dataset.genes[index];
      const item = document.createElement('li');
      item.className = 'shortlist-chip';
      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'chip-link';
      select.textContent = gene?.name ? `${id} ${gene.name}` : id;
      select.addEventListener('click', () => this.handlers.onSelect(id));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'icon-button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove ${id} from the shortlist`);
      remove.addEventListener('click', () => this.handlers.onRemove(id));
      item.append(select, remove);
      this.list.append(item);
    }
    this.status.textContent = `${formatCount(state.ids.length)} candidate`
      + `${state.ids.length === 1 ? '' : 's'} shortlisted.`;
    this.exportButton.disabled = state.ids.length === 0;
    this.clearButton.disabled = state.ids.length === 0;
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
