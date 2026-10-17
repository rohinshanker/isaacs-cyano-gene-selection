"""Map pinned S3 Entry/Label evidence through exact PCC 7942/UTEX identities.

The new output directory contains mapping.json, a deterministic non-release
companion to the original S3. No source cells or protein fold changes are copied.
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import shutil
import sqlite3
from typing import Any, Iterator

import map_pxd036717 as identities
import pxd044412_peptides as peptides


ROOT = Path(__file__).resolve().parents[1]
PINS = {
    "source": peptides.SOURCE_SHA256,
    "uniprot": identities.PINS["uniprot"],
    "crosswalk": identities.PINS["crosswalk"],
}
SOURCE_LOCUS = "Gene names  (ordered locus )"
ENTRY_INDEX = peptides.HEADERS.index("Entry")
LABEL_INDEX = peptides.HEADERS.index("Label")
LOCUS_INDEX = peptides.HEADERS.index(SOURCE_LOCUS)


class _DiscardRows:
    """Reuse the reader's summary semantics without duplicating its row export."""

    def write(self, text: str) -> None:
        return None


def _identity(entry: str, loci: dict[str, list[dict[str, int]]],
              routes: dict[str, Any]) -> dict[str, Any]:
    members = [identities.lookup(accession, routes) for accession in entry.split(";")]
    reasons = []
    if len(members) != 1:
        reasons.append("protein_group")
    reasons.extend(sorted({m["status"] for m in members if m["status"] != "mapped"}))
    source_loci = []
    for literal, references in sorted(loci.items()):
        tokens = literal.replace(";", " ").split()
        source_loci.append({"literal": literal, "tokens": tokens,
                            "sourceRowReferences": references})
        if not tokens or literal.strip() == "NA":
            reasons.append("source_locus_missing")
        else:
            if len(tokens) != 1:
                reasons.append("source_locus_multiple")
            if any(not identities.PCC_LOCUS.fullmatch(token) for token in tokens):
                reasons.append("source_locus_unsupported")
            if len(members) == 1 and members[0]["pccLocus"] is not None:
                if tokens != [members[0]["pccLocus"]]:
                    reasons.append("source_locus_disagreement")
    # Identity is entry-wide, independent of comparison label or peptide quality.
    if len(source_loci) > 1:
        reasons.append("source_locus_conflict")
    reasons = list(dict.fromkeys(reasons))
    single = members[0] if len(members) == 1 else None
    return {
        "Entry": entry, "status": reasons[0] if reasons else "mapped",
        "exclusionReasons": reasons,
        "pccLocus": single["pccLocus"] if single else None,
        "utexLocus": single["utexLocus"] if single and not reasons else None,
        "members": members, "sourceLoci": source_loci,
        "targetCollisionEntries": [],
    }


def _exclude_collisions(records: list[dict[str, Any]]) -> None:
    """Defend against multiple observed entry identities assigning one target."""
    targets = defaultdict(list)
    for record in records:
        if record["status"] == "mapped":
            targets[record["utexLocus"]].append(record)
    for records_at_target in targets.values():
        if len(records_at_target) > 1:
            for record in records_at_target:
                record["status"] = "target_collision"
                record["exclusionReasons"].append("target_collision")
                record["utexLocus"] = None
                record["targetCollisionEntries"] = sorted(
                    r["Entry"] for r in records_at_target if r is not record
                )


def _audit(groups: list[dict[str, Any]]) -> dict[str, Any]:
    mapped = [g for g in groups if g["mappingStatus"] == "mapped"]
    return {
        "groupCount": len(groups),
        "entryCount": len({g["Entry"] for g in groups}),
        **{field: sum(g[field] for g in groups) for field in peptides.COUNT_FIELDS},
        "mappingStatusCounts": dict(sorted(Counter(g["mappingStatus"] for g in groups).items())),
        "evidenceStateCounts": dict(sorted(Counter(g["evidenceState"] for g in groups).items())),
        "mappedGroupCount": len(mapped),
        "mappedEntryCount": len({g["Entry"] for g in mapped}),
        "mappedEvidenceStateCounts": dict(sorted(Counter(g["evidenceState"] for g in mapped).items())),
        "mappedEvaluatedGroupCount": sum(g["evaluatedRowCount"] > 0 for g in mapped),
        "mappedRowCounts": {
            field: sum(g[field] for g in mapped) for field in peptides.COUNT_FIELDS
        },
    }


def write_report(
    source: Path, uniprot: Path, crosswalk: Path, output_dir: Path,
    *, pins: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Verify original inputs and write an exclusive, rollback-safe bundle.

    Alternative SHA-256 pins are API-only for tests or separately reviewed inputs.
    The CLI always uses the approved pins. Only identities.status == mapped assigns
    an identity; only mappedEvidenceState != null represents assessed evidence.
    """
    pins = PINS if pins is None else dict(pins)
    if set(pins) != set(PINS):
        raise ValueError("Exactly three source pins are required")
    if output_dir.exists() or output_dir.is_symlink():
        raise ValueError("output directory must be new; existing paths cannot be overwritten")
    sources = {"source": source, "uniprot": uniprot, "crosswalk": crosswalk}
    metadata = {}
    tables = {}
    for name, path in sources.items():
        metadata[name] = {"file": path.name, "sha256": pins[name], "bytes": path.stat().st_size}
        if name != "source":
            data = path.read_bytes()
            if hashlib.sha256(data).hexdigest() != pins[name]:
                raise ValueError(f"{name}: SHA-256 mismatch")
            tables[name] = data
    routes = identities.build_routes(tables["uniprot"], tables["crosswalk"])
    rows = peptides.iter_rows(source, expected_sha256=pins["source"])
    try:
        first = next(rows)
        output_dir.mkdir()
    except BaseException:
        rows.close()
        raise
    try:
        entry_loci = defaultdict(lambda: defaultdict(list))
        group_rows = defaultdict(list)

        def observed_rows() -> Iterator[dict[str, Any]]:
            row = first
            while True:
                cells = row["cells"]
                entry, label = cells[ENTRY_INDEX], cells[LABEL_INDEX]
                entry_loci[entry][cells[LOCUS_INDEX]].append({
                    key: row[key] for key in ("sourceDataRow", "sourceLineStart", "sourceLineEnd")
                })
                group_rows[entry, label].append(row["sourceDataRow"])
                yield row
                row = next(rows, None)
                if row is None:
                    break

        # This shared internal summary is deliberately the single authority for
        # ambiguity, duplicates, invalid statistics and significance counts.
        summary = peptides._summarize(observed_rows(), _DiscardRows())
        records = [_identity(entry, entry_loci[entry], routes) for entry in sorted(entry_loci)]
        _exclude_collisions(records)
        by_entry = {record["Entry"]: record for record in records}
        by_label = defaultdict(list)
        for group in summary["groups"]:
            record = by_entry[group["Entry"]]
            group["sourceDataRows"] = group_rows[group["Entry"], group["Label"]]
            group["mappingStatus"] = record["status"]
            group["utexLocus"] = record["utexLocus"]
            group["mappedEvidenceState"] = (
                group["evidenceState"]
                if record["status"] == "mapped" and group["evaluatedRowCount"] else None
            )
            by_label[group["Label"]].append(group)
        document = {
            "schemaVersion": 1, "accession": "PXD044412", "releaseEligible": False,
            "sources": metadata,
            "attribution": {
                "paperDOI": "10.1038/s42003-023-05318-8",
                "datasetDOI": "10.6084/m9.figshare.23939604.v1",
                "sourceURL": "https://ndownloader.figshare.com/files/41985861",
                "license": "CC BY 4.0", "licenseURL": "https://creativecommons.org/licenses/by/4.0/",
            },
            "method": {
                "identity": "Exact accession -> PCC 7942 locus -> UTEX 2973 locus; whole-table mutual uniqueness and exact versioned RefSeq overlap; no aliases",
                "sourceLocus": "Every literal S3 ordered-locus cell must name the same single supported locus and agree with the route; any failure excludes the entire Entry across labels",
                "assignment": "Only identities.status=mapped assigns a UTEX identity; members retain candidates even when excluded",
                "evidence": "Original pxd044412_peptides summary semantics, counts and evidenceState unchanged; ambig=yes never supports unique-protein assessment",
                "assessment": "mappedEvidenceState is null when identity is excluded or no unambiguous row is evaluable; mapped identity alone is not an assessed interaction",
                "grouping": "One record per observed literal Entry/Label; no absent pairs, fold-change aggregation, confirmed binding, coordinates or browser admission",
                "provenance": "Group sourceDataRows refer to identities.sourceLoci.sourceRowReferences (1-based data rows and physical lines including header); original pinned S3 retains cells",
                "sourceLimit": "Cannot assess comparisons omitted upstream, including one-condition-missing comparisons; no reconstructed MSstats or original study-sequence verification",
            },
            "identities": records, **summary,
            "mappingAudit": {
                "identityStatusCounts": dict(sorted(Counter(r["status"] for r in records).items())),
                "exclusionReasonCounts": dict(sorted(Counter(
                    reason for record in records for reason in record["exclusionReasons"]
                ).items())),
                "overall": _audit(summary["groups"]),
                "byLabel": {label: _audit(groups) for label, groups in sorted(by_label.items())},
            },
        }
        with (output_dir / "mapping.json").open("x", encoding="utf-8", newline="\n") as output:
            json.dump(document, output, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
            output.write("\n")
        return document
    except BaseException:
        shutil.rmtree(output_dir)
        raise
    finally:
        rows.close()


def main(argv: list[str] | None = None) -> int:
    """Map only the pinned original S3 and approved mapping tables."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--uniprot", type=Path, default=ROOT / identities.UNIPROT)
    parser.add_argument("--crosswalk", type=Path, default=ROOT / identities.CROSSWALK)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        document = write_report(args.input, args.uniprot, args.crosswalk, args.output_dir)
    except (OSError, ValueError, sqlite3.Error) as error:
        parser.error(str(error))
    print(peptides._json({key: document["mappingAudit"][key]
                          for key in ("identityStatusCounts", "overall")}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
