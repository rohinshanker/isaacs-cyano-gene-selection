"""Whole-genome invariants and independent cross-validation."""

import collections
import gzip
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import feature_metrics as fm
from validate_features import RAW_DEFAULT, validate


DATA = Path(__file__).resolve().parents[1] / "site/data"


def test_generated_documents_follow_contract():
    genes = json.loads((DATA / "genes.json").read_text())
    meta = json.loads((DATA / "meta.json").read_text())
    pca = json.loads((DATA / "codon_pca.json").read_text())
    excluded = json.loads((DATA / "excluded.json").read_text())
    assert len(genes) == 2715
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
        "terminalStop", "translationalException", "cdsSegments",
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

    by_id = {gene["id"]: gene for gene in genes}
    assert by_id["M744_RS00920"]["translationalException"] == "ribosomal_slippage"
    assert all(
        gene["translationalException"] is None
        for gene in genes
        if gene["id"] != "M744_RS00920"
    )
    assert {
        gene["id"]: gene["cdsSegments"]
        for gene in genes
        if gene["cdsSegments"] is not None
    } == {
        "M744_RS00920": [[169621, 169692], [169694, 170743]],
        "M744_RS13290": [[45877, 46366], [1, 2510]],
        "M744_RS13620": [[7830, 7842], [1, 281]],
    }


def test_full_cds_reconstruction_and_terminal_stop_distribution():
    genes = json.loads((DATA / "genes.json").read_text())
    raw = {}
    path = RAW_DEFAULT / "GCF_000817325.1_ASM81732v1_cds_from_genomic.fna.gz"
    with gzip.open(path, "rt") as handle:
        locus = None
        chunks = []
        for line in handle:
            if line.startswith(">"):
                if locus is not None:
                    raw[locus] = "".join(chunks)
                locus = re.search(r"\[locus_tag=([^\]]+)\]", line).group(1)
                chunks = []
            else:
                chunks.append(line.strip())
        if locus is not None:
            raw[locus] = "".join(chunks)

    assert len(genes) == 2715
    assert all(
        fm.unpack_codons(gene["codons"]) + gene["terminalStop"] == raw[gene["id"]]
        for gene in genes
    )
    assert collections.Counter(gene["terminalStop"] for gene in genes) == {
        "TAG": 1071,
        "TAA": 895,
        "TGA": 749,
    }


def test_whole_genome_round_trip_translation_and_independent_metrics():
    result = validate(RAW_DEFAULT, DATA, sample_size=30)
    assert result["geneCount"] + result["excludedCount"] == 2722
    assert result["fullCdsReconstructed"] == 2715
    assert {
        stop: result[f"terminalStop{stop}"] for stop in ("TAG", "TAA", "TGA")
    } == {"TAG": 1071, "TAA": 895, "TGA": 749}
    for metric in ("enc", "cai", "tai", "rscu"):
        assert result[f"{metric}Correlation"] > 0.999999
        assert result[f"{metric}MaxAbsoluteDeviation"] < 1e-5
