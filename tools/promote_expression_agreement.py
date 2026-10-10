#!/usr/bin/env python3
"""Promote the accepted expression-agreement summary into a browser payload.

The scientific exporter deliberately refuses to write inside ``site/``.  This
separate promotion step validates that statistics-only artifact, joins it to
the admitted RNA-seq sources by ``expressionSources[].id``, preserves every
statistic and provenance pin needed by the browser, and writes no per-gene
vectors.

Usage:
    tools/promote_expression_agreement.py [--report PATH] [--meta PATH] [--output PATH]
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Any, Mapping

try:  # Importable as tools.promote_expression_agreement and executable as a script.
    from tools.export_expression_agreement import (
        CONTRAST_FIELDS,
        CONTRAST_VECTOR_FIELD,
        LAYER_FIELDS,
        LAYER_VECTOR_FIELD,
        REPORT_FORMAT,
        SCHEMA_VERSION,
        _declared_input_paths,
        _expect_count,
        _expect_distinct_names,
        _expect_fields,
        _expect_list,
        _expect_object,
        _expect_text,
        _reject_json_constant,
        _reject_non_finite,
        _validate_layer_description,
        _validate_level_pairs,
        _validate_response_pairs,
        _validate_sample_range,
    )
except ModuleNotFoundError:  # Direct execution puts tools/ rather than ROOT on sys.path.
    from export_expression_agreement import (
        CONTRAST_FIELDS,
        CONTRAST_VECTOR_FIELD,
        LAYER_FIELDS,
        LAYER_VECTOR_FIELD,
        REPORT_FORMAT,
        SCHEMA_VERSION,
        _declared_input_paths,
        _expect_count,
        _expect_distinct_names,
        _expect_fields,
        _expect_list,
        _expect_object,
        _expect_text,
        _reject_json_constant,
        _reject_non_finite,
        _validate_layer_description,
        _validate_level_pairs,
        _validate_response_pairs,
        _validate_sample_range,
    )

ROOT = Path(__file__).resolve().parents[1]
SELF_PATH = Path(__file__).resolve()
DEFAULT_REPORT = ROOT / "docs/notes/handoff/cyano_processed_expression_agreement_current_20261007.json"
DEFAULT_META = ROOT / "site/data/meta.json"
DEFAULT_OUTPUT = ROOT / "site/data/expression_agreement.json"
BROWSER_FORMAT = "browser-expression-agreement"
GAP_REASON = "not_present_in_current_statistics_report"


def sha256(data: bytes) -> str:
    """Return the lowercase SHA-256 of bytes."""
    return hashlib.sha256(data).hexdigest()


def display_path(path: Path) -> str:
    """Return a repository-relative path when possible."""
    resolved = path.resolve()
    return resolved.relative_to(ROOT).as_posix() if resolved.is_relative_to(ROOT) else path.name


def load_json(path: Path, label: str) -> tuple[Mapping[str, Any], bytes]:
    """Read strict finite JSON and return its object with the exact bytes."""
    if not path.is_file():
        raise ValueError(f"{label} does not exist: {path}")
    raw = path.read_bytes()
    try:
        value = json.loads(raw.decode("utf-8"), parse_constant=_reject_json_constant)
    except UnicodeDecodeError as error:
        raise ValueError(f"{label} is not valid UTF-8: {error}") from error
    except json.JSONDecodeError as error:
        raise ValueError(f"{label} is not valid JSON: {error}") from error
    _reject_non_finite(value, label)
    return _expect_object(value, label), raw


def validate_summary(value: Any) -> Mapping[str, Any]:
    """Validate the accepted statistics-only report without recomputing it."""
    report = _expect_object(value, "agreement report")
    if report.get("schemaVersion") != SCHEMA_VERSION:
        raise ValueError(f"agreement report schemaVersion must be {SCHEMA_VERSION}")
    if report.get("reportFormat") != REPORT_FORMAT:
        raise ValueError(f"agreement report reportFormat must be {REPORT_FORMAT!r}")
    omitted = _expect_object(report.get("omittedVectors"), "agreement report omittedVectors")
    if omitted.get("layerField") != LAYER_VECTOR_FIELD \
            or omitted.get("contrastField") != CONTRAST_VECTOR_FIELD:
        raise ValueError("agreement report does not declare the expected omitted vectors")

    methods = _expect_object(report.get("methods"), "agreement report methods")
    if not methods:
        raise ValueError("agreement report methods must not be empty")
    for name, text in methods.items():
        _expect_text(text, f"agreement report method {name!r}")
    limitations = _expect_list(report.get("limitations"), "agreement report limitations")
    if not limitations:
        raise ValueError("agreement report limitations must not be empty")
    for index, text in enumerate(limitations):
        _expect_text(text, f"agreement report limitation {index}")

    layers: dict[str, Mapping[str, Any]] = {}
    for index, item in enumerate(_expect_list(report.get("layers"), "agreement report layers")):
        layer = _expect_object(item, f"agreement layer {index}")
        layer_id = _expect_text(layer.get("id"), f"agreement layer {index} id")
        if layer_id in layers:
            raise ValueError(f"duplicate agreement layer id {layer_id!r}")
        if LAYER_VECTOR_FIELD in layer:
            raise ValueError(f"agreement layer {layer_id!r} unexpectedly publishes per-gene means")
        _expect_text(layer.get("studyId"), f"agreement layer {layer_id!r} studyId")
        _expect_fields(layer, LAYER_FIELDS, f"agreement layer {layer_id!r}")
        _expect_count(layer.get("meanGeneCount"), f"agreement layer {layer_id!r} meanGeneCount")
        _validate_layer_description(layer_id, layer)
        _validate_sample_range(layer_id, layer)
        layers[layer_id] = layer
    if not layers:
        raise ValueError("agreement report layers must not be empty")

    contrasts: dict[str, Mapping[str, Any]] = {}
    for index, item in enumerate(_expect_list(report.get("contrasts"), "agreement report contrasts")):
        contrast = _expect_object(item, f"agreement contrast {index}")
        contrast_id = _expect_text(contrast.get("id"), f"agreement contrast {index} id")
        if contrast_id in contrasts:
            raise ValueError(f"duplicate agreement contrast id {contrast_id!r}")
        if CONTRAST_VECTOR_FIELD in contrast:
            raise ValueError(f"agreement contrast {contrast_id!r} unexpectedly publishes a vector")
        _expect_text(contrast.get("studyId"), f"agreement contrast {contrast_id!r} studyId")
        _expect_fields(contrast, CONTRAST_FIELDS, f"agreement contrast {contrast_id!r}")
        _expect_text(contrast["label"], f"agreement contrast {contrast_id!r} label")
        _expect_text(contrast["caveat"], f"agreement contrast {contrast_id!r} caveat")
        treatment = _expect_distinct_names(
            contrast["treatment"], f"agreement contrast {contrast_id!r} treatment")
        control = _expect_distinct_names(
            contrast["control"], f"agreement contrast {contrast_id!r} control")
        if set(treatment) & set(control):
            raise ValueError(f"agreement contrast {contrast_id!r} shares a treatment and control arm")
        measured = _expect_count(
            contrast.get("measuredIntersectionCount"),
            f"agreement contrast {contrast_id!r} measuredIntersectionCount",
        )
        positive = _expect_count(
            contrast.get("positiveGeneCount"), f"agreement contrast {contrast_id!r} positiveGeneCount")
        excluded = _expect_count(
            contrast.get("excludedZeroCount"), f"agreement contrast {contrast_id!r} excludedZeroCount")
        if measured != positive + excluded:
            raise ValueError(f"agreement contrast {contrast_id!r} denominators disagree")
        contrasts[contrast_id] = contrast

    _validate_level_pairs(report.get("levelPairs"), layers)
    _validate_response_pairs(report.get("responsePairs"), contrasts)
    _declared_input_paths(report)

    implementation = _expect_object(report.get("implementation"), "agreement implementation")
    _expect_text(implementation.get("path"), "agreement implementation path")
    digest = _expect_text(implementation.get("sha256"), "agreement implementation sha256")
    if len(digest) != 64 or any(char not in "0123456789abcdef" for char in digest):
        raise ValueError("agreement implementation sha256 must be lowercase hexadecimal SHA-256")
    return report


def admitted_rna_sources(meta: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    """Return admitted RNA-seq sources, preserving manifest order and exact ids."""
    sources = _expect_list(meta.get("expressionSources"), "meta expressionSources")
    admitted: list[Mapping[str, Any]] = []
    seen: set[str] = set()
    for index, item in enumerate(sources):
        source = _expect_object(item, f"meta expression source {index}")
        record = _expect_object(source.get("record"), f"meta expression source {index} record")
        if record.get("dataType") != "transcriptomics" or record.get("platform") != "RNA-seq":
            continue
        source_id = _expect_text(source.get("id"), f"meta expression source {index} id")
        if source_id in seen:
            raise ValueError(f"duplicate admitted RNA-seq source id {source_id!r}")
        seen.add(source_id)
        _expect_text(record.get("studyId"), f"admitted RNA-seq source {source_id!r} studyId")
        admitted.append(source)
    if not admitted:
        raise ValueError("meta declares no admitted RNA-seq sources")
    return admitted


def compact_layer(layer: Mapping[str, Any]) -> dict[str, Any]:
    """Copy descriptive statistics and their sample-pair denominators, never vectors."""
    fields = (
        "studyId", "label", "conditionSet", "strain", "units", "normalization", "caveat",
        "replicates", "replicateType", "biologicalBandAvailable", "biologicalBandId",
        "meanGeneCount", "empiricalSampleRange", "strata",
    )
    return {key: copy.deepcopy(layer[key]) for key in fields if key in layer}


def compact_pair(pair: Mapping[str, Any]) -> dict[str, Any]:
    """Copy one level pair without redundant range references."""
    fields = ("left", "right", "sharedGeneCount", "spearman", "spearmanReason")
    return {key: copy.deepcopy(pair[key]) for key in fields if key in pair}


def compact_contrast(contrast: Mapping[str, Any]) -> dict[str, Any]:
    """Copy response metadata, exact arms, and denominators without per-gene vectors."""
    fields = (
        "id", "studyId", "label", "treatment", "control", "caveat", "measuredIntersectionCount",
        "positiveGeneCount", "excludedZeroCount",
    )
    return {key: copy.deepcopy(contrast[key]) for key in fields}


def build_payload(
    report: Mapping[str, Any], report_path: Path, report_raw: bytes,
    meta: Mapping[str, Any], meta_path: Path, meta_raw: bytes,
) -> dict[str, Any]:
    """Join a validated report to admitted sources by exact source id."""
    validated = validate_summary(report)
    admitted = admitted_rna_sources(meta)
    admitted_by_id = {source["id"]: source for source in admitted}
    layers = {layer["id"]: layer for layer in validated["layers"]}
    unknown = sorted(set(layers) - set(admitted_by_id))
    if unknown:
        raise ValueError(
            "agreement report names RNA-seq layers absent from meta.expressionSources: "
            + ", ".join(unknown)
        )

    sources = []
    gaps = []
    for source in admitted:
        source_id = source["id"]
        record = source["record"]
        layer = layers.get(source_id)
        if layer and layer["studyId"] != record["studyId"]:
            raise ValueError(
                f"agreement layer {source_id!r} studyId {layer['studyId']!r} does not match "
                f"meta.expressionSources {record['studyId']!r}"
            )
        entry = {
            "id": source_id,
            "studyId": record["studyId"],
            "label": source.get("label", source_id),
            "conditionSet": record.get("conditionSet"),
            "agreement": compact_layer(layer) if layer else None,
        }
        if layer is None:
            entry["coverageGap"] = GAP_REASON
            gaps.append({"sourceId": source_id, "reason": GAP_REASON})
        sources.append(entry)

    report_ids = [source["id"] for source in sources if source["agreement"] is not None]
    expected_pairs = len(report_ids) * (len(report_ids) - 1) // 2
    if len(validated["levelPairs"]) != expected_pairs:
        raise ValueError(
            f"agreement report has {len(validated['levelPairs'])} level pairs for "
            f"{len(report_ids)} layers; expected {expected_pairs}"
        )

    return {
        "schemaVersion": 1,
        "reportFormat": BROWSER_FORMAT,
        "sourceReport": {
            "path": display_path(report_path),
            "sha256": sha256(report_raw),
            "bytes": len(report_raw),
            "schemaVersion": validated["schemaVersion"],
            "reportFormat": validated["reportFormat"],
        },
        "metaInput": {
            "path": display_path(meta_path),
            "sha256": sha256(meta_raw),
            "bytes": len(meta_raw),
        },
        "promotion": {
            "path": display_path(SELF_PATH),
            "sha256": sha256(SELF_PATH.read_bytes()),
        },
        "statisticsImplementation": copy.deepcopy(validated["implementation"]),
        "inputs": copy.deepcopy(validated["inputs"]),
        "omittedVectors": copy.deepcopy(validated["omittedVectors"]),
        "methods": copy.deepcopy(validated["methods"]),
        "limitations": copy.deepcopy(validated["limitations"]),
        "coverage": {
            "admittedRnaSeqSourceCount": len(sources),
            "reportBackedSourceCount": len(report_ids),
            "levelPairCount": len(validated["levelPairs"]),
            "responsePairCount": len(validated["responsePairs"]),
            "gaps": gaps,
        },
        "sources": sources,
        "levelPairs": [compact_pair(pair) for pair in validated["levelPairs"]],
        "contrasts": [compact_contrast(contrast) for contrast in validated["contrasts"]],
        "responsePairs": copy.deepcopy(validated["responsePairs"]),
    }


def render(payload: Mapping[str, Any]) -> str:
    """Serialize deterministic compact browser JSON."""
    return json.dumps(
        payload, ensure_ascii=False, sort_keys=True, allow_nan=False, separators=(",", ":")
    ) + "\n"


def write_atomically(path: Path, text: str) -> None:
    """Replace the destination only after the complete payload is durable."""
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", newline="", dir=path.parent,
        prefix=f".{path.name}.", suffix=".partial", delete=False,
    )
    try:
        with handle:
            handle.write(text)
        os.replace(handle.name, path)
    except BaseException:
        Path(handle.name).unlink(missing_ok=True)
        raise


def promote(report_path: Path, meta_path: Path, output_path: Path) -> dict[str, Any]:
    """Build and atomically write one browser agreement payload."""
    report, report_raw = load_json(report_path, "agreement report")
    meta, meta_raw = load_json(meta_path, "site metadata")
    payload = build_payload(report, report_path, report_raw, meta, meta_path, meta_raw)
    write_atomically(output_path, render(payload))
    return payload


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--meta", type=Path, default=DEFAULT_META)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args(argv)
    try:
        payload = promote(args.report, args.meta, args.output)
    except (OSError, ValueError) as error:
        print(f"error: {error}", file=__import__("sys").stderr)
        return 1
    print(
        f"wrote {args.output} with {payload['coverage']['reportBackedSourceCount']} "
        f"report-backed RNA-seq sources and {len(payload['coverage']['gaps'])} coverage gaps"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
