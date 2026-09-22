/**
 * The three annotation sources that can colour function categories.
 *
 * UTEX 2973, PCC 7942, and GO IEA are independent checkboxes in the category
 * legend. They govern function-category colouring and the legend counts only:
 * the detail panel, tables, panel-designer list, search suggestions, and
 * export always show every source. All three on is the fresh default; the
 * enabled set travels in the URL and the export manifest so a shared link or
 * a file reproduces the colouring it was made under.
 */
export const ALL_SOURCES = 'all';
export const NO_SOURCES = 'none';
export const UTEX_SOURCE = 'utex-2973';
export const PCC_SOURCE = 'pcc-7942';
export const GO_IEA_SOURCE = 'go-iea';

/** The three toggles, in display order, which is also colour precedence. */
export const SOURCE_TOGGLES = Object.freeze([
  { id: UTEX_SOURCE, label: 'UTEX 2973' },
  { id: PCC_SOURCE, label: 'PCC 7942' },
  { id: GO_IEA_SOURCE, label: 'GO IEA' },
]);

/** A fresh view colours with every source on. */
export const DEFAULT_COLOR_SOURCES = Object.freeze(SOURCE_TOGGLES.map((entry) => entry.id));

const TOGGLE_IDS = new Set(DEFAULT_COLOR_SOURCES);
const SINGLE_LABELS = new Map(SOURCE_TOGGLES.map((entry) => [entry.id, entry.label]));

/** True for one of the three toggle ids. */
export function isAnnotationSource(id) {
  return TOGGLE_IDS.has(id);
}

/**
 * The enabled-source list in canonical order, from an array, a single id,
 * "all", "none", or nothing (the fresh default). Unknown ids are dropped
 * rather than trusted.
 */
export function normalizeAnnotationSources(value) {
  if (value === undefined || value === null) return [...DEFAULT_COLOR_SOURCES];
  if (typeof value === 'string') {
    if (value === ALL_SOURCES) return [...DEFAULT_COLOR_SOURCES];
    if (value === NO_SOURCES) return [];
    return TOGGLE_IDS.has(value) ? [value] : [...DEFAULT_COLOR_SOURCES];
  }
  const wanted = new Set(Array.isArray(value) ? value : []);
  return DEFAULT_COLOR_SOURCES.filter((id) => wanted.has(id));
}

/**
 * Parse the URL field: a comma list of toggle ids, one id, "all", or "none".
 * Returns null when nothing in the text is a known source, so the caller
 * leaves the field unspecified rather than trusting it.
 */
export function parseAnnotationSources(text) {
  if (typeof text !== 'string') return null;
  if (text === ALL_SOURCES) return [...DEFAULT_COLOR_SOURCES];
  if (text === NO_SOURCES) return [];
  const ids = text.split(',').filter((id) => TOGGLE_IDS.has(id));
  return ids.length === 0 ? null : normalizeAnnotationSources(ids);
}

/** True when a toggle is on in the given list. */
export function hasSource(sources, id) {
  return normalizeAnnotationSources(sources).includes(id);
}

/** True when every source is on. */
export function isAllSources(sources) {
  return normalizeAnnotationSources(sources).length === DEFAULT_COLOR_SOURCES.length;
}

/**
 * One id naming the enabled set: "all", "none", a single toggle id, or the
 * enabled ids joined with "+". Used by the URL and the export manifest.
 */
export function annotationSourceId(sources) {
  const enabled = normalizeAnnotationSources(sources);
  if (enabled.length === DEFAULT_COLOR_SOURCES.length) return ALL_SOURCES;
  if (enabled.length === 0) return NO_SOURCES;
  return enabled.join('+');
}

/** Reader-facing label for an id or an enabled-source list. */
export function annotationSourceLabel(value) {
  if (value === ALL_SOURCES) return 'All sources';
  if (value === NO_SOURCES) return 'No sources';
  if (typeof value === 'string' && SINGLE_LABELS.has(value)) return SINGLE_LABELS.get(value);
  if (typeof value === 'string' && value.includes('+')) {
    return annotationSourceLabel(value.split('+'));
  }
  if (!Array.isArray(value)) return null;
  const enabled = normalizeAnnotationSources(value);
  if (enabled.length === DEFAULT_COLOR_SOURCES.length) return 'All sources';
  if (enabled.length === 0) return 'No sources';
  return enabled.map((id) => SINGLE_LABELS.get(id)).join(' + ');
}
