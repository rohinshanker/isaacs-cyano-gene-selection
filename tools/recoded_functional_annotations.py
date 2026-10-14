#!/usr/bin/env python3
"""Rebuild conservative recoded functional annotations from admitted, pinned inputs.

No names or coordinates establish a join. Every accepted hop requires a unique
full-length identical protein on BOTH sides, including source CDSs omitted by
the viewer. Native fields and coordinates remain in genes.json unchanged.
"""
from __future__ import annotations

import argparse
import copy
import gzip
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from functools import lru_cache
from pathlib import Path

from Bio import SeqIO
from Bio.Seq import Seq

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site/data/organisms"
MG = "ecoli-k12-mg1655"
MDS = "ecoli-mds42-public-reference"
SYN57 = "ecoli-syn57-design"
SYN61 = "ecoli-syn61-delta3-ev5"
TARGETS = (SYN57, SYN61)
METHOD = "unique-full-length-identical-protein-v1"
PINS = {
    MG: ("GCF_000005845.2_ASM584v2_genomic.gbff.gz",
         "cbcc40a9859312cbcdbeb3df484ee471dfe354c5cd8f28056b48431353b28384"),
    MDS: ("GCF_000350185.1_ASM35018v1_genomic.gbff.gz",
          "f97a444efed9a31bf06541c2acb4cc6beed0487ae3f2e87d89315fe3954851d9"),
    SYN61: ("GCA_028355435.1_ASM2835543v1_genomic.gbff.gz",
            "f03f02d02fcbaff3bf83ad22be8335278efde58d94cee501e6a3b06216bc22c2"),
}
ASSEMBLIES = {MG: "GCF_000005845.2", MDS: "GCF_000350185.1",
              SYN61: "GCA_028355435.1", SYN57: "Ec_Syn57"}
MG_RELEASE = "GCF_000005845.2-UniProtGOA_2026-07-28"
MG_ARTIFACT_PINS = {
    "genes.json": "348e8b8ccbb9113fb45bbd504fa67092a631e2381c08d377b4452e91ea5ad388",
    "annotations.json": "dc060d80d1cf6bd3f3c390bef61b2662303bda0b5018ad3854e9ca39fccd53b1",
    "go-term-names-v1.json": "f15a0f0691e4ad9d623cfe4776b348a664b0787d0d7303e0039b35b99c2f8936",
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n",
                    encoding="utf-8")


def protein_hash(protein: str | None) -> str | None:
    return hashlib.sha256(protein.encode("ascii")).hexdigest() if protein else None


NATIVE_GO = re.compile(r"GO_(function|process|component): (GO:\d{7}) - (.*?) \[Evidence ([^\]]+)\]")


def native_go_relationships(notes: list[str]) -> list[dict]:
    """Parse only explicitly structured GO relationships in deposited CDS notes."""
    rows = []
    for note in notes:
        matches = list(NATIVE_GO.finditer(note))
        if note.count("GO:") != len(matches):
            raise ValueError("Native GO note contains an unsupported relationship format")
        for match in matches:
            kind, go_id, name, code = match.groups()
            rows.append({"goId": go_id, "nativeTermName": name,
                         "qualifier": "", "aspect": {"function": "F", "process": "P", "component": "C"}[kind],
                         "evidenceCode": code, "reference": "", "withFrom": "", "assignedBy": "",
                         "mappingAmbiguity": "", "mappingMethod": "native GenBank CDS note"})
    return rows


@lru_cache(maxsize=4)
def load_records(organism: str) -> tuple[list[dict], dict]:
    """Read all native CDSs, not only the plotted inclusion subset."""
    if organism == SYN57:
        from build_syn57_design import SOURCE, read_source, stable_locus, translate_local_protein
        path = SOURCE
        records = [read_source(path)]
    else:
        name, expected = PINS[organism]
        path = ROOT / "data/raw" / organism / name
        if digest(path) != expected:
            raise ValueError(f"{organism}: pinned GenBank checksum changed")
        with gzip.open(path, "rt") as handle:
            records = list(SeqIO.parse(handle, "genbank"))
    result = []
    seen = Counter()
    for record in records:
        for index, feature in enumerate(record.features):
            if feature.type != "CDS":
                continue
            q = feature.qualifiers
            locus = (stable_locus(feature, index, seen) if organism == SYN57
                     else (q.get("locus_tag") or [None])[0])
            if not locus:
                raise ValueError(f"{organism}: missing CDS locus")
            protein = (str(translate_local_protein(feature.extract(record.seq)))
                       if organism == SYN57 else (q.get("translation") or [None])[0])
            # Internal stops, pseudogenes, partial CDSs, and exceptional residues
            # cannot establish preserved ordinary protein identity.
            eligible = bool(protein) and not any(c in protein for c in "*XU")
            eligible = eligible and "pseudo" not in q and "pseudogene" not in q
            eligible = eligible and all(type(part.start).__name__ == "ExactPosition"
                                        and type(part.end).__name__ == "ExactPosition"
                                        for part in feature.location.parts)
            result.append({
                "id": locus, "name": (q.get("gene") or [None])[0],
                "product": (q.get("product") or [None])[0],
                "protein": protein if eligible else None,
                "proteinSha256": protein_hash(protein),
                "eligible": eligible, "seqid": record.id,
                "start": int(feature.location.start) + 1, "end": int(feature.location.end),
                "strand": "+" if feature.location.strand == 1 else "-",
                "sourceFeatureIndex": index, "nativeProteinId": (q.get("protein_id") or [None])[0],
                "nativeLocusTag": locus,
                "notes": q.get("note", []), "inferences": q.get("inference", []),
                "ecNumbers": q.get("EC_number", []), "geneSynonyms": q.get("gene_synonym", []),
                "nativeGoAnnotations": native_go_relationships(q.get("note", [])) if organism in TARGETS else [],
            })
    # RefSeq alternative CDSs share a locus. Keep all in the cardinality audit;
    # the longest keeps the canonical id, matching the existing viewer policy.
    by_locus = defaultdict(list)
    for row in result:
        by_locus[row["id"]].append(row)
    for locus, alternatives in by_locus.items():
        alternatives.sort(key=lambda r: (-(len(r["protein"] or "")), r["sourceFeatureIndex"]))
        for row in alternatives[1:]:
            row["id"] = f"{locus}__alternative_cds_{row['sourceFeatureIndex']}"
    source = {"organismId": organism, "assembly": ASSEMBLIES[organism],
              "file": str(path.relative_to(ROOT)), "sha256": digest(path),
              "recordRelease": [{"sequence": r.id, "date": r.annotations.get("date")}
                                for r in records]}
    return result, source


def exact_crosswalk(targets: list[dict], sources: list[dict]) -> dict[str, dict]:
    """Preserve cardinality; names only identify rejected audit candidates."""
    target_proteins, source_proteins = defaultdict(list), defaultdict(list)
    source_names, source_ids = defaultdict(list), {r["id"]: r for r in sources}
    for row in targets:
        if row.get("protein"):
            target_proteins[row["protein"]].append(row["id"])
    for row in sources:
        if row.get("protein"):
            source_proteins[row["protein"]].append(row["id"])
        if row.get("name"):
            source_names[row["name"]].append(row["id"])
    joined = {}
    for row in targets:
        candidates = source_proteins.get(row.get("protein"), [])
        copies = target_proteins.get(row.get("protein"), [])
        identity_candidates = sorted(set(source_names.get(row.get("name"), [])
                                         + ([row["id"]] if row["id"] in source_ids else [])))
        status = ("unsupported-protein" if not row.get("protein") else
                  "ambiguous-protein" if candidates and (len(candidates) != 1 or len(copies) != 1) else
                  "exact-protein" if candidates else
                  "modified-or-nonidentical-protein" if identity_candidates else "unmatched")
        joined[row["id"]] = {"status": status, "sourceLoci": candidates,
                             "targetCopies": copies,
                             "identityCandidatesNotJoined": identity_candidates if not candidates else [],
                             "proteinSha256": row.get("proteinSha256") or protein_hash(row.get("protein"))}
    return joined


def fill_fields(native: dict, sources: list[dict]) -> tuple[dict, list[dict]]:
    """Missing fields only; hypothetical/uncharacterized products are native values."""
    fields, disagreements = {}, []
    for key in ("name", "product"):
        candidates = [[row["id"], row[key]] for row in sources if row.get(key)]
        existing = native.get(key)
        if key == "name" and existing == native["id"]:
            existing = None  # deterministic viewer fallback, not a native symbol
        values = {value for _, value in candidates}
        if existing:
            values.add(existing)
        if len(values) > 1:
            disagreements.append({"field": key, "native": existing, "sources": candidates})
        if not existing and len(values) == 1:
            fields[key] = next(iter(values))
    return fields, disagreements


def generate(organism: str, output: Path) -> dict[str, object]:
    """Derive sidecars without changing any native gene or measurement payload."""
    targets, target_source = load_records(organism)
    mg, mg_source = load_records(MG)
    primary, primary_source = (mg, mg_source) if organism == SYN57 else load_records(MDS)
    primary_by_id, mg_by_id = {r["id"]: r for r in primary}, {r["id"]: r for r in mg}
    crosswalk = exact_crosswalk(targets, primary)
    bridge = exact_crosswalk(primary, mg) if organism == SYN61 else None
    mg_dir = SITE / MG
    for name, expected in MG_ARTIFACT_PINS.items():
        if digest(mg_dir / name) != expected:
            raise ValueError(f"MG1655 {name}: pinned consumer artifact changed")
    # Validate the published consumer against the admitted release artifacts.
    sys.path.insert(0, str(ROOT / "scripts"))
    from build_features import load_annotation_layer
    mg_genes = read_json(mg_dir / "genes.json")
    mg_annotations, release = load_annotation_layer(
        ROOT / "data/annotation/releases" / MG_RELEASE, {g["id"] for g in mg_genes})
    if mg_annotations != read_json(mg_dir / "annotations.json"):
        raise ValueError("MG1655 published annotations differ from the admitted release")
    go_names = read_json(mg_dir / "go-term-names-v1.json")
    genes = read_json(output / "genes.json")
    alphabet = {entry["sym"]: entry["codon"] for entry in read_json(output / "meta.json")["codonAlphabet"]}
    raw_by_id = {r["id"]: r for r in targets}
    annotations = {}
    for gene in genes:
        native = raw_by_id[gene["id"]]
        if any(gene[k] != native[k] for k in ("start", "end", "strand", "seqid")):
            raise ValueError(f"{gene['id']}: native identity differs from source")
        sequence = "".join(alphabet[sym] for sym in gene["codons"])
        protein = str(Seq(sequence).translate(table=11))
        protein = "M" + protein[1:]
        if native["eligible"] and protein != native["protein"]:
            raise ValueError(f"{gene['id']}: plotted protein differs from native source")
        match = crosswalk[gene["id"]]
        source_rows, hops = [], []
        mg_locus = None
        if match["status"] == "exact-protein":
            locus = match["sourceLoci"][0]
            source_rows.append(primary_by_id[locus])
            hops.append({**primary_source, "locusTag": primary_by_id[locus]["nativeLocusTag"],
                         "sourceCdsId": locus, "method": METHOD,
                         "proteinSha256": match["proteinSha256"], "identity": 1, "coverage": 1})
            if bridge is None:
                mg_locus = primary_by_id[locus]["nativeLocusTag"]
            elif bridge[locus]["status"] == "exact-protein":
                mg_row = mg_by_id[bridge[locus]["sourceLoci"][0]]
                mg_locus = mg_row["nativeLocusTag"]
                source_rows.append(mg_row)
                hops.append({**mg_source, "locusTag": mg_locus, "sourceCdsId": mg_row["id"], "method": METHOD,
                             "proteinSha256": match["proteinSha256"], "identity": 1, "coverage": 1})
        native_fields = {**gene, "name": native["name"], "product": native["product"]}
        fields, disagreements = fill_fields(native_fields, source_rows)
        evidence = copy.deepcopy(mg_annotations.get(mg_locus, {}))
        inherited_go = evidence.get("goAnnotations", [])
        curated = evidence.get("curatedFunction")
        withheld_go = sum(bool(row.get("mappingAmbiguity")) for row in inherited_go)
        withheld_curated = bool(curated and curated.get("mappingAmbiguity"))
        # Ambiguous UniProt mappings cannot become unambiguous by transfer.
        inherited_go = [row for row in inherited_go if not row.get("mappingAmbiguity")]
        native_go = native["nativeGoAnnotations"]
        go = native_go or inherited_go
        if native_go and inherited_go:
            native_ids = sorted({row["goId"] for row in native_go})
            inherited_ids = sorted({row["goId"] for row in inherited_go})
            if native_ids != inherited_ids:
                disagreements.append({"field": "goAnnotations", "native": ", ".join(native_ids),
                                      "sources": [[mg_locus, ", ".join(inherited_ids)]]})
        if curated and curated.get("mappingAmbiguity"):
            curated = None
        annotations[gene["id"]] = {
            "goAnnotations": go, "curatedFunction": curated,
            "goAnnotationsOrigin": "native-source" if native_go else "inherited-reference" if go else None,
            "nativeAnnotation": {"source": target_source, "notes": native["notes"],
                                 "inferences": native["inferences"], "ecNumbers": native["ecNumbers"],
                                 "geneSynonyms": native["geneSynonyms"], "product": native["product"]},
            "functionalTransfer": {
                "schemaVersion": 1, "targetAssembly": ASSEMBLIES[organism],
                "status": match["status"],
                "native": {k: gene.get(k) for k in ("id", "name", "product", "seqid", "start", "end", "strand")},
                "nativeSymbol": native["name"], "sources": hops,
                "nativeProduct": native["product"],
                "nativeGoCount": len(native_go),
                "withheldAmbiguousGoRows": withheld_go,
                "withheldAmbiguousCuratedFunction": withheld_curated,
                "annotationRelease": MG_RELEASE if mg_locus in mg_annotations else None,
                "fields": fields, "disagreements": disagreements,
                "inheritedFields": list(fields) + (["goAnnotations"] if inherited_go and not native_go else [])
                                   + (["curatedFunction"] if curated else []),
                "categoryStatus": "unknown-no-admitted-category",
            },
        }
    used_go = {r["goId"] for a in annotations.values() for r in a["goAnnotations"]}
    names = copy.deepcopy(go_names)
    names["terms"] = {key: value for key, value in names["terms"].items() if key in used_go}
    for a in annotations.values():
        for row in a["goAnnotations"]:
            if row["goId"] not in names["terms"] and row.get("nativeTermName"):
                names["terms"][row["goId"]] = {"name": row["nativeTermName"], "isObsolete": None,
                                              "nameSource": "native GenBank CDS note; ontology obsolescence unchecked"}
    names["source"]["functionalTransfer"] = {"targetAssembly": ASSEMBLIES[organism], "method": METHOD}
    names["source"]["nativeSupplementalNames"] = target_source if any(
        term.get("isObsolete") is None for term in names["terms"].values()) else None
    counts = Counter(row["status"] for row in crosswalk.values())
    matched = {r["sourceLoci"][0] for r in crosswalk.values() if r["status"] == "exact-protein"}
    def inventory(rows):
        return {"genes": len(rows), "missingSymbols": sum(not g.get("name") or g["name"] == g["id"] for g in rows),
                "missingProducts": sum(not raw_by_id[g["id"]].get("product") for g in rows),
                "withGo": sum(bool(raw_by_id[g["id"]]["nativeGoAnnotations"]) for g in rows),
                "withEcNumbers": sum(bool(raw_by_id[g["id"]]["ecNumbers"]) for g in rows),
                "withNotes": sum(bool(raw_by_id[g["id"]]["notes"]) for g in rows),
                "withGeneSynonyms": sum(bool(raw_by_id[g["id"]]["geneSynonyms"]) for g in rows),
                "withCategories": 0}
    audit = {
        "schemaVersion": 1, "target": target_source, "references": [primary_source] + ([mg_source] if bridge is not None else []),
        "method": METHOD, "scope": "functional-annotation-only; no recoded measurements or lab review",
        "referenceBoundary": "Public reference records; exact experimental parental stock equality is not asserted.",
        "sourceAnnotationRelease": release,
        "sourceArtifacts": {name: digest(mg_dir / name) for name in
                            ("genes.json", "annotations.json", "go-term-names-v1.json")},
        "nativeInventory": {"allCds": inventory(targets), "plottedCds": inventory(genes)},
        "summary": {"allCdsStatuses": dict(sorted(counts.items())), "plottedGenes": len(genes),
                    "withTransferredSymbols": sum("name" in a["functionalTransfer"]["fields"] for a in annotations.values()),
                    "withTransferredProducts": sum("product" in a["functionalTransfer"]["fields"] for a in annotations.values()),
                    "withTransferredGo": sum(a["goAnnotationsOrigin"] == "inherited-reference" for a in annotations.values()),
                    "withNativeGo": sum(a["goAnnotationsOrigin"] == "native-source" for a in annotations.values()),
                    "withGo": sum(bool(a["goAnnotations"]) for a in annotations.values()),
                    "goRelationships": sum(len(a["goAnnotations"]) for a in annotations.values()),
                    "withTransferredUniProtEntry": sum(bool(a["curatedFunction"]) for a in annotations.values()),
                    "withTransferredFunctionText": sum(bool((a["curatedFunction"] or {}).get("function")) for a in annotations.values()),
                    "withCategories": 0,
                    "disagreements": sum(bool(a["functionalTransfer"]["disagreements"]) for a in annotations.values()),
                    "withheldAmbiguousGoRows": sum(a["functionalTransfer"]["withheldAmbiguousGoRows"] for a in annotations.values()),
                    "withheldAmbiguousCuratedFunctions": sum(a["functionalTransfer"]["withheldAmbiguousCuratedFunction"] for a in annotations.values())},
        "targetCrosswalk": crosswalk, "referenceToMg1655Crosswalk": bridge,
        "referenceWithoutAcceptedTarget": [{"locusTag": r["id"], "name": r["name"],
                                             "proteinSha256": r["proteinSha256"],
                                             "status": "absent-or-altered-no-exact-counterpart"}
                                            for r in primary if r["id"] not in matched],
        "absenceCaveat": "No exact counterpart is not proof of deletion; altered proteins and annotation differences also cause misses.",
    }
    documents = {"annotations.json": annotations, "go-term-names-v1.json": names,
                 "functional_annotation_audit.json": audit}
    if (output / "citations.json").is_file():
        citations = read_json(output / "citations.json")
        citations["sections"] = [s for s in citations["sections"] if s["id"] != "inherited-functional-annotations"]
        wanted = {"ncbi-ecoli-k12-mg1655", "ecocyc", "blattner-1997", "uniprotkb-ecoli", "goa-ecoli"}
        items = [item for section in read_json(mg_dir / "citations.json")["sections"]
                 for item in section["items"] if item["id"] in wanted]
        if organism == SYN61:
            items += [item for section in read_json((SITE / MDS) / "citations.json")["sections"]
                      for item in section["items"] if item["id"] == "ncbi-ecoli-mds42-public-reference"]
        citations["sections"].append({"id": "inherited-functional-annotations",
            "title": "Inherited functional annotations",
            "description": "Admitted reference annotations transferred through unique full-length identical proteins. No recoded measurement, lab review, category inference or exact experimental parent claim.",
            "items": items})
        documents["citations.json"] = citations
    return documents


def publish(organism: str, output: Path) -> dict:
    documents = generate(organism, output)
    for name, content in documents.items():
        if name == "citations.json" and organism == SYN61:
            (output / name).write_text(json.dumps(content, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        else:
            write_json(output / name, content)
    import build_data_manifest
    build_data_manifest.write_manifest(output)
    return documents["functional_annotation_audit.json"]["summary"]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--organism", choices=TARGETS)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    for organism in (args.organism,) if args.organism else TARGETS:
        output = SITE / organism
        if args.check:
            for name, data in generate(organism, output).items():
                if read_json(output / name) != data:
                    raise ValueError(f"{organism}: {name} is stale")
            import build_data_manifest
            build_data_manifest.check_manifest(output)
        else:
            print(organism, json.dumps(publish(organism, output), sort_keys=True))


if __name__ == "__main__":
    main()
