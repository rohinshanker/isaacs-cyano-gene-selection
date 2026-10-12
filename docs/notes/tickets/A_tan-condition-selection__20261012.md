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

## Verification

Focused JavaScript selection, URL, metric and organism-isolation checks pass (120 tests).
New tests cover separate conditions, native zero/missing values, independent
axes and explicit legacy selection. URL version 8 defaults to control; older
encoded views retain their legacy pooled selection. Full JavaScript checks await
the data layer: the fresh-axis help fixture currently has no control metric.

Pending: independent source/checksum/column and pooled-score reproduction;
owner-approved derivation; condition-aware selector, colouring, axes, filters and
exports; final unit/integration tests, rendered mobile/tablet/desktop checks and
release gates. Only the active ticket has reached main; implementation and
data changes remain unpublished.

DEM-381 returned audit/quantity-plumbing commits `51c167c` and `f04d3cd` on
`agent/claude-implementer/dem-381`. The latter has 38 focused audit tests passing;
the former passed the worker's full suites. Both await coordinator review and
integration into this isolated branch. Do not merge that branch wholesale:
platform-generated `6057ad5` includes unrelated PCC UI changes already on main.
`dem-381-legacy-split-held` at `1101d1f` is reference only and predates the current
quantity contract; it is not an approved condition-layer implementation.

## Cleanup

Close only this owned ticket after validation and review, distill reusable source
and selection rules, delete the resolved ticket last. Preserve other worktrees,
tickets and the owner's preview on port 8871.
