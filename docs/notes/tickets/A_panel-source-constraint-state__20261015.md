# A_panel-source-constraint-state__20261015 — Active

Scope: Bind panel-design constraints and exported provenance to the data-source selection used to evaluate them.
Status: active
Opened: 2026-10-15
Updated: 2026-10-15

## Current State

Owner: cyano-lit-unreach (80c81443-1791314087). Isolated coordinator worktree
`../worktrees/panel-source-state-20261015`, branch
`work/panel-source-state-20261015`, baseline `c74b0ffd`. Preserve the active
unknown-function session's work; its only current panel-designer edit is a
function-status import, which must survive integration.

DEM-425 identified a pre-existing panel-state issue while reviewing
TSS integration: type metrics read the current Data Sources selection, but
`panelInputKey(config, schemes)` records only panel configuration and schemes.
A source change can therefore change a constraint's values or missingness
without marking an existing panel stale. The panel export also does not record
the selected source IDs. No numerical source data is disputed.

The same review confirmed that panel exports omit the existing
`neighborSiteCounts` input to `buildExport`, so `neighborTssSitesInCds` stays
blank even when evidence is available. This predates the TSS edit-count work;
include the neighboring-site count when binding export evidence.

The TSS slice avoids adding another affected constraint by excluding both TSS
counts from fixed panel constraints; ordinary interactive filters remain
available. That exclusion does not repair the existing data-type metric path.

## Acceptance Criteria

- Define and snapshot the source selection that determines each permitted
  panel constraint and feature; preserve deterministic panel reconstruction.
- A material source-selection change marks the old panel stale, including a
  change to or from missing values. Unrelated visual toggles do not.
- Export the neighboring-site count when its captured evidence is evaluated,
  preserving blank counts for genuinely unavailable evidence.
- CSV/manifest provenance identifies the sources used to design the panel and
  cannot silently describe a different current selection.
- Test numeric changes, missingness, require-value/include-missing rules,
  pooled versus individual sources, saved schemes and export reconstruction.

## Verification

Baseline `9393dd5` reproduced in the real UI at localhost:8741: add a native
initiation range (minimum 1, require value), design eight genes, then deselect
Tan control. The same result remained with no stale warning; explicit
regeneration selected different genes. Implementation is assigned to the sole
writer in `../worktrees/panel-source-state-impl-20261015`; coordinator owns
integration, full gates and closure. Existing result/evidence must remain
captured until explicit regeneration.


DEM-425 read-only review of `f894e1a`, 2026-10-15: `type-metrics.js` supplies
selection-dependent readers; `panel-designer.js` hashes only config/schemes;
`panel-export.js` supplies no data-source selection to `buildExport`.
The same mechanism was reproduced with the now-excluded TSS denominator:
1,576 eligible CDSs with Tan selected versus zero when deselected under
“evaluated ≥ 1, require a value,” with no changed panel input key.
Before implementation, reproduce the retained data-type path in the real UI.
Run project gates and rendered mobile/tablet/desktop state/export checks.

## Cleanup

The owning implementer closes this ticket only after source-state and export
findings are resolved. Distill the reusable input/provenance contract into
`docs/validation/`, update its index, record closure owner/date and validation,
rename to resolved, remove this queue row, then delete the resolved ticket last.
