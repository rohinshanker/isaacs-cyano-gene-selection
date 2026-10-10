# A_pair-review-answer-checker__20261010 — Active

- **Scope:** Implement the completed-review TSV checker proposed in the comparability lab-judgements ticket, with a compatible blank template and reusable intake instructions.
- **Status:** active
- **Opened:** 2026-10-10
- **Updated:** 2026-10-10

## Current State

Claimed by `cyano-regulatory-sites` (session `e6e54b6e-1791581192`), baseline
`2e6839f`, isolated branch `work/pair-review-intake-20261010`. No active session
or Multica issue owns this scope. Syn57 remains with `cyano-ticket-closing`.
The [parent comparability ticket](O_comparability-lab-judgements__20261005.md)
explicitly proposes the checker and records it as unbuilt. Existing
`tools/pair_review_sheet.py` generates Markdown; pipeline checks validate the
already-admitted judgement JSON, not a returned human review sheet.

## Acceptance

- Provide a small standard-library CLI to emit a blank TSV template for the
  existing escalated-pair review order and validate a returned TSV against its
  exact source pair table. Preserve the current Markdown generator and historical
  owner-reviewed files.
- Bind pair numbers to the source table checksum and exact condition identities;
  reject stale/wrong tables, unknown or duplicate pairs, changed identities,
  malformed TSV and incomplete review metadata with useful row/field errors.
- Validate explicit decision values, named reviewer, ISO calendar date and basis;
  preserve a conditional decision's written condition. Do not interpret free text.
  Blank and omitted answers remain pending; an explicit undecided answer remains
  distinct. Report reviewed/pending counts without inventing a decision.
- Generate no filled answers, infer no historical dates, and never update source
  tables, lab decisions, admitted judgement data or site assets. Template output
  goes to stdout; validation reads only. No shared hosted review page is added.
- Test valid, partial, blank, conditional and undecided submissions; malformed and
  stale identities; duplicate/unknown rows; metadata errors; TSV quoting; CLI
  success/failure; and reproduction of the actual 32-pair ordering.

## Verification

Pending implementation, focused tests, independent exact-patch review and required
repository gates. No UI or scientific calculation changes are in scope. All
findings will be recorded here before repair and closure.

## Cleanup

Coordinator owns resolution. Distill the TSV contract and commands into
`docs/validation/`, update its index and the parent ticket without closing the
parent's outstanding lab questions. Name the closer/date and every finding's
resolving commit, rename to resolved, remove the queue row, then delete the
resolved ticket last in a separate commit. Push the validated combined tree and
verify the GitHub workflow.
