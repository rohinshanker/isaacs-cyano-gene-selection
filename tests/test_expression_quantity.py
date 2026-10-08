"""The pipeline's half of the declared-quantity contract.

A transcriptomics deposit publishes several kinds of number under one
``dataType``, so a source may declare the ``quantity`` its values are. These
tests cover what the build does with that declaration: which column it reads,
which values it admits, which family and ramp the metric gets, what it
publishes for the browser, that nothing accidentally groups two quantities into
one metric, and that a tiny p-value survives publication. A source that
declares no quantity must behave exactly as it did before, and that is tested
here too, because this contract is only safe if it is opt-in.

``tests/test_expression_table.py`` pins the contract table itself.
"""

import hashlib
import json
import math
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import expression_table  # noqa: E402
from condition_record import example_record  # noqa: E402
from build_features import (  # noqa: E402
    exact_floats,
    expression_layers_document,
    expression_metric_definition,
    load_expression_sources,
    round_floats,
)

# One source per quantity, as the coordinator will write them: a transcriptomics
# record on one of the two sequencing platforms, publishing through the separate
# layer payload.
QUANTITY_PLATFORMS = {
    "rpkm": "RNA-seq",
    "read_count": "RNA-seq",
    "log2_fold_change": "RNA-seq",
    "edger_log2_fold_change": "RNA-seq",
    "p_value": "RNA-seq",
    "translation_efficiency_log2_fold_change": "Ribo-seq",
}


def write_table(directory, file_name, rows, quantity, data_type="transcriptomics"):
    """Writes a source table under the header its declared quantity names."""
    content = expression_table.header_line(data_type, quantity) + "\n" + "".join(
        f"{locus}\t{value}\t{locus}\n" for locus, value in rows
    )
    (directory / file_name).write_text(content, encoding="utf-8")
    return hashlib.sha256(content.encode()).hexdigest()


def quantity_source(file_name, metric_key, digest, quantity, platform=None, **overrides):
    """A manifest entry declaring a measured quantity."""
    record = example_record(studyId=metric_key.upper())
    record = {
        **record,
        "dataType": "transcriptomics",
        "platform": platform or QUANTITY_PLATFORMS[quantity],
    }
    return {
        "record": record,
        "id": metric_key.upper(),
        "file": file_name,
        "metricKey": metric_key,
        "label": metric_key,
        "organism": "test organism",
        "isTargetOrganism": True,
        "assay": "test assay",
        "units": "test units",
        "condition": "test condition",
        "sha256": digest,
        "licence": "test licence",
        "caveat": "test caveat",
        "provenanceDoc": "data/expression/test.md",
        "citationId": "test-citation",
        "payload": "expression_layers.json",
        "quantity": quantity,
        **overrides,
    }


def write_manifest(directory, entries):
    (directory / "sources.json").write_text(json.dumps(entries), encoding="utf-8")


def test_every_quantity_loads_from_its_own_column(tmp_path):
    """A table is read under the column its quantity names, and no other."""
    entries = []
    for index, (quantity, platform) in enumerate(QUANTITY_PLATFORMS.items()):
        value = {"read_count": 7, "p_value": 0.004}.get(quantity, 1.25)
        digest = write_table(tmp_path, f"{index}.tsv", [("a", value)], quantity)
        entries.append(quantity_source(f"{index}.tsv", f"m{index}", digest, quantity, platform))
    write_manifest(tmp_path, entries)

    sources, values = load_expression_sources(tmp_path, set())

    assert [source["quantity"] for source in sources] == list(QUANTITY_PLATFORMS)
    assert values["m1"] == {"a": 7.0}
    assert values["m4"] == {"a": 0.004}
    # The declaration, not the file, is what every later reader sees.
    assert [source["quantityKind"] for source in sources] == [
        "abundance", "read-count", "log2-fold-change", "edger-log2-fold-change",
        "p-value", "te-log2-fold-change",
    ]
    assert [source["quantityLabel"] for source in sources] == [
        "RNA abundance", "RNA read count", "RNA log2FC", "RNA log2FC (EdgeR)",
        "RNA reported P-value (adjustment unspecified)", "TE log2FC",
    ]


def test_a_table_headed_with_another_quantitys_column_is_refused(tmp_path):
    """The two directions of the mistake the typed column exists to catch."""
    digest = write_table(tmp_path, "fc.tsv", [("a", -1.5)], "log2_fold_change")
    as_p_value = quantity_source("fc.tsv", "mP", digest, "p_value")
    write_manifest(tmp_path, [as_p_value])
    with pytest.raises(ValueError, match="a transcriptomics p_value table must have"):
        load_expression_sources(tmp_path, set())

    p_digest = write_table(tmp_path, "p.tsv", [("a", 0.01)], "p_value")
    as_fold_change = quantity_source("p.tsv", "mF", p_digest, "log2_fold_change")
    write_manifest(tmp_path, [as_fold_change])
    with pytest.raises(ValueError, match="a transcriptomics log2_fold_change table must have"):
        load_expression_sources(tmp_path, set())

    # Both fold changes share one column, because both really are log2 fold
    # changes; the estimator is the declaration, not a second column name.
    write_manifest(tmp_path, [quantity_source("fc.tsv", "mE", digest, "edger_log2_fold_change")])
    _, values = load_expression_sources(tmp_path, set())
    assert values["mE"] == {"a": -1.5}


def test_an_unsupported_quantity_fails_instead_of_being_guessed(tmp_path):
    digest = write_table(tmp_path, "t.tsv", [("a", 1.0)], "rpkm")
    write_manifest(tmp_path, [quantity_source("t.tsv", "mX", digest, "rpkm") | {"quantity": "tpm"}])
    with pytest.raises(ValueError, match="unsupported expression quantity 'tpm'"):
        load_expression_sources(tmp_path, set())
    write_manifest(tmp_path, [quantity_source("t.tsv", "mX", digest, "rpkm") | {"quantity": ""}])
    with pytest.raises(ValueError, match="declares an invalid quantity"):
        load_expression_sources(tmp_path, set())
    # A quantity its platform does not publish is refused, not reinterpreted.
    write_manifest(tmp_path, [quantity_source("t.tsv", "mX", digest, "rpkm", platform="array")])
    with pytest.raises(ValueError, match="is defined for platform"):
        load_expression_sources(tmp_path, set())


def test_zeros_negatives_fractions_and_tiny_p_values_are_admitted_or_refused_per_quantity(tmp_path):
    """Each quantity's own bounds, exercised on the values that distinguish them."""
    # An exact zero and a negative are both real fold changes.
    digest = write_table(
        tmp_path, "fc.tsv", [("a", -4.5), ("b", 0.0), ("c", 4.5)], "log2_fold_change")
    write_manifest(tmp_path, [quantity_source("fc.tsv", "mF", digest, "log2_fold_change")])
    _, values = load_expression_sources(tmp_path, set())
    assert values["mF"] == {"a": -4.5, "b": 0.0, "c": 4.5}

    # A count is whole and never negative.
    digest = write_table(tmp_path, "rc.tsv", [("a", 0), ("b", 931)], "read_count")
    write_manifest(tmp_path, [quantity_source("rc.tsv", "mC", digest, "read_count")])
    _, values = load_expression_sources(tmp_path, set())
    assert values["mC"] == {"a": 0.0, "b": 931.0}
    digest = write_table(tmp_path, "rc.tsv", [("a", 12.5)], "read_count")
    write_manifest(tmp_path, [quantity_source("rc.tsv", "mC", digest, "read_count")])
    with pytest.raises(ValueError, match="counts whole reads"):
        load_expression_sources(tmp_path, set())
    digest = write_table(tmp_path, "rc.tsv", [("a", -3)], "read_count")
    write_manifest(tmp_path, [quantity_source("rc.tsv", "mC", digest, "read_count")])
    with pytest.raises(ValueError, match="never negative"):
        load_expression_sources(tmp_path, set())

    # An RPKM is never negative; zero is a real measured absence of reads.
    digest = write_table(tmp_path, "rp.tsv", [("a", 0.0), ("b", 0.0031)], "rpkm")
    write_manifest(tmp_path, [quantity_source("rp.tsv", "mR", digest, "rpkm")])
    _, values = load_expression_sources(tmp_path, set())
    assert values["mR"] == {"a": 0.0, "b": 0.0031}
    digest = write_table(tmp_path, "rp.tsv", [("a", -0.5)], "rpkm")
    write_manifest(tmp_path, [quantity_source("rp.tsv", "mR", digest, "rpkm")])
    with pytest.raises(ValueError, match="never negative"):
        load_expression_sources(tmp_path, set())

    # A p-value is a probability, and a very small one is kept exactly.
    digest = write_table(
        tmp_path, "p.tsv", [("a", 0.0), ("b", "3.2e-18"), ("c", 1.0)], "p_value")
    write_manifest(tmp_path, [quantity_source("p.tsv", "mP", digest, "p_value")])
    _, values = load_expression_sources(tmp_path, set())
    assert values["mP"] == {"a": 0.0, "b": 3.2e-18, "c": 1.0}
    digest = write_table(tmp_path, "p.tsv", [("a", 1.5)], "p_value")
    write_manifest(tmp_path, [quantity_source("p.tsv", "mP", digest, "p_value")])
    with pytest.raises(ValueError, match=r"probability in \[0, 1\]"):
        load_expression_sources(tmp_path, set())

    # Nothing may be infinite or missing, whatever the quantity.
    for bad in ("inf", "nan"):
        digest = write_table(tmp_path, "fc.tsv", [("a", bad)], "log2_fold_change")
        write_manifest(tmp_path, [quantity_source("fc.tsv", "mF", digest, "log2_fold_change")])
        with pytest.raises(ValueError, match="must be finite"):
            load_expression_sources(tmp_path, set())


def test_a_missing_locus_stays_missing_rather_than_becoming_zero(tmp_path):
    """A gene the deposit does not report is unknown, including for a p-value."""
    digest = write_table(tmp_path, "p.tsv", [("a", 0.02), ("c", 0.0004)], "p_value")
    write_manifest(tmp_path, [quantity_source("p.tsv", "mP", digest, "p_value")])
    sources, values = load_expression_sources(tmp_path, set())
    assert values["mP"] == {"a": 0.02, "c": 0.0004}
    assert "b" not in values["mP"]
    document = expression_layers_document(
        [{"id": "a"}, {"id": "b"}, {"id": "c"}], sources, values)
    assert document["layers"]["mP"] == [0.02, None, 0.0004]


def test_the_contract_fixes_the_sign_flags_and_refuses_a_manifest_that_contradicts_them(tmp_path):
    digest = write_table(tmp_path, "fc.tsv", [("a", -1.5)], "log2_fold_change")
    write_manifest(tmp_path, [quantity_source("fc.tsv", "mF", digest, "log2_fold_change")])
    sources, _ = load_expression_sources(tmp_path, set())
    # Declared by the quantity, not by the manifest, and never both at once.
    assert (sources[0]["signed"], sources[0]["logScale"]) == (True, False)

    write_manifest(tmp_path, [
        quantity_source("fc.tsv", "mF", digest, "log2_fold_change") | {"signed": False}])
    with pytest.raises(ValueError, match="is always signed=True"):
        load_expression_sources(tmp_path, set())
    write_manifest(tmp_path, [
        quantity_source("fc.tsv", "mF", digest, "log2_fold_change") | {"logScale": True}])
    with pytest.raises(ValueError, match="is always logScale=False"):
        load_expression_sources(tmp_path, set())

    # A translation-efficiency ratio is signed on the same grounds.
    te_digest = write_table(
        tmp_path, "te.tsv", [("a", -0.75)], "translation_efficiency_log2_fold_change")
    write_manifest(tmp_path, [quantity_source(
        "te.tsv", "mT", te_digest, "translation_efficiency_log2_fold_change")])
    sources, _ = load_expression_sources(tmp_path, set())
    assert (sources[0]["signed"], sources[0]["logScale"]) == (True, False)

    # A p-value is one-sided, so neither flag is set for it.
    p_digest = write_table(tmp_path, "p.tsv", [("a", 0.01)], "p_value")
    write_manifest(tmp_path, [quantity_source("p.tsv", "mP", p_digest, "p_value")])
    sources, _ = load_expression_sources(tmp_path, set())
    assert (sources[0]["signed"], sources[0]["logScale"]) == (False, False)


def test_a_metric_takes_its_family_and_ramp_from_its_quantity(tmp_path):
    """The family is what keeps these three out of the abundance rules."""
    expected = {
        "rpkm": ("Expression", "sequential"),
        "read_count": ("Expression", "sequential"),
        "log2_fold_change": ("Fold change", "diverging"),
        "edger_log2_fold_change": ("Fold change", "diverging"),
        "p_value": ("Significance", "sequential"),
        "translation_efficiency_log2_fold_change": ("Translation efficiency", "diverging"),
    }
    for index, (quantity, want) in enumerate(expected.items()):
        value = {"read_count": 3, "p_value": 0.01}.get(quantity, 1.0)
        digest = write_table(tmp_path, f"q{index}.tsv", [("a", value)], quantity)
        write_manifest(tmp_path, [quantity_source(f"q{index}.tsv", "mQ", digest, quantity)])
        sources, _ = load_expression_sources(tmp_path, set())
        definition = expression_metric_definition(sources[0], 1, 3)
        assert (definition["family"], definition["scale"]) == want, quantity
        # The coverage sentence the contract validator matches is unchanged, and
        # the quantity is named after it so a metric met on its own says what it is.
        assert "available for 1 of 3 genes in the mQ column of expression_layers.json." \
            in definition["desc"]
        assert f"({quantity})" in definition["desc"]
        assert definition["desc"].endswith("test caveat")
    # Only an abundance or a count says it pools.
    digest = write_table(tmp_path, "p.tsv", [("a", 0.01)], "p_value")
    write_manifest(tmp_path, [quantity_source("p.tsv", "mP", digest, "p_value")])
    sources, _ = load_expression_sources(tmp_path, set())
    assert "never pooled across contrasts" in expression_metric_definition(sources[0], 1, 1)["desc"]
    digest = write_table(tmp_path, "r.tsv", [("a", 1.0)], "rpkm")
    write_manifest(tmp_path, [quantity_source("r.tsv", "mR", digest, "rpkm")])
    sources, _ = load_expression_sources(tmp_path, set())
    assert "within-dataset rank" in expression_metric_definition(sources[0], 1, 1)["desc"]


def test_no_two_declared_quantities_group_into_one_metric_on_one_platform(tmp_path):
    """Six quantities on one platform are six distinct type keys.

    The browser groups by data type, platform and kind, so a shared kind would
    average a p-value into a fold change.
    """
    entries = []
    for index, quantity in enumerate(QUANTITY_PLATFORMS):
        value = {"read_count": 5, "p_value": 0.05}.get(quantity, 2.0)
        digest = write_table(tmp_path, f"g{index}.tsv", [("a", value)], quantity)
        entries.append(quantity_source(f"g{index}.tsv", f"g{index}", digest, quantity, "RNA-seq"))
    write_manifest(tmp_path, entries)
    sources, _ = load_expression_sources(tmp_path, set())
    keys = {
        (s["record"]["dataType"], s["record"]["platform"], s["quantityKind"]) for s in sources
    }
    assert len(keys) == len(sources) == 6
    # The same quantity on the other platform is a different measurement again.
    ribo_digest = write_table(tmp_path, "ribo.tsv", [("a", 2.0)], "rpkm")
    write_manifest(tmp_path, [
        quantity_source("g0.tsv", "g0", entries[0]["sha256"], "rpkm", "RNA-seq"),
        quantity_source("ribo.tsv", "gR", ribo_digest, "rpkm", "Ribo-seq"),
    ])
    sources, _ = load_expression_sources(tmp_path, set())
    assert [s["quantityKind"] for s in sources] == ["abundance", "occupancy"]
    assert [s["quantityLabel"] for s in sources] == ["RNA abundance", "Ribosome occupancy"]


def test_a_tiny_p_value_is_published_exactly_and_everything_else_is_rounded():
    """Six decimals would publish 3.2e-18 as zero, inverting the evidence."""
    layers = {
        "schemaVersion": 1,
        "geneIds": ["a", "b"],
        "layers": {
            "pAdj": [3.2e-18, 1e-300],
            "fold": [1.23456789, -0.00000049],
        },
    }
    rounded = round_floats(layers, frozenset({"pAdj"}))
    assert rounded["layers"]["pAdj"] == [3.2e-18, 1e-300]
    assert json.dumps(rounded["layers"]["pAdj"]) == "[3.2e-18, 1e-300]"
    # Every other column keeps the six-decimal publication convention.
    assert rounded["layers"]["fold"] == [1.234568, -0.0]
    # Without the exemption the same p-values are published as zeros.
    assert round_floats(layers)["layers"]["pAdj"] == [0.0, 0.0]
    # The exemption is a key, so it applies wherever the walk meets it.
    nested = {"outer": {"pAdj": {"deep": [1e-30]}}, "other": [1e-30]}
    assert round_floats(nested, frozenset({"pAdj"})) == {
        "outer": {"pAdj": {"deep": [1e-30]}}, "other": [0.0]}
    # A non-finite value is still published as null, exempt or not.
    assert exact_floats([float("inf"), float("nan"), 1e-300]) == [None, None, 1e-300]
    assert round_floats({"pAdj": [float("nan")]}, frozenset({"pAdj"})) == {"pAdj": [None]}


def test_a_source_that_declares_no_quantity_is_untouched(tmp_path):
    """The contract is opt-in: every shipped source must load exactly as before."""
    legacy = {
        "record": example_record(studyId="LEGACY"),
        "id": "LEGACY",
        "file": "legacy.tsv",
        "metricKey": "expression",
        "label": "legacy",
        "organism": "test organism",
        "isTargetOrganism": False,
        "assay": "RNA-seq transcript abundance",
        "units": "DESeq2 normalized counts",
        "condition": "test condition",
        "sha256": "",
        "licence": "test licence",
        "caveat": "test caveat",
        "provenanceDoc": "data/expression/test.md",
        "citationId": "test-citation",
    }
    content = expression_table.header_line("transcriptomics") + "\n" + "a\t12.5\ta\n"
    (tmp_path / "legacy.tsv").write_text(content, encoding="utf-8")
    legacy["sha256"] = hashlib.sha256(content.encode()).hexdigest()
    write_manifest(tmp_path, [legacy])

    sources, values = load_expression_sources(tmp_path, set())

    assert values == {"expression": {"a": 12.5}}
    source = sources[0]
    assert source["payload"] == "genes.json"
    assert source["signed"] is False
    # No quantity declaration is invented for it, anywhere.
    assert not any(key.startswith("quantity") for key in source)
    definition = expression_metric_definition(source, 1, 1)
    assert (definition["family"], definition["scale"]) == ("Expression", "sequential")
    assert "Quantity:" not in definition["desc"]
    # And a legacy abundance still refuses a negative value, by its own rule.
    bad = expression_table.header_line("transcriptomics") + "\n" + "a\t-1\ta\n"
    (tmp_path / "legacy.tsv").write_text(bad, encoding="utf-8")
    legacy["sha256"] = hashlib.sha256(bad.encode()).hexdigest()
    write_manifest(tmp_path, [legacy])
    with pytest.raises(ValueError, match="Invalid value for a"):
        load_expression_sources(tmp_path, set())


def test_every_shipped_source_declaring_a_quantity_declares_a_known_one():
    """The release itself, not a synthetic manifest.

    No shipped source declares a quantity yet. When one does, this fails unless
    the declaration is in the contract and is defined for that source's own data
    type and platform, so a new layer cannot arrive under a quantity nobody has
    decided the meaning of.
    """
    for manifest in sorted(ROOT.glob("data/expression/**/sources.json")):
        for source in json.loads(manifest.read_text(encoding="utf-8")):
            if "quantity" in source:
                # Once sources do declare one, they must declare a known one.
                assert source["quantity"] in expression_table.QUANTITIES, (
                    f"{manifest}: {source['id']} declares an unknown quantity")
                expression_table.check_declaration(
                    source["record"]["dataType"], source["record"]["platform"],
                    source["quantity"], source["id"])


def test_a_p_value_layer_round_trips_through_json_without_losing_its_smallest_values(tmp_path):
    """End to end: a deposited 1e-300 is still 1e-300 after the build writes it."""
    digest = write_table(
        tmp_path, "p.tsv", [("a", "1e-300"), ("b", "0.049999999")], "p_value")
    write_manifest(tmp_path, [quantity_source("p.tsv", "mP", digest, "p_value")])
    sources, values = load_expression_sources(tmp_path, set())
    document = expression_layers_document([{"id": "a"}, {"id": "b"}], sources, values)
    exact = frozenset(
        source["metricKey"] for source in sources
        if expression_table.quantity_spec(source["quantity"]).exact
    )
    published = json.loads(json.dumps(round_floats(document, exact), separators=(",", ":")))
    assert published["layers"]["mP"][0] == 1e-300
    assert published["layers"]["mP"][1] == 0.049999999
    assert all(math.isfinite(v) and v > 0 for v in published["layers"]["mP"])
