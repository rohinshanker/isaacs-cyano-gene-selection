#!/usr/bin/env python3
"""Build and verify the source-derived function-category layer.

Usage:
    python3 tools/build_source_derived_categories.py            # build from pinned judgments
    python3 tools/build_source_derived_categories.py --check    # verify; never calls the API
    python3 tools/build_source_derived_categories.py --judge    # Jev inference; needs TYPESAFE_API_KEY
    python3 tools/build_source_derived_categories.py --evaluate # predeclared evaluation set
    python3 tools/build_source_derived_categories.py --spot-check-sheet [--seed N]  # fresh blinded sheet
    python3 tools/build_source_derived_categories.py --spot-check-replay  # the pinned reviewed sheet

Jev answers one bounded Choice per source and locus: which of the lab's eleven
function categories the locus's GO IEA terms, or its joined PCC 7942 product
name, place the protein in. The threshold, the reviewed-wins precedence, and the
disagreement rule are ordinary code below and are mirrored by the browser
loader and the contract validator. Only --judge and --evaluate use the network;
the build and --check read the pinned audit files. The reviewed table in
site/data/function-categories-v1.json is read, never written.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import os
import random
import sys
import threading
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_go_iea_essentiality import (  # noqa: E402
    LOCUS_TAG_PATTERN, MODEL, TypeSafeTransport, canonical_json, canonical_sha256,
    load_json, load_jsonl, read_go_terms, read_pcc_products, render_json, render_jsonl,
    sha256_file, validate_answer,
)

RELEASE_ID = "GCF_000817325.1-RS_2026_05_13"
RELEASE_DIR = Path("data/annotation/releases") / RELEASE_ID
GO_PATH = RELEASE_DIR / "go-annotations-v1.tsv"
GO_NAMES_PATH = Path("site/data/go-term-names-v1.json")
GENES_PATH = Path("site/data/genes.json")
PCC_PATH = Path("site/data/pcc7942-essentiality-v1.json")
CATEGORIES_PATH = Path("site/data/function-categories-v1.json")
PCC_GFF_PATH = Path("data/annotation/source/GCF_000012525.1_ASM1252v1_genomic.gff.gz")
PROVENANCE_PATH = Path("data/annotation/PROVENANCE.md")
AUDIT_DIR = Path("data/audits/source-derived-categories")
RUBRIC_PATH = AUDIT_DIR / "rubric.json"
EVALUATION_SET_PATH = AUDIT_DIR / "evaluation-set.json"
RESULTS_PATH = AUDIT_DIR / "results.jsonl"
EVALUATION_RESULTS_PATH = AUDIT_DIR / "evaluation-results.jsonl"
RUN_LOG_PATH = AUDIT_DIR / "run-log.json"
SPOT_CHECK_PATH = AUDIT_DIR / "spot-check.json"
SUMMARY_PATH = AUDIT_DIR / "summary.json"
OUTPUT_PATH = Path("site/data/source-derived-categories-v1.json")

# Policy threshold. It was set from the calibration recorded in
# docs/validation/source-derived-categories.md; changing it needs no new
# inference but does need that document's evidence re-read.
DERIVED_THRESHOLD = 0.8

PCC_SOURCE = "pcc-7942"
GO_SOURCE = "go-iea"
SOURCES = (PCC_SOURCE, GO_SOURCE)
EVIDENCE_LABELS = ("reviewed", "pcc-7942-derived", "go-iea-derived")
UNKNOWN_ID = "unknown-or-unclassified"
MULTIPLE_ID = "multiple-functions"
QUESTION_ID = "category"
GO_COPYRIGHT = "copyright © 1999–2026 Gene Ontology Consortium"
SPOT_CHECK_SEED = 20260922

ATTRIBUTION = {
    "goIea": {
        "creator": "Gene Ontology Consortium",
        "copyright": "Copyright © 1999–2026 Gene Ontology Consortium",
        "license": "CC BY 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
        "citationPolicy": "https://geneontology.org/docs/go-citation-policy/",
        "disclaimer": "Gene Ontology data are provided AS-IS without express or implied warranty.",
        "source": (
            "NCBI RefSeq gene_ontology.gaf.gz generated 2026-05-14 against GO version "
            "2026-03-25, joined to UTEX 2973 loci by exact RefSeq protein_id"
        ),
        "changes": (
            "This file derives a function category from those IEA relationships with "
            "TypeSafe Jev judgments; it does not alter the GO rows."
        ),
        "notice": "data/annotation/PROVENANCE.md",
    },
    "pcc7942": {
        "productNames": (
            "NCBI RefSeq annotation of Synechococcus elongatus PCC 7942, assembly "
            "GCF_000012525.1 (ASM1252v1), CDS product attributes"
        ),
        "joins": (
            "Adomako et al. 2022 Data Set S1 (CC BY 4.0), republishing Rubin et al. 2015 "
            "PCC 7942 loci, admitted only at exact, unambiguous shared-protein crosswalk "
            "joins as recorded in site/data/pcc7942-essentiality-v1.json"
        ),
        "attributedStudies": ["Adomako et al. 2022", "Rubin et al. 2015"],
        "adomakoDoi": "10.1128/mbio.00862-22",
        "rubinDoi": "10.1073/pnas.1519220112",
        "license": "CC BY 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
        "crossStrainAssumption": (
            "A PCC 7942 product name describes the joined PCC 7942 protein. Applying its "
            "category to the UTEX 2973 locus is a shared-protein assumption, not a UTEX "
            "2973 annotation."
        ),
    },
}

POLICY = {
    "evidenceLabels": list(EVIDENCE_LABELS),
    "sources": list(SOURCES),
    "assignmentRule": (
        "A source assigns its most likely category when that category is not "
        "unknown-or-unclassified and its probability reaches the threshold. Otherwise "
        "the source assigns nothing for the locus."
    ),
    "precedence": (
        "When the UTEX 2973 source is enabled and the locus has a lab-reviewed row, the "
        "reviewed category is the colour, including a reviewed unknown. Otherwise the "
        "colour is the category assigned by an enabled derived source."
    ),
    "disagreementRule": (
        "When two enabled derived sources assign different categories, the locus takes "
        "the multiple-functions bucket and the detail panel names each source's category."
    ),
    "reviewedTable": (
        "Derived categories never enter site/data/function-categories-v1.json, never "
        "change its reviewed rows, and never display without their evidence label."
    ),
    "thresholds": {"derivedProbabilityAtLeast": DERIVED_THRESHOLD},
}


class DerivedCategoryError(ValueError):
    """Raised when an input, judgment, or generated artifact is invalid."""


# ------------------------------------------------------------------- inputs


@dataclass(frozen=True)
class Inputs:
    """Every pinned fact the requests and the payload are derived from."""

    loci: tuple[str, ...]
    genes: dict[str, dict[str, Any]]
    go_terms: dict[str, list[dict[str, str]]]
    pcc_joins: dict[str, tuple[str, str]]
    vocabulary: dict[str, Any]
    category_ids: tuple[str, ...]
    reviewed: dict[str, list[str]]


def load_inputs(root: Path) -> Inputs:
    """Loads and cross-checks every pinned input."""
    provenance = (root / PROVENANCE_PATH).read_text(encoding="utf-8")
    if GO_COPYRIGHT not in provenance or "Creative Commons Attribution 4.0" not in provenance:
        raise DerivedCategoryError("PROVENANCE.md no longer carries the GO CC BY 4.0 notice")
    genes_list = load_json(root / GENES_PATH)
    genes = {row["id"]: row for row in genes_list}
    if len(genes) != len(genes_list):
        raise DerivedCategoryError("genes.json has duplicate locus tags")
    names = load_json(root / GO_NAMES_PATH)["terms"]
    go_terms = read_go_terms(root / GO_PATH, names)
    unknown = sorted(set(go_terms) - set(genes))
    if unknown:
        raise DerivedCategoryError(f"GO rows name unplotted loci: {unknown[:3]}")
    pcc = load_json(root / PCC_PATH)
    if pcc["source"]["annotationRelease"] != RELEASE_ID:
        raise DerivedCategoryError("PCC essentiality release differs")
    if sorted(pcc["byLocus"]) != sorted(genes):
        raise DerivedCategoryError("PCC essentiality does not cover every plotted locus")
    products = read_pcc_products(root / PCC_GFF_PATH)
    joins: dict[str, tuple[str, str]] = {}
    for locus, call in pcc["byLocus"].items():
        if call["mappingStatus"] != "accepted":
            continue
        product = products.get(call["pccLocusTag"])
        if product is None:
            raise DerivedCategoryError(f"no PCC 7942 product for {call['pccLocusTag']}")
        joins[locus] = (call["pccLocusTag"], product)
    categories = load_json(root / CATEGORIES_PATH)
    if categories["provenance"]["annotationRelease"] != RELEASE_ID:
        raise DerivedCategoryError("function-category release differs")
    if categories["policy"]["assignmentMethod"] != "explicit-user-review-only":
        raise DerivedCategoryError("function-category table is not the reviewed table")
    vocabulary = categories["vocabulary"]
    category_ids = tuple(entry["id"] for entry in vocabulary["categories"])
    if len(category_ids) != 11 or category_ids[-1] != UNKNOWN_ID:
        raise DerivedCategoryError("function-category vocabulary is not the eleven-label set")
    if vocabulary["multipleFunctionsBucket"]["id"] != MULTIPLE_ID:
        raise DerivedCategoryError("multiple-functions bucket id differs")
    reviewed = {row["locusTag"]: list(row["categoryIds"]) for row in categories["assignments"]}
    return Inputs(
        loci=tuple(sorted(genes)),
        genes=genes,
        go_terms=go_terms,
        pcc_joins=joins,
        vocabulary=vocabulary,
        category_ids=category_ids,
        reviewed=reviewed,
    )


# ----------------------------------------------------------------- requests


@dataclass(frozen=True)
class Request:
    """One blinded Jev request: its key, source, and state."""

    key: str
    source: str
    state: dict[str, Any]


def go_request(locus: str, inputs: Inputs, prefix: str = "go") -> Request:
    """The GO IEA request for one locus: its terms only."""
    return Request(f"{prefix}:{locus}", GO_SOURCE, {"go_annotations": inputs.go_terms[locus]})


def pcc_request(locus: str, inputs: Inputs, prefix: str = "pcc") -> Request:
    """The PCC 7942 request for one locus: the joined product name only."""
    _, product = inputs.pcc_joins[locus]
    return Request(f"{prefix}:{locus}", PCC_SOURCE, {"pcc_7942_refseq_product": product})


def build_requests(inputs: Inputs) -> list[Request]:
    """Returns one request per source for every locus that source annotates."""
    requests: list[Request] = []
    for locus in inputs.loci:
        if locus in inputs.pcc_joins:
            requests.append(pcc_request(locus, inputs))
        if locus in inputs.go_terms:
            requests.append(go_request(locus, inputs))
    return requests


def question_body(rubric: dict[str, Any], source: str) -> dict[str, Any]:
    """Returns the frozen Choice question for one source."""
    spec = rubric["goRequest" if source == GO_SOURCE else "pccRequest"]
    return {
        "type": "choice",
        "instructions": {**spec["instructions"], **rubric["sharedInstructions"]},
        "criteria": rubric["criteria"],
    }


def request_body(rubric: dict[str, Any], request: Request) -> dict[str, Any]:
    """Returns the complete API request body."""
    return {
        "model": MODEL,
        "state": request.state,
        "questions": {QUESTION_ID: question_body(rubric, request.source)},
    }


def request_sha256(rubric: dict[str, Any], request: Request) -> str:
    """Identifies a request by everything the model sees."""
    return canonical_sha256(request_body(rubric, request))


def check_rubric(rubric: dict[str, Any], inputs: Inputs) -> None:
    """The rubric's options must be exactly the reviewed vocabulary."""
    if tuple(rubric["criteria"]) != inputs.category_ids:
        raise DerivedCategoryError("rubric options differ from the reviewed vocabulary")
    labels = {entry["id"]: entry["label"] for entry in inputs.vocabulary["categories"]}
    for category, spec in rubric["criteria"].items():
        if spec["label"] != labels[category]:
            raise DerivedCategoryError(f"rubric label for {category} differs from the vocabulary")


# ---------------------------------------------------------------- inference


def ask(transport: Any, rubric: dict[str, Any], request: Request) -> dict[str, Any]:
    """Runs one request and returns its validated pinned record."""
    body = request_body(rubric, request)
    response = transport.post(body)
    if response.get("model") != MODEL:
        raise DerivedCategoryError(f"model {response.get('model')!r} answered, not {MODEL}")
    answers = response.get("answers", {})
    if set(answers) != {QUESTION_ID}:
        raise DerivedCategoryError(f"{request.key} answers differ from questions")
    validate_answer(body["questions"][QUESTION_ID], answers[QUESTION_ID])
    return {
        "key": request.key,
        "requestSha256": canonical_sha256(body),
        "rubricVersion": rubric["rubricVersion"],
        "model": response["model"],
        "answers": answers,
        "inputTokens": response.get("usage", {}).get("input_tokens"),
    }


def judge(root: Path, transport: Any, workers: int = 8) -> dict[str, int]:
    """Answers every request not already pinned for its exact body."""
    rubric = load_json(root / RUBRIC_PATH)
    inputs = load_inputs(root)
    check_rubric(rubric, inputs)
    requests = build_requests(inputs)
    pinned = {record["key"]: record for record in load_jsonl(root / RESULTS_PATH)}
    missing = [
        request for request in requests
        if pinned.get(request.key, {}).get("requestSha256") != request_sha256(rubric, request)
    ]
    started = now()
    fresh = answer_all(transport, rubric, missing, workers) if missing else []
    for record in fresh:
        pinned[record["key"]] = record
    (root / RESULTS_PATH).write_text(
        render_jsonl(pinned[request.key] for request in requests), encoding="utf-8",
    )
    if fresh:
        update_run_log(root, "judge", started, fresh)
    return {"requests": len(requests), "answered": len(fresh)}


def answer_all(transport: Any, rubric: dict[str, Any], requests: list[Request],
               workers: int) -> list[dict[str, Any]]:
    """Runs requests concurrently and returns their records in request order."""
    lock = threading.Lock()
    done = 0
    records: dict[str, dict[str, Any]] = {}

    def one(request: Request) -> None:
        nonlocal done
        record = ask(transport, rubric, request)
        with lock:
            records[request.key] = record
            done += 1
            if done % 200 == 0:
                print(f"  {done}/{len(requests)} requests answered", flush=True)

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        for future in [pool.submit(one, request) for request in requests]:
            future.result()
    return [records[request.key] for request in requests]


def now() -> str:
    """The current UTC time in the run log's format."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def update_run_log(root: Path, stage: str, started: str,
                   records: list[dict[str, Any]]) -> None:
    """Records when a network stage ran, how many calls it made, and its tokens."""
    path = root / RUN_LOG_PATH
    log = load_json(path) if path.exists() else {}
    log[stage] = {
        "startedAt": started,
        "completedAt": now(),
        "requests": len(records),
        "inputTokens": sum(record["inputTokens"] or 0 for record in records),
        "model": MODEL,
    }
    path.write_text(render_json(log), encoding="utf-8")


# --------------------------------------------------------------- evaluation


def evaluation_requests(inputs: Inputs, evaluation: dict[str, Any]) -> list[tuple[dict[str, Any], Request]]:
    """Builds one request per predeclared evaluation case."""
    cases: list[tuple[dict[str, Any], Request]] = []
    for case in evaluation["go"]:
        cases.append((case, go_request(case["locusTag"], inputs, "eval-go")))
    for case in evaluation["pcc"]:
        cases.append((case, pcc_request(case["locusTag"], inputs, "eval-pcc")))
    return cases


def evaluate(root: Path, transport: Any, workers: int = 8) -> int:
    """Runs the predeclared evaluation set and pins its answers."""
    rubric = load_json(root / RUBRIC_PATH)
    inputs = load_inputs(root)
    check_rubric(rubric, inputs)
    cases = evaluation_requests(inputs, load_json(root / EVALUATION_SET_PATH))
    started = now()
    records = answer_all(transport, rubric, [request for _, request in cases], workers)
    (root / EVALUATION_RESULTS_PATH).write_text(render_jsonl(records), encoding="utf-8")
    update_run_log(root, "evaluate", started, records)
    return len(records)


# ------------------------------------------------------------------- policy


def derived_category(answer: dict[str, Any]) -> str | None:
    """Applies the assignment rule to one Choice answer."""
    most_likely = answer["choice"]
    probability = answer["probabilities"][most_likely]
    if most_likely == UNKNOWN_ID or probability < DERIVED_THRESHOLD:
        return None
    return most_likely


def resolve_bucket(reviewed: list[str] | None, derived: dict[str, str | None],
                   enabled: tuple[str, ...]) -> tuple[str, list[str]]:
    """Applies reviewed-wins precedence and the disagreement rule for one locus.

    Returns the bucket id and the evidence labels behind it. `enabled` names the
    toggled-on sources among utex-2973, pcc-7942, and go-iea.
    """
    if "utex-2973" in enabled and reviewed is not None:
        if len(reviewed) > 1:
            return MULTIPLE_ID, ["reviewed"]
        return reviewed[0], ["reviewed"]
    assigned = [
        (f"{source}-derived", derived[source])
        for source in SOURCES
        if source in enabled and derived.get(source)
    ]
    if not assigned:
        return UNKNOWN_ID, []
    categories = {category for _, category in assigned}
    labels = [label for label, _ in assigned]
    if len(categories) == 1:
        return assigned[0][1], labels
    return MULTIPLE_ID, labels


def locus_record(locus: str, inputs: Inputs, results: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Derives one locus's per-source judgments from pinned answers."""
    record: dict[str, Any] = {PCC_SOURCE: None, GO_SOURCE: None}
    if locus in inputs.pcc_joins:
        answer = results[f"pcc:{locus}"]["answers"][QUESTION_ID]
        record[PCC_SOURCE] = {
            "pccLocusTag": inputs.pcc_joins[locus][0],
            "mostLikely": answer["choice"],
            "probability": answer["probabilities"][answer["choice"]],
            "categoryId": derived_category(answer),
        }
    if locus in inputs.go_terms:
        answer = results[f"go:{locus}"]["answers"][QUESTION_ID]
        record[GO_SOURCE] = {
            "termCount": len(inputs.go_terms[locus]),
            "mostLikely": answer["choice"],
            "probability": answer["probabilities"][answer["choice"]],
            "categoryId": derived_category(answer),
        }
    return record


def pinned_results(root: Path, rubric: dict[str, Any], requests: list[Request]) -> dict[str, dict[str, Any]]:
    """Returns pinned records, failing when any request lacks an exact answer."""
    records = load_jsonl(root / RESULTS_PATH)
    by_key = {record["key"]: record for record in records}
    if len(by_key) != len(records):
        raise DerivedCategoryError("results.jsonl has duplicate keys")
    if [record["key"] for record in records] != [request.key for request in requests]:
        raise DerivedCategoryError(
            "results.jsonl does not match the current requests; run --judge"
        )
    for request in requests:
        record = by_key[request.key]
        body = request_body(rubric, request)
        if record["requestSha256"] != canonical_sha256(body):
            raise DerivedCategoryError(f"{request.key} was judged on a different request")
        if record["model"] != MODEL or record["rubricVersion"] != rubric["rubricVersion"]:
            raise DerivedCategoryError(f"{request.key} has a different model or rubric")
        if set(record["answers"]) != {QUESTION_ID}:
            raise DerivedCategoryError(f"{request.key} answers differ from questions")
        validate_answer(body["questions"][QUESTION_ID], record["answers"][QUESTION_ID])
        if LOCUS_TAG_PATTERN.search(canonical_json(request.state)):
            raise DerivedCategoryError(f"{request.key} state is not blinded")
    return by_key


# ------------------------------------------------------------------ payload


def build_payload(root: Path) -> dict[str, Any]:
    """Builds the site artifact from pinned inputs and judgments."""
    rubric = load_json(root / RUBRIC_PATH)
    inputs = load_inputs(root)
    check_rubric(rubric, inputs)
    requests = build_requests(inputs)
    results = pinned_results(root, rubric, requests)
    by_locus = {locus: locus_record(locus, inputs, results) for locus in inputs.loci}
    payload = {
        "schemaVersion": 1,
        "datasetVersion": "source-derived-categories-v1",
        "annotationRelease": RELEASE_ID,
        "attribution": ATTRIBUTION,
        "judgment": {
            "provider": "TypeSafe System One",
            "model": MODEL,
            "rubricVersion": rubric["rubricVersion"],
            "rubricSha256": sha256_file(root / RUBRIC_PATH),
            "resultsSha256": sha256_file(root / RESULTS_PATH),
            "audit": AUDIT_DIR.as_posix(),
            "validation": "docs/validation/source-derived-categories.md",
        },
        "inputs": {
            path.as_posix(): sha256_file(root / path)
            for path in (GO_PATH, GO_NAMES_PATH, PCC_PATH, CATEGORIES_PATH, PCC_GFF_PATH)
        },
        "vocabulary": inputs.vocabulary,
        "policy": POLICY,
        "counts": payload_counts(by_locus, inputs),
        "byLocus": by_locus,
    }
    validate_payload(payload, inputs)
    return payload


def source_counts(by_locus: dict[str, dict[str, Any]], source: str,
                  category_ids: tuple[str, ...]) -> dict[str, Any]:
    """Judged, assigned, and per-category totals for one source."""
    judged = [row[source] for row in by_locus.values() if row[source]]
    assigned = Counter(entry["categoryId"] for entry in judged if entry["categoryId"])
    return {
        "judged": len(judged),
        "assigned": sum(assigned.values()),
        "mostLikelyUnknown": sum(entry["mostLikely"] == UNKNOWN_ID for entry in judged),
        "belowThreshold": sum(
            entry["mostLikely"] != UNKNOWN_ID and entry["categoryId"] is None for entry in judged
        ),
        "byCategory": {category: assigned[category] for category in category_ids[:-1]},
    }


def resolved_counts(by_locus: dict[str, dict[str, Any]], inputs: Inputs,
                    enabled: tuple[str, ...]) -> dict[str, Any]:
    """Legend counts under one toggle combination, exactly as the browser resolves them."""
    buckets: Counter[str] = Counter()
    evidence: Counter[str] = Counter()
    for locus, row in by_locus.items():
        bucket, labels = resolve_bucket(
            inputs.reviewed.get(locus),
            {source: (row[source] or {}).get("categoryId") for source in SOURCES},
            enabled,
        )
        buckets[bucket] += 1
        evidence["+".join(labels) if labels else "none"] += 1
    return {
        "enabledSources": list(enabled),
        "byCategory": {category: buckets[category] for category in inputs.category_ids[:-1]},
        "multipleFunctions": buckets[MULTIPLE_ID],
        "unknownOrUnclassified": buckets[UNKNOWN_ID],
        "byEvidence": dict(sorted(evidence.items())),
    }


def payload_counts(by_locus: dict[str, dict[str, Any]], inputs: Inputs) -> dict[str, Any]:
    """Summarizes both sources, their agreement, and the all-sources legend."""
    both = [
        row for row in by_locus.values()
        if row[PCC_SOURCE] and row[GO_SOURCE]
        and row[PCC_SOURCE]["categoryId"] and row[GO_SOURCE]["categoryId"]
    ]
    return {
        "plottedLoci": len(by_locus),
        "bySource": {
            source: source_counts(by_locus, source, inputs.category_ids) for source in SOURCES
        },
        "bothSourcesAssigned": {
            "loci": len(both),
            "agree": sum(row[PCC_SOURCE]["categoryId"] == row[GO_SOURCE]["categoryId"] for row in both),
            "disagree": sum(row[PCC_SOURCE]["categoryId"] != row[GO_SOURCE]["categoryId"] for row in both),
        },
        "allSourcesLegend": resolved_counts(by_locus, inputs, ("utex-2973",) + SOURCES),
    }


def validate_payload(payload: dict[str, Any], inputs: Inputs) -> None:
    """Checks schema, the assignment rule, and count consistency of a payload."""
    by_locus = payload["byLocus"]
    if list(by_locus) != sorted(by_locus) or set(by_locus) != set(inputs.loci):
        raise DerivedCategoryError("byLocus must list every plotted locus in sorted order")
    for locus, row in by_locus.items():
        if set(row) != set(SOURCES):
            raise DerivedCategoryError(f"{locus} fields differ from schema")
        if (row[PCC_SOURCE] is None) != (locus not in inputs.pcc_joins):
            raise DerivedCategoryError(f"{locus} PCC judgment presence disagrees with its join")
        if (row[GO_SOURCE] is None) != (locus not in inputs.go_terms):
            raise DerivedCategoryError(f"{locus} GO judgment presence disagrees with its terms")
        for source in SOURCES:
            entry = row[source]
            if entry is None:
                continue
            if entry["mostLikely"] not in inputs.category_ids:
                raise DerivedCategoryError(f"{locus} {source} names an unknown category")
            if not 0 <= entry["probability"] <= 1:
                raise DerivedCategoryError(f"{locus} {source} probability is not a probability")
            expected = None
            if entry["mostLikely"] != UNKNOWN_ID and entry["probability"] >= DERIVED_THRESHOLD:
                expected = entry["mostLikely"]
            if entry["categoryId"] != expected:
                raise DerivedCategoryError(f"{locus} {source} category disagrees with its probability")
    if payload["counts"] != payload_counts(by_locus, inputs):
        raise DerivedCategoryError("counts do not match byLocus")


# ------------------------------------------------------------ audit summary


def evaluation_summary(root: Path, rubric: dict[str, Any], inputs: Inputs) -> dict[str, Any]:
    """Scores pinned evaluation answers against the predeclared labels."""
    evaluation = load_json(root / EVALUATION_SET_PATH)
    cases = evaluation_requests(inputs, evaluation)
    records = load_jsonl(root / EVALUATION_RESULTS_PATH)
    if [record["key"] for record in records] != [request.key for _, request in cases]:
        raise DerivedCategoryError("evaluation results do not match the evaluation set")
    rows = []
    for (case, request), record in zip(cases, records):
        if record["requestSha256"] != request_sha256(rubric, request):
            raise DerivedCategoryError(f"{request.key} was evaluated on a different request")
        answer = record["answers"][QUESTION_ID]
        assigned = derived_category(answer)
        expected_assigned = None if case["expected"] == UNKNOWN_ID else case["expected"]
        rows.append({
            "source": request.source,
            "locusTag": case["locusTag"],
            "expected": case["expected"],
            "choice": answer["choice"],
            "probability": answer["probabilities"][answer["choice"]],
            "assigned": assigned,
            "exactChoice": answer["choice"] == case["expected"],
            "assignedAsExpected": assigned == expected_assigned,
        })
    summary: dict[str, Any] = {"threshold": DERIVED_THRESHOLD}
    for source in SOURCES:
        subset = [row for row in rows if row["source"] == source]
        summary[source] = {
            "cases": len(subset),
            "exactChoice": sum(row["exactChoice"] for row in subset),
            "assignedAsExpected": sum(row["assignedAsExpected"] for row in subset),
            "wrongCategoryAssigned": sum(
                row["assigned"] is not None and row["assigned"] != row["expected"] for row in subset
            ),
        }
    summary["rows"] = rows
    return summary


def reviewed_comparison(payload: dict[str, Any], inputs: Inputs) -> list[dict[str, Any]]:
    """Each source's judgment beside the lab-reviewed category, never shown to Jev."""
    rows = []
    for locus, reviewed in sorted(inputs.reviewed.items()):
        row = payload["byLocus"][locus]
        entry: dict[str, Any] = {"locusTag": locus, "reviewed": reviewed}
        for source in SOURCES:
            judged = row[source]
            entry[source] = None if judged is None else {
                "mostLikely": judged["mostLikely"],
                "probability": judged["probability"],
                "categoryId": judged["categoryId"],
                "agreesWithReviewed": judged["categoryId"] is not None
                and judged["categoryId"] in reviewed,
            }
        rows.append(entry)
    return rows


CALIBRATION_BINS = ((0.0, 0.4), (0.4, 0.6), (0.6, 0.8), (0.8, 0.9), (0.9, 0.95), (0.95, 1.01))


def cross_source_calibration(payload: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    """Relates one source's probability to agreement with the other source's assignment.

    Both sources were judged blind to each other, so agreement is real signal
    about whether a probability band is trustworthy, though not ground truth.
    """
    table: dict[str, list[dict[str, Any]]] = {}
    for source, other in ((PCC_SOURCE, GO_SOURCE), (GO_SOURCE, PCC_SOURCE)):
        rows = []
        for low, high in CALIBRATION_BINS:
            pairs = [
                row for row in payload["byLocus"].values()
                if row[source] and row[other] and row[other]["categoryId"]
                and row[source]["mostLikely"] != UNKNOWN_ID
                and low <= row[source]["probability"] < high
            ]
            agree = sum(row[source]["mostLikely"] == row[other]["categoryId"] for row in pairs)
            rows.append({
                "probabilityRange": [low, min(high, 1.0)],
                "loci": len(pairs),
                "agreeWithOtherSource": agree,
                "agreementFraction": round(agree / len(pairs), 3) if pairs else None,
            })
        table[source] = rows
    return table


def spot_check_strata(payload: dict[str, Any], threshold: float) -> dict[str, list[str]]:
    """Groups judged loci by how the two sources relate at a given threshold."""
    strata: dict[str, list[str]] = {"disagree": [], "agree": [], "single": [], "none": []}

    def assigned(entry: dict[str, Any] | None) -> str | None:
        if not entry or entry["mostLikely"] == UNKNOWN_ID or entry["probability"] < threshold:
            return None
        return entry["mostLikely"]

    for locus, row in payload["byLocus"].items():
        if not row[PCC_SOURCE] and not row[GO_SOURCE]:
            continue
        pcc, go = assigned(row[PCC_SOURCE]), assigned(row[GO_SOURCE])
        if pcc and go:
            strata["agree" if pcc == go else "disagree"].append(locus)
        elif pcc or go:
            strata["single"].append(locus)
        else:
            strata["none"].append(locus)
    return {name: sorted(loci) for name, loci in strata.items()}


SPOT_CHECK_SIZES = {"disagree": 10, "agree": 8, "single": 8, "none": 8}


def spot_check_sample(payload: dict[str, Any], threshold: float,
                      seed: int = SPOT_CHECK_SEED) -> list[str]:
    """Draws the blinded, stratified sample at the recorded threshold."""
    rng = random.Random(seed)
    strata = spot_check_strata(payload, threshold)
    chosen: list[str] = []
    for name, size in SPOT_CHECK_SIZES.items():
        chosen += rng.sample(strata[name], min(size, len(strata[name])))
    rng.shuffle(chosen)
    return chosen


def spot_check_sheet(root: Path, draw: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Returns the review sheet: states only, with no answers or categories."""
    if draw is None:
        draw = {"seed": SPOT_CHECK_SEED, "threshold": DERIVED_THRESHOLD}
    inputs = load_inputs(root)
    payload = build_payload(root)
    sheet = []
    for locus in spot_check_sample(payload, draw["threshold"], draw["seed"]):
        row: dict[str, Any] = {"locusTag": locus}
        if locus in inputs.pcc_joins:
            row["pcc_7942_refseq_product"] = inputs.pcc_joins[locus][1]
        if locus in inputs.go_terms:
            row["go_annotations"] = inputs.go_terms[locus]
        sheet.append(row)
    return sheet


def spot_check_replay(root: Path) -> list[dict[str, Any]]:
    """Reproduces the pinned review sheet from its recorded seed and threshold."""
    review = load_json(root / SPOT_CHECK_PATH)
    sheet = spot_check_sheet(root, review["sample"])
    if [row["locusTag"] for row in sheet] != [row["locusTag"] for row in review["labels"]]:
        raise DerivedCategoryError("replayed spot-check sample differs from the pinned labels")
    return sheet


def spot_check_summary(root: Path, payload: dict[str, Any]) -> dict[str, Any]:
    """Compares blinded reviewer labels with the published per-source assignments."""
    review = load_json(root / SPOT_CHECK_PATH)
    labels = review["labels"]
    drawn = review["sample"]
    if [row["locusTag"] for row in labels] != spot_check_sample(
        payload, drawn["threshold"], drawn["seed"],
    ):
        raise DerivedCategoryError("spot-check labels do not match the seeded sample")
    summary: dict[str, Any] = {"sampleDrawnAt": drawn, "loci": len(labels)}
    disagreements = []
    for source, field in ((PCC_SOURCE, "reviewerPcc"), (GO_SOURCE, "reviewerGo")):
        compared = agree_assigned = agree_most_likely = 0
        for row in labels:
            published = payload["byLocus"][row["locusTag"]][source]
            if published is None:
                continue
            compared += 1
            reviewer = row[field]
            reviewer_assigned = None if reviewer == UNKNOWN_ID else reviewer
            agree_assigned += published["categoryId"] == reviewer_assigned
            agree_most_likely += published["mostLikely"] == reviewer
            if published["categoryId"] != reviewer_assigned:
                disagreements.append({
                    "locusTag": row["locusTag"], "source": source,
                    "published": {k: published[k] for k in ("mostLikely", "probability", "categoryId")},
                    "reviewer": reviewer, "reviewerNote": row.get("note", ""),
                })
        summary[source] = {
            "compared": compared,
            "assignmentAgreement": agree_assigned,
            "mostLikelyAgreement": agree_most_likely,
        }
    summary["disagreements"] = disagreements
    return summary


def build_summary(root: Path, payload: dict[str, Any]) -> dict[str, Any]:
    """Builds the audit summary that --check keeps byte-identical."""
    rubric = load_json(root / RUBRIC_PATH)
    inputs = load_inputs(root)
    files = {
        path.name: sha256_file(root / path)
        for path in (RUBRIC_PATH, EVALUATION_SET_PATH, RESULTS_PATH,
                     EVALUATION_RESULTS_PATH, RUN_LOG_PATH, SPOT_CHECK_PATH)
    }
    return {
        "model": MODEL,
        "rubricVersion": rubric["rubricVersion"],
        "fileSha256": files,
        "outputSha256": canonical_sha256(payload),
        "thresholds": POLICY["thresholds"],
        "counts": payload["counts"],
        "legendByToggle": {
            "+".join(enabled): resolved_counts(payload["byLocus"], inputs, enabled)
            for enabled in (
                ("utex-2973",), (PCC_SOURCE,), (GO_SOURCE,),
                ("utex-2973", PCC_SOURCE), ("utex-2973", GO_SOURCE), (PCC_SOURCE, GO_SOURCE),
            )
        },
        "evaluation": evaluation_summary(root, rubric, inputs),
        "reviewedComparison": reviewed_comparison(payload, inputs),
        "crossSourceCalibration": cross_source_calibration(payload),
        "spotCheck": spot_check_summary(root, payload),
    }


# --------------------------------------------------------------------- main


def generate(root: Path, check: bool) -> None:
    """Writes the artifacts or proves they equal a fresh offline rebuild."""
    payload = build_payload(root)
    outputs = {
        OUTPUT_PATH: canonical_json(payload) + "\n",
        SUMMARY_PATH: render_json(build_summary(root, payload)),
    }
    for path, text in outputs.items():
        target = root / path
        if check:
            if not target.exists() or target.read_text(encoding="utf-8") != text:
                raise DerivedCategoryError(
                    f"{path} differs from a rebuild; run tools/build_source_derived_categories.py"
                )
        else:
            target.write_text(text, encoding="utf-8")
    counts = payload["counts"]["bySource"]
    print(
        f"{'OK' if check else 'Wrote'}: {OUTPUT_PATH} "
        + ", ".join(f"{source} assigned={counts[source]['assigned']}/{counts[source]['judged']}"
                    for source in SOURCES)
        + f"; {payload['counts']['bothSourcesAssigned']['disagree']} loci where the sources disagree"
    )


def main() -> int:
    """Runs the command-line tool."""
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="verify offline")
    mode.add_argument("--judge", action="store_true", help="run Jev on unpinned requests")
    mode.add_argument("--evaluate", action="store_true", help="run the evaluation set")
    mode.add_argument("--spot-check-sheet", action="store_true",
                      help="print a fresh blinded spot-check sheet at the current threshold")
    mode.add_argument("--spot-check-replay", action="store_true",
                      help="print the pinned spot-check sheet from its recorded seed and threshold")
    parser.add_argument("--seed", type=int, default=SPOT_CHECK_SEED,
                        help="seed for a fresh --spot-check-sheet draw")
    parser.add_argument("--workers", type=int, default=8, help=argparse.SUPPRESS)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1],
                        help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.seed != SPOT_CHECK_SEED and not args.spot_check_sheet:
        parser.error("--seed applies only to --spot-check-sheet")
    root = args.root.resolve()
    try:
        if args.judge:
            transport = TypeSafeTransport(os.environ.get("TYPESAFE_API_KEY", ""))
            print(judge(root, transport, args.workers))
        elif args.evaluate:
            transport = TypeSafeTransport(os.environ.get("TYPESAFE_API_KEY", ""))
            print(f"evaluated {evaluate(root, transport, args.workers)} cases")
        elif args.spot_check_sheet:
            draw = {"seed": args.seed, "threshold": DERIVED_THRESHOLD}
            print(render_json(spot_check_sheet(root, draw)), end="")
        elif args.spot_check_replay:
            print(render_json(spot_check_replay(root)), end="")
        else:
            generate(root, args.check)
    except ValueError as error:
        parser.exit(1, f"ERROR: {error}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
