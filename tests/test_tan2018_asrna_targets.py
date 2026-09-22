"""Tan Table S8 extraction keeps source hypotheses separate from gene calls."""

import csv
import hashlib
import importlib.util
from collections import Counter
from pathlib import Path

import pytest
from openpyxl import Workbook


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "prepare_tan2018_asrna_targets", ROOT / "scripts/prepare_tan2018_asrna_targets.py"
)
parser = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(parser)
TARGETS = ROOT / "data/expression/tan2018_utex2973_asrna_potential_targets_table_s8.tsv"


def test_pinned_potential_targets_reconcile():
    assert hashlib.sha256(TARGETS.read_bytes()).hexdigest() == (
        "0aa810d75f1e92200044ac445a7ba4ee90652a9d82d575040a803c9d66607a69"
    )
    with TARGETS.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle, delimiter="\t"))
    assert len(rows) == 101
    assert Counter(row["comparison"] for row in rows) == parser.COUNTS
    assert len({row["tss_id"] for row in rows}) == 96
    assert len({(row["tss_id"], row["comparison"]) for row in rows}) == 101
    first = rows[0]
    assert first["tss_id"] == "aTSS+1886911"
    assert first["potential_target_locus"] == "M744_RS09425"
    assert first["comparison"] == "dark"


def example_source(tmp_path, *, target="M744_RS09425", duplicate=False,
                   heading=None):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Table S8"
    sheet.append(["Table S8"])
    sheet.append(parser.HEADER)
    sheet.append([heading or (
        "DK_vs_CT: (aTSS_Log2FoldChange>=1.5 and gTSS_Log2FoldChange<= -1.5) "
        "OR (aTSS_Log2FoldChange<=-1.5 and gTSS_Log2FoldChange>=1.5)"
    )])
    site = ["aTSS+1886911", "+", 1886911, 7.5, target, "ndhA",
            1887330, -4.7, "source product"]
    sheet.append(site)
    if duplicate:
        sheet.append(site)
    workbook_path = tmp_path / "source.xlsx"
    workbook.save(workbook_path)
    regulatory = tmp_path / "regulatory.tsv"
    regulatory.write_text(
        "tss_id\ttype\tstrand\tposition\tsource_locus_tag\n"
        "aTSS+1886911\taTSS\t+\t1886911\tM744_RS09425\n",
        encoding="utf-8",
    )
    return workbook_path, regulatory


def test_source_extraction_checks_workbook_and_exact_site_join(tmp_path, monkeypatch):
    workbook, regulatory = example_source(tmp_path)
    with pytest.raises(ValueError, match="checksum mismatch"):
        parser.extract(workbook, regulatory)
    monkeypatch.setattr(parser, "WORKBOOK_SHA256", hashlib.sha256(workbook.read_bytes()).hexdigest())
    monkeypatch.setattr(parser, "COUNTS", {"dark": 1})
    rows = parser.extract(workbook, regulatory)
    assert rows == [("aTSS+1886911", "dark", 1.5, "+", 1886911, 7.5,
                     "M744_RS09425", "ndhA", 1887330, -4.7, "source product")]
    wrong, regulatory = example_source(tmp_path, target="M744_RS99999")
    monkeypatch.setattr(parser, "WORKBOOK_SHA256", hashlib.sha256(wrong.read_bytes()).hexdigest())
    with pytest.raises(ValueError, match="target or coordinate changed"):
        parser.extract(wrong, regulatory)
    duplicate, regulatory = example_source(tmp_path, duplicate=True)
    monkeypatch.setattr(parser, "WORKBOOK_SHA256", hashlib.sha256(duplicate.read_bytes()).hexdigest())
    with pytest.raises(ValueError, match="Duplicate"):
        parser.extract(duplicate, regulatory)


@pytest.mark.parametrize("heading", [
    "HT_vs_CT: (aTSS_Log2FoldChange>=1.5 and gTSS_Log2FoldChange<= -1.5) "
    "OR (aTSS_Log2FoldChange<=-1.5 and gTSS_Log2FoldChange>=1.5)",
    "DK_vs_CT: (aTSS_Log2FoldChange>=1.5 and gTSS_Log2FoldChange<= -1.5) "
    "OR (aTSS_Log2FoldChange<=-1.0 and gTSS_Log2FoldChange>=1.0)",
])
def test_changed_selection_rule_is_rejected(tmp_path, monkeypatch, heading):
    workbook, regulatory = example_source(tmp_path, heading=heading)
    monkeypatch.setattr(parser, "WORKBOOK_SHA256", hashlib.sha256(workbook.read_bytes()).hexdigest())
    with pytest.raises(ValueError, match="selection rule changed"):
        parser.extract(workbook, regulatory)
