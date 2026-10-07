import copy
import csv
import hashlib
import io
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

from tools import expression_agreement as agreement


CROSSWALK_HEADER = [
    "subject_locus_tag",
    "relationship",
    "object_id",
    "mapping_ambiguity",
]


def csv_bytes(header, rows):
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    writer.writerows(rows)
    return buffer.getvalue().encode("utf-8")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def write_crosswalk(root):
    path = root / "crosswalk.tsv"
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, delimiter="\t")
        writer.writerow(CROSSWALK_HEADER)
        for number in range(1, 7):
            writer.writerow([f"U{number}", "pcc7942_ortholog", f"S{number}", ""])
    return path


def base_spec(study_id, files, layers, *, normalization="cpm"):
    return {
        "studyId": study_id,
        "dataType": "transcriptomics",
        "platform": "RNA-seq",
        "strain": "PCC 7942",
        "units": "counts per million" if normalization == "cpm" else "as deposited",
        "normalization": normalization,
        "caveat": "Study-level caveat.",
        "replicates": {"count": 2, "text": "two biological replicates"},
        "conditions": {"temperature": {"status": "reported", "text": "30 °C"}},
        "reader": {"format": "csv", "idColumn": "id", "idKind": "pcc7942_rs"},
        "files": files,
        "layers": layers,
    }


def write_spec(root, name, spec):
    path = root / "specs" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    data = (json.dumps(spec, indent=2) + "\n").encode()
    path.write_bytes(data)
    return path.relative_to(root).as_posix(), digest(data)


@pytest.fixture
def fixture(tmp_path):
    root = tmp_path / "repo"
    interim = root / "interim"
    interim.mkdir(parents=True)
    crosswalk = write_crosswalk(root)

    part_a = csv_bytes(
        ["id", "t0_r1", "t0_r2", "b1"],
        [
            ["S1", 0, 0, 5],
            ["S2", 10, 20, 5],
            ["S3", 10, 20, 5],
            ["S4", "", 40, 5],
            ["S5", 30, 60, 5],
            ["X", 950, 860, 5],
        ],
    )
    part_b = csv_bytes(
        ["id", "t1_r1", "t1_r2", "b2"],
        [
            ["S1", 0, 0, 7],
            ["S2", 20, 40, 7],
            ["S3", 30, 60, 7],
            ["S4", 40, 80, 7],
            ["S5", 10, 20, 7],
            ["X", 900, 800, 7],
        ],
    )
    (interim / "part_a.csv").write_bytes(part_a)
    (interim / "part_b.csv").write_bytes(part_b)
    files_a = [
        {"name": "part_a.csv", "label": "part_a", "url": "https://example.test/a", "sha256": digest(part_a)},
        {"name": "part_b.csv", "label": "part_b", "url": "https://example.test/b", "sha256": digest(part_b)},
    ]
    a_columns = [
        "t0_r1 :: part_a",
        "t0_r2 :: part_a",
        "t1_r1 :: part_b",
        "t1_r2 :: part_b",
    ]
    b_columns = ["b1 :: part_a", "b2 :: part_b"]
    spec_a = base_spec(
        "A",
        files_a,
        [
            {
                "id": "A_time",
                "label": "Time course",
                "conditionSet": "two exact times",
                "columns": a_columns,
            },
            {
                "id": "A_unknown",
                "label": "Unknown replicate layer",
                "conditionSet": "one condition",
                "columns": b_columns,
                "strain": "PCC 7942 engineered",
                "caveat": "Layer-level caveat.",
                "conditions": {"lightIntensity": {"status": "not reported"}},
            },
        ],
    )
    spec_a_path, spec_a_sha = write_spec(root, "a.json", spec_a)

    short = csv_bytes(
        ["id", "control", "treatment"],
        [["S1", 1, 2], ["S2", 2, 1]],
    )
    (interim / "short.csv").write_bytes(short)
    spec_short = base_spec(
        "SHORT",
        [{"name": "short.csv", "url": "https://example.test/short", "sha256": digest(short)}],
        [{
            "id": "short_layer",
            "label": "Short layer",
            "conditionSet": "two unreplicated states",
            "columns": ["control", "treatment"],
        }],
        normalization="as-deposited",
    )
    spec_short_path, spec_short_sha = write_spec(root, "short.json", spec_short)

    plan = {
        "schemaVersion": 1,
        "studies": [
            {
                "spec": spec_a_path,
                "specSha256": spec_a_sha,
                "layers": [
                    {
                        "id": "A_time",
                        "replicateType": "biological",
                        "strata": [
                            {"id": "time 0", "columns": a_columns[:2]},
                            {"id": "time 1", "columns": a_columns[2:]},
                        ],
                    },
                    {
                        "id": "A_unknown",
                        "replicateType": "unknown",
                        "strata": [{"id": "condition", "columns": b_columns}],
                    },
                ],
                "contrasts": [
                    {
                        "id": "forward",
                        "label": "time 1 versus time 0",
                        "treatment": a_columns[2:],
                        "control": a_columns[:2],
                        "caveat": "Explicit time contrast.",
                    },
                    {
                        "id": "inverse",
                        "label": "time 0 versus time 1",
                        "treatment": a_columns[:2],
                        "control": a_columns[2:],
                        "caveat": "Exact inverse for calibration.",
                    },
                    {
                        "id": "zero",
                        "label": "equal normalized samples",
                        "treatment": [b_columns[1]],
                        "control": [b_columns[0]],
                        "caveat": "Both columns have the same processed distribution.",
                    },
                ],
            },
            {
                "spec": spec_short_path,
                "specSha256": spec_short_sha,
                "layers": [
                    {
                        "id": "short_layer",
                        "replicateType": "none",
                        "strata": [
                            {"id": "control state", "columns": ["control"]},
                            {"id": "treatment state", "columns": ["treatment"]},
                        ],
                    }
                ],
                "contrasts": [],
            },
        ],
        "responsePairs": [
            {"left": "forward", "right": "inverse", "caveat": "Expected inverse responses."},
            {"left": "forward", "right": "zero", "caveat": "Zero response has no direction."},
        ],
    }
    plan_path = root / "plan.json"
    plan_path.write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")
    return {
        "root": root,
        "interim": interim,
        "crosswalk": crosswalk,
        "plan": plan,
        "plan_path": plan_path,
        "output": root / "calibration" / "report.json",
    }


def build(item):
    return agreement.build_report(
        item["plan_path"], item["output"], item["interim"], item["crosswalk"], root=item["root"])


def write_plan(item, plan):
    item["plan_path"].write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")


def test_report_uses_exact_joins_per_sample_cpm_and_time_strata(fixture):
    report = build(fixture)
    by_layer = {layer["id"]: layer for layer in report["layers"]}
    time = by_layer["A_time"]

    assert time["meanGeneCount"] == 4
    assert time["means"]["U2"] == pytest.approx(22_500), (
        "the unmapped X count contributes to each sample's CPM denominator before mapping"
    )
    assert [len(stratum["sampleCorrelations"]) for stratum in time["strata"]] == [1, 1]
    assert time["strata"][0]["sampleCorrelations"][0] == {
        "sampleLeft": "t0_r1 :: part_a",
        "sampleRight": "t0_r2 :: part_a",
        "sharedGeneCount": 4,
        "spearman": pytest.approx(1.0),
    }
    assert time["empiricalSampleRange"]["median"] == pytest.approx(1.0)
    assert "not a confidence interval" in time["empiricalSampleRange"]["label"]
    assert time["biologicalBandAvailable"] is True
    assert by_layer["A_unknown"]["replicateType"] == "unknown"
    assert by_layer["A_unknown"]["biologicalBandAvailable"] is False
    assert by_layer["A_unknown"]["strain"] == "PCC 7942 engineered"
    assert by_layer["A_unknown"]["label"] == "Unknown replicate layer"
    assert by_layer["A_unknown"]["conditionSet"] == "one condition"
    assert by_layer["A_unknown"]["units"] == "counts per million"
    assert by_layer["A_unknown"]["normalization"] == "cpm"
    assert by_layer["A_unknown"]["caveat"] == "Layer-level caveat."
    assert by_layer["A_unknown"]["replicates"]["text"] == "two biological replicates"
    assert by_layer["A_unknown"]["conditions"] == {
        "temperature": {"status": "reported", "text": "30 °C"},
        "lightIntensity": {"status": "not reported"},
    }
    assert by_layer["short_layer"]["strata"][0]["sampleCorrelations"] == []
    assert by_layer["short_layer"]["biologicalBandAvailable"] is False
    assert by_layer["short_layer"]["empiricalSampleRange"]["min"] is None


def test_level_pairs_report_ties_constants_short_vectors_and_references(fixture):
    report = build(fixture)
    pairs = {(pair["left"], pair["right"]): pair for pair in report["levelPairs"]}
    constant = pairs[("A_time", "A_unknown")]
    assert constant["sharedGeneCount"] == 4
    assert constant["spearman"] is None
    assert constant["spearmanReason"] == "constant_right_vector"
    assert constant["leftReference"]["biologicalBandId"] == "A_time:empirical-sample-range"
    assert "biologicalBandId" not in constant["rightReference"]

    short = pairs[("A_time", "short_layer")]
    assert short["sharedGeneCount"] == 2
    assert short["spearman"] is None
    assert short["spearmanReason"] == "fewer_than_three_shared_genes"


def test_contrasts_exclude_zero_and_response_pairs_keep_denominators(fixture):
    report = build(fixture)
    contrasts = {contrast["id"]: contrast for contrast in report["contrasts"]}
    forward = contrasts["forward"]
    assert forward["measuredIntersectionCount"] == 4
    assert forward["positiveGeneCount"] == 3
    assert forward["excludedZeroCount"] == 1
    assert forward["vector"] == {
        "U2": pytest.approx(1.0),
        "U3": pytest.approx(1.584962500721156),
        "U5": pytest.approx(-1.5849625007211563),
    }

    pairs = {(pair["left"], pair["right"]): pair for pair in report["responsePairs"]}
    inverse = pairs[("forward", "inverse")]
    assert inverse["sharedGeneCount"] == 3
    assert inverse["spearman"] == pytest.approx(-1)
    assert inverse["pearson"] == pytest.approx(-1)
    assert inverse["sameDirectionCount"] == 0
    assert inverse["nonzeroDirectionGeneCount"] == 3
    assert inverse["signAgreementFraction"] == 0

    zero = pairs[("forward", "zero")]
    assert zero["sharedGeneCount"] == 3
    assert zero["spearman"] is None
    assert zero["spearmanReason"] == "constant_right_vector"
    assert zero["signAgreementFraction"] is None
    assert zero["nonzeroDirectionGeneCount"] == 0
    assert zero["signAgreementReason"] == "no_shared_nonzero_responses"


def test_output_is_deterministic_pinned_and_never_nan(fixture):
    first = build(fixture)
    first_bytes = fixture["output"].read_bytes()
    second = build(fixture)
    assert first == second
    assert fixture["output"].read_bytes() == first_bytes
    assert b"NaN" not in first_bytes
    assert first["inputs"]["plan"]["sha256"] == digest(fixture["plan_path"].read_bytes())
    assert first["inputs"]["crosswalk"]["sha256"] == digest(fixture["crosswalk"].read_bytes())
    assert {pin["name"] for pin in first["inputs"]["downloads"]} == {
        "part_a.csv", "part_b.csv", "short.csv"
    }
    assert any("different aggregation denominators" in text for text in first["limitations"])


def test_empty_statistics_are_null_with_reasons():
    assert agreement._correlation({}, {}, "spearman") == (
        0, None, "fewer_than_three_shared_genes")
    assert agreement._sample_pair("a", "b", {"a": {}, "b": {}}) == {
        "sampleLeft": "a",
        "sampleRight": "b",
        "sharedGeneCount": 0,
        "spearman": None,
        "spearmanReason": "fewer_than_three_shared_genes",
    }
    response = agreement._response_pair_report(
        {"left": "a", "right": "b", "caveat": "Empty vectors."},
        {"a": {"vector": {}}, "b": {"vector": {}}},
    )
    assert response["sharedGeneCount"] == 0
    assert response["spearman"] is None
    assert response["pearson"] is None
    assert response["signAgreementFraction"] is None
    assert response["signAgreementReason"] == "no_shared_nonzero_responses"
    shared, value, reason = agreement._correlation(
        {"a": 1, "b": 1, "c": 1}, {"a": 1, "b": 2, "c": 3}, "spearman")
    assert (shared, value, reason) == (3, None, "constant_left_vector")


def test_biological_group_without_defined_correlation_has_no_band(fixture):
    plan = copy.deepcopy(fixture["plan"])
    plan["studies"][1]["layers"][0]["replicateType"] = "biological"
    write_plan(fixture, plan)
    layer = {item["id"]: item for item in build(fixture)["layers"]}["short_layer"]
    assert layer["biologicalBandAvailable"] is False
    assert "biologicalBandId" not in layer


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (lambda plan: plan.update(schemaVersion=2), "unsupported plan schemaVersion"),
        (lambda plan: plan["studies"][0]["layers"].pop(), "must list every spec layer once"),
        (
            lambda plan: plan["studies"][0]["layers"][0]["strata"][0]["columns"].append(
                "t1_r1 :: part_b"),
            "strata columns overlap",
        ),
        (
            lambda plan: plan["studies"][1]["layers"][0]["strata"][0]["columns"].append("treatment"),
            "replicateType none requires one column",
        ),
        (
            lambda plan: plan["studies"][0]["contrasts"][0]["control"].append("t1_r1 :: part_b"),
            "treatment and control overlap",
        ),
        (
            lambda plan: plan["responsePairs"].append(
                {"left": "inverse", "right": "forward", "caveat": "duplicate"}),
            "duplicate unordered response pair",
        ),
        (
            lambda plan: plan["studies"][0]["contrasts"][0].update(treatment=[]),
            "treatment must not be empty",
        ),
    ],
)
def test_plan_validation_rejects_invalid_grouping_before_writing(fixture, mutate, message):
    fixture["output"].parent.mkdir(parents=True)
    fixture["output"].write_text("old output\n", encoding="utf-8")
    plan = copy.deepcopy(fixture["plan"])
    mutate(plan)
    write_plan(fixture, plan)
    with pytest.raises(ValueError, match=message):
        build(fixture)
    assert fixture["output"].read_text(encoding="utf-8") == "old output\n"


def test_plan_shape_text_and_digest_validation_paths(fixture):
    cases = []
    cases.append(([], "plan must be an object"))

    missing_key = copy.deepcopy(fixture["plan"])
    missing_key.pop("responsePairs")
    cases.append((missing_key, "missing"))

    extra_key = copy.deepcopy(fixture["plan"])
    extra_key["unexpected"] = True
    cases.append((extra_key, "unsupported"))

    studies_object = copy.deepcopy(fixture["plan"])
    studies_object["studies"] = {}
    cases.append((studies_object, "plan.studies must be a list"))

    no_studies = copy.deepcopy(fixture["plan"])
    no_studies["studies"] = []
    cases.append((no_studies, "plan.studies must not be empty"))

    blank_spec = copy.deepcopy(fixture["plan"])
    blank_spec["studies"][0]["spec"] = " "
    cases.append((blank_spec, "must be non-empty text"))

    bad_digest = copy.deepcopy(fixture["plan"])
    bad_digest["studies"][0]["specSha256"] = "A" * 64
    cases.append((bad_digest, "lowercase SHA-256 digest"))

    response_object = copy.deepcopy(fixture["plan"])
    response_object["responsePairs"] = {}
    cases.append((response_object, "plan.responsePairs must be a list"))

    for invalid, message in cases:
        fixture["plan_path"].write_text(json.dumps(invalid) + "\n", encoding="utf-8")
        with pytest.raises(ValueError, match=message):
            build(fixture)


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (
            lambda plan: plan["studies"].append(copy.deepcopy(plan["studies"][0])),
            "more than once",
        ),
        (
            lambda plan: plan["studies"][0]["layers"].append(
                copy.deepcopy(plan["studies"][0]["layers"][0])),
            "layer id 'A_time' appears more than once",
        ),
        (
            lambda plan: plan["studies"][0]["layers"][0]["strata"][1].update(id="time 0"),
            "stratum ids must be unique",
        ),
        (
            lambda plan: plan["studies"][0]["contrasts"][1].update(id="forward"),
            "contrast ids must be globally unique",
        ),
        (
            lambda plan: plan["studies"][0]["layers"][0].update(replicateType="technical"),
            "unsupported replicateType",
        ),
        (
            lambda plan: plan["studies"][0]["layers"][0]["strata"][1]["columns"].pop(),
            "disjoint exact cover",
        ),
        (
            lambda plan: plan["responsePairs"][0].update(right="forward"),
            "two distinct contrasts",
        ),
        (
            lambda plan: plan["responsePairs"][0].update(right="missing"),
            "references an unknown contrast",
        ),
    ],
)
def test_duplicate_reference_and_cover_validation_paths(fixture, mutate, message):
    plan = copy.deepcopy(fixture["plan"])
    mutate(plan)
    write_plan(fixture, plan)
    with pytest.raises(ValueError, match=message):
        build(fixture)


@pytest.mark.parametrize("spec_value", ["/absolute/spec.json", "specs/missing.json"])
def test_absolute_and_missing_spec_paths_fail(fixture, spec_value):
    plan = copy.deepcopy(fixture["plan"])
    plan["studies"][0]["spec"] = spec_value
    write_plan(fixture, plan)
    expected = "repository-relative" if spec_value.startswith("/") else "does not exist"
    with pytest.raises(ValueError, match=expected):
        build(fixture)


def test_spec_pin_root_escape_and_unsupported_spec_fail_before_output(fixture):
    plan = copy.deepcopy(fixture["plan"])
    plan["studies"][0]["specSha256"] = "0" * 64
    write_plan(fixture, plan)
    with pytest.raises(ValueError, match="spec checksum mismatch"):
        build(fixture)
    assert not fixture["output"].exists()

    plan = copy.deepcopy(fixture["plan"])
    plan["studies"][0]["spec"] = "../outside.json"
    write_plan(fixture, plan)
    with pytest.raises(ValueError, match="escapes the repository root"):
        build(fixture)

    spec_path = fixture["root"] / fixture["plan"]["studies"][0]["spec"]
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    spec["platform"] = "microarray"
    spec_path.write_text(json.dumps(spec) + "\n", encoding="utf-8")
    plan = copy.deepcopy(fixture["plan"])
    plan["studies"][0]["specSha256"] = digest(spec_path.read_bytes())
    write_plan(fixture, plan)
    with pytest.raises(ValueError, match="only RNA-seq platform is supported"):
        build(fixture)


@pytest.mark.parametrize(
    ("updates", "message"),
    [
        ({"dataType": "fitness"}, "only transcriptomics dataType is supported"),
        ({"signed": True}, "signed scales are unsupported"),
        ({"normalization": "log2"}, "unsupported normalization"),
    ],
)
def test_unsupported_spec_modes_fail_loudly(fixture, updates, message):
    spec_path = fixture["root"] / fixture["plan"]["studies"][0]["spec"]
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    spec.update(updates)
    spec_path.write_text(json.dumps(spec) + "\n", encoding="utf-8")
    plan = copy.deepcopy(fixture["plan"])
    plan["studies"][0]["specSha256"] = digest(spec_path.read_bytes())
    write_plan(fixture, plan)
    with pytest.raises(ValueError, match=message):
        build(fixture)


def test_unsupported_identifier_and_source_shapes_fail(fixture):
    spec_path = fixture["root"] / fixture["plan"]["studies"][0]["spec"]
    original = json.loads(spec_path.read_text(encoding="utf-8"))

    cases = []
    bad_id = copy.deepcopy(original)
    bad_id["reader"]["idKind"] = "gene_symbol"
    cases.append((bad_id, "unsupported RNA-seq idKind"))
    both_sources = copy.deepcopy(original)
    both_sources["file"] = both_sources["files"][0]
    cases.append((both_sources, "exactly one of file or files is required"))
    empty_sources = copy.deepcopy(original)
    empty_sources["files"] = []
    cases.append((empty_sources, "files must not be empty"))
    non_object_source = copy.deepcopy(original)
    non_object_source["files"] = ["not an object"]
    cases.append((non_object_source, "file 0 must be an object"))
    blank_source_name = copy.deepcopy(original)
    blank_source_name["files"][0]["name"] = ""
    cases.append((blank_source_name, "name must be non-empty text"))
    bad_source_digest = copy.deepcopy(original)
    bad_source_digest["files"][0]["sha256"] = "bad"
    cases.append((bad_source_digest, "lowercase SHA-256 digest"))

    for invalid_spec, message in cases:
        spec_path.write_text(json.dumps(invalid_spec) + "\n", encoding="utf-8")
        plan = copy.deepcopy(fixture["plan"])
        plan["studies"][0]["specSha256"] = digest(spec_path.read_bytes())
        write_plan(fixture, plan)
        with pytest.raises(ValueError, match=message):
            build(fixture)


def test_source_target_escape_and_conflicting_pins_fail(fixture):
    first_spec_path = fixture["root"] / fixture["plan"]["studies"][0]["spec"]
    original_first_spec = json.loads(first_spec_path.read_text(encoding="utf-8"))
    first_spec = copy.deepcopy(original_first_spec)
    first_spec["files"][0]["name"] = "../escape.csv"
    first_spec_path.write_text(json.dumps(first_spec) + "\n", encoding="utf-8")
    plan = copy.deepcopy(fixture["plan"])
    plan["studies"][0]["specSha256"] = digest(first_spec_path.read_bytes())
    write_plan(fixture, plan)
    with pytest.raises(ValueError, match="escapes the interim directory"):
        build(fixture)

    first_spec_path.write_text(json.dumps(original_first_spec) + "\n", encoding="utf-8")
    short_spec_path = fixture["root"] / fixture["plan"]["studies"][1]["spec"]
    short_spec = json.loads(short_spec_path.read_text(encoding="utf-8"))
    short_spec["files"][0]["name"] = "part_a.csv"
    short_spec_path.write_text(json.dumps(short_spec) + "\n", encoding="utf-8")
    plan = copy.deepcopy(fixture["plan"])
    plan["studies"][0]["specSha256"] = digest(first_spec_path.read_bytes())
    plan["studies"][1]["specSha256"] = digest(short_spec_path.read_bytes())
    write_plan(fixture, plan)
    with pytest.raises(ValueError, match="conflicting pins target the same interim file"):
        build(fixture)


def test_checksum_failure_and_output_safety_leave_existing_output_untouched(fixture):
    fixture["output"].parent.mkdir(parents=True)
    fixture["output"].write_text("keep me\n", encoding="utf-8")
    (fixture["interim"] / "part_a.csv").write_bytes(b"tampered")
    with pytest.raises(ValueError, match="checksum mismatch"):
        build(fixture)
    assert fixture["output"].read_text(encoding="utf-8") == "keep me\n"

    fixture["output"] = fixture["root"] / "data" / "report.json"
    with pytest.raises(ValueError, match="output must not be inside data"):
        build(fixture)
    fixture["output"] = fixture["plan_path"]
    with pytest.raises(ValueError, match="overwrite an input"):
        build(fixture)


def test_cli_success_and_failure(fixture, monkeypatch):
    monkeypatch.setattr(agreement, "ROOT", fixture["root"])
    assert agreement.main([
        str(fixture["plan_path"]),
        str(fixture["output"]),
        "--interim", str(fixture["interim"]),
        "--crosswalk", str(fixture["crosswalk"]),
    ]) == 0
    assert fixture["output"].is_file()

    with pytest.raises(ValueError, match="output must not be inside site"):
        agreement.main([
            str(fixture["plan_path"]),
            str(fixture["root"] / "site" / "report.json"),
            "--interim", str(fixture["interim"]),
            "--crosswalk", str(fixture["crosswalk"]),
        ])


def test_real_subprocess_cli_entry_point():
    with tempfile.TemporaryDirectory(prefix=".expression-agreement-", dir=agreement.ROOT) as directory:
        work = Path(directory)
        interim = work / "interim"
        interim.mkdir()
        table = csv_bytes(["id", "sample"], [["S1", 1], ["S2", 2], ["S3", 3]])
        (interim / "table.csv").write_bytes(table)
        crosswalk = write_crosswalk(work)
        spec = base_spec(
            "CLI",
            [{"name": "table.csv", "url": "https://example.test/table", "sha256": digest(table)}],
            [{
                "id": "cli_layer",
                "label": "CLI layer",
                "conditionSet": "one sample",
                "columns": ["sample"],
            }],
            normalization="as-deposited",
        )
        spec["file"] = spec.pop("files")[0]
        spec_path = work / "spec.json"
        spec_path.write_text(json.dumps(spec) + "\n", encoding="utf-8")
        plan = {
            "schemaVersion": 1,
            "studies": [{
                "spec": spec_path.relative_to(agreement.ROOT).as_posix(),
                "specSha256": digest(spec_path.read_bytes()),
                "layers": [{
                    "id": "cli_layer",
                    "replicateType": "none",
                    "strata": [{"id": "sample", "columns": ["sample"]}],
                }],
                "contrasts": [],
            }],
            "responsePairs": [],
        }
        plan_path = work / "plan.json"
        plan_path.write_text(json.dumps(plan) + "\n", encoding="utf-8")
        output = work / "report.json"
        command = [
            sys.executable,
            str(agreement.ROOT / "tools" / "expression_agreement.py"),
            str(plan_path),
            str(output),
            "--interim", str(interim),
            "--crosswalk", str(crosswalk),
        ]
        result = subprocess.run(command, cwd=agreement.ROOT, capture_output=True, text=True, check=False)
        assert result.returncode == 0, result.stderr
        assert json.loads(output.read_text(encoding="utf-8"))["layers"][0]["id"] == "cli_layer"

        plan["schemaVersion"] = 2
        plan_path.write_text(json.dumps(plan) + "\n", encoding="utf-8")
        failed_output = work / "failed.json"
        command[3] = str(failed_output)
        result = subprocess.run(command, cwd=agreement.ROOT, capture_output=True, text=True, check=False)
        assert result.returncode != 0
        assert "unsupported plan schemaVersion" in result.stderr
        assert not failed_output.exists()


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (
            lambda plan: plan["studies"][0]["layers"][0]["strata"][0]["columns"].append(
                "t0_r1 :: part_a"),
            "contains duplicates",
        ),
        (
            lambda plan: plan["studies"][0]["layers"][0].update(id="unknown_layer"),
            "not an exact spec layer id",
        ),
        (
            lambda plan: plan["studies"][0]["contrasts"][0].update(treatment=["unknown_column"]),
            "not in an admitted layer",
        ),
    ],
)
def test_unknown_and_duplicate_sample_scope_is_rejected(fixture, mutate, message):
    plan = copy.deepcopy(fixture["plan"])
    mutate(plan)
    write_plan(fixture, plan)
    with pytest.raises(ValueError, match=message):
        build(fixture)
    assert not fixture["output"].exists()


@pytest.mark.parametrize("duplicate", ["layer", "study"])
def test_duplicate_identity_in_pinned_specs_is_rejected(fixture, duplicate):
    index = 0 if duplicate == "layer" else 1
    plan = copy.deepcopy(fixture["plan"])
    spec_path = fixture["root"] / plan["studies"][index]["spec"]
    spec = json.loads(spec_path.read_text())
    if duplicate == "layer":
        spec["layers"].append(copy.deepcopy(spec["layers"][0]))
        message = "spec layer ids must be unique"
    else:
        spec["studyId"] = "A"
        message = "listed by more than one spec"
    spec_path.write_text(json.dumps(spec) + "\n")
    plan["studies"][index]["specSha256"] = digest(spec_path.read_bytes())
    write_plan(fixture, plan)
    with pytest.raises(ValueError, match=message):
        build(fixture)
    assert not fixture["output"].exists()


def test_missing_crosswalk_preserves_existing_output(fixture):
    fixture["output"].parent.mkdir(parents=True)
    fixture["output"].write_text("preserve existing report\n")
    fixture["crosswalk"].unlink()
    with pytest.raises(ValueError, match="crosswalk does not exist"):
        build(fixture)
    assert fixture["output"].read_text() == "preserve existing report\n"


def test_unknown_and_nonfinite_correlation_results(monkeypatch):
    vector = {"a": 1.0, "b": 2.0, "c": 3.0}
    with pytest.raises(ValueError, match="unknown correlation kind"):
        agreement._correlation(vector, vector, "unknown")
    monkeypatch.setattr(
        agreement.stats, "spearmanr", lambda *args: type("Result", (), {"statistic": float("nan")})()
    )
    assert agreement._correlation(vector, vector, "spearman") == (
        3, None, "undefined_correlation"
    )


def test_pinned_symlink_cache_reproduces_report_and_protects_input(fixture):
    original = build(fixture)
    linked_cache = fixture["root"].parent / "linked-cache"
    linked_cache.mkdir()
    for source in fixture["interim"].iterdir():
        (linked_cache / source.name).symlink_to(source)
    fixture["interim"] = linked_cache
    assert build(fixture) == original

    # Output aliases must still protect the actual source behind the cache link.
    source = linked_cache / "part_a.csv"
    before = source.read_bytes()
    fixture["output"] = source.resolve()
    with pytest.raises(ValueError, match="overwrite an input"):
        build(fixture)
    assert source.read_bytes() == before


@pytest.mark.parametrize("name", [".", "..", "/absolute.csv", "nested/file.csv", "nested\\file.csv"])
def test_cache_names_reject_traversal_and_path_components(tmp_path, name):
    with pytest.raises(ValueError, match="escapes the interim directory"):
        agreement._source_target(tmp_path, name)


def test_current_calibration_plan_pins_match_the_shipped_source_specs():
    _, studies = agreement.load_and_validate_plan(
        agreement.ROOT / "config" / "expression_agreement.json"
    )
    assert {study.spec["studyId"] for study in studies} >= {"GSE237858", "GSE252562"}


def test_current_summary_preserves_sampling_temperature_corrections_and_source_pins():
    root = agreement.ROOT
    plan_path = root / "config" / "expression_agreement.json"
    _, studies = agreement.load_and_validate_plan(plan_path)
    summary = json.loads((
        root / "docs/notes/handoff/cyano_processed_expression_agreement_current_20261007.json"
    ).read_text())
    assert summary["inputs"]["plan"]["sha256"] == digest(plan_path.read_bytes())
    assert summary["implementation"]["sha256"] == digest(
        (root / "tools/expression_agreement.py").read_bytes()
    )
    summary_pins = {spec["path"]: spec["sha256"] for spec in summary["inputs"]["specs"]}
    assert summary_pins == {study.spec_relative: study.spec_sha256 for study in studies}
    by_layer = {layer["id"]: layer for layer in summary["layers"]}
    corrected_layers = 0
    for study in studies:
        if study.spec["studyId"] not in {"GSE237858", "GSE252562"}:
            continue
        for layer in study.spec["layers"]:
            expected = layer.get("conditions", {}).get(
                "temperature", study.spec["conditions"]["temperature"]
            )
            actual = by_layer[layer["id"]]["conditions"]["temperature"]
            assert actual == expected
            assert actual["status"] == "not reported"
            assert actual["lo"] is None and actual["hi"] is None
            corrected_layers += 1
    assert corrected_layers == 7
