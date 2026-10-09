"""A link check must distinguish bytes, changed inputs and access failures."""

import hashlib
import gzip
from http.client import IncompleteRead
import io
import json
import zipfile
from urllib.error import HTTPError, URLError

import pytest

from tools import check_source_catalogue as catalogue


ARTIFACT = {"filename": "input.txt", "url": "https://example.test/input.txt", "version": "v1"}
DATE = "2026-10-09T04:00:00Z"


class Response(io.BytesIO):
    """A streaming response with independently configurable transport metadata."""

    def __init__(self, body=b"input bytes", *, url=ARTIFACT["url"], status=200,
                 content_type="application/octet-stream", content_length=None):
        super().__init__(body)
        self.url = url
        self.status = status
        self.headers = {"Content-Type": content_type}
        if content_length is not None:
            self.headers["Content-Length"] = str(content_length)

    def geturl(self):
        return self.url


def observe(artifact=ARTIFACT, **kwargs):
    """Check one response under a fixed observation date."""
    return catalogue.check_artifact(artifact, opener=lambda *args, **options: Response(**kwargs), checked_at=DATE)


def test_complete_stream_is_hashed_without_retaining_or_mutating_input():
    body = b"a" * 150000
    result = observe(body=body)
    assert result["bytes"] == len(body)
    assert result["sha256"] == hashlib.sha256(body).hexdigest()
    assert result["linkCheck"] == {"checkedAt": DATE, "result": "verified", "detail": "HTTP 200; complete file retrieved."}
    assert "linkCheck" not in ARTIFACT


def test_changed_upstream_is_distinct_from_matching_pinned_input():
    digest = hashlib.sha256(b"input bytes").hexdigest()
    assert observe({**ARTIFACT, "pinnedSha256": digest})["linkCheck"]["result"] == "verified"
    changed = observe({**ARTIFACT, "pinnedSha256": "0" * 64})
    assert changed["linkCheck"]["result"] == "changed"
    assert changed["pinnedSha256"] == "0" * 64


@pytest.mark.parametrize("kwargs", [
    {"body": b""}, {"body": b"<!doctype html><html>Access</html>"},
    {"content_type": "text/html"}, {"status": 206},
    {"url": "http://example.test/input.txt"},
])
def test_invalid_or_partial_response_never_gets_a_file_checksum(kwargs):
    result = observe(**kwargs)
    assert result["linkCheck"]["result"] == "unavailable"
    assert result["linkCheck"]["detail"]
    assert result["bytes"] is None and result["sha256"] is None


def zip_bytes():
    """A complete tiny ZIP, including its central directory and CRC."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("input.txt", b"input bytes")
    return buffer.getvalue()


@pytest.mark.parametrize(("compression", "body"), [
    ("gzip", gzip.compress(b"input bytes")), ("zip", zip_bytes()),
])
def test_declared_binary_container_is_checked(compression, body):
    artifact = {**ARTIFACT, "compression": compression}
    assert observe(artifact, body=body)["linkCheck"]["result"] == "verified"
    assert observe(artifact, body=b"wrong bytes")["linkCheck"]["result"] == "unavailable"


@pytest.mark.parametrize(("compression", "body"), [
    ("gzip", b"\x1f\x8b"), ("gzip", gzip.compress(b"input bytes")[:-4]),
    ("zip", b"PK"), ("zip", zip_bytes()[:-8]),
])
def test_truncated_compressed_files_are_not_reported_as_complete(compression, body):
    result = observe({**ARTIFACT, "compression": compression}, body=body,
                     content_length=len(body))
    assert result["linkCheck"]["result"] == "unavailable"
    assert result["bytes"] is None and result["sha256"] is None


def test_premature_eof_and_http_stream_errors_clear_observed_identity():
    result = observe(body=b"input bytes", content_length=100)
    assert result["linkCheck"]["result"] == "unavailable"
    assert "declared file length" in result["linkCheck"]["detail"]
    def opener(*args, **kwargs):
        raise IncompleteRead(b"input", 100)
    result = catalogue.check_artifact(ARTIFACT, opener=opener, checked_at=DATE)
    assert result["linkCheck"]["result"] == "unavailable"
    assert result["bytes"] is None and result["sha256"] is None


def test_corrupt_deflate_is_a_dated_failed_observation_not_a_refresh_exception():
    body = bytearray(gzip.compress(b"input bytes" * 100))
    body[10] = 0x07
    result = observe({**ARTIFACT, "compression": "gzip"}, body=bytes(body),
                     content_length=len(body))
    assert result["linkCheck"]["result"] == "unavailable"
    assert result["bytes"] is None and result["sha256"] is None
    assert result["linkCheck"]["checkedAt"] == DATE


def test_publisher_entry_is_not_hashed_as_the_original_dataset():
    result = observe({**ARTIFACT, "sourcePage": True}, body=b"<html>Publisher</html>")
    assert result["bytes"] is None and result["sha256"] is None
    assert result["linkCheck"]["result"] == "unavailable"
    assert "direct file URL" in result["linkCheck"]["detail"]


@pytest.mark.parametrize("error", [
    HTTPError(ARTIFACT["url"], 403, "Forbidden", {}, None),
    URLError("offline"), TimeoutError("timed out"), OSError("interrupted"),
])
def test_access_failures_are_dated_and_clear_stale_observations(error):
    def opener(*args, **kwargs):
        raise error
    result = catalogue.check_artifact({**ARTIFACT, "bytes": 10, "sha256": "0" * 64}, opener=opener, checked_at=DATE)
    assert result["linkCheck"]["checkedAt"] == DATE
    assert result["linkCheck"]["result"] == "unavailable"
    assert result["bytes"] is None and result["sha256"] is None


def test_non_https_link_is_refused_before_network_access():
    assert observe({**ARTIFACT, "url": "file:///private"})["linkCheck"]["result"] == "unavailable"


def test_refresh_preserves_unrelated_citations_and_downloads():
    retained = {"filename": "retained.tsv"}
    manifest = {"sections": [{"items": [{"downloads": [retained]}, {"upstreamArtifacts": [ARTIFACT]}]}]}
    assert catalogue.refresh_catalogue(manifest, checker=lambda item: observe(item)) == 1
    assert manifest["sections"][0]["items"][0] == {"downloads": [retained]}


def test_command_refreshes_only_the_requested_manifest(tmp_path, monkeypatch, capsys):
    path = tmp_path / "citations.json"
    path.write_text(json.dumps({"sections": [{"items": []}]}))
    monkeypatch.setattr(catalogue, "refresh_catalogue", lambda manifest: 0)
    assert catalogue.main(["--manifest", str(path)]) == 0
    assert json.loads(path.read_text()) == {"sections": [{"items": []}]}
    assert "Checked 0" in capsys.readouterr().out


def test_default_check_date_is_an_actual_utc_observation():
    result = catalogue.check_artifact(ARTIFACT, opener=lambda *args, **kwargs: Response())
    assert result["linkCheck"]["checkedAt"].endswith("Z")
