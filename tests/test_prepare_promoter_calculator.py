"""The compatibility preparation must be exact, local and non-destructive."""

import json
from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import prepare_promoter_calculator as prep


@pytest.fixture
def sources(tmp_path, monkeypatch):
    directory = tmp_path / "source"
    directory.mkdir()
    payloads = {
        "Promoter_Calculator_v1_0.py": b'print "a"\nprint "b"\nprint "c"\nprint "d"\n',
        "util.py": b'a = OneHotEncoder(sparse=False)\nb = OneHotEncoder(sparse=False)\n',
        "free_energy_coeffs.npy": b"fixed-coefficients",
        "model_intercept.npy": b"fixed-intercept",
        "LICENSE": b"preserved-license",
        "README.md": b"preserved-readme",
    }
    for name, value in payloads.items():
        (directory / name).write_bytes(value)
    expected = {
        "Promoter_Calculator_v1_0.py": b'print("a")\nprint("b")\nprint("c")\nprint("d")\n',
        "util.py": payloads["util.py"].replace(b"sparse=", b"sparse_output="),
    }
    monkeypatch.setattr(prep, "SOURCE_HASHES", {n: prep.sha256(v) for n, v in payloads.items()})
    monkeypatch.setattr(prep, "ADAPTED_HASHES", {n: prep.sha256(v) for n, v in expected.items()})
    return directory, payloads, expected


def test_preserves_model_and_licenses_and_records_exact_changes(sources, tmp_path):
    directory, payloads, expected = sources
    output = tmp_path / "prepared"
    manifest = prep.prepare(directory, output)
    for name, original in payloads.items():
        assert (directory / name).read_bytes() == original
        assert (output / name).read_bytes() == expected.get(name, original)
    assert json.loads((output / "preparation.json").read_text()) == manifest
    assert len(manifest["files"]) == 6
    assert all(f["url"].endswith(f["name"]) for f in manifest["files"])
    for item in manifest["files"]:
        assert item["source_sha256"] == prep.sha256(payloads[item["name"]])
        assert item["prepared_sha256"] == prep.sha256((output / item["name"]).read_bytes())
    second = tmp_path / "second"
    assert prep.prepare(directory, second) == manifest
    assert (second / "preparation.json").read_bytes() == (output / "preparation.json").read_bytes()


@pytest.mark.parametrize("name", tuple(prep.SOURCE_HASHES))
def test_rejects_each_changed_upstream_file_before_writing(sources, tmp_path, name):
    directory, _, _ = sources
    (directory / name).write_bytes(b"unexpected")
    output = tmp_path / "prepared"
    with pytest.raises(ValueError, match="Upstream checksum mismatch"):
        prep.prepare(directory, output)
    assert not output.exists()


def test_missing_source_creates_nothing(sources, tmp_path):
    directory, _, _ = sources
    (directory / "LICENSE").unlink()
    output = tmp_path / "prepared"
    with pytest.raises(FileNotFoundError):
        prep.prepare(directory, output)
    assert not output.exists()


@pytest.mark.parametrize("kind", ["directory", "file", "symlink", "dangling"])
def test_never_replaces_existing_paths(sources, tmp_path, kind):
    directory, _, _ = sources
    output = tmp_path / "prepared"
    if kind == "directory":
        output.mkdir()
        (output / "keep").write_text("original")
    elif kind == "file":
        output.write_text("original")
    else:
        output.symlink_to(directory if kind == "symlink" else tmp_path / "absent")
    with pytest.raises(FileExistsError):
        prep.prepare(directory, output)
    assert (directory / "LICENSE").read_bytes() == b"preserved-license"
    if kind == "directory":
        assert (output / "keep").read_text() == "original"
    elif kind == "file":
        assert output.read_text() == "original"
    else:
        assert output.is_symlink()


@pytest.mark.parametrize("name,value,error", [
    ("Promoter_Calculator_v1_0.py", b'print "a"\n', "four Python 2"),
    ("util.py", b"a = OneHotEncoder(sparse=False)\n", "two legacy"),
    ("util.py", b"# unexpected\na = OneHotEncoder(sparse=False)\nb = OneHotEncoder(sparse=False)\n", "Adapted checksum"),
])
def test_adaptation_rejects_an_unexpected_transformation(sources, name, value, error):
    _, payloads, _ = sources
    payloads[name] = value
    with pytest.raises(ValueError, match=error):
        prep.adapt_sources(payloads)


def test_adaptation_compiles_without_executing(sources, monkeypatch):
    _, payloads, _ = sources
    name = "Promoter_Calculator_v1_0.py"
    payloads[name] += b"if\n"
    expected = b'print("a")\nprint("b")\nprint("c")\nprint("d")\nif\n'
    monkeypatch.setitem(prep.ADAPTED_HASHES, name, prep.sha256(expected))
    with pytest.raises(SyntaxError):
        prep.adapt_sources(payloads)


def test_incomplete_new_output_is_removed_on_write_failure(sources, tmp_path, monkeypatch):
    directory, _, _ = sources
    output = tmp_path / "prepared"
    original = Path.write_bytes

    def fail_model(path, content):
        if path.parent == output and path.name == "free_energy_coeffs.npy":
            raise OSError("disk error")
        return original(path, content)

    monkeypatch.setattr(Path, "write_bytes", fail_model)
    with pytest.raises(OSError, match="disk error"):
        prep.prepare(directory, output)
    assert not output.exists()
    assert (directory / "free_energy_coeffs.npy").read_bytes() == b"fixed-coefficients"


def test_cli_success_and_failure(sources, tmp_path, capsys):
    directory, _, _ = sources
    output = tmp_path / "prepared"
    args = ["--source-dir", str(directory), "--output-dir", str(output)]
    assert prep.main(args) == 0
    assert "Prepared" in capsys.readouterr().out
    assert prep.main(args) == 1
    assert "preparation failed" in capsys.readouterr().err


def test_cli_requires_explicit_directories():
    with pytest.raises(SystemExit) as error:
        prep.main([])
    assert error.value.code == 2


def test_compile_really_does_not_execute_source(sources, monkeypatch):
    _, payloads, expected = sources
    name = "Promoter_Calculator_v1_0.py"
    payloads[name] += b'raise RuntimeError("must not execute")\n'
    expected[name] += b'raise RuntimeError("must not execute")\n'
    monkeypatch.setitem(prep.ADAPTED_HASHES, name, prep.sha256(expected[name]))
    assert prep.adapt_sources(payloads)[name] == expected[name]


def test_indented_print_syntax_is_preserved(sources, monkeypatch):
    _, payloads, _ = sources
    name = "Promoter_Calculator_v1_0.py"
    payloads[name] = b'def probe():\n    print "a"\n    print "b"\n    print "c"\n    print "d"\n'
    expected = b'def probe():\n    print("a")\n    print("b")\n    print("c")\n    print("d")\n'
    monkeypatch.setitem(prep.ADAPTED_HASHES, name, prep.sha256(expected))
    assert prep.adapt_sources(payloads)[name] == expected


def test_failed_adaptation_and_missing_parent_create_nothing(sources, tmp_path, monkeypatch):
    directory, _, _ = sources
    output = tmp_path / "missing-parent" / "prepared"
    with pytest.raises(FileNotFoundError):
        prep.prepare(directory, output)
    assert not output.exists()
    monkeypatch.setitem(prep.ADAPTED_HASHES, "util.py", "0" * 64)
    output = tmp_path / "prepared"
    with pytest.raises(ValueError, match="Adapted checksum"):
        prep.prepare(directory, output)
    assert not output.exists()


def test_interrupt_removes_new_directory(sources, tmp_path, monkeypatch):
    directory, _, _ = sources
    output = tmp_path / "prepared"

    def interrupted(*args):
        raise KeyboardInterrupt()

    monkeypatch.setattr(Path, "write_bytes", interrupted)
    with pytest.raises(KeyboardInterrupt):
        prep.prepare(directory, output)
    assert not output.exists()


def test_cleanup_failure_preserves_original_error(sources, tmp_path, monkeypatch):
    directory, _, _ = sources
    output = tmp_path / "prepared"

    def write_failure(*args):
        raise OSError("original write error")

    def cleanup_failure(*args):
        raise OSError("cleanup error")

    monkeypatch.setattr(Path, "write_bytes", write_failure)
    monkeypatch.setattr(prep.shutil, "rmtree", cleanup_failure)
    with pytest.raises(OSError, match="original write error") as error:
        prep.prepare(directory, output)
    assert str(error.value.__cause__) == "cleanup error"


def test_actual_pinned_upstream_preparation_and_runtime(tmp_path):
    """Optional external-artifact test: no download and no mocked source pins."""
    import os
    import subprocess

    path = os.environ.get("PROMOTER_CALCULATOR_SOURCE_DIR")
    if not path:
        pytest.skip("Set PROMOTER_CALCULATOR_SOURCE_DIR to verified upstream downloads")
    output = tmp_path / "prepared"
    manifest = prep.prepare(Path(path), output)
    assert manifest["upstream_commit"] == "46da9132740bce30bccd107f02808adf2215e2f0"
    script = '''
import math, sys
sys.path.insert(0, sys.argv[1])
from Promoter_Calculator_v1_0 import Promoter_Calculator, _revcomp
model = Promoter_Calculator()
sequence = ('ACGTTGCA' * 32)[:250]
for oriented in (sequence, _revcomp(sequence)):
    states, layouts = model.predict(oriented, [80, 171])
    assert set(states) == set(range(80, 171))
    assert all(len(layouts[i]) == 30 for i in states)
    for i, state in states.items():
        assert state['ITR'] == oriented[i:i+20]
        assert math.isfinite(float(state['dG_total']))
        assert math.isfinite(float(state['Tx_rate']))
print('182 full-coverage states passed')
'''
    result = subprocess.run(
        [sys.executable, "-c", script, str(output)], check=True,
        capture_output=True, text=True, timeout=30,
    )
    assert result.stdout.strip() == "182 full-coverage states passed"
