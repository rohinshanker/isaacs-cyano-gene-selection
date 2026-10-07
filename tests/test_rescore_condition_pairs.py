"""Tests for the deterministic current condition-pair replay."""

from __future__ import annotations

import csv
import json
import runpy
import sys
from copy import deepcopy
from pathlib import Path

import pytest

from tools import rescore_condition_pairs as rescore
from tools.rank_condition_gaps import effective_pairs, load_inventory, read_table

ROOT = Path(__file__).resolve().parents[1]
HANDOFF = ROOT / "docs" / "notes" / "handoff"
PAIRS = HANDOFF / "cyano_package_D_pairs_20261004.tsv"
HISTORICAL_RESCORE = HANDOFF / "cyano_package_D_rescore_20261006.tsv"
HISTORICAL_INVENTORY = HANDOFF / "cyano_condition_gap_inventory_20261007.json"
RECORDS = HANDOFF / "cyano_dataset_condition_records_20261007.json"
JUDGEMENTS = ROOT / "data" / "expression" / "pair_judgements.json"
BC = HANDOFF / "cyano_package_BC_addendum_20261006.tsv"
ARCHIVE = HANDOFF / "cyano_package_B_archive_addendum_20261007.json"
INTAKE = HANDOFF / "cyano_archive_condition_intake_20261007.tsv"
MANUAL = HANDOFF / "cyano_archive_condition_manual_supplement_20261007.json"
PAPER = HANDOFF / "cyano_condition_paper_addendum_20261007.json"
PRIDE = HANDOFF / "cyano_pride_condition_check_20261007.json"
SAMPLING = HANDOFF / "cyano_condition_sampling_scope_review_20261007.json"
SCREEN = HANDOFF / "cyano_condition_pair_screen_current_20261007.tsv"
INVENTORY = HANDOFF / "cyano_condition_gap_inventory_current_20261007.json"
RANKING = HANDOFF / "cyano_condition_gap_ranking_current_20261007.tsv"


def record(**updates):
    """Return a complete minimal typed record for scorer tests."""
    value = {
        "row": 1,
        "acc": "GSE1",
        "label": "condition",
        "T": [30.0, 30.0],
        "T_text": "30 C",
        "I": [50.0, 50.0],
        "I_text": "50",
        "cont": "continuous",
        "phot": None,
        "spec": "full-spectrum LED",
        "co2": 1.0,
        "co2_text": "1%",
        "medium": "BG-11",
        "medium_text": "BG-11",
        "conditioned": False,
        "n_altered": False,
        "fmt": "planktonic liquid",
        "phase": "exponential",
        "od": [0.2, 0.3],
        "od_nm": 750,
    }
    value.update(updates)
    return value


@pytest.mark.parametrize(("left", "right", "expected"), [
    ([27.0, 31.0], [30.0, 30.0], "fail"),
    ([28.0, 32.0], [30.0, 30.0], "pass"),
    ([30.0, 30.0], [37.0, 37.0], "fail"),
    ([25.0, 25.0], [25.0, 25.0], "fail"),
    (None, [30.0, 30.0], "undecidable"),
])
def test_temperature_uses_intervals_and_named_regimes(left, right, expected):
    assert rescore.score_temperature(record(T=left), record(T=right))[0] == expected


@pytest.mark.parametrize(("left", "right", "expected"), [
    ([50.0, 55.0], [50.0, 50.0], "pass"),
    ([50.0, 50.0], [62.5, 62.5], "pass"),
    ([75.0, 100.0], [50.0, 50.0], "fail"),
    ([500.0, 500.0], [400.0, 400.0], "fail"),
    ([390.0, 410.0], [400.0, 400.0], "fail"),
    ([0.0, 0.0], [0.0, 0.0], "fail"),
    (None, [50.0, 50.0], "undecidable"),
])
def test_light_intensity_compares_full_ranges_and_400_boundary(left, right, expected):
    assert rescore.score_light_intensity(record(I=left), record(I=right))[0] == expected


@pytest.mark.parametrize(("left", "right", "expected"), [
    ({}, {}, "pass"),
    ({"spec": "cool fluorescent"}, {"spec": "cool white fluorescent"}, "fail"),
    ({"cont": None, "spec": "narrow-band LED 630/680 nm"}, {"cont": "diel", "phot": "12:12", "spec": "full-spectrum LED"}, "fail"),
    ({"cont": None, "spec": "narrow-band LED 630/680 nm"}, {"cont": "diel", "phot": "12:12", "spec": None}, "undecidable"),
    ({"cont": "diel", "phot": None}, {"cont": "diel", "phot": "12:12"}, "undecidable"),
    ({"cont": "diel", "phot": "8:16"}, {"cont": "diel", "phot": "12:12"}, "fail"),
    ({"cont": "continuous"}, {"cont": "diel", "phot": "12:12"}, "fail"),
])
def test_light_regime_has_typed_classes_and_structured_unknown(left, right, expected):
    assert rescore.score_light_regime(record(**left), record(**right))[0] == expected


@pytest.mark.parametrize(("field", "value", "message"), [
    ("spec", "mystery lamp", "unreviewed spectrum"),
    ("cont", "sometimes", "unreviewed continuity"),
])
def test_light_regime_rejects_unreviewed_typed_values(field, value, message):
    with pytest.raises(ValueError, match=message):
        rescore.score_light_regime(record(**{field: value}), record())


@pytest.mark.parametrize(("left", "right", "expected"), [
    (0.04, 0.1, "pass"),
    (1.0, 2.0, "pass"),
    (1.0, 2.1, "fail"),
    (0.5, 0.5, "fail"),
    (0.0, 1.0, "fail"),
    (None, 1.0, "undecidable"),
])
def test_co2_contract_paths(left, right, expected):
    assert rescore.score_co2(record(co2=left), record(co2=right))[0] == expected


@pytest.mark.parametrize(("updates", "expected"), [
    ({}, "pass"),
    ({"conditioned": True}, "fail"),
    ({"medium": "EPA Very Soft Water"}, "fail"),
    ({"n_altered": True}, "fail"),
    ({"medium": None}, "undecidable"),
    ({"conditioned": None}, "undecidable"),
    ({"n_altered": None}, "undecidable"),
])
def test_medium_requires_all_typed_flags(updates, expected):
    assert rescore.score_medium(record(), record(**updates))[0] == expected


@pytest.mark.parametrize(("left", "right", "expected"), [
    ({"phase": "exponential", "od": [0.2, 0.3], "od_nm": 730}, {"phase": "steady-state (held)", "od": [0.25, 0.4], "od_nm": 750}, "undecidable"),
    ({"phase": "steady-state (held)", "od": [0.1, 0.2]}, {"phase": "steady-state (held)", "od": [0.1, 0.2]}, "undecidable"),
    ({"phase": "stationary", "od": None}, {"phase": "stationary", "od": None}, "pass"),
    ({"phase": "stationary", "od": None}, {"phase": "exponential"}, "fail"),
    ({"phase": "OD stated", "od": [0.2, 0.3]}, {"phase": "OD stated", "od": [0.2, 0.3]}, "undecidable"),
    ({"phase": None, "od": [0.2, 0.3]}, {}, "undecidable"),
    ({"phase": "two phases in one set"}, {}, "undecidable"),
    ({"phase": "exponential", "od": None}, {}, "undecidable"),
])
def test_phase_requires_whitelisted_named_sampling_phase(left, right, expected):
    assert rescore._score_phase(record(**left), record(**right))[0] == expected


def test_phase_rejects_unreviewed_named_phase_even_with_overlapping_od():
    with pytest.raises(ValueError, match="unreviewed sampling phase"):
        rescore._score_phase(record(phase="log-ish"), record(phase="log-ish"))


@pytest.mark.parametrize(("left", "right", "expected"), [
    ({}, {}, "pass"),
    ({"fmt": "biofilm"}, {"fmt": "biofilm"}, "pass"),
    ({"fmt": "biofilm"}, {}, "fail"),
    ({"fmt": None}, {}, "undecidable"),
    ({"fmt": "solid plate"}, {}, "fail"),
    ({"fmt": "solid plate"}, {"fmt": "solid plate"}, "fail"),
])
def test_format_combines_with_phase_result(left, right, expected):
    assert rescore.score_format_phase(record(**left), record(**right))[0] == expected


def test_format_rejects_unreviewed_named_class():
    with pytest.raises(ValueError, match="unreviewed culture format"):
        rescore.score_format_phase(record(fmt="tube-ish"), record(fmt="tube-ish"))


def _real_inputs():
    original = read_table(PAIRS)
    historical_rows = effective_pairs(original, [read_table(HISTORICAL_RESCORE)])
    records = rescore.load_records(RECORDS)
    judgements = rescore.load_owner_judgements(JUDGEMENTS)
    statuses = load_inventory(HISTORICAL_INVENTORY, [PAIRS, HISTORICAL_RESCORE])
    screens = rescore.rescore_pairs(original, historical_rows, records, judgements)
    sources = [
        PAIRS, HISTORICAL_RESCORE, HISTORICAL_INVENTORY, RECORDS, JUDGEMENTS,
        BC, ARCHIVE, INTAKE, MANUAL, PAPER, PRIDE, SAMPLING,
    ]
    source_audit = rescore.load_current_source_audit(
        records, MANUAL, INTAKE, PRIDE
    )
    inventory = rescore.build_gap_inventory(
        records,
        rescore._old_row_statuses(historical_rows, statuses),
        sources,
        source_audit,
    )
    ranking = rescore.rank_current_gaps(screens, inventory, records)
    return screens, inventory, ranking


def test_real_941_pair_replay_and_targeted_corrections():
    screens, inventory, ranking = _real_inputs()
    assert len(screens) == 941
    assert [int(row["package_d_row"]) for row in screens] == list(range(1, 942))
    assert not any(row["default_verdict"] == "escalate" for row in screens)

    # GSE311172 lost the unsupported temporal assertion. Its reviewed narrow-band
    # class still fails a different reviewed class under the default contract.
    assert "sampling schedule unknown" in screens[441]["light_regime"]
    assert screens[441]["light_regime"].startswith("fail — spectrum fail")
    assert screens[472]["light_regime"].startswith("fail — spectrum fail")
    assert screens[724]["light_regime"].startswith("undecidable —")

    # Every pair of known distinct reviewed classes is a deterministic failure.
    explicit = next(
        row for row in screens
        if {row["condition_row_a"], row["condition_row_b"]} == {"38", "39"}
    )
    assert explicit["light_regime"].startswith("fail — spectrum fail")

    # The accepted paper values are typed, but bicarbonate is not gas CO2.
    row_725 = screens[724]
    assert "50 (50 µmol" in row_725["condition_set_a"]
    assert "photoperiod 12:12" in row_725["condition_set_a"]
    assert row_725["co2"].startswith("undecidable —")

    # Every row-35 pair retains a structured photoperiod conflict and every
    # GSE237858 pair retains the archive/paper flux conflict.
    row35 = [row for row in screens if "35" in (row["condition_row_a"], row["condition_row_b"])]
    assert row35 and all(not row["light_regime"].startswith("pass —") for row in row35)
    row33 = [row for row in screens if "33" in (row["condition_row_a"], row["condition_row_b"])]
    assert row33 and all(row["light_intensity"].startswith("undecidable —") for row in row33)
    assert all(row["temperature"].startswith("undecidable —") for row in row33)

    gaps = {(item["condition_row"], item["field"]): item for item in inventory["gaps"]}
    assert gaps[(33, "light_intensity")]["status"] == "conflicting"
    assert gaps[(33, "temperature")]["status"] == "partial"
    assert gaps[(34, "temperature")]["status"] == "partial"
    assert gaps[(35, "light_regime")]["status"] == "conflicting"
    assert "spectrum class" in gaps[(35, "light_regime")]["uncertainty"]
    # A reported plate format is known, even though the default forbids it.
    assert (35, "culture_format") not in gaps
    assert all(row["culture_format_and_phase"].startswith("fail —") for row in row35)
    assert gaps[(39, "light_regime")]["status"] == "partial"
    assert gaps[(58, "light_regime")]["status"] == "partial"
    assert "photoperiod=12:12" in gaps[(58, "light_regime")]["value"]
    assert gaps[(75, "growth_phase")]["status"] == "partial"
    assert gaps[(70, "temperature")]["status"] == "not reported"
    assert "read_fields" in gaps[(70, "temperature")]["source_provenance"]
    for key in ((22, "light_regime"), (22, "growth_phase"),
                (23, "light_regime"), (23, "growth_phase"),
                (24, "temperature"), (24, "light_regime"), (24, "growth_phase")):
        assert gaps[key]["status"] == "partial"
    for key in ((22, "light_regime"), (23, "light_regime"),
                (24, "temperature"), (24, "light_regime")):
        assert "CR-153" in gaps[key]["source_provenance"]
    assert gaps[(24, "temperature")]["value"] == "partial"
    assert gaps[(24, "temperature")]["historical_value"] == ""
    assert gaps[(2, "growth_phase")]["status"] == "partial"
    assert "OD730 0.27" in gaps[(2, "growth_phase")]["value"]
    assert all(item["value"] for item in inventory["gaps"])
    assert {item["status"] for item in inventory["gaps"]} <= set(rescore.GAP_STATUSES)
    assert all(item["source_provenance"] and item["uncertainty"] for item in ranking)

    # Owner decisions are adjacent evidence, not mutations of default verdicts.
    j2 = next(row for row in screens if {row["condition_row_a"], row["condition_row_b"]} == {"48", "53"})
    assert j2["owner_pair_call"] == "conditional"
    assert j2["default_verdict"] == "undecidable"
    j1 = next(row for row in screens if {row["condition_row_a"], row["condition_row_b"]} == {"21", "46"})
    assert j1["owner_spectrum_judgement"].startswith("J1")
    assert j1["default_verdict"] == "undecidable"
    assert {row["default_verdict"] for row in screens} <= {"comparable", "undecidable", "not comparable"}
    assert all(
        row[axis].split(" —", 1)[0] in {"pass", "fail", "undecidable"}
        for row in screens for axis in rescore.AXES
    )


def test_evidence_hash_pin_rejects_changed_source(tmp_path):
    paper = json.loads(PAPER.read_text(encoding="utf-8"))
    paper["reported_values"]["photon_flux"] = 51
    changed = tmp_path / "paper.json"
    changed.write_text(json.dumps(paper), encoding="utf-8")
    with pytest.raises(ValueError, match="paper overlay evidence SHA-256 changed"):
        rescore._validate_evidence({
            "paper": changed,
            "archive": ARCHIVE,
            "bc": BC,
            "intake": INTAKE,
            "manual": MANUAL,
            "pride": PRIDE,
        "sampling": SAMPLING,
            "pairs": PAIRS,
        })


def test_paper_overlay_requires_exact_typed_values_after_hash_pin(tmp_path, monkeypatch):
    paper = json.loads(PAPER.read_text(encoding="utf-8"))
    paper["reported_values"]["photon_flux"] = 51
    changed = tmp_path / "paper.json"
    changed.write_text(json.dumps(paper), encoding="utf-8")
    hashes = dict(rescore.EVIDENCE_SHA256)
    hashes["paper"] = rescore.sha256(changed)
    monkeypatch.setattr(rescore, "EVIDENCE_SHA256", hashes)
    with pytest.raises(ValueError, match="GSE227397 paper overlay evidence changed"):
        rescore._validate_evidence(_evidence_inputs(paper=changed))


def _evidence_inputs(**updates):
    inputs = {
        "paper": PAPER,
        "archive": ARCHIVE,
        "bc": BC,
        "intake": INTAKE,
        "manual": MANUAL,
        "pride": PRIDE,
        "sampling": SAMPLING,
        "pairs": PAIRS,
    }
    inputs.update(updates)
    return inputs


def test_current_evidence_pins_validate():
    rescore._validate_evidence(_evidence_inputs())


def test_pxd_overlay_requires_exact_values_after_hash_pin(tmp_path, monkeypatch):
    changed = tmp_path / "bc.tsv"
    changed.write_text(BC.read_text(encoding="utf-8").replace("temperature = 32 °C", "temperature = 31 °C", 1), encoding="utf-8")
    hashes = dict(rescore.EVIDENCE_SHA256)
    hashes["bc"] = rescore.sha256(changed)
    monkeypatch.setattr(rescore, "EVIDENCE_SHA256", hashes)
    with pytest.raises(ValueError, match="PXD036717 BC overlay values changed"):
        rescore._validate_evidence(_evidence_inputs(bc=changed))


@pytest.mark.parametrize(("old", "new", "message"), [
    ("CR-019\t", "CR-X19\t", "CR-019 evidence identity or scope changed"),
    ("CR-020\t", "CR-X20\t", "CR-020 evidence identity or scope changed"),
    ("flask-format samples", "whole series", "CR-153 evidence identity or scope changed"),
])
def test_intake_requires_cr020_and_cr153_scope(tmp_path, monkeypatch, old, new, message):
    changed = tmp_path / "intake.tsv"
    changed.write_text(INTAKE.read_text(encoding="utf-8").replace(old, new, 1), encoding="utf-8")
    hashes = dict(rescore.EVIDENCE_SHA256)
    hashes["intake"] = rescore.sha256(changed)
    monkeypatch.setattr(rescore, "EVIDENCE_SHA256", hashes)
    with pytest.raises(ValueError, match=message):
        rescore._validate_evidence(_evidence_inputs(intake=changed))


@pytest.mark.parametrize(("row", "field", "replacement", "message"), [
    (35, "phot", "8:16", "GSE252562 correction changed"),
    (39, "cont", "continuous", "GSE311172 correction changed"),
])
def test_archive_overlay_requires_exact_typed_corrections_after_hash_pin(
    tmp_path, monkeypatch, row, field, replacement, message
):
    data = json.loads(ARCHIVE.read_text(encoding="utf-8"))
    next(item for item in data["corrections"] if item["condition_row"] == row)["after"][field] = replacement
    changed = tmp_path / "archive.json"
    changed.write_text(json.dumps(data), encoding="utf-8")
    hashes = dict(rescore.EVIDENCE_SHA256)
    hashes["archive"] = rescore.sha256(changed)
    monkeypatch.setattr(rescore, "EVIDENCE_SHA256", hashes)
    with pytest.raises(ValueError, match=message):
        rescore._validate_evidence(_evidence_inputs(archive=changed))


def test_manual_and_pride_evidence_require_expected_shapes(tmp_path):
    manual = tmp_path / "manual.json"
    manual.write_text("[]", encoding="utf-8")
    with pytest.raises(ValueError, match="manual archive supplement"):
        rescore._validate_evidence(_evidence_inputs(manual=manual))

    pride = json.loads(PRIDE.read_text(encoding="utf-8"))
    pride["read_fields"].remove("sampleAttributes")
    changed_pride = tmp_path / "pride.json"
    changed_pride.write_text(json.dumps(pride), encoding="utf-8")
    with pytest.raises(ValueError, match="PXD023591 scoped field audit changed"):
        rescore._validate_evidence(_evidence_inputs(pride=changed_pride))


def test_row58_photoperiod_requires_exact_accepted_pair_evidence(tmp_path):
    changed = tmp_path / "pairs.tsv"
    changed.write_text(PAIRS.read_text(encoding="utf-8").replace("photoperiod: 12:12-hours", "photoperiod: not reported"), encoding="utf-8")
    with pytest.raises(ValueError, match="PXD000510 row 58 photoperiod evidence changed"):
        rescore._validate_evidence(_evidence_inputs(pairs=changed))


@pytest.mark.parametrize(("row", "field", "replacement", "message"), [
    (75, "acc", "PXD999999", "expected accession PXD036717"),
    (24, "T_text", "ambient", "audit-pinned row 24 field T_text changed"),
    (2, "phase", "exponential", "audit-pinned row 2 field phase changed"),
])
def test_record_identity_and_source_pins_fail_closed(tmp_path, row, field, replacement, message):
    data = json.loads(RECORDS.read_text(encoding="utf-8"))
    next(item for item in data if item["row"] == row)[field] = replacement
    changed = tmp_path / "records.json"
    changed.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(ValueError, match=message):
        rescore.load_records(changed)


def test_j1_resolves_four_exact_accessions_and_rows():
    records = rescore.load_records(RECORDS)
    assert rescore._j1_rows(records) == {21, 46, 47, 54}
    records[46]["acc"] = "GSE_OTHER"
    with pytest.raises(ValueError, match="GSE50908 expected only row 46"):
        rescore._j1_rows(records)


def test_sampling_phase_overlays_do_not_transfer_stock_or_dilution_od():
    records = rescore.load_records(RECORDS)
    assert (records[2]["phase"], records[2]["od"]) == ("OD stated", [0.27, 0.27])
    assert records[75]["phase"] == "exponential"
    assert records[75]["od"] is None


@pytest.mark.parametrize(("audit", "old", "message"), [
    ({}, {}, "lacks a reviewed historical status"),
    ({"99.temperature": {"status": "present", "source": "test", "uncertainty": "test"}}, {}, "present audit"),
    ({"99.temperature": {"status": "invalid", "source": "test", "uncertainty": "test"}}, {}, "invalid gap status"),
])
def test_gap_inventory_rejects_unreviewed_or_invalid_status(audit, old, message):
    missing_temperature = record(row=99, T=None)
    with pytest.raises(ValueError, match=message):
        rescore.build_gap_inventory({99: missing_temperature}, old, [], audit)


def test_gap_inventory_renders_current_status_and_preserves_historical_value():
    missing_temperature = record(row=99, T=None, T_text="stale old text")
    inventory = rescore.build_gap_inventory(
        {99: missing_temperature},
        {(99, "temperature"): ("not reported", "historical reviewed text")},
        [],
        {},
    )
    assert inventory["gaps"] == [{
        "condition_row": 99,
        "artifact": "GSE1",
        "condition_set": "condition",
        "field": "temperature",
        "status": "not reported",
        "value": "not reported",
        "source_provenance": "cyano_dataset_condition_records_20261007.json row 99; reviewed status from cyano_condition_gap_inventory_20261007.json",
        "uncertainty": "Sampling temperature has no reviewed numeric interval.",
        "historical_value": "historical reviewed text",
    }]


def test_checked_in_current_artifacts_replay_exactly():
    screens, inventory, ranking = _real_inputs()
    assert read_table(SCREEN) == screens
    assert json.loads(INVENTORY.read_text(encoding="utf-8")) == inventory
    assert read_table(RANKING) == [{key: str(value) for key, value in row.items()} for row in ranking]


def test_cli_writes_all_three_artifacts(tmp_path, capsys, monkeypatch):
    screen = tmp_path / "screen.tsv"
    inventory = tmp_path / "inventory.json"
    ranking = tmp_path / "ranking.tsv"
    args = [
        str(PAIRS), str(HISTORICAL_INVENTORY), str(RECORDS), str(JUDGEMENTS),
        str(screen), str(inventory), str(ranking),
        "--historical-rescore", str(HISTORICAL_RESCORE),
        "--bc-addendum", str(BC), "--archive-addendum", str(ARCHIVE),
        "--archive-intake", str(INTAKE), "--paper-addendum", str(PAPER),
        "--manual-supplement", str(MANUAL), "--pride-check", str(PRIDE),
    ]
    assert rescore.main(args) == 0
    assert len(read_table(screen)) == 941
    assert json.loads(inventory.read_text(encoding="utf-8"))["gaps"]
    assert read_table(ranking)
    assert "rescored 941 pairs" in capsys.readouterr().out
    monkeypatch.setattr(sys, "argv", ["rescore_condition_pairs.py", *args])
    with pytest.raises(SystemExit) as result:
        runpy.run_path(str(ROOT / "tools" / "rescore_condition_pairs.py"), run_name="__main__")
    assert result.value.code == 0


def test_known_unsupported_format_fails_without_manufacturing_metadata_gap():
    known = record(fmt="solid plate", phase=None, od=None)
    other = record()
    assert rescore.score_format_phase(known, other)[0] == "fail"
    assert rescore._gap_reason(known, "culture_format") is None
    assert rescore.score_format_phase(known, record(fmt=None))[0] == "fail"


def test_maintenance_temperature_is_not_sampling_temperature():
    records = rescore.load_records(RECORDS)
    for number in (33, 34, 35, 36):
        assert records[number]["T"] is None
        assert "maintenance" in records[number]["T_text"]
        assert rescore.score_temperature(records[number], record())[0] == "undecidable"
    screens, inventory, _ = _real_inputs()
    gaps = {(item["condition_row"], item["field"]): item for item in inventory["gaps"]}
    for number in (33, 34, 35, 36):
        assert gaps[(number, "temperature")]["status"] == "partial"


def test_reported_held_phase_and_unresolved_nitrogen_do_not_pass_defaults():
    records = rescore.load_records(RECORDS)
    assert records[61]["n_altered"] is None
    assert rescore.score_medium(records[61], record())[0] == "undecidable"
    assert rescore._gap_reason(records[61], "medium") is not None
    assert rescore._gap_reason(record(n_altered=None), "medium") is not None
    assert rescore._gap_reason(record(), "medium") is None
    held = record(phase="steady-state (held)", od=[0.3, 0.3])
    assert rescore._score_phase(held, held)[0] == "undecidable"
    assert rescore._gap_reason(held, "growth_phase") is None


def test_sampling_scope_evidence_is_pinned(tmp_path):
    changed = tmp_path / "sampling.json"
    changed.write_text(SAMPLING.read_text()+" ")
    with pytest.raises(ValueError, match="sampling overlay evidence SHA-256 changed"):
        rescore._validate_evidence(_evidence_inputs(sampling=changed))
