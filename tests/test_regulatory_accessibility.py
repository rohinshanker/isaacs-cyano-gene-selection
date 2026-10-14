"""Tests for the ViennaRNA local accessibility interval producer."""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import importlib.util
import io
import json
import math
import os
import random
import re
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "regulatory_accessibility", ROOT / "tools/regulatory_accessibility.py"
)
accessibility = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = accessibility  # dataclasses resolve their module
SPEC.loader.exec_module(accessibility)
AccessibilityError = accessibility.AccessibilityError
PINNED_FASTA = ROOT / "data/raw/GCF_000817325.1_ASM81732v1_genomic.fna.gz"
HEADER = "\t".join(accessibility.WINDOW_FIELDS) + "\n"
UP_KIND = 8192 | 15  # PROBS_WINDOW_UP | ANY_LOOP in ViennaRNA 2.7.2


@pytest.fixture(scope="module")
def rna():
    module = pytest.importorskip("RNA")
    if module.__version__ != accessibility.VIENNARNA_VERSION:
        pytest.skip(f"ViennaRNA {accessibility.VIENNARNA_VERSION} is required")
    return module


def genome() -> dict[str, str]:
    return {"chr": random_sequence(2973, 60), "lin": random_sequence(2974, 40)}


def random_sequence(seed: int, length: int) -> str:
    generator = random.Random(seed)
    return "".join(generator.choice("ACGT") for _ in range(length))


def write_fasta(path: Path, sequences: dict[str, str]) -> Path:
    path.write_text("".join(f">{key} fixture\n{value}\n" for key, value in sequences.items()))
    return path


def fixture_pins(fasta: Path) -> accessibility.Pins:
    sequences = genome()
    return accessibility.Pins(
        assembly="fixture",
        fasta_sha256=hashlib.sha256(fasta.read_bytes()).hexdigest(),
        replicons={"chr": (len(sequences["chr"]), True), "lin": (len(sequences["lin"]), False)},
    )


def write_windows(path: Path, *rows: str) -> Path:
    path.write_text(HEADER + "".join(row + "\n" for row in rows), encoding="utf-8")
    return path


def window(window_id="w", replicon="chr", start=1, end=30, strand="+", anchor=None, length=60):
    wraps = start > end
    span = end - start + 1 if not wraps else length - start + 1 + end
    return accessibility.Window(window_id, replicon, start, end, strand, anchor, "", span, wraps)


def params(u=4, w=20, span=15, temperature=37.0):
    return accessibility.Parameters(u, w, span, temperature)


def arguments(tmp_path: Path, fasta: Path, windows: Path, out: str = "out", **overrides):
    directory = tmp_path / out
    directory.mkdir(exist_ok=True)
    values = {
        "fasta": fasta, "windows": windows, "segment_length": 4, "folding_window": 20,
        "max_bp_span": 15, "temperature": 37.0, "shuffle_replicates": 2,
        "shuffle_seed": 7, "json_out": directory / "a.json", "tsv_out": directory / "a.tsv",
    }
    values.update(overrides)
    return argparse.Namespace(**values)


def reverse_complement(sequence: str) -> str:
    return sequence.translate(accessibility.COMPLEMENT)[::-1]


def native_slice(sequence: str, low: int, high: int) -> str:
    return sequence[low - 1:high] if low <= high else sequence[low - 1:] + sequence[:high]


def load_fasta(path: Path) -> dict[str, str]:
    return accessibility.parse_fasta(path.read_bytes(), path.name)


def parse_windows(path: Path, pins) -> list:
    return accessibility.parse_windows(path.read_bytes(), path.name, pins)


def file_sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


# FASTA and assembly identity


def test_load_fasta_reads_plain_and_gzip(tmp_path):
    plain = tmp_path / "g.fna"
    plain.write_text(">a desc\nacg\nT\n\n>b\nGG\n")
    assert load_fasta(plain) == {"a": "ACGT", "b": "GG"}
    compressed = tmp_path / "g.fna.gz"
    with gzip.open(compressed, "wt") as handle:
        handle.write(">a\nAC\n")
    assert load_fasta(compressed) == {"a": "AC"}


@pytest.mark.parametrize(("text", "message"), (
    (">\nAC\n", "empty FASTA identifier"),
    (">a\nA\n>a\nC\n", "duplicate FASTA ID a"),
    ("AC\n", "sequence before FASTA header"),
    (">a\nACNU\n", "non-ACGT bases NU"),
    ("\n", "no FASTA records"),
    (">a\n>b\nA\n", "empty FASTA records: a"),
))
def test_load_fasta_rejects_malformed_input(tmp_path, text, message):
    path = tmp_path / "g.fna"
    path.write_text(text)
    with pytest.raises(AccessibilityError, match=message):
        load_fasta(path)


def test_unreadable_or_corrupt_input_is_reported(tmp_path):
    with pytest.raises(AccessibilityError, match="could not read FASTA"):
        accessibility.read_snapshot(tmp_path, "FASTA")
    with pytest.raises(AccessibilityError, match="could not read FASTA g.fna.gz"):
        accessibility.parse_fasta(b">a\nAC\n", "g.fna.gz")
    with pytest.raises(AccessibilityError, match="could not read FASTA g.fna:"):
        accessibility.parse_fasta(b">a\n\xffAC\n", "g.fna")


def test_validate_assembly_lists_every_mismatch(tmp_path):
    fasta = write_fasta(tmp_path / "g.fna", genome())
    pins = fixture_pins(fasta)
    accessibility.validate_assembly(file_sha(fasta), load_fasta(fasta), pins)
    changed = genome()
    changed["chr"] = changed["chr"][:-1]
    other = write_fasta(tmp_path / "other.fna", changed)
    with pytest.raises(AccessibilityError) as error:
        accessibility.validate_assembly(file_sha(other), load_fasta(other), pins)
    assert "FASTA SHA-256" in str(error.value) and "replicons" in str(error.value)
    reordered = write_fasta(tmp_path / "reordered.fna", dict(reversed(genome().items())))
    with pytest.raises(AccessibilityError, match="replicons"):
        accessibility.validate_assembly(
            file_sha(reordered), load_fasta(reordered),
            accessibility.Pins("fixture", hashlib.sha256(reordered.read_bytes()).hexdigest(),
                               pins.replicons),
        )


# Window table


def test_parse_windows_accepts_plus_minus_origin_and_anchor(tmp_path):
    fasta = write_fasta(tmp_path / "g.fna", genome())
    path = write_windows(
        tmp_path / "w.tsv",
        "p\tchr\t5\t34\t+\t10\tplus",
        "m\tchr\t5\t34\t-\t\tminus",
        "o\tchr\t51\t20\t-\t1\torigin",
    )
    windows = parse_windows(path, fixture_pins(fasta))
    assert [(item.window_id, item.length, item.wraps_origin, item.anchor) for item in windows] == [
        ("p", 30, False, 10), ("m", 30, False, None), ("o", 30, True, 1),
    ]


@pytest.mark.parametrize(("row", "message"), (
    ("w\tchr\t1\t30\t+\t", "expected 7 columns"),
    ("-w\tchr\t1\t30\t+\t\t", "invalid window_id"),
    ("w\tplasmid\t1\t30\t+\t\t", "not in pinned fixture"),
    ("w\tchr\t1\tx\t+\t\t", "positive decimal integer"),
    ("w\tchr\t-1\t30\t+\t\t", "positive decimal integer"),
    ("w\tchr\t1\t30\t+\t1.5\t", "positive decimal integer"),
    ("w\tchr\t0\t30\t+\t\t", "outside 1..60"),
    ("w\tchr\t1\t61\t+\t\t", "outside 1..60"),
    ("w\tchr\t1\t30\t.\t\t", "strand must be"),
    ("w\tlin\t30\t5\t+\t\t", "crosses the origin of linear lin"),
    ("w\tchr\t1\t60\t+\t\t", "shorter than replicon"),
    ("w\tchr\t31\t30\t+\t\t", "shorter than replicon"),
    ("w\tchr\t1\t30\t+\t31\t", "anchor 31 is outside"),
    ("w\tchr\t51\t20\t+\t30\t", "anchor 30 is outside"),
    ("w\tchr\t1\t30\t+\t61\t", "anchor 61 is outside"),
))
def test_parse_windows_rejects_bad_rows(tmp_path, row, message):
    fasta = write_fasta(tmp_path / "g.fna", genome())
    path = write_windows(tmp_path / "w.tsv", row)
    with pytest.raises(AccessibilityError, match=message):
        parse_windows(path, fixture_pins(fasta))


def test_parse_windows_rejects_table_level_problems(tmp_path, monkeypatch):
    fasta = write_fasta(tmp_path / "g.fna", genome())
    pins = fixture_pins(fasta)
    cases = (
        ("window\treplicon\n", "header must be"),
        ("", "header must be"),
        (HEADER, "no windows"),
        (HEADER + "a\tchr\t1\t30\t+\t\t\na\tchr\t2\t30\t+\t\t\n", "duplicate window_id a"),
        (HEADER + "a\tchr\t1\t30\t+\t\t\nb\tchr\t1\t30\t+\t\t\n", "duplicate interval"),
    )
    path = tmp_path / "w.tsv"
    for text, message in cases:
        path.write_text(text)
        with pytest.raises(AccessibilityError, match=message):
            parse_windows(path, pins)
    path.write_bytes(b"\xff\xfe")
    with pytest.raises(AccessibilityError, match="could not read windows"):
        parse_windows(path, pins)
    monkeypatch.setattr(accessibility, "MAX_WINDOW_NT", 10)
    path.write_text(HEADER + "a\tchr\t1\t11\t+\t\t\n")
    with pytest.raises(AccessibilityError, match="exceeds 10"):
        parse_windows(path, pins)
    monkeypatch.setattr(accessibility, "MAX_WINDOWS", 1)
    path.write_text(HEADER + "a\tchr\t1\t5\t+\t\t\nb\tchr\t2\t6\t+\t\t\n")
    with pytest.raises(AccessibilityError, match="2 windows exceed 1"):
        parse_windows(path, pins)


# Coordinates


@pytest.mark.parametrize(("start", "end", "strand"), (
    (5, 34, "+"), (5, 34, "-"), (51, 20, "+"), (51, 20, "-"), (31, 60, "-"), (1, 30, "+"),
))
def test_coordinates_round_trip_on_both_strands_and_the_origin(start, end, strand):
    sequences = genome()
    chromosome = sequences["chr"]
    item = window(start=start, end=end, strand=strand)
    oriented = accessibility.oriented_sequence(item, sequences)
    assert len(oriented) == item.length == 30
    for index in range(1, item.length + 1):
        position = accessibility.native_position(item, index, 60)
        base = chromosome[position - 1]
        assert oriented[index - 1] == (base if strand == "+" else reverse_complement(base))
        assert accessibility.oriented_index(item, position, 60) == index
    for length in (1, 4, 30):
        for oriented_end in range(length, item.length + 1):
            low, high = accessibility.segment_native_interval(item, oriented_end, length, 60)
            segment = native_slice(chromosome, low, high)
            if strand == "-":
                segment = reverse_complement(segment)
            assert segment == oriented[oriented_end - length:oriented_end]


def test_documented_minus_strand_formula_and_origin_wrap():
    item = window(start=51, end=20, strand="-")
    # oriented 1 is the native window end; a wrapped segment reports low > high.
    assert accessibility.native_position(item, 1, 60) == 20
    assert accessibility.segment_native_interval(item, 25, 10, 60) == (56, 5)
    plus = window(start=101, end=350, strand="+", length=1000)
    minus = window(start=101, end=350, strand="-", length=1000)
    w, length, k, e = 101, 250, 10, 40
    assert accessibility.segment_native_interval(plus, e, k, 1000) == (w + e - k, w + e - 1)
    assert accessibility.segment_native_interval(minus, e, k, 1000) == (w + length - e, w + length - e + k - 1)


def test_coordinate_helpers_reject_positions_outside_the_window():
    item = window(start=5, end=34)
    with pytest.raises(AccessibilityError, match="oriented index 31"):
        accessibility.native_position(item, 31, 60)
    with pytest.raises(AccessibilityError, match="oriented index 0"):
        accessibility.native_position(item, 0, 60)
    with pytest.raises(AccessibilityError, match="native position 35"):
        accessibility.oriented_index(item, 35, 60)
    with pytest.raises(AccessibilityError, match="extracted 16 bases"):
        accessibility.oriented_sequence(item, {"chr": "A" * 20})


def test_interior_flags_segments_whose_folding_windows_all_fit():
    parameters = params(u=4, w=20)
    flags = [accessibility.is_interior(end, parameters, 45) for end in range(4, 46)]
    interior = [end for end, flag in zip(range(4, 46), flags) if flag]
    assert interior == list(range(20, 30))  # end >= W and start <= n - W + 1
    assert not any(accessibility.is_interior(end, parameters, 30) for end in range(4, 31))


# Parameters


@pytest.mark.parametrize(("parameters", "replicates", "seed", "message"), (
    (params(u=0), 0, 0, "segment-length must be at least 1"),
    (params(u=4, w=4, span=4), 0, 0, "folding-window must be at least 5"),
    (params(u=21, w=20), 0, 0, "must not exceed --folding-window"),
    (params(span=4), 0, 0, "max-bp-span must be within"),
    (params(span=21), 0, 0, "max-bp-span must be within"),
    (params(temperature=math.nan), 0, 0, "temperature must be finite"),
    (params(temperature=math.inf), 0, 0, "temperature must be finite"),
    (params(temperature=-0.5), 0, 0, "temperature must be finite"),
    (params(temperature=100.5), 0, 0, "temperature must be finite"),
    (params(w=31, span=20), 0, 0, "exceeds window length for: w"),
    (params(), -1, 0, "shuffle-replicates must be within"),
    (params(), 101, 0, "shuffle-replicates must be within"),
    (params(), 0, -1, "shuffle-seed must be non-negative"),
))
def test_validate_parameters_rejects_values_viennarna_would_clamp_or_misuse(
    parameters, replicates, seed, message
):
    with pytest.raises(AccessibilityError, match=message):
        accessibility.validate_parameters(parameters, [window()], replicates, seed)


def test_validate_parameters_accepts_boundaries():
    accessibility.validate_parameters(params(u=30, w=30, span=30, temperature=0.0), [window()], 100, 0)
    accessibility.validate_parameters(params(u=1, w=5, span=5, temperature=100.0), [window()], 0, 0)


# Runtime and probabilities with the real engine


def test_check_runtime_records_installed_engine(rna):
    runtime = accessibility.check_runtime(rna)
    assert runtime["viennaRnaVersion"] == "2.7.2"
    assert runtime["extensionModule"].startswith("_RNA")
    assert len(runtime["extensionModuleSha256"]) == 64


def test_all_a_oracle_separates_padding_from_probabilities(rna):
    probabilities = accessibility.unpaired_probabilities(rna, "A" * 30, params(u=10, w=20, span=15))
    assert probabilities[:10] == [None] * 10
    assert all(abs(value - 1) < 1e-12 for value in probabilities[10:])
    # The simplified wrapper pads the same ends with zeros that look like measurements.
    matrix = rna.pfl_fold_up("A" * 30, 10, 20, 15)
    assert all(matrix[end][10] == 0 for end in range(1, 10))


def test_probs_window_matches_documented_wrapper_at_default_temperature(rna):
    sequence = random_sequence(11, 120)
    probabilities = accessibility.unpaired_probabilities(rna, sequence, params(u=10, w=80, span=60))
    matrix = rna.pfl_fold_up(sequence.replace("T", "U"), 10, 80, 60)
    assert all(probabilities[end] == matrix[end][10] for end in range(10, 121))


def test_temperature_reaches_the_engine(rna):
    sequence = random_sequence(5, 120)
    at37 = accessibility.unpaired_probabilities(rna, sequence, params(u=10, w=80, span=60))
    at25 = accessibility.unpaired_probabilities(rna, sequence, params(u=10, w=80, span=60, temperature=25.0))
    assert max(abs(a - b) for a, b in zip(at37[10:], at25[10:])) > 0.01
    assert rna.md().temperature == 37.0  # the run does not change process defaults


class FakeCompound:
    def __init__(self, calls, result=1, effective=(20, 15, 37.0)):
        self.calls = calls
        self.result = result
        window_size, span, temperature = effective
        self.params = SimpleNamespace(model_details=SimpleNamespace(
            window_size=window_size, max_bp_span=span, temperature=temperature,
        ))

    def probs_window(self, ulength, options, callback, data):
        for call in self.calls:
            callback(*call, data)
        return self.result


def fake_rna(real, compound=None, **overrides):
    values = {
        "__version__": "2.7.2", "md": real.md, "param": real.param, "exp_param": real.exp_param,
        "fold_compound": lambda sequence, model, option=None: (
            real.fold_compound(sequence, model) if option is None else compound
        ),
        "OPTION_WINDOW": real.OPTION_WINDOW, "PROBS_WINDOW_UP": real.PROBS_WINDOW_UP,
        "ANY_LOOP": real.ANY_LOOP,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def good_calls(n=20, u=4, value=0.5):
    calls = []
    for end in range(1, n + 1):
        size = min(u, end)
        values = [None] + [value] * size + [None] * (u - size)
        calls.append((values, size, end, u, UP_KIND))
    return calls


def test_fake_engine_baseline_is_accepted(rna):
    probabilities = accessibility.unpaired_probabilities(
        fake_rna(rna, FakeCompound(good_calls())), "A" * 20, params()
    )
    assert probabilities[:4] == [None] * 4 and probabilities[4:] == [0.5] * 17


def mutate(calls, end, *, values=None, size=None, max_size=None, kind=None):
    old_values, old_size, old_end, old_max, old_kind = calls[end - 1]
    calls[end - 1] = (
        old_values if values is None else values,
        old_size if size is None else size,
        old_end, old_max if max_size is None else max_size,
        old_kind if kind is None else kind,
    )
    return calls


@pytest.mark.parametrize(("calls", "message"), (
    (good_calls()[:-1], "every segment end exactly once"),
    (good_calls() + good_calls()[-1:], "every segment end exactly once"),
    (mutate(good_calls(), 5, kind=8192 | 1), "callback shape at segment end 5"),
    (mutate(good_calls(), 5, max_size=5), "callback shape at segment end 5"),
    (mutate(good_calls(), 5, values=[None, 0.5]), "callback shape at segment end 5"),
    (mutate(good_calls(), 2, size=4), "callback shape at segment end 2"),
    (mutate(good_calls(), 2, values=[None, 0.5, 0.5, 0.0, 0.0]), "defined a value at padding end 2"),
    (mutate(good_calls(), 6, values=[None, 0.5, 0.5, 0.5, None]), "undefined or out-of-range probability None"),
    (mutate(good_calls(), 6, values=[None, 0.5, 0.5, 0.5, math.nan]), "out-of-range probability nan"),
    (mutate(good_calls(), 6, values=[None, 0.5, 0.5, 0.5, 1.000001]), "out-of-range probability 1.000001"),
    (mutate(good_calls(), 6, values=[None, 0.5, 0.5, 0.5, -1e-6]), "out-of-range probability -1e-06"),
    (mutate(good_calls(), 6, values=[None, 0.5, 0.5, 0.5, 1]), "out-of-range probability 1 "),
))
def test_runtime_callback_contract_violations_are_rejected(rna, calls, message):
    with pytest.raises(AccessibilityError, match=message):
        accessibility.unpaired_probabilities(fake_rna(rna, FakeCompound(calls)), "A" * 20, params())


def test_tolerated_rounding_at_probability_bounds_is_kept(rna):
    calls = mutate(good_calls(), 6, values=[None, 0.5, 0.5, 0.5, 1 + 1e-12])
    calls = mutate(calls, 7, values=[None, 0.5, 0.5, 0.5, -1e-12])
    probabilities = accessibility.unpaired_probabilities(fake_rna(rna, FakeCompound(calls)), "A" * 20, params())
    assert probabilities[6] == 1 + 1e-12 and probabilities[7] == -1e-12


def test_engine_failure_and_silent_clamping_are_rejected(rna):
    with pytest.raises(AccessibilityError, match="probs_window reported failure"):
        accessibility.unpaired_probabilities(
            fake_rna(rna, FakeCompound(good_calls(), result=0)), "A" * 20, params()
        )
    with pytest.raises(AccessibilityError, match=r"used window/span/temperature \(20, 20, 37.0\)"):
        accessibility.unpaired_probabilities(
            fake_rna(rna, FakeCompound(good_calls(), effective=(20, 20, 37.0))), "A" * 20, params()
        )


def test_check_runtime_rejects_wrong_version_changed_defaults_and_energies(rna):
    with pytest.raises(AccessibilityError, match="'2.6.4' found, expected 2.7.2"):
        accessibility.check_runtime(fake_rna(rna, __version__="2.6.4"))

    def changed_model():
        model = rna.md()
        model.dangles = 0
        return model

    with pytest.raises(AccessibilityError, match=re.escape("default model changed: {'dangles': 0}")):
        accessibility.check_runtime(fake_rna(rna, md=changed_model))
    sequence, structure, mfe, ensemble = accessibility.ENERGY_FINGERPRINT
    for observed in ((("." * len(sequence)), mfe, ensemble), (structure, -13.5, ensemble),
                     (structure, mfe, -13.7)):  # the last differs only in Boltzmann factors
        with pytest.raises(AccessibilityError, match="energy fingerprint"):
            accessibility.check_runtime(
                fake_rna(rna, fold_compound=lambda *args, values=observed: FakeFingerprint(*values))
            )
    runtime = accessibility.check_runtime(fake_rna(rna))  # no compiled extension attribute
    assert runtime["extensionModule"] is None and runtime["extensionModuleSha256"] is None


class FakeFingerprint:
    def __init__(self, structure, mfe, ensemble):
        self.structure, self.energy, self.ensemble = structure, mfe, ensemble

    def mfe(self):
        return self.structure, self.energy

    def exp_params_rescale(self, energy):
        return None

    def pf(self):
        return self.structure, self.ensemble


def test_parameter_caches_are_replaced_with_an_unusable_sentinel_model(rna):
    requested = []
    recorder = fake_rna(
        rna,
        param=lambda model: requested.append(("param", model.temperature)),
        exp_param=lambda model: requested.append(("exp_param", model.temperature)),
    )
    accessibility.replace_parameter_caches(recorder)
    assert requested == [("param", -100.0), ("exp_param", -100.0)]
    assert requested[0][1] < accessibility.TEMPERATURE_RANGE_C[0]


def test_shuffle_is_deterministic_composition_preserving_and_keyed():
    sequence = genome()["chr"]
    first = accessibility.deterministic_shuffle(sequence, "7:1:w")
    assert first == accessibility.deterministic_shuffle(sequence, "7:1:w")
    assert sorted(first) == sorted(sequence) and first != sequence
    assert first != accessibility.deterministic_shuffle(sequence, "7:2:w")


# End-to-end with fixture pins


def fixture_run(tmp_path, out="out", **overrides):
    fasta = write_fasta(tmp_path / "g.fna", genome())
    windows = tmp_path / "w.tsv"
    if not windows.exists():
        write_windows(
            windows,
            "plus\tchr\t5\t48\t+\t10\tfixture plus",
            "origin-minus\tchr\t51\t20\t-\t1\tfixture origin",
            "linear\tlin\t2\t40\t-\t\tfixture linear",
        )
    namespace = arguments(tmp_path, fasta, windows, out=out, **overrides)
    return namespace, fasta, windows


def test_end_to_end_outputs_are_complete_consistent_and_reproducible(tmp_path, rna):
    namespace, fasta, windows = fixture_run(tmp_path)
    payload = accessibility._run(namespace, fixture_pins(fasta), rna)
    tsv = namespace.tsv_out.read_bytes()
    written = json.loads(namespace.json_out.read_text())
    assert written == payload
    assert payload["outputs"] == {"tsvSha256": hashlib.sha256(tsv).hexdigest(), "tsvRows": 41 + 27 + 36}
    assert payload["inputs"]["windows"]["sha256"] == hashlib.sha256(windows.read_bytes()).hexdigest()
    assert payload["parameters"]["otherModelSettings"]["window_size"] == 20
    assert payload["recordOrigin"] == "computed"
    assert "not measured accessibility" in payload["interpretation"]
    documents = {item["windowId"]: item for item in payload["windows"]}
    assert documents["plus"]["anchorOrientedIndex"] == 6
    assert documents["origin-minus"]["anchorOrientedIndex"] == 20
    assert documents["linear"]["anchorOrientedIndex"] is None
    assert len(documents["plus"]["shuffles"]) == 2
    assert documents["plus"]["comparison"]["shufflesAtLeastNative"] in {0, 1, 2}
    rows = list(csv.DictReader(io.StringIO(tsv.decode()), delimiter="\t"))
    sequences = genome()
    oriented_by_id = {
        item.window_id: accessibility.oriented_sequence(item, sequences)
        for item in parse_windows(windows, fixture_pins(fasta))
    }
    for row in rows:
        oriented = oriented_by_id[row["window_id"]]
        segment = native_slice(sequences[row["replicon"]], int(row["native_start"]), int(row["native_end"]))
        if row["strand"] == "-":
            segment = reverse_complement(segment)
        assert segment == oriented[int(row["oriented_start"]) - 1:int(row["oriented_end"])]
        assert row["wraps_origin"] == ("true" if int(row["native_start"]) > int(row["native_end"]) else "false")
    assert any(row["wraps_origin"] == "true" for row in rows)
    plus = genome()["chr"][4:48]
    matrix = rna.pfl_fold_up(plus.replace("T", "U"), 4, 20, 15)
    plus_rows = [row for row in rows if row["window_id"] == "plus"]
    assert [float(row["unpaired_probability"]) for row in plus_rows] == [matrix[end][4] for end in range(4, 45)]

    again, _, _ = fixture_run(tmp_path, out="again")
    accessibility._run(again, fixture_pins(fasta), rna)
    assert again.tsv_out.read_bytes() == tsv
    assert again.json_out.read_bytes() == namespace.json_out.read_bytes()


def test_no_shuffles_and_no_interior_report_null_comparisons(tmp_path, rna):
    namespace, fasta, _ = fixture_run(tmp_path, shuffle_replicates=0, folding_window=30, max_bp_span=20)
    payload = accessibility._run(namespace, fixture_pins(fasta), rna)
    comparison = payload["windows"][0]["comparison"]
    assert comparison["shuffleMean"] is None and comparison["shufflesAtLeastNative"] is None
    namespace, fasta, _ = fixture_run(tmp_path, out="interior", folding_window=30, max_bp_span=20)
    payload = accessibility._run(namespace, fixture_pins(fasta), rna)
    assert payload["windows"][0]["native"]["interiorMean"] is None
    assert payload["windows"][0]["comparison"]["shufflesAtLeastNative"] is None


@pytest.mark.parametrize(("override", "message"), (
    ({"segment_length": 25}, "segment-length must not exceed"),
    ({"temperature": 120.0}, "temperature must be finite"),
))
def test_invalid_parameters_write_nothing(tmp_path, rna, override, message):
    namespace, fasta, _ = fixture_run(tmp_path, **override)
    with pytest.raises(AccessibilityError, match=message):
        accessibility._run(namespace, fixture_pins(fasta), rna)
    assert not namespace.json_out.exists() and not namespace.tsv_out.exists()


def test_mismatched_inputs_and_runtime_write_nothing(tmp_path, rna):
    namespace, fasta, windows = fixture_run(tmp_path)
    with pytest.raises(AccessibilityError, match="'chr' is not in pinned GCF_000817325.1"):
        accessibility._run(namespace, accessibility.PINNED, rna)
    with pytest.raises(AccessibilityError, match="'2.6.4' found"):
        accessibility._run(namespace, fixture_pins(fasta), fake_rna(rna, __version__="2.6.4"))
    namespace.windows = tmp_path / "missing.tsv"
    with pytest.raises(AccessibilityError, match="could not read windows"):
        accessibility._run(namespace, fixture_pins(fasta), rna)
    assert list(namespace.json_out.parent.iterdir()) == []


# VA3: the recorded input identity is the identity of the bytes used


def edit_during_compute(monkeypatch, path: Path, edit):
    original = accessibility.compute

    def compute(*args, **kwargs):
        edit(path)
        return original(*args, **kwargs)

    monkeypatch.setattr(accessibility, "compute", compute)


@pytest.mark.parametrize("which", ("windows", "fasta"))
def test_input_edited_after_parsing_is_refused_without_outputs(tmp_path, rna, monkeypatch, which):
    namespace, fasta, windows = fixture_run(tmp_path)
    pins = fixture_pins(fasta)
    target = windows if which == "windows" else fasta
    edit_during_compute(
        monkeypatch, target,
        lambda path: path.write_bytes(path.read_bytes().replace(b"\t5\t48\t", b"\t6\t49\t")
                                      if which == "windows" else path.read_bytes() + b"\n"),
    )
    with pytest.raises(AccessibilityError, match=f"input {re.escape(str(target))} changed during the run"):
        accessibility._run(namespace, pins, rna)
    assert list(namespace.json_out.parent.iterdir()) == []


def test_input_removed_during_the_run_is_refused(tmp_path, rna, monkeypatch):
    namespace, fasta, windows = fixture_run(tmp_path)
    edit_during_compute(monkeypatch, windows, Path.unlink)
    with pytest.raises(AccessibilityError, match="became unreadable during the run"):
        accessibility._run(namespace, fixture_pins(fasta), rna)
    assert list(namespace.json_out.parent.iterdir()) == []


def test_recorded_windows_digest_is_the_parsed_snapshot(tmp_path, rna):
    namespace, fasta, windows = fixture_run(tmp_path)
    snapshot = windows.read_bytes()
    payload = accessibility._run(namespace, fixture_pins(fasta), rna)
    assert payload["inputs"]["windows"]["sha256"] == hashlib.sha256(snapshot).hexdigest()
    assert [item["nativeStart"] for item in payload["windows"]] == [
        item.start for item in accessibility.parse_windows(snapshot, windows.name, fixture_pins(fasta))
    ]


# VA1: process-wide ViennaRNA parameter state, in separate real-engine processes

ENGINE_SCENARIO = r"""
import importlib.util, json, sys
import RNA
spec = json.loads(sys.argv[1])
module_spec = importlib.util.spec_from_file_location("regulatory_accessibility", spec["tool"])
tool = importlib.util.module_from_spec(module_spec)
sys.modules[module_spec.name] = tool
module_spec.loader.exec_module(tool)
probe = tool.ENERGY_FINGERPRINT[0]
report = {}
if spec["scenario"] == "fold-then-turner1999":
    RNA.fold(probe)
    RNA.params_load_RNA_Turner1999()
elif spec["scenario"] == "stale-turner1999-caches":
    RNA.params_load_RNA_Turner1999()
    compound = RNA.fold_compound(probe, RNA.md())
    compound.exp_params_rescale(compound.mfe()[1])
    compound.pf()
    RNA.params_load_RNA_Turner2004()
    stale = RNA.fold_compound(probe, RNA.md())
    report["staleMfe"] = round(stale.mfe()[1], 2)
try:
    if spec["pins"] is None:
        tool.main(spec["argv"])
    else:
        pins = tool.Pins(spec["pins"]["assembly"], spec["pins"]["sha"],
                         {key: tuple(value) for key, value in spec["pins"]["replicons"].items()})
        tool._run(tool.parser().parse_args(spec["argv"]), pins, RNA)
    report["status"] = "ok"
except (tool.AccessibilityError, SystemExit) as error:
    report["status"] = "refused"
    report["error"] = str(error)
print(json.dumps(report))
"""


def engine_scenario(tmp_path, scenario, argv, pins=None):
    spec = {
        "tool": str(ROOT / "tools/regulatory_accessibility.py"), "scenario": scenario, "argv": argv,
        "pins": None if pins is None else {
            "assembly": pins.assembly, "sha": pins.fasta_sha256, "replicons": pins.replicons,
        },
    }
    result = subprocess.run(
        [sys.executable, "-I", "-c", ENGINE_SCENARIO, json.dumps(spec)],
        capture_output=True, text=True, check=True, cwd=tmp_path,
        env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
    )
    return json.loads(result.stdout.strip().splitlines()[-1])


def fixture_argv(tmp_path, out):
    namespace, fasta, windows = fixture_run(tmp_path, out=out)
    argv = [
        "--fasta", str(fasta), "--windows", str(windows), "--segment-length", "4",
        "--folding-window", "20", "--max-bp-span", "15", "--temperature", "37",
        "--shuffle-replicates", "2", "--shuffle-seed", "7",
        "--json-out", str(namespace.json_out), "--tsv-out", str(namespace.tsv_out),
    ]
    return argv, namespace, fixture_pins(fasta)


def test_turner1999_loaded_after_a_cached_fold_is_refused(tmp_path, rna):
    argv, namespace, pins = fixture_argv(tmp_path, "turner1999")
    report = engine_scenario(tmp_path, "fold-then-turner1999", argv, pins)
    assert report["status"] == "refused" and "energy fingerprint" in report["error"]
    assert "-17.6" in report["error"]
    assert list(namespace.json_out.parent.iterdir()) == []


def test_stale_parameter_caches_cannot_reach_the_probabilities(tmp_path, rna):
    clean_argv, clean, pins = fixture_argv(tmp_path, "clean")
    assert engine_scenario(tmp_path, "clean", clean_argv, pins) == {"status": "ok"}
    stale_argv, stale, _ = fixture_argv(tmp_path, "stale")
    report = engine_scenario(tmp_path, "stale-turner1999-caches", stale_argv, pins)
    assert report == {"staleMfe": -17.6, "status": "ok"}  # the trap was armed, then cleared
    assert stale.tsv_out.read_bytes() == clean.tsv_out.read_bytes()
    assert stale.json_out.read_bytes() == clean.json_out.read_bytes()


# Output safety


def test_preflight_refuses_unsafe_output_paths(tmp_path):
    fasta = write_fasta(tmp_path / "g.fna", genome())
    existing = tmp_path / "exists.json"
    existing.write_text("{}")
    dangling = tmp_path / "dangling.json"
    dangling.symlink_to(tmp_path / "nowhere")
    cases = (
        ([tmp_path / "a.json", tmp_path / "A.JSON"], "must be distinct"),
        ([tmp_path / "a.json", fasta], "overwrite an input"),
        ([tmp_path / "a.json", existing], "existing output"),
        ([tmp_path / "a.json", dangling], "existing output"),
        ([tmp_path / "a.json", tmp_path / "no-dir" / "a.tsv"], "directory does not exist"),
    )
    for outputs, message in cases:
        with pytest.raises(AccessibilityError, match=message):
            accessibility.preflight_outputs(outputs, [fasta])
    assert existing.read_text() == "{}" and dangling.is_symlink()


def test_failed_second_output_removes_only_the_first(tmp_path):
    first = tmp_path / "a.tsv"
    blocker = tmp_path / "b.json"
    blocker.write_text("theirs")
    with pytest.raises(AccessibilityError, match="could not create output"):
        accessibility.write_outputs([(first, b"x"), (blocker, b"y")])
    assert not first.exists() and blocker.read_text() == "theirs"


class FailingHandle(io.BytesIO):
    def __init__(self, error):
        super().__init__()
        self.error = error

    def write(self, data):
        raise self.error


def patch_open(monkeypatch, target, error):
    original = Path.open

    def opener(self, mode="r", *args, **kwargs):
        if self == target:
            original(self, mode, *args, **kwargs).close()
            return FailingHandle(error)
        return original(self, mode, *args, **kwargs)

    monkeypatch.setattr(Path, "open", opener)


def test_write_error_and_interrupt_clean_up_this_runs_files(tmp_path, monkeypatch):
    first, second = tmp_path / "a.tsv", tmp_path / "b.json"
    patch_open(monkeypatch, second, OSError("disk full"))
    with pytest.raises(AccessibilityError, match="could not write outputs: disk full"):
        accessibility.write_outputs([(first, b"x"), (second, b"y")])
    assert not first.exists() and not second.exists()
    patch_open(monkeypatch, second, KeyboardInterrupt())
    with pytest.raises(KeyboardInterrupt):
        accessibility.write_outputs([(first, b"x"), (second, b"y")])
    assert not first.exists() and not second.exists()


def test_cleanup_failure_is_reported_without_hiding_the_cause(tmp_path, monkeypatch):
    first, second = tmp_path / "a.tsv", tmp_path / "b.json"
    patch_open(monkeypatch, second, OSError("disk full"))

    def refuse(self, missing_ok=False):
        raise OSError("busy")

    monkeypatch.setattr(Path, "unlink", refuse)
    with pytest.raises(AccessibilityError) as error:
        accessibility.write_outputs([(first, b"x"), (second, b"y")])
    message = str(error.value)
    assert message.startswith("could not write outputs: disk full; partial outputs could not be removed: ")
    assert f"{first} (busy)" in message and f"{second} (busy)" in message
    interrupted = tmp_path / "d.json"
    patch_open(monkeypatch, interrupted, KeyboardInterrupt())
    with pytest.raises(KeyboardInterrupt) as interrupt:
        accessibility.write_outputs([(tmp_path / "c.tsv", b"x"), (interrupted, b"y")])
    assert "could not be removed" in interrupt.value.__notes__[0]


# VA2: real permission failures during the output transaction

real_permissions = pytest.mark.skipif(
    not hasattr(os, "chflags") or os.geteuid() == 0,
    reason="needs BSD file flags and a non-root user for real permission failures",
)


@pytest.fixture
def unremovable_tsv_dir(tmp_path):
    """TSV directory accepts new files but refuses removal; JSON directory refuses creation."""
    import stat
    tsv_dir, json_dir = tmp_path / "tsv", tmp_path / "json"
    tsv_dir.mkdir()
    json_dir.mkdir()
    os.chflags(tsv_dir, stat.UF_APPEND)
    json_dir.chmod(0o500)
    try:
        yield tsv_dir, json_dir
    finally:
        os.chflags(tsv_dir, 0)
        json_dir.chmod(0o700)


@real_permissions
def test_real_cleanup_failure_names_the_leftover_output(tmp_path, rna, unremovable_tsv_dir):
    tsv_dir, json_dir = unremovable_tsv_dir
    namespace, fasta, _ = fixture_run(tmp_path, json_out=json_dir / "a.json", tsv_out=tsv_dir / "a.tsv")
    with pytest.raises(AccessibilityError) as error:
        accessibility._run(namespace, fixture_pins(fasta), rna)
    message = str(error.value)
    assert f"could not create output {json_dir / 'a.json'}" in message and "Permission denied" in message
    assert f"partial outputs could not be removed: {tsv_dir / 'a.tsv'}" in message
    assert "Operation not permitted" in message
    assert (tsv_dir / "a.tsv").exists() and not (json_dir / "a.json").exists()


# Command line


def test_main_refuses_fixture_input_against_production_pins(tmp_path, capsys):
    namespace, _, _ = fixture_run(tmp_path)
    argv = [
        "--fasta", str(namespace.fasta), "--windows", str(namespace.windows),
        "--segment-length", "4", "--folding-window", "20", "--max-bp-span", "15",
        "--temperature", "37", "--json-out", str(namespace.json_out), "--tsv-out", str(namespace.tsv_out),
    ]
    pytest.importorskip("RNA")
    with pytest.raises(SystemExit, match="error: .*is not in pinned GCF_000817325.1"):
        accessibility.main(argv)
    result = subprocess.run(
        [sys.executable, str(ROOT / "tools/regulatory_accessibility.py"), *argv],
        capture_output=True, text=True, check=False,
        env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
    )
    assert result.returncode == 1 and "is not in pinned GCF_000817325.1" in result.stderr


def test_run_reports_a_missing_engine(tmp_path, monkeypatch):
    namespace, _, _ = fixture_run(tmp_path)
    monkeypatch.setitem(sys.modules, "RNA", None)
    with pytest.raises(AccessibilityError, match="ViennaRNA Python module is unavailable"):
        accessibility.run(namespace)


# Pinned native assembly (skips without the fetched genome)


needs_genome = pytest.mark.skipif(not PINNED_FASTA.is_file(), reason="pinned UTEX FASTA not fetched")


@needs_genome
def test_real_rf01116_and_origin_windows_map_to_native_coordinates(tmp_path, rna, capsys):
    windows = write_windows(
        tmp_path / "w.tsv",
        "rf01116\tNZ_CP006471.1\t1364566\t1364928\t+\t1364716\tRF01116 hit with 150-nt flanks",
        "origin-minus\tNZ_CP006471.1\t2690219\t200\t-\t1\torigin coordinate check",
    )
    output = tmp_path / "out"
    output.mkdir()
    accessibility.main([
        "--fasta", str(PINNED_FASTA), "--windows", str(windows),
        "--segment-length", "10", "--folding-window", "150", "--max-bp-span", "100",
        "--temperature", "37", "--shuffle-replicates", "1",
        "--json-out", str(output / "a.json"), "--tsv-out", str(output / "a.tsv"),
    ])
    assert json.loads(capsys.readouterr().out)["tsvRows"] == 354 + 391
    payload = json.loads((output / "a.json").read_text())
    assert payload["inputs"]["fasta"]["sha256"] == accessibility.PINNED.fasta_sha256
    rf01116, origin = payload["windows"]
    assert rf01116["anchorOrientedIndex"] == 151 and origin["anchorOrientedIndex"] == 200
    assert rf01116["native"]["interiorSegments"] == 74
    rows = list(csv.DictReader((output / "a.tsv").open(), delimiter="\t"))
    first_hit = next(row for row in rows if row["window_id"] == "rf01116" and row["oriented_start"] == "151")
    assert (first_hit["native_start"], first_hit["native_end"]) == ("1364716", "1364725")
    wrapped = [row for row in rows if row["wraps_origin"] == "true"]
    assert [(row["native_start"], row["native_end"]) for row in wrapped][0] == ("2690418", "9")


@needs_genome
@real_permissions
def test_cli_stderr_names_the_leftover_output_after_real_cleanup_failure(tmp_path, rna, unremovable_tsv_dir):
    tsv_dir, json_dir = unremovable_tsv_dir
    windows = write_windows(tmp_path / "w.tsv", "w\tNZ_CP006471.1\t1364566\t1364928\t+\t\t")
    result = subprocess.run(
        [sys.executable, str(ROOT / "tools/regulatory_accessibility.py"),
         "--fasta", str(PINNED_FASTA), "--windows", str(windows), "--segment-length", "10",
         "--folding-window", "150", "--max-bp-span", "100", "--temperature", "37",
         "--json-out", str(json_dir / "a.json"), "--tsv-out", str(tsv_dir / "a.tsv")],
        capture_output=True, text=True, check=False, env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
    )
    assert result.returncode == 1 and result.stdout == ""
    assert f"error: could not create output {json_dir / 'a.json'}" in result.stderr
    assert f"partial outputs could not be removed: {tsv_dir / 'a.tsv'}" in result.stderr
    assert (tsv_dir / "a.tsv").exists()


@needs_genome
def test_real_cli_refuses_turner1999_loaded_after_a_cached_fold(tmp_path, rna):
    windows = write_windows(tmp_path / "w.tsv", "w\tNZ_CP006471.1\t1364566\t1364928\t+\t\t")
    argv = [
        "--fasta", str(PINNED_FASTA), "--windows", str(windows), "--segment-length", "10",
        "--folding-window", "150", "--max-bp-span", "100", "--temperature", "37",
        "--json-out", str(tmp_path / "a.json"), "--tsv-out", str(tmp_path / "a.tsv"),
    ]
    report = engine_scenario(tmp_path, "fold-then-turner1999", argv)
    assert report["status"] == "refused" and report["error"].startswith("error: ViennaRNA energy fingerprint")
    assert not (tmp_path / "a.json").exists() and not (tmp_path / "a.tsv").exists()


@needs_genome
def test_real_decompressed_or_altered_genome_is_refused(tmp_path, rna):
    plain = tmp_path / "genome.fna"
    plain.write_bytes(gzip.decompress(PINNED_FASTA.read_bytes()))
    windows = write_windows(tmp_path / "w.tsv", "w\tNZ_CP006471.1\t1\t200\t+\t\t")
    namespace = arguments(tmp_path, plain, windows)
    with pytest.raises(AccessibilityError, match="FASTA SHA-256"):
        accessibility.run(namespace)
