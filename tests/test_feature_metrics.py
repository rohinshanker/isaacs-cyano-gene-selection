"""Hand-computed unit tests for target-independent feature metrics."""

import hashlib
import json
import math
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import feature_metrics as fm
from build_features import (
    S_VALUES,
    add_context,
    cds_segments,
    circular_slice,
    codon_occurrences,
    effective_anticodon,
    exclusion_reason,
    expression_proxy_scores,
    expression_percentiles,
    gene_pair_metrics,
    is_cai_reference,
    load_expression_sources,
    pair_scores,
    parse_attributes,
    replacement_map,
    require,
    start_window,
)


def test_contract_alphabet_and_packing_round_trip():
    assert fm.CODONS[:5] == ("TTT", "TTC", "TTA", "TTG", "TCT")
    assert fm.pack_codons("TTTTCAGGGTAA") == "AG/"
    assert fm.unpack_codons("AG/") == "TTTTCAGGG"


def test_alternative_start_is_methionine_for_translation_metrics():
    sequence = "GTGGTTTAA"
    assert fm.translated_codons(sequence) == ["ATG", "GTT"]

    rscu = dict(zip(fm.RSCU_ORDER, fm.rscu(sequence), strict=True))
    assert rscu["GTT"] == 4.0
    assert rscu["GTG"] == 0.0

    cai_weights = {codon: 1.0 for codon in fm.SENSE_CODONS}
    cai_weights["GTG"] = 0.01
    assert fm.codon_adaptation_index(sequence, cai_weights) == 1.0

    tai_weights = {codon: 1.0 for codon in fm.SENSE_CODONS}
    tai_weights.update(ATG=0.25, GTG=0.01)
    assert fm.trna_adaptation_index(sequence, tai_weights) == 1.0
    assert gene_pair_metrics(sequence, {("ATG", "GTT"): 2.0})["cps"] == 2.0


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
    values = dict(zip(fm.RSCU_ORDER, fm.rscu("ATGTTTTTCTTCTAA"), strict=True))
    assert values["TTT"] == pytest.approx(2 / 3)
    assert values["TTC"] == pytest.approx(4 / 3)
    assert values["TTA"] == 0
    assert values["TTG"] == 0


def test_enc_edge_cases_and_expected_curve():
    # A single Met is valid and every unrepresented class contributes its neutral max.
    assert fm.effective_number_of_codons("ATGTAA") == pytest.approx(61.0)
    assert fm.expected_enc(0.5) == pytest.approx(60.5)
    assert fm.expected_enc(0.0) == pytest.approx(31.0)


def test_enc_singletons_use_same_degeneracy_class_average():
    # Balanced Phe supplies F2=0.5. Singleton Tyr is unestimable and uses that
    # same 2-fold class average rather than being treated as maximally biased.
    enc, substituted = fm.effective_number_of_codons_with_substitution(
        "ATGTTTTTCTATTAA"
    )
    assert enc == 61.0
    assert substituted is True


def test_expected_enc_uses_silent_gc3():
    # Met's G-ending third position is not a synonymous site; the two Phe sites are.
    assert fm.silent_gc3("ATGTTTTTCTAA") == pytest.approx(0.5)


def test_cai_zero_adjustment_and_single_codon_gene():
    weights = fm.cai_weights(["ATGTTTTTTTAA"])
    assert weights["TTT"] == 1.0
    assert weights["TTC"] == pytest.approx(0.25)
    assert fm.codon_adaptation_index("ATGTTCTAA", weights) == pytest.approx(0.25)
    assert fm.codon_adaptation_index("ATGTAA", weights) == 1.0


def test_tai_watson_crick_wobble_and_geometric_mean():
    # 5'-GAA-3' pairs exactly with TTC and wobble-pairs with TTT.
    s_values = {"G:T": 0.4}
    assert fm.trna_adaptiveness("TTC", {"GAA": 2}, s_values) == 2
    assert fm.trna_adaptiveness("TTT", {"GAA": 2}, s_values) == pytest.approx(1.2)
    weights = {codon: 1.0 for codon in fm.SENSE_CODONS}
    weights.update(TTT=0.25, TTC=1.0)
    assert fm.trna_adaptation_index("ATGTTTTTCTAA", weights) == pytest.approx(0.5)
    assert fm.trna_adaptiveness("ATA", {"LAT": 1}, {"L:A": 0.89}) == pytest.approx(0.11)


def test_lysidine_ile_cat_supports_ata_without_colliding_with_met_cat():
    anticodon_counts = {
        effective_anticodon("Ile", "CAT"): 1,
        effective_anticodon("Met", "CAT"): 2,
    }
    assert anticodon_counts == {"LAT": 1, "CAT": 2}
    assert fm.trna_adaptiveness("ATA", anticodon_counts, S_VALUES) > 0
    assert fm.tai_weights(anticodon_counts, S_VALUES)["ATA"] > 0.01


def test_tai_zero_weights_use_nonzero_geometric_mean_and_exclude_met():
    weights, substitution = fm.tai_weights_with_substitution(
        {"GAA": 2}, {"G:T": 0.4}
    )
    assert substitution == pytest.approx(math.sqrt(0.6))
    assert weights["TTA"] == pytest.approx(substitution)
    weights.update(ATG=0.01, TTT=0.25, TTC=1.0)
    assert fm.trna_adaptation_index("ATGTTTTTCTAA", weights) == pytest.approx(0.5)


def test_rare_features_include_ramp_run_and_short_local_window():
    frequencies = {codon: 1.0 for codon in fm.SENSE_CODONS}
    frequencies.update(TTT=0.05, TTC=0.05)
    tai = {codon: 1.0 for codon in fm.SENSE_CODONS}
    tai.update(TTT=0.2, TTC=0.4)
    values = fm.rare_codon_metrics("ATGTTTTTCGCTTAA", frequencies, tai)
    assert values == {
        "rareFraction": 2 / 4,
        "rareCount": 2,
        "longestRareRun": 2,
        "rampRareCount": 2,
        "minLocalTai": pytest.approx((1 + 0.2 + 0.4 + 1) / 4),
    }


def test_local_gc_is_hand_computed():
    values = fm.local_gc("GGCCAATT", window=4)
    assert values["gc5prime"] == 1.0
    assert values["minLocalGc"] == 0.0
    assert values["maxLocalGc"] == 1.0


def test_pair_summary_and_single_codon_edge_case():
    scores = {
        ("ATG", "TTT"): 0.0,
        ("TTT", "TTC"): -1.0,
        ("TTC", "TTT"): 1.0,
    }
    assert gene_pair_metrics("ATGTTTTTCTTTTAA", scores) == {
        "cps": 0.0,
        "underrepresentedPairFraction": 1 / 3,
    }
    assert gene_pair_metrics("ATGTAA", {}) == {"cps": 0.0, "underrepresentedPairFraction": 0.0}


def test_pair_scores_and_replacements_are_deterministic():
    scores = pair_scores(["ATGTTTTTCTAA"])
    assert scores[("TTT", "TTC")] == pytest.approx(math.log(1.5 / 0.75))
    replacements = replacement_map({"TTT": 1, "TTC": 3})
    assert replacements["TTT"] == "TTC"
    assert replacements["TTC"] == "TTT"
    stop_replacements = replacement_map({"TAG": 4, "TAA": 3, "TGA": 2})
    assert stop_replacements == {
        **{codon: stop_replacements[codon] for codon in fm.SENSE_CODONS},
        "TAA": "TAG",
        "TAG": "TAA",
        "TGA": "TAG",
    }


def test_cai_reference_rejects_ribosomal_modifying_enzymes():
    assert is_cai_reference("30S ribosomal protein S12")
    assert not is_cai_reference("50S ribosomal protein L11 methyltransferase")
    assert not is_cai_reference("ribosomal protein S18-alanine N-acetyltransferase")


def test_require_is_not_disabled_by_python_optimization():
    with pytest.raises(ValueError, match="observed value"):
        require(False, "observed value is invalid")


def test_attributes_decode_gff_escaping():
    assert parse_attributes("product=alpha%20subunit;locus_tag=X") == {
        "product": "alpha subunit",
        "locus_tag": "X",
    }


def test_joined_cds_segments_preserve_location_order():
    assert cds_segments("join(169621..169692,169694..170743)") == [
        [169621, 169692],
        [169694, 170743],
    ]
    assert cds_segments("complement(join(45877..46366,1..2510))") == [
        [45877, 46366],
        [1, 2510],
    ]
    assert cds_segments("2370396..2370770") is None


def expression_source(file_name, metric_key, digest):
    """Returns a complete test manifest entry."""
    return {
        "id": metric_key.upper(),
        "file": file_name,
        "metricKey": metric_key,
        "label": metric_key,
        "organism": "test organism",
        "isTargetOrganism": True,
        "assay": "test assay",
        "units": "test units",
        "condition": "test condition",
        "sha256": digest,
        "licence": "test licence",
        "caveat": "test caveat",
        "provenanceDoc": "data/expression/test.md",
    }


def write_expression_table(directory, file_name, rows):
    """Writes a small source table and returns its SHA-256 digest."""
    content = "locus_tag\tabundance\tsource_gene_id\n" + "".join(
        f"{locus}\t{value}\t{source_id}\n" for locus, value, source_id in rows
    )
    (directory / file_name).write_text(content, encoding="utf-8")
    return hashlib.sha256(content.encode()).hexdigest()


def test_expression_manifest_loads_only_selected_sources_and_keeps_nulls(tmp_path):
    first_digest = write_expression_table(
        tmp_path, "first.tsv", [("a", 10, "s1"), ("b", 20, "s2"), ("c", 20, "s3")]
    )
    second_digest = write_expression_table(
        tmp_path, "second.tsv", [("b", 7, "t1")]
    )
    # This valid-looking table is deliberately not selected by the manifest.
    write_expression_table(tmp_path, "ignored.tsv", [("a", 999, "ignored")])
    manifest = [
        expression_source("first.tsv", "expression", first_digest),
        expression_source("second.tsv", "tssInitiation", second_digest),
    ]
    (tmp_path / "sources.json").write_text(json.dumps(manifest), encoding="utf-8")

    sources, values = load_expression_sources(tmp_path)

    assert [source["id"] for source in sources] == ["EXPRESSION", "TSSINITIATION"]
    assert values == {
        "expression": {"a": 10.0, "b": 20.0, "c": 20.0},
        "tssInitiation": {"b": 7.0},
    }
    assert values["expression"].get("a") == 10
    assert values["tssInitiation"].get("a") is None
    assert expression_percentiles(values["expression"]) == {
        "a": pytest.approx(1 / 3),
        "b": pytest.approx(5 / 6),
        "c": pytest.approx(5 / 6),
    }


def test_expression_manifest_is_required(tmp_path):
    with pytest.raises(ValueError, match="source manifest is missing"):
        load_expression_sources(tmp_path)


def test_expression_manifest_rejects_a_missing_listed_file(tmp_path):
    manifest = [expression_source("missing.tsv", "expression", "0" * 64)]
    (tmp_path / "sources.json").write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(ValueError, match="listed in sources.json is missing"):
        load_expression_sources(tmp_path)


def test_expression_manifest_rejects_a_checksum_mismatch(tmp_path):
    write_expression_table(tmp_path, "source.tsv", [("a", 10, "s1")])
    manifest = [expression_source("source.tsv", "expression", "0" * 64)]
    (tmp_path / "sources.json").write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(ValueError, match="checksum mismatch for source.tsv"):
        load_expression_sources(tmp_path)


def test_expression_manifest_rejects_a_metric_key_collision(tmp_path):
    digest = write_expression_table(tmp_path, "source.tsv", [("a", 10, "s1")])
    manifest = [expression_source("source.tsv", "cai", digest)]
    (tmp_path / "sources.json").write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(ValueError, match="metricKey collision: cai"):
        load_expression_sources(tmp_path, {"cai"})


def test_expression_proxy_is_a_tie_aware_zero_to_one_cai_tai_rank():
    genes = [
        {"id": "low", "cai": 0.25, "tai": 0.25},
        {"id": "middle-a", "cai": 0.5, "tai": 0.5},
        {"id": "middle-b", "cai": 1.0, "tai": 0.25},
        {"id": "high", "cai": 1.0, "tai": 1.0},
    ]
    assert expression_proxy_scores(genes) == {
        "low": 0.0,
        "middle-a": pytest.approx(0.5),
        "middle-b": pytest.approx(0.5),
        "high": 1.0,
    }


def test_codon_occurrences_exclude_only_position_zero_from_editable_counts():
    counts = codon_occurrences(["GTGTTGTAA", "TTGGTGTAG"])
    assert counts["GTG"] == {"total": 2, "editable": 1}
    assert counts["TTG"] == {"total": 2, "editable": 1}
    assert counts["TAA"] == {"total": 1, "editable": 1}
    assert counts["TAG"] == {"total": 1, "editable": 1}


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


def test_context_wraps_around_circular_replicons():
    genes = [
        {
            "id": "first",
            "seqid": "s",
            "start": 20,
            "end": 30,
            "strand": "+",
            "_contextStart": 20,
            "_contextEnd": 30,
        },
        {
            "id": "middle",
            "seqid": "s",
            "start": 200,
            "end": 210,
            "strand": "-",
            "_contextStart": 200,
            "_contextEnd": 210,
        },
        {
            "id": "wrapped",
            "seqid": "s",
            "start": 1,
            "end": 1000,
            "strand": "+",
            "_contextStart": 900,
            "_contextEnd": 1010,
        },
    ]
    add_context(genes, {"s": 1000})
    by_id = {gene["id"]: gene for gene in genes}
    assert by_id["wrapped"]["neighborDownstreamNt"] == 9
    assert by_id["first"]["neighborUpstreamNt"] == 9
    assert all(gene["neighborUpstreamNt"] is not None for gene in genes)
    assert all(gene["neighborDownstreamNt"] is not None for gene in genes)
