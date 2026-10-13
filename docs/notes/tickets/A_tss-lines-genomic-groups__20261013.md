# A_tss-lines-genomic-groups__20261013 — Active

Scope: Replace neighbouring TSS diamonds with purple lines, identify exact recorded nucleotide positions, and regroup Colour by genomic options.
Status: active
Opened: 2026-10-13
Updated: 2026-10-13

## Current State

Owned by `cyano-regulatory-sites`, coordinator branch `work/tss-lines-20261013`
from main `8ce4774`. Marker implementation runs in a separate assigned worktree.
Other sessions and their worktrees remain untouched.

- Replace purple neighbouring-TSS diamonds in chromosome, both compact gene
  viewers and expanded sequence with purple lines. Preserve inspection,
  keyboard navigation, visibility controls, contrast and density behavior.
- Mark exactly the source nucleotide in the expanded sequence without obscuring
  its letter. Tan evidence supplies one-base TSS coordinates, not a wider RBS,
  promoter or binding footprint. RBS coordinates remain unavailable.
- Move 5′, 3′ and summed overlap-length colour options into the first Genomic
  context group. Rename the lower distance/operon group Genomic neighborhood.
  Preserve metric keys, values, filters, exports and saved links.

## Verification

Integrated implementation: `edf2eee` (marker worker DEM-391 commit `3179b9e`;
colour grouping `d0832ea`). Both selectors pass exact grouping/uniqueness and
saved colour state across all six organisms. Rendered marker/base checks cover
375/768/959/961/1239/1241/1280/1440 px, both strands, mapped-owner sites,
coincident positions, Original/Recoded rows, visibility/source states, keyboard
inspection/focus, and contrast. No unexpected browser errors.

Integrated repository gates pass: 1,584 JavaScript tests; 1,751 Python tests
(16 skips and 51 subtests); data contract 130 passed, zero failures, one declared
split-CDS exemption. `git diff --check` passes. Artifacts are in
`/tmp/cyano-tss-lines-20261013/`; independent review DEM-392 found TL-R1 and TL-R2 below. Production
verification remains pending.

**TL-1 — resolved in `edf2eee`:** Clamp sequence scale before the anchored-window
calculation. Unit and browser checks confirm that repeated button/wheel zoom
at the limit preserves an inspected site's position. The reusable contract is
in `docs/validation/gene-sequence-closeup.md`.

**TL-R1 — open:** DEM-392 found the active chromosome line too subtle on purple
CDS (only a 1 px teal edge against purple). DEM-391 owns a focused contrast and
active-state repair, with rendered inactive/active comparison.

**TL-R2 — open:** The zoom-limit no-op needs feedback through the existing
announcement channel for keyboard/button users. DEM-391 owns this small repair.

## Cleanup

Owning session resolves after all findings and validation are accounted for.
Distill reusable marker/base and grouping contracts into existing validation
guidance, update its index if needed, remove the ticket last, and push main.
