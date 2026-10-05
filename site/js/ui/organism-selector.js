/**
 * The organism selector, and the page's own statement of which organism it is.
 *
 * A switch is a full page navigation, so each option is a link: Tab reaches
 * it, Enter follows it, and the browser resets every module, worker, cache,
 * and listener on the way. Nothing here swaps a dataset in place.
 *
 * Each organism remembers the view it was last left in. That view is stored
 * under the organism's own key by the page as it changes, and an option's
 * link carries it in the hash, so choosing an organism returns to its own last
 * view while a bare link to it opens fresh.
 */
import {
  ORGANISMS, approximateGeneCount, publishesLayer, storageKeys, switchSearch,
} from '../core/organisms.js';

/** The remembered hash for one organism, without its `#`, or '' when it has none. */
export function lastViewHash(store, organism) {
  const saved = store.read(storageKeys(organism).lastView, '');
  return typeof saved === 'string' ? saved.replace(/^#/, '') : '';
}

/** Remember the view an organism is being left in. */
export function rememberView(store, organism, hash) {
  return store.write(storageKeys(organism).lastView, String(hash ?? '').replace(/^#/, ''));
}

/**
 * The address that opens `organism` from the page at `location`, on the view
 * that organism was last left in.
 *
 * @param {{pathname: string, search: string}} location
 * @param {object} organism the record to switch to.
 * @param {{read: Function}} store browser storage that degrades to its fallback.
 */
export function switchHref(location, organism, store) {
  const hash = lastViewHash(store, organism);
  return `${location.pathname}${switchSearch(location.search, organism)}${hash ? `#${hash}` : ''}`;
}

/** The species in italics, then the strain and the reference assembly. */
function identityNodes(organism) {
  const species = document.createElement('i');
  species.textContent = organism.species;
  return [species, ` ${organism.strain} · ${organism.genome.accession}`];
}

/**
 * Draw the selector into `host`.
 *
 * The option for the organism in view is marked `aria-current` and goes
 * nowhere; every other option is a link whose address is refreshed as it is
 * activated, so it carries that organism's view as last saved by any tab.
 *
 * @param {HTMLElement} host a `nav` with an accessible name.
 * @param {{current: object, location: {pathname: string, search: string},
 *   store: {read: Function}, organisms?: object[]}} options
 */
export function renderOrganismSelector(host, {
  current, location, store, organisms = ORGANISMS,
}) {
  host.replaceChildren();
  for (const organism of organisms) {
    const option = document.createElement('a');
    const selected = organism === current;
    option.className = `chip-button header-link organism-option${selected ? ' active' : ''}`;
    option.textContent = organism.label;
    option.dataset.organism = organism.id;
    option.href = switchHref(location, organism, store);
    if (selected) {
      option.setAttribute('aria-current', 'page');
      // Already here. Following the link would reload the page onto a stored
      // view and discard the one on screen.
      option.addEventListener('click', (event) => event.preventDefault());
    } else {
      option.addEventListener('click', () => {
        option.href = switchHref(location, organism, store);
      });
    }
    host.append(option);
  }
  const identity = document.createElement('span');
  identity.className = 'organism-identity';
  identity.id = 'organism-identity';
  identity.append(...identityNodes(current));
  host.append(identity);
}

/** What the gene search looks in, for one organism, as its placeholder and its hint. */
export function searchCopy(organism) {
  const categories = publishesLayer(organism, 'functionCategories');
  return {
    placeholder: categories
      ? 'Locus, product, category, or GO term' : 'Locus, product, or GO term',
    hint: 'Searches locus tags, gene names, product descriptions, '
      + `${categories ? 'reviewed function categories, ' : ''}GO IDs and GO term names. `
      + 'GO annotations are computational suggestions. Common nicknames such as '
      + `${organism.searchAliasExample} are translated into the wording this genome uses.`,
  };
}

function setText(page, id, text) {
  const node = page.getElementById(id);
  if (node) node.textContent = text;
}

/**
 * Make the document say which organism it is showing.
 *
 * The static page is written for the default organism, so that it is correct
 * before any script runs. This rewrites every organism-specific sentence in it
 * from the record, before any data is asked for, and removes the one hint that
 * describes a control an organism without colour sources never draws.
 *
 * @param {Document} page the document to rewrite.
 * @param {object} organism the record of the organism the address names.
 */
export function applyOrganismIdentity(page, organism) {
  page.title = organism.title;
  page.querySelector('meta[name="description"]')
    ?.setAttribute('content', organism.description);
  page.documentElement.dataset.organism = organism.id;
  setText(page, 'site-title', organism.title);
  setText(page, 'organism-species', organism.species);
  setText(page, 'organism-strain', organism.strain);
  const search = searchCopy(organism);
  page.getElementById('gene-search')?.setAttribute('placeholder', search.placeholder);
  setText(page, 'gene-search-hint', search.hint);
  const sourceHint = page.getElementById('annotation-source-hint');
  if (sourceHint) {
    if (organism.copy.annotationSourceHint) {
      sourceHint.textContent = organism.copy.annotationSourceHint;
    } else {
      sourceHint.remove();
    }
  }
}

/** Say how many genes there are, once the dataset has said so. */
export function applyGeneCount(page, count) {
  setText(page, 'gene-count-phrase', approximateGeneCount(count));
}
