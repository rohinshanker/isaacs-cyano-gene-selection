"""Synthetic analyzed TSVs test preservation, conservative evidence and rollback."""

import csv
from contextlib import contextmanager
import gzip
import hashlib
import io
import json
from pathlib import Path
import runpy
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import pxd044412_peptides as peptides  # noqa: E402


def source_row(**changes):
    row = dict.fromkeys(peptides.HEADERS, "NA")
    row.update({
        "organism": "pcc7942", "Label": "FBP_1", "Entry": "P12345",
        "PeptideSequence": "PEPTIDE", "BioReplicate": "1", "ambig": "no",
        "Sign": "Unsign", "log2FC": "0", "SE": "0.2", "Tvalue": "0",
        "DF": "9", "pvalue": "1", "adj.pvalue": "1",
        "MissingPercentage": "0.25", "ImputationPercentage": "0",
    })
    row.update(changes)
    return row


def make_source(tmp_path, rows=None, *, headers=peptides.HEADERS, payload=None):
    source = tmp_path / "source.tsv"
    if payload is None:
        stream = io.StringIO(newline="")
        writer = csv.writer(stream, delimiter="\t", lineterminator="\n")
        writer.writerow(headers)
        for row in [source_row()] if rows is None else rows:
            writer.writerow([row[name] for name in peptides.HEADERS])
        payload = stream.getvalue().encode("utf-8")
    source.write_bytes(payload)
    return source, hashlib.sha256(payload).hexdigest()


def report(tmp_path, rows=None):
    source, pin = make_source(tmp_path, rows)
    output = tmp_path / "bundle"
    document = peptides.write_report(source, output, expected_sha256=pin)
    with gzip.open(output / "rows.jsonl.gz", "rt", encoding="utf-8") as stream:
        preserved = [json.loads(line) for line in stream]
    assert json.loads((output / "summary.json").read_text()) == json.loads(json.dumps(document))
    return document, preserved


def test_lossless_cells_typed_statistics_and_line_references(tmp_path):
    original = source_row(**{
        "Protein names": '  literal "quote"\tannotation\nnext line  ',
        "Function [CC]": '=HYPERLINK("https://example.org", "text")',
        "Gene names  (synonym )": "", "Length": "000123",
    })
    doc, rows = report(tmp_path, [original, source_row(PeptideSequence="OTHER")])
    assert rows[0]["cells"] == [original[name] for name in peptides.HEADERS]
    assert rows[0]["statistics"]["log2FC"] == {"value": 0.0, "status": "valid"}
    assert rows[0]["statistics"]["MissingPercentage"]["value"] == 0.25
    assert rows[0]["sourceDataRow"] == 1
    assert (rows[0]["sourceLineStart"], rows[0]["sourceLineEnd"]) == (2, 3)
    assert (rows[1]["sourceLineStart"], rows[1]["sourceLineEnd"]) == (4, 4)
    assert rows[0]["sourceSign"] == "Unsign"
    assert rows[0]["checkedSignificant"] is False
    assert rows[0]["flags"] == []
    assert doc["releaseEligible"] is False
    assert doc["source"]["headers"] == peptides.HEADERS
    assert "inert" in doc["method"]["sourceCells"]
    assert doc["audit"]["rowCount"] == 2
    assert doc["audit"]["peptideSequenceCount"] == 2
    source = tmp_path / "source.tsv"
    repeated = peptides.write_report(
        source, tmp_path / "second-bundle",
        expected_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    )
    assert repeated == doc


def test_sorted_literal_groups_ambiguous_missing_and_partial_evaluation(tmp_path):
    doc, rows = report(tmp_path, [
        source_row(Entry="Z", Sign="Sign", **{"adj.pvalue": "0"}),
        source_row(Entry="A", Label="FBP_2", ambig="yes", **{"adj.pvalue": "0"}),
        source_row(Entry="A", Label="FBP_1", log2FC="NA"),
        source_row(Entry="B", PeptideSequence="ONE"),
        source_row(Entry="B", PeptideSequence="TWO", log2FC=""),
        source_row(Entry="C", issue="source diagnostic"),
    ])
    groups = doc["groups"]
    assert [(g["Entry"], g["Label"]) for g in groups] == [
        ("A", "FBP_1"), ("A", "FBP_2"), ("B", "FBP_1"),
        ("C", "FBP_1"), ("Z", "FBP_1"),
    ]
    assert [g["evidenceState"] for g in groups] == [
        "not_evaluated", "not_evaluated", "no_significant_peptide_evidence",
        "not_evaluated", "significant_peptide_evidence",
    ]
    assert groups[1]["ambiguousRowCount"] == 1
    assert groups[1]["signMismatchRowCount"] == 1
    assert groups[2]["evaluatedRowReferences"] == [4]
    assert groups[2]["unavailableStatisticsRowCount"] == 1
    assert groups[-1]["significantRowReferences"] == [1]
    assert rows[1]["statisticsEvaluable"] is True
    assert rows[1]["uniqueProteinEvaluable"] is False
    assert rows[-1]["flags"] == ["source_issue"]
    assert doc["audit"]["entryCount"] == 4
    assert doc["audit"]["groupCount"] == 5
    assert doc["audit"]["evidenceStateCounts"] == {
        "not_evaluated": 3, "no_significant_peptide_evidence": 1,
        "significant_peptide_evidence": 1,
    }


@pytest.mark.parametrize("adjusted,sign,checked,mismatch", [
    ("0", "Sign", True, False), ("0", "Unsign", True, True),
    ("0.009999", "Sign", True, False), ("0.01", "Unsign", False, False),
    ("0.01", "Sign", False, True), ("1", "Unsign", False, False),
])
def test_strict_threshold_and_source_sign_are_independent(tmp_path, adjusted, sign, checked, mismatch):
    doc, rows = report(tmp_path, [source_row(Sign=sign, **{"adj.pvalue": adjusted})])
    assert rows[0]["checkedSignificant"] is checked
    assert rows[0]["signMismatch"] is mismatch
    assert rows[0]["sourceSign"] == sign
    assert doc["groups"][0]["significantRowCount"] == int(checked)
    assert doc["audit"]["signMismatchRowCount"] == int(mismatch)


@pytest.mark.parametrize("column", peptides.STATISTICS)
@pytest.mark.parametrize("raw,status,reason", [
    ("", "unavailable", None), ("NA", "unavailable", None),
    ("=1+2", "invalid", "not_numeric"), ("oops", "invalid", "not_numeric"),
    ("NaN", "invalid", "nonfinite"), ("Infinity", "invalid", "nonfinite"),
    ("-inf", "invalid", "nonfinite"), ("1e999", "invalid", "nonfinite"),
])
def test_unavailable_and_invalid_statistics_are_never_negative_evidence(tmp_path, column, raw, status, reason):
    doc, rows = report(tmp_path, [source_row(**{column: raw})])
    row = rows[0]
    assert row["cells"][peptides.HEADERS.index(column)] == raw
    assert row["statistics"][column] == {
        "value": None, "status": status, **({"reason": reason} if reason else {}),
    }
    assert f"{status}:{column}" in row["flags"]
    assert row["uniqueProteinEvaluable"] is False
    assert doc["groups"][0]["evidenceState"] == "not_evaluated"
    if column == "adj.pvalue":
        assert row["checkedSignificant"] is None
        assert row["signMismatch"] is False
    # All emitted JSON must be standards-compliant even for nonfinite source text.
    json.dumps(doc, allow_nan=False)
    json.dumps(rows, allow_nan=False)


@pytest.mark.parametrize("column", ["pvalue", "adj.pvalue"])
@pytest.mark.parametrize("raw", ["-0.01", "1.0001"])
def test_out_of_range_pvalues_are_invalid(tmp_path, column, raw):
    doc, rows = report(tmp_path, [source_row(**{column: raw})])
    assert rows[0]["statistics"][column]["reason"] == "outside_0_1"
    assert doc["audit"]["invalidStatisticsRowCount"] == 1
    assert doc["groups"][0]["evidenceState"] == "not_evaluated"


def test_zero_statistics_are_evaluable_and_nonpercentage_scale_is_preserved(tmp_path):
    doc, rows = report(tmp_path, [source_row(**dict.fromkeys(peptides.STATISTICS, "0"))])
    assert rows[0]["uniqueProteinEvaluable"] is True
    assert all(v == {"value": 0.0, "status": "valid"} for v in rows[0]["statistics"].values())
    assert doc["groups"][0]["evidenceState"] == "significant_peptide_evidence"


def test_duplicates_and_conflicting_cells_retain_every_source_row(tmp_path):
    original = source_row()
    significant = source_row(Sign="Sign", **{"adj.pvalue": "0"})
    doc, rows = report(tmp_path, [original, original, significant,
                                source_row(BioReplicate="2"), source_row(Label="FBP_2")])
    assert len(rows) == 5
    assert rows[1]["duplicateOfSourceDataRow"] == 1
    assert rows[1]["flags"] == ["duplicate_source_key"]
    assert rows[2]["flags"] == ["duplicate_source_key", "conflicting_duplicate_cells"]
    assert "duplicateOfSourceDataRow" not in rows[3]
    assert "duplicateOfSourceDataRow" not in rows[4]
    group = doc["groups"][0]
    assert group["duplicateRowCount"] == 2
    assert group["conflictingDuplicateRowCount"] == 1
    assert group["evaluatedRowReferences"] == [1, 2, 3, 4]
    assert group["significantRowReferences"] == [3]
    assert group["evidenceState"] == "significant_peptide_evidence"
    assert doc["audit"]["peptideSequenceCount"] == 1


@pytest.mark.parametrize("headers", [
    (), peptides.HEADERS[:-1], (*reversed(peptides.HEADERS),),
    (*peptides.HEADERS, "extra"), ("Organism", *peptides.HEADERS[1:]),
])
def test_exact_headers_required_before_output(tmp_path, headers):
    source, pin = make_source(tmp_path, headers=headers)
    with pytest.raises(ValueError, match="line 1: exact headers/order"):
        peptides.write_report(source, tmp_path / "bundle", expected_sha256=pin)
    assert not (tmp_path / "bundle").exists()


@pytest.mark.parametrize("payload,message", [
    (b"", "line 1"),
    (("\t".join(peptides.HEADERS) + "\n").encode(), "no data rows"),
    (("\t".join(peptides.HEADERS) + "\nwrong\twidth\n").encode(), "data row 1, line 2: expected 38"),
    (("\t".join(peptides.HEADERS) + '\n"unterminated\n').encode(), "data row 1.*invalid TSV"),
    (b"\xff", "line 1: invalid UTF-8"),
])
def test_empty_and_malformed_tsv_errors(tmp_path, payload, message):
    source, pin = make_source(tmp_path, payload=payload)
    with pytest.raises(ValueError, match=message):
        list(peptides.iter_rows(source, expected_sha256=pin))


@pytest.mark.parametrize("column,value", [
    ("organism", "pcc6803"), ("organism", "PCC7942"), ("Sign", "sign"),
    ("Sign", "NA"), ("ambig", "YES"), ("ambig", ""),
    ("Label", ""), ("Entry", "NA"), ("PeptideSequence", "   "),
    ("BioReplicate", ""),
])
def test_invalid_source_identity_vocabulary_and_missing_keys(tmp_path, column, value):
    source, pin = make_source(tmp_path, [source_row(**{column: value})])
    with pytest.raises(ValueError, match=f"data row 1, line 2:.*{column}"):
        list(peptides.iter_rows(source, expected_sha256=pin))


def test_wrong_hash_is_checked_before_even_invalid_utf8_or_output(tmp_path):
    source, _ = make_source(tmp_path, payload=b"\xff")
    iterator = peptides.iter_rows(source)
    with pytest.raises(ValueError, match="SHA-256 mismatch"):
        next(iterator)
    with pytest.raises(ValueError, match="SHA-256 mismatch"):
        peptides.write_report(source, tmp_path / "bundle")
    assert list(tmp_path.iterdir()) == [source]


@pytest.mark.parametrize("kind", ["source", "directory", "file", "symlink", "dangling", "hardlink"])
def test_output_never_overwrites_existing_paths(tmp_path, kind):
    source, pin = make_source(tmp_path)
    target = tmp_path / "bundle"
    if kind == "source":
        target = source
    elif kind == "directory":
        target.mkdir()
        (target / "keep").write_text("unrelated")
    elif kind == "file":
        target.write_text("unrelated")
    elif kind in ("symlink", "dangling"):
        target.symlink_to(source if kind == "symlink" else tmp_path / "missing")
    else:
        target.hardlink_to(source)
    with pytest.raises(ValueError, match="must be new"):
        peptides.write_report(source, target, expected_sha256=pin)
    assert target.exists() or target.is_symlink()
    assert hashlib.sha256(source.read_bytes()).hexdigest() == pin
    if kind == "directory":
        assert (target / "keep").read_text() == "unrelated"


@pytest.mark.parametrize("ending,message", [
    (b"bad\trow\n", "data row 2, line 3: expected 38"),
    (b"\xff\n", "line 3: invalid UTF-8"),
    (b'"unterminated\n', "data row 2.*invalid TSV"),
])
def test_late_parse_failures_remove_output_bundle(tmp_path, ending, message):
    source, _ = make_source(tmp_path)
    payload = source.read_bytes() + ending
    source.write_bytes(payload)
    with pytest.raises(ValueError, match=message):
        peptides.write_report(source, tmp_path / "bundle", expected_sha256=hashlib.sha256(payload).hexdigest())
    assert list(tmp_path.iterdir()) == [source]


def test_source_mutation_during_parsing_cannot_finish(tmp_path, monkeypatch):
    source, pin = make_source(tmp_path)
    original = peptides._parsed_rows

    def changed(binary, expected):
        source.write_bytes(source.read_bytes().replace(b"PEPTIDE", b"CHANGED"))
        yield from original(binary, expected)

    monkeypatch.setattr(peptides, "_parsed_rows", changed)
    with pytest.raises(ValueError, match="changed during parsing"):
        peptides.write_report(source, tmp_path / "bundle", expected_sha256=pin)
    assert not (tmp_path / "bundle").exists()


@pytest.mark.parametrize("failure", [
    "gzip_open", "row_write", "gzip_close", "summary_open",
    "summary_write", "summary_close", "database",
])
def test_write_and_database_failures_cleanup_only_this_bundle(tmp_path, monkeypatch, failure):
    source, pin = make_source(tmp_path)
    output_dir = tmp_path / "bundle"
    neighbor = tmp_path / "unrelated"
    neighbor.write_text("keep")
    if failure == "gzip_open":
        def failed_open(*args, **kwargs):
            raise OSError("disk failure")
        monkeypatch.setattr(peptides.gzip, "open", failed_open)
    elif failure in ("row_write", "gzip_close", "summary_write", "summary_close"):
        class FailedWriter:
            def write(self, value):
                raise OSError("disk failure")

        original_open = Path.open
        original_gzip = gzip.open

        @contextmanager
        def failed_gzip(*args, **kwargs):
            with original_gzip(*args, **kwargs) as stream:
                yield FailedWriter() if failure == "row_write" else stream
            raise OSError("disk failure")

        def summary_open(path, *args, **kwargs):
            if path.name != "summary.json":
                return original_open(path, *args, **kwargs)

            @contextmanager
            def failed_summary():
                with original_open(path, *args, **kwargs) as stream:
                    yield FailedWriter() if failure == "summary_write" else stream
                raise OSError("disk failure")

            return failed_summary()

        if failure in ("row_write", "gzip_close"):
            monkeypatch.setattr(peptides.gzip, "open", failed_gzip)
        else:
            monkeypatch.setattr(Path, "open", summary_open)
    elif failure == "database":
        def failed_connect(*args):
            raise peptides.sqlite3.OperationalError("disk failure")
        monkeypatch.setattr(peptides.sqlite3, "connect", failed_connect)
    else:
        original_open = Path.open

        def failed_summary_open(path, *args, **kwargs):
            if path.name == "summary.json":
                raise OSError("disk failure")
            return original_open(path, *args, **kwargs)

        monkeypatch.setattr(Path, "open", failed_summary_open)
    with pytest.raises((OSError, peptides.sqlite3.Error), match="disk failure"):
        peptides.write_report(source, output_dir, expected_sha256=pin)
    assert not output_dir.exists()
    assert neighbor.read_text() == "keep"
    assert source.exists()


def test_creation_race_does_not_remove_other_output(tmp_path, monkeypatch):
    source, pin = make_source(tmp_path)
    target = tmp_path / "bundle"
    original_mkdir = Path.mkdir

    def race(path, *args, **kwargs):
        original_mkdir(path, *args, **kwargs)
        (path / "keep").write_text("someone else's output")
        raise FileExistsError("creation race")

    monkeypatch.setattr(Path, "mkdir", race)
    with pytest.raises(FileExistsError, match="race"):
        peptides.write_report(source, target, expected_sha256=pin)
    assert (target / "keep").read_text() == "someone else's output"


def test_cli_pinned_default_success_error_and_entrypoint(tmp_path, monkeypatch, capsys):
    source, pin = make_source(tmp_path)
    original_report = peptides.write_report

    def synthetic_report(source_path, output_dir):
        return original_report(source_path, output_dir, expected_sha256=pin)

    monkeypatch.setattr(peptides, "write_report", synthetic_report)
    argv = ["--input", str(source), "--output-dir", str(tmp_path / "bundle")]
    assert peptides.main(argv) == 0
    assert json.loads(capsys.readouterr().out)["rowCount"] == 1
    monkeypatch.setattr(peptides, "write_report", original_report)
    argv[-1] = str(tmp_path / "other-bundle")
    with pytest.raises(SystemExit) as error:
        peptides.main(argv)
    assert error.value.code == 2
    assert "SHA-256 mismatch" in capsys.readouterr().err
    monkeypatch.setattr(sys, "argv", [peptides.__file__, *argv])
    with pytest.raises(SystemExit) as error:
        runpy.run_path(peptides.__file__, run_name="__main__")
    assert error.value.code == 2


def test_input_errors_and_missing_output_parent_create_nothing(tmp_path):
    with pytest.raises(FileNotFoundError):
        peptides.write_report(tmp_path / "absent", tmp_path / "bundle")
    source, pin = make_source(tmp_path)
    with pytest.raises(FileNotFoundError):
        peptides.write_report(source, tmp_path / "absent" / "bundle", expected_sha256=pin)
    assert list(tmp_path.iterdir()) == [source]
