"""Tests for tools/check_addendum_quotes.py over synthetic texts and addenda."""

import csv
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

import check_addendum_quotes as checker  # noqa: E402

COLUMNS = ["strain", "assay", "conditions", "replicates", "licence", "artifact", "status", "source"]


def write_addendum(path, rows):
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS, delimiter="\t")
        writer.writeheader()
        for row in rows:
            writer.writerow({column: row.get(column, "") for column in COLUMNS})


def texts_dir(tmp_path):
    directory = tmp_path / "texts"
    directory.mkdir()
    (directory / "paper_main.txt").write_text(
        "Cells were grown at 30 °C under\n  cool ﬂuorescent light.\nThree biological replicates.\n", encoding="utf-8")
    (directory / "paper_supp.txt").write_text("Strain | Time | Count\nWT | dawn | 12\n", encoding="utf-8")
    return directory


def test_normalise_collapses_whitespace_and_compatibility_forms():
    assert checker.normalise("cool  ﬂuorescent\n light ") == "cool fluorescent light"
    # A symbol glyph a PDF extraction turns into a control byte is dropped, not kept as a word.
    assert checker.normalise("at 30\x03 C and 40 mE m\x012 s\x011") == "at 30 C and 40 mE m2 s1"


def test_every_quote_is_matched_in_its_named_document(tmp_path):
    addendum = tmp_path / "addendum.tsv"
    write_addendum(addendum, [{
        "conditions": 'CONDITION SET: x ;; temperature = 30 °C [paper Methods (paper_main); quote: "grown at 30 °C under cool fluorescent light"]',
        "replicates": 'three [paper (paper_main) Methods; quote: "Three biological replicates."]',
        "licence": 'ARTICLE TERMS = table [supplement (paper_supp) Table S1; quote: "Strain | Time | Count || WT | dawn | 12"]',
    }])
    findings = checker.check_file(addendum, texts_dir(tmp_path))
    assert [(f.row, f.column, f.doc, f.ok) for f in findings] == [
        (1, "conditions", "paper_main", True), (1, "replicates", "paper_main", True), (1, "licence", "paper_supp", True),
    ]


def test_each_failure_names_its_reason(tmp_path):
    addendum = tmp_path / "addendum.tsv"
    write_addendum(addendum, [{
        "conditions": 'a [no key here; quote: "grown at 30"] ;; '
                      'b [see (missing_doc); quote: "grown at 30"] ;; '
                      'c [paper (paper_main); quote: "grown at 25 °C"] ;; '
                      'd [supp (paper_supp); quote: "Strain | Time | Count || WT | dusk | 12"]',
    }])
    findings = checker.check_file(addendum, texts_dir(tmp_path))
    assert [f.ok for f in findings] == [False, False, False, False]
    assert findings[0].reason == "location names no document key"
    assert findings[1].reason == "no text file missing_doc.txt"
    assert findings[2].reason.startswith("not found: 'grown at 25")
    assert findings[3].reason.startswith("not found: 'WT | dusk | 12")


def test_main_reports_counts_and_exit_codes(tmp_path, capsys):
    addendum = tmp_path / "addendum.tsv"
    write_addendum(addendum, [{"conditions": 'x [paper (paper_main); quote: "Three biological replicates."]'}])
    assert checker.main([str(addendum), "--texts", str(texts_dir(tmp_path))]) == 0
    assert capsys.readouterr().out.strip() == "1 of 1 quotations matched"
    write_addendum(addendum, [{"conditions": 'x [paper (paper_main); quote: "nowhere"]'}])
    assert checker.main([str(addendum), "--texts", str(tmp_path / "texts")]) == 1
    out = capsys.readouterr().out
    assert "row 1 conditions (paper_main): not found: 'nowhere'" in out
    assert "0 of 1 quotations matched" in out
    # An addendum with nothing to check is not a pass.
    write_addendum(addendum, [{"conditions": "no citations at all"}])
    assert checker.main([str(addendum), "--texts", str(tmp_path / "texts")]) == 1
