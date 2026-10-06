"""The structured condition record every expression source carries.

A record states, axis by axis, the growth condition a dataset was measured
under, in the vocabulary the condition-comparability contract uses: a value as
the source reports it, a status saying whether it was reported at all, and the
quoted sentence it was read from. The site groups datasets and draws the
condition scales from these fields; it never estimates a missing one.
"""

from __future__ import annotations

import re
from typing import Any, Mapping

DATA_TYPES = ("transcriptomics", "proteomics", "fitness")
PLATFORMS = ("RNA-seq", "array", "LC-MS/MS", "RB-TnSeq")
BASES = ("direct", "transferred")
STATUSES = ("reported", "not reported", "not retrieved", "conflicting")
REGIME_KINDS = ("continuous", "diel")
GROUPS = ("biofilm", "elevated", "stress", "diel", "standard", "engineered", "other")
AXES = ("temperature", "lightIntensity", "lightRegime", "co2", "medium", "format", "phase")
RANGE_AXES = {"temperature": "°C", "lightIntensity": "µmol photons m⁻² s⁻¹", "co2": "%"}
PHASE_LABELS = ("exponential", "stationary", "steady-state", "OD stated", "mixed")

_SOURCE_FIELDS = ("quote", "where")
_PMID = re.compile(r"^\d+$")


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _check_axis_common(axis: Mapping[str, Any], name: str, label: str) -> None:
    _require(isinstance(axis, Mapping), f"{label}: condition axis {name} must be an object")
    _require(axis.get("status") in STATUSES,
             f"{label}: condition axis {name} has an invalid status: {axis.get('status')!r}")
    _require(isinstance(axis.get("text"), str) and bool(axis["text"]),
             f"{label}: condition axis {name} needs a text value as reported")
    for field in _SOURCE_FIELDS:
        _require(isinstance(axis.get(field), str),
                 f"{label}: condition axis {name} needs a string {field}")
    if axis["status"] == "reported":
        _require(bool(axis["where"]),
                 f"{label}: condition axis {name} is reported but names no source location")


def _check_range_axis(axis: Mapping[str, Any], name: str, label: str) -> None:
    _check_axis_common(axis, name, label)
    _require(axis.get("unit") == RANGE_AXES[name],
             f"{label}: condition axis {name} must use the unit {RANGE_AXES[name]!r}")
    lo, hi = axis.get("lo"), axis.get("hi")
    if axis["status"] == "reported":
        _require(_is_number(lo) and _is_number(hi) and lo <= hi,
                 f"{label}: condition axis {name} is reported but lo/hi are not an ordered numeric range")
    elif axis["status"] == "conflicting":
        # A pooled or self-contradicting source may still state the span it covers.
        _require((lo is None and hi is None) or (_is_number(lo) and _is_number(hi) and lo <= hi),
                 f"{label}: condition axis {name} is conflicting; lo/hi must be null or an ordered range")
    else:
        _require(lo is None and hi is None,
                 f"{label}: condition axis {name} is not reported, so lo and hi must be null")


def validate_record(record: Any, label: str) -> None:
    """Raise ValueError naming the first thing wrong with ``record``."""
    _require(isinstance(record, Mapping), f"{label}: record must be an object")
    for field in ("studyId", "dataType", "platform", "strain", "basis", "conditionSet",
                  "samples", "archiveUrl", "group"):
        _require(isinstance(record.get(field), str) and bool(record[field]),
                 f"{label}: record needs a non-empty string {field}")
    _require(record["dataType"] in DATA_TYPES, f"{label}: record dataType must be one of {DATA_TYPES}")
    _require(record["platform"] in PLATFORMS, f"{label}: record platform must be one of {PLATFORMS}")
    _require(record["basis"] in BASES, f"{label}: record basis must be one of {BASES}")
    _require(record["group"] in GROUPS, f"{label}: record group must be one of {GROUPS}")
    _require(record["archiveUrl"].startswith("https://"), f"{label}: record archiveUrl must be https")

    citation = record.get("citation")
    _require(citation is None or isinstance(citation, Mapping), f"{label}: record citation must be an object or null")
    if citation is not None:
        _require(isinstance(citation.get("text"), str) and bool(citation["text"]),
                 f"{label}: record citation needs text")
        _require(isinstance(citation.get("url"), str) and citation["url"].startswith("https://"),
                 f"{label}: record citation needs an https url")
        pmid = citation.get("pmid")
        _require(pmid is None or (isinstance(pmid, str) and _PMID.match(pmid)),
                 f"{label}: record citation pmid must be digits or null")

    replicates = record.get("replicates")
    _require(isinstance(replicates, Mapping), f"{label}: record replicates must be an object")
    count = replicates.get("count")
    _require(count is None or (isinstance(count, int) and not isinstance(count, bool) and count >= 1),
             f"{label}: record replicates count must be a positive integer or null")
    _require(isinstance(replicates.get("text"), str) and bool(replicates["text"]),
             f"{label}: record replicates needs text")

    treatments = record.get("treatments")
    _require(isinstance(treatments, list) and all(isinstance(t, str) and t for t in treatments),
             f"{label}: record treatments must be a list of non-empty strings")
    row = record.get("conditionTableRow")
    _require(row is None or (isinstance(row, int) and not isinstance(row, bool) and row >= 1),
             f"{label}: record conditionTableRow must be a positive integer or null")

    conditions = record.get("conditions")
    _require(isinstance(conditions, Mapping), f"{label}: record conditions must be an object")
    _require(set(conditions) == set(AXES),
             f"{label}: record conditions must have exactly the axes {AXES}")
    for name in RANGE_AXES:
        _check_range_axis(conditions[name], name, label)

    regime = conditions["lightRegime"]
    _check_axis_common(regime, "lightRegime", label)
    _require(regime.get("kind") is None or regime["kind"] in REGIME_KINDS,
             f"{label}: lightRegime kind must be one of {REGIME_KINDS} or null")
    _require(regime.get("photoperiod") is None or re.fullmatch(r"\d+:\d+", str(regime["photoperiod"])),
             f"{label}: lightRegime photoperiod must look like 12:12 or be null")
    _require(regime.get("spectrumClass") is None or (isinstance(regime["spectrumClass"], str) and regime["spectrumClass"]),
             f"{label}: lightRegime spectrumClass must be a non-empty string or null")
    _require(isinstance(regime.get("entrained"), bool), f"{label}: lightRegime entrained must be a boolean")

    medium = conditions["medium"]
    _check_axis_common(medium, "medium", label)
    _require(medium.get("base") is None or (isinstance(medium["base"], str) and medium["base"]),
             f"{label}: medium base must be a non-empty string or null")
    for flag in ("modified", "conditioned", "nitrogenAltered"):
        _require(isinstance(medium.get(flag), bool), f"{label}: medium {flag} must be a boolean")

    fmt = conditions["format"]
    _check_axis_common(fmt, "format", label)
    _require(fmt.get("value") is None or (isinstance(fmt["value"], str) and fmt["value"]),
             f"{label}: format value must be a non-empty string or null")

    phase = conditions["phase"]
    _check_axis_common(phase, "phase", label)
    _require(phase.get("label") is None or phase["label"] in PHASE_LABELS,
             f"{label}: phase label must be one of {PHASE_LABELS} or null")
    od = phase.get("od")
    _require(od is None or (isinstance(od, list) and len(od) == 2 and all(_is_number(v) for v in od) and od[0] <= od[1]),
             f"{label}: phase od must be a two-number ordered range or null")
    _require(phase.get("odNm") in (None, 730, 750), f"{label}: phase odNm must be 730, 750 or null")
    _require(od is None or phase.get("odNm") is not None, f"{label}: phase od needs its wavelength")


def example_record(**overrides: Any) -> dict[str, Any]:
    """A complete valid record for tests, with any top-level field overridden."""
    def axis(**fields: Any) -> dict[str, Any]:
        base = {"status": "reported", "text": "x", "quote": "x", "where": "test"}
        base.update(fields)
        return base

    record = {
        "studyId": "GSE1", "dataType": "transcriptomics", "platform": "RNA-seq",
        "strain": "PCC 7942", "basis": "transferred", "conditionSet": "test set",
        "samples": "GSM1-GSM3", "archiveUrl": "https://example.org/GSE1",
        "citation": {"text": "Test 2026", "url": "https://doi.org/10.1/x", "pmid": "1"},
        "replicates": {"count": 3, "text": "three replicates", "where": "test"},
        "treatments": [], "group": "standard", "conditionTableRow": None,
        "conditions": {
            "temperature": axis(lo=30, hi=30, unit="°C"),
            "lightIntensity": axis(lo=40, hi=40, unit="µmol photons m⁻² s⁻¹"),
            "lightRegime": axis(kind="continuous", photoperiod=None, spectrumClass=None, entrained=False),
            "co2": axis(status="not reported", lo=None, hi=None, unit="%", where=""),
            "medium": axis(base="BG-11", modified=False, conditioned=False, nitrogenAltered=False),
            "format": axis(value="planktonic liquid"),
            "phase": axis(label="OD stated", od=[0.3, 0.3], odNm=750),
        },
    }
    record.update(overrides)
    return record
