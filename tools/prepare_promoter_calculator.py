#!/usr/bin/env python3
"""Prepare the pinned public Promoter Calculator for a Python 3 local evaluation.

This verifies local downloads and changes syntax/API spelling only. It neither
runs the model nor publishes predictions. See regulatory-promoter.md for scope.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys


UPSTREAM_COMMIT = "46da9132740bce30bccd107f02808adf2215e2f0"
UPSTREAM_URL = (
    f"https://raw.githubusercontent.com/hsalis/SalisLabCode/{UPSTREAM_COMMIT}"
    "/Promoter_Calculator/"
)
SOURCE_HASHES = {
    "Promoter_Calculator_v1_0.py": "67d2733b0be1968668c6710e56262b00d9b4725b98b4f94749519591b48d1cdb",
    "util.py": "abd561c6f1a4669dace3f783903f2779133cdc4ce5319919302303982eba23cc",
    "free_energy_coeffs.npy": "fddf16b38bf29799481e8a45890b669111e16cf2e3448e99d1934d19a8f0b8e9",
    "model_intercept.npy": "f7c66a8d838da71a6b2ab17936cd6ff2564e446af8c0676fba95de2116e99a7b",
    "LICENSE": "45d25f34fe826d27d344175bd622cbf3d35cbf53bd993d1350d44ee706571ffd",
    "README.md": "a5f3269206f5425e2c21ca58d9cb638fe87a4cbb1dbdff537a676747dc4b26d2",
}
ADAPTED_HASHES = {
    "Promoter_Calculator_v1_0.py": "142823781d1ef70eaf3a1fe6be9e4e005c73edf78b9f8bef9a3e12b86d9849ff",
    "util.py": "f80c4bec9b0922e9ed92645bc68343f811ac713e6107343463a1747c16345b74",
}


def sha256(data: bytes) -> str:
    """Return the identity of bytes, without interpreting their contents."""
    return hashlib.sha256(data).hexdigest()


def adapt_sources(payloads: dict[str, bytes]) -> dict[str, bytes]:
    """Adapt only the pinned syntax and encoder arguments; preserve the model."""
    adapted = dict(payloads)
    name = "Promoter_Calculator_v1_0.py"
    text, count = re.subn(
        r"^(\s*)print (.*)$", r"\1print(\2)", payloads[name].decode("utf-8"),
        flags=re.MULTILINE,
    )
    if count != 4:
        raise ValueError("Expected exactly four Python 2 print statements")
    adapted[name] = text.encode("utf-8")
    text = payloads["util.py"].decode("utf-8")
    if text.count("OneHotEncoder(sparse=False)") != 2:
        raise ValueError("Expected exactly two legacy OneHotEncoder arguments")
    adapted["util.py"] = text.replace(
        "OneHotEncoder(sparse=False)", "OneHotEncoder(sparse_output=False)"
    ).encode("utf-8")
    for name, expected in ADAPTED_HASHES.items():
        if sha256(adapted[name]) != expected:
            raise ValueError(f"Adapted checksum mismatch: {name}")
        compile(adapted[name], name, "exec")
    return adapted


def prepare(source_dir: Path, output_dir: Path) -> dict:
    """Verify downloads and create a new directory; never overwrite a path."""
    payloads = {}
    for name, expected in SOURCE_HASHES.items():
        payloads[name] = (source_dir / name).read_bytes()
        if sha256(payloads[name]) != expected:
            raise ValueError(f"Upstream checksum mismatch: {name}")
    adapted = adapt_sources(payloads)
    manifest = {
        "schema_version": 1,
        "upstream_commit": UPSTREAM_COMMIT,
        "scope": "Local compatibility evaluation; no UTEX calibration or release admission",
        "changes": [
            "Four print statements use Python 3 function syntax",
            "Two OneHotEncoder calls use sparse_output=False",
        ],
        "files": [
            {"name": name, "url": UPSTREAM_URL + name,
             "source_sha256": SOURCE_HASHES[name],
             "prepared_sha256": sha256(data)}
            for name, data in adapted.items()
        ],
    }
    # All validation precedes creation. mkdir reserves the output path without
    # replacing an existing directory, file or symlink.
    output_dir.mkdir()
    try:
        for name, data in adapted.items():
            (output_dir / name).write_bytes(data)
        (output_dir / "preparation.json").write_text(
            json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
        )
    except OSError:
        shutil.rmtree(output_dir)
        raise
    return manifest


def main(argv: list[str] | None = None) -> int:
    """Prepare explicitly named local files and report failures without a trace."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        prepare(args.source_dir, args.output_dir)
    except (OSError, ValueError, SyntaxError) as error:
        print(f"Promoter Calculator preparation failed: {error}", file=sys.stderr)
        return 1
    print(f"Prepared the pinned model in {args.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
