"""Exercise committed-byte selection and real local HTTP deployment checks."""

from contextlib import contextmanager
from http.client import IncompleteRead
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import subprocess
import sys
import threading
from urllib.error import URLError
from urllib.parse import unquote, urlsplit

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import check_deployed_content as checker


@pytest.fixture
def repository(tmp_path):
    subprocess.run(["git", "init", "-q", str(tmp_path)], check=True)
    site = tmp_path / "site"
    site.mkdir()
    (site / "index.html").write_bytes(b"original")
    (site / "space #?.txt").write_bytes(b"")
    (site / "link").symlink_to("index.html")
    (tmp_path / "private.txt").write_bytes(b"outside site")
    subprocess.run(["git", "-C", str(tmp_path), "add", "."], check=True)
    subprocess.run([
        "git", "-C", str(tmp_path), "-c", "user.name=Test", "-c",
        "user.email=test@example.invalid", "commit", "-qm", "fixture",
    ], check=True)
    return tmp_path


@contextmanager
def serve(routes):
    """Serve status/header/body fixtures; capture the actual request paths/headers."""
    requests = []

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            requests.append((self.path, self.headers))
            path = unquote(urlsplit(self.path).path)
            status, headers, body = routes.get(path, (404, {}, b"missing"))
            self.send_response(status)
            for key, value in headers.items():
                self.send_header(key, value)
            if "Content-Length" not in headers and "X-Omit-Length" not in headers:
                self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}/project/", requests
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


def test_committed_bytes_ignore_workspace_and_deduplicate_paths(repository):
    (repository / "site/index.html").write_bytes(b"dirty working copy")
    (repository / "site/untracked.txt").write_bytes(b"not committed")
    commit, files = checker.committed_files(
        repository, "HEAD", ["index.html", "space #?.txt", "index.html"],
    )
    assert len(commit) == 40
    assert files == {"index.html": b"original", "space #?.txt": b""}


@pytest.mark.parametrize("path", [
    "", "/index.html", "../private.txt", "site/../private.txt", "./index.html",
    "dir//index.html", "index.html/", "dir\\file", "\nfile", "\x7ffile",
    "link", "private.txt", "untracked.txt",
])
def test_invalid_or_nonregular_paths_are_rejected(repository, path):
    with pytest.raises(ValueError, match="path|committed regular"):
        checker.committed_files(repository, "HEAD", [path])


def test_missing_selection_and_bad_revision_are_rejected(repository):
    with pytest.raises(ValueError, match="at least one"):
        checker.committed_files(repository, "HEAD", [])
    with pytest.raises(ValueError):
        checker.committed_files(repository, "no-such-ref", ["index.html"])


@pytest.mark.parametrize("value", [
    "file:///tmp/site", "ftp://example.org/site", "https:///site", "https://",
    "https://user:secret@example.org/site", "https://example.org/site?q=1",
    "https://example.org/site#fragment", "https://example.org/a b",
    "https://example.org:bad/site", "http://[broken",
])
def test_invalid_base_urls_are_rejected(value):
    with pytest.raises(ValueError):
        checker.base_url(value)


def test_base_url_normalizes_only_the_directory_separator():
    assert checker.base_url("https://example.org/project") == "https://example.org/project/"
    assert checker.base_url("http://localhost:80/") == "http://localhost:80/"


def test_main_checks_immutable_bytes_and_encoded_paths(repository, capsys):
    (repository / "site/index.html").write_bytes(b"dirty")
    routes = {
        "/project/index.html": (200, {}, b"original"),
        "/project/space #?.txt": (200, {}, b""),
    }
    with serve(routes) as (base, requests):
        result = checker.main([
            "--base-url", base.rstrip("/"), "--ref", "HEAD",
            "--path", "index.html", "--path", "space #?.txt",
        ], root=repository)
    assert result == 0
    output = capsys.readouterr().out
    assert "2 passed, 0 failed" in output
    assert "sha256=" in output
    assert requests[1][0].startswith("/project/space%20%23%3F.txt?verify=")
    assert requests[0][1]["Accept-Encoding"] == "identity"
    assert requests[0][1]["Cache-Control"] == "no-cache"


@pytest.mark.parametrize("body, fragment", [
    (b"modified", "sha256="),  # Same size, different digest.
    (b"short", "received 5 bytes"),
    (b"original-extra", "received at least 9 (oversized)"),
])
def test_stale_short_and_oversized_responses_fail(body, fragment):
    with serve({"/project/file": (200, {"X-Omit-Length": "1"}, body)}) as (base, _requests):
        passed, detail = checker.compare_file(base + "file", b"original", 2)
    assert not passed
    assert fragment in detail


@pytest.mark.parametrize("status, headers, fragment", [
    (404, {}, "HTTP Error 404"),
    (500, {}, "HTTP Error 500"),
    (206, {}, "unexpected HTTP status 206"),
    (200, {"Content-Encoding": "gzip"}, "unexpected content encoding"),
    (200, {"Content-Length": "20"}, "Content-Length is 20; expected 8 bytes"),
    (200, {"Content-Length": "invalid"}, "invalid literal"),
])
def test_http_failures_do_not_count_as_matches(status, headers, fragment):
    with serve({"/project/file": (status, headers, b"original")}) as (base, _requests):
        passed, detail = checker.compare_file(base + "file", b"original", 2)
    assert not passed
    assert fragment in detail


def test_large_response_is_hashed_across_multiple_chunks():
    body = bytes(range(256)) * 1024
    with serve({"/project/file": (200, {}, body)}) as (base, _requests):
        assert checker.compare_file(base + "file", body, 2)[0]


def test_redirect_compares_the_final_bytes():
    routes = {
        "/project/file": (302, {"Location": "/project/final"}, b""),
        "/project/final": (200, {}, b"original"),
    }
    with serve(routes) as (base, requests):
        assert checker.compare_file(base + "file", b"original", 2)[0]
        assert len(requests) == 2


@pytest.mark.parametrize("error", [
    URLError("offline"), TimeoutError("timed out"), IncompleteRead(b"partial", 10),
])
def test_transport_failures_are_reported(monkeypatch, error):
    def fail(*_args, **_kwargs):
        raise error
    monkeypatch.setattr(checker, "urlopen", fail)
    passed, detail = checker.compare_file("https://example.org/file", b"original", 2)
    assert not passed
    assert "retrieval failed" in detail


def test_main_reports_all_selected_files_after_a_failure(repository, capsys):
    with serve({"/project/space #?.txt": (200, {}, b"")}) as (base, requests):
        result = checker.main([
            "--base-url", base, "--ref", "HEAD", "--path", "index.html",
            "--path", "space #?.txt",
        ], root=repository)
    assert result == 1
    assert len(requests) == 2
    assert "1 passed, 1 failed" in capsys.readouterr().out


@pytest.mark.parametrize("arguments", [
    ["--timeout", "0"], ["--timeout", "-1"], ["--timeout", "nan"],
    ["--timeout", "inf"], ["--ref", "missing"], ["--base-url", "file:///tmp"],
])
def test_main_input_errors_return_two_without_network(repository, monkeypatch, capsys, arguments):
    def unexpected(*_args, **_kwargs):
        pytest.fail("invalid input must be rejected before any network request")
    monkeypatch.setattr(checker, "urlopen", unexpected)
    assert checker.main([
        "--base-url", "https://example.org/project/", "--ref", "HEAD",
        "--path", "index.html", *arguments,
    ], root=repository) == 2
    assert "ERROR:" in capsys.readouterr().err


def test_command_entrypoint_requires_explicit_arguments():
    result = subprocess.run(
        [sys.executable, str(Path(checker.__file__)), "--help"],
        capture_output=True, text=True, check=False,
    )
    assert result.returncode == 0
    assert "--path" in result.stdout
