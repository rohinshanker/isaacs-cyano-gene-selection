#!/usr/bin/env python3
"""Searches the native pinned UTEX 2973 assembly with one pinned Rfam
regulatory covariance model, using Infernal cmsearch, plus a deterministic
shuffled-background control.

Scope and boundary
------------------
This is a single-family pilot: Rfam 15.1 ``RF01116`` (``Yfr1``,
"Cyanobacterial functional RNA 1"). It is not a scan of the Rfam library and
not comprehensive regulatory detection. A searched position without a hit has
no RF01116 match at the GA threshold; other families remain not evaluated,
and no absence of regulation is inferred.

Every hit this tool reports is **exploratory computed evidence**: a covariance
model matched the native sequence above that family's Rfam gathering (GA) bit
score. That is sequence/structure homology to a curated family, never measured
regulation, demonstrated regulatory action, or a calibrated probability for
UTEX 2973. The shuffled control estimates a null hit rate for
composition-matched sequence; shuffled sequence is not a proven biological
negative.

Identity is enforced, not recorded after the fact: the command line refuses to
run unless the model, the compressed genome FASTA, the GenBank flat file, the
replicon set and the Infernal version are exactly the pinned ones (``PINNED``).

Coordinates are reported on the native pinned assembly only, one-based and
inclusive, with strand. Nothing is transferred from a donor strain. The raw
cmsearch orientation endpoints (``seq from``/``seq to``, which run high-to-low
on the minus strand) are preserved alongside the normalised interval.

See docs/validation/regulatory-rfam.md for the pinned identities, the exact
commands, and how to reproduce a run from the official artifacts.
"""

from __future__ import annotations

import argparse
import csv
import dataclasses
import gzip
import hashlib
import io
import json
import math
import os
import random
import re
import subprocess
from pathlib import Path
from typing import Any, Iterable, Sequence

SCHEMA_VERSION = 2
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
    "search_target",
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
# Pinned identity
# --------------------------------------------------------------------------


@dataclasses.dataclass(frozen=True)
class PinnedIdentity:
    """Every byte and fact a run must match before its first search.

    ``assembly_label`` is the only wording the report uses for the searched
    genome, so a report can never name an assembly its inputs were not.
    """

    assembly_label: str
    model_accession: str
    model_name: str
    model_sha256: str
    model_clen: int
    model_window: int
    gathering_cutoff: float
    fasta_sha256: str
    fasta_md5: str
    gbff_sha256: str
    gbff_md5: str
    searched_fasta_sha256: str
    replicons: tuple[tuple[str, int, str], ...]
    infernal_version: str


# Rfam 15.1 RF01116 extracted with cmfetch; NCBI's compressed assembly files
# (MD5s from NCBI's own md5checksums.txt); the decompressed FASTA SHA-256 that
# trna-annotation-validation.md records. See docs/validation/regulatory-rfam.md.
PINNED = PinnedIdentity(
    assembly_label="native pinned UTEX 2973 assembly GCF_000817325.1_ASM81732v1",
    model_accession="RF01116",
    model_name="Yfr1",
    model_sha256="4abf1d7ce88d4d81bd4e680358a9b1de65999126eab03577341be231ee38e8fc",
    model_clen=59,
    model_window=86,
    gathering_cutoff=38.0,
    fasta_sha256="22a2b07881c1099c32454778de0e90b1c40f74f44c0f59e000507106c0deb567",
    fasta_md5="610ceb15a9859046e143d80915d4c984",
    gbff_sha256="331ef3bd7c0e9ec2fc3140dd200d2a89109ded72babe4102d0fe4aa361401e56",
    gbff_md5="fc86ce730ae02cc1cbad14129d50cd45",
    searched_fasta_sha256=(
        "4716bbf61cfeb296587c94e90e6b6ce037752f9b9d4d225addd15eea02124984"
    ),
    replicons=(
        ("NZ_CP006471.1", 2690418, "circular"),
        ("NZ_CP006472.1", 46366, "circular"),
        ("NZ_CP006473.1", 7842, "circular"),
    ),
    infernal_version="1.1.5 (Sep 2023)",
)


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


def verify_pinned_inputs(
    pins: PinnedIdentity, cm_path: Path, fasta_path: Path, gbff_path: Path
) -> dict[str, dict[str, Any]]:
    """Refuses any input whose bytes are not the pinned ones.

    Runs before anything is parsed or written. Every mismatch is reported at
    once, and the returned digests are the ones the report records.
    """
    for path, label in (
        (cm_path, "covariance model"),
        (fasta_path, "sequence FASTA"),
        (gbff_path, "GenBank flat file"),
    ):
        require_file(path, label)
    inputs = {
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
    expected = {
        ("covarianceModel", "sha256"): pins.model_sha256,
        ("genomeFasta", "sha256"): pins.fasta_sha256,
        ("genomeFasta", "md5"): pins.fasta_md5,
        ("genomeFlatFile", "sha256"): pins.gbff_sha256,
        ("genomeFlatFile", "md5"): pins.gbff_md5,
    }
    problems = [
        f"{key} {algorithm} {inputs[key][algorithm]} is not the pinned {value}"
        for (key, algorithm), value in expected.items()
        if inputs[key][algorithm] != value
    ]
    if problems:
        raise RegulatoryRfamError(
            f"inputs are not the pinned {pins.model_accession} model and "
            f"{pins.assembly_label}:\n  " + "\n  ".join(problems)
        )
    return inputs


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


def check_model_header(model: CovarianceModel, pins: PinnedIdentity) -> None:
    """Refuses a model header that disagrees with the pinned family."""
    observed = (
        model.accession,
        model.name,
        model.clen,
        model.window,
        model.gathering_cutoff,
    )
    expected = (
        pins.model_accession,
        pins.model_name,
        pins.model_clen,
        pins.model_window,
        pins.gathering_cutoff,
    )
    if observed != expected:
        raise RegulatoryRfamError(
            "covariance model header (ACC, NAME, CLEN, W, GA) is "
            f"{observed}, not the pinned {expected}"
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


def check_replicon_set(replicons: Sequence[Replicon], pins: PinnedIdentity) -> None:
    """Refuses any replicon set other than the pinned accessions, lengths, topologies."""
    observed = tuple((r.accession, r.length, r.topology) for r in replicons)
    if observed != pins.replicons:
        raise RegulatoryRfamError(
            f"replicons {observed} are not the pinned set {pins.replicons}"
        )


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


_SUMMARY_PATTERNS = {
    "queryModels": re.compile(r"^Query model\(s\):\s+(\d+)\s+\("),
    "targetSequences": re.compile(r"^Target sequences:\s+(\d+)\s+\((\d+) residues"),
    "hitsReported": re.compile(r"^Total CM hits reported:\s+(\d+)\s"),
}


def parse_search_summary(stdout_path: Path) -> dict[str, int]:
    """Reads cmsearch's own pipeline summary from its main output.

    This is cmsearch's statement of what it actually searched, so a run that
    silently covered fewer sequences or residues than were given is caught.
    ``residuesSearched`` counts both strands.
    """
    require_file(stdout_path, "cmsearch main output")
    summary: dict[str, int] = {}
    for line in stdout_path.read_text(encoding="utf-8").splitlines():
        for key, pattern in _SUMMARY_PATTERNS.items():
            match = pattern.match(line)
            if match is None:
                continue
            if key in summary:
                raise RegulatoryRfamError(
                    f"{stdout_path} reports more than one '{key}' summary; "
                    "this pilot runs exactly one model"
                )
            summary[key] = int(match.group(1))
            if key == "targetSequences":
                summary["residuesSearched"] = int(match.group(2))
    missing = sorted(set(_SUMMARY_PATTERNS) - set(summary))
    if missing:
        raise RegulatoryRfamError(
            f"{stdout_path} has no cmsearch pipeline summary for {', '.join(missing)}"
        )
    return summary


def check_search_summary(
    summary: dict[str, int], *, sequences: int, residues: int, hits: int
) -> None:
    """Refuses a search whose own summary disagrees with what was submitted."""
    expected = {
        "queryModels": 1,
        "targetSequences": sequences,
        "residuesSearched": 2 * residues,
        "hitsReported": hits,
    }
    problems = [
        f"{key} {summary[key]} != expected {value}"
        for key, value in expected.items()
        if summary[key] != value
    ]
    if problems:
        raise RegulatoryRfamError(
            "cmsearch did not search what it was given (both strands of every "
            "submitted sequence): " + "; ".join(problems)
        )


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


def native_segments(start: int, end: int, length: int) -> list[tuple[int, int]]:
    """Linear pieces of a native interval; a wrap (start > end) is two pieces."""
    if start <= end:
        return [(start, end)]
    return [(start, length), (1, end)]


def shared_intervals(
    first: tuple[int, int], second: tuple[int, int], length: int
) -> list[list[int]]:
    """Bases two native intervals share, as native intervals.

    Either interval may wrap the origin. A shared run that crosses the origin
    is returned as one wrapped interval, in the report's own convention.
    """
    pieces = sorted(
        (max(a_start, b_start), min(a_end, b_end))
        for a_start, a_end in native_segments(*first, length)
        for b_start, b_end in native_segments(*second, length)
        if max(a_start, b_start) <= min(a_end, b_end)
    )
    if len(pieces) >= 2 and pieces[0][0] == 1 and pieces[-1][1] == length:
        head, tail = pieces.pop(0), pieces.pop()
        pieces.append((tail[0], head[1]))
    return [list(piece) for piece in pieces]


def overlap_pairs(
    rows: Sequence[dict[str, Any]], lengths: dict[str, int]
) -> list[dict[str, Any]]:
    """Overlapping native intervals among report rows on the same replicon.

    Covers linear and origin-spanning rows alike, using each replicon's
    native length to unwrap the origin. Strand is deliberately ignored: a plus-
    and a minus-strand hit covering the same bases is exactly the overlap a
    reader needs to see.
    """
    pairs: list[dict[str, Any]] = []
    for left in range(len(rows)):
        for right in range(left + 1, len(rows)):
            first, second = rows[left], rows[right]
            if first["replicon"] != second["replicon"]:
                continue
            length = lengths[first["replicon"]]
            intervals = shared_intervals(
                (first["native_start"], first["native_end"]),
                (second["native_start"], second["native_end"]),
                length,
            )
            if intervals:
                pairs.append(
                    {
                        "first": left,
                        "second": right,
                        "replicon": first["replicon"],
                        "intervals": intervals,
                        "sharedBases": sum(
                            end - start + 1
                            for piece in intervals
                            for start, end in native_segments(piece[0], piece[1], length)
                        ),
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

    A linear FASTA search cannot report an element that crosses position 1, so
    this pilot searches an explicit junction sequence as well. ``window`` is
    the model's own ``W`` (the longest hit Infernal will consider), so a
    ``W - 1`` flank on each side presents every origin-crossing interval to
    the model.
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


def describe_tool(cmsearch: Path, expected_version: str) -> dict[str, Any]:
    """Refuses any Infernal but the pinned version; records the executable's hash."""
    version = cmsearch_version(cmsearch)
    if version != expected_version:
        raise RegulatoryRfamError(
            f"{cmsearch} is Infernal {version}, not the pinned {expected_version}"
        )
    resolved = cmsearch.resolve()
    return {
        "program": "cmsearch",
        "package": "Infernal",
        "version": version,
        "executable": str(cmsearch),
        "resolvedExecutable": str(resolved),
        "sha256": sha256_file(resolved),
    }


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
    target_fasta: str,
    tblout: str,
    stdout: str,
    search_space: float,
) -> list[str]:
    """The exact, reproducible argument vector for one search.

    Run files are named relative to the work directory cmsearch runs in, so
    the recorded vector does not depend on where the work directory is. Both
    strands are searched: cmsearch does so by default and this pilot never
    passes --toponly or --bottomonly.
    """
    return [
        str(cmsearch),
        "-Z",
        f"{search_space:.6f}",
        *CMSEARCH_FLAGS,
        "--tblout",
        tblout,
        "-o",
        stdout,
        str(cm_path),
        target_fasta,
    ]


def run_cmsearch(argv: Sequence[str], cwd: Path) -> None:
    try:
        completed = subprocess.run(
            argv, capture_output=True, text=True, check=False, cwd=cwd
        )
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


def fasta_text(records: Iterable[tuple[str, str]], width: int = 80) -> str:
    """Serialises ``(header, sequence)`` records at NCBI's 80-column width.

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
    return "\n".join(lines) + "\n"


def native_records(records: Sequence[tuple[str, str, str]]) -> list[tuple[str, str]]:
    """The assembly's records as ``(header, sequence)``, headers as published."""
    return [
        (f"{name} {description}".strip(), sequence)
        for name, description, sequence in records
    ]


# --------------------------------------------------------------------------
# Paths: preflight, fresh work directory, exclusive report creation
# --------------------------------------------------------------------------


def _refuse_blocked_ancestor(path: Path, label: str) -> None:
    """Refuses a path whose would-be parent directory is an existing non-directory.

    ``Path.resolve`` normalises without requiring the path to exist, so a file
    sitting where a parent directory is expected only fails at mkdir time —
    after earlier steps may already have written something.
    """
    for ancestor in reversed(path.absolute().parents):
        if ancestor.exists() and not ancestor.is_dir():
            raise RegulatoryRfamError(
                f"{label} {path}: {ancestor} exists and is not a directory"
            )


def _path_key(path: Path) -> str:
    """Resolved, case-folded path: macOS's default filesystem ignores case."""
    return str(path.resolve()).casefold()


def preflight_paths(inputs: dict[str, Path], outputs: dict[str, Path]) -> None:
    """Checks every destination before anything runs. Writes nothing.

    Every output (the work directory and both reports) must not exist yet —
    not even as a dangling symlink — because this tool never replaces or
    reuses a path. After resolving symlinks and case, no two artifacts,
    inputs and the tool included, may be the same path or nested in one
    another.
    """
    for label, path in outputs.items():
        if os.path.lexists(path):
            raise RegulatoryRfamError(
                f"{label} {path} already exists; this tool never replaces or "
                "reuses an existing path"
            )
        _refuse_blocked_ancestor(path, label)
    keyed = [(label, _path_key(path)) for label, path in {**inputs, **outputs}.items()]
    for index, (first_label, first) in enumerate(keyed):
        for second_label, second in keyed[index + 1 :]:
            if first == second:
                raise RegulatoryRfamError(
                    f"{first_label} and {second_label} resolve to the same path {first}"
                )
            if second.startswith(first + os.sep) or first.startswith(second + os.sep):
                raise RegulatoryRfamError(
                    f"{first_label} and {second_label} are nested in one another "
                    f"({first}, {second})"
                )


def reserve_workdir(workdir: Path) -> Path:
    """Creates a fresh work directory, refusing one that already exists."""
    _refuse_blocked_ancestor(workdir, "work directory")
    workdir.parent.mkdir(parents=True, exist_ok=True)
    try:
        workdir.mkdir()
    except FileExistsError as error:
        raise RegulatoryRfamError(
            f"work directory {workdir} already exists; each run needs a fresh one "
            "so no earlier raw output is overwritten"
        ) from error
    return workdir


def _create_exclusive(path: Path, text: str) -> None:
    with path.open("x", encoding="utf-8", newline="") as handle:
        handle.write(text)


def report_tsv_text(report: dict[str, Any]) -> str:
    buffer = io.StringIO()
    # csv defaults to CRLF even on POSIX, which reads as trailing whitespace
    # to `git diff --check`.
    writer = csv.DictWriter(
        buffer, fieldnames=_HIT_FIELDNAMES, delimiter="\t", lineterminator="\n"
    )
    writer.writeheader()
    for row in report["hits"]:
        writer.writerow({key: row[key] for key in _HIT_FIELDNAMES})
    return buffer.getvalue()


def write_report(report: dict[str, Any], json_path: Path, tsv_path: Path) -> None:
    """Creates both reports exclusively, or neither.

    Each file is opened with exclusive creation, so a path that appeared since
    preflight — or a second name for the first report — is refused rather than
    replaced. On failure, only files this call created are removed.
    """
    pending = (
        (tsv_path, report_tsv_text(report)),
        (json_path, json.dumps(report, indent=2, sort_keys=True) + "\n"),
    )
    created: list[Path] = []
    try:
        for path, text in pending:
            _refuse_blocked_ancestor(path, "report")
            path.parent.mkdir(parents=True, exist_ok=True)
            handle = path.open("x", encoding="utf-8", newline="")
            created.append(path)
            with handle:
                handle.write(text)
    except BaseException as error:
        removed = 0
        cleanup_errors = []
        for path in created:
            try:
                path.unlink(missing_ok=True)
                removed += 1
            except OSError as cleanup_error:
                cleanup_errors.append(f"{path}: {cleanup_error}")
        cleanup_note = (
            "; partial reports could not be removed: " + "; ".join(cleanup_errors)
            if cleanup_errors else ""
        )
        if isinstance(error, (OSError, RegulatoryRfamError)):
            raise RegulatoryRfamError(
                f"could not create the report pair; removed only the "
                f"{removed} file(s) this run created: {error}{cleanup_note}"
            ) from error
        if cleanup_note:
            error.add_note(cleanup_note)
        raise


# --------------------------------------------------------------------------
# Report
# --------------------------------------------------------------------------


def evidence_boundary(pins: PinnedIdentity) -> str:
    return (
        f"Exploratory computed evidence: a pinned Rfam covariance model matched the "
        f"{pins.assembly_label} above that family's Rfam gathering (GA) bit score. "
        "This is homology to a curated RNA family, not measured regulation, not "
        "demonstrated regulatory activity, and not a calibrated probability for "
        "UTEX 2973. Shuffled-background hits estimate a null rate for "
        "composition-matched sequence and are not proven biological negatives."
    )


COVERAGE_BOUNDARY = (
    "One family only (the pinned model). A searched position without a hit had no "
    "match at or above the family GA threshold. Other Rfam families were not "
    "evaluated, and no absence of regulation is inferred. "
    "Covariance-model search finds homologues of a curated family and will miss "
    "unrelated or novel elements."
)

SEARCHED_NOT_DISCOVERED = (
    "Searched is not discovered: a searched region without a hit produced no "
    "match at or above the family GA threshold under cmsearch's filter "
    "pipeline, which does not establish that no element of the family is there."
)


NATIVE_BASIS = "native pinned assembly, one-based inclusive, stranded"
JUNCTION_BASIS = (
    NATIVE_BASIS + "; native_start > native_end is a wrap across the origin; "
    "raw_seq_from/raw_seq_to are as emitted on search_target, the origin-junction "
    "sequence"
)


def _hit_row(
    hit: TabularHit,
    model: CovarianceModel,
    search_space: str,
    *,
    replicon: str,
    native_start: int,
    native_end: int,
    origin_spanning: bool,
    coordinate_basis: str,
) -> dict[str, Any]:
    """One native report row. ``raw_*`` and ``search_target`` are always as emitted."""
    return {
        "replicon": replicon,
        "search_space": search_space,
        "search_target": hit.target,
        "model_accession": model.accession,
        "model_name": model.name,
        "strand": hit.strand,
        "native_start": native_start,
        "native_end": native_end,
        "native_length": hit.native_length,
        "raw_seq_from": hit.seq_from,
        "raw_seq_to": hit.seq_to,
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
        "coordinate_basis": coordinate_basis,
    }


def linear_hit_rows(
    hits: Sequence[TabularHit], model: CovarianceModel
) -> list[dict[str, Any]]:
    """Report rows for the native linear search."""
    return [
        _hit_row(
            hit,
            model,
            SEARCH_SPACE_NATIVE,
            replicon=hit.target,
            native_start=hit.native_start,
            native_end=hit.native_end,
            origin_spanning=False,
            coordinate_basis=NATIVE_BASIS,
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

    Only ``native_start``/``native_end`` are remapped; the search target and
    the endpoints cmsearch emitted on it are kept as they were. Returns the
    rows and the count of junction hits discarded because they do not cross
    the origin and the linear search therefore already found them.
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
                origin_spanning=True,
                coordinate_basis=JUNCTION_BASIS,
            )
        )
    return rows, discarded


def control_sequence_id(accession: str, replicate: int) -> str:
    """The FASTA id of one shuffled replicon: never a native accession."""
    return f"{accession}_shuffled_{replicate:02d}"


def control_hit_rows(
    hits: Sequence[TabularHit],
    model: CovarianceModel,
    replicate: int,
    source_by_target: dict[str, str],
) -> list[dict[str, Any]]:
    """Control hits, positioned on the shuffled sequence they were found in.

    These rows deliberately carry no ``replicon``/``native_start``/
    ``native_end``: a position in a permuted sequence is not a native locus, and
    the source replicon is kept only as provenance.
    """
    return [
        {
            "search_space": SEARCH_SPACE_CONTROL,
            "search_target": hit.target,
            "source_replicon": source_by_target[hit.target],
            "replicate": replicate,
            "model_accession": model.accession,
            "model_name": model.name,
            "strand": hit.strand,
            "shuffled_start": hit.native_start,
            "shuffled_end": hit.native_end,
            "raw_seq_from": hit.seq_from,
            "raw_seq_to": hit.seq_to,
            "mdl_from": hit.mdl_from,
            "mdl_to": hit.mdl_to,
            "trunc": hit.trunc,
            "pipeline_pass": hit.pipeline_pass,
            "gc": hit.gc,
            "bias": hit.bias,
            "score": hit.score,
            "evalue": hit.evalue,
            "inc": hit.inc,
            "coordinate_basis": (
                f"shuffled control replicate {replicate}, sequence {hit.target}: a "
                f"composition-matched permutation of {source_by_target[hit.target]}, "
                "one-based inclusive, stranded; not native assembly positions and "
                "not a site call"
            ),
        }
        for hit in hits
    ]


def search_coverage(
    replicons: Sequence[Replicon],
    native_summary: dict[str, int],
    junction: dict[str, Any],
) -> dict[str, Any]:
    """What was actually searched, per replicon, as cmsearch itself counted it."""
    skipped = {entry["replicon"]: entry["reason"] for entry in junction["skippedReplicons"]}
    total = sum(replicon.length for replicon in replicons)
    return {
        "statement": (
            f"All {len(replicons)} replicons of the pinned FASTA ({total} residues) "
            "were searched end to end on both strands; cmsearch's own pipeline "
            f"summary counted {native_summary['targetSequences']} target sequences "
            f"and {native_summary['residuesSearched']} residues (both strands). "
            + SEARCHED_NOT_DISCOVERED
        ),
        "repliconCount": len(replicons),
        "residues": total,
        "replicons": [
            {
                "accession": replicon.accession,
                "length": replicon.length,
                "topology": replicon.topology,
                "linearInterval": [1, replicon.length],
                "strands": "both",
                "originJunction": "searched"
                if replicon.accession in junction["searchedReplicons"]
                else f"not searched: {skipped[replicon.accession]}",
            }
            for replicon in replicons
        ],
        "shuffledControl": CONTROL_COVERAGE,
    }


def build_report(
    *,
    pins: PinnedIdentity,
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
    hits = list(native["rows"]) + list(junction["rows"])
    overlaps = overlap_pairs(
        hits, {replicon.accession: replicon.length for replicon in replicons}
    )
    return {
        "schemaVersion": SCHEMA_VERSION,
        "pilot": PILOT_ID,
        "recordOrigin": "computed",
        "evidenceBoundary": evidence_boundary(pins),
        "coverageBoundary": COVERAGE_BOUNDARY,
        "pinnedIdentity": {"verified": True, **dataclasses.asdict(pins)},
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
        "searchCoverage": search_coverage(
            replicons, native["provenance"]["cmsearchSummary"], junction["summary"]
        ),
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
    summary: dict[str, int]

    def provenance(self) -> dict[str, Any]:
        """The reproducible record of this search: arguments and digests."""
        return {
            "argv": self.argv,
            "fasta": {"path": self.fasta.name, "sha256": sha256_file(self.fasta)},
            "tbloutRowsSha256": tblout_rows_digest(self.tblout),
            "cmsearchSummary": self.summary,
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
        """Writes a FASTA, runs one cmsearch over it, checks and parses its output."""
        fasta = self.workdir / f"{label}.fna"
        _create_exclusive(fasta, fasta_text(records))
        argv = cmsearch_argv(
            self.cmsearch,
            self.cm_path,
            fasta.name,
            f"{label}.tblout",
            f"{label}.cmsearch",
            self.search_space,
        )
        run_cmsearch(argv, self.workdir)
        hits = parse_tblout(self.workdir / f"{label}.tblout")
        summary = parse_search_summary(self.workdir / f"{label}.cmsearch")
        check_search_summary(
            summary,
            sequences=len(records),
            residues=sum(len(sequence) for _, sequence in records),
            hits=len(hits),
        )
        return SearchRun(hits, argv, fasta, self.workdir / f"{label}.tblout", summary)


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
            "Each circular replicon's origin was searched as a "
            f"{2 * flank}-base junction sequence built from its last {flank} and "
            f"first {flank} bases, so every interval up to the model's "
            f"W={model.window} window that crosses position 1 was presented to "
            "the model, under the same flags, GA threshold and -Z as the linear "
            "search. " + SEARCHED_NOT_DISCOVERED + " Zero origin-spanning hits "
            "therefore does not show that no family element crosses an origin. An "
            "origin-spanning interval is reported with native_start > native_end, "
            "which is the wrap, not an error."
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
    "proven negatives, and not a false-discovery rate for the native hits."
)

CONTROL_COVERAGE = (
    "Linear only: each shuffled replicon is searched end to end on both strands, "
    "with no origin-junction search. The native search adds one junction per "
    "circular replicon, so control and native coverage differ and the control "
    "count is not directly comparable to the native count."
)


def run_shuffled_control(
    context: SearchContext,
    replicons: Sequence[Replicon],
    sequences: dict[str, str],
    *,
    replicate_count: int,
    seed: int,
) -> dict[str, Any]:
    """Searches composition-matched shuffles of every replicon, once per replicate.

    Each shuffled replicon is searched under its own id, so no control hit
    can carry a native accession.
    """
    replicates: list[dict[str, Any]] = []
    for replicate in range(replicate_count):
        seed_keys = [
            control_seed_key(seed, replicate, replicon.accession)
            for replicon in replicons
        ]
        source_by_target = {
            control_sequence_id(replicon.accession, replicate): replicon.accession
            for replicon in replicons
        }
        shuffled = [
            (
                control_sequence_id(replicon.accession, replicate),
                shuffled_sequence(sequences[replicon.accession], key),
            )
            for replicon, key in zip(replicons, seed_keys)
        ]
        run = context.search(f"control_{replicate:02d}", shuffled)
        require_clean(
            [
                f"control replicate {replicate}: {problem}"
                for problem in validate_hits(
                    run.hits,
                    context.model,
                    {name: len(sequence) for name, sequence in shuffled},
                    scope="shuffled control sequences",
                )
            ]
        )
        replicates.append(
            {
                "replicate": replicate,
                "seedKeys": seed_keys,
                "sequences": source_by_target,
                **run.provenance(),
                "bestScore": max((hit.score for hit in run.hits), default=None),
                "hits": control_hit_rows(
                    run.hits, context.model, replicate, source_by_target
                ),
            }
        )
    return {
        "method": "mononucleotide shuffle, per replicon, fixed seed",
        "seed": seed,
        "boundary": CONTROL_BOUNDARY,
        "coverage": CONTROL_COVERAGE,
        "replicates": replicates,
        "hitsTotal": sum(replicate["hitCount"] for replicate in replicates),
    }


def _run_pilot(
    *,
    pins: PinnedIdentity,
    cm_path: Path,
    fasta_path: Path,
    gbff_path: Path,
    workdir: Path,
    cmsearch: Path,
    control_replicates: int,
    control_seed: int,
) -> dict[str, Any]:
    """Runs the pilot against ``pins``; production goes through ``run_pilot``.

    Order matters: every identity check — input bytes, model header, replicon
    set, Infernal version, searched-FASTA bytes — passes before the work
    directory is created or anything is written.
    """
    if control_replicates < 1:
        raise RegulatoryRfamError(
            f"--control-replicates must be at least 1, got {control_replicates}"
        )
    inputs = verify_pinned_inputs(pins, cm_path, fasta_path, gbff_path)
    model = parse_covariance_model(cm_path)
    check_model_header(model, pins)
    records = load_fasta(fasta_path)
    replicons = build_replicons(records, parse_locus_topologies(gbff_path))
    check_replicon_set(replicons, pins)
    tool = describe_tool(cmsearch, pins.infernal_version)
    # cmsearch reads plain FASTA only, so a decompressed working copy is
    # searched. It must be byte-identical to the official decompressed FASTA.
    native_fasta = native_records(records)
    searched_sha256 = sha256_text(fasta_text(native_fasta))
    if searched_sha256 != pins.searched_fasta_sha256:
        raise RegulatoryRfamError(
            f"the decompressed FASTA to be searched hashes {searched_sha256}, not the "
            f"pinned {pins.searched_fasta_sha256}"
        )
    reserve_workdir(workdir)

    total_residues = sum(replicon.length for replicon in replicons)
    replicon_lengths = {replicon.accession: replicon.length for replicon in replicons}
    sequences = {name: sequence for name, _, sequence in records}
    context = SearchContext(
        cmsearch=cmsearch.absolute(),
        cm_path=cm_path.absolute(),
        workdir=workdir,
        model=model,
        search_space=search_space_mb(total_residues),
    )

    native = context.search("native", native_fasta)
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
        replicate_count=control_replicates,
        seed=control_seed,
    )

    return build_report(
        pins=pins,
        model=model,
        model_path=cm_path,
        replicons=replicons,
        inputs=inputs,
        tool=tool,
        search_space=context.search_space,
        native={
            "provenance": native.provenance(),
            "rows": linear_hit_rows(native.hits, model),
        },
        junction={"rows": junction_rows, "summary": junction_summary},
        control=control,
    )


def run_pilot(
    *,
    cm_path: Path,
    fasta_path: Path,
    gbff_path: Path,
    workdir: Path,
    cmsearch: Path,
    control_replicates: int,
    control_seed: int,
) -> dict[str, Any]:
    """The production pilot: refuses anything but the ``PINNED`` identity."""
    return _run_pilot(
        pins=PINNED,
        cm_path=cm_path,
        fasta_path=fasta_path,
        gbff_path=gbff_path,
        workdir=workdir,
        cmsearch=cmsearch,
        control_replicates=control_replicates,
        control_seed=control_seed,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--cm",
        type=Path,
        required=True,
        help="Rfam 15.1 RF01116.cm extracted with cmfetch (SHA-256 pinned)",
    )
    parser.add_argument(
        "--fasta",
        type=Path,
        required=True,
        help="NCBI GCF_000817325.1_ASM81732v1_genomic.fna.gz as downloaded (pinned)",
    )
    parser.add_argument(
        "--gbff",
        type=Path,
        required=True,
        help="NCBI GCF_000817325.1_ASM81732v1_genomic.gbff.gz (pinned), for topology",
    )
    parser.add_argument(
        "--workdir",
        type=Path,
        required=True,
        help="fresh scratch directory for raw cmsearch input and output; must not exist",
    )
    parser.add_argument(
        "--cmsearch",
        type=Path,
        required=True,
        help="Infernal 1.1.5 cmsearch executable",
    )
    parser.add_argument("--json-out", type=Path, required=True, help="must not exist")
    parser.add_argument("--tsv-out", type=Path, required=True, help="must not exist")
    parser.add_argument("--control-replicates", type=int, default=5)
    parser.add_argument("--control-seed", type=int, default=20261012)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        preflight_paths(
            inputs={
                "covariance model": args.cm,
                "genome FASTA": args.fasta,
                "GenBank flat file": args.gbff,
                "cmsearch executable": args.cmsearch,
            },
            outputs={
                "work directory": args.workdir,
                "JSON report": args.json_out,
                "TSV report": args.tsv_out,
            },
        )
        report = run_pilot(
            cm_path=args.cm,
            fasta_path=args.fasta,
            gbff_path=args.gbff,
            workdir=args.workdir,
            cmsearch=args.cmsearch,
            control_replicates=args.control_replicates,
            control_seed=args.control_seed,
        )
        write_report(report, args.json_out, args.tsv_out)
    except RegulatoryRfamError as error:
        raise SystemExit(f"error: {error}") from error
    counts = report["counts"]
    print(
        f"model={report['model']['accession']} ({report['model']['name']}) "
        f"replicons={report['searchCoverage']['repliconCount']} "
        f"native_hits={counts['nativeLinearHits']} "
        f"origin_spanning={counts['originSpanningHits']} "
        f"overlapping_pairs={counts['overlappingNativePairs']} "
        f"control_hits={counts['controlHitsTotal']} "
        f"over {counts['controlReplicates']} replicates"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
