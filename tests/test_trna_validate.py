"""Tests for tools/trna_validate.py, the independent tRNAscan-SE comparison."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import trna_validate as tv  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[1]


def test_reverse_complement():
    assert tv.reverse_complement("CAT") == "ATG"
    assert tv.reverse_complement("GGGAAA") == "TTTCCC"


def test_effective_anticodon_inosine_wobble():
    # Any anticodon starting with genomic A reads as inosine at wobble position 34.
    assert tv.effective_anticodon("Arg", "ACG") == "ICG"
    assert tv.effective_anticodon("Ala", "AGC") == "IGC"


def test_effective_anticodon_lysidine_is_ile_cat_only():
    # The bacterial Ile-CAT tRNA is lysidine-modified and decodes ATA, not ATG.
    assert tv.effective_anticodon("Ile", "CAT") == "LAT"
    # A different amino acid with the same raw anticodon must not be relabelled.
    assert tv.effective_anticodon("Met", "CAT") == "CAT"


def test_parse_attributes():
    attrs = tv.parse_attributes("ID=rna-M744_RS00070;gbkey=tRNA;product=tRNA-Gly")
    assert attrs == {"ID": "rna-M744_RS00070", "gbkey": "tRNA", "product": "tRNA-Gly"}


def test_parse_refseq_trnas_extracts_forward_and_complement_anticodons(tmp_path):
    # 60 bp toy contig; a tRNA on each strand with a 3 bp anticodon window.
    # 1-indexed: bases 5..7 are "CAT"; bases 54..56 are "ATG".
    bases = ["A"] * 60
    bases[4:7] = list("CAT")
    bases[53:56] = list("ATG")
    sequence = "".join(bases)
    fasta = tmp_path / "toy.fna"
    fasta.write_text(f">chr1\n{sequence}\n")
    gff = tmp_path / "toy.gff"
    gff.write_text(
        "\n".join(
            [
                "##gff-version 3",
                "chr1\tRefSeq\tgene\t1\t10\t.\t+\t.\tID=gene-1;gene_biotype=tRNA;locus_tag=T1",
                "chr1\ttRNAscan-SE\ttRNA\t1\t10\t.\t+\t.\t"
                "ID=rna-1;locus_tag=T1;product=tRNA-Met;anticodon=(pos:5..7)",
                "chr1\tRefSeq\tgene\t51\t60\t.\t-\t.\tID=gene-2;gene_biotype=tRNA;locus_tag=T2",
                "chr1\ttRNAscan-SE\ttRNA\t51\t60\t.\t-\t.\t"
                "ID=rna-2;locus_tag=T2;product=tRNA-His;"
                "anticodon=(pos:complement(54..56))",
                "",
            ]
        )
    )
    genome = tv.load_genome(fasta)
    loci = tv.parse_refseq_trnas(gff, genome)
    by_locus = {locus["locus_tag"]: locus for locus in loci}
    assert by_locus["T1"]["anticodon"] == "CAT"
    assert by_locus["T1"]["strand"] == "+"
    # complement(54..56) on the toy sequence covers "ATG" on the + strand,
    # whose reverse complement (read 5'->3' on the tRNA transcript) is "CAT".
    assert by_locus["T2"]["anticodon"] == "CAT"
    assert by_locus["T2"]["strand"] == "-"


def test_parse_trnascan_output_normalizes_minus_strand_and_pseudo_flag(tmp_path):
    out = tmp_path / "trnascan.out"
    out.write_text(
        "\n".join(
            [
                "Sequence\t\ttRNA\tBounds\ttRNA\tAnti\tIntron Bounds\tInf\t",
                "Name\ttRNA #\tBegin\tEnd\tType\tCodon\tBegin\tEnd\tScore\tNote",
                "--------\t------\t-----\t-----\t----\t-----\t-----\t----\t------\t------",
                "chr1\t1\t100\t170\tGly\tTCC\t0\t0\t75.4\t",
                "chr1\t2\t500\t430\tArg\tCCT\t0\t0\t20.0\tpseudo",
                "",
            ]
        )
    )
    calls = tv.parse_trnascan_output(out)
    assert len(calls) == 2
    forward, minus = calls
    assert forward["start"] == 100 and forward["end"] == 170 and forward["strand"] == "+"
    assert forward["pseudo"] is False
    assert minus["start"] == 430 and minus["end"] == 500 and minus["strand"] == "-"
    assert minus["pseudo"] is True


def test_isotype_aliases_treat_ile2_and_fmet_as_expected_naming():
    scan = [
        {
            "seqid": "chr1",
            "start": 1,
            "end": 10,
            "strand": "+",
            "isotype": "Ile",
            "raw_isotype": "Ile2",
            "anticodon": "CAT",
            "score": 51.3,
            "pseudo": False,
        }
    ]
    refseq = [
        {
            "locus_tag": "T1",
            "seqid": "chr1",
            "start": 1,
            "end": 10,
            "strand": "+",
            "isotype": "Ile",
            "anticodon": "CAT",
            "effective_anticodon": "LAT",
            "pseudo": False,
        }
    ]
    result = tv.compare(refseq, scan)
    assert result["counts"] == {
        "concordant": 1,
        "discordant": 0,
        "unresolved": 0,
        "refseq_total": 1,
        "tRNAscan_only_calls": 0,
    }


def test_compare_flags_isotype_mismatch_as_discordant():
    scan = [
        {
            "seqid": "chr1",
            "start": 1,
            "end": 10,
            "strand": "+",
            "isotype": "Ser",
            "raw_isotype": "Ser",
            "anticodon": "TGA",
            "score": 10.0,
            "pseudo": False,
        }
    ]
    refseq = [
        {
            "locus_tag": "T1",
            "seqid": "chr1",
            "start": 1,
            "end": 10,
            "strand": "+",
            "isotype": "Leu",
            "anticodon": "TGA",
            "effective_anticodon": "TGA",
            "pseudo": False,
        }
    ]
    result = tv.compare(refseq, scan)
    assert result["loci"][0]["status"] == "discordant"
    assert "isotype" in result["loci"][0]["reason"]


def test_compare_flags_missing_coordinate_match_as_unresolved():
    refseq = [
        {
            "locus_tag": "T1",
            "seqid": "chr1",
            "start": 1,
            "end": 10,
            "strand": "+",
            "isotype": "Leu",
            "anticodon": "TGA",
            "effective_anticodon": "TGA",
            "pseudo": False,
        }
    ]
    result = tv.compare(refseq, [])
    assert result["loci"][0]["status"] == "unresolved"
    assert result["counts"]["unresolved"] == 1


def _locus(pseudo: bool) -> dict:
    return {
        "locus_tag": "T1",
        "seqid": "chr1",
        "start": 1,
        "end": 10,
        "strand": "+",
        "isotype": "Gly",
        "anticodon": "TCC",
        "effective_anticodon": "TCC",
        "pseudo": pseudo,
    }


def _call(pseudo: bool) -> dict:
    return {
        "seqid": "chr1",
        "start": 1,
        "end": 10,
        "strand": "+",
        "isotype": "Gly",
        "raw_isotype": "Gly",
        "anticodon": "TCC",
        "score": 75.0,
        "pseudo": pseudo,
    }


@pytest.mark.parametrize(
    "refseq_pseudo, scan_pseudo, expected_status",
    [
        (False, False, "concordant"),
        (True, True, "concordant"),
        (False, True, "discordant"),
        (True, False, "discordant"),
    ],
)
def test_compare_flags_pseudogene_disagreement_for_every_combination(
    refseq_pseudo, scan_pseudo, expected_status
):
    result = tv.compare([_locus(refseq_pseudo)], [_call(scan_pseudo)])
    row = result["loci"][0]
    assert row["status"] == expected_status
    assert row["refseq_pseudo"] is refseq_pseudo
    assert row["scan_pseudo"] is scan_pseudo
    if refseq_pseudo != scan_pseudo:
        assert "pseudogene flag disagreement" in row["reason"]
    else:
        assert row["reason"] == "match"


def test_compare_reports_extra_tRNAscan_only_calls():
    scan = [
        {
            "seqid": "chr1",
            "start": 900,
            "end": 960,
            "strand": "+",
            "isotype": "Undet",
            "raw_isotype": "Undet",
            "anticodon": "NNN",
            "score": 22.2,
            "pseudo": True,
        }
    ]
    result = tv.compare([], scan)
    assert result["counts"]["tRNAscan_only_calls"] == 1
    assert result["tRNAscan_only"][0]["scan_pseudo"] is True


@pytest.mark.skipif(
    not (REPO_ROOT / "data/trna/independent_run/trnascan.out").exists(),
    reason="requires the pinned tRNAscan-SE 2.0 rerun output; see docs/validation/"
    "trna-annotation-validation.md to reproduce it",
)
def test_pinned_genome_matches_all_44_refseq_trnas_with_no_pipeline_drift():
    """End-to-end regression: the checked-in tRNAscan-SE rerun must stay fully
    concordant with the pinned RefSeq annotation and with the tracked
    anticodon_gene_copies.tsv species table used by the tAI pipeline.

    Reads the compressed genome/GFF directly (both parsers support `.gz`)
    because that is exactly what `tools/fetch_genome.sh` and CI leave behind
    under `data/raw/` — no separate decompression step, so this executes
    after a normal fetch instead of skipping."""
    fasta = REPO_ROOT / "data/raw/GCF_000817325.1_ASM81732v1_genomic.fna.gz"
    gff = REPO_ROOT / "data/raw/GCF_000817325.1_ASM81732v1_genomic.gff.gz"
    if not fasta.exists() or not gff.exists():
        pytest.skip("requires the pinned genome/GFF fetched into data/raw")

    genome = tv.load_genome(fasta)
    refseq = tv.parse_refseq_trnas(gff, genome)
    scan = tv.parse_trnascan_output(
        REPO_ROOT / "data/trna/independent_run/trnascan.out"
    )
    result = tv.compare(refseq, scan)

    assert result["counts"]["refseq_total"] == 44
    assert result["counts"]["discordant"] == 0
    assert result["counts"]["unresolved"] == 0
    # tRNAscan-SE 2.0 additionally flags one short low-score locus as a likely
    # pseudogene that RefSeq/PGAP did not annotate; this is expected, not a gap.
    assert result["counts"]["tRNAscan_only_calls"] == 1
    assert result["tRNAscan_only"][0]["scan_pseudo"] is True

    import csv
    from collections import Counter

    tracked = {}
    with (REPO_ROOT / "data/trna/anticodon_gene_copies.tsv").open(newline="") as handle:
        for row in csv.DictReader(handle, delimiter="\t"):
            tracked[(row["amino_acid"], row["anticodon"])] = int(row["gene_copies"])
    derived = Counter((locus["isotype"], locus["anticodon"]) for locus in refseq)
    assert dict(derived) == tracked
