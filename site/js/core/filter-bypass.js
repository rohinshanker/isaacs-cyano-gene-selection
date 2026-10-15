/**
 * Turn filters off: a reversible bypass of every configured filter.
 *
 * DOM-free so the rules a shared link and an export depend on are testable in
 * Node. The configured criteria are never touched by the bypass; only the
 * effective mask changes, to every gene. Any change the reader makes to those
 * criteria ends the bypass, which is detected by comparing a signature of the
 * criteria rather than by hooking each control: a repaint, a tab switch, a
 * collapsed panel or a data file landing changes no criterion, so it cannot
 * switch filters back on, and a filter control added later cannot forget to.
 */
import { formatCount } from '../ui/format.js';

export const FILTER_STATUS_TITLE = 'Filter status';
export const FILTER_STATUS_BYPASSED_TITLE = 'Filter status (temporarily disabled)';
export const TURN_FILTERS_OFF_LABEL = 'Turn filters off';

const sortedCopy = (value) => (Array.isArray(value) ? [...value].map(String).sort() : []);

/**
 * Every reader-chosen filtering criterion, as one comparable string.
 *
 * The traffic metric key alone is left out: following the colour metric can
 * set it while no threshold exists, which changes nothing that is filtered. A
 * threshold is a range in `filters` under that key, so moving it, or moving it
 * to another metric, is caught there. A type metric's informing dataset and
 * pool are included for each filtered key, because changing the source a
 * range is judged by changes which genes it keeps.
 */
export function filterCriteriaSignature(state) {
  const filters = state.filters ?? {};
  const keys = Object.keys(filters).sort();
  const ranges = keys.map((key) => {
    const range = filters[key] ?? {};
    return [key, range.min ?? null, range.max ?? null, range.includeMissing !== false,
      state.typeSources?.[key] ?? null, sortedCopy(state.trafficPools?.[key])];
  });
  const goActive = (state.goEvidenceFilter ?? 'any') !== 'any';
  return JSON.stringify({
    ranges,
    category: sortedCopy(state.categoryFilter),
    go: goActive ? [state.goTerm ?? '', state.goEvidenceFilter] : null,
    exception: state.exceptionFilter ?? 'any',
    expression: state.expressionFilter ?? 'any',
    protein: state.proteinFilter ?? 'any',
    neighborSite: state.neighborSiteFilter ?? 'any',
    neighborSiteCount: state.neighborSiteCountFilter ?? null,
    overlapClass: sortedCopy(state.overlapClassFilter),
    overlapLength: state.overlapLengthFilter ?? null,
    essentiality: sortedCopy(state.pccEssentialityFilter),
  });
}

/**
 * Keep or end a bypass against the current criteria.
 *
 * `recorded` is the signature the bypass was turned on against. A bypass with
 * none recorded, as one read from a link, adopts the current criteria.
 *
 * @returns {{bypassed: boolean, recorded: string|null, reactivated: boolean}}
 */
export function reconcileFilterBypass({ bypassed, recorded }, signature) {
  if (!bypassed) return { bypassed: false, recorded: null, reactivated: false };
  if (recorded == null || recorded === signature) {
    return { bypassed: true, recorded: signature, reactivated: false };
  }
  return { bypassed: false, recorded: null, reactivated: true };
}

/** Every gene while bypassed; otherwise the configured mask itself. */
export function effectiveFilterMask(mask, bypassed) {
  return bypassed ? new Uint8Array(mask.length).fill(1) : mask;
}

/**
 * Shown whenever configured filters hide a gene, and always while bypassed,
 * because the section holds the only control that switches them back on.
 */
export function filterStatusVisible({ configuredHidden, bypassed }) {
  return Boolean(bypassed) || configuredHidden > 0;
}

export function filterStatusTitle(bypassed) {
  return bypassed ? FILTER_STATUS_BYPASSED_TITLE : FILTER_STATUS_TITLE;
}

/** The status sentence while bypassed, the same in every view. */
export function bypassedStatusText({ total, configuredHidden }) {
  return `Filters are temporarily off: all ${formatCount(total)} genes are included. `
    + (configuredHidden > 0
      ? `Turned back on, the configured filters hide ${formatCount(configuredHidden)} of them.`
      : 'Turned back on, the configured filters hide none of them.');
}

/** The chromosome view's status sentence with filters applied. */
export function chromosomeFilterStatusText({ hidden, total, showHidden }) {
  if (hidden <= 0) return '';
  if (!showHidden) return `Filters hide ${formatCount(hidden)} of ${formatCount(total)} genes.`;
  return `Filters exclude ${formatCount(hidden)} of ${formatCount(total)} genes from the active `
    + 'set; they stay on the track as muted marks.';
}
