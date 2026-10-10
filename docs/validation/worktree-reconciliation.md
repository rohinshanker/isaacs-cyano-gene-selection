# Reconciling linked worktrees

Use the canonical Desktop checkout and verify its remote before comparing
linked worktrees. Record the exact `main` and `origin/main` commits and inspect
`git worktree list --porcelain`, each checkout's `git status --porcelain=v1`,
and the current session owners. A newly active checkout is not stale merely
because it has not been integrated.

For each checkout:

1. Check whether its HEAD is an ancestor of the target. This proves committed
   integration only; inspect staged, unstaged and untracked files separately.
2. For divergent branches, use `git cherry`, stable patch IDs and
   `git range-diff` against the identified integration commits. Cherry-picked
   or adapted changes need not share commit IDs. Review remaining content
   differences rather than merging an entire old snapshot.
3. Compare staged blobs and untracked ticket copies with both current files
   and their history. Earlier exact matches can establish that later changes
   superseded them; verify that owner decisions and unresolved findings still
   have a home in the current code, validation docs or live queue.
4. Classify the result as integrated/superseded, active with an owner, a scoped
   missing-change candidate, or a specific unresolved question. Do not infer
   merge readiness from a clean working tree or from a worker's completion
   message alone. Validate and review any proposed integration separately.

Environment symlinks, downloaded inputs, probe files and browser/test artifacts
are not release changes. Preserve them, and preserve other sessions' index and
working-tree state. An audit does not authorize deleting or pruning worktrees.
Keep per-checkout inventories and command output in transient evidence outside
the repository; the ticket records findings until the owning session resolves
them under `AGENTS.md`.
