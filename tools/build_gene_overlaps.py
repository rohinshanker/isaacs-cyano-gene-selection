#!/usr/bin/env python3
"""Build or check one organism's overlapping-gene layer, ``gene_overlaps.json``.

The layer answers one question for every annotated gene of the organism's pinned
release: which other annotated genes share at least one genomic base with it, on
either strand, and exactly which bases. It is the single source of the OG
relation the three viewers, the OG tag, its filter and its colour all read.

Why it is not ``overlapsNeighbor``. ``scripts/build_features.py`` writes that
boolean from the gap to the two CDSs adjacent in coordinate order, measured on
each gene's bounding envelope. That is the right companion to
``neighborUpstreamNt``/``neighborDownstreamNt`` and it keeps that meaning, but it
cannot see a gene contained inside a non-adjacent one, it cannot see a tRNA or
rRNA at all because they are not in ``genes.json``, it would count the gap inside
a joined CDS as occupied, and it carries no partner, strand or shared interval.

What counts, by owner decision of 2026-10-09 (DEM-337 Q1/Q2):

* every ``gene`` or ``pseudogene`` row of the pinned GFF3 with a ``locus_tag``,
  including tRNA, rRNA, tmRNA, ncRNA, SRP_RNA, RNase_P_RNA and pseudogene rows.
  ``riboswitch`` and ``misc_feature`` rows are regulatory annotation, not genes,
  and are excluded; nothing predicted or scan-only is introduced here;
* a gene's extent is the union of its annotated child segments — each child's
  ``exon`` rows when it has them, else the child's own span. A gene row the
  release gives no child uses its own span, recorded as ``segmentSource: gene``
  so it is never mistaken for a measured child extent;
* an overlap is at least one shared base between two *different* genes'
  segments on the *same* replicon, on either strand. Exact integer arithmetic:
  a one-base overlap counts, abutting ends do not, and no envelope, tolerance,
  minimum length, or cross-replicon or cross-organism join is ever used.

Usage:
    tools/build_gene_overlaps.py build [--organism ID] [--raw-dir DIR] [--data-dir DIR]
    tools/build_gene_overlaps.py check [--organism ID] [--raw-dir DIR] [--data-dir DIR]

``check`` rebuilds the payload from the pinned GFF3 and compares the published
bytes, so a hand-edited or stale layer fails. Run ``build`` before
``tools/build_data_manifest.py build``.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "tools"))
from organisms import OrganismConfig, get_organism  # noqa: E402
from annotation_release import (  # noqa: E402
    Feature, ReleaseError, normalized_segments, parse_gff,
)

PAYLOAD_NAME = "gene_overlaps.json"
SCHEMA_VERSION = 1
DATASET_VERSION = "gene-overlaps-v1"
PRODUCER = "tools/build_gene_overlaps.py"

#: The GFF rows that are annotated genes. Everything else is either a child of
#: one of these or regulatory annotation that the release does not call a gene.
GENE_KINDS = frozenset({"gene", "pseudogene"})

#: Rows that describe the drawn pieces of a parent feature rather than a feature
#: of their own, so a multi-exon RNA contributes its exons and not its envelope.
SEGMENT_KIND = "exon"

DEFINITION = {
    "features": (
        "every gene or pseudogene row of the pinned release with a locus tag, including "
        "tRNA, rRNA, tmRNA, ncRNA, SRP_RNA, RNase_P_RNA and pseudogene rows"
    ),
    "extent": (
        "the union of the gene's annotated child segments: each child's exon rows when it "
        "has them, else the child's own span; the gene row's own span only where the "
        "release annotates no child, marked segmentSource gene"
    ),
    "overlap": (
        "at least one shared genomic base between two different genes' segments on the "
        "same replicon, on either strand; a one-base overlap counts and abutting ends do not"
    ),
    "excluded": (
        "regulatory and misc_feature rows, which the release does not annotate as genes, and "
        "anything outside the pinned release: this layer adds no scan of its own. The release's "
        "own gene rows include computationally annotated ones, which are genes here"
    ),
}


class OverlapError(RuntimeError):
    """Raised when an input or a published layer violates this contract."""


def _gff_path(raw_dir: Path, organism: OrganismConfig) -> Path:
    """The pinned genomic GFF3 of one organism's release."""
    name = f"{organism.assemblyPrefix}_genomic.gff.gz"
    path = raw_dir / name
    if not path.exists():
        raise OverlapError(f"missing pinned annotation {path}")
    return path


def file_sha256(path: Path) -> str:
    """The digest of the exact input bytes, so a layer names what it was built from."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def merge_segments(segments: Iterable[tuple[int, int]]) -> list[tuple[int, int]]:
    """Canonical minimal cover: overlapping or abutting pieces become one.

    Two child rows that touch describe one continuous stretch of occupied bases,
    and the overlap relation is about occupied bases. A real discontinuity — the
    gap inside a joined CDS, or the two ends of an origin-crossing feature — is
    not abutting and therefore survives, which is the whole point of reading
    segments rather than a start-to-end envelope.
    """
    ordered = sorted(segments)
    merged: list[tuple[int, int]] = []
    for start, end in ordered:
        if merged and start <= merged[-1][1] + 1:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


def shared_intervals(
    left: Sequence[tuple[int, int]], right: Sequence[tuple[int, int]]
) -> list[tuple[int, int]]:
    """Every base two genes share, as inclusive intervals in coordinate order."""
    shared: list[tuple[int, int]] = []
    for a_start, a_end in left:
        for b_start, b_end in right:
            start = max(a_start, b_start)
            end = min(a_end, b_end)
            if start <= end:
                shared.append((start, end))
    return merge_segments(shared) if shared else []


def covered_bases(segments: Iterable[tuple[int, int]]) -> int:
    """Total bases a canonical segment list occupies."""
    return sum(end - start + 1 for start, end in segments)


def gene_segments(
    features: Sequence[Feature], lengths: Mapping[str, int]
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """Every annotated gene with its canonical segments, in coordinate order.

    Returns the gene records and the biotype census of the whole annotation, so
    a consumer can state the full inventory whatever it chooses to list.
    """
    children: dict[str, list[Feature]] = defaultdict(list)
    for feature in features:
        parent = feature.attrs.get("Parent")
        if parent:
            for one in parent.split(","):
                children[one].append(feature)

    def segments_of(feature: Feature) -> list[tuple[int, int]]:
        pieces = [
            child for child in children.get(feature.attrs.get("ID", ""), [])
            if child.kind == SEGMENT_KIND
        ]
        sources = pieces or [feature]
        found: list[tuple[int, int]] = []
        for source in sources:
            if source.seqid not in lengths:
                raise OverlapError(f"{source.seqid} has no sequence-region header")
            found.extend(normalized_segments(source, lengths[source.seqid]))
        return found

    records: list[dict[str, Any]] = []
    census: dict[str, int] = defaultdict(int)
    for feature in features:
        if feature.kind not in GENE_KINDS:
            continue
        locus = feature.attrs.get("locus_tag")
        if not locus:
            continue
        biotype = feature.attrs.get("gene_biotype") or feature.kind
        census[biotype] += 1
        own = [
            child for child in children.get(feature.attrs.get("ID", ""), [])
            if child.kind != SEGMENT_KIND
        ]
        pieces: list[tuple[int, int]] = []
        for child in own:
            if child.seqid != feature.seqid:
                raise OverlapError(f"{locus}: child {child.kind} is on another replicon")
            pieces.extend(segments_of(child))
        source = "child" if pieces else "gene"
        if not pieces:
            pieces = normalized_segments(feature, lengths[feature.seqid])
        records.append({
            "id": locus,
            "name": feature.attrs.get("gene") or None,
            "biotype": biotype,
            "seqid": feature.seqid,
            "strand": feature.strand if feature.strand in {"+", "-"} else None,
            "segments": merge_segments(pieces),
            "segmentSource": source,
            "pseudo": feature.kind == "pseudogene"
            or feature.attrs.get("pseudo") == "true"
            or biotype == "pseudogene",
        })
    seen: dict[str, int] = defaultdict(int)
    for record in records:
        seen[record["id"]] += 1
    duplicates = sorted(locus for locus, count in seen.items() if count > 1)
    if duplicates:
        raise OverlapError(f"locus tags appear more than once: {', '.join(duplicates[:4])}")
    return records, dict(census)


def overlap_pairs(
    records: Sequence[Mapping[str, Any]],
) -> list[tuple[int, int, list[tuple[int, int]]]]:
    """Every overlapping pair of genes with the exact bases they share.

    One sweep per replicon over segment starts. Only genes whose segments are
    still open can share a base with the segment being opened, so the comparison
    is against those alone; a gene is never compared with itself, and a pair
    found through two different segments is reported once with the union of what
    the segments share.
    """
    by_replicon: dict[str, list[tuple[int, int, int]]] = defaultdict(list)
    for index, record in enumerate(records):
        for start, end in record["segments"]:
            by_replicon[record["seqid"]].append((start, end, index))
    found: dict[tuple[int, int], list[tuple[int, int]]] = {}
    for intervals in by_replicon.values():
        intervals.sort()
        active: list[tuple[int, int, int]] = []
        for start, end, index in intervals:
            active = [item for item in active if item[1] >= start]
            for other_start, other_end, other in active:
                if other == index:
                    continue
                low, high = max(start, other_start), min(end, other_end)
                if low > high:
                    continue
                key = (min(index, other), max(index, other))
                found.setdefault(key, []).append((low, high))
            active.append((start, end, index))
    return [
        (first, second, merge_segments(pieces))
        for (first, second), pieces in sorted(found.items())
    ]


def build_payload(gff_path: Path, organism: OrganismConfig) -> dict[str, Any]:
    """The published layer for one organism, exactly as it ships."""
    features, lengths = parse_gff(gff_path)
    records, census = gene_segments(features, lengths)
    order = {accession: position for position, accession in enumerate(sorted(lengths))}
    records.sort(key=lambda record: (
        order[record["seqid"]], record["segments"][0][0], record["id"],
    ))
    pairs = overlap_pairs(records)

    participating = sorted({index for first, second, _ in pairs for index in (first, second)})
    position = {index: rank for rank, index in enumerate(participating)}
    listed = [records[index] for index in participating]
    partner_counts: dict[int, int] = defaultdict(int)
    for first, second, _ in pairs:
        partner_counts[first] += 1
        partner_counts[second] += 1

    return {
        "schemaVersion": SCHEMA_VERSION,
        "datasetVersion": DATASET_VERSION,
        "origin": "computed",
        "producer": PRODUCER,
        "definition": DEFINITION,
        "release": {
            "accession": organism.accession,
            "gff": gff_path.name,
            "sha256": file_sha256(gff_path),
        },
        "replicons": [
            {"accession": accession, "lengthBp": lengths[accession]}
            for accession in sorted(lengths, key=lambda name: order[name])
        ],
        "coverage": {
            "annotatedGenes": len(records),
            "byBiotype": dict(sorted(census.items())),
            "childlessGenes": sum(
                1 for record in records if record["segmentSource"] == "gene"
            ),
            "overlappingGenes": len(listed),
            "overlappingPairs": len(pairs),
            # Summed over pairs, so a base two different pairs both share is
            # counted twice. It is not the number of distinct genomic bases
            # under an overlap, and nothing may present it as one.
            "pairwiseSharedBases": sum(covered_bases(pieces) for _, _, pieces in pairs),
            "maxPartners": max(partner_counts.values(), default=0),
        },
        # Every annotated gene that was compared, by locus tag. Without it a
        # gene absent from `features` could be a gene with no partner or a gene
        # nobody looked at, and the two must never be confused: a consumer
        # reads zero partners as a measured absence only for an identity that
        # is in this list.
        "coveredGenes": sorted(record["id"] for record in records),
        "features": [
            {
                "id": record["id"],
                "name": record["name"],
                "biotype": record["biotype"],
                "seqid": record["seqid"],
                "strand": record["strand"],
                "segments": [list(segment) for segment in record["segments"]],
                "segmentSource": record["segmentSource"],
                "pseudo": record["pseudo"],
            }
            for record in listed
        ],
        "pairs": [
            [position[first], position[second], [list(piece) for piece in pieces]]
            for first, second, pieces in pairs
        ],
    }


def serialize(payload: Mapping[str, Any]) -> str:
    """The layer's exact published bytes: sorted keys, compact, one newline."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":")) + "\n"


def main(argv: list[str] | None = None) -> int:
    """Run ``build`` or ``check`` for one organism; return a process exit code."""
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("mode", choices=("build", "check"))
    parser.add_argument("--organism", default=None)
    parser.add_argument("--raw-dir", type=Path, default=None)
    parser.add_argument("--data-dir", type=Path, default=None)
    args = parser.parse_args(argv)
    try:
        organism = get_organism(args.organism)
        raw_dir = args.raw_dir or organism.path("rawDirectory")
        data_dir = args.data_dir or organism.path("outputDirectory")
        text = serialize(build_payload(_gff_path(raw_dir, organism), organism))
        target = data_dir / PAYLOAD_NAME
        if args.mode == "build":
            target.write_text(text, encoding="utf-8")
            coverage = json.loads(text)["coverage"]
            print(
                f"wrote {target}: {coverage['annotatedGenes']:,} annotated genes, "
                f"{coverage['overlappingGenes']:,} overlapping in "
                f"{coverage['overlappingPairs']:,} pairs over "
                f"{coverage['pairwiseSharedBases']:,} pairwise shared bases"
            )
        else:
            if not target.is_file():
                raise OverlapError(
                    f"missing {target}; run: {PRODUCER} build --organism {organism.organism_id}"
                )
            published = target.read_text(encoding="utf-8")
            if published != text:
                raise OverlapError(
                    f"{target} is not what {PRODUCER} builds from {organism.accession}; "
                    f"run: {PRODUCER} build --organism {organism.organism_id}"
                )
            print(f"{target} matches the pinned annotation")
    except (OverlapError, ReleaseError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
