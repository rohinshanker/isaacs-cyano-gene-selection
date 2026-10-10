# Pair-review answer intake

`tools/check_pair_review_answers.py` emits the blank answer sheet for the pairs a
pair table escalates and validates a returned one against that same table. It
decides nothing: it never fills an answer, never reads a decision out of free
text, and a sheet it accepts is a record of the answers given, not an admission,
a layer join or a contract edit. Each of those stays a separate reviewed step.
`tools/pair_review_sheet.py` still writes the Markdown sheet people read; this
tool only validates what comes back.

## Commands

```sh
.venv/bin/python tools/check_pair_review_answers.py \
  template docs/notes/handoff/cyano_package_D_pairs_20261004.tsv > answers.tsv
.venv/bin/python tools/check_pair_review_answers.py \
  check docs/notes/handoff/cyano_package_D_pairs_20261004.tsv answers.tsv
```

`template` writes to stdout and `check` reads both files; neither writes or
replaces an input, so the shell redirection above is the only thing that creates
a file. Exit status is 0 when the command succeeded, 1 when a returned sheet was
not accepted, and 2 when the pair table itself could not be used — a missing or
non-UTF-8 table, a table missing a column the review order needs, a table with no
pair of the wanted verdict, or two selected pairs with one identity. `--verdict`
selects another verdict and, like `select_pairs`, matches the first word of the
verdict cell.

Pairs are numbered by `enumerate(select_pairs(rows, "escalate"), 1)`, the review
order of `tools/pair_review_sheet.py`: most axes passed first, then by artifact.
For `cyano_package_D_pairs_20261004.tsv`
(sha256 `9a45d8384a23ecbf2ea2619043d5610a11d096912020878bd95df59f91ff799c`) that is
the 32 escalated pairs in the numbering of
[`cyano_escalated_pairs_review_20261005.md`](../notes/handoff/cyano_escalated_pairs_review_20261005.md),
the sheet the owner answered; `tests/test_check_pair_review_answers.py` pins both
the identities and that agreement.

## The answer TSV

Tab-separated, UTF-8, eleven columns in this order. A leading byte-order mark and
CRLF line endings are accepted, so a spreadsheet export round-trips; the template
itself writes LF only and is byte-identical on every run.

| Column | Meaning |
| --- | --- |
| `source_sha256` | SHA-256 of the pair table's exact bytes |
| `pair` | review number, a plain positive decimal integer |
| `artifact_a`, `artifact_b` | the two artifacts, verbatim from the table |
| `condition_row_a`, `condition_row_b` | each side's condition-table row number |
| `decision` | `share`, `separate`, `conditional` or `undecided`, exactly |
| `reviewer` | who answered |
| `date` | the day they answered, `YYYY-MM-DD` |
| `basis` | why, in their words |
| `condition` | what a `conditional` decision holds under |

The first six columns are the identity: they bind a row to one pair of one exact
table, which is why both condition rows are in the schema: four pairs of pairs —
20 and 21, 24 and 25, 26 and 27, 28 and 29 — share both artifacts and differ only
by a condition row. The decision
words are the enum of `data/expression/pair_judgements.json`.

## What is rejected

- A header that is not those eleven names, each once, in that order: a duplicate,
  unexpected, missing or reordered column is named.
- A row whose field count differs from the header's, a line that cannot be read as
  TSV (an unquoted quote inside a cell), or bytes that are not UTF-8.
- An empty file. A sheet carries the template's header row, so an empty file is
  reported as empty rather than read as 32 pending pairs. A header-only sheet is
  valid and wholly pending, and says that no answer was recorded.
- A `source_sha256` that is not the table's: reported once for the sheet, as "made
  from another table, or the table changed", and nothing else in it is read.
- A `pair` that is not a plain positive integer (`0`, `-1`, `01`, `1.0`, `true`,
  a padded or non-ASCII digit) or is outside the table's pairs; an artifact or
  condition row that is not that pair's; a pair that appears twice.
- Review metadata without a decision, which is an unfinished row, not a pending
  one. A pending pair leaves all five review columns empty — whitespace counts as
  empty — or has no row at all.
- An answered pair without a reviewer, a basis, or a real calendar date written
  `YYYY-MM-DD`; `2026-02-29` and `20261010` are rejected, `2024-02-29` is not.
- A `conditional` decision with no condition, and a condition written beside any
  other decision, which would otherwise be dropped silently.

Free text is checked for emptiness and nothing else. Tabs, quotes and line breaks
inside `basis` and `condition` survive a round trip when the cell is quoted, and
surrounding whitespace is ignored only on `decision` and `date`.

## What a valid sheet reports

The summary distinguishes the four states a pair can be in, and never suggests
what to do with them: decided (`share`, `separate`, `conditional`, counted
separately), explicitly `undecided`, blank rows, and pairs with no row. The last
two are the pending total.

```sh
.venv/bin/python -m pytest -q tests/test_check_pair_review_answers.py \
  tests/test_pair_review_sheet.py
```
