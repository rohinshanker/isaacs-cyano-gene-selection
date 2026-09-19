"""The site consumes the pinned annotation release without semantic invention."""

from pathlib import Path
import json
import sys

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from build_features import load_annotation_layer  # noqa: E402


RELEASE = (
    ROOT
    / "data/annotation/releases/GCF_000817325.1-RS_2026_05_13"
)


def site_loci() -> set[str]:
    """Returns the exact protein-coding locus set published by the site."""
    genes = json.loads((ROOT / "site/data/genes.json").read_text(encoding="utf-8"))
    return {gene["id"] for gene in genes}


def test_release_layer_covers_every_site_gene_and_preserves_relationships():
    evidence, metadata = load_annotation_layer(RELEASE, site_loci())
    published = json.loads(
        (ROOT / "site/data/annotations.json").read_text(encoding="utf-8")
    )
    site_meta = json.loads(
        (ROOT / "site/data/meta.json").read_text(encoding="utf-8")
    )

    assert len(evidence) == 2715
    assert published == evidence
    assert site_meta["annotationRelease"] == metadata
    assert metadata["releaseId"] == "GCF_000817325.1-RS_2026_05_13"
    assert metadata["coverage"] == {
        "siteGenes": 2715,
        "withAnnotationEvidence": 2715,
        "withGoAnnotations": 1584,
        "goRelationships": 3898,
    }
    assert evidence["M744_RS00035"]["overlappingCds"] == [
        {"locusTag": "M744_RS00040", "overlapNt": 46}
    ]
    assert evidence["M744_RS00065"]["nearbyNoncodingRnas"] == [
        {"biotype": "tRNA", "distanceNt": 8, "locusTag": "M744_RS00070"}
    ]
    assert all(
        row["evidenceCode"] == "IEA"
        for record in evidence.values()
        for row in record["goAnnotations"]
    )


def test_release_layer_refuses_a_site_locus_without_evidence():
    with pytest.raises(ValueError, match="missing included loci: NOT_A_LOCUS"):
        load_annotation_layer(RELEASE, {"M744_RS00005", "NOT_A_LOCUS"})
