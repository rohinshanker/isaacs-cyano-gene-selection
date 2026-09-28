/**
 * The controls column's panel identity, order, and collapsed set.
 *
 * DOM-free on purpose: the ordering and collapse rules are what a shared link
 * encodes, so they are testable in Node without a browser. The controller in
 * `ui/left-panels.js` renders whatever this module says is valid.
 */

/**
 * Every panel the controls column can show, in the order a fresh view uses.
 *
 * The gene visualizer leads because it answers "what am I looking at" before
 * the scheme and filters change what is shown. It is the one panel that starts
 * collapsed: it is a reference view rather than a control, so it should not
 * push the scheme editor below the fold on a first visit.
 */
export const LEFT_PANELS = Object.freeze([
  Object.freeze({ id: 'gene-viewer', title: 'Gene visualizer' }),
  Object.freeze({ id: 'scheme', title: 'Recoding scheme' }),
  Object.freeze({ id: 'filters', title: 'Filters' }),
]);

export const LEFT_PANEL_IDS = Object.freeze(LEFT_PANELS.map((panel) => panel.id));

/** Fresh-view order. */
export const DEFAULT_PANEL_ORDER = Object.freeze([...LEFT_PANEL_IDS]);

/** Fresh-view collapsed set: the gene visualizer only. */
export const DEFAULT_PANEL_COLLAPSED = Object.freeze(['gene-viewer']);

/** Sentinel for "no panel is collapsed", which is not the default and so must encode. */
export const NO_PANELS_COLLAPSED = 'none';

const titles = new Map(LEFT_PANELS.map((panel) => [panel.id, panel.title]));

/** Human title for a panel id, or null when the id is not one of ours. */
export function panelTitle(id) {
  return titles.get(id) ?? null;
}

/**
 * Coerce any decoded value into a complete, duplicate-free panel order.
 *
 * Unknown ids are dropped and missing ids are appended in default order, so a
 * link written by an older or newer build still produces every panel exactly
 * once. A panel silently vanishing because a link predates it would hide a
 * control the user cannot then find.
 */
export function normalizePanelOrder(value) {
  const requested = Array.isArray(value) ? value : [];
  const order = [];
  for (const id of requested) {
    if (LEFT_PANEL_IDS.includes(id) && !order.includes(id)) order.push(id);
  }
  for (const id of DEFAULT_PANEL_ORDER) {
    if (!order.includes(id)) order.push(id);
  }
  return order;
}

/** True when `order` is exactly the fresh-view order. */
export function isDefaultPanelOrder(order) {
  const normalized = normalizePanelOrder(order);
  return normalized.every((id, i) => id === DEFAULT_PANEL_ORDER[i]);
}

/**
 * Coerce any decoded value into a valid collapsed set, in panel order.
 *
 * Ordering the result makes two equivalent sets encode identically, so a link
 * does not change character merely because the user collapsed panels in a
 * different sequence.
 */
export function normalizeCollapsed(value) {
  const requested = Array.isArray(value) ? value : [];
  return LEFT_PANEL_IDS.filter((id) => requested.includes(id));
}

/** True when `collapsed` is exactly the fresh-view collapsed set. */
export function isDefaultCollapsed(collapsed) {
  const normalized = normalizeCollapsed(collapsed);
  return normalized.length === DEFAULT_PANEL_COLLAPSED.length
    && normalized.every((id, i) => id === DEFAULT_PANEL_COLLAPSED[i]);
}

/**
 * Move `id` by `delta` places, clamped at both ends.
 *
 * Clamping rather than wrapping: a user pressing "move up" on the top panel
 * expects nothing to happen, not the panel to jump to the bottom.
 *
 * @returns {string[]} a new order; the input is not mutated.
 */
export function movePanel(order, id, delta) {
  const normalized = normalizePanelOrder(order);
  const from = normalized.indexOf(id);
  if (from < 0 || !Number.isFinite(delta) || delta === 0) return normalized;
  const to = Math.max(0, Math.min(normalized.length - 1, from + Math.trunc(delta)));
  if (to === from) return normalized;
  const next = [...normalized];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

/** Place `id` at index `to`, for a completed drag. */
export function reorderPanel(order, id, to) {
  const normalized = normalizePanelOrder(order);
  const from = normalized.indexOf(id);
  if (from < 0) return normalized;
  return movePanel(normalized, id, to - from);
}

/** Toggle one panel's collapsed state, returning a new normalized set. */
export function toggleCollapsed(collapsed, id, shouldCollapse) {
  const set = new Set(normalizeCollapsed(collapsed));
  if (shouldCollapse) set.add(id);
  else set.delete(id);
  return normalizeCollapsed([...set]);
}
