#!/usr/bin/env python3
"""Build the release-pinned GO term-name lookup used by the static site."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ANNOTATIONS_PATH = ROOT / "data/annotation/releases/GCF_000817325.1-RS_2026_05_13/go-annotations-v1.tsv"
GAF_PATH = ROOT / "data/annotation/source/GCF_000817325.1_ASM81732v1_gene_ontology.gaf.gz"
OUTPUT_PATH = ROOT / "site/data/go-term-names-v1.json"

ONTOLOGY_RELEASE = "2026-05-19"
ONTOLOGY_URL = "https://release.geneontology.org/2026-05-19/ontology/go-basic.obo"
ONTOLOGY_BYTES = 32_212_518
ONTOLOGY_SHA256 = "923645000afcb1df0e72e252b64950b1c2bcc98c9393fec8c1dd1a0f7c9d4d77"
ANNOTATIONS_SHA256 = "0d91f6654e7ec03a31306e571f781c58e0a7d3287308a68865121cca70a6935c"
GAF_SHA256 = "0474225833a9eeb027b2d7049f5a742c7807cf9e916659f52095c42b907bd070"
EXPECTED_TERM_COUNT = 1_120
EXPECTED_OBSOLETE_IDS = {
    "GO:0006082", "GO:0006568", "GO:0006782", "GO:0008374", "GO:0016410",
    "GO:0018339", "GO:0019250", "GO:0019379", "GO:0045550", "GO:0051082",
}
EXPECTED_OBSOLETE_ROWS = 18
NAMESPACES = {"biological_process", "cellular_component", "molecular_function"}


class GoTermNamesError(RuntimeError):
    """Raised when a pinned source or generated table violates its contract."""


def sha256(path: Path) -> str:
    """Return the hexadecimal SHA-256 digest for a file."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_file(path: Path, expected_sha256: str, expected_bytes: int | None = None) -> None:
    """Verify a required input's presence, optional byte size, and SHA-256."""
    if not path.is_file():
        raise GoTermNamesError(f"missing required input: {path}")
    if expected_bytes is not None and path.stat().st_size != expected_bytes:
        raise GoTermNamesError(
            f"byte-size mismatch for {path}: expected {expected_bytes}, got {path.stat().st_size}"
        )
    actual = sha256(path)
    if actual != expected_sha256:
        raise GoTermNamesError(
            f"SHA-256 mismatch for {path}: expected {expected_sha256}, got {actual}"
        )


def parse_obo(path: Path) -> tuple[str | None, dict[str, dict[str, object]]]:
    """Parse only source identity fields from OBO Term stanzas."""
    release = None
    terms: dict[str, dict[str, object]] = {}
    stanza: dict[str, object] | None = None

    def finish_term() -> None:
        if stanza is None:
            return
        go_id = stanza.get("id")
        if not isinstance(go_id, str) or not go_id.startswith("GO:"):
            raise GoTermNamesError("[Term] stanza is missing a valid GO id")
        if go_id in terms:
            raise GoTermNamesError(f"duplicate GO term id: {go_id}")
        name = stanza.get("name")
        namespace = stanza.get("namespace")
        if not isinstance(name, str) or not name:
            raise GoTermNamesError(f"{go_id} is missing a name")
        if namespace not in NAMESPACES:
            raise GoTermNamesError(f"{go_id} has invalid namespace: {namespace!r}")
        terms[go_id] = {
            "name": name,
            "namespace": namespace,
            "isObsolete": stanza.get("isObsolete") is True,
        }

    with path.open(encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.rstrip("\r\n")
            if not line:
                if stanza is not None:
                    finish_term()
                    stanza = None
                continue
            if line == "[Term]":
                if stanza is not None:
                    finish_term()
                stanza = {}
                continue
            if line.startswith("["):
                if stanza is not None:
                    finish_term()
                    stanza = None
                continue
            if stanza is None:
                if line.startswith("data-version: "):
                    release = line.removeprefix("data-version: ")
                continue
            if line.startswith("id: "):
                stanza["id"] = line.removeprefix("id: ")
            elif line.startswith("name: "):
                stanza["name"] = line.removeprefix("name: ")
            elif line.startswith("namespace: "):
                stanza["namespace"] = line.removeprefix("namespace: ")
            elif line == "is_obsolete: true":
                stanza["isObsolete"] = True
        if stanza is not None:
            finish_term()
    return release, terms


def annotation_ids_and_counts(path: Path) -> tuple[set[str], dict[str, int]]:
    """Return unique GO IDs and per-ID row counts from the annotation TSV."""
    counts: dict[str, int] = {}
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        if reader.fieldnames is None or "go_id" not in reader.fieldnames:
            raise GoTermNamesError(f"{path} is missing the go_id column")
        for row in reader:
            go_id = row["go_id"]
            if not go_id.startswith("GO:"):
                raise GoTermNamesError(f"{path} contains an invalid GO id: {go_id!r}")
            counts[go_id] = counts.get(go_id, 0) + 1
    return set(counts), counts


def build_payload(obo_path: Path) -> dict[str, object]:
    """Build and validate the deterministic lookup payload."""
    verify_file(obo_path, ONTOLOGY_SHA256, ONTOLOGY_BYTES)
    verify_file(ANNOTATIONS_PATH, ANNOTATIONS_SHA256)
    verify_file(GAF_PATH, GAF_SHA256)
    release, all_terms = parse_obo(obo_path)
    expected_release = f"releases/{ONTOLOGY_RELEASE}"
    if release != expected_release:
        raise GoTermNamesError(
            f"ontology release mismatch: expected {expected_release}, got {release!r}"
        )

    required_ids, row_counts = annotation_ids_and_counts(ANNOTATIONS_PATH)
    if len(required_ids) != EXPECTED_TERM_COUNT:
        raise GoTermNamesError(
            f"annotation term count mismatch: expected {EXPECTED_TERM_COUNT}, got {len(required_ids)}"
        )
    missing = sorted(required_ids - all_terms.keys())
    if missing:
        raise GoTermNamesError(f"ontology is missing annotation GO ids: {missing}")
    obsolete_ids = {go_id for go_id in required_ids if all_terms[go_id]["isObsolete"]}
    if obsolete_ids != EXPECTED_OBSOLETE_IDS:
        raise GoTermNamesError(
            "obsolete annotation ID set mismatch: "
            f"expected {sorted(EXPECTED_OBSOLETE_IDS)}, got {sorted(obsolete_ids)}"
        )
    obsolete_rows = sum(row_counts[go_id] for go_id in obsolete_ids)
    if obsolete_rows != EXPECTED_OBSOLETE_ROWS:
        raise GoTermNamesError(
            f"obsolete annotation row count mismatch: expected {EXPECTED_OBSOLETE_ROWS}, got {obsolete_rows}"
        )

    terms = {go_id: all_terms[go_id] for go_id in sorted(required_ids)}
    return {
        "schemaVersion": 1,
        "source": {
            "ontology": {
                "releaseDate": ONTOLOGY_RELEASE,
                "url": ONTOLOGY_URL,
                "byteSize": ONTOLOGY_BYTES,
                "sha256": ONTOLOGY_SHA256,
            },
            "annotations": {
                "path": str(ANNOTATIONS_PATH.relative_to(ROOT)),
                "sha256": ANNOTATIONS_SHA256,
                "uniqueGoIds": EXPECTED_TERM_COUNT,
            },
            "gaf": {
                "path": str(GAF_PATH.relative_to(ROOT)),
                "sha256": GAF_SHA256,
            },
            "license": {
                "name": "Creative Commons Attribution 4.0 International",
                "url": "https://creativecommons.org/licenses/by/4.0/",
                "attribution": "Gene Ontology Consortium, copyright 1999-2026",
            },
        },
        "terms": terms,
    }


def serialized_payload(payload: dict[str, object]) -> bytes:
    """Serialize compactly and deterministically with a final newline."""
    return (json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def run(mode: str, obo_path: Path, output_path: Path) -> None:
    """Build or byte-check the generated lookup."""
    generated = serialized_payload(build_payload(obo_path))
    if mode == "build":
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(generated)
        print(f"wrote {output_path} ({len(generated)} bytes)")
        return
    if not output_path.is_file() or output_path.read_bytes() != generated:
        raise GoTermNamesError(f"generated table is missing or stale: run {Path(__file__).name} build")
    print(f"checked {output_path} ({EXPECTED_TERM_COUNT} terms)")


def main(argv: list[str] | None = None) -> int:
    """Run the command-line interface."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("build", "check"))
    parser.add_argument("--obo", type=Path, required=True, help="path to the pinned go-basic.obo")
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    args = parser.parse_args(argv)
    try:
        run(args.mode, args.obo, args.output)
    except GoTermNamesError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
