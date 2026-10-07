"""Gap-ranking contracts, including the actual Package D snapshot."""

import hashlib
import json
import runpy
import sys
from pathlib import Path

import pytest

from tools import rank_condition_gaps as gaps
from tests.test_pair_review_sheet import make_row, write_table

ROOT = Path(__file__).resolve().parents[1]
HANDOFF = ROOT / "docs/notes/handoff"


def pair(**overrides):
    """One unknown CO2 field, all other fields present and screens passing."""
    row = make_row("GSE1", "GSE2", "undecidable", 5)
    row["condition_set_b"] = row["condition_set_b"].replace("growth_phase=", "growth_phase=OD750 0.3")
    row.update(light_intensity="pass", culture_format_and_phase="pass")
    row.update(overrides)
    return row


def inventory(rows):
    return {(field, text): "not reported" if text == "" else "present"
            for field, text in gaps.cell_values(rows)}


def pin(path, sources, statuses):
    path.write_text(json.dumps({
        "sources": [{"name": s.name, "sha256": hashlib.sha256(s.read_bytes()).hexdigest()}
                    for s in sources],
        "reviewed_by": "test reviewer",
        "judgments": [{"field": f, "value": v, "status": s}
                      for (f, v), s in statuses.items()],
    }))


def test_one_missing_cell_counts_a_conditional_last_blocker():
    row = pair()
    result = gaps.rank_gaps([row], inventory([row]))
    assert len(result) == 1
    assert result[0]["condition_row"] == 3
    assert result[0]["field"] == "co2"
    assert result[0]["all_pairs"] == result[0]["undecidable_pairs"] == 1
    assert result[0]["last_blocker_pairs"] == 1
    assert result[0]["pair_rows"] == "1"


def test_two_sides_missing_same_axis_require_both_cells():
    row = pair()
    row["condition_set_b"] = row["condition_set_b"].replace("co2=1%", "co2=")
    result = gaps.rank_gaps([row], inventory([row]))
    assert len(result) == 2
    assert all(r["last_blocker_pairs"] == 0 for r in result)


def test_combined_format_phase_axis_requires_each_missing_component():
    row = pair(culture_format_and_phase="undecidable", co2="pass")
    row["condition_set_a"] = row["condition_set_a"].replace("culture_format=flask", "culture_format=")
    row["condition_set_b"] = row["condition_set_b"].replace("growth_phase=OD750 0.3", "growth_phase=")
    result = gaps.rank_gaps([row], inventory([row]))
    assert len(result) == 3
    assert all(r["last_blocker_pairs"] == 0 for r in result)


def test_unknown_screen_with_present_cells_stays_an_independent_blocker():
    row = pair(light_regime="undecidable — uncertain lamp comparison")
    assert gaps.rank_gaps([row], inventory([row]))[0]["last_blocker_pairs"] == 0


def test_non_undecidable_pairs_affect_reach_but_not_opportunity():
    rows = [pair(), pair(verdict="not comparable"), pair(verdict="escalate")]
    result = gaps.rank_gaps(rows, inventory(rows))
    assert result[0]["all_pairs"] == 3
    assert result[0]["undecidable_pairs"] == result[0]["last_blocker_pairs"] == 1


def test_same_cell_on_both_sides_is_counted_once():
    row = pair()
    row["condition_set_b"] = row["condition_set_a"]
    result = gaps.rank_gaps([row], inventory([row]))
    assert result[0]["all_pairs"] == result[0]["undecidable_pairs"] == 1


def test_ordering_and_partial_conflicting_uncertain_states():
    rows = [pair(), pair(artifact_b="GSE3")]
    rows[1]["condition_set_b"] = rows[1]["condition_set_b"].replace("row 9", "row 10").replace("medium=BG-11", "medium=conflicting")
    rows[1]["medium"] = "undecidable"
    states = inventory(rows)
    states["medium", "conflicting"] = "conflicting"
    states["light_regime", "continuous"] = "partial"
    states["growth_phase", "OD750 0.3"] = "uncertain"
    result = gaps.rank_gaps(rows, states)
    assert result[0]["field"] == "co2"
    assert result[0]["last_blocker_pairs"] == 1
    assert {r["status"] for r in result} == {"not reported", "partial", "conflicting", "uncertain"}


def test_overlay_changes_only_identified_screen_but_refreshes_conditions():
    rows = [pair(), pair(artifact_b="GSE3")]
    overlay = {**rows[0], "package_d_row": "1", "verdict": "comparable", "co2": "pass"}
    overlay["condition_set_a"] = overlay["condition_set_a"].replace("co2= ;;", "co2=1% ;;")
    result = gaps.effective_pairs(rows, [[overlay]])
    assert result[0]["verdict"] == "comparable"
    assert result[1]["verdict"] == "undecidable"
    assert "co2=1% ;;" in result[1]["condition_set_a"]
    assert rows[0]["verdict"] == "undecidable"
    assert gaps.rank_gaps(result, inventory(result)) == []
    assert gaps.effective_pairs(rows, []) == rows


@pytest.mark.parametrize("number", ["0", "3"])
def test_overlay_rejects_out_of_range_rows(number):
    with pytest.raises(ValueError, match="invalid or duplicate"):
        gaps.effective_pairs([pair()], [[{**pair(), "package_d_row": number}]])


def test_overlay_rejects_duplicate_rows_pairs_and_wrong_pair():
    overlay = {**pair(), "package_d_row": "1"}
    with pytest.raises(ValueError, match="invalid or duplicate"):
        gaps.effective_pairs([pair()], [[overlay, overlay]])
    with pytest.raises(ValueError, match="duplicate pair"):
        gaps.effective_pairs([pair(), pair()], [])
    with pytest.raises(ValueError, match="different pair"):
        gaps.effective_pairs([pair()], [[{**overlay, "artifact_b": "other"}]])
    with pytest.raises(ValueError, match="different pair"):
        gaps.effective_pairs([pair()], [[{**overlay, "data_type": "proteomics"}]])


def test_overlay_rejects_conflicting_condition_revisions_and_latest_wins():
    rows = [pair(), pair(artifact_b="GSE3")]
    a = {**rows[0], "package_d_row": "1"}
    b = {**rows[1], "package_d_row": "2"}
    b["condition_set_a"] = b["condition_set_a"].replace("co2= ;;", "co2=1% ;;")
    with pytest.raises(ValueError, match="conflicting condition revision"):
        gaps.effective_pairs(rows, [[a, b]])
    assert gaps.effective_pairs(rows, [[a], [b]])[0]["condition_set_a"] == b["condition_set_a"]


def test_inventory_requires_exact_pins_review_and_unique_valid_values(tmp_path):
    table = tmp_path / "pairs.tsv"
    write_table(table, [pair()])
    path = tmp_path / "inventory.json"
    pin(path, [table], inventory([pair()]))
    original = json.loads(path.read_text())
    assert gaps.load_inventory(path, [table]) == inventory([pair()])
    mutations = [
        (lambda d: d.update(sources=[]), "pins differ"),
        (lambda d: d.update(reviewed_by=""), "named reviewer"),
        (lambda d: d.update(classification_contract={"statuses": ["bad"]}), "status contract"),
        (lambda d: d["judgments"].append(d["judgments"][0]), "duplicate or invalid"),
        (lambda d: d["judgments"][0].update(field="bad"), "duplicate or invalid"),
        (lambda d: d["judgments"][0].update(status="bad"), "duplicate or invalid"),
    ]
    for mutate, message in mutations:
        data = json.loads(json.dumps(original))
        mutate(data)
        path.write_text(json.dumps(data))
        with pytest.raises(ValueError, match=message):
            gaps.load_inventory(path, [table])


def test_reject_missing_unreviewed_and_unknown_inputs():
    row = pair()
    row["condition_set_a"] += " ;; unexpected=x"
    with pytest.raises(ValueError, match="missing or unexpected"):
        gaps.cell_values([row])
    for states in [{}, {**inventory([pair()]), ("co2", ""): "bad"},
                   {**inventory([pair()]), ("co2", "old value"): "present"}]:
        with pytest.raises(ValueError, match="cover exactly"):
            gaps.rank_gaps([pair()], states)
    for row, message in [(pair(verdict="bad"), "invalid verdict"),
                         (pair(co2="invented"), "invalid co2 screen")]:
        with pytest.raises(ValueError, match=message):
            gaps.rank_gaps([row], inventory([row]))


def test_cli_and_script_entry_point_write_reproducible_tsv(tmp_path, monkeypatch, capsys):
    table = tmp_path / "pairs.tsv"
    write_table(table, [pair()])
    path = tmp_path / "inventory.json"
    pin(path, [table], inventory([pair()]))
    out = tmp_path / "rank.tsv"
    args = [str(table), str(path), str(out)]
    assert gaps.main(args) == 0
    assert b"\r" not in out.read_bytes()
    assert gaps.read_table(out)[0]["last_blocker_pairs"] == "1"
    assert "ranked 1 gaps across 1 pairs; 1 undecidable" in capsys.readouterr().out
    monkeypatch.setattr(sys, "argv", ["rank_condition_gaps.py", *args])
    with pytest.raises(SystemExit) as result:
        runpy.run_path(str(ROOT / "tools/rank_condition_gaps.py"), run_name="__main__")
    assert result.value.code == 0


def test_checked_in_package_d_inventory_and_ranking_are_current():
    sources = [HANDOFF / "cyano_package_D_pairs_20261004.tsv",
               HANDOFF / "cyano_package_D_rescore_20261006.tsv"]
    rows = gaps.effective_pairs(gaps.read_table(sources[0]), [gaps.read_table(sources[1])])
    states = gaps.load_inventory(HANDOFF / "cyano_condition_gap_inventory_20261007.json", sources)
    result = gaps.rank_gaps(rows, states)
    stored = gaps.read_table(HANDOFF / "cyano_condition_gap_ranking_20261007.tsv")
    assert stored == [{k: str(v) for k, v in r.items()} for r in result]
    assert len(rows) == 941
    assert sum(r["verdict"] == "undecidable" for r in rows) == 163
    assert len(result) == 142
    assert sum(r["last_blocker_pairs"] for r in result) == 1
    assert (result[0]["condition_row"], result[0]["field"]) == (48, "temperature")
    assert {r["undecidable_pairs"] for r in result if r["condition_row"] == 17} == {30}
