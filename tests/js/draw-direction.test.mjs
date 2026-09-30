/**
 * The "Draw on top" control: what it offers, when it is disabled, and how the
 * reason reaches a reader who cannot focus a disabled select.
 *
 * The control is mounted once per disclosure and pointed at a new state on every
 * later render, so these tests render twice and assert the element survived —
 * that is what keeps keyboard focus on the select the reader just used.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { drawDirectionControlState, renderDrawDirection } from '../../site/js/ui/draw-direction.js';
import {
  CATEGORICAL_DIRECTION_REASON, DEFAULT_DRAW_DIRECTION, DRAW_DIRECTIONS, DRAW_DIRECTION_LABELS,
} from '../../site/js/core/paint-priority.js';
import { withFakeDocument } from './fake-dom.mjs';

/** The parts of a mounted control a test asserts on. */
function partsOf(field) {
  const walk = (node, out = []) => {
    out.push(node);
    for (const child of node.children ?? []) walk(child, out);
    return out;
  };
  const nodes = walk(field);
  return {
    select: nodes.find((node) => node.tagName === 'select'),
    notice: nodes.find((node) => String(node.className).includes('draw-direction-notice')),
    hint: nodes.find((node) => String(node.className).includes('draw-direction-hint')),
    label: nodes.find((node) => node.tagName === 'label'),
    state: nodes.find((node) => String(node.className).includes('draw-direction-state')),
  };
}

test('the control state offers both directions, labelled, with the one in effect selected', () => {
  const state = drawDirectionControlState({ categorical: false }, 'lowest');
  assert.deepEqual(state.options,
    DRAW_DIRECTIONS.map((value) => ({ value, label: DRAW_DIRECTION_LABELS[value] })));
  assert.equal(state.value, 'lowest');
  assert.equal(state.disabled, false);
  assert.equal(state.reason, null);
});

test('an unknown or absent direction is shown as the default, never as itself', () => {
  for (const direction of ['sideways', '', null, undefined]) {
    assert.equal(drawDirectionControlState({ categorical: false }, direction).value,
      DEFAULT_DRAW_DIRECTION);
  }
});

test('a category colour disables the control and says why, because there is no order', () => {
  const state = drawDirectionControlState({ categorical: true }, 'lowest');
  assert.equal(state.disabled, true);
  assert.equal(state.reason, CATEGORICAL_DIRECTION_REASON);
  assert.match(state.reason, /named categories, not a ramp over values/);
});

test('the mounted control carries its options, its label, and its hint', async () => {
  await withFakeDocument((document) => {
    const details = document.createElement('details');
    const chosen = [];
    const control = drawDirectionControlState({ categorical: false }, 'highest');
    const field = renderDrawDirection(details, control, {
      idPrefix: 'probe',
      onChange: (direction) => chosen.push(direction),
    });
    const { select, notice, hint, label } = partsOf(field);
    assert.equal(field.className, 'draw-direction');
    assert.equal(label.htmlFor, 'probe-select');
    assert.equal(select.id, 'probe-select');
    assert.equal(select.getAttribute('aria-describedby'), 'probe-hint probe-notice');
    assert.equal(hint.id, 'probe-hint');
    assert.equal(notice.id, 'probe-notice');
    assert.deepEqual(select.children.map((node) => node.value), [...DRAW_DIRECTIONS]);
    assert.equal(select.value, 'highest');
    assert.equal(select.disabled, false);
    assert.equal(notice.hidden, true);
    assert.equal(notice.textContent, '');
    assert.equal(select.title, '');
    select.value = 'lowest';
    select.dispatch('change');
    assert.deepEqual(chosen, ['lowest']);
  });
});

test('a second render reuses the element and re-points it, keeping focus', async () => {
  await withFakeDocument((document) => {
    const details = document.createElement('details');
    const first = [];
    const second = [];
    const mount = (control, sink) => renderDrawDirection(details, control, {
      idPrefix: 'probe', onChange: (direction) => sink.push(direction),
    });
    const before = mount(drawDirectionControlState({ categorical: false }, 'highest'), first);
    const after = mount(drawDirectionControlState({ categorical: false }, 'lowest'), second);
    assert.equal(before, after, 'the field is created once and kept');
    assert.equal(
      details.children.filter((node) => node.className === 'draw-direction').length, 1,
    );
    const { select } = partsOf(after);
    assert.equal(select.value, 'lowest');
    // The option list is two fixed entries, so it is written once: replacing a
    // select's children on every render is what drops the reader's focus.
    assert.deepEqual(select.children.map((node) => node.value), [...DRAW_DIRECTIONS]);
    select.value = 'highest';
    select.dispatch('change');
    assert.deepEqual(first, [], 'the stale handler is not the one called');
    assert.deepEqual(second, ['highest']);
  });
});

test('a disabled control shows its reason as text, and nothing when it has none', async () => {
  await withFakeDocument((document) => {
    const details = document.createElement('details');
    const mount = (control) => renderDrawDirection(details, control, {
      idPrefix: 'probe', onChange: () => {},
    });
    const withReason = partsOf(mount({
      options: DRAW_DIRECTIONS.map((value) => ({ value, label: DRAW_DIRECTION_LABELS[value] })),
      value: 'highest',
      disabled: true,
      reason: CATEGORICAL_DIRECTION_REASON,
    }));
    assert.equal(withReason.select.disabled, true);
    assert.equal(withReason.notice.hidden, false);
    assert.equal(withReason.notice.textContent, CATEGORICAL_DIRECTION_REASON);
    assert.equal(withReason.select.title, CATEGORICAL_DIRECTION_REASON);
    // A state that disables the control without a reason is not one this app
    // produces, but it must not put the string "null" on the screen.
    const noReason = partsOf(mount({
      options: DRAW_DIRECTIONS.map((value) => ({ value, label: DRAW_DIRECTION_LABELS[value] })),
      value: 'highest',
      disabled: true,
      reason: null,
    }));
    assert.equal(noReason.notice.textContent, '');
    assert.equal(noReason.select.title, '');
    assert.equal(noReason.notice.hidden, false);
  });
});

test('an option list that changes length is rewritten, so a direction can be added', async () => {
  await withFakeDocument((document) => {
    const details = document.createElement('details');
    const mount = (options) => renderDrawDirection(details, {
      options, value: options[0].value, disabled: false, reason: null,
    }, { idPrefix: 'probe', onChange: () => {} });
    mount([{ value: 'highest', label: 'Highest value' }]);
    const field = mount([
      { value: 'highest', label: 'Highest value' },
      { value: 'lowest', label: 'Lowest value' },
    ]);
    assert.deepEqual(partsOf(field).select.children.map((node) => node.textContent),
      ['Highest value', 'Lowest value']);
  });
});

/**
 * The explanation beside the control. By owner decision of 2026-09-30 this
 * disclosure is the only visible place the ordering, the crowding figure and
 * owner decision D1's notice appear, so the block has to carry whatever sentences
 * the caller was given and has to be rewritten on every render — the figures
 * follow zoom, pan, filter and colour exactly as the canvas description does.
 */
test('the explanation is one paragraph per sentence, in the order it was given', async () => {
  await withFakeDocument((document) => {
    const details = document.createElement('details');
    const field = renderDrawDirection(details,
      drawDirectionControlState({ categorical: false }, 'highest'), {
        idPrefix: 'probe',
        onChange: () => {},
        explanation: ['Where marks overlap, the highest value draws on top.', 'Nothing is hidden.'],
      });
    const { state } = partsOf(field);
    assert.deepEqual(state.children.map((node) => node.textContent),
      ['Where marks overlap, the highest value draws on top.', 'Nothing is hidden.']);
    assert.deepEqual(state.children.map((node) => node.tagName), ['p', 'p']);
    for (const line of state.children) {
      assert.match(String(line.className), /draw-direction-sentence/);
    }
  });
});

test('the explanation is rewritten on every render, so the figures follow the picture', async () => {
  await withFakeDocument((document) => {
    const details = document.createElement('details');
    const mount = (explanation) => renderDrawDirection(details,
      drawDirectionControlState({ categorical: false }, 'highest'),
      { idPrefix: 'probe', onChange: () => {}, explanation });
    const before = partsOf(mount(['600 of 900 occupied columns hold more than one CDS.'])).state;
    const after = partsOf(mount(['1 of 4 occupied columns holds more than one CDS.'])).state;
    assert.equal(before, after, 'the block is the same element, so focus is not disturbed');
    assert.deepEqual(after.children.map((node) => node.textContent),
      ['1 of 4 occupied columns holds more than one CDS.']);
  });
});

test('a caller with nothing to explain leaves an empty block, which takes no height', async () => {
  await withFakeDocument((document) => {
    const details = document.createElement('details');
    const field = renderDrawDirection(details,
      drawDirectionControlState({ categorical: false }, 'highest'),
      { idPrefix: 'probe', onChange: () => {} });
    // `.draw-direction-state:empty` is `display: none`, so an omitted explanation
    // costs the open disclosure nothing at all.
    assert.deepEqual(partsOf(field).state.children, []);
  });
});
