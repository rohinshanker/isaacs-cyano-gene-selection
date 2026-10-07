#!/usr/bin/env python3
"""Build the REL606 to MG1655 ortholog crosswalk.

The AG3C series (Houser 2015, Caglar 2017) is the only *E. coli* dataset found
by package P-ECOLI-OMICS that measures transcript and protein abundance from
aliquots of the same flasks, in biological triplicate. It is measured in
*E. coli* B str. REL606 and keyed by `ECB_` locus tags, so placing it beside this
viewer's K-12 MG1655 genes needs a documented ortholog crosswalk.

**Why not the repository's existing rule.** The cyanobacterial crosswalk joins on
an identical RefSeq `WP_` accession. That cannot work here: MG1655's curated
record uses `NP_` accessions, so no protein accession is ever shared with REL606.
Tier 1 applies the same criterion at the sequence level instead, because a `WP_`
accession is by definition one identical protein sequence.

**Why no aligner is installed.** 97% of the proteins left after tier 1 have an
equal-length counterpart, because orthologs between two *E. coli* strains differ
by point substitutions far more often than by indels. An equal-length comparison
is exact rather than approximate, and needs no alignment at all. Only the
remainder is aligned, which is a few thousand alignments and a few seconds.

Tiers, strictest first. A locus is assigned by the first tier that claims it.

1. **Identical protein sequence**, unique on both sides. A sequence held by two
   loci on either side is left unassigned rather than resolved by guess.
2. **Equal length, ungapped identity at or above 90%**, reciprocal best on both
   sides, with no equal-scoring alternative.
3. **Gapped alignment** for the rest, over k-mer-prefiltered candidates:
   identity at or above 50% and coverage at or above 60%, reciprocal best.

Gene order is an independent check, never a criterion: a pair is syntenic when at
least one of its six neighbours maps within six loci of its partner. The
separation between the tiers' synteny rates is what justifies the thresholds.

Usage::

    tools/rel606_crosswalk.py             # write the crosswalk
    tools/rel606_crosswalk.py --report    # print the summary, write nothing
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import sys
from collections import Counter, defaultdict
from pathlib import Path

from Bio import SeqIO
from Bio.Align import PairwiseAligner, substitution_matrices

ROOT = Path(__file__).resolve().parents[1]
REL_DIR = ROOT / "data/raw/rel606"
MG_DIR = ROOT / "data/raw/ecoli-k12-mg1655"
REL_PROTEINS = REL_DIR / "GCF_000017985.1_ASM1798v1_protein.faa.gz"
REL_FEATURES = REL_DIR / "GCF_000017985.1_ASM1798v1_feature_table.txt.gz"
REL_GFF = REL_DIR / "GCF_000017985.1_ASM1798v1_genomic.gff.gz"
MG_PROTEINS = MG_DIR / "GCF_000005845.2_ASM584v2_protein.faa.gz"
MG_FEATURES = MG_DIR / "GCF_000005845.2_ASM584v2_feature_table.txt.gz"
OUT = ROOT / "data/annotation/rel606-mg1655-crosswalk-v1.tsv"

#: Pinned assemblies. REL606 was verified against NCBI's own md5 manifest on
#: retrieval; MG1655 is the repository's existing pinned genome of record.
REL_ASSEMBLY = "GCF_000017985.1"
MG_ASSEMBLY = "GCF_000005845.2"

IDENTITY_EQUAL_LENGTH = 0.90
IDENTITY_GAPPED = 0.50
COVERAGE_GAPPED = 0.60
KMER = 5
CANDIDATES = 8
NEIGHBOURHOOD = 6

RELATIONSHIP = "rel606_ortholog"
NAMESPACE = "REL606_locus_tag"
#: The AG3C matrices are keyed by the 2009 annotation's tags, so the crosswalk
#: carries the legacy form as its own relationship, as the cyanobacterial
#: crosswalk does for PCC 7942.
LEGACY_RELATIONSHIP = "rel606_old_locus_tag"
LEGACY_NAMESPACE = "REL606_legacy_locus_tag"


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_proteins(path: Path) -> dict[str, str]:
    with gzip.open(path, "rt") as handle:
        return {record.id: str(record.seq) for record in SeqIO.parse(handle, "fasta")}


def read_features(path: Path) -> tuple[dict[str, str], dict[str, int]]:
    """Protein accession to locus tag, and locus tag to its order on the genome."""
    tag_of: dict[str, str] = {}
    located: list[tuple[str, int, str]] = []
    with gzip.open(path, "rt") as handle:
        for row in csv.DictReader(handle, delimiter="\t"):
            if row.get("# feature") != "CDS":
                continue
            accession = (row.get("product_accession") or "").strip()
            tag = (row.get("locus_tag") or "").strip()
            start = (row.get("start") or "").strip()
            if not tag:
                continue
            if accession:
                tag_of[accession] = tag
            if start.isdigit():
                located.append((tag, int(start), row.get("genomic_accession", "")))
    located.sort(key=lambda item: (item[2], item[1]))
    order = {tag: index for index, (tag, _, _) in enumerate(located)}
    return tag_of, order


def read_legacy_tags(path: Path = REL_GFF) -> dict[str, str]:
    """Current REL606 locus tag to the 2009 annotation's tag.

    A current locus naming two legacy tags, or a legacy tag reached by two
    current loci, is dropped: the AG3C matrices are keyed by the legacy form, so
    an ambiguous pairing would send one study's values to the wrong gene.
    """
    forward: dict[str, set[str]] = defaultdict(set)
    with gzip.open(path, "rt") as handle:
        for line in handle:
            if line.startswith("#"):
                continue
            columns = line.rstrip("\n").split("\t")
            if len(columns) < 9 or columns[2] != "gene":
                continue
            attributes = dict(
                part.split("=", 1) for part in columns[8].split(";") if "=" in part
            )
            tag, legacy = attributes.get("locus_tag"), attributes.get("old_locus_tag")
            if tag and legacy:
                forward[tag].update(legacy.split(","))
    reverse: dict[str, set[str]] = defaultdict(set)
    for tag, legacies in forward.items():
        for legacy in legacies:
            reverse[legacy].add(tag)
    return {
        tag: next(iter(legacies))
        for tag, legacies in forward.items()
        if len(legacies) == 1 and len(reverse[next(iter(legacies))]) == 1
    }


def kmer_set(sequence: str, k: int = KMER) -> set[str]:
    return {sequence[i : i + k] for i in range(len(sequence) - k + 1)}


def ungapped_identity(a: str, b: str) -> float:
    """Fraction of identical positions. Only meaningful for equal lengths."""
    if len(a) != len(b) or not a:
        return 0.0
    return sum(1 for x, y in zip(a, b) if x == y) / len(a)


def _best(scores: list[tuple[float, str]]) -> tuple[float, str | None]:
    """The single best score, or a tie reported as no winner."""
    if not scores:
        return (0.0, None)
    scores.sort(key=lambda item: -item[0])
    if len(scores) > 1 and scores[0][0] == scores[1][0]:
        return (scores[0][0], None)
    return scores[0]


def tier_one(rel: dict[str, str], mg: dict[str, str]) -> tuple[dict[str, str], set[str]]:
    """Identical sequence, unique on both sides."""
    rel_by_sequence: dict[str, list[str]] = defaultdict(list)
    mg_by_sequence: dict[str, list[str]] = defaultdict(list)
    for key, sequence in rel.items():
        rel_by_sequence[sequence].append(key)
    for key, sequence in mg.items():
        mg_by_sequence[sequence].append(key)
    pairs: dict[str, str] = {}
    ambiguous: set[str] = set()
    for sequence in set(rel_by_sequence) & set(mg_by_sequence):
        left, right = rel_by_sequence[sequence], mg_by_sequence[sequence]
        if len(left) == 1 and len(right) == 1:
            pairs[left[0]] = right[0]
        else:
            ambiguous.update(left)
    return pairs, ambiguous


def tier_two(rel: dict[str, str], mg: dict[str, str]) -> dict[str, str]:
    """Equal length, high ungapped identity, reciprocal best, no tie."""
    mg_by_length: dict[int, list[str]] = defaultdict(list)
    for key, sequence in mg.items():
        mg_by_length[len(sequence)].append(key)
    rel_by_length: dict[int, list[str]] = defaultdict(list)
    for key, sequence in rel.items():
        rel_by_length[len(sequence)].append(key)

    forward: dict[str, str] = {}
    for key, sequence in rel.items():
        score, winner = _best([
            (ungapped_identity(sequence, mg[c]), c)
            for c in mg_by_length.get(len(sequence), ())
        ])
        if winner and score >= IDENTITY_EQUAL_LENGTH:
            forward[key] = winner
    reverse: dict[str, str] = {}
    for key, sequence in mg.items():
        score, winner = _best([
            (ungapped_identity(sequence, rel[c]), c)
            for c in rel_by_length.get(len(sequence), ())
        ])
        if winner and score >= IDENTITY_EQUAL_LENGTH:
            reverse[key] = winner
    return {k: v for k, v in forward.items() if reverse.get(v) == k}


def _aligner() -> PairwiseAligner:
    aligner = PairwiseAligner()
    aligner.substitution_matrix = substitution_matrices.load("BLOSUM62")
    aligner.open_gap_score = -11
    aligner.extend_gap_score = -1
    aligner.mode = "global"
    return aligner


def _alignment_identity(aligner: PairwiseAligner, a: str, b: str) -> tuple[float, float]:
    """Identity over the alignment, and coverage of the shorter sequence."""
    try:
        alignment = aligner.align(a, b)[0]
    except (ValueError, IndexError):
        return (0.0, 0.0)
    top, bottom = str(alignment[0]), str(alignment[1])
    matches = sum(1 for x, y in zip(top, bottom) if x == y and x != "-")
    aligned = sum(1 for x, y in zip(top, bottom) if x != "-" and y != "-")
    shorter = min(len(a), len(b)) or 1
    return (matches / shorter, aligned / shorter)


def tier_three(rel: dict[str, str], mg: dict[str, str]) -> dict[str, str]:
    """Gapped alignment over k-mer-prefiltered candidates, reciprocal best."""
    aligner = _aligner()
    mg_kmers = {key: kmer_set(sequence) for key, sequence in mg.items()}
    rel_kmers = {key: kmer_set(sequence) for key, sequence in rel.items()}

    def best_against(sequence: str, kmers: set[str], pool: dict[str, str],
                     pool_kmers: dict[str, set[str]]) -> tuple[float, str | None]:
        ranked = sorted(pool_kmers, key=lambda c: -len(kmers & pool_kmers[c]))[:CANDIDATES]
        scores = []
        for candidate in ranked:
            identity, coverage = _alignment_identity(aligner, sequence, pool[candidate])
            if identity >= IDENTITY_GAPPED and coverage >= COVERAGE_GAPPED:
                scores.append((identity, candidate))
        return _best(scores)

    forward = {}
    for key, sequence in rel.items():
        _, winner = best_against(sequence, rel_kmers[key], mg, mg_kmers)
        if winner:
            forward[key] = winner
    reverse = {}
    for key, sequence in mg.items():
        _, winner = best_against(sequence, mg_kmers[key], rel, rel_kmers)
        if winner:
            reverse[key] = winner
    return {k: v for k, v in forward.items() if reverse.get(v) == k}


def syntenic(pairs: dict[str, str], rel_order: dict[str, int],
             mg_order: dict[str, int]) -> set[str]:
    """Pairs with at least one neighbour mapping near the partner."""
    by_rel_index = {rel_order[k]: k for k in pairs if k in rel_order}
    out: set[str] = set()
    for tag, partner in pairs.items():
        index, target = rel_order.get(tag), mg_order.get(partner)
        if index is None or target is None:
            continue
        for offset in range(-NEIGHBOURHOOD // 2, NEIGHBOURHOOD // 2 + 1):
            if offset == 0:
                continue
            neighbour = by_rel_index.get(index + offset)
            if neighbour is None:
                continue
            neighbour_target = mg_order.get(pairs[neighbour])
            if neighbour_target is not None and abs(neighbour_target - target) <= NEIGHBOURHOOD:
                out.add(tag)
                break
    return out


def build(report_only: bool, out: Path) -> int:
    for path in (REL_PROTEINS, REL_FEATURES, MG_PROTEINS, MG_FEATURES):
        if not path.is_file():
            raise SystemExit(f"{path} is missing; see the module docstring")

    rel_proteins = read_proteins(REL_PROTEINS)
    mg_proteins = read_proteins(MG_PROTEINS)
    rel_tags, rel_order = read_features(REL_FEATURES)
    legacy_of = read_legacy_tags()
    mg_tags, mg_order = read_features(MG_FEATURES)

    def by_tag(proteins: dict[str, str], tags: dict[str, str]) -> dict[str, str]:
        out_map: dict[str, str] = {}
        for accession, sequence in proteins.items():
            tag = tags.get(accession)
            if tag and tag not in out_map:
                out_map[tag] = sequence
        return out_map

    rel = by_tag(rel_proteins, rel_tags)
    mg = by_tag(mg_proteins, mg_tags)
    print(f"REL606 loci with a protein: {len(rel)}  MG1655: {len(mg)}")

    assigned: dict[str, tuple[str, str]] = {}
    one, ambiguous = tier_one(rel, mg)
    for key, value in one.items():
        assigned[key] = (value, "exact_sequence")

    remaining_rel = {k: v for k, v in rel.items() if k not in assigned and k not in ambiguous}
    taken = {v for v, _ in assigned.values()}
    remaining_mg = {k: v for k, v in mg.items() if k not in taken}
    two = tier_two(remaining_rel, remaining_mg)
    for key, value in two.items():
        assigned[key] = (value, "equal_length_reciprocal_best")

    remaining_rel = {k: v for k, v in remaining_rel.items() if k not in two}
    taken = {v for v, _ in assigned.values()}
    remaining_mg = {k: v for k, v in mg.items() if k not in taken}
    three = tier_three(remaining_rel, remaining_mg)
    for key, value in three.items():
        assigned[key] = (value, "gapped_reciprocal_best")

    pairs = {k: v for k, (v, _) in assigned.items()}
    syn = syntenic(pairs, rel_order, mg_order)
    tiers = Counter(method for _, method in assigned.values())
    print(f"tier 1 exact sequence              : {tiers['exact_sequence']}")
    print(f"tier 2 equal length, reciprocal    : {tiers['equal_length_reciprocal_best']}")
    print(f"tier 3 gapped, reciprocal          : {tiers['gapped_reciprocal_best']}")
    print(f"total one-to-one pairs             : {len(pairs)}"
          f"  ({100*len(pairs)/len(rel):.1f}% of REL606, {100*len(pairs)/len(mg):.1f}% of MG1655)")
    reached_legacy = sum(1 for tag in pairs if tag in legacy_of)
    print(f"pairs reaching a 2009 legacy tag   : {reached_legacy}"
          f"  (what the AG3C matrices are keyed by)")
    print(f"ambiguous, identical paralogs      : {len(ambiguous)}")
    print(f"REL606 loci with no partner        : {len(rel) - len(pairs) - len(ambiguous)}")
    for method in ("exact_sequence", "equal_length_reciprocal_best", "gapped_reciprocal_best"):
        members = [k for k, (_, m) in assigned.items() if m == method]
        if members:
            rate = 100 * sum(1 for k in members if k in syn) / len(members)
            print(f"  syntenic, {method:<30}: {rate:.1f}%")

    assert len(set(pairs.values())) == len(pairs), "a MG1655 locus was claimed twice"
    if report_only:
        return 0

    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, delimiter="\t", lineterminator="\n")
        writer.writerow([
            "subject_locus_tag", "relationship", "object_namespace", "object_id",
            "mapping_ambiguity", "source", "evidence", "mapping_method", "syntenic",
        ])
        for tag in sorted(pairs, key=lambda t: rel_order.get(t, 1 << 30)):
            partner, method = assigned[tag]
            evidence = f"{MG_ASSEMBLY} and {REL_ASSEMBLY} RefSeq protein sets"
            writer.writerow([
                partner, RELATIONSHIP, NAMESPACE, tag, "",
                evidence, method, method, "yes" if tag in syn else "no",
            ])
            legacy = legacy_of.get(tag)
            if legacy:
                writer.writerow([
                    partner, LEGACY_RELATIONSHIP, LEGACY_NAMESPACE, legacy, "",
                    evidence, method, method, "yes" if tag in syn else "no",
                ])
        for tag in sorted(ambiguous, key=lambda t: rel_order.get(t, 1 << 30)):
            writer.writerow([
                "", RELATIONSHIP, NAMESPACE, tag, "identical-paralogs",
                f"{MG_ASSEMBLY} and {REL_ASSEMBLY} RefSeq protein sets",
                "", "", "",
            ])
    print(f"wrote {out} with {len(pairs)} pairs and {len(ambiguous)} ambiguity rows")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=OUT)
    parser.add_argument("--report", action="store_true")
    args = parser.parse_args(argv)
    return build(args.report, args.out)


if __name__ == "__main__":
    sys.exit(main())
