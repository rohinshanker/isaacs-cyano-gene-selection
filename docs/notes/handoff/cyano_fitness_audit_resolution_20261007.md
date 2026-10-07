# Fitness audit resolution — 2026-10-07

Closing owner: `cyano-general-ticket-closing`. Original evidence is the frozen
[DEM-299 report](cyano_gse205443_audit_20261007.md); numbers were exact.
Primary Figure 3A documents endpoint pooling, so that allegation was partly
refuted while incorrect vessel wording was corrected.

## Findings and owner

Closing owner: `cyano-general-ticket-closing`, 2026-10-07. All items below were resolved and independently checked before closure. The frozen audit remains in its handoff
file; reusable contracts live in `docs/validation/fitness-screen-data.md`.

| Finding | Current resolution |
| --- | --- |
| Fitness Browser exact identifiers | `0ee9753`: 45 approved suffix/plasmid joins restored; existing values unchanged |
| GSE205443-01 | `b85f894`: schedule unknown in all nine records; reported light retained |
| GSE205443-02 | `b85f894`: tube/flask wording corrected; unsupported-pooling claim partly refuted by PMC9260433 Figure 3A; supported endpoint pooling retained |
| GSE205443-03 | `b85f894`: correct OD0.5 preparation quote and explicit harvested-phase limit; `1e89f93` keeps sampled phase/OD unknown in replay |
| GSE205443-04 | `b85f894`: weighted, normalized log2 gene-fitness semantics for both sources |
| GSE205443-05 | `10f25c1`: explicit pooled calculation uses the number of selected condition sets, not the first source's column count |
| GSE205443-06 | `10f25c1`: pooled provenance retains source caveats, including absent T-values |
| GSE205443-07 | `b85f894`: all 99 fitness headers typed and enforced by shared writer/reader contract |
| GSE205443-08 | `89b9ed4`: stale ticket counts removed; source count 1,920 retained only where needed |
| GSE205443-09 | `10f25c1` adds GSE205443 record links and shared study label; `b85f894` points shared citation at the paper DOI |
| DEM-298 owner-date provenance | `10f25c1`: default compendium pool cites the 2026-10-07 decision |
| DEM-298 manual staging/cache | `10f25c1` documents staging; `b85f894` enforces manual inputs and verifies SHA before any cache write |
| DEM-298 traffic safeguard | `10f25c1`: declared fitness is explicitly excluded, including adversarial name/unit tests |
| DEM305-01 | `853152d`: generic OD caveat restored; 11 unrelated rows retain their own facts; final independent delta check accepted |
| Coupled current metadata | `1e89f93`: rows22/23/24 keep illumination schedule and sampled phase/OD unknown; all941 default verdicts and lab calls unchanged |


Final independent review accepted source/provenance fixes at `540869a` and
verified DEM305-01 resolved at `853152d`. No audit finding remains open.
The 99 numeric fitness bodies and all159 sidecar arrays remain unchanged.
Reuse the [fitness contract](../../validation/fitness-screen-data.md) for
methods, schema, uncertainty, pooling and reproduction.
