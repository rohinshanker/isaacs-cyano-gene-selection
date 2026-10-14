#!/usr/bin/env python3
"""Bounded IntaRNA window pilot; no transcript, target or browser admission claims."""

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
import platform
import random
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import unquote

from regulatory_transterm import (
    EXPECTED_REPLICON_LENGTHS, FASTA_SHA256, GFF_SHA256, load_fasta, sha256_file,
)

VERSION = "3.4.1"
SOURCE_URL = "https://github.com/BackofenLab/IntaRNA/releases/download/v3.4.1/intaRNA-3.4.1.tar.gz"
SOURCE_SHA256 = "4fd338a9a7a62f4398a27f41783120abaad9bccdecd39387c436adb0601f0ed8"
REPLICON = "NZ_CP006471.1"
LOCI = ("M744_RS07005", "M744_RS07010", "M744_RS00020")
EXAMPLE_TARGET = "CCCCCCCCGGGGGGGGGGGGGG"
EXAMPLE_QUERY = "AAAACCCCCCCUUUU"
FIELDS = (
    "id1", "id2", "seq1", "seq2", "start1", "end1", "start2", "end2",
    "E", "E_hybrid", "ED1", "ED2", "Pu1", "Pu2", "bpList",
    "seedStart1", "seedEnd1", "seedStart2", "seedEnd2", "seedE",
)
BASE_FLAGS = (
    "--model=X", "--mode=H", "--energy=V", "--temperature=37",
    "--seedBP=7", "--seedMaxUP=0", "--acc=C", "--accW=150", "--accL=100",
    "--outMode=C", "--outNumber=1", "--outBestSeedOnly", "--threads=1",
    "--tIdxPos0=1", "--qIdxPos0=1", "--outCsvCols=" + ",".join(FIELDS),
)
LIMITATION = (
    "Computational window interactions only. RF01116 is a homology interval, "
    "not a confirmed full transcript; CDS-start contexts are approximate inputs, "
    "not measured mRNAs or established sRNA targets. No genome-wide ranking, "
    "biological validation, calibrated regulatory probability or browser admission."
)


class PilotError(ValueError):
    """Invalid identity, input, output or runtime."""


@dataclasses.dataclass(frozen=True)
class Window:
    """Exact 5'-to-3' RNA input and optional unmodified native coordinate basis."""

    id: str
    sequence: str
    basis: str
    start: int | None = None
    end: int | None = None
    strand: str | None = None
    replicon: str | None = None
    annotation: str | None = None

    def __post_init__(self) -> None:
        if not re.fullmatch(r"[A-Za-z0-9_.-]+", self.id):
            raise PilotError("invalid sequence ID")
        if not 7 <= len(self.sequence) <= 200 or set(self.sequence) - set("ACGU"):
            raise PilotError("sequence must be 7..200 unambiguous RNA bases")
        coords = (self.start, self.end, self.strand, self.replicon)
        if any(value is not None for value in coords):
            if any(value is None for value in coords):
                raise PilotError("incomplete native coordinate basis")
            if self.strand not in ("+", "-") or self.start < 1:
                raise PilotError("invalid native coordinate basis")
            if self.end - self.start + 1 != len(self.sequence):
                raise PilotError("coordinate span differs from sequence length")

    def interval(self, start: int, end: int) -> dict | None:
        if not 1 <= start <= end <= len(self.sequence):
            raise PilotError("local interval outside input")
        if self.start is None:
            return None
        a, b = (self.start + start - 1, self.start + end - 1)
        if self.strand == "-":
            a, b = self.end - end + 1, self.end - start + 1
        return {"replicon": self.replicon, "start": a, "end": b,
                "strand": self.strand, "system": "one-based inclusive"}

    def document(self) -> dict:
        result = dataclasses.asdict(self)
        result["sequenceSha256"] = hashlib.sha256(self.sequence.encode()).hexdigest()
        result["coordinateSystem"] = "one-based inclusive, oriented local RNA"
        return result


def native_window(id: str, dna: str, start: int, end: int, strand: str,
                  annotation: str) -> Window:
    if not 1 <= start <= end <= len(dna) or strand not in ("+", "-"):
        raise PilotError("native window exceeds linear replicon or has invalid strand")
    sequence = dna[start - 1:end]
    if strand == "-":
        sequence = sequence.translate(str.maketrans("ACGT", "TGCA"))[::-1]
    return Window(id, sequence.replace("T", "U"), "native approximate window",
                  start, end, strand, REPLICON, annotation)


def prepare_native(fasta: Path, gff: Path) -> tuple[list[Window], list[Window]]:
    """Pin native bytes; use only three named CDS contexts and RF01116 ± flanks."""
    for path, pin in ((fasta, FASTA_SHA256), (gff, GFF_SHA256)):
        if sha256_file(path) != pin:
            raise PilotError(f"native input SHA-256 mismatch: {path.name}")
    sequences = load_fasta(fasta)
    if {key: len(value) for key, value in sequences.items()} != EXPECTED_REPLICON_LENGTHS:
        raise PilotError("native replicon identity/length mismatch")
    dna = sequences[REPLICON]
    cds = {}
    with gzip.open(gff, "rt", encoding="utf-8") as handle:
        for line in handle:
            if line.startswith("#"):
                continue
            fields = line.rstrip("\n").split("\t")
            if len(fields) != 9 or fields[2] != "CDS":
                continue
            attrs = dict(item.split("=", 1) for item in fields[8].split(";") if "=" in item)
            locus = unquote(attrs.get("locus_tag", ""))
            if locus not in LOCI:
                continue
            if locus in cds or fields[0] != REPLICON or fields[7] != "0":
                raise PilotError("duplicate, unexpected replicon or partial target CDS")
            cds[locus] = (int(fields[3]), int(fields[4]), fields[6], fields[8])
    if set(cds) != set(LOCI):
        raise PilotError("missing target CDS identities")
    queries = [native_window(f"RF01116-flank{flank}", dna,
                             1364716 - flank, 1364778 + flank, "+",
                             "RF01116 homology interval 1364716..1364778; transcript ends unknown")
               for flank in (0, 20, 50)]
    targets = []
    for locus in LOCI:
        start, end, strand, attrs = cds[locus]
        a, b = (start - 100, start + 49) if strand == "+" else (end - 49, end + 100)
        targets.append(native_window(locus, dna, a, b, strand,
                                     f"CDS {start}..{end}; {attrs}; 100 nt upstream + 50 coding nt"))
    return queries, targets


def execute(binary: Path, arguments: list[str], cwd: Path, timeout: float) -> str:
    try:
        result = subprocess.run([str(binary), *arguments], cwd=cwd, text=True,
                                capture_output=True, timeout=timeout, check=False,
                                env={**os.environ, "OMP_NUM_THREADS": "1", "LC_ALL": "C"})
    except (OSError, subprocess.TimeoutExpired) as error:
        raise PilotError(f"IntaRNA execution failed: {error}") from error
    if result.returncode:
        raise PilotError(f"IntaRNA exit {result.returncode}: {result.stderr[-2000:]} {result.stdout[-2000:]}")
    if result.stderr.strip():
        raise PilotError(f"IntaRNA stderr requires inspection: {result.stderr[-2000:]}")
    return result.stdout


def parse_report(raw: str, target: Window, query: Window, seed_bp: int = 7) -> list[dict]:
    """Refuse malformed, mismatched, out-of-bounds or inconsistent CSV reports."""
    reader = csv.DictReader(io.StringIO(raw), delimiter=";")
    if reader.fieldnames != list(FIELDS):
        raise PilotError("unexpected IntaRNA CSV schema")
    records = []
    for row in reader:
        if len(records) or None in row or any(value is None for value in row.values()):
            raise PilotError("unexpected row count/width")
        if (row["id1"], row["id2"], row["seq1"], row["seq2"]) != (
                target.id, query.id, target.sequence, query.sequence):
            raise PilotError("output input identity mismatch")
        try:
            for key in ("start1", "end1", "start2", "end2", "seedStart1", "seedEnd1", "seedStart2", "seedEnd2"):
                row[key] = int(row[key])
            for key in ("E", "E_hybrid", "ED1", "ED2", "Pu1", "Pu2", "seedE"):
                row[key] = float(row[key])
                if not math.isfinite(row[key]):
                    raise PilotError("non-finite energy/probability")
        except ValueError as error:
            raise PilotError(f"invalid numeric output: {error}") from error
        for index, window in ((1, target), (2, query)):
            a, b = row[f"start{index}"], row[f"end{index}"]
            sa, sb = row[f"seedStart{index}"], row[f"seedEnd{index}"]
            window.interval(a, b)
            if not a <= sa <= sb <= b or sb - sa + 1 != seed_bp:
                raise PilotError("invalid contiguous seed interval")
            if not 0 <= row[f"Pu{index}"] <= 1 or row[f"ED{index}"] < 0:
                raise PilotError("invalid accessibility value")
        if abs(row["E"] - row["E_hybrid"] - row["ED1"] - row["ED2"]) > 0.031:
            raise PilotError("energy components do not sum")
        if not re.fullmatch(r"\(\d+,\d+\)(:\(\d+,\d+\))*", row["bpList"]):
            raise PilotError("invalid base-pair list")
        pairs = [(int(a), int(b)) for a, b in re.findall(r"\((\d+),(\d+)\)", row["bpList"])]
        for number, (a, b) in enumerate(pairs):
            if not row["start1"] <= a <= row["end1"] or not row["start2"] <= b <= row["end2"]:
                raise PilotError("base pair outside interaction")
            if number and not (pairs[number-1][0] < a and pairs[number-1][1] > b):
                raise PilotError("base pairs must be unique and antiparallel")
            if target.sequence[a-1] + query.sequence[b-1] not in ("AU", "UA", "GC", "CG", "GU", "UG"):
                raise PilotError("noncomplementary base pair")
        if pairs[0] != (row["start1"], row["end2"]) or pairs[-1] != (row["end1"], row["start2"]):
            raise PilotError("interaction endpoints do not match pairs")
        seed_pairs = [(a, b) for a, b in pairs if row["seedStart1"] <= a <= row["seedEnd1"]
                      and row["seedStart2"] <= b <= row["seedEnd2"]]
        expected_seed = [(row["seedStart1"] + i, row["seedEnd2"] - i) for i in range(seed_bp)]
        if seed_pairs != expected_seed:
            raise PilotError("reported seed not present in base-pair list")
        row["basePairs"] = [{"targetLocal": a, "queryLocal": b,
                             "targetNative": target.interval(a, a),
                             "queryNative": query.interval(b, b)} for a, b in pairs]
        row["targetNativeInterval"] = target.interval(row["start1"], row["end1"])
        row["queryNativeInterval"] = query.interval(row["start2"], row["end2"])
        records.append(row)
    return records


def shuffled(query: Window, seed: int) -> Window:
    value = int.from_bytes(hashlib.sha256(f"{seed}:{query.id}".encode()).digest(), "big")
    sequence = list(query.sequence)
    random.Random(value).shuffle(sequence)
    return Window(query.id + "-shuffled", "".join(sequence),
                  f"synthetic mononucleotide shuffle; source={query.id}; seed={seed}")


def disrupted(query: Window, target: Window, record: dict) -> Window:
    """Replace each reported best-seed query base by its target partner base."""
    sequence = list(query.sequence)
    for i in range(record["seedEnd1"] - record["seedStart1"] + 1):
        a, b = record["seedStart1"] + i, record["seedEnd2"] - i
        sequence[b - 1] = target.sequence[a - 1]
    return Window(query.id + "-disrupted", "".join(sequence),
                  f"synthetic best-seed mutation; source={query.id}; original seed="
                  f"{record['seedStart2']}..{record['seedEnd2']}; no native mutant coordinates")


def run_interaction(binary: Path, target: Window, query: Window, directory: Path,
                    timeout: float, variant: str = "default") -> tuple[str, list[dict], list[str]]:
    for name, window in (("target.fa", target), ("query.fa", query)):
        (directory / name).write_text(f">{window.id}\n{window.sequence}\n", encoding="utf-8")
    flags = list(BASE_FLAGS)
    if variant == "global_accessibility":
        flags[flags.index("--accW=150")] = "--accW=0"
        flags[flags.index("--accL=100")] = "--accL=0"
    elif variant == "seed6":
        flags[flags.index("--seedBP=7")] = "--seedBP=6"
    elif variant != "default":
        raise PilotError("unknown parameter variant")
    command = ["--target=target.fa", "--query=query.fa", *flags]
    raw = execute(binary, command, directory, timeout)
    return raw, parse_report(raw, target, query, 6 if variant == "seed6" else 7), command


def publish(output: Path, files: dict[str, str]) -> None:
    """Exclusive publication; remove only this run's directory on any failure."""
    output.mkdir(parents=True, exist_ok=False)
    try:
        for name, value in files.items():
            with (output / name).open("x", encoding="utf-8", newline="") as handle:
                handle.write(value)
    except BaseException as error:
        try:
            shutil.rmtree(output)
        except OSError as cleanup_error:
            error.add_note(f"partial output cleanup failed: {output}: {cleanup_error}")
        raise


def run_pilot(arguments: argparse.Namespace) -> dict:
    if not math.isfinite(arguments.timeout_seconds) or arguments.timeout_seconds <= 0:
        raise PilotError("timeout must be finite and positive")
    if arguments.output_dir.exists() or arguments.output_dir.is_symlink():
        raise PilotError("refusing existing output directory")
    binary = arguments.intarna.resolve()
    if not binary.is_file() or not os.access(binary, os.X_OK):
        raise PilotError("missing/nonexecutable IntaRNA binary")
    if sha256_file(arguments.source_archive) != SOURCE_SHA256:
        raise PilotError("official source archive SHA-256 mismatch")
    queries, targets = prepare_native(arguments.fasta, arguments.gff)
    runs, files = [], {}
    with tempfile.TemporaryDirectory(prefix="intarna-pilot-") as tmp:
        directory = Path(tmp)
        version = execute(binary, ["--version"], directory, arguments.timeout_seconds)
        if not re.search(r"(?m)^IntaRNA 3\.4\.1(?:\s|$)", version):
            raise PilotError("expected IntaRNA 3.4.1 version banner")
        files["version.txt"] = version
        files["fullhelp.txt"] = execute(binary, ["--fullhelp"], directory, arguments.timeout_seconds)

        def add(name: str, target: Window, query: Window, kind: str,
                variant: str = "default") -> list[dict]:
            raw, records, command = run_interaction(binary, target, query, directory,
                                                     arguments.timeout_seconds, variant)
            files[name + ".csv"] = raw
            files[name + "-target.fa"] = f">{target.id}\n{target.sequence}\n"
            files[name + "-query.fa"] = f">{query.id}\n{query.sequence}\n"
            overlap = None
            if target.start is not None and query.start is not None:
                overlap = (max(0, min(target.end, query.end) - max(target.start, query.start) + 1)
                           if target.replicon == query.replicon else 0)
            runs.append({"name": name, "kind": kind, "variant": variant,
                         "target": target.document(), "query": query.document(),
                         "nativeInputOverlapNt": overlap,
                         "command": command, "records": records,
                         "status": "interaction" if records else "no_reported_interaction",
                         "rawSha256": hashlib.sha256(raw.encode()).hexdigest()})
            return records

        target = Window("official-target", EXAMPLE_TARGET, "official README synthetic example")
        query = Window("official-query", EXAMPLE_QUERY, "official README synthetic example")
        example = add("official-example", target, query, "runtime_positive_control")
        if not example or (example[0]["start1"], example[0]["end1"], example[0]["start2"], example[0]["end2"]) != (9, 15, 5, 11):
            raise PilotError("official example failed to recover documented interaction")
        if abs(example[0]["E"] - (-10.85)) > 0.1:
            raise PilotError("official example energy differs from documented value")
        add("official-shuffled", target, shuffled(query, arguments.shuffle_seed), "shuffle_control")
        add("official-disrupted", target, disrupted(query, target, example[0]), "seed_disruption_control")
        for query in queries:
            for target in targets:
                name = f"{query.id}-{target.id}"
                records = add(name, target, query, "native_window_interaction")
                add(name + "-shuffled", target, shuffled(query, arguments.shuffle_seed), "shuffle_control")
                if records:
                    add(name + "-disrupted", target, disrupted(query, target, records[0]), "seed_disruption_control")
                add(name + "-global", target, query, "parameter_sensitivity", "global_accessibility")
                add(name + "-seed6", target, query, "parameter_sensitivity", "seed6")
    payload = {
        "schemaVersion": 1, "method": "IntaRNA", "recordOrigin": "computed",
        "evidenceBasis": "proxy", "interpretation": LIMITATION,
        "assembly": "GCF_000817325.1_ASM81732v1", "scoreUnits": "kcal/mol",
        "scoreMeaning": "E = E_hybrid + ED1 + ED2; lower energy favors the modeled interaction",
        "controlLimitations": "One shuffle per query; neither shuffled nor disrupted RNAs are biological negatives. Mutation may relocate the optimal site and changes folding as well as pairing.",
        "skippedDisruptions": [run["name"] for run in runs if run["kind"] == "native_window_interaction" and not run["records"]],
        "parameters": {"baseFlags": list(BASE_FLAGS), "otherParameters": "IntaRNA 3.4.1 defaults; retained fullhelp.txt", "shuffleSeed": arguments.shuffle_seed,
                       "shuffleAlgorithm": "Python Random.shuffle seeded by SHA256(seed:queryID), mononucleotide composition preserved"},
        "provenance": {"sourceUrl": SOURCE_URL, "sourceSha256": SOURCE_SHA256,
                       "binarySha256": sha256_file(binary), "versionBanner": version,
                       "fastaSha256": sha256_file(arguments.fasta), "gffSha256": sha256_file(arguments.gff),
                       "platform": platform.platform(), "python": platform.python_version(),
                       "binaryAttestation": "version and executable hash recorded; source hash alone is not proof of binary derivation; retain build/dependency receipts"},
        "runs": runs,
    }
    files["pilot.json"] = json.dumps(payload, indent=2, sort_keys=True, allow_nan=False) + "\n"
    publish(arguments.output_dir, files)
    return payload


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    for flag in ("intarna", "source-archive", "fasta", "gff", "output-dir"):
        result.add_argument("--" + flag, type=Path, required=True)
    result.add_argument("--timeout-seconds", type=float, default=60)
    result.add_argument("--shuffle-seed", type=int, default=2973)
    return result


def main() -> None:
    try:
        payload = run_pilot(parser().parse_args())
    except (PilotError, OSError, UnicodeError, EOFError) as error:
        raise SystemExit(f"error: {error}") from error
    print(json.dumps({"status": "ok", "runs": len(payload["runs"]),
                      "interactions": sum(bool(run["records"]) for run in payload["runs"])}))


if __name__ == "__main__":
    main()
