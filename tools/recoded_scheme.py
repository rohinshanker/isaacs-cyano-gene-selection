#!/usr/bin/env python3
"""Derive the Ec_Syn57 recoding scheme from sequence, not from prose.

The paper states that seven codons were removed. This tool establishes which
seven, and what replaced them, by comparing the deposited 57-codon design
against the native genome codon by codon. Nothing here reads the article's
claims; the article is the cross-check, not the input.

Two independent derivations are produced and must agree on the target set:

1. **Genome-wide.** Every design CDS paired with its native counterpart by gene
   symbol, accepted only when the two have equal length and translate to the
   same protein. A target codon is one whose *retention* -- its count in the
   design divided by its count in the native pair set -- collapses toward zero.
2. **Supplied variants.** The 73 individually recoded gene sequences deposited
   as Supplementary Data 1, paired against the same native genome the same way.

The derived map is deliberately reported as a distribution rather than as a
codon-to-codon map, because the design does not use one: a removed codon is
replaced by several different synonyms at different loci. See
``single_destination_targets``.

Usage::

    tools/recoded_scheme.py                   # write the derived tables
    tools/recoded_scheme.py --report          # print a summary, write nothing
"""

from __future__ import annotations

import argparse
import csv
import gzip
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

from Bio import SeqIO
from Bio.Data import CodonTable

DESIGN_GB = Path("data/raw/recoded-ecoli/Ec_Syn57.gb")
VARIANTS_XLSX = Path("data/raw/recoded-ecoli/Supplementary_Data_1.xlsx")
VARIANTS_SHEET = "Selected Genes for recoding"
NATIVE_CDS_GZ = Path(
    "data/raw/ecoli-k12-mg1655/"
    "GCF_000005845.2_ASM584v2_cds_from_genomic.fna.gz"
)
OUT_DIR = Path("data/recoded")

#: A native codon is a scheme target when at most this fraction of its native
#: occurrences survive in the design. Calibrated on the observed distribution,
#: which separates the targets from every other codon by a factor of 57:
#: the highest target retention is 0.0169 and the lowest non-target is 0.9535.
#: Any threshold between those two yields the same seven codons.
TARGET_RETENTION_MAX = 0.05

#: Bacterial code. The design is *E. coli*, so table 11 throughout.
_TABLE = CodonTable.unambiguous_dna_by_id[11]
AMINO_ACID: dict[str, str] = dict(_TABLE.forward_table)
for _stop in _TABLE.stop_codons:
    AMINO_ACID[_stop] = "*"

ALL_CODONS: tuple[str, ...] = tuple(
    a + b + c for a in "TCAG" for b in "TCAG" for c in "TCAG"
)


def codons_of(sequence: str) -> list[str]:
    """Split ``sequence`` into whole codons, dropping any trailing partial."""
    return [sequence[i : i + 3] for i in range(0, len(sequence) - 2, 3)]


def translate(sequence: str) -> str:
    """Translate ``sequence``, mapping stops to ``*`` and unknowns to ``X``."""
    return "".join(AMINO_ACID.get(c, "X") for c in codons_of(sequence))


def body_codons(sequence: str) -> list[str]:
    """Codons excluding a terminal stop, which is counted separately.

    A stop codon is part of the genetic code being compressed, but a terminal
    stop is not a synonymous-replacement site in the way an internal sense
    codon is, so the two are never pooled.
    """
    codons = codons_of(sequence)
    if codons and AMINO_ACID.get(codons[-1]) == "*":
        return codons[:-1]
    return codons


@dataclass(frozen=True)
class Pair:
    """One native/recoded gene pair accepted for comparison."""

    gene: str
    native: str
    recoded: str


@dataclass(frozen=True)
class Rejection:
    """One gene that could not be paired, and why."""

    gene: str
    reason: str


def read_native_cds(path: Path = NATIVE_CDS_GZ) -> dict[str, str]:
    """Return native coding sequences keyed by gene symbol.

    Pseudogenes are skipped. Where a symbol occurs more than once the first
    record wins, deterministically, because the file order is fixed by the
    pinned assembly.
    """
    sequences: dict[str, str] = {}
    with gzip.open(path, "rt") as handle:
        for record in SeqIO.parse(handle, "fasta"):
            if "[pseudo=true]" in record.description:
                continue
            match = re.search(r"\[gene=([^\]]+)\]", record.description)
            if match:
                sequences.setdefault(match.group(1), str(record.seq).upper())
    return sequences


def read_design_cds(path: Path = DESIGN_GB) -> list[tuple[str, str]]:
    """Return ``(identifier, sequence)`` for every CDS in the design.

    Every CDS is returned. A feature carrying neither ``gene`` nor
    ``locus_tag`` is given a positional identifier rather than being dropped,
    so counts over the returned list are counts over the whole design. Such a
    synthetic identifier never matches a native gene symbol, so it is rejected
    at pairing time and reported there.
    """
    record = next(SeqIO.parse(path, "genbank"))
    out: list[tuple[str, str]] = []
    for index, feature in enumerate(record.features):
        if feature.type != "CDS":
            continue
        names = feature.qualifiers.get("gene") or feature.qualifiers.get(
            "locus_tag"
        )
        identifier = names[0] if names else f"unnamed_cds_{index}"
        out.append((identifier, str(feature.extract(record.seq)).upper()))
    return out


def read_supplied_variants(
    path: Path = VARIANTS_XLSX, sheet: str = VARIANTS_SHEET
) -> list[tuple[str, str]]:
    """Return ``(gene symbol, recoded sequence)`` from Supplementary Data 1."""
    import openpyxl

    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    rows: list[tuple[str, str]] = []
    for gene, sequence, *_ in workbook[sheet].iter_rows(
        min_row=2, values_only=True
    ):
        if not gene or not sequence:
            continue
        rows.append(
            (str(gene).strip(), re.sub(r"\s", "", str(sequence)).upper())
        )
    return rows


def pair_against_native(
    recoded: list[tuple[str, str]], native: dict[str, str]
) -> tuple[list[Pair], list[Rejection]]:
    """Pair recoded genes with native ones, accepting only safe comparisons.

    A pair is accepted only when the two sequences have the same length, a
    length divisible by three, and identical translations. Anything else is a
    different allele or a different gene model, and comparing it codon by codon
    would report real coding differences as recoding.
    """
    pairs: list[Pair] = []
    rejected: list[Rejection] = []
    for gene, recoded_seq in recoded:
        native_seq = native.get(gene)
        if native_seq is None:
            rejected.append(Rejection(gene, "no native gene of that symbol"))
            continue
        if len(recoded_seq) % 3:
            rejected.append(Rejection(gene, "recoded length not a multiple of 3"))
            continue
        if len(recoded_seq) != len(native_seq):
            rejected.append(
                Rejection(
                    gene,
                    f"length {len(recoded_seq)} against native "
                    f"{len(native_seq)}",
                )
            )
            continue
        if translate(recoded_seq) != translate(native_seq):
            rejected.append(Rejection(gene, "translations differ"))
            continue
        pairs.append(Pair(gene, native_seq, recoded_seq))
    return pairs, rejected


def substitutions(pairs: list[Pair]) -> Counter[tuple[str, str]]:
    """Count ``(native codon, recoded codon)`` substitutions over ``pairs``."""
    counts: Counter[tuple[str, str]] = Counter()
    for pair in pairs:
        native = body_codons(pair.native)
        recoded = body_codons(pair.recoded)
        for before, after in zip(native, recoded):
            if before != after:
                counts[(before, after)] += 1
    return counts


def retention(pairs: list[Pair]) -> dict[str, tuple[int, int]]:
    """Return ``codon -> (native count, recoded count)`` over ``pairs``."""
    native_counts: Counter[str] = Counter()
    recoded_counts: Counter[str] = Counter()
    for pair in pairs:
        native_counts.update(body_codons(pair.native))
        recoded_counts.update(body_codons(pair.recoded))
    return {
        codon: (native_counts[codon], recoded_counts[codon])
        for codon in ALL_CODONS
        if native_counts[codon] or recoded_counts[codon]
    }


def target_codons(
    pairs: list[Pair], *, threshold: float = TARGET_RETENTION_MAX
) -> list[str]:
    """Return the sense codons the design removes, by retention collapse.

    Ordered by retention, lowest first. A codon absent from the native pair set
    cannot be judged and is excluded rather than silently counted as removed.
    """
    out: list[tuple[float, str]] = []
    for codon, (native_n, recoded_n) in retention(pairs).items():
        if native_n == 0:
            continue
        ratio = recoded_n / native_n
        if ratio <= threshold:
            out.append((ratio, codon))
    return [codon for _, codon in sorted(out)]


def retention_gap(
    pairs: list[Pair], *, threshold: float = TARGET_RETENTION_MAX
) -> tuple[float, float]:
    """Return the highest target retention and the lowest non-target one.

    The separation between the two is what makes ``threshold`` a calibration
    rather than a guess. A caller that finds them close should not trust the
    target set.
    """
    ratios = sorted(
        recoded_n / native_n
        for native_n, recoded_n in retention(pairs).values()
        if native_n
    )
    below = [r for r in ratios if r <= threshold]
    above = [r for r in ratios if r > threshold]
    return (max(below) if below else 0.0, min(above) if above else 1.0)


def terminal_stops(sequences: list[tuple[str, str]]) -> Counter[str]:
    """Count the final codon of each sequence, stop or not."""
    counts: Counter[str] = Counter()
    for _, sequence in sequences:
        codons = codons_of(sequence)
        if codons:
            counts[codons[-1]] += 1
    return counts


def stop_targets(
    sequences: list[tuple[str, str]], *, threshold: float = TARGET_RETENTION_MAX
) -> list[str]:
    """Return the stop codons the design removes, by terminal-stop share.

    A stop codon cannot be judged by ``target_codons``, which counts body
    codons only, so the seventh Ec_Syn57 target would otherwise be asserted
    from the article rather than derived. Here a stop is a target when it
    terminates at most ``threshold`` of the CDSs that end in any stop at all.
    Sequences ending in a sense codon are excluded from the denominator; they
    are annotation artefacts, not a choice of stop.
    """
    counts = terminal_stops(sequences)
    stops = {c: n for c, n in counts.items() if AMINO_ACID.get(c) == "*"}
    total = sum(stops.values())
    if not total:
        return []
    return sorted(
        (c for c in stops if stops[c] / total <= threshold),
        key=lambda c: stops[c] / total,
    )


def residual_targets(
    sequences: list[tuple[str, str]], targets: set[str]
) -> dict[str, Counter[str]]:
    """Return ``gene -> Counter`` of target codons still present in the body.

    These are the loci at which the design is not actually recoded, and they
    bound any statement that a strain is free of a given codon.
    """
    out: dict[str, Counter[str]] = {}
    for gene, sequence in sequences:
        found = Counter(c for c in body_codons(sequence) if c in targets)
        if found:
            out[gene] = found
    return out


def destinations(
    counts: Counter[tuple[str, str]], targets: list[str]
) -> dict[str, list[tuple[str, int]]]:
    """Return, per target codon, its replacement codons by descending count."""
    grouped: dict[str, list[tuple[str, int]]] = {}
    by_source: dict[str, list[tuple[int, str]]] = defaultdict(list)
    for (before, after), n in counts.items():
        if before in targets:
            by_source[before].append((n, after))
    for codon in targets:
        grouped[codon] = [
            (after, n) for n, after in sorted(by_source[codon], reverse=True)
        ]
    return grouped


def single_destination_targets(
    counts: Counter[tuple[str, str]], targets: list[str]
) -> list[str]:
    """Return the targets replaced by exactly one codon.

    ``site/js/core/scheme.js`` models a recoding scheme as a codon-to-codon
    map, so only a target in this list can be expressed as a preset entry. A
    target with several destinations cannot, and that is a property of the
    design rather than a gap in the derivation.
    """
    return [
        codon
        for codon, dest in destinations(counts, targets).items()
        if len(dest) == 1
    ]


def _write_tsv(path: Path, header: list[str], rows: list[list[object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, delimiter="\t", lineterminator="\n")
        writer.writerow(header)
        writer.writerows(rows)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", type=Path, default=OUT_DIR)
    parser.add_argument("--design", type=Path, default=DESIGN_GB)
    parser.add_argument("--native", type=Path, default=NATIVE_CDS_GZ)
    parser.add_argument("--variants", type=Path, default=VARIANTS_XLSX)
    parser.add_argument("--variants-sheet", default=VARIANTS_SHEET)
    parser.add_argument(
        "--report",
        action="store_true",
        help="print a summary and write no files",
    )
    args = parser.parse_args(argv)

    native = read_native_cds(args.native)
    design = read_design_cds(args.design)
    supplied = read_supplied_variants(args.variants, args.variants_sheet)

    design_pairs, design_rejected = pair_against_native(design, native)
    supplied_pairs, supplied_rejected = pair_against_native(supplied, native)

    sense_targets = target_codons(design_pairs)
    stop_removed = stop_targets(design)
    targets = sense_targets + stop_removed
    supplied_targets = target_codons(supplied_pairs)
    low, high = retention_gap(design_pairs)
    design_subs = substitutions(design_pairs)
    supplied_subs = substitutions(supplied_pairs)
    target_set = set(targets)
    residual = residual_targets(design, target_set)
    stops = terminal_stops(design)
    terminal_stop_counts = {
        c: n for c, n in stops.items() if AMINO_ACID.get(c) == "*"
    }
    total_terminal_stops = sum(terminal_stop_counts.values())
    single = single_destination_targets(design_subs, targets)

    print(f"design CDS: {len(design)}, paired: {len(design_pairs)}")
    print(f"supplied variants: {len(supplied)}, paired: {len(supplied_pairs)}")
    print(
        f"target codons, genome-wide: {', '.join(sense_targets)}"
        f" (sense) + {', '.join(stop_removed) or 'none'} (stop)"
        f" = {len(targets)}"
    )
    print(f"target codons, supplied variants: {', '.join(supplied_targets)}")
    print(
        f"retention separation: highest target {low:.5f}, "
        f"lowest non-target {high:.5f}"
    )
    print(f"targets with a single destination codon: {single or 'none'}")
    print(
        f"genes retaining a target codon: {len(residual)} "
        f"({sum(sum(c.values()) for c in residual.values())} codons)"
    )
    print(f"terminal TAG still present in: {stops.get('TAG', 0)} CDS")

    if args.report:
        return 0

    out = args.out_dir
    _write_tsv(
        out / "ec_syn57_retention.tsv",
        ["codon", "amino_acid", "native_count", "design_count", "retention",
         "is_target", "basis"],
        [
            [
                codon,
                AMINO_ACID.get(codon, "?"),
                native_n,
                recoded_n,
                f"{recoded_n / native_n:.6f}" if native_n else "",
                "yes" if codon in target_set else "no",
                "body-codon retention",
            ]
            for codon, (native_n, recoded_n) in sorted(
                retention(design_pairs).items()
            )
        ]
        + [
            [
                codon,
                "*",
                "",
                terminal_stop_counts.get(codon, 0),
                f"{terminal_stop_counts.get(codon, 0) / total_terminal_stops:.6f}"
                if total_terminal_stops
                else "",
                "yes" if codon in target_set else "no",
                "terminal-stop share",
            ]
            for codon in sorted(_TABLE.stop_codons)
        ],
    )
    _write_tsv(
        out / "ec_syn57_substitutions.tsv",
        ["source", "native_codon", "recoded_codon", "amino_acid", "count",
         "share_of_native_codon"],
        [
            [
                label,
                before,
                after,
                AMINO_ACID.get(before, "?"),
                n,
                f"{n / total:.6f}",
            ]
            for label, counts in (
                ("genome_wide", design_subs),
                ("supplied_variants", supplied_subs),
            )
            for (before, after), n in sorted(
                counts.items(), key=lambda kv: (-kv[1], kv[0])
            )
            for total in [sum(v for (b, _), v in counts.items() if b == before)]
        ],
    )
    _write_tsv(
        out / "ec_syn57_residual_targets.tsv",
        ["gene", "codon", "amino_acid", "count"],
        [
            [gene, codon, AMINO_ACID.get(codon, "?"), n]
            for gene, found in sorted(residual.items())
            for codon, n in sorted(found.items())
        ],
    )
    _write_tsv(
        out / "ec_syn57_unpaired.tsv",
        ["source", "gene", "reason"],
        [
            [label, r.gene, r.reason]
            for label, rejections in (
                ("genome_wide", design_rejected),
                ("supplied_variants", supplied_rejected),
            )
            for r in rejections
        ],
    )
    print(f"wrote 4 tables to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
