"""Tests for ``tools/ingest_ecoli_expression.py``.

The two things worth protecting are the coordinate rule and the grouping. The
rule is strand-aware because the counting tool extends the three-prime end, and
getting that backwards silently halves the join rather than failing. The
grouping must drop the characteristic that names the assay, or every condition
splits in two and the two layers stop looking like one experiment.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

_SPEC = importlib.util.spec_from_file_location(
    "ingest_ecoli_expression",
    Path(__file__).resolve().parents[1] / "tools" / "ingest_ecoli_expression.py",
)
assert _SPEC and _SPEC.loader
ingest = importlib.util.module_from_spec(_SPEC)
sys.modules["ingest_ecoli_expression"] = ingest
_SPEC.loader.exec_module(ingest)


def test_a_single_segment_region_parses_to_its_span_and_strand():
    assert ingest.parse_region("chr:189-258(+)") == ([(189, 258)], "+")
    assert ingest.parse_region("chr:5679-6459(-)") == ([(5679, 6459)], "-")


def test_a_multi_segment_region_keeps_every_segment():
    segments, strand = ingest.parse_region("chr:257828-257907^258675-259009(+)")
    assert segments == [(257828, 257907), (258675, 259009)]
    assert strand == "+"
    segments, strand = ingest.parse_region(
        "chr:1465391-1467904^1469240-1469293^1470516-1474016(+)"
    )
    assert len(segments) == 3
    assert strand == "+"


@pytest.mark.parametrize("region", ["189-258(+)", "chr:189-258", "chr:abc-def(+)", ""])
def test_an_unreadable_region_is_refused_rather_than_guessed(region):
    with pytest.raises(ValueError):
        ingest.parse_region(region)


def test_the_plus_strand_rule_trims_the_three_prime_end_at_the_high_coordinate():
    # thrL is the first gene: the counting tool reports chr:189-258(+) for a
    # gene the assembly places at 190..255.
    assert ingest.gene_span([(189, 258)], "+") == (190, 255, "+")


def test_the_minus_strand_rule_trims_the_other_end():
    """The three-prime end of a minus-strand gene is its low coordinate.

    Applying the plus-strand rule to both strands joins only the plus strand,
    which looks like a 50% join rather than like a bug.
    """
    assert ingest.gene_span([(5679, 6459)], "-") == (5683, 6459, "-")


def test_a_multi_segment_region_uses_its_outer_span():
    assert ingest.gene_span([(100, 200), (300, 400)], "+") == (101, 397, "+")
    assert ingest.gene_span([(100, 200), (300, 400)], "-") == (104, 400, "-")


def test_grouping_drops_the_assay_characteristic_and_keeps_the_biology():
    def sample(subtype, treatment, replicate):
        return {
            "accession": f"GSM{replicate}",
            "title": f"{treatment} rep{replicate}",
            "file": f"{treatment}-{replicate}.gz",
            "attrs": {
                "strain": "NCM3722",
                "treatment": treatment,
                ingest.ASSAY_CHARACTERISTIC: subtype,
            },
        }

    samples = [
        sample("total mRNA", "carbon limitation", 1),
        sample("total mRNA", "carbon limitation", 2),
        sample("ribosome protected mRNA", "carbon limitation", 1),
        sample("ribosome protected mRNA", "carbon limitation", 2),
        sample("total mRNA", "nitrogen limitation", 1),
    ]
    groups = ingest.group_samples(samples)
    # One biological condition yields two groups, one per assay, and the two
    # share their biology key.
    assert len(groups) == 3
    biology = {key[0] for key in groups}
    assert len(biology) == 2, "two conditions, not four"
    sizes = sorted(len(v) for v in groups.values())
    assert sizes == [1, 2, 2]


def test_an_unknown_molecule_subtype_is_refused():
    samples = [{
        "accession": "GSM1", "title": "t", "file": "f",
        "attrs": {ingest.ASSAY_CHARACTERISTIC: "something else"},
    }]
    with pytest.raises(ValueError, match="unknown molecule subtype"):
        ingest.group_samples(samples)


def test_both_assays_are_recognised_and_named_apart():
    kinds = {v[0] for v in ingest.ASSAY_BY_SUBTYPE.values()}
    assert kinds == {"transcript", "translation"}
    suffixes = {v[1] for v in ingest.ASSAY_BY_SUBTYPE.values()}
    assert suffixes == {"RNA", "FP"}


def test_a_span_claimed_by_two_genes_is_claimed_by_neither(tmp_path):
    """Coordinates cannot tell two genes on one span apart, so neither wins."""
    import json

    path = tmp_path / "genes.json"
    path.write_text(json.dumps([
        {"id": "b0001", "start": 190, "end": 255, "strand": "+"},
        {"id": "b9999", "start": 190, "end": 255, "strand": "+"},
        {"id": "b0002", "start": 337, "end": 2799, "strand": "+"},
    ]))
    spans = ingest.load_gene_spans(path)
    assert (190, 255, "+") not in spans
    assert spans[(337, 2799, "+")] == "b0002"


def test_the_shipped_layers_are_paired_and_internally_uniform():
    """What the tool actually wrote, read back from the repository."""
    import json

    manifest = Path(ingest.OUT_DIR) / "sources.json"
    if not manifest.is_file():
        pytest.skip("the E. coli layers have not been built in this tree")
    # The manifest now carries other studies too, so scope to this one.
    sources = [
        s for s in json.loads(manifest.read_text(encoding="utf-8"))
        if s["record"]["studyId"] == "GSE182100"
    ]
    assert len(sources) == 24

    platforms = {s["record"]["platform"] for s in sources}
    assert platforms == {"RNA-seq", "Ribo-seq"}
    by_platform = {p: [s for s in sources if s["record"]["platform"] == p] for p in platforms}
    assert len(by_platform["RNA-seq"]) == len(by_platform["Ribo-seq"]) == 12

    # Every condition carries both layers, which is the whole point of the series.
    conditions = {p: {s["record"]["conditionSet"] for s in rows}
                  for p, rows in by_platform.items()}
    assert conditions["RNA-seq"] == conditions["Ribo-seq"]
    assert len(conditions["RNA-seq"]) == 12

    for source in sources:
        assert source["record"]["strain"] == "NCM3722"
        assert source["record"]["basis"] == "transferred"
        assert source["isTargetOrganism"] is False
        assert source["record"]["replicates"]["count"] == 3
        assert source["ingest"]["mappedGenes"] == 4110
        assert source["ingest"]["unmappedIdentifiers"] == 0
        assert "no ortholog crosswalk" in source["ingest"]["mappingRoute"]
        assert "not the" in source["caveat"] and "MG1655" in source["caveat"]
        assert source["signed"] is False
        assert source["payload"] == "expression_layers.json"


def test_a_footprint_layer_never_claims_to_be_protein_abundance():
    import json

    manifest = Path(ingest.OUT_DIR) / "sources.json"
    if not manifest.is_file():
        pytest.skip("the E. coli layers have not been built in this tree")
    sources = [
        s for s in json.loads(manifest.read_text(encoding="utf-8"))
        if s["record"]["studyId"] == "GSE182100"
    ]
    footprints = [s for s in sources if s["record"]["platform"] == "Ribo-seq"]
    assert footprints
    for source in footprints:
        assert source["assay"] == "ribosome profiling"
        assert "occupancy" in source["label"].lower()
        assert "not protein abundance" in source["caveat"]
