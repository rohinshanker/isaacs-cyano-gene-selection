#!/usr/bin/env python3
"""Searches the native pinned UTEX 2973 assembly with one pinned Rfam
regulatory covariance model, using Infernal cmsearch, plus a deterministic
shuffled-background control.

Scope and boundary
------------------
This is a single-family pilot: Rfam 15.1 ``RF01116`` (``Yfr1``,
"Cyanobacterial functional RNA 1"). It is not a scan of the Rfam library and
not comprehensive regulatory detection — no other family is searched, so a
genome position without a hit is outside this pilot's coverage, not a negative.

Every hit this tool reports is **exploratory computed evidence**: a covariance
model matched the native sequence above that family's Rfam gathering (GA) bit
score. That is sequence/structure homology to a curated family, never measured
regulation, demonstrated regulatory action, or a calibrated probability for
UTEX 2973. The shuffled control estimates a null hit rate for
composition-matched sequence; shuffled sequence is not a proven biological
negative.

Coordinates are reported on the native pinned assembly only, one-based and
inclusive, with strand. Nothing is transferred from a donor strain. The raw
cmsearch orientation endpoints (``seq from``/``seq to``, which run high-to-low
on the minus strand) are preserved alongside the normalised interval.

See docs/validation/regulatory-rfam.md for the retrieval receipts, the exact
commands, and how to reproduce a run from the official artifacts.
"""

from __future__ import annotations

import argparse
import csv
import dataclasses
import gzip
import hashlib
import json
import math
import random
import re
import subprocess
from pathlib import Path
from typing import Any, Iterable, Sequence

SCHEMA_VERSION = 1
PILOT_ID = "rfam-regulatory-family-native-utex"

# The Rfam-documented genome-annotation settings. --cut_ga applies the
# family-specific gathering threshold, and --rfam/--nohmmonly reproduce the
# search mode those thresholds were determined in, so the cutoff stays valid.
# See docs/validation/regulatory-rfam.md for the quoted source.
CMSEARCH_FLAGS = ("--cut_ga", "--rfam", "--nohmmonly")

# cmsearch's four truncation states for a hit against the target sequence.
TRUNCATION_STATES = frozenset({"no", "5'", "3'", "5'&3'"})

SEARCH_SPACE_NATIVE = "native_linear"
SEARCH_SPACE_JUNCTION = "origin_junction"
SEARCH_SPACE_CONTROL = "shuffled_control"

TBLOUT_COLUMNS = 17

_HIT_FIELDNAMES = (
    "replicon",
    "search_space",
    "model_accession",
    "model_name",
    "strand",
    "native_start",
    "native_end",
    "native_length",
    "raw_seq_from",
    "raw_seq_to",
    "mdl_from",
    "mdl_to",
    "trunc",
    "pipeline_pass",
    "gc",
    "bias",
    "score",
    "evalue",
    "inc",
    "origin_spanning",
)


class RegulatoryRfamError(ValueError):
    """Any refusal to produce a report: bad input, bad row, failed check."""


# --------------------------------------------------------------------------
# Digests
# --------------------------------------------------------------------------


def _digest_file(path: Path, algorithm: str) -> str:
    digest = hashlib.new(algorithm)
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_file(path: Path) -> str:
    return _digest_file(path, "sha256")


def md5_file(path: Path) -> str:
    """NCBI's assembly manifest publishes MD5s, so pinned inputs carry both."""
    return _digest_file(path, "md5")


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# --------------------------------------------------------------------------
# Inputs
# --------------------------------------------------------------------------


@dataclasses.dataclass(frozen=True)
class CovarianceModel:
    """The pinned family model, read from the model file's own header."""

    accession: str
    name: str
    description: str
    clen: int
    window: int
    gathering_cutoff: float
    format_line: str


@dataclasses.dataclass(frozen=True)
class Replicon:
    accession: str
    description: str
    length: int
    topology: str


def _open_text(path: Path):
    opener = gzip.open if path.suffix == ".gz" else open
    return opener(path, "rt", encoding="utf-8")


def require_file(path: Path, label: str) -> Path:
    if not path.exists():
        raise RegulatoryRfamError(f"missing {label}: {path}")
    if not path.is_file():
        raise RegulatoryRfamError(f"{label} is not a file: {path}")
    return path


def parse_covariance_model(cm_path: Path) -> CovarianceModel:
    """Reads the single-family header of an Infernal covariance model file.

    Refuses a file holding more than one model: this pilot pins exactly one
    family, and a multi-model file would silently broaden the search.
    """
    require_file(cm_path, "covariance model")
    fields: dict[str, str] = {}
    format_line = ""
    model_count = 0
    in_header = False
    with cm_path.open(encoding="utf-8") as handle:
        for line in handle:
            line = line.rstrip("\n")
            if line.startswith("INFERNAL"):
                model_count += 1
                if model_count > 1:
                    # Raised on sight rather than after a full read: the Rfam
                    # library itself is a multi-gigabyte multi-model file.
                    raise RegulatoryRfamError(
                        f"{cm_path} holds more than one model; this pilot pins "
                        "exactly one family and does not search the whole Rfam "
                        "library"
                    )
                format_line = line.strip()
                in_header = True
                continue
            if not in_header:
                continue
            if line.strip() == "CM":
                in_header = False  # Model body starts; the header is complete.
                continue
            parts = line.split(None, 1)
            if len(parts) == 2 and parts[0] not in fields:
                fields[parts[0]] = parts[1].strip()
    if model_count == 0:
        raise RegulatoryRfamError(f"no Infernal model found in {cm_path}")
    missing = [key for key in ("NAME", "ACC", "CLEN", "W", "GA") if key not in fields]
    if missing:
        raise RegulatoryRfamError(
            f"covariance model {cm_path} has no {', '.join(missing)} header line"
        )
    try:
        clen = int(fields["CLEN"])
        window = int(fields["W"])
        gathering_cutoff = float(fields["GA"].split()[0])
    except ValueError as error:
        raise RegulatoryRfamError(
            f"covariance model {cm_path} has an unreadable CLEN/W/GA header: {error}"
        ) from error
    if clen < 1 or window < 1:
        raise RegulatoryRfamError(
            f"covariance model {cm_path} declares CLEN={clen} W={window}; "
            "both must be at least 1"
        )
    if not math.isfinite(gathering_cutoff):
        raise RegulatoryRfamError(
            f"covariance model {cm_path} declares a non-finite GA threshold"
        )
    return CovarianceModel(
        accession=fields["ACC"],
        name=fields["NAME"],
        description=fields.get("DESC", ""),
        clen=clen,
        window=window,
        gathering_cutoff=gathering_cutoff,
        format_line=format_line,
    )


def load_fasta(fasta_path: Path) -> list[tuple[str, str, str]]:
    """Returns ``(id, description, uppercase sequence)`` in file order."""
    require_file(fasta_path, "sequence FASTA")
    records: list[tuple[str, str, str]] = []
    seen: set[str] = set()
    name: str | None = None
    description = ""
    chunks: list[str] = []

    def flush() -> None:
        if name is None:
            return
        sequence = "".join(chunks).upper()
        if not sequence:
            raise RegulatoryRfamError(f"FASTA record {name!r} has no sequence")
        records.append((name, description, sequence))

    with _open_text(fasta_path) as handle:
        for line in handle:
            line = line.rstrip("\n").rstrip("\r")
            if line.startswith(">"):
                flush()
                header = line[1:].split(None, 1)
                if not header or not header[0]:
                    raise RegulatoryRfamError(
                        f"FASTA record with no id in {fasta_path}"
                    )
                name = header[0]
                if name in seen:
                    raise RegulatoryRfamError(
                        f"duplicate FASTA sequence id {name!r} in {fasta_path}"
                    )
                seen.add(name)
                description = header[1] if len(header) == 2 else ""
                chunks = []
            elif line.strip():
                if name is None:
                    raise RegulatoryRfamError(
                        f"sequence line before any header in {fasta_path}"
                    )
                chunks.append(line.strip())
        flush()
    if not records:
        raise RegulatoryRfamError(f"no FASTA records in {fasta_path}")
    return records


_LOCUS_RE = re.compile(r"^LOCUS\s+(\S+)\s+\d+\s+bp.*?\b(circular|linear)\b")


def parse_locus_topologies(gbff_path: Path) -> dict[str, str]:
    """Maps full versioned accession -> ``circular``/``linear`` from a GBFF.

    The GBFF ``LOCUS`` line carries the topology but an unversioned name
    (``NZ_CP006471``), while the FASTA ids and every coordinate in this
    repository are versioned (``NZ_CP006471.1``). The ``VERSION`` line of the
    same record supplies the versioned accession, so the two are paired here
    rather than guessed by appending a version.
    """
    require_file(gbff_path, "GenBank flat file")
    topologies: dict[str, str] = {}
    pending: str | None = None
    with _open_text(gbff_path) as handle:
        for line in handle:
            match = _LOCUS_RE.match(line)
            if match:
                if pending is not None:
                    raise RegulatoryRfamError(
                        f"{gbff_path}: LOCUS {match.group(1)} follows a record with "
                        "no VERSION line"
                    )
                pending = match.group(2)
                continue
            if line.startswith("VERSION"):
                parts = line.split()
                if len(parts) < 2:
                    raise RegulatoryRfamError(f"{gbff_path}: empty VERSION line")
                if pending is None:
                    raise RegulatoryRfamError(
                        f"{gbff_path}: VERSION {parts[1]} has no preceding LOCUS "
                        "topology"
                    )
                topologies[parts[1]] = pending
                pending = None
    if pending is not None:
        raise RegulatoryRfamError(f"{gbff_path}: last LOCUS record has no VERSION line")
    if not topologies:
        raise RegulatoryRfamError(f"no LOCUS/VERSION records in {gbff_path}")
    return topologies


def build_replicons(
    records: Sequence[tuple[str, str, str]], topologies: dict[str, str]
) -> list[Replicon]:
    replicons: list[Replicon] = []
    for name, description, sequence in records:
        if name not in topologies:
            raise RegulatoryRfamError(
                f"sequence {name!r} has no topology in the pinned GenBank flat file; "
                "refusing to assume a replicon is linear or circular"
            )
        replicons.append(
            Replicon(
                accession=name,
                description=description,
                length=len(sequence),
                topology=topologies[name],
            )
        )
    return replicons


# --------------------------------------------------------------------------
# cmsearch tabular output
# --------------------------------------------------------------------------


@dataclasses.dataclass(frozen=True)
class TabularHit:
    """One data row of a cmsearch ``--tblout`` (format 1) file."""

    target: str
    target_accession: str
    query_name: str
    query_accession: str
    model_type: str
    mdl_from: int
    mdl_to: int
    seq_from: int
    seq_to: int
    strand: str
    trunc: str
    pipeline_pass: int
    gc: float
    bias: float
    score: float
    evalue: float
    inc: str
    description: str

    @property
    def native_start(self) -> int:
        """One-based inclusive start, lower coordinate on either strand."""
        return min(self.seq_from, self.seq_to)

    @property
    def native_end(self) -> int:
        """One-based inclusive end, higher coordinate on either strand."""
        return max(self.seq_from, self.seq_to)

    @property
    def native_length(self) -> int:
        return self.native_end - self.native_start + 1

    @property
    def identity(self) -> tuple[str, str, int, int]:
        return (self.target, self.strand, self.seq_from, self.seq_to)


def _parse_int(value: str, label: str, line_number: int) -> int:
    try:
        return int(value)
    except ValueError as error:
        raise RegulatoryRfamError(
            f"cmsearch row {line_number}: {label} {value!r} is not an integer"
        ) from error


def _parse_finite_float(value: str, label: str, line_number: int) -> float:
    try:
        parsed = float(value)
    except ValueError as error:
        raise RegulatoryRfamError(
            f"cmsearch row {line_number}: {label} {value!r} is not a number"
        ) from error
    if not math.isfinite(parsed):
        raise RegulatoryRfamError(
            f"cmsearch row {line_number}: {label} {value!r} is not finite"
        )
    return parsed


def parse_tblout(tblout_path: Path) -> list[TabularHit]:
    """Parses a cmsearch ``--tblout`` file strictly, rejecting malformed rows.

    Nothing is filtered here: every data row cmsearch emitted is returned, so
    no threshold beyond the family's own GA cutoff is ever applied.
    """
    require_file(tblout_path, "cmsearch tabular output")
    hits: list[TabularHit] = []
    with tblout_path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if line.startswith("#") or not line.strip():
                continue
            # The target description is the free-text last column and may
            # contain spaces, so only the fixed columns are split off.
            fields = line.rstrip("\n").split(None, TBLOUT_COLUMNS)
            if len(fields) < TBLOUT_COLUMNS:
                raise RegulatoryRfamError(
                    f"cmsearch row {line_number}: expected at least "
                    f"{TBLOUT_COLUMNS} columns, found {len(fields)}"
                )
            strand = fields[9]
            if strand not in ("+", "-"):
                raise RegulatoryRfamError(
                    f"cmsearch row {line_number}: strand {strand!r} is neither + nor -"
                )
            trunc = fields[10]
            if trunc not in TRUNCATION_STATES:
                raise RegulatoryRfamError(
                    f"cmsearch row {line_number}: unknown truncation state {trunc!r}"
                )
            seq_from = _parse_int(fields[7], "seq from", line_number)
            seq_to = _parse_int(fields[8], "seq to", line_number)
            if strand == "+" and seq_from > seq_to:
                raise RegulatoryRfamError(
                    f"cmsearch row {line_number}: plus-strand endpoints "
                    f"{seq_from}..{seq_to} run backwards"
                )
            if strand == "-" and seq_from < seq_to:
                raise RegulatoryRfamError(
                    f"cmsearch row {line_number}: minus-strand endpoints "
                    f"{seq_from}..{seq_to} run forwards; cmsearch reports the minus "
                    "strand high-to-low"
                )
            hits.append(
                TabularHit(
                    target=fields[0],
                    target_accession=fields[1],
                    query_name=fields[2],
                    query_accession=fields[3],
                    model_type=fields[4],
                    mdl_from=_parse_int(fields[5], "mdl from", line_number),
                    mdl_to=_parse_int(fields[6], "mdl to", line_number),
                    seq_from=seq_from,
                    seq_to=seq_to,
                    strand=strand,
                    trunc=trunc,
                    pipeline_pass=_parse_int(fields[11], "pass", line_number),
                    gc=_parse_finite_float(fields[12], "gc", line_number),
                    bias=_parse_finite_float(fields[13], "bias", line_number),
                    score=_parse_finite_float(fields[14], "score", line_number),
                    evalue=_parse_finite_float(fields[15], "E-value", line_number),
                    inc=fields[16],
                    description=fields[TBLOUT_COLUMNS].strip()
                    if len(fields) > TBLOUT_COLUMNS
                    else "",
                )
            )
    return hits


def tblout_rows_digest(tblout_path: Path) -> str:
    """SHA-256 over the data rows only, so the digest is run-independent.

    cmsearch writes the run date, the working directory and the full option
    line into the file's trailing comments, so the whole file never hashes
    the same twice. The data rows do.
    """
    require_file(tblout_path, "cmsearch tabular output")
    rows = [
        line
        for line in tblout_path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    ]
    if not rows:
        return sha256_text("")
    return sha256_text("\n".join(rows) + "\n")


# --------------------------------------------------------------------------
# Checks
# --------------------------------------------------------------------------


def validate_hits(
    hits: Sequence[TabularHit],
    model: CovarianceModel,
    lengths: dict[str, int],
    *,
    scope: str = "pinned assembly",
) -> list[str]:
    """Returns every integrity problem found; an empty list means all passed.

    ``lengths`` maps each searched sequence id to its length, so the same
    checker covers the native search, the origin-junction search and the
    shuffled control. These checks never drop a hit: a hit that fails one is a
    reason to refuse the whole report, because it means the run's identity or
    coordinates cannot be trusted.
    """
    problems: list[str] = []
    seen: dict[tuple[str, str, int, int], int] = {}
    for index, hit in enumerate(hits, start=1):
        where = (
            f"hit {index} "
            f"({hit.target}:{hit.native_start}-{hit.native_end}{hit.strand})"
        )
        if hit.query_accession != model.accession:
            problems.append(
                f"{where}: query accession {hit.query_accession!r} is not the pinned "
                f"model {model.accession!r}"
            )
        if hit.query_name != model.name:
            problems.append(
                f"{where}: query name {hit.query_name!r} is not the pinned model "
                f"{model.name!r}"
            )
        if hit.target not in lengths:
            problems.append(
                f"{where}: target sequence {hit.target!r} is not a sequence of the "
                f"{scope}"
            )
        elif hit.native_start < 1 or hit.native_end > lengths[hit.target]:
            problems.append(
                f"{where}: interval falls outside {hit.target} "
                f"(1..{lengths[hit.target]})"
            )
        if not 1 <= hit.mdl_from <= hit.mdl_to <= model.clen:
            problems.append(
                f"{where}: model interval {hit.mdl_from}..{hit.mdl_to} is not within "
                f"1..{model.clen}"
            )
        if hit.score < model.gathering_cutoff:
            problems.append(
                f"{where}: score {hit.score} is below the family GA threshold "
                f"{model.gathering_cutoff}, which --cut_ga should have excluded"
            )
        previous = seen.get(hit.identity)
        if previous is not None:
            problems.append(f"{where}: duplicates hit {previous} at the same interval")
        else:
            seen[hit.identity] = index
    return problems


def require_clean(problems: Sequence[str]) -> None:
    """Refuses the whole run when any integrity check failed."""
    if problems:
        raise RegulatoryRfamError(
            "cmsearch output failed integrity checks:\n  " + "\n  ".join(problems)
        )


def overlap_pairs(rows: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    """Overlapping native intervals among report rows on the same replicon.

    Strand is deliberately ignored: a plus- and a minus-strand hit covering the
    same bases is exactly the overlap a reader needs to see. Origin-spanning
    rows are excluded by the caller, because a wrapped interval is not a single
    range and would compare wrongly here.
    """
    pairs: list[dict[str, Any]] = []
    for left in range(len(rows)):
        for right in range(left + 1, len(rows)):
            first, second = rows[left], rows[right]
            if first["replicon"] != second["replicon"]:
                continue
            start = max(first["native_start"], second["native_start"])
            end = min(first["native_end"], second["native_end"])
            if start <= end:
                pairs.append(
                    {
                        "first": left,
                        "second": right,
                        "replicon": first["replicon"],
                        "interval": [start, end],
                    }
                )
    return pairs


# --------------------------------------------------------------------------
# Circular origin boundary
# --------------------------------------------------------------------------


def junction_flank(window: int) -> int:
    """Bases taken from each side of the origin for the junction sequence."""
    return max(window - 1, 0)


def junction_sequence(sequence: str, window: int) -> str:
    """The origin-spanning window of a circular replicon, 5' side first.

    A linear FASTA search cannot find an element that crosses position 1, so
    this pilot searches an explicit junction sequence as well. ``window`` is
    the model's own ``W`` (the longest hit Infernal will consider), so a
    ``W - 1`` flank on each side covers every interval that crosses the origin.
    """
    flank = junction_flank(window)
    if flank == 0:
        return ""
    if len(sequence) < 2 * flank:
        raise RegulatoryRfamError(
            f"sequence of {len(sequence)} bases is shorter than the "
            f"{2 * flank}-base origin junction window; a junction search would "
            "re-search the whole replicon"
        )
    return sequence[len(sequence) - flank :] + sequence[:flank]


def map_junction_position(position: int, length: int, window: int) -> int:
    """Maps a one-based junction coordinate onto the native replicon."""
    flank = junction_flank(window)
    if not 1 <= position <= 2 * flank:
        raise RegulatoryRfamError(
            f"junction position {position} is outside 1..{2 * flank}"
        )
    native = length - flank + position
    return native - length if native > length else native


def spans_origin(hit: TabularHit, window: int) -> bool:
    """True when a junction hit actually crosses the origin.

    A junction hit that stays on one side of the origin is the same hit the
    linear search already reported, so only crossing hits are new.
    """
    flank = junction_flank(window)
    return hit.native_start <= flank < hit.native_end


# --------------------------------------------------------------------------
# Running cmsearch
# --------------------------------------------------------------------------

_VERSION_RE = re.compile(r"^# INFERNAL\s+(\S+)\s+\((.+?)\)")


def cmsearch_version(cmsearch: Path) -> str:
    """Returns the Infernal version banner, proving which binary ran."""
    if not cmsearch.exists():
        raise RegulatoryRfamError(f"missing cmsearch executable: {cmsearch}")
    try:
        completed = subprocess.run(
            [str(cmsearch), "-h"], capture_output=True, text=True, check=False
        )
    except OSError as error:
        raise RegulatoryRfamError(f"cannot run {cmsearch}: {error}") from error
    for line in completed.stdout.splitlines():
        match = _VERSION_RE.match(line)
        if match:
            return f"{match.group(1)} ({match.group(2)})"
    raise RegulatoryRfamError(
        f"{cmsearch} did not report an Infernal version banner; it may not be cmsearch"
    )


def search_space_mb(total_residues: int) -> float:
    """Infernal's ``-Z``: millions of nucleotides searched, counting both strands.

    Rfam's genome-annotation procedure multiplies the residue count by two for
    the two strands and divides by a million, so reported E-values are accurate
    for a whole-genome, both-strand search.
    """
    if total_residues < 1:
        raise RegulatoryRfamError(
            f"cannot compute a search space from {total_residues} residues"
        )
    return round(2 * total_residues / 1_000_000, 6)


def cmsearch_argv(
    cmsearch: Path,
    cm_path: Path,
    target_fasta: Path,
    tblout_path: Path,
    stdout_path: Path,
    search_space: float,
) -> list[str]:
    """The exact, reproducible argument vector for one search.

    Both strands are searched: cmsearch does so by default and this pilot never
    passes --toponly or --bottomonly.
    """
    return [
        str(cmsearch),
        "-Z",
        f"{search_space:.6f}",
        *CMSEARCH_FLAGS,
        "--tblout",
        str(tblout_path),
        "-o",
        str(stdout_path),
        str(cm_path),
        str(target_fasta),
    ]


def run_cmsearch(argv: Sequence[str]) -> None:
    try:
        completed = subprocess.run(argv, capture_output=True, text=True, check=False)
    except OSError as error:
        raise RegulatoryRfamError(f"cannot run {argv[0]}: {error}") from error
    if completed.returncode != 0:
        raise RegulatoryRfamError(
            f"cmsearch exited {completed.returncode}: "
            f"{completed.stderr.strip() or completed.stdout.strip()}"
        )


# --------------------------------------------------------------------------
# Shuffled background control
# --------------------------------------------------------------------------


def control_seed_key(seed: int, replicate: int, accession: str) -> str:
    return f"{seed}:{replicate}:{accession}"


def shuffled_sequence(sequence: str, seed_key: str) -> str:
    """A composition-preserving mononucleotide shuffle, fixed by ``seed_key``.

    Deterministic: the same key always returns the same permutation. It
    preserves per-replicon base composition and length but not dinucleotide
    frequency or any structural propensity, so it estimates a null hit rate
    under matched composition only — never a biological false-positive rate.
    """
    bases = list(sequence)
    random.Random(seed_key).shuffle(bases)
    return "".join(bases)


def write_fasta(
    path: Path, records: Iterable[tuple[str, str]], width: int = 80
) -> None:
    """Writes ``(header, sequence)`` records at NCBI's 80-column line width.

    The header is written verbatim after ``>``, so the native copy keeps the
    pinned assembly's own descriptions and cmsearch echoes them back in the
    tabular output's description column.
    """
    if width < 1:
        raise RegulatoryRfamError(f"FASTA line width must be positive, got {width}")
    lines: list[str] = []
    for header, sequence in records:
        lines.append(f">{header}")
        lines.extend(
            sequence[start : start + width] for start in range(0, len(sequence), width)
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


# --------------------------------------------------------------------------
# Output files
# --------------------------------------------------------------------------


def prepare_directory(path: Path, label: str) -> Path:
    """Creates ``path`` as a directory, refusing a non-directory ancestor.

    ``Path.resolve`` normalises without touching the filesystem, so a file
    sitting where a parent directory is expected only fails at mkdir time —
    after earlier steps may already have written something.
    """
    for ancestor in reversed((path, *path.parents)):
        if ancestor.exists() and not ancestor.is_dir():
            raise RegulatoryRfamError(
                f"{label} {path}: {ancestor} exists and is not a directory"
            )
    path.mkdir(parents=True, exist_ok=True)
    return path


def check_writable(path: Path, overwrite: bool, label: str) -> None:
    if path.exists() and not overwrite:
        raise RegulatoryRfamError(
            f"{label} {path} already exists; pass --overwrite to replace it"
        )
    if path.exists() and not path.is_file():
        raise RegulatoryRfamError(f"{label} {path} exists and is not a file")
    prepare_directory(path.parent, f"parent directory of {label}")


def write_report(report: dict[str, Any], json_path: Path, tsv_path: Path) -> None:
    with tsv_path.open("w", encoding="utf-8", newline="") as handle:
        # csv defaults to CRLF even on POSIX, which reads as trailing
        # whitespace to `git diff --check`.
        writer = csv.DictWriter(
            handle, fieldnames=_HIT_FIELDNAMES, delimiter="\t", lineterminator="\n"
        )
        writer.writeheader()
        for row in report["hits"]:
            writer.writerow({key: row[key] for key in _HIT_FIELDNAMES})
    json_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", "utf-8")


# --------------------------------------------------------------------------
# Report
# --------------------------------------------------------------------------

EVIDENCE_BOUNDARY = (
    "Exploratory computed evidence: a pinned Rfam covariance model matched the "
    "native pinned UTEX 2973 assembly above that family's Rfam gathering (GA) "
    "bit score. This is homology to a curated RNA family, not measured "
    "regulation, not demonstrated regulatory activity, and not a calibrated "
    "probability for UTEX 2973. Shuffled-background hits estimate a null rate "
    "for composition-matched sequence and are not proven biological negatives."
)

COVERAGE_BOUNDARY = (
    "One family only (the pinned model). No other Rfam family was searched, so "
    "a position with no hit is uncovered by this pilot rather than negative. "
    "Covariance-model search finds homologues of a curated family and will miss "
    "unrelated or novel elements."
)


def _hit_row(
    hit: TabularHit,
    model: CovarianceModel,
    search_space: str,
    *,
    replicon: str,
    native_start: int,
    native_end: int,
    raw_seq_from: int,
    raw_seq_to: int,
    origin_spanning: bool,
) -> dict[str, Any]:
    return {
        "replicon": replicon,
        "search_space": search_space,
        "model_accession": model.accession,
        "model_name": model.name,
        "strand": hit.strand,
        "native_start": native_start,
        "native_end": native_end,
        "native_length": hit.native_length,
        "raw_seq_from": raw_seq_from,
        "raw_seq_to": raw_seq_to,
        "mdl_from": hit.mdl_from,
        "mdl_to": hit.mdl_to,
        "trunc": hit.trunc,
        "pipeline_pass": hit.pipeline_pass,
        "gc": hit.gc,
        "bias": hit.bias,
        "score": hit.score,
        "evalue": hit.evalue,
        "inc": hit.inc,
        "origin_spanning": origin_spanning,
        "coordinate_basis": "native pinned assembly, one-based inclusive, stranded",
    }


def linear_hit_rows(
    hits: Sequence[TabularHit],
    model: CovarianceModel,
    search_space: str = SEARCH_SPACE_NATIVE,
) -> list[dict[str, Any]]:
    """Report rows for a search over linear sequence, native or control."""
    return [
        _hit_row(
            hit,
            model,
            search_space,
            replicon=hit.target,
            native_start=hit.native_start,
            native_end=hit.native_end,
            raw_seq_from=hit.seq_from,
            raw_seq_to=hit.seq_to,
            origin_spanning=False,
        )
        for hit in hits
    ]


def junction_hit_rows(
    hits: Sequence[TabularHit],
    model: CovarianceModel,
    replicons: Sequence[Replicon],
    junction_ids: dict[str, str],
) -> tuple[list[dict[str, Any]], int]:
    """Origin-crossing junction hits, remapped to native circular coordinates.

    Returns the rows and the count of junction hits discarded because they do
    not cross the origin and the linear search therefore already found them.
    """
    by_junction_id = {
        junction_ids[replicon.accession]: replicon
        for replicon in replicons
        if replicon.accession in junction_ids
    }
    rows: list[dict[str, Any]] = []
    discarded = 0
    for hit in hits:
        replicon = by_junction_id.get(hit.target)
        if replicon is None:
            raise RegulatoryRfamError(
                f"junction search returned an unknown target {hit.target!r}"
            )
        if not spans_origin(hit, model.window):
            discarded += 1
            continue
        rows.append(
            _hit_row(
                hit,
                model,
                SEARCH_SPACE_JUNCTION,
                replicon=replicon.accession,
                native_start=map_junction_position(
                    hit.native_start, replicon.length, model.window
                ),
                native_end=map_junction_position(
                    hit.native_end, replicon.length, model.window
                ),
                raw_seq_from=map_junction_position(
                    hit.seq_from, replicon.length, model.window
                ),
                raw_seq_to=map_junction_position(
                    hit.seq_to, replicon.length, model.window
                ),
                origin_spanning=True,
            )
        )
    return rows, discarded


def build_report(
    *,
    model: CovarianceModel,
    model_path: Path,
    replicons: Sequence[Replicon],
    inputs: dict[str, dict[str, Any]],
    tool: dict[str, Any],
    search_space: float,
    native: dict[str, Any],
    junction: dict[str, Any],
    control: dict[str, Any],
) -> dict[str, Any]:
    native_rows = list(native["rows"])
    hits = native_rows + list(junction["rows"])
    overlaps = overlap_pairs(native_rows)
    return {
        "schemaVersion": SCHEMA_VERSION,
        "pilot": PILOT_ID,
        "recordOrigin": "computed",
        "evidenceBoundary": EVIDENCE_BOUNDARY,
        "coverageBoundary": COVERAGE_BOUNDARY,
        "model": {
            "accession": model.accession,
            "name": model.name,
            "description": model.description,
            "clen": model.clen,
            "window": model.window,
            "gatheringCutoff": model.gathering_cutoff,
            "formatLine": model.format_line,
            "file": model_path.name,
        },
        "tool": tool,
        "searchSpaceMb": search_space,
        "cmsearchFlags": list(CMSEARCH_FLAGS),
        "strandsSearched": "both",
        "inputs": inputs,
        "replicons": [dataclasses.asdict(replicon) for replicon in replicons],
        "nativeSearch": native["provenance"],
        "originJunctionSearch": junction["summary"],
        "control": control,
        "overlaps": overlaps,
        "counts": {
            "nativeLinearHits": len(native["rows"]),
            "originSpanningHits": len(junction["rows"]),
            "totalHits": len(hits),
            "overlappingNativePairs": len(overlaps),
            "controlReplicates": len(control["replicates"]),
            "controlHitsTotal": control["hitsTotal"],
        },
        "hits": hits,
    }


# --------------------------------------------------------------------------
# Pilot
# --------------------------------------------------------------------------


@dataclasses.dataclass(frozen=True)
class SearchRun:
    """One completed cmsearch: its hits and everything needed to record it."""

    hits: list[TabularHit]
    argv: list[str]
    fasta: Path
    tblout: Path

    def provenance(self) -> dict[str, Any]:
        """The reproducible record of this search: arguments and digests."""
        return {
            "argv": self.argv,
            "fasta": {"path": self.fasta.name, "sha256": sha256_file(self.fasta)},
            "tbloutRowsSha256": tblout_rows_digest(self.tblout),
            "hitCount": len(self.hits),
        }


@dataclasses.dataclass(frozen=True)
class SearchContext:
    """Everything every search in one run shares: tool, model, flags, space."""

    cmsearch: Path
    cm_path: Path
    workdir: Path
    model: CovarianceModel
    search_space: float

    def search(self, label: str, records: Sequence[tuple[str, str]]) -> SearchRun:
        """Writes a FASTA, runs one cmsearch over it, parses the hit table."""
        fasta = self.workdir / f"{label}.fna"
        write_fasta(fasta, records)
        tblout = self.workdir / f"{label}.tblout"
        argv = cmsearch_argv(
            self.cmsearch,
            self.cm_path,
            fasta,
            tblout,
            self.workdir / f"{label}.cmsearch",
            self.search_space,
        )
        run_cmsearch(argv)
        return SearchRun(parse_tblout(tblout), argv, fasta, tblout)


def resolve_model(
    cm_path: Path, expect_accession: str | None, expect_name: str | None
) -> CovarianceModel:
    """Reads the pinned model and refuses a family other than the expected one."""
    model = parse_covariance_model(cm_path)
    if expect_accession is not None and model.accession != expect_accession:
        raise RegulatoryRfamError(
            f"covariance model is {model.accession} ({model.name}), not the expected "
            f"{expect_accession}"
        )
    if expect_name is not None and model.name != expect_name:
        raise RegulatoryRfamError(
            f"covariance model is named {model.name}, not the expected {expect_name}"
        )
    return model


def plan_origin_junctions(
    replicons: Sequence[Replicon], sequences: dict[str, str], window: int
) -> tuple[dict[str, str], list[tuple[str, str]], list[dict[str, Any]]]:
    """Decides which replicons get an origin-junction search, and why not.

    Returns the replicon -> junction-id map, the junction FASTA records, and
    one explicit reason per skipped replicon. Nothing is dropped silently.
    """
    flank = junction_flank(window)
    junction_ids: dict[str, str] = {}
    records: list[tuple[str, str]] = []
    skipped: list[dict[str, Any]] = []
    for replicon in replicons:
        if replicon.topology != "circular":
            skipped.append(
                {"replicon": replicon.accession, "reason": replicon.topology}
            )
            continue
        if flank == 0:
            skipped.append(
                {
                    "replicon": replicon.accession,
                    "reason": f"model window W={window} leaves no origin junction",
                }
            )
            continue
        if replicon.length < 2 * flank:
            skipped.append(
                {
                    "replicon": replicon.accession,
                    "reason": f"length {replicon.length} is under the "
                    f"{2 * flank}-base junction window",
                }
            )
            continue
        junction_id = f"{replicon.accession}_origin_junction"
        junction_ids[replicon.accession] = junction_id
        records.append(
            (junction_id, junction_sequence(sequences[replicon.accession], window))
        )
    return junction_ids, records, skipped


def search_origin_junctions(
    context: SearchContext,
    replicons: Sequence[Replicon],
    sequences: dict[str, str],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Searches each circular replicon's origin junction and remaps the wraps."""
    model = context.model
    flank = junction_flank(model.window)
    junction_ids, records, skipped = plan_origin_junctions(
        replicons, sequences, model.window
    )
    summary: dict[str, Any] = {
        "flankBases": flank,
        "windowBases": 2 * flank,
        "searchedReplicons": sorted(junction_ids),
        "skippedReplicons": skipped,
        "coverageNote": (
            "Each circular replicon's origin is covered by searching a "
            f"{2 * flank}-base junction sequence built from its last {flank} and "
            f"first {flank} bases, so any hit up to the model's W={model.window} "
            "window that crosses position 1 is found and remapped to native "
            "circular coordinates. An origin-spanning interval is reported with "
            "native_start > native_end, which is the wrap, not an error."
        ),
        "argv": [],
        "hitCount": 0,
        "originSpanningCount": 0,
        "alreadyFoundByLinearSearch": 0,
    }
    if not records:
        return [], summary

    run = context.search("origin_junction", records)
    # Checked before remapping, so no bad coordinate reaches the wrap.
    require_clean(
        [
            f"origin junction: {problem}"
            for problem in validate_hits(
                run.hits,
                model,
                {junction_id: 2 * flank for junction_id in junction_ids.values()},
                scope="origin junction sequences",
            )
        ]
    )
    rows, already_linear = junction_hit_rows(run.hits, model, replicons, junction_ids)
    summary.update(run.provenance())
    summary["originSpanningCount"] = len(rows)
    summary["alreadyFoundByLinearSearch"] = already_linear
    return rows, summary


CONTROL_BOUNDARY = (
    "Preserves each replicon's length and base composition but not dinucleotide "
    "frequency or structural propensity. A shuffled hit rate is a null rate for "
    "composition-matched sequence, not a biological false-positive rate against "
    "proven negatives."
)


def run_shuffled_control(
    context: SearchContext,
    replicons: Sequence[Replicon],
    sequences: dict[str, str],
    replicon_lengths: dict[str, int],
    *,
    replicate_count: int,
    seed: int,
) -> dict[str, Any]:
    """Searches composition-matched shuffles of every replicon, once per replicate."""
    replicates: list[dict[str, Any]] = []
    for replicate in range(replicate_count):
        seed_keys = [
            control_seed_key(seed, replicate, replicon.accession)
            for replicon in replicons
        ]
        shuffled = [
            (replicon.accession, shuffled_sequence(sequences[replicon.accession], key))
            for replicon, key in zip(replicons, seed_keys)
        ]
        run = context.search(f"control_{replicate:02d}", shuffled)
        require_clean(
            [
                f"control replicate {replicate}: {problem}"
                for problem in validate_hits(run.hits, context.model, replicon_lengths)
            ]
        )
        replicates.append(
            {
                "replicate": replicate,
                "seedKeys": seed_keys,
                **run.provenance(),
                "bestScore": max((hit.score for hit in run.hits), default=None),
                "hits": linear_hit_rows(
                    run.hits, context.model, SEARCH_SPACE_CONTROL
                ),
            }
        )
    return {
        "method": "mononucleotide shuffle, per replicon, fixed seed",
        "seed": seed,
        "boundary": CONTROL_BOUNDARY,
        "replicates": replicates,
        "hitsTotal": sum(replicate["hitCount"] for replicate in replicates),
    }


def run_pilot(
    *,
    cm_path: Path,
    fasta_path: Path,
    gbff_path: Path,
    workdir: Path,
    cmsearch: Path,
    expect_accession: str | None,
    expect_name: str | None,
    control_replicates: int,
    control_seed: int,
) -> dict[str, Any]:
    """Runs the whole pilot and returns the report payload.

    Order matters: everything that can refuse the run — the model identity, the
    inputs, the tool, the work directory — is resolved before the first search.
    """
    if control_replicates < 1:
        raise RegulatoryRfamError(
            f"--control-replicates must be at least 1, got {control_replicates}"
        )
    model = resolve_model(cm_path, expect_accession, expect_name)
    records = load_fasta(fasta_path)
    replicons = build_replicons(records, parse_locus_topologies(gbff_path))
    version = cmsearch_version(cmsearch)
    prepare_directory(workdir, "work directory")

    total_residues = sum(replicon.length for replicon in replicons)
    replicon_lengths = {replicon.accession: replicon.length for replicon in replicons}
    sequences = {name: sequence for name, _, sequence in records}
    context = SearchContext(
        cmsearch=cmsearch,
        cm_path=cm_path,
        workdir=workdir,
        model=model,
        search_space=search_space_mb(total_residues),
    )

    inputs: dict[str, dict[str, Any]] = {
        "covarianceModel": {"path": cm_path.name, "sha256": sha256_file(cm_path)},
        "genomeFasta": {
            "path": fasta_path.name,
            "sha256": sha256_file(fasta_path),
            "md5": md5_file(fasta_path),
        },
        "genomeFlatFile": {
            "path": gbff_path.name,
            "sha256": sha256_file(gbff_path),
            "md5": md5_file(gbff_path),
        },
    }

    # cmsearch reads plain FASTA only, so a decompressed working copy is
    # written and hashed as the sequence actually searched.
    native = context.search(
        "native",
        [
            (f"{name} {description}".strip(), sequence)
            for name, description, sequence in records
        ],
    )
    inputs["searchedFasta"] = {
        "path": native.fasta.name,
        "sha256": sha256_file(native.fasta),
        "residues": total_residues,
    }
    require_clean(validate_hits(native.hits, model, replicon_lengths))

    junction_rows, junction_summary = search_origin_junctions(
        context, replicons, sequences
    )
    control = run_shuffled_control(
        context,
        replicons,
        sequences,
        replicon_lengths,
        replicate_count=control_replicates,
        seed=control_seed,
    )

    return build_report(
        model=model,
        model_path=cm_path,
        replicons=replicons,
        inputs=inputs,
        tool={
            "program": "cmsearch",
            "package": "Infernal",
            "version": version,
            "executable": str(cmsearch),
        },
        search_space=context.search_space,
        native={
            "provenance": native.provenance(),
            "rows": linear_hit_rows(native.hits, model),
        },
        junction={"rows": junction_rows, "summary": junction_summary},
        control=control,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--cm", type=Path, required=True, help="pinned single-family Rfam .cm file"
    )
    parser.add_argument(
        "--fasta",
        type=Path,
        required=True,
        help="native pinned assembly FASTA (.fna or .fna.gz)",
    )
    parser.add_argument(
        "--gbff",
        type=Path,
        required=True,
        help="pinned GenBank flat file, read for replicon topology only",
    )
    parser.add_argument(
        "--workdir",
        type=Path,
        required=True,
        help="scratch directory for the decompressed input and raw cmsearch output",
    )
    parser.add_argument(
        "--cmsearch", type=Path, required=True, help="path to the cmsearch executable"
    )
    parser.add_argument("--json-out", type=Path, required=True)
    parser.add_argument("--tsv-out", type=Path, required=True)
    parser.add_argument("--expect-accession", default=None)
    parser.add_argument("--expect-name", default=None)
    parser.add_argument("--control-replicates", type=int, default=5)
    parser.add_argument("--control-seed", type=int, default=20261012)
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="replace existing report files instead of refusing",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        check_writable(args.json_out, args.overwrite, "JSON report")
        check_writable(args.tsv_out, args.overwrite, "TSV report")
        report = run_pilot(
            cm_path=args.cm,
            fasta_path=args.fasta,
            gbff_path=args.gbff,
            workdir=args.workdir,
            cmsearch=args.cmsearch,
            expect_accession=args.expect_accession,
            expect_name=args.expect_name,
            control_replicates=args.control_replicates,
            control_seed=args.control_seed,
        )
        write_report(report, args.json_out, args.tsv_out)
    except RegulatoryRfamError as error:
        raise SystemExit(f"error: {error}") from error
    counts = report["counts"]
    print(
        f"model={report['model']['accession']} ({report['model']['name']}) "
        f"native_hits={counts['nativeLinearHits']} "
        f"origin_spanning={counts['originSpanningHits']} "
        f"overlapping_pairs={counts['overlappingNativePairs']} "
        f"control_hits={counts['controlHitsTotal']} "
        f"over {counts['controlReplicates']} replicates"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
