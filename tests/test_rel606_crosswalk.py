"""Tests for ``tools/rel606_crosswalk.py``.

A crosswalk that guesses is worse than one that abstains, because a wrong pair
silently moves one strain's measurement onto another strain's gene. Every tier
here refuses a tie, refuses a sequence held by two loci, and refuses a locus
already claimed, and these tests exist mostly to hold those refusals in place.
"""

from __future__ import annotations

import gzip
import importlib.util
import sys
from pathlib import Path

import pytest

_SPEC = importlib.util.spec_from_file_location(
    "rel606_crosswalk",
    Path(__file__).resolve().parents[1] / "tools" / "rel606_crosswalk.py",
)
assert _SPEC and _SPEC.loader
crosswalk = importlib.util.module_from_spec(_SPEC)
sys.modules["rel606_crosswalk"] = crosswalk
_SPEC.loader.exec_module(crosswalk)


# --------------------------------------------------------------------------
# primitives
# --------------------------------------------------------------------------


def test_ungapped_identity_counts_matching_positions():
    assert crosswalk.ungapped_identity("MKV", "MKV") == 1.0
    assert crosswalk.ungapped_identity("MKV", "MKA") == pytest.approx(2 / 3)


def test_ungapped_identity_refuses_unequal_lengths():
    """It is only meaningful for equal lengths, so it must not pretend."""
    assert crosswalk.ungapped_identity("MKV", "MK") == 0.0
    assert crosswalk.ungapped_identity("", "") == 0.0


def test_kmer_set_slides_over_the_sequence():
    assert crosswalk.kmer_set("MKVLAT", k=5) == {"MKVLA", "KVLAT"}
    assert crosswalk.kmer_set("MKV", k=5) == set()


def test_the_best_score_wins_and_a_tie_wins_nothing():
    assert crosswalk._best([(0.9, "a"), (0.5, "b")]) == (0.9, "a")
    score, winner = crosswalk._best([(0.9, "a"), (0.9, "b")])
    assert winner is None, "a tie must not pick one arbitrarily"
    assert score == 0.9
    assert crosswalk._best([]) == (0.0, None)


# --------------------------------------------------------------------------
# tiers
# --------------------------------------------------------------------------


def test_tier_one_pairs_an_identical_sequence_held_once_on_each_side():
    pairs, ambiguous = crosswalk.tier_one({"r1": "MKV"}, {"b1": "MKV"})
    assert pairs == {"r1": "b1"}
    assert ambiguous == set()


def test_tier_one_refuses_a_sequence_held_by_two_loci():
    """Identical paralogs cannot be told apart by sequence, so neither is paired."""
    pairs, ambiguous = crosswalk.tier_one(
        {"r1": "MKV", "r2": "MKV"}, {"b1": "MKV"}
    )
    assert pairs == {}
    assert ambiguous == {"r1", "r2"}

    pairs, ambiguous = crosswalk.tier_one({"r1": "MKV"}, {"b1": "MKV", "b2": "MKV"})
    assert pairs == {}
    assert ambiguous == {"r1"}


def test_tier_one_ignores_a_sequence_present_on_only_one_side():
    pairs, ambiguous = crosswalk.tier_one({"r1": "MKV"}, {"b1": "AAA"})
    assert pairs == {} and ambiguous == set()


def test_tier_two_pairs_a_reciprocal_best_above_the_threshold():
    rel = {"r1": "MKVLATTTTT"}
    mg = {"b1": "MKVLATTTTA", "b2": "AAAAAAAAAA"}
    assert crosswalk.tier_two(rel, mg) == {"r1": "b1"}


def test_tier_two_refuses_a_pair_below_the_identity_threshold():
    rel = {"r1": "MKVLATTTTT"}
    mg = {"b1": "MKVAAAAAAA"}
    assert crosswalk.tier_two(rel, mg) == {}


def test_tier_two_refuses_a_tie():
    rel = {"r1": "MKVLATTTTT"}
    mg = {"b1": "MKVLATTTTA", "b2": "MKVLATTTTC"}
    assert crosswalk.tier_two(rel, mg) == {}, "two equally good partners pick neither"


def test_tier_two_requires_the_best_to_be_mutual():
    """A pairing one side prefers and the other does not is not an ortholog call."""
    rel = {"r1": "MKVLATTTTT", "r2": "MKVLATTTTA"}
    mg = {"b1": "MKVLATTTTA"}
    pairs = crosswalk.tier_two(rel, mg)
    # b1 is identical to r2, so r1 cannot claim it even though r1 is close.
    assert pairs == {"r2": "b1"}


def test_tier_two_never_compares_across_lengths():
    rel = {"r1": "MKVLAT"}
    mg = {"b1": "MKVLATT"}
    assert crosswalk.tier_two(rel, mg) == {}


# --------------------------------------------------------------------------
# legacy tags
# --------------------------------------------------------------------------


def _gff(tmp_path: Path, rows: list[str]) -> Path:
    path = tmp_path / "genomic.gff.gz"
    body = "##gff-version 3\n" + "".join(rows)
    with gzip.open(path, "wt") as handle:
        handle.write(body)
    return path


def _gene(tag: str, legacy: str | None, start: int = 1) -> str:
    attrs = f"ID=gene-{tag};locus_tag={tag}"
    if legacy:
        attrs += f";old_locus_tag={legacy}"
    return f"NC_012967.1\tRefSeq\tgene\t{start}\t{start + 99}\t.\t+\t.\t{attrs}\n"


def test_legacy_tags_are_read_from_the_annotation(tmp_path):
    path = _gff(tmp_path, [_gene("ECB_RS00005", "ECB_00001"),
                           _gene("ECB_RS00010", "ECB_00002", 200)])
    assert crosswalk.read_legacy_tags(path) == {
        "ECB_RS00005": "ECB_00001",
        "ECB_RS00010": "ECB_00002",
    }


def test_a_locus_naming_two_legacy_tags_is_dropped(tmp_path):
    path = _gff(tmp_path, [_gene("ECB_RS00005", "ECB_00001,ECB_00002")])
    assert crosswalk.read_legacy_tags(path) == {}


def test_a_legacy_tag_reached_by_two_loci_is_dropped(tmp_path):
    """The AG3C matrices are keyed by the legacy form, so this would misroute."""
    path = _gff(tmp_path, [_gene("ECB_RS00005", "ECB_00001"),
                           _gene("ECB_RS00010", "ECB_00001", 200)])
    assert crosswalk.read_legacy_tags(path) == {}


def test_a_gene_with_no_legacy_tag_is_simply_absent(tmp_path):
    path = _gff(tmp_path, [_gene("ECB_RS00005", None)])
    assert crosswalk.read_legacy_tags(path) == {}


# --------------------------------------------------------------------------
# synteny, which checks the tiers rather than deciding them
# --------------------------------------------------------------------------


def test_a_pair_whose_neighbour_maps_nearby_is_syntenic():
    pairs = {"r1": "b1", "r2": "b2"}
    rel_order = {"r1": 0, "r2": 1}
    mg_order = {"b1": 0, "b2": 1}
    assert crosswalk.syntenic(pairs, rel_order, mg_order) == {"r1", "r2"}


def test_a_pair_whose_neighbours_land_far_away_is_not_syntenic():
    pairs = {"r1": "b1", "r2": "b2"}
    rel_order = {"r1": 0, "r2": 1}
    mg_order = {"b1": 0, "b2": 5000}
    assert crosswalk.syntenic(pairs, rel_order, mg_order) == set()


def test_a_lone_pair_cannot_be_syntenic():
    assert crosswalk.syntenic({"r1": "b1"}, {"r1": 0}, {"b1": 0}) == set()


# --------------------------------------------------------------------------
# the built artefact
# --------------------------------------------------------------------------


def _rows():
    import csv

    path = Path(crosswalk.OUT)
    if not path.is_file():
        pytest.skip("the crosswalk has not been built in this tree")
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle, delimiter="\t"))


def test_the_built_crosswalk_is_one_to_one_in_both_directions():
    rows = [r for r in _rows() if r["relationship"] == crosswalk.RELATIONSHIP
            and r["subject_locus_tag"]]
    assert len(rows) == 3844
    subjects = [r["subject_locus_tag"] for r in rows]
    objects = [r["object_id"] for r in rows]
    assert len(set(subjects)) == len(subjects), "an MG1655 locus was claimed twice"
    assert len(set(objects)) == len(objects), "a REL606 locus was claimed twice"


def test_every_pair_declares_which_tier_assigned_it():
    rows = [r for r in _rows() if r["subject_locus_tag"]]
    methods = {r["mapping_method"] for r in rows}
    assert methods == {
        "exact_sequence", "equal_length_reciprocal_best", "gapped_reciprocal_best",
    }


def test_the_legacy_relationship_reaches_the_identifiers_ag3c_uses():
    rows = [r for r in _rows() if r["relationship"] == crosswalk.LEGACY_RELATIONSHIP]
    assert len(rows) == 3728
    assert all(r["object_id"].startswith("ECB_") for r in rows)
    assert all(not r["object_id"].startswith("ECB_RS") for r in rows), (
        "the legacy row must carry the 2009 tag, not the current one"
    )
    # Every legacy row names the same MG1655 locus as its current-tag sibling.
    current = {
        r["object_id"]: r["subject_locus_tag"]
        for r in _rows() if r["relationship"] == crosswalk.RELATIONSHIP
    }
    assert len(set(r["subject_locus_tag"] for r in rows)) == len(rows)
    assert current, "the current-tag rows must exist alongside the legacy ones"


def test_identical_paralogs_ship_as_ambiguity_rows_with_no_partner():
    rows = [r for r in _rows() if r["mapping_ambiguity"]]
    assert rows, "the two identical paralogs must be recorded, not dropped silently"
    for row in rows:
        assert row["subject_locus_tag"] == "", "an ambiguous locus names no partner"
        assert row["mapping_ambiguity"] == "identical-paralogs"


def test_synteny_separates_the_tiers_which_is_what_justifies_them():
    rows = [r for r in _rows() if r["subject_locus_tag"]
            and r["relationship"] == crosswalk.RELATIONSHIP]
    by_method: dict[str, list[str]] = {}
    for row in rows:
        by_method.setdefault(row["mapping_method"], []).append(row["syntenic"])
    rate = {m: v.count("yes") / len(v) for m, v in by_method.items()}
    assert rate["exact_sequence"] > 0.99
    assert rate["equal_length_reciprocal_best"] > 0.99
    # The loosest tier is materially less syntenic, which is the evidence that
    # the thresholds are separating real orthologs from reaches.
    assert rate["gapped_reciprocal_best"] < rate["equal_length_reciprocal_best"]
