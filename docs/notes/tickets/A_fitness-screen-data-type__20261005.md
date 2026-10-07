# A_fitness-screen-data-type__20261005 — Active

- **Scope:** Complete the admitted fitness type, its 99 layers, selection and exact value transfer, including accepted label/provenance corrections.
- **Status:** active
- **Opened:** 2026-10-05
- **Updated:** 2026-10-07

## Current state

All 129 Fitness Browser experiments form 90 condition sets, alongside nine
published GSE205443 fraction scores. The digits-only importer restriction is
fixed; every compendium set has 1,819 exact-mapped target values and 80 unknown
source identifiers. Published values and conservative one-to-one joins must
remain unchanged. Independent DEM-298 rederivation accepted all 99 tables.

The subsequent [GSE205443 audit](../handoff/cyano_gse205443_audit_20261007.md)
(DEM-299) supplies nine label/provenance findings. Numeric values are exact.
Complete 01–07 and 09: unknown illumination schedule, unsupported endpoint
pooling, correct stage-specific OD evidence, weighted/normalized fitness
semantics, truthful pooled calculation and caveats, fitness TSV header, and the
fitness source link. Finding 08's stale counts were removed at initial cleanup;
retain the verified 1,920 source loci only where needed for the contract.

Also finish DEM-298's small safeguards: correct owner pooling-date provenance,
manual Fitness Browser staging instructions without corrupting cached input,
and explicit exclusion from traffic metrics. The owner's 90-way default and
independent subset/link settings are settled; no further owner call is needed.

Coordinator: cyano-general-ticket-closing. Other sessions retain PRIDE, E. coli,
PXD027430 recovery and raw processing. No email, source admission, new join,
normalization, shared setting or source-coordinate transfer is authorized here.

## Verification

Source pins, all values and all 129 input columns reproduce. Initial fitness
release `4556c3d` passed 1,268 JavaScript tests, 691 Python tests (one skip),
116 contract checks and production rendered checks. The additional corrections
need meaningful tests, current rendered inspection and the full gates on the
final integrated commit. Evidence stays outside the repository.

## Cleanup

Reconcile reusable rules in `docs/validation/fitness-screen-data.md`, source
ledger and ingested-source runbook. On final validation resolve, delete this
transient ticket and remove its queue row. Preserve the frozen audit report.
