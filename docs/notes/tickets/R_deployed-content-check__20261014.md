# R_deployed-content-check__20261014 — Resolved

- **Scope:** Complete the independent deployed-bundle byte-comparison item from [gated pages and accounts](O_gated-pages-and-accounts__20261005.md) with a reusable read-only command.
- **Status:** resolved
- **Opened:** 2026-10-14
- **Updated:** 2026-10-14
- **Owner:** cyano-lit-unreach (`80c81443-1791314087`).

## Current State

Compare explicitly selected public site files with an immutable Git commit,
report expected and retrieved byte counts and SHA-256 values, and fail for stale,
missing or unreachable content. Read committed blobs, never dirty workspace
files. Keep requests bounded and sequential; never publish or modify site data.

Isolated worktree: `worktrees/deployed-content-check-20261014`, branch
`work/deployed-content-check-20261014`, baseline `0b50297`. The annotation-search
and Rfam-admission sessions retain their scopes. No scientific or access decision
is needed. The parent ticket's account and licence dependencies remain open.

## Acceptance

- A standard-library command compares selected site-relative paths with one
  resolved commit and returns nonzero on any mismatch or retrieval failure.
- Tests cover exact matches, equal-size changed bytes, missing/oversized files,
  transport errors, unsafe/untracked paths, invalid inputs and dirty local files.
- Document a production invocation and its boundary: selected byte equality does
  not establish deployment workflow success or replace browser smoke tests.

## Verification

Validated on integrated commit `6ff1290`, including the published Rfam changes:

- Focused real-HTTP and immutable-Git tests: 49 passed.
- `npm test`: 1,635 passed.
- Canonical venv `python -m pytest -q`: 2,265 passed, 23 skipped, 51 subtests.
- `tools/validate_contract.py`: 130 passed, 0 failed, 1 declared skip.
- Live command: all 11 selected files matched commit `87a07cd`, including all six
  organism manifests and both RF01116 downloads. System Python also ran the command.
- `git diff --check` passed. No site files differ from the published branch.

The initial full run encountered missing ignored inputs in the fresh worktree.
Those inputs were copied with copy-on-write (no shared writable files); the full
integrated run above passed afterward.

## Closure and findings

Closing session: **cyano-lit-unreach**, 2026-10-14.

- DC-1, stale content or dirty local files could give misleading comparisons:
  resolved by `6072703` (immutable blob selection and digest checks).
- DC-2, missing/truncated/oversized responses or invalid inputs could look like a
  match: resolved by `6072703` (strict responses, byte bounds, nonzero exits).
- Open findings against this bounded work: **none**. No independent audit is
  outstanding. The parent's source-access and account dependencies remain open.

## Cleanup

The reusable command, limitations, exit codes and invocation live in
`docs/validation/release-gate.md`, with its validation-index entry updated. The
parent uses that durable link. Remove the live queue row now, then delete this
resolved ticket as the last cleanup step. Keep other sessions' tickets/worktrees.
