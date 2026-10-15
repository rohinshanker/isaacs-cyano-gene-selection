"""Explicit, lossless reader for deposited GEO SOFT processed measurements.

``read_geo_soft`` returns JSON-compatible source entities, ordered metadata
entries (including repeated keys), positional tables and measurement records.
Values stay strings: no missing-value substitution, normalization, dye
orientation, logarithms or pooling occurs here. This does not recover physical
spots that a depositor already combined.

``project_geo_table`` is a separate, strict one-to-one platform join. It
requires an explicit platform and column. An optional identifier pattern is
matched whole. Blank mappings are audited, and ambiguous mappings fail.
"""

from __future__ import annotations

import gzip
import hashlib
import re
import zlib
from typing import Any


def _column(table: dict[str, Any], name: str, context: str) -> int:
    if table["header"].count(name) != 1:
        raise ValueError(f"{context}: table needs exactly one {name!r} column")
    return table["header"].index(name)


def _parse_soft(data: bytes, source_id: str) -> dict[str, Any]:
    if not isinstance(source_id, str) or not source_id.strip():
        raise ValueError("SOFT source_id must be a nonempty string")
    compressed = data.startswith(b"\x1f\x8b")
    try:
        payload = gzip.decompress(data) if compressed else data
        text = payload.decode("utf-8-sig")
    except (OSError, EOFError, UnicodeDecodeError, zlib.error) as error:
        raise ValueError(f"{source_id}: invalid gzip or UTF-8 SOFT input") from error
    source: dict[str, Any] = {
        "id": source_id, "sha256": hashlib.sha256(data).hexdigest(),
        "compression": "gzip" if compressed else "none", "entities": [],
    }
    entity = None
    in_table = False
    seen: set[tuple[str, str]] = set()

    def fail(line_number: int, message: str) -> None:
        raise ValueError(f"{source_id}:{line_number}: {message}")

    def finish(line_number: int) -> None:
        if in_table:
            fail(line_number, "unterminated SOFT table")
        if entity and entity["type"] in ("PLATFORM", "SAMPLE"):
            table = entity["table"]
            if table is None or not table["header"]:
                fail(line_number, f"{entity['id']}: missing table or header")
            required = ["ID"] if entity["type"] == "PLATFORM" else ["ID_REF", "VALUE"]
            for column in required:
                _column(table, column, entity["id"])
            counts = [item["value"] for item in entity["metadata"]
                      if item["key"] == f"{entity['type'].title()}_data_row_count"]
            if counts and (len(counts) != 1 or not re.fullmatch(r"\d+", counts[0])
                           or int(counts[0]) != len(table["rows"])):
                fail(line_number, f"{entity['id']}: invalid or mismatched data_row_count")
            index = _column(table, required[0], entity["id"])
            identifiers: set[str] = set()
            for row in table["rows"]:
                identifier = row[index]
                if not identifier or identifier != identifier.strip():
                    fail(line_number, f"{entity['id']}: empty or padded {required[0]}")
                if identifier in identifiers:
                    fail(line_number, f"{entity['id']}: duplicate {required[0]} {identifier!r}")
                identifiers.add(identifier)

    number = 0
    for number, line in enumerate(text.splitlines(), 1):
        if line in ("!sample_table_begin", "!platform_table_begin",
                    "!sample_table_end", "!platform_table_end"):
            kind = "SAMPLE" if line.startswith("!sample_") else "PLATFORM"
            if entity is None or entity["type"] != kind:
                fail(number, "table marker does not match its entity")
            if line.endswith("_begin"):
                if in_table or entity["table"] is not None:
                    fail(number, "duplicate or nested table begin")
                entity["table"] = {"header": [], "rows": [], "line": number}
                in_table = True
            else:
                if not in_table:
                    fail(number, "table end without begin")
                if not entity["table"]["header"]:
                    fail(number, "table has no header")
                in_table = False
            continue
        if in_table:
            if line.startswith(("!", "^", "#")):
                fail(number, "record or malformed marker inside table")
            table = entity["table"]
            cells = line.split("\t")
            if not table["header"]:
                if any(not cell or cell != cell.strip() for cell in cells):
                    fail(number, "empty or padded table heading")
                # GEO can repeat unrelated annotation headings. Keep their
                # positions; only columns used in joins must be unique.
                table["header"] = cells
            elif len(cells) != len(table["header"]):
                fail(number, f"row width {len(cells)} differs from header width {len(table['header'])}")
            else:
                table["rows"].append(cells)
            continue
        if not line:
            continue
        match = re.fullmatch(r"([!^#][^\s=]+)\s*=(?: )?(.*)", line)
        if not match:
            fail(number, "malformed SOFT record or data outside table")
        key, value = match.groups()
        if key.startswith("^"):
            finish(number)
            kind = key[1:]
            if kind not in ("DATABASE", "SERIES", "PLATFORM", "SAMPLE"):
                fail(number, f"unsupported SOFT entity {kind!r}")
            if not value or value != value.strip():
                fail(number, "empty or padded entity identifier")
            if (kind, value) in seen:
                fail(number, f"duplicate {kind} entity {value!r}")
            seen.add((kind, value))
            entity = {"type": kind, "id": value, "line": number,
                      "metadata": [], "columnDescriptions": [], "table": None}
            source["entities"].append(entity)
        else:
            if entity is None:
                fail(number, "metadata without entity")
            if key.startswith("!") and not key.startswith(f"!{entity['type'].title()}_"):
                fail(number, f"metadata does not match {entity['type']} entity")
            field = "metadata" if key.startswith("!") else "columnDescriptions"
            entity[field].append({"key": key[1:], "value": value, "line": number})
    finish(number + 1)
    if not source["entities"]:
        raise ValueError(f"{source_id}: no SOFT entities")
    return source


def read_geo_soft(
    data: bytes, *, source_id: str, platform_data: bytes | None = None,
    platform_source_id: str | None = None,
) -> dict[str, Any]:
    """Read a family file and optionally a separately pinned GPL family file.

    Every sample must name exactly one platform and every ID_REF must occur in
    that platform's unique ID column. Multiple platforms are retained with
    separate namespaces. A supplied GPL file supplements missing platforms;
    overlapping definitions are rejected rather than silently overriding one.
    SHA-256 pins refer to the original input bytes, including compression.
    The caller is responsible for verifying an expected pin before reading.
    """
    if (platform_data is None) != (platform_source_id is None):
        raise ValueError("platform_data and platform_source_id must be supplied together")
    sources = [_parse_soft(data, source_id)]
    if platform_data is not None:
        if platform_source_id == source_id:
            raise ValueError("primary and platform source IDs must differ")
        sources.append(_parse_soft(platform_data, platform_source_id))
    platforms = {}
    for source in sources:
        for entity in source["entities"]:
            if entity["type"] != "PLATFORM":
                continue
            if entity["id"] in platforms:
                raise ValueError(f"duplicate platform definition {entity['id']!r} across sources")
            table = entity["table"]
            index = _column(table, "ID", entity["id"])
            platforms[entity["id"]] = (
                source["id"], {row[index]: i for i, row in enumerate(table["rows"])},
            )
    if platform_data is not None and not any(
        entity["type"] == "PLATFORM" for entity in sources[1]["entities"]
    ):
        raise ValueError("separate GPL source contains no platform")
    samples = []
    measurements = []
    for entity in sources[0]["entities"]:
        if entity["type"] != "SAMPLE":
            continue
        membership = [item["value"] for item in entity["metadata"]
                      if item["key"] == "Sample_platform_id"]
        if len(membership) != 1 or membership[0] not in platforms:
            raise ValueError(f"{entity['id']}: needs exactly one known Sample_platform_id")
        platform_id = membership[0]
        platform_source, probes = platforms[platform_id]
        samples.append({"id": entity["id"], "platformId": platform_id, "sourceId": source_id})
        table = entity["table"]
        id_index = _column(table, "ID_REF", entity["id"])
        value_index = _column(table, "VALUE", entity["id"])
        for i, row in enumerate(table["rows"]):
            probe = row[id_index]
            if probe not in probes:
                raise ValueError(f"{entity['id']}: ID_REF {probe!r} absent from {platform_id}")
            measurements.append({
                "sourceId": source_id, "sampleId": entity["id"], "platformId": platform_id,
                "idRef": probe, "value": row[value_index], "sampleRow": i,
                "platformSourceId": platform_source, "platformRow": probes[probe],
            })
    if not samples:
        raise ValueError(f"{source_id}: no sample measurements")
    return {"schemaVersion": 1, "format": "geo-soft", "sources": sources,
            "samples": samples, "measurements": measurements}


def project_geo_table(
    document: dict[str, Any], *, platform_id: str, id_column: str,
    sample_ids: list[str] | None = None, identifier_pattern: str | None = None,
) -> tuple[list[str], list[list[str]], dict[str, Any]]:
    """Expose sample columns only after an exact unique platform mapping.

    An optional identifier pattern matches the whole cell, with no extraction
    or splitting. Repeated mappings and multi-locus cells fail;
    blank mappings are counted and excluded. Unmeasured probes produce blank
    cells. Deposited missing-value tokens and signed values stay verbatim.
    """
    available = {sample["id"]: sample for sample in document["samples"]}
    if sample_ids is None:
        sample_ids = [sample["id"] for sample in document["samples"]
                      if sample["platformId"] == platform_id]
    if (not isinstance(sample_ids, list) or not sample_ids
            or any(not isinstance(sample, str) or not sample for sample in sample_ids)
            or len(set(sample_ids)) != len(sample_ids)):
        raise ValueError("sample_ids must be a nonempty list of unique sample IDs")
    if any(sample not in available or available[sample]["platformId"] != platform_id
           for sample in sample_ids):
        raise ValueError("selected samples must belong to the explicitly selected platform")
    if id_column in sample_ids:
        raise ValueError("identifier heading collides with a sample ID")
    candidates = [entity for source in document["sources"] for entity in source["entities"]
                  if entity["type"] == "PLATFORM" and entity["id"] == platform_id]
    if len(candidates) != 1:
        raise ValueError(f"needs exactly one platform {platform_id!r}")
    table = candidates[0]["table"]
    probe_column = _column(table, "ID", platform_id)
    mapped_column = _column(table, id_column, platform_id)
    pattern = re.compile(identifier_pattern) if identifier_pattern else None
    mapping = {}
    used = set()
    blank = []
    for row in table["rows"]:
        probe, identifier = row[probe_column], row[mapped_column]
        if not identifier.strip():
            blank.append(probe)
            continue
        if (identifier != identifier.strip()
                or (id_column != "ID" and re.search(r"\s|;|,|\||/", identifier))
                or (pattern and not pattern.fullmatch(identifier))):
            raise ValueError(f"{platform_id}: non-atomic or invalid {id_column} {identifier!r}")
        if identifier in used:
            raise ValueError(f"{platform_id}: repeated {id_column} mapping {identifier!r}")
        used.add(identifier)
        mapping[probe] = identifier
    columns = {sample: {} for sample in sample_ids}
    order = {}
    dropped = set()
    dropped_by_sample: dict[str, list[str]] = {sample: [] for sample in sample_ids}
    for measurement in document["measurements"]:
        sample, probe = measurement["sampleId"], measurement["idRef"]
        if sample not in columns:
            continue
        if probe not in mapping:
            dropped.add(probe)
            dropped_by_sample[sample].append(probe)
            continue
        if probe in columns[sample]:
            raise ValueError(f"{sample}: duplicate measurement {probe!r}")
        order.setdefault(probe, None)
        columns[sample][probe] = measurement["value"]
    rows = [[mapping[probe]] + [columns[sample].get(probe, "") for sample in sample_ids]
            for probe in order]
    audit = {
        "platformId": platform_id, "idColumn": id_column, "sampleIds": sample_ids,
        "platformProbes": len(table["rows"]), "blankMappingProbeIds": blank,
        "mappedProbes": len(rows), "unmappedProbes": len(dropped),
        "unmappedProbeIds": sorted(dropped),
        "unmappedProbeIdsBySample": dropped_by_sample,
    }
    return [id_column] + sample_ids, rows, audit
