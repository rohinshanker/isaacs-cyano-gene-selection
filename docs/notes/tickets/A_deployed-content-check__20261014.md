# A_deployed-content-check__20261014 — Active

- **Scope:** Complete the independent deployed-bundle byte-comparison item from [gated pages and accounts](O_gated-pages-and-accounts__20261005.md) with a reusable read-only command.
- **Status:** active
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

Pending implementation, focused tests, repository gates and a live-content check.

## Cleanup

The owning session will name all findings and their resolution, preserve the
reusable command contract in the release gate, rename to resolved, remove the
queue row and delete the resolved ticket last. No source-access finding is closed
by this work.
