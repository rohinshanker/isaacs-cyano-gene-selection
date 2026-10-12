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

Implementation `0c09511dcaa4f652e9564b9e6ca298d834a4bd95` is integrated locally
at `905f420`. All six published catalogues reconcile with their pinned source;
pre-existing OG payload fields and every `genes.json` are unchanged. Required
checks passed: 1,518 JavaScript tests; 1,370 Python tests, 47 subtests and two
expected skips; all-six contract/manifest/live checks; 15 annotation inputs,
four reproduced annotation artifacts, 75 readiness tests; and all 32 RNA-browser
parity cases plus lifecycle, coverage and diagnostic checks.

The independent native-source oracle agrees on every one of 5,430 gene sides.
Actual three-mount content checks cover noncoding, abutting, overlap-blocked,
joined and both origin-wrapping cases. Renders at 375, 768, 1280 and 1440 px and
six nearby breakpoint widths show no page overflow; final schematic and grey
noncoding states were visually inspected. Keyboard, preview/pin, filtering,
camera, loading, missing and failed states were exercised. Ordinary browser
console: no errors or warnings. Evidence is task-local under
`/tmp/cyano-cross-strain-context-20261012/`.

- **NC-R1 — open:** raw-annotation comparison must reject replicon, pseudogene flag,
  name and segment-source drift for every native catalogue entry.
- **NC-R2 — open:** retain every tied OG partner occupying the first outward base.
- **NC-R3 — open:** show the pseudogene label once when both biotype and flag name it.
- **NC-R4 — open:** expose the schematic's focal identity through a nameable accessible role.
- **NC-R5 — open:** direct unittest execution must collect ContextCatalogueTest.
- **NC-N1 — open:** null-safe activeElement access and accurate lazy-hover documentation.
- **NC-REVIEW — open:** DEM-374 independent Claude review of immutable snapshot
  `091733e` and the two-file empty-focus delta to final code `905f420`. Do not
  close or publish before its findings and confirmation are incorporated.

- **NC-QA1 — resolved by `0c09511`:** the initial loader eagerly resolved every focal neighbour
  query (~464 ms for 2,715 native CDSs in a coordinator Node probe). Resolve/cache
  only the viewed gene, preserving atomic clear/reload and export serialization.
- **NC-QA2 — resolved by `0c09511`:** a draft change to the shared transcription-piece helper was
  justified by randomly generated multi-piece origin joins whose transcript
  boundary is ambiguous. Keep current viewer coordinate behavior unless native
  annotation supplies a proven ordering; an oracle must not choose that boundary
  from an arbitrary array index.
- **NC-QA3 — resolved by `0c09511`:** at 375 px the direction schematic wraps the entire 3′
  downstream label to the left edge of a new row. Preserve the deliberate
  upstream–focal–downstream ordering at narrow widths and inspect the rerender.
- **NC-QA4 — resolved by `0c09511`:** the complete Syn57 catalogue exposes adjacent CDS pieces
  for b2891 that normalize to one occupied interval. Reconcile canonical occupied
  bases without changing the native CDS segments or frameshift metadata; verify
  all six published catalogues and the independent source contract.
- **NC-QA5 — resolved by `0c09511`:** a joined OG partner with one internal piece and a separate
  outward piece was skipped, allowing a farther gene to be called immediate and
  its distance unoccupied. Consider all outward occupied segments; if the nearest
  belongs to an OG partner, report that side overlap-blocked, retaining ties.
- **NC-QA6 — resolved by `0c09511`:** clearing the compact viewer while a new neighbour control
  holds focus must restore focus to the surviving labelled viewer, as the
  existing start-site control already does. Verify the empty-state transition.


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
