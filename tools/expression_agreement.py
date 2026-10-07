#!/usr/bin/env python3
"""Compute descriptive agreement statistics from explicitly reviewed RNA-seq groups.

Usage:
    expression_agreement.py PLAN OUTPUT --interim DIR [--crosswalk PATH]

The plan, rather than column-name heuristics, supplies replicate strata and
contrasts.  Every downloaded input and repository spec is checksum-verified
before the report is written.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import statistics
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence

from scipy import stats

try:  # Importable as tools.expression_agreement and executable as a script.
    from tools import ingest_expression as ingest
except ModuleNotFoundError:  # pragma: no cover - exercised by subprocess use.
    import ingest_expression as ingest  # type: ignore[no-redef]


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CROSSWALK = ingest.DEFAULT_CROSSWALK
PLAN_KEYS = {"schemaVersion", "studies", "responsePairs"}
STUDY_KEYS = {"spec", "specSha256", "layers", "contrasts"}
LAYER_KEYS = {"id", "replicateType", "strata"}
STRATUM_KEYS = {"id", "columns"}
CONTRAST_KEYS = {"id", "label", "treatment", "control", "caveat"}
RESPONSE_PAIR_KEYS = {"left", "right", "caveat"}
REPLICATE_TYPES = {"biological", "unknown", "none"}
SUPPORTED_NORMALISATIONS = {"cpm", "as-deposited"}
SHA256_LENGTH = 64


@dataclass(frozen=True)
class StudyPlan:
    """A validated study plan and its pinned repository spec."""

    spec_path: Path
    spec_relative: str
    spec_sha256: str
    spec: Mapping[str, Any]
    layers: tuple[Mapping[str, Any], ...]
    contrasts: tuple[Mapping[str, Any], ...]


@dataclass
class ProcessedStudy:
    """Normalised source and mapped vectors needed by report assembly."""

    plan: StudyPlan
    sample_mapped: dict[str, dict[str, float]]
    layer_means: dict[str, dict[str, float]]


def _expect_object(value: Any, context: str) -> Mapping[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{context} must be an object")
    return value


def _expect_keys(value: Mapping[str, Any], expected: set[str], context: str) -> None:
    missing = expected - set(value)
    extra = set(value) - expected
    if missing or extra:
        details = []
        if missing:
            details.append(f"missing {sorted(missing)}")
        if extra:
            details.append(f"unsupported {sorted(extra)}")
        raise ValueError(f"{context} has " + " and ".join(details))


def _expect_list(value: Any, context: str, *, nonempty: bool = False) -> list[Any]:
    if not isinstance(value, list):
        raise ValueError(f"{context} must be a list")
    if nonempty and not value:
        raise ValueError(f"{context} must not be empty")
    return value


def _text(value: Any, context: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{context} must be non-empty text")
    return value


def _string_list(value: Any, context: str, *, nonempty: bool = True) -> list[str]:
    items = _expect_list(value, context, nonempty=nonempty)
    strings = [_text(item, f"{context} item") for item in items]
    if len(strings) != len(set(strings)):
        raise ValueError(f"{context} contains duplicates")
    return strings


def _sha256_text(value: Any, context: str) -> str:
    digest = _text(value, context)
    if len(digest) != SHA256_LENGTH or any(char not in "0123456789abcdef" for char in digest):
        raise ValueError(f"{context} must be a lowercase SHA-256 digest")
    return digest


def _repo_path(relative: str, root: Path, context: str) -> Path:
    candidate = Path(relative)
    if candidate.is_absolute():
        raise ValueError(f"{context} must be repository-relative")
    resolved = (root / candidate).resolve()
    if not resolved.is_relative_to(root.resolve()):
        raise ValueError(f"{context} escapes the repository root")
    return resolved


def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _validate_spec(spec: Mapping[str, Any], context: str) -> None:
    if spec.get("dataType") != "transcriptomics":
        raise ValueError(f"{context}: only transcriptomics dataType is supported")
    if spec.get("platform") != "RNA-seq":
        raise ValueError(f"{context}: only RNA-seq platform is supported")
    if spec.get("signed"):
        raise ValueError(f"{context}: signed scales are unsupported")
    if spec.get("normalization") not in SUPPORTED_NORMALISATIONS:
        raise ValueError(f"{context}: unsupported normalization {spec.get('normalization')!r}")
    reader = _expect_object(spec.get("reader"), f"{context}.reader")
    if reader.get("idKind") not in ingest.ID_RELATIONSHIPS:
        raise ValueError(f"{context}: unsupported RNA-seq idKind {reader.get('idKind')!r}")
    layers = _expect_list(spec.get("layers"), f"{context}.layers", nonempty=True)
    layer_ids: list[str] = []
    for index, raw_layer in enumerate(layers):
        layer = _expect_object(raw_layer, f"{context}.layers[{index}]")
        layer_id = _text(layer.get("id"), f"{context}.layers[{index}].id")
        _string_list(layer.get("columns"), f"{context} layer {layer_id} columns")
        layer_ids.append(layer_id)
    if len(layer_ids) != len(set(layer_ids)):
        raise ValueError(f"{context}: spec layer ids must be unique")

    has_file = "file" in spec
    has_files = "files" in spec
    if has_file == has_files:
        raise ValueError(f"{context}: exactly one of file or files is required")
    sources = spec["files"] if has_files else [spec["file"]]
    for index, raw_source in enumerate(_expect_list(sources, f"{context} files", nonempty=True)):
        source = _expect_object(raw_source, f"{context} file {index}")
        _text(source.get("name"), f"{context} file {index} name")
        _text(source.get("url"), f"{context} file {index} url")
        _sha256_text(source.get("sha256"), f"{context} file {index} sha256")


def load_and_validate_plan(plan_path: Path, root: Path = ROOT) -> tuple[Mapping[str, Any], list[StudyPlan]]:
    """Load a schema-v1 plan and verify every referenced repository spec."""
    plan = _expect_object(json.loads(plan_path.read_text(encoding="utf-8")), "plan")
    _expect_keys(plan, PLAN_KEYS, "plan")
    if type(plan["schemaVersion"]) is not int or plan["schemaVersion"] != 1:
        raise ValueError(f"unsupported plan schemaVersion {plan['schemaVersion']!r}")

    studies_raw = _expect_list(plan["studies"], "plan.studies", nonempty=True)
    study_plans: list[StudyPlan] = []
    seen_specs: set[str] = set()
    seen_study_ids: set[str] = set()
    seen_layer_ids: set[str] = set()
    contrast_ids: list[str] = []

    for study_index, raw_study in enumerate(studies_raw):
        study = _expect_object(raw_study, f"plan.studies[{study_index}]")
        _expect_keys(study, STUDY_KEYS, f"plan.studies[{study_index}]")
        relative = _text(study["spec"], f"plan.studies[{study_index}].spec")
        if relative in seen_specs:
            raise ValueError(f"plan lists spec {relative!r} more than once")
        seen_specs.add(relative)
        path = _repo_path(relative, root, f"plan study spec {relative!r}")
        if not path.is_file():
            raise ValueError(f"plan study spec {relative!r} does not exist")
        expected_digest = _sha256_text(
            study["specSha256"], f"plan.studies[{study_index}].specSha256")
        observed_digest = _sha256_file(path)
        if observed_digest != expected_digest:
            raise ValueError(
                f"spec checksum mismatch for {relative}: expected {expected_digest}, got {observed_digest}")
        spec = _expect_object(json.loads(path.read_text(encoding="utf-8")), f"spec {relative}")
        _validate_spec(spec, f"spec {relative}")
        study_id = _text(spec.get("studyId"), f"spec {relative}.studyId")
        if study_id in seen_study_ids:
            raise ValueError(f"studyId {study_id!r} is listed by more than one spec")
        seen_study_ids.add(study_id)
        spec_layers = {layer["id"]: layer for layer in spec["layers"]}

        planned_layers = _expect_list(
            study["layers"], f"plan study {study_id} layers", nonempty=True)
        plan_layer_ids: list[str] = []
        validated_layers: list[Mapping[str, Any]] = []
        for layer_index, raw_layer in enumerate(planned_layers):
            context = f"plan study {study_id} layers[{layer_index}]"
            layer = _expect_object(raw_layer, context)
            _expect_keys(layer, LAYER_KEYS, context)
            layer_id = _text(layer["id"], f"{context}.id")
            if layer_id not in spec_layers:
                raise ValueError(f"{context}: {layer_id!r} is not an exact spec layer id")
            if layer_id in seen_layer_ids:
                raise ValueError(f"layer id {layer_id!r} appears more than once in the plan")
            seen_layer_ids.add(layer_id)
            plan_layer_ids.append(layer_id)
            replicate_type = layer["replicateType"]
            if replicate_type not in REPLICATE_TYPES:
                raise ValueError(f"{context}: unsupported replicateType {replicate_type!r}")

            strata = _expect_list(layer["strata"], f"{context}.strata", nonempty=True)
            stratum_ids: list[str] = []
            covered: list[str] = []
            for stratum_index, raw_stratum in enumerate(strata):
                stratum_context = f"{context}.strata[{stratum_index}]"
                stratum = _expect_object(raw_stratum, stratum_context)
                _expect_keys(stratum, STRATUM_KEYS, stratum_context)
                stratum_ids.append(_text(stratum["id"], f"{stratum_context}.id"))
                columns = _string_list(stratum["columns"], f"{stratum_context}.columns")
                if replicate_type == "none" and len(columns) != 1:
                    raise ValueError(f"{stratum_context}: replicateType none requires one column")
                covered.extend(columns)
            if len(stratum_ids) != len(set(stratum_ids)):
                raise ValueError(f"{context}: stratum ids must be unique")
            if len(covered) != len(set(covered)):
                raise ValueError(f"{context}: strata columns overlap")
            expected_columns = list(spec_layers[layer_id]["columns"])
            if set(covered) != set(expected_columns) or len(covered) != len(expected_columns):
                raise ValueError(
                    f"{context}: strata must be a disjoint exact cover of the spec layer columns")
            validated_layers.append(layer)

        if set(plan_layer_ids) != set(spec_layers) or len(plan_layer_ids) != len(spec_layers):
            missing = sorted(set(spec_layers) - set(plan_layer_ids))
            extra = sorted(set(plan_layer_ids) - set(spec_layers))
            raise ValueError(
                f"plan study {study_id} must list every spec layer once; missing={missing}, extra={extra}")
        admitted_columns = {
            column for spec_layer in spec["layers"] for column in spec_layer["columns"]
        }
        contrasts = _expect_list(study["contrasts"], f"plan study {study_id} contrasts")
        validated_contrasts: list[Mapping[str, Any]] = []
        for contrast_index, raw_contrast in enumerate(contrasts):
            context = f"plan study {study_id} contrasts[{contrast_index}]"
            contrast = _expect_object(raw_contrast, context)
            _expect_keys(contrast, CONTRAST_KEYS, context)
            contrast_id = _text(contrast["id"], f"{context}.id")
            contrast_ids.append(contrast_id)
            _text(contrast["label"], f"{context}.label")
            _text(contrast["caveat"], f"{context}.caveat")
            treatment = _string_list(contrast["treatment"], f"{context}.treatment")
            control = _string_list(contrast["control"], f"{context}.control")
            overlap = set(treatment) & set(control)
            if overlap:
                raise ValueError(f"{context}: treatment and control overlap at {sorted(overlap)}")
            for column in treatment + control:
                if column not in admitted_columns:
                    raise ValueError(f"{context}: column {column!r} is not in an admitted layer")
            validated_contrasts.append(contrast)

        study_plans.append(StudyPlan(
            spec_path=path,
            spec_relative=relative,
            spec_sha256=observed_digest,
            spec=spec,
            layers=tuple(validated_layers),
            contrasts=tuple(validated_contrasts),
        ))

    if len(contrast_ids) != len(set(contrast_ids)):
        raise ValueError("contrast ids must be globally unique")

    response_pairs = _expect_list(plan["responsePairs"], "plan.responsePairs")
    seen_pairs: set[tuple[str, str]] = set()
    contrast_id_set = set(contrast_ids)
    for index, raw_pair in enumerate(response_pairs):
        context = f"plan.responsePairs[{index}]"
        pair = _expect_object(raw_pair, context)
        _expect_keys(pair, RESPONSE_PAIR_KEYS, context)
        left = _text(pair["left"], f"{context}.left")
        right = _text(pair["right"], f"{context}.right")
        _text(pair["caveat"], f"{context}.caveat")
        if left == right:
            raise ValueError(f"{context}: a response pair must name two distinct contrasts")
        if left not in contrast_id_set or right not in contrast_id_set:
            raise ValueError(f"{context}: response pair references an unknown contrast")
        key = tuple(sorted((left, right)))
        if key in seen_pairs:
            raise ValueError(f"{context}: duplicate unordered response pair {key}")
        seen_pairs.add(key)

    return plan, study_plans


def _sources(spec: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    return list(spec.get("files") or [spec["file"]])


def _source_target(interim: Path, name: str) -> Path:
    """Keep source names inside the cache while permitting pinned file links."""
    if Path(name).name != name or name in {".", ".."} or "\\" in name:
        raise ValueError(f"source file name {name!r} escapes the interim directory")
    return interim / name


def _read_study_table(
    study: StudyPlan,
    interim: Path,
) -> tuple[list[str], list[list[str]], list[dict[str, str]]]:
    parts = []
    pins: list[dict[str, str]] = []
    for source in _sources(study.spec):
        target = _source_target(interim, source["name"])
        data = ingest.fetch(source["url"], source["sha256"], target)
        header, body = ingest.read_table(data, study.spec["reader"])
        parts.append((source.get("label") or Path(source["name"]).stem, header, body))
        pins.append({
            "name": source["name"],
            "url": source["url"],
            "sha256": ingest.sha256_of(data),
        })
    header, rows = parts[0][1:] if len(parts) == 1 else ingest.join_tables(parts)
    rows, _ = ingest.select_identifiers(rows, study.spec["reader"].get("idPattern"))
    return header, rows, pins


def _map_values(values: Mapping[str, float], crosswalk: Mapping[str, str]) -> dict[str, float]:
    mapped, _ = ingest.map_to_utex(values, crosswalk)
    return {locus: value for locus, (value, _source) in mapped.items()}


def _process_study(
    study: StudyPlan,
    interim: Path,
    crosswalks: Mapping[str, Mapping[str, str]],
) -> tuple[ProcessedStudy, list[dict[str, str]]]:
    header, rows, pins = _read_study_table(study, interim)
    relationship = ingest.ID_RELATIONSHIPS[study.spec["reader"]["idKind"]]
    crosswalk = crosswalks[relationship]
    columns = sorted({column for layer in study.spec["layers"] for column in layer["columns"]})
    mapped_vectors: dict[str, dict[str, float]] = {}
    for column in columns:
        values = ingest.column_values(header, rows, column)
        normalised = ingest.normalise(values, study.spec["normalization"])
        mapped_vectors[column] = _map_values(normalised, crosswalk)
    layer_vectors = {}
    for layer in study.spec["layers"]:
        means = ingest.layer_means(
            header, rows, layer["columns"], study.spec["normalization"])
        layer_vectors[layer["id"]] = _map_values(means, crosswalk)
    return ProcessedStudy(study, mapped_vectors, layer_vectors), pins


def _constant(values: Sequence[float]) -> bool:
    return bool(values) and all(value == values[0] for value in values[1:])


def _correlation(
    left: Mapping[str, float],
    right: Mapping[str, float],
    kind: str,
) -> tuple[int, float | None, str | None]:
    shared = sorted(
        key for key in set(left) & set(right)
        if math.isfinite(left[key]) and math.isfinite(right[key]))
    left_values = [left[key] for key in shared]
    right_values = [right[key] for key in shared]
    if len(shared) < 3:
        return len(shared), None, "fewer_than_three_shared_genes"
    left_constant = _constant(left_values)
    right_constant = _constant(right_values)
    if left_constant or right_constant:
        side = "both" if left_constant and right_constant else "left" if left_constant else "right"
        return len(shared), None, f"constant_{side}_vector"
    if kind == "spearman":
        value = stats.spearmanr(left_values, right_values).statistic
    elif kind == "pearson":
        value = stats.pearsonr(left_values, right_values).statistic
    else:  # pragma: no cover - private callers use the two declared methods.
        raise ValueError(f"unknown correlation kind {kind!r}")
    if not math.isfinite(float(value)):
        return len(shared), None, "undefined_correlation"
    return len(shared), float(value), None


def _sample_pair(
    left_name: str,
    right_name: str,
    vectors: Mapping[str, Mapping[str, float]],
) -> dict[str, Any]:
    shared, rho, reason = _correlation(vectors[left_name], vectors[right_name], "spearman")
    result = {
        "sampleLeft": left_name,
        "sampleRight": right_name,
        "sharedGeneCount": shared,
        "spearman": rho,
    }
    if reason is not None:
        result["spearmanReason"] = reason
    return result


def _range_summary(layer_id: str, correlations: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    values = [item["spearman"] for item in correlations if item["spearman"] is not None]
    result: dict[str, Any] = {
        "id": f"{layer_id}:empirical-sample-range",
        "label": "Empirical within-stratum sample Spearman range (processed data; not a confidence interval)",
        "definedCorrelationCount": len(values),
        "min": min(values) if values else None,
        "median": statistics.median(values) if values else None,
        "max": max(values) if values else None,
    }
    if not values:
        result["reason"] = "no_defined_sample_correlations"
    return result


def _layer_report(processed: ProcessedStudy, layer_plan: Mapping[str, Any]) -> dict[str, Any]:
    layer_id = layer_plan["id"]
    spec = processed.plan.spec
    spec_layer = next(layer for layer in spec["layers"] if layer["id"] == layer_id)
    conditions = dict(spec.get("conditions", {}))
    if isinstance(spec_layer.get("conditions"), dict):
        conditions.update(spec_layer["conditions"])
    strata = []
    pooled: list[Mapping[str, Any]] = []
    for stratum in layer_plan["strata"]:
        columns = stratum["columns"]
        correlations = [
            _sample_pair(columns[left], columns[right], processed.sample_mapped)
            for left in range(len(columns))
            for right in range(left + 1, len(columns))
        ]
        pooled.extend(correlations)
        strata.append({
            "id": stratum["id"],
            "columns": list(columns),
            "sampleCorrelations": correlations,
        })
    empirical_range = _range_summary(layer_id, pooled)
    means = processed.layer_means[layer_id]
    result: dict[str, Any] = {
        "id": layer_id,
        "studyId": spec["studyId"],
        "strain": spec_layer.get("strain", spec.get("strain")),
        "label": spec_layer.get("label"),
        "conditionSet": spec_layer.get("conditionSet"),
        "units": spec.get("units"),
        "normalization": spec["normalization"],
        "caveat": spec_layer.get("caveat", spec.get("caveat")),
        "replicates": spec.get("replicates"),
        "conditions": conditions,
        "replicateType": layer_plan["replicateType"],
        "biologicalBandAvailable": False,
        "meanGeneCount": len(means),
        "means": dict(sorted(means.items())),
        "strata": strata,
        "empiricalSampleRange": empirical_range,
    }
    if layer_plan["replicateType"] == "biological" and empirical_range["definedCorrelationCount"]:
        result["biologicalBandAvailable"] = True
        result["biologicalBandId"] = empirical_range["id"]
    return result


def _layer_reference(layer: Mapping[str, Any]) -> dict[str, Any]:
    reference = {
        "layerId": layer["id"],
        "empiricalSampleRangeId": layer["empiricalSampleRange"]["id"],
    }
    if layer.get("biologicalBandAvailable"):
        reference["biologicalBandId"] = layer["biologicalBandId"]
    return reference


def _level_pairs(layers: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    pairs = []
    for left_index in range(len(layers)):
        for right_index in range(left_index + 1, len(layers)):
            left = layers[left_index]
            right = layers[right_index]
            shared, rho, reason = _correlation(left["means"], right["means"], "spearman")
            pair = {
                "left": left["id"],
                "right": right["id"],
                "leftReference": _layer_reference(left),
                "rightReference": _layer_reference(right),
                "sharedGeneCount": shared,
                "spearman": rho,
            }
            if reason is not None:
                pair["spearmanReason"] = reason
            pairs.append(pair)
    return pairs


def _contrast_report(
    contrast: Mapping[str, Any],
    study: ProcessedStudy,
) -> dict[str, Any]:
    columns = list(contrast["treatment"]) + list(contrast["control"])
    vectors = study.sample_mapped
    measured = set.intersection(*(set(vectors[column]) for column in columns))
    response: dict[str, float] = {}
    excluded_zero = 0
    for locus in sorted(measured):
        treatment_mean = statistics.fmean(vectors[column][locus] for column in contrast["treatment"])
        control_mean = statistics.fmean(vectors[column][locus] for column in contrast["control"])
        if treatment_mean <= 0 or control_mean <= 0:
            excluded_zero += 1
            continue
        response[locus] = math.log2(treatment_mean / control_mean)
    return {
        "id": contrast["id"],
        "label": contrast["label"],
        "studyId": study.plan.spec["studyId"],
        "treatment": list(contrast["treatment"]),
        "control": list(contrast["control"]),
        "caveat": contrast["caveat"],
        "measuredIntersectionCount": len(measured),
        "positiveGeneCount": len(response),
        "excludedZeroCount": excluded_zero,
        "vector": response,
    }


def _response_pair_report(
    pair: Mapping[str, Any],
    contrasts: Mapping[str, Mapping[str, Any]],
) -> dict[str, Any]:
    left = contrasts[pair["left"]]["vector"]
    right = contrasts[pair["right"]]["vector"]
    shared, spearman, spearman_reason = _correlation(left, right, "spearman")
    _, pearson, pearson_reason = _correlation(left, right, "pearson")
    common = sorted(set(left) & set(right))
    directional = [locus for locus in common if left[locus] != 0 and right[locus] != 0]
    same_direction = sum((left[locus] > 0) == (right[locus] > 0) for locus in directional)
    result: dict[str, Any] = {
        "left": pair["left"],
        "right": pair["right"],
        "caveat": pair["caveat"],
        "sharedGeneCount": shared,
        "spearman": spearman,
        "pearson": pearson,
        "signAgreementFraction": same_direction / len(directional) if directional else None,
        "sameDirectionCount": same_direction,
        "nonzeroDirectionGeneCount": len(directional),
    }
    if spearman_reason is not None:
        result["spearmanReason"] = spearman_reason
    if pearson_reason is not None:
        result["pearsonReason"] = pearson_reason
    if not directional:
        result["signAgreementReason"] = "no_shared_nonzero_responses"
    return result


def _display_path(path: Path, root: Path) -> str:
    resolved = path.resolve()
    return resolved.relative_to(root.resolve()).as_posix() if resolved.is_relative_to(root.resolve()) else path.name


def _validate_output_path(
    output_path: Path,
    plan_path: Path,
    studies: Sequence[StudyPlan],
    interim: Path,
    crosswalk_path: Path,
    root: Path,
) -> Path:
    output = output_path.resolve()
    for forbidden_dir in (root / "data", root / "site"):
        if output.is_relative_to(forbidden_dir.resolve()):
            raise ValueError(f"output must not be inside {forbidden_dir.relative_to(root)}")
    inputs = {plan_path.resolve(), crosswalk_path.resolve()}
    inputs.update(study.spec_path.resolve() for study in studies)
    for study in studies:
        inputs.update(_source_target(interim, source["name"]).resolve() for source in _sources(study.spec))
    if output in inputs:
        raise ValueError("output path would overwrite an input")
    return output


def build_report(
    plan_path: Path,
    output_path: Path,
    interim: Path,
    crosswalk_path: Path = DEFAULT_CROSSWALK,
    *,
    root: Path = ROOT,
) -> Mapping[str, Any]:
    """Validate all inputs, compute the report, and write deterministic JSON."""
    root = root.resolve()
    plan_path = plan_path.resolve()
    interim = interim.resolve()
    crosswalk_path = crosswalk_path.resolve()
    plan, studies = load_and_validate_plan(plan_path, root)
    if not crosswalk_path.is_file():
        raise ValueError(f"crosswalk does not exist: {crosswalk_path}")
    output = _validate_output_path(
        output_path, plan_path, studies, interim, crosswalk_path, root)

    source_targets: dict[Path, tuple[str, str]] = {}
    for study in studies:
        for source in _sources(study.spec):
            target = _source_target(interim, source["name"])
            pin = (source["url"], source["sha256"])
            if target in source_targets and source_targets[target] != pin:
                raise ValueError(f"conflicting pins target the same interim file {target.name!r}")
            source_targets[target] = pin

    relationships = {
        ingest.ID_RELATIONSHIPS[study.spec["reader"]["idKind"]]
        for study in studies
    }
    crosswalks = {
        relationship: ingest.load_crosswalk(crosswalk_path, relationship)
        for relationship in relationships
    }
    processed_studies: list[ProcessedStudy] = []
    download_pins: list[dict[str, str]] = []
    for study in studies:
        processed, pins = _process_study(study, interim, crosswalks)
        processed_studies.append(processed)
        for pin in pins:
            download_pins.append({"studyId": study.spec["studyId"], **pin})

    processed_by_id = {study.plan.spec["studyId"]: study for study in processed_studies}
    layers = [
        _layer_report(processed_by_id[study.spec["studyId"]], layer)
        for study in studies
        for layer in study.layers
    ]
    contrasts = [
        _contrast_report(contrast, processed_by_id[study.spec["studyId"]])
        for study in studies
        for contrast in study.contrasts
    ]
    contrasts_by_id = {contrast["id"]: contrast for contrast in contrasts}

    report = {
        "schemaVersion": 1,
        "methods": {
            "sampleNormalization": (
                "Each sample uses its spec's declared normalization before exact one-to-one crosswalk mapping; "
                "zeros and missing cells remain distinct."
            ),
            "layerLevelAgreement": (
                "Layer means use the source-identifier intersection across the layer's samples; all unordered "
                "layer pairs use tie-aware Spearman correlation on finite shared UTEX loci."
            ),
            "sampleAgreement": (
                "Sample correlations are computed only within explicit plan strata. Empirical ranges summarize "
                "processed sample correlations and are not confidence intervals."
            ),
            "contrast": (
                "log2(mean normalized treatment / mean normalized control), restricted to UTEX loci measured "
                "in every arm sample with strictly positive arm means; no pseudocount."
            ),
            "responseAgreement": (
                "Only explicit response pairs are computed. Zero response on either side is excluded from the "
                "direction denominator."
            ),
        },
        "limitations": [
            "All summaries describe processed data and are not inferential biological uncertainty.",
            "Time-course layer means may pool time points while replicate correlations remain within exact "
            "time strata; those summaries can have different aggregation denominators.",
            "No statistic is a pass/fail rule and no layer is merged by this report.",
            "Replication types and strata are reviewed plan inputs; column labels are not classified or inferred.",
            "Correlations are null for fewer than three shared genes or a constant vector.",
        ],
        "inputs": {
            "plan": {"path": _display_path(plan_path, root), "sha256": _sha256_file(plan_path)},
            "specs": [
                {
                    "studyId": study.spec["studyId"],
                    "path": study.spec_relative,
                    "sha256": study.spec_sha256,
                }
                for study in studies
            ],
            "downloads": download_pins,
            "crosswalk": {
                "path": _display_path(crosswalk_path, root),
                "sha256": _sha256_file(crosswalk_path),
            },
        },
        "layers": layers,
        "levelPairs": _level_pairs(layers),
        "contrasts": contrasts,
        "responsePairs": [
            _response_pair_report(pair, contrasts_by_id)
            for pair in plan["responsePairs"]
        ],
    }
    content = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True, allow_nan=False) + "\n"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(content, encoding="utf-8")
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("plan", type=Path, help="explicit expression-agreement plan, JSON")
    parser.add_argument("output", type=Path, help="calibration report JSON (outside data/ and site/)")
    parser.add_argument("--interim", type=Path, required=True, help="checksum-verified download cache")
    parser.add_argument("--crosswalk", type=Path, default=DEFAULT_CROSSWALK)
    args = parser.parse_args(argv)
    build_report(args.plan, args.output, args.interim, args.crosswalk, root=ROOT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
