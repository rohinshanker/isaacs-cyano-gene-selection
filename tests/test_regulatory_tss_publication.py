"""Checks for the browser's lossless regulatory-site publication."""

import csv
import hashlib
import importlib.util
import json
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("regulatory_tss", ROOT / "tools/regulatory_tss.py")
regulatory_tss = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(regulatory_tss)


def test_browser_data_matches_pinned_tsv():
    published = regulatory_tss.OUTPUT.read_bytes()
    assert published == regulatory_tss.build()
    document = json.loads(published)
    with regulatory_tss.SOURCE.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle, delimiter="\t"))
    assert document["rows"] == rows
    with regulatory_tss.TARGETS.open(encoding="utf-8", newline="") as handle:
        targets = list(csv.DictReader(handle, delimiter="\t"))
    assert document["potentialTargets"] == targets
    assert len(targets) == 101
    assert document["sourceDiscrepancies"] == [{
        "tssId": "aTSS-320358", "comparison": "dark",
        "tableS1Log2Fc": "8.61934317511037",
        "tableS8Log2Fc": "-4.78047469754605",
    }]
    assert [warning["tssId"] for warning in document["sourceWarnings"]] == [
        "aTSS-320358", "iTSS+320358",
    ]
    assert document["source"]["strain"] == "Synechococcus elongatus UTEX 2973"
    assert document["source"]["derivedTsvSha256"] == hashlib.sha256(
        regulatory_tss.SOURCE.read_bytes()
    ).hexdigest()


def test_checksum_rejects_changed_source(tmp_path):
    changed = tmp_path / "regulatory.tsv"
    changed.write_bytes(regulatory_tss.SOURCE.read_bytes() + b"\n")
    with pytest.raises(ValueError, match="checksum mismatch"):
        regulatory_tss.build(changed)
    changed_targets = tmp_path / "targets.tsv"
    changed_targets.write_bytes(regulatory_tss.TARGETS.read_bytes() + b"\n")
    with pytest.raises(ValueError, match="target TSV checksum mismatch"):
        regulatory_tss.build(targets=changed_targets)


def test_reconciliation_rejects_missing_or_duplicate_rows(tmp_path, monkeypatch):
    source = tmp_path / "regulatory.tsv"
    with regulatory_tss.SOURCE.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle, delimiter="\t"))
    same_type = next(row for row in rows[:-1] if row["type"] == rows[-1]["type"]
                     and row["mapping_status"] == rows[-1]["mapping_status"])
    for changed_rows, expected in ((rows[:-1], "type counts"),
                                   (rows[:-1] + [same_type], "identifiers")):
        with source.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=rows[0], delimiter="\t")
            writer.writeheader()
            writer.writerows(changed_rows)
        monkeypatch.setattr(regulatory_tss, "SOURCE_SHA256", hashlib.sha256(
            source.read_bytes()
        ).hexdigest())
        with pytest.raises(ValueError, match=expected):
            regulatory_tss.build(source)
