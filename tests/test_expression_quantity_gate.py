"""The contract validator's independent check of the declared-quantity contract.

The validator re-states the quantity table rather than importing the pipeline's,
so these tests are what holds the two statements together: a pipeline that
published the wrong meaning for a column has to fail here even when its own
tests agree with it.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
sys.path.insert(0, str(ROOT / "scripts"))

import expression_table  # noqa: E402
from validate_contract import (  # noqa: E402
    EXPRESSION_QUANTITIES,
    Report,
    quantity_value_problem,
    validate_expression_layers,
    validate_expression_quantities,
)

GENES = [{"id": "g1"}, {"id": "g2"}]


def source(quantity, platform="RNA-seq", metric_key="mQ", **overrides):
    """A meta.expressionSources entry as the pipeline publishes it."""
    facts = expression_table.quantity_facts("transcriptomics", platform, quantity, metric_key)
    flags = expression_table.declared_flags(quantity)
    return {
        "id": metric_key.upper(),
        "metricKey": metric_key,
        "payload": "expression_layers.json",
        "coverage": {"withValue": 2, "total": 2},
        "record": {"dataType": "transcriptomics", "platform": platform},
        **facts,
        **flags,
        **overrides,
    }


def run(sources, genes=GENES, metrics=None):
    report = Report()
    meta = {"expressionSources": sources, "metrics": metrics or {}}
    validate_expression_quantities(meta, genes, report)
    return report


def test_the_pipelines_published_facts_match_the_validators_own_table():
    """Every quantity, on every platform it is defined for, agrees end to end."""
    assert set(EXPRESSION_QUANTITIES) == set(expression_table.QUANTITIES)
    for quantity, contract in EXPRESSION_QUANTITIES.items():
        spec = expression_table.QUANTITIES[quantity]
        assert contract["column"] == spec.column, quantity
        assert contract["family"] == spec.family, quantity
        assert contract["pools"] == spec.pools, quantity
        assert contract["signed"] == spec.signed, quantity
        assert contract["logScale"] == spec.log_scale, quantity
        assert set(contract["platforms"]) == set(spec.platforms), quantity
        for platform, (kind, label) in contract["platforms"].items():
            assert (spec.kind(platform), spec.label(platform)) == (kind, label), quantity
        assert contract["bounds"] == {
            "nonnegative": spec.nonnegative,
            "integral": spec.integral,
            "unitInterval": spec.unit_interval,
        }, quantity
    # And the two implementations of "is this value admissible" agree.
    for quantity in EXPRESSION_QUANTITIES:
        for value in (-1, 0, 0.5, 1, 1.5, 7, 7.5):
            mine = quantity_value_problem(quantity, value) is None
            theirs = expression_table.value_problem(quantity, float(value)) is None
            assert mine == theirs, (quantity, value)


def test_every_declared_quantity_passes_when_the_pipeline_resolved_it():
    sources = [source(q, metric_key=f"m{i}") for i, q in enumerate(EXPRESSION_QUANTITIES)]
    metrics = {
        s["metricKey"]: {"family": s["quantityFamily"]} for s in sources
    }
    report = run(sources, metrics=metrics)
    assert report.failures == []


def test_no_source_declaring_a_quantity_is_reported_as_a_pass():
    report = run([{"id": "LEGACY", "metricKey": "expression", "payload": "genes.json"}])
    assert report.failures == []
    assert any("no expression source declares" in p for p in report.passes)


def test_a_hand_edited_fact_is_caught():
    """meta.json is published data; the gate does not trust its own pipeline."""
    for field, wrong in (
        ("quantityKind", "abundance"),
        ("quantityLabel", "P-value"),
        ("quantityFamily", "Expression"),
        ("quantityPools", True),
        ("quantityBounds", {"nonnegative": True, "integral": False, "unitInterval": False}),
        ("signed", True),
        ("logScale", True),
    ):
        report = run([source("p_value") | {field: wrong}])
        assert any(field in f for f in report.failures), field


def test_an_unknown_or_misplaced_quantity_fails():
    assert any("unknown quantity" in f for f in run([source("p_value") | {"quantity": "tpm"}]).failures)
    misplaced = source("read_count")
    misplaced["record"] = {"dataType": "transcriptomics", "platform": "array"}
    assert any("not defined for 'array'" in f for f in run([misplaced]).failures)
    wrong_type = source("rpkm")
    wrong_type["record"] = {"dataType": "proteomics", "platform": "RNA-seq"}
    assert any("transcriptomics quantity" in f for f in run([wrong_type]).failures)


def test_a_fold_change_a_p_value_or_a_ratio_filed_as_an_abundance_fails():
    """The family is the field that decides, so the gate checks it twice over."""
    for quantity in ("log2_fold_change", "edger_log2_fold_change", "p_value",
                     "translation_efficiency_log2_fold_change"):
        report = run([source(quantity) | {"quantityFamily": "Expression"}])
        assert any("filed as an abundance" in f for f in report.failures), quantity
    # An RPKM and a read count are abundances and may say so.
    assert run([source("rpkm"), source("read_count", metric_key="mC")]).failures == []


def test_two_quantities_collapsing_into_one_type_metric_fails():
    collides = source("p_value", metric_key="mP2")
    collides["quantityKind"] = EXPRESSION_QUANTITIES["rpkm"]["platforms"]["RNA-seq"][0]
    report = run([source("rpkm"), collides])
    assert any("collapse into one type metric" in f for f in report.failures)
    # The same quantity on both platforms is two type metrics, not a collision.
    assert run([source("rpkm"), source("rpkm", "Ribo-seq", metric_key="mR")]).failures == []


def test_the_metrics_family_must_match_the_quantitys():
    report = run([source("p_value")], metrics={"mQ": {"family": "Expression"}})
    assert any("sits in family" in f for f in report.failures)


def test_a_genes_json_quantity_column_is_checked_against_its_bounds():
    counts = source("read_count", payload="genes.json")
    good = [{"id": "g1", "mQ": 4}, {"id": "g2", "mQ": None}]
    assert run([counts], genes=good).failures == []
    bad = [{"id": "g1", "mQ": 4.5}, {"id": "g2", "mQ": None}]
    assert any("not a whole count" in f for f in run([counts], genes=bad).failures)


def test_a_quantity_layer_is_checked_against_its_own_bounds(tmp_path):
    """The layer check reads the quantity's bounds, not just the sign."""
    def layers(column, quantity, platform="RNA-seq"):
        entry = source(quantity, platform, metric_key="mL")
        entry["coverage"] = {"withValue": sum(v is not None for v in column), "total": 2}
        payload = {"schemaVersion": 1, "geneIds": ["g1", "g2"], "layers": {"mL": column}}
        (tmp_path / "expression_layers.json").write_text(json.dumps(payload), encoding="utf-8")
        report = Report()
        validate_expression_layers(
            str(tmp_path), {"expressionSources": [entry]}, GENES, report)
        return report

    assert layers([0, 931], "read_count").failures == []
    assert any("read_count contract refuses" in f and "not a whole count" in f
               for f in layers([0, 931.5], "read_count").failures)
    assert any("negative" in f for f in layers([-1, 931], "read_count").failures)

    assert layers([-4.5, 4.5], "log2_fold_change").failures == []
    assert layers([3.2e-18, 1.0], "p_value").failures == []
    assert any("outside [0, 1]" in f for f in layers([1.2, 0.5], "p_value").failures)
    assert layers([-0.75, None], "translation_efficiency_log2_fold_change",
                  "Ribo-seq").failures == []
