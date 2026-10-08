"""Contracts for reproducible native and recoded parent-frame codon PCA."""

from __future__ import annotations

import copy
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

from scripts.codon_pca import (
    CodonPcaError,
    native_pca_document,
    project_rscu,
    reference_projection_document,
)
from tools.validate_contract import Report, validate_codon_pca


ROOT = Path(__file__).resolve().parents[1]
GENOME = {
    "organismId": "parent",
    "label": "Parent strain",
    "strain": "Parent",
    "genomeAccession": "PARENT_1",
    "taxid": 1,
}
FEATURE_ORDER = ["AAA", "AAC", "AAG"]


def fitted_reference() -> tuple[dict, StandardScaler, PCA]:
    """Fit a small parent model whose middle feature is constant."""
    parent = np.asarray(
        [
            [0.0, 2.0, 1.0],
            [1.0, 2.0, 0.0],
            [2.0, 2.0, 3.0],
            [4.0, 2.0, 2.0],
        ]
    )
    scaler = StandardScaler().fit(parent)
    pca = PCA(n_components=2, random_state=7).fit(scaler.transform(parent))
    document = native_pca_document(
        FEATURE_ORDER,
        scaler,
        pca,
        GENOME,
        {feature: "X" for feature in FEATURE_ORDER},
    )
    return document, scaler, pca


def child_rscu() -> dict:
    return {
        "schemaVersion": 1,
        "geneIds": ["child-1", "child-2"],
        "rscu": [[3.0, 2.0, 1.5], [0.5, 2.0, 4.0]],
    }


def child_meta() -> dict:
    return {
        "genome": {"accession": "CHILD_1", "taxid": 2, "totalLength": 1200},
        "rscuOrder": FEATURE_ORDER,
    }


def relationship() -> dict:
    return {
        "type": "recoded-derivative",
        "parent": {
            "organismId": "parent",
            "label": "Parent strain",
            "genomeAccession": "PARENT_1",
        },
        "child": {
            "organismId": "child-recoded",
            "label": "Child recoded strain",
            "genomeAccession": "CHILD_1",
        },
        "provenance": {
            "recodingScheme": "fixture-57-codon",
            "segmentSet": "segments 1-2",
            "source": "fixture design record",
            "description": "Child genome derived from the named parent by segment substitution.",
        },
    }


def artifact(name: str, content: bytes) -> dict:
    return {
        "file": name,
        "bytes": len(content),
        "sha256": hashlib.sha256(content).hexdigest(),
    }


def test_projection_matches_sklearn_transform_and_keeps_constant_feature_scale():
    reference, scaler, pca = fitted_reference()
    gene_ids, coordinates = project_rscu(reference, child_rscu(), FEATURE_ORDER)

    expected = pca.transform(scaler.transform(np.asarray(child_rscu()["rscu"])))
    assert gene_ids == ["child-1", "child-2"]
    np.testing.assert_allclose(coordinates, expected, rtol=0, atol=1e-14)
    assert scaler.scale_[1] == 1.0
    assert reference["transform"]["scaler"]["scale"][1] == 1.0
    assert reference["transform"]["pca"]["mean"] == pca.mean_.tolist()


def test_projection_document_is_self_contained_and_does_not_mutate_inputs():
    reference, _, _ = fitted_reference()
    rscu = child_rscu()
    relation = relationship()
    meta = child_meta()
    before = copy.deepcopy((reference, rscu, relation, meta))

    document = reference_projection_document(
        reference,
        rscu,
        FEATURE_ORDER,
        relation,
        meta,
        artifact("codon_pca.json", b"parent"),
        artifact("codon_rscu.json", b"child"),
    )

    assert (reference, rscu, relation, meta) == before
    assert document["projectionType"] == "fixed-parent-codon-pca"
    assert document["reference"]["transform"] == reference["transform"]
    assert document["relationship"]["provenance"]["recodingScheme"] == "fixture-57-codon"
    assert document["geneIds"] == rscu["geneIds"]
    assert len(document["coordinates"]) == len(rscu["geneIds"])


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (
            lambda reference, rscu, order: order.reverse(),
            "feature order must match",
        ),
        (
            lambda reference, rscu, order: rscu["rscu"].__setitem__(0, [1.0]),
            "exactly 3 values",
        ),
        (
            lambda reference, rscu, order: rscu["geneIds"].__setitem__(1, "child-1"),
            "must not contain duplicates",
        ),
        (
            lambda reference, rscu, order: rscu.__delitem__("geneIds"),
            "geneIds must be a non-empty array",
        ),
        (
            lambda reference, rscu, order: rscu["rscu"][0].__setitem__(0, float("nan")),
            "finite values",
        ),
        (
            lambda reference, rscu, order: reference["transform"]["scaler"][
                "scale"
            ].__setitem__(0, 0.0),
            "positive values",
        ),
        (
            lambda reference, rscu, order: reference["transform"]["scaler"][
                "scale"
            ].__setitem__(0, float("inf")),
            "finite values",
        ),
        (
            lambda reference, rscu, order: reference["transform"]["featureOrder"].__setitem__(
                1, "AAA"
            ),
            "must not contain duplicates",
        ),
    ],
)
def test_projection_fails_closed_on_order_dimension_identity_and_numeric_errors(
    mutate, message
):
    reference, _, _ = fitted_reference()
    rscu = child_rscu()
    order = list(FEATURE_ORDER)
    mutate(reference, rscu, order)
    with pytest.raises(CodonPcaError, match=message):
        project_rscu(reference, rscu, order)


def test_projection_requires_explicit_matching_recoded_relationship():
    reference, _, _ = fitted_reference()
    relation = relationship()
    relation["type"] = "similar-strain"
    with pytest.raises(CodonPcaError, match="arbitrary cross-strain projections are refused"):
        reference_projection_document(
            reference,
            child_rscu(),
            FEATURE_ORDER,
            relation,
            child_meta(),
            artifact("codon_pca.json", b"parent"),
            artifact("codon_rscu.json", b"child"),
        )

    relation = relationship()
    relation["child"]["genomeAccession"] = "WRONG"
    with pytest.raises(CodonPcaError, match="does not match child meta"):
        reference_projection_document(
            reference,
            child_rscu(),
            FEATURE_ORDER,
            relation,
            child_meta(),
            artifact("codon_pca.json", b"parent"),
            artifact("codon_rscu.json", b"child"),
        )


def test_schema_two_contract_validator_checks_the_exact_transform():
    reference, _, _ = fitted_reference()
    meta = {
        "genome": {"accession": "PARENT_1", "taxid": 1},
        "rscuOrder": FEATURE_ORDER,
    }
    report = Report()
    validate_codon_pca(reference, meta, report)
    assert report.failures == []

    reference["transform"]["scaler"]["scale"][0] = 0.0
    report = Report()
    validate_codon_pca(reference, meta, report)
    assert any("positive scales" in failure for failure in report.failures)


def _write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, allow_nan=False) + "\n", encoding="utf-8")


def test_cli_writes_integral_child_local_artifact_without_changing_native_coordinates(
    tmp_path: Path,
):
    parent_dir = tmp_path / "parent"
    child_dir = tmp_path / "child"
    parent_dir.mkdir()
    child_dir.mkdir()
    reference, scaler, pca = fitted_reference()
    _write_json(parent_dir / "codon_pca.json", reference)
    _write_json(
        parent_dir / "meta.json",
        {
            "genome": {"accession": "PARENT_1", "taxid": 1},
            "rscuOrder": FEATURE_ORDER,
        },
    )
    native_genes = [
        {"id": "child-1", "codonPca": [9.0, 8.0]},
        {"id": "child-2", "codonPca": [7.0, 6.0]},
    ]
    native_child_pca = {"sentinel": "the child's own fit remains available"}
    _write_json(child_dir / "genes.json", native_genes)
    _write_json(child_dir / "codon_pca.json", native_child_pca)
    _write_json(child_dir / "codon_rscu.json", child_rscu())
    _write_json(child_dir / "meta.json", child_meta())
    relationship_path = tmp_path / "relationship.json"
    _write_json(relationship_path, relationship())
    snapshots = {
        path.name: path.read_bytes()
        for path in child_dir.iterdir()
        if path.is_file()
    }
    parent_bytes = (parent_dir / "codon_pca.json").read_bytes()
    child_rscu_bytes = (child_dir / "codon_rscu.json").read_bytes()

    completed = subprocess.run(
        [
            sys.executable,
            str(ROOT / "tools/project_codon_pca.py"),
            "--parent-dir",
            str(parent_dir),
            "--child-dir",
            str(child_dir),
            "--relationship",
            str(relationship_path),
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    assert completed.returncode == 0, completed.stderr
    output = json.loads((child_dir / "codon_pca_reference.json").read_text())
    expected = pca.transform(scaler.transform(np.asarray(child_rscu()["rscu"])))
    np.testing.assert_allclose(output["coordinates"], expected, rtol=0, atol=1e-14)
    assert output["reference"]["sourceArtifact"] == artifact(
        "codon_pca.json", parent_bytes
    )
    assert output["child"]["rscuSourceArtifact"] == artifact(
        "codon_rscu.json", child_rscu_bytes
    )
    assert output["reference"]["transform"] == reference["transform"]
    assert str(tmp_path) not in json.dumps(output)
    assert {
        path.name: path.read_bytes()
        for path in child_dir.iterdir()
        if path.name in snapshots
    } == snapshots
    assert json.loads((child_dir / "genes.json").read_text()) == native_genes
    assert json.loads((child_dir / "codon_pca.json").read_text()) == native_child_pca
    assert (parent_dir / "codon_pca.json").read_bytes() == parent_bytes


def test_cli_rejects_gene_order_mismatch_without_writing_output(tmp_path: Path):
    parent_dir = tmp_path / "parent"
    child_dir = tmp_path / "child"
    parent_dir.mkdir()
    child_dir.mkdir()
    reference, _, _ = fitted_reference()
    _write_json(parent_dir / "codon_pca.json", reference)
    _write_json(
        parent_dir / "meta.json",
        {
            "genome": {"accession": "PARENT_1", "taxid": 1},
            "rscuOrder": FEATURE_ORDER,
        },
    )
    _write_json(child_dir / "genes.json", [{"id": "child-2"}, {"id": "child-1"}])
    _write_json(child_dir / "codon_rscu.json", child_rscu())
    _write_json(child_dir / "meta.json", child_meta())
    relationship_path = tmp_path / "relationship.json"
    _write_json(relationship_path, relationship())

    completed = subprocess.run(
        [
            sys.executable,
            str(ROOT / "tools/project_codon_pca.py"),
            "--parent-dir",
            str(parent_dir),
            "--child-dir",
            str(child_dir),
            "--relationship",
            str(relationship_path),
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    assert completed.returncode != 0
    assert "must repeat genes.json order exactly" in completed.stderr
    assert not (child_dir / "codon_pca_reference.json").exists()
