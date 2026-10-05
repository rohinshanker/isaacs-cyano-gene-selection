"""Tests for the pair review sheet generator."""

import csv
import runpy
import sys
from pathlib import Path

import pytest

from tools import pair_review_sheet as sheet

ROOT = Path(__file__).resolve().parents[1]


def make_row(artifact_a, artifact_b, verdict, passed, **overrides):
    """Build one pair-table row with every column the generator reads."""
    row = {
        "data_type": "transcriptomics",
        "artifact_a": artifact_a,
        "artifact_b": artifact_b,
        "condition_set_a": (
            "row 3 [control | pooled] temperature=30 °C ;; light_intensity=40 µE ;; "
            "light_regime=continuous ;; co2= ;; medium=BG-11 ;; "
            "culture_format=flask ;; growth_phase=OD750 0.3"
        ),
        "condition_set_b": (
            "row 9 [dusk] temperature=30 °C ;; light_intensity=60 µE ;; "
            "light_regime=continuous ;; co2=1% ;; medium=BG-11 ;; "
            "culture_format=flask ;; growth_phase="
        ),
        "temperature": "pass — 30 vs 30",
        "light_intensity": "fail — ratio 1.5",
        "light_regime": "pass",
        "co2": "undecidable",
        "medium": "pass",
        "culture_format_and_phase": "undecidable",
        "verdict": verdict,
        "failing_or_marginal_axis": "light_intensity (narrow)",
        "axes_passed": f"{passed} of 6",
    }
    row.update(overrides)
    return row


def test_parse_condition_set_reads_row_label_and_values():
    row, label, values = sheet.parse_condition_set(
        "row 12 [shade [pulse]] temperature=30 °C ;; co2= ;; medium=BG-11 = fresh"
    )
    assert row == 12
    assert label == "shade [pulse]"
    assert values == {"temperature": "30 °C", "co2": "", "medium": "BG-11 = fresh"}


def test_parse_condition_set_rejects_other_text():
    with pytest.raises(ValueError, match="not a condition-set cell"):
        sheet.parse_condition_set("GSE1 control")


def test_select_pairs_filters_by_verdict_and_orders_by_axes_passed():
    rows = [
        make_row("GSE2", "GSE9", "escalate", 2),
        make_row("GSE1", "GSE9", "not comparable", 5),
        make_row("GSE3", "GSE4", "escalate", 3),
        make_row("GSE1", "GSE5", "escalate", 2),
    ]
    chosen = sheet.select_pairs(rows, "escalate")
    assert [(r["artifact_a"], r["artifact_b"]) for r in chosen] == [
        ("GSE3", "GSE4"),
        ("GSE1", "GSE5"),
        ("GSE2", "GSE9"),
    ]
    assert sheet.select_pairs(rows, "comparable") == []


def test_render_pair_shows_both_sides_every_axis_and_empty_judgement():
    text = sheet.render_pair(4, make_row("GSE1 (a|b)", "GSE2", "escalate", 3))
    assert text.startswith("## 4. GSE1 (a|b) against GSE2")
    assert "condition table row 3, control | pooled" in text
    assert "| light_intensity | 40 µE | 60 µE | fail — ratio 1.5 |" in text
    # A missing value is shown as missing, on either side, never dropped.
    assert "| co2 | — | 1% | undecidable |" in text
    assert "| culture_format_and_phase | flask; OD750 0.3 | flask | undecidable |" in text
    assert text.count("\n| ") == 2 + len(sheet.AXES)
    assert "- **Judgement** (may share a layer / keep separate / don't know yet):\n" in text


def test_render_pair_escapes_table_breaking_characters():
    row = make_row("GSE1", "GSE2", "escalate", 3, medium="pass | BG-11\nboth")
    assert "| pass \\| BG-11 both |" in sheet.render_pair(1, row)


def test_render_sheet_counts_and_numbers_the_selected_pairs():
    rows = [
        make_row("GSE1", "GSE2", "escalate", 2),
        make_row("GSE3", "GSE4", "undecidable", 5),
    ]
    text = sheet.render_sheet(rows, "escalate", "pairs.tsv")
    assert text.startswith('# Pair review sheet: 1 pairs with verdict "escalate"')
    assert "from `pairs.tsv`" in text
    assert "## 1. GSE1 against GSE2" in text
    assert "GSE3" not in text


def write_table(path, rows):
    """Write rows as the tab-separated pair table."""
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]), delimiter="\t")
        writer.writeheader()
        writer.writerows(rows)


def test_main_writes_the_sheet(tmp_path, capsys):
    table = tmp_path / "pairs.tsv"
    out = tmp_path / "sheet.md"
    write_table(table, [make_row("GSE1", "GSE2", "undecidable", 5)])
    assert sheet.main([str(table), str(out), "--verdict", "undecidable"]) == 0
    assert "## 1. GSE1 against GSE2" in out.read_text(encoding="utf-8")
    assert "wrote 1 pairs" in capsys.readouterr().out


def test_script_entry_point_exits_with_main_status(tmp_path, monkeypatch):
    table = tmp_path / "pairs.tsv"
    out = tmp_path / "sheet.md"
    write_table(table, [make_row("GSE1", "GSE2", "escalate", 2)])
    monkeypatch.setattr(sys, "argv", ["pair_review_sheet.py", str(table), str(out)])
    with pytest.raises(SystemExit) as exit_info:
        runpy.run_path(str(ROOT / "tools/pair_review_sheet.py"), run_name="__main__")
    assert exit_info.value.code == 0
    assert out.exists()
