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

## Findings and owner

Closing owner: `cyano-general-ticket-closing`, 2026-10-07. Closure remains pending
until every open item below is resolved and the final patch passes review,
rendered checks and the three gates. The frozen audit remains in its handoff
file; reusable contracts live in `docs/validation/fitness-screen-data.md`.

| Finding | Current resolution |
| --- | --- |
| Fitness Browser exact identifiers | `0ee9753`: 45 approved suffix/plasmid joins restored; existing values unchanged |
| GSE205443-01 | open: remove unsupported continuous-light claim; DEM-303 source writer |
| GSE205443-02 | open: correct vessel wording; endpoint pooling is supported by PMC9260433 Figure 3A, partly refuting the audit's unsupported-pooling claim |
| GSE205443-03 | open: use the OD0.5 preparation quote rather than the OD0.4 starter quote; sampled phase/OD remain unknown |
| GSE205443-04 | open: label weighted, normalized gene fitness rather than a raw barcode ratio; DEM-303 source writer |
| GSE205443-05 | `10f25c1`: explicit pooled calculation uses the number of selected condition sets, not the first source's column count |
| GSE205443-06 | `10f25c1`: pooled provenance retains source caveats, including absent T-values |
| GSE205443-07 | open: typed fitness TSV headers and matching readers/validators; DEM-303 source writer |
| GSE205443-08 | `89b9ed4`: stale ticket counts removed; source count 1,920 retained only where needed |
| GSE205443-09 | open: `10f25c1` adds GSE205443 archive links and a shared RNA/RB-TnSeq paper label; shared citation URL still needs the paper target |
| DEM-298 owner-date provenance | `10f25c1`: default compendium pool cites the 2026-10-07 decision |
| DEM-298 manual staging/cache | open: `10f25c1` supplies staging guidance; DEM-303 implements missing/manual and checksum-safe cache behavior |
| DEM-298 traffic safeguard | `10f25c1`: declared fitness is explicitly excluded, including adversarial name/unit tests |
| Coupled current metadata | `1e89f93`: rows22/23/24 keep illumination schedule and sampled phase/OD unknown; all941 default verdicts and lab calls unchanged |

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
