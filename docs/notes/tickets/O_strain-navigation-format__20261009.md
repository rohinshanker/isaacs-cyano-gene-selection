# O_strain-navigation-format__20261009 — Open

- **Scope:** Group and order the organism selector; preserve collapsible, movable recoding panels.
- **Status:** open
- **Opened:** 2026-10-09
- **Updated:** 2026-10-09

## Current State

Opened by `cyano-ui-fixes` at the owner's request. Implementation is unassigned
and has not started. At baseline `67c8e74`, the selector renders five peer links;
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

Ticket-only intake; no UI behavior has changed. Intake validation, 2026-10-09:
ticket metadata and queue links passed; `npm test` passed 1,395 tests; `pytest -q`
passed 925 tests and 36 subtests with one skip; the contract validator passed 119
checks with one declared skip. These gates validate the current baseline, not
the unimplemented navigation.

Before implementation closure, render the real application at mobile, tablet,
and desktop widths. Exercise all three conventional strains, Syn61, dropdown
pointer/keyboard behavior, copied/direct links, browser reload, and recoding
panel movement/collapse persistence. Run the gates in `AGENTS.md`.

## Cleanup

The implementing session owns closure. Record every remaining finding before
resolution, distill reusable navigation and panel-state rules into
[organism-selector.md](../../validation/organism-selector.md) and the applicable
panel runbook, update the validation index, then remove this ticket and its queue
row through the required resolved-ticket lifecycle.
