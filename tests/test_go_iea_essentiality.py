"""Tests for the GO IEA essentiality-context fallback. None call the network."""

from __future__ import annotations

import copy
import gzip
import importlib.util
import io
import json
import os
import shutil
import subprocess
import sys
import urllib.error
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "tools/build_go_iea_essentiality.py"
SPEC = importlib.util.spec_from_file_location("build_go_iea_essentiality", MODULE_PATH)
assert SPEC and SPEC.loader
go = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = go
SPEC.loader.exec_module(go)


@pytest.fixture(scope="module")
def payload() -> dict:
    """The checked-in site artifact."""
    return json.loads((ROOT / go.OUTPUT_PATH).read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def inputs():
    """Pinned inputs loaded once."""
    return go.load_inputs(ROOT)


def copy_inputs(target: Path, with_audit: bool = True) -> Path:
    """Copies every build input into a scratch root."""
    paths = [go.GO_PATH, go.GO_NAMES_PATH, go.GENES_PATH, go.PCC_PATH, go.CANDIDATE_PATH,
             go.CATEGORIES_PATH, go.PCC_GFF_PATH, go.PROVENANCE_PATH, go.RUBRIC_PATH,
             go.EVALUATION_SET_PATH]
    if with_audit:
        paths += [go.RESULTS_PATH, go.EVALUATION_RESULTS_PATH, go.RUN_LOG_PATH,
                  go.SPOT_CHECK_PATH, go.SUMMARY_PATH, go.OUTPUT_PATH]
    for path in paths:
        (target / path).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / path, target / path)
    return target


class FakeTransport:
    """Answers every request deterministically without the network."""

    def __init__(self, p_core: float = 0.95, noul: float = 0.1, model: str = go.MODEL):
        self.calls = 0
        self.p_core = p_core
        self.noul = noul
        self.model = model

    def post(self, body: dict) -> dict:
        self.calls += 1
        answers = {}
        for question_id, question in body["questions"].items():
            if question["type"] == "choice":
                rest = (1 - self.p_core) / 2
                answers[question_id] = {
                    "type": "choice", "choice": "core_cellular_process",
                    "probabilities": {
                        "core_cellular_process": self.p_core,
                        "peripheral_or_conditional_process": rest,
                        "too_generic": rest,
                    },
                    "confidence": 0.9,
                }
            else:
                answers[question_id] = {"type": "noul", "noul": self.noul}
        return {"model": self.model, "answers": answers, "usage": {"input_tokens": 10}}


# ------------------------------------------------------------- build output


def test_checked_in_artifacts_rebuild_offline() -> None:
    """--check reproduces the site file and audit summary without the API."""
    go.generate(ROOT, check=True)


def test_cli_check_passes_without_api_key() -> None:
    """The CI command succeeds with the key removed from the environment."""
    env = {key: value for key, value in os.environ.items() if key != "TYPESAFE_API_KEY"}
    result = subprocess.run([sys.executable, str(MODULE_PATH), "--check"], env=env,
                            capture_output=True, text=True, check=False)
    assert result.returncode == 0, result.stderr
    assert "go-iea-context=31" in result.stdout


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
    assert sheet and set(sheet[0]) == {"locusTag", "go_annotations", "annotations"}
    assert "pCore" not in result.stdout and "noul" not in result.stdout


def test_pinned_counts_and_attribution(payload: dict) -> None:
    """Tier counts, discrepancies, and GO attribution stay pinned."""
    assert payload["counts"] == {
        "plottedLoci": 2715,
        "byTier": {"tested-utex-allele": 3, "admitted-pcc-call": 2431,
                   "go-iea-context": 31, "unknown": 250},
        "lociWithGoTerms": 1584,
        "goContextByLabel": {"core-cellular-process": 470, "not-core": 917,
                             "uncertain": 197},
        "fallbackEligible": 281,
        "fallbackEligibleWithGoTerms": 112,
        "discrepanciesByKind": {"utex-product": 5, "pcc7942-product": 1,
                                "reviewed-category": 0, "pcc7942-call": 104},
        "lociWithDiscrepancy": 109,
    }
    assert payload["attribution"]["license"] == "CC BY 4.0"
    assert "Gene Ontology Consortium" in payload["attribution"]["copyright"]
    assert payload["attribution"]["notice"] == "data/annotation/PROVENANCE.md"
    assert payload["judgment"]["model"] == "jev-1.13.0"
    assert payload["policy"]["precedence"] == list(go.TIERS)
    assert "Excluded" in payload["policy"]["panelObjective"]


def test_real_examples_of_each_tier_and_discrepancy(payload: dict) -> None:
    """Named loci keep the tiers and notes used in rendered review."""
    rows = payload["byLocus"]
    assert rows["M744_RS01270"]["tier"] == "tested-utex-allele"
    assert rows["M744_RS00005"]["tier"] == "admitted-pcc-call"
    assert rows["M744_RS08250"]["tier"] == "go-iea-context"
    assert rows["M744_RS08250"]["goContext"]["label"] == "core-cellular-process"
    assert rows["M744_RS00010"]["goContext"] is None
    assert rows["M744_RS00010"]["discrepancies"] == []
    assert rows["M744_RS03575"]["tier"] == "unknown"
    assert rows["M744_RS03575"]["goContext"]["label"] == "uncertain"
    nbla = rows["M744_RS05510"]["discrepancies"]
    assert [entry["kind"] for entry in nbla] == ["utex-product"]
    assert "phycobilisome degradation protein NblA" in nbla[0]["note"]
    hemh = rows["M744_RS13955"]["discrepancies"]
    assert [entry["kind"] for entry in hemh] == ["pcc7942-product", "pcc7942-call"]
    assert "chlorophyll a/b-binding protein" in hemh[0]["note"]


def test_audit_summary_records_evaluation_and_spot_check() -> None:
    """The summary carries evaluation, calibration, and spot-check results."""
    summary = json.loads((ROOT / go.SUMMARY_PATH).read_text(encoding="utf-8"))
    evaluation = summary["evaluation"]
    assert (evaluation["contextExactChoice"], evaluation["contextCases"]) == (27, 27)
    assert evaluation["nonCoreCasesLabelledCore"] == 0
    assert (evaluation["discrepancyCorrectAtThreshold"], evaluation["discrepancyCases"]) == (17, 19)
    assert summary["spotCheck"]["coreAgreement"] == 32
    assert summary["spotCheck"]["contradictionAgreement"] == 34
    fractions = [row["essentialFraction"] for row in summary["calibrationAgainstPcc7942"]]
    assert fractions[0] < fractions[2] < fractions[-1]
    assert summary["fileSha256"]["rubric.json"] == go.sha256_file(ROOT / go.RUBRIC_PATH)


# --------------------------------------------------------------- precedence


@pytest.mark.parametrize(
    ("tested", "status", "label", "tier"),
    [
        (True, "non-essential", "core-cellular-process", "tested-utex-allele"),
        (True, "unknown", None, "tested-utex-allele"),
        (False, "essential", "core-cellular-process", "admitted-pcc-call"),
        (False, "beneficial", None, "admitted-pcc-call"),
        (False, "non-essential", "not-core", "admitted-pcc-call"),
        (False, "unknown", "core-cellular-process", "go-iea-context"),
        (False, "ambiguous", "core-cellular-process", "go-iea-context"),
        (False, "missing", "core-cellular-process", "go-iea-context"),
        (False, "not_analyzed", "core-cellular-process", "go-iea-context"),
        (False, "unknown", "uncertain", "unknown"),
        (False, "ambiguous", "not-core", "unknown"),
        (False, "unknown", None, "unknown"),
    ],
)
def test_precedence(tested: bool, status: str, label: str | None, tier: str) -> None:
    """Tested allele > admitted PCC call > GO IEA context > unknown."""
    assert go.resolve_tier(tested, status, label) == tier


def test_every_published_tier_follows_precedence(payload: dict, inputs) -> None:
    """The artifact agrees with the rule for every plotted locus."""
    for locus, row in payload["byLocus"].items():
        label = row["goContext"]["label"] if row["goContext"] else None
        assert row["tier"] == go.resolve_tier(
            locus in inputs.tested, inputs.pcc[locus]["status"], label
        )
        assert row["pcc7942Status"] == inputs.pcc[locus]["status"]


@pytest.mark.parametrize(
    ("p_core", "label"),
    [(1.0, "core-cellular-process"), (go.CORE_THRESHOLD, "core-cellular-process"),
     (go.CORE_THRESHOLD - 0.01, "uncertain"), (go.NOT_CORE_THRESHOLD + 0.01, "uncertain"),
     (go.NOT_CORE_THRESHOLD, "not-core"), (0.0, "not-core")],
)
def test_context_thresholds(p_core: float, label: str) -> None:
    """Probability bands map to the three context labels."""
    assert go.context_label(p_core) == label


# ------------------------------------------------------ discrepancy detection


def discrepancies(**overrides) -> list[dict]:
    """Calls the detector with neutral defaults."""
    arguments = {
        "noul": {}, "utex_product": "ferrochelatase", "pcc_locus": "SYNPCC7942_RS1",
        "pcc_product": None, "category": None, "go_label": None, "pcc_status": "unknown",
    }
    arguments.update(overrides)
    return go.find_discrepancies(**arguments)


def test_no_discrepancy_below_threshold_or_without_fields() -> None:
    """Low probabilities and absent annotations report nothing."""
    below = go.DISCREPANCY_THRESHOLD - 0.01
    assert discrepancies(noul={"utex_product": below}) == []
    assert discrepancies(noul={"pcc_7942_product": 0.99}) == []
    assert discrepancies(noul={"reviewed_category": 0.99}) == []
    assert discrepancies(go_label="core-cellular-process", pcc_status="essential") == []
    assert discrepancies(go_label="uncertain", pcc_status="non-essential") == []


def test_each_discrepancy_kind_is_reported_in_order() -> None:
    """Every kind appears with its probability and explicit wording."""
    found = discrepancies(
        noul={"utex_product": go.DISCREPANCY_THRESHOLD, "pcc_7942_product": 0.9,
              "reviewed_category": 0.95},
        pcc_product="chlorophyll a/b-binding protein",
        category="Photosynthetic light reactions",
        go_label="core-cellular-process", pcc_status="non-essential",
    )
    assert [entry["kind"] for entry in found] == list(go.DISCREPANCY_KINDS)
    assert found[0]["probability"] == go.DISCREPANCY_THRESHOLD
    assert "ferrochelatase" in found[0]["note"]
    assert "SYNPCC7942_RS1" in found[1]["note"]
    assert "Photosynthetic light reactions" in found[2]["note"]
    assert found[3]["probability"] is None
    assert "non-essential" in found[3]["note"]


def test_pcc_product_question_only_when_text_differs(inputs) -> None:
    """Identical PCC products are not re-asked; differing ones are."""
    assert go.pcc_product_for("M744_RS00005", inputs) is None
    assert go.pcc_product_for("M744_RS13955", inputs) == "chlorophyll a/b-binding protein"
    assert go.pcc_product_for("M744_RS00015", inputs) is None


def test_pcc_product_missing_from_gff_fails(inputs) -> None:
    """A joined PCC locus absent from the pinned GFF is an input error."""
    broken = go.Inputs(**{**inputs.__dict__, "pcc_products": {}})
    with pytest.raises(go.GoEssentialityError, match="no PCC 7942 product"):
        go.pcc_product_for("M744_RS00005", broken)


# ----------------------------------------------------------------- requests


def test_requests_are_blinded_and_scoped(inputs) -> None:
    """States never carry locus tags, PCC calls, tiers, or product in context."""
    requests = go.build_requests(inputs)
    assert len(requests) == 2 * 1584
    for request in requests:
        text = go.canonical_json(request.state)
        assert not go.LOCUS_TAG_PATTERN.search(text)
        for word in ("essential", "tier", "pcc7942Status"):
            assert word not in text
        if request.kind == "context":
            assert set(request.state) == {"go_annotations"}
    by_key = {request.key: request for request in requests}
    assert by_key["discrepancy:M744_RS00265"].question_ids == ("utex_product", "reviewed_category")
    assert by_key["discrepancy:M744_RS13955"].question_ids == ("utex_product", "pcc_7942_product")
    assert "utex_2973_gene_symbol" in by_key["discrepancy:M744_RS00265"].state["annotations"]


def test_discrepancy_state_fields() -> None:
    """Optional fields add their questions; absent ones do not."""
    state, questions = go.discrepancy_state([], "p", None, None, None)
    assert questions == ("utex_product",)
    assert state["annotations"] == {"utex_2973_refseq_product": "p"}
    state, questions = go.discrepancy_state([], "p", "sym", "q", "Cat")
    assert questions == ("utex_product", "pcc_7942_product", "reviewed_category")
    assert state["annotations"]["utex_2973_gene_symbol"] == "sym"


def test_question_bodies_come_from_frozen_rubric() -> None:
    """Request bodies copy the rubric wording exactly."""
    rubric = go.load_json(ROOT / go.RUBRIC_PATH)
    context = go.question_body(rubric, "context", "context")
    assert set(context["criteria"]) == set(go.CONTEXT_OPTIONS)
    noul = go.question_body(rubric, "discrepancy", "reviewed_category")
    assert noul["type"] == "noul"
    assert noul["criteria"] == rubric["discrepancyRequest"]["sharedCriteria"]


# ---------------------------------------------------------------- inputs


def test_go_reader_rejects_bad_rows_and_deduplicates(tmp_path: Path) -> None:
    """Non-IEA, unnamed, and unknown-aspect rows fail; duplicates collapse."""
    header = "locus_tag\tgo_id\tqualifier\taspect\tevidence_code\n"
    names = {"GO:1": {"name": "translation"}}
    path = tmp_path / "go.tsv"
    path.write_text(header + "L\tGO:1\tinvolved_in\tP\tIEA\n" * 2, encoding="utf-8")
    assert go.read_go_terms(path, names) == {
        "L": [{"aspect": "biological process", "relation": "involved_in", "term": "translation"}]
    }
    for row, message in (
        ("L\tGO:1\tinvolved_in\tP\tIDA\n", "non-IEA"),
        ("L\tGO:2\tinvolved_in\tP\tIEA\n", "no GO name"),
        ("L\tGO:1\tinvolved_in\tX\tIEA\n", "unknown GO aspect"),
    ):
        path.write_text(header + row, encoding="utf-8")
        with pytest.raises(go.GoEssentialityError, match=message):
            go.read_go_terms(path, names)
    path.write_text("locus_tag\tgo_id\nL\tGO:1\n", encoding="utf-8")
    with pytest.raises(go.GoEssentialityError, match="cannot read"):
        go.read_go_terms(path, names)


def test_pcc_gff_reader(tmp_path: Path) -> None:
    """CDS products are URL-decoded; other features and comments are skipped."""
    path = tmp_path / "pcc.gff.gz"
    with gzip.open(path, "wt", encoding="utf-8") as handle:
        handle.write("##gff-version 3\n")
        handle.write("c\ts\tgene\t1\t2\t.\t+\t.\tlocus_tag=A\n")
        handle.write("c\ts\tCDS\t1\t2\t.\t+\t0\tlocus_tag=A;product=alpha%2C beta\n")
        handle.write("c\ts\tCDS\t1\t2\t.\t+\t0\tproduct=orphan\n")
    assert go.read_pcc_products(path) == {"A": "alpha, beta"}
    with pytest.raises(go.GoEssentialityError, match="cannot read PCC"):
        go.read_pcc_products(tmp_path / "missing.gz")


def test_inputs_fail_closed(tmp_path: Path) -> None:
    """Attribution, release, coverage, and locus mismatches stop the build."""
    root = copy_inputs(tmp_path)

    def expect(message: str) -> None:
        with pytest.raises(go.GoEssentialityError, match=message):
            go.load_inputs(root)

    provenance = root / go.PROVENANCE_PATH
    original = provenance.read_text(encoding="utf-8")
    provenance.write_text(original.replace("Creative Commons Attribution 4.0", "x"),
                          encoding="utf-8")
    expect("CC BY 4.0 notice")
    provenance.write_text(original, encoding="utf-8")

    genes_path = root / go.GENES_PATH
    genes = json.loads(genes_path.read_text(encoding="utf-8"))
    genes_path.write_text(json.dumps(genes + genes[:1]), encoding="utf-8")
    expect("duplicate locus")
    genes_path.write_text(json.dumps(genes[1:]), encoding="utf-8")
    expect("unplotted loci")
    genes_path.write_text(json.dumps(genes), encoding="utf-8")

    pcc_path = root / go.PCC_PATH
    pcc = json.loads(pcc_path.read_text(encoding="utf-8"))
    changed = copy.deepcopy(pcc)
    changed["source"]["annotationRelease"] = "other"
    pcc_path.write_text(json.dumps(changed), encoding="utf-8")
    expect("PCC essentiality release")
    changed = copy.deepcopy(pcc)
    changed["byLocus"].pop("M744_RS00005")
    pcc_path.write_text(json.dumps(changed), encoding="utf-8")
    expect("cover every plotted locus")
    pcc_path.write_text(json.dumps(pcc), encoding="utf-8")

    candidate_path = root / go.CANDIDATE_PATH
    candidate = json.loads(candidate_path.read_text(encoding="utf-8"))
    candidate_path.write_text(json.dumps({**candidate, "annotationRelease": "x"}),
                              encoding="utf-8")
    expect("candidate evidence release")


def test_load_json_and_jsonl_errors(tmp_path: Path) -> None:
    """Unreadable JSON and JSON lines raise the tool's error."""
    bad = tmp_path / "bad.json"
    bad.write_text("{", encoding="utf-8")
    with pytest.raises(go.GoEssentialityError, match="cannot load"):
        go.load_json(bad)
    with pytest.raises(go.GoEssentialityError, match="cannot parse"):
        go.load_jsonl(bad)
    assert go.load_jsonl(tmp_path / "absent.jsonl") == []


# ---------------------------------------------------------------- transport


class FakeResponse(io.BytesIO):
    """A context-managed HTTP body."""

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def http_error(code: int) -> urllib.error.HTTPError:
    """Builds an HTTPError with the given status."""
    return urllib.error.HTTPError(go.API_URL, code, "error", {}, None)


def test_transport_retries_rate_limits_then_succeeds() -> None:
    """429 and 529 back off and retry; the key goes only in the header."""
    outcomes = [http_error(429), http_error(529), FakeResponse(b'{"ok": true}')]
    seen, sleeps = [], []

    def opener(request, timeout):
        seen.append(request)
        outcome = outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    transport = go.TypeSafeTransport("secret", sleep=sleeps.append, opener=opener)
    assert transport.post({"a": 1}) == {"ok": True}
    assert sleeps == [1, 2]
    assert seen[0].get_header("Authorization") == "Bearer secret"
    assert b"secret" not in seen[0].data


def test_transport_fails_on_client_errors_and_exhaustion() -> None:
    """Non-retryable statuses fail at once; retries end after the last attempt."""
    def always(error):
        def opener(request, timeout):
            raise error
        return opener

    with pytest.raises(go.GoEssentialityError, match="HTTP 401"):
        go.TypeSafeTransport("k", sleep=lambda _: None, opener=always(http_error(401))).post({})
    with pytest.raises(go.GoEssentialityError, match="HTTP 529"):
        go.TypeSafeTransport("k", attempts=2, sleep=lambda _: None,
                             opener=always(http_error(529))).post({})
    with pytest.raises(go.GoEssentialityError, match="request failed"):
        go.TypeSafeTransport("k", attempts=2, sleep=lambda _: None,
                             opener=always(urllib.error.URLError("down"))).post({})
    with pytest.raises(go.GoEssentialityError, match="exhausted"):
        go.TypeSafeTransport("k", attempts=0, sleep=lambda _: None,
                             opener=always(http_error(529))).post({})
    with pytest.raises(go.GoEssentialityError, match="not set"):
        go.TypeSafeTransport("")


def test_answer_validation() -> None:
    """Typed answers must match their question contract."""
    noul = {"type": "noul"}
    choice = {"type": "choice", "criteria": {"a": None, "b": None}}
    go.validate_answer(noul, {"type": "noul", "noul": 0.5})
    go.validate_answer(choice, {"type": "choice", "choice": "a",
                                "probabilities": {"a": 0.6, "b": 0.4}})
    for question, answer, message in (
        (noul, {"type": "choice"}, "type differs"),
        (noul, {"type": "noul", "noul": 1.5}, "not a probability"),
        (choice, {"type": "choice", "choice": "a", "probabilities": {"a": 1.0}},
         "cover every option"),
        (choice, {"type": "choice", "choice": "a",
                  "probabilities": {"a": 0.6, "b": 0.6}}, "sum to one"),
        (choice, {"type": "choice", "choice": "c",
                  "probabilities": {"a": 0.6, "b": 0.4}}, "not an option"),
    ):
        with pytest.raises(go.GoEssentialityError, match=message):
            go.validate_answer(question, answer)


def test_ask_rejects_wrong_model_and_answer_sets(inputs) -> None:
    """A different model or missing answers are not pinned."""
    rubric = go.load_json(ROOT / go.RUBRIC_PATH)
    request = go.build_requests(inputs)[0]
    record = go.ask(FakeTransport(), rubric, request)
    assert record["requestSha256"] == go.request_sha256(rubric, request)
    with pytest.raises(go.GoEssentialityError, match="answered"):
        go.ask(FakeTransport(model="jev-latest"), rubric, request)

    class Empty(FakeTransport):
        def post(self, body):
            return {"model": go.MODEL, "answers": {}}

    with pytest.raises(go.GoEssentialityError, match="answers differ"):
        go.ask(Empty(), rubric, request)


# ------------------------------------------------- judge, evaluate, and pins


def test_judge_and_evaluate_offline_then_reuse_pins(tmp_path: Path) -> None:
    """Judging fills only unpinned requests and logs the run."""
    root = copy_inputs(tmp_path, with_audit=False)
    transport = FakeTransport()
    assert go.judge(root, transport, workers=4) == {"requests": 3168, "answered": 3168}
    assert transport.calls == 3168
    assert go.judge(root, transport, workers=4) == {"requests": 3168, "answered": 0}
    assert go.evaluate(root, transport, workers=2) == 46
    log = go.load_json(root / go.RUN_LOG_PATH)
    assert log["judge"]["requests"] == 3168 and log["evaluate"]["requests"] == 46
    payload = go.build_payload(root)
    assert payload["counts"]["byTier"]["go-iea-context"] == 112
    assert payload["counts"]["byTier"]["unknown"] == 281 - 112


def test_main_runs_network_modes_through_the_transport(tmp_path: Path, monkeypatch,
                                                        capsys) -> None:
    """--judge and --evaluate use the transport; the fake keeps them offline."""
    root = copy_inputs(tmp_path, with_audit=False)
    monkeypatch.setattr(go, "TypeSafeTransport", lambda key: FakeTransport())
    for flag in ("--judge", "--evaluate"):
        monkeypatch.setattr(sys, "argv", ["tool", flag, "--root", str(root)])
        assert go.main() == 0
    output = capsys.readouterr().out
    assert "'answered': 3168" in output and "evaluated 46 cases" in output


def test_pinned_results_detect_tampering(tmp_path: Path) -> None:
    """Changed, reordered, re-modelled, or unblinded results fail the build."""
    root = copy_inputs(tmp_path)
    path = root / go.RESULTS_PATH
    original = go.load_jsonl(path)

    def expect(records: list, message: str) -> None:
        path.write_text(go.render_jsonl(records), encoding="utf-8")
        with pytest.raises(go.GoEssentialityError, match=message):
            go.build_payload(root)

    expect(original[1:], "run --judge")
    expect(original + original[:1], "duplicate keys")
    expect([{**original[0], "requestSha256": "0"}] + original[1:], "different request")
    expect([{**original[0], "model": "jev-latest"}] + original[1:], "different model")
    expect([{**original[0], "answers": {}}] + original[1:], "answers differ")
    path.write_text(go.render_jsonl(original), encoding="utf-8")
    go.generate(root, check=True)

    rubric = go.load_json(root / go.RUBRIC_PATH)
    leaky = go.Request("context:X", "context",
                       {"go_annotations": [{"term": "M744_RS00005"}]}, ("context",))
    record = {"key": leaky.key, "requestSha256": go.request_sha256(rubric, leaky),
              "model": go.MODEL, "rubricVersion": rubric["rubricVersion"],
              "answers": FakeTransport().post(go.request_body(rubric, leaky))["answers"]}
    path.write_text(go.render_jsonl([record]), encoding="utf-8")
    with pytest.raises(go.GoEssentialityError, match="not blinded"):
        go.pinned_results(root, rubric, [leaky])


def test_check_detects_stale_output_and_summary(tmp_path: Path) -> None:
    """--check fails when either generated file differs from a rebuild."""
    root = copy_inputs(tmp_path)
    for path in (go.OUTPUT_PATH, go.SUMMARY_PATH):
        original = (root / path).read_text(encoding="utf-8")
        (root / path).write_text(original + " ", encoding="utf-8")
        with pytest.raises(go.GoEssentialityError, match="differs from a rebuild"):
            go.generate(root, check=True)
        (root / path).unlink()
        with pytest.raises(go.GoEssentialityError, match="differs from a rebuild"):
            go.generate(root, check=True)
        go.generate(root, check=False)
    go.generate(root, check=True)


def test_evaluation_and_spot_check_must_match_their_pins(tmp_path: Path) -> None:
    """Evaluation answers and spot-check loci cannot drift from their sources."""
    root = copy_inputs(tmp_path)
    evaluation = root / go.EVALUATION_RESULTS_PATH
    records = go.load_jsonl(evaluation)
    evaluation.write_text(go.render_jsonl(records[1:]), encoding="utf-8")
    with pytest.raises(go.GoEssentialityError, match="evaluation results do not match"):
        go.generate(root, check=False)
    evaluation.write_text(
        go.render_jsonl([{**records[0], "requestSha256": "0"}] + records[1:]), encoding="utf-8"
    )
    with pytest.raises(go.GoEssentialityError, match="evaluated on a different request"):
        go.generate(root, check=False)
    evaluation.write_text(go.render_jsonl(records), encoding="utf-8")

    spot = root / go.SPOT_CHECK_PATH
    review = json.loads(spot.read_text(encoding="utf-8"))
    review["sample"]["seed"] = 1
    spot.write_text(json.dumps(review), encoding="utf-8")
    with pytest.raises(go.GoEssentialityError, match="seeded sample"):
        go.generate(root, check=False)


# ------------------------------------------------------------ payload schema


def test_validate_payload_rejects_inconsistent_records(payload: dict) -> None:
    """Schema, eligibility, labels, discrepancies, order, and counts are enforced."""
    go.validate_payload(payload)
    locus = "M744_RS08250"

    def expect(mutate, message: str) -> None:
        changed = copy.deepcopy(payload)
        mutate(changed)
        with pytest.raises(go.GoEssentialityError, match=message):
            go.validate_payload(changed)

    expect(lambda p: p["byLocus"][locus].pop("tier"), "fields differ")
    expect(lambda p: p["byLocus"][locus].update(tier="measured"), "invalid tier")
    expect(lambda p: p["byLocus"][locus]["goContext"].update(pCore=0.1), "disagrees")
    expect(lambda p: p["byLocus"][locus].update(pcc7942Status="essential"), "eligibility")
    expect(lambda p: p["byLocus"]["M744_RS00010"].update(
        discrepancies=[{"kind": "utex-product", "note": "x"}]), "without GO terms")
    expect(lambda p: p["byLocus"][locus].update(
        discrepancies=[{"kind": "other", "note": "x"}]), "invalid discrepancy")
    expect(lambda p: p["counts"].update(plottedLoci=1), "counts do not match")
    expect(lambda p: p.update(byLocus=dict(reversed(list(p["byLocus"].items())))), "sorted")


# ------------------------------------------------------- contract validator


def load_validator():
    """Imports the standard-library contract validator."""
    spec = importlib.util.spec_from_file_location(
        "validate_contract_for_go", ROOT / "tools/validate_contract.py"
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_contract_validator_rederives_tiers(payload: dict) -> None:
    """The independent validator accepts the artifact and rejects drift."""
    validator = load_validator()
    genes = json.loads((ROOT / go.GENES_PATH).read_text(encoding="utf-8"))
    candidate = json.loads((ROOT / go.CANDIDATE_PATH).read_text(encoding="utf-8"))

    def failures(data) -> list[str]:
        report = validator.Report()
        validator.validate_go_iea_essentiality(data, genes, candidate, report)
        return report.failures

    assert failures(payload) == []
    assert failures(None) == ["GO IEA essentiality is an object"]
    for mutate, label in (
        (lambda p: p["attribution"].update(license="none"), "attribution"),
        (lambda p: p["policy"].update(precedence=[]), "precedence"),
        (lambda p: p["byLocus"]["M744_RS08250"]["goContext"].update(pCore=2), "[0, 1]"),
        (lambda p: p["byLocus"]["M744_RS00005"].update(tier="unknown"), "follows precedence"),
        (lambda p: p["counts"]["byTier"].update(unknown=0), "tier counts"),
        (lambda p: p["byLocus"].pop("M744_RS00005"), "covers every plotted CDS"),
    ):
        changed = copy.deepcopy(payload)
        mutate(changed)
        assert any(label in failure for failure in failures(changed)), label


def test_main_offline_modes_in_process(monkeypatch, capsys) -> None:
    """--check, the default build, and the sheet run in-process without the API."""
    sheet = go.spot_check_sheet(ROOT)
    assert sheet
    assert all(set(row) == {"locusTag", "go_annotations", "annotations"} for row in sheet)
    for flags in (["--check"], ["--spot-check-sheet"]):
        monkeypatch.setattr(sys, "argv", ["tool", *flags])
        assert go.main() == 0
    output = capsys.readouterr().out
    assert "OK: site/data/go-iea-essentiality-v1.json" in output
    assert '"go_annotations"' in output


def test_main_reports_tool_errors(tmp_path: Path, monkeypatch) -> None:
    """A tool error exits with status 1 and a readable message."""
    root = copy_inputs(tmp_path)
    (root / go.OUTPUT_PATH).unlink()
    monkeypatch.setattr(sys, "argv", ["tool", "--check", "--root", str(root)])
    with pytest.raises(SystemExit) as raised:
        go.main()
    assert raised.value.code == 1
