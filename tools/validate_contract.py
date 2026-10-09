#!/usr/bin/env python3
"""Validates generated site data against the frozen data contract.

This is the coordinator's integration gate. It is deliberately independent of
``scripts/build_features.py``: it re-derives what it can from the raw genome and
from first principles rather than trusting the pipeline's own assertions. A
pipeline bug that is mirrored in the pipeline's own tests should still fail here.

Usage:
    tools/validate_contract.py [--data-dir site/data] [--raw-dir data/raw]

Exits 0 when every check passes, 1 otherwise. Every failure is reported; the
script does not stop at the first one.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import math
import os
import re
import collections
import sys
from typing import Any, Callable, Iterable, Iterator, Sequence
from urllib.parse import unquote

ROOT = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from organisms import OrganismConfig, get_organism  # noqa: E402

ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
BASES = "TCAG"
AMINO_ACIDS = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"
STOP_CODONS = ("TAA", "TAG", "TGA")
# Owner decision, 2026-10-05: the core payload is budgeted per gene, so the gate
# scales with an organism's gene count and still catches growth in the schema.
GENES_JSON_BYTES_PER_GENE = 2_000
# Where the per-gene RSCU vectors are published. Nothing in the browser reads
# one, so they ride apart from the file the map waits for; the column order
# stays in meta.rscuOrder. Named here rather than imported from the pipeline,
# like every other expectation in this file.
RSCU_PAYLOAD = "codon_rscu.json"

# Public compatibility names used by focused validator tests and small local
# tools. Their values remain the historical default organism; organism-aware
# validation takes an explicit ``OrganismConfig`` below.
DEFAULT_ORGANISM = get_organism()
ASSEMBLY = DEFAULT_ORGANISM.accession
ASSEMBLY_PREFIX = DEFAULT_ORGANISM.assemblyPrefix
EXPECTED_TOTAL_LENGTH = DEFAULT_ORGANISM.expectedTotalLength
EXPECTED_CDS_RECORDS = DEFAULT_ORGANISM.expectedCdsRecords
GENE_COUNT_RANGE = tuple(DEFAULT_ORGANISM.geneCountRange)
EXPECTED_TERMINAL_STOPS = DEFAULT_ORGANISM.expectedTerminalStops
EXPECTED_SPLICED = set(DEFAULT_ORGANISM.expectedSpliced)
EXPECTED_EXCEPTIONS = DEFAULT_ORGANISM.expectedExceptions

# The contract permits metrics serialised at six decimal places. Two such values
# summed against a third can therefore disagree by about 1.5e-6 through rounding
# alone. Anything looser than this catches real arithmetic bugs; anything tighter
# flags honest rounding. Do not reduce this to 1e-6.
ROUNDING_TOLERANCE = 1e-5

# Plausible ranges for scalar metrics. A value outside these is a bug, not an
# unusual gene. Bounds are inclusive and deliberately generous.
METRIC_RANGES: dict[str, tuple[float, float]] = {
    "gc": (0.0, 1.0),
    "gc1": (0.0, 1.0),
    "gc2": (0.0, 1.0),
    "gc3": (0.0, 1.0),
    "a3": (0.0, 1.0),
    "t3": (0.0, 1.0),
    "g3": (0.0, 1.0),
    "c3": (0.0, 1.0),
    "enc": (20.0, 61.0),
    "encExpected": (20.0, 61.0),
    "deltaEnc": (-41.0, 41.0),
    "cai": (0.0, 1.0),
    "tai": (0.0, 1.0),
    "rareFraction": (0.0, 1.0),
    "underrepresentedPairFraction": (0.0, 1.0),
    "minLocalGc": (0.0, 1.0),
    "maxLocalGc": (0.0, 1.0),
    "gc5prime": (0.0, 1.0),
    "minLocalTai": (0.0, 1.0),
    "mfeStart": (-200.0, 0.0),
    "mfeFirst100": (-200.0, 0.0),
}

REQUIRED_GENE_FIELDS = (
    "id", "name", "product", "seqid", "start", "end", "strand",
    "lengthNt", "lengthCodons", "gc", "gc1", "gc2", "gc3",
    "a3", "t3", "g3", "c3", "enc", "encExpected", "deltaEnc", "cai", "tai",
    "rareFraction", "rareCount", "longestRareRun", "rampRareCount", "minLocalTai",
    "cps", "underrepresentedPairFraction", "mfeStart", "mfeFirst100",
    "minLocalGc", "maxLocalGc", "gc5prime",
    "neighborUpstreamNt", "neighborDownstreamNt", "overlapsNeighbor",
    "operonId", "operonPosition", "operonSize",
    "codonPca", "riskUmap", "codons",
    "terminalStop", "translationalException", "cdsSegments", "rnaContext",
)

def codon_table() -> dict[str, str]:
    """Returns the standard genetic code keyed by codon, in TCAG order."""
    table: dict[str, str] = {}
    index = 0
    for first in BASES:
        for second in BASES:
            for third in BASES:
                table[first + second + third] = AMINO_ACIDS[index]
                index += 1
    return table


def codon_order() -> list[str]:
    """Returns all 64 codons in the canonical TCAG index order."""
    return [a + b + c for a in BASES for b in BASES for c in BASES]


def genes_json_budget_bytes(gene_count: int) -> int:
    """Returns the largest permitted genes.json size for a gene count."""
    return GENES_JSON_BYTES_PER_GENE * gene_count


class Report:
    """Accumulates pass/fail results so every check runs before exiting."""

    def __init__(self) -> None:
        self.failures: list[str] = []
        self.passes: list[str] = []
        self.skips: list[str] = []

    def check(self, condition: bool, label: str, detail: str = "") -> bool:
        if condition:
            self.passes.append(label)
        else:
            self.failures.append(f"{label}{': ' + detail if detail else ''}")
        return condition

    def fail(self, label: str, detail: str = "") -> None:
        self.check(False, label, detail)

    def skip(self, label: str, reason: str) -> None:
        self.skips.append(f"{label}: {reason}")

    def emit(self) -> int:
        for line in self.passes:
            print(f"PASS  {line}")
        for line in self.skips:
            print(f"SKIP  {line}")
        for line in self.failures:
            print(f"FAIL  {line}")
        print(
            f"\npassed={len(self.passes)} failed={len(self.failures)} "
            f"skipped={len(self.skips)}"
        )
        return 1 if self.failures else 0


def check_genes_json_budget(report: Report, size_bytes: int, gene_count: int) -> bool:
    """Checks genes.json against the per-gene budget.

    The figures are part of the label, so a passing run reports them too.
    """
    limit = genes_json_budget_bytes(gene_count)
    return report.check(
        size_bytes <= limit,
        f"genes.json is within the {GENES_JSON_BYTES_PER_GENE:,}-byte-per-gene budget: "
        f"{size_bytes:,} bytes for {gene_count:,} genes; the limit is {limit:,} bytes",
    )


def load_json(path: str, report: Report) -> Any:
    if not os.path.exists(path):
        report.fail(f"{os.path.basename(path)} exists", f"missing at {path}")
        return None
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except json.JSONDecodeError as error:
        report.fail(f"{os.path.basename(path)} parses", str(error))
        return None


def read_fasta(path: str) -> Iterator[tuple[str, str]]:
    """Yields (header, sequence) from a gzipped FASTA file."""
    opener: Callable[..., Any] = gzip.open if path.endswith(".gz") else open
    name: str | None = None
    chunks: list[str] = []
    with opener(path, "rt") as handle:
        for line in handle:
            if line.startswith(">"):
                if name is not None:
                    yield name, "".join(chunks)
                name, chunks = line[1:].strip(), []
            else:
                chunks.append(line.strip())
    if name is not None:
        yield name, "".join(chunks)


def validate_meta(
    meta: Any, report: Report, organism: OrganismConfig = DEFAULT_ORGANISM
) -> dict[str, Any] | None:
    """Checks meta.json structure and the codon alphabet's internal consistency."""
    if not isinstance(meta, dict):
        report.fail("meta.json is an object")
        return None

    report.check(meta.get("schemaVersion") == 1, "meta.schemaVersion is 1",
                 repr(meta.get("schemaVersion")))

    genome = meta.get("genome", {})
    report.check(genome.get("accession") == organism.accession,
                 "meta.genome.accession is the genome of record",
                 f"got {genome.get('accession')!r}, expected {organism.accession!r}")
    report.check(genome.get("taxid") == organism.taxid,
                 f"meta.genome.taxid is {organism.taxid}",
                 repr(genome.get("taxid")))
    report.check(genome.get("totalLength") == organism.expectedTotalLength,
                 f"meta.genome.totalLength is {organism.expectedTotalLength:,}",
                 repr(genome.get("totalLength")))

    alphabet = meta.get("codonAlphabet")
    if not isinstance(alphabet, list) or len(alphabet) != 64:
        report.fail("meta.codonAlphabet has 64 entries",
                    f"got {len(alphabet) if isinstance(alphabet, list) else type(alphabet)}")
        return meta

    table = codon_table()
    expected_codons = codon_order()
    symbol_problems: list[str] = []
    codon_problems: list[str] = []
    aa_problems: list[str] = []
    for index, entry in enumerate(alphabet):
        if entry.get("sym") != ALPHABET[index]:
            symbol_problems.append(
                f"index {index}: sym {entry.get('sym')!r} != {ALPHABET[index]!r}")
        if entry.get("codon") != expected_codons[index]:
            codon_problems.append(
                f"index {index}: codon {entry.get('codon')!r} != {expected_codons[index]!r}")
        codon = entry.get("codon")
        if codon in table and entry.get("aa") != table[codon]:
            aa_problems.append(
                f"{codon}: aa {entry.get('aa')!r} != {table[codon]!r}")

    report.check(not symbol_problems, "meta.codonAlphabet symbols match the contract",
                 "; ".join(symbol_problems[:3]))
    report.check(not codon_problems, "meta.codonAlphabet uses TCAG index order",
                 "; ".join(codon_problems[:3]))
    report.check(not aa_problems, "meta.codonAlphabet translations are correct",
                 "; ".join(aa_problems[:3]))

    rscu_order = meta.get("rscuOrder")
    report.check(isinstance(rscu_order, list) and len(rscu_order) == 59,
                 "meta.rscuOrder has 59 codons",
                 f"got {len(rscu_order) if isinstance(rscu_order, list) else type(rscu_order)}")
    if isinstance(rscu_order, list):
        stops_present = [c for c in rscu_order if c in STOP_CODONS]
        report.check(not stops_present, "meta.rscuOrder excludes stop codons",
                     f"found {stops_present}")
        singletons = [c for c in rscu_order if c in ("ATG", "TGG")]
        report.check(not singletons,
                     "meta.rscuOrder excludes single-codon amino acids Met and Trp",
                     f"found {singletons}")

    for field in ("defaultReplacement", "highExpressedReplacement"):
        mapping = meta.get(field)
        if not isinstance(mapping, dict):
            report.fail(f"meta.{field} is an object", repr(type(mapping)))
            continue
        non_synonymous = [
            f"{src}->{dst}" for src, dst in mapping.items()
            if src in table and dst in table and table[src] != table[dst]
        ]
        report.check(not non_synonymous, f"meta.{field} replacements are synonymous",
                     "; ".join(non_synonymous[:5]))

    metrics = meta.get("metrics")
    report.check(isinstance(metrics, dict) and len(metrics) > 0,
                 "meta.metrics is a non-empty object")
    if isinstance(metrics, dict):
        missing_labels = [k for k, v in metrics.items()
                          if not isinstance(v, dict) or not v.get("label")]
        report.check(not missing_labels, "every meta.metrics entry has a label",
                     f"missing for {missing_labels[:5]}")

        # A description that restates its label teaches nothing: the detail panel
        # then "explains" GC as "GC". Every metric needs a real definition giving
        # the quantity, its range or window, its source, and any caveat.
        echoed = [k for k, v in metrics.items() if isinstance(v, dict)
                  and str(v.get("desc", "")).strip().lower()
                  == str(v.get("label", "")).strip().lower()]
        report.check(not echoed,
                     "no metric description merely restates its label",
                     f"{len(echoed)} of {len(metrics)} do, e.g. {echoed[:4]}")

        thin = [k for k, v in metrics.items() if isinstance(v, dict)
                and len(str(v.get("desc", "")).strip()) < 40 and k not in echoed]
        report.check(not thin,
                     "every metric description is substantive",
                     f"{len(thin)} under 40 characters, e.g. {thin[:4]}")

        valid_scales = {"sequential", "diverging"}
        bad_scale = [k for k, v in metrics.items() if isinstance(v, dict)
                     and v.get("scale") not in valid_scales]
        report.check(not bad_scale,
                     "every metric declares a sequential or diverging colour scale",
                     f"{len(bad_scale)} do not, e.g. {bad_scale[:4]}")

    # Occurrences must be published as total and editable, because the initiation
    # triplet can never be recoded and quoting the raw total overstates the burden.
    occurrences = meta.get("codonOccurrences")
    if isinstance(occurrences, dict) and occurrences:
        shape_problems = [c for c, v in occurrences.items()
                          if not isinstance(v, dict)
                          or not isinstance(v.get("total"), int)
                          or not isinstance(v.get("editable"), int)
                          or v["editable"] > v["total"]]
        report.check(not shape_problems,
                     "codonOccurrences gives total and editable per codon",
                     f"malformed: {shape_problems[:4]}")
    else:
        report.fail("meta.codonOccurrences is present",
                    "required so the interface can quote editable, not raw, counts")

    tai = meta.get("tai", {})
    report.check(isinstance(tai, dict) and isinstance(tai.get("sValues"), dict),
                 "meta.tai.sValues is recorded")
    reference = meta.get("caiReferenceSet", {})
    tags = reference.get("locusTags") if isinstance(reference, dict) else None
    report.check(isinstance(tags, list) and len(tags) >= 20,
                 "meta.caiReferenceSet lists at least 20 locus tags",
                 f"got {len(tags) if isinstance(tags, list) else type(tags)}")
    return meta


def spliced_loci(
    raw_dir: str, organism: OrganismConfig = DEFAULT_ORGANISM
) -> set[str]:
    """Returns locus tags whose CDS is a join of non-adjacent genomic segments.

    These genes are shorter than their genomic span, so the usual
    ``end - start + 1 == lengthNt`` identity does not hold for them. In this
    genome the set is small and biologically real: ``M744_RS00920`` is ``prfB``,
    whose peptide chain release factor 2 is produced by a programmed ribosomal
    frameshift that skips a single base.
    """
    path = os.path.join(
        raw_dir, f"{organism.assemblyPrefix}_cds_from_genomic.fna.gz"
    )
    if not os.path.exists(path):
        return set()
    tags: set[str] = set()
    with gzip.open(path, "rt") as handle:
        for line in handle:
            if not line.startswith(">") or "join(" not in line:
                continue
            match = re.search(r"\[locus_tag=([^\]]+)\]", line)
            if match:
                tags.add(match.group(1))
    return tags


def decode_rna_context(gene: dict[str, Any]) -> tuple[str, str, list[int]]:
    """Validate either context form; return full CDS, WT window and CDS offsets.

    This uses only the frozen alphabet and standard-library operations, not the
    producer's decoder. Booleans are deliberately not accepted as integer offsets.
    """
    packed, stop = gene.get("codons"), gene.get("terminalStop")
    if not isinstance(packed, str) or not packed or set(packed) - set(ALPHABET):
        raise ValueError("cannot reconstruct a valid packed CDS")
    lookup = dict(zip(ALPHABET, codon_order()))
    sense = [lookup[symbol] for symbol in packed]
    if stop not in STOP_CODONS or any(codon in STOP_CODONS for codon in sense):
        raise ValueError("CDS must have exactly one terminal stop")
    cds = "".join(sense) + stop
    context = gene.get("rnaContext")
    if not isinstance(context, dict):
        raise ValueError("rnaContext must be an object")
    if set(context) == {"upstream"}:
        upstream = context["upstream"]
        if not isinstance(upstream, str) or re.fullmatch(r"[ACGT]{30}", upstream) is None:
            raise ValueError("upstream must contain exactly 30 ACGT bases")
        if len(cds) < 60:
            raise ValueError("short CDS requires the explicit 90-base context form")
        return cds, upstream + cds[:60], [-1] * 30 + list(range(60))
    if set(context) != {"sequence", "cdsOffsets"}:
        raise ValueError("rnaContext must use exactly one contracted form and no extra fields")
    sequence, offsets = context["sequence"], context["cdsOffsets"]
    if not isinstance(sequence, str) or re.fullmatch(r"[ACGT]{90}", sequence) is None:
        raise ValueError("sequence must contain exactly 90 ACGT bases")
    if not isinstance(offsets, list) or len(offsets) != 90:
        raise ValueError("cdsOffsets must be an array of exactly 90 integers")
    if any(type(offset) is not int or not -1 <= offset < len(cds) for offset in offsets):
        raise ValueError("cdsOffsets must be integers in [-1, full CDS length)")
    mapped = [offset for offset in offsets if offset >= 0]
    if len(set(mapped)) != len(mapped):
        raise ValueError("cdsOffsets must not repeat a mapped CDS position")
    if offsets[30] != 0:
        raise ValueError("translation-start base must map to CDS offset zero")
    if any(offset >= 0 and sequence[index] != cds[offset]
           for index, offset in enumerate(offsets)):
        raise ValueError("mapped context base differs from the full CDS")
    restored = "".join(base if offset == -1 else cds[offset]
                       for base, offset in zip(sequence, offsets))
    return cds, restored, offsets


def ordered_cds_positions(
    rows: list[tuple[str, int, int, str]], genome_length: int, strand: str
) -> list[int]:
    """Returns CDS genomic positions in translation order on a circular replicon.

    GFF rows need not be in biological order. The unique largest inter-segment
    gap is treated as the region outside the CDS, so an origin-spanning join is
    rotated to begin at its true translation-start segment on either strand.
    """
    direction = 1 if strand == "+" else -1
    oriented_segments: list[list[int]] = []
    for _, start, end, _ in rows:
        if start < 1 or end < start or end - start + 1 > genome_length:
            raise ValueError("invalid raw GFF CDS coordinates")
        if strand == "+":
            segment = [position % genome_length for position in range(start - 1, end)]
        else:
            segment = [
                position % genome_length
                for position in range(end - 1, start - 2, -1)
            ]
        oriented_segments.append(segment)

    all_positions = [position for segment in oriented_segments for position in segment]
    if len(set(all_positions)) != len(all_positions):
        raise ValueError("raw CDS repeats a genomic position")
    if len(oriented_segments) == 1:
        return all_positions

    oriented_segments.sort(key=lambda segment: segment[0], reverse=strand == "-")
    gaps = []
    for index, segment in enumerate(oriented_segments):
        next_segment = oriented_segments[(index + 1) % len(oriented_segments)]
        steps = (direction * (next_segment[0] - segment[-1])) % genome_length
        gaps.append(steps - 1)
    largest_gap = max(gaps)
    if gaps.count(largest_gap) != 1:
        raise ValueError("ambiguous circular CDS segment order")
    first = (gaps.index(largest_gap) + 1) % len(oriented_segments)
    ordered = oriented_segments[first:] + oriented_segments[:first]
    return [position for segment in ordered for position in segment]


def cross_check_rna_context(genes: list[dict[str, Any]], raw_dir: str,
                            report: Report, sequence_context: Any = None,
                            organism: OrganismConfig = DEFAULT_ORGANISM) -> None:
    """Independently check context and edit maps using raw genomic FASTA and GFF.

    GFF extended coordinates may pass the circular origin. Multiple CDS rows
    are concatenated in transcription order, including genuine internal joins.
    The start window remains genomic; it does not splice out intervening bases.
    """
    genome_path = os.path.join(
        raw_dir, f"{organism.assemblyPrefix}_genomic.fna.gz"
    )
    gff_path = os.path.join(raw_dir, f"{organism.assemblyPrefix}_genomic.gff.gz")
    cds_path = os.path.join(
        raw_dir, f"{organism.assemblyPrefix}_cds_from_genomic.fna.gz"
    )
    label = "RNA contexts and CDS maps reproduce raw strand-oriented genomic windows"
    missing = [path for path in (genome_path, gff_path) if not os.path.exists(path)]
    if missing:
        report.skip(label, "missing raw input: " + ", ".join(missing))
        return
    annotations: dict[str, list[tuple[str, int, int, str]]] = collections.defaultdict(list)
    loci = {gene.get("id") for gene in genes if isinstance(gene, dict)}
    try:
        genomes = {header.split()[0]: sequence.upper()
                   for header, sequence in read_fasta(genome_path)}
        selected_proteins: dict[str, tuple[int, str]] = {}
        if os.path.exists(cds_path):
            for header, sequence in read_fasta(cds_path):
                locus_match = re.search(r"\[locus_tag=([^\]]+)\]", header)
                protein_match = re.search(r"\[protein_id=([^\]]+)\]", header)
                if not locus_match or not protein_match:
                    continue
                locus = locus_match.group(1)
                if len(sequence) > selected_proteins.get(locus, (0, ""))[0]:
                    selected_proteins[locus] = (len(sequence), protein_match.group(1))
        with gzip.open(gff_path, "rt") as handle:
            for line in handle:
                if line.startswith("#") or not line.strip():
                    continue
                fields = line.rstrip().split("\t")
                if len(fields) != 9 or fields[2] != "CDS":
                    continue
                attributes = dict(part.split("=", 1) for part in fields[8].split(";") if "=" in part)
                locus = unquote(attributes.get("locus_tag", ""))
                selected = selected_proteins.get(locus)
                protein_id = unquote(attributes.get("protein_id", ""))
                if locus in loci and (selected is None or protein_id == selected[1]):
                    annotations[locus].append((fields[0], int(fields[3]), int(fields[4]), fields[6]))
    except (OSError, ValueError) as error:
        report.fail(label, f"cannot read raw genomic input: {error}")
        return
    problems = []
    complement = str.maketrans("ACGT", "TGCA")
    for gene in genes:
        if not isinstance(gene, dict):
            continue
        gid = gene.get("id")
        try:
            cds, observed, observed_offsets = decode_rna_context(gene)
            rows = annotations.get(gid, [])
            if not rows:
                raise ValueError("no raw GFF CDS annotation")
            seqid, _, _, strand = rows[0]
            if strand not in ("+", "-") or any(row[0] != seqid or row[3] != strand for row in rows):
                raise ValueError("inconsistent GFF replicon or strand")
            if gene.get("seqid") != seqid or gene.get("strand") != strand:
                raise ValueError("published replicon or strand differs from raw GFF")
            genome = genomes.get(seqid, "")
            if not genome:
                raise ValueError("missing raw genomic sequence")
            positions = ordered_cds_positions(rows, len(genome), strand)
            raw_cds = "".join(genome[position] for position in positions)
            if set(raw_cds) - set("ACGT"):
                raise ValueError("ambiguous raw genomic sequence in CDS")
            if strand == "-":
                raw_cds = raw_cds.translate(complement)
            if raw_cds != cds:
                raise ValueError("packed CDS differs from raw GFF genomic segments")
            # Use raw annotation coordinates, not the site's display coordinates:
            # an origin-spanning gene's displayed min/max may span the replicon.
            anchor = positions[0]
            direction = 1 if strand == "+" else -1
            window_positions = [(anchor + direction * delta) % len(genome) for delta in range(-30, 60)]
            expected = "".join(genome[position] for position in window_positions)
            if set(expected) - set("ACGT"):
                raise ValueError("ambiguous raw genomic sequence in start window")
            if strand == "-":
                expected = expected.translate(complement)
            if observed != expected:
                raise ValueError("WT start window differs from raw genomic -30:+60")
            offset_by_position = {position: offset for offset, position in enumerate(positions)}
            expected_offsets = [offset_by_position.get(position, -1) for position in window_positions]
            if observed_offsets != expected_offsets:
                raise ValueError("CDS edit map differs from raw genomic positions")
            if sequence_context is not None:
                max_upstream = sequence_context["maxUpstreamNt"]
                index = sequence_context["geneIds"].index(gid)
                expanded_positions = [
                    (anchor + direction * delta) % len(genome)
                    for delta in range(-max_upstream, 0)
                ]
                expanded = "".join(genome[position] for position in expanded_positions)
                if strand == "-":
                    expanded = expanded.translate(complement)
                if sequence_context["upstream"][index] != expanded:
                    raise ValueError("expanded upstream sequence differs from raw genome")
        except ValueError as error:
            problems.append(f"{gid}: {error}")
    report.check(not problems, label, f"{len(problems)} problems, e.g. {problems[:3]}")


def validate_sequence_context(payload: Any, genes: list[dict[str, Any]],
                              report: Report, organism: OrganismConfig) -> None:
    """Validate the optional long upstream payload against genes.json."""
    label = "expanded upstream sequences follow the configured sidecar contract"
    if organism.sequenceContextNt <= 30:
        report.check(payload is None, label, "payload published for a 30 nt-only organism")
        return
    if not isinstance(payload, dict):
        report.fail(label, "sequence_context.json is not an object")
        return
    ids = payload.get("geneIds")
    upstream = payload.get("upstream")
    expected_ids = [gene.get("id") for gene in genes]
    valid = (
        payload.get("schemaVersion") == 1
        and payload.get("maxUpstreamNt") == organism.sequenceContextNt
        and payload.get("origin") == "computed"
        and isinstance(payload.get("producer"), str)
        and bool(payload.get("producer"))
        and ids == expected_ids
        and isinstance(upstream, list)
        and len(upstream) == len(genes)
    )
    problems = []
    if valid:
        for gene, sequence in zip(genes, upstream, strict=True):
            if not isinstance(sequence, str) or len(sequence) != organism.sequenceContextNt \
                    or re.fullmatch(r"[ACGT]+", sequence) is None:
                problems.append(f"{gene.get('id')}: invalid sequence")
                continue
            try:
                _, core_window, _ = decode_rna_context(gene)
            except ValueError as error:
                problems.append(f"{gene.get('id')}: {error}")
                continue
            if sequence[-30:] != core_window[:30]:
                problems.append(f"{gene.get('id')}: core 30 nt suffix mismatch")
    report.check(valid and not problems, label,
                 f"invalid header or {len(problems)} sequences, e.g. {problems[:3]}")


def validate_genes(genes: Any, meta: dict[str, Any], report: Report,
                   spliced: set[str],
                   organism: OrganismConfig = DEFAULT_ORGANISM) -> None:
    """Checks per-gene records for structure, ranges, and codon-string integrity."""
    if not isinstance(genes, list):
        report.fail("genes.json is an array", repr(type(genes)))
        return

    low, high = organism.geneCountRange
    report.check(low <= len(genes) <= high,
                 f"gene count is within [{low}, {high}]", f"got {len(genes)}")

    identifiers = [g.get("id") for g in genes if isinstance(g, dict)]
    report.check(len(identifiers) == len(set(identifiers)),
                 "gene ids are unique",
                 f"{len(identifiers) - len(set(identifiers))} duplicates")

    symbol_to_codon = {e["sym"]: e["codon"] for e in meta.get("codonAlphabet", [])
                       if isinstance(e, dict) and "sym" in e and "codon" in e}

    missing_fields: dict[str, int] = {}
    range_problems: list[str] = []
    length_problems: list[str] = []
    codon_char_problems: list[str] = []
    stop_in_body: list[str] = []
    umap_problems: list[str] = []
    composition_problems: list[str] = []
    coordinate_problems: list[str] = []
    rna_context_problems: list[str] = []

    for gene in genes:
        if not isinstance(gene, dict):
            report.fail("every gene record is an object")
            continue
        gid = gene.get("id", "<no id>")
        try:
            decode_rna_context(gene)
        except ValueError as error:
            rna_context_problems.append(f"{gid}: {error}")

        for field in REQUIRED_GENE_FIELDS:
            if field not in gene:
                missing_fields[field] = missing_fields.get(field, 0) + 1

        for field, (lo, hi) in METRIC_RANGES.items():
            value = gene.get(field)
            if value is None:
                continue
            if not isinstance(value, (int, float)) or isinstance(value, bool):
                range_problems.append(f"{gid}.{field} is {type(value).__name__}")
            elif math.isnan(value) or math.isinf(value):
                range_problems.append(f"{gid}.{field} is {value}")
            elif not lo <= value <= hi:
                range_problems.append(f"{gid}.{field}={value} outside [{lo}, {hi}]")

        codons = gene.get("codons")
        length_codons = gene.get("lengthCodons")
        length_nt = gene.get("lengthNt")
        if isinstance(codons, str) and isinstance(length_codons, int):
            if len(codons) != length_codons:
                length_problems.append(
                    f"{gid}: len(codons)={len(codons)} != lengthCodons={length_codons}")
            bad_chars = set(codons) - set(ALPHABET)
            if bad_chars:
                codon_char_problems.append(f"{gid}: {sorted(bad_chars)[:3]}")
            elif symbol_to_codon:
                decoded = [symbol_to_codon.get(ch, "???") for ch in codons]
                internal_stops = [c for c in decoded if c in STOP_CODONS]
                if internal_stops:
                    stop_in_body.append(f"{gid}: {len(internal_stops)} stop codons in body")
        if isinstance(length_nt, int) and isinstance(length_codons, int):
            # lengthNt includes the terminal stop; codons excludes it.
            if length_nt != (length_codons + 1) * 3:
                length_problems.append(
                    f"{gid}: lengthNt={length_nt} != (lengthCodons+1)*3="
                    f"{(length_codons + 1) * 3}")

        umap = gene.get("riskUmap")
        if not isinstance(umap, list) or len(umap) != 2:
            umap_problems.append(f"{gid}: riskUmap is not a 2-element array")

        for triple, total_key in ((("a3", "t3", "g3", "c3"), None),):
            values = [gene.get(k) for k in triple]
            if all(isinstance(v, (int, float)) for v in values):
                total = sum(values)
                if not math.isclose(total, 1.0, abs_tol=ROUNDING_TOLERANCE):
                    composition_problems.append(f"{gid}: a3+t3+g3+c3={total:.6f}")
        g3, c3, gc3 = gene.get("g3"), gene.get("c3"), gene.get("gc3")
        if all(isinstance(v, (int, float)) for v in (g3, c3, gc3)):
            if not math.isclose(g3 + c3, gc3, abs_tol=ROUNDING_TOLERANCE):
                composition_problems.append(
                    f"{gid}: g3+c3={g3 + c3:.6f} != gc3={gc3:.6f}")

        start, end = gene.get("start"), gene.get("end")
        if isinstance(start, int) and isinstance(end, int):
            if start > end:
                coordinate_problems.append(f"{gid}: start {start} > end {end}")
            elif (gid not in spliced and isinstance(length_nt, int)
                  and (end - start + 1) != length_nt):
                coordinate_problems.append(
                    f"{gid}: end-start+1={end - start + 1} != lengthNt={length_nt}")
        if gene.get("strand") not in ("+", "-"):
            coordinate_problems.append(f"{gid}: strand {gene.get('strand')!r}")

    report.check(not missing_fields, "every gene has all contract fields",
                 "; ".join(f"{k} missing in {v}" for k, v in
                           list(missing_fields.items())[:5]))
    report.check(not rna_context_problems, "RNA contexts have valid forms, bases and CDS offsets",
                 f"{len(rna_context_problems)} problems, e.g. {rna_context_problems[:3]}")
    report.check(not range_problems, "all scalar metrics are finite and in range",
                 f"{len(range_problems)} problems, e.g. {range_problems[:3]}")
    report.check(not length_problems, "codon and nucleotide lengths are consistent",
                 f"{len(length_problems)} problems, e.g. {length_problems[:3]}")
    report.check(not codon_char_problems, "codon strings use only the contract alphabet",
                 f"{len(codon_char_problems)} problems, e.g. {codon_char_problems[:3]}")
    report.check(not stop_in_body, "codon strings contain no internal stop codons",
                 f"{len(stop_in_body)} problems, e.g. {stop_in_body[:3]}")
    report.check(not umap_problems, "riskUmap is a 2-element array everywhere",
                 f"{len(umap_problems)} problems, e.g. {umap_problems[:3]}")
    report.check(not composition_problems, "third-position composition sums correctly",
                 f"{len(composition_problems)} problems, e.g. {composition_problems[:3]}")
    report.check(not coordinate_problems, "coordinates and strand are self-consistent",
                 f"{len(coordinate_problems)} problems, e.g. {coordinate_problems[:3]}")

    # Stop-codon reassignment is a supported scheme, so every gene must carry a
    # recoverable terminal stop and the distribution must be exactly as measured.
    stops = collections.Counter(
        g.get("terminalStop") for g in genes if isinstance(g, dict))
    bad_stops = {s: n for s, n in stops.items() if s not in STOP_CODONS}
    report.check(not bad_stops, "every terminalStop is a real stop codon",
                 f"found {bad_stops}")
    expected_stops = organism.expectedTerminalStops
    report.check(dict(stops) == expected_stops,
                 "terminal stop distribution matches the pinned organism configuration",
                 f"got {dict(stops.most_common())}")

    observed_spliced = {g["id"] for g in genes
                        if isinstance(g, dict) and g.get("cdsSegments")}
    expected_spliced = set(organism.expectedSpliced)
    report.check(observed_spliced == expected_spliced,
                 "cdsSegments names exactly the pinned joined CDSs",
                 f"got {sorted(observed_spliced)}")

    observed_exceptions = {g["id"]: g.get("translationalException") for g in genes
                           if isinstance(g, dict) and g.get("translationalException")}
    expected_exceptions = organism.expectedExceptions
    report.check(observed_exceptions == expected_exceptions,
                 "translationalException matches the pinned exceptional gene models",
                 f"got {observed_exceptions}")

    segment_problems = []
    for gene in genes:
        segments = gene.get("cdsSegments") if isinstance(gene, dict) else None
        if not segments:
            continue
        total = sum(end - start + 1 for start, end in segments)
        if total != gene.get("lengthNt"):
            segment_problems.append(
                f"{gene.get('id')}: segments sum to {total}, lengthNt={gene.get('lengthNt')}")
    report.check(not segment_problems, "cdsSegments lengths sum to lengthNt",
                 "; ".join(segment_problems))

    # Unmeasured expression must stay null. Zero would be a real measurement and
    # would be silently removed by a threshold.
    if any("expression" in g for g in genes if isinstance(g, dict)):
        measured = [g for g in genes if isinstance(g, dict)
                    and g.get("expression") is not None]
        zeros = [g["id"] for g in measured if g.get("expression") == 0]
        report.check(not zeros, "no gene has expression exactly zero",
                     f"{len(zeros)} genes, e.g. {zeros[:3]}")

    # A proxy must never be written into the measured field, and the basis must
    # say which of the two a displayed value came from. Without that the fallback
    # is silent and a codon-adaptation rank reads as an abundance.
    if any("expressionBasis" in g for g in genes if isinstance(g, dict)):
        mismatched = []
        for gene in genes:
            if not isinstance(gene, dict):
                continue
            basis = gene.get("expressionBasis")
            has_measured = gene.get("expression") is not None
            has_proxy = gene.get("expressionProxy") is not None
            if basis == "measured" and not has_measured:
                mismatched.append(f"{gene.get('id')}: basis measured, expression null")
            elif basis == "proxy" and not has_proxy:
                mismatched.append(f"{gene.get('id')}: basis proxy, no expressionProxy")
            elif basis is None and has_measured:
                mismatched.append(f"{gene.get('id')}: measured value with null basis")
            elif basis not in (None, "measured", "proxy"):
                mismatched.append(f"{gene.get('id')}: basis {basis!r}")
        report.check(not mismatched,
                     "expressionBasis agrees with the fields it describes",
                     f"{len(mismatched)} problems, e.g. {mismatched[:3]}")

        sourced = [g["id"] for g in genes if isinstance(g, dict)
                   and g.get("expressionBasis") == "measured"
                   and not g.get("expressionSourceId")]
        report.check(not sourced,
                     "every measured expression names its source dataset",
                     f"{len(sourced)} without one, e.g. {sourced[:3]}")


def validate_distributions(genes: list[dict[str, Any]], meta: dict[str, Any],
                           report: Report) -> None:
    """Smell tests for metrics that are in range but computed by a wrong convention.

    Cross-provider review found two defects that every structural check passed:
    ENC deflated on short genes by treating unestimable synonymous families as
    maximally biased, and tAI using an arbitrary floor for codons with no cognate
    tRNA instead of the dos Reis geometric-mean substitution. Both produced values
    inside their valid ranges and internally consistent with every other field.
    Only the shape of the distribution exposed them.

    These are heuristics, not proofs. Thresholds are deliberately generous so that
    only an egregious artifact trips them, because some genuine correlation between
    codon bias and gene length is expected in real genomes.
    """
    # ENC is inherently noisy on short genes no matter how correct the estimator
    # is: with few codons you cannot observe the full synonymous repertoire, so
    # some families are never seen and must be substituted. Judging the whole
    # genome at once therefore mixes reliable and unreliable estimates and
    # produces a length signal that no estimator can remove. Where the pipeline
    # discloses which genes rest on substituted families, test only the rest.
    reliable = [g for g in genes if not g.get("encHasSubstitutedFamilies")]
    if len(reliable) > 500:
        population = reliable
        scope = f"{len(reliable)} genes with a fully observed codon repertoire"
    else:
        population = genes
        scope = "all genes; no reliability flag present"
    report.check(True, "ENC distribution scope", scope)

    lengths = [g.get("lengthCodons") for g in population]
    encs = [g.get("enc") for g in population]
    pairs = [(x, y) for x, y in zip(lengths, encs)
             if isinstance(x, (int, float)) and isinstance(y, (int, float))]
    if len(pairs) > 100:
        n = len(pairs)
        mx = sum(p[0] for p in pairs) / n
        my = sum(p[1] for p in pairs) / n
        cov = sum((a - mx) * (b - my) for a, b in pairs)
        sx = math.sqrt(sum((a - mx) ** 2 for a, _ in pairs))
        sy = math.sqrt(sum((b - my) ** 2 for _, b in pairs))
        r = cov / (sx * sy) if sx and sy else 0.0
        report.check(abs(r) < 0.25,
                     "ENC is not dominated by gene length",
                     f"Pearson r(lengthCodons, ENC) = {r:.3f}; a large positive value "
                     f"means short genes are being scored as highly biased")

        # The most codon-biased genes should not simply be the shortest genes.
        ranked = sorted((g for g in population if isinstance(g.get("enc"), (int, float))),
                        key=lambda g: g["enc"])[:50]
        top_lengths = sorted(g["lengthCodons"] for g in ranked)
        all_lengths = sorted(p[0] for p in pairs)
        top_median = top_lengths[len(top_lengths) // 2]
        all_median = all_lengths[len(all_lengths) // 2]
        report.check(top_median > all_median * 0.5,
                     "the most codon-biased genes are not merely the shortest",
                     f"top-50 lowest-ENC median length {top_median} vs genome median "
                     f"{all_median}")

    # dos Reis substitutes the geometric mean of non-zero weights for codons with no
    # cognate tRNA. An arbitrary floor understates them and distorts every tAI rank.
    tai = meta.get("tai", {})
    floor = tai.get("unavailableWeightFloor")
    report.check(floor is None,
                 "tAI uses geometric-mean substitution, not an arbitrary floor",
                 f"meta.tai.unavailableWeightFloor = {floor}")


def validate_codon_pca(pca: Any, meta: dict[str, Any], report: Report) -> None:
    """Checks the precomputed native-codon PCA."""
    if not isinstance(pca, dict):
        report.fail("codon_pca.json is an object", repr(type(pca)))
        return

    variance = pca.get("explainedVariance")
    if isinstance(variance, list) and variance:
        descending = all(variance[i] >= variance[i + 1] - 1e-9
                         for i in range(len(variance) - 1))
        report.check(descending, "explainedVariance is non-increasing", str(variance[:5]))
        report.check(all(0.0 <= v <= 1.0 for v in variance),
                     "explainedVariance entries are fractions", str(variance[:5]))
        report.check(sum(variance) <= 1.0 + 1e-6,
                     "explainedVariance sums to at most 1", f"sum={sum(variance):.6f}")
    else:
        report.fail("codon_pca.explainedVariance is a non-empty array")

    loadings = pca.get("loadings")
    rscu_order = meta.get("rscuOrder") or []
    if isinstance(loadings, list):
        report.check(len(loadings) == len(rscu_order),
                     "codon_pca.loadings covers every RSCU codon",
                     f"{len(loadings)} loadings vs {len(rscu_order)} codons")
        loaded = {entry.get("codon") for entry in loadings if isinstance(entry, dict)}
        missing = set(rscu_order) - loaded
        report.check(not missing, "every RSCU codon appears in loadings",
                     f"missing {sorted(missing)[:5]}")
    else:
        report.fail("codon_pca.loadings is an array", repr(type(loadings)))

    # Schema 2 adds the exact fitted transform used by the recoded-genome
    # parent-frame projector. Legacy shipped artifacts remain readable until
    # their next ordinary rebuild; any schema-2 artifact is held to the full
    # reproducibility contract here.
    schema_version = pca.get("schemaVersion")
    if schema_version is None:
        return
    report.check(schema_version == 2, "codon_pca.schemaVersion is 2")
    if schema_version != 2:
        return
    report.check(
        pca.get("projectionType") == "native-fit",
        "codon_pca.projectionType identifies a native fit",
    )
    reference = pca.get("referenceGenome")
    genome = meta.get("genome") or {}
    report.check(
        isinstance(reference, dict)
        and reference.get("genomeAccession") == genome.get("accession")
        and reference.get("taxid") == genome.get("taxid")
        and all(reference.get(key) for key in ("organismId", "label", "strain")),
        "codon_pca.referenceGenome identifies the dataset genome",
    )

    n_components = pca.get("nComponents")
    transform = pca.get("transform")
    if not report.check(
        isinstance(n_components, int)
        and not isinstance(n_components, bool)
        and n_components > 0,
        "codon_pca.nComponents is a positive integer",
    ):
        return
    if not report.check(
        isinstance(transform, dict), "codon_pca.transform is an object"
    ):
        return
    order = transform.get("featureOrder")
    if not report.check(
        order == rscu_order and len(set(order or [])) == len(order or []),
        "codon_pca.transform.featureOrder repeats meta.rscuOrder exactly",
    ):
        return
    width = len(order)

    def finite_vector(value: Any, length: int) -> bool:
        return (
            isinstance(value, list)
            and len(value) == length
            and all(
                not isinstance(item, bool)
                and isinstance(item, (int, float))
                and math.isfinite(item)
                for item in value
            )
        )

    scaler = transform.get("scaler")
    scaler_ok = (
        isinstance(scaler, dict)
        and finite_vector(scaler.get("mean"), width)
        and finite_vector(scaler.get("scale"), width)
        and all(value > 0 for value in scaler["scale"])
    )
    report.check(
        scaler_ok,
        "codon_pca.transform scaler has finite means and positive scales",
    )
    pca_transform = transform.get("pca")
    components = pca_transform.get("components") if isinstance(pca_transform, dict) else None
    pca_ok = (
        isinstance(pca_transform, dict)
        and finite_vector(pca_transform.get("mean"), width)
        and isinstance(components, list)
        and len(components) == n_components
        and all(finite_vector(row, width) for row in components)
    )
    report.check(
        pca_ok,
        "codon_pca.transform PCA has finite centering and component rows",
    )
    if pca_ok and isinstance(loadings, list) and len(loadings) == width:
        loading_order = [
            entry.get("codon") if isinstance(entry, dict) else None
            for entry in loadings
        ]
        loading_values_ok = all(
            isinstance(entry, dict)
            and finite_vector(entry.get("pc"), n_components)
            and all(
                entry["pc"][component] == components[component][feature]
                for component in range(n_components)
            )
            for feature, entry in enumerate(loadings)
        )
        report.check(
            loading_order == order and loading_values_ok,
            "codon_pca.loadings exactly mirror the ordered transform components",
        )


def validate_excluded(
    excluded: Any,
    gene_count: int,
    report: Report,
    organism: OrganismConfig = DEFAULT_ORGANISM,
) -> None:
    """Checks that included and excluded CDSs reconcile against the raw count."""
    if not isinstance(excluded, list):
        report.fail("excluded.json is an array", repr(type(excluded)))
        return

    missing_reason = [e.get("id") for e in excluded
                      if not isinstance(e, dict) or not e.get("reason")]
    report.check(not missing_reason, "every excluded CDS records a reason",
                 f"{len(missing_reason)} without one")

    total = gene_count + len(excluded)
    expected_records = organism.expectedCdsRecords
    report.check(total == expected_records,
                 "included plus excluded reconciles to the pinned CDS record count",
                 f"{gene_count} + {len(excluded)} = {total}")


def cross_check_against_genome(
    genes: list[dict[str, Any]], meta: dict[str, Any], raw_dir: str, report: Report,
    excluded: list[dict[str, Any]],
    organism: OrganismConfig = DEFAULT_ORGANISM,
) -> None:
    """Re-derives protein sequences from packed codons and compares to NCBI's."""
    protein_path = os.path.join(
        raw_dir, f"{organism.assemblyPrefix}_protein.faa.gz"
    )
    cds_path = os.path.join(
        raw_dir, f"{organism.assemblyPrefix}_cds_from_genomic.fna.gz"
    )
    if not os.path.exists(cds_path):
        report.skip("codon strings reproduce NCBI CDS sequences",
                    f"raw CDS file not found at {cds_path}")
        return

    symbol_to_codon = {e["sym"]: e["codon"] for e in meta.get("codonAlphabet", [])
                       if isinstance(e, dict)}
    if not symbol_to_codon:
        report.skip("codon strings reproduce NCBI CDS sequences",
                    "codon alphabet unavailable")
        return

    raw_by_locus: dict[str, list[tuple[str, str | None]]] = (
        collections.defaultdict(list)
    )
    alternate_records = collections.Counter(
        (row.get("id"), row.get("proteinId"), row.get("lengthNt"))
        for row in excluded
        if isinstance(row, dict) and row.get("reason") == "alternate_cds"
    )
    unmatched_alternates = alternate_records.copy()
    by_locus: dict[str, str] = {}
    protein_id_of: dict[str, str] = {}
    for header, sequence in read_fasta(cds_path):
        match = re.search(r"\[locus_tag=([^\]]+)\]", header)
        pid = re.search(r"\[protein_id=([^\]]+)\]", header)
        if match:
            raw_by_locus[match.group(1)].append(
                (sequence.upper(), pid.group(1) if pid else None)
            )

    selection_problems = []
    for locus, candidates in raw_by_locus.items():
        selected = []
        for sequence, protein_id in candidates:
            key = (locus, protein_id, len(sequence))
            if unmatched_alternates[key]:
                unmatched_alternates[key] -= 1
            else:
                selected.append((sequence, protein_id))
        if len(selected) != 1:
            selection_problems.append(f"{locus}: {len(selected)} selected records")
            continue
        by_locus[locus], protein_id = selected[0]
        if protein_id:
            protein_id_of[locus] = protein_id
    leftover_alternates = [
        key for key, count in unmatched_alternates.items() if count
    ]
    report.check(
        not selection_problems and not leftover_alternates,
        "selected CDS records reconcile against excluded.json",
        f"selection problems {selection_problems[:3]}; unmatched alternates "
        f"{leftover_alternates[:3]}",
    )

    direct_total: collections.Counter[str] = collections.Counter()
    direct_editable: collections.Counter[str] = collections.Counter()
    for gene in genes:
        sequence = by_locus.get(gene.get("id"))
        if not sequence:
            continue
        codons = [sequence[index:index + 3] for index in range(0, len(sequence), 3)]
        direct_total.update(codons)
        direct_editable.update(codons[1:])
    direct_occurrences = {
        codon: {"total": direct_total[codon], "editable": direct_editable[codon]}
        for codon in codon_table()
    }
    published_occurrences = meta.get("codonOccurrences")
    comparable_occurrences = (
        published_occurrences if isinstance(published_occurrences, dict) else {}
    )
    report.check(
        published_occurrences == direct_occurrences,
        "codonOccurrences match a direct scan of every selected raw CDS",
        "; ".join(
            f"{codon}: got {comparable_occurrences.get(codon)!r}, "
            f"expected {direct_occurrences[codon]!r}"
            for codon in codon_table()
            if comparable_occurrences.get(codon) != direct_occurrences[codon]
        )[:500],
    )

    checked = mismatched = unmatched = 0
    examples: list[str] = []
    for gene in genes:
        gid = gene.get("id")
        codons = gene.get("codons")
        if not isinstance(gid, str) or not isinstance(codons, str):
            continue
        reference = by_locus.get(gid)
        if reference is None:
            unmatched += 1
            continue
        rebuilt = "".join(symbol_to_codon.get(ch, "???") for ch in codons)
        checked += 1
        # The packed string drops the terminal stop, so a lossless round trip
        # requires terminalStop. This is the check that would have caught the
        # stop-burden defect: without the field, no scheme touching a stop codon
        # can be evaluated at all.
        stop = gene.get("terminalStop") or ""
        if reference != rebuilt + stop:
            mismatched += 1
            if len(examples) < 3:
                examples.append(gid)

    report.check(checked > 0, "matched genes against raw CDS records by locus tag",
                 f"matched {checked}, unmatched {unmatched}")
    report.check(mismatched == 0,
                 "codons plus terminalStop reproduce the raw CDS exactly",
                 f"{mismatched} of {checked} differ, e.g. {examples}")
    report.check(unmatched == 0, "every gene id resolves to a raw CDS record",
                 f"{unmatched} unresolved")

    if not os.path.exists(protein_path):
        report.skip("translated CDSs match NCBI proteins",
                    f"not found at {protein_path}")
        return

    proteins: dict[str, str] = {}
    for header, sequence in read_fasta(protein_path):
        proteins[header.split()[0]] = sequence.upper()

    table = codon_table()
    compared = differing = no_protein = 0
    diff_examples: list[str] = []
    for gene in genes:
        gid = gene.get("id")
        codons = gene.get("codons")
        if not isinstance(gid, str) or not isinstance(codons, str) or not codons:
            continue
        pid = protein_id_of.get(gid)
        reference = proteins.get(pid) if pid else None
        if reference is None:
            no_protein += 1
            continue
        triplets = [symbol_to_codon.get(ch, "???") for ch in codons]
        # Bacterial translation: any annotated initiation triplet reads as
        # methionine at position zero regardless of its internal meaning.
        residues = ["M"] + [table.get(c, "X") for c in triplets[1:]]
        translated = "".join(residues)
        compared += 1
        if translated != reference:
            differing += 1
            if len(diff_examples) < 3:
                diff_examples.append(
                    f"{gid}/{pid}: len {len(translated)} vs {len(reference)}")

    report.check(compared > 0, "translated CDSs were compared to NCBI proteins",
                 f"compared {compared}, no protein record for {no_protein}")
    report.check(differing == 0,
                 "every translated CDS matches its NCBI protein exactly",
                 f"{differing} of {compared} differ, e.g. {diff_examples}")
    report.check(no_protein == 0, "every gene resolves to an NCBI protein record",
                 f"{no_protein} unresolved")

    excluded_loci = {
        row.get("id") for row in excluded
        if isinstance(row, dict) and row.get("reason") != "alternate_cds"
    }
    expected_protein_multiplicity = collections.Counter(
        protein_id
        for locus, protein_id in protein_id_of.items()
        if locus not in excluded_loci
    )
    published_protein_multiplicity = collections.Counter(
        protein_id_of[gene["id"]]
        for gene in genes
        if isinstance(gene, dict) and gene.get("id") in protein_id_of
    )
    report.check(
        published_protein_multiplicity == expected_protein_multiplicity,
        "protein accession multiplicities match the selected raw CDS records",
        "; ".join(
            f"{accession}: got {published_protein_multiplicity[accession]}, "
            f"expected {expected_protein_multiplicity[accession]}"
            for accession in sorted(
                set(published_protein_multiplicity) | set(expected_protein_multiplicity),
                key=str,
            )
            if published_protein_multiplicity[accession]
            != expected_protein_multiplicity[accession]
        )[:500],
    )


GO_IEA_TIERS = ("tested-utex-allele", "admitted-pcc-call", "go-iea-context", "unknown")
# Pinned in docs/validation/go-iea-essentiality-context.md; held here so a
# label is re-derived from its probability instead of trusted.
GO_IEA_THRESHOLDS = {
    "coreProbabilityAtLeast": 0.9,
    "notCoreProbabilityAtMost": 0.2,
    "discrepancyProbabilityAtLeast": 0.8,
}
GO_IEA_JUDGED_DISCREPANCIES = ("utex-product", "pcc7942-product", "reviewed-category")


def go_iea_context_label(p_core: float) -> str:
    """Applies the pinned core-process thresholds to one probability."""
    if p_core >= GO_IEA_THRESHOLDS["coreProbabilityAtLeast"]:
        return "core-cellular-process"
    if p_core <= GO_IEA_THRESHOLDS["notCoreProbabilityAtMost"]:
        return "not-core"
    return "uncertain"


def go_iea_discrepancy_ok(entry: Any, context: Any, status: Any) -> bool:
    """Checks one discrepancy entry against the pinned rules."""
    if not isinstance(entry, dict) or context is None or not entry.get("note"):
        return False
    kind = entry.get("kind")
    probability = entry.get("probability")
    if kind == "pcc7942-call":
        return (probability is None and context.get("label") == "core-cellular-process"
                and status == "non-essential")
    return (kind in GO_IEA_JUDGED_DISCREPANCIES
            and isinstance(probability, (int, float))
            and probability >= GO_IEA_THRESHOLDS["discrepancyProbabilityAtLeast"])


def validate_go_iea_essentiality(data: Any, genes: list[dict[str, Any]],
                                 candidate: Any, report: Report) -> None:
    """Re-derives the essentiality evidence tier independently of its builder."""
    if not report.check(isinstance(data, dict), "GO IEA essentiality is an object"):
        return
    attribution = data.get("attribution") or {}
    report.check(
        attribution.get("creator") == "Gene Ontology Consortium"
        and attribution.get("license") == "CC BY 4.0"
        and attribution.get("notice") == "data/annotation/PROVENANCE.md",
        "GO IEA essentiality carries Gene Ontology CC BY 4.0 attribution",
    )
    report.check(
        (data.get("policy") or {}).get("precedence") == list(GO_IEA_TIERS),
        "GO IEA essentiality precedence is tested > PCC > GO IEA > unknown",
    )
    report.check(
        (data.get("policy") or {}).get("thresholds") == GO_IEA_THRESHOLDS,
        "GO IEA essentiality thresholds match the pinned contract",
    )
    rows = data.get("byLocus")
    gene_ids = [gene.get("id") for gene in genes if isinstance(gene, dict)]
    if not report.check(isinstance(rows, dict) and sorted(rows) == sorted(gene_ids),
                        "GO IEA essentiality covers every plotted CDS exactly"):
        return
    calls = ((candidate or {}).get("borrowedEssentiality") or {}).get("byLocus") or {}
    tested = (candidate or {}).get("testedAlleles") or {}
    wrong_tier, bad_context, tiers = [], [], {tier: 0 for tier in GO_IEA_TIERS}
    wrong_label, bad_discrepancy, missing_call_note = [], [], []
    for locus, row in rows.items():
        context = row.get("goContext")
        if context is not None and not (
            isinstance(context.get("pCore"), (int, float)) and 0 <= context["pCore"] <= 1
        ):
            bad_context.append(locus)
        elif context is not None and context.get("label") != go_iea_context_label(context["pCore"]):
            wrong_label.append(locus)
        status = (calls.get(locus) or {}).get("status")
        discrepancies = row.get("discrepancies")
        if not isinstance(discrepancies, list) or any(
            not go_iea_discrepancy_ok(entry, context, status) for entry in discrepancies
        ):
            bad_discrepancy.append(locus)
        elif (context is not None and context.get("label") == "core-cellular-process"
              and status == "non-essential"
              and not any(entry.get("kind") == "pcc7942-call" for entry in discrepancies)):
            missing_call_note.append(locus)
        if locus in tested:
            expected = "tested-utex-allele"
        elif status in ("essential", "beneficial", "non-essential"):
            expected = "admitted-pcc-call"
        elif context is not None and context.get("label") == "core-cellular-process":
            expected = "go-iea-context"
        else:
            expected = "unknown"
        if row.get("tier") != expected:
            wrong_tier.append(locus)
        tiers[row.get("tier")] = tiers.get(row.get("tier"), 0) + 1
    report.check(not bad_context, "GO IEA core-process probabilities lie in [0, 1]",
                 f"{bad_context[:5]}")
    report.check(not wrong_label,
                 "every GO IEA context label follows its probability at the pinned thresholds",
                 f"{len(wrong_label)} loci, e.g. {wrong_label[:5]}")
    report.check(not bad_discrepancy,
                 "every GO IEA discrepancy meets the pinned threshold or PCC-call rule",
                 f"{len(bad_discrepancy)} loci, e.g. {bad_discrepancy[:5]}")
    report.check(not missing_call_note,
                 "every core-process locus with a non-essential PCC call carries a PCC-call note",
                 f"{len(missing_call_note)} loci, e.g. {missing_call_note[:5]}")
    report.check(not wrong_tier,
                 "every GO IEA essentiality tier follows precedence over candidate evidence",
                 f"{len(wrong_tier)} loci, e.g. {wrong_tier[:5]}")
    report.check((data.get("counts") or {}).get("byTier") == tiers,
                 "GO IEA essentiality tier counts match its records")


DERIVED_SOURCES = ("pcc-7942", "go-iea")
DERIVED_EVIDENCE_LABELS = ["reviewed", "pcc-7942-derived", "go-iea-derived"]
# Pinned in docs/validation/source-derived-categories.md; held here so an
# assigned category is re-derived from its probability instead of trusted.
DERIVED_THRESHOLDS = {"derivedProbabilityAtLeast": 0.8}
UNKNOWN_CATEGORY_ID = "unknown-or-unclassified"
MULTIPLE_CATEGORY_ID = "multiple-functions"


def derived_category_id(entry: Any) -> Any:
    """Applies the pinned assignment rule to one per-source judgment."""
    if not isinstance(entry, dict):
        return None
    most_likely = entry.get("mostLikely")
    probability = entry.get("probability")
    if most_likely == UNKNOWN_CATEGORY_ID or not isinstance(probability, (int, float)):
        return None
    return most_likely if probability >= DERIVED_THRESHOLDS["derivedProbabilityAtLeast"] else None


def resolve_derived_bucket(reviewed: Any, derived_ids: dict[str, Any],
                           enabled: tuple[str, ...]) -> tuple[str, Any, bool]:
    """UTEX > PCC > GO: the highest-priority enabled source colours; others may conflict."""
    ranked = []
    if "utex-2973" in enabled and reviewed:
        ranked.append(("reviewed", MULTIPLE_CATEGORY_ID if len(reviewed) > 1 else reviewed[0]))
    for source in DERIVED_SOURCES:
        if source in enabled and derived_ids.get(source):
            ranked.append((f"{source}-derived", derived_ids[source]))
    if not ranked:
        return UNKNOWN_CATEGORY_ID, None, False
    label, bucket = ranked[0]
    return bucket, label, any(category != bucket for _, category in ranked[1:])


def validate_source_derived_categories(data: Any, genes: list[dict[str, Any]], categories: Any,
                                       pcc: Any, annotations: Any, report: Report) -> None:
    """Re-derives every derived category and the all-sources legend independently."""
    if not report.check(isinstance(data, dict), "source-derived categories is an object"):
        return
    attribution = data.get("attribution") or {}
    report.check(
        (attribution.get("goIea") or {}).get("creator") == "Gene Ontology Consortium"
        and (attribution.get("goIea") or {}).get("license") == "CC BY 4.0",
        "source-derived categories carry Gene Ontology CC BY 4.0 attribution",
    )
    pcc_attribution = attribution.get("pcc7942") or {}
    report.check(
        pcc_attribution.get("license") == "CC BY 4.0"
        and set(pcc_attribution.get("attributedStudies") or []) >= {"Adomako et al. 2022", "Rubin et al. 2015"},
        "source-derived categories carry Adomako/Rubin PCC 7942 attribution",
    )
    policy = data.get("policy") or {}
    report.check(policy.get("evidenceLabels") == DERIVED_EVIDENCE_LABELS,
                 "source-derived evidence labels match the site contract")
    report.check(policy.get("thresholds") == DERIVED_THRESHOLDS,
                 "source-derived category threshold matches the pinned contract")
    vocabulary = (categories or {}).get("vocabulary")
    report.check(vocabulary is not None and data.get("vocabulary") == vocabulary,
                 "source-derived vocabulary equals the reviewed function-category vocabulary")
    category_ids = [entry.get("id") for entry in (vocabulary or {}).get("categories") or []]
    reviewed = {row.get("locusTag"): list(row.get("categoryIds") or [])
                for row in (categories or {}).get("assignments") or []}
    rows = data.get("byLocus")
    gene_ids = [gene.get("id") for gene in genes if isinstance(gene, dict)]
    if not report.check(isinstance(rows, dict) and sorted(rows) == sorted(gene_ids),
                        "source-derived categories cover every plotted CDS exactly"):
        return
    calls = (pcc or {}).get("byLocus") or {}
    wrong_presence, wrong_label, bad_entry = [], [], []
    assigned: dict[str, dict[str, int]] = {source: {} for source in DERIVED_SOURCES}
    both_loci = agree = disagree = conflicts = 0
    legend: dict[str, int] = {}
    evidence_counts: dict[str, int] = {}
    for locus, row in rows.items():
        call = calls.get(locus) or {}
        joined = call.get("mappingStatus") == "accepted"
        has_go = bool(((annotations or {}).get(locus) or {}).get("goAnnotations"))
        pcc_entry = row.get("pcc-7942") if isinstance(row, dict) else None
        go_entry = row.get("go-iea") if isinstance(row, dict) else None
        if (pcc_entry is not None) != joined or (go_entry is not None) != has_go or (
            joined and pcc_entry.get("pccLocusTag") != call.get("pccLocusTag")
        ):
            wrong_presence.append(locus)
        ids: dict[str, Any] = {}
        for source, entry in (("pcc-7942", pcc_entry), ("go-iea", go_entry)):
            if entry is None:
                continue
            probability = entry.get("probability")
            if entry.get("mostLikely") not in category_ids or not isinstance(
                probability, (int, float)
            ) or not 0 <= probability <= 1:
                bad_entry.append(locus)
                continue
            expected = derived_category_id(entry)
            if entry.get("categoryId") != expected:
                wrong_label.append(locus)
            ids[source] = expected
            if expected:
                assigned[source][expected] = assigned[source].get(expected, 0) + 1
        if ids.get("pcc-7942") and ids.get("go-iea"):
            both_loci += 1
            if ids["pcc-7942"] == ids["go-iea"]:
                agree += 1
            else:
                disagree += 1
        bucket, label, conflicting = resolve_derived_bucket(
            reviewed.get(locus), ids, ("utex-2973",) + DERIVED_SOURCES)
        legend[bucket] = legend.get(bucket, 0) + 1
        evidence_counts[label or "none"] = evidence_counts.get(label or "none", 0) + 1
        conflicts += conflicting
    report.check(not wrong_presence,
                 "each derived judgment is present exactly where its source annotates the locus",
                 f"{len(wrong_presence)} loci, e.g. {wrong_presence[:5]}")
    report.check(not bad_entry, "every derived judgment names a vocabulary category with a probability in [0, 1]",
                 f"{bad_entry[:5]}")
    report.check(not wrong_label,
                 "every derived category follows its probability at the pinned threshold",
                 f"{len(wrong_label)} loci, e.g. {wrong_label[:5]}")
    counts = data.get("counts") or {}
    by_source = counts.get("bySource") or {}
    report.check(
        all((by_source.get(source) or {}).get("byCategory") == {
            category: assigned[source].get(category, 0) for category in category_ids[:-1]
        } and (by_source.get(source) or {}).get("assigned") == sum(assigned[source].values())
            for source in DERIVED_SOURCES),
        "per-source assigned category counts match the derived records",
    )
    report.check(counts.get("bothSourcesAssigned") == {"loci": both_loci, "agree": agree, "disagree": disagree},
                 "cross-source agreement counts match the derived records")
    published_legend = counts.get("allSourcesLegend") or {}
    report.check(
        published_legend.get("byCategory") == {category: legend.get(category, 0) for category in category_ids[:-1]}
        and published_legend.get("multipleFunctions") == legend.get(MULTIPLE_CATEGORY_ID, 0)
        and published_legend.get("unknownOrUnclassified") == legend.get(UNKNOWN_CATEGORY_ID, 0)
        and published_legend.get("byEvidence") == evidence_counts
        and published_legend.get("conflicts") == conflicts,
        "the all-sources legend counts follow UTEX > PCC > GO precedence and the conflict rule",
    )
    report.check(evidence_counts.get("reviewed") == len(reviewed),
                 "every reviewed row colours by review under all sources, never by a derived source")


def validate_data_manifest(data_dir: str, report: Report) -> None:
    """Check that data-manifest.json describes exactly the files beside it.

    The browser addresses each data file by the digest this manifest publishes
    and may then answer from its cache without asking the server. That is only
    safe while the manifest matches the files, and several tools rewrite single
    files here without touching ``meta.json``, so a manifest that has fallen
    behind would pin visitors to a superseded file. Recomputed here rather than
    imported from the builder, so a fault in the builder cannot pass its own gate.
    """
    path = os.path.join(data_dir, "data-manifest.json")
    manifest = load_json(path, report)
    if manifest is None:
        return
    listed = manifest.get("files") if isinstance(manifest, dict) else None
    if not report.check(
        isinstance(manifest, dict) and manifest.get("schemaVersion") == 1
        and isinstance(listed, dict),
        "data-manifest.json declares schema 1 and a file table",
    ):
        return
    actual: dict[str, dict[str, Any]] = {}
    for name in sorted(os.listdir(data_dir)):
        if not name.endswith(".json") or name == "data-manifest.json":
            continue
        with open(os.path.join(data_dir, name), "rb") as handle:
            content = handle.read()
        actual[name] = {"bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()}
    stale = sorted(
        name for name in set(actual) | set(listed) if actual.get(name) != listed.get(name)
    )
    report.check(
        not stale,
        "data-manifest.json lists every published JSON file with its exact size and SHA-256",
        f"out of date for {stale}; run tools/build_data_manifest.py build",
    )


# The measured quantities a source may declare, re-stated here rather than
# imported from ``scripts/expression_table.py``, like every other expectation in
# this file: a pipeline that publishes the wrong meaning for a column should
# fail here even when its own tests agree with it.
#
# Each entry is the column the table heads its numbers with, the type-grouping
# kind and reader-facing label per platform, the metric family, whether several
# deposits of the quantity may be pooled into one shown value, the sign
# convention, and the values the quantity admits.
EXPRESSION_QUANTITIES: dict[str, dict[str, Any]] = {
    "rpkm": {
        "column": "abundance", "family": "Expression", "pools": True,
        "signed": False, "logScale": False,
        "platforms": {"RNA-seq": ("abundance", "RNA abundance"),
                      "Ribo-seq": ("occupancy", "Ribosome occupancy")},
        "bounds": {"nonnegative": True, "integral": False, "unitInterval": False},
    },
    "read_count": {
        "column": "read_count", "family": "Expression", "pools": True,
        "signed": False, "logScale": False,
        "platforms": {"RNA-seq": ("read-count", "RNA read count"),
                      "Ribo-seq": ("footprint-count", "Ribosome footprint count")},
        "bounds": {"nonnegative": True, "integral": True, "unitInterval": False},
    },
    "log2_fold_change": {
        "column": "log2_fold_change", "family": "Fold change", "pools": False,
        "signed": True, "logScale": False,
        "platforms": {"RNA-seq": ("log2-fold-change", "RNA log2FC"),
                      "Ribo-seq": ("log2-fold-change", "Ribosome log2FC")},
        "bounds": {"nonnegative": False, "integral": False, "unitInterval": False},
    },
    "edger_log2_fold_change": {
        "column": "log2_fold_change", "family": "Fold change", "pools": False,
        "signed": True, "logScale": False,
        "platforms": {"RNA-seq": ("edger-log2-fold-change", "RNA log2FC (EdgeR)"),
                      "Ribo-seq": ("edger-log2-fold-change", "Ribosome log2FC (EdgeR)")},
        "bounds": {"nonnegative": False, "integral": False, "unitInterval": False},
    },
    "p_value": {
        "column": "p_value", "family": "Significance", "pools": False,
        "signed": False, "logScale": False,
        "platforms": {
            "RNA-seq": ("p-value", "RNA reported P-value (adjustment unspecified)"),
            "Ribo-seq": ("p-value", "Ribosome reported P-value (adjustment unspecified)"),
        },
        "bounds": {"nonnegative": True, "integral": False, "unitInterval": True},
    },
    "translation_efficiency_log2_fold_change": {
        "column": "translation_efficiency_log2_fold_change",
        "family": "Translation efficiency", "pools": False,
        "signed": True, "logScale": False,
        "platforms": {"RNA-seq": ("te-log2-fold-change", "TE log2FC"),
                      "Ribo-seq": ("te-log2-fold-change", "TE log2FC")},
        "bounds": {"nonnegative": False, "integral": False, "unitInterval": False},
    },
}

# The families a declared quantity may claim that the interface reads as
# transcript abundance. A fold change, a p-value and a translation-efficiency
# ratio are not abundances, and the low-traffic threshold and the
# measured-evidence orderings select on the family, so a ratio sitting in
# ``Expression`` would be offered as a measure of how busy a gene is.
ABUNDANCE_FAMILIES = {"Expression"}


def quantity_value_problem(quantity: str, value: Any) -> str | None:
    """Why ``value`` is not an admissible ``quantity``, or None when it is."""
    bounds = EXPRESSION_QUANTITIES[quantity]["bounds"]
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return "not a number"
    if not math.isfinite(value):
        return "not finite"
    if bounds["nonnegative"] and value < 0:
        return f"negative ({value})"
    if bounds["integral"] and float(value) != int(value):
        return f"not a whole count ({value})"
    if bounds["unitInterval"] and not 0 <= value <= 1:
        return f"outside [0, 1] ({value})"
    return None


def validate_expression_quantities(meta: dict[str, Any], genes: list[Any],
                                   report: Report) -> None:
    """Checks what every source that declares a measured quantity publishes about it.

    A source may declare the quantity its values are, because ``dataType`` alone
    cannot separate an abundance from a fold change from a p-value: all three are
    "transcriptomics by RNA-seq". The declaration must be one this contract
    knows, must be defined for the record's data type and platform, and must
    carry exactly the kind, label, family, pooling rule, sign convention and
    bounds that follow from it. A source that declares nothing is unaffected.
    """
    sources = [s for s in meta.get("expressionSources", []) if isinstance(s, dict)]
    declared = [s for s in sources if "quantity" in s]
    if not declared:
        report.check(True, "no expression source declares a measured quantity")
        return

    problems: list[str] = []
    for source in declared:
        name = source.get("id")
        quantity = source.get("quantity")
        if quantity not in EXPRESSION_QUANTITIES:
            problems.append(f"{name}: unknown quantity {quantity!r}")
            continue
        contract = EXPRESSION_QUANTITIES[quantity]
        record = source.get("record") if isinstance(source.get("record"), dict) else {}
        platform = record.get("platform")
        if platform not in contract["platforms"]:
            problems.append(f"{name}: quantity {quantity!r} is not defined for {platform!r}")
            continue
        if record.get("dataType") != "transcriptomics":
            problems.append(
                f"{name}: quantity {quantity!r} is a transcriptomics quantity, "
                f"not {record.get('dataType')!r}")
            continue
        kind, label = contract["platforms"][platform]
        expected = {
            "quantityKind": kind,
            "quantityLabel": label,
            "quantityFamily": contract["family"],
            "quantityPools": contract["pools"],
            "quantityBounds": contract["bounds"],
            "signed": contract["signed"],
            "logScale": contract["logScale"],
        }
        for field, want in expected.items():
            if source.get(field) != want:
                problems.append(f"{name}: {field} is {source.get(field)!r}, not {want!r}")
        definition = (meta.get("metrics") or {}).get(source.get("metricKey"))
        if isinstance(definition, dict) and definition.get("family") != contract["family"]:
            problems.append(
                f"{name}: its metric sits in family {definition.get('family')!r}, "
                f"not {contract['family']!r}")
    report.check(not problems, "every declared expression quantity matches the contract",
                 "; ".join(problems[:4]))

    # Nothing may group two different quantities into one selectable metric. The
    # browser's type key is the data type, the platform and the kind, so one
    # such triple standing for two quantities would silently average a p-value
    # into a fold change. The check is on the triple, not on prose.
    by_type: dict[tuple[Any, Any, Any], set[Any]] = {}
    for source in declared:
        record = source.get("record") if isinstance(source.get("record"), dict) else {}
        key = (record.get("dataType"), record.get("platform"), source.get("quantityKind"))
        by_type.setdefault(key, set()).add(source.get("quantity"))
    shared = {key: sorted(map(str, names)) for key, names in by_type.items() if len(names) > 1}
    report.check(not shared, "no two declared quantities collapse into one type metric",
                 "; ".join(f"{k}: {v}" for k, v in list(shared.items())[:4]))

    # A quantity that is not an abundance must not be offered where the
    # interface means transcript abundance.
    misfiled = [
        f"{s.get('id')} ({s.get('quantity')}) is in {s.get('quantityFamily')!r}"
        for s in declared
        if s.get("quantity") in ("log2_fold_change", "edger_log2_fold_change", "p_value",
                                 "translation_efficiency_log2_fold_change")
        and s.get("quantityFamily") in ABUNDANCE_FAMILIES
    ]
    report.check(not misfiled, "no fold change, p-value or ratio is filed as an abundance",
                 "; ".join(misfiled[:4]))

    gene_rows = [g for g in genes if isinstance(g, dict)]
    bad = []
    for source in declared:
        if source.get("payload") != "genes.json" or source["quantity"] not in EXPRESSION_QUANTITIES:
            continue
        key = source.get("metricKey")
        for gene in gene_rows:
            value = gene.get(key)
            if value is None:
                continue
            problem = quantity_value_problem(source["quantity"], value)
            if problem:
                bad.append(f"{key} on {gene.get('id')}: {problem}")
                break
    report.check(not bad, "every genes.json quantity column holds values its quantity admits",
                 "; ".join(bad[:4]))


def validate_expression_layers(data_dir: str, meta: dict[str, Any], genes: list[Any],
                               report: Report) -> None:
    """Checks the separate expression-layer payload against the sources that declare it.

    A source published through ``expression_layers.json`` keeps its values out
    of ``genes.json``; the payload repeats the gene order so a stale file cannot
    be joined, every layer has one entry per gene, a value is a finite
    non-negative number or null (a source marked ``signed``, a fitness score,
    may be negative), and the non-null count is the coverage the
    source declares. A source published through ``genes.json`` must still be
    found there.
    """
    sources = [s for s in meta.get("expressionSources", []) if isinstance(s, dict)]
    layer_sources = [s for s in sources if s.get("payload") == "expression_layers.json"]
    gene_sources = [s for s in sources if s.get("payload") == "genes.json"]
    report.check(
        len(layer_sources) + len(gene_sources) == len(sources),
        "every expression source names its payload file",
    )
    gene_rows = [g for g in genes if isinstance(g, dict)]
    report.check(
        all(all(s["metricKey"] in g for g in gene_rows) for s in gene_sources),
        "every genes.json expression source has its field on every gene",
    )
    report.check(
        not any(s["metricKey"] in g for s in layer_sources for g in gene_rows),
        "no layer-payload expression metric rides in genes.json",
    )
    path = os.path.join(data_dir, "expression_layers.json")
    if not layer_sources:
        report.check(not os.path.exists(path),
                     "expression_layers.json is absent when no source declares it")
        return
    payload = load_json(path, report)
    if not isinstance(payload, dict):
        report.fail("expression_layers.json is an object")
        return
    report.check(payload.get("schemaVersion") == 1, "expression_layers.schemaVersion is 1")
    report.check(
        payload.get("geneIds") == [g.get("id") for g in gene_rows],
        "expression_layers.geneIds repeats the genes.json order exactly",
    )
    layers = payload.get("layers")
    report.check(
        isinstance(layers, dict) and set(layers) == {s["metricKey"] for s in layer_sources},
        "expression_layers.layers holds exactly the declared layer metrics",
    )
    if not isinstance(layers, dict):
        return
    problems = []
    for source in layer_sources:
        column = layers.get(source["metricKey"])
        if not isinstance(column, list) or len(column) != len(gene_rows):
            problems.append(f"{source['metricKey']}: not one entry per gene")
            continue
        # A declared quantity states its own admissible values: whole counts for
        # a read count, [0, 1] for a p-value, either sign for a log ratio.
        if source.get("quantity") in EXPRESSION_QUANTITIES:
            reasons = [
                quantity_value_problem(source["quantity"], v) for v in column if v is not None
            ]
            bad = [reason for reason in reasons if reason]
            if bad:
                problems.append(
                    f"{source['metricKey']}: {len(bad)} values its "
                    f"{source['quantity']} contract refuses, e.g. {bad[:3]}")
        else:
            # A value may be negative for two different reasons: a signed quantity
            # centred on zero, or an ordinary abundance expressed in logs where a
            # negative simply means below one unit. Both are legitimate; neither is
            # a licence for the other's ramp.
            may_be_negative = source.get("signed") is True or source.get("logScale") is True
            bad = [v for v in column if v is not None
                   and (isinstance(v, bool) or not isinstance(v, (int, float))
                        or not math.isfinite(v) or (v < 0 and not may_be_negative))]
            if bad:
                problems.append(f"{source['metricKey']}: {len(bad)} invalid values, e.g. {bad[:3]}")
        with_value = sum(v is not None for v in column)
        declared = (source.get("coverage") or {}).get("withValue")
        if with_value != declared:
            problems.append(f"{source['metricKey']}: {with_value} values, coverage says {declared}")
    report.check(not problems, "every expression layer is complete, finite and matches its coverage",
                 "; ".join(problems[:4]))


def validate_codon_rscu(data_dir: str, meta: dict[str, Any], genes: list[Any],
                        report: Report) -> None:
    """Checks the separate RSCU payload against genes.json and meta.rscuOrder.

    Per-gene RSCU has no browser consumer, so it rides apart from the file the
    map waits for and no value is duplicated: the payload repeats the gene order
    so a stale file cannot be joined, every vector has one column per
    ``meta.rscuOrder`` codon, a value is a finite non-negative number or null,
    and no vector is left behind in ``genes.json``. Coverage is complete by the
    pipeline's convention that an absent amino-acid family contributes zeros, so
    a null here would be a vector that could not be computed.
    """
    gene_rows = [g for g in genes if isinstance(g, dict)]
    report.check(
        not any("rscu" in g for g in gene_rows),
        "no per-gene rscu vector rides in genes.json",
    )
    payload = load_json(os.path.join(data_dir, RSCU_PAYLOAD), report)
    if not isinstance(payload, dict):
        report.fail(f"{RSCU_PAYLOAD} is an object")
        return
    report.check(payload.get("schemaVersion") == 1, f"{RSCU_PAYLOAD} declares schema 1")
    report.check(
        payload.get("geneIds") == [g.get("id") for g in gene_rows],
        f"{RSCU_PAYLOAD} geneIds repeats the genes.json order exactly",
    )
    order = meta.get("rscuOrder")
    columns = len(order) if isinstance(order, list) else 0
    vectors = payload.get("rscu")
    present = len(vectors) if isinstance(vectors, list) else 0
    if not report.check(
        isinstance(vectors, list) and present == len(gene_rows),
        f"{RSCU_PAYLOAD} has one RSCU vector per gene: {present:,} for "
        f"{len(gene_rows):,} genes",
    ):
        return
    wrong_width = [
        i for i, vector in enumerate(vectors)
        if not isinstance(vector, list) or len(vector) != columns
    ]
    report.check(
        columns > 0 and not wrong_width,
        f"every RSCU vector has one column per meta.rscuOrder codon ({columns})",
        f"{len(wrong_width)} vectors differ, e.g. at index {wrong_width[:3]}",
    )
    invalid = [
        value for vector in vectors if isinstance(vector, list) for value in vector
        if value is not None
        and (isinstance(value, bool) or not isinstance(value, (int, float))
             or not math.isfinite(value) or value < 0)
    ]
    report.check(not invalid, "every RSCU value is a finite non-negative number or null",
                 f"{len(invalid)} invalid, e.g. {invalid[:3]}")
    complete = sum(isinstance(vector, list) and all(value is not None for value in vector)
                   for vector in vectors)
    report.check(
        complete == len(gene_rows),
        f"every gene has a complete RSCU vector: {complete:,} of {len(gene_rows):,}",
    )


def validate_pair_judgements(meta: dict[str, Any], report: Report) -> None:
    """Checks the owner's pair judgements the site reads to join or keep apart two condition sets.

    Each names both sides by study and condition-table row and carries one of
    the four calls; a conditional call states its condition; no pair is judged
    twice. The list may be empty, which means no judgement, never a default.
    """
    judgements = meta.get("pairJudgements")
    report.check(isinstance(judgements, list), "meta.pairJudgements is a list")
    if not isinstance(judgements, list):
        return
    calls = ("share", "separate", "conditional", "undecided")
    problems = []
    seen = set()
    for item in judgements:
        if not isinstance(item, dict):
            problems.append("not an object")
            continue
        ends = []
        for side in ("a", "b"):
            end = item.get(side)
            if (not isinstance(end, dict) or not isinstance(end.get("studyId"), str)
                    or not end["studyId"] or isinstance(end.get("row"), bool)
                    or not isinstance(end.get("row"), int) or end["row"] <= 0):
                problems.append(f"pair {item.get('pair')}: side {side} names no study and row")
                break
            ends.append(f"{end['studyId']}#{end['row']}")
        if len(ends) < 2:
            continue
        if item.get("call") not in calls:
            problems.append(f"pair {item.get('pair')}: unknown call {item.get('call')!r}")
        if item.get("call") == "conditional" and not item.get("condition"):
            problems.append(f"pair {item.get('pair')}: conditional on nothing")
        key = tuple(sorted(ends))
        if key in seen:
            problems.append(f"pair {item.get('pair')}: judged twice")
        seen.add(key)
    report.check(not problems, "every pair judgement names two sides and one known call",
                 "; ".join(problems[:4]))


def _overlap_universe(
    gff_path: str,
) -> tuple[dict[str, list[tuple[int, int]]], dict[str, dict[str, Any]], dict[str, int]]:
    """Re-derives every annotated gene's occupied segments straight from the GFF.

    Deliberately independent of ``tools/build_gene_overlaps.py``: its own scan,
    its own child/exon resolution and its own circular normalisation, so a bug
    mirrored in that producer's tests still fails here.
    """
    lengths: dict[str, int] = {}
    rows: list[tuple[str, str, int, int, str, dict[str, str]]] = []
    with gzip.open(gff_path, "rt") as handle:
        for line in handle:
            if line.startswith("##sequence-region "):
                parts = line.split()
                lengths[parts[1]] = int(parts[3])
                continue
            if not line.strip() or line.startswith("#"):
                continue
            fields = line.rstrip("\n").split("\t")
            if len(fields) != 9:
                continue
            attrs = {}
            for item in fields[8].split(";"):
                key, separator, value = item.partition("=")
                if separator:
                    attrs[unquote(key)] = unquote(value)
            rows.append((fields[0], fields[2], int(fields[3]), int(fields[4]), fields[6], attrs))

    def pieces(seqid: str, start: int, end: int) -> list[tuple[int, int]]:
        length = lengths[seqid]
        if end <= length:
            return [(start, end)]
        return [(start, length), (1, end - length)]

    children: dict[str, list[tuple[str, str, int, int, str, dict[str, str]]]] = (
        collections.defaultdict(list)
    )
    for row in rows:
        parent = row[5].get("Parent")
        if parent:
            for one in parent.split(","):
                children[one].append(row)

    segments: dict[str, list[tuple[int, int]]] = {}
    identity: dict[str, dict[str, Any]] = {}
    for seqid, kind, start, end, strand, attrs in rows:
        if kind not in ("gene", "pseudogene"):
            continue
        locus = attrs.get("locus_tag")
        if not locus:
            continue
        found: list[tuple[int, int]] = []
        for child in children.get(attrs.get("ID", ""), []):
            if child[1] == "exon":
                continue
            exons = [item for item in children.get(child[5].get("ID", ""), [])
                     if item[1] == "exon"]
            for source in exons or [child]:
                found.extend(pieces(source[0], source[2], source[3]))
        source_kind = "child" if found else "gene"
        if not found:
            found = pieces(seqid, start, end)
        merged: list[tuple[int, int]] = []
        for piece in sorted(found):
            if merged and piece[0] <= merged[-1][1] + 1:
                merged[-1] = (merged[-1][0], max(merged[-1][1], piece[1]))
            else:
                merged.append(piece)
        segments[locus] = merged
        identity[locus] = {
            "seqid": seqid,
            "strand": strand if strand in ("+", "-") else None,
            "biotype": attrs.get("gene_biotype") or kind,
            "segmentSource": source_kind,
        }
    return segments, identity, lengths


def _shared(
    left: Sequence[tuple[int, int]], right: Sequence[tuple[int, int]]
) -> list[tuple[int, int]]:
    """Bases two canonical segment lists share, as merged intervals."""
    found: list[tuple[int, int]] = []
    for a_start, a_end in left:
        for b_start, b_end in right:
            start, end = max(a_start, b_start), min(a_end, b_end)
            if start <= end:
                found.append((start, end))
    merged: list[tuple[int, int]] = []
    for piece in sorted(found):
        if merged and piece[0] <= merged[-1][1] + 1:
            merged[-1] = (merged[-1][0], max(merged[-1][1], piece[1]))
        else:
            merged.append(piece)
    return merged


def validate_gene_overlaps(
    data_dir: str,
    raw_dir: str,
    genes: list[dict[str, Any]],
    report: Report,
    organism: OrganismConfig = DEFAULT_ORGANISM,
) -> None:
    """Checks the published overlapping-gene layer against its own definition.

    Three independent checks, in order of strength. The payload has to be
    internally exact — every shared interval re-derived from the two features'
    segments, the coverage block reconciled against what is listed. It has to
    agree with ``genes.json`` about every plotted CDS it lists. And where the
    pinned annotation is present, the whole relation is re-derived here from
    that annotation and compared gene for gene, which is the check a hand-edited
    or stale layer cannot survive.
    """
    path = os.path.join(data_dir, "gene_overlaps.json")
    if not os.path.exists(path):
        report.check(False, "gene_overlaps.json is published",
                     f"missing {path}; run: tools/build_gene_overlaps.py build")
        return
    payload = load_json(path, report)
    if not isinstance(payload, dict):
        return
    problems: list[str] = []
    if payload.get("schemaVersion") != 1:
        problems.append("schemaVersion is not 1")
    if payload.get("datasetVersion") != "gene-overlaps-v1":
        problems.append("datasetVersion is not gene-overlaps-v1")
    if payload.get("origin") != "computed" or not payload.get("producer"):
        problems.append("origin and producer are not both stated")
    definition = payload.get("definition")
    if not isinstance(definition, dict) or not all(
        isinstance(definition.get(key), str) and definition.get(key)
        for key in ("features", "extent", "overlap", "excluded")
    ):
        problems.append("the definition block is incomplete")
    release = payload.get("release")
    if not isinstance(release, dict) or release.get("accession") != organism.accession:
        problems.append("the release does not name this organism's assembly")
    elif not re.fullmatch(r"[0-9a-f]{64}", str(release.get("sha256", ""))):
        problems.append("the release carries no SHA-256 of its annotation input")
    report.check(not problems, "gene_overlaps.json states its schema, definition and release",
                 "; ".join(problems))

    features = payload.get("features")
    pairs = payload.get("pairs")
    coverage = payload.get("coverage")
    if not isinstance(features, list) or not isinstance(pairs, list) \
            or not isinstance(coverage, dict):
        report.check(False, "gene_overlaps.json carries features, pairs and coverage")
        return
    lengths = {
        entry.get("accession"): entry.get("lengthBp")
        for entry in payload.get("replicons", []) if isinstance(entry, dict)
    }

    shape: list[str] = []
    listed: dict[str, dict[str, Any]] = {}
    for position, feature in enumerate(features):
        locus = feature.get("id") if isinstance(feature, dict) else None
        if not isinstance(locus, str) or not locus:
            shape.append(f"feature {position} has no locus tag")
            continue
        if locus in listed:
            shape.append(f"{locus} is listed more than once")
        listed[locus] = feature
        length = lengths.get(feature.get("seqid"))
        if not isinstance(length, int):
            shape.append(f"{locus} is on an undeclared replicon")
            continue
        segments = feature.get("segments")
        if not isinstance(segments, list) or not segments:
            shape.append(f"{locus} has no segments")
            continue
        previous = None
        for piece in segments:
            if not (isinstance(piece, list) and len(piece) == 2
                    and all(isinstance(value, int) for value in piece)):
                shape.append(f"{locus} has a malformed segment")
                break
            start, end = piece
            if start < 1 or end < start or end > length:
                shape.append(f"{locus} has a segment outside its replicon")
            if previous is not None and start <= previous + 1:
                shape.append(f"{locus} has segments that are not canonical")
            previous = end
        if feature.get("segmentSource") not in ("child", "gene"):
            shape.append(f"{locus} does not say where its segments came from")
        if feature.get("strand") not in ("+", "-", None):
            shape.append(f"{locus} has an unreadable strand")
        if not isinstance(feature.get("pseudo"), bool):
            shape.append(f"{locus} does not say whether it is a pseudogene")
    report.check(not shape, "every listed overlapping gene has canonical in-range segments",
                 "; ".join(shape[:4]))

    exact: list[str] = []
    total_shared = 0
    degrees: dict[int, int] = collections.defaultdict(int)
    previous_pair: tuple[int, int] | None = None
    for pair in pairs:
        if not (isinstance(pair, list) and len(pair) == 3):
            exact.append("a pair is malformed")
            continue
        first, second, pieces = pair
        if not (isinstance(first, int) and isinstance(second, int)
                and 0 <= first < second < len(features)):
            exact.append("a pair does not name two distinct features in order")
            continue
        if previous_pair is not None and (first, second) <= previous_pair:
            exact.append("the pairs are not in ascending order")
        previous_pair = (first, second)
        left, right = features[first], features[second]
        if left.get("seqid") != right.get("seqid"):
            exact.append(f"{left.get('id')} and {right.get('id')} are on two replicons")
            continue
        recomputed = _shared(
            [tuple(piece) for piece in left["segments"]],
            [tuple(piece) for piece in right["segments"]],
        )
        if not recomputed:
            exact.append(f"{left.get('id')} and {right.get('id')} share no base")
            continue
        if [list(piece) for piece in recomputed] != pieces:
            exact.append(f"{left.get('id')} and {right.get('id')} report bases their segments "
                         "do not share")
        total_shared += sum(end - start + 1 for start, end in recomputed)
        degrees[first] += 1
        degrees[second] += 1
    report.check(not exact, "every overlapping pair's shared bases follow from its own segments",
                 "; ".join(exact[:4]))

    census = coverage.get("byBiotype")
    reconciled: list[str] = []
    if not isinstance(census, dict) or any(
        not isinstance(value, int) or value < 0 for value in census.values()
    ):
        reconciled.append("the biotype census is missing or not whole counts")
    elif sum(census.values()) != coverage.get("annotatedGenes"):
        reconciled.append("the biotype census does not sum to the annotated gene count")
    if coverage.get("overlappingGenes") != len(features):
        reconciled.append("overlappingGenes is not the number of listed features")
    if coverage.get("overlappingPairs") != len(pairs):
        reconciled.append("overlappingPairs is not the number of listed pairs")
    if coverage.get("pairwiseSharedBases") != total_shared:
        reconciled.append("pairwiseSharedBases is not the total the pairs share")
    if coverage.get("maxPartners") != (max(degrees.values()) if degrees else 0):
        reconciled.append("maxPartners is not the largest partner count")
    report.check(not reconciled, "the overlap coverage block follows from the listed relations",
                 "; ".join(reconciled[:4]))

    inventory = payload.get("coveredGenes")
    named: list[str] = []
    if not isinstance(inventory, list) or not inventory \
            or any(not isinstance(locus, str) or not locus for locus in inventory):
        named.append("coveredGenes is missing or is not a list of locus tags")
        covered: set[str] = set()
    else:
        covered = set(inventory)
        if len(covered) != len(inventory):
            named.append("coveredGenes lists a locus more than once")
        if len(covered) != coverage.get("annotatedGenes"):
            named.append("coveredGenes does not hold every annotated gene")
        missing_features = sorted(set(listed) - covered)
        if missing_features:
            named.append(
                f"{len(missing_features)} overlapping genes are not in coveredGenes, "
                f"starting with {missing_features[0]}"
            )
        uncompared = sorted(
            str(gene.get("id")) for gene in genes
            if isinstance(gene, dict) and gene.get("id") not in covered
        )
        if uncompared:
            named.append(
                f"{len(uncompared)} plotted CDSs were not compared, "
                f"starting with {uncompared[0]}"
            )
    report.check(
        not named,
        "the overlap layer names every annotated gene it compared, plotted CDSs included",
        "; ".join(named[:4]),
    )

    joined: list[str] = []
    by_id = {gene.get("id"): gene for gene in genes if isinstance(gene, dict)}
    for locus, feature in listed.items():
        gene = by_id.get(locus)
        if gene is None:
            continue
        own = sorted(
            [list(piece) for piece in (gene.get("cdsSegments")
                                       or [[gene.get("start"), gene.get("end")]])]
        )
        if own != sorted(feature.get("segments", [])):
            joined.append(f"{locus} segments differ from genes.json")
        if gene.get("strand") != feature.get("strand") or gene.get("seqid") != feature.get("seqid"):
            joined.append(f"{locus} strand or replicon differs from genes.json")
    report.check(not joined, "every listed plotted CDS agrees with genes.json about itself",
                 "; ".join(joined[:4]))

    gff_path = os.path.join(raw_dir, f"{organism.assemblyPrefix}_genomic.gff.gz")
    label = "the overlap relation re-derives from the pinned annotation"
    if not os.path.exists(gff_path):
        report.skip(label, f"missing raw input: {gff_path}")
        return
    segments, identity, raw_lengths = _overlap_universe(gff_path)
    derived: dict[tuple[str, str], list[tuple[int, int]]] = {}
    by_replicon: dict[str, list[str]] = collections.defaultdict(list)
    for locus, record in identity.items():
        by_replicon[record["seqid"]].append(locus)
    for loci in by_replicon.values():
        ordered = sorted(loci, key=lambda name: segments[name][0])
        for position, locus in enumerate(ordered):
            reach = max(end for _, end in segments[locus])
            for other in ordered[position + 1:]:
                if segments[other][0][0] > reach:
                    break
                pieces = _shared(segments[locus], segments[other])
                if pieces:
                    derived[tuple(sorted((locus, other)))] = pieces
    published = {
        tuple(sorted((features[pair[0]]["id"], features[pair[1]]["id"]))): [
            tuple(piece) for piece in pair[2]
        ]
        for pair in pairs if isinstance(pair, list) and len(pair) == 3
    }
    differences: list[str] = []
    for key in sorted(set(derived) - set(published)):
        differences.append(f"{key[0]}/{key[1]} overlaps in the annotation but is not published")
    for key in sorted(set(published) - set(derived)):
        differences.append(f"{key[0]}/{key[1]} is published but shares no base in the annotation")
    for key in sorted(set(published) & set(derived)):
        if published[key] != derived[key]:
            differences.append(f"{key[0]}/{key[1]} publishes bases the annotation does not share")
    if coverage.get("annotatedGenes") != len(identity):
        differences.append(
            f"annotatedGenes is {coverage.get('annotatedGenes')}, and the annotation has "
            f"{len(identity)} gene records"
        )
    if coverage.get("childlessGenes") != sum(
        1 for record in identity.values() if record["segmentSource"] == "gene"
    ):
        differences.append("childlessGenes does not match the annotation")
    if covered and covered != set(identity):
        differences.append(
            "coveredGenes is not exactly the annotation's gene records"
        )
    for locus, feature in listed.items():
        record = identity.get(locus)
        if record is None:
            differences.append(f"{locus} is published but is not an annotated gene")
            continue
        if [list(piece) for piece in segments[locus]] != feature.get("segments"):
            differences.append(f"{locus} segments differ from the annotation")
        if record["strand"] != feature.get("strand") or record["biotype"] != feature.get("biotype"):
            differences.append(f"{locus} strand or biotype differs from the annotation")
    declared = {
        entry.get("accession"): entry.get("lengthBp")
        for entry in payload.get("replicons", []) if isinstance(entry, dict)
    }
    if declared != raw_lengths:
        differences.append("the declared replicon lengths differ from the annotation's")
    report.check(not differences, label, "; ".join(differences[:4]))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--organism", default=None)
    parser.add_argument("--data-dir", default=None)
    parser.add_argument("--raw-dir", default=None)
    args = parser.parse_args()
    try:
        organism = get_organism(args.organism)
    except ValueError as error:
        parser.error(str(error))
    data_dir = args.data_dir or os.fspath(organism.path("outputDirectory"))
    raw_dir = args.raw_dir or os.fspath(organism.path("rawDirectory"))

    report = Report()
    meta = validate_meta(load_json(os.path.join(data_dir, "meta.json"), report),
                         report, organism)
    genes = load_json(os.path.join(data_dir, "genes.json"), report)
    pca = load_json(os.path.join(data_dir, "codon_pca.json"), report)
    excluded = load_json(os.path.join(data_dir, "excluded.json"), report)
    tss_evidence = (
        load_json(os.path.join(data_dir, "tss_evidence.json"), report)
        if isinstance(meta, dict) and "tssEvidenceSource" in meta else None
    )
    sequence_context = (
        load_json(os.path.join(data_dir, "sequence_context.json"), report)
        if organism.sequenceContextNt > 30 else None
    )

    if isinstance(meta, dict) and isinstance(genes, list):
        validate_expression_quantities(meta, genes, report)
        validate_expression_layers(data_dir, meta, genes, report)
        validate_codon_rscu(data_dir, meta, genes, report)
        validate_sequence_context(sequence_context, genes, report, organism)
    if isinstance(meta, dict):
        validate_pair_judgements(meta, report)

    if meta is not None and isinstance(genes, list):
        # Prefer the data's own declaration over the raw genome. `cdsSegments` is
        # contractual and is separately asserted to name exactly the three joined
        # CDSs, so deriving the exemption from it lets this run on a fresh clone
        # where data/raw is gitignored and absent. Falling back to the raw FASTA
        # there would silently exempt nothing and report three false coordinate
        # failures, which invites someone to "fix" correct data.
        declared = {g["id"] for g in genes
                    if isinstance(g, dict) and g.get("cdsSegments")}
        spliced = declared or spliced_loci(raw_dir, organism)
        source = "declared by cdsSegments" if declared else "derived from the raw genome"
        if spliced:
            report.skip("contiguity check for spliced CDSs",
                        f"exempt ({source}): {sorted(spliced)}")
        else:
            report.skip("contiguity check for spliced CDSs",
                        "no spliced CDSs declared and no raw genome available")
        validate_genes(genes, meta, report, spliced, organism)
        validate_distributions(genes, meta, report)
        cross_check_against_genome(
            genes,
            meta,
            raw_dir,
            report,
            excluded if isinstance(excluded, list) else [],
            organism,
        )
        cross_check_rna_context(genes, raw_dir, report, sequence_context, organism)
        validate_gene_overlaps(data_dir, raw_dir, genes, report, organism)
    if meta is not None and pca is not None:
        validate_codon_pca(pca, meta, report)
    if excluded is not None and isinstance(genes, list):
        validate_excluded(excluded, len(genes), report, organism)

    if isinstance(meta, dict) and "tssEvidenceSource" in meta and isinstance(genes, list):
        source = meta["tssEvidenceSource"]
        report.check(
            isinstance(source, dict)
            and source.get("replicatesPerCondition") == 2
            and source.get("isGeneBodyAbundance") is False,
            "Tan TSS evidence declares two replicates and no gene-body abundance",
        )
        expression_sources = meta.get("expressionSources", [])
        # Every measured source states its growth condition axis by axis, with a
        # status the site reads before it draws anything: a value is never
        # invented for an axis the source did not report. Re-derived here rather
        # than imported from the pipeline, like every other check in this file.
        axes = ("temperature", "lightIntensity", "lightRegime", "co2", "medium", "format", "phase")
        statuses = ("reported", "not reported", "not retrieved", "conflicting")
        def record_is_complete(item):
            record = item.get("record") if isinstance(item, dict) else None
            conditions = record.get("conditions") if isinstance(record, dict) else None
            if not isinstance(conditions, dict) or set(conditions) != set(axes):
                return False
            for name in axes:
                axis = conditions[name]
                if not isinstance(axis, dict) or axis.get("status") not in statuses:
                    return False
                if name in ("temperature", "lightIntensity", "co2"):
                    lo, hi = axis.get("lo"), axis.get("hi")
                    numeric = all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in (lo, hi))
                    if axis["status"] == "reported" and not (numeric and lo <= hi):
                        return False
                    if axis["status"] in ("not reported", "not retrieved") and (lo, hi) != (None, None):
                        return False
            return (record.get("dataType") in ("transcriptomics", "proteomics", "fitness")
                    and record.get("basis") in ("direct", "transferred")
                    and isinstance(record.get("treatments"), list))
        report.check(
            bool(expression_sources) and all(record_is_complete(item) for item in expression_sources),
            "every expression source carries a complete structured condition record",
        )
        pooled_source_id = source.get("pooledScoreSourceId") if isinstance(source, dict) else None
        report.check(
            isinstance(pooled_source_id, str)
            and sum(item.get("id") == pooled_source_id for item in expression_sources
                    if isinstance(item, dict)) == 1,
            "TSS site evidence names exactly one pooled-score provenance source",
        )
        # Two layers count genes differently: the pooled score is a genes.json
        # column, the site rows are tss_evidence.json. Each coverage statement
        # names its layer, and each number is the shipped column's own count.
        def coverage_names_its_column(item):
            key, payload = item.get("metricKey"), item.get("payload")
            coverage = item.get("coverage") if isinstance(item.get("coverage"), dict) else {}
            with_value, total = coverage.get("withValue"), coverage.get("total")
            definition = (meta.get("metrics") or {}).get(key)
            if not (isinstance(definition, dict) and isinstance(with_value, int)
                    and isinstance(total, int) and total == len(genes)):
                return False
            if payload == "genes.json" and with_value != sum(
                    gene.get(key) is not None for gene in genes if isinstance(gene, dict)):
                return False
            return (f"available for {with_value:,} of {total:,} genes in the {key} column of "
                    f"{payload}.") in str(definition.get("desc", ""))
        report.check(
            bool(expression_sources) and all(coverage_names_its_column(item)
                                             for item in expression_sources
                                             if isinstance(item, dict)),
            "every expression coverage names its column and payload and matches the shipped column",
        )
        report.check(
            isinstance(tss_evidence, dict),
            "TSS evidence is an object keyed by current locus tag",
        )
        if isinstance(tss_evidence, dict) and isinstance(source, dict):
            gene_ids = {gene["id"] for gene in genes if isinstance(gene, dict) and "id" in gene}
            genes_by_id = {gene["id"]: gene for gene in genes
                           if isinstance(gene, dict) and "id" in gene}
            report.check(
                set(tss_evidence) <= gene_ids,
                "every TSS evidence key names a current gene",
            )
            rows = [row for entries in tss_evidence.values()
                    if isinstance(entries, list) for row in entries]
            summary = source.get("summary", {})
            report.check(
                isinstance(summary, dict)
                and all(isinstance(entries, list) for entries in tss_evidence.values())
                and len(rows) == summary.get("matchedRows") == 2432
                and len(tss_evidence) == summary.get("matchedGenes") == 1789,
                "TSS evidence cardinality matches the pinned Table S1 join",
            )
            report.check(
                isinstance(summary, dict)
                and summary.get("layer") == "tss_evidence.json"
                and summary.get("genesWithoutMappedTss") == len(gene_ids - set(tss_evidence)) == 926,
                "genesWithoutMappedTss names the site-row layer and counts genes absent from it",
            )
            seen = set()
            valid = True
            for row in rows:
                if not isinstance(row, dict):
                    valid = False
                    continue
                tss_id = row.get("id")
                if (not isinstance(tss_id, str)
                        or not re.fullmatch(r"gTSS[+-]\d+", tss_id)
                        or tss_id in seen or row.get("type") != "gTSS"):
                    valid = False
                if isinstance(tss_id, str):
                    seen.add(tss_id)
                reads = row.get("rawReads")
                differential = row.get("differential")
                if not isinstance(reads, dict) or not isinstance(differential, dict):
                    valid = False
                    continue
                for condition in ("control", "dark", "highLight", "highTemperature"):
                    pair = reads.get(condition)
                    if (not isinstance(pair, list) or len(pair) != 2
                            or any(not isinstance(value, (int, float))
                                   or not math.isfinite(value) or value < 0 for value in pair)):
                        valid = False
                for condition in ("dark", "highLight", "highTemperature"):
                    comparison = differential.get(condition)
                    if not isinstance(comparison, dict):
                        valid = False
                        continue
                    fold_change = comparison.get("log2FoldChange")
                    adjusted_p = comparison.get("padj")
                    if (fold_change is None) != (adjusted_p is None):
                        valid = False
                    if fold_change is not None and (
                        not isinstance(fold_change, (int, float))
                        or not math.isfinite(fold_change)
                    ):
                        valid = False
                    if adjusted_p is not None and (
                        not isinstance(adjusted_p, (int, float))
                        or not math.isfinite(adjusted_p)
                        or not 0 <= adjusted_p <= 1
                    ):
                        valid = False
            report.check(valid, "every TSS row preserves two raw counts and valid comparisons")
            coordinate_consistent = all(
                isinstance(entry, dict)
                and entry.get("strand") == genes_by_id[locus].get("strand")
                and entry.get("replicon")
                == genes_by_id[locus].get("seqid", "").removeprefix("NZ_").split(".")[0]
                for locus, entries in tss_evidence.items()
                if locus in genes_by_id and isinstance(entries, list)
                for entry in entries
            )
            report.check(
                coordinate_consistent,
                "every mapped TSS agrees with the current gene's replicon and strand",
            )
            source_path = os.path.join(
                os.path.dirname(os.path.dirname(__file__)), "data/expression",
                "tan2018_utex2973_tss_table_s1.tsv",
            )
            digest = None
            if os.path.isfile(source_path):
                with open(source_path, "rb") as handle:
                    digest = hashlib.sha256(handle.read()).hexdigest()
            report.check(
                digest == source.get("derivedTableSha256"),
                "Tan Table S1 derived artifact matches its pinned checksum",
            )
            matches_source = digest == source.get("derivedTableSha256")
            if matches_source:
                emitted = {
                    entry["id"]: entry
                    for entries in tss_evidence.values() if isinstance(entries, list)
                    for entry in entries
                    if isinstance(entry, dict) and isinstance(entry.get("id"), str)
                }
                expected_ids = set()
                with open(source_path, encoding="utf-8", newline="") as handle:
                    for source_row in csv.DictReader(handle, delimiter="\t"):
                        if source_row["locus_tag"] not in gene_ids:
                            continue
                        tss_id = source_row["tss_id"]
                        expected_ids.add(tss_id)
                        expected = {
                            "id": tss_id,
                            "type": "gTSS",
                            "replicon": source_row["replicon"],
                            "strand": source_row["strand"],
                            "position": int(source_row["position"]),
                            "sourceStartDistanceNt": int(
                                source_row["source_start_distance_nt"]
                            ),
                            "rawReads": {
                                condition: [float(source_row[f"{prefix}_1"]),
                                            float(source_row[f"{prefix}_2"])]
                                for condition, prefix in (
                                    ("control", "control"), ("dark", "dark"),
                                    ("highLight", "high_light"),
                                    ("highTemperature", "high_temperature"),
                                )
                            },
                            "differential": {
                                condition: {
                                    "log2FoldChange": float(source_row[f"{prefix}_log2fc"])
                                    if source_row[f"{prefix}_log2fc"] else None,
                                    "padj": float(source_row[f"{prefix}_padj"])
                                    if source_row[f"{prefix}_padj"] else None,
                                }
                                for condition, prefix in (
                                    ("dark", "dark"), ("highLight", "high_light"),
                                    ("highTemperature", "high_temperature"),
                                )
                            },
                        }
                        if emitted.get(tss_id) != expected:
                            matches_source = False
                matches_source = matches_source and expected_ids == set(emitted)
            report.check(
                matches_source,
                "every published TSS JSON value matches the pinned Table S1 rows",
            )

    go_iea_path = os.path.join(data_dir, "go-iea-essentiality-v1.json")
    if os.path.exists(go_iea_path) and isinstance(genes, list):
        validate_go_iea_essentiality(
            load_json(go_iea_path, report), genes,
            load_json(os.path.join(data_dir, "candidate_evidence.json"), report), report,
        )

    derived_path = os.path.join(data_dir, "source-derived-categories-v1.json")
    if os.path.exists(derived_path) and isinstance(genes, list):
        validate_source_derived_categories(
            load_json(derived_path, report), genes,
            load_json(os.path.join(data_dir, "function-categories-v1.json"), report),
            load_json(os.path.join(data_dir, "pcc7942-essentiality-v1.json"), report),
            load_json(os.path.join(data_dir, "annotations.json"), report), report,
        )

    if isinstance(genes, list):
        path = os.path.join(data_dir, "genes.json")
        if os.path.exists(path):
            check_genes_json_budget(report, os.path.getsize(path), len(genes))
        sequence_path = os.path.join(data_dir, "sequence_context.json")
        if organism.sequenceContextNt > 30 and os.path.exists(sequence_path):
            limit = (organism.sequenceContextNt + 80) * len(genes)
            report.check(
                os.path.getsize(sequence_path) <= limit,
                "sequence_context.json stays within its separate compact-payload budget",
                f"{os.path.getsize(sequence_path):,} bytes; limit {limit:,}",
            )

    validate_data_manifest(data_dir, report)

    return report.emit()


if __name__ == "__main__":
    sys.exit(main())
