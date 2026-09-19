"""Integrity checks for the retained TypeSafe CAI-reference audit."""

from __future__ import annotations

import csv
import hashlib
import json
import unittest
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
AUDIT_DIR = ROOT / "data/audits/cai-reference-set"


def load_json(path: Path):
    """Read one UTF-8 JSON artifact."""
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    """Return a file's lowercase SHA-256 digest."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical_sha256(value) -> str:
    """Hash a value using the audit's canonical JSON encoding."""
    encoded = json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


class CaiAuditArtifactTest(unittest.TestCase):
    """Keep the compact audit bundle aligned with the published reference set."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = load_json(AUDIT_DIR / "manifest.json")
        cls.rubric = load_json(AUDIT_DIR / "rubric.json")
        cls.evaluation = load_json(AUDIT_DIR / "evaluation-set.json")
        cls.summary = load_json(AUDIT_DIR / "summary.json")
        cls.review = load_json(AUDIT_DIR / "manual-disagreement-review.json")
        cls.results = [
            json.loads(line)
            for line in (AUDIT_DIR / "results.jsonl").read_text(
                encoding="utf-8"
            ).splitlines()
        ]

    def test_hashes_schema_and_complete_service_coverage(self) -> None:
        """Pin the blind inputs, rubric, labels, model, and typed output schema."""
        self.assertEqual(
            self.manifest["rubric_sha256"], sha256(AUDIT_DIR / "rubric.json")
        )
        self.assertEqual(
            self.manifest["evaluation_set_sha256"],
            sha256(AUDIT_DIR / "evaluation-set.json"),
        )
        self.assertEqual(
            self.manifest["results_sha256"], sha256(AUDIT_DIR / "results.jsonl")
        )
        self.assertEqual(
            self.manifest["summary_sha256"], sha256(AUDIT_DIR / "summary.json")
        )
        self.assertEqual(
            self.manifest["disagreements_sha256"],
            sha256(AUDIT_DIR / "disagreements.tsv"),
        )
        self.assertEqual(
            self.manifest["manual_review_sha256"],
            sha256(AUDIT_DIR / "manual-disagreement-review.json"),
        )
        self.assertEqual(self.manifest["candidate_count"], len(self.results))
        self.assertEqual(2715, len({row["locus_tag"] for row in self.results}))

        blind = [
            {
                "locus_tag": row["locus_tag"],
                "gene_symbol": row["gene_symbol"],
                "product": row["product"],
            }
            for row in self.results
        ]
        current_genes = load_json(ROOT / "site/data/genes.json")
        current_blind = [
            {
                "locus_tag": gene["id"],
                "gene_symbol": gene.get("name") or "",
                "product": gene.get("product") or "",
            }
            for gene in current_genes
        ]
        self.assertEqual(current_blind, blind)
        self.assertEqual(
            self.manifest["blind_candidates_sha256"], canonical_sha256(blind)
        )

        labels = set(self.rubric["question"]["criteria"])
        model = self.manifest["requested_model"]
        for row in self.results:
            self.assertEqual(model, row["response_model"])
            self.assertIn(row["choice"], labels)
            self.assertEqual(labels, set(row["probabilities"]))
            self.assertAlmostEqual(
                1.0, sum(row["probabilities"].values()), delta=0.02
            )
            self.assertGreaterEqual(row["confidence"], 0.0)
            self.assertLessEqual(row["confidence"], 1.0)

        service = self.summary["service_coverage"]
        self.assertEqual(len(self.results), service["candidate_count"])
        self.assertEqual(len(self.results), service["audited_candidates"])
        self.assertEqual({model: len(self.results)}, service["returned_models_by_batch"])
        self.assertEqual(
            Counter(row["choice"] for row in self.results),
            Counter(self.summary["label_counts"]),
        )

    def test_evaluation_disagreements_and_published_membership_match(self) -> None:
        """Reconcile the declared sample, all disagreements, and 71 published loci."""
        by_locus = {row["locus_tag"]: row for row in self.results}
        for locus_tag, expected in self.evaluation["labels"].items():
            self.assertEqual(expected, by_locus[locus_tag]["choice"])

        comparison = self.summary["deterministic_comparison"]
        agreements = sum(row["membership_agreement"] for row in self.results)
        mismatches = {
            row["locus_tag"]
            for row in self.results
            if not row["membership_agreement"]
        }
        selected = {
            row["locus_tag"]
            for row in self.results
            if row["deterministic_selected"]
        }
        self.assertEqual(comparison["membership_agreements"], agreements)
        self.assertEqual(comparison["membership_disagreements"], len(mismatches))
        self.assertEqual(comparison["deterministic_selected"], len(selected))

        with (AUDIT_DIR / "disagreements.tsv").open(
            encoding="utf-8", newline=""
        ) as handle:
            disagreement_rows = list(csv.DictReader(handle, delimiter="\t"))
        self.assertEqual(mismatches, {row["locus_tag"] for row in disagreement_rows})
        self.assertEqual(
            mismatches, {row["locus_tag"] for row in self.review["rows"]}
        )

        meta = load_json(ROOT / "site/data/meta.json")
        self.assertEqual(set(meta["caiReferenceSet"]["locusTags"]), selected)
        self.assertEqual(meta["caiReferenceSet"]["n"], len(selected))


if __name__ == "__main__":
    unittest.main()
