"""Hand-computed unit tests for target-independent feature metrics."""

import math
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import feature_metrics as fm
from build_features import (
    S_VALUES,
    add_context,
    circular_slice,
    effective_anticodon,
    exclusion_reason,
    expression_percentiles,
    gene_pair_metrics,
    load_expression,
    pair_scores,
    parse_attributes,
    replacement_map,
    start_window,
)


def test_contract_alphabet_and_packing_round_trip():
    assert fm.CODONS[:5] == ("TTT", "TTC", "TTA", "TTG", "TCT")
    assert fm.pack_codons("TTTTCAGGGTAA") == "AG/"
    assert fm.unpack_codons("AG/") == "TTTTCAGGG"


def test_composition_is_hand_computed():
    values = fm.composition("ATGGCTTAA")
    assert values["lengthNt"] == 9
    assert values["lengthCodons"] == 2
    assert values["gc"] == pytest.approx(3 / 6)
    assert values["gc1"] == pytest.approx(1 / 2)
    assert values["gc2"] == pytest.approx(1 / 2)
    assert values["gc3"] == pytest.approx(1 / 2)
    assert values["a3"] == pytest.approx(0)
    assert values["t3"] == pytest.approx(1 / 2)
    assert values["g3"] == pytest.approx(1 / 2)
    assert values["c3"] == pytest.approx(0)


def test_rscu_and_absent_amino_acid_are_hand_computed():
    values = dict(zip(fm.RSCU_ORDER, fm.rscu("TTTTTCTTCTAA"), strict=True))
    assert values["TTT"] == pytest.approx(2 / 3)
    assert values["TTC"] == pytest.approx(4 / 3)
    assert values["TTA"] == 0
    assert values["TTG"] == 0


def test_enc_edge_cases_and_expected_curve():
    # A single Met is valid and every unrepresented class contributes its neutral max.
    assert fm.effective_number_of_codons("ATGTAA") == pytest.approx(61.0)
    assert fm.expected_enc(0.5) == pytest.approx(60.5)
    assert fm.expected_enc(0.0) == pytest.approx(31.0)


def test_cai_zero_adjustment_and_single_codon_gene():
    weights = fm.cai_weights(["TTTTTTTAA"])
    assert weights["TTT"] == 1.0
    assert weights["TTC"] == pytest.approx(0.25)
    assert fm.codon_adaptation_index("TTCTAA", weights) == pytest.approx(0.25)
    assert fm.codon_adaptation_index("ATGTAA", weights) == 1.0


def test_tai_watson_crick_wobble_and_geometric_mean():
    # 5'-GAA-3' pairs exactly with TTC and wobble-pairs with TTT.
    s_values = {"G:T": 0.4}
    assert fm.trna_adaptiveness("TTC", {"GAA": 2}, s_values) == 2
    assert fm.trna_adaptiveness("TTT", {"GAA": 2}, s_values) == pytest.approx(1.2)
    weights = {codon: 1.0 for codon in fm.SENSE_CODONS}
    weights.update(TTT=0.25, TTC=1.0)
    assert fm.trna_adaptation_index("TTTTTCTAA", weights) == pytest.approx(0.5)
    assert fm.trna_adaptiveness("ATA", {"LAT": 1}, {"L:A": 0.89}) == pytest.approx(0.11)


def test_lysidine_ile_cat_supports_ata_without_colliding_with_met_cat():
    anticodon_counts = {
        effective_anticodon("Ile", "CAT"): 1,
        effective_anticodon("Met", "CAT"): 2,
    }
    assert anticodon_counts == {"LAT": 1, "CAT": 2}
    assert fm.trna_adaptiveness("ATA", anticodon_counts, S_VALUES) > 0
    assert fm.tai_weights(anticodon_counts, S_VALUES)["ATA"] > 0.01


def test_rare_features_include_ramp_run_and_short_local_window():
    frequencies = {codon: 1.0 for codon in fm.SENSE_CODONS}
    frequencies.update(TTT=0.05, TTC=0.05)
    tai = {codon: 1.0 for codon in fm.SENSE_CODONS}
    tai.update(TTT=0.2, TTC=0.4)
    values = fm.rare_codon_metrics("TTTTTCGCTTAA", frequencies, tai)
    assert values == {
        "rareFraction": 2 / 3,
        "rareCount": 2,
        "longestRareRun": 2,
        "rampRareCount": 2,
        "minLocalTai": pytest.approx((0.2 + 0.4 + 1) / 3),
    }


def test_local_gc_is_hand_computed():
    values = fm.local_gc("GGCCAATT", window=4)
    assert values["gc5prime"] == 1.0
    assert values["minLocalGc"] == 0.0
    assert values["maxLocalGc"] == 1.0


def test_pair_summary_and_single_codon_edge_case():
    scores = {("TTT", "TTC"): -1.0, ("TTC", "TTT"): 1.0}
    assert gene_pair_metrics("TTTTTCTTTTAA", scores) == {
        "cps": 0.0,
        "underrepresentedPairFraction": 0.5,
    }
    assert gene_pair_metrics("ATGTAA", {}) == {"cps": 0.0, "underrepresentedPairFraction": 0.0}


def test_pair_scores_and_replacements_are_deterministic():
    scores = pair_scores(["TTTTTCTAA"])
    assert scores[("TTT", "TTC")] == pytest.approx(math.log(1.5 / 0.75))
    replacements = replacement_map({"TTT": 1, "TTC": 3})
    assert replacements["TTT"] == "TTC"
    assert replacements["TTC"] == "TTT"


def test_attributes_decode_gff_escaping():
    assert parse_attributes("product=alpha%20subunit;locus_tag=X") == {
        "product": "alpha subunit",
        "locus_tag": "X",
    }


def test_expression_loader_is_generic_and_percentiles_handle_ties(tmp_path):
    table = tmp_path / "replacement.tsv"
    table.write_text(
        "locus_tag\tabundance\tsource_gene_id\n"
        "a\t10\ts1\n"
        "b\t20\ts2\n"
        "c\t20\ts3\n",
        encoding="utf-8",
    )
    values = load_expression(tmp_path)
    assert values == {"a": 10.0, "b": 20.0, "c": 20.0}
    assert expression_percentiles(values) == {
        "a": pytest.approx(1 / 3),
        "b": pytest.approx(5 / 6),
        "c": pytest.approx(5 / 6),
    }


def test_inclusion_reasons_cover_every_contract_branch():
    normal = {"proteinCoding": True, "pseudo": False}
    assert exclusion_reason("ATGTAA", normal) is None
    assert exclusion_reason("ATGTAA", {**normal, "proteinCoding": False}) == "not_protein_coding"
    assert exclusion_reason("ATGTAA", {**normal, "pseudo": True}) == "pseudogene"
    assert exclusion_reason("ATNTAA", normal) == "ambiguous_base"
    assert exclusion_reason("ATGTA", normal) == "length_not_multiple_of_3"
    assert exclusion_reason("ATGGCT", normal) == "missing_terminal_stop"
    assert exclusion_reason("ATGTAGTAA", normal) == "internal_stop"


def test_structural_exclusion_is_more_informative_than_pseudogene_flag():
    assert exclusion_reason(
        "ATGTA", {"proteinCoding": True, "pseudo": True}
    ) == "length_not_multiple_of_3"


def test_minus_strand_start_window_is_oriented():
    genome = "AAAACCCCGGGGTTTT"
    plus = {"start": 5, "end": 10, "strand": "+"}
    minus = {"start": 5, "end": 10, "strand": "-"}
    assert start_window(plus, genome)[30:36] == circular_slice(genome, 4, 10)
    sequence = circular_slice(genome, -50, 40)
    expected = str(
        __import__("Bio.Seq", fromlist=["Seq"]).Seq(sequence).reverse_complement()
    )
    assert start_window(minus, genome) == expected


def test_context_uses_transcription_direction_and_minus_operon_order():
    genes = [
        {"id": "a", "seqid": "s", "start": 1, "end": 9, "strand": "-"},
        {"id": "b", "seqid": "s", "start": 15, "end": 24, "strand": "-"},
    ]
    add_context(genes)
    assert genes[0]["neighborUpstreamNt"] == 5
    assert genes[0]["neighborDownstreamNt"] is None
    assert genes[0]["operonPosition"] == 2
    assert genes[1]["operonPosition"] == 1
