"""Publish tested UTEX alleles and separately sourced PCC candidate evidence."""

import argparse
import csv
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data/manifest/protein-evidence-v1.json"
IDENTITY = ROOT / "data/protein-evidence/releases/GCF_000817325.1-RS_2026_05_13-protein-evidence-v1/protein-identity-v1.tsv"
OUTPUT = ROOT / "site/data/candidate_evidence.json"
PCC_ESSENTIALITY = ROOT / "site/data/pcc7942-essentiality-v1.json"

UNKNOWN_REASONS = {
    "source_unmatched": "No current UTEX locus appears in the source workbook.",
    "source_multivalued": "The source workbook maps this UTEX locus more than once.",
    "source_pcc_missing": "The source workbook has no PCC locus for this UTEX locus.",
    "crosswalk_unmatched": "No exact shared-protein PCC crosswalk exists for this UTEX locus.",
    "crosswalk_multivalued": "The shared-protein PCC crosswalk points to multiple loci.",
    "crosswalk_ambiguous": "The shared-protein PCC crosswalk is marked ambiguous.",
    "crosswalk_conflict": "The source PCC locus conflicts with the pinned RefSeq crosswalk.",
}


def borrowed_essentiality(annotation_release: str) -> dict:
    """Retain PCC calls only as labelled cross-strain candidate context."""
    data = json.loads(PCC_ESSENTIALITY.read_text())
    provenance = data["source"]
    if data["schemaVersion"] != 1 or provenance["annotationRelease"] != annotation_release:
        raise ValueError("PCC essentiality does not match the annotation release")
    by_locus = {}
    for locus, row in data["byLocus"].items():
        reason = row["mappingReason"]
        if row["status"] == "unknown" and reason not in UNKNOWN_REASONS:
            raise ValueError(f"Unknown PCC mapping reason for {locus}: {reason}")
        by_locus[locus] = {
            "status": row["status"],
            "pccLocusTag": row["pccLocusTag"],
            "pangenomeId": row["pangenomeId"],
            "mappingStatus": row["mappingStatus"],
            "mappingReasonCode": reason,
            "mappingReason": UNKNOWN_REASONS[reason] if row["status"] == "unknown" else None,
        }
    if len(by_locus) != data["counts"]["plottedUtex2973Loci"]:
        raise ValueError("PCC essentiality does not cover the plotted CDS set")
    return {
        "status": "available",
        "source": {
            "datasetId": data["datasetId"],
            "adomakoDoi": provenance["sourceStudy"]["doi"],
            "rubinDoi": provenance["essentialityCalls"]["doi"],
            "growthDoi": "10.1128/mBio.02327-17",
            "rubinCondition": provenance["essentialityCalls"]["assayContext"],
            "license": "CC BY 4.0 (Adomako et al. 2022 Data Set S1)",
            "workbookSha256": provenance["sourceStudy"]["workbook"]["sha256"],
            "assumption": provenance["crossStrainAssumption"],
        },
        "summary": data["counts"],
        "byLocus": dict(sorted(by_locus.items())),
    }


def build() -> dict:
    """Join the three admitted UTEX alleles to exact RefSeq protein identities."""
    manifest = json.loads(MANIFEST.read_text())
    sources = [source for source in manifest["sources"] if source["id"] == "ungerer-2018"]
    if len(sources) != 1:
        raise ValueError("Expected one Ungerer source in protein-evidence manifest")
    source = sources[0]
    with IDENTITY.open(newline="") as handle:
        identities = {row["locus_tag"]: row for row in csv.DictReader(handle, delimiter="\t")}
    alleles = {}
    for variant in source["testedVariants"]:
        locus = variant["currentLocusTag"]
        row = identities.get(locus)
        if not row or row["protein_id"] != variant["proteinId"]:
            raise ValueError(f"Tested allele {locus} lacks the declared exact protein join")
        if row["tested_variant_evidence"] != variant["evidenceId"]:
            raise ValueError(f"Tested allele {locus} disagrees with the identity release")
        alleles[locus] = {
            "evidenceId": variant["evidenceId"],
            "oldLocusTag": variant["oldLocusTag"],
            "proteinId": variant["proteinId"],
            "gene": variant["gene"],
            "claim": variant["claim"],
        }
    if len(alleles) != 3:
        raise ValueError("Expected three distinct admitted UTEX tested alleles")
    return {
        "schemaVersion": 1,
        "annotationRelease": manifest["annotationRelease"],
        "manifestSha256": hashlib.sha256(MANIFEST.read_bytes()).hexdigest(),
        "testedSource": {
            "id": source["id"],
            "doi": source["doi"],
            "condition": source["condition"],
            "scope": source["ambiguity"],
        },
        "testedAlleles": dict(sorted(alleles.items())),
        "borrowedEssentiality": borrowed_essentiality(manifest["annotationRelease"]),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("build", "check"))
    args = parser.parse_args()
    expected = json.dumps(build(), ensure_ascii=False, separators=(",", ":")) + "\n"
    if args.action == "build":
        OUTPUT.write_text(expected)
    elif not OUTPUT.exists() or OUTPUT.read_text() != expected:
        raise SystemExit(f"{OUTPUT} differs from admitted source evidence")
    print(f"{args.action}: three tested UTEX alleles and labelled PCC essentiality")


if __name__ == "__main__":
    main()
