#!/usr/bin/env python3
"""Project a recoded child dataset onto a pinned parent codon-PCA frame."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from codon_pca import CodonPcaError, reference_projection_document  # noqa: E402


OUTPUT_NAME = "codon_pca_reference.json"


def read_json(path: Path) -> Any:
    """Read a JSON document with a path-bearing error."""
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise CodonPcaError(f"cannot read {path}: {error}") from error


def source_artifact(path: Path) -> dict[str, Any]:
    """Describe the exact local source bytes without retaining a machine path."""
    try:
        content = path.read_bytes()
    except OSError as error:
        raise CodonPcaError(f"cannot read {path}: {error}") from error
    return {
        "file": path.name,
        "bytes": len(content),
        "sha256": hashlib.sha256(content).hexdigest(),
    }


def _gene_ids(genes: Any) -> list[str]:
    if not isinstance(genes, list) or not genes:
        raise CodonPcaError("child genes.json must be a non-empty array")
    result = []
    for index, gene in enumerate(genes):
        if not isinstance(gene, dict):
            raise CodonPcaError(f"child genes.json[{index}] must be an object")
        gene_id = gene.get("id")
        if not isinstance(gene_id, str) or not gene_id.strip():
            raise CodonPcaError(f"child genes.json[{index}].id must be a non-empty string")
        result.append(gene_id)
    if len(set(result)) != len(result):
        raise CodonPcaError("child genes.json ids must not contain duplicates")
    return result


def build_projection(
    parent_dir: Path, child_dir: Path, relationship_path: Path
) -> tuple[Path, dict[str, Any]]:
    """Validate both datasets and build the child-local projection artifact."""
    parent_pca_path = parent_dir / "codon_pca.json"
    parent_meta = read_json(parent_dir / "meta.json")
    parent_pca = read_json(parent_pca_path)
    child_meta = read_json(child_dir / "meta.json")
    child_genes = read_json(child_dir / "genes.json")
    child_rscu_path = child_dir / "codon_rscu.json"
    child_rscu = read_json(child_rscu_path)
    relationship = read_json(relationship_path)

    parent_genome = parent_meta.get("genome") if isinstance(parent_meta, dict) else None
    reference_genome = (
        parent_pca.get("referenceGenome") if isinstance(parent_pca, dict) else None
    )
    if not isinstance(parent_genome, dict) or not isinstance(reference_genome, dict):
        raise CodonPcaError("parent meta and codon_pca must both declare their genome")
    if parent_genome.get("accession") != reference_genome.get("genomeAccession"):
        raise CodonPcaError(
            "parent meta.genome.accession does not match codon_pca.referenceGenome"
        )
    if parent_genome.get("taxid") != reference_genome.get("taxid"):
        raise CodonPcaError(
            "parent meta.genome.taxid does not match codon_pca.referenceGenome"
        )
    parent_transform = parent_pca.get("transform")
    parent_feature_order = (
        parent_transform.get("featureOrder")
        if isinstance(parent_transform, dict)
        else None
    )
    if parent_meta.get("rscuOrder") != parent_feature_order:
        raise CodonPcaError(
            "parent meta.rscuOrder must match codon_pca transform feature order exactly"
        )

    if not isinstance(child_meta, dict):
        raise CodonPcaError("child meta.json must be an object")
    feature_order = child_meta.get("rscuOrder")
    expected_gene_ids = _gene_ids(child_genes)
    actual_gene_ids = child_rscu.get("geneIds") if isinstance(child_rscu, dict) else None
    if actual_gene_ids != expected_gene_ids:
        raise CodonPcaError(
            "child codon_rscu.geneIds must repeat genes.json order exactly"
        )

    document = reference_projection_document(
        parent_pca,
        child_rscu,
        feature_order,
        relationship,
        child_meta,
        source_artifact(parent_pca_path),
        source_artifact(child_rscu_path),
    )
    return child_dir / OUTPUT_NAME, document


def write_projection(path: Path, document: dict[str, Any]) -> None:
    """Atomically write validated, finite JSON without touching native artifacts."""
    content = json.dumps(
        document, indent=2, sort_keys=True, ensure_ascii=False, allow_nan=False
    ) + "\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_name: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as handle:
            temporary_name = handle.name
            handle.write(content)
        os.replace(temporary_name, path)
    finally:
        if temporary_name is not None:
            try:
                Path(temporary_name).unlink()
            except FileNotFoundError:
                pass


def main(argv: list[str] | None = None) -> int:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--parent-dir", type=Path, required=True)
    parser.add_argument("--child-dir", type=Path, required=True)
    parser.add_argument("--relationship", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        output, document = build_projection(
            args.parent_dir, args.child_dir, args.relationship
        )
        write_projection(output, document)
    except CodonPcaError as error:
        parser.error(str(error))
    print(f"wrote {output} with {len(document['geneIds'])} parent-frame coordinates")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
