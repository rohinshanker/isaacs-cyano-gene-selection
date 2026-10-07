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
# A protein table keyed by UniProt accession first becomes PCC 7942 ordered
# locus names through UniProt's own table for the strain, then follows the
# old-locus-tag route; the table is a pinned input beside the specs.
UNIPROT_ID_KIND = "uniprot_pcc7942"
DEFAULT_UNIPROT_TABLE = ROOT / "data/expression/ingest/uniprot_pcc7942_orf_names.tsv"
# A DTASelect report's protein lines name UniProt FASTA entries as
# ACCESSION_ENTRY_ORGANISM; the accession is the part the UniProt route needs.
UNIPROT_ACCESSION = re.compile(r"^([OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2})_")
DTASELECT_DECOY_PREFIX = "Reverse_"
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
    column is moved to the front. An identifier column the deposit leaves
    unnamed is named by the empty string. Gzip is detected by magic bytes, not
    by name.

    A workbook may spread one table over several sheets (``reader['sheets']``,
    one per replicate): they are read side by side, joined on the identifier,
    and each column name takes the sheet name as a suffix. A sheet whose
    column headers repeat under block titles (``reader['blockTitleRows']``,
    1-based, in priority order; ``blockTitleRow`` for one) has each header
    prefixed with the nearest title to its left in the first listed row that
    has one, so every column has a name of its own:
    ``<block> :: <header> :: <sheet>``. A search-engine deposit of DTASelect
    reports (``format: dtaselect``) is read by ``read_dtaselect`` instead.
    """
    if data[:2] == b"\x1f\x8b":
        data = gzip.decompress(data)
    if reader["format"] == "dtaselect":
        return read_dtaselect(data, reader["zipMembers"], reader.get("countColumn", "Spectrum Count"))
    if reader.get("zipMember"):
        import zipfile  # noqa: PLC0415 - only for archived deposits

        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            data = archive.read(reader["zipMember"])
    fmt = reader["format"]
    if fmt in ("csv", "tsv"):
        text = data.decode("utf-8-sig")
        rows = list(csv.reader(io.StringIO(text), delimiter="," if fmt == "csv" else "\t"))
        return _split_header(rows, reader["idColumn"], _title_rows(reader))
    if fmt not in ("xlsx", "xls"):
        raise ValueError(f"unknown table format {fmt!r}")
    import pandas as pd  # noqa: PLC0415 - optional heavy import, only for workbooks

    sheets = reader.get("sheets") or [reader["sheet"]]
    joined_header: list[str] = []
    joined: dict[str, list[str]] = {}
    order: list[str] = []
    for sheet in sheets:
        frame = pd.read_excel(io.BytesIO(data), sheet_name=sheet, header=None, dtype=object)
        rows = [["" if (isinstance(v, float) and v != v) or v is None else str(v) for v in row]
                for row in frame.itertuples(index=False)]
        header, body = _split_header(rows, reader["idColumn"], _title_rows(reader))
        if len(sheets) == 1:
            return header, body
        # A blank header stays blank: an unnamed column is never a sample.
        names = [f"{name} :: {sheet}" if name else "" for name in header[1:]]
        if not joined_header:
            joined_header = [header[0]]
        joined_header.extend(names)
        for row in body:
            identifier = row[0].strip()
            if identifier not in joined:
                joined[identifier] = [identifier]
                order.append(identifier)
            joined[identifier].extend(row[1:])
    width = len(joined_header)
    # An identifier a sheet lacks keeps its row with the missing cells blank.
    return joined_header, [joined[i] + [""] * (width - len(joined[i])) for i in order]


def read_dtaselect(data: bytes, members: list[str], count_column: str = "Spectrum Count") -> tuple[list[str], list[list[str]]]:
    """Read DTASelect filter reports, one archive member per run, into one table.

    A DTASelect report lists each protein on a line of its own (``Locus``,
    ``Sequence Count``, ``Spectrum Count``, ...) followed by its peptide lines,
    and closes with summary rows. Only the protein lines are read: a locus of
    the UniProt FASTA form ``ACCESSION_ENTRY_ORGANISM`` becomes its accession, a
    reversed-sequence decoy (``Reverse_``) is dropped, and any other locus (a
    contaminant, an introduced gene) keeps its name and fails to map later.
    Each member becomes one column named by its file stem holding that run's
    count; a protein a run does not list has a blank cell there, so the layer
    mean covers only proteins every replicate identified.
    """
    import zipfile  # noqa: PLC0415 - only for archived deposits

    columns: list[str] = []
    counts: dict[str, dict[str, str]] = {}
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        for member in members:
            stem = Path(member).stem
            if stem in counts:
                raise ValueError(f"two DTASelect members share the name {stem!r}")
            columns.append(stem)
            counts[stem] = _dtaselect_counts(archive.read(member).decode("utf-8"), count_column, member)
    order: list[str] = []
    for stem in columns:
        order.extend(identifier for identifier in counts[stem] if identifier not in order)
    rows = [[identifier] + [counts[stem].get(identifier, "") for stem in columns] for identifier in order]
    return ["Locus"] + columns, rows


def _dtaselect_counts(text: str, count_column: str, member: str) -> dict[str, str]:
    """One report's protein count column keyed by accession, decoys dropped."""
    lines = text.splitlines()
    start = next((index for index, line in enumerate(lines) if line.startswith("Locus\t")), None)
    header = lines[start].split("\t") if start is not None else []
    if count_column not in header:
        raise ValueError(f"{member}: no DTASelect protein header names {count_column!r}")
    position = header.index(count_column)
    out: dict[str, str] = {}
    for line in lines[start + 1:]:
        fields = line.split("\t")
        # A protein line is as wide as the header and holds an integer count;
        # a peptide line starts with "*" or a blank, and the summary rows are
        # narrower.
        if not fields[0] or fields[0] == "*" or len(fields) < len(header) or not fields[position].isdigit():
            continue
        locus = fields[0]
        if locus.startswith(DTASELECT_DECOY_PREFIX):
            continue
        match = UNIPROT_ACCESSION.match(locus)
        identifier = match.group(1) if match else locus
        if identifier in out:
            raise ValueError(f"{member}: {identifier} is listed twice")
        out[identifier] = fields[position]
    if not out:
        raise ValueError(f"{member}: no protein lines")
    return out


def _title_rows(reader: Mapping[str, Any]) -> list[int]:
    """The block-title rows a reader names, in priority order; empty for a plain table."""
    if reader.get("blockTitleRows"):
        return list(reader["blockTitleRows"])
    return [reader["blockTitleRow"]] if reader.get("blockTitleRow") else []


def _block_titles(rows: list[list[str]], title_rows: list[int], width: int) -> list[str]:
    """Per column, the nearest block title to its left in the first title row that has one."""
    carried: list[list[str]] = []
    for row_number in title_rows:
        cells = [cell.strip() for cell in rows[row_number - 1]] if row_number - 1 < len(rows) else []
        current = ""
        titles = []
        for position in range(width):
            if position < len(cells) and cells[position]:
                current = cells[position]
            titles.append(current)
        carried.append(titles)
    return [next((titles[position] for titles in carried if titles[position]), "") for position in range(width)]


def _split_header(rows: list[list[str]], id_column: str, title_rows: list[int]) -> tuple[list[str], list[list[str]]]:
    """Find the header row, prefix repeated headers with their block title, and front the identifier."""
    for index, row in enumerate(rows):
        header = [cell.strip() for cell in row]
        if id_column not in header:
            continue
        if title_rows:
            titles = _block_titles(rows, title_rows, len(header))
            for position, title in enumerate(titles):
                if title and header[position] and header[position] != id_column:
                    header[position] = f"{title} :: {header[position]}"
        id_index = header.index(id_column)
        body = [r for r in rows[index + 1:] if len(r) > id_index and r[id_index].strip()]
        # The identifier is moved to the front so every later step reads column 0.
        return [header[id_index]] + header[:id_index] + header[id_index + 1:], \
            [[r[id_index]] + r[:id_index] + r[id_index + 1:] for r in body]
    raise ValueError(f"no header row names {id_column!r}")


def select_identifiers(rows: list[list[str]], pattern: str | None) -> tuple[list[list[str]], int]:
    """Keep the rows whose identifier matches ``pattern`` and name each by its first group.

    A deposit may list features that are not genes (``predicted RNA`` rows, novel
    transcripts) or wrap every locus tag in a feature prefix (``gene-``). A row
    outside the pattern is dropped and counted as an identifier that did not
    map; a capture group names the identifier the crosswalk reads. Without a
    pattern every row is kept as it is.
    """
    if not pattern:
        return rows, 0
    regex = re.compile(pattern)
    kept: list[list[str]] = []
    dropped = 0
    for row in rows:
        match = regex.fullmatch(row[0].strip())
        if match is None:
            dropped += 1
            continue
        kept.append([match.group(1) if regex.groups else match.group(0)] + row[1:])
    return kept, dropped


def column_values(header: list[str], rows: list[list[str]], column: str, *, signed: bool = False) -> dict[str, float]:
    """One column as identifier → number, with blank cells skipped and ids stripped.

    A negative value is an error for an abundance and a fitness loss for a
    signed layer (``signed``).
    """
    try:
        position = header.index(column)
    except ValueError as error:
        raise ValueError(f"column {column!r} is not in the table") from error
    if header.count(column) > 1:
        raise ValueError(f"column {column!r} names {header.count(column)} columns; the table needs block titles")
    values: dict[str, float] = {}
    for row in rows:
        identifier = row[0].strip()
        cell = row[position].strip() if position < len(row) else ""
        if not cell or cell.lower() in ("na", "nan", "null"):
            continue
        value = float(cell)
        if not math.isfinite(value) or (value < 0 and not signed):
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


def layer_means(header: list[str], rows: list[list[str]], columns: list[str], method: str,
                *, signed: bool = False) -> dict[str, float]:
    """The per-identifier arithmetic mean over a layer's sample columns."""
    samples = [normalise(column_values(header, rows, column, signed=signed), method) for column in columns]
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


def load_uniprot_orf_names(path: Path) -> dict[str, str]:
    """UniProt accession → PCC 7942 ordered locus name, one-to-one only.

    An entry naming several ordered loci, or a locus named by several entries,
    is dropped: assigning either side would be a guess, as for the crosswalk.
    """
    forward: dict[str, str] = {}
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle, delimiter="\t"):
            names = row["Gene Names (ordered locus)"].split()
            if len(names) != 1 or not re.fullmatch(r"Synpcc7942_\d{4}", names[0]):
                continue
            forward[row["Entry"]] = names[0]
    counts: dict[str, int] = {}
    for locus in forward.values():
        counts[locus] = counts.get(locus, 0) + 1
    return {accession: locus for accession, locus in forward.items() if counts[locus] == 1}


def through_uniprot(values: Mapping[str, float], orf_names: Mapping[str, str]) -> tuple[dict[str, float], int]:
    """Re-key a UniProt-accession table by ordered locus name; the count is what did not map.

    A protein group naming several accessions (``;``-joined) is ambiguous and
    is dropped and counted, as is an accession UniProt gives no single locus.
    """
    out: dict[str, float] = {}
    unmapped = 0
    for accession, value in values.items():
        locus = orf_names.get(accession) if ";" not in accession else None
        if locus is None or locus in out:
            unmapped += 1
            continue
        out[locus] = value
    return out, unmapped


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
    # A layer may carry its own record where the study's condition sets differ.
    for axis, fields in layer.get("conditions", spec["conditions"]).items():
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
        "conditionTableRow": layer.get("conditionTableRow", spec.get("conditionTableRow")),
        "conditions": conditions,
    }
    validate_record(record, f"{spec['studyId']} layer {layer['id']}")
    return record


def ingest(spec: Mapping[str, Any], *, manifest_path: Path, crosswalk_path: Path, interim: Path,
           conditions_table: Path | None, out_dir: Path,
           uniprot_table: Path = DEFAULT_UNIPROT_TABLE) -> list[dict[str, Any]]:
    """Run the whole ingestion for one spec and return the manifest entries written."""
    source = spec["file"]
    data = fetch(source["url"], source["sha256"], interim / source["name"])
    header, rows = read_table(data, spec["reader"])
    rows, outside_pattern = select_identifiers(rows, spec["reader"].get("idPattern"))
    id_kind = spec["reader"]["idKind"]
    via_uniprot = id_kind == UNIPROT_ID_KIND
    relationship = ID_RELATIONSHIPS["pcc7942_old" if via_uniprot else id_kind]
    crosswalk = load_crosswalk(crosswalk_path, relationship)
    orf_names = load_uniprot_orf_names(uniprot_table) if via_uniprot else None
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.is_file() else []
    by_id = {entry["id"]: index for index, entry in enumerate(manifest)}
    written = []
    for layer in spec["layers"]:
        quotes, replicate_quote = condition_quotes(
            conditions_table, layer.get("conditionTableRow", spec.get("conditionTableRow")))
        means = layer_means(header, rows, layer["columns"], spec["normalization"],
                            signed=spec.get("signed", spec["dataType"] == "fitness"))
        no_locus = 0
        if via_uniprot:
            means, no_locus = through_uniprot(means, orf_names)
        mapped, unmapped = map_to_utex(means, crosswalk)
        unmapped += no_locus + outside_pattern
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
            "signed": spec.get("signed", spec["dataType"] == "fitness"),
            "ingest": {
                "sourceFile": source["name"], "sourceSha256": source["sha256"], "sourceUrl": source["url"],
                "columns": layer["columns"], "normalization": spec["normalization"],
                "mappedGenes": len(mapped), "unmappedIdentifiers": unmapped,
                "mappingRoute": (f"UniProt accession to ordered locus name in {uniprot_table.name}, then " if via_uniprot else "")
                + f"{relationship} in {crosswalk_path.name}, one-to-one rows only",
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
    parser.add_argument("--uniprot", type=Path, default=DEFAULT_UNIPROT_TABLE,
                        help="UniProt accession to ordered-locus table for a protein deposit")
    parser.add_argument("--out-dir", type=Path, default=None, help="where layer tables go (default: beside the manifest)")
    args = parser.parse_args(argv)
    spec = json.loads(args.spec.read_text(encoding="utf-8"))
    written = ingest(spec, manifest_path=args.manifest, crosswalk_path=args.crosswalk, interim=args.interim,
                     conditions_table=args.conditions, out_dir=args.out_dir or args.manifest.parent,
                     uniprot_table=args.uniprot)
    for entry in written:
        info = entry["ingest"]
        print(f"{entry['id']}: {info['mappedGenes']} genes mapped, {info['unmappedIdentifiers']} identifiers unmapped -> {entry['file']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
