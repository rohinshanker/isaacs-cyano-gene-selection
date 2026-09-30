/**
 * The one way a value-scale selector is decided and then pointed at its options.
 *
 * The scatter map's toolbar and the chromosome view's toolbar both offer the
 * colour scale, and they must offer exactly the same options, disable exactly
 * the same ones, and give exactly the same reason for each. The state is decided
 * once here, by {@link scaleControlState}, and applied by
 * {@link syncScaleSelect}; neither toolbar decides anything of its own, so the
 * two cannot drift apart.
 */
import {
  DEFAULT_VALUE_SCALE, VALUE_SCALES, VALUE_SCALE_LABELS,
} from '../core/value-scales.js';

/** Why a function-category colour has no value scale to choose. */
export const CATEGORICAL_SCALE_REASON = 'Function category has no numeric scale: its colours are '
  + 'a set of named categories, not a ramp over values.';

/**
 * The whole state of a Scale selector: every scale it lists, which of them are
 * disabled and why, the scale in effect, and whether the control itself has
 * anything to choose.
 *
 * Nothing is ever hidden. A scale the metric cannot take is listed and disabled
 * with the reason the availability test gave, so a reader learns something about
 * the metric; a colour with no numeric scale at all disables the control itself
 * and carries its own reason. Both toolbars are handed this one object, so a
 * state can only be applied to both or to neither.
 *
 * @param {{categorical: boolean, scale: string|null,
 *   availability: Map<string, {available: boolean, reason: string|null}>|null}} colors
 *   the resolved colour channel: `availability` is null exactly when
 *   `categorical` is true, because a category set has no column to test.
 * @returns {{options: {value: string, label: string, disabled: boolean,
 *   reason: string|null}[], value: string, disabled: boolean, reason: string|null}}
 */
export function scaleControlState(colors) {
  return {
    options: VALUE_SCALES.map((scale) => {
      const entry = colors.availability?.get(scale) ?? { available: true, reason: null };
      return {
        value: scale,
        label: VALUE_SCALE_LABELS[scale],
        disabled: !entry.available,
        reason: entry.reason,
      };
    }),
    value: colors.scale ?? DEFAULT_VALUE_SCALE,
    disabled: colors.categorical,
    reason: colors.categorical ? CATEGORICAL_SCALE_REASON : null,
  };
}

/**
 * Point a value-scale selector at the options it should offer, the one in effect,
 * and whether the control itself has anything to choose.
 *
 * A scale the metric cannot take stays listed and disabled with its reason as a
 * title, never hidden: a reader learns something about the metric that way, and
 * an option that disappears looks like a bug. Where the colour has no numeric
 * scale at all — a function category — the whole control is disabled and carries
 * the reason, which is `control.disabled`; that state travels with the options
 * rather than beside them so a toolbar cannot apply one without the other.
 *
 * The list is short and rebuilt on every call — unlike the Colour by selector,
 * which caches its hundreds of grouped options — so there is no signature to keep
 * and nothing to fall stale. Replacing a select's options does not move focus off
 * the select itself.
 *
 * @param {HTMLSelectElement} select
 * @param {{options: {value: string, label: string, disabled: boolean,
 *   reason: string|null}[], value: string, disabled: boolean,
 *   reason: string|null}} control
 */
export function syncScaleSelect(select, control) {
  select.replaceChildren();
  for (const option of control.options) {
    const node = document.createElement('option');
    node.value = option.value;
    node.textContent = option.label;
    node.disabled = option.disabled;
    node.title = option.reason ?? '';
    select.append(node);
  }
  select.value = control.value;
  select.disabled = control.disabled;
  select.title = control.disabled ? control.reason ?? '' : '';
}
