"""Contract tests for the release-pinned protein identity audit."""

from __future__ import annotations

import csv
import hashlib
import json
import sys
import tempfile
import unittest
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))

import protein_evidence as evidence  # noqa: E402


MANIFEST_PATH = ROOT / "data/manifest/protein-evidence-v1.json"
ARTIFACT_DIR = (
    ROOT
    / "data/protein-evidence/releases"
    / "GCF_000817325.1-RS_2026_05_13-protein-evidence-v1"
)


class TranslationTest(unittest.TestCase):
    """Checks the exact CDS translation rules used by the audit."""

    def test_alternative_start_is_methionine_and_terminal_stop_is_removed(self) -> None:
        self.assertEqual(
            {"ATG", "GTG", "TTG", "ATC", "CTG", "ATT", "ATA"},
            evidence.START_CODONS,
        )
        for start in evidence.START_CODONS:
            with self.subTest(start=start):
                self.assertEqual("MK", evidence.translate_cds(start + "AAATAG"))

    def test_translation_rejects_bad_length_missing_stop_and_internal_stop(self) -> None:
        with self.assertRaisesRegex(evidence.EvidenceError, "divisible"):
            evidence.translate_cds("ATGT")
        with self.assertRaisesRegex(evidence.EvidenceError, "terminal stop"):
            evidence.translate_cds("ATGAAA")
        with self.assertRaisesRegex(evidence.EvidenceError, "internal stop"):
            evidence.translate_cds("ATGTGATAA")
        with self.assertRaisesRegex(evidence.EvidenceError, "unsupported codon"):
            evidence.translate_cds("ATGNNNTAA")
        with self.assertRaisesRegex(evidence.EvidenceError, "invalid table-11 start"):
            evidence.translate_cds("AAAAAATAA")


class ManifestAndParserTest(unittest.TestCase):
    """Checks source identity, missingness policy, and parser failures."""

    def test_manifest_names_all_evidence_tiers_and_conservative_reuse(self) -> None:
        manifest = evidence.load_manifest(MANIFEST_PATH)
        sources = {source["id"]: source for source in manifest["sources"]}
        self.assertEqual(
            {"utex2973-refseq-proteins", "pass00399", "ungerer-2018"},
            set(sources),
        )
        self.assertIn("no accepted MSGF+", sources["pass00399"]["missingness"])
        self.assertIn("Neither", sources["pass00399"]["admission"])
        self.assertIn("do not prove source authenticity", sources["pass00399"]["integrity"])
        self.assertIn("no source bytes redistributed", sources["ungerer-2018"]["licence"])
        self.assertEqual(3, len(sources["ungerer-2018"]["testedVariants"]))
        self.assertEqual(8, len(evidence.entries_by_role(manifest)))

    def test_manifest_rejects_bad_schema_missing_fields_and_bad_digest(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "manifest.json"
            path.write_text('{"schemaVersion": 2}', encoding="utf-8")
            with self.assertRaisesRegex(evidence.EvidenceError, "missing"):
                evidence.load_manifest(path)
            manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
            manifest["schemaVersion"] = 2
            path.write_text(json.dumps(manifest), encoding="utf-8")
            with self.assertRaisesRegex(evidence.EvidenceError, "schemaVersion"):
                evidence.load_manifest(path)
            manifest["schemaVersion"] = 1
            manifest["sources"][0]["files"][0]["sha256"] = "bad"
            path.write_text(json.dumps(manifest), encoding="utf-8")
            with self.assertRaisesRegex(evidence.EvidenceError, "SHA-256"):
                evidence.load_manifest(path)

    def test_verify_local_copies_accepts_recorded_bytes_and_rejects_changes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "input.txt"
            source.write_bytes(b"pinned\n")
            manifest = {
                "sources": [{
                    "files": [{
                        "role": "fixture", "localPath": "input.txt", "byteSize": 7,
                        "sha256": hashlib.sha256(b"pinned\n").hexdigest(),
                    }]
                }]
            }
            evidence.verify_local_copies(manifest, root)
            source.write_bytes(b"changed")
            with self.assertRaisesRegex(evidence.EvidenceError, "SHA-256"):
                evidence.verify_local_copies(manifest, root)
            source.unlink()
            with self.assertRaisesRegex(evidence.EvidenceError, "missing"):
                evidence.verify_local_copies(manifest, root)

    def test_fasta_parser_handles_records_and_rejects_sequence_before_header(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "records.fasta"
            path.write_text(">one\nMA\nA\n>two\nMK\n", encoding="utf-8")
            self.assertEqual([("one", "MAA"), ("two", "MK")], list(evidence.read_fasta(path)))
            path.write_text("MAA\n", encoding="utf-8")
            with self.assertRaisesRegex(evidence.EvidenceError, "before header"):
                list(evidence.read_fasta(path))


class GeneratedArtifactTest(unittest.TestCase):
    """Guards counts, ambiguity, inspected loci, and unknown-state semantics."""

    @classmethod
    def setUpClass(cls) -> None:
        with (ARTIFACT_DIR / "protein-identity-v1.tsv").open(
            encoding="utf-8", newline=""
        ) as handle:
            cls.rows = list(csv.DictReader(handle, delimiter="\t"))
        cls.by_locus = {row["locus_tag"]: row for row in cls.rows}
        cls.summary = json.loads(
            (ARTIFACT_DIR / "protein-evidence-summary-v1.json").read_text(
                encoding="utf-8"
            )
        )

    def test_every_site_locus_has_exact_refseq_identity_and_unknown_detection(self) -> None:
        self.assertEqual(2715, len(self.rows))
        self.assertTrue(all(row["refseq_protein_record"] == "present" for row in self.rows))
        self.assertTrue(all(row["computed_cds_translation"] == "exact" for row in self.rows))
        self.assertTrue(all(row["refseq_protein_sequence"] == "exact" for row in self.rows))
        self.assertTrue(all(row["experimentally_detected"] == "unknown" for row in self.rows))
        self.assertTrue(all(row["characterized_homolog"] == "unknown" for row in self.rows))

    def test_shared_accessions_remain_eight_ambiguous_locus_rows(self) -> None:
        ambiguous = [row for row in self.rows if row["identity_ambiguity"] != "none"]
        self.assertEqual(8, len(ambiguous))
        self.assertEqual(evidence.SHARED_PROTEIN_IDS, {row["protein_id"] for row in ambiguous})
        counts = Counter(row["protein_id"] for row in ambiguous)
        self.assertEqual({protein_id: 2 for protein_id in evidence.SHARED_PROTEIN_IDS}, counts)
        self.assertTrue(all(row["protein_id_locus_count"] == "2" for row in ambiguous))

    def test_required_examples_and_ungerer_loci_are_explicit(self) -> None:
        for locus in evidence.INSPECTED_LOCI.values():
            self.assertIn(locus, self.by_locus)
            self.assertEqual("exact", self.by_locus[locus]["computed_cds_translation"])
        self.assertNotIn("pass00399_search_observation", self.by_locus["M744_RS00920"])
        tested = {
            row["locus_tag"] for row in self.rows if row["tested_variant_evidence"] != "unknown"
        }
        self.assertEqual({"M744_RS01270", "M744_RS02500", "M744_RS04595"}, tested)
        for locus in tested:
            self.assertIn("900 micromol", self.by_locus[locus]["tested_variant_growth_condition"])
        self.assertEqual("unknown", self.by_locus["M744_RS10050"]["tested_variant_growth_condition"])

    def test_summary_reports_matched_unmatched_and_ambiguous_counts(self) -> None:
        counts = self.summary["counts"]
        self.assertEqual(2715, counts["refseqMatchedLoci"])
        self.assertEqual(0, counts["refseqUnmatchedLoci"])
        self.assertEqual(8, counts["refseqAmbiguousLoci"])
        self.assertEqual(0, counts["pass00399AdmittedSearchEvidenceLoci"])

    def test_pass_observations_are_separate_and_unadmitted(self) -> None:
        with (ARTIFACT_DIR / evidence.PASS_OUTPUT_NAMES[0]).open(
            encoding="utf-8", newline=""
        ) as handle:
            observed = list(csv.DictReader(handle, delimiter="\t"))
        summary = json.loads((ARTIFACT_DIR / evidence.PASS_OUTPUT_NAMES[1]).read_text())
        by_locus = {row["locus_tag"]: row for row in observed}
        self.assertEqual(2715, len(observed))
        self.assertEqual("absent", by_locus["M744_RS00920"]["pass00399_search_observation"])
        for locus in ("M744_RS10050", "M744_RS10055", "M744_RS10060"):
            self.assertEqual(
                "exact_sequence_unique", by_locus[locus]["pass00399_search_observation"]
            )
        self.assertTrue(all(row["admitted_evidence"] == "no" for row in observed))
        self.assertTrue(all(row["source_integrity"] == "unverified_transport" for row in observed))
        self.assertEqual(2281, summary["counts"]["exactSequenceMatchedLoci"])
        self.assertEqual(434, summary["counts"]["exactSequenceUnmatchedLoci"])
        self.assertEqual(8, summary["counts"]["ambiguousLoci"])


if __name__ == "__main__":
    unittest.main()
