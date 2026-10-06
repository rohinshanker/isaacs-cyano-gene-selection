#!/usr/bin/env python3
"""Re-match every quotation in a package addendum against the saved source texts.

An addendum row cites each value as ``[<location> (<doc>); quote: "<text>"]``,
where ``<doc>`` names a text file ``<doc>.txt`` in the texts directory: the
reading-order extraction of a paper, supplement or archive page the owner
supplied or the agents retrieved. The papers stay outside the repository, so
this check runs against a local directory and its result is recorded in the
ticket, as the handoff contract asks (``docs/validation/claude-science-handoff.md``).

A quote passes when, after Unicode compatibility normalisation and whitespace
collapsing on both sides, it is a substring of its document. A composite quote
joins pieces with ``||`` and passes only when every piece does. A quote whose
location names no document, or a document the directory lacks, fails.

Usage:
    check_addendum_quotes.py ADDENDUM.tsv --texts DIR
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path

QUOTED_COLUMNS = ("conditions", "replicates", "licence")
SEGMENT = re.compile(r'\[([^\[\]]*?); quote: "([^"]*)"\]')
DOC_KEY = re.compile(r"\(([a-z0-9_]+)\)")


@dataclass(frozen=True)
class Finding:
    """One quotation's result: where it sits, what it cites, and why it failed if it did."""

    row: int
    column: str
    doc: str
    quote: str
    ok: bool
    reason: str = ""


def normalise(text: str) -> str:
    """Compatibility-normalise and collapse whitespace, so a line break or a ligature never fails a match."""
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", text)).strip()


def load_texts(directory: Path) -> dict[str, str]:
    """Every ``<doc>.txt`` in the directory, normalised, keyed by document name."""
    return {path.stem: normalise(path.read_text(encoding="utf-8", errors="replace"))
            for path in sorted(directory.glob("*.txt"))}


def check_quote(location: str, quote: str, texts: dict[str, str], *, row: int, column: str) -> Finding:
    """Match one ``[location; quote]`` segment: the document named in the location must contain every piece."""
    match = DOC_KEY.search(location)
    if match is None:
        return Finding(row, column, "", quote, False, "location names no document key")
    doc = match.group(1)
    text = texts.get(doc)
    if text is None:
        return Finding(row, column, doc, quote, False, f"no text file {doc}.txt")
    for piece in quote.split("||"):
        if normalise(piece) not in text:
            return Finding(row, column, doc, quote, False, f"not found: {normalise(piece)[:80]!r}")
    return Finding(row, column, doc, quote, True)


def check_file(addendum: Path, texts_dir: Path) -> list[Finding]:
    """Every quotation in the addendum's cited columns, in row order."""
    texts = load_texts(texts_dir)
    findings: list[Finding] = []
    with addendum.open(encoding="utf-8", newline="") as handle:
        csv.field_size_limit(sys.maxsize)
        for number, row in enumerate(csv.DictReader(handle, delimiter="\t"), start=1):
            for column in QUOTED_COLUMNS:
                for location, quote in SEGMENT.findall(row.get(column) or ""):
                    findings.append(check_quote(location, quote, texts, row=number, column=column))
    return findings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("addendum", type=Path)
    parser.add_argument("--texts", type=Path, required=True, help="directory of <doc>.txt source texts")
    args = parser.parse_args(argv)
    findings = check_file(args.addendum, args.texts)
    failed = [f for f in findings if not f.ok]
    for finding in failed:
        print(f"row {finding.row} {finding.column} ({finding.doc or 'no doc'}): {finding.reason}")
    print(f"{len(findings) - len(failed)} of {len(findings)} quotations matched")
    return 1 if failed or not findings else 0


if __name__ == "__main__":
    sys.exit(main())
