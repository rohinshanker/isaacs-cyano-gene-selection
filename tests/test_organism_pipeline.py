"""Unit contracts for organism-parametrised genome tooling."""

from __future__ import annotations

import gzip
import json
import pickle
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "tools"))
import build_features  # noqa: E402
import check_utex_build_identity  # noqa: E402
import validate_contract  # noqa: E402
from organisms import _validate, get_organism  # noqa: E402


def test_default_and_named_organisms_are_explicit() -> None:
    default = get_organism()
    ecoli = get_organism("ecoli-k12-mg1655")
    assert default.organism_id == "utex2973"
    assert default.path("outputDirectory") == ROOT / "site/data"
    assert ecoli.accession == "GCF_000005845.2"
    assert ecoli.path("rawDirectory") == ROOT / "data/raw/ecoli-k12-mg1655"
    assert ecoli.optionalLayers == ["annotation", "expression"]


def test_unknown_organism_id_fails_loudly() -> None:
    with pytest.raises(ValueError, match="Unknown organism id 'not-real'"):
        get_organism("not-real")


def test_organism_config_requires_expectations_and_rejects_unknown_trna_keys() -> None:
    values = dict(get_organism("ecoli-k12-mg1655").values)
    values.pop("expectedCdsRecords")
    with pytest.raises(ValueError, match="expectedCdsRecords"):
        _validate("fixture", values)

    values = dict(get_organism("ecoli-k12-mg1655").values)
    values["trnaSpecialCases"] = {**values["trnaSpecialCases"], "typo": True}
    with pytest.raises(ValueError, match="unknown trnaSpecialCases: typo"):
        _validate("fixture", values)


@pytest.mark.parametrize(
    ("special_cases", "message"),
    [
        (None, "invalid trnaSpecialCases"),
        ({"excludedFromDecodingPool": "Sec"}, "excludedFromDecodingPool"),
        ({"excludedFromDecodingPool": [7]}, "non-string.*excludedFromDecodingPool"),
        ({"excludedFromDecodingPool": [""]}, "empty.*excludedFromDecodingPool"),
        ({"inosineAtWobble": "maybe"}, "inosineAtWobble"),
        ({"lysidine": "yes"}, "trnaSpecialCases.lysidine"),
        ({"lysidine": {"aminoAcid": "Ile"}}, "lysidine fields: missing"),
        (
            {
                "lysidine": {
                    "aminoAcid": "Ile",
                    "genomicAnticodon": "CAT",
                    "effectiveAnticodon": "LAT",
                    "typo": "LAT",
                }
            },
            "lysidine fields: unknown typo",
        ),
        (
            {
                "lysidine": {
                    "aminoAcid": "Ile",
                    "genomicAnticodon": "CAT",
                    "effectiveAnticodon": 7,
                }
            },
            "lysidine value",
        ),
        ({"verifiedSpeciesTable": 7}, "verifiedSpeciesTable"),
        ({"verifiedSpeciesTable": ""}, "verifiedSpeciesTable"),
    ],
)
def test_organism_config_rejects_invalid_trna_special_case_values(
    special_cases: object, message: str
) -> None:
    values = dict(get_organism("ecoli-k12-mg1655").values)
    values["trnaSpecialCases"] = special_cases
    with pytest.raises(ValueError, match=message):
        _validate("fixture", values)


def test_organism_config_round_trips_through_pickle() -> None:
    organism = get_organism("ecoli-k12-mg1655")
    assert pickle.loads(pickle.dumps(organism)) == organism


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
            "chr\tRefSeq\ttRNA\t4\t6\t.\t+\t.\t"
            "ID=rna-b2;Note=tRNA-Trp(CCA);product=tRNA-Trp;locus_tag=b2\n"
            "chr\tRefSeq\ttRNA\t7\t9\t.\t+\t.\t"
            "ID=rna-b3;Note=tRNA-Sec(TCA);product=tRNA-Sec;locus_tag=b3\n"
            "chr\tRefSeq\ttRNA\t10\t12\t.\t+\t.\t"
            "ID=rna-b4;Note=tRNA-Met(CAU);product=tRNA-Met;locus_tag=b4\n"
            "chr\tRefSeq\ttRNA\t13\t15\t.\t+\t.\t"
            "ID=rna-b5;Note=tRNA-initiator Met(CAU);product=tRNA-Met;locus_tag=b5\n"
        )
    config = get_organism("ecoli-k12-mg1655")
    _, anticodons, species, roles = build_features.parse_gff(
        gff, {"chr": "CATCCATCA"}, config.trnaSpecialCases
    )
    assert species == {
        ("Ile", "CAT"): 1,
        ("Trp", "CCA"): 1,
        ("Sec", "TCA"): 1,
        ("Met", "CAT"): 2,
    }
    assert anticodons == {"LAT": 1, "CCA": 1, "CAT": 2}
    assert roles == {
        ("Ile", "CAT", "elongator"): 1,
        ("Trp", "CCA", "elongator"): 1,
        ("Sec", "TCA", "elongator"): 1,
        ("Met", "CAT", "elongator"): 1,
        ("Met", "CAT", "initiator"): 1,
    }
    assert "TCA" not in anticodons
    observed = build_features.fm.trna_adaptiveness(
        "TGG", anticodons, build_features.S_VALUES
    )
    without_sec = build_features.fm.trna_adaptiveness(
        "TGG", {"LAT": 1, "CCA": 1, "CAT": 2}, build_features.S_VALUES
    )
    assert observed == without_sec == 1
    annotation = {"translExcept": "(pos:1..3,aa:Sec)"}
    assert (
        build_features.exclusion_reason("ATGTGATAA", annotation)
        == "selenocysteine_internal_tga"
    )


def test_unreadable_trna_feature_fails_closed(tmp_path: Path) -> None:
    gff = tmp_path / "annotation.gff.gz"
    with gzip.open(gff, "wt") as handle:
        handle.write(
            "chr\tRefSeq\ttRNA\t1\t3\t.\t+\t.\t"
            "ID=rna-bad;product=tRNA-Leu;locus_tag=bad\n"
        )
    with pytest.raises(ValueError, match="Cannot derive anticodon.*bad"):
        build_features.parse_gff(gff, {"chr": "AAA"}, {})


def test_cds_annotation_is_keyed_by_selected_protein_id(tmp_path: Path) -> None:
    gff = tmp_path / "annotation.gff.gz"
    with gzip.open(gff, "wt") as handle:
        handle.write(
            "chr\tRefSeq\tCDS\t1\t9\t.\t+\t0\t"
            "locus_tag=b1;protein_id=long;product=primary;gene_biotype=protein_coding\n"
            "chr\tRefSeq\tCDS\t1\t6\t.\t+\t0\t"
            "locus_tag=b1;protein_id=short;product=alternate;"
            "gene_biotype=protein_coding;exception=ribosomal slippage\n"
        )
    annotations, _, _, _ = build_features.parse_gff(gff, {"chr": "ATGAAATAA"}, {})
    assert annotations[("b1", "long")]["product"] == "primary"
    assert annotations[("b1", "long")]["translationalException"] is None
    assert annotations[("b1", "short")]["translationalException"] == "ribosomal_slippage"


def test_lysidine_convention_uses_annotation_roles_and_preserves_utex_wording() -> None:
    assert build_features.lysidine_convention({"CAT": 2}, {}) == (
        "Ile-CAT is represented as LAT and decodes ATA with s=0.89; "
        "Met-CAT remains a separate two-copy species decoding ATG"
    )
    roles = {
        ("Met", "CAT", "elongator"): 2,
        ("Met", "CAT", "initiator"): 4,
    }
    assert build_features.lysidine_convention({"CAT": 6}, roles) == (
        "Ile-CAT is represented as LAT and decodes ATA with s=0.89; "
        "six annotated Met-CAT loci (two elongator and four initiator); "
        "Met is excluded from tAI"
    )


def test_ecoli_cai_rule_matches_only_declared_translation_machinery() -> None:
    rule = "ecoli-translation-machinery-product-match-v1"
    for product in (
        "RNA polymerase subunit alpha",
        "translation elongation factor Tu 1",
        "protein chain elongation factor EF-Ts",
        "elongation factor G",
        "protein chain elongation factor EF-P",
    ):
        assert build_features.is_cai_reference(product, rule)
    for product in (
        "RNA polymerase sigma factor RpoS",
        "RNA polymerase-binding transcription factor DksA",
        "transcription elongation factor GreA",
        "selenocysteyl-tRNA-specific translation elongation factor",
        "elongation factor P-like protein",
    ):
        assert not build_features.is_cai_reference(product, rule)


def test_built_at_is_the_only_meta_normalization() -> None:
    published = b'{"schemaVersion":1,"builtAt":"old","geneCount":2}\n'
    candidate = b'{"schemaVersion":1,"builtAt":"new","geneCount":2}\n'
    changed = b'{"schemaVersion":1,"builtAt":"new","geneCount":3}\n'
    assert check_utex_build_identity.normalized_meta(candidate, published) == published
    assert check_utex_build_identity.normalized_meta(changed, published) != published


def test_every_organism_configures_its_own_expression_directory():
    """A second organism's layers cannot share the first organism's manifest.

    Expression layers are measured in particular strains and join through a
    particular crosswalk, so the manifest is a property of the organism. Before
    this was configurable the build read one fixed path, which would have made
    an E. coli build read the cyanobacterial manifest and try to join PCC 7942
    locus tags onto b-numbers.
    """
    import json

    from scripts.organisms import CONFIG_PATH, get_organism

    ids = sorted(json.loads(CONFIG_PATH.read_text(encoding="utf-8"))["organisms"])
    assert len(ids) >= 2, "the point of the field is a second organism"

    seen = {}
    for organism_id in ids:
        directory = get_organism(organism_id).path("expressionDirectory")
        assert directory.is_absolute()
        seen[directory] = organism_id

    # No two organisms may share a directory, or one would publish the other's
    # measurements under its own gene identifiers.
    assert len(seen) == len(ids)


def test_the_expression_directory_is_declared_and_distinct_per_organism():
    """Turning the layer on was a one-word configuration change, as intended.

    The directory is declared whether or not the layer is switched on, which is
    what let E. coli gain expression without a code change. Each organism reads
    its own: the measurements are in different strains and join through
    different crosswalks, so one manifest could never serve both.
    """
    from scripts.organisms import get_organism

    ecoli = get_organism("ecoli-k12-mg1655")
    assert ecoli.has_layer("expression") is True
    assert ecoli.path("expressionDirectory").name == "ecoli-k12-mg1655"
    assert ecoli.path("expressionDirectory") != get_organism("utex2973").path(
        "expressionDirectory"
    )


def test_an_organism_may_decline_to_name_a_primary_abundance_metric():
    """Expression as joined layers only is a legitimate shape.

    The cyanobacterium carries one abundance value per gene in its core payload,
    which drives the expression percentile and the basis contract. An organism
    whose expression arrives entirely as optional joined layers has no such
    field, and requiring one would block it for no reason.
    """
    from scripts.organisms import get_organism

    assert get_organism("utex2973").primaryExpressionMetric == "expression"
    assert get_organism("ecoli-k12-mg1655").primaryExpressionMetric is None


def test_the_primary_metric_field_is_required_of_every_organism():
    """Declining a primary is explicit, never an omission."""
    import json

    from scripts.organisms import CONFIG_PATH, REQUIRED_FIELDS

    assert "primaryExpressionMetric" in REQUIRED_FIELDS
    assert "expressionDirectory" in REQUIRED_FIELDS
    for values in json.loads(CONFIG_PATH.read_text(encoding="utf-8"))["organisms"].values():
        assert "primaryExpressionMetric" in values
