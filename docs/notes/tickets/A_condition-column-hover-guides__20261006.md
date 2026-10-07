# A_condition-column-hover-guides__20261006 — Active

- **Scope:** Hover guide lines for the condition-value columns in the data
  selection area, extending existing value marks down the full column for easier
  comparison across condition sets.
- **Status:** active
- **Opened:** 2026-10-06
- **Updated:** 2026-10-06

## Current State

Opened at the owner's request; implementation has not started. In
`site/js/ui/data-sources.js`, `conditionAxis()` draws short value tick marks in
the temperature, light-intensity, and CO₂ column headers. `conditionTrack()`
places each condition set's values on the corresponding scale. The count text
(for example, "17 of 17 condition sets shown in this tab") is a separate
`.peek-count` element in `.peek-foot`, outside the scrollable `.peek-list`.
This ticket records the requested behavior; no rendered validation has occurred.

## Requirements

1. Hovering a condition-value column in the data selection area must extend its
   existing value tick marks into vertical guide lines down that column. Cover
   the column header and its condition-set cells as the hover region. Align each
   guide with the existing value scale so users can compare the rows accurately.
2. Extend the lines all the way down the column. Preserve the owner's explicit
   lower-extent requirement: the lines must **not stop before** the
   "17 of 17 condition sets shown in this tab" element. Reach the count element's
   vertical level; do not truncate the guides at the last dataset row, a group
   boundary, the study legend, or the scrollable table's edge. Use the actual
   count element as the reference, regardless of its current numbers or wording.
3. Show the guides immediately on hover, maintain them while moving within the
   column, and clear them on exit. Moving to another condition-value column must
   switch the guides to that column's scale.
4. Keep guide positions and extent correct during vertical/horizontal scrolling,
   sticky-header movement, resizing, filtering, tab changes, and transitions
   between grouped and flat lists. Support both long and short lists.
5. Keep value marks, ranges, labels, units, missing-data states, row selection,
   and count text unchanged. Guides must remain readable without obscuring
   content or intercepting pointer events and clicks. Clear stale guides when
   the data selection popup closes or its content is replaced.
6. Coordinate with
   [A_instant-hover-hints__20261006](A_instant-hover-hints__20261006.md): value
   tooltips and column guides must coexist. Preserve existing hint text exactly
   and add no popup text explaining these hover interactions.

## Implementation Notes

Start with `conditionAxis()`, `conditionTrack()`, and `renderList()` in
`site/js/ui/data-sources.js`, the popup/footer construction in that module, and
`.ds-table`, `.ds-track`, `.peek-list`, `.peek-foot`, and `.peek-count` in
`site/css/app.css`. The count sits outside the scroll container, so an overlay
clipped to the table alone cannot satisfy the lower-extent requirement.
Coordinate with
[O_data-sources-selection__20261005](O_data-sources-selection__20261005.md).

## Verification

Implementation verification is pending. Acceptance requires:

- Tests for column entry, movement within the column, switching columns, exit,
  popup closure, and content replacement; verify guide alignment and lower extent
  against the actual count element rather than a hard-coded row count.
- Use the `ui-render-inspect-repair` skill to inspect the actual data selection
  popup at mobile, tablet, and desktop widths. Check temperature, light intensity,
  and CO₂ with the 17-of-17 example, shorter filtered lists, long scrollable
  lists, sticky headers, grouped/flat views, and horizontal scrolling.
- Visually confirm the guides do not end above the count element, retain correct
  value alignment, and preserve readable text, tooltip behavior, and clicks.
- Run repository gates: `npm test`, `.venv/bin/python -m pytest -q`, and
  `.venv/bin/python tools/validate_contract.py`.

Ticket intake: read the live queue and inspected the existing value axes, table,
scroll container, and count/footer source. No application code changed.

Ticket-creation checks passed: ticket identity, required fields, unique queue
link, whitespace, `git diff --check`, `npm test` (1,066 passed),
`.venv/bin/python -m pytest -q` (479 passed, 1 skipped, 36 subtests passed), and
`.venv/bin/python tools/validate_contract.py` (110 passed, 1 skipped). These check
the current working tree; the requested guides remain unimplemented.

## Cleanup

On implementation acceptance, resolve the filename, H1, and status; record final
validation. Distill reusable guide alignment, hover, and extent checks into
`docs/validation/`, update `docs/validation/INDEX.md`, then delete the resolved
ticket and remove its queue row.
