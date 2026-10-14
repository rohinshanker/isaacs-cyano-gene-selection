"""Exact joins, conservative field precedence, and independent published checks."""
from __future__ import annotations

import gzip
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

import pytest
from Bio import SeqIO

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import recoded_functional_annotations as transfer


def row(locus, protein, name=None, product=None):
    return {"id": locus, "protein": protein, "name": name, "product": product}


def test_crosswalk_requires_unique_preserved_protein_on_both_sides():
    source = [row("ref-a", "MAA"), row("ref-b", "MBB"), row("ref-b2", "MBB"),
              row("ref-c", "MCC", "changed"), row("ref-d", "MDD")]
    target = [row("a", "MAA"), row("b", "MBB"), row("c", "MCE", "changed"),
              row("absent", "MFF"), row("unsupported", None),
              row("d", "MDD"), row("d2", "MDD")]
    joined = transfer.exact_crosswalk(target, source)
    assert joined["a"]["status"] == "exact-protein"
    assert joined["a"]["sourceLoci"] == ["ref-a"]
    assert joined["b"]["status"] == "ambiguous-protein"
    assert joined["b"]["sourceLoci"] == ["ref-b", "ref-b2"]
    assert joined["d"]["status"] == "ambiguous-protein"
    assert joined["d"]["targetCopies"] == ["d", "d2"]
    assert joined["c"]["status"] == "modified-or-nonidentical-protein"
    assert joined["c"]["sourceLoci"] == []
    assert joined["c"]["identityCandidatesNotJoined"] == ["ref-c"]
    assert joined["absent"]["status"] == "unmatched"
    assert joined["unsupported"]["status"] == "unsupported-protein"


def test_fields_preserve_native_unknown_products_and_withhold_reference_conflicts():
    native = row("target", "MAA", None, "hypothetical protein")
    sources = [row("a", "MAA", "sym", "known enzyme"), row("b", "MAA", "sym", "other enzyme")]
    fields, conflicts = transfer.fill_fields(native, sources)
    assert fields == {"name": "sym"}
    assert conflicts == [{"field": "product", "native": "hypothetical protein",
                          "sources": [["a", "known enzyme"], ["b", "other enzyme"]]}]
    native["name"] = "nativeSymbol"
    assert transfer.fill_fields(native, sources)[0] == {}
    native["name"] = "target"  # display fallback is not a reported symbol
    assert transfer.fill_fields(native, sources)[0] == {"name": "sym"}
    assert transfer.fill_fields(row("target", "MAA"), sources)[0] == {"name": "sym"}
    assert transfer.fill_fields(row("target", "MAA"), [sources[0]])[0] == {
        "name": "sym", "product": "known enzyme"}
    sources[1]["name"] = "conflict"
    assert transfer.fill_fields(row("target", "MAA"), sources)[0] == {}
    assert transfer.fill_fields(row("target", "MAA"), [])[0] == {}


def test_changed_source_fails_before_reading_annotations(monkeypatch, tmp_path):
    source = tmp_path / "data/raw" / transfer.MG
    source.mkdir(parents=True)
    name = transfer.PINS[transfer.MG][0]
    (source / name).write_bytes(b"changed source")
    monkeypatch.setattr(transfer, "ROOT", tmp_path)
    transfer.load_records.cache_clear()
    with pytest.raises(ValueError, match="pinned GenBank checksum changed"):
        transfer.load_records(transfer.MG)


def test_native_go_notes_keep_explicit_evidence_without_inventing_relations():
    notes = ["Protein Homology. GO_function: GO:0004072 - aspartate kinase activity [Evidence IEA]; "
             "GO_process: GO:0008652 - amino acid biosynthetic process [Evidence IEA]"]
    rows = transfer.native_go_relationships(notes)
    assert [r["aspect"] for r in rows] == ["F", "P"]
    assert rows[0]["nativeTermName"] == "aspartate kinase activity"
    assert all(r["evidenceCode"] == "IEA" and r["qualifier"] == "" and r["reference"] == "" for r in rows)
    assert transfer.native_go_relationships(["No functional terms"]) == []
    with pytest.raises(ValueError, match="unsupported relationship format"):
        transfer.native_go_relationships(["GO:0000001"])


@pytest.mark.parametrize("organism,genes_count,go_count,symbols", [
    (transfer.SYN57, 3588, 3331, 1), (transfer.SYN61, 3549, 1518, 23),
])
def test_published_annotations_preserve_native_payload_and_source_go(organism, genes_count, go_count, symbols):
    directory = transfer.SITE / organism
    genes = transfer.read_json(directory / "genes.json")
    annotations = transfer.read_json(directory / "annotations.json")
    audit = transfer.read_json(directory / "functional_annotation_audit.json")
    source_go = transfer.read_json(transfer.SITE / transfer.MG / "annotations.json")
    assert len(genes) == len(annotations) == genes_count
    assert audit["summary"]["withTransferredGo"] == go_count
    assert audit["summary"]["withTransferredSymbols"] == symbols
    assert audit["summary"]["withTransferredProducts"] == (1 if organism == transfer.SYN57 else 0)
    assert audit["summary"]["withCategories"] == 0
    for gene in genes:
        a = annotations[gene["id"]]
        t = a["functionalTransfer"]
        assert t["native"] == {k: gene.get(k) for k in t["native"]}
        assert not (set(t["fields"]) - {"name", "product"})
        if t["fields"].get("product"):
            assert t["nativeProduct"] is None and gene["product"] == "uncharacterized design CDS"
        if t["status"] != "exact-protein":
            assert not t["sources"] and not t["fields"]
            assert not a["goAnnotations"] or a["goAnnotationsOrigin"] == "native-source"
        if a["goAnnotationsOrigin"] == "inherited-reference":
            mg_locus = t["sources"][-1]["locusTag"]
            assert t["sources"][-1]["assembly"] == "GCF_000005845.2"
            assert a["goAnnotations"] == [r for r in source_go[mg_locus]["goAnnotations"]
                                           if not r.get("mappingAmbiguity")]
        if a["goAnnotationsOrigin"] == "native-source":
            assert "goAnnotations" not in t["inheritedFields"]
            assert t["nativeGoCount"] == len(a["goAnnotations"])
            assert a["nativeAnnotation"]["source"]["assembly"] == "GCA_028355435.1"
            for r in a["goAnnotations"]:
                kind = {"F": "function", "P": "process", "C": "component"}[r["aspect"]]
                exact = f"GO_{kind}: {r['goId']} - {r['nativeTermName']} [Evidence {r['evidenceCode']}]"
                assert any(exact in note for note in a["nativeAnnotation"]["notes"])
        assert t["categoryStatus"] == "unknown-no-admitted-category"
    if organism == transfer.SYN57:
        assert audit["nativeInventory"]["plottedCds"]["missingProducts"] == 2
        assert audit["nativeInventory"]["plottedCds"]["withEcNumbers"] == 1432
        assert audit["summary"]["withTransferredFunctionText"] == 2681
        assert hashlib.sha256((directory / "genes.json").read_bytes()).hexdigest() == (
            "4d5f319965f1731b0be183302b94874085921ebc995e0e565e4a67f5dfa09aa7")
    else:
        assert audit["nativeInventory"]["plottedCds"]["withEcNumbers"] == 1411
        assert audit["summary"]["withTransferredFunctionText"] == 2412
        assert audit["summary"]["withNativeGo"] == 1649
        assert audit["summary"]["withGo"] == 3167
        assert audit["nativeInventory"]["allCds"]["withGo"] == 1698


@pytest.mark.parametrize("organism", transfer.TARGETS)
def test_every_accepted_hop_independently_matches_native_translations(organism):
    """Read GenBank and the packed target independently of the crosswalk builder."""
    directory = transfer.SITE / organism
    genes = transfer.read_json(directory / "genes.json")
    annotations = transfer.read_json(directory / "annotations.json")
    audit = transfer.read_json(directory / "functional_annotation_audit.json")
    for source in audit["references"]:
        if not (ROOT / source["file"]).is_file():
            pytest.skip("pinned ignored reference inputs not acquired")
    by_reference = {}
    counts = {}
    for source in audit["references"]:
        by_locus = {}
        proteins = []
        with gzip.open(ROOT / source["file"], "rt") as handle:
            for record in SeqIO.parse(handle, "genbank"):
                for feature in record.features:
                    q = feature.qualifiers
                    if feature.type != "CDS" or not q.get("translation"):
                        continue
                    protein = q["translation"][0]
                    if "pseudo" in q or "pseudogene" in q or any(c in protein for c in "*XU"):
                        continue
                    if any(type(part.start).__name__ != "ExactPosition" or
                           type(part.end).__name__ != "ExactPosition" for part in feature.location.parts):
                        continue
                    by_locus.setdefault(q["locus_tag"][0], []).append(protein)
                    proteins.append(protein)
        by_reference[source["organismId"]] = by_locus
        counts[source["organismId"]] = Counter(proteins)
    amino_acids = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    decoded = {g["id"]: "M" + "".join(amino_acids[alphabet.index(c)] for c in g["codons"])[1:]
               for g in genes}
    target_counts = Counter(decoded.values())
    for locus, a in annotations.items():
        for hop in a["functionalTransfer"]["sources"]:
            protein = decoded[locus]
            assert target_counts[protein] == 1
            assert protein in by_reference[hop["organismId"]][hop["locusTag"]]
            assert counts[hop["organismId"]][protein] == 1
            assert hashlib.sha256(protein.encode("ascii")).hexdigest() == hop["proteinSha256"]


@pytest.mark.skipif(not (ROOT / "data/raw/recoded-ecoli/Ec_Syn57.gb").is_file(),
                    reason="pinned ignored design input not acquired")
def test_rebuild_is_reproducible_without_mutating_native_files(tmp_path):
    transfer.load_records.cache_clear()
    for organism in transfer.TARGETS:
        directory = transfer.SITE / organism
        before = {name: transfer.digest(directory / name) for name in ("genes.json", "meta.json")}
        for name, data in transfer.generate(organism, directory).items():
            assert data == transfer.read_json(directory / name)
        assert before == {name: transfer.digest(directory / name) for name in before}
