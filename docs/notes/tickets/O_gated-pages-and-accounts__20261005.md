# O_gated-pages-and-accounts__20261005 — Open

- **Scope:** Remaining BioCyc access verification; retire obsolete login, browser-render and permission-email requests. Documentation only.
- **Status:** open — credentials available; UTEX/SYNEL retrieval remains
- **Opened:** 2026-10-05
- **Updated:** 2026-10-16

## Current State

Access/staleness audit completed by **cyano-lit-unreach**, 2026-10-16, in isolated
`work/gated-access-audit-20261016` from published `3f4ad333`. Most of the original
ticket is stale. **No additional login is currently requested.** Keep this ticket
open for the target-specific BioCyc access result; do not duplicate its running
retrieval or close the annotation ticket.

The owner confirmed an existing BioCyc account with Yale access and a password
in Keychain. The 2026-10-16 decision in canonical commit `04b25ab2` authorizes
agent use of the `biocyc-login` Keychain item through BioCyc web services,
superseding the owner-present-browser restriction for this account. Credentials
and session state must never enter Git or tool output. This audit did not read
Keychain, log in, or interrupt another session's browser or fetch.

`cyano-unblocked-tix` owns EcoCyc/function-evidence retrieval;
`cyano-regulatory-sites` owns subsequent [BioCyc annotation work](O_biocyc-ortholog-annotations__20261014.md),
prepared in `work/biocyc-preparation-20261016`. Its preparation records a
successful EcoCyc login. That is reported evidence, not this audit's independent
verification; EcoCyc success does not prove paid UTEX/SYNEL entitlement. These
in-flight changes were not on published main at the audit baseline and are not
imported by this documentation patch.

## Remaining Work

| Finding | What remains | Owner / completion evidence |
| --- | --- | --- |
| BIO-01, open | Verify UTEX `GCF_000817325` and PCC 7942 `SYNEL` access through the authorized route. If Yale access is not recognized off campus, check the institution's normal VPN/proxy route before requesting another account | Existing BioCyc session after related retrieval settles; date, requested/returned organism, release, source URL, payload checksum and explicit access outcome |
| BIO-02, open in annotation ticket | Establish SYNEL assembly and sequence versions; credentials do not establish a valid join | Annotation ticket D2, under its existing owner |
| BIO-03, partly resolved | Public access terms verified; target-specific service access and any required flat-file entitlement remain untested here. Website/API and bulk-download access are distinct | Annotation ticket D1/BIO-03; verify the route actually needed, without assuming EcoCyc success grants all downloads |

After a verified access disposition, the owning session can close this tracking
slice. Assembly, joins, source admission and viewer work stay with the annotation
ticket. A required target still unavailable is an open finding, not completion.

## Retired or Reassigned Requests

| Original item | Current disposition |
| --- | --- |
| ACC-01: GEO disclaimer/FAQ | Browser challenges remain, checked 2026-10-16. Parent NCBI policy is available; no current feature depends on these two pages. Retain the nonblocking limitation in the runbook; no login, CAPTCHA automation or owner action requested |
| ACC-02: PRIDE policy | Resolved 2026-10-15; public render/Markdown receipt in [pride-policy-access.md](../../validation/pride-policy-access.md) |
| ACC-04: NUPACK 2.0 terms | Current agreement renders publicly; acceptance/download requires login and an active subscription. It is not verified legacy 2.0 terms. The active RBS reconstruction uses RNAstructure; no NUPACK account is requested for it. Legacy runtime/equivalence questions stay with the [RBS ticket](O_rbs-calculator-gene-visualizer__20260930.md) and its upstream project |
| BIO-03 / BIO-07: BioCyc / KEGG terms “never quoted” | Stale: both appear in the 2026-10-05 E. coli dossier. Public BioCyc service and KEGG website/API terms re-read and mechanically checked 2026-10-16; no login needed to read them, no new admission implied |
| LIC-01: GSE225426 / GSE311172 permission emails | Superseded by the 2026-10-06 owner decision; the source ledger records 5 and 7 admitted layers respectively. Remaining condition/identity questions belong to [depositor correspondence](O_depositor-condition-correspondence__20261007.md), not an account or reuse-permission gate |
| LIC-02: GtRNAdb terms email | No current dependency: the bounded tRNA viewer uses pinned RefSeq/local tRNAscan-SE outputs, not a newly admitted GtRNAdb artifact. This does not establish a database licence grant; verify any future artifact's terms and assembly/run identity separately |
| ACC-06: deployment comparison | Resolved engineering check in [release-gate.md](../../validation/release-gate.md#publish-and-smoke-test). Baseline `3f4ad333` passed validate/deploy and selected live-file comparison; no account request |
| De Novo DNA / RBS account | Hosted access already exists in active calculator sessions. Do not reuse their browser or repeat their jobs. Login does not provide private `DNAc`, establish API entitlement or complete a validated model; those remain upstream work |

## Verification

Nine public-source receipts carry dated URLs, SHA-256 and mechanically matched
located quotations in [source_access_checks_20261016.json](../handoff/source_access_checks_20261016.json).
NUPACK's current agreement rendered in a separate unauthenticated browser; no
agreement accepted, download requested or account created. BioCyc/KEGG checks
were public reads only. Historical register observations are preserved with
separate current intake dispositions. No data, application code or admission
decision changed.

Gates on the isolated published-code baseline: `npm test` 1,684 passed;
`python -m pytest -q` 2,376 passed, 23 skipped, 51 subtests passed;
`tools/validate_contract.py` 130 passed, one declared skip. `git diff --check`,
15 new relative links/anchors, required ticket fields/index membership and
preservation of every original register field passed. The global ticket checker
expects a different metadata/index format and reports repository-wide existing
layout errors; the scoped checks use this repository's established format.

## Cleanup

Reusable routes and credential boundaries are in [source-access.md](../../validation/source-access.md).
Once BIO-01 and the access portion of BIO-03 have verified dispositions, the
owning session records remaining finding IDs, renames to `R_`, removes the queue
row, redirects incoming links and deletes this ticket last. Preserve BIO-02 and
all annotation/assembly/join findings in their owning ticket.
