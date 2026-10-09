#!/usr/bin/env python3
"""Build the optional UTEX 2973 tRNA viewer payload from pinned local inputs.

The builder consumes the checked-in tRNAscan-SE comparison and the already
pinned genome/GFF. It never runs a predictor and never joins a tRNA locus to a
CDS. Genomic sequences are emitted in transcription orientation.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

from trna_validate import load_genome, reverse_complement

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_COMPARISON = ROOT / "data/trna/independent_run/comparison.json"
DEFAULT_FASTA = ROOT / "data/raw/GCF_000817325.1_ASM81732v1_genomic.fna.gz"
DEFAULT_OUTPUT = ROOT / "site/data/trna-loci-v1.json"
ASSEMBLY = "GCF_000817325.1"
ANNOTATION_RELEASE = "GCF_000817325.1-RS_2026_05_13"
RUN_ID = "trnascan-se-2.0.12-bacterial-utex2973"
RUN_OUTPUT = ROOT / "data/trna/independent_run/trnascan.out"
COMPARISON_URL = (
    "https://github.com/rohinshanker/isaacs-cyano-gene-selection/"
    "blob/main/data/trna/independent_run/comparison.json"
)
REFSEQ_URL = (
    "https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/817/325/"
    "GCF_000817325.1_ASM81732v1/"
    "GCF_000817325.1_ASM81732v1_genomic.gff.gz"
)


class TrnaPayloadError(RuntimeError):
    """Raised when pinned input data cannot produce the published payload."""


def sha256(path: Path) -> str:
    """Return a lowercase SHA-256 digest for ``path``."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def locus_sequence(genome: dict[str, str], row: dict[str, Any]) -> str:
    """Extract one inclusive locus in its transcription orientation."""
    try:
        sequence = genome[row["seqid"]][row["start"] - 1 : row["end"]]
    except KeyError as error:
        raise TrnaPayloadError(f"unknown replicon {row.get('seqid')!r}") from error
    expected = row["end"] - row["start"] + 1
    if len(sequence) != expected:
        raise TrnaPayloadError(
            f"{row.get('locus_tag', 'scan-only locus')} extends beyond its replicon"
        )
    return reverse_complement(sequence) if row["strand"] == "-" else sequence


def build_payload(
    comparison_path: Path, fasta_path: Path, run_output_path: Path
) -> dict[str, Any]:
    """Build and validate the compact browser payload."""
    comparison = json.loads(comparison_path.read_text(encoding="utf-8"))
    counts = comparison.get("counts", {})
    if counts != {
        "concordant": 44,
        "discordant": 0,
        "refseq_total": 44,
        "tRNAscan_only_calls": 1,
        "unresolved": 0,
    }:
        raise TrnaPayloadError(f"unexpected comparison counts: {counts!r}")
    genome = load_genome(fasta_path)
    loci: list[dict[str, Any]] = []
    for row in comparison["loci"]:
        if row["status"] != "concordant":
            raise TrnaPayloadError(f"cannot publish non-concordant locus {row['locus_tag']}")
        loci.append(
            {
                "id": row["locus_tag"],
                "kind": "refseq",
                "locusTag": row["locus_tag"],
                "replicon": row["seqid"],
                "start": row["start"],
                "end": row["end"],
                "strand": row["strand"],
                "lengthNt": row["end"] - row["start"] + 1,
                "refseqProduct": f"tRNA-{row['refseq_isotype']}",
                "refseqIsotype": row["refseq_isotype"],
                "refseqAnticodon": row["refseq_anticodon"],
                "modelEffectiveAnticodon": row["refseq_effective_anticodon"],
                "scanIsotype": row["scan_isotype"],
                "scanAnticodon": row["scan_anticodon"],
                "annotationScanStatus": "concordant",
                "pseudo": False,
                "sequence": locus_sequence(genome, row),
            }
        )
    for row in comparison["tRNAscan_only"]:
        stable_id = (
            f"{RUN_ID}:{row['seqid']}:{row['start']}-{row['end']}:{row['strand']}"
        )
        loci.append(
            {
                "id": stable_id,
                "kind": "scan-only-candidate",
                "locusTag": None,
                "replicon": row["seqid"],
                "start": row["start"],
                "end": row["end"],
                "strand": row["strand"],
                "lengthNt": row["end"] - row["start"] + 1,
                "refseqProduct": None,
                "refseqIsotype": None,
                "refseqAnticodon": None,
                "modelEffectiveAnticodon": None,
                "scanIsotype": row["scan_isotype"],
                "scanAnticodon": row["scan_anticodon"],
                "annotationScanStatus": "scan-only predicted pseudogene candidate",
                "pseudo": bool(row["scan_pseudo"]),
                "sequence": locus_sequence(genome, row),
            }
        )
    loci.sort(key=lambda locus: (locus["replicon"], locus["start"], locus["id"]))
    if len(loci) != 45 or sum(item["kind"] == "refseq" for item in loci) != 44:
        raise TrnaPayloadError("payload must contain 44 RefSeq loci and one scan-only candidate")
    return {
        "schemaVersion": 1,
        "organismId": "utex2973",
        "assembly": ASSEMBLY,
        "annotationRelease": ANNOTATION_RELEASE,
        "coordinateSystem": "1-based inclusive",
        "sequenceOrientation": "transcription",
        "counts": {"annotated": 44, "predictedCandidates": 1, "totalRecords": 45},
        "run": {
            "id": RUN_ID,
            "tool": "tRNAscan-SE",
            "version": "2.0.12",
            "mode": "bacterial (-B)",
            "comparisonSha256": sha256(comparison_path),
            "runOutputSha256": sha256(run_output_path),
        },
        "sources": {
            "refseq": {"label": "Pinned RefSeq GFF", "href": REFSEQ_URL},
            "comparison": {"label": "Pinned local comparison", "href": COMPARISON_URL},
        },
        "loci": loci,
    }


def serialize(payload: dict[str, Any]) -> str:
    """Return deterministic published JSON bytes."""
    return json.dumps(payload, indent=2, sort_keys=True) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--comparison", type=Path, default=DEFAULT_COMPARISON)
    parser.add_argument("--fasta", type=Path, default=DEFAULT_FASTA)
    parser.add_argument("--run-output", type=Path, default=RUN_OUTPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args(argv)
    payload = build_payload(args.comparison, args.fasta, args.run_output)
    args.output.write_text(serialize(payload), encoding="utf-8")
    print(f"wrote {args.output} with {len(payload['loci'])} loci")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
