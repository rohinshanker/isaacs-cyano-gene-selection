import assert from 'node:assert/strict';
import test from 'node:test';

import {
  categoryExcludedLegendRows, describeValueScale, legendMarkerDescription, renderCategoryLegend,
  renderLegend,
} from '../../site/js/ui/legend.js';
import {
  CATEGORY_UNKNOWN_COLOR, GHOST_BORDER, GHOST_COLOR, buildCategoryColorScale, buildColorScale,
} from '../../site/js/ui/colors.js';
import { withFakeDocument } from './fake-dom.mjs';

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

/**
 * The legend says nothing about paint order, by owner decision of 2026-09-30.
 *
 * It said so for one commit. After the first render the owner decided that
 * explanation for what a reader learns by zooming or panning does not belong in
 * the visible interface: the ordering clause, the D1 notice, and the crowding
 * figure live in the accessible descriptions and inside the collapsed colour
 * explanation, and nowhere a reader has to look at them. So these two tests are
 * an *absence*, and they are written the way the clause actually arrived — as a
 * `drawOrderNote` handed to the legend — so that re-adding it fails here rather
 * than at the next rendered measurement of legend height.
 */
test('the value legend states no draw order, whatever it is handed', async () => {
  await withFakeDocument((document) => {
    const metric = { key: 'cai', label: 'CAI', unit: '' };
    const scale = buildColorScale(Float64Array.from([0.1, 0.5, 0.9]), { scale: 'sequential' });
    const host = document.createElement('div');
    renderLegend(host, {
      metric, scale, missingCount: 0, hiddenCount: 0, showHidden: false, provenanceNote: null,
      drawOrderNote: 'Overlaps: highest on top.',
    });
    const notes = host.querySelectorAll('.legend-ramp-note')
      .map((node) => node.textContent);
    for (const note of notes) {
      assert.doesNotMatch(note, /Overlap|on top|draws over|Draw on top/i,
        `no legend note may mention paint order: ${note}`);
    }
    // And the scale note is the one `describeValueScale` writes, character for
    // character: the clause was paid for by dropping this note's opening repeat
    // of the scale name, so the name has to be back for the height to be back.
    const scaleNote = host.querySelector('.legend-scale-note').textContent;
    assert.equal(scaleNote, describeValueScale(metric, scale));
    assert.match(scaleNote, /^Scale: /);
    // The ramp row still names the scale above the note, as it always did.
    assert.ok(host.querySelector('.legend-ramp-row'));
    assert.ok(host.querySelector('.legend-scale-name').textContent.length > 0);
  });
});

test('the category legend states no draw order either', async () => {
  await withFakeDocument((document) => {
    const host = document.createElement('div');
    renderCategoryLegend(host, {
      labels: ['Photosynthesis'],
      categoryIds: ['photosynthesis'],
      multipleLabel: 'Multiple functions',
      scale: buildCategoryColorScale(1),
      counts: [3],
      unknownCount: 5,
      multipleCount: 0,
      hiddenReviewedCount: 0,
      hiddenUnknownCount: 0,
      showHidden: false,
      hasDerivedData: true,
      drawOrderNote: 'Overlapping marks: reviewed over derived, over no category.',
    });
    for (const note of host.querySelectorAll('.legend-ramp-note').map((n) => n.textContent)) {
      assert.doesNotMatch(note, /Overlapping marks|Overlaps|draws over|Draw on top/i,
        `no category legend note may mention paint order: ${note}`);
    }
  });
});
