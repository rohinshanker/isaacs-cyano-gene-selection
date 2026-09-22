#!/usr/bin/env python3
"""Build and verify the GO IEA essentiality-context fallback.

Usage:
    python3 tools/build_go_iea_essentiality.py            # build from pinned judgments
    python3 tools/build_go_iea_essentiality.py --check    # verify; never calls the API
    python3 tools/build_go_iea_essentiality.py --judge    # Jev inference; needs TYPESAFE_API_KEY
    python3 tools/build_go_iea_essentiality.py --evaluate # predeclared evaluation set
    python3 tools/build_go_iea_essentiality.py --spot-check-sheet [--seed N]  # fresh blinded sheet
    python3 tools/build_go_iea_essentiality.py --spot-check-replay  # the pinned reviewed sheet

Jev answers two bounded questions per GO-annotated locus: whether its GO
terms give essentiality-relevant context, and whether they contradict the
locus's product names or reviewed category. Thresholds, precedence, and the
PCC-call comparison are ordinary code below. Only --judge and --evaluate use
the network; the build and --check read the pinned audit files.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import csv
import gzip
import hashlib
import json
import os
import random
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable

RELEASE_ID = "GCF_000817325.1-RS_2026_05_13"
RELEASE_DIR = Path("data/annotation/releases") / RELEASE_ID
GO_PATH = RELEASE_DIR / "go-annotations-v1.tsv"
GO_NAMES_PATH = Path("site/data/go-term-names-v1.json")
GENES_PATH = Path("site/data/genes.json")
PCC_PATH = Path("site/data/pcc7942-essentiality-v1.json")
CANDIDATE_PATH = Path("site/data/candidate_evidence.json")
CATEGORIES_PATH = Path("site/data/function-categories-v1.json")
PCC_GFF_PATH = Path("data/annotation/source/GCF_000012525.1_ASM1252v1_genomic.gff.gz")
PROVENANCE_PATH = Path("data/annotation/PROVENANCE.md")
AUDIT_DIR = Path("data/audits/go-iea-essentiality")
RUBRIC_PATH = AUDIT_DIR / "rubric.json"
EVALUATION_SET_PATH = AUDIT_DIR / "evaluation-set.json"
RESULTS_PATH = AUDIT_DIR / "results.jsonl"
EVALUATION_RESULTS_PATH = AUDIT_DIR / "evaluation-results.jsonl"
RUN_LOG_PATH = AUDIT_DIR / "run-log.json"
SPOT_CHECK_PATH = AUDIT_DIR / "spot-check.json"
SUMMARY_PATH = AUDIT_DIR / "summary.json"
OUTPUT_PATH = Path("site/data/go-iea-essentiality-v1.json")

API_URL = "https://api.typesafe.ai/v1/systemone"
MODEL = "jev-1.13.0"
LOCUS_TAG_PATTERN = re.compile(r"M744_|SYNPCC7942_")
RETRY_STATUSES = frozenset({429, 500, 502, 503, 529})

# Policy thresholds. They were set from the calibration recorded in
# docs/validation/go-iea-essentiality-context.md; changing them needs no new
# inference but does need that document's evidence re-read.
CORE_THRESHOLD = 0.9
NOT_CORE_THRESHOLD = 0.2
DISCREPANCY_THRESHOLD = 0.8

ASPECTS = {"F": "molecular function", "P": "biological process", "C": "cellular component"}
DETERMINATE_PCC = ("essential", "beneficial", "non-essential")
TIERS = ("tested-utex-allele", "admitted-pcc-call", "go-iea-context", "unknown")
CONTEXT_LABELS = ("core-cellular-process", "not-core", "uncertain")
DISCREPANCY_KINDS = ("utex-product", "pcc7942-product", "reviewed-category", "pcc7942-call")
CONTEXT_OPTIONS = ("core_cellular_process", "peripheral_or_conditional_process", "too_generic")
DISCREPANCY_QUESTIONS = ("utex_product", "pcc_7942_product", "reviewed_category")
UNKNOWN_CATEGORY = "Unknown or unclassified"
GO_COPYRIGHT = "copyright © 1999–2026 Gene Ontology Consortium"

ATTRIBUTION = {
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
        "This file derives essentiality-context and discrepancy fields from those "
        "IEA relationships with TypeSafe Jev judgments; it does not alter the GO rows."
    ),
    "notice": "data/annotation/PROVENANCE.md",
}

POLICY = {
    "precedence": list(TIERS),
    "tierRule": (
        "A tested UTEX 2973 allele outranks everything. Otherwise a determinate "
        "admitted PCC 7942 call (essential, beneficial, or non-essential) is used. "
        "Otherwise GO IEA context applies only when Jev judges the locus's GO terms "
        "to place it in a core cellular process. Everything else is unknown."
    ),
    "fallbackMeaning": (
        "Computational GO IEA inference that the protein takes part in a core "
        "cellular process. It is not a knockout result, an essentiality call, or a "
        "UTEX 2973 measurement."
    ),
    "essentialityRelevantRule": (
        "Only a core-cellular-process judgment counts, as defined in the audit "
        "rubric. Peripheral or generic GO terms are not evidence of non-essentiality, "
        "and the number of GO rows is never evidence."
    ),
    "discrepancyRule": (
        "A product-name or reviewed-category discrepancy is reported when Jev's "
        "probability that the GO terms contradict that annotation reaches the "
        "discrepancy threshold. When the joined PCC 7942 product text is identical "
        "to the UTEX 2973 product, the UTEX-product judgment is reported for both "
        "sources. A PCC-call discrepancy is reported when GO context is "
        "core-cellular-process and the admitted PCC 7942 call is non-essential. "
        "Neither source is preferred."
    ),
    "panelObjective": "Excluded. The guided panel objective never reads this dataset.",
    "thresholds": {
        "coreProbabilityAtLeast": CORE_THRESHOLD,
        "notCoreProbabilityAtMost": NOT_CORE_THRESHOLD,
        "discrepancyProbabilityAtLeast": DISCREPANCY_THRESHOLD,
    },
}


class GoEssentialityError(ValueError):
    """Raised when an input, judgment, or generated artifact is invalid."""


# ---------------------------------------------------------------- utilities


def sha256_file(path: Path) -> str:
    """Returns a file's lowercase SHA-256 digest."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical_json(value: Any) -> str:
    """Serializes JSON with sorted keys and no whitespace."""
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def canonical_sha256(value: Any) -> str:
    """Hashes a value's canonical JSON encoding."""
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def load_json(path: Path) -> Any:
    """Loads a UTF-8 JSON file."""
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise GoEssentialityError(f"cannot load {path}: {error}") from error


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    """Loads a JSON-lines file; a missing file is empty."""
    if not path.exists():
        return []
    try:
        return [
            json.loads(line)
            for line in path.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
    except json.JSONDecodeError as error:
        raise GoEssentialityError(f"cannot parse {path}: {error}") from error


def render_jsonl(records: Iterable[dict[str, Any]]) -> str:
    """Renders JSON lines in canonical form."""
    return "".join(canonical_json(record) + "\n" for record in records)


def render_json(value: Any) -> str:
    """Renders a stable, readable JSON document."""
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


# ------------------------------------------------------------------- inputs


@dataclass(frozen=True)
class Inputs:
    """Every pinned fact the requests and the payload are derived from."""

    loci: tuple[str, ...]
    genes: dict[str, dict[str, Any]]
    go_terms: dict[str, list[dict[str, str]]]
    pcc: dict[str, dict[str, Any]]
    tested: frozenset[str]
    categories: dict[str, str]
    pcc_products: dict[str, str]


def read_go_terms(path: Path, names: dict[str, Any]) -> dict[str, list[dict[str, str]]]:
    """Groups GO IEA relationships by locus as aspect/relation/term-name rows."""
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    seen: set[tuple[str, str, str]] = set()
    try:
        with path.open(encoding="utf-8", newline="") as handle:
            for row in csv.DictReader(handle, delimiter="\t"):
                if row["evidence_code"] != "IEA":
                    raise GoEssentialityError(
                        f"{row['locus_tag']} has non-IEA evidence {row['evidence_code']}"
                    )
                key = (row["locus_tag"], row["go_id"], row["qualifier"])
                if key in seen:
                    continue
                seen.add(key)
                term = names.get(row["go_id"], {}).get("name")
                if not term:
                    raise GoEssentialityError(f"no GO name for {row['go_id']}")
                if row["aspect"] not in ASPECTS:
                    raise GoEssentialityError(f"unknown GO aspect {row['aspect']!r}")
                grouped[row["locus_tag"]].append(
                    {
                        "aspect": ASPECTS[row["aspect"]],
                        "relation": row["qualifier"],
                        "term": term,
                    }
                )
    except (OSError, KeyError) as error:
        raise GoEssentialityError(f"cannot read GO annotations {path}: {error}") from error
    return dict(grouped)


def read_pcc_products(path: Path) -> dict[str, str]:
    """Maps PCC 7942 RefSeq locus tags to CDS product names from the pinned GFF."""
    products: dict[str, str] = {}
    try:
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            for line in handle:
                if line.startswith("#"):
                    continue
                fields = line.rstrip("\n").split("\t")
                if len(fields) < 9 or fields[2] != "CDS":
                    continue
                attributes = dict(
                    item.split("=", 1) for item in fields[8].split(";") if "=" in item
                )
                locus = attributes.get("locus_tag")
                product = attributes.get("product")
                if locus and product:
                    products[locus] = urllib.parse.unquote(product)
    except OSError as error:
        raise GoEssentialityError(f"cannot read PCC 7942 GFF {path}: {error}") from error
    return products


def load_inputs(root: Path) -> Inputs:
    """Loads and cross-checks every pinned input."""
    provenance = (root / PROVENANCE_PATH).read_text(encoding="utf-8")
    if GO_COPYRIGHT not in provenance or "Creative Commons Attribution 4.0" not in provenance:
        raise GoEssentialityError("PROVENANCE.md no longer carries the GO CC BY 4.0 notice")
    genes_list = load_json(root / GENES_PATH)
    genes = {row["id"]: row for row in genes_list}
    if len(genes) != len(genes_list):
        raise GoEssentialityError("genes.json has duplicate locus tags")
    names = load_json(root / GO_NAMES_PATH)["terms"]
    go_terms = read_go_terms(root / GO_PATH, names)
    unknown = sorted(set(go_terms) - set(genes))
    if unknown:
        raise GoEssentialityError(f"GO rows name unplotted loci: {unknown[:3]}")
    pcc = load_json(root / PCC_PATH)
    if pcc["source"]["annotationRelease"] != RELEASE_ID:
        raise GoEssentialityError("PCC essentiality release differs")
    if sorted(pcc["byLocus"]) != sorted(genes):
        raise GoEssentialityError("PCC essentiality does not cover every plotted locus")
    candidate = load_json(root / CANDIDATE_PATH)
    if candidate["annotationRelease"] != RELEASE_ID:
        raise GoEssentialityError("candidate evidence release differs")
    tested = frozenset(candidate["testedAlleles"])
    categories_data = load_json(root / CATEGORIES_PATH)
    labels = {
        entry["id"]: entry["label"]
        for entry in categories_data["vocabulary"]["categories"]
    }
    categories: dict[str, str] = {}
    for row in categories_data["assignments"]:
        names_for_row = [labels[category] for category in row["categoryIds"]]
        if names_for_row != [UNKNOWN_CATEGORY]:
            categories[row["locusTag"]] = "; ".join(names_for_row)
    return Inputs(
        loci=tuple(sorted(genes)),
        genes=genes,
        go_terms=go_terms,
        pcc=pcc["byLocus"],
        tested=tested,
        categories=categories,
        pcc_products=read_pcc_products(root / PCC_GFF_PATH),
    )


# ----------------------------------------------------------------- requests


@dataclass(frozen=True)
class Request:
    """One blinded Jev request: its key, state, and the questions it asks."""

    key: str
    kind: str
    state: dict[str, Any]
    question_ids: tuple[str, ...]


@dataclass(frozen=True)
class PccJoin:
    """An accepted PCC 7942 join: its locus, product, and whether UTEX's text matches."""

    locus: str
    product: str
    identical: bool


def pcc_join_for(locus: str, inputs: Inputs) -> PccJoin | None:
    """Returns the accepted PCC 7942 join for a locus, or None when it has none."""
    call = inputs.pcc[locus]
    if call["mappingStatus"] != "accepted":
        return None
    product = inputs.pcc_products.get(call["pccLocusTag"])
    if product is None:
        raise GoEssentialityError(f"no PCC 7942 product for {call['pccLocusTag']}")
    return PccJoin(call["pccLocusTag"], product,
                   product == inputs.genes[locus].get("product"))


def pcc_product_for(locus: str, inputs: Inputs) -> str | None:
    """Returns a joined PCC product only when its text differs from UTEX's.

    Identical text is never asked as its own question; `find_discrepancies`
    reuses the UTEX-product judgment for it instead.
    """
    join = pcc_join_for(locus, inputs)
    return None if join is None or join.identical else join.product


def discrepancy_state(
    terms: list[dict[str, str]],
    utex_product: str,
    symbol: str | None,
    pcc_product: str | None,
    category: str | None,
) -> tuple[dict[str, Any], tuple[str, ...]]:
    """Builds a discrepancy state and the questions its fields support."""
    annotations: dict[str, str] = {"utex_2973_refseq_product": utex_product}
    questions = ["utex_product"]
    if symbol:
        annotations["utex_2973_gene_symbol"] = symbol
    if pcc_product is not None:
        annotations["pcc_7942_refseq_product"] = pcc_product
        questions.append("pcc_7942_product")
    if category is not None:
        annotations["lab_reviewed_function_category"] = category
        questions.append("reviewed_category")
    return {"go_annotations": terms, "annotations": annotations}, tuple(questions)


def build_requests(inputs: Inputs) -> list[Request]:
    """Returns the context and discrepancy request for every GO-annotated locus."""
    requests: list[Request] = []
    for locus in inputs.loci:
        terms = inputs.go_terms.get(locus)
        if not terms:
            continue
        requests.append(
            Request(f"context:{locus}", "context", {"go_annotations": terms}, ("context",))
        )
        gene = inputs.genes[locus]
        state, questions = discrepancy_state(
            terms,
            gene.get("product") or "",
            gene.get("name"),
            pcc_product_for(locus, inputs),
            inputs.categories.get(locus),
        )
        requests.append(Request(f"discrepancy:{locus}", "discrepancy", state, questions))
    return requests


def question_body(rubric: dict[str, Any], kind: str, question_id: str) -> dict[str, Any]:
    """Returns the frozen API question for one question id."""
    if kind == "context":
        return rubric["contextRequest"]["question"]
    spec = rubric["discrepancyRequest"]
    return {**spec["questions"][question_id], "criteria": spec["sharedCriteria"]}


def request_body(rubric: dict[str, Any], request: Request) -> dict[str, Any]:
    """Returns the complete API request body."""
    return {
        "model": MODEL,
        "state": request.state,
        "questions": {
            question_id: question_body(rubric, request.kind, question_id)
            for question_id in request.question_ids
        },
    }


def request_sha256(rubric: dict[str, Any], request: Request) -> str:
    """Identifies a request by everything the model sees."""
    return canonical_sha256(request_body(rubric, request))


# ---------------------------------------------------------------- transport


class TypeSafeTransport:
    """Posts request bodies to the TypeSafe System One endpoint with retries."""

    def __init__(self, api_key: str, attempts: int = 6, timeout: float = 90.0,
                 sleep: Callable[[float], None] = time.sleep,
                 opener: Callable[..., Any] = urllib.request.urlopen) -> None:
        if not api_key:
            raise GoEssentialityError("TYPESAFE_API_KEY is not set")
        self._api_key = api_key
        self._attempts = attempts
        self._timeout = timeout
        self._sleep = sleep
        self._opener = opener

    def post(self, body: dict[str, Any]) -> dict[str, Any]:
        """Returns the decoded response, retrying rate limits and overloads."""
        data = json.dumps(body).encode("utf-8")
        for attempt in range(self._attempts):
            request = urllib.request.Request(
                API_URL,
                data=data,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
            )
            try:
                with self._opener(request, timeout=self._timeout) as response:
                    return json.loads(response.read().decode("utf-8"))
            except urllib.error.HTTPError as error:
                if error.code not in RETRY_STATUSES or attempt == self._attempts - 1:
                    raise GoEssentialityError(
                        f"TypeSafe returned HTTP {error.code}"
                    ) from error
            except (urllib.error.URLError, TimeoutError) as error:
                if attempt == self._attempts - 1:
                    raise GoEssentialityError(f"TypeSafe request failed: {error}") from error
            self._sleep(min(2 ** attempt, 30))
        raise GoEssentialityError("TypeSafe request exhausted its retries")


def validate_answer(question: dict[str, Any], answer: dict[str, Any]) -> None:
    """Checks one typed answer against its question's contract."""
    if answer.get("type") != question["type"]:
        raise GoEssentialityError("answer type differs from question type")
    if question["type"] == "noul":
        value = answer.get("noul")
        if not isinstance(value, (int, float)) or not 0 <= value <= 1:
            raise GoEssentialityError("noul answer is not a probability")
        return
    probabilities = answer.get("probabilities", {})
    if set(probabilities) != set(question["criteria"]):
        raise GoEssentialityError("choice probabilities do not cover every option")
    if abs(sum(probabilities.values()) - 1) > 0.02:
        raise GoEssentialityError("choice probabilities do not sum to one")
    if answer.get("choice") not in probabilities:
        raise GoEssentialityError("choice answer is not an option")


def ask(transport: Any, rubric: dict[str, Any], request: Request) -> dict[str, Any]:
    """Runs one request and returns its validated pinned record."""
    body = request_body(rubric, request)
    response = transport.post(body)
    if response.get("model") != MODEL:
        raise GoEssentialityError(f"model {response.get('model')!r} answered, not {MODEL}")
    answers = response.get("answers", {})
    if set(answers) != set(request.question_ids):
        raise GoEssentialityError(f"{request.key} answers differ from questions")
    for question_id, answer in answers.items():
        validate_answer(body["questions"][question_id], answer)
    return {
        "key": request.key,
        "requestSha256": canonical_sha256(body),
        "rubricVersion": rubric["rubricVersion"],
        "model": response["model"],
        "answers": answers,
        "inputTokens": response.get("usage", {}).get("input_tokens"),
    }


def run_requests(transport: Any, rubric: dict[str, Any], requests: list[Request],
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


def judge(root: Path, transport: Any, workers: int = 8) -> dict[str, int]:
    """Answers every request not already pinned for its exact body."""
    rubric = load_json(root / RUBRIC_PATH)
    requests = build_requests(load_inputs(root))
    pinned = {record["key"]: record for record in load_jsonl(root / RESULTS_PATH)}
    missing = [
        request for request in requests
        if pinned.get(request.key, {}).get("requestSha256")
        != request_sha256(rubric, request)
    ]
    started = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    fresh = run_requests(transport, rubric, missing, workers) if missing else []
    for record in fresh:
        pinned[record["key"]] = record
    wanted = [request.key for request in requests]
    (root / RESULTS_PATH).write_text(
        render_jsonl(pinned[key] for key in wanted), encoding="utf-8"
    )
    if fresh:
        update_run_log(root, "judge", started, fresh)
    return {"requests": len(requests), "answered": len(fresh)}


def update_run_log(root: Path, stage: str, started: str,
                   records: list[dict[str, Any]]) -> None:
    """Records when a network stage ran, how many calls it made, and its tokens."""
    path = root / RUN_LOG_PATH
    log = load_json(path) if path.exists() else {}
    log[stage] = {
        "startedAt": started,
        "completedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "requests": len(records),
        "inputTokens": sum(record["inputTokens"] or 0 for record in records),
        "model": MODEL,
    }
    path.write_text(render_json(log), encoding="utf-8")


# --------------------------------------------------------------- evaluation


def evaluation_requests(inputs: Inputs, evaluation: dict[str, Any]) -> list[tuple[dict[str, Any], Request]]:
    """Builds one request per predeclared evaluation case."""
    cases: list[tuple[dict[str, Any], Request]] = []
    for case in evaluation["context"]:
        terms = inputs.go_terms[case["locusTag"]]
        cases.append((case, Request(
            f"eval-context:{case['locusTag']}", "context",
            {"go_annotations": terms}, ("context",),
        )))
    for case in evaluation["discrepancy"]:
        locus = case["goFromLocus"]
        terms = inputs.go_terms[locus]
        product = inputs.genes[locus].get("product") or ""
        field = case["field"]
        state, _ = discrepancy_state(
            terms,
            case["value"] if field == "utex_product" else product,
            None,
            case["value"] if field == "pcc_7942_product" else None,
            case["value"] if field == "reviewed_category" else None,
        )
        cases.append((case, Request(
            f"eval-discrepancy:{case['id']}", "discrepancy", state, (field,)
        )))
    return cases


def evaluate(root: Path, transport: Any, workers: int = 8) -> int:
    """Runs the predeclared evaluation set and pins its answers."""
    rubric = load_json(root / RUBRIC_PATH)
    cases = evaluation_requests(load_inputs(root), load_json(root / EVALUATION_SET_PATH))
    started = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    records = run_requests(transport, rubric, [request for _, request in cases], workers)
    (root / EVALUATION_RESULTS_PATH).write_text(render_jsonl(records), encoding="utf-8")
    update_run_log(root, "evaluate", started, records)
    return len(records)


# ------------------------------------------------------------------- policy


def context_label(p_core: float) -> str:
    """Applies the core-process thresholds to one probability."""
    if p_core >= CORE_THRESHOLD:
        return "core-cellular-process"
    if p_core <= NOT_CORE_THRESHOLD:
        return "not-core"
    return "uncertain"


def resolve_tier(tested: bool, pcc_status: str, go_label: str | None) -> str:
    """Applies tested allele > admitted PCC call > GO IEA context > unknown."""
    if tested:
        return "tested-utex-allele"
    if pcc_status in DETERMINATE_PCC:
        return "admitted-pcc-call"
    if go_label == "core-cellular-process":
        return "go-iea-context"
    return "unknown"


def find_discrepancies(
    noul: dict[str, float],
    utex_product: str,
    pcc_join: PccJoin | None,
    category: str | None,
    go_label: str | None,
    pcc_status: str,
) -> list[dict[str, Any]]:
    """Returns every GO disagreement that meets the recorded rule, in fixed order.

    A joined PCC product with text identical to UTEX's was never asked as its
    own question, so its note reuses the UTEX-product judgment and says so.
    """
    found: list[dict[str, Any]] = []
    utex_flagged = noul.get("utex_product", 0) >= DISCREPANCY_THRESHOLD
    if utex_flagged:
        found.append({
            "kind": "utex-product",
            "probability": noul["utex_product"],
            "note": (
                "GO IEA terms disagree with the UTEX 2973 RefSeq product "
                f"“{utex_product}”."
            ),
        })
    if pcc_join is not None and pcc_join.identical and utex_flagged:
        found.append({
            "kind": "pcc7942-product",
            "probability": noul["utex_product"],
            "note": (
                "GO IEA terms disagree with the PCC 7942 RefSeq product "
                f"“{pcc_join.product}” of joined locus {pcc_join.locus}, whose text "
                "is identical to the UTEX 2973 product; the UTEX-product judgment "
                "applies to both sources."
            ),
        })
    elif (pcc_join is not None and not pcc_join.identical
          and noul.get("pcc_7942_product", 0) >= DISCREPANCY_THRESHOLD):
        found.append({
            "kind": "pcc7942-product",
            "probability": noul["pcc_7942_product"],
            "note": (
                "GO IEA terms disagree with the PCC 7942 RefSeq product "
                f"“{pcc_join.product}” of joined locus {pcc_join.locus}."
            ),
        })
    if category is not None and noul.get("reviewed_category", 0) >= DISCREPANCY_THRESHOLD:
        found.append({
            "kind": "reviewed-category",
            "probability": noul["reviewed_category"],
            "note": (
                "GO IEA terms disagree with the lab-reviewed function category "
                f"“{category}”."
            ),
        })
    if go_label == "core-cellular-process" and pcc_status == "non-essential":
        found.append({
            "kind": "pcc7942-call",
            "probability": None,
            "note": (
                "GO IEA terms place this protein in a core cellular process, but the "
                "admitted PCC 7942 call is non-essential."
            ),
        })
    return found


def locus_record(locus: str, inputs: Inputs, results: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Derives one locus's tier, GO context, and discrepancies from pinned answers."""
    call = inputs.pcc[locus]
    go_context = None
    discrepancies: list[dict[str, Any]] = []
    if locus in inputs.go_terms:
        answer = results[f"context:{locus}"]["answers"]["context"]
        p_core = answer["probabilities"]["core_cellular_process"]
        go_context = {
            "label": context_label(p_core),
            "pCore": p_core,
            "mostLikely": answer["choice"],
            "termCount": len(inputs.go_terms[locus]),
        }
        noul = {
            question_id: answer["noul"]
            for question_id, answer in results[f"discrepancy:{locus}"]["answers"].items()
        }
        discrepancies = find_discrepancies(
            noul,
            inputs.genes[locus].get("product") or "",
            pcc_join_for(locus, inputs),
            inputs.categories.get(locus),
            go_context["label"],
            call["status"],
        )
    return {
        "tier": resolve_tier(locus in inputs.tested, call["status"],
                             go_context["label"] if go_context else None),
        "pcc7942Status": call["status"],
        "goContext": go_context,
        "discrepancies": discrepancies,
    }


def pinned_results(root: Path, rubric: dict[str, Any], requests: list[Request]) -> dict[str, dict[str, Any]]:
    """Returns pinned records, failing when any request lacks an exact answer."""
    records = load_jsonl(root / RESULTS_PATH)
    by_key = {record["key"]: record for record in records}
    if len(by_key) != len(records):
        raise GoEssentialityError("results.jsonl has duplicate keys")
    expected = [request.key for request in requests]
    if [record["key"] for record in records] != expected:
        raise GoEssentialityError(
            "results.jsonl does not match the current requests; run --judge"
        )
    for request in requests:
        record = by_key[request.key]
        body = request_body(rubric, request)
        if record["requestSha256"] != canonical_sha256(body):
            raise GoEssentialityError(f"{request.key} was judged on a different request")
        if record["model"] != MODEL or record["rubricVersion"] != rubric["rubricVersion"]:
            raise GoEssentialityError(f"{request.key} has a different model or rubric")
        if set(record["answers"]) != set(request.question_ids):
            raise GoEssentialityError(f"{request.key} answers differ from questions")
        for question_id, answer in record["answers"].items():
            validate_answer(body["questions"][question_id], answer)
        if LOCUS_TAG_PATTERN.search(canonical_json(request.state)):
            raise GoEssentialityError(f"{request.key} state is not blinded")
    return by_key


def build_payload(root: Path) -> dict[str, Any]:
    """Builds the site artifact from pinned inputs and judgments."""
    rubric = load_json(root / RUBRIC_PATH)
    inputs = load_inputs(root)
    requests = build_requests(inputs)
    results = pinned_results(root, rubric, requests)
    by_locus = {locus: locus_record(locus, inputs, results) for locus in inputs.loci}
    payload = {
        "schemaVersion": 1,
        "datasetVersion": "go-iea-essentiality-v1",
        "annotationRelease": RELEASE_ID,
        "attribution": ATTRIBUTION,
        "judgment": {
            "provider": "TypeSafe System One",
            "model": MODEL,
            "rubricVersion": rubric["rubricVersion"],
            "rubricSha256": sha256_file(root / RUBRIC_PATH),
            "resultsSha256": sha256_file(root / RESULTS_PATH),
            "audit": AUDIT_DIR.as_posix(),
            "validation": "docs/validation/go-iea-essentiality-context.md",
        },
        "inputs": {
            path.as_posix(): sha256_file(root / path)
            for path in (GO_PATH, GO_NAMES_PATH, PCC_PATH, CANDIDATE_PATH,
                         CATEGORIES_PATH, PCC_GFF_PATH)
        },
        "policy": POLICY,
        "counts": payload_counts(by_locus),
        "byLocus": by_locus,
    }
    validate_payload(payload)
    return payload


def payload_counts(by_locus: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Summarizes tiers, GO context, and discrepancies."""
    contexts = [row["goContext"] for row in by_locus.values() if row["goContext"]]
    kinds = Counter(
        entry["kind"] for row in by_locus.values() for entry in row["discrepancies"]
    )
    eligible = [
        row for row in by_locus.values()
        if row["tier"] in ("go-iea-context", "unknown")
    ]
    tiers = Counter(row["tier"] for row in by_locus.values())
    return {
        "plottedLoci": len(by_locus),
        "byTier": {tier: tiers[tier] for tier in TIERS},
        "lociWithGoTerms": len(contexts),
        "goContextByLabel": {
            label: sum(context["label"] == label for context in contexts)
            for label in CONTEXT_LABELS
        },
        "fallbackEligible": len(eligible),
        "fallbackEligibleWithGoTerms": sum(bool(row["goContext"]) for row in eligible),
        "discrepanciesByKind": {kind: kinds[kind] for kind in DISCREPANCY_KINDS},
        "lociWithDiscrepancy": sum(bool(row["discrepancies"]) for row in by_locus.values()),
    }


def validate_payload(payload: dict[str, Any]) -> None:
    """Checks schema, precedence, and count consistency of a payload."""
    by_locus = payload["byLocus"]
    if list(by_locus) != sorted(by_locus):
        raise GoEssentialityError("byLocus must be sorted")
    for locus, row in by_locus.items():
        if set(row) != {"tier", "pcc7942Status", "goContext", "discrepancies"}:
            raise GoEssentialityError(f"{locus} fields differ from schema")
        if row["tier"] not in TIERS:
            raise GoEssentialityError(f"{locus} has invalid tier {row['tier']!r}")
        context = row["goContext"]
        if context is not None and context["label"] != context_label(context["pCore"]):
            raise GoEssentialityError(f"{locus} GO label disagrees with its probability")
        if row["tier"] == "go-iea-context" and (
            context is None or context["label"] != "core-cellular-process"
            or row["pcc7942Status"] in DETERMINATE_PCC
        ):
            raise GoEssentialityError(f"{locus} uses the GO fallback without eligibility")
        if context is None and row["discrepancies"]:
            raise GoEssentialityError(f"{locus} reports a GO discrepancy without GO terms")
        for entry in row["discrepancies"]:
            if entry["kind"] not in DISCREPANCY_KINDS or not entry["note"]:
                raise GoEssentialityError(f"{locus} has an invalid discrepancy")
    if payload["counts"] != payload_counts(by_locus):
        raise GoEssentialityError("counts do not match byLocus")


# ------------------------------------------------------------ audit summary


def evaluation_summary(root: Path, rubric: dict[str, Any], inputs: Inputs) -> dict[str, Any]:
    """Scores pinned evaluation answers against the predeclared labels."""
    evaluation = load_json(root / EVALUATION_SET_PATH)
    cases = evaluation_requests(inputs, evaluation)
    records = load_jsonl(root / EVALUATION_RESULTS_PATH)
    if [record["key"] for record in records] != [request.key for _, request in cases]:
        raise GoEssentialityError("evaluation results do not match the evaluation set")
    context_rows, discrepancy_rows = [], []
    for (case, request), record in zip(cases, records):
        if record["requestSha256"] != request_sha256(rubric, request):
            raise GoEssentialityError(f"{request.key} was evaluated on a different request")
        answer = next(iter(record["answers"].values()))
        if request.kind == "context":
            p_core = answer["probabilities"]["core_cellular_process"]
            context_rows.append({
                "locusTag": case["locusTag"], "expected": case["expected"],
                "choice": answer["choice"], "pCore": p_core,
                "label": context_label(p_core),
            })
        else:
            discrepancy_rows.append({
                "id": case["id"], "expected": case["expected"], "noul": answer["noul"],
                "flagged": answer["noul"] >= DISCREPANCY_THRESHOLD,
            })
    core_expected = [row for row in context_rows if row["expected"] == "core_cellular_process"]
    other_expected = [row for row in context_rows if row["expected"] != "core_cellular_process"]
    return {
        "contextCases": len(context_rows),
        "contextExactChoice": sum(row["choice"] == row["expected"] for row in context_rows),
        "coreCasesLabelledCore": sum(row["label"] == "core-cellular-process" for row in core_expected),
        "coreCases": len(core_expected),
        "nonCoreCasesLabelledCore": sum(row["label"] == "core-cellular-process" for row in other_expected),
        "nonCoreCases": len(other_expected),
        "discrepancyCases": len(discrepancy_rows),
        "discrepancyCorrectAtThreshold": sum(
            row["flagged"] == row["expected"] for row in discrepancy_rows
        ),
        "contextRows": context_rows,
        "discrepancyRows": discrepancy_rows,
    }


def calibration(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Relates P(core) to admitted PCC 7942 calls on real loci with GO terms."""
    bins = ((0.0, 0.2), (0.2, 0.5), (0.5, 0.8), (0.8, 0.9), (0.9, 0.95), (0.95, 1.01))
    rows = []
    for low, high in bins:
        statuses = Counter(
            row["pcc7942Status"] for row in payload["byLocus"].values()
            if row["goContext"] and low <= row["goContext"]["pCore"] < high
            and row["pcc7942Status"] in DETERMINATE_PCC
        )
        total = sum(statuses.values())
        rows.append({
            "pCoreRange": [low, min(high, 1.0)],
            "admittedPccCalls": total,
            "essential": statuses["essential"],
            "beneficial": statuses["beneficial"],
            "nonEssential": statuses["non-essential"],
            "essentialFraction": round(statuses["essential"] / total, 3) if total else None,
        })
    return rows


SPOT_CHECK_SEED = 20260922


def max_contradiction(results: dict[str, dict[str, Any]]) -> dict[str, float]:
    """Returns each locus's highest annotation-contradiction probability."""
    return {
        key.split(":", 1)[1]: max(answer["noul"] for answer in record["answers"].values())
        for key, record in results.items()
        if key.startswith("discrepancy:")
    }


def spot_check_sample(payload: dict[str, Any], contradiction: dict[str, float],
                      core_threshold: float, discrepancy_threshold: float,
                      seed: int = SPOT_CHECK_SEED) -> list[str]:
    """Draws the blinded sample: fallback, contradiction, and other GO strata.

    The strata use the thresholds recorded with the review, so later policy
    changes cannot silently change which loci were reviewed.
    """
    rng = random.Random(seed)
    rows = payload["byLocus"]
    fallback = sorted(
        locus for locus, row in rows.items()
        if row["goContext"] and row["tier"] in ("go-iea-context", "unknown")
        and row["goContext"]["pCore"] >= core_threshold
    )
    flagged = sorted(
        locus for locus, value in contradiction.items()
        if value >= discrepancy_threshold and locus not in fallback
    )
    others = sorted(
        locus for locus, row in rows.items()
        if row["goContext"] and locus not in fallback and locus not in flagged
    )
    chosen = (
        rng.sample(fallback, min(12, len(fallback)))
        + rng.sample(flagged, min(12, len(flagged)))
        + rng.sample(others, min(16, len(others)))
    )
    rng.shuffle(chosen)
    return chosen


def spot_check_sheet(root: Path, draw: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Returns the review sheet: states only, with no answers or tiers.

    Without `draw`, a fresh sample is drawn at the current thresholds and the
    default seed. With a recorded draw (seed and thresholds, as pinned in
    spot-check.json), the sheet lists exactly the loci that draw produced.
    """
    if draw is None:
        draw = {"seed": SPOT_CHECK_SEED, "coreThreshold": CORE_THRESHOLD,
                "discrepancyThreshold": DISCREPANCY_THRESHOLD}
    inputs = load_inputs(root)
    payload = build_payload(root)
    rubric = load_json(root / RUBRIC_PATH)
    results = pinned_results(root, rubric, build_requests(inputs))
    sheet = []
    sample = spot_check_sample(payload, max_contradiction(results),
                               draw["coreThreshold"], draw["discrepancyThreshold"],
                               draw["seed"])
    for locus in sample:
        gene = inputs.genes[locus]
        state, _ = discrepancy_state(
            inputs.go_terms[locus], gene.get("product") or "", gene.get("name"),
            pcc_product_for(locus, inputs), inputs.categories.get(locus),
        )
        sheet.append({"locusTag": locus, **state})
    return sheet


def spot_check_replay(root: Path) -> list[dict[str, Any]]:
    """Reproduces the pinned review sheet from its recorded seed and thresholds."""
    review = load_json(root / SPOT_CHECK_PATH)
    sheet = spot_check_sheet(root, review["sample"])
    if [row["locusTag"] for row in sheet] != [row["locusTag"] for row in review["labels"]]:
        raise GoEssentialityError("replayed spot-check sample differs from the pinned labels")
    return sheet


def spot_check_summary(root: Path, payload: dict[str, Any],
                       results: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Compares blinded reviewer labels with the published derivation."""
    review = load_json(root / SPOT_CHECK_PATH)
    labels = review["labels"]
    drawn = review["sample"]
    sample = spot_check_sample(payload, max_contradiction(results),
                               drawn["coreThreshold"], drawn["discrepancyThreshold"],
                               drawn["seed"])
    if [row["locusTag"] for row in labels] != sample:
        raise GoEssentialityError("spot-check labels do not match the seeded sample")
    context_agree = discrepancy_agree = 0
    disagreements = []
    for row in labels:
        record = payload["byLocus"][row["locusTag"]]
        core = record["goContext"]["label"] == "core-cellular-process"
        flagged = any(entry["kind"] != "pcc7942-call" for entry in record["discrepancies"])
        context_agree += core == row["reviewerCore"]
        discrepancy_agree += flagged == row["reviewerContradiction"]
        if core != row["reviewerCore"] or flagged != row["reviewerContradiction"]:
            disagreements.append({
                "locusTag": row["locusTag"],
                "published": {"core": core, "contradiction": flagged,
                              "pCore": record["goContext"]["pCore"]},
                "reviewer": {"core": row["reviewerCore"],
                             "contradiction": row["reviewerContradiction"]},
                "reviewerNote": row.get("note", ""),
            })
    return {
        "sampleDrawnAt": drawn,
        "loci": len(labels),
        "coreAgreement": context_agree,
        "contradictionAgreement": discrepancy_agree,
        "disagreements": disagreements,
    }


def build_summary(root: Path, payload: dict[str, Any]) -> dict[str, Any]:
    """Builds the audit summary that --check keeps byte-identical."""
    rubric = load_json(root / RUBRIC_PATH)
    inputs = load_inputs(root)
    results = pinned_results(root, rubric, build_requests(inputs))
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
        "evaluation": evaluation_summary(root, rubric, inputs),
        "calibrationAgainstPcc7942": calibration(payload),
        "spotCheck": spot_check_summary(root, payload, results),
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
                raise GoEssentialityError(
                    f"{path} differs from a rebuild; run tools/build_go_iea_essentiality.py"
                )
        else:
            target.write_text(text, encoding="utf-8")
    tiers = payload["counts"]["byTier"]
    print(
        f"{'OK' if check else 'Wrote'}: {OUTPUT_PATH} tiers "
        + ", ".join(f"{tier}={tiers[tier]}" for tier in TIERS)
        + f"; {payload['counts']['lociWithDiscrepancy']} loci with discrepancies"
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
                      help="print a fresh blinded spot-check sheet at the current thresholds")
    mode.add_argument("--spot-check-replay", action="store_true",
                      help="print the pinned spot-check sheet from its recorded seed and thresholds")
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
            draw = {"seed": args.seed, "coreThreshold": CORE_THRESHOLD,
                    "discrepancyThreshold": DISCREPANCY_THRESHOLD}
            print(render_json(spot_check_sheet(root, draw)), end="")
        elif args.spot_check_replay:
            print(render_json(spot_check_replay(root)), end="")
        else:
            generate(root, args.check)
    except GoEssentialityError as error:
        parser.exit(1, f"ERROR: {error}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
