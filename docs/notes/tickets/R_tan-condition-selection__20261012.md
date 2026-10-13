# R_tan-condition-selection__20261012 — Resolved

Scope: Independent PRJNA420395/Tan 2018 UTEX 2973 condition datasets.
Status: resolved
Opened: 2026-10-12
Updated: 2026-10-12

## Outcome

Closed by cyano-ui-fixes on 2026-10-12. Owner decision: use Table S1.
Control, dark, high light and high temperature are independently selectable;
fresh views use control. Fractional gTSS counts are preserved. Legacy pooled
values remain explicitly labelled and old versioned links retain their choice.
X/Y and colour/filter choices stay independent. No remaining implementation,
source or review finding; publication and live smoke follow integration.

Finding dispositions:

- TAN-SPLIT-1: `f0b1f29`; verified distinct S1/legacy memberships retained.
- TAN-SPLIT-2: `f0b1f29`, `4190fbd`; recovered legacy rule is reproducible,
  not author-defined or justified; historical-only retention and labels verified.
- TAN-SPLIT-3: owner selected Table S1, implemented in `f0b1f29`.
- TAN-SPLIT-4: `add1a66`; cache immutable axis membership, retain live readiness.
- TAN-REVIEW-1: `4190fbd`; Legacy appears wherever the old pool is selected.
- TAN-REVIEW-2: `4190fbd`; unsupported 77-mention assertion and cause removed.

DEM-384 independently reviewed the numerical sources, rendered behavior and
final correction commit `4190fbd`; no actionable findings remain. The separate
active overlap-length ticket and its owner/worktrees are preserved unchanged.

## Verification

All 10,860 values/missing entries match two independent workbook calculations.
Each new layer has 1,789 genes with values and 926 unknown; pooled TSV and genes
are unchanged. Full suites: 1,547 JavaScript tests; 1,757 Python tests plus
51 subtests, 10 existing skips. Source/checksum and legacy reconstruction,
annotation verification/reproduction, readiness, six-organism contracts,
manifests and live metrics, module preloads and diff integrity pass.

Rendered axes, dataset dialogs, chromosome colours, exports, old/new URL
restoration and organism isolation pass at 15 widths from 375 to 1440 px.
Loading, deliberate file failure and live Retry preserve selection and Log10;
no silent legacy substitution. No unexpected page/console/network errors.
Keyboard/Escape focus restoration passes; axe is unavailable in this repository.
RNA browser gate: 32 parity cases exact, 11 lifecycle states, no uncovered UI
lines, no diagnostics; maximum responsiveness timer gap 11.1 ms.

## Cleanup

Reusable source/checksum/derivation guidance is in
`data/expression/TAN2018_TSS_PROVENANCE.md`; selection, migration, cache and export
contracts are in `docs/validation/explicit-metric-axes.md`,
`measured-quantity-contract.md`, `candidate-comparison-and-export.md` and their
validation index. Temporary review/render evidence remains outside Git at
`/tmp/cyano-tan-conditions-20261012/`. No visual baselines changed.
Remove this resolved ticket last. Preserve owner's port 8871 and other sessions.
