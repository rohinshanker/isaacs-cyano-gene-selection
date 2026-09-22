#!/usr/bin/env python3
"""Builds and checks the reviewed UTEX 2973 function-category dataset.

Usage:
    python3 tools/build_function_categories.py
    python3 tools/build_function_categories.py --check

The assignments below are the complete review decision from 2026-09-22. They
are intentionally explicit: this builder never infers a category from a
product substring or a computational GO relationship.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


DATASET_PATH = Path("site/data/function-categories-v1.json")
GENES_PATH = Path("site/data/genes.json")
MANIFEST_PATH = Path("data/manifest/annotation-release-v1.json")
RELEASE_ID = "GCF_000817325.1-RS_2026_05_13"
REVIEW_DATE = "2026-09-22"

CATEGORIES = (
    ("photosynthetic-light-reactions", "Photosynthetic light reactions"),
    ("carbon-and-nutrient-metabolism", "Carbon and nutrient metabolism"),
    ("atp-production-and-respiration", "ATP production and respiration"),
    ("pigment-and-cofactor-biosynthesis", "Pigment and cofactor biosynthesis"),
    ("translation-and-protein-maintenance", "Translation and protein maintenance"),
    ("dna-and-rna-processing", "DNA and RNA processing"),
    ("transport-and-envelope", "Transport and envelope"),
    ("signaling-and-circadian-regulation", "Signaling and circadian regulation"),
    ("stress-and-repair", "Stress and repair"),
    ("other-characterized", "Other characterized"),
    ("unknown-or-unclassified", "Unknown or unclassified"),
)

# locus tag, exact release product, exact release symbol, reviewed categories,
# optional tested-allele study symbol and evidence identifier.
REVIEWED_ROWS = (
    (
        "M744_RS00265",
        "photosystem I iron-sulfur center protein PsaC",
        "psaC",
        ("photosynthetic-light-reactions",),
        None,
        None,
    ),
    (
        "M744_RS00815",
        "photosystem II q(b) protein",
        "psbA",
        ("photosynthetic-light-reactions",),
        None,
        None,
    ),
    (
        "M744_RS13625",
        "photosystem II reaction center protein K",
        None,
        ("photosynthetic-light-reactions",),
        None,
        None,
    ),
    (
        "M744_RS10050",
        "circadian clock protein KaiA",
        None,
        ("signaling-and-circadian-regulation",),
        None,
        None,
    ),
    (
        "M744_RS10055",
        "circadian clock protein KaiB",
        "kaiB",
        ("signaling-and-circadian-regulation",),
        None,
        None,
    ),
    (
        "M744_RS10060",
        "circadian clock protein KaiC",
        "kaiC",
        ("signaling-and-circadian-regulation",),
        None,
        None,
    ),
    (
        "M744_RS13070",
        "circadian clock protein LdpA",
        "ldpA",
        ("signaling-and-circadian-regulation",),
        None,
        None,
    ),
    (
        "M744_RS00700",
        "30S ribosomal protein S14",
        "rpsN",
        ("translation-and-protein-maintenance",),
        None,
        None,
    ),
    (
        "M744_RS01270",
        "F0F1 ATP synthase subunit alpha",
        "atpA",
        ("atp-production-and-respiration",),
        "atpA",
        "ungerer2018-atpA-utex2973-allele",
    ),
    (
        "M744_RS00020",
        "magnesium chelatase ATPase subunit I",
        "bchI",
        ("pigment-and-cofactor-biosynthesis",),
        None,
        None,
    ),
    (
        "M744_RS04595",
        "NAD(+) kinase",
        None,
        ("pigment-and-cofactor-biosynthesis",),
        "ppnK",
        "ungerer2018-ppnK-utex2973-allele",
    ),
    (
        "M744_RS02500",
        "response regulator transcription factor",
        None,
        ("signaling-and-circadian-regulation",),
        "rpaA",
        "ungerer2018-rpaA-utex2973-allele",
    ),
    (
        "M744_RS00030",
        "hypothetical protein",
        None,
        ("unknown-or-unclassified",),
        None,
        None,
    ),
)


class CategoryDataError(ValueError):
    """Raised when a source or generated category payload violates the contract."""


def load_json(path: Path) -> Any:
    """Loads a UTF-8 JSON file."""
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise CategoryDataError(f"cannot load {path}: {error}") from error


def load_source_genes(path: Path) -> dict[str, dict[str, Any]]:
    """Loads the published CDS rows and rejects malformed or duplicate loci."""
    rows = load_json(path)
    if not isinstance(rows, list):
        raise CategoryDataError(f"{path} must contain a JSON array")
    genes: dict[str, dict[str, Any]] = {}
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get("id"), str):
            raise CategoryDataError(f"{path} contains a row without a string id")
        locus = row["id"]
        if locus in genes:
            raise CategoryDataError(f"duplicate source locus: {locus}")
        genes[locus] = row
    return genes


def load_release_source(path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    """Returns the release manifest and its pinned UTEX 2973 source record."""
    manifest = load_json(path)
    if not isinstance(manifest, dict) or manifest.get("schemaVersion") != 1:
        raise CategoryDataError("annotation manifest schemaVersion must be 1")
    if manifest.get("releaseId") != RELEASE_ID:
        raise CategoryDataError(
            "annotation release mismatch: "
            f"{manifest.get('releaseId')!r} != {RELEASE_ID!r}"
        )
    matches = [
        source
        for source in manifest.get("sources", [])
        if source.get("id") == "utex2973-refseq"
    ]
    if len(matches) != 1:
        raise CategoryDataError("manifest must have one utex2973-refseq source")
    source = matches[0]
    required = (
        "organism", "taxid", "assemblyAccession", "assemblyName",
        "annotationRelease", "annotationDate", "pgapVersion",
    )
    missing = [field for field in required if field not in source]
    if missing:
        raise CategoryDataError(f"UTEX release source lacks: {', '.join(missing)}")
    if source["annotationRelease"] != RELEASE_ID:
        raise CategoryDataError("UTEX source annotation release differs from manifest")
    return manifest, source


def _reviewed_assignments(genes: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """Checks every approved row against source data and returns sparse rows."""
    assignments = []
    for locus, product, symbol, categories, study_symbol, evidence_id in REVIEWED_ROWS:
        source = genes.get(locus)
        if source is None:
            raise CategoryDataError(
                f"reviewed locus missing from source genes: {locus}"
            )
        if source.get("product") != product:
            raise CategoryDataError(
                f"{locus} product mismatch: {source.get('product')!r} != {product!r}"
            )
        if source.get("name") != symbol:
            raise CategoryDataError(
                f"{locus} symbol mismatch: {source.get('name')!r} != {symbol!r}"
            )
        row: dict[str, Any] = {
            "locusTag": locus,
            "releaseProduct": product,
            "releaseSymbol": symbol,
            "categoryIds": list(categories),
            "classificationBasis": "explicit-user-review",
        }
        if evidence_id is not None:
            row["supportingEvidence"] = {
                "kind": "tested-utex-2973-allele",
                "sourceId": "ungerer-2018",
                "doi": "10.1073/pnas.1814912115",
                "evidenceId": evidence_id,
                "studyGeneSymbol": study_symbol,
                "scope": (
                    "Allele- and condition-specific supporting evidence; not a "
                    "functional-category assay or a transferable category assignment."
                ),
            }
        assignments.append(row)
    return assignments


def build_payload(root: Path) -> dict[str, Any]:
    """Builds the complete deterministic payload from pinned project sources."""
    genes = load_source_genes(root / GENES_PATH)
    manifest, source = load_release_source(root / MANIFEST_PATH)
    assignments = _reviewed_assignments(genes)
    classified = sum(
        row["categoryIds"] != ["unknown-or-unclassified"] for row in assignments
    )
    explicit_unknown = len(assignments) - classified
    multiple = sum(len(row["categoryIds"]) > 1 for row in assignments)
    payload = {
        "schemaVersion": 1,
        "datasetVersion": "function-categories-v1",
        "organism": {
            "name": source["organism"],
            "taxid": source["taxid"],
            "assemblyAccession": source["assemblyAccession"],
            "assemblyName": source["assemblyName"],
        },
        "provenance": {
            "annotationRelease": source["annotationRelease"],
            "annotationDate": source["annotationDate"],
            "pgapVersion": source["pgapVersion"],
            "releaseManifest": MANIFEST_PATH.as_posix(),
            "releaseManifestRetrievedDate": manifest.get("retrievedDate"),
            "sourceGenes": GENES_PATH.as_posix(),
            "userReview": {
                "date": REVIEW_DATE,
                "scope": "Exact 13 UTEX 2973 locus-to-category rows and vocabulary",
            },
        },
        "policy": {
            "assignmentMethod": "explicit-user-review-only",
            "defaultCategoryId": "unknown-or-unclassified",
            "missingLocusBehavior": (
                "Every CDS locus absent from assignments is unknown or unclassified."
            ),
            "prohibitedInference": [
                "IEA Gene Ontology relationships",
                "product-name substring matching",
            ],
        },
        "vocabulary": {
            "categories": [
                {"id": category_id, "label": label}
                for category_id, label in CATEGORIES
            ],
            "multipleFunctionsBucket": {
                "id": "multiple-functions",
                "label": "Multiple functions",
                "rule": (
                    "Use when an explicitly reviewed locus has two or more "
                    "categoryIds."
                ),
            },
        },
        "coverage": {
            "totalCdsLoci": len(genes),
            "reviewedRows": len(assignments),
            "classifiedLoci": classified,
            "explicitUnknownLoci": explicit_unknown,
            "runtimeUnknownLoci": len(genes) - classified,
            "multipleFunctionLoci": multiple,
        },
        "assignments": assignments,
    }
    validate_payload(payload, set(genes))
    return payload


def validate_payload(payload: dict[str, Any], source_loci: set[str]) -> None:
    """Validates the public schema, sparse assignment rules, and exact counts."""
    if payload.get("schemaVersion") != 1:
        raise CategoryDataError("schemaVersion must be 1")
    if payload.get("datasetVersion") != "function-categories-v1":
        raise CategoryDataError("datasetVersion must be function-categories-v1")
    vocabulary = payload.get("vocabulary")
    if not isinstance(vocabulary, dict):
        raise CategoryDataError("vocabulary must be an object")
    categories = vocabulary.get("categories")
    expected_categories = [
        {"id": category_id, "label": label} for category_id, label in CATEGORIES
    ]
    if categories != expected_categories:
        raise CategoryDataError("category vocabulary or order differs from review")
    expected_multiple = {
        "id": "multiple-functions",
        "label": "Multiple functions",
        "rule": "Use when an explicitly reviewed locus has two or more categoryIds.",
    }
    if vocabulary.get("multipleFunctionsBucket") != expected_multiple:
        raise CategoryDataError("multiple-functions bucket differs from review")

    assignments = payload.get("assignments")
    if not isinstance(assignments, list) or len(assignments) != len(REVIEWED_ROWS):
        raise CategoryDataError("assignments must contain exactly 13 reviewed rows")
    allowed = {category_id for category_id, _ in CATEGORIES}
    loci: set[str] = set()
    classified = explicit_unknown = multiple = 0
    for row in assignments:
        if not isinstance(row, dict) or not isinstance(row.get("locusTag"), str):
            raise CategoryDataError("every assignment needs a string locusTag")
        locus = row["locusTag"]
        if locus in loci:
            raise CategoryDataError(f"duplicate assignment locus: {locus}")
        if locus not in source_loci:
            raise CategoryDataError(f"assignment locus is not a source CDS: {locus}")
        loci.add(locus)
        category_ids = row.get("categoryIds")
        if (
            not isinstance(category_ids, list)
            or not category_ids
            or len(category_ids) != len(set(category_ids))
            or any(category_id not in allowed for category_id in category_ids)
        ):
            raise CategoryDataError(f"invalid categoryIds for {locus}")
        if "unknown-or-unclassified" in category_ids and len(category_ids) != 1:
            raise CategoryDataError(f"unknown category must stand alone for {locus}")
        if row.get("classificationBasis") != "explicit-user-review":
            raise CategoryDataError(f"invalid classification basis for {locus}")
        if category_ids == ["unknown-or-unclassified"]:
            explicit_unknown += 1
        else:
            classified += 1
        multiple += len(category_ids) > 1

    expected_loci = {row[0] for row in REVIEWED_ROWS}
    if loci != expected_loci:
        raise CategoryDataError(
            "assignment locus set differs from approved review rows"
        )
    expected_coverage = {
        "totalCdsLoci": len(source_loci),
        "reviewedRows": len(REVIEWED_ROWS),
        "classifiedLoci": classified,
        "explicitUnknownLoci": explicit_unknown,
        "runtimeUnknownLoci": len(source_loci) - classified,
        "multipleFunctionLoci": multiple,
    }
    if payload.get("coverage") != expected_coverage:
        raise CategoryDataError(
            "coverage counts do not match assignments and source loci"
        )


def render_payload(payload: dict[str, Any]) -> str:
    """Serializes the artifact in its canonical byte representation."""
    return json.dumps(payload, indent=2, ensure_ascii=False) + "\n"


def generate(root: Path, check: bool = False) -> None:
    """Writes the generated artifact or checks that it is byte-for-byte current."""
    expected = render_payload(build_payload(root))
    output = root / DATASET_PATH
    if check:
        try:
            actual = output.read_text(encoding="utf-8")
        except OSError as error:
            raise CategoryDataError(
                f"cannot read generated artifact {output}: {error}"
            ) from error
        if actual != expected:
            raise CategoryDataError(
                f"{DATASET_PATH} is stale; run tools/build_function_categories.py"
            )
        print(f"OK: {DATASET_PATH} matches 13 reviewed rows across 2,715 CDS loci")
        return
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(expected, encoding="utf-8")
    print(f"Wrote {DATASET_PATH}")


def main() -> int:
    """Runs the command-line generator/checker."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="check without writing")
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help=argparse.SUPPRESS,
    )
    args = parser.parse_args()
    try:
        generate(args.root.resolve(), check=args.check)
    except CategoryDataError as error:
        parser.exit(1, f"ERROR: {error}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
