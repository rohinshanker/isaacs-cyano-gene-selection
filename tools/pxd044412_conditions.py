"""Build 42 non-release, candidate PXD044412 LiP-SMap condition records.

Table S1 dose cells are reported facts. Their correspondence to S3 labels is
inferred; neither signed fold-change polarity nor biological n is established.
"""

from __future__ import annotations

import argparse
from copy import deepcopy
from datetime import datetime
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from condition_record import validate_record  # noqa: E402
from pxd044412_peptides import SOURCE_SHA256  # noqa: E402

METADATA = ROOT / "data/audits/pxd044412/conditions.json"
INVENTORY = ROOT / "data/audits/pxd044412/native-summary.json"
CODES = (
    "2OG", "2PG", "3PGA", "ADP", "AMP", "ATP", "AcCoA", "Cit", "FBP",
    "G6P", "GAP", "GTP", "Glyc", "Glyx", "Mal", "NADP", "NADPH", "PEP",
    "Ru5P", "RuBP", "Suc",
)
LABELS = {f"{code}_{suffix}" for code in CODES for suffix in (1, 2)}
DATASET_DOI = "https://doi.org/10.6084/m9.figshare.23939604.v1"
LICENCE_URL = "https://creativecommons.org/licenses/by/4.0/"
SOURCE_PINS = {
    "article": {
        "sha256": "daf158707f78a74ff507ec5fbda0f767df239aea8cf41b0bdda2a7298d633109",
        "bytes": 185562,
    },
    "supplement": {
        "sha256": "9fdf5707e5d45194ba119957864e2085a604beb4fda0692a44df1ff3e04bf522",
        "bytes": 5772013,
        "archiveSha256": "ae96e1419c81f77ed98794abca454252a9eaf281b8448796684fc760a3ded6be",
        "archiveBytes": 14050460,
    },
    "analysisCode": {
        "sha256": "3afc8f333064f1328331fbc28e95f64e4d06ad7f1c661c5697ffe3270ef43386",
        "bytes": 12981,
        "commit": "67af07959aa25dfe98b827965c5f745527c19a3b",
    },
}
PAPER_SPANS = {
    "growthPhase", "cultivation", "pooledCultivations", "preFreezing", "assayDesign",
    "assayExposure", "sharedExtract", "control", "analyzedReplicates", "outlierHandling",
    "repeatGlyoxylate",
}
PAPER_NORMALIZATION = "Join itertext with no separator, then collapse whitespace to single spaces"
LIMITS = [
    "Candidate prefix/name and suffix/dose assignments are inferred, not verified sample joins.",
    "S3 log2FC polarity is unknown; positive values do not establish activation or protection.",
    "Independent biological n is unknown; pooled cultivations and technical aliquots are not biological n.",
    "Doses describe in vitro extract additions, not intracellular or live-cell concentrations.",
    "No-added-metabolite buffer control does not establish zero endogenous metabolite.",
    "Native row counts establish label coverage only; no comparisons or dose tiers are pooled.",
    "Source organism is PCC 7942; future UTEX context establishes no gene mapping or browser admission.",
    "LiP-SMap peptide evidence is not protein abundance or confirmed binding.",
    "Four prepared technical aliquots per group do not establish analyzed n. Peptide screening "
    "required detection in at least three replicates; outlier removal and repeated experiments "
    "can alter analyzed sets. Correspondence of S3 Glyx_2 to the repeated 10 mM glyoxylate runs is unknown.",
    "The builder validates receipt structure and source pins; source rehashing and paper-span "
    "matching remain coordinator/reviewer audit tasks.",
]


def _require(ok: bool, message: str) -> None:
    if not ok:
        raise ValueError(message)


def _object(value: Any, label: str) -> dict[str, Any]:
    _require(isinstance(value, dict), f"{label} must be an object")
    return value


def _text(value: Any, label: str) -> str:
    _require(isinstance(value, str) and bool(value.strip()), f"{label} needs nonempty text")
    return value


def _equal(value: Any, expected: Any, label: str) -> None:
    # JSON booleans must not masquerade as counts, schema versions or doses.
    _require(type(value) is type(expected) and value == expected,
             f"{label} must retain {expected!r}")
    if isinstance(expected, dict):
        for key, item in expected.items():
            _equal(value[key], item, f"{label}.{key}")
    elif isinstance(expected, list):
        for index, item in enumerate(expected):
            _equal(value[index], item, f"{label}[{index}]")


def _fields(value: Any, expected: dict[str, Any], label: str) -> None:
    obj = _object(value, label)
    for key, wanted in expected.items():
        _require(key in obj, f"{label} needs {key}")
        _equal(obj[key], wanted, f"{label}.{key}")


def _keys(value: Any, expected: set[str], label: str) -> dict[str, Any]:
    obj = _object(value, label)
    _require(set(obj) == expected, f"{label} must have exactly the allowed keys {sorted(expected)}")
    return obj


def _utc_timestamp(value: Any, label: str) -> None:
    _require(isinstance(value, str) and re.fullmatch(
        r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?(?:Z|\+00:00)",
        value) is not None, f"{label} must be a UTC ISO timestamp with Z or +00:00")
    try:
        datetime.fromisoformat(value)
    except ValueError as error:
        raise ValueError(f"{label} must be a valid UTC ISO timestamp") from error


def _validate_paper_evidence(value: Any) -> None:
    """Validate receipts only; no source text is read or rehashed here."""
    spans = _keys(value, PAPER_SPANS, "paperEvidence")
    for name, span in spans.items():
        label = f"paperEvidence.{name}"
        span = _object(span, label)
        _fields(span, {"source": "article", "normalization": PAPER_NORMALIZATION}, label)
        _require(isinstance(span.get("sectionId"), str)
                 and re.fullmatch(r"Sec[1-9][0-9]*", span["sectionId"]) is not None,
                 f"{label}.sectionId must name an article section")
        _require(type(span.get("paragraph")) is int and span["paragraph"] > 0,
                 f"{label}.paragraph must be a positive 1-based integer")
        for key in ("paragraphSha256", "excerptSha256"):
            _require(isinstance(span.get(key), str)
                     and re.fullmatch(r"[0-9a-f]{64}", span[key]) is not None,
                     f"{label}.{key} must be a SHA-256 digest")
        _require(type(span.get("start")) is int and span["start"] >= 0
                 and type(span.get("end")) is int and span["end"] > span["start"],
                 f"{label} needs integer offsets 0 <= start < end")
        facts = _object(span.get("facts"), f"{label}.facts")
        _require(bool(facts), f"{label}.facts must not be empty")
        for key in facts:
            _text(key, f"{label}.facts key")


def _dose(raw: Any, label: str) -> float:
    _require(isinstance(raw, str) and re.fullmatch(r"(?:\d+(?:\.\d*)?|\.\d+)", raw) is not None,
             f"{label} must preserve a numeric source cell string")
    value = float(raw)
    _require(math.isfinite(value) and value > 0, f"{label} must be finite and positive")
    return value


def _validate_context(metadata: dict[str, Any]) -> dict[str, Any]:
    """Check curated scientific boundaries without interpreting prose."""
    _fields(metadata, {"schemaVersion": 1, "accession": "PXD044412",
                       "sourceSha256": SOURCE_SHA256, "releaseEligible": False}, "metadata")
    _text(metadata.get("basisScope"), "basisScope")
    mapping = _keys(metadata.get("labelMapping"), {"status", "doseCodes", "text"}, "labelMapping")
    _fields(mapping, {"status": "inferred", "doseCodes": {"1": "low", "2": "high"}}, "labelMapping")
    _text(mapping.get("text"), "labelMapping.text")
    contrast = _keys(metadata.get("contrast"),
                     {"status", "design", "numerator", "denominator", "text"}, "contrast")
    _fields(contrast, {"status": "not verified", "numerator": None, "denominator": None}, "contrast")
    for key in ("design", "text"):
        _text(contrast.get(key), f"contrast.{key}")
    assay = _keys(metadata.get("assay"), {
        "material", "method", "metaboliteAddition", "temperatureC", "durationMinutes",
        "scope", "proteinConcentrationUgPerUl", "proteaseToProteinRatio", "control",
        "biologicalCultivationsPooled", "groupsPerExperiment", "sharedExtract", "where",
        "preparedTechnicalReplicatesPerGroup", "replicateScope",
    }, "assay")
    _fields(assay, {
        "temperatureC": 25, "durationMinutes": 10, "proteinConcentrationUgPerUl": 1,
        "proteaseToProteinRatio": "1:100", "biologicalCultivationsPooled": 4,
        "preparedTechnicalReplicatesPerGroup": 4, "groupsPerExperiment": 3, "sharedExtract": True,
    }, "assay")
    for key in ("material", "method", "metaboliteAddition", "scope", "where", "replicateScope"):
        _text(assay.get(key), f"assay.{key}")
    control = _keys(assay.get("control"), {"addedMetabolite", "text"}, "assay.control")
    _fields(control, {"addedMetabolite": False}, "assay.control")
    _text(control.get("text"), "assay.control.text")
    handling = _keys(metadata.get("preFreezingHandling"), {
        "lightIntensity", "unit", "approximate", "durationMinutes", "text", "where",
    }, "preFreezingHandling")
    _fields(handling, {"lightIntensity": 400, "unit": "µmol photons m⁻² s⁻¹",
                       "approximate": True, "durationMinutes": 5}, "preFreezingHandling")
    for key in ("text", "where"):
        _text(handling.get(key), f"preFreezingHandling.{key}")

    sources = _object(metadata.get("sources"), "sources")
    for name, pins in SOURCE_PINS.items():
        source = _object(sources.get(name), f"sources.{name}")
        _require(_text(source.get("url"), name).startswith("https://"), f"{name} URL must be https")
        _fields(source, pins, f"sources.{name}")
        if "retrieved" in source:
            _utc_timestamp(source["retrieved"], f"{name}.retrieved")
    for name in ("article", "supplement"):
        _require("retrieved" in sources[name], f"{name} needs retrieved timestamp")
    _fields(sources["supplement"], {"table": "S1", "pdfPages": [29, 30]}, "supplement")
    for key in ("member", "verification"):
        _text(sources["supplement"].get(key), f"supplement.{key}")
    for key in ("commit", "scope", "doseCodeLocation", "contrastLocation"):
        _text(sources["analysisCode"].get(key), f"analysisCode.{key}")
    excerpts = _object(metadata.get("paperExcerpts"), "paperExcerpts")
    for name in ("pooled", "technical", "assay", "duration"):
        excerpt = _object(excerpts.get(name), name)
        for key in ("where", "quote", "verification"):
            _text(excerpt.get(key), f"{name}.{key}")
    _validate_paper_evidence(metadata.get("paperEvidence"))

    base = _keys(metadata.get("record"), {
        "studyId", "dataType", "platform", "strain", "basis", "conditionSet", "samples",
        "archiveUrl", "citation", "replicates", "treatments", "group", "conditionTableRow",
        "conditions",
    }, "record")
    validate_record(base, "PXD044412 source conditions")
    _fields(base, {"studyId": "PXD044412", "dataType": "proteomics", "platform": "LC-MS/MS",
                   "strain": "Synechococcus elongatus PCC 7942", "basis": "transferred",
                   "group": "other", "conditionTableRow": None}, "record")
    _keys(base["replicates"], {"count", "status", "text", "preparedTechnicalCount",
                              "analyzedTechnicalCount", "minimumDetectedTechnicalCount"}, "replicates")
    _fields(base["replicates"], {
        "count": None, "status": "not reported", "preparedTechnicalCount": 4,
        "analyzedTechnicalCount": None, "minimumDetectedTechnicalCount": 3,
    }, "replicates")
    citation = _object(base.get("citation"), "citation")
    _equal(citation.get("url"), "https://doi.org/10.1038/s42003-023-05318-8", "citation.url")
    axes = base["conditions"]
    for name, fields in {
        "temperature": {"status": "not reported", "lo": None, "hi": None},
        "lightRegime": {"status": "not reported", "kind": None, "photoperiod": None,
                        "spectrumClass": None, "entrained": False},
        "lightIntensity": {"status": "reported", "lo": 70, "hi": 70, "approximate": True},
        "co2": {"status": "reported", "lo": 1, "hi": 1},
        "medium": {"status": "reported", "base": "BG-11", "modified": False,
                   "conditioned": False, "nitrogenAltered": False},
        "format": {"status": "reported", "value": "planktonic liquid"},
        "phase": {"status": "reported", "label": "exponential", "od": [1, 1],
                  "odNm": 730, "approximate": True},
    }.items():
        _fields(axes[name], fields, f"conditions.{name}")
        _text(axes[name]["where"], f"{name}.where")
        if axes[name]["status"] == "reported":
            _text(axes[name]["quote"], f"{name}.quote")
            _text(axes[name].get("verification"), f"{name}.verification")
    return base


def build_records(metadata: dict[str, Any], inventory: dict[str, Any]) -> dict[str, Any]:
    """Validate curated inputs and expand one independent record per exact label.

    Input and output objects share no mutable data, including between layers.
    The native audit provides coverage counts only, never replicate estimates.
    """
    base = _validate_context(_object(metadata, "metadata"))
    _fields(inventory, {"sourceSha256": SOURCE_SHA256, "labelCount": 42}, "inventory")
    coverage = _object(inventory.get("bySourceLabel"), "inventory.bySourceLabel")
    _require(set(coverage) == LABELS, "inventory must cover exactly the 42 expected source labels")
    for label, counts in coverage.items():
        counts = _object(counts, f"coverage {label}")
        _require(type(counts.get("rows")) is int and counts["rows"] > 0,
                 f"coverage {label} needs positive integer rows")
    _require(type(inventory.get("sourceRows")) is int
             and inventory["sourceRows"] == sum(counts["rows"] for counts in coverage.values()),
             "inventory sourceRows must equal per-label coverage rows")
    metabolites = metadata.get("metabolites")
    _require(isinstance(metabolites, list) and len(metabolites) == 21,
             "metadata needs exactly 21 metabolites")
    by_code = {}
    for metabolite in metabolites:
        metabolite = _keys(metabolite, {"code", "name", "kegg", "sourceLabels", "low", "high",
                                        "unit", "where", "mappingStatus"}, "metabolite")
        code = _text(metabolite.get("code"), "metabolite.code")
        _require(code in CODES and code not in by_code, f"duplicate or unknown metabolite code: {code}")
        for key in ("name", "kegg", "where"):
            _text(metabolite.get(key), f"{code}.{key}")
        _fields(metabolite, {"unit": "mM", "mappingStatus": "inferred"}, code)
        _equal(metabolite.get("sourceLabels"), [f"{code}_1", f"{code}_2"], f"{code}.sourceLabels")
        low = _dose(metabolite.get("low"), f"{code}.low")
        high = _dose(metabolite.get("high"), f"{code}.high")
        _require(low < high, f"{code} low must be strictly less than high")
        by_code[code] = metabolite
    layers = []
    for code in CODES:
        metabolite = by_code[code]
        for suffix, tier in ((1, "low"), (2, "high")):
            label = f"{code}_{suffix}"
            raw = metabolite[tier]
            record = deepcopy(base)
            record["conditionSet"] = (
                f"{label}: candidate {metabolite['name']} {tier} {raw} mM "
                "vs no-added-metabolite control (inferred assignment)"
            )
            record["samples"] = f"S3 source Label={label}; no sample/run pairing inferred"
            record["sourceLabel"] = label
            record["candidateDose"] = {
                "value": _dose(raw, label), "raw": raw, "unit": "mM", "tier": tier,
                "mappingStatus": "inferred", "where": metabolite["where"],
            }
            record["metabolite"] = deepcopy(metabolite)
            for key in ("assay", "contrast", "preFreezingHandling", "sources", "paperExcerpts",
                        "paperEvidence", "labelMapping", "basisScope"):
                record[key] = deepcopy(metadata[key])
            record["releaseEligible"] = False
            validate_record(record, label)
            layers.append({
                "id": f"PXD044412_{label}", "sourceLabel": label,
                "kind": "candidate_comparison", "releaseEligible": False,
                "coverage": {"nativeSourceRows": coverage[label]["rows"],
                             "scope": "Label coverage only; not replicate counts"},
                "record": record,
            })
    return {
        "schemaVersion": 1, "accession": "PXD044412", "sourceSha256": SOURCE_SHA256,
        "releaseEligible": False, "quantity": "Source analyzed LiP-SMap peptide comparisons",
        "aggregation": "None; all 42 source comparisons and both dose tiers remain separate",
        "attribution": {"article": deepcopy(base["citation"]), "datasetDoi": DATASET_DOI,
                        "licence": "CC BY 4.0", "licenceUrl": LICENCE_URL,
                        "derivation": "Candidate condition records derived from Table S1 and S3 label inventory"},
        "limits": list(LIMITS), "metadata": deepcopy(metadata), "layers": layers,
    }


def _read_json(path: Path) -> tuple[Any, dict[str, Any]]:
    def unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result = {}
        for key, value in pairs:
            _require(key not in result, f"duplicate JSON key: {key}")
            result[key] = value
        return result

    raw = path.read_bytes()
    return json.loads(raw, object_pairs_hook=unique_object), {
        "file": path.name, "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw),
    }


def _write_new(output: Path, text: str) -> None:
    """Publish complete bytes atomically, refusing even dangling destinations.

    The parent must already exist. A hard link claims the final name without
    replacement; all failures remove the private staging file.
    """
    fd, staging = tempfile.mkstemp(prefix=".pxd044412-", dir=output.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
        os.link(staging, output)
    finally:
        os.unlink(staging)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--metadata", type=Path, default=METADATA)
    parser.add_argument("--inventory", type=Path, default=INVENTORY)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        if os.path.lexists(args.output):
            raise ValueError("output must be new; existing files, directories and symlinks are protected")
        metadata, metadata_source = _read_json(args.metadata)
        inventory, inventory_source = _read_json(args.inventory)
        result = build_records(metadata, inventory)
        result["inputSources"] = {"metadata": metadata_source, "inventory": inventory_source}
        serialized = json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
        _write_new(args.output, serialized)
    except (OSError, ValueError, UnicodeError) as error:
        parser.error(str(error))
    print("Wrote 42 candidate comparison condition records; no browser admission")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
