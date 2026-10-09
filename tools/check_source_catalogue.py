"""Refresh dated upstream-file observations without retaining source bytes.

The catalogue belongs to citations.json, separate from project-file downloads.
Every check records the UTC time and an explicit result. A checksum describes
the retrieved file, never an HTML access page or a failed request.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parents[1]


def check_artifact(artifact: dict, *, opener=urlopen, checked_at: str | None = None) -> dict:
    """Return one new observation; do not change the artifact or retain bytes."""
    result = {**artifact, "bytes": None, "sha256": None}
    checked_at = checked_at or datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    check = {"checkedAt": checked_at, "result": "unavailable", "detail": None}
    result["linkCheck"] = check
    try:
        if urlparse(artifact["url"]).scheme != "https":
            raise ValueError("Catalogue links must use HTTPS.")
        with opener(artifact["url"], timeout=30) as response:
            if urlparse(response.geturl()).scheme != "https":
                raise ValueError("Upstream redirected away from HTTPS.")
            status = response.status
            if status != 200:
                raise ValueError(f"HTTP {status}; no complete file was retrieved.")
            if artifact.get("sourcePage"):
                check["detail"] = "Publisher entry reached; direct file URL, size and checksum remain unverified."
                return result
            digest = hashlib.sha256()
            total = 0
            first = response.read(65536)
            content_type = response.headers.get("Content-Type", "").lower()
            if "html" in content_type or first.lstrip().lower().startswith((b"<!doctype html", b"<html")):
                raise ValueError("Upstream returned an HTML access page, not the source file.")
            compression = artifact.get("compression")
            if compression == "gzip" and not first.startswith(b"\x1f\x8b"):
                raise ValueError("Upstream response is not the declared gzip file.")
            if compression == "zip" and not first.startswith(b"PK"):
                raise ValueError("Upstream response is not the declared ZIP-based file.")
            chunk = first
            while chunk:
                digest.update(chunk)
                total += len(chunk)
                chunk = response.read(65536)
            if total == 0:
                raise ValueError("Upstream returned an empty file.")
            result["bytes"] = total
            result["sha256"] = digest.hexdigest()
            pinned = artifact.get("pinnedSha256")
            check["result"] = "changed" if pinned and pinned != result["sha256"] else "verified"
            check["detail"] = f"HTTP {status}; complete file retrieved."
    except HTTPError as error:
        check["detail"] = f"HTTP {error.code}; source file could not be retrieved."
    except (URLError, TimeoutError, OSError, ValueError) as error:
        check["detail"] = str(error)
    return result


def refresh_catalogue(manifest: dict, *, checker=check_artifact) -> int:
    """Refresh only catalogue entries, preserving citations and downloads."""
    count = 0
    for section in manifest["sections"]:
        for item in section["items"]:
            if "upstreamArtifacts" not in item:
                continue
            item["upstreamArtifacts"] = [checker(artifact) for artifact in item["upstreamArtifacts"]]
            count += len(item["upstreamArtifacts"])
    return count


def main(argv: list[str] | None = None) -> int:
    """Check the selected catalogue and write its dated observations."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=ROOT / "site/data/citations.json")
    args = parser.parse_args(argv)
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    count = refresh_catalogue(manifest)
    args.manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Checked {count} upstream catalogue entries; source bytes were not retained.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
