#!/usr/bin/env python3
"""Build the E. coli K-12 MG1655 annotation layer from UniProtKB and the GOA file.

The UTEX 2973 annotation release pairs the RefSeq GFF with NCBI's own GAF. The
E. coli record's annotation is derived from EcoCyc and NCBI publishes no GAF for
it, so this builder pairs the pinned RefSeq GFF (coordinates, overlaps, nearby
RNA genes, methods and inferences) with two curated sources the owner admitted
on 2026-10-06:

- UniProtKB, proteome UP000000625 (every entry reviewed): the curated function
  text, protein name and existence level, joined to the RefSeq locus tag through
  the entry's ordered locus name (``b`` number). CC BY 4.0.
- The UniProt-GOA proteome GAF for MG1655: every evidence-coded GO relationship
  (experimental and computational, assigned by EcoCyc, UniProt, InterPro and
  others), keyed by UniProtKB accession and joined through the same table.
  GO data: Gene Ontology Consortium, CC BY 4.0.

It writes the three artifacts the feature build reads for any organism with
the ``annotation`` layer (``annotation-evidence-v1.jsonl``,
``go-annotations-v1.tsv``, ``release-summary-v1.json``) and the organism's GO
term-name lookup, filtered to the terms its relationships use from the pinned
ontology release the UTEX lookup also uses. Nothing is inferred: a locus with
no UniProt entry has a null ``curatedFunction``, an accession naming several
loci is carried to each with its ambiguity stated, and a GO row whose accession
names no locus is counted, never guessed.

Usage:
    ecoli_annotation_layer.py fetch            # download and verify the pinned inputs
    ecoli_annotation_layer.py build [--obo P]  # write the release and the GO names
    ecoli_annotation_layer.py check [--obo P]  # rebuild in memory and compare digests
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path
from typing import Any, Mapping

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from annotation_release import (  # noqa: E402
    _by_locus, _feature_segments, _is_gene_feature, _nearby_ncrnas, _overlapping_cds,
    _replicon_identity, parse_gff,
)
from go_term_names import (  # noqa: E402
    ONTOLOGY_BYTES, ONTOLOGY_RELEASE, ONTOLOGY_SHA256, ONTOLOGY_URL, parse_obo,
)

ORGANISM_ID = "ecoli-k12-mg1655"
ASSEMBLY = "GCF_000005845.2"
RELEASE_ID = "GCF_000005845.2-UniProtGOA_2026-07-28"
RAW_DIR = ROOT / "data/raw/ecoli-k12-mg1655"
GFF_PATH = RAW_DIR / "GCF_000005845.2_ASM584v2_genomic.gff.gz"
INPUT_DIR = RAW_DIR / "annotation"
RELEASE_DIR = ROOT / "data/annotation/releases" / RELEASE_ID
SITE_DIR = ROOT / "site/data/organisms/ecoli-k12-mg1655"
GO_NAMES_PATH = SITE_DIR / "go-term-names-v1.json"
B_NUMBER = re.compile(r"^b\d{4}$")

# The two pinned inputs: the GAF as EBI serves it, and UniProt's TSV stream of
# the proteome with the fields this layer reads, retrieved 2026-10-06.
INPUTS = {
    "gaf": {
        "name": "18.E_coli_MG1655.goa",
        "url": "https://ftp.ebi.ac.uk/pub/databases/GO/goa/proteomes/18.E_coli_MG1655.goa",
        "sha256": "12694eed60b0caf54b5edbce367ca2d47df50c6691a734f27ab9f72249a7f06f",
        "byteSize": 10_026_754,
        "generated": "2026-07-28",
        "goVersion": "2026-07-26",
    },
    "uniprot": {
        "name": "uniprot_UP000000625.tsv",
        "url": ("https://rest.uniprot.org/uniprotkb/stream?query=proteome:UP000000625&format=tsv"
                "&fields=accession,id,reviewed,gene_primary,gene_oln,gene_synonym,protein_name,"
                "cc_function,xref_refseq,protein_existence,length,date_modified,version"),
        "sha256": "8961fc6f35769029eeab2c4a392505584008bbb0106307779870519a56f52c88",
        "byteSize": 2_134_190,
        "retrieved": "2026-10-06",
    },
}
GAF_COLUMNS = 17
GO_TSV_FIELDS = [
    "locus_tag", "uniprot_accession", "go_id", "qualifier", "aspect", "evidence_code", "reference",
    "with_from", "assigned_by", "annotation_date", "source_taxon", "mapping_ambiguity", "mapping_method",
]
MAPPING_METHOD = "UniProtKB ordered locus name to RefSeq locus_tag"


class LayerError(RuntimeError):
    """Raised when a pinned input or a generated artifact violates its contract."""


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_input(path: Path, spec: Mapping[str, Any]) -> None:
    """A pinned input must exist with its recorded size and digest."""
    if not path.is_file():
        raise LayerError(f"missing pinned input {path}; run `ecoli_annotation_layer.py fetch`")
    if path.stat().st_size != spec["byteSize"]:
        raise LayerError(f"{path.name}: expected {spec['byteSize']} bytes, got {path.stat().st_size}")
    observed = sha256_file(path)
    if observed != spec["sha256"]:
        raise LayerError(f"{path.name}: expected SHA-256 {spec['sha256']}, got {observed}")


def fetch_inputs(input_dir: Path | None = None, opener: Any = urllib.request.urlopen) -> list[Path]:
    """Download each missing input, refusing a byte that differs from its pin."""
    input_dir = input_dir or INPUT_DIR
    written = []
    input_dir.mkdir(parents=True, exist_ok=True)
    for spec in INPUTS.values():
        target = input_dir / spec["name"]
        if not target.is_file():
            with opener(spec["url"], timeout=300) as response:  # noqa: S310 - pinned https URL
                data = response.read()
            if sha256_bytes(data) != spec["sha256"]:
                raise LayerError(f"{spec['name']}: download differs from the pinned SHA-256; nothing written")
            target.write_bytes(data)
            written.append(target)
        verify_input(target, spec)
    return written


ECO_TAG = re.compile(r"\s*\{ECO:[^}]*\}")


def strip_function(text: str) -> list[str]:
    """UniProt's ``FUNCTION: ...`` blocks as plain sentences, one per block.

    The inline evidence tags (``{ECO:...}``) are UniProt's markup, not the
    curators' sentence, and are removed; the entry's accession keeps the link
    to that evidence.
    """
    blocks = [re.sub(r"\.\s*\.", ".", ECO_TAG.sub("", block)).strip() for block in re.split(r"\s*FUNCTION:\s*", text)]
    return [block for block in blocks if block]


def load_uniprot(path: Path) -> dict[str, dict[str, Any]]:
    """UniProtKB accession → the entry this layer keeps, with its ``b`` numbers."""
    entries: dict[str, dict[str, Any]] = {}
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle, delimiter="\t"):
            loci = [token for token in row["Gene Names (ordered locus)"].split() if B_NUMBER.match(token)]
            entries[row["Entry"]] = {
                "accession": row["Entry"],
                "entryName": row["Entry Name"],
                "reviewed": row["Reviewed"] == "reviewed",
                "geneName": row["Gene Names (primary)"] or None,
                "proteinName": row["Protein names"],
                "function": strip_function(row["Function [CC]"]),
                "existence": row["Protein existence"],
                "entryVersion": int(row["Entry version"]) if row.get("Entry version") else None,
                "modified": row.get("Date of last modification") or None,
                "loci": loci,
            }
    if not entries:
        raise LayerError(f"{path.name}: no UniProt entries")
    return entries


def load_gaf(path: Path) -> list[list[str]]:
    """Every annotation row of the GAF, 17 columns, header lines skipped."""
    rows = []
    with path.open(encoding="utf-8") as handle:
        for number, line in enumerate(handle, start=1):
            if line.startswith("!") or not line.strip():
                continue
            fields = line.rstrip("\n").split("\t")
            if len(fields) != GAF_COLUMNS:
                raise LayerError(f"{path.name} line {number}: expected {GAF_COLUMNS} columns, got {len(fields)}")
            rows.append(fields)
    if not rows:
        raise LayerError(f"{path.name}: no annotation rows")
    return rows


def build_evidence(gff_path: Path, uniprot: Mapping[str, dict[str, Any]]) -> tuple[dict[str, dict[str, Any]], dict[str, int]]:
    """One evidence record per gene locus, in the UTEX release's shape plus ``curatedFunction``."""
    features, lengths = parse_gff(gff_path)
    genes = {f.attrs["locus_tag"]: f for f in features if _is_gene_feature(f) and f.attrs.get("locus_tag")}
    regions = {f.seqid: f for f in features if f.kind == "region"}
    cds_by_locus = _by_locus(features, "CDS")
    overlaps = _overlapping_cds(cds_by_locus, lengths)
    nearby = _nearby_ncrnas(genes, lengths)
    by_locus: dict[str, dict[str, Any]] = defaultdict(list)
    for entry in uniprot.values():
        for locus in entry["loci"]:
            by_locus[locus].append(entry)
    records: dict[str, dict[str, Any]] = {}
    counts = {"pseudogenes": 0, "partialLoci": 0, "translationalExceptionLoci": 0,
              "lociWithCuratedFunction": 0, "lociWithUniprotEntry": 0, "lociWithSeveralUniprotEntries": 0}
    for locus in sorted(genes):
        gene = genes[locus]
        cds = cds_by_locus.get(locus, [])
        exceptions = sorted({f.attrs["exception"] for f in cds if f.attrs.get("exception")})
        inferences = sorted({f.attrs["inference"] for f in cds if f.attrs.get("inference")})
        notes = sorted({f.attrs["Note"] for f in cds if f.attrs.get("Note")})
        partial = any(f.attrs.get("partial") == "true" or "start_range" in f.attrs or "end_range" in f.attrs
                      for f in [gene, *cds])
        pseudogene = (gene.attrs.get("gene_biotype") == "pseudogene" or gene.attrs.get("pseudo") == "true"
                      or any(f.attrs.get("pseudo") == "true" for f in cds))
        counts["pseudogenes"] += int(pseudogene)
        counts["partialLoci"] += int(partial)
        counts["translationalExceptionLoci"] += int(bool(exceptions))
        replicon_type, replicon_name = _replicon_identity(regions[gene.seqid])
        entries = sorted(by_locus.get(locus, []), key=lambda e: e["accession"])
        curated = None
        if entries:
            counts["lociWithUniprotEntry"] += 1
            counts["lociWithSeveralUniprotEntries"] += int(len(entries) > 1)
            entry = entries[0]
            curated = {
                "accession": entry["accession"],
                "entryName": entry["entryName"],
                "reviewed": entry["reviewed"],
                "proteinName": entry["proteinName"],
                "function": entry["function"],
                "existence": entry["existence"],
                "entryVersion": entry["entryVersion"],
                "modified": entry["modified"],
                "mappingMethod": MAPPING_METHOD,
                "mappingAmbiguity": (
                    "entry names several loci: " + ", ".join(entry["loci"]) if len(entry["loci"]) > 1 else ""),
                "otherEntries": [e["accession"] for e in entries[1:]],
            }
            counts["lociWithCuratedFunction"] += int(bool(entry["function"]))
        records[locus] = {
            "schemaVersion": 1,
            "releaseId": RELEASE_ID,
            "locusTag": locus,
            "geneBiotype": gene.attrs.get("gene_biotype"),
            "seqid": gene.seqid,
            "start": gene.start,
            "end": gene.end,
            "strand": gene.strand,
            "repliconType": replicon_type,
            "repliconName": replicon_name,
            "pseudogene": pseudogene,
            "partial": partial,
            "cdsSegments": [list(segment) for segment in _feature_segments(cds, lengths)],
            "translationalExceptions": exceptions,
            "notes": notes,
            "overlappingCds": overlaps.get(locus, []),
            "nearbyNoncodingRnas": nearby.get(locus, []),
            "annotationMethods": sorted({f.source for f in cds}),
            "inferences": inferences,
            "confidence": None,
            "confidenceNote": ("No numeric confidence is present in the pinned NCBI release; "
                               "the annotation is curator-submitted (EcoCyc) and raw method and inference "
                               "evidence are preserved."),
            "proteinNameEvidence": [],
            "curatedFunction": curated,
        }
    counts.update({
        "annotationEvidenceRecords": len(records),
        "overlappingCdsPairs": sum(len(items) for items in overlaps.values()) // 2,
        "lociWithOverlappingCds": len(overlaps),
        "nearbyNoncodingRnaRelationships": sum(len(items) for items in nearby.values()),
        "lociWithNearbyNoncodingRna": sum(bool(items) for items in nearby.values()),
        "uniprotEntries": len(uniprot),
        "uniprotEntriesWithoutLocus": sum(1 for e in uniprot.values() if not e["loci"]),
    })
    return records, counts


def build_go_rows(gaf: list[list[str]], uniprot: Mapping[str, dict[str, Any]],
                  loci: set[str]) -> tuple[list[dict[str, str]], dict[str, int]]:
    """GO rows keyed by locus, one per (accession row, locus the accession names)."""
    rows: list[dict[str, str]] = []
    counts = {"goSourceRecords": len(gaf), "goUnmatchedAccessionRows": 0, "goUnknownLocusRows": 0,
              "goAmbiguousRelationships": 0}
    for fields in gaf:
        accession = fields[1]
        entry = uniprot.get(accession)
        targets = entry["loci"] if entry else []
        if not targets:
            counts["goUnmatchedAccessionRows"] += 1
            continue
        ambiguity = "accession names several loci: " + ", ".join(targets) if len(targets) > 1 else ""
        for locus in targets:
            if locus not in loci:
                counts["goUnknownLocusRows"] += 1
                continue
            counts["goAmbiguousRelationships"] += int(bool(ambiguity))
            rows.append({
                "locus_tag": locus, "uniprot_accession": accession, "go_id": fields[4], "qualifier": fields[3],
                "aspect": fields[8], "evidence_code": fields[6], "reference": fields[5], "with_from": fields[7],
                "assigned_by": fields[14], "annotation_date": fields[13], "source_taxon": fields[12],
                "mapping_ambiguity": ambiguity, "mapping_method": MAPPING_METHOD,
            })
    rows.sort(key=lambda r: (r["locus_tag"], r["go_id"], r["qualifier"], r["evidence_code"], r["reference"],
                             r["with_from"], r["assigned_by"]))
    counts.update({
        "goMappedRelationships": len(rows),
        "goMappedLoci": len({r["locus_tag"] for r in rows}),
        "goUniqueTerms": len({r["go_id"] for r in rows}),
    })
    return rows, counts


def go_names_payload(obo_path: Path, go_rows: list[dict[str, str]], go_tsv_sha256: str, *,
                     verify: bool = True) -> dict[str, Any]:
    """The organism's GO term-name lookup: the pinned ontology filtered to the terms its rows use."""
    if verify and (obo_path.stat().st_size != ONTOLOGY_BYTES or sha256_file(obo_path) != ONTOLOGY_SHA256):
        raise LayerError(f"{obo_path}: not the pinned go-basic.obo release {ONTOLOGY_RELEASE}")
    release, all_terms = parse_obo(obo_path)
    if verify and release != f"releases/{ONTOLOGY_RELEASE}":
        raise LayerError(f"ontology release mismatch: expected releases/{ONTOLOGY_RELEASE}, got {release!r}")
    required = sorted({row["go_id"] for row in go_rows})
    missing = [go_id for go_id in required if go_id not in all_terms]
    if missing:
        raise LayerError(f"ontology is missing {len(missing)} annotation GO ids, e.g. {missing[:5]}")
    return {
        "schemaVersion": 1,
        "source": {
            "ontology": {"releaseDate": ONTOLOGY_RELEASE, "url": ONTOLOGY_URL,
                         "byteSize": ONTOLOGY_BYTES, "sha256": ONTOLOGY_SHA256},
            "annotations": {"path": repo_path(RELEASE_DIR / "go-annotations-v1.tsv"),
                            "sha256": go_tsv_sha256, "uniqueGoIds": len(required)},
            "gaf": {"path": repo_path(INPUT_DIR / INPUTS["gaf"]["name"]), "sha256": INPUTS["gaf"]["sha256"]},
            "license": {"name": "Creative Commons Attribution 4.0 International",
                        "url": "https://creativecommons.org/licenses/by/4.0/",
                        "attribution": "Gene Ontology Consortium, copyright 1999-2026"},
        },
        "terms": {go_id: all_terms[go_id] for go_id in required},
    }


def repo_path(path: Path) -> str:
    """A path as the summary records it: relative to the repository where it lies inside it."""
    try:
        return str(path.resolve().relative_to(ROOT))
    except ValueError:
        return str(path)


def render(records: Mapping[str, dict[str, Any]], go_rows: list[dict[str, str]],
           counts: Mapping[str, int], *, gff_path: Path | None = None) -> dict[str, bytes]:
    """The three release artifacts as bytes, keyed by file name; the summary digests the other two."""
    gff_path = gff_path or GFF_PATH
    evidence = "".join(json.dumps(records[locus], sort_keys=True, separators=(",", ":")) + "\n"
                       for locus in sorted(records)).encode("utf-8")
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=GO_TSV_FIELDS, delimiter="\t", lineterminator="\n")
    writer.writeheader()
    writer.writerows(go_rows)
    go_tsv = buffer.getvalue().encode("utf-8")
    summary = {
        "schemaVersion": 1,
        "releaseId": RELEASE_ID,
        "organism": ORGANISM_ID,
        "assemblyAccession": ASSEMBLY,
        "inputs": {
            "gff": {"path": repo_path(gff_path), "sha256": sha256_file(gff_path)},
            "gaf": {**INPUTS["gaf"], "path": repo_path(INPUT_DIR / INPUTS["gaf"]["name"])},
            "uniprot": {**INPUTS["uniprot"], "path": repo_path(INPUT_DIR / INPUTS["uniprot"]["name"])},
        },
        "licences": {
            "uniprot": "UniProtKB, CC BY 4.0 (The UniProt Consortium)",
            "go": "Gene Ontology Consortium, CC BY 4.0; GOA annotations by EcoCyc, UniProt, InterPro and others",
        },
        "counts": dict(sorted(counts.items())),
        "generatedFiles": {
            "annotation-evidence-v1.jsonl": {"byteSize": len(evidence), "sha256": sha256_bytes(evidence)},
            "go-annotations-v1.tsv": {"byteSize": len(go_tsv), "sha256": sha256_bytes(go_tsv)},
        },
    }
    summary_bytes = (json.dumps(summary, indent=2, sort_keys=True) + "\n").encode("utf-8")
    return {"annotation-evidence-v1.jsonl": evidence, "go-annotations-v1.tsv": go_tsv,
            "release-summary-v1.json": summary_bytes}


def build(obo_path: Path, *, gff_path: Path | None = None, input_dir: Path | None = None,
          verify: bool = True) -> tuple[dict[str, bytes], bytes]:
    """Everything the layer publishes, in memory: the release files and the GO names.

    ``verify`` holds the inputs to their pins; a test over synthetic files turns it off.
    The module paths are read at call time so a test can point them elsewhere.
    """
    gff_path = gff_path or GFF_PATH
    input_dir = input_dir or INPUT_DIR
    if verify:
        for spec in INPUTS.values():
            verify_input(input_dir / spec["name"], spec)
    uniprot = load_uniprot(input_dir / INPUTS["uniprot"]["name"])
    gaf = load_gaf(input_dir / INPUTS["gaf"]["name"])
    records, counts = build_evidence(gff_path, uniprot)
    go_rows, go_counts = build_go_rows(gaf, uniprot, set(records))
    counts = {**counts, **go_counts}
    files = render(records, go_rows, counts, gff_path=gff_path)
    names = go_names_payload(obo_path, go_rows, sha256_bytes(files["go-annotations-v1.tsv"]), verify=verify)
    names_bytes = (json.dumps(names, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
    return files, names_bytes


def write_release(files: Mapping[str, bytes], names: bytes, *, release_dir: Path | None = None,
                  names_path: Path | None = None) -> None:
    release_dir = release_dir or RELEASE_DIR
    names_path = names_path or GO_NAMES_PATH
    release_dir.mkdir(parents=True, exist_ok=True)
    for name, data in files.items():
        (release_dir / name).write_bytes(data)
    names_path.parent.mkdir(parents=True, exist_ok=True)
    names_path.write_bytes(names)


def check_release(files: Mapping[str, bytes], names: bytes, *, release_dir: Path | None = None,
                  names_path: Path | None = None) -> list[str]:
    """The names of published files that differ from a fresh build, empty when current."""
    release_dir = release_dir or RELEASE_DIR
    names_path = names_path or GO_NAMES_PATH
    stale = [name for name, data in files.items()
             if not (release_dir / name).is_file() or (release_dir / name).read_bytes() != data]
    if not names_path.is_file() or names_path.read_bytes() != names:
        stale.append(names_path.name)
    return stale


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("mode", choices=("fetch", "build", "check"))
    parser.add_argument("--obo", type=Path, default=None, help="the pinned go-basic.obo (build and check)")
    args = parser.parse_args(argv)
    try:
        if args.mode == "fetch":
            written = fetch_inputs()
            print(f"verified {len(INPUTS)} inputs in {INPUT_DIR} ({len(written)} downloaded)")
            return 0
        if args.obo is None:
            parser.error("--obo is required for build and check")
        files, names = build(args.obo)
        summary = json.loads(files["release-summary-v1.json"])
        if args.mode == "build":
            write_release(files, names)
            print(f"wrote {RELEASE_DIR} and {GO_NAMES_PATH}: "
                  f"{summary['counts']['annotationEvidenceRecords']} loci, "
                  f"{summary['counts']['goMappedRelationships']} GO relationships, "
                  f"{summary['counts']['lociWithCuratedFunction']} with a curated function")
            return 0
        stale = check_release(files, names)
        if stale:
            print("stale: " + ", ".join(stale) + "; run build", file=sys.stderr)
            return 1
        print(f"checked {RELEASE_ID}: current")
        return 0
    except LayerError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
