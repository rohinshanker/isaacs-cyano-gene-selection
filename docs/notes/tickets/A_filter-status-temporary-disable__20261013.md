# A_filter-status-temporary-disable__20261013 — Active

Scope: Extend Filter status to Chromosome/Gene, add temporary filter disabling with automatic reactivation on edits, and ensure chromosome access to Show filtered-out genes.
Status: active
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

## Cleanup

Claim ownership before editing shared filter, view-state or chromosome files.
Coordinate with the [Custom filters panel](A_custom-filters-panel__20261013.md)
and [low-traffic pooling/Provenance](A_low-traffic-provenance-disclosure__20261013.md)
tickets so their edits participate in automatic reactivation. Resolve every
finding, distill reusable interaction/state rules into validation guidance and
its index, then remove this ticket and queue row under AGENTS.md. Leave other
sessions and unrelated tickets untouched.
