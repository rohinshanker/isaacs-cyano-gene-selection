"""Tests for the overlapping-gene layer, ``tools/build_gene_overlaps.py``.

Every case the owner's definition has to decide is a synthetic GFF3 written
here and read through the real producer: what counts as a gene, what a gene
occupies, and which pairs share a base. The genomes are tiny on purpose, so
each expectation is a coordinate a reader can check by hand.
"""

from __future__ import annotations

import gzip
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
sys.path.insert(0, str(ROOT / "scripts"))
import build_gene_overlaps as producer  # noqa: E402
from organisms import OrganismConfig  # noqa: E402


class FakeOrganism:
    """The two configuration fields the producer reads, and nothing else."""

    def __init__(self, accession: str = "GCF_000000000.1", prefix: str = "ASM0v1") -> None:
        self.accession = accession
        self.assemblyPrefix = prefix
        self.organism_id = "test-organism"


def attributes(**fields: str) -> str:
    return ";".join(f"{key}={value}" for key, value in fields.items())


def gff(rows: list[tuple], lengths: dict[str, int]) -> str:
    """A minimal NCBI-shaped GFF3 from sequence regions and feature rows."""
    lines = ["##gff-version 3"]
    for seqid, length in lengths.items():
        lines.append(f"##sequence-region {seqid} 1 {length}")
    for seqid, kind, start, end, strand, attrs in rows:
        lines.append("\t".join([
            seqid, "RefSeq", kind, str(start), str(end), ".", strand, ".", attrs,
        ]))
    return "\n".join(lines) + "\n"


def gene(locus: str, seqid: str, start: int, end: int, strand: str, biotype: str = "protein_coding",
         kind: str = "gene") -> tuple:
    return (seqid, kind, start, end, strand, attributes(
        ID=f"gene-{locus}", Name=locus, gene_biotype=biotype, locus_tag=locus,
    ))


def child(locus: str, seqid: str, start: int, end: int, strand: str, kind: str = "CDS",
          index: int = 1) -> tuple:
    return (seqid, kind, start, end, strand, attributes(
        ID=f"{kind.lower()}-{locus}-{index}", Parent=f"gene-{locus}", locus_tag=locus,
    ))


def exon(locus: str, seqid: str, start: int, end: int, strand: str, parent_kind: str,
         index: int = 1) -> tuple:
    return (seqid, "exon", start, end, strand, attributes(
        ID=f"exon-{locus}-{index}", Parent=f"{parent_kind.lower()}-{locus}-1", locus_tag=locus,
    ))


def build(rows: list[tuple], lengths: dict[str, int]) -> dict:
    """Runs the real producer over a synthetic annotation."""
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "ASM0v1_genomic.gff.gz"
        with gzip.open(path, "wt", encoding="utf-8") as handle:
            handle.write(gff(rows, lengths))
        return producer.build_payload(path, FakeOrganism())


def relations(payload: dict) -> dict[tuple[str, str], list[list[int]]]:
    """Published pairs keyed by the two locus tags, for readable assertions."""
    features = payload["features"]
    return {
        tuple(sorted((features[first]["id"], features[second]["id"]))): pieces
        for first, second, pieces in payload["pairs"]
    }


class SegmentsTest(unittest.TestCase):
    def test_a_gene_occupies_its_cds_rows_not_its_envelope(self) -> None:
        payload = build([
            gene("A", "chr1", 100, 400, "+"),
            child("A", "chr1", 100, 199, "+", index=1),
            child("A", "chr1", 300, 400, "+", index=2),
            # Inside the gene row's envelope and inside the gap between the two
            # CDS rows, so it shares no base with A. An envelope comparison
            # would report an overlap of every one of its 50 bases.
            gene("B", "chr1", 220, 269, "-"),
            child("B", "chr1", 220, 269, "-"),
        ], {"chr1": 1000})
        self.assertEqual(payload["coverage"]["overlappingPairs"], 0)
        self.assertEqual(payload["features"], [])
        self.assertEqual(payload["coverage"]["annotatedGenes"], 2)

    def test_abutting_genes_do_not_overlap_and_one_shared_base_does(self) -> None:
        payload = build([
            gene("A", "chr1", 100, 200, "+"),
            child("A", "chr1", 100, 200, "+"),
            gene("B", "chr1", 201, 300, "+"),
            child("B", "chr1", 201, 300, "+"),
            gene("C", "chr1", 300, 400, "-"),
            child("C", "chr1", 300, 400, "-"),
        ], {"chr1": 1000})
        found = relations(payload)
        self.assertNotIn(("A", "B"), found)
        self.assertEqual(found[("B", "C")], [[300, 300]])
        self.assertEqual(payload["coverage"]["pairwiseSharedBases"], 1)

    def test_a_multi_exon_rna_contributes_its_exons(self) -> None:
        payload = build([
            gene("R", "chr1", 100, 400, "+", biotype="ncRNA"),
            child("R", "chr1", 100, 400, "+", kind="ncRNA"),
            exon("R", "chr1", 100, 150, "+", "ncRNA", index=1),
            exon("R", "chr1", 351, 400, "+", "ncRNA", index=2),
            gene("A", "chr1", 200, 300, "-"),
            child("A", "chr1", 200, 300, "-"),
        ], {"chr1": 1000})
        self.assertEqual(payload["coverage"]["overlappingPairs"], 0)

    def test_a_gene_row_with_no_child_uses_its_own_span_and_says_so(self) -> None:
        payload = build([
            gene("P", "chr1", 100, 200, "+", biotype="pseudogene", kind="pseudogene"),
            gene("A", "chr1", 190, 300, "+"),
            child("A", "chr1", 190, 300, "+"),
        ], {"chr1": 1000})
        found = relations(payload)
        self.assertEqual(found[("A", "P")], [[190, 200]])
        sources = {feature["id"]: feature["segmentSource"] for feature in payload["features"]}
        self.assertEqual(sources["P"], "gene")
        self.assertEqual(sources["A"], "child")
        self.assertEqual(payload["coverage"]["childlessGenes"], 1)
        self.assertTrue(
            next(item for item in payload["features"] if item["id"] == "P")["pseudo"]
        )

    def test_two_cds_isoforms_of_one_gene_count_a_shared_base_once(self) -> None:
        payload = build([
            gene("A", "chr1", 100, 300, "+"),
            child("A", "chr1", 100, 300, "+", index=1),
            # A shorter isoform over the same start, the shape b4795 has in
            # MG1655. Summing per-row overlaps would double-count these bases.
            child("A", "chr1", 100, 180, "+", index=2),
            gene("B", "chr1", 150, 400, "-"),
            child("B", "chr1", 150, 400, "-"),
        ], {"chr1": 1000})
        self.assertEqual(relations(payload)[("A", "B")], [[150, 300]])
        self.assertEqual(payload["coverage"]["pairwiseSharedBases"], 151)


class RelationTest(unittest.TestCase):
    def test_overlaps_are_found_on_either_strand_and_beyond_adjacency(self) -> None:
        payload = build([
            # A contains B and C entirely, and C is not A's neighbour in
            # coordinate order, which is the case an adjacency rule misses.
            gene("A", "chr1", 100, 900, "+"),
            child("A", "chr1", 100, 900, "+"),
            gene("B", "chr1", 200, 300, "+"),
            child("B", "chr1", 200, 300, "+"),
            gene("C", "chr1", 700, 800, "-"),
            child("C", "chr1", 700, 800, "-"),
        ], {"chr1": 2000})
        found = relations(payload)
        self.assertEqual(found[("A", "B")], [[200, 300]])
        self.assertEqual(found[("A", "C")], [[700, 800]])
        self.assertEqual(payload["coverage"]["maxPartners"], 2)

    def test_genes_on_different_replicons_never_pair(self) -> None:
        payload = build([
            gene("A", "chr1", 100, 200, "+"),
            child("A", "chr1", 100, 200, "+"),
            gene("B", "plasmid1", 100, 200, "-"),
            child("B", "plasmid1", 100, 200, "-"),
        ], {"chr1": 1000, "plasmid1": 1000})
        self.assertEqual(payload["coverage"]["overlappingPairs"], 0)
        self.assertEqual([entry["accession"] for entry in payload["replicons"]],
                         ["chr1", "plasmid1"])

    def test_an_origin_crossing_gene_pairs_on_both_of_its_real_pieces(self) -> None:
        # NCBI's end-overflow notation: 900..1100 on a 1,000 bp replicon is
        # 900..1000 and 1..100.
        payload = build([
            gene("W", "chr1", 900, 1100, "-"),
            child("W", "chr1", 900, 1100, "-"),
            gene("A", "chr1", 50, 150, "+"),
            child("A", "chr1", 50, 150, "+"),
            gene("B", "chr1", 950, 980, "+"),
            child("B", "chr1", 950, 980, "+"),
            # In the stretch the wrapping gene does not occupy, 101..899.
            gene("C", "chr1", 400, 500, "+"),
            child("C", "chr1", 400, 500, "+"),
        ], {"chr1": 1000})
        found = relations(payload)
        self.assertEqual(found[("A", "W")], [[50, 100]])
        self.assertEqual(found[("B", "W")], [[950, 980]])
        self.assertNotIn(("C", "W"), found)
        wrapping = next(item for item in payload["features"] if item["id"] == "W")
        self.assertEqual(wrapping["segments"], [[1, 100], [900, 1000]])

    def test_non_coding_and_pseudogene_rows_are_counted_as_genes(self) -> None:
        payload = build([
            gene("A", "chr1", 100, 300, "+"),
            child("A", "chr1", 100, 300, "+"),
            gene("T", "chr1", 280, 350, "-", biotype="tRNA"),
            child("T", "chr1", 280, 350, "-", kind="tRNA"),
            gene("R", "chr1", 340, 400, "+", biotype="rRNA"),
            child("R", "chr1", 340, 400, "+", kind="rRNA"),
            # Regulatory annotation, which the release does not call a gene.
            ("chr1", "riboswitch", 150, 180, "+", attributes(
                ID="id-riboswitch", regulatory_class="riboswitch")),
            ("chr1", "sequence_feature", 160, 200, "+", attributes(ID="id-misc")),
        ], {"chr1": 1000})
        found = relations(payload)
        self.assertEqual(found[("A", "T")], [[280, 300]])
        self.assertEqual(found[("R", "T")], [[340, 350]])
        self.assertEqual(payload["coverage"]["annotatedGenes"], 3)
        self.assertEqual(payload["coverage"]["byBiotype"],
                         {"protein_coding": 1, "rRNA": 1, "tRNA": 1})
        self.assertEqual(
            {feature["id"] for feature in payload["features"]}, {"A", "T", "R"},
        )

    def test_every_compared_gene_is_named_whether_or_not_it_overlaps(self) -> None:
        # A gene with no partner is a measured absence only because the layer
        # says it looked at that identity. The positives-only feature list
        # cannot say it, so the inventory does.
        payload = build([
            gene("A", "chr1", 100, 300, "+"),
            child("A", "chr1", 100, 300, "+"),
            gene("B", "chr1", 290, 400, "-"),
            child("B", "chr1", 290, 400, "-"),
            gene("ALONE", "chr1", 700, 800, "+"),
            child("ALONE", "chr1", 700, 800, "+"),
            gene("T", "chr1", 900, 950, "-", biotype="tRNA"),
            child("T", "chr1", 900, 950, "-", kind="tRNA"),
        ], {"chr1": 2000})
        self.assertEqual(payload["coveredGenes"], ["A", "ALONE", "B", "T"])
        self.assertEqual(len(payload["coveredGenes"]), payload["coverage"]["annotatedGenes"])
        self.assertEqual({item["id"] for item in payload["features"]}, {"A", "B"})
        self.assertNotIn("ALONE", {item["id"] for item in payload["features"]})

    def test_the_pairwise_base_count_is_not_a_count_of_distinct_bases(self) -> None:
        # One base shared by two different pairs is counted once per pair.
        payload = build([
            gene("A", "chr1", 100, 200, "+"),
            child("A", "chr1", 100, 200, "+"),
            gene("B", "chr1", 200, 300, "-"),
            child("B", "chr1", 200, 300, "-"),
            gene("C", "chr1", 200, 260, "+"),
            child("C", "chr1", 200, 260, "+"),
        ], {"chr1": 1000})
        found = relations(payload)
        self.assertEqual(found[("A", "B")], [[200, 200]])
        self.assertEqual(found[("A", "C")], [[200, 200]])
        # Three pairs over base 200 and the 61 bases B and C share.
        self.assertEqual(payload["coverage"]["pairwiseSharedBases"], 1 + 1 + 61)

    def test_a_gene_never_overlaps_itself_through_its_own_segments(self) -> None:
        payload = build([
            gene("A", "chr1", 100, 300, "+"),
            child("A", "chr1", 100, 200, "+", index=1),
            child("A", "chr1", 150, 300, "+", index=2),
        ], {"chr1": 1000})
        self.assertEqual(payload["coverage"]["overlappingPairs"], 0)


class PayloadTest(unittest.TestCase):
    ROWS = [
        gene("A", "chr1", 100, 300, "+"),
        child("A", "chr1", 100, 300, "+"),
        gene("B", "chr1", 290, 400, "-"),
        child("B", "chr1", 290, 400, "-"),
    ]

    def test_the_payload_states_its_definition_release_and_coverage(self) -> None:
        payload = build(self.ROWS, {"chr1": 1000})
        self.assertEqual(payload["schemaVersion"], 1)
        self.assertEqual(payload["datasetVersion"], "gene-overlaps-v1")
        self.assertEqual(payload["origin"], "computed")
        self.assertEqual(payload["producer"], "tools/build_gene_overlaps.py")
        self.assertEqual(sorted(payload["definition"]),
                         ["excluded", "extent", "features", "overlap"])
        self.assertEqual(payload["release"]["accession"], "GCF_000000000.1")
        self.assertRegex(payload["release"]["sha256"], r"^[0-9a-f]{64}$")
        self.assertEqual(payload["coverage"]["overlappingGenes"], 2)
        self.assertEqual(payload["coverage"]["pairwiseSharedBases"], 11)
        self.assertEqual(payload["coveredGenes"], ["A", "B"])

    def test_the_serialized_payload_is_byte_stable(self) -> None:
        first = producer.serialize(build(self.ROWS, {"chr1": 1000}))
        self.assertEqual(first, producer.serialize(build(self.ROWS, {"chr1": 1000})))
        self.assertTrue(first.endswith("\n"))
        self.assertEqual(json.loads(first)["pairs"], [[0, 1, [[290, 300]]]])

    def test_the_relation_does_not_depend_on_the_order_the_rows_arrive_in(self) -> None:
        shuffled = build(list(reversed(self.ROWS)), {"chr1": 1000})
        ordered = build(self.ROWS, {"chr1": 1000})
        for key in ("features", "pairs", "coverage", "replicons", "definition"):
            self.assertEqual(ordered[key], shuffled[key], key)
        # Only the digest of the input bytes differs, which is the point of
        # carrying it: the payload names the exact file it was built from.
        self.assertNotEqual(ordered["release"]["sha256"], shuffled["release"]["sha256"])

    def test_a_duplicate_locus_tag_is_refused(self) -> None:
        with self.assertRaisesRegex(producer.OverlapError, "more than once"):
            build([
                gene("A", "chr1", 100, 200, "+"),
                child("A", "chr1", 100, 200, "+"),
                ("chr1", "gene", 300, 400, "+", attributes(
                    ID="gene-A2", Name="A", gene_biotype="protein_coding", locus_tag="A")),
                child("A", "chr1", 300, 400, "+", index=2),
            ], {"chr1": 1000})

    def test_a_missing_annotation_is_reported_rather_than_skipped(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(producer.OverlapError, "missing pinned annotation"):
                producer._gff_path(Path(tmp), FakeOrganism())


class ShippedLayerTest(unittest.TestCase):
    """Every organism the site can show publishes a layer, and it is current."""

    def test_every_configured_organism_publishes_a_current_layer(self) -> None:
        document = json.loads((ROOT / "config/organisms.json").read_text(encoding="utf-8"))
        for organism_id in sorted(document["organisms"]):
            with self.subTest(organism=organism_id):
                values = document["organisms"][organism_id]
                path = ROOT / values["outputDirectory"] / producer.PAYLOAD_NAME
                self.assertTrue(path.is_file(), f"{path} is not published")
                payload = json.loads(path.read_text(encoding="utf-8"))
                self.assertEqual(payload["datasetVersion"], "gene-overlaps-v1")
                self.assertEqual(payload["release"]["accession"], values["accession"])
                gff = (ROOT / values["rawDirectory"]
                       / f"{values['assemblyPrefix']}_genomic.gff.gz")
                if not gff.exists():
                    self.skipTest(f"missing pinned annotation {gff}")
                rebuilt = producer.serialize(producer.build_payload(
                    gff, OrganismConfig(organism_id, values),
                ))
                self.assertEqual(path.read_text(encoding="utf-8"), rebuilt)

    def test_the_published_layer_never_claims_a_pair_its_segments_do_not_share(self) -> None:
        for directory in sorted((ROOT / "site/data").rglob(producer.PAYLOAD_NAME)):
            with self.subTest(layer=str(directory.relative_to(ROOT))):
                payload = json.loads(directory.read_text(encoding="utf-8"))
                features = payload["features"]
                for first, second, pieces in payload["pairs"]:
                    shared = producer.shared_intervals(
                        [tuple(piece) for piece in features[first]["segments"]],
                        [tuple(piece) for piece in features[second]["segments"]],
                    )
                    self.assertEqual([list(piece) for piece in shared], pieces,
                                     f"{features[first]['id']}/{features[second]['id']}")


if __name__ == "__main__":
    unittest.main()
