#!/usr/bin/env python3
"""Build exact-protein RefSeq crosswalks for PCC 6311 and PCC 7943."""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable

import annotation_release as release


DEFAULT_MANIFEST = Path("data/manifest/sister-strain-crosswalk-v1.json")
DEFAULT_OUTPUT = Path(
    "data/annotation/releases/GCF_000817325.1-RS_2026_05_13/"
    "sister-strain-crosswalk-v1.tsv"
)
FIELDS = [
    "subject_locus_tag",
    "relationship",
    "object_namespace",
    "object_id",
    "seqid",
    "start",
    "end",
    "strand",
    "mapping_ambiguity",
    "source",
    "evidence",
    "mapping_method",
]
STRAINS = (
    {
        "id": "pcc6311-refseq-crosswalk",
        "label": "PCC 6311",
        "slug": "pcc6311",
        "role": "pcc6311-crosswalk-gff",
        "namespace": "PCC6311",
    },
    {
        "id": "pcc7943-refseq-crosswalk",
        "label": "PCC 7943",
        "slug": "pcc7943",
        "role": "pcc7943-crosswalk-gff",
        "namespace": "PCC7943",
    },
)
EXPECTED_SOURCES = {
    "utex2973-refseq": (
        "GCF_000817325.1",
        "ASM81732v1",
        "Complete Genome",
        "GCF_000817325.1-RS_2026_05_13",
        "2026-05-13",
        "6.11",
    ),
    "pcc6311-refseq-crosswalk": (
        "GCF_022984265.1",
        "ASM2298426v1",
        "Chromosome",
        "GCF_022984265.1-RS_2025_12_23",
        "2025-12-23",
        "6.10",
    ),
    "pcc7943-refseq-crosswalk": (
        "GCF_022984345.1",
        "ASM2298434v1",
        "Chromosome",
        "GCF_022984345.1-RS_2025_12_23",
        "2025-12-23",
        "6.10",
    ),
}


def _source_by_id(manifest: dict[str, Any], source_id: str) -> dict[str, Any]:
    try:
        return next(source for source in manifest["sources"] if source["id"] == source_id)
    except StopIteration as error:
        raise release.ReleaseError(f"manifest has no {source_id} source") from error


def verify_release_metadata(manifest: dict[str, Any], root: Path) -> None:
    """Checks the pinned release identifiers against the downloaded GFF headers."""
    if manifest["releaseId"] != "sister-strain-crosswalk-v1":
        raise release.ReleaseError("unexpected sister-strain crosswalk releaseId")
    entries = release.entries_by_role(manifest)
    for source_id, expected in EXPECTED_SOURCES.items():
        source = _source_by_id(manifest, source_id)
        actual = (
            source["assemblyAccession"],
            source["assemblyName"],
            source.get("assemblyLevel"),
            source["annotationRelease"],
            source["annotationDate"],
            source["pgapVersion"],
        )
        if actual != expected:
            raise release.ReleaseError(
                f"{source_id} release metadata differs from the validated contract"
            )

    roles = {"utex2973-refseq": "utex2973-crosswalk-gff"}
    roles.update({strain["id"]: strain["role"] for strain in STRAINS})
    for source_id, role in roles.items():
        source = _source_by_id(manifest, source_id)
        headers = release._gff_headers(root / entries[role]["localPath"])
        if headers.get("genome-build-accession") != (
            "NCBI_Assembly:" + source["assemblyAccession"]
        ):
            raise release.ReleaseError(f"{source_id} GFF assembly accession mismatch")
        if headers.get("annotation-source") != (
            "NCBI RefSeq " + source["annotationRelease"]
        ):
            raise release.ReleaseError(f"{source_id} GFF annotation release mismatch")


def _protein_loci(features: Iterable[release.Feature]) -> dict[str, list[str]]:
    loci: dict[str, set[str]] = defaultdict(set)
    for feature in features:
        if feature.kind != "CDS":
            continue
        locus = feature.attrs.get("locus_tag")
        protein = feature.attrs.get("protein_id")
        if locus and protein:
            loci[protein].add(locus)
    return {protein: sorted(values) for protein, values in loci.items()}


def _genes(features: Iterable[release.Feature]) -> dict[str, release.Feature]:
    return {
        feature.attrs["locus_tag"]: feature
        for feature in features
        if feature.kind in {"gene", "pseudogene"}
        and feature.attrs.get("locus_tag")
    }


def build_rows(
    target_features: list[release.Feature],
    sister_features: list[release.Feature],
    strain: dict[str, str],
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """Returns exact shared-protein relationships and locus-level coverage counts."""
    target_proteins = _protein_loci(target_features)
    sister_proteins = _protein_loci(sister_features)
    target_genes = _genes(target_features)
    sister_genes = _genes(sister_features)
    matched_target: set[str] = set()
    matched_sister: set[str] = set()
    ambiguous_target: set[str] = set()
    ambiguous_sister: set[str] = set()
    rows: list[dict[str, Any]] = []

    for protein in sorted(set(target_proteins) & set(sister_proteins)):
        target_loci = target_proteins[protein]
        sister_loci = sister_proteins[protein]
        ambiguous = len(target_loci) != 1 or len(sister_loci) != 1
        matched_target.update(target_loci)
        matched_sister.update(sister_loci)
        if ambiguous:
            ambiguous_target.update(target_loci)
            ambiguous_sister.update(sister_loci)
        for target_locus in target_loci:
            target_gene = target_genes[target_locus]
            for sister_locus in sister_loci:
                sister_gene = sister_genes[sister_locus]
                common = {
                    "subject_locus_tag": target_locus,
                    "seqid": target_gene.seqid,
                    "start": target_gene.start,
                    "end": target_gene.end,
                    "strand": target_gene.strand,
                    "mapping_ambiguity": (
                        "shared-protein-many-to-many" if ambiguous else ""
                    ),
                    "source": f"UTEX 2973 and {strain['label']} RefSeq GFF3",
                    "evidence": protein,
                    "mapping_method": "exact shared RefSeq protein_id",
                }
                rows.append({
                    **common,
                    "relationship": f"{strain['slug']}_ortholog",
                    "object_namespace": (
                        f"{strain['namespace']}_RefSeq_locus_tag"
                    ),
                    "object_id": sister_locus,
                })
                for old_tag in filter(
                    None, sister_gene.attr_values.get("old_locus_tag", ())
                ):
                    rows.append({
                        **common,
                        "relationship": f"{strain['slug']}_old_locus_tag",
                        "object_namespace": (
                            f"{strain['namespace']}_legacy_locus_tag"
                        ),
                        "object_id": old_tag,
                    })

    target_loci = {locus for loci in target_proteins.values() for locus in loci}
    sister_loci = {locus for loci in sister_proteins.values() for locus in loci}
    current_relationship = f"{strain['slug']}_ortholog"
    current_rows = [row for row in rows if row["relationship"] == current_relationship]
    counts = {
        "utexProteinLociTotal": len(target_loci),
        "matchedUtexLoci": len(matched_target),
        "unmatchedUtexLoci": len(target_loci - matched_target),
        "ambiguousUtexLoci": len(ambiguous_target),
        "sisterProteinLociTotal": len(sister_loci),
        "matchedSisterLoci": len(matched_sister),
        "unmatchedSisterLoci": len(sister_loci - matched_sister),
        "ambiguousSisterLoci": len(ambiguous_sister),
        "currentRelationships": len(current_rows),
        "ambiguousCurrentRelationships": sum(
            bool(row["mapping_ambiguity"]) for row in current_rows
        ),
        "oldLocusTagRelationships": len(rows) - len(current_rows),
    }
    return rows, counts


def build(manifest: dict[str, Any], root: Path, output: Path) -> dict[str, dict[str, int]]:
    """Builds both strain crosswalks into one deterministic TSV."""
    entries = release.entries_by_role(manifest)
    target_features, _ = release.parse_gff(
        root / entries["utex2973-crosswalk-gff"]["localPath"]
    )
    all_rows: list[dict[str, Any]] = []
    counts: dict[str, dict[str, int]] = {}
    for strain in STRAINS:
        sister_features, _ = release.parse_gff(
            root / entries[strain["role"]]["localPath"]
        )
        rows, strain_counts = build_rows(target_features, sister_features, strain)
        all_rows.extend(rows)
        counts[strain["slug"]] = strain_counts

    unique_rows = {
        tuple(str(row[field]) for field in FIELDS): row for row in all_rows
    }
    if len(unique_rows) != len(all_rows):
        raise release.ReleaseError("duplicate sister-strain relationship row")
    all_rows.sort(key=lambda row: tuple(str(row[field]) for field in FIELDS))
    output.parent.mkdir(parents=True, exist_ok=True)
    release._write_tsv(output, FIELDS, all_rows)
    return counts


def check_generated(manifest: dict[str, Any], root: Path, tracked: Path) -> None:
    """Rebuilds the crosswalk and fails when the tracked TSV has drifted."""
    with tempfile.TemporaryDirectory(prefix="sister-strain-crosswalk-") as temporary:
        rebuilt = Path(temporary) / tracked.name
        build(manifest, root, rebuilt)
        if not tracked.is_file():
            raise release.ReleaseError(f"missing tracked artifact: {tracked}")
        if tracked.read_bytes() != rebuilt.read_bytes():
            raise release.ReleaseError(f"stale generated artifact: {tracked}")


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    result.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    mode = result.add_mutually_exclusive_group()
    mode.add_argument("--fetch", action="store_true", help="fetch pinned GFF inputs")
    mode.add_argument("--verify", action="store_true", help="verify pinned inputs")
    mode.add_argument("--check", action="store_true", help="fail if the TSV has drifted")
    return result


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        manifest = release.load_manifest(args.manifest)
        root = release.repository_root(args.manifest)
        output = args.output if args.output.is_absolute() else root / args.output
        if args.fetch:
            downloaded, reused = release.fetch_inputs(manifest, root)
            verify_release_metadata(manifest, root)
            print(f"downloaded={downloaded} reused={reused}")
        elif args.verify:
            release.verify_files(manifest, root)
            verify_release_metadata(manifest, root)
            print(f"verified {len(release.entries_by_role(manifest))} pinned inputs")
        elif args.check:
            release.verify_files(manifest, root)
            verify_release_metadata(manifest, root)
            check_generated(manifest, root, output)
            print("verified sister-strain-crosswalk-v1.tsv")
        else:
            release.verify_files(manifest, root)
            verify_release_metadata(manifest, root)
            print(json.dumps(build(manifest, root, output), sort_keys=True))
        return 0
    except (OSError, release.ReleaseError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
