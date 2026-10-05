"""Tests for the pinned-assembly 16S rRNA 3' terminal derivation."""

from __future__ import annotations

import contextlib
import io
import json
import os
import runpy
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))

import rrna_3prime as rrna  # noqa: E402


MANIFEST_PATH = ROOT / "data/manifest/annotation-release-v1.json"
PINNED_GFF = "GCF_000817325.1_ASM81732v1_genomic.gff.gz"
PINNED_FASTA = "GCF_000817325.1_ASM81732v1_genomic.fna.gz"
ASSEMBLY = "GCF_TEST.1"
ANNOTATION = "GCF_TEST.1-RS_TEST"


def gff_row(
    seqid: str,
    start: int,
    end: int,
    strand: str,
    locus: str | None,
    product: str = "16S ribosomal RNA",
) -> str:
    """Returns one synthetic GFF3 rRNA row."""
    attributes = f"product={product}"
    if locus is not None:
        attributes = f"locus_tag={locus};{attributes}"
    return (
        f"{seqid}\ttest\trRNA\t{start}\t{end}\t.\t{strand}\t.\t"
        f"{attributes}\n"
    )


def gff_document(*rows: str, length: int = 8) -> str:
    """Returns a release-labelled synthetic GFF3 document."""
    return (
        "##gff-version 3\n"
        f"#!genome-build-accession NCBI_Assembly:{ASSEMBLY}\n"
        f"#!annotation-source NCBI RefSeq {ANNOTATION}\n"
        f"##sequence-region seq 1 {length}\n"
        + "".join(rows)
    )


class DerivationTest(unittest.TestCase):
    """Exercises orientation, circular coordinates, filtering, and relationships."""

    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.directory = Path(self.temporary.name)
        self.fasta = self.directory / "genome.fna"
        self.gff = self.directory / "annotation.gff"

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def _derive(self, length: int = 3) -> list[dict[str, object]]:
        return rrna.derive_rows(
            self.gff,
            self.fasta,
            ASSEMBLY,
            ANNOTATION,
            length,
        )

    def test_plus_and_minus_strands_are_transcript_oriented(self) -> None:
        self.fasta.write_text(
            ">seq description\nAAAACCCC\n\n",
            encoding="utf-8",
        )
        self.gff.write_text(
            gff_document(
                gff_row("seq", 1, 8, "-", "MINUS"),
                gff_row("seq", 1, 8, "+", "PLUS"),
                gff_row("seq", 2, 5, "+", "NOT_16S", "23S ribosomal RNA"),
            ),
            encoding="utf-8",
        )

        rows = self._derive()

        self.assertEqual(["MINUS", "PLUS"], [row["locus_tag"] for row in rows])
        self.assertEqual(
            ["UUU", "CCC"],
            [row["three_prime_sequence_rna"] for row in rows],
        )
        self.assertEqual([8, 8], [row["feature_length"] for row in rows])
        self.assertTrue(all(row["terminal_length"] == 3 for row in rows))
        self.assertTrue(all(row["assembly_accession"] == ASSEMBLY for row in rows))
        self.assertTrue(
            all(row["annotation_release"] == ANNOTATION for row in rows)
        )

    def test_origin_crossing_features_on_both_strands(self) -> None:
        self.fasta.write_text(">seq\nACGTTGCA\n", encoding="utf-8")
        self.gff.write_text(
            gff_document(
                gff_row("seq", 7, 10, "-", "MINUS"),
                gff_row("seq", 7, 10, "+", "PLUS"),
            ),
            encoding="utf-8",
        )

        rows = self._derive(length=4)

        self.assertEqual(
            [("MINUS", "GUUG"), ("PLUS", "CAAC")],
            [
                (row["locus_tag"], row["three_prime_sequence_rna"])
                for row in rows
            ],
        )
        self.assertEqual([4, 4], [row["feature_length"] for row in rows])

    def test_partial_16s_product_is_an_error_naming_the_locus(self) -> None:
        self.fasta.write_text(">seq\nACGTACGT\n", encoding="utf-8")
        self.gff.write_text(
            gff_document(
                gff_row("seq", 1, 4, "+", "COMPLETE"),
                gff_row(
                    "seq", 5, 8, "+", "PARTIAL", "16S ribosomal RNA, partial"
                ),
            ),
            encoding="utf-8",
        )

        with self.assertRaisesRegex(rrna.release.ReleaseError, "PARTIAL.*not complete"):
            self._derive()

    def test_no_16s_feature_is_an_error(self) -> None:
        self.fasta.write_text(">seq\nACGTACGT\n", encoding="utf-8")
        self.gff.write_text(
            gff_document(gff_row("seq", 1, 4, "+", "OTHER", "23S ribosomal RNA")),
            encoding="utf-8",
        )

        with self.assertRaisesRegex(rrna.release.ReleaseError, "no annotated 16S"):
            self._derive()

    def test_missing_locus_tag_is_an_error_naming_location(self) -> None:
        self.fasta.write_text(">seq\nACGTACGT\n", encoding="utf-8")
        self.gff.write_text(
            gff_document(gff_row("seq", 1, 4, "+", None)),
            encoding="utf-8",
        )

        with self.assertRaisesRegex(
            rrna.release.ReleaseError,
            "seq:1-4: 16S rRNA feature is missing locus_tag",
        ):
            self._derive()

    def test_invalid_strand_is_an_error_naming_the_locus(self) -> None:
        self.fasta.write_text(">seq\nACGTACGT\n", encoding="utf-8")
        self.gff.write_text(
            gff_document(gff_row("seq", 1, 4, ".", "LOC")),
            encoding="utf-8",
        )

        with self.assertRaisesRegex(rrna.release.ReleaseError, "LOC.*invalid strand"):
            self._derive()

    def test_sequence_before_fasta_header_is_an_error(self) -> None:
        self.fasta.write_text("ACGT\n", encoding="utf-8")
        self.gff.write_text(
            gff_document(gff_row("seq", 1, 4, "+", "LOC")),
            encoding="utf-8",
        )

        with self.assertRaisesRegex(
            rrna.release.ReleaseError, "precedes the first FASTA header"
        ):
            self._derive()

    def test_fasta_header_without_identifier_is_an_error_naming_file(self) -> None:
        self.gff.write_text(
            gff_document(gff_row("seq", 1, 4, "+", "LOC")),
            encoding="utf-8",
        )
        for header in (">", ">   "):
            with self.subTest(header=header):
                self.fasta.write_text(f"{header}\nACGT\n", encoding="utf-8")
                with self.assertRaisesRegex(
                    rrna.release.ReleaseError,
                    "genome.fna: FASTA header has no identifier",
                ):
                    self._derive()

    def test_duplicate_fasta_identifier_is_an_error(self) -> None:
        self.fasta.write_text(">seq\nACGT\n>seq duplicate\nACGT\n", encoding="utf-8")
        self.gff.write_text(
            gff_document(gff_row("seq", 1, 4, "+", "LOC")),
            encoding="utf-8",
        )

        with self.assertRaisesRegex(
            rrna.release.ReleaseError, "duplicate FASTA identifier seq"
        ):
            self._derive()

    def test_invalid_feature_relationships_are_errors(self) -> None:
        self.fasta.write_text(">seq\nACGTACGT\n", encoding="utf-8")
        cases = (
            (
                gff_document(gff_row("missing", 1, 4, "+", "LOC")),
                3,
                "absent from",
            ),
            (
                gff_document(gff_row("seq", 1, 4, "+", "LOC"), length=9),
                3,
                "length differs",
            ),
            (
                gff_document(gff_row("seq", 1, 4, "+", "LOC")),
                5,
                "exceeds feature length",
            ),
            (
                gff_document(gff_row("seq", 1, 4, "+", "LOC")),
                0,
                "positive integer",
            ),
            (
                gff_document(gff_row("seq", 0, 4, "+", "LOC")),
                3,
                "invalid coordinates",
            ),
            (
                gff_document(gff_row("seq", 4, 3, "+", "LOC")),
                3,
                "invalid coordinates",
            ),
        )
        for document, length, message in cases:
            with self.subTest(message=message):
                self.gff.write_text(document, encoding="utf-8")
                with self.assertRaisesRegex(rrna.release.ReleaseError, message):
                    self._derive(length)


class PinnedContextTest(unittest.TestCase):
    """Exercises every provenance failure retained by the command."""

    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.raw = self.root / "data/raw"
        self.manifest_path = self.root / "data/manifest/release.json"
        self.raw.mkdir(parents=True)
        self.manifest_path.parent.mkdir(parents=True)
        self.gff = self.raw / "annotation.gff"
        self.fasta = self.raw / "genome.fna"
        self.gff.write_text(
            gff_document(gff_row("seq", 1, 8, "+", "LOC")),
            encoding="utf-8",
        )
        self.fasta.write_text(">seq\nACGTACGT\n", encoding="utf-8")
        self._write_manifest()

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def _entry(self, role: str, path: Path) -> dict[str, object]:
        relative = path.relative_to(self.root).as_posix()
        return {
            "role": role,
            "localPath": relative,
            "directUrl": f"https://example.test/release/{path.name}",
            "byteSize": path.stat().st_size,
            "md5": rrna.release.file_md5(path),
            "retention": "test-only",
            "redistribution": "test-only",
        }

    def _write_manifest(
        self,
        *,
        source_id: str = "utex2973-refseq",
        roles: tuple[str, ...] = ("gff-annotation", "genome-fasta"),
    ) -> None:
        paths = {
            "gff-annotation": self.gff,
            "genome-fasta": self.fasta,
        }
        source = {
            "id": source_id,
            "organism": "Test organism",
            "taxid": 1,
            "assemblyAccession": ASSEMBLY,
            "assemblyName": "test",
            "annotationRelease": ANNOTATION,
            "annotationDate": "2026-01-01",
            "pgapVersion": "test",
            "baseUrl": "https://example.test/release",
            "files": [self._entry(role, paths[role]) for role in roles],
        }
        manifest = {
            "schemaVersion": 1,
            "releaseId": "test-release",
            "retrievedDate": "2026-01-01",
            "sources": [source],
        }
        self.manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    def test_resolves_default_paths_and_byte_identical_overrides(self) -> None:
        self.assertEqual(
            (self.gff.resolve(), self.fasta.resolve(), ASSEMBLY, ANNOTATION),
            rrna.pinned_context(self.manifest_path),
        )
        copies = self.root / "copies"
        copies.mkdir()
        gff_copy = copies / "copy.gff"
        fasta_copy = copies / "copy.fna"
        gff_copy.write_bytes(self.gff.read_bytes())
        fasta_copy.write_bytes(self.fasta.read_bytes())

        self.assertEqual(
            (gff_copy, fasta_copy, ASSEMBLY, ANNOTATION),
            rrna.pinned_context(self.manifest_path, gff_copy, fasta_copy),
        )

    def test_missing_pinned_input_is_an_error(self) -> None:
        self.gff.unlink()

        with self.assertRaisesRegex(rrna.release.ReleaseError, "missing"):
            rrna.pinned_context(self.manifest_path)

    def test_byte_size_mismatch_is_an_error(self) -> None:
        self.fasta.write_text(">seq\nACGTACGTA\n", encoding="utf-8")

        with self.assertRaisesRegex(rrna.release.ReleaseError, "byte size"):
            rrna.pinned_context(self.manifest_path)

    def test_md5_mismatch_is_an_error(self) -> None:
        self.fasta.write_text(">seq\nTCGTACGT\n", encoding="utf-8")

        with self.assertRaisesRegex(rrna.release.ReleaseError, "MD5"):
            rrna.pinned_context(self.manifest_path)

    def test_gff_assembly_accession_mismatch_is_an_error(self) -> None:
        self.gff.write_text(
            gff_document(gff_row("seq", 1, 8, "+", "LOC")).replace(
                f"NCBI_Assembly:{ASSEMBLY}", "NCBI_Assembly:GCF_WRONG.1"
            ),
            encoding="utf-8",
        )
        self._write_manifest()

        with self.assertRaisesRegex(rrna.release.ReleaseError, "assembly accession"):
            rrna.pinned_context(self.manifest_path)

    def test_gff_annotation_release_mismatch_is_an_error(self) -> None:
        self.gff.write_text(
            gff_document(gff_row("seq", 1, 8, "+", "LOC")).replace(
                f"NCBI RefSeq {ANNOTATION}", "NCBI RefSeq WRONG"
            ),
            encoding="utf-8",
        )
        self._write_manifest()

        with self.assertRaisesRegex(rrna.release.ReleaseError, "annotation release"):
            rrna.pinned_context(self.manifest_path)

    def test_manifest_without_source_is_an_error(self) -> None:
        self._write_manifest(source_id="other-refseq")

        with self.assertRaisesRegex(rrna.release.ReleaseError, "has no utex2973"):
            rrna.pinned_context(self.manifest_path)

    def test_manifest_without_required_role_is_an_error(self) -> None:
        cases = (
            (("genome-fasta",), "gff-annotation"),
            (("gff-annotation",), "genome-fasta"),
        )
        for roles, missing in cases:
            with self.subTest(missing=missing):
                self._write_manifest(roles=roles)
                with self.assertRaisesRegex(rrna.release.ReleaseError, missing):
                    rrna.pinned_context(self.manifest_path)


class OutputTest(unittest.TestCase):
    """Checks serialization and command-line forwarding."""

    def setUp(self) -> None:
        self.rows = [
            {
                "assembly_accession": "GCF_TEST.1",
                "annotation_release": "release",
                "locus_tag": "LOC",
                "replicon_accession": "SEQ",
                "start": 1,
                "end": 4,
                "strand": "+",
                "feature_length": 4,
                "terminal_length": 3,
                "three_prime_sequence_rna": "CGU",
            }
        ]

    def test_tsv_output_pins_the_complete_line_and_column_order(self) -> None:
        output = io.StringIO()
        rrna.write_rows(self.rows, "tsv", output)
        self.assertEqual(
            "\t".join(rrna.OUTPUT_FIELDS)
            + "\nGCF_TEST.1\trelease\tLOC\tSEQ\t1\t4\t+\t4\t3\tCGU\n",
            output.getvalue(),
        )

    def test_json_output(self) -> None:
        output = io.StringIO()
        rrna.write_rows(self.rows, "json", output)
        self.assertEqual(self.rows, json.loads(output.getvalue()))

    def test_unknown_output_format_is_an_error(self) -> None:
        with self.assertRaisesRegex(rrna.release.ReleaseError, "unknown output format"):
            rrna.write_rows(self.rows, "xml", io.StringIO())

    def test_main_reports_input_error(self) -> None:
        error = io.StringIO()
        with contextlib.redirect_stderr(error):
            result = rrna.main(["--manifest", "does-not-exist.json"])
        self.assertEqual(1, result)
        self.assertIn("ERROR:", error.getvalue())

    def test_script_entry_point_exits_with_main_result(self) -> None:
        error = io.StringIO()
        with mock.patch.object(
            sys, "argv", ["rrna_3prime.py", "--manifest", "does-not-exist.json"]
        ):
            with contextlib.redirect_stderr(error):
                with self.assertRaises(SystemExit) as raised:
                    runpy.run_path(rrna.__file__, run_name="__main__")
        self.assertEqual(1, raised.exception.code)
        self.assertIn("ERROR:", error.getvalue())

    def test_main_passes_all_inputs_and_writes_requested_format(self) -> None:
        output = io.StringIO()
        context = (
            Path("annotation.gff"),
            Path("genome.fna"),
            "GCF_TEST.1",
            "release",
        )
        with mock.patch.object(
            rrna, "pinned_context", return_value=context
        ) as pinned_context:
            with mock.patch.object(
                rrna, "derive_rows", return_value=self.rows
            ) as derive_rows:
                with contextlib.redirect_stdout(output):
                    result = rrna.main(
                        [
                            "--manifest",
                            "custom.json",
                            "--gff",
                            "custom.gff",
                            "--fasta",
                            "custom.fna",
                            "--format",
                            "json",
                            "--length",
                            "4",
                        ]
                    )
        self.assertEqual(0, result)
        self.assertEqual(self.rows, json.loads(output.getvalue()))
        pinned_context.assert_called_once_with(
            Path("custom.json"),
            Path("custom.gff"),
            Path("custom.fna"),
        )
        derive_rows.assert_called_once_with(*context, 4)


class PinnedAssemblyIntegrationTest(unittest.TestCase):
    """Checks the repository's checksum-pinned annotation and genome copies."""

    def test_annotated_copies_have_the_same_terminal_sequence(self) -> None:
        raw_dir_text = os.environ.get("UTEX2973_RAW_DIR")
        raw_dir = Path(raw_dir_text) if raw_dir_text else ROOT / "data/raw"
        gff_path = raw_dir / PINNED_GFF
        fasta_path = raw_dir / PINNED_FASTA
        if not gff_path.is_file() or not fasta_path.is_file():
            self.skipTest(
                "pinned inputs are absent; set UTEX2973_RAW_DIR to their directory"
            )

        gff_path, fasta_path, assembly, annotation = rrna.pinned_context(
            MANIFEST_PATH,
            gff_path,
            fasta_path,
        )
        rows = rrna.derive_rows(gff_path, fasta_path, assembly, annotation)

        self.assertEqual(
            [
                ("M744_RS03180", 603902, 605390, "+"),
                ("M744_RS13280", 2688678, 2690166, "-"),
            ],
            [
                (row["locus_tag"], row["start"], row["end"], row["strand"])
                for row in rows
            ],
        )
        self.assertEqual({1489}, {row["feature_length"] for row in rows})
        self.assertEqual(
            {"ACCUCCUUU"},
            {row["three_prime_sequence_rna"] for row in rows},
            "annotated 16S copies have different 3' terminal sequences",
        )


if __name__ == "__main__":
    unittest.main()
