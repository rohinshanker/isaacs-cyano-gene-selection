#!/usr/bin/env python3
"""Rank reviewed missing condition cells by their pair-screen impact.

This tool performs no semantic inference and never scores recovered values.
It reads exact field/text judgments from a reviewed inventory, applies pinned
pair rescoring overlays, and counts unique pairs. ``last_blocker_pairs`` is a
conditional opportunity: the recovered cell still needs evidence intake and a
new screen. A decidable screen is not permission to combine datasets.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Sequence

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tools.pair_review_sheet import AXES, parse_condition_set

FIELDS = AXES[:-1] + ("culture_format", "growth_phase")
GAP_STATUSES = ("not reported", "not retrieved", "partial", "conflicting", "uncertain")
STATUSES = ("present",) + GAP_STATUSES
VERDICTS = ("comparable", "not comparable", "undecidable", "escalate")
OUTPUT_FIELDS = (
    "condition_row", "artifact", "condition_set", "field", "status", "value",
    "all_pairs", "undecidable_pairs", "last_blocker_pairs", "pair_rows",
)


def read_table(path: Path) -> list[dict[str, str]]:
    """Read a TSV without the default small CSV field limit."""
    csv.field_size_limit(sys.maxsize)
    with path.open(encoding="utf-8", newline="") as stream:
        return list(csv.DictReader(stream, delimiter="\t"))


def pair_key(row: dict[str, str]) -> tuple[str, str, str, str, str]:
    """Identify a pair including its two condition sets, without prose matching."""
    a = parse_condition_set(row["condition_set_a"])[0]
    b = parse_condition_set(row["condition_set_b"])[0]
    return (row["data_type"], row["artifact_a"], row["artifact_b"], str(a), str(b))


def effective_pairs(
    rows: list[dict[str, str]], overlays: Sequence[list[dict[str, str]]],
) -> list[dict[str, str]]:
    """Apply pinned pair screens and refresh their source condition rows globally.

    A changed condition row also replaces its historical text in unchanged pairs;
    this does not silently rescore those pairs. Conflicting revisions in one
    overlay are rejected, and later overlays take precedence.
    """
    result = [dict(row) for row in rows]
    keys = [pair_key(row) for row in result]
    if len(set(keys)) != len(keys):
        raise ValueError("duplicate pair in base table")
    for overlay in overlays:
        seen: set[int] = set()
        revisions: dict[int, str] = {}
        for row in overlay:
            number = int(row["package_d_row"])
            if number < 1 or number > len(rows) or number in seen:
                raise ValueError(f"invalid or duplicate overlay row: {number}")
            seen.add(number)
            if pair_key(row) != keys[number - 1]:
                raise ValueError(f"overlay row {number} identifies a different pair")
            result[number - 1] = dict(row)
            for side in ("a", "b"):
                cell = row[f"condition_set_{side}"]
                source_row = parse_condition_set(cell)[0]
                if source_row in revisions and revisions[source_row] != cell:
                    raise ValueError(f"conflicting condition revision for row {source_row}")
                revisions[source_row] = cell
        for row in result:
            for side in ("a", "b"):
                column = f"condition_set_{side}"
                source_row = parse_condition_set(row[column])[0]
                row[column] = revisions.get(source_row, row[column])
    return result


def cell_values(rows: Sequence[dict[str, str]]) -> list[tuple[str, str]]:
    """Return every exact field/text input needing a reviewed judgment."""
    values: set[tuple[str, str]] = set()
    for row in rows:
        for side in ("a", "b"):
            _, _, fields = parse_condition_set(row[f"condition_set_{side}"])
            if set(fields) != set(FIELDS):
                raise ValueError("condition set has missing or unexpected fields")
            values.update(fields.items())
    return sorted(values)


def load_inventory(path: Path, sources: Sequence[Path]) -> dict[tuple[str, str], str]:
    """Require a reviewed inventory pinned to the exact source bytes."""
    data = json.loads(path.read_text(encoding="utf-8"))
    pins = [{"name": p.name, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
            for p in sources]
    if data.get("sources") != pins:
        raise ValueError("inventory source pins differ from input tables")
    if not data.get("reviewed_by"):
        raise ValueError("inventory needs a named reviewer")
    if "classification_contract" in data and data["classification_contract"].get("statuses") != list(STATUSES):
        raise ValueError("inventory status contract differs from ranking vocabulary")
    statuses: dict[tuple[str, str], str] = {}
    for entry in data["judgments"]:
        key = (entry["field"], entry["value"])
        if key in statuses or key[0] not in FIELDS or entry["status"] not in STATUSES:
            raise ValueError(f"duplicate or invalid inventory judgment: {key}")
        statuses[key] = entry["status"]
    return statuses


def rank_gaps(
    rows: Sequence[dict[str, str]], statuses: dict[tuple[str, str], str],
) -> list[dict[str, str | int]]:
    """Count gaps and sole metadata blockers without estimating missing values.

    A field/text variant is kept separate if the input still contains inconsistent
    texts. An undecidable axis with no inventoried gap remains an unresolved
    screen blocker, so filling another cell cannot be advertised as sufficient.
    """
    expected = set(cell_values(rows))
    if set(statuses) != expected or any(s not in STATUSES for s in statuses.values()):
        raise ValueError("inventory does not cover exactly the effective field/text values")
    gaps: dict[tuple[int, str, str], dict[str, str | int]] = {}
    all_pairs: dict[tuple[int, str, str], set[int]] = defaultdict(set)
    undecidable: dict[tuple[int, str, str], set[int]] = defaultdict(set)
    last: Counter[tuple[int, str, str]] = Counter()
    for number, row in enumerate(rows, start=1):
        if row["verdict"] not in VERDICTS:
            raise ValueError(f"invalid verdict in pair {number}")
        sides = [parse_condition_set(row[f"condition_set_{side}"]) for side in ("a", "b")]
        blockers: set[tuple[int, str, str] | tuple[str, str]] = set()
        for side, (source_row, label, fields) in zip(("a", "b"), sides):
            for field, value in fields.items():
                status = statuses[field, value]
                if status == "present":
                    continue
                key = (source_row, field, value)
                gaps.setdefault(key, {
                    "condition_row": source_row, "artifact": row[f"artifact_{side}"],
                    "condition_set": label, "field": field, "status": status,
                    "value": value,
                })
                all_pairs[key].add(number)
                if row["verdict"] == "undecidable":
                    undecidable[key].add(number)
        for axis in AXES:
            screen = row[axis].split(" — ", 1)[0]
            if screen not in ("pass", "fail", "marginal", "undecidable"):
                raise ValueError(f"invalid {axis} screen in pair {number}: {screen}")
            if screen != "undecidable":
                continue
            axis_fields = ("culture_format", "growth_phase") if axis == AXES[-1] else (axis,)
            axis_gaps = {
                (source_row, field, fields[field])
                for source_row, _, fields in sides for field in axis_fields
                if statuses[field, fields[field]] != "present"
            }
            blockers.update(axis_gaps or {("unresolved screen", axis)})
        if row["verdict"] == "undecidable" and len(blockers) == 1:
            key = next(iter(blockers))
            if key in gaps:
                last[key] += 1
    output = []
    for key, gap in gaps.items():
        output.append({**gap, "all_pairs": len(all_pairs[key]),
                       "undecidable_pairs": len(undecidable[key]),
                       "last_blocker_pairs": last[key],
                       "pair_rows": ",".join(map(str, sorted(undecidable[key])))})
    return sorted(output, key=lambda r: (-int(r["last_blocker_pairs"]),
                                       -int(r["undecidable_pairs"]),
                                       int(r["condition_row"]), str(r["field"]), str(r["value"])))


def main(argv: Sequence[str] | None = None) -> int:
    """Write a deterministic ranked TSV from reviewed inputs; no network access."""
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("pairs", type=Path)
    parser.add_argument("inventory", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--rescore", type=Path, action="append", default=[])
    args = parser.parse_args(argv)
    sources = [args.pairs, *args.rescore]
    rows = effective_pairs(read_table(args.pairs), [read_table(p) for p in args.rescore])
    result = rank_gaps(rows, load_inventory(args.inventory, sources))
    with args.output.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=OUTPUT_FIELDS, delimiter="\t",
                                lineterminator="\n")
        writer.writeheader()
        writer.writerows(result)
    print(f"ranked {len(result)} gaps across {len(rows)} pairs; "
          f"{sum(r['verdict'] == 'undecidable' for r in rows)} undecidable")
    return 0


if __name__ == "__main__":
    sys.exit(main())
