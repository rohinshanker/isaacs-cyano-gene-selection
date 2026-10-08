"""Tests for the typed value column of the published per-gene layer tables."""

import csv
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import expression_table as table  # noqa: E402
from condition_record import DATA_TYPES  # noqa: E402


def test_every_data_type_names_exactly_one_value_column():
    """A new data type must choose its column deliberately, not fall back."""
    assert set(table.VALUE_COLUMNS) == set(DATA_TYPES)
    assert table.value_column("fitness") == "fitness"
    assert table.value_column("transcriptomics") == "abundance"
    assert table.value_column("proteomics") == "abundance"


def test_a_fitness_table_and_an_abundance_table_have_different_headers():
    assert table.header("fitness") == ["locus_tag", "fitness", "source_gene_id"]
    assert table.header("transcriptomics") == ["locus_tag", "abundance", "source_gene_id"]
    assert table.header_line("fitness") == "locus_tag\tfitness\tsource_gene_id"
    assert table.header_line("proteomics") == "locus_tag\tabundance\tsource_gene_id"


def test_an_unknown_data_type_is_refused_rather_than_guessed():
    for call in (table.value_column, table.header, table.header_line):
        with pytest.raises(ValueError, match="no value column is defined"):
            call("metabolomics")
    with pytest.raises(ValueError, match="no value column is defined"):
        table.check_header(["locus_tag", "x", "source_gene_id"], "metabolomics", "label")


def test_check_header_accepts_the_declared_header_and_names_a_mismatch():
    assert table.check_header(table.header("fitness"), "fitness", "fit.tsv") == "fitness"
    assert table.check_header(table.header("proteomics"), "proteomics", "prot.tsv") == "abundance"

    # The two directions of the mistake the typed column exists to catch.
    with pytest.raises(ValueError, match=r"a fitness table must have .*'fitness'"):
        table.check_header(table.header("transcriptomics"), "fitness", "fit.tsv")
    with pytest.raises(ValueError, match=r"a transcriptomics table must have .*'abundance'"):
        table.check_header(table.header("fitness"), "transcriptomics", "expr.tsv")

    with pytest.raises(ValueError, match="expr.tsv"):
        table.check_header(None, "transcriptomics", "expr.tsv")
    with pytest.raises(ValueError, match="must have"):
        table.check_header(["locus_tag", "abundance"], "transcriptomics", "expr.tsv")
    # Column order is part of the contract, not just the set of names.
    with pytest.raises(ValueError, match="must have"):
        table.check_header(["locus_tag", "source_gene_id", "abundance"], "transcriptomics", "e.tsv")


MANIFESTS = {
    "data/expression/sources.json": {"fitness": 99, "abundance": 64},
    "data/expression/organisms/ecoli-k12-mg1655/sources.json": {"abundance": 78},
}


def shipped_sources():
    """Every published source, as (manifest key, directory, source)."""
    for key in MANIFESTS:
        manifest = ROOT / key
        for source in json.loads(manifest.read_text(encoding="utf-8")):
            yield key, manifest.parent, source


def test_every_shipped_table_heads_its_values_with_its_declared_quantity():
    """The release itself, not a synthetic table: 99 fitness tables and the rest.

    A fitness value is signed and centres on zero, so a consumer that reads one
    column as the other misreads every row. The counts are pinned per manifest
    so a new layer cannot arrive under the wrong header unnoticed, and so the
    dormant E. coli tables are seen to stay abundances.
    """
    assert sorted(str(p.relative_to(ROOT)) for p in ROOT.glob("data/expression/**/sources.json")) \
        == sorted(MANIFESTS), "a new source manifest must declare its expected columns here"
    seen = {key: {} for key in MANIFESTS}
    for key, directory, source in shipped_sources():
        path = directory / source["file"]
        with path.open(encoding="utf-8", newline="") as handle:
            fieldnames = csv.DictReader(handle, delimiter="\t").fieldnames
        column = table.check_header(
            fieldnames, source["record"]["dataType"], str(path.relative_to(ROOT)))
        seen[key][column] = seen[key].get(column, 0) + 1
    assert seen == MANIFESTS


def test_the_shipped_fitness_tables_keep_their_negative_and_zero_values():
    """Sign and exact zero survive the header contract: no clamping, no refill."""
    negatives = zeros = 0
    for _, directory, source in shipped_sources():
        if source["record"]["dataType"] != "fitness":
            continue
        with (directory / source["file"]).open(encoding="utf-8", newline="") as handle:
            for row in csv.DictReader(handle, delimiter="\t"):
                value = float(row["fitness"])
                negatives += value < 0
                zeros += value == 0
    assert negatives > 0 and zeros > 0
