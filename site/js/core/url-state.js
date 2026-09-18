/**
 * URL hash serialization.
 *
 * A link reproduces the exact view: panel, colour, recoding scheme, filters,
 * shortlist, pinned gene, and comparison tab.
 */
import { serializeSchemeMap, parseSchemeMap } from './scheme.js';

const KEYS = {
  panel: 'p', colorBy: 'c', scheme: 's', schemeName: 'n', highExpressed: 'x',
  filters: 'f', shortlist: 'l', pinned: 'g', compareTab: 't', showHidden: 'v',
  exceptionFilter: 'e',
};

function encodeFilters(filters) {
  return Object.entries(filters)
    .map(([key, range]) => {
      const min = Number.isFinite(range.min) ? Number(range.min.toPrecision(8)) : '';
      const max = Number.isFinite(range.max) ? Number(range.max.toPrecision(8)) : '';
      // A trailing 0 records that genes with no measurement are dropped, which is
      // never the default and so must survive in a shared link.
      return `${key}:${min}:${max}${range.includeMissing === false ? ':0' : ''}`;
    })
    .join(',');
}

function decodeFilters(text) {
  const filters = {};
  if (!text) return filters;
  for (const part of text.split(',')) {
    const [key, min, max, missing] = part.split(':');
    if (!key) continue;
    filters[key] = {
      min: min === '' || min === undefined ? null : Number(min),
      max: max === '' || max === undefined ? null : Number(max),
      includeMissing: missing !== '0',
    };
  }
  return filters;
}

/** Serialize the shareable part of the application state into a hash string. */
export function encodeState(state) {
  const parts = [];
  const push = (key, value) => {
    if (value === '' || value === null || value === undefined) return;
    parts.push(`${key}=${encodeURIComponent(value)}`);
  };
  push(KEYS.panel, state.panel);
  push(KEYS.colorBy, state.colorBy);
  push(KEYS.scheme, serializeSchemeMap(state.schemeMap));
  push(KEYS.schemeName, state.schemeName);
  if (state.highExpressed) push(KEYS.highExpressed, '1');
  push(KEYS.filters, encodeFilters(state.filters));
  push(KEYS.shortlist, state.shortlist.join(','));
  push(KEYS.pinned, state.pinnedId ?? '');
  push(KEYS.compareTab, state.compareTab);
  if (state.exceptionFilter && state.exceptionFilter !== 'any') {
    push(KEYS.exceptionFilter, state.exceptionFilter);
  }
  if (!state.showHidden) push(KEYS.showHidden, '0');
  return parts.join('&');
}

/** Parse a hash string into a partial state. Unknown or malformed parts are ignored. */
export function decodeState(hash) {
  const text = hash.startsWith('#') ? hash.slice(1) : hash;
  const values = new Map();
  for (const part of text.split('&')) {
    if (!part) continue;
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    values.set(part.slice(0, separator), decodeURIComponent(part.slice(separator + 1)));
  }
  const state = {};
  if (values.has(KEYS.panel)) state.panel = values.get(KEYS.panel);
  if (values.has(KEYS.colorBy)) state.colorBy = values.get(KEYS.colorBy);
  if (values.has(KEYS.scheme)) state.schemeMap = parseSchemeMap(values.get(KEYS.scheme));
  if (values.has(KEYS.schemeName)) state.schemeName = values.get(KEYS.schemeName);
  if (values.has(KEYS.highExpressed)) state.highExpressed = values.get(KEYS.highExpressed) === '1';
  if (values.has(KEYS.filters)) state.filters = decodeFilters(values.get(KEYS.filters));
  if (values.has(KEYS.shortlist)) {
    state.shortlist = values.get(KEYS.shortlist).split(',').filter(Boolean);
  }
  if (values.has(KEYS.pinned)) state.pinnedId = values.get(KEYS.pinned) || null;
  if (values.has(KEYS.compareTab)) state.compareTab = values.get(KEYS.compareTab);
  if (values.has(KEYS.exceptionFilter)) {
    const mode = values.get(KEYS.exceptionFilter);
    if (['any', 'only', 'none'].includes(mode)) state.exceptionFilter = mode;
  }
  if (values.has(KEYS.showHidden)) state.showHidden = values.get(KEYS.showHidden) !== '0';
  return state;
}
