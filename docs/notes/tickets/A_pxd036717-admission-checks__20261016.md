# A_pxd036717-admission-checks__20261016 — Active

Scope: Complete PXD036717 peptide/identification evidence checks and structured condition metadata before browser admission.
Status: active
Opened: 2026-10-16
Updated: 2026-10-16

## Current State

Owner: `cyano-lit-unreach`, isolated branch `work/pxd036717-admission-contract-20261016` from `dc3d95cf80079bb6c66d63eab753d0c5701fc247`. Bounded PXD-IDENT evidence and PXD-CONDITION implementation from [Data Sources](O_data-sources-selection__20261005.md). Separate from the active PXD044412 reader, function-evidence and calculator sessions. No changes to their worktrees or browser modules.

Preserve all source rows, mapping exclusions, LFQ missingness and source condition disagreements. Read the pinned workbook/article/PRIDE evidence before setting any identification or condition rule. No new interaction calls, unsupported thresholds, or restoration of unconfirmed mappings. Browser release and detection UI remain owned by the parent ticket.

## Verification

Implemented the six-sample identification evidence and sixteen condition records. Fourteen exact source passages are matched with hashes/locations in the metadata artifact; article page 3 was rendered and inspected. Focused reader/mapping tests: 141 passed; condition tests: 19 passed. JavaScript: 1,684 passed. Full Python and contract gates, source review and independent exact-patch review are running.

Findings: PXD-CONDITION implemented, awaiting final review. PXD-IDENT descriptive evidence implemented; full identification-rule verification is unavailable from mmc1 and the browser release policy remains open in the parent, with an owner question pending. Existing PXD-IDENT mapping exclusions remain open; PXD-DETECTION and PXD-RELEASE remain open. PXD-JOIN remains resolved by its recorded earlier commit. No new browser admission.

## Cleanup

Distill reproducible metadata/identification contracts into `docs/validation/pxd036717-enrichment.md`, update parent and indexes, and close this bounded child only with all its findings resolved. Preserve every remaining parent finding explicitly.
