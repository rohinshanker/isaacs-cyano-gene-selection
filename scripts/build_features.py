#!/usr/bin/env python3
"""Builds target-independent gene features for UTEX 2973."""

from __future__ import annotations

import argparse
import collections
import csv
import datetime
import gzip
import hashlib
import json
import math
import re
import sys
from pathlib import Path
from typing import Any, Iterable, Mapping
from urllib.parse import unquote

import numpy as np
import RNA
import umap
from Bio import SeqIO
from Bio.Seq import Seq
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parent))
import feature_metrics as fm  # noqa: E402


ACCESSION = "GCF_000817325.1"
PREFIX = "GCF_000817325.1_ASM81732v1_"
TOTAL_LENGTH = 2_744_626
UMAP_SEED = 2973
OPERON_GAP = 100
RARE_THRESHOLD = 0.1
# dos Reis et al. (2004) selective constraints. U is represented as DNA T;
# I is inosine and L is bacterial lysidine at anticodon wobble position 34.
S_VALUES = {
    "I:T": 0.0,
    "I:C": 0.28,
    "I:A": 0.9999,
    "G:T": 0.41,
    "T:G": 0.68,
    "L:A": 0.89,
}
LYSIDINE_TRNA = ("Ile", "CAT")
MISSING_POLICY = "null renders as unknown, never as zero or median"
REFERENCE_PATTERNS = (
    "translation elongation factor",
    "translation initiation factor",
    "translation termination factor",
    "chaperonin",
    "dna-directed rna polymerase subunit",
    "atp synthase subunit",
)

METRIC_DEFINITIONS = {
    "gc": "Fraction of G or C bases across the sense CDS, excluding the terminal stop; ranges from 0 to 1 and is computed from the RefSeq coding sequence.",
    "gc1": "Fraction of sense codons with G or C at codon position 1; ranges from 0 to 1, excludes the terminal stop, and is computed from the RefSeq coding sequence.",
    "gc2": "Fraction of sense codons with G or C at codon position 2; ranges from 0 to 1, excludes the terminal stop, and is computed from the RefSeq coding sequence.",
    "gc3": "Fraction of sense codons with G or C at codon position 3; ranges from 0 to 1, excludes the terminal stop, and includes Met and Trp sites unlike the GC3s value used for expected ENC.",
    "a3": "Fraction of sense codons with A at codon position 3; ranges from 0 to 1, excludes the terminal stop, and is computed from the RefSeq coding sequence.",
    "t3": "Fraction of sense codons with T at codon position 3; ranges from 0 to 1, excludes the terminal stop, and is computed from the RefSeq coding sequence.",
    "g3": "Fraction of sense codons with G at codon position 3; ranges from 0 to 1, excludes the terminal stop, and is computed from the RefSeq coding sequence.",
    "c3": "Fraction of sense codons with C at codon position 3; ranges from 0 to 1, excludes the terminal stop, and is computed from the RefSeq coding sequence.",
    "enc": "Effective number of codons (Wright 1990), ranging from 20 for maximal synonymous concentration to 61 for equal synonymous use. Families observed fewer than twice use a degeneracy-class estimate; 1,446 of 2,715 genes (53%) require at least one such substitution, flagged by encHasSubstitutedFamilies.",
    "encExpected": "Expected effective number of codons on Wright's neutral curve, ranging from 20 to 61 and calculated from GC3 at synonymous sites after excluding Met and Trp; it is a compositional expectation, not a measured optimum.",
    "deltaEnc": "Expected ENC minus observed ENC, in codons and centred on zero; positive values mean more codon concentration than the GC3s neutral curve predicts, subject to the ENC family-substitution caveat.",
    "cai": "Codon adaptation index (Sharp and Li), ranging from 0 to 1 and calculated against the 71-gene ribosomal-plus-housekeeping reference set; zero reference counts receive a 0.5 pseudocount and Met and Trp are excluded.",
    "tai": "tRNA adaptation index (dos Reis et al.), ranging from 0 to 1 and derived from this genome's tRNA gene copies with bacterial wobble penalties; TTA has no cognate tRNA and uses the geometric mean of non-zero codon weights.",
    "expression": "DESeq2-normalized transcript count measured in S. elongatus PCC 7942 WT fresh BG-11 on day 1; non-negative and null for genes without a mapped measurement. It is from another strain and an unusual biofilm-study condition, so use it only as a rough overlay.",
    "expressionPercentile": "Average-rank percentile of the measured PCC 7942 expression values, in (0, 1]; null for unmeasured genes and not interchangeable with the CAI/tAI-derived expression proxy.",
    "rareFraction": "Fraction of sense codons whose genome-wide within-amino-acid frequency is below 0.1; ranges from 0 to 1 and treats an alternative start codon as translated methionine.",
    "rareCount": "Number of sense codons whose genome-wide within-amino-acid frequency is below 0.1; ranges from 0 to the gene's sense-codon length and excludes the terminal stop.",
    "longestRareRun": "Longest consecutive run of sense codons whose genome-wide within-amino-acid frequency is below 0.1; ranges from 0 to the gene's sense-codon length.",
    "rampRareCount": "Count of rare codons in the first 50 sense codons, or the whole gene when shorter; ranges from 0 to min(50, protein length) and uses the genome-wide 0.1 frequency threshold.",
    "minLocalTai": "Minimum mean tRNA-adaptation weight across all sliding 9-codon windows, shortened to the whole gene when necessary; ranges from 0 to 1 and inherits the tAI TTA substitution caveat.",
    "cps": "Mean Coleman-style codon-pair log odds over adjacent sense-codon pairs; signed around zero and estimated from this genome after conditioning on the encoded amino-acid pair, with a 0.5 pseudocount.",
    "underrepresentedPairFraction": "Fraction of adjacent sense-codon pairs with a negative genome-derived codon-pair log-odds score; ranges from 0 to 1 and is zero for genes with no pair.",
    "mfeStart": "Minimum folding free energy for the genomic RNA window from 30 nt upstream through 60 nt downstream of the translation start; reported in kcal/mol by ViennaRNA and includes flanking sequence rather than only the CDS.",
    "mfeFirst100": "Minimum folding free energy of the first 100 nt of the CDS, or the entire CDS when shorter; reported in kcal/mol by ViennaRNA and computed on the fixed wild-type window.",
    "minLocalGc": "Minimum GC fraction across all sliding 30-nt CDS windows, shortened to the whole CDS when necessary; ranges from 0 to 1 and includes the terminal stop when it falls in a window.",
    "maxLocalGc": "Maximum GC fraction across all sliding 30-nt CDS windows, shortened to the whole CDS when necessary; ranges from 0 to 1 and includes the terminal stop when it falls in a window.",
    "gc5prime": "GC fraction in the first 30 nt of the CDS, or the whole CDS when shorter; ranges from 0 to 1 and uses the fixed 5-prime window.",
    "lengthNt": "Annotated CDS length in nucleotides, including the terminal stop and summing joined CDS segments rather than the outer genomic span.",
    "lengthCodons": "Number of sense codons in the CDS, excluding the terminal stop; this is the denominator for target fractions and targets per kilobase.",
    "neighborUpstreamNt": "Strand-aware distance in nucleotides from the CDS to its upstream coding neighbor on the circular replicon; negative values denote overlap and null is never coerced to zero.",
    "neighborDownstreamNt": "Strand-aware distance in nucleotides from the CDS to its downstream coding neighbor on the circular replicon; negative values denote overlap and null is never coerced to zero.",
    "operonPosition": "One-based transcription-order position within a predicted same-strand operon; null for singleton genes. Operons are inferred from adjacent CDSs separated by at most 100 nt, not measured experimentally.",
    "operonSize": "Number of genes in the predicted same-strand operon; at least 1. Operons are inferred from adjacent CDSs separated by at most 100 nt, not measured experimentally.",
}

DIVERGING_METRICS = {
    "deltaEnc",
    "cps",
    "mfeStart",
    "mfeFirst100",
    "neighborUpstreamNt",
    "neighborDownstreamNt",
}


def is_cai_reference(product: str) -> bool:
    """Returns whether a product belongs in the CAI reference set."""
    normalized = product.lower()
    is_ribosomal_protein = (
        "ribosomal protein" in normalized and "transferase" not in normalized
    )
    return is_ribosomal_protein or any(
        pattern in normalized for pattern in REFERENCE_PATTERNS
    )


def require(condition: bool, message: str) -> None:
    """Raises a persistent, descriptive input-contract error."""
    if not condition:
        raise ValueError(message)


def parse_attributes(value: str) -> dict[str, str]:
    """Parses a GFF3 attribute column."""
    result = {}
    for field in value.strip().split(";"):
        if "=" in field:
            key, item = field.split("=", 1)
            result[key] = unquote(item)
    return result


def effective_anticodon(amino_acid: str, genomic_anticodon: str) -> str:
    """Returns the modified anticodon used by the bacterial tAI model."""
    anticodon = genomic_anticodon
    if anticodon.startswith("A"):
        anticodon = "I" + anticodon[1:]
    # Ile-CAT is modified at C34 to lysidine. It decodes ATA, not ATG; the
    # same raw CAT anticodon occurs in two Met tRNAs and must remain distinct.
    if (amino_acid, anticodon) == LYSIDINE_TRNA:
        return "LAT"
    return anticodon


def parse_gff(
    path: Path, genomes: Mapping[str, str]
) -> tuple[dict[str, dict], dict[str, int], dict[tuple[str, str], int]]:
    """Reads CDS annotations and derives tRNA anticodons from GFF coordinates."""
    cds = {}
    anticodons: collections.Counter[str] = collections.Counter()
    trna_species: collections.Counter[tuple[str, str]] = collections.Counter()
    with gzip.open(path, "rt") as handle:
        for line in handle:
            if line.startswith("#"):
                continue
            fields = line.rstrip().split("\t")
            if len(fields) != 9 or fields[2] not in {"CDS", "tRNA"}:
                continue
            seqid, _, kind, start, end, _, strand, _, raw_attributes = fields
            attributes = parse_attributes(raw_attributes)
            start_i, end_i = int(start), int(end)
            if kind == "tRNA":
                match = re.search(
                    r"(?:complement\()?([0-9]+)\.\.([0-9]+)",
                    attributes.get("anticodon", ""),
                )
                if match:
                    anticodon = genomes[seqid][int(match.group(1)) - 1 : int(match.group(2))]
                    if "complement" in attributes["anticodon"]:
                        anticodon = str(Seq(anticodon).reverse_complement())
                    amino_acid = attributes["product"].removeprefix("tRNA-")
                    trna_species[(amino_acid, anticodon)] += 1
                    # NCBI records genomic bases. Apply the two standard bacterial
                    # wobble-position modifications needed by the dos-Reis model.
                    anticodons[effective_anticodon(amino_acid, anticodon)] += 1
                continue
            locus = attributes.get("locus_tag")
            if not locus:
                continue
            entry = cds.setdefault(
                locus,
                {
                    "id": locus,
                    "name": attributes.get("gene"),
                    "product": attributes.get("product", ""),
                    "proteinId": attributes.get("protein_id"),
                    "seqid": seqid,
                    "start": start_i,
                    "end": end_i,
                    "strand": strand,
                    "pseudo": attributes.get("pseudo") == "true",
                    "proteinCoding": attributes.get(
                        "gene_biotype", "protein_coding"
                    )
                    == "protein_coding",
                    "translationalException": (
                        attributes["exception"].replace(" ", "_")
                        if "exception" in attributes
                        else None
                    ),
                },
            )
            entry["start"] = min(entry["start"], start_i)
            entry["end"] = max(entry["end"], end_i)
            if attributes.get("exception"):
                entry["translationalException"] = attributes["exception"].replace(
                    " ", "_"
                )
    return cds, dict(anticodons), dict(trna_species)


def verified_trna_species(path: Path) -> dict[tuple[str, str], int]:
    """Loads the independently verified tRNA species table."""
    with path.open(encoding="utf-8", newline="") as handle:
        rows = csv.DictReader(handle, delimiter="\t")
        return {
            (row["amino_acid"], row["anticodon"]): int(row["gene_copies"])
            for row in rows
        }


def load_expression(directory: Path) -> tuple[dict[str, float], str]:
    """Loads one generic expression table and derives its dataset identifier."""
    tables = sorted(directory.glob("*.tsv"))
    if len(tables) != 1:
        raise ValueError(
            f"Expected exactly one expression TSV in {directory}, found {len(tables)}"
        )
    with tables[0].open(encoding="utf-8", newline="") as handle:
        rows = csv.DictReader(handle, delimiter="\t")
        if rows.fieldnames != ["locus_tag", "abundance", "source_gene_id"]:
            raise ValueError(f"Unexpected expression columns: {rows.fieldnames}")
        values = {row["locus_tag"]: float(row["abundance"]) for row in rows}
    source_id = tables[0].stem.split("_", 1)[0]
    require(bool(source_id), f"Cannot derive an expression source ID from {tables[0].name}")
    return values, source_id


def expression_percentiles(values: Mapping[str, float]) -> dict[str, float]:
    """Returns average-rank percentiles (rank / N), including ties."""
    ordered = sorted(values.items(), key=lambda item: item[1])
    result = {}
    start = 0
    while start < len(ordered):
        end = start + 1
        while end < len(ordered) and ordered[end][1] == ordered[start][1]:
            end += 1
        average_rank = ((start + 1) + end) / 2
        for locus, _ in ordered[start:end]:
            result[locus] = average_rank / len(ordered)
        start = end
    return result


def zero_one_ranks(values: Mapping[str, float]) -> dict[str, float]:
    """Returns tie-aware average ranks scaled to the closed interval [0, 1]."""
    ordered = sorted(values.items(), key=lambda item: item[1])
    if len(ordered) == 1:
        return {ordered[0][0]: 0.5}
    result = {}
    start = 0
    while start < len(ordered):
        end = start + 1
        while end < len(ordered) and ordered[end][1] == ordered[start][1]:
            end += 1
        average_zero_based_rank = (start + end - 1) / 2
        for key, _ in ordered[start:end]:
            result[key] = average_zero_based_rank / (len(ordered) - 1)
        start = end
    return result


def expression_proxy_scores(genes: Iterable[Mapping[str, Any]]) -> dict[str, float]:
    """Ranks the geometric mean of each gene's CAI and tAI on [0, 1]."""
    combined = {
        gene["id"]: math.sqrt(gene["cai"] * gene["tai"])
        for gene in genes
    }
    return zero_one_ranks(combined)


def codon_occurrences(sequences: Iterable[str]) -> dict[str, dict[str, int]]:
    """Counts literal codons in total and after excluding initiation position zero."""
    total: collections.Counter[str] = collections.Counter()
    editable: collections.Counter[str] = collections.Counter()
    for sequence in sequences:
        codons = fm.split_codons(sequence, remove_stop=False)
        total.update(codons)
        editable.update(codons[1:])
    return {
        codon: {"total": total[codon], "editable": editable[codon]}
        for codon in fm.CODONS
    }


def fasta_dict(path: Path) -> dict[str, str]:
    """Returns FASTA records keyed by their first identifier."""
    with gzip.open(path, "rt") as handle:
        return {record.id: str(record.seq).upper() for record in SeqIO.parse(handle, "fasta")}


def cds_records(path: Path) -> list[dict[str, str]]:
    """Reads NCBI CDS FASTA records and extracts bracketed metadata."""
    records = []
    with gzip.open(path, "rt") as handle:
        for record in SeqIO.parse(handle, "fasta"):
            metadata = dict(re.findall(r"\[([^=\]]+)=([^\]]*)\]", record.description))
            metadata["sequence"] = str(record.seq).upper()
            records.append(metadata)
    return records


def cds_segments(location: str) -> list[list[int]] | None:
    """Returns explicit one-based closed segments for a joined CDS location."""
    if "join(" not in location:
        return None
    return [
        [int(start), int(end)]
        for start, end in re.findall(r"(\d+)\.\.(\d+)", location)
    ]


def exclusion_reason(sequence: str, annotation: Mapping[str, Any]) -> str | None:
    """Returns the first failed frozen-contract inclusion condition."""
    if set(sequence) - set("ACGT"):
        return "ambiguous_base"
    if len(sequence) % 3:
        return "length_not_multiple_of_3"
    codons = fm.split_codons(sequence, remove_stop=False)
    if not codons or codons[-1] not in fm.TABLE.stop_codons:
        return "missing_terminal_stop"
    if any(codon in fm.TABLE.stop_codons for codon in codons[:-1]):
        return "internal_stop"
    if not annotation.get("proteinCoding", True):
        return "not_protein_coding"
    if annotation.get("pseudo", False):
        return "pseudogene"
    return None


def circular_slice(sequence: str, start: int, end: int) -> str:
    """Slices a circular sequence using zero-based half-open coordinates."""
    size = len(sequence)
    return "".join(sequence[index % size] for index in range(start, end))


def start_window(annotation: Mapping[str, Any], genome: str) -> str:
    """Returns the oriented -30:+60 window around the translation start."""
    if annotation["strand"] == "+":
        return circular_slice(genome, annotation["start"] - 31, annotation["start"] - 1 + 60)
    raw = circular_slice(genome, annotation["end"] - 60, annotation["end"] + 30)
    return str(Seq(raw).reverse_complement())


def codon_frequencies(sequences: Iterable[str]) -> tuple[collections.Counter, dict[str, float]]:
    """Returns counts and within-amino-acid codon frequencies."""
    counts = collections.Counter(
        codon for sequence in sequences for codon in fm.translated_codons(sequence)
    )
    frequencies = {}
    for family in fm.SYNONYMS.values():
        total = sum(counts[codon] for codon in family)
        frequencies.update({codon: counts[codon] / total if total else 0.0 for codon in family})
    return counts, frequencies


def replacement_map(counts: Mapping[str, int]) -> dict[str, str]:
    """Maps each codon to the most-used synonymous alternative, deterministically."""
    result = {}
    for codon in fm.CODONS:
        family = (
            fm.TABLE.stop_codons
            if codon in fm.TABLE.stop_codons
            else fm.SYNONYMS[fm.AA_BY_CODON[codon]]
        )
        alternatives = [item for item in family if item != codon]
        result[codon] = max(
            alternatives or [codon],
            key=lambda item: (counts.get(item, 0), -fm.CODONS.index(item)),
        )
    return result


def pair_scores(sequences: Iterable[str]) -> dict[tuple[str, str], float]:
    """Builds Coleman-style codon-pair log odds conditioned on amino-acid pairs."""
    codon_counts: collections.Counter[str] = collections.Counter()
    aa_counts: collections.Counter[str] = collections.Counter()
    pair_counts: collections.Counter[tuple[str, str]] = collections.Counter()
    aa_pair_counts: collections.Counter[tuple[str, str]] = collections.Counter()
    for sequence in sequences:
        codons = fm.translated_codons(sequence)
        codon_counts.update(codons)
        aa_counts.update(fm.AA_BY_CODON[c] for c in codons)
        pair_counts.update(zip(codons, codons[1:]))
        aa_pair_counts.update(
            (fm.AA_BY_CODON[a], fm.AA_BY_CODON[b])
            for a, b in zip(codons, codons[1:])
        )
    scores = {}
    for first in fm.SENSE_CODONS:
        for second in fm.SENSE_CODONS:
            aa_first, aa_second = fm.AA_BY_CODON[first], fm.AA_BY_CODON[second]
            expected = aa_pair_counts[(aa_first, aa_second)]
            if aa_counts[aa_first] and aa_counts[aa_second]:
                expected *= codon_counts[first] / aa_counts[aa_first]
                expected *= codon_counts[second] / aa_counts[aa_second]
            else:
                expected = 0.0
            scores[(first, second)] = math.log(
                (pair_counts[(first, second)] + 0.5) / (expected + 0.5)
            )
    return scores


def gene_pair_metrics(sequence: str, scores: Mapping[tuple[str, str], float]) -> dict[str, float]:
    """Summarizes codon-pair scores for a gene."""
    codons = fm.translated_codons(sequence)
    values = [scores[pair] for pair in zip(codons, codons[1:])]
    return {
        "cps": sum(values) / len(values) if values else 0.0,
        "underrepresentedPairFraction": (
            sum(value < 0 for value in values) / len(values) if values else 0.0
        ),
    }


def add_context(
    genes: list[dict[str, Any]], replicon_lengths: Mapping[str, int] | None = None
) -> None:
    """Adds circular-neighbor and same-strand <=100-nt operon context."""
    operon_number = 0
    for seqid in sorted({gene["seqid"] for gene in genes}):
        ordered = sorted(
            (gene for gene in genes if gene["seqid"] == seqid),
            key=lambda item: item.get("_contextStart", item["start"]),
        )
        replicon_length = replicon_lengths.get(seqid) if replicon_lengths else None

        def gap_after(index: int) -> int | None:
            if index + 1 < len(ordered):
                next_start = ordered[index + 1].get(
                    "_contextStart", ordered[index + 1]["start"]
                )
            elif replicon_length is not None:
                next_start = ordered[0].get("_contextStart", ordered[0]["start"])
                next_start += replicon_length
            else:
                return None
            current_end = ordered[index].get("_contextEnd", ordered[index]["end"])
            return next_start - current_end - 1

        gaps = [gap_after(index) for index in range(len(ordered))]
        for index, gene in enumerate(ordered):
            lower_gap = gaps[index - 1] if index or replicon_length is not None else None
            upper_gap = gaps[index]
            if gene["strand"] == "+":
                upstream, downstream = lower_gap, upper_gap
            else:
                upstream, downstream = upper_gap, lower_gap
            gene["neighborUpstreamNt"] = upstream
            gene["neighborDownstreamNt"] = downstream
            gene["overlapsNeighbor"] = (
                upstream is not None and upstream < 0
            ) or (downstream is not None and downstream < 0)
        parents = list(range(len(ordered)))

        def find(index: int) -> int:
            while parents[index] != index:
                parents[index] = parents[parents[index]]
                index = parents[index]
            return index

        def union(first: int, second: int) -> None:
            first_root, second_root = find(first), find(second)
            if first_root != second_root:
                parents[second_root] = first_root

        edge_count = len(ordered) if replicon_length is not None else len(ordered) - 1
        for index in range(edge_count):
            next_index = (index + 1) % len(ordered)
            gap = gaps[index]
            if (
                gap is not None
                and gap <= OPERON_GAP
                and ordered[index]["strand"] == ordered[next_index]["strand"]
            ):
                union(index, next_index)

        components: dict[int, list[int]] = collections.defaultdict(list)
        for index in range(len(ordered)):
            components[find(index)].append(index)
        for indexes in sorted(components.values(), key=min):
            group = [ordered[index] for index in indexes]
            if len(group) > 1:
                operon_number += 1
                ordered_indexes = sorted(indexes)
                if replicon_length is not None and len(ordered_indexes) < len(ordered):
                    modular_gaps = [
                        (
                            (ordered_indexes[(offset + 1) % len(ordered_indexes)] - index)
                            % len(ordered),
                            offset,
                        )
                        for offset, index in enumerate(ordered_indexes)
                    ]
                    _, break_offset = max(modular_gaps)
                    start = (break_offset + 1) % len(ordered_indexes)
                    ordered_indexes = ordered_indexes[start:] + ordered_indexes[:start]
                transcription_order = [ordered[index] for index in ordered_indexes]
                if transcription_order[0]["strand"] == "-":
                    transcription_order.reverse()
                for position, gene in enumerate(transcription_order, 1):
                    gene.update(
                        operonId=f"op_{operon_number:04d}",
                        operonPosition=position,
                        operonSize=len(group),
                    )
            else:
                group[0].update(operonId=None, operonPosition=None, operonSize=1)


def round_floats(value: Any) -> Any:
    """Recursively rounds finite floats for stable, compact JSON."""
    if isinstance(value, float):
        return round(value, 6) if math.isfinite(value) else None
    if isinstance(value, list):
        return [round_floats(item) for item in value]
    if isinstance(value, dict):
        return {key: round_floats(item) for key, item in value.items()}
    return value


def checksum(path: Path) -> str:
    """Returns a file's MD5 checksum, matching the NCBI manifest."""
    digest = hashlib.md5(usedforsecurity=False)
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def build(raw_dir: Path, output_dir: Path) -> tuple[list[dict], list[dict], dict, dict]:
    """Builds and writes all four contracted JSON documents."""
    paths = {
        suffix: raw_dir / f"{PREFIX}{suffix}.gz"
        for suffix in (
            "genomic.fna",
            "genomic.gff",
            "cds_from_genomic.fna",
            "protein.faa",
        )
    }
    genomes = fasta_dict(paths["genomic.fna"])
    observed_total_length = sum(map(len, genomes.values()))
    require(
        observed_total_length == TOTAL_LENGTH,
        f"Genome length {observed_total_length:,} != expected {TOTAL_LENGTH:,}",
    )
    annotations, anticodon_counts, trna_species = parse_gff(
        paths["genomic.gff"], genomes
    )
    repository = Path(__file__).resolve().parents[1]
    verified_trna = verified_trna_species(
        repository / "data/trna/anticodon_gene_copies.tsv"
    )
    require(
        trna_species == verified_trna,
        f"Derived tRNA species differ from verified table: {trna_species!r}",
    )
    raw_records = cds_records(paths["cds_from_genomic.fna"])
    require(
        len(raw_records) == 2722,
        f"Observed {len(raw_records)} CDS records; expected 2,722",
    )
    included, excluded = [], []
    for record in raw_records:
        locus, sequence = record["locus_tag"], record["sequence"]
        annotation = annotations[locus]
        reason = exclusion_reason(sequence, annotation)
        if reason:
            excluded.append({"id": locus, "reason": reason, "lengthNt": len(sequence)})
        else:
            segments = cds_segments(record.get("location", ""))
            context_start, context_end = annotation["start"], annotation["end"]
            display_start, display_end = context_start, context_end
            replicon_length = len(genomes[annotation["seqid"]])
            if segments and context_end > replicon_length:
                display_start = min(start for start, _ in segments)
                display_end = max(end for _, end in segments)
            included.append(
                {
                    **annotation,
                    "sequence": sequence,
                    "cdsSegments": segments,
                    "_displayStart": display_start,
                    "_displayEnd": display_end,
                    "_contextStart": context_start,
                    "_contextEnd": context_end,
                }
            )
    require(
        len(included) + len(excluded) == len(raw_records),
        "Included and excluded CDS counts do not reconcile with the input",
    )
    require(
        2650 <= len(included) <= 2725,
        f"Included gene count {len(included)} is outside contract range [2650, 2725]",
    )
    terminal_stops = collections.Counter(gene["sequence"][-3:] for gene in included)
    require(
        terminal_stops == {"TAG": 1071, "TAA": 895, "TGA": 749},
        f"Unexpected terminal-stop distribution: {dict(terminal_stops)}",
    )

    expression, expression_source_id = load_expression(repository / "data/expression")
    percentiles = expression_percentiles(expression)

    sequences = [gene["sequence"] for gene in included]
    occurrences = codon_occurrences(sequences)
    counts, frequencies = codon_frequencies(sequences)
    counts.update(terminal_stops)
    references = [
        gene
        for gene in included
        if is_cai_reference(gene["product"])
    ]
    if len(references) < 30:
        raise ValueError("CAI reference selection unexpectedly produced fewer than 30 genes")
    reference_counts, _ = codon_frequencies(gene["sequence"] for gene in references)
    reference_counts.update(gene["sequence"][-3:] for gene in references)
    cai = fm.cai_weights(gene["sequence"] for gene in references)
    tai, tai_zero_substitution = fm.tai_weights_with_substitution(
        anticodon_counts, S_VALUES
    )
    pairs = pair_scores(sequences)

    genes = []
    for source in included:
        sequence = source["sequence"]
        identity_fields = (
            "id",
            "name",
            "product",
            "seqid",
            "strand",
            "translationalException",
            "cdsSegments",
        )
        values: dict[str, Any] = {key: source[key] for key in identity_fields}
        values["start"] = source["_displayStart"]
        values["end"] = source["_displayEnd"]
        values["terminalStop"] = sequence[-3:]
        values.update(fm.composition(sequence))
        values["enc"], values["encHasSubstitutedFamilies"] = (
            fm.effective_number_of_codons_with_substitution(sequence)
        )
        values["encExpected"] = fm.expected_enc(fm.silent_gc3(sequence))
        values["deltaEnc"] = values["encExpected"] - values["enc"]
        values["cai"] = fm.codon_adaptation_index(sequence, cai)
        values["tai"] = fm.trna_adaptation_index(sequence, tai)
        values["expression"] = expression.get(source["id"])
        values["expressionPercentile"] = percentiles.get(source["id"])
        values["expressionSourceId"] = (
            expression_source_id if values["expression"] is not None else None
        )
        values.update(fm.rare_codon_metrics(sequence, frequencies, tai, RARE_THRESHOLD))
        values.update(gene_pair_metrics(sequence, pairs))
        values["mfeStart"] = RNA.fold(start_window(source, genomes[source["seqid"]]))[1]
        values["mfeFirst100"] = RNA.fold(sequence[:100])[1]
        values.update(fm.local_gc(sequence))
        values["rscu"] = fm.rscu(sequence)
        values["codons"] = fm.pack_codons(sequence)
        reconstructed = fm.unpack_codons(values["codons"]) + values["terminalStop"]
        require(
            reconstructed == sequence,
            f"Packed CDS round trip failed for {source['id']}",
        )
        values["_contextStart"] = source["_contextStart"]
        values["_contextEnd"] = source["_contextEnd"]
        genes.append(values)
    proxy_scores = expression_proxy_scores(genes)
    for gene in genes:
        gene["expressionProxy"] = proxy_scores[gene["id"]]
        gene["expressionBasis"] = (
            "measured" if gene["expression"] is not None else "proxy"
        )
    add_context(genes, {seqid: len(sequence) for seqid, sequence in genomes.items()})
    for gene in genes:
        del gene["_contextStart"]
        del gene["_contextEnd"]

    rscu_matrix = np.asarray([gene["rscu"] for gene in genes])
    scaled_rscu = StandardScaler().fit_transform(rscu_matrix)
    pca = PCA(n_components=6, random_state=UMAP_SEED).fit(scaled_rscu)
    coordinates = pca.transform(scaled_rscu)
    for gene, point in zip(genes, coordinates, strict=True):
        gene["codonPca"] = point.tolist()
    risk_fields = [
        "gc", "gc1", "gc2", "gc3", "enc", "cai", "tai", "rareFraction",
        "longestRareRun", "minLocalTai", "cps", "underrepresentedPairFraction",
        "mfeStart", "mfeFirst100", "minLocalGc", "maxLocalGc", "gc5prime",
    ]
    risk = StandardScaler().fit_transform(
        [[gene[field] for field in risk_fields] for gene in genes]
    )
    embedding = umap.UMAP(
        n_components=2,
        random_state=UMAP_SEED,
        n_neighbors=15,
        min_dist=0.1,
        n_jobs=1,
    ).fit_transform(risk)
    for gene, point in zip(genes, embedding, strict=True):
        gene["riskUmap"] = point.tolist()

    codon_pca = {
        "explainedVariance": pca.explained_variance_ratio_.tolist(),
        "loadings": [
            {"codon": codon, "aa": fm.AA_BY_CODON[codon], "pc": pca.components_[:, index].tolist()}
            for index, codon in enumerate(fm.RSCU_ORDER)
        ],
        "nComponents": 6,
    }
    metric_labels = {
        "gc": ("GC", "fraction"),
        "gc1": ("GC1", "fraction"),
        "gc2": ("GC2", "fraction"),
        "gc3": ("GC3", "fraction"),
        "a3": ("A3", "fraction"),
        "t3": ("T3", "fraction"),
        "g3": ("G3", "fraction"),
        "c3": ("C3", "fraction"),
        "enc": ("ENC", "codons"),
        "encExpected": ("Expected ENC", "codons"),
        "deltaEnc": ("Expected ENC − observed", "codons"),
        "cai": ("CAI", "index"),
        "tai": ("tAI", "index"),
        "expression": ("Expression (PCC 7942)", "normalized count"),
        "expressionPercentile": ("Expression percentile (PCC 7942)", "fraction"),
        "rareFraction": ("Rare codon fraction", "fraction"),
        "rareCount": ("Rare codons", "count"),
        "longestRareRun": ("Longest rare run", "codons"),
        "rampRareCount": ("Rare codons in first 50", "count"),
        "minLocalTai": ("Minimum local tAI", "index"),
        "cps": ("Codon-pair score", "log odds"),
        "underrepresentedPairFraction": (
            "Underrepresented pair fraction", "fraction"
        ),
        "mfeStart": ("Start-region MFE", "kcal/mol"),
        "mfeFirst100": ("First-100-nt MFE", "kcal/mol"),
        "minLocalGc": ("Minimum local GC", "fraction"),
        "maxLocalGc": ("Maximum local GC", "fraction"),
        "gc5prime": ("5′ GC", "fraction"),
        "lengthNt": ("CDS length", "nt"),
        "lengthCodons": ("Protein length", "codons"),
        "neighborUpstreamNt": ("Upstream-neighbor distance", "nt"),
        "neighborDownstreamNt": ("Downstream-neighbor distance", "nt"),
        "operonPosition": ("Operon position", "index"),
        "operonSize": ("Operon size", "genes"),
    }
    meta = {
        "schemaVersion": 1,
        "builtAt": datetime.datetime.now(datetime.timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
        "genome": {"accession": ACCESSION, "taxid": 1350461, "totalLength": TOTAL_LENGTH},
        "sourceChecksums": {
            path.name: checksum(path)
            for path in sorted(raw_dir.iterdir())
            if path.is_file()
        },
        "geneCount": len(genes),
        "codonAlphabet": [
            {"sym": symbol, "codon": codon, "aa": fm.AA_BY_CODON[codon]}
            for symbol, codon in zip(fm.SYMBOLS, fm.CODONS, strict=True)
        ],
        "codonOccurrences": occurrences,
        "rscuOrder": list(fm.RSCU_ORDER),
        "defaultReplacement": replacement_map(counts),
        "highExpressedReplacement": replacement_map(reference_counts),
        "caiReferenceSet": {
            "method": "ribosomal+housekeeping product-name match",
            "locusTags": [gene["id"] for gene in references],
            "n": len(references),
            "zeroCountAdjustment": 0.5,
        },
        "tai": {
            "method": "dos Reis genomic anticodon copy number",
            "sValues": S_VALUES,
            "tRNAGeneCopies": anticodon_counts,
            "zeroWeightSubstitution": tai_zero_substitution,
            "zeroWeightCodons": [
                codon
                for codon in fm.SENSE_CODONS
                if fm.trna_adaptiveness(codon, anticodon_counts, S_VALUES) == 0
            ],
            "excludedAminoAcids": ["M"],
            "lysidineConvention": (
                "Ile-CAT is represented as LAT and decodes ATA with s=0.89; "
                "Met-CAT remains a separate two-copy species decoding ATG"
            ),
        },
        "expressionSource": {
            "accession": expression_source_id,
            "organismMeasured": "Synechococcus elongatus PCC 7942",
            "isTargetOrganism": False,
            "condition": "WT, fresh BG-11, day 1, mean of 3 replicates",
            "normalization": "DESeq2 normalized counts",
            "coverage": {"withValue": len(expression), "total": len(genes)},
            "caveat": (
                "Measured in PCC 7942, not UTEX 2973, in a biofilm study. "
                "Use as a rough guide only."
            ),
            "provenanceDoc": "data/expression/PROVENANCE.md",
        },
        "expressionProxy": {
            "method": (
                "tie-aware average rank of sqrt(CAI * tAI), scaled across all genes "
                "to the closed interval [0, 1]"
            ),
            "range": [0, 1],
            "meaning": (
                "codon-adaptation proxy rank, not transcript or protein abundance"
            ),
            "coverage": {"withValue": len(genes), "total": len(genes)},
        },
        "rareCodonThreshold": RARE_THRESHOLD,
        "umap": {"seed": UMAP_SEED, "features": risk_fields},
        "operon": {"method": "adjacent same-strand CDS", "maximumIntergenicNt": OPERON_GAP},
        "localGcWindowNt": 30,
        "deltaEncConvention": "expected Wright neutral-curve ENC minus observed ENC",
        "encFamilyConvention": (
            "families with fewer than two observations use the mean F of estimable "
            "families in the same degeneracy class; an entirely unestimable class "
            "uses neutral F=1/k"
        ),
        "encExpectedGc3Convention": "GC3s over synonymous sites, excluding Met and Trp",
        "rscuAbsentFamilyConvention": "zero for every codon in an absent amino-acid family",
        "metrics": {
            key: {
                "label": label,
                "unit": unit,
                "desc": METRIC_DEFINITIONS[key],
                "scale": "diverging" if key in DIVERGING_METRICS else "sequential",
                "missingPolicy": MISSING_POLICY,
                "direction": "contextual",
            }
            for key, (label, unit) in metric_labels.items()
        },
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    documents = {
        "genes.json": genes,
        "excluded.json": excluded,
        "meta.json": meta,
        "codon_pca.json": codon_pca,
    }
    for name, document in documents.items():
        content = json.dumps(round_floats(document), separators=(",", ":")) + "\n"
        (output_dir / name).write_text(content, encoding="utf-8")
    return genes, excluded, meta, codon_pca


def main() -> None:
    """Command-line entry point."""
    repository = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--raw-dir",
        type=Path,
        default=repository / "data/raw",
    )
    parser.add_argument("--output-dir", type=Path, default=repository / "site/data")
    args = parser.parse_args()
    genes, excluded, _, _ = build(args.raw_dir, args.output_dir)
    print(f"Wrote {len(genes)} genes and {len(excluded)} exclusions to {args.output_dir}")


if __name__ == "__main__":
    main()
