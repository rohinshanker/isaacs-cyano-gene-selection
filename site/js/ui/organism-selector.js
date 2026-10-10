/**
 * The organism selector, and the page's own statement of which organism it is.
 *
 * A switch is a full page navigation, so each option is a link: Tab reaches
 * it, Enter follows it, and the browser resets every module, worker, cache,
 * and listener on the way. Nothing here swaps a dataset in place.
 *
 * Cyanobacteria and Syn61 are direct links. Conventional E. coli strains share
 * one disclosure whose options remain ordinary links, so their addresses can
 * still be copied, opened in another tab, or followed without JavaScript
 * navigation. Each organism remembers the view it was last left in. That view
 * is stored under the organism's own key by the page as it changes, and an
 * option's link carries it in the hash. A link is only as good as its address,
 * and the address a reader copies is read without a click, so every option is
 * refreshed whenever the memory it carries can have changed or is about to be
 * read.
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
 * The events after which an option's `href` can be read, so it is written
 * first.
 *
 * Following a link is not the only way its address is used: the context menu
 * offers to copy it, a middle click or a modified click opens it in another
 * tab, and a drag carries it. Each of those is preceded by one of these, and
 * every one of them fires before the browser reads the attribute.
 */
const BEFORE_READ = Object.freeze(['pointerdown', 'contextmenu', 'keydown', 'click']);

const DIRECT_NAVIGATION_IDS = Object.freeze([
  'utex2973',
  'ecoli-syn61-delta3-ev5',
]);

const CONVENTIONAL_ECOLI = Object.freeze([
  { id: 'ecoli-k12-mg1655', label: 'MG1655' },
  { id: 'ecoli-mds42-public-reference', label: 'MDS42 public reference' },
  { id: 'ecoli-dh10b-public-reference', label: 'DH10B public reference' },
]);

function recordFor(organisms, id) {
  const organism = organisms.find((candidate) => candidate.id === id);
  if (!organism) throw new Error(`organism navigation has no record for ${id}`);
  return organism;
}

function organismLink({ organism, label, current, location, store, onCurrent }) {
  const option = document.createElement('a');
  const selected = organism === current;
  option.className = 'header-link organism-option';
  option.textContent = label;
  option.dataset.organism = organism.id;
  const refresh = () => { option.href = switchHref(location, organism, store); };
  refresh();
  if (selected) {
    option.classList.add('active');
    option.setAttribute('aria-current', 'page');
    // Already here. Following the link would reload the page onto a stored
    // view and discard the one on screen.
    option.addEventListener('click', (event) => {
      event.preventDefault();
      onCurrent?.();
    });
  }
  for (const type of BEFORE_READ) option.addEventListener(type, refresh);
  return { option, refresh };
}

/**
 * Draw the selector into `host`.
 *
 * The option for the organism in view is marked `aria-current` and goes
 * nowhere; every option's address carries that organism's view as last saved
 * by any tab, kept current two ways. Another tab saving a view fires `storage`
 * here, which is the only notice this tab gets; and anything that can read an
 * address refreshes it first, so copying a link gives the same address that
 * following it would.
 *
 * @param {HTMLElement} host a `nav` with an accessible name.
 * @param {{current: object, location: {pathname: string, search: string},
 *   store: {read: Function}, organisms?: object[],
 *   view?: {addEventListener?: Function}}} options `view` is the window whose
 *   `storage` events say another tab wrote; omitted, it is this page's own.
 * @returns {{refresh: () => void, close: () => void}} `refresh` rewrites every
 *   option's address; `close` dismisses the conventional-strain disclosure.
 */
export function renderOrganismSelector(host, {
  current, location, store, organisms = ORGANISMS, view = globalThis.window,
}) {
  host.replaceChildren();
  const refreshers = [];
  for (const id of DIRECT_NAVIGATION_IDS) {
    const organism = recordFor(organisms, id);
    const { option, refresh } = organismLink({
      organism, label: organism.label, current, location, store,
    });
    option.classList.add('chip-button', 'organism-top-level');
    refreshers.push({ organism, refresh });
    host.append(option);
  }

  const conventional = CONVENTIONAL_ECOLI.map(({ id, label }) => ({
    organism: recordFor(organisms, id), label,
  }));
  const selectedConventional = conventional.find(({ organism }) => organism === current)
    ?? conventional[0];
  const dropdown = document.createElement('div');
  dropdown.className = 'organism-dropdown';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'chip-button organism-top-level organism-group-trigger';
  trigger.id = 'conventional-ecoli-trigger';
  trigger.dataset.organism = selectedConventional.organism.id;
  trigger.setAttribute('aria-controls', 'conventional-ecoli-options');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', `E. coli strains; selected ${selectedConventional.label}`);
  if (selectedConventional.organism === current) {
    trigger.classList.add('active');
    trigger.setAttribute('aria-current', 'page');
  }
  const groupName = document.createElement('span');
  groupName.textContent = 'E. coli';
  const selection = document.createElement('span');
  selection.className = 'organism-group-selection';
  selection.textContent = ` · ${selectedConventional.label}`;
  const caret = document.createElement('span');
  caret.className = 'organism-group-caret';
  caret.setAttribute('aria-hidden', 'true');
  caret.textContent = '\u25be';
  trigger.append(groupName, selection, caret);

  const menu = document.createElement('ul');
  menu.className = 'organism-strain-menu';
  menu.id = 'conventional-ecoli-options';
  menu.setAttribute('aria-label', 'Conventional E. coli strains');
  menu.hidden = true;
  const optionLinks = [];
  const close = ({ returnFocus = false } = {}) => {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (returnFocus) trigger.focus();
  };
  const open = (focusAt = null) => {
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    if (focusAt === 'first') optionLinks[0]?.focus();
    if (focusAt === 'last') optionLinks.at(-1)?.focus();
  };
  for (const { organism, label } of conventional) {
    const item = document.createElement('li');
    const { option, refresh } = organismLink({
      organism, label, current, location, store,
      onCurrent: () => close({ returnFocus: true }),
    });
    option.classList.add('organism-strain-option');
    item.append(option);
    menu.append(item);
    optionLinks.push(option);
    refreshers.push({ organism, refresh });
  }
  trigger.addEventListener('click', () => {
    if (menu.hidden) open(); else close();
  });
  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open(event.key === 'ArrowDown' ? 'first' : 'last');
    } else if (event.key === 'Escape' && !menu.hidden) {
      event.preventDefault();
      close({ returnFocus: true });
    }
  });
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close({ returnFocus: true });
      return;
    }
    const index = optionLinks.indexOf(event.target);
    if (index < 0) return;
    let next = null;
    if (event.key === 'ArrowDown') next = (index + 1) % optionLinks.length;
    if (event.key === 'ArrowUp') next = (index - 1 + optionLinks.length) % optionLinks.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = optionLinks.length - 1;
    if (next !== null) {
      event.preventDefault();
      optionLinks[next].focus();
    }
  });
  dropdown.addEventListener('focusout', (event) => {
    if (!dropdown.contains(event.relatedTarget)) close();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!menu.hidden && !dropdown.contains(event.target)) close();
  });
  dropdown.append(trigger, menu);
  host.append(dropdown);

  const refreshAll = () => { for (const { refresh } of refreshers) refresh(); };
  // `storage` fires only for writes by another tab, which is the one case no
  // interaction here can catch: this tab's own writes go through `rememberView`
  // and are read back by the refresh above. A null key is storage being cleared.
  const watched = new Set(refreshers
    .map(({ organism }) => storageKeys(organism).lastView));
  view?.addEventListener?.('storage', (event) => {
    if (event?.key == null || watched.has(event.key)) refreshAll();
  });
  const identity = document.createElement('span');
  identity.className = 'organism-identity';
  identity.id = 'organism-identity';
  identity.append(...identityNodes(current));
  host.append(identity);
  return { refresh: refreshAll, close };
}

/**
 * The directory the footer says this organism's files were built from, as a
 * path from the repository root and without its trailing slash.
 *
 * The default organism's is `site/data`, which is what the static page already
 * says, so its footer is unchanged.
 */
export function dataDirectoryPath(organism) {
  return `site/${organism.dataDirectory}`.replace(/\/$/, '');
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
  setText(page, 'data-directory-path', dataDirectoryPath(organism));
  const sourceHint = page.getElementById('annotation-source-hint');
  if (sourceHint) {
    if (organism.copy.annotationSourceHint) {
      sourceHint.textContent = 'Each checkbox enables one annotation source for '
        + 'function-category colouring and the legend counts only. The detail panel, '
        + 'lists, search, and export always show every source.';
    } else {
      sourceHint.remove();
    }
  }
}

/** Say how many genes there are, once the dataset has said so. */
export function applyGeneCount(page, count) {
  setText(page, 'gene-count-phrase', approximateGeneCount(count));
}
