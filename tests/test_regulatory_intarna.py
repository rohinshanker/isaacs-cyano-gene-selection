"""IntaRNA identity, coordinates, controls, CSV validation and failure contracts."""

import argparse
import csv
import gzip
import io
import json
import os
import subprocess
import sys
from collections import Counter
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import regulatory_intarna as ri


def example_windows():
    return (ri.Window("target", ri.EXAMPLE_TARGET, "synthetic"),
            ri.Window("query", ri.EXAMPLE_QUERY, "synthetic"))


def report(target, query, seed_bp=7, **overrides):
    row = dict(zip(ri.FIELDS, [
        target.id, query.id, target.sequence, query.sequence,
        9, 15, 5, 11, -10.85, -10.85, 0, 0, 1, 1,
        ":".join(f"({9+i},{11-i})" for i in range(7)),
        9, 15, 5, 11, -10.85,
    ]))
    if seed_bp == 6:
        row.update(seedStart1=10, seedEnd2=10)
    row.update(overrides)
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=ri.FIELDS, delimiter=";", lineterminator="\n")
    writer.writeheader()
    writer.writerow(row)
    return buffer.getvalue()


def test_example_parser_and_native_maps():
    target, query = example_windows()
    target = ri.Window(target.id, target.sequence, "native", 101, 122, "-", ri.REPLICON)
    query = ri.Window(query.id, query.sequence, "native", 201, 215, "+", ri.REPLICON)
    record = ri.parse_report(report(target, query), target, query)[0]
    assert record["targetNativeInterval"] == {
        "replicon": ri.REPLICON, "start": 108, "end": 114,
        "strand": "-", "system": "one-based inclusive",
    }
    assert record["queryNativeInterval"]["start"] == 205
    assert record["basePairs"][0]["targetNative"]["start"] == 114
    assert record["basePairs"][-1]["targetNative"]["start"] == 108
    assert ri.parse_report(report(target, query, 6), target, query, 6)


@pytest.mark.parametrize("overrides", [
    {"id1": "wrong"}, {"id2": "wrong"}, {"seq1": "wrong"}, {"seq2": "wrong"},
    {"E": "NaN"}, {"E": "inf"}, {"ED1": "-0.1"}, {"Pu1": "1.1"},
    {"Pu2": "-0.1"}, {"ED2": "oops"}, {"start1": "9.1"},
    {"start1": 0}, {"end2": 50}, {"start2": 12},
    {"seedStart1": 8}, {"seedEnd2": 10}, {"E_hybrid": 0},
    {"bpList": "bad"}, {"bpList": "(9,11):(9,10)"},
    {"bpList": "(8,11):(15,5)"}, {"bpList": "(9,11):(15,6)"},
    {"bpList": "(9,11):(11,10):(15,5)"},
    {"bpList": "(9,11):(15,5)"}, {"bpList": "(9,11):(15,11)"},
])
def test_bad_csv_fields(overrides):
    target, query = example_windows()
    with pytest.raises(ri.PilotError):
        ri.parse_report(report(target, query, **overrides), target, query)


def test_noncomplementary_pairs():
    target, query = example_windows()
    query = ri.Window(query.id, "A" * len(query.sequence), "synthetic")
    with pytest.raises(ri.PilotError, match="noncomplementary"):
        ri.parse_report(report(target, query), target, query)


def test_csv_schema_width_count_and_empty():
    target, query = example_windows()
    good = report(target, query)
    assert ri.parse_report(";".join(ri.FIELDS) + "\n", target, query) == []
    for bad in ("", "wrong\n", good + good.splitlines()[1] + "\n",
                good.rstrip() + ";extra\n", good[:good.rfind(";")] + "\n"):
        with pytest.raises(ri.PilotError):
            ri.parse_report(bad, target, query)


@pytest.mark.parametrize("kwargs", [
    {"id": "bad name"}, {"sequence": "AAAAAA"}, {"sequence": "A" * 201},
    {"sequence": "AAAAAAN"}, {"start": 1},
    {"start": 1, "end": 7, "strand": "+", "replicon": "chr"},
    {"start": 0, "end": 13, "strand": "+", "replicon": "chr"},
    {"start": 1, "end": 14, "strand": "?", "replicon": "chr"},
])
def test_invalid_window(kwargs):
    args = {"id": "ok", "sequence": "A" * 14, "basis": "test", **kwargs}
    with pytest.raises(ri.PilotError):
        ri.Window(**args)


def test_window_extract_and_mapping():
    window = ri.native_window("x", "AACCGGTTAACC", 2, 10, "-", "test")
    assert window.sequence == "UUAACCGGU"
    assert window.interval(1, 9)["start"] == 2
    assert window.interval(1, 1)["start"] == 10
    assert window.document()["sequenceSha256"]
    for a, b, strand in ((0, 10, "+"), (2, 20, "+"), (2, 10, "?")):
        with pytest.raises(ri.PilotError):
            ri.native_window("x", "AACCGGTTAACC", a, b, strand, "test")
    for a, b in ((0, 1), (1, 10), (3, 2)):
        with pytest.raises(ri.PilotError):
            window.interval(a, b)
    target, query = example_windows()
    assert query.interval(1, 1) is None


def test_controls_preserve_identity_boundaries_and_disrupt_seed():
    target, query = example_windows()
    record = ri.parse_report(report(target, query), target, query)[0]
    control = ri.shuffled(query, 2973)
    assert control == ri.shuffled(query, 2973)
    assert Counter(control.sequence) == Counter(query.sequence)
    assert control.sequence != ri.shuffled(query, 12).sequence
    assert control.start is None
    mutant = ri.disrupted(query, target, record)
    assert mutant.sequence == "AAAAGGGGGGGUUUU"
    assert mutant.start is None
    assert "5..11" in mutant.basis
    assert mutant.sequence[:4] == query.sequence[:4]


@pytest.fixture
def native_files(tmp_path, monkeypatch):
    dna = "ACGT" * 350000
    fasta = tmp_path / "genome.fna.gz"
    with gzip.open(fasta, "wt") as handle:
        handle.write(f">{ri.REPLICON}\n{dna}\n")
    gff = tmp_path / "genome.gff.gz"
    rows = [f"{ri.REPLICON}\ttest\tCDS\t{a}\t{b}\t.\t{s}\t0\tlocus_tag={id}\n"
            for id, a, b, s in zip(ri.LOCI, (1363447, 1364916, 3121),
                                  (1364610, 1365239, 4215), ("+", "+", "-"))]
    with gzip.open(gff, "wt") as handle:
        handle.writelines(rows)
    monkeypatch.setattr(ri, "FASTA_SHA256", ri.sha256_file(fasta))
    monkeypatch.setattr(ri, "GFF_SHA256", ri.sha256_file(gff))
    monkeypatch.setattr(ri, "EXPECTED_REPLICON_LENGTHS", {ri.REPLICON: len(dna)})
    return fasta, gff, rows, dna


def test_native_pinned_preparation(native_files):
    fasta, gff, _, dna = native_files
    queries, targets = ri.prepare_native(fasta, gff)
    assert [(q.start, q.end, len(q.sequence)) for q in queries] == [
        (1364716, 1364778, 63), (1364696, 1364798, 103), (1364666, 1364828, 163)]
    assert [(t.start, t.end, t.strand) for t in targets] == [
        (1363347, 1363496, "+"), (1364816, 1364965, "+"), (4166, 4315, "-")]
    assert targets[-1].sequence == dna[4165:4315].translate(str.maketrans("ACGT", "TGCA"))[::-1].replace("T", "U")


@pytest.mark.parametrize("kind", ["fasta_pin", "gff_pin", "length", "missing", "duplicate", "replicon", "phase"])
def test_native_bad_inputs(native_files, monkeypatch, kind):
    fasta, gff, rows, _ = native_files
    if kind == "fasta_pin":
        monkeypatch.setattr(ri, "FASTA_SHA256", "bad")
    elif kind == "gff_pin":
        monkeypatch.setattr(ri, "GFF_SHA256", "bad")
    elif kind == "length":
        monkeypatch.setattr(ri, "EXPECTED_REPLICON_LENGTHS", {})
    else:
        if kind == "missing": rows.pop()
        elif kind == "duplicate": rows.append(rows[0])
        elif kind == "replicon": rows[0] = rows[0].replace(ri.REPLICON, "chr-other")
        elif kind == "phase": rows[0] = rows[0].replace("\t0\t", "\t1\t")
        with gzip.open(gff, "wt") as handle:
            handle.writelines(rows)
        monkeypatch.setattr(ri, "GFF_SHA256", ri.sha256_file(gff))
    with pytest.raises(ri.PilotError):
        ri.prepare_native(fasta, gff)


@pytest.mark.parametrize("failure", ["exit", "stderr", "timeout", "os"])
def test_execution_failures(tmp_path, monkeypatch, failure):
    def run(*args, **kwargs):
        if failure == "timeout": raise subprocess.TimeoutExpired("test", 1)
        if failure == "os": raise OSError("test")
        return subprocess.CompletedProcess(args[0], 1 if failure == "exit" else 0,
                                           stdout="bad", stderr="test")
    monkeypatch.setattr(ri.subprocess, "run", run)
    with pytest.raises(ri.PilotError):
        ri.execute(Path("IntaRNA"), [], tmp_path, 1)


def test_execution_success_sets_bounds(tmp_path, monkeypatch):
    def run(*args, **kwargs):
        assert kwargs["env"]["OMP_NUM_THREADS"] == "1"
        assert kwargs["timeout"] == 12
        assert kwargs["cwd"] == tmp_path
        return subprocess.CompletedProcess(args[0], 0, stdout="ok", stderr="")
    monkeypatch.setattr(ri.subprocess, "run", run)
    assert ri.execute(Path("IntaRNA"), [], tmp_path, 12) == "ok"


@pytest.mark.parametrize("variant", ["default", "global_accessibility", "seed6", "invalid"])
def test_command_variants(tmp_path, monkeypatch, variant):
    target, query = example_windows()
    monkeypatch.setattr(ri, "execute", lambda *args: report(target, query, 6 if variant == "seed6" else 7))
    if variant == "invalid":
        with pytest.raises(ri.PilotError):
            ri.run_interaction(Path("IntaRNA"), target, query, tmp_path, 60, variant)
        return
    raw, records, command = ri.run_interaction(Path("IntaRNA"), target, query, tmp_path, 60, variant)
    assert records and raw
    assert command[0:2] == ["--target=target.fa", "--query=query.fa"]
    assert "--seedBP=6" in command if variant == "seed6" else "--seedBP=7" in command
    assert "--accW=0" in command if variant == "global_accessibility" else "--accW=150" in command
    assert (tmp_path / "query.fa").read_text() == f">query\n{query.sequence}\n"


@pytest.fixture
def pilot_args(tmp_path, monkeypatch):
    binary = tmp_path / "IntaRNA"
    binary.write_text("test")
    binary.chmod(0o755)
    archive = tmp_path / "source.tar.gz"
    archive.write_bytes(b"test archive")
    monkeypatch.setattr(ri, "SOURCE_SHA256", ri.sha256_file(archive))
    target, query = example_windows()
    monkeypatch.setattr(ri, "prepare_native", lambda *args: ([query], [target]))
    monkeypatch.setattr(ri, "execute", lambda binary, argv, *args: "IntaRNA 3.4.1\nViennaRNA 2.7.0\n" if argv == ["--version"] else "help")

    def interaction(binary, target, query, directory, timeout, variant="default"):
        raw = (report(target, query, 6 if variant == "seed6" else 7)
               if query.sequence == ri.EXAMPLE_QUERY else ";".join(ri.FIELDS) + "\n")
        return raw, ri.parse_report(raw, target, query, 6 if variant == "seed6" else 7), [variant]

    monkeypatch.setattr(ri, "run_interaction", interaction)
    return argparse.Namespace(intarna=binary, source_archive=archive, fasta=archive,
                              gff=archive, output_dir=tmp_path / "output",
                              timeout_seconds=60, shuffle_seed=2973)


def test_end_to_end_report_and_exclusive_output(pilot_args):
    payload = ri.run_pilot(pilot_args)
    assert len(payload["runs"]) == 8
    assert payload["skippedDisruptions"] == []
    assert payload["provenance"]["binarySha256"]
    assert json.loads((pilot_args.output_dir / "pilot.json").read_text()) == payload
    assert len(list(pilot_args.output_dir.iterdir())) == 27
    assert "not a confirmed full transcript" in payload["interpretation"]
    before = (pilot_args.output_dir / "pilot.json").read_bytes()
    with pytest.raises(ri.PilotError, match="existing"):
        ri.run_pilot(pilot_args)
    assert (pilot_args.output_dir / "pilot.json").read_bytes() == before


@pytest.mark.parametrize("kind", ["timeout", "nan", "binary", "source", "version", "positive", "energy"])
def test_pilot_failures_leave_no_output(pilot_args, monkeypatch, kind):
    if kind == "timeout": pilot_args.timeout_seconds = 0
    elif kind == "nan": pilot_args.timeout_seconds = float("nan")
    elif kind == "binary": pilot_args.intarna.chmod(0o644)
    elif kind == "source": monkeypatch.setattr(ri, "SOURCE_SHA256", "bad")
    elif kind == "version": monkeypatch.setattr(ri, "execute", lambda *args: "IntaRNA 3.4.10\n")
    else:
        def interaction(*args, **kwargs):
            row = ri.parse_report(report(args[1], args[2]), args[1], args[2])[0]
            if kind == "positive": return "", [], []
            row["E"] = -5
            return "", [row], []
        monkeypatch.setattr(ri, "run_interaction", interaction)
    with pytest.raises(ri.PilotError):
        ri.run_pilot(pilot_args)
    assert not pilot_args.output_dir.exists()


def test_no_native_interaction_skips_mutation(pilot_args, monkeypatch):
    original = ri.run_interaction
    def interaction(*args, **kwargs):
        if args[1].id == "target":
            return ";".join(ri.FIELDS) + "\n", [], []
        return original(*args, **kwargs)
    monkeypatch.setattr(ri, "run_interaction", interaction)
    payload = ri.run_pilot(pilot_args)
    assert payload["skippedDisruptions"] == ["query-target"]
    assert len(payload["runs"]) == 7


@pytest.mark.parametrize("failure", [OSError("write failed"), KeyboardInterrupt()])
def test_publish_failure_cleanup(tmp_path, monkeypatch, failure):
    original = Path.open
    def opened(self, *args, **kwargs):
        if self.name == "second": raise failure
        return original(self, *args, **kwargs)
    monkeypatch.setattr(Path, "open", opened)
    output = tmp_path / "output"
    with pytest.raises(type(failure)):
        ri.publish(output, {"first": "ok", "second": "fail"})
    assert not output.exists()


def test_publish_preserves_preexisting_and_symlink(tmp_path):
    output = tmp_path / "output"
    output.mkdir()
    (output / "sentinel").write_text("keep")
    with pytest.raises(FileExistsError):
        ri.publish(output, {"new": "test"})
    assert (output / "sentinel").read_text() == "keep"
    link = tmp_path / "link"
    link.symlink_to(output, target_is_directory=True)
    with pytest.raises(FileExistsError):
        ri.publish(link, {"new": "test"})


def test_publish_cleanup_error_retains_original(tmp_path, monkeypatch):
    monkeypatch.setattr(Path, "open", lambda *args, **kwargs: (_ for _ in ()).throw(OSError("write failed")))
    monkeypatch.setattr(ri.shutil, "rmtree", lambda *args: (_ for _ in ()).throw(OSError("cleanup failed")))
    with pytest.raises(OSError, match="write failed") as error:
        ri.publish(tmp_path / "output", {"file": "value"})
    assert "cleanup failed" in error.value.__notes__[0]


def test_cli_success_and_error(pilot_args, monkeypatch, capsys):
    monkeypatch.setattr(argparse.ArgumentParser, "parse_args", lambda *args: pilot_args)
    ri.main()
    assert json.loads(capsys.readouterr().out)["runs"] == 8
    with pytest.raises(SystemExit, match="existing"):
        ri.main()


def test_parser():
    args = ri.parser().parse_args(["--intarna", "binary", "--source-archive", "src",
                                  "--fasta", "fasta", "--gff", "gff", "--output-dir", "out"])
    assert args.timeout_seconds == 60
    assert args.shuffle_seed == 2973


@pytest.mark.skipif(not os.environ.get("INTARNA_PILOT_RUNTIME"), reason="opt-in official compiled runtime")
def test_actual_runtime(tmp_path):
    root = Path(os.environ["INTARNA_PILOT_RUNTIME"])
    binary = root / "runtime/bin/IntaRNA"
    target, query = example_windows()
    raw, records, _ = ri.run_interaction(binary, target, query, tmp_path, 60)
    assert raw and records[0]["E"] == pytest.approx(-10.85, abs=0.1)
    assert (records[0]["start1"], records[0]["end1"]) == (9, 15)
    mutant = ri.disrupted(query, target, records[0])
    _, controls, _ = ri.run_interaction(binary, target, mutant, tmp_path, 60)
    assert controls == []


@pytest.mark.skipif(not (os.environ.get("INTARNA_PILOT_RUNTIME") and os.environ.get("INTARNA_PILOT_NATIVE_DIR")),
                    reason="opt-in compiled runtime and pinned native assembly")
def test_actual_native_reproducibility(tmp_path):
    root = Path(os.environ["INTARNA_PILOT_RUNTIME"])
    native = Path(os.environ["INTARNA_PILOT_NATIVE_DIR"])
    args = argparse.Namespace(
        intarna=root / "runtime/bin/IntaRNA", source_archive=root / "source/intaRNA-3.4.1.tar.gz",
        fasta=native / "GCF_000817325.1_ASM81732v1_genomic.fna.gz",
        gff=native / "GCF_000817325.1_ASM81732v1_genomic.gff.gz",
        output_dir=tmp_path / "run1", timeout_seconds=60, shuffle_seed=2973)
    first = ri.run_pilot(args)
    args.output_dir = tmp_path / "run2"
    second = ri.run_pilot(args)
    assert first == second
    assert {p.name: p.read_bytes() for p in (tmp_path / "run1").iterdir()} == {
        p.name: p.read_bytes() for p in (tmp_path / "run2").iterdir()}
    runs = [r for r in first["runs"] if r["kind"] == "native_window_interaction"]
    assert len(runs) == 9
    assert [r["nativeInputOverlapNt"] for r in runs] == [0, 0, 0, 0, 0, 0, 0, 13, 0]
    genome = ri.load_fasta(args.fasta)[ri.REPLICON]
    for run in runs:
        for role in ("query", "target"):
            window = run[role]
            raw = genome[window["start"]-1:window["end"]]
            if window["strand"] == "-":
                raw = raw.translate(str.maketrans("ACGT", "TGCA"))[::-1]
            assert window["sequence"] == raw.replace("T", "U")
        for record in run["records"]:
            for pair in record["basePairs"]:
                for role in ("query", "target"):
                    genomic = pair[role + "Native"]
                    base = genome[genomic["start"]-1]
                    if genomic["strand"] == "-":
                        base = base.translate(str.maketrans("ACGT", "TGCA"))
                    assert base.replace("T", "U") == run[role]["sequence"][pair[role + "Local"]-1]
    controls = [r for r in first["runs"] if r["kind"] in ("shuffle_control", "seed_disruption_control")]
    assert all(r["query"]["start"] is None for r in controls)
    assert all(r["nativeInputOverlapNt"] is None for r in controls)
    assert all(record["queryNativeInterval"] is None for r in controls for record in r["records"])
