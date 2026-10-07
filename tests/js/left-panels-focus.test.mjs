import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LeftPanels } from '../../site/js/ui/left-panels.js';
import { withFakeDocument } from './fake-dom.mjs';

function panel(document) {
  const column = document.createElement('aside');
  document.body.append(column);
  const view = Object.create(LeftPanels.prototype);
  view.column = column;
  view.cards = new Map();
  for (const id of ['gene-viewer', 'scheme', 'filters']) {
    const card = document.createElement('section');
    const body = document.createElement('div');
    const toggle = document.createElement('button');
    const up = document.createElement('button');
    const down = document.createElement('button');
    card.append(toggle, up, down, body);
    column.append(card);
    view.cards.set(id, { card, body, toggle, up, down, title: id });
  }
  // Model browser focus loss when an existing focused subtree is reparented.
  const append = column.append.bind(column);
  column.append = (card) => {
    if (card.contains(document.activeElement)) document.activeElement = document.body;
    card.remove();
    append(card);
  };
  view.apply({ order: ['gene-viewer', 'scheme', 'filters'], collapsed: [] });
  return view;
}

test('applying and reordering panels restores focus inside a moved card', async () => {
  await withFakeDocument((document) => {
    const view = panel(document);
    const input = document.createElement('input');
    view.cards.get('gene-viewer').body.append(input);
    input.focus();
    view.apply({ order: ['filters', 'gene-viewer', 'scheme'], collapsed: [] });
    assert.equal(document.activeElement, input);
    assert.equal(input.isConnected, true);
    view.apply({ order: ['filters', 'gene-viewer', 'scheme'], collapsed: [] });
    assert.equal(document.activeElement, input, 'an unchanged layout also retains focus');
  });
});

test('collapsing a focused panel moves focus to its visible heading control', async () => {
  await withFakeDocument((document) => {
    const view = panel(document);
    const entry = view.cards.get('gene-viewer');
    const input = document.createElement('input');
    entry.body.append(input);
    input.focus();
    view.apply({ order: ['gene-viewer', 'scheme', 'filters'], collapsed: ['gene-viewer'] });
    assert.equal(entry.body.hidden, true);
    assert.equal(document.activeElement, entry.toggle);
  });
});

test('a move button that becomes disabled gets a usable focus fallback', async () => {
  await withFakeDocument((document) => {
    const view = panel(document);
    const entry = view.cards.get('scheme');
    entry.up.focus();
    view.apply({ order: ['scheme', 'gene-viewer', 'filters'], collapsed: [] });
    assert.equal(entry.up.disabled, true);
    assert.equal(document.activeElement, entry.toggle);
  });
});

test('layout changes do not take focus from outside the column or a stable header', async () => {
  await withFakeDocument((document) => {
    const view = panel(document);
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    view.apply({ order: ['gene-viewer', 'scheme', 'filters'], collapsed: [] });
    assert.equal(document.activeElement, outside);
    const header = view.cards.get('gene-viewer').toggle;
    header.focus();
    view.apply({ order: ['gene-viewer', 'scheme', 'filters'], collapsed: [] });
    assert.equal(document.activeElement, header);
  });
});
