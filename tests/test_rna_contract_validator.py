"""Independent release-gate checks for malformed and incorrectly oriented RNA context."""

import copy
import gzip
import json
import random
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from validate_contract import (
    ALPHABET, ASSEMBLY_PREFIX, Report, codon_order, cross_check_rna_context,
    decode_rna_context, validate_genes,
)


def synthetic_case(tmp_path, strand="+", kind="ordinary", compact=False):
    """Write a controlled raw genome and GFF; do not call any producer code."""
    dna = "GTG" + "GCT" * (1 if kind == "short" else 30) + "TAG"
    start = (290 if strand == "+" else 200) if kind == "boundary" else 51
    if kind == "origin-joined":
        segments = [(270, 300), (1, 65)]
    elif kind == "ambiguous-joined":
        segments = [(1, 48), (151, 198)]
    elif kind == "joined":
        segments = [(start, start + 47), (start + 50, start + len(dna) + 1)]
    else:
        segments = [(start, start + len(dna) - 1)]
    positions = [i for lo, hi in segments for i in range(lo - 1, hi)]
    if strand == "-":
        positions.reverse()
    complement = str.maketrans("ACGT", "TGCA")
    randomizer = random.Random(19)
    genome = [randomizer.choice("ACGT") for _ in range(300)]
    for position, base in zip(positions, dna, strict=True):
        genome[position % 300] = base if strand == "+" else base.translate(complement)
    anchor = positions[0]
    direction = 1 if strand == "+" else -1
    window_positions = [(anchor + direction * offset) % 300 for offset in range(-30, 60)]
    window = "".join(genome[position] for position in window_positions)
    if strand == "-":
        window = window.translate(complement)
    offsets = {position % 300: index for index, position in enumerate(positions)}
    context = {"sequence": window, "cdsOffsets": [offsets.get(position, -1) for position in window_positions]}
    if compact:
        context = {"upstream": window[:30]}
    packed = dict(zip(codon_order(), ALPHABET))
    gene = {"id": "test", "seqid": "circle", "strand": strand,
            "codons": "".join(packed[dna[i:i + 3]] for i in range(0, len(dna) - 3, 3)),
            "terminalStop": dna[-3:], "rnaContext": context}
    with gzip.open(tmp_path / f"{ASSEMBLY_PREFIX}_genomic.fna.gz", "wt") as handle:
        handle.write(">circle\n" + "".join(genome) + "\n")
    with gzip.open(tmp_path / f"{ASSEMBLY_PREFIX}_genomic.gff.gz", "wt") as handle:
        handle.write("##gff-version 3\n")
        for lo, hi in segments:
            handle.write(f"circle\ttest\tCDS\t{lo}\t{hi}\t.\t{strand}\t0\tlocus_tag=test\n")
    return gene


@pytest.mark.parametrize("strand", ["+", "-"])
@pytest.mark.parametrize(
    "kind", ["ordinary", "boundary", "joined", "origin-joined", "short"]
)
def test_independent_raw_window_and_map(tmp_path, strand, kind):
    gene = synthetic_case(tmp_path, strand, kind)
    cds, window, offsets = decode_rna_context(gene)
    assert cds.startswith("GTG")  # Literal non-ATG initiation remains intact.
    assert cds.endswith("TAG")
    assert len(window) == len(offsets) == 90
    report = Report()
    cross_check_rna_context([gene], str(tmp_path), report)
    assert not report.failures
    assert len(report.passes) == 1


@pytest.mark.parametrize("strand", ["+", "-"])
def test_origin_join_order_does_not_depend_on_gff_row_order(tmp_path, strand):
    gene = synthetic_case(tmp_path, strand, "origin-joined")
    gff_path = tmp_path / f"{ASSEMBLY_PREFIX}_genomic.gff.gz"
    with gzip.open(gff_path, "rt") as handle:
        header, *rows = handle.readlines()
    with gzip.open(gff_path, "wt") as handle:
        handle.writelines([header, *reversed(rows)])
    report = Report()
    cross_check_rna_context([gene], str(tmp_path), report)
    assert not report.failures


def test_origin_join_rejects_overlap_and_ambiguous_segment_order(tmp_path):
    gene = synthetic_case(tmp_path, kind="origin-joined")
    gff_path = tmp_path / f"{ASSEMBLY_PREFIX}_genomic.gff.gz"
    with gzip.open(gff_path, "at") as handle:
        handle.write(
            "circle\ttest\tCDS\t295\t305\t.\t+\t0\tlocus_tag=test\n"
        )
    report = Report()
    cross_check_rna_context([gene], str(tmp_path), report)
    assert "repeats a genomic position" in report.failures[0]

    gene = synthetic_case(tmp_path, kind="ambiguous-joined")
    report = Report()
    cross_check_rna_context([gene], str(tmp_path), report)
    assert "ambiguous circular CDS segment order" in report.failures[0]


@pytest.mark.parametrize("strand", ["+", "-"])
@pytest.mark.parametrize("kind", ["ordinary", "boundary"])
def test_compact_form_matches_raw_genome(tmp_path, strand, kind):
    gene = synthetic_case(tmp_path, strand, kind, compact=True)
    report = Report()
    cross_check_rna_context([gene], str(tmp_path), report)
    assert not report.failures


@pytest.mark.parametrize("context", [
    None, [], {}, {"upstream": "A" * 29}, {"upstream": "A" * 31},
    {"upstream": "N" * 30}, {"upstream": "a" * 30}, {"upstream": 30},
    {"upstream": "A" * 30, "extra": 1},
    {"upstream": "A" * 30, "sequence": "A" * 90, "cdsOffsets": [-1] * 90},
    {"sequence": "A" * 90}, {"sequence": "A" * 90, "cdsOffsets": [], "extra": 1},
    {"sequence": "A" * 89, "cdsOffsets": [-1] * 90},
    {"sequence": "N" * 90, "cdsOffsets": [-1] * 90},
    {"sequence": None, "cdsOffsets": [-1] * 90},
    {"sequence": "A" * 90, "cdsOffsets": None},
    {"sequence": "A" * 90, "cdsOffsets": [-1] * 89},
])
def test_rejects_malformed_context_forms(tmp_path, context):
    gene = synthetic_case(tmp_path)
    gene["rnaContext"] = context
    with pytest.raises(ValueError):
        decode_rna_context(gene)


@pytest.mark.parametrize("offset", [-2, 96, True, False, 1.0, None, "0"])
def test_rejects_non_integer_and_out_of_range_offsets(tmp_path, offset):
    gene = synthetic_case(tmp_path)
    gene["rnaContext"]["cdsOffsets"][0] = offset
    with pytest.raises(ValueError, match="integers"):
        decode_rna_context(gene)


def test_rejects_duplicate_map_wrong_base_missing_anchor_and_short_compact(tmp_path):
    gene = synthetic_case(tmp_path)
    corrupted = copy.deepcopy(gene)
    corrupted["rnaContext"]["cdsOffsets"][0] = 0
    with pytest.raises(ValueError, match="repeat"):
        decode_rna_context(corrupted)
    corrupted = copy.deepcopy(gene)
    corrupted["rnaContext"]["cdsOffsets"][30] = -1
    with pytest.raises(ValueError, match="translation-start"):
        decode_rna_context(corrupted)
    corrupted = copy.deepcopy(gene)
    sequence = corrupted["rnaContext"]["sequence"]
    corrupted["rnaContext"]["sequence"] = sequence[:30] + "A" + sequence[31:]
    with pytest.raises(ValueError, match="mapped context base"):
        decode_rna_context(corrupted)
    with pytest.raises(ValueError, match="short CDS"):
        decode_rna_context(synthetic_case(tmp_path, kind="short", compact=True))


@pytest.mark.parametrize("change", ["upstream", "flank", "same-base-offset", "unmapped", "strand", "replicon"])
def test_raw_gate_detects_plausible_but_incorrect_context(tmp_path, change):
    gene = synthetic_case(tmp_path, compact=change == "upstream")
    if change == "upstream":
        original = gene["rnaContext"]["upstream"]
        gene["rnaContext"]["upstream"] = ("A" if original[0] != "A" else "C") + original[1:]
    elif change == "flank":
        original = gene["rnaContext"]["sequence"]
        gene["rnaContext"]["sequence"] = ("A" if original[0] != "A" else "C") + original[1:]
    elif change == "same-base-offset":
        offsets = gene["rnaContext"]["cdsOffsets"]
        offsets[33], offsets[36] = offsets[36], offsets[33]
    elif change == "unmapped":
        gene["rnaContext"]["cdsOffsets"][33] = -1
    elif change == "strand":
        gene["strand"] = "-"
    else:
        gene["seqid"] = "wrong-replicon"
    decode_rna_context(gene)  # The corruption deliberately passes structure checks.
    report = Report()
    cross_check_rna_context([gene], str(tmp_path), report)
    assert len(report.failures) == 1


def test_shape_validation_is_part_of_normal_release_gate(tmp_path):
    gene = synthetic_case(tmp_path)
    gene["rnaContext"] = {}
    report = Report()
    validate_genes([gene], {}, report, set())
    assert any("RNA contexts have valid forms" in failure for failure in report.failures)


def test_raw_inputs_missing_are_explicitly_skipped(tmp_path):
    report = Report()
    cross_check_rna_context([], str(tmp_path), report)
    assert not report.failures
    assert "missing raw input" in report.skips[0]


@pytest.mark.parametrize("change, message", [
    ("no-annotation", "no raw GFF"),
    ("bad-strand", "inconsistent GFF"),
    ("mixed-strands", "inconsistent GFF"),
    ("ambiguous-genome", "ambiguous raw"),
    ("missing-replicon", "ambiguous raw"),
    ("bad-start", "invalid raw GFF"),
    ("long-segment", "invalid raw GFF"),
    ("repeated-position", "repeats a genomic"),
    ("different-cds", "packed CDS differs"),
    ("bad-context", "rnaContext must use"),
    ("bad-coordinate-text", "cannot read raw"),
    ("bad-gzip", "cannot read raw"),
])
def test_raw_gate_reports_bad_inputs_without_crashing(tmp_path, change, message):
    gene = synthetic_case(tmp_path)
    gff_path = tmp_path / f"{ASSEMBLY_PREFIX}_genomic.gff.gz"
    genome_path = tmp_path / f"{ASSEMBLY_PREFIX}_genomic.fna.gz"
    with gzip.open(gff_path, "rt") as handle:
        gff = handle.read()
    with gzip.open(genome_path, "rt") as handle:
        fasta = handle.read()
    if change == "no-annotation":
        gff = "# no matching CDS\n"
    elif change == "bad-strand":
        gff = gff.replace("\t+\t", "\t?\t")
    elif change == "mixed-strands":
        gff += gff.splitlines()[-1].replace("\t+\t", "\t-\t") + "\n"
    elif change == "ambiguous-genome":
        fasta += "N\n"
    elif change == "missing-replicon":
        fasta = fasta.replace(">circle", ">different")
    elif change == "bad-start":
        gff = gff.replace("\t51\t", "\t0\t")
    elif change == "long-segment":
        gff = gff.replace("\t146\t", "\t400\t")
    elif change == "repeated-position":
        gff += gff.splitlines()[-1] + "\n"
    elif change == "different-cds":
        # Beyond the start window, so it passes the context's base checks.
        gene["codons"] = gene["codons"][:-1] + ALPHABET[codon_order().index("GCC")]
    elif change == "bad-context":
        gene["rnaContext"] = {}
    elif change == "bad-coordinate-text":
        gff = gff.replace("\t51\t", "\tinvalid\t")
    with gzip.open(gff_path, "wt") as handle:
        handle.write(gff)
    with gzip.open(genome_path, "wt") as handle:
        handle.write(fasta)
    if change == "bad-gzip":
        gff_path.write_bytes(b"not gzip")
    report = Report()
    cross_check_rna_context([gene], str(tmp_path), report)
    assert len(report.failures) == 1
    assert message in report.failures[0]


@pytest.mark.parametrize("field, value", [
    ("codons", ""), ("codons", None), ("codons", "?"),
    ("codons", ALPHABET[codon_order().index("TAG")]), ("terminalStop", "AAA"),
])
def test_context_cannot_validate_an_invalid_cds(tmp_path, field, value):
    gene = synthetic_case(tmp_path)
    gene[field] = value
    with pytest.raises(ValueError):
        decode_rna_context(gene)


def test_all_real_contexts_and_genomic_windows():
    genes = json.loads((ROOT / "site/data/genes.json").read_text())
    raw = ROOT / "data/raw"
    if not (raw / f"{ASSEMBLY_PREFIX}_genomic.gff.gz").exists():
        pytest.skip("verified raw genome/GFF not present in this checkout")
    assert {gene["strand"] for gene in genes} == {"+", "-"}
    assert any(decode_rna_context(gene)[0].startswith("GTG") for gene in genes)
    assert {"M744_RS00920", "M744_RS13290", "M744_RS13620"} <= {gene["id"] for gene in genes}
    report = Report()
    cross_check_rna_context(genes, str(raw), report)
    assert not report.failures, report.failures
    assert not report.skips
