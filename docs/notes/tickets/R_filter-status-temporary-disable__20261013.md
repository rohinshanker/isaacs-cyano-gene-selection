# R_filter-status-temporary-disable__20261013 — Resolved

Scope: Extend Filter status to Chromosome/Gene, add temporary filter disabling with automatic reactivation on edits, and ensure chromosome access to Show filtered-out genes.
Status: resolved
Opened: 2026-10-13
Updated: 2026-10-14

## Current State

Requested by the owner. Claimed 2026-10-14 by session cyano-unblocked-tix, implementing on branch `work/filters-tickets-20261014` in `../worktrees/filters-tickets-20261014`.
The scatter view has a collapsed tan Filter status disclosure (`#filter-banner`)
for active filters. Chromosome/Gene already has a Show filtered-out genes checkbox
(`#chromosome-show-hidden`) sharing `state.showHidden` with the scatter view.
Extend/reuse these controls and shared state rather than creating duplicates.
See [chromosome interaction contracts](../../validation/chromosome-view.md) and
[the disclosure contract](../../validation/responsive-workspace.md).

## Acceptance

- Show the same collapsed-by-default **Filter status** section in Chromosome/Gene
  when filters are active, with summaries consistent with the scatter view.
- Inside Filter status, add a toggle labeled **Turn filters off**. Turning it on
  temporarily bypasses the configured filters so all genes are included, retaining
  their criteria and values for restoration. Turning it off reapplies those same
  filters. This is a reversible bypass, not Clear all filters.
- While bypassed, change the visible summary to **Filter status (temporarily
  disabled)** in every view that displays it. Keep the section and toggle visible
  while configured filters are bypassed, even though the effective mask includes
  all genes; do not hide the only way to re-enable them.
- Any user change to the filtering criteria automatically switches Turn filters
  off back off and applies the updated filters immediately. Cover adding,
  removing, editing or clearing custom/built-in filters, and changing a source or
  pool that informs an active low-traffic filter. Clear all also clears bypass.
  A repaint, tab switch, panel collapse or visibility-only change must not
  accidentally reactivate filters.
- Keep bypass state, summaries, effective counts and filtering consistent across
  scatter and chromosome views. Preserve configured criteria and distinguish
  effective filtering from those retained criteria in applicable saved/export
  state. Bypassing must not reset the camera, pinned gene or shortlist.
- Ensure **Show filtered-out genes** is clearly available in Chromosome/Gene,
  including narrow layouts, and remains synchronized with its existing shared
  control. With filters applied, it shows/hides excluded genes using the existing
  muted treatment; it does not alter the criteria or turn bypass on/off.
  While filters are temporarily off, all genes are included regardless of that
  visibility setting; restoring filters restores its normal effect.
- Preserve accessible disclosure/toggle labels, keyboard operation, focus and
  open state across updates. Announce the change in filter application clearly
  and avoid contradictory active-filter or hidden-gene messages while bypassed.

## Verification

Ticket creation: inspected the queue, existing scatter Filter status markup,
shared visibility state and chromosome checkbox. Implementation must test the
apply → bypass → restore sequence without losing criteria, automatic reactivation
for every filter-change path, zero/all passing genes, clear-all, unavailable
sources, and shared state across tabs. Confirm retained criteria and the effective
mask agree with summaries and applicable exports/saved views.
Use the UI skill for collapsed/expanded sections, checkbox/keyboard interactions
and both filtered-out visibility settings at mobile/tablet/desktop widths.
Run the repository's required gates before resolving.

## Outcome

Closed 2026-10-14 by session cyano-unblocked-tix, which owned and implemented it.

Filter status appears on the map and in the chromosome view whenever configured
filters hide a gene, and always while bypassed, with a **Turn filters off** toggle
(20147cd). The bypass keeps every criterion and includes every gene; its summary
reads **Filter status (temporarily disabled)** everywhere. Any criteria change ends
it, detected by a signature of reader-chosen criteria, so repaints, tab switches,
panel collapses and Show filtered-out genes do not. Clear all ends it. Shared as
`fo=1`. By owner decision of 2026-10-14, an export made while bypassed marks every
row's `passesCurrentFilters` as `true (filters turned off at export)` and carries a
manifest note. In the chromosome view the section sits under the window readout,
below the row holding Show filtered-out genes (c81bce2). Contract distilled
to `docs/validation/viewer-interaction-state.md` and
`docs/validation/candidate-comparison-and-export.md`.

## Findings against the work

- R4 major, follow-colour reconciled after the bypass check: resolved in 617204a.
- R5 major, signature omitted annotation and Tan source choices: resolved in 617204a.
- R6 minor, map Filter status lagged during a live drag: resolved in 617204a.
- Self-found: the reactivation announcement was overwritten by the edited
  control's own announcement; resolved in 20147cd before review.
- Self-found: the chromosome status region came before the window readout and
  broke `tools/ui/check_neighbor_sites_repair.js`; resolved in c81bce2.

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

Rendered: apply, bypass and restore without losing criteria; reactivation by a
built-in filter, a custom filter removal, a live drag, a low-traffic pool change and
follow-colour; no reactivation on Show filtered-out genes, panel collapse or late
file arrival; Clear all; a bypassed link reloaded into the chromosome view; both
views at four widths. The tab-switch case is covered by the signature tests, which
show the panel and other view fields leave the criteria unchanged.

## Cleanup

Claim ownership before editing shared filter, view-state or chromosome files.
Coordinate with the [Custom filters panel](R_custom-filters-panel__20261013.md)
and [low-traffic pooling/Provenance](R_low-traffic-provenance-disclosure__20261013.md)
tickets so their edits participate in automatic reactivation. Resolve every
finding, distill reusable interaction/state rules into validation guidance and
its index, then remove this ticket and queue row under AGENTS.md. Leave other
sessions and unrelated tickets untouched.
