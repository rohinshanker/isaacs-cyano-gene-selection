"""Admission and publication contracts for the complete Ec_Syn57 design."""

from __future__ import annotations

import gzip
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
sys.path.insert(0, str(ROOT / "scripts"))

import build_syn57_design as syn57  # noqa: E402
from organisms import get_organism  # noqa: E402


@pytest.mark.skipif(not syn57.SOURCE.is_file(), reason="pinned ignored source not fetched")
def test_pinned_source_identity_and_annotation_counts() -> None:
    """The admitted artifact is one complete design with fixed identity and counts."""
    record = syn57.read_source()
    assert record.id == "Ec_Syn57"
    assert len(record.seq) == 3_973_902
    assert record.annotations["topology"] == "circular"
    assert syn57.sha256(syn57.SOURCE) == syn57.SOURCE_SHA256
    assert syn57.hashlib.sha256(bytes(record.seq)).hexdigest() == syn57.SEQUENCE_SHA256
    assert sum(feature.type == "CDS" for feature in record.features) == 3640
    assert sum(feature.type == "tRNA" for feature in record.features) == 85


@pytest.mark.skipif(not syn57.SOURCE.is_file(), reason="pinned ignored source not fetched")
def test_normalizer_is_deterministic_and_preserves_every_cds(tmp_path: Path) -> None:
    """Normalization loses no CDS and excludes six unsupported tRNA inferences."""
    record = syn57.read_source()
    first = tmp_path / "first"
    second = tmp_path / "second"
    assert syn57.normalize(record, first) == {
        "cds": 3640, "identifiedTrna": 79, "unidentifiedTrna": 6,
    }
    assert syn57.normalize(record, second) == {
        "cds": 3640, "identifiedTrna": 79, "unidentifiedTrna": 6,
    }
    assert {path.name: path.read_bytes() for path in first.iterdir()} == {
        path.name: path.read_bytes() for path in second.iterdir()
    }
    config = get_organism(syn57.ORGANISM_ID)
    with gzip.open(first / f"{config.assemblyPrefix}_cds_from_genomic.fna.gz", "rt") as handle:
        assert sum(line.startswith(">") for line in handle) == 3640
    audit = json.loads((first / syn57.SOURCE_AUDIT_NAME).read_text(encoding="utf-8"))
    assert len(audit["cds"]) == 3640
    assert len(audit["trna"]) == 85
    assert sum(row["sourceIdentifierBasis"] != "locus_tag" for row in audit["cds"]) == 2
    duplicates = [row for row in audit["cds"] if row["sourceIdentifierOccurrences"] > 1]
    assert {row["sourceIdentifier"] for row in duplicates} == {"b4419", "b1716", "b1717", "b1718"}
    assert all(row["localId"] and row["sourceLocation"] for row in duplicates)
    assert sum(row["decodingPoolStatus"] == "included-from-source-note"
               for row in audit["trna"]) == 79
    assert sum(row["decodingPoolStatus"] == "excluded-no-supported-note"
               for row in audit["trna"]) == 6
    assert all(row["sourceAnticodonQualifier"] is None for row in audit["trna"])


def test_shipped_payload_is_design_only_and_source_pinned() -> None:
    """The viewer record cannot silently acquire isolate measurements or Syn61 identity."""
    output = get_organism(syn57.ORGANISM_ID).path("outputDirectory")
    meta = json.loads((output / "meta.json").read_text(encoding="utf-8"))
    genes = json.loads((output / "genes.json").read_text(encoding="utf-8"))
    citations = json.loads((output / "citations.json").read_text(encoding="utf-8"))
    assert meta["genome"] == {
        "accession": "Ec_Syn57", "taxid": 562, "totalLength": 3_973_902,
    }
    assert meta["designSource"] == {
        "recordType": "complete-design",
        "file": "Ec_Syn57.gb",
        "bytes": syn57.SOURCE_SIZE,
        "sha256": syn57.SOURCE_SHA256,
        "sequenceSha256": syn57.SEQUENCE_SHA256,
        "citationId": "nyerges-2026-syn57-design",
        "measuredIsolate": False,
        "featureAuditFile": syn57.SOURCE_AUDIT_NAME,
    }
    assert len(genes) == meta["geneCount"] == 3588
    assert not (output / "expression_layers.json").exists()
    assert not (output / "strain_fitness.json").exists()
    source_text = json.dumps(citations)
    assert "design record, not a sequenced isolate" in source_text
    assert "CC BY-NC-ND 4.0" in source_text
    assert "Syn61" not in source_text
    assert "RefSeq" not in json.dumps(meta["metrics"])
    assert meta["tai"]["annotationBasis"]["includedFromCodonRecognitionNotes"] == 79
    assert meta["tai"]["annotationBasis"]["excludedWithoutSupportedNote"] == 6
    audit = json.loads((output / syn57.SOURCE_AUDIT_NAME).read_text(encoding="utf-8"))
    assert sum(row["publicationStatus"] == "included" for row in audit["cds"]) == 3588
    assert sum(row["publicationStatus"] == "excluded" for row in audit["cds"]) == 52


def test_payload_comparison_checks_inventory_and_normalizes_only_build_time(tmp_path: Path) -> None:
    """The check catches missing/new files while tolerating builtAt and its digest."""
    expected = tmp_path / "expected"
    rebuilt = tmp_path / "rebuilt"
    expected.mkdir()
    rebuilt.mkdir()
    (expected / "genes.json").write_text("[]\n", encoding="utf-8")
    (rebuilt / "genes.json").write_text("[]\n", encoding="utf-8")
    for directory, timestamp, digest in (
        (expected, "2026-10-10T12:00:00Z", "old"),
        (rebuilt, "2026-10-10T13:00:00Z", "new"),
    ):
        (directory / "meta.json").write_text(
            json.dumps({"schemaVersion": 1, "builtAt": timestamp}) + "\n", encoding="utf-8"
        )
        (directory / "data-manifest.json").write_text(json.dumps({
            "schemaVersion": 1,
            "files": {
                "genes.json": {"bytes": 3, "sha256": "same"},
                "meta.json": {"bytes": 55, "sha256": digest},
            },
        }) + "\n", encoding="utf-8")
    assert syn57.payload_differences(expected, rebuilt) == []
    (rebuilt / "unexpected.json").write_text("{}\n", encoding="utf-8")
    assert syn57.payload_differences(expected, rebuilt) == ["unexpected.json"]
    (rebuilt / "unexpected.json").unlink()
    (rebuilt / "genes.json").unlink()
    assert syn57.payload_differences(expected, rebuilt) == ["genes.json"]


@pytest.mark.skipif(not syn57.SOURCE.is_file(), reason="pinned ignored source not fetched")
def test_failed_check_build_cannot_mutate_shipped_payload(monkeypatch: pytest.MonkeyPatch,
                                                          tmp_path: Path) -> None:
    """Even a partial temporary rebuild leaves every shipped byte untouched."""
    output = get_organism(syn57.ORGANISM_ID).path("outputDirectory")
    before = {path.name: path.read_bytes() for path in output.glob("*.json")}

    def interrupted(_source: Path, temporary_output: Path) -> None:
        temporary_output.mkdir(parents=True)
        (temporary_output / "partial.json").write_text("{}\n", encoding="utf-8")
        raise RuntimeError("interrupted")

    monkeypatch.setattr(syn57, "build", interrupted)
    with pytest.raises(RuntimeError, match="interrupted"):
        syn57.main(["--check", "--source", str(syn57.SOURCE)])
    assert {path.name: path.read_bytes() for path in output.glob("*.json")} == before
