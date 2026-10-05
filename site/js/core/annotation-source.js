/**
 * The annotation sources that can colour function categories.
 *
 * Which sources exist is an organism fact: each record in `core/organisms.js`
 * lists its own, in display order, which is also colour precedence. An organism
 * with no function-category colour lists none. Every function here takes that
 * list as `toggles` and defaults to the default organism's, so a caller that
 * holds an organism passes `organism.annotationSources`.
 *
 * The sources are independent checkboxes in the category legend. They govern
 * function-category colouring and the legend counts only: the detail panel,
 * tables, panel-designer list, search suggestions, and export always show every
 * source. Every source on is the fresh default; the enabled set travels in the
 * URL and the export manifest so a shared link or a file reproduces the
 * colouring it was made under.
 */
import { DEFAULT_ORGANISM } from './organisms.js';

export const ALL_SOURCES = 'all';
export const NO_SOURCES = 'none';

/**
 * The keys the default organism's function-category files are written under:
 * its lab-reviewed table, and the two sources a category is derived from.
 */
export const UTEX_SOURCE = 'utex-2973';
export const PCC_SOURCE = 'pcc-7942';
export const GO_IEA_SOURCE = 'go-iea';

/** The default organism's toggles, in display order, which is also colour precedence. */
export const SOURCE_TOGGLES = DEFAULT_ORGANISM.annotationSources;

/** A fresh view of the default organism colours with every source on. */
export const DEFAULT_COLOR_SOURCES = Object.freeze(SOURCE_TOGGLES.map((entry) => entry.id));

/** Every source id of one organism, which is its fresh-view selection. */
export function defaultColorSources(toggles = SOURCE_TOGGLES) {
  return toggles.map((entry) => entry.id);
}

/** True for one of the organism's toggle ids. */
export function isAnnotationSource(id, toggles = SOURCE_TOGGLES) {
  return toggles.some((entry) => entry.id === id);
}

/**
 * The enabled-source list in canonical order, from an array, a single id,
 * "all", "none", or nothing (the fresh default). Unknown ids are dropped
 * rather than trusted.
 */
export function normalizeAnnotationSources(value, toggles = SOURCE_TOGGLES) {
  const every = defaultColorSources(toggles);
  if (value === undefined || value === null) return every;
  if (typeof value === 'string') {
    if (value === ALL_SOURCES) return every;
    if (value === NO_SOURCES) return [];
    return every.includes(value) ? [value] : every;
  }
  const wanted = new Set(Array.isArray(value) ? value : []);
  return every.filter((id) => wanted.has(id));
}

/**
 * Parse the URL field: a comma list of toggle ids, one id, "all", or "none".
 * Returns null when nothing in the text is a known source, so the caller
 * leaves the field unspecified rather than trusting it.
 */
export function parseAnnotationSources(text, toggles = SOURCE_TOGGLES) {
  if (typeof text !== 'string') return null;
  if (text === ALL_SOURCES) return defaultColorSources(toggles);
  if (text === NO_SOURCES) return [];
  const ids = text.split(',').filter((id) => isAnnotationSource(id, toggles));
  return ids.length === 0 ? null : normalizeAnnotationSources(ids, toggles);
}

/** True when a toggle is on in the given list. */
export function hasSource(sources, id, toggles = SOURCE_TOGGLES) {
  return normalizeAnnotationSources(sources, toggles).includes(id);
}

/** True when every source is on. */
export function isAllSources(sources, toggles = SOURCE_TOGGLES) {
  return normalizeAnnotationSources(sources, toggles).length === toggles.length;
}

/**
 * One id naming the enabled set: "all", "none", a single toggle id, or the
 * enabled ids joined with "+". Used by the URL and the export manifest.
 */
export function annotationSourceId(sources, toggles = SOURCE_TOGGLES) {
  const enabled = normalizeAnnotationSources(sources, toggles);
  if (enabled.length === toggles.length) return ALL_SOURCES;
  if (enabled.length === 0) return NO_SOURCES;
  return enabled.join('+');
}

/** Reader-facing label for an id or an enabled-source list. */
export function annotationSourceLabel(value, toggles = SOURCE_TOGGLES) {
  const labels = new Map(toggles.map((entry) => [entry.id, entry.label]));
  if (value === ALL_SOURCES) return 'All sources';
  if (value === NO_SOURCES) return 'No sources';
  if (typeof value === 'string' && labels.has(value)) return labels.get(value);
  if (typeof value === 'string' && value.includes('+')) {
    return annotationSourceLabel(value.split('+'), toggles);
  }
  if (!Array.isArray(value)) return null;
  const enabled = normalizeAnnotationSources(value, toggles);
  if (enabled.length === toggles.length) return 'All sources';
  if (enabled.length === 0) return 'No sources';
  return enabled.map((id) => labels.get(id)).join(' + ');
}
