# Data selection interactions

The Data Sources peek shares the condition scales in `core/data-sources.js`.
Missing conditions remain explicit missing values. Selection, grouping and
comparability do not change when a column is hovered.

## Condition guides

`ConditionGuides` aligns its decorative SVG lines with the rendered header's
ticks, including the logarithmic light scale. Its lower endpoint is the actual
`.peek-count` bottom, outside the scroll container. This also applies when the
comparison pane stacks below the list. Clipping follows the visible list's
horizontal bounds. The overlay ignores pointer events and is hidden from
assistive technology.

Entry and movement within a condition column show its guides immediately;
leaving clears them. Scrolling and resize recalculate from current geometry.
Closing the peek or replacing its list clears stale guides and observers.
Filtering, grouping, selection and tab changes must keep their original data
semantics and counts. Hover hints use the existing value text independently.

## Keyboard and responsive behavior

Replacing a focused control must restore focus to its equivalent control, or a
remaining control inside the dialog if its row/filter disappears. Losing focus
to the document body breaks Escape and the focus trap. Data type tabs have one
tab stop and support Left/Right, Home and End. Closing returns focus to the
opener. Returning from source details focuses the source's info button when it
still exists.

At narrow widths the heading and Close button share a row, with wrapping data
type tabs below. Every tab and Close must remain within the viewport. The wide
condition table intentionally scrolls horizontally; primary controls stay
reachable.

## Regression checks

Run the unit contracts:

```sh
node --test tests/js/condition-guides.test.mjs tests/js/data-sources-panel.test.mjs
```

Start the real app with a unique port from the assigned worktree. Open its URL
with `?uiArtifacts=<absolute ignored artifact directory>`, then run:

```sh
playwright-cli -s=<unique-session> run-code --filename=tools/ui/check_condition_guides.js
```

The check captures every condition column at mobile, tablet, desktop and wide
sizes, and around the 600 and 1320 px breakpoints. It asserts rendered tick
alignment, the count endpoint, horizontal scrolling, sticky headers, short and
empty filters, flat/grouped lists, tab changes, Escape/focus restoration, pointer
transparency and runtime diagnostics. Inspect the screenshots as well as the
assertions. Keep full repository gates in addition to this focused check.
