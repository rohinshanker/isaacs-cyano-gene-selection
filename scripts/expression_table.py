"""The published per-gene layer table: three columns, the middle one typed.

Every layer table is the UTEX locus tag, the measured value, and the source
identifier the value came from. The value column is named after the quantity it
holds, so a standalone download says what it is: a fitness screen ships signed,
weighted and normalized gene fitness under ``fitness``, and a transcript or
protein level ships under ``abundance``. A fitness score goes negative and
centres on zero, so reading one as an abundance misreads every row.

For a source that declares no ``quantity``, the name comes from the source's
declared ``dataType`` and from nothing else: no alias, and no inspection of the
values. Writer and readers agree through this module, so a table whose header
and declared type disagree is refused at load time instead of being silently
reinterpreted.

A transcriptomics deposit, though, publishes more than one kind of number. A
differential-expression table holds a log2 fold change, a p-value and sometimes
a translation-efficiency ratio alongside the abundances, and ``dataType`` alone
cannot tell them apart: all four are "transcriptomics by RNA-seq". A source may
therefore declare its measured ``quantity`` explicitly, and that declaration —
never a regular expression over the assay sentence — decides the value column,
the admissible values, the sign convention, the colour ramp, the metric family
and whether several deposits of it may be pooled. ``QUANTITIES`` below is the
whole contract; an undeclared quantity is refused rather than guessed, and a
source that declares none keeps exactly its former behaviour.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Mapping, Sequence

LOCUS_COLUMN = "locus_tag"
SOURCE_COLUMN = "source_gene_id"
FITNESS_COLUMN = "fitness"
ABUNDANCE_COLUMN = "abundance"
RATIO_COLUMN = "ratio"
READ_COUNT_COLUMN = "read_count"
LOG2_FOLD_CHANGE_COLUMN = "log2_fold_change"
P_VALUE_COLUMN = "p_value"
TRANSLATION_EFFICIENCY_COLUMN = "translation_efficiency_log2_fold_change"

# One entry per data type in condition_record.DATA_TYPES. Proteomics and
# transcriptomics both publish a level, so both are abundances.
VALUE_COLUMNS = {
    "fitness": FITNESS_COLUMN,
    "transcriptomics": ABUNDANCE_COLUMN,
    "proteomics": ABUNDANCE_COLUMN,
}

# The two sequencing platforms a declared quantity distinguishes. They measure
# different molecules: RNA-seq counts transcripts, Ribo-seq counts ribosome
# footprints on them. The same quantity therefore names a different measurement
# on each, which is why every quantity below gives one entry per platform.
RNA_PLATFORM = "RNA-seq"
RIBO_PLATFORM = "Ribo-seq"


@dataclass(frozen=True)
class Quantity:
    """One measured quantity a source may declare, and everything that follows.

    ``column`` is the value column the published table heads its numbers with.
    Two quantities may share one column when the number really is the same kind
    of number: an edgeR log2 fold change and a shrunken log2 fold change are
    both log2 fold changes, and the header says so; which algorithm produced it
    is the source's declaration, not a second column name.

    ``family`` is the metric family the browser groups the quantity under, and
    it is the field that keeps a p-value or a fold change out of the abundance
    rules: the low-traffic threshold and the "measured expression" orderings
    select on the family, so a signed ratio or a probability must not sit in
    ``Expression``.

    ``pools`` says whether several selected deposits of the quantity may be
    combined into one shown value. An abundance may: the deposits report
    different units, so each is ranked within itself and the ranks averaged,
    which is scale-free. A p-value, a fold change and a translation-efficiency
    ratio may not: each is the result of one contrast evaluated by one
    algorithm, and averaging two of them produces a number that answers no
    question anyone asked.

    ``exact`` keeps a column out of the pipeline's six-decimal publication
    rounding. A published p-value of 3e-18 rounds to zero at six decimals,
    which would turn the strongest evidence in the table into the weakest.
    """

    name: str
    column: str
    data_types: tuple[str, ...]
    family: str
    scale: str
    signed: bool
    log_scale: bool
    nonnegative: bool
    integral: bool
    unit_interval: bool
    exact: bool
    pools: bool
    # platform -> (type-grouping kind, reader-facing quantity label)
    by_platform: Mapping[str, tuple[str, str]]

    @property
    def platforms(self) -> tuple[str, ...]:
        return tuple(self.by_platform)

    def kind(self, platform: str) -> str:
        """The type-grouping kind this quantity has on ``platform``."""
        return self._on(platform)[0]

    def label(self, platform: str) -> str:
        """The reader-facing name of this quantity on ``platform``."""
        return self._on(platform)[1]

    def _on(self, platform: str) -> tuple[str, str]:
        try:
            return self.by_platform[platform]
        except KeyError:
            raise ValueError(
                f"quantity {self.name!r} is not defined for platform {platform!r}; "
                f"it is defined for {sorted(self.by_platform)}"
            ) from None


# The quantities a source may declare, and the only ones. A deposit publishing
# something else needs a row here, decided deliberately, rather than a reader
# that infers a meaning from the assay sentence.
#
# The three bases that must never be averaged together are kept apart by their
# `kind`, which is what the browser's type key is built from: an RPKM is an
# abundance (an occupancy on Ribo-seq), a raw count is its own base because it
# carries library depth that an RPKM has already divided out, and each family
# of fold change is its own base per calculation method, because edgeR's
# moderated estimate and an unmoderated log ratio are different estimators of
# the same contrast. P-values and translation-efficiency ratios are two further
# bases of their own.
QUANTITIES: Mapping[str, Quantity] = {
    quantity.name: quantity
    for quantity in (
        Quantity(
            name="rpkm",
            column=ABUNDANCE_COLUMN,
            data_types=("transcriptomics",),
            family="Expression",
            scale="sequential",
            signed=False,
            log_scale=False,
            nonnegative=True,
            integral=False,
            unit_interval=False,
            exact=False,
            pools=True,
            by_platform={
                RNA_PLATFORM: ("abundance", "RNA abundance"),
                # Ribosome profiling counts footprints on a transcript. That is
                # occupancy, not abundance, and pooling it with transcript
                # levels would average two different measurements of one gene.
                RIBO_PLATFORM: ("occupancy", "Ribosome occupancy"),
            },
        ),
        Quantity(
            name="read_count",
            column=READ_COUNT_COLUMN,
            data_types=("transcriptomics",),
            family="Expression",
            scale="sequential",
            signed=False,
            log_scale=False,
            nonnegative=True,
            integral=True,
            unit_interval=False,
            exact=False,
            pools=True,
            by_platform={
                RNA_PLATFORM: ("read-count", "RNA read count"),
                RIBO_PLATFORM: ("footprint-count", "Ribosome footprint count"),
            },
        ),
        Quantity(
            name="log2_fold_change",
            column=LOG2_FOLD_CHANGE_COLUMN,
            data_types=("transcriptomics",),
            family="Fold change",
            scale="diverging",
            signed=True,
            log_scale=False,
            nonnegative=False,
            integral=False,
            unit_interval=False,
            exact=False,
            pools=False,
            by_platform={
                RNA_PLATFORM: ("log2-fold-change", "RNA log2FC"),
                RIBO_PLATFORM: ("log2-fold-change", "Ribosome log2FC"),
            },
        ),
        Quantity(
            name="edger_log2_fold_change",
            column=LOG2_FOLD_CHANGE_COLUMN,
            data_types=("transcriptomics",),
            family="Fold change",
            scale="diverging",
            signed=True,
            log_scale=False,
            nonnegative=False,
            integral=False,
            unit_interval=False,
            exact=False,
            pools=False,
            by_platform={
                RNA_PLATFORM: ("edger-log2-fold-change", "RNA log2FC (EdgeR)"),
                RIBO_PLATFORM: ("edger-log2-fold-change", "Ribosome log2FC (EdgeR)"),
            },
        ),
        Quantity(
            name="p_value",
            column=P_VALUE_COLUMN,
            data_types=("transcriptomics",),
            family="Significance",
            scale="sequential",
            signed=False,
            log_scale=False,
            nonnegative=True,
            integral=False,
            unit_interval=True,
            exact=True,
            pools=False,
            by_platform={
                # Whether the deposit adjusted for multiple testing is not
                # recorded in the tables, so the label says so rather than
                # promising an FDR the file cannot support.
                RNA_PLATFORM: ("p-value", "RNA reported P-value (adjustment unspecified)"),
                RIBO_PLATFORM: (
                    "p-value",
                    "Ribosome reported P-value (adjustment unspecified)",
                ),
            },
        ),
        Quantity(
            name="translation_efficiency_log2_fold_change",
            column=TRANSLATION_EFFICIENCY_COLUMN,
            data_types=("transcriptomics",),
            family="Translation efficiency",
            scale="diverging",
            signed=True,
            log_scale=False,
            nonnegative=False,
            integral=False,
            unit_interval=False,
            exact=False,
            pools=False,
            by_platform={
                # A translation efficiency is a ratio of footprints to
                # transcripts, so it belongs to neither molecule alone and its
                # name carries no platform word.
                RNA_PLATFORM: ("te-log2-fold-change", "TE log2FC"),
                RIBO_PLATFORM: ("te-log2-fold-change", "TE log2FC"),
            },
        ),
    )
}


def quantity_spec(quantity: str) -> Quantity:
    """The contract for ``quantity``, raising ValueError when there is none."""
    try:
        return QUANTITIES[quantity]
    except (KeyError, TypeError):
        raise ValueError(
            f"unsupported expression quantity {quantity!r}; "
            f"known quantities are {sorted(QUANTITIES)}"
        ) from None


def value_column(data_type: str, quantity: str | None = None, *, signed: bool = False) -> str:
    """The value column a source publishes.

    A declared ``quantity`` names the column; without one the column follows
    the ``data_type``, exactly as it did before quantities existed.
    """
    if quantity is not None:
        return quantity_spec(quantity).column
    if signed and data_type != "fitness":
        return RATIO_COLUMN
    try:
        return VALUE_COLUMNS[data_type]
    except KeyError:
        raise ValueError(
            f"no value column is defined for dataType {data_type!r}; "
            f"known types are {sorted(VALUE_COLUMNS)}"
        ) from None


def header(data_type: str, quantity: str | None = None, *, signed: bool = False) -> list[str]:
    """The exact three-column header a source publishes."""
    return [LOCUS_COLUMN, value_column(data_type, quantity, signed=signed), SOURCE_COLUMN]


def header_line(data_type: str, quantity: str | None = None, *, signed: bool = False) -> str:
    """The header as one tab-separated line, without its newline."""
    return "\t".join(header(data_type, quantity, signed=signed))


def check_header(
    fieldnames: Sequence[str] | None,
    data_type: str,
    label: str,
    quantity: str | None = None,
    *, signed: bool = False,
) -> str:
    """Return the value column, raising ValueError when the header is not the declared one.

    ``label`` names the table in the error so a mislabelled download is
    traceable to its source entry.
    """
    expected = header(data_type, quantity, signed=signed)
    if list(fieldnames or []) != expected:
        declared = f"{data_type} {quantity}" if quantity is not None else data_type
        raise ValueError(
            f"{label}: a {declared} table must have the columns {expected}, "
            f"not {list(fieldnames or [])}"
        )
    return expected[1]


def check_declaration(
    data_type: str, platform: str, quantity: str, label: str
) -> Quantity:
    """The contract for a source's declaration, or ValueError naming the clash.

    A quantity is defined for particular data types and platforms, and nothing
    else may claim it: a proteomics deposit does not publish an RPKM, and a
    microarray does not publish a ribosome footprint count.
    """
    spec = quantity_spec(quantity)
    if data_type not in spec.data_types:
        raise ValueError(
            f"{label}: quantity {quantity!r} is defined for dataType "
            f"{list(spec.data_types)}, not {data_type!r}"
        )
    if platform not in spec.by_platform:
        raise ValueError(
            f"{label}: quantity {quantity!r} is defined for platform "
            f"{sorted(spec.by_platform)}, not {platform!r}"
        )
    return spec


def declared_flags(quantity: str) -> dict[str, bool]:
    """The ``signed`` and ``logScale`` flags the quantity's contract fixes.

    These are not a second opinion a manifest may hold: whether a log2 fold
    change is centred on zero follows from its being a log2 fold change. A
    manifest that states them must state the contract's values, and one that
    states nothing takes them from here.
    """
    spec = quantity_spec(quantity)
    return {"signed": spec.signed, "logScale": spec.log_scale}


def value_problem(quantity: str, value: float) -> str | None:
    """Why ``value`` is not an admissible ``quantity``, or None when it is."""
    spec = quantity_spec(quantity)
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return f"{quantity} must be a number, not {value!r}"
    if not math.isfinite(value):
        return f"{quantity} must be finite, not {value!r}"
    if spec.nonnegative and value < 0:
        return f"{quantity} is never negative, and this is {value!r}"
    if spec.integral and float(value) != int(value):
        return f"{quantity} counts whole reads, and this is {value!r}"
    if spec.unit_interval and not 0 <= value <= 1:
        return f"{quantity} is a probability in [0, 1], and this is {value!r}"
    return None


def check_value(quantity: str, value: float, label: str) -> float:
    """``value`` itself, raising ValueError when the quantity does not admit it."""
    problem = value_problem(quantity, value)
    if problem is not None:
        raise ValueError(f"{label}: {problem}")
    return value


def format_value(value: float, quantity: str | None = None, decimals: int = 4) -> str:
    """``value`` as a table cell, at the precision its quantity needs.

    The default four decimals is the convention every shipped table was written
    at. A quantity marked ``exact`` is written at full round-trip precision
    instead, because rounding a p-value of 3e-18 to four decimals publishes
    zero and makes the strongest evidence in the file indistinguishable from an
    exact zero.
    """
    if quantity is not None and quantity_spec(quantity).exact:
        return repr(float(value))
    return f"{value:.{decimals}f}"


def quantity_facts(data_type: str, platform: str, quantity: str, label: str) -> dict[str, Any]:
    """What a declared quantity publishes about itself into ``meta.json``.

    The pipeline resolves the contract once and ships the result, so the
    browser reads a declaration instead of keeping a second copy of this table
    that could drift from it. Everything here is derived from ``QUANTITIES``
    and is never a manifest's own words.
    """
    spec = check_declaration(data_type, platform, quantity, label)
    return {
        "quantity": spec.name,
        "quantityKind": spec.kind(platform),
        "quantityLabel": spec.label(platform),
        "quantityFamily": spec.family,
        "quantityPools": spec.pools,
        "quantityBounds": {
            "nonnegative": spec.nonnegative,
            "integral": spec.integral,
            "unitInterval": spec.unit_interval,
        },
    }
