/**
 * The Scale selector's state, and the fact that both toolbars get all of it.
 *
 * The map's Scale control and the chromosome tab's are two elements pointed at
 * one decision. What made them drift before was a state applied beside the
 * options rather than with them: the map received the categorical disabled state
 * and the chromosome tab did not, so under a Function category colour the
 * chromosome selector stayed enabled and a choice made in it snapped silently
 * back. These checks exercise the functions `app.js` itself calls.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORICAL_SCALE_REASON, scaleControlState, scaleNoticeText, syncScaleSelect,
} from '../../site/js/ui/scale-select.js';
import { valueScaleAvailability } from '../../site/js/core/value-scales.js';
import { withFakeDocument } from './fake-dom.mjs';

/** A column with a zero and a negative value, so two scales are unavailable. */
const SIGNED = [-4, 0, 3, 90];

/** The control state for a numeric colour, as `resolveColorScale` reports one. */
function metricControl(scale = 'symlog') {
  return scaleControlState({
    categorical: false,
    scale,
    availability: valueScaleAvailability(SIGNED, { label: 'Upstream distance' }),
  });
}

test('a metric control lists every scale, disabling the ones the column blocks', () => {
  const control = metricControl();
  assert.deepEqual(control.options.map((option) => option.value),
    ['linear', 'log10', 'percentile', 'sqrt', 'symlog']);
  assert.deepEqual(control.options.filter((option) => option.disabled).map((o) => o.value),
    ['log10', 'sqrt']);
  assert.equal(control.options[1].reason,
    'Logarithmic is unavailable for Upstream distance: 2 values are zero or negative.');
  assert.equal(control.options[3].reason,
    'Square root is unavailable for Upstream distance: 1 value is negative.');
  assert.equal(control.value, 'symlog');
  // The control itself has something to choose, so it is not disabled.
  assert.equal(control.disabled, false);
  assert.equal(control.reason, null);
});

test('a function-category colour disables the control itself, with its reason', () => {
  const control = scaleControlState({ categorical: true, scale: null, availability: null });
  assert.equal(control.disabled, true);
  assert.equal(control.reason, CATEGORICAL_SCALE_REASON);
  assert.match(control.reason, /no numeric scale/);
  // Every option is still listed and enabled: what is unavailable is the whole
  // control, and the reason says why, rather than five options each claiming a
  // reason of its own.
  assert.equal(control.options.length, 5);
  assert.deepEqual(control.options.filter((option) => option.disabled), []);
  // With no scale in effect the control shows the fresh default rather than a
  // blank, so it never reads as a scale nothing is drawing.
  assert.equal(control.value, 'linear');
});

test('one control state applied to two selectors leaves them identical', async () => {
  await withFakeDocument((document) => {
    const read = (select, notice) => ({
      value: select.value,
      disabled: select.disabled,
      title: select.title,
      options: select.children.map((option) => [option.value, option.disabled, option.title]),
      notice: [notice.textContent, notice.hidden],
    });
    for (const control of [metricControl(), metricControl('linear'),
      scaleControlState({ categorical: true, scale: null, availability: null })]) {
      const map = document.createElement('select');
      const mapNotice = document.createElement('p');
      const chromosome = document.createElement('select');
      const chromosomeNotice = document.createElement('p');
      syncScaleSelect(map, control, mapNotice);
      syncScaleSelect(chromosome, control, chromosomeNotice);
      assert.deepEqual(read(map, mapNotice), read(chromosome, chromosomeNotice));
      assert.equal(map.disabled, control.disabled);
      assert.equal(map.title, control.disabled ? control.reason : '');
      assert.equal(map.value, control.value);
      // The visible reasons are part of the one state, not a second decision a
      // toolbar could skip: both notes say the same thing or neither does.
      assert.equal(mapNotice.textContent, scaleNoticeText(control));
    }
  });
});

test('a selector re-pointed from a category to a metric stops being disabled', async () => {
  await withFakeDocument((document) => {
    const select = document.createElement('select');
    const notice = document.createElement('p');
    syncScaleSelect(select, scaleControlState({
      categorical: true, scale: null, availability: null,
    }), notice);
    assert.equal(select.disabled, true);
    assert.ok(select.title.length > 0);
    assert.equal(notice.textContent, CATEGORICAL_SCALE_REASON);

    // Changing Colour by back to a metric has to clear all three, or the control
    // stays dead with a stale explanation on it and under it.
    syncScaleSelect(select, metricControl(), notice);
    assert.equal(select.disabled, false);
    assert.equal(select.title, '');
    assert.equal(select.value, 'symlog');
    assert.equal(select.children.filter((option) => option.disabled).length, 2);
    assert.match(notice.textContent, /^Logarithmic is unavailable for Upstream distance/);
  });
});

/**
 * The reasons a reader can actually reach. A disabled option's title needs a
 * pointer, and a select disabled as a whole cannot be focused at all, so before
 * this note existed every reason was unreachable by keyboard or screen reader.
 */
test('the note carries every unavailable scale\'s own reason, in the listed order', () => {
  const control = metricControl();
  assert.equal(scaleNoticeText(control),
    'Logarithmic is unavailable for Upstream distance: 2 values are zero or negative. '
      + 'Square root is unavailable for Upstream distance: 1 value is negative.');
  // Verbatim: the note and the option titles cannot describe the metric
  // differently, because they are the same strings.
  const titles = control.options.filter((option) => option.disabled).map((o) => o.reason);
  assert.equal(scaleNoticeText(control), titles.join(' '));
});

test('a column every scale can take has an empty note, and a category has one reason', () => {
  const allAvailable = scaleControlState({
    categorical: false,
    scale: 'linear',
    availability: valueScaleAvailability([1, 2, 30], { label: 'CAI' }),
  });
  assert.deepEqual(allAvailable.options.filter((option) => option.disabled), []);
  assert.equal(scaleNoticeText(allAvailable), '');
  assert.equal(scaleNoticeText(
    scaleControlState({ categorical: true, scale: null, availability: null }),
  ), CATEGORICAL_SCALE_REASON);
});

test('an empty note is hidden, so it occupies nothing at all', async () => {
  await withFakeDocument((document) => {
    const select = document.createElement('select');
    const notice = document.createElement('p');
    syncScaleSelect(select, scaleControlState({
      categorical: false,
      scale: 'linear',
      availability: valueScaleAvailability([1, 2, 30], { label: 'CAI' }),
    }), notice);
    assert.equal(notice.textContent, '');
    assert.equal(notice.hidden, true);

    // And it comes back with the reasons the next metric gives.
    syncScaleSelect(select, metricControl(), notice);
    assert.equal(notice.hidden, false);
    assert.ok(notice.textContent.length > 0);
  });
});
