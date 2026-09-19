"""Independent tests for the release-pinned annotation layer."""

from __future__ import annotations

import csv
import hashlib
import json
import shutil
import sys
import tempfile
import unittest
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))

import annotation_release as release  # noqa: E402


MANIFEST_PATH = ROOT / "data/manifest/annotation-release-v1.json"
ARTIFACT_DIR = (
    ROOT
    / "data/annotation/releases/GCF_000817325.1-RS_2026_05_13"
)


class ManifestTest(unittest.TestCase):
    """Checks manifest structure, source identity, and negative inputs."""

    def setUp(self) -> None:
        self.manifest = release.load_manifest(MANIFEST_PATH)

    def test_real_manifest_has_all_assessed_inputs(self) -> None:
        entries = release.entries_by_role(self.manifest)
        self.assertEqual(15, len(entries))
        self.assertEqual(
            {
                "annotation-hashes", "assembly-statistics", "feature-counts",
                "go-annotations", "protein-genpept", "pcc7942-crosswalk-gff",
            },
            set(entries) & {
                "annotation-hashes", "assembly-statistics", "feature-counts",
                "go-annotations", "protein-genpept", "pcc7942-crosswalk-gff",
            },
        )
        go_entry = entries["go-annotations"]
        self.assertIn("Gene Ontology Consortium", go_entry["redistribution"])
        self.assertIn("CC BY 4.0", go_entry["redistribution"])
        release.verify_files(self.manifest, ROOT)
        release.verify_release_metadata(self.manifest, ROOT)

    def test_release_metadata_rejects_changed_pgap_pin(self) -> None:
        changed = json.loads(json.dumps(self.manifest))
        changed["sources"][0]["pgapVersion"] = "6.12"
        with self.assertRaisesRegex(release.ReleaseError, "PGAP pin"):
            release.verify_release_metadata(changed, ROOT)

    def test_release_metadata_rejects_changed_go_version_pin(self) -> None:
        changed = json.loads(json.dumps(self.manifest))
        changed["sources"][0]["goVersion"] = "2099-01-01"
        with self.assertRaisesRegex(release.ReleaseError, "GO version"):
            release.verify_release_metadata(changed, ROOT)

    def test_manifest_rejects_bad_schema_duplicate_path_and_external_url(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "manifest.json"
            path.write_text('{"schemaVersion": 2}', encoding="utf-8")
            with self.assertRaisesRegex(release.ReleaseError, "schemaVersion"):
                release.load_manifest(path)

            duplicate = json.loads(json.dumps(self.manifest))
            duplicate["sources"][1]["files"][0]["localPath"] = (
                duplicate["sources"][0]["files"][0]["localPath"]
            )
            path.write_text(json.dumps(duplicate), encoding="utf-8")
            with self.assertRaisesRegex(release.ReleaseError, "duplicate localPath"):
                release.load_manifest(path)

            external = json.loads(json.dumps(self.manifest))
            external["sources"][0]["files"][0]["directUrl"] = (
                "https://example.test/unpinned"
            )
            path.write_text(json.dumps(external), encoding="utf-8")
            with self.assertRaisesRegex(release.ReleaseError, "outside pinned baseUrl"):
                release.load_manifest(path)

    def test_verify_rejects_missing_wrong_size_and_wrong_checksum(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest = json.loads(json.dumps(self.manifest))
            entry = manifest["sources"][0]["files"][0]
            entry["localPath"] = "missing.txt"
            manifest["sources"] = [{**manifest["sources"][0], "files": [entry]}]
            with self.assertRaisesRegex(release.ReleaseError, "missing"):
                release.verify_files(manifest, root)

            target = root / "missing.txt"
            target.write_bytes(b"wrong")
            entry["byteSize"] = 6
            with self.assertRaisesRegex(release.ReleaseError, "byte size"):
                release.verify_files(manifest, root)

            entry["byteSize"] = 5
            entry["md5"] = "0" * 32
            with self.assertRaisesRegex(release.ReleaseError, "MD5"):
                release.verify_files(manifest, root)

    def test_fetch_reuses_valid_file_and_rejects_corrupt_download(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            source_dir = Path(directory) / "source"
            (root / "data/manifest").mkdir(parents=True)
            source_dir.mkdir()
            source = source_dir / "input.txt"
            source.write_bytes(b"pinned\n")
            digest = hashlib.md5(source.read_bytes()).hexdigest()
            base_url = source_dir.as_uri()
            manifest = {
                "schemaVersion": 1,
                "releaseId": "test-release",
                "retrievedDate": "2026-09-18",
                "sources": [{
                    "id": "test", "organism": "test", "taxid": 1,
                    "assemblyAccession": "GCF_test", "assemblyName": "test",
                    "annotationRelease": "test", "annotationDate": "2026-09-18",
                    "pgapVersion": "1", "baseUrl": base_url,
                    "files": [{
                        "role": "test-input", "localPath": "data/source/input.txt",
                        "directUrl": source.as_uri(), "byteSize": 7, "md5": digest,
                        "retention": "test", "redistribution": "test",
                    }],
                }],
            }
            manifest_path = root / "data/manifest/test.json"
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
            parsed = release.load_manifest(manifest_path)
            self.assertEqual((1, 0), release.fetch_inputs(parsed, root))
            self.assertEqual((0, 1), release.fetch_inputs(parsed, root))

            source.write_bytes(b"changed")
            (root / "data/source/input.txt").unlink()
            with self.assertRaisesRegex(release.ReleaseError, "checksum mismatch"):
                release.fetch_inputs(parsed, root)

    def test_repository_root_rejects_misplaced_manifest(self) -> None:
        with self.assertRaisesRegex(release.ReleaseError, "must live"):
            release.repository_root(ROOT / "README.md")


class ParserTest(unittest.TestCase):
    """Exercises parser edge cases used by the generated artifacts."""

    def test_attributes_decode_and_malformed_attribute_fails(self) -> None:
        self.assertEqual(
            {"product": "protein, alpha", "flag": "true"},
            release.parse_attributes("product=protein%2C alpha;flag=true"),
        )
        self.assertEqual(
            {"old_locus_tag": ("legacy,part", "legacy_two")},
            release.parse_attribute_values(
                "old_locus_tag=legacy%2Cpart,legacy_two"
            ),
        )
        with self.assertRaisesRegex(release.ReleaseError, "malformed"):
            release.parse_attributes("missing-equals")

    def test_parse_gff_and_circular_segment_normalization(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "tiny.gff"
            path.write_text(
                "##gff-version 3\n"
                "##sequence-region seq 1 100\n"
                "seq\tRefSeq\tgene\t95\t110\t.\t+\t.\t"
                "ID=gene-x;locus_tag=x;gene_biotype=protein_coding\n",
                encoding="utf-8",
            )
            features, lengths = release.parse_gff(path)
            self.assertEqual({"seq": 100}, lengths)
            self.assertEqual([(95, 100), (1, 10)], release.normalized_segments(
                features[0], 100
            ))

            path.write_text("##gff-version 3\nseq\tbad\n", encoding="utf-8")
            with self.assertRaisesRegex(release.ReleaseError, "expected 9"):
                release.parse_gff(path)

    def test_parsed_identifier_lists_preserve_percent_encoded_commas(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "identifiers.gff"
            path.write_text(
                "##gff-version 3\n"
                "##sequence-region seq 1 100\n"
                "seq\tRefSeq\tgene\t1\t9\t.\t+\t.\t"
                "locus_tag=x;old_locus_tag=legacy%2Cpart,legacy_two\n",
                encoding="utf-8",
            )
            features, _ = release.parse_gff(path)
            self.assertEqual(
                ("legacy,part", "legacy_two"),
                features[0].attr_values["old_locus_tag"],
            )

    def test_plasmid_without_name_falls_back_to_seqid_not_chromosome(self) -> None:
        def region(seqid, attrs):
            return release.Feature(
                seqid=seqid, source="RefSeq", kind="region",
                start=1, end=100, strand="+", phase=".", attrs=attrs,
                attr_values={key: (value,) for key, value in attrs.items()},
            )

        self.assertEqual(
            ("plasmid", "NZ_PLASMID.1"),
            release._replicon_identity(region("NZ_PLASMID.1", {"genome": "plasmid"})),
        )
        self.assertEqual(
            ("plasmid", "pSYNA"),
            release._replicon_identity(region("NZ_NAMED.1", {"plasmid-name": "pSYNA"})),
        )
        self.assertEqual(
            ("chromosome", "chromosome"),
            release._replicon_identity(region("NZ_CHROM.1", {"genome": "chromosome"})),
        )
        self.assertEqual(
            (None, "NZ_UNKNOWN.1"),
            release._replicon_identity(region("NZ_UNKNOWN.1", {})),
        )

    def test_gpff_parser_preserves_structured_name_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "tiny.gpff"
            path.write_text(
                "VERSION     WP_TEST.1\n"
                "            ##Evidence-For-Name-Assignment-START##\n"
                "            Evidence Category  :: HMM\n"
                "            Evidence Source    :: NCBIFAM\n"
                "            ##Evidence-For-Name-Assignment-END##\n//\n",
                encoding="utf-8",
            )
            self.assertEqual(
                {"WP_TEST.1": [{
                    "evidence_category": "HMM", "evidence_source": "NCBIFAM"
                }]},
                release.parse_gpff_name_evidence(path),
            )


class GeneratedArtifactTest(unittest.TestCase):
    """Protects ambiguity, discontinuous CDSs, and evidence coverage."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = release.load_manifest(MANIFEST_PATH)

    def test_generated_files_rebuild_byte_for_byte(self) -> None:
        release.check_generated(self.manifest, ROOT, ARTIFACT_DIR)

    def test_crosswalk_preserves_four_shared_proteins_and_prfb_segments(self) -> None:
        with (ARTIFACT_DIR / "identifier-crosswalk-v1.tsv").open(
            encoding="utf-8", newline=""
        ) as handle:
            rows = list(csv.DictReader(handle, delimiter="\t"))
        self.assertEqual(22356, len(rows))

        protein_loci: dict[str, set[str]] = defaultdict(set)
        for row in rows:
            if row["relationship"] == "protein_id":
                protein_loci[row["object_id"]].add(row["subject_locus_tag"])
        shared = {protein: loci for protein, loci in protein_loci.items() if len(loci) > 1}
        self.assertEqual(release.EXPECTED_SHARED_PROTEINS, set(shared))
        self.assertTrue(all(len(loci) == 2 for loci in shared.values()))

        prfb_segments = [
            row["object_id"] for row in rows
            if row["subject_locus_tag"] == "M744_RS00920"
            and row["relationship"] == "cds_segment"
        ]
        self.assertEqual(
            ["NZ_CP006471.1:169621-169692:+", "NZ_CP006471.1:169694-170743:+"],
            prfb_segments,
        )
        for circular_locus in ("M744_RS13290", "M744_RS13620"):
            self.assertEqual(2, sum(
                row["subject_locus_tag"] == circular_locus
                and row["relationship"] == "cds_segment"
                for row in rows
            ))

    def test_crosswalk_external_mapping_is_exact_and_ambiguity_is_labelled(self) -> None:
        with (ARTIFACT_DIR / "identifier-crosswalk-v1.tsv").open(
            encoding="utf-8", newline=""
        ) as handle:
            rows = list(csv.DictReader(handle, delimiter="\t"))
        relationships = Counter(row["relationship"] for row in rows)
        self.assertEqual(2656, relationships["pcc7942_ortholog"])
        self.assertEqual(2567, relationships["pcc7942_old_locus_tag"])
        pcc_rows = [row for row in rows if row["relationship"].startswith("pcc7942_")]
        self.assertTrue(all(
            row["mapping_method"] == "exact shared RefSeq protein_id"
            and row["evidence"].startswith("WP_")
            for row in pcc_rows
        ))
        self.assertTrue(any(row["mapping_ambiguity"] for row in pcc_rows))

    def test_annotation_evidence_reports_risks_without_numeric_confidence(self) -> None:
        with (ARTIFACT_DIR / "annotation-evidence-v1.jsonl").open(
            encoding="utf-8"
        ) as handle:
            records = [json.loads(line) for line in handle]
        self.assertEqual(2776, len(records))
        self.assertEqual(7, sum(record["pseudogene"] for record in records))
        self.assertEqual(4, sum(record["partial"] for record in records))
        self.assertEqual(715, sum(bool(record["overlappingCds"]) for record in records))
        self.assertEqual(93, sum(bool(record["nearbyNoncodingRnas"]) for record in records))
        self.assertTrue(all(record["confidence"] is None for record in records))
        prfb = next(record for record in records if record["locusTag"] == "M744_RS00920")
        self.assertEqual("chromosome", prfb["repliconType"])
        self.assertEqual("ribosomal slippage", prfb["translationalExceptions"][0])
        self.assertEqual([[169621, 169692], [169694, 170743]], prfb["cdsSegments"])
        self.assertEqual("HMM", prfb["proteinNameEvidence"][0]["evidence"][0][
            "evidence_category"
        ])

    def test_go_relationships_keep_source_evidence_and_shared_mapping(self) -> None:
        with (ARTIFACT_DIR / "go-annotations-v1.tsv").open(
            encoding="utf-8", newline=""
        ) as handle:
            rows = list(csv.DictReader(handle, delimiter="\t"))
        self.assertEqual(3898, len(rows))
        self.assertTrue(all(row["evidence_code"] for row in rows))
        self.assertTrue(all(row["source_taxon"] == "taxon:1350461" for row in rows))
        # Twelve source relationships each expand to two loci: 24 labelled
        # output rows and 12 rows beyond the source GAF count.
        self.assertEqual(24, sum(bool(row["mapping_ambiguity"]) for row in rows))

    def test_stale_generated_file_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            tracked = Path(directory)
            for name in release.OUTPUT_NAMES:
                shutil.copy2(ARTIFACT_DIR / name, tracked / name)
            with (tracked / "release-summary-v1.json").open("a", encoding="utf-8") as handle:
                handle.write(" ")
            with self.assertRaisesRegex(release.ReleaseError, "stale generated"):
                release.check_generated(self.manifest, ROOT, tracked)


if __name__ == "__main__":
    unittest.main()
