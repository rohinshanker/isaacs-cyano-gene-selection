#!/usr/bin/env python3
"""Emit and validate the returned-answer TSV for the escalated pair review.

``template`` writes a blank answer sheet to stdout for the pairs a pair table
escalates, numbered in the review order ``tools/pair_review_sheet.py`` uses.
``check`` validates a returned sheet against that same table: the table's own
exact-byte checksum, each pair's artifact and condition-row identity, and the
review metadata a human filled in.

Both subcommands read their inputs and write nothing. Neither reads a decision
out of free text, fills an answer, infers a date, nor makes a pair a shared
layer: a validated file is a record of the answers given, and copying one into
the contract is a separate reviewed step.
"""

from __future__ import annotations

import argparse
import csv
import datetime
import hashlib
import io
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Sequence

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tools.pair_review_sheet import AXES, parse_condition_set, select_pairs

IDENTITY_COLUMNS = (
    "source_sha256",
    "pair",
    "artifact_a",
    "artifact_b",
    "condition_row_a",
    "condition_row_b",
)
"""Columns that bind a row to one pair of one exact source table."""

REVIEW_COLUMNS = ("decision", "reviewer", "date", "basis", "condition")
"""Columns a human fills in. All blank means the pair is still pending."""

COLUMNS = IDENTITY_COLUMNS + REVIEW_COLUMNS

DECISIONS = ("share", "separate", "conditional", "undecided")
"""The decision enum of ``data/expression/pair_judgements.json``."""

SOURCE_COLUMNS = (
    "artifact_a",
    "artifact_b",
    "condition_set_a",
    "condition_set_b",
    "verdict",
    "axes_passed",
)
"""Source-table columns the review order and the pair identities are read from."""

AXES_PASSED_COUNTS = {
    f"{count} of {len(AXES)}": count for count in range(len(AXES) + 1)
}
"""The ``axes_passed`` cells the pair table writes, and the count each means.

``select_pairs`` sorts on this cell, so a cell it cannot read has to be caught
before the sort rather than as an exception out of the generator.
"""

DEFAULT_VERDICT = "escalate"


class SourceError(Exception):
    """The pinned pair table cannot be read, or does not identify its pairs."""


def is_canonical_int(text: str) -> bool:
    """Report whether the text is a canonical positive decimal integer.

    Canonical means exactly the digits Python's ``str`` would write: no sign, no
    leading zero, no surrounding whitespace, no other spelling of a number. The
    text is only read, never converted, so however long it is costs nothing.
    """
    # ``isdigit`` also accepts superscripts and other numeric scripts.
    if not text.isascii() or not text.isdigit() or text.startswith("0"):
        return False
    return True


def is_calendar_date(text: str) -> bool:
    """Report whether the text is a real calendar date written ``YYYY-MM-DD``."""
    if len(text) != 10 or text[4] != "-" or text[7] != "-":
        return False
    parts = (text[:4], text[5:7], text[8:10])
    if not all(part.isascii() and part.isdigit() for part in parts):
        return False
    try:
        datetime.date(int(parts[0]), int(parts[1]), int(parts[2]))
    except ValueError:
        return False
    return True


def checksum(data: bytes) -> str:
    """Return the SHA-256 of exactly these bytes."""
    return hashlib.sha256(data).hexdigest()


def _clip(text: str, limit: int = 80) -> str:
    """Quote a cell for an error message, shortened and with no raw newline."""
    shown = text if len(text) <= limit else text[:limit] + "…"
    return repr(shown)


@dataclass(frozen=True)
class PairIdentity:
    """One escalated pair, as the review numbers and identifies it."""

    number: int
    artifact_a: str
    artifact_b: str
    condition_row_a: int
    condition_row_b: int

    @property
    def key(self) -> tuple[str, str, int, int]:
        """The identity the source table must not repeat."""
        return (
            self.artifact_a,
            self.artifact_b,
            self.condition_row_a,
            self.condition_row_b,
        )

    def cells(self, source_sha256: str) -> list[str]:
        """Return the identity cells of this pair's answer row."""
        return [
            source_sha256,
            str(self.number),
            self.artifact_a,
            self.artifact_b,
            str(self.condition_row_a),
            str(self.condition_row_b),
        ]

    def describe(self) -> str:
        """Name the pair the way the review sheet names it."""
        return (
            f"pair {self.number}: {self.artifact_a} (condition row "
            f"{self.condition_row_a}) against {self.artifact_b} (condition row "
            f"{self.condition_row_b})"
        )


@dataclass(frozen=True)
class SourceRow:
    """One data row of a pair table, and where the table wrote it."""

    number: int
    line: int
    cells: dict[str, str]

    @property
    def where(self) -> str:
        """Name the row the way an error message should."""
        return f"data row {self.number} (line {self.line})"


@dataclass(frozen=True)
class SourceTable:
    """The pairs one exact pair table escalates, with that table's checksum."""

    path: Path
    sha256: str
    verdict: str
    pairs: tuple[PairIdentity, ...]

    def by_number(self) -> dict[int, PairIdentity]:
        """Index the pairs by their review number."""
        return {pair.number: pair for pair in self.pairs}


def _read_source_rows(path: Path, text: str) -> list[SourceRow]:
    """Parse a pair table's records, checking its header and every row width.

    A checksum fixes which bytes a sheet was made from; it says nothing about
    whether those bytes are a well-formed table, so the structure is checked
    here before any pair is identified.

    Raises:
        SourceError: If the table is not well-formed TSV, has no header, names a
            column blank or twice, lacks a column the review order needs, or has
            a data row whose field count is not the header's or whose record does
            not end on the line it starts.
    """
    csv.field_size_limit(sys.maxsize)
    reader = csv.reader(io.StringIO(text, newline=""), delimiter="\t", strict=True)
    records: list[tuple[int, list[str]]] = []
    try:
        for record in reader:
            records.append((reader.line_num, record))
    except csv.Error as error:
        raise SourceError(
            f"pair table {path} cannot be read as TSV at line {reader.line_num}: "
            f"{error}"
        ) from error
    if not records:
        raise SourceError(f"pair table {path} has no header row")

    header = records[0][1]
    blank = [index for index, name in enumerate(header, start=1) if not name.strip()]
    if blank:
        raise SourceError(
            f"pair table {path} leaves header column(s) "
            f"{', '.join(str(index) for index in blank)} unnamed"
        )
    repeated = sorted({name for name in header if header.count(name) > 1})
    if repeated:
        raise SourceError(
            f"pair table {path} names column(s) more than once: "
            f"{', '.join(repeated)}; one value would overwrite the other"
        )
    missing = [name for name in SOURCE_COLUMNS if name not in header]
    if missing:
        raise SourceError(
            f"pair table {path} is missing column(s): {', '.join(missing)}"
        )

    rows: list[SourceRow] = []
    previous = records[0][0]
    # Every column of the header counts, not only the ones the review reads, and
    # a record has to end where it starts: both say the boundaries are where
    # they look, which is what a missing or merged pair would break.
    for number, (line, record) in enumerate(records[1:], start=1):
        row = SourceRow(number, line, dict(zip(header, record)))
        if len(record) != len(header):
            raise SourceError(
                f"pair table {path} {row.where} has {len(record)} field(s), not "
                f"the {len(header)} of its header"
            )
        if line != previous + 1:
            raise SourceError(
                f"pair table {path} {row.where} starts on line {previous + 1} and "
                f"ends on line {line}; the table writes one pair per line, and a "
                "quote that runs on joins two pairs into one"
            )
        previous = line
        rows.append(row)
    return rows


def _condition_row(path: Path, number: int, row: SourceRow, name: str) -> int:
    """Read one side's condition-table row number from a selected source row.

    Raises:
        SourceError: If the cell is not in the generator's form, or numbers the
            condition row in a way no table row can have.
    """
    try:
        source_row, _, _ = parse_condition_set(row.cells[name])
    except ValueError as error:
        raise SourceError(
            f"pair table {path} pair {number}, {row.where} has an unreadable "
            f"{name}: {error}"
        ) from error
    if source_row < 1:
        raise SourceError(
            f"pair table {path} pair {number}, {row.where} gives {name} the "
            f"condition-table row {source_row}; rows are numbered from 1, so this "
            "identifies no condition"
        )
    return source_row


def load_source(path: Path, verdict: str = DEFAULT_VERDICT) -> SourceTable:
    """Read a pair table and identify the pairs it gives the wanted verdict.

    Args:
        path: The pinned pair table, tab-separated.
        verdict: The verdict whose pairs go to the lab, matched against the first
            word of the verdict cell, as ``select_pairs`` does.

    Returns:
        The table's checksum and its selected pairs, in review order.

    Raises:
        SourceError: If the table is unreadable, not well-formed TSV, structured
            unlike its own header, unreadable to the review order, missing an
            artifact or condition a pair is identified by, selects no pair, or
            identifies two selected pairs alike.
    """
    try:
        data = path.read_bytes()
    except OSError as error:
        raise SourceError(f"cannot read pair table {path}: {error}") from error
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as error:
        raise SourceError(f"pair table {path} is not valid UTF-8: {error}") from error

    rows = _read_source_rows(path, text)
    for row in rows:
        if row.cells["axes_passed"] not in AXES_PASSED_COUNTS:
            raise SourceError(
                f"pair table {path} {row.where} has axes_passed "
                f"{_clip(row.cells['axes_passed'])}, not a count of the "
                f"{len(AXES)} screened axes written "
                f"'0 of {len(AXES)}' through '{len(AXES)} of {len(AXES)}'; the "
                "review order sorts on it"
            )

    # ``select_pairs`` returns the very row dicts it was given, so their ids
    # lead back to where the table wrote them. ``rows`` keeps them alive.
    located = {id(row.cells): row for row in rows}
    pairs: list[PairIdentity] = []
    seen: dict[tuple[str, str, int, int], int] = {}
    selected = select_pairs([row.cells for row in rows], verdict)
    for number, cells in enumerate(selected, start=1):
        row = located[id(cells)]
        for name in ("artifact_a", "artifact_b"):
            if not cells[name].strip():
                raise SourceError(
                    f"pair table {path} pair {number}, {row.where} has no {name}; "
                    "a pair is identified by both of its artifacts"
                )
        pair = PairIdentity(
            number,
            cells["artifact_a"],
            cells["artifact_b"],
            _condition_row(path, number, row, "condition_set_a"),
            _condition_row(path, number, row, "condition_set_b"),
        )
        if pair.key in seen:
            raise SourceError(
                f"pair table {path} identifies pair {number} exactly like pair "
                f"{seen[pair.key]}: {pair.describe()}"
            )
        seen[pair.key] = number
        pairs.append(pair)
    if not pairs:
        raise SourceError(f"pair table {path} has no pair with verdict {verdict!r}")
    return SourceTable(path, checksum(data), verdict, tuple(pairs))


def render_template(source: SourceTable) -> str:
    """Return the blank answer sheet for a source table's pairs, as TSV text."""
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, delimiter="\t", lineterminator="\n")
    writer.writerow(COLUMNS)
    for pair in source.pairs:
        writer.writerow(pair.cells(source.sha256) + [""] * len(REVIEW_COLUMNS))
    return buffer.getvalue()


@dataclass(frozen=True)
class Problem:
    """One reason a returned sheet was not accepted."""

    where: str
    message: str

    def __str__(self) -> str:
        return f"{self.where}: {self.message}"


@dataclass(frozen=True)
class Answer:
    """One pair's answer, exactly as the sheet gave it."""

    pair: int
    decision: str
    reviewer: str
    date: str
    basis: str
    condition: str


@dataclass
class Report:
    """What a returned sheet says, or why it was not accepted."""

    problems: list[Problem] = field(default_factory=list)
    answers: list[Answer] = field(default_factory=list)
    blank: list[int] = field(default_factory=list)
    omitted: list[int] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        """Report whether the sheet passed every check."""
        return not self.problems

    def counts(self) -> dict[str, int]:
        """Count the answers by decision, including the decisions nobody gave."""
        counted = {name: 0 for name in DECISIONS}
        for answer in self.answers:
            counted[answer.decision] += 1
        return counted

    def summary(self, source: SourceTable, answers_path: Path) -> str:
        """Describe what the sheet answered and what is still pending."""
        counted = self.counts()
        decided = sum(counted[name] for name in DECISIONS if name != "undecided")
        pending = len(self.blank) + len(self.omitted)
        lines = [
            f"source {source.path} sha256 {source.sha256}",
            f"answers {answers_path}: {len(self.answers) + len(self.blank)} of "
            f"{len(source.pairs)} pairs present, identities match",
            f"decided: {decided}"
            + (
                f" (share {counted['share']}, separate {counted['separate']}, "
                f"conditional {counted['conditional']})"
                if decided
                else ""
            ),
            f"explicitly undecided: {counted['undecided']}",
            f"blank (row present, no answer): {len(self.blank)}"
            + (f" — pairs {_numbers(self.blank)}" if self.blank else ""),
            f"omitted (no row): {len(self.omitted)}"
            + (f" — pairs {_numbers(self.omitted)}" if self.omitted else ""),
            f"pending: {pending} of {len(source.pairs)}",
        ]
        if not self.answers:
            lines.append("no answer was recorded; this is not a completed review")
        lines.append(
            "These are the answers as given. They are not an admission, a layer "
            "join, or a contract edit; each of those is a separate reviewed step."
        )
        return "\n".join(lines)


def _numbers(values: Sequence[int]) -> str:
    """Join pair numbers for a one-line report."""
    return ", ".join(str(value) for value in values)


def check_header(header: Sequence[str]) -> list[Problem]:
    """Check the header names the required columns exactly once, in order."""
    problems: list[Problem] = []
    repeated = sorted({name for name in header if header.count(name) > 1})
    if repeated:
        problems.append(
            Problem("header", f"duplicate column(s): {', '.join(repeated)}")
        )
    unexpected = [name for name in header if name not in COLUMNS]
    if unexpected:
        problems.append(
            Problem("header", f"unexpected column(s): {', '.join(unexpected)}")
        )
    missing = [name for name in COLUMNS if name not in header]
    if missing:
        problems.append(Problem("header", f"missing column(s): {', '.join(missing)}"))
    if not problems and tuple(header) != COLUMNS:
        problems.append(
            Problem("header", f"columns out of order; expected {', '.join(COLUMNS)}")
        )
    return problems


def _check_identity(
    where: str, cells: dict[str, str], source: SourceTable
) -> tuple[PairIdentity | None, list[Problem]]:
    """Resolve a row's pair and check its identity cells against the source."""
    problems: list[Problem] = []
    text = cells["pair"]
    if not is_canonical_int(text):
        problems.append(
            Problem(
                where,
                f"pair {_clip(text)} is not a pair number written as "
                f"1 to {len(source.pairs)}",
            )
        )
        return None, problems
    # The spelling's length settles the range before any conversion: CPython
    # refuses to convert more than 4,300 digits, and a number that long is out
    # of range whatever it says.
    in_range = len(text) <= len(str(len(source.pairs)))
    pair = source.by_number().get(int(text)) if in_range else None
    if pair is None:
        problems.append(
            Problem(
                where,
                f"pair {_clip(text)} is not in {source.path}, which escalates "
                f"pairs 1 to {len(source.pairs)}",
            )
        )
        return None, problems
    number = pair.number
    for name, expected in (
        ("artifact_a", pair.artifact_a),
        ("artifact_b", pair.artifact_b),
        ("condition_row_a", str(pair.condition_row_a)),
        ("condition_row_b", str(pair.condition_row_b)),
    ):
        if cells[name] != expected:
            problems.append(
                Problem(
                    where,
                    f"{name} {_clip(cells[name])} is not pair {number}'s "
                    f"{_clip(expected)} in {source.path}",
                )
            )
    return pair, problems


def _check_source_checksums(
    rows: Sequence[tuple[str, dict[str, str]]], source: SourceTable
) -> list[Problem]:
    """Report each wrong ``source_sha256``, once however many rows carry it."""
    wrong: dict[str, list[str]] = {}
    for where, cells in rows:
        if cells["source_sha256"] != source.sha256:
            wrong.setdefault(cells["source_sha256"], []).append(where)
    return [
        Problem(
            wheres[0],
            f"source_sha256 {_clip(value)} is not the checksum of {source.path} "
            f"({source.sha256})"
            + (
                f", and the same in {len(wheres) - 1} further row(s)"
                if wheres[1:]
                else ""
            )
            + "; the sheet was made from another table, or the table changed",
        )
        for value, wheres in wrong.items()
    ]


def _check_review(
    where: str, number: int, cells: dict[str, str]
) -> tuple[Answer | None, list[Problem]]:
    """Check one row's review metadata, without reading its free text."""
    problems: list[Problem] = []
    filled = [name for name in REVIEW_COLUMNS if cells[name].strip()]
    if not filled:
        return None, problems
    decision = cells["decision"].strip()
    if not decision:
        problems.append(
            Problem(
                where,
                f"{', '.join(filled)} filled in without a decision; a pending pair "
                "leaves every review column empty",
            )
        )
        return None, problems
    if decision not in DECISIONS:
        problems.append(
            Problem(
                where,
                f"decision {_clip(cells['decision'])} is not one of "
                f"{', '.join(DECISIONS)}, written exactly",
            )
        )
    for name in ("reviewer", "basis"):
        if not cells[name].strip():
            problems.append(Problem(where, f"{name} is empty on an answered pair"))
    if not is_calendar_date(cells["date"].strip()):
        problems.append(
            Problem(
                where,
                f"date {_clip(cells['date'])} is not a real calendar date written "
                "YYYY-MM-DD",
            )
        )
    condition = cells["condition"].strip()
    if decision == "conditional" and not condition:
        problems.append(
            Problem(
                where,
                "a conditional decision needs the condition it holds under, in the "
                "condition column",
            )
        )
    if decision in DECISIONS and decision != "conditional" and condition:
        problems.append(
            Problem(
                where,
                f"condition {_clip(cells['condition'])} is written beside a "
                f"{decision!r} decision, which does not keep one; use conditional, "
                "or move the note into basis",
            )
        )
    if problems:
        return None, problems
    return (
        Answer(
            number,
            decision,
            cells["reviewer"],
            cells["date"].strip(),
            cells["basis"],
            cells["condition"],
        ),
        problems,
    )


def check_answers(source: SourceTable, data: bytes) -> Report:
    """Validate a returned answer sheet's bytes against its source table."""
    report = Report()
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as error:
        report.problems.append(
            Problem(
                "file",
                f"not valid UTF-8 at byte {error.start}: {error.reason}; save the "
                "sheet as UTF-8 text",
            )
        )
        return report
    if text.startswith("﻿"):
        # A spreadsheet export marks UTF-8 with a byte-order mark.
        text = text[1:]
    if not text.strip():
        report.problems.append(
            Problem(
                "file",
                "empty; a returned sheet carries the template's header row, and "
                "`template` writes one",
            )
        )
        return report

    csv.field_size_limit(sys.maxsize)
    reader = csv.reader(io.StringIO(text, newline=""), delimiter="\t", strict=True)
    records: list[tuple[int, list[str]]] = []
    header: list[str] = []
    try:
        for row in reader:
            if header:
                records.append((reader.line_num, row))
            else:
                header = row
    except csv.Error as error:
        report.problems.append(
            Problem(f"line {reader.line_num}", f"cannot be read as TSV: {error}")
        )
        return report

    report.problems.extend(check_header(header))
    if report.problems:
        return report

    rows: list[tuple[str, dict[str, str]]] = []
    for index, (line, row) in enumerate(records, start=1):
        where = f"row {index} (line {line})"
        if len(row) != len(COLUMNS):
            report.problems.append(
                Problem(
                    where,
                    f"has {len(row)} field(s), not the {len(COLUMNS)} of the header",
                )
            )
            continue
        rows.append((where, dict(zip(COLUMNS, row))))

    # A sheet made from another table is reported as that, not as 32 pair errors.
    stale = _check_source_checksums(rows, source)
    if stale:
        report.problems.extend(stale)
        return report

    answered: dict[int, str] = {}
    for where, cells in rows:
        pair, problems = _check_identity(where, cells, source)
        report.problems.extend(problems)
        if pair is None:
            continue
        if pair.number in answered:
            report.problems.append(
                Problem(
                    where,
                    f"repeats pair {pair.number}, already in "
                    f"{answered[pair.number]}",
                )
            )
            continue
        answered[pair.number] = where
        if problems:
            continue
        answer, problems = _check_review(where, pair.number, cells)
        report.problems.extend(problems)
        if answer is not None:
            report.answers.append(answer)
        elif not problems:
            report.blank.append(pair.number)

    report.omitted.extend(
        pair.number for pair in source.pairs if pair.number not in answered
    )
    return report


def main(argv: Sequence[str] | None = None) -> int:
    """Emit a blank answer sheet, or validate a returned one.

    Returns:
        0 when the command succeeded, 1 when a returned sheet was not accepted,
        and 2 when the pinned pair table itself could not be used.
    """
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("pairs", type=Path, help="pair table, tab-separated")
    common.add_argument(
        "--verdict",
        default=DEFAULT_VERDICT,
        help="verdict to review, read as the first word of the source verdict cell",
    )
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser(
        "template", parents=[common], help="write a blank answer TSV to stdout"
    )
    returned = commands.add_parser(
        "check", parents=[common], help="validate a returned answer TSV"
    )
    returned.add_argument("answers", type=Path, help="returned answer TSV")
    args = parser.parse_args(argv)

    try:
        source = load_source(args.pairs, args.verdict)
    except SourceError as error:
        print(error, file=sys.stderr)
        return 2
    if args.command == "template":
        sys.stdout.write(render_template(source))
        return 0

    try:
        data = args.answers.read_bytes()
    except OSError as error:
        print(f"cannot read answers {args.answers}: {error}", file=sys.stderr)
        return 2
    report = check_answers(source, data)
    if not report.ok:
        for problem in report.problems:
            print(problem, file=sys.stderr)
        print(
            f"{len(report.problems)} problem(s); nothing was accepted",
            file=sys.stderr,
        )
        return 1
    print(report.summary(source, args.answers))
    return 0


if __name__ == "__main__":
    sys.exit(main())
