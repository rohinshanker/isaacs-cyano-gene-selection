/**
 * The result list under the "Find a gene" box.
 *
 * A datalist alone only ever resolved a locus tag. This shows what matched, says
 * which field it matched on, and lets a gene be pinned or shortlisted without
 * touching the map.
 */
import { searchGenes, SEARCH_RESULT_LIMIT } from '../core/gene-search.js';
import { formatCount } from './format.js';

export class GeneSearchResults {
  /**
   * @param {HTMLElement} host
   * @param {{onPin: (index: number) => void, onShortlist: (index: number) => void,
   *   isShortlisted: (id: string) => boolean}} handlers
   */
  constructor(host, handlers) {
    this.host = host;
    this.handlers = handlers;
    this.genes = [];
    this.query = '';
    this.host.hidden = true;
  }

  /** @param {Array<object>} genes the dataset's genes, searched in place. */
  setGenes(genes) {
    this.genes = genes;
  }

  /** Run a query and render it. An empty query clears the list. */
  search(query) {
    this.query = query;
    this.render();
    return this.result;
  }

  /** Re-render the current query, so shortlist buttons reflect the live state. */
  refresh() {
    if (this.query) this.render();
  }

  render() {
    const host = this.host;
    host.replaceChildren();
    if (!this.query.trim()) {
      host.hidden = true;
      this.result = null;
      return;
    }
    host.hidden = false;
    const result = searchGenes(this.genes, this.query, { limit: SEARCH_RESULT_LIMIT });
    this.result = result;

    const status = document.createElement('p');
    status.className = 'search-status';
    if (result.total === 0) {
      // Never a silent empty state: say what was searched and what to try.
      status.textContent = `Nothing matches “${this.query.trim()}”. Searching covers the locus `
        + 'tag, the gene name, and the product description. Try a shorter word, or the '
        + 'name the annotation uses.';
      host.append(status);
      return;
    }
    status.textContent = `${formatCount(result.total)} gene`
      + `${result.total === 1 ? '' : 's'} match`
      + `${result.total === 1 ? 'es' : ''} “${this.query.trim()}”.`;
    host.append(status);

    if (result.aliasesUsed.length > 0) {
      // A match reached through an alias is not what the user literally typed, so
      // the page says so rather than presenting it as a direct hit.
      const note = document.createElement('p');
      note.className = 'search-alias-note';
      note.textContent = `Also searched for the wording this genome's annotation uses for `
        + `${result.aliasesUsed.join(', ')}.`;
      host.append(note);
    }

    const list = document.createElement('ul');
    list.className = 'search-results';
    for (const hit of result.shown) {
      list.append(this.renderRow(hit));
    }
    host.append(list);

    if (result.hiddenCount > 0) {
      const more = document.createElement('p');
      more.className = 'search-status';
      more.textContent = `${formatCount(result.hiddenCount)} more not shown. `
        + 'Type more of the name to narrow it down.';
      host.append(more);
    }
  }

  renderRow(hit) {
    const { gene, index } = hit;
    const item = document.createElement('li');
    item.className = 'search-result';

    const text = document.createElement('div');
    text.className = 'search-result-text';
    const heading = document.createElement('p');
    heading.className = 'search-result-name';
    const tag = document.createElement('span');
    tag.className = 'locus-tag';
    tag.textContent = gene.id;
    heading.append(tag);
    if (gene.name) {
      const name = document.createElement('b');
      name.textContent = ` ${gene.name}`;
      heading.append(name);
    }
    const matched = document.createElement('span');
    matched.className = 'search-result-field';
    matched.textContent = hit.alias
      ? ` matched ${hit.matchedOn} via ${hit.alias}`
      : ` matched ${hit.matchedOn}`;
    heading.append(matched);
    const product = document.createElement('p');
    product.className = 'search-result-product';
    product.textContent = gene.product ?? 'no product description';
    text.append(heading, product);

    const actions = document.createElement('div');
    actions.className = 'search-result-actions';
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'chip-button';
    pin.textContent = 'Pin';
    pin.setAttribute('aria-label', `Pin ${gene.id} in the gene panel`);
    pin.addEventListener('click', () => this.handlers.onPin(index));

    const shortlisted = this.handlers.isShortlisted(gene.id);
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'chip-button';
    add.textContent = shortlisted ? 'Shortlisted' : 'Shortlist';
    add.disabled = shortlisted;
    add.setAttribute('aria-label', shortlisted
      ? `${gene.id} is already on the shortlist`
      : `Add ${gene.id} to the shortlist`);
    add.addEventListener('click', () => this.handlers.onShortlist(index));

    actions.append(pin, add);
    item.append(text, actions);
    return item;
  }
}
