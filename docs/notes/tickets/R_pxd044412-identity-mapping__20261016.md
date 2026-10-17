# R_pxd044412-identity-mapping__20261016 — Resolved

Scope: Validate PXD044412 S3 protein identities against the pinned PCC 7942 UniProt table and exact shared-protein UTEX crosswalk; emit an auditable mapping companion without admitting browser measurements.
Status: resolved
Opened: 2026-10-16
Updated: 2026-10-16

## Outcome

Owned by `cyano-lit-unreach` (80c81443-1791314087), isolated worktree `pxd044412-mapping-20261016`, baseline `2180f20d`. Parent: [data sources](O_data-sources-selection__20261005.md).

Another session owns PXD044412 condition records. This scope changes only a new mapping tool/test, its audit artifact and validation contract, and coordinator-owned ticket bookkeeping. No edits to the peptide reader, condition metadata, shared UI, canonical checkout, or active calculators/function work.

Acceptance: checksum-pinned inputs; exact accession/locus/RefSeq agreement and mutual uniqueness; source-locus disagreements and multiple/unknown identities explicitly excluded; each observed Entry/Label retained with original evidence state; no ambiguous peptide promoted, no imputed absent pairs, no coordinate or confirmed-binding claims. Retain excluded identities and candidate routes. Independent check of full-source counts and review required.

## Verification

Closed by `cyano-lit-unreach` (80c81443-1791314087), 2026-10-16, after DEM-453 approved exact repair commit `e29642449d3d43c5bf38e8ca73552ffa0f16fb7a`.

Final code gates at that commit: npm test 1,684 passed; Python suite 2,684 passed, 23 skipped, 51 subtests; contract 130 passed, one declared spliced-CDS exemption. Focused mapping/reader tests: 244 passed. Whole-source regenerated mapping is byte-identical to the independently reviewed output. The committed independent audit reproducer regenerates the audit byte for byte and refuses wrong pins/existing outputs. Scoped metadata/index/link and whitespace checks pass. The generic home documentation checker uses a different format and is not the Cyano gate; unrelated home-ticket findings were left untouched.

All findings against this scoped work:
- DEM453-L1: resolved in `e29642449d3d43c5bf38e8ca73552ffa0f16fb7a` (strict literal equality and regression cases).
- DEM453-L2: resolved in `e29642449d3d43c5bf38e8ca73552ffa0f16fb7a` (committed independent audit reproducer and validity checks).
- DEM453-L3: resolved in `e29642449d3d43c5bf38e8ca73552ffa0f16fb7a` (audit README).
- DEM453-N1: resolved in `e29642449d3d43c5bf38e8ca73552ffa0f16fb7a` (accurate tool description).
- PXD044-TRANSFER: **open**, preserved in the parent data-sources ticket; eventual browser presentation must retain PCC-search-space ambiguity limits. The runbook also retains the source-locus collision check required before re-pinning.

The independent reviewer confirmed zero discrepancies across all 2,148 identities, 42 per-label audits, 67,276 evidence summaries and 391,900 row references. Assigned: 1,849 proteins / 58,914 comparisons; excluded: 299 / 8,362. All assigned source protein lengths agree with the pinned UTEX identity artifact. The excluded-identity recovery and browser/condition work remain in the parent; none is lost by closing this bounded mapping implementation.

## Cleanup

Reusable mapping policy, reproduction, counts, pins and transfer limits are retained in `docs/validation/pxd044412-mapping.md`, its validation-index row, and `data/audits/pxd044412/`. The parent retains admission and excluded-identity work. Remove this resolved ticket only after recording this closure; remove only this session’s clean worktree after publication.
