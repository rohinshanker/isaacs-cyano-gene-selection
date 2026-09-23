/**
 * The result list under the "Find a gene" box.
 *
 * A datalist alone only ever resolved a locus tag. This shows what matched, says
 * which field it matched on, and lets a gene be pinned or shortlisted without
 * touching the map.
 */
import { searchGenes, SEARCH_RESULT_LIMIT } from '../core/gene-search.js';
import { formatCount } from './format.js';
import { createLocusTag } from './locus-tag.js';
import { geneIdentity, geneIdentityDescription } from '../core/gene-identity.js';

/** A repeated blur/change event must not replace a result while it is being clicked. */
export function shouldRenderSearch(currentQuery, nextQuery, currentResult) {
  return currentQuery !== nextQuery || currentResult === undefined;
}

/** Labels for the two independently reversible actions in a search result. */
export function searchActionState(pinned, shortlisted) {
  return {
    pin: pinned ? 'Unpin' : 'Pin',
    shortlist: shortlisted ? 'Remove' : 'Shortlist',
  };
}

/** The one-line GO suggestion under a row that matched a GO ID or term name. */
function goMatchLine(goMatch) {
  const term = goMatch.name ? ` — ${goMatch.name}` : '';
  const ambiguity = goMatch.mappingAmbiguity ? '; mapping ambiguous' : '';
  const obsolete = goMatch.isObsolete ? '; obsolete GO ID in the pinned name release' : '';
  return `${goMatch.id}${term} (${goMatch.evidenceCode} computational suggestion${ambiguity}${obsolete})`;
}

/**
 * Everything a result row shows, assembled without the DOM so the suite fails
 * on a missing binding before the page does.
 *
 * @param {{gene: object, index: number, matchedOn: string, alias?: string|null,
 *   goMatch?: object|null, categoryMatch?: string|null}} hit one entry of
 *   `searchGenes(...).shown`.
 * @param {{isPinned: (id: string) => boolean, isShortlisted: (id: string) => boolean}} handlers
 */
export function searchRowModel(hit, handlers) {
  const { gene, index } = hit;
  const geneName = geneIdentity(gene);
  const pinned = handlers.isPinned(gene.id);
  const shortlisted = handlers.isShortlisted(gene.id);
  const labels = searchActionState(pinned, shortlisted);
  const identity = geneIdentityDescription(gene);
  return {
    geneId: gene.id,
    index,
    symbol: geneName?.kind === 'Gene symbol' ? geneName.text : null,
    matched: hit.alias
      ? ` matched ${hit.matchedOn} via ${hit.alias}`
      : ` matched ${hit.matchedOn}`,
    product: gene.product ?? 'no product description',
    goLine: hit.goMatch ? goMatchLine(hit.goMatch) : null,
    categoryLine: hit.categoryMatch ? `Lab-reviewed category: ${hit.categoryMatch}` : null,
    pinned,
    shortlisted,
    labels,
    pinDescription: `${labels.pin} ${gene.id} ${pinned ? 'from' : 'in'} the gene panel. ${identity}`,
    shortlistDescription: shortlisted
      ? `Remove ${gene.id} from the shortlist. ${identity}`
      : `Add ${gene.id} to the shortlist. ${identity}`,
  };
}

export class GeneSearchResults {
  /**
   * @param {HTMLElement} host
   * @param {{onPin: (index: number) => void, onShortlist: (index: number) => void,
   *   isShortlisted: (id: string) => boolean, isPinned: (id: string) => boolean}} handlers
   */
  constructor(host, handlers) {
    this.host = host;
    this.handlers = handlers;
    this.genes = [];
    this.goTerms = null;
    this.dataset = null;
    this.query = '';
    this.host.hidden = true;
  }

  /**
   * @param {Array<object>} genes the dataset's genes, searched in place.
   * @param {object|null} goTerms
   * @param {object|null} dataset the full dataset; omit to keep the previous dataset.
   */
  setGenes(genes, goTerms = null, dataset = this.dataset) {
    this.genes = genes;
    this.goTerms = goTerms;
    this.dataset = dataset;
  }

  /** Run a query and render it. An empty query clears the list. */
  search(query) {
    if (!shouldRenderSearch(this.query, query, this.result)) return this.result;
    this.query = query;
    this.render();
    return this.result;
  }

  /** Re-render the current query while keeping focus on the same row action. */
  refresh() {
    if (!this.query) return;
    const active = document.activeElement;
    const focus = this.host.contains(active)
      ? { geneId: active.dataset.geneId, action: active.dataset.searchAction }
      : null;
    this.render();
    if (!focus?.geneId || !focus.action) return;
    const target = [...this.host.querySelectorAll('[data-search-action]')]
      .find((button) => button.dataset.geneId === focus.geneId
        && button.dataset.searchAction === focus.action);
    target?.focus();
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
    const result = searchGenes(this.genes, this.query, {
      limit: SEARCH_RESULT_LIMIT, goTerms: this.goTerms,
    });
    this.result = result;

    const status = document.createElement('p');
    status.className = 'search-status';
    if (result.total === 0) {
      // Never a silent empty state: say what was searched and what to try.
      status.textContent = `Nothing matches “${this.query.trim()}”. Search covers locus `
        + 'tags, gene names, product descriptions, reviewed categories, GO IDs and GO term names. Try a shorter '
        + 'word or the name the annotation uses.';
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
    if (result.shown.some((hit) => hit.goMatch)) {
      const note = document.createElement('p');
      note.className = 'search-alias-note';
      note.textContent = 'GO matches are RefSeq IEA computational suggestions, not tested '
        + 'UTEX 2973 functions. Review their evidence before selecting a candidate.';
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
    const { gene } = hit;
    const row = searchRowModel(hit, this.handlers);
    const item = document.createElement('li');
    item.className = 'search-result';

    const text = document.createElement('div');
    text.className = 'search-result-text';
    const heading = document.createElement('p');
    heading.className = 'search-result-name';
    const tag = createLocusTag(gene);
    tag.dataset.geneId = row.geneId;
    tag.dataset.searchAction = 'identity';
    heading.append(tag);
    if (row.symbol) {
      const name = document.createElement('b');
      name.textContent = ` ${row.symbol}`;
      heading.append(name);
    }
    const matched = document.createElement('span');
    matched.className = 'search-result-field';
    matched.textContent = row.matched;
    heading.append(matched);
    const product = document.createElement('p');
    product.className = 'search-result-product';
    product.textContent = row.product;
    text.append(heading, product);
    for (const line of [row.goLine, row.categoryLine]) {
      if (!line) continue;
      const note = document.createElement('p');
      note.className = 'search-result-product';
      note.textContent = line;
      text.append(note);
    }

    const actions = document.createElement('div');
    actions.className = 'search-result-actions';
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = row.pinned ? 'chip-button active' : 'chip-button';
    pin.dataset.geneId = row.geneId;
    pin.dataset.searchAction = 'pin';
    pin.textContent = row.labels.pin;
    pin.setAttribute('aria-pressed', String(row.pinned));
    pin.setAttribute('aria-label', row.pinDescription);
    pin.addEventListener('click', () => this.handlers.onPin(row.index));

    const add = document.createElement('button');
    add.type = 'button';
    add.className = row.shortlisted ? 'chip-button active' : 'chip-button';
    add.dataset.geneId = row.geneId;
    add.dataset.searchAction = 'shortlist';
    add.textContent = row.labels.shortlist;
    add.setAttribute('aria-pressed', String(row.shortlisted));
    add.setAttribute('aria-label', row.shortlistDescription);
    add.addEventListener('click', () => this.handlers.onShortlist(row.index));

    actions.append(pin, add);
    item.append(text, actions);
    return item;
  }
}
