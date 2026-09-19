#!/usr/bin/env python3
"""Reproduce and validate the release-pinned annotation layer.

The script intentionally uses only the Python standard library.  It is an
independent release gate: input identity comes from the checked-in manifest,
and generated crosswalk/evidence files are compared byte-for-byte in CI.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import os
import shutil
import sys
import tempfile
import urllib.parse
import urllib.request
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Iterator


EXPECTED_SHARED_PROTEINS = {
    "WP_011242480.1",
    "WP_011242807.1",
    "WP_011242808.1",
    "WP_011243185.1",
}
EXPECTED_DISCONTINUOUS_CDS = {
    "M744_RS00920",
    "M744_RS13290",
    "M744_RS13620",
}
NEARBY_NCRNA_MAX_DISTANCE = 250
OUTPUT_NAMES = (
    "identifier-crosswalk-v1.tsv",
    "annotation-evidence-v1.jsonl",
    "go-annotations-v1.tsv",
    "release-summary-v1.json",
)


class ReleaseError(ValueError):
    """Raised when a pinned input or generated release violates its contract."""


@dataclass(frozen=True)
class Feature:
    """A normalized GFF3 feature."""

    seqid: str
    source: str
    kind: str
    start: int
    end: int
    strand: str
    phase: str
    attrs: dict[str, str]
    attr_values: dict[str, tuple[str, ...]]


def open_text(path: Path) -> Any:
    """Opens plain text or gzip-compressed text by filename suffix."""
    if path.suffix == ".gz":
        return gzip.open(path, "rt", encoding="utf-8")
    return path.open(encoding="utf-8")


def file_md5(path: Path) -> str:
    """Returns an MD5 digest without loading the full file into memory."""
    digest = hashlib.md5()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_manifest(path: Path) -> dict[str, Any]:
    """Loads and structurally validates a release manifest."""
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ReleaseError(f"cannot read manifest {path}: {error}") from error
    if not isinstance(manifest, dict) or manifest.get("schemaVersion") != 1:
        raise ReleaseError("manifest schemaVersion must be 1")
    for field in ("releaseId", "retrievedDate", "sources"):
        if not manifest.get(field):
            raise ReleaseError(f"manifest is missing {field}")
    if not isinstance(manifest["sources"], list) or not manifest["sources"]:
        raise ReleaseError("manifest sources must be a non-empty array")

    seen_paths: set[str] = set()
    seen_roles: set[str] = set()
    for source in manifest["sources"]:
        required_source = (
            "id", "organism", "taxid", "assemblyAccession", "assemblyName",
            "annotationRelease", "annotationDate", "pgapVersion", "baseUrl", "files",
        )
        missing = [field for field in required_source if not source.get(field)]
        if missing:
            raise ReleaseError(f"source is missing fields: {', '.join(missing)}")
        if not isinstance(source["files"], list) or not source["files"]:
            raise ReleaseError(f"source {source['id']} has no files")
        base_url = source["baseUrl"].rstrip("/") + "/"
        for entry in source["files"]:
            required_file = (
                "role", "localPath", "directUrl", "byteSize", "md5",
                "retention", "redistribution",
            )
            missing = [field for field in required_file if entry.get(field) in (None, "")]
            if missing:
                raise ReleaseError(
                    f"file in {source['id']} is missing fields: {', '.join(missing)}"
                )
            if entry["localPath"] in seen_paths:
                raise ReleaseError(f"duplicate localPath: {entry['localPath']}")
            if entry["role"] in seen_roles:
                raise ReleaseError(f"duplicate role: {entry['role']}")
            seen_paths.add(entry["localPath"])
            seen_roles.add(entry["role"])
            if not entry["directUrl"].startswith(base_url):
                raise ReleaseError(
                    f"directUrl for {entry['role']} is outside pinned baseUrl"
                )
            if not isinstance(entry["byteSize"], int) or entry["byteSize"] <= 0:
                raise ReleaseError(f"invalid byteSize for {entry['role']}")
            md5 = entry["md5"]
            if not isinstance(md5, str) or len(md5) != 32 or any(
                char not in "0123456789abcdef" for char in md5
            ):
                raise ReleaseError(f"invalid lowercase MD5 for {entry['role']}")
    return manifest


def repository_root(manifest_path: Path) -> Path:
    """Returns the repository root for data/manifest/<manifest>.json."""
    resolved = manifest_path.resolve()
    if resolved.parent.name != "manifest" or resolved.parent.parent.name != "data":
        raise ReleaseError("manifest must live in <repository>/data/manifest")
    return resolved.parents[2]


def entries_by_role(manifest: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Indexes all manifest file records by their unique role."""
    return {
        entry["role"]: entry
        for source in manifest["sources"]
        for entry in source["files"]
    }


def verify_files(manifest: dict[str, Any], root: Path) -> None:
    """Checks byte sizes and MD5s for every pinned source input."""
    failures: list[str] = []
    for role, entry in entries_by_role(manifest).items():
        path = root / entry["localPath"]
        if not path.is_file():
            failures.append(f"{role}: missing {entry['localPath']}")
            continue
        actual_size = path.stat().st_size
        if actual_size != entry["byteSize"]:
            failures.append(
                f"{role}: byte size {actual_size} != {entry['byteSize']}"
            )
            continue
        actual_md5 = file_md5(path)
        if actual_md5 != entry["md5"]:
            failures.append(f"{role}: MD5 {actual_md5} != {entry['md5']}")
    if failures:
        raise ReleaseError("input verification failed:\n" + "\n".join(failures))


def _gff_headers(path: Path) -> dict[str, str]:
    headers: dict[str, str] = {}
    with open_text(path) as handle:
        for line in handle:
            if line.startswith("#!"):
                key, _, value = line[2:].strip().partition(" ")
                headers[key] = value
            elif not line.startswith("#"):
                break
    return headers


def _gaf_headers(path: Path) -> dict[str, str]:
    """Returns colon-delimited metadata from a Gene Association File header."""
    headers: dict[str, str] = {}
    with open_text(path) as handle:
        for line in handle:
            if not line.startswith("!"):
                break
            key, separator, value = line[1:].strip().partition(":")
            if separator:
                headers[key.strip()] = value.strip()
    return headers


def _read_role(manifest: dict[str, Any], root: Path, role: str) -> Path:
    try:
        return root / entries_by_role(manifest)[role]["localPath"]
    except KeyError as error:
        raise ReleaseError(f"manifest has no {role} input") from error


def verify_release_metadata(manifest: dict[str, Any], root: Path) -> None:
    """Checks release identity independently of file checksums."""
    target = next(
        (source for source in manifest["sources"] if source["id"] == "utex2973-refseq"),
        None,
    )
    if target is None:
        raise ReleaseError("manifest has no utex2973-refseq source")
    if (
        manifest["releaseId"] != "GCF_000817325.1-RS_2026_05_13"
        or target["annotationDate"] != "2026-05-13"
        or target["pgapVersion"] != "6.11"
    ):
        raise ReleaseError("UTEX release/date/PGAP pin differs from the validated contract")
    headers = _gff_headers(_read_role(manifest, root, "gff-annotation"))
    expected_date = target["annotationDate"].replace("-", "_")
    if headers.get("genome-build-accession") != (
        "NCBI_Assembly:" + target["assemblyAccession"]
    ):
        raise ReleaseError("UTEX GFF assembly accession does not match manifest")
    if headers.get("annotation-source") != (
        f"NCBI RefSeq {target['annotationRelease']}"
    ) or expected_date not in target["annotationRelease"]:
        raise ReleaseError("UTEX GFF annotation release does not match manifest")

    report = _read_role(manifest, root, "assembly-report").read_text(encoding="utf-8")
    for expected in (
        "# Organism name:  Synechococcus elongatus UTEX 2973",
        "# Taxid:          1350461",
        "# RefSeq assembly accession: GCF_000817325.1",
    ):
        if expected not in report:
            raise ReleaseError(f"assembly report lacks pinned identity: {expected}")

    stats = _read_role(manifest, root, "assembly-statistics").read_text(
        encoding="utf-8"
    )
    if "all\tall\tall\tall\ttotal-length\t2744626" not in stats:
        raise ReleaseError("assembly statistics do not report 2,744,626 bp")

    feature_counts = _read_role(manifest, root, "feature-counts").read_text(
        encoding="utf-8"
    )
    required_counts = (
        "gene\tprotein_coding\tGCF_000817325.1\tGCF_000817335.1\tPrimary Assembly\t2715\t2715",
        "gene\tpseudogene\tGCF_000817325.1\tGCF_000817335.1\tPrimary Assembly\t7\t7",
        "CDS\twith_protein\tGCF_000817325.1\tGCF_000817335.1\tPrimary Assembly\t2711\t2715",
    )
    for expected in required_counts:
        if expected not in feature_counts:
            raise ReleaseError(f"feature counts lack pinned row: {expected}")

    hashes = _read_role(manifest, root, "annotation-hashes").read_text(
        encoding="utf-8"
    )
    if not any(
        line.startswith("GCF_000817325.1\t") and "2026-05-14 17:31:00" in line
        for line in hashes.splitlines()
    ):
        raise ReleaseError("annotation hashes do not match the pinned release")

    go_headers = _gaf_headers(_read_role(manifest, root, "go-annotations"))
    if (
        go_headers.get("GO version") != target.get("goVersion")
        or go_headers.get("generated-by") != "NCBI"
        or go_headers.get("date-generated") != "2026-05-14"
    ):
        raise ReleaseError("GO version or RefSeq GAF provenance differs from manifest")

    pcc_source = next(
        source for source in manifest["sources"]
        if source["id"] == "pcc7942-refseq-crosswalk"
    )
    if (
        pcc_source["annotationDate"] != "2025-04-10"
        or pcc_source["pgapVersion"] != "6.10"
    ):
        raise ReleaseError("PCC release/date/PGAP pin differs from the validated contract")
    pcc_headers = _gff_headers(_read_role(manifest, root, "pcc7942-crosswalk-gff"))
    if pcc_headers.get("annotation-source") != (
        f"NCBI RefSeq {pcc_source['annotationRelease']}"
    ):
        raise ReleaseError("PCC 7942 GFF annotation release does not match manifest")


def fetch_inputs(
    manifest: dict[str, Any], root: Path, force: bool = False
) -> tuple[int, int]:
    """Fetches missing pinned inputs and verifies each download before install."""
    downloaded = 0
    reused = 0
    for entry in entries_by_role(manifest).values():
        destination = root / entry["localPath"]
        if not force and destination.is_file():
            if (
                destination.stat().st_size == entry["byteSize"]
                and file_md5(destination) == entry["md5"]
            ):
                reused += 1
                continue
        destination.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(
            dir=destination.parent, prefix=destination.name + ".", delete=False
        ) as handle:
            temporary = Path(handle.name)
        try:
            with urllib.request.urlopen(entry["directUrl"], timeout=600) as response:
                with temporary.open("wb") as handle:
                    shutil.copyfileobj(response, handle)
            if temporary.stat().st_size != entry["byteSize"]:
                raise ReleaseError(f"downloaded size mismatch for {entry['role']}")
            if file_md5(temporary) != entry["md5"]:
                raise ReleaseError(f"downloaded checksum mismatch for {entry['role']}")
            os.replace(temporary, destination)
            downloaded += 1
        finally:
            temporary.unlink(missing_ok=True)
    verify_files(manifest, root)
    return downloaded, reused


def parse_attribute_values(raw: str) -> dict[str, tuple[str, ...]]:
    """Parses GFF3 lists before decoding escaped commas inside their values."""
    attrs: dict[str, tuple[str, ...]] = {}
    for item in raw.split(";"):
        if not item:
            continue
        key, separator, value = item.partition("=")
        if not separator:
            raise ReleaseError(f"malformed GFF3 attribute: {item!r}")
        attrs[urllib.parse.unquote(key)] = tuple(
            urllib.parse.unquote(member) for member in value.split(",")
        )
    return attrs


def parse_attributes(raw: str) -> dict[str, str]:
    """Returns decoded attributes, retaining their conventional text form."""
    return {
        key: ",".join(values)
        for key, values in parse_attribute_values(raw).items()
    }


def parse_gff(path: Path) -> tuple[list[Feature], dict[str, int]]:
    """Parses features and sequence lengths from an NCBI GFF3 file."""
    features: list[Feature] = []
    lengths: dict[str, int] = {}
    with open_text(path) as handle:
        for line_number, line in enumerate(handle, 1):
            line = line.rstrip("\n")
            if line.startswith("##sequence-region "):
                parts = line.split()
                lengths[parts[1]] = int(parts[3])
                continue
            if not line or line.startswith("#"):
                continue
            fields = line.split("\t")
            if len(fields) != 9:
                raise ReleaseError(f"{path}:{line_number}: expected 9 GFF fields")
            attr_values = parse_attribute_values(fields[8])
            features.append(
                Feature(
                    seqid=fields[0], source=fields[1], kind=fields[2],
                    start=int(fields[3]), end=int(fields[4]), strand=fields[6],
                    phase=fields[7],
                    attrs={key: ",".join(values) for key, values in attr_values.items()},
                    attr_values=attr_values,
                )
            )
    if not lengths:
        raise ReleaseError(f"{path}: no sequence-region headers")
    return features, lengths


def normalized_segments(feature: Feature, length: int) -> list[tuple[int, int]]:
    """Splits NCBI's end-overflow notation for circular-origin features."""
    if feature.start < 1 or feature.end < feature.start:
        raise ReleaseError(f"invalid coordinates for {feature.attrs.get('locus_tag')}")
    if feature.end <= length:
        return [(feature.start, feature.end)]
    if feature.end - length > length:
        raise ReleaseError(f"feature spans more than one circular replicon")
    return [(feature.start, length), (1, feature.end - length)]


def _by_locus(features: Iterable[Feature], kind: str) -> dict[str, list[Feature]]:
    grouped: dict[str, list[Feature]] = defaultdict(list)
    for feature in features:
        if feature.kind == kind and feature.attrs.get("locus_tag"):
            grouped[feature.attrs["locus_tag"]].append(feature)
    return dict(grouped)


def _is_gene_feature(feature: Feature) -> bool:
    """Returns true for NCBI gene rows, including rows typed pseudogene."""
    return feature.kind in {"gene", "pseudogene"}


def _protein_loci(cds_by_locus: dict[str, list[Feature]]) -> dict[str, list[str]]:
    protein_loci: dict[str, set[str]] = defaultdict(set)
    for locus, features in cds_by_locus.items():
        for feature in features:
            protein = feature.attrs.get("protein_id")
            if protein:
                protein_loci[protein].add(locus)
    return {protein: sorted(loci) for protein, loci in protein_loci.items()}


def parse_gpff_name_evidence(path: Path) -> dict[str, list[dict[str, str]]]:
    """Extracts NCBI's structured protein-name evidence blocks."""
    evidence: dict[str, list[dict[str, str]]] = defaultdict(list)
    version: str | None = None
    current: dict[str, str] | None = None
    with open_text(path) as handle:
        for line in handle:
            if line.startswith("VERSION     "):
                version = line.split()[1]
            elif "##Evidence-For-Name-Assignment-START##" in line:
                current = {}
            elif "##Evidence-For-Name-Assignment-END##" in line:
                if version and current:
                    evidence[version].append(dict(sorted(current.items())))
                current = None
            elif current is not None and "::" in line:
                key, value = line.strip().split("::", 1)
                current[key.strip().replace(" ", "_").lower()] = value.strip()
            elif line.startswith("//"):
                version = None
                current = None
    return dict(evidence)


def _feature_segments(
    features: Iterable[Feature], lengths: dict[str, int]
) -> list[tuple[int, int]]:
    segments: set[tuple[int, int]] = set()
    for feature in features:
        segments.update(normalized_segments(feature, lengths[feature.seqid]))
    return sorted(segments)


def _overlapping_cds(
    cds_by_locus: dict[str, list[Feature]], lengths: dict[str, int]
) -> dict[str, list[dict[str, Any]]]:
    intervals_by_seqid: dict[str, list[tuple[int, int, str]]] = defaultdict(list)
    for locus, features in cds_by_locus.items():
        for feature in features:
            for start, end in normalized_segments(feature, lengths[feature.seqid]):
                intervals_by_seqid[feature.seqid].append((start, end, locus))
    pair_overlap: dict[tuple[str, str], int] = defaultdict(int)
    for intervals in intervals_by_seqid.values():
        intervals.sort()
        active: list[tuple[int, int, str]] = []
        for start, end, locus in intervals:
            active = [item for item in active if item[1] >= start]
            for other_start, other_end, other_locus in active:
                if other_locus == locus:
                    continue
                overlap = min(end, other_end) - max(start, other_start) + 1
                if overlap > 0:
                    pair = tuple(sorted((locus, other_locus)))
                    pair_overlap[pair] += overlap
            active.append((start, end, locus))
    result: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for (first, second), overlap in sorted(pair_overlap.items()):
        result[first].append({"locusTag": second, "overlapNt": overlap})
        result[second].append({"locusTag": first, "overlapNt": overlap})
    return dict(result)


def _linear_gap(first: tuple[int, int], second: tuple[int, int]) -> int:
    if first[1] >= second[0] and second[1] >= first[0]:
        return 0
    if first[1] < second[0]:
        return second[0] - first[1] - 1
    return first[0] - second[1] - 1


def _circular_distance(
    first: list[tuple[int, int]], second: list[tuple[int, int]], length: int
) -> int:
    distances: list[int] = []
    for left in first:
        for right in second:
            distances.append(_linear_gap(left, right))
            distances.append(_linear_gap(left, (right[0] - length, right[1] - length)))
            distances.append(_linear_gap(left, (right[0] + length, right[1] + length)))
    return min(distances)


def _nearby_ncrnas(
    genes: dict[str, Feature], lengths: dict[str, int]
) -> dict[str, list[dict[str, Any]]]:
    rnas = {
        locus: feature for locus, feature in genes.items()
        if feature.attrs.get("gene_biotype") not in {"protein_coding", "pseudogene"}
    }
    result: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for locus, gene in genes.items():
        gene_segments = normalized_segments(gene, lengths[gene.seqid])
        for rna_locus, rna in rnas.items():
            if rna_locus == locus or rna.seqid != gene.seqid:
                continue
            distance = _circular_distance(
                gene_segments,
                normalized_segments(rna, lengths[rna.seqid]),
                lengths[gene.seqid],
            )
            if distance <= NEARBY_NCRNA_MAX_DISTANCE:
                result[locus].append(
                    {
                        "locusTag": rna_locus,
                        "biotype": rna.attrs.get("gene_biotype"),
                        "distanceNt": distance,
                    }
                )
        result[locus].sort(key=lambda item: (item["distanceNt"], item["locusTag"]))
    return dict(result)


def _replicon_identity(region: Feature) -> tuple[str | None, str]:
    """Returns a non-contradictory replicon type and display name."""
    replicon_type = region.attrs.get("genome", "")
    plasmid_name = region.attrs.get("plasmid-name")
    if not replicon_type and plasmid_name:
        replicon_type = "plasmid"
    if plasmid_name:
        replicon_name = plasmid_name
    elif replicon_type == "chromosome":
        replicon_name = "chromosome"
    else:
        replicon_name = region.seqid
    return replicon_type or None, replicon_name


def _pcc_orthologs(
    target_proteins: dict[str, list[str]], pcc_features: list[Feature]
) -> list[tuple[str, str, str, bool]]:
    pcc_genes = {
        feature.attrs["locus_tag"]: feature
        for feature in pcc_features
        if _is_gene_feature(feature) and feature.attrs.get("locus_tag")
    }
    pcc_cds = _by_locus(pcc_features, "CDS")
    pcc_proteins = _protein_loci(pcc_cds)
    rows: list[tuple[str, str, str, bool]] = []
    for protein in sorted(set(target_proteins) & set(pcc_proteins)):
        target_loci = target_proteins[protein]
        pcc_loci = pcc_proteins[protein]
        ambiguous = len(target_loci) != 1 or len(pcc_loci) != 1
        for target_locus in target_loci:
            for pcc_locus in pcc_loci:
                rows.append((target_locus, pcc_locus, protein, ambiguous))
                old_tags = pcc_genes[pcc_locus].attr_values.get("old_locus_tag", ())
                for old_tag in filter(None, old_tags):
                    rows.append((target_locus, old_tag, protein, ambiguous))
    return rows


def _write_tsv(path: Path, fieldnames: list[str], rows: Iterable[dict[str, Any]]) -> int:
    count = 0
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle, fieldnames=fieldnames, delimiter="\t", lineterminator="\n"
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
            count += 1
    return count


def build_crosswalk(
    features: list[Feature], lengths: dict[str, int], pcc_features: list[Feature], path: Path
) -> tuple[int, dict[str, list[str]], set[str], dict[str, int]]:
    """Writes one row per identifier or location relationship."""
    genes = {
        feature.attrs["locus_tag"]: feature
        for feature in features
        if _is_gene_feature(feature) and feature.attrs.get("locus_tag")
    }
    cds_by_locus = _by_locus(features, "CDS")
    protein_loci = _protein_loci(cds_by_locus)
    shared = {protein for protein, loci in protein_loci.items() if len(loci) > 1}
    rows: list[dict[str, Any]] = []

    def add(
        locus: str, relation: str, namespace: str, identifier: str,
        source: str, method: str, ambiguity: str = "", evidence: str = "",
    ) -> None:
        gene = genes[locus]
        rows.append(
            {
                "subject_locus_tag": locus,
                "relationship": relation,
                "object_namespace": namespace,
                "object_id": identifier,
                "seqid": gene.seqid,
                "start": gene.start,
                "end": gene.end,
                "strand": gene.strand,
                "mapping_ambiguity": ambiguity,
                "source": source,
                "mapping_method": method,
                "evidence": evidence,
            }
        )

    for locus in sorted(genes):
        gene = genes[locus]
        add(locus, "current_locus_tag", "RefSeq_locus_tag", locus,
            "UTEX RefSeq GFF3", "direct annotation")
        for old_tag in filter(None, gene.attr_values.get("old_locus_tag", ())):
            add(locus, "old_locus_tag", "legacy_locus_tag", old_tag,
                "UTEX RefSeq GFF3", "direct old_locus_tag qualifier")
        symbol = gene.attrs.get("gene")
        if symbol:
            add(locus, "gene_symbol", "gene_symbol", symbol,
                "UTEX RefSeq GFF3", "direct gene qualifier")
        add(locus, "sequence_accession", "RefSeq_nucleotide", gene.seqid,
            "UTEX RefSeq GFF3", "direct seqid")
        location = f"{gene.seqid}:{gene.start}-{gene.end}:{gene.strand}"
        add(locus, "genomic_location", "RefSeq_location", location,
            "UTEX RefSeq GFF3", "direct GFF3 coordinates")
        for protein in sorted({
            feature.attrs["protein_id"] for feature in cds_by_locus.get(locus, [])
            if feature.attrs.get("protein_id")
        }):
            ambiguity = "one-protein-to-multiple-loci" if protein in shared else ""
            add(locus, "protein_id", "RefSeq_protein", protein,
                "UTEX RefSeq GFF3", "direct protein_id qualifier", ambiguity)
        for index, (start, end) in enumerate(
            _feature_segments(cds_by_locus.get(locus, []), lengths), 1
        ):
            add(
                locus, "cds_segment", "RefSeq_location",
                f"{gene.seqid}:{start}-{end}:{gene.strand}",
                "UTEX RefSeq GFF3", "normalized GFF3 CDS coordinates", "",
                f"segment {index}",
            )

    pcc_rows = _pcc_orthologs(protein_loci, pcc_features)
    pcc_genes = {
        feature.attrs["locus_tag"] for feature in pcc_features
        if _is_gene_feature(feature) and feature.attrs.get("locus_tag")
    }
    for locus, identifier, protein, ambiguous in pcc_rows:
        is_current = identifier in pcc_genes
        add(
            locus,
            "pcc7942_ortholog" if is_current else "pcc7942_old_locus_tag",
            "PCC7942_RefSeq_locus_tag" if is_current else "PCC7942_legacy_locus_tag",
            identifier,
            "PCC 7942 and UTEX RefSeq GFF3",
            "exact shared RefSeq protein_id",
            "shared-protein-many-to-many" if ambiguous else "",
            protein,
        )

    rows.sort(key=lambda row: (
        row["subject_locus_tag"], row["relationship"], row["object_namespace"],
        row["object_id"], row["evidence"],
    ))
    fields = [
        "subject_locus_tag", "relationship", "object_namespace", "object_id",
        "seqid", "start", "end", "strand", "mapping_ambiguity", "source",
        "evidence", "mapping_method",
    ]
    pcc_current = [row for row in rows if row["relationship"] == "pcc7942_ortholog"]
    coverage = {
        "pccCurrentRelationships": len(pcc_current),
        "pccMappedTargetLoci": len({row["subject_locus_tag"] for row in pcc_current}),
        "pccMappedSourceLoci": len({row["object_id"] for row in pcc_current}),
        "pccAmbiguousCurrentRelationships": sum(
            bool(row["mapping_ambiguity"]) for row in pcc_current
        ),
        "pccLegacyRelationships": sum(
            row["relationship"] == "pcc7942_old_locus_tag" for row in rows
        ),
    }
    return _write_tsv(path, fields, rows), protein_loci, shared, coverage


def build_annotation_evidence(
    features: list[Feature], lengths: dict[str, int], gpff_path: Path, path: Path
) -> dict[str, int]:
    """Writes structured recoding-risk evidence without inferred certainty."""
    genes = {
        feature.attrs["locus_tag"]: feature
        for feature in features
        if _is_gene_feature(feature) and feature.attrs.get("locus_tag")
    }
    regions = {
        feature.seqid: feature for feature in features if feature.kind == "region"
    }
    cds_by_locus = _by_locus(features, "CDS")
    overlaps = _overlapping_cds(cds_by_locus, lengths)
    nearby = _nearby_ncrnas(genes, lengths)
    name_evidence = parse_gpff_name_evidence(gpff_path)
    pseudo_count = 0
    exception_count = 0
    partial_count = 0
    gpff_evidence_count = 0
    with path.open("w", encoding="utf-8") as handle:
        for locus in sorted(genes):
            gene = genes[locus]
            cds = cds_by_locus.get(locus, [])
            proteins = sorted({
                feature.attrs["protein_id"] for feature in cds
                if feature.attrs.get("protein_id")
            })
            exceptions = sorted({
                feature.attrs["exception"] for feature in cds
                if feature.attrs.get("exception")
            })
            inferences = sorted({
                feature.attrs["inference"] for feature in cds
                if feature.attrs.get("inference")
            })
            notes = sorted({
                feature.attrs["Note"] for feature in cds if feature.attrs.get("Note")
            })
            partial = any(
                feature.attrs.get("partial") == "true"
                or "start_range" in feature.attrs or "end_range" in feature.attrs
                for feature in [gene, *cds]
            )
            pseudogene = (
                gene.attrs.get("gene_biotype") == "pseudogene"
                or gene.attrs.get("pseudo") == "true"
                or any(feature.attrs.get("pseudo") == "true" for feature in cds)
            )
            pseudo_count += int(pseudogene)
            exception_count += int(bool(exceptions))
            partial_count += int(partial)
            gpff_evidence_count += int(any(name_evidence.get(protein) for protein in proteins))
            region = regions[gene.seqid]
            replicon_type, replicon_name = _replicon_identity(region)
            record = {
                "schemaVersion": 1,
                "releaseId": "GCF_000817325.1-RS_2026_05_13",
                "locusTag": locus,
                "geneBiotype": gene.attrs.get("gene_biotype"),
                "seqid": gene.seqid,
                "start": gene.start,
                "end": gene.end,
                "strand": gene.strand,
                "repliconType": replicon_type,
                "repliconName": replicon_name,
                "pseudogene": pseudogene,
                "partial": partial,
                "cdsSegments": [list(segment) for segment in _feature_segments(cds, lengths)],
                "translationalExceptions": exceptions,
                "notes": notes,
                "overlappingCds": overlaps.get(locus, []),
                "nearbyNoncodingRnas": nearby.get(locus, []),
                "annotationMethods": sorted({feature.source for feature in cds}),
                "inferences": inferences,
                "confidence": None,
                "confidenceNote": (
                    "No numeric confidence is present in the pinned NCBI release; "
                    "raw method and inference evidence are preserved."
                ),
                "proteinNameEvidence": [
                    {"proteinId": protein, "evidence": name_evidence.get(protein, [])}
                    for protein in proteins
                ],
            }
            handle.write(json.dumps(record, sort_keys=True, separators=(",", ":")))
            handle.write("\n")
    return {
        "annotationEvidenceRecords": len(genes),
        "pseudogenes": pseudo_count,
        "partialLoci": partial_count,
        "translationalExceptionLoci": exception_count,
        "overlappingCdsPairs": sum(len(items) for items in overlaps.values()) // 2,
        "lociWithOverlappingCds": len(overlaps),
        "nearbyNoncodingRnaRelationships": sum(len(items) for items in nearby.values()),
        "lociWithNearbyNoncodingRna": sum(bool(items) for items in nearby.values()),
        "proteinNameEvidenceLoci": gpff_evidence_count,
    }


def build_go_annotations(
    gaf_path: Path, protein_loci: dict[str, list[str]], path: Path
) -> dict[str, int]:
    """Writes evidence-coded GO relationships mapped through RefSeq proteins."""
    rows: list[dict[str, Any]] = []
    unmatched_proteins: set[str] = set()
    source_records = 0
    with open_text(gaf_path) as handle:
        for line_number, line in enumerate(handle, 1):
            if not line.strip() or line.startswith("!"):
                continue
            fields = line.rstrip("\n").split("\t")
            if len(fields) != 17:
                raise ReleaseError(f"GAF line {line_number}: expected 17 columns")
            source_records += 1
            protein = fields[1]
            loci = protein_loci.get(protein, [])
            if not loci:
                unmatched_proteins.add(protein)
                continue
            for locus in loci:
                rows.append(
                    {
                        "locus_tag": locus,
                        "protein_id": protein,
                        "go_id": fields[4],
                        "qualifier": fields[3],
                        "aspect": fields[8],
                        "evidence_code": fields[6],
                        "reference": fields[5],
                        "with_from": fields[7],
                        "assigned_by": fields[14],
                        "annotation_date": fields[13],
                        "source_taxon": fields[12],
                        "mapping_method": "exact RefSeq protein_id",
                        "mapping_ambiguity": (
                            "one-protein-to-multiple-loci" if len(loci) > 1 else ""
                        ),
                    }
                )
    rows.sort(key=lambda row: (
        row["locus_tag"], row["go_id"], row["qualifier"], row["protein_id"],
    ))
    fields = [
        "locus_tag", "protein_id", "go_id", "qualifier", "aspect",
        "evidence_code", "reference", "with_from", "assigned_by",
        "annotation_date", "source_taxon", "mapping_ambiguity", "mapping_method",
    ]
    written = _write_tsv(path, fields, rows)
    return {
        "goMappedRelationships": written,
        "goSourceRecords": source_records,
        "goUnmatchedProteinIds": len(unmatched_proteins),
        "goMappedLoci": len({row["locus_tag"] for row in rows}),
        "goUniqueTerms": len({row["go_id"] for row in rows}),
        "goAmbiguousRelationships": sum(bool(row["mapping_ambiguity"]) for row in rows),
    }


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_release(manifest: dict[str, Any], root: Path, output_dir: Path) -> dict[str, Any]:
    """Generates the crosswalk, annotation evidence, GO table, and summary."""
    verify_files(manifest, root)
    verify_release_metadata(manifest, root)
    output_dir.mkdir(parents=True, exist_ok=True)
    target_features, lengths = parse_gff(_read_role(manifest, root, "gff-annotation"))
    pcc_features, _ = parse_gff(_read_role(manifest, root, "pcc7942-crosswalk-gff"))

    crosswalk_count, protein_loci, shared, crosswalk_coverage = build_crosswalk(
        target_features, lengths, pcc_features,
        output_dir / "identifier-crosswalk-v1.tsv",
    )
    if shared != EXPECTED_SHARED_PROTEINS:
        raise ReleaseError(
            f"shared proteins changed: {sorted(shared)} != {sorted(EXPECTED_SHARED_PROTEINS)}"
        )
    evidence_counts = build_annotation_evidence(
        target_features, lengths, _read_role(manifest, root, "protein-genpept"),
        output_dir / "annotation-evidence-v1.jsonl",
    )
    go_counts = build_go_annotations(
        _read_role(manifest, root, "go-annotations"), protein_loci,
        output_dir / "go-annotations-v1.tsv",
    )
    cds_by_locus = _by_locus(target_features, "CDS")
    discontinuous = {
        locus for locus, features in cds_by_locus.items()
        if len(_feature_segments(features, lengths)) > 1
    }
    if discontinuous != EXPECTED_DISCONTINUOUS_CDS:
        raise ReleaseError(
            f"discontinuous CDS set changed: {sorted(discontinuous)}"
        )
    if (
        evidence_counts["annotationEvidenceRecords"] != 2776
        or evidence_counts["pseudogenes"] != 7
    ):
        raise ReleaseError(
            "gene reconciliation changed: "
            f"genes={evidence_counts['annotationEvidenceRecords']}, "
            f"pseudogenes={evidence_counts['pseudogenes']}"
        )

    summary = {
        "schemaVersion": 1,
        "releaseId": manifest["releaseId"],
        "manifest": "data/manifest/annotation-release-v1.json",
        "counts": {
            "crosswalkRelationships": crosswalk_count,
            "discontinuousCdsLoci": len(discontinuous),
            "sharedProteinIds": len(shared),
            **crosswalk_coverage,
            **evidence_counts,
            **go_counts,
        },
        "discontinuousCdsLoci": sorted(discontinuous),
        "sharedProteinIds": sorted(shared),
        "nearbyNoncodingRnaMaxDistanceNt": NEARBY_NCRNA_MAX_DISTANCE,
        "generatedFiles": {},
    }
    for name in OUTPUT_NAMES[:-1]:
        artifact = output_dir / name
        summary["generatedFiles"][name] = {
            "byteSize": artifact.stat().st_size,
            "sha256": _sha256(artifact),
        }
    summary_path = output_dir / "release-summary-v1.json"
    summary_path.write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return summary


def check_generated(manifest: dict[str, Any], root: Path, tracked: Path) -> None:
    """Rebuilds into a temporary directory and compares tracked bytes."""
    with tempfile.TemporaryDirectory(prefix="annotation-release-") as temporary:
        rebuilt = Path(temporary)
        build_release(manifest, root, rebuilt)
        failures = []
        for name in OUTPUT_NAMES:
            expected = tracked / name
            actual = rebuilt / name
            if not expected.is_file():
                failures.append(f"missing tracked artifact: {expected}")
            elif expected.read_bytes() != actual.read_bytes():
                failures.append(f"stale generated artifact: {expected}")
        if failures:
            raise ReleaseError("generated release check failed:\n" + "\n".join(failures))


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument(
        "--manifest", type=Path,
        default=Path("data/manifest/annotation-release-v1.json"),
    )
    subparsers = result.add_subparsers(dest="command", required=True)
    fetch = subparsers.add_parser("fetch", help="fetch all pinned source inputs")
    fetch.add_argument("--force", action="store_true")
    subparsers.add_parser("verify", help="verify checksums and release identity")
    build = subparsers.add_parser("build", help="regenerate release artifacts")
    build.add_argument(
        "--output-dir", type=Path,
        default=Path("data/annotation/releases/GCF_000817325.1-RS_2026_05_13"),
    )
    check = subparsers.add_parser("check", help="verify tracked generated artifacts")
    check.add_argument(
        "--tracked-dir", type=Path,
        default=Path("data/annotation/releases/GCF_000817325.1-RS_2026_05_13"),
    )
    return result


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        manifest = load_manifest(args.manifest)
        root = repository_root(args.manifest)
        if args.command == "fetch":
            downloaded, reused = fetch_inputs(manifest, root, args.force)
            print(f"downloaded={downloaded} reused={reused}")
        elif args.command == "verify":
            verify_files(manifest, root)
            verify_release_metadata(manifest, root)
            print(f"verified {len(entries_by_role(manifest))} pinned inputs")
        elif args.command == "build":
            summary = build_release(manifest, root, args.output_dir)
            print(json.dumps(summary["counts"], sort_keys=True))
        elif args.command == "check":
            check_generated(manifest, root, args.tracked_dir)
            print(f"verified {len(OUTPUT_NAMES)} generated artifacts")
        return 0
    except (OSError, ReleaseError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
