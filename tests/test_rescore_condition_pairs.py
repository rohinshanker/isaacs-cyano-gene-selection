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
        "phase": "OD stated",
        "od": [0.2, 0.3],
        "od_nm": 750,
    }
    value.update(updates)
    return value


def test_temperature_uses_intervals_and_named_regimes():
    assert rescore.score_temperature(record(T=[27.0, 31.0]), record(T=[30.0, 30.0]))[0] == "pass"
    assert rescore.score_temperature(record(T=[30.0, 30.0]), record(T=[37.0, 37.0]))[0] == "fail"
    assert rescore.score_temperature(record(T=None), record())[0] == "undecidable"


def test_light_intensity_compares_full_ranges_and_400_boundary():
    assert rescore.score_light_intensity(record(I=[50.0, 55.0]), record(I=[50.0, 50.0]))[0] == "pass"
    assert rescore.score_light_intensity(record(I=[75.0, 100.0]), record(I=[50.0, 50.0]))[0] == "fail"
    assert rescore.score_light_intensity(record(I=[500.0, 500.0]), record(I=[400.0, 400.0]))[0] == "fail"
    assert rescore.score_light_intensity(record(I=None), record())[0] == "undecidable"


def test_light_regime_has_structured_unknown_and_independent_failure():
    unknown_schedule = record(cont=None, spec="narrow-band LED 630/680 nm")
    full_diel = record(cont="diel", phot="12:12", spec="full-spectrum LED")
    unknown_spectrum = record(cont="diel", phot="12:12", spec=None)
    # Known full-spectrum against narrow-band is decisive despite unknown schedule.
    assert rescore.score_light_regime(unknown_schedule, full_diel)[0] == "fail"
    # Unknown spectrum never becomes a guessed equivalence.
    assert rescore.score_light_regime(unknown_schedule, unknown_spectrum)[0] == "undecidable"
    assert rescore.score_light_regime(record(), record())[0] == "pass"
    assert rescore.score_light_regime(
        record(spec="cool fluorescent"), record(spec="cool white fluorescent")
    )[0] == "undecidable"


def test_co2_medium_and_phase_contract_paths():
    assert rescore.score_co2(record(co2=1.0), record(co2=2.0))[0] == "pass"
    assert rescore.score_co2(record(co2=0.5), record(co2=0.5))[0] == "fail"
    assert rescore.score_medium(record(), record(conditioned=True))[0] == "fail"
    assert rescore.score_medium(record(), record(medium=None))[0] == "undecidable"
    # OD730/OD750 use the same typed numeric comparison under the owner decision.
    assert rescore.score_format_phase(record(od_nm=730), record(od_nm=750))[0] == "pass"
    assert rescore.score_format_phase(record(phase="stationary", od=None), record(phase="stationary", od=None))[0] == "pass"
    assert rescore.score_format_phase(record(od=None), record())[0] == "undecidable"


def _real_inputs():
    original = read_table(PAIRS)
    historical_rows = effective_pairs(original, [read_table(HISTORICAL_RESCORE)])
    records = rescore.load_records(RECORDS)
    judgements = rescore.load_owner_judgements(JUDGEMENTS)
    statuses = load_inventory(HISTORICAL_INVENTORY, [PAIRS, HISTORICAL_RESCORE])
    screens = rescore.rescore_pairs(original, historical_rows, records, judgements)
    sources = [
        PAIRS, HISTORICAL_RESCORE, HISTORICAL_INVENTORY, RECORDS, JUDGEMENTS,
        BC, ARCHIVE, INTAKE, MANUAL, PAPER, PRIDE,
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

    # GSE311172 lost the unsupported temporal assertion. Warm-white and unknown
    # spectra remain explicit unknowns rather than guessed narrow-band matches.
    assert "sampling schedule unknown" in screens[441]["light_regime"]
    assert screens[441]["light_regime"].startswith("undecidable —")
    assert screens[472]["light_regime"].startswith("undecidable —")
    assert screens[724]["light_regime"].startswith("undecidable —")

    # The one explicit class comparison remains a deterministic failure.
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

    gaps = {(item["condition_row"], item["field"]): item for item in inventory["gaps"]}
    assert gaps[(33, "light_intensity")]["status"] == "conflicting"
    assert gaps[(35, "light_regime")]["status"] == "conflicting"
    assert gaps[(39, "light_regime")]["status"] == "partial"
    assert gaps[(75, "growth_phase")]["status"] == "partial"
    assert gaps[(70, "temperature")]["status"] == "not reported"
    assert "read_fields" in gaps[(70, "temperature")]["source_provenance"]
    assert all(item["source_provenance"] and item["uncertainty"] for item in ranking)

    # Owner decisions are adjacent evidence, not mutations of default verdicts.
    j2 = next(row for row in screens if {row["condition_row_a"], row["condition_row_b"]} == {"48", "53"})
    assert j2["owner_pair_call"] == "conditional"
    assert j2["default_verdict"] == "undecidable"
    j1 = next(row for row in screens if {row["condition_row_a"], row["condition_row_b"]} == {"21", "46"})
    assert j1["owner_spectrum_judgement"].startswith("J1")
    assert j1["default_verdict"] == "undecidable"


def test_evidence_validation_rejects_changed_required_rows(tmp_path):
    paper = json.loads(PAPER.read_text(encoding="utf-8"))
    paper["reported_values"]["photon_flux"] = 51
    changed = tmp_path / "paper.json"
    changed.write_text(json.dumps(paper), encoding="utf-8")
    with pytest.raises(ValueError, match="paper overlay"):
        rescore._validate_evidence({
            "paper": changed,
            "archive": ARCHIVE,
            "bc": BC,
            "intake": INTAKE,
            "manual": MANUAL,
            "pride": PRIDE,
        })


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
