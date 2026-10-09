# A_pages-source-download-reliability__20261009 — Active

- **Scope:** Make Pages source ingestion tolerate interrupted upstream transfers without weakening pin verification.
- **Status:** active
- **Opened:** 2026-10-09
- **Updated:** 2026-10-09

## Current State

Owner: `cyano-ui-fixes`; same isolated Pages repair worktree, baseline bd85a40.
The original repair deployed successfully in run 37895536320. A documentation-only
follow-up run 37901443947 failed because Europe PMC interrupted a chunked response
with `http.client.IncompleteRead`. The partial bundle was not admitted; subsequent
source-dependent tests failed because the workbooks were absent.

- **NET-1 fixed in this patch:** Add bounded retries for transient transport failures, remove
  partial files between attempts, and preserve any existing destination on failure.
- **NET-2 implemented in this patch, CI verification pending:** Cache the source archive under an exact fetcher/pin key. Continue
  verifying its pinned size and SHA-256 on every run, including cache hits.
- **NET-3 open:** Obtain a successful main workflow for the reliability patch and
  confirm the verified live deployment remains current.

## Verification

Local validation passed: 18 focused fetcher tests, all 1,396 JavaScript tests,
938 Python tests with one skip and 36 subtests, and the UTEX contract gate
(119 passed, zero failures, one declared skip). Tests cover interruption recovery,
retry exhaustion, permanent HTTP errors, preservation of existing files and
archive/member pin enforcement. Inspect actual step outcomes from
the final aggregation log: Actions reports a continued failed step's conclusion
as success, so an interim job-step conclusion is insufficient evidence.

## Cleanup

Closer must be the owning session, name the date and every NET finding's outcome.
Distill retry/cache integrity and outcome-reporting guidance into release-gate.md,
then resolve, remove the queue row and delete this ticket last.
