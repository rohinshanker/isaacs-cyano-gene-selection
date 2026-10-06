"""The contract validator's independent check of the expression-layer payload."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from validate_contract import Report, validate_expression_layers  # noqa: E402

GENES = [{"id": "g1", "expression": 1.0}, {"id": "g2", "expression": None}]
META = {
    "expressionSources": [
        {"metricKey": "expression", "payload": "genes.json", "coverage": {"withValue": 1}},
        {"metricKey": "exprA", "payload": "expression_layers.json", "coverage": {"withValue": 1}},
    ]
}
PAYLOAD = {"schemaVersion": 1, "geneIds": ["g1", "g2"], "layers": {"exprA": [None, 2.5]}}


def run(tmp_path, meta=META, genes=GENES, payload=PAYLOAD):
    if payload is not None:
        (tmp_path / "expression_layers.json").write_text(json.dumps(payload), encoding="utf-8")
    report = Report()
    validate_expression_layers(str(tmp_path), meta, genes, report)
    return report


def test_a_complete_payload_passes_every_check(tmp_path):
    report = run(tmp_path)
    assert report.failures == []
    assert len(report.passes) == 7


def test_no_layer_source_means_no_payload(tmp_path):
    meta = {"expressionSources": META["expressionSources"][:1]}
    assert run(tmp_path, meta=meta, payload=None).failures == []
    report = run(tmp_path, meta=meta)
    assert any("absent when no source declares it" in f for f in report.failures)


def test_a_missing_or_malformed_payload_fails(tmp_path):
    report = run(tmp_path, payload=None)
    assert any("expression_layers.json exists" in f for f in report.failures)
    report = run(tmp_path, payload=[1])
    assert any("is an object" in f for f in report.failures)


def test_the_join_and_the_values_are_checked(tmp_path):
    stale = {**PAYLOAD, "geneIds": ["g2", "g1"]}
    assert any("genes.json order" in f for f in run(tmp_path, payload=stale).failures)

    extra = {**PAYLOAD, "layers": {"exprA": [None, 2.5], "exprZ": [1, 1]}}
    assert any("exactly the declared layer metrics" in f for f in run(tmp_path, payload=extra).failures)

    short = {**PAYLOAD, "layers": {"exprA": [2.5]}}
    assert any("not one entry per gene" in f for f in run(tmp_path, payload=short).failures)

    negative = {**PAYLOAD, "layers": {"exprA": [-1, 2.5]}}
    failures = run(tmp_path, payload=negative).failures
    assert any("invalid values" in f and "coverage says 1" in f for f in failures)

    boolean = {**PAYLOAD, "layers": {"exprA": [None, True]}}
    assert any("invalid values" in f for f in run(tmp_path, payload=boolean).failures)


def test_a_signed_layer_may_hold_negative_values(tmp_path):
    meta = {"expressionSources": [
        {"metricKey": "fitA", "payload": "expression_layers.json", "coverage": {"withValue": 2}, "signed": True},
    ]}
    payload = {"schemaVersion": 1, "geneIds": ["g1", "g2"], "layers": {"fitA": [-2.5, 0.5]}}
    genes = [{"id": "g1"}, {"id": "g2"}]
    assert run(tmp_path, meta=meta, genes=genes, payload=payload).failures == []
    unsigned = {"expressionSources": [{**meta["expressionSources"][0], "signed": False}]}
    assert any("invalid values" in f for f in run(tmp_path, meta=unsigned, genes=genes, payload=payload).failures)


def test_payload_names_and_gene_fields_are_checked(tmp_path):
    unnamed = {"expressionSources": [{"metricKey": "exprA", "coverage": {"withValue": 1}}]}
    failures = run(tmp_path, meta=unnamed, payload=None).failures
    assert any("names its payload file" in f for f in failures)

    genes = [{"id": "g1"}, {"id": "g2", "exprA": 2.5}]
    failures = run(tmp_path, genes=genes).failures
    assert any("has its field on every gene" in f for f in failures)
    assert any("no layer-payload expression metric rides in genes.json" in f for f in failures)
