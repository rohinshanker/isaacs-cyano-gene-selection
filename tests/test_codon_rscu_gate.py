"""The contract validator's independent check of the per-gene RSCU payload."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from validate_contract import Report, validate_codon_rscu  # noqa: E402

GENES = [{"id": "g1"}, {"id": "g2"}]
META = {"rscuOrder": ["TTT", "TTC", "TTA"]}
PAYLOAD = {
    "schemaVersion": 1,
    "geneIds": ["g1", "g2"],
    "rscu": [[1.5, 0.5, 0.0], [0.0, 2.0, 1.0]],
}


def run(tmp_path, meta=META, genes=GENES, payload=PAYLOAD):
    if payload is not None:
        (tmp_path / "codon_rscu.json").write_text(json.dumps(payload), encoding="utf-8")
    report = Report()
    validate_codon_rscu(str(tmp_path), meta, genes, report)
    return report


def test_a_complete_payload_passes_every_check(tmp_path):
    report = run(tmp_path)
    assert report.failures == []
    assert len(report.passes) == 7


def test_a_missing_or_malformed_payload_fails(tmp_path):
    report = run(tmp_path, payload=None)
    assert any("codon_rscu.json exists" in f for f in report.failures)
    report = run(tmp_path, payload=[1])
    assert any("is an object" in f for f in report.failures)
    report = run(tmp_path, payload={**PAYLOAD, "schemaVersion": 2})
    assert any("declares schema 1" in f for f in report.failures)


def test_a_payload_built_from_another_gene_file_is_refused(tmp_path):
    stale = {**PAYLOAD, "geneIds": ["g2", "g1"]}
    assert any("genes.json order" in f for f in run(tmp_path, payload=stale).failures)


def test_the_vector_count_and_column_count_are_checked(tmp_path):
    short = {**PAYLOAD, "rscu": PAYLOAD["rscu"][:1]}
    failures = run(tmp_path, payload=short).failures
    assert any("one RSCU vector per gene: 1 for 2 genes" in f for f in failures)
    # A wrong vector count stops the run, so no later check reports on it.
    assert len(failures) == 1

    narrow = {**PAYLOAD, "rscu": [[1.5, 0.5], [0.0, 2.0]]}
    assert any("one column per meta.rscuOrder codon (3)" in f
               for f in run(tmp_path, payload=narrow).failures)

    unordered = run(tmp_path, meta={}, payload=PAYLOAD).failures
    assert any("one column per meta.rscuOrder codon (0)" in f for f in unordered)


def test_only_a_finite_non_negative_number_or_null_is_a_value(tmp_path):
    for bad in (-0.1, float("inf"), True, "1.0"):
        payload = {**PAYLOAD, "rscu": [[1.5, 0.5, bad], [0.0, 2.0, 1.0]]}
        assert any("finite non-negative number or null" in f
                   for f in run(tmp_path, payload=payload).failures), bad


def test_a_null_is_permitted_as_a_value_but_not_as_coverage(tmp_path):
    payload = {**PAYLOAD, "rscu": [[1.5, 0.5, None], [0.0, 2.0, 1.0]]}
    failures = run(tmp_path, payload=payload).failures
    assert not any("finite non-negative number or null" in f for f in failures)
    assert any("complete RSCU vector: 1 of 2" in f for f in failures)


def test_a_vector_left_behind_in_genes_json_fails(tmp_path):
    genes = [{"id": "g1", "rscu": [1.5, 0.5, 0.0]}, {"id": "g2"}]
    failures = run(tmp_path, genes=genes).failures
    assert any("no per-gene rscu vector rides in genes.json" in f for f in failures)
