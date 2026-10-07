# O_cross-strain-data-scan__20260927 — Open

- **Scope:** Scan the academic literature and public repositories for reliable
  *S. elongatus* data in the admitted sister-strain data types, build the approved
  PCC 6311 and PCC 7943 RefSeq crosswalk, decide how comparable-condition datasets
  combine across strains, extend the shipped gene viewer, and design the chromosome
  visualizer and dataset selectors that display them. Covers `docs/`, `data/`, and
  `site/`.
- **Status:** open
- **Opened:** 2026-09-27
- **Updated:** 2026-10-07

## Current state

The data contract admits PCC 6301, PCC 6311, PCC 7942, PCC 7943, and UTEX 3055 as
sister strains of UTEX 2973 for gene annotations, transcriptomics, proteomics,
ribosome occupancy, TIS, TSS, and TTS. See
[the sister-strain rules](../../validation/data-contract.md#sister-strains-admitted-for-utex-2973-data)
and [condition comparability](../../validation/data-contract.md#condition-comparability).
Nothing has been scanned or ingested against that widened scope yet. The site
currently ships one PCC 7942 abundance table, native Tan 2018 TSS evidence, borrowed
PCC 7942 essentiality, and computed sequence metrics.

The goal is larger than one more column. The site should bring many published
*S. elongatus* datasets into one coordinate system, so a scientist can look up a gene
and see what every study measured about it.

### Owner decisions recorded 2026-09-27

- **TDS was a misstatement and is withdrawn.** The intended type was TTS. No
  degradation or decay data type is admitted, and nothing should be scanned for one.
- **UTEX 3055 is admitted**, in a separate tier from the four PCC strains because its
  gene content genuinely differs.
- **The PCC 6311 and PCC 7943 RefSeq crosswalk is approved to build.**
- **Positional features feed a planned gene viewer.** A chromosome visualizer is
  also planned, intended to replace the gene PCA view rather than sit beside it. The
  owner corrected the earlier "plasmid visualizer" wording on 2026-09-27: the view
  is centred on the single chromosome, with the two plasmids as explicit secondary
  tracks; see section 5.
- **Condition thresholds are recorded with concrete numbers**, and pairs whose
  biological comparability stays uncertain go to the biological-decisions list for
  the owner to resolve rather than being decided here.

## Work

### Who does which step

Use the [handoff contract](../../validation/claude-science-handoff.md#what-goes-to-claude-science-at-all):
agents verify accessible source evidence directly; Claude Science is the owner's
manual last resort or requested independent check. Source sweeps and condition
scoring use the [package return format](../../validation/claude-science-handoff.md#return-format).

The crosswalk, gene viewer, chromosome tab and selectors are repository work.
Their implementation does not wait on the source sweep; only an overlay's data
waits on its admission evidence. Crosswalks require an independent rederivation
from the pinned releases, without sharing the implementation.

### 1. Build the PCC 6311 and PCC 7943 crosswalk

**Built and merged 2026-09-28** (DEM-147, codex-implementer; reviewed by DEM-149,
claude-reviewer, accepted after one fix round; on `main` at `3c54dd2`). The
artifact is `sister-strain-crosswalk-v1.tsv` beside the UTEX release, 10,538 rows,
with its manifest, tool, tests, and
[sister-strain-crosswalk.md](../../validation/sister-strain-crosswalk.md). Counts:
PCC 6311 matched 2,663 of 2,715 UTEX loci, 52 unmatched, 8 ambiguous; PCC 7943
matched 2,636, 79 unmatched, 8 ambiguous. The independent Claude Science
re-derivation returned 2026-10-04 and **agrees on all four sides** (results block
below), so the gate this step placed on PCC 6311 and PCC 7943 sources is lifted;
no source for either strain exists yet to admit. Releases pinned,
identified by Claude Science and corrected against NCBI at intake 2026-09-28 (the
session wrote `RS_2025_12_2`; NCBI Datasets serves `RS_2025_12_23`, verified by the
coordinator and independently by the DEM-147 run — see
[RET_claude-science-session__20260928.md](../handoff/RET_claude-science-session__20260928.md#what-this-session-resolved)):
PCC 6311 `GCF_022984265.1`, release `GCF_022984265.1-RS_2025_12_23`; PCC 7943
`GCF_022984345.1`, release `GCF_022984345.1-RS_2025_12_23`. Both are
Chromosome-level assemblies, not Complete Genome, so an unmatched locus may be
assembly incompleteness rather than absence; the audit records that. The sweep
below found no functional-genomics deposit for either strain, so this crosswalk
unlocks nothing currently available: it is forward-looking infrastructure.

### Crosswalk second check result, returned 2026-10-04

Queue row "Crosswalk second check", sent 2026-10-02 on a read-only mount, returned
2026-10-04. The session could not write to the mount, so the owner placed the two
return files in `docs/notes/handoff/` by hand; they are the return as given.

**Verdict:** supported. All four sides reproduce the repository's counts exactly:
UTEX 2973 vs PCC 6311 2,715/2,663/52/8, PCC 6311 vs UTEX 2,714/2,661/53/6, UTEX vs
PCC 7943 2,715/2,636/79/8, PCC 7943 vs UTEX 2,715/2,635/80/7. No locus disagrees.

**Sources:**
[`cyano_crosswalk_second_check_20261004.tsv`](../handoff/cyano_crosswalk_second_check_20261004.tsv),
SHA-256 `d578e26d0ba1aca64bcb0b70ed3b972bfa0273bba0a74081541ee55fe1d817d6`;
[`cyano_crosswalk_second_check_20261004.md`](../handoff/cyano_crosswalk_second_check_20261004.md),
SHA-256 `6f6f69a165c7b394a5ccaa266dc35d48a17551c09bcd8a0a026409940e56867b` (no value
was pinned for the report; recorded here at intake). Inputs the session fetched
from NCBI on 2026-10-04: `GCF_000817325.1_ASM81732v1_genomic.gff.gz`,
`GCF_022984265.1_ASM2298426v1_genomic.gff.gz`,
`GCF_022984345.1_ASM2298434v1_genomic.gff.gz`, with the SHA-256 values and
`#!annotation-source` lines quoted in the report.

**Returned text:**

````markdown
# Crosswalk second check — PCC 6311 and PCC 7943 — 2026-10-04

```
requester:   owner
target:      mythos / fable (the in-repository agents)
ticket:      docs/notes/tickets/O_cross-strain-data-scan__20260927.md
package:     independent second check of the PCC 6311 and PCC 7943 crosswalk
status:      returned 2026-10-04
```

This is a second check in the sense of
`docs/validation/claude-science-handoff.md`, "Second-checking, not just
fetching": the counts were re-derived from the pinned NCBI releases without
reading the implementation. **Nothing was written to the repository** — the
dispatch asks for the result as session text and a saved artifact, and treats
the mount as read-only, so this file is an artifact only.

## Verdict: all four sides agree

| Side | Against | Total | Matched | Unmatched | Ambiguous | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| UTEX 2973 | PCC 6311 | 2,715 | 2,663 | 52 | 8 | **agrees** |
| PCC 6311 | UTEX 2973 | 2,714 | 2,661 | 53 | 6 | **agrees** |
| UTEX 2973 | PCC 7943 | 2,715 | 2,636 | 79 | 8 | **agrees** |
| PCC 7943 | UTEX 2973 | 2,715 | 2,635 | 80 | 7 | **agrees** |

Every one of the twelve stated numbers — four totals, four matched, four
unmatched — and all four ambiguous counts reproduce exactly. **Matched +
unmatched equals the total on every side** (2,663 + 52 = 2,715;
2,661 + 53 = 2,714; 2,636 + 79 = 2,715; 2,635 + 80 = 2,715), which confirms the
dispatch's statement that ambiguous is a subset of matched and not a third
bucket. No locus disagrees, so `sister-strain-crosswalk-v1.tsv` was never
opened; the dispatch permits opening it only to locate a disagreement.

Machine-readable form: `cyano_crosswalk_second_check_20261004.tsv`, SHA-256
`d578e26d0ba1aca64bcb0b70ed3b972bfa0273bba0a74081541ee55fe1d817d6`.

## Releases retrieved, and confirmation that each is the one named

All three fetched from the NCBI genomes FTP on 2026-10-04. The
`#!annotation-source` line of each GFF3 is quoted, which is what confirms the
annotation release rather than just the assembly accession.

| Strain | File | Bytes | SHA-256 | `#!annotation-source` |
| --- | --- | --- | --- | --- |
| UTEX 2973 | `GCF_000817325.1_ASM81732v1_genomic.gff.gz` | 240383 | `7f606a08892b061667a1988cc05dee889a82f9407066dcf81010ec2e25bb215f` | `NCBI RefSeq GCF_000817325.1-RS_2026_05_13` |
| PCC 6311 | `GCF_022984265.1_ASM2298426v1_genomic.gff.gz` | 238990 | `ed629966691e74e519a249e3fe9a8124993730bc60f84f85ef88641532efbd1f` | `NCBI RefSeq GCF_022984265.1-RS_2025_12_23` |
| PCC 7943 | `GCF_022984345.1_ASM2298434v1_genomic.gff.gz` | 239087 | `0b5579670813b978c4741b86db25dafd14b66a1110bdc09e34ffd3d9fe9b77b7` | `NCBI RefSeq GCF_022984345.1-RS_2025_12_23` |

Each `#!annotation-source` string matches the release the dispatch pins,
character for character. The `#!annotation-date` lines agree with them:
05/13/2026, 12/23/2025 and 12/23/2025.

## How the counts were derived

Only the GFF3 was read. For every `CDS` feature the `locus_tag` and
`protein_id` attributes were taken; nothing else — not product text, not
coordinates, not sequence — entered the join.

| Strain | CDS lines | Protein-bearing loci | Distinct protein accessions | CDS with no `protein_id` |
| --- | --- | --- | --- | --- |
| UTEX 2973 | 2723 | **2715** | 2711 | 7 |
| PCC 6311 | 2724 | **2714** | 2712 | 9 |
| PCC 7943 | 2725 | **2715** | 2712 | 9 |

The protein-bearing locus totals — 2,715, 2,714 and 2,715 — are the dispatch's
totals, reached independently. Every CDS carries a `locus_tag`; the handful
without a `protein_id` are the only CDS lines excluded, and no locus in any of
the three genomes carries more than one distinct protein accession.

A locus was called **matched** when at least one of its protein accessions also
appears on a locus of the other strain, **unmatched** otherwise, and
**ambiguous** when matched but the mapping is not one-to-one — that is, unless
it reaches exactly one counterpart and that counterpart reaches back to exactly
this one locus.

**The agreement is robust to how the ambiguity clause is read.** The dispatch
phrases it two ways — a protein attached to more than one locus on either side,
or a locus reaching more than one counterpart. Both were implemented
separately, and they return identical counts on all four sides, so the
agreement does not rest on a particular reading.

## Why the counts are what they are

All 29 ambiguous calls across the four sides trace to **four duplicated
proteins**, and nothing else:

| Protein | UTEX 2973 loci | PCC 6311 loci | PCC 7943 loci |
| --- | --- | --- | --- |
| `WP_011243185.1` | M744_RS07945, M744_RS12910 | PCC6311_RS03400 | PCC7943_RS03400 |
| `WP_011242480.1` | M744_RS09190, M744_RS11690 | PCC6311_RS04685 | PCC7943_RS04685, PCC7943_RS07235 |
| `WP_011242807.1` | M744_RS10890, M744_RS10915 | PCC6311_RS05475, PCC6311_RS05500 | PCC7943_RS05475, PCC7943_RS05500 |
| `WP_011242808.1` | M744_RS10895, M744_RS10920 | PCC6311_RS05470, PCC6311_RS05495 | PCC7943_RS05470, PCC7943_RS05495 |

That table predicts each ambiguous count exactly, which is a second, independent
way of arriving at them:

- **UTEX 2973, 8 either way.** Each of the four proteins sits on two UTEX loci,
  so 4 × 2 = 8 UTEX loci are ambiguous against either sister.
- **PCC 6311, 6.** Two of the four proteins are single-copy in PCC 6311 but reach
  two UTEX loci each (2 loci), and two are two-copy (4 loci). 2 + 4 = 6.
- **PCC 7943, 7.** One protein is single-copy (1 locus) and three are two-copy
  (6 loci). 1 + 6 = 7.

The asymmetry between the sides is therefore a real gene-duplication difference
between the strains, not an artefact of the join. The full locus lists are in
the `ambiguous_loci` column of the TSV.

## What this check does and does not establish

- It establishes that the **coverage counts are reproducible** from the pinned
  releases under the stated join rule, by code that never saw `tools/`,
  `sister-strain-crosswalk-v1.tsv`, `tests/`, or
  `docs/validation/sister-strain-crosswalk.md`.
- It does **not** check the crosswalk file's contents row by row. Agreement on
  four counts is consistent with, but does not prove, agreement on every
  mapping. A row-level check would need the file opened, which the dispatch
  reserves for a disagreement.
- **The dispatch supplied the target numbers**, so this is a reproduction of the
  method against a known answer, not a blind estimate. The mitigation is that
  the derivation is mechanical and the code is described above in full; the
  counts fell out of it rather than being matched to.
- **One disclosure on the reading restriction.** In a prior session on this
  machine, a different package loaded every file in `docs/validation/` into a
  variable in bulk, which included `sister-strain-crosswalk.md`. Its contents
  were never printed, quoted or otherwise surfaced, and that kernel has since
  been discarded. No restricted file was opened in this session.

## Boundaries observed

The crosswalk was not edited and no mapping was proposed for any unmatched or
ambiguous locus. No source was admitted. Nothing was written to the repository.
No work was done outside this scope.
````

**Intake check:** the in-repository agent (this session), 2026-10-04.

- Both return files' checksums recomputed; the TSV matches the pinned value and
  the report's value is recorded above.
- The three input GFF3 SHA-256 values match the bytes this repository pins:
  `data/raw/GCF_000817325.1_ASM81732v1_genomic.gff.gz` (`7f606a08…`),
  `data/annotation/source/GCF_022984265.1_ASM2298426v1_genomic.gff.gz`
  (`ed629966…`), and `data/annotation/source/GCF_022984345.1_ASM2298434v1_genomic.gff.gz`
  (`0b557967…`), whose MD5 values are the ones in
  `data/manifest/sister-strain-crosswalk-v1.json`. The session therefore
  re-derived from the same release bytes.
- Every count matches the coverage table in
  [sister-strain-crosswalk.md](../../validation/sister-strain-crosswalk.md).
- The `ambiguous_loci` lists match the repository artifact exactly: the eight UTEX
  loci, six PCC 6311 loci and seven PCC 7943 loci carrying
  `shared-protein-many-to-many` in `sister-strain-crosswalk-v1.tsv` are the same
  tags, and the four duplicated proteins the report names (`WP_011243185.1`,
  `WP_011242480.1`, `WP_011242807.1`, `WP_011242808.1`) are the four `evidence`
  values on those rows.

**What the agreement establishes, weighed.** The report is explicit about its
limits and they are accepted as stated. It verifies that the coverage counts and
the ambiguous set are reproducible from the pinned releases under the stated join
rule by code that did not read the implementation; it does not verify the 10,538
relationship rows one by one, because the dispatch reserved opening the file for
a disagreement. The dispatch supplied the target numbers, so this is a
reproduction against a known answer, mitigated by the derivation being mechanical
and fully described, and by the ambiguous-locus lists, which the dispatch did not
supply, matching the artifact tag for tag. The disclosure that a prior session
bulk-loaded `docs/validation/` into a variable, including
`sister-strain-crosswalk.md`, without surfacing its contents, is recorded and does
not change the verdict: the counts in that document are the same numbers the
dispatch itself supplied. A row-level second check remains available to request
if a sister-strain source is ever admitted.

Approved. The pangenome workbook gives these two strains pangenome IDs, coordinates,
and strand but no NCBI locus column, so no source keyed by their own RefSeq tags can
join until this exists.

Follow the
[identifier-crosswalk contract](../../validation/annotation-release-readiness.md#identifier-crosswalk-contract):
pin each strain's RefSeq annotation release with its checksum, join on exact shared
protein sequence or accession, admit one mapping per locus, and preserve ambiguity
instead of resolving it. Report matched, unmatched, and ambiguous counts. Until a
strain's crosswalk passes, its sources stay unadmitted.

### 2. Scan

Search per data type across the six strains. Record every candidate, including
rejected ones, with strain, assay, conditions, replicate count, genome build, licence,
artifact identifier, and whether a per-gene table is downloadable.

| Data type | Where to look |
| --- | --- |
| Transcriptomics | GEO, SRA, ArrayExpress, ENA; the iModulon ELPRECISE300 compendium already ranked in the roadmap |
| Proteomics | PRIDE, PeptideAtlas, MassIVE, ProteomeXchange |
| Ribosome occupancy | GEO/SRA ribo-seq submissions; cyanobacterial ribosome-profiling papers |
| TIS | ribo-seq initiation variants, TIS-profiling papers |
| TSS | dRNA-seq and Cappable-seq studies; Tan 2018 already shipped |
| TTS | Term-seq and Rend-seq; GSE309256 already ranked in the roadmap |
| Annotations | RefSeq, UniProt, InterPro, GO, KEGG, CyanoBase successors |

Deliverable: a ranked candidate table appended to
[future-data-roadmap.md](../../validation/future-data-roadmap.md), following its
existing admission contract. Do not download anything whose reuse terms are
unverified.

#### Result, 2026-09-28

Package A returned and passed intake. The 57
accepted candidates are in the
[package A candidate register](../../validation/future-data-roadmap.md#package-a-candidate-register-2026-09-28);
promotion to a ranked entry waits on packages B and C. Three findings change the
plan: ribosome occupancy, TIS, TSS, and TTS returned zero new candidates across all
six strains; PCC 6311, PCC 7943, and UTEX 3055 have no functional-genomics deposits
and contribute annotation only; UTEX 2973 has exactly one public deposit, Tan 2018,
already shipped. Every rejected row, kept so a later sweep does not re-raise it:

| Artifact | Assay | Reason |
| --- | --- | --- |
| GEO GSE104202; PMID 29239721 | ChIP-seq (not an admitted data … | ChIP-seq is not an admitted data type |
| GEO GSE106824; PMID 29241543 | ChIP-seq (not an admitted data type) | all 12 samples are `library_strategy = ChIP-Seq`, confirmed and reclassified by the package A correction returned 2026-10-03; the corrected table's `assay` cell still reads "transcriptomics (RNA-seq)" and is left as is, since the row is rejected either way |
| GEO GSE114693 | ChIP-seq (not an admitted data … | ChIP-seq is not an admitted data type |
| GEO GSE14225; PMID 19666549 | ChIP-seq (not an admitted data … | ChIP-seq is not an admitted data type |
| GEO GSE205444; PMID 35814646 | transcriptomics (RNA-seq) | shipped: PCC 7942 abundance table - recognised, not new |
| GEO GSE22468; PMID 21896749 | ChIP-seq (not an admitted data … | ChIP-seq is not an admitted data type |
| GEO GSE28430 | ChIP-seq (not an admitted data … | ChIP-seq is not an admitted data type |
| GEO GSE29264; PMID 21612627 | ChIP-seq (not an admitted data … | ChIP-seq is not an admitted data type |
| GEO GSE309256; PMID 41292882,42148773 | TTS (Term-seq/Rend-seq) | already ranked in future-data-roadmap |
| GEO GSE343576 | ChIP-seq (not an admitted data … | ChIP-seq is not an admitted data type |
| GEO GSE42542; PMID 23913328 | ChIP-seq (not an admitted data … | ChIP-seq is not an admitted data type |
| GEO GSE47015 | ChIP-seq (not an admitted data … | ChIP-seq is not an admitted data type |
| GEO GSE48901; PMID 24244001 | ChIP-seq (not an admitted data … | ChIP-seq is not an admitted data type |
| GEO GSE51093; PMID 24315105 | ChIP-seq (not an admitted data … | ChIP-seq is not an admitted data type |
| GEO GSE55637; PMID 26058805 | ChIP-seq (not an admitted data … | ChIP-seq is not an admitted data type |
| ENA PRJNA420395 / SRP125902; DOI 10.1186/s13068-018-1215-8 | TSS (dRNA-seq) + RNA-seq, prima… | already shipped as TAN2018_TSS - recognised, not new |
| RefSeq GCF_000817325.1 | annotation (RefSeq PGAP) | genome of record, already pinned |
| RefSeq GCF_000817325.1, listed a second time as PCC 6301 (package A data row 54) | annotation (RefSeq PGAP) | the accession is UTEX 2973 (NCBI taxid 1350461), not PCC 6301; a duplicate of the row above that the 2026-09-28 intake missed; found at package B and C intake 2026-10-04 and treated as rejected |
| PRIDE PXD010000 | proteomics (LC-MS/MS) | rejected by package B: a 51-organism re-processed benchmark set with no growth conditions for any organism and no publication of its own |

#### Correction to the rejected register, 2026-10-05

Found while answering the owner's question about further data sources, by
re-reading the GEO records fetched on 2026-10-04 and querying GEO, SRA, BioProject,
PRIDE and BioStudies directly. Package A marked thirteen series "ChIP-seq (not an
admitted data type)", and both intakes accepted that label without reading the
records' series type. Only four of the thirteen are ChIP-seq alone: GSE104202,
GSE106824, GSE343576 and GSE51093. **Seven are expression microarray series and two
are mixed series that include RNA-seq.** They are reinstated as candidates. None
has condition metadata or a licence decision yet, so none is admissible as it
stands. The same check found two sources the sweep never saw.

| Artifact | What the GEO or archive record says | Samples | Paper |
| --- | --- | --- | --- |
| GSE14225 | Expression profiling by array; "Circadian and diurnal expression data of Synechococcus" | 104 | PMID 19666549 |
| GSE22468 | Expression profiling by array; nocturnal expression, WT and kaiABC-null | 29 | PMID 21896749 |
| GSE28430 | Expression profiling by array; circadian expression in WT, rpoD6-, sasA- and rpaA-null | 21 | none linked |
| GSE42542 | Expression profiling by array; clpX overexpression | 4 | PMID 23913328 |
| GSE47015 | Expression profiling by array; circadian profile under kaiA overexpression | 9 | none linked |
| GSE48901 | Expression profiling by array; circadian profile without KaiC phosphorylation cycling | 12 | PMID 24244001 |
| GSE55637 | Expression profiling by array; dark or light, with or without photosynthesis | 28 | PMID 26058805 |
| GSE114693 | Mixed: 72 RNA-Seq and 6 ChIP-Seq; RpaA-dependent sigma factor cascade; two supplementary tables | 78 | none linked |
| GSE29264 | Mixed: 3 RNA-Seq, 6 ChIP-Seq and a tiling array; "A high resolution map of a cyanobacterial transcriptome"; strand-specific coverage files | 13 | PMID 21612627 |
| PRIDE PXD082340 | Label-free proteomics of SeOmp85 mutants, PCC 7942; licence field CC0; published 2026-09-30, after the sweep | — | not yet read |
| ArrayExpress E-MEXP-1657 | Transcription profiling of wild type and two mutants with and without iron; in ArrayExpress only, not mirrored from GEO | — | not yet read |

GSE29264 is also the first transcription-start-site candidate for a sister strain:
its paper maps start sites genome-wide in PCC 7942, which contradicts the
2026-09-28 result that no new TSS candidate exists. That is from the paper's title
and the deposit's coverage files and still needs the paper read.

Checked and unchanged: GEO holds no UTEX 2973 series and no series for PCC 11801,
PCC 11802, UTEX 3055 or UTEX 3154; all 49 GEO series for the organism were already
in the sweep. SRA holds 18 UTEX 2973 experiments, 17 of them Tan 2018 and one a
genome resequencing project. The BioStudies free-text search is now done: 18 ArrayExpress entries, 17 of them mirrors of GEO series
already known.

#### Result, 2026-10-04

Packages B and C returned 2026-10-03 and passed intake 2026-10-04, B with two
rows returned for relabelling; the package A correction returned 2026-10-03 and
passed; the two corrections are detailed in
[`RET_claude-science-session__20261003.md`](../handoff/RET_claude-science-session__20261003.md#b2-the-two-intake-corrections-checked).
Condition metadata is in `cyano_package_B_conditions_20261003.tsv` (88 rows, one
per condition set), licence evidence in `cyano_package_C_licences_20261003.tsv`,
and the per-artifact licence decisions in
[source-ledger.md](../../validation/source-ledger.md#licence-decisions-for-the-package-a-candidates-2026-10-04).
The register in the roadmap carries the per-artifact outcome. Three things this
step now knows that the 2026-09-28 result did not:

- **Four input rows were mislabelled and are escalated, not scored.** GSE104204 is
  a mixed series (37 ChIP-seq, 60 RNA-seq); GSE50922 is a four-platform
  SuperSeries (71 array, 19 ChIP-seq, 18 RNA-seq) whose four growth protocols cut
  across the assay arms; GSE205443 is RB-TnSeq fitness data, not transcriptomics,
  and GSE205445 is 25 RB-TnSeq plus 21 RNA-seq. GSE205443 may be wanted as a
  fitness screen, which is a different data type from any admitted here and would
  need its own ticket and an owner decision.
- **Two PRIDE strains are resolved.** PXD011485 is *S. elongatus* PCC 11801, not
  one of the six admitted strains and not in the pangenome, so it has no mapping
  route and leaves the programme. PXD014590 is UTEX 2973 itself: native, no
  cross-strain transfer, and the only native deposit beside Tan 2018.
- **GSE103606 is a SuperSeries** whose 94 RNA-seq samples are exactly the union of
  GSE103462, GSE103463, GSE103644, GSE103704 and GSE105774. The five SubSeries are
  the datasets; the SuperSeries row is a container and is not scored as a pair
  member.

Package B's 29 `escalate` rows, by study and reason, kept here so step 3 and
package D treat them correctly:

| Artifact | Rows | Reason returned |
| --- | --- | --- |
| GSE104204 | 3 | mixed ChIP-seq/RNA-seq series, input assay label wrong |
| GSE205443 | 3 | RB-TnSeq, not transcriptomics |
| GSE205445 | 4 | RB-TnSeq arm plus RNA-seq arm; several sets use conditioned medium |
| GSE335065 | 4 | 9 of 36 samples are *S. elongatus* + *Rhodotorula toruloides* co-culture; held out as its own set |
| GSE50922 | 4 | four-platform SuperSeries, assay arms do not align with condition sets |
| PXD000510 | 1 | conditions only partly obtainable; paper outside the Europe PMC OA subset |
| PXD005851 | 1 | 48-organism deposit; *S. elongatus* arm extracted from Table S1 (22 °C, unshaken) |
| PXD011485 | 4 | strain is PCC 11801, outside the six admitted strains |
| PXD014590 | 1 | strain is UTEX 2973, the genome of record; carried-over crosswalk route does not apply |
| PXD023591 | 1 | no growth conditions obtainable; no publication |
| PXD027430 | 1 | paper outside the Europe PMC OA subset; conditions not obtainable |
| PXD036717 | 1 | paper has no resolvable OA deposit; conditions not obtainable |
| PXD044412 | 1 | four-organism deposit; no growth temperature reported for the cyanobacterial arm |

Two archive-record conflicts B found are recorded for package D and the
depositors, not resolved: GSE252562's six samples titled `LD8:16` whose
characteristics read `LD16:8`, and GSE122841's four samples against a design
stating triplicates.


### 3. Decide how datasets combine

The thresholds are now written down. This step applies them and reports the result.

- Score every candidate pair against each axis of
  [condition comparability](../../validation/data-contract.md#condition-comparability)
  and record the verdict with the failing axis where one fails.
- Choose and justify a normalization per data type. Within-source percentile or rank
  is the contract's default; a stronger calibration needs a validated cross-study
  model.
- Report the agreement statistic between overlapping datasets and show it in the
  interface. A poor fit is displayed, never averaged away.
- Add a pair whose comparability is genuinely uncertain to rows 13 through 15 of
  [AAAA-new-bio-decisions-to-review.md](../../validation/AAAA-new-bio-decisions-to-review.md)
  with its assay, both condition sets, and the marginal axis.
- Keep both source values where two strains disagree at one locus; any resolution is
  a separate `inferred` field naming its rule.

Raw per-source fields are never merged. A combined view is an additional layer with
its own inputs, method, and uncertainty.

### 4. Gene viewer — first version shipped 2026-09-27

Built and validated in the browser. It draws one gene in transcription orientation
in both side columns, from offsets against the annotated start rather than genomic
position, which is the frame sister-strain positional evidence has to arrive in. The
contract, the evidence boundaries, and the rendered checks are in
[controls-column-and-resets.md](../../validation/controls-column-and-resets.md).

Shipped: the coding span with each `cdsSegments` piece and the gap between them, the
initiation triplet and terminal stop as marks with a readable minimum width, native
Tan 2018 start sites at the distances that study published against its own gene
model, the splice and translational-exception flags, and a sentence-level accessible
description. Verified against the spliced `M744_RS00920` and the multi-site
`M744_RS08615`.

Still to build. The 2026-09-28 sweep returned no new ribosome-occupancy, TIS, TSS,
or TTS candidate for any admitted strain; its one TTS hit, `GSE309256`, is already
ranked in the roadmap and not admitted. The first two items below are therefore
gated on data that is not admitted, not on this ticket's progress. The viewer states
that absence in its accessible description rather than leaving an empty track
(built 2026-10-02; see "The recorded absence" in
[controls-column-and-resets.md](../../validation/controls-column-and-resets.md)),
and the overlay code is not built ahead of a source.

- sister-strain TSS, TIS, and TTS overlays, drawn as offsets against a named UTEX
  locus and labelled with strain, study, and condition, visibly transferred;
- ribosome occupancy as a positional track where a source supports one, and as a
  per-gene value otherwise;
- the flanking-neighbour context; the explicit [-30,60) start window is now drawn
  base by base, by the pinned gene's sequence close-up, shipped 2026-09-30 (see
  [gene-sequence-closeup.md](../../validation/gene-sequence-closeup.md)). Whether
  the small gene visualizer also needs it as a separate band is still open.

### 5. Chromosome visualizer

Owner correction, recorded 2026-09-27: this is a chromosome visualizer, not a
plasmid visualizer. UTEX 2973 has one distinct chromosome, `NZ_CP006471.1`, and the
owner's correction records that this one chromosome is present in multiple copies per
cell, as cyanobacterial polyploidy. Polyploidy is a copy-number property of the
single chromosome, not a set of distinct chromosomes, so it adds no second coordinate
system to draw. It does mean that every per-gene value on this view is per genome
copy and never a per-cell dosage. The copy number varies with growth condition, and
no source in this repository records it, so the view states none.

The [genome of record](../../validation/genome-provenance.md#genome-of-record)
has three sequences. The chromosome is 2,690,418 bp and carries 2,655 of the 2,715
plotted CDSs. The plasmids `NZ_CP006472.1` (46,366 bp) and `NZ_CP006473.1`
(7,842 bp) carry 54 and 6 plotted CDSs. The pangenome workbook labels those two
replicons `pANL-pMAL` and `pANS` in its `Chromosome` column and gives their UTEX
rows the separate `pgB` and `pgC` locus series (`UTEX2973_pgB001`,
`UTEX2973_pgC001`), so plasmid loci join by the same per-locus routes as
chromosomal ones.

### It is its own tab

Owner decision, recorded 2026-09-28. The chromosome view is a **separate
selectable tab in the existing tablist**, exactly as Native codon space, Metric X
vs Y, Lengths, Regulatory sites, and Citations & sources already are. It is not a
mode of the scatter map and not a panel in a side column.

The tablist is built from `ALL_TABS` in `site/js/app.js`, which is `PANELS` from
`site/js/ui/panels.js` followed by the standalone tabs. A tab that is not a
scatter projection follows the pattern the Lengths, Regulatory sites, and
Citations tabs already use, so this view is built the same way:

- export a frozen descriptor from its own module, with `id`, `name`, `blurb`, and
  `source`, as `LENGTH_TAB` in `site/js/ui/length-explorer.js` does;
- add it to `ALL_TABS`, and give it its own `role="tabpanel"` container in
  `site/index.html` beside `length-view`, `regulatory-view`, and `citations-view`;
- follow the active-tab branch in `renderCurrentView`, which sets the blurb from
  the descriptor and shows one panel at a time;
- take a layout class on the layout element if it needs a different column count,
  as `lengths-active` and `regulatory-active` do in `workspaceColumns` in
  `site/js/ui/workspace-resize.js`. Decide deliberately whether the gene detail
  column stays open beside it.

The tab id is what `p` in the URL hash carries, so a link opens straight onto this
view. Choosing an id means choosing that permanent URL token; `chromosome` is the
obvious one. Adding a tab needs no change to the encoder, because `p` already
accepts any id in `ALL_TABS` and falls back to `native` for an unknown one.

Because it is a tab rather than a replacement, shipping it does **not** by itself
retire the native codon-space PCA. That remains open question 4 and stays a
separate, explicit decision.

**Built and merged 2026-09-28** (DEM-148, claude-implementer; reviewed by DEM-150,
codex-reviewer, and independently rendered by DEM-151, claude-ui-inspector;
accepted after two fix rounds; on `main` as `c211149`, `77434f7`, `bc3078b`, and
`d015a97`). The contract is [chromosome-view.md](../../validation/chromosome-view.md).
The design decisions below were confirmed by the owner on 2026-09-28 and are what
shipped:

- **Linear, not circular.** A 2.69 Mb chromosome cannot share one circle or one scale
  legibly with a 46 kb and a 7.8 kb plasmid, and a linear track zooms and shares its
  horizontal axis with the gene viewer. The origin is position 1 of `NZ_CP006471.1`.
  The two circular-origin CDSs, `M744_RS13290` and `M744_RS13620`, are drawn as their
  two `cds_segment` rows joined across the ends with a wrap marker, never as a span
  beyond the replicon length.
- **The chromosome is the primary track; the two plasmids are explicit secondary
  tracks.** Each plasmid is drawn beneath the chromosome at its own scale, labelled
  with accession, length, and plotted CDS count. Plasmid coordinates are never
  concatenated onto the chromosome axis, and the plasmid tracks are never hidden,
  because their 60 CDSs are part of the plotted set.
- **Same genes as every other view.** The dots are the same 2,715 CDSs; pinning,
  colour, filter, and selection state carry over under
  [viewer-interaction-state.md](../../validation/viewer-interaction-state.md). This is
  the whole-replicon map and the gene viewer in section 4 is the zoomed locus:
  selecting a CDS here opens it there. Metric X vs Y is unchanged.
- **Metrics and evidence layers.** Each CDS is a mark at its UTEX coordinate, above or
  below the axis by strand, coloured by the existing colour selector: the reviewed
  function category or any registered metric, such as CAI, tAI, ENC, GC3, rare-codon
  fraction, or expression percentile with its basis label, each keeping the evidence
  label it already carries. Borrowed PCC 7942 essentiality stays candidate evidence
  in the detail panel, as today. Operon membership from `operonId` is drawn as a
  bracket. Native Tan 2018 TSS features are measured on this assembly and may be
  placed at their absolute coordinates.
- **Sister-strain positional evidence arrives as gene-relative offsets.** Coordinates
  do not transfer between strains, so a TSS, TIS, or TTS from an admitted sister
  strain reaches this view only as an offset against a named UTEX locus, drawn
  anchored to that locus and labelled with strain, study, and condition. At
  chromosome scale it collapses to a mark on the gene; the offset detail belongs to
  the gene viewer. No sister-strain coordinate is ever placed on the axis directly. A
  missing sister-strain value, especially from UTEX 3055, renders as absent, never as
  zero.

Retiring the native codon-space PCA, whose scores are `codonPca` in `genes.json`
and whose loadings are `codon_pca.json` behind the "What drives these axes" table,
is a separate step now that this view is its own tab. It is a user-facing removal,
so confirm the intent before
deleting the view, its loadings table, the audit documentation
([pca-length-sensitivity.md](../../validation/pca-length-sensitivity.md)) and its
script `tools/audit_pca_length.py`, the validation index row, and the reference in
row 9 of
[AAAA-new-bio-decisions-to-review.md](../../validation/AAAA-new-bio-decisions-to-review.md).
The recoding-risk, perturbation, and UMAP maps are computed live and are outside this
decision unless the owner extends it.

### 6. Dataset and condition selectors

Requested behaviour:

- Where a metric has several conditions, a control at the bottom of the view selects
  among them. Low-light versus high-light proteome is the motivating case.
- The user can select a single paper's dataset to display.
- The user can select several at once as separate layers, always (owner decision
  2026-10-05, replacing "when a defensible normalization exists"). A warning and the
  agreement statistics appear when the shown datasets have no recorded pair
  judgement.

#### Owner design, 2026-10-05

The owner reviewed the Claude Science mockup
(`docs/notes/handoff/cyano_dataset_panel_mockup_20261005.html`), approved the
selection screen, and fixed how it enters the site. This replaces the proposal in
the returned architecture document to add a fourth controls-column panel.

- **A "Data Sources" section directly below "Color by"** in the controls column.
  Opened, its dropdown lists the data sources currently selected. The section can be
  hidden.
- **A button labelled "Change Data Selection"** opens a centre peek: a panel over the
  middle of the page holding the full data selection window from the mockup, with
  the comparison panel beside it where the width allows.
- **While the peek is open the page behind it is dimmed and not clickable.** It
  therefore needs a real modal: focus moved in and trapped, Escape and a close
  control, focus returned to the button, and the background inert to pointer,
  keyboard and assistive technology.
- **Explanations stay out of the way.** A small help or info icon opens a popover on
  hover or click; anything longer opens in a side or centre peek. No standing
  explanatory lines. A later human pass to reduce clutter is
  [O_ui-clutter-human-audit__20261005](O_ui-clutter-human-audit__20261005.md).
- **Defaults, delegated to the agents.** The default selection is the standard
  photoautotrophic growth group plus the layers already shipped, so an existing link
  shows what it showed before; if that group is empty for a data type, the group
  holding the most datasets. Two datasets that disagree are both shown with the
  conflict marked. The six illustrative groups of the mockup stand until someone
  names better ones.
- **Tabs and platforms.** Transcriptomics, proteomics, and fitness screens each get
  their own tab. Array datasets are listed apart from RNA-seq by default; the
  RNA-seq selection has an option to include them, and an array row says it is an
  array and how many targets it covers.
- **Statistics.** Level correlation against each dataset's replicate band, and
  fold-change agreement where both sides have their own control. Distribution
  comparison is a units check only. No pass mark.

#### Owner design, second round, 2026-10-05

Further requirements from the owner after reviewing the first mockup. All are
built into a revised prototype,
`docs/notes/handoff/cyano_dataset_panel_mockup_v2_20261005.html`, which was
rendered and exercised at 1440, 1280, 768 and 375 px with no script error.

- **Tick marks in every row.** Each condition track carries the scale's tick marks,
  aligned with one labelled axis in the sticky header, so a value can be read
  against the scale in place. No mark, label or chip may overlap another.
- **CO₂ scale.** Linear from 0 to 5.5%, with ticks at each whole percent. No
  admitted condition set exceeds 5%, and the useful resolution is between 1 and 5%.
- **Custom filters.** Besides the groups, the reader adds filters of their own: a
  range on temperature, light or CO₂, or a choice of strain, platform, light
  regime, medium or treatment, or text in the study name. A range filter says
  whether it also keeps rows that do not report the value. "Select all shown"
  selects whatever the filters leave.
- **An info button on every dataset.** It opens, beside the table, each condition
  as the source reports it, with the quoted sentence and where it was found, the
  replicate statement, the per-gene table, and the citation with a link to the
  paper and to the archive record. The aim is a table of objective facts that
  helps a reader choose what to show.
- **Subgroups inside a group.** Where a group holds sets that are comparable with
  each other, each such set is its own subgroup with a select-all box. Sets with no
  comparable partner are gathered under one heading with no select-all box. A group
  that would have only one subgroup shows none.
- **Data-type tabs stay available in the peek** whatever the map shows; the tab the
  peek opens on follows the map's current metric.

Assumptions made to build the prototype, each put to the owner as a question:

- Two condition sets are comparable for subgrouping when every axis both report
  passes the default thresholds, at least three axes are reported by both, and
  their treatment tags match. An axis only one side reports neither passes nor
  fails. The owner's pair judgements override this in both directions, read as
  the lab-facing review document records them: pair 24's "fine, as long as the
  lights aren't changing in one and constant on the other" groups its two sets
  only where both report the same kind of light regime, and pairs 9 and 10 are
  affirmative with a qualification or a follow-up. A subgroup is a set in which
  every member is comparable with every other.
- The top-level "Other" group also has no select-all box.
- Selection is per condition set, not per study.
- The colour-blind check failed for the first mockup's green and orange. The
  prototype uses three validated hues; position, not colour, carries the value.

Moved 2026-10-05 to its own ticket,
[O_data-sources-selection__20261005](O_data-sources-selection__20261005.md),
which carries the third round of owner decisions (where a source is chosen in the
filters, the axes and the projection views; per-study row colours with a legend)
and the build stages. Step 6 is complete in this ticket when that one ships.

Still to design: placement at each breakpoint, URL-hash encoding, interaction with the
existing colour, axis, and filter selectors, and what happens to genes missing from
one selected dataset. Follow
[responsive-workspace.md](../../validation/responsive-workspace.md) and
[viewer-interaction-state.md](../../validation/viewer-interaction-state.md).

## Open questions for the lab

1. **Default view.** When several datasets cover one gene, does the site open on the
   native UTEX value, the newest, the best-replicated, or a combined estimate?
2. **Disagreement.** When two datasets in the same condition disagree sharply, does
   the site show both, show neither, or show both with the conflict flagged?
3. **Scope of the reference.** Is the audience the recoding-panel workflow this site
   was built for, or general *S. elongatus* lookup? The second implies genes and
   features outside the 2,715 screened CDSs, which is a schema change.
4. **PCA retirement.** The chromosome view ships as its own tab, so retiring the
   native codon-space PCA is now a separate decision rather than a consequence of
   building it. Confirm whether that PCA is removed once the chromosome tab exists,
   since that deletes a view and its audit trail, and state whether the live
   recoding-risk and perturbation PCA maps are also retired or stay.

## Verification

**Verified.** The PCC 6311/7943 crosswalk (step 1) shipped with its manifest entry,
checksums, contract tests, and matched/unmatched/ambiguous counts:
[sister-strain-crosswalk.md](../../validation/sister-strain-crosswalk.md).
The chromosome tab (step 5) shipped with rendered validation at mobile, tablet,
and desktop widths: [chromosome-view.md](../../validation/chromosome-view.md).

**Verified 2026-10-04.** The crosswalk's independent Claude Science second check
returned and agrees on every count and every ambiguous locus (results block under
step 1), so PCC 6311 and PCC 7943 sources are no longer held back by this
ticket; none exists yet. Packages B and C passed intake; their source evidence is
in the [returned manifest](../handoff/RET_claude-science-session__20261003.md),
with reusable checks in the [intake contract](../../validation/claude-science-handoff.md#intake).

**Pair scoring (step 3)**: package D returned 2026-10-04 and passed intake
2026-10-06; its [returned manifest](../handoff/RET_claude-science-session__20261004.md)
pins the source table: 0 of 941 pairs
comparable on the thresholds alone, 32 escalated and all judged by the owner on
2026-10-05, 178 undecidable for missing metadata, 731 not comparable. Under the
owner's 2026-10-05 decisions (thresholds a default screen; J1, J3, J4, J10) the
comparable sets are computed by `site/js/core/data-sources.js` from the
structured condition records and those judgements, which is what the Data
Sources peek shows. The dataset and condition selectors (step 6) are built
under the dedicated ticket. Any source ingested later still needs its own manifest entry, checksum,
mapping audit with matched, unmatched, and ambiguous counts, contract tests, and
the sister-strain, condition-comparability, and UTEX 3055 coverage rows of
[release-gate.md](../../validation/release-gate.md)
checked against the rendered site.

## Cleanup

On resolution, distil the crosswalk runbook, the per-type normalization defaults, the
positional-offset display contract, and the multi-dataset selector contract into
`docs/validation/`, update `validation/INDEX.md`, then delete this ticket and its
index row.
