"""Tests for the source-derived function-category layer. None call the network."""

from __future__ import annotations

import copy
import importlib.util
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "tools/build_source_derived_categories.py"
SPEC = importlib.util.spec_from_file_location("build_source_derived_categories", MODULE_PATH)
assert SPEC and SPEC.loader
derived = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = derived
SPEC.loader.exec_module(derived)

UNKNOWN = derived.UNKNOWN_ID
MULTIPLE = derived.MULTIPLE_ID
ALL = ("utex-2973", "pcc-7942", "go-iea")


@pytest.fixture(scope="module")
def payload() -> dict:
    """The checked-in site artifact."""
    return json.loads((ROOT / derived.OUTPUT_PATH).read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def inputs():
    """Pinned inputs loaded once."""
    return derived.load_inputs(ROOT)


@pytest.fixture(scope="module")
def audit_summary() -> dict:
    return json.loads((ROOT / derived.SUMMARY_PATH).read_text(encoding="utf-8"))


def copy_inputs(target: Path, with_audit: bool = True) -> Path:
    """Copies every build input into a scratch root."""
    paths = [derived.GO_PATH, derived.GO_NAMES_PATH, derived.GENES_PATH, derived.PCC_PATH,
             derived.CATEGORIES_PATH, derived.PCC_GFF_PATH, derived.PROVENANCE_PATH,
             derived.RUBRIC_PATH, derived.EVALUATION_SET_PATH]
    if with_audit:
        paths += [derived.RESULTS_PATH, derived.EVALUATION_RESULTS_PATH, derived.RUN_LOG_PATH,
                  derived.SPOT_CHECK_PATH, derived.SUMMARY_PATH, derived.OUTPUT_PATH]
    for path in paths:
        (target / path).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / path, target / path)
    return target


class FakeTransport:
    """Answers every request deterministically without the network."""

    def __init__(self, choice: str = "stress-and-repair", probability: float = 0.95,
                 model: str = derived.MODEL) -> None:
        self.calls = 0
        self.choice = choice
        self.probability = probability
        self.model = model

    def post(self, body: dict) -> dict:
        self.calls += 1
        question = body["questions"][derived.QUESTION_ID]
        options = list(question["criteria"])
        rest = (1 - self.probability) / (len(options) - 1)
        probabilities = {option: rest for option in options}
        probabilities[self.choice] = self.probability
        return {
            "model": self.model,
            "answers": {derived.QUESTION_ID: {
                "type": "choice", "choice": self.choice,
                "probabilities": probabilities, "confidence": 0.9,
            }},
            "usage": {"input_tokens": 10},
        }


# ------------------------------------------------------------- build output


def test_checked_in_artifacts_rebuild_offline() -> None:
    """--check reproduces the site file and audit summary without the API."""
    derived.generate(ROOT, check=True)


def test_cli_check_passes_without_api_key() -> None:
    """The CI command succeeds with the key removed from the environment."""
    env = {key: value for key, value in os.environ.items() if key != "TYPESAFE_API_KEY"}
    result = subprocess.run([sys.executable, str(MODULE_PATH), "--check"], env=env,
                            capture_output=True, text=True, check=False)
    assert result.returncode == 0, result.stderr
    assert "pcc-7942 assigned=" in result.stdout and "go-iea assigned=" in result.stdout


def test_cli_judge_without_key_fails_before_any_request() -> None:
    """Inference refuses to start without a credential."""
    env = {key: value for key, value in os.environ.items() if key != "TYPESAFE_API_KEY"}
    result = subprocess.run([sys.executable, str(MODULE_PATH), "--judge"], env=env,
                            capture_output=True, text=True, check=False)
    assert result.returncode == 1
    assert "TYPESAFE_API_KEY is not set" in result.stderr


def test_cli_spot_check_sheet_hides_answers() -> None:
    """The review sheet shows states only."""
    result = subprocess.run([sys.executable, str(MODULE_PATH), "--spot-check-sheet"],
                            capture_output=True, text=True, check=True)
    sheet = json.loads(result.stdout)
    assert sheet and all(
        set(row) <= {"locusTag", "go_annotations", "pcc_7942_refseq_product"} for row in sheet
    )
    assert "probability" not in result.stdout and "categoryId" not in result.stdout


def test_spot_check_replay_matches_pinned_labels() -> None:
    """The pinned reviewer sheet reproduces exactly from its seed and threshold."""
    review = json.loads((ROOT / derived.SPOT_CHECK_PATH).read_text(encoding="utf-8"))
    sheet = derived.spot_check_replay(ROOT)
    assert [row["locusTag"] for row in sheet] == [row["locusTag"] for row in review["labels"]]
    assert len(sheet) == 34


def test_every_request_state_is_blinded(inputs) -> None:
    """No request carries a locus tag, product from the other source, or reviewed label."""
    rubric = derived.load_json(ROOT / derived.RUBRIC_PATH)
    for request in derived.build_requests(inputs):
        state = derived.canonical_json(request.state)
        assert not derived.LOCUS_TAG_PATTERN.search(state)
        assert set(request.state) == (
            {"go_annotations"} if request.source == derived.GO_SOURCE
            else {"pcc_7942_refseq_product"}
        )
        body = derived.request_body(rubric, request)
        assert tuple(body["questions"][derived.QUESTION_ID]["criteria"]) == inputs.category_ids


def test_payload_covers_every_locus_with_the_right_sources(payload, inputs) -> None:
    """A PCC judgment exists exactly at accepted joins; a GO judgment exactly with terms."""
    assert list(payload["byLocus"]) == list(inputs.loci)
    for locus, row in payload["byLocus"].items():
        assert (row[derived.PCC_SOURCE] is not None) == (locus in inputs.pcc_joins)
        assert (row[derived.GO_SOURCE] is not None) == (locus in inputs.go_terms)
        if row[derived.PCC_SOURCE]:
            assert row[derived.PCC_SOURCE]["pccLocusTag"] == inputs.pcc_joins[locus][0]
    counts = payload["counts"]["bySource"]
    assert counts[derived.PCC_SOURCE]["judged"] == 2542
    assert counts[derived.GO_SOURCE]["judged"] == 1584
    assert payload["counts"]["plottedLoci"] == 2715


def test_reviewed_table_is_untouched_and_never_written(payload) -> None:
    """The derived build reads the reviewed table and changes nothing in it."""
    categories = json.loads((ROOT / derived.CATEGORIES_PATH).read_text(encoding="utf-8"))
    assert len(categories["assignments"]) == 13
    assert categories["policy"]["assignmentMethod"] == "explicit-user-review-only"
    assert payload["vocabulary"] == categories["vocabulary"]
    assert payload["inputs"][derived.CATEGORIES_PATH.as_posix()] == derived.sha256_file(
        ROOT / derived.CATEGORIES_PATH
    )


def test_attribution_and_policy_are_carried(payload) -> None:
    attribution = payload["attribution"]
    assert attribution["goIea"]["license"] == "CC BY 4.0"
    assert attribution["goIea"]["creator"] == "Gene Ontology Consortium"
    assert attribution["pcc7942"]["attributedStudies"] == ["Adomako et al. 2022", "Rubin et al. 2015"]
    assert attribution["pcc7942"]["license"] == "CC BY 4.0"
    assert payload["policy"]["evidenceLabels"] == ["reviewed", "pcc-7942-derived", "go-iea-derived"]
    assert payload["policy"]["thresholds"] == {"derivedProbabilityAtLeast": 0.8}
    assert payload["judgment"]["model"] == "jev-1.13.0"


# ------------------------------------------------------------------- policy


def test_assignment_rule_thresholds_and_unknown() -> None:
    def answer(choice: str, probability: float) -> dict:
        return {"choice": choice, "probabilities": {choice: probability, "x": 1 - probability}}

    assert derived.derived_category(answer("stress-and-repair", 0.8)) == "stress-and-repair"
    assert derived.derived_category(answer("stress-and-repair", 0.79)) is None
    assert derived.derived_category(answer(UNKNOWN, 1.0)) is None


def test_resolve_bucket_precedence_and_disagreement() -> None:
    both = {"pcc-7942": "stress-and-repair", "go-iea": "transport-and-envelope"}
    assert derived.resolve_bucket(["other-characterized"], both, ALL) == (
        "other-characterized", ["reviewed"])
    assert derived.resolve_bucket(["a", "b"], both, ALL) == (MULTIPLE, ["reviewed"])
    assert derived.resolve_bucket([UNKNOWN], both, ALL) == (UNKNOWN, ["reviewed"])
    assert derived.resolve_bucket(None, both, ALL) == (
        MULTIPLE, ["pcc-7942-derived", "go-iea-derived"])
    assert derived.resolve_bucket(["other-characterized"], both, ("pcc-7942", "go-iea")) == (
        MULTIPLE, ["pcc-7942-derived", "go-iea-derived"])
    assert derived.resolve_bucket(None, both, ("go-iea",)) == (
        "transport-and-envelope", ["go-iea-derived"])
    agree = {"pcc-7942": "stress-and-repair", "go-iea": "stress-and-repair"}
    assert derived.resolve_bucket(None, agree, ALL) == (
        "stress-and-repair", ["pcc-7942-derived", "go-iea-derived"])
    assert derived.resolve_bucket(None, {"pcc-7942": None, "go-iea": None}, ALL) == (UNKNOWN, [])
    assert derived.resolve_bucket(["other-characterized"], both, ()) == (UNKNOWN, [])


def test_published_categories_follow_their_probabilities(payload) -> None:
    for row in payload["byLocus"].values():
        for source in derived.SOURCES:
            entry = row[source]
            if entry is None:
                continue
            expected = None
            if entry["mostLikely"] != UNKNOWN and entry["probability"] >= 0.8:
                expected = entry["mostLikely"]
            assert entry["categoryId"] == expected


def test_validate_payload_rejects_a_trusted_label(payload, inputs) -> None:
    tampered = copy.deepcopy(payload)
    tampered["byLocus"]["M744_RS00560"][derived.PCC_SOURCE]["probability"] = 0.3
    with pytest.raises(derived.DerivedCategoryError, match="disagrees with its probability"):
        derived.validate_payload(tampered, inputs)
    dropped = copy.deepcopy(payload)
    dropped["byLocus"]["M744_RS00560"][derived.PCC_SOURCE] = None
    with pytest.raises(derived.DerivedCategoryError, match="disagrees with its join"):
        derived.validate_payload(dropped, inputs)
    miscounted = copy.deepcopy(payload)
    miscounted["counts"]["plottedLoci"] += 1
    with pytest.raises(derived.DerivedCategoryError, match="counts do not match"):
        derived.validate_payload(miscounted, inputs)


def test_pinned_results_reject_a_changed_request(tmp_path: Path) -> None:
    """Editing a pinned answer's request hash forces a re-judge."""
    root = copy_inputs(tmp_path)
    lines = (root / derived.RESULTS_PATH).read_text(encoding="utf-8").splitlines()
    record = json.loads(lines[0])
    record["requestSha256"] = "0" * 64
    lines[0] = derived.canonical_json(record)
    (root / derived.RESULTS_PATH).write_text("\n".join(lines) + "\n", encoding="utf-8")
    with pytest.raises(derived.DerivedCategoryError, match="judged on a different request"):
        derived.build_payload(root)


def test_check_fails_when_the_site_file_drifts(tmp_path: Path) -> None:
    root = copy_inputs(tmp_path)
    (root / derived.OUTPUT_PATH).write_text("{}\n", encoding="utf-8")
    with pytest.raises(derived.DerivedCategoryError, match="differs from a rebuild"):
        derived.generate(root, check=True)


def test_rubric_options_must_be_the_reviewed_vocabulary(tmp_path: Path) -> None:
    root = copy_inputs(tmp_path)
    rubric = derived.load_json(root / derived.RUBRIC_PATH)
    rubric["criteria"]["photosynthesis"] = rubric["criteria"].pop("photosynthetic-light-reactions")
    (root / derived.RUBRIC_PATH).write_text(derived.render_json(rubric), encoding="utf-8")
    with pytest.raises(derived.DerivedCategoryError, match="rubric options differ"):
        derived.build_payload(root)


# ---------------------------------------------------------------- inference


def test_judge_answers_only_unpinned_requests(tmp_path: Path) -> None:
    """With every request pinned, --judge makes no calls; with one dropped, one call."""
    root = copy_inputs(tmp_path)
    transport = FakeTransport()
    assert derived.judge(root, transport) == {"requests": 4126, "answered": 0}
    assert transport.calls == 0
    lines = (root / derived.RESULTS_PATH).read_text(encoding="utf-8").splitlines()
    (root / derived.RESULTS_PATH).write_text("\n".join(lines[1:]) + "\n", encoding="utf-8")
    assert derived.judge(root, transport) == {"requests": 4126, "answered": 1}
    assert transport.calls == 1
    log = derived.load_json(root / derived.RUN_LOG_PATH)
    assert log["judge"]["requests"] == 1


def test_judge_from_scratch_pins_every_request(tmp_path: Path) -> None:
    root = copy_inputs(tmp_path, with_audit=False)
    transport = FakeTransport(choice="transport-and-envelope", probability=0.9)
    assert derived.judge(root, transport) == {"requests": 4126, "answered": 4126}
    payload = derived.build_payload(root)
    counts = payload["counts"]["bySource"]
    assert counts[derived.PCC_SOURCE]["byCategory"]["transport-and-envelope"] == 2542
    assert counts[derived.GO_SOURCE]["byCategory"]["transport-and-envelope"] == 1584
    # Reviewed rows still win: the 12 classified reviewed loci keep their categories.
    legend = payload["counts"]["allSourcesLegend"]
    assert legend["byEvidence"]["reviewed"] == 13
    assert legend["byCategory"]["photosynthetic-light-reactions"] == 3


def test_a_wrong_model_is_refused(tmp_path: Path) -> None:
    root = copy_inputs(tmp_path, with_audit=False)
    with pytest.raises(derived.DerivedCategoryError, match="answered, not"):
        derived.judge(root, FakeTransport(model="jev-0.1"), workers=1)


def test_evaluate_pins_the_predeclared_cases(tmp_path: Path) -> None:
    root = copy_inputs(tmp_path)
    transport = FakeTransport()
    assert derived.evaluate(root, transport) == 63
    assert transport.calls == 63


# ------------------------------------------------------------ audit summary


def test_summary_reports_calibration_and_no_wrong_assignment(audit_summary) -> None:
    evaluation = audit_summary["evaluation"]
    for source in derived.SOURCES:
        assert evaluation[source]["wrongCategoryAssigned"] == 0
        assert evaluation[source]["exactChoice"] >= evaluation[source]["cases"] - 1
    for row in audit_summary["reviewedComparison"]:
        for source in derived.SOURCES:
            if row[source] is not None:
                assert row[source]["agreesWithReviewed"] or row["reviewed"] == [UNKNOWN]
    for source in derived.SOURCES:
        bands = audit_summary["crossSourceCalibration"][source]
        assert [band["probabilityRange"] for band in bands][-1] == [0.95, 1.0]
        assert all(band["agreementFraction"] >= 0.89 for band in bands[3:])
    spot = audit_summary["spotCheck"]
    assert spot["loci"] == 34
    assert spot[derived.GO_SOURCE]["assignmentAgreement"] >= 26
    assert spot[derived.PCC_SOURCE]["assignmentAgreement"] >= 24


def test_legend_counts_by_toggle_cover_every_locus(audit_summary, payload) -> None:
    for key, legend in audit_summary["legendByToggle"].items():
        assert key.split("+") == legend["enabledSources"]
        total = sum(legend["byCategory"].values()) + legend["multipleFunctions"] + legend["unknownOrUnclassified"]
        assert total == payload["counts"]["plottedLoci"]
    utex = audit_summary["legendByToggle"]["utex-2973"]
    assert utex["byEvidence"] == {"none": 2702, "reviewed": 13}
    assert utex["unknownOrUnclassified"] == 2703
