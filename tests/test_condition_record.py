"""Tests for the structured condition record every expression source carries."""

import copy
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from condition_record import AXES, example_record, validate_record  # noqa: E402


def test_example_record_is_valid():
    validate_record(example_record(), "example")


def test_the_shipped_sources_carry_valid_records():
    sources = json.loads((ROOT / "data/expression/sources.json").read_text(encoding="utf-8"))
    by_id = {source["id"]: source for source in sources}
    assert len(by_id) == len(sources) == 163
    for source in sources:
        validate_record(source["record"], source["id"])
    assert by_id["GSE205444"]["record"]["basis"] == "transferred"
    assert by_id["TAN2018_TSS"]["record"]["basis"] == "direct"
    ingested = [source for source in sources if "ingest" in source]
    assert len(ingested) == 161
    assert all(source["record"]["basis"] == "transferred" for source in ingested)
    assert {source["record"]["studyId"] for source in ingested} == {
        "GSE288532", "GSE222067", "GSE327989", "GSE79726", "GSE89999", "GSE104203", "PXD062851",
        "GSE205443", "PXD030282", "PXD000510", "PXD005851",
        "GSE103462", "GSE103463", "GSE103644", "GSE103704", "GSE105774", "GSE237858", "GSE254350", "GSE335065",
        "GSE51112", "GSE252562", "GSE225426", "GSE311172",
        "FitnessBrowser_SynE",
    }


@pytest.mark.parametrize(
    "mutate, message",
    [
        (lambda r: r.update(dataType="metabolomics"), "dataType must be one of"),
        (lambda r: r.update(group="misc"), "group must be one of"),
        (lambda r: r.update(archiveUrl="http://example.org"), "archiveUrl must be https"),
        (lambda r: r.update(citation={"text": "x", "url": "ftp://x"}), "citation needs an https url"),
        (lambda r: r.update(replicates={"count": 0, "text": "x"}), "replicates count must be"),
        (lambda r: r.update(treatments=["", "salt"]), "treatments must be a list"),
        (lambda r: r.update(conditionTableRow=0), "conditionTableRow must be"),
        (lambda r: r["conditions"].pop("co2"), "exactly the axes"),
        (lambda r: r["conditions"]["temperature"].update(status="guessed"), "invalid status"),
        (lambda r: r["conditions"]["temperature"].update(lo=35, hi=30), "ordered numeric range"),
        (lambda r: r["conditions"]["temperature"].update(where=""), "names no source location"),
        (lambda r: r["conditions"]["co2"].update(lo=1), "lo and hi must be null"),
        (lambda r: r["conditions"]["co2"].update(unit="ppm"), "must use the unit"),
        (lambda r: r["conditions"]["lightRegime"].update(kind="flashing"), "kind must be one of"),
        (lambda r: r["conditions"]["lightRegime"].update(photoperiod="twelve"), "photoperiod must look like"),
        (lambda r: r["conditions"]["lightRegime"].update(entrained="yes"), "entrained must be a boolean"),
        (lambda r: r["conditions"]["medium"].update(conditioned="no"), "conditioned must be a boolean"),
        (lambda r: r["conditions"]["format"].update(value=""), "format value must be"),
        (lambda r: r["conditions"]["phase"].update(label="lag"), "phase label must be one of"),
        (lambda r: r["conditions"]["phase"].update(od=[0.5, 0.3]), "od must be a two-number"),
        (lambda r: r["conditions"]["phase"].update(odNm=601), "odNm must be 600, 730, 750 or null"),
        (lambda r: r["conditions"]["phase"].update(odNm=None), "od needs its wavelength"),
    ],
)
def test_each_rule_names_what_is_wrong(mutate, message):
    record = copy.deepcopy(example_record())
    mutate(record)
    with pytest.raises(ValueError, match=message):
        validate_record(record, "t")


def test_a_conflicting_axis_may_state_the_span_it_covers():
    record = example_record()
    record["conditions"]["temperature"].update(status="conflicting", lo=33, hi=45)
    validate_record(record, "t")
    record["conditions"]["temperature"].update(lo=None, hi=None)
    validate_record(record, "t")


def test_non_object_inputs_are_named():
    with pytest.raises(ValueError, match="record must be an object"):
        validate_record([], "t")
    record = example_record()
    record["conditions"]["medium"] = "BG-11"
    with pytest.raises(ValueError, match="axis medium must be an object"):
        validate_record(record, "t")
    assert len(AXES) == 7


def test_gse252562_sampling_temperature_preserves_maintenance_scope():
    """The public record must not transfer a maintenance value to LD treatment."""
    root = Path(__file__).resolve().parents[1]
    spec = json.loads((root / "data/expression/ingest/GSE252562.json").read_text())
    published = json.loads((root / "data/expression/sources.json").read_text())
    expected_ids = {layer["id"] for layer in spec["layers"]}
    records = [row for row in published if row["id"] in expected_ids]
    assert len(records) == len(expected_ids) == 6
    for row in records:
        value = row["record"]["conditions"]["temperature"]
        assert value["status"] == "not reported"
        assert value["lo"] is None and value["hi"] is None
        assert "maintenance at 30°C" in value["text"]
        assert "30ºC" in value["quote"]


def test_gse237858_sampling_temperature_preserves_maintenance_scope():
    """A plate-maintenance value must not transfer across the dark-pulse treatment."""
    root = Path(__file__).resolve().parents[1]
    spec = json.loads((root / "data/expression/ingest/GSE237858.json").read_text())
    published = json.loads((root / "data/expression/sources.json").read_text())
    expected_ids = {layer["id"] for layer in spec["layers"]}
    records = [row for row in published if row["id"] in expected_ids]
    assert len(records) == len(expected_ids) == 1
    for source in (spec, *(row["record"] for row in records)):
        value = source["conditions"]["temperature"]
        assert value["status"] == "not reported"
        assert value["lo"] is None and value["hi"] is None
        assert "maintenance at 30°C" in value["text"]
        assert "constant 30ºC" in value["quote"]


def gse205443_records():
    """The nine published GSE205443 fitness layers, spec order preserved."""
    root = Path(__file__).resolve().parents[1]
    spec = json.loads((root / "data/expression/ingest/GSE205443.json").read_text())
    published = {row["id"]: row for row in
                 json.loads((root / "data/expression/sources.json").read_text())}
    rows = [published[layer["id"]] for layer in spec["layers"]]
    assert len(rows) == 9
    return spec, rows


def test_gse205443_reports_its_lighting_without_claiming_a_schedule():
    """The methods give a fluorescent spectrum and an intensity, never a photoperiod.

    A reader must not be able to filter or group these assays as verified
    continuous-light experiments, while the lighting that *is* reported stays.
    """
    spec, rows = gse205443_records()
    for source in (spec, *(row["record"] for row in rows)):
        regime = source["conditions"]["lightRegime"]
        assert regime["status"] == "not reported"
        assert regime["kind"] is None and regime["photoperiod"] is None
        assert regime["spectrumClass"] == "fluorescent", "the reported spectrum is kept"
        intensity = source["conditions"]["lightIntensity"]
        assert (intensity["status"], intensity["lo"], intensity["hi"]) == ("reported", 5, 5)


def test_gse205443_describes_each_vessel_and_counts_no_replicates():
    """Pooling before DNA extraction is reported; the vessel is per layer.

    The Figure 3A caption states that triplicate samples were pooled prior to
    DNA extraction, so the pooling stands. Only the vessel was wrong: the flask
    layers were described as tubes. One Fitness column per fraction is the
    pooled measurement and is never read as a replicate count.
    """
    _, rows = gse205443_records()
    flasks = [row for row in rows if "flask" in row["id"]]
    tubes = [row for row in rows if "flask" not in row["id"]]
    assert (len(flasks), len(tubes)) == (2, 7)
    for row in rows:
        replicates = row["record"]["replicates"]
        assert replicates["count"] is None, "no biological replicate count is inferred"
        assert "pooled prior to DNA extraction" in replicates["text"]
        assert "Figure 3A" in replicates["where"]
        assert len(row["ingest"]["columns"]) == 1
    # The flask layers describe flasks; only the tube layers may mention tubes.
    assert {row["record"]["replicates"]["text"] for row in flasks} != \
        {row["record"]["replicates"]["text"] for row in tubes}
    for row in flasks:
        for field in (row["record"]["replicates"]["text"], row["record"]["samples"]):
            assert "tube" not in field.lower() and "triplicate" not in field.lower()
        assert "flask" in row["record"]["conditions"]["format"]["text"].lower()
    for row in tubes:
        assert "bubbling tubes" in row["record"]["replicates"]["text"]


def test_gse205443_experiment_1_od_evidence_matches_the_stage_it_shows():
    """0.5 is the resuspension for the assay; 0.4 is the pooled starter.

    The displayed value was already the assay-start density; its quote used to
    be the starter sentence, which cannot substantiate it.
    """
    _, rows = gse205443_records()
    for row in rows:
        phase = row["record"]["conditions"]["phase"]
        assert phase["od"] == [0.5, 0.5] and phase["odNm"] == 750
        assert "0.4" not in phase["quote"], "the pooled starter cannot support the assay OD"
        assert "0.5" in phase["quote"]
        assert "harvested fraction's growth phase is not reported" in phase["text"]


def test_every_fitness_layer_describes_a_weighted_normalized_score():
    """Finding 04: the value is not one raw barcode or count ratio.

    Wetmore's gene fitness is the weighted average of per-strain log2 count
    ratios, with pseudocounts and per-scaffold normalization, so a reader must
    not try to reconstruct it as a single gene-level ratio.
    """
    root = Path(__file__).resolve().parents[1]
    published = json.loads((root / "data/expression/sources.json").read_text())
    fitness = [row for row in published if row["record"]["dataType"] == "fitness"]
    assert len(fitness) == 99
    for row in fitness:
        units = row["units"]
        assert "weighted" in units and "normalized" in units and "log2" in units
        assert "Wetmore et al. 2015" in units
        assert "ratio of barcode abundance" not in units
