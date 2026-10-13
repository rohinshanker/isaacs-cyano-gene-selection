# A_tan-condition-selection__20261012 — Active

Scope: Expose independent PRJNA420395/Tan 2018 UTEX 2973 condition datasets.
Status: active
Opened: 2026-10-12
Updated: 2026-10-12

## Current State

Owner: cyano-ui-fixes. The owner requests individually selecting the control,
dark, high-light and high-temperature data currently exposed only as a pooled
TSS-initiation score. Work is isolated from other sessions at baseline 425a753.

The source worker is DEM-381. Owner decision, 2026-10-12: "use the s1 table".
The four new layers use Table S1 exact gene-associated gTSS counts (1,789 current
genes), preserving fractional counts. Keep the existing pooled values
(1,727 genes) available as explicitly labelled legacy data and preserve the
distinct Table S1 site-evidence layer. No imputation or silent membership change.
Keep source conditions, two replicates per condition, the high-light duration
conflict and the initiation-versus-abundance boundary visible. Retain the old
pooled source for explicit legacy selection; fresh views should use control and
allow independent condition selection without automatically recombining them.

## Open findings and decision

- **TAN-SPLIT-1 — open:** the legacy score and Table S1 use different feature
  memberships: 1,317 loci overlap, 472 have Table S1 gTSSs only, and 410 have a
  legacy score only. The existing provenance document records the mismatch.
- **TAN-SPLIT-2 — open:** the source worker reports an exact reconstruction of
  all legacy values using paper-era protein-coding locus mentions, a genomic
  coordinate filter, and integer truncation of each raw count before averaging.
  It includes non-gTSS feature classes. This is a matching reconstruction, not
  evidence that these operations were scientifically justified. Independently
  review the derivation, attribution and labels before publishing either split.
  DEM-381's origin audit also found an equivalent single-pass file-order rule:
  sites are retained only once their named gene has already appeared. This
  drops 1,524 site–locus pairs (including 1,286 forward-strand gTSS pairs), leaves
  486 named loci without any score, and lowers 12 values through truncation.
  The surviving DEM-33 documentation does not specify these operations. Treat
  this as a likely parser defect, not an author-defined biological association;
  the Table S1 derivation remains the recommendation for new condition layers.
- **TAN-SPLIT-3 — resolved by owner decision, 2026-10-12:** use Table S1 for
  the four new condition datasets; preserve legacy pooled data separately.
  DEM-381 resumed with this explicit derivation and the existing quantity contract.

- **TAN-SPLIT-4 — resolved `add1a66`:** browser profiling found whole-catalogue
  membership scans per axis gene read. Cache immutable membership per axis;
  metric objects and file readiness remain live. Regression tests cover all
  2,715 reads, invalidation, independent axes and loading/failure/recovery.
- **TAN-REVIEW-1 — open:** independent reviewer DEM-384 requests Legacy in
  both the old source label and condition-set summary, not only its caveat.
- **TAN-REVIEW-2 — open:** independent reviewer requests removing the
  unsupported 77-mention assertion and causal annotation-revision claim.

## Verification

Integrated data `f0b1f29` (worker `7d61e8c`) and frontend/test patch through
`3d59a69`. Original Table S1 independently re-fetched and checked against SHA-256
`098ecbd204cd1042a6edee1d2a500eaeca4efe034c503e2ade3db1c605e79b00`.
A separate openpyxl/Decimal calculation exactly matches all 10,860 values and
missing entries across 2,715 genes and four conditions. Each layer has 1,789
values and 926 unknowns. Legacy pooled TSV and `genes.json` are unchanged.

Coordinator gates pass: 1,546 JavaScript tests; 1,757 Python tests, 10 existing
skips and 51 subtests; source and pooled-audit checks; annotation verification and
reproduction; readiness tests; contract, data-manifest and live-metric checks for
all six organisms; module-preload and diff integrity. Artifacts are outside Git
under `/tmp/cyano-tan-conditions-20261012/`.

Independent review DEM-384 covers `b6a6604..3d59a69`, including TAN-SPLIT-1/2
scientific attribution and legacy derivation. Browser checks are in progress on
port 8896 and session `tan-condition-20261012`. Pending: rendered completion,
review disposition, final closure, push, gated deployment and production smoke.

DEM-381 source work is fully integrated through the clean `dem-381-s1` branch.
Do not merge its original task branch wholesale: platform snapshots contain
unrelated work. The earlier held legacy-split branch is not an approved data
source or condition implementation.

## Cleanup

Close only this owned ticket after validation and review, distill reusable source
and selection rules, delete the resolved ticket last. Preserve other worktrees,
tickets and the owner's preview on port 8871.
