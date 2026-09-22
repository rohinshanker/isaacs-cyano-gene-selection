"""Publish admitted tested-allele evidence for the static candidate view."""

import argparse
import csv
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data/manifest/protein-evidence-v1.json"
IDENTITY = ROOT / "data/protein-evidence/releases/GCF_000817325.1-RS_2026_05_13-protein-evidence-v1/protein-identity-v1.tsv"
OUTPUT = ROOT / "site/data/candidate_evidence.json"


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
        "borrowedEssentiality": {
            "organism": "Synechococcus elongatus PCC 7942",
            "doi": "10.1073/pnas.1519220112",
            "status": "unavailable",
            "reason": "Rubin 2015 Dataset S3 was not acquired as verifiable workbook bytes; no locus-level PCC 7942 essentiality claim has been admitted or transferred to UTEX 2973.",
        },
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
    print(f"{args.action}: three admitted UTEX tested alleles")


if __name__ == "__main__":
    main()
