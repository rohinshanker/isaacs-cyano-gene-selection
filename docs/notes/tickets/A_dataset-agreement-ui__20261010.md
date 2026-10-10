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

- `tools/promote_expression_agreement.py` deterministically reproduced the published
  statistics-only sidecar: 55 admitted RNA-seq sources, 53 report-backed sources,
  explicit `GSE205444` and `TAN2018_TSS` gaps, 1,378 level pairs and 26 response
  pairs. Promotion and browser validation reject malformed/stale joins; the payload
  omits the report's per-gene `means` and `vector` fields while retaining exact arms,
  strata, sample-pair denominators, null reasons, caveats and provenance.
- Focused checks passed: 4 promotion tests and 118 agreement, loader, export,
  organism and Data Sources tests.
- Full repository gates passed: 15 pinned annotation inputs and four generated
  artifacts verified; 74 readiness tests passed; every configured organism passed
  contract validation, data-manifest validation and live-metric checks with
  `failed=0`; 1,498 JavaScript tests passed; 1,158 Python tests plus 46 subtests
  passed with one declared skip. Both working-tree diff checks passed. The final
  Python run used temporary read-only links to the canonical pinned raw corpus
  because this worktree carries checksum sentinels only; the links were removed.
- `tools/ui/check_expression_agreement.js` passed against the real worktree app at
  375, 699, 700, 768, 1280, 1319, 1320 and 1440 px with no page, dialog or agreement
  overflow and no unexpected console/page/request diagnostics. It exercised the
  report-backed level/response pair, exact response arms and both contrast caveats,
  unknown-replication band suppression, no-response and coverage-gap pairs, bounded
  55-source selectors, missing/loading/failed+retry states, Escape and focus return.
  Screenshots are in `/tmp/cyano-dataset-agreement-ui-20261010/`, including
  `agreement-{width}.png`, `agreement-{failed,absent,loading}.png`, and
  `agreement-1440-disclosures.png`.

## Cleanup

Record reviewer findings and their resolution commits, distill the browser contract and reproduction checks into docs/validation, then resolve and remove this ticket last. Preserve the open parent ticket and all concurrent ownership.
