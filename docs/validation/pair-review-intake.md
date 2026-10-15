# Pair-review answer intake

`tools/check_pair_review_answers.py` emits the blank answer sheet for the pairs a
pair table escalates and validates a returned one against that same table. It
decides nothing: it never fills an answer, never reads a decision out of free
text, and a sheet it accepts is a record of the answers given, not an admission,
a layer join or a contract edit. Each of those stays a separate reviewed step.
`tools/pair_review_sheet.py` still writes the Markdown sheet people read; this
tool only validates what comes back.

A hosted shared review page is an optional, unapproved extension. The Markdown
and TSV workflow is sufficient for intake; build or publish an external review
page only at the owner's request because it would send package metadata to a host.

## Applying an explicit owner decision

Record the exact pair identities, reviewer, date, answer and basis in
`data/expression/pair_judgements.json` and the linked lab decision document.
An explicit answer can supersede a prior extrapolation; attribute the replacement
to the owner. Preserve unrelated decisions and source uncertainties. The source
document's `judged` date is its latest decision update, not a new date assigned to
every historical answer. Do not derive decisions from free text automatically.

Regenerate `meta.pairJudgements` through
`scripts/build_features.py::load_pair_judgements`, preserving unrelated release
metadata. The admitted expression-agreement payload also pins the metadata
bytes: run `tools/promote_expression_agreement.py` and verify its only change is
`metaInput` for a decision-only update. Then rebuild
`site/data/data-manifest.json` with `tools/build_data_manifest.py build`. Replay the
[current condition screen](condition-metadata-recovery.md#replaying-the-current-screen)
to refresh displayed owner calls and the source hash. A decision-only update
must not change condition values, default verdicts or missing-field rankings.
Check source-to-site equality in `tests/test_pair_judgements.py` and replay
reproducibility in `tests/test_rescore_condition_pairs.py`, then run the project
gates. No source is admitted or pooled by this transcription step.

Conditional and unresolved decisions remain usable outcomes. J2 is recorded as
conditional pair 33 while its source temperature remains unknown; depositor
follow-up is separate. Pairs 26/27 remain undecided while the reported 80–120
light range cannot establish the owner's narrower 80–90 condition. Pairs 11/30
retain their explicitly authorized extrapolation labels. Source-specific array
pooling and raw-read reprocessing have independent implementation scopes.

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
not accepted, and 2 when the pair table itself could not be used. `--verdict`
selects another verdict and, like `select_pairs`, matches the first word of the
verdict cell.

## What makes a pair table unusable

Both subcommands check the table's structure first, with its own data row and
line in every message. A checksum fixes which bytes a sheet was made from and
says nothing about whether those bytes are a table, so exit 2 covers:

- A missing table, bytes that are not UTF-8, no header row, or a record that is
  not well-formed TSV (a quote opened and never closed).
- A header that leaves a column unnamed or names one twice — a repeated name
  silently overwrites one of the two values.
- A header without a column the review order or a pair identity needs.
- A data row whose field count is not the header's, counting every column and
  not only the ones the review reads, and a record that does not end on the line
  it starts: the table writes one pair per line, and a quote that runs on would
  otherwise join two pairs into one and lose the second without a word. A pair
  table that quoted a line break into a cell would be rejected here; none does,
  and accepting one would make a stray quote impossible to tell from a lost pair.
- An `axes_passed` cell that is not `0 of 6` through `6 of 6`, on any data row.
  `select_pairs` sorts on it, so a cell it cannot read is a table error with a
  row and a field, not a `ValueError` out of the generator.
- A selected pair with a blank artifact, a condition-set cell not in the
  generator's `row N [label] axis=value` form, or a condition-table row below 1:
  each of those generates an identity that identifies nothing, which a returned
  sheet would then match.
- A table with no pair of the wanted verdict, or two selected pairs with one
  identity.

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
table, which is why both condition rows are in the schema. Five groups of pairs
name the same two artifacts and are told apart only by `condition_row_a`:

| Pairs | Artifacts | `condition_row_a` |
| --- | --- | --- |
| 7, 8 | PXD030282 against PXD062851 | 72, 74 |
| 20, 21 | GSE104203 against GSE254350 | 11, 12 |
| 24, 25 | GSE140121 against GSE327989 | 19, 20 |
| 26, 27 | GSE140121 against GSE45762 | 19, 20 |
| 28, 29 | GSE140121 against GSE59112 | 19, 20 |

`tests/test_check_pair_review_answers.py` counts those groups out of the table
itself, so a regenerated table cannot leave the list short. The decision words
are the enum of `data/expression/pair_judgements.json`.

## What is rejected

- A header that is not those eleven names, each once, in that order: a duplicate,
  unexpected, missing or reordered column is named.
- A row whose field count differs from the header's, a record that is not
  well-formed TSV, or bytes that are not UTF-8. Well-formed is Python's own
  `strict` TSV dialect: a cell that opens with `"` must close, and nothing may
  follow its closing quote. A `"` inside a cell that did not open with one is
  ordinary text and is kept verbatim — free text with one quotation mark in it
  round-trips, and the tool does not parse TSV itself to make it otherwise.
- An empty file. A sheet carries the template's header row, so an empty file is
  reported as empty rather than read as 32 pending pairs. A header-only sheet is
  valid and wholly pending, and says that no answer was recorded.
- A `source_sha256` that is not the table's: reported once for the sheet, as "made
  from another table, or the table changed", and nothing else in it is read.
- A `pair` that is not a plain positive integer (`0`, `-1`, `01`, `1.0`, `true`,
  a padded or non-ASCII digit) or is outside the table's pairs; an artifact or
  condition row that is not that pair's; a pair that appears twice. A pair number
  of thousands of digits is out of range from its length alone and is named in
  one shortened message, never converted: CPython refuses to convert more than
  4,300 digits.
- Review metadata without a decision, which is an unfinished row, not a pending
  one. A pending pair leaves all five review columns empty — whitespace counts as
  empty — or has no row at all.
- An answered pair without a reviewer, a basis, or a real calendar date written
  `YYYY-MM-DD`; `2026-02-29` and `20261010` are rejected, `2024-02-29` is not.
- A `conditional` decision with no condition, and a condition written beside any
  other decision, which would otherwise be dropped silently.

Free text is checked for emptiness and nothing else. Tabs and line breaks inside
`basis` and `condition` survive a round trip when the cell is quoted — unlike the
pair table, an answer sheet may carry a record across lines — and surrounding
whitespace is ignored only on `decision` and `date`.

## What a valid sheet reports

The summary distinguishes the four states a pair can be in, and never suggests
what to do with them: decided (`share`, `separate`, `conditional`, counted
separately), explicitly `undecided`, blank rows, and pairs with no row. The last
two are the pending total.

```sh
.venv/bin/python -m pytest -q tests/test_check_pair_review_answers.py \
  tests/test_pair_review_sheet.py
```
