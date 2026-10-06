#!/usr/bin/env python3
"""Turn a deposited per-gene table into expression source layers for the build.

One spec file describes one deposited study: where its table is, how to read
it, which columns belong to which condition layer, and the structured condition
record every layer carries. The tool verifies the download against its pinned
checksum, averages each layer's samples, maps the study's PCC 7942 identifiers
to UTEX 2973 locus tags through the pinned identifier crosswalk, writes one TSV
per layer in the pipeline's expression-table format, and updates the sources
manifest. It never fills a value for a gene with no mapped measurement, and it
drops every identifier whose mapping is not one-to-one, as the shipped PCC 7942
table's provenance requires.

Usage:
    ingest_expression.py SPEC [--interim DIR] [--manifest PATH] [--crosswalk PATH]
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import math
import re
import sys
import urllib.request
from pathlib import Path
from typing import Any, Mapping

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from condition_record import validate_record  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "data/expression/sources.json"
DEFAULT_CROSSWALK = ROOT / "data/annotation/releases/GCF_000817325.1-RS_2026_05_13/identifier-crosswalk-v1.tsv"
DEFAULT_INTERIM = ROOT / "data/interim/expression"
DEFAULT_CONDITIONS = ROOT / "docs/notes/handoff/cyano_package_B_conditions_20261003.tsv"
ID_RELATIONSHIPS = {"pcc7942_old": "pcc7942_old_locus_tag", "pcc7942_rs": "pcc7942_ortholog"}
AXIS_BY_TABLE_NAME = {
    "temperature": "temperature", "light_intensity": "lightIntensity", "light_regime": "lightRegime",
    "co2": "co2", "medium": "medium", "culture_format": "format", "growth_phase": "phase",
}


def sha256_of(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fetch(url: str, expected_sha256: str, target: Path) -> bytes:
    """Return the file's bytes, downloading once and refusing a checksum mismatch."""
    if target.is_file():
        data = target.read_bytes()
    else:
        with urllib.request.urlopen(url, timeout=120) as response:  # noqa: S310 - pinned https URL
            data = response.read()
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    observed = sha256_of(data)
    if observed != expected_sha256:
        raise ValueError(f"checksum mismatch for {target.name}: expected {expected_sha256}, got {observed}")
    return data


def read_table(data: bytes, reader: Mapping[str, Any]) -> tuple[list[str], list[list[str]]]:
    """Read a deposited table into a header and string rows.

    The header is the first row holding a cell equal to ``reader['idColumn']``;
    rows above it are comments or titles and are skipped, and the identifier
    column is moved to the front. Gzip is detected by magic bytes, not by name.
    """
    if data[:2] == b"\x1f\x8b":
        data = gzip.decompress(data)
    fmt = reader["format"]
    if fmt in ("csv", "tsv"):
        text = data.decode("utf-8-sig")
        rows = list(csv.reader(io.StringIO(text), delimiter="," if fmt == "csv" else "\t"))
    elif fmt in ("xlsx", "xls"):
        import pandas as pd  # noqa: PLC0415 - optional heavy import, only for workbooks

        frame = pd.read_excel(io.BytesIO(data), sheet_name=reader["sheet"], header=None, dtype=object)
        rows = [["" if (isinstance(v, float) and v != v) or v is None else str(v) for v in row]
                for row in frame.itertuples(index=False)]
    else:
        raise ValueError(f"unknown table format {fmt!r}")
    id_column = reader["idColumn"]
    for index, row in enumerate(rows):
        header = [cell.strip() for cell in row]
        if id_column in header:
            id_index = header.index(id_column)
            body = [r for r in rows[index + 1:] if len(r) > id_index and r[id_index].strip()]
            # The identifier is moved to the front so every later step reads column 0.
            return [header[id_index]] + header[:id_index] + header[id_index + 1:], \
                [[r[id_index]] + r[:id_index] + r[id_index + 1:] for r in body]
    raise ValueError(f"no header row names {id_column!r}")


def column_values(header: list[str], rows: list[list[str]], column: str) -> dict[str, float]:
    """One column as identifier → number, with blank cells skipped and ids stripped."""
    try:
        position = header.index(column)
    except ValueError as error:
        raise ValueError(f"column {column!r} is not in the table") from error
    values: dict[str, float] = {}
    for row in rows:
        identifier = row[0].strip()
        cell = row[position].strip() if position < len(row) else ""
        if not cell or cell.lower() in ("na", "nan", "null"):
            continue
        value = float(cell)
        if not math.isfinite(value) or value < 0:
            raise ValueError(f"{identifier}: {column!r} holds an invalid value {cell!r}")
        if identifier in values:
            raise ValueError(f"{identifier} appears twice in the table")
        values[identifier] = value
    return values


def normalise(values: dict[str, float], method: str) -> dict[str, float]:
    """``cpm`` scales a sample to counts per million over the genes it reports; ``as-deposited`` keeps it."""
    if method == "as-deposited":
        return values
    if method == "cpm":
        total = sum(values.values())
        if total <= 0:
            raise ValueError("a sample with no counts cannot be scaled to counts per million")
        return {k: v / total * 1_000_000 for k, v in values.items()}
    raise ValueError(f"unknown normalization {method!r}")


def layer_means(header: list[str], rows: list[list[str]], columns: list[str], method: str) -> dict[str, float]:
    """The per-identifier arithmetic mean over a layer's sample columns."""
    samples = [normalise(column_values(header, rows, column), method) for column in columns]
    shared = set.intersection(*(set(sample) for sample in samples)) if samples else set()
    return {identifier: sum(sample[identifier] for sample in samples) / len(samples) for identifier in sorted(shared)}


def load_crosswalk(path: Path, relationship: str) -> dict[str, str]:
    """Source identifier → UTEX locus tag, one-to-one only.

    Any relationship row flagged ambiguous, any source identifier reaching two
    UTEX loci, and any UTEX locus reached by two source identifiers are all
    dropped: assigning either side would be a guess (data/expression/PROVENANCE.md).
    """
    forward: dict[str, set[str]] = {}
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle, delimiter="\t"):
            if row["relationship"] != relationship or row["mapping_ambiguity"]:
                continue
            forward.setdefault(row["object_id"], set()).add(row["subject_locus_tag"])
    reverse: dict[str, set[str]] = {}
    for source, targets in forward.items():
        for target in targets:
            reverse.setdefault(target, set()).add(source)
    return {source: next(iter(targets)) for source, targets in forward.items()
            if len(targets) == 1 and len(reverse[next(iter(targets))]) == 1}


def map_to_utex(values: Mapping[str, float], crosswalk: Mapping[str, str]) -> tuple[dict[str, tuple[float, str]], int]:
    """UTEX locus → (value, source id); the second item counts identifiers that did not map."""
    mapped: dict[str, tuple[float, str]] = {}
    unmapped = 0
    for source, value in values.items():
        target = crosswalk.get(source)
        if target is None:
            unmapped += 1
            continue
        mapped[target] = (value, source)
    return mapped, unmapped


def write_table(path: Path, mapped: Mapping[str, tuple[float, str]]) -> str:
    """Write the pipeline's three-column table and return its SHA-256."""
    lines = ["locus_tag\tabundance\tsource_gene_id"]
    for locus in sorted(mapped):
        value, source = mapped[locus]
        lines.append(f"{locus}\t{value:.4f}\t{source}")
    content = "\n".join(lines) + "\n"
    path.write_text(content, encoding="utf-8")
    return sha256_of(content.encode("utf-8"))


def condition_quotes(conditions_table: Path | None, row_number: int | None) -> tuple[dict[str, dict[str, str]], dict[str, str]]:
    """The quote and location each axis cites in the condition table's row, plus the replicates cell's."""
    if conditions_table is None or row_number is None or not conditions_table.is_file():
        return {}, {}
    with conditions_table.open(encoding="utf-8", newline="") as handle:
        csv.field_size_limit(sys.maxsize)
        rows = list(csv.DictReader(handle, delimiter="\t"))
    row = rows[row_number - 1]
    quotes: dict[str, dict[str, str]] = {}
    for segment in row["conditions"].split(" ;; ")[1:]:
        match = re.match(r"^(\w+) = (.*)$", segment, re.S)
        if not match or match.group(1) not in AXIS_BY_TABLE_NAME:
            continue
        text = match.group(2)
        where = quote = ""
        start = text.find(" [")
        if start >= 0 and text.endswith("]"):
            inner = text[start + 2:-1]
            where, _, rest = inner.partition('; quote: "')
            quote = rest[:-1] if rest.endswith('"') else rest
        quotes[AXIS_BY_TABLE_NAME[match.group(1)]] = {"quote": quote, "where": where}
    replicates = {"quote": "", "where": ""}
    cell = row["replicates"]
    start = cell.find(" [")
    if start >= 0 and cell.endswith("]"):
        where, _, rest = cell[start + 2:-1].partition('; quote: "')
        replicates = {"quote": rest[:-1] if rest.endswith('"') else rest, "where": where}
    return quotes, replicates


def build_record(spec: Mapping[str, Any], layer: Mapping[str, Any], quotes: Mapping[str, Mapping[str, str]],
                 replicate_quote: Mapping[str, str]) -> dict[str, Any]:
    """The layer's condition record: the spec's structured axes with the table's quotes attached."""
    conditions: dict[str, Any] = {}
    for axis, fields in spec["conditions"].items():
        axis_record = dict(fields)
        cited = quotes.get(axis, {})
        axis_record.setdefault("quote", cited.get("quote", ""))
        axis_record.setdefault("where", cited.get("where", ""))
        conditions[axis] = axis_record
    replicates = dict(spec["replicates"])
    replicates.setdefault("where", replicate_quote.get("where", ""))
    record = {
        "studyId": spec["studyId"],
        "dataType": spec["dataType"],
        "platform": spec["platform"],
        "strain": spec["strain"],
        "basis": spec["basis"],
        "conditionSet": layer["conditionSet"],
        "samples": layer["samples"],
        "archiveUrl": spec["archiveUrl"],
        "citation": spec.get("citation"),
        "replicates": replicates,
        "treatments": list(layer.get("treatments", [])),
        "group": layer["group"],
        "conditionTableRow": spec.get("conditionTableRow"),
        "conditions": conditions,
    }
    validate_record(record, f"{spec['studyId']} layer {layer['id']}")
    return record


def ingest(spec: Mapping[str, Any], *, manifest_path: Path, crosswalk_path: Path, interim: Path,
           conditions_table: Path | None, out_dir: Path) -> list[dict[str, Any]]:
    """Run the whole ingestion for one spec and return the manifest entries written."""
    source = spec["file"]
    data = fetch(source["url"], source["sha256"], interim / source["name"])
    header, rows = read_table(data, spec["reader"])
    crosswalk = load_crosswalk(crosswalk_path, ID_RELATIONSHIPS[spec["reader"]["idKind"]])
    quotes, replicate_quote = condition_quotes(conditions_table, spec.get("conditionTableRow"))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.is_file() else []
    by_id = {entry["id"]: index for index, entry in enumerate(manifest)}
    written = []
    for layer in spec["layers"]:
        means = layer_means(header, rows, layer["columns"], spec["normalization"])
        mapped, unmapped = map_to_utex(means, crosswalk)
        if not mapped:
            raise ValueError(f"layer {layer['id']} maps no gene; check idKind and the columns")
        table_name = f"{layer['id']}.tsv"
        digest = write_table(out_dir / table_name, mapped)
        entry = {
            "record": build_record(spec, layer, quotes, replicate_quote),
            "id": layer["id"],
            "file": table_name,
            "metricKey": layer["metricKey"],
            "label": layer["label"],
            "organism": spec["organism"],
            "isTargetOrganism": spec["basis"] == "direct",
            "assay": spec["assay"],
            "units": spec["units"],
            "condition": layer["conditionSet"],
            "sha256": digest,
            "licence": spec["licence"],
            "caveat": layer.get("caveat", spec["caveat"]),
            "provenanceDoc": spec["provenanceDoc"],
            "citationId": spec["citationId"],
            "payload": "expression_layers.json",
            "ingest": {
                "sourceFile": source["name"], "sourceSha256": source["sha256"], "sourceUrl": source["url"],
                "columns": layer["columns"], "normalization": spec["normalization"],
                "mappedGenes": len(mapped), "unmappedIdentifiers": unmapped,
                "mappingRoute": f"{ID_RELATIONSHIPS[spec['reader']['idKind']]} in {crosswalk_path.name}, one-to-one rows only",
            },
        }
        if layer["id"] in by_id:
            manifest[by_id[layer["id"]]] = entry
        else:
            manifest.append(entry)
            by_id[layer["id"]] = len(manifest) - 1
        written.append(entry)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return written


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("spec", type=Path, help="dataset spec, JSON")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--crosswalk", type=Path, default=DEFAULT_CROSSWALK)
    parser.add_argument("--interim", type=Path, default=DEFAULT_INTERIM)
    parser.add_argument("--conditions", type=Path, default=DEFAULT_CONDITIONS)
    parser.add_argument("--out-dir", type=Path, default=None, help="where layer tables go (default: beside the manifest)")
    args = parser.parse_args(argv)
    spec = json.loads(args.spec.read_text(encoding="utf-8"))
    written = ingest(spec, manifest_path=args.manifest, crosswalk_path=args.crosswalk, interim=args.interim,
                     conditions_table=args.conditions, out_dir=args.out_dir or args.manifest.parent)
    for entry in written:
        info = entry["ingest"]
        print(f"{entry['id']}: {info['mappedGenes']} genes mapped, {info['unmappedIdentifiers']} identifiers unmapped -> {entry['file']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
