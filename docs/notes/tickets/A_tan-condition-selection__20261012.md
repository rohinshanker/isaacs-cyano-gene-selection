# A_tan-condition-selection__20261012 — Active

Scope: Expose independent PRJNA420395/Tan 2018 UTEX 2973 condition datasets.
Status: active
Opened: 2026-10-12
Updated: 2026-10-12

## Current State

Owner: cyano-ui-fixes. The owner requests individually selecting the control,
dark, high-light and high-temperature data currently exposed only as a pooled
TSS-initiation score. Work is isolated from other sessions at baseline 425a753.

Recover and verify the original Figshare eight-column feature table before
splitting the score. Preserve its exact locus/feature membership and the distinct
Table S1 site-evidence layer; no imputation or unlabelled switch of membership.
Keep source conditions, two replicates per condition, the high-light duration
conflict and the initiation-versus-abundance boundary visible. Retain the old
pooled source for explicit legacy selection; fresh views should use control and
allow independent condition selection without automatically recombining them.

## Verification

Pending: source/checksum/column and pooled-score reproduction; condition-aware
selector, colouring, axes, filters and exports; unit/integration tests, rendered
mobile/tablet/desktop checks and release gates. No findings yet.

## Cleanup

Close only this owned ticket after validation and review, distill reusable source
and selection rules, delete the resolved ticket last. Preserve other worktrees,
tickets and the owner's preview on port 8871.
