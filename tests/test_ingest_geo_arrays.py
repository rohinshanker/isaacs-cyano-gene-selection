"""Array-source integrity, orientation, missingness and publication contracts."""

import copy
import csv
import gzip
import hashlib
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import ingest_geo_arrays as arrays  # noqa: E402


def compressed(text):
    return gzip.compress(text.encode())


def entity(**fields):
    return {"metadata": [{"key": key, "value": value} for key, values in fields.items() for value in values]}


def test_wrappers_and_matrix_equality_preserve_missing_tokens_and_order():
    data = compressed('!series_matrix_table_begin\n"ID_REF"\t"GSM1"\t"GSM2"\n"p"\t-1.25\tnull\n!series_matrix_table_end\n')
    document = {"measurements": [{"sampleId": "GSM1", "idRef": "p", "value": "-1.25"},
                                 {"sampleId": "GSM2", "idRef": "p", "value": "null"}]}
    arrays.verify_matrix(document, data, ["GSM1", "GSM2"])
    with pytest.raises(ValueError, match="membership/order"):
        arrays.verify_matrix(document, data, ["GSM2", "GSM1"])
    changed = copy.deepcopy(document)
    changed["measurements"][1]["value"] = "0"
    with pytest.raises(ValueError, match="measurements differ"):
        arrays.verify_matrix(changed, data, ["GSM1", "GSM2"])
    for text in ("", "!x_table_begin\n!x_table_end", "!x_table_end\n!x_table_begin"):
        with pytest.raises(ValueError):
            arrays.wrapped_table(compressed(text), "x")
    for body, message in (("p\t1", "row width"), ("p\t1\t2\np\t3\t4", "duplicate matrix")):
        malformed = compressed('!series_matrix_table_begin\nID_REF\tGSM1\tGSM2\n' + body + '\n!series_matrix_table_end')
        with pytest.raises(ValueError, match=message):
            arrays.verify_matrix(document, malformed, ["GSM1", "GSM2"])


def test_explicit_summary_does_not_fill_missing_measurements():
    values = {"a": {"x": 4, "only-a": 3}, "b": {"x": -2, "only-b": 5}}
    assert arrays.summary_values(values, ["a", "b"], [1, -1]) == {"x": 3}
    assert arrays.summary_values(values, ["a", "b"], [1, 1]) == {"x": 1}
    for members, signs in ((["a"], [1]), (["a", "a"], [1, 1]), (["a", "b"], [1]), (["a", "b"], [1, 0]), (["a", "c"], [1, 1])):
        with pytest.raises(ValueError):
            arrays.summary_values(values, members, signs)


def test_dye_swap_matches_by_platform_feature_id_not_legacy_gene_spelling():
    data = compressed("Gene ID\tJGI_ID\tlog2(rpaA/WT)\t\nold-name\t123\t1.23\t\ncontrol\t0\t99\t\n\t\t\t\n")
    result = arrays.verify_dye_swap({"gene": 1.234}, data, {"123": "gene", "0": ""})
    assert result["comparedGenes"] == 1
    assert result["maximumAbsoluteDifference"] == pytest.approx(0.004)
    for values in ({"gene": -1.234}, {"absent": 1}, {}):
        with pytest.raises(ValueError):
            arrays.verify_dye_swap(values, data, {"123": "gene"})
    for text, message in (("wrong\theader\n", "schema"), ("Gene ID\tJGI_ID\tx\na\n", "short"),
                          ("Gene ID\tJGI_ID\tx\na\t123\t1\na\t123\t1\n", "duplicate")):
        with pytest.raises(ValueError, match=message):
            arrays.verify_dye_swap({"gene": 1}, compressed(text), {"123": "gene"})


def test_source_specific_pooling_guards_channels_treatments_and_membership():
    source = {"studyId": "GSE50919"}
    pool = {"sampleIds": ["GSM1232426", "GSM1232427"], "multipliers": [1, -1]}
    samples = {pool["sampleIds"][0]: entity(Sample_source_name_ch1=["mutant"], Sample_source_name_ch2=["WT"], Sample_label_ch1=["Cy3"], Sample_label_ch2=["Cy5"]),
               pool["sampleIds"][1]: entity(Sample_source_name_ch1=["WT"], Sample_source_name_ch2=["mutant"], Sample_label_ch1=["Cy3"], Sample_label_ch2=["Cy5"])}
    arrays.verify_pool_metadata(source, pool, samples)
    wrong = copy.deepcopy(pool); wrong["multipliers"] = [1, 1]
    with pytest.raises(ValueError, match="orientation"):
        arrays.verify_pool_metadata(source, wrong, samples)
    for key, value, message in (("Sample_source_name_ch1", "other", "reverse"), ("Sample_label_ch1", "Cy5", "dye assignments")):
        bad = copy.deepcopy(samples)
        for item in bad[pool["sampleIds"][0]]["metadata"]:
            if item["key"] == key: item["value"] = value
        with pytest.raises(ValueError, match=message):
            arrays.verify_pool_metadata(source, pool, bad)
    members = [f"GSM{i}" for i in range(2748217, 2748221)]
    signals = {sample: entity(Sample_source_name_ch1=["control"], Sample_treatment_protocol_ch1=["5 h"], Sample_data_processing=["same method"]) for sample in members}
    pool = {"sampleIds": members, "multipliers": [1] * 4}
    arrays.verify_pool_metadata({"studyId": "GSE102914"}, pool, signals)
    bad = copy.deepcopy(signals); bad[members[1]]["metadata"][0]["value"] = "treated"
    with pytest.raises(ValueError, match="differs"):
        arrays.verify_pool_metadata({"studyId": "GSE102914"}, pool, bad)
    with pytest.raises(ValueError, match="unrecognized"):
        arrays.verify_pool_metadata({"studyId": "GSE102914"}, {**pool, "multipliers": [-1] * 4}, signals)
    with pytest.raises(ValueError, match="no validated"):
        arrays.verify_pool_metadata({"studyId": "other"}, pool, signals)


def test_shipped_arrays_are_separate_exact_typed_samples_with_only_explicit_summaries():
    catalogue = json.loads(arrays.CATALOGUE.read_text())
    sources = json.loads((ROOT / "data/expression/sources.json").read_text())
    studies = {s["studyId"] for s in catalogue["sources"]}
    entries = [s for s in sources if s["record"]["studyId"] in studies]
    assert len(entries) == 127
    assert sum(s["ingest"]["array"]["summary"] is not None for s in entries) == 5
    assert sum(s["ingest"]["array"]["summary"] is None for s in entries) == 122
    expected = {f'{s["studyId"]}_{gsm}' for s in catalogue["sources"] for gsm in s["sampleAccessions"]}
    assert {s["id"] for s in entries if s["ingest"]["array"]["summary"] is None} == expected
    for source in entries:
        quantity = arrays.declared_flags(source["quantity"])
        assert source["signed"] == quantity["signed"]
        assert source["record"]["platform"] == "array"
        assert source["record"]["basis"] == "transferred"
        assert "combined by the authors" in source["caveat"]
        data = (ROOT / "data/expression" / source["file"]).read_bytes()
        assert hashlib.sha256(data).hexdigest() == source["sha256"]
        rows = list(csv.DictReader(data.decode().splitlines(), delimiter="\t"))
        assert len(rows) == source["ingest"]["mappedGenes"]
        assert len({r["locus_tag"] for r in rows}) == len(rows)


@pytest.mark.parametrize("name,value,column", [("array_log2_ratio", -1.25, "log2_fold_change"),
                                               ("array_temporal_profile", -4.123456789, "normalized_profile"),
                                               ("array_normalized_signal", 182.123456789, "normalized_signal")])
def test_array_quantities_are_exact_nonpooling_and_array_only(name, value, column):
    from expression_table import check_declaration, format_value, quantity_facts
    declaration = check_declaration("transcriptomics", "array", name, "array")
    assert declaration.column == column
    assert float(format_value(value, name)) == value
    assert quantity_facts("transcriptomics", "array", name, "array")["quantityPools"] is False
    with pytest.raises(ValueError):
        check_declaration("transcriptomics", "RNA-seq", name, "wrong platform")


def test_pinned_real_sources_rebuild_every_published_array_value(tmp_path):
    catalogue = json.loads(arrays.CATALOGUE.read_text())
    cache = ROOT / "data/interim/geo-arrays"
    pins = [catalogue["platform"]]
    for source in catalogue["sources"]:
        pins.extend([source["soft"], source["matrix"]])
        if "publishedDyeSwapSummary" in source:
            pins.append(source["publishedDyeSwapSummary"])
    if not all((cache / pin["name"]).exists() for pin in pins):
        pytest.skip("optional pinned GEO input cache; run ingest_geo_arrays.py to populate")
    rebuilt = arrays.build(catalogue, interim=cache, out_dir=tmp_path)
    manifest = json.loads((ROOT / "data/expression/sources.json").read_text())
    published = {source["id"]: source for source in manifest}
    for source in rebuilt:
        assert source == published[source["id"]]
        assert (tmp_path / source["file"]).read_bytes() == (ROOT / "data/expression" / source["file"]).read_bytes()
    broken = copy.deepcopy(catalogue)
    broken["crosswalk"]["sha256"] = "0" * 64
    with pytest.raises(ValueError, match="crosswalk checksum"):
        arrays.build(broken, interim=cache, out_dir=tmp_path)
