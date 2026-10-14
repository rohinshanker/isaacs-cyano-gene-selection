#!/usr/bin/env python3
"""Compute non-release ViennaRNA local unpaired-segment probabilities for explicit native UTEX windows."""

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
from dataclasses import dataclass
from pathlib import Path
from typing import Any, TextIO


ASSEMBLY_ACCESSION = "GCF_000817325.1"
ORGANISM = "Synechococcus elongatus UTEX 2973"
VIENNARNA_VERSION = "2.7.2"
# Default model fields every run must start from; window, span and temperature
# are then set explicitly. Values are the installed 2.7.2 defaults (Turner 2004).
DEFAULT_MODEL = {
    "temperature": 37.0,
    "dangles": 2,
    "noLP": 0,
    "noGU": 0,
    "noGUclosure": 0,
    "special_hp": 1,
    "gquad": 0,
    "circ": 0,
    "energy_set": 0,
    "min_loop_size": 3,
    "salt": 1.021,
    "betaScale": 1.0,
    "logML": 0,
    "uniq_ML": 0,
    "pf_smooth": 1,
    "window_size": -1,
    "max_bp_span": -1,
}
# Detects a different energy parameter set loaded into the same process.
ENERGY_FINGERPRINT = (
    "GGGAAAUCCCGCGCAAGCGUUCGAAAGAACGCGG",
    "(((....)))......((((((....))))))..",
    -13.6,
)
MAX_WINDOW_NT = 10_000
MAX_WINDOWS = 1_000
MAX_SHUFFLE_REPLICATES = 100
MIN_PAIR_SPAN = DEFAULT_MODEL["min_loop_size"] + 2
TEMPERATURE_RANGE_C = (0.0, 100.0)
PROBABILITY_TOLERANCE = 1e-9
DEFAULT_SHUFFLE_SEED = 2973
WINDOW_FIELDS = ("window_id", "replicon", "start", "end", "strand", "anchor", "context")
WINDOW_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:+-]*$")
TSV_FIELDS = (
    "window_id", "replicon", "strand", "segment_length", "oriented_start",
    "oriented_end", "native_start", "native_end", "wraps_origin", "interior",
    "unpaired_probability",
)
COMPLEMENT = str.maketrans("ACGT", "TGCA")


class AccessibilityError(ValueError):
    """A user-facing input, runtime, or output contract failure."""


@dataclass(frozen=True)
class Pins:
    """Exact native assembly identity a run must match."""

    assembly: str
    fasta_sha256: str
    replicons: dict[str, tuple[int, bool]]  # id -> (length, circular)


# Topology as derived from the pinned flat file in docs/validation/regulatory-rfam.md.
PINNED = Pins(
    assembly=ASSEMBLY_ACCESSION,
    fasta_sha256="22a2b07881c1099c32454778de0e90b1c40f74f44c0f59e000507106c0deb567",
    replicons={
        "NZ_CP006471.1": (2_690_418, True),
        "NZ_CP006472.1": (46_366, True),
        "NZ_CP006473.1": (7_842, True),
    },
)


@dataclass(frozen=True)
class Window:
    """An explicit native interval, one-based inclusive; start > end crosses the origin."""

    window_id: str
    replicon: str
    start: int
    end: int
    strand: str
    anchor: int | None
    context: str
    length: int
    wraps_origin: bool


@dataclass(frozen=True)
class Parameters:
    segment_length: int
    folding_window: int
    max_bp_span: int
    temperature: float


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _open_text(path: Path) -> TextIO:
    if path.suffix == ".gz":
        return gzip.open(path, "rt", encoding="ascii", newline="")
    return path.open(encoding="ascii", newline="")


def load_fasta(path: Path) -> dict[str, str]:
    """Read FASTA records; reject duplicate IDs, empty records and non-ACGT bases."""
    records: dict[str, list[str]] = {}
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
                        raise AccessibilityError(f"{path.name}:{line_number}: empty FASTA identifier")
                    current = header[0]
                    if current in records:
                        raise AccessibilityError(f"{path.name}:{line_number}: duplicate FASTA ID {current}")
                    records[current] = []
                    continue
                if current is None:
                    raise AccessibilityError(f"{path.name}:{line_number}: sequence before FASTA header")
                bases = line.upper()
                unknown = sorted(set(bases) - set("ACGT"))
                if unknown:
                    raise AccessibilityError(
                        f"{path.name}:{line_number}: {current} contains non-ACGT bases {''.join(unknown)}"
                    )
                records[current].append(bases)
    except (OSError, UnicodeError, EOFError) as error:
        raise AccessibilityError(f"could not read FASTA {path.name}: {error}") from error
    if not records:
        raise AccessibilityError(f"{path.name}: no FASTA records")
    sequences = {identifier: "".join(parts) for identifier, parts in records.items()}
    empty = [identifier for identifier, sequence in sequences.items() if not sequence]
    if empty:
        raise AccessibilityError(f"{path.name}: empty FASTA records: {', '.join(empty)}")
    return sequences


def validate_assembly(fasta: Path, sequences: dict[str, str], pins: Pins) -> None:
    """Require the exact pinned FASTA bytes, replicon set, order and lengths."""
    problems = []
    observed_sha = sha256_file(fasta)
    if observed_sha != pins.fasta_sha256:
        problems.append(f"FASTA SHA-256 {observed_sha}, expected {pins.fasta_sha256}")
    observed = [(identifier, len(sequence)) for identifier, sequence in sequences.items()]
    expected = [(identifier, length) for identifier, (length, _) in pins.replicons.items()]
    if observed != expected:
        problems.append(f"replicons {observed}, expected {expected}")
    if problems:
        raise AccessibilityError(f"input is not pinned {pins.assembly}: " + "; ".join(problems))


def _window_length(start: int, end: int, replicon_length: int) -> int:
    return end - start + 1 if start <= end else replicon_length - start + 1 + end


def parse_windows(path: Path, pins: Pins) -> list[Window]:
    """Read and validate the explicit native window table."""
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as error:
        raise AccessibilityError(f"could not read windows {path.name}: {error}") from error
    reader = csv.reader(io.StringIO(text, newline=""), delimiter="\t")
    rows = list(reader)
    if not rows or tuple(rows[0]) != WINDOW_FIELDS:
        raise AccessibilityError(f"{path.name}: header must be {' '.join(WINDOW_FIELDS)}")
    windows: list[Window] = []
    identifiers: set[str] = set()
    intervals: set[tuple[str, int, int, str]] = set()
    for line_number, row in enumerate(rows[1:], 2):
        where = f"{path.name}:{line_number}"
        if len(row) != len(WINDOW_FIELDS):
            raise AccessibilityError(f"{where}: expected {len(WINDOW_FIELDS)} columns")
        window_id, replicon, start_text, end_text, strand, anchor_text, context = row
        if not WINDOW_ID_RE.match(window_id):
            raise AccessibilityError(f"{where}: invalid window_id {window_id!r}")
        if window_id in identifiers:
            raise AccessibilityError(f"{where}: duplicate window_id {window_id}")
        if replicon not in pins.replicons:
            raise AccessibilityError(f"{where}: replicon {replicon!r} is not in pinned {pins.assembly}")
        replicon_length, circular = pins.replicons[replicon]
        try:
            start = _strict_int(start_text)
            end = _strict_int(end_text)
            anchor = _strict_int(anchor_text) if anchor_text else None
        except ValueError as error:
            raise AccessibilityError(f"{where}: {error}") from error
        if not (1 <= start <= replicon_length and 1 <= end <= replicon_length):
            raise AccessibilityError(f"{where}: {replicon}:{start}-{end} is outside 1..{replicon_length}")
        if strand not in {"+", "-"}:
            raise AccessibilityError(f"{where}: strand must be + or -, got {strand!r}")
        wraps_origin = start > end
        if wraps_origin and not circular:
            raise AccessibilityError(f"{where}: start > end crosses the origin of linear {replicon}")
        length = _window_length(start, end, replicon_length)
        if length >= replicon_length:
            raise AccessibilityError(f"{where}: window must be shorter than replicon {replicon}")
        if length > MAX_WINDOW_NT:
            raise AccessibilityError(f"{where}: window length {length} exceeds {MAX_WINDOW_NT}")
        key = (replicon, start, end, strand)
        if key in intervals:
            raise AccessibilityError(f"{where}: duplicate interval {replicon}:{start}-{end}{strand}")
        window = Window(window_id, replicon, start, end, strand, anchor, context, length, wraps_origin)
        if anchor is not None:
            if not 1 <= anchor <= replicon_length or not _inside(window, anchor, replicon_length):
                raise AccessibilityError(f"{where}: anchor {anchor} is outside the window")
        identifiers.add(window_id)
        intervals.add(key)
        windows.append(window)
    if not windows:
        raise AccessibilityError(f"{path.name}: no windows")
    if len(windows) > MAX_WINDOWS:
        raise AccessibilityError(f"{path.name}: {len(windows)} windows exceed {MAX_WINDOWS}")
    return windows


def _strict_int(text: str) -> int:
    if not re.fullmatch(r"[0-9]+", text):
        raise ValueError(f"expected a positive decimal integer, got {text!r}")
    return int(text)


def _inside(window: Window, position: int, replicon_length: int) -> bool:
    return (position - window.start) % replicon_length < window.length


def native_position(window: Window, oriented: int, replicon_length: int) -> int:
    """Map a one-based oriented window index to its one-based native position."""
    if not 1 <= oriented <= window.length:
        raise AccessibilityError(f"oriented index {oriented} outside 1..{window.length}")
    offset = oriented - 1 if window.strand == "+" else window.length - oriented
    return (window.start - 1 + offset) % replicon_length + 1


def oriented_index(window: Window, position: int, replicon_length: int) -> int:
    """Inverse of native_position for a native position inside the window."""
    if not _inside(window, position, replicon_length):
        raise AccessibilityError(f"native position {position} is outside window {window.window_id}")
    offset = (position - window.start) % replicon_length
    return offset + 1 if window.strand == "+" else window.length - offset


def segment_native_interval(
    window: Window, oriented_end: int, segment_length: int, replicon_length: int
) -> tuple[int, int]:
    """Native (low, high) ends of an oriented segment; low > high means it crosses the origin."""
    first = native_position(window, oriented_end - segment_length + 1, replicon_length)
    last = native_position(window, oriented_end, replicon_length)
    return (first, last) if window.strand == "+" else (last, first)


def oriented_sequence(window: Window, sequences: dict[str, str]) -> str:
    """Native window DNA in transcript orientation (reverse complement on the minus strand)."""
    replicon = sequences[window.replicon]
    if window.wraps_origin:
        forward = replicon[window.start - 1:] + replicon[:window.end]
    else:
        forward = replicon[window.start - 1:window.end]
    if len(forward) != window.length:
        raise AccessibilityError(f"window {window.window_id} extracted {len(forward)} bases")
    return forward if window.strand == "+" else forward.translate(COMPLEMENT)[::-1]


def validate_parameters(
    parameters: Parameters, windows: list[Window], replicates: int, seed: int
) -> None:
    """Reject parameters that ViennaRNA would clamp silently or that are out of bounds."""
    u, w, span, temperature = (
        parameters.segment_length, parameters.folding_window,
        parameters.max_bp_span, parameters.temperature,
    )
    if u < 1:
        raise AccessibilityError("--segment-length must be at least 1")
    if w < MIN_PAIR_SPAN:
        raise AccessibilityError(f"--folding-window must be at least {MIN_PAIR_SPAN}")
    if u > w:
        raise AccessibilityError("--segment-length must not exceed --folding-window")
    if not MIN_PAIR_SPAN <= span <= w:
        raise AccessibilityError(f"--max-bp-span must be within {MIN_PAIR_SPAN}..--folding-window")
    low, high = TEMPERATURE_RANGE_C
    if not math.isfinite(temperature) or not low <= temperature <= high:
        raise AccessibilityError(f"--temperature must be finite and within {low}..{high} °C")
    short = [window.window_id for window in windows if window.length < w]
    if short:
        raise AccessibilityError(
            f"--folding-window {w} exceeds window length for: {', '.join(short)}"
        )
    if not 0 <= replicates <= MAX_SHUFFLE_REPLICATES:
        raise AccessibilityError(f"--shuffle-replicates must be within 0..{MAX_SHUFFLE_REPLICATES}")
    if seed < 0:
        raise AccessibilityError("--shuffle-seed must be non-negative")


def check_runtime(rna: Any) -> dict[str, object]:
    """Require ViennaRNA 2.7.2 with untouched default model and energy parameters."""
    version = getattr(rna, "__version__", None)
    if version != VIENNARNA_VERSION:
        raise AccessibilityError(f"ViennaRNA {version!r} found, expected {VIENNARNA_VERSION}")
    model = rna.md()
    changed = {
        name: getattr(model, name) for name, expected in DEFAULT_MODEL.items()
        if getattr(model, name) != expected
    }
    if changed:
        raise AccessibilityError(f"ViennaRNA default model changed: {changed}")
    sequence, structure, energy = ENERGY_FINGERPRINT
    observed_structure, observed_energy = rna.fold(sequence)
    if observed_structure != structure or round(observed_energy, 2) != energy:
        raise AccessibilityError(
            f"ViennaRNA energy fingerprint {observed_structure} {observed_energy}, "
            f"expected {structure} {energy}"
        )
    extension = getattr(getattr(rna, "_RNA", None), "__file__", None)
    return {
        "viennaRnaVersion": version,
        "extensionModule": Path(extension).name if extension else None,
        "extensionModuleSha256": sha256_file(Path(extension)) if extension else None,
        "python": platform.python_version(),
        "platform": platform.platform(),
    }


def unpaired_probabilities(rna: Any, sequence: str, parameters: Parameters) -> list[float | None]:
    """Return p[end] for oriented segments [end-u+1, end]; None marks undefined ends < u."""
    u = parameters.segment_length
    n = len(sequence)
    model = rna.md()
    model.window_size = parameters.folding_window
    model.max_bp_span = parameters.max_bp_span
    model.temperature = parameters.temperature
    compound = rna.fold_compound(sequence.replace("T", "U"), model, rna.OPTION_WINDOW)
    effective = compound.params.model_details
    observed = (effective.window_size, effective.max_bp_span, effective.temperature)
    requested = (parameters.folding_window, parameters.max_bp_span, parameters.temperature)
    if observed != requested:
        raise AccessibilityError(f"ViennaRNA used window/span/temperature {observed}, requested {requested}")
    calls: list[tuple[int, int, int, int, list[object]]] = []

    def collect(values, size, end, max_size, kind, data):  # never raises inside the C callback
        data.append((end, size, max_size, kind, list(values)))

    if not compound.probs_window(u, rna.PROBS_WINDOW_UP, collect, calls):
        raise AccessibilityError("ViennaRNA probs_window reported failure")
    ends = [call[0] for call in calls]
    if sorted(ends) != list(range(1, n + 1)):
        raise AccessibilityError("ViennaRNA did not report every segment end exactly once")
    expected_kind = rna.PROBS_WINDOW_UP | rna.ANY_LOOP
    probabilities: list[float | None] = [None] * (n + 1)
    for end, size, max_size, kind, values in calls:
        if kind != expected_kind or max_size != u or len(values) != u + 1 or size != min(u, end):
            raise AccessibilityError(f"unexpected ViennaRNA callback shape at segment end {end}")
        value = values[u]
        if end < u:
            if value is not None:
                raise AccessibilityError(f"ViennaRNA defined a value at padding end {end}")
            continue
        if not isinstance(value, float) or not math.isfinite(value) \
                or not -PROBABILITY_TOLERANCE <= value <= 1 + PROBABILITY_TOLERANCE:
            raise AccessibilityError(f"undefined or out-of-range probability {value!r} at segment end {end}")
        probabilities[end] = value
    return probabilities


def is_interior(oriented_end: int, parameters: Parameters, length: int) -> bool:
    """True when every folding window containing the segment lies inside the extracted window."""
    oriented_start = oriented_end - parameters.segment_length + 1
    return oriented_end >= parameters.folding_window \
        and oriented_start <= length - parameters.folding_window + 1


def deterministic_shuffle(sequence: str, key: str) -> str:
    """Composition-preserving SHA-256-indexed Fisher-Yates shuffle."""
    values = list(sequence)
    seed = key.encode("utf-8") + b"\0"
    for index in range(len(values) - 1, 0, -1):
        digest = hashlib.sha256(seed + index.to_bytes(8, "big")).digest()
        selected = int.from_bytes(digest[:8], "big") % (index + 1)
        values[index], values[selected] = values[selected], values[index]
    return "".join(values)


def summarize(probabilities: list[float | None], parameters: Parameters) -> dict[str, object]:
    length = len(probabilities) - 1
    valid = [(end, p) for end, p in enumerate(probabilities) if p is not None]
    interior = [p for end, p in valid if is_interior(end, parameters, length)]
    values = [p for _, p in valid]
    return {
        "validSegments": len(valid),
        "paddingEnds": parameters.segment_length - 1,
        "interiorSegments": len(interior),
        "mean": sum(values) / len(values),
        "min": min(values),
        "max": max(values),
        "interiorMean": sum(interior) / len(interior) if interior else None,
    }


def compute(
    rna: Any,
    windows: list[Window],
    sequences: dict[str, str],
    parameters: Parameters,
    replicates: int,
    seed: int,
    pins: Pins,
) -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    """Fold every native window and its shuffles; return window documents and TSV rows."""
    documents: list[dict[str, object]] = []
    rows: list[dict[str, object]] = []
    for window in windows:
        replicon_length = pins.replicons[window.replicon][0]
        native = oriented_sequence(window, sequences)
        probabilities = unpaired_probabilities(rna, native, parameters)
        native_summary = summarize(probabilities, parameters)
        shuffles = []
        shuffle_interior = []
        for replicate in range(1, replicates + 1):
            key = f"{seed}:{replicate}:{window.window_id}"
            shuffled = deterministic_shuffle(native, key)
            summary = summarize(unpaired_probabilities(rna, shuffled, parameters), parameters)
            shuffle_interior.append(summary["interiorMean"])
            shuffles.append({
                "replicate": replicate,
                "seedKey": key,
                "sequenceSha256": sha256_bytes(shuffled.encode("ascii")),
                "summary": summary,
            })
        native_interior = native_summary["interiorMean"]
        documents.append({
            "windowId": window.window_id,
            "replicon": window.replicon,
            "nativeStart": window.start,
            "nativeEnd": window.end,
            "strand": window.strand,
            "wrapsOrigin": window.wraps_origin,
            "length": window.length,
            "anchor": window.anchor,
            "anchorOrientedIndex": (
                oriented_index(window, window.anchor, replicon_length)
                if window.anchor is not None else None
            ),
            "context": window.context,
            "orientedSequenceSha256": sha256_bytes(native.encode("ascii")),
            "native": native_summary,
            "shuffles": shuffles,
            "comparison": {
                "statistic": "interior mean unpaired probability",
                "native": native_interior,
                "shuffleMean": (
                    sum(shuffle_interior) / len(shuffle_interior)
                    if shuffles and native_interior is not None else None
                ),
                "shufflesAtLeastNative": (
                    sum(value >= native_interior for value in shuffle_interior)
                    if shuffles and native_interior is not None else None
                ),
                "replicates": replicates,
                "meaning": "rank among composition-matched shuffles; not a calibrated p-value",
            },
        })
        for end, probability in enumerate(probabilities):
            if probability is None:
                continue
            native_start, native_end = segment_native_interval(
                window, end, parameters.segment_length, replicon_length
            )
            rows.append({
                "window_id": window.window_id,
                "replicon": window.replicon,
                "strand": window.strand,
                "segment_length": parameters.segment_length,
                "oriented_start": end - parameters.segment_length + 1,
                "oriented_end": end,
                "native_start": native_start,
                "native_end": native_end,
                "wraps_origin": "true" if native_start > native_end else "false",
                "interior": "true" if is_interior(end, parameters, window.length) else "false",
                "unpaired_probability": repr(probability),
            })
    return documents, rows


def tsv_bytes(rows: list[dict[str, object]]) -> bytes:
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=TSV_FIELDS, delimiter="\t", lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue().encode("utf-8")


def build_payload(
    *,
    runtime: dict[str, object],
    parameters: Parameters,
    pins: Pins,
    fasta: Path,
    windows_path: Path,
    sequences: dict[str, str],
    documents: list[dict[str, object]],
    tsv: bytes,
    tsv_rows: int,
    replicates: int,
    seed: int,
) -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "method": "ViennaRNA local unpaired-segment probability (fold_compound.probs_window, PROBS_WINDOW_UP)",
        "recordOrigin": "computed",
        "releaseStatus": "non-release pilot; not admitted to any browser layer",
        "interpretation": (
            "model probability that an oriented RNA segment is unpaired, averaged by ViennaRNA "
            "over local folding windows; not measured accessibility, binding, or a probability "
            "of regulatory function"
        ),
        "coordinateContract": {
            "assembly": pins.assembly,
            "system": "one-based inclusive native coordinates",
            "orientedWindow": "native window in transcript orientation; minus strand is the reverse complement",
            "segment": "oriented [oriented_end-segment_length+1, oriented_end]; ViennaRNA indexes by segment end",
            "plusStrand": "native = window start + oriented - 1",
            "minusStrand": "native = window start + window length - oriented",
            "origin": "start > end marks an interval crossing position 1 of a circular replicon",
            "padding": "segment ends below segment_length are undefined and never reported",
            "interior": "every folding window containing the segment lies inside the extracted window",
        },
        "runtime": runtime,
        "parameters": {
            "segmentLength": parameters.segment_length,
            "foldingWindow": parameters.folding_window,
            "maxBpSpan": parameters.max_bp_span,
            "temperatureC": parameters.temperature,
            "otherModelSettings": DEFAULT_MODEL | {
                "window_size": parameters.folding_window,
                "max_bp_span": parameters.max_bp_span,
                "temperature": parameters.temperature,
            },
            "energyParameters": "ViennaRNA 2.7.2 default (Turner 2004), checked by fingerprint",
            "energyFingerprint": {
                "sequence": ENERGY_FINGERPRINT[0],
                "structure": ENERGY_FINGERPRINT[1],
                "mfeKcalPerMol": ENERGY_FINGERPRINT[2],
            },
        },
        "inputs": {
            "assembly": pins.assembly,
            "organism": ORGANISM,
            "fasta": {"file": fasta.name, "sha256": pins.fasta_sha256},
            "replicons": {
                identifier: {
                    "length": length,
                    "circular": circular,
                    "sequenceSha256": sha256_bytes(sequences[identifier].encode("ascii")),
                }
                for identifier, (length, circular) in pins.replicons.items()
            },
            "windows": {
                "file": windows_path.name,
                "sha256": sha256_file(windows_path),
                "count": len(documents),
            },
        },
        "control": {
            "kind": "per-window mononucleotide shuffle of the oriented native sequence",
            "algorithm": "SHA-256-indexed Fisher-Yates keyed by seed:replicate:window_id",
            "seed": seed,
            "replicates": replicates,
            "limitation": "preserves length and base composition only, not dinucleotide stacking; "
                          "a null comparison, not a biological negative",
        },
        "windows": documents,
        "outputs": {"tsvSha256": sha256_bytes(tsv), "tsvRows": tsv_rows},
    }


def preflight_outputs(outputs: list[Path], inputs: list[Path]) -> None:
    """Refuse duplicate, input-overwriting, existing, or parentless output paths."""
    keys = [str(path.resolve()).casefold() for path in outputs]
    if len(set(keys)) != len(keys):
        raise AccessibilityError("output paths must be distinct")
    input_keys = {str(path.resolve()).casefold() for path in inputs}
    for path, key in zip(outputs, keys):
        if key in input_keys:
            raise AccessibilityError(f"output path would overwrite an input: {path}")
        if os.path.lexists(path):
            raise AccessibilityError(f"refusing to overwrite existing output {path}")
        if not path.parent.is_dir():
            raise AccessibilityError(f"output directory does not exist: {path.parent}")


def write_outputs(writes: list[tuple[Path, bytes]]) -> None:
    """Create every output exclusively; on any failure remove only files this call created."""
    created: list[Path] = []
    try:
        for path, data in writes:
            try:
                handle = path.open("xb")
            except OSError as error:
                raise AccessibilityError(f"could not create output {path}: {error}") from error
            created.append(path)
            with handle:
                handle.write(data)
    except BaseException as error:
        failures = []
        for path in created:
            try:
                path.unlink(missing_ok=True)
            except OSError as cleanup_error:
                failures.append(f"{path}: {cleanup_error}")
        if failures:
            error.add_note("partial outputs could not be removed: " + "; ".join(failures))
        if isinstance(error, OSError):
            raise AccessibilityError(f"could not write outputs: {error}") from error
        raise


def _run(arguments: argparse.Namespace, pins: Pins, rna: Any) -> dict[str, object]:
    fasta = arguments.fasta
    windows_path = arguments.windows
    outputs = [arguments.json_out, arguments.tsv_out]
    preflight_outputs(outputs, [fasta, windows_path])
    for path in (fasta, windows_path):
        if not path.is_file():
            raise AccessibilityError(f"missing input file {path}")
    runtime = check_runtime(rna)
    windows = parse_windows(windows_path, pins)
    parameters = Parameters(
        arguments.segment_length, arguments.folding_window,
        arguments.max_bp_span, float(arguments.temperature),
    )
    validate_parameters(parameters, windows, arguments.shuffle_replicates, arguments.shuffle_seed)
    sequences = load_fasta(fasta)
    validate_assembly(fasta, sequences, pins)
    documents, rows = compute(
        rna, windows, sequences, parameters,
        arguments.shuffle_replicates, arguments.shuffle_seed, pins,
    )
    tsv = tsv_bytes(rows)
    payload = build_payload(
        runtime=runtime, parameters=parameters, pins=pins, fasta=fasta,
        windows_path=windows_path, sequences=sequences, documents=documents,
        tsv=tsv, tsv_rows=len(rows), replicates=arguments.shuffle_replicates,
        seed=arguments.shuffle_seed,
    )
    json_data = (json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False) + "\n").encode("utf-8")
    write_outputs([(arguments.tsv_out, tsv), (arguments.json_out, json_data)])
    return payload


def run(arguments: argparse.Namespace) -> dict[str, object]:
    """Run against the pinned native UTEX assembly with the installed ViennaRNA."""
    try:
        import RNA
    except ImportError as error:
        raise AccessibilityError(f"ViennaRNA Python module is unavailable: {error}") from error
    return _run(arguments, PINNED, RNA)


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--fasta", type=Path, required=True, help="pinned UTEX genomic FASTA (.fna.gz)")
    result.add_argument("--windows", type=Path, required=True, help="explicit native window TSV")
    result.add_argument("--segment-length", type=int, required=True, help="unpaired segment length u")
    result.add_argument("--folding-window", type=int, required=True, help="local folding window W")
    result.add_argument("--max-bp-span", type=int, required=True, help="maximum base-pair span L")
    result.add_argument("--temperature", type=float, required=True, help="model temperature, °C")
    result.add_argument("--shuffle-replicates", type=int, default=0)
    result.add_argument("--shuffle-seed", type=int, default=DEFAULT_SHUFFLE_SEED)
    result.add_argument("--json-out", type=Path, required=True)
    result.add_argument("--tsv-out", type=Path, required=True)
    return result


def main(argv: list[str] | None = None) -> None:
    try:
        payload = run(parser().parse_args(argv))
    except AccessibilityError as error:
        raise SystemExit(f"error: {error}") from error
    print(json.dumps({
        "status": "ok",
        "windows": len(payload["windows"]),
        "tsvRows": payload["outputs"]["tsvRows"],
        "tsvSha256": payload["outputs"]["tsvSha256"],
    }, sort_keys=True))


if __name__ == "__main__":
    main()
