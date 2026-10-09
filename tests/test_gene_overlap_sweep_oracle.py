"""Independently check interval overlaps against finite genomic base sets."""
from __future__ import annotations

import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import build_gene_overlaps  # noqa: E402


def test_segment_sweep_matches_exhaustive_base_intersections() -> None:
    """Cover dense, contained, repeated, stranded and separate-replicon pieces."""
    random_source = random.Random(20261009)
    for case in range(1000):
        records = []
        for index in range(random_source.randrange(21)):
            segments = []
            for _ in range(random_source.randrange(1, 6)):
                first, last = sorted(
                    [random_source.randrange(1, 81), random_source.randrange(1, 81)]
                )
                segments.append((first, last))
            records.append({
                "id": str(index),
                "seqid": random_source.choice(["chromosome", "plasmid"]),
                "strand": random_source.choice(["+", "-"]),
                "segments": segments,
            })

        occupied = [
            {base for first, last in row["segments"] for base in range(first, last + 1)}
            for row in records
        ]
        expected = {}
        for first in range(len(records)):
            for second in range(first + 1, len(records)):
                if records[first]["seqid"] != records[second]["seqid"]:
                    continue
                intersection = occupied[first] & occupied[second]
                if intersection:
                    expected[first, second] = intersection

        result = build_gene_overlaps.overlap_pairs(records)
        actual = {}
        for first, second, segments in result:
            assert first < second, (case, "self/reversed pair")
            assert (first, second) not in actual, (case, "duplicate pair")
            assert segments, (case, "empty overlap")
            assert all(low <= high for low, high in segments), case
            assert all(
                left[1] + 1 < right[0]
                for left, right in zip(segments, segments[1:])
            ), (case, "noncanonical intervals")
            actual[first, second] = {
                base for low, high in segments for base in range(low, high + 1)
            }
        assert actual == expected, (case, records)
