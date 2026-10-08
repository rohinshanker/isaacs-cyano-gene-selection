# O_review-original-source-downloads__20261007 — Open

- **Scope:** Owner review of listing original RefSeq GFF/feature tables and Rubin
  2015 Dataset S3 as discoverable downloads with source citations, exact versions,
  byte sizes and SHA-256 checksums. Documentation only until reviewed.
- **Status:** open
- **Opened:** 2026-10-07
- **Updated:** 2026-10-08

## Current State

Owner decision, 2026-10-08: **keep an upstream catalogue**, with dates when links
were last checked and other relevant metadata. The owner requested recording
only; do not implement the catalogue or check links yet. The current arrangement
continues until implementation resumes. No current download or calculation defect
requiring this change was established.

Catalogue metadata includes source/citation, original-versus-derived status,
assembly/release/version, exact filename and upstream URL, bytes and SHA-256,
compression identity, last link-check date and result, and relevant access or
availability notes. Record retrieval dates separately from link-check dates where
they differ. Retained copies were not selected by this decision.

Implementation, if wanted, belongs to rows 8 and 9 of
[proteomics-deposit-readers.md](../../validation/proteomics-deposit-readers.md), distilled from the resolved licence-unblocked-sources ticket.

## What the change would do

A reader could find the exact original annotation inputs or Rubin table beside
the derived tables in Citations & sources. Each entry would identify the source,
assembly/release or supplement version, filename, whether it is original or
derived, download URL, bytes and SHA-256. The checksummed artifact must be the
same artifact the link serves; compressed and decompressed copies need distinct
descriptions.

This is a source-download catalogue. The site's runtime
`site/data/data-manifest.json` describes published JSON payloads for loading
progress and cache keys; GFF files and workbooks should not become required
runtime downloads. Existing source citations remain sufficient to identify what
the current release used.

## Pros and cons

| Benefit | Cost or limit |
| --- | --- |
| Easier independent reproduction: readers obtain the exact inputs from one place | Existing pinned input manifests already support reproduction; this improves discovery rather than fixing a calculation |
| Sizes and hashes let readers check completeness and byte identity | Hashes must be measured from the exact linked version and maintained when URLs/files change |
| Original and derived artifacts are easier to distinguish | More entries need clear labels so readers do not mistake an original source for the project's transformed table |
| A retained copy can remain available if an upstream link changes | Repository storage and maintenance increase; the large RefSeq inputs are currently gitignored and cannot be served by a repository raw link |
| An upstream versioned link avoids duplicating large files | Upstream availability remains a dependency; a changing or disappearing link needs an explicit failure/fallback |
| Original Rubin S3 is discoverable beside its republication | Current calls already come through the cited Adomako workbook; users need an explanation of why both artifacts are listed |

## Options considered before the owner decision

Keep the current arrangement while no concrete user need or defect requires the
extra catalogue. If the owner wants it, prefer a small catalogue of exact
versioned upstream artifacts with verified sizes and hashes. Decide separately
whether any original file needs a retained copy; do not add large raw inputs to
Git merely to create a download button. Existing repository-file download rules
continue to require a real tracked file and exact filename/URL.

The owner can record: **keep current**, **add a catalogue with upstream links**,
or **add a catalogue with specified retained copies**, plus any desired scope.

## Verification

Documentation update verified 2026-10-07: the 32-ticket filename/H1/status,
main-queue membership and local-link checks passed; `git diff --check` was clean.
Required gates on the isolated docs worktree: `npm test` 1,116 passed;
`.venv/bin/python -m pytest -q` 494 passed, 1 skipped, 36 subtests;
`.venv/bin/python tools/validate_contract.py` 116 passed, 0 failed, 1 declared
skip. This pass changed no application code, release data or browser UI;
implementation-specific validation remains separate.

Preparation is grounded in [source-ledger.md](../../validation/source-ledger.md),
the existing source-ingestion ticket, and `tools/build_data_manifest.py`.
No download, release payload or browser UI changes.

Future implementation needs exact-version/hash checks, citation-manifest tests,
download filename/failure coverage, the three repository gates and rendered
Citations & sources checks at mobile, tablet and desktop widths.

## Cleanup

After the owner records a decision, transfer the action to the ingestion ticket
or retain the current arrangement. Resolve with the normal R-rename and dated
verification; distil only any new reusable download rule into the source ledger
and its validation index, then delete this ticket and remove its queue row.

## Explanation supplied before the decision, 2026-10-08

The in-chat explanation compared keep-current, an upstream-link catalogue, and
selected retained copies. The offered recommendation was a small upstream
catalogue with exact versions/sizes/hashes, retaining copies only when availability
justifies it. The subsequent owner decision selects the upstream catalogue above.
Scope remains
RefSeq GFF/feature inputs and original Rubin Dataset S3, not automatic raw-omics
downloads or new startup payloads.
