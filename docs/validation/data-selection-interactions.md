# Data selection interactions

The Data Sources peek shares the condition scales in `core/data-sources.js`.
Missing conditions remain explicit missing values. Selection, grouping and
comparability do not change when a column is hovered.

## Axis subset mode

Metric X and Metric Y each own a headless `DataSourcesPanel` instance in
`subset` mode. The modal title names the requesting axis and metric, and its
candidate ids are the complete admitted catalogue group for that metric. A
global colour/PCA selection therefore cannot make an axis dataset unreachable.
Each instance has its own draft and dialog id; opening or cancelling one cannot
overwrite the other axis or the main Data Sources picker.

`Use these datasets` returns catalogue-ordered ids without mutating the panel's
global selection. It is disabled when none is selected. Cancel, Escape, and the
backdrop return `null`, leave applied state untouched, and restore focus to the
axis button. The shared rows, condition metadata, comparability groups,
compendium grid, missing-value marks, touch targets, focus trap, and responsive
pane behavior remain the same as the main picker.

## Condition guides

`ConditionGuides` aligns its decorative SVG lines with the rendered header's
ticks, including the logarithmic light scale. Its lower endpoint is the actual
`.peek-count` bottom, outside the scroll container. At stacked widths the table footer sits between the list and comparison pane,
so guides reach the count without crossing unrelated comparison axes. Clipping follows the visible list's
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
tab stop and support Left/Right, Home and End. The DOM order follows the stacked or side-by-side pane arrangement, and a
breakpoint change moves only the footer, retains each pane’s scroll position,
and keeps the focused control visible after text reflow, below the list’s sticky
header and inside the client scrollport. Scroll corrections round inward to avoid
fractional clipping. A focused row is exposed in full when it fits; oversized
rows keep the control visible. Closing returns focus to the
opener. Returning from source details focuses the source's info button when it
still exists.

At narrow widths the heading and Close button share a row, with wrapping data
type tabs below. Every tab and Close must remain within the viewport. The wide
condition table intentionally scrolls horizontally; primary controls stay
reachable. With every condition filter open, the filter bar scrolls within a quarter
of the viewport height so the table and completion controls remain usable.

Dataset identity flex children shrink within their table cells. Long strain chips
wrap without truncation or overlap into neighboring condition columns; their full
text remains available. Selected data-type tabs retain readable contrast on hover.

## Regression checks

Run the unit contracts:

```sh
node --test tests/js/condition-guides.test.mjs tests/js/data-sources-panel.test.mjs \
  tests/js/axis-sources.test.mjs tests/js/metric-axes.test.mjs tests/js/url-state.test.mjs
```

Start the real app with a unique port from the assigned worktree. Open its URL
with `?uiArtifacts=<absolute ignored artifact directory>`, then run:

```sh
playwright-cli -s=<unique-session> run-code --filename=tools/ui/check_condition_guides.js
```

The check captures every condition column at mobile, tablet, desktop and wide
sizes, and around the 600 and 1320 px breakpoints. It asserts rendered tick
alignment, the count endpoint, header-to-row alignment, horizontal scrolling, sticky headers, short and
empty filters, flat/grouped lists, tab changes, Escape/focus restoration, pointer
transparency and runtime diagnostics. Inspect the screenshots as well as the
assertions. Keep full repository gates in addition to this focused check.

`tools/ui/check_data_selection_wrapping.js` uses the default UTEX address (no
`org` parameter) with the same app/artifact setup and
checks actual dataset identities in transcriptomics, proteomics and fitness,
including long strain names, all four viewport sizes and the 1320px breakpoint.
It asserts chip geometry, selected-tab hover contrast, access to the last condition
column, Escape/focus restoration and runtime diagnostics. Inspect its long-strain
and right-column screenshots; a tall row uses the existing vertical scroll pane.

Measurement provenance shows every declared source in the dataset disclosure.
Exports carry compact provenance and caveats only for the measurement columns
written (including each pooled contributor); the detailed condition dossier
stays in the pinned data artifact. Fitness caveats use the measurement label.
