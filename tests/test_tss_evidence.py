"""Contract tests for the pinned Tan 2018 promoter-level supplement."""

import csv
import hashlib
import json
import sys
from pathlib import Path

import pytest
from openpyxl import Workbook

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import prepare_tan2018 as prep
from tss_evidence import TABLE_COLUMNS, load_tss_evidence


REPOSITORY = Path(__file__).resolve().parents[1]
TABLE = REPOSITORY / "data/expression/tan2018_utex2973_tss_table_s1.tsv"


def fixture_row(**overrides):
    row = dict.fromkeys(TABLE_COLUMNS, "")
    row.update({
        "tss_id": "gTSS+100", "replicon": "CP006471", "type": "gTSS",
        "strand": "+", "position": "100", "locus_tag": "M744_RS00010",
        "source_start_distance_nt": "20",
        "control_1": "10", "control_2": "11", "dark_1": "15",
        "dark_2": "16", "high_light_1": "20.5", "high_light_2": "21",
        "high_temperature_1": "30", "high_temperature_2": "31",
        "dark_log2fc": "1.5", "dark_padj": "0.001",
        "high_light_log2fc": "-2", "high_light_padj": "0.05",
        "high_temperature_log2fc": "0", "high_temperature_padj": "1",
    })
    row.update(overrides)
    return row


def write_fixture(tmp_path, rows, *, columns=TABLE_COLUMNS):
    path = tmp_path / "tss.tsv"
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle, fieldnames=columns, delimiter="\t", extrasaction="ignore"
        )
        writer.writeheader()
        writer.writerows(rows)
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return path, digest


def test_pinned_table_join_and_cardinality():
    genes = json.loads((REPOSITORY / "site/data/genes.json").read_text())
    by_locus, summary = load_tss_evidence(TABLE, {gene["id"] for gene in genes})
    assert summary == {
        "sourceRows": 2475,
        "matchedRows": 2432,
        "matchedGenes": 1789,
        "unresolvedIdentifierRows": 10,
        "absentCurrentLocusRows": 33,
        "genesWithoutMappedTss": 926,
    }
    assert len(by_locus["M744_RS01695"]) == 20
    assert by_locus["M744_RS02000"][0]["rawReads"]["control"] == [154, 195]
    assert by_locus["M744_RS02000"][0]["differential"]["dark"]["log2FoldChange"] == pytest.approx(4.991755116)
    assert all(row["type"] == "gTSS" for rows in by_locus.values() for row in rows)


def test_preserves_multiple_promoters_and_missing_comparisons(tmp_path):
    rows = [
        fixture_row(),
        fixture_row(tss_id="gTSS+200", position="200", dark_log2fc="", dark_padj=""),
        fixture_row(tss_id="gTSS+300", position="300", locus_tag="old_symbol"),
        fixture_row(tss_id="gTSS+400", position="400", locus_tag="M744_RS99999"),
    ]
    path, digest = write_fixture(tmp_path, rows)
    by_locus, summary = load_tss_evidence(
        path, {"M744_RS00010", "M744_RS00020"},
        expected_sha256=digest, expected_rows=4,
    )
    assert [row["id"] for row in by_locus["M744_RS00010"]] == ["gTSS+100", "gTSS+200"]
    assert by_locus["M744_RS00010"][0]["rawReads"]["highLight"] == [20.5, 21]
    assert by_locus["M744_RS00010"][0]["sourceStartDistanceNt"] == 20
    assert by_locus["M744_RS00010"][1]["differential"]["dark"] == {
        "log2FoldChange": None, "padj": None,
    }
    assert "M744_RS00020" not in by_locus
    assert summary == {
        "sourceRows": 4, "matchedRows": 2, "matchedGenes": 1,
        "unresolvedIdentifierRows": 1, "absentCurrentLocusRows": 1,
        "genesWithoutMappedTss": 1,
    }


@pytest.mark.parametrize("change,reason", [
    ({"tss_id": "gTSS+99"}, "position"),
    ({"strand": "-"}, "strand"),
    ({"type": "aTSS"}, "type"),
    ({"replicon": "other"}, "replicon"),
    ({"control_1": "-1"}, "Negative"),
    ({"dark_log2fc": "nan"}, "Non-finite"),
    ({"dark_padj": "2"}, "adjusted p-value"),
    ({"dark_padj": ""}, "Incomplete"),
    ({"source_start_distance_nt": "-1"}, "historical"),
])
def test_rejects_invalid_evidence(tmp_path, change, reason):
    path, digest = write_fixture(tmp_path, [fixture_row(**change)])
    with pytest.raises(ValueError, match=reason):
        load_tss_evidence(path, {"M744_RS00010"}, expected_sha256=digest, expected_rows=1)


def test_rejects_duplicate_schema_count_and_hash(tmp_path):
    path, digest = write_fixture(tmp_path, [fixture_row(), fixture_row()])
    with pytest.raises(ValueError, match="repeated"):
        load_tss_evidence(path, {"M744_RS00010"}, expected_sha256=digest, expected_rows=2)
    with pytest.raises(ValueError, match="hash mismatch"):
        load_tss_evidence(path, {"M744_RS00010"}, expected_sha256="0" * 64, expected_rows=2)
    path, digest = write_fixture(tmp_path, [fixture_row()])
    with pytest.raises(ValueError, match="Expected 2"):
        load_tss_evidence(path, {"M744_RS00010"}, expected_sha256=digest, expected_rows=2)
    path, digest = write_fixture(tmp_path, [fixture_row()], columns=TABLE_COLUMNS[:-1])
    with pytest.raises(ValueError, match="columns"):
        load_tss_evidence(path, {"M744_RS00010"}, expected_sha256=digest, expected_rows=1)


def source_workbook(tmp_path, count=1, *, duplicate=False, missing_column=False):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Table S1"
    sheet.append(["Table S1"])
    columns = list(prep.SOURCE_COLUMNS)
    if missing_column:
        columns.remove("CT1_RawReads")
    sheet.append(columns)
    for index in range(count):
        position = 100 if duplicate else 100 + index
        values = dict.fromkeys(prep.SOURCE_COLUMNS, None)
        values.update({
            "TSS_ID": f"gTSS+{position}", "Chromosome": "CP006471",
            "Type": "gTSS", "Strand": "+", "TSS_position": position,
            "Locus_tags": "M744_RS00010", "Distances to start codon": 20,
            "CT1_RawReads": 5,
        })
        sheet.append([values[column] for column in columns])
    path = tmp_path / "source.xlsx"
    workbook.save(path)
    return path


def test_source_extraction_is_hash_pinned_and_reproducible(tmp_path, monkeypatch):
    source = source_workbook(tmp_path, count=2475)
    with pytest.raises(ValueError, match="hash mismatch"):
        prep.extract_rows(source)
    monkeypatch.setattr(prep, "SOURCE_SHA256", prep.source_hash(source))
    rows = prep.extract_rows(source)
    assert len(rows) == 2475
    output = tmp_path / "derived.tsv"
    prep.write_table(source, output)
    with output.open(encoding="utf-8", newline="") as handle:
        derived = list(csv.DictReader(handle, delimiter="\t"))
    assert len(derived) == 2475
    assert derived[0]["tss_id"] == "gTSS+100"
    assert derived[0]["control_1"] == "5"


@pytest.mark.parametrize("options,reason", [
    ({"missing_column": True}, "missing columns"),
    ({"duplicate": True, "count": 2}, "Duplicate"),
    ({}, "Expected 2,475"),
])
def test_source_extraction_rejects_changed_schema_or_cardinality(
    tmp_path, monkeypatch, options, reason
):
    source = source_workbook(tmp_path, **options)
    monkeypatch.setattr(prep, "SOURCE_SHA256", prep.source_hash(source))
    with pytest.raises(ValueError, match=reason):
        prep.extract_rows(source)
