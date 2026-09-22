#!/usr/bin/env python3
"""Publish the pinned Tan 2018 non-gTSS table for the browser."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/expression/tan2018_utex2973_regulatory_tss_table_s1.tsv"
TARGETS = ROOT / "data/expression/tan2018_utex2973_asrna_potential_targets_table_s8.tsv"
OUTPUT = ROOT / "site/data/regulatory_tss.json"
SOURCE_SHA256 = "98a19729bf47940bf6832e3f08c3548fc4ddc7bb866176ab70e9c92c7c8d3dbe"
TARGETS_SHA256 = "0aa810d75f1e92200044ac445a7ba4ee90652a9d82d575040a803c9d66607a69"
WORKBOOK_SHA256 = "098ecbd204cd1042a6edee1d2a500eaeca4efe034c503e2ade3db1c605e79b00"
TYPE_COUNTS = {"aTSS": 1380, "iTSS": 724, "nTSS": 229}
MAPPING_COUNTS = {"mapped": 2068, "unassociated": 180, "unmapped": 85}


def build(source: Path = SOURCE, targets: Path = TARGETS) -> bytes:
    """Validate the derived table and encode every row without numeric coercion."""
    source_bytes = source.read_bytes()
    if hashlib.sha256(source_bytes).hexdigest() != SOURCE_SHA256:
        raise ValueError("Tan regulatory TSV checksum mismatch")
    with source.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle, delimiter="\t"))
    if Counter(row["type"] for row in rows) != TYPE_COUNTS:
        raise ValueError("Tan regulatory TSS type counts changed")
    if Counter(row["mapping_status"] for row in rows) != MAPPING_COUNTS:
        raise ValueError("Tan regulatory TSS mapping counts changed")
    if len({row["tss_id"] for row in rows}) != len(rows):
        raise ValueError("Tan regulatory TSS identifiers are not unique")
    target_bytes = targets.read_bytes()
    if hashlib.sha256(target_bytes).hexdigest() != TARGETS_SHA256:
        raise ValueError("Tan Table S8 target TSV checksum mismatch")
    with targets.open(encoding="utf-8", newline="") as handle:
        potential_targets = list(csv.DictReader(handle, delimiter="\t"))
    if Counter(row["comparison"] for row in potential_targets) != {
        "dark": 77, "high_light": 21, "high_temperature": 3,
    }:
        raise ValueError("Tan Table S8 comparison counts changed")
    by_site = {row["tss_id"]: row for row in rows}
    discrepancies = []
    for claim in potential_targets:
        site = by_site.get(claim["tss_id"])
        if site is None or site["type"] != "aTSS" \
                or claim["potential_target_locus"] != site["source_locus_tag"] \
                or float(claim["source_selection_min_abs_log2fc"]) != {
                    "dark": 1.5, "high_light": 1.5, "high_temperature": 1.0,
                }[claim["comparison"]]:
            raise ValueError("Tan Table S8 potential target is not a source-linked aTSS")
        comparison = claim["comparison"]
        table_s1_value = site[f"{comparison}_log2fc"]
        table_s8_value = claim["atss_log2fc"]
        if not math.isclose(float(table_s1_value), float(table_s8_value), rel_tol=1e-12):
            discrepancies.append({
                "tssId": claim["tss_id"],
                "comparison": comparison,
                "tableS1Log2Fc": table_s1_value,
                "tableS8Log2Fc": table_s8_value,
            })
    if {(item["tssId"], item["comparison"]) for item in discrepancies} != {
        ("aTSS-320358", "dark")
    }:
        raise ValueError("Tan Table S1/S8 antisense discrepancy set changed")
    opposite_site = by_site.get("iTSS+320358")
    if opposite_site is None or {
        key: opposite_site[key] for key in (
            "strand", "position", "source_locus_tag", "control_1", "control_2",
            "dark_1", "dark_2", "dark_log2fc",
        )
    } != {
        "strand": "+", "position": "320358", "source_locus_tag": "M744_RS01695",
        "control_1": "0", "control_2": "9", "dark_1": "420", "dark_2": "422",
        "dark_log2fc": "-4.78047469754605",
    }:
        raise ValueError("Tan opposite-strand source caution changed")
    warnings = [
        {
            "tssId": "aTSS-320358",
            "comparison": "dark",
            "message": "Table S1 reports +8.619 log2FC, while Table S8 reports −4.780. "
                       "The Table S8 potential-target claim depends on its disputed value. "
                       "Both published results remain uncorrected.",
        },
        {
            "tssId": "iTSS+320358",
            "comparison": "dark",
            "message": "Table S1 reports −4.780 log2FC, while this site's raw dark "
                       "counts (420, 422) exceed its control counts (0, 9). "
                       "The source's value and counts remain uncorrected.",
        },
    ]
    document = {
        "schemaVersion": 1,
        "source": {
            "doi": "10.1186/s13068-018-1215-8",
            "strain": "Synechococcus elongatus UTEX 2973",
            "assay": "dRNA-seq transcription start sites",
            "workbookSha256": WORKBOOK_SHA256,
            "derivedTsvSha256": SOURCE_SHA256,
            "potentialTargetsTsvSha256": TARGETS_SHA256,
            "license": "CC BY 4.0",
            "conditions": {
                "control": "33 °C, 50 µmol photons m⁻² s⁻¹ continuous light, 3% CO₂",
                "dark": "Dark for 2 h",
                "high_light": "1,000 µmol photons m⁻² s⁻¹; duration differs between paper sections",
                "high_temperature": "45 °C for 30 min",
            },
        },
        "rows": rows,
        "potentialTargets": potential_targets,
        "sourceDiscrepancies": discrepancies,
        "sourceWarnings": warnings,
    }
    return (json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("write", "check"))
    arguments = parser.parse_args()
    expected = build()
    if arguments.mode == "write":
        OUTPUT.write_bytes(expected)
    elif OUTPUT.read_bytes() != expected:
        raise ValueError("site/data/regulatory_tss.json is out of date")


if __name__ == "__main__":
    main()
