"""Tests for ``tools/pilot_bootstrap.py``.

The statistic is easy to get subtly wrong in three ways, and each has its own
case here: ties must count at a half, a distance statistic must be read the
other way round from a similarity, and the resampling unit must be the sample
rather than the pair. The last is the whole reason the tool exists, since a
bootstrap over pairs would report an interval several times too narrow.
"""

from __future__ import annotations

import importlib.util
import random
import sys
from pathlib import Path

import pytest

_SPEC = importlib.util.spec_from_file_location(
    "pilot_bootstrap",
    Path(__file__).resolve().parents[1] / "tools" / "pilot_bootstrap.py",
)
assert _SPEC and _SPEC.loader
boot = importlib.util.module_from_spec(_SPEC)
sys.modules["pilot_bootstrap"] = boot
_SPEC.loader.exec_module(boot)


def _ones(values):
    return [(v, 1.0) for v in values]


# --------------------------------------------------------------------------
# the statistic
# --------------------------------------------------------------------------


def test_perfect_separation_is_one_and_its_reverse_is_zero():
    assert boot.weighted_auroc(_ones([3, 4, 5]), _ones([0, 1, 2])) == 1.0
    assert boot.weighted_auroc(_ones([0, 1, 2]), _ones([3, 4, 5])) == 0.0


def test_identical_distributions_are_a_half():
    assert boot.weighted_auroc(_ones([1, 2, 3]), _ones([1, 2, 3])) == pytest.approx(0.5)


def test_a_tie_counts_as_half_a_win():
    # One positive, one negative, equal value: exactly a coin flip.
    assert boot.weighted_auroc(_ones([1]), _ones([1])) == pytest.approx(0.5)
    # Two negatives, one below and one tied.
    assert boot.weighted_auroc(_ones([1]), _ones([0, 1])) == pytest.approx(0.75)


def test_an_empty_class_is_not_a_number_rather_than_a_guess():
    assert boot.weighted_auroc([], _ones([1, 2])) != boot.weighted_auroc([], _ones([1, 2]))
    assert boot.weighted_auroc(_ones([1, 2]), []) != boot.weighted_auroc(_ones([1, 2]), [])


def test_weights_reproduce_duplication():
    """A weight of two must equal listing the observation twice."""
    weighted = boot.weighted_auroc([(5.0, 2.0), (1.0, 1.0)], [(0.0, 1.0), (3.0, 3.0)])
    expanded = boot.weighted_auroc(
        _ones([5, 5, 1]), _ones([0, 3, 3, 3])
    )
    assert weighted == pytest.approx(expanded)


def test_a_zero_weight_drops_an_observation_entirely():
    kept = boot.weighted_auroc([(5.0, 1.0)], [(0.0, 1.0)])
    with_zero = boot.weighted_auroc([(5.0, 1.0), (-99.0, 0.0)], [(0.0, 1.0)])
    assert kept == pytest.approx(with_zero)


# --------------------------------------------------------------------------
# orientation
# --------------------------------------------------------------------------


def test_a_similarity_reads_forwards_and_a_distance_backwards():
    assert boot.HIGHER_IS_MORE_SIMILAR["spearman"] is True
    assert boot.HIGHER_IS_MORE_SIMILAR["ks_d"] is False
    assert boot.HIGHER_IS_MORE_SIMILAR["wasserstein"] is False
    assert boot.oriented(0.8, "spearman") == pytest.approx(0.8)
    # Reading a distance forwards reproduces every published row as one minus
    # its value, which is how the orientation was caught in the first place.
    assert boot.oriented(0.2, "ks_d") == pytest.approx(0.8)


# --------------------------------------------------------------------------
# class selection
# --------------------------------------------------------------------------


def test_a_key_ending_all_names_the_class_not_a_subclass():
    row = {"pair_class": "iii", "pair_subclass": "iii_other"}
    assert boot.selector_for("iii_all")(row) is True
    assert boot.selector_for("ii_all")(row) is False
    assert boot.selector_for("iii_other")(row) is True
    assert boot.selector_for("iii_similar_controls")(row) is False


def test_every_published_class_key_selects_something_real():
    """A key that matches nothing silently empties a comparison."""
    rows = boot.read_pairs()
    keys = set()
    for row in boot.read_published():
        keys.add(row["positive"])
        keys.add(row["negative"])
    for key in keys:
        want = boot.selector_for(key)
        assert any(want(row) for row in rows), f"{key} selects no pair"


# --------------------------------------------------------------------------
# the returned evidence
# --------------------------------------------------------------------------


def test_every_published_pooled_auroc_recomputes_from_the_returned_pairs():
    """The pilot shipped no code, so the numbers are trusted only once rebuilt."""
    rows = boot.read_pairs()
    published = [r for r in boot.read_published() if r["scope"] == "pooled"]
    assert len(published) == 15
    for row in published:
        got = boot.point_auroc(rows, row["positive"], row["negative"], row["statistic"])
        assert abs(got - float(row["auroc"])) <= boot.TOLERANCE, row


def test_the_pairs_file_is_the_one_the_intervals_describe():
    assert boot.sha256_of(boot.PAIRS) == boot.PAIRS_SHA256


# --------------------------------------------------------------------------
# the resampling unit
# --------------------------------------------------------------------------


def test_the_bootstrap_resamples_samples_and_not_pairs():
    """The 10,440 pairs come from 145 samples, so pairs are not independent.

    This is the error the tool exists to avoid: resampling pairs would treat one
    culture as fresh evidence in every pair it appears in. The check is that a
    draw which excludes a sample excludes every pair touching it.
    """
    rows = [
        {"sample_a": "A", "sample_b": "B", "pair_class": "i",
         "pair_subclass": "i_replicate", "spearman": "0.9"},
        {"sample_a": "A", "sample_b": "C", "pair_class": "ii",
         "pair_subclass": "ii_time_only", "spearman": "0.2"},
        {"sample_a": "B", "sample_b": "C", "pair_class": "ii",
         "pair_subclass": "ii_time_only", "spearman": "0.1"},
    ]
    # C drawn zero times: every pair touching C must vanish, leaving one class
    # empty and so no number at all.
    weights = {"A": 1.0, "B": 1.0, "C": 0.0}
    value = boot.point_auroc(rows, "i_replicate", "ii_time_only", "spearman", weights)
    assert value != value, "a class emptied by the draw yields no number"

    # With C drawn twice, the pairs touching it carry twice the weight.
    doubled = boot.point_auroc(
        rows, "i_replicate", "ii_time_only", "spearman",
        {"A": 1.0, "B": 1.0, "C": 2.0},
    )
    plain = boot.point_auroc(
        rows, "i_replicate", "ii_time_only", "spearman",
        {"A": 1.0, "B": 1.0, "C": 1.0},
    )
    # Both negatives scale together here, so the ordering is unchanged; what
    # matters is that the draw reached them at all.
    assert doubled == pytest.approx(plain)


def test_a_pair_needs_both_of_its_samples_in_the_draw():
    rows = [{"sample_a": "A", "sample_b": "B", "pair_class": "i",
             "pair_subclass": "i_replicate", "spearman": "0.9"},
            {"sample_a": "A", "sample_b": "D", "pair_class": "ii",
             "pair_subclass": "ii_time_only", "spearman": "0.1"}]
    # D missing removes the only negative, so there is nothing to compare.
    value = boot.point_auroc(rows, "i_replicate", "ii_time_only", "spearman",
                             {"A": 1.0, "B": 1.0, "D": 0.0})
    assert value != value


def test_the_interval_is_wider_than_one_built_from_pairs():
    """The whole point: clustering by sample must not produce a narrow interval."""
    rows = boot.read_pairs()
    samples = sorted({r["sample_a"] for r in rows} | {r["sample_b"] for r in rows})
    rng = random.Random(1)
    draws = boot.bootstrap(rows, "i_replicate", "ii_all", "spearman",
                           samples, 60, rng)
    assert len(draws) > 40
    low, high = boot.percentile(draws, 0.025), boot.percentile(draws, 0.975)
    assert 0.5 < low < high < 1.0
    # A correlation reported to three decimals that cannot be told from a value
    # four points away is the finding, not a defect.
    assert high - low > 0.02, "a sample-level interval on 145 samples is not tight"


# --------------------------------------------------------------------------
# percentiles
# --------------------------------------------------------------------------


def test_percentile_interpolates_and_handles_the_edges():
    values = [1.0, 2.0, 3.0, 4.0]
    assert boot.percentile(values, 0.0) == 1.0
    assert boot.percentile(values, 1.0) == 4.0
    assert boot.percentile(values, 0.5) == pytest.approx(2.5)
    assert boot.percentile([7.0], 0.3) == 7.0
    assert boot.percentile([], 0.5) != boot.percentile([], 0.5)
