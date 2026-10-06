import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withFakeDocument } from './fake-dom.mjs';
import { RangeSlider, hasUsableSpread } from '../../site/js/ui/range-slider.js';

function mount(document, overrides = {}) {
  const calls = { input: [], commit: [] };
  const slider = new RangeSlider({
    lo: 0, hi: 100, idPrefix: 'f-x', label: 'GC3',
    format: (value) => `${value} units`,
    onInput: (range) => calls.input.push(range),
    onCommit: (range) => calls.commit.push(range),
    ...overrides,
  });
  document.body.append(slider.element);
  return { slider, calls };
}

test('a spread is usable only when the ends differ', () => {
  assert.equal(hasUsableSpread(0, 1), true);
  assert.equal(hasUsableSpread(5, 5), false);
  assert.equal(hasUsableSpread(NaN, 5), false);
  assert.equal(hasUsableSpread(0, Infinity), false);
});

test('the thumbs are two labelled range inputs over one filled track', async () => {
  await withFakeDocument(async (document) => {
    const { slider } = mount(document);
    assert.equal(slider.element.getAttribute('role'), 'group');
    assert.equal(slider.element.getAttribute('aria-label'), 'GC3 range');
    const { min, max } = slider.thumbs;
    assert.equal(min.type, 'range');
    assert.equal(min.id, 'f-x-min-thumb');
    assert.equal(max.id, 'f-x-max-thumb');
    assert.equal(min.getAttribute('aria-label'), 'At least: GC3');
    assert.equal(max.getAttribute('aria-label'), 'At most: GC3');
    assert.equal(min.min, '0');
    assert.equal(max.max, '100');
  });
});

test('an outer end reads as no bound, and the fill and value text follow the thumbs', async () => {
  await withFakeDocument(async (document) => {
    const { slider } = mount(document);
    slider.setRange({ min: null, max: null });
    assert.deepEqual(slider.range(), { min: null, max: null });
    assert.equal(slider.thumbs.min.getAttribute('aria-valuetext'), 'no lower bound');
    assert.equal(slider.thumbs.max.getAttribute('aria-valuetext'), 'no upper bound');
    assert.equal(slider.fill.style.left, '0%');
    assert.equal(slider.fill.style.right, '0%');

    slider.setRange({ min: 25, max: 60 });
    assert.deepEqual(slider.range(), { min: 25, max: 60 });
    assert.equal(slider.thumbs.min.getAttribute('aria-valuetext'), 'at least 25 units');
    assert.equal(slider.thumbs.max.getAttribute('aria-valuetext'), 'at most 60 units');
    assert.equal(slider.fill.style.left, '25%');
    assert.equal(slider.fill.style.right, '40%');

    // A bound outside the track is held at its end, and so reads as open.
    slider.setRange({ min: -5, max: 500 });
    assert.deepEqual(slider.range(), { min: null, max: null });
  });
});

test('every movement reports live and the release commits, with the same values', async () => {
  await withFakeDocument(async (document) => {
    const { slider, calls } = mount(document);
    slider.setRange({ min: null, max: null });
    slider.thumbs.min.value = '30';
    slider.thumbs.min.dispatch('input');
    slider.thumbs.min.value = '35';
    slider.thumbs.min.dispatch('input');
    assert.deepEqual(calls.input, [{ min: 30, max: null }, { min: 35, max: null }]);
    assert.deepEqual(calls.commit, []);
    slider.thumbs.min.dispatch('change');
    assert.deepEqual(calls.commit, [{ min: 35, max: null }]);
  });
});

test('the thumbs cannot cross: the moved one is held at the other', async () => {
  await withFakeDocument(async (document) => {
    const { slider, calls } = mount(document);
    slider.setRange({ min: 20, max: 40 });
    slider.thumbs.min.value = '70';
    slider.thumbs.min.dispatch('input');
    assert.equal(slider.thumbs.min.value, '40');
    assert.deepEqual(calls.input.at(-1), { min: 40, max: 40 });
    slider.thumbs.max.value = '10';
    slider.thumbs.max.dispatch('input');
    assert.equal(slider.thumbs.max.value, '40');
    assert.deepEqual(calls.input.at(-1), { min: 40, max: 40 });
  });
});

test('a held thumb is not moved by an update, and lets go on blur', async () => {
  await withFakeDocument(async (document) => {
    const { slider } = mount(document);
    slider.setRange({ min: 20, max: 80 });
    slider.thumbs.min.dispatch('pointerdown');
    slider.thumbs.min.value = '33';
    slider.setRange({ min: 10, max: 70 });
    assert.equal(slider.thumbs.min.value, '33', 'the thumb under the pointer stays where the reader has it');
    assert.equal(slider.thumbs.max.value, '70', 'the other thumb follows the state');
    slider.thumbs.min.dispatch('blur');
    slider.setRange({ min: 10, max: 70 });
    assert.equal(slider.thumbs.min.value, '10');
    // Keyboard focus holds a thumb the same way.
    slider.thumbs.max.dispatch('focus');
    slider.setRange({ min: 5, max: 95 });
    assert.equal(slider.thumbs.max.value, '70');
    assert.equal(slider.thumbs.min.value, '5');
  });
});

test('an integer slider steps and reports whole numbers', async () => {
  await withFakeDocument(async (document) => {
    const { slider, calls } = mount(document, { lo: 71, hi: 5901, integer: true });
    assert.equal(slider.thumbs.min.step, '12');
    slider.setRange({ min: null, max: null });
    slider.thumbs.max.value = '1200.4';
    slider.thumbs.max.dispatch('input');
    assert.deepEqual(calls.input.at(-1), { min: null, max: 1200 });
  });
});
