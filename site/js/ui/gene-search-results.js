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
import {
  annotationSourceView, isAllSources, normalizeAnnotationSources,
} from '../core/annotation-source.js';

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
    this.source = normalizeAnnotationSources();
    this.query = '';
    this.host.hidden = true;
  }

  /**
   * @param {Array<object>} genes the dataset's genes, searched in place.
   * @param {object|null} goTerms
   * @param {object|null} dataset the full dataset, needed to resolve source-scoped
   *   product/name/category text; omit to keep the previous dataset.
   */
  setGenes(genes, goTerms = null, dataset = this.dataset) {
    this.genes = genes;
    this.goTerms = goTerms;
    this.dataset = dataset;
  }

  /** Which enabled sources search suggestions and displayed text are scoped to. */
  setAnnotationSource(source) {
    this.source = normalizeAnnotationSources(source);
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
      limit: SEARCH_RESULT_LIMIT, goTerms: this.goTerms, source: this.source,
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
    const { gene, index } = hit;
    const view = isAllSources(this.source)
      ? gene : annotationSourceView(gene, this.dataset, this.source);
    const geneName = geneIdentity(view);
    const item = document.createElement('li');
    item.className = 'search-result';

    const text = document.createElement('div');
    text.className = 'search-result-text';
    const heading = document.createElement('p');
    heading.className = 'search-result-name';
    const tag = createLocusTag(gene);
    tag.dataset.geneId = gene.id;
    tag.dataset.searchAction = 'identity';
    heading.append(tag);
    if (geneName?.kind === 'Gene symbol') {
      const name = document.createElement('b');
      name.textContent = ` ${geneName.text}`;
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
    product.textContent = view.product ?? 'no product description';
    text.append(heading, product);
    if (hit.goMatch) {
      const go = document.createElement('p');
      go.className = 'search-result-product';
      const term = hit.goMatch.name ? ` — ${hit.goMatch.name}` : '';
      const ambiguity = hit.goMatch.mappingAmbiguity ? '; mapping ambiguous' : '';
      const obsolete = hit.goMatch.isObsolete ? '; obsolete GO ID in the pinned name release' : '';
      go.textContent = `${hit.goMatch.id}${term} (`
        + `${hit.goMatch.evidenceCode} computational suggestion${ambiguity}${obsolete})`;
      text.append(go);
    }
    if (hit.categoryMatch) {
      const category = document.createElement('p');
      category.className = 'search-result-product';
      category.textContent = `Lab-reviewed category: ${hit.categoryMatch}`;
      text.append(category);
    }

    const actions = document.createElement('div');
    actions.className = 'search-result-actions';
    const pin = document.createElement('button');
    pin.type = 'button';
    const pinned = this.handlers.isPinned(gene.id);
    const shortlisted = this.handlers.isShortlisted(gene.id);
    const labels = searchActionState(pinned, shortlisted);
    const identity = geneIdentityDescription(view);
    pin.className = pinned ? 'chip-button active' : 'chip-button';
    pin.dataset.geneId = gene.id;
    pin.dataset.searchAction = 'pin';
    pin.textContent = labels.pin;
    pin.setAttribute('aria-pressed', String(pinned));
    pin.setAttribute('aria-label',
      `${labels.pin} ${gene.id} ${pinned ? 'from' : 'in'} the gene panel. ${identity}`);
    pin.addEventListener('click', () => this.handlers.onPin(index));

    const add = document.createElement('button');
    add.type = 'button';
    add.className = shortlisted ? 'chip-button active' : 'chip-button';
    add.dataset.geneId = gene.id;
    add.dataset.searchAction = 'shortlist';
    add.textContent = labels.shortlist;
    add.setAttribute('aria-pressed', String(shortlisted));
    add.setAttribute('aria-label', shortlisted
      ? `Remove ${gene.id} from the shortlist. ${identity}`
      : `Add ${gene.id} to the shortlist. ${identity}`);
    add.addEventListener('click', () => this.handlers.onShortlist(index));

    actions.append(pin, add);
    item.append(text, actions);
    return item;
  }
}
