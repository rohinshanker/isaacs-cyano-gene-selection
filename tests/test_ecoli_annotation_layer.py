"""Tests for tools/ecoli_annotation_layer.py over small synthetic inputs."""

import gzip
import hashlib
import io
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

import ecoli_annotation_layer as layer  # noqa: E402

GFF = """##gff-version 3
#!genome-build ASM584v2
##sequence-region NC_1 1 1000
NC_1\tRefSeq\tregion\t1\t1000\t.\t+\t.\tID=NC_1:1..1000;genome=chromosome;Is_circular=true
NC_1\tRefSeq\tgene\t10\t100\t.\t+\t.\tID=gene-b0001;locus_tag=b0001;gene_biotype=protein_coding
NC_1\tRefSeq\tCDS\t10\t100\t.\t+\t0\tID=cds-1;Parent=gene-b0001;locus_tag=b0001;protein_id=NP_1;inference=similar to AA sequence:x
NC_1\tRefSeq\tgene\t90\t200\t.\t-\t.\tID=gene-b0002;locus_tag=b0002;gene_biotype=protein_coding
NC_1\tRefSeq\tCDS\t90\t200\t.\t-\t0\tID=cds-2;Parent=gene-b0002;locus_tag=b0002;protein_id=NP_2
NC_1\tRefSeq\tgene\t210\t280\t.\t+\t.\tID=gene-b0003;locus_tag=b0003;gene_biotype=tRNA
NC_1\tRefSeq\tgene\t400\t500\t.\t+\t.\tID=gene-b0004;locus_tag=b0004;gene_biotype=protein_coding
NC_1\tRefSeq\tCDS\t400\t500\t.\t+\t0\tID=cds-4;Parent=gene-b0004;locus_tag=b0004;protein_id=NP_4
"""
UNIPROT = (
    "Entry\tEntry Name\tReviewed\tGene Names (primary)\tGene Names (ordered locus)\tGene Names (synonym)\t"
    "Protein names\tFunction [CC]\tRefSeq\tProtein existence\tLength\tDate of last modification\tEntry version\n"
    "P00001\tAAA_ECOLI\treviewed\taaa\tb0001 JW0001\t\tProtein A\tFUNCTION: Does A {ECO:0000269|PubMed:1}. FUNCTION: Also B. {ECO:0000250}.\tNP_1;\t"
    "Evidence at protein level\t30\t2026-06-10\t102\n"
    "P00002\tBBB_ECOLI\treviewed\tbbb\tb0002 b0004 JW0002\t\tProtein B (duplicated)\t\tNP_2;\tInferred from homology\t36\t2026-06-10\t50\n"
    "P00009\tZZZ_ECOLI\treviewed\tzzz\tJW9999\t\tNo locus here\tFUNCTION: Lost.\t\tPredicted\t10\t2026-06-10\t1\n"
)
GAF = (
    "!gaf-version: 2.2\n"
    "UniProtKB\tP00001\taaa\tenables\tGO:0000001\tPMID:1\tIDA\t\tF\tname\tsyn\tprotein\ttaxon:83333\t20260101\tEcoCyc\t\t\n"
    "UniProtKB\tP00002\tbbb\tinvolved_in\tGO:0000002\tGO_REF:1\tIEA\tInterPro:IPR1\tP\tname\tsyn\tprotein\ttaxon:83333\t20260101\tInterPro\t\t\n"
    "UniProtKB\tP00009\tzzz\tenables\tGO:0000001\tPMID:2\tIMP\t\tF\tname\tsyn\tprotein\ttaxon:83333\t20260101\tUniProt\t\t\n"
)
OBO = """format-version: 1.2
data-version: releases/2026-05-19

[Term]
id: GO:0000001
name: process one
namespace: biological_process

[Term]
id: GO:0000002
name: process two
namespace: biological_process
is_obsolete: true
"""


def inputs(tmp_path):
    gff = tmp_path / "genomic.gff.gz"
    with gzip.open(gff, "wt", encoding="utf-8") as handle:
        handle.write(GFF)
    folder = tmp_path / "annotation"
    folder.mkdir()
    (folder / layer.INPUTS["uniprot"]["name"]).write_text(UNIPROT, encoding="utf-8")
    (folder / layer.INPUTS["gaf"]["name"]).write_text(GAF, encoding="utf-8")
    obo = tmp_path / "go-basic.obo"
    obo.write_text(OBO, encoding="utf-8")
    return gff, folder, obo


def test_function_blocks_and_locus_join_are_read_from_uniprot(tmp_path):
    _, folder, _ = inputs(tmp_path)
    entries = layer.load_uniprot(folder / layer.INPUTS["uniprot"]["name"])
    assert entries["P00001"]["function"] == ["Does A.", "Also B."], "UniProt's inline ECO tags are markup, dropped, and the period they split is mended"
    assert entries["P00001"]["loci"] == ["b0001"]
    assert entries["P00002"]["loci"] == ["b0002", "b0004"], "an entry may name several loci"
    assert entries["P00009"]["loci"] == [], "a JW number is not a b number"
    assert entries["P00001"]["entryVersion"] == 102 and entries["P00001"]["reviewed"] is True


def test_build_joins_evidence_go_rows_and_names_without_guessing(tmp_path):
    gff, folder, obo = inputs(tmp_path)
    files, names = layer.build(obo, gff_path=gff, input_dir=folder, verify=False)
    records = {json.loads(line)["locusTag"]: json.loads(line)
               for line in files["annotation-evidence-v1.jsonl"].decode("utf-8").splitlines()}
    assert sorted(records) == ["b0001", "b0002", "b0003", "b0004"]
    a = records["b0001"]
    assert a["curatedFunction"]["accession"] == "P00001"
    assert a["curatedFunction"]["function"] == ["Does A.", "Also B."]
    assert a["curatedFunction"]["mappingAmbiguity"] == ""
    assert a["overlappingCds"] == [{"locusTag": "b0002", "overlapNt": 11}]
    assert a["inferences"] == ["similar to AA sequence:x"]
    assert a["annotationMethods"] == ["RefSeq"]
    assert a["proteinNameEvidence"] == []
    b = records["b0002"]
    assert b["curatedFunction"]["mappingAmbiguity"] == "entry names several loci: b0002, b0004"
    assert b["curatedFunction"]["function"] == []
    assert records["b0004"]["curatedFunction"]["accession"] == "P00002"
    assert records["b0003"]["curatedFunction"] is None, "a tRNA gene has no UniProt entry"
    assert records["b0002"]["nearbyNoncodingRnas"] == [{"locusTag": "b0003", "biotype": "tRNA", "distanceNt": 9}]

    go = files["go-annotations-v1.tsv"].decode("utf-8").splitlines()
    assert go[0].split("\t") == layer.GO_TSV_FIELDS
    rows = [dict(zip(layer.GO_TSV_FIELDS, line.split("\t"))) for line in go[1:]]
    assert [(r["locus_tag"], r["go_id"], r["evidence_code"], r["assigned_by"]) for r in rows] == [
        ("b0001", "GO:0000001", "IDA", "EcoCyc"),
        ("b0002", "GO:0000002", "IEA", "InterPro"),
        ("b0004", "GO:0000002", "IEA", "InterPro"),
    ], "the duplicated entry's row reaches both loci; the locus-less accession reaches none"
    assert rows[1]["mapping_ambiguity"] == "accession names several loci: b0002, b0004"
    assert rows[0]["mapping_method"] == layer.MAPPING_METHOD

    summary = json.loads(files["release-summary-v1.json"])
    counts = summary["counts"]
    assert counts["goUnmatchedAccessionRows"] == 1 and counts["goAmbiguousRelationships"] == 2
    assert counts["lociWithCuratedFunction"] == 1 and counts["lociWithUniprotEntry"] == 3
    assert counts["uniprotEntriesWithoutLocus"] == 1 and counts["goUniqueTerms"] == 2
    digest = hashlib.sha256(files["go-annotations-v1.tsv"]).hexdigest()
    assert summary["generatedFiles"]["go-annotations-v1.tsv"]["sha256"] == digest
    assert summary["releaseId"] == layer.RELEASE_ID

    lookup = json.loads(names)
    assert sorted(lookup["terms"]) == ["GO:0000001", "GO:0000002"]
    assert lookup["terms"]["GO:0000002"]["isObsolete"] is True
    assert lookup["source"]["annotations"]["sha256"] == digest


def test_write_and_check_agree_and_a_stale_file_is_named(tmp_path):
    gff, folder, obo = inputs(tmp_path)
    files, names = layer.build(obo, gff_path=gff, input_dir=folder, verify=False)
    release = tmp_path / "release"
    names_path = tmp_path / "site" / "go-term-names-v1.json"
    layer.write_release(files, names, release_dir=release, names_path=names_path)
    assert layer.check_release(files, names, release_dir=release, names_path=names_path) == []
    (release / "go-annotations-v1.tsv").write_text("stale\n", encoding="utf-8")
    assert layer.check_release(files, names, release_dir=release, names_path=names_path) == ["go-annotations-v1.tsv"]


def test_pinned_inputs_are_held_to_their_digests(tmp_path):
    gff, folder, obo = inputs(tmp_path)
    with pytest.raises(layer.LayerError, match="expected .* bytes"):
        layer.build(obo, gff_path=gff, input_dir=folder)
    with pytest.raises(layer.LayerError, match="missing pinned input"):
        layer.verify_input(tmp_path / "nope", layer.INPUTS["gaf"])
    with pytest.raises(layer.LayerError, match="ontology is missing 1 annotation GO ids"):
        rows = [{"go_id": "GO:0009999"}]
        layer.go_names_payload(obo, rows, "x", verify=False)
    obo.write_text(OBO.replace("releases/2026-05-19", "releases/2000-01-01"), encoding="utf-8")
    with pytest.raises(layer.LayerError, match="not the pinned go-basic.obo"):
        layer.go_names_payload(obo, [], "x")


def test_fetch_refuses_a_download_that_differs_from_its_pin(tmp_path, capsys):
    class Response(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    folder = tmp_path / "inputs"
    with pytest.raises(layer.LayerError, match="differs from the pinned SHA-256; nothing written"):
        layer.fetch_inputs(folder, opener=lambda url, timeout: Response(b"not the file"))
    assert not any(folder.iterdir())


def test_malformed_gaf_and_empty_inputs_are_named(tmp_path):
    bad = tmp_path / "bad.goa"
    bad.write_text("!gaf-version: 2.2\nUniProtKB\tP1\n", encoding="utf-8")
    with pytest.raises(layer.LayerError, match="expected 17 columns"):
        layer.load_gaf(bad)
    bad.write_text("!gaf-version: 2.2\n", encoding="utf-8")
    with pytest.raises(layer.LayerError, match="no annotation rows"):
        layer.load_gaf(bad)
    empty = tmp_path / "empty.tsv"
    empty.write_text("Entry\tEntry Name\tReviewed\tGene Names (primary)\tGene Names (ordered locus)\tGene Names (synonym)\t"
                     "Protein names\tFunction [CC]\tRefSeq\tProtein existence\tLength\n", encoding="utf-8")
    with pytest.raises(layer.LayerError, match="no UniProt entries"):
        layer.load_uniprot(empty)


def test_main_reports_each_mode(tmp_path, monkeypatch, capsys):
    gff, folder, obo = inputs(tmp_path)
    monkeypatch.setattr(layer, "GFF_PATH", gff)
    monkeypatch.setattr(layer, "INPUT_DIR", folder)
    monkeypatch.setattr(layer, "RELEASE_DIR", tmp_path / "release")
    monkeypatch.setattr(layer, "GO_NAMES_PATH", tmp_path / "site" / "go-term-names-v1.json")
    monkeypatch.setattr(layer, "verify_input", lambda path, spec: None)
    monkeypatch.setattr(layer, "ONTOLOGY_BYTES", obo.stat().st_size)
    monkeypatch.setattr(layer, "ONTOLOGY_SHA256", hashlib.sha256(obo.read_bytes()).hexdigest())
    assert layer.main(["check", "--obo", str(obo)]) == 1
    assert "stale" in capsys.readouterr().err
    assert layer.main(["build", "--obo", str(obo)]) == 0
    assert "4 loci, 3 GO relationships, 1 with a curated function" in capsys.readouterr().out
    assert layer.main(["check", "--obo", str(obo)]) == 0
    assert layer.main(["fetch"]) == 0
    assert "0 downloaded" in capsys.readouterr().out
    monkeypatch.setattr(layer, "fetch_inputs", lambda: (_ for _ in ()).throw(layer.LayerError("boom")))
    assert layer.main(["fetch"]) == 1
    assert "error: boom" in capsys.readouterr().err
