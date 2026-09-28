"""Tests for the PCC 6311 and PCC 7943 exact-protein crosswalk."""

from __future__ import annotations

import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))

import annotation_release as release  # noqa: E402
import sister_strain_crosswalk as crosswalk  # noqa: E402


MANIFEST_PATH = ROOT / "data/manifest/sister-strain-crosswalk-v1.json"
ARTIFACT_PATH = (
    ROOT
    / "data/annotation/releases/GCF_000817325.1-RS_2026_05_13"
    / "sister-strain-crosswalk-v1.tsv"
)
EXPECTED_COUNTS = {
    "pcc6311": {
        "utexProteinLociTotal": 2715,
        "matchedUtexLoci": 2663,
        "unmatchedUtexLoci": 52,
        "ambiguousUtexLoci": 8,
        "sisterProteinLociTotal": 2714,
        "matchedSisterLoci": 2661,
        "unmatchedSisterLoci": 53,
        "ambiguousSisterLoci": 6,
        "currentRelationships": 2667,
        "ambiguousCurrentRelationships": 12,
        "oldLocusTagRelationships": 2627,
    },
    "pcc7943": {
        "utexProteinLociTotal": 2715,
        "matchedUtexLoci": 2636,
        "unmatchedUtexLoci": 79,
        "ambiguousUtexLoci": 8,
        "sisterProteinLociTotal": 2715,
        "matchedSisterLoci": 2635,
        "unmatchedSisterLoci": 80,
        "ambiguousSisterLoci": 7,
        "currentRelationships": 2642,
        "ambiguousCurrentRelationships": 14,
        "oldLocusTagRelationships": 2602,
    },
}


def feature(kind: str, locus: str, protein: str = "") -> release.Feature:
    """Creates a minimal parsed feature for mapping tests."""
    attrs = {"locus_tag": locus}
    values = {"locus_tag": (locus,)}
    if protein:
        attrs["protein_id"] = protein
        values["protein_id"] = (protein,)
    if kind == "gene":
        attrs["old_locus_tag"] = f"OLD_{locus}"
        values["old_locus_tag"] = (f"OLD_{locus}",)
    return release.Feature(
        seqid="sequence", source="RefSeq", kind=kind,
        start=1, end=9, strand="+", phase=".", attrs=attrs,
        attr_values=values,
    )


class ManifestTest(unittest.TestCase):
    """Checks release identity, checksums, and retention boundaries."""

    def setUp(self) -> None:
        self.manifest = release.load_manifest(MANIFEST_PATH)

    def test_manifest_pins_gffs_and_sister_assembly_reports(self) -> None:
        entries = release.entries_by_role(self.manifest)
        self.assertEqual(
            {
                "utex2973-crosswalk-gff",
                "pcc6311-crosswalk-gff",
                "pcc7943-crosswalk-gff",
                "pcc6311-assembly-report",
                "pcc7943-assembly-report",
            },
            set(entries),
        )
        self.assertEqual(
            "downloaded-at-build",
            entries["utex2973-crosswalk-gff"]["retention"],
        )
        for strain in ("pcc6311", "pcc7943"):
            self.assertEqual(
                "tracked-derived-feature-input",
                entries[f"{strain}-crosswalk-gff"]["retention"],
            )
            self.assertEqual(
                "tracked-release-gate",
                entries[f"{strain}-assembly-report"]["retention"],
            )
        release.verify_files(self.manifest, ROOT)
        crosswalk.verify_release_metadata(self.manifest, ROOT)

    def test_release_metadata_rejects_changed_identifier(self) -> None:
        changed = json.loads(json.dumps(self.manifest))
        changed["sources"][1]["annotationRelease"] = "truncated"
        with self.assertRaisesRegex(release.ReleaseError, "differs"):
            crosswalk.verify_release_metadata(changed, ROOT)

    def test_release_metadata_reads_assembly_level_from_report(self) -> None:
        with mock.patch.object(
            crosswalk, "_assembly_level", return_value="Complete Genome"
        ):
            with self.assertRaisesRegex(release.ReleaseError, "assembly report"):
                crosswalk.verify_release_metadata(self.manifest, ROOT)


class MappingTest(unittest.TestCase):
    """Protects exact joins, one row per pair, and explicit ambiguity."""

    def test_many_to_many_relationships_are_all_preserved_and_labelled(self) -> None:
        target = [
            feature("gene", "UTEX_A"), feature("CDS", "UTEX_A", "WP_SHARED.1"),
            feature("gene", "UTEX_B"), feature("CDS", "UTEX_B", "WP_SHARED.1"),
        ]
        sister = [
            feature("gene", "PCC_A"), feature("CDS", "PCC_A", "WP_SHARED.1"),
            feature("gene", "PCC_B"), feature("CDS", "PCC_B", "WP_SHARED.1"),
        ]
        rows, counts = crosswalk.build_rows(target, sister, crosswalk.STRAINS[0])
        current = [row for row in rows if row["relationship"] == "pcc6311_ortholog"]
        self.assertEqual(4, len(current))
        self.assertEqual(4, len({
            (row["subject_locus_tag"], row["object_id"]) for row in current
        }))
        self.assertTrue(all(
            row["mapping_ambiguity"] == "shared-protein-many-to-many"
            and row["mapping_method"] == "exact shared RefSeq protein_id"
            and row["evidence"] == "WP_SHARED.1"
            for row in rows
        ))
        self.assertEqual(2, counts["ambiguousUtexLoci"])
        self.assertEqual(2, counts["ambiguousSisterLoci"])

    def test_two_proteins_on_one_locus_are_ambiguous(self) -> None:
        target = [
            feature("gene", "UTEX_A"),
            feature("CDS", "UTEX_A", "WP_ONE.1"),
            feature("CDS", "UTEX_A", "WP_TWO.1"),
        ]
        sister = [
            feature("gene", "PCC_A"), feature("CDS", "PCC_A", "WP_ONE.1"),
            feature("gene", "PCC_B"), feature("CDS", "PCC_B", "WP_TWO.1"),
        ]
        rows, counts = crosswalk.build_rows(target, sister, crosswalk.STRAINS[0])
        current = [row for row in rows if row["relationship"] == "pcc6311_ortholog"]
        self.assertEqual(2, len(current))
        self.assertTrue(all(
            row["mapping_ambiguity"] == "multiple-exact-protein-locus-mappings"
            for row in current
        ))
        self.assertEqual(1, counts["ambiguousUtexLoci"])
        self.assertEqual(2, counts["ambiguousSisterLoci"])

    def test_protein_bearing_cds_requires_gene_feature(self) -> None:
        complete_target = [
            feature("gene", "UTEX_A"), feature("CDS", "UTEX_A", "WP_ONE.1"),
        ]
        complete_sister = [
            feature("gene", "PCC_A"), feature("CDS", "PCC_A", "WP_ONE.1"),
        ]
        cases = (
            ([feature("CDS", "UTEX_MISSING", "WP_ONE.1")], complete_sister,
             "UTEX_MISSING"),
            (complete_target, [feature("CDS", "PCC_MISSING", "WP_ONE.1")],
             "PCC_MISSING"),
        )
        for target, sister, missing_locus in cases:
            with self.subTest(missing_locus=missing_locus):
                with self.assertRaisesRegex(release.ReleaseError, missing_locus):
                    crosswalk.build_rows(target, sister, crosswalk.STRAINS[0])


class GeneratedArtifactTest(unittest.TestCase):
    """Re-derives the tracked TSV and fixes its audited coverage counts."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = release.load_manifest(MANIFEST_PATH)

    def test_generated_file_rebuilds_byte_for_byte_and_counts_match(self) -> None:
        crosswalk.check_generated(self.manifest, ROOT, ARTIFACT_PATH)
        with tempfile.TemporaryDirectory() as directory:
            counts = crosswalk.build(
                self.manifest, ROOT, Path(directory) / ARTIFACT_PATH.name
            )
        self.assertEqual(EXPECTED_COUNTS, counts)

    def test_each_current_relationship_is_unique_and_ambiguity_is_preserved(self) -> None:
        with ARTIFACT_PATH.open(encoding="utf-8", newline="") as handle:
            rows = list(csv.DictReader(handle, delimiter="\t"))
        current = [row for row in rows if row["relationship"].endswith("_ortholog")]
        keys = {
            (row["relationship"], row["subject_locus_tag"], row["object_id"])
            for row in current
        }
        self.assertEqual(len(current), len(keys))
        self.assertEqual(
            {"WP_011243185.1", "WP_011242480.1", "WP_011242807.1", "WP_011242808.1"},
            {row["evidence"] for row in current if row["mapping_ambiguity"]},
        )
        for relationship in ("pcc6311_ortholog", "pcc7943_ortholog"):
            relationship_rows = [
                row for row in current if row["relationship"] == relationship
            ]
            objects_by_subject: dict[str, set[str]] = {}
            subjects_by_object: dict[str, set[str]] = {}
            for row in relationship_rows:
                objects_by_subject.setdefault(row["subject_locus_tag"], set()).add(
                    row["object_id"]
                )
                subjects_by_object.setdefault(row["object_id"], set()).add(
                    row["subject_locus_tag"]
                )
            self.assertTrue(all(
                row["mapping_ambiguity"]
                for row in relationship_rows
                if len(objects_by_subject[row["subject_locus_tag"]]) > 1
            ))
            self.assertTrue(all(
                row["mapping_ambiguity"]
                for row in relationship_rows
                if len(subjects_by_object[row["object_id"]]) > 1
            ))
        self.assertEqual(
            {"PCC 6311 and UTEX RefSeq GFF3", "PCC 7943 and UTEX RefSeq GFF3"},
            {row["source"] for row in rows},
        )
        self.assertTrue(all(
            row["mapping_method"] == "exact shared RefSeq protein_id"
            for row in rows
        ))

    def test_check_mode_passes(self) -> None:
        self.assertEqual(0, crosswalk.main([
            "--manifest", str(MANIFEST_PATH),
            "--output", str(ARTIFACT_PATH),
            "--check",
        ]))


if __name__ == "__main__":
    unittest.main()
