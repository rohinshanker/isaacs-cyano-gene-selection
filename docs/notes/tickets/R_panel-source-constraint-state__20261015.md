# R_panel-source-constraint-state__20261015 — Resolved

Scope: Bind panel-design constraints, result state and exported provenance to the data sources used to evaluate them.
Status: resolved
Opened: 2026-10-15
Updated: 2026-10-15

## Outcome

Closed by cyano-lit-unreach (80c81443-1791314087), 2026-10-15. No open findings remain against this work.

Panels retain captured values and source identities until explicit regeneration.
Material source/value/missingness changes show a stale warning. Version 2 CSV and
manifest exports record source selection, contributors, pooled/individual reading,
value digests and captured neighboring TSS counts. Version 1 imports explicitly
report legacy/unknown source state. Unavailable constraints retain their settings
and explain the missing source without claiming another-organism evidence.

Findings and disposition:

- DEM-425 source-state/export provenance: resolved by `17d250e8`.
- DEM-425 omitted neighboring TSS export counts: resolved by `17d250e8`.
- PS-1 wrong borrowed-organism label and retained-constraint deletion after
  deselection: resolved by `076d39ec`.
- PS-1-T1 stale-checkbox regression-test gap: resolved by `da52c1f`.
- Independent review DEM-431 approved `da52c1f`; no actionable findings remain.

The source contract and reusable reproduction checks are in
`docs/validation/guided-panel-design.md` and its validation index row. The panel
objective, feature weighting and intentional TSS fixed-constraint exclusion are
preserved. Other sessions' unpublished functional-status work remains untouched.

## Verification

- Full JavaScript suite: 1,684 passed on final runtime code; the subsequent
  test-only correction passed all 16 source-state tests and independent focused
  confirmation.
- Full Python suite: 2,376 passed, 23 skipped, 51 subtests passed.
- Data contract: 130 passed, one declared spliced-CDS skip.
- Native-map panel form, stale/current result, regenerated blocked constraint,
  keyboard disclosure/export and retained-versus-regenerated exports rendered
  at 375×812, 768×1024, 1280×800 and 1440×900. No document overflow; existing
  tables scroll locally. Coordinator independently reproduced the stale result
  and inspected final screenshots. Runtime error and failed-request collections
  were empty.
- Reviewer independently matched the captured Tan digest against all 2,715
  shipped values and checked all eight exported readings, source IDs, true-zero
  counts and unavailable blanks. Golden objective and borrowed-source grouping
  tests pass.
- Clean integration of published iDOG documentation through `40e36fa4`; no code
  conflicts. Whitespace and ticket/validation index-link checks pass.

Limitations: automated axe/screen-reader audit was not run (axe unavailable).
Delayed source arrival is covered by unit tests, not a throttled browser run.
No CSS breakpoints changed. These do not leave an unresolved finding.

## Cleanup

Removed the live queue row after recording closure. Reusable guidance is already
in validation docs. Delete this resolved ticket in the final cleanup commit;
retain commits and independent review evidence rather than a permanent task log.
