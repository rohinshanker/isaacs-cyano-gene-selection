"""Admission and publication contracts for the complete Ec_Syn57 design."""

from __future__ import annotations

import copy
import gzip
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

import pytest
from Bio import SeqIO
from Bio.Seq import Seq

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
sys.path.insert(0, str(ROOT / "scripts"))

import build_syn57_design as syn57  # noqa: E402
from organisms import get_organism  # noqa: E402


@pytest.fixture(scope="module")
def admitted_record():
    """Parse the original pinned publisher record once for source-identity tests."""
    if not syn57.SOURCE.is_file():
        pytest.skip("pinned ignored source not fetched")
    return syn57.read_source()


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
    expected_counts = {
        "cds": 3640,
        "codon-recognition-note-reverse-complement": 75,
        "explicit-initiator-anticodon-note": 3,
        "selenocysteine-special-convention": 1,
        "unsupported": 6,
    }
    assert syn57.normalize(record, first) == expected_counts
    assert syn57.normalize(record, second) == expected_counts
    assert {path.name: path.read_bytes() for path in first.iterdir()} == {
        path.name: path.read_bytes() for path in second.iterdir()
    }
    config = get_organism(syn57.ORGANISM_ID)
    with gzip.open(first / f"{config.assemblyPrefix}_cds_from_genomic.fna.gz", "rt") as handle:
        cds_records = list(SeqIO.parse(handle, "fasta"))
    with gzip.open(first / f"{config.assemblyPrefix}_protein.faa.gz", "rt") as handle:
        protein_records = list(SeqIO.parse(handle, "fasta"))
    assert len(cds_records) == len(protein_records) == 3640
    assert len({record.id for record in protein_records}) == 3640
    assert all(record.id.startswith("Ec_Syn57_local_protein_feature_")
               for record in protein_records)
    cds_protein_ids = [
        re.search(r"\[protein_id=([^\]]+)\]", record.description).group(1)
        for record in cds_records
    ]
    assert cds_protein_ids == [record.id for record in protein_records]
    audit = json.loads((first / syn57.SOURCE_AUDIT_NAME).read_text(encoding="utf-8"))
    assert len(audit["cds"]) == 3640
    assert len(audit["trna"]) == 85
    assert sum(row["sourceIdentifierBasis"] != "locus_tag" for row in audit["cds"]) == 2
    duplicates = [row for row in audit["cds"] if row["sourceIdentifierOccurrences"] > 1]
    assert {row["sourceIdentifier"] for row in duplicates} == {"b4419", "b1716", "b1717", "b1718"}
    assert all(row["localId"] and row["localDerivedProteinId"]
               and row["sourceLocation"] for row in duplicates)
    assert len({row["localDerivedProteinId"] for row in audit["cds"]}) == 3640
    assert [row["localDerivedProteinId"] for row in audit["cds"]] == [
        record.id for record in protein_records
    ]
    assert sum(not row["originalSourceProteinIds"] for row in audit["cds"]) == 47
    source_cds = [feature for feature in record.features if feature.type == "CDS"]
    assert [row["originalSourceProteinIds"] for row in audit["cds"]] == [
        [str(value) for value in feature.qualifiers.get("protein_id", [])]
        for feature in source_cds
    ]
    assert Counter(row["evidenceRoute"] for row in audit["trna"]) == Counter({
        "codon-recognition-note-reverse-complement": 75,
        "explicit-initiator-anticodon-note": 3,
        "selenocysteine-special-convention": 1,
        "unsupported": 6,
    })
    assert sum(row["decodingPoolStatus"] == "included-approximate-model"
               for row in audit["trna"]) == 78
    assert sum(row["decodingPoolStatus"] == "excluded-selenocysteine-special-convention"
               for row in audit["trna"]) == 1
    assert sum(row["decodingPoolStatus"] == "excluded-no-supported-note"
               for row in audit["trna"]) == 6
    assert all(row["sourceAnticodonQualifier"] is None for row in audit["trna"])


@pytest.mark.parametrize(("cds", "protein"), [
    ("ATGGTGTTGTAA", "MVL"),
    ("TTGGTGTTGTAA", "MVL"),
    ("GTGTTGGTGTAA", "MLV"),
    ("ATGTAGGTGTAATAA", "M*V*"),
])
def test_local_translation_changes_only_initiation_and_one_terminal_stop(
        cds: str, protein: str) -> None:
    """ATG/TTG/GTG starts become M while internal codons and stops remain literal."""
    assert str(syn57.translate_local_protein(Seq(cds))) == protein


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
    assert syn57.sha256(output / "genes.json") == (
        "4d5f319965f1731b0be183302b94874085921ebc995e0e565e4a67f5dfa09aa7"
    )
    assert not (output / "expression_layers.json").exists()
    assert not (output / "strain_fitness.json").exists()
    source_text = json.dumps(citations)
    assert "design record, not a sequenced isolate" in source_text
    assert "CC BY-NC-ND 4.0" in source_text
    assert "Syn61" not in source_text
    assert "RefSeq" not in json.dumps(meta["metrics"])
    assert meta["tai"]["annotationBasis"] == {
        "sourceAnticodonQualifiers": 0,
        "ordinaryCodonRecognitionNotesReverseComplemented": 75,
        "explicitInitiatorAnticodonNotes": 3,
        "selenocysteineSpecialConventionExcludedFromElongatorPool": 1,
        "excludedWithoutSupportedNote": 6,
        "modeledAnnotations": 79,
        "trnaCopyTableAnnotationsAfterSecExclusion": 78,
        "interpretation": "Defined approximate annotation model, not established genomic anticodons, decoding, charging, or expression measurements.",
    }
    assert sum(meta["tai"]["tRNAGeneCopies"].values()) == 78
    assert meta["tai"]["zeroWeightSubstitution"] == pytest.approx(0.215308)
    audit = json.loads((output / syn57.SOURCE_AUDIT_NAME).read_text(encoding="utf-8"))
    assert sum(row["publicationStatus"] == "included" for row in audit["cds"]) == 3588
    assert sum(row["publicationStatus"] == "excluded" for row in audit["cds"]) == 52
    assert sum(row["publicationStatus"] == "included"
               and not row["originalSourceProteinIds"] for row in audit["cds"]) == 2


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


def test_check_rejects_corrupt_manifest_before_build_without_mutation(
        monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """A stale shipped hash fails before rebuilding and no shipped byte changes."""
    output = tmp_path / "publication"
    output.mkdir()
    (output / "meta.json").write_text('{"builtAt":"first"}\n', encoding="utf-8")
    (output / "genes.json").write_text("[]\n", encoding="utf-8")
    syn57.build_data_manifest.write_manifest(output)
    (output / "meta.json").write_text('{"builtAt":"corrupt"}\n', encoding="utf-8")
    before = {path.name: path.read_bytes() for path in output.glob("*.json")}

    class TestOrganism:
        def path(self, key: str) -> Path:
            assert key == "outputDirectory"
            return output

    build_called = False

    def unexpected_build(_source: Path, _output: Path) -> None:
        nonlocal build_called
        build_called = True

    monkeypatch.setattr(syn57, "get_organism", lambda _organism_id: TestOrganism())
    monkeypatch.setattr(syn57, "build", unexpected_build)
    with pytest.raises(syn57.Syn57BuildError,
                       match=r"shipped payload manifest is invalid: .*meta\.json changed"):
        syn57.main(["--check"])
    assert not build_called
    assert {path.name: path.read_bytes() for path in output.glob("*.json")} == before


@pytest.mark.skipif(not syn57.SOURCE.is_file(), reason="pinned ignored source not fetched")
def test_source_file_admission_rejects_missing_size_and_checksum(tmp_path: Path) -> None:
    """The byte-level admission gate rejects absent, truncated, and altered sources."""
    with pytest.raises(syn57.Syn57BuildError, match="missing pinned design source"):
        syn57.read_source(tmp_path / "missing.gb")
    too_short = tmp_path / "too-short.gb"
    too_short.write_bytes(b"LOCUS")
    with pytest.raises(syn57.Syn57BuildError, match="byte length changed"):
        syn57.read_source(too_short)
    corrupt = tmp_path / "corrupt.gb"
    content = bytearray(syn57.SOURCE.read_bytes())
    content[-1] ^= 1
    corrupt.write_bytes(content)
    with pytest.raises(syn57.Syn57BuildError, match="SHA-256 changed"):
        syn57.read_source(corrupt)


@pytest.mark.parametrize(("case", "message"), [
    ("record-count", "expected one design record"),
    ("id", "unexpected record id"),
    ("length", "unexpected design length"),
    ("topology", "design is not circular"),
    ("accessions", "design accession changed"),
    ("organism", "design organism identity changed"),
    ("description", "design description changed"),
    ("sequence", "design sequence SHA-256 changed"),
    ("feature-counts", "design annotation counts changed"),
])
def test_source_record_admission_rejects_identity_drift(
        admitted_record, monkeypatch: pytest.MonkeyPatch, case: str, message: str) -> None:
    """Every post-checksum identity pin independently rejects source-record drift."""
    record = copy.copy(admitted_record)
    record.annotations = dict(admitted_record.annotations)
    record.features = list(admitted_record.features)
    records = [record]
    if case == "record-count":
        records.append(record)
    elif case == "id":
        record.id = "not-Ec_Syn57"
    elif case == "length":
        record.seq = admitted_record.seq[:-3]
    elif case == "topology":
        record.annotations["topology"] = "linear"
    elif case == "accessions":
        record.annotations["accessions"] = ["other"]
    elif case == "organism":
        record.annotations["organism"] = "other"
    elif case == "description":
        record.description = "other"
    elif case == "sequence":
        first = "A" if admitted_record.seq[0] != "A" else "C"
        record.seq = Seq(first + str(admitted_record.seq[1:]))
    elif case == "feature-counts":
        record.features.pop()
    monkeypatch.setattr(syn57, "sha256", lambda _path: syn57.SOURCE_SHA256)
    monkeypatch.setattr(syn57.SeqIO, "parse", lambda *_args, **_kwargs: iter(records))
    with pytest.raises(syn57.Syn57BuildError, match=message):
        syn57.read_source(syn57.SOURCE)


@pytest.mark.skipif(not syn57.SOURCE.is_file(), reason="pinned ignored source not fetched")
def test_normalized_original_source_passes_full_contract(tmp_path: Path) -> None:
    """The original GenBank normalization passes every source-backed contract check."""
    normalized = tmp_path / "normalized"
    syn57.normalize(syn57.read_source(), normalized)
    result = subprocess.run(
        [sys.executable, str(ROOT / "tools/validate_contract.py"),
         "--organism", syn57.ORGANISM_ID, "--raw-dir", str(normalized)],
        cwd=ROOT, text=True, capture_output=True, check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "failed=0" in result.stdout
