/**
 * The "Draw on top" control: which of two overlapping marks the reader sees.
 *
 * It reverses nothing but paint order, and the owner called it an aesthetic
 * preference of little consequence, so it takes **no space in a primary area**.
 * It is not on a toolbar row, it adds no always-visible row, label, or height
 * to the toolbar, the map, or the legend. It lives at the bottom of the colour
 * explanation disclosure — the `<details>` beneath **Colour by**, closed in a
 * fresh view and present on every scatter tab and on the chromosome tab — so a
 * reader who never opens it pays nothing for it. That surface was chosen over
 * the others available because it is the one already about the colour channel
 * this control reorders, it already exists on both views, and it is the only
 * collapsed surface in the toolbar itself: putting the control in the controls
 * column would separate it from the picture it changes.
 *
 * By owner decision of 2026-09-30, taken after the first render, this disclosure
 * is also the **only visible place** that explains any of it. The legend note and
 * the chromosome view's conventions note carry no ordering clause and no D1
 * notice: the owner does not want explanation on screen for what a reader learns
 * by zooming or panning. So the same sentences the canvases' accessible
 * descriptions carry are mounted here as well, beside the control that reverses
 * them, where a reader who opens the disclosure asks for them — and nothing is
 * added to the closed view's height. See `explanation` in
 * {@link renderDrawDirection}.
 *
 * Mounted **after** the `.help-content` the colour explanation rewrites on every
 * render, not inside it, so the element survives a re-render and keyboard focus
 * stays on the select the reader just used.
 */
import {
  CATEGORICAL_DIRECTION_REASON, DRAW_DIRECTIONS, DRAW_DIRECTION_LABELS,
  normalizeDrawDirection,
} from '../core/paint-priority.js';

/**
 * The control mounted in each disclosure, and the handler it currently reports
 * to. Held here rather than looked up by selector on every render: the two
 * disclosures are each built once and kept, the elements are this module's own,
 * and a lookup would make the mounting depend on a query the surrounding DOM
 * could answer differently.
 */
const mounted = new WeakMap();

/**
 * The whole state of a Draw on top selector: the directions it offers, the one
 * in effect, and whether it has anything to choose at all.
 *
 * Decided here rather than in either view, exactly as `scaleControlState`
 * decides the Scale selector, so the two toolbars cannot disagree about the
 * option list or the reason the control is disabled.
 *
 * @param {{categorical: boolean}} colors the resolved colour channel.
 * @param {string} direction the draw direction in effect.
 * @returns {{options: {value: string, label: string}[], value: string,
 *   disabled: boolean, reason: string|null}}
 */
export function drawDirectionControlState(colors, direction) {
  return {
    options: DRAW_DIRECTIONS.map((value) => ({ value, label: DRAW_DIRECTION_LABELS[value] })),
    value: normalizeDrawDirection(direction),
    // Shown, never hidden, and disabled with its reason — the treatment the
    // Scale control gets under the same colour, so the two read alike.
    disabled: colors.categorical,
    reason: colors.categorical ? CATEGORICAL_DIRECTION_REASON : null,
  };
}

/**
 * Put the control at the bottom of a colour-explanation disclosure, creating it
 * on first use and pointing it at `control` on every later call.
 *
 * @param {HTMLDetailsElement} details the colour explanation disclosure.
 * @param {{options: {value: string, label: string}[], value: string,
 *   disabled: boolean, reason: string|null}} control as
 *   {@link drawDirectionControlState} returns.
 * @param {{idPrefix: string, onChange: (direction: string) => void,
 *   explanation?: string[]}} options `explanation` is what the picture is
 *   currently doing about overlapping marks — one paragraph per sentence, from
 *   `describePaintOrder`, rewritten on every render so it follows zoom, pan,
 *   filter and colour change exactly as the canvas description does. Omitted or
 *   empty, the block carries nothing and takes no height.
 * @returns {HTMLElement} the mounted field.
 */
export function renderDrawDirection(details, control, { idPrefix, onChange, explanation = [] }) {
  let entry = mounted.get(details);
  if (!entry) {
    const field = document.createElement('div');
    field.className = 'draw-direction';
    const row = document.createElement('span');
    row.className = 'field-row';
    const label = document.createElement('label');
    label.htmlFor = `${idPrefix}-select`;
    label.textContent = 'Draw on top';
    const select = document.createElement('select');
    select.id = `${idPrefix}-select`;
    select.className = 'draw-direction-select';
    select.setAttribute('aria-describedby', `${idPrefix}-hint ${idPrefix}-notice`);
    select.addEventListener('change', () => mounted.get(details)?.onChange(select.value));
    row.append(label, select);

    // The reason reaches a keyboard or screen-reader user as visible text, for
    // the reason the Scale control's note exists: a disabled select takes no
    // focus, so a title on it can only be found with a pointer.
    const notice = document.createElement('p');
    notice.className = 'panel-note scale-notice draw-direction-notice';
    notice.id = `${idPrefix}-notice`;
    notice.hidden = true;

    const hint = document.createElement('p');
    hint.className = 'panel-note draw-direction-hint';
    hint.id = `${idPrefix}-hint`;
    hint.textContent = 'Chooses which of two overlapping marks is seen when genes share the same '
      + 'pixels. It changes paint order only: no value, colour, filter, or count changes, every '
      + 'gene stays selectable and reachable by keyboard, and a gene with no value stays under '
      + 'the coloured ones in either direction.';

    // What the picture is doing right now, after the control and the note about
    // what the control does: the reader meets the choice, then what it chose.
    // A `div` of paragraphs rather than one long paragraph, so each sentence
    // wraps on its own and the block fits a 375 px disclosure.
    const state = document.createElement('div');
    state.className = 'draw-direction-state';

    field.append(row, hint, notice, state);
    details.append(field);
    entry = { field, select, notice, state, onChange };
    mounted.set(details, entry);
  }
  entry.onChange = onChange;
  const { select, notice, state } = entry;
  state.replaceChildren();
  for (const sentence of explanation) {
    const line = document.createElement('p');
    line.className = 'panel-note draw-direction-sentence';
    line.textContent = sentence;
    state.append(line);
  }
  // The list is two fixed options, so it is written once and then left alone:
  // replacing a select's children on every render is what would drop the
  // reader's focus off the control they are using.
  if (select.children.length !== control.options.length) {
    select.replaceChildren();
    for (const option of control.options) {
      const node = document.createElement('option');
      node.value = option.value;
      node.textContent = option.label;
      select.append(node);
    }
  }
  select.value = control.value;
  select.disabled = control.disabled;
  select.title = control.disabled ? control.reason ?? '' : '';
  notice.textContent = control.disabled ? control.reason ?? '' : '';
  notice.hidden = !control.disabled;
  return entry.field;
}
