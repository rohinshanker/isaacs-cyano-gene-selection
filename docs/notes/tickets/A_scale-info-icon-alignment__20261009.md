# A_scale-info-icon-alignment__20261009 — Active

- **Scope:** Centre the info icon beside Scale with the surrounding control line.
- **Status:** active
- **Opened:** 2026-10-09
- **Updated:** 2026-10-09

## Current State

Owned by `cyano-ui-fixes` for implementation, integration and closure. Work started
2026-10-09 under the owner's request to complete unblocked tickets. The owner requests vertical centring of the info icon next
to **Scale** with the line it belongs to. The map and chromosome toolbars share
the Scale disclosure pattern; inspect both rendered instances before fixing.

## Acceptance

- Centre the icon with its adjacent Scale label/control line at desktop widths
  and with the corresponding label line when controls stack at narrow widths.
- Keep Colour by and Scale aligned under the existing responsive layout. Use
  scoped layout rules; do not shift unrelated info icons or popovers.
- Preserve hover/click opening, keyboard focus, Escape dismissal, accessible
  naming, and viewport-safe popover placement. Alignment must remain stable
  when the Scale control is disabled or its explanation changes.

## Verification

Ticket-only intake; the owner-reported alignment has not been independently
rendered or repaired in this intake. Intake validation on 2026-10-09 passed
metadata/link checks and the repository gates: 1,395 JavaScript tests; 925 Python
tests and 36 subtests with one skip; 119 contract checks with one declared skip.
This validates the baseline, not the unimplemented alignment change.

Before closure,
render both toolbars at mobile, tablet, and desktop widths and on both sides of
their stacking breakpoint. Inspect screenshots and element bounds, then check
popover interaction and enabled/disabled Scale states. Run the gates in
`AGENTS.md`.

## Cleanup

The implementing session owns closure and records every remaining finding.
Distill any reusable alignment rule into
[responsive-workspace.md](../../validation/responsive-workspace.md), update the
validation index if needed, and follow the required resolved-ticket lifecycle.
