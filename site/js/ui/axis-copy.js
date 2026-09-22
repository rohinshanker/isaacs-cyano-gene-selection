/**
 * The axis-note and filter-banner sentences for the Metric X vs Y panel,
 * kept as pure builders so `app.js`'s `renderMap` and its tests read the same
 * production wording instead of `app.js` inlining its own copy.
 */
import { formatCount } from './format.js';

/**
 * The lead sentence of the axis note: how many gene pairs are plotted, or,
 * when nothing is plotted, the projection's own reason (a genuinely
 * unavailable metric, an empty percentile ranking cohort, or no shared
 * finite pairs) instead of a stale pair count.
 *
 * @param {{available: boolean, message: string|null, isDiagonalPair: boolean,
 *   finitePairCount: number}} projection
 */
export function axisPairsNote(projection) {
  if (!projection.available) return projection.message;
  return projection.isDiagonalPair
    ? `${formatCount(projection.finitePairCount)} genes have this metric. Identical axes place points on a diagonal.`
    : `${formatCount(projection.finitePairCount)} genes have values on both axes; missing pairs are not plotted.`;
}

/**
 * The full axis titles, scale suffix included, stated as plain text.
 *
 * `fitAxisTitle` can shorten a canvas title down to nothing at an extreme
 * viewport width, so the note states both titles unconditionally: the scale
 * a gene is plotted on must always be readable somewhere, whatever the
 * canvas could fit.
 *
 * @param {{xLabel: string, yLabel: string}} projection
 */
export function axisTitlesNote(projection) {
  return `X axis: ${projection.xLabel}. Y axis: ${projection.yLabel}.`;
}

/**
 * The filter-exclusion banner. When the active panel has nothing plotted
 * (e.g. an empty percentile ranking cohort), states the projection's own
 * reason rather than promising markers that are not on the canvas.
 *
 * @param {{hidden: number, total: number, showHidden: boolean,
 *   projectionAvailable: boolean, projectionMessage: string|null,
 *   colorBy: string, functionColorKey: string}} params
 */
export function filterBannerText({
  hidden, total, showHidden, projectionAvailable, projectionMessage, colorBy, functionColorKey,
}) {
  if (hidden <= 0) return '';
  if (!showHidden) return `Filters hide ${formatCount(hidden)} of ${formatCount(total)} genes.`;
  if (!projectionAvailable) {
    return `Filters exclude ${formatCount(hidden)} of ${formatCount(total)} genes from the active set. ${projectionMessage}`;
  }
  return `Filters exclude ${formatCount(hidden)} of ${formatCount(total)} genes from the active set; `
    + `${colorBy === functionColorKey ? 'grey dots and outlined squares' : 'grey outlined squares'} remain on the map.`;
}
