import assert from 'node:assert/strict';
import test from 'node:test';

import {
  categoryExcludedLegendRows, legendMarkerDescription,
} from '../../site/js/ui/legend.js';
import {
  CATEGORY_UNKNOWN_COLOR, GHOST_BORDER, GHOST_COLOR,
} from '../../site/js/ui/colors.js';

const expectedRoot = {
  class: 'legend-marker', viewBox: '0 0 18 18',
  'aria-hidden': 'true', focusable: 'false',
};

test('every legend marker has decorative SVG semantics and the intended geometry', () => {
  const color = '#123456';
  const fill = '#abcdef';
  const expected = {
    'ghost-square': [{
      name: 'rect',
      attributes: { x: 6, y: 6, width: 6, height: 6, fill, stroke: color, 'stroke-width': 1.4 },
    }],
    'filled-dot': [{
      name: 'circle',
      attributes: { cx: 9, cy: 9, r: 2.5, fill, stroke: color, 'stroke-width': 1.4 },
    }],
    diamond: [{
      name: 'path',
      attributes: {
        d: 'M9 5 13 9 9 13 5 9Z', fill: 'none', stroke: color, 'stroke-width': 1.4,
      },
    }],
    pin: [
      {
        name: 'circle',
        attributes: { cx: 9, cy: 9, r: 3.5, fill: 'none', stroke: color, 'stroke-width': 1.4 },
      },
      {
        name: 'path',
        attributes: {
          d: 'M2.5 9h3M12.5 9h3M9 2.5v3M9 12.5v3',
          fill: 'none', stroke: color, 'stroke-width': 1.4,
        },
      },
    ],
    'filled-circle': [{
      name: 'circle',
      attributes: { cx: 9, cy: 9, r: 4.5, fill, stroke: color, 'stroke-width': 0.8 },
    }],
    'open-circle': [{
      name: 'circle',
      attributes: { cx: 9, cy: 9, r: 3.5, fill: 'none', stroke: color, 'stroke-width': 1.4 },
    }],
  };

  for (const [shape, elements] of Object.entries(expected)) {
    assert.deepEqual(legendMarkerDescription(shape, color, fill), {
      attributes: expectedRoot, elements,
    }, shape);
  }
  assert.throws(() => legendMarkerDescription('triangle', color), /unknown legend marker shape/);
});

test('excluded category legend rows omit zero counts independently', () => {
  assert.deepEqual(categoryExcludedLegendRows(false, 3, 4), []);
  assert.deepEqual(categoryExcludedLegendRows(true, 0, 0), []);
  assert.deepEqual(categoryExcludedLegendRows(true, 2, 0), [{
    label: 'Excluded, categorised (reviewed or derived): grey outlined square',
    shape: 'ghost-square', color: GHOST_BORDER, fill: GHOST_COLOR, count: 2,
  }]);
  assert.deepEqual(categoryExcludedLegendRows(true, 0, 5), [{
    label: 'Excluded, unknown: grey dot',
    shape: 'filled-dot', color: CATEGORY_UNKNOWN_COLOR, fill: CATEGORY_UNKNOWN_COLOR, count: 5,
  }]);
});
