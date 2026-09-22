"""Contract tests for the reviewed UTEX 2973 function-category artifact."""

from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "tools/build_function_categories.py"
SPEC = importlib.util.spec_from_file_location("build_function_categories", MODULE_PATH)
assert SPEC and SPEC.loader
categories = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(categories)


def load_artifact() -> dict:
    """Loads the checked-in category payload."""
    return json.loads((ROOT / categories.DATASET_PATH).read_text(encoding="utf-8"))


def test_generated_artifact_rebuilds_byte_for_byte() -> None:
    """The checked-in payload is the deterministic output of pinned sources."""
    expected = categories.render_payload(categories.build_payload(ROOT))
    actual = (ROOT / categories.DATASET_PATH).read_text(encoding="utf-8")
    assert actual == expected


def test_payload_has_exact_vocabulary_rows_and_coverage() -> None:
    """No reviewed label or locus can be added, removed, or reassigned silently."""
    payload = load_artifact()
    expected_labels = [
        "Photosynthetic light reactions",
        "Carbon and nutrient metabolism",
        "ATP production and respiration",
        "Pigment and cofactor biosynthesis",
        "Translation and protein maintenance",
        "DNA and RNA processing",
        "Transport and envelope",
        "Signaling and circadian regulation",
        "Stress and repair",
        "Other characterized",
        "Unknown or unclassified",
    ]
    actual_labels = [
        row["label"] for row in payload["vocabulary"]["categories"]
    ]
    assert actual_labels == expected_labels
    assert payload["vocabulary"]["multipleFunctionsBucket"] == {
        "id": "multiple-functions",
        "label": "Multiple functions",
        "rule": "Use when an explicitly reviewed locus has two or more categoryIds.",
    }
    expected_assignments = {
        "M744_RS00265": ["photosynthetic-light-reactions"],
        "M744_RS00815": ["photosynthetic-light-reactions"],
        "M744_RS13625": ["photosynthetic-light-reactions"],
        "M744_RS10050": ["signaling-and-circadian-regulation"],
        "M744_RS10055": ["signaling-and-circadian-regulation"],
        "M744_RS10060": ["signaling-and-circadian-regulation"],
        "M744_RS13070": ["signaling-and-circadian-regulation"],
        "M744_RS00700": ["translation-and-protein-maintenance"],
        "M744_RS01270": ["atp-production-and-respiration"],
        "M744_RS00020": ["pigment-and-cofactor-biosynthesis"],
        "M744_RS04595": ["pigment-and-cofactor-biosynthesis"],
        "M744_RS02500": ["signaling-and-circadian-regulation"],
        "M744_RS00030": ["unknown-or-unclassified"],
    }
    assert {
        row["locusTag"]: row["categoryIds"] for row in payload["assignments"]
    } == expected_assignments
    assert payload["coverage"] == {
        "totalCdsLoci": 2715,
        "reviewedRows": 13,
        "classifiedLoci": 12,
        "explicitUnknownLoci": 1,
        "runtimeUnknownLoci": 2703,
        "multipleFunctionLoci": 0,
    }
    assert payload["policy"]["defaultCategoryId"] == "unknown-or-unclassified"
    assert payload["policy"]["prohibitedInference"] == [
        "IEA Gene Ontology relationships",
        "product-name substring matching",
    ]
    assert payload["provenance"]["annotationRelease"] == (
        "GCF_000817325.1-RS_2026_05_13"
    )
    assert payload["provenance"]["userReview"]["date"] == "2026-09-22"


def test_every_reviewed_row_matches_current_source_identity() -> None:
    """All 13 locus/product/symbol triples match the current site CDS source."""
    genes = categories.load_source_genes(ROOT / categories.GENES_PATH)
    assignments = categories._reviewed_assignments(genes)
    assert len(assignments) == 13
    for locus, product, symbol, _, _, _ in categories.REVIEWED_ROWS:
        assert genes[locus]["product"] == product
        assert genes[locus]["name"] == symbol


def test_source_product_or_symbol_drift_fails_closed() -> None:
    """Reviewed rows are not silently changed to follow a new annotation."""
    genes = categories.load_source_genes(ROOT / categories.GENES_PATH)
    changed_product = copy.deepcopy(genes)
    changed_product["M744_RS04595"]["product"] = "changed product"
    with pytest.raises(
        categories.CategoryDataError,
        match="M744_RS04595 product mismatch",
    ):
        categories._reviewed_assignments(changed_product)

    changed_symbol = copy.deepcopy(genes)
    changed_symbol["M744_RS10050"]["name"] = "kaiA"
    with pytest.raises(
        categories.CategoryDataError,
        match="M744_RS10050 symbol mismatch",
    ):
        categories._reviewed_assignments(changed_symbol)


def test_schema_rejects_extra_row_bad_category_and_wrong_counts() -> None:
    """Sparse schema validation rejects unreviewed or internally inconsistent data."""
    payload = load_artifact()
    source_loci = set(categories.load_source_genes(ROOT / categories.GENES_PATH))
    categories.validate_payload(payload, source_loci)

    extra = copy.deepcopy(payload)
    extra["assignments"].append(
        {
            "locusTag": "M744_RS00005",
            "releaseProduct": "metallophosphoesterase",
            "releaseSymbol": None,
            "categoryIds": ["other-characterized"],
            "classificationBasis": "explicit-user-review",
        }
    )
    with pytest.raises(categories.CategoryDataError, match="exactly 13"):
        categories.validate_payload(extra, source_loci)

    bad_category = copy.deepcopy(payload)
    bad_category["assignments"][0]["categoryIds"] = ["inferred-from-product"]
    with pytest.raises(categories.CategoryDataError, match="invalid categoryIds"):
        categories.validate_payload(bad_category, source_loci)

    wrong_counts = copy.deepcopy(payload)
    wrong_counts["coverage"]["runtimeUnknownLoci"] -= 1
    with pytest.raises(categories.CategoryDataError, match="coverage counts"):
        categories.validate_payload(wrong_counts, source_loci)


def test_tested_alleles_are_scoped_support_not_classification_assays() -> None:
    """The three admitted allele records retain their narrow evidence boundary."""
    payload = load_artifact()
    supported = {
        row["locusTag"]: row["supportingEvidence"]
        for row in payload["assignments"]
        if "supportingEvidence" in row
    }
    assert set(supported) == {"M744_RS01270", "M744_RS02500", "M744_RS04595"}
    assert all(
        item["kind"] == "tested-utex-2973-allele"
        for item in supported.values()
    )
    assert all(
        "not a functional-category assay" in item["scope"]
        for item in supported.values()
    )
