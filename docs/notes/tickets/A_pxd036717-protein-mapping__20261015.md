# A_pxd036717-protein-mapping__20261015 — Active

Scope: Resolve PXD-JOIN in the data-sources ticket using the existing pinned
UniProt ordered-locus table and approved PCC 7942-to-UTEX identifier crosswalk.
Status: active
Opened: 2026-10-15
Updated: 2026-10-15
Owner: cyano-lit-unreach (80c81443-1791314087)

## Current State

Isolated branch `work/pxd036717-mapping-20261015`, baseline `491c6f86`, in
`../worktrees/pxd036717-mapping-20261015`. Canonical repository:
`/Users/Rohin/Desktop/coding_stuff/ISAACS-LAB/isaacs-cyano-gene-selection`.
Leave the TSS and unknown-function sessions' paths/worktrees unchanged.

The source-preserving reader and non-imputed ratios are already complete.
This ticket adds a deterministic, audited identifier join. Keep every source
row, including unmapped/ambiguous groups; do not spread a multi-accession
group's values over multiple genes. Require one-to-one links in both mapping
inputs, preserve exact identifiers, source rows and pins, and retain the
distinction between PCC 7942 evidence and transferred UTEX identifiers.
No alias matching, new homology inference, coordinate transfer, imputation,
browser release, or change to the other ingestion routes is authorized here.

## Verification

Pending: independent source-only join counts; synthetic ambiguity/provenance
tests and real-input regression; exact-patch review; `npm test`, Python
`pytest -q`, and `tools/validate_contract.py`.

## Cleanup

Resolve only this session's bounded ticket. Move reusable join rules and
reproduction checks into the PXD036717 validation guide. Preserve PXD-IDENT,
PXD-CONDITION, PXD-RELEASE and PXD-DETECTION as open in the parent ticket.
