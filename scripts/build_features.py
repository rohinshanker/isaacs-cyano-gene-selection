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
REFERENCE_PATTERNS = (
    "ribosomal protein",
    "translation elongation factor",
    "translation initiation factor",
    "translation termination factor",
    "chaperonin",
    "dna-directed rna polymerase subunit",
    "atp synthase subunit",
)


def parse_attributes(value: str) -> dict[str, str]:
    """Parses a GFF3 attribute column."""
    result = {}
    for field in value.strip().split(";"):
        if "=" in field:
            key, item = field.split("=", 1)
            result[key] = unquote(item)
    return result


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
                    if anticodon.startswith("A"):
                        anticodon = "I" + anticodon[1:]
                    # Ile-CAT is modified at C34 to lysidine. It decodes ATA, not
                    # ATG; the same raw CAT anticodon occurs in two Met tRNAs.
                    if (amino_acid, anticodon) == LYSIDINE_TRNA:
                        anticodon = "LAT"
                    anticodons[anticodon] += 1
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
                },
            )
            entry["start"] = min(entry["start"], start_i)
            entry["end"] = max(entry["end"], end_i)
    return cds, dict(anticodons), dict(trna_species)


def verified_trna_species(path: Path) -> dict[tuple[str, str], int]:
    """Loads the independently verified tRNA species table."""
    with path.open(encoding="utf-8", newline="") as handle:
        rows = csv.DictReader(handle, delimiter="\t")
        return {
            (row["amino_acid"], row["anticodon"]): int(row["gene_copies"])
            for row in rows
        }


def load_expression(directory: Path) -> dict[str, float]:
    """Loads the single generic three-column expression table in a directory."""
    tables = sorted(directory.glob("*.tsv"))
    if len(tables) != 1:
        raise ValueError(
            f"Expected exactly one expression TSV in {directory}, found {len(tables)}"
        )
    with tables[0].open(encoding="utf-8", newline="") as handle:
        rows = csv.DictReader(handle, delimiter="\t")
        if rows.fieldnames != ["locus_tag", "abundance", "source_gene_id"]:
            raise ValueError(f"Unexpected expression columns: {rows.fieldnames}")
        return {row["locus_tag"]: float(row["abundance"]) for row in rows}


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
    counts = collections.Counter(c for sequence in sequences for c in fm.split_codons(sequence))
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
        codons = fm.split_codons(sequence)
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
    codons = fm.split_codons(sequence)
    values = [scores[pair] for pair in zip(codons, codons[1:])]
    return {
        "cps": sum(values) / len(values) if values else 0.0,
        "underrepresentedPairFraction": (
            sum(value < 0 for value in values) / len(values) if values else 0.0
        ),
    }


def add_context(genes: list[dict[str, Any]]) -> None:
    """Adds genomic-neighbor and same-strand <=100-nt operon context."""
    operon_number = 0
    for seqid in sorted({gene["seqid"] for gene in genes}):
        ordered = sorted(
            (gene for gene in genes if gene["seqid"] == seqid),
            key=lambda item: item["start"],
        )
        for index, gene in enumerate(ordered):
            lower_gap = (
                gene["start"] - ordered[index - 1]["end"] - 1
                if index
                else None
            )
            upper_gap = (
                ordered[index + 1]["start"] - gene["end"] - 1
                if index + 1 < len(ordered)
                else None
            )
            if gene["strand"] == "+":
                upstream, downstream = lower_gap, upper_gap
            else:
                upstream, downstream = upper_gap, lower_gap
            gene["neighborUpstreamNt"] = upstream
            gene["neighborDownstreamNt"] = downstream
            gene["overlapsNeighbor"] = (
                upstream is not None and upstream < 0
            ) or (downstream is not None and downstream < 0)
        index = 0
        while index < len(ordered):
            group = [ordered[index]]
            while index + 1 < len(ordered):
                gap = ordered[index + 1]["start"] - ordered[index]["end"] - 1
                if ordered[index + 1]["strand"] != ordered[index]["strand"] or gap > OPERON_GAP:
                    break
                index += 1
                group.append(ordered[index])
            if len(group) > 1:
                operon_number += 1
                transcription_order = (
                    group if group[0]["strand"] == "+" else list(reversed(group))
                )
                for position, gene in enumerate(transcription_order, 1):
                    gene.update(
                        operonId=f"op_{operon_number:04d}",
                        operonPosition=position,
                        operonSize=len(group),
                    )
            else:
                group[0].update(operonId=None, operonPosition=None, operonSize=1)
            index += 1


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
    assert sum(map(len, genomes.values())) == TOTAL_LENGTH
    annotations, anticodon_counts, trna_species = parse_gff(
        paths["genomic.gff"], genomes
    )
    repository = Path(__file__).resolve().parents[1]
    verified_trna = verified_trna_species(
        repository / "data/trna/anticodon_gene_copies.tsv"
    )
    assert trna_species == verified_trna
    raw_records = cds_records(paths["cds_from_genomic.fna"])
    assert len(raw_records) == 2722
    included, excluded = [], []
    for record in raw_records:
        locus, sequence = record["locus_tag"], record["sequence"]
        annotation = annotations[locus]
        reason = exclusion_reason(sequence, annotation)
        if reason:
            excluded.append({"id": locus, "reason": reason, "lengthNt": len(sequence)})
        else:
            included.append({**annotation, "sequence": sequence})
    assert len(included) + len(excluded) == 2722
    assert len(included) == 2715

    expression = load_expression(repository / "data/expression")
    percentiles = expression_percentiles(expression)
    assert len(expression) == 2551

    sequences = [gene["sequence"] for gene in included]
    counts, frequencies = codon_frequencies(sequences)
    references = [
        gene
        for gene in included
        if any(pattern in gene["product"].lower() for pattern in REFERENCE_PATTERNS)
    ]
    if len(references) < 30:
        raise ValueError("CAI reference selection unexpectedly produced fewer than 30 genes")
    reference_counts, _ = codon_frequencies(gene["sequence"] for gene in references)
    cai = fm.cai_weights(gene["sequence"] for gene in references)
    tai = fm.tai_weights(anticodon_counts, S_VALUES)
    pairs = pair_scores(sequences)

    genes = []
    for source in included:
        sequence = source["sequence"]
        identity_fields = ("id", "name", "product", "seqid", "start", "end", "strand")
        values: dict[str, Any] = {key: source[key] for key in identity_fields}
        values.update(fm.composition(sequence))
        values["enc"] = fm.effective_number_of_codons(sequence)
        values["encExpected"] = fm.expected_enc(values["gc3"])
        values["deltaEnc"] = values["encExpected"] - values["enc"]
        values["cai"] = fm.codon_adaptation_index(sequence, cai)
        values["tai"] = fm.trna_adaptation_index(sequence, tai)
        values["expression"] = expression.get(source["id"])
        values["expressionPercentile"] = percentiles.get(source["id"])
        values.update(fm.rare_codon_metrics(sequence, frequencies, tai, RARE_THRESHOLD))
        values.update(gene_pair_metrics(sequence, pairs))
        values["mfeStart"] = RNA.fold(start_window(source, genomes[source["seqid"]]))[1]
        values["mfeFirst100"] = RNA.fold(sequence[:100])[1]
        values.update(fm.local_gc(sequence))
        values["rscu"] = fm.rscu(sequence)
        values["codons"] = fm.pack_codons(sequence)
        genes.append(values)
    add_context(genes)

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
            "unavailableWeightFloor": 0.01,
            "lysidineConvention": (
                "Ile-CAT is represented as LAT and decodes ATA with s=0.89; "
                "Met-CAT remains a separate two-copy species decoding ATG"
            ),
        },
        "expressionSource": {
            "accession": "GSE205444",
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
        "rareCodonThreshold": RARE_THRESHOLD,
        "umap": {"seed": UMAP_SEED, "features": risk_fields},
        "operon": {"method": "adjacent same-strand CDS", "maximumIntergenicNt": OPERON_GAP},
        "localGcWindowNt": 30,
        "deltaEncConvention": "expected Wright neutral-curve ENC minus observed ENC",
        "rscuAbsentFamilyConvention": "zero for every codon in an absent amino-acid family",
        "metrics": {
            key: {"label": label, "unit": unit, "desc": label}
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
        default=Path(
            "/Users/Rohin/Desktop/coding_stuff/ISAACS-LAB/"
            "isaacs-cyano-gene-selection/data/raw"
        ),
    )
    parser.add_argument("--output-dir", type=Path, default=repository / "site/data")
    args = parser.parse_args()
    genes, excluded, _, _ = build(args.raw_dir, args.output_dir)
    print(f"Wrote {len(genes)} genes and {len(excluded)} exclusions to {args.output_dir}")


if __name__ == "__main__":
    main()
