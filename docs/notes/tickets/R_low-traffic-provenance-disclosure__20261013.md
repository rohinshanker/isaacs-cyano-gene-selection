# R_low-traffic-provenance-disclosure__20261013 — Resolved

Scope: Allow multiple datasets to inform Hide low-traffic genes through pooling like the colouring controls, and collapse its dataset explanation into a tan Provenance box.
Status: resolved
Opened: 2026-10-13
Updated: 2026-10-14

## Current State

Requested by the owner. Claimed 2026-10-14 by session cyano-unblocked-tix, implementing on branch `work/filters-tickets-20261014` in `../worktrees/filters-tickets-20261014`.
The owner expanded this ticket to include selecting and pooling multiple datasets,
using the colouring section as the interaction and calculation reference.
`renderTraffic` in `site/js/ui/filters.js` currently selects a traffic metric;
native measurement/proxy explanations appear inline and borrowed measurement
provenance uses a tan Source disclosure. Reuse the existing Data Sources selection
and type-metric pooling machinery for the expanded workflow.

## Acceptance

- Allow the user to select multiple eligible activity datasets and use their
  pooled values for the low-traffic threshold, with a clear list/count of the
  contributors and an explicit pooled selection, like the colouring section.
- Reuse colouring's pooling eligibility, rank/aggregation rules, missing-value
  handling and source-selection conventions. The same contributors must produce
  the same pooled per-gene values in colouring and low-traffic filtering.
  Respect the existing non-pooling quantity rules; do not average raw mixed units
  or silently pool sources the colouring controls cannot pool.
- With Use same source as colouring enabled, follow the actual informing dataset
  or pool when it is an eligible activity measure. With it disabled, allow the
  filter's own single/multiple-dataset selection without changing the colour
  metric or its informing selection. Retain an explicit fallback explanation
  when the colouring metric cannot measure activity.
- Apply the threshold to the chosen pooled values and label their scale correctly.
  Keep single-dataset operation, selection/deselection, source availability and
  saved-view/export restoration consistent. Loading, failed, disabled or missing
  evidence follows the existing pooling contract rather than becoming zero.
- Put the dataset-selection explanation and provenance inside one tan disclosure
  with the exact summary label **Provenance**, collapsed by default. Reuse the
  existing `details.tan-disclosure` treatment, with no nested duplicate box.
- Expanded Provenance retains every contributing source, condition, units,
  pooling method/scale, coverage, measurement/proxy distinction, borrowed-source
  caveat and citation/link. It must explain the pool actually informing the
  threshold and update when the selected datasets or pooling choice change.
- Keep source-selection/pooling controls, follow-colour, the threshold and
  essential current filter/status information directly usable outside the
  collapsed explanation. Blocking errors and required-action notices stay visible.
- Preserve keyboard focus, open state during unrelated updates and held-slider
  gestures. Support pointer/keyboard expansion, visible focus, readable contrast
  and wrapped text. The collapsed box must reduce controls-column height.

## Verification

Ticket preparation checked the existing filter/source controls, the
[tan disclosure contract](../../validation/responsive-workspace.md) and the
[measured-quantity/pooling contract](../../validation/measured-quantity-contract.md).
Implementation must verify single/multiple datasets, contributor changes,
non-pooling types, missing/failed sources, follow-colour on/off, pooled threshold
results, and saved-state/export round trips. Compare pooled values with colouring
for the same selected datasets and confirm single-source behaviour remains valid.
Use the UI skill to inspect collapsed/expanded Provenance and dataset selection
at mobile/tablet/desktop widths, including keyboard and slider interactions.
Run the repository's required gates before resolving.

## Outcome

Closed 2026-10-14 by session cyano-unblocked-tix, which owned and implemented it.

With Use same source as colouring on, the threshold reads the colour metric's own
object, so its datasets and pooled values are the colouring's. Off, **Choose
datasets** gives the threshold its own list (`tds`), pooled by the colouring's
rules without touching colouring (795f7d6). The follow switch is link state
(`tf=0`). A threshold is cleared, and the clearing announced, only when its scale
kind changes, whatever changes it. The explanation and every source, condition,
scale, coverage, caveat and archive link sit in one tan **Provenance** box,
closed by default, with controls, notices, slider and readout outside it. Contract
distilled to `docs/validation/viewer-interaction-state.md`.

## Findings against the work

- R1 major, own pool lost on reload while following colour: resolved in 617204a.
- R2 major, partial loading changed an own pool's units: resolved in 617204a.
- R3 major, follow-colour kept a threshold on the wrong scale: resolved in 617204a.
- R7 minor, focus inside Provenance lost on redraw: resolved in 617204a.
- Self-found: resizing a pool cleared the threshold, and focus fell to the page
  after the dataset window; both resolved in 795f7d6 before review.

No finding is open.

## Final validation

Final validation, 2026-10-14, on branch `work/filters-tickets-20261014` after merging
`origin/main` at 7dedca7: `npm test` 1,623 pass; `.venv/bin/python -m pytest -q`
2,080 pass, 20 skipped, run with the main checkout's ignored raw inputs linked in;
`.venv/bin/python tools/validate_contract.py` 130 pass, 1 skipped; module preloads
match the import graph. Rendered in Chromium at 375, 768, 1280 and 1440 px with no
console errors, failed requests or horizontal overflow; screenshots under
`.playwright-cli/filters-tix-20261014/` in the worktree (ignored). Cross-provider
review by Codex `gpt-6-astra` at xhigh on bfb78d2..9c1ae27 returned R1 to R7;
the same reviewer confirmed all seven resolved in 617204a with no new defects in
c81bce2 or 617204a, and confirmed 469a767.

Rendered: single and multiple own datasets, a non-pooling type reading one,
follow on and off, colouring unchanged by an own selection, scale-change clearing,
pool resizing keeping the threshold, focus return after the dataset window, a
bypassed link with an own pool, collapsed and open Provenance at four widths.

## Cleanup

Claim ownership and coordinate shared FilterPanel work with the
[Custom filters panel ticket](R_custom-filters-panel__20261013.md); low-traffic
controls remain a built-in part of Filters. Resolve all findings, distill the
pooling/presentation/state contracts into existing validation guidance and its
index, then remove this ticket and queue row according to AGENTS.md. Leave the
broader held UI-clutter audit, data admission work and other sessions untouched.
