#!/usr/bin/env python3
"""Evaluate the pinned E. coli promoter model around native UTEX gTSS anchors.

This bounded, non-release pilot does not fit a model, call genomic promoters or
interpret the model's rates as UTEX measurements. See regulatory-promoter.md.
"""

from __future__ import annotations

import argparse
from collections import Counter
import csv
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import platform
import random
import shutil
import statistics
import sys

import prepare_promoter_calculator as preparation
from regulatory_transterm import (
    EXPECTED_REPLICON_LENGTHS, FASTA_SHA256, load_fasta, sha256_file,
)

TSS_SHA256 = "d06524cf492aa8f009bf004c596a5d305ac54acbe7537ec98bbc7992ce164bff"
MODEL_HOST = "Escherichia coli str. K-12 substr. MG1655"
UPSTREAM = 87
DOWNSTREAM = 40
RADIUS = 20
ANCHOR_INDEX = UPSTREAM
LENGTH = UPSTREAM + DOWNSTREAM + 1
COMPLEMENT = str.maketrans("ACGT", "TGCA")
FEATURES = ("UP", "hex35", "spacer", "hex10", "disc")


def digest(text: str) -> str:
    """Hash UTF-8 strings used for reproducible selection and sequence identity."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def verify_inputs(fasta: Path, tss: Path, prepared: Path) -> dict:
    """Validate immutable inputs, including model bytes rather than its manifest."""
    for path, expected in ((fasta, FASTA_SHA256), (tss, TSS_SHA256)):
        if sha256_file(path) != expected:
            raise ValueError(f"Input checksum mismatch: {path}")
    hashes = {**preparation.SOURCE_HASHES, **preparation.ADAPTED_HASHES}
    for name, expected in hashes.items():
        if sha256_file(prepared / name) != expected:
            raise ValueError(f"Prepared model checksum mismatch: {name}")
    return {"fasta_sha256": FASTA_SHA256, "tss_sha256": TSS_SHA256,
            "upstream_commit": preparation.UPSTREAM_COMMIT,
            "prepared_files_sha256": hashes}


def load_anchors(path: Path, sequences: dict[str, str]) -> list[dict]:
    """Read one gTSS row per anchor, without pooling condition measurements."""
    anchors = []
    seen = set()
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        required = {"tss_id", "replicon", "type", "strand", "position", "locus_tag"}
        if not required.issubset(reader.fieldnames or ()):
            raise ValueError("TSS table is missing required columns")
        for row in reader:
            replicon = f"NZ_{row['replicon']}.1"
            position = int(row["position"])
            if (row["type"] != "gTSS" or row["strand"] not in ("+", "-")
                    or replicon not in sequences or not row["locus_tag"]
                    or not row["tss_id"]):
                raise ValueError("Invalid gTSS identity")
            if not 1 <= position <= len(sequences[replicon]):
                raise ValueError("TSS position outside replicon")
            identity = (replicon, row["strand"], position)
            if identity in seen:
                raise ValueError("Duplicate TSS coordinate")
            seen.add(identity)
            anchors.append({"id": row["tss_id"], "replicon": replicon,
                            "strand": row["strand"], "position": position,
                            "locus": row["locus_tag"]})
    if not anchors:
        raise ValueError("Empty gTSS cohort")
    return anchors


def oriented_window(anchor: dict, sequence: str) -> tuple[str, list[int]]:
    """Return transcription-oriented bases and their one-based circular positions."""
    if (len(sequence) < LENGTH
            or anchor["strand"] not in ("+", "-")
            or not 1 <= anchor["position"] <= len(sequence)):
        raise ValueError("Invalid native window input")
    direction = 1 if anchor["strand"] == "+" else -1
    positions = [((anchor["position"] - 1 + direction * offset) % len(sequence)) + 1
                 for offset in range(-UPSTREAM, DOWNSTREAM + 1)]
    bases = "".join(sequence[p - 1] for p in positions)
    if set(bases) - set("ACGT"):
        raise ValueError("Invalid native window input")
    if direction == -1:
        bases = bases.translate(COMPLEMENT)
    return bases, positions


def select_cohort(anchors: list[dict], sequences: dict[str, str],
                  max_sites: int, seed: int) -> tuple[list[dict], dict]:
    """Select before scoring; omit repeated loci, physical overlap and duplicates.

    No UTEX data fit the model. These exclusions reduce correlated observations;
    they are not proof that the selected sequences lack distant homology.
    """
    if not 1 <= max_sites <= 2475 or seed < 0:
        raise ValueError("max-sites must be 1..2475 and seed must be nonnegative")
    selected, loci, sequence_keys = [], set(), set()
    occupied = {replicon: set() for replicon in sequences}
    excluded = Counter()
    for anchor in sorted(anchors, key=lambda row: digest(f"{seed}:{row['id']}")):
        sequence, positions = oriented_window(anchor, sequences[anchor["replicon"]])
        key = min(sequence, sequence.translate(COMPLEMENT)[::-1])
        if anchor["locus"] in loci:
            excluded["same_locus"] += 1
        elif occupied[anchor["replicon"]].intersection(positions):
            excluded["overlapping_window"] += 1
        elif key in sequence_keys:
            excluded["identical_or_reverse_complement_window"] += 1
        elif len(selected) >= max_sites:
            excluded["sample_limit"] += 1
        else:
            selected.append({**anchor, "sequence": sequence,
                             "native_positions": positions})
            loci.add(anchor["locus"])
            sequence_keys.add(key)
            occupied[anchor["replicon"]].update(positions)
    return selected, dict(excluded)


def load_calculator(prepared: Path):
    """Import the verified standalone model without leaking its util module."""
    def module(name, path):
        spec = importlib.util.spec_from_file_location(name, path)
        result = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(result)
        return result

    previous = sys.modules.get("util")
    try:
        sys.modules["util"] = module("util", prepared / "util.py")
        implementation = module("_pinned_promoter", prepared / "Promoter_Calculator_v1_0.py")
        return implementation.Promoter_Calculator(organism=MODEL_HOST)
    finally:
        if previous is None:
            sys.modules.pop("util", None)
        else:
            sys.modules["util"] = previous


def score_window(calculator, sequence: str) -> dict:
    """Validate every full-coverage state and summarize without a fitted cutoff."""
    indices = range(ANCHOR_INDEX - RADIUS, ANCHOR_INDEX + RADIUS + 1)
    states, layouts = calculator.predict(sequence, [indices.start, indices.stop])
    if set(states) != set(indices) or set(layouts) != set(indices):
        raise ValueError("Model omitted requested full-coverage starts")
    curve = []
    for i in indices:
        state = states[i]
        if state["TSS"] != i or len(layouts[i]) != 30:
            raise ValueError("Incomplete model layout coverage or TSS mismatch")
        energy, rate = float(state["dG_total"]), float(state["Tx_rate"])
        if not math.isfinite(energy) or not math.isfinite(rate) or rate <= 0:
            raise ValueError("Nonfinite energy or invalid model rate")
        if state["ITR"] != sequence[i:i + 20]:
            raise ValueError("Model ITR sequence mismatch")
        for feature in FEATURES:
            start, end = state[feature + "_position"]
            if not 0 <= start < end <= i or sequence[start:end] != state[feature]:
                raise ValueError("Model component sequence/coordinate mismatch")
        curve.append({"offset_nt": i - ANCHOR_INDEX,
                      "dG_total": energy, "ecoli_model_Tx_rate": rate})
    best_energy = min(row["dG_total"] for row in curve)
    best = [row["offset_nt"] for row in curve if row["dG_total"] == best_energy]
    anchor_energy = curve[RADIUS]["dG_total"]
    # Retain every tied best offset. Do not break ties toward the known TSS.
    return {"score_curve": curve, "best_offsets_nt": best,
            "anchor_energy_rank_best": 1 + sum(row["dG_total"] < anchor_energy for row in curve),
            "anchor_energy_rank_worst": sum(row["dG_total"] <= anchor_energy for row in curve),
            "best_distance_min_nt": min(abs(offset) for offset in best),
            "best_distance_max_nt": max(abs(offset) for offset in best)}


def evaluate(calculator, selected: list[dict], seed: int) -> list[dict]:
    """Score native and deterministic mononucleotide-shuffled sequence pairs."""
    results = []
    for anchor in selected:
        sequence = anchor["sequence"]
        shuffled = list(sequence)
        random.Random(f"{seed}:{anchor['id']}").shuffle(shuffled)
        shuffled = "".join(shuffled)
        native_score = score_window(calculator, sequence)
        results.append({
            **anchor, "sequence_sha256": digest(sequence),
            "native": native_score,
            "best_native_tss_positions": [anchor["native_positions"][ANCHOR_INDEX + offset]
                                          for offset in native_score["best_offsets_nt"]],
            "control": {"sequence": shuffled, "sequence_sha256": digest(shuffled),
                        "kind": "mononucleotide shuffle; no native coordinates",
                        "identical_to_native": shuffled == sequence,
                        **score_window(calculator, shuffled)},
        })
    return results


def summarize(results: list[dict]) -> dict:
    """Return descriptive localization/ranking counts, never biological accuracy."""
    if not results:
        raise ValueError("Cannot summarize an empty cohort")
    summary = {"anchors": len(results),
               "strands": dict(Counter(row["strand"] for row in results)),
               "replicons": dict(Counter(row["replicon"] for row in results))}
    for arm in ("native", "control"):
        values = [row[arm] for row in results]
        summary[arm] = {
            "any_best_within_5nt": sum(row["best_distance_min_nt"] <= 5 for row in values),
            "all_best_within_5nt": sum(row["best_distance_max_nt"] <= 5 for row in values),
            "median_anchor_rank_best": statistics.median(row["anchor_energy_rank_best"] for row in values),
            "median_anchor_rank_worst": statistics.median(row["anchor_energy_rank_worst"] for row in values),
        }
    return summary


def run(fasta: Path, tss: Path, prepared: Path, output: Path,
        max_sites: int = 128, seed: int = 2973) -> dict:
    """Run the bounded pilot into a fresh directory, removing partial output."""
    provenance = verify_inputs(fasta, tss, prepared)
    sequences = load_fasta(fasta)
    if {key: len(value) for key, value in sequences.items()} != EXPECTED_REPLICON_LENGTHS:
        raise ValueError("Native replicon set/length mismatch")
    anchors = load_anchors(tss, sequences)
    selected, excluded = select_cohort(anchors, sequences, max_sites, seed)
    output.mkdir()
    try:
        calculator = load_calculator(prepared)
        results = evaluate(calculator, selected, seed)
        report = {
            "schema_version": 1,
            "scope": "Exploratory native-UTEX localization pilot; no regulatory site admission",
            "model_host": MODEL_HOST,
            "limitations": [
                "E. coli calibration is not UTEX calibration; model rates are not measurements",
                "TSS anchors are initiation bases, not full promoter boundaries",
                "No UTEX training or tuning; fixed 5-nt descriptive localization radius",
                "Distinct loci/nonoverlapping windows are not independent ortholog blocks",
                "Shuffled windows are synthetic backgrounds, not verified biological negatives",
                "A bounded TSS-centered sample does not estimate genome-wide specificity",
            ],
            "inputs": provenance,
            "runtime": {"python": platform.python_version(),
                        **{name: sys.modules[name].__version__ for name in ("numpy", "sklearn")}},
            "parameters": {"max_sites": max_sites, "seed": seed,
                           "upstream_nt": UPSTREAM, "downstream_nt": DOWNSTREAM,
                           "candidate_offset_range_inclusive": [-RADIUS, RADIUS],
                           "coordinate_basis": "1-based circular native positions in transcription order",
                           "layouts_per_candidate": 30,
                           "control": "One mononucleotide shuffle per oriented window"},
            "cohort": {"input_anchors": len(anchors), "excluded": excluded},
            "summary": summarize(results), "results": results,
        }
        (output / "report.json").write_text(
            json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
        return report
    except BaseException as error:
        try:
            shutil.rmtree(output)
        except OSError as cleanup_error:
            error.add_note(f"Cleanup failed; partial output may remain at {output}: {cleanup_error}")
        raise


def main(argv: list[str] | None = None) -> int:
    """Command-line entry point; all inputs and the fresh output are explicit."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fasta", required=True, type=Path)
    parser.add_argument("--tss", required=True, type=Path)
    parser.add_argument("--prepared", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--max-sites", type=int, default=128)
    parser.add_argument("--seed", type=int, default=2973)
    args = parser.parse_args(argv)
    try:
        report = run(args.fasta, args.tss, args.prepared, args.output, args.max_sites, args.seed)
    except (OSError, ValueError, ImportError) as error:
        print(f"Promoter pilot failed: {error}", file=sys.stderr)
        for note in getattr(error, "__notes__", ()):
            print(note, file=sys.stderr)
        return 1
    print(json.dumps(report["summary"], sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
