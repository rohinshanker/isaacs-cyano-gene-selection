"""A changed archive must not replace a pinned extracted input."""

import hashlib
import http.client
import io
import sys
import urllib.error
import zipfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import fetch_recoded_ecoli as fetch  # noqa: E402


def pin(name, data):
    return fetch.PinnedFile(name, len(data), hashlib.sha256(data).hexdigest(), "fixture")


def archive_bytes(members):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as handle:
        for name, content in members.items():
            handle.writestr(name, content)
    return output.getvalue()


def test_verify_checks_missing_size_and_digest(tmp_path):
    pinned = pin("data", b"expected")
    assert fetch.verify(tmp_path / "data", pinned) == ["data: missing"]
    (tmp_path / "data").write_bytes(b"bad")
    assert len(fetch.verify(tmp_path / "data", pinned)) == 2
    (tmp_path / "data").write_bytes(b"expected")
    assert fetch.verify(tmp_path / "data", pinned) == []


def test_member_paths_cannot_escape_and_missing_members_fail(tmp_path):
    path = tmp_path / "source.zip"
    path.write_bytes(archive_bytes({"../../safe.txt": b"hello"}))
    dest = tmp_path / "dest"
    assert fetch.extract_members(path, ["../../safe.txt"], dest) == ["safe.txt"]
    assert (dest / "safe.txt").read_bytes() == b"hello"
    with pytest.raises(RuntimeError, match="no member"):
        fetch.extract_members(path, ["absent"], dest)


def test_bad_archive_leaves_existing_member_untouched(monkeypatch, tmp_path):
    archive = tmp_path / "source" / fetch.SOURCE_ARCHIVE
    archive.parent.mkdir()
    archive.write_bytes(archive_bytes({"important": b"changed"}))
    (tmp_path / "important").write_bytes(b"keep")
    monkeypatch.setattr(fetch, "PINNED_ARCHIVE", pin(fetch.SOURCE_ARCHIVE, b"other"))
    monkeypatch.setattr(fetch, "PINNED", (pin("important", b"keep"),))
    assert fetch.main(["--dest", str(tmp_path)]) == 1
    assert (tmp_path / "important").read_bytes() == b"keep"


def test_fetch_and_verify_only(monkeypatch, tmp_path):
    data = archive_bytes({"member": b"pinned"})
    bundle = archive_bytes({fetch.SOURCE_ARCHIVE: data})
    monkeypatch.setattr(fetch, "PINNED_ARCHIVE", pin(fetch.SOURCE_ARCHIVE, data))
    monkeypatch.setattr(fetch, "PINNED", (pin("member", b"pinned"),))
    def download(url, dest):
        dest.parent.mkdir(parents=True)
        dest.write_bytes(bundle)
    monkeypatch.setattr(fetch, "download", download)
    assert fetch.main(["--dest", str(tmp_path)]) == 0
    assert fetch.main(["--dest", str(tmp_path), "--verify-only"]) == 0
    (tmp_path / "member").write_bytes(b"modified")
    assert fetch.main(["--dest", str(tmp_path), "--verify-only"]) == 1
    assert fetch.main(["--dest", str(tmp_path)]) == 0


def test_download_replaces_destination_only_after_success(monkeypatch, tmp_path):
    class Response(io.BytesIO):
        status = 200
    monkeypatch.setattr(fetch.urllib.request, "urlopen", lambda *a, **kw: Response(b"new"))
    dest = tmp_path / "nested" / "download.zip"
    fetch.download("https://example.test/data", dest)
    assert dest.read_bytes() == b"new"
    assert not dest.with_suffix(".zip.part").exists()
    Response.status = 503
    with pytest.raises(RuntimeError, match="HTTP 503"):
        fetch.download("https://example.test/data", dest)
    assert dest.read_bytes() == b"new"


def test_interrupted_body_restarts_without_replacing_existing_file(monkeypatch, tmp_path):
    class Response(io.BytesIO):
        status = 200

    class InterruptedResponse(Response):
        def read(self, size=-1):
            if self.tell():
                raise http.client.IncompleteRead(b"cut off")
            return super().read(size)

    dest = tmp_path / "download.zip"
    dest.write_bytes(b"original")
    calls = []
    delays = []

    def open_url(url, timeout):
        assert timeout == 900
        assert dest.read_bytes() == b"original"
        assert not dest.with_suffix(".zip.part").exists()
        calls.append(url)
        return InterruptedResponse(b"partial") if len(calls) == 1 else Response(b"complete")

    monkeypatch.setattr(fetch.urllib.request, "urlopen", open_url)
    monkeypatch.setattr(fetch.time, "sleep", delays.append)
    fetch.download("https://example.test/data", dest)
    assert len(calls) == 2
    assert delays == [5]
    assert dest.read_bytes() == b"complete"
    assert not dest.with_suffix(".zip.part").exists()


@pytest.mark.parametrize("error", [
    TimeoutError("timeout"),
    ConnectionResetError("reset"),
    urllib.error.URLError("connection failed"),
    *[urllib.error.HTTPError("https://example.test", code, "temporary", {}, None)
      for code in (408, 429, 500, 502, 503, 504)],
])
def test_transient_failures_have_bounded_retries(monkeypatch, tmp_path, error):
    dest = tmp_path / "download.zip"
    dest.write_bytes(b"original")
    calls = []
    delays = []

    def fail(url, timeout):
        calls.append(url)
        raise error

    monkeypatch.setattr(fetch.urllib.request, "urlopen", fail)
    monkeypatch.setattr(fetch.time, "sleep", delays.append)
    with pytest.raises(type(error)):
        fetch.download("https://example.test/data", dest)
    assert len(calls) == 3
    assert delays == [5, 10]
    assert dest.read_bytes() == b"original"
    assert not dest.with_suffix(".zip.part").exists()


@pytest.mark.parametrize("error", [
    urllib.error.HTTPError("https://example.test", 403, "forbidden", {}, None),
    urllib.error.HTTPError("https://example.test", 404, "missing", {}, None),
    OSError("disk full"),
])
def test_permanent_failures_are_not_retried(monkeypatch, tmp_path, error):
    class Response(io.BytesIO):
        status = 200

        def read(self, size=-1):
            raise error

    calls = []
    delays = []
    dest = tmp_path / "download.zip"
    dest.write_bytes(b"original")

    def open_url(url, timeout):
        calls.append(url)
        return Response(b"body")

    monkeypatch.setattr(fetch.urllib.request, "urlopen", open_url)
    monkeypatch.setattr(fetch.time, "sleep", delays.append)
    with pytest.raises(type(error)):
        fetch.download("https://example.test/data", dest)
    assert len(calls) == 1
    assert delays == []
    assert dest.read_bytes() == b"original"
    assert not dest.with_suffix(".zip.part").exists()
