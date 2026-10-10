# A_strain-navigation-format__20261009 — Active

- **Scope:** Group and order the organism selector; preserve collapsible, movable recoding panels.
- **Status:** active
- **Opened:** 2026-10-09
- **Updated:** 2026-10-10

## Current State

Claimed by `cyano-regulatory-sites` (session `e6e54b6e-1791581192`) on
2026-10-10 for isolated delegated implementation. Coordinator branch
`work/small-unblocked-20261010`, baseline `5431386`. Other chat worktrees,
browsers and processes are out of scope.

Opened by `cyano-ui-fixes` at the owner's request. Implementation is claimed by the coordinator above. At baseline `67c8e74`, the selector renders five peer links;
the owner wants three top-level buttons, in this order:

1. **Cyanobacteria**
2. **E. coli Syn61**
3. **E. coli**

Clicking **E. coli** opens a dropdown whose options, in order, are **MG1655**,
**MDS42**, and **DH10B**. MG1655 is the default. Selection must identify the
active strain while keeping the group button in the third position.

For Syn61 and every future strain with a recoding scheme, the recoding-scheme
panel remains collapsible and movable like the other controls-column panels.
Reuse the existing panel controls and persisted order/collapse state; do not
turn a scheme-specific block into a fixed extra panel outside that framework.

The second button will later become **Recoded E. Coli**, with a Syn57/Syn61
dropdown, under [the Syn57 inclusion ticket](O_syn57-visualizer-inclusion__20261009.md).
That later change must preserve this grouping and top-level order.

## Implementation and acceptance

- Use the existing organism registry and selector. Retain organism IDs, deep
  links, remembered views, storage isolation, and export identities.
- MG1655 remains `ecoli-k12-mg1655`. MDS42 and DH10B remain their existing
  **public reference** records; their dropdown details and organism identity
  must retain the public-reference caveat. Grouping does not assert that either
  record is the experimental stock in the Nyerges study.
- Preserve Syn61's exact genome identity even when the button uses its shorter
  name. Switching a strain continues to reset organism-specific modules and
  load only that organism's declared inputs.
- Support keyboard opening, selection, dismissal, and focus return. Expose the
  selected strain and expanded state accessibly. Preserve usable strain links.
- Check MG1655 as the fresh/default conventional E. coli selection, and direct
  links to each other strain. Keep remembered per-strain analysis state intact.
- Coordinate selector/registry edits with the owners of
  [E. coli admission](A_add-ecoli-organism__20261005.md) and
  [recoded E. coli data](A_recoded-ecoli-multiomics__20261007.md); this ticket
  changes navigation, not their admission decisions or outstanding data work.

## Verification

Independent review DEM-347, 2026-10-10: **NAV-R1 open**. At 375 px in the
MG1655/default-selector state, the open dropdown extends 58 px beyond the left
viewport edge, clipping its strain names. Reproduced by the coordinator from
the review screenshot. Repair placement for every group-label width and verify
both viewport edges; document-level horizontal overflow alone misses this case.

Other DEM-347 findings: **NAV-R2 open** (separator has no rendered gap),
**NAV-R3 open** (default MG1655 is called selected on other-organism pages;
accessible name must contain the visible label), **NAV-R4 open** (restore the
registry-to-navigation completeness test), and **NAV-R5 open** (remove unused
returned `close`). NAV-R5's listener-lifetime observation is not a current defect:
the sole production caller renders once per page, and each organism switch is a
full navigation. Retain that lifecycle rather than adding unused disposal APIs.
The existing owner rule distinguishes default MG1655 from the active strain, so
NAV-R3's truthful default/selected wording needs no new owner decision.

Ticket-only intake; no UI behavior has changed. Intake validation, 2026-10-09:
ticket metadata and queue links passed; `npm test` passed 1,395 tests; `pytest -q`
passed 925 tests and 36 subtests with one skip; the contract validator passed 119
checks with one declared skip. These gates validate the current baseline, not
the unimplemented navigation.

Before implementation closure, render the real application at mobile, tablet,
and desktop widths. Exercise all three conventional strains, Syn61, dropdown
pointer/keyboard behavior, copied/direct links, browser reload, and recoding
panel movement/collapse persistence. Run the gates in `AGENTS.md`.

Implementation handoff by `codex-implementer` for DEM-344, 2026-10-10:

- Managed branch `agent/codex-implementer/dem-344`, worktree marker `cea1ad6`,
  effective code baseline `70814d1`; implementation commit `89d199b`.
- The selector now has Cyanobacteria, E. coli Syn61, and E. coli as its three
  top-level controls. The E. coli disclosure holds MG1655, MDS42 public
  reference, and DH10B public reference as ordinary deep links and names the
  selected conventional strain without weakening either public-reference
  caveat.
- Focused selector, panel-layout, recoded-genome, and asset-graph checks passed
  36 tests. Final `npm test` passed 1,475 tests.
- The real site was served from this worktree on isolated port 8891 and checked
  in Playwright session `dem-strain-nav-20261010`. All five direct organism
  addresses resolved to their exact id, strain, assembly, selected navigation
  state, and declared dataset; no request failures, HTTP errors, console errors,
  or horizontal overflow were observed.
- Pointer open/select/outside-dismiss and keyboard Enter, arrows, Home/End,
  Escape focus return, Tab traversal/dismissal, and strain selection passed.
  MDS42/DH10B stayed visibly labelled public references. Syn61's scheme panel
  moved from second to third, collapsed, encoded `po`/`pc`, and retained both
  order and collapse after reload.
- Screenshots and semantic snapshots were inspected at 375x812, 768x1024,
  1280x800, and 1440x900, plus 420 and both sides of the 960 breakpoint. Stable
  local artifacts are under `/tmp/cyano-small-20261010/nav-artifacts`.
- Per the delegated assignment, the coordinator owns the Python pytest and
  contract-validator gates once after integration. They were not duplicated in
  this isolated implementation worktree. No remaining selector-scope finding is
  known; integration review and ticket closure remain with the coordinator.

NAV-R1 through NAV-R5 repair handoff by `codex-implementer`, 2026-10-10:

- Repair commit `e4a5102` follows implementation `89d199b` and verification
  `56a1b3d`. NAV-R1 is resolved by the shared viewport-overlay placement helper:
  the fixed strain menu is clamped on both axes and follows resize, scroll, and
  observed header, trigger, or menu size changes while it remains open.
- NAV-R2 is resolved with a real `0.35rem` flex gap rather than collapsible text
  whitespace. The browser measured 5.59 px before the separator in every state
  and width. NAV-R3 now names the visible label in the accessible name and says
  `default` on Cyanobacteria/Syn61 versus `selected` on conventional-strain
  pages; the non-link trigger no longer carries `data-organism`.
- NAV-R4 is resolved by a registry-to-navigation set-equality assertion. NAV-R5's
  unused returned `close` API is removed; the outside-press listener's safe
  once-per-document lifetime is documented, with no new lifecycle framework.
- Focused selector and shared-overlay tests passed 23/23. Final `npm test` passed
  1,476/1,476 after the last code and style change.
- `tools/ui/check_organism_navigation.js` passed default, MG1655, MDS42, and
  DH10B at 320, 375, 420, 439, 440, 768, 1280, and 1440 px while keeping the
  menu open through reflow. All 32 combinations kept 16 px viewport margins,
  showed no clipped option or page overflow, and retained ArrowDown, End,
  Escape, and focus return. A live trigger-size change also repositioned the
  open menu. The Syn61 default name passed separately.
- Final screenshots for every matrix cell, resized-trigger renders, the Syn61
  state, and the 375 px semantic snapshot are in the original stable
  `/tmp/cyano-small-20261010/nav-artifacts` directory. Representative renders
  were inspected; browser page errors, console errors/warnings, request failures,
  and HTTP errors were all zero. Visual baselines were not changed.
- Python pytest and the contract validator remain delegated to the coordinator
  after integration. The independent review remains coordinator-owned; this
  ticket stays active and is not being closed by this repair session.

## Cleanup

The implementing session owns closure. Record every remaining finding before
resolution, distill reusable navigation and panel-state rules into
[organism-selector.md](../../validation/organism-selector.md) and the applicable
panel runbook, update the validation index, then remove this ticket and its queue
row through the required resolved-ticket lifecycle.
