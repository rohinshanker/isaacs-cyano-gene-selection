#!/usr/bin/env python3
"""Derive annotated UTEX 2973 16S rRNA 3' terminal sequences."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Any, TextIO

import annotation_release as release


DEFAULT_MANIFEST = Path("data/manifest/annotation-release-v1.json")
DEFAULT_TERMINAL_LENGTH = 9
OUTPUT_FIELDS = (
    "assembly_accession",
    "annotation_release",
    "locus_tag",
    "replicon_accession",
    "start",
    "end",
    "strand",
    "feature_length",
    "terminal_length",
    "three_prime_sequence_rna",
)
DNA_COMPLEMENT = str.maketrans(
    "ACGTRYSWKMBDHVN",
    "TGCAYRSWMKVHDBN",
)


def _require_locus_tag(feature: release.Feature) -> str:
    """Returns a 16S locus tag or raises with its genomic location."""
    locus = feature.attrs.get("locus_tag")
    if not locus:
        raise release.ReleaseError(
            f"{feature.seqid}:{feature.start}-{feature.end}: "
            "16S rRNA feature is missing locus_tag"
        )
    return locus


def parse_16s_features(
    path: Path,
) -> tuple[list[release.Feature], dict[str, int]]:
    """Returns complete annotated 16S features and replicon lengths."""
    parsed, lengths = release.parse_gff(path)
    features: list[release.Feature] = []
    for feature in parsed:
        product = feature.attrs.get("product", "")
        if feature.kind != "rRNA" or not product.startswith("16S ribosomal RNA"):
            continue
        locus = _require_locus_tag(feature)
        if product != "16S ribosomal RNA":
            raise release.ReleaseError(
                f"{locus}: 16S rRNA product is not complete: {product}"
            )
        features.append(feature)
    if not features:
        raise release.ReleaseError(f"{path}: no annotated 16S rRNA features found")
    return features, lengths


def parse_fasta(path: Path) -> dict[str, str]:
    """Reads a genomic FASTA keyed by each header's first token."""
    sequences: dict[str, list[str]] = {}
    current_id = ""
    with release.open_text(path) as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line:
                continue
            if line.startswith(">"):
                header = line[1:].split(maxsplit=1)
                if not header:
                    raise release.ReleaseError(
                        f"{path}: FASTA header has no identifier"
                    )
                current_id = header[0]
                if current_id in sequences:
                    raise release.ReleaseError(
                        f"{path}: duplicate FASTA identifier {current_id}"
                    )
                sequences[current_id] = []
            else:
                if not current_id:
                    raise release.ReleaseError(
                        f"{path}: sequence data precedes the first FASTA header"
                    )
                sequences[current_id].append(line.upper())
    return {identifier: "".join(parts) for identifier, parts in sequences.items()}


def derive_rows(
    gff_path: Path,
    fasta_path: Path,
    assembly_accession: str,
    annotation_release: str,
    terminal_length: int = DEFAULT_TERMINAL_LENGTH,
) -> list[dict[str, Any]]:
    """Returns one provenance-carrying row per annotated 16S rRNA copy."""
    if terminal_length < 1:
        raise release.ReleaseError("terminal length must be a positive integer")
    sequences = parse_fasta(fasta_path)
    features, lengths = parse_16s_features(gff_path)
    rows: list[dict[str, Any]] = []
    for feature in features:
        locus = _require_locus_tag(feature)
        if feature.strand not in {"+", "-"}:
            raise release.ReleaseError(
                f"{locus}: invalid strand {feature.strand!r}; expected '+' or '-'"
            )
        try:
            replicon = sequences[feature.seqid]
            replicon_length = lengths[feature.seqid]
        except KeyError as error:
            raise release.ReleaseError(
                f"{locus}: replicon {feature.seqid} is absent from the GFF3 "
                "sequence regions or FASTA"
            ) from error
        if len(replicon) != replicon_length:
            raise release.ReleaseError(
                f"{locus}: {feature.seqid} length differs between GFF3 and FASTA"
            )
        segments = release.normalized_segments(feature, replicon_length)
        feature_length = sum(end - start + 1 for start, end in segments)
        if terminal_length > feature_length:
            raise release.ReleaseError(
                f"{locus}: terminal length {terminal_length} exceeds "
                f"feature length {feature_length}"
            )
        genomic = "".join(replicon[start - 1 : end] for start, end in segments)
        transcript = (
            genomic
            if feature.strand == "+"
            else genomic.translate(DNA_COMPLEMENT)[::-1]
        )
        rows.append(
            {
                "assembly_accession": assembly_accession,
                "annotation_release": annotation_release,
                "locus_tag": locus,
                "replicon_accession": feature.seqid,
                "start": feature.start,
                "end": feature.end,
                "strand": feature.strand,
                "feature_length": feature_length,
                "terminal_length": terminal_length,
                "three_prime_sequence_rna": transcript[-terminal_length:].replace(
                    "T", "U"
                ),
            }
        )
    return sorted(
        rows,
        key=lambda row: (
            row["replicon_accession"],
            row["start"],
            row["end"],
            row["locus_tag"],
        ),
    )


def pinned_context(
    manifest_path: Path,
    gff_override: Path | None = None,
    fasta_override: Path | None = None,
) -> tuple[Path, Path, str, str]:
    """Resolves and verifies the two pinned inputs and their provenance."""
    manifest = release.load_manifest(manifest_path)
    root = release.repository_root(manifest_path)
    source = next(
        (
            item
            for item in manifest["sources"]
            if item.get("id") == "utex2973-refseq"
        ),
        None,
    )
    if source is None:
        raise release.ReleaseError("manifest has no utex2973-refseq source")
    entries = release.entries_by_role({"sources": [source]})
    try:
        gff_entry = entries["gff-annotation"]
        fasta_entry = entries["genome-fasta"]
    except KeyError as error:
        raise release.ReleaseError(
            f"UTEX manifest source has no {error.args[0]} input"
        ) from error
    gff_path = gff_override or root / gff_entry["localPath"]
    fasta_path = fasta_override or root / fasta_entry["localPath"]
    for path, entry in ((gff_path, gff_entry), (fasta_path, fasta_entry)):
        checked_entry = {**entry, "localPath": path.name}
        release.verify_files(
            {"sources": [{"files": [checked_entry]}]},
            path.parent,
        )
    metadata = release._gff_headers(gff_path)
    assembly_accession = source["assemblyAccession"]
    annotation_release = source["annotationRelease"]
    if metadata.get("genome-build-accession") != (
        "NCBI_Assembly:" + assembly_accession
    ):
        raise release.ReleaseError(
            "GFF3 assembly accession does not match the manifest"
        )
    if metadata.get("annotation-source") != (
        "NCBI RefSeq " + annotation_release
    ):
        raise release.ReleaseError(
            "GFF3 annotation release does not match the manifest"
        )
    return gff_path, fasta_path, assembly_accession, annotation_release


def write_rows(rows: list[dict[str, Any]], output_format: str, stream: TextIO) -> None:
    """Writes derived rows as TSV or JSON."""
    if output_format == "json":
        json.dump(rows, stream, indent=2)
        stream.write("\n")
        return
    if output_format != "tsv":
        raise release.ReleaseError(f"unknown output format: {output_format}")
    writer = csv.DictWriter(
        stream,
        fieldnames=OUTPUT_FIELDS,
        delimiter="\t",
        lineterminator="\n",
    )
    writer.writeheader()
    writer.writerows(rows)


def parser() -> argparse.ArgumentParser:
    """Builds the command-line parser."""
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    result.add_argument(
        "--gff",
        type=Path,
        help="path to a byte-identical copy of the manifest-pinned GFF3",
    )
    result.add_argument(
        "--fasta",
        type=Path,
        help="path to a byte-identical copy of the manifest-pinned genomic FASTA",
    )
    result.add_argument(
        "--length",
        type=int,
        default=DEFAULT_TERMINAL_LENGTH,
        help=(
            "number of transcript-terminal bases "
            f"(default: {DEFAULT_TERMINAL_LENGTH})"
        ),
    )
    result.add_argument("--format", choices=("tsv", "json"), default="tsv")
    return result


def main(argv: list[str] | None = None) -> int:
    """Runs the command-line derivation."""
    args = parser().parse_args(argv)
    try:
        gff_path, fasta_path, assembly_accession, annotation_release = pinned_context(
            args.manifest,
            args.gff,
            args.fasta,
        )
        rows = derive_rows(
            gff_path,
            fasta_path,
            assembly_accession,
            annotation_release,
            args.length,
        )
        write_rows(rows, args.format, sys.stdout)
        return 0
    except (OSError, release.ReleaseError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
