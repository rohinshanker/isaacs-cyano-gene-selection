#!/usr/bin/env python3
"""Ingest GEO GSE182100 as E. coli transcript and translation layers.

Source: Zhang, Dai et al., "Global and gene-specific translational regulation in
Escherichia coli across different conditions", *PLoS Comput Biol* 2022, PMID
36264977. GEO GSE182100, strain NCM3722.

Why this series and not another. It is the only E. coli deposit found by package
P-ECOLI-OMICS that carries ribosome occupancy and transcript abundance from one
study, one condition set and three biological replicates throughout, and whose
counts are already expressed on this viewer's own assembly, `NC_000913.3`. No
ortholog crosswalk is involved: the join is by coordinate.

**The coordinate rule.** Each count file names anonymous regions as
`chr:START-END(STRAND)`, zero-based and half-open, produced by `counts_in_region`
with `--add_three`, which extends the **three-prime** end by one codon. That end
is the high coordinate on the plus strand and the low coordinate on the minus
strand, so the rule is strand-aware:

    plus   gene span = (start + 1, end - 3)
    minus  gene span = (start + 4, end)

A span is accepted only when it equals a plotted gene's span exactly. Twenty-six
regions are multi-segment and use the outer span. Nothing is matched by overlap
or by nearest neighbour: a region that does not land on a gene exactly is left
unmapped rather than guessed.

**Strain.** NCM3722 is a K-12 strain, but it is not MG1655. Every layer records
that, and the interface names the strain wherever a value is shown.

Usage::

    tools/ingest_ecoli_expression.py              # write the layers and manifest
    tools/ingest_ecoli_expression.py --report     # print a summary, write nothing
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import re
import sys
import tarfile
from collections import OrderedDict, defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
INTERIM = ROOT / "data/interim/expression-ecoli"
RAW_TAR = INTERIM / "GSE182100_RAW.tar"
SERIES_MATRIX = INTERIM / "GSE182100_series_matrix.txt.gz"
GENES = ROOT / "site/data/organisms/ecoli-k12-mg1655/genes.json"
OUT_DIR = ROOT / "data/expression/organisms/ecoli-k12-mg1655"

#: Pinned bytes, retrieved 2026-10-07. A different download is a different
#: dataset and must be re-pinned deliberately.
RAW_TAR_SHA256 = "75f1581fac48bf1e65860a673eafef49a5fa4b427103ea624f25da55d1be9467"
SERIES_SHA256 = "baa906d51d19762e98f69f24a266eafd7c014a29c4af1f5559ea0a86bda1615d"

SERIES_URL = "https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE182100"
RAW_URL = (
    "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE182nnn/GSE182100/suppl/"
    "GSE182100_RAW.tar"
)
WHERE = "GEO GSE182100 series matrix, retrieved 2026-10-07"

#: The characteristic that names the assay rather than the biology. Grouping
#: without removing it would split every condition in two and hide that the two
#: layers were measured under the same conditions.
ASSAY_CHARACTERISTIC = "molecule subtype"

ASSAY_BY_SUBTYPE = {
    "ribosome protected mRNA": ("translation", "FP"),
    "total mRNA": ("transcript", "RNA"),
}

CITATION = {
    "text": (
        "Zhang H, Dai X, et al. Global and gene-specific translational regulation "
        "in Escherichia coli across different conditions. PLoS Comput Biol 2022; "
        "18(10):e1010641."
    ),
    "url": "https://doi.org/10.1371/journal.pcbi.1010641",
    "pmid": "36264977",
}


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_region(region: str) -> tuple[list[tuple[int, int]], str]:
    """Split ``chr:A-B^C-D(+)`` into its segments and strand."""
    match = re.fullmatch(r"chr:(.+)\(([+-])\)", region)
    if not match:
        raise ValueError(f"unreadable region {region!r}")
    segments = [
        (int(a), int(b))
        for a, b in (part.split("-", 1) for part in match.group(1).split("^"))
    ]
    return segments, match.group(2)


def gene_span(segments: list[tuple[int, int]], strand: str) -> tuple[int, int, str]:
    """The plotted gene span a region should equal, under the add-three rule."""
    low, high = segments[0][0], segments[-1][1]
    if strand == "+":
        return (low + 1, high - 3, strand)
    return (low + 1 + 3, high, strand)


def read_counts(data: bytes) -> list[tuple[str, str, float]]:
    """Return ``(region_name, region, rpkm)`` for one count file."""
    text = gzip.decompress(data).decode("utf-8", "replace")
    rows: list[tuple[str, str, float]] = []
    for line in text.splitlines():
        if line.startswith("##") or line.startswith("region_name"):
            continue
        parts = line.split("\t")
        if len(parts) < 5:
            continue
        rows.append((parts[0], parts[1], float(parts[4])))
    return rows


def load_series(path: Path = SERIES_MATRIX) -> list[dict[str, Any]]:
    """One record per GEO sample: accession, title, file name, characteristics."""
    raw = gzip.decompress(path.read_bytes()).decode("utf-8", "replace")

    def field(name: str) -> list[str]:
        for line in raw.splitlines():
            if line.startswith(name):
                return [v.strip('"') for v in line.split("\t")[1:]]
        return []

    accessions = field("!Sample_geo_accession")
    titles = field("!Sample_title")
    supplements = field("!Sample_supplementary_file_1")
    characteristics = [
        [v.strip('"') for v in line.split("\t")[1:]]
        for line in raw.splitlines()
        if line.startswith("!Sample_characteristics_ch1")
    ]
    samples = []
    for index, accession in enumerate(accessions):
        attrs = OrderedDict()
        for row in characteristics:
            key, _, value = row[index].partition(": ")
            attrs[key.strip()] = value.strip()
        samples.append({
            "accession": accession,
            "title": titles[index],
            "file": supplements[index].rsplit("/", 1)[-1],
            "attrs": attrs,
        })
    return samples


def group_samples(samples: list[dict[str, Any]]) -> "OrderedDict[tuple, list]":
    """Group into one entry per biological condition and assay."""
    groups: "OrderedDict[tuple, list]" = OrderedDict()
    for sample in samples:
        attrs = sample["attrs"]
        subtype = attrs.get(ASSAY_CHARACTERISTIC)
        if subtype not in ASSAY_BY_SUBTYPE:
            raise ValueError(f"unknown molecule subtype {subtype!r}")
        biology = tuple(
            (k, v) for k, v in attrs.items() if k != ASSAY_CHARACTERISTIC
        )
        groups.setdefault((biology, subtype), []).append(sample)
    return groups


def load_gene_spans(path: Path = GENES) -> dict[tuple[int, int, str], str]:
    """Plotted gene spans to gene ids, refusing a span claimed by two genes."""
    document = json.loads(path.read_text(encoding="utf-8"))
    rows = document["genes"] if isinstance(document, dict) else document
    spans: dict[tuple[int, int, str], str] = {}
    duplicated: set[tuple[int, int, str]] = set()
    for gene in rows:
        key = (gene["start"], gene["end"], gene["strand"])
        if key in spans:
            duplicated.add(key)
        spans[key] = gene["id"]
    for key in duplicated:
        # Two genes on one span cannot be told apart by coordinate, so neither
        # may claim the region.
        spans.pop(key, None)
    return spans


def condition_label(biology: tuple) -> str:
    """A reader-facing name for one biological condition."""
    attrs = dict(biology)
    parts = [attrs.get("treatment", "").strip()]
    rate = attrs.get("growth rate", "").strip()
    if rate:
        parts.append(f"growth rate {rate}")
    genotype = attrs.get("genotype", "").strip()
    if genotype and genotype != "wild type":
        parts.append(genotype)
    method = attrs.get("culture method", "").strip()
    if method:
        parts.append(method)
    return ", ".join(p for p in parts if p)


def slug(text: str) -> str:
    return re.sub(r"_+", "_", re.sub(r"[^0-9A-Za-z]+", "_", text)).strip("_")


def camel(text: str) -> str:
    return "".join(p[:1].upper() + p[1:] for p in re.split(r"[^0-9A-Za-z]+", text) if p)


def conditions_for(biology: tuple) -> dict[str, Any]:
    """The seven condition axes for one condition, from the deposit only."""
    attrs = dict(biology)
    method = attrs.get("culture method", "").strip()
    treatment = attrs.get("treatment", "").strip()
    rate = attrs.get("growth rate", "").strip()
    quote = "; ".join(f"{k}: {v}" for k, v in biology)
    unreported = lambda what: {  # noqa: E731 - a tiny local shape
        "status": "not reported",
        "text": f"the deposit records no {what}",
        "quote": "",
        "where": "",
    }
    return {
        "temperature": {**unreported("temperature"), "lo": None, "hi": None, "unit": "°C"},
        "lightIntensity": {
            **unreported("irradiance, and light is not a parameter of this experiment"),
            "lo": None, "hi": None, "unit": "µmol photons m⁻² s⁻¹",
        },
        "lightRegime": {
            **unreported("light regime, and light is not a parameter of this experiment"),
            "kind": None, "photoperiod": None, "spectrumClass": None, "entrained": False,
        },
        "co2": {**unreported("CO2 concentration"), "lo": None, "hi": None, "unit": "%"},
        "medium": {
            "status": "reported",
            "base": "MOPS",
            "modified": treatment not in ("defined rich MOPS", "glucose minimal"),
            "conditioned": False,
            "nitrogenAltered": treatment == "nitrogen limitation",
            "text": treatment or "not stated",
            "quote": quote,
            "where": WHERE,
        },
        "format": {
            "status": "reported" if method else "not reported",
            "value": method or None,
            "text": method or "the deposit records no culture format",
            "quote": quote if method else "",
            "where": WHERE if method else "",
        },
        "phase": {
            "status": "reported" if method else "not reported",
            # A chemostat holds a steady state by definition; the deposit states
            # the dilution rate rather than an optical density, so no OD is set.
            "label": ("steady-state" if method == "chemostat"
                      else "exponential" if method else None),
            "od": None,
            "odNm": None,
            "text": (f"{method}, growth rate {rate}" if method and rate
                     else method or "the deposit records no growth phase"),
            "quote": quote if method else "",
            "where": WHERE if method else "",
        },
    }


def build(report_only: bool = False, out_dir: Path = OUT_DIR) -> int:
    for path, expected in ((RAW_TAR, RAW_TAR_SHA256), (SERIES_MATRIX, SERIES_SHA256)):
        if not path.is_file():
            raise SystemExit(f"{path} is missing; see the module docstring for its URL")
        observed = sha256_of(path)
        if observed != expected:
            raise SystemExit(
                f"{path.name}: expected SHA-256 {expected}, got {observed}"
            )

    samples = load_series()
    groups = group_samples(samples)
    spans = load_gene_spans()

    with tarfile.open(RAW_TAR) as archive:
        members = {m.name: m for m in archive.getmembers()}
        payloads = {}
        for name, member in members.items():
            stream = archive.extractfile(member)
            if stream is None:
                raise SystemExit(f"{name} in {RAW_TAR.name} is not a readable file")
            payloads[name] = stream.read()

    layers: list[dict[str, Any]] = []
    unmapped_seen: set[str] = set()
    for (biology, subtype), group in groups.items():
        layer_kind, suffix = ASSAY_BY_SUBTYPE[subtype]
        label = condition_label(biology)
        totals: dict[str, float] = defaultdict(float)
        counts: dict[str, int] = defaultdict(int)
        for sample in group:
            name = sample["file"]
            if name not in payloads:
                raise SystemExit(f"{name} is not in {RAW_TAR.name}")
            for region_name, region, rpkm in read_counts(payloads[name]):
                segments, strand = parse_region(region)
                gene = spans.get(gene_span(segments, strand))
                if gene is None:
                    unmapped_seen.add(region_name)
                    continue
                totals[gene] += rpkm
                counts[gene] += 1
        values = {gene: totals[gene] / counts[gene] for gene in totals}
        layer_id = f"GSE182100_{slug(label)}_{suffix}"
        layers.append({
            "id": layer_id,
            "kind": layer_kind,
            "metricKey": f"{'expr' if layer_kind == 'transcript' else 'ribo'}Ec{camel(slug(label))}",
            "label": (f"{'Transcript' if layer_kind == 'transcript' else 'Ribosome occupancy'}"
                      f" {label} (NCM3722)"),
            "conditionSet": label,
            "samples": "; ".join(f"{s['accession']} ({s['title']})" for s in group),
            "biology": biology,
            "values": values,
            "replicates": len(group),
        })

    print(f"samples: {len(samples)}  conditions x assay: {len(groups)}")
    print(f"layers: {len(layers)}  "
          f"transcript: {sum(1 for l in layers if l['kind'] == 'transcript')}  "
          f"translation: {sum(1 for l in layers if l['kind'] == 'translation')}")
    coverage = {len(l["values"]) for l in layers}
    print(f"genes per layer: {sorted(coverage)}  of {len(spans)} plotted spans")
    print(f"regions never mapped: {len(unmapped_seen)}")
    replicates = {l["replicates"] for l in layers}
    print(f"replicates per layer: {sorted(replicates)}")
    if report_only:
        return 0

    out_dir.mkdir(parents=True, exist_ok=True)
    manifest: list[dict[str, Any]] = []
    for layer in layers:
        table = out_dir / f"{layer['id']}.tsv"
        with table.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle, delimiter="\t", lineterminator="\n")
            writer.writerow(["locus_tag", "abundance", "source_gene_id"])
            for gene in sorted(layer["values"]):
                writer.writerow([gene, f"{layer['values'][gene]:.4f}", gene])
        manifest.append(manifest_entry(layer, table))
    (out_dir / "sources.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    (out_dir / "pair_judgements.json").write_text("[]\n", encoding="utf-8")
    print(f"wrote {len(manifest)} layers to {out_dir}")
    return 0


def manifest_entry(layer: dict[str, Any], table: Path) -> dict[str, Any]:
    kind = layer["kind"]
    units = (
        "RPKM over the gene's counted region, as deposited"
        if kind == "transcript"
        else "ribosome-footprint RPKM over the gene's counted region, as deposited"
    )
    return {
        "record": {
            "studyId": "GSE182100",
            # Both are sequencing over RNA, so both are transcriptomics; the
            # platform and the assay kind are what keep footprints from pooling
            # with transcript counts.
            "dataType": "transcriptomics",
            "platform": "RNA-seq" if kind == "transcript" else "Ribo-seq",
            "strain": "NCM3722",
            "basis": "transferred",
            "conditionSet": layer["conditionSet"],
            "samples": layer["samples"],
            "archiveUrl": SERIES_URL,
            "citation": CITATION,
            "replicates": {
                "count": layer["replicates"],
                "text": (f"{layer['replicates']} biological replicates; the deposit "
                         "does not state whether the transcript and footprint "
                         "libraries of one replicate came from one culture"),
                "where": WHERE,
            },
            "treatments": [dict(layer["biology"]).get("treatment", "")] or [],
            "group": "standard" if dict(layer["biology"]).get("treatment") in (
                "glucose minimal", "defined rich MOPS") else "stress",
            "conditionTableRow": None,
            "conditions": conditions_for(layer["biology"]),
        },
        "id": layer["id"],
        "file": table.name,
        "metricKey": layer["metricKey"],
        "label": layer["label"],
        "organism": "Escherichia coli NCM3722",
        "isTargetOrganism": False,
        "assay": "RNA-seq" if kind == "transcript" else "ribosome profiling",
        "units": units,
        "condition": layer["conditionSet"],
        "sha256": sha256_of(table),
        "licence": (
            "GEO/NCBI public repository terms over the deposit; the article is "
            "PLOS Computational Biology, CC BY 4.0. Cited, not claimed."
        ),
        "caveat": (
            "Measured in Escherichia coli NCM3722, a K-12 strain but not the "
            "MG1655 shown on this page. Counts are the depositor's own, already "
            "expressed on NC_000913.3 and joined by exact gene span, so no "
            "ortholog crosswalk is involved. A footprint value is ribosome "
            "occupancy, not protein abundance, and is never placed on a "
            "transcript scale."
        ),
        "provenanceDoc": "data/expression/organisms/ecoli-k12-mg1655/INGESTED_SOURCES.md",
        "citationId": "zhang-2022-translation",
        "payload": "expression_layers.json",
        "signed": False,
        "ingest": {
            "sourceFile": RAW_TAR.name,
            "sourceSha256": RAW_TAR_SHA256,
            "sourceUrl": RAW_URL,
            "columns": [s.split(" ")[0] for s in layer["samples"].split("; ")],
            "normalization": "as-deposited",
            "mappedGenes": len(layer["values"]),
            "unmappedIdentifiers": 0,
            "mappingRoute": (
                "exact gene span on NC_000913.3 after undoing --add_three, "
                "strand-aware; no ortholog crosswalk"
            ),
        },
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", type=Path, default=OUT_DIR)
    parser.add_argument("--report", action="store_true")
    args = parser.parse_args(argv)
    return build(report_only=args.report, out_dir=args.out_dir)


if __name__ == "__main__":
    sys.exit(main())
