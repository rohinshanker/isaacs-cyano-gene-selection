"""Source preservation and non-imputed reconstruction; synthetic XLSX fixtures."""

from datetime import datetime
import hashlib
import io
import json
import math
from pathlib import Path
import sys
from types import SimpleNamespace
from xml.etree import ElementTree
import zipfile

from openpyxl import Workbook
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import pxd036717_enrichment as enrichment  # noqa: E402


def workbook(mutate=None):
    """Make literal source measurements, with optional malformed source edits."""
    book = Workbook()
    book.remove(book.active)
    for bait in enrichment.BAITS:
        sheet = book.create_sheet(f"{bait}-APEX2")
        sheet.append(enrichment.expected_headers(bait))
        sheet.append([
            "Q12345", "gene  exact ", 4, 8, 16, 16, 4, 16,
            2, 3, 4, 4, 2, 4, 2, -1, 0,
            2, 3, 4, 4, 3, 2, 12, 13, 14, 15, 16, 17, 35, 123,
            "sp|Q12345|EXACT source header",
        ])
        sheet.append([
            "Q54321", None, 0, None, -1, 0, 16, 16,
            10, 10, 10, 10, 4, 4, 0, -6, -6,
            *([None] * 15),
        ])
    if mutate:
        mutate(book)
    output = io.BytesIO()
    book.save(output)
    book.close()
    return output.getvalue()


def read(data):
    return enrichment.read_workbook(data, expected_sha256=hashlib.sha256(data).hexdigest())


def test_preservation_reconstruction_summary_and_json_round_trip():
    data = workbook()
    doc = json.loads(json.dumps(read(data), allow_nan=False))
    assert doc["source"]["sha256"] == hashlib.sha256(data).hexdigest()
    assert doc["source"]["bytes"] == len(data)
    assert not doc["releaseEligible"]
    assert [s["bait"] for s in doc["sheets"]] == list(enrichment.BAITS)
    for sheet in doc["sheets"]:
        positive, missing = sheet["rows"]
        assert positive["cells"][1]["value"] == "gene  exact "
        assert positive["cells"][31]["cell"] == "AF2"
        assert positive["cells"][31]["value"] == "sp|Q12345|EXACT source header"
        assert [c["reconstructedLog2Ratio"] for c in positive["comparisons"]] == [2, -1, 0]
        assert all(not c["flags"] for c in positive["comparisons"])
        assert positive["validReplicates"] == 3
        assert positive["meanLog2Ratio"] == pytest.approx(1 / 3)
        assert positive["comparisons"][2]["cells"] == {
            "controlIntensity": "E2", "baitIntensity": "H2",
            "publishedControlLog2": "K2", "publishedBaitLog2": "N2", "publishedRatio": "Q2",
        }
        assert missing["validReplicates"] == 0 and missing["meanLog2Ratio"] is None
        assert missing["cells"][2]["value"] == 0
        assert missing["cells"][3]["value"] is None
        assert missing["comparisons"][0]["reconstructedLog2Ratio"] is None
        assert sheet["audit"]["validByReplicate"] == {"A": 1, "B": 1, "C": 1}
        assert sheet["audit"]["completeMeans"] == 1


@pytest.mark.parametrize("raw,flag", [
    (None, "missing"), (0, "missing"), (-2, "invalid"), (True, "invalid"),
    ("12", "invalid"), (float("nan"), "invalid"), (float("inf"), "invalid"),
])
@pytest.mark.parametrize("arm", ["control", "bait"])
def test_missing_and_invalid_intensities_never_become_ratios(raw, flag, arm):
    args = [4, 16, 2, 4, 2]
    args[0 if arm == "control" else 1] = raw
    result = enrichment.reconstruct_comparison(*args)
    assert result["reconstructedLog2Ratio"] is None
    assert f"{flag}_{arm}_intensity" in result["flags"]
    assert f"published_{arm}_log2_without_positive_intensity" in result["flags"]


def test_inconsistent_source_logs_and_ratios_do_not_contaminate_reconstruction():
    result = enrichment.reconstruct_comparison(4, 16, 0, 1, 99)
    assert result["reconstructedLog2Ratio"] == 2
    assert set(result["flags"]) == {
        "published_control_log2_disagrees_with_intensity",
        "published_bait_log2_disagrees_with_intensity",
        "published_ratio_disagrees_with_published_logs",
        "published_ratio_disagrees_with_reconstruction",
    }
    unavailable = enrichment.reconstruct_comparison(4, 16, None, "#VALUE!", None)
    assert unavailable["reconstructedLog2Ratio"] == 2
    assert set(unavailable["flags"]) == {
        "unavailable_published_control_log2", "unavailable_published_bait_log2",
        "unavailable_published_ratio",
    }
    assert not enrichment.reconstruct_comparison(4, 16, 2, 4, 2 + 1e-8)["flags"]
    assert enrichment.reconstruct_comparison(4, 16, 2, 4, 2 + 1e-6)["flags"]
    # Subtraction of logarithms avoids overflow in a direct bait/control division.
    assert math.isfinite(enrichment.reconstruct_comparison(1e-300, 1e300, None, None, None)["reconstructedLog2Ratio"])


def test_formulas_cached_values_errors_and_missing_caches_are_preserved():
    def mutate(book):
        book.worksheets[0]["O2"] = "=L2-I2"
        book.worksheets[0]["P2"] = "=M2-J2"
        book.worksheets[0]["Q2"] = "#VALUE!"
    original = workbook(mutate)
    output = io.BytesIO()
    # openpyxl intentionally does not calculate formulas. Set one synthetic cache
    # directly in OOXML, leaving the other absent to exercise both source states.
    with zipfile.ZipFile(io.BytesIO(original)) as source, zipfile.ZipFile(output, "w") as target:
        for name in source.namelist():
            payload = source.read(name)
            if name == "xl/worksheets/sheet1.xml":
                root = ElementTree.fromstring(payload)
                ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
                root.find(".//s:c[@r='O2']/s:v", ns).text = "2"
                payload = ElementTree.tostring(root)
            target.writestr(name, payload)
    row = read(output.getvalue())["sheets"][0]["rows"][0]
    assert row["cells"][14] == {
        "cell": "O2", "value": "=L2-I2", "type": "f", "cachedValue": 2, "cachedType": "n",
    }
    assert row["cells"][15]["value"] == "=M2-J2" and row["cells"][15]["cachedValue"] is None
    assert row["cells"][16]["type"] == "e" and row["cells"][16]["cachedValue"] == "#VALUE!"
    assert "unavailable_published_ratio" in row["comparisons"][1]["flags"]
    assert row["meanLog2Ratio"] == pytest.approx(1 / 3)


def test_duplicate_accessions_blank_rows_and_blank_extra_columns_are_retained():
    def mutate(book):
        sheet = book.worksheets[0]
        sheet["A3"] = "Q12345"
        sheet.cell(5, 33).value = None
        sheet.cell(5, 33).number_format = "0.0"
    table = read(workbook(mutate))["sheets"][0]
    assert len(table["rows"]) == 2
    assert table["blankRows"] == [4, 5]
    assert table["dimensions"] == [5, 33]
    assert table["audit"]["duplicateAccessions"] == {"Q12345": 2}


@pytest.mark.parametrize("mutate,message", [
    (lambda b: setattr(b.worksheets[0], "title", "Other"), "sheet names"),
    (lambda b: b.worksheets[0].__setitem__("A1", "UniProt identifier"), "headers"),
    (lambda b: b.worksheets[0].__setitem__("AG1", "Unexpected"), "headers"),
    (lambda b: b.worksheets[0].__setitem__("AG2", 42), "extra column"),
    (lambda b: b.worksheets[0].__setitem__("A2", None), "identifier"),
    (lambda b: b.worksheets[0].__setitem__("A2", "=A3"), "identifier"),
    (lambda b: b.worksheets[0].__setitem__("A2", "  "), "identifier"),
    (lambda b: b.worksheets[0].delete_rows(2, 2), "no data rows"),
    (lambda b: b.worksheets[0].__setitem__("B2", datetime(2026, 1, 1)), "source value type"),
])
def test_schema_changes_fail_closed(mutate, message):
    with pytest.raises(ValueError, match=message):
        read(workbook(mutate))


def test_source_hash_and_nonfinite_cells_fail_closed():
    with pytest.raises(ValueError, match="SHA-256"):
        enrichment.read_workbook(workbook())
    cell = SimpleNamespace(value=float("inf"), data_type="n")
    with pytest.raises(ValueError, match="non-finite"):
        enrichment._source_cell(cell, cell, "C2")


def test_partial_three_replicate_mean_is_missing():
    data = workbook(lambda b: b.worksheets[0].__setitem__("H2", 0))
    row = read(data)["sheets"][0]["rows"][0]
    assert row["validReplicates"] == 2
    assert row["meanLog2Ratio"] is None
    assert row["comparisons"][2]["reconstructedLog2Ratio"] is None


def test_zero_published_log_and_multiaccession_are_explicit():
    result = enrichment.reconstruct_comparison(0, 0, 0, 0, 0)
    assert result["reconstructedLog2Ratio"] is None
    assert "zero_published_control_log2_without_positive_intensity" in result["flags"]
    assert "zero_published_bait_log2_without_positive_intensity" in result["flags"]
    table = read(workbook(lambda b: b.worksheets[0].__setitem__("A2", "Q12345;Q99999")))["sheets"][0]
    assert table["rows"][0]["accession"] == "Q12345;Q99999"
    assert table["audit"]["multiAccessionRows"] == [2]


PINNED = Path(__file__).resolve().parents[1] / "data/interim/pxd036717" / enrichment.SOURCE_FILE


@pytest.mark.skipif(not PINNED.exists(), reason="requires owner-supplied pinned supplement")
def test_pinned_workbook_matches_independent_source_audit():
    doc = enrichment.read_workbook(PINNED.read_bytes())
    expected = [
        (383, [239, 198, 230], 196, [201]),
        (365, [200, 156, 186], 152, [53, 207, 225, 300]),
        (420, [309, 231, 287], 212, [149, 236, 349]),
        (457, [220, 156, 169], 144, [151, 241, 365]),
    ]
    for sheet, (rows, coverage, means, groups) in zip(doc["sheets"], expected, strict=True):
        audit = sheet["audit"]
        assert audit["rowCount"] == rows
        assert list(audit["validByReplicate"].values()) == coverage
        assert audit["completeMeans"] == means
        assert audit["multiAccessionRows"] == groups
        assert not audit["duplicateAccessions"]
        assert not any("disagrees" in flag for flag in audit["flags"])
    assert sum(s["audit"]["formulaCells"] for s in doc["sheets"]) == 11009
    cikb = doc["sheets"][1]["rows"][0]
    assert cikb["cells"][7]["value"] == cikb["cells"][13]["value"] == 0
    assert cikb["comparisons"][2]["reconstructedLog2Ratio"] is None
    assert "zero_published_bait_log2_without_positive_intensity" in cikb["comparisons"][2]["flags"]


def test_cli_source_protection_pin_and_success(tmp_path, monkeypatch, capsys):
    source = tmp_path / "source.xlsx"
    source.write_bytes(workbook())
    with pytest.raises(SystemExit):
        enrichment.main(["--input", str(source), "--output", str(source)])
    output = tmp_path / "new" / "evidence.json"
    args = ["--input", str(source), "--output", str(output)]
    with pytest.raises(ValueError, match="SHA-256"):
        enrichment.main(args)
    assert not output.exists()
    source_before = source.read_bytes()
    original_reader = enrichment.read_workbook
    monkeypatch.setattr(enrichment, "read_workbook", lambda data: original_reader(
        data, expected_sha256=hashlib.sha256(source_before).hexdigest()))
    assert enrichment.main(args) == 0
    assert source.read_bytes() == source_before
    assert json.loads(output.read_text())["sheets"][0]["audit"]["rowCount"] == 2
    assert json.loads(capsys.readouterr().out)["RpaA"]["validByReplicate"]["A"] == 1
