# A_pxd044412-identity-mapping__20261016 — Active

Scope: Validate PXD044412 S3 protein identities against the pinned PCC 7942 UniProt table and exact shared-protein UTEX crosswalk; emit an auditable mapping companion without admitting browser measurements.
Status: active
Opened: 2026-10-16
Updated: 2026-10-16

## Current State

Owned by `cyano-lit-unreach` (80c81443-1791314087), isolated worktree `pxd044412-mapping-20261016`, baseline `2180f20d`. Parent: [data sources](O_data-sources-selection__20261005.md).

Another session owns PXD044412 condition records. This scope changes only a new mapping tool/test, its audit artifact and validation contract, and coordinator-owned ticket bookkeeping. No edits to the peptide reader, condition metadata, shared UI, canonical checkout, or active calculators/function work.

Acceptance: checksum-pinned inputs; exact accession/locus/RefSeq agreement and mutual uniqueness; source-locus disagreements and multiple/unknown identities explicitly excluded; each observed Entry/Label retained with original evidence state; no ambiguous peptide promoted, no imputed absent pairs, no coordinate or confirmed-binding claims. Retain excluded identities and candidate routes. Independent check of full-source counts and review required.

## Verification

Implementation `32003bcc` (DEM-450) passes 241 focused tests. Independent direct-TSV audit matches all 2,148 identities, all 42 per-label totals, all 67,276 original reader summaries and all 391,900 source rows. Assigned: 1,849 proteins / 58,914 comparisons; excluded: 299 / 8,362. All assigned protein lengths agree with the pinned UTEX identity artifact.

Required gates: npm test 1,684 passed; Python suite 2,681 passed, 23 skipped, 51 subtests; contract 130 passed, 1 declared spliced-CDS exemption. DEM-453 approves `d3417961` with four small findings under repair:
- DEM453-L1: literal locus equality now enforced, with whitespace/NBSP/trailing-delimiter regression cases.
- DEM453-L2: independent audit reproducer committed with source pins and direct statistic validation.
- DEM453-L3: audit README documents the identity artifact and reproducer.
- DEM453-N1: tool description distinguishes retained identity labels from excluded peptide measurements.

Fix confirmation and exact-final-commit gates are pending. PXD044-TRANSFER is open in the parent; no browser/UTEX-specific peptide claim is made here. Browser admission/rendering remain with the parent; this task has no visible UI changes.

## Cleanup

Distil mapping policy, reproduction and audit expectations to `docs/validation/pxd044412-mapping.md`; preserve parent gates; name closer/date and resolve every review finding before deleting this scoped ticket.
