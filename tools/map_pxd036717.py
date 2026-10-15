"""Attach exact, ambiguity-preserving PCC 7942/UTEX identities to APEX2 evidence.

No browser layer is released. Source protein groups remain unassigned, even
when some members have candidate gene links. All measurements remain unchanged.
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import csv
import hashlib
import io
import json
from pathlib import Path
import re
from typing import Any

from pxd036717_enrichment import REPLICATES, SOURCE_SHA256, read_workbook


ROOT = Path(__file__).resolve().parents[1]
UNIPROT = "data/expression/ingest/uniprot_pcc7942_orf_names.tsv"
CROSSWALK = "data/annotation/releases/GCF_000817325.1-RS_2026_05_13/identifier-crosswalk-v1.tsv"
PINS = {
    "workbook": SOURCE_SHA256,
    "uniprot": "d3a018d87aa173c89468a068da5d71aa8c4166b9b5607c777354bab807bee515",
    "crosswalk": "97e3022e53cd1e31f5931ead37f425e1d99c032704e5ff8f02c0d75d1755e9ae",
}
RELATIONSHIP = "pcc7942_old_locus_tag"
PCC_LOCUS = re.compile(r"Synpcc7942_B?\d{4}[a-z]?")


def _table(data: bytes, required: set[str]) -> list[tuple[int, dict[str, str]]]:
    rows = csv.reader(io.StringIO(data.decode("utf-8-sig")), delimiter="\t")
    header = next(rows, [])
    if (not required.issubset(header) or len(set(header)) != len(header)
            or any(not value for value in header)):
        raise ValueError("Missing, empty or duplicate mapping table headers")
    result = []
    for number, values in enumerate(rows, 2):
        if len(values) != len(header):
            raise ValueError(f"Mapping table row {number}: wrong number of columns")
        result.append((number, dict(zip(header, values, strict=True))))
    return result


def _reverse_links(forward: dict[str, set[str]]) -> dict[str, set[str]]:
    reverse = defaultdict(set)
    for source, targets in forward.items():
        for target in targets:
            reverse[target].add(source)
    return reverse


def _unique_links(forward: dict[str, set[str]], excluded: set[str]) -> dict[str, str]:
    """Mutual uniqueness across the full table, including excluded edges."""
    reverse = _reverse_links(forward)
    result = {}
    for source, targets in forward.items():
        if source not in excluded and len(targets) == 1:
            target = next(iter(targets))
            if len(reverse[target]) == 1:
                result[source] = target
    return result


def build_routes(uniprot_data: bytes, crosswalk_data: bytes) -> dict[str, Any]:
    """Index exact source keys, retaining rejected candidates and row references."""
    proteins = defaultdict(set)
    protein_rows = defaultdict(list)
    protein_refseq = defaultdict(set)
    unsupported = set()
    for number, row in _table(uniprot_data, {"Entry", "Gene Names (ordered locus)", "RefSeq"}):
        accession = row["Entry"]
        if not accession or accession != accession.strip() or ";" in accession:
            raise ValueError(f"UniProt row {number}: invalid accession cell")
        # UniProt delimits multiple ordered-locus names with semicolons/spaces.
        # No token spelling is repaired; unsupported namespaces stay unassigned.
        names = row["Gene Names (ordered locus)"].replace(";", " ").split()
        proteins[accession].update(names)
        protein_rows[accession].append(number)
        protein_refseq[accession].update(re.findall(r"[A-Z]+_\d+\.\d+", row["RefSeq"]))
        if any(not PCC_LOCUS.fullmatch(name) for name in names):
            unsupported.add(accession)

    loci = defaultdict(set)
    locus_rows = defaultdict(list)
    locus_refseq = defaultdict(set)
    flagged = set()
    columns = {"relationship", "object_id", "subject_locus_tag", "mapping_ambiguity",
               "object_namespace", "mapping_method", "evidence"}
    for number, row in _table(crosswalk_data, columns):
        if row["relationship"] != RELATIONSHIP:
            continue
        source, target = row["object_id"], row["subject_locus_tag"]
        if (not PCC_LOCUS.fullmatch(source)
                or not re.fullmatch(r"M744_RS\d{5}", target)
                or row["object_namespace"] != "PCC7942_legacy_locus_tag"
                or row["mapping_method"] != "exact shared RefSeq protein_id"
                or not re.fullmatch(r"WP_\d+\.\d+", row["evidence"])):
            raise ValueError(f"Crosswalk row {number}: unexpected identifier/basis")
        loci[source].add(target)
        locus_rows[source].append(number)
        locus_refseq[source].add(row["evidence"])
        if row["mapping_ambiguity"]:
            flagged.add(source)
    return {
        "proteins": proteins, "proteinRows": protein_rows,
        "proteinRefseq": protein_refseq, "locusRefseq": locus_refseq,
        "proteinLinks": _unique_links(proteins, unsupported),
        "unsupported": unsupported, "loci": loci, "locusRows": locus_rows,
        "locusLinks": _unique_links(loci, flagged),
        "locusProteins": _reverse_links(proteins), "targetLoci": _reverse_links(loci),
    }


def lookup(accession: str, routes: dict[str, Any]) -> dict[str, Any]:
    """Keep candidate identifiers inspectable even when no assignment is allowed."""
    candidates = sorted(routes["proteins"].get(accession, set()))
    pcc = routes["proteinLinks"].get(accession)
    utex = routes["locusLinks"].get(pcc)
    refseq = sorted(routes["proteinRefseq"].get(accession, set()))
    shared_refseq = sorted(routes["locusRefseq"].get(pcc, set()))
    comparison = "not_available"
    if refseq and shared_refseq:
        comparison = "agrees" if set(refseq) & set(shared_refseq) else "disagrees"
    if accession not in routes["proteins"]:
        status = "uniprot_missing"
    elif not candidates:
        status = "uniprot_no_locus"
    elif accession in routes["unsupported"]:
        status = "uniprot_unsupported_locus"
    elif pcc is None:
        status = "uniprot_ambiguous"
    elif pcc not in routes["loci"]:
        status = "crosswalk_missing"
    elif utex is None:
        status = "crosswalk_ambiguous"
    elif comparison == "disagrees":
        status = "refseq_disagreement"
        utex = None
    elif comparison == "not_available":
        status = "refseq_unconfirmed"
        utex = None
    else:
        status = "mapped"
    utex_candidates = {
        target for source in candidates for target in routes["loci"].get(source, set())
    }
    protein_competitors = {
        other for source in candidates for other in routes["locusProteins"].get(source, set())
    } - {accession}
    crosswalk_competitors = {
        other for target in utex_candidates for other in routes["targetLoci"].get(target, set())
    } - set(candidates)
    return {
        "accession": accession, "status": status,
        "pccLocus": pcc, "utexLocus": utex,
        "uniprotRefseq": refseq, "crosswalkRefseq": shared_refseq,
        "refseqComparison": comparison,
        "pccCandidates": candidates,
        "utexCandidates": sorted(utex_candidates),
        "proteinCompetitors": [
            {"accession": other,
             "pccLoci": sorted(routes["proteins"][other] & set(candidates)),
             "uniprotRows": routes["proteinRows"][other]}
            for other in sorted(protein_competitors)
        ],
        "crosswalkCompetitors": [
            {"pccLocus": other,
             "utexLoci": sorted(routes["loci"][other] & utex_candidates),
             "crosswalkRows": routes["locusRows"][other]}
            for other in sorted(crosswalk_competitors)
        ],
        "uniprotRows": routes["proteinRows"].get(accession, []),
        "crosswalkRows": sorted({
            number for source in candidates for number in routes["locusRows"].get(source, [])
        }),
    }


def map_workbook(
    workbook: bytes, uniprot: bytes, crosswalk: bytes,
    *, pins: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Re-read pinned original evidence and attach identities without changing it."""
    pins = PINS if pins is None else pins
    sources = {"workbook": workbook, "uniprot": uniprot, "crosswalk": crosswalk}
    if set(pins) != set(sources):
        raise ValueError("Exactly three source pins are required")
    for name, data in sources.items():
        if hashlib.sha256(data).hexdigest() != pins[name]:
            raise ValueError(f"{name}: SHA-256 mismatch")
    doc = read_workbook(workbook, expected_sha256=pins["workbook"])
    routes = build_routes(uniprot, crosswalk)
    doc["mapping"] = {
        "basis": "PCC 7942 evidence transferred by exact identifier links to UTEX 2973",
        "relationship": RELATIONSHIP,
        "policy": "Whole-table mutual uniqueness; groups and collisions unassigned; no aliases",
        "sources": [
            {"path": path, "sha256": pins[name], "bytes": len(sources[name])}
            for name, path in (("uniprot", UNIPROT), ("crosswalk", CROSSWALK))
        ],
    }
    for table in doc["sheets"]:
        targets = defaultdict(list)
        for row in table["rows"]:
            members = [lookup(accession, routes) for accession in row["accession"].split(";")]
            single = len(members) == 1
            row["mapping"] = {
                "status": members[0]["status"] if single else "protein_group",
                "pccLocus": members[0]["pccLocus"] if single else None,
                "utexLocus": members[0]["utexLocus"] if single else None,
                "members": members,
            }
            if row["mapping"]["status"] == "mapped":
                targets[row["mapping"]["utexLocus"]].append(row)
        # A duplicate source row cannot win by file order. Repeated targets in
        # different bait tabs remain separate experiments and are permitted.
        for rows in targets.values():
            if len(rows) > 1:
                for row in rows:
                    row["mapping"]["status"] = "target_collision"
                    row["mapping"]["utexLocus"] = None
        mapped = [row for row in table["rows"] if row["mapping"]["status"] == "mapped"]
        table["mappingAudit"] = {
            "statuses": dict(sorted(Counter(
                row["mapping"]["status"] for row in table["rows"]
            ).items())),
            "mappedRows": len(mapped),
            "mappedValidByReplicate": {
                rep: sum(row["comparisons"][i]["reconstructedLog2Ratio"] is not None
                         for row in mapped)
                for i, rep in enumerate(REPLICATES)
            },
            "mappedCompleteMeans": sum(row["meanLog2Ratio"] is not None for row in mapped),
            "mappedDetectionCounts": {
                state: sum(row["detectionCounts"][state] for row in mapped)
                for state in table["audit"]["detectionCounts"]
            },
        }
    return doc


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="Original pinned mmc1.xlsx")
    parser.add_argument("--uniprot", type=Path, default=ROOT / UNIPROT)
    parser.add_argument("--crosswalk", type=Path, default=ROOT / CROSSWALK)
    parser.add_argument("--output", type=Path, required=True,
                        help="Non-release mapped evidence JSON")
    args = parser.parse_args(argv)
    inputs = (args.input, args.uniprot, args.crosswalk)
    for source in inputs:
        if (source.resolve() == args.output.resolve()
                or (args.output.exists() and args.output.samefile(source))):
            parser.error("output must not overwrite any source input")
    doc = map_workbook(*(source.read_bytes() for source in inputs))
    text = json.dumps(doc, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(text, encoding="utf-8")
    print(json.dumps({t["bait"]: t["mappingAudit"] for t in doc["sheets"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
