"""Stream pinned PXD044412 Supplementary Data S3 PCC 7942 peptide evidence.

Usage: python tools/pxd044412_peptides.py --input S3-pcc7942.tsv --output-dir NEW_DIR
The output bundle contains lossless parsed cells in rows.jsonl.gz and a derived
summary.json. The directory must not exist; failures remove this run's bundle.
This reader neither reconstructs MSstats nor admits data to a browser release.
"""

from __future__ import annotations

import argparse
from collections import Counter
import csv
import gzip
import hashlib
import json
import math
from pathlib import Path
import shutil
import sqlite3
from typing import Any, Iterator


SOURCE_SHA256 = "c6cb4794f0a1ff854899b83ddec2ebbef20577387c262b279a6f2519be9a06b5"
HEADERS = (
    "organism", "Label", "log2FC", "SE", "Tvalue", "DF", "pvalue",
    "adj.pvalue", "issue", "MissingPercentage", "ImputationPercentage",
    "PeptideSequence", "Entry", "BioReplicate", "ambig",
    "Gene names  (ordered locus )", "Gene names  (primary )",
    "Gene names  (synonym )", "Protein names", "Function [CC]",
    "Catalytic activity", "Gene ontology (GO)",
    "Gene ontology (molecular function)", "Gene ontology (biological process)",
    "Gene ontology (cellular component)", "Subcellular location [CC]", "Pathway",
    "Cofactor", "Subunit structure [CC]", "EC number", "Length",
    "Activity regulation", "Kinetics", "Miscellaneous [CC]", "Status",
    "Protein existence", "Proteomes", "Sign",
)
STATISTICS = (
    "log2FC", "SE", "Tvalue", "DF", "pvalue", "adj.pvalue",
    "MissingPercentage", "ImputationPercentage",
)
COUNT_FIELDS = (
    "rowCount", "evaluatedRowCount", "significantRowCount", "ambiguousRowCount",
    "unavailableStatisticsRowCount", "invalidStatisticsRowCount",
    "sourceIssueRowCount", "signMismatchRowCount", "duplicateRowCount",
    "conflictingDuplicateRowCount",
)


def _statistic(raw: str, column: str) -> dict[str, Any]:
    """Separate literal missingness from invalid, nonfinite and valid numbers."""
    if raw in ("", "NA"):
        return {"value": None, "status": "unavailable"}
    if raw != raw.strip() or "_" in raw:
        return {"value": None, "status": "invalid", "reason": "not_numeric"}
    try:
        value = float(raw)
    except ValueError:
        return {"value": None, "status": "invalid", "reason": "not_numeric"}
    if not math.isfinite(value):
        return {"value": None, "status": "invalid", "reason": "nonfinite"}
    if column in ("pvalue", "adj.pvalue") and not 0 <= value <= 1:
        return {"value": None, "status": "invalid", "reason": "outside_0_1"}
    return {"value": value, "status": "valid"}


def _parsed_rows(binary: Any, expected_sha256: str) -> Iterator[dict[str, Any]]:
    """Rehash the parsing pass too, so a changed source cannot finish a report."""
    digest = hashlib.sha256()

    def lines() -> Iterator[str]:
        for number, raw in enumerate(binary, 1):
            digest.update(raw)
            try:
                yield raw.decode("utf-8")
            except UnicodeDecodeError as error:
                raise ValueError(f"source line {number}: invalid UTF-8") from error

    reader = csv.reader(lines(), delimiter="\t", strict=True)
    data_row = 0
    try:
        if next(reader, None) != list(HEADERS):
            raise ValueError("source line 1: exact headers/order changed")
        previous_line = reader.line_num
        for data_row, cells in enumerate(reader, 1):
            location = f"source data row {data_row}, line {previous_line + 1}"
            if len(cells) != len(HEADERS):
                raise ValueError(f"{location}: expected 38 cells, got {len(cells)}")
            raw = dict(zip(HEADERS, cells, strict=True))
            for column in ("Label", "Entry", "PeptideSequence", "BioReplicate"):
                if not raw[column].strip() or raw[column] == "NA":
                    raise ValueError(f"{location}: missing {column}")
            for column, allowed in (
                ("organism", ("pcc7942",)), ("Sign", ("Sign", "Unsign")),
                ("ambig", ("yes", "no")),
            ):
                if raw[column] not in allowed:
                    raise ValueError(f"{location}: unexpected {column}={raw[column]!r}")
            statistics = {name: _statistic(raw[name], name) for name in STATISTICS}
            adjusted = statistics["adj.pvalue"]["value"]
            checked = None if adjusted is None else adjusted < 0.01
            mismatch = checked is not None and checked != (raw["Sign"] == "Sign")
            flags = [
                f"{value['status']}:{name}" for name, value in statistics.items()
                if value["status"] != "valid"
            ]
            if raw["issue"] not in ("", "NA"):
                flags.append("source_issue")
            if mismatch:
                flags.append("source_sign_mismatch")
            evaluable = all(v["status"] == "valid" for v in statistics.values())
            evaluable = evaluable and raw["issue"] in ("", "NA")
            yield {
                "sourceDataRow": data_row,
                "sourceLineStart": previous_line + 1, "sourceLineEnd": reader.line_num,
                "cells": cells, "statistics": statistics,
                "sourceSign": raw["Sign"], "checkedSignificant": checked,
                "signMismatch": mismatch, "statisticsEvaluable": evaluable,
                "uniqueProteinEvaluable": evaluable and raw["ambig"] == "no",
                "flags": flags,
            }
            previous_line = reader.line_num
    except csv.Error as error:
        raise ValueError(
            f"source data row {data_row + 1}, line {reader.line_num}: invalid TSV: {error}"
        ) from error
    if not data_row:
        raise ValueError("source line 2: no data rows")
    if digest.hexdigest() != expected_sha256:
        raise ValueError("PXD044412 source changed during parsing (SHA-256 mismatch)")


def iter_rows(
    source: Path, *, expected_sha256: str = SOURCE_SHA256,
) -> Iterator[dict[str, Any]]:
    """Verify the entire binary file before yielding any parsed values.

    Alternative pins are explicit API inputs for synthetic tests or separately
    reviewed revisions. The CLI always uses SOURCE_SHA256. Consumers must exhaust
    this iterator to complete TSV validation and the second checksum check.
    """
    with source.open("rb") as binary:
        digest = hashlib.file_digest(binary, "sha256").hexdigest()
        if digest != expected_sha256:
            raise ValueError("PXD044412 source SHA-256 mismatch")
        binary.seek(0)
        yield from _parsed_rows(binary, expected_sha256)


def _new_group(entry: str, label: str) -> dict[str, Any]:
    return {
        "Entry": entry, "Label": label,
        **dict.fromkeys(COUNT_FIELDS, 0),
        "evaluatedRowReferences": [], "significantRowReferences": [],
    }


def _summarize(rows: Iterator[dict[str, Any]], output: Any) -> dict[str, Any]:
    """Keep only counters/row references in memory; duplicate index lives on disk."""
    groups = {}
    vocabulary = {name: Counter() for name in (
        "organism", "Label", "BioReplicate", "ambig", "Sign", "issue",
    )}
    totals = Counter(dict.fromkeys(COUNT_FIELDS, 0))
    # An empty SQLite filename creates a private, automatically deleted on-disk
    # database. No source cells or full row table accumulate in memory.
    connection = sqlite3.connect("")
    try:
        connection.execute(
            "CREATE TABLE seen (label TEXT, entry TEXT, peptide TEXT, replicate TEXT, "
            "first_row INTEGER, fingerprint BLOB, PRIMARY KEY(label, entry, peptide, replicate))"
        )
        for row in rows:
            raw = dict(zip(HEADERS, row["cells"], strict=True))
            key = (raw["Label"], raw["Entry"], raw["PeptideSequence"], raw["BioReplicate"])
            fingerprint = hashlib.sha256(_json(row["cells"]).encode("utf-8")).digest()
            previous = connection.execute(
                "SELECT first_row, fingerprint FROM seen "
                "WHERE label=? AND entry=? AND peptide=? AND replicate=?", key,
            ).fetchone()
            duplicate = previous is not None
            conflict = duplicate and fingerprint != previous[1]
            if duplicate:
                row["duplicateOfSourceDataRow"] = previous[0]
                row["flags"].append("duplicate_source_key")
                if conflict:
                    row["flags"].append("conflicting_duplicate_cells")
            else:
                connection.execute("INSERT INTO seen VALUES (?, ?, ?, ?, ?, ?)", (
                    *key, row["sourceDataRow"], fingerprint,
                ))
            group_key = (raw["Entry"], raw["Label"])
            if group_key not in groups:
                groups[group_key] = _new_group(*group_key)
            group = groups[group_key]
            statuses = {value["status"] for value in row["statistics"].values()}
            counts = {
                "rowCount": 1, "evaluatedRowCount": row["uniqueProteinEvaluable"],
                "significantRowCount": row["uniqueProteinEvaluable"] and row["checkedSignificant"],
                "ambiguousRowCount": raw["ambig"] == "yes",
                "unavailableStatisticsRowCount": "unavailable" in statuses,
                "invalidStatisticsRowCount": "invalid" in statuses,
                "sourceIssueRowCount": raw["issue"] not in ("", "NA"),
                "signMismatchRowCount": row["signMismatch"],
                "duplicateRowCount": duplicate, "conflictingDuplicateRowCount": conflict,
            }
            for name, count in counts.items():
                group[name] += count
            totals.update(counts)
            if counts["evaluatedRowCount"]:
                group["evaluatedRowReferences"].append(row["sourceDataRow"])
            if counts["significantRowCount"]:
                group["significantRowReferences"].append(row["sourceDataRow"])
            for name, counts_by_value in vocabulary.items():
                counts_by_value[raw[name]] += 1
            output.write(_json(row) + "\n")
        entries, peptides = connection.execute(
            "SELECT COUNT(DISTINCT entry), COUNT(DISTINCT peptide) FROM seen"
        ).fetchone()
    finally:
        connection.close()
    ordered_groups = []
    for key in sorted(groups):
        group = groups[key]
        if group["significantRowCount"]:
            group["evidenceState"] = "significant_peptide_evidence"
        elif group["evaluatedRowCount"]:
            group["evidenceState"] = "no_significant_peptide_evidence"
        else:
            group["evidenceState"] = "not_evaluated"
        ordered_groups.append(group)
    return {
        "audit": {
            **totals, "entryCount": entries, "peptideSequenceCount": peptides,
            "groupCount": len(groups),
            "vocabulary": {k: dict(sorted(v.items())) for k, v in vocabulary.items()},
            "evidenceStateCounts": dict(sorted(Counter(
                group["evidenceState"] for group in ordered_groups
            ).items())),
        },
        "groups": ordered_groups,
    }


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":"))


def write_report(
    source: Path, output_dir: Path, *, expected_sha256: str = SOURCE_SHA256,
) -> dict[str, Any]:
    """Write an exclusive bundle; summary.json marks a fully validated result.

    Existing files/directories/symlinks (including the source) are never replaced.
    On parse, checksum or write failure, remove only the directory created here.
    The output parent must already exist. No source text is executed as a formula.
    """
    if output_dir.exists() or output_dir.is_symlink():
        raise ValueError("output directory must be new; existing paths cannot be overwritten")
    rows = iter_rows(source, expected_sha256=expected_sha256)
    # Advancing once verifies the full checksum and validates the header/first row
    # before any output path is created. Keep this generator's file open throughout.
    try:
        first = next(rows)
        output_dir.mkdir()
    except BaseException:
        rows.close()
        raise
    try:
        def all_rows() -> Iterator[dict[str, Any]]:
            yield first
            yield from rows

        with gzip.open(
            output_dir / "rows.jsonl.gz", "wt", compresslevel=1,
            encoding="utf-8", newline="\n",
        ) as output:
            summary = _summarize(all_rows(), output)
        document = {
            "schemaVersion": 1, "accession": "PXD044412", "releaseEligible": False,
            "source": {
                "file": source.name, "sha256": expected_sha256,
                "url": "https://ndownloader.figshare.com/files/41985861",
                "datasetMetadata": "https://api.figshare.com/v2/articles/23939604",
                "datasetDOI": "10.6084/m9.figshare.23939604.v1", "datasetVersion": 1,
                "paperDOI": "10.1038/s42003-023-05318-8", "license": "CC BY 4.0",
                "licenseURL": "https://creativecommons.org/licenses/by/4.0/",
                "headers": HEADERS,
                "pinPolicy": "CLI uses the pinned S3 source; API alternative pins require separate review",
            },
            "rowsFile": "rows.jsonl.gz",
            "method": {
                "quantity": "Author analyzed peptide comparisons; not protein abundance or confirmed binding",
                "grouping": "Literal source Entry + Label; no pooling, strain transfer or invented absent groups",
                "significance": "Independent finite valid adj.pvalue < 0.01; source Sign retained; mismatches flagged",
                "evaluation": "All eight statistics valid and issue blank/NA; ambig=yes excluded from unique-protein evidence",
                "evidence": "Any evaluable unambiguous significant row; negative means only no significant peptide in evaluated rows",
                "sourceLimit": "Pinned S3 has no unavailable/nonfinite statistics or source issues; it cannot assess one-condition-missing comparisons omitted upstream. The author script filters infinite fold changes, a plausible origin, not a verified S3 execution history",
                "missing": "Blank/NA unavailable; invalid/nonfinite/out-of-range p-values flagged; zero is numeric",
                "duplicates": "All source rows retained and counted; duplicate keys compare all cells against first row; counts are rows, not independent peptide support",
                "rollup": "No numeric fold-change aggregation; derived conservative evidence, not exact author interaction calls",
                "sourceCells": "All 38 parsed strings in source header order; formulas are inert text; data rows are 1-based and physical lines include header",
                "units": "MissingPercentage/ImputationPercentage kept in native scale; Label concentration codes are not molar amounts",
                "replicates": "BioReplicate is literal source metadata, not an inferred biological replicate count; paper describes technical quadruplicates",
            },
            **summary,
        }
        with (output_dir / "summary.json").open("x", encoding="utf-8", newline="\n") as output:
            output.write(_json(document) + "\n")
        return document
    except BaseException:
        shutil.rmtree(output_dir)
        raise
    finally:
        rows.close()


def main(argv: list[str] | None = None) -> int:
    """Generate a non-release bundle from the single pinned analyzed source."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        document = write_report(args.input, args.output_dir)
    except (OSError, ValueError, sqlite3.Error) as error:
        parser.error(str(error))
    print(_json(document["audit"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
