#!/usr/bin/env python3
"""Validated native codon-PCA fits and fixed-reference projections."""

from __future__ import annotations

import copy
from typing import Any, Mapping, Sequence

import numpy as np


NATIVE_SCHEMA_VERSION = 2
PROJECTION_SCHEMA_VERSION = 1
RELATIONSHIP_TYPE = "recoded-derivative"
PROJECTION_TYPE = "fixed-parent-codon-pca"


class CodonPcaError(ValueError):
    """Raised when a codon-PCA fit or projection violates its contract."""


def _mapping(value: Any, path: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise CodonPcaError(f"{path} must be an object")
    return value


def _text(value: Any, path: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise CodonPcaError(f"{path} must be a non-empty string")
    return value


def _positive_int(value: Any, path: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise CodonPcaError(f"{path} must be a positive integer")
    return value


def _finite_vector(
    value: Any,
    path: str,
    *,
    length: int | None = None,
    positive: bool = False,
    nonnegative: bool = False,
) -> np.ndarray:
    if not isinstance(value, list):
        raise CodonPcaError(f"{path} must be an array")
    if length is not None and len(value) != length:
        raise CodonPcaError(f"{path} must contain exactly {length} values")
    bad_type = [
        item
        for item in value
        if isinstance(item, bool) or not isinstance(item, (int, float))
    ]
    if bad_type:
        raise CodonPcaError(f"{path} must contain only numbers")
    result = np.asarray(value, dtype=float)
    if not np.isfinite(result).all():
        raise CodonPcaError(f"{path} must contain only finite values")
    if positive and np.any(result <= 0):
        raise CodonPcaError(f"{path} must contain only positive values")
    if nonnegative and np.any(result < 0):
        raise CodonPcaError(f"{path} must contain only non-negative values")
    return result


def _unique_texts(value: Any, path: str) -> list[str]:
    if not isinstance(value, list) or not value:
        raise CodonPcaError(f"{path} must be a non-empty array")
    result = [_text(item, f"{path}[{index}]") for index, item in enumerate(value)]
    if len(set(result)) != len(result):
        raise CodonPcaError(f"{path} must not contain duplicates")
    return result


def _genome(value: Any, path: str) -> dict[str, Any]:
    genome = _mapping(value, path)
    return {
        "organismId": _text(genome.get("organismId"), f"{path}.organismId"),
        "label": _text(genome.get("label"), f"{path}.label"),
        "strain": _text(genome.get("strain"), f"{path}.strain"),
        "genomeAccession": _text(
            genome.get("genomeAccession"), f"{path}.genomeAccession"
        ),
        "taxid": _positive_int(genome.get("taxid"), f"{path}.taxid"),
    }


def _source_artifact(value: Any, path: str) -> dict[str, Any]:
    source = _mapping(value, path)
    file_name = _text(source.get("file"), f"{path}.file")
    if "/" in file_name or "\\" in file_name:
        raise CodonPcaError(f"{path}.file must be a basename")
    byte_count = _positive_int(source.get("bytes"), f"{path}.bytes")
    sha256 = _text(source.get("sha256"), f"{path}.sha256")
    if len(sha256) != 64 or any(
        character not in "0123456789abcdef" for character in sha256
    ):
        raise CodonPcaError(f"{path}.sha256 must be a lowercase SHA-256 digest")
    return {"file": file_name, "bytes": byte_count, "sha256": sha256}


def native_pca_document(
    feature_order: Sequence[str],
    scaler: Any,
    pca: Any,
    reference_genome: Mapping[str, Any],
    amino_acid_by_feature: Mapping[str, str],
) -> dict[str, Any]:
    """Return a self-describing native fit that reproduces ``PCA.transform``."""
    order = list(feature_order)
    components = np.asarray(pca.components_, dtype=float)
    document = {
        "schemaVersion": NATIVE_SCHEMA_VERSION,
        "projectionType": "native-fit",
        "referenceGenome": dict(reference_genome),
        "explainedVariance": np.asarray(
            pca.explained_variance_ratio_, dtype=float
        ).tolist(),
        "loadings": [
            {
                "codon": feature,
                "aa": amino_acid_by_feature[feature],
                "pc": components[:, index].tolist(),
            }
            for index, feature in enumerate(order)
        ],
        "nComponents": int(pca.n_components_),
        "transform": {
            "featureOrder": order,
            "scaler": {
                "mean": np.asarray(scaler.mean_, dtype=float).tolist(),
                "scale": np.asarray(scaler.scale_, dtype=float).tolist(),
            },
            "pca": {
                "mean": np.asarray(pca.mean_, dtype=float).tolist(),
                "components": components.tolist(),
            },
        },
    }
    validate_native_pca_document(document)
    return document


def validate_native_pca_document(
    document: Any,
) -> tuple[list[str], np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Validate a native fit and return its ordered numeric transform."""
    native = _mapping(document, "codon_pca")
    if native.get("schemaVersion") != NATIVE_SCHEMA_VERSION:
        raise CodonPcaError(
            f"codon_pca.schemaVersion must be {NATIVE_SCHEMA_VERSION}; rebuild the parent dataset"
        )
    if native.get("projectionType") != "native-fit":
        raise CodonPcaError("codon_pca.projectionType must be 'native-fit'")
    _genome(native.get("referenceGenome"), "codon_pca.referenceGenome")
    n_components = _positive_int(native.get("nComponents"), "codon_pca.nComponents")
    transform = _mapping(native.get("transform"), "codon_pca.transform")
    order = _unique_texts(
        transform.get("featureOrder"), "codon_pca.transform.featureOrder"
    )
    width = len(order)
    if n_components > width:
        raise CodonPcaError("codon_pca.nComponents cannot exceed the feature count")

    scaler = _mapping(transform.get("scaler"), "codon_pca.transform.scaler")
    scaler_mean = _finite_vector(
        scaler.get("mean"), "codon_pca.transform.scaler.mean", length=width
    )
    scaler_scale = _finite_vector(
        scaler.get("scale"),
        "codon_pca.transform.scaler.scale",
        length=width,
        positive=True,
    )
    pca = _mapping(transform.get("pca"), "codon_pca.transform.pca")
    pca_mean = _finite_vector(
        pca.get("mean"), "codon_pca.transform.pca.mean", length=width
    )
    raw_components = pca.get("components")
    if not isinstance(raw_components, list) or len(raw_components) != n_components:
        raise CodonPcaError(
            "codon_pca.transform.pca.components must have one row per component"
        )
    components = np.vstack(
        [
            _finite_vector(
                row,
                f"codon_pca.transform.pca.components[{index}]",
                length=width,
            )
            for index, row in enumerate(raw_components)
        ]
    )

    variance = _finite_vector(
        native.get("explainedVariance"),
        "codon_pca.explainedVariance",
        length=n_components,
        nonnegative=True,
    )
    if np.any(variance > 1) or float(variance.sum()) > 1 + 1e-12:
        raise CodonPcaError(
            "codon_pca.explainedVariance must contain fractions summing to at most one"
        )

    loadings = native.get("loadings")
    if not isinstance(loadings, list) or len(loadings) != width:
        raise CodonPcaError("codon_pca.loadings must have one entry per feature")
    for index, (feature, loading) in enumerate(zip(order, loadings, strict=True)):
        entry = _mapping(loading, f"codon_pca.loadings[{index}]")
        if entry.get("codon") != feature:
            raise CodonPcaError("codon_pca.loadings must follow transform.featureOrder exactly")
        _text(entry.get("aa"), f"codon_pca.loadings[{index}].aa")
        values = _finite_vector(
            entry.get("pc"), f"codon_pca.loadings[{index}].pc", length=n_components
        )
        if not np.array_equal(values, components[:, index]):
            raise CodonPcaError("codon_pca.loadings and transform components disagree")
    return order, scaler_mean, scaler_scale, pca_mean, components


def validate_rscu_document(
    document: Any, feature_count: int
) -> tuple[list[str], np.ndarray]:
    """Validate a complete RSCU payload and return ids plus its numeric matrix."""
    payload = _mapping(document, "codon_rscu")
    if payload.get("schemaVersion") != 1:
        raise CodonPcaError("codon_rscu.schemaVersion must be 1")
    gene_ids = _unique_texts(payload.get("geneIds"), "codon_rscu.geneIds")
    rows = payload.get("rscu")
    if not isinstance(rows, list) or len(rows) != len(gene_ids):
        raise CodonPcaError("codon_rscu.rscu must contain one row per gene id")
    matrix = np.vstack(
        [
            _finite_vector(
                row,
                f"codon_rscu.rscu[{index}]",
                length=feature_count,
                nonnegative=True,
            )
            for index, row in enumerate(rows)
        ]
    )
    return gene_ids, matrix


def project_rscu(
    reference_document: Any,
    rscu_document: Any,
    feature_order: Sequence[str],
) -> tuple[list[str], list[list[float]]]:
    """Project complete child RSCU rows onto one validated fixed parent frame."""
    order, scaler_mean, scaler_scale, pca_mean, components = (
        validate_native_pca_document(reference_document)
    )
    child_order = list(feature_order)
    if child_order != order:
        raise CodonPcaError(
            "child feature order must match the parent transform.featureOrder exactly"
        )
    gene_ids, matrix = validate_rscu_document(rscu_document, len(order))
    scaled = (matrix - scaler_mean) / scaler_scale
    coordinates = (scaled - pca_mean) @ components.T
    if not np.isfinite(coordinates).all():
        raise CodonPcaError("projected coordinates must be finite")
    return gene_ids, coordinates.tolist()


def validate_relationship(
    document: Any,
    reference_genome: Mapping[str, Any],
    child_genome: Mapping[str, Any],
) -> dict[str, Any]:
    """Validate the explicit, recoding-specific parent/child provenance."""
    relationship = _mapping(document, "relationship")
    if relationship.get("type") != RELATIONSHIP_TYPE:
        raise CodonPcaError(
            f"relationship.type must be {RELATIONSHIP_TYPE!r}; arbitrary "
            "cross-strain projections are refused"
        )
    parent = _mapping(relationship.get("parent"), "relationship.parent")
    child = _mapping(relationship.get("child"), "relationship.child")
    normalized_parent = {
        "organismId": _text(parent.get("organismId"), "relationship.parent.organismId"),
        "label": _text(parent.get("label"), "relationship.parent.label"),
        "genomeAccession": _text(
            parent.get("genomeAccession"), "relationship.parent.genomeAccession"
        ),
    }
    normalized_child = {
        "organismId": _text(child.get("organismId"), "relationship.child.organismId"),
        "label": _text(child.get("label"), "relationship.child.label"),
        "genomeAccession": _text(
            child.get("genomeAccession"), "relationship.child.genomeAccession"
        ),
    }
    if normalized_parent["organismId"] == normalized_child["organismId"]:
        raise CodonPcaError("relationship parent and child organism ids must differ")
    for field in ("organismId", "label", "genomeAccession"):
        if normalized_parent[field] != reference_genome[field]:
            raise CodonPcaError(
                f"relationship.parent.{field} does not match the parent PCA reference"
            )
    if normalized_child["genomeAccession"] != child_genome.get("accession"):
        raise CodonPcaError(
            "relationship.child.genomeAccession does not match child meta.genome.accession"
        )
    provenance = _mapping(relationship.get("provenance"), "relationship.provenance")
    normalized_provenance = {
        "recodingScheme": _text(
            provenance.get("recodingScheme"), "relationship.provenance.recodingScheme"
        ),
        "segmentSet": _text(
            provenance.get("segmentSet"), "relationship.provenance.segmentSet"
        ),
        "source": _text(provenance.get("source"), "relationship.provenance.source"),
        "description": _text(
            provenance.get("description"), "relationship.provenance.description"
        ),
    }
    return {
        "type": RELATIONSHIP_TYPE,
        "parent": normalized_parent,
        "child": normalized_child,
        "provenance": normalized_provenance,
    }


def reference_projection_document(
    reference_document: Any,
    rscu_document: Any,
    child_feature_order: Sequence[str],
    relationship_document: Any,
    child_meta: Any,
    parent_source: Mapping[str, Any],
    child_source: Mapping[str, Any],
) -> dict[str, Any]:
    """Build one self-contained child artifact with a copied parent transform."""
    reference = _mapping(reference_document, "codon_pca")
    reference_genome = _genome(
        reference.get("referenceGenome"), "codon_pca.referenceGenome"
    )
    meta = _mapping(child_meta, "child meta")
    genome = _mapping(meta.get("genome"), "child meta.genome")
    child_genome = {
        "accession": _text(genome.get("accession"), "child meta.genome.accession"),
        "taxid": _positive_int(genome.get("taxid"), "child meta.genome.taxid"),
        "totalLength": _positive_int(
            genome.get("totalLength"), "child meta.genome.totalLength"
        ),
    }
    relationship = validate_relationship(
        relationship_document, reference_genome, child_genome
    )
    normalized_parent_source = _source_artifact(
        parent_source, "parent source artifact"
    )
    normalized_child_source = _source_artifact(
        child_source, "child RSCU source artifact"
    )
    gene_ids, coordinates = project_rscu(
        reference_document, rscu_document, child_feature_order
    )
    return {
        "schemaVersion": PROJECTION_SCHEMA_VERSION,
        "projectionType": PROJECTION_TYPE,
        "relationship": relationship,
        "reference": {
            "genome": reference_genome,
            "sourceArtifact": normalized_parent_source,
            "nComponents": reference["nComponents"],
            "explainedVariance": copy.deepcopy(reference["explainedVariance"]),
            "loadings": copy.deepcopy(reference["loadings"]),
            "transform": copy.deepcopy(reference["transform"]),
        },
        "child": {
            **relationship["child"],
            "taxid": child_genome["taxid"],
            "totalLength": child_genome["totalLength"],
            "rscuSourceArtifact": normalized_child_source,
        },
        "geneIds": gene_ids,
        "coordinates": coordinates,
    }
