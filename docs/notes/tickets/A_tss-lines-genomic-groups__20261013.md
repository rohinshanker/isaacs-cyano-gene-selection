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

Pending focused tests, real rendered UI at mobile/tablet/desktop and breakpoint
widths, independent review, full repository gates and production verification.
No findings yet; discovered findings will be recorded before closure.

## Cleanup

Owning session resolves after all findings and validation are accounted for.
Distill reusable marker/base and grouping contracts into existing validation
guidance, update its index if needed, remove the ticket last, and push main.
