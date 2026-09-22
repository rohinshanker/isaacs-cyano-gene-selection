"""Release and cohort checks for the length inventory."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from tools.length_cohorts import GFF, OUTPUT, build, read_loci


def test_release_inventory_matches_annotation_and_protein_identity() -> None:
    inventory = build()
    assert json.loads(OUTPUT.read_text(encoding="utf-8")) == inventory
    assert inventory["counts"] == {
        "annotatedLoci": 2776,
        "proteinCodingGenes": 2715,
        "screenedCds": 2715,
        "refseqProteinRecordLoci": 2715,
        "pseudogenes": 7,
        "noncodingRnaGenes": 54,
    }
    records = {row["id"]: row for row in inventory["records"]}
    assert records["M744_RS00920"]["geneSpanNt"] == 1123
    assert records["M744_RS00920"]["cdsLengthNt"] == 1122
    assert records["M744_RS14315"]["cdsLengthNt"] == 75
    assert not any(
        row["cdsLengthNt"] is not None and row["cdsLengthNt"] < 75
        for row in inventory["records"]
    )
    assert inventory["directDetection"]["available"] is False


def test_missing_protein_identity_fails_closed(tmp_path: Path) -> None:
    protein_path = tmp_path / "protein.tsv"
    protein_path.write_text(
        "locus_tag\trefseq_protein_record\nM744_RS00005\tpresent\n",
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="protein identity"):
        build(protein_path=protein_path)


def test_gff_loci_include_pseudogenes_and_rnas() -> None:
    loci = read_loci(GFF)
    assert loci["M744_RS14305"]["biotype"] == "pseudogene"
    assert loci["M744_RS00070"]["biotype"] == "tRNA"
