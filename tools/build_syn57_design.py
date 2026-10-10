#!/usr/bin/env python3
"""Build the Ec_Syn57 design viewer payload from its pinned GenBank record.

The publisher artifact is a complete *design*, not a sequenced isolate and not
an NCBI assembly. This tool validates that identity, normalizes its native
GenBank annotation into the established organism build inputs in a temporary
directory, and delegates feature calculation to ``scripts/build_features.py``.

Usage::

    .venv/bin/python tools/build_syn57_design.py
    .venv/bin/python tools/build_syn57_design.py --check
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import sys
import tempfile
import warnings
from collections import Counter
from pathlib import Path
from urllib.parse import quote

from Bio import BiopythonParserWarning, SeqIO
from Bio.Seq import Seq
from Bio.SeqFeature import CompoundLocation
from Bio.SeqRecord import SeqRecord

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "tools"))

import build_features  # noqa: E402
import build_data_manifest  # noqa: E402
import build_gene_overlaps  # noqa: E402
from organisms import get_organism  # noqa: E402

ORGANISM_ID = "ecoli-syn57-design"
SOURCE = ROOT / "data/raw/recoded-ecoli/Ec_Syn57.gb"
SOURCE_SIZE = 16_757_528
SOURCE_SHA256 = "8c61aeebfb8fef71a9d01ceba2a2acdb8babdf96ac0aa01aae36b10d08f77f96"
SEQUENCE_SHA256 = "5ad86e64fa142b009c159dddd4c1eccf5cce6e8bafa8c374cbfb6e9bc8e07033"
SOURCE_AUDIT_NAME = "source_feature_audit.json"
EXPECTED_FEATURE_COUNTS = {
    "CDS": 3640,
    "gene": 3821,
    "misc_feature": 73238,
    "tRNA": 85,
    "ncRNA": 60,
    "rRNA": 22,
    "misc_RNA": 21,
    "regulatory": 15,
    "mobile_element": 2,
    "misc_recomb": 1,
    "tmRNA": 1,
    "rep_origin": 1,
}
EXPECTED_TRNA_ANNOTATION_ROUTES = {
    "codon-recognition-note-reverse-complement": 75,
    "explicit-initiator-anticodon-note": 3,
    "selenocysteine-special-convention": 1,
    "unsupported": 6,
}


class Syn57BuildError(ValueError):
    """The source no longer matches the admitted Ec_Syn57 design."""


def sha256(path: Path) -> str:
    """Return a file's SHA-256 digest."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def require(condition: bool, message: str) -> None:
    """Raise a source-identity error when ``condition`` is false."""
    if not condition:
        raise Syn57BuildError(message)


def read_source(path: Path = SOURCE):
    """Read and fully validate the one admitted design record."""
    require(path.is_file(), f"missing pinned design source: {path}")
    require(path.stat().st_size == SOURCE_SIZE, "Ec_Syn57.gb byte length changed")
    require(sha256(path) == SOURCE_SHA256, "Ec_Syn57.gb SHA-256 changed")
    with warnings.catch_warnings():
        # The deposited LOCUS line omits one spacing column. Biopython recovers
        # every field used below; the explicit checks are the admission gate.
        warnings.simplefilter("ignore", BiopythonParserWarning)
        records = list(SeqIO.parse(path, "genbank"))
    require(len(records) == 1, f"expected one design record, found {len(records)}")
    record = records[0]
    require(record.id == "Ec_Syn57", f"unexpected record id {record.id!r}")
    require(len(record.seq) == 3_973_902, f"unexpected design length {len(record.seq)}")
    require(record.annotations.get("topology") == "circular", "design is not circular")
    require(record.annotations.get("accessions") == ["Ec_Syn57"], "design accession changed")
    require(record.annotations.get("organism") == "synthetic Escherichia coli Ec_Syn57",
            "design organism identity changed")
    require(record.description == "Revised sequence of synthetic 57-codon Escherichia coli strain, 2026",
            "design description changed")
    require(hashlib.sha256(bytes(record.seq)).hexdigest() == SEQUENCE_SHA256,
            "Ec_Syn57 design sequence SHA-256 changed")
    counts = Counter(feature.type for feature in record.features)
    require(dict(counts) == EXPECTED_FEATURE_COUNTS,
            f"design annotation counts changed: {dict(counts)}")
    return record


def stable_locus(feature, position: int, seen: Counter[str]) -> str:
    """Return a unique stable locus id without dropping duplicated design CDSs."""
    base = (feature.qualifiers.get("locus_tag")
            or feature.qualifiers.get("standard_name")
            or feature.qualifiers.get("gene"))
    require(bool(base), f"CDS feature {position} has no stable identifier")
    name = str(base[0]).strip()
    seen[name] += 1
    if seen[name] == 1:
        return name
    start = int(feature.location.start) + 1
    return f"{name}_copy_{start}"


def source_locus(feature) -> str | None:
    """Return the best source identifier without making an absent one up."""
    values = (feature.qualifiers.get("locus_tag")
              or feature.qualifiers.get("standard_name")
              or feature.qualifiers.get("gene"))
    return str(values[0]).strip() if values else None


def feature_key(feature) -> tuple[str | None, int, int, int | None]:
    """Identify a source feature by name and exact native location."""
    return (source_locus(feature), int(feature.location.start),
            int(feature.location.end), feature.location.strand)


def location_text(feature) -> str:
    """Return the one-based closed CDS location read by the feature builder."""
    parts = list(feature.location.parts) if isinstance(feature.location, CompoundLocation) else [feature.location]
    parts.sort(key=lambda part: int(part.start))
    spans = [f"{int(part.start) + 1}..{int(part.end)}" for part in parts]
    return f"join({','.join(spans)})" if len(spans) > 1 else spans[0]


def gff_attributes(values: dict[str, str]) -> str:
    """Encode a deterministic GFF3 attribute column."""
    return ";".join(f"{key}={quote(str(value), safe=':(),._-')}" for key, value in values.items())


def trna_model_annotation(feature) -> dict[str, str] | None:
    """Return one explicitly qualified route through the approximate tRNA model."""
    qualifiers = feature.qualifiers
    product = (qualifiers.get("product") or [""])[0]
    note = (qualifiers.get("note") or [""])[0]
    if note.startswith("tRNA-initiator Met("):
        return {
            "label": note.replace("U", "T"),
            "evidenceRoute": "explicit-initiator-anticodon-note",
            "inferenceMethod": (
                "explicit initiator anticodon note, with RNA U represented as DNA T; "
                "approximate annotation model, not an experimental anticodon or charging call"
            ),
        }
    match = re.search(r"codon recognized: ([ACGU]{3})", note)
    if match:
        codon = match.group(1).replace("U", "T")
        if product == "tRNA-Sec":
            return {
                "label": f"{product}(TCA)",
                "evidenceRoute": "selenocysteine-special-convention",
                "inferenceMethod": (
                    "Sec special convention from the source recognition note; excluded from "
                    "the elongator decoding pool and not an experimental anticodon or charging call"
                ),
            }
        anticodon = str(Seq(codon).reverse_complement())
        return {
            "label": f"{product}({anticodon})",
            "evidenceRoute": "codon-recognition-note-reverse-complement",
            "inferenceMethod": (
                "reverse complement of an ordinary source codon-recognition note; approximate "
                "annotation model, not an experimental anticodon or charging call"
            ),
        }
    return None


def local_protein_id(source_feature_index: int) -> str:
    """Return a deterministic local ID that cannot be mistaken for an accession."""
    return f"Ec_Syn57_local_protein_feature_{source_feature_index:05d}"


def translate_local_protein(cds: Seq) -> Seq:
    """Translate a design CDS using bacterial initiation and one terminal-stop trim."""
    residues = str(cds.translate(table=11, cds=False))
    if residues:
        residues = "M" + residues[1:]
    if residues.endswith("*"):
        residues = residues[:-1]
    return Seq(residues)


def gzip_text(path: Path, text: str) -> None:
    """Write reproducible gzip text (fixed header timestamp and filename)."""
    with path.open("wb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as zipped:
            zipped.write(text.encode("utf-8"))


def normalize(record, directory: Path) -> dict[str, int]:
    """Write the temporary NCBI-shaped inputs consumed by the shared builder."""
    organism = get_organism(ORGANISM_ID)
    prefix = organism.assemblyPrefix
    directory.mkdir(parents=True, exist_ok=True)
    sequence = str(record.seq).upper()
    fasta_record = SeqRecord(record.seq, id="Ec_Syn57", description="Ec_Syn57 complete design")
    from io import StringIO
    genome_handle = StringIO()
    SeqIO.write(fasta_record, genome_handle, "fasta")
    gzip_text(directory / f"{prefix}_genomic.fna.gz", genome_handle.getvalue())

    seen: Counter[str] = Counter()
    cds_loci: dict[tuple[str | None, int, int, int | None], str] = {}
    for position, feature in enumerate(record.features):
        if feature.type == "CDS":
            cds_loci[feature_key(feature)] = stable_locus(feature, position, seen)

    source_id_counts = Counter(source_locus(feature) for feature in record.features
                               if feature.type == "CDS")
    source_id_seen: Counter[str | None] = Counter()
    cds_audit = []
    for source_index, feature in enumerate(record.features):
        if feature.type != "CDS":
            continue
        source_id = source_locus(feature)
        source_id_seen[source_id] += 1
        basis = next((key for key in ("locus_tag", "standard_name", "gene")
                      if feature.qualifiers.get(key)), None)
        parts = [{"start": int(part.start) + 1, "end": int(part.end),
                  "strand": part.strand} for part in feature.location.parts]
        qualifiers = {}
        for key in ("locus_tag", "standard_name", "gene", "protein_id", "product",
                    "pseudo", "ribosomal_slippage", "transl_except"):
            if key in feature.qualifiers:
                qualifiers[key] = [str(value) for value in feature.qualifiers[key]]
        cds_audit.append({
            "sourceFeatureIndex": source_index,
            "localId": cds_loci[feature_key(feature)],
            "localDerivedProteinId": local_protein_id(source_index),
            "sourceIdentifier": source_id,
            "sourceIdentifierBasis": basis,
            "sourceIdentifierOccurrence": source_id_seen[source_id],
            "sourceIdentifierOccurrences": source_id_counts[source_id],
            "sourceQualifiers": qualifiers,
            "originalSourceProteinIds": [
                str(value) for value in feature.qualifiers.get("protein_id", [])
            ],
            "sourceLocation": str(feature.location),
            "parts": parts,
            "compound": isinstance(feature.location, CompoundLocation),
            "fuzzy": any(type(part.start).__name__ != "ExactPosition"
                         or type(part.end).__name__ != "ExactPosition"
                         for part in feature.location.parts),
        })

    trna_audit = []
    for source_index, feature in enumerate(record.features):
        if feature.type != "tRNA":
            continue
        source_note = (feature.qualifiers.get("note") or [None])[0]
        annotation = trna_model_annotation(feature)
        route = annotation["evidenceRoute"] if annotation else "unsupported"
        trna_audit.append({
            "sourceFeatureIndex": source_index,
            "sourceIdentifier": source_locus(feature),
            "gene": (feature.qualifiers.get("gene") or [None])[0],
            "product": (feature.qualifiers.get("product") or [None])[0],
            "sourceNote": source_note,
            "sourceAnticodonQualifier": (feature.qualifiers.get("anticodon") or [None])[0],
            "sourceLocation": str(feature.location),
            "evidenceRoute": route,
            "decodingPoolStatus": (
                "excluded-selenocysteine-special-convention"
                if route == "selenocysteine-special-convention"
                else "included-approximate-model"
                if annotation else "excluded-no-supported-note"
            ),
            "modeledAnticodonLabel": annotation["label"] if annotation else None,
            "inferenceMethod": annotation["inferenceMethod"] if annotation else None,
        })
    write_json(directory / SOURCE_AUDIT_NAME, {
        "schemaVersion": 1,
        "source": {"file": SOURCE.name, "sha256": SOURCE_SHA256,
                   "sequenceSha256": SEQUENCE_SHA256},
        "identifierPolicy": "Duplicate source identifiers retain their first spelling; later CDSs add _copy_<one-based-start>. Missing locus_tag values fall back only to the source standard_name or gene qualifier.",
        "cds": cds_audit,
        "trna": trna_audit,
    })

    cds_features = [feature for feature in record.features if feature.type == "CDS"]
    child_features = [
        feature for feature in record.features
        if feature.type in {"CDS", "tRNA", "rRNA", "ncRNA", "misc_RNA", "tmRNA"}
    ]
    source_genes = [feature for feature in record.features if feature.type == "gene"]
    gene_rows: list[tuple[object, str, object | None]] = []
    parent_by_child: dict[tuple[str | None, int, int, int | None], str] = {}
    used_loci = set(cds_loci.values())
    for position, gene_feature in enumerate(source_genes):
        base = source_locus(gene_feature)
        candidates = [
            feature for feature in child_features
            if source_locus(feature) == base
            and int(feature.location.start) >= int(gene_feature.location.start)
            and int(feature.location.end) <= int(gene_feature.location.end)
        ]
        exact = [feature for feature in candidates
                 if int(feature.location.start) == int(gene_feature.location.start)
                 and int(feature.location.end) == int(gene_feature.location.end)]
        child = exact[0] if len(exact) == 1 else (candidates[0] if len(candidates) == 1 else None)
        locus = cds_loci.get(feature_key(child)) if child is not None else None
        if locus is None:
            require(bool(base), f"gene feature {position} has no stable identifier")
            locus = (base if base not in used_loci
                     else f"{base}_copy_{int(gene_feature.location.start) + 1}")
        require(locus not in {row[1] for row in gene_rows},
                f"normalized gene id repeats: {locus}")
        gene_rows.append((gene_feature, locus, child))
        if child is not None:
            parent_by_child[feature_key(child)] = locus
        used_loci.add(locus)

    for feature in cds_features:
        key = feature_key(feature)
        if key not in parent_by_child:
            locus = cds_loci[key]
            gene_rows.append((feature, locus, feature))
            parent_by_child[key] = locus

    def parent_locus(feature) -> str | None:
        key = feature_key(feature)
        if key in parent_by_child:
            return parent_by_child[key]
        base = source_locus(feature)
        candidates = [
            (gene_feature, locus)
            for gene_feature, locus, _ in gene_rows
            if source_locus(gene_feature) == base
            and int(feature.location.start) >= int(gene_feature.location.start)
            and int(feature.location.end) <= int(gene_feature.location.end)
        ]
        if len(candidates) == 1:
            return candidates[0][1]
        return None

    gff_rows = ["##gff-version 3", f"##sequence-region Ec_Syn57 1 {len(sequence)}"]
    cds_records: list[SeqRecord] = []
    protein_records: list[SeqRecord] = []
    trna_route_counts: Counter[str] = Counter()
    for position, (feature, locus, child) in enumerate(gene_rows):
        kind = child.type if child is not None else "gene"
        pseudo = "pseudo" in feature.qualifiers or (
            child is not None and "pseudo" in child.qualifiers
        )
        biotype = "pseudogene" if pseudo else (
            "protein_coding" if kind == "CDS" else kind
        )
        attributes = {
            "ID": f"gene-{locus}",
            "locus_tag": locus,
            "gene_biotype": biotype,
        }
        gene_name = (feature.qualifiers.get("gene")
                     or feature.qualifiers.get("standard_name") or [None])[0]
        if gene_name:
            attributes["gene"] = gene_name
        if pseudo:
            attributes["pseudo"] = "true"
        for part in feature.location.parts:
            gff_rows.append("\t".join([
                "Ec_Syn57", "Nyerges2026", "pseudogene" if pseudo else "gene",
                str(int(part.start) + 1), str(int(part.end)), ".",
                "+" if part.strand == 1 else "-", ".", gff_attributes(attributes),
            ]))

    for position, feature in enumerate(record.features):
        if feature.type == "CDS":
            locus = cds_loci[feature_key(feature)]
            qualifiers = feature.qualifiers
            protein = local_protein_id(position)
            attributes = {
                "ID": f"cds-{locus}",
                "locus_tag": locus,
                "gene": (qualifiers.get("gene") or qualifiers.get("standard_name") or [locus])[0],
                "product": (qualifiers.get("product") or ["uncharacterized design CDS"])[0],
                "gene_biotype": "pseudogene" if "pseudo" in qualifiers else "protein_coding",
                "Parent": f"gene-{locus}",
            }
            attributes["protein_id"] = protein
            if "pseudo" in qualifiers:
                attributes["pseudo"] = "true"
            if "ribosomal_slippage" in qualifiers:
                attributes["exception"] = "ribosomal slippage"
            if qualifiers.get("transl_except"):
                attributes["transl_except"] = qualifiers["transl_except"][0]
            for part in feature.location.parts:
                gff_rows.append("\t".join([
                    "Ec_Syn57", "Nyerges2026", "CDS",
                    str(int(part.start) + 1), str(int(part.end)), ".",
                    "+" if part.strand == 1 else "-", "0", gff_attributes(attributes),
                ]))
            extracted = feature.extract(record.seq)
            description = " ".join([
                f"[locus_tag={locus}]",
                f"[gene={attributes['gene']}]",
                f"[product={attributes['product']}]",
                f"[location={location_text(feature)}]",
                f"[protein_id={protein}]",
                *(["[pseudo=true]"] if "pseudo" in qualifiers else []),
            ])
            cds_records.append(SeqRecord(extracted, id=f"cds-{position + 1}", description=description))
            if len(extracted) >= 3:
                protein_records.append(SeqRecord(
                    translate_local_protein(extracted), id=protein,
                    description=f"{locus} local derived translation",
                ))
        elif feature.type == "tRNA":
            annotation = trna_model_annotation(feature)
            route = annotation["evidenceRoute"] if annotation else "unsupported"
            trna_route_counts[route] += 1
            product = (feature.qualifiers.get("product") or [""])[0]
            if not annotation or not product:
                continue
            locus = (feature.qualifiers.get("locus_tag")
                     or feature.qualifiers.get("gene") or [f"trna-{position + 1}"])[0]
            parent = parent_locus(feature) or locus
            attributes = {"ID": f"rna-{locus}", "locus_tag": locus,
                          "product": product, "Note": annotation["label"],
                          "Parent": f"gene-{parent}"}
            gff_rows.append("\t".join([
                "Ec_Syn57", "Nyerges2026", "tRNA",
                str(int(feature.location.start) + 1), str(int(feature.location.end)), ".",
                "+" if feature.location.strand == 1 else "-", ".",
                gff_attributes(attributes),
            ]))
        elif feature.type in {"rRNA", "ncRNA", "misc_RNA", "tmRNA"}:
            locus = parent_locus(feature)
            if locus is None:
                continue
            attributes = {
                "ID": f"rna-{locus}",
                "locus_tag": locus,
                "Parent": f"gene-{locus}",
            }
            gene_name = (feature.qualifiers.get("gene")
                         or feature.qualifiers.get("standard_name") or [None])[0]
            if gene_name:
                attributes["gene"] = gene_name
            gff_rows.append("\t".join([
                "Ec_Syn57", "Nyerges2026", feature.type,
                str(int(feature.location.start) + 1), str(int(feature.location.end)), ".",
                "+" if feature.location.strand == 1 else "-", ".",
                gff_attributes(attributes),
            ]))

    require(len(cds_records) == organism.expectedCdsRecords,
            f"normalized CDS count changed: {len(cds_records)}")
    require(dict(trna_route_counts) == EXPECTED_TRNA_ANNOTATION_ROUTES,
            f"tRNA annotation routes changed: {dict(trna_route_counts)}")
    require(len(protein_records) == organism.expectedCdsRecords,
            f"normalized protein count changed: {len(protein_records)}")
    gzip_text(directory / f"{prefix}_genomic.gff.gz", "\n".join(gff_rows) + "\n")
    for suffix, records in (("cds_from_genomic.fna", cds_records),
                            ("protein.faa", protein_records)):
        handle = StringIO()
        SeqIO.write(records, handle, "fasta")
        gzip_text(directory / f"{prefix}_{suffix}.gz", handle.getvalue())
    (directory / f"{prefix}_assembly_report.txt").write_text(
        "# Organism name: synthetic Escherichia coli Ec_Syn57\n"
        "# Infraspecific name: design=Ec_Syn57 complete design (not a measured isolate)\n"
        "# Taxid: 562\n"
        "# Design source identifier: Ec_Syn57\n",
        encoding="utf-8",
    )
    return {"cds": len(cds_records), **dict(trna_route_counts)}


METHOD_CITATIONS = [{'id': 'sharp-li-cai',
  'citation': 'Sharp PM, Li WH. The codon adaptation index—a measure of directional '
              'synonymous codon usage bias, and its potential applications. Nucleic Acids '
              'Research 15, 1281–1295 (1987). doi:10.1093/nar/15.3.1281.',
  'url': 'https://doi.org/10.1093/nar/15.3.1281',
  'contribution': 'Defines CAI. The design uses its own 84-gene translation-machinery '
                  'reference set, a sequence-derived convention rather than measured '
                  'expression.',
  'downloads': []},
 {'id': 'dos-reis-tai',
  'citation': 'dos Reis M, Savva R, Wernisch L. Solving the riddle of codon usage '
              'preferences: a test for translational selection. Nucleic Acids Research 32, '
              '5036–5044 (2004). doi:10.1093/nar/gkh834.',
  'url': 'https://doi.org/10.1093/nar/gkh834',
  'contribution': 'Defines the tRNA adaptation index and wobble/zero-weight conventions. This '
                  'design uses the explicitly qualified approximate source-note annotation '
                  'model, not established genomic anticodons, charging or expression '
                  'measurements.',
  'downloads': []},
 {'id': 'soma-lysidine',
  'citation': 'Soma A et al. An RNA-modifying enzyme that governs both the codon and amino '
              'acid specificities of isoleucine tRNA. Molecular Cell 12, 689–698 (2003). '
              'doi:10.1016/S1097-2765(03)00346-0.',
  'url': 'https://doi.org/10.1016/S1097-2765(03)00346-0',
  'contribution': 'Supports the bacterial lysidine/TilS convention for Ile-CAT decoding ATA. '
                  'The design model applies this convention to interpreted source notes; it '
                  'is not a direct modification or charging measurement.',
  'downloads': []},
 {'id': 'wright-enc',
  'citation': 'Wright F. The ‘effective number of codons’ used in a gene. Gene 87, 23–29 '
              '(1990). doi:10.1016/0378-1119(90)90491-9.',
  'url': 'https://doi.org/10.1016/0378-1119(90)90491-9',
  'contribution': 'Defines ENC and its GC3-based expected curve. Short-family substitutions '
                  'remain labelled implementation conventions.',
  'downloads': []},
 {'id': 'coleman-codon-pairs',
  'citation': 'Coleman JR et al. Virus attenuation by genome-scale changes in codon pair '
              'bias. Science 320, 1784–1787 (2008). doi:10.1126/science.1155761.',
  'url': 'https://doi.org/10.1126/science.1155761',
  'contribution': 'Motivates the codon-pair log-odds feature. Scores are fitted to the design '
                  'sequence; no viral measurements or attenuation outcomes are transferred.',
  'downloads': []},
 {'id': 'umap',
  'citation': 'McInnes L, Healy J, Saul N, Großberger L. UMAP: Uniform Manifold Approximation '
              'and Projection. Journal of Open Source Software 3, 861 (2018). '
              'doi:10.21105/joss.00861; umap-learn software.',
  'url': 'https://doi.org/10.21105/joss.00861',
  'contribution': 'umap-learn computes the design risk-feature embedding. Proximity is a '
                  'visualization of calculated features, not evidence of shared function.',
  'downloads': []},
 {'id': 'scikit-learn',
  'citation': 'Pedregosa F et al. Scikit-learn: Machine Learning in Python. Journal of '
              'Machine Learning Research 12, 2825–2830 (2011).',
  'url': 'https://jmlr.org/papers/v12/pedregosa11a.html',
  'contribution': 'StandardScaler and PCA fit the design native codon coordinates. No '
                  'parent-fixed projection or empirical phenotype is inferred.',
  'downloads': []},
 {'id': 'viennarna',
  'citation': 'Lorenz R et al. ViennaRNA Package 2.0. Algorithms for Molecular Biology 6, 26 '
              '(2011). doi:10.1186/1748-7188-6-26; ViennaRNA 2.7.2.',
  'url': 'https://doi.org/10.1186/1748-7188-6-26',
  'contribution': 'ViennaRNA computes minimum-free-energy folds for design RNA windows and '
                  'recoded simulations. The browser ships the locally compiled 2.7.2 engine. '
                  'Credit to the ViennaRNA authors and the Institute for Theoretical '
                  'Chemistry, University of Vienna; its license and build record are retained '
                  'at site/vendor/viennarna/PROVENANCE.md.',
  'downloads': []},
 {'id': 'emscripten',
  'citation': 'Emscripten 4.0.15 and bundled runtime components: musl, LLVM compiler-rt, '
              'Joseph A. Adams’s JSON library, and Doug Lea’s dlmalloc; upstream licenses '
              'retained with the ViennaRNA browser build.',
  'url': 'https://emscripten.org/',
  'contribution': 'Emscripten compiled the ViennaRNA engine to WebAssembly and supplied its '
                  'JavaScript/runtime glue. The component-specific notices and licenses are '
                  'retained under site/vendor/viennarna/; this is software attribution, not a '
                  'source of biological data.',
  'downloads': []},
 {'id': 'biopython',
  'citation': 'Cock PJA et al. Biopython: freely available Python tools for computational '
              'molecular biology and bioinformatics. Bioinformatics 25, 1422–1423 (2009). '
              'doi:10.1093/bioinformatics/btp163.',
  'url': 'https://doi.org/10.1093/bioinformatics/btp163',
  'contribution': 'The data-build and consistency checks use Biopython to parse biological '
                  'sequence records, translate CDSs, and apply codon tables. No Biopython '
                  'code is bundled with the site.',
  'downloads': []},
 {'id': 'ncbi-genetic-code',
  'citation': 'NCBI. The Genetic Codes: The Bacterial, Archaeal and Plant Plastid Code '
              '(translation table 11).',
  'url': 'https://www.ncbi.nlm.nih.gov/datasets/docs/v2/data-processing/taxonomy-processing/genetic-codes/',
  'contribution': 'Defines bacterial codon assignments and initiation semantics for local '
                  'design translations and synonymous simulations. Local derived-protein '
                  'identifiers are not NCBI accessions.',
  'downloads': []},
 {'id': 'numpy',
  'citation': 'Harris CR et al. Array programming with NumPy. Nature 585, 357–362 (2020). '
              'doi:10.1038/s41586-020-2649-2.',
  'url': 'https://doi.org/10.1038/s41586-020-2649-2',
  'contribution': 'NumPy arrays support the feature build and independent consistency checks; '
                  'this package provides computation, not external gene measurements.',
  'downloads': []}]


def citations() -> dict:
    """Return the design-only source ledger copied into the viewer payload."""
    return {
        "sections": [
            {
                "id": "primary-data",
                "title": "Primary data",
                "description": "The publisher-deposited complete Ec_Syn57 design; no measured isolate or assay layer is attached.",
                "items": [
                    {
                        "id": "nyerges-2026-syn57-design",
                        "citation": "Nyerges A et al. Probing the limits of genetic recoding using multi-omics-guided evolution. Nature Communications (2026). doi:10.1038/s41467-026-74300-9.",
                        "url": "https://doi.org/10.1038/s41467-026-74300-9",
                        "contribution": "Publisher Source Data file Ec_Syn57.gb supplies the complete 3,973,902 bp circular design, its native coordinates and annotation. File SHA-256 8c61aeebfb8fef71a9d01ceba2a2acdb8babdf96ac0aa01aae36b10d08f77f96; sequence SHA-256 5ad86e64fa142b009c159dddd4c1eccf5cce6e8bafa8c374cbfb6e9bc8e07033. The article describes a complete E. coli genome and distinguishes it from a strain with a distinct recoding scheme. This is a design record, not a sequenced isolate; no omics, growth, fitness or partial-isolate measurement is assigned to it. The article is CC BY-NC-ND 4.0; this derived viewer payload follows the owner's citation-only admission decision of 2026-10-06.",
                        "downloads": [],
                    }
                ],
            },
            {
                "id": "methods-and-tools",
                "title": "Methods and tools",
                "description": "Sequence-derived calculations applied to the design, not measurements.",
                "items": METHOD_CITATIONS,
            },
        ]
    }


def write_json(path: Path, value: object) -> None:
    """Write compact deterministic JSON with one trailing newline."""
    path.write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n",
                    encoding="utf-8")


def build(source: Path = SOURCE, output: Path | None = None) -> dict[str, int]:
    """Build the admitted design payload and its content manifest."""
    record = read_source(source)
    organism = get_organism(ORGANISM_ID)
    output = output or organism.path("outputDirectory")
    with tempfile.TemporaryDirectory(prefix="syn57-design-") as temporary:
        normalized = Path(temporary)
        counts = normalize(record, normalized)
        build_features.build(normalized, output, organism=organism)
        meta_path = output / "meta.json"
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        for metric in meta["metrics"].values():
            if isinstance(metric.get("desc"), str):
                metric["desc"] = metric["desc"].replace(
                    "the RefSeq coding sequence", "the publisher-deposited Ec_Syn57 design CDS"
                )
        meta["metrics"]["tai"]["desc"] = (
            "tRNA adaptation index (dos Reis et al.), ranging from 0 to 1. Its approximate "
            "annotation model reverse-complements 75 ordinary codon-recognition notes, uses "
            "three explicit initiator anticodon notes, excludes one Sec special convention "
            "from the elongator pool, and excludes six unsupported tRNAs from the model. "
            "These are not "
            "established genomic anticodons or charging measurements; "
            f"{meta['metrics']['tai']['desc'].split(';')[-1].strip()}"
        )
        meta["metrics"]["minLocalTai"]["desc"] += (
            " Its tRNA pool uses the same qualified approximate annotation routes as tAI."
        )
        meta["metrics"]["expressionProxy"]["desc"] = (
            "Tie-aware average rank of sqrt(CAI × tAI) across all genes, scaled from 0 to 1; "
            "its tAI component uses the qualified approximate tRNA annotation model, and it "
            "is a codon-adaptation proxy, not measured transcript or protein abundance."
        )
        meta["tai"]["method"] = "dos Reis model over an approximate source-note-derived tRNA annotation model"
        meta["tai"]["annotationBasis"] = {
            "sourceAnticodonQualifiers": 0,
            "ordinaryCodonRecognitionNotesReverseComplemented": counts[
                "codon-recognition-note-reverse-complement"
            ],
            "explicitInitiatorAnticodonNotes": counts[
                "explicit-initiator-anticodon-note"
            ],
            "selenocysteineSpecialConventionExcludedFromElongatorPool": counts[
                "selenocysteine-special-convention"
            ],
            "excludedWithoutSupportedNote": counts["unsupported"],
            "modeledAnnotations": sum(
                counts[key] for key in EXPECTED_TRNA_ANNOTATION_ROUTES if key != "unsupported"
            ),
            "trnaCopyTableAnnotationsAfterSecExclusion": (
                counts["codon-recognition-note-reverse-complement"]
                + counts["explicit-initiator-anticodon-note"]
            ),
            "interpretation": "Defined approximate annotation model, not established genomic anticodons, decoding, charging, or expression measurements.",
        }
        meta["designSource"] = {
            "recordType": "complete-design",
            "file": SOURCE.name,
            "bytes": SOURCE_SIZE,
            "sha256": SOURCE_SHA256,
            "sequenceSha256": SEQUENCE_SHA256,
            "citationId": "nyerges-2026-syn57-design",
            "measuredIsolate": False,
            "featureAuditFile": SOURCE_AUDIT_NAME,
        }
        write_json(meta_path, meta)
        audit_path = normalized / SOURCE_AUDIT_NAME
        audit = json.loads(audit_path.read_text(encoding="utf-8"))
        admitted = {gene["id"] for gene in json.loads((output / "genes.json").read_text(encoding="utf-8"))}
        excluded = {row["id"]: row["reason"] for row in json.loads(
            (output / "excluded.json").read_text(encoding="utf-8")
        )}
        for row in audit["cds"]:
            local_id = row["localId"]
            row["publicationStatus"] = "included" if local_id in admitted else "excluded"
            row["exclusionReason"] = excluded.get(local_id)
        write_json(output / SOURCE_AUDIT_NAME, audit)
        overlap = build_gene_overlaps.build_payload(
            normalized / f"{organism.assemblyPrefix}_genomic.gff.gz", organism
        )
        (output / build_gene_overlaps.PAYLOAD_NAME).write_text(
            build_gene_overlaps.serialize(overlap), encoding="utf-8"
        )
    write_json(output / "citations.json", citations())
    build_data_manifest.write_manifest(output)
    return counts


def comparable_payload(name: str, content: bytes) -> object:
    """Normalize only the build timestamp and its manifest checksum dependency."""
    if name not in {"meta.json", "data-manifest.json"}:
        return content
    value = json.loads(content)
    if name == "meta.json":
        value.pop("builtAt", None)
    else:
        meta_entry = value.get("files", {}).get("meta.json")
        if isinstance(meta_entry, dict):
            meta_entry["sha256"] = "<builtAt-normalized>"
    return value


def payload_differences(expected: Path, rebuilt: Path) -> list[str]:
    """Return missing, unexpected, or content-different publication files."""
    before = {path.name: path.read_bytes() for path in expected.glob("*.json")}
    after = {path.name: path.read_bytes() for path in rebuilt.glob("*.json")}
    return [name for name in sorted(set(before) | set(after))
            if name not in before or name not in after
            or comparable_payload(name, before[name]) != comparable_payload(name, after[name])]


def validate_manifest(directory: Path, label: str) -> None:
    """Translate a publication-manifest failure into the builder's domain error."""
    try:
        build_data_manifest.check_manifest(directory)
    except build_data_manifest.DataManifestError as error:
        raise Syn57BuildError(f"{label} manifest is invalid: {error}") from error


def main(argv: list[str] | None = None) -> int:
    """Build or verify that a rebuild matches the shipped payload."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--check", action="store_true",
                        help="rebuild in a temporary output and compare, ignoring meta.builtAt")
    args = parser.parse_args(argv)
    organism = get_organism(ORGANISM_ID)
    if not args.check:
        counts = build(args.source)
        print(f"built {ORGANISM_ID}: {counts}")
        return 0
    expected = organism.path("outputDirectory")
    if not expected.is_dir():
        raise Syn57BuildError(f"missing shipped payload: {expected}")
    validate_manifest(expected, "shipped payload")
    with tempfile.TemporaryDirectory(prefix="syn57-check-") as temporary:
        rebuilt = Path(temporary) / "payload"
        build(args.source, rebuilt)
        validate_manifest(rebuilt, "rebuilt payload")
        changed = payload_differences(expected, rebuilt)
        require(not changed, f"rebuild differs for: {', '.join(changed)}")
    print(f"ok: {ORGANISM_ID} rebuild matches shipped payload")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (Syn57BuildError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
