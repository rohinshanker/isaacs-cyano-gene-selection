"""Whole-genome invariants and independent cross-validation."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from validate_features import RAW_DEFAULT, validate


DATA = Path(__file__).resolve().parents[1] / "site/data"


def test_generated_documents_follow_contract():
    genes = json.loads((DATA / "genes.json").read_text())
    meta = json.loads((DATA / "meta.json").read_text())
    pca = json.loads((DATA / "codon_pca.json").read_text())
    excluded = json.loads((DATA / "excluded.json").read_text())
    assert 2650 <= len(genes) <= 2725
    assert len(genes) == meta["geneCount"]
    assert len(genes) + len(excluded) == 2722
    assert len(meta["codonAlphabet"]) == 64
    assert len(meta["rscuOrder"]) == 59
    assert meta["expressionSource"]["coverage"] == {
        "withValue": 2551,
        "total": 2715,
    }
    assert meta["expressionSource"]["isTargetOrganism"] is False
    assert meta["tai"]["tRNAGeneCopies"]["LAT"] == 1
    assert pca["nComponents"] == 6
    assert len(pca["loadings"]) == 59
    required = {
        "gc", "gc1", "gc2", "gc3", "a3", "t3", "g3", "c3", "enc",
        "encExpected", "deltaEnc", "cai", "tai", "rareFraction", "rareCount",
        "longestRareRun", "rampRareCount", "minLocalTai", "cps",
        "underrepresentedPairFraction", "mfeStart", "mfeFirst100", "minLocalGc",
        "maxLocalGc", "gc5prime", "neighborUpstreamNt", "neighborDownstreamNt",
        "overlapsNeighbor", "operonId", "operonPosition", "operonSize", "rscu",
        "expression", "expressionPercentile", "codonPca", "riskUmap", "codons",
    }
    assert required <= genes[0].keys()
    measured = [gene for gene in genes if gene["expression"] is not None]
    assert len(measured) == 2551
    assert all(gene["expressionPercentile"] is not None for gene in measured)
    assert all(
        gene["expressionPercentile"] is None
        for gene in genes
        if gene["expression"] is None
    )


def test_whole_genome_round_trip_translation_and_independent_metrics():
    result = validate(RAW_DEFAULT, DATA, sample_size=30)
    assert result["geneCount"] + result["excludedCount"] == 2722
    for metric in ("enc", "cai", "tai", "rscu"):
        assert result[f"{metric}Correlation"] > 0.999999
        assert result[f"{metric}MaxAbsoluteDeviation"] < 1e-5
