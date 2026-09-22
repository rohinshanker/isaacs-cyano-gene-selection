"""Lock the membership mismatch between the two pinned Tan 2018 TSS layers."""

from __future__ import annotations

import csv
import json
from pathlib import Path

from scripts.tss_evidence import load_tss_evidence


ROOT = Path(__file__).resolve().parents[1]
INITIATION = ROOT / "data/expression/tan2018_utex2973_tss_initiation.tsv"
TABLE_S1 = ROOT / "data/expression/tan2018_utex2973_tss_table_s1.tsv"
SITE_GENES = ROOT / "site/data/genes.json"
SITE_EVIDENCE = ROOT / "site/data/tss_evidence.json"


def _tsv_rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle, delimiter="\t"))


def test_pinned_tss_layers_keep_the_explained_membership_mismatch() -> None:
    """The separate exact-locus joins must not silently converge or backfill."""
    genes = json.loads(SITE_GENES.read_text(encoding="utf-8"))
    current_loci = {gene["id"] for gene in genes}
    initiation_loci = {row["locus_tag"] for row in _tsv_rows(INITIATION)}
    table_s1_evidence, summary = load_tss_evidence(TABLE_S1, current_loci)
    table_s1_loci = set(table_s1_evidence)
    assert summary["matchedRows"] == 2_432

    # The browser copies must express the same two pinned joins.
    site_values = {
        gene["id"] for gene in genes if isinstance(gene.get("tssInitiation"), (int, float))
    }
    site_evidence = json.loads(SITE_EVIDENCE.read_text(encoding="utf-8"))
    assert site_values == initiation_loci
    assert set(site_evidence) == table_s1_loci

    site_rows_without_score = table_s1_loci - initiation_loci
    score_without_site_rows = initiation_loci - table_s1_loci
    assert len(table_s1_loci) == 1_789
    assert len(initiation_loci) == 1_727
    assert len(table_s1_loci & initiation_loci) == 1_317
    assert len(site_rows_without_score) == 472
    assert len(score_without_site_rows) == 410

    # Stable examples make a changed join easy to diagnose rather than only
    # reporting an aggregate-count failure.
    assert "M744_RS00030" in site_rows_without_score
    assert "M744_RS00010" in score_without_site_rows
