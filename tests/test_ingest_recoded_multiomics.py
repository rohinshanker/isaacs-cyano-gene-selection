"""Source identity, conservative joins and faithful scientific quantities."""
import copy
import csv
import gzip
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import ingest_recoded_multiomics as ingest


def test_exact_join_rejects_ambiguous_names_including_excluded_genes():
    genes = [{"id": "a", "name": "foo"}, {"id": "b", "name": "bar"}]
    names = {"foo": {"a", "excluded"}, "bar": {"b"}, "gone": {"excluded"}}
    rows = [{"gene": name, "sourceRow": i} for i, name in enumerate(
        ("foo", "bar", "bar_1", "BAR", "gone"), 2)]
    result = ingest.join_rows(rows, genes, names)
    assert [r["status"] for r in result] == [
        "ambiguous", "mapped", "unmatched", "unmatched", "excluded_from_map"]
    assert [r["locusTag"] for r in result] == [None, "b", None, None, None]
    assert result[0]["candidates"] == ["a", "excluded"]
    with pytest.raises(ValueError, match="Duplicate plotted"):
        ingest.join_rows(rows, genes + [genes[0]], names)
    with pytest.raises(ValueError, match="Duplicate source"):
        ingest.join_rows(rows + [rows[0]], genes, names)
    with pytest.raises(ValueError, match="Inconsistent"):
        ingest.join_rows(rows, genes, {"foo": {"b"}})


def test_gff_index_uses_gene_features_and_exact_replicon(tmp_path):
    path = tmp_path / "x.gff.gz"
    def write(lines):
        with gzip.open(path, "wt") as handle:
            handle.write(lines)
    gene = "CP116771.1\tPGAP\tgene\t1\t9\t.\t+\t.\tgene=foo%2Dbar;locus_tag=a\n"
    write("##gff-version 3\n" + gene + gene.replace("gene\t", "CDS\t"))
    assert ingest.gene_name_index(path) == {"foo-bar": {"a"}}
    for text, error in (("broken\n", "Malformed"), (gene.replace("CP116771.1", "other"), "replicon"),
                        (gene.replace(";locus_tag=a", ""), "locus tag"),
                        ("##gff-version 3\n", "no named")):
        write(text)
        with pytest.raises(ValueError, match=error):
            ingest.gene_name_index(path)


def test_culture_metadata_supports_reported_od600():
    record = {"studyId": "x", "dataType": "transcriptomics", "platform": "RNA-seq",
              "strain": "Syn61", "basis": "direct", "conditionSet": "LBL",
              "samples": "one", "archiveUrl": ingest.SOURCE_URL, "group": "engineered",
              "citation": None, "replicates": {"count": 1, "text": "one"},
              "treatments": [], "conditionTableRow": None, "conditions": ingest.conditions()}
    ingest.validate_record(record, "fixture")
    assert record["conditions"]["phase"]["odNm"] == 600
    assert record["conditions"]["co2"]["lo"] is None


def test_shipped_syn61_tables_preserve_source_values_and_unmapped_rows():
    document = ingest.extract(ROOT / "data/raw/recoded-ecoli")
    sheet = document["omics"][-1]
    rows = {row["gene"]: row for row in sheet["rows"]}
    directory = ROOT / "data/expression/organisms/ecoli-syn61-delta3-ev5"
    audit = json.loads((directory / "gene-join-audit.json").read_text())["rows"]
    joined = {row["sourceGene"]: row["locusTag"] for row in audit if row["status"] == "mapped"}
    assert len(audit) == 3640
    assert len(joined) == 3192
    sources = json.loads((directory / "sources.json").read_text())
    assert len(sources) == 16
    for col, source in enumerate(sources):
        ingest.validate_record(source["record"], source["id"])
        path = directory / source["file"]
        assert ingest.digest(path) == source["sha256"]
        with path.open() as handle:
            reader = csv.DictReader(handle, delimiter="\t")
            value_column = ingest.VALUE_COLUMNS[source["quantity"]]
            assert reader.fieldnames == ["locus_tag", value_column, "source_gene_id"]
            observed = list(reader)
        expected = {name: row["values"][col] for name, row in rows.items()
                    if name in joined and row["values"][col] is not None}
        assert len(observed) == len(expected)
        for row in observed:
            assert row["locus_tag"] == joined[row["source_gene_id"]]
            assert float(row[value_column]) == expected[row["source_gene_id"]]
        assert source["ingest"]["referenceStrain"] == (None if col < 9 else "MDS42")


def test_all_fitness_source_rows_survive_without_stage_merging():
    document = ingest.extract(ROOT / "data/raw/recoded-ecoli")
    raw = copy.deepcopy(document)
    result = ingest.fitness_document(document)
    assert document == raw
    assert len(result["strains"]) == 59  # 48 growth strains and 11 separate Biolog identities
    assert len(result["growth"]["records"]) == 69
    assert len(result["biolog"]["records"]) == 5280
    assert len({r["id"] for r in result["biolog"]["records"]}) == 5280
    no_growth = [r for r in result["growth"]["records"] if r["growthStatus"] == "no_growth_detected"]
    assert len(no_growth) == 17
    assert all(r["doublingTimeMinutes"] is None and r["maximumOd600"] is None for r in no_growth)
    assert any(r["value"] < 0 for r in result["biolog"]["records"])
    assert any(r["value"] == 0 for r in result["biolog"]["records"])
    assert any(s["label"] == "Biolog: MDS42_Seg80-0" for s in result["strains"])
    for row, record in zip(document["growth"], result["growth"]["records"], strict=True):
        assert record["doublingTimeMinutes"] == row["doublingTimeMinutes"]
        assert record["conditionId"] == ("m9" if row["sourceRow"] in ingest.M9_ROWS else "2xyt")
    by_row = {r["id"]: r for r in result["growth"]["records"]}
    for m9, rich in ingest.M9_TO_RICH_ROW.items():
        assert by_row[f"growth-row-{m9}"]["strainId"] == by_row[f"growth-row-{rich}"]["strainId"]
    expected_wells = [row["maxHeight"] for sheet in document["biolog"] for row in sheet["rows"]]
    assert [row["value"] for row in result["biolog"]["records"]] == expected_wells


def test_changed_omics_columns_fail_before_writing(tmp_path):
    document = {"omics": [{"sheet": ingest.SHEET, "columns": []}]}
    with pytest.raises(ValueError, match="columns changed"):
        ingest.write_omics(document, [], {}, tmp_path, tmp_path / "none")
    assert not list(tmp_path.iterdir())
