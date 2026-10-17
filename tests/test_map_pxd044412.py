"""Exact S3 identity joins, unchanged peptide semantics and exclusive outputs."""

import copy
import hashlib
import io
import json
from pathlib import Path
import runpy
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import map_pxd044412 as mapping  # noqa: E402
import pxd044412_peptides as peptides  # noqa: E402
from test_map_pxd036717 import crosswalk, edge, uniprot  # noqa: E402
from test_pxd044412_peptides import make_source, source_row  # noqa: E402


def row(**changes):
    return source_row(**{"Entry": "Q12345", mapping.SOURCE_LOCUS: "Synpcc7942_0001", **changes})


def inputs(tmp_path, rows=None, *, proteins=None, edges=None, payload=None, headers=peptides.HEADERS):
    source, source_pin = make_source(tmp_path, [row()] if rows is None else rows,
                                     payload=payload, headers=headers)
    proteins_path, edges_path = tmp_path / "uniprot.tsv", tmp_path / "crosswalk.tsv"
    proteins_path.write_bytes(uniprot(proteins))
    edges_path.write_bytes(crosswalk(edges))
    paths = {"source": source, "uniprot": proteins_path, "crosswalk": edges_path}
    pins = {name: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in paths.items()}
    assert pins["source"] == source_pin
    return paths, pins


def report(tmp_path, rows=None, **kwargs):
    paths, pins = inputs(tmp_path, rows, **kwargs)
    document = mapping.write_report(**paths, output_dir=tmp_path / "bundle", pins=pins)
    assert json.loads((tmp_path / "bundle/mapping.json").read_text()) == document
    return document


def test_success_preserves_reader_summary_and_all_observed_rows(tmp_path):
    rows = [
        row(**{"Protein names": "quoted\nannotation"}),
        row(PeptideSequence="SIGNIFICANT", Sign="Sign", **{"adj.pvalue": "0"}),
        row(Entry="Q54321", Label="FBP_2", **{mapping.SOURCE_LOCUS: "Synpcc7942_0002"}),
    ]
    doc = report(tmp_path, rows)
    assert doc["releaseEligible"] is False
    assert doc["attribution"]["license"] == "CC BY 4.0"
    assert doc["sources"]["source"]["bytes"] == (tmp_path / "source.tsv").stat().st_size
    assert len(doc["groups"]) == 2  # No cross-product of two entries/two labels.
    first = doc["identities"][0]
    assert first["status"] == "mapped" and first["exclusionReasons"] == []
    assert first["pccLocus"] == "Synpcc7942_0001"
    assert first["utexLocus"] == "M744_RS00005"
    assert first["members"][0]["uniprotRows"] == [2]
    assert first["members"][0]["crosswalkRows"] == [2]
    assert first["members"][0]["refseqComparison"] == "agrees"
    refs = first["sourceLoci"][0]["sourceRowReferences"]
    assert refs == [
        {"sourceDataRow": 1, "sourceLineStart": 2, "sourceLineEnd": 3},
        {"sourceDataRow": 2, "sourceLineStart": 4, "sourceLineEnd": 4},
    ]
    assert doc["groups"][0]["sourceDataRows"] == [1, 2]
    assert doc["groups"][0]["mappedEvidenceState"] == "significant_peptide_evidence"
    reference = peptides._summarize(peptides.iter_rows(
        tmp_path / "source.tsv", expected_sha256=doc["sources"]["source"]["sha256"]), io.StringIO())
    assert doc["audit"] == reference["audit"]
    stripped = copy.deepcopy(doc["groups"])
    for group in stripped:
        for field in ("sourceDataRows", "mappingStatus", "utexLocus", "mappedEvidenceState"):
            del group[field]
    assert stripped == reference["groups"]
    audit = doc["mappingAudit"]
    assert audit["identityStatusCounts"] == {"mapped": 2}
    assert audit["overall"]["mappedEvaluatedGroupCount"] == 2
    for field in peptides.COUNT_FIELDS:
        assert sum(a[field] for a in audit["byLabel"].values()) == doc["audit"][field]
    assert audit["byLabel"]["FBP_1"]["mappedRowCounts"]["significantRowCount"] == 1
    original = (tmp_path / "bundle/mapping.json").read_bytes()
    mapping.write_report(tmp_path / "source.tsv", tmp_path / "uniprot.tsv",
                         tmp_path / "crosswalk.tsv", tmp_path / "second", pins={
                             name: data["sha256"] for name, data in doc["sources"].items()})
    assert (tmp_path / "second/mapping.json").read_bytes() == original
    assert sorted(p.name for p in (tmp_path / "bundle").iterdir()) == ["mapping.json"]


@pytest.mark.parametrize("locus,reasons", [
    ("", ["source_locus_missing"]),
    ("  ", ["source_locus_missing"]),
    ("NA", ["source_locus_missing"]),
    ("alien_1", ["source_locus_unsupported", "source_locus_disagreement"]),
    ("Synpcc7942_0002", ["source_locus_disagreement"]),
    ("Synpcc7942_0001; Synpcc7942_0002", ["source_locus_multiple", "source_locus_disagreement"]),
    ("Synpcc7942_0001 Synpcc7942_0001", ["source_locus_multiple", "source_locus_disagreement"]),
    ("Synpcc7942_0001; alien_1", ["source_locus_multiple", "source_locus_unsupported", "source_locus_disagreement"]),
])
def test_invalid_s3_locus_withholds_assignment_but_retains_route(tmp_path, locus, reasons):
    doc = report(tmp_path, [row(**{mapping.SOURCE_LOCUS: locus})])
    identity = doc["identities"][0]
    assert identity["exclusionReasons"] == reasons
    assert identity["status"] == reasons[0] and identity["utexLocus"] is None
    assert identity["sourceLoci"][0]["literal"] == locus
    assert identity["members"][0]["utexCandidates"] == ["M744_RS00005"]
    group = doc["groups"][0]
    assert group["mappedEvidenceState"] is None
    assert group["evidenceState"] == "no_significant_peptide_evidence"
    assert doc["mappingAudit"]["overall"]["mappedGroupCount"] == 0


def test_any_conflicting_row_excludes_entry_across_all_labels(tmp_path):
    doc = report(tmp_path, [row(), row(Label="FBP_2", **{mapping.SOURCE_LOCUS: "Synpcc7942_0002"})])
    assert len(doc["identities"]) == 1
    assert doc["identities"][0]["exclusionReasons"] == [
        "source_locus_disagreement", "source_locus_conflict"]
    assert all(g["utexLocus"] is None for g in doc["groups"])
    assert len(doc["identities"][0]["sourceLoci"]) == 2


def test_literal_variants_are_preserved_and_conservatively_excluded(tmp_path):
    doc = report(tmp_path, [row(), row(PeptideSequence="OTHER", **{
        mapping.SOURCE_LOCUS: " Synpcc7942_0001 "})])
    assert doc["identities"][0]["exclusionReasons"] == ["source_locus_conflict"]


@pytest.mark.parametrize("locus", ["Synpcc7942_B2615", "Synpcc7942_1912a"])
def test_exact_supported_locus_suffixes_and_versioned_overlap(tmp_path, locus):
    doc = report(tmp_path, [row(**{mapping.SOURCE_LOCUS: locus})],
                 proteins=[["Q12345", locus, "WP_99.2; WP_1.1 [Q12345-1];"]],
                 edges=[edge(locus)])
    assert doc["identities"][0]["status"] == "mapped"


@pytest.mark.parametrize("proteins,status", [
    ([["OTHER", "Synpcc7942_0001", "WP_1.1"]], "uniprot_missing"),
    ([["Q12345", "", "WP_1.1"]], "uniprot_no_locus"),
    ([["Q12345", "alien_1", "WP_1.1"]], "uniprot_unsupported_locus"),
    ([["Q12345", "Synpcc7942_0001; Synpcc7942_0002", "WP_1.1"]], "uniprot_ambiguous"),
    ([["Q12345", "Synpcc7942_0001", "WP_1.1"],
      ["UNOBSERVED", "Synpcc7942_0001", "WP_1.1"]], "uniprot_ambiguous"),
    ([["Q12345", "Synpcc7942_0001", "WP_1.1"],
      ["Q12345", "Synpcc7942_0002", "WP_2.1"]], "uniprot_ambiguous"),
    ([["Q12345", "Synpcc7942_0001", ""]], "refseq_unconfirmed"),
    ([["Q12345", "Synpcc7942_0001", "WP_1.2"]], "refseq_disagreement"),
])
def test_uniprot_ambiguity_missingness_and_refseq_versions(tmp_path, proteins, status):
    doc = report(tmp_path, proteins=proteins)
    identity = doc["identities"][0]
    assert identity["status"] == status and identity["utexLocus"] is None
    assert identity["members"][0]["status"] == status
    if len(proteins) == 2 and proteins[1][0] == "UNOBSERVED":
        assert identity["members"][0]["proteinCompetitors"][0]["uniprotRows"] == [3]


@pytest.mark.parametrize("edges,status", [
    ([edge("Synpcc7942_9999")], "crosswalk_missing"),
    ([edge(), edge(target="M744_RS00010")], "crosswalk_ambiguous"),
    ([edge(), edge(source="Synpcc7942_9999")], "crosswalk_ambiguous"),
    ([edge(flag="ambiguous")], "crosswalk_ambiguous"),
    ([edge(), edge(source="Synpcc7942_9999", flag="ambiguous")], "crosswalk_ambiguous"),
    ([edge(protein="WP_1.2")], "refseq_disagreement"),
])
def test_full_crosswalk_including_unobserved_flagged_competitors(tmp_path, edges, status):
    doc = report(tmp_path, edges=edges)
    assert doc["identities"][0]["status"] == status
    assert doc["identities"][0]["utexLocus"] is None
    if len(edges) == 2 and edges[1][1] == "Synpcc7942_9999":
        assert doc["identities"][0]["members"][0]["crosswalkCompetitors"][0]["crosswalkRows"] == [3]


@pytest.mark.parametrize("entry,status,member_count", [
    ("Q12345;Q54321", "protein_group", 2),
    ("Q12345;Q12345", "protein_group", 2),
    ("Q12345;", "protein_group", 2),
    (" Q12345", "uniprot_missing", 1),
    ("Q12345-1", "uniprot_missing", 1),
])
def test_source_entry_groups_and_aliases_never_resolve_by_guessing(tmp_path, entry, status, member_count):
    doc = report(tmp_path, [row(Entry=entry)])
    identity = doc["identities"][0]
    assert identity["Entry"] == entry and identity["status"] == status
    assert len(identity["members"]) == member_count
    assert identity["utexLocus"] is None
    if status == "protein_group":
        assert identity["members"][0]["utexCandidates"] == ["M744_RS00005"]


def test_all_target_collision_entries_excluded_without_file_order_winner(tmp_path, monkeypatch):
    # Whole-table routes normally prevent this already; exercise the final guard
    # if a later route implementation accidentally returns colliding assignments.
    original = mapping.identities.lookup

    def collision(accession, routes):
        result = original(accession, routes)
        result["utexLocus"] = "M744_RS00005"
        return result

    monkeypatch.setattr(mapping.identities, "lookup", collision)
    doc = report(tmp_path, [row(), row(Entry="Q54321", **{mapping.SOURCE_LOCUS: "Synpcc7942_0002"})])
    for identity in doc["identities"]:
        assert identity["status"] == "target_collision" and identity["utexLocus"] is None
        assert len(identity["targetCollisionEntries"]) == 1
        assert identity["targetCollisionEntries"][0] != identity["Entry"]
    assert doc["mappingAudit"]["overall"]["mappedGroupCount"] == 0


def test_repeated_entry_across_labels_is_one_identity_and_no_collision(tmp_path):
    doc = report(tmp_path, [row(), row(Label="FBP_2")])
    assert len(doc["identities"]) == 1 and len(doc["groups"]) == 2
    assert all(g["mappingStatus"] == "mapped" for g in doc["groups"])


def test_mapped_identity_with_only_ambiguous_or_invalid_peptides_is_not_assessed(tmp_path):
    doc = report(tmp_path, [
        row(ambig="yes", Sign="Sign", **{"adj.pvalue": "0"}),
        row(Label="FBP_2", log2FC="NA"),
        row(Label="FBP_3", issue="diagnostic"),
    ])
    assert doc["identities"][0]["status"] == "mapped"
    assert all(g["mappingStatus"] == "mapped" and g["mappedEvidenceState"] is None
               and g["evidenceState"] == "not_evaluated" for g in doc["groups"])
    audit = doc["mappingAudit"]["overall"]
    assert audit["mappedGroupCount"] == 3 and audit["mappedEvaluatedGroupCount"] == 0
    assert audit["mappedEvidenceStateCounts"] == {"not_evaluated": 3}
    assert audit["mappedRowCounts"]["significantRowCount"] == 0


def test_duplicates_sign_mismatch_missing_and_invalid_semantics_unchanged(tmp_path):
    first = row(Sign="Sign", **{"adj.pvalue": "1"})
    rows = [first, first, row(Sign="Sign", **{"adj.pvalue": "0"}),
            row(PeptideSequence="INVALID", log2FC="inf"),
            row(PeptideSequence="MISSING", SE="NA")]
    doc = report(tmp_path, rows)
    group = doc["groups"][0]
    assert group["rowCount"] == 5 and group["evaluatedRowCount"] == 3
    assert group["signMismatchRowCount"] == 2 and group["significantRowCount"] == 1
    assert group["duplicateRowCount"] == 2 and group["conflictingDuplicateRowCount"] == 1
    assert group["invalidStatisticsRowCount"] == 1 and group["unavailableStatisticsRowCount"] == 1
    assert group["evaluatedRowReferences"] == [1, 2, 3]
    assert group["significantRowReferences"] == [3]
    assert group["mappedEvidenceState"] == "significant_peptide_evidence"


@pytest.mark.parametrize("name", ["source", "uniprot", "crosswalk"])
def test_checksums_verified_before_output(tmp_path, name):
    paths, pins = inputs(tmp_path)
    pins[name] = "0" * 64
    with pytest.raises(ValueError, match="SHA-256 mismatch"):
        mapping.write_report(**paths, output_dir=tmp_path / "bundle", pins=pins)
    assert not (tmp_path / "bundle").exists()


@pytest.mark.parametrize("pins", [{}, {"source": "0"}, {**mapping.PINS, "extra": "0"}])
def test_requires_exact_pin_set(tmp_path, pins):
    with pytest.raises(ValueError, match="Exactly three"):
        mapping.write_report(tmp_path / "s", tmp_path / "u", tmp_path / "c",
                             tmp_path / "bundle", pins=pins)


@pytest.mark.parametrize("changes", [
    {"headers": tuple(reversed(peptides.HEADERS))},
    {"rows": []},
    {"rows": [row(organism="wrong")]},
    {"rows": [row(Entry="NA")]},
    {"payload": b"\xff\n"},
    {"payload": ("\t".join(peptides.HEADERS) + "\nshort\trow\n").encode()},
    {"rows": [row(), row(ambig="maybe")]},
])
def test_malformed_s3_never_leaves_partial_bundle(tmp_path, changes):
    paths, pins = inputs(tmp_path, **changes)
    with pytest.raises(ValueError):
        mapping.write_report(**paths, output_dir=tmp_path / "bundle", pins=pins)
    assert not (tmp_path / "bundle").exists()


@pytest.mark.parametrize("table,payload", [
    ("uniprot", b"Entry\tEntry\n"),
    ("uniprot", b"Entry\tGene Names (ordered locus)\tRefSeq\nshort\n"),
    ("uniprot", uniprot([[" Q12345", "Synpcc7942_0001", "WP_1.1"]])),
    ("crosswalk", crosswalk([edge(protein="WP_1")])),
    ("crosswalk", crosswalk([edge(target="alien")])),
    ("crosswalk", b"wrong\theader\n"),
])
def test_malformed_mapping_inputs_rejected(tmp_path, table, payload):
    paths, pins = inputs(tmp_path)
    paths[table].write_bytes(payload)
    pins[table] = hashlib.sha256(payload).hexdigest()
    with pytest.raises(ValueError):
        mapping.write_report(**paths, output_dir=tmp_path / "bundle", pins=pins)
    assert not (tmp_path / "bundle").exists()


@pytest.mark.parametrize("destination", ["source", "uniprot", "crosswalk", "directory", "file", "symlink", "dangling", "hardlink"])
def test_existing_output_and_input_aliases_untouched(tmp_path, destination):
    paths, pins = inputs(tmp_path)
    output = tmp_path / "bundle"
    if destination in paths:
        output = paths[destination]
    elif destination == "directory":
        output.mkdir()
        (output / "sentinel").write_text("keep")
    elif destination == "file":
        output.write_text("keep")
    elif destination in ("symlink", "dangling"):
        output.symlink_to(paths["source"] if destination == "symlink" else tmp_path / "missing")
    else:
        output.hardlink_to(paths["source"])
    with pytest.raises(ValueError, match="must be new"):
        mapping.write_report(**paths, output_dir=output, pins=pins)
    assert output.exists() or output.is_symlink()
    for name, path in paths.items():
        assert hashlib.sha256(path.read_bytes()).hexdigest() == pins[name]
    if destination == "directory":
        assert (output / "sentinel").read_text() == "keep"


def test_write_failure_removes_only_this_bundle(tmp_path, monkeypatch):
    paths, pins = inputs(tmp_path)
    sentinel = tmp_path / "unrelated"
    sentinel.write_text("keep")

    def failed_dump(value, stream, **kwargs):
        stream.write("partial")
        raise OSError("disk full")

    monkeypatch.setattr(mapping.json, "dump", failed_dump)
    with pytest.raises(OSError, match="disk full"):
        mapping.write_report(**paths, output_dir=tmp_path / "bundle", pins=pins)
    assert not (tmp_path / "bundle").exists() and sentinel.read_text() == "keep"


def test_source_change_during_parse_rolls_back(tmp_path, monkeypatch):
    paths, pins = inputs(tmp_path)
    original = peptides.iter_rows

    def changed_source(source, **kwargs):
        iterator = original(source, **kwargs)
        try:
            yield next(iterator)
            with source.open("ab") as stream:
                stream.write(source.read_bytes().split(b"\n", 1)[1])
            yield from iterator
        finally:
            iterator.close()

    monkeypatch.setattr(peptides, "iter_rows", changed_source)
    with pytest.raises(ValueError, match="changed during parsing"):
        mapping.write_report(**paths, output_dir=tmp_path / "bundle", pins=pins)
    assert not (tmp_path / "bundle").exists()


def test_missing_output_parent_closes_iterator(tmp_path, monkeypatch):
    paths, pins = inputs(tmp_path)
    original = peptides.iter_rows
    closed = []

    def tracked_rows(source, **kwargs):
        try:
            yield from original(source, **kwargs)
        finally:
            closed.append(True)

    monkeypatch.setattr(peptides, "iter_rows", tracked_rows)
    with pytest.raises(FileNotFoundError):
        mapping.write_report(**paths, output_dir=tmp_path / "missing/bundle", pins=pins)
    assert closed == [True] and not (tmp_path / "missing").exists()


def test_cli_success_and_fixed_pins(tmp_path, monkeypatch, capsys):
    paths, pins = inputs(tmp_path)
    argv = ["--input", str(paths["source"]), "--uniprot", str(paths["uniprot"]),
            "--crosswalk", str(paths["crosswalk"]), "--output-dir", str(tmp_path / "bundle")]
    with pytest.raises(SystemExit) as error:
        mapping.main(argv)
    assert error.value.code == 2 and "SHA-256 mismatch" in capsys.readouterr().err
    monkeypatch.setattr(mapping, "PINS", pins)
    assert mapping.main(argv) == 0
    audit = json.loads(capsys.readouterr().out)
    assert audit["overall"]["mappedGroupCount"] == 1
    with pytest.raises(SystemExit) as error:
        mapping.main(argv)
    assert error.value.code == 2 and "must be new" in capsys.readouterr().err
    with pytest.raises(SystemExit):
        mapping.main([*argv, "--source-sha256", pins["source"]])


def test_script_entrypoint_reports_input_error(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(sys, "argv", ["map_pxd044412.py", "--input", str(tmp_path / "missing"),
                                    "--output-dir", str(tmp_path / "bundle")])
    with pytest.raises(SystemExit) as error:
        runpy.run_path(str(Path(mapping.__file__)), run_name="__main__")
    assert error.value.code == 2 and "No such file" in capsys.readouterr().err
