"""Tests for the pinned GO ID-to-name table."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import go_term_names as go_names  # noqa: E402

TABLE_PATH = ROOT / "site/data/go-term-names-v1.json"
CACHED_OBO = Path("/tmp/go-basic-2026-05-19.obo")
EXPECTED_OBSOLETE_IDS = {
    "GO:0006082",
    "GO:0006568",
    "GO:0006782",
    "GO:0008374",
    "GO:0016410",
    "GO:0018339",
    "GO:0019250",
    "GO:0019379",
    "GO:0045550",
    "GO:0051082",
}


class OboParserTest(unittest.TestCase):
    """Exercise source-field parsing and malformed input rejection."""

    def test_parser_reads_release_namespace_and_obsolete_status_only(self) -> None:
        source = (
            "format-version: 1.2\ndata-version: releases/2026-05-19\n\n"
            "[Term]\nid: GO:0000001\nname: current label\nnamespace: biological_process\n\n"
            "[Term]\nid: GO:0000002\nname: obsolete source label\n"
            "namespace: molecular_function\nis_obsolete: true\n"
            "replaced_by: GO:9999999\nconsider: GO:8888888\n"
        )
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "go.obo"
            path.write_text(source, encoding="utf-8")
            release, terms = go_names.parse_obo(path)
        self.assertEqual("releases/2026-05-19", release)
        self.assertEqual(
            {"name": "obsolete source label", "namespace": "molecular_function", "isObsolete": True},
            terms["GO:0000002"],
        )
        self.assertNotIn("replacedBy", terms["GO:0000002"])
        self.assertNotIn("consider", terms["GO:0000002"])

    def test_parser_rejects_duplicate_ids_and_missing_names(self) -> None:
        cases = (
            ("[Term]\nid: GO:1\nname: first\nnamespace: biological_process\n\n"
             "[Term]\nid: GO:1\nname: second\nnamespace: biological_process\n", "duplicate"),
            ("[Term]\nid: GO:1\nnamespace: biological_process\n", "missing a name"),
        )
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "go.obo"
            for content, message in cases:
                path.write_text(content, encoding="utf-8")
                with self.assertRaisesRegex(go_names.GoTermNamesError, message):
                    go_names.parse_obo(path)

    def test_verify_file_rejects_wrong_size_and_hash(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "source.obo"
            path.write_bytes(b"pinned")
            with self.assertRaisesRegex(go_names.GoTermNamesError, "byte-size"):
                go_names.verify_file(path, go_names.sha256(path), 7)
            with self.assertRaisesRegex(go_names.GoTermNamesError, "SHA-256"):
                go_names.verify_file(path, "0" * 64, 6)


class GeneratedTableTest(unittest.TestCase):
    """Protect source pins, exact coverage, shape, and historical labels."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.table = json.loads(TABLE_PATH.read_text(encoding="utf-8"))
        cls.annotation_ids, cls.row_counts = go_names.annotation_ids_and_counts(go_names.ANNOTATIONS_PATH)

    def test_source_metadata_and_pinned_input_hashes(self) -> None:
        source = self.table["source"]
        self.assertEqual(go_names.ONTOLOGY_SHA256, source["ontology"]["sha256"])
        self.assertEqual(go_names.ONTOLOGY_BYTES, source["ontology"]["byteSize"])
        self.assertEqual(go_names.ANNOTATIONS_SHA256, source["annotations"]["sha256"])
        self.assertEqual(go_names.GAF_SHA256, source["gaf"]["sha256"])
        go_names.verify_file(go_names.ANNOTATIONS_PATH, go_names.ANNOTATIONS_SHA256)
        go_names.verify_file(go_names.GAF_PATH, go_names.GAF_SHA256)

    def test_terms_exactly_cover_annotation_ids_with_unique_valid_shape(self) -> None:
        terms = self.table["terms"]
        self.assertEqual(go_names.EXPECTED_TERM_COUNT, len(terms))
        self.assertEqual(self.annotation_ids, set(terms))
        self.assertEqual(len(terms), len(set(terms)))
        for go_id, term in terms.items():
            self.assertRegex(go_id, r"^GO:\d{7}$")
            self.assertEqual({"name", "namespace", "isObsolete"}, set(term))
            self.assertIsInstance(term["name"], str)
            self.assertTrue(term["name"])
            self.assertIn(term["namespace"], go_names.NAMESPACES)
            self.assertIsInstance(term["isObsolete"], bool)

    def test_exact_obsolete_ids_and_eighteen_annotation_rows(self) -> None:
        obsolete = {go_id for go_id, term in self.table["terms"].items() if term["isObsolete"]}
        self.assertEqual(EXPECTED_OBSOLETE_IDS, obsolete)
        self.assertEqual(18, sum(self.row_counts[go_id] for go_id in obsolete))
        self.assertEqual(
            "obsolete unfolded protein binding",
            self.table["terms"]["GO:0051082"]["name"],
        )
        self.assertEqual({"name", "namespace", "isObsolete"}, set(self.table["terms"]["GO:0051082"]))

    def test_representative_current_terms(self) -> None:
        terms = self.table["terms"]
        self.assertEqual(
            {"name": "DNA binding", "namespace": "molecular_function", "isObsolete": False},
            terms["GO:0003677"],
        )
        self.assertEqual(
            {"name": "plasma membrane", "namespace": "cellular_component", "isObsolete": False},
            terms["GO:0005886"],
        )
        self.assertEqual(
            {"name": "DNA repair", "namespace": "biological_process", "isObsolete": False},
            terms["GO:0006281"],
        )

    @unittest.skipUnless(CACHED_OBO.is_file(), "pinned OBO cache is not available")
    def test_cached_source_hash_release_and_generated_bytes(self) -> None:
        go_names.verify_file(CACHED_OBO, go_names.ONTOLOGY_SHA256, go_names.ONTOLOGY_BYTES)
        release, ontology = go_names.parse_obo(CACHED_OBO)
        self.assertEqual(f"releases/{go_names.ONTOLOGY_RELEASE}", release)
        self.assertEqual(set(), self.annotation_ids - ontology.keys())
        self.assertEqual(TABLE_PATH.read_bytes(), go_names.serialized_payload(go_names.build_payload(CACHED_OBO)))


if __name__ == "__main__":
    unittest.main()
