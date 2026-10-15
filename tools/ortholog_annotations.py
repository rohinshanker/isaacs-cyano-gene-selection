#!/usr/bin/env python3
"""Read the pinned cyanobacterial ortholog table with decoded product text.

`docs/notes/handoff/cyano_ortholog_annotation_20260930.tsv` is returned
evidence, frozen by its SHA-256. Forty-six of its `product` values keep the GFF
escape `%2C` for a comma. The BioCyc contract decodes that escape at use time, so
the source bytes never change and this reader is the use.

The correction is a format operation, not an annotation: `%2C` (either case) in
the `product` column becomes `,`, in one pass. `%252C` stays as it is, `+` stays a
plus, other percent codes are left alone, and every other cell and the row order
are passed through untouched. The raw product stays on each row for provenance.

Reading refuses any file whose bytes differ from the pin, a header other than the
pinned columns, a row of the wrong width, and a malformed or repeated locus tag.
Nothing is joined, inferred or admitted here.

Usage::

    tools/ortholog_annotations.py --out PATH                  # write the derivative
    tools/ortholog_annotations.py --out PATH --source COPY    # read an identical copy
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/notes/handoff/cyano_ortholog_annotation_20260930.tsv"
SOURCE_SHA256 = "e49f7d8f7d328cfc3b7e4e9f50c4a802f450f32cbc782b8fd9428eb3a01ec861"

COLUMNS = (
    "locus_tag", "old_locus_tag", "protein_id", "product", "kegg_ko", "ko_count",
    "ortholog_in_eco_K12", "ortholog_in_syf_PCC7942", "ortholog_in_syc_PCC6301",
    "pinned_go_iea_count", "annotation_status", "evidence_basis_if_used",
)
PRODUCT = COLUMNS.index("product")
LOCUS_TAG = re.compile(r"M744_RS\d+")
ESCAPED_COMMA = re.compile("%2C", re.IGNORECASE)


class OrthologTableError(ValueError):
    """The table is not the pinned source or does not have its schema."""


def decode_product(raw: str) -> str:
    """Decode the GFF comma escape once; leave every other character alone."""
    return ESCAPED_COMMA.sub(",", raw)


@dataclass(frozen=True)
class OrthologRow:
    """One source row; `cells` are the raw values in `COLUMNS` order."""

    cells: tuple[str, ...]

    @property
    def locus_tag(self) -> str:
        return self.cells[0]

    @property
    def raw_product(self) -> str:
        return self.cells[PRODUCT]

    @property
    def product(self) -> str:
        return decode_product(self.raw_product)

    def decoded_cells(self) -> tuple[str, ...]:
        """The raw cells with only the product decoded."""
        return self.cells[:PRODUCT] + (self.product,) + self.cells[PRODUCT + 1:]


def parse_table(text: str) -> list[OrthologRow]:
    """Parse table text, enforcing the pinned schema and unique locus tags."""
    if not text.endswith("\n"):
        raise OrthologTableError("table must end with a newline")
    header, *lines = text[:-1].split("\n")
    if tuple(header.split("\t")) != COLUMNS:
        raise OrthologTableError(f"unexpected header: {header!r}")
    rows: list[OrthologRow] = []
    seen: set[str] = set()
    for number, line in enumerate(lines, start=2):
        cells = tuple(line.split("\t"))
        if len(cells) != len(COLUMNS):
            raise OrthologTableError(
                f"line {number}: {len(cells)} fields, expected {len(COLUMNS)}")
        tag = cells[0]
        if not LOCUS_TAG.fullmatch(tag):
            raise OrthologTableError(f"line {number}: malformed locus tag {tag!r}")
        if tag in seen:
            raise OrthologTableError(f"line {number}: repeated locus tag {tag}")
        seen.add(tag)
        rows.append(OrthologRow(cells))
    return rows


def read_table(path: Path = SOURCE) -> list[OrthologRow]:
    """Read `path`, which must be byte-identical to the pinned source."""
    data = path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != SOURCE_SHA256:
        raise OrthologTableError(
            f"{path}: SHA-256 {digest} does not match the pin {SOURCE_SHA256}")
    return parse_table(data.decode("utf-8"))


def write_table(rows: list[OrthologRow], out: Path) -> None:
    """Write the decoded derivative to a new file; never replace an existing one."""
    lines = ["\t".join(COLUMNS)] + ["\t".join(row.decoded_cells()) for row in rows]
    with out.open("x", encoding="utf-8", newline="") as handle:
        handle.write("\n".join(lines) + "\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True,
                        help="new file for the decoded table; must not exist")
    parser.add_argument("--source", type=Path, default=SOURCE,
                        help="byte-identical copy of the pinned table")
    args = parser.parse_args(argv)
    try:
        rows = read_table(args.source)
        write_table(rows, args.out)
    except (OrthologTableError, OSError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    decoded = sum(row.product != row.raw_product for row in rows)
    print(f"wrote {args.out}: {len(rows)} rows, {decoded} products decoded")
    return 0


if __name__ == "__main__":
    sys.exit(main())
