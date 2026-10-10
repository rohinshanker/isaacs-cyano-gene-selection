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

Coordinator finding **PRA-C1 open** against `6bf1b86`: malformed source tables
are not fully validated. A repeated `artifact_a` header silently substitutes its
last value and emits a successful template; `row 0` is accepted as a condition
identity; and an invalid `axes_passed` value raises an uncaught traceback rather
than the documented source error. Disposable reproductions are in
`/tmp/cyano-pair-review-20261010/`. Repair must reject these inputs before emitting
any template, retain the actual 32-pair order, and add regression tests.

Coordinator finding **PRA-C2 open** against `6bf1b86`: a 5,000-digit pair number
passes the decimal spelling test and raises Python's integer-conversion limit
error. Reject an out-of-range identifier with a row/field diagnostic rather than
a traceback; do not alter interpreter-wide limits. Reproduction:
`/tmp/cyano-pair-review-20261010/huge-pair.tsv` against the pinned source table.

Implemented by `claude-implementer` on DEM-356, 2026-10-10:
Independent review DEM-358 against `6bf1b86` requires the following repairs;
all are **open**. PRA-R1–R3 overlap PRA-C1; PRA-R4 overlaps PRA-C2.

| Finding | Required repair |
| --- | --- |
| PRA-R1 | Reject duplicate source headers, malformed quoted records and record widths differing from the complete source header; a bad quote can otherwise consume a pair and falsely report no pending answers. |
| PRA-R2 | Reject blank source artifacts and nonpositive condition-row identities. |
| PRA-R3 | Validate ordering counts and report malformed values as source errors with row/field context. |
| PRA-R4 | Reject oversized answer identifiers without an integer-conversion traceback. |
| PRA-R5 | Correct the quoted-field dialect claim and test an embedded quote in an unquoted free-text cell. |
| PRA-R6 | Correct the repeated-artifact groups to five, including pairs 7/8 (PXD030282 versus PXD062851, condition rows 72/74). |

Initial implementation:
`tools/check_pair_review_answers.py` (`template PAIRS` to stdout,
`check PAIRS ANSWERS` read-only), `tests/test_check_pair_review_answers.py`, and
the contract in [docs/validation/pair-review-intake.md](../../validation/pair-review-intake.md).
Standard library only. `tools/pair_review_sheet.py`, the historical handoffs, the
admitted judgement data and the site are unchanged.

`.venv/bin/python -m pytest -q tests/test_check_pair_review_answers.py
tests/test_pair_review_sheet.py tests/test_pair_judgements.py
tests/test_rescore_condition_pairs.py` passes. The suite pins the actual 32
escalated identities and their order against both the pinned table and the
Markdown sheet the owner answered, the four pairs that differ only by a condition
row, template determinism, input immutability on both commands, every decision
path, and the malformed paths: stale checksum, changed identity, unknown or
non-canonical pair, duplicate and ragged rows, header defects, broken quoting,
non-UTF-8 bytes, empty input, metadata without a decision, bad dates and
mishandled conditions.

Smoke-checked against `docs/notes/handoff/cyano_package_D_pairs_20261004.tsv`
(sha256 `9a45d838…f799c`): the template reproduces the 32 pairs byte-identically
on repeat runs, a synthetic filled sheet reports 28 decided, 1 explicitly
undecided, 2 blank and 1 omitted, and a one-byte checksum edit is rejected once
with exit 1. Synthetic answers were written outside the repository; no tool run
filled an answer or a date.

No UI or scientific calculation changes are in scope. Open: the full repository
gates and the independent exact-patch review, both owned by the coordinator. All
findings go here before repair and closure.

## Cleanup

Coordinator owns resolution. Distill the TSV contract and commands into
`docs/validation/`, update its index and the parent ticket without closing the
parent's outstanding lab questions. Name the closer/date and every finding's
resolving commit, rename to resolved, remove the queue row, then delete the
resolved ticket last in a separate commit. Push the validated combined tree and
verify the GitHub workflow.
