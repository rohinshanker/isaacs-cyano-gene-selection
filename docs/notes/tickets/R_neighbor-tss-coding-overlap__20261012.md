# R_neighbor-tss-coding-overlap__20261012 — Resolved

Scope: Neighboring-gene TSS/RBS overlap with native coding segments, filtering, colouring and all gene viewers.
Status: resolved
Opened: 2026-10-12
Updated: 2026-10-12

## Outcome

Closed by owning session `cyano-regulatory-sites` on 2026-10-12 after independent
review and production verification. Native Tan 2018 TSS associations identify
805 site/CDS relationships (802 physical sites) across 603 UTEX genes. The shared
index drives filtering, colour, chromosome markers, both compact gene viewers
and the expanded sequence. Site/source details and associated-gene navigation
remain accessible when markers are crowded or the associated gene is filtered.

No RBS coordinate layer is admitted, and the other five organisms lack this
native TSS evidence. The UI explicitly distinguishes unavailable evidence from
no recorded overlap. No predicted RBSs, transferred sites or causal regulatory
claims were added. The RBS Calculator hold and other sessions remain untouched.

## Findings

No findings against this work remain open.

- NS-1, NS-2, NS-3, NS-4, NS-5: resolved by `0205070` and confirmed in DEM-389.
- NS-6: resolved by `8afee71`, confirmed by independent repair review.
- NS-R1, NS-R2, NS-R3, NS-R4, NS-R5, NS-R6, NS-R7, NS-R8, NS-R9:
  resolved by `7c7cbbf`, accepted by DEM-389 at that exact commit.
- NS-P1: structured action keys are compared as opaque values for focus
  restoration, resolved by `ab15d6e` with test-fixture support `f688c7b`;
  DEM-390 accepted `f688c7b` after browser navigation, focus and mutation checks.
- NS-P2: colour changes preserve the shared help disclosure, resolved by
  `b553487`; DEM-390 accepted that exact commit after 24 colour changes through
  hash edits and actual selectors across chromosome and scatter views.
- NS-P3: categorical help no longer mislabels site evidence as Function category,
  resolved by `90d81b9`; both disclosures rendered locally and live at mobile,
  tablet and desktop widths with no errors or overflow.

## Verification

Final runtime passed 1,582 JS tests; 1,751 Python tests plus 51 subtests (16 skips);
UTEX contract 130 passed/zero failed/one declared skip. The implementation also
passed independent full-data membership checks, all six organism release gates,
RNA browser regression, eight-width UI checks and source-state browser checks.

Repair release `b4fee71402398e66b1b7c445571cec3235c137f0` passed Actions validation
and deployment in [run 38338828461](https://github.com/rohinshanker/isaacs-cyano-gene-selection/actions/runs/38338828461).
All 14 changed site files matched the intended live bytes. Production checks
passed all six organism counts, 603/2,112 UTEX filters, shared-link reload,
export suspension metadata, RNA folding and responsive views. Keyboard owner
navigation passed from controls, detail and sequence mounts; colour round trips
passed in chromosome and scatter views. No console, page or request errors.

## Cleanup

Reusable source, association, visibility, density, export, navigation, colour
and browser-check contracts live in
[neighbor-regulatory-sites.md](../../validation/neighbor-regulatory-sites.md),
indexed in `docs/validation/INDEX.md`. Nothing needed later lives only here.
Remove this resolved ticket last after recording closure; other owners' tickets
and worktrees remain untouched.
