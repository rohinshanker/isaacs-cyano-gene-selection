# O_dataset-coloring-loading-bar__20261008 — Open

Scope: Overlay a continuous loading bar on the map when switching to dataset-based coloring, driven by actual data-loading progress.
Status: open
Opened: 2026-10-08
Updated: 2026-10-08

## Current State

Opened at the owner's request: a loading bar should appear when switching to
a dataset-based coloring scheme that causes lag. Owner clarification on
2026-10-08: put the bar over the map, display it continuously during loading,
and base its progress on actual data loading. Use a continuous bar rather than
grouped/segmented progress. No implementation or rendered reproduction has
started. Identify the affected coloring choices and distinguish fetching,
processing, applying values and rendering in the measured lifecycle.

Opening baseline: canonical Desktop checkout, `main` at
`e1f54f85d52c57344c5a70c5abe19297fd18b079`. The current
[progressive-loading contract](../../validation/progressive-loading.md) covers
staged file/resource progress; already-loaded dataset selections do not create
network requests. Determine how the requested data-loading progress applies to
the affected choices, including already-loaded inputs. Do not invent a download
or turn computation time into fictitious byte progress.

This bar goes over the active map/viewer. The separate
[loading-bar header ticket](O_loading-bar-header-placement__20261007.md) concerns
the existing post-reveal loading presentation; its header destination does not
apply to this map overlay. Reuse shared progress accounting where appropriate
and preserve existing initial-load and retry behavior.

## Acceptance

- Switching to a dataset-based coloring scheme that requires loading visibly
  starts a bar over the map before expensive work blocks or delays the new view.
  Verify that the browser actually paints it before the wait.
- Keep one continuous bar visible and responsive throughout the data load,
  updating from measured data-loading progress for the requested selection.
  Include all required pending data in its accounting; exclude completed work
  from unrelated earlier loads. Do not use a timer-driven simulated percentage.
- Handle unknown sizes truthfully and identify any processing after transfer
  separately. Already-loaded data must not trigger a fabricated loading cycle.
  Keep completion feedback accurate until the requested coloring is applied
  and rendered, so previous colors cannot be mistaken for the new selection.
- Handle rapid switches, view/organism changes, failures and retries without
  stale colors, a stuck bar or an older operation hiding newer progress.
- Keep the overlay within the map bounds at every viewport without shifting
  the surrounding layout. Preserve accessible status, keyboard operation and
  reduced-motion behavior; avoid distracting flashes for immediate changes.
- Preserve the selected sources, quantitative values, scale and missingness.
  Loading feedback must not conceal an unresolved responsiveness defect.

## Verification

At opening, loading guidance, the placement ticket and queue links were checked.
The owner's map-overlay and continuous data-progress clarification is recorded.
No loading behavior was changed or rendered.

At implementation, use the UI render/inspect/repair workflow on the real app at
375, 768, 1280 and 1440 px and relevant breakpoints. Exercise cold and warm data,
slow computation with already-loaded inputs, fast switches, rapid superseding
switches, failure/retry, navigation and reduced motion. Inspect frames or a trace
showing the map overlay before expensive work, continuous updates corresponding
to measured data loading, and completion after the requested colors appear.
Check actual progress against controlled transfer events, including unknown
sizes and multiple files. Check screenshots, layout shifts and runtime
diagnostics. Add focused lifecycle tests and run all repository completion gates.

## Cleanup

The implementing session owns closure and must name itself and every remaining
finding. Distill the reusable coloring-progress lifecycle and accessibility
contract into `docs/validation/progressive-loading.md`, update
`docs/validation/INDEX.md`, then resolve and remove this ticket and its queue row
under the repository rules. Preserve the
[chromosome interaction contract](../../validation/chromosome-view.md) and keep
the header-placement ticket open until its own acceptance criteria are met.
