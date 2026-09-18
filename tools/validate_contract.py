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
import gzip
import json
import math
import os
import re
import collections
import sys
from typing import Any, Callable, Iterable, Iterator

ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
BASES = "TCAG"
AMINO_ACIDS = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"
STOP_CODONS = ("TAA", "TAG", "TGA")

ASSEMBLY = "GCF_000817325.1"
ASSEMBLY_PREFIX = "GCF_000817325.1_ASM81732v1"
EXPECTED_TOTAL_LENGTH = 2_744_626
EXPECTED_CDS_RECORDS = 2722
GENE_COUNT_RANGE = (2650, 2725)

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
    "rscu", "codonPca", "riskUmap", "codons",
    "terminalStop", "translationalException", "cdsSegments",
)

# Measured directly from the raw CDS records over the included set. These are
# exact, not approximate: a drift here means the inclusion rule changed.
EXPECTED_TERMINAL_STOPS = {"TAG": 1071, "TAA": 895, "TGA": 749}

# The three CDSs that are a join of non-adjacent segments, and the one of them
# with an NCBI-recorded translational exception.
EXPECTED_SPLICED = {"M744_RS00920", "M744_RS13290", "M744_RS13620"}
EXPECTED_EXCEPTIONS = {"M744_RS00920": "ribosomal_slippage"}


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


def validate_meta(meta: Any, report: Report) -> dict[str, Any] | None:
    """Checks meta.json structure and the codon alphabet's internal consistency."""
    if not isinstance(meta, dict):
        report.fail("meta.json is an object")
        return None

    report.check(meta.get("schemaVersion") == 1, "meta.schemaVersion is 1",
                 repr(meta.get("schemaVersion")))

    genome = meta.get("genome", {})
    report.check(genome.get("accession") == ASSEMBLY,
                 "meta.genome.accession is the genome of record",
                 f"got {genome.get('accession')!r}, expected {ASSEMBLY!r}")
    report.check(genome.get("taxid") == 1350461, "meta.genome.taxid is 1350461",
                 repr(genome.get("taxid")))
    report.check(genome.get("totalLength") == EXPECTED_TOTAL_LENGTH,
                 "meta.genome.totalLength is 2,744,626",
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
        for codon, expected_total, expected_editable in (
                ("GTG", 18659, 18303), ("TTG", 20427, 20324)):
            entry = occurrences.get(codon, {})
            report.check(
                entry.get("total") == expected_total
                and entry.get("editable") == expected_editable,
                f"{codon} occurrence counts match a direct scan",
                f"got {entry.get('total')}/{entry.get('editable')}, "
                f"expected {expected_total}/{expected_editable}")
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


def spliced_loci(raw_dir: str) -> set[str]:
    """Returns locus tags whose CDS is a join of non-adjacent genomic segments.

    These genes are shorter than their genomic span, so the usual
    ``end - start + 1 == lengthNt`` identity does not hold for them. In this
    genome the set is small and biologically real: ``M744_RS00920`` is ``prfB``,
    whose peptide chain release factor 2 is produced by a programmed ribosomal
    frameshift that skips a single base.
    """
    path = os.path.join(raw_dir, f"{ASSEMBLY_PREFIX}_cds_from_genomic.fna.gz")
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


def validate_genes(genes: Any, meta: dict[str, Any], report: Report,
                   spliced: set[str]) -> None:
    """Checks per-gene records for structure, ranges, and codon-string integrity."""
    if not isinstance(genes, list):
        report.fail("genes.json is an array", repr(type(genes)))
        return

    low, high = GENE_COUNT_RANGE
    report.check(low <= len(genes) <= high,
                 f"gene count is within [{low}, {high}]", f"got {len(genes)}")

    identifiers = [g.get("id") for g in genes if isinstance(g, dict)]
    report.check(len(identifiers) == len(set(identifiers)),
                 "gene ids are unique",
                 f"{len(identifiers) - len(set(identifiers))} duplicates")

    symbol_to_codon = {e["sym"]: e["codon"] for e in meta.get("codonAlphabet", [])
                       if isinstance(e, dict) and "sym" in e and "codon" in e}
    rscu_len = len(meta.get("rscuOrder") or [])

    missing_fields: dict[str, int] = {}
    range_problems: list[str] = []
    length_problems: list[str] = []
    codon_char_problems: list[str] = []
    stop_in_body: list[str] = []
    rscu_problems: list[str] = []
    umap_problems: list[str] = []
    composition_problems: list[str] = []
    coordinate_problems: list[str] = []

    for gene in genes:
        if not isinstance(gene, dict):
            report.fail("every gene record is an object")
            continue
        gid = gene.get("id", "<no id>")

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

        rscu = gene.get("rscu")
        if rscu_len and (not isinstance(rscu, list) or len(rscu) != rscu_len):
            rscu_problems.append(
                f"{gid}: rscu length {len(rscu) if isinstance(rscu, list) else type(rscu)}"
                f" != {rscu_len}")

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
    report.check(not range_problems, "all scalar metrics are finite and in range",
                 f"{len(range_problems)} problems, e.g. {range_problems[:3]}")
    report.check(not length_problems, "codon and nucleotide lengths are consistent",
                 f"{len(length_problems)} problems, e.g. {length_problems[:3]}")
    report.check(not codon_char_problems, "codon strings use only the contract alphabet",
                 f"{len(codon_char_problems)} problems, e.g. {codon_char_problems[:3]}")
    report.check(not stop_in_body, "codon strings contain no internal stop codons",
                 f"{len(stop_in_body)} problems, e.g. {stop_in_body[:3]}")
    report.check(not rscu_problems, "rscu vectors match meta.rscuOrder length",
                 f"{len(rscu_problems)} problems, e.g. {rscu_problems[:3]}")
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
    report.check(dict(stops) == EXPECTED_TERMINAL_STOPS,
                 "terminal stop distribution is TAG 1071, TAA 895, TGA 749",
                 f"got {dict(stops.most_common())}")

    observed_spliced = {g["id"] for g in genes
                        if isinstance(g, dict) and g.get("cdsSegments")}
    report.check(observed_spliced == EXPECTED_SPLICED,
                 "cdsSegments is set for exactly the three joined CDSs",
                 f"got {sorted(observed_spliced)}")

    observed_exceptions = {g["id"]: g.get("translationalException") for g in genes
                           if isinstance(g, dict) and g.get("translationalException")}
    report.check(observed_exceptions == EXPECTED_EXCEPTIONS,
                 "translationalException is set for exactly prfB",
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


def validate_excluded(excluded: Any, gene_count: int, report: Report) -> None:
    """Checks that included and excluded CDSs reconcile against the raw count."""
    if not isinstance(excluded, list):
        report.fail("excluded.json is an array", repr(type(excluded)))
        return

    missing_reason = [e.get("id") for e in excluded
                      if not isinstance(e, dict) or not e.get("reason")]
    report.check(not missing_reason, "every excluded CDS records a reason",
                 f"{len(missing_reason)} without one")

    total = gene_count + len(excluded)
    report.check(total == EXPECTED_CDS_RECORDS,
                 "included plus excluded reconciles to 2,722 CDS records",
                 f"{gene_count} + {len(excluded)} = {total}")


def cross_check_against_genome(
    genes: list[dict[str, Any]], meta: dict[str, Any], raw_dir: str, report: Report
) -> None:
    """Re-derives protein sequences from packed codons and compares to NCBI's."""
    protein_path = os.path.join(raw_dir, f"{ASSEMBLY_PREFIX}_protein.faa.gz")
    cds_path = os.path.join(raw_dir, f"{ASSEMBLY_PREFIX}_cds_from_genomic.fna.gz")
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

    by_locus: dict[str, str] = {}
    for header, sequence in read_fasta(cds_path):
        match = re.search(r"\[locus_tag=([^\]]+)\]", header)
        if match:
            by_locus[match.group(1)] = sequence.upper()

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

    # protein_id per locus tag, taken from the CDS FASTA headers.
    protein_id_of: dict[str, str] = {}
    for header, _ in read_fasta(cds_path):
        locus = re.search(r"\[locus_tag=([^\]]+)\]", header)
        pid = re.search(r"\[protein_id=([^\]]+)\]", header)
        if locus and pid:
            protein_id_of[locus.group(1)] = pid.group(1)

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

    # Four protein accessions are shared by two loci each. Genes must not have
    # been deduplicated to match the protein file's record count.
    shared = collections.Counter(
        protein_id_of[g["id"]] for g in genes
        if isinstance(g, dict) and g.get("id") in protein_id_of)
    duplicated = {p: n for p, n in shared.items() if n > 1}
    report.check(len(duplicated) == 4,
                 "the four dual-locus proteins are present for both loci",
                 f"found {len(duplicated)}: {sorted(duplicated)[:6]}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", default="site/data")
    parser.add_argument("--raw-dir", default="data/raw")
    args = parser.parse_args()

    report = Report()
    meta = validate_meta(load_json(os.path.join(args.data_dir, "meta.json"), report),
                         report)
    genes = load_json(os.path.join(args.data_dir, "genes.json"), report)
    pca = load_json(os.path.join(args.data_dir, "codon_pca.json"), report)
    excluded = load_json(os.path.join(args.data_dir, "excluded.json"), report)

    if meta is not None and isinstance(genes, list):
        # Prefer the data's own declaration over the raw genome. `cdsSegments` is
        # contractual and is separately asserted to name exactly the three joined
        # CDSs, so deriving the exemption from it lets this run on a fresh clone
        # where data/raw is gitignored and absent. Falling back to the raw FASTA
        # there would silently exempt nothing and report three false coordinate
        # failures, which invites someone to "fix" correct data.
        declared = {g["id"] for g in genes
                    if isinstance(g, dict) and g.get("cdsSegments")}
        spliced = declared or spliced_loci(args.raw_dir)
        source = "declared by cdsSegments" if declared else "derived from the raw genome"
        if spliced:
            report.skip("contiguity check for spliced CDSs",
                        f"exempt ({source}): {sorted(spliced)}")
        else:
            report.skip("contiguity check for spliced CDSs",
                        "no spliced CDSs declared and no raw genome available")
        validate_genes(genes, meta, report, spliced)
        validate_distributions(genes, meta, report)
        cross_check_against_genome(genes, meta, args.raw_dir, report)
    if meta is not None and pca is not None:
        validate_codon_pca(pca, meta, report)
    if excluded is not None and isinstance(genes, list):
        validate_excluded(excluded, len(genes), report)

    if isinstance(genes, list):
        path = os.path.join(args.data_dir, "genes.json")
        if os.path.exists(path):
            size_mb = os.path.getsize(path) / (1024 * 1024)
            report.check(size_mb <= 6.0, "genes.json is within the 6 MB budget",
                         f"{size_mb:.2f} MB")

    return report.emit()


if __name__ == "__main__":
    sys.exit(main())
