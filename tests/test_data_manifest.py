"""Tests for the content manifest of the published site data."""

from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import build_data_manifest as manifest_tool  # noqa: E402
import validate_contract  # noqa: E402

SITE_DATA = ROOT / "site/data"


def populate(directory: Path) -> None:
    (directory / "genes.json").write_text('[{"id": "a"}]', encoding="utf-8")
    (directory / "meta.json").write_text('{"schemaVersion": 1}', encoding="utf-8")
    (directory / "notes.txt").write_text("not published data", encoding="utf-8")


class BuildDataManifestTest(unittest.TestCase):
    def test_build_describes_every_json_file_and_nothing_else(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            populate(directory)
            manifest = manifest_tool.build_manifest(directory)
            self.assertEqual(manifest["schemaVersion"], 1)
            self.assertEqual(sorted(manifest["files"]), ["genes.json", "meta.json"])
            genes = (directory / "genes.json").read_bytes()
            self.assertEqual(manifest["files"]["genes.json"], {
                "bytes": len(genes),
                "sha256": hashlib.sha256(genes).hexdigest(),
            })

    def test_the_manifest_never_describes_itself(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            populate(directory)
            manifest_tool.write_manifest(directory)
            again = manifest_tool.build_manifest(directory)
            self.assertNotIn(manifest_tool.MANIFEST_NAME, again["files"])
            # Rebuilding over an existing manifest is therefore a fixed point.
            first = (directory / manifest_tool.MANIFEST_NAME).read_text(encoding="utf-8")
            manifest_tool.write_manifest(directory)
            self.assertEqual(
                (directory / manifest_tool.MANIFEST_NAME).read_text(encoding="utf-8"), first)

    def test_an_empty_directory_is_refused(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(manifest_tool.DataManifestError, "no JSON files"):
                manifest_tool.build_manifest(Path(tmp))

    def test_check_passes_on_a_fresh_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            populate(directory)
            manifest_tool.write_manifest(directory)
            manifest_tool.check_manifest(directory)

    def test_check_names_a_changed_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            populate(directory)
            manifest_tool.write_manifest(directory)
            # One byte changes and the size does not: only the digest can see it.
            (directory / "genes.json").write_text('[{"id": "b"}]', encoding="utf-8")
            with self.assertRaisesRegex(manifest_tool.DataManifestError,
                                        "genes.json changed since the manifest was built"):
                manifest_tool.check_manifest(directory)

    def test_check_names_an_unlisted_and_a_missing_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            populate(directory)
            manifest_tool.write_manifest(directory)
            (directory / "extra.json").write_text("{}", encoding="utf-8")
            (directory / "meta.json").unlink()
            with self.assertRaises(manifest_tool.DataManifestError) as raised:
                manifest_tool.check_manifest(directory)
            message = str(raised.exception)
            self.assertIn("extra.json is published but not listed", message)
            self.assertIn("meta.json is listed but not published", message)

    def test_check_refuses_a_missing_or_malformed_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            populate(directory)
            with self.assertRaisesRegex(manifest_tool.DataManifestError, "missing"):
                manifest_tool.check_manifest(directory)
            target = directory / manifest_tool.MANIFEST_NAME
            target.write_text("{not json", encoding="utf-8")
            with self.assertRaisesRegex(manifest_tool.DataManifestError, "not valid JSON"):
                manifest_tool.check_manifest(directory)
            target.write_text("[]", encoding="utf-8")
            with self.assertRaisesRegex(manifest_tool.DataManifestError, "schemaVersion is not 1"):
                manifest_tool.check_manifest(directory)
            target.write_text('{"schemaVersion": 1, "files": []}', encoding="utf-8")
            with self.assertRaisesRegex(manifest_tool.DataManifestError, "files is not an object"):
                manifest_tool.check_manifest(directory)

    def test_main_reports_success_and_failure_by_exit_code(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            populate(directory)
            self.assertEqual(manifest_tool.main(["check", "--data-dir", str(directory)]), 1)
            self.assertEqual(manifest_tool.main(["build", "--data-dir", str(directory)]), 0)
            self.assertEqual(manifest_tool.main(["check", "--data-dir", str(directory)]), 0)
            self.assertEqual(manifest_tool.main(["build", "--data-dir", str(directory / "x")]), 1)

    def test_the_published_manifest_matches_the_published_data(self) -> None:
        """The cache key is only safe while this holds, so it gates every deploy."""
        manifest_tool.check_manifest(SITE_DATA)
        published = json.loads(
            (SITE_DATA / manifest_tool.MANIFEST_NAME).read_text(encoding="utf-8"))
        for required in ("meta.json", "genes.json"):
            self.assertIn(required, published["files"])


class ContractGateTest(unittest.TestCase):
    """The contract validator recomputes the manifest without the builder."""

    def run_gate(self, directory: Path) -> validate_contract.Report:
        report = validate_contract.Report()
        validate_contract.validate_data_manifest(str(directory), report)
        return report

    def test_the_gate_passes_a_fresh_manifest_and_the_published_one(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            populate(directory)
            manifest_tool.write_manifest(directory)
            self.assertEqual(self.run_gate(directory).failures, [])
        self.assertEqual(self.run_gate(SITE_DATA).failures, [])

    def test_the_gate_names_every_file_that_fell_out_of_date(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            populate(directory)
            manifest_tool.write_manifest(directory)
            (directory / "genes.json").write_text('[{"id": "b"}]', encoding="utf-8")
            (directory / "extra.json").write_text("{}", encoding="utf-8")
            failures = self.run_gate(directory).failures
            self.assertEqual(len(failures), 1)
            self.assertIn("['extra.json', 'genes.json']", failures[0])
            self.assertIn("tools/build_data_manifest.py build", failures[0])

    def test_the_gate_fails_a_missing_or_malformed_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            populate(directory)
            self.assertTrue(any("data-manifest.json exists" in failure
                                for failure in self.run_gate(directory).failures))
            target = directory / manifest_tool.MANIFEST_NAME
            for content in ("[]", '{"schemaVersion": 2, "files": {}}',
                            '{"schemaVersion": 1, "files": []}'):
                target.write_text(content, encoding="utf-8")
                failures = self.run_gate(directory).failures
                self.assertTrue(any("declares schema 1" in failure for failure in failures),
                                content)
            target.write_text("{not json", encoding="utf-8")
            self.assertTrue(any("parses" in failure
                                for failure in self.run_gate(directory).failures))


if __name__ == "__main__":
    unittest.main()
