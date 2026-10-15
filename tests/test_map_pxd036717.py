"""Exact join, whole-input ambiguity and unchanged source-evidence contracts."""

import copy
import hashlib
import json
from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import map_pxd036717 as mapping  # noqa: E402
from pxd036717_enrichment import SOURCE_FILE, read_workbook  # noqa: E402
from test_pxd036717_enrichment import workbook  # noqa: E402


def uniprot(rows=None):
    rows = rows if rows is not None else [
        ["Q12345", "Synpcc7942_0001", "WP_1.1;"],
        ["Q54321", "Synpcc7942_0002", "WP_2.1;"],
    ]
    return ("Entry\tGene Names (ordered locus)\tRefSeq\n"
            + "\n".join("\t".join(row) for row in rows) + "\n").encode()


def edge(source="Synpcc7942_0001", target="M744_RS00005", flag="", protein="WP_1.1"):
    return [mapping.RELATIONSHIP, source, target, flag,
            "PCC7942_legacy_locus_tag", "exact shared RefSeq protein_id", protein]


def crosswalk(rows=None):
    rows = rows if rows is not None else [
        edge(), edge("Synpcc7942_0002", "M744_RS00010", protein="WP_2.1"),
    ]
    return ("relationship\tobject_id\tsubject_locus_tag\tmapping_ambiguity\t"
            "object_namespace\tmapping_method\tevidence\n"
            + "\n".join("\t".join(row) for row in rows) + "\n").encode()


def inputs():
    return {"workbook": workbook(), "uniprot": uniprot(), "crosswalk": crosswalk()}


def pins(data):
    return {key: hashlib.sha256(value).hexdigest() for key, value in data.items()}


def mapped(data):
    return mapping.map_workbook(**data, pins=pins(data))


def test_exact_join_preserves_every_source_value_and_coordinate():
    data = inputs()
    doc = json.loads(json.dumps(mapped(data), allow_nan=False))
    assert not doc["releaseEligible"]
    assert doc["mapping"]["sources"][0]["sha256"] == pins(data)["uniprot"]
    assert doc["mapping"]["sources"][1]["bytes"] == len(data["crosswalk"])
    assert "PCC 7942" in doc["mapping"]["basis"] and "UTEX 2973" in doc["mapping"]["basis"]
    for table in doc["sheets"]:
        first = table["rows"][0]["mapping"]
        assert first["status"] == "mapped"
        assert first["pccLocus"] == "Synpcc7942_0001"
        assert first["utexLocus"] == "M744_RS00005"
        assert first["members"][0]["uniprotRows"] == [2]
        assert first["members"][0]["crosswalkRows"] == [2]
        assert first["members"][0]["refseqComparison"] == "agrees"
        assert table["mappingAudit"]["mappedRows"] == 2
        assert table["mappingAudit"]["mappedValidByReplicate"] == {"A": 1, "B": 1, "C": 1}
        assert table["mappingAudit"]["mappedCompleteMeans"] == 1
        assert table["mappingAudit"]["mappedDetectionCounts"]["both"] == 3
    stripped = copy.deepcopy(doc)
    del stripped["mapping"]
    for table in stripped["sheets"]:
        del table["mappingAudit"]
        for row in table["rows"]:
            del row["mapping"]
    assert stripped == read_workbook(data["workbook"], expected_sha256=pins(data)["workbook"])


@pytest.mark.parametrize("table,status", [
    (uniprot([["OTHER", "Synpcc7942_0001", ""]]), "uniprot_missing"),
    (uniprot([["Q12345", "", ""]]), "uniprot_no_locus"),
    (uniprot([["Q12345", "alien_1", ""]]), "uniprot_unsupported_locus"),
    (uniprot([["Q12345", "Synpcc7942_0001; Synpcc7942_0002", ""]]), "uniprot_ambiguous"),
    (uniprot([["Q12345", "Synpcc7942_0001", ""],
              ["UNOBSERVED", "Synpcc7942_0001", ""]]), "uniprot_ambiguous"),
    (uniprot([["Q12345", "Synpcc7942_0001", ""],
              ["Q12345", "Synpcc7942_0002", ""]]), "uniprot_ambiguous"),
])
def test_uniprot_absence_and_ambiguity_never_guess(table, status):
    data = inputs(); data["uniprot"] = table
    row = mapped(data)["sheets"][0]["rows"][0]
    assert row["mapping"]["status"] == status
    assert row["mapping"]["utexLocus"] is None
    assert row["comparisons"][0]["reconstructedLog2Ratio"] == 2


@pytest.mark.parametrize("rows,status", [
    ([edge("Synpcc7942_9999")], "crosswalk_missing"),
    ([edge(), edge(target="M744_RS00010")], "crosswalk_ambiguous"),
    ([edge(), edge(source="Synpcc7942_9999")], "crosswalk_ambiguous"),
    ([edge(flag="ambiguous")], "crosswalk_ambiguous"),
    ([edge(), edge(flag="ambiguous")], "crosswalk_ambiguous"),
    ([edge(), edge(source="Synpcc7942_9999", flag="ambiguous")], "crosswalk_ambiguous"),
    ([edge(protein="WP_99.1")], "refseq_disagreement"),
])
def test_crosswalk_conflicts_include_unobserved_and_flagged_edges(rows, status):
    data = inputs(); data["crosswalk"] = crosswalk(rows)
    row = mapped(data)["sheets"][0]["rows"][0]
    result = row["mapping"]
    assert result["status"] == status and result["utexLocus"] is None
    assert result["pccLocus"] == "Synpcc7942_0001"
    if status == "refseq_disagreement":
        member = result["members"][0]
        assert member["utexCandidates"] == ["M744_RS00005"]
        assert member["uniprotRefseq"] == ["WP_1.1"]
        assert member["crosswalkRefseq"] == ["WP_99.1"]


def test_isoform_notes_missing_refseq_and_exact_pcc_suffixes():
    for locus, refseq, comparison in [
        ("Synpcc7942_1912a", "WP_1.1 [Q12345-1];", "agrees"),
        ("Synpcc7942_B2615", "", "not_available"),
    ]:
        routes = mapping.build_routes(uniprot([["Q12345", locus, refseq]]),
                                      crosswalk([edge(locus), edge(locus)]))
        result = mapping.lookup("Q12345", routes)
        assert result["status"] == "mapped"
        assert result["refseqComparison"] == comparison
        assert result["crosswalkRows"] == [2, 3]


def test_protein_group_never_allocates_to_members_or_uses_gene_alias():
    data = inputs()
    data["workbook"] = workbook(lambda b: b.worksheets[0].__setitem__("A2", "Q12345;Q54321"))
    row = mapped(data)["sheets"][0]["rows"][0]
    assert row["mapping"]["status"] == "protein_group"
    assert row["mapping"]["pccLocus"] is None and row["mapping"]["utexLocus"] is None
    assert [m["utexLocus"] for m in row["mapping"]["members"]] == ["M744_RS00005", "M744_RS00010"]
    def alias(book):
        book.worksheets[0]["A2"] = " Q12345"
        book.worksheets[0]["B2"] = "Synpcc7942_0001"
    data["workbook"] = workbook(alias)
    assert mapped(data)["sheets"][0]["rows"][0]["mapping"]["status"] == "uniprot_missing"


def test_duplicate_rows_within_bait_withhold_all_collisions():
    def duplicate(book):
        sheet = book.worksheets[0]
        sheet.append([cell.value for cell in sheet[2]])
    data = inputs(); data["workbook"] = workbook(duplicate)
    doc = mapped(data)
    table = doc["sheets"][0]
    assert table["mappingAudit"]["statuses"] == {"mapped": 1, "target_collision": 2}
    assert table["rows"][0]["mapping"]["utexLocus"] is None
    assert table["rows"][2]["mapping"]["utexLocus"] is None
    assert doc["sheets"][1]["mappingAudit"]["mappedRows"] == 2


@pytest.mark.parametrize("key", ["workbook", "uniprot", "crosswalk"])
def test_each_pin_is_required(key):
    data = inputs(); expected = pins(data); expected[key] = "wrong"
    with pytest.raises(ValueError, match=f"{key}: SHA-256"):
        mapping.map_workbook(**data, pins=expected)
    del expected[key]
    with pytest.raises(ValueError, match="Exactly three"):
        mapping.map_workbook(**data, pins=expected)


@pytest.mark.parametrize("table", [
    b"", b"Entry\tRefSeq\n", b"Entry\tEntry\tGene Names (ordered locus)\tRefSeq\n",
    b"Entry\tGene Names (ordered locus)\tRefSeq\nQ12345\n",
    uniprot([["", "Synpcc7942_0001", ""]]),
    uniprot([[" Q12345", "Synpcc7942_0001", ""]]),
])
def test_malformed_tables_fail_closed(table):
    with pytest.raises(ValueError):
        mapping.build_routes(table, crosswalk())


def test_crosswalk_unrelated_rows_are_ignored_but_basis_changes_rejected():
    unrelated = edge(); unrelated[0] = "gene_symbol"; unrelated[1] = "alias"
    routes = mapping.build_routes(uniprot(), crosswalk([unrelated, edge()]))
    assert mapping.lookup("Q12345", routes)["status"] == "mapped"
    for i in [1, 2, 4, 5, 6]:
        bad = edge(); bad[i] = "wrong"
        with pytest.raises(ValueError, match="unexpected identifier/basis"):
            mapping.build_routes(uniprot(), crosswalk([bad]))


def test_cli_protects_every_input_and_writes_only_output(tmp_path, monkeypatch, capsys):
    data = inputs()
    paths = {}
    for key, value in data.items():
        paths[key] = tmp_path / key; paths[key].write_bytes(value)
    args = ["--input", str(paths["workbook"]), "--uniprot", str(paths["uniprot"]),
            "--crosswalk", str(paths["crosswalk"])]
    for source in paths.values():
        with pytest.raises(SystemExit):
            mapping.main(args + ["--output", str(source)])
        link = tmp_path / (source.name + "-link"); link.hardlink_to(source)
        with pytest.raises(SystemExit):
            mapping.main(args + ["--output", str(link)])
    output = tmp_path / "out" / "mapped.json"
    with pytest.raises(ValueError, match="SHA-256"):
        mapping.main(args + ["--output", str(output)])
    assert not output.exists()
    monkeypatch.setattr(mapping, "PINS", pins(data))
    assert mapping.main(args + ["--output", str(output)]) == 0
    assert json.loads(output.read_text())["sheets"][0]["mappingAudit"]["mappedRows"] == 2
    assert json.loads(capsys.readouterr().out)["RpaA"]["mappedRows"] == 2
    for key, path in paths.items():
        assert path.read_bytes() == data[key]


PINNED = mapping.ROOT / "data/interim/pxd036717" / SOURCE_FILE


@pytest.mark.skipif(not PINNED.exists(), reason="requires owner-supplied pinned supplement")
def test_pinned_mapping_matches_source_audit_with_disagreements_withheld():
    doc = mapping.map_workbook(PINNED.read_bytes(), (mapping.ROOT / mapping.UNIPROT).read_bytes(),
                               (mapping.ROOT / mapping.CROSSWALK).read_bytes())
    expected = [(367, [227, 187, 218], 185), (347, [186, 144, 172], 140),
                (402, [293, 218, 273], 200), (434, [207, 147, 159], 135)]
    conflicts = set()
    for table, (count, coverage, means) in zip(doc["sheets"], expected, strict=True):
        audit = table["mappingAudit"]
        assert audit["mappedRows"] == count
        assert list(audit["mappedValidByReplicate"].values()) == coverage
        assert audit["mappedCompleteMeans"] == means
        conflicts.update(row["accession"] for row in table["rows"]
                         if row["mapping"]["status"] == "refseq_disagreement")
    assert conflicts == {"Q31PP6", "Q31NP5"}
