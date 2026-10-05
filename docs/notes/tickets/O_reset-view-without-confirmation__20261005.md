# O_reset-view-without-confirmation__20261005 — Open

Scope: Remove confirmation from the Reset view buttons.
Status: open
Opened: 2026-10-05
Updated: 2026-10-05

## Current State

The owner requests that **Reset view** act immediately, without the “Are you
sure?” popup. Apply consistently to the scatter-map and chromosome-view buttons.
Implementation has not started.

This is an explicit exception to the current “Every reset asks first” contract
in [controls-column-and-resets.md](../../validation/controls-column-and-resets.md).
Other reset controls keep their existing behavior.

## Verification

Ticket metadata, links, and live-index membership checked when opened.
Implementation acceptance criteria:

- Clicking or keyboard-activating Reset view resets the current view immediately
  and opens no confirmation dialog.
- Scatter maps return to their default zoom/position; chromosome tracks return
  to their full-length windows. Existing status announcements remain available,
  and keyboard focus stays on the button.
- Pinned gene, shortlist, filters, colour, and recoding scheme are preserved.
- Existing double-click and `0` reset shortcuts continue to work.
- Update tests that currently require confirmation for Reset view; render and
  check both views at mobile, tablet, and desktop widths, then run all repository
  completion gates.

## Cleanup

When implemented and validated, update the reset contract and relevant comments
to document this exception. Resolve and remove this ticket and its queue row.

## Implementation pointers

`site/js/app.js` wraps `#reset-view` in `confirmedReset`.
`site/js/ui/chromosome-view.js` does the same for its Reset view button.
Reuse their existing reset actions; keep the shared confirmation dialog for
the other controls.
