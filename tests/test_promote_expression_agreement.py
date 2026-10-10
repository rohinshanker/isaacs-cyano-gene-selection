"""The browser promotion keeps accepted statistics exact and joins fail closed."""

from __future__ import annotations

import copy
import hashlib
import json
import os
from pathlib import Path

import pytest

from tools import promote_expression_agreement as promotion


ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "docs/notes/handoff/cyano_processed_expression_agreement_current_20261007.json"
META = ROOT / "site/data/meta.json"
PUBLISHED = ROOT / "site/data/expression_agreement.json"


def loaded() -> tuple[dict, bytes, dict, bytes]:
    report_raw = REPORT.read_bytes()
    meta_raw = META.read_bytes()
    return json.loads(report_raw), report_raw, json.loads(meta_raw), meta_raw


def payload(report: dict | None = None, meta: dict | None = None) -> dict:
    original, report_raw, metadata, meta_raw = loaded()
    chosen_report = report or original
    chosen_meta = meta or metadata
    return promotion.build_payload(
        chosen_report, REPORT, report_raw, chosen_meta, META, meta_raw,
    )


def test_current_report_promotes_every_admitted_rna_seq_source_without_vectors() -> None:
    result = payload()
    assert result["coverage"] == {
        "admittedRnaSeqSourceCount": 55,
        "reportBackedSourceCount": 53,
        "levelPairCount": 1378,
        "responsePairCount": 26,
        "gaps": [
            {"sourceId": "GSE205444", "reason": promotion.GAP_REASON},
            {"sourceId": "TAN2018_TSS", "reason": promotion.GAP_REASON},
        ],
    }
    assert [entry["id"] for entry in result["sources"][:2]] == ["GSE205444", "TAN2018_TSS"]
    assert all(entry["agreement"] is None for entry in result["sources"][:2])
    assert all("means" not in (entry["agreement"] or {}) for entry in result["sources"])
    assert all("vector" not in contrast for contrast in result["contrasts"])
    dawn = next(entry["agreement"] for entry in result["sources"]
                if entry["id"] == "GSE103462_wt_subjective_dawn")
    assert dawn["strain"] == "PCC 7942"
    assert dawn["strata"][0]["sampleCorrelations"][0] == {
        "sampleLeft": "wild type replicate 1 dawn",
        "sampleRight": "wild type replicate 2 dawn",
        "sharedGeneCount": 2551,
        "spearman": 0.9959037803425821,
    }
    assert "conditions" not in dawn
    first_contrast = result["contrasts"][0]
    assert first_contrast["treatment"] == [
        "wild type replicate 1 dusk", "wild type replicate 2 dusk"]
    assert first_contrast["control"] == [
        "wild type replicate 1 dawn", "wild type replicate 2 dawn"]
    assert result["levelPairs"][0]["spearman"] == 0.9449029665554857
    assert result["responsePairs"][0]["signAgreementFraction"] == 0.5829737151824245
    assert result["sourceReport"]["sha256"] == hashlib.sha256(REPORT.read_bytes()).hexdigest()
    assert result["metaInput"]["sha256"] == hashlib.sha256(META.read_bytes()).hexdigest()


def test_published_payload_is_the_deterministic_current_promotion() -> None:
    expected = promotion.render(payload())
    assert PUBLISHED.read_text(encoding="utf-8") == expected
    assert promotion.render(payload()) == expected


def test_unknown_or_stale_source_joins_are_rejected() -> None:
    report, _, meta, _ = loaded()
    missing = copy.deepcopy(meta)
    missing["expressionSources"] = [
        source for source in missing["expressionSources"]
        if source["id"] != "GSE103462_wt_subjective_dawn"
    ]
    with pytest.raises(ValueError, match="absent from meta.expressionSources"):
        payload(report, missing)

    stale = copy.deepcopy(meta)
    source = next(entry for entry in stale["expressionSources"]
                  if entry["id"] == "GSE103462_wt_subjective_dawn")
    source["record"]["studyId"] = "STALE"
    with pytest.raises(ValueError, match="does not match"):
        payload(report, stale)


def test_malformed_statistics_are_rejected_before_output() -> None:
    report, _, meta, _ = loaded()
    broken = copy.deepcopy(report)
    broken["levelPairs"][0]["spearman"] = None
    with pytest.raises(ValueError, match="spearmanReason"):
        payload(broken, meta)

    broken = copy.deepcopy(report)
    broken["responsePairs"][0]["sharedGeneCount"] = 999999
    with pytest.raises(ValueError, match="exceeds the responses"):
        payload(broken, meta)

    broken = copy.deepcopy(report)
    broken["contrasts"][0]["control"] = broken["contrasts"][0]["treatment"]
    with pytest.raises(ValueError, match="shares a treatment and control arm"):
        payload(broken, meta)


@pytest.mark.parametrize("input_kind", ["report", "meta", "plan", "crosswalk", "spec",
                                         "promotion", "validator", "statistics"])
@pytest.mark.parametrize("alias", ["direct", "symlink", "hardlink", "case"])
def test_promotion_refuses_input_aliases_without_writing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, input_kind: str, alias: str,
) -> None:
    report, report_raw, _, meta_raw = loaded()
    report_path = tmp_path / "report.json"
    meta_path = tmp_path / "meta.json"
    report_path.write_bytes(report_raw)
    meta_path.write_bytes(meta_raw)
    monkeypatch.setattr(promotion, "ROOT", tmp_path)
    tool_path = tmp_path / "tools/promote_expression_agreement.py"
    monkeypatch.setattr(promotion, "SELF_PATH", tool_path)
    paths = {
        "report": report_path,
        "meta": meta_path,
        "plan": tmp_path / report["inputs"]["plan"]["path"],
        "crosswalk": tmp_path / report["inputs"]["crosswalk"]["path"],
        "spec": tmp_path / report["inputs"]["specs"][0]["path"],
        "promotion": tool_path,
        "validator": tmp_path / "tools/export_expression_agreement.py",
        "statistics": tmp_path / report["implementation"]["path"],
    }
    for name, path in paths.items():
        if name not in ("report", "meta"):
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(f"preserve {name}\n")
    source = paths[input_kind]
    output = source
    if alias in ("symlink", "hardlink"):
        output = tmp_path / "output.json"
        if alias == "symlink":
            output.symlink_to(source)
        else:
            os.link(source, output)
    elif alias == "case":
        output = source.with_name(source.name.upper())
    originals = {path: path.read_bytes() for path in paths.values()}
    with pytest.raises(ValueError, match="would overwrite"):
        promotion.promote(report_path, meta_path, output)
    assert all(path.read_bytes() == content for path, content in originals.items())
    assert not list(tmp_path.rglob("*.partial"))


def test_promotion_preflights_paths_and_allows_browser_publication(tmp_path: Path) -> None:
    report_path = tmp_path / "report.json"
    meta_path = tmp_path / "meta.json"
    report_path.write_bytes(REPORT.read_bytes())
    meta_path.write_bytes(META.read_bytes())
    with pytest.raises(ValueError, match="is a directory"):
        promotion.promote(report_path, meta_path, tmp_path)
    with pytest.raises(ValueError, match="not a directory"):
        promotion.promote(report_path, meta_path, meta_path / "child.json")
    loop = tmp_path / "loop"
    loop.symlink_to(loop)
    with pytest.raises(ValueError, match="cannot be resolved"):
        promotion.promote(report_path, meta_path, loop / "output.json")
    output = tmp_path / "site/data/expression_agreement.json"
    result = promotion.promote(report_path, meta_path, output)
    assert json.loads(output.read_text()) == result
    assert not list(tmp_path.rglob("*.partial"))


def test_cli_input_collision_reports_failure_without_modification(
    tmp_path: Path, capsys: pytest.CaptureFixture[str],
) -> None:
    report_path = tmp_path / "report.json"
    report_path.write_bytes(REPORT.read_bytes())
    before = report_path.read_bytes()
    status = promotion.main(["--report", str(report_path), "--meta", str(META),
                             "--output", str(report_path)])
    assert status == 1
    assert "would overwrite the input report" in capsys.readouterr().err
    assert report_path.read_bytes() == before


@pytest.mark.parametrize("contents", [None, b"\xff", b"{", b"NaN", b"[]"])
def test_load_json_names_invalid_inputs(tmp_path: Path, contents: bytes | None) -> None:
    path = tmp_path / "invalid.json"
    if contents is not None:
        path.write_bytes(contents)
    with pytest.raises(ValueError):
        promotion.load_json(path, "test input")


def test_external_path_provenance_omits_private_parent_directories(tmp_path: Path) -> None:
    path = tmp_path / "private-parent" / "report.json"
    assert promotion.display_path(path) == "report.json"


def test_atomic_failure_preserves_existing_destination(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    output = tmp_path / "output.json"
    output.write_text("preserve existing output\n")

    def fail_replace(*_args: object) -> None:
        raise OSError("simulated replacement failure")

    monkeypatch.setattr(promotion.os, "replace", fail_replace)
    with pytest.raises(OSError, match="simulated replacement failure"):
        promotion.write_atomically(output, "new payload\n")
    assert output.read_text() == "preserve existing output\n"
    assert sorted(path.name for path in tmp_path.iterdir()) == ["output.json"]


def test_cli_success_creates_the_validated_browser_payload(
    tmp_path: Path, capsys: pytest.CaptureFixture[str],
) -> None:
    output = tmp_path / "browser.json"
    assert promotion.main(["--output", str(output)]) == 0
    assert json.loads(output.read_text())["coverage"]["reportBackedSourceCount"] == 53
    assert "53 report-backed RNA-seq sources" in capsys.readouterr().out
