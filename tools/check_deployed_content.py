#!/usr/bin/env python3
"""Compare selected public site files with bytes from an immutable Git commit.

This read-only check complements workflow and browser validation. Paths are
relative to site/, and only regular files committed in that directory qualify.
"""

from __future__ import annotations

import argparse
import hashlib
from http.client import HTTPException
import math
from pathlib import Path, PurePosixPath
import subprocess
import sys
from urllib.parse import quote, urlsplit, urlunsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]


def git_bytes(root: Path, *arguments: str) -> bytes:
    """Read Git output without changing the index or working tree."""
    result = subprocess.run(
        ["git", "-C", str(root), *arguments], capture_output=True, check=False,
    )
    if result.returncode:
        raise ValueError(result.stderr.decode("utf-8", errors="replace").strip())
    return result.stdout


def committed_files(root: Path, revision: str, paths: list[str]) -> tuple[str, dict[str, bytes]]:
    """Resolve once, then read only selected regular site files from that commit."""
    commit = git_bytes(
        root, "rev-parse", "--verify", "--end-of-options", f"{revision}^{{commit}}",
    ).decode().strip()
    entries = git_bytes(root, "ls-tree", "-r", "-z", commit, "--", "site/")
    regular = {}
    for entry in entries.split(b"\0"):
        if not entry:
            continue
        metadata, name = entry.split(b"\t", 1)
        mode, kind, object_id = metadata.split()
        if mode in (b"100644", b"100755") and kind == b"blob":
            regular[name.decode("utf-8")] = object_id.decode("ascii")
    if not paths:
        raise ValueError("select at least one site-relative path")
    selected = {}
    for path in paths:
        parts = PurePosixPath(path).parts
        if (not parts or path.startswith("/") or "\\" in path
                or any(part in ("", ".", "..") for part in path.split("/"))
                or any(ord(char) < 32 or ord(char) == 127 for char in path)):
            raise ValueError(f"invalid site-relative path: {path!r}")
        object_id = regular.get(f"site/{path}")
        if object_id is None:
            raise ValueError(f"not a committed regular site file: {path}")
        selected[path] = git_bytes(root, "cat-file", "blob", object_id)
    return commit, selected


def base_url(value: str) -> str:
    """Require an explicit HTTP(S) directory URL without credentials or queries."""
    parsed = urlsplit(value)
    if (parsed.scheme not in ("http", "https") or not parsed.hostname
            or parsed.username is not None or parsed.password is not None
            or parsed.query or parsed.fragment
            or any(char.isspace() for char in value)):
        raise ValueError("base URL must be an HTTP(S) directory without credentials, query or fragment")
    # Accessing port also validates malformed port values before any request.
    _ = parsed.port
    return urlunsplit(parsed._replace(path=parsed.path.rstrip("/") + "/"))


def compare_file(url: str, expected: bytes, timeout: float) -> tuple[bool, str]:
    """Stream at most expected size + 1 bytes, rejecting any retrieval failure."""
    expected_hash = hashlib.sha256(expected).hexdigest()
    request = Request(url, headers={"Accept-Encoding": "identity", "Cache-Control": "no-cache"})
    try:
        with urlopen(request, timeout=timeout) as response:
            if response.status != 200:
                raise ValueError(f"unexpected HTTP status {response.status}")
            encoding = response.headers.get("Content-Encoding", "identity").lower()
            if encoding != "identity":
                raise ValueError(f"unexpected content encoding: {encoding}")
            declared = response.headers.get("Content-Length")
            if declared is not None and int(declared) != len(expected):
                raise ValueError(
                    f"Content-Length is {declared}; expected {len(expected)} bytes",
                )
            digest = hashlib.sha256()
            received = 0
            while received <= len(expected):
                chunk = response.read(min(64 * 1024, len(expected) + 1 - received))
                if not chunk:
                    break
                received += len(chunk)
                digest.update(chunk)
            if received > len(expected):
                return False, f"expected {len(expected)} bytes; received at least {received} (oversized)"
    except (OSError, ValueError, HTTPException) as error:
        return False, f"retrieval failed: {error}"
    actual_hash = digest.hexdigest()
    if received != len(expected) or actual_hash != expected_hash:
        return False, (f"expected {len(expected)} bytes sha256={expected_hash}; "
                       f"received {received} bytes sha256={actual_hash}")
    return True, f"{received} bytes sha256={actual_hash}"


def main(argv: list[str] | None = None, *, root: Path = ROOT) -> int:
    """Return 0 for selected-byte equality, 1 for failures, 2 for invalid input."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True, help="public site directory URL")
    parser.add_argument("--ref", required=True, help="commit or ref to resolve once")
    parser.add_argument("--path", action="append", required=True, help="site-relative file; repeat to select more")
    parser.add_argument("--timeout", type=float, default=20, help="socket timeout in seconds (default: 20)")
    args = parser.parse_args(argv)
    try:
        if not math.isfinite(args.timeout) or args.timeout <= 0:
            raise ValueError("timeout must be positive and finite")
        base = base_url(args.base_url)
        commit, files = committed_files(root, args.ref, args.path)
    except ValueError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2
    print(f"Commit {commit}; checking {len(files)} selected file(s) at {base}")
    failures = 0
    for path, expected in files.items():
        # The resolved commit keys the request; no-cache requests revalidation.
        url = f"{base}{quote(path, safe='/')}?verify={commit}"
        passed, detail = compare_file(url, expected, args.timeout)
        print(f"{'PASS' if passed else 'FAIL'} {path}: {detail}", flush=True)
        failures += not passed
    print(f"Checked {len(files)} selected file(s): {len(files) - failures} passed, {failures} failed.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
