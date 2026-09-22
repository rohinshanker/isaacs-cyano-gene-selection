#!/usr/bin/env python3
"""Build the release-pinned CDS-to-protein identity evidence audit.

The audit deliberately separates an exact RefSeq protein record, presence in a
historical proteomics search database, an accepted experimental detection, and
variant-level experimental evidence.  Product names are never join keys.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import re
import sys
import tempfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Iterable, Iterator, TextIO
from urllib.parse import unquote


OUTPUT_NAMES = ("protein-identity-v1.tsv", "protein-evidence-summary-v1.json")
PASS_OUTPUT_NAMES = ("pass00399-local-observations-v1.tsv", "pass00399-local-observations-v1.json")
REFSEQ_ROLES = {
    "refseq-cds-nucleotide", "refseq-translated-cds", "refseq-protein-fasta",
    "refseq-genomic-gff",
}
PASS_ROLES = {
    "pass00399-search-fasta", "pass00399-description", "pass00399-job-metadata",
    "pass00399-sample-metadata",
}
PINNED_RELEASE = "GCF_000817325.1-RS_2026_05_13-protein-evidence-v1"
SHARED_PROTEIN_IDS = {
    "WP_011242480.1",
    "WP_011242807.1",
    "WP_011242808.1",
    "WP_011243185.1",
}
INSPECTED_LOCI = {
    "kaiA": "M744_RS10050",
    "kaiB": "M744_RS10055",
    "kaiC": "M744_RS10060",
    "prfB": "M744_RS00920",
}
BASES = "TCAG"
CODONS = tuple(a + b + c for a in BASES for b in BASES for c in BASES)
AMINO_ACIDS = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"
AA_BY_CODON = dict(zip(CODONS, AMINO_ACIDS))
START_CODONS = frozenset({"ATG", "GTG", "TTG", "ATC", "CTG", "ATT", "ATA"})
HEADER_VALUE = re.compile(r"\[([^=\]]+)=([^\]]+)\]")


class EvidenceError(ValueError):
    """Raised when a source or generated artifact violates the audit contract."""


def sha256_file(path: Path) -> str:
    """Returns a SHA-256 digest without loading the file into memory."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_manifest(path: Path) -> dict:
    """Loads and validates the protein-evidence source manifest."""
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise EvidenceError(f"cannot read manifest {path}: {error}") from error
    required = ("schemaVersion", "releaseId", "annotationRelease", "sources")
    missing = [field for field in required if field not in manifest]
    if missing:
        raise EvidenceError(f"manifest is missing: {', '.join(missing)}")
    if manifest["schemaVersion"] != 1:
        raise EvidenceError("manifest schemaVersion must be 1")
    if not isinstance(manifest["sources"], list) or not manifest["sources"]:
        raise EvidenceError("manifest sources must be a non-empty array")
    seen_paths: set[str] = set()
    for source in manifest["sources"]:
        for entry in source.get("files", []):
            for field in ("role", "localPath", "byteSize", "sha256"):
                if entry.get(field) in (None, ""):
                    raise EvidenceError(f"source file is missing {field}")
            if entry["localPath"] in seen_paths:
                raise EvidenceError(f"duplicate localPath: {entry['localPath']}")
            seen_paths.add(entry["localPath"])
            digest = entry["sha256"]
            if not re.fullmatch(r"[0-9a-f]{64}", digest):
                raise EvidenceError(f"invalid SHA-256 for {entry['role']}")
    return manifest


def repository_root(manifest_path: Path) -> Path:
    """Returns the repository root for a data/manifest manifest."""
    resolved = manifest_path.resolve()
    if resolved.parent.name != "manifest" or resolved.parent.parent.name != "data":
        raise EvidenceError("manifest must live in <repository>/data/manifest")
    return resolved.parents[2]


def entries_by_role(manifest: dict) -> dict[str, dict]:
    """Indexes source-file records by role."""
    entries: dict[str, dict] = {}
    for source in manifest["sources"]:
        for entry in source.get("files", []):
            role = entry["role"]
            if role in entries:
                raise EvidenceError(f"duplicate source role: {role}")
            entries[role] = entry
    return entries


def verify_local_copies(manifest: dict, root: Path, roles: set[str] | None = None) -> None:
    """Checks local bytes against recorded audit digests.

    A matching digest detects local drift.  It does not elevate a checksum that
    was computed after an unverified transport into proof of source authenticity.
    """
    entries = entries_by_role(manifest)
    selected = set(entries) if roles is None else roles
    missing_roles = selected - entries.keys()
    if missing_roles:
        raise EvidenceError("manifest lacks roles: " + ", ".join(sorted(missing_roles)))
    failures: list[str] = []
    for role in sorted(selected):
        entry = entries[role]
        path = root / entry["localPath"]
        if not path.is_file():
            failures.append(f"{role}: missing {entry['localPath']}")
            continue
        if path.stat().st_size != entry["byteSize"]:
            failures.append(
                f"{role}: byte size {path.stat().st_size} != {entry['byteSize']}"
            )
            continue
        digest = sha256_file(path)
        if digest != entry["sha256"]:
            failures.append(f"{role}: SHA-256 {digest} != {entry['sha256']}")
    if failures:
        raise EvidenceError("local-copy verification failed:\n" + "\n".join(failures))


def open_text(path: Path) -> TextIO:
    """Opens plain or gzip-compressed UTF-8 text."""
    if path.suffix == ".gz":
        return gzip.open(path, "rt", encoding="utf-8")
    return path.open(encoding="utf-8")


def read_fasta(path: Path) -> Iterator[tuple[str, str]]:
    """Yields FASTA headers and uppercase sequences."""
    try:
        with open_text(path) as handle:
            header: str | None = None
            sequence: list[str] = []
            for line_number, raw_line in enumerate(handle, 1):
                line = raw_line.strip()
                if not line:
                    continue
                if line.startswith(">"):
                    if header is not None:
                        yield header, "".join(sequence)
                    header = line[1:]
                    sequence = []
                elif header is None:
                    raise EvidenceError(f"{path}:{line_number}: sequence before header")
                else:
                    sequence.append(line.upper())
            if header is not None:
                yield header, "".join(sequence)
    except OSError as error:
        raise EvidenceError(f"cannot read FASTA {path}: {error}") from error


def header_attributes(header: str) -> dict[str, str]:
    """Returns bracketed NCBI FASTA header attributes."""
    return dict(HEADER_VALUE.findall(header))


def old_locus_tags(gff_path: Path) -> dict[str, str]:
    """Returns pinned old-locus-tag relationships from GFF gene features."""
    result: dict[str, str] = {}
    try:
        with open_text(gff_path) as handle:
            for line in handle:
                if line.startswith("#"):
                    continue
                fields = line.rstrip("\n").split("\t")
                if len(fields) != 9 or fields[2] != "gene":
                    continue
                attributes = dict(
                    (key, unquote(value))
                    for field in fields[8].split(";") if "=" in field
                    for key, value in [field.split("=", 1)]
                )
                locus = attributes.get("locus_tag")
                old = attributes.get("old_locus_tag")
                if locus and old:
                    if locus in result:
                        raise EvidenceError(f"duplicate GFF gene locus {locus}")
                    result[locus] = old
    except OSError as error:
        raise EvidenceError(f"cannot read genomic GFF {gff_path}: {error}") from error
    return result


def load_genes(path: Path) -> dict[str, dict]:
    """Loads unique site loci with useful errors for malformed inputs."""
    try:
        genes = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise EvidenceError(f"cannot read site genes {path}: {error}") from error
    if not isinstance(genes, list) or not genes:
        raise EvidenceError("site/data/genes.json must be a non-empty array")
    result: dict[str, dict] = {}
    for index, gene in enumerate(genes):
        if not isinstance(gene, dict) or not isinstance(gene.get("id"), str) or not gene["id"]:
            raise EvidenceError(f"site gene {index} lacks a locus id")
        if gene["id"] in result:
            raise EvidenceError(f"duplicate site gene locus {gene['id']}")
        result[gene["id"]] = gene
    return result


def translate_cds(sequence: str) -> str:
    """Translates a complete bacterial CDS, honoring alternative starts.

    The source CDS FASTA already contains joined sequence in coding order.  A
    programmed frameshift is therefore represented by the annotated splice,
    not by changing the genetic code here.
    """
    if len(sequence) % 3:
        raise EvidenceError("CDS length is not divisible by three")
    codons = [sequence[index : index + 3] for index in range(0, len(sequence), 3)]
    if not codons or codons[-1] not in {"TAA", "TAG", "TGA"}:
        raise EvidenceError("CDS lacks one terminal stop")
    if codons[0] not in START_CODONS:
        raise EvidenceError(f"CDS has invalid table-11 start codon {codons[0]}")
    try:
        amino_acids = [AA_BY_CODON[codon] for codon in codons[:-1]]
    except KeyError as error:
        raise EvidenceError(f"CDS contains unsupported codon {error.args[0]}") from error
    if "*" in amino_acids:
        raise EvidenceError("CDS contains an internal stop")
    if amino_acids:
        amino_acids[0] = "M"
    return "".join(amino_acids)


def _fasta_by_locus(path: Path, allowed_loci: set[str]) -> dict[str, tuple[dict, str]]:
    records: dict[str, tuple[dict, str]] = {}
    for header, sequence in read_fasta(path):
        attrs = header_attributes(header)
        locus = attrs.get("locus_tag")
        if locus not in allowed_loci:
            continue
        if locus in records:
            raise EvidenceError(f"duplicate FASTA record for {locus}")
        records[locus] = (attrs, sequence)
    missing = sorted(allowed_loci - records.keys())
    if missing:
        raise EvidenceError("FASTA missing included loci: " + ", ".join(missing[:10]))
    return records


def _refseq_proteins(path: Path) -> dict[str, str]:
    records: dict[str, str] = {}
    for header, sequence in read_fasta(path):
        protein_id = header.split(maxsplit=1)[0]
        if protein_id in records:
            raise EvidenceError(f"duplicate RefSeq protein record {protein_id}")
        records[protein_id] = sequence
    return records


def _pass_sequences(path: Path) -> tuple[dict[str, list[str]], int, int]:
    sequences: dict[str, list[str]] = defaultdict(list)
    target_count = 0
    contaminant_count = 0
    for header, sequence in read_fasta(path):
        if header.startswith("gnl|PRJNA209528|"):
            target_count += 1
            sequences[sequence].append(header.split(maxsplit=1)[0])
        else:
            contaminant_count += 1
    return sequences, target_count, contaminant_count


def _tested_variants(manifest: dict, old_tags: dict[str, str]) -> dict[str, dict]:
    source = next(
        (item for item in manifest["sources"] if item["id"] == "ungerer-2018"),
        None,
    )
    if source is None:
        raise EvidenceError("manifest lacks ungerer-2018 source")
    variants = source.get("testedVariants", [])
    if not isinstance(variants, list):
        raise EvidenceError("Ungerer testedVariants must be an array")
    condition = source.get("condition")
    if not condition:
        raise EvidenceError("Ungerer source lacks experimental condition")
    result: dict[str, dict] = {}
    for index, item in enumerate(variants):
        if not isinstance(item, dict) or any(
            not isinstance(item.get(field), str) or not item[field]
            for field in ("currentLocusTag", "oldLocusTag", "proteinId", "evidenceId")
        ):
            raise EvidenceError(f"Ungerer tested variant {index} lacks a required field")
        locus = item["currentLocusTag"]
        if locus in result:
            raise EvidenceError(f"duplicate Ungerer tested-variant locus {locus}")
        if old_tags.get(locus) != item["oldLocusTag"]:
            raise EvidenceError(f"Ungerer old locus tag disagrees with pinned GFF for {locus}")
        result[locus] = {**item, "condition": condition}
    return result


def _write_tsv(path: Path, rows: Iterable[dict]) -> None:
    rows = list(rows)
    if not rows:
        raise EvidenceError("cannot write an empty identity audit")
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle, fieldnames=list(rows[0]), delimiter="\t", lineterminator="\n"
        )
        writer.writeheader()
        writer.writerows(rows)


def build(manifest: dict, root: Path, output_dir: Path) -> dict:
    """Builds admitted RefSeq and tested-variant evidence only."""
    entries = entries_by_role(manifest)
    missing_roles = sorted(REFSEQ_ROLES - entries.keys())
    if missing_roles:
        raise EvidenceError("manifest lacks roles: " + ", ".join(missing_roles))
    gene_by_locus = load_genes(root / "site/data/genes.json")
    loci = set(gene_by_locus)
    nucleotide = _fasta_by_locus(root / entries["refseq-cds-nucleotide"]["localPath"], loci)
    translated = _fasta_by_locus(root / entries["refseq-translated-cds"]["localPath"], loci)
    proteins = _refseq_proteins(root / entries["refseq-protein-fasta"]["localPath"])
    old_tags = old_locus_tags(root / entries["refseq-genomic-gff"]["localPath"])
    tested_variants = _tested_variants(manifest, old_tags)
    if not tested_variants.keys() <= loci:
        raise EvidenceError("Ungerer tested variant is absent from site genes")

    protein_counts: Counter[str] = Counter()
    for attrs, _ in translated.values():
        protein_id = attrs.get("protein_id")
        if not protein_id:
            raise EvidenceError(f"translated CDS lacks protein_id: {attrs}")
        protein_counts[protein_id] += 1

    rows: list[dict] = []
    for locus in sorted(loci):
        nucleotide_attrs, nucleotide_sequence = nucleotide[locus]
        translated_attrs, translated_sequence = translated[locus]
        if nucleotide_attrs.get("protein_id") != translated_attrs.get("protein_id"):
            raise EvidenceError(f"nucleotide/translated protein_id differs for {locus}")
        protein_id = translated_attrs["protein_id"]
        refseq_sequence = proteins.get(protein_id)
        if refseq_sequence is None:
            raise EvidenceError(f"no RefSeq protein record for {locus} / {protein_id}")
        computed_translation = translate_cds(nucleotide_sequence)
        if computed_translation != translated_sequence:
            raise EvidenceError(f"computed translation differs for {locus}")
        if translated_sequence != refseq_sequence:
            raise EvidenceError(f"translated CDS differs from protein FASTA for {locus}")
        locus_count = protein_counts[protein_id]
        variant = tested_variants.get(locus)
        if variant and variant["proteinId"] != protein_id:
            raise EvidenceError(f"Ungerer protein ID disagrees with RefSeq for {locus}")
        rows.append({
            "locus_tag": locus,
            "gene_symbol": gene_by_locus[locus].get("name") or "",
            "protein_id": protein_id,
            "protein_id_locus_count": locus_count,
            "refseq_protein_record": "present",
            "computed_cds_translation": "exact",
            "refseq_protein_sequence": "exact",
            "protein_length_aa": len(translated_sequence),
            "protein_sequence_sha256": hashlib.sha256(
                translated_sequence.encode("ascii")
            ).hexdigest(),
            "identity_ambiguity": "shared_protein_id" if locus_count > 1 else "none",
            # The deposit has no accepted identification table matching the paper's
            # MSGF+ / ~0.1% unique-peptide FDR method.  Unknown is not negative.
            "experimentally_detected": "unknown",
            "characterized_homolog": "unknown",
            "tested_variant_evidence": variant["evidenceId"] if variant else "unknown",
            "tested_variant_growth_condition": variant["condition"] if variant else "unknown",
        })

    output_dir.mkdir(parents=True, exist_ok=True)
    _write_tsv(output_dir / OUTPUT_NAMES[0], rows)
    ambiguous_rows = [row for row in rows if row["identity_ambiguity"] != "none"]
    summary = {
        "schemaVersion": 1,
        "releaseId": manifest["releaseId"],
        "annotationRelease": manifest["annotationRelease"],
        "method": {
            "identityJoin": "exact locus_tag -> protein_id plus exact amino-acid sequence",
            "translation": (
                "NCBI spliced CDS FASTA; bacterial table 11; alternative starts are methionine; "
                "one terminal stop removed"
            ),
            "detectionAdmission": "unknown: no accepted MSGF+ peptide/protein result table is deposited",
            "homologAdmission": "unknown unless a sequence/accession-backed characterized source is admitted",
            "testedVariantCondition": "growth phenotype only; biochemical assays have separate in-vitro conditions",
        },
        "counts": {
            "siteLoci": len(rows),
            "refseqMatchedLoci": len(rows),
            "refseqUnmatchedLoci": 0,
            "refseqAmbiguousLoci": len(ambiguous_rows),
            "uniqueRefseqProteinIds": len(protein_counts),
            "sharedRefseqProteinIds": sum(count > 1 for count in protein_counts.values()),
            "pass00399AdmittedSearchEvidenceLoci": 0,
            "experimentallyDetectedKnownLoci": 0,
            "experimentallyDetectedUnknownLoci": len(rows),
            "characterizedHomologKnownLoci": 0,
            "characterizedHomologUnknownLoci": len(rows),
            "testedVariantEvidenceLoci": len(tested_variants),
        },
        "sharedProteinIds": {
            protein_id: [row["locus_tag"] for row in rows if row["protein_id"] == protein_id]
            for protein_id, count in sorted(protein_counts.items()) if count > 1
        },
        "inspected": {
            label: next(row for row in rows if row["locus_tag"] == locus)
            for label, locus in INSPECTED_LOCI.items() if locus in loci
        },
        "localFileDigests": {
            role: entries[role]["sha256"] for role in sorted(REFSEQ_ROLES)
        },
    }
    if manifest["releaseId"] == PINNED_RELEASE and (
        len(rows) != 2715 or set(summary["inspected"]) != set(INSPECTED_LOCI)
    ):
        raise EvidenceError("pinned release is missing expected site loci")
    if manifest["releaseId"] == PINNED_RELEASE and (
        set(summary["sharedProteinIds"]) != SHARED_PROTEIN_IDS or any(
        len(locus_list) != 2 for locus_list in summary["sharedProteinIds"].values()
        )
    ):
        raise EvidenceError("the four expected shared protein IDs are not two-locus mappings")
    (output_dir / OUTPUT_NAMES[1]).write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return summary


def check(manifest: dict, root: Path, artifact_dir: Path) -> None:
    """Rebuilds in a temporary directory and compares tracked artifacts."""
    with tempfile.TemporaryDirectory() as directory:
        generated = Path(directory)
        build(manifest, root, generated)
        failures = []
        for name in OUTPUT_NAMES:
            expected = artifact_dir / name
            actual = generated / name
            if not expected.is_file():
                failures.append(f"missing tracked artifact {expected}")
            elif expected.read_bytes() != actual.read_bytes():
                failures.append(f"tracked artifact differs: {name}")
        if failures:
            raise EvidenceError("artifact check failed:\n" + "\n".join(failures))


def observe_pass(manifest: dict, root: Path, artifact_dir: Path) -> dict:
    """Writes unadmitted search-FASTA observations to separate local artifacts."""
    entries = entries_by_role(manifest)
    missing_roles = PASS_ROLES - entries.keys()
    if missing_roles:
        raise EvidenceError("manifest lacks roles: " + ", ".join(sorted(missing_roles)))
    pass_sequences, target_count, contaminant_count = _pass_sequences(
        root / entries["pass00399-search-fasta"]["localPath"]
    )
    pass_by_hash = {
        hashlib.sha256(sequence.encode("ascii")).hexdigest(): sorted(ids)
        for sequence, ids in pass_sequences.items()
    }
    identity_path = artifact_dir / OUTPUT_NAMES[0]
    try:
        with identity_path.open(encoding="utf-8", newline="") as handle:
            identity_rows = list(csv.DictReader(handle, delimiter="\t"))
    except OSError as error:
        raise EvidenceError(f"cannot read admitted identity artifact {identity_path}: {error}") from error
    observations = []
    for row in identity_rows:
        ids = pass_by_hash.get(row["protein_sequence_sha256"], [])
        status = "absent"
        if ids:
            status = (
                "exact_sequence_shared"
                if len(ids) > 1 or int(row["protein_id_locus_count"]) > 1
                else "exact_sequence_unique"
            )
        observations.append({
            "locus_tag": row["locus_tag"],
            "pass00399_search_observation": status,
            "pass00399_search_ids": ";".join(ids),
            "source_integrity": "unverified_transport",
            "admitted_evidence": "no",
        })
    artifact_dir.mkdir(parents=True, exist_ok=True)
    _write_tsv(artifact_dir / PASS_OUTPUT_NAMES[0], observations)
    summary = {
        "schemaVersion": 1,
        "releaseId": manifest["releaseId"],
        "integrity": "unverified transport; locally computed digests detect drift only",
        "admission": "local search database observation only; no protein detection admitted",
        "counts": {
            "targetSearchRecords": target_count,
            "contaminantSearchRecords": contaminant_count,
            "exactSequenceMatchedLoci": sum(
                row["pass00399_search_observation"] != "absent" for row in observations
            ),
            "exactSequenceUnmatchedLoci": sum(
                row["pass00399_search_observation"] == "absent" for row in observations
            ),
            "ambiguousLoci": sum(
                row["pass00399_search_observation"] == "exact_sequence_shared"
                for row in observations
            ),
            "admittedEvidenceLoci": 0,
        },
    }
    (artifact_dir / PASS_OUTPUT_NAMES[1]).write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return summary


def check_pass(manifest: dict, root: Path, artifact_dir: Path) -> None:
    """Compares local exploratory observations without admitting them."""
    with tempfile.TemporaryDirectory() as directory:
        generated = Path(directory)
        # The separate observer reads the already checked admitted identity TSV.
        try:
            (generated / OUTPUT_NAMES[0]).write_bytes((artifact_dir / OUTPUT_NAMES[0]).read_bytes())
        except OSError as error:
            raise EvidenceError(f"cannot read admitted identity artifact: {error}") from error
        observe_pass(manifest, root, generated)
        for name in PASS_OUTPUT_NAMES:
            expected = artifact_dir / name
            if not expected.is_file() or expected.read_bytes() != (generated / name).read_bytes():
                raise EvidenceError(f"local PASS observation artifact differs: {name}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "command", choices=("verify", "build", "check", "verify-pass", "observe-pass", "check-pass"),
        help="verify and rebuild admitted identity or optional local PASS observations",
    )
    parser.add_argument(
        "--manifest", type=Path,
        default=Path("data/manifest/protein-evidence-v1.json"),
    )
    args = parser.parse_args(argv)
    manifest = load_manifest(args.manifest)
    root = repository_root(args.manifest)
    roles = PASS_ROLES if args.command.endswith("-pass") else REFSEQ_ROLES
    verify_local_copies(manifest, root, roles)
    artifact_dir = root / "data/protein-evidence/releases" / manifest["releaseId"]
    if args.command == "build":
        summary = build(manifest, root, artifact_dir)
        print(json.dumps(summary["counts"], sort_keys=True))
    elif args.command == "check":
        check(manifest, root, artifact_dir)
        print("protein evidence artifacts match a clean rebuild")
    elif args.command == "observe-pass":
        summary = observe_pass(manifest, root, artifact_dir)
        print(json.dumps(summary["counts"], sort_keys=True))
    elif args.command == "check-pass":
        check_pass(manifest, root, artifact_dir)
        print("local PASS observations match a clean rebuild")
    else:
        print(f"verified {len(roles)} recorded local copies")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except EvidenceError as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1) from error
