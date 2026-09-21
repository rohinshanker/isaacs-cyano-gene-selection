"""Load pinned, promoter-level Tan 2018 evidence without gene-level collapsing."""

from __future__ import annotations

import csv
import hashlib
import math
import re
from collections import defaultdict
from pathlib import Path
from typing import Any


TABLE_SHA256 = "d06524cf492aa8f009bf004c596a5d305ac54acbe7537ec98bbc7992ce164bff"
TABLE_ROWS = 2475
TABLE_COLUMNS = (
    "tss_id", "replicon", "type", "strand", "position", "locus_tag",
    "source_start_distance_nt",
    "control_1", "control_2", "dark_1", "dark_2", "high_light_1",
    "high_light_2", "high_temperature_1", "high_temperature_2",
    "dark_log2fc", "dark_padj", "high_light_log2fc", "high_light_padj",
    "high_temperature_log2fc", "high_temperature_padj",
)
REPLICONS = {"CP006471", "CP006472", "CP006473"}
LOCUS_PATTERN = re.compile(r"M744_RS\d{5}\Z")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def _number(value: str, *, nonnegative: bool = False, probability: bool = False) -> float:
    number = float(value)
    if not math.isfinite(number):
        raise ValueError(f"Non-finite TSS value: {value}")
    if nonnegative and number < 0:
        raise ValueError(f"Negative TSS count: {value}")
    if probability and not 0 <= number <= 1:
        raise ValueError(f"Invalid TSS adjusted p-value: {value}")
    return number


def _differential(row: dict[str, str], prefix: str) -> dict[str, float | None]:
    fold_change = row[f"{prefix}_log2fc"]
    adjusted_p = row[f"{prefix}_padj"]
    if bool(fold_change) != bool(adjusted_p):
        raise ValueError(f"Incomplete TSS differential pair for {row['tss_id']}: {prefix}")
    return {
        "log2FoldChange": _number(fold_change) if fold_change else None,
        "padj": _number(adjusted_p, probability=True) if adjusted_p else None,
    }


def load_tss_evidence(
    path: Path,
    included_loci: set[str],
    *,
    expected_sha256: str = TABLE_SHA256,
    expected_rows: int = TABLE_ROWS,
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, int]]:
    """Join gTSS rows by exact current locus tag, preserving all promoter rows."""
    observed_sha = _sha256(path)
    if observed_sha != expected_sha256:
        raise ValueError(f"Tan Table S1 derived TSV hash mismatch: {observed_sha}")
    evidence: dict[str, list[dict[str, Any]]] = defaultdict(list)
    seen: set[str] = set()
    unresolved_rows = 0
    absent_locus_rows = 0
    count = 0
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        if tuple(reader.fieldnames or ()) != TABLE_COLUMNS:
            raise ValueError("Unexpected Tan Table S1 derived TSV columns")
        for row in reader:
            count += 1
            tss_id = row["tss_id"]
            if not re.fullmatch(r"gTSS[+-]\d+", tss_id) or tss_id in seen:
                raise ValueError(f"Invalid or repeated gTSS id: {tss_id}")
            seen.add(tss_id)
            if row["type"] != "gTSS" or row["replicon"] not in REPLICONS:
                raise ValueError(f"Invalid gTSS type or replicon: {tss_id}")
            if row["strand"] not in {"+", "-"} or row["strand"] != tss_id[4]:
                raise ValueError(f"Invalid gTSS strand: {tss_id}")
            position = int(row["position"])
            if position <= 0 or tss_id != f"gTSS{row['strand']}{position}":
                raise ValueError(f"Invalid gTSS position: {tss_id}")
            source_distance = int(row["source_start_distance_nt"])
            if source_distance < 0:
                raise ValueError(f"Invalid historical gTSS start distance: {tss_id}")
            raw_reads = {
                condition: [
                    _number(row[f"{prefix}_1"], nonnegative=True),
                    _number(row[f"{prefix}_2"], nonnegative=True),
                ]
                for condition, prefix in (
                    ("control", "control"), ("dark", "dark"),
                    ("highLight", "high_light"),
                    ("highTemperature", "high_temperature"),
                )
            }
            differential = {
                "dark": _differential(row, "dark"),
                "highLight": _differential(row, "high_light"),
                "highTemperature": _differential(row, "high_temperature"),
            }
            locus = row["locus_tag"]
            if not LOCUS_PATTERN.fullmatch(locus):
                unresolved_rows += 1
                continue
            if locus not in included_loci:
                absent_locus_rows += 1
                continue
            evidence[locus].append({
                "id": tss_id,
                "type": "gTSS",
                "replicon": row["replicon"],
                "strand": row["strand"],
                "position": position,
                "sourceStartDistanceNt": source_distance,
                "rawReads": raw_reads,
                "differential": differential,
            })
    if count != expected_rows:
        raise ValueError(f"Expected {expected_rows} gTSS rows, found {count}")
    for rows in evidence.values():
        rows.sort(key=lambda item: (item["position"], item["id"]))
    summary = {
        "sourceRows": count,
        "matchedRows": sum(map(len, evidence.values())),
        "matchedGenes": len(evidence),
        "unresolvedIdentifierRows": unresolved_rows,
        "absentCurrentLocusRows": absent_locus_rows,
        "genesWithoutMappedTss": len(included_loci - evidence.keys()),
    }
    return dict(evidence), summary
