/**
 * The one way a value-scale selector is pointed at its options.
 *
 * The scatter map's toolbar and the chromosome view's toolbar both offer the
 * colour scale, and they must offer exactly the same options, disable exactly
 * the same ones, and give exactly the same reason for each. That is one function
 * rather than two, so the two toolbars cannot drift apart.
 */

/**
 * Point a value-scale selector at the options it should offer and the one in
 * effect.
 *
 * A scale the metric cannot take stays listed and disabled with its reason as a
 * title, never hidden: a reader learns something about the metric that way, and
 * an option that disappears looks like a bug. The list is short and rebuilt on
 * every call — unlike the Colour by selector, which caches its hundreds of
 * grouped options — so there is no signature to keep and nothing to fall stale.
 * Replacing a select's options does not move focus off the select itself.
 *
 * @param {HTMLSelectElement} select
 * @param {{value: string, label: string, disabled: boolean, reason: string|null}[]} options
 * @param {string} value the scale in effect.
 */
export function syncScaleSelect(select, options, value) {
  select.replaceChildren();
  for (const option of options) {
    const node = document.createElement('option');
    node.value = option.value;
    node.textContent = option.label;
    node.disabled = option.disabled;
    node.title = option.reason ?? '';
    select.append(node);
  }
  select.value = value;
}
