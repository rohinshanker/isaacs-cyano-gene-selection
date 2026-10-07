#!/usr/bin/env python3
"""Recompute the 941 condition-pair screens from reviewed typed records.

The original Package D rows remain immutable evidence.  This tool uses their
pair identities only, applies narrow typed corrections whose evidence is pinned
in the generated audit, and scores every axis from the repository contract.  It
does not infer a protocol class from prose or apply owner pair judgements to the
default screen.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from collections import Counter, defaultdict
from copy import deepcopy
from pathlib import Path
from typing import Any, Iterable, Sequence

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tools.pair_review_sheet import parse_condition_set
from tools.rank_condition_gaps import effective_pairs, load_inventory, read_table

AXES = (
    "temperature",
    "light_intensity",
    "light_regime",
    "co2",
    "medium",
    "culture_format_and_phase",
)
GAP_FIELDS = AXES[:-1] + ("culture_format", "growth_phase")
SCREEN_FIELDS = (
    "data_type", "artifact_a", "artifact_b", "condition_row_a", "condition_row_b",
    "condition_set_a", "condition_set_b", *AXES, "default_verdict", "failing_axes",
    "axes_passed", "owner_pair_call", "owner_pair_judgement",
    "owner_spectrum_judgement", "package_d_row", "package_d_verdict",
    "historical_effective_verdict",
)
RANK_FIELDS = (
    "condition_row", "artifact", "condition_set", "field", "status", "value",
    "source_provenance", "uncertainty", "all_pairs", "undecidable_pairs",
    "last_blocker_pairs", "pair_rows",
)

# Only exact typed values occur here.  Values absent from the mapping have a
# structured unknown result; no substring or keyword classification is used.
SPECTRUM_CLASSES = {
    "cool fluorescent": "cool fluorescent",
    "cool white fluorescent": "cool white fluorescent",
    "full-spectrum LED": "full-spectrum",
    "incandescent": "incandescent",
    "mixed fluorescent": "mixed fluorescent",
    "narrow-band LED 630/680 nm": "narrow-band",
    "warm white LED": "warm white LED",
}
UNKNOWN_SPECTRA = {
    None,
    "LED (class not stated)",
    "fluorescent (class not stated)",
    "Gro-Lux fluorescent (class not stated)",
    "white (class not stated)",
}
CONTINUITY = {
    "continuous": "continuous",
    "continuous (after diel entrainment)": "continuous",
    "diel": "diel",
}

# These are typed intake decisions, not text parsing.  Each source is pinned in
# the generated audit, and tests verify the expected evidence entry still exists.
RECORD_OVERRIDES: dict[int, dict[str, Any]] = {
    10: {
        "I": None,
        "I_text": "parabolic natural-light profile with reported peak 600 µmol photons m-2 s-1; full sampling profile is not a constant flux",
    },
    32: {
        "I": [50.0, 50.0],
        "I_text": "50 µmol m−2 s−1 (general growth Methods; RNA-seq section identifies GSE227397)",
        "phot": "12:12",
        "medium_text": "standard BG11 supplemented with 50 mM NaHCO3 in general growth Methods; not a gas CO2 percentage",
    },
    33: {
        "I": None,
        "I_text": "conflicting: archive reports ~40 µE for plate growth; accepted Package B records a different paper value",
    },
    34: {
        "I": None,
        "I_text": "conflicting: archive reports ~40 µE for plate growth; accepted Package B records a different paper value",
    },
    75: {
        "T": [32.0, 32.0],
        "T_text": "32 °C",
        "I": [150.0, 150.0],
        "I_text": "~150 µmol photons m-2 s-1",
        "co2": 2.0,
        "co2_text": "2% CO2",
        "cont": "continuous",
        "phot": None,
        "spec": "Gro-Lux fluorescent (class not stated)",
        "medium": "BG-11",
        "conditioned": False,
        "n_altered": False,
        "medium_text": "BG11 with 1 g/L HEPES, pH 8.3",
        "fmt": "planktonic liquid",
        "phase": "exponential",
        "od": None,
        "od_nm": 750,
    },
}

OVERRIDE_AUDIT = {
    "10.light_intensity": {
        "status": "partial",
        "source": "cyano_dataset_condition_records_20261007.json row 10",
        "uncertainty": "A parabolic profile with a reported peak is not treated as constant 600 flux.",
    },
    "32.light_intensity": {
        "status": "present",
        "source": "cyano_condition_paper_addendum_20261007.json reported_values.photon_flux",
        "uncertainty": "General growth Methods; RNA-seq section links the deposit.",
    },
    "32.light_regime": {
        "status": "partial",
        "source": "cyano_condition_paper_addendum_20261007.json reported_values.photoperiod",
        "uncertainty": "12:12 is reported; spectrum class remains unreported.",
    },
    "32.co2": {
        "status": "not reported",
        "source": "cyano_condition_paper_addendum_20261007.json limits",
        "uncertainty": "50 mM NaHCO3 is not a gas CO2 percentage.",
    },
    "33.light_intensity": {
        "status": "conflicting",
        "source": "cyano_archive_condition_intake_20261007.tsv CR-019",
        "uncertainty": "Archive ~40 µE conflicts with the accepted paper branch; no sample-specific value chosen.",
    },
    "34.light_intensity": {
        "status": "conflicting",
        "source": "cyano_archive_condition_intake_20261007.tsv CR-019",
        "uncertainty": "Archive ~40 µE conflicts with the accepted paper branch; no sample-specific value chosen.",
    },
    "33.light_regime": {
        "status": "partial",
        "source": "cyano_archive_condition_intake_20261007.tsv CR-020",
        "uncertainty": "Fluorescent lamp is reported; spectrum class is not.",
    },
    "34.light_regime": {
        "status": "partial",
        "source": "cyano_archive_condition_intake_20261007.tsv CR-020",
        "uncertainty": "Fluorescent lamp is reported; spectrum class is not.",
    },
    "35.light_regime": {
        "status": "conflicting",
        "source": "cyano_package_B_archive_addendum_20261007.json corrections row 35",
        "uncertainty": "The aggregate includes six disputed eight-cycle samples; no unconditional photoperiod.",
    },
    "39.light_regime": {
        "status": "partial",
        "source": "cyano_package_B_archive_addendum_20261007.json corrections row 39",
        "uncertainty": "Continuous cultivation is not evidence of continuous illumination.",
    },
    "75.temperature": {
        "status": "present",
        "source": "cyano_package_BC_addendum_20261006.tsv PXD036717 temperature",
        "uncertainty": "Reviewed Methods value.",
    },
    "75.light_intensity": {
        "status": "present",
        "source": "cyano_package_BC_addendum_20261006.tsv PXD036717 light_intensity",
        "uncertainty": "Reviewed Methods value.",
    },
    "75.light_regime": {
        "status": "partial",
        "source": "cyano_package_BC_addendum_20261006.tsv PXD036717 light_regime",
        "uncertainty": "Continuous schedule and Gro-Lux lamp are reported; spectrum class is not pinned.",
    },
    "75.co2": {
        "status": "present",
        "source": "cyano_package_BC_addendum_20261006.tsv PXD036717 co2",
        "uncertainty": "Reviewed Methods value.",
    },
    "75.medium": {
        "status": "present",
        "source": "cyano_package_BC_addendum_20261006.tsv PXD036717 medium",
        "uncertainty": "Reviewed Methods value.",
    },
    "75.culture_format": {
        "status": "present",
        "source": "cyano_package_BC_addendum_20261006.tsv PXD036717 culture_format",
        "uncertainty": "Reviewed Methods and supplement scope.",
    },
    "75.growth_phase": {
        "status": "partial",
        "source": "cyano_package_BC_addendum_20261006.tsv PXD036717 growth_phase",
        "uncertainty": "Daily dilution to OD750 0.3 is reported; OD at labeling is not.",
    },
}


def sha256(path: Path) -> str:
    """Return a file's SHA-256 digest."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_records(path: Path) -> dict[int, dict[str, Any]]:
    """Load unique condition rows and apply the reviewed typed overlays."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    records = {int(record["row"]): deepcopy(record) for record in raw}
    if len(records) != len(raw):
        raise ValueError("duplicate condition row")
    for number, changes in RECORD_OVERRIDES.items():
        if number not in records:
            raise ValueError(f"override names absent condition row {number}")
        records[number].update(deepcopy(changes))
    return records


def _fmt_range(value: list[float] | None, text: str) -> str:
    """Render a typed range while retaining the reviewed source text."""
    if value is None:
        return text
    if value[0] == value[1]:
        return f"{value[0]:g} ({text})"
    return f"{value[0]:g}–{value[1]:g} ({text})"


def condition_set(record: dict[str, Any]) -> str:
    """Render the current typed record without converting or estimating values."""
    schedule = record.get("cont") or "unknown schedule"
    if record.get("phot") is not None:
        schedule += f"; photoperiod {record['phot']}"
    spectrum = record.get("spec") or "unknown spectrum"
    values = {
        "temperature": _fmt_range(record.get("T"), record["T_text"]),
        "light_intensity": _fmt_range(record.get("I"), record["I_text"]),
        "light_regime": f"{schedule}; {spectrum}",
        "co2": f"{record['co2']:g}% ({record['co2_text']})" if record.get("co2") is not None else record["co2_text"],
        "medium": record.get("medium_text") or "unknown",
        "culture_format": record.get("fmt") or "unknown",
        "growth_phase": _phase_text(record),
    }
    body = " ;; ".join(f"{key}={value}" for key, value in values.items())
    return f"row {record['row']} [{record['label']}] {body}"


def _phase_text(record: dict[str, Any]) -> str:
    phase = record.get("phase") or "unknown"
    od = record.get("od")
    if od is None:
        return phase
    wavelength = record.get("od_nm")
    band = f"{od[0]:g}" if od[0] == od[1] else f"{od[0]:g}–{od[1]:g}"
    return f"{phase}; OD{wavelength} {band}"


def _interval_distance(a: list[float], b: list[float]) -> float:
    return max(0.0, a[0] - b[1], b[0] - a[1])


def _temperature_regime(value: list[float]) -> str | None:
    regimes = {"standard": (28.0, 32.0), "elevated": (36.0, 40.0)}
    hits = [name for name, (low, high) in regimes.items() if value[1] >= low and value[0] <= high]
    return hits[0] if len(hits) == 1 else None


def score_temperature(a: dict[str, Any], b: dict[str, Any]) -> tuple[str, str]:
    av, bv = a.get("T"), b.get("T")
    if av is None or bv is None:
        return "undecidable", "temperature missing or unresolved on one or both sides"
    ar, br = _temperature_regime(av), _temperature_regime(bv)
    distance = _interval_distance(av, bv)
    if ar is not None and ar == br and distance <= 2.0:
        return "pass", f"{ar} regime; interval distance {distance:g} °C"
    return "fail", f"regimes {ar or 'outside'} vs {br or 'outside'}; interval distance {distance:g} °C"


def _flux_band(value: list[float]) -> str | None:
    if value[1] <= 400.0:
        return "at-or-below-400"
    if value[0] > 400.0:
        return "above-400"
    return None


def score_light_intensity(a: dict[str, Any], b: dict[str, Any]) -> tuple[str, str]:
    av, bv = a.get("I"), b.get("I")
    if av is None or bv is None:
        return "undecidable", "full sampling flux is missing, conflicting, relative, or profile-only"
    ab, bb = _flux_band(av), _flux_band(bv)
    if av == bv and ab is not None:
        return "pass", f"identical {av[0]:g}–{av[1]:g} profile; {ab}"
    ratio = max(av[1] / bv[0], bv[1] / av[0]) if min(av[0], bv[0]) > 0 else float("inf")
    if ab is not None and ab == bb and ratio <= 1.25:
        return "pass", f"full-range ratio {ratio:.3g}; {ab}"
    return "fail", f"full-range ratio {ratio:.3g}; bands {ab or 'straddles-400'} vs {bb or 'straddles-400'}"


def _spectrum(record: dict[str, Any]) -> str | None:
    value = record.get("spec")
    if value in UNKNOWN_SPECTRA:
        return None
    if value not in SPECTRUM_CLASSES:
        raise ValueError(f"unreviewed spectrum value: {value!r}")
    return SPECTRUM_CLASSES[value]


def score_light_regime(a: dict[str, Any], b: dict[str, Any]) -> tuple[str, str]:
    sa, sb = _spectrum(a), _spectrum(b)
    if sa is None or sb is None:
        spectrum_result = "unknown"
    elif sa == sb:
        spectrum_result = "pass"
    elif {sa, sb} == {"full-spectrum", "narrow-band"}:
        spectrum_result = "fail"
    else:
        # Different lamp descriptions are not automatically different spectrum
        # classes.  Only the explicitly typed full/narrow opposition is a fail.
        spectrum_result = "unknown"
    ca, cb = CONTINUITY.get(a.get("cont")), CONTINUITY.get(b.get("cont"))
    if ca is None or cb is None:
        schedule_result = "unknown"
    elif ca != cb:
        schedule_result = "fail"
    elif ca == "diel":
        pa, pb = a.get("phot"), b.get("phot")
        schedule_result = "unknown" if pa is None or pb is None else ("pass" if pa == pb else "fail")
    else:
        schedule_result = "pass"
    # A known independent component failure is decisive even when the other
    # component is unknown.  This is what removes the unsupported temporal fail
    # from Package D rows 442/473/725 without manufacturing a replacement.
    if "fail" in (spectrum_result, schedule_result):
        return "fail", f"spectrum {spectrum_result}; sampling schedule {schedule_result}"
    if "unknown" in (spectrum_result, schedule_result):
        return "undecidable", f"spectrum {spectrum_result}; sampling schedule {schedule_result}"
    return "pass", f"spectrum {sa}; sampling schedule {ca}{' ' + str(a.get('phot')) if ca == 'diel' else ''}"


def _co2_regime(value: float) -> str | None:
    if 0.0 < value <= 0.1:
        return "ambient"
    if value >= 1.0:
        return "elevated"
    return None


def score_co2(a: dict[str, Any], b: dict[str, Any]) -> tuple[str, str]:
    av, bv = a.get("co2"), b.get("co2")
    if av is None or bv is None:
        return "undecidable", "gas CO2 percentage missing on one or both sides"
    ar, br = _co2_regime(av), _co2_regime(bv)
    ratio = max(av / bv, bv / av)
    if ar is not None and ar == br and (ar == "ambient" or ratio <= 2.0):
        return "pass", f"{ar} regime; factor {ratio:.3g}"
    return "fail", f"regimes {ar or 'neither'} vs {br or 'neither'}; factor {ratio:.3g}"


def score_medium(a: dict[str, Any], b: dict[str, Any]) -> tuple[str, str]:
    if a.get("medium") is None or b.get("medium") is None:
        return "undecidable", "medium missing on one or both sides"
    if a.get("conditioned") or b.get("conditioned"):
        return "fail", "conditioned/mixed medium is not fresh-medium comparable"
    if a.get("medium") != "BG-11" or b.get("medium") != "BG-11":
        return "fail", "both sides are not BG-11"
    if a.get("n_altered") or b.get("n_altered"):
        return "fail", "nitrogen source is altered or unresolved"
    return "pass", "BG-11, unconditioned, unchanged nitrogen-source flag"


def _score_phase(a: dict[str, Any], b: dict[str, Any]) -> tuple[str, str]:
    ap, bp = a.get("phase"), b.get("phase")
    if ap is None or bp is None or "two phases in one set" in (ap, bp):
        return "undecidable", "sampling phase missing or aggregate contains two phases"
    if ap == bp == "stationary":
        return "pass", "both stationary; OD not required"
    if "stationary" in (ap, bp):
        return "fail", f"stationary against {bp if ap == 'stationary' else ap}"
    ao, bo = a.get("od"), b.get("od")
    if ao is None or bo is None:
        return "undecidable", "exponential/held phase lacks sampling OD on one or both sides"
    if _interval_distance(ao, bo) == 0:
        return "pass", "sampling OD ranges overlap (OD730/A730/OD750 accepted)"
    return "fail", f"sampling OD ranges do not overlap: {ao} vs {bo}"


def score_format_phase(a: dict[str, Any], b: dict[str, Any]) -> tuple[str, str]:
    af, bf = a.get("fmt"), b.get("fmt")
    if af is None or bf is None:
        format_result = ("undecidable", "culture format missing")
    elif af == bf:
        format_result = ("pass", f"both {af}")
    else:
        format_result = ("fail", f"{af} against {bf}")
    phase_result = _score_phase(a, b)
    if "fail" in (format_result[0], phase_result[0]):
        result = "fail"
    elif "undecidable" in (format_result[0], phase_result[0]):
        result = "undecidable"
    else:
        result = "pass"
    return result, f"format {format_result[0]} ({format_result[1]}); phase {phase_result[0]} ({phase_result[1]})"


SCORERS = {
    "temperature": score_temperature,
    "light_intensity": score_light_intensity,
    "light_regime": score_light_regime,
    "co2": score_co2,
    "medium": score_medium,
    "culture_format_and_phase": score_format_phase,
}


def _screen_text(result: tuple[str, str]) -> str:
    return f"{result[0]} — {result[1]}"


def load_owner_judgements(path: Path) -> dict[frozenset[int], dict[str, Any]]:
    """Load exact row-pair decisions without applying them to default scores."""
    data = json.loads(path.read_text(encoding="utf-8"))
    result: dict[frozenset[int], dict[str, Any]] = {}
    for item in data["judgements"]:
        key = frozenset((int(item["a"]["row"]), int(item["b"]["row"])))
        if len(key) != 2 or key in result:
            raise ValueError(f"duplicate or self owner judgement: {sorted(key)}")
        result[key] = item
    return result


def rescore_pairs(
    original: Sequence[dict[str, str]],
    historical: Sequence[dict[str, str]],
    records: dict[int, dict[str, Any]],
    judgements: dict[frozenset[int], dict[str, Any]],
) -> list[dict[str, str]]:
    """Return a complete current replay of the immutable Package D pair list."""
    if len(original) != len(historical):
        raise ValueError("historical overlay changed pair count")
    output = []
    seen: set[tuple[str, str, str, int, int]] = set()
    j1_rows = {21, 46, 47, 54}
    for number, (old, effective) in enumerate(zip(original, historical), start=1):
        row_a = parse_condition_set(old["condition_set_a"])[0]
        row_b = parse_condition_set(old["condition_set_b"])[0]
        if row_a not in records or row_b not in records:
            raise ValueError(f"pair {number} names absent condition row")
        key = (old["data_type"], old["artifact_a"], old["artifact_b"], row_a, row_b)
        if key in seen:
            raise ValueError(f"duplicate pair at row {number}")
        seen.add(key)
        a, b = records[row_a], records[row_b]
        screens = {axis: SCORERS[axis](a, b) for axis in AXES}
        states = [value[0] for value in screens.values()]
        verdict = "not comparable" if "fail" in states else ("undecidable" if "undecidable" in states else "comparable")
        judgement = judgements.get(frozenset((row_a, row_b)))
        output.append({
            "data_type": old["data_type"],
            "artifact_a": old["artifact_a"],
            "artifact_b": old["artifact_b"],
            "condition_row_a": str(row_a),
            "condition_row_b": str(row_b),
            "condition_set_a": condition_set(a),
            "condition_set_b": condition_set(b),
            **{axis: _screen_text(screens[axis]) for axis in AXES},
            "default_verdict": verdict,
            "failing_axes": "; ".join(axis for axis, value in screens.items() if value[0] == "fail"),
            "axes_passed": f"{states.count('pass')} of 6",
            "owner_pair_call": judgement["call"] if judgement else "",
            "owner_pair_judgement": judgement["entry"] if judgement else "",
            "owner_spectrum_judgement": "J1: same spectrum class" if {row_a, row_b} <= j1_rows else "",
            "package_d_row": str(number),
            "package_d_verdict": old["verdict"],
            "historical_effective_verdict": effective["verdict"],
        })
    return output


def _old_row_statuses(
    historical: Sequence[dict[str, str]], statuses: dict[tuple[str, str], str],
) -> dict[tuple[int, str], tuple[str, str]]:
    """Expand the reviewed exact-value inventory to condition-row cells."""
    expanded: dict[tuple[int, str], tuple[str, str]] = {}
    for pair in historical:
        for side in ("a", "b"):
            row, _, values = parse_condition_set(pair[f"condition_set_{side}"])
            for field, value in values.items():
                current = (statuses[(field, value)], value)
                key = (row, field)
                if key in expanded and expanded[key] != current:
                    raise ValueError(f"inconsistent historical cell for row {row} {field}")
                expanded[key] = current
    return expanded


def _gap_reason(record: dict[str, Any], field: str) -> str | None:
    """Return a structured current incompleteness reason for one record field."""
    row = int(record["row"])
    explicit = OVERRIDE_AUDIT.get(f"{row}.{field}")
    if explicit and explicit["status"] != "present":
        return explicit["uncertainty"]
    if field == "temperature":
        return None if record.get("T") is not None else "Sampling temperature has no reviewed numeric interval."
    if field == "light_intensity":
        return None if record.get("I") is not None else "Sampling photon flux has no reviewed complete numeric profile."
    if field == "light_regime":
        continuity = CONTINUITY.get(record.get("cont"))
        if continuity is None:
            return "Sampling light schedule is unknown."
        if continuity == "diel" and record.get("phot") is None:
            return "Diel photoperiod is unknown or conflicting."
        if _spectrum(record) is None:
            return "Spectrum class is unknown."
        return None
    if field == "co2":
        return None if record.get("co2") is not None else "Sampling gas CO2 percentage is unknown."
    if field == "medium":
        return None if record.get("medium") is not None else "Sampling medium is unknown."
    if field == "culture_format":
        return None if record.get("fmt") is not None else "Sampling culture format is unknown."
    if field == "growth_phase":
        if record.get("phase") is None:
            return "Sampling phase is unknown."
        if record.get("phase") == "stationary":
            return None
        if record.get("phase") == "two phases in one set":
            return "One condition set aggregates two phases."
        return None if record.get("od") is not None else "Non-stationary phase lacks a reviewed sampling OD."
    raise ValueError(f"unknown gap field {field}")


def load_current_source_audit(
    records: dict[int, dict[str, Any]],
    manual_path: Path,
    intake_path: Path,
    pride_path: Path,
) -> dict[str, dict[str, str]]:
    """Expand accepted, narrowly scoped negative evidence to row-field keys."""
    by_accession: dict[str, list[int]] = defaultdict(list)
    for row, record in records.items():
        by_accession[record["acc"]].append(row)
    field_names = {"light_spectrum": "light_regime"}
    audit: dict[str, dict[str, str]] = {}

    manual = json.loads(manual_path.read_text(encoding="utf-8"))
    for item in manual:
        field = field_names.get(item["field"], item["field"])
        if field not in GAP_FIELDS:
            continue
        for row in by_accession.get(item["dataset"], []):
            if _gap_reason(records[row], field) is None:
                continue
            audit[f"{row}.{field}"] = {
                "status": "not reported",
                "source": (
                    "cyano_archive_condition_manual_supplement_20261007.json "
                    f"{item['dataset']}.{item['field']}"
                ),
                "uncertainty": item["statement"],
            }

    with intake_path.open(encoding="utf-8", newline="") as stream:
        intake = list(csv.DictReader(stream, delimiter="\t"))
    negative = "Not stated in reviewed archive metadata; no paper-level absence established."
    for item in intake:
        if item["accepted_value_or_correction"] != negative:
            continue
        field = field_names.get(item["field"], item["field"])
        if field not in GAP_FIELDS:
            continue
        for row in by_accession.get(item["dataset"], []):
            if _gap_reason(records[row], field) is None:
                continue
            audit[f"{row}.{field}"] = {
                "status": "not reported",
                "source": (
                    "cyano_archive_condition_intake_20261007.tsv "
                    f"{item['row_id']}"
                ),
                "uncertainty": item["reason"],
            }

    pride = json.loads(pride_path.read_text(encoding="utf-8"))
    for row in by_accession.get("PXD023591", []):
        for field in GAP_FIELDS:
            if _gap_reason(records[row], field) is None:
                continue
            audit[f"{row}.{field}"] = {
                "status": "not reported",
                "source": "cyano_pride_condition_check_20261007.json read_fields",
                "uncertainty": pride["scope"],
            }

    # The targeted scientific corrections are later and more specific than a
    # source-field absence.  For example, CR-019 is conflicting, not missing.
    audit.update(OVERRIDE_AUDIT)
    return audit


def build_gap_inventory(
    records: dict[int, dict[str, Any]],
    old_statuses: dict[tuple[int, str], tuple[str, str]],
    source_paths: Sequence[Path],
    source_audit: dict[str, dict[str, str]],
) -> dict[str, Any]:
    """Build per-cell current gaps with provenance and uncertainty."""
    gaps = []
    for row, record in sorted(records.items()):
        for field in GAP_FIELDS:
            reason = _gap_reason(record, field)
            if reason is None:
                continue
            explicit = source_audit.get(f"{row}.{field}")
            old_status, old_value = old_statuses.get((row, field), ("not retrieved", ""))
            status = explicit["status"] if explicit else (old_status if old_status != "present" else "partial")
            source = explicit["source"] if explicit else f"cyano_dataset_condition_records_20261007.json row {row}; reviewed status from cyano_condition_gap_inventory_20261007.json"
            gaps.append({
                "condition_row": row,
                "artifact": record["acc"],
                "condition_set": record["label"],
                "field": field,
                "status": status,
                "value": _current_field_value(record, field),
                "source_provenance": source,
                "uncertainty": reason,
                "historical_value": old_value,
            })
    return {
        "schema_version": 1,
        "scope": "Current typed condition cells used by the complete 941-pair default-screen replay; owner judgements remain separate.",
        "sources": [{"name": path.name, "sha256": sha256(path)} for path in source_paths],
        "classification_contract": {
            "statuses": ["not reported", "not retrieved", "partial", "conflicting", "uncertain"],
            "semantic_classification": "Exact typed fields and explicit mappings only; structured unknown for every unmapped spectrum.",
        },
        "corrections": [
            {"condition_row": row, "fields": changes, "audit": {key.split(".", 1)[1]: value for key, value in OVERRIDE_AUDIT.items() if key.startswith(f"{row}.")}}
            for row, changes in sorted(RECORD_OVERRIDES.items())
        ],
        "owner_judgement_separation": {
            "pair_calls": "data/expression/pair_judgements.json is displayed alongside, never applied to default_verdict.",
            "J1": "Rows 21/46/47/54 have an owner same-spectrum judgement displayed separately; the default exact-class screen remains undecidable.",
        },
        "gaps": gaps,
    }


def _current_field_value(record: dict[str, Any], field: str) -> str:
    if field == "temperature":
        return _fmt_range(record.get("T"), record["T_text"])
    if field == "light_intensity":
        return _fmt_range(record.get("I"), record["I_text"])
    if field == "light_regime":
        return f"schedule={record.get('cont')}; photoperiod={record.get('phot')}; spectrum={record.get('spec')}"
    if field == "co2":
        return record["co2_text"]
    if field == "medium":
        return record.get("medium_text") or ""
    if field == "culture_format":
        return record.get("fmt") or ""
    if field == "growth_phase":
        return _phase_text(record)
    raise ValueError(field)


def _axis_gap_fields(record: dict[str, Any], axis: str) -> tuple[str, ...]:
    fields = ("culture_format", "growth_phase") if axis == "culture_format_and_phase" else (axis,)
    return tuple(field for field in fields if _gap_reason(record, field) is not None)


def rank_current_gaps(
    pairs: Sequence[dict[str, str]], inventory: dict[str, Any], records: dict[int, dict[str, Any]],
) -> list[dict[str, str | int]]:
    """Rank current per-row cells against current default screens."""
    cells = {(int(item["condition_row"]), item["field"]): item for item in inventory["gaps"]}
    reach: dict[tuple[int, str], set[int]] = defaultdict(set)
    undecidable: dict[tuple[int, str], set[int]] = defaultdict(set)
    last: Counter[tuple[int, str]] = Counter()
    artifact: dict[tuple[int, str], str] = {}
    for number, pair in enumerate(pairs, start=1):
        rows = (int(pair["condition_row_a"]), int(pair["condition_row_b"]))
        for row in rows:
            for field in GAP_FIELDS:
                key = (row, field)
                if key in cells:
                    reach[key].add(number)
                    artifact.setdefault(key, pair["artifact_a"] if row == rows[0] else pair["artifact_b"])
        if pair["default_verdict"] != "undecidable":
            continue
        blockers: set[tuple[int, str] | tuple[str, str]] = set()
        for axis in AXES:
            if not pair[axis].startswith("undecidable —"):
                continue
            axis_cells = {
                (row, field)
                for row in rows
                for field in _axis_gap_fields(records[row], axis)
            }
            blockers.update(axis_cells or {("unresolved screen", axis)})
            for key in axis_cells:
                undecidable[key].add(number)
        if len(blockers) == 1:
            only = next(iter(blockers))
            if isinstance(only[0], int):
                last[only] += 1
    output = []
    for key, cell in cells.items():
        output.append({
            **{name: cell[name] for name in (
                "condition_row", "condition_set", "field", "status", "value",
                "source_provenance", "uncertainty",
            )},
            "artifact": artifact.get(key, cell["artifact"]),
            "all_pairs": len(reach[key]),
            "undecidable_pairs": len(undecidable[key]),
            "last_blocker_pairs": last[key],
            "pair_rows": ",".join(map(str, sorted(undecidable[key]))),
        })
    return sorted(output, key=lambda item: (
        -int(item["last_blocker_pairs"]), -int(item["undecidable_pairs"]),
        int(item["condition_row"]), str(item["field"]), str(item["value"]),
    ))


def _write_tsv(path: Path, rows: Iterable[dict[str, Any]], fields: Sequence[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, delimiter="\t", lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def _validate_evidence(inputs: dict[str, Path]) -> None:
    """Fail closed if the narrow evidence rows behind overlays disappear."""
    paper = json.loads(inputs["paper"].read_text(encoding="utf-8"))
    if paper.get("dataset") != "GSE227397" or paper.get("reported_values", {}).get("photon_flux") != 50 or paper.get("reported_values", {}).get("photoperiod") != "12:12":
        raise ValueError("GSE227397 paper overlay evidence changed")
    archive = json.loads(inputs["archive"].read_text(encoding="utf-8"))
    corrections = {int(item["condition_row"]): item for item in archive["corrections"]}
    if corrections.get(35, {}).get("after", {}).get("phot", "missing") is not None:
        raise ValueError("GSE252562 correction changed")
    if corrections.get(39, {}).get("after", {}).get("cont", "missing") is not None:
        raise ValueError("GSE311172 correction changed")
    with inputs["bc"].open(encoding="utf-8", newline="") as stream:
        bc = list(csv.DictReader(stream, delimiter="\t"))
    if sum(row["artifact"] == "PRIDE PXD036717" for row in bc) != 1:
        raise ValueError("PXD036717 BC addendum row missing or duplicated")
    with inputs["intake"].open(encoding="utf-8", newline="") as stream:
        intake = {row["row_id"]: row for row in csv.DictReader(stream, delimiter="\t")}
    if intake.get("CR-019", {}).get("dataset") != "GSE237858":
        raise ValueError("GSE237858 CR-019 evidence missing")
    manual = json.loads(inputs["manual"].read_text(encoding="utf-8"))
    if not isinstance(manual, list) or not manual:
        raise ValueError("manual archive supplement is empty or invalid")
    pride = json.loads(inputs["pride"].read_text(encoding="utf-8"))
    required = {"projectDescription", "sampleProcessingProtocol", "sampleAttributes"}
    if pride.get("dataset") != "PXD023591" or not required <= set(pride.get("read_fields", [])):
        raise ValueError("PXD023591 scoped field audit changed")


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("pairs", type=Path)
    parser.add_argument("historical_inventory", type=Path)
    parser.add_argument("records", type=Path)
    parser.add_argument("owner_judgements", type=Path)
    parser.add_argument("screen_output", type=Path)
    parser.add_argument("inventory_output", type=Path)
    parser.add_argument("ranking_output", type=Path)
    parser.add_argument("--historical-rescore", type=Path, required=True)
    parser.add_argument("--bc-addendum", type=Path, required=True)
    parser.add_argument("--archive-addendum", type=Path, required=True)
    parser.add_argument("--archive-intake", type=Path, required=True)
    parser.add_argument("--manual-supplement", type=Path, required=True)
    parser.add_argument("--paper-addendum", type=Path, required=True)
    parser.add_argument("--pride-check", type=Path, required=True)
    args = parser.parse_args(argv)
    inputs = {
        "bc": args.bc_addendum,
        "archive": args.archive_addendum,
        "intake": args.archive_intake,
        "manual": args.manual_supplement,
        "paper": args.paper_addendum,
        "pride": args.pride_check,
    }
    _validate_evidence(inputs)
    original = read_table(args.pairs)
    historical_rescore = read_table(args.historical_rescore)
    historical = effective_pairs(original, [historical_rescore])
    reviewed_statuses = load_inventory(
        args.historical_inventory, [args.pairs, args.historical_rescore]
    )
    records = load_records(args.records)
    source_audit = load_current_source_audit(
        records, args.manual_supplement, args.archive_intake, args.pride_check
    )
    judgements = load_owner_judgements(args.owner_judgements)
    screens = rescore_pairs(original, historical, records, judgements)
    source_paths = [
        args.pairs, args.historical_rescore, args.historical_inventory, args.records,
        args.owner_judgements, args.bc_addendum, args.archive_addendum,
        args.archive_intake, args.manual_supplement, args.paper_addendum,
        args.pride_check,
    ]
    inventory = build_gap_inventory(
        records,
        _old_row_statuses(historical, reviewed_statuses),
        source_paths,
        source_audit,
    )
    ranking = rank_current_gaps(screens, inventory, records)
    _write_tsv(args.screen_output, screens, SCREEN_FIELDS)
    args.inventory_output.write_text(json.dumps(inventory, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    _write_tsv(args.ranking_output, ranking, RANK_FIELDS)
    counts = Counter(row["default_verdict"] for row in screens)
    print(
        f"rescored {len(screens)} pairs: "
        + ", ".join(f"{key}={counts[key]}" for key in ("comparable", "undecidable", "not comparable"))
        + f"; ranked {len(ranking)} current gap cells"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
