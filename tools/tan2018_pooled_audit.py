#!/usr/bin/env python3
"""Audit the Tan 2018 pooled TSS initiation table against the authors' archive.

Usage:
    tan2018_pooled_audit.py fetch [--archive PATH] [--article PATH]
    tan2018_pooled_audit.py check [--archive PATH] [--genes PATH] [--pooled PATH]
    tan2018_pooled_audit.py summary [--archive PATH] [--genes PATH]

The pooled table (``TAN2018_TSS``, ``tssInitiation``) was committed on
2026-09-18 without the script that made it. Its input is the authors' Figshare
5712016 file 10060636, a tarball of two GenBank files whose
``gTSS``/``iTSS``/``aTSS``/``nTSS`` features carry eight per-site start-site
counts, ``tSSCount_Sample_0`` to ``_7``. Value-matching all 4,805 features
shared with the publisher's Table S1 fixes their order as CT1, CT2, D1, D2,
HL1, HL2, HT1, HT2; every run re-checks that against the pinned Table S1
extracts.

This rule, recovered from the archive and not documented anywhere, reproduces
the committed table byte for byte:

* a site belongs to every ``M744_RS`` locus its ``/score`` text names, when that
  locus is a paper-era ``gene_biotype="protein_coding"`` gene in the same file,
  is in the current target set, and the site position is at or after the
  gene's lowest coordinate, on either strand;
* each published count is truncated to a whole number;
* a locus scores the sum over its sites of the eight-count mean.

The tool is audit evidence: ``check`` fails unless the rebuild equals the
committed table, and ``summary`` reports what the rule keeps and drops. It
never writes a table.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import sys
import tarfile
import xml.etree.ElementTree as ElementTree
from collections import Counter
from dataclasses import dataclass, field
from decimal import Decimal
from fractions import Fraction
from math import floor
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

try:  # Importable as tools.tan2018_pooled_audit and executable as a script.
    from tools import ingest_expression as ingest
except ModuleNotFoundError:  # pragma: no cover - exercised by subprocess use.
    import ingest_expression as ingest  # type: ignore[no-redef]

ROOT = Path(__file__).resolve().parents[1]
INTERIM = ROOT / "data/interim/expression/tan2018"
ARCHIVE_URL = "https://ndownloader.figshare.com/files/10060636"
ARCHIVE = INTERIM / "figshare-10060636-Supplymentary_Dataset_2.tar.gz"
ARCHIVE_SHA256 = "6de018947f165acb99f01deb7628a52cd89f0f34ca07d3286b25dbfef780a0e8"
# Member name -> SHA-256. The archive also holds their directory entry.
MEMBERS = {
    "Supplymentary_Dataset_2/UTEX2973_genome_with_TSS.gbk":
        "407d960f4d417c58f975bce6d47a3ddc47689970f92aec050d7295bab0eccc80",
    "Supplymentary_Dataset_2/UTEX2973_CP006472_with_TSS.gbk":
        "02d9493a317f88d202c9ca9363985fbb1b4bd866e46b83ead521b5caf5d7fa63",
}
MEMBER_DIRECTORY = "Supplymentary_Dataset_2"
# The article the Tan condition quotes in sources.json are re-matched against.
ARTICLE_URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6091082/fullTextXML"
ARTICLE = INTERIM / "PMC6091082-fullTextXML.xml"
ARTICLE_SHA256 = "7063969b6577a330390269bec64df5f22c696203239257cb06fc21ef5148f7d8"
GENES = ROOT / "site/data/genes.json"
EXPRESSION = ROOT / "data/expression"
POOLED = EXPRESSION / "tan2018_utex2973_tss_initiation.tsv"
POOLED_SHA256 = "5ebd8043e70309a2ea04fcec37e475069cb8540397f9d052bd246401aa6325be"
# The pinned Table S1 extracts, gTSS and non-gTSS, that fix the sample order.
TABLE_S1 = (
    EXPRESSION / "tan2018_utex2973_tss_table_s1.tsv",
    EXPRESSION / "tan2018_utex2973_regulatory_tss_table_s1.tsv",
)
TABLE_S1_SHARED_SITES = 4805

TSS_KEYS = ("gTSS", "iTSS", "aTSS", "nTSS")
SAMPLE_FIELDS = tuple(f"tSSCount_Sample_{index}" for index in range(8))
# Archive sample field -> the Table S1 extract column holding the same replicate
# (Table S1's own headers are CT1_RawReads, CT2_RawReads, D1_RawReads, ...).
TABLE_S1_COLUMNS = dict(zip(SAMPLE_FIELDS, (
    "control_1", "control_2", "dark_1", "dark_2",
    "high_light_1", "high_light_2", "high_temperature_1", "high_temperature_2",
)))

_FEATURE_LINE = re.compile(r"^ {5}(\S+)\s+(\S+)$")
_QUALIFIER_LINE = re.compile(r"^ {21}/([^=]+)(?:=(.*))?$")
_CONTINUATION_LINE = re.compile(r"^ {21}(\S.*)$")
_SITE_LOCATION = re.compile(r"^(complement\()?([1-9]\d*)(?(1)\))$")
_COUNT = re.compile(r"^\d+(?:\.\d+)?$")
_LOCUS = re.compile(r"\bM744_RS\d{5}\b")
_COORDINATE = re.compile(r"\d+")


@dataclass(frozen=True)
class Feature:
    """One feature-table entry: its key, location text and ordered qualifiers."""

    key: str
    location: str
    qualifiers: tuple[tuple[str, str | None], ...]

    def values(self, name: str) -> list[str | None]:
        """Every value of qualifier ``name``, in file order."""
        return [value for key, value in self.qualifiers if key == name]


@dataclass(frozen=True)
class Site:
    """One published TSS: where it is, its eight counts and the loci it names."""

    member: str
    key: str
    position: int
    strand: str
    published: Mapping[str, str]
    loci: tuple[str, ...]

    @property
    def counts(self) -> dict[str, int]:
        """Each published count truncated to a whole number, as the pooled table was."""
        return {name: floor(Decimal(text)) for name, text in self.published.items()}


@dataclass(frozen=True)
class Gene:
    """A paper-era protein-coding gene: its file and its lowest coordinate."""

    member: str
    start: int


@dataclass(frozen=True)
class Pins:
    """Everything a run is checked against; tests substitute synthetic ones."""

    archive_sha256: str = ARCHIVE_SHA256
    members: Mapping[str, str] = field(default_factory=lambda: dict(MEMBERS))
    tables: tuple[Path, ...] = TABLE_S1
    shared_sites: int = TABLE_S1_SHARED_SITES
    pooled_sha256: str = POOLED_SHA256


PINS = Pins()


def require(condition: bool, message: str) -> None:
    """Raises a descriptive input-contract error."""
    if not condition:
        raise ValueError(message)


def sha256(data: bytes) -> str:
    """The lower-case SHA-256 of ``data``."""
    return hashlib.sha256(data).hexdigest()


def read_members(archive: bytes, expected_sha256: str,
                 members: Mapping[str, str]) -> dict[str, bytes]:
    """The checksum-verified GenBank members of the pinned tarball."""
    observed = sha256(archive)
    require(observed == expected_sha256,
            f"Tan archive checksum mismatch: expected {expected_sha256}, got {observed}")
    contents: dict[str, bytes] = {}
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as tar:
        for entry in tar.getmembers():
            if entry.isdir():
                require(entry.name == MEMBER_DIRECTORY,
                        f"Tan archive has an unexpected directory: {entry.name}")
                continue
            require(entry.isfile() and entry.name in members,
                    f"Tan archive has an unexpected member: {entry.name}")
            handle = tar.extractfile(entry)
            assert handle is not None  # A regular member always has a file object.
            contents[entry.name] = handle.read()
    missing = sorted(set(members) - set(contents))
    require(not missing, f"Tan archive is missing members: {', '.join(missing)}")
    for name, data in contents.items():
        observed = sha256(data)
        require(observed == members[name],
                f"Tan archive member {name} checksum mismatch: "
                f"expected {members[name]}, got {observed}")
    return contents


def parse_features(text: str, label: str) -> list[Feature]:
    """The feature table of one GenBank file, from ``FEATURES`` to ``ORIGIN``.

    The chromosome file has no header and starts at its first feature. A
    qualifier value continues on following indented lines, joined by a space,
    which is how the authors wrapped the ``/score`` sentences.
    """
    lines = text.splitlines()
    header = [n for n, line in enumerate(lines) if line.startswith("FEATURES ")]
    require(len(header) <= 1, f"{label}: more than one FEATURES table")
    start = header[0] + 1 if header else 0
    features: list[Feature] = []
    key: str | None = None
    location = ""
    qualifiers: list[list[str | None]] = []

    def close() -> None:
        if key is not None:
            features.append(Feature(key, location,
                                    tuple((q[0] or "", q[1]) for q in qualifiers)))

    for number, line in enumerate(lines[start:], start=start + 1):
        if line.startswith("ORIGIN"):
            break
        feature = _FEATURE_LINE.match(line)
        if feature:
            close()
            key, location = feature.groups()
            qualifiers = []
            continue
        qualifier = _QUALIFIER_LINE.match(line)
        if qualifier and key is not None:
            qualifiers.append([qualifier.group(1), qualifier.group(2)])
            continue
        continuation = _CONTINUATION_LINE.match(line)
        if continuation and qualifiers:
            name, value = qualifiers[-1]
            require(value is not None,
                    f"{label} line {number}: continuation of the valueless /{name}")
            qualifiers[-1][1] = f"{value} {continuation.group(1)}"
            continue
        require(not line.startswith(" "), f"{label} line {number}: unparsed feature line")
        close()
        key = None
        qualifiers = []
    close()
    return features


def unquoted(value: str | None) -> str | None:
    """A qualifier value without its surrounding double quotes."""
    if value is not None and len(value) >= 2 and value[0] == value[-1] == '"':
        return value[1:-1]
    return value


def single(feature: Feature, name: str, label: str) -> str:
    """The one value of qualifier ``name``, refusing absence or repetition."""
    values = feature.values(name)
    require(len(values) == 1 and values[0] is not None,
            f"{label}: {feature.key} at {feature.location} needs exactly one /{name}, "
            f"found {len(values)}")
    return unquoted(values[0]) or ""


def published_count(text: str, label: str) -> str:
    """A published count, refused unless it is a non-negative decimal."""
    require(_COUNT.fullmatch(text) is not None,
            f"{label}: a count must be a non-negative decimal, not {text!r}")
    return text


def read_site(feature: Feature, member: str) -> Site:
    """One TSS feature, validated."""
    label = f"{member} {feature.key} {feature.location}"
    location = _SITE_LOCATION.fullmatch(feature.location)
    if location is None:
        raise ValueError(f"{label}: a TSS location must be one base")
    published = {name: published_count(single(feature, name, label), label)
                 for name in SAMPLE_FIELDS}
    loci = tuple(sorted(set(_LOCUS.findall(single(feature, "score", label)))))
    return Site(member, feature.key, int(location.group(2)),
                "-" if location.group(1) else "+", published, loci)


def read_archive(members: Mapping[str, bytes]) -> tuple[list[Site], dict[str, Gene]]:
    """Every TSS site and every paper-era protein-coding gene in the archive."""
    sites: list[Site] = []
    genes: dict[str, Gene] = {}
    for member in sorted(members):
        text = members[member].decode("utf-8")
        for feature in parse_features(text, member):
            if feature.key in TSS_KEYS:
                sites.append(read_site(feature, member))
            elif feature.key == "gene":
                biotypes = [unquoted(v) for v in feature.values("gene_biotype")]
                if biotypes != ["protein_coding"]:
                    continue
                label = f"{member} gene {feature.location}"
                locus = single(feature, "locus_tag", label)
                require(locus not in genes, f"{label}: duplicate protein-coding gene {locus}")
                coordinates = [int(c) for c in _COORDINATE.findall(feature.location)]
                require(bool(coordinates), f"{label}: no coordinates")
                genes[locus] = Gene(member, min(coordinates))
    require(bool(sites), "Tan archive has no TSS features")
    return sites, genes


def verify_sample_order(sites: Iterable[Site], tables: Sequence[Path],
                        expected_shared: int) -> None:
    """Refuse the archive unless its sample fields hold Table S1's replicates in order.

    The archive names its fields only ``tSSCount_Sample_0`` to ``_7``; the
    replicate names come from Table S1. A site present in both, matched on
    type, strand and position, must carry equal published counts in every field.
    """
    rows: dict[tuple[str, str, int], dict[str, str]] = {}
    for table in tables:
        with table.open(encoding="utf-8", newline="") as handle:
            for row in csv.DictReader(handle, delimiter="\t"):
                rows[(row["type"], row["strand"], int(row["position"]))] = row
    shared = 0
    for site in sites:
        row = rows.get((site.key, site.strand, site.position))
        if row is None:
            continue
        shared += 1
        for sample, column in TABLE_S1_COLUMNS.items():
            require(row[column] != "" and Decimal(row[column]) == Decimal(site.published[sample]),
                    f"{site.member} {site.key} {site.strand}{site.position}: {sample} is "
                    f"{site.published[sample]}, Table S1 {column} is {row[column]!r}")
    require(shared == expected_shared,
            f"{shared} archive sites match Table S1 by type, strand and position, "
            f"not {expected_shared}")


def named_pairs(sites: Iterable[Site], genes: Mapping[str, Gene],
                targets: Iterable[str]) -> list[tuple[Site, str]]:
    """Each site paired with every eligible current locus its score names."""
    current = set(targets)
    return [
        (site, locus)
        for site in sites for locus in site.loci
        if locus in current and locus in genes and genes[locus].member == site.member
    ]


def associate(sites: Iterable[Site], genes: Mapping[str, Gene],
              targets: Iterable[str]) -> dict[str, list[Site]]:
    """The pooled table's site set of each current target locus that has one."""
    by_locus: dict[str, list[Site]] = {}
    for site, locus in named_pairs(sites, genes, targets):
        if site.position >= genes[locus].start:
            by_locus.setdefault(locus, []).append(site)
    return dict(sorted(by_locus.items()))


def pooled_score(sites: Sequence[Site]) -> Fraction:
    """The sum over sites of the eight-count mean of truncated counts."""
    return sum((Fraction(sum(site.counts.values()), 8) for site in sites), Fraction(0))


def untruncated_score(sites: Sequence[Site]) -> Fraction:
    """The same sum over the published counts as printed."""
    return sum((sum((Fraction(Decimal(v)) for v in site.published.values()), Fraction(0)) / 8
                for site in sites), Fraction(0))


def decimal_text(value: Fraction) -> str:
    """``value`` at six decimals, refusing any value that does not fit exactly."""
    scaled = value * 10**6
    require(scaled.denominator == 1, f"{value} is not exact at six decimals")
    whole, fraction = divmod(int(scaled), 10**6)
    return f"{whole}.{fraction:06d}"


def pooled_table(by_locus: Mapping[str, Sequence[Site]]) -> bytes:
    """The pooled table as committed, including its LF header and CRLF data rows."""
    rows = "".join(
        f"{locus}\t{decimal_text(pooled_score(sites))}\t"
        f"Tan2018_dRNAseq_TSS_count_sum_{len(sites)}TSS\r\n"
        for locus, sites in by_locus.items()
    )
    return ("locus_tag\tabundance\tsource_gene_id\n" + rows).encode("ascii")


def load(archive: bytes, targets: Iterable[str], pins: Pins
         ) -> tuple[list[Site], dict[str, Gene], dict[str, list[Site]]]:
    """The archive's sites and genes, and each current locus's pooled site set."""
    sites, genes = read_archive(read_members(archive, pins.archive_sha256, pins.members))
    verify_sample_order(sites, pins.tables, pins.shared_sites)
    return sites, genes, associate(sites, genes, targets)


def rebuild(archive: bytes, targets: Iterable[str], pins: Pins | None = None) -> bytes:
    """The pooled table rebuilt by the recovered rule, refused unless it is the pinned one."""
    pins = pins or PINS
    _, _, by_locus = load(archive, targets, pins)
    pooled = pooled_table(by_locus)
    observed = sha256(pooled)
    require(observed == pins.pooled_sha256,
            f"the recovered rule does not reproduce the pinned pooled table: "
            f"expected {pins.pooled_sha256}, got {observed}")
    return pooled


def summary(archive: bytes, targets: Sequence[str], pins: Pins | None = None
            ) -> dict[str, Any]:
    """What the recovered rule keeps and drops, recomputed from the archive."""
    sites, genes, by_locus = load(archive, targets, pins or PINS)
    pairs = named_pairs(sites, genes, targets)
    dropped = [(site, locus) for site, locus in pairs if site.position < genes[locus].start]
    losing = {locus for _, locus in dropped}
    kept_pairs = Counter(f"{s.key}{s.strand}" for group in by_locus.values() for s in group)
    truncated = sorted(locus for locus, group in by_locus.items()
                       if untruncated_score(group) != pooled_score(group))
    return {
        "sites": len(sites),
        "sitesUsed": len({id(site) for group in by_locus.values() for site in group}),
        "paperProteinCodingGenes": len(genes),
        "paperProteinCodingNotCurrent": len(set(genes) - set(targets)),
        "lociWithScore": len(by_locus),
        "targetsWithoutScore": len(set(targets) - set(by_locus)),
        "keptPairs": dict(sorted(kept_pairs.items())),
        "droppedPairs": dict(sorted(Counter(f"{s.key}{s.strand}" for s, _ in dropped).items())),
        "lociLosingASite": len(losing),
        "lociLosingEverySite": len(losing - set(by_locus)),
        "lociLoweredByTruncation": truncated,
    }


def article_text(article: bytes, expected_sha256: str = ARTICLE_SHA256) -> str:
    """The pinned article's text, element runs joined by a space, whitespace collapsed.

    That is how the repository's condition quotes were written (``CO 2``,
    ``OD 730``), so a quote matches when it is a substring of this text.
    """
    observed = sha256(article)
    require(observed == expected_sha256,
            f"Tan article checksum mismatch: expected {expected_sha256}, got {observed}")
    return collapse(" ".join(ElementTree.fromstring(article).itertext()))


def collapse(text: str) -> str:
    """``text`` with every whitespace run reduced to one space."""
    return re.sub(r"\s+", " ", text).strip()


def unmatched_quotes(sources: Iterable[Mapping[str, Any]], text: str) -> list[str]:
    """Every article-sourced condition quote of a Tan source that ``text`` lacks."""
    missing = []
    for source in sources:
        if source.get("citationId") != "tan-2018":
            continue
        for axis, value in source["record"]["conditions"].items():
            quote = value.get("quote") or ""
            where = value.get("where") or ""
            if quote and "PMC6091082" in where and collapse(quote) not in text:
                missing.append(f"{source['id']} {axis}")
    return missing


def target_loci(path: Path) -> list[str]:
    """The current target set: every gene id in the site's genes.json."""
    genes = json.loads(path.read_text(encoding="utf-8"))
    require(isinstance(genes, list) and all(isinstance(g, dict) and "id" in g for g in genes),
            f"{path} is not a gene list")
    loci = [gene["id"] for gene in genes]
    require(len(loci) == len(set(loci)), f"{path} repeats a gene id")
    return loci


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Audit the Tan 2018 pooled TSS table.")
    parser.add_argument("mode", choices=("fetch", "check", "summary"))
    parser.add_argument("--archive", type=Path, default=ARCHIVE)
    parser.add_argument("--article", type=Path, default=ARTICLE)
    parser.add_argument("--genes", type=Path, default=GENES)
    parser.add_argument("--pooled", type=Path, default=POOLED)
    arguments = parser.parse_args(argv)
    try:
        if arguments.mode == "fetch":
            ingest.fetch(ARCHIVE_URL, ARCHIVE_SHA256, arguments.archive)
            ingest.fetch(ARTICLE_URL, ARTICLE_SHA256, arguments.article)
            return 0
        require(arguments.archive.is_file(),
                f"{arguments.archive} is missing; run `tan2018_pooled_audit.py fetch` first")
        archive = arguments.archive.read_bytes()
        targets = target_loci(arguments.genes)
        if arguments.mode == "summary":
            print(json.dumps(summary(archive, targets), indent=2))
            return 0
        rebuilt = rebuild(archive, targets)
        require(arguments.pooled.is_file() and arguments.pooled.read_bytes() == rebuilt,
                f"{arguments.pooled} differs from the rebuild")
        return 0
    except ValueError as error:
        print(f"tan2018_pooled_audit: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
