"""The browser promotion keeps accepted statistics exact and joins fail closed."""

from __future__ import annotations

import copy
import hashlib
import json
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
