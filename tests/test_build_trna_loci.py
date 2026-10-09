"""Contracts for the compact UTEX 2973 tRNA viewer payload."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import build_trna_loci as build  # noqa: E402


def test_locus_sequence_uses_inclusive_coordinates_and_transcription_orientation():
    genome = {"chr": "AACCGGTT"}
    assert build.locus_sequence(
        genome, {"seqid": "chr", "start": 2, "end": 5, "strand": "+"}
    ) == "ACCG"
    assert build.locus_sequence(
        genome, {"seqid": "chr", "start": 2, "end": 5, "strand": "-"}
    ) == "CGGT"


def test_locus_sequence_refuses_unknown_or_out_of_range_coordinates():
    with pytest.raises(build.TrnaPayloadError, match="unknown replicon"):
        build.locus_sequence(
            {"chr": "AAAA"}, {"seqid": "other", "start": 1, "end": 4, "strand": "+"}
        )
    with pytest.raises(build.TrnaPayloadError, match="extends beyond"):
        build.locus_sequence(
            {"chr": "AAAA"}, {"seqid": "chr", "start": 3, "end": 8, "strand": "+"}
        )


@pytest.mark.skipif(
    not build.DEFAULT_FASTA.exists(),
    reason="requires the pinned genome fetched into data/raw",
)
def test_published_payload_is_reproducible_and_preserves_all_locus_contracts():
    expected = json.loads(build.DEFAULT_OUTPUT.read_text(encoding="utf-8"))
    actual = build.build_payload(build.DEFAULT_COMPARISON, build.DEFAULT_FASTA, build.RUN_OUTPUT)
    assert actual == expected
    assert actual["counts"] == {"annotated": 44, "predictedCandidates": 1, "totalRecords": 45}
    assert all(len(row["sequence"]) == row["lengthNt"] for row in actual["loci"])
    assert {row["strand"] for row in actual["loci"]} == {"+", "-"}
    assert len({row["id"] for row in actual["loci"]}) == 45
    candidate = next(row for row in actual["loci"] if row["kind"] == "scan-only-candidate")
    assert candidate["locusTag"] is None
    assert candidate["pseudo"] is True
    assert candidate["scanIsotype"] == "Undet"
    assert candidate["scanAnticodon"] == "NNN"
    assert candidate["id"].endswith("NZ_CP006471.1:2275064-2275124:+")
    ile2 = next(row for row in actual["loci"] if row["scanIsotype"] == "Ile2")
    assert ile2["refseqAnticodon"] == "CAT"
    assert ile2["modelEffectiveAnticodon"] == "LAT"
    assert any(row["scanIsotype"] == "fMet" for row in actual["loci"])
