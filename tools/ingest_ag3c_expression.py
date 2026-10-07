#!/usr/bin/env python3
"""Ingest the AG3C series as paired E. coli transcript and protein layers.

Source: Caglar et al., *Sci Rep* 2017;7:45303 (PMID 28417974) with Houser et al.,
*PLoS Comput Biol* 2015 (PMID 26275208). GEO GSE94117 and GSE67402, PRIDE
PXD005721 and PXD002140. Strain *E. coli* B str. REL606.

**Why this series.** It is the only *E. coli* data found by package
P-ECOLI-OMICS whose transcript and protein measurements come from aliquots of
the same flasks. Caglar's Methods state it: *"Samples for each type of cell
composition measurement were taken from the same batch of flasks, except for
those used for flux analysis"*, and *"Each of the three biological replicates
was performed on a separate day."* Every other pairing available is cross-study.

**Layers.** One per condition set that carries at least three cultures with both
layers, using the authors' own `uniqueCondition` identifier plus harvest time.
That grouping reproduces the published design exactly, 25 conditions at three
complete pairs and two at four, and four other candidate groupings agree on the
same 27 conditions at three or more. A layer's value is the mean across its
cultures, and its sample text names them.

**Identifiers.** The transcript matrix is keyed by the 2009 `ECB_` locus tags
and the protein matrix by the retired `YP_` accessions of the same annotation.
Both reach this viewer's b-numbers through
`data/annotation/rel606-mg1655-crosswalk-v1.tsv`, the protein side via the
pinned accession table beside this tool. See
`docs/validation/rel606-crosswalk.md` for how that crosswalk was built and
verified.

**The protein floor.** 46.1% of the protein matrix sits at one identical value,
0.968021139095309, and 2,189 of its rows hold it in at least half their
cultures. The paper does not define it. A single constant filling nearly half a
matrix is a non-detection floor, not a measurement, and carrying it as an
abundance would place half the genes on one value. It is carried as absent, and
every layer says so.

Usage::

    tools/ingest_ag3c_expression.py            # write the layers
    tools/ingest_ag3c_expression.py --report   # summarise, write nothing
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from collections import OrderedDict, defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
INTERIM = ROOT / "data/interim/expression-ecoli"
SAMPLES = INTERIM / "srep45303-s2.csv"
MRNA = INTERIM / "srep45303-s3.csv"
PROTEIN = INTERIM / "srep45303-s4.csv"
OUT_DIR = ROOT / "data/expression/organisms/ecoli-k12-mg1655"
ACCESSIONS = OUT_DIR / "ag3c_protein_accession_to_locus.tsv"
CROSSWALK = ROOT / "data/annotation/rel606-mg1655-crosswalk-v1.tsv"
GENES = ROOT / "site/data/organisms/ecoli-k12-mg1655/genes.json"

#: Pinned members of the article's Source Data archive, retrieved 2026-10-07 and
#: checksummed at intake of package P-ECOLI-OMICS.
PINNED = {
    SAMPLES.name: "1486290bf6a340ae64ee20c915435c0a00ff5eede489de1f56b62733b66f8940",
    MRNA.name: "df3e28237ea8e03c68ec93c577be1b1032ccc2d1f60372f45a72a6107de94d95",
    PROTEIN.name: "a391afb5784edebf2e44c52d622b868eaf7096258658f7473640090fb1429b11",
}

#: The non-detection floor of the protein matrix. Carried as absent, never as a
#: measured abundance; see the module docstring.
PROTEIN_FLOOR = 0.968021139095309
FLOOR_TOLERANCE = 1e-9

MIN_COMPLETE_CULTURES = 3
ARCHIVE_URL = "https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE94117"
WHERE = "Caglar 2017 Supplementary Dataset 1, srep45303-s2.csv, retrieved 2026-10-07"

CITATION = {
    "text": (
        "Caglar MU, Houser JR, Barnhart CS, et al. The E. coli molecular "
        "phenotype under different growth conditions. Sci Rep 2017;7:45303."
    ),
    "url": "https://doi.org/10.1038/srep45303",
    "pmid": "28417974",
}

PAIRING_QUOTE = (
    "Samples for each type of cell composition measurement were taken from the "
    "same batch of flasks, except for those used for flux analysis"
)


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_matrix(path: Path) -> tuple[list[str], dict[str, list[str]]]:
    """Return the culture columns and one row of strings per identifier."""
    with path.open(encoding="utf-8", errors="replace", newline="") as handle:
        rows = list(csv.reader(handle))
    header = rows[0][1:]
    return header, {row[0]: row[1:] for row in rows[1:] if row and row[0]}


def read_samples(path: Path = SAMPLES) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", errors="replace", newline="") as handle:
        return list(csv.DictReader(handle))


def load_crosswalk(path: Path = CROSSWALK) -> dict[str, str]:
    """2009 REL606 locus tag to this viewer's gene id, one-to-one only."""
    with path.open(encoding="utf-8", newline="") as handle:
        return {
            row["object_id"]: row["subject_locus_tag"]
            for row in csv.DictReader(handle, delimiter="\t")
            if row["relationship"] == "rel606_old_locus_tag"
            and row["subject_locus_tag"]
            and not row["mapping_ambiguity"]
        }


def load_accessions(path: Path = ACCESSIONS) -> dict[str, str]:
    """Retired protein accession to the 2009 locus tag it belonged to."""
    with path.open(encoding="utf-8", newline="") as handle:
        return {
            row["protein_accession"]: row["rel606_legacy_locus_tag"]
            for row in csv.DictReader(handle, delimiter="\t")
        }


def plotted_genes(path: Path = GENES) -> set[str]:
    """The gene ids the viewer actually plots.

    The crosswalk reaches every locus in the annotation, including the handful
    the build excludes from plotting. A value for an excluded gene would never
    be drawn but would still be counted in the layer's coverage, so the two
    would disagree. Filtering here keeps the count honest.
    """
    document = json.loads(path.read_text(encoding="utf-8"))
    rows = document["genes"] if isinstance(document, dict) else document
    return {gene["id"] for gene in rows}


def condition_key(row: dict[str, str]) -> tuple[str, str]:
    """The authors' own condition identifier, kept apart by harvest time."""
    return (row["uniqueCondition"], row["growthTime_hr"])


def condition_label(rows: list[dict[str, str]]) -> str:
    row = rows[0]
    carbon = (row.get("carbonSource") or "").strip()
    parts = [carbon or "unstated carbon source"]
    for field, name in (("Mg_mM", "Mg"), ("Na_mM", "Na")):
        value = (row.get(field) or "").strip()
        if value and value not in ("NA", ""):
            parts.append(f"{name} {value} mM")
    phase = (row.get("growthPhase") or "").strip()
    if phase and phase != "NA":
        parts.append(phase)
    parts.append(f"{row['growthTime_hr']} h")
    return ", ".join(parts)


def slug(text: str) -> str:
    return re.sub(r"_+", "_", re.sub(r"[^0-9A-Za-z]+", "_", text)).strip("_")


def camel(text: str) -> str:
    return "".join(p[:1].upper() + p[1:] for p in re.split(r"[^0-9A-Za-z]+", text) if p)


def _float(text: str) -> float | None:
    try:
        return float(text)
    except (TypeError, ValueError):
        return None


def layer_values(
    matrix: dict[str, list[str]],
    columns: list[str],
    cultures: list[str],
    to_gene: dict[str, str],
    *,
    drop_floor: bool,
) -> dict[str, float]:
    """Mean across a condition's cultures, keyed by this viewer's gene id."""
    index = {name: position for position, name in enumerate(columns)}
    wanted = [index[c] for c in cultures if c in index]
    totals: dict[str, float] = defaultdict(float)
    counts: dict[str, int] = defaultdict(int)
    for identifier, row in matrix.items():
        gene = to_gene.get(identifier)
        if gene is None:
            continue
        for position in wanted:
            value = _float(row[position]) if position < len(row) else None
            if value is None:
                continue
            if drop_floor and abs(value - PROTEIN_FLOOR) < FLOOR_TOLERANCE:
                continue
            totals[gene] += value
            counts[gene] += 1
    return {gene: totals[gene] / counts[gene] for gene in totals if counts[gene]}


def conditions_for(rows: list[dict[str, str]]) -> dict[str, Any]:
    """The seven condition axes. Only what the sample table records."""
    row = rows[0]
    quote = "; ".join(
        f"{k}={row.get(k)}" for k in ("carbonSource", "Mg_mM", "Na_mM", "growthPhase",
                                      "growthTime_hr", "uniqueCondition")
    )
    phase_label = {"exponential": "exponential", "stationary": "stationary"}.get(
        (row.get("growthPhase") or "").strip().lower()
    )
    unreported = lambda what: {  # noqa: E731
        "status": "not reported",
        "text": f"the published sample table records no {what}",
        "quote": "",
        "where": "",
    }
    return {
        # The paper's cultures are at 37 C, but the sample table does not carry
        # it per culture and this tool reads only the table, so it is not
        # asserted here.
        "temperature": {**unreported("temperature"), "lo": None, "hi": None,
                        "unit": "°C"},
        "lightIntensity": {
            **unreported("irradiance, and light is not a parameter of this experiment"),
            "lo": None, "hi": None,
            "unit": "µmol photons m⁻² s⁻¹",
        },
        "lightRegime": {
            **unreported("light regime, and light is not a parameter of this experiment"),
            "kind": None, "photoperiod": None, "spectrumClass": None, "entrained": False,
        },
        "co2": {**unreported("CO2 concentration"), "lo": None, "hi": None, "unit": "%"},
        "medium": {
            "status": "reported",
            "base": (row.get("carbonSource") or "").strip() or None,
            "modified": (row.get("Mg_mM") or "").strip() not in ("", "NA")
                        or (row.get("Na_mM") or "").strip() not in ("", "NA"),
            "conditioned": False,
            "nitrogenAltered": False,
            "text": condition_label(rows),
            "quote": quote,
            "where": WHERE,
        },
        "format": {
            "status": "reported",
            "value": "flask",
            "text": "flask cultures; aliquots of one batch of flasks serve both layers",
            "quote": PAIRING_QUOTE,
            "where": "Caglar 2017 Methods, Cell Growth, PMC5394689",
        },
        "phase": {
            "status": "reported" if phase_label else "not reported",
            "label": phase_label,
            "od": None,
            "odNm": None,
            "text": (row.get("growthPhase") or "").strip()
                    or "the sample table records no growth phase",
            "quote": quote if phase_label else "",
            "where": WHERE if phase_label else "",
        },
    }


def build(report_only: bool, out_dir: Path) -> int:
    for path, expected in ((SAMPLES, PINNED[SAMPLES.name]),
                           (MRNA, PINNED[MRNA.name]),
                           (PROTEIN, PINNED[PROTEIN.name])):
        if not path.is_file():
            raise SystemExit(f"{path} is missing; see the module docstring")
        observed = sha256_of(path)
        if observed != expected:
            raise SystemExit(f"{path.name}: expected {expected}, got {observed}")

    samples = read_samples()
    mrna_columns, mrna = read_matrix(MRNA)
    protein_columns, protein = read_matrix(PROTEIN)
    crosswalk = load_crosswalk()
    accessions = load_accessions()
    plotted = plotted_genes()

    mrna_to_gene = {
        tag: crosswalk[tag] for tag in mrna
        if tag in crosswalk and crosswalk[tag] in plotted
    }
    protein_to_gene = {
        accession: crosswalk[accessions[accession]]
        for accession in protein
        if accession in accessions and accessions[accession] in crosswalk
        and crosswalk[accessions[accession]] in plotted
    }
    print(f"transcript rows reaching a gene: {len(mrna_to_gene)} of {len(mrna)}")
    print(f"protein rows reaching a gene   : {len(protein_to_gene)} of {len(protein)}")

    with_both = set(mrna_columns) & set(protein_columns)
    groups: "OrderedDict[tuple, list]" = OrderedDict()
    for row in samples:
        if row["dataSet"] in with_both:
            groups.setdefault(condition_key(row), []).append(row)
    complete = OrderedDict(
        (key, rows) for key, rows in groups.items()
        if len(rows) >= MIN_COMPLETE_CULTURES
    )
    print(f"condition sets with both layers: {len(groups)}")
    print(f"  of those with >= {MIN_COMPLETE_CULTURES} complete cultures: {len(complete)}")

    layers: list[dict[str, Any]] = []
    for rows in complete.values():
        cultures = sorted(r["dataSet"] for r in rows)
        label = condition_label(rows)
        for kind, matrix, columns, mapping, drop in (
            ("transcript", mrna, mrna_columns, mrna_to_gene, False),
            ("protein", protein, protein_columns, protein_to_gene, True),
        ):
            values = layer_values(matrix, columns, cultures, mapping, drop_floor=drop)
            layers.append({
                "kind": kind,
                "id": f"AG3C_{slug(label)}_{'RNA' if kind == 'transcript' else 'PROT'}",
                "metricKey": f"{'exprAg3c' if kind == 'transcript' else 'protAg3c'}{camel(slug(label))}",
                "label": (f"{'Transcript' if kind == 'transcript' else 'Protein'} "
                          f"{label} (REL606)"),
                "conditionSet": label,
                "cultures": cultures,
                "rows": rows,
                "values": values,
            })

    coverage = {len(l["values"]) for l in layers if l["kind"] == "transcript"}
    protein_coverage = sorted({len(l["values"]) for l in layers if l["kind"] == "protein"})
    print(f"layers: {len(layers)}  transcript {sum(1 for l in layers if l['kind']=='transcript')}"
          f"  protein {sum(1 for l in layers if l['kind']=='protein')}")
    print(f"transcript genes per layer: {sorted(coverage)}")
    print(f"protein genes per layer   : {protein_coverage[0]} to {protein_coverage[-1]}"
          f"  (the floor is carried as absent)")
    if report_only:
        return 0

    out_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = out_dir / "sources.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.is_file() else []
    manifest = [entry for entry in manifest if not entry["id"].startswith("AG3C_")]
    for layer in layers:
        table = out_dir / f"{layer['id']}.tsv"
        with table.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle, delimiter="\t", lineterminator="\n")
            writer.writerow(["locus_tag", "abundance", "source_gene_id"])
            for gene in sorted(layer["values"]):
                writer.writerow([gene, f"{layer['values'][gene]:.6f}", gene])
        manifest.append(manifest_entry(layer, table))
    manifest.sort(key=lambda entry: entry["id"])
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"wrote {len(layers)} AG3C layers; manifest now holds {len(manifest)}")
    return 0


def manifest_entry(layer: dict[str, Any], table: Path) -> dict[str, Any]:
    kind = layer["kind"]
    rows = layer["rows"]
    transcript = kind == "transcript"
    return {
        "record": {
            "studyId": "AG3C",
            "dataType": "transcriptomics" if transcript else "proteomics",
            "platform": "RNA-seq" if transcript else "LC-MS/MS",
            "strain": "REL606",
            "basis": "transferred",
            "conditionSet": layer["conditionSet"],
            "samples": (f"{len(layer['cultures'])} cultures: "
                        + ", ".join(layer["cultures"])
                        + "; aliquots of the same flasks serve both layers"),
            "archiveUrl": ARCHIVE_URL,
            "citation": CITATION,
            "replicates": {
                "count": len(layer["cultures"]),
                "text": (f"{len(layer['cultures'])} biological replicates, each a "
                         "separate culture performed on a separate day; the "
                         "transcript and protein values of one replicate come "
                         "from aliquots of that same flask"),
                "where": "Caglar 2017 Methods, Cell Growth, PMC5394689",
            },
            "treatments": [],
            "group": "standard" if len(rows) and (rows[0].get("Mg_mM") or "").strip() in ("", "NA") else "stress",
            "conditionTableRow": None,
            "conditions": conditions_for(rows),
        },
        "id": layer["id"],
        "file": table.name,
        "metricKey": layer["metricKey"],
        "label": layer["label"],
        "organism": "Escherichia coli B str. REL606",
        "isTargetOrganism": False,
        "assay": "RNA-seq" if transcript else "LC-MS/MS protein abundance",
        "units": (
            "transcript abundance as published in Supplementary Dataset 2, mean over the "
            "condition's cultures"
            if transcript else
            "protein abundance as published in Supplementary Dataset 3, mean over the "
            "condition's cultures, excluding the non-detection floor"
        ),
        "condition": layer["conditionSet"],
        "sha256": sha256_of(table),
        "licence": (
            "Article CC BY 4.0 (Scientific Reports); GEO/NCBI and PRIDE public "
            "repository terms over the deposits. Cited, not claimed."
        ),
        "caveat": (
            "Measured in Escherichia coli B str. REL606, not the K-12 MG1655 shown on "
            "this page, and placed here through the ortholog crosswalk documented in "
            "docs/validation/rel606-crosswalk.md. Its transcript and protein layers "
            "come from aliquots of the same flasks, so the two may be compared with "
            "each other; nothing else in this viewer shares cultures with them."
            + ("" if transcript else
               " 46.1% of the published protein matrix sits at one identical value, "
               "0.968021139095309, which the paper does not define. It is read as a "
               "non-detection floor and carried as absent rather than as an abundance.")
        ),
        "provenanceDoc": "docs/validation/rel606-crosswalk.md",
        "citationId": "caglar-2017-ag3c",
        "payload": "expression_layers.json",
        # Not signed: zero is not a midpoint here. The published values are on a
        # log scale, so a negative is an abundance below one unit and the ramp
        # stays one-sided.
        "signed": False,
        "logScale": True,
        "ingest": {
            "sourceFile": table.name.replace(".tsv", ""),
            "sourceSha256": PINNED[MRNA.name if transcript else PROTEIN.name],
            "sourceUrl": "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC5394689/supplementaryFiles",
            "columns": layer["cultures"],
            "normalization": "as-deposited",
            "mappedGenes": len(layer["values"]),
            "unmappedIdentifiers": 0,
            "mappingRoute": (
                "rel606_old_locus_tag in rel606-mg1655-crosswalk-v1.tsv"
                if transcript else
                "retired protein accession to 2009 locus tag, then "
                "rel606_old_locus_tag in rel606-mg1655-crosswalk-v1.tsv"
            ),
        },
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", type=Path, default=OUT_DIR)
    parser.add_argument("--report", action="store_true")
    args = parser.parse_args(argv)
    return build(args.report, args.out_dir)


if __name__ == "__main__":
    sys.exit(main())
