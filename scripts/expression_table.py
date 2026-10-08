"""The published per-gene layer table: three columns, the middle one typed.

Every layer table is the UTEX locus tag, the measured value, and the source
identifier the value came from. The value column is named after the quantity it
holds, so a standalone download says what it is: a fitness screen ships signed,
weighted and normalized gene fitness under ``fitness``, and a transcript or
protein level ships under ``abundance``. A fitness score goes negative and
centres on zero, so reading one as an abundance misreads every row.

The name comes from the source's declared ``dataType`` and from nothing else:
no alias, and no inspection of the values. Writer and readers agree through
this module, so a table whose header and declared type disagree is refused at
load time instead of being silently reinterpreted.
"""

from __future__ import annotations

from typing import Sequence

LOCUS_COLUMN = "locus_tag"
SOURCE_COLUMN = "source_gene_id"
FITNESS_COLUMN = "fitness"
ABUNDANCE_COLUMN = "abundance"
RATIO_COLUMN = "ratio"

# One entry per data type in condition_record.DATA_TYPES. Proteomics and
# transcriptomics both publish a level, so both are abundances.
VALUE_COLUMNS = {
    "fitness": FITNESS_COLUMN,
    "transcriptomics": ABUNDANCE_COLUMN,
    "proteomics": ABUNDANCE_COLUMN,
}


def value_column(data_type: str, *, signed: bool = False) -> str:
    """The value column a source of ``data_type`` publishes.

    A signed source that is not a fitness screen publishes a ratio: a fold
    change against a reference strain or condition, which is negative wherever
    the reference is the smaller side. Heading that column ``abundance`` would
    offer a downloaded file a negative amount of protein, so it is named for
    what it holds (owner decision, 2026-10-07: a ratio ships labelled as one).
    """
    if signed and data_type != "fitness":
        return RATIO_COLUMN
    try:
        return VALUE_COLUMNS[data_type]
    except KeyError:
        raise ValueError(
            f"no value column is defined for dataType {data_type!r}; "
            f"known types are {sorted(VALUE_COLUMNS)}"
        ) from None


def header(data_type: str, *, signed: bool = False) -> list[str]:
    """The exact three-column header a source of ``data_type`` publishes."""
    return [LOCUS_COLUMN, value_column(data_type, signed=signed), SOURCE_COLUMN]


def header_line(data_type: str, *, signed: bool = False) -> str:
    """The header as one tab-separated line, without its newline."""
    return "\t".join(header(data_type, signed=signed))


def check_header(fieldnames: Sequence[str] | None, data_type: str, label: str,
                 *, signed: bool = False) -> str:
    """Return the value column, raising ValueError when the header is not the declared one.

    ``label`` names the table in the error so a mislabelled download is
    traceable to its source entry.
    """
    expected = header(data_type, signed=signed)
    if list(fieldnames or []) != expected:
        raise ValueError(
            f"{label}: a {data_type} table must have the columns {expected}, "
            f"not {list(fieldnames or [])}"
        )
    return expected[1]
