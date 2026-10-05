"""The per-gene size gate on genes.json, decided by the owner on 2026-10-05."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from validate_contract import (  # noqa: E402
    GENES_JSON_BYTES_PER_GENE, Report, check_genes_json_budget,
    genes_json_budget_bytes,
)


def test_the_budget_scales_with_the_gene_count():
    assert GENES_JSON_BYTES_PER_GENE == 2_000
    assert genes_json_budget_bytes(0) == 0
    assert genes_json_budget_bytes(2_715) == 5_430_000
    assert genes_json_budget_bytes(4_287) == 8_574_000


def test_a_file_at_the_limit_passes_and_one_byte_over_fails_with_the_figures():
    report = Report()
    assert check_genes_json_budget(report, 20_000, 10) is True
    assert report.failures == []
    assert report.passes == ["genes.json is within the 2,000-byte-per-gene budget"]

    assert check_genes_json_budget(report, 20_001, 10) is False
    assert report.failures == [
        "genes.json is within the 2,000-byte-per-gene budget: "
        "20,001 bytes for 10 genes; the limit is 20,000 bytes"
    ]


def test_a_larger_schema_fails_even_when_the_gene_count_is_unchanged():
    # The gate must still catch growth per gene, which a per-organism constant
    # raised to fit a bigger genome would not.
    report = Report()
    assert check_genes_json_budget(report, 2_715 * 2_001, 2_715) is False


def test_every_published_core_payload_is_within_the_budget():
    for directory in (ROOT / "site/data", *sorted((ROOT / "site/data/organisms").glob("*/"))):
        path = directory / "genes.json"
        gene_count = len(json.loads(path.read_text(encoding="utf-8")))
        report = Report()
        assert check_genes_json_budget(report, path.stat().st_size, gene_count), (
            directory, report.failures)
