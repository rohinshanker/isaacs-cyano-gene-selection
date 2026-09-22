import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampPanelWidths, workspaceColumns, MAP_MIN_WIDTH, PANEL_MIN_WIDTH,
} from '../../site/js/ui/workspace-resize.js';

const classes = (...names) => ({ contains: (name) => names.includes(name) });

test('desktop breakpoints and single-column views expose only relevant handles', () => {
  assert.equal(workspaceColumns(959, classes()), 0);
  assert.equal(workspaceColumns(960, classes()), 2);
  assert.equal(workspaceColumns(1240, classes()), 3);
  assert.equal(workspaceColumns(1440, classes('lengths-active')), 2);
  assert.equal(workspaceColumns(1440, classes('citations-active')), 0);
  assert.equal(workspaceColumns(1440, classes('regulatory-active')), 0);
});

test('defaults leave a visible gap and a map at least 400 pixels wide', () => {
  const two = clampPanelWidths(null, 920, 2);
  const three = clampPanelWidths(null, 1200, 3);
  assert.equal(two.left, 300);
  assert.ok(920 - 16 - two.left >= MAP_MIN_WIDTH);
  assert.equal(three.left, 280);
  assert.equal(three.right, 320);
  assert.ok(1200 - 32 - three.left - three.right >= MAP_MIN_WIDTH);
});

test('oversized or malformed saved widths cannot crush a rail or the map', () => {
  const widths = clampPanelWidths({ left: 2000, right: 2000 }, 1200, 3);
  assert.equal(widths.left, widths.leftMaximum);
  assert.equal(widths.right, PANEL_MIN_WIDTH);
  assert.equal(1200 - 32 - widths.left - widths.right, MAP_MIN_WIDTH);
  const malformed = clampPanelWidths({ left: 'not a number', right: -50 }, 1200, 3);
  assert.equal(malformed.left, 280);
  assert.equal(malformed.right, PANEL_MIN_WIDTH);
  assert.equal(clampPanelWidths({}, 700, 0), null);
});
