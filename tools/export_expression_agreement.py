#!/usr/bin/env python3
"""Re-serialise a full expression-agreement report as a summary and review tables.

Usage:
    export_expression_agreement.py REPORT --json PATH --replicates PATH --responses PATH

The exporter reads a schema-1 report written by ``tools/expression_agreement.py``.
It copies every statistic verbatim, omits only the per-gene layer means and
contrast response vectors, and recomputes no number.  Identities, denominators
and cross-references are checked, and all destinations are preflighted, before
anything is written.
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
        means = _expect_object(layer[LAYER_VECTOR_FIELD], f"layer {layer_id!r} means")
        if _expect_count(layer.get("meanGeneCount"), f"layer {layer_id!r} meanGeneCount") != len(means):
            raise ValueError(f"layer {layer_id!r} meanGeneCount disagrees with its means")
        _validate_sample_range(layer_id, layer)
        by_id[layer_id] = layer
    return by_id


def _validate_sample_range(layer_id: str, layer: Mapping[str, Any]) -> None:
    sample_range = _expect_object(
        layer.get("empiricalSampleRange"), f"layer {layer_id!r} empiricalSampleRange")
    range_id = _expect_text(sample_range.get("id"), f"layer {layer_id!r} empiricalSampleRange id")
    for key in ("min", "median", "max"):
        if key not in sample_range:
            raise ValueError(f"layer {layer_id!r} empiricalSampleRange has no {key!r}")
    defined = 0
    stratum_ids: set[str] = set()
    for index, item in enumerate(_expect_list(layer.get("strata"), f"layer {layer_id!r} strata")):
        stratum = _expect_object(item, f"layer {layer_id!r} stratum {index}")
        stratum_id = _expect_text(stratum.get("id"), f"layer {layer_id!r} stratum {index} id")
        if stratum_id in stratum_ids:
            raise ValueError(f"duplicate stratum id {stratum_id!r} in layer {layer_id!r}")
        stratum_ids.add(stratum_id)
        columns = set(_expect_list(stratum.get("columns"), f"stratum {stratum_id!r} columns"))
        correlations = _expect_list(
            stratum.get("sampleCorrelations"), f"stratum {stratum_id!r} sampleCorrelations")
        for pair_index, pair_item in enumerate(correlations):
            pair = _expect_object(pair_item, f"stratum {stratum_id!r} correlation {pair_index}")
            named = {pair.get("sampleLeft"), pair.get("sampleRight")}
            if not named <= columns:
                raise ValueError(
                    f"stratum {stratum_id!r} correlation {pair_index} names a sample outside its columns")
            defined += pair.get("spearman") is not None
    if _expect_count(
        sample_range.get("definedCorrelationCount"),
        f"layer {layer_id!r} definedCorrelationCount",
    ) != defined:
        raise ValueError(
            f"layer {layer_id!r} definedCorrelationCount disagrees with its sample correlations")
    if layer.get("biologicalBandAvailable") and layer.get("biologicalBandId") != range_id:
        raise ValueError(f"layer {layer_id!r} biological band does not reference its sample range")


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
        response = _expect_object(
            contrast[CONTRAST_VECTOR_FIELD], f"contrast {contrast_id!r} vector")
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
        for side in ("left", "right"):
            layer_id = _expect_text(pair.get(side), f"level pair {index} {side}")
            if layer_id not in layers:
                raise ValueError(f"level pair {index} {side} names unknown layer {layer_id!r}")
            reference = _expect_object(
                pair.get(f"{side}Reference"), f"level pair {index} {side}Reference")
            if reference.get("layerId") != layer_id:
                raise ValueError(f"level pair {index} {side}Reference does not name layer {layer_id!r}")
            expected = layers[layer_id]["empiricalSampleRange"]["id"]
            if reference.get("empiricalSampleRangeId") != expected:
                raise ValueError(
                    f"level pair {index} {side}Reference does not name the sample range of "
                    f"layer {layer_id!r}"
                )


def _validate_response_pairs(value: Any, contrasts: Mapping[str, Mapping[str, Any]]) -> None:
    for index, item in enumerate(_expect_list(value, "report responsePairs")):
        pair = _expect_object(item, f"response pair {index}")
        for side in ("left", "right"):
            contrast_id = _expect_text(pair.get(side), f"response pair {index} {side}")
            if contrast_id not in contrasts:
                raise ValueError(
                    f"response pair {index} {side} names unknown contrast {contrast_id!r}")


def _declared_input_paths(report: Mapping[str, Any]) -> tuple[str, ...]:
    """Repository-relative paths the report pins as its own inputs."""
    inputs = _expect_object(report["inputs"], "report inputs")
    plan = _expect_object(inputs.get("plan"), "report inputs plan")
    paths = [_expect_text(plan.get("path"), "report inputs plan path")]
    crosswalk = inputs.get("crosswalk")
    if isinstance(crosswalk, dict) and isinstance(crosswalk.get("path"), str):
        paths.append(crosswalk["path"])
    for spec in inputs.get("specs", []):
        if isinstance(spec, dict) and isinstance(spec.get("path"), str):
            paths.append(spec["path"])
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


def preflight_destinations(
    destinations: Mapping[str, Path],
    report_path: Path,
    report: Mapping[str, Any],
    root: Path = ROOT,
) -> dict[str, Path]:
    """Resolve every destination and reject publication, input aliasing and collisions."""
    root = root.resolve()
    resolved: dict[str, Path] = {}
    for label, path in destinations.items():
        target = path.expanduser().resolve()
        if target.is_dir():
            raise ValueError(f"{label} destination is a directory: {path}")
        resolved[label] = target

    protected = {report_path.expanduser().resolve(): "the input report"}
    for relative in _declared_input_paths(report):
        candidate = (root / relative).resolve()
        if candidate.is_relative_to(root):
            protected.setdefault(candidate, f"the pinned input {relative}")

    for label, target in resolved.items():
        for directory in UNPUBLISHABLE_DIRECTORIES:
            if target.is_relative_to((root / directory).resolve()):
                raise ValueError(f"{label} output must not be published inside {directory}/")
        for source, description in protected.items():
            if target == source or _same_file(target, source):
                raise ValueError(f"{label} output would overwrite {description}")

    for left, right in itertools.combinations(sorted(resolved), 2):
        if resolved[left] == resolved[right] or _same_file(resolved[left], resolved[right]):
            raise ValueError(f"{left} and {right} outputs name the same file")
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
