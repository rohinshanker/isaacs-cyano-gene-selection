"""Tests for the standalone TransTermHP UTEX pilot."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import importlib.util
import json
import subprocess
from pathlib import Path
from types import SimpleNamespace

import pytest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "regulatory_transterm", ROOT / "tools/regulatory_transterm.py"
)
regulatory_transterm = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(regulatory_transterm)


def write(path: Path, value: str) -> Path:
    path.write_text(value, encoding="utf-8")
    return path


def report(*term_lines: str, length: int = 100, sequence: str = "chr") -> str:
    return "\n".join((
        "TransTermHP v2.08 (built on Oct 12 2026)",
        f"SEQUENCE {sequence} example (length {length})",
        *term_lines,
        "",
    ))


PLUS = "  TERM 1          20 - 30       + F    99 -12.7     -4.0 | gap 1"
MINUS = "  TERM 2          80 - 60       - R    76  -8.5     -3.2 |"


def test_load_fasta_supports_plain_and_gzip_and_rejects_unknown_bases(tmp_path):
    plain = write(tmp_path / "input.fna", ">chr description\nacgt\nTGCA\n")
    assert regulatory_transterm.load_fasta(plain) == {"chr": "ACGTTGCA"}

    compressed = tmp_path / "input.fna.gz"
    with gzip.open(compressed, "wt", encoding="utf-8") as handle:
        handle.write(">one\nAAAA\n>two\nCCCC\n")
    assert regulatory_transterm.load_fasta(compressed) == {"one": "AAAA", "two": "CCCC"}

    write(plain, ">chr\nACNT\n")
    with pytest.raises(regulatory_transterm.PilotError, match="unknown bases N"):
        regulatory_transterm.load_fasta(plain)


@pytest.mark.parametrize(
    ("contents", "message"),
    (
        (">chr\nAA\n>chr other\nTT\n", "duplicate FASTA ID"),
        ("ACGT\n", "sequence before FASTA header"),
        ("", "no FASTA records"),
        (">chr\n", "empty FASTA records"),
    ),
)
def test_load_fasta_rejects_structural_errors(tmp_path, contents, message):
    path = write(tmp_path / "bad.fna", contents)
    with pytest.raises(regulatory_transterm.PilotError, match=message):
        regulatory_transterm.load_fasta(path)


def test_load_gff_genes_preserves_strands_and_circular_identity(tmp_path):
    gff = write(tmp_path / "genes.gff", """##gff-version 3
#!genome-build-accession NCBI_Assembly:GCF_test.1
chr\tRefSeq\tregion\t1\t100\t.\t+\t.\tID=chr;Is_circular=true
chr\tRefSeq\tgene\t2\t20\t.\t+\t.\tID=gene-a;locus_tag=a
chr\tRefSeq\tgene\t40\t60\t.\t-\t.\tID=gene-b;locus_tag=b
""")
    genes, circular, assembly = regulatory_transterm.load_gff_genes(
        gff, {"chr": "A" * 100}
    )
    assert assembly == "GCF_test.1"
    assert circular == {"chr": True}
    assert genes == [
        {"id": "a", "replicon": "chr", "start": 2, "end": 20, "strand": "+",
         "wrapsOrigin": False, "sourceEnd": 20, "featureType": "gene"},
        {"id": "b", "replicon": "chr", "start": 40, "end": 60, "strand": "-",
         "wrapsOrigin": False, "sourceEnd": 60, "featureType": "gene"},
    ]
    coords = tmp_path / "genes.coords"
    regulatory_transterm._write_coords(coords, genes)
    assert coords.read_text(encoding="utf-8") == "a\t2\t20\tchr\nb\t60\t40\tchr\n"


def test_origin_wrapping_gene_is_split_into_two_tool_annotations(tmp_path, monkeypatch):
    gff = write(tmp_path / "wrap.gff", """chr\tR\tregion\t1\t100\t.\t+\t.\tID=chr;Is_circular=true
chr\tR\tgene\t90\t120\t.\t-\t.\tID=gene-wrap;locus_tag=wrap
""")
    genes, circular, _ = regulatory_transterm.load_gff_genes(gff, {"chr": "A" * 100})
    assert circular == {"chr": True}
    assert genes == [{
        "id": "wrap", "replicon": "chr", "start": 90, "end": 20,
        "strand": "-", "wrapsOrigin": True, "sourceEnd": 120, "featureType": "gene",
    }]
    monkeypatch.setattr(regulatory_transterm, "EXPECTED_REPLICON_LENGTHS", {"chr": 100})
    coords = tmp_path / "wrap.coords"
    regulatory_transterm._write_coords(coords, genes)
    assert coords.read_text(encoding="utf-8") == (
        "wrap__origin_part_1\t100\t90\tchr\n"
        "wrap__origin_part_2\t20\t1\tchr\n"
    )


@pytest.mark.parametrize(
    ("row", "message"),
    (
        ("other\tR\tgene\t1\t5\t.\t+\t.\tID=x", "unknown replicon"),
        ("chr\tR\tgene\t0\t5\t.\t+\t.\tID=x", "out-of-bounds"),
        ("chr\tR\tgene\t1\t101\t.\t+\t.\tID=x", "out-of-bounds"),
        ("chr\tR\tgene\tone\t5\t.\t+\t.\tID=x", "non-integer"),
        ("chr\tR\tgene\t1\t5\t.\t.\t.\tID=x", "invalid strand"),
        ("chr\tR\tgene\t1\t5\t.\t+\t.\tgbkey=Gene", "lacks an identifier"),
        ("chr\tR\tgene\t1\t5\t.\t+\t.", "expected 9 GFF columns"),
    ),
)
def test_load_gff_genes_rejects_invalid_rows(tmp_path, row, message):
    gff = write(tmp_path / "bad.gff", row + "\n")
    with pytest.raises(regulatory_transterm.PilotError, match=message):
        regulatory_transterm.load_gff_genes(gff, {"chr": "A" * 100})


def test_load_gff_genes_rejects_duplicate_ids_regions_and_attributes(tmp_path):
    duplicate_gene = write(tmp_path / "gene.gff", """chr\tR\tgene\t1\t5\t.\t+\t.\tID=x
chr\tR\tgene\t10\t15\t.\t-\t.\tID=x
""")
    with pytest.raises(regulatory_transterm.PilotError, match="duplicate gene ID"):
        regulatory_transterm.load_gff_genes(duplicate_gene, {"chr": "A" * 100})

    duplicate_region = write(tmp_path / "region.gff", """chr\tR\tregion\t1\t100\t.\t+\t.\tID=x
chr\tR\tregion\t1\t100\t.\t+\t.\tID=y
chr\tR\tgene\t1\t5\t.\t+\t.\tID=g
""")
    with pytest.raises(regulatory_transterm.PilotError, match="duplicate region"):
        regulatory_transterm.load_gff_genes(duplicate_region, {"chr": "A" * 100})

    with pytest.raises(regulatory_transterm.PilotError, match="duplicate GFF attribute"):
        regulatory_transterm._attributes("ID=x;ID=y")


def test_load_gff_genes_rejects_file_without_genes(tmp_path):
    gff = write(tmp_path / "empty.gff", "chr\tR\tregion\t1\t100\t.\t+\t.\tID=chr\n")
    with pytest.raises(regulatory_transterm.PilotError, match="no gene features"):
        regulatory_transterm.load_gff_genes(gff, {"chr": "A" * 100})


def test_validate_pinned_utex_checks_identity_counts_and_hashes(tmp_path, monkeypatch):
    fasta = write(tmp_path / "genome.fna", ">chr\nAAAA\n")
    gff = write(tmp_path / "genome.gff", "gff\n")
    monkeypatch.setattr(regulatory_transterm, "EXPECTED_REPLICON_LENGTHS", {"chr": 4})
    monkeypatch.setattr(regulatory_transterm, "EXPECTED_TOTAL_LENGTH", 4)
    monkeypatch.setattr(regulatory_transterm, "EXPECTED_GENE_COUNT", 1)
    monkeypatch.setattr(regulatory_transterm, "ASSEMBLY_ACCESSION", "GCF_test.1")
    monkeypatch.setattr(
        regulatory_transterm, "FASTA_SHA256", hashlib.sha256(fasta.read_bytes()).hexdigest()
    )
    monkeypatch.setattr(
        regulatory_transterm, "GFF_SHA256", hashlib.sha256(gff.read_bytes()).hexdigest()
    )
    regulatory_transterm.validate_pinned_utex(
        fasta, gff, {"chr": "AAAA"}, [{}], {"chr": True}, "GCF_test.1"
    )
    with pytest.raises(regulatory_transterm.PilotError, match="replicons/lengths"):
        regulatory_transterm.validate_pinned_utex(
            fasta, gff, {"other": "AAAA"}, [{}], {"other": True}, "GCF_test.1"
        )
    with pytest.raises(regulatory_transterm.PilotError, match="must declare every"):
        regulatory_transterm.validate_pinned_utex(
            fasta, gff, {"chr": "AAAA"}, [{}], {"chr": False}, "GCF_test.1"
        )
    with pytest.raises(regulatory_transterm.PilotError, match="GFF assembly"):
        regulatory_transterm.validate_pinned_utex(
            fasta, gff, {"chr": "AAAA"}, [{}], {"chr": True}, "wrong"
        )
    with pytest.raises(regulatory_transterm.PilotError, match="expected 1"):
        regulatory_transterm.validate_pinned_utex(
            fasta, gff, {"chr": "AAAA"}, [], {"chr": True}, "GCF_test.1"
        )
    write(fasta, ">chr\nTTTT\n")
    with pytest.raises(regulatory_transterm.PilotError, match="FASTA SHA-256"):
        regulatory_transterm.validate_pinned_utex(
            fasta, gff, {"chr": "AAAA"}, [{}], {"chr": True}, "GCF_test.1"
        )


def test_deterministic_shuffle_is_stable_and_preserves_composition():
    sequence = "ACGT" * 100
    first = regulatory_transterm.deterministic_shuffle(sequence, 2973, "chr")
    assert first == regulatory_transterm.deterministic_shuffle(sequence, 2973, "chr")
    assert first != regulatory_transterm.deterministic_shuffle(sequence, 2974, "chr")
    assert sorted(first) == sorted(sequence)
    assert regulatory_transterm.sequence_sha256("ACGT") == hashlib.sha256(b"ACGT").hexdigest()


def test_parse_report_preserves_both_raw_strands_and_derives_tail_intervals():
    records, banner = regulatory_transterm.parse_report(
        report(PLUS, MINUS), {"chr": 100}, "native"
    )
    assert banner.startswith("TransTermHP v2.08")
    assert records[0] == {
        "id": "native:chr:TERM-1",
        "replicon": "chr",
        "rawTermNumber": 1,
        "rawStart": 20,
        "rawEnd": 30,
        "start": 20,
        "end": 30,
        "strand": "+",
        "tailStart": 31,
        "tailEnd": 45,
        "scoredTerminatorStart": 20,
        "scoredTerminatorEnd": 45,
        "coordinateSystem": "one-based inclusive",
        "confidence": 99,
        "hairpinScore": -12.7,
        "tailScore": -4.0,
        "regionContext": "F",
        "nearLinearizedBoundary": True,
        "notes": "gap 1",
    }
    assert records[1]["rawStart"] == 80
    assert records[1]["rawEnd"] == 60
    assert records[1]["start"] == 60
    assert records[1]["end"] == 80
    assert records[1]["tailStart"] == 45
    assert records[1]["tailEnd"] == 59
    assert records[1]["scoredTerminatorStart"] == 45
    assert records[1]["scoredTerminatorEnd"] == 80
    assert regulatory_transterm.summarize(records) == {
        "total": 2, "byStrand": {"+": 1, "-": 1}, "byReplicon": {"chr": 2}
    }


def test_parse_report_accepts_zero_hits():
    records, _ = regulatory_transterm.parse_report(report(), {"chr": 100}, "native")
    assert records == []
    assert regulatory_transterm.summarize(records) == {
        "total": 0, "byStrand": {}, "byReplicon": {}
    }


@pytest.mark.parametrize(
    ("raw_report", "lengths", "message"),
    (
        ("TransTermHP v2.08\nSEQUENCE chr (length 100)\n  TERM bad\n", {"chr": 100}, "malformed"),
        (report(length=100, sequence="other"), {"chr": 100}, "unknown sequence"),
        (report(length=99), {"chr": 100}, "wrong length"),
        ("TransTermHP v2.08\n" + PLUS + "\n", {"chr": 100}, "before SEQUENCE"),
        (report(PLUS, PLUS), {"chr": 100}, "duplicate TERM"),
        (report(PLUS) + "SEQUENCE chr (length 100)\n", {"chr": 100}, "duplicate sequence"),
        (report(PLUS.replace("20 - 30", "30 - 20")), {"chr": 100}, "plus-strand"),
        (report(MINUS.replace("80 - 60", "60 - 80")), {"chr": 100}, "minus-strand"),
        (report(PLUS.replace("20 - 30", "20 - 101")), {"chr": 100}, "out-of-bounds hairpin"),
        (report(PLUS.replace("20 - 30", "90 - 95")), {"chr": 100}, "out-of-bounds scored tail"),
        (report(PLUS.replace(" 99 ", " 101 ")), {"chr": 100}, "confidence outside"),
        (report(PLUS.replace(" F ", " X ")), {"chr": 100}, "invalid region context"),
        ("SEQUENCE chr (length 100)\n", {"chr": 100}, "missing the TransTermHP banner"),
        (report(), {"chr": 100, "plasmid": 20}, "missing sequence blocks"),
    ),
)
def test_parse_report_rejects_malformed_or_inconsistent_reports(raw_report, lengths, message):
    with pytest.raises(regulatory_transterm.PilotError, match=message):
        regulatory_transterm.parse_report(raw_report, lengths, "native")


def test_tsv_contains_normalized_and_raw_coordinates():
    records, _ = regulatory_transterm.parse_report(report(PLUS), {"chr": 100}, "native")
    payload = {"runs": [{"name": "native", "records": records}]}
    lines = regulatory_transterm.tsv_bytes(payload).decode().splitlines()
    assert lines[0].split("\t") == list(regulatory_transterm.TSV_FIELDS)
    cells = dict(zip(regulatory_transterm.TSV_FIELDS, lines[1].split("\t")))
    assert cells["start"] == "20"
    assert cells["raw_start"] == "20"
    assert cells["tail_end"] == "45"


def test_output_path_validation_and_exclusive_write(tmp_path):
    source = write(tmp_path / "source", "input")
    output = tmp_path / "output"
    regulatory_transterm._validate_output_paths([output], [source])
    regulatory_transterm._write_exclusive(output, b"first")
    with pytest.raises(regulatory_transterm.PilotError, match="refusing to overwrite"):
        regulatory_transterm._write_exclusive(output, b"second")
    with pytest.raises(regulatory_transterm.PilotError, match="must be distinct"):
        regulatory_transterm._validate_output_paths([output, output], [source])
    with pytest.raises(regulatory_transterm.PilotError, match="overwrite an input"):
        regulatory_transterm._validate_output_paths([source], [source])


def test_run_transterm_uses_safe_arguments_and_reports_failures(tmp_path, monkeypatch):
    binary = tmp_path / "transterm"
    expterm = tmp_path / "expterm.dat"
    fasta = tmp_path / "input.fasta"
    coords = tmp_path / "input.coords"
    observed = {}

    def fake_run(command, **kwargs):
        observed["command"] = command
        observed["kwargs"] = kwargs
        return SimpleNamespace(returncode=0, stdout="report\n", stderr="")

    monkeypatch.setattr(regulatory_transterm.subprocess, "run", fake_run)
    assert regulatory_transterm.run_transterm(
        binary, expterm, [fasta], coords, 76, 10
    ) == "report\n"
    assert observed["command"] == [
        str(binary), "--all-context", "-S", "-p", str(expterm), "-c", "76",
        str(fasta), str(coords),
    ]
    assert observed["kwargs"]["timeout"] == 10

    monkeypatch.setattr(
        regulatory_transterm.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=3, stdout="", stderr="bad input\n"),
    )
    with pytest.raises(regulatory_transterm.PilotError, match="exited 3: bad input"):
        regulatory_transterm.run_transterm(binary, expterm, [fasta], coords, 76, 10)

    monkeypatch.setattr(
        regulatory_transterm.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=0, stdout="", stderr=""),
    )
    with pytest.raises(regulatory_transterm.PilotError, match="empty report"):
        regulatory_transterm.run_transterm(binary, expterm, [fasta], coords, 76, 10)


def test_run_pilot_rejects_outputs_and_bad_runtime_inputs(tmp_path):
    paths = {
        name: tmp_path / name
        for name in (
            "transterm", "expterm", "source.zip", "input.fna", "input.gff",
            "output.json", "output.tsv", "native.raw", "control.raw",
        )
    }
    arguments = argparse.Namespace(
        transterm=paths["transterm"], expterm=paths["expterm"],
        source_archive=paths["source.zip"], fasta=paths["input.fna"],
        gff=paths["input.gff"], output_json=paths["output.json"],
        output_tsv=paths["output.tsv"], native_raw=paths["native.raw"],
        control_raw=paths["control.raw"], min_confidence=76, shuffle_seed=2973,
        timeout_seconds=10,
    )
    with pytest.raises(regulatory_transterm.PilotError, match="missing input file"):
        regulatory_transterm.run_pilot(arguments)
    for key in ("transterm", "expterm", "source.zip", "input.fna", "input.gff"):
        paths[key].write_bytes(b"x")
    with pytest.raises(regulatory_transterm.PilotError, match="not executable"):
        regulatory_transterm.run_pilot(arguments)
    paths["transterm"].chmod(0o755)
    arguments.min_confidence = 101
    with pytest.raises(regulatory_transterm.PilotError, match="between 0 and 100"):
        regulatory_transterm.run_pilot(arguments)
    arguments.min_confidence = 76
    arguments.timeout_seconds = 0
    with pytest.raises(regulatory_transterm.PilotError, match="must be positive"):
        regulatory_transterm.run_pilot(arguments)
    arguments.timeout_seconds = 10
    with pytest.raises(regulatory_transterm.PilotError, match="source archive SHA-256"):
        regulatory_transterm.run_pilot(arguments)


def test_build_payload_pins_provenance_and_control_meaning(tmp_path):
    files = {}
    for name in ("transterm", "expterm.dat", "source.zip", "genome.fna.gz", "genome.gff.gz"):
        files[name] = tmp_path / name
        files[name].write_bytes(name.encode())
    records, banner = regulatory_transterm.parse_report(report(PLUS), {"chr": 100}, "native")
    control_records, _ = regulatory_transterm.parse_report(
        report(MINUS), {"chr": 100}, "shuffled_control"
    )
    payload = regulatory_transterm.build_payload(
        binary=files["transterm"], expterm=files["expterm.dat"],
        source_archive=files["source.zip"], fasta=files["genome.fna.gz"],
        gff=files["genome.gff.gz"], native_sequences={"chr": "A" * 100},
        control_sequences={"chr": "A" * 100}, genes=[{}],
        native_report=report(PLUS), control_report=report(MINUS),
        native_records=records, control_records=control_records, banner=banner,
        min_confidence=76, shuffle_seed=2973,
    )
    assert payload["recordOrigin"] == "computed"
    assert payload["coordinateContract"]["system"] == "one-based inclusive"
    assert payload["coordinateContract"]["reportedInterval"].startswith("hairpin only")
    assert payload["coordinateContract"]["circularBoundaryPolicy"][
        "conservativeIncompleteContextSpanAtEachLinearizedEndNt"
    ] == 74
    assert "not a calibrated probability" in payload["confidenceContract"]["limitation"]
    assert payload["provenance"]["control"]["interpretation"].startswith("null hit")
    assert payload["runs"][0]["counts"]["total"] == 1
    assert json.loads(json.dumps(payload))["schemaVersion"] == 2


def test_argument_parser_requires_all_artifact_paths():
    with pytest.raises(SystemExit):
        regulatory_transterm.parser().parse_args([])


@pytest.mark.parametrize("header", [">", "> ", ">\t"])
def test_empty_fasta_headers_are_user_facing_errors(tmp_path, header):
    fasta = write(tmp_path / "empty.fna", header + "\nACGT\n")
    with pytest.raises(regulatory_transterm.PilotError, match="empty FASTA identifier"):
        regulatory_transterm.load_fasta(fasta)


@pytest.mark.parametrize("failure", [OSError("disk full"), KeyboardInterrupt()])
def test_partial_current_output_is_removed(tmp_path, monkeypatch, failure):
    output = tmp_path / "partial.tsv"
    real_open = Path.open

    class FailingWriter:
        def __init__(self, handle):
            self.handle = handle

        def __enter__(self):
            return self

        def __exit__(self, *args):
            self.handle.close()

        def write(self, data):
            self.handle.write(data[:3])
            self.handle.flush()
            raise failure

    def fail_write(path, *args, **kwargs):
        handle = real_open(path, *args, **kwargs)
        return FailingWriter(handle) if path == output else handle

    monkeypatch.setattr(Path, "open", fail_write)
    expected = regulatory_transterm.PilotError if isinstance(failure, OSError) else KeyboardInterrupt
    with pytest.raises(expected):
        regulatory_transterm._write_exclusive(output, b"a partial report")
    assert not output.exists()


def test_output_creation_errors_are_user_facing(tmp_path):
    blocker = write(tmp_path / "parent", "preserve")
    with pytest.raises(regulatory_transterm.PilotError, match="refusing to overwrite|could not create"):
        regulatory_transterm._write_exclusive(blocker / "file.tsv", b"report")
    assert blocker.read_text() == "preserve"


@pytest.fixture
def synthetic_pilot(tmp_path, monkeypatch):
    inputs = {}
    for key in ("transterm", "expterm", "source_archive", "fasta", "gff"):
        inputs[key] = write(tmp_path / key, key)
    inputs["transterm"].chmod(0o755)
    outputs = {key: tmp_path / key for key in ("output_json", "output_tsv", "native_raw", "control_raw")}
    args = argparse.Namespace(**inputs, **outputs, min_confidence=76, shuffle_seed=2973, timeout_seconds=1)
    monkeypatch.setattr(regulatory_transterm, "TRANSTERM_SOURCE_SHA256", regulatory_transterm.sha256_file(inputs["source_archive"]))
    monkeypatch.setattr(regulatory_transterm, "EXPTERM_SHA256", regulatory_transterm.sha256_file(inputs["expterm"]))
    monkeypatch.setattr(regulatory_transterm, "load_fasta", lambda _: {"chr": "A" * 100})
    monkeypatch.setattr(regulatory_transterm, "load_gff_genes", lambda *a: ([], {"chr": True}, "test"))
    monkeypatch.setattr(regulatory_transterm, "validate_pinned_utex", lambda *a: None)
    monkeypatch.setattr(regulatory_transterm, "run_transterm", lambda *a: report(PLUS))
    return args, inputs, outputs


@pytest.mark.parametrize("failure", [regulatory_transterm.PilotError("write failed"), KeyboardInterrupt()])
def test_failed_report_batch_removes_previously_created_outputs(synthetic_pilot, monkeypatch, failure):
    args, inputs, outputs = synthetic_pilot
    real_writer = regulatory_transterm._write_exclusive

    def fail_third(path, data):
        if path == outputs["output_tsv"]:
            raise failure
        real_writer(path, data)

    monkeypatch.setattr(regulatory_transterm, "_write_exclusive", fail_third)
    with pytest.raises(type(failure)):
        regulatory_transterm.run_pilot(args)
    assert all(not path.exists() for path in outputs.values())
    assert all(path.read_text() == key for key, path in inputs.items())


def test_pseudogenes_are_preserved_as_tool_annotation_spans(tmp_path):
    gff = write(tmp_path / "pseudo.gff", "chr\tR\tpseudogene\t10\t30\t.\t+\t.\tID=pseudo;locus_tag=p\n")
    genes, _, _ = regulatory_transterm.load_gff_genes(gff, {"chr": "A" * 100})
    assert genes[0]["id"] == "p"
    assert genes[0]["featureType"] == "pseudogene"
    coords = tmp_path / "annotations.coords"
    regulatory_transterm._write_coords(coords, genes)
    assert coords.read_text() == "p\t10\t30\tchr\n"


def test_near_boundary_hits_are_flagged_not_silently_excluded():
    rows, _ = regulatory_transterm.parse_report(report(PLUS), {"chr": 100}, "native")
    assert rows[0]["nearLinearizedBoundary"] is True
    middle = PLUS.replace("20 - 30", "120 - 130")
    rows, _ = regulatory_transterm.parse_report(report(middle, length=300), {"chr": 300}, "native")
    assert rows[0]["nearLinearizedBoundary"] is False
    near_end = PLUS.replace("20 - 30", "220 - 230")
    rows, _ = regulatory_transterm.parse_report(report(near_end, length=300), {"chr": 300}, "native")
    assert rows[0]["nearLinearizedBoundary"] is True  # hairpin and tail enter the band


@pytest.mark.parametrize("loader,suffix", [
    (regulatory_transterm.load_fasta, "fna.gz"),
    (lambda path: regulatory_transterm.load_gff_genes(path, {"chr": "A" * 100}), "gff.gz"),
])
def test_corrupt_compressed_inputs_fail_cleanly(tmp_path, loader, suffix):
    path = tmp_path / suffix
    path.write_bytes(b"not gzip")
    with pytest.raises(regulatory_transterm.PilotError, match="could not read"):
        loader(path)


@pytest.mark.parametrize("end,circular", [(120, False), (190, True), (201, True)])
def test_invalid_origin_wrapping_intervals_are_rejected(tmp_path, end, circular):
    gff = write(tmp_path / "wrap.gff", (
        f"chr\tR\tregion\t1\t100\t.\t+\t.\tIs_circular={str(circular).lower()}\n"
        f"chr\tR\tgene\t90\t{end}\t.\t-\t.\tID=bad\n"
    ))
    with pytest.raises(regulatory_transterm.PilotError, match="out-of-bounds"):
        regulatory_transterm.load_gff_genes(gff, {"chr": "A" * 100})


@pytest.mark.parametrize("wrap", [False, True])
def test_unrepresentable_minus_strand_annotations_are_rejected(tmp_path, monkeypatch, wrap):
    monkeypatch.setattr(regulatory_transterm, "EXPECTED_REPLICON_LENGTHS", {"chr": 100})
    gene = {"id": "single", "replicon": "chr", "start": 100 if wrap else 20,
            "end": 5 if wrap else 20, "strand": "-", "wrapsOrigin": wrap}
    with pytest.raises(regulatory_transterm.PilotError, match="one-base minus-strand"):
        regulatory_transterm._write_coords(tmp_path / "coords", [gene])


@pytest.mark.parametrize("failure", [OSError("exec failed"), subprocess.TimeoutExpired("tool", 1)])
def test_execution_failures_are_typed(monkeypatch, failure):
    def fail(*args, **kwargs):
        raise failure
    monkeypatch.setattr(regulatory_transterm.subprocess, "run", fail)
    with pytest.raises(regulatory_transterm.PilotError, match="execution failed"):
        regulatory_transterm.run_transterm(Path("tool"), Path("model"), [], Path("coords"), 76, 1)


def test_inconsistent_banners_fail_before_outputs(synthetic_pilot, monkeypatch):
    args, _, outputs = synthetic_pilot
    reports = iter([report(PLUS), report(PLUS).replace("v2.08", "v2.09")])
    monkeypatch.setattr(regulatory_transterm, "run_transterm", lambda *a: next(reports))
    with pytest.raises(regulatory_transterm.PilotError, match="different runtime banners"):
        regulatory_transterm.run_pilot(args)
    assert all(not p.exists() for p in outputs.values())


def test_wrong_model_pin_fails_before_outputs(synthetic_pilot):
    args, _, outputs = synthetic_pilot
    args.expterm.write_text("changed model")
    with pytest.raises(regulatory_transterm.PilotError, match="expterm.dat SHA-256"):
        regulatory_transterm.run_pilot(args)
    assert all(not p.exists() for p in outputs.values())


def test_successful_report_batch_is_complete(synthetic_pilot):
    args, _, outputs = synthetic_pilot
    payload = regulatory_transterm.run_pilot(args)
    assert all(p.is_file() for p in outputs.values())
    assert json.loads(outputs["output_json"].read_text()) == payload
    assert outputs["output_tsv"].read_bytes() == regulatory_transterm.tsv_bytes(payload)
    assert [r["counts"]["total"] for r in payload["runs"]] == [1, 1]


@pytest.mark.parametrize("interrupt", [False, True])
def test_batch_cleanup_retains_original_error_and_attempts_all_files(synthetic_pilot, monkeypatch, interrupt):
    args, _, outputs = synthetic_pilot
    real_writer = regulatory_transterm._write_exclusive
    real_unlink = Path.unlink
    failure = KeyboardInterrupt() if interrupt else regulatory_transterm.PilotError("original failure")
    def fail_third(path, data):
        if path == outputs["output_tsv"]:
            raise failure
        real_writer(path, data)
    def refuse_native(path, *a, **kw):
        if path == outputs["native_raw"]:
            raise PermissionError("unlink denied")
        return real_unlink(path, *a, **kw)
    monkeypatch.setattr(regulatory_transterm, "_write_exclusive", fail_third)
    monkeypatch.setattr(Path, "unlink", refuse_native)
    with pytest.raises(type(failure)) as exc:
        regulatory_transterm.run_pilot(args)
    if interrupt:
        assert exc.value is failure
        assert "unlink denied" in exc.value.__notes__[0]
    else:
        assert "original failure" in str(exc.value)
        assert "unlink denied" in str(exc.value)
        assert exc.value.__cause__ is failure
    assert outputs["native_raw"].exists()
    assert not outputs["control_raw"].exists()
