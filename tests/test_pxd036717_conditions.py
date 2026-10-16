"""Source-condition boundaries and deterministic per-bait comparison records."""

from copy import deepcopy
import hashlib
import json
from pathlib import Path
import subprocess
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import pxd036717_conditions as conditions  # noqa: E402


@pytest.fixture
def metadata():
    return json.loads(conditions.METADATA.read_text())


def test_records_keep_each_bait_and_replicate_separate(metadata):
    original = deepcopy(metadata)
    result = conditions.build_records(metadata)
    assert not result["releaseEligible"]
    assert metadata == original
    layers = result["layers"]
    assert len(layers) == len({row["id"] for row in layers}) == 16
    for bait in ("RpaA", "CikB", "NblS", "ManS"):
        records = [row for row in layers if row["bait"] == bait]
        assert [row["replicates"] for row in records] == [["A"], ["B"], ["C"], ["A", "B", "C"]]
        for layer in records:
            rec = layer["record"]
            conditions.validate_record(rec, layer["id"])
            assert rec["basis"] == "transferred" and rec["group"] == "engineered"
            assert "PCC 7942" in rec["strain"] and bait in rec["strain"]
            assert layer["optional"] == (layer["kind"] == "complete_case_mean")
            assert rec["replicates"]["count"] == len(layer["replicates"])
            assert rec["replicates"]["studyCount"] == 3
            assert rec["replicates"]["status"] == "conflicting"
            assert rec["replicates"]["sourceStatements"] == original["record"]["replicates"]["sourceStatements"]
            assert rec["samples"] == "; ".join(
                f"{bait}-APEX2 {rep} / control {rep}" for rep in layer["replicates"]
            )
    # Changes made by a downstream consumer cannot silently mutate other layers.
    layers[0]["record"]["replicates"]["sourceStatements"].clear()
    layers[0]["record"]["conditions"]["temperature"]["lo"] = 99
    assert layers[1]["record"]["replicates"]["sourceStatements"]
    assert layers[1]["record"]["conditions"]["temperature"]["lo"] == 32
    assert result["metadata"] == original and metadata == original


def test_source_metadata_keeps_growth_labeling_and_identification_distinct(metadata):
    axes = metadata["record"]["conditions"]
    assert axes["temperature"]["lo"] == axes["temperature"]["hi"] == 32
    assert axes["lightIntensity"]["lo"] == axes["lightIntensity"]["hi"] == 150
    assert axes["co2"]["lo"] == axes["co2"]["hi"] == 2
    assert axes["lightRegime"]["kind"] == "continuous"
    assert axes["medium"]["modified"] and axes["medium"]["base"] == "BG-11"
    assert axes["phase"]["status"] == "not reported"
    assert axes["phase"]["od"] is axes["phase"]["label"] is None
    assert metadata["conditionScope"]["iptgInduction"].startswith("not determined")
    assert "__IPTG" in metadata["conditionScope"]["iptgInduction"]
    assert "Coordination of carbon partitioning and photosynthesis" in metadata["record"]["citation"]["text"]
    assert metadata["record"]["citation"]["pmid"] == "37925065"
    protocol = metadata["identificationProtocol"]
    assert protocol["minimumUniquePeptides"] == protocol["minimumSpectralCounts"] == 2
    assert "spectral counts" in protocol["unavailableInWorkbook"]
    assert protocol["reportedProteinFdr"] == protocol["reportedPeptideFdr"] == 0.01
    assert "not independently" in protocol["verification"]
    assert "Mascot" in protocol["additionalDescribedWorkflow"]["software"]
    assert "Scaffold" in protocol["additionalDescribedWorkflow"]["software"]
    assert all(e["source"] in metadata["sources"] for e in metadata["evidence"].values())
    assert {e["source"] for e in metadata["record"]["replicates"]["sourceStatements"]} == {
        "article", "supplement", "archive", "archiveFiles",
    }


def test_archive_file_inventory_is_pinned_and_keeps_control_reuse_visible(metadata):
    pin = metadata["sources"]["archiveFiles"]
    raw = (conditions.METADATA.parent / pin["file"]).read_bytes()
    assert len(raw) == pin["bytes"]
    assert hashlib.sha256(raw).hexdigest() == pin["sha256"]
    files = json.loads(raw)
    assert len(files) == 24
    names = sorted(row["fileName"] for row in files if row["fileName"].endswith(".raw"))
    assert len(names) == len(set(names)) == 15
    expected = [f"CscB-SPS__IPTG_rep{i}.raw" for i in (1, 2, 3)]
    for bait in ("RpaA", "CikB", "NblS", "ManS"):
        expected.extend(f"CscB-SPS-{bait}-APEX2__IPTG_rep{i}.raw" for i in (1, 2, 3))
    assert names == sorted(expected) == metadata["rawFileInventory"]["rawFiles"]
    assert metadata["rawFileInventory"]["controlFileCount"] == 3
    assert "twelve independent biological controls" in metadata["conditionScope"]["controls"]
    assert "no file-order pairing" in metadata["conditionScope"]["controls"]


@pytest.mark.parametrize("key,value", [
    ("schemaVersion", 2), ("accession", "other"), ("baits", ["RpaA"]),
])
def test_wrong_source_contract_rejected(metadata, key, value):
    metadata[key] = value
    with pytest.raises(ValueError, match="metadata"):
        conditions.build_records(metadata)


@pytest.mark.parametrize("field,value", [
    ("studyId", "other"), ("dataType", "transcriptomics"),
    ("platform", "RNA-seq"), ("basis", "direct"), ("group", "standard"),
])
def test_source_type_and_transfer_basis_cannot_be_relabelled(metadata, field, value):
    metadata["record"][field] = value
    with pytest.raises(ValueError, match="source type and basis"):
        conditions.build_records(metadata)


@pytest.mark.parametrize("field,value", [
    ("status", "reported"), ("count", 2), ("sourceStatements", []),
])
def test_replicate_disagreement_cannot_disappear(metadata, field, value):
    metadata["record"]["replicates"][field] = value
    with pytest.raises(ValueError, match="discrepancy"):
        conditions.build_records(metadata)


def test_invalid_condition_range_rejected(metadata):
    metadata["record"]["conditions"]["temperature"]["lo"] = None
    with pytest.raises(ValueError, match="lo/hi"):
        conditions.build_records(metadata)


def test_cli_records_metadata_hash_and_reproduces_output(tmp_path):
    target = tmp_path / "nested" / "conditions.json"
    assert conditions.main(["--output", str(target)]) == 0
    first = target.read_bytes()
    raw = conditions.METADATA.read_bytes()
    doc = json.loads(first)
    assert doc["metadataSource"] == {
        "file": conditions.METADATA.name, "sha256": hashlib.sha256(raw).hexdigest(),
        "bytes": len(raw),
    }
    result = subprocess.run(
        [sys.executable, str(Path(conditions.__file__)), "--metadata",
         str(conditions.METADATA), "--output", str(target)],
        capture_output=True, text=True, check=True,
    )
    assert "no browser admission" in result.stdout
    assert target.read_bytes() == first


@pytest.mark.parametrize("alias", ["same", "symlink", "hardlink"])
def test_cli_cannot_overwrite_metadata(tmp_path, alias):
    source = tmp_path / "source.json"
    source.write_bytes(conditions.METADATA.read_bytes())
    target = source if alias == "same" else tmp_path / "alias.json"
    if alias == "symlink":
        target.symlink_to(source)
    elif alias == "hardlink":
        target.hardlink_to(source)
    before = source.read_bytes()
    with pytest.raises(SystemExit) as exc:
        conditions.main(["--metadata", str(source), "--output", str(target)])
    assert exc.value.code == 2 and source.read_bytes() == before


def test_cli_invalid_metadata_does_not_overwrite_output(tmp_path):
    source, target = tmp_path / "bad.json", tmp_path / "out.json"
    source.write_text("{}")
    target.write_text("preserve")
    with pytest.raises(ValueError):
        conditions.main(["--metadata", str(source), "--output", str(target)])
    assert target.read_text() == "preserve"
