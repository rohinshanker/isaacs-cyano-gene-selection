# A_dataset-agreement-ui__20261010 — Active

Scope: Present the existing processed-expression agreement report in Data Sources, as the bounded S6 UI slice of O_data-sources-selection__20261005.
Status: active
Opened: 2026-10-10
Updated: 2026-10-10

## Current State

Owned by **cyano-ui-fixes** (80c81443-1791314087), which owns integration and closure. Implementation uses an isolated worktree from main; no other session owns this UI slice. Existing Syn57, pair-review intake and raw-read work remain with their current owners.

Use the accepted current statistics-only report and expression-agreement.md contract. Show descriptive level correlations with shared-gene counts, within-condition empirical replicate ranges (not confidence intervals), and response agreement only for recorded contrasts with their own reference arms. Preserve null reasons, missing coverage, units, caveats, source identifiers and provenance. No pass mark, inferred biological agreement, source admission, changed normalization or newly calculated statistic.

Acceptance:
- Deterministic, validated, integrity-pinned browser payload derived from the current report, joined only by declared source IDs; no per-gene vectors shipped.
- Accessible, responsive presentation beside Data Sources conditions, with truthful loading, unavailable, failure/retry and no-response states. Preserve selection/grouping and organism isolation.
- Applicable downloads/exports preserve report provenance and only claim loaded agreement evidence.
- Focused data/loader/UI tests, required repository gates, and rendered mobile/tablet/desktop/wide checks; independent review of exact patch and screenshots before integration.

This closes only the existing report presentation slice. Further data admission, raw-read results, new statistical methods and the broad parent ticket remain open.

## Verification

Pending implementation and rendered checks. No completion claim yet.

## Cleanup

Record reviewer findings and their resolution commits, distill the browser contract and reproduction checks into docs/validation, then resolve and remove this ticket last. Preserve the open parent ticket and all concurrent ownership.
