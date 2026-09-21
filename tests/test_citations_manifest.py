"""Keep the public source ledger tied to the data actually shipped in Git."""

import json
import subprocess
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "site/data/citations.json"
RAW_PREFIX = (
    "https://raw.githubusercontent.com/rohinshanker/"
    "isaacs-cyano-gene-selection/refs/heads/main/"
)


def load_manifest():
    """Return the checked-in public citation ledger."""
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def download_paths():
    """Return every repository path offered for download."""
    return {
        item["repoPath"]
        for section in load_manifest()["sections"]
        for source in section["items"]
        for item in source["downloads"]
    }


def test_sections_and_citations_are_complete():
    """Data must precede non-data references, with no empty attribution."""
    sections = load_manifest()["sections"]
    assert [section["id"] for section in sections] == [
        "primary-data", "methods-and-tools"
    ]
    ids = []
    for section in sections:
        assert section["title"].strip()
        assert section["description"].strip()
        assert section["items"]
        for item in section["items"]:
            ids.append(item["id"])
            assert item["citation"].strip()
            assert item["contribution"].strip()
            assert urlparse(item["url"]).scheme == "https"
            assert isinstance(item["downloads"], list)
    assert len(ids) == len(set(ids))
    assert {
        "yu-2015", "ncbi-utex-2973", "tan-2018", "simkovsky-2022",
        "ncbi-pcc-7942", "gene-ontology"
    } == {item["id"] for item in sections[0]["items"]}
    assert all(not item["downloads"] for item in sections[1]["items"])


def test_all_downloads_are_repository_files_with_exact_names():
    """Every public download resolves to a tracked file with no path spoofing."""
    downloads = [
        item
        for section in load_manifest()["sections"]
        for source in section["items"]
        for item in source["downloads"]
    ]
    assert downloads
    for item in downloads:
        relative = Path(item["repoPath"])
        assert not relative.is_absolute()
        assert ".." not in relative.parts
        assert relative.name == item["filename"]
        assert (ROOT / relative).is_file()
        assert item["url"] == RAW_PREFIX + relative.as_posix()
        assert item["kind"].strip()
        tracked = subprocess.run(
            ["git", "ls-files", "--error-unmatch", relative.as_posix()],
            cwd=ROOT,
            capture_output=True,
            check=False,
        )
        assert tracked.returncode == 0, relative
    assert len(downloads) == len(download_paths())


def test_every_retained_external_data_source_is_attributed():
    """Expression and annotation source inventories cannot silently grow."""
    expression = json.loads(
        (ROOT / "data/expression/sources.json").read_text(encoding="utf-8")
    )
    required = {f"data/expression/{source['file']}" for source in expression}
    annotation = json.loads(
        (ROOT / "data/manifest/annotation-release-v1.json").read_text(
            encoding="utf-8"
        )
    )
    for source in annotation["sources"]:
        required.update(
            item["localPath"]
            for item in source["files"]
            if item.get("localPath") and item.get("retention") != "downloaded-at-build"
        )
    required.update({
        "data/raw/md5checksums.txt",
        "data/expression/tan2018_utex2973_tss_table_s1.tsv",
        "data/trna/anticodon_gene_copies.tsv",
        "data/annotation/releases/"
        "GCF_000817325.1-RS_2026_05_13/go-annotations-v1.tsv",
        "data/annotation/releases/"
        "GCF_000817325.1-RS_2026_05_13/identifier-crosswalk-v1.tsv",
        "data/annotation/releases/"
        "GCF_000817325.1-RS_2026_05_13/annotation-evidence-v1.jsonl",
    })
    assert required <= download_paths()
