"""Tests for the four Tan 2018 Table S1 condition TSS-initiation layers."""

from __future__ import annotations

import hashlib
import json
import sys
from fractions import Fraction
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts import prepare_tan2018  # noqa: E402
from tools import tan2018_condition_initiation as layers  # noqa: E402
from tools import tan2018_pooled_audit as pooled_audit  # noqa: E402

EXTRACT = layers.EXTRACT.read_bytes()
TARGETS = pooled_audit.target_loci(layers.GENES)
SOURCES = json.loads(layers.SOURCES.read_text(encoding="utf-8"))
BY_ID = {source["id"]: source for source in SOURCES}
CONTROL, DARK, HIGH_LIGHT, HIGH_TEMPERATURE = layers.CONDITIONS


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# --- Synthetic extract -------------------------------------------------------

HEADER = "\t".join(prepare_tan2018.OUTPUT_COLUMNS)


def line(tss_id: str, locus: str, counts: tuple[str, ...], position: str = "100",
         kind: str = "gTSS") -> str:
    """One extract row; ``counts`` are CT1, CT2, D1, D2, HL1, HL2, HT1, HT2."""
    return "\t".join([tss_id, "CP006471", kind, "+", position, locus, "10", *counts,
                      "1.0", "0.5", "-1.0", "0.01", "0", "1"])


ROWS = [
    line("gTSS+300", "M744_RS00001", ("10", "20", "0", "1", "2.5", "0", "4", "4"), "300"),
    line("gTSS+100", "M744_RS00001", ("1", "2", "0", "0", "0.5", "0", "1", "1"), "100"),
    # Every replicate zero: the gene scores 0, not unknown.
    line("gTSS+500", "M744_RS00002", ("0",) * 8, "500"),
    line("gTSS+700", "M744_RS99999", ("9",) * 8, "700"),  # Not a current gene.
    line("gTSS+800", "petN", ("9",) * 8, "800"),  # A symbol, never resolved.
    line("gTSS+900", "", ("9",) * 8, "900"),  # No locus.
]
SYNTHETIC_TARGETS = ("M744_RS00001", "M744_RS00002", "M744_RS00003")


def extract(rows: list[str] | None = None, header: str = HEADER, end: str = "\n") -> bytes:
    rows = ROWS if rows is None else rows
    return end.join([header, *rows]).encode("utf-8") + end.encode()


def read(data: bytes, rows: int | None = None) -> list[layers.Row]:
    return layers.read_extract(data, sha(data), len(ROWS) if rows is None else rows)


def test_a_layer_sums_each_genes_two_replicate_means_and_keeps_fractions():
    by_locus, reasons = layers.associate(read(extract()), SYNTHETIC_TARGETS)
    assert reasons == {
        "exact_current_locus_id": 3,
        "source_locus_absent_from_current_cds": 1,
        "source_locus_not_current_id": 1,
        "source_locus_missing": 1,
    }
    assert list(by_locus) == ["M744_RS00001", "M744_RS00002"]  # RS00003 stays unknown.
    first = by_locus["M744_RS00001"]
    assert layers.condition_value(first, CONTROL) == Fraction(33, 2)  # 15 + 1.5
    assert layers.condition_value(first, DARK) == Fraction(1, 2)
    assert layers.condition_value(first, HIGH_LIGHT) == Fraction(3, 2)  # 1.25 + 0.25
    assert layers.condition_value(first, HIGH_TEMPERATURE) == 5
    assert all(layers.condition_value(by_locus["M744_RS00002"], c) == 0
               for c in layers.CONDITIONS)


def test_a_layer_table_lists_zero_genes_and_omits_unknown_ones():
    by_locus, _ = layers.associate(read(extract()), SYNTHETIC_TARGETS)
    assert layers.layer_table(by_locus, HIGH_LIGHT) == (
        b"locus_tag\tabundance\tsource_gene_id\n"
        b"M744_RS00001\t1.500000\tgTSS+100;gTSS+300\n"
        b"M744_RS00002\t0.000000\tgTSS+500\n"
    )


def test_only_an_exact_current_locus_tag_joins():
    targets = {"M744_RS00001"}
    assert layers.mapping_reason("M744_RS00001", targets) == "exact_current_locus_id"
    assert layers.mapping_reason("M744_RS00002", targets) == "source_locus_absent_from_current_cds"
    assert layers.mapping_reason("m744_rs00001", targets) == "source_locus_not_current_id"
    assert layers.mapping_reason("M744_RS00001 ", targets) == "source_locus_not_current_id"
    assert layers.mapping_reason("psbA", targets) == "source_locus_not_current_id"
    assert layers.mapping_reason("", targets) == "source_locus_missing"


@pytest.mark.parametrize(("data", "message"), [
    (extract(header=HEADER.replace("control_2", "control_1")), "header"),
    (extract(end="\r\n"), "LF-terminated"),
    (extract()[:-1], "LF-terminated"),
    (extract([ROWS[0] + "\textra", *ROWS[1:]]), "has 22 fields"),
    (extract([ROWS[0].rsplit("\t", 1)[0], *ROWS[1:]]), "has 20 fields"),
    (extract([line("aTSS+1", "M744_RS00001", ("1",) * 8, kind="aTSS"), *ROWS[1:]]),
     "not gTSS"),
    (extract([ROWS[0], ROWS[0], *ROWS[2:]]), r"repeats gTSS\+300"),
    (extract([line("gTSS+1", "M744_RS00001", ("1",) * 8, "1.5"), *ROWS[1:]]), "position"),
    (extract([line("gTSS+1", "M744_RS00001", ("",) + ("1",) * 7), *ROWS[1:]]),
     "control_1 must be a non-negative count, not ''"),
    (extract([line("gTSS+1", "M744_RS00001", ("1", "-2") + ("1",) * 6), *ROWS[1:]]),
     "control_2 must be a non-negative count"),
    (extract([line("gTSS+1", "M744_RS00001", ("1",) * 7 + ("1e3",)), *ROWS[1:]]),
     "high_temperature_2 must be a non-negative count"),
    (extract([line("gTSS+1", "M744_RS00001", ("9" * 5000,) + ("1",) * 7), *ROWS[1:]]),
     "control_1 must be a non-negative count"),
])
def test_a_malformed_extract_is_refused(data: bytes, message: str):
    with pytest.raises(ValueError, match=message):
        read(data)


def test_the_extract_is_refused_on_a_checksum_or_row_count_mismatch():
    with pytest.raises(ValueError, match="checksum mismatch"):
        layers.read_extract(extract(), "0" * 64, len(ROWS))
    with pytest.raises(ValueError, match="has 6 gTSS rows, not 7"):
        read(extract(), rows=7)
    with pytest.raises(ValueError, match="checksum mismatch"):
        layers.read_extract(extract())  # Defaults pin the shipped extract.


def test_a_value_that_does_not_fit_six_decimals_is_refused():
    assert layers.decimal_text(Fraction(1, 4)) == "0.250000"
    with pytest.raises(ValueError, match="not exact at six decimals"):
        layers.decimal_text(Fraction(1, 3))


def test_check_refuses_a_missing_or_changed_table(tmp_path: Path):
    tables = {"a.tsv": b"x\n"}
    with pytest.raises(ValueError, match="is missing"):
        layers.check_tables(tables, tmp_path)
    (tmp_path / "a.tsv").write_bytes(b"y\n")
    with pytest.raises(ValueError, match="differs from the rebuild"):
        layers.check_tables(tables, tmp_path)
    (tmp_path / "a.tsv").write_bytes(b"x\n")
    layers.check_tables(tables, tmp_path)


def test_check_refuses_a_manifest_that_misdeclares_a_layer():
    tables = layers.build(EXTRACT, TARGETS)
    layers.check_manifest(SOURCES, tables)
    without = [s for s in SOURCES if s["id"] != "TAN2018_TSS_DARK"]
    with pytest.raises(ValueError, match="lacks TAN2018_TSS_DARK"):
        layers.check_manifest(without, tables)
    for key, value in (("sha256", "0" * 64), ("quantity", None), ("metricKey", "tssDark"),
                       ("file", "dark.tsv")):
        changed = [dict(s, **{key: value}) if s["id"] == "TAN2018_TSS_DARK" else s
                   for s in SOURCES]
        with pytest.raises(ValueError, match=f"TAN2018_TSS_DARK {key}"):
            layers.check_manifest(changed, tables)


# --- Synthetic workbook and article -----------------------------------------


def workbook_with(path: Path, header: tuple, rows: list[tuple]) -> Path:
    from openpyxl import Workbook

    book = Workbook(write_only=True)
    sheet = book.create_sheet("Table S1")
    sheet.append(["Table S1. All information of each identified TSS "])
    sheet.append(list(header))
    for row in rows:
        sheet.append(list(row))
    book.save(path)
    return path


def workbook_row(index: int, locus: str = "M744_RS00001") -> tuple:
    by_name = {
        "TSS_ID": f"gTSS+{index}", "Chromosome": "CP006471", "Type": "gTSS", "Strand": "+",
        "TSS_position": index, "Distances to start codon": 5, "Locus_tags": locus,
        "CT1_RawReads": index, "CT2_RawReads": 1, "D1_RawReads": 0, "D2_RawReads": 0.5,
        "HL1_RawReads": 2, "HL2_RawReads": 3, "HT1_RawReads": 4, "HT2_RawReads": 5,
        "DK_vs_CT_log2FoldChange": 1.5, "DK_vs_CT_padj": 0.01,
        "HL_vs_CT_log2FoldChange": -1.5, "HL_vs_CT_padj": 0.02,
        "HT_vs_CT_log2FoldChange": 0.5, "HT_vs_CT_padj": 0.5,
    }
    return tuple(by_name.get(name) for name in layers.WORKBOOK_HEADER)


def synthetic_workbook(tmp_path: Path, monkeypatch, header: tuple = layers.WORKBOOK_HEADER
                       ) -> tuple[Path, bytes]:
    """A 2,475-row workbook, its checksum pinned, and the extract it should yield."""
    path = workbook_with(tmp_path / "s1.xlsx", header,
                         [workbook_row(i) for i in range(1, 2476)])
    monkeypatch.setattr(prepare_tan2018, "SOURCE_SHA256", sha(path.read_bytes()))
    out = tmp_path / "extract.tsv"
    if header == layers.WORKBOOK_HEADER:
        prepare_tan2018.write_table(path, out)
    return path, out.read_bytes() if out.exists() else b""


def test_the_workbook_check_rebuilds_the_extract_from_the_pinned_columns(tmp_path, monkeypatch):
    path, expected = synthetic_workbook(tmp_path, monkeypatch)
    pin = sha(path.read_bytes())
    layers.verify_workbook(path, expected, pin)
    with pytest.raises(ValueError, match="do not reproduce the pinned extract"):
        layers.verify_workbook(path, expected.replace(b"\t0.5\t", b"\t0\t", 1), pin)
    with pytest.raises(ValueError, match="checksum mismatch"):
        layers.verify_workbook(path, expected)  # The real pin refuses it.
    with pytest.raises(ValueError, match="is missing"):
        layers.verify_workbook(tmp_path / "absent.xlsx", expected, pin)


def test_the_workbook_check_refuses_a_moved_replicate_column(tmp_path, monkeypatch):
    header = list(layers.WORKBOOK_HEADER)
    first, second = header.index("CT1_RawReads"), header.index("CT2_RawReads")
    header[first], header[second] = header[second], header[first]
    path, _ = synthetic_workbook(tmp_path, monkeypatch, tuple(header))
    with pytest.raises(ValueError, match="Table S1 header is"):
        layers.verify_workbook(path, b"", sha(path.read_bytes()))


def test_the_article_check_needs_both_licence_lines(tmp_path):
    complete = f"<article><p>{layers.LICENCE_QUOTES[0]} (x). {layers.LICENCE_QUOTES[1]}</p></article>"
    path = tmp_path / "article.xml"
    path.write_text(complete, encoding="utf-8")
    layers.verify_article(path, sha(path.read_bytes()))
    path.write_text(complete.replace("Dedication waiver", "waiver"), encoding="utf-8")
    with pytest.raises(ValueError, match="the article lacks: The Creative Commons Public"):
        layers.verify_article(path, sha(path.read_bytes()))
    with pytest.raises(ValueError, match="checksum mismatch"):
        layers.verify_article(path)
    with pytest.raises(ValueError, match="is missing"):
        layers.verify_article(tmp_path / "absent.xml")


# --- The shipped layers ------------------------------------------------------

SHIPPED = {condition.file: (layers.EXPRESSION / condition.file).read_bytes()
           for condition in layers.CONDITIONS}


def values(condition: layers.Condition) -> dict[str, tuple[str, str]]:
    lines = SHIPPED[condition.file].decode("ascii").splitlines()[1:]
    return {cells[0]: (cells[1], cells[2]) for cells in (row.split("\t") for row in lines)}


def test_the_committed_layers_are_the_rebuild_and_the_legacy_table_is_untouched():
    assert layers.build(EXTRACT, TARGETS) == SHIPPED
    assert sha(EXTRACT) == layers.EXTRACT_SHA256
    assert sha(pooled_audit.POOLED.read_bytes()) == pooled_audit.POOLED_SHA256
    for data in SHIPPED.values():
        assert b"\r" not in data and data.startswith(b"locus_tag\tabundance\tsource_gene_id\n")


def test_shipped_coverage_and_mapping_counts():
    summary = layers.summary(EXTRACT, TARGETS)
    assert summary["rows"] == 2475
    assert summary["rowsByMappingReason"] == {
        "exact_current_locus_id": 2432,
        "source_locus_absent_from_current_cds": 33,
        "source_locus_not_current_id": 10,
    }
    assert (summary["genesWithValue"], summary["targetsWithoutValue"]) == (1789, 926)
    assert summary["maxRowsPerGene"] == 20
    assert {k: (v["genes"], v["zeroGenes"], v["fractionalGenes"], v["zeroRows"])
            for k, v in summary["layers"].items()} == {
        "TAN2018_TSS_CONTROL": (1789, 0, 889, 0),
        "TAN2018_TSS_DARK": (1789, 0, 882, 3),
        "TAN2018_TSS_HIGH_LIGHT": (1789, 0, 899, 1),
        "TAN2018_TSS_HIGH_TEMPERATURE": (1789, 0, 904, 0),
    }


@pytest.mark.parametrize(("locus", "expected"), [
    # One upstream gTSS the legacy pool dropped: Table S1 CT 635/764, D 148/177,
    # HL 295/437, HT 703/320.
    ("M744_RS00030", ("699.500000", "162.500000", "366.000000", "511.500000")),
    # Three gTSS, one with fractional high-light counts (574.5, 472.5).
    ("M744_RS09190", ("982.000000", "10.500000", "7502.000000", "51.500000")),
    # A reverse-strand gene whose gTSS the legacy pool kept.
    ("M744_RS00020", ("670.000000", "27.000000", "2481.500000", "358.000000")),
])
def test_representative_values(locus: str, expected: tuple[str, ...]):
    assert tuple(values(c)[locus][0] for c in layers.CONDITIONS) == expected


def test_a_gene_without_a_mapped_gtss_is_unknown_in_every_layer_not_zero():
    payload = json.loads((ROOT / "site/data/expression_layers.json").read_text())
    index = payload["geneIds"].index("M744_RS00010")  # Has a legacy pooled score only.
    for condition in layers.CONDITIONS:
        assert "M744_RS00010" not in values(condition)
        assert payload["layers"][condition.metric_key][index] is None
    assert sum(value is None for value in payload["layers"]["tssInitiationDark"]) == 926


def test_the_layers_differ_from_the_legacy_pool_and_do_not_average_to_it():
    legacy = {row.split("\t")[0]: Fraction(row.split("\t")[1])
              for row in pooled_audit.POOLED.read_text().splitlines()[1:]}
    mean = {locus: sum(Fraction(values(c)[locus][0]) for c in layers.CONDITIONS) / 4
            for locus in values(CONTROL)}
    assert (len(legacy), len(mean), len(set(legacy) & set(mean))) == (1727, 1789, 1317)
    assert mean["M744_RS00025"] == Fraction("167.875") != legacy["M744_RS00025"] == 208
    assert mean["M744_RS00020"] == legacy["M744_RS00020"] == Fraction("884.125")


def test_the_layers_match_the_independently_built_site_evidence():
    evidence = json.loads((ROOT / "site/data/tss_evidence.json").read_text())
    keys = {"control": "control", "dark": "dark", "high_light": "highLight",
            "high_temperature": "highTemperature"}
    for condition in layers.CONDITIONS:
        shipped = values(condition)
        assert set(shipped) == set(evidence)
        for locus, sites in evidence.items():
            value = sum(Fraction(s["rawReads"][keys[condition.name]][0])
                        + Fraction(s["rawReads"][keys[condition.name]][1]) for s in sites) / 2
            assert Fraction(shipped[locus][0]) == value, (condition.name, locus)
            ids = sorted(sites, key=lambda s: (s["position"], s["id"]))
            assert shipped[locus][1] == ";".join(s["id"] for s in ids)


def test_the_payload_carries_each_layer_value_for_its_gene():
    payload = json.loads((ROOT / "site/data/expression_layers.json").read_text())
    for condition in layers.CONDITIONS:
        column = payload["layers"][condition.metric_key]
        by_gene = dict(zip(payload["geneIds"], column))
        assert {k: v for k, v in by_gene.items() if v is not None} == {
            locus: float(value) for locus, (value, _) in values(condition).items()}


def test_each_layer_is_an_independent_unpooled_initiation_source():
    meta = json.loads((ROOT / "site/data/meta.json").read_text())
    emitted = {s["id"]: s for s in meta["expressionSources"]}
    groups = {"control": "other", "dark": "stress", "high_light": "elevated",
              "high_temperature": "stress"}
    for condition in layers.CONDITIONS:
        source = BY_ID[condition.source_id]
        assert source["record"]["group"] == groups[condition.name]
        assert source["record"]["platform"] == "RNA-seq"
        assert source["record"]["replicates"]["count"] == 2
        assert source["conditionLayer"] == {
            "condition": condition.name,
            "replicates": list(condition.replicates),
            "siteSet": "Table S1 gTSS rows joined by exact current locus tag",
        }
        assert source["payload"] == "expression_layers.json"
        assert "unknown, not zero" in source["caveat"]
        assert "do not average to it" in source["caveat"]
        facts = emitted[condition.source_id]
        assert (facts["quantity"], facts["quantityKind"], facts["quantityPools"]) == (
            "tss_initiation", "initiation", False)
        assert facts["quantityBounds"] == {
            "nonnegative": True, "integral": False, "unitInterval": False}
        assert facts["coverage"] == {"withValue": 1789, "total": 2715}
    assert "30 min (Methods) and 2 h (Results)" in BY_ID["TAN2018_TSS_HIGH_LIGHT"]["caveat"]
    assert BY_ID["TAN2018_TSS_HIGH_LIGHT"]["record"]["conditions"]["lightRegime"][
        "status"] == "conflicting"
    assert BY_ID["TAN2018_TSS_HIGH_TEMPERATURE"]["record"]["conditions"]["lightIntensity"][
        "status"] == "conflicting"
    legacy = BY_ID["TAN2018_TSS"]
    assert legacy["caveat"].startswith("Legacy layer.")
    assert "recovered, not documented" in legacy["caveat"]


def test_the_replicate_columns_are_the_extract_and_workbook_pairing():
    pairing = dict(zip(prepare_tan2018.SOURCE_COLUMNS, prepare_tan2018.OUTPUT_COLUMNS))
    for condition in layers.CONDITIONS:
        assert tuple(pairing[c] for c in condition.workbook_columns) == condition.columns
        assert set(condition.workbook_columns) <= set(layers.WORKBOOK_HEADER)


# --- Command line ------------------------------------------------------------


def test_write_then_check_round_trips_and_check_names_a_tampered_table(tmp_path, capsys):
    assert layers.main(["write", "--out-dir", str(tmp_path)]) == 0
    assert {p.name: p.read_bytes() for p in tmp_path.iterdir()} == SHIPPED
    assert layers.main(["check", "--out-dir", str(tmp_path)]) == 0
    (tmp_path / DARK.file).write_bytes(SHIPPED[DARK.file].replace(b"\n", b"\r\n"))
    assert layers.main(["check", "--out-dir", str(tmp_path)]) == 1
    assert "differs from the rebuild" in capsys.readouterr().err


def test_summary_and_a_missing_workbook_through_the_command_line(tmp_path, capsys):
    assert layers.main(["summary"]) == 0
    assert json.loads(capsys.readouterr().out)["genesWithValue"] == 1789
    assert layers.main(["verify-source", "--workbook", str(tmp_path / "none.xlsx")]) == 1
    assert "run `tan2018_condition_initiation.py fetch` first" in capsys.readouterr().err


@pytest.mark.skipif(not layers.WORKBOOK.is_file(), reason="run `fetch` for the pinned workbook")
def test_the_pinned_workbook_reproduces_the_extract():
    layers.verify_workbook(layers.WORKBOOK, EXTRACT)


@pytest.mark.skipif(not pooled_audit.ARTICLE.is_file(),
                    reason="run `tan2018_pooled_audit.py fetch` for the pinned article")
def test_the_pinned_article_states_the_licence():
    layers.verify_article(pooled_audit.ARTICLE)
