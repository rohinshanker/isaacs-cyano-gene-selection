"""The owner's pair judgements: loaded by the pipeline, checked by the validator, shipped in meta."""

import copy
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "tools"))

from build_features import load_pair_judgements  # noqa: E402
from validate_contract import Report, validate_pair_judgements  # noqa: E402

VALID = {
    "schemaVersion": 1,
    "judgements": [
        {"pair": 1, "a": {"studyId": "GSE1", "row": 2}, "b": {"studyId": "GSE2", "row": 5},
         "call": "share", "by": "owner", "entry": "fine"},
        {"pair": 2, "a": {"studyId": "GSE1", "row": 2}, "b": {"studyId": "GSE3", "row": 7},
         "call": "conditional", "condition": "the same kind of light regime on both sides",
         "by": "owner", "entry": "fine, as long as"},
    ],
}


def write(tmp_path, document):
    path = tmp_path / "pair_judgements.json"
    path.write_text(json.dumps(document), encoding="utf-8")
    return path


def test_the_pipeline_keeps_the_sides_the_call_and_the_condition_only(tmp_path):
    assert load_pair_judgements(tmp_path / "absent.json") == []
    loaded = load_pair_judgements(write(tmp_path, VALID))
    assert loaded == [
        {"pair": 1, "a": {"studyId": "GSE1", "row": 2}, "b": {"studyId": "GSE2", "row": 5}, "call": "share"},
        {"pair": 2, "a": {"studyId": "GSE1", "row": 2}, "b": {"studyId": "GSE3", "row": 7},
         "call": "conditional", "condition": "the same kind of light regime on both sides"},
    ]


@pytest.mark.parametrize(
    "mutate, message",
    [
        (lambda d: d.update(schemaVersion=2), "unknown schemaVersion"),
        (lambda d: d.update(judgements=[]), "no judgements"),
        (lambda d: d["judgements"][0]["a"].update(row=0), "names no study and row"),
        (lambda d: d["judgements"][0].update(call="maybe"), "unknown call"),
        (lambda d: d["judgements"][1].pop("condition"), "conditional on nothing"),
        (lambda d: d["judgements"].append({**d["judgements"][0], "pair": 3,
                                            "a": d["judgements"][0]["b"], "b": d["judgements"][0]["a"]}),
         "judged twice"),
    ],
)
def test_the_pipeline_rejects_a_malformed_judgement(tmp_path, mutate, message):
    document = copy.deepcopy(VALID)
    mutate(document)
    with pytest.raises(ValueError, match=message):
        load_pair_judgements(write(tmp_path, document))


def test_the_validator_checks_the_shipped_shape_independently():
    good = Report()
    validate_pair_judgements({"pairJudgements": load_pair_judgements_from(VALID)}, good)
    assert good.failures == []
    empty = Report()
    validate_pair_judgements({"pairJudgements": []}, empty)
    assert empty.failures == []
    missing = Report()
    validate_pair_judgements({}, missing)
    assert any("is a list" in f for f in missing.failures)
    bad = Report()
    validate_pair_judgements({"pairJudgements": [
        {"pair": 1, "a": {"studyId": "GSE1", "row": True}, "b": {"studyId": "GSE2", "row": 5}, "call": "share"},
        {"pair": 2, "a": {"studyId": "GSE1", "row": 2}, "b": {"studyId": "GSE2", "row": 5}, "call": "conditional"},
        {"pair": 3, "a": {"studyId": "GSE2", "row": 5}, "b": {"studyId": "GSE1", "row": 2}, "call": "nope"},
        "x",
    ]}, bad)
    failure = next(f for f in bad.failures if "names two sides" in f)
    for fragment in ("side a names no study", "conditional on nothing", "unknown call", "judged twice"):
        assert fragment in failure, fragment


def load_pair_judgements_from(document):
    import tempfile
    with tempfile.TemporaryDirectory() as directory:
        return load_pair_judgements(write(Path(directory), document))


def test_the_shipped_meta_carries_the_33_judged_pairs():
    meta = json.loads((ROOT / "site/data/meta.json").read_text(encoding="utf-8"))
    source = json.loads((ROOT / "data/expression/pair_judgements.json").read_text(encoding="utf-8"))
    judgements = meta["pairJudgements"]
    assert [j["pair"] for j in judgements] == list(range(1, 34))
    assert {j["call"] for j in judgements} == {"share", "separate", "conditional", "undecided"}
    calls = {c: sum(j["call"] == c for j in judgements) for c in ("share", "separate", "conditional", "undecided")}
    assert calls == {"share": 24, "separate": 3, "conditional": 2, "undecided": 4}  # pair 33 is J2, 2026-10-06
    assert [j["call"] for j in source["judgements"]] == [j["call"] for j in judgements]
    assert sum(j["by"] == "extrapolated" for j in source["judgements"]) == 3
    report = Report()
    validate_pair_judgements(meta, report)
    assert report.failures == []
