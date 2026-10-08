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
    "data/expression/sources.json": {"fitness": 99, "abundance": 64, "ratio": 1},
    "data/expression/organisms/ecoli-k12-mg1655/sources.json": {"abundance": 78},
    "data/expression/organisms/ecoli-syn61-delta3-ev5/sources.json": {
        "abundance": 6, "read_count": 3, "log2_fold_change": 4, "p_value": 2,
        "translation_efficiency_log2_fold_change": 1,
    },
}


def shipped_sources():
    """Every published source, as (manifest key, directory, source)."""
    for key in MANIFESTS:
        manifest = ROOT / key
        for source in json.loads(manifest.read_text(encoding="utf-8")):
            yield key, manifest.parent, source


def test_every_shipped_table_heads_its_values_with_its_declared_quantity():
    """The release itself, not a synthetic table: 99 fitness tables and the rest.

    A fitness value is signed and centres on zero, and a ratio is signed and
    centres on one, so a consumer that reads either as an abundance misreads
    every row. The counts are pinned per manifest so a new layer cannot arrive
    under the wrong header unnoticed, and so the dormant E. coli tables are
    seen to stay abundances.
    """
    assert sorted(str(p.relative_to(ROOT)) for p in ROOT.glob("data/expression/**/sources.json")) \
        == sorted(MANIFESTS), "a new source manifest must declare its expected columns here"
    seen = {key: {} for key in MANIFESTS}
    for key, directory, source in shipped_sources():
        path = directory / source["file"]
        with path.open(encoding="utf-8", newline="") as handle:
            fieldnames = csv.DictReader(handle, delimiter="\t").fieldnames
        column = table.check_header(
            fieldnames, source["record"]["dataType"], str(path.relative_to(ROOT)),
            source.get("quantity"), signed=bool(source.get("signed")))
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


# --- The declared-quantity contract -----------------------------------------
#
# A transcriptomics deposit publishes an abundance, a read count, one or more
# log2 fold changes, a p-value and sometimes a translation-efficiency ratio, and
# ``dataType`` cannot separate them: all of them are "transcriptomics by
# RNA-seq". A source may declare its measured ``quantity``, and these tests pin
# every consequence of that declaration.

QUANTITY_COLUMNS = {
    "rpkm": "abundance",
    "read_count": "read_count",
    "log2_fold_change": "log2_fold_change",
    "edger_log2_fold_change": "log2_fold_change",
    "p_value": "p_value",
    "translation_efficiency_log2_fold_change": "translation_efficiency_log2_fold_change",
}


def test_every_quantity_names_the_column_its_table_publishes():
    """The published column says what the number is, for a standalone download.

    Both fold changes head their values ``log2_fold_change`` because both *are*
    log2 fold changes; which estimator produced one is the source's declaration,
    not a second column name.
    """
    assert set(table.QUANTITIES) == set(QUANTITY_COLUMNS)
    for quantity, column in QUANTITY_COLUMNS.items():
        assert table.value_column("transcriptomics", quantity) == column
        assert table.header("transcriptomics", quantity) == [
            "locus_tag", column, "source_gene_id"]
        assert table.header_line("transcriptomics", quantity) == (
            f"locus_tag\t{column}\tsource_gene_id")
        assert table.check_header(
            table.header("transcriptomics", quantity), "transcriptomics",
            "t.tsv", quantity) == column


def test_a_declared_quantity_is_refused_rather_than_guessed():
    for call in (table.value_column, table.header, table.header_line):
        with pytest.raises(ValueError, match="unsupported expression quantity"):
            call("transcriptomics", "fpkm")
    with pytest.raises(ValueError, match="unsupported expression quantity"):
        table.quantity_spec("tpm")
    # An assay sentence is never a route to a quantity.
    with pytest.raises(ValueError, match="unsupported expression quantity"):
        table.quantity_spec("Ribo-seq RPKM")


def test_a_quantity_belongs_to_its_own_data_types_and_platforms():
    spec = table.check_declaration("transcriptomics", "Ribo-seq", "rpkm", "s")
    assert spec.name == "rpkm"
    with pytest.raises(ValueError, match="is defined for dataType"):
        table.check_declaration("proteomics", "LC-MS/MS", "rpkm", "s")
    with pytest.raises(ValueError, match="is defined for platform"):
        table.check_declaration("transcriptomics", "array", "read_count", "s")


def test_the_platform_distinguishes_rna_from_ribosome_in_every_kind_and_label():
    """RNA-seq counts transcripts, Ribo-seq counts footprints on them.

    The same quantity is therefore a different measurement on each platform, and
    the reader-facing label says which molecule was counted rather than leaving
    an occupancy to read as an abundance.
    """
    kinds = {
        quantity: (spec.kind("RNA-seq"), spec.kind("Ribo-seq"))
        for quantity, spec in table.QUANTITIES.items()
    }
    assert kinds == {
        "rpkm": ("abundance", "occupancy"),
        "read_count": ("read-count", "footprint-count"),
        "log2_fold_change": ("log2-fold-change", "log2-fold-change"),
        "edger_log2_fold_change": ("edger-log2-fold-change", "edger-log2-fold-change"),
        "p_value": ("p-value", "p-value"),
        "translation_efficiency_log2_fold_change": (
            "te-log2-fold-change", "te-log2-fold-change"),
    }
    labels = {
        quantity: (spec.label("RNA-seq"), spec.label("Ribo-seq"))
        for quantity, spec in table.QUANTITIES.items()
    }
    assert labels == {
        "rpkm": ("RNA abundance", "Ribosome occupancy"),
        "read_count": ("RNA read count", "Ribosome footprint count"),
        "log2_fold_change": ("RNA log2FC", "Ribosome log2FC"),
        "edger_log2_fold_change": ("RNA log2FC (EdgeR)", "Ribosome log2FC (EdgeR)"),
        "p_value": (
            "RNA reported P-value (adjustment unspecified)",
            "Ribosome reported P-value (adjustment unspecified)",
        ),
        # A translation efficiency is a ratio of the two, so it names neither.
        "translation_efficiency_log2_fold_change": ("TE log2FC", "TE log2FC"),
    }
    with pytest.raises(ValueError, match="not defined for platform"):
        table.QUANTITIES["p_value"].label("array")


def test_no_two_quantities_collapse_into_one_type_metric():
    """Each base stays its own selectable metric on each platform.

    The browser groups a dataset's metric by data type, platform and kind, so a
    kind shared by two quantities would silently average a p-value into a fold
    change, or a raw count into an RPKM that had already divided library depth
    out.
    """
    for platform in ("RNA-seq", "Ribo-seq"):
        kinds = [spec.kind(platform) for spec in table.QUANTITIES.values()]
        assert len(kinds) == len(set(kinds)), platform
    # The three bases that must never be averaged together, named explicitly.
    assert len({
        table.QUANTITIES["rpkm"].kind("RNA-seq"),
        table.QUANTITIES["read_count"].kind("RNA-seq"),
        table.QUANTITIES["log2_fold_change"].kind("RNA-seq"),
        table.QUANTITIES["edger_log2_fold_change"].kind("RNA-seq"),
        table.QUANTITIES["p_value"].kind("RNA-seq"),
        table.QUANTITIES["translation_efficiency_log2_fold_change"].kind("RNA-seq"),
    }) == 6


def test_a_fold_change_a_p_value_and_a_ratio_are_not_abundance_families():
    """The family is what keeps these three out of the abundance rules.

    The low-traffic threshold and the measured-evidence orderings select on the
    metric family, so a signed ratio or a probability sitting in ``Expression``
    would be offered as a measure of how busy a gene is.
    """
    families = {q: spec.family for q, spec in table.QUANTITIES.items()}
    assert families == {
        "rpkm": "Expression",
        "read_count": "Expression",
        "log2_fold_change": "Fold change",
        "edger_log2_fold_change": "Fold change",
        "p_value": "Significance",
        "translation_efficiency_log2_fold_change": "Translation efficiency",
    }
    scales = {q: spec.scale for q, spec in table.QUANTITIES.items()}
    assert scales == {
        "rpkm": "sequential",
        "read_count": "sequential",
        "log2_fold_change": "diverging",
        "edger_log2_fold_change": "diverging",
        "p_value": "sequential",
        "translation_efficiency_log2_fold_change": "diverging",
    }


def test_only_an_abundance_or_a_count_pools_across_selected_datasets():
    pools = {q: spec.pools for q, spec in table.QUANTITIES.items()}
    assert pools == {
        "rpkm": True,
        "read_count": True,
        "log2_fold_change": False,
        "edger_log2_fold_change": False,
        "p_value": False,
        "translation_efficiency_log2_fold_change": False,
    }


def test_the_sign_convention_follows_the_quantity_and_not_a_manifest():
    """A log2 fold change is centred on zero because it is a log2 fold change."""
    assert table.declared_flags("log2_fold_change") == {"signed": True, "logScale": False}
    assert table.declared_flags("edger_log2_fold_change") == {"signed": True, "logScale": False}
    assert table.declared_flags("translation_efficiency_log2_fold_change") == {
        "signed": True, "logScale": False}
    for one_sided in ("rpkm", "read_count", "p_value"):
        assert table.declared_flags(one_sided) == {"signed": False, "logScale": False}


def test_each_quantity_admits_only_the_values_it_can_hold():
    good = table.value_problem
    assert good("rpkm", 0.0) is None and good("rpkm", 12.5) is None
    assert "never negative" in good("rpkm", -0.1)
    assert good("read_count", 0) is None and good("read_count", 41) is None
    assert "whole reads" in good("read_count", 41.5)
    assert "never negative" in good("read_count", -1)
    for signed in ("log2_fold_change", "edger_log2_fold_change",
                   "translation_efficiency_log2_fold_change"):
        assert good(signed, -3.25) is None and good(signed, 0.0) is None
        assert good(signed, 3.25) is None
        assert "finite" in good(signed, float("inf"))
        assert "finite" in good(signed, float("nan"))
    assert good("p_value", 0.0) is None and good("p_value", 1.0) is None
    assert good("p_value", 3e-300) is None
    assert "probability in [0, 1]" in good("p_value", 1.0000001)
    assert "never negative" in good("p_value", -0.0001)
    # A bool is an int in Python and is not a measurement.
    assert "must be a number" in good("rpkm", True)
    with pytest.raises(ValueError, match="never negative"):
        table.check_value("rpkm", -1.0, "layer.tsv")
    assert table.check_value("rpkm", 1.0, "layer.tsv") == 1.0


def test_a_p_value_is_written_at_full_precision_and_everything_else_at_four_decimals():
    """Four decimals turn the strongest evidence in a table into an exact zero."""
    assert table.format_value(12.3456789) == "12.3457"
    assert table.format_value(12.3456789, "rpkm") == "12.3457"
    assert table.format_value(-1.5, "log2_fold_change") == "-1.5000"
    assert table.format_value(3.2e-18, "p_value") == "3.2e-18"
    assert float(table.format_value(3.2e-18, "p_value")) == 3.2e-18
    assert float(table.format_value(1e-300, "p_value")) == 1e-300
    # Without the quantity, the historical four-decimal convention would publish
    # the same p-value as zero, which is the mistake the contract prevents.
    assert float(table.format_value(1e-300)) == 0.0


def test_quantity_facts_are_what_the_pipeline_publishes_for_the_browser():
    """The browser reads a resolved declaration instead of a second copy of the table."""
    assert table.quantity_facts("transcriptomics", "Ribo-seq", "p_value", "s") == {
        "quantity": "p_value",
        "quantityKind": "p-value",
        "quantityLabel": "Ribosome reported P-value (adjustment unspecified)",
        "quantityFamily": "Significance",
        "quantityPools": False,
        "quantityBounds": {"nonnegative": True, "integral": False, "unitInterval": True},
    }
    assert table.quantity_facts("transcriptomics", "RNA-seq", "read_count", "s") == {
        "quantity": "read_count",
        "quantityKind": "read-count",
        "quantityLabel": "RNA read count",
        "quantityFamily": "Expression",
        "quantityPools": True,
        "quantityBounds": {"nonnegative": True, "integral": True, "unitInterval": False},
    }
    with pytest.raises(ValueError, match="is defined for platform"):
        table.quantity_facts("transcriptomics", "array", "p_value", "s")


def test_a_source_that_declares_no_quantity_keeps_its_former_behaviour():
    """Every helper's one-argument form is exactly what it was."""
    assert table.value_column("transcriptomics") == "abundance"
    assert table.value_column("fitness") == "fitness"
    assert table.header("fitness") == ["locus_tag", "fitness", "source_gene_id"]
    assert table.header_line("proteomics") == "locus_tag\tabundance\tsource_gene_id"
    assert table.check_header(table.header("fitness"), "fitness", "f.tsv") == "fitness"
    with pytest.raises(ValueError, match="no value column is defined"):
        table.value_column("metabolomics")
