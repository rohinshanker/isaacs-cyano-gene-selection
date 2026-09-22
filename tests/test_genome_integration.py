"""Whole-genome invariants and independent cross-validation."""

import collections
import gzip
import json
import re
import sys
from pathlib import Path

import pytest
from scipy.stats import spearmanr

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import feature_metrics as fm
from check_feature_consistency import RAW_DEFAULT, validate


DATA = Path(__file__).resolve().parents[1] / "site/data"
EXPRESSION_MANIFEST = (
    Path(__file__).resolve().parents[1] / "data/expression/sources.json"
)


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
    assert meta["expressionSource"]["coverage"]["total"] == len(genes)
    assert meta["expressionSource"]["isTargetOrganism"] is False
    assert meta["codonOccurrences"]["GTG"] == {"total": 18659, "editable": 18303}
    assert meta["codonOccurrences"]["TTG"] == {"total": 20427, "editable": 20324}
    assert len(meta["metrics"]) == 35
    assert all(
        definition["desc"] != definition["label"]
        and definition["scale"] in {"sequential", "diverging"}
        and definition["missingPolicy"]
        and definition["direction"]
        for definition in meta["metrics"].values()
    )
    assert meta["metrics"]["expressionProxy"] == {
        "label": "Expression proxy rank",
        "unit": "rank",
        "desc": (
            "Tie-aware average rank of sqrt(CAI × tAI) across all genes, scaled "
            "from 0 to 1; this is a codon-adaptation proxy, not measured transcript "
            "or protein abundance."
        ),
        "scale": "sequential",
        "missingPolicy": "complete coverage; no missing values",
        "direction": "contextual",
    }
    assert "expressionBasis" not in meta["metrics"]
    assert {
        "cai", "tai", "expression", "expressionPercentile", "expressionProxy",
        "tssInitiation",
    } <= meta["metrics"].keys()
    assert meta["metrics"]["expression"]["scale"] == "sequential"
    assert meta["metrics"]["tssInitiation"]["scale"] == "sequential"
    assert meta["tai"]["tRNAGeneCopies"]["LAT"] == 1
    assert meta["tai"]["zeroWeightCodons"] == ["TTA"]
    assert meta["tai"]["zeroWeightSubstitution"] == pytest.approx(0.3799, abs=1e-4)
    assert "unavailableWeightFloor" not in meta["tai"]
    assert meta["tai"]["excludedAminoAcids"] == ["M"]
    assert "fewer than two observations" in meta["encFamilyConvention"]
    assert meta["encExpectedGc3Convention"].startswith("GC3s")
    assert meta["caiReferenceSet"]["n"] == 71
    assert pca["nComponents"] == 6
    assert len(pca["loadings"]) == 59
    required = {
        "gc", "gc1", "gc2", "gc3", "a3", "t3", "g3", "c3", "enc",
        "encExpected", "deltaEnc", "cai", "tai", "rareFraction", "rareCount",
        "longestRareRun", "rampRareCount", "minLocalTai", "cps",
        "underrepresentedPairFraction", "mfeStart", "mfeFirst100", "minLocalGc",
        "maxLocalGc", "gc5prime", "neighborUpstreamNt", "neighborDownstreamNt",
        "overlapsNeighbor", "operonId", "operonPosition", "operonSize", "rscu",
        "expression", "expressionPercentile", "expressionProxy", "expressionBasis",
        "expressionSourceId", "codonPca", "riskUmap", "codons",
        "terminalStop", "translationalException", "cdsSegments",
        "encHasSubstitutedFamilies",
    }
    assert required <= genes[0].keys()
    assert all(isinstance(gene["encHasSubstitutedFamilies"], bool) for gene in genes)
    measured = [gene for gene in genes if gene["expression"] is not None]
    assert meta["expressionSource"]["coverage"]["withValue"] == len(measured)
    assert all(gene["expressionPercentile"] is not None for gene in measured)
    assert all(
        gene["expressionPercentile"] is None
        for gene in genes
        if gene["expression"] is None
    )
    assert all(0 <= gene["expressionProxy"] <= 1 for gene in genes)
    assert min(gene["expressionProxy"] for gene in genes) == 0
    assert max(gene["expressionProxy"] for gene in genes) == 1
    assert all(gene["expressionBasis"] == "measured" for gene in measured)
    assert all(gene["expressionSourceId"] == "GSE205444" for gene in measured)
    assert all(
        gene["expressionBasis"] == "proxy" and gene["expressionSourceId"] is None
        for gene in genes
        if gene["expression"] is None
    )
    assert meta["expressionProxy"]["coverage"] == {
        "withValue": 2715,
        "total": 2715,
    }
    assert "not transcript or protein abundance" in meta["expressionProxy"]["meaning"]

    manifest = json.loads(EXPRESSION_MANIFEST.read_text())
    assert len(meta["expressionSources"]) == len(manifest) == 2
    for emitted, selected in zip(meta["expressionSources"], manifest, strict=True):
        assert emitted | selected == emitted
    assert [source["coverage"]["withValue"] for source in meta["expressionSources"]] == [
        2551,
        1727,
    ]
    assert all(source["coverage"]["total"] == 2715 for source in meta["expressionSources"])
    tss_definition = meta["metrics"]["tssInitiation"]
    assert "transcription initiation strength" in tss_definition["desc"]
    assert "not transcript abundance" in tss_definition["desc"]
    assert "Tan et al. 2018" in tss_definition["desc"]
    assert "1,727 of 2,715 genes" in tss_definition["desc"]

    tss_measured = [gene for gene in genes if gene["tssInitiation"] is not None]
    tss_missing = [gene for gene in genes if gene["tssInitiation"] is None]
    assert len(tss_measured) == 1727
    assert len(tss_missing) == 988
    assert len(measured) == 2551
    shared = [gene for gene in measured if gene["tssInitiation"] is not None]
    assert len(shared) == 1666
    correlation = spearmanr(
        [gene["tssInitiation"] for gene in shared],
        [gene["expression"] for gene in shared],
    ).statistic
    assert correlation == pytest.approx(0.313, abs=0.0005)

    tss_source = meta["tssEvidenceSource"]
    tss_rows = json.loads((DATA / "tss_evidence.json").read_text())
    assert tss_source["pooledScoreSourceId"] == "TAN2018_TSS"
    assert tss_source["replicatesPerCondition"] == 2
    assert tss_source["isGeneBodyAbundance"] is False
    assert tss_source["summary"] == {
        "sourceRows": 2475,
        "matchedRows": 2432,
        "matchedGenes": 1789,
        "unresolvedIdentifierRows": 10,
        "absentCurrentLocusRows": 33,
        "genesWithoutMappedTss": 926,
    }
    assert len(tss_rows) == 1789
    assert sum(map(len, tss_rows.values())) == 2432
    assert len(tss_rows["M744_RS01695"]) == 20
    assert tss_rows["M744_RS02000"][0]["rawReads"]["control"] == [154, 195]
    assert tss_rows["M744_RS02000"][0]["sourceStartDistanceNt"] == 6
    assert tss_rows["M744_RS02000"][0]["differential"]["dark"][
        "log2FoldChange"
    ] == pytest.approx(4.991755, abs=1e-6)
    assert tss_rows["M744_RS02000"][0]["differential"]["dark"][
        "padj"
    ] == pytest.approx(6.0420381406449e-98, rel=1e-12)
    current_by_id = {gene["id"]: gene for gene in genes}
    inside_current_cds = 0
    changed_start_spacing = 0
    for locus, rows in tss_rows.items():
        gene = current_by_id[locus]
        expected_replicon = gene["seqid"].removeprefix("NZ_").split(".")[0]
        for row in rows:
            assert row["replicon"] == expected_replicon
            assert row["strand"] == gene["strand"]
            current_distance = (
                gene["start"] - row["position"]
                if gene["strand"] == "+"
                else row["position"] - gene["end"]
            )
            inside_current_cds += current_distance < 0
            changed_start_spacing += current_distance != row["sourceStartDistanceNt"]
    assert inside_current_cds == 15
    assert changed_start_spacing == 236

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
    replicon_lengths = {
        "NZ_CP006471.1": 2_690_418,
        "NZ_CP006472.1": 46_366,
        "NZ_CP006473.1": 7_842,
    }
    assert all(
        1 <= gene["start"] <= gene["end"] <= replicon_lengths[gene["seqid"]]
        for gene in genes
    )
    assert all(gene["neighborUpstreamNt"] is not None for gene in genes)
    assert all(gene["neighborDownstreamNt"] is not None for gene in genes)
    assert meta["defaultReplacement"]["TGA"] == "TAG"
    assert meta["highExpressedReplacement"]["TGA"] == "TAG"
    assert "M744_RS01650" not in meta["caiReferenceSet"]["locusTags"]
    assert "M744_RS08135" not in meta["caiReferenceSet"]["locusTags"]


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


def test_whole_genome_round_trip_translation_and_metric_consistency():
    result = validate(RAW_DEFAULT, DATA, sample_size=30)
    assert result["geneCount"] + result["excludedCount"] == 2722
    assert result["fullCdsReconstructed"] == 2715
    assert {
        stop: result[f"terminalStop{stop}"] for stop in ("TAG", "TAA", "TGA")
    } == {"TAG": 1071, "TAA": 895, "TGA": 749}
    for metric in ("enc", "cai", "tai", "rscu"):
        assert result[f"{metric}Correlation"] > 0.999999
        assert result[f"{metric}MaxAbsoluteDeviation"] < 1e-5
