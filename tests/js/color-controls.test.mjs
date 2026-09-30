/**
 * The map toolbar's colour handlers, driven the way a reader drives them: a
 * `change` on the real `#color-by` or `#color-scale` element, through the wiring
 * `app.js` installs.
 *
 * The defect this covers was an unresolved identifier in the sentence the
 * announcer reads — a `ReferenceError` raised only once someone chose Function
 * category in a browser, because the handler lived in `app.js` and `app.js` boots
 * the whole application on import, so no test could run its lines. The handlers
 * now live in a module these checks can install against fake selectors, and the
 * announcement is asserted as text.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeElement } from './fake-dom.mjs';
import { colorAnnouncement, installColorControls } from '../../site/js/ui/color-controls.js';
import { CATEGORICAL_SCALE_REASON, scaleControlState } from '../../site/js/ui/scale-select.js';
import {
  VALUE_SCALES, defaultValueScale, valueScaleAvailability,
} from '../../site/js/core/value-scales.js';
import { FUNCTION_COLOR_KEY } from '../../site/js/core/function-categories.js';

/**
 * Two columns with different default scales, so a test can tell an announcement
 * that read the metric's default from one that repeated the previous choice:
 * `tssInitiation` is strictly positive with almost everything in the lowest tenth
 * of its range, which is the rule for a logarithmic default, and `gc3` is spread
 * across its range, which defaults to linear.
 */
const METRICS = {
  tssInitiation: {
    label: 'TSS initiation',
    values: Float64Array.from([0.4, 0.9, 1.2, 2, 3.5, 6, 11, 40, 60, 1000]),
  },
  gc3: {
    label: 'GC3',
    values: Float64Array.from([0.2, 0.35, 0.5, 0.62, 0.71, 0.8, 0.88, 0.95]),
  },
};

/**
 * The colour model `app.js` resolves for a colour selection, built from the same
 * modules in the same order: a requested scale the column can take is kept,
 * anything else falls to the metric's default, and the control state is
 * `scaleControlState` over that column's availability. A fixture that hand-wrote
 * the reason or the resolved scale could not catch a handler that named either
 * one differently from the application.
 */
function colorModelFor(state) {
  if (state.colorBy === FUNCTION_COLOR_KEY) {
    return {
      categorical: true,
      label: 'Function category',
      valueScale: null,
      scaleControl: scaleControlState({ categorical: true, scale: null, availability: null }),
    };
  }
  const metric = METRICS[state.colorBy];
  const availability = valueScaleAvailability(metric.values, { label: metric.label });
  const scale = VALUE_SCALES.includes(state.colorScale)
    && availability.get(state.colorScale).available
    ? state.colorScale : defaultValueScale(metric.values);
  return {
    categorical: false,
    label: metric.label,
    valueScale: scale,
    scaleControl: scaleControlState({ categorical: false, scale, availability }),
  };
}

/**
 * The two selectors wired as `app.js` wires them, over a colour state this test
 * owns. `renders` counts the times the application was asked to redraw, which is
 * what proves the announcement is made after the new colours were resolved and
 * not from the state the handler was entered with.
 */
function mount({ colorBy = 'gc3', colorScale = null } = {}) {
  const state = { colorBy, colorScale };
  const announced = [];
  const renders = [];
  const colorBySelect = new FakeElement('select');
  const scaleSelect = new FakeElement('select');
  colorBySelect.value = colorBy;
  scaleSelect.value = colorScale ?? defaultValueScale(METRICS[colorBy].values);
  installColorControls({
    colorBy: colorBySelect,
    scale: scaleSelect,
    model: () => colorModelFor(state),
    announce: (message) => announced.push(message),
    onChange: (next) => {
      state.colorBy = next.colorBy;
      state.colorScale = next.colorScale;
      renders.push({ ...state });
    },
  });
  return { state, announced, renders, colorBySelect, scaleSelect };
}

test('choosing Function category says why there is no scale to read', () => {
  const { colorBySelect, announced, state } = mount();
  colorBySelect.value = FUNCTION_COLOR_KEY;
  colorBySelect.dispatch('change');

  assert.equal(state.colorBy, FUNCTION_COLOR_KEY);
  // The whole sentence, not a fragment: the reason is the only thing a reader who
  // cannot see the greyed-out selector is told, and a missing one used to reach
  // the announcer as a thrown ReferenceError with the previous metric's sentence
  // left standing in the live region.
  assert.deepEqual(announced,
    [`Colouring by Function category. ${CATEGORICAL_SCALE_REASON}`]);
  assert.match(announced[0], /no numeric scale/);
});

test('choosing a colour opens it on that metric\'s own default scale and names it', () => {
  // Percentile was chosen for the previous metric; the new one must not inherit it.
  const { colorBySelect, announced, state, renders } = mount({
    colorBy: 'gc3', colorScale: 'percentile',
  });
  colorBySelect.value = 'tssInitiation';
  colorBySelect.dispatch('change');

  assert.equal(state.colorScale, null, 'the previous metric\'s scale is cleared');
  assert.deepEqual(renders, [{ colorBy: 'tssInitiation', colorScale: null }]);
  // Resolved from the column, which is skewed enough to default to a logarithm.
  assert.deepEqual(announced, ['Colouring by TSS initiation on a logarithmic scale.']);
});

test('choosing a scale announces the scale now in effect', () => {
  const { scaleSelect, announced, state } = mount({ colorBy: 'gc3' });
  scaleSelect.value = 'sqrt';
  scaleSelect.dispatch('change');

  assert.deepEqual(state, { colorBy: 'gc3', colorScale: 'sqrt' });
  assert.deepEqual(announced, ['Colouring by GC3 on a square root scale.']);
});

test('the announcement is the colour model\'s own resolved reason and scale', () => {
  // The same two sentences, straight from the models, so the handlers above are
  // shown to be announcing this function's result and not composing their own.
  assert.equal(colorAnnouncement(colorModelFor({ colorBy: FUNCTION_COLOR_KEY })),
    `Colouring by Function category. ${CATEGORICAL_SCALE_REASON}`);
  assert.equal(colorAnnouncement(colorModelFor({ colorBy: 'gc3', colorScale: 'symlog' })),
    'Colouring by GC3 on a symmetric log scale.');
});
