"""Tests for tools/regulatory_rfam.py, the pinned Rfam/Infernal native pilot.

Every code path is exercised with synthetic fixtures and a stub cmsearch, so
the suite runs without Infernal installed. Synthetic runs go through the
private ``_run_pilot`` with pins computed from the fixtures; the production
``run_pilot`` and ``main`` are tested only to refuse anything but ``PINNED``.
The real-tool tests at the end run the actual `cmsearch` from the user-owned
`trna-validate` environment against the pinned UTEX 2973 assembly, and skip
when either is absent.
"""

import gzip
import hashlib
import json
import stat
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import regulatory_rfam as rr  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[1]
REAL_CMSEARCH = Path("/opt/miniconda3/envs/trna-validate/bin/cmsearch")
PINNED_FASTA = REPO_ROOT / "data/raw/GCF_000817325.1_ASM81732v1_genomic.fna.gz"
PINNED_GBFF = REPO_ROOT / "data/raw/GCF_000817325.1_ASM81732v1_genomic.gbff.gz"
SCRATCH_MODEL = REPO_ROOT / ".playwright-cli/regulatory-rfam/source/RF01116.cm"

TBLOUT_HEADER = (
    "#target name         accession query name           accession mdl mdl from"
    "   mdl to seq from   seq to strand trunc pass   gc  bias  score   E-value"
    " inc description of target\n"
    "#------------------- --------- -------------------- --------- --- --------"
    " -------- -------- -------- ------ ----- ---- ---- ----- ------ ---------"
    " --- ---------------------\n"
)

TBLOUT_TRAILER = (
    "#\n# Program:         cmsearch\n# Version:         1.1.5 (Sep 2023)\n"
    "# Date:            Mon Oct 12 10:53:11 2026\n# [ok]\n"
)

# A plus-strand row with every column at a plausible value; tests override
# single fields to build each malformed or boundary case.
BASE_ROW = {
    "target": "NZ_TEST001.1",
    "target_accession": "-",
    "query_name": "Yfr1",
    "query_accession": "RF01116",
    "model_type": "cm",
    "mdl_from": "1",
    "mdl_to": "4",
    "seq_from": "11",
    "seq_to": "14",
    "strand": "+",
    "trunc": "no",
    "pipeline_pass": "1",
    "gc": "0.60",
    "bias": "0.0",
    "score": "62.1",
    "evalue": "6.7e-12",
    "inc": "!",
    "description": "test replicon one",
}

_ROW_ORDER = (
    "target",
    "target_accession",
    "query_name",
    "query_accession",
    "model_type",
    "mdl_from",
    "mdl_to",
    "seq_from",
    "seq_to",
    "strand",
    "trunc",
    "pipeline_pass",
    "gc",
    "bias",
    "score",
    "evalue",
    "inc",
    "description",
)


def row(**overrides):
    """Builds one cmsearch tabular data row from BASE_ROW plus overrides."""
    fields = dict(BASE_ROW, **overrides)
    return " ".join(str(fields[key]) for key in _ROW_ORDER)


def write_tblout(path: Path, *rows: str) -> Path:
    path.write_text(
        TBLOUT_HEADER + "".join(f"{line}\n" for line in rows) + TBLOUT_TRAILER,
        encoding="utf-8",
    )
    return path


# A single-family model header, matching the shape cmfetch emits. CLEN/W are
# small so junction arithmetic in the tests is checkable by hand.
def write_model(
    path: Path,
    *,
    accession="RF01116",
    name="Yfr1",
    clen=4,
    window=6,
    gathering="38.00",
    models=1,
    omit=(),
    format_line="INFERNAL1/a [1.1.5 | Sep 2023]",
    coefficient="1.0",
) -> Path:
    header = [
        ("NAME", name),
        ("ACC", accession),
        ("DESC", "Cyanobacterial functional RNA 1"),
        ("CLEN", str(clen)),
        ("W", str(window)),
        ("GA", gathering),
        ("TC", "38.00"),
        ("NC", "37.90"),
    ]
    blocks = []
    for _ in range(models):
        lines = [format_line]
        lines.extend(
            f"{key:<8} {value}" for key, value in header if key not in omit
        )
        # The model body: parse_covariance_model must stop collecting header
        # fields here, so a body line that looks like "GA 1.0" is ignored.
        lines.extend(
            ["CM", f"          GA       {coefficient}", "          [ ROOT    0 ]", "//"]
        )
        blocks.append("\n".join(lines))
    path.write_text("\n".join(blocks) + "\n", encoding="utf-8")
    return path


def write_genome(path: Path, sequences: dict[str, str]) -> Path:
    lines = []
    for name, sequence in sequences.items():
        lines.append(f">{name} test replicon")
        lines.append(sequence)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def write_gbff(path: Path, records: dict[str, tuple[int, str]]) -> Path:
    blocks = []
    for accession, (length, topology) in records.items():
        base = accession.split(".")[0]
        blocks.append(
            f"LOCUS       {base}          {length} bp    DNA     {topology} CON "
            "14-MAY-2026\n"
            f"DEFINITION  test replicon.\n"
            f"VERSION     {accession}\n"
            "//\n"
        )
    path.write_text("".join(blocks), encoding="utf-8")
    return path


def pins_for(cm_path: Path, fasta_path: Path, gbff_path: Path, **overrides):
    """Pins describing exactly these fixture files, with optional overrides."""
    model = rr.parse_covariance_model(cm_path)
    records = rr.load_fasta(fasta_path)
    replicons = rr.build_replicons(records, rr.parse_locus_topologies(gbff_path))
    fields = {
        "assembly_label": "synthetic test assembly",
        "model_accession": model.accession,
        "model_name": model.name,
        "model_sha256": rr.sha256_file(cm_path),
        "model_clen": model.clen,
        "model_window": model.window,
        "gathering_cutoff": model.gathering_cutoff,
        "fasta_sha256": rr.sha256_file(fasta_path),
        "fasta_md5": rr.md5_file(fasta_path),
        "gbff_sha256": rr.sha256_file(gbff_path),
        "gbff_md5": rr.md5_file(gbff_path),
        "searched_fasta_sha256": rr.sha256_text(
            rr.fasta_text(rr.native_records(records))
        ),
        "replicons": tuple((r.accession, r.length, r.topology) for r in replicons),
        "infernal_version": "1.1.5 (Sep 2023)",
    }
    fields.update(overrides)
    return rr.PinnedIdentity(**fields)


STUB_CMSEARCH = '''#!/usr/bin/env python3
"""Stub cmsearch: echoes a version banner and replays canned rows.

Rows for a search come from $STUB_ROWS/<target fasta stem>.rows, so one
directory drives the native, origin-junction and control searches
independently. A stem with no file produces a zero-hit table. The main output
carries cmsearch's pipeline summary, counted from the target FASTA, less
$STUB_DROP_SEQUENCES sequences to imitate a run that covered too little.
"""
import os
import sys
from pathlib import Path

if "-h" in sys.argv:
    print("# cmsearch :: search CM(s) against a sequence database")
    print("# INFERNAL " + os.environ.get("STUB_VERSION", "1.1.5 (Sep 2023)"))
    raise SystemExit(0)

if os.environ.get("STUB_FAIL"):
    sys.stderr.write("stub cmsearch failure\\n")
    raise SystemExit(3)

argv = sys.argv[1:]
tblout = Path(argv[argv.index("--tblout") + 1])
stdout_path = Path(argv[argv.index("-o") + 1])
target = Path(argv[-1])
rows_file = Path(os.environ["STUB_ROWS"]) / f"{target.stem}.rows"
rows = rows_file.read_text() if rows_file.exists() else ""
tblout.write_text(HEADER + rows + TRAILER)
sequences = residues = 0
for line in target.read_text().splitlines():
    if line.startswith(">"):
        sequences += 1
    else:
        residues += len(line.strip())
sequences -= int(os.environ.get("STUB_DROP_SEQUENCES", "0"))
hits = sum(1 for line in rows.splitlines() if line.strip())
stdout_path.write_text(
    f"# stub cmsearch over {target.name}\\n"
    "Query model(s):          1  (4 consensus positions)\\n"
    f"Target sequences:        {sequences}  ({2 * residues} residues searched)\\n"
    f"Total CM hits reported:  {hits}  (0); includes 0 truncated hit(s)\\n"
)
'''


@pytest.fixture
def stub_cmsearch(tmp_path, monkeypatch):
    """An executable stub cmsearch plus the directory that feeds it rows."""
    rows_dir = tmp_path / "rows"
    rows_dir.mkdir()
    script = tmp_path / "cmsearch"
    script.write_text(
        STUB_CMSEARCH.replace("HEADER", repr(TBLOUT_HEADER)).replace(
            "TRAILER", repr(TBLOUT_TRAILER)
        ),
        encoding="utf-8",
    )
    script.chmod(script.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    monkeypatch.setenv("STUB_ROWS", str(rows_dir))
    return script, rows_dir


# --------------------------------------------------------------------------
# Digests
# --------------------------------------------------------------------------


def test_file_digests_match_hashlib(tmp_path):
    payload = b"ACGT" * 1000
    target = tmp_path / "bytes.bin"
    target.write_bytes(payload)
    assert rr.sha256_file(target) == hashlib.sha256(payload).hexdigest()
    assert rr.md5_file(target) == hashlib.md5(payload).hexdigest()
    assert rr.sha256_text("") == (
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    )


# --------------------------------------------------------------------------
# Production pins
# --------------------------------------------------------------------------


def test_production_pins_name_the_rfam_family_and_native_assembly():
    pins = rr.PINNED
    assert (pins.model_accession, pins.model_name) == ("RF01116", "Yfr1")
    assert (pins.model_clen, pins.model_window, pins.gathering_cutoff) == (59, 86, 38.0)
    # NCBI's own md5checksums.txt values for the compressed assembly files.
    assert pins.fasta_md5 == "610ceb15a9859046e143d80915d4c984"
    assert pins.gbff_md5 == "fc86ce730ae02cc1cbad14129d50cd45"
    # The decompressed FASTA SHA-256 trna-annotation-validation.md records.
    assert pins.searched_fasta_sha256 == (
        "4716bbf61cfeb296587c94e90e6b6ce037752f9b9d4d225addd15eea02124984"
    )
    assert pins.replicons == (
        ("NZ_CP006471.1", 2690418, "circular"),
        ("NZ_CP006472.1", 46366, "circular"),
        ("NZ_CP006473.1", 7842, "circular"),
    )
    assert pins.infernal_version == "1.1.5 (Sep 2023)"
    assert "GCF_000817325.1_ASM81732v1" in pins.assembly_label


def test_md5_pins_agree_with_the_committed_ncbi_manifest():
    manifest = (REPO_ROOT / "data/raw/md5checksums.txt").read_text(encoding="utf-8")
    entries = {
        name: md5
        for md5, name in (line.split() for line in manifest.splitlines() if line.strip())
    }
    assert entries["./GCF_000817325.1_ASM81732v1_genomic.fna.gz"] == rr.PINNED.fasta_md5
    assert entries["./GCF_000817325.1_ASM81732v1_genomic.gbff.gz"] == rr.PINNED.gbff_md5


# --------------------------------------------------------------------------
# Covariance model header
# --------------------------------------------------------------------------


def test_parse_covariance_model_reads_the_pinned_header(tmp_path):
    model = rr.parse_covariance_model(write_model(tmp_path / "m.cm"))
    assert model.accession == "RF01116"
    assert model.name == "Yfr1"
    assert model.description == "Cyanobacterial functional RNA 1"
    assert (model.clen, model.window) == (4, 6)
    # The body line "GA 1.0" after CM must not override the header threshold.
    assert model.gathering_cutoff == 38.0
    assert model.format_line == "INFERNAL1/a [1.1.5 | Sep 2023]"


def test_parse_covariance_model_rejects_a_multi_family_library(tmp_path):
    path = write_model(tmp_path / "library.cm", models=2)
    with pytest.raises(rr.RegulatoryRfamError, match="more than one model"):
        rr.parse_covariance_model(path)


def test_parse_covariance_model_rejects_a_file_with_no_model(tmp_path):
    path = tmp_path / "empty.cm"
    path.write_text("NAME Yfr1\nACC RF01116\n", encoding="utf-8")
    with pytest.raises(rr.RegulatoryRfamError, match="no Infernal model"):
        rr.parse_covariance_model(path)


@pytest.mark.parametrize("missing", ["NAME", "ACC", "CLEN", "W", "GA"])
def test_parse_covariance_model_requires_every_pinned_header_field(tmp_path, missing):
    path = write_model(tmp_path / "m.cm", omit=(missing,))
    with pytest.raises(rr.RegulatoryRfamError, match=f"has no {missing}"):
        rr.parse_covariance_model(path)


def test_parse_covariance_model_rejects_an_unreadable_threshold(tmp_path):
    path = write_model(tmp_path / "m.cm", gathering="undefined")
    with pytest.raises(rr.RegulatoryRfamError, match="unreadable CLEN/W/GA"):
        rr.parse_covariance_model(path)


@pytest.mark.parametrize("gathering", ["nan", "inf", "-inf"])
def test_parse_covariance_model_rejects_a_nonfinite_threshold(tmp_path, gathering):
    path = write_model(tmp_path / "m.cm", gathering=gathering)
    with pytest.raises(rr.RegulatoryRfamError, match="non-finite GA"):
        rr.parse_covariance_model(path)


@pytest.mark.parametrize(("clen", "window"), [(0, 6), (4, 0)])
def test_parse_covariance_model_rejects_a_degenerate_model(tmp_path, clen, window):
    path = write_model(tmp_path / "m.cm", clen=clen, window=window)
    with pytest.raises(rr.RegulatoryRfamError, match="must be at least 1"):
        rr.parse_covariance_model(path)


def test_parse_covariance_model_reports_a_missing_file(tmp_path):
    with pytest.raises(rr.RegulatoryRfamError, match="missing covariance model"):
        rr.parse_covariance_model(tmp_path / "absent.cm")


def test_require_file_rejects_a_directory(tmp_path):
    with pytest.raises(rr.RegulatoryRfamError, match="is not a file"):
        rr.require_file(tmp_path, "covariance model")


# --------------------------------------------------------------------------
# FASTA and topology
# --------------------------------------------------------------------------


def test_load_fasta_keeps_order_descriptions_and_uppercases(tmp_path):
    path = tmp_path / "g.fna"
    path.write_text(">b.1 second\nacgt\nACGT\n>a.1 first\nTTTT\n", encoding="utf-8")
    assert rr.load_fasta(path) == [
        ("b.1", "second", "ACGTACGT"),
        ("a.1", "first", "TTTT"),
    ]


def test_load_fasta_reads_gzip(tmp_path):
    import gzip

    path = tmp_path / "g.fna.gz"
    with gzip.open(path, "wt") as handle:
        handle.write(">x.1 desc\nACGT\n")
    assert rr.load_fasta(path) == [("x.1", "desc", "ACGT")]


def test_load_fasta_rejects_duplicate_sequence_ids(tmp_path):
    path = tmp_path / "g.fna"
    path.write_text(">x.1 a\nACGT\n>x.1 b\nTGCA\n", encoding="utf-8")
    with pytest.raises(rr.RegulatoryRfamError, match="duplicate FASTA sequence id"):
        rr.load_fasta(path)


def test_load_fasta_rejects_an_empty_record(tmp_path):
    path = tmp_path / "g.fna"
    path.write_text(">x.1 a\n>y.1 b\nACGT\n", encoding="utf-8")
    with pytest.raises(rr.RegulatoryRfamError, match="has no sequence"):
        rr.load_fasta(path)


def test_load_fasta_rejects_a_header_with_no_id(tmp_path):
    path = tmp_path / "g.fna"
    path.write_text(">\nACGT\n", encoding="utf-8")
    with pytest.raises(rr.RegulatoryRfamError, match="record with no id"):
        rr.load_fasta(path)


def test_load_fasta_rejects_sequence_before_a_header(tmp_path):
    path = tmp_path / "g.fna"
    path.write_text("ACGT\n>x.1 a\nACGT\n", encoding="utf-8")
    with pytest.raises(rr.RegulatoryRfamError, match="before any header"):
        rr.load_fasta(path)


def test_load_fasta_rejects_an_empty_file(tmp_path):
    path = tmp_path / "g.fna"
    path.write_text("\n", encoding="utf-8")
    with pytest.raises(rr.RegulatoryRfamError, match="no FASTA records"):
        rr.load_fasta(path)


def test_parse_locus_topologies_pairs_topology_with_the_versioned_accession(tmp_path):
    path = write_gbff(
        tmp_path / "g.gbff",
        {"NZ_TEST001.1": (20, "circular"), "NZ_TEST002.1": (12, "linear")},
    )
    # The LOCUS line names NZ_TEST001; only VERSION carries the ".1".
    assert rr.parse_locus_topologies(path) == {
        "NZ_TEST001.1": "circular",
        "NZ_TEST002.1": "linear",
    }


def test_parse_locus_topologies_rejects_a_locus_without_a_version(tmp_path):
    path = tmp_path / "g.gbff"
    path.write_text(
        "LOCUS       NZ_A          20 bp    DNA     circular CON 14-MAY-2026\n"
        "LOCUS       NZ_B          20 bp    DNA     circular CON 14-MAY-2026\n"
        "VERSION     NZ_B.1\n",
        encoding="utf-8",
    )
    with pytest.raises(rr.RegulatoryRfamError, match="no VERSION line"):
        rr.parse_locus_topologies(path)


def test_parse_locus_topologies_rejects_a_trailing_locus_without_a_version(tmp_path):
    path = tmp_path / "g.gbff"
    path.write_text(
        "LOCUS       NZ_A          20 bp    DNA     circular CON 14-MAY-2026\n",
        encoding="utf-8",
    )
    with pytest.raises(rr.RegulatoryRfamError, match="last LOCUS record"):
        rr.parse_locus_topologies(path)


def test_parse_locus_topologies_rejects_a_version_without_a_locus(tmp_path):
    path = tmp_path / "g.gbff"
    path.write_text("VERSION     NZ_A.1\n", encoding="utf-8")
    with pytest.raises(rr.RegulatoryRfamError, match="no preceding LOCUS"):
        rr.parse_locus_topologies(path)


def test_parse_locus_topologies_rejects_an_empty_version_line(tmp_path):
    path = tmp_path / "g.gbff"
    path.write_text(
        "LOCUS       NZ_A          20 bp    DNA     circular CON 14-MAY-2026\n"
        "VERSION\n",
        encoding="utf-8",
    )
    with pytest.raises(rr.RegulatoryRfamError, match="empty VERSION line"):
        rr.parse_locus_topologies(path)


def test_parse_locus_topologies_rejects_a_file_with_no_records(tmp_path):
    path = tmp_path / "g.gbff"
    path.write_text("DEFINITION nothing here.\n", encoding="utf-8")
    with pytest.raises(rr.RegulatoryRfamError, match="no LOCUS/VERSION records"):
        rr.parse_locus_topologies(path)


def test_build_replicons_refuses_a_sequence_with_no_declared_topology():
    records = [("NZ_TEST001.1", "d", "ACGT")]
    with pytest.raises(rr.RegulatoryRfamError, match="no topology in the pinned"):
        rr.build_replicons(records, {"NZ_OTHER.1": "circular"})


def test_build_replicons_carries_length_and_topology():
    records = [("NZ_TEST001.1", "chromosome", "ACGTACGT")]
    (replicon,) = rr.build_replicons(records, {"NZ_TEST001.1": "circular"})
    assert (replicon.length, replicon.topology) == (8, "circular")


# --------------------------------------------------------------------------
# Tabular output parsing
# --------------------------------------------------------------------------


def test_parse_tblout_reads_both_strands_with_raw_and_normalised_endpoints(tmp_path):
    path = write_tblout(
        tmp_path / "t.tblout",
        row(),
        row(seq_from="19", seq_to="12", strand="-", score="41.3", evalue="1e-05"),
    )
    plus, minus = rr.parse_tblout(path)
    assert (plus.strand, plus.seq_from, plus.seq_to) == ("+", 11, 14)
    assert (plus.native_start, plus.native_end, plus.native_length) == (11, 14, 4)
    # The minus-strand row keeps cmsearch's high-to-low raw orientation and
    # still normalises to a one-based inclusive ascending interval.
    assert (minus.strand, minus.seq_from, minus.seq_to) == ("-", 19, 12)
    assert (minus.native_start, minus.native_end, minus.native_length) == (12, 19, 8)
    assert minus.identity == ("NZ_TEST001.1", "-", 19, 12)


def test_parse_tblout_keeps_a_description_containing_spaces(tmp_path):
    path = write_tblout(tmp_path / "t.tblout", row(description="a b c  d"))
    (hit,) = rr.parse_tblout(path)
    assert hit.description == "a b c  d"


def test_parse_tblout_accepts_a_row_with_no_description(tmp_path):
    fields = " ".join(str(BASE_ROW[key]) for key in _ROW_ORDER[:-1])
    path = write_tblout(tmp_path / "t.tblout", fields)
    (hit,) = rr.parse_tblout(path)
    assert hit.description == ""


def test_parse_tblout_returns_no_hits_for_an_empty_table(tmp_path):
    path = write_tblout(tmp_path / "t.tblout")
    assert rr.parse_tblout(path) == []


def test_parse_tblout_rejects_a_truncated_row(tmp_path):
    path = write_tblout(tmp_path / "t.tblout", "NZ_TEST001.1 - Yfr1 RF01116 cm 1 4")
    with pytest.raises(rr.RegulatoryRfamError, match="expected at least 17 columns"):
        rr.parse_tblout(path)


def test_parse_tblout_rejects_an_unknown_strand(tmp_path):
    path = write_tblout(tmp_path / "t.tblout", row(strand="?"))
    with pytest.raises(rr.RegulatoryRfamError, match="is neither \\+ nor -"):
        rr.parse_tblout(path)


def test_parse_tblout_rejects_an_unknown_truncation_state(tmp_path):
    path = write_tblout(tmp_path / "t.tblout", row(trunc="maybe"))
    with pytest.raises(rr.RegulatoryRfamError, match="unknown truncation state"):
        rr.parse_tblout(path)


@pytest.mark.parametrize("trunc", sorted(rr.TRUNCATION_STATES))
def test_parse_tblout_keeps_every_truncation_state(tmp_path, trunc):
    path = write_tblout(tmp_path / "t.tblout", row(trunc=trunc))
    (hit,) = rr.parse_tblout(path)
    assert hit.trunc == trunc


def test_parse_tblout_rejects_plus_strand_endpoints_running_backwards(tmp_path):
    path = write_tblout(tmp_path / "t.tblout", row(seq_from="14", seq_to="11"))
    with pytest.raises(rr.RegulatoryRfamError, match="plus-strand endpoints"):
        rr.parse_tblout(path)


def test_parse_tblout_rejects_minus_strand_endpoints_running_forwards(tmp_path):
    path = write_tblout(
        tmp_path / "t.tblout", row(seq_from="11", seq_to="14", strand="-")
    )
    with pytest.raises(rr.RegulatoryRfamError, match="minus-strand endpoints"):
        rr.parse_tblout(path)


def test_parse_tblout_accepts_a_single_base_hit_on_either_strand(tmp_path):
    path = write_tblout(
        tmp_path / "t.tblout",
        row(seq_from="11", seq_to="11"),
        row(seq_from="12", seq_to="12", strand="-"),
    )
    assert [hit.native_length for hit in rr.parse_tblout(path)] == [1, 1]


@pytest.mark.parametrize(
    ("field", "value", "label"),
    [
        ("mdl_from", "x", "mdl from"),
        ("mdl_to", "", "mdl to"),
        ("seq_from", "1.5", "seq from"),
        ("seq_to", "ten", "seq to"),
        ("pipeline_pass", "first", "pass"),
    ],
)
def test_parse_tblout_rejects_a_nonintegral_field(tmp_path, field, value, label):
    path = write_tblout(tmp_path / "t.tblout", row(**{field: value or "-"}))
    with pytest.raises(rr.RegulatoryRfamError, match=f"{label} .* is not an integer"):
        rr.parse_tblout(path)


@pytest.mark.parametrize(
    ("field", "label"),
    [("gc", "gc"), ("bias", "bias"), ("score", "score"), ("evalue", "E-value")],
)
def test_parse_tblout_rejects_an_unparseable_number(tmp_path, field, label):
    path = write_tblout(tmp_path / "t.tblout", row(**{field: "high"}))
    with pytest.raises(rr.RegulatoryRfamError, match=f"{label} .* is not a number"):
        rr.parse_tblout(path)


@pytest.mark.parametrize("field", ["gc", "bias", "score", "evalue"])
@pytest.mark.parametrize("value", ["nan", "inf", "-inf"])
def test_parse_tblout_rejects_a_nonfinite_number(tmp_path, field, value):
    path = write_tblout(tmp_path / "t.tblout", row(**{field: value}))
    with pytest.raises(rr.RegulatoryRfamError, match="is not finite"):
        rr.parse_tblout(path)


def test_parse_tblout_reports_the_offending_row_number(tmp_path):
    path = write_tblout(tmp_path / "t.tblout", row(), row(strand="?"))
    with pytest.raises(rr.RegulatoryRfamError, match="cmsearch row 4:"):
        rr.parse_tblout(path)


def test_parse_tblout_reports_a_missing_file(tmp_path):
    with pytest.raises(rr.RegulatoryRfamError, match="missing cmsearch tabular"):
        rr.parse_tblout(tmp_path / "absent.tblout")


def test_tblout_rows_digest_ignores_the_run_date(tmp_path):
    first = write_tblout(tmp_path / "a.tblout", row())
    second = tmp_path / "b.tblout"
    second.write_text(
        TBLOUT_HEADER
        + row()
        + "\n#\n# Date:            Tue Oct 13 00:00:00 2026\n# [ok]\n",
        encoding="utf-8",
    )
    assert rr.tblout_rows_digest(first) == rr.tblout_rows_digest(second)


def test_tblout_rows_digest_changes_with_the_rows(tmp_path):
    first = write_tblout(tmp_path / "a.tblout", row())
    second = write_tblout(tmp_path / "b.tblout", row(score="99.9"))
    empty = write_tblout(tmp_path / "c.tblout")
    assert rr.tblout_rows_digest(first) != rr.tblout_rows_digest(second)
    assert rr.tblout_rows_digest(empty) == rr.sha256_text("")


# --------------------------------------------------------------------------
# Integrity checks
# --------------------------------------------------------------------------

MODEL = rr.CovarianceModel(
    accession="RF01116",
    name="Yfr1",
    description="Cyanobacterial functional RNA 1",
    clen=4,
    window=6,
    gathering_cutoff=38.0,
    format_line="INFERNAL1/a [1.1.5 | Sep 2023]",
)
LENGTHS = {"NZ_TEST001.1": 20, "NZ_TEST002.1": 12}


def hits_from(tmp_path, *rows):
    return rr.parse_tblout(write_tblout(tmp_path / "t.tblout", *rows))


def test_validate_hits_passes_a_clean_pair_on_both_strands(tmp_path):
    hits = hits_from(
        tmp_path, row(), row(seq_from="19", seq_to="12", strand="-")
    )
    assert rr.validate_hits(hits, MODEL, LENGTHS) == []


def test_validate_hits_rejects_a_wrong_model_accession(tmp_path):
    hits = hits_from(tmp_path, row(query_accession="RF00050"))
    (problem,) = rr.validate_hits(hits, MODEL, LENGTHS)
    assert "'RF00050' is not the pinned model 'RF01116'" in problem


def test_validate_hits_rejects_a_wrong_model_name(tmp_path):
    hits = hits_from(tmp_path, row(query_name="PsrR1"))
    (problem,) = rr.validate_hits(hits, MODEL, LENGTHS)
    assert "query name 'PsrR1' is not the pinned model 'Yfr1'" in problem


def test_validate_hits_rejects_an_unknown_target_sequence(tmp_path):
    hits = hits_from(tmp_path, row(target="NZ_OTHER.1"))
    (problem,) = rr.validate_hits(hits, MODEL, LENGTHS)
    assert "not a sequence of the pinned assembly" in problem


def test_validate_hits_names_the_scope_it_checked(tmp_path):
    hits = hits_from(tmp_path, row(target="NZ_OTHER.1"))
    (problem,) = rr.validate_hits(
        hits, MODEL, {"j": 10}, scope="origin junction sequences"
    )
    assert "not a sequence of the origin junction sequences" in problem


@pytest.mark.parametrize(
    ("seq_from", "seq_to", "strand"),
    [("0", "4", "+"), ("18", "24", "+"), ("24", "18", "-")],
)
def test_validate_hits_rejects_an_out_of_bounds_interval(
    tmp_path, seq_from, seq_to, strand
):
    hits = hits_from(tmp_path, row(seq_from=seq_from, seq_to=seq_to, strand=strand))
    problems = rr.validate_hits(hits, MODEL, LENGTHS)
    assert any("falls outside NZ_TEST001.1 (1..20)" in p for p in problems)


@pytest.mark.parametrize(("mdl_from", "mdl_to"), [("0", "4"), ("1", "5"), ("3", "2")])
def test_validate_hits_rejects_an_inconsistent_model_interval(
    tmp_path, mdl_from, mdl_to
):
    hits = hits_from(tmp_path, row(mdl_from=mdl_from, mdl_to=mdl_to))
    problems = rr.validate_hits(hits, MODEL, LENGTHS)
    assert any("is not within 1..4" in p for p in problems)


def test_validate_hits_rejects_a_score_below_the_gathering_threshold(tmp_path):
    hits = hits_from(tmp_path, row(score="12.0"))
    (problem,) = rr.validate_hits(hits, MODEL, LENGTHS)
    assert "below the family GA threshold 38.0" in problem


def test_validate_hits_accepts_a_score_exactly_at_the_threshold(tmp_path):
    hits = hits_from(tmp_path, row(score="38.00"))
    assert rr.validate_hits(hits, MODEL, LENGTHS) == []


def test_validate_hits_rejects_duplicate_identical_hits(tmp_path):
    hits = hits_from(tmp_path, row(), row())
    (problem,) = rr.validate_hits(hits, MODEL, LENGTHS)
    assert "duplicates hit 1 at the same interval" in problem


def test_validate_hits_keeps_a_same_interval_hit_on_the_other_strand(tmp_path):
    hits = hits_from(tmp_path, row(), row(seq_from="14", seq_to="11", strand="-"))
    assert rr.validate_hits(hits, MODEL, LENGTHS) == []


def test_validate_hits_collects_every_problem_on_one_hit(tmp_path):
    hits = hits_from(
        tmp_path, row(query_accession="RF00050", query_name="x", score="1.0")
    )
    assert len(rr.validate_hits(hits, MODEL, LENGTHS)) == 3


def test_require_clean_passes_an_empty_list():
    assert rr.require_clean([]) is None


def test_require_clean_raises_with_every_problem():
    with pytest.raises(rr.RegulatoryRfamError, match="failed integrity checks") as info:
        rr.require_clean(["first problem", "second problem"])
    assert "first problem" in str(info.value)
    assert "second problem" in str(info.value)


# --------------------------------------------------------------------------
# Overlaps
# --------------------------------------------------------------------------


def _overlap_row(replicon, start, end):
    return {"replicon": replicon, "native_start": start, "native_end": end}


OVERLAP_LENGTHS = {"NZ_TEST001.1": 100, "a": 100, "b": 100}


def test_overlap_pairs_finds_an_overlap_across_strands():
    rows = [
        _overlap_row("NZ_TEST001.1", 10, 20),
        _overlap_row("NZ_TEST001.1", 18, 30),
    ]
    assert rr.overlap_pairs(rows, OVERLAP_LENGTHS) == [
        {
            "first": 0,
            "second": 1,
            "replicon": "NZ_TEST001.1",
            "intervals": [[18, 20]],
            "sharedBases": 3,
        }
    ]


def test_overlap_pairs_counts_a_single_shared_base():
    rows = [_overlap_row("a", 1, 10), _overlap_row("a", 10, 20)]
    (pair,) = rr.overlap_pairs(rows, OVERLAP_LENGTHS)
    assert (pair["intervals"], pair["sharedBases"]) == ([[10, 10]], 1)


def test_overlap_pairs_ignores_adjacent_and_other_replicons():
    rows = [
        _overlap_row("a", 1, 9),
        _overlap_row("a", 10, 20),
        _overlap_row("b", 5, 15),
    ]
    assert rr.overlap_pairs(rows, OVERLAP_LENGTHS) == []


def test_overlap_pairs_is_empty_for_fewer_than_two_rows():
    assert rr.overlap_pairs([], OVERLAP_LENGTHS) == []
    assert rr.overlap_pairs([_overlap_row("a", 1, 10)], OVERLAP_LENGTHS) == []


def test_overlap_pairs_finds_a_wrap_overlapping_a_linear_hit_after_the_origin():
    # 95..5 wraps the origin of a 100-base replicon; 1..62 shares 1..5.
    rows = [_overlap_row("a", 95, 5), _overlap_row("a", 1, 62)]
    (pair,) = rr.overlap_pairs(rows, OVERLAP_LENGTHS)
    assert (pair["intervals"], pair["sharedBases"]) == ([[1, 5]], 5)


def test_overlap_pairs_finds_a_wrap_overlapping_a_linear_hit_before_the_origin():
    rows = [_overlap_row("a", 90, 100), _overlap_row("a", 95, 5)]
    (pair,) = rr.overlap_pairs(rows, OVERLAP_LENGTHS)
    assert (pair["intervals"], pair["sharedBases"]) == ([[95, 100]], 6)


def test_overlap_pairs_finds_two_wraps_sharing_the_origin():
    # Both wrap; the shared run crosses the origin and is one wrapped interval.
    rows = [_overlap_row("a", 90, 10), _overlap_row("a", 95, 20)]
    (pair,) = rr.overlap_pairs(rows, OVERLAP_LENGTHS)
    assert (pair["intervals"], pair["sharedBases"]) == ([[95, 10]], 16)


def test_overlap_pairs_ignores_a_wrap_beside_a_linear_hit():
    rows = [_overlap_row("a", 95, 5), _overlap_row("a", 6, 94)]
    assert rr.overlap_pairs(rows, OVERLAP_LENGTHS) == []


def test_shared_intervals_keeps_two_separate_runs():
    # A long linear interval meets a wrap at both of its ends.
    assert rr.shared_intervals((90, 10), (5, 95), 100) == [[5, 10], [90, 95]]


# --------------------------------------------------------------------------
# Circular origin boundary
# --------------------------------------------------------------------------


def test_junction_sequence_joins_the_two_origin_flanks():
    sequence = "ABCDEFGHIJ"  # length 10, flank 5 for window 6
    assert rr.junction_flank(6) == 5
    assert rr.junction_sequence(sequence, 6) == "FGHIJABCDE"


def test_junction_sequence_is_empty_for_a_single_base_window():
    assert rr.junction_flank(1) == 0
    assert rr.junction_sequence("ACGT", 1) == ""


def test_junction_sequence_refuses_a_replicon_shorter_than_the_window():
    with pytest.raises(rr.RegulatoryRfamError, match="shorter than the 10-base"):
        rr.junction_sequence("ACGTACGTA", 6)


def test_map_junction_position_covers_both_sides_of_the_origin():
    # Replicon of 20 bases, window 6, flank 5: junction base 1 is native 16,
    # base 5 is native 20 (the last base), base 6 is native 1.
    assert [rr.map_junction_position(p, 20, 6) for p in (1, 5, 6, 10)] == [16, 20, 1, 5]


@pytest.mark.parametrize("position", [0, 11, -1])
def test_map_junction_position_rejects_a_position_off_the_junction(position):
    with pytest.raises(rr.RegulatoryRfamError, match="outside 1..10"):
        rr.map_junction_position(position, 20, 6)


def test_spans_origin_only_for_a_hit_crossing_the_junction(tmp_path):
    crossing, before, after = hits_from(
        tmp_path,
        row(seq_from="4", seq_to="7"),
        row(seq_from="1", seq_to="5"),
        row(seq_from="6", seq_to="10"),
    )
    assert rr.spans_origin(crossing, 6) is True
    assert rr.spans_origin(before, 6) is False
    assert rr.spans_origin(after, 6) is False


def test_junction_hit_rows_remaps_a_wrapping_hit_to_native_coordinates(tmp_path):
    replicons = [rr.Replicon("NZ_TEST001.1", "chromosome", 20, "circular")]
    junction_ids = {"NZ_TEST001.1": "NZ_TEST001.1_origin_junction"}
    hits = hits_from(
        tmp_path,
        row(target="NZ_TEST001.1_origin_junction", seq_from="4", seq_to="7"),
        row(
            target="NZ_TEST001.1_origin_junction",
            seq_from="7",
            seq_to="4",
            strand="-",
        ),
        row(target="NZ_TEST001.1_origin_junction", seq_from="1", seq_to="4"),
    )
    rows, already_linear = rr.junction_hit_rows(hits, MODEL, replicons, junction_ids)
    assert already_linear == 1
    assert [r["replicon"] for r in rows] == ["NZ_TEST001.1"] * 2
    # The wrap is reported as native_start > native_end, not as an error.
    assert (rows[0]["native_start"], rows[0]["native_end"]) == (19, 2)
    assert (rows[1]["native_start"], rows[1]["native_end"]) == (19, 2)
    # The search target and the endpoints cmsearch emitted on it stay as they
    # were; only the native interval is remapped.
    assert all(r["search_target"] == "NZ_TEST001.1_origin_junction" for r in rows)
    assert (rows[0]["raw_seq_from"], rows[0]["raw_seq_to"]) == (4, 7)
    assert (rows[1]["raw_seq_from"], rows[1]["raw_seq_to"]) == (7, 4)
    assert all("wrap across the origin" in r["coordinate_basis"] for r in rows)
    assert all(r["origin_spanning"] for r in rows)
    assert all(r["search_space"] == rr.SEARCH_SPACE_JUNCTION for r in rows)


def test_junction_hit_rows_rejects_an_unknown_junction_target(tmp_path):
    hits = hits_from(tmp_path, row(target="somewhere_else"))
    with pytest.raises(rr.RegulatoryRfamError, match="unknown target"):
        rr.junction_hit_rows(hits, MODEL, [], {})


# --------------------------------------------------------------------------
# Search space, argv, tool resolution
# --------------------------------------------------------------------------


def test_search_space_doubles_the_residue_count_for_both_strands():
    # Rfam's own procedure: residues x 2 strands, divided by a million.
    assert rr.search_space_mb(2_937_203) == 5.874406
    assert rr.search_space_mb(2_744_626) == 5.489252


def test_search_space_rejects_an_empty_database():
    with pytest.raises(rr.RegulatoryRfamError, match="cannot compute a search space"):
        rr.search_space_mb(0)


def test_cmsearch_argv_pins_the_rfam_flags_and_searches_both_strands(tmp_path):
    argv = rr.cmsearch_argv(
        Path("/bin/cmsearch"),
        tmp_path / "m.cm",
        "g.fna",
        "t.tblout",
        "t.out",
        5.489252,
    )
    assert argv[:6] == [
        "/bin/cmsearch",
        "-Z",
        "5.489252",
        "--cut_ga",
        "--rfam",
        "--nohmmonly",
    ]
    # Run files are relative to the work directory, inputs are as given.
    assert argv[6:] == [
        "--tblout",
        "t.tblout",
        "-o",
        "t.out",
        str(tmp_path / "m.cm"),
        "g.fna",
    ]
    # Neither strand is excluded: cmsearch searches both by default.
    assert "--toponly" not in argv and "--bottomonly" not in argv


def test_cmsearch_version_reads_the_banner(stub_cmsearch):
    script, _ = stub_cmsearch
    assert rr.cmsearch_version(script) == "1.1.5 (Sep 2023)"


def test_cmsearch_version_reports_a_missing_executable(tmp_path):
    with pytest.raises(rr.RegulatoryRfamError, match="missing cmsearch executable"):
        rr.cmsearch_version(tmp_path / "absent")


def test_cmsearch_version_rejects_a_binary_that_is_not_cmsearch(tmp_path):
    other = tmp_path / "notcmsearch"
    other.write_text("#!/bin/sh\necho hello\n", encoding="utf-8")
    other.chmod(0o755)
    with pytest.raises(rr.RegulatoryRfamError, match="did not report an Infernal"):
        rr.cmsearch_version(other)


def test_cmsearch_version_reports_an_unrunnable_file(tmp_path):
    target = tmp_path / "notexecutable"
    target.write_text("plain text\n", encoding="utf-8")
    with pytest.raises(rr.RegulatoryRfamError, match="cannot run"):
        rr.cmsearch_version(target)


def test_describe_tool_records_the_executable_hash(stub_cmsearch, tmp_path):
    script, _ = stub_cmsearch
    link = tmp_path / "linked-cmsearch"
    link.symlink_to(script)
    tool = rr.describe_tool(link, "1.1.5 (Sep 2023)")
    assert tool["version"] == "1.1.5 (Sep 2023)"
    assert tool["executable"] == str(link)
    # The hash is of the file that actually runs, behind any symlink.
    assert tool["resolvedExecutable"] == str(script.resolve())
    assert tool["sha256"] == hashlib.sha256(script.read_bytes()).hexdigest()


def test_describe_tool_refuses_another_infernal_version(stub_cmsearch, monkeypatch):
    script, _ = stub_cmsearch
    monkeypatch.setenv("STUB_VERSION", "1.1.4 (Dec 2020)")
    with pytest.raises(rr.RegulatoryRfamError, match="not the pinned 1.1.5"):
        rr.describe_tool(script, "1.1.5 (Sep 2023)")


def test_run_cmsearch_reports_a_nonzero_exit(stub_cmsearch, tmp_path, monkeypatch):
    script, _ = stub_cmsearch
    monkeypatch.setenv("STUB_FAIL", "1")
    with pytest.raises(rr.RegulatoryRfamError, match="cmsearch exited 3"):
        rr.run_cmsearch(
            [str(script), "--tblout", "t", "-o", "o", "m", "g"], tmp_path
        )


def test_run_cmsearch_reports_a_missing_binary(tmp_path):
    with pytest.raises(rr.RegulatoryRfamError, match="cannot run"):
        rr.run_cmsearch([str(tmp_path / "absent")], tmp_path)


# --------------------------------------------------------------------------
# cmsearch's own pipeline summary
# --------------------------------------------------------------------------

SUMMARY_TEXT = (
    "Query:       Yfr1  [CLEN=59]\n"
    "Query model(s):                                                  1  (59 "
    "consensus positions)\n"
    "Target sequences:                                                3  "
    "(5489252 residues searched)\n"
    "Target sequences re-searched for truncated hits:                 3  "
    "(3096 residues re-searched)\n"
    "Total CM hits reported:                                          1  (0.00001); "
    "includes 0 truncated hit(s)\n"
)


def test_parse_search_summary_reads_sequences_residues_and_hits(tmp_path):
    path = tmp_path / "native.cmsearch"
    path.write_text(SUMMARY_TEXT, encoding="utf-8")
    # The re-search line for truncated hits must not be read as the main count.
    assert rr.parse_search_summary(path) == {
        "queryModels": 1,
        "targetSequences": 3,
        "residuesSearched": 5489252,
        "hitsReported": 1,
    }


def test_parse_search_summary_refuses_a_missing_summary(tmp_path):
    path = tmp_path / "native.cmsearch"
    path.write_text("Query model(s):   1  (59 consensus positions)\n", encoding="utf-8")
    with pytest.raises(rr.RegulatoryRfamError, match="hitsReported, targetSequences"):
        rr.parse_search_summary(path)


def test_parse_search_summary_refuses_a_multi_model_summary(tmp_path):
    path = tmp_path / "native.cmsearch"
    path.write_text(SUMMARY_TEXT + SUMMARY_TEXT, encoding="utf-8")
    with pytest.raises(rr.RegulatoryRfamError, match="more than one"):
        rr.parse_search_summary(path)


def test_parse_search_summary_reports_a_missing_file(tmp_path):
    with pytest.raises(rr.RegulatoryRfamError, match="missing cmsearch main output"):
        rr.parse_search_summary(tmp_path / "absent")


def test_check_search_summary_accepts_a_full_both_strand_search():
    summary = {
        "queryModels": 1,
        "targetSequences": 3,
        "residuesSearched": 5489252,
        "hitsReported": 1,
    }
    rr.check_search_summary(summary, sequences=3, residues=2744626, hits=1)


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("targetSequences", 1, "targetSequences 1 != expected 3"),
        ("residuesSearched", 2744626, "residuesSearched 2744626 != expected 5489252"),
        ("hitsReported", 0, "hitsReported 0 != expected 1"),
        ("queryModels", 2, "queryModels 2 != expected 1"),
    ],
)
def test_check_search_summary_refuses_partial_coverage(field, value, message):
    summary = {
        "queryModels": 1,
        "targetSequences": 3,
        "residuesSearched": 5489252,
        "hitsReported": 1,
    }
    summary[field] = value
    with pytest.raises(rr.RegulatoryRfamError, match=message):
        rr.check_search_summary(summary, sequences=3, residues=2744626, hits=1)


# --------------------------------------------------------------------------
# Shuffled control
# --------------------------------------------------------------------------


def test_shuffled_sequence_is_deterministic_and_composition_preserving():
    sequence = "ACGT" * 50
    key = rr.control_seed_key(20261012, 0, "NZ_TEST001.1")
    assert key == "20261012:0:NZ_TEST001.1"
    first = rr.shuffled_sequence(sequence, key)
    assert first == rr.shuffled_sequence(sequence, key)
    assert sorted(first) == sorted(sequence)
    assert len(first) == len(sequence)
    assert first != sequence


def test_shuffled_sequence_differs_by_replicate_and_replicon():
    sequence = "ACGT" * 50
    per_replicate = {
        rr.shuffled_sequence(sequence, rr.control_seed_key(7, replicate, "a"))
        for replicate in range(3)
    }
    assert len(per_replicate) == 3
    assert rr.shuffled_sequence(
        sequence, rr.control_seed_key(7, 0, "a")
    ) != rr.shuffled_sequence(sequence, rr.control_seed_key(7, 0, "b"))


# --------------------------------------------------------------------------
# FASTA serialisation
# --------------------------------------------------------------------------


def test_fasta_text_wraps_at_eighty_columns_and_keeps_the_header():
    lines = rr.fasta_text([("x.1 a description", "A" * 85)]).splitlines()
    assert lines[0] == ">x.1 a description"
    assert [len(line) for line in lines[1:]] == [80, 5]


def test_fasta_text_rejects_a_nonpositive_width():
    with pytest.raises(rr.RegulatoryRfamError, match="width must be positive"):
        rr.fasta_text([("x", "ACGT")], width=0)


def test_native_records_keep_published_headers():
    records = [("a.1", "chromosome", "ACGT"), ("b.1", "", "TT")]
    assert rr.native_records(records) == [("a.1 chromosome", "ACGT"), ("b.1", "TT")]


# --------------------------------------------------------------------------
# Path preflight, fresh work directory, exclusive reports
# --------------------------------------------------------------------------


def _preflight(tmp_path, **outputs):
    model = tmp_path / "m.cm"
    model.write_text("model\n", encoding="utf-8")
    defaults = {
        "work directory": tmp_path / "work",
        "JSON report": tmp_path / "out" / "r.json",
        "TSV report": tmp_path / "out" / "r.tsv",
    }
    defaults.update({key.replace("_", " "): value for key, value in outputs.items()})
    rr.preflight_paths(inputs={"covariance model": model}, outputs=defaults)
    return model


def test_preflight_accepts_fresh_distinct_paths_and_writes_nothing(tmp_path):
    _preflight(tmp_path)
    assert sorted(path.name for path in tmp_path.iterdir()) == ["m.cm"]


def test_preflight_refuses_an_existing_report(tmp_path):
    existing = tmp_path / "r.json"
    existing.write_text("previous\n", encoding="utf-8")
    with pytest.raises(rr.RegulatoryRfamError, match="never replaces or reuses"):
        _preflight(tmp_path, JSON_report=existing)
    assert existing.read_text() == "previous\n"


def test_preflight_refuses_a_dangling_symlink_as_a_report(tmp_path):
    dangling = tmp_path / "r.json"
    dangling.symlink_to(tmp_path / "nowhere" / "target.json")
    with pytest.raises(rr.RegulatoryRfamError, match="already exists"):
        _preflight(tmp_path, JSON_report=dangling)


def test_preflight_refuses_an_existing_work_directory(tmp_path):
    (tmp_path / "work").mkdir()
    (tmp_path / "work" / "native.tblout").write_text("raw evidence\n")
    with pytest.raises(rr.RegulatoryRfamError, match="work directory .* already exists"):
        _preflight(tmp_path)
    assert (tmp_path / "work" / "native.tblout").read_text() == "raw evidence\n"


def test_preflight_refuses_the_same_path_for_both_reports(tmp_path):
    same = tmp_path / "out" / "r.out"
    with pytest.raises(rr.RegulatoryRfamError, match="resolve to the same path"):
        _preflight(tmp_path, JSON_report=same, TSV_report=same)


def test_preflight_refuses_reports_aliased_through_a_symlinked_directory(tmp_path):
    (tmp_path / "out").mkdir()
    (tmp_path / "alias").symlink_to(tmp_path / "out")
    with pytest.raises(rr.RegulatoryRfamError, match="resolve to the same path"):
        _preflight(
            tmp_path,
            JSON_report=tmp_path / "out" / "r.txt",
            TSV_report=tmp_path / "alias" / "r.txt",
        )


def test_preflight_refuses_reports_that_differ_only_in_case(tmp_path):
    # The default macOS filesystem would make these one file.
    with pytest.raises(rr.RegulatoryRfamError, match="resolve to the same path"):
        _preflight(
            tmp_path,
            JSON_report=tmp_path / "out" / "R.txt",
            TSV_report=tmp_path / "out" / "r.txt",
        )


def test_preflight_refuses_an_input_named_as_an_output(tmp_path):
    model = tmp_path / "m.cm"
    model.write_text("model\n", encoding="utf-8")
    with pytest.raises(rr.RegulatoryRfamError, match="already exists"):
        rr.preflight_paths(
            inputs={"covariance model": model},
            outputs={"JSON report": model},
        )
    assert model.read_text() == "model\n"


def test_preflight_refuses_a_report_inside_the_work_directory(tmp_path):
    with pytest.raises(rr.RegulatoryRfamError, match="nested in one another"):
        _preflight(tmp_path, JSON_report=tmp_path / "work" / "r.json")


def test_preflight_refuses_a_work_directory_inside_a_report_path(tmp_path):
    with pytest.raises(rr.RegulatoryRfamError, match="nested in one another"):
        _preflight(
            tmp_path,
            JSON_report=tmp_path / "out",
            work_directory=tmp_path / "out" / "work",
        )


def test_preflight_refuses_a_file_where_an_ancestor_belongs(tmp_path):
    blocker = tmp_path / "blocker"
    blocker.write_text("a file\n", encoding="utf-8")
    with pytest.raises(rr.RegulatoryRfamError, match="is not a directory"):
        _preflight(tmp_path, TSV_report=blocker / "r.tsv")


def test_reserve_workdir_creates_a_fresh_nested_directory(tmp_path):
    target = tmp_path / "a" / "b" / "work"
    assert rr.reserve_workdir(target) == target
    assert target.is_dir()


def test_reserve_workdir_refuses_to_reuse_a_directory(tmp_path):
    target = tmp_path / "work"
    target.mkdir()
    with pytest.raises(rr.RegulatoryRfamError, match="needs a fresh one"):
        rr.reserve_workdir(target)


def test_reserve_workdir_refuses_a_file_where_an_ancestor_belongs(tmp_path):
    blocker = tmp_path / "a"
    blocker.write_text("not a directory\n", encoding="utf-8")
    with pytest.raises(rr.RegulatoryRfamError, match="is not a directory"):
        rr.reserve_workdir(blocker / "work")


REPORT = {
    "schemaVersion": rr.SCHEMA_VERSION,
    "hits": [
        dict.fromkeys(rr._HIT_FIELDNAMES, 1)
        | {"replicon": "NZ_TEST001.1", "strand": "+"}
    ],
}


def test_write_report_emits_lf_only_tsv_and_sorted_json(tmp_path):
    json_path, tsv_path = tmp_path / "out" / "r.json", tmp_path / "out" / "r.tsv"
    rr.write_report(REPORT, json_path, tsv_path)
    raw = tsv_path.read_bytes()
    assert b"\r" not in raw
    assert raw.decode().splitlines()[0].split("\t") == list(rr._HIT_FIELDNAMES)
    assert json.loads(json_path.read_text())["schemaVersion"] == rr.SCHEMA_VERSION


def test_write_report_never_replaces_a_file_that_appeared_after_preflight(tmp_path):
    json_path, tsv_path = tmp_path / "r.json", tmp_path / "r.tsv"
    json_path.write_text("someone else's file\n", encoding="utf-8")
    with pytest.raises(rr.RegulatoryRfamError, match="removed only the 1 file"):
        rr.write_report(REPORT, json_path, tsv_path)
    # The pre-existing file is untouched; the TSV this call created is gone.
    assert json_path.read_text() == "someone else's file\n"
    assert not tsv_path.exists()


def test_write_report_refuses_one_file_under_two_names(tmp_path):
    same = tmp_path / "r.out"
    with pytest.raises(rr.RegulatoryRfamError, match="removed only the 1 file"):
        rr.write_report(REPORT, same, same)
    # The TSV half was created by this call, so it is the one removed.
    assert not same.exists()


def test_write_report_leaves_a_preexisting_tsv_alone(tmp_path):
    json_path, tsv_path = tmp_path / "r.json", tmp_path / "r.tsv"
    tsv_path.write_text("keep me\n", encoding="utf-8")
    with pytest.raises(rr.RegulatoryRfamError, match="removed only the 0 file"):
        rr.write_report(REPORT, json_path, tsv_path)
    assert tsv_path.read_text() == "keep me\n"
    assert not json_path.exists()


def test_write_report_refuses_a_blocked_report_directory(tmp_path):
    blocker = tmp_path / "blocker"
    blocker.write_text("a file\n", encoding="utf-8")
    with pytest.raises(rr.RegulatoryRfamError, match="is not a directory"):
        rr.write_report(REPORT, tmp_path / "r.json", blocker / "r.tsv")
    assert blocker.read_text() == "a file\n"


# --------------------------------------------------------------------------
# Search stages
# --------------------------------------------------------------------------

MODEL_CONTEXT = rr.CovarianceModel(
    accession="RF01116",
    name="Yfr1",
    description="Cyanobacterial functional RNA 1",
    clen=4,
    window=6,
    gathering_cutoff=38.0,
    format_line="INFERNAL1/a [1.1.5 | Sep 2023]",
)


def _context(script, tmp_path):
    return rr.SearchContext(
        cmsearch=script,
        cm_path=write_model(tmp_path / "m.cm"),
        workdir=rr.reserve_workdir(tmp_path / "work"),
        model=MODEL_CONTEXT,
        search_space=5.489252,
    )


def test_search_run_provenance_records_arguments_digests_and_summary(
    stub_cmsearch, tmp_path
):
    script, rows_dir = stub_cmsearch
    (rows_dir / "probe.rows").write_text(row() + "\n")
    context = _context(script, tmp_path)
    run = context.search("probe", [("NZ_TEST001.1 d", "ACGTACGT")])
    assert len(run.hits) == 1
    assert run.fasta.name == "probe.fna"
    assert run.tblout.name == "probe.tblout"
    provenance = run.provenance()
    assert provenance["hitCount"] == 1
    assert provenance["fasta"]["path"] == "probe.fna"
    assert provenance["fasta"]["sha256"] == rr.sha256_file(run.fasta)
    assert provenance["argv"] == run.argv
    # Run files are named relative to the work directory, never by its path.
    assert str(context.workdir) not in " ".join(run.argv)
    assert provenance["tbloutRowsSha256"] == rr.tblout_rows_digest(run.tblout)
    assert provenance["cmsearchSummary"] == {
        "queryModels": 1,
        "targetSequences": 1,
        "residuesSearched": 16,
        "hitsReported": 1,
    }
    # The stdout capture is written alongside, so the raw run is inspectable.
    assert (context.workdir / "probe.cmsearch").exists()


def test_search_refuses_a_run_that_covered_fewer_sequences(
    stub_cmsearch, tmp_path, monkeypatch
):
    script, _ = stub_cmsearch
    monkeypatch.setenv("STUB_DROP_SEQUENCES", "1")
    context = _context(script, tmp_path)
    with pytest.raises(rr.RegulatoryRfamError, match="did not search what it was"):
        context.search("probe", [("a.1", "ACGT"), ("b.1", "ACGT")])


def test_search_never_overwrites_a_run_file(stub_cmsearch, tmp_path):
    script, _ = stub_cmsearch
    context = _context(script, tmp_path)
    (context.workdir / "probe.fna").write_text(">earlier\nACGT\n")
    with pytest.raises(FileExistsError):
        context.search("probe", [("a.1", "ACGT")])
    assert (context.workdir / "probe.fna").read_text() == ">earlier\nACGT\n"


def test_plan_origin_junctions_splits_circular_from_skipped():
    replicons = [
        rr.Replicon("circ.1", "chromosome", 20, "circular"),
        rr.Replicon("lin.1", "plasmid", 20, "linear"),
        rr.Replicon("tiny.1", "plasmid", 8, "circular"),
    ]
    sequences = {
        "circ.1": "ACGTACGTACGTACGTACGT",
        "lin.1": "TTTTTTTTTTTTTTTTTTTT",
        "tiny.1": "ACGTACGT",
    }
    junction_ids, records, skipped = rr.plan_origin_junctions(replicons, sequences, 6)
    assert junction_ids == {"circ.1": "circ.1_origin_junction"}
    # Last five bases then first five, in that order.
    assert records == [("circ.1_origin_junction", "TACGT" + "ACGTA")]
    assert skipped == [
        {"replicon": "lin.1", "reason": "linear"},
        {
            "replicon": "tiny.1",
            "reason": "length 8 is under the 10-base junction window",
        },
    ]


def test_plan_origin_junctions_skips_everything_for_a_one_base_window():
    replicons = [rr.Replicon("circ.1", "chromosome", 20, "circular")]
    _, records, skipped = rr.plan_origin_junctions(
        replicons, {"circ.1": "A" * 20}, 1
    )
    assert records == []
    assert skipped == [
        {"replicon": "circ.1", "reason": "model window W=1 leaves no origin junction"}
    ]


# --------------------------------------------------------------------------
# Identity enforcement (R1): inputs, model header, replicons, tool
# --------------------------------------------------------------------------

# Twenty-base circular replicon and a twelve-base linear one. Window 6 gives a
# flank of 5, so the junction sequence is ten bases.
GENOME = {"NZ_TEST001.1": "ACGTACGTACGTACGTACGT", "NZ_TEST002.1": "TTTTCCCCGGGG"}
TOPOLOGIES = {"NZ_TEST001.1": (20, "circular"), "NZ_TEST002.1": (12, "linear")}


@pytest.fixture
def pilot_inputs(tmp_path):
    cm_path = write_model(tmp_path / "RF01116.cm")
    fasta_path = write_genome(tmp_path / "g.fna", GENOME)
    gbff_path = write_gbff(tmp_path / "g.gbff", TOPOLOGIES)
    return {
        "pins": pins_for(cm_path, fasta_path, gbff_path),
        "cm_path": cm_path,
        "fasta_path": fasta_path,
        "gbff_path": gbff_path,
        "workdir": tmp_path / "work",
        "control_replicates": 2,
        "control_seed": 20261012,
    }


def run_stub_pilot(stub_cmsearch, pilot_inputs, **overrides):
    script, _ = stub_cmsearch
    return rr._run_pilot(cmsearch=script, **dict(pilot_inputs, **overrides))


def test_verify_pinned_inputs_returns_the_recorded_digests(pilot_inputs):
    inputs = rr.verify_pinned_inputs(
        pilot_inputs["pins"],
        pilot_inputs["cm_path"],
        pilot_inputs["fasta_path"],
        pilot_inputs["gbff_path"],
    )
    assert inputs["covarianceModel"]["sha256"] == pilot_inputs["pins"].model_sha256
    assert inputs["genomeFasta"]["md5"] == pilot_inputs["pins"].fasta_md5
    assert inputs["genomeFlatFile"]["path"] == "g.gbff"


def test_run_pilot_refuses_changed_model_coefficients(
    stub_cmsearch, pilot_inputs, tmp_path
):
    # Same accession, name, CLEN, W and GA; one body coefficient differs.
    altered = write_model(tmp_path / "altered.cm", coefficient="1.5")
    with pytest.raises(rr.RegulatoryRfamError, match="covarianceModel sha256"):
        run_stub_pilot(stub_cmsearch, pilot_inputs, cm_path=altered)
    assert not pilot_inputs["workdir"].exists()


def test_run_pilot_refuses_a_changed_same_name_sequence(
    stub_cmsearch, pilot_inputs, tmp_path
):
    mutated = dict(GENOME, **{"NZ_TEST001.1": "ACGTACGTACGTACGTACGA"})
    fasta = write_genome(tmp_path / "mutated.fna", mutated)
    with pytest.raises(rr.RegulatoryRfamError, match="genomeFasta sha256") as info:
        run_stub_pilot(stub_cmsearch, pilot_inputs, fasta_path=fasta)
    assert "genomeFasta md5" in str(info.value)
    assert not pilot_inputs["workdir"].exists()


def test_run_pilot_refuses_another_assembly(stub_cmsearch, pilot_inputs, tmp_path):
    other = {"NZ_OTHER9.1": "GGGGCCCCAAAATTTTGGGG"}
    with pytest.raises(rr.RegulatoryRfamError, match="genomeFasta sha256") as info:
        run_stub_pilot(
            stub_cmsearch,
            pilot_inputs,
            fasta_path=write_genome(tmp_path / "other.fna", other),
            gbff_path=write_gbff(
                tmp_path / "other.gbff", {"NZ_OTHER9.1": (20, "circular")}
            ),
        )
    assert "genomeFlatFile sha256" in str(info.value)


def test_run_pilot_refuses_a_model_header_that_disagrees_with_the_pins(
    stub_cmsearch, pilot_inputs
):
    pins = pilot_inputs["pins"]
    for field, value in (
        ("model_accession", "RF00050"),
        ("model_name", "PsrR1"),
        ("gathering_cutoff", 40.0),
        ("model_clen", 5),
        ("model_window", 7),
    ):
        wrong = rr.PinnedIdentity(**{**pins.__dict__, field: value})
        with pytest.raises(rr.RegulatoryRfamError, match="not the pinned"):
            run_stub_pilot(stub_cmsearch, pilot_inputs, pins=wrong)


@pytest.mark.parametrize(
    "replicons",
    [
        (("NZ_TEST001.1", 20, "circular"),),
        (("NZ_TEST001.1", 21, "circular"), ("NZ_TEST002.1", 12, "linear")),
        (("NZ_TEST001.1", 20, "circular"), ("NZ_TEST002.1", 12, "circular")),
        (("NZ_TEST002.1", 12, "linear"), ("NZ_TEST001.1", 20, "circular")),
    ],
)
def test_run_pilot_refuses_a_replicon_set_other_than_the_pinned_one(
    stub_cmsearch, pilot_inputs, replicons
):
    wrong = rr.PinnedIdentity(**{**pilot_inputs["pins"].__dict__, "replicons": replicons})
    with pytest.raises(rr.RegulatoryRfamError, match="not the pinned set"):
        run_stub_pilot(stub_cmsearch, pilot_inputs, pins=wrong)
    assert not pilot_inputs["workdir"].exists()


def test_run_pilot_refuses_another_infernal_version(
    stub_cmsearch, pilot_inputs, monkeypatch
):
    monkeypatch.setenv("STUB_VERSION", "1.1.4 (Dec 2020)")
    with pytest.raises(rr.RegulatoryRfamError, match="not the pinned 1.1.5"):
        run_stub_pilot(stub_cmsearch, pilot_inputs)
    assert not pilot_inputs["workdir"].exists()


def test_run_pilot_refuses_a_searched_fasta_that_is_not_the_official_bytes(
    stub_cmsearch, pilot_inputs
):
    wrong = rr.PinnedIdentity(
        **{**pilot_inputs["pins"].__dict__, "searched_fasta_sha256": "0" * 64}
    )
    with pytest.raises(rr.RegulatoryRfamError, match="decompressed FASTA"):
        run_stub_pilot(stub_cmsearch, pilot_inputs, pins=wrong)
    assert not pilot_inputs["workdir"].exists()


def test_production_run_pilot_refuses_synthetic_inputs(stub_cmsearch, pilot_inputs):
    script, _ = stub_cmsearch
    inputs = {key: value for key, value in pilot_inputs.items() if key != "pins"}
    with pytest.raises(rr.RegulatoryRfamError, match="not the pinned RF01116") as info:
        rr.run_pilot(cmsearch=script, **inputs)
    message = str(info.value)
    for problem in ("covarianceModel sha256", "genomeFasta sha256", "genomeFlatFile md5"):
        assert problem in message
    assert not pilot_inputs["workdir"].exists()


# --------------------------------------------------------------------------
# _run_pilot, end to end against the stub
# --------------------------------------------------------------------------


def test_run_pilot_reports_zero_hits_without_inventing_a_negative(
    stub_cmsearch, pilot_inputs
):
    report = run_stub_pilot(stub_cmsearch, pilot_inputs)
    assert report["counts"] == {
        "nativeLinearHits": 0,
        "originSpanningHits": 0,
        "totalHits": 0,
        "overlappingNativePairs": 0,
        "controlReplicates": 2,
        "controlHitsTotal": 0,
    }
    assert report["hits"] == []
    assert "Other Rfam families were not evaluated" in report["coverageBoundary"]
    assert "no absence of regulation is inferred" in report["coverageBoundary"]
    assert "uncovered" not in report["coverageBoundary"]
    assert report["recordOrigin"] == "computed"
    assert "not measured regulation" in report["evidenceBoundary"]
    # The report names only the assembly its pins describe.
    assert "synthetic test assembly" in report["evidenceBoundary"]
    assert "GCF_000817325" not in json.dumps(report)


def test_run_pilot_declares_whole_assembly_coverage_from_cmsearch_itself(
    stub_cmsearch, pilot_inputs
):
    report = run_stub_pilot(stub_cmsearch, pilot_inputs)
    coverage = report["searchCoverage"]
    assert coverage["repliconCount"] == 2
    assert coverage["residues"] == 32
    assert coverage["replicons"] == [
        {
            "accession": "NZ_TEST001.1",
            "length": 20,
            "topology": "circular",
            "linearInterval": [1, 20],
            "strands": "both",
            "originJunction": "searched",
        },
        {
            "accession": "NZ_TEST002.1",
            "length": 12,
            "topology": "linear",
            "linearInterval": [1, 12],
            "strands": "both",
            "originJunction": "not searched: linear",
        },
    ]
    assert report["nativeSearch"]["cmsearchSummary"]["targetSequences"] == 2
    assert report["nativeSearch"]["cmsearchSummary"]["residuesSearched"] == 64
    assert "Searched is not discovered" in coverage["statement"]


def test_run_pilot_refuses_a_first_record_only_search(
    stub_cmsearch, pilot_inputs, monkeypatch
):
    # cmsearch claiming one sequence fewer than the two submitted is the
    # first-record-only failure, and the whole run is refused.
    monkeypatch.setenv("STUB_DROP_SEQUENCES", "1")
    with pytest.raises(rr.RegulatoryRfamError, match="targetSequences 1 != expected 2"):
        run_stub_pilot(stub_cmsearch, pilot_inputs)


def test_run_pilot_records_both_strands_and_the_pinned_provenance(
    stub_cmsearch, pilot_inputs
):
    script, rows_dir = stub_cmsearch
    (rows_dir / "native.rows").write_text(
        row() + "\n" + row(seq_from="19", seq_to="12", strand="-") + "\n"
    )
    report = run_stub_pilot(stub_cmsearch, pilot_inputs)
    assert report["counts"]["nativeLinearHits"] == 2
    assert {hit["strand"] for hit in report["hits"]} == {"+", "-"}
    assert report["strandsSearched"] == "both"
    assert report["cmsearchFlags"] == ["--cut_ga", "--rfam", "--nohmmonly"]
    assert report["searchSpaceMb"] == rr.search_space_mb(32)
    assert report["model"]["gatheringCutoff"] == 38.0
    assert report["tool"]["version"] == "1.1.5 (Sep 2023)"
    assert report["tool"]["sha256"] == rr.sha256_file(script)
    assert report["pinnedIdentity"]["verified"] is True
    assert report["pinnedIdentity"]["model_sha256"] == pilot_inputs["pins"].model_sha256
    assert set(report["inputs"]) == {
        "covarianceModel",
        "genomeFasta",
        "genomeFlatFile",
        "searchedFasta",
    }
    assert report["inputs"]["searchedFasta"]["residues"] == 32
    assert (
        report["inputs"]["searchedFasta"]["sha256"]
        == pilot_inputs["pins"].searched_fasta_sha256
    )
    assert all("sha256" in entry for entry in report["inputs"].values())
    # The raw tabular output's own digest is recorded for every search.
    assert len(report["nativeSearch"]["tbloutRowsSha256"]) == 64
    assert len(report["originJunctionSearch"]["tbloutRowsSha256"]) == 64
    assert all(
        len(replicate["tbloutRowsSha256"]) == 64
        for replicate in report["control"]["replicates"]
    )


def test_run_pilot_keeps_every_hit_and_its_raw_metadata(stub_cmsearch, pilot_inputs):
    _, rows_dir = stub_cmsearch
    # A low-scoring hit cmsearch chose to report, and a truncated one. Neither
    # is dropped: no threshold beyond the family GA cutoff is applied here.
    (rows_dir / "native.rows").write_text(
        row(score="38.0", evalue="0.9")
        + "\n"
        + row(seq_from="1", seq_to="4", trunc="5'")
        + "\n"
    )
    report = run_stub_pilot(stub_cmsearch, pilot_inputs)
    assert report["counts"]["nativeLinearHits"] == 2
    kept = {(hit["score"], hit["evalue"], hit["trunc"]) for hit in report["hits"]}
    assert kept == {(38.0, 0.9, "no"), (62.1, 6.7e-12, "5'")}
    assert all(hit["mdl_from"] == 1 and hit["mdl_to"] == 4 for hit in report["hits"])
    assert all(
        hit["coordinate_basis"]
        == "native pinned assembly, one-based inclusive, stranded"
        for hit in report["hits"]
    )


def test_run_pilot_reports_overlapping_native_hits(stub_cmsearch, pilot_inputs):
    _, rows_dir = stub_cmsearch
    (rows_dir / "native.rows").write_text(
        row(seq_from="11", seq_to="14") + "\n"
        + row(seq_from="14", seq_to="12", strand="-") + "\n"
    )
    report = run_stub_pilot(stub_cmsearch, pilot_inputs)
    assert report["counts"]["overlappingNativePairs"] == 1
    assert report["overlaps"][0]["intervals"] == [[12, 14]]
    assert report["overlaps"][0]["sharedBases"] == 3


def test_run_pilot_searches_only_circular_origins_and_remaps_the_wrap(
    stub_cmsearch, pilot_inputs
):
    _, rows_dir = stub_cmsearch
    (rows_dir / "origin_junction.rows").write_text(
        row(target="NZ_TEST001.1_origin_junction", seq_from="4", seq_to="7") + "\n"
        + row(target="NZ_TEST001.1_origin_junction", seq_from="1", seq_to="4") + "\n"
    )
    report = run_stub_pilot(stub_cmsearch, pilot_inputs)
    junction = report["originJunctionSearch"]
    assert junction["flankBases"] == 5
    assert junction["windowBases"] == 10
    assert junction["searchedReplicons"] == ["NZ_TEST001.1"]
    # The linear plasmid has no origin junction and says why.
    assert junction["skippedReplicons"] == [
        {"replicon": "NZ_TEST002.1", "reason": "linear"}
    ]
    assert junction["hitCount"] == 2
    assert junction["alreadyFoundByLinearSearch"] == 1
    assert report["counts"]["originSpanningHits"] == 1
    (wrapped,) = [hit for hit in report["hits"] if hit["origin_spanning"]]
    assert (wrapped["native_start"], wrapped["native_end"]) == (19, 2)
    assert wrapped["replicon"] == "NZ_TEST001.1"
    assert "W=6" in junction["coverageNote"]


def test_junction_coverage_note_claims_search_not_discovery(
    stub_cmsearch, pilot_inputs
):
    note = run_stub_pilot(stub_cmsearch, pilot_inputs)["originJunctionSearch"][
        "coverageNote"
    ]
    assert "was presented to the model" in note
    assert "Searched is not discovered" in note
    assert "does not show that no family element crosses an origin" in note
    assert " is found" not in note


def test_run_pilot_skips_a_replicon_shorter_than_the_junction_window(
    stub_cmsearch, pilot_inputs, tmp_path
):
    fasta = write_genome(tmp_path / "tiny.fna", {"NZ_TINY.1": "ACGTACGT"})
    gbff = write_gbff(tmp_path / "tiny.gbff", {"NZ_TINY.1": (8, "circular")})
    report = run_stub_pilot(
        stub_cmsearch,
        pilot_inputs,
        fasta_path=fasta,
        gbff_path=gbff,
        pins=pins_for(pilot_inputs["cm_path"], fasta, gbff),
    )
    junction = report["originJunctionSearch"]
    assert junction["searchedReplicons"] == []
    assert junction["skippedReplicons"] == [
        {"replicon": "NZ_TINY.1", "reason": "length 8 is under the 10-base "
         "junction window"}
    ]
    assert junction["argv"] == []
    assert junction["hitCount"] == 0
    assert report["searchCoverage"]["replicons"][0]["originJunction"] == (
        "not searched: length 8 is under the 10-base junction window"
    )


def test_run_pilot_runs_a_deterministic_shuffled_control(stub_cmsearch, pilot_inputs):
    _, rows_dir = stub_cmsearch
    (rows_dir / "control_00.rows").write_text(
        row(target="NZ_TEST001.1_shuffled_00") + "\n"
    )
    report = run_stub_pilot(stub_cmsearch, pilot_inputs)
    control = report["control"]
    assert control["seed"] == 20261012
    assert [replicate["replicate"] for replicate in control["replicates"]] == [0, 1]
    assert control["replicates"][0]["seedKeys"] == [
        "20261012:0:NZ_TEST001.1",
        "20261012:0:NZ_TEST002.1",
    ]
    assert control["replicates"][0]["sequences"] == {
        "NZ_TEST001.1_shuffled_00": "NZ_TEST001.1",
        "NZ_TEST002.1_shuffled_00": "NZ_TEST002.1",
    }
    assert control["replicates"][0]["hitCount"] == 1
    assert control["replicates"][0]["bestScore"] == 62.1
    assert control["replicates"][1]["hitCount"] == 0
    assert control["replicates"][1]["bestScore"] is None
    assert control["hitsTotal"] == 1
    assert "not a biological false-positive rate" in control["boundary"]
    assert "not a false-discovery rate" in control["boundary"]
    assert "no origin-junction search" in control["coverage"]
    assert report["searchCoverage"]["shuffledControl"] == control["coverage"]
    # Each replicate's shuffled FASTA differs but its digest is reproducible.
    digests = {
        replicate["fasta"]["sha256"] for replicate in control["replicates"]
    }
    assert len(digests) == 2


def test_control_positions_cannot_be_read_as_native_site_calls(
    stub_cmsearch, pilot_inputs
):
    _, rows_dir = stub_cmsearch
    (rows_dir / "control_01.rows").write_text(
        row(target="NZ_TEST002.1_shuffled_01", seq_from="9", seq_to="3", strand="-")
        + "\n"
    )
    report = run_stub_pilot(stub_cmsearch, pilot_inputs)
    (hit,) = report["control"]["replicates"][1]["hits"]
    # No native fields at all, so nothing downstream can mistake it for a locus.
    assert not {"replicon", "native_start", "native_end", "origin_spanning"} & set(hit)
    assert hit["search_space"] == "shuffled_control"
    assert hit["search_target"] == "NZ_TEST002.1_shuffled_01"
    assert (hit["source_replicon"], hit["replicate"]) == ("NZ_TEST002.1", 1)
    assert (hit["shuffled_start"], hit["shuffled_end"]) == (3, 9)
    assert (hit["raw_seq_from"], hit["raw_seq_to"]) == (9, 3)
    assert "not native assembly positions" in hit["coordinate_basis"]
    assert "shuffled control replicate 1" in hit["coordinate_basis"]
    # Control hits never reach the native hit table or the TSV.
    assert report["hits"] == []


def test_run_pilot_refuses_a_control_hit_named_with_a_native_accession(
    stub_cmsearch, pilot_inputs
):
    _, rows_dir = stub_cmsearch
    (rows_dir / "control_00.rows").write_text(row(target="NZ_TEST001.1") + "\n")
    with pytest.raises(
        rr.RegulatoryRfamError, match="not a sequence of the shuffled control"
    ):
        run_stub_pilot(stub_cmsearch, pilot_inputs)


def test_run_pilot_counts_a_wrap_overlapping_a_truncated_linear_hit(
    stub_cmsearch, pilot_inputs
):
    _, rows_dir = stub_cmsearch
    # Native 1..2 truncated at its 5' end, and the junction hit 4..7, which
    # remaps to the wrap 19..2: they share bases 1..2.
    (rows_dir / "native.rows").write_text(
        row(seq_from="1", seq_to="2", trunc="5'", mdl_from="3", score="40.0") + "\n"
    )
    (rows_dir / "origin_junction.rows").write_text(
        row(target="NZ_TEST001.1_origin_junction", seq_from="4", seq_to="7") + "\n"
    )
    report = run_stub_pilot(stub_cmsearch, pilot_inputs)
    assert report["counts"]["totalHits"] == 2
    assert report["counts"]["overlappingNativePairs"] == 1
    assert report["overlaps"] == [
        {
            "first": 0,
            "second": 1,
            "replicon": "NZ_TEST001.1",
            "intervals": [[1, 2]],
            "sharedBases": 2,
        }
    ]
    wrapped = report["hits"][1]
    assert (wrapped["raw_seq_from"], wrapped["raw_seq_to"]) == (4, 7)
    assert (wrapped["native_start"], wrapped["native_end"]) == (19, 2)


def test_run_pilot_is_byte_identical_across_work_directories(
    stub_cmsearch, pilot_inputs, tmp_path
):
    _, rows_dir = stub_cmsearch
    (rows_dir / "native.rows").write_text(row() + "\n")
    first = run_stub_pilot(stub_cmsearch, pilot_inputs)
    second = run_stub_pilot(stub_cmsearch, pilot_inputs, workdir=tmp_path / "again")
    assert json.dumps(first, sort_keys=True) == json.dumps(second, sort_keys=True)
    # No timestamp and no work-directory path: that is what makes it reproducible.
    assert "Date" not in json.dumps(first)
    assert str(pilot_inputs["workdir"]) not in json.dumps(first)


def test_run_pilot_refuses_to_reuse_a_work_directory(stub_cmsearch, pilot_inputs):
    workdir = pilot_inputs["workdir"]
    workdir.mkdir()
    (workdir / "native.tblout").write_text("earlier raw evidence\n")
    with pytest.raises(rr.RegulatoryRfamError, match="needs a fresh one"):
        run_stub_pilot(stub_cmsearch, pilot_inputs)
    assert (workdir / "native.tblout").read_text() == "earlier raw evidence\n"


def test_run_pilot_rejects_a_hit_naming_another_family(stub_cmsearch, pilot_inputs):
    _, rows_dir = stub_cmsearch
    (rows_dir / "native.rows").write_text(row(query_accession="RF00050") + "\n")
    with pytest.raises(rr.RegulatoryRfamError, match="is not the pinned model"):
        run_stub_pilot(stub_cmsearch, pilot_inputs)


def test_run_pilot_rejects_a_hit_on_an_unknown_sequence(stub_cmsearch, pilot_inputs):
    _, rows_dir = stub_cmsearch
    (rows_dir / "native.rows").write_text(row(target="NZ_ELSEWHERE.1") + "\n")
    with pytest.raises(rr.RegulatoryRfamError, match="not a sequence of the pinned"):
        run_stub_pilot(stub_cmsearch, pilot_inputs)


def test_run_pilot_rejects_an_out_of_bounds_native_hit(stub_cmsearch, pilot_inputs):
    _, rows_dir = stub_cmsearch
    (rows_dir / "native.rows").write_text(row(seq_from="19", seq_to="25") + "\n")
    with pytest.raises(rr.RegulatoryRfamError, match="falls outside NZ_TEST001.1"):
        run_stub_pilot(stub_cmsearch, pilot_inputs)


def test_run_pilot_rejects_duplicate_native_hits(stub_cmsearch, pilot_inputs):
    _, rows_dir = stub_cmsearch
    (rows_dir / "native.rows").write_text(row() + "\n" + row() + "\n")
    with pytest.raises(rr.RegulatoryRfamError, match="duplicates hit 1"):
        run_stub_pilot(stub_cmsearch, pilot_inputs)


def test_run_pilot_rejects_a_malformed_native_row(stub_cmsearch, pilot_inputs):
    _, rows_dir = stub_cmsearch
    (rows_dir / "native.rows").write_text("NZ_TEST001.1 - Yfr1 RF01116 cm 1\n")
    with pytest.raises(rr.RegulatoryRfamError, match="expected at least 17 columns"):
        run_stub_pilot(stub_cmsearch, pilot_inputs)


def test_run_pilot_rejects_a_nonfinite_evalue(stub_cmsearch, pilot_inputs):
    _, rows_dir = stub_cmsearch
    (rows_dir / "native.rows").write_text(row(evalue="nan") + "\n")
    with pytest.raises(rr.RegulatoryRfamError, match="is not finite"):
        run_stub_pilot(stub_cmsearch, pilot_inputs)


def test_run_pilot_rejects_a_bad_junction_hit_before_remapping(
    stub_cmsearch, pilot_inputs
):
    _, rows_dir = stub_cmsearch
    (rows_dir / "origin_junction.rows").write_text(
        row(target="NZ_TEST001.1_origin_junction", seq_from="4", seq_to="14") + "\n"
    )
    with pytest.raises(
        rr.RegulatoryRfamError, match="origin junction: .*falls outside"
    ):
        run_stub_pilot(stub_cmsearch, pilot_inputs)


def test_run_pilot_rejects_a_bad_control_hit(stub_cmsearch, pilot_inputs):
    _, rows_dir = stub_cmsearch
    (rows_dir / "control_01.rows").write_text(
        row(target="NZ_TEST001.1_shuffled_01", score="1.0") + "\n"
    )
    with pytest.raises(rr.RegulatoryRfamError, match="control replicate 1: .*GA"):
        run_stub_pilot(stub_cmsearch, pilot_inputs)


def test_run_pilot_requires_at_least_one_control_replicate(
    stub_cmsearch, pilot_inputs
):
    with pytest.raises(rr.RegulatoryRfamError, match="at least 1"):
        run_stub_pilot(stub_cmsearch, pilot_inputs, control_replicates=0)


def test_run_pilot_reports_a_missing_genome(stub_cmsearch, pilot_inputs, tmp_path):
    with pytest.raises(rr.RegulatoryRfamError, match="missing sequence FASTA"):
        run_stub_pilot(stub_cmsearch, pilot_inputs, fasta_path=tmp_path / "absent.fna")


def test_run_pilot_reports_a_missing_flat_file(stub_cmsearch, pilot_inputs, tmp_path):
    with pytest.raises(rr.RegulatoryRfamError, match="missing GenBank flat file"):
        run_stub_pilot(stub_cmsearch, pilot_inputs, gbff_path=tmp_path / "absent.gbff")


def test_run_pilot_reports_a_missing_model(stub_cmsearch, pilot_inputs, tmp_path):
    with pytest.raises(rr.RegulatoryRfamError, match="missing covariance model"):
        run_stub_pilot(stub_cmsearch, pilot_inputs, cm_path=tmp_path / "absent.cm")


def test_run_pilot_reports_a_missing_tool(pilot_inputs, tmp_path):
    with pytest.raises(rr.RegulatoryRfamError, match="missing cmsearch executable"):
        rr._run_pilot(cmsearch=tmp_path / "absent", **pilot_inputs)
    assert not pilot_inputs["workdir"].exists()


def test_run_pilot_refuses_a_genome_sequence_with_no_topology(
    stub_cmsearch, pilot_inputs, tmp_path
):
    partial = write_gbff(tmp_path / "partial.gbff", {"NZ_TEST001.1": (20, "circular")})
    pins = rr.PinnedIdentity(
        **{
            **pilot_inputs["pins"].__dict__,
            "gbff_sha256": rr.sha256_file(partial),
            "gbff_md5": rr.md5_file(partial),
        }
    )
    with pytest.raises(rr.RegulatoryRfamError, match="no topology in the pinned"):
        run_stub_pilot(stub_cmsearch, pilot_inputs, gbff_path=partial, pins=pins)


def test_run_pilot_refuses_a_multi_family_library(
    stub_cmsearch, pilot_inputs, tmp_path
):
    library = write_model(tmp_path / "Rfam.cm", models=3)
    pins = rr.PinnedIdentity(
        **{**pilot_inputs["pins"].__dict__, "model_sha256": rr.sha256_file(library)}
    )
    with pytest.raises(rr.RegulatoryRfamError, match="more than one model"):
        run_stub_pilot(stub_cmsearch, pilot_inputs, cm_path=library, pins=pins)


def test_run_pilot_refuses_a_workdir_blocked_by_a_file(
    stub_cmsearch, pilot_inputs, tmp_path
):
    blocker = tmp_path / "blocked"
    blocker.write_text("file\n", encoding="utf-8")
    with pytest.raises(rr.RegulatoryRfamError, match="is not a directory"):
        run_stub_pilot(stub_cmsearch, pilot_inputs, workdir=blocker / "work")


def test_run_pilot_writes_the_raw_outputs_into_the_workdir(
    stub_cmsearch, pilot_inputs
):
    run_stub_pilot(stub_cmsearch, pilot_inputs)
    produced = {path.name for path in pilot_inputs["workdir"].iterdir()}
    assert {
        "native.fna",
        "native.tblout",
        "native.cmsearch",
        "origin_junction.fna",
        "origin_junction.tblout",
        "control_00.fna",
        "control_01.tblout",
    } <= produced


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def cli_args(stub_cmsearch, pilot_inputs, json_out, tsv_out, extra=()):
    script, _ = stub_cmsearch
    return [
        "--cm", str(pilot_inputs["cm_path"]),
        "--fasta", str(pilot_inputs["fasta_path"]),
        "--gbff", str(pilot_inputs["gbff_path"]),
        "--workdir", str(pilot_inputs["workdir"]),
        "--cmsearch", str(script),
        "--json-out", str(json_out),
        "--tsv-out", str(tsv_out),
        "--control-replicates", "2",
        *extra,
    ]


def test_main_refuses_synthetic_inputs_before_writing_anything(
    stub_cmsearch, pilot_inputs, tmp_path
):
    json_out, tsv_out = tmp_path / "out" / "r.json", tmp_path / "out" / "r.tsv"
    with pytest.raises(SystemExit, match="not the pinned RF01116 model"):
        rr.main(cli_args(stub_cmsearch, pilot_inputs, json_out, tsv_out))
    assert not (tmp_path / "out").exists()
    assert not pilot_inputs["workdir"].exists()


def test_main_has_no_overwrite_or_expectation_override(
    stub_cmsearch, pilot_inputs, tmp_path, capsys
):
    for flag in ("--overwrite", "--expect-accession=RF00050"):
        with pytest.raises(SystemExit):
            rr.main(
                cli_args(
                    stub_cmsearch, pilot_inputs, tmp_path / "r.json",
                    tmp_path / "r.tsv", [flag],
                )
            )
        assert "unrecognized arguments" in capsys.readouterr().err


def test_main_writes_both_reports_and_prints_a_summary(
    stub_cmsearch, pilot_inputs, tmp_path, capsys, monkeypatch
):
    # Only here are the production pins swapped for the fixture's own, so
    # main's success path is reachable without the real assembly.
    monkeypatch.setattr(rr, "PINNED", pilot_inputs["pins"])
    _, rows_dir = stub_cmsearch
    (rows_dir / "native.rows").write_text(row() + "\n")
    json_out, tsv_out = tmp_path / "out" / "r.json", tmp_path / "out" / "r.tsv"
    assert rr.main(cli_args(stub_cmsearch, pilot_inputs, json_out, tsv_out)) == 0
    printed = capsys.readouterr().out
    assert "model=RF01116 (Yfr1) replicons=2 native_hits=1" in printed
    assert "control_hits=0 over 2 replicates" in printed
    report = json.loads(json_out.read_text())
    assert report["schemaVersion"] == rr.SCHEMA_VERSION
    assert report["pilot"] == rr.PILOT_ID
    header, data = tsv_out.read_text().splitlines()
    assert header.split("\t") == list(rr._HIT_FIELDNAMES)
    assert data.split("\t")[:2] == ["NZ_TEST001.1", "native_linear"]


def test_main_refuses_an_existing_report_before_running(
    stub_cmsearch, pilot_inputs, tmp_path, monkeypatch
):
    monkeypatch.setattr(rr, "PINNED", pilot_inputs["pins"])
    json_out, tsv_out = tmp_path / "r.json", tmp_path / "r.tsv"
    json_out.write_text("previous\n", encoding="utf-8")
    with pytest.raises(SystemExit, match="never replaces or reuses"):
        rr.main(cli_args(stub_cmsearch, pilot_inputs, json_out, tsv_out))
    # The refusal happens before any work, so the earlier report is intact and
    # no partial second report or work directory was left behind.
    assert json_out.read_text() == "previous\n"
    assert not tsv_out.exists()
    assert not pilot_inputs["workdir"].exists()


def test_main_refuses_a_report_named_as_an_input(
    stub_cmsearch, pilot_inputs, tmp_path, monkeypatch
):
    monkeypatch.setattr(rr, "PINNED", pilot_inputs["pins"])
    model_bytes = pilot_inputs["cm_path"].read_bytes()
    with pytest.raises(SystemExit, match="already exists"):
        rr.main(
            cli_args(
                stub_cmsearch, pilot_inputs, pilot_inputs["cm_path"], tmp_path / "r.tsv"
            )
        )
    assert pilot_inputs["cm_path"].read_bytes() == model_bytes


def test_main_refuses_one_report_path_for_both(
    stub_cmsearch, pilot_inputs, tmp_path, monkeypatch
):
    monkeypatch.setattr(rr, "PINNED", pilot_inputs["pins"])
    same = tmp_path / "out" / "r.out"
    with pytest.raises(SystemExit, match="resolve to the same path"):
        rr.main(cli_args(stub_cmsearch, pilot_inputs, same, same))
    assert not same.exists()
    assert not pilot_inputs["workdir"].exists()


def test_main_reports_an_error_without_a_traceback(
    stub_cmsearch, pilot_inputs, tmp_path, monkeypatch
):
    monkeypatch.setattr(rr, "PINNED", pilot_inputs["pins"])
    _, rows_dir = stub_cmsearch
    (rows_dir / "native.rows").write_text(row(target="NZ_ELSEWHERE.1") + "\n")
    json_out, tsv_out = tmp_path / "r.json", tmp_path / "r.tsv"
    with pytest.raises(SystemExit, match="error: cmsearch output failed"):
        rr.main(cli_args(stub_cmsearch, pilot_inputs, json_out, tsv_out))
    assert not json_out.exists()
    assert not tsv_out.exists()


def test_module_runs_as_a_script():
    """The CLI is reachable the way the runbook invokes it."""
    completed = subprocess.run(
        [sys.executable, str(REPO_ROOT / "tools/regulatory_rfam.py"), "--help"],
        capture_output=True,
        text=True,
        check=True,
    )
    assert "pinned" in completed.stdout
    assert "--overwrite" not in completed.stdout


# --------------------------------------------------------------------------
# Real-tool checks against the pinned assembly
# --------------------------------------------------------------------------

requires_real_tool = pytest.mark.skipif(
    not (REAL_CMSEARCH.exists() and PINNED_FASTA.exists() and PINNED_GBFF.exists()),
    reason="needs Infernal 1.1.5 in trna-validate and the fetched pinned assembly",
)


@pytest.fixture(scope="module")
def pinned_model():
    """The extracted RF01116.cm, or a skip if the runbook has not been followed.

    The 44 MB Rfam 15.1 library is a third-party blob and is never committed,
    so this looks for the single-family model the runbook in
    docs/validation/regulatory-rfam.md extracts into ignored scratch.
    """
    if not SCRATCH_MODEL.exists():
        pytest.skip("no extracted RF01116.cm in the ignored scratch directory")
    if rr.sha256_file(SCRATCH_MODEL) != rr.PINNED.model_sha256:
        pytest.skip("scratch RF01116.cm does not match the pinned SHA-256")
    return SCRATCH_MODEL


@requires_real_tool
def test_real_cmsearch_reports_infernal_115():
    tool = rr.describe_tool(REAL_CMSEARCH, rr.PINNED.infernal_version)
    assert tool["version"] == "1.1.5 (Sep 2023)"
    assert len(tool["sha256"]) == 64


@requires_real_tool
def test_real_pinned_inputs_verify(pinned_model):
    inputs = rr.verify_pinned_inputs(rr.PINNED, pinned_model, PINNED_FASTA, PINNED_GBFF)
    assert inputs["genomeFasta"]["md5"] == "610ceb15a9859046e143d80915d4c984"
    model = rr.parse_covariance_model(pinned_model)
    rr.check_model_header(model, rr.PINNED)
    assert model.description == "Cyanobacterial functional RNA 1"
    assert model.format_line == "INFERNAL1/a [1.1.5 | Sep 2023]"
    records = rr.load_fasta(PINNED_FASTA)
    replicons = rr.build_replicons(records, rr.parse_locus_topologies(PINNED_GBFF))
    rr.check_replicon_set(replicons, rr.PINNED)
    assert rr.search_space_mb(sum(r.length for r in replicons)) == 5.489252
    assert (
        rr.sha256_text(rr.fasta_text(rr.native_records(records)))
        == rr.PINNED.searched_fasta_sha256
    )


@requires_real_tool
def test_real_production_refuses_a_one_base_change_to_the_chromosome(
    pinned_model, tmp_path
):
    (chromosome, description, sequence), *rest = rr.load_fasta(PINNED_FASTA)
    changed = ("C" if sequence[999] != "C" else "G").join(
        (sequence[:999], sequence[1000:])
    )
    mutated = tmp_path / "GCF_000817325.1_ASM81732v1_genomic.fna.gz"
    with gzip.open(mutated, "wt", encoding="utf-8") as handle:
        handle.write(
            rr.fasta_text(
                rr.native_records([(chromosome, description, changed), *rest])
            )
        )
    with pytest.raises(rr.RegulatoryRfamError, match="genomeFasta sha256"):
        rr.run_pilot(
            cm_path=pinned_model,
            fasta_path=mutated,
            gbff_path=PINNED_GBFF,
            workdir=tmp_path / "work",
            cmsearch=REAL_CMSEARCH,
            control_replicates=1,
            control_seed=20261012,
        )
    assert not (tmp_path / "work").exists()


@requires_real_tool
def test_real_production_refuses_the_decompressed_fasta(pinned_model, tmp_path):
    plain = tmp_path / "GCF_000817325.1_ASM81732v1_genomic.fna"
    with gzip.open(PINNED_FASTA, "rb") as source:
        plain.write_bytes(source.read())
    with pytest.raises(rr.RegulatoryRfamError, match="genomeFasta sha256"):
        rr.run_pilot(
            cm_path=pinned_model,
            fasta_path=plain,
            gbff_path=PINNED_GBFF,
            workdir=tmp_path / "work",
            cmsearch=REAL_CMSEARCH,
            control_replicates=1,
            control_seed=20261012,
        )


@requires_real_tool
def test_real_search_finds_the_single_recorded_yfr1_locus(pinned_model, tmp_path):
    """Regression oracle: one native hit, no origin-spanning hit, no control hit.

    A changed count here means the model, the assembly or the Infernal build
    changed — and the pins should have refused the first two.
    """
    report = rr.run_pilot(
        cm_path=pinned_model,
        fasta_path=PINNED_FASTA,
        gbff_path=PINNED_GBFF,
        workdir=tmp_path / "work",
        cmsearch=REAL_CMSEARCH,
        control_replicates=2,
        control_seed=20261012,
    )
    assert report["counts"]["nativeLinearHits"] == 1
    assert report["counts"]["originSpanningHits"] == 0
    assert report["counts"]["overlappingNativePairs"] == 0
    assert report["counts"]["controlHitsTotal"] == 0
    (hit,) = report["hits"]
    assert hit["replicon"] == "NZ_CP006471.1"
    assert (hit["native_start"], hit["native_end"], hit["strand"]) == (
        1364716,
        1364778,
        "+",
    )
    assert (hit["raw_seq_from"], hit["raw_seq_to"]) == (1364716, 1364778)
    assert (hit["mdl_from"], hit["mdl_to"]) == (1, 59)
    assert hit["trunc"] == "no"
    assert hit["score"] == 62.1
    assert hit["evalue"] == 6.7e-12
    # cmsearch itself counted all three replicons, both strands.
    assert report["nativeSearch"]["cmsearchSummary"] == {
        "queryModels": 1,
        "targetSequences": 3,
        "residuesSearched": 5489252,
        "hitsReported": 1,
    }
    assert [entry["accession"] for entry in report["searchCoverage"]["replicons"]] == [
        "NZ_CP006471.1",
        "NZ_CP006472.1",
        "NZ_CP006473.1",
    ]
    assert report["originJunctionSearch"]["flankBases"] == 85
    assert report["originJunctionSearch"]["cmsearchSummary"]["targetSequences"] == 3
    assert report["originJunctionSearch"]["searchedReplicons"] == [
        "NZ_CP006471.1",
        "NZ_CP006472.1",
        "NZ_CP006473.1",
    ]


def _run_rotated(pinned_model, tmp_path, offset):
    """Runs the private pipeline on the pinned chromosome rotated left by ``offset``.

    A rotated chromosome is not the pinned assembly, so the production
    ``run_pilot`` refuses it (asserted here) and the run goes through the
    private runner with pins describing the rotated copy.
    """
    (chromosome, description, sequence), *_ = rr.load_fasta(PINNED_FASTA)
    rotated = tmp_path / "rotated.fna"
    rotated.write_text(
        rr.fasta_text(
            [(f"{chromosome} {description}", sequence[offset:] + sequence[:offset])]
        ),
        encoding="utf-8",
    )
    gbff = write_gbff(
        tmp_path / "rotated.gbff", {chromosome: (len(sequence), "circular")}
    )
    common = {
        "cm_path": pinned_model,
        "fasta_path": rotated,
        "gbff_path": gbff,
        "cmsearch": REAL_CMSEARCH,
        "control_replicates": 1,
        "control_seed": 20261012,
    }
    with pytest.raises(rr.RegulatoryRfamError, match="not the pinned"):
        rr.run_pilot(workdir=tmp_path / "refused", **common)
    assert not (tmp_path / "refused").exists()
    pins = pins_for(
        pinned_model,
        rotated,
        gbff,
        assembly_label="rotated test copy of the pinned chromosome",
    )
    return rr._run_pilot(pins=pins, workdir=tmp_path / "work", **common)


@requires_real_tool
def test_real_origin_spanning_hit_is_found_and_remapped(pinned_model, tmp_path):
    """The Yfr1 locus rotated to straddle position 1 at its midpoint.

    The linear search alone cannot report that hit; the origin-junction search
    must find it and remap it to the wrapped native interval, keeping the
    endpoints cmsearch emitted on the junction sequence.
    """
    length = 2690418
    # Rotate so the midpoint of the recorded 1364716..1364778 hit lands on 1.
    report = _run_rotated(pinned_model, tmp_path, (1364716 + 1364778) // 2 - 1)
    assert report["counts"]["nativeLinearHits"] == 0
    assert report["counts"]["originSpanningHits"] == 1
    (wrapped,) = report["hits"]
    assert wrapped["origin_spanning"] is True
    assert wrapped["search_space"] == rr.SEARCH_SPACE_JUNCTION
    assert wrapped["replicon"] == "NZ_CP006471.1"
    assert wrapped["search_target"] == "NZ_CP006471.1_origin_junction"
    # 1364716 - offset wraps to length - 30; 1364778 - offset stays at 32.
    assert (wrapped["native_start"], wrapped["native_end"]) == (length - 30, 32)
    assert wrapped["native_start"] > wrapped["native_end"]  # the wrap itself
    # As emitted on the 170-base junction: flank 85, so native L-30 is 55.
    assert (wrapped["raw_seq_from"], wrapped["raw_seq_to"]) == (55, 117)
    assert wrapped["native_length"] == 63
    assert (wrapped["mdl_from"], wrapped["mdl_to"]) == (1, 59)
    assert wrapped["score"] == 62.1
    assert report["originJunctionSearch"]["alreadyFoundByLinearSearch"] == 0


@requires_real_tool
def test_real_truncated_linear_hit_overlaps_the_wrapped_hit(pinned_model, tmp_path):
    """Rotated so the locus starts at the last base: a 5'-truncated linear hit.

    The linear search reports the truncated 1..62 and the junction search the
    complete wrap 2690418..62. Both are kept, and they overlap on 62 bases.
    """
    report = _run_rotated(pinned_model, tmp_path, 1364716)
    assert report["counts"]["nativeLinearHits"] == 1
    assert report["counts"]["originSpanningHits"] == 1
    linear, wrapped = report["hits"]
    assert (linear["native_start"], linear["native_end"]) == (1, 62)
    assert linear["trunc"] != "no"
    assert linear["score"] == 55.3
    assert (wrapped["native_start"], wrapped["native_end"]) == (2690418, 62)
    assert (wrapped["trunc"], wrapped["score"]) == ("no", 62.1)
    assert report["counts"]["overlappingNativePairs"] == 1
    assert report["overlaps"] == [
        {
            "first": 0,
            "second": 1,
            "replicon": "NZ_CP006471.1",
            "intervals": [[1, 62]],
            "sharedBases": 62,
        }
    ]


@requires_real_tool
def test_real_cli_round_trip_is_reproducible(pinned_model, tmp_path):
    def run(name):
        json_out = tmp_path / name / "r.json"
        argv = [
            "--cm", str(pinned_model),
            "--fasta", str(PINNED_FASTA),
            "--gbff", str(PINNED_GBFF),
            "--workdir", str(tmp_path / name / "work"),
            "--cmsearch", str(REAL_CMSEARCH),
            "--json-out", str(json_out),
            "--tsv-out", str(tmp_path / name / "r.tsv"),
            "--control-replicates", "1",
        ]
        assert rr.main(argv) == 0
        return json_out.read_bytes()

    # Two fresh work directories, byte-identical reports.
    assert run("first") == run("second")


@requires_real_tool
def test_real_hit_is_intergenic_in_the_pinned_annotation():
    """Context only: no RefSeq feature but the whole-replicon `region` overlaps.

    Read straight from the pinned GFF. This locates the hit relative to the
    annotation; it is not evidence that the interval is transcribed or
    regulatory, and RefSeq's silence there is not a negative.
    """
    gff = REPO_ROOT / "data/raw/GCF_000817325.1_ASM81732v1_genomic.gff.gz"
    if not gff.exists():
        pytest.skip("pinned GFF not fetched")
    start, end = 1364716, 1364778
    overlapping = []
    with gzip.open(gff, "rt") as handle:
        for line in handle:
            if line.startswith("#"):
                continue
            fields = line.rstrip("\n").split("\t")
            if len(fields) != 9 or fields[0] != "NZ_CP006471.1":
                continue
            if fields[2] == "region":
                continue
            if int(fields[3]) <= end and start <= int(fields[4]):
                overlapping.append(fields[2])
    assert overlapping == []


@pytest.mark.parametrize("report_name", ["r.tsv", "r.json"])
@pytest.mark.parametrize("failure_mode", ["write", "close", "interrupt"])
def test_report_pair_cleans_partial_writes_and_interruptions(
    tmp_path, monkeypatch, report_name, failure_mode
):
    json_path, tsv_path = tmp_path / "r.json", tmp_path / "r.tsv"
    real_open = Path.open

    class FailingReport:
        def __init__(self, handle):
            self.handle = handle

        def __enter__(self):
            return self

        def __exit__(self, *args):
            self.handle.close()
            if failure_mode == "close":
                raise OSError("flush failed on close")

        def write(self, text):
            self.handle.write(text[:16])
            self.handle.flush()
            if failure_mode == "write":
                raise OSError("disk full during write")
            if failure_mode == "interrupt":
                raise KeyboardInterrupt()

    def fail_selected(path, *args, **kwargs):
        handle = real_open(path, *args, **kwargs)
        return FailingReport(handle) if path.name == report_name else handle

    monkeypatch.setattr(Path, "open", fail_selected)
    expected = KeyboardInterrupt if failure_mode == "interrupt" else rr.RegulatoryRfamError
    with pytest.raises(expected):
        rr.write_report(REPORT, json_path, tsv_path)
    assert not json_path.exists()
    assert not tsv_path.exists()


@pytest.mark.parametrize("limit", [16, 1024])
def test_real_child_process_file_limit_leaves_no_partial_report(tmp_path, limit):
    # Limit only the child: the test runner and other sessions are unaffected.
    script = f'''
import resource
import runpy
import signal
from pathlib import Path
module = runpy.run_path({str(REPO_ROOT / "tools/regulatory_rfam.py")!r})
json_path, tsv_path = Path({str(tmp_path / "r.json")!r}), Path({str(tmp_path / "r.tsv")!r})
resource.setrlimit(resource.RLIMIT_FSIZE, ({limit}, {limit}))
signal.signal(signal.SIGXFSZ, signal.SIG_IGN)
try:
    module["write_report"]({{"hits": [], "padding": "x" * 5000}}, json_path, tsv_path)
except module["RegulatoryRfamError"]:
    pass
else:
    raise AssertionError("expected an OS file-size failure")
assert not json_path.exists() and not tsv_path.exists()
'''
    subprocess.run([sys.executable, "-c", script], check=True, capture_output=True, text=True)


@pytest.mark.parametrize("interrupt", [False, True])
def test_report_cleanup_attempts_every_file_and_preserves_failure(tmp_path, monkeypatch, interrupt):
    json_path, tsv_path = tmp_path / "r.json", tmp_path / "r.tsv"
    real_open, real_unlink = Path.open, Path.unlink
    original = KeyboardInterrupt() if interrupt else OSError("original write failure")

    class BrokenJson:
        def __init__(self, handle):
            self.handle = handle

        def __enter__(self):
            return self

        def __exit__(self, *args):
            self.handle.close()

        def write(self, text):
            self.handle.write(text[:16])
            raise original

    def fail_json(path, *args, **kwargs):
        handle = real_open(path, *args, **kwargs)
        return BrokenJson(handle) if path == json_path else handle

    def deny_tsv_unlink(path, *args, **kwargs):
        if path == tsv_path:
            raise PermissionError("cleanup denied")
        return real_unlink(path, *args, **kwargs)

    monkeypatch.setattr(Path, "open", fail_json)
    monkeypatch.setattr(Path, "unlink", deny_tsv_unlink)
    expected = KeyboardInterrupt if interrupt else rr.RegulatoryRfamError
    with pytest.raises(expected) as error:
        rr.write_report(REPORT, json_path, tsv_path)
    if interrupt:
        assert error.value is original
        assert "cleanup denied" in error.value.__notes__[0]
    else:
        assert error.value.__cause__ is original
        assert "original write failure" in str(error.value)
        assert "cleanup denied" in str(error.value)
    assert tsv_path.exists()
    assert not json_path.exists()
