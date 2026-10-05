# O_live-filter-updates__20261005 — Open

Scope: Update the map live while a filter is being slid, not on release.
Status: open
Opened: 2026-10-05
Updated: 2026-10-05

## Current State

The owner requests that sliding any filter updates, as it moves, which points
disappear and reappear. Implementation has not started. Both design questions
were answered by the owner on 2026-10-05 and are recorded under Decisions.

Today a filter takes effect only when the control is released or committed:

- The activity threshold slider (`#traffic-threshold`) updates its own readout
  on every `input` event but applies the filter on `change`, which a range
  input fires on release.
- Each metric range filter is a pair of number fields, **At least** and
  **At most**, beside a histogram. They apply on `change`: on Enter, blur, or a
  spinner step, never while a value is being typed or held.
- The length explorer's range fields behave the same way.

Every applied change runs `renderAll()`, which recomputes the mask, redraws the
current view and the gene detail, and updates the filter panel itself.

## Verification

Ticket metadata, links, and live-index membership checked when opened.
Implementation acceptance criteria:

- Dragging the activity threshold slider hides and restores points continuously
  during the drag, in the scatter map and the chromosome view, with the passing
  count and the slider's readout in step with what is drawn.
- Each metric range filter and the length range has a draggable two-thumb
  slider over its range, and dragging either thumb updates the same way. The
  **At least** and **At most** number fields stay, in step with the thumbs in
  both directions, so an exact value can still be typed and a blank field still
  means no bound.
- The two thumbs cannot cross, each is separately keyboard-operable with its own
  accessible name and value text, and a range with no usable spread shows no
  slider.
- Points switch instantly as they cross the bound, with no fade or transition.
- The control being dragged is never rebuilt, replaced, or blurred mid-gesture;
  pointer capture and keyboard focus survive the whole drag, and arrow-key
  stepping updates live too.
- The value on release is the value applied. The URL and history record one
  entry per completed gesture, not one per intermediate value, and screen-reader
  announcements are not issued per intermediate value.
- A drag stays smooth on the full dataset: measure frame time during a
  continuous drag at desktop width and record it, with intermediate updates
  coalesced to at most one per animation frame.
- Pinned gene, shortlist, colour, recoding scheme, and map camera are unchanged
  by a drag. Tests cover the live path and the commit path; render and check at
  mobile, tablet, and desktop widths, then run all repository completion gates.

## Cleanup

When implemented and validated, record the live-update contract (what updates
per frame, what waits for release) in
[viewer-interaction-state.md](../../validation/viewer-interaction-state.md).
Resolve and remove this ticket and its queue row.

## Decisions

Owner, 2026-10-05:

1. The metric range filters and the length range become draggable two-thumb
   sliders. Only the activity threshold is a slider today.
2. A point disappears or reappears instantly, with no fade.

## Implementation pointers

`site/js/ui/filters.js` binds the slider's `input` to the readout and its
`change` to `handlers.onChange`; the range fields bind `change` only.
`site/js/app.js` handles `onChange` by assigning `state.filters` and calling
`renderAll()`, and `computeMask()` builds the mask the views draw from. A live
path needs the mask and the map redraw without the filter panel rebuilding its
own controls, and without the per-change URL write in `persist()`.

Stream 3 of [A_add-ecoli-organism__20261005](A_add-ecoli-organism__20261005.md)
is editing `site/js/ui/filters.js` and `site/js/app.js`; start this after that
stream is integrated.
