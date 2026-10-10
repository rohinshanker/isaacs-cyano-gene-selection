import copy
import csv
import hashlib
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
    correlations = [value for stratum in strata for value in stratum[1]]
    defined = [value for value in correlations if value is not None]
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
            for stratum_id, values, columns in (
                (item[0], item[1], item[2]) for item in strata
            )
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
