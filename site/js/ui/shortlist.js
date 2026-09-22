/**
 * Candidate shortlist: a readable list, a reproducible export, and local folding.
 *
 * The lab prunes the shortlist here rather than going back to the map, so each row
 * carries enough to judge the gene on: what it is, and what the active scheme
 * would cost it. The export writes a CSV plus a manifest so two exports under two
 * schemes stay distinguishable without relying on filenames.
 */
import { formatCount, formatValue } from './format.js';
import { buildExport } from '../core/export-manifest.js';
import { FoldingPanel } from './folding-panel.js';
import { geneIdentity, geneIdentityDescription } from '../core/gene-identity.js';
import { createLocusTag } from './locus-tag.js';
import { annotationSourceView, isAllSources } from '../core/annotation-source.js';

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
    this.exportButton.textContent = 'Export CSV and manifest';
    this.exportButton.setAttribute('aria-describedby', 'export-note');
    this.exportButton.addEventListener('click', () => this.exportCsv());

    this.savedSchemesRow = document.createElement('div');
    this.savedSchemesRow.className = 'checkbox-row export-saved-row';
    this.savedSchemesInput = document.createElement('input');
    this.savedSchemesInput.type = 'checkbox';
    this.savedSchemesInput.id = 'export-saved-schemes';
    this.savedSchemesLabel = document.createElement('label');
    this.savedSchemesLabel.htmlFor = this.savedSchemesInput.id;
    this.savedSchemesRow.append(this.savedSchemesInput, this.savedSchemesLabel);

    this.exportNote = document.createElement('p');
    this.exportNote.className = 'panel-note';
    this.exportNote.id = 'export-note';
    this.exportNote.textContent = 'The export is a flat CSV with one row per gene and scheme, '
      + 'plus a manifest naming the dataset, its checksums, the full scheme map, and every '
      + 'metric definition. Each row carries the manifest and scheme identifiers.';
    this.clearButton = document.createElement('button');
    this.clearButton.type = 'button';
    this.clearButton.className = 'chip-button danger';
    this.clearButton.textContent = 'Clear shortlist';
    this.clearButton.addEventListener('click', () => this.handlers.onClear());

    const foldHost = document.createElement('section');
    foldHost.setAttribute('aria-label', 'On-demand RNA folding');
    this.folding = new FoldingPanel(foldHost);

    actions.append(this.exportButton, this.clearButton);
    this.status = document.createElement('p');
    this.status.className = 'panel-note';
    this.status.setAttribute('role', 'status');

    this.host.append(this.list, this.status, this.savedSchemesRow, actions, this.exportNote, foldHost);
  }

  /**
   * @param {{ids: string[], dataset: object, registry: object, schemeActive: boolean,
   *   schemes: {active: {name: string, map: object}, saved: Array<{name: string, map: object}>}}} state
   */
  update(state) {
    this.state = state;
    this.folding.update(state);
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
    const saved = state.schemes?.saved ?? [];
    this.savedSchemesRow.hidden = saved.length === 0 || state.ids.length === 0;
    this.savedSchemesLabel.textContent = `Also export the ${formatCount(saved.length)} saved `
      + `scheme${saved.length === 1 ? '' : 's'}, one row per gene and scheme`;
  }

  /** One row: what the gene is, what the scheme costs it, and how to drop it. */
  renderRow(id, state) {
    const index = state.dataset.indexById.get(id);
    const gene = index === undefined ? null : state.dataset.genes[index];
    const sources = state.annotationSources;
    // "All sources" reads the gene directly, unchanged; a narrower toggle set
    // reads only what the enabled sources annotated, leaving the rest blank.
    const view = gene && !isAllSources(sources)
      ? annotationSourceView(gene, state.dataset, sources) : gene;
    const item = document.createElement('li');
    item.className = 'shortlist-row';

    const text = document.createElement('div');
    text.className = 'shortlist-row-text';
    const select = document.createElement('button');
    select.type = 'button';
    select.className = 'shortlist-row-link';
    const tag = createLocusTag(gene ?? { id }, { focusable: false });
    select.append(tag);
    const geneName = geneIdentity(view);
    if (geneName?.kind === 'Gene symbol') {
      const name = document.createElement('b');
      name.textContent = ` ${geneName.text}`;
      select.append(name);
    }
    const description = gene ? geneIdentityDescription(view) : 'Not in this dataset';
    select.setAttribute('aria-label', `Show ${id} in the gene panel. ${description}`);
    select.title = description;
    select.addEventListener('click', () => this.handlers.onSelect(id));

    const product = document.createElement('p');
    product.className = 'shortlist-row-product';
    product.textContent = gene
      ? truncate(view.product, PRODUCT_LIMIT)
      : 'not in this dataset';
    if (view?.product) product.title = view.product;
    text.append(select, product);
    if (index !== undefined && state.filterMask && !state.filterMask[index]) {
      const hidden = document.createElement('p');
      hidden.className = 'provenance-warning';
      hidden.textContent = 'Outside the current map filters; retained in the shortlist and export.';
      text.append(hidden);
    }

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

  /** The schemes an export covers: the active one, plus the saved ones on request. */
  schemesToExport() {
    const active = this.state.schemes?.active ?? { name: '', map: {} };
    const saved = this.state.schemes?.saved ?? [];
    const includeSaved = !this.savedSchemesRow.hidden && this.savedSchemesInput.checked;
    return includeSaved ? [active, ...saved] : [active];
  }

  /** Build the export for the current shortlist without downloading it. */
  buildExport(generatedAt = new Date()) {
    const { ids, dataset, registry, filterState, filterMask, viewState, annotationSources } = this.state;
    return buildExport({
      dataset, registry, ids, schemes: this.schemesToExport(), generatedAt,
      filterState, filterMask, annotationSources,
      viewState: typeof viewState === 'function' ? viewState() : viewState,
      trRosettaRnaHandoffs: this.folding.handoffs(),
    });
  }

  exportCsv() {
    const result = this.buildExport();
    for (const file of result.files) {
      const blob = new Blob([file.content], { type: file.type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }
    const schemeCount = result.manifest.schemes.length;
    this.status.textContent = `Exported ${formatCount(result.rows.length)} row`
      + `${result.rows.length === 1 ? '' : 's'} for ${formatCount(schemeCount)} scheme`
      + `${schemeCount === 1 ? '' : 's'} as ${result.baseName}.csv, manifest `
      + `${result.manifest.manifestId}.`;
  }
}
