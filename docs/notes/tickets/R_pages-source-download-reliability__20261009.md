# R_pages-source-download-reliability__20261009 — Resolved

- **Scope:** Make Pages source ingestion tolerate interrupted upstream transfers without weakening pin verification.
- **Status:** resolved
- **Opened:** 2026-10-09
- **Updated:** 2026-10-09

## Outcome

Closed by owning session `cyano-ui-fixes` on 2026-10-09. No open findings remain.
The reliability fix is commit `691a34963823186f75f8211aefd41688e6d10e8a`.

- **NET-1 resolved by 691a349:** Transient downloads have three bounded attempts,
  with 5/10-second backoff. Partial files are removed and an existing destination
  remains untouched on failure. Access errors and pin mismatches still fail.
- **NET-2 resolved by 691a349:** CI caches only the pinned containing archive under
  an exact fetcher hash. The fetch step always verifies archive/member size and
  digest, including restored inputs. Run 37902420010 verified all eight members
  and successfully saved the archive cache. Existing on-disk archive verification
  and corrupted-archive rejection are covered by tests.
- **NET-3 resolved by 691a349 and run 37902420010:** All actual gate outcomes were
  successful; both validation and deployment succeeded. The live index, browser
  registry/loader and all five data manifests match the rendered and verified
  release byte-for-byte. No browser source changed in this follow-up.

## Verification

[Successful run 37902420010](https://github.com/rohinshanker/isaacs-cyano-gene-selection/actions/runs/37902420010)
passed 1,396 JavaScript tests, 938 Python tests and 36 subtests (one skip), all five
organisms' checks and all remaining gates. Local focused fetcher tests: 18 passed;
full project gates also passed. Tests cover interruption recovery, retry exhaustion,
permanent failures, atomic destination replacement and archive/member pin checks.

The earlier live browser evidence remains current because site bytes are unchanged:
five organism views at 375/768/1280/1440 px, keyboard navigation, Syn61 reference
map/fitness data, no horizontal overflow and no browser/runtime/request errors.
Evidence is in the worktree's ignored `.playwright-cli/pages-deployment-20261009/`;
workflow logs are in `/tmp/cyano-pages-repair-20261009/`.

## Cleanup

Retry/cache integrity and final-outcome reporting are distilled into
`docs/validation/release-gate.md`; its index row was updated. No ticket-only
operational guidance remains. Remove the queue row, record this resolved state,
and delete this resolved ticket last. Existing queued UI/data additions remain
owned by their respective tickets.
