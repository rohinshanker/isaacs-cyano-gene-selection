/**
 * What a change to the map toolbar's Colour by or Scale selector does, and what
 * it says.
 *
 * This wiring is here rather than inline in `app.js` because the sentence a
 * change announces is the whole report a screen-reader user gets of the colour
 * channel, and nothing inside `app.js` can be reached by a unit test: that
 * module boots the application on import. The handlers and the sentence are
 * therefore built where a test can drive them, over the same control state the
 * two toolbars' selectors are pointed at.
 */
import { valueScaleClause } from '../core/value-scales.js';

/**
 * The sentence the announcer reads once the colours have been rebuilt: the
 * colour in effect and the scale it is read under, or — for a function category,
 * which has no numeric scale — the reason there is none.
 *
 * That reason is taken from the control state the colour model already resolved,
 * the one object both Scale selectors are pointed at, so the announcement cannot
 * give a reader a different reason from the one the selector shows.
 *
 * @param {{categorical: boolean, label: string, valueScale: string,
 *   scaleControl: {reason: string|null}}} colors the resolved colour channel.
 * @returns {string}
 */
export function colorAnnouncement(colors) {
  return colors.categorical
    ? `Colouring by ${colors.label}. ${colors.scaleControl.reason}`
    : `Colouring by ${colors.label} ${valueScaleClause(colors.valueScale)}.`;
}

/**
 * Wire the two selectors. Each hands the whole new colour selection to
 * `onChange`, which is what writes and renders it, and then announces the colour
 * channel that resulted.
 *
 * Choosing a colour clears the scale: a new metric opens on its own default, and
 * the previous metric's choice says nothing about this one. Only a hash naming
 * the scale key overrides that, and it does so by writing the scale after this
 * handler has run. The announcement reads the model *after* `onChange`, so it
 * names the scale that was resolved rather than the cleared value written here.
 *
 * @param {{colorBy: HTMLSelectElement, scale: HTMLSelectElement,
 *   model: function(): object, onChange: function({colorBy: string,
 *   colorScale: string|null}): void, announce: function(string): void}} controls
 */
export function installColorControls({ colorBy, scale, model, onChange, announce }) {
  colorBy.addEventListener('change', () => {
    onChange({ colorBy: colorBy.value, colorScale: null });
    announce(colorAnnouncement(model()));
  });
  scale.addEventListener('change', () => {
    onChange({ colorBy: colorBy.value, colorScale: scale.value });
    announce(colorAnnouncement(model()));
  });
}
