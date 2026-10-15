"""Synthetic SOFT contracts; no network or biological inference in these tests."""

import gzip
import hashlib
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from geo_array import project_geo_table, read_geo_soft  # noqa: E402


def platform(identifier="GPL1", header="ID\tORF\tSEQUENCE\tSEQUENCE", rows=None):
    rows = rows if rows is not None else ["p1\tgene1\tACG\tGCA", "p2\tgene2\tAAA\tTTT"]
    return (f"^PLATFORM = {identifier}\n!Platform_title = exact platform\n"
            "#ID = feature identifier\n#SEQUENCE = first sequence\n#SEQUENCE = second sequence\n"
            f"!platform_table_begin\n{header}\n" + "\n".join(rows) + "\n!platform_table_end\n")


def sample(identifier="GSM1", platform_id="GPL1", rows=None, extra="", header="ID_REF\tVALUE\tFLAG"):
    rows = rows if rows is not None else ["p2\t-1.2300e-02\tnormal", "p1\tNA\tmissing"]
    return (f"^SAMPLE = {identifier}\n!Sample_title = {identifier} = exact title\n"
            f"!Sample_platform_id = {platform_id}\n"
            "!Sample_characteristics_ch1 = genotype: WT\n"
            "!Sample_characteristics_ch1 = time: 0\n"
            "!Sample_label_ch1 = Cy3\n!Sample_label_ch2 = Cy5\n"
            "!Sample_data_processing = keep  trailing spaces  \n"
            f"{extra}#VALUE = deposited value, no inferred units\n!sample_table_begin\n{header}\n"
            + "\n".join(rows) + "\n!sample_table_end\n")


def family(*samples, platforms=None):
    return ("^DATABASE = GeoMiame\n!Database_name = GEO\n"
            "^SERIES = GSE1\n!Series_sample_id = GSM1\n!Series_sample_id = GSM2\n"
            + (platform() if platforms is None else platforms)
            + "".join(samples or [sample()])).encode("utf-8")


def read(data=None, **kwargs):
    return read_geo_soft(family() if data is None else data, source_id="GSE1 family", **kwargs)


def project(document, **kwargs):
    return project_geo_table(document, platform_id="GPL1", id_column="ORF", **kwargs)


@pytest.mark.parametrize("compressed", [False, True])
def test_lossless_records_and_provenance_survive_json_round_trip(compressed):
    raw = family(sample(), sample("GSM2", rows=["p1\t\tblank", "p2\t0.000\tzero"]))
    data = gzip.compress(raw, mtime=0) if compressed else raw
    doc = json.loads(json.dumps(read(data)))
    assert doc["schemaVersion"] == 1 and doc["format"] == "geo-soft"
    source = doc["sources"][0]
    assert source["sha256"] == hashlib.sha256(data).hexdigest()
    assert source["compression"] == ("gzip" if compressed else "none")
    entities = source["entities"]
    assert [entity["type"] for entity in entities] == ["DATABASE", "SERIES", "PLATFORM", "SAMPLE", "SAMPLE"]
    assert [item["value"] for item in entities[1]["metadata"]] == ["GSM1", "GSM2"]
    platform_entity = entities[2]
    assert platform_entity["table"]["header"] == ["ID", "ORF", "SEQUENCE", "SEQUENCE"]
    assert platform_entity["table"]["rows"][0] == ["p1", "gene1", "ACG", "GCA"]
    assert [item["value"] for item in platform_entity["columnDescriptions"]] == [
        "feature identifier", "first sequence", "second sequence"]
    metadata = entities[3]["metadata"]
    assert [item["value"] for item in metadata if item["key"] == "Sample_characteristics_ch1"] == [
        "genotype: WT", "time: 0"]
    assert metadata[0]["value"] == "GSM1 = exact title"
    assert metadata[-1]["value"] == "keep  trailing spaces  "
    assert all(item["line"] > 0 for item in metadata)
    assert entities[3]["table"]["rows"][0][2] == "normal"
    assert doc["measurements"][0] == {
        "sourceId": "GSE1 family", "sampleId": "GSM1", "platformId": "GPL1",
        "idRef": "p2", "value": "-1.2300e-02", "sampleRow": 0,
        "platformSourceId": "GSE1 family", "platformRow": 1,
    }
    assert [m["value"] for m in doc["measurements"]] == ["-1.2300e-02", "NA", "", "0.000"]
    header, rows, audit = project(doc, sample_ids=["GSM2", "GSM1"])
    assert header == ["ORF", "GSM2", "GSM1"]
    assert rows == [["gene2", "0.000", "-1.2300e-02"], ["gene1", "", "NA"]]
    assert audit["mappedProbes"] == 2 and audit["unmappedProbes"] == 0


def test_pinned_separate_platform_keeps_its_namespace_and_other_samples_out():
    gpl = (platform() + sample("GSM999")).encode()
    doc = read(family(platforms=""), platform_data=gzip.compress(gpl, mtime=0), platform_source_id="GPL1 pin")
    assert len(doc["sources"]) == 2
    assert [sample["id"] for sample in doc["samples"]] == ["GSM1"]
    assert doc["measurements"][0]["platformSourceId"] == "GPL1 pin"
    assert len(doc["sources"][1]["entities"]) == 2
    assert project(doc)[1] == [["gene2", "-1.2300e-02"], ["gene1", "NA"]]


def test_multi_platform_membership_is_not_joined_by_probe_name():
    doc = read(family(sample(), sample("GSM2", "GPL2", rows=["p1\t7\tok"]),
                      platforms=platform() + platform("GPL2", rows=["p1\totherGene\tAAA\tCCC"])))
    assert len(doc["measurements"]) == 3
    assert project(doc)[0] == ["ORF", "GSM1"]
    assert project_geo_table(doc, platform_id="GPL2", id_column="ORF")[1] == [["otherGene", "7"]]
    with pytest.raises(ValueError, match="selected samples"):
        project(doc, sample_ids=["GSM2"])


def test_blank_mappings_are_preserved_and_audited_per_sample():
    doc = read(family(sample(), sample("GSM2", rows=["p1\tnull\tmissing"]),
                      platforms=platform(rows=["p1\tgene1\tAAA\tCCC", "p2\t\tCCC\tGGG", "p3\t \tAAA\tTTT"])))
    header, rows, audit = project(doc)
    assert header == ["ORF", "GSM1", "GSM2"]
    assert rows == [["gene1", "NA", "null"]]
    assert audit["blankMappingProbeIds"] == ["p2", "p3"]
    assert audit["unmappedProbes"] == 1 and audit["unmappedProbeIds"] == ["p2"]
    assert audit["unmappedProbeIdsBySample"] == {"GSM1": ["p2"], "GSM2": []}
    assert len(doc["measurements"]) == 3


def test_unmeasured_probe_remains_blank_and_not_zero():
    doc = read(family(sample(rows=["p2\tNaN\tx"]), sample("GSM2", rows=["p1\t0\tx"])))
    assert project(doc)[1] == [["gene2", "NaN", ""], ["gene1", "", "0"]]


def test_column_order_is_explicit_and_bom_crlf_are_supported():
    raw = family(sample(header="VALUE\tID_REF", rows=["1.000\tp1"]),
                 platforms=platform(header="ORF\tID", rows=["gene1\tp1"]))
    doc = read(b"\xef\xbb\xbf" + raw.replace(b"\n", b"\r\n"))
    assert project(doc)[1] == [["gene1", "1.000"]]
    assert project_geo_table(doc, platform_id="GPL1", id_column="ID")[1] == [["p1", "1.000"]]


def test_blank_lines_between_records_are_allowed_but_platform_membership_is_required():
    assert project(read(b"\n" + family().replace(b"^SAMPLE", b"\n^SAMPLE") + b"\n"))[1]
    with pytest.raises(ValueError, match="known Sample_platform_id"):
        read(family(sample().replace("!Sample_platform_id = GPL1\n", "")))


@pytest.mark.parametrize("data, message", [
    (b"", "no SOFT entities"),
    (b"\xff", "invalid gzip or UTF-8"),
    (b"\x1f\x8b", "invalid gzip or UTF-8"),
    (b"hello\n", "malformed SOFT"),
    (b"!Sample_title = orphan\n", "metadata without entity"),
    (b"^DATASET = GDS1\n", "unsupported SOFT entity"),
    (b"^SAMPLE = \n", "entity identifier"),
    (b"^SAMPLE =  GSM1\n", "entity identifier"),
    (b"^SERIES = GSE1\n!Platform_title = wrong\n", "metadata does not match"),
    (b"^SAMPLE = GSM1\n", "missing table"),
    (b"^PLATFORM = GPL1\n", "missing table"),
    (b"^SERIES = GSE1\n", "no sample measurements"),
    (b"!sample_table_begin\n", "marker does not match"),
    (b"^SAMPLE = GSM1\n!platform_table_begin\n", "marker does not match"),
    (b"^SAMPLE = GSM1\n!sample_table_end\n", "end without begin"),
    (b"^SAMPLE = GSM1\n!sample_table_begin\n!sample_table_begin\n", "nested table begin"),
    (b"^SAMPLE = GSM1\n!sample_table_begin\n!sample_table_end\n", "no header"),
    (b"^SAMPLE = GSM1\n!sample_table_begin\nID_REF\tVALUE\n", "unterminated"),
    (b"^SAMPLE = GSM1\n!sample_table_begin\n^SAMPLE = GSM2\n", "inside table"),
    (b"^SAMPLE = GSM1\n!sample_table_begin\nID_REF\t\n", "table heading"),
    (b"^SAMPLE = GSM1\n!sample_table_begin\nID_REF\t VALUE\n", "table heading"),
])
def test_malformed_sources_fail_explicitly(data, message):
    with pytest.raises(ValueError, match=message):
        read(data)


@pytest.mark.parametrize("replacement, message", [
    (sample(header="ID_REF\tOTHER", rows=["p1\tx"]), "exactly one 'VALUE'"),
    (sample(header="ID_REF\tVALUE\tVALUE", rows=["p1\t1\t2"]), "exactly one 'VALUE'"),
    (sample(header="ID_REF\tID_REF\tVALUE", rows=["p1\tp1\t2"]), "exactly one 'ID_REF'"),
    (sample(rows=["p1\t1"]), "row width"),
    (sample(rows=["p1\t1\tx\textra"]), "row width"),
    (sample(rows=["p1\t1\tx", "p1\t2\tx"]), "duplicate ID_REF"),
    (sample(rows=["\t1\tx"]), "empty or padded ID_REF"),
    (sample(rows=[" p1\t1\tx"]), "empty or padded ID_REF"),
    (sample(rows=["unknown\t1\tx"]), "absent from GPL1"),
    (sample(platform_id="GPL99"), "known Sample_platform_id"),
    (sample(extra="!Sample_platform_id = GPL1\n"), "exactly one known"),
    (sample(extra="!Sample_data_row_count = 99\n"), "data_row_count"),
    (sample(extra="!Sample_data_row_count = bad\n"), "data_row_count"),
    (sample(extra="!Sample_data_row_count = 2\n!Sample_data_row_count = 2\n"), "data_row_count"),
    (sample() + sample(), "duplicate SAMPLE"),
    (sample() + "!sample_table_begin\n", "duplicate or nested"),
    (sample().replace("!sample_table_end", "!sample_table_end = invalid"), "malformed marker"),
])
def test_invalid_sample_tables_fail(replacement, message):
    with pytest.raises(ValueError, match=message):
        read(family(replacement))


@pytest.mark.parametrize("replacement, message", [
    (platform(header="ORF\tOTHER", rows=["gene1\tx"]), "exactly one 'ID'"),
    (platform(header="ID\tID", rows=["p1\tp1"]), "exactly one 'ID'"),
    (platform(rows=["p1\tgene1\tAAA\tTTT", "p1\tgene2\tAAA\tCCC"]), "duplicate ID"),
    (platform(rows=["\tgene1\tAAA\tTTT"]), "empty or padded ID"),
    (platform().replace("!platform_table_begin", "!Platform_data_row_count = 3\n!platform_table_begin"), "data_row_count"),
    (platform() + platform(), "duplicate PLATFORM"),
])
def test_invalid_platform_tables_fail(replacement, message):
    with pytest.raises(ValueError, match=message):
        read(family(platforms=replacement))


def test_valid_declared_row_counts_and_empty_sample_table():
    doc = read(family(sample(extra="!Sample_data_row_count = 2\n")))
    assert len(doc["measurements"]) == 2
    empty = sample(rows=[]).replace("VALUE\tFLAG\n\n", "VALUE\tFLAG\n")
    assert project(read(family(empty)))[1] == []


@pytest.mark.parametrize("kwargs, message", [
    ({"platform_data": b"x"}, "supplied together"),
    ({"platform_source_id": "GPL"}, "supplied together"),
    ({"platform_data": b"x", "platform_source_id": "GSE1 family"}, "must differ"),
    ({"platform_data": platform().encode(), "platform_source_id": "GPL"}, "duplicate platform definition"),
    ({"platform_data": b"^DATABASE = GEO\n", "platform_source_id": "GPL"}, "contains no platform"),
])
def test_invalid_external_platform_inputs_fail(kwargs, message):
    with pytest.raises(ValueError, match=message):
        read(**kwargs)


@pytest.mark.parametrize("source_id", ["", " ", None])
def test_source_identity_is_required(source_id):
    with pytest.raises(ValueError, match="source_id"):
        read_geo_soft(family(), source_id=source_id)


@pytest.mark.parametrize("ids", [[], ["GSM1", "GSM1"], "GSM1", [None], [["GSM1"]]])
def test_sample_selection_requires_unique_ids(ids):
    with pytest.raises(ValueError, match="nonempty list of unique"):
        project(read(), sample_ids=ids)


def test_unknown_samples_platforms_and_columns_fail():
    doc = read()
    with pytest.raises(ValueError, match="selected samples"):
        project(doc, sample_ids=["GSM99"])
    with pytest.raises(ValueError, match="nonempty list"):
        project_geo_table(doc, platform_id="GPL99", id_column="ORF")
    with pytest.raises(ValueError, match="exactly one platform"):
        project({**doc, "sources": []})
    with pytest.raises(ValueError, match="exactly one 'missing'"):
        project_geo_table(doc, platform_id="GPL1", id_column="missing")
    with pytest.raises(ValueError, match="collides"):
        project_geo_table(doc, platform_id="GPL1", id_column="GSM1")


@pytest.mark.parametrize("mapping", ["gene1", "gene2;gene3", "gene2 gene3", "gene2///gene3", "gene2,gene3", "gene2|gene3", " gene2"])
def test_ambiguous_mappings_are_retained_but_never_projected(mapping):
    doc = read(family(platforms=platform(rows=["p1\tgene1\tAAA\tTTT", f"p2\t{mapping}\tCCC\tGGG"])))
    assert len(doc["measurements"]) == 2
    with pytest.raises(ValueError, match="repeated ORF|non-atomic"):
        project(doc)


def test_selected_mapping_heading_must_be_unique():
    doc = read(family(platforms=platform(header="ID\tORF\tORF", rows=["p1\tgene1\tgene1", "p2\tgene2\tgene2"])))
    with pytest.raises(ValueError, match="exactly one 'ORF'"):
        project(doc)


def test_identifier_pattern_matches_whole_cell_and_does_not_extract():
    doc = read()
    assert project(doc, identifier_pattern=r"gene(\d+)")[1][0][0] == "gene2"
    with pytest.raises(ValueError, match="invalid ORF"):
        project(doc, identifier_pattern=r"gene1")


def test_document_cannot_silently_overwrite_duplicate_measurements():
    doc = read()
    doc["measurements"].append(doc["measurements"][0])
    with pytest.raises(ValueError, match="duplicate measurement"):
        project(doc)
