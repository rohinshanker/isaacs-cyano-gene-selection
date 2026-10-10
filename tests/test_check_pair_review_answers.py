"""Tests for the escalated-pair answer template and checker."""

import csv
import hashlib
import io
import re
import runpy
import sys
from pathlib import Path

import pytest

from tools import check_pair_review_answers as checker

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/notes/handoff/cyano_package_D_pairs_20261004.tsv"
REVIEW_SHEET = ROOT / "docs/notes/handoff/cyano_escalated_pairs_review_20261005.md"

# The 32 pairs the pinned package D table escalates, in the review order
# ``tools/pair_review_sheet.py`` numbers them: the accession and condition-table
# row of each side.
ESCALATED = (
    ("GSE18902", 21, "GSE254350", 37),
    ("GSE225426", 31, "GSE59112", 55),
    ("GSE254350", 37, "GSE50908", 46),
    ("GSE254350", 37, "GSE50919", 47),
    ("GSE254350", 37, "GSE52486", 54),
    ("PXD005105", 59, "PXD074299", 78),
    ("PXD030282", 72, "PXD062851", 77),
    ("PXD030282", 74, "PXD062851", 77),
    ("GSE103462", 3, "GSE254350", 37),
    ("GSE103462", 3, "GSE327989", 40),
    ("GSE103462", 3, "GSE45762", 45),
    ("GSE103463", 4, "GSE254350", 37),
    ("GSE103463", 4, "GSE327989", 40),
    ("GSE103463", 4, "GSE45762", 45),
    ("GSE103644", 7, "GSE254350", 37),
    ("GSE103644", 7, "GSE327989", 40),
    ("GSE103644", 7, "GSE45762", 45),
    ("GSE103704", 8, "GSE254350", 37),
    ("GSE103704", 8, "GSE45762", 45),
    ("GSE104203", 11, "GSE254350", 37),
    ("GSE104203", 12, "GSE254350", 37),
    ("GSE105774", 16, "GSE254350", 37),
    ("GSE105774", 16, "GSE45762", 45),
    ("GSE140121", 19, "GSE327989", 40),
    ("GSE140121", 20, "GSE327989", 40),
    ("GSE140121", 19, "GSE45762", 45),
    ("GSE140121", 20, "GSE45762", 45),
    ("GSE140121", 19, "GSE59112", 55),
    ("GSE140121", 20, "GSE59112", 55),
    ("GSE254350", 37, "GSE89999", 57),
    ("GSE45762", 45, "GSE89999", 57),
    ("PXD062851", 77, "PXD074299", 78),
)


@pytest.fixture(scope="module")
def real_source():
    """The pinned package D pair table, read once."""
    return checker.load_source(SOURCE)


def make_source_row(artifact_a, artifact_b, verdict, passed, row_a=3, row_b=9):
    """Build one pair-table row with every column the checker reads."""
    return {
        "data_type": "transcriptomics",
        "artifact_a": artifact_a,
        "artifact_b": artifact_b,
        "condition_set_a": f"row {row_a} [control] temperature=30 °C ;; medium=BG-11",
        "condition_set_b": f"row {row_b} [dusk] temperature=30 °C ;; medium=BG-11",
        "verdict": verdict,
        "failing_or_marginal_axis": "light_intensity (narrow)",
        "axes_passed": f"{passed} of 6",
    }


def write_source(path, rows):
    """Write pair-table rows as the tab-separated source table."""
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]), delimiter="\t")
        writer.writeheader()
        writer.writerows(rows)
    return path


@pytest.fixture
def small_source(tmp_path):
    """A three-pair source table: two escalated pairs plus one that is not."""
    path = write_source(
        tmp_path / "pairs.tsv",
        [
            make_source_row("GSE2", "GSE9", "escalate", 2, row_a=5, row_b=6),
            make_source_row("GSE1", "GSE8", "not comparable", 5),
            make_source_row("GSE3", "GSE4", "escalate", 3, row_a=1, row_b=2),
        ],
    )
    return checker.load_source(path)


def answer_sheet(source, rows):
    """Render an answer sheet: ``rows`` maps a pair number to its review cells."""
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, delimiter="\t", lineterminator="\n")
    writer.writerow(checker.COLUMNS)
    pairs = source.by_number()
    for number, review in rows.items():
        cells = pairs[number].cells(source.sha256)
        writer.writerow(cells + [review.get(name, "") for name in checker.REVIEW_COLUMNS])
    return buffer.getvalue()


ANSWERED = {
    "decision": "share",
    "reviewer": "test reviewer",
    "date": "2026-10-10",
    "basis": "both sides are the same turbidostat",
}


def problems(report):
    """Return the report's problems as text, for substring assertions."""
    return [str(problem) for problem in report.problems]


# --- the pinned source table -------------------------------------------------


def test_load_source_identifies_the_32_escalated_pairs_in_review_order(real_source):
    assert real_source.sha256 == hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    assert real_source.verdict == "escalate"
    assert [
        (
            pair.artifact_a.split(" ")[0],
            pair.condition_row_a,
            pair.artifact_b.split(" ")[0],
            pair.condition_row_b,
        )
        for pair in real_source.pairs
    ] == list(ESCALATED)
    assert [pair.number for pair in real_source.pairs] == list(range(1, 33))
    first, last = real_source.pairs[0], real_source.pairs[-1]
    assert first.artifact_a == "GSE18902 (PCC 7942; transcriptomics (array))"
    assert first.artifact_b == "GSE254350 (PCC 7942; transcriptomics (RNA-seq))"
    assert last.artifact_b == "PXD074299 (PCC 7942; proteomics (LC-MS/MS))"


def test_review_order_matches_the_original_markdown_sheet(real_source):
    """The owner answered the Markdown sheet; the TSV must number pairs alike."""
    text = REVIEW_SHEET.read_text(encoding="utf-8")
    headings = re.findall(r"^## (\d+)\. (.+?) against (.+)$", text, re.MULTILINE)
    rows = re.findall(r"^- \*\*([AB]):\*\* condition table row (\d+), ", text, re.M)
    assert len(headings) == len(real_source.pairs)
    assert len(rows) == 2 * len(real_source.pairs)
    for pair, (number, artifact_a, artifact_b) in zip(real_source.pairs, headings):
        assert pair.number == int(number)
        assert pair.artifact_a == artifact_a
        assert pair.artifact_b == artifact_b
    for pair, (side_a, row_a), (side_b, row_b) in zip(
        real_source.pairs, rows[0::2], rows[1::2]
    ):
        assert (side_a, side_b) == ("A", "B")
        assert (pair.condition_row_a, pair.condition_row_b) == (int(row_a), int(row_b))


# The pairs of the pinned table that name the same two artifacts and differ only
# by a condition row, with the condition_set_a rows that tell them apart.
SHARED_ARTIFACT_GROUPS = (
    ((7, 8), (72, 74)),
    ((20, 21), (11, 12)),
    ((24, 25), (19, 20)),
    ((26, 27), (19, 20)),
    ((28, 29), (19, 20)),
)


@pytest.mark.parametrize(("numbers", "rows_a"), SHARED_ARTIFACT_GROUPS)
def test_load_source_keeps_distinct_pairs_that_share_both_artifacts(
    real_source, numbers, rows_a
):
    """These pairs differ only by a condition row, so both rows are identity."""
    pairs = real_source.by_number()
    first, second = pairs[numbers[0]], pairs[numbers[1]]
    assert first.artifact_a == second.artifact_a
    assert first.artifact_b == second.artifact_b
    assert first.condition_row_b == second.condition_row_b
    assert (first.condition_row_a, second.condition_row_a) == rows_a
    assert first.key != second.key


def test_the_pinned_table_has_exactly_these_shared_artifact_groups(real_source):
    """The documented groups are every group, counted from the table itself."""
    grouped = {}
    for pair in real_source.pairs:
        grouped.setdefault((pair.artifact_a, pair.artifact_b), []).append(pair.number)
    found = tuple(
        sorted(tuple(numbers) for numbers in grouped.values() if len(numbers) > 1)
    )
    assert found == tuple(numbers for numbers, _ in SHARED_ARTIFACT_GROUPS)
    assert len(found) == 5


def test_load_source_selects_a_verdict_by_its_first_word(small_source):
    """``select_pairs`` reads the verdict cell's first word, as the sheet does."""
    other = checker.load_source(small_source.path, "not")
    assert [pair.artifact_a for pair in other.pairs] == ["GSE1"]


def test_load_source_rejects_a_missing_file(tmp_path):
    with pytest.raises(checker.SourceError, match="cannot read pair table"):
        checker.load_source(tmp_path / "absent.tsv")


def test_load_source_rejects_bytes_that_are_not_utf8(tmp_path):
    path = tmp_path / "pairs.tsv"
    path.write_bytes(b"artifact_a\n\xff\xfe\n")
    with pytest.raises(checker.SourceError, match="not valid UTF-8"):
        checker.load_source(path)


def test_load_source_rejects_an_empty_table(tmp_path):
    path = tmp_path / "pairs.tsv"
    path.write_bytes(b"")
    with pytest.raises(checker.SourceError, match="no header row"):
        checker.load_source(path)


def test_load_source_rejects_a_missing_column(tmp_path):
    rows = [make_source_row("GSE1", "GSE2", "escalate", 2)]
    del rows[0]["condition_set_b"]
    path = write_source(tmp_path / "pairs.tsv", rows)
    with pytest.raises(checker.SourceError, match="missing column\\(s\\): condition_set_b"):
        checker.load_source(path)


@pytest.mark.parametrize(
    ("row", "expected"),
    [
        ("GSE1\tGSE2", "data row 1 (line 2) has 2 field(s), not the 6 of its header"),
        (
            "\t".join(["x"] * 7),
            "data row 1 (line 2) has 7 field(s), not the 6 of its header",
        ),
        ("", "data row 1 (line 2) has 0 field(s), not the 6 of its header"),
    ],
)
def test_load_source_rejects_a_row_that_is_not_the_header_width(
    tmp_path, row, expected
):
    """A checksum fixes the bytes; only the widths show the record boundaries."""
    path = tmp_path / "pairs.tsv"
    path.write_text(
        "\t".join(checker.SOURCE_COLUMNS) + "\n" + row + "\n", encoding="utf-8"
    )
    with pytest.raises(checker.SourceError, match=re.escape(expected)):
        checker.load_source(path)


def test_load_source_rejects_a_column_the_table_names_twice(tmp_path):
    """A duplicate header silently overwrote one of the two values."""
    path = tmp_path / "pairs.tsv"
    header = list(checker.SOURCE_COLUMNS) + ["artifact_a"]
    path.write_text(
        "\t".join(header)
        + "\nGSE1\tGSE2\trow 1 [a] temperature=30\trow 2 [b] temperature=30"
        "\tescalate\t2 of 6\tWRONG\n",
        encoding="utf-8",
    )
    with pytest.raises(
        checker.SourceError, match="names column\\(s\\) more than once: artifact_a"
    ):
        checker.load_source(path)


def test_load_source_rejects_an_unnamed_header_column(tmp_path):
    path = tmp_path / "pairs.tsv"
    path.write_text(
        "\t".join(checker.SOURCE_COLUMNS) + "\t \n" + "\t".join(["x"] * 7) + "\n",
        encoding="utf-8",
    )
    with pytest.raises(checker.SourceError, match="leaves header column\\(s\\) 7 unnamed"):
        checker.load_source(path)


def test_load_source_keeps_columns_the_review_does_not_read(tmp_path, small_source):
    """The real table has sixteen columns; the extra ones are legitimate."""
    rows = [make_source_row("GSE1", "GSE2", "escalate", 2)]
    rows[0]["source_a"] = "package B data row 58"
    rows[0]["notes"] = "kept, unread"
    source = checker.load_source(write_source(tmp_path / "pairs.tsv", rows))
    assert [pair.artifact_a for pair in source.pairs] == ["GSE1"]


def test_load_source_rejects_a_quoted_field_that_runs_past_its_record(tmp_path):
    """An unclosed quote would otherwise swallow the next pair's whole line."""
    path = tmp_path / "pairs.tsv"
    header = "\t".join(checker.SOURCE_COLUMNS) + "\tsource_a\n"
    body = (
        "GSE1\tGSE2\trow 1 [a] temperature=30\trow 2 [b] temperature=30"
        '\tescalate\t2 of 6\t"package B'
        "\nGSE3\tGSE4\trow 3 [a] temperature=30\trow 4 [b] temperature=30"
        '\tescalate\t2 of 6\tpackage B"\n'
    )
    path.write_text(header + body, encoding="utf-8")
    with pytest.raises(
        checker.SourceError, match="starts on line 2 and ends on line 3"
    ):
        checker.load_source(path)
    assert len(path.read_text(encoding="utf-8").splitlines()) == 3


def test_load_source_rejects_a_quoted_field_left_open_at_the_end(tmp_path):
    path = tmp_path / "pairs.tsv"
    path.write_text(
        "\t".join(checker.SOURCE_COLUMNS)
        + '\nGSE1\t"GSE2\trow 1 [a] temperature=30\n',
        encoding="utf-8",
    )
    with pytest.raises(checker.SourceError, match="cannot be read as TSV at line 2"):
        checker.load_source(path)


# --- rejected source identities and ordering fields --------------------------


@pytest.mark.parametrize("artifact", ["", "   "])
def test_load_source_rejects_a_pair_with_a_blank_artifact(tmp_path, artifact):
    """A blank artifact would generate an identity that identifies nothing."""
    rows = [make_source_row(artifact, "GSE2", "escalate", 2)]
    path = write_source(tmp_path / "pairs.tsv", rows)
    with pytest.raises(
        checker.SourceError, match="pair 1, data row 1 \\(line 2\\) has no artifact_a"
    ):
        checker.load_source(path)


@pytest.mark.parametrize("name", ["condition_set_a", "condition_set_b"])
def test_load_source_rejects_a_condition_row_below_one(tmp_path, name):
    """``row 0`` is no row of the condition table, so it identifies nothing."""
    rows = [make_source_row("GSE1", "GSE2", "escalate", 2)]
    rows[0][name] = "row 0 [control] temperature=30 °C"
    path = write_source(tmp_path / "pairs.tsv", rows)
    with pytest.raises(
        checker.SourceError,
        match=f"pair 1, data row 1 \\(line 2\\) gives {name} the condition-table row 0",
    ):
        checker.load_source(path)


@pytest.mark.parametrize(
    "cell", ["oops", "", "7 of 6", "2 of 5", " 2 of 6", "2 of 6 ", "02 of 6", "2of6"]
)
def test_load_source_rejects_an_axes_passed_cell_the_order_cannot_read(tmp_path, cell):
    """``select_pairs`` sorts on this cell, and would raise on these."""
    rows = [make_source_row("GSE1", "GSE2", "escalate", 2)]
    rows[0]["axes_passed"] = cell
    path = write_source(tmp_path / "pairs.tsv", rows)
    with pytest.raises(checker.SourceError, match="has axes_passed"):
        checker.load_source(path)


@pytest.mark.parametrize("count", range(7))
def test_load_source_reads_every_count_of_the_six_screened_axes(tmp_path, count):
    rows = [make_source_row("GSE1", "GSE2", "escalate", count)]
    source = checker.load_source(write_source(tmp_path / "pairs.tsv", rows))
    assert source.pairs[0].number == 1


def test_load_source_rejects_a_bad_axes_passed_on_an_unselected_row(tmp_path):
    """The whole table is the scoring output, not only the escalated rows."""
    rows = [
        make_source_row("GSE1", "GSE2", "escalate", 2),
        make_source_row("GSE3", "GSE4", "not comparable", 1),
    ]
    rows[1]["axes_passed"] = "one"
    path = write_source(tmp_path / "pairs.tsv", rows)
    with pytest.raises(checker.SourceError, match="data row 2 \\(line 3\\) has axes_passed"):
        checker.load_source(path)


def test_load_source_rejects_an_unreadable_condition_set(tmp_path):
    rows = [make_source_row("GSE1", "GSE2", "escalate", 2)]
    rows[0]["condition_set_b"] = "GSE2 control"
    path = write_source(tmp_path / "pairs.tsv", rows)
    with pytest.raises(
        checker.SourceError,
        match="pair 1, data row 1 \\(line 2\\) has an unreadable condition_set_b",
    ):
        checker.load_source(path)


def test_load_source_rejects_a_table_with_no_escalated_pair(tmp_path):
    path = write_source(
        tmp_path / "pairs.tsv", [make_source_row("GSE1", "GSE2", "not comparable", 5)]
    )
    with pytest.raises(checker.SourceError, match="no pair with verdict 'escalate'"):
        checker.load_source(path)


def test_load_source_rejects_two_pairs_with_one_identity(tmp_path):
    rows = [
        make_source_row("GSE1", "GSE2", "escalate", 2),
        make_source_row("GSE1", "GSE2", "escalate", 2),
    ]
    rows[1]["data_type"] = "proteomics"
    path = write_source(tmp_path / "pairs.tsv", rows)
    with pytest.raises(checker.SourceError, match="identifies pair 2 exactly like pair 1"):
        checker.load_source(path)


# --- the blank template ------------------------------------------------------


def test_template_writes_identity_cells_and_empty_review_cells(small_source):
    lines = checker.render_template(small_source).splitlines()
    assert lines[0] == "\t".join(checker.COLUMNS)
    assert lines[1] == "\t".join(
        [small_source.sha256, "1", "GSE3", "GSE4", "1", "2", "", "", "", "", ""]
    )
    assert lines[2].split("\t")[1:6] == ["2", "GSE2", "GSE9", "5", "6"]
    assert len(lines) == 3


def test_template_is_deterministic_and_newline_only(real_source):
    first = checker.render_template(real_source)
    assert first == checker.render_template(real_source)
    assert "\r" not in first
    assert len(first.splitlines()) == 33


def test_template_round_trips_as_an_all_pending_sheet(real_source):
    report = checker.check_answers(
        real_source, checker.render_template(real_source).encode("utf-8")
    )
    assert report.ok, problems(report)
    assert report.answers == []
    assert report.blank == list(range(1, 33))
    assert report.omitted == []


# --- valid returned sheets ---------------------------------------------------


def test_every_decision_is_accepted_and_counted_apart(small_source, tmp_path):
    source = checker.load_source(
        write_source(
            tmp_path / "four.tsv",
            [
                make_source_row(f"GSE{index}", "GSE9", "escalate", 2, row_a=index)
                for index in range(1, 6)
            ],
        )
    )
    sheet = answer_sheet(
        source,
        {
            1: {**ANSWERED, "decision": "share"},
            2: {**ANSWERED, "decision": "separate"},
            3: {**ANSWERED, "decision": "conditional", "condition": "only at 30 °C"},
            4: {**ANSWERED, "decision": "undecided"},
            5: {},
        },
    )
    report = checker.check_answers(source, sheet.encode("utf-8"))
    assert report.ok, problems(report)
    assert report.counts() == {
        "share": 1,
        "separate": 1,
        "conditional": 1,
        "undecided": 1,
    }
    assert report.blank == [5]
    assert report.omitted == []
    summary = report.summary(source, tmp_path / "answers.tsv")
    assert "decided: 3 (share 1, separate 1, conditional 1)" in summary
    assert "explicitly undecided: 1" in summary
    assert "blank (row present, no answer): 1 — pairs 5" in summary
    assert "omitted (no row): 0" in summary
    assert "pending: 1 of 5" in summary
    assert "admission" in summary


def test_an_omitted_pair_is_pending_and_named(small_source):
    sheet = answer_sheet(small_source, {2: dict(ANSWERED)})
    report = checker.check_answers(small_source, sheet.encode("utf-8"))
    assert report.ok, problems(report)
    assert [answer.pair for answer in report.answers] == [2]
    assert report.blank == []
    assert report.omitted == [1]
    assert "omitted (no row): 1 — pairs 1" in report.summary(small_source, Path("a.tsv"))


def test_a_header_only_sheet_is_valid_and_wholly_pending(small_source):
    report = checker.check_answers(
        small_source, ("\t".join(checker.COLUMNS) + "\n").encode("utf-8")
    )
    assert report.ok, problems(report)
    assert report.omitted == [1, 2]
    summary = report.summary(small_source, Path("a.tsv"))
    assert "no answer was recorded; this is not a completed review" in summary


def test_rows_may_arrive_in_any_order(small_source):
    sheet = answer_sheet(small_source, {2: dict(ANSWERED), 1: dict(ANSWERED)})
    report = checker.check_answers(small_source, sheet.encode("utf-8"))
    assert report.ok, problems(report)
    assert [answer.pair for answer in report.answers] == [2, 1]


def test_free_text_cells_keep_their_tabs_quotes_and_line_breaks(small_source):
    basis = 'he said "same lamp"\tand the 12:12 regime\nmatches row 5'
    condition = "only while\tthe CO₂ stays at 1%"
    sheet = answer_sheet(
        small_source,
        {
            1: {
                **ANSWERED,
                "decision": "conditional",
                "basis": basis,
                "condition": condition,
            }
        },
    )
    report = checker.check_answers(small_source, sheet.encode("utf-8"))
    assert report.ok, problems(report)
    assert report.answers[0].basis == basis
    assert report.answers[0].condition == condition


def test_surrounding_whitespace_is_ignored_on_the_exact_fields(small_source):
    sheet = answer_sheet(
        small_source,
        {1: {**ANSWERED, "decision": " share ", "date": "\t2026-10-10 "}},
    )
    report = checker.check_answers(small_source, sheet.encode("utf-8"))
    assert report.ok, problems(report)
    assert report.answers[0].decision == "share"
    assert report.answers[0].date == "2026-10-10"


def test_whitespace_only_review_cells_are_still_pending(small_source):
    sheet = answer_sheet(
        small_source, {1: {name: "  " for name in checker.REVIEW_COLUMNS}}
    )
    report = checker.check_answers(small_source, sheet.encode("utf-8"))
    assert report.ok, problems(report)
    assert report.blank == [1]


def test_a_byte_order_mark_and_crlf_endings_are_accepted(small_source):
    sheet = answer_sheet(small_source, {1: dict(ANSWERED)}).replace("\n", "\r\n")
    report = checker.check_answers(small_source, ("﻿" + sheet).encode("utf-8"))
    assert report.ok, problems(report)
    assert [answer.pair for answer in report.answers] == [1]


# --- rejected identities -----------------------------------------------------


def test_a_stale_source_checksum_is_rejected(small_source):
    sheet = answer_sheet(small_source, {1: dict(ANSWERED)}).replace(
        small_source.sha256, "0" * 64
    )
    report = checker.check_answers(small_source, sheet.encode("utf-8"))
    assert not report.ok
    assert problems(report) == [
        f"row 1 (line 2): source_sha256 '{'0' * 64}' is not the checksum of "
        f"{small_source.path} ({small_source.sha256}); the sheet was made from "
        "another table, or the table changed"
    ]


def test_a_stale_checksum_is_reported_once_for_the_whole_sheet(small_source):
    """One wrong table is one problem, not one per row, and nothing else is read."""
    sheet = answer_sheet(
        small_source,
        {1: {**ANSWERED, "decision": "maybe"}, 2: {**ANSWERED, "date": "nope"}},
    ).replace(small_source.sha256, "0" * 64)
    report = checker.check_answers(small_source, sheet.encode("utf-8"))
    assert len(report.problems) == 1
    assert "and the same in 1 further row(s)" in problems(report)[0]


def test_a_ragged_row_does_not_hide_the_other_rows_problems(small_source):
    sheet = answer_sheet(
        small_source, {1: {**ANSWERED, "decision": "maybe"}, 2: dict(ANSWERED)}
    ).splitlines()
    sheet[2] = sheet[2].rsplit("\t", 1)[0]
    report = checker.check_answers(small_source, ("\n".join(sheet) + "\n").encode("utf-8"))
    assert [problem.where for problem in report.problems] == [
        "row 2 (line 3)",
        "row 1 (line 2)",
    ]
    assert "has 10 field(s)" in problems(report)[0]
    assert "is not one of share" in problems(report)[1]


def test_a_changed_artifact_or_condition_row_is_rejected(small_source):
    sheet = answer_sheet(small_source, {1: dict(ANSWERED)})
    changed = sheet.replace("\tGSE3\tGSE4\t1\t2\t", "\tGSE3\tGSE5\t1\t7\t")
    report = checker.check_answers(small_source, changed.encode("utf-8"))
    assert [problem.message.split(" ")[0] for problem in report.problems] == [
        "artifact_b",
        "condition_row_b",
    ]
    assert "is not pair 1's 'GSE4'" in problems(report)[0]


def test_a_changed_a_side_identity_is_rejected_too(small_source):
    sheet = answer_sheet(small_source, {1: dict(ANSWERED)})
    changed = sheet.replace("\tGSE3\tGSE4\t1\t2\t", "\tGSE7\tGSE4\t4\t2\t")
    report = checker.check_answers(small_source, changed.encode("utf-8"))
    assert [problem.message.split(" ")[0] for problem in report.problems] == [
        "artifact_a",
        "condition_row_a",
    ]


def test_a_long_identity_cell_is_shortened_in_the_message(small_source):
    sheet = answer_sheet(small_source, {1: dict(ANSWERED)})
    changed = sheet.replace("\tGSE3\tGSE4\t", "\t" + "G" * 200 + "\tGSE4\t")
    report = checker.check_answers(small_source, changed.encode("utf-8"))
    assert problems(report)[0].startswith("row 1 (line 2): artifact_a '" + "G" * 80 + "\u2026'")
    assert "G" * 81 not in problems(report)[0]


@pytest.mark.parametrize(
    "pair_cell",
    ["0", "-1", "+1", "True", "true", "01", " 1", "1 ", "1.0", "one", "", "³"],
)
def test_a_pair_number_must_be_a_plain_positive_integer(small_source, pair_cell):
    sheet = answer_sheet(small_source, {1: dict(ANSWERED)})
    rows = sheet.splitlines()
    cells = rows[1].split("\t")
    cells[1] = pair_cell
    report = checker.check_answers(
        small_source, "\n".join([rows[0], "\t".join(cells)]).encode("utf-8")
    )
    assert not report.ok
    assert "is not a pair number written as 1 to 2" in problems(report)[0]
    assert report.omitted == [1, 2]


def test_a_pair_number_outside_the_table_is_rejected(small_source):
    sheet = answer_sheet(small_source, {1: dict(ANSWERED)})
    rows = sheet.splitlines()
    cells = rows[1].split("\t")
    cells[1] = "33"
    report = checker.check_answers(
        small_source, "\n".join([rows[0], "\t".join(cells)]).encode("utf-8")
    )
    assert "pair '33' is not in" in problems(report)[0]
    assert "escalates pairs 1 to 2" in problems(report)[0]


def test_a_pair_number_of_thousands_of_digits_is_a_row_error_not_a_traceback(
    small_source,
):
    """CPython will not convert 5,000 digits; the cell is reported instead."""
    sheet = answer_sheet(small_source, {1: dict(ANSWERED)})
    rows = sheet.splitlines()
    cells = rows[1].split("\t")
    cells[1] = "1" * 5000
    report = checker.check_answers(
        small_source, "\n".join([rows[0], "\t".join(cells)]).encode("utf-8")
    )
    assert not report.ok
    assert len(problems(report)) == 1
    assert "is not in" in problems(report)[0]
    assert len(problems(report)[0]) < 300


def test_a_repeated_pair_is_rejected(small_source):
    sheet = answer_sheet(small_source, {1: dict(ANSWERED)})
    rows = sheet.splitlines()
    report = checker.check_answers(
        small_source, "\n".join(rows + [rows[1]]).encode("utf-8")
    )
    assert not report.ok
    assert problems(report) == ["row 2 (line 3): repeats pair 1, already in row 1 (line 2)"]


# --- rejected structure ------------------------------------------------------


@pytest.mark.parametrize(
    ("header", "expected"),
    [
        ("\t".join(checker.COLUMNS + ("comment",)), "unexpected column(s): comment"),
        ("\t".join(checker.COLUMNS[:-1]), "missing column(s): condition"),
        (
            "\t".join(checker.COLUMNS + ("decision",)),
            "duplicate column(s): decision",
        ),
        (
            "\t".join(checker.COLUMNS[1:] + checker.COLUMNS[:1]),
            "columns out of order",
        ),
    ],
)
def test_the_header_must_name_each_column_once_in_order(small_source, header, expected):
    report = checker.check_answers(small_source, (header + "\n").encode("utf-8"))
    assert not report.ok
    assert any(expected in text for text in problems(report)), problems(report)


@pytest.mark.parametrize("fields", [10, 12, 0])
def test_a_ragged_row_is_rejected(small_source, fields):
    header = "\t".join(checker.COLUMNS)
    report = checker.check_answers(
        small_source, (header + "\n" + "\t".join([""] * fields) + "\n").encode("utf-8")
    )
    assert not report.ok
    assert f"has {fields} field(s), not the 11 of the header" in problems(report)[0]


def test_a_bare_quote_in_an_unquoted_cell_is_kept_as_the_text_it_is(small_source):
    """Python's TSV dialect reads a quote inside an unquoted cell literally.

    The checker accepts that rather than parsing TSV itself, so free text with
    one quotation mark in it survives a round trip unchanged.
    """
    basis = 'synthetic "unclosed basis'
    header = "\t".join(checker.COLUMNS)
    cells = small_source.by_number()[1].cells(small_source.sha256) + [
        "share",
        "test reviewer",
        "2026-10-10",
        basis,
        "",
    ]
    # Written by hand: ``csv`` would quote and escape the cell on the way out.
    report = checker.check_answers(
        small_source, (header + "\n" + "\t".join(cells) + "\n").encode("utf-8")
    )
    assert report.ok, problems(report)
    assert [answer.basis for answer in report.answers] == [basis]


def test_a_quoted_cell_that_is_never_closed_is_rejected(small_source):
    """An opening quote is the one place a stray quote changes the record."""
    header = "\t".join(checker.COLUMNS)
    cells = small_source.by_number()[1].cells(small_source.sha256) + [
        "share",
        "test reviewer",
        "2026-10-10",
        '"synthetic unclosed basis',
        "",
    ]
    report = checker.check_answers(
        small_source, (header + "\n" + "\t".join(cells) + "\n").encode("utf-8")
    )
    assert not report.ok
    assert "cannot be read as TSV" in problems(report)[0]


def test_broken_quoting_is_rejected_with_its_line(small_source):
    header = "\t".join(checker.COLUMNS)
    row = "\t".join([small_source.sha256, '1"x', "GSE3", "GSE4", "1", "2"] + [""] * 5)
    report = checker.check_answers(
        small_source, (header + "\n" + '"a"b\tc\n' + row + "\n").encode("utf-8")
    )
    assert not report.ok
    assert problems(report)[0].startswith("line 2: cannot be read as TSV")


def test_bytes_that_are_not_utf8_are_rejected(small_source):
    report = checker.check_answers(small_source, b"source_sha256\n\xff\n")
    assert not report.ok
    assert "not valid UTF-8 at byte 14" in problems(report)[0]


@pytest.mark.parametrize("data", [b"", b"\n  \n"])
def test_an_empty_sheet_is_rejected_rather_than_read_as_all_pending(small_source, data):
    report = checker.check_answers(small_source, data)
    assert not report.ok
    assert "empty; a returned sheet carries the template's header row" in problems(report)[0]


# --- rejected review metadata ------------------------------------------------


@pytest.mark.parametrize(
    "decision", ["Share", "SEPARATE", "may share", "maybe", "yes", "share "[:-1] + "s"]
)
def test_only_the_exact_decision_words_are_read(small_source, decision):
    sheet = answer_sheet(small_source, {1: {**ANSWERED, "decision": decision}})
    report = checker.check_answers(small_source, sheet.encode("utf-8"))
    assert not report.ok
    assert "is not one of share, separate, conditional, undecided" in problems(report)[0]
    assert report.answers == []


def test_metadata_without_a_decision_is_an_error_not_a_pending_pair(small_source):
    sheet = answer_sheet(
        small_source,
        {1: {"reviewer": "test reviewer", "date": "2026-10-10", "basis": "same lamp"}},
    )
    report = checker.check_answers(small_source, sheet.encode("utf-8"))
    assert not report.ok
    assert "reviewer, date, basis filled in without a decision" in problems(report)[0]
    assert report.blank == []


@pytest.mark.parametrize("name", ["reviewer", "basis"])
def test_an_answered_pair_needs_a_reviewer_and_a_basis(small_source, name):
    sheet = answer_sheet(small_source, {1: {**ANSWERED, name: " "}})
    report = checker.check_answers(small_source, sheet.encode("utf-8"))
    assert problems(report) == [f"row 1 (line 2): {name} is empty on an answered pair"]


@pytest.mark.parametrize(
    "date",
    [
        "",
        "2026-13-01",
        "2026-02-29",
        "2026-00-10",
        "2026-10-32",
        "20261010",
        "2026-2-9",
        "10/10/2026",
        "2026-10-10T00:00",
        "yesterday",
        "٢٠٢٦-١٠-١٠",
    ],
)
def test_a_date_must_be_a_real_iso_calendar_day(small_source, date):
    sheet = answer_sheet(small_source, {1: {**ANSWERED, "date": date}})
    report = checker.check_answers(small_source, sheet.encode("utf-8"))
    assert not report.ok
    assert "is not a real calendar date written YYYY-MM-DD" in problems(report)[0]


@pytest.mark.parametrize("date", ["2024-02-29", "2000-02-29", "2026-12-31"])
def test_real_leap_and_boundary_days_are_accepted(small_source, date):
    sheet = answer_sheet(small_source, {1: {**ANSWERED, "date": date}})
    report = checker.check_answers(small_source, sheet.encode("utf-8"))
    assert report.ok, problems(report)
    assert report.answers[0].date == date


def test_a_conditional_decision_needs_its_condition(small_source):
    sheet = answer_sheet(small_source, {1: {**ANSWERED, "decision": "conditional"}})
    report = checker.check_answers(small_source, sheet.encode("utf-8"))
    assert not report.ok
    assert "a conditional decision needs the condition it holds under" in problems(report)[0]


@pytest.mark.parametrize("decision", ["share", "separate", "undecided"])
def test_a_condition_is_never_silently_dropped_from_another_call(small_source, decision):
    sheet = answer_sheet(
        small_source,
        {1: {**ANSWERED, "decision": decision, "condition": "only at 30 °C"}},
    )
    report = checker.check_answers(small_source, sheet.encode("utf-8"))
    assert not report.ok
    assert f"beside a {decision!r} decision, which does not keep one" in problems(report)[0]


def test_an_undecided_answer_still_needs_reviewer_date_and_basis(small_source):
    sheet = answer_sheet(
        small_source, {1: {"decision": "undecided", "reviewer": "test reviewer"}}
    )
    report = checker.check_answers(small_source, sheet.encode("utf-8"))
    assert [problem.message for problem in report.problems] == [
        "basis is empty on an answered pair",
        "date '' is not a real calendar date written YYYY-MM-DD",
    ]


def test_every_problem_in_a_sheet_is_reported_at_once(small_source):
    sheet = answer_sheet(
        small_source,
        {
            1: {**ANSWERED, "decision": "Share"},
            2: {**ANSWERED, "date": "2026-02-29", "reviewer": ""},
        },
    )
    report = checker.check_answers(small_source, sheet.encode("utf-8"))
    assert len(report.problems) == 3
    assert [problem.where for problem in report.problems] == [
        "row 1 (line 2)",
        "row 2 (line 3)",
        "row 2 (line 3)",
    ]


# --- the field helpers -------------------------------------------------------


@pytest.mark.parametrize(
    ("text", "expected"),
    [("1", True), ("32", True), ("9" * 5000, True), ("0", False), ("01", False),
     ("", False), ("³", False), ("-1", False), ("1_0", False), ("1.0", False),
     (" 1", False), ("１", False)],
)
def test_is_canonical_int_accepts_only_plain_positive_decimals(text, expected):
    assert checker.is_canonical_int(text) is expected


@pytest.mark.parametrize(
    ("text", "expected"),
    [("2026-10-10", True), ("2024-02-29", True), ("2023-02-29", False),
     ("1900-02-29", False), ("2026-10-10 ", False), ("2026-1-10", False),
     ("+026-10-10", False), ("0001-01-01", True)],
)
def test_is_calendar_date_checks_the_format_and_the_calendar(text, expected):
    assert checker.is_calendar_date(text) is expected


# --- the command line --------------------------------------------------------


def fingerprint(path):
    """Capture a file's bytes and modification time."""
    return path.read_bytes(), path.stat().st_mtime_ns


def test_cli_template_writes_the_sheet_to_stdout_and_touches_no_file(
    small_source, capsys, tmp_path
):
    before = fingerprint(small_source.path)
    assert checker.main(["template", str(small_source.path)]) == 0
    captured = capsys.readouterr()
    assert captured.out == checker.render_template(small_source)
    assert captured.err == ""
    assert fingerprint(small_source.path) == before
    assert sorted(item.name for item in tmp_path.iterdir()) == ["pairs.tsv"]


def test_cli_check_reports_the_summary_and_leaves_both_inputs_alone(
    small_source, capsys, tmp_path
):
    answers = tmp_path / "answers.tsv"
    answers.write_text(answer_sheet(small_source, {1: dict(ANSWERED)}), encoding="utf-8")
    before = (fingerprint(small_source.path), fingerprint(answers))
    assert checker.main(["check", str(small_source.path), str(answers)]) == 0
    captured = capsys.readouterr()
    assert f"source {small_source.path} sha256 {small_source.sha256}" in captured.out
    assert "decided: 1 (share 1, separate 0, conditional 0)" in captured.out
    assert captured.err == ""
    assert (fingerprint(small_source.path), fingerprint(answers)) == before


def test_cli_check_fails_with_the_problems_on_stderr(small_source, capsys, tmp_path):
    answers = tmp_path / "answers.tsv"
    answers.write_text(
        answer_sheet(small_source, {1: {**ANSWERED, "decision": "maybe"}}),
        encoding="utf-8",
    )
    assert checker.main(["check", str(small_source.path), str(answers)]) == 1
    captured = capsys.readouterr()
    assert captured.out == ""
    assert "is not one of share, separate, conditional, undecided" in captured.err
    assert "1 problem(s); nothing was accepted" in captured.err


def test_cli_reports_an_unusable_source_table_apart_from_a_bad_sheet(capsys, tmp_path):
    answers = tmp_path / "answers.tsv"
    answers.write_text("x\n", encoding="utf-8")
    assert checker.main(["check", str(tmp_path / "absent.tsv"), str(answers)]) == 2
    assert "cannot read pair table" in capsys.readouterr().err


def test_cli_reports_an_unreadable_answer_file(small_source, capsys, tmp_path):
    missing = tmp_path / "absent.tsv"
    assert checker.main(["check", str(small_source.path), str(missing)]) == 2
    assert f"cannot read answers {missing}" in capsys.readouterr().err


def test_cli_requires_a_subcommand(small_source):
    with pytest.raises(SystemExit) as exit_info:
        checker.main([str(small_source.path)])
    assert exit_info.value.code == 2


def test_cli_passes_the_verdict_through(small_source, capsys):
    assert (
        checker.main(["template", str(small_source.path), "--verdict", "not"])
        == 0
    )
    assert "\tGSE1\tGSE8\t" in capsys.readouterr().out


def test_script_entry_point_exits_with_main_status(small_source, monkeypatch, capsys):
    monkeypatch.setattr(
        sys, "argv", ["check_pair_review_answers.py", "template", str(small_source.path)]
    )
    with pytest.raises(SystemExit) as exit_info:
        runpy.run_path(
            str(ROOT / "tools/check_pair_review_answers.py"), run_name="__main__"
        )
    assert exit_info.value.code == 0
    assert capsys.readouterr().out == checker.render_template(small_source)
