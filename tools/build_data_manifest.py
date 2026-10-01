#!/usr/bin/env python3
"""Build or check the content manifest of the published site data.

``site/data/data-manifest.json`` lists every JSON file the site publishes with
its exact byte size and SHA-256. The browser reads it first and uses it twice:

* the size is the denominator of the loading bar, exact whatever compression the
  host applies in transit; and
* the digest is the cache key. Each data file is requested as
  ``<name>?v=<digest prefix>`` and may then be served from the browser cache
  without revalidation, because a file whose content changes is requested under
  a different address.

That second use is only safe while the manifest describes the files beside it.
Several independent tools rewrite single files in ``site/data`` without touching
``meta.json``, so no build timestamp can stand in for the content. Run ``build``
last, after any tool that writes there; ``check`` is the gate that refuses a
manifest that no longer matches, and it runs before every deploy.

Usage:
    tools/build_data_manifest.py build [--data-dir site/data]
    tools/build_data_manifest.py check [--data-dir site/data]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "site/data"
MANIFEST_NAME = "data-manifest.json"
SCHEMA_VERSION = 1


class DataManifestError(RuntimeError):
    """Raised when the manifest and the files beside it disagree."""


def describe(path: Path) -> dict[str, object]:
    """Return the byte size and SHA-256 of one file."""
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
            size += len(chunk)
    return {"bytes": size, "sha256": digest.hexdigest()}


def published_files(data_dir: Path) -> list[Path]:
    """Every JSON file the site publishes, the manifest itself excluded."""
    return sorted(
        path for path in data_dir.glob("*.json")
        if path.is_file() and path.name != MANIFEST_NAME
    )


def build_manifest(data_dir: Path) -> dict[str, object]:
    """Describe every published file in ``data_dir``."""
    files = published_files(data_dir)
    if not files:
        raise DataManifestError(f"no JSON files to describe in {data_dir}")
    return {
        "schemaVersion": SCHEMA_VERSION,
        "files": {path.name: describe(path) for path in files},
    }


def serialize(manifest: dict[str, object]) -> str:
    """The manifest's exact published bytes: sorted keys, one trailing newline."""
    return json.dumps(manifest, indent=2, sort_keys=True) + "\n"


def write_manifest(data_dir: Path) -> Path:
    """Write the manifest for ``data_dir`` and return its path."""
    target = data_dir / MANIFEST_NAME
    target.write_text(serialize(build_manifest(data_dir)), encoding="utf-8")
    return target


def check_manifest(data_dir: Path) -> None:
    """Raise unless the published manifest describes exactly the files beside it."""
    target = data_dir / MANIFEST_NAME
    if not target.is_file():
        raise DataManifestError(f"missing {target}; run: tools/build_data_manifest.py build")
    try:
        published = json.loads(target.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise DataManifestError(f"{target} is not valid JSON: {error}") from error
    expected = build_manifest(data_dir)
    if published == expected:
        return
    listed = published.get("files", {}) if isinstance(published, dict) else {}
    actual = expected["files"]
    problems = []
    if not isinstance(published, dict) or published.get("schemaVersion") != SCHEMA_VERSION:
        problems.append(f"schemaVersion is not {SCHEMA_VERSION}")
    if not isinstance(listed, dict):
        listed = {}
        problems.append("files is not an object")
    for name in sorted(set(actual) - set(listed)):
        problems.append(f"{name} is published but not listed")
    for name in sorted(set(listed) - set(actual)):
        problems.append(f"{name} is listed but not published")
    for name in sorted(set(listed) & set(actual)):
        if listed[name] != actual[name]:
            problems.append(f"{name} changed since the manifest was built")
    raise DataManifestError(
        f"{target} does not describe the files beside it: " + "; ".join(problems)
        + ". Run: tools/build_data_manifest.py build"
    )


def main(argv: list[str] | None = None) -> int:
    """Run ``build`` or ``check``; return a process exit code."""
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("mode", choices=("build", "check"))
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR)
    args = parser.parse_args(argv)
    try:
        if args.mode == "build":
            target = write_manifest(args.data_dir)
            count = len(json.loads(target.read_text(encoding="utf-8"))["files"])
            print(f"wrote {target} describing {count} files")
        else:
            check_manifest(args.data_dir)
            print(f"{args.data_dir / MANIFEST_NAME} matches the files beside it")
    except DataManifestError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
