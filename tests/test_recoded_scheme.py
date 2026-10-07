"""Tests for ``tools/recoded_scheme.py``.

Every fixture is synthetic and tiny. The point is that the derivation reports
exactly what the sequences say, including refusing to compare a pair it cannot
safely compare, so each rejection reason and each branch has its own case.
"""

from __future__ import annotations

import gzip
import importlib.util
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

import pytest
from Bio import SeqIO
from Bio.Seq import Seq
from Bio.SeqFeature import FeatureLocation, SeqFeature
from Bio.SeqRecord import SeqRecord

_SPEC = importlib.util.spec_from_file_location(
    "recoded_scheme",
    Path(__file__).resolve().parents[1] / "tools" / "recoded_scheme.py",
)
assert _SPEC and _SPEC.loader
recoded_scheme = importlib.util.module_from_spec(_SPEC)
sys.modules["recoded_scheme"] = recoded_scheme
_SPEC.loader.exec_module(recoded_scheme)

Pair = recoded_scheme.Pair


# --------------------------------------------------------------------------
# codon helpers
# --------------------------------------------------------------------------


def test_codons_of_splits_whole_codons():
    assert recoded_scheme.codons_of("ATGAAATAA") == ["ATG", "AAA", "TAA"]


def test_codons_of_drops_a_trailing_partial_codon():
    assert recoded_scheme.codons_of("ATGAAAT") == ["ATG", "AAA"]


def test_codons_of_empty_sequence():
    assert recoded_scheme.codons_of("") == []


def test_translate_marks_stops_and_unknowns():
    assert recoded_scheme.translate("ATGTAANNN") == "M*X"


def test_body_codons_drops_a_terminal_stop():
    assert recoded_scheme.body_codons("ATGAAATAA") == ["ATG", "AAA"]


def test_body_codons_keeps_a_sequence_that_does_not_end_in_a_stop():
    assert recoded_scheme.body_codons("ATGAAA") == ["ATG", "AAA"]


def test_body_codons_empty_sequence():
    assert recoded_scheme.body_codons("") == []


def test_amino_acid_table_covers_every_codon():
    assert len(recoded_scheme.ALL_CODONS) == 64
    assert set(recoded_scheme.AMINO_ACID) >= set(recoded_scheme.ALL_CODONS)
    assert recoded_scheme.AMINO_ACID["TAG"] == "*"
    # AGC and TCA are synonyms, which is why one can replace the other.
    assert recoded_scheme.AMINO_ACID["AGC"] == recoded_scheme.AMINO_ACID["TCA"]


# --------------------------------------------------------------------------
# readers
# --------------------------------------------------------------------------


def test_read_native_cds_skips_pseudogenes_and_keeps_the_first_duplicate(
    tmp_path,
):
    path = tmp_path / "cds.fna.gz"
    with gzip.open(path, "wt") as handle:
        handle.write(">x [gene=aceA] [protein=a]\nATGAAATAA\n")
        handle.write(">y [gene=aceA] [protein=a]\nATGAAGTAA\n")
        handle.write(">z [gene=ghost] [pseudo=true]\nATGTAA\n")
        handle.write(">w [protein=no symbol]\nATGTAA\n")
    result = recoded_scheme.read_native_cds(path)
    assert result == {"aceA": "ATGAAATAA"}


def _write_genbank(path: Path, features: list[tuple[dict, int, int]]) -> None:
    """Write a GenBank record carrying ``(qualifiers, start, end)`` CDSs."""
    record = SeqRecord(
        Seq("ATGAAATAA" * 12),
        id="TEST",
        name="TEST",
        description="synthetic",
        annotations={"molecule_type": "DNA"},
    )
    for qualifiers, start, end in features:
        record.features.append(
            SeqFeature(
                FeatureLocation(start, end, strand=1),
                type="CDS",
                qualifiers=qualifiers,
            )
        )
    record.features.append(
        SeqFeature(FeatureLocation(0, 9, strand=1), type="gene", qualifiers={})
    )
    SeqIO.write(record, path, "genbank")


def test_read_design_cds_prefers_gene_then_locus_tag_then_position(tmp_path):
    path = tmp_path / "design.gb"
    _write_genbank(
        path,
        [
            ({"gene": ["named"], "locus_tag": ["ignored"]}, 0, 9),
            ({"locus_tag": ["tagged"]}, 9, 18),
            ({}, 18, 27),
        ],
    )
    result = recoded_scheme.read_design_cds(path)
    identifiers = [gene for gene, _ in result]
    assert identifiers[0] == "named"
    assert identifiers[1] == "tagged"
    assert identifiers[2].startswith("unnamed_cds_")
    # Nothing is dropped: a count over the result is a count over the design.
    assert len(result) == 3
    assert all(sequence == "ATGAAATAA" for _, sequence in result)


def test_read_supplied_variants_strips_whitespace_and_skips_blanks(tmp_path):
    openpyxl = pytest.importorskip("openpyxl")
    path = tmp_path / "variants.xlsx"
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "Selected Genes for recoding"
    sheet.append(["Gene ID", "Sequence of recoded variant"])
    sheet.append(["aceA", "atg aaa\ntaa"])
    sheet.append([None, "ATGTAA"])
    sheet.append(["noSeq", None])
    workbook.save(path)
    result = recoded_scheme.read_supplied_variants(
        path, "Selected Genes for recoding"
    )
    assert result == [("aceA", "ATGAAATAA")]


# --------------------------------------------------------------------------
# pairing
# --------------------------------------------------------------------------


def test_pair_against_native_accepts_a_synonymous_recoding():
    native = {"aceA": "ATGAGCTAA"}
    pairs, rejected = recoded_scheme.pair_against_native(
        [("aceA", "ATGTCATAA")], native
    )
    assert rejected == []
    assert pairs == [Pair("aceA", "ATGAGCTAA", "ATGTCATAA")]


@pytest.mark.parametrize(
    ("gene", "sequence", "native", "reason"),
    [
        ("missing", "ATGTAA", {}, "no native gene of that symbol"),
        ("aceA", "ATGTA", {"aceA": "ATGTA"}, "recoded length not a multiple of 3"),
        ("aceA", "ATGTAA", {"aceA": "ATGAAATAA"}, "length 6 against native 9"),
        ("aceA", "ATGGAATAA", {"aceA": "ATGAAATAA"}, "translations differ"),
    ],
)
def test_pair_against_native_rejects_unsafe_comparisons(
    gene, sequence, native, reason
):
    pairs, rejected = recoded_scheme.pair_against_native(
        [(gene, sequence)], native
    )
    assert pairs == []
    assert [r.reason for r in rejected] == [reason]
    assert rejected[0].gene == gene


def test_pair_against_native_rejects_a_changed_protein_not_a_changed_codon():
    """AAA to AAG is synonymous; AAA to GAA is not. Only the latter is a reject."""
    native = {"same": "ATGAAATAA", "different": "ATGAAATAA"}
    pairs, rejected = recoded_scheme.pair_against_native(
        [("same", "ATGAAGTAA"), ("different", "ATGGAATAA")], native
    )
    assert [p.gene for p in pairs] == ["same"]
    assert [r.gene for r in rejected] == ["different"]


# --------------------------------------------------------------------------
# substitutions, retention and targets
# --------------------------------------------------------------------------


def _pairs_removing_agc(count: int, kept: int = 0) -> list[Pair]:
    """Pairs where AGC is replaced by TCA ``count`` times and kept ``kept``."""
    native = "ATG" + "AGC" * (count + kept) + "TAA"
    recoded = "ATG" + "TCA" * count + "AGC" * kept + "TAA"
    return [Pair("g", native, recoded)]


def test_substitutions_counts_only_changed_codons():
    counts = recoded_scheme.substitutions(_pairs_removing_agc(3))
    assert counts == Counter({("AGC", "TCA"): 3})


def test_substitutions_ignores_the_terminal_stop():
    pairs = [Pair("g", "ATGAAATAA", "ATGAAATGA")]
    assert recoded_scheme.substitutions(pairs) == Counter()


def test_retention_reports_native_and_design_counts():
    result = recoded_scheme.retention(_pairs_removing_agc(4, kept=1))
    assert result["AGC"] == (5, 1)
    assert result["TCA"] == (0, 4)
    assert "TAA" not in result  # the terminal stop is excluded from the body


def test_target_codons_finds_the_collapsed_codon():
    pairs = _pairs_removing_agc(99, kept=1)
    assert recoded_scheme.target_codons(pairs) == ["AGC"]


def test_target_codons_ignores_a_codon_absent_from_the_native_set():
    """TCA appears only in the design, so its retention is undefined."""
    pairs = _pairs_removing_agc(10)
    assert "TCA" not in recoded_scheme.target_codons(pairs)


def test_target_codons_respects_the_threshold():
    pairs = _pairs_removing_agc(5, kept=5)  # retention 0.5
    assert recoded_scheme.target_codons(pairs) == []
    assert recoded_scheme.target_codons(pairs, threshold=0.6) == ["AGC"]


def test_target_codons_orders_by_retention():
    pairs = [
        Pair(
            "g",
            "ATG" + "AGC" * 100 + "TTA" * 100 + "TAA",
            "ATG" + "TCA" * 100 + ("CTT" * 98 + "TTA" * 2) + "TAA",
        )
    ]
    assert recoded_scheme.target_codons(pairs) == ["AGC", "TTA"]


def test_retention_gap_separates_targets_from_the_rest():
    pairs = _pairs_removing_agc(99, kept=1)
    low, high = recoded_scheme.retention_gap(pairs)
    assert low == pytest.approx(0.01)
    assert high == 1.0  # ATG is untouched


def test_retention_gap_with_no_target_reports_zero_below():
    pairs = [Pair("g", "ATGAAATAA", "ATGAAATAA")]
    low, high = recoded_scheme.retention_gap(pairs)
    assert low == 0.0
    assert high == 1.0


def test_retention_gap_with_everything_below_the_threshold():
    pairs = [Pair("g", "AGCAGC", "TCATCA")]
    low, high = recoded_scheme.retention_gap(pairs)
    assert low == 0.0
    assert high == 1.0


# --------------------------------------------------------------------------
# destinations
# --------------------------------------------------------------------------


def test_destinations_orders_replacements_by_count():
    counts = Counter(
        {("AGC", "TCA"): 10, ("AGC", "TCT"): 3, ("TTA", "CTT"): 5}
    )
    result = recoded_scheme.destinations(counts, ["AGC"])
    assert result == {"AGC": [("TCA", 10), ("TCT", 3)]}


def test_destinations_reports_an_empty_list_for_an_untouched_target():
    assert recoded_scheme.destinations(Counter(), ["AGC"]) == {"AGC": []}


def test_single_destination_targets_distinguishes_a_map_from_a_distribution():
    counts = Counter(
        {("AGC", "TCA"): 10, ("AGC", "TCT"): 3, ("TAG", "TAA"): 7}
    )
    assert recoded_scheme.single_destination_targets(
        counts, ["AGC", "TAG"]
    ) == ["TAG"]


# --------------------------------------------------------------------------
# residuals and stops
# --------------------------------------------------------------------------


def test_terminal_stops_counts_the_final_codon_even_when_it_is_not_a_stop():
    result = recoded_scheme.terminal_stops(
        [("a", "ATGTAA"), ("b", "ATGTGA"), ("c", "ATGAAA"), ("d", "")]
    )
    assert result == Counter({"TAA": 1, "TGA": 1, "AAA": 1})


def test_stop_targets_finds_the_rare_stop():
    sequences = [("a", "ATGTAA")] * 90 + [("b", "ATGTGA")] * 9 + [
        ("c", "ATGTAG")
    ]
    assert recoded_scheme.stop_targets(sequences) == ["TAG"]


def test_stop_targets_ignores_sequences_ending_in_a_sense_codon():
    """A CDS annotated without a stop is an artefact, not a choice of stop."""
    sequences = [("a", "ATGTAA")] * 94 + [("b", "ATGTGA")] * 6 + [
        ("junk", "ATGAAA")
    ] * 500
    # TGA is 6 of the 100 real stops. The 500 sense-ending sequences must not
    # enter the denominator, or TGA would look like 1% and pass as a target.
    assert recoded_scheme.stop_targets(sequences) == []
    assert recoded_scheme.stop_targets(sequences, threshold=0.07) == ["TGA"]


def test_stop_targets_with_no_stop_codon_at_all():
    assert recoded_scheme.stop_targets([("a", "ATGAAA")]) == []


def test_stop_targets_orders_by_share():
    sequences = (
        [("a", "ATGTAA")] * 100 + [("b", "ATGTGA")] * 3 + [("c", "ATGTAG")]
    )
    assert recoded_scheme.stop_targets(sequences, threshold=0.05) == [
        "TAG",
        "TGA",
    ]


def test_residual_targets_reports_only_genes_that_retain_one():
    sequences = [("keeps", "ATGAGCAGCTAA"), ("clean", "ATGTCATAA")]
    result = recoded_scheme.residual_targets(sequences, {"AGC"})
    assert result == {"keeps": Counter({"AGC": 2})}


def test_residual_targets_does_not_count_a_terminal_target_codon():
    """A terminal stop is reported by ``terminal_stops``, not as a body codon."""
    assert recoded_scheme.residual_targets([("g", "ATGTAG")], {"TAG"}) == {}


# --------------------------------------------------------------------------
# command line
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class _TinyInputs:
    """A synthetic dataset plus the CLI arguments that select it."""

    root: Path
    argv: list[str]


@pytest.fixture()
def tiny_inputs(tmp_path):
    """Build a three-gene synthetic dataset and return its CLI arguments."""
    openpyxl = pytest.importorskip("openpyxl")

    native = tmp_path / "native.fna.gz"
    with gzip.open(native, "wt") as handle:
        # recoded away entirely
        handle.write(">1 [gene=aceA]\nATG" + "AGC" * 40 + "TAA\n")
        # retains one target codon
        handle.write(">2 [gene=aceB]\nATG" + "AGC" * 40 + "TAA\n")
        # never touched
        handle.write(">3 [gene=aceC]\nATG" + "AAA" * 40 + "TAA\n")

    design = tmp_path / "design.gb"
    record = SeqRecord(
        Seq(
            "ATG" + "TCA" * 40 + "TAA"
            "ATG" + "TCA" * 39 + "AGC" + "TAG"
            "ATG" + "AAA" * 40 + "TAA"
        ),
        id="TEST",
        name="TEST",
        description="synthetic",
        annotations={"molecule_type": "DNA"},
    )
    for index, gene in enumerate(["aceA", "aceB", "aceC"]):
        start = index * 126
        record.features.append(
            SeqFeature(
                FeatureLocation(start, start + 126, strand=1),
                type="CDS",
                qualifiers={"gene": [gene]},
            )
        )
    SeqIO.write(record, design, "genbank")

    variants = tmp_path / "variants.xlsx"
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "Selected Genes for recoding"
    sheet.append(["Gene ID", "Sequence"])
    sheet.append(["aceA", "ATG" + "TCA" * 40 + "TAA"])
    workbook.save(variants)

    return _TinyInputs(
        root=tmp_path,
        argv=[
            "--native", str(native),
            "--design", str(design),
            "--variants", str(variants),
            "--variants-sheet", "Selected Genes for recoding",
        ],
    )


def test_main_report_writes_nothing(tiny_inputs, capsys):
    out = tiny_inputs.root / "out"
    argv = ["--report", "--out-dir", str(out), *tiny_inputs.argv]
    assert recoded_scheme.main(argv) == 0
    captured = capsys.readouterr().out
    assert "target codons, genome-wide: AGC" in captured
    # In this fixture AGC goes only to TCA, so the scheme *is* expressible as a
    # codon-to-codon map. The real design is not; see the unit test above.
    assert "targets with a single destination codon: ['AGC']" in captured
    assert not out.exists()


def test_main_writes_the_four_tables(tiny_inputs):
    out = tiny_inputs.root / "out"
    assert recoded_scheme.main(["--out-dir", str(out), *tiny_inputs.argv]) == 0
    names = sorted(p.name for p in out.iterdir())
    assert names == [
        "ec_syn57_residual_targets.tsv",
        "ec_syn57_retention.tsv",
        "ec_syn57_substitutions.tsv",
        "ec_syn57_unpaired.tsv",
    ]


def test_main_retention_table_marks_the_target(tiny_inputs):
    out = tiny_inputs.root / "out"
    recoded_scheme.main(["--out-dir", str(out), *tiny_inputs.argv])
    rows = (out / "ec_syn57_retention.tsv").read_text().splitlines()
    header = rows[0].split("\t")
    assert header == [
        "codon",
        "amino_acid",
        "native_count",
        "design_count",
        "retention",
        "is_target",
        "basis",
    ]
    marked = {r.split("\t")[0]: r.split("\t")[5:7] for r in rows[1:]}
    assert marked["AGC"] == ["yes", "body-codon retention"]
    assert marked["AAA"] == ["no", "body-codon retention"]
    # Every stop codon is present on its own basis, so a reader never has to
    # reconcile a six-row target set against a seven-codon scheme.
    assert marked["TAA"][1] == "terminal-stop share"
    assert marked["TAG"][1] == "terminal-stop share"
    assert marked["TGA"][1] == "terminal-stop share"


def test_main_residual_table_names_the_unrecoded_gene(tiny_inputs):
    out = tiny_inputs.root / "out"
    recoded_scheme.main(["--out-dir", str(out), *tiny_inputs.argv])
    rows = (out / "ec_syn57_residual_targets.tsv").read_text().splitlines()
    assert rows[0].split("\t") == ["gene", "codon", "amino_acid", "count"]
    assert [r.split("\t")[:2] for r in rows[1:]] == [["aceB", "AGC"]]


def test_main_substitutions_table_carries_both_derivations(tiny_inputs):
    out = tiny_inputs.root / "out"
    recoded_scheme.main(["--out-dir", str(out), *tiny_inputs.argv])
    rows = (out / "ec_syn57_substitutions.tsv").read_text().splitlines()[1:]
    sources = {r.split("\t")[0] for r in rows}
    assert sources == {"genome_wide", "supplied_variants"}
    shares = {r.split("\t")[5] for r in rows if r.startswith("genome_wide")}
    assert shares == {"1.000000"}  # AGC goes only to TCA in this fixture


def test_main_unpaired_table_exists_even_when_everything_pairs(tiny_inputs):
    out = tiny_inputs.root / "out"
    recoded_scheme.main(["--out-dir", str(out), *tiny_inputs.argv])
    rows = (out / "ec_syn57_unpaired.tsv").read_text().splitlines()
    assert rows[0].split("\t") == ["source", "gene", "reason"]
