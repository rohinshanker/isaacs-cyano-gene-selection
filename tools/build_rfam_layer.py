#!/usr/bin/env python3
"""Builds the published RF01116 / Yfr1 family-homology browser layer.

The layer is produced only from a fresh run of the pinned native pilot in
``tools/regulatory_rfam.py`` (``run_pilot``): the same input, model and
Infernal pins, origin-junction search, shuffled control and integrity checks.
There is no option to admit an existing report or a hand-entered row.

Every GA hit the pilot reports becomes one site, including truncated hits and
origin-spanning hits (``position > endPosition`` is the wrap). Sites keep the
pilot row unchanged under ``raw``; ``provenance`` is the complete pilot report
with local absolute tool and model paths reduced to basenames. Nothing is
joined to a gene.

See docs/validation/regulatory-rfam.md for the pilot contract and runbook.
"""

from __future__ import annotations

import argparse
import copy
import csv
import dataclasses
import io
import json
import os
import re
from pathlib import Path
from typing import Any

import regulatory_rfam as rr

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FASTA = ROOT / "data/raw/GCF_000817325.1_ASM81732v1_genomic.fna.gz"
DEFAULT_GBFF = ROOT / "data/raw/GCF_000817325.1_ASM81732v1_genomic.gbff.gz"
DEFAULT_CMSEARCH = Path("/opt/miniconda3/envs/trna-validate/bin/cmsearch")
DEFAULT_JSON = ROOT / "site/data/rfam_rf01116.json"
DEFAULT_TSV = ROOT / "site/data/rfam_rf01116.tsv"

SCHEMA_VERSION = 1
LAYER_ID = "rfam-rf01116"
LAYER_LABEL = "RF01116 / Yfr1 family homology"
ASSEMBLY = "GCF_000817325.1_ASM81732v1"
# The release the pinned model bytes were extracted from (receipt R5 of
# docs/validation/regulatory-rfam.md); tied to them by the pins check below.
RFAM_RELEASE = "15.1"
SITE_TYPE = "rnaFamily"
ORIGIN = "computed"
MEASUREMENT = "predicted"

TSV_COLUMNS = (
    "site_id",
    "source",
    "assembly",
    "rfam_release",
    "model_accession",
    "model_name",
    "ga_bits",
    "replicon",
    "strand",
    "native_start",
    "native_end",
    "native_length",
    "origin_spanning",
    "search_space",
    "search_target",
    "raw_seq_from",
    "raw_seq_to",
    "mdl_from",
    "mdl_to",
    "truncation",
    "score_bits",
    "evalue",
    "origin",
    "measurement",
)

# A token starting with "/" or a drive letter is a local absolute path.
_ABSOLUTE_PATH_RE = re.compile(r"(?:^|\s)(?:/[^\s/]|[A-Za-z]:[\\/])")


class RfamLayerError(ValueError):
    """Any refusal to build or write the layer."""


# --------------------------------------------------------------------------
# Provenance
# --------------------------------------------------------------------------


def _basename(value: str) -> str:
    return Path(value).name if os.path.isabs(value) else value


def _local_paths(value: Any, where: str = "provenance") -> list[str]:
    """Every string under ``value`` that still carries a local absolute path."""
    if isinstance(value, dict):
        return [
            found
            for key, item in value.items()
            for found in _local_paths(item, f"{where}.{key}")
        ]
    if isinstance(value, list):
        return [
            found
            for index, item in enumerate(value)
            for found in _local_paths(item, f"{where}[{index}]")
        ]
    if isinstance(value, str) and _ABSOLUTE_PATH_RE.search(value):
        return [f"{where}: {value}"]
    return []


def sanitized_provenance(report: dict[str, Any]) -> dict[str, Any]:
    """The complete pilot report with local tool/model paths reduced to basenames.

    Only ``tool.executable``, ``tool.resolvedExecutable`` and absolute
    arguments of each recorded ``argv`` change; digests, parameters and
    coordinates are copied as they are. Any absolute path left anywhere else
    refuses the build rather than publishing it.
    """
    provenance = copy.deepcopy(report)
    tool = provenance["tool"]
    for key in ("executable", "resolvedExecutable"):
        tool[key] = _basename(tool[key])
    searches = [
        provenance["nativeSearch"],
        provenance["originJunctionSearch"],
        *provenance["control"]["replicates"],
    ]
    for search in searches:
        search["argv"] = [_basename(argument) for argument in search["argv"]]
    leaked = _local_paths(provenance)
    if leaked:
        raise RfamLayerError(
            "the pilot report still carries local absolute paths:\n  "
            + "\n  ".join(leaked)
        )
    return provenance


# --------------------------------------------------------------------------
# Layer
# --------------------------------------------------------------------------


def producer_label(report: dict[str, Any]) -> str:
    """``Infernal <version> / Rfam <release> <accession>``, from the report itself."""
    version = report["tool"]["version"].split(" ", 1)[0]
    return f"Infernal {version} / Rfam {RFAM_RELEASE} {report['model']['accession']}"


def site_id(row: dict[str, Any]) -> str:
    return (
        f"{row['model_accession']}:{row['replicon']}:"
        f"{row['native_start']}:{row['native_end']}:{row['strand']}"
    )


def site_from_row(row: dict[str, Any], producer: str) -> dict[str, Any]:
    """One browser site; ``position > endPosition`` only for an origin wrap."""
    return {
        "id": site_id(row),
        "type": SITE_TYPE,
        "replicon": row["replicon"],
        "position": row["native_start"],
        "endPosition": row["native_end"],
        "strand": row["strand"],
        "origin": ORIGIN,
        "measurement": MEASUREMENT,
        "producer": producer,
        "scoreBits": row["score"],
        "evalue": row["evalue"],
        "truncation": row["trunc"],
        "modelStart": row["mdl_from"],
        "modelEnd": row["mdl_to"],
        "originSpanning": row["origin_spanning"],
        "raw": copy.deepcopy(row),
    }


def limitations(report: dict[str, Any]) -> list[str]:
    """Reader-facing boundaries, with coverage numbers taken from the report."""
    model = report["model"]
    coverage = report["searchCoverage"]
    junction = report["originJunctionSearch"]
    control = report["control"]
    family = f"Rfam {RFAM_RELEASE} {model['accession']} ({model['name']})"
    return [
        f"Exploratory computed homology: the {family} covariance model matched "
        f"native {ASSEMBLY} sequence at or above its gathering threshold of "
        f"{model['gatheringCutoff']} bits. Nothing here is measured in UTEX 2973.",
        "A family match is not a complete transcript, not demonstrated regulatory "
        "function and not a native interaction.",
        "Bit scores and E-values describe model fit and search space; they are "
        "not a calibrated biological probability.",
        f"A searched position without a site had no {model['accession']} match at "
        "or above the GA threshold. Other Rfam families were not evaluated, and no "
        "absence of regulation is inferred.",
        f"Sites describe the original native {ASSEMBLY} sequence. They are not "
        "recomputed for an active recoding scheme; comparison with a scheme is "
        "separate work.",
        f"Searched space: all {coverage['repliconCount']} replicons "
        f"({coverage['residues']} residues) end to end on both strands, plus a "
        f"{junction['windowBases']}-base origin junction for each of "
        f"{len(junction['searchedReplicons'])} circular replicons (model window "
        f"W={model['window']}). An origin-spanning site has position greater than "
        "endPosition.",
        f"Shuffled controls ({len(control['replicates'])} mononucleotide "
        "replicates) are linear only, with no origin-junction search; their hit "
        "count is a composition-matched null rate, not a biological "
        "false-positive rate.",
        "Truncated hits (truncation other than 'no') are kept as cmsearch reported "
        "them; their model interval is partial.",
        "Full native Yfr1 transcript ends and its interaction targets in UTEX 2973 "
        "remain unknown (I-SCI-1); this layer does not resolve them.",
        "No gene is assigned to a site: proximity to a gene does not establish "
        "ownership, transcription or regulation.",
        "Provenance reduces local absolute tool and model paths to file names; "
        "the executable and model are identified by their SHA-256 digests.",
    ]


def build_layer(
    report: dict[str, Any], pins: rr.PinnedIdentity | None = None
) -> dict[str, Any]:
    """The published layer for one verified pilot report.

    ``pins`` defaults to the production ``PINNED`` identity and is read at
    call time; the report must carry exactly that identity, so the family
    release and assembly labels can only describe the pinned inputs.
    """
    pins = rr.PINNED if pins is None else pins
    expected = {"verified": True, **dataclasses.asdict(pins)}
    if report.get("pinnedIdentity") != expected:
        raise RfamLayerError("the pilot report does not carry the pinned identity")
    if report.get("schemaVersion") != rr.SCHEMA_VERSION or report.get(
        "recordOrigin"
    ) != ORIGIN:
        raise RfamLayerError(
            f"expected a computed pilot report of schema {rr.SCHEMA_VERSION}"
        )
    producer = producer_label(report)
    sites = [site_from_row(row, producer) for row in report["hits"]]
    ids = [site["id"] for site in sites]
    duplicates = sorted({value for value in ids if ids.count(value) > 1})
    if duplicates:
        raise RfamLayerError(f"duplicate site ids: {duplicates}")
    model = report["model"]
    return {
        "schemaVersion": SCHEMA_VERSION,
        "id": LAYER_ID,
        "label": LAYER_LABEL,
        "origin": ORIGIN,
        "measurement": MEASUREMENT,
        "assembly": ASSEMBLY,
        "family": {
            "accession": model["accession"],
            "name": model["name"],
            "release": RFAM_RELEASE,
            "gaBits": model["gatheringCutoff"],
        },
        "sites": sites,
        "provenance": sanitized_provenance(report),
        "limitations": limitations(report),
    }


# --------------------------------------------------------------------------
# Serialisation
# --------------------------------------------------------------------------


def layer_json_text(layer: dict[str, Any]) -> str:
    return json.dumps(layer, indent=2, sort_keys=True) + "\n"


def _tsv_value(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def layer_tsv_text(layer: dict[str, Any], json_name: str) -> str:
    """Explicit site rows; the header comment points to the JSON provenance."""
    family = layer["family"]
    buffer = io.StringIO()
    buffer.write(
        f"# {layer['label']} ({layer['id']}): {layer['origin']} "
        f"{layer['measurement']} sites on {layer['assembly']}, one-based inclusive.\n"
        "# native_start > native_end is an origin-spanning wrap. raw_seq_from/"
        "raw_seq_to are as cmsearch emitted them on search_target.\n"
        "# Family homology only: not a transcript, regulatory function or gene "
        "assignment.\n"
        f"# Full provenance, controls and limitations: {json_name}\n"
    )
    writer = csv.writer(buffer, delimiter="\t", lineterminator="\n")
    writer.writerow(TSV_COLUMNS)
    for site in layer["sites"]:
        raw = site["raw"]
        writer.writerow(
            _tsv_value(value)
            for value in (
                site["id"],
                site["producer"],
                layer["assembly"],
                family["release"],
                family["accession"],
                family["name"],
                family["gaBits"],
                site["replicon"],
                site["strand"],
                site["position"],
                site["endPosition"],
                raw["native_length"],
                site["originSpanning"],
                raw["search_space"],
                raw["search_target"],
                raw["raw_seq_from"],
                raw["raw_seq_to"],
                site["modelStart"],
                site["modelEnd"],
                site["truncation"],
                site["scoreBits"],
                site["evalue"],
                site["origin"],
                site["measurement"],
            )
        )
    return buffer.getvalue()


def write_layer(layer: dict[str, Any], json_path: Path, tsv_path: Path) -> None:
    """Creates both files exclusively, or neither; never replaces a file."""
    pending = (
        (json_path, layer_json_text(layer)),
        (tsv_path, layer_tsv_text(layer, json_path.name)),
    )
    created: list[Path] = []
    try:
        for path, text in pending:
            path.parent.mkdir(parents=True, exist_ok=True)
            handle = path.open("x", encoding="utf-8", newline="")
            created.append(path)
            with handle:
                handle.write(text)
    except BaseException as error:
        for path in created:
            try:
                path.unlink(missing_ok=True)
            except OSError as cleanup_error:
                error.add_note(f"partial layer file not removed: {path}: {cleanup_error}")
        if isinstance(error, OSError):
            raise RfamLayerError(f"could not create the layer files: {error}") from error
        raise


# --------------------------------------------------------------------------
# Command line
# --------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--cm", type=Path, required=True, help="Rfam 15.1 RF01116.cm (SHA-256 pinned)"
    )
    parser.add_argument("--fasta", type=Path, default=DEFAULT_FASTA)
    parser.add_argument("--gbff", type=Path, default=DEFAULT_GBFF)
    parser.add_argument("--cmsearch", type=Path, default=DEFAULT_CMSEARCH)
    parser.add_argument(
        "--workdir",
        type=Path,
        required=True,
        help="fresh scratch directory for the raw pilot run; must not exist",
    )
    parser.add_argument("--json-out", type=Path, default=DEFAULT_JSON)
    parser.add_argument("--tsv-out", type=Path, default=DEFAULT_TSV)
    parser.add_argument("--control-replicates", type=int, default=5)
    parser.add_argument("--control-seed", type=int, default=20261012)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        rr.preflight_paths(
            inputs={
                "covariance model": args.cm,
                "genome FASTA": args.fasta,
                "GenBank flat file": args.gbff,
                "cmsearch executable": args.cmsearch,
            },
            outputs={
                "work directory": args.workdir,
                "layer JSON": args.json_out,
                "layer TSV": args.tsv_out,
            },
        )
        report = rr.run_pilot(
            cm_path=args.cm,
            fasta_path=args.fasta,
            gbff_path=args.gbff,
            workdir=args.workdir,
            cmsearch=args.cmsearch,
            control_replicates=args.control_replicates,
            control_seed=args.control_seed,
        )
        layer = build_layer(report)
        write_layer(layer, args.json_out, args.tsv_out)
    except (rr.RegulatoryRfamError, RfamLayerError) as error:
        raise SystemExit(f"error: {error}") from error
    counts = report["counts"]
    print(
        f"{layer['id']}: sites={len(layer['sites'])} "
        f"origin_spanning={counts['originSpanningHits']} "
        f"control_hits={counts['controlHitsTotal']} over "
        f"{counts['controlReplicates']} replicates"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
