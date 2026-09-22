"""Synthetic source fixtures for protein evidence build and failure paths."""

from __future__ import annotations

import copy
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))

import protein_evidence as evidence  # noqa: E402


class ProteinBuildTest(unittest.TestCase):
    """Exercises the real builder without the large release files."""

    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.output = self.root / "out"
        self.files = {
            "refseq-cds-nucleotide": "data/raw/cds.fna",
            "refseq-translated-cds": "data/raw/translated.faa",
            "refseq-protein-fasta": "data/raw/protein.faa",
            "refseq-genomic-gff": "data/raw/genomic.gff",
        }
        self.write("site/data/genes.json", json.dumps([
            {"id": "LOC1", "name": "alpha"}, {"id": "LOC2", "name": None}
        ]))
        self.write(self.files["refseq-cds-nucleotide"], (
            ">cds1 [locus_tag=LOC1] [protein_id=WP_TEST.1]\nATGAAATAA\n"
            ">cds2 [locus_tag=LOC2] [protein_id=WP_TEST.1]\nATGAAATAA\n"
        ))
        self.write(self.files["refseq-translated-cds"], (
            ">protein1 [locus_tag=LOC1] [protein_id=WP_TEST.1]\nMK\n"
            ">protein2 [locus_tag=LOC2] [protein_id=WP_TEST.1]\nMK\n"
        ))
        self.write(self.files["refseq-protein-fasta"], ">WP_TEST.1 protein\nMK\n")
        self.write(self.files["refseq-genomic-gff"], (
            "chr\tRefSeq\tgene\t1\t9\t.\t+\t.\tlocus_tag=LOC1;old_locus_tag=OLD1\n"
            "chr\tRefSeq\tgene\t20\t28\t.\t+\t.\tlocus_tag=LOC2;old_locus_tag=OLD2\n"
        ))
        self.manifest = {
            "schemaVersion": 1,
            "releaseId": "synthetic-protein-evidence",
            "annotationRelease": "synthetic",
            "sources": [
                {"id": "test-refseq", "files": []},
                {"id": "ungerer-2018", "condition": "growth phenotype only", "files": [],
                 "testedVariants": [{
                     "evidenceId": "tested-LOC1", "currentLocusTag": "LOC1",
                     "oldLocusTag": "OLD1", "proteinId": "WP_TEST.1",
                 }]},
            ],
        }
        self.refresh_digests()

    def write(self, relative_path: str, content: str) -> None:
        path = self.root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    def refresh_digests(self) -> None:
        files = []
        for role, relative_path in self.files.items():
            payload = (self.root / relative_path).read_bytes()
            files.append({
                "role": role, "localPath": relative_path,
                "byteSize": len(payload),
                "sha256": hashlib.sha256(payload).hexdigest(),
            })
        self.manifest["sources"][0]["files"] = files

    def build(self) -> dict:
        return evidence.build(self.manifest, self.root, self.output)

    def test_build_and_check_with_shared_accession(self) -> None:
        summary = self.build()
        self.assertEqual(2, summary["counts"]["refseqMatchedLoci"])
        self.assertEqual(1, summary["counts"]["uniqueRefseqProteinIds"])
        self.assertEqual({"WP_TEST.1": ["LOC1", "LOC2"]}, summary["sharedProteinIds"])
        self.assertEqual(1, summary["counts"]["testedVariantEvidenceLoci"])
        evidence.check(self.manifest, self.root, self.output)
        self.assertNotIn("pass00399_search_ids", (self.output / evidence.OUTPUT_NAMES[0]).read_text())

    def test_core_cli_needs_no_pass_files(self) -> None:
        manifest_path = self.root / "data/manifest/protein-evidence-v1.json"
        self.write("data/manifest/protein-evidence-v1.json", json.dumps(self.manifest))
        self.assertEqual(0, evidence.main(["verify", "--manifest", str(manifest_path)]))
        self.assertEqual(0, evidence.main(["build", "--manifest", str(manifest_path)]))
        self.assertEqual(0, evidence.main(["check", "--manifest", str(manifest_path)]))

    def test_check_detects_artifact_drift(self) -> None:
        self.build()
        path = self.output / evidence.OUTPUT_NAMES[0]
        path.write_text(path.read_text() + "corruption\n")
        with self.assertRaisesRegex(evidence.EvidenceError, "artifact differs"):
            evidence.check(self.manifest, self.root, self.output)

    def test_missing_or_duplicate_input_records_fail(self) -> None:
        cases = [
            ("refseq-cds-nucleotide", "", "FASTA missing included loci"),
            ("refseq-cds-nucleotide", ">cds3 [locus_tag=LOC1] [protein_id=WP_TEST.1]\nATGAAATAA\n", "duplicate FASTA"),
            ("refseq-protein-fasta", ">WP_TEST.1 duplicate\nMK\n", "duplicate RefSeq protein"),
        ]
        for role, replacement, expected in cases:
            with self.subTest(role=role, expected=expected):
                path = self.root / self.files[role]
                original = path.read_text()
                path.write_text(original + replacement if replacement else replacement)
                with self.assertRaisesRegex(evidence.EvidenceError, expected):
                    self.build()
                path.write_text(original)

    def test_identity_and_translation_disagreements_fail(self) -> None:
        changes = [
            ("refseq-cds-nucleotide", "protein_id=WP_TEST.1", "protein_id=WP_OTHER.1", "protein_id differs"),
            ("refseq-cds-nucleotide", "ATGAAATAA", "ATGACATAA", "computed translation differs"),
            ("refseq-translated-cds", "\nMK\n", "\nMA\n", "computed translation differs"),
            ("refseq-protein-fasta", "\nMK\n", "\nMA\n", "translated CDS differs from protein FASTA"),
            ("refseq-protein-fasta", ">WP_TEST.1", ">WP_OTHER.1", "no RefSeq protein record"),
        ]
        for role, before, after, expected in changes:
            with self.subTest(expected=expected):
                path = self.root / self.files[role]
                original = path.read_text()
                path.write_text(original.replace(before, after, 1))
                with self.assertRaisesRegex(evidence.EvidenceError, expected):
                    self.build()
                path.write_text(original)

    def test_missing_roles_and_malformed_genes_fail_cleanly(self) -> None:
        damaged = copy.deepcopy(self.manifest)
        damaged["sources"][0]["files"].pop()
        with self.assertRaisesRegex(evidence.EvidenceError, "manifest lacks roles"):
            evidence.build(damaged, self.root, self.output)
        genes_path = self.root / "site/data/genes.json"
        for content, expected in [
            ("{", "cannot read site genes"),
            ("[{}]", "lacks a locus id"),
            ('[{"id":"LOC1"},{"id":"LOC1"}]', "duplicate site gene"),
        ]:
            with self.subTest(content=content):
                original = genes_path.read_text()
                genes_path.write_text(content)
                with self.assertRaisesRegex(evidence.EvidenceError, expected):
                    self.build()
                genes_path.write_text(original)

    def test_variant_joins_and_fields_are_checked(self) -> None:
        variant = self.manifest["sources"][1]["testedVariants"][0]
        for field, value, expected in [
            ("oldLocusTag", "WRONG", "old locus tag disagrees"),
            ("proteinId", "WP_OTHER.1", "protein ID disagrees"),
            ("currentLocusTag", "MISSING", "old locus tag disagrees"),
            ("evidenceId", "", "lacks a required field"),
        ]:
            with self.subTest(field=field):
                original = variant[field]
                variant[field] = value
                with self.assertRaisesRegex(evidence.EvidenceError, expected):
                    self.build()
                variant[field] = original
        self.manifest["sources"][1]["testedVariants"].append(dict(variant))
        with self.assertRaisesRegex(evidence.EvidenceError, "duplicate Ungerer"):
            self.build()

    def test_pass_observation_is_separate_and_multiplicity_sensitive(self) -> None:
        # Give LOC2 a different protein so LOC1 is unique in RefSeq but still
        # ambiguous across two identical historical search records.
        self.write(self.files["refseq-cds-nucleotide"], (
            ">cds1 [locus_tag=LOC1] [protein_id=WP_TEST.1]\nATGAAATAA\n"
            ">cds2 [locus_tag=LOC2] [protein_id=WP_OTHER.1]\nATGATGTAA\n"
        ))
        self.write(self.files["refseq-translated-cds"], (
            ">protein1 [locus_tag=LOC1] [protein_id=WP_TEST.1]\nMK\n"
            ">protein2 [locus_tag=LOC2] [protein_id=WP_OTHER.1]\nMM\n"
        ))
        self.write(self.files["refseq-protein-fasta"], ">WP_TEST.1 protein\nMK\n>WP_OTHER.1 protein\nMM\n")
        self.build()
        pass_path = "data/protein-evidence/source/pass.faa"
        self.write(pass_path, (
            ">gnl|PRJNA209528|OLD1\nMK\n"
            ">gnl|PRJNA209528|OLD2\nMK\n"
            ">contaminant\nMK\n"
        ))
        self.manifest["sources"].append({"id": "pass00399", "files": [
            {"role": role, "localPath": pass_path, "byteSize": 0, "sha256": "0" * 64}
            for role in evidence.PASS_ROLES
        ]})
        summary = evidence.observe_pass(self.manifest, self.root, self.output)
        self.assertEqual(1, summary["counts"]["ambiguousLoci"])
        self.assertEqual(0, summary["counts"]["admittedEvidenceLoci"])
        evidence.check_pass(self.manifest, self.root, self.output)


if __name__ == "__main__":
    unittest.main()
