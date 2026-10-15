#!/usr/bin/env python3
"""Reproduce separately selectable GEO array samples and explicit source summaries."""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import math
import sys
from pathlib import Path

from geo_array import project_geo_table, read_geo_soft
from ingest_expression import DEFAULT_CROSSWALK, fetch, load_crosswalk, map_to_utex, write_table

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from condition_record import validate_record  # noqa: E402
from expression_table import check_value, declared_flags  # noqa: E402

CATALOGUE = ROOT / "data/expression/ingest/geo_array_sources.json"


def wrapped_table(data: bytes, kind: str) -> list[list[str]]:
    """Read an explicitly named GEO wrapper for an independent equality check."""
    text = gzip.decompress(data).decode("utf-8-sig")
    begin, end = f"!{kind}_table_begin", f"!{kind}_table_end"
    lines = text.splitlines()
    if lines.count(begin) != 1 or lines.count(end) != 1:
        raise ValueError(f"expected one {kind} table")
    start, stop = lines.index(begin), lines.index(end)
    if stop <= start + 1:
        raise ValueError(f"empty or reversed {kind} table")
    return list(csv.reader(lines[start + 1:stop], delimiter="\t"))


def metadata(entity: dict) -> dict[str, list[str]]:
    """Retain every repeated metadata value under its exact source field."""
    result: dict[str, list[str]] = {}
    for item in entity["metadata"]:
        result.setdefault(item["key"], []).append(item["value"])
    return result


def verify_matrix(document: dict, data: bytes, expected_samples: list[str]) -> None:
    """Check every SOFT value against the separately served series matrix."""
    table = wrapped_table(data, "series_matrix")
    if table[0] != ["ID_REF", *expected_samples]:
        raise ValueError("matrix sample membership/order differs from the pinned catalogue")
    values = {}
    for row in table[1:]:
        if len(row) != len(table[0]):
            raise ValueError("matrix row width differs from header")
        for sample, value in zip(expected_samples, row[1:], strict=True):
            key = (sample, row[0])
            if key in values:
                raise ValueError("duplicate matrix sample/feature")
            values[key] = value
    observed = {(m["sampleId"], m["idRef"]): m["value"] for m in document["measurements"]}
    if observed != values:
        raise ValueError("SOFT and series matrix measurements differ")


def summary_values(samples: dict[str, dict[str, float]], sample_ids: list[str],
                   multipliers: list[int]) -> dict[str, float]:
    """Mean only an explicit complete-case source group in its declared orientation."""
    if (len(sample_ids) < 2 or len(sample_ids) != len(set(sample_ids))
            or len(sample_ids) != len(multipliers) or any(v not in (-1, 1) for v in multipliers)):
        raise ValueError("invalid explicit array summary group")
    if any(sample not in samples for sample in sample_ids):
        raise ValueError("summary names an absent sample")
    shared = set.intersection(*(set(samples[sample]) for sample in sample_ids))
    return {gene: math.fsum(samples[sample][gene] * sign
                            for sample, sign in zip(sample_ids, multipliers, strict=True)) / len(sample_ids)
            for gene in sorted(shared)}


def verify_dye_swap(values: dict[str, float], data: bytes, feature_to_orf: dict[str, str]) -> dict:
    """Match the oriented mean against the authors' independently deposited table."""
    rows = list(csv.reader(io.StringIO(gzip.decompress(data).decode("utf-8-sig")), delimiter="\t"))
    if rows[0][:2] != ["Gene ID", "JGI_ID"]:
        raise ValueError("unexpected published dye-swap summary schema")
    published = {}
    for row in rows[1:]:
        if not any(cell.strip() for cell in row):
            continue
        if len(row) < 3:
            raise ValueError("short published summary row")
        gene = feature_to_orf.get(row[1])
        if not gene:
            continue
        if gene in published:
            raise ValueError("duplicate published summary gene")
        published[gene] = float(row[2])
    if not set(values) <= published.keys():
        raise ValueError("published dye-swap table lacks projected genes")
    errors = [abs(value - published[gene]) for gene, value in values.items()]
    if not errors or max(errors) > 0.005000001:
        raise ValueError("oriented dye-swap mean disagrees with published 0.01 precision")
    return {"comparedGenes": len(errors), "maximumAbsoluteDifference": max(errors),
            "tolerance": 0.005000001, "basis": "published summary rounded to two decimals"}


def verify_pool_metadata(source: dict, pool: dict, samples: dict[str, dict]) -> None:
    """Enforce the two admitted, source-specific summary designs."""
    members = [metadata(samples[s]) for s in pool["sampleIds"]]
    if source["studyId"] == "GSE50919":
        if pool["sampleIds"] != ["GSM1232426", "GSM1232427"] or pool["multipliers"] != [1, -1]:
            raise ValueError("unrecognized dye-swap group or orientation")
        for channel, other in ((1, 2), (2, 1)):
            if members[0][f"Sample_source_name_ch{channel}"] != members[1][f"Sample_source_name_ch{other}"]:
                raise ValueError("dye-swap biological channel assignments do not reverse")
        if any(m["Sample_label_ch1"] != ["Cy3"] or m["Sample_label_ch2"] != ["Cy5"] for m in members):
            raise ValueError("unexpected dye assignments")
    elif source["studyId"] == "GSE102914":
        allowed = [[f"GSM{i}" for i in range(start, start + 4)] for start in (2748217, 2748221, 2748225, 2748229)]
        if pool["sampleIds"] not in allowed or pool["multipliers"] != [1] * 4:
            raise ValueError("unrecognized four-replicate treatment group")
        for field in ("Sample_source_name_ch1", "Sample_treatment_protocol_ch1", "Sample_data_processing"):
            if any(m.get(field) != members[0].get(field) for m in members[1:]):
                raise ValueError(f"replicate group differs in {field}")
    else:
        raise ValueError("no validated pooling rule for this study")


def build(catalogue: dict, *, interim: Path, out_dir: Path,
          crosswalk_path: Path = DEFAULT_CROSSWALK) -> list[dict]:
    """Verify source files, preserve evidence, and build 122 samples plus five opt-in summaries."""
    out_dir.mkdir(parents=True, exist_ok=True)
    if hashlib.sha256(crosswalk_path.read_bytes()).hexdigest() != catalogue["crosswalk"]["sha256"]:
        raise ValueError("array identifier crosswalk checksum mismatch")
    crosswalk = load_crosswalk(crosswalk_path, "pcc7942_old_locus_tag")
    platform = catalogue["platform"]
    platform_bytes = fetch(platform["url"], platform["sha256"], interim / platform["name"])
    platform_table = wrapped_table(platform_bytes, "platform")
    feature_index, orf_index = platform_table[0].index("ID"), platform_table[0].index("ORF")
    feature_to_orf = {row[feature_index]: row[orf_index] for row in platform_table[1:]}
    entries = []
    for source in catalogue["sources"]:
        study = source["studyId"]
        pin = source["soft"]
        soft = fetch(pin["url"], pin["sha256"], interim / pin["name"])
        document = read_geo_soft(soft, source_id=study)
        embedded = [e["table"] for e in document["sources"][0]["entities"] if e["type"] == "PLATFORM"]
        if len(embedded) != 1 or [embedded[0]["header"], *embedded[0]["rows"]] != platform_table:
            raise ValueError(f"{study}: embedded platform differs from pinned GPL9534")
        matrix = source["matrix"]
        matrix_bytes = fetch(matrix["url"], matrix["sha256"], interim / matrix["name"])
        verify_matrix(document, matrix_bytes, source["sampleAccessions"])
        evidence_path = interim / f"{study}.processed-evidence.json"
        evidence_path.write_text(json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n")
        header, rows, audit = project_geo_table(document, platform_id="GPL9534", id_column="ORF",
                                               identifier_pattern=r"(?:Synpcc7942_[A-Za-z0-9]+|[0-9]+)")
        projected_genes = {crosswalk[row[0]] for row in rows if row[0] in crosswalk}
        if len(projected_genes) != source["mappingAudit"]["mappedUtexGenes"]:
            raise ValueError(f"{study}: mapped gene count differs from the source audit")
        sample_entities = {e["id"]: e for e in document["sources"][0]["entities"] if e["type"] == "SAMPLE"}
        sample_values = {}
        for position, sample in enumerate(header[1:], 1):
            sample_values[sample] = {
                row[0]: check_value(source["quantity"], float(row[position]), f"{study}/{sample}/{row[0]}")
                for row in rows if row[position].strip().lower() not in ("", "null", "na", "nan")
            }
        layers = [{"id": sample, "label": metadata(sample_entities[sample])["Sample_title"][0],
                   "sampleIds": [sample], "multipliers": [1]} for sample in header[1:]]
        layers.extend(source["pools"])
        for layer in layers:
            selected = layer["sampleIds"]
            pooled = len(selected) > 1
            validation = None
            if pooled:
                verify_pool_metadata(source, layer, sample_entities)
                values = summary_values(sample_values, selected, layer["multipliers"])
                if study == "GSE50919":
                    summary = source["publishedDyeSwapSummary"]
                    validation = verify_dye_swap(values, fetch(summary["url"], summary["sha256"], interim / summary["name"]), feature_to_orf)
            else:
                values = sample_values[selected[0]]
            mapped, unmapped = map_to_utex(values, crosswalk)
            if not mapped:
                raise ValueError(f"{study}/{layer['id']}: no mapped values")
            ident = f"{study}_{layer['id']}"
            file_name = ident + ".tsv"
            digest = write_table(out_dir / file_name, mapped, "transcriptomics", source["quantity"])
            metadata_by_sample = {sample: metadata(sample_entities[sample]) for sample in selected}
            descriptions = sorted({v["value"] for sample in selected
                                   for v in sample_entities[sample]["columnDescriptions"] if v["key"] == "VALUE"})
            processing = sorted({value for m in metadata_by_sample.values() for value in m.get("Sample_data_processing", [])})
            caveat = ("Measured in PCC 7942 and mapped onto UTEX 2973, not measured in UTEX. "
                      "Deposited processed per-gene values; physical probe measurements were combined by the authors. "
                      + " ".join(descriptions) + " " + source["poolingPolicy"])
            if source["quantity"] == "array_temporal_profile":
                caveat += " Per-ORF time-course normalization fixes WT mean 0 and amplitude 2; this is not absolute RNA abundance or a between-gene expression scale."
            record = {"studyId": study, "dataType": "transcriptomics", "platform": "array",
                      "strain": "PCC 7942", "basis": "transferred", "conditionSet": layer["label"],
                      "samples": ", ".join(selected), "archiveUrl": f"https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc={study}",
                      "citation": source["citation"], "replicates": {"count": len(selected),
                          "text": "Explicit optional summary of deposited samples" if pooled else "One deposited array; no new sample pooling",
                          "where": pin["url"]}, "treatments": [layer["label"]],
                      "group": source["sampleGroups"].get(selected[0], source["group"]),
                      "conditionTableRow": source["conditionTableRow"], "conditions": source["conditions"]}
            validate_record(record, ident)
            entries.append({"id": ident, "file": file_name, "metricKey": "expr" + ident.replace("_", ""),
                            "label": f"{study}: {layer['label']} (PCC 7942 array)", "record": record,
                            "organism": "Synechococcus elongatus PCC 7942", "isTargetOrganism": False,
                            "assay": "Microarray deposited " + source["quantity"].removeprefix("array_").replace("_", " "),
                            "units": {"array_log2_ratio": "normalized log2 sample/reference ratio",
                                      "array_normalized_signal": "normalized signal as deposited",
                                      "array_temporal_profile": "normalized time-course profile (WT mean 0, amplitude 2)"}[source["quantity"]],
                            "quantity": source["quantity"], **declared_flags(source["quantity"]),
                            "condition": layer["label"], "sha256": digest,
                            "licence": "GEO/NCBI deposit; reuse with article/deposit citation authorized by owner 2026-10-06 (source ledger)",
                            "caveat": caveat, "provenanceDoc": "docs/validation/geo-array-reader.md",
                            "citationId": source["citationId"], "payload": "expression_layers.json",
                            "ingest": {"sourceFile": pin["name"], "sourceSha256": pin["sha256"], "sourceUrl": pin["url"],
                                       "columns": selected, "normalization": "as-deposited",
                                       "mappedGenes": len(mapped), "unmappedIdentifiers": unmapped + audit["unmappedProbes"],
                                       "mappingRoute": "GPL9534 ID_REF to unique ORF, then pinned one-to-one PCC 7942 old-locus crosswalk to UTEX 2973",
                                       "array": {"platformSha256": platform["sha256"], "measuredFeatures": source["featureCount"],
                                                 "metadata": metadata_by_sample, "valueDescriptions": descriptions,
                                                 "processing": processing, "summary": layer if pooled else None,
                                                 "summaryValidation": validation}}})
    return entries


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalogue", type=Path, default=CATALOGUE)
    parser.add_argument("--interim", type=Path, default=ROOT / "data/interim/geo-arrays")
    parser.add_argument("--out-dir", type=Path, default=ROOT / "data/expression")
    parser.add_argument("--manifest", type=Path, default=ROOT / "data/expression/sources.json")
    args = parser.parse_args(argv)
    catalogue = json.loads(args.catalogue.read_text())
    entries = build(catalogue, interim=args.interim, out_dir=args.out_dir)
    studies = {source["studyId"] for source in catalogue["sources"]}
    existing = json.loads(args.manifest.read_text()) if args.manifest.exists() else []
    existing = [entry for entry in existing if entry["record"]["studyId"] not in studies]
    args.manifest.write_text(json.dumps(existing + entries, ensure_ascii=False, indent=2) + "\n")
    print(f"Wrote {len(entries)} separate sample/optional-summary layers from {len(studies)} studies")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
