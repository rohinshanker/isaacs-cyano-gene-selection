"""Build the pinned RefSeq gene-span and plotted-CDS length inventory."""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GFF = ROOT / "data/raw/GCF_000817325.1_ASM81732v1_genomic.gff.gz"
GENES = ROOT / "site/data/genes.json"
PROTEINS = ROOT / (
    "data/protein-evidence/releases/"
    "GCF_000817325.1-RS_2026_05_13-protein-evidence-v1/"
    "protein-identity-v1.tsv"
)
OUTPUT = ROOT / "site/data/length_cohorts.json"
RELEASE = "GCF_000817325.1-RS_2026_05_13"
GFF_SHA256 = "7f606a08892b061667a1988cc05dee889a82f9407066dcf81010ec2e25bb215f"


def read_loci(gff_path: Path) -> dict[str, dict]:
    """Read each RefSeq gene or pseudogene feature exactly once."""
    loci = {}
    with gzip.open(gff_path, "rt", encoding="utf-8") as stream:
        for line in stream:
            if line.startswith("#"):
                continue
            fields = line.rstrip("\n").split("\t")
            if fields[2] not in {"gene", "pseudogene"}:
                continue
            attributes = dict(
                item.split("=", 1) for item in fields[8].split(";") if "=" in item
            )
            locus_tag = attributes.get("locus_tag")
            if not locus_tag or locus_tag in loci:
                raise ValueError(f"missing or repeated locus tag: {locus_tag}")
            start, end = int(fields[3]), int(fields[4])
            loci[locus_tag] = {
                "id": locus_tag,
                "biotype": (
                    "pseudogene"
                    if fields[2] == "pseudogene"
                    else attributes["gene_biotype"]
                ),
                "geneSpanNt": end - start + 1,
                "cdsLengthNt": None,
                "refseqProteinRecord": False,
            }
    return loci


def build(
    gff_path: Path = GFF,
    genes_path: Path = GENES,
    protein_path: Path = PROTEINS,
) -> dict:
    """Reconcile release features, screened CDSs, and exact protein identities."""
    digest = hashlib.sha256(gff_path.read_bytes()).hexdigest()
    if digest != GFF_SHA256:
        raise ValueError(f"unexpected RefSeq GFF digest: {digest}")
    loci = read_loci(gff_path)
    genes = json.loads(genes_path.read_text(encoding="utf-8"))
    with protein_path.open(newline="", encoding="utf-8") as stream:
        proteins = {row["locus_tag"]: row for row in csv.DictReader(stream, delimiter="\t")}
    if len(proteins) != len(genes):
        raise ValueError("protein identity table has duplicate or missing locus rows")
    for gene in genes:
        locus = loci.get(gene["id"])
        if locus is None or locus["biotype"] != "protein_coding":
            raise ValueError(f"plotted CDS lacks a protein-coding gene: {gene['id']}")
        evidence = proteins.get(gene["id"])
        if not evidence or evidence["refseq_protein_record"] != "present":
            raise ValueError(f"plotted CDS lacks admitted protein identity: {gene['id']}")
        length = gene["lengthNt"]
        if not isinstance(length, int) or length <= 0:
            raise ValueError(f"invalid CDS length: {gene['id']}")
        locus["cdsLengthNt"] = length
        locus["refseqProteinRecord"] = True
    if sum(locus["biotype"] == "protein_coding" for locus in loci.values()) != len(genes):
        raise ValueError("protein-coding gene denominator differs from plotted CDSs")
    records = sorted(loci.values(), key=lambda row: row["id"])
    return {
        "schemaVersion": 1,
        "annotationRelease": RELEASE,
        "sourceGffSha256": digest,
        "lengthDefinition": {
            "geneSpanNt": "inclusive RefSeq gene or pseudogene feature coordinates",
            "cdsLengthNt": "joined plotted CDS nucleotides, including terminal stop",
        },
        "qc": {"shortCdsBelowNt": 75},
        "counts": {
            "annotatedLoci": len(records),
            "proteinCodingGenes": sum(row["biotype"] == "protein_coding" for row in records),
            "screenedCds": sum(row["cdsLengthNt"] is not None for row in records),
            "refseqProteinRecordLoci": sum(row["refseqProteinRecord"] for row in records),
            "pseudogenes": sum(row["biotype"] == "pseudogene" for row in records),
            "noncodingRnaGenes": sum(
                row["biotype"] not in {"protein_coding", "pseudogene"} for row in records
            ),
        },
        "directDetection": {
            "available": False,
            "reason": (
                "PASS00399 supplies a search FASTA and unfiltered hits, but no "
                "reproducible accepted per-locus protein list under the study criteria."
            ),
        },
        "records": records,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["build", "check"])
    arguments = parser.parse_args()
    expected = json.dumps(build(), indent=2, sort_keys=True) + "\n"
    if arguments.command == "build":
        OUTPUT.write_text(expected, encoding="utf-8")
    elif not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != expected:
        raise SystemExit("length cohort artifact is missing or out of date")


if __name__ == "__main__":
    main()
