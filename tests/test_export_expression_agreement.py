import copy
import csv
import hashlib
import itertools
import json
import subprocess
import sys

import pytest

from tools import export_expression_agreement as exporter


HANDOFF = exporter.ROOT / "docs/notes/handoff"
CURRENT_SUMMARY = HANDOFF / "cyano_processed_expression_agreement_current_20261007.json"
PRESERVED_TABLES = {
    "replicates": HANDOFF / "cyano_processed_expression_agreement_20261007_replicates.tsv",
    "responses": HANDOFF / "cyano_processed_expression_agreement_20261007_responses.tsv",
}


def layer(
    layer_id,
    study_id,
    means,
    strata,
    *,
    replicate_type="biological",
    band=True,
    reason=None,
):
    defined = [value for _, values, _ in strata for value in values if value is not None]
    sample_range = {
        "id": f"{layer_id}:empirical-sample-range",
        "label": "Empirical within-stratum sample Spearman range (processed data; not a confidence interval)",
        "definedCorrelationCount": len(defined),
        "min": min(defined) if defined else None,
        "median": defined[len(defined) // 2] if defined else None,
        "max": max(defined) if defined else None,
    }
    if reason is not None:
        sample_range["reason"] = reason
    report = {
        "id": layer_id,
        "studyId": study_id,
        "strain": "PCC 7942",
        "label": f"{layer_id} label",
        "conditionSet": "one reviewed condition",
        "units": "counts per million",
        "normalization": "cpm",
        "caveat": "Descriptive only.",
        "replicates": {"count": 2, "text": "two biological replicates"},
        "conditions": {"temperature": {"status": "not reported", "lo": None, "hi": None}},
        "replicateType": replicate_type,
        "biologicalBandAvailable": bool(band and defined),
        "meanGeneCount": len(means),
        "means": dict(means),
        "strata": [
            {
                "id": stratum_id,
                "columns": list(columns),
                "sampleCorrelations": [
                    {
                        "sampleLeft": columns[0],
                        "sampleRight": columns[index + 1],
                        "sharedGeneCount": 3,
                        "spearman": value,
                        **({} if value is not None else {"spearmanReason": "constant_both_vector"}),
                    }
                    for index, value in enumerate(values)
                ],
            }
            for stratum_id, values, columns in strata
        ],
        "empiricalSampleRange": sample_range,
    }
    if report["biologicalBandAvailable"]:
        report["biologicalBandId"] = sample_range["id"]
    return report


def contrast(contrast_id, study_id, vector, excluded_zero, *, caveat="Contrast caveat."):
    return {
        "id": contrast_id,
        "label": f"{contrast_id} label",
        "studyId": study_id,
        "treatment": ["t1"],
        "control": ["c1"],
        "caveat": caveat,
        "measuredIntersectionCount": len(vector) + excluded_zero,
        "positiveGeneCount": len(vector),
        "excludedZeroCount": excluded_zero,
        "vector": dict(vector),
    }


def level_pair(left, right):
    def reference(side):
        item = {
            "layerId": side["id"],
            "empiricalSampleRangeId": side["empiricalSampleRange"]["id"],
        }
        if side.get("biologicalBandAvailable"):
            item["biologicalBandId"] = side["biologicalBandId"]
        return item

    return {
        "left": left["id"],
        "right": right["id"],
        "leftReference": reference(left),
        "rightReference": reference(right),
        "sharedGeneCount": 2,
        "spearman": 1.0,
    }


def full_report():
    """A minimal but structurally complete schema-1 report from the generator."""
    alpha = layer(
        "alpha_ll",
        "GSE000001",
        {"U1": 10.5, "U2": 0.0, "U3": 3.25},
        [("alpha_ll:t0", [0.75], ["t0_r1", "t0_r2"])],
    )
    beta = layer(
        "beta_single",
        "GSE000002",
        {"U1": 1.0, "U2": 2.0},
        [("beta_single:t0", [], ["t0_r1"])],
        replicate_type="none",
        band=False,
        reason="no_defined_sample_correlations",
    )
    contrasts = [
        contrast("alpha_shift", "GSE000001", {"U1": 1.5, "U2": -1.5, "U3": 0.0}, 0),
        contrast("beta_shift", "GSE000002", {"U1": 0.5, "U2": -0.5}, 1),
        contrast("gamma_flat", "GSE000002", {"U1": 0.0, "U2": 0.0, "U3": 0.0}, 0),
    ]
    return {
        "schemaVersion": 1,
        "methods": {"contrast": "log2(mean normalized treatment / mean normalized control)"},
        "limitations": ["No statistic is a pass/fail rule."],
        "inputs": {
            "plan": {"path": "config/expression_agreement.json", "sha256": "0" * 64},
            "specs": [{"studyId": "GSE000001", "path": "data/expression/ingest/GSE000001.json",
                       "sha256": "1" * 64}],
            "downloads": [{"studyId": "GSE000001", "name": "table.csv", "url": "https://example.test/t",
                           "sha256": "2" * 64}],
            "crosswalk": {"path": "data/annotation/crosswalk.tsv", "sha256": "3" * 64},
        },
        "layers": [alpha, beta],
        "levelPairs": [level_pair(alpha, beta)],
        "contrasts": contrasts,
        "responsePairs": [
            {
                "left": "alpha_shift",
                "right": "beta_shift",
                "caveat": "Different genotypes.",
                "sharedGeneCount": 2,
                "spearman": 1.0,
                "pearson": 1.0,
                "signAgreementFraction": 1.0,
                "sameDirectionCount": 2,
                "nonzeroDirectionGeneCount": 2,
            },
            {
                "left": "alpha_shift",
                "right": "gamma_flat",
                "caveat": "Flat reference arm.",
                "sharedGeneCount": 3,
                "spearman": None,
                "spearmanReason": "constant_right_vector",
                "pearson": None,
                "pearsonReason": "constant_right_vector",
                "signAgreementFraction": None,
                "signAgreementReason": "no_shared_nonzero_responses",
                "sameDirectionCount": 0,
                "nonzeroDirectionGeneCount": 0,
            },
        ],
    }


@pytest.fixture
def workspace(tmp_path):
    """A report on disk plus three unused destinations under an isolated root."""
    root = tmp_path / "root"
    (root / "config").mkdir(parents=True)
    (root / "data").mkdir()
    (root / "site").mkdir()
    out = tmp_path / "out"
    out.mkdir()
    space = {
        "root": root,
        "report": tmp_path / "report.json",
        "json": out / "summary.json",
        "replicates": out / "replicates.tsv",
        "responses": out / "responses.tsv",
        "payload": full_report(),
    }
    write_report(space)
    return space


def write_report(space, payload=None):
    if payload is not None:
        space["payload"] = payload
    text = json.dumps(space["payload"], indent=2, sort_keys=True)
    space["report"].write_text(text + "\n", encoding="utf-8")


def run_export(space):
    return exporter.export_report(
        space["report"], space["json"], space["replicates"], space["responses"], root=space["root"]
    )


def read_table(path):
    return list(csv.reader(path.read_text(encoding="utf-8").splitlines(), delimiter="\t"))


def test_export_writes_statistics_only_json_and_both_tables(workspace):
    source = copy.deepcopy(workspace["payload"])
    summary = run_export(workspace)

    on_disk = json.loads(workspace["json"].read_text(encoding="utf-8"))
    assert on_disk == summary
    assert on_disk["reportFormat"] == "statistics-summary"
    assert all("means" not in item for item in on_disk["layers"])
    assert all("vector" not in item for item in on_disk["contrasts"])
    assert on_disk["omittedVectors"] == {
        "layerField": "means",
        "contrastField": "vector",
        "reproduction": (
            "tools/expression_agreement.py regenerates the complete vectors from "
            "config/expression_agreement.json"
        ),
    }

    # Everything else is carried over untouched.
    expected = copy.deepcopy(source)
    for item in expected["layers"]:
        del item["means"]
    for item in expected["contrasts"]:
        del item["vector"]
    assert {key: on_disk[key] for key in expected} == expected

    raw = workspace["report"].read_bytes()
    assert on_disk["export"]["input"] == {
        "path": "report.json",
        "sha256": hashlib.sha256(raw).hexdigest(),
        "bytes": len(raw),
    }
    assert on_disk["export"]["exporter"] == {
        "path": "tools/export_expression_agreement.py",
        "sha256": hashlib.sha256(
            (exporter.ROOT / "tools/export_expression_agreement.py").read_bytes()
        ).hexdigest(),
    }
    assert "recomputed nothing" in on_disk["export"]["statistics"]
    assert "implementation" not in on_disk

    replicates = read_table(workspace["replicates"])
    assert replicates[0] == list(exporter.REPLICATE_COLUMNS)
    assert replicates[1] == ["alpha_ll", "GSE000001", "biological", "True", "3", "1", "1",
                             "0.75", "0.75", "0.75"]
    responses = read_table(workspace["responses"])
    assert responses[0] == list(exporter.RESPONSE_COLUMNS)
    assert responses[1][:9] == ["alpha_shift", "beta_shift", "GSE000001", "GSE000002",
                                "alpha_shift label", "beta_shift label", "2", "1.0", "1.0"]
    assert responses[1][-1] == "Different genotypes."


def test_export_leaves_the_input_report_object_unchanged(workspace):
    report, raw = exporter.load_report(workspace["report"])
    before = copy.deepcopy(report)
    summary = exporter.statistics_summary(report, exporter.provenance(workspace["report"], raw))
    assert report == before
    assert "means" in report["layers"][0]
    assert "vector" in report["contrasts"][0]
    summary["layers"][0]["studyId"] = "mutated"
    summary["export"]["input"]["sha256"] = "mutated"
    assert report == before


def test_nulls_zeros_and_reasons_survive_the_export(workspace):
    run_export(workspace)
    summary = json.loads(workspace["json"].read_text(encoding="utf-8"))
    beta = next(item for item in summary["layers"] if item["id"] == "beta_single")
    assert beta["empiricalSampleRange"]["min"] is None
    assert beta["empiricalSampleRange"]["median"] is None
    assert beta["empiricalSampleRange"]["max"] is None
    assert beta["empiricalSampleRange"]["reason"] == "no_defined_sample_correlations"
    assert beta["biologicalBandAvailable"] is False
    assert "biologicalBandId" not in beta
    assert beta["conditions"]["temperature"]["lo"] is None

    flat = next(item for item in summary["responsePairs"] if item["right"] == "gamma_flat")
    assert flat["spearman"] is None and flat["spearmanReason"] == "constant_right_vector"
    assert flat["signAgreementFraction"] is None
    assert flat["signAgreementReason"] == "no_shared_nonzero_responses"
    assert flat["nonzeroDirectionGeneCount"] == 0

    replicates = read_table(workspace["replicates"])
    beta_row = next(row for row in replicates if row[0] == "beta_single")
    assert beta_row == ["beta_single", "GSE000002", "none", "False", "2", "1", "0", "", "", ""]

    responses = read_table(workspace["responses"])
    flat_row = next(row for row in responses if row[1] == "gamma_flat")
    assert flat_row[7:12] == ["", "", "0", "0", ""]
    # A zero-mean exclusion keeps its own denominator, and a zero count stays zero.
    assert [flat_row[12], flat_row[14], flat_row[16]] == ["3", "3", "0"]
    beta_shift_row = next(row for row in responses if row[1] == "beta_shift")
    assert [beta_shift_row[13], beta_shift_row[15], beta_shift_row[17]] == ["3", "2", "1"]


def test_tsv_serialisation_quotes_tabs_newlines_quotes_and_returns(workspace):
    hostile = 'tab\there\nnewline "quoted" \r return'
    payload = copy.deepcopy(workspace["payload"])
    payload["responsePairs"][0]["caveat"] = hostile
    payload["layers"][0]["replicateType"] = hostile
    write_report(workspace, payload)
    run_export(workspace)

    for path, column, expected_rows in (
        (workspace["responses"], "caveat", 3),
        (workspace["replicates"], "replicateType", 3),
    ):
        with path.open(encoding="utf-8", newline="") as handle:
            rows = list(csv.reader(handle, delimiter="\t"))
        assert len(rows) == expected_rows
        assert rows[1][rows[0].index(column)] == hostile


def test_preserved_handoff_tables_are_reproduced_byte_for_byte():
    summary = json.loads(CURRENT_SUMMARY.read_text(encoding="utf-8"))
    rendered = {
        "replicates": exporter.render_table(exporter.replicate_rows(summary)),
        "responses": exporter.render_table(exporter.response_rows(summary)),
    }
    for name, path in PRESERVED_TABLES.items():
        assert rendered[name] == path.read_bytes().decode("utf-8")


def test_export_layout_matches_the_preserved_summary_except_for_provenance(workspace):
    run_export(workspace)
    exported = json.loads(workspace["json"].read_text(encoding="utf-8"))
    preserved = json.loads(CURRENT_SUMMARY.read_bytes().decode("utf-8"))
    # The export adds its own provenance and never fabricates the generator's identity.
    assert set(exported) == (set(preserved) | {"export"}) - {"implementation"}
    assert exported["export"]["exporter"]["path"] == "tools/export_expression_agreement.py"
    assert exported["omittedVectors"].keys() == preserved["omittedVectors"].keys()
    assert set(exported["layers"][0]) == set(preserved["layers"][0])
    assert set(exported["contrasts"][0]) == set(preserved["contrasts"][0])
    assert set(exported["responsePairs"][0]) == set(preserved["responsePairs"][0])
    assert set(exported["levelPairs"][0]) == set(preserved["levelPairs"][0])


def test_preserved_summary_is_rejected_as_already_exported():
    with pytest.raises(ValueError, match="already a statistics-only summary"):
        exporter.load_report(CURRENT_SUMMARY)


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (lambda payload: payload["layers"].append(copy.deepcopy(payload["layers"][0])),
         "duplicate layer id"),
        (lambda payload: payload["contrasts"].append(copy.deepcopy(payload["contrasts"][0])),
         "duplicate contrast id"),
        (lambda payload: payload["layers"][0]["strata"].append(
            copy.deepcopy(payload["layers"][0]["strata"][0])),
         "duplicate stratum id"),
    ],
)
def test_duplicate_identities_are_rejected(workspace, mutate, message):
    payload = copy.deepcopy(workspace["payload"])
    mutate(payload)
    write_report(workspace, payload)
    with pytest.raises(ValueError, match=message):
        run_export(workspace)


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (lambda payload: payload["responsePairs"][0].update(left="missing_contrast"),
         "names unknown contrast"),
        (lambda payload: payload["levelPairs"][0].update(left="missing_layer"),
         "names unknown layer"),
        (lambda payload: payload["levelPairs"][0]["leftReference"].update(layerId="beta_single"),
         "does not name layer"),
        (lambda payload: payload["levelPairs"][0]["rightReference"].update(
            empiricalSampleRangeId="alpha_ll:empirical-sample-range"),
         "does not name the sample range"),
        (lambda payload: payload["layers"][0].update(biologicalBandId="beta_single:empirical-sample-range"),
         "does not reference its sample range"),
        (lambda payload: payload["layers"][0]["strata"][0]["sampleCorrelations"][0].update(
            sampleRight="unlisted_sample"),
         "names a sample outside its columns"),
    ],
)
def test_broken_cross_references_are_rejected(workspace, mutate, message):
    payload = copy.deepcopy(workspace["payload"])
    mutate(payload)
    write_report(workspace, payload)
    with pytest.raises(ValueError, match=message):
        run_export(workspace)


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (lambda payload: payload["layers"][0].update(meanGeneCount=99),
         "meanGeneCount disagrees with its means"),
        (lambda payload: payload["layers"][0]["empiricalSampleRange"].update(
            definedCorrelationCount=5),
         "definedCorrelationCount disagrees"),
        (lambda payload: payload["contrasts"][0].update(positiveGeneCount=1),
         "positiveGeneCount disagrees with its vector"),
        (lambda payload: payload["contrasts"][1].update(measuredIntersectionCount=9),
         "measured intersection disagrees"),
        (lambda payload: payload["contrasts"][0].update(excludedZeroCount=-1),
         "excludedZeroCount must be a non-negative integer"),
        (lambda payload: payload["layers"][0].update(meanGeneCount=True),
         "meanGeneCount must be a non-negative integer"),
    ],
)
def test_inconsistent_denominators_are_rejected(workspace, mutate, message):
    payload = copy.deepcopy(workspace["payload"])
    mutate(payload)
    write_report(workspace, payload)
    with pytest.raises(ValueError, match=message):
        run_export(workspace)


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (lambda payload: payload.update(schemaVersion=2), "unsupported report schemaVersion"),
        (lambda payload: payload.update(reportFormat="statistics-summary"),
         "already a statistics-only summary"),
        (lambda payload: payload.update(omittedVectors={}), "already a statistics-only summary"),
        (lambda payload: payload["layers"][0].pop("means"),
         "has no 'means' field: a full report is required"),
        (lambda payload: payload["contrasts"][0].pop("vector"),
         "has no 'vector' field: a full report is required"),
        (lambda payload: payload.pop("limitations"), "report has no 'limitations'"),
        (lambda payload: payload.update(layers=[]), "layers must not be empty"),
        (lambda payload: payload.update(contrasts={}), "contrasts must be a JSON array"),
        (lambda payload: payload.update(layers=["text"]), "layer 0 must be a JSON object"),
        (lambda payload: payload["layers"][0].update(id=""), "layer 0 id must be a non-empty string"),
        (lambda payload: payload["layers"][0].update(studyId=None),
         "studyId must be a non-empty string"),
        (lambda payload: payload["contrasts"][0].update(studyId=7),
         "studyId must be a non-empty string"),
        (lambda payload: payload["layers"][0].update(means=["U1"]), "means must be a JSON object"),
        (lambda payload: payload["contrasts"][0].update(vector=[]), "vector must be a JSON object"),
        (lambda payload: payload["layers"][0]["empiricalSampleRange"].pop("median"),
         "empiricalSampleRange has no 'median'"),
        (lambda payload: payload["layers"][0].pop("empiricalSampleRange"),
         "empiricalSampleRange must be a JSON object"),
        (lambda payload: payload["layers"][0]["empiricalSampleRange"].update(id=None),
         "empiricalSampleRange id must be a non-empty string"),
        (lambda payload: payload["layers"][0].update(strata={}), "strata must be a JSON array"),
        (lambda payload: payload["layers"][0]["strata"].append("text"),
         "stratum 1 must be a JSON object"),
        (lambda payload: payload["layers"][0]["strata"][0].pop("id"),
         "stratum 0 id must be a non-empty string"),
        (lambda payload: payload["layers"][0]["strata"][0].pop("columns"),
         "columns must be a JSON array"),
        (lambda payload: payload["layers"][0]["strata"][0].pop("sampleCorrelations"),
         "sampleCorrelations must be a JSON array"),
        (lambda payload: payload["layers"][0]["strata"][0]["sampleCorrelations"].append("text"),
         "correlation 1 must be a JSON object"),
        (lambda payload: payload["levelPairs"][0].pop("leftReference"),
         "leftReference must be a JSON object"),
        (lambda payload: payload["levelPairs"][0].update(right=None),
         "level pair 0 right must be a non-empty string"),
        (lambda payload: payload["levelPairs"].append("text"), "level pair 1 must be a JSON object"),
        (lambda payload: payload.update(levelPairs={}), "levelPairs must be a JSON array"),
        (lambda payload: payload["responsePairs"][0].update(right=5),
         "response pair 0 right must be a non-empty string"),
        (lambda payload: payload["responsePairs"].append([]),
         "response pair 2 must be a JSON object"),
        (lambda payload: payload.update(responsePairs="none"), "responsePairs must be a JSON array"),
        (lambda payload: payload["inputs"].pop("plan"), "inputs plan must be a JSON object"),
        (lambda payload: payload["inputs"]["plan"].pop("path"),
         "inputs plan path must be a non-empty string"),
        (lambda payload: payload.update(inputs=[]), "report inputs must be a JSON object"),
    ],
)
def test_malformed_reports_are_rejected(workspace, mutate, message):
    payload = copy.deepcopy(workspace["payload"])
    mutate(payload)
    write_report(workspace, payload)
    with pytest.raises(ValueError, match=message):
        run_export(workspace)


def test_non_object_report_is_rejected(workspace):
    workspace["report"].write_text("[]\n", encoding="utf-8")
    with pytest.raises(ValueError, match="report must be a JSON object"):
        run_export(workspace)


@pytest.mark.parametrize("literal", ["NaN", "Infinity", "-Infinity"])
def test_non_finite_json_literals_are_rejected(workspace, literal):
    text = workspace["report"].read_text(encoding="utf-8")
    workspace["report"].write_text(text.replace("0.75", literal, 1), encoding="utf-8")
    with pytest.raises(ValueError, match=f"non-finite JSON literal {literal}"):
        run_export(workspace)


def test_overflowing_numbers_are_rejected(workspace):
    text = workspace["report"].read_text(encoding="utf-8")
    workspace["report"].write_text(text.replace("0.75", "1e400", 1), encoding="utf-8")
    with pytest.raises(ValueError, match="is not a finite number"):
        run_export(workspace)


@pytest.mark.parametrize(
    ("content", "message"),
    [("{not json", "not valid JSON"), (None, "not valid UTF-8")],
)
def test_unreadable_reports_are_rejected(workspace, content, message):
    if content is None:
        workspace["report"].write_bytes(b'{"schemaVersion": 1, "label": "\xff\xfe"}')
    else:
        workspace["report"].write_text(content, encoding="utf-8")
    with pytest.raises(ValueError, match=message):
        run_export(workspace)


def test_missing_report_is_rejected(workspace):
    workspace["report"].unlink()
    with pytest.raises(ValueError, match="report does not exist"):
        run_export(workspace)


@pytest.mark.parametrize("label", ["json", "replicates", "responses"])
@pytest.mark.parametrize("directory", ["data", "site"])
def test_destinations_inside_data_and_site_are_rejected(workspace, label, directory):
    workspace[label] = workspace["root"] / directory / "export.out"
    with pytest.raises(ValueError, match=f"must not be published inside {directory}/"):
        run_export(workspace)
    assert not (workspace["root"] / directory / "export.out").exists()


def test_a_destination_reaching_data_through_a_symlink_is_rejected(workspace):
    alias = workspace["root"].parent / "published"
    alias.symlink_to(workspace["root"] / "data", target_is_directory=True)
    workspace["json"] = alias / "summary.json"
    with pytest.raises(ValueError, match="must not be published inside data/"):
        run_export(workspace)
    assert list((workspace["root"] / "data").iterdir()) == []


def test_a_directory_destination_is_rejected(workspace):
    with pytest.raises(ValueError, match="destination is a directory"):
        exporter.export_report(
            workspace["report"], workspace["json"].parent, workspace["replicates"],
            workspace["responses"], root=workspace["root"],
        )


@pytest.mark.parametrize("alias", ["path", "symlink", "hardlink"])
def test_destinations_cannot_overwrite_the_input_report(workspace, alias):
    before = workspace["report"].read_bytes()
    if alias == "path":
        workspace["json"] = workspace["report"]
    elif alias == "symlink":
        workspace["json"] = workspace["json"].parent / "alias.json"
        workspace["json"].symlink_to(workspace["report"])
    else:
        workspace["json"] = workspace["json"].parent / "hardlink.json"
        workspace["json"].hardlink_to(workspace["report"])
    with pytest.raises(ValueError, match="would overwrite the input report"):
        run_export(workspace)
    assert workspace["report"].read_bytes() == before


@pytest.mark.parametrize("alias", ["path", "hardlink"])
def test_destinations_cannot_overwrite_a_pinned_input(workspace, alias):
    plan = workspace["root"] / "config/expression_agreement.json"
    plan.write_text("pinned plan\n", encoding="utf-8")
    if alias == "path":
        workspace["replicates"] = plan
    else:
        workspace["replicates"] = workspace["replicates"].parent / "plan-alias.tsv"
        workspace["replicates"].hardlink_to(plan)
    with pytest.raises(ValueError, match="would overwrite the pinned input config/"):
        run_export(workspace)
    assert plan.read_text(encoding="utf-8") == "pinned plan\n"


def test_a_destination_cannot_overwrite_the_exporter_itself(workspace):
    source = exporter.SELF_PATH
    before = source.read_bytes()
    workspace["json"] = source
    with pytest.raises(ValueError, match="would overwrite the exporter itself"):
        run_export(workspace)
    assert source.read_bytes() == before


@pytest.mark.parametrize("alias", ["path", "symlink", "hardlink"])
def test_two_destinations_naming_the_same_file_are_rejected(workspace, alias):
    if alias == "path":
        workspace["responses"] = workspace["replicates"]
    elif alias == "symlink":
        workspace["replicates"].write_text("existing\n", encoding="utf-8")
        workspace["responses"] = workspace["responses"].parent / "alias.tsv"
        workspace["responses"].symlink_to(workspace["replicates"])
    else:
        workspace["replicates"].write_text("existing\n", encoding="utf-8")
        workspace["responses"] = workspace["responses"].parent / "alias.tsv"
        workspace["responses"].hardlink_to(workspace["replicates"])
    with pytest.raises(ValueError, match="outputs name the same file"):
        run_export(workspace)


OTHER_LABELS = {
    "json": ("replicates", "responses"),
    "replicates": ("json", "responses"),
    "responses": ("json", "replicates"),
}


def preserve_others(workspace, label):
    """Write a sentinel into the two destinations the test is not redirecting."""
    for other in OTHER_LABELS[label]:
        workspace[other].write_text(f"preserve {other}\n", encoding="utf-8")


def assert_others_intact(workspace, label):
    for other in OTHER_LABELS[label]:
        assert workspace[other].read_text(encoding="utf-8") == f"preserve {other}\n"


@pytest.mark.parametrize("label", ["json", "replicates", "responses"])
@pytest.mark.parametrize("blocker", ["file", "file-symlink", "symlink-loop"])
def test_a_destination_under_a_non_directory_ancestor_is_rejected(workspace, label, blocker):
    """EXP-R1: a destination below a non-directory must be rejected before any write."""
    preserve_others(workspace, label)
    out = workspace["json"].parent
    if blocker == "file":
        ancestor = out / "regular-file"
        ancestor.write_text("i am a file\n", encoding="utf-8")
    elif blocker == "file-symlink":
        (out / "regular-file").write_text("i am a file\n", encoding="utf-8")
        ancestor = out / "alias"
        ancestor.symlink_to(out / "regular-file")
    else:
        ancestor = out / "loop"
        ancestor.symlink_to(ancestor)
    workspace[label] = ancestor / "nested" / "export.out"
    expected = "cannot be resolved" if blocker == "symlink-loop" else "which is not a directory"
    with pytest.raises(ValueError, match=expected):
        run_export(workspace)
    assert_others_intact(workspace, label)
    assert not (ancestor / "nested").exists()
    assert ancestor.is_symlink() or ancestor.read_text(encoding="utf-8") == "i am a file\n"


@pytest.mark.parametrize(("parent", "child"), list(itertools.permutations(
    ["json", "replicates", "responses"], 2)))
def test_one_output_cannot_become_a_parent_directory_of_another(workspace, parent, child):
    """EXP-R1: distinct paths still collide when the first output becomes the second's parent."""
    nest = workspace["json"].parent / "new-output"
    workspace[parent] = nest
    workspace[child] = nest / "nested.out"
    with pytest.raises(ValueError, match=f"{parent} output would become a parent directory"):
        run_export(workspace)
    assert not nest.exists()
    remaining, = set(OTHER_LABELS[parent]) & set(OTHER_LABELS[child])
    assert not workspace[remaining].exists()


def test_an_invalid_request_leaves_existing_destinations_intact(workspace):
    for label in ("json", "replicates", "responses"):
        workspace[label].write_text(f"preserve {label}\n", encoding="utf-8")
    payload = copy.deepcopy(workspace["payload"])
    payload["responsePairs"][0].update(left="missing_contrast")
    write_report(workspace, payload)
    with pytest.raises(ValueError, match="names unknown contrast"):
        run_export(workspace)
    for label in ("json", "replicates", "responses"):
        assert workspace[label].read_text(encoding="utf-8") == f"preserve {label}\n"

    # A rejected destination also leaves the two acceptable ones untouched.
    write_report(workspace, full_report())
    workspace["responses"] = workspace["root"] / "site/responses.tsv"
    with pytest.raises(ValueError, match="must not be published inside site/"):
        run_export(workspace)
    assert workspace["json"].read_text(encoding="utf-8") == "preserve json\n"
    assert workspace["replicates"].read_text(encoding="utf-8") == "preserve replicates\n"


def test_export_is_deterministic_and_leaves_no_partial_files(workspace):
    run_export(workspace)
    first = {label: workspace[label].read_bytes() for label in ("json", "replicates", "responses")}
    run_export(workspace)
    assert {label: workspace[label].read_bytes()
            for label in ("json", "replicates", "responses")} == first

    second = workspace["json"].parent.parent / "again"
    exporter.export_report(
        workspace["report"], second / "summary.json", second / "replicates.tsv",
        second / "responses.tsv", root=workspace["root"],
    )
    assert second.joinpath("summary.json").read_bytes() == first["json"]
    assert second.joinpath("replicates.tsv").read_bytes() == first["replicates"]
    assert second.joinpath("responses.tsv").read_bytes() == first["responses"]
    assert sorted(path.name for path in second.iterdir()) == [
        "replicates.tsv", "responses.tsv", "summary.json"]
    assert workspace["json"].read_text(encoding="utf-8").endswith("}\n")
    keys = list(json.loads(workspace["json"].read_text(encoding="utf-8")))
    assert keys == sorted(keys)


def test_a_write_failure_removes_its_temporary_file(workspace, monkeypatch):
    def explode(source, destination):
        raise OSError("busy")

    monkeypatch.setattr(exporter.os, "replace", explode)
    with pytest.raises(OSError, match="busy"):
        run_export(workspace)
    assert sorted(path.name for path in workspace["json"].parent.iterdir()) == []


def test_display_path_falls_back_to_the_file_name_for_outside_inputs(workspace):
    assert exporter._display_path(workspace["report"], workspace["root"]) == "report.json"
    inside = workspace["root"] / "config/report.json"
    inside.write_text("{}\n", encoding="utf-8")
    assert exporter._display_path(inside, workspace["root"]) == "config/report.json"


def test_cli_exports_and_reports_failures(tmp_path):
    report = tmp_path / "report.json"
    report.write_text(json.dumps(full_report(), indent=2, sort_keys=True) + "\n", encoding="utf-8")
    out = tmp_path / "out"
    command = [
        sys.executable,
        str(exporter.ROOT / "tools/export_expression_agreement.py"),
        str(report),
        "--json", str(out / "summary.json"),
        "--replicates", str(out / "replicates.tsv"),
        "--responses", str(out / "responses.tsv"),
    ]
    result = subprocess.run(command, cwd=exporter.ROOT, capture_output=True, text=True, check=False)
    assert result.returncode == 0, result.stderr
    summary = json.loads((out / "summary.json").read_text(encoding="utf-8"))
    assert summary["reportFormat"] == "statistics-summary"
    assert len(read_table(out / "replicates.tsv")) == 3
    assert len(read_table(out / "responses.tsv")) == 3

    failed = tmp_path / "failed"
    broken = tmp_path / "broken.json"
    broken.write_text(json.dumps({"schemaVersion": 2}) + "\n", encoding="utf-8")
    command[2] = str(broken)
    for index, name in ((4, "summary.json"), (6, "replicates.tsv"), (8, "responses.tsv")):
        command[index] = str(failed / name)
    result = subprocess.run(command, cwd=exporter.ROOT, capture_output=True, text=True, check=False)
    assert result.returncode != 0
    assert "unsupported report schemaVersion" in result.stderr
    assert not failed.exists()


def test_module_entry_point_returns_zero(workspace, monkeypatch):
    monkeypatch.setattr(exporter, "ROOT", workspace["root"])
    assert exporter.main([
        str(workspace["report"]),
        "--json", str(workspace["json"]),
        "--replicates", str(workspace["replicates"]),
        "--responses", str(workspace["responses"]),
    ]) == 0
    assert workspace["json"].is_file()


def preserve_destinations(workspace):
    """Write a sentinel into all three destinations before a rejected request."""
    for label in ("json", "replicates", "responses"):
        workspace[label].write_text(f"preserve {label}\n", encoding="utf-8")


def assert_destinations_intact(workspace):
    for label in ("json", "replicates", "responses"):
        assert workspace[label].read_text(encoding="utf-8") == f"preserve {label}\n"


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        # The three statistics the review reported, together and on their own.
        (lambda payload: payload["responsePairs"][0].update(
            sharedGeneCount=-7, spearman="not-a-number", sameDirectionCount=999999),
         "response pair 0 sharedGeneCount must be a non-negative integer"),
        (lambda payload: payload["responsePairs"][0].update(spearman="not-a-number"),
         "response pair 0 spearman must be a finite number"),
        (lambda payload: payload["responsePairs"][0].update(spearman=True),
         "response pair 0 spearman must be a finite number"),
        (lambda payload: payload["responsePairs"][0].update(sameDirectionCount=999999),
         "sameDirectionCount exceeds its direction denominator"),
        (lambda payload: payload["responsePairs"][0].update(nonzeroDirectionGeneCount=3),
         "nonzeroDirectionGeneCount exceeds its shared genes"),
        (lambda payload: payload["responsePairs"][0].update(sharedGeneCount=3),
         "sharedGeneCount exceeds the responses of its contrasts"),
        (lambda payload: payload["responsePairs"][0].update(spearman=1.5),
         r"spearman must lie between -1.0 and 1.0, not 1.5"),
        (lambda payload: payload["responsePairs"][0].update(pearson=-1.5),
         r"pearson must lie between -1.0 and 1.0"),
        (lambda payload: payload["responsePairs"][0].update(signAgreementFraction=1.5),
         r"signAgreementFraction must lie between 0.0 and 1.0"),
        (lambda payload: payload["responsePairs"][0].update(signAgreementFraction=None),
         "signAgreementFraction must be null exactly when no shared response is directional"),
        (lambda payload: payload["responsePairs"][1].update(signAgreementFraction=0.5),
         "signAgreementFraction must be null exactly when no shared response is directional"),
        (lambda payload: payload["responsePairs"][0].update(signAgreementReason="unexpected"),
         "must state a signAgreementReason exactly when no shared response is directional"),
        (lambda payload: payload["responsePairs"][1].pop("signAgreementReason"),
         "must state a signAgreementReason exactly when no shared response is directional"),
        (lambda payload: payload["responsePairs"][1].pop("spearmanReason"),
         "response pair 1 spearmanReason must be a non-empty string"),
        (lambda payload: payload["responsePairs"][0].update(spearmanReason="unexpected"),
         "response pair 0 states a spearmanReason but its spearman is defined"),
        (lambda payload: payload["responsePairs"][0].update(pearsonReason="unexpected"),
         "response pair 0 states a pearsonReason but its pearson is defined"),
        (lambda payload: payload["responsePairs"][0].pop("caveat"),
         "response pair 0 has no 'caveat'"),
        (lambda payload: payload["responsePairs"][0].update(caveat=""),
         "response pair 0 caveat must be a non-empty string"),
        (lambda payload: payload["responsePairs"][0].update(right="alpha_shift"),
         "response pair 0 compares a contrast with itself"),
        # A null response value is not a statistic, and neither is a text one.
        (lambda payload: payload["contrasts"][0]["vector"].update(U1=None),
         "contrast 'alpha_shift' response 'U1' must be a finite number"),
        (lambda payload: payload["layers"][0]["means"].update(U1="high"),
         "layer 'alpha_ll' mean 'U1' must be a finite number"),
        # Layer structure the generator always writes.
        (lambda payload: payload["layers"][0].pop("conditions"),
         "layer 'alpha_ll' has no 'conditions'"),
        (lambda payload: payload["layers"][0].pop("units"), "layer 'alpha_ll' has no 'units'"),
        (lambda payload: payload["layers"][0].update(conditions=[]),
         "layer 'alpha_ll' conditions must be a JSON object"),
        (lambda payload: payload["layers"][0]["conditions"].update(temperature="hot"),
         "layer 'alpha_ll' condition 'temperature' must be a JSON object"),
        (lambda payload: payload["layers"][0].update(replicates="two"),
         "layer 'alpha_ll' replicates must be a JSON object"),
        (lambda payload: payload["layers"][0].update(normalization=""),
         "layer 'alpha_ll' normalization must be a non-empty string"),
        (lambda payload: payload["layers"][0].update(replicateType=None),
         "layer 'alpha_ll' replicateType must be a non-empty string"),
        (lambda payload: payload["layers"][0].update(label=7),
         "layer 'alpha_ll' label must be a non-empty string or null"),
        (lambda payload: payload["layers"][0].update(biologicalBandAvailable="yes"),
         "layer 'alpha_ll' biologicalBandAvailable must be true or false"),
        (lambda payload: payload["layers"][1].update(
            biologicalBandId="beta_single:empirical-sample-range"),
         "layer 'beta_single' names a biological band it does not declare available"),
        # Empirical ranges, their nulls and their stated reasons.
        (lambda payload: payload["layers"][0]["empiricalSampleRange"].pop("label"),
         "empiricalSampleRange has no 'label'"),
        (lambda payload: payload["layers"][0]["empiricalSampleRange"].update(label=""),
         "empiricalSampleRange label must be a non-empty string"),
        (lambda payload: payload["layers"][0]["empiricalSampleRange"].update(min=None),
         "min, median and max must be null exactly when no sample correlation is defined"),
        (lambda payload: payload["layers"][1]["empiricalSampleRange"].update(min=0.5),
         "min, median and max must be null exactly when no sample correlation is defined"),
        (lambda payload: payload["layers"][1]["empiricalSampleRange"].update(
            min=0.1, median=0.2, max=0.3),
         "min, median and max must be null exactly when no sample correlation is defined"),
        (lambda payload: payload["layers"][0]["empiricalSampleRange"].update(min=0.9),
         "empiricalSampleRange is not ordered min <= median <= max"),
        (lambda payload: payload["layers"][0]["empiricalSampleRange"].update(max=1.5),
         r"empiricalSampleRange max must lie between -1.0 and 1.0"),
        (lambda payload: payload["layers"][0]["empiricalSampleRange"].update(reason="unexpected"),
         "empiricalSampleRange states a reason but has defined sample correlations"),
        (lambda payload: payload["layers"][1]["empiricalSampleRange"].pop("reason"),
         "empiricalSampleRange reason must be a non-empty string"),
        # Strata, their columns and their sample correlations.
        (lambda payload: payload["layers"][0]["strata"][0].update(columns=[]),
         "columns must not be empty"),
        (lambda payload: payload["layers"][0]["strata"][0].update(columns=["t0_r1", "t0_r1"]),
         "columns repeats a name"),
        (lambda payload: payload["layers"][0]["strata"][0].update(columns=[None, "t0_r2"]),
         "columns entry 0 must be a non-empty string"),
        (lambda payload: payload["layers"][0]["strata"][0]["sampleCorrelations"][0].pop(
            "sampleLeft"),
         "correlation 0 has no 'sampleLeft'"),
        (lambda payload: payload["layers"][0]["strata"][0]["sampleCorrelations"][0].update(
            sampleRight="t0_r1"),
         "correlation 0 correlates a sample with itself"),
        (lambda payload: payload["layers"][0]["strata"][0]["sampleCorrelations"][0].update(
            sharedGeneCount=-1),
         "correlation 0 sharedGeneCount must be a non-negative integer"),
        (lambda payload: payload["layers"][0]["strata"][0]["sampleCorrelations"][0].update(
            spearman=1.2),
         r"correlation 0 spearman must lie between -1.0 and 1.0"),
        (lambda payload: payload["layers"][0]["strata"][0]["sampleCorrelations"][0].update(
            spearmanReason="unexpected"),
         "correlation 0 states a spearmanReason but its spearman is defined"),
        (lambda payload: payload["layers"][0]["strata"][0]["sampleCorrelations"][0].update(
            spearman=None),
         "correlation 0 spearmanReason must be a non-empty string"),
        # Contrast arms.
        (lambda payload: payload["contrasts"][0].update(label=""),
         "contrast 'alpha_shift' label must be a non-empty string"),
        (lambda payload: payload["contrasts"][0].pop("caveat"),
         "contrast 'alpha_shift' has no 'caveat'"),
        (lambda payload: payload["contrasts"][0].update(treatment=[]),
         "contrast 'alpha_shift' treatment must not be empty"),
        (lambda payload: payload["contrasts"][0].update(control=["c1", "c1"]),
         "contrast 'alpha_shift' control repeats a name"),
        (lambda payload: payload["contrasts"][0].update(control=["t1"]),
         r"contrast 'alpha_shift' names \['t1'\] in both arms"),
        # Level pairs and the references they carry.
        (lambda payload: payload["levelPairs"][0].update(sharedGeneCount=3),
         "level pair 0 sharedGeneCount exceeds the means of its layers"),
        (lambda payload: payload["levelPairs"][0].pop("spearman"),
         "level pair 0 has no 'spearman'"),
        (lambda payload: payload["levelPairs"][0].update(spearman=-2.0),
         r"level pair 0 spearman must lie between -1.0 and 1.0"),
        (lambda payload: payload["levelPairs"][0].update(spearman=None),
         "level pair 0 spearmanReason must be a non-empty string"),
        (lambda payload: payload["levelPairs"][0]["leftReference"].update(
            biologicalBandId="no-such-band"),
         "level pair 0 leftReference does not carry the biological band of layer 'alpha_ll'"),
        (lambda payload: payload["levelPairs"][0]["leftReference"].pop("biologicalBandId"),
         "level pair 0 leftReference does not carry the biological band of layer 'alpha_ll'"),
        (lambda payload: payload["levelPairs"][0]["rightReference"].update(
            biologicalBandId="beta_single:empirical-sample-range"),
         "level pair 0 rightReference does not carry the biological band of layer 'beta_single'"),
        # Methods and limitations.
        (lambda payload: payload.update(methods={}), "report methods must not be empty"),
        (lambda payload: payload.update(methods=[]), "report methods must be a JSON object"),
        (lambda payload: payload["methods"].update(contrast=""),
         "report method 'contrast' must be a non-empty string"),
        (lambda payload: payload.update(limitations=[]), "report limitations must not be empty"),
        (lambda payload: payload.update(limitations={}),
         "report limitations must be a JSON array"),
        (lambda payload: payload.update(limitations=[None]),
         "report limitation 0 must be a non-empty string"),
        # Input pins, including the checksums the report was read at.
        (lambda payload: payload["inputs"]["plan"].pop("sha256"),
         "report inputs plan sha256 must be a 64-character lowercase hexadecimal SHA-256"),
        (lambda payload: payload["inputs"]["plan"].update(sha256="A" * 64),
         "report inputs plan sha256 must be a 64-character lowercase hexadecimal SHA-256"),
        (lambda payload: payload["inputs"]["plan"].update(sha256="0" * 63),
         "report inputs plan sha256 must be a 64-character lowercase hexadecimal SHA-256"),
        (lambda payload: payload["inputs"].pop("crosswalk"),
         "report inputs crosswalk must be a JSON object"),
        (lambda payload: payload["inputs"]["crosswalk"].pop("sha256"),
         "report inputs crosswalk sha256 must be a 64-character"),
        (lambda payload: payload["inputs"].pop("specs"),
         "report inputs specs must be a JSON array"),
        (lambda payload: payload["inputs"].update(specs=[]),
         "report inputs specs must not be empty"),
        (lambda payload: payload["inputs"]["specs"][0].pop("studyId"),
         "report inputs spec 0 studyId must be a non-empty string"),
        (lambda payload: payload["inputs"]["specs"][0].pop("sha256"),
         "report inputs spec 0 sha256 must be a 64-character"),
        (lambda payload: payload["inputs"].pop("downloads"),
         "report inputs downloads must be a JSON array"),
        (lambda payload: payload["inputs"]["downloads"][0].pop("url"),
         "report inputs download 0 url must be a non-empty string"),
        (lambda payload: payload["inputs"]["downloads"][0].update(sha256="not-a-hash"),
         "report inputs download 0 sha256 must be a 64-character"),
    ],
)
def test_malformed_scientific_values_are_rejected(workspace, mutate, message):
    """EXP-R2: a complete-looking report with an invalid value writes nothing."""
    preserve_destinations(workspace)
    payload = copy.deepcopy(workspace["payload"])
    mutate(payload)
    write_report(workspace, payload)
    with pytest.raises(ValueError, match=message):
        run_export(workspace)
    assert_destinations_intact(workspace)


def test_the_valid_fixture_still_exports_after_the_value_checks(workspace):
    """The strengthened validator accepts the report the generator actually writes."""
    assert exporter.validate_full_report(copy.deepcopy(workspace["payload"]))
    run_export(workspace)
    assert json.loads(workspace["json"].read_text(encoding="utf-8"))["schemaVersion"] == 1


@pytest.mark.parametrize(
    ("left", "right"),
    [("result", "RESULT"), ("café.tsv", "café.tsv")],
)
def test_destinations_differing_only_by_alias_are_rejected(workspace, left, right):
    """EXP-R3: letter case and Unicode form name one file on this Mac's filesystem."""
    out = workspace["json"].parent
    workspace["json"] = out / left
    workspace["replicates"] = out / right
    with pytest.raises(ValueError, match="differ only in letter case or Unicode form"):
        run_export(workspace)
    assert list(out.iterdir()) == []


@pytest.mark.parametrize("label", ["json", "replicates", "responses"])
@pytest.mark.parametrize("directory", ["DATA", "Site"])
def test_publication_through_a_case_aliased_directory_is_rejected(workspace, label, directory):
    """EXP-R3: root/DATA is root/data wherever the filesystem folds case."""
    preserve_others(workspace, label)
    workspace[label] = workspace["root"] / directory / "export.out"
    with pytest.raises(ValueError, match=f"inside {directory.lower()}/"):
        run_export(workspace)
    assert_others_intact(workspace, label)
    assert list((workspace["root"] / directory.lower()).iterdir()) == []


def test_a_case_aliased_nested_destination_is_rejected(workspace):
    """EXP-R3: the EXP-R1 nesting check must fold aliases too."""
    nest = workspace["json"].parent / "new-output"
    workspace["json"] = nest
    workspace["replicates"] = nest.parent / "NEW-OUTPUT" / "nested.out"
    with pytest.raises(ValueError, match="json output would become a parent directory"):
        run_export(workspace)
    assert not nest.exists()
    assert not workspace["responses"].exists()


def test_a_case_aliased_pinned_input_cannot_be_overwritten(workspace):
    """EXP-R3: a protected source reached through a case variant is still protected."""
    plan = workspace["root"] / "config/expression_agreement.json"
    plan.write_text("pinned plan\n", encoding="utf-8")
    workspace["replicates"] = workspace["root"] / "CONFIG/expression_agreement.json"
    with pytest.raises(ValueError, match="would overwrite the pinned input config/"):
        run_export(workspace)
    assert plan.read_text(encoding="utf-8") == "pinned plan\n"


def test_alias_key_folds_case_and_unicode_form(tmp_path):
    assert exporter._alias_key(tmp_path / "Result") == exporter._alias_key(tmp_path / "rESULT")
    assert exporter._alias_key(tmp_path / "café") == exporter._alias_key(
        tmp_path / "café")
    assert exporter._alias_key(tmp_path / "one") != exporter._alias_key(tmp_path / "two")


@pytest.mark.parametrize("through", ["resolved-path", "declared-symlink"])
def test_a_pinned_input_outside_the_root_cannot_be_overwritten(workspace, through):
    """EXP-R4: a declared input is protected wherever it resolves, inside the root or not."""
    payload = copy.deepcopy(workspace["payload"])
    payload["inputs"]["plan"]["path"] = "config/pinned-plan.json"
    write_report(workspace, payload)
    outside = workspace["root"].parent / "external-plan.json"
    outside.write_text("ORIGINAL SOURCE\n", encoding="utf-8")
    declared = workspace["root"] / "config/pinned-plan.json"
    declared.symlink_to(outside)
    workspace["replicates"] = outside if through == "resolved-path" else declared
    with pytest.raises(ValueError, match="would overwrite the pinned input config/pinned-plan.json"):
        run_export(workspace)
    assert outside.read_text(encoding="utf-8") == "ORIGINAL SOURCE\n"
    assert not workspace["json"].exists()


def test_a_pinned_input_declared_above_the_root_cannot_be_overwritten(workspace):
    """EXP-R4: a relative pin that climbs out of the root is protected as well."""
    payload = copy.deepcopy(workspace["payload"])
    payload["inputs"]["specs"][0]["path"] = "../outside-spec.json"
    write_report(workspace, payload)
    outside = workspace["root"].parent / "outside-spec.json"
    outside.write_text("ORIGINAL SPEC\n", encoding="utf-8")
    workspace["responses"] = outside
    with pytest.raises(ValueError, match=r"would overwrite the pinned input \.\./outside-spec"):
        run_export(workspace)
    assert outside.read_text(encoding="utf-8") == "ORIGINAL SPEC\n"
    assert not workspace["json"].exists()


def test_an_unresolvable_pinned_input_is_rejected(workspace):
    """EXP-R4: a declared input that cannot be resolved is named, not skipped."""
    preserve_destinations(workspace)
    payload = copy.deepcopy(workspace["payload"])
    payload["inputs"]["plan"]["path"] = "config/loop.json"
    write_report(workspace, payload)
    loop = workspace["root"] / "config/loop.json"
    loop.symlink_to(loop)
    with pytest.raises(ValueError, match="the pinned input config/loop.json cannot be resolved"):
        run_export(workspace)
    assert_destinations_intact(workspace)
