#!/usr/bin/env python3
"""Re-serialise a full expression-agreement report as a summary and review tables.

Usage:
    export_expression_agreement.py REPORT --json PATH --replicates PATH --responses PATH

The exporter reads a schema-1 report written by ``tools/expression_agreement.py``.
It copies every statistic verbatim, omits only the per-gene layer means and
contrast response vectors, and recomputes no number.  Required fields, value
types, statistic ranges, identities, denominators and cross-references are
checked, and all destinations are preflighted, before anything is written.
"""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import io
import itertools
import json
import math
import os
import sys
import tempfile
import unicodedata
from pathlib import Path
from typing import Any, Mapping, Sequence

ROOT = Path(__file__).resolve().parents[1]
SELF_PATH = Path(__file__).resolve()
SCHEMA_VERSION = 1
REPORT_FORMAT = "statistics-summary"
GENERATOR = "tools/expression_agreement.py"
LAYER_VECTOR_FIELD = "means"
CONTRAST_VECTOR_FIELD = "vector"
STATISTICS_ORIGIN = (
    "Every statistic is copied verbatim from the input report recorded here; this exporter "
    "recomputed nothing and did not generate the numbers it carries."
)
REQUIRED_TOP_LEVEL = (
    "methods",
    "limitations",
    "inputs",
    "layers",
    "levelPairs",
    "contrasts",
    "responsePairs",
)
UNPUBLISHABLE_DIRECTORIES = ("data", "site")
HEX_DIGITS = frozenset("0123456789abcdef")

# Fields each validator reads directly; the generator writes every one of them.
LAYER_FIELDS = (
    "strain",
    "label",
    "conditionSet",
    "units",
    "normalization",
    "caveat",
    "replicates",
    "conditions",
    "replicateType",
    "biologicalBandAvailable",
)
SAMPLE_RANGE_FIELDS = ("id", "label", "definedCorrelationCount", "min", "median", "max")
CORRELATION_FIELDS = ("sampleLeft", "sampleRight", "sharedGeneCount", "spearman")
CONTRAST_FIELDS = ("label", "treatment", "control", "caveat")
LEVEL_PAIR_FIELDS = ("sharedGeneCount", "spearman")
RESPONSE_PAIR_FIELDS = (
    "caveat",
    "sharedGeneCount",
    "spearman",
    "pearson",
    "signAgreementFraction",
    "sameDirectionCount",
    "nonzeroDirectionGeneCount",
)

REPLICATE_COLUMNS = (
    "id",
    "studyId",
    "replicateType",
    "biologicalBandAvailable",
    "meanGeneCount",
    "strata",
    "definedCorrelationCount",
    "min",
    "median",
    "max",
)
RESPONSE_COLUMNS = (
    "left",
    "right",
    "leftStudy",
    "rightStudy",
    "leftLabel",
    "rightLabel",
    "sharedGeneCount",
    "spearman",
    "pearson",
    "sameDirectionCount",
    "nonzeroDirectionGeneCount",
    "signAgreementFraction",
    "leftMeasuredGenes",
    "rightMeasuredGenes",
    "leftPositiveGenes",
    "rightPositiveGenes",
    "leftExcludedZeroGenes",
    "rightExcludedZeroGenes",
    "caveat",
)


def _expect_object(value: Any, context: str) -> Mapping[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{context} must be a JSON object")
    return value


def _expect_list(value: Any, context: str) -> list[Any]:
    if not isinstance(value, list):
        raise ValueError(f"{context} must be a JSON array")
    return value


def _expect_text(value: Any, context: str) -> str:
    if not isinstance(value, str) or not value:
        raise ValueError(f"{context} must be a non-empty string")
    return value


def _expect_count(value: Any, context: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise ValueError(f"{context} must be a non-negative integer")
    return value


def _expect_optional_text(value: Any, context: str) -> str | None:
    """A descriptive field the generator copies from a spec, which may be absent there."""
    if value is not None and (not isinstance(value, str) or not value):
        raise ValueError(f"{context} must be a non-empty string or null")
    return value


def _expect_number(value: Any, context: str) -> float:
    """A finite JSON number; a boolean is not a number here."""
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{context} must be a finite number")
    return float(value)


def _expect_bounded(value: Any, context: str, low: float, high: float) -> float | None:
    """A finite number inside its definitional range, or null for an undefined statistic."""
    if value is None:
        return None
    number = _expect_number(value, context)
    if not low <= number <= high:
        raise ValueError(f"{context} must lie between {low} and {high}, not {number}")
    return number


def _expect_checksum(value: Any, context: str) -> str:
    if not isinstance(value, str) or len(value) != 64 or set(value) - HEX_DIGITS:
        raise ValueError(f"{context} must be a 64-character lowercase hexadecimal SHA-256")
    return value


def _expect_fields(record: Mapping[str, Any], fields: Sequence[str], context: str) -> None:
    missing = [name for name in fields if name not in record]
    if missing:
        raise ValueError(f"{context} has no {', '.join(repr(name) for name in missing)}")


def _expect_stated_reason(record: Mapping[str, Any], field: str, reason: str, context: str) -> None:
    """A null statistic must name its reason; a defined one must not carry one."""
    if record[field] is None:
        _expect_text(record.get(reason), f"{context} {reason}")
    elif reason in record:
        raise ValueError(f"{context} states a {reason} but its {field} is defined")


def _expect_distinct_names(value: Any, context: str) -> list[str]:
    names = _expect_list(value, context)
    if not names:
        raise ValueError(f"{context} must not be empty")
    for index, name in enumerate(names):
        _expect_text(name, f"{context} entry {index}")
    if len(set(names)) != len(names):
        raise ValueError(f"{context} repeats a name")
    return names


def _reject_json_constant(token: str) -> Any:
    raise ValueError(f"report contains the non-finite JSON literal {token}")


def _reject_non_finite(value: Any, context: str) -> None:
    """Reject overflowed numbers that parse to infinity without a NaN literal."""
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError(f"{context} is not a finite number")
    if isinstance(value, dict):
        for key, item in value.items():
            _reject_non_finite(item, f"{context}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            _reject_non_finite(item, f"{context}[{index}]")


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _display_path(path: Path, root: Path) -> str:
    resolved = path.resolve()
    root = root.resolve()
    return resolved.relative_to(root).as_posix() if resolved.is_relative_to(root) else path.name


def _validate_layers(value: Any) -> dict[str, Mapping[str, Any]]:
    layers = _expect_list(value, "report layers")
    if not layers:
        raise ValueError("report layers must not be empty")
    by_id: dict[str, Mapping[str, Any]] = {}
    for index, item in enumerate(layers):
        layer = _expect_object(item, f"layer {index}")
        layer_id = _expect_text(layer.get("id"), f"layer {index} id")
        if layer_id in by_id:
            raise ValueError(f"duplicate layer id {layer_id!r}")
        _expect_text(layer.get("studyId"), f"layer {layer_id!r} studyId")
        if LAYER_VECTOR_FIELD not in layer:
            raise ValueError(
                f"layer {layer_id!r} has no {LAYER_VECTOR_FIELD!r} field: a full report is required, "
                "not a statistics-only summary"
            )
        _expect_fields(layer, LAYER_FIELDS, f"layer {layer_id!r}")
        means = _expect_object(layer[LAYER_VECTOR_FIELD], f"layer {layer_id!r} means")
        for locus, mean in means.items():
            _expect_number(mean, f"layer {layer_id!r} mean {locus!r}")
        if _expect_count(layer.get("meanGeneCount"), f"layer {layer_id!r} meanGeneCount") != len(means):
            raise ValueError(f"layer {layer_id!r} meanGeneCount disagrees with its means")
        _validate_layer_description(layer_id, layer)
        _validate_sample_range(layer_id, layer)
        by_id[layer_id] = layer
    return by_id


def _validate_layer_description(layer_id: str, layer: Mapping[str, Any]) -> None:
    """Check the provenance fields the generator copies from the layer's spec."""
    for field in ("strain", "label", "conditionSet", "units", "caveat"):
        _expect_optional_text(layer[field], f"layer {layer_id!r} {field}")
    _expect_text(layer["normalization"], f"layer {layer_id!r} normalization")
    _expect_text(layer["replicateType"], f"layer {layer_id!r} replicateType")
    if layer["replicates"] is not None:
        _expect_object(layer["replicates"], f"layer {layer_id!r} replicates")
    conditions = _expect_object(layer["conditions"], f"layer {layer_id!r} conditions")
    for name, condition in conditions.items():
        _expect_object(condition, f"layer {layer_id!r} condition {name!r}")
    if not isinstance(layer["biologicalBandAvailable"], bool):
        raise ValueError(f"layer {layer_id!r} biologicalBandAvailable must be true or false")


def _validate_sample_range(layer_id: str, layer: Mapping[str, Any]) -> None:
    context = f"layer {layer_id!r} empiricalSampleRange"
    sample_range = _expect_object(layer.get("empiricalSampleRange"), context)
    range_id = _expect_text(sample_range.get("id"), f"{context} id")
    _expect_fields(sample_range, SAMPLE_RANGE_FIELDS, context)
    _expect_text(sample_range["label"], f"{context} label")
    bounds = [
        _expect_bounded(sample_range[key], f"{context} {key}", -1.0, 1.0)
        for key in ("min", "median", "max")
    ]
    defined = _validate_strata(layer_id, layer)
    count = _expect_count(
        sample_range["definedCorrelationCount"], f"layer {layer_id!r} definedCorrelationCount")
    if count != defined:
        raise ValueError(
            f"layer {layer_id!r} definedCorrelationCount disagrees with its sample correlations")
    stated = [bound for bound in bounds if bound is not None]
    if len(stated) not in (0, len(bounds)) or bool(stated) != (count > 0):
        raise ValueError(
            f"{context} min, median and max must be null exactly when no sample correlation is "
            "defined"
        )
    if stated and not stated[0] <= stated[1] <= stated[2]:
        raise ValueError(f"{context} is not ordered min <= median <= max")
    if count == 0:
        _expect_text(sample_range.get("reason"), f"{context} reason")
    elif "reason" in sample_range:
        raise ValueError(f"{context} states a reason but has defined sample correlations")
    if layer["biologicalBandAvailable"]:
        if layer.get("biologicalBandId") != range_id:
            raise ValueError(
                f"layer {layer_id!r} biological band does not reference its sample range")
    elif "biologicalBandId" in layer:
        raise ValueError(f"layer {layer_id!r} names a biological band it does not declare available")


def _validate_strata(layer_id: str, layer: Mapping[str, Any]) -> int:
    """Check every stratum and return how many of its correlations are defined."""
    defined = 0
    stratum_ids: set[str] = set()
    for index, item in enumerate(_expect_list(layer.get("strata"), f"layer {layer_id!r} strata")):
        stratum = _expect_object(item, f"layer {layer_id!r} stratum {index}")
        stratum_id = _expect_text(stratum.get("id"), f"layer {layer_id!r} stratum {index} id")
        if stratum_id in stratum_ids:
            raise ValueError(f"duplicate stratum id {stratum_id!r} in layer {layer_id!r}")
        stratum_ids.add(stratum_id)
        columns = set(
            _expect_distinct_names(stratum.get("columns"), f"stratum {stratum_id!r} columns"))
        correlations = _expect_list(
            stratum.get("sampleCorrelations"), f"stratum {stratum_id!r} sampleCorrelations")
        for pair_index, pair_item in enumerate(correlations):
            context = f"stratum {stratum_id!r} correlation {pair_index}"
            pair = _expect_object(pair_item, context)
            _expect_fields(pair, CORRELATION_FIELDS, context)
            if pair["sampleLeft"] == pair["sampleRight"]:
                raise ValueError(f"{context} correlates a sample with itself")
            if not {pair["sampleLeft"], pair["sampleRight"]} <= columns:
                raise ValueError(f"{context} names a sample outside its columns")
            _expect_count(pair["sharedGeneCount"], f"{context} sharedGeneCount")
            _expect_bounded(pair["spearman"], f"{context} spearman", -1.0, 1.0)
            _expect_stated_reason(pair, "spearman", "spearmanReason", context)
            defined += pair["spearman"] is not None
    return defined


def _validate_contrasts(value: Any) -> dict[str, Mapping[str, Any]]:
    by_id: dict[str, Mapping[str, Any]] = {}
    for index, item in enumerate(_expect_list(value, "report contrasts")):
        contrast = _expect_object(item, f"contrast {index}")
        contrast_id = _expect_text(contrast.get("id"), f"contrast {index} id")
        if contrast_id in by_id:
            raise ValueError(f"duplicate contrast id {contrast_id!r}")
        _expect_text(contrast.get("studyId"), f"contrast {contrast_id!r} studyId")
        if CONTRAST_VECTOR_FIELD not in contrast:
            raise ValueError(
                f"contrast {contrast_id!r} has no {CONTRAST_VECTOR_FIELD!r} field: a full report is "
                "required, not a statistics-only summary"
            )
        _expect_fields(contrast, CONTRAST_FIELDS, f"contrast {contrast_id!r}")
        _expect_text(contrast["label"], f"contrast {contrast_id!r} label")
        _expect_text(contrast["caveat"], f"contrast {contrast_id!r} caveat")
        treatment = _expect_distinct_names(
            contrast["treatment"], f"contrast {contrast_id!r} treatment")
        control = _expect_distinct_names(contrast["control"], f"contrast {contrast_id!r} control")
        shared_arms = sorted(set(treatment) & set(control))
        if shared_arms:
            raise ValueError(f"contrast {contrast_id!r} names {shared_arms} in both arms")
        response = _expect_object(
            contrast[CONTRAST_VECTOR_FIELD], f"contrast {contrast_id!r} vector")
        for locus, value in response.items():
            _expect_number(value, f"contrast {contrast_id!r} response {locus!r}")
        positive = _expect_count(
            contrast.get("positiveGeneCount"), f"contrast {contrast_id!r} positiveGeneCount")
        excluded = _expect_count(
            contrast.get("excludedZeroCount"), f"contrast {contrast_id!r} excludedZeroCount")
        measured = _expect_count(
            contrast.get("measuredIntersectionCount"),
            f"contrast {contrast_id!r} measuredIntersectionCount",
        )
        if positive != len(response):
            raise ValueError(f"contrast {contrast_id!r} positiveGeneCount disagrees with its vector")
        if measured != positive + excluded:
            raise ValueError(
                f"contrast {contrast_id!r} measured intersection disagrees with its positive and "
                "zero-excluded counts"
            )
        by_id[contrast_id] = contrast
    return by_id


def _validate_level_pairs(value: Any, layers: Mapping[str, Mapping[str, Any]]) -> None:
    for index, item in enumerate(_expect_list(value, "report levelPairs")):
        pair = _expect_object(item, f"level pair {index}")
        named: list[Mapping[str, Any]] = []
        for side in ("left", "right"):
            layer_id = _expect_text(pair.get(side), f"level pair {index} {side}")
            if layer_id not in layers:
                raise ValueError(f"level pair {index} {side} names unknown layer {layer_id!r}")
            layer = layers[layer_id]
            reference = _expect_object(
                pair.get(f"{side}Reference"), f"level pair {index} {side}Reference")
            if reference.get("layerId") != layer_id:
                raise ValueError(f"level pair {index} {side}Reference does not name layer {layer_id!r}")
            if reference.get("empiricalSampleRangeId") != layer["empiricalSampleRange"]["id"]:
                raise ValueError(
                    f"level pair {index} {side}Reference does not name the sample range of "
                    f"layer {layer_id!r}"
                )
            if reference.get("biologicalBandId") != layer.get("biologicalBandId"):
                raise ValueError(
                    f"level pair {index} {side}Reference does not carry the biological band of "
                    f"layer {layer_id!r}"
                )
            named.append(layer)
        context = f"level pair {index}"
        _expect_fields(pair, LEVEL_PAIR_FIELDS, context)
        shared = _expect_count(pair["sharedGeneCount"], f"{context} sharedGeneCount")
        if shared > min(layer["meanGeneCount"] for layer in named):
            raise ValueError(f"{context} sharedGeneCount exceeds the means of its layers")
        _expect_bounded(pair["spearman"], f"{context} spearman", -1.0, 1.0)
        _expect_stated_reason(pair, "spearman", "spearmanReason", context)


def _validate_response_pairs(value: Any, contrasts: Mapping[str, Mapping[str, Any]]) -> None:
    for index, item in enumerate(_expect_list(value, "report responsePairs")):
        pair = _expect_object(item, f"response pair {index}")
        named: list[Mapping[str, Any]] = []
        for side in ("left", "right"):
            contrast_id = _expect_text(pair.get(side), f"response pair {index} {side}")
            if contrast_id not in contrasts:
                raise ValueError(
                    f"response pair {index} {side} names unknown contrast {contrast_id!r}")
            named.append(contrasts[contrast_id])
        context = f"response pair {index}"
        if pair["left"] == pair["right"]:
            raise ValueError(f"{context} compares a contrast with itself")
        _expect_fields(pair, RESPONSE_PAIR_FIELDS, context)
        _expect_text(pair["caveat"], f"{context} caveat")
        shared = _expect_count(pair["sharedGeneCount"], f"{context} sharedGeneCount")
        if shared > min(contrast["positiveGeneCount"] for contrast in named):
            raise ValueError(f"{context} sharedGeneCount exceeds the responses of its contrasts")
        directional = _expect_count(
            pair["nonzeroDirectionGeneCount"], f"{context} nonzeroDirectionGeneCount")
        if directional > shared:
            raise ValueError(f"{context} nonzeroDirectionGeneCount exceeds its shared genes")
        if _expect_count(pair["sameDirectionCount"], f"{context} sameDirectionCount") > directional:
            raise ValueError(f"{context} sameDirectionCount exceeds its direction denominator")
        for field in ("spearman", "pearson"):
            _expect_bounded(pair[field], f"{context} {field}", -1.0, 1.0)
            _expect_stated_reason(pair, field, f"{field}Reason", context)
        _expect_bounded(pair["signAgreementFraction"], f"{context} signAgreementFraction", 0.0, 1.0)
        if (pair["signAgreementFraction"] is None) != (directional == 0):
            raise ValueError(
                f"{context} signAgreementFraction must be null exactly when no shared response is "
                "directional"
            )
        if ("signAgreementReason" in pair) != (directional == 0):
            raise ValueError(
                f"{context} must state a signAgreementReason exactly when no shared response is "
                "directional"
            )
        if directional == 0:
            _expect_text(pair["signAgreementReason"], f"{context} signAgreementReason")


def _pinned_path(entry: Mapping[str, Any], context: str) -> str:
    """One pinned input: a repository-relative path with the checksum it was read at."""
    path = _expect_text(entry.get("path"), f"{context} path")
    _expect_checksum(entry.get("sha256"), f"{context} sha256")
    return path


def _declared_input_paths(report: Mapping[str, Any]) -> tuple[str, ...]:
    """Check every input pin and return the repository-relative paths it names."""
    inputs = _expect_object(report["inputs"], "report inputs")
    paths = [
        _pinned_path(_expect_object(inputs.get("plan"), "report inputs plan"), "report inputs plan"),
        _pinned_path(
            _expect_object(inputs.get("crosswalk"), "report inputs crosswalk"),
            "report inputs crosswalk",
        ),
    ]
    specs = _expect_list(inputs.get("specs"), "report inputs specs")
    if not specs:
        raise ValueError("report inputs specs must not be empty")
    for index, item in enumerate(specs):
        context = f"report inputs spec {index}"
        spec = _expect_object(item, context)
        _expect_text(spec.get("studyId"), f"{context} studyId")
        paths.append(_pinned_path(spec, context))
    for index, item in enumerate(_expect_list(inputs.get("downloads"), "report inputs downloads")):
        context = f"report inputs download {index}"
        download = _expect_object(item, context)
        for field in ("studyId", "name", "url"):
            _expect_text(download.get(field), f"{context} {field}")
        _expect_checksum(download.get("sha256"), f"{context} sha256")
    return tuple(paths)


def validate_full_report(value: Any) -> Mapping[str, Any]:
    """Check that the report is a complete schema-1 report with consistent identities."""
    report = _expect_object(value, "report")
    if report.get("schemaVersion") != SCHEMA_VERSION:
        raise ValueError(
            f"unsupported report schemaVersion {report.get('schemaVersion')!r}; "
            f"expected {SCHEMA_VERSION}"
        )
    if report.get("reportFormat") == REPORT_FORMAT or "omittedVectors" in report:
        raise ValueError(
            "input is already a statistics-only summary; export needs the full report that "
            f"{GENERATOR} writes"
        )
    for key in REQUIRED_TOP_LEVEL:
        if key not in report:
            raise ValueError(f"report has no {key!r}")
    methods = _expect_object(report["methods"], "report methods")
    if not methods:
        raise ValueError("report methods must not be empty")
    for name, text in methods.items():
        _expect_text(text, f"report method {name!r}")
    limitations = _expect_list(report["limitations"], "report limitations")
    if not limitations:
        raise ValueError("report limitations must not be empty")
    for index, text in enumerate(limitations):
        _expect_text(text, f"report limitation {index}")
    layers = _validate_layers(report["layers"])
    contrasts = _validate_contrasts(report["contrasts"])
    _validate_level_pairs(report["levelPairs"], layers)
    _validate_response_pairs(report["responsePairs"], contrasts)
    _declared_input_paths(report)
    return report


def load_report(path: Path) -> tuple[Mapping[str, Any], bytes]:
    """Read, parse and validate a full report, returning it with its exact bytes."""
    if not path.is_file():
        raise ValueError(f"report does not exist: {path}")
    raw = path.read_bytes()
    try:
        report = json.loads(raw.decode("utf-8"), parse_constant=_reject_json_constant)
    except UnicodeDecodeError as error:
        raise ValueError(f"report is not valid UTF-8: {error}") from error
    except json.JSONDecodeError as error:
        raise ValueError(f"report is not valid JSON: {error}") from error
    _reject_non_finite(report, "report")
    return validate_full_report(report), raw


def provenance(report_path: Path, raw: bytes, root: Path = ROOT) -> dict[str, Any]:
    """Identify this exporter and the exact input bytes, claiming no authorship."""
    return {
        "exporter": {
            "path": _display_path(SELF_PATH, ROOT),
            "sha256": _sha256(SELF_PATH.read_bytes()),
        },
        "input": {
            "path": _display_path(report_path, root),
            "sha256": _sha256(raw),
            "bytes": len(raw),
        },
        "statistics": STATISTICS_ORIGIN,
    }


def statistics_summary(
    report: Mapping[str, Any],
    export_provenance: Mapping[str, Any],
) -> dict[str, Any]:
    """Copy the report without the per-gene vectors, declaring what was omitted."""
    summary = copy.deepcopy(dict(report))
    for layer in summary["layers"]:
        del layer[LAYER_VECTOR_FIELD]
    for contrast in summary["contrasts"]:
        del contrast[CONTRAST_VECTOR_FIELD]
    summary["reportFormat"] = REPORT_FORMAT
    summary["omittedVectors"] = {
        "layerField": LAYER_VECTOR_FIELD,
        "contrastField": CONTRAST_VECTOR_FIELD,
        "reproduction": (
            f"{GENERATOR} regenerates the complete vectors from {report['inputs']['plan']['path']}"
        ),
    }
    summary["export"] = copy.deepcopy(dict(export_provenance))
    return summary


def replicate_rows(report: Mapping[str, Any]) -> list[list[Any]]:
    """Build the replicate table: one row per layer, in report order."""
    rows: list[list[Any]] = [list(REPLICATE_COLUMNS)]
    for layer in report["layers"]:
        sample_range = layer["empiricalSampleRange"]
        rows.append([
            layer["id"],
            layer["studyId"],
            layer["replicateType"],
            layer["biologicalBandAvailable"],
            layer["meanGeneCount"],
            len(layer["strata"]),
            sample_range["definedCorrelationCount"],
            sample_range["min"],
            sample_range["median"],
            sample_range["max"],
        ])
    return rows


def response_rows(report: Mapping[str, Any]) -> list[list[Any]]:
    """Build the response table: one row per response pair, in report order."""
    contrasts = {contrast["id"]: contrast for contrast in report["contrasts"]}
    rows: list[list[Any]] = [list(RESPONSE_COLUMNS)]
    for pair in report["responsePairs"]:
        left = contrasts[pair["left"]]
        right = contrasts[pair["right"]]
        rows.append([
            pair["left"],
            pair["right"],
            left["studyId"],
            right["studyId"],
            left["label"],
            right["label"],
            pair["sharedGeneCount"],
            pair["spearman"],
            pair["pearson"],
            pair["sameDirectionCount"],
            pair["nonzeroDirectionGeneCount"],
            pair["signAgreementFraction"],
            left["measuredIntersectionCount"],
            right["measuredIntersectionCount"],
            left["positiveGeneCount"],
            right["positiveGeneCount"],
            left["excludedZeroCount"],
            right["excludedZeroCount"],
            pair["caveat"],
        ])
    return rows


def render_table(rows: Sequence[Sequence[Any]]) -> str:
    """Serialise rows as TSV, quoting any cell that carries a delimiter or newline."""
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, delimiter="\t", lineterminator="\n", quoting=csv.QUOTE_MINIMAL)
    writer.writerows(rows)
    return buffer.getvalue()


def render_summary(summary: Mapping[str, Any]) -> str:
    """Serialise the summary deterministically, rejecting any non-finite number."""
    return json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True, allow_nan=False) + "\n"


def _same_file(left: Path, right: Path) -> bool:
    try:
        return left.samefile(right)
    except OSError:
        return False


def _alias_key(path: Path) -> tuple[str, ...]:
    """Path identity that survives filesystem aliasing.

    macOS and Windows volumes treat names differing only in letter case as one file, and Apple
    filesystems also fold Unicode composition.  ``Path.resolve`` reports the spelling it was
    given, so comparing resolved paths cannot see those aliases, and ``samefile`` cannot compare
    destinations that do not exist yet.  Folding both makes containment and collision checks
    reject such aliases on every filesystem; the deliberate cost is that case-only variants are
    refused even where a filesystem would keep them apart.
    """
    return tuple(unicodedata.normalize("NFC", part).casefold() for part in path.parts)


def _is_inside(target: tuple[str, ...], directory: tuple[str, ...]) -> bool:
    """True when the target is the directory itself or lies beneath it, aliases included."""
    return target[:len(directory)] == directory


def _resolve(path: Path, context: str) -> Path:
    """Resolve a path, naming what failed when it cannot be resolved at all."""
    try:
        return path.expanduser().resolve()
    except (OSError, RuntimeError) as error:
        # A symlink loop in the path cannot be resolved on any interpreter.
        raise ValueError(f"{context} cannot be resolved: {path}") from error


def _reject_unusable_ancestors(label: str, target: Path) -> None:
    """Reject a destination whose parent chain is blocked by a non-directory."""
    for ancestor in target.parents:
        if ancestor.is_dir():
            return  # Everything above an existing directory is a directory too.
        if ancestor.exists():
            raise ValueError(
                f"{label} destination lies under {ancestor}, which is not a directory")


def preflight_destinations(
    destinations: Mapping[str, Path],
    report_path: Path,
    report: Mapping[str, Any],
    root: Path = ROOT,
) -> dict[str, Path]:
    """Resolve every destination and reject publication, input aliasing and collisions."""
    root = _resolve(root, "the repository root")
    resolved: dict[str, Path] = {}
    keys: dict[str, tuple[str, ...]] = {}
    for label, path in destinations.items():
        target = _resolve(path, f"{label} destination path")
        if target.is_dir():
            raise ValueError(f"{label} destination is a directory: {path}")
        _reject_unusable_ancestors(label, target)
        resolved[label] = target
        keys[label] = _alias_key(target)

    protected: list[tuple[Path, str]] = [
        (_resolve(report_path, "the input report path"), "the input report"),
        (SELF_PATH, "the exporter itself"),
    ]
    # Every declared input is protected wherever it resolves, inside the repository or not.
    seen = {_alias_key(source) for source, _ in protected}
    for relative in _declared_input_paths(report):
        description = f"the pinned input {relative}"
        candidate = _resolve(root / relative, description)
        if _alias_key(candidate) not in seen:
            seen.add(_alias_key(candidate))
            protected.append((candidate, description))

    unpublishable = {
        directory: _alias_key(_resolve(root / directory, f"the {directory}/ directory"))
        for directory in UNPUBLISHABLE_DIRECTORIES
    }
    for label, target in resolved.items():
        for directory, prohibited in unpublishable.items():
            if _is_inside(keys[label], prohibited):
                raise ValueError(f"{label} output must not be published inside {directory}/")
        for source, description in protected:
            if keys[label] == _alias_key(source) or _same_file(target, source):
                raise ValueError(f"{label} output would overwrite {description}")

    for left, right in itertools.combinations(sorted(resolved), 2):
        if keys[left] == keys[right] and resolved[left] != resolved[right]:
            raise ValueError(
                f"{left} and {right} outputs differ only in letter case or Unicode form, which "
                "name one file on a case-insensitive filesystem"
            )
        if keys[left] == keys[right] or _same_file(resolved[left], resolved[right]):
            raise ValueError(f"{left} and {right} outputs name the same file")

    for parent, child in itertools.permutations(sorted(resolved), 2):
        if keys[parent] != keys[child] and _is_inside(keys[child], keys[parent]):
            raise ValueError(
                f"{parent} output would become a parent directory of the {child} output")
    return resolved


def _write_atomically(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", newline="", dir=path.parent,
        prefix=f".{path.name}.", suffix=".partial", delete=False,
    )
    try:
        with handle:
            handle.write(content)
        os.replace(handle.name, path)
    except BaseException:
        Path(handle.name).unlink(missing_ok=True)
        raise


def export_report(
    report_path: Path,
    summary_path: Path,
    replicates_path: Path,
    responses_path: Path,
    *,
    root: Path = ROOT,
) -> dict[str, Any]:
    """Validate the report and all destinations, then write the summary and both tables."""
    report, raw = load_report(report_path.expanduser())
    destinations = preflight_destinations(
        {"json": summary_path, "replicates": replicates_path, "responses": responses_path},
        report_path,
        report,
        root,
    )
    summary = statistics_summary(report, provenance(report_path, raw, root))
    contents = {
        "json": render_summary(summary),
        "replicates": render_table(replicate_rows(summary)),
        "responses": render_table(response_rows(summary)),
    }
    for label, content in contents.items():
        _write_atomically(destinations[label], content)
    return summary


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("report", type=Path, help="full agreement report JSON from the generator")
    parser.add_argument(
        "--json", dest="summary", type=Path, required=True,
        help="statistics-only summary destination (outside data/ and site/)")
    parser.add_argument(
        "--replicates", type=Path, required=True, help="replicate range table destination, TSV")
    parser.add_argument(
        "--responses", type=Path, required=True, help="response comparison table destination, TSV")
    args = parser.parse_args(argv)
    export_report(args.report, args.summary, args.replicates, args.responses, root=ROOT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
