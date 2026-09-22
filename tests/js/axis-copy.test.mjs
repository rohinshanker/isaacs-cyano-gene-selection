/**
 * `app.js`'s `renderMap` builds the axis note and filter banner by calling
 * these exact functions, so testing them here exercises the production
 * copy path, not a parallel helper. `axesUnavailableMessage` (metric-axes.js)
 * is the reason string these builders surface; its own wording is covered by
 * metric-axes.test.mjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { axisPairsNote, axisTitlesNote, filterBannerText } from '../../site/js/ui/axis-copy.js';

const FUNCTION_COLOR_KEY = 'function';

test('axisPairsNote reports the finite pair count for a plotted, non-diagonal projection', () => {
  const note = axisPairsNote({ available: true, isDiagonalPair: false, finitePairCount: 1727 });
  assert.equal(note, '1,727 genes have values on both axes; missing pairs are not plotted.');
});

test('axisPairsNote calls out a diagonal pair instead of a "both axes" count', () => {
  const note = axisPairsNote({ available: true, isDiagonalPair: true, finitePairCount: 200 });
  assert.equal(note, '200 genes have this metric. Identical axes place points on a diagonal.');
});

test('axisPairsNote defers to the projection message when an empty percentile cohort leaves nothing plotted', () => {
  const message = 'No visible genes remain to rank CDS length by percentile. '
    + 'Relax the filters to restore a ranking cohort.';
  const note = axisPairsNote({
    available: false, isDiagonalPair: false, finitePairCount: 0, message,
  });
  assert.equal(note, message);
  assert.doesNotMatch(note, /0 genes have values on both axes/);
});

test('axisTitlesNote always states both full axis titles, suffix included', () => {
  const note = axisTitlesNote({ xLabel: 'CDS length, percentile', yLabel: 'TSS initiation, log10' });
  assert.equal(note, 'X axis: CDS length, percentile. Y axis: TSS initiation, log10.');
});

test('filterBannerText is empty when nothing is hidden', () => {
  assert.equal(filterBannerText({
    hidden: 0, total: 100, showHidden: true, projectionAvailable: true,
    projectionMessage: null, colorBy: 'lengthNt', functionColorKey: FUNCTION_COLOR_KEY,
  }), '');
});

test('filterBannerText states a bare hidden count when "show filtered-out" is off', () => {
  const text = filterBannerText({
    hidden: 42, total: 200, showHidden: false, projectionAvailable: true,
    projectionMessage: null, colorBy: 'lengthNt', functionColorKey: FUNCTION_COLOR_KEY,
  });
  assert.equal(text, 'Filters hide 42 of 200 genes.');
});

test('filterBannerText promises outlined-square markers only when the projection is actually plotting', () => {
  const text = filterBannerText({
    hidden: 42, total: 200, showHidden: true, projectionAvailable: true,
    projectionMessage: null, colorBy: 'lengthNt', functionColorKey: FUNCTION_COLOR_KEY,
  });
  assert.match(text, /grey outlined squares remain on the map/);
});

test('filterBannerText names both marker shapes when coloured by function category', () => {
  const text = filterBannerText({
    hidden: 5, total: 50, showHidden: true, projectionAvailable: true,
    projectionMessage: null, colorBy: FUNCTION_COLOR_KEY, functionColorKey: FUNCTION_COLOR_KEY,
  });
  assert.match(text, /grey dots and outlined squares remain on the map/);
});

test('filterBannerText never promises markers when an empty percentile cohort leaves the canvas empty', () => {
  const message = 'No visible genes remain to rank CDS length by percentile. '
    + 'Relax the filters to restore a ranking cohort.';
  const text = filterBannerText({
    hidden: 1727, total: 1727, showHidden: true, projectionAvailable: false,
    projectionMessage: message, colorBy: 'lengthNt', functionColorKey: FUNCTION_COLOR_KEY,
  });
  assert.doesNotMatch(text, /remain on the map/);
  assert.match(text, /No visible genes remain to rank CDS length by percentile/);
});
