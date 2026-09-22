"""Contract tests for Tan 2018 non-gTSS regulatory evidence."""

import csv
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

import pytest
from openpyxl import Workbook

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import prepare_tan2018_regulatory as prep


REPOSITORY = Path(__file__).resolve().parents[1]
TABLE = REPOSITORY / "data/expression/tan2018_utex2973_regulatory_tss_table_s1.tsv"


def read_table(path=TABLE):
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle, delimiter="\t"))


def source_workbook(tmp_path, rows, *, missing_column=False):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Table S1"
    sheet.append(["Table S1"])
    columns = list(prep.SOURCE_COLUMNS)
    if missing_column:
        columns.remove("CT1_RawReads")
    sheet.append(columns)
    for row in rows:
        values = dict.fromkeys(prep.SOURCE_COLUMNS, None)
        values.update({
            "Chromosome": "CP006471", "Strand": "+", "TSS_position": 100,
            "CT1_RawReads": 5, "CT2_RawReads": 6, "D1_RawReads": 7,
            "D2_RawReads": 8, "HL1_RawReads": 9, "HL2_RawReads": 10,
            "HT1_RawReads": 11, "HT2_RawReads": 12,
        })
        values.update(row)
        sheet.append([values[column] for column in columns])
    path = tmp_path / "source.xlsx"
    workbook.save(path)
    return path


def test_pinned_table_reconciles_every_non_gtss_row():
    rows = read_table()
    assert len(rows) == 2333
    assert Counter(row["type"] for row in rows) == {
        "aTSS": 1380, "iTSS": 724, "nTSS": 229,
    }
    assert not any(row["type"] == "gTSS" for row in rows)
    assert len({row["tss_id"] for row in rows}) == 2333
    assert Counter(row["mapping_reason"] for row in rows) == {
        "exact_current_locus_id": 2068,
        "source_locus_missing": 180,
        "source_locus_absent_from_current_cds": 79,
        "source_locus_not_current_id": 6,
    }
    assert Counter(row["mapping_status"] for row in rows) == {
        "mapped": 2068, "unassociated": 180, "unmapped": 85,
    }


def test_pinned_table_preserves_missingness_and_representative_rows():
    by_id = {row["tss_id"]: row for row in read_table()}
    assert by_id["aTSS-1705677"] == {
        "tss_id": "aTSS-1705677", "replicon": "CP006471", "type": "aTSS",
        "strand": "-", "position": "1705677", "source_locus_tag": "M744_RS08610",
        "source_start_distance_nt": "302", "mapping_status": "mapped",
        "mapping_reason": "exact_current_locus_id", "mapped_locus_tag": "M744_RS08610",
        "control_1": "113", "control_2": "91", "dark_1": "255", "dark_2": "455",
        "high_light_1": "53", "high_light_2": "67", "high_temperature_1": "228",
        "high_temperature_2": "67", "dark_log2fc": "3.79241217377454",
        "dark_padj": "2.28992447561885e-35", "high_light_log2fc": "0.279678135923226",
        "high_light_padj": "0.456542123015254", "high_temperature_log2fc": "0.926315462016013",
        "high_temperature_padj": "0.0155726292232769",
    }
    assert by_id["iTSS+2067880"]["mapping_reason"] == "source_locus_absent_from_current_cds"
    assert by_id["nTSS+1471309"]["mapping_status"] == "unassociated"
    assert by_id["nTSS+1471309"]["source_start_distance_nt"] == ""
    assert by_id["nTSS+1471309"]["mapped_locus_tag"] == ""
    assert all(by_id["nTSS-13125"][field] == "" for field in (
        "dark_log2fc", "dark_padj", "high_light_log2fc", "high_light_padj",
        "high_temperature_log2fc", "high_temperature_padj",
    ))
    differential_fields = [
        "dark_log2fc", "dark_padj", "high_light_log2fc", "high_light_padj",
        "high_temperature_log2fc", "high_temperature_padj",
    ]
    assert all(sum(not row[field] for row in read_table()) == 58 for field in differential_fields)
    assert all(row[field] for row in read_table() for field in (
        "control_1", "control_2", "dark_1", "dark_2", "high_light_1",
        "high_light_2", "high_temperature_1", "high_temperature_2",
    ))


def test_derived_table_checksum_is_pinned():
    assert prep.SOURCE_SHA256 == "098ecbd204cd1042a6edee1d2a500eaeca4efe034c503e2ade3db1c605e79b00"
    assert hashlib.sha256(TABLE.read_bytes()).hexdigest() == prep.DERIVED_SHA256


def test_source_extraction_is_hash_pinned_and_maps_exact_ids(tmp_path, monkeypatch):
    rows = [
        {"TSS_ID": "gTSS+90", "Type": "gTSS", "TSS_position": 90},
        {"TSS_ID": "aTSS+100", "Type": "aTSS", "Locus_tags": "M744_RS00010"},
        {"TSS_ID": "iTSS+101", "Type": "iTSS", "TSS_position": 101,
         "Locus_tags": "old_name"},
        {"TSS_ID": "nTSS+102", "Type": "nTSS", "TSS_position": 102},
    ]
    source = source_workbook(tmp_path, rows)
    with pytest.raises(ValueError, match="hash mismatch"):
        prep.extract_rows(source, {"M744_RS00010"}, expected_type_counts={
            "aTSS": 1, "iTSS": 1, "nTSS": 1,
        })
    monkeypatch.setattr(prep, "SOURCE_SHA256", prep.source_hash(source))
    extracted = prep.extract_rows(source, {"M744_RS00010"}, expected_type_counts={
        "aTSS": 1, "iTSS": 1, "nTSS": 1,
    })
    derived = [dict(zip(prep.OUTPUT_COLUMNS, row)) for row in extracted]
    assert [row["tss_id"] for row in derived] == ["aTSS+100", "iTSS+101", "nTSS+102"]
    assert [row["mapping_reason"] for row in derived] == [
        "exact_current_locus_id", "source_locus_not_current_id", "source_locus_missing",
    ]


@pytest.mark.parametrize("rows,options,reason", [
    ([{"TSS_ID": "aTSS+100", "Type": "aTSS"}], {"missing_column": True}, "missing columns"),
    ([{"TSS_ID": "aTSS+100", "Type": "aTSS"}], {}, "Expected non-gTSS counts"),
    ([{"TSS_ID": "aTSS+100", "Type": "aTSS"},
      {"TSS_ID": "aTSS+100", "Type": "aTSS"}], {}, "Duplicate"),
    ([{"TSS_ID": "aTSS-100", "Type": "aTSS"}], {}, "disagrees"),
])
def test_source_extraction_rejects_changed_schema_counts_or_identity(
    tmp_path, monkeypatch, rows, options, reason
):
    source = source_workbook(tmp_path, rows, **options)
    monkeypatch.setattr(prep, "SOURCE_SHA256", prep.source_hash(source))
    with pytest.raises(ValueError, match=reason):
        prep.extract_rows(source, set())


def test_current_gene_ids_must_be_unique_and_current(tmp_path):
    genes = tmp_path / "genes.json"
    genes.write_text(json.dumps([{"id": "M744_RS00010"}, {"id": "old_name"}]))
    with pytest.raises(ValueError, match="unique M744_RS"):
        prep.current_loci_from_genes(genes)
