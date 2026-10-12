# A_cross-strain-neighbour-context__20261012 — Active

Scope: Native flanking-neighbour context and current-state reconciliation for O_cross-strain-data-scan__20260927; no new external source admission or predictor execution.
Status: active
Opened: 2026-10-12
Updated: 2026-10-12

## Current State

Owner and integration/closure coordinator: **cyano-ui-fixes** (80c81443-1791314087).
Isolated branch `work/cross-strain-context-20261012`, worktree
`/Users/Rohin/Desktop/coding_stuff/ISAACS-LAB/worktrees/cross-strain-context-20261012`,
from `48f712d315c7d6174db5504854ddf5eb77e6dbb7`.

The owner requested work on the cross-strain scan ticket without interrupting
other sessions. Regulatory method pilots belong to cyano-regulatory-sites;
source intake and raw-read work remain with their existing sessions. This scope
uses pinned native annotations and leaves those operations, inputs and worktrees
alone. DEM-364 completed read-only reconnaissance. DEM-370 is the sole implementation
writer in the separate `cross-strain-neighbours-impl-20261012` worktree from
`c33a874`; this coordinator worktree owns ticket updates and integration.

The parent already shipped its exact crosswalk, chromosome viewer, dataset
selectors and the current agreement-report display. The remaining unblocked
viewer work is flanking neighbours; existing OG displays cover shared bases but
not separated neighbouring genes. Existing adjacent-CDS gap metrics keep their
meaning. No sister-strain genomic position will be placed on the UTEX axis.

Owner decision, 2026-10-12: **all annotated neighbours in both viewers**.
Noncoding genes must have a visual distinction, such as grey. Use neutral grey
for their annotation marks/cards plus explicit biotype text, so colour is not the
only distinction. Keep protein-coding, pseudogene and unrecorded-type labels
accurate; noncoding context does not become a selectable recoding candidate.

No sequence will be inferred or padded and no missing annotation becomes
absence. The implementation keeps a complete coordinate inventory beside the
existing overlap layer, without repeating OG features or changing the existing
CDS-envelope metrics.

## Verification

Before completion: exact geometry tests for both strands, origin wrapping,
joined features, ties/containment, overlaps versus gaps, unavailable annotations
and organism isolation; tests for pin/preview and keyboard behavior; render the
actual affected views at mobile, tablet, desktop and wide widths; required
repository/release gates and independent review of the exact patch.

## Cleanup

Keep the broad parent open for its remaining source/admission/lab dependencies.
Record every review finding and resolving commit before closing this child;
distill reusable coordinate/display checks to docs/validation and delete the
resolved ticket last. Remove only this scope's temporary worktrees and servers.
