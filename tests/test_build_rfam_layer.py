"""Tests for tools/build_rfam_layer.py, the published RF01116 layer producer.

Synthetic runs reuse the fixtures and stub cmsearch of
tests/test_regulatory_rfam.py, so the layer is always built from a report the
real pilot pipeline produced. The production path (``main`` with ``PINNED``)
is exercised end to end by swapping ``PINNED`` for the fixture pins. The
real-tool tests rebuild the published files from the pinned assembly with
Infernal 1.1.5 and skip when either is absent.
"""

import copy
import dataclasses
import json
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_rfam_layer as brl  # noqa: E402
import regulatory_rfam as rr  # noqa: E402
import test_regulatory_rfam as trr  # noqa: E402

# Shared fixtures: the stub cmsearch with its rows directory, the synthetic
# genome/model inputs, and the extracted real model.
stub_cmsearch = trr.stub_cmsearch
pilot_inputs = trr.pilot_inputs
pinned_model = trr.pinned_model

PUBLISHED_JSON = REPO_ROOT / "site/data/rfam_rf01116.json"
PUBLISHED_TSV = REPO_ROOT / "site/data/rfam_rf01116.tsv"

# Synthetic genome (trr.GENOME): NZ_TEST001.1 is 20 bases circular,
# NZ_TEST002.1 12 bases linear. Window 6 gives a 10-base junction whose
# positions 1..5 are native 16..20 and 6..10 are native 1..5.
PLUS_ROW = trr.row()  # NZ_TEST001.1 11..14 +
MINUS_TRUNCATED_ROW = trr.row(
    target="NZ_TEST002.1",
    seq_from="8",
    seq_to="5",
    strand="-",
    trunc="5'",
    mdl_from="2",
    mdl_to="4",
    score="40.5",
    evalue="3.1e-05",
)
WRAP_ROW = trr.row(target="NZ_TEST001.1_origin_junction", seq_from="4", seq_to="7")
CONTROL_ROW = trr.row(target="NZ_TEST001.1_shuffled_00", seq_from="2", seq_to="5")


def stub_report(stub_cmsearch, pilot_inputs, rows=None):
    """A real pilot report from the stub pipeline; ``rows`` maps search stem to rows."""
    _, rows_dir = stub_cmsearch
    for stem, lines in (rows or {}).items():
        (rows_dir / f"{stem}.rows").write_text("".join(f"{line}\n" for line in lines))
    return trr.run_stub_pilot(stub_cmsearch, pilot_inputs)


@pytest.fixture
def full_report(stub_cmsearch, pilot_inputs):
    """Linear plus, truncated minus, origin wrap and one control hit."""
    return stub_report(
        stub_cmsearch,
        pilot_inputs,
        {
            "native": [PLUS_ROW, MINUS_TRUNCATED_ROW],
            "origin_junction": [WRAP_ROW],
            "control_00": [CONTROL_ROW],
        },
    )


@pytest.fixture
def full_layer(full_report, pilot_inputs):
    return brl.build_layer(full_report, pilot_inputs["pins"])


# --------------------------------------------------------------------------
# Sites
# --------------------------------------------------------------------------


def test_every_ga_hit_becomes_a_site_in_pilot_order(full_layer, full_report):
    assert [site["id"] for site in full_layer["sites"]] == [
        "RF01116:NZ_TEST001.1:11:14:+",
        "RF01116:NZ_TEST002.1:5:8:-",
        "RF01116:NZ_TEST001.1:19:2:+",
    ]
    # Pilot order is kept so provenance.overlaps indices still name these sites.
    assert [site["raw"] for site in full_layer["sites"]] == full_report["hits"]


def test_linear_site_carries_the_agreed_fields(full_layer):
    site = full_layer["sites"][0]
    assert {key: value for key, value in site.items() if key != "raw"} == {
        "id": "RF01116:NZ_TEST001.1:11:14:+",
        "type": "rnaFamily",
        "replicon": "NZ_TEST001.1",
        "position": 11,
        "endPosition": 14,
        "strand": "+",
        "origin": "computed",
        "measurement": "predicted",
        "producer": "Infernal 1.1.5 / Rfam 15.1 RF01116",
        "scoreBits": 62.1,
        "evalue": 6.7e-12,
        "truncation": "no",
        "modelStart": 1,
        "modelEnd": 4,
        "originSpanning": False,
    }


def test_minus_strand_truncated_site_keeps_raw_descending_endpoints(full_layer):
    site = full_layer["sites"][1]
    assert (site["position"], site["endPosition"], site["strand"]) == (5, 8, "-")
    assert (site["truncation"], site["modelStart"], site["modelEnd"]) == ("5'", 2, 4)
    assert (site["scoreBits"], site["evalue"]) == (40.5, 3.1e-05)
    assert (site["raw"]["raw_seq_from"], site["raw"]["raw_seq_to"]) == (8, 5)


def test_origin_spanning_site_is_a_wrap_with_junction_raw_coordinates(full_layer):
    site = full_layer["sites"][2]
    assert site["originSpanning"] is True
    assert (site["replicon"], site["position"], site["endPosition"]) == (
        "NZ_TEST001.1",
        19,
        2,
    )
    assert site["raw"]["search_space"] == rr.SEARCH_SPACE_JUNCTION
    assert site["raw"]["search_target"] == "NZ_TEST001.1_origin_junction"
    assert (site["raw"]["raw_seq_from"], site["raw"]["raw_seq_to"]) == (4, 7)


def test_site_raw_is_a_copy_not_the_report_row(full_layer, full_report):
    full_layer["sites"][0]["raw"]["score"] = 0.0
    assert full_report["hits"][0]["score"] == 62.1


def test_control_hits_stay_out_of_sites_and_in_provenance(full_layer):
    assert all(
        site["raw"]["search_space"] != rr.SEARCH_SPACE_CONTROL
        for site in full_layer["sites"]
    )
    (replicate_hit,) = full_layer["provenance"]["control"]["replicates"][0]["hits"]
    assert replicate_hit["search_target"] == "NZ_TEST001.1_shuffled_00"
    assert "native_start" not in replicate_hit
    assert full_layer["provenance"]["counts"]["controlHitsTotal"] == 1


def test_a_run_without_hits_publishes_no_sites(stub_cmsearch, pilot_inputs):
    report = stub_report(stub_cmsearch, pilot_inputs)
    layer = brl.build_layer(report, pilot_inputs["pins"])
    assert layer["sites"] == []
    assert layer["provenance"]["counts"]["totalHits"] == 0
    tsv = brl.layer_tsv_text(layer, "x.json")
    assert tsv.splitlines()[-1] == "\t".join(brl.TSV_COLUMNS)


def test_layer_header_matches_the_agreed_contract(full_layer):
    assert {key: full_layer[key] for key in full_layer if key not in (
        "sites", "provenance", "limitations"
    )} == {
        "schemaVersion": 1,
        "id": "rfam-rf01116",
        "label": "RF01116 / Yfr1 family homology",
        "origin": "computed",
        "measurement": "predicted",
        "assembly": "GCF_000817325.1_ASM81732v1",
        "family": {
            "accession": "RF01116",
            "name": "Yfr1",
            "release": "15.1",
            "gaBits": 38.0,
        },
    }


def test_producer_label_reads_the_version_from_the_report(full_report):
    report = copy.deepcopy(full_report)
    report["tool"]["version"] = "9.9.9 (Jan 2099)"
    assert brl.producer_label(report) == "Infernal 9.9.9 / Rfam 15.1 RF01116"


def test_limitations_state_the_boundaries_with_report_numbers(full_layer):
    text = "\n".join(full_layer["limitations"])
    for phrase in (
        "not a complete transcript",
        "not demonstrated regulatory function",
        "not a native interaction",
        "not a calibrated biological probability",
        "no RF01116 match at or above the GA threshold",
        "Other Rfam families were not evaluated",
        "no absence of regulation is inferred",
        "not recomputed for an active recoding scheme",
        "all 2 replicons (32 residues) end to end on both strands",
        "10-base origin junction for each of 1 circular replicons",
        "W=6",
        "2 mononucleotide replicates) are linear only",
        "I-SCI-1",
        "No gene is assigned",
        "gathering threshold of 38.0 bits",
    ):
        assert phrase in text, phrase
    assert "uncovered" not in text and "not searched" not in text


# --------------------------------------------------------------------------
# Refusals
# --------------------------------------------------------------------------


def test_build_layer_defaults_to_the_production_pins(full_report):
    with pytest.raises(brl.RfamLayerError, match="pinned identity"):
        brl.build_layer(full_report)


def test_build_layer_refuses_an_unverified_identity(full_report, pilot_inputs):
    full_report["pinnedIdentity"]["verified"] = False
    with pytest.raises(brl.RfamLayerError, match="pinned identity"):
        brl.build_layer(full_report, pilot_inputs["pins"])


@pytest.mark.parametrize(
    ("key", "value"), [("schemaVersion", 1), ("recordOrigin", "measured")]
)
def test_build_layer_refuses_another_report_kind(full_report, pilot_inputs, key, value):
    full_report[key] = value
    with pytest.raises(brl.RfamLayerError, match="computed pilot report of schema 2"):
        brl.build_layer(full_report, pilot_inputs["pins"])


def test_build_layer_refuses_duplicate_site_ids(full_report, pilot_inputs):
    full_report["hits"].append(copy.deepcopy(full_report["hits"][0]))
    with pytest.raises(brl.RfamLayerError, match="RF01116:NZ_TEST001.1:11:14:"):
        brl.build_layer(full_report, pilot_inputs["pins"])


# --------------------------------------------------------------------------
# Provenance
# --------------------------------------------------------------------------


def _with_absolute_paths(report):
    report = copy.deepcopy(report)
    report["tool"]["executable"] = "/opt/env/bin/cmsearch"
    report["tool"]["resolvedExecutable"] = "/opt/env/libexec/cmsearch-1.1.5"
    for search in (
        report["nativeSearch"],
        report["originJunctionSearch"],
        *report["control"]["replicates"],
    ):
        search["argv"][0] = "/opt/env/bin/cmsearch"
        search["argv"][-2] = "/Users/someone/scratch/RF01116.cm"
    return report


def test_sanitized_provenance_reduces_only_tool_and_argv_paths(full_report):
    report = _with_absolute_paths(full_report)
    provenance = brl.sanitized_provenance(report)
    assert provenance["tool"]["executable"] == "cmsearch"
    assert provenance["tool"]["resolvedExecutable"] == "cmsearch-1.1.5"
    for search in (
        provenance["nativeSearch"],
        provenance["originJunctionSearch"],
        *provenance["control"]["replicates"],
    ):
        assert search["argv"][0] == "cmsearch"
        assert search["argv"][-2] == "RF01116.cm"
    # Everything else, digests and parameters included, is copied unchanged.
    restored = copy.deepcopy(provenance)
    restored["tool"] = report["tool"]
    for key in ("nativeSearch", "originJunctionSearch"):
        restored[key]["argv"] = report[key]["argv"]
    for mine, theirs in zip(
        restored["control"]["replicates"], report["control"]["replicates"]
    ):
        mine["argv"] = theirs["argv"]
    assert restored == report
    assert report["tool"]["executable"] == "/opt/env/bin/cmsearch"  # not mutated


def test_sanitized_provenance_keeps_relative_run_file_names(full_report):
    provenance = brl.sanitized_provenance(_with_absolute_paths(full_report))
    assert provenance["nativeSearch"]["argv"][1:-2] == [
        "-Z",
        f"{full_report['searchSpaceMb']:.6f}",
        "--cut_ga",
        "--rfam",
        "--nohmmonly",
        "--tblout",
        "native.tblout",
        "-o",
        "native.cmsearch",
    ]
    assert provenance["nativeSearch"]["argv"][-1] == "native.fna"


@pytest.mark.parametrize(
    "leak", ["/Users/someone/g.fna.gz", "C:\\data\\g.fna.gz", "copied from /tmp/x"]
)
def test_sanitized_provenance_refuses_any_other_absolute_path(full_report, leak):
    full_report["inputs"]["genomeFasta"]["path"] = leak
    with pytest.raises(brl.RfamLayerError, match=r"provenance\.inputs\.genomeFasta"):
        brl.sanitized_provenance(full_report)


def test_local_paths_ignore_slashes_inside_words():
    assert brl._local_paths(
        {"a": ["INFERNAL1/a [1.1.5 | Sep 2023]", "raw_seq_from/raw_seq_to"]},
    ) == []
    assert brl._local_paths("Infernal 1.1.5 / Rfam 15.1") == []
    assert brl._local_paths(["x", "/abs"]) == ["provenance[1]: /abs"]


def test_published_provenance_has_no_local_path(full_layer):
    assert brl._local_paths(full_layer["provenance"]) == []


# --------------------------------------------------------------------------
# Serialisation and writing
# --------------------------------------------------------------------------


def test_layer_tsv_rows_and_header_comment(full_layer):
    lines = brl.layer_tsv_text(full_layer, "rfam_rf01116.json").splitlines()
    comments = [line for line in lines if line.startswith("#")]
    assert comments[-1] == "# Full provenance, controls and limitations: rfam_rf01116.json"
    header, *rows = lines[len(comments):]
    assert header.split("\t") == list(brl.TSV_COLUMNS)
    assert "gene" not in header
    table = [dict(zip(brl.TSV_COLUMNS, row.split("\t"))) for row in rows]
    assert [entry["site_id"] for entry in table] == [
        site["id"] for site in full_layer["sites"]
    ]
    minus, wrap = table[1], table[2]
    assert (minus["native_start"], minus["native_end"]) == ("5", "8")
    assert (minus["raw_seq_from"], minus["raw_seq_to"]) == ("8", "5")
    assert (minus["truncation"], minus["evalue"]) == ("5'", "3.1e-05")
    assert (wrap["native_start"], wrap["native_end"], wrap["origin_spanning"]) == (
        "19",
        "2",
        "true",
    )
    assert (wrap["search_space"], wrap["search_target"]) == (
        "origin_junction",
        "NZ_TEST001.1_origin_junction",
    )
    assert table[0]["origin_spanning"] == "false"
    assert (table[0]["source"], table[0]["ga_bits"], table[0]["rfam_release"]) == (
        "Infernal 1.1.5 / Rfam 15.1 RF01116",
        "38.0",
        "15.1",
    )


def test_write_layer_creates_both_files(full_layer, tmp_path):
    json_path, tsv_path = tmp_path / "out/layer.json", tmp_path / "out/layer.tsv"
    brl.write_layer(full_layer, json_path, tsv_path)
    assert json.loads(json_path.read_text()) == json.loads(
        brl.layer_json_text(full_layer)
    )
    tsv = tsv_path.read_bytes()
    assert b"\r" not in tsv
    assert tsv.decode().splitlines()[3].endswith("layer.json")


def test_write_layer_never_replaces_and_removes_its_partial_file(full_layer, tmp_path):
    json_path, tsv_path = tmp_path / "layer.json", tmp_path / "layer.tsv"
    tsv_path.write_text("keep me")
    with pytest.raises(brl.RfamLayerError, match="could not create"):
        brl.write_layer(full_layer, json_path, tsv_path)
    assert not json_path.exists()
    assert tsv_path.read_text() == "keep me"


def test_write_layer_notes_a_partial_file_it_could_not_remove(
    full_layer, tmp_path, monkeypatch
):
    json_path, tsv_path = tmp_path / "layer.json", tmp_path / "layer.tsv"
    tsv_path.write_text("keep me")

    def refuse_unlink(self, missing_ok=False):
        raise PermissionError("read-only")

    monkeypatch.setattr(Path, "unlink", refuse_unlink)
    with pytest.raises(brl.RfamLayerError) as info:
        brl.write_layer(full_layer, json_path, tsv_path)
    notes = getattr(info.value.__cause__, "__notes__", [])
    assert any("partial layer file not removed" in note for note in notes)


def test_write_layer_cleans_up_and_reraises_an_interruption(
    full_layer, tmp_path, monkeypatch
):
    json_path, tsv_path = tmp_path / "a/layer.json", tmp_path / "b/layer.tsv"
    real_mkdir = Path.mkdir

    def interrupt_second(self, *args, **kwargs):
        if self == tsv_path.parent:
            raise KeyboardInterrupt
        return real_mkdir(self, *args, **kwargs)

    monkeypatch.setattr(Path, "mkdir", interrupt_second)
    with pytest.raises(KeyboardInterrupt):
        brl.write_layer(full_layer, json_path, tsv_path)
    assert not json_path.exists()


# --------------------------------------------------------------------------
# Command line
# --------------------------------------------------------------------------


def _cli_args(pilot_inputs, script, out):
    return [
        "--cm", str(pilot_inputs["cm_path"]),
        "--fasta", str(pilot_inputs["fasta_path"]),
        "--gbff", str(pilot_inputs["gbff_path"]),
        "--cmsearch", str(script),
        "--workdir", str(out / "work"),
        "--json-out", str(out / "layer.json"),
        "--tsv-out", str(out / "layer.tsv"),
        "--control-replicates", "2",
    ]


def test_main_runs_the_pinned_pilot_and_writes_the_layer(
    stub_cmsearch, pilot_inputs, tmp_path, monkeypatch, capsys
):
    script, rows_dir = stub_cmsearch
    (rows_dir / "native.rows").write_text(PLUS_ROW + "\n")
    (rows_dir / "origin_junction.rows").write_text(WRAP_ROW + "\n")
    monkeypatch.setattr(rr, "PINNED", pilot_inputs["pins"])

    outputs = []
    for name in ("first", "second"):
        assert brl.main(_cli_args(pilot_inputs, script, tmp_path / name)) == 0
        outputs.append(
            [(tmp_path / name / f"layer.{ext}").read_bytes() for ext in ("json", "tsv")]
        )
    # Fresh work directories, byte-identical published files.
    assert outputs[0] == outputs[1]
    layer = json.loads(outputs[0][0])
    assert [site["position"] for site in layer["sites"]] == [11, 19]
    assert layer["provenance"]["tool"]["executable"] == "cmsearch"
    assert capsys.readouterr().out.splitlines()[-1] == (
        "rfam-rf01116: sites=2 origin_spanning=1 control_hits=0 over 2 replicates"
    )


def test_main_refuses_inputs_that_are_not_the_production_pins(
    stub_cmsearch, pilot_inputs, tmp_path
):
    script, _ = stub_cmsearch
    with pytest.raises(SystemExit, match="not the pinned"):
        brl.main(_cli_args(pilot_inputs, script, tmp_path / "out"))
    assert not (tmp_path / "out").exists()


def test_main_refuses_an_existing_output_before_running(
    stub_cmsearch, pilot_inputs, tmp_path, monkeypatch
):
    script, _ = stub_cmsearch
    monkeypatch.setattr(rr, "PINNED", pilot_inputs["pins"])
    out = tmp_path / "out"
    out.mkdir()
    (out / "layer.json").write_text("published")
    with pytest.raises(SystemExit, match="already exists"):
        brl.main(_cli_args(pilot_inputs, script, out))
    assert not (out / "work").exists()
    assert (out / "layer.json").read_text() == "published"


def test_main_reports_a_layer_refusal_as_an_error(
    stub_cmsearch, pilot_inputs, tmp_path, monkeypatch
):
    script, _ = stub_cmsearch
    monkeypatch.setattr(rr, "PINNED", pilot_inputs["pins"])

    def refuse(report):
        raise brl.RfamLayerError("refused")

    monkeypatch.setattr(brl, "sanitized_provenance", refuse)
    with pytest.raises(SystemExit, match="error: refused"):
        brl.main(_cli_args(pilot_inputs, script, tmp_path / "out"))
    assert not (tmp_path / "out/layer.json").exists()


def test_script_entry_point_reports_a_missing_model(tmp_path):
    completed = subprocess.run(
        [
            sys.executable,
            str(REPO_ROOT / "tools/build_rfam_layer.py"),
            "--cm", str(tmp_path / "absent.cm"),
            "--workdir", str(tmp_path / "work"),
            "--json-out", str(tmp_path / "layer.json"),
            "--tsv-out", str(tmp_path / "layer.tsv"),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert completed.returncode == 1
    assert "missing covariance model" in completed.stderr
    assert not (tmp_path / "layer.json").exists()


# --------------------------------------------------------------------------
# Published files
# --------------------------------------------------------------------------


@pytest.fixture(scope="module")
def published_layer():
    return json.loads(PUBLISHED_JSON.read_text(encoding="utf-8"))


def test_published_layer_is_the_single_recorded_yfr1_site(published_layer):
    (site,) = published_layer["sites"]
    assert {key: value for key, value in site.items() if key != "raw"} == {
        "id": "RF01116:NZ_CP006471.1:1364716:1364778:+",
        "type": "rnaFamily",
        "replicon": "NZ_CP006471.1",
        "position": 1364716,
        "endPosition": 1364778,
        "strand": "+",
        "origin": "computed",
        "measurement": "predicted",
        "producer": "Infernal 1.1.5 / Rfam 15.1 RF01116",
        "scoreBits": 62.1,
        "evalue": 6.7e-12,
        "truncation": "no",
        "modelStart": 1,
        "modelEnd": 59,
        "originSpanning": False,
    }
    assert (site["raw"]["raw_seq_from"], site["raw"]["raw_seq_to"]) == (
        1364716,
        1364778,
    )
    assert published_layer["family"] == {
        "accession": "RF01116",
        "name": "Yfr1",
        "release": "15.1",
        "gaBits": 38.0,
    }


def test_published_provenance_is_the_pinned_complete_pilot(published_layer):
    provenance = published_layer["provenance"]
    pinned = json.loads(json.dumps(dataclasses.asdict(rr.PINNED)))
    assert provenance["pinnedIdentity"] == {"verified": True, **pinned}
    assert provenance["nativeSearch"]["cmsearchSummary"] == {
        "queryModels": 1,
        "targetSequences": 3,
        "residuesSearched": 5489252,
        "hitsReported": 1,
    }
    assert provenance["originJunctionSearch"]["searchedReplicons"] == [
        "NZ_CP006471.1",
        "NZ_CP006472.1",
        "NZ_CP006473.1",
    ]
    assert provenance["control"]["hitsTotal"] == 0
    assert len(provenance["control"]["replicates"]) == 5
    assert provenance["inputs"]["searchedFasta"]["sha256"] == (
        rr.PINNED.searched_fasta_sha256
    )
    assert brl._local_paths(provenance) == []


def test_published_tsv_is_derived_from_the_published_json(published_layer):
    assert PUBLISHED_TSV.read_text(encoding="utf-8") == brl.layer_tsv_text(
        published_layer, PUBLISHED_JSON.name
    )


# --------------------------------------------------------------------------
# Real-tool checks against the pinned assembly
# --------------------------------------------------------------------------


@trr.requires_real_tool
def test_real_rebuild_reproduces_the_published_layer(pinned_model, tmp_path):
    json_out, tsv_out = tmp_path / "rfam_rf01116.json", tmp_path / "rfam_rf01116.tsv"
    assert brl.main([
        "--cm", str(pinned_model),
        "--fasta", str(trr.PINNED_FASTA),
        "--gbff", str(trr.PINNED_GBFF),
        "--cmsearch", str(trr.REAL_CMSEARCH),
        "--workdir", str(tmp_path / "work"),
        "--json-out", str(json_out),
        "--tsv-out", str(tsv_out),
    ]) == 0
    rebuilt = json.loads(json_out.read_text())
    published = json.loads(PUBLISHED_JSON.read_text())
    # The cmsearch executable hash is recorded, not pinned: conda builds differ.
    for layer in (rebuilt, published):
        layer["provenance"]["tool"].pop("sha256")
    assert rebuilt == published
    assert tsv_out.read_bytes() == PUBLISHED_TSV.read_bytes()


def _rotated_layer(pinned_model, tmp_path, offset):
    report = trr._run_rotated(pinned_model, tmp_path, offset)
    identity = {k: v for k, v in report["pinnedIdentity"].items() if k != "verified"}
    return brl.build_layer(report, rr.PinnedIdentity(**identity))


@trr.requires_real_tool
def test_real_origin_spanning_hit_becomes_a_wrapped_site(pinned_model, tmp_path):
    layer = _rotated_layer(pinned_model, tmp_path, (1364716 + 1364778) // 2 - 1)
    (site,) = layer["sites"]
    assert site["originSpanning"] is True
    assert (site["position"], site["endPosition"]) == (2690418 - 30, 32)
    assert site["id"] == "RF01116:NZ_CP006471.1:2690388:32:+"
    assert (site["raw"]["raw_seq_from"], site["raw"]["raw_seq_to"]) == (55, 117)
    assert (site["modelStart"], site["modelEnd"], site["scoreBits"]) == (1, 59, 62.1)


@trr.requires_real_tool
def test_real_truncated_and_wrapped_hits_are_both_sites(pinned_model, tmp_path):
    layer = _rotated_layer(pinned_model, tmp_path, 1364716)
    linear, wrapped = layer["sites"]
    assert (linear["position"], linear["endPosition"]) == (1, 62)
    assert linear["truncation"] != "no"
    assert linear["scoreBits"] == 55.3
    assert (wrapped["position"], wrapped["endPosition"]) == (2690418, 62)
    assert (wrapped["truncation"], wrapped["originSpanning"]) == ("no", True)
    assert layer["provenance"]["overlaps"][0]["sharedBases"] == 62
