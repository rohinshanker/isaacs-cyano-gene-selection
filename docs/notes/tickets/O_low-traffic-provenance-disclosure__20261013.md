# O_low-traffic-provenance-disclosure__20261013 — Open

Scope: Collapse the Hide low-traffic genes dataset-selection explanation into a tan disclosure labeled Provenance to reduce controls-column height.
Status: open
Opened: 2026-10-13
Updated: 2026-10-13

## Current State

Requested by the owner; implementation is unassigned and has not started.
`renderTraffic` in `site/js/ui/filters.js` shows native measurement provenance
and proxy explanations inline; borrowed measurement provenance already uses a
tan disclosure labeled Source. Make this explanation consistently compact.
This is a narrow presentation request, separate from the broader held UI-clutter
audit and data-source admission work.

## Acceptance

- Put the dataset-selection explanation and source provenance for Hide low-traffic
  genes inside one tan box with the exact summary label **Provenance**.
- Start collapsed by default, leaving only the compact tan summary visible.
  Reuse the existing `details.tan-disclosure` component and styling rather than
  introducing a separate disclosure treatment or nested duplicate boxes.
- On expansion, retain all existing source identity, selected conditions, units,
  coverage, measurement/proxy distinctions, borrowed-source caveats and links.
  Apply the treatment consistently to native, borrowed and proxy sources.
- Keep Use same source as colouring, Judge activity by, Select source, threshold
  controls and essential current filter/status information directly usable.
  Source selection, filtering, counts and saved-view semantics are unchanged;
  blocking errors or required-action notices remain immediately visible.
- Update the disclosure content when the informing dataset changes. Preserve
  keyboard focus and the user's open state during unrelated filter/slider
  updates, without showing stale provenance or resetting a held slider.
- Support pointer and keyboard expansion/collapse, a visible focus indicator,
  readable contrast and wrapped content at narrow column widths. The collapsed
  state must visibly reduce the filter section's height.

## Verification

Ticket creation: checked the live queue, `renderTraffic`, and the existing
[tan disclosure contract](../../validation/responsive-workspace.md).
Implementation must use the UI render/inspect/repair skill and inspect collapsed
and expanded states at mobile/tablet/desktop widths. Exercise native, borrowed
and proxy sources, follow-colour on/off, source changes, slider interaction,
keyboard focus and unavailable evidence. Confirm filtering results are unchanged
and run the repository's required gates before resolving.

## Cleanup

The implementing session claims ownership before changing shared code. Record
and resolve every finding, distill the reusable presentation contract into the
existing validation guidance and index, then remove this ticket and its queue
row according to AGENTS.md. Leave unrelated tickets and sessions untouched.
