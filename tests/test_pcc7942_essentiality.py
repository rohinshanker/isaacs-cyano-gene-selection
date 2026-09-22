"""Readiness tests for the pinned PCC 7942 essentiality transfer."""

from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path

import pytest
from openpyxl import Workbook


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "tools/build_pcc7942_essentiality.py"
SPEC = importlib.util.spec_from_file_location("build_pcc7942_essentiality", MODULE_PATH)
assert SPEC and SPEC.loader
essentiality = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(essentiality)


def load_payload() -> dict:
    """Loads the checked-in generated dataset."""
    return json.loads((ROOT / essentiality.OUTPUT_PATH).read_text(encoding="utf-8"))


def source_row(
    utex: str | None = "M744_RS00005",
    pcc: str | None = "SYNPCC7942_RS02980",
    status: str = "essential",
    pg_id: int = 1,
) -> dict:
    """Creates one normalized workbook row for mapping tests."""
    return {"utexLocus": utex, "pccLocus": pcc, "status": status, "pgId": pg_id}


def link(
    pcc: str = "SYNPCC7942_RS02980", ambiguity: str = ""
) -> dict[str, str]:
    """Creates one normalized crosswalk relationship for mapping tests."""
    return {"object_id": pcc, "mapping_ambiguity": ambiguity}


def test_generated_artifact_rebuilds_byte_for_byte() -> None:
    """Pinned inputs reproduce the checked-in JSON exactly."""
    expected = essentiality.render_payload(essentiality.build_payload(ROOT))
    actual = (ROOT / essentiality.OUTPUT_PATH).read_text(encoding="utf-8")
    assert actual == expected
    essentiality.write_or_check(ROOT, check=True)


def test_source_identity_and_expected_counts() -> None:
    """The source bytes and every observed transfer outcome remain pinned."""
    essentiality.verify_workbook(ROOT / essentiality.WORKBOOK_PATH)
    payload = load_payload()
    assert payload["counts"] == {
        "plottedUtex2973Loci": 2715,
        "admitted": 2542,
        "unknown": 173,
        "byStatus": {
            "essential": 660,
            "beneficial": 154,
            "non-essential": 1617,
            "ambiguous": 71,
            "not_analyzed": 1,
            "missing": 39,
            "unknown": 173,
        },
        "byMappingStatus": {
            "accepted": 2542,
            "unmatched": 163,
            "ambiguous": 8,
            "conflicting": 2,
        },
        "unknownByReason": {
            "source_unmatched": 105,
            "source_multivalued": 0,
            "source_pcc_missing": 6,
            "crosswalk_unmatched": 52,
            "crosswalk_multivalued": 8,
            "crosswalk_ambiguous": 0,
            "crosswalk_conflict": 2,
        },
        "workbookRows": 3113,
        "workbookByStatus": {
            "essential": 742,
            "beneficial": 157,
            "non-essential": 1737,
            "ambiguous": 75,
            "not_analyzed": 25,
            "missing": 377,
        },
    }
    assert len(payload["byLocus"]) == 2715
    assert payload["joinPolicy"]["interpretation"].startswith("beneficial is")
    assert "not a measured UTEX 2973 phenotype" in (
        payload["source"]["crossStrainAssumption"]
    )


def test_workbook_identity_rejects_changed_bytes(tmp_path: Path) -> None:
    """A same-sized but modified workbook cannot pass the source pin."""
    changed = tmp_path / "changed.xlsx"
    source = (ROOT / essentiality.WORKBOOK_PATH).read_bytes()
    changed.write_bytes(bytes([source[0] ^ 1]) + source[1:])
    with pytest.raises(essentiality.EssentialityDataError, match="SHA-256"):
        essentiality.verify_workbook(changed)


def test_workbook_parser_rejects_missing_column_and_unknown_status(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Column drift and new status values fail instead of being coerced."""
    monkeypatch.setattr(essentiality, "verify_workbook", lambda _path: None)
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = essentiality.WORKSHEET
    sheet.append(["PG_ID", "UTEX 2973 NCBI", "PCC 7942 NCBI"])
    path = tmp_path / "missing-column.xlsx"
    workbook.save(path)
    with pytest.raises(essentiality.EssentialityDataError, match="lacks columns"):
        essentiality.read_workbook_rows(path)

    sheet.cell(row=1, column=4, value="PCC 7942 essentiality")
    sheet.append([1, "M744_RS00005", "SYNPCC7942_RS02980", "new-status"])
    workbook.save(path)
    with pytest.raises(essentiality.EssentialityDataError, match="unsupported"):
        essentiality.read_workbook_rows(path)


def test_crosswalk_and_gene_schema_drift_fail_closed(tmp_path: Path) -> None:
    """The exact relationship contract and plotted-locus uniqueness are enforced."""
    crosswalk = tmp_path / "crosswalk.tsv"
    crosswalk.write_text(
        "subject_locus_tag\trelationship\tobject_namespace\tobject_id\t"
        "mapping_ambiguity\tmapping_method\n"
        "M744_RS00005\tpcc7942_ortholog\tPCC7942_RefSeq_locus_tag\t"
        "SYNPCC7942_RS02980\t\tprotein-name guess\n",
        encoding="utf-8",
    )
    with pytest.raises(essentiality.EssentialityDataError, match="not an exact"):
        essentiality.read_crosswalk(crosswalk)

    genes = tmp_path / "genes.json"
    genes.write_text('[{"id":"x"},{"id":"x"}]', encoding="utf-8")
    with pytest.raises(essentiality.EssentialityDataError, match="duplicate"):
        essentiality.read_gene_loci(genes)


@pytest.mark.parametrize(
    ("rows", "links", "reason"),
    [
        ([], [link()], "source_unmatched"),
        ([source_row(), source_row(pg_id=2)], [link()], "source_multivalued"),
        ([source_row(pcc=None)], [link()], "source_pcc_missing"),
        ([source_row()], [], "crosswalk_unmatched"),
        ([source_row()], [link(), link("SYNPCC7942_RS00010")], "crosswalk_multivalued"),
        ([source_row()], [link(ambiguity="shared-protein-many-to-many")], "crosswalk_ambiguous"),
        ([source_row()], [link("SYNPCC7942_RS00010")], "crosswalk_conflict"),
    ],
)
def test_mapping_edges_fail_closed_as_explicit_unknown(
    rows: list[dict], links: list[dict[str, str]], reason: str
) -> None:
    """Every failed admission path remains unknown with no leaked source join."""
    by_locus = essentiality.join_by_locus(
        ["M744_RS00005"], rows, {"M744_RS00005": links}
    )
    assert by_locus == {
        "M744_RS00005": {
            "status": "unknown",
            "pccLocusTag": None,
            "pangenomeId": None,
            "mappingStatus": (
                "unmatched"
                if reason in {
                    "source_unmatched", "source_pcc_missing", "crosswalk_unmatched"
                }
                else "conflicting"
                if reason == "crosswalk_conflict"
                else "ambiguous"
            ),
            "mappingReason": reason,
        }
    }


@pytest.mark.parametrize("status", essentiality.SOURCE_STATUSES)
def test_admitted_statuses_are_preserved_without_reclassification(status: str) -> None:
    """All six source states, especially beneficial and missing, pass unchanged."""
    by_locus = essentiality.join_by_locus(
        ["M744_RS00005"],
        [source_row(status=status)],
        {"M744_RS00005": [link()]},
    )
    assert by_locus["M744_RS00005"] == {
        "status": status,
        "pccLocusTag": "SYNPCC7942_RS02980",
        "pangenomeId": 1,
        "mappingStatus": "accepted",
        "mappingReason": "exact_source_crosswalk_agreement",
    }


def test_schema_rejects_unknown_imputation_and_count_drift() -> None:
    """Unknown joins cannot carry identifiers or silently become non-essential."""
    payload = load_payload()
    loci = essentiality.read_gene_loci(ROOT / essentiality.GENES_PATH)
    essentiality.validate_payload(payload, loci)

    leaked = copy.deepcopy(payload)
    unknown = next(row for row in leaked["byLocus"].values() if row["status"] == "unknown")
    unknown["pccLocusTag"] = "SYNPCC7942_RS00005"
    with pytest.raises(essentiality.EssentialityDataError, match="unadmitted join"):
        essentiality.validate_payload(leaked, loci)

    imputed = copy.deepcopy(payload)
    unknown = next(row for row in imputed["byLocus"].values() if row["status"] == "unknown")
    unknown["status"] = "non-essential"
    unknown["mappingStatus"] = "accepted"
    unknown["mappingReason"] = "exact_source_crosswalk_agreement"
    with pytest.raises(essentiality.EssentialityDataError):
        essentiality.validate_payload(imputed, loci)

    wrong_count = copy.deepcopy(payload)
    wrong_count["counts"]["byStatus"]["essential"] += 1
    with pytest.raises(essentiality.EssentialityDataError, match="byStatus"):
        essentiality.validate_payload(wrong_count, loci)


def test_manifest_records_licence_assay_and_redistribution_boundaries() -> None:
    """The generated static artifact carries the required scientific caveats."""
    payload = load_payload()
    provenance = payload["source"]
    assert provenance["sourceStudy"]["doi"] == "10.1128/mbio.00862-22"
    assert "CC BY 4.0" in provenance["sourceStudy"]["attribution"]
    assert provenance["essentialityCalls"]["doi"] == "10.1073/pnas.1519220112"
    assert "30 C" in provenance["essentialityCalls"]["assayContext"]
    assert "BG-11" in provenance["essentialityCalls"]["assayContext"]
    assert "does not claim to reproduce" in (
        provenance["essentialityCalls"]["representation"]
    )
