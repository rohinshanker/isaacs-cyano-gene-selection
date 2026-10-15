# R_neighbor-tss-overlap-count__20261013 — Resolved

Scope: Show and use the number of distinct neighbouring-gene TSS sites inside each gene's CDS, including both same- and opposite-strand TSSs.
Status: resolved
Opened: 2026-10-13
Updated: 2026-10-14

## Current State

Requested by the owner. Claimed 2026-10-14 by session cyano-unblocked-tix, implementing on branch `work/filters-tickets-20261014` in `../worktrees/filters-tickets-20261014`.
The detail panels already show a distinct-site count, but the neighbouring-gene
TSS colour mode uses categorical zero versus one-or-more, plus unavailable.
Reuse the existing `neighbor-sites.js` relation count and admitted site identity;
the shared relation already includes sites from either strand.
See [the current contract](../../validation/neighbor-regulatory-sites.md).

## Acceptance

- Expose the actual nonnegative integer overlap count in both Colour by selectors
  and their scales/legends, so genes with 1, 2 or many sites are distinguishable.
  Keep the option in the first Genomic context group.
- Support inclusive minimum/maximum count filtering. Preserve the existing
  any/with/without/unavailable choices as compatible shortcuts or migrate their
  saved state explicitly; old categorical values must not silently become counts.
- The displayed total includes TSSs on both the same and opposite strands
  relative to the focal CDS. A gene with two same-strand and three opposite-strand
  sites therefore has a total of five. Determine the strand relation from the
  site's strand and the focal gene's strand, not the associated owner's strand.
- Count distinct admitted sites, not source rows, conditions or associated genes.
  Repeated conditions/multiple owners of one site count once. Preserve the
  source/type/replicon/base/strand identity: opposite-strand sites at the same
  coordinate remain distinct. Self-only and unresolved associations retain their
  existing exclusion rules; any resolved other-gene association qualifies.
- Count points inside the union of actual CDS segments, with inclusive boundaries;
  exclude coding gaps and display padding. Preserve split-CDS, circular-origin
  and source-owner rules, as well as the existing strand labels in the site lists.
- Use the same total in colouring, filters, gene summaries, both compact gene
  viewers, the expanded sequence view and applicable exports/saved views.
  Missing, failed, loading or disabled evidence stays unavailable, not zero.
  Display zoom, hidden marks or filtered-out neighbouring genes must not alter it.
- Keep the admitted Tan 2018 TSS evidence and exact-base line/underline rendering.
  The count describes recorded sites inside the CDS, not demonstrated regulation.
  No RBS coordinates or transferred predictions are introduced by this ticket.

## Verification

Ticket creation: checked the queue for duplicates and confirmed the existing
relation count, categorical colour values and strand labels in the core/UI code.
Implementation must test 0/1/multiple sites, mixed strands, coincident opposite
strands, duplicate conditions/owners, unavailable evidence, segment boundaries,
saved-state compatibility and count-filter/colour/export agreement. Compare
counts against an independent enumeration of the shipped site/CDS relationships.
Run the repository's three gates (`npm test`, `.venv/bin/python -m pytest -q`,
`.venv/bin/python tools/validate_contract.py`) and rendered mobile/tablet/desktop
checks using the UI skill, including both colour selectors and gene viewers.

## Outcome

Closed 2026-10-14 by session cyano-unblocked-tix, which owned and implemented it.

The Neighbouring-gene TSS in CDS colour option, still first in Genomic context,
draws the count of distinct admitted sites inside each CDS, both strands, on the
numeric ramps, with a legend row per count and an unavailable row (9c1ae27). An
inclusive at-least/at-most range (`nc`) filters beside the unchanged With, Without
and Unavailable shortcuts, disabled while the evidence is unreadable unless a saved
range needs clearing (469a767). Exports carry `neighborTssSitesInCds`, blank when
unavailable. Contract distilled to `docs/validation/neighbor-regulatory-sites.md`.
No RBS coordinates or transferred predictions were introduced.

## Findings against the work

- Review: no finding against this ticket's scope (Codex, on bfb78d2..9c1ae27).
- Self-found: the filter panel was not handed the saved range, so its field showed
  empty and Clear all could stay disabled; resolved in 9c1ae27 before review.
- Self-found: the legend dropped a zero unavailable row the UI script expects;
  resolved in c81bce2.
- Self-found: count fields stayed editable without evidence; resolved in 469a767.

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

Rendered: count colour and legend on map and chromosome at four widths; a count
range with focus kept on its field; a saved range shown after load; the repository
scripts `tools/ui/check_neighbor_sites.js`, `_states.js` and `_repair.js` pass.
Shipped data: legend rows sum to 2,715 genes; 142 genes hold two or more sites;
the 603 genes with any site equal the old With total; colour values and the range
filter match an independent enumeration in `tests/js/neighbor-site-count.test.mjs`.

## Cleanup

The implementing session claims ownership before editing shared code. Resolve
only after every finding is accounted for; distill reusable count and saved-state
contracts into the existing validation guidance, update its index, then remove
this ticket and its queue row according to AGENTS.md. Leave other sessions' work
and the separate regulatory-method/RBS tickets untouched.
