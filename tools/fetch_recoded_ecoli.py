#!/usr/bin/env python3
"""Fetch the publisher-deposited recoded *E. coli* inputs and verify them.

Source: Nyerges et al., *Nat Commun* 2026; 17(1):5311, PMID 42331836,
PMCID PMC13287592, DOI 10.1038/s41467-026-74300-9.

The publisher host ``static-content.springer.com`` refuses automated clients
with HTTP 403. The Europe PMC ``supplementaryFiles`` endpoint serves the same
publisher-deposited members and is the route used here. The bundle is about
21.5 MB and the request routinely takes several minutes with no progress
output; that is normal, not a failure.

Every member this repository reads is pinned by SHA-256 below. A changed digest
is a hard failure, never a warning: the upstream file would no longer be the one
the derivations and the ledger describe.

Usage::

    tools/fetch_recoded_ecoli.py                 # fetch, verify, extract
    tools/fetch_recoded_ecoli.py --verify-only   # verify what is already on disk
"""

from __future__ import annotations

import argparse
import hashlib
import http.client
import shutil
import sys
import time
import urllib.error
import urllib.request
import zipfile
from dataclasses import dataclass
from pathlib import Path

BUNDLE_URL = (
    "https://www.ebi.ac.uk/europepmc/webservices/rest/"
    "PMC13287592/supplementaryFiles"
)

#: The archive member of the Europe PMC bundle that carries the Source Data.
SOURCE_ARCHIVE = "41467_2026_74300_MOESM3_ESM.zip"

DEFAULT_DEST = Path("data/raw/recoded-ecoli")


@dataclass(frozen=True)
class PinnedFile:
    """One file this repository reads, pinned by size and digest."""

    name: str
    size: int
    sha256: str
    what: str


#: Members extracted from ``SOURCE_ARCHIVE``. Retrieved and verified
#: 2026-10-07. Sizes are exact byte lengths.
PINNED: tuple[PinnedFile, ...] = (
    PinnedFile(
        "Ec_Syn57.gb",
        16_757_528,
        "8c61aeebfb8fef71a9d01ceba2a2acdb8babdf96ac0aa01aae36b10d08f77f96",
        "the complete 57-codon design, 3,973,902 bp circular, 3,640 CDS",
    ),
    PinnedFile(
        "Supplementary_Data_1.xlsx",
        378_521,
        "9f53c2019c333f73a8d5eecc6bc76c6bbd62c4fc1b772df934b1f1f472003103",
        "constructs and the 73 recoded gene variant sequences",
    ),
    PinnedFile(
        "Supplementary_Data_2.xlsx",
        210_918,
        "083101a99c6ada219c1e8ff58e7b349c271661fc97d72a0b55c842d2a9561aa1",
        "growth rate, maximum OD600 and the 480 Biolog environments",
    ),
    PinnedFile(
        "Supplementary_Data_3.xlsx",
        3_809_265,
        "4b14ee8c867394ca67ce44e8d07b3a99e8a88770355a134ba76977830e7d04f0",
        "per-gene replicate-level RNA-seq and Ribo-seq values",
    ),
    PinnedFile(
        "Supplementary_Data_4.xlsx", 68_499,
        "c3d63217df8b63fcab11eeb3e1920b7ae28e900e1663779e5d847658fd2e6aeb",
        "identified synthesis errors",
    ),
    PinnedFile(
        "Supplementary_Data_5.xlsx", 106_706,
        "10f5e3c9f38eb6ae4bc8d88f2af8a8aec15d21a25599ca6f6bd3cc0a9768330a",
        "per-strain sequencing and evolved mutations",
    ),
    PinnedFile(
        "Supplementary_Data_6.xlsx", 30_299,
        "7abbc920088fd56a0d4bc77bdd25b4e28806d269d63c727174f2b12a58b22579",
        "cryptic ORF peptide and sequence evidence",
    ),
    PinnedFile(
        "Supplementary_Data_7.xlsx", 31_354,
        "c97456aef2ffeb06d6572c20057a9d56d828622d20d5ea83e3261c3b1498ff94",
        "segment troubleshooting record",
    ),
)

#: The Source Data archive itself.
PINNED_ARCHIVE = PinnedFile(
    SOURCE_ARCHIVE,
    7_186_052,
    "cde46b0711b55c420d06e51e817201737b7df01f4a84ec08f56f379670b2c4b1",
    "the publisher Source Data archive",
)


def sha256_of(path: Path) -> str:
    """Return the hex SHA-256 of ``path``, read in chunks."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify(path: Path, pinned: PinnedFile) -> list[str]:
    """Check ``path`` against ``pinned``.

    Returns a list of human-readable problems, empty when the file matches both
    the pinned byte length and the pinned digest.
    """
    if not path.exists():
        return [f"{pinned.name}: missing"]
    problems: list[str] = []
    actual_size = path.stat().st_size
    if actual_size != pinned.size:
        problems.append(
            f"{pinned.name}: size {actual_size}, pinned {pinned.size}"
        )
    actual = sha256_of(path)
    if actual != pinned.sha256:
        problems.append(
            f"{pinned.name}: sha256 {actual}, pinned {pinned.sha256}"
        )
    return problems


def download(url: str, dest: Path) -> None:
    """Atomically download with at most three transient transport attempts."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(url, timeout=900) as response:
                if response.status != 200:
                    raise RuntimeError(f"{url} answered HTTP {response.status}")
                with tmp.open("wb") as handle:
                    shutil.copyfileobj(response, handle, length=1 << 20)
            tmp.replace(dest)
            return
        except (http.client.IncompleteRead, urllib.error.URLError,
                TimeoutError, ConnectionError) as error:
            if isinstance(error, urllib.error.HTTPError) and error.code not in {
                408, 429, 500, 502, 503, 504,
            }:
                raise
            if attempt == 3:
                raise
            delay = 5 * attempt
            print(
                f"download attempt {attempt}/3 interrupted: {error}; "
                f"retrying in {delay}s",
                file=sys.stderr,
            )
        finally:
            tmp.unlink(missing_ok=True)
        time.sleep(delay)


def extract_members(archive: Path, names: list[str], dest: Path) -> list[str]:
    """Extract ``names`` from ``archive`` into ``dest``.

    Members are written by basename into ``dest`` and never by the path stored
    in the archive, so a crafted entry cannot escape the destination.
    """
    written: list[str] = []
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as zf:
        available = set(zf.namelist())
        for name in names:
            if name not in available:
                raise RuntimeError(f"{archive.name} has no member {name!r}")
            target = dest / Path(name).name
            with zf.open(name) as src, target.open("wb") as out:
                shutil.copyfileobj(src, out, length=1 << 20)
            written.append(target.name)
    return written


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dest", type=Path, default=DEFAULT_DEST)
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="check files already on disk and download nothing",
    )
    args = parser.parse_args(argv)

    dest: Path = args.dest
    bundle = dest / "source" / "europepmc_supplementaryFiles.zip"
    archive = dest / "source" / SOURCE_ARCHIVE

    if not args.verify_only:
        if not archive.exists():
            print(f"fetching {BUNDLE_URL}", file=sys.stderr)
            print("  (about 21.5 MB; several minutes is normal)", file=sys.stderr)
            download(BUNDLE_URL, bundle)
            extract_members(bundle, [SOURCE_ARCHIVE], archive.parent)
        # Verify the containing archive before replacing any extracted input.
        problems = verify(archive, PINNED_ARCHIVE)
        if problems:
            for problem in problems:
                print(f"FAIL {problem}", file=sys.stderr)
            return 1
        extract_members(archive, [p.name for p in PINNED], dest)

    problems = verify(archive, PINNED_ARCHIVE)
    for pinned in PINNED:
        problems += verify(dest / pinned.name, pinned)

    for problem in problems:
        print(f"FAIL {problem}", file=sys.stderr)
    if problems:
        return 1
    print(f"ok: {len(PINNED)} pinned members verified in {dest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
