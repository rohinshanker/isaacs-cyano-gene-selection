#!/usr/bin/env python3
"""Admit pinned Syn61 omics and source-labelled study fitness independently.

The gene join is exact, case-sensitive and unique across ALL annotated gene
features, including genes excluded from the map. No aliases, suffix stripping,
cross-strain transfers or missing-value imputation are performed.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import sys
from collections import defaultdict
from pathlib import Path
from urllib.parse import unquote

from recoded_multiomics import extract

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from condition_record import validate_record  # noqa: E402
from organisms import get_organism  # noqa: E402

ORGANISM_ID = "ecoli-syn61-delta3-ev5"
ACCESSION = "GCA_028355435.1"
REPLICON = "CP116771.1"
SHEET = "Syn61_delta3_ev5"
DOI = "10.1038/s41467-026-74300-9"
SOURCE_URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC13287592/supplementaryFiles"
CITATION = ("Nyerges A et al. Probing the limits of genetic recoding using "
            "multi-omics-guided evolution. Nature Communications (2026). "
            f"doi:{DOI}.")
WHERE = "Nyerges 2026, Methods, Transcriptome and translatome analysis (Sec19)"
DOC = "docs/validation/recoded-multiomics.md"
# The sheet labels these exact rows as the same strain under M9. This explicit
# source-row crosswalk separates condition from strain without parsing prose or
# merging evolved, troubleshot, clone-specific, or cross-assay identities.
M9_TO_RICH_ROW = {4: 3, 6: 5, 8: 7, 10: 9, 13: 12, 15: 14, 17: 16,
                  19: 18, 21: 20, 23: 22, 25: 24, 27: 26, 29: 28, 31: 30,
                  33: 32, 36: 35, 38: 37, 40: 39, 45: 44, 47: 46, 49: 48}
M9_ROWS = set(M9_TO_RICH_ROW)
# Literal workbook column contract. Positional inference would silently accept a
# revised workbook under old labels; the entire list is checked before writing.
COLUMNS = [
    (f"RNA-Ec_Syn61_delta3_ev5_{i}_rpkm", f"RNA RPKM replicate {i}", "RNA-seq", "rpkm")
    for i in range(1, 4)
] + [
    (f"RIBO-Ec_Syn61_delta3_ev5_{i}_reads", f"Ribosome read count replicate {i}", "Ribo-seq", "read_count")
    for i in range(1, 4)
] + [
    (f"RIBO-Ec_Syn61_delta3_ev5_{i}_rpkm", f"Ribosome RPKM replicate {i}", "Ribo-seq", "rpkm")
    for i in range(1, 4)
] + [
    ("RNA_LFC", "RNA log2 fold change (read-count calculation)", "RNA-seq", "log2_fold_change"),
    ("RNA_LFC_EdgeR", "RNA log2 fold change (EdgeR)", "RNA-seq", "edger_log2_fold_change"),
    ("RNA_P-value", "RNA reported P-value", "RNA-seq", "p_value"),
    ("RIBO_LFC", "Ribosome log2 fold change (read-count calculation)", "Ribo-seq", "log2_fold_change"),
    ("RIBO_LFC_EdgeR", "Ribosome log2 fold change (EdgeR)", "Ribo-seq", "edger_log2_fold_change"),
    ("RIBO_P-value", "Ribosome reported P-value", "Ribo-seq", "p_value"),
    ("Delta_LFC", "Translation-efficiency log2 fold change", "Ribo-seq", "translation_efficiency_log2_fold_change"),
]
VALUE_COLUMNS = {
    "rpkm": "abundance", "read_count": "read_count",
    "log2_fold_change": "log2_fold_change", "edger_log2_fold_change": "log2_fold_change",
    "p_value": "p_value", "translation_efficiency_log2_fold_change": "translation_efficiency_log2_fold_change",
}
UNITS = {
    "rpkm": "RPKM, source reported", "read_count": "ribosome-footprint reads",
    "log2_fold_change": "log2 fold change vs MDS42 (read-count calculation)",
    "edger_log2_fold_change": "log2 fold change vs MDS42 (EdgeR)",
    "p_value": "source-reported P-value, adjustment unspecified",
    "translation_efficiency_log2_fold_change": "log2 translation-efficiency change vs MDS42",
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n")


def gene_name_index(path: Path) -> dict[str, set[str]]:
    """Index all gene features, not just the subset surviving CDS filtering."""
    names = defaultdict(set)
    with gzip.open(path, "rt") as handle:
        for line in handle:
            if line.startswith("#"):
                continue
            fields = line.rstrip("\n").split("\t")
            if len(fields) != 9:
                raise ValueError("Malformed GFF row")
            if fields[0] != REPLICON:
                raise ValueError("GFF is not the deposited Syn61 ev5 replicon")
            if fields[2] != "gene":
                continue
            attrs = dict(part.split("=", 1) for part in fields[8].split(";") if "=" in part)
            if "gene" in attrs:
                if not attrs.get("locus_tag"):
                    raise ValueError("Named GFF gene has no locus tag")
                names[unquote(attrs["gene"])].add(unquote(attrs["locus_tag"]))
    if not names:
        raise ValueError("GFF contains no named genes")
    return dict(names)


def join_rows(rows: list[dict], genes: list[dict], names: dict[str, set[str]]) -> list[dict]:
    """Return an exhaustive mapping audit; every source key has one outcome."""
    targets = {gene["id"]: gene for gene in genes}
    if len(targets) != len(genes):
        raise ValueError("Duplicate plotted locus tag")
    seen = set()
    used = set()
    audit = []
    for row in rows:
        key = row["gene"]
        if key in seen:
            raise ValueError(f"Duplicate source identifier: {key}")
        seen.add(key)
        candidates = sorted(names.get(key, set()))
        locus = candidates[0] if len(candidates) == 1 else None
        status = ("unmatched" if not candidates else "ambiguous" if len(candidates) > 1
                  else "excluded_from_map" if locus not in targets else "mapped")
        if status == "mapped":
            if locus in used or targets[locus]["name"] != key:
                raise ValueError(f"Inconsistent gene join: {key}")
            used.add(locus)
        audit.append({"sourceRow": row["sourceRow"], "sourceGene": key,
                      "status": status, "locusTag": locus if status == "mapped" else None,
                      "candidates": candidates})
    return audit


def conditions() -> dict:
    """The one directly reported culture condition, with absence explicit."""
    def axis(text, *, reported=True, **fields):
        return {"status": "reported" if reported else "not reported", "text": text,
                "quote": "", "where": WHERE if reported else "", **fields}
    return {
        "temperature": axis("37 °C", lo=37, hi=37, unit="°C"),
        "lightIntensity": axis("Not reported", reported=False, lo=None, hi=None,
                               unit="µmol photons m⁻² s⁻¹"),
        "lightRegime": axis("Not reported", reported=False, kind=None, photoperiod=None,
                            spectrumClass=None, entrained=False),
        "co2": axis("Not reported", reported=False, lo=None, hi=None, unit="%"),
        "medium": axis("Lysogeny Broth Lennox (LBL), without growth antibiotics",
                       base="LBL", modified=False, conditioned=False, nitrogenAltered=False),
        "format": axis("500 ml in 2000 ml baffled Erlenmeyer flask, 250 rpm", value="flask"),
        "phase": axis("Mid-exponential, OD600 0.40–0.45", label="exponential",
                      od=[0.4, 0.45], odNm=600),
    }


def write_omics(document: dict, genes: list[dict], names: dict, output: Path, gff: Path) -> list[dict]:
    """Write sixteen independent, source-addressable typed tables and metadata."""
    sheet = next(table for table in document["omics"] if table["sheet"] == SHEET)
    if [col["sourceColumn"] for col in sheet["columns"]] != [spec[0] for spec in COLUMNS]:
        raise ValueError("Syn61 source columns changed")
    audit = join_rows(sheet["rows"], genes, names)
    source = next(s for s in document["sources"] if s["file"] == "Supplementary_Data_3.xlsx")
    output.mkdir(parents=True, exist_ok=True)
    mapping_path = output / "gene-join-audit.json"
    write_json(mapping_path, {"schemaVersion": 1, "organismId": ORGANISM_ID,
                            "genomeAccession": ACCESSION, "replicon": REPLICON,
                            "source": source, "sourceSheet": SHEET,
                            "annotationSha256": digest(gff), "route": "exact unique gene name",
                            "rows": audit})
    manifest = []
    for column, (header, label, platform, quantity) in enumerate(COLUMNS):
        source_id = f"Nyerges2026_Syn61_{column + 1:02d}"
        path = output / f"{source_id}.tsv"
        with path.open("w", newline="") as handle:
            writer = csv.writer(handle, delimiter="\t", lineterminator="\n")
            writer.writerow(["locus_tag", VALUE_COLUMNS[quantity], "source_gene_id"])
            for row, mapped in zip(sheet["rows"], audit, strict=True):
                value = row["values"][column]
                if mapped["status"] == "mapped" and value is not None:
                    writer.writerow([mapped["locusTag"], repr(value), row["gene"]])
        individual = column < 9
        record = {
            "studyId": "Nyerges2026", "dataType": "transcriptomics", "platform": platform,
            "strain": "Syn61∆3(ev5)", "basis": "direct", "conditionSet": "LBL, 37 °C, mid-exponential",
            "samples": header if individual else "Three paired RNA/Ribo cultures; Syn61∆3(ev5) / MDS42",
            "archiveUrl": SOURCE_URL,
            "citation": {"text": CITATION, "url": f"https://doi.org/{DOI}", "pmid": "42331836"},
            "replicates": {"count": 1 if individual else 3,
                           "text": ("One of three independent biological replicates; RNA and Ribo "
                                    "libraries came from the same samples." if individual else
                                    "Three independent starter cultures; paired RNA/Ribo libraries."),
                           "where": WHERE},
            "treatments": [], "group": "engineered", "conditionTableRow": None,
            "conditions": conditions(),
        }
        validate_record(record, source_id)
        caveat = ("Exact, case-sensitive gene-name join unique across all CP116771.1 annotated genes; "
                  "ambiguous, unmatched and excluded loci are absent. No suffix stripping or aliases. "
                  "RPKM denominators/filtering and non-EdgeR pseudocount/aggregation are unspecified. "
                  "EdgeR 4.0.12 settings are not fully reported. P-values are described as adjusted "
                  "in figure captions; the adjustment method/family is unspecified. Delta_LFC is "
                  "RIBO_LFC minus RNA_LFC, not an EdgeR difference or absolute translation efficiency.")
        manifest.append({
            "id": source_id, "file": path.name, "metricKey": f"nyergesSyn61Column{column + 1:02d}",
            "label": label + (" — Syn61∆3(ev5)" if individual else " — Syn61∆3(ev5) vs MDS42"),
            "organism": "Escherichia coli Syn61∆3(ev5)", "isTargetOrganism": True,
            "assay": "RNA-seq" if platform == "RNA-seq" else "ribosome profiling",
            "quantity": quantity, "units": UNITS[quantity], "condition": record["conditionSet"],
            "sha256": digest(path), "record": record, "citationId": "nyerges-2026-recoding",
            "licence": "Article CC BY-NC-ND 4.0; derived numerical tables admitted with attribution under the owner's 2026-10-06 source-ledger decision, not represented as unmodified publisher files.",
            "caveat": caveat, "provenanceDoc": DOC, "payload": "expression_layers.json",
            "signed": quantity in {"log2_fold_change", "edger_log2_fold_change", "translation_efficiency_log2_fold_change"},
            "logScale": False,
            "ingest": {"sourceFile": source["file"], "sourceSha256": source["sha256"],
                       "sourceUrl": SOURCE_URL, "sheet": SHEET, "columns": [header],
                       "normalization": "as-deposited", "mappingRoute": "exact unique gene name on CP116771.1",
                       "mappingAuditSha256": digest(mapping_path),
                       "referenceStrain": None if individual else "MDS42",
                       "missingPolicy": "source dash/blank or unjoined gene is absent, never zero"},
        })
    write_json(output / "sources.json", manifest)
    return manifest


def fitness_document(document: dict) -> dict:
    """Preserve source strain identities without cross-assay organism joins."""
    source = next(s for s in document["sources"] if s["file"] == "Supplementary_Data_2.xlsx")
    strains = []
    growth = []
    for row in document["growth"]:
        n = row["sourceRow"]
        identifier = f"growth-row-{n}"
        strain_id = f"growth-strain-{M9_TO_RICH_ROW.get(n, n)}"
        if n not in M9_ROWS:
            strains.append({"id": strain_id, "label": "Growth: " + row["sourceLabel"],
                            "scheme": {"recoded": n >= 7,
                                       "label": "Partial Syn57 design" if n >= 7 else "Non-recoded control",
                                       "segments": row["sourceLabel"] if n >= 7 else None}})
        record = {key: row[key] for key in ("growthStatus", "doublingTimeMinutes", "doublingTimeSdMinutes",
                                          "maximumOd600", "maximumOd600Sd")}
        record.update({"id": identifier, "strainId": strain_id,
                       "conditionId": "m9" if n in M9_ROWS else "2xyt"})
        for key, values in (("doublingTimeReplicates", row["doublingTimeReplicatesMinutes"]),
                            ("maximumOd600Replicates", row["maximumOd600Replicates"])):
            record[key] = [{"replicate": i, "value": v} for i, v in enumerate(values, 1)]
        growth.append(record)
    wells = []
    for i, sheet in enumerate(document["biolog"]):
        identifier = f"biolog-sheet-{i + 1}"
        strains.append({"id": identifier, "label": "Biolog: " + sheet["sheet"],
                        "scheme": {"recoded": True,
                                   "label": "Syn61∆3(ev5)" if sheet["sheet"] == "MDS42 vs Syn61Δ3(ev5)" else "Partial Syn57 design",
                                   "segments": None if i == 0 else sheet["sheet"]}})
        for row in sheet["rows"]:
            wells.append({"id": f"{identifier}-row-{row['sourceRow']}-column-{row['sourceColumn']}",
                          "strainId": identifier, "conditionId": "biolog",
                          "plateId": row["plate"], "well": row["well"][0] + row["well"][1:].zfill(2),
                          "substrate": row["substrate"], "value": row["maxHeight"]})
    return {
        "schemaVersion": 1, "organismId": ORGANISM_ID, "genome": {"accession": ACCESSION},
        "provenanceClass": "published",
        "source": {"citation": CITATION, "doi": DOI, "studyId": "Nyerges2026",
                   "sourceFile": source["file"], "sourceFileSha256": source["sha256"],
                   "retrieved": "2026-10-08", "sheet": "Fitness_Source_data and eleven Biolog sheets",
                   "comparedAgainst": None},
        "strains": strains,
        "conditions": [{"id": "2xyt", "label": "2×YT, 37 °C"},
                       {"id": "m9", "label": "M9 + 2% D-glucose, 37 °C"},
                       {"id": "biolog", "label": "Biolog, 37 °C, 48 h; plate-specific supplementation"}],
        "growth": {"units": {"doublingTime": "minutes", "maximumOd600": "OD600"},
                   "metadata": {"Scope": "Study comparison strains named in each row; these are not all Syn61. Growth and Biolog identities are kept separate, with no inferred evolution-stage join.",
                                "Source": "Fitness_Source_data, source row encoded in record ID",
                                "Replicates": "Ten published measurements per row; independent starter-culture mapping unspecified.",
                                "SD": "Source-reported population SD (ddof=0).",
                                "No growth": "Categorical source result; all numeric zero placeholders retained only in the source-cell audit, not interpreted as kinetic measurements.",
                                "Acquisition": "Aerobic microplate, 800 rpm, OD600 every nine minutes; GrowthRates 4.4. Long-term no-growth assessment used three cultures over 14 days."},
                   "records": growth},
        "biolog": {"units": {"value": "source-reported Max Height difference (optical-density basis; source wavelength inconsistent)",
                              "reference": "MDS42", "normalization": "As deposited; exact background/curve/per-well processing unspecified; source mentions 590 nm and OD600."},
                   "metadata": {"Replicates": "Two independent replicate measurements summarized by source; individual replicate values unavailable.",
                                "Summary": "No cross-well mean is reported here. Published Table 1 score matches the sum, despite mean wording.",
                                "Identity": "Seg80-0 source label retained; equivalence to Seg82-0 unresolved. No cross-assay identity or evolution-stage join.",
                                "Source": "Exact source sheet retained in strain label; row/column in record ID."},
                   "plates": [{"id": p, "label": p} for p in ("PM01", "PM02", "PM04", "PM06", "PM09")],
                   "records": wells},
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=ROOT / "data/raw/recoded-ecoli")
    args = parser.parse_args(argv)
    organism = get_organism(ORGANISM_ID)
    data_dir = organism.path("outputDirectory")
    meta = json.loads((data_dir / "meta.json").read_text())
    if meta["genome"]["accession"] != ACCESSION:
        raise ValueError("Dataset is not the deposited Syn61 ev5 assembly")
    gff = organism.path("rawDirectory") / f"{organism.assemblyPrefix}_genomic.gff.gz"
    if meta["sourceChecksums"].get(gff.name) != hashlib.md5(gff.read_bytes()).hexdigest():
        raise ValueError("Genome annotation differs from the built dataset")
    document = extract(args.source_dir)
    genes = json.loads((data_dir / "genes.json").read_text())
    sources = write_omics(document, genes, gene_name_index(gff), organism.path("expressionDirectory"), gff)
    write_json(data_dir / "strain_fitness.json", fitness_document(document))
    write_json(ROOT / "data/recoded/nyerges-2026/growth-source-cell-audit.json", document["growth"])
    write_citations(data_dir, organism.path("expressionDirectory"), sources)
    print(f"Wrote {len(sources)} Syn61 omics fields; 69 source growth records and 5280 source Biolog wells.")
    return 0


def write_citations(data_dir: Path, expression_dir: Path, sources: list[dict]) -> None:
    """Publish a self-contained source ledger for this organism's actual inputs."""
    methods = json.loads((ROOT / "site/data/citations.json").read_text())["sections"][1]
    methods["items"].append({
        "id": "fredens-2019-syn61", "citation": "Fredens J, Wang K, de la Torre D, et al. Total synthesis of Escherichia coli with a recoded genome. Nature 569, 514–518 (2019). doi:10.1038/s41586-019-1192-5. Chin lab deposit Addgene #174513.",
        "url": "https://www.addgene.org/174513/",
        "contribution": "Depositor Comments establish the original Syn61 design prescription TCG→AGC, TCA→AGT, TAG→TAA. This describes the ancestor's prescribed replacements, not a complete per-locus edit history for the evolved CP116771.1 genome.",
        "downloads": [],
    })
    paths = [expression_dir / s["file"] for s in sources]
    paths += [expression_dir / "gene-join-audit.json", expression_dir / "sources.json",
              ROOT / "data/recoded/nyerges-2026/growth-source-cell-audit.json",
              data_dir / "strain_fitness.json"]
    downloads = []
    for path in paths:
        relative = path.relative_to(ROOT).as_posix()
        downloads.append({"filename": path.name, "repoPath": relative,
                          "url": "https://raw.githubusercontent.com/rohinshanker/isaacs-cyano-gene-selection/refs/heads/main/" + relative,
                          "kind": "Project-derived table or provenance audit; not the original workbook"})
    primary = {"id": "primary-data", "title": "Primary data",
               "description": "The deposited Syn61∆3(ev5) genome, source-reported omics and separately labelled whole-strain fitness comparisons.",
               "items": [
                   {"id": "ncbi-ecoli-syn61-delta3-ev5", "citation": "NCBI GenBank. Escherichia coli Syn61 substr. delta 3 (ev5), GCA_028355435.1 (ASM2835543v1), CP116771.1; PGAP 6.4 annotation, January 2023; retrieved 2026-10-08.",
                    "url": "https://www.ncbi.nlm.nih.gov/datasets/genome/GCA_028355435.1/",
                    "contribution": "Exact evolved strain accession named in Nyerges 2026 Supplementary Data 1, Strains & Plasmids D2. Sequence, CDS, coordinates and tRNA annotations supply this map; 3,549 CDS pass the published filtering contract, 141 are excluded. Native axes are refitted to this genome. Original assembly files are downloaded at build and checked against NCBI MD5; no experimental-parent equivalence is inferred.",
                    "downloads": []},
                   {"id": "nyerges-2026-recoding", "citation": CITATION,
                    "url": f"https://doi.org/{DOI}",
                    "contribution": "Supplementary Data 3 Syn61_delta3_ev5 supplies sixteen separately typed columns: six replicate RPKMs, three ribosome read counts, four RNA/Ribo log2 changes, two P-values and translation-efficiency log2 change. Exact unique gene-name mapping reaches 3,192 of 3,640 author rows; all omissions are audited. MDS42 is the contrast reference. Supplementary Data 2 supplies 69 growth rows and 5,280 signed Biolog well differences for source-labelled study strains; these whole-strain comparisons color no gene. Missing normalization details, wavelength inconsistency, no-growth sentinels and unresolved assay-stage identities remain explicit. Article CC BY-NC-ND 4.0; derived tables admitted under the owner's citation-only decision of 2026-10-06 and labelled as derived.",
                    "downloads": downloads},
               ]}
    write_json(data_dir / "citations.json", {"sections": [primary, methods]})


if __name__ == "__main__":
    raise SystemExit(main())
