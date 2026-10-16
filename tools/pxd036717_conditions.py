"""Build non-release PXD036717 condition records without merging bait samples.

The reviewed source metadata describes cultivation separately from labeling,
retains unknown harvest/induction timing and the archive replicate discrepancy.
These records do not admit measurements or validate protein identifications.
"""

from __future__ import annotations

import argparse
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from condition_record import validate_record  # noqa: E402
from pxd036717_enrichment import BAITS, REPLICATES  # noqa: E402

METADATA = ROOT / "data/expression/evidence/pxd036717-conditions.json"


def build_records(metadata: dict[str, Any]) -> dict[str, Any]:
    """Expand reviewed metadata into twelve comparisons and four optional means.

    Replicate count is the number contributing to this record, not an assertion
    that A/A indexing establishes a paired experimental design. Study-level
    source statements and their disagreement are preserved in every record.
    """
    if (metadata.get("schemaVersion") != 1
            or metadata.get("accession") != "PXD036717"
            or metadata.get("baits") != list(BAITS)):
        raise ValueError("PXD036717 metadata version, accession or baits changed")
    base = metadata["record"]
    validate_record(base, "PXD036717 source conditions")
    if (base["studyId"] != "PXD036717" or base["dataType"] != "proteomics"
            or base["platform"] != "LC-MS/MS" or base["basis"] != "transferred"
            or base["group"] != "engineered"):
        raise ValueError("PXD036717 evidence must retain its source type and basis")
    if (base["replicates"].get("status") != "conflicting"
            or base["replicates"].get("count") != 3
            or not base["replicates"].get("sourceStatements")):
        raise ValueError("PXD036717 study replicate discrepancy must be retained")

    layers = []
    for bait in BAITS:
        for replicate in (*REPLICATES, None):
            record = deepcopy(base)
            mean = replicate is None
            members = list(REPLICATES) if mean else [replicate]
            suffix = "mean" if mean else replicate.lower()
            label = "complete-case mean of A/B/C" if mean else f"replicate {replicate}"
            record["conditionSet"] = f"{bait}-APEX2 / CscB-SPS control; {label}"
            record["strain"] = f"PCC 7942 CscB-SPS, {bait}-APEX2 versus untagged control"
            record["samples"] = "; ".join(
                f"{bait}-APEX2 {member} / control {member}" for member in members
            )
            record["replicates"]["count"] = len(members)
            record["replicates"]["studyCount"] = 3
            record["replicates"]["text"] = (
                f"{len(members)} source comparison(s) in this record. "
                + base["replicates"]["text"]
            )
            validate_record(record, f"PXD036717 {bait} {suffix}")
            layers.append({
                "id": f"PXD036717_{bait.lower()}_{suffix}",
                "bait": bait, "replicates": members,
                "kind": "complete_case_mean" if mean else "replicate",
                "optional": mean, "record": record,
            })
    return {
        "schemaVersion": 1, "accession": "PXD036717", "releaseEligible": False,
        "quantity": "Reconstructed log2 APEX2/control LFQ enrichment",
        "aggregation": "Mean requires all three valid log2 ratios within one bait; no cross-bait pooling",
        "metadata": deepcopy(metadata), "layers": layers,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--metadata", type=Path, default=METADATA)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(argv)
    if (args.metadata.resolve() == args.output.resolve()
            or (args.output.exists() and args.output.samefile(args.metadata))):
        parser.error("output must not overwrite the source metadata")
    raw = args.metadata.read_bytes()
    result = build_records(json.loads(raw))
    result["metadataSource"] = {
        "file": args.metadata.name, "sha256": hashlib.sha256(raw).hexdigest(),
        "bytes": len(raw),
    }
    text = json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(text, encoding="utf-8")
    print("Wrote 12 replicate and 4 optional mean condition records; no browser admission")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
