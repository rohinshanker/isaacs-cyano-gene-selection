# R_xy-axis-dataset-peek__20261007 — Resolved

Scope: Add a center dataset-selection peek for each Metric X vs Y axis whose selected metric has multiple data sources, separate from the PCA map's dataset-selection window.
Status: resolved
Opened: 2026-10-07
Updated: 2026-10-09

## Current State

Implementation resumed by the owner on 2026-10-08; this supersedes the earlier record-only instruction in this ticket. `cyano-ui-fixes` owns coordination/integration/closure. Standing claim-specific and source-access constraints still apply.


Owner reconfirmation, 2026-10-08: **yes** to independent applied X/Y/PCA
selections. Record this decision only; do not implement it yet.
Implemented on `work/ui-axis-picker-20261009` for coordinator integration.
The later authorization to proceed superseded the earlier record-only hold.
X, Y, global colour/filter, and PCA selections now remain independent after
the older link state is copied once during migration.

For Metric X vs Y, selecting an axis metric with multiple data sources should
provide an option to open a center peek and select datasets. The owner explicitly
wants this to be a separate window from the PCA map's dataset-selection window.
The picker must identify the axis and metric whose datasets are being selected.

Source context: `syncAxisSourceSelects()` in `site/js/app.js` currently shows X/Y
source dropdowns for type metrics with at least two globally selected datasets.
Those dropdowns offer an individual informing source or pooled datasets.
`site/js/ui/data-sources.js` currently owns one reusable selection peek with
multi- and single-choice modes. Inspect the actual X vs Y and PCA interfaces
before implementing; this ticket adds the requested separate axis picker rather
than treating the existing dropdown as sufficient. This is source inspection,
not rendered validation.

Opening baseline: canonical Desktop checkout, `main` at
`b769ee1d34fa14d2fe13452173a914e0a82ef19a`. Related dataset/type-metric work has
changed since the earlier UI tickets' opening baseline; recheck its contracts.

## Acceptance

- Both X and Y offer a clearly associated dataset-selection action when the
  selected axis metric has multiple available data sources.
- The action opens a center peek listing datasets relevant to that metric and
  identifying the requesting axis. Do not make additional sources unreachable
  merely because only one is currently selected elsewhere.
- The Metric X vs Y picker is a separate window from the PCA dataset picker;
  opening it must not repurpose or overwrite the PCA window's draft.
- Users can select datasets and apply or cancel the choice, with the applied
  selection reflected truthfully in the axis controls and plot.
- Preserve the established pooled/individual-source interpretation and source
  attribution; do not invent a new pooling or aggregation rule for this UI change.
- Reuse shared dataset rows, condition information, and modal primitives where
  appropriate. Support keyboard/touch operation, background inertness, dismissal,
  and focus restoration to the initiating axis control.

## Affected Area and Clarification

Before implementation and again at resolution, compare X/Y metric and source
controls, dataset/type state, and the PCA picker against the opening baseline.
Record intervening changes, how they affect the separate-picker request, and any
owner clarification needed. State explicitly when none is needed.

Owner decision, 2026-10-08: committed X, Y and PCA dataset selections are independent. Each axis owns its selection and draft; applying it must not change the other axis or PCA. Reuse existing pooling/missing-value rules.

The owner specified a separate window. Clarify whether committed dataset
selections must also be independent of the PCA selection and the other axis if
the shared state would couple them; a different title alone does not establish a
separate window. Record this decision before implementing coupled behavior.

Related: `O_data-sources-selection__20261005.md` defines the broader selection
feature and established pooling rules. Coordinate this axis-specific request
with that work without resolving the broader ticket.

## Verification

Implemented and rendered from the assigned worktree on port 8837 in Playwright
session `axis-picker-20261009`. UTEX 2973 was checked at 375x812, 768x1024,
1280x800, and 1440x900, plus the 599/601 and 1319/1321 breakpoints. The maximum
54-dataset transcriptomics picker, an empty filter, the loading shell, a failed
expression-layer axis, and normal states were captured. Syn61 was checked for
single-source and non-pooling occupancy, log2 fold-change, p-value, TE, and
computed/no-layer axes.

Applied X and Y selections of the same transcript-abundance type produced
different values and independent `xds`/`yds` fields. Apply changed only its
requesting axis; Cancel, Escape, and backdrop dismissal changed none and
restored focus. Changing the main Data Sources/PCA selection left both axes
unchanged. A version-6 link with global source state migrated both axes to the
measurement that link previously displayed. The failed-layer render preserved
a requested Log10 scale and reported a retryable load failure without claiming
the metric was absent.

Post-implementation audit AXIS-R1 found that a mixed ready/failed pool still
reported finite pairs without qualifying that only its ready contributor was
being read. The repair keeps every requested id for retry, computes from ready
contributors only, labels the pair count as partial, names failed/loading ids
and available/requested counts, and records requested versus actual contributors
in exports. A delayed real Retry changed the failed note to loading, preserved
Log10 and the two-dataset request, then restored the established two-dataset
pooled provenance when the expression layer arrived.

Validation in this worktree:

- focused axis/source/modal/state tests: 129 passed;
- focused AXIS-R1 contributor/resource/copy/export regression set: 96 passed;
- `npm test`: 1,350 passed;
- `.venv/bin/python -m pytest -q`: 891 passed, 1 skipped, 36 subtests passed;
- `.venv/bin/python tools/validate_contract.py`: 117 passed, 0 failed,
  1 declared spliced-CDS skip.

Durable screenshots, semantic snapshots, and scripted check results are under
`worktrees/ui-open-tickets-20261008/.playwright-cli/ui-open-tickets-20261008/axis-picker`.
No clarification was needed after the owner confirmed independent committed
state; the existing quantity and comparability contracts determined the rest.

At implementation, render Metric X vs Y and the PCA picker at 375, 768, 1280,
and 1440 px widths and relevant breakpoints. Inspect both axes, multi-source
metrics, single-source/computed metrics, one currently selected dataset with
multiple available sources, apply/cancel, metric changes, and repeated opens of
the X/Y and PCA windows. Check state separation, plot/source attribution,
keyboard/touch access, focus, overflow, and runtime diagnostics. Run focused
axis/source/state/modal checks and all repository completion gates.

## Cleanup

When implemented and verified, report the affected-area change and clarification
assessment, rename/status-mark this ticket resolved, and record final validation.
Distill the reusable axis-picker and state-separation contracts into
`docs/validation/explicit-metric-axes.md` and
`docs/validation/data-selection-interactions.md`; update
`docs/validation/INDEX.md`. Then delete the resolved ticket and remove its queue
row. Leave broader Data Sources work open.

## Closure, 2026-10-09

Closing session: cyano-ui-fixes (80c81443-1791314087).
Findings: AXIS-R1 resolved bya3f73b0; AXIS-R2 byf8a5270; independent approval.
Final verification: npm1,395 passed; pytest925 passed,1skip/36subtests;
contract119 passed,1declaredskip. Combined actualUTEX/E.coli four-width matrix
passed withzerooverflow/unexpecteddiagnostics; applicable authored/independent
matrices and8-width gene checks are retained in ignored scoped evidence.
Reviewed finallocalhost http://127.0.0.1:8830/ was opened in Google Chrome for
the owner on2026-10-09 before resolution; server belongs to this worktree.
Reusable contracts are in ../../validation/explicit-metric-axes.md and its index.
Cleanup: resolve/rename, verify queue and links, then delete this ticket last.
