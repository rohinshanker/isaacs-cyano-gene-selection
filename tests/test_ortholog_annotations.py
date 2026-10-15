"""Tests for ``tools/ortholog_annotations.py``.

The source table is returned evidence, so the reader may change exactly one thing
in it: the `%2C` escape in product text. These tests hold the decoding to that,
hold the pin and schema refusals in place, and check the real table cell by cell.
"""

from __future__ import annotations

import hashlib
import importlib.util
import shutil
import sys
from pathlib import Path

import pytest

_SPEC = importlib.util.spec_from_file_location(
    "ortholog_annotations",
    Path(__file__).resolve().parents[1] / "tools" / "ortholog_annotations.py",
)
assert _SPEC and _SPEC.loader
orthologs = importlib.util.module_from_spec(_SPEC)
sys.modules["ortholog_annotations"] = orthologs
_SPEC.loader.exec_module(orthologs)

Error = orthologs.OrthologTableError
HEADER = "\t".join(orthologs.COLUMNS)


def _row(tag: str = "M744_RS00005", product: str = "protein") -> str:
    cells = [tag, "M744_00005", "WP_1.1", product, "K1", "1",
             "yes", "yes", "yes", "1", "ko_assigned", "transferred"]
    return "\t".join(cells)


def _table(*rows: str) -> str:
    return "\n".join((HEADER,) + rows) + "\n"


# --------------------------------------------------------------------------
# decoding
# --------------------------------------------------------------------------


@pytest.mark.parametrize(("raw", "decoded"), [
    ("ribbon-helix-helix protein%2C CopG family",
     "ribbon-helix-helix protein, CopG family"),
    ("2%2c3-bisphosphoglycerate", "2,3-bisphosphoglycerate"),
    ("a%2Cb%2cc", "a,b,c"),
    ("metallophosphoesterase", "metallophosphoesterase"),
    ("", ""),
    ("NAD(P)+ transhydrogenase", "NAD(P)+ transhydrogenase"),
    ("100%252C", "100%252C"),
    ("50%25 identity%3B %2F%20", "50%25 identity%3B %2F%20"),
    ("%2", "%2"),
    ("%%2C", "%,"),
])
def test_decode_product_changes_only_the_comma_escape_once(raw, decoded):
    assert orthologs.decode_product(raw) == decoded


def test_a_row_keeps_its_raw_product_beside_the_decoded_one():
    row = orthologs.parse_table(_table(_row(product="D%2CD-transpeptidase")))[0]
    assert row.locus_tag == "M744_RS00005"
    assert row.raw_product == "D%2CD-transpeptidase"
    assert row.product == "D,D-transpeptidase"
    assert row.decoded_cells()[orthologs.PRODUCT] == "D,D-transpeptidase"
    assert row.decoded_cells()[:3] == row.cells[:3]
    assert row.decoded_cells()[4:] == row.cells[4:]


# --------------------------------------------------------------------------
# schema, rows and identifiers
# --------------------------------------------------------------------------


def test_parse_table_keeps_row_order_and_accepts_an_empty_body():
    rows = orthologs.parse_table(
        _table(_row("M744_RS00010"), _row("M744_RS00005")))
    assert [row.locus_tag for row in rows] == ["M744_RS00010", "M744_RS00005"]
    assert orthologs.parse_table(_table()) == []


@pytest.mark.parametrize(("text", "message"), [
    (_table(_row())[:-1], "end with a newline"),
    ("", "end with a newline"),
    (_table(_row()).replace("product", "Product", 1), "unexpected header"),
    (_table(_row()).replace(HEADER, HEADER + "\textra"), "unexpected header"),
    (_table(_row()).replace("\n", "\r\n"), "unexpected header"),
    (_table(_row() + "\textra"), "13 fields"),
    (_table(_row().rsplit("\t", 1)[0]), "11 fields"),
    (_table(_row(), ""), "line 3: 1 fields"),
    (_table(_row(tag="")), "malformed locus tag"),
    (_table(_row(tag="M744_00005")), "malformed locus tag"),
    (_table(_row(tag="M744_RS00005 ")), "malformed locus tag"),
    (_table(_row(), _row()), "line 3: repeated locus tag M744_RS00005"),
])
def test_parse_table_refuses_schema_row_and_identifier_errors(text, message):
    with pytest.raises(Error, match=message):
        orthologs.parse_table(text)


# --------------------------------------------------------------------------
# pin and output safety
# --------------------------------------------------------------------------


def test_read_table_refuses_bytes_that_differ_from_the_pin(tmp_path):
    copy = tmp_path / "copy.tsv"
    copy.write_bytes(orthologs.SOURCE.read_bytes().replace(b"%2C", b",", 1))
    with pytest.raises(Error, match="does not match the pin"):
        orthologs.read_table(copy)


def test_read_table_accepts_an_identical_copy(tmp_path):
    copy = tmp_path / "copy.tsv"
    shutil.copyfile(orthologs.SOURCE, copy)
    assert orthologs.read_table(copy) == orthologs.read_table()


def test_write_table_never_replaces_an_existing_file(tmp_path):
    rows = orthologs.parse_table(_table(_row(product="a%2Cb")))
    out = tmp_path / "out.tsv"
    out.write_text("keep", encoding="utf-8")
    with pytest.raises(FileExistsError):
        orthologs.write_table(rows, out)
    assert out.read_text(encoding="utf-8") == "keep"


def test_write_table_writes_header_and_decoded_rows(tmp_path):
    rows = orthologs.parse_table(_table(_row(product="a%2Cb+c")))
    out = tmp_path / "out.tsv"
    orthologs.write_table(rows, out)
    assert out.read_text(encoding="utf-8") == _table(_row(product="a,b+c"))


def test_cli_writes_the_derivative(tmp_path, capsys):
    out = tmp_path / "decoded.tsv"
    assert orthologs.main(["--out", str(out)]) == 0
    assert "2715 rows, 46 products decoded" in capsys.readouterr().out
    assert out.exists()


def test_cli_reads_an_identical_copy(tmp_path):
    copy = tmp_path / "copy.tsv"
    shutil.copyfile(orthologs.SOURCE, copy)
    out = tmp_path / "decoded.tsv"
    assert orthologs.main(["--source", str(copy), "--out", str(out)]) == 0
    assert out.exists()


def test_cli_writes_nothing_when_the_pin_fails(tmp_path, capsys):
    copy = tmp_path / "copy.tsv"
    copy.write_bytes(orthologs.SOURCE.read_bytes() + b"\n")
    out = tmp_path / "decoded.tsv"
    assert orthologs.main(["--source", str(copy), "--out", str(out)]) == 1
    assert "does not match the pin" in capsys.readouterr().err
    assert not out.exists()


@pytest.mark.parametrize("make", ["existing", "missing-parent", "source"])
def test_cli_reports_output_errors_without_writing(tmp_path, capsys, make):
    out = {
        "existing": tmp_path / "decoded.tsv",
        "missing-parent": tmp_path / "absent" / "decoded.tsv",
        "source": orthologs.SOURCE,
    }[make]
    if make == "existing":
        out.write_text("keep", encoding="utf-8")
    before = out.read_bytes() if out.exists() else None
    assert orthologs.main(["--out", str(out)]) == 1
    assert capsys.readouterr().err.startswith("error: ")
    assert (out.read_bytes() if out.exists() else None) == before


def test_cli_reports_a_missing_source(tmp_path, capsys):
    out = tmp_path / "decoded.tsv"
    assert orthologs.main(
        ["--source", str(tmp_path / "absent.tsv"), "--out", str(out)]) == 1
    assert capsys.readouterr().err.startswith("error: ")
    assert not out.exists()


def test_cli_requires_an_output_path():
    with pytest.raises(SystemExit) as raised:
        orthologs.main([])
    assert raised.value.code == 2


# --------------------------------------------------------------------------
# the real table
# --------------------------------------------------------------------------


def test_real_table_export_changes_exactly_the_46_escaped_products(tmp_path):
    source_bytes = orthologs.SOURCE.read_bytes()
    assert hashlib.sha256(source_bytes).hexdigest() == orthologs.SOURCE_SHA256
    rows = orthologs.read_table()
    assert len(rows) == 2715

    out = tmp_path / "decoded.tsv"
    orthologs.write_table(rows, out)
    source_lines = source_bytes.decode("utf-8").split("\n")
    out_lines = out.read_text(encoding="utf-8").split("\n")
    assert len(out_lines) == len(source_lines) == 2717
    assert out_lines[0] == source_lines[0] == HEADER
    assert out_lines[-1] == source_lines[-1] == ""

    changed = []
    for row, before, after in zip(rows, source_lines[1:-1], out_lines[1:-1]):
        raw = before.split("\t")
        new = after.split("\t")
        assert tuple(raw) == row.cells
        assert len(new) == len(orthologs.COLUMNS)
        for index, (old_cell, new_cell) in enumerate(zip(raw, new)):
            if index != orthologs.PRODUCT:
                assert new_cell == old_cell
        assert new[orthologs.PRODUCT] == row.product
        assert "%2c" not in row.product.lower()
        if row.product != row.raw_product:
            assert row.product == row.raw_product.replace("%2C", ",")
            changed.append(row.locus_tag)

    assert len(changed) == 46
    assert source_bytes.count(b"%2C") == sum(
        row.raw_product.count("%2C") for row in rows)
    assert out.read_bytes().count(b"+") == source_bytes.count(b"+") > 0
    assert orthologs.SOURCE.read_bytes() == source_bytes
