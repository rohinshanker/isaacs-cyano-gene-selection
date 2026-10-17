"""Exact native label coverage, scientific boundaries, and safe CLI publication."""

from copy import deepcopy
import hashlib
import json
from pathlib import Path
import subprocess
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import pxd044412_conditions as conditions  # noqa: E402


@pytest.fixture
def metadata():
    return json.loads(conditions.METADATA.read_bytes())


@pytest.fixture
def inventory():
    return json.loads(conditions.INVENTORY.read_bytes())


def test_exact_native_coverage_and_all_record_boundaries(metadata, inventory):
    before = deepcopy((metadata, inventory))
    result = conditions.build_records(metadata, inventory)
    assert (metadata, inventory) == before
    assert result == conditions.build_records(metadata, inventory)
    assert result["releaseEligible"] is False
    layers = result["layers"]
    assert len(layers) == len({layer["id"] for layer in layers}) == 42
    assert {layer["sourceLabel"] for layer in layers} == set(inventory["bySourceLabel"])
    assert sum(layer["coverage"]["nativeSourceRows"] for layer in layers) == 391900
    assert result["attribution"]["datasetDoi"].endswith("23939604.v1")
    assert result["attribution"]["licenceUrl"] == "https://creativecommons.org/licenses/by/4.0/"
    assert len(result["limits"]) == 8
    for layer in layers:
        label = layer["sourceLabel"]
        record = layer["record"]
        conditions.validate_record(record, label)
        assert layer["kind"] == "candidate_comparison"
        assert layer["releaseEligible"] is record["releaseEligible"] is False
        assert record["sourceLabel"] == label
        assert record["candidateDose"]["mappingStatus"] == "inferred"
        assert record["candidateDose"]["tier"] == ("low" if label.endswith("_1") else "high")
        assert label in record["conditionSet"] and "candidate" in record["conditionSet"]
        assert "no-added-metabolite control" in record["conditionSet"]
        assert record["replicates"] == metadata["record"]["replicates"]
        assert record["replicates"]["count"] is None
        assert record["contrast"]["numerator"] is record["contrast"]["denominator"] is None
        assert record["contrast"]["status"] == "not verified"
        assert record["assay"]["biologicalCultivationsPooled"] == 4
        assert record["assay"]["technicalReplicatesPerGroup"] == 4
        assert record["assay"]["sharedExtract"] is True
        assert record["assay"]["control"]["addedMetabolite"] is False
        assert record["conditions"] == metadata["record"]["conditions"]
        assert record["conditions"]["temperature"]["lo"] is None
        assert record["conditions"]["lightRegime"]["kind"] is None
        assert record["conditions"]["lightIntensity"]["lo"] == 70
        assert record["assay"]["temperatureC"] == 25
        assert record["preFreezingHandling"]["lightIntensity"] == 400
        assert layer["coverage"]["nativeSourceRows"] == inventory["bySourceLabel"][label]["rows"]
        for key in ("assay", "contrast", "preFreezingHandling", "sources", "paperExcerpts",
                    "labelMapping", "basisScope"):
            assert record[key] == metadata[key]
        assert record["basis"] == "transferred"
        assert record["strain"] == "Synechococcus elongatus PCC 7942"


@pytest.mark.parametrize("code,name,low,high", [
    ("2PG", "2-phosphoglycolate", 0.2, 4), ("ATP", "ATP", 2, 32),
    ("PEP", "Phosphoenolpyruvate", 0.5, 10), ("Suc", "Sucrose", 1, 10),
])
def test_candidate_dose_examples_keep_table_cells(metadata, inventory, code, name, low, high):
    layers = {layer["sourceLabel"]: layer["record"]
              for layer in conditions.build_records(metadata, inventory)["layers"]}
    original = next(item for item in metadata["metabolites"] if item["code"] == code)
    for suffix, tier, value in ((1, "low", low), (2, "high", high)):
        record = layers[f"{code}_{suffix}"]
        assert record["metabolite"] == original
        assert record["metabolite"]["name"] == name
        assert record["candidateDose"] == {
            "raw": original[tier], "value": value, "unit": "mM", "tier": tier,
            "mappingStatus": "inferred", "where": original["where"],
        }
        assert f"{name} {tier} {original[tier]} mM" in record["conditionSet"]


def test_deep_mutation_isolation_in_both_directions(metadata, inventory):
    result = conditions.build_records(metadata, inventory)
    pristine = deepcopy(result)
    metadata["record"]["conditions"]["medium"]["base"] = "changed"
    metadata["sources"]["article"]["url"] = "changed"
    metadata["metabolites"][0]["sourceLabels"].append("changed")
    inventory["bySourceLabel"]["2OG_1"]["rows"] = 0
    assert result == pristine
    result["metadata"]["assay"]["control"]["text"] = "changed"
    first = result["layers"][0]["record"]
    first["assay"]["control"]["text"] = "changed"
    first["sources"]["article"]["url"] = "changed"
    first["metabolite"]["sourceLabels"].append("changed")
    first["conditions"]["phase"]["od"][0] = 99
    assert result["layers"][1:] == pristine["layers"][1:]


def replace_at(obj, path, value):
    for key in path[:-1]:
        obj = obj[key]
    if value == "DELETE":
        del obj[path[-1]]
    else:
        obj[path[-1]] = value


@pytest.mark.parametrize("path,value", [
    (("schemaVersion",), 2), (("schemaVersion",), True), (("accession",), "PXD036717"),
    (("sourceSha256",), "0" * 64), (("releaseEligible",), True), (("basisScope",), " "),
    (("labelMapping",), None), (("labelMapping", "status"), "verified"),
    (("labelMapping", "doseCodes"), {"1": "high", "2": "low"}),
    (("labelMapping", "text"), ""), (("contrast", "status"), "verified"),
    (("contrast", "numerator"), "treatment"), (("contrast", "denominator"), "control"),
    (("contrast", "design"), ""), (("assay", "temperatureC"), 30),
    (("assay", "sharedExtract"), 1), (("assay", "material"), None),
    (("assay", "control", "addedMetabolite"), True),
    (("assay", "control", "text"), ""), (("preFreezingHandling", "lightIntensity"), 70),
    (("preFreezingHandling", "where"), ""), (("sources",), []),
    (("sources", "article"), None), (("sources", "article", "url"), "http://example.org"),
    (("sources", "article", "sha256"), "bad"), (("sources", "article", "sha256"), None),
    (("sources", "article", "retrieved"), ""), (("sources", "article", "bytes"), True),
    (("sources", "supplement", "pdfPages"), [True, 30]),
    (("sources", "supplement", "member"), ""), (("sources", "analysisCode", "scope"), ""),
    (("paperExcerpts", "technical", "quote"), ""), (("record",), []),
    (("record", "studyId"), "other"), (("record", "basis"), "direct"),
    (("record", "citation"), None), (("record", "citation", "url"), "https://example.org"),
    (("record", "replicates", "count"), 4), (("record", "replicates", "count"), 1),
    (("record", "replicates", "status"), "reported"),
    (("record", "conditions", "temperature", "status"), "reported"),
    (("record", "conditions", "lightRegime", "kind"), "continuous"),
    (("record", "conditions", "lightIntensity", "lo"), float("nan")),
    (("record", "conditions", "co2", "lo"), True),
    (("record", "conditions", "phase", "od"), [True, 1]),
    (("record", "conditions", "temperature", "where"), ""),
    (("record", "conditions", "medium", "quote"), ""),
    (("metabolites",), None), (("metabolites", 0), None),
    (("metabolites", 0, "code"), "unknown"), (("metabolites", 1, "code"), "2OG"),
    (("metabolites", 0, "name"), ""), (("metabolites", 0, "kegg"), 1),
    (("metabolites", 0, "where"), "DELETE"), (("metabolites", 0, "mappingStatus"), "verified"),
    (("metabolites", 0, "unit"), "µM"),
    (("metabolites", 0, "sourceLabels"), ["2OG_1", "2OG_1"]),
    (("metabolites", 0, "sourceLabels"), ["2OG_1"]),
    (("metabolites", 0, "sourceLabels"), ["2OG_1", "other_2"]),
    (("metabolites", 0, "sourceLabels"), ["2OG_1", "2OG_2", "extra_1"]),
])
def test_reject_changed_metadata_contract(metadata, inventory, path, value):
    replace_at(metadata, path, value)
    with pytest.raises(ValueError):
        conditions.build_records(metadata, inventory)


@pytest.mark.parametrize("bad", [None, True, False, 1, 0.2, -1, float("nan"),
                                      float("inf"), "NaN", "inf", "1e309", "0", "-1",
                                      "", " 1", "1 ", "1_0", "1e0", "9" * 400])
@pytest.mark.parametrize("tier", ["low", "high"])
def test_reject_invalid_or_unpreserved_dose_cells(metadata, inventory, bad, tier):
    metadata["metabolites"][0][tier] = bad
    with pytest.raises(ValueError):
        conditions.build_records(metadata, inventory)


@pytest.mark.parametrize("low,high", [("10", "1"), ("1", "1")])
def test_reject_unordered_doses(metadata, inventory, low, high):
    metadata["metabolites"][0].update(low=low, high=high)
    with pytest.raises(ValueError, match="strictly less"):
        conditions.build_records(metadata, inventory)


@pytest.mark.parametrize("path,value", [
    (("sourceSha256",), "wrong"), (("labelCount",), True), (("labelCount",), 41),
    (("bySourceLabel",), []), (("bySourceLabel", "2OG_1"), None),
    (("bySourceLabel", "2OG_1", "rows"), 0), (("bySourceLabel", "2OG_1", "rows"), True),
    (("bySourceLabel", "2OG_1", "rows"), 1.5), (("sourceRows",), True),
    (("sourceRows",), 1), (("bySourceLabel", "2OG_1"), "DELETE"),
])
def test_reject_invalid_inventory(metadata, inventory, path, value):
    replace_at(inventory, path, value)
    with pytest.raises(ValueError):
        conditions.build_records(metadata, inventory)


def test_reject_extra_native_label_and_missing_metabolite(metadata, inventory):
    inventory["bySourceLabel"]["unknown_1"] = {"rows": 1}
    with pytest.raises(ValueError, match="42 expected"):
        conditions.build_records(metadata, inventory)
    metadata["metabolites"].pop()
    with pytest.raises(ValueError, match="21 metabolites"):
        conditions.build_records(metadata, json.loads(conditions.INVENTORY.read_bytes()))


@pytest.mark.parametrize("metadata,inventory", [(None, {}), ([], {}), ({}, None)])
def test_nonobject_inputs(metadata, inventory):
    with pytest.raises(ValueError):
        conditions.build_records(metadata, inventory)


def test_reject_nonobject_inventory(metadata):
    with pytest.raises(ValueError, match="inventory must be an object"):
        conditions.build_records(metadata, [])


def test_order_independence_and_raw_cell_preservation(metadata, inventory):
    metadata["metabolites"][0]["low"] = "1.00"
    expected = conditions.build_records(metadata, inventory)
    metadata["metabolites"].reverse()
    reordered = conditions.build_records(metadata, inventory)
    assert reordered["layers"] == expected["layers"]
    assert reordered["metadata"] == metadata
    record = expected["layers"][0]["record"]
    assert record["candidateDose"]["raw"] == "1.00"
    assert record["candidateDose"]["value"] == 1


def test_cli_deterministic_output_and_input_receipts(tmp_path, capsys):
    one, two = tmp_path / "one.json", tmp_path / "two.json"
    assert conditions.main(["--output", str(one)]) == 0
    assert conditions.main(["--metadata", str(conditions.METADATA),
                            "--inventory", str(conditions.INVENTORY), "--output", str(two)]) == 0
    assert one.read_bytes() == two.read_bytes()
    result = json.loads(one.read_bytes())
    for key, path in (("metadata", conditions.METADATA), ("inventory", conditions.INVENTORY)):
        raw = path.read_bytes()
        assert result["inputSources"][key] == {
            "file": path.name, "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw),
        }
    assert "42 candidate" in capsys.readouterr().out
    assert sorted(path.name for path in tmp_path.iterdir()) == ["one.json", "two.json"]


@pytest.mark.parametrize("kind", ["file", "directory", "symlink", "dangling", "metadata", "inventory", "hardlink"])
def test_cli_protects_every_existing_destination(tmp_path, kind):
    output = tmp_path / "output"
    source_before = conditions.METADATA.read_bytes(), conditions.INVENTORY.read_bytes()
    if kind == "file":
        output.write_text("keep")
    elif kind == "directory":
        output.mkdir()
    elif kind in ("symlink", "dangling"):
        output.symlink_to(conditions.METADATA if kind == "symlink" else tmp_path / "missing")
    elif kind == "hardlink":
        output.hardlink_to(conditions.METADATA)
    else:
        output = conditions.METADATA if kind == "metadata" else conditions.INVENTORY
    with pytest.raises(SystemExit) as error:
        conditions.main(["--output", str(output)])
    assert error.value.code == 2
    assert (conditions.METADATA.read_bytes(), conditions.INVENTORY.read_bytes()) == source_before
    if kind == "file":
        assert output.read_text() == "keep"
    assert not list(tmp_path.glob(".pxd044412-*"))


@pytest.mark.parametrize("raw", [b"{", b"\xff", b'{"a":1,"a":2}', b"{}"])
def test_cli_invalid_input_never_publishes(tmp_path, raw):
    source, output = tmp_path / "metadata.json", tmp_path / "output.json"
    source.write_bytes(raw)
    with pytest.raises(SystemExit) as error:
        conditions.main(["--metadata", str(source), "--output", str(output)])
    assert error.value.code == 2
    assert sorted(p.name for p in tmp_path.iterdir()) == ["metadata.json"]


def test_cli_missing_parent_and_input(tmp_path):
    output = tmp_path / "missing" / "output.json"
    with pytest.raises(SystemExit):
        conditions.main(["--output", str(output)])
    assert not output.parent.exists()
    with pytest.raises(SystemExit):
        conditions.main(["--inventory", str(tmp_path / "absent.json"),
                         "--output", str(tmp_path / "output.json")])
    assert not list(tmp_path.iterdir())


@pytest.mark.parametrize("operation", ["fsync", "link"])
def test_cli_write_failure_removes_staging(tmp_path, monkeypatch, operation):
    def fail(*args):
        raise OSError("injected write failure")

    monkeypatch.setattr(conditions.os, operation, fail)
    with pytest.raises(SystemExit):
        conditions.main(["--output", str(tmp_path / "output.json")])
    assert not list(tmp_path.iterdir())


def test_destination_created_during_write_is_preserved(tmp_path, monkeypatch):
    output = tmp_path / "output.json"
    original_link = conditions.os.link

    def racing_link(source, destination):
        output.write_text("other writer")
        original_link(source, destination)

    monkeypatch.setattr(conditions.os, "link", racing_link)
    with pytest.raises(SystemExit):
        conditions.main(["--output", str(output)])
    assert output.read_text() == "other writer"
    assert list(tmp_path.iterdir()) == [output]


def test_serialization_failure_leaves_no_output(metadata, tmp_path):
    metadata["unused"] = float("nan")
    source = tmp_path / "metadata.json"
    source.write_text(json.dumps(metadata))
    with pytest.raises(SystemExit):
        conditions.main(["--metadata", str(source), "--output", str(tmp_path / "output.json")])
    assert list(tmp_path.iterdir()) == [source]


def test_script_entrypoint(tmp_path):
    output = tmp_path / "output.json"
    result = subprocess.run([sys.executable, str(Path(conditions.__file__)), "--output", str(output)],
                            capture_output=True, text=True, check=False)
    assert result.returncode == 0, result.stderr
    assert len(json.loads(output.read_bytes())["layers"]) == 42
