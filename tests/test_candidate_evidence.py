"""Admitted candidate evidence is reproducible from exact release joins."""

import hashlib
import importlib.util
import json
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "candidate_evidence", ROOT / "tools/candidate_evidence.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_published_candidate_evidence_matches_pinned_manifest():
    """Every displayed tested allele is exactly joined and source pinned."""
    expected = MODULE.build()
    published = json.loads(MODULE.OUTPUT.read_text())
    assert published == expected
    assert len(published["testedAlleles"]) == 3
    assert published["manifestSha256"] == hashlib.sha256(
        MODULE.MANIFEST.read_bytes()
    ).hexdigest()
    assert published["borrowedEssentiality"]["status"] == "unavailable"


def test_missing_or_mismatched_tested_allele_fails(tmp_path, monkeypatch):
    """The publication cannot silently lose or misjoin an experimental allele."""
    manifest = json.loads(MODULE.MANIFEST.read_text())
    source = next(entry for entry in manifest["sources"] if entry["id"] == "ungerer-2018")
    source["testedVariants"][0]["proteinId"] = "wrong protein"
    altered = tmp_path / "manifest.json"
    altered.write_text(json.dumps(manifest))
    monkeypatch.setattr(MODULE, "MANIFEST", altered)
    with pytest.raises(ValueError, match="exact protein join"):
        MODULE.build()

    source["testedVariants"][0]["proteinId"] = "WP_011243489.1"
    source["testedVariants"] = source["testedVariants"][:2]
    altered.write_text(json.dumps(manifest))
    with pytest.raises(ValueError, match="three distinct"):
        MODULE.build()
