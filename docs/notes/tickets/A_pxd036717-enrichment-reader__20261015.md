# A_pxd036717-enrichment-reader__20261015 — Active

Scope: PXD036717 source-preserving workbook reader and raw-LFQ reconstruction;
bounded prerequisite of `O_data-sources-selection__20261005`, not browser admission.
Status: active
Opened: 2026-10-15
Updated: 2026-10-15
Owner: cyano-lit-unreach (80c81443-1791314087)

## Current State

Isolated branch `work/pxd036717-reader-20261015`, baseline
`cccd4a89b91812df467e360916b0091ef1f8eae5`, in the sibling worktree
`worktrees/pxd036717-reader-20261015`. No other session's worktree or UI scope
is owned here. The canonical checkout is `isaacs-cyano-gene-selection`.

Read the owner-supplied Santos-Merino 2024 supplement (`mmc1.xlsx`) directly,
preserve its original values and cell provenance, and report arithmetic and
missing-intensity diagnostics separately. Pin the source bytes. Do not guess
locus joins, replace source values, invent p-values, or equate enrichment with
protein abundance. Baits remain separate.

Owner decisions, 2026-10-15:

- Browser release must wait for reconstruction from raw LFQ intensities;
  published log2 ratios alone are not sufficient.
- Expose all 12 replicate comparisons plus optional averages within each of the
  four baits. Never pool different baits.

The unblocked reader/reconstruction work can be validated without browser
admission. Source zero intensities and author-imputed log2 values must stay
distinguishable from measured zero enrichment. Browser mapping, source-specific
admission and rendered checks remain in the parent ticket.

## Verification

Initial implementation `57c8771`: 32 focused tests; full gates pass (1,653
JavaScript tests, 2,334 Python tests plus 51 subtests / 23 skips; contract
130 passes / one skip). DEM-422 independently verified source counts and
arithmetic. DEM-424 approved the non-release math/preservation but raised:

- F1: explicit detection states and counts required for one-arm detections;
  implementation added, recheck pending. The related browser choice remains
  open as PXD-DETECTION in the parent; no imputation is authorized.
- F2: replace unsupported prior-intake reference with direct article quote,
  page/date/hash; added and mechanically verified, recheck pending.
- F3: missing-log/present-ratio branch test; added, recheck pending.
- F4: hardlinked output could overwrite source; same-file check and regression
  added, recheck pending.

Current focused suite: 44 passing including the pinned workbook. Rerun full
gates and obtain independent review of the repair before closure.

## Cleanup

Owner closes only this bounded ticket after validation, moves the reusable
reader/reconstruction contract to `docs/validation/`, and preserves every
remaining admission finding in the parent ticket. Do not close the parent.
