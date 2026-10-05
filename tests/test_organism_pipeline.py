"""Unit contracts for organism-parametrised genome tooling."""

from __future__ import annotations

import gzip
import json
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "tools"))
import build_features  # noqa: E402
import check_utex_build_identity  # noqa: E402
import validate_contract  # noqa: E402
from organisms import get_organism  # noqa: E402


def test_default_and_named_organisms_are_explicit() -> None:
    default = get_organism()
    ecoli = get_organism("ecoli-k12-mg1655")
    assert default.organism_id == "utex2973"
    assert default.path("outputDirectory") == ROOT / "site/data"
    assert ecoli.accession == "GCF_000005845.2"
    assert ecoli.path("rawDirectory") == ROOT / "data/raw/ecoli-k12-mg1655"
    assert ecoli.optionalLayers == []


def test_unknown_organism_id_fails_loudly() -> None:
    with pytest.raises(ValueError, match="Unknown organism id 'not-real'"):
        get_organism("not-real")


def test_organism_expectations_cannot_mix() -> None:
    utex_meta = json.loads((ROOT / "site/data/meta.json").read_text(encoding="utf-8"))
    report = validate_contract.Report()
    validate_contract.validate_meta(
        utex_meta, report, get_organism("ecoli-k12-mg1655")
    )
    assert any("accession" in failure for failure in report.failures)
    assert any("taxid" in failure for failure in report.failures)
    assert any("totalLength" in failure for failure in report.failures)


def test_alternative_cds_selection_is_longest_and_audited() -> None:
    selected, excluded = build_features.select_cds_records(
        [
            {"locus_tag": "b1", "sequence": "ATGTAA", "protein_id": "short"},
            {"locus_tag": "b1", "sequence": "ATGAAATAA", "protein_id": "long"},
            {"locus_tag": "b2", "sequence": "ATGTAG", "protein_id": "only"},
        ]
    )
    assert [row["protein_id"] for row in selected] == ["long", "only"]
    assert excluded == [
        {
            "id": "b1",
            "reason": "alternate_cds",
            "lengthNt": 6,
            "proteinId": "short",
        }
    ]


def test_refseq_note_anticodon_and_selenocysteine_are_not_misread(tmp_path: Path) -> None:
    gff = tmp_path / "annotation.gff.gz"
    with gzip.open(gff, "wt") as handle:
        handle.write(
            "chr\tRefSeq\ttRNA\t1\t3\t.\t+\t.\t"
            "ID=rna-b1;Note=tRNA-Ile(CAU);product=tRNA-Ile;locus_tag=b1\n"
        )
    config = get_organism("ecoli-k12-mg1655")
    _, anticodons, species = build_features.parse_gff(
        gff, {"chr": "CAT"}, config.trnaSpecialCases
    )
    assert species == {("Ile", "CAT"): 1}
    assert anticodons == {"LAT": 1}
    annotation = {"translExcept": "(pos:1..3,aa:Sec)"}
    assert (
        build_features.exclusion_reason("ATGTGATAA", annotation)
        == "selenocysteine_internal_tga"
    )


def test_built_at_is_the_only_meta_normalization() -> None:
    published = b'{"schemaVersion":1,"builtAt":"old","geneCount":2}\n'
    candidate = b'{"schemaVersion":1,"builtAt":"new","geneCount":2}\n'
    changed = b'{"schemaVersion":1,"builtAt":"new","geneCount":3}\n'
    assert check_utex_build_identity.normalized_meta(candidate, published) == published
    assert check_utex_build_identity.normalized_meta(changed, published) != published
