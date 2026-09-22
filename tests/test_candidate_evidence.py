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
    borrowed = published["borrowedEssentiality"]
    assert borrowed["status"] == "available"
    assert len(borrowed["byLocus"]) == 2715
    assert borrowed["byLocus"]["M744_RS00005"]["status"] == "non-essential"
    assert borrowed["byLocus"]["M744_RS01270"]["status"] == "unknown"
    assert borrowed["source"]["rubinDoi"] == "10.1073/pnas.1519220112"


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


def test_borrowed_source_requires_matching_release_and_known_reasons(tmp_path, monkeypatch):
    """A stale or unexplained PCC row cannot enter candidate evidence."""
    original = json.loads(MODULE.PCC_ESSENTIALITY.read_text())
    altered = tmp_path / "pcc.json"
    monkeypatch.setattr(MODULE, "PCC_ESSENTIALITY", altered)

    wrong_release = json.loads(json.dumps(original))
    wrong_release["source"]["annotationRelease"] = "other"
    altered.write_text(json.dumps(wrong_release))
    with pytest.raises(ValueError, match="annotation release"):
        MODULE.borrowed_essentiality(original["source"]["annotationRelease"])

    missing = json.loads(json.dumps(original))
    del missing["byLocus"]["M744_RS00005"]
    altered.write_text(json.dumps(missing))
    with pytest.raises(ValueError, match="does not cover"):
        MODULE.borrowed_essentiality(original["source"]["annotationRelease"])

    unexplained = json.loads(json.dumps(original))
    unexplained["byLocus"]["M744_RS01270"]["mappingReason"] = "invented_reason"
    altered.write_text(json.dumps(unexplained))
    with pytest.raises(ValueError, match="Unknown PCC mapping reason"):
        MODULE.borrowed_essentiality(original["source"]["annotationRelease"])
