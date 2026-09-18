#!/usr/bin/env python3
"""Independent numerical and sequence validation for generated feature JSON."""

from __future__ import annotations

import collections
import gzip
import json
import math
import re
import sys
from pathlib import Path

import numpy as np
from Bio import SeqIO
from Bio.Data import CodonTable
from Bio.Seq import Seq

sys.path.insert(0, str(Path(__file__).resolve().parent))
import feature_metrics as fm  # noqa: E402


RAW_DEFAULT = Path(
    "/Users/Rohin/Desktop/coding_stuff/ISAACS-LAB/"
    "isaacs-cyano-gene-selection/data/raw"
)
PREFIX = "GCF_000817325.1_ASM81732v1_"
TABLE = CodonTable.unambiguous_dna_by_id[11]


def _metadata(description: str) -> dict[str, str]:
    return dict(re.findall(r"\[([^=\]]+)=([^\]]*)\]", description))


def _raw_records(raw_dir: Path) -> dict[str, dict[str, str]]:
    path = raw_dir / f"{PREFIX}cds_from_genomic.fna.gz"
    result = {}
    with gzip.open(path, "rt") as handle:
        for record in SeqIO.parse(handle, "fasta"):
            metadata = _metadata(record.description)
            result[metadata["locus_tag"]] = {
                "sequence": str(record.seq).upper(),
                "proteinId": metadata.get("protein_id", ""),
            }
    return result


def _proteins(raw_dir: Path) -> dict[str, str]:
    path = raw_dir / f"{PREFIX}protein.faa.gz"
    with gzip.open(path, "rt") as handle:
        return {record.id: str(record.seq).rstrip("*") for record in SeqIO.parse(handle, "fasta")}


def _translated_codons(sequence: str) -> list[str]:
    """Splits a CDS and represents its bacterial initiator as methionine."""
    codons = [sequence[index : index + 3] for index in range(0, len(sequence) - 3, 3)]
    if codons:
        codons[0] = "ATG"
    return codons


def independent_rscu(sequence: str) -> list[float]:
    """Computes RSCU directly from the definition, independently of the pipeline."""
    codons = _translated_codons(sequence)
    counts = collections.Counter(codons)
    result = []
    for codon in fm.RSCU_ORDER:
        amino_acid = TABLE.forward_table[codon]
        family = [item for item, aa in TABLE.forward_table.items() if aa == amino_acid]
        total = sum(counts[item] for item in family)
        result.append(counts[codon] * len(family) / total if total else 0.0)
    return result


def independent_enc(sequence: str) -> float:
    """Reimplements Wright 1990 from family counts without pipeline helpers."""
    codons = _translated_codons(sequence)
    counts = collections.Counter(codons)
    families = collections.defaultdict(list)
    for codon, amino_acid in TABLE.forward_table.items():
        families[amino_acid].append(codon)
    result = 2.0
    for degeneracy, coefficient in ((2, 9), (3, 1), (4, 5), (6, 3)):
        estimates = []
        for family in families.values():
            if len(family) != degeneracy:
                continue
            total = sum(counts[codon] for codon in family)
            if total == 1:
                estimates.append(1.0)
            elif total > 1:
                squared = sum((counts[codon] / total) ** 2 for codon in family)
                estimates.append(max((total * squared - 1) / (total - 1), 1 / degeneracy))
        mean_f = sum(estimates) / len(estimates) if estimates else 1 / degeneracy
        result += coefficient / mean_f
    return min(61.0, max(20.0, result))


def independent_cai_weights(sequences: list[str]) -> dict[str, float]:
    """Computes Sharp-Li weights from raw reference sequences."""
    counts = collections.Counter(
        codon
        for sequence in sequences
        for codon in _translated_codons(sequence)
    )
    families = collections.defaultdict(list)
    for codon, amino_acid in TABLE.forward_table.items():
        families[amino_acid].append(codon)
    result = {}
    for family in families.values():
        maximum = max(counts[codon] if counts[codon] else 0.5 for codon in family)
        for codon in family:
            result[codon] = (counts[codon] if counts[codon] else 0.5) / maximum
    return result


def independent_cai(sequence: str, weights: dict[str, float]) -> float:
    """Computes CAI from its log-geometric-mean definition."""
    codons = [
        codon
        for codon in _translated_codons(sequence)
        if TABLE.forward_table[codon] not in {"M", "W"}
    ]
    if not codons:
        return 1.0
    return math.exp(sum(math.log(weights[codon]) for codon in codons) / len(codons))


def independent_tai_weights(data_dir: Path) -> dict[str, float]:
    """Re-derives dos-Reis weights from the independently verified tRNA table."""
    table = data_dir.parents[1] / "data/trna/anticodon_gene_copies.tsv"
    species = []
    with table.open(encoding="utf-8") as handle:
        next(handle)
        for line in handle:
            amino_acid, anticodon, _, copies, _ = line.rstrip("\n").split("\t")
            if anticodon.startswith("A"):
                anticodon = "I" + anticodon[1:]
            if (amino_acid, anticodon) == ("Ile", "CAT"):
                anticodon = "LAT"
            species.append((anticodon, int(copies)))
    penalties = {
        "I:T": 0.0,
        "I:C": 0.28,
        "I:A": 0.9999,
        "G:T": 0.41,
        "T:G": 0.68,
        "L:A": 0.89,
    }
    complement = {"A": "T", "T": "A", "C": "G", "G": "C"}
    absolute = {}
    for codon in TABLE.forward_table:
        value = 0.0
        for anticodon, copies in species:
            if complement[anticodon[2]] != codon[0]:
                continue
            if complement[anticodon[1]] != codon[1]:
                continue
            if anticodon[0] in complement and complement[anticodon[0]] == codon[2]:
                value += copies
            elif f"{anticodon[0]}:{codon[2]}" in penalties:
                value += copies * (1 - penalties[f"{anticodon[0]}:{codon[2]}"])
        absolute[codon] = value
    maximum = max(absolute.values())
    return {codon: max(value / maximum, 0.01) for codon, value in absolute.items()}


def independent_tai(sequence: str, weights: dict[str, float]) -> float:
    """Computes the gene tAI geometric mean from independent weights."""
    codons = _translated_codons(sequence)
    return math.exp(sum(math.log(weights[codon]) for codon in codons) / len(codons))


def validate(raw_dir: Path, data_dir: Path, sample_size: int = 30) -> dict[str, float | int]:
    """Validates whole-genome round trips and an evenly-spaced numerical sample."""
    genes = json.loads((data_dir / "genes.json").read_text())
    meta = json.loads((data_dir / "meta.json").read_text())
    excluded = json.loads((data_dir / "excluded.json").read_text())
    raw = _raw_records(raw_dir)
    proteins = _proteins(raw_dir)
    terminal_stops: collections.Counter[str] = collections.Counter()
    reconstructed = 0
    for gene in genes:
        source = raw[gene["id"]]
        full_cds = fm.unpack_codons(gene["codons"]) + gene["terminalStop"]
        assert full_cds == source["sequence"]
        reconstructed += 1
        terminal_stops[gene["terminalStop"]] += 1
        translated = str(Seq(source["sequence"]).translate(table=11, cds=True))
        assert translated == proteins[source["proteinId"]]
    assert len(genes) + len(excluded) == len(raw) == 2722
    assert terminal_stops == {"TAG": 1071, "TAA": 895, "TGA": 749}

    reference_sequences = [raw[locus]["sequence"] for locus in meta["caiReferenceSet"]["locusTags"]]
    cai_weights = independent_cai_weights(reference_sequences)
    tai_weights = independent_tai_weights(data_dir)
    indexes = np.linspace(0, len(genes) - 1, sample_size, dtype=int)
    sample = [genes[index] for index in indexes]
    observed = {"enc": [], "cai": [], "tai": [], "rscu": []}
    expected = {"enc": [], "cai": [], "tai": [], "rscu": []}
    for gene in sample:
        sequence = raw[gene["id"]]["sequence"]
        observed["enc"].append(gene["enc"])
        expected["enc"].append(independent_enc(sequence))
        observed["cai"].append(gene["cai"])
        expected["cai"].append(independent_cai(sequence, cai_weights))
        observed["tai"].append(gene["tai"])
        expected["tai"].append(independent_tai(sequence, tai_weights))
        observed["rscu"].extend(gene["rscu"])
        expected["rscu"].extend(independent_rscu(sequence))
    result: dict[str, float | int] = {
        "sampleSize": sample_size,
        "geneCount": len(genes),
        "excludedCount": len(excluded),
        "fullCdsReconstructed": reconstructed,
        "terminalStopTAG": terminal_stops["TAG"],
        "terminalStopTAA": terminal_stops["TAA"],
        "terminalStopTGA": terminal_stops["TGA"],
    }
    for metric in ("enc", "cai", "tai", "rscu"):
        result[f"{metric}Correlation"] = float(
            np.corrcoef(observed[metric], expected[metric])[0, 1]
        )
        result[f"{metric}MaxAbsoluteDeviation"] = max(
            abs(a - b)
            for a, b in zip(observed[metric], expected[metric], strict=True)
        )
    return result


def main() -> None:
    repository = Path(__file__).resolve().parents[1]
    print(json.dumps(validate(RAW_DEFAULT, repository / "site/data"), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
