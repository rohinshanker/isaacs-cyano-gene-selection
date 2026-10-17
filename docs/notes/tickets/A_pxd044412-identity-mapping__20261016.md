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

Pending focused synthetic edge cases, full-source mapping audit, independent review, npm test, Python suite and contract validator. Browser admission/rendering remain with the parent; this task has no visible UI changes.

## Cleanup

Distil mapping policy, reproduction and audit expectations to `docs/validation/pxd044412-mapping.md`; preserve parent gates; name closer/date and resolve every review finding before deleting this scoped ticket.
