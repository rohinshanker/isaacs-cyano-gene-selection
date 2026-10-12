"""Tests for the audit of the Tan 2018 pooled TSS initiation table."""

from __future__ import annotations

import csv
import dataclasses
import hashlib
import io
import json
import sys
import tarfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools import tan2018_pooled_audit as audit  # noqa: E402

SOURCES = json.loads((ROOT / "data/expression/sources.json").read_text(encoding="utf-8"))

# --- Synthetic archive -------------------------------------------------------

DIRECTORY = audit.MEMBER_DIRECTORY
GENOME = f"{DIRECTORY}/genome.gbk"
PLASMID = f"{DIRECTORY}/plasmid.gbk"
Q = " " * 21


def counts(*values: str) -> list[str]:
    """The eight sample qualifiers in the archive's own scrambled field order."""
    return [f"{Q}/tSSCount_Sample_{i}={values[i]}" for i in (7, 6, 5, 4, 3, 2, 1, 0)]


def site(key: str, location: str, values: tuple[str, ...], *score: str) -> list[str]:
    lines = [f"     {key:<16}{location}", *counts(*values), f"{Q}/score={score[0]}"]
    return lines + [f"{Q}{more}" for more in score[1:]]


def gene(location: str, locus: str, biotype: str | None = "protein_coding") -> list[str]:
    lines = [f"     {'gene':<16}{location}", f'{Q}/locus_tag="{locus}"']
    return lines + ([f'{Q}/gene_biotype="{biotype}"'] if biotype else [])


EIGHT = ("8", "4", "2", "0", "16", "12", "6", "2")
FRACTIONAL = ("1.5", "2.5", "0.83", "0", "3", "3.9", "1", "1")
GENOME_TEXT = "\n".join([
    *gene("100..400", "M744_RS00001"),
    # At the gene's lowest coordinate: kept.
    *site("gTSS", "100", EIGHT, "gTSS, 0 bp upstream of gene M744_RS00001."),
    # Upstream of a forward gene, below its lowest coordinate: dropped.
    *site("gTSS", "90", ("9",) * 8, "gTSS, 10 bp upstream of gene M744_RS00001."),
    # Fractional published counts are truncated.
    *site("iTSS", "200", FRACTIONAL, "iTSS, 100 bp inside of gene M744_RS00001."),
    *gene("complement(500..800)", "M744_RS00002"),
    # Upstream of a reverse gene, above its lowest coordinate: kept.
    *site("gTSS", "complement(820)", ("2", "2", "0", "0", "4", "4", "2", "2"),
          "gTSS, 20 bp upstream of gene M744_RS00002."),
    *gene("900..1000", "M744_RS00003", "pseudogene"),
    # A wrapped score naming two loci; the pseudogene earns nothing.
    *site("nTSS", "complement(850)", ("1",) * 8,
          "nTSS, at position 850 on - strand, before gene",
          "M744_RS00002, antistrand nearest gene is M744_RS00003"),
    *gene("1100..1200", "M744_RS00004"),
    # A protein-coding locus outside the current target set earns nothing.
    *site("aTSS", "1150", ("5",) * 8, "aTSS, 50 bp downstream of reverse gene M744_RS00004"),
    # A gene feature without a biotype is not protein-coding here.
    *gene("1300..1400", "M744_RS00006", None),
    "BASE COUNT   1 a 1 c 1 g 1 t",
    "ORIGIN",
    "        1 acgt",
    "//",
]) + "\n"
PLASMID_TEXT = "\n".join([
    "LOCUS       NZ_TEST                 2000 bp    DNA     circular",
    "DBLINK      BioProject: PRJNA0",
    "            BioSample: SAMN0",
    "FEATURES             Location/Qualifiers",
    # An origin-spanning join: its lowest coordinate is 1.
    *gene("complement(join(1900..2000,1..50))", "M744_RS00005"),
    *site("gTSS", "complement(60)", ("1",) * 8, "gTSS, 10 bp upstream of gene M744_RS00005."),
    # Inside RS00001's span by number, but RS00001 is a genome-file gene.
    *site("iTSS", "150", ("3",) * 8, "iTSS, 50 bp inside of gene M744_RS00001."),
    "ORIGIN",
    "//",
]) + "\n"
TARGETS = ["M744_RS00001", "M744_RS00002", "M744_RS00003", "M744_RS00005", "M744_RS00099"]

# RS00001: gTSS 100, sum 50, plus iTSS 200 truncated to (1,2,0,0,3,3,1,1), sum 11.
# RS00002: gTSS 820, sum 16, plus nTSS 850, sum 8. RS00005: gTSS 60, sum 8.
EXPECTED_POOLED = (
    "locus_tag\tabundance\tsource_gene_id\n"
    "M744_RS00001\t7.625000\tTan2018_dRNAseq_TSS_count_sum_2TSS\r\n"
    "M744_RS00002\t3.000000\tTan2018_dRNAseq_TSS_count_sum_2TSS\r\n"
    "M744_RS00005\t1.000000\tTan2018_dRNAseq_TSS_count_sum_1TSS\r\n"
).encode()


def tarball(members: dict[str, bytes], *, directory: str = DIRECTORY) -> bytes:
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
        entry = tarfile.TarInfo(directory)
        entry.type = tarfile.DIRTYPE
        tar.addfile(entry)
        for name, data in members.items():
            info = tarfile.TarInfo(name)
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))
    return buffer.getvalue()


def write_table_s1(path: Path, rows: list[tuple[str, str, int, tuple[str, ...]]]) -> Path:
    columns = list(audit.TABLE_S1_COLUMNS.values())
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, delimiter="\t", lineterminator="\n")
        writer.writerow(["tss_id", "type", "strand", "position", *columns])
        for kind, strand, position, values in rows:
            writer.writerow([f"{kind}{strand}{position}", kind, strand, position, *values])
    return path


def pins_for(members: dict[str, bytes], archive: bytes, **changes) -> audit.Pins:
    return dataclasses.replace(
        audit.PINS,
        archive_sha256=hashlib.sha256(archive).hexdigest(),
        members={name: hashlib.sha256(data).hexdigest() for name, data in members.items()},
        **changes,
    )


@pytest.fixture
def synthetic(tmp_path):
    """A synthetic archive, its pins and a matching Table S1 extract."""
    members = {GENOME: GENOME_TEXT.encode(), PLASMID: PLASMID_TEXT.encode()}
    archive = tarball(members)
    table = write_table_s1(tmp_path / "table_s1.tsv", [
        ("gTSS", "+", 100, EIGHT),
        ("iTSS", "+", 200, FRACTIONAL),
        ("gTSS", "-", 820, ("2", "2", "0", "0", "4", "4", "2", "2")),
    ])
    pins = pins_for(members, archive, tables=(table,), shared_sites=3,
                    pooled_sha256=hashlib.sha256(EXPECTED_POOLED).hexdigest())
    return {"archive": archive, "members": members, "pins": pins, "tmp": tmp_path}


def rebuilt_with_genome(synthetic, text: str) -> None:
    members = {GENOME: text.encode(), PLASMID: PLASMID_TEXT.encode()}
    archive = tarball(members)
    pins = pins_for(members, archive, tables=synthetic["pins"].tables, shared_sites=3,
                    pooled_sha256=synthetic["pins"].pooled_sha256)
    audit.rebuild(archive, TARGETS, pins)


# --- Synthetic behaviour ------------------------------------------------------

def test_parser_skips_the_header_and_joins_wrapped_qualifiers():
    assert [f.key for f in audit.parse_features(PLASMID_TEXT, "plasmid")] == [
        "gene", "gTSS", "iTSS"]
    genome = audit.parse_features(GENOME_TEXT, "genome")
    wrapped = next(f for f in genome if f.key == "nTSS")
    assert wrapped.values("score") == [
        "nTSS, at position 850 on - strand, before gene "
        "M744_RS00002, antistrand nearest gene is M744_RS00003"
    ]
    assert genome[-1].values("locus_tag") == ['"M744_RS00006"']


def test_rebuild_matches_the_hand_computed_table(synthetic):
    assert audit.rebuild(synthetic["archive"], TARGETS, synthetic["pins"]) == EXPECTED_POOLED


def test_association_rule_on_the_synthetic_archive(synthetic):
    sites, genes, by_locus = audit.load(synthetic["archive"], TARGETS, synthetic["pins"])
    assert len(sites) == 8
    assert set(genes) == {"M744_RS00001", "M744_RS00002", "M744_RS00004", "M744_RS00005"}
    assert genes["M744_RS00005"] == audit.Gene(PLASMID, 1)
    assert {locus: [(s.key, s.position) for s in group] for locus, group in by_locus.items()} == {
        "M744_RS00001": [("gTSS", 100), ("iTSS", 200)],
        "M744_RS00002": [("gTSS", 820), ("nTSS", 850)],
        "M744_RS00005": [("gTSS", 60)],
    }


def test_summary_reports_what_the_rule_keeps_and_drops(synthetic):
    assert audit.summary(synthetic["archive"], TARGETS, synthetic["pins"]) == {
        "sites": 8,
        "sitesUsed": 5,
        "paperProteinCodingGenes": 4,
        "paperProteinCodingNotCurrent": 1,
        "lociWithScore": 3,
        "targetsWithoutScore": 2,
        "keptPairs": {"gTSS+": 1, "gTSS-": 2, "iTSS+": 1, "nTSS-": 1},
        "droppedPairs": {"gTSS+": 1},
        "lociLosingASite": 1,
        "lociLosingEverySite": 0,
        "lociLoweredByTruncation": ["M744_RS00001"],
    }


def test_decimal_text_refuses_inexact_values():
    assert audit.decimal_text(audit.Fraction(1315, 8)) == "164.375000"
    with pytest.raises(ValueError, match="not exact at six decimals"):
        audit.decimal_text(audit.Fraction(1, 3))


def test_unquoted_leaves_unquoted_values_alone():
    assert audit.unquoted('"x"') == "x"
    assert audit.unquoted("x") == "x"
    assert audit.unquoted(None) is None


# --- Synthetic refusals -------------------------------------------------------

def test_archive_checksum_mismatch_is_refused(synthetic):
    pins = dataclasses.replace(synthetic["pins"], archive_sha256="0" * 64)
    with pytest.raises(ValueError, match="Tan archive checksum mismatch"):
        audit.rebuild(synthetic["archive"], TARGETS, pins)


def test_member_checksum_mismatch_is_refused(synthetic):
    members = dict(synthetic["pins"].members, **{GENOME: "0" * 64})
    with pytest.raises(ValueError, match="member .*genome.gbk checksum mismatch"):
        audit.rebuild(synthetic["archive"], TARGETS,
                      dataclasses.replace(synthetic["pins"], members=members))


def test_missing_member_is_refused():
    members = {GENOME: GENOME_TEXT.encode()}
    archive = tarball(members)
    pins = pins_for(members, archive)
    pins = dataclasses.replace(pins, members=dict(pins.members, **{PLASMID: "0" * 64}))
    with pytest.raises(ValueError, match="missing members: .*plasmid.gbk"):
        audit.rebuild(archive, TARGETS, pins)


def test_unexpected_member_is_refused(synthetic):
    archive = tarball(dict(synthetic["members"], **{f"{DIRECTORY}/extra.txt": b"x"}))
    pins = dataclasses.replace(synthetic["pins"], archive_sha256=hashlib.sha256(archive).hexdigest())
    with pytest.raises(ValueError, match="unexpected member: .*extra.txt"):
        audit.rebuild(archive, TARGETS, pins)


def test_unexpected_directory_is_refused(synthetic):
    archive = tarball(synthetic["members"], directory="Elsewhere")
    pins = dataclasses.replace(synthetic["pins"], archive_sha256=hashlib.sha256(archive).hexdigest())
    with pytest.raises(ValueError, match="unexpected directory: Elsewhere"):
        audit.rebuild(archive, TARGETS, pins)


@pytest.mark.parametrize(
    "old, new, message",
    [
        ("/tSSCount_Sample_3=0", "/tSSCount_Sample_3=n/a", "count must be a non-negative decimal"),
        ("/tSSCount_Sample_3=0", "/tSSCount_Sample_3=-1", "count must be a non-negative decimal"),
        (f"{Q}/tSSCount_Sample_3=0\n", "", "needs exactly one /tSSCount_Sample_3, found 0"),
        ("/tSSCount_Sample_3=0", "/tSSCount_Sample_3=0\n" + Q + "/tSSCount_Sample_3=0",
         "needs exactly one /tSSCount_Sample_3, found 2"),
        ("     gTSS            100\n", "     gTSS            100..101\n",
         "a TSS location must be one base"),
        (f"{Q}/score=gTSS, 0 bp upstream of gene M744_RS00001.\n", "",
         "needs exactly one /score, found 0"),
        ('/locus_tag="M744_RS00002"', '/locus_tag="M744_RS00001"',
         "duplicate protein-coding gene M744_RS00001"),
        ("     gene            1100..1200\n", "    gene 1100..1200\n", "unparsed feature line"),
        (f'{Q}/gene_biotype="pseudogene"\n', f"{Q}/pseudo\n{Q}continued\n",
         "continuation of the valueless /pseudo"),
    ],
)
def test_malformed_genome_features_are_refused(synthetic, old, new, message):
    assert old in GENOME_TEXT
    with pytest.raises(ValueError, match=message):
        rebuilt_with_genome(synthetic, GENOME_TEXT.replace(old, new, 1))


def test_a_second_features_table_is_refused():
    with pytest.raises(ValueError, match="more than one FEATURES table"):
        audit.parse_features(PLASMID_TEXT + "FEATURES             Location/Qualifiers\n", "x")


def test_an_archive_without_sites_is_refused():
    with pytest.raises(ValueError, match="has no TSS features"):
        audit.read_archive({GENOME: "\n".join(gene("1..9", "M744_RS00001")).encode()})


def test_swapped_replicate_order_is_refused(synthetic):
    # Table S1 with control and dark exchanged: the archive's order no longer holds.
    swapped = ("2", "0", "8", "4", "16", "12", "6", "2")
    table = write_table_s1(synthetic["tmp"] / "swapped.tsv", [("gTSS", "+", 100, swapped)])
    pins = dataclasses.replace(synthetic["pins"], tables=(table,), shared_sites=1)
    with pytest.raises(ValueError, match="tSSCount_Sample_0 is 8, Table S1 control_1 is '2'"):
        audit.rebuild(synthetic["archive"], TARGETS, pins)


def test_blank_table_s1_count_is_refused(synthetic):
    blank = ("8", "4", "", "0", "16", "12", "6", "2")
    table = write_table_s1(synthetic["tmp"] / "blank.tsv", [("gTSS", "+", 100, blank)])
    pins = dataclasses.replace(synthetic["pins"], tables=(table,), shared_sites=1)
    with pytest.raises(ValueError, match="Table S1 dark_1 is ''"):
        audit.rebuild(synthetic["archive"], TARGETS, pins)


def test_shared_site_count_drift_is_refused(synthetic):
    pins = dataclasses.replace(synthetic["pins"], shared_sites=4)
    with pytest.raises(ValueError, match="3 archive sites match Table S1 .* not 4"):
        audit.rebuild(synthetic["archive"], TARGETS, pins)


def test_a_rule_that_does_not_reproduce_the_pinned_table_is_refused(synthetic):
    pins = dataclasses.replace(synthetic["pins"], pooled_sha256="0" * 64)
    with pytest.raises(ValueError, match="does not reproduce the pinned pooled table"):
        audit.rebuild(synthetic["archive"], TARGETS, pins)


# --- Command line ---------------------------------------------------------------

def cli_files(synthetic) -> tuple[Path, Path, Path]:
    archive = synthetic["tmp"] / "archive.tar.gz"
    archive.write_bytes(synthetic["archive"])
    genes = synthetic["tmp"] / "genes.json"
    genes.write_text(json.dumps([{"id": locus} for locus in TARGETS]), encoding="utf-8")
    pooled = synthetic["tmp"] / "pooled.tsv"
    pooled.write_bytes(EXPECTED_POOLED)
    return archive, genes, pooled


def test_cli_check_and_summary(synthetic, monkeypatch, capsys):
    monkeypatch.setattr(audit, "PINS", synthetic["pins"])
    archive, genes, pooled = cli_files(synthetic)
    arguments = ["--archive", str(archive), "--genes", str(genes), "--pooled", str(pooled)]
    assert audit.main(["check", *arguments]) == 0
    assert audit.main(["summary", *arguments]) == 0
    assert json.loads(capsys.readouterr().out)["lociWithScore"] == 3
    # A committed table that drifts from its pin is reported, not rewritten.
    pooled.write_bytes(EXPECTED_POOLED.replace(b"7.625000", b"7.000000"))
    assert audit.main(["check", *arguments]) == 1
    assert capsys.readouterr().err.endswith(f"{pooled} differs from the rebuild\n")
    assert pooled.read_bytes() != EXPECTED_POOLED
    pooled.unlink()
    assert audit.main(["check", *arguments]) == 1


def test_cli_reports_a_rule_mismatch(synthetic, monkeypatch, capsys):
    monkeypatch.setattr(audit, "PINS", dataclasses.replace(synthetic["pins"], pooled_sha256="0" * 64))
    archive, genes, pooled = cli_files(synthetic)
    assert audit.main(["check", "--archive", str(archive), "--genes", str(genes),
                       "--pooled", str(pooled)]) == 1
    assert "does not reproduce the pinned pooled table" in capsys.readouterr().err


def test_cli_refuses_a_missing_archive(tmp_path, capsys):
    assert audit.main(["check", "--archive", str(tmp_path / "absent.tar.gz")]) == 1
    assert "run `tan2018_pooled_audit.py fetch` first" in capsys.readouterr().err


@pytest.mark.parametrize(
    "content, message",
    [
        ('{"id": "x"}', "is not a gene list"),
        ('[{"id": "a"}, {"id": "a"}]', "repeats a gene id"),
    ],
)
def test_cli_refuses_a_bad_gene_list(synthetic, monkeypatch, capsys, content, message):
    monkeypatch.setattr(audit, "PINS", synthetic["pins"])
    archive, genes, _ = cli_files(synthetic)
    genes.write_text(content, encoding="utf-8")
    assert audit.main(["check", "--archive", str(archive), "--genes", str(genes)]) == 1
    assert message in capsys.readouterr().err


def test_cli_fetch_uses_both_pinned_downloads(monkeypatch, tmp_path):
    calls = []
    monkeypatch.setattr(audit.ingest, "fetch",
                        lambda url, digest, target: calls.append((url, digest, target)))
    assert audit.main(["fetch", "--archive", str(tmp_path / "a"),
                       "--article", str(tmp_path / "b")]) == 0
    assert calls == [
        (audit.ARCHIVE_URL, audit.ARCHIVE_SHA256, tmp_path / "a"),
        (audit.ARTICLE_URL, audit.ARTICLE_SHA256, tmp_path / "b"),
    ]


def test_article_helpers_refuse_a_wrong_checksum_and_report_misses():
    article = b"<article><p>33 <sub>x</sub>  CO <sub>2</sub> aeration</p></article>"
    with pytest.raises(ValueError, match="Tan article checksum mismatch"):
        audit.article_text(article)
    text = audit.article_text(article, hashlib.sha256(article).hexdigest())
    assert text == "33 x CO 2 aeration"
    record = {"conditions": {
        "co2": {"quote": "CO 2  aeration", "where": "paper PMC6091082, Methods"},
        "medium": {"quote": "BG-11", "where": "paper PMC6091082, Methods"},
        "phase": {"quote": "BG-11", "where": "elsewhere"},
        "format": {"quote": "", "where": ""},
    }}
    sources = [{"id": "T", "citationId": "tan-2018", "record": record},
               {"id": "U", "citationId": "other", "record": record}]
    assert audit.unmatched_quotes(sources, text) == ["T medium"]


# --- The shipped pooled source --------------------------------------------------

def test_the_pooled_source_declares_initiation_and_keeps_its_table():
    source = next(s for s in SOURCES if s["id"] == "TAN2018_TSS")
    assert source["quantity"] == "tss_initiation"
    assert source["label"] == "TSS initiation, four conditions pooled (UTEX 2973)"
    assert source["sha256"] == audit.POOLED_SHA256
    assert hashlib.sha256(audit.POOLED.read_bytes()).hexdigest() == audit.POOLED_SHA256
    assert "recovered, not documented" in source["caveat"]
    meta = json.loads((ROOT / "site/data/meta.json").read_text(encoding="utf-8"))
    shipped = next(s for s in meta["expressionSources"] if s["id"] == "TAN2018_TSS")
    assert (shipped["quantityKind"], shipped["quantityLabel"], shipped["quantityPools"]) == (
        "initiation", "Transcription initiation (RNA-seq)", False)
    assert meta["metrics"]["tssInitiation"]["family"] == "Expression"
    assert "never pooled across datasets." in meta["metrics"]["tssInitiation"]["desc"]


# --- Pinned archive (skipped until `tan2018_pooled_audit.py fetch`) -------------

@pytest.mark.skipif(not audit.ARCHIVE.is_file(), reason="pinned ignored source not fetched")
def test_pinned_archive_reproduces_the_committed_pooled_table():
    rebuilt = audit.rebuild(audit.ARCHIVE.read_bytes(), audit.target_loci(audit.GENES))
    assert rebuilt == audit.POOLED.read_bytes()


@pytest.mark.skipif(not audit.ARCHIVE.is_file(), reason="pinned ignored source not fetched")
def test_pinned_archive_coordinate_rule_equals_a_single_pass_file_order_rule():
    """'At or after the gene's lowest coordinate' is, on this archive, the same
    membership as resolving a named locus only once its gene feature has been read."""
    members = audit.read_members(audit.ARCHIVE.read_bytes(), audit.ARCHIVE_SHA256,
                                 audit.MEMBERS)
    sites, genes = audit.read_archive(members)
    targets = set(audit.target_loci(audit.GENES))
    by_coordinate = {(locus, s.member, s.key, s.strand, s.position)
                     for locus, kept in audit.associate(sites, genes, targets).items()
                     for s in kept}
    by_file_order = set()
    for member in sorted(members):
        seen: set[str] = set()
        for feature in audit.parse_features(members[member].decode("utf-8"), member):
            if feature.key == "gene":
                seen.update(filter(None, map(audit.unquoted, feature.values("locus_tag"))))
            elif feature.key in audit.TSS_KEYS:
                site = audit.read_site(feature, member)
                by_file_order.update(
                    (locus, member, site.key, site.strand, site.position)
                    for locus in site.loci if locus in seen and locus in targets
                    and locus in genes and genes[locus].member == member)
    assert by_file_order == by_coordinate


@pytest.mark.skipif(not audit.ARCHIVE.is_file(), reason="pinned ignored source not fetched")
def test_pinned_archive_summary():
    result = audit.summary(audit.ARCHIVE.read_bytes(), audit.target_loci(audit.GENES))
    assert result == {
        "sites": 4827,
        "sitesUsed": 3239,
        "paperProteinCodingGenes": 2670,
        "paperProteinCodingNotCurrent": 51,
        "lociWithScore": 1727,
        "targetsWithoutScore": 988,
        "keptPairs": {"aTSS+": 635, "aTSS-": 640, "gTSS+": 26, "gTSS-": 1113,
                      "iTSS+": 383, "iTSS-": 338, "nTSS+": 25, "nTSS-": 134},
        "droppedPairs": {"aTSS+": 42, "aTSS-": 32, "gTSS+": 1286, "nTSS+": 145, "nTSS-": 19},
        "lociLosingASite": 1008,
        "lociLosingEverySite": 486,
        "lociLoweredByTruncation": [
            "M744_RS02730", "M744_RS03145", "M744_RS03175", "M744_RS05310",
            "M744_RS09190", "M744_RS09455", "M744_RS10840", "M744_RS10895",
            "M744_RS10920", "M744_RS11690", "M744_RS12905", "M744_RS13455",
        ],
    }


@pytest.mark.skipif(not audit.ARTICLE.is_file(), reason="pinned ignored source not fetched")
def test_every_tan_condition_quote_matches_the_pinned_article():
    text = audit.article_text(audit.ARTICLE.read_bytes())
    assert audit.unmatched_quotes(SOURCES, text) == []
