"""The shipped context is exact on both strands and exceptional windows."""
import sys
from pathlib import Path

import pytest
from Bio.Seq import Seq

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from rna_context import folding_context, restore_start_window


@pytest.mark.parametrize("strand", ["+", "-"])
@pytest.mark.parametrize("anchor", [1, 45, 170])
def test_circular_both_strands(strand, anchor):
    genome = "ACGT" * 50
    annotation = {"start": anchor, "end": anchor + 65, "strand": strand}
    dna = "".join(genome[i % len(genome)] for i in range(anchor - 1, anchor + 65))
    cds = str(Seq(dna).reverse_complement()) if strand == "-" else dna
    context = folding_context(annotation, genome, cds)
    assert set(context) == {"upstream"}
    origin = annotation["start"] - 1 if strand == "+" else annotation["end"] - 1
    indices = [(origin + (i if strand == "+" else -i)) % len(genome) for i in range(-30, 60)]
    expected = "".join(genome[i] for i in indices)
    if strand == "-":
        expected = str(Seq(expected).complement())
    assert restore_start_window(context, cds) == expected


@pytest.mark.parametrize("strand", ["+", "-"])
def test_short_spliced_cds_maps_only_its_bases(strand):
    annotation = {"start": 51, "end": 82, "strand": strand, "cdsSegments": [[51, 62], [65, 82]]}
    genome = "ACGT" * 50
    dna = genome[50:62] + genome[64:82]
    cds = str(Seq(dna).reverse_complement()) if strand == "-" else dna
    context = folding_context(annotation, genome, cds)
    assert set(context) == {"sequence", "cdsOffsets"}
    assert restore_start_window(context, cds) == context["sequence"]
    recoded = "A" * len(cds)
    result = restore_start_window(context, recoded)
    for index, offset in enumerate(context["cdsOffsets"]):
        assert result[index] == ("A" if offset >= 0 else context["sequence"][index])


def test_rejects_invalid_or_duplicated_coordinates():
    with pytest.raises(ValueError, match="do not reproduce"):
        folding_context({"start": 1, "end": 3, "strand": "+"}, "ACGT" * 30, "GGG")
    with pytest.raises(ValueError, match="Repeated"):
        folding_context({"start": 1, "end": 130, "strand": "+"}, "A" * 120, "A" * 130)


def test_generated_context_and_folding_match_python():
    import json
    import RNA
    from feature_metrics import unpack_codons
    genes = json.loads((Path(__file__).resolve().parents[1] / "site/data/genes.json").read_text())
    assert RNA.__version__ == "2.7.2"
    for gene in genes:
        cds = unpack_codons(gene["codons"]) + gene["terminalStop"]
        assert RNA.fold(restore_start_window(gene["rnaContext"], cds))[1] == pytest.approx(gene["mfeStart"], abs=1e-5)
