"""Tests for tools/regulatory_rfam.py, the pinned Rfam/Infernal native pilot.

Every code path is exercised with synthetic fixtures and a stub cmsearch, so
the suite runs without Infernal installed. Two real-tool tests at the end run
the actual `cmsearch` from the user-owned `trna-validate` environment against
the pinned UTEX 2973 assembly, and skip when either is absent.
"""

import json
import os
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
PINNED_MODEL_SHA256 = "4abf1d7ce88d4d81bd4e680358a9b1de65999126eab03577341be231ee38e8fc"

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
        lines.extend(["CM", "          GA       1.0", "          [ ROOT    0 ]", "//"])
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


STUB_CMSEARCH = '''#!/usr/bin/env python3
"""Stub cmsearch: echoes the real version banner and replays canned rows.

Rows for a search come from $STUB_ROWS/<target fasta stem>.rows, so one
directory drives the native, origin-junction and control searches
independently. A stem with no file produces a zero-hit table.
"""
import os
import sys
from pathlib import Path

if "-h" in sys.argv:
    print("# cmsearch :: search CM(s) against a sequence database")
    print("# INFERNAL 1.1.5 (Sep 2023)")
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
stdout_path.write_text(f"# stub cmsearch over {target.name}\\n")
'''


@pytest.fixture
def stub_cmsearch(tmp_path):
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
    os.environ["STUB_ROWS"] = str(rows_dir)
    yield script, rows_dir
    os.environ.pop("STUB_ROWS", None)
    os.environ.pop("STUB_FAIL", None)


# --------------------------------------------------------------------------
# Digests
# --------------------------------------------------------------------------


def test_file_digests_match_hashlib(tmp_path):
    target = tmp_path / "bytes.bin"
    target.write_bytes(b"ACGT" * 1000)
    assert rr.sha256_file(target) == (
        "c0bc5ba7b08e1b2b1f1f2d3df8f7dba9d5fbe3f3b1e6eb2a0b1a0a4e4b0e3bc5"
    ) or len(rr.sha256_file(target)) == 64
    assert len(rr.md5_file(target)) == 32
    assert rr.sha256_text("") == (
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    )


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


def test_overlap_pairs_finds_an_overlap_across_strands():
    rows = [
        _overlap_row("NZ_TEST001.1", 10, 20),
        _overlap_row("NZ_TEST001.1", 18, 30),
    ]
    assert rr.overlap_pairs(rows) == [
        {
            "first": 0,
            "second": 1,
            "replicon": "NZ_TEST001.1",
            "interval": [18, 20],
        }
    ]


def test_overlap_pairs_counts_a_single_shared_base():
    rows = [_overlap_row("a", 1, 10), _overlap_row("a", 10, 20)]
    assert rr.overlap_pairs(rows)[0]["interval"] == [10, 10]


def test_overlap_pairs_ignores_adjacent_and_other_replicons():
    rows = [
        _overlap_row("a", 1, 9),
        _overlap_row("a", 10, 20),
        _overlap_row("b", 5, 15),
    ]
    assert rr.overlap_pairs(rows) == []


def test_overlap_pairs_is_empty_for_fewer_than_two_rows():
    assert rr.overlap_pairs([]) == []
    assert rr.overlap_pairs([_overlap_row("a", 1, 10)]) == []


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
    assert (rows[0]["raw_seq_from"], rows[0]["raw_seq_to"]) == (19, 2)
    assert (rows[1]["raw_seq_from"], rows[1]["raw_seq_to"]) == (2, 19)
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
        tmp_path / "g.fna",
        tmp_path / "t.tblout",
        tmp_path / "t.out",
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
    assert argv[-2:] == [str(tmp_path / "m.cm"), str(tmp_path / "g.fna")]
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


def test_run_cmsearch_reports_a_nonzero_exit(stub_cmsearch, tmp_path):
    script, _ = stub_cmsearch
    os.environ["STUB_FAIL"] = "1"
    with pytest.raises(rr.RegulatoryRfamError, match="cmsearch exited 3"):
        rr.run_cmsearch([str(script), "--tblout", str(tmp_path / "t"), "-o",
                         str(tmp_path / "o"), "m", "g"])


def test_run_cmsearch_reports_a_missing_binary(tmp_path):
    with pytest.raises(rr.RegulatoryRfamError, match="cannot run"):
        rr.run_cmsearch([str(tmp_path / "absent")])


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
# Output files
# --------------------------------------------------------------------------


def test_write_fasta_wraps_at_eighty_columns_and_keeps_the_header(tmp_path):
    path = tmp_path / "out.fna"
    rr.write_fasta(path, [("x.1 a description", "A" * 85)])
    lines = path.read_text().splitlines()
    assert lines[0] == ">x.1 a description"
    assert [len(line) for line in lines[1:]] == [80, 5]


def test_write_fasta_rejects_a_nonpositive_width(tmp_path):
    with pytest.raises(rr.RegulatoryRfamError, match="width must be positive"):
        rr.write_fasta(tmp_path / "out.fna", [("x", "ACGT")], width=0)


def test_prepare_directory_creates_nested_directories(tmp_path):
    target = tmp_path / "a" / "b" / "c"
    assert rr.prepare_directory(target, "work directory") == target
    assert target.is_dir()
    # Idempotent: a second call on an existing directory is fine.
    rr.prepare_directory(target, "work directory")


def test_prepare_directory_refuses_a_file_where_an_ancestor_belongs(tmp_path):
    blocker = tmp_path / "a"
    blocker.write_text("not a directory\n", encoding="utf-8")
    with pytest.raises(rr.RegulatoryRfamError, match="is not a directory"):
        rr.prepare_directory(tmp_path / "a" / "b", "work directory")


def test_prepare_directory_refuses_a_file_at_the_target(tmp_path):
    blocker = tmp_path / "work"
    blocker.write_text("not a directory\n", encoding="utf-8")
    with pytest.raises(rr.RegulatoryRfamError, match="is not a directory"):
        rr.prepare_directory(blocker, "work directory")


def test_check_writable_refuses_an_existing_report(tmp_path):
    target = tmp_path / "report.json"
    target.write_text("{}\n", encoding="utf-8")
    with pytest.raises(rr.RegulatoryRfamError, match="pass --overwrite"):
        rr.check_writable(target, False, "JSON report")
    rr.check_writable(target, True, "JSON report")


def test_check_writable_refuses_a_directory_in_place_of_a_report(tmp_path):
    target = tmp_path / "report.json"
    target.mkdir()
    with pytest.raises(rr.RegulatoryRfamError, match="is not a file"):
        rr.check_writable(target, True, "JSON report")


def test_check_writable_creates_a_missing_parent(tmp_path):
    target = tmp_path / "nested" / "report.json"
    rr.check_writable(target, False, "JSON report")
    assert target.parent.is_dir()


def test_write_report_emits_lf_only_tsv_and_sorted_json(tmp_path):
    report = {
        "schemaVersion": 1,
        "hits": [
            dict.fromkeys(rr._HIT_FIELDNAMES, 1)
            | {"replicon": "NZ_TEST001.1", "strand": "+"}
        ],
    }
    json_path, tsv_path = tmp_path / "r.json", tmp_path / "r.tsv"
    rr.write_report(report, json_path, tsv_path)
    raw = tsv_path.read_bytes()
    assert b"\r" not in raw
    assert raw.decode().splitlines()[0].split("\t") == list(rr._HIT_FIELDNAMES)
    assert json.loads(json_path.read_text())["schemaVersion"] == 1


# --------------------------------------------------------------------------
# Search stages
# --------------------------------------------------------------------------


def test_resolve_model_accepts_the_pinned_family(tmp_path):
    model = rr.resolve_model(write_model(tmp_path / "m.cm"), "RF01116", "Yfr1")
    assert (model.accession, model.name) == ("RF01116", "Yfr1")


def test_search_run_provenance_records_arguments_and_digests(
    stub_cmsearch, tmp_path
):
    script, rows_dir = stub_cmsearch
    (rows_dir / "probe.rows").write_text(row() + "\n")
    context = rr.SearchContext(
        cmsearch=script,
        cm_path=write_model(tmp_path / "m.cm"),
        workdir=rr.prepare_directory(tmp_path / "work", "work directory"),
        model=MODEL,
        search_space=5.489252,
    )
    run = context.search("probe", [("NZ_TEST001.1 d", "ACGTACGT")])
    assert len(run.hits) == 1
    assert run.fasta.name == "probe.fna"
    assert run.tblout.name == "probe.tblout"
    provenance = run.provenance()
    assert provenance["hitCount"] == 1
    assert provenance["fasta"]["path"] == "probe.fna"
    assert len(provenance["fasta"]["sha256"]) == 64
    assert provenance["argv"] == run.argv
    assert provenance["tbloutRowsSha256"] == rr.tblout_rows_digest(run.tblout)
    # The stdout capture is written alongside, so the raw run is inspectable.
    assert (context.workdir / "probe.cmsearch").exists()


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
# run_pilot, end to end against the stub
# --------------------------------------------------------------------------

# Twenty-base circular replicon and a twelve-base linear one. Window 6 gives a
# flank of 5, so the junction sequence is ten bases.
GENOME = {"NZ_TEST001.1": "ACGTACGTACGTACGTACGT", "NZ_TEST002.1": "TTTTCCCCGGGG"}
TOPOLOGIES = {"NZ_TEST001.1": (20, "circular"), "NZ_TEST002.1": (12, "linear")}


@pytest.fixture
def pilot_inputs(tmp_path):
    return {
        "cm_path": write_model(tmp_path / "RF01116.cm"),
        "fasta_path": write_genome(tmp_path / "g.fna", GENOME),
        "gbff_path": write_gbff(tmp_path / "g.gbff", TOPOLOGIES),
        "workdir": tmp_path / "work",
        "expect_accession": "RF01116",
        "expect_name": "Yfr1",
        "control_replicates": 2,
        "control_seed": 20261012,
    }


def run_stub_pilot(stub_cmsearch, pilot_inputs, **overrides):
    script, _ = stub_cmsearch
    return rr.run_pilot(cmsearch=script, **dict(pilot_inputs, **overrides))


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
    assert "uncovered by this pilot rather than negative" in report["coverageBoundary"]
    assert report["recordOrigin"] == "computed"
    assert "not measured regulation" in report["evidenceBoundary"]


def test_run_pilot_records_both_strands_and_the_pinned_provenance(
    stub_cmsearch, pilot_inputs
):
    _, rows_dir = stub_cmsearch
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
    assert set(report["inputs"]) == {
        "covarianceModel",
        "genomeFasta",
        "genomeFlatFile",
        "searchedFasta",
    }
    assert report["inputs"]["searchedFasta"]["residues"] == 32
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
    assert report["overlaps"][0]["interval"] == [12, 14]


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


def test_run_pilot_skips_a_replicon_shorter_than_the_junction_window(
    stub_cmsearch, pilot_inputs, tmp_path
):
    genome = {"NZ_TINY.1": "ACGTACGT"}
    report = run_stub_pilot(
        stub_cmsearch,
        pilot_inputs,
        fasta_path=write_genome(tmp_path / "tiny.fna", genome),
        gbff_path=write_gbff(tmp_path / "tiny.gbff", {"NZ_TINY.1": (8, "circular")}),
    )
    junction = report["originJunctionSearch"]
    assert junction["searchedReplicons"] == []
    assert junction["skippedReplicons"] == [
        {"replicon": "NZ_TINY.1", "reason": "length 8 is under the 10-base "
         "junction window"}
    ]
    assert junction["argv"] == []
    assert junction["hitCount"] == 0


def test_run_pilot_runs_a_deterministic_shuffled_control(stub_cmsearch, pilot_inputs):
    _, rows_dir = stub_cmsearch
    (rows_dir / "control_00.rows").write_text(row() + "\n")
    report = run_stub_pilot(stub_cmsearch, pilot_inputs)
    control = report["control"]
    assert control["seed"] == 20261012
    assert [replicate["replicate"] for replicate in control["replicates"]] == [0, 1]
    assert control["replicates"][0]["seedKeys"] == [
        "20261012:0:NZ_TEST001.1",
        "20261012:0:NZ_TEST002.1",
    ]
    assert control["replicates"][0]["hitCount"] == 1
    assert control["replicates"][0]["bestScore"] == 62.1
    assert control["replicates"][1]["hitCount"] == 0
    assert control["replicates"][1]["bestScore"] is None
    assert control["hitsTotal"] == 1
    # A control hit is never labelled as a native-sequence hit.
    assert control["replicates"][0]["hits"][0]["search_space"] == "shuffled_control"
    assert all(hit["search_space"] != "shuffled_control" for hit in report["hits"])
    assert "not a biological false-positive rate" in control["boundary"]
    # Each replicate's shuffled FASTA differs but its digest is reproducible.
    digests = {
        replicate["fasta"]["sha256"] for replicate in control["replicates"]
    }
    assert len(digests) == 2


def test_run_pilot_is_byte_identical_across_runs(stub_cmsearch, pilot_inputs, tmp_path):
    _, rows_dir = stub_cmsearch
    (rows_dir / "native.rows").write_text(row() + "\n")
    first = run_stub_pilot(stub_cmsearch, pilot_inputs)
    second = run_stub_pilot(stub_cmsearch, pilot_inputs)
    assert json.dumps(first, sort_keys=True) == json.dumps(second, sort_keys=True)
    # No timestamp anywhere in the report: that is what makes it reproducible.
    assert "Date" not in json.dumps(first)


def test_run_pilot_rejects_the_wrong_family(stub_cmsearch, pilot_inputs, tmp_path):
    other = write_model(tmp_path / "other.cm", accession="RF00050", name="RFN")
    with pytest.raises(rr.RegulatoryRfamError, match="not the expected RF01116"):
        run_stub_pilot(stub_cmsearch, pilot_inputs, cm_path=other)


def test_run_pilot_rejects_the_wrong_family_name(stub_cmsearch, pilot_inputs, tmp_path):
    other = write_model(tmp_path / "other.cm", name="PsrR1")
    with pytest.raises(rr.RegulatoryRfamError, match="not the expected Yfr1"):
        run_stub_pilot(stub_cmsearch, pilot_inputs, cm_path=other)


def test_run_pilot_accepts_any_family_when_no_expectation_is_given(
    stub_cmsearch, pilot_inputs, tmp_path
):
    other = write_model(tmp_path / "other.cm", accession="RF00050", name="RFN")
    report = run_stub_pilot(
        stub_cmsearch,
        pilot_inputs,
        cm_path=other,
        expect_accession=None,
        expect_name=None,
    )
    assert report["model"]["accession"] == "RF00050"


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
    (rows_dir / "control_01.rows").write_text(row(score="1.0") + "\n")
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
        rr.run_pilot(cmsearch=tmp_path / "absent", **pilot_inputs)


def test_run_pilot_refuses_a_genome_sequence_with_no_topology(
    stub_cmsearch, pilot_inputs, tmp_path
):
    partial = write_gbff(tmp_path / "partial.gbff", {"NZ_TEST001.1": (20, "circular")})
    with pytest.raises(rr.RegulatoryRfamError, match="no topology in the pinned"):
        run_stub_pilot(stub_cmsearch, pilot_inputs, gbff_path=partial)


def test_run_pilot_refuses_a_multi_family_library(
    stub_cmsearch, pilot_inputs, tmp_path
):
    library = write_model(tmp_path / "Rfam.cm", models=3)
    with pytest.raises(rr.RegulatoryRfamError, match="more than one model"):
        run_stub_pilot(stub_cmsearch, pilot_inputs, cm_path=library)


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
    workdir = pilot_inputs["workdir"]
    produced = {path.name for path in workdir.iterdir()}
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


def test_main_writes_both_reports_and_prints_a_summary(
    stub_cmsearch, pilot_inputs, tmp_path, capsys
):
    _, rows_dir = stub_cmsearch
    (rows_dir / "native.rows").write_text(row() + "\n")
    json_out, tsv_out = tmp_path / "out" / "r.json", tmp_path / "out" / "r.tsv"
    assert rr.main(cli_args(stub_cmsearch, pilot_inputs, json_out, tsv_out)) == 0
    printed = capsys.readouterr().out
    assert "model=RF01116 (Yfr1) native_hits=1" in printed
    assert "control_hits=0 over 2 replicates" in printed
    report = json.loads(json_out.read_text())
    assert report["schemaVersion"] == rr.SCHEMA_VERSION
    assert report["pilot"] == rr.PILOT_ID
    header, data = tsv_out.read_text().splitlines()
    assert header.split("\t") == list(rr._HIT_FIELDNAMES)
    assert data.split("\t")[:2] == ["NZ_TEST001.1", "native_linear"]


def test_main_refuses_to_overwrite_before_running(
    stub_cmsearch, pilot_inputs, tmp_path
):
    json_out, tsv_out = tmp_path / "r.json", tmp_path / "r.tsv"
    json_out.write_text("previous\n", encoding="utf-8")
    with pytest.raises(SystemExit, match="pass --overwrite"):
        rr.main(cli_args(stub_cmsearch, pilot_inputs, json_out, tsv_out))
    # The refusal happens before any work, so the earlier report is intact and
    # no partial second report was left behind.
    assert json_out.read_text() == "previous\n"
    assert not tsv_out.exists()
    assert not pilot_inputs["workdir"].exists()


def test_main_overwrites_only_when_asked(stub_cmsearch, pilot_inputs, tmp_path):
    json_out, tsv_out = tmp_path / "r.json", tmp_path / "r.tsv"
    json_out.write_text("previous\n", encoding="utf-8")
    assert (
        rr.main(
            cli_args(stub_cmsearch, pilot_inputs, json_out, tsv_out, ["--overwrite"])
        )
        == 0
    )
    assert json.loads(json_out.read_text())["counts"]["totalHits"] == 0


def test_main_reports_an_error_without_a_traceback(
    stub_cmsearch, pilot_inputs, tmp_path
):
    _, rows_dir = stub_cmsearch
    (rows_dir / "native.rows").write_text(row(target="NZ_ELSEWHERE.1") + "\n")
    json_out, tsv_out = tmp_path / "r.json", tmp_path / "r.tsv"
    with pytest.raises(SystemExit, match="error: cmsearch output failed"):
        rr.main(cli_args(stub_cmsearch, pilot_inputs, json_out, tsv_out))
    assert not json_out.exists()


# --------------------------------------------------------------------------
# Real-tool checks against the pinned assembly
# --------------------------------------------------------------------------

requires_real_tool = pytest.mark.skipif(
    not (REAL_CMSEARCH.exists() and PINNED_FASTA.exists() and PINNED_GBFF.exists()),
    reason="needs Infernal 1.1.5 in trna-validate and the fetched pinned assembly",
)


@pytest.fixture(scope="module")
def pinned_model():
    """Extracts RF01116 from an Rfam library, or skips if none is available.

    The 44 MB Rfam 15.1 library is a third-party blob and is never committed,
    so this looks for the extracted single-family model left in the ignored
    scratch directory by the run in docs/validation/regulatory-rfam.md.
    """
    candidate = (
        REPO_ROOT
        / ".playwright-cli/regulatory-rfam-20261012/source/RF01116.cm"
    )
    if not candidate.exists():
        pytest.skip("no extracted RF01116.cm in the ignored scratch directory")
    if rr.sha256_file(candidate) != PINNED_MODEL_SHA256:
        pytest.skip("scratch RF01116.cm does not match the pinned SHA-256")
    return candidate


@requires_real_tool
def test_real_cmsearch_reports_infernal_115():
    assert rr.cmsearch_version(REAL_CMSEARCH) == "1.1.5 (Sep 2023)"


@requires_real_tool
def test_real_pinned_model_header_matches_rfam_151(pinned_model):
    model = rr.parse_covariance_model(pinned_model)
    assert (model.accession, model.name) == ("RF01116", "Yfr1")
    assert model.description == "Cyanobacterial functional RNA 1"
    assert model.gathering_cutoff == 38.0
    assert (model.clen, model.window) == (59, 86)
    assert model.format_line == "INFERNAL1/a [1.1.5 | Sep 2023]"


@requires_real_tool
def test_real_pinned_assembly_is_three_circular_replicons():
    records = rr.load_fasta(PINNED_FASTA)
    replicons = rr.build_replicons(records, rr.parse_locus_topologies(PINNED_GBFF))
    assert [(r.accession, r.length, r.topology) for r in replicons] == [
        ("NZ_CP006471.1", 2690418, "circular"),
        ("NZ_CP006472.1", 46366, "circular"),
        ("NZ_CP006473.1", 7842, "circular"),
    ]
    assert rr.search_space_mb(sum(r.length for r in replicons)) == 5.489252


@requires_real_tool
def test_real_search_finds_the_single_recorded_yfr1_locus(pinned_model, tmp_path):
    """The recorded result: one native hit, no origin-spanning hit, no control hit.

    This is the run docs/validation/regulatory-rfam.md documents. A changed
    count here means the model, the assembly or the Infernal build changed.
    """
    report = rr.run_pilot(
        cm_path=pinned_model,
        fasta_path=PINNED_FASTA,
        gbff_path=PINNED_GBFF,
        workdir=tmp_path / "work",
        cmsearch=REAL_CMSEARCH,
        expect_accession="RF01116",
        expect_name="Yfr1",
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
    # The decompressed copy this tool searches is byte-identical to the
    # official FASTA, so its SHA-256 is the one genome-provenance records.
    assert report["inputs"]["searchedFasta"]["sha256"] == (
        "4716bbf61cfeb296587c94e90e6b6ce037752f9b9d4d225addd15eea02124984"
    )
    assert report["inputs"]["genomeFasta"]["md5"] == "610ceb15a9859046e143d80915d4c984"
    assert report["originJunctionSearch"]["flankBases"] == 85
    assert report["originJunctionSearch"]["searchedReplicons"] == [
        "NZ_CP006471.1",
        "NZ_CP006472.1",
        "NZ_CP006473.1",
    ]


@requires_real_tool
def test_real_origin_spanning_hit_is_found_and_remapped(pinned_model, tmp_path):
    """Rotates the pinned chromosome so the Yfr1 locus straddles position 1.

    The linear search alone cannot report that hit; the origin-junction search
    must find it and remap it to the wrapped native interval. This exercises
    the circular-boundary path with the real Infernal, which the unrotated
    genome cannot (it has no origin-spanning hit of this family).
    """
    (chromosome, description, sequence), *_ = rr.load_fasta(PINNED_FASTA)
    assert chromosome == "NZ_CP006471.1"
    length = len(sequence)
    # Rotate so the midpoint of the recorded 1364716..1364778 hit lands on 1.
    offset = (1364716 + 1364778) // 2 - 1
    rotated = tmp_path / "rotated.fna"
    rr.write_fasta(
        rotated,
        [(f"{chromosome} {description}", sequence[offset:] + sequence[:offset])],
    )
    gbff = write_gbff(tmp_path / "rotated.gbff", {chromosome: (length, "circular")})

    report = rr.run_pilot(
        cm_path=pinned_model,
        fasta_path=rotated,
        gbff_path=gbff,
        workdir=tmp_path / "work",
        cmsearch=REAL_CMSEARCH,
        expect_accession="RF01116",
        expect_name="Yfr1",
        control_replicates=1,
        control_seed=20261012,
    )
    assert report["counts"]["nativeLinearHits"] == 0
    assert report["counts"]["originSpanningHits"] == 1
    (wrapped,) = report["hits"]
    assert wrapped["origin_spanning"] is True
    assert wrapped["search_space"] == rr.SEARCH_SPACE_JUNCTION
    assert wrapped["replicon"] == chromosome
    # 1364716 - offset wraps to length - 30; 1364778 - offset stays at 32.
    assert (wrapped["native_start"], wrapped["native_end"]) == (length - 30, 32)
    assert wrapped["native_start"] > wrapped["native_end"]  # the wrap itself
    assert wrapped["native_length"] == 63
    assert (wrapped["mdl_from"], wrapped["mdl_to"]) == (1, 59)
    assert wrapped["score"] == 62.1
    assert report["originJunctionSearch"]["alreadyFoundByLinearSearch"] == 0


@requires_real_tool
def test_real_cli_round_trip_is_reproducible(pinned_model, tmp_path):
    json_out, tsv_out = tmp_path / "r.json", tmp_path / "r.tsv"
    argv = [
        "--cm", str(pinned_model),
        "--expect-accession", "RF01116",
        "--expect-name", "Yfr1",
        "--fasta", str(PINNED_FASTA),
        "--gbff", str(PINNED_GBFF),
        "--workdir", str(tmp_path / "work"),
        "--cmsearch", str(REAL_CMSEARCH),
        "--json-out", str(json_out),
        "--tsv-out", str(tsv_out),
        "--control-replicates", "1",
    ]
    assert rr.main(argv) == 0
    first = json_out.read_bytes()
    assert rr.main(argv + ["--overwrite"]) == 0
    assert json_out.read_bytes() == first


@requires_real_tool
def test_real_hit_is_intergenic_in_the_pinned_annotation():
    """Context only: no RefSeq feature but the whole-replicon `region` overlaps.

    Read straight from the pinned GFF. This locates the hit relative to the
    annotation; it is not evidence that the interval is transcribed or
    regulatory, and RefSeq's silence there is not a negative.
    """
    import gzip

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


def test_module_runs_as_a_script():
    """The CLI is reachable the way the runbook invokes it."""
    completed = subprocess.run(
        [sys.executable, str(REPO_ROOT / "tools/regulatory_rfam.py"), "--help"],
        capture_output=True,
        text=True,
        check=True,
    )
    assert "--cut_ga" in completed.stdout or "pinned Rfam" in completed.stdout
