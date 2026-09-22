#!/usr/bin/env python3
"""Independently compares RefSeq tRNA calls against a pinned tRNAscan-SE run.

Inputs are the pinned UTEX 2973 assembly (GCF_000817325.1_ASM81732v1) already
verified against data/manifest/annotation-release-v1.json, and a tabular
tRNAscan-SE 2.0 (bacterial mode) run over the same FASTA. See
docs/validation/trna-annotation-validation.md for the exact commands used to
produce the tRNAscan-SE output and how to reproduce this comparison.

Anticodon extraction and the Ile-CAT lysidine / inosine wobble conventions
intentionally mirror scripts/build_features.py's effective_anticodon() so this
independent check and the production pipeline never silently diverge.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import unquote

LYSIDINE_TRNA = ("Ile", "CAT")
_COMPLEMENT = str.maketrans("ACGT", "TGCA")


def reverse_complement(sequence: str) -> str:
    return sequence.translate(_COMPLEMENT)[::-1]


def effective_anticodon(amino_acid: str, genomic_anticodon: str) -> str:
    """Returns the modified anticodon used by the bacterial tAI model.

    Duplicated in full from scripts/build_features.py rather than imported,
    because that module pulls in ViennaRNA/umap at import time; this keeps the
    independent check runnable without the full pipeline environment. A
    parity test asserts the two stay identical.
    """
    anticodon = genomic_anticodon
    if anticodon.startswith("A"):
        anticodon = "I" + anticodon[1:]
    if (amino_acid, anticodon) == LYSIDINE_TRNA:
        return "LAT"
    return anticodon


def parse_attributes(value: str) -> dict[str, str]:
    result = {}
    for field in value.strip().split(";"):
        if "=" in field:
            key, item = field.split("=", 1)
            result[key] = unquote(item)
    return result


def load_genome(fasta_path: Path) -> dict[str, str]:
    genome: dict[str, str] = {}
    name = None
    chunks: list[str] = []
    opener = gzip.open if fasta_path.suffix == ".gz" else open
    with opener(fasta_path, "rt") as handle:
        for line in handle:
            line = line.rstrip("\n")
            if line.startswith(">"):
                if name is not None:
                    genome[name] = "".join(chunks)
                name = line[1:].split()[0]
                chunks = []
            else:
                chunks.append(line)
        if name is not None:
            genome[name] = "".join(chunks)
    return genome


def parse_refseq_trnas(gff_path: Path, genome: dict[str, str]) -> list[dict[str, Any]]:
    """Reads the 44 pinned RefSeq tRNA loci and their genomic anticodons."""
    loci: list[dict[str, Any]] = []
    opener = gzip.open if gff_path.suffix == ".gz" else open
    with opener(gff_path, "rt") as handle:
        for line in handle:
            if line.startswith("#"):
                continue
            fields = line.rstrip("\n").split("\t")
            if len(fields) != 9 or fields[2] != "tRNA":
                continue
            seqid, _, _, start, end, _, strand, _, raw_attributes = fields
            attributes = parse_attributes(raw_attributes)
            match = re.search(
                r"(?:complement\()?([0-9]+)\.\.([0-9]+)",
                attributes.get("anticodon", ""),
            )
            if not match:
                raise ValueError(f"No anticodon coordinate for {attributes}")
            anticodon = genome[seqid][int(match.group(1)) - 1 : int(match.group(2))]
            if "complement" in attributes["anticodon"]:
                anticodon = reverse_complement(anticodon)
            amino_acid = attributes["product"].removeprefix("tRNA-")
            loci.append(
                {
                    "locus_tag": attributes["locus_tag"],
                    "seqid": seqid,
                    "start": int(start),
                    "end": int(end),
                    "strand": strand,
                    "isotype": amino_acid,
                    "anticodon": anticodon,
                    "effective_anticodon": effective_anticodon(amino_acid, anticodon),
                    "pseudo": attributes.get("pseudo") == "true",
                }
            )
    return loci


# tRNAscan-SE folds "Ile2" (the lysidine-modified elongator) into RefSeq's plain
# "Ile" product name, and folds "fMet" (initiator) into RefSeq's plain "Met".
# Both are documented isotype-naming conventions, not annotation disagreements.
ISOTYPE_ALIASES = {"Ile2": "Ile", "fMet": "Met", "Undet": "Undet"}


def parse_trnascan_output(out_path: Path) -> list[dict[str, Any]]:
    """Reads a tabular tRNAscan-SE 2.0 result file (`-o` output)."""
    calls: list[dict[str, Any]] = []
    with out_path.open(encoding="utf-8") as handle:
        lines = handle.readlines()
    for line in lines[3:]:
        if not line.strip():
            continue
        fields = [f.strip() for f in line.rstrip("\n").split("\t")]
        if len(fields) < 9:
            continue
        seqid, _, begin, end, isotype, anticodon, _, _, score, *note = fields
        begin_i, end_i = int(begin), int(end)
        strand = "+" if begin_i <= end_i else "-"
        calls.append(
            {
                "seqid": seqid,
                "start": min(begin_i, end_i),
                "end": max(begin_i, end_i),
                "strand": strand,
                "isotype": ISOTYPE_ALIASES.get(isotype, isotype),
                "raw_isotype": isotype,
                "anticodon": anticodon,
                "score": float(score),
                "pseudo": bool(note) and "pseudo" in note[0].lower(),
            }
        )
    return calls


def compare(
    refseq: list[dict[str, Any]], scan: list[dict[str, Any]]
) -> dict[str, Any]:
    """Matches RefSeq loci to tRNAscan-SE calls by exact genomic coordinates."""
    scan_by_coord = {(c["seqid"], c["start"], c["end"], c["strand"]): c for c in scan}
    matched_scan_keys: set[tuple[str, int, int, str]] = set()
    rows: list[dict[str, Any]] = []

    for locus in refseq:
        key = (locus["seqid"], locus["start"], locus["end"], locus["strand"])
        call = scan_by_coord.get(key)
        row: dict[str, Any] = {
            "locus_tag": locus["locus_tag"],
            "seqid": locus["seqid"],
            "start": locus["start"],
            "end": locus["end"],
            "strand": locus["strand"],
            "refseq_isotype": locus["isotype"],
            "refseq_anticodon": locus["anticodon"],
            "refseq_effective_anticodon": locus["effective_anticodon"],
            "refseq_pseudo": locus["pseudo"],
        }
        if call is None:
            row["status"] = "unresolved"
            row["reason"] = "no coordinate-matched tRNAscan-SE 2.0 call"
            row["scan_isotype"] = None
            row["scan_anticodon"] = None
            row["scan_score"] = None
            row["scan_pseudo"] = None
        else:
            matched_scan_keys.add(key)
            row["scan_isotype"] = call["raw_isotype"]
            row["scan_anticodon"] = call["anticodon"]
            row["scan_score"] = call["score"]
            row["scan_pseudo"] = call["pseudo"]
            mismatches = []
            if call["isotype"] != locus["isotype"]:
                mismatches.append(
                    f"isotype {locus['isotype']!r} vs {call['isotype']!r}"
                )
            if call["anticodon"] != locus["anticodon"]:
                mismatches.append(
                    f"anticodon {locus['anticodon']!r} vs {call['anticodon']!r}"
                )
            if call["pseudo"] != locus["pseudo"]:
                mismatches.append(
                    "pseudogene flag disagreement: RefSeq="
                    f"{locus['pseudo']} vs tRNAscan-SE={call['pseudo']}"
                )
            if mismatches:
                row["status"] = "discordant"
                row["reason"] = "; ".join(mismatches)
            else:
                row["status"] = "concordant"
                row["reason"] = "match"
        rows.append(row)

    extra_calls = [
        {
            "seqid": c["seqid"],
            "start": c["start"],
            "end": c["end"],
            "strand": c["strand"],
            "scan_isotype": c["raw_isotype"],
            "scan_anticodon": c["anticodon"],
            "scan_score": c["score"],
            "scan_pseudo": c["pseudo"],
        }
        for key, c in scan_by_coord.items()
        if key not in matched_scan_keys
    ]

    counts = {
        "concordant": sum(1 for r in rows if r["status"] == "concordant"),
        "discordant": sum(1 for r in rows if r["status"] == "discordant"),
        "unresolved": sum(1 for r in rows if r["status"] == "unresolved"),
        "refseq_total": len(rows),
        "tRNAscan_only_calls": len(extra_calls),
    }
    return {"counts": counts, "loci": rows, "tRNAscan_only": extra_calls}


def write_report(result: dict[str, Any], tsv_path: Path, json_path: Path) -> None:
    fieldnames = [
        "locus_tag",
        "seqid",
        "start",
        "end",
        "strand",
        "status",
        "refseq_isotype",
        "scan_isotype",
        "refseq_anticodon",
        "scan_anticodon",
        "refseq_effective_anticodon",
        "scan_score",
        "refseq_pseudo",
        "scan_pseudo",
        "reason",
    ]
    with tsv_path.open("w", encoding="utf-8", newline="") as handle:
        # csv.writer defaults to a CRLF line terminator even on POSIX; a
        # trailing \r reads as trailing whitespace to `git diff --check`.
        writer = csv.DictWriter(
            handle, fieldnames=fieldnames, delimiter="\t", lineterminator="\n"
        )
        writer.writeheader()
        for row in result["loci"]:
            writer.writerow({k: row.get(k, "") for k in fieldnames})
    json_path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fasta", type=Path, required=True)
    parser.add_argument("--gff", type=Path, required=True)
    parser.add_argument("--trnascan-out", type=Path, required=True)
    parser.add_argument("--tsv-out", type=Path, required=True)
    parser.add_argument("--json-out", type=Path, required=True)
    args = parser.parse_args(argv)

    genome = load_genome(args.fasta)
    refseq = parse_refseq_trnas(args.gff, genome)
    if len(refseq) != 44:
        raise SystemExit(f"Expected 44 pinned RefSeq tRNA loci, found {len(refseq)}")
    scan = parse_trnascan_output(args.trnascan_out)
    result = compare(refseq, scan)
    write_report(result, args.tsv_out, args.json_out)

    counts = result["counts"]
    print(
        f"concordant={counts['concordant']} discordant={counts['discordant']} "
        f"unresolved={counts['unresolved']} tRNAscan_only={counts['tRNAscan_only_calls']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
