# A_tan-condition-selection__20261012 — Active

Scope: Expose independent PRJNA420395/Tan 2018 UTEX 2973 condition datasets.
Status: active
Opened: 2026-10-12
Updated: 2026-10-12

## Current State

Owner: cyano-ui-fixes. The owner requests individually selecting the control,
dark, high-light and high-temperature data currently exposed only as a pooled
TSS-initiation score. Work is isolated from other sessions at baseline 425a753.

The source worker is DEM-381, isolated at baseline 425a753. Source derivation is
awaiting the owner's choice between the published Table S1 gene-linked counts
(recommended; 1,789 current genes) and the reconstructed legacy calculation
(1,727 genes). Preserve the existing pooled values and the distinct Table S1
site-evidence layer; no imputation or unlabelled switch of membership.
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
- **TAN-SPLIT-3 — open:** owner choice requested asynchronously on 2026-10-12.
  Only the new layer derivation depends on this choice; source plumbing and
  selection/URL work continue. No response yet. Do not publish either alternative
  as an approved derivation.

## Verification

Focused JavaScript selection, URL, metric and organism-isolation checks pass (120 tests).
New tests cover separate conditions, native zero/missing values, independent
axes and explicit legacy selection. URL version 8 defaults to control; older
encoded views retain their legacy pooled selection. Full JavaScript checks await
the data layer: the fresh-axis help fixture currently has no control metric.

Pending: independent source/checksum/column and pooled-score reproduction;
owner-approved derivation; condition-aware selector, colouring, axes, filters and
exports; final unit/integration tests, rendered mobile/tablet/desktop checks and
release gates. No current-task change has reached main or the public site.

## Cleanup

Close only this owned ticket after validation and review, distill reusable source
and selection rules, delete the resolved ticket last. Preserve other worktrees,
tickets and the owner's preview on port 8871.
