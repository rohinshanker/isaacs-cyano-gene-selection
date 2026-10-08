"""Keep strains, source scales, no-growth sentinels and missing data distinct."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import recoded_multiomics as intake  # noqa: E402


def growth_row(label="strain A", doubling=30):
    return [label, doubling, 2, 1.2, 0.1, *([30] * 10), *([1.2] * 10)]


def omics_rows():
    headers = ["Gene", "Description", "RNA-A_1_rpkm", "RIBO-A_1_reads",
               *intake.DERIVED_COLUMNS]
    values = [0, 12, -1, -2, "1e-5", -3, -4, 0.5, -2]
    return [headers, ["geneA", "description", *values]]


def biolog_rows():
    headers = [value for i in range(5)
               for value in ((*intake.BIOLOG_HEADERS, None) if i < 4 else intake.BIOLOG_HEADERS)]
    row = []
    for index, plate in enumerate(["PM01", "PM04", "PM06", "PM09", "PM02"]):
        row.extend([plate, "A1", "Water", -0.1 if index else 0])
        if index < 4:
            row.append(None)
    return [headers, row]


@pytest.mark.parametrize("value", [None, "", "  ", "-"])
def test_absence_is_never_zero(value):
    assert intake.number(value, "cell") is None


@pytest.mark.parametrize("value", [True, "bad", float("nan"), "Infinity", object()])
def test_invalid_measurements_fail(value):
    with pytest.raises(ValueError, match="measurement"):
        intake.number(value, "cell")


def test_signed_scales_and_numeric_strings():
    assert intake.number("-1.2e-3", "cell") == -0.0012
    assert intake.number(0, "cell", nonnegative=True) == 0
    with pytest.raises(ValueError):
        intake.number(-1, "cell", nonnegative=True)


@pytest.mark.parametrize("value", [None, "", " ", 17])
def test_identifiers_are_required(value):
    with pytest.raises(ValueError, match="identifier"):
        intake.text_cell(value, "cell")


def test_growth_retains_replicate_positions_source_and_zero_od():
    row = growth_row()
    row[6] = None
    row[3] = 0
    records = intake.read_growth([intake.FITNESS_HEADERS, row, [None] * 25, [" "] * 25])
    assert len(records) == 1
    record = records[0]
    assert record["sourceRow"] == 2
    assert record["doublingTimeReplicatesMinutes"][1] is None
    assert record["maximumOd600"] == 0
    assert record["sourceCells"] == row
    assert record["growthStatus"] == "reported"


def test_no_growth_is_not_a_zero_minute_doubling_time():
    row = ["strain A M9", intake.NO_GROWTH, 0, 0, 0, *([0] * 3), *([None] * 7),
           *([0] * 3), *([None] * 7)]
    record = intake.read_growth([intake.FITNESS_HEADERS, row])[0]
    assert record["doublingTimeMinutes"] is None
    assert record["doublingTimeSdMinutes"] is None
    assert record["doublingTimeReplicatesMinutes"] == [None] * 10
    assert record["maximumOd600Replicates"] == [0] * 3 + [None] * 7
    assert record["growthStatus"] == "no_growth_detected"
    assert record["sourceCells"][1] == intake.NO_GROWTH


@pytest.mark.parametrize("rows,match", [
    ([], "columns"),
    ([intake.FITNESS_HEADERS, growth_row()[:-1]], "column count"),
    ([intake.FITNESS_HEADERS, growth_row(), growth_row()], "Duplicate"),
    ([intake.FITNESS_HEADERS, growth_row(doubling=0)], "positive"),
    ([intake.FITNESS_HEADERS, growth_row(doubling=intake.NO_GROWTH)], "conflicts"),
])
def test_growth_rejects_ambiguous_or_inconsistent_source(rows, match):
    with pytest.raises(ValueError, match=match):
        intake.read_growth(rows)


def test_omics_preserves_signed_values_zero_missing_and_distinct_algorithms():
    rows = omics_rows()
    rows[1][5] = "-"
    rows[1][7] = None
    table = intake.read_omics(rows, "contrast A")
    record = table["rows"][0]
    assert record["values"] == [0, 12, -1, None, 1e-5, None, -4, 0.5, -2]
    assert record["missing"] == {"3": "hyphen", "5": "blank"}
    assert table["columns"][2]["kind"] == "transcript_log2_fold_change"
    assert table["columns"][3]["kind"] == "transcript_log2_fold_change_edger"
    assert record["sourceRow"] == 2
    assert record["gene"] == "geneA"


@pytest.mark.parametrize("column,kind", [
    ("RNA-MDS42-1_rpkm", "transcript_rpkm"),
    ("RIBO-MDS42-1_rpkm", "ribosome_rpkm"),
    ("RIBOE_coli_DH10B_3_rpkm", "ribosome_rpkm"),
    ("RIBO-Ec_Syn61_delta3_ev5_1_reads", "ribosome_read_count"),
])
def test_literal_measurement_header_grammar(column, kind):
    assert intake.omics_column(column)["kind"] == kind


@pytest.mark.parametrize("column", ["RNA-A_unknown", "other_rpkm"])
def test_unrecognized_measurement_column_fails(column):
    with pytest.raises(ValueError, match="Unrecognized"):
        intake.omics_column(column)


def test_omics_rejects_duplicate_gene_keys():
    rows = omics_rows()
    rows.append(rows[1].copy())
    with pytest.raises(ValueError, match="duplicate gene"):
        intake.read_omics(rows, "contrast")


@pytest.mark.parametrize("mutation,match", [
    (lambda rows: rows[0].__setitem__(0, "locus"), "invalid"),
    (lambda rows: rows[0].__setitem__(3, rows[0][2]), "invalid"),
    (lambda rows: rows[0].pop(), "incomplete"),
    (lambda rows: rows[1].__setitem__(6, 1.1), "p-value"),
    (lambda rows: rows[1].__setitem__(3, 0.5), "fractional"),
    (lambda rows: rows[1].__setitem__(2, -1), "invalid measurement"),
])
def test_omics_refuses_changed_schema_or_invalid_scale(mutation, match):
    rows = omics_rows()
    mutation(rows)
    with pytest.raises(ValueError, match=match):
        intake.read_omics(rows, "contrast")


def test_biolog_unpivots_without_clipping_negatives_or_inventing_blanks():
    rows = biolog_rows()
    rows[1][8] = None
    rows[1][10:14] = [None] * 4
    values = intake.read_biolog(rows, "strain A")
    assert len(values) == 4
    assert values[0]["maxHeight"] == 0
    assert values[1]["maxHeight"] is None
    assert values[2]["maxHeight"] == -0.1
    assert values[2]["sourceColumn"] == 19


def test_biolog_rejects_duplicate_wells():
    rows = biolog_rows()
    rows.append(rows[1].copy())
    with pytest.raises(ValueError, match="duplicate well"):
        intake.read_biolog(rows, "strain")


def test_biolog_rejects_unknown_plates():
    rows = biolog_rows()
    rows[1][0] = "PM99"
    with pytest.raises(ValueError, match="unexpected plate"):
        intake.read_biolog(rows, "strain")


def test_extract_refuses_unpinned_workbooks(tmp_path):
    with pytest.raises(ValueError, match="missing"):
        intake.extract(tmp_path)


def test_cli_is_deterministic_and_leaves_source_metadata_intact(monkeypatch, tmp_path):
    source = {"growth": [{"sourceRow": 2}], "biolog": [{"rows": [1, 2]}], "omics": []}
    monkeypatch.setattr(intake, "extract", lambda path: source)
    output = tmp_path / "nested" / "intake.json"
    assert intake.main(["--output", str(output)]) == 0
    first = output.read_bytes()
    assert intake.main(["--output", str(output)]) == 0
    assert output.read_bytes() == first
    assert json.loads(first) == source


def test_extract_closes_workbooks_and_keeps_sheets_separate(monkeypatch, tmp_path):
    class Workbook(dict):
        closed = False

        @property
        def sheetnames(self):
            return list(self)

        def close(self):
            self.closed = True

    growth = Workbook({
        "Fitness_Source_data": SimpleNamespace(values=[intake.FITNESS_HEADERS, growth_row()]),
        "Biolog_Source_data": SimpleNamespace(values=[]),
        "strain A": SimpleNamespace(values=biolog_rows()),
    })
    omics = Workbook({"Legend": None, **{
        name: SimpleNamespace(values=omics_rows()) for name in intake.OMICS_SHEETS}})
    for name in ("Supplementary_Data_2.xlsx", "Supplementary_Data_3.xlsx"):
        (tmp_path / name).touch()
    monkeypatch.setattr(intake, "verify", lambda *args: [])
    queue = iter([growth, omics])
    monkeypatch.setattr(intake.openpyxl, "load_workbook", lambda *a, **kw: next(queue))
    document = intake.extract(tmp_path)
    assert growth.closed and omics.closed
    assert len(document["omics"]) == 5
    assert document["admission"] == "unjoined-source-tables"
    assert document["sources"][1]["sha256"] == intake.PINNED[3].sha256
    del omics["Legend"]
    queue = iter([growth, omics])
    with pytest.raises(ValueError, match="unexpected sheets"):
        intake.extract(tmp_path)
    assert omics.closed
