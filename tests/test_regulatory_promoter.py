"""Pinned native inputs, orientation, evaluation semantics and failure safety."""

from collections import Counter
import csv
import hashlib
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import regulatory_promoter as pilot


class Calculator:
    """Deterministic scorer whose unique optimum is two bases after the anchor."""

    def predict(self, sequence, indices):
        states, layouts = {}, {}
        for i in range(*indices):
            state = {"TSS": i, "dG_total": abs(i - 89), "Tx_rate": 1.0,
                     "ITR": sequence[i:i + 20]}
            for feature in pilot.FEATURES:
                state[feature + "_position"] = [i - 6, i]
                state[feature] = sequence[i - 6:i]
            states[i], layouts[i] = state, dict.fromkeys(range(30))
        return states, layouts


def anchor(position=150, strand="+", identifier="a", locus="one"):
    return {"id": identifier, "locus": locus, "position": position,
            "strand": strand, "replicon": "NZ_CP006471.1"}


def write_tss(path, rows):
    fields = ("tss_id", "replicon", "type", "strand", "position", "locus_tag")
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fields, delimiter="\t")
        writer.writeheader()
        writer.writerows(rows)


@pytest.fixture
def table(tmp_path):
    path = tmp_path / "tss.tsv"
    row = {"tss_id": "gTSS+150", "replicon": "CP006471", "type": "gTSS",
           "strand": "+", "position": 150, "locus_tag": "one"}
    write_tss(path, [row])
    return path, row


def test_anchor_reader(table):
    path, _ = table
    assert pilot.load_anchors(path, {"NZ_CP006471.1": "A" * 300}) == [anchor(identifier="gTSS+150")]


@pytest.mark.parametrize("field,value,message", [
    ("type", "aTSS", "Invalid gTSS"), ("strand", "?", "Invalid gTSS"),
    ("replicon", "bogus", "Invalid gTSS"), ("locus_tag", "", "Invalid gTSS"),
    ("tss_id", "", "Invalid gTSS"), ("position", "x", "invalid literal"),
    ("position", 0, "outside replicon"), ("position", 301, "outside replicon"),
])
def test_invalid_anchor_rows(table, field, value, message):
    path, row = table
    write_tss(path, [{**row, field: value}])
    with pytest.raises(ValueError, match=message):
        pilot.load_anchors(path, {"NZ_CP006471.1": "A" * 300})


def test_duplicate_empty_and_missing_columns(table):
    path, row = table
    write_tss(path, [row, row])
    with pytest.raises(ValueError, match="Duplicate"):
        pilot.load_anchors(path, {"NZ_CP006471.1": "A" * 300})
    write_tss(path, [])
    with pytest.raises(ValueError, match="Empty"):
        pilot.load_anchors(path, {})
    path.write_text("other\n")
    with pytest.raises(ValueError, match="required columns"):
        pilot.load_anchors(path, {})


@pytest.mark.parametrize("strand", ["+", "-"])
@pytest.mark.parametrize("position", [1, 100, 300])
def test_windows_and_circular_coordinate_round_trips(strand, position):
    native = "ACGT" * 75
    sequence, positions = pilot.oriented_window(anchor(position, strand), native)
    assert len(sequence) == len(positions) == 128
    assert positions[87] == position
    assert len(set(positions)) == 128
    complement = {"A": "T", "C": "G", "G": "C", "T": "A"}
    for base, p in zip(sequence, positions):
        assert base == (native[p - 1] if strand == "+" else complement[native[p - 1]])
    assert all((b - a) % 300 == (1 if strand == "+" else 299)
               for a, b in zip(positions, positions[1:]))


@pytest.mark.parametrize("row,sequence", [
    (anchor(), "A" * 127), (anchor(), "A" * 149 + "N" + "A" * 150),
    (anchor(strand="?"), "A" * 300), (anchor(0), "A" * 300),
    (anchor(301), "A" * 300),
])
def test_invalid_windows(row, sequence):
    with pytest.raises(ValueError, match="Invalid native"):
        pilot.oriented_window(row, sequence)


@pytest.mark.parametrize("maximum,seed", [(0, 1), (2476, 1), (1, -1)])
def test_invalid_selection(maximum, seed):
    with pytest.raises(ValueError):
        pilot.select_cohort([], {}, maximum, seed)


def test_selection_exclusions_are_explicit_and_deterministic(monkeypatch):
    monkeypatch.setattr(pilot, "digest", lambda text: text)
    native = "ACGT" * 1000
    rows = [anchor(100, identifier="a"), anchor(500, identifier="b"),
            anchor(110, strand="-", identifier="c", locus="two"),
            anchor(900, identifier="d", locus="three")]
    selected, excluded = pilot.select_cohort(rows, {"NZ_CP006471.1": native}, 4, 1)
    assert [row["id"] for row in selected] == ["a"]
    assert excluded == {"same_locus": 1, "overlapping_window": 1,
                        "identical_or_reverse_complement_window": 1}
    assert pilot.select_cohort(list(reversed(rows)), {"NZ_CP006471.1": native}, 4, 1) == (selected, excluded)


def test_selection_limit_and_origin_overlap(monkeypatch):
    monkeypatch.setattr(pilot, "digest", lambda text: text)
    native = "A" * 200 + "C" * 200 + "G" * 200
    rows = [anchor(1, identifier="a"), anchor(590, identifier="b", locus="two"),
            anchor(350, identifier="c", locus="three")]
    selected, excluded = pilot.select_cohort(rows, {"NZ_CP006471.1": native}, 1, 1)
    assert len(selected) == 1
    assert excluded == {"overlapping_window": 1, "sample_limit": 1}


def test_scoring_keeps_every_tied_optimum():
    class Tied(Calculator):
        def predict(self, sequence, indices):
            states, layouts = super().predict(sequence, indices)
            for state in states.values():
                state["dG_total"] = 0
            return states, layouts

    result = pilot.score_window(Tied(), "A" * 128)
    assert result["best_offsets_nt"] == list(range(-20, 21))
    assert result["anchor_energy_rank_best"] == 1
    assert result["anchor_energy_rank_worst"] == 41
    assert result["best_distance_min_nt"] == 0
    assert result["best_distance_max_nt"] == 20


@pytest.mark.parametrize("damage,message", [
    ("missing_state", "omitted"), ("missing_layout", "omitted"),
    ("partial_layout", "Incomplete"), ("tss", "TSS mismatch"),
    ("energy", "Nonfinite"), ("rate", "Nonfinite"), ("negative_rate", "invalid model rate"),
    ("itr", "ITR sequence"), ("feature", "component"), ("position", "component"),
])
def test_scoring_rejects_invalid_model_results(damage, message):
    class Broken(Calculator):
        def predict(self, sequence, indices):
            states, layouts = super().predict(sequence, indices)
            if damage == "missing_state":
                del states[67]
            elif damage == "missing_layout":
                del layouts[67]
            elif damage == "partial_layout":
                layouts[67] = {}
            else:
                key, value = {"tss": ("TSS", 0), "energy": ("dG_total", float("nan")),
                              "rate": ("Tx_rate", float("inf")), "negative_rate": ("Tx_rate", -1),
                              "itr": ("ITR", "invalid"), "feature": ("UP", "invalid"),
                              "position": ("UP_position", [-1, 5])}[damage]
                states[67][key] = value
            return states, layouts

    with pytest.raises(ValueError, match=message):
        pilot.score_window(Broken(), "A" * 128)


def test_evaluation_controls_and_summary():
    native = "ACGTCGAA" * 100
    rows = []
    for strand in ("+", "-"):
        row = anchor(300, strand, identifier=strand, locus=strand)
        sequence, positions = pilot.oriented_window(row, native)
        rows.append({**row, "sequence": sequence, "native_positions": positions})
    result = pilot.evaluate(Calculator(), rows, 12)
    assert result == pilot.evaluate(Calculator(), rows, 12)
    for row in result:
        assert Counter(row["sequence"]) == Counter(row["control"]["sequence"])
        assert row["native"]["best_offsets_nt"] == [2]
        assert row["best_native_tss_positions"] == [302 if row["strand"] == "+" else 298]
        assert "native_positions" not in row["control"]
        assert not row["control"]["identical_to_native"]
    summary = pilot.summarize(result)
    assert summary["strands"] == {"+": 1, "-": 1}
    assert summary["native"]["all_best_within_5nt"] == 2
    with pytest.raises(ValueError, match="empty cohort"):
        pilot.summarize([])


@pytest.fixture
def pins(tmp_path, monkeypatch):
    fasta, tss, prepared = tmp_path / "genome", tmp_path / "tss", tmp_path / "model"
    fasta.write_bytes(b"genome")
    tss.write_bytes(b"anchors")
    prepared.mkdir()
    originals, adapted = {}, {}
    for name in ("util.py", "Promoter_Calculator_v1_0.py", "coefficients", "LICENSE"):
        payload = name.encode()
        (prepared / name).write_bytes(payload)
        originals[name] = hashlib.sha256(payload).hexdigest()
    adapted["util.py"] = originals["util.py"]
    monkeypatch.setattr(pilot, "FASTA_SHA256", hashlib.sha256(b"genome").hexdigest())
    monkeypatch.setattr(pilot, "TSS_SHA256", hashlib.sha256(b"anchors").hexdigest())
    monkeypatch.setattr(pilot.preparation, "SOURCE_HASHES", originals)
    monkeypatch.setattr(pilot.preparation, "ADAPTED_HASHES", adapted)
    return fasta, tss, prepared


def test_verify_input_bytes_not_untrusted_manifest(pins):
    fasta, tss, prepared = pins
    (prepared / "preparation.json").write_text('{"files": []}')
    result = pilot.verify_inputs(*pins)
    assert len(result["prepared_files_sha256"]) == 4
    (prepared / "util.py").write_text("tampered")
    with pytest.raises(ValueError, match="Prepared model checksum"):
        pilot.verify_inputs(*pins)


@pytest.mark.parametrize("input_index", [0, 1])
def test_input_checksum_rejection(pins, input_index):
    pins[input_index].write_text("changed")
    with pytest.raises(ValueError, match="Input checksum"):
        pilot.verify_inputs(*pins)


@pytest.mark.parametrize("previous", [False, True])
def test_model_import_does_not_pollute_util(tmp_path, monkeypatch, previous):
    old = SimpleNamespace(marker="old")
    if previous:
        monkeypatch.setitem(sys.modules, "util", old)
    else:
        monkeypatch.delitem(sys.modules, "util", raising=False)
    (tmp_path / "util.py").write_text('identity = "pinned"\n')
    (tmp_path / "Promoter_Calculator_v1_0.py").write_text(
        'import util\nclass Promoter_Calculator:\n'
        ' def __init__(self, organism):\n  self.organism = organism\n  self.util = util\n')
    calculator = pilot.load_calculator(tmp_path)
    assert calculator.organism == pilot.MODEL_HOST
    assert calculator.util.identity == "pinned"
    assert sys.modules.get("util") is (old if previous else None)
    (tmp_path / "Promoter_Calculator_v1_0.py").write_text('raise ImportError("failed")\n')
    with pytest.raises(ImportError, match="failed"):
        pilot.load_calculator(tmp_path)
    assert sys.modules.get("util") is (old if previous else None)


@pytest.fixture
def fake_run(pins, monkeypatch):
    monkeypatch.setattr(pilot, "load_fasta", lambda path: {"NZ_CP006471.1": "ACGT" * 75})
    monkeypatch.setattr(pilot, "EXPECTED_REPLICON_LENGTHS", {"NZ_CP006471.1": 300})
    monkeypatch.setattr(pilot, "load_anchors", lambda *args: [anchor()])
    monkeypatch.setattr(pilot, "load_calculator", lambda path: Calculator())
    for name in ("numpy", "sklearn", "scipy", "Bio"):
        monkeypatch.setitem(sys.modules, name, SimpleNamespace(__version__="fixture"))
    return pins


def test_run_and_cli_success(fake_run, tmp_path, capsys):
    output = tmp_path / "result"
    report = pilot.run(*fake_run, output)
    assert json.loads((output / "report.json").read_text()) == report
    assert report["parameters"]["layouts_per_candidate"] == 30
    with pytest.raises(FileExistsError):
        pilot.run(*fake_run, output)
    args = ["--fasta", str(fake_run[0]), "--tss", str(fake_run[1]),
            "--prepared", str(fake_run[2]), "--output", str(tmp_path / "cli")]
    assert pilot.main(args) == 0
    assert json.loads(capsys.readouterr().out)["anchors"] == 1
    assert pilot.main(args) == 1
    assert "pilot failed" in capsys.readouterr().err


def test_replicon_mismatch_creates_nothing(fake_run, tmp_path, monkeypatch):
    monkeypatch.setattr(pilot, "EXPECTED_REPLICON_LENGTHS", {})
    output = tmp_path / "result"
    with pytest.raises(ValueError, match="replicon set"):
        pilot.run(*fake_run, output)
    assert not output.exists()


@pytest.mark.parametrize("interruption", [False, True])
def test_write_failure_cleanup(fake_run, tmp_path, monkeypatch, interruption):
    original = Path.write_text
    output = tmp_path / "result"

    def fail(path, *args, **kwargs):
        original(path, "partial")
        raise KeyboardInterrupt() if interruption else OSError("disk error")

    monkeypatch.setattr(Path, "write_text", fail)
    with pytest.raises(KeyboardInterrupt if interruption else OSError):
        pilot.run(*fake_run, output)
    assert not output.exists()


def test_cleanup_failure_preserves_cause_and_reports_path(fake_run, tmp_path, monkeypatch, capsys):
    def fail(*args, **kwargs):
        raise OSError("original failure")

    def cleanup(*args):
        raise OSError("denied")

    monkeypatch.setattr(pilot, "evaluate", fail)
    monkeypatch.setattr(pilot.shutil, "rmtree", cleanup)
    output = tmp_path / "result"
    with pytest.raises(OSError, match="original failure") as caught:
        pilot.run(*fake_run, output)
    assert str(output) in caught.value.__notes__[0]
    args = ["--fasta", str(fake_run[0]), "--tss", str(fake_run[1]),
            "--prepared", str(fake_run[2]), "--output", str(tmp_path / "cli")]
    assert pilot.main(args) == 1
    assert "Cleanup failed" in capsys.readouterr().err


def test_missing_cli_arguments():
    with pytest.raises(SystemExit) as caught:
        pilot.main([])
    assert caught.value.code == 2


def test_actual_model_native_cohort(tmp_path):
    """Opt-in check against the real downloaded model and admitted native inputs."""
    prepared = os.environ.get("PROMOTER_CALCULATOR_PREPARED_DIR")
    fasta = os.environ.get("REGULATORY_FASTA")
    if not prepared or not fasta:
        pytest.skip("Set PROMOTER_CALCULATOR_PREPARED_DIR and REGULATORY_FASTA")
    tss = Path(__file__).resolve().parents[1] / "data/expression/tan2018_utex2973_tss_table_s1.tsv"
    report = pilot.run(Path(fasta), tss, Path(prepared), tmp_path / "actual", max_sites=8)
    assert report["summary"]["anchors"] == 8
    assert report["cohort"]["input_anchors"] == 2475
    assert sum(report["cohort"]["excluded"].values()) == 2475 - 8
    assert set(report["summary"]["strands"]) == {"+", "-"}
    for row in report["results"]:
        assert len(row["native"]["score_curve"]) == 41
        assert Counter(row["sequence"]) == Counter(row["control"]["sequence"])
        assert row["native_positions"][87] == row["position"]
