#!/usr/bin/env python3
"""Run and validate a standalone TransTermHP pilot on the pinned UTEX genome."""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import math
import os
import platform
import re
import subprocess
import tempfile
from collections import Counter
from pathlib import Path
from typing import Iterable, TextIO
from urllib.parse import unquote


ASSEMBLY_ACCESSION = "GCF_000817325.1"
ASSEMBLY_NAME = "ASM81732v1"
ORGANISM = "Synechococcus elongatus UTEX 2973"
EXPECTED_REPLICON_LENGTHS = {
    "NZ_CP006471.1": 2_690_418,
    "NZ_CP006472.1": 46_366,
    "NZ_CP006473.1": 7_842,
}
EXPECTED_TOTAL_LENGTH = 2_744_626
EXPECTED_GENE_COUNT = 2_769
FASTA_SHA256 = "22a2b07881c1099c32454778de0e90b1c40f74f44c0f59e000507106c0deb567"
GFF_SHA256 = "7f606a08892b061667a1988cc05dee889a82f9407066dcf81010ec2e25bb215f"
TRANSTERM_VERSION = "2.09"
TRANSTERM_SOURCE_URL = "https://transterm.cbcb.umd.edu/transterm_hp_v2.09.zip"
TRANSTERM_SOURCE_SHA256 = "b636db1c0fe9731cc760d8f3639209d07f7f35309d83013cc9f9e40798ce8be0"
EXPTERM_SHA256 = "fce89a92ab487aaea5a54015e859e1fb5e31f4f9985c9df7831ee09a367db1fe"
DEFAULT_MIN_CONFIDENCE = 76
DEFAULT_SHUFFLE_SEED = 2973
MAX_HAIRPIN_NT = 59
SCORED_TAIL_NT = 15
LINEAR_SEAM_EXCLUSION_NT = MAX_HAIRPIN_NT + SCORED_TAIL_NT

FLOAT = r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?"
SEQUENCE_RE = re.compile(r"^SEQUENCE\s+(\S+).*\(length\s+(\d+)\)\s*$")
TERM_RE = re.compile(
    rf"^\s*TERM\s+(\d+)\s+(\d+)\s+-\s+(\d+)\s+([+-])\s+"
    rf"(\S+)\s+(\d+)\s+({FLOAT})\s+({FLOAT})\s+\|\s*(.*)$"
)
TSV_FIELDS = (
    "run", "id", "replicon", "start", "end", "strand", "raw_start",
    "raw_end", "tail_start", "tail_end", "scored_terminator_start",
    "scored_terminator_end", "confidence", "hairpin_score", "tail_score",
    "region_context", "notes",
)


class PilotError(ValueError):
    """A user-facing input, report, or execution contract failure."""


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _open_text(path: Path) -> TextIO:
    if path.suffix == ".gz":
        return gzip.open(path, "rt", encoding="utf-8", newline="")
    return path.open(encoding="utf-8", newline="")


def load_fasta(path: Path) -> dict[str, str]:
    """Read FASTA records and reject duplicate IDs or non-ACGT sequence."""
    sequences: dict[str, list[str]] = {}
    current: str | None = None
    try:
        with _open_text(path) as handle:
            for line_number, raw_line in enumerate(handle, 1):
                line = raw_line.strip()
                if not line:
                    continue
                if line.startswith(">"):
                    header = line[1:].split(maxsplit=1)
                    if not header:
                        raise PilotError(f"{path.name}:{line_number}: empty FASTA identifier")
                    identifier = header[0]
                    if identifier in sequences:
                        raise PilotError(f"{path.name}:{line_number}: duplicate FASTA ID {identifier}")
                    current = identifier
                    sequences[current] = []
                    continue
                if current is None:
                    raise PilotError(f"{path.name}:{line_number}: sequence before FASTA header")
                sequence = line.upper()
                unknown = sorted(set(sequence) - set("ACGT"))
                if unknown:
                    raise PilotError(
                        f"{path.name}:{line_number}: {current} contains unknown bases "
                        f"{''.join(unknown)}; this pilot requires A/C/G/T only"
                    )
                sequences[current].append(sequence)
    except (OSError, UnicodeError, EOFError) as error:
        raise PilotError(f"could not read FASTA {path.name}: {error}") from error
    if not sequences:
        raise PilotError(f"{path.name}: no FASTA records")
    joined = {identifier: "".join(parts) for identifier, parts in sequences.items()}
    empty = [identifier for identifier, sequence in joined.items() if not sequence]
    if empty:
        raise PilotError(f"{path.name}: empty FASTA records: {', '.join(empty)}")
    return joined


def _attributes(value: str) -> dict[str, str]:
    result: dict[str, str] = {}
    for item in value.split(";"):
        if not item:
            continue
        key, separator, raw_value = item.partition("=")
        if not separator or not key:
            raise PilotError(f"malformed GFF attribute {item!r}")
        if key in result:
            raise PilotError(f"duplicate GFF attribute {key}")
        result[key] = unquote(raw_value)
    return result


def load_gff_genes(
    path: Path, sequences: dict[str, str]
) -> tuple[list[dict[str, object]], dict[str, bool], str | None]:
    """Read one gene span per GFF gene feature in one-based coordinates."""
    genes: list[dict[str, object]] = []
    identifiers: set[str] = set()
    circular: dict[str, bool] = {}
    assembly: str | None = None
    try:
        with _open_text(path) as handle:
            for line_number, raw_line in enumerate(handle, 1):
                line = raw_line.rstrip("\n\r")
                if line.startswith("#!genome-build-accession "):
                    assembly = line.split("NCBI_Assembly:", 1)[-1].strip()
                    continue
                if not line or line.startswith("#"):
                    continue
                fields = line.split("\t")
                if len(fields) != 9:
                    raise PilotError(f"{path.name}:{line_number}: expected 9 GFF columns")
                seqid, _, feature_type, start_text, end_text, _, strand, _, attrs_text = fields
                if feature_type not in {"region", "gene"}:
                    continue
                if seqid not in sequences:
                    raise PilotError(f"{path.name}:{line_number}: unknown replicon {seqid}")
                try:
                    start = int(start_text)
                    end = int(end_text)
                except ValueError as error:
                    raise PilotError(f"{path.name}:{line_number}: non-integer coordinates") from error
                attrs = _attributes(attrs_text)
                if feature_type == "region":
                    if not 1 <= start <= end <= len(sequences[seqid]):
                        raise PilotError(
                            f"{path.name}:{line_number}: out-of-bounds interval "
                            f"{seqid}:{start}-{end}"
                        )
                    if seqid in circular:
                        raise PilotError(f"{path.name}:{line_number}: duplicate region {seqid}")
                    circular[seqid] = attrs.get("Is_circular", "false").lower() == "true"
                    continue
                sequence_length = len(sequences[seqid])
                wraps_origin = end > sequence_length
                if not 1 <= start <= sequence_length or end < start:
                    raise PilotError(
                        f"{path.name}:{line_number}: out-of-bounds interval "
                        f"{seqid}:{start}-{end}"
                    )
                if wraps_origin:
                    wrapped_end = end - sequence_length
                    if not circular.get(seqid) or not 1 <= wrapped_end < start:
                        raise PilotError(
                            f"{path.name}:{line_number}: out-of-bounds interval "
                            f"{seqid}:{start}-{end}"
                        )
                else:
                    wrapped_end = end
                if strand not in {"+", "-"}:
                    raise PilotError(f"{path.name}:{line_number}: gene has invalid strand {strand!r}")
                identifier = attrs.get("locus_tag") or attrs.get("ID") or attrs.get("Name")
                if not identifier:
                    raise PilotError(f"{path.name}:{line_number}: gene lacks an identifier")
                if identifier in identifiers:
                    raise PilotError(f"{path.name}:{line_number}: duplicate gene ID {identifier}")
                identifiers.add(identifier)
                genes.append({
                    "id": identifier,
                    "replicon": seqid,
                    "start": start,
                    "end": wrapped_end,
                    "strand": strand,
                    "wrapsOrigin": wraps_origin,
                    "sourceEnd": end,
                })
    except (OSError, UnicodeError, EOFError) as error:
        raise PilotError(f"could not read GFF {path.name}: {error}") from error
    if not genes:
        raise PilotError(f"{path.name}: no gene features")
    return genes, circular, assembly


def validate_pinned_utex(
    fasta_path: Path,
    gff_path: Path,
    sequences: dict[str, str],
    genes: list[dict[str, object]],
    circular: dict[str, bool],
    assembly: str | None,
) -> None:
    """Require the exact pinned native assembly and annotation inputs."""
    observed_lengths = {identifier: len(sequence) for identifier, sequence in sequences.items()}
    if observed_lengths != EXPECTED_REPLICON_LENGTHS:
        raise PilotError(
            f"FASTA replicons/lengths do not match pinned {ASSEMBLY_ACCESSION}: "
            f"{observed_lengths}"
        )
    if sum(observed_lengths.values()) != EXPECTED_TOTAL_LENGTH:
        raise PilotError("FASTA total length does not match pinned UTEX assembly")
    if assembly != ASSEMBLY_ACCESSION:
        raise PilotError(f"GFF assembly is {assembly!r}, expected {ASSEMBLY_ACCESSION}")
    if circular != {identifier: True for identifier in EXPECTED_REPLICON_LENGTHS}:
        raise PilotError("GFF must declare every pinned UTEX replicon circular")
    if len(genes) != EXPECTED_GENE_COUNT:
        raise PilotError(f"GFF has {len(genes)} genes, expected {EXPECTED_GENE_COUNT}")
    checks = (
        (fasta_path, FASTA_SHA256, "FASTA"),
        (gff_path, GFF_SHA256, "GFF"),
    )
    for path, expected, label in checks:
        observed = sha256_file(path)
        if observed != expected:
            raise PilotError(f"{label} SHA-256 {observed}, expected {expected}")


def deterministic_shuffle(sequence: str, seed: int, identifier: str) -> str:
    """Return a stable replicon-wise mononucleotide shuffle."""
    values = list(sequence)
    seed_bytes = str(seed).encode("ascii") + b"\0" + identifier.encode("utf-8")
    for index in range(len(values) - 1, 0, -1):
        digest = hashlib.sha256(seed_bytes + index.to_bytes(8, "big")).digest()
        selected = int.from_bytes(digest[:8], "big") % (index + 1)
        values[index], values[selected] = values[selected], values[index]
    result = "".join(values)
    if Counter(result) != Counter(sequence):
        raise AssertionError("shuffle changed nucleotide composition")
    return result


def sequence_sha256(sequence: str) -> str:
    return sha256_bytes(sequence.encode("ascii"))


def _write_fasta_files(directory: Path, sequences: dict[str, str], prefix: str) -> list[Path]:
    paths: list[Path] = []
    for identifier, sequence in sequences.items():
        path = directory / f"{prefix}-{identifier}.fasta"
        with path.open("w", encoding="ascii", newline="\n") as handle:
            handle.write(f">{identifier}\n")
            for offset in range(0, len(sequence), 80):
                handle.write(sequence[offset:offset + 80] + "\n")
        paths.append(path)
    return paths


def _write_coords(path: Path, genes: Iterable[dict[str, object]]) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        for gene in genes:
            if gene.get("wrapsOrigin"):
                sequence_length = EXPECTED_REPLICON_LENGTHS[str(gene["replicon"])]
                segments = ((int(gene["start"]), sequence_length), (1, int(gene["end"])))
                for part, (segment_start, segment_end) in enumerate(segments, 1):
                    if gene["strand"] == "-":
                        segment_start, segment_end = segment_end, segment_start
                    handle.write(
                        f"{gene['id']}__origin_part_{part}\t{segment_start}\t{segment_end}"
                        f"\t{gene['replicon']}\n"
                    )
                continue
            start = int(gene["start"])
            end = int(gene["end"])
            if gene["strand"] == "-":
                start, end = end, start
            handle.write(f"{gene['id']}\t{start}\t{end}\t{gene['replicon']}\n")


def run_transterm(
    binary: Path,
    expterm: Path,
    fasta_files: list[Path],
    coords: Path,
    min_confidence: int,
    timeout_seconds: int,
) -> str:
    command = [
        str(binary), "--all-context", "-S", "-p", str(expterm),
        "-c", str(min_confidence), *(str(path) for path in fasta_files), str(coords),
    ]
    try:
        result = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=timeout_seconds,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise PilotError(f"TransTermHP execution failed: {error}") from error
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip().replace("\n", " ")[:500]
        raise PilotError(f"TransTermHP exited {result.returncode}: {detail}")
    if not result.stdout.strip():
        raise PilotError("TransTermHP returned an empty report")
    return result.stdout


def parse_report(
    report: str,
    expected_lengths: dict[str, int],
    run_name: str,
) -> tuple[list[dict[str, object]], str]:
    """Parse and bounds-check a TransTermHP map report."""
    records: list[dict[str, object]] = []
    current: str | None = None
    seen_sequences: set[str] = set()
    seen_terms: set[tuple[str, int]] = set()
    banner = ""
    for line_number, line in enumerate(report.splitlines(), 1):
        if not banner and line.startswith("TransTermHP "):
            banner = line.strip()
        sequence_match = SEQUENCE_RE.match(line)
        if sequence_match:
            identifier, length_text = sequence_match.groups()
            if identifier not in expected_lengths:
                raise PilotError(f"report line {line_number}: unknown sequence {identifier}")
            if identifier in seen_sequences:
                raise PilotError(f"report line {line_number}: duplicate sequence block {identifier}")
            if int(length_text) != expected_lengths[identifier]:
                raise PilotError(f"report line {line_number}: wrong length for {identifier}")
            current = identifier
            seen_sequences.add(identifier)
            continue
        if not line.lstrip().startswith("TERM"):
            continue
        match = TERM_RE.match(line)
        if not match:
            raise PilotError(f"report line {line_number}: malformed TERM row")
        if current is None:
            raise PilotError(f"report line {line_number}: TERM row before SEQUENCE block")
        term_text, raw_start_text, raw_end_text, strand, context, confidence_text, \
            hairpin_text, tail_text, notes = match.groups()
        term_number = int(term_text)
        key = (current, term_number)
        if key in seen_terms:
            raise PilotError(f"report line {line_number}: duplicate TERM {current}:{term_number}")
        seen_terms.add(key)
        raw_start = int(raw_start_text)
        raw_end = int(raw_end_text)
        if strand == "+" and raw_start > raw_end:
            raise PilotError(f"report line {line_number}: plus-strand coordinates are reversed")
        if strand == "-" and raw_start < raw_end:
            raise PilotError(f"report line {line_number}: minus-strand coordinates are not reversed")
        start, end = sorted((raw_start, raw_end))
        length = expected_lengths[current]
        if not 1 <= start <= end <= length:
            raise PilotError(f"report line {line_number}: out-of-bounds hairpin interval")
        if strand == "+":
            tail_start, tail_end = end + 1, end + SCORED_TAIL_NT
        else:
            tail_start, tail_end = start - SCORED_TAIL_NT, start - 1
        if not 1 <= tail_start <= tail_end <= length:
            raise PilotError(f"report line {line_number}: out-of-bounds scored tail interval")
        confidence = int(confidence_text)
        hairpin_score = float(hairpin_text)
        tail_score = float(tail_text)
        if not 0 <= confidence <= 100:
            raise PilotError(f"report line {line_number}: confidence outside 0..100")
        if not math.isfinite(hairpin_score) or not math.isfinite(tail_score):
            raise PilotError(f"report line {line_number}: non-finite score")
        if not context or set(context) - set("GgTFRfrHN"):
            raise PilotError(f"report line {line_number}: invalid region context {context!r}")
        records.append({
            "id": f"{run_name}:{current}:TERM-{term_number}",
            "replicon": current,
            "rawTermNumber": term_number,
            "rawStart": raw_start,
            "rawEnd": raw_end,
            "start": start,
            "end": end,
            "strand": strand,
            "tailStart": tail_start,
            "tailEnd": tail_end,
            "scoredTerminatorStart": min(start, tail_start),
            "scoredTerminatorEnd": max(end, tail_end),
            "coordinateSystem": "one-based inclusive",
            "confidence": confidence,
            "hairpinScore": hairpin_score,
            "tailScore": tail_score,
            "regionContext": context,
            "notes": notes.strip(),
        })
    if not banner:
        raise PilotError("report is missing the TransTermHP banner")
    missing = set(expected_lengths) - seen_sequences
    if missing:
        raise PilotError(f"report is missing sequence blocks: {', '.join(sorted(missing))}")
    return records, banner


def summarize(records: list[dict[str, object]]) -> dict[str, object]:
    return {
        "total": len(records),
        "byStrand": dict(sorted(Counter(str(row["strand"]) for row in records).items())),
        "byReplicon": dict(sorted(Counter(str(row["replicon"]) for row in records).items())),
    }


def _run_document(
    name: str,
    sequences: dict[str, str],
    report: str,
    records: list[dict[str, object]],
) -> dict[str, object]:
    return {
        "name": name,
        "sequenceSha256ByReplicon": {
            identifier: sequence_sha256(sequence)
            for identifier, sequence in sequences.items()
        },
        "rawReportSha256": sha256_bytes(report.encode("utf-8")),
        "counts": summarize(records),
        "records": records,
    }


def build_payload(
    *,
    binary: Path,
    expterm: Path,
    source_archive: Path,
    fasta: Path,
    gff: Path,
    native_sequences: dict[str, str],
    control_sequences: dict[str, str],
    genes: list[dict[str, object]],
    native_report: str,
    control_report: str,
    native_records: list[dict[str, object]],
    control_records: list[dict[str, object]],
    banner: str,
    min_confidence: int,
    shuffle_seed: int,
) -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "method": "TransTermHP",
        "recordOrigin": "computed",
        "evidenceBasis": "proxy",
        "interpretation": "exploratory intrinsic-terminator predictions, not measured regulation",
        "coordinateContract": {
            "assembly": ASSEMBLY_ACCESSION,
            "basis": "native genomic",
            "system": "one-based inclusive",
            "reportedInterval": "hairpin only; TransTermHP excludes the tail from TERM coordinates",
            "scoredTailLengthNt": SCORED_TAIL_NT,
            "scoredTerminatorInterval": "union of the reported hairpin and adjacent 15-nt tail used by the source scoring function",
            "circularBoundaryPolicy": {
                "mode": "excluded",
                "reason": "TransTermHP linearizes each replicon and does not search across the origin",
                "conservativeExcludedSpanAtEachLinearizedEndNt": LINEAR_SEAM_EXCLUSION_NT,
                "maxHairpinLengthNt": MAX_HAIRPIN_NT,
                "scoredTailLengthNt": SCORED_TAIL_NT,
            },
        },
        "confidenceContract": {
            "field": "confidence",
            "range": [0, 100],
            "meaning": "TransTermHP random-sequence-background confidence using expterm.dat",
            "limitation": "raw model confidence; not a calibrated probability of biological termination in UTEX 2973",
            "hairpinAndTailScores": "lower is better according to the TransTermHP documentation",
        },
        "provenance": {
            "toolSource": {
                "version": TRANSTERM_VERSION,
                "url": TRANSTERM_SOURCE_URL,
                "archive": source_archive.name,
                "sha256": sha256_file(source_archive),
            },
            "toolRuntime": {
                "binary": binary.name,
                "binarySha256": sha256_file(binary),
                "banner": banner,
                "platform": platform.platform(),
                "python": platform.python_version(),
            },
            "model": {
                "file": expterm.name,
                "sha256": sha256_file(expterm),
            },
            "inputs": {
                "assembly": ASSEMBLY_ACCESSION,
                "assemblyName": ASSEMBLY_NAME,
                "organism": ORGANISM,
                "fasta": {"file": fasta.name, "sha256": sha256_file(fasta)},
                "gff": {"file": gff.name, "sha256": sha256_file(gff)},
                "repliconLengths": EXPECTED_REPLICON_LENGTHS,
                "geneFeatures": len(genes),
                "geneRowsPassedToTool": sum(
                    2 if gene.get("wrapsOrigin") else 1 for gene in genes
                ),
                "originWrappingGeneTransforms": [
                    {
                        "id": gene["id"],
                        "replicon": gene["replicon"],
                        "sourceVirtualStart": gene["start"],
                        "sourceVirtualEnd": gene["sourceEnd"],
                        "physicalSegments": [
                            [gene["start"], EXPECTED_REPLICON_LENGTHS[str(gene["replicon"])]],
                            [1, gene["end"]],
                        ],
                        "strand": gene["strand"],
                        "toolRepresentation": "two same-strand annotation segments",
                    }
                    for gene in genes if gene.get("wrapsOrigin")
                ],
            },
            "parameters": {
                "allContext": True,
                "printTerminatorSequences": False,
                "minimumConfidence": min_confidence,
                "otherSearchAndScoreParameters": "TransTermHP 2.09 defaults printed in each retained raw report",
            },
            "control": {
                "kind": "deterministic per-replicon mononucleotide shuffle",
                "algorithm": "SHA-256-indexed Fisher-Yates; composition preserved separately for each replicon",
                "seed": shuffle_seed,
                "interpretation": "null hit comparison, not a false-positive-rate estimate",
            },
        },
        "runs": [
            _run_document("native", native_sequences, native_report, native_records),
            _run_document("shuffled_control", control_sequences, control_report, control_records),
        ],
    }


def tsv_bytes(payload: dict[str, object]) -> bytes:
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=TSV_FIELDS, delimiter="\t", lineterminator="\n")
    writer.writeheader()
    for run in payload["runs"]:
        for record in run["records"]:
            writer.writerow({
                "run": run["name"],
                "id": record["id"],
                "replicon": record["replicon"],
                "start": record["start"],
                "end": record["end"],
                "strand": record["strand"],
                "raw_start": record["rawStart"],
                "raw_end": record["rawEnd"],
                "tail_start": record["tailStart"],
                "tail_end": record["tailEnd"],
                "scored_terminator_start": record["scoredTerminatorStart"],
                "scored_terminator_end": record["scoredTerminatorEnd"],
                "confidence": record["confidence"],
                "hairpin_score": record["hairpinScore"],
                "tail_score": record["tailScore"],
                "region_context": record["regionContext"],
                "notes": record["notes"],
            })
    return buffer.getvalue().encode("utf-8")


def _write_exclusive(path: Path, data: bytes) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        handle = path.open("xb")
    except FileExistsError as error:
        raise PilotError(f"refusing to overwrite {path}") from error
    except OSError as error:
        raise PilotError(f"could not create output {path}: {error}") from error
    try:
        with handle:
            handle.write(data)
    except BaseException as error:
        cleanup_note = ""
        try:
            path.unlink(missing_ok=True)
        except OSError as cleanup_error:
            cleanup_note = f"; partial output could not be removed: {cleanup_error}"
        if isinstance(error, OSError):
            raise PilotError(f"could not write output {path}: {error}{cleanup_note}") from error
        raise


def _validate_output_paths(outputs: list[Path], inputs: list[Path]) -> None:
    resolved_outputs = [path.resolve() for path in outputs]
    if len(set(resolved_outputs)) != len(resolved_outputs):
        raise PilotError("output paths must be distinct")
    input_paths = {path.resolve() for path in inputs}
    overlap = input_paths.intersection(resolved_outputs)
    if overlap:
        raise PilotError(f"output path would overwrite an input: {next(iter(overlap))}")
    existing = [path for path in outputs if path.exists()]
    if existing:
        raise PilotError(f"refusing to overwrite existing output {existing[0]}")


def run_pilot(arguments: argparse.Namespace) -> dict[str, object]:
    binary = arguments.transterm.resolve()
    expterm = arguments.expterm.resolve()
    source_archive = arguments.source_archive.resolve()
    fasta = arguments.fasta.resolve()
    gff = arguments.gff.resolve()
    outputs = [
        arguments.output_json, arguments.output_tsv,
        arguments.native_raw, arguments.control_raw,
    ]
    inputs = [binary, expterm, source_archive, fasta, gff]
    _validate_output_paths(outputs, inputs)
    for path in inputs:
        if not path.is_file():
            raise PilotError(f"missing input file {path}")
    if not os.access(binary, os.X_OK):
        raise PilotError(f"TransTermHP binary is not executable: {binary}")
    if not 0 <= arguments.min_confidence <= 100:
        raise PilotError("--min-confidence must be between 0 and 100")
    if arguments.timeout_seconds <= 0:
        raise PilotError("--timeout-seconds must be positive")
    if sha256_file(source_archive) != TRANSTERM_SOURCE_SHA256:
        raise PilotError("TransTermHP source archive SHA-256 does not match official 2.09 pin")
    if sha256_file(expterm) != EXPTERM_SHA256:
        raise PilotError("expterm.dat SHA-256 does not match official 2.09 archive")

    sequences = load_fasta(fasta)
    genes, circular, assembly = load_gff_genes(gff, sequences)
    validate_pinned_utex(fasta, gff, sequences, genes, circular, assembly)
    control_sequences = {
        identifier: deterministic_shuffle(sequence, arguments.shuffle_seed, identifier)
        for identifier, sequence in sequences.items()
    }

    with tempfile.TemporaryDirectory(prefix="regulatory-transterm-") as temporary:
        directory = Path(temporary)
        coords = directory / "utex.coords"
        _write_coords(coords, genes)
        native_fastas = _write_fasta_files(directory, sequences, "native")
        control_fastas = _write_fasta_files(directory, control_sequences, "control")
        native_report = run_transterm(
            binary, expterm, native_fastas, coords,
            arguments.min_confidence, arguments.timeout_seconds,
        )
        control_report = run_transterm(
            binary, expterm, control_fastas, coords,
            arguments.min_confidence, arguments.timeout_seconds,
        )

    lengths = {identifier: len(sequence) for identifier, sequence in sequences.items()}
    native_records, native_banner = parse_report(native_report, lengths, "native")
    control_records, control_banner = parse_report(
        control_report, lengths, "shuffled_control"
    )
    if native_banner != control_banner:
        raise PilotError("native and control reports have different runtime banners")
    payload = build_payload(
        binary=binary,
        expterm=expterm,
        source_archive=source_archive,
        fasta=fasta,
        gff=gff,
        native_sequences=sequences,
        control_sequences=control_sequences,
        genes=genes,
        native_report=native_report,
        control_report=control_report,
        native_records=native_records,
        control_records=control_records,
        banner=native_banner,
        min_confidence=arguments.min_confidence,
        shuffle_seed=arguments.shuffle_seed,
    )
    json_data = (json.dumps(payload, indent=2, sort_keys=True) + "\n").encode("utf-8")
    writes = (
        (arguments.native_raw, native_report.encode("utf-8")),
        (arguments.control_raw, control_report.encode("utf-8")),
        (arguments.output_tsv, tsv_bytes(payload)),
        (arguments.output_json, json_data),
    )
    created: list[Path] = []
    try:
        for path, data in writes:
            _write_exclusive(path, data)
            created.append(path)
    except BaseException:
        for path in created:
            path.unlink(missing_ok=True)
        raise
    return payload


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--transterm", type=Path, required=True, help="built TransTermHP binary")
    result.add_argument("--expterm", type=Path, required=True, help="official expterm.dat")
    result.add_argument("--source-archive", type=Path, required=True, help="official 2.09 ZIP")
    result.add_argument("--fasta", type=Path, required=True, help="pinned UTEX genomic FASTA")
    result.add_argument("--gff", type=Path, required=True, help="matching pinned UTEX GFF")
    result.add_argument("--output-json", type=Path, required=True)
    result.add_argument("--output-tsv", type=Path, required=True)
    result.add_argument("--native-raw", type=Path, required=True)
    result.add_argument("--control-raw", type=Path, required=True)
    result.add_argument("--min-confidence", type=int, default=DEFAULT_MIN_CONFIDENCE)
    result.add_argument("--shuffle-seed", type=int, default=DEFAULT_SHUFFLE_SEED)
    result.add_argument("--timeout-seconds", type=int, default=600)
    return result


def main() -> None:
    try:
        payload = run_pilot(parser().parse_args())
    except PilotError as error:
        raise SystemExit(f"error: {error}") from error
    counts = {run["name"]: run["counts"]["total"] for run in payload["runs"]}
    print(json.dumps({"status": "ok", "candidateCounts": counts}, sort_keys=True))


if __name__ == "__main__":
    main()
