# RET_claude-science-session__20260930 — Claude Science session return

**Read this before picking up any ticket opened 2026-09-30.**

```
requester:   owner
target:      mythos / fable
ticket:      the thirteen tickets opened 2026-09-30, reviewed as a batch
package:     queue review — priority, accuracy, completeness, and Claude Science
             routing for the 2026-09-30 batch
scope:       this file only. No code, data, site file, existing ticket, or index
             row was modified by this session
acceptance:  the hard boundaries and results-block format in
             docs/validation/claude-science-handoff.md
status:      returned
opened:      20260930
updated:     20260930
```

This is a manifest and an evidence return, not a second contract. The mechanism
stays [claude-science-handoff.md](../../validation/claude-science-handoff.md).
Everything below is **evidence and recommendation**. Nothing here admits a
source, grants a licence, performs a join, or settles a lab decision.

## In-flight work this return does not touch

At the time of this review, `main` is at `4218254`, clean, four commits ahead of
`origin/main`. DEM-174 is dispatched on `fix/dem-171-review` from `b6e21e9` in a
scratchpad worktree, repairing the review findings on
[A_zoomed-out-visual-priority__20260929](../tickets/A_zoomed-out-visual-priority__20260929.md).

This session therefore changed **no** file under `site/`, no test, no validation
document, no ticket, and not `docs/notes/tickets/INDEX.md`. Every queue change
recommended below is written as a recommendation for the coordinator to apply,
so that the index row for the active ticket stays under DEM-174's control and
no reorder lands on top of the repair commit. The only new file is this one, in
`docs/notes/handoff/`, which no in-flight branch writes to.

The recommendations below are also deliberately confined to the 2026-09-30
batch. None of them changes the acceptance criteria, the paint-priority rule,
or the disclosure wording that DEM-174 is working against.

## 1. Findings that change the queue

### 1.1 Three of the six BioCyc tickets have no database behind them

BioCyc `organism-summary` **silently falls back to *Escherichia coli* K-12
MG1655 when an orgid does not exist.** It returns HTTP 200 and a fully rendered
page. Verified with a deliberately invalid control:

| Probe | HTTP | Page served |
| --- | --- | --- |
| `?orgid=GCF_999999999` (control, invalid) | 200 | Summary of *Escherichia coli* K-12 substr. MG1655, version 30.0 |

Probing the six strains on 2026-09-30 against BioCyc version 30.0:

| Strain | Ticket | orgid probed | Result |
| --- | --- | --- | --- |
| UTEX 2973 | [biocyc-utex-2973](../tickets/O_biocyc-utex-2973-data__20260930.md) | `GCF_000817325` | **real PGDB**, Tier 3 Uncurated |
| PCC 6301 | [biocyc-pcc-6301](../tickets/O_biocyc-pcc-6301-data__20260930.md) | `GCF_000010065` | **real PGDB**, Tier 3 Uncurated |
| PCC 7942 | [biocyc-pcc-7942](../tickets/O_biocyc-pcc-7942-data__20260930.md) | `GCF_000012525` | E. coli fallback — but a PGDB exists at `SYNEL`, see 1.2 |
| PCC 6311 | [biocyc-pcc-6311](../tickets/O_biocyc-pcc-6311-data__20260930.md) | `GCF_022984265` | E. coli fallback; **no PGDB found** |
| PCC 7943 | [biocyc-pcc-7943](../tickets/O_biocyc-pcc-7943-data__20260930.md) | `GCF_022984345` | E. coli fallback; **no PGDB found** |
| UTEX 3055 | [biocyc-utex-3055](../tickets/O_biocyc-utex-3055-data__20260930.md) | `GCF_003957805` | E. coli fallback; **no PGDB found** |

Because a fallback page is indistinguishable from a hit by status code, absence
was confirmed by a second, independent route: the published PGDB list at
`https://biocyc.org/biocyc-pgdb-list.shtml`. That page contains entries for
`Synechococcus sp. UTEX 2973`, `Synechococcus elongatus PCC 6301`, and
`Synechococcus elongatus PCC 7942`, and contains **no** occurrence of
`PCC 6311`, `PCC 7943`, or `UTEX 3055`. The same search method does find the
three strains that exist, so it is sensitive enough for the negative to mean
something.

This compounds a finding the 2026-09-28 session already returned: those same
three strains have **zero** functional-genomics deposits — no GEO series, no ENA
records — and contribute annotation only. They are now empty on both axes.

**What this does and does not settle.** It answers D2 on those three tickets —
"verify a BioCyc database actually represents this strain" — with a sourced
*no*. It does **not** settle whether the tickets have value, which depends on
what the owner wants those strains for; see question Q1 in section 10. Re-check
the availability finding if BioCyc publishes a version past 30.0.

### 1.2 The one curated PGDB is on the strain whose ticket sits near the bottom

The BioCyc PGDB list links organisms as `?object=<ORGID>`, not `?orgid=`, and
uses mnemonic ids for curated databases. *Synechococcus elongatus* PCC 7942 is
present as **`SYNEL`**:

| PGDB | orgid | Tier | Genes | Pathways | Enzymatic rxns | Compounds | Transcription units |
| --- | --- | --- | --- | --- | --- | --- | --- |
| *S. elongatus* PCC 7942 | `SYNEL` | **Tier 2 Curated** | 2,775 | 241 | 1,191 | 950 | 1,976 |
| *Synechococcus* sp. UTEX 2973 | `GCF_000817325` | Tier 3 Uncurated | 2,755 | 244 | 1,223 | 938 | 1,969 |
| *S. elongatus* PCC 6301 | `GCF_000010065` | Tier 3 Uncurated | 2,720 | 244 | 1,212 | 910 | 1,949 |

The PCC 7942 database is credited to Caspi, Shearer, and Karp (SRI
International). The two Tier 3 databases are machine-generated, credited to
Subhraveti, Keseler, Kothari, Caspi, and Karp.

Two consequences:

- **PCC 7942 is the most valuable of the six by a wide margin.** It is the only
  curated database, and it is also the strain that carries every one of the
  functional-genomics candidates in the 2026-09-28 Package A table — 33
  transcriptomics and 12 proteomics rows, against zero for four of the other
  five. Its ticket currently sits tenth of thirteen, below three strains that
  have nothing.
- **The UTEX 2973 ticket's premise needs softening.** A Tier 3 uncurated PGDB is
  generated automatically from the RefSeq annotation for the same assembly this
  repository already pins (`GCF_000817325.1`). Its gene and product annotations
  are therefore largely a re-presentation of data already shipped. What is
  genuinely additive is the inferred pathway/reaction layer and the 1,969
  predicted transcription units — and those are **computational predictions**,
  which the ticket must label as such under the no-prediction-as-measurement
  boundary. "Strengthen the project's evidence" overstates what a Tier 3 PGDB
  offers.

### 1.3 GtRNAdb adds no tRNA locus the repository does not already have

The page the tRNA ticket could not read is reachable. Its content settles D1
outright.

GtRNAdb's UTEX 2973 entry is a **tRNAscan-SE v2.0.2 (February 2019)** run,
started 2019-04-23, bacterial mode, Infernal, models `TRNAinf-bact.cm` and
`TRNAinf-bact-SeC.cm`, first-pass cutoff 10, on assembly `GCA_000817325.1`
(`ASM81732v1`) — the GenBank counterpart of the repository's pinned
`GCF_000817325.1`.

The repository's own pinned run in `data/trna/independent_run/trnascan.stats` is
**tRNAscan-SE v2.0.12 (Nov 2022)**, same mode and models, on
`GCF_000817325.1_ASM81732v1_genomic.fna`. Every reported statistic agrees:

| Statistic | Repo pinned run (2.0.12) | GtRNAdb (2.0.2) |
| --- | --- | --- |
| Sequences read | 3 | 3 |
| Bases read | 2,744,626 | 2,744,626 |
| Bases in tRNAs | 3,716 | 3,716 |
| First-pass tRNAs predicted | 48 | 48 |
| Average tRNA length | 77 | 77 |
| Candidate tRNAs read | 48 | 48 |
| Infernal-confirmed tRNAs | 45 | 45 |
| Bases scanned by Infernal | 4,676 | 4,676 |
| Decoding standard 20 AA | 44 | 44 |
| Selenocysteine / suppressor / undetermined | 0 / 0 / 0 | 0 / 0 / 0 |
| Predicted pseudogenes | 1 | 1 |
| Total tRNAs | 45 | 45 |
| tRNAs with introns | 0 | 0 |

The per-isotype anticodon breakdown matches as well, including Ala 4, Ser 4,
Arg 4, Leu 4, Ile 3, Met/fMet 2, Cys 2, and single copies of Phe, Asn, Lys, Asp,
Glu, His, Gln, Tyr, and Trp.

So a two-version-newer local run reproduces GtRNAdb exactly. GtRNAdb is not an
independent source for this genome; it is the same tool on the same assembly.
Its only content the repository does not already hold is presentational: the
HMM and 2'-structure score breakdown, the sequence alignments, the mature-tRNA
FASTA, and the three first-pass candidates that Infernal dropped (48 → 45),
which the repository's `comparison.json` does not enumerate. Per-locus
tRNAscan-SE scores are already present in that file (`scan_score`).

**What this settles.** D1's factual half: GtRNAdb is the same tool on the same
assembly, so it is not an independent source and admitting it would not add a
locus. The ticket's other content is untouched — CS-1's score-semantics
question and the UI decision about presenting a 45-locus feature class are both
still fully open. Whether the three dropped first-pass candidates and the
HMM/structure score breakdown are worth a pull is a scientific judgement, not
one this evidence forces; see Q3 in section 10.

### 1.4 iDOG does promoter *design*, not promoter *prediction*

**Correction, 2026-09-30.** An earlier draft of this return stated that iDOG
contains no promoter machinery at all. That was wrong, and the error was
mechanical: the file inventory it rested on was truncated at 40 of the
repository's 44 entries, which dropped the `yeast_elements/` directory, and the
`promoter` search covered five modules rather than the tree. The owner caught
it. The inventory below is from a full clone and covers every file, including
the bytecode-only modules. The corrected finding is narrower and more useful
than the one it replaces.

`jayman1466/iDOG` at head `9d71187f0b2eb27ee681918927e12850470a0688`
(2022-04-01), **MIT licensed** — a fact the ticket does not currently record.
The name expands to **inter-Domain Operon Generator**.

**What promoter machinery exists.** `promoter` occurs in six files:
`yeast_elements/promoters.csv`, `operon_design` and `web_operon_design` (shipped
as `.pyc` only), `dnaplotlib.py` and its bytecode, and `plot_operon.py`. The
`operon_design` module reads `yeast_elements/promoters.csv` and
`yeast_elements/terminators.csv`, carries a hardcoded **Bacteriophage T7
promoter** (`TAATACGACTCACTATAGGG`) and a T7 terminator, assembles these with
generated RBSs and codon-optimized CDSs into an operon, emits it as an annotated
GenBank record ("Generated with iDOG"), and renders it through dnaplotlib
promoter glyphs.

**The promoter library is the substantive asset:**

| Property | Value |
| --- | --- |
| Promoters | 48, `YP1`–`YP48` |
| Columns | `Promoter_name`, `Strength`, `Sequence`, `Core` |
| Measured strength range | 49.94 to 1080.93 — a **21.6-fold** span |
| Core-element index | 0–8 |
| Sequence lengths | 161, 171, 181 nt |
| Shared architecture | `ccgcgcc` spacer and a `TATAAAAG` TATA box in **48/48**; six shuffled upstream blocks each in 27–35 of 48 |
| Terminators | 25, sequence only — **no strength column** |

So the design capability is real, and it is quantitative on the yeast side. But
it is a **strength-annotated parts library with a modular shuffle**, not a
learned sequence-to-activity model: there is no fitted model object anywhere in
the repository, and the bacterial promoter is a single fixed T7 sequence with no
strength value at all.

**What is still absent is prediction.** Nothing in iDOG takes genomic sequence
and returns promoter locations. That is what the ticket's CS-1 asks about, and
that claim is refuted — but it is refuted as *capability absent*, not as *the
tool is unsuitable*, and the two are very different for the owner's stated
direction below.

**No published validation.** The README's citation and web-interface links are
unfilled placeholders — literally `[Jaymin's Paper]` and `[Website]`. PubMed
returns zero records for `"inter-domain operon generator"` and zero for a Patel
operon or host-range paper in 2020–2026.

### 1.4a Owner direction: keep this ticket open

**The owner has stated that iDOG's promoter *design* capability is the point of
interest, and intends to revisit refitting it toward promoter prediction after a
deeper literature and code review of the repository. This ticket is not to be
closed, resolved, or run through its Cleanup section.** An earlier draft of this
return recommended closing it on the negative finding; that recommendation is
withdrawn.

Two things a future session should know before that review, because they shape
what "refit" can mean:

- **There is no model to refit.** `promoters.csv` is a lookup table. Producing a
  predictor means fitting one, with the library as a worked example of the data
  shape rather than as a starting model. The `Core` index and the shared
  `ccgcgcc`/`TATAAAAG` scaffold show the library was built by combinatorial
  shuffling of a small element set, so its 48 rows sample a designed space, not
  natural promoter diversity.
- **Design-strength prediction and location prediction are different problems
  with different labels.** Predicting the strength of a candidate promoter needs
  sequence–activity pairs; locating promoters in the UTEX 2973 genome needs
  positional labels. The repository's only labelled positional evidence is Tan
  2018, and the 2026-09-28 sweep returned zero further TSS candidates across all
  six strains. Any refit toward location prediction inherits that single dataset
  and its single condition. These should be two separate claim rows, not one.

Three further facts the ticket should carry:

- The bundled codon tables are `escherichia_coli`, `bacillus_subtilis`, and
  `saccharomyces_cerevisiae` only, with `escherichia_coli` as the default. There
  is **no cyanobacterial codon table**.
- `create_RBS` takes an `rRNA_sequence` parameter defaulting to `"ACCUCCUUA"`,
  an *E. coli*-derived anti-Shine-Dalgarno sequence. See section 5.1.
- The bundled TransTermHP binary is an **x86 Linux** build; the README states
  arm64 requires recompiling from source. That bears directly on the Mac mini
  and Jetson Orin Nano fallbacks in the folding-backend ticket, both of which are
  arm64.

A disambiguation line is also worth adding: **"iDOG" also names the Integrated
Dog Genome database** at CNCB/NGDC. A future literature sweep on the bare
acronym will return canine genomics. Pin the repository URL and the expansion.

### 1.5 The only unblocked in-repo work in the batch is ranked third

Under the repository's own rule — claims gate steps, not tickets —
[the subsequent regulatory-site viewer validation](../../validation/viewer-interaction-state.md#start-site-marks-that-land-on-each-other)
records the item in the thirteen that needed no claim, no new source, no owner
decision, and no external access: audit whether every valid mapped Tan 2018 site
actually rendered through `tssMarks()`, and repair any omissions. At the time of
this return no rendered completeness check had been performed, so this was a
possible live defect in shipped evidence display ranked below two tickets that
could not move at all.

[pinned-gene-sequence-viewer](../tickets/O_pinned-gene-sequence-viewer__20260930.md)
is the second-most actionable: also claim-free, gated only on owner answers to
its eight layout questions.

By contrast [folding-compute-backend](../tickets/O_folding-compute-backend__20260930.md)
is ranked second while its D1 — an active Bouchet account — is not yet held by
the owner, and nothing in its workload/host matrix can be measured until it is.

### 1.6 Reopened on owner request: homologs, and what *E. coli* actually adds

The owner asked whether anything can be pulled for UTEX 2973 from the distantly
related strain or from *E. coli*, as gene-homolog data or annotation transferred
from homologous genes. This is well-founded under the repository's own contract:
[data-contract.md](../../validation/data-contract.md) ranks evidence sources and
places "a conserved bacterial model such as *E. coli*" at rank 4, admits
"ortholog-level functional assignment" as a data type, and already defines the
`transferred` evidence basis for exactly this. The question is not whether it is
allowed — it is how much there is.

**The join is already solved, and needs no new crosswalk.** BioCyc gene pages
resolve directly on this repository's current locus tags:
`?orgid=GCF_000817325&id=M744_RS00070` returns the gene page, which carries both
`M744_RS00070` and the legacy `M744_00075`. KEGG keys its UTEX 2973 genome on
the legacy tag, and the pinned RefSeq GFF supplies `old_locus_tag` for 2,655
loci — exactly 1 KEGG KO-bearing gene fails to map. No sequence alignment and no
new identifier crosswalk is required. This answers D4 for the UTEX ticket.

**UTEX 2973 is in KEGG as `syu`.** Also `syf` = PCC 7942, `syc` = PCC 6301.
KEGG Orthology (KO) groups are ortholog-level functional assignments and are the
natural backbone for cross-organism transfer.

**Measured coverage over the 2,715 published loci:**

| Layer | Loci | Share |
| --- | --- | --- |
| GO IEA, already pinned in `data/annotation/source/…gene_ontology.gaf.gz` | 1,584 | 58.3% |
| KEGG KO — **not currently in the repository** | 1,385 | 51.0% |
| Union of the two | 1,877 | 69.1% |
| KO adds over the pinned GO | 293 | 10.8% |
| **KO shared with *E. coli* K-12 (`eco`) — an E. coli ortholog exists** | **879** | **32.4%** |
| KO shared with PCC 7942 (`syf`) | 1,376 | 50.7% |
| KO present but absent from *E. coli* — cyanobacteria-specific | 506 | 18.6% |
| Neither GO nor KO | 838 | 30.9% |

**The finding that matters: homology does not fill the annotation gap.** The
repository carries 394 loci annotated `hypothetical protein`. Of those:

| | Count |
| --- | --- |
| with a pinned GO IEA term | **0** |
| with a KEGG KO | **3** |
| with an *E. coli* ortholog | **0** |
| with neither GO nor KO | **391** |

This is not a limitation of the sources; it is the shape of the problem. KO
assignment, GO IEA, and RefSeq product naming are all homology-derived from
overlapping evidence, so they saturate on the same genes. A locus is
`hypothetical` precisely because no recognisable homolog exists anywhere — and
that includes *E. coli*. **Any expectation that pulling E. coli annotation will
name the unnamed third of this genome should be set aside now**, before a ticket
is scoped around it.

**What is genuinely available, then:**

1. **PCC 7942 via `SYNEL`, the Tier 2 curated PGDB.** Curated pathway, reaction,
   enzyme and transcription-unit content on the closest well-studied relative,
   reaching half the genome by shared KO. Under the data contract this is an
   admitted sister strain: `transferred`, `sisterStrain: true`, strain named at
   every point of display.
2. **EcoCyc for the 879 E. coli-orthologous loci.** Not product names — those
   loci are already named. What EcoCyc adds is curated *experimental* context:
   characterised function, complex membership, regulatory interactions, and the
   literature behind them, for roughly a third of the genome, as rank-4
   `transferred` evidence.
3. **KEGG KO itself**, which adds functional assignment on 293 loci the pinned
   GO IEA does not reach.

**The distantly related strain contributes nothing here.** UTEX 3055 has no
BioCyc PGDB (1.1) and **no KEGG genome at all** — a KEGG genome search for
`3055` returns only *Hymenobacter swuensis*. It has a RefSeq assembly
(`GCF_003957805.1`) and that is the extent of it. PCC 6311 and PCC 7943 likewise
have no PGDB and no KEGG genome; they do have UniProt proteomes
(`UP000831723`, `UP000831319`), but those are automatic annotations resting on
the same homology evidence, which is consistent with the 2026-09-28 finding that
these three strains "contribute annotation only".

**CyanoCyc is the same data under a different portal.** SRI publishes
`cyanocyc.org` as a cyanobacteria-focused entry point, and BioCyc's own site
list names it. It serves version 30.0 with identical tiers — UTEX 2973 still
Tier 3 Uncurated, PCC 7942 still `SYNEL` Tier 2 Curated. It is a more convenient
front door, not additional curation, and it reproduces the same *E. coli*
fallback on an unknown orgid.

**Returned table.** One row per published locus, 2,715 rows:
[`cyano_ortholog_annotation_20260930.tsv`](cyano_ortholog_annotation_20260930.tsv),
SHA-256 `e49f7d8f7d328cfc3b7e4e9f50c4a802f450f32cbc782b8fd9428eb3a01ec861`,
318,256 bytes. Columns: `locus_tag`, `old_locus_tag`, `protein_id`, `product`,
`kegg_ko`, `ko_count`, `ortholog_in_eco_K12`, `ortholog_in_syf_PCC7942`,
`ortholog_in_syc_PCC6301`, `pinned_go_iea_count`, `annotation_status`,
`evidence_basis_if_used`. Status distribution: 1,385 `ko_assigned`, 492
`go_iea_only`, 447 `named_no_ko_no_go`, 391
`hypothetical_no_homology_evidence`.

This table is **evidence, not admission**. The `evidence_basis_if_used` column
states what the basis *would* be if a value were published from this layer; no
value is admitted by this return, and the admission contract still runs in the
repository. KEGG's reuse terms and BioCyc's academic/commercial licence routes
are both unresolved source-ledger questions — see 5.6.

### 1.7 What this means for the six BioCyc tickets

The per-strain framing is the wrong shape. Five of the six tickets ask "what
does BioCyc hold for this strain", and for four of them the answer is nothing or
near-nothing. The question that has a rich answer is orthogonal to strain:
*which curated database holds evidence about this locus's homologs*. That is two
databases — `SYNEL` (Tier 2) and EcoCyc (Tier 1) — joined through one orthology
backbone, not six strain tickets.

**All six tickets stay open.** Their BioCyc-availability question is answered,
but that is one dependency row, not the ticket. Whether the per-strain shape
should give way to a single ortholog-annotation ticket is a restructuring
decision with a scientific premise — that homolog evidence is more useful
organised by database than by strain — and the owner should decide it rather
than inherit it. Record the availability finding against each ticket as
evidence, and put the restructuring to the owner as Q1 and Q2 in section 10.

## 2. Recommended queue order

The repository has no explicit priority field; position in
`docs/notes/tickets/INDEX.md` is the queue, and at least one commit
(`b5ea737`, "sequence it before visual priority") treats position as
sequencing. This table reads current position that way.

**This is a recommendation. Applying it is in-repo bookkeeping and belongs to
the coordinator, after DEM-174 lands.**

| Now | Proposed | Ticket | Reason |
| --- | --- | --- | --- |
| 3 | **1** | regulatory-site-viewer-layers | Only fully unblocked item; D1 is a possible live defect in shipped Tan evidence |
| 4 | **2** | pinned-gene-sequence-viewer | Claim-free; gated only on owner answers |
| 1 | **3** | trna-identification-viewer | D1 answered and negative; rescope to CS-1 plus the UI question |
| 10 | **4** | biocyc-pcc-7942 | Only Tier 2 curated PGDB; the strain holding all sister-strain data |
| 7 | **5** | biocyc-utex-2973 | Real but Tier 3; largely re-presents the pinned RefSeq annotation |
| 5 | **6** | rbs-calculator | Real capability, but a Python 2 port and a NuPACK dependency stand in front of it |
| 6 | **7** | idog-promoter-prediction | **Stays open, owner-held.** Not agent-actionable until the owner's code and literature review; see 1.4a |
| 8 | **8** | biocyc-pcc-6301 | Tier 3, and near-identical to PCC 7942; assess after both above |
| 2 | **9** | folding-compute-backend | D1 (Bouchet access) not yet held; nothing measurable |
| 13 | **10** | recoding-regulatory-site-change | Correctly last; idea only. See 5.3 |
| — | **proposed** | ortholog-annotation ticket | `SYNEL` Tier 2 + EcoCyc via KEGG KO. Proposed only; creating it, and whether it absorbs the per-strain tickets, is Q2 |
| 9, 11, 12 | **11–13, open** | biocyc-pcc-6311, -7943, -3055 | No BioCyc PGDB, no KEGG genome, no functional-genomics data. Ranked last on current evidence; **kept open** pending Q1 |

## 3. Corrections to specific tickets

Each row is a factual correction or a material omission, with the evidence above.

**O_biocyc-utex-2973-data**

1. "A read attempt through the web tool on 2026-09-30 returned an
   inaccessible-page error" — the page is reachable and was read this session.
   The failure was tool reach, not a BioCyc outage. Leaving it as written invites
   the next agent to re-conclude the page is unverifiable.
2. Record the E. coli fallback. Any future agent probing `?orgid=` for a strain
   without a PGDB will get HTTP 200 and a complete, wrong page.
3. Record the tier (3, Uncurated) and that the underlying annotation is the same
   RefSeq assembly already pinned, so the inventory targets the pathway,
   reaction, and transcription-unit layers rather than gene annotations.
4. The 1,969 transcription units are predicted, not measured. Under the
   no-prediction-as-measurement boundary they cannot feed a regulatory-site
   marker layer with the same evidence label as Tan 2018 sites.
5. Question 4 asks whether authenticated or paid access is available. BioCyc
   publishes separate academic and commercial licence routes and the summary
   pages browse without login; this session did not test authenticated download,
   so the redistribution question is genuinely open and belongs in the source
   ledger, not in the ticket.

**O_biocyc-pcc-7942-data**

6. Add orgid `SYNEL` and the Tier 2 curated status. Without it the ticket's own
   D2 probe will land on E. coli.
7. NCBI lists three PCC 7942 assemblies — `GCF_000012525.1` (Complete),
   `GCF_030544905.1` (Complete), and `GCF_014698905.1` (Contig). The ticket does
   not ask which one BioCyc's `SYNEL` is built on. It should; the mapping route
   in D4 depends on the answer, and this session did not determine it.

**O_biocyc-pcc-6311 / -7943 / -3055**

8. D2 is answered: no PGDB exists for any of the three. See 1.1.

**O_trna-identification-viewer**

9. "The GtRNAdb URL could not be read through the web tool on 2026-09-30; its
   assembly, release, available artifacts, and terms remain unverified" — all
   four are now determined. See 1.3 and the paste-ready block in section 4.
10. CS-1's "evaluation population" is now known to be 45 loci on this genome,
    not an open-ended genome-wide screen. That materially narrows what a
    calibration claim would have to cover, and is worth writing into the row.
11. The GtRNAdb run found 48 first-pass candidates and confirmed 45. The three
    dropped candidates are the only loci-level information GtRNAdb holds that
    the repository's `comparison.json` does not record.

**O_idog-promoter-prediction**

12. Licence is MIT; the ticket records none.
13. The name expands to inter-Domain Operon Generator, and collides with the
    Integrated Dog Genome database. Both belong in Current State.
14. No cyanobacterial codon table; default organism is *E. coli*.
15. The bundled TransTermHP is x86 Linux only — an arm64 constraint shared with
    the folding-backend ticket's two fallback devices.
16. **The ticket's framing of iDOG as RBS-and-codon-optimization only is
    incomplete.** Current State says a README inspection "found descriptions of
    RBS generation and codon optimization" and "did not establish promoter
    prediction capability". True as far as it goes, but it misses the operon
    designer and the 48-promoter strength-annotated library, which are the parts
    the owner is actually interested in. Record the inventory from 1.4.
17. **Record the design-versus-prediction distinction explicitly**, since the
    ticket's title and CS-1 are both about prediction while the owner's
    direction is design. A future agent reading only the title will draw the
    wrong scope.
18. **Do not run the Cleanup section.** The ticket states that a finding of
    incapability is a valid outcome, which makes it look closeable. It is not:
    see 1.4a. Add the owner's hold to Current State so the next session does not
    resolve it on the CS-1 verdict alone.
19. The ticket's item 1 says "A README omission alone is not proof of absence."
    That instruction was correct and this session initially failed it — the
    README does not mention the promoter library, and a tree-level search found
    it. Worth keeping, and worth noting that a *file-listing* omission is not
    proof of absence either.
20. Clarifying question 3 asks whether the ticket should conclude or expand to
    alternatives if iDOG has no suitable promoter predictor. The owner has
    answered a third way: neither, for now — hold pending their own review.

**O_rbs-calculator-gene-visualizer**

21. The GPL v3.0 claim is **correct** — confirmed against both the `LICENSE`
    file and the README. GitHub's API reports `NOASSERTION` only because the
    file omits the standard header; that is a metadata artifact, not a conflict.
    Worth recording so the next agent does not "correct" a right answer.
22. Copyright is held by the Regents of the University of California, and the
    README routes academic use to `salislab.net/software` and **commercial use
    to `denovodna.com/software`**. That dual-route statement sits alongside the
    GPL grant and belongs in the source ledger entry.
23. **`RBS_Calculator.py` is Python 2** — 1,145 lines with 11 bare `print`
    statements. It will not run on the repository's interpreter without a port.
    D2 says "runtime dependencies"; this is the specific one.
24. It imports **NuPACK**, which is not bundled and is separately licensed. A
    GPL-compatible substitute or a licence decision is required before the code
    can run at all, let alone ship. The ticket's D2 does not name it.
25. Pre-grounding for CS-1: PubMed returns exactly **one** record for the RBS
    Calculator applied to cyanobacteria — PMID `31908923`, *Synechocystis* sp.
    PCC 6803 heterologous expression, *Metab Eng Commun* 2020 — and none for
    *Synechococcus* or UTEX 2973. That is not yet a verdict, but it sets the
    expected shape of the answer.
26. `RBS_Calculator.py` exposes an `rRNA` parameter defaulting to
    `"acctcctta"`. This confirms the ticket's speculative "strain-specific rRNA
    parameters if used by the implementation" as a real, settable input — see
    5.1.

**O_folding-compute-backend**

27. Clarifying question 5 asks for Mac mini and Jetson specifications. Add the
    architecture consequence already visible: both are arm64, and at least one
    tool the sibling tickets depend on (TransTermHP, via iDOG) ships as an x86
    Linux binary requiring recompilation.

## 4. Paste-ready results blocks

Formatted per
[the results block](../../validation/claude-science-handoff.md#the-results-block).
The intake line is left for the coordinator to complete.

### CS-1 result, O_idog-promoter-prediction, returned 2026-09-30

**This result does not resolve the ticket.** It answers the CS-1 row as written.
The ticket stays open under the owner's hold in 1.4a.

**Verdict:** refuted, as to promoter-*location* prediction. Not applicable to
promoter design, which the row does not cover.

**Sources:** `github.com/jayman1466/iDOG` at commit
`9d71187f0b2eb27ee681918927e12850470a0688` (2022-04-01), full clone; its
`README.md`, `LICENSE`, complete 44-entry file tree, the nine shipped
command-line modules, the twelve bytecode-only modules, and
`yeast_elements/promoters.csv`; PubMed queries
`"inter-domain operon generator"[All Fields]` and
`Patel JM[Author] AND (operon OR "host range") AND (2020:2026[dp])`, both
returning zero records.

**Returned text:** iDOG's implemented method does not support promoter-location
prediction: no module accepts genomic sequence and returns promoter positions.
The repository is the inter-Domain Operon Generator, and it does contain
promoter *design* machinery — an `operon_design` module (shipped as bytecode
only) that assembles operons from a 48-entry strength-annotated yeast promoter
library (`YP1`–`YP48`, strengths 49.94 to 1080.93, a shared `ccgcgcc` spacer and
`TATAAAAG` TATA box in all 48, nine core-element variants), 25 yeast
terminators without strengths, and a single hardcoded Bacteriophage T7 promoter
for the bacterial case; plus RBS design to a target translation-initiation rate,
codon optimization, internal-RBS removal, and rho-independent terminator removal
through a bundled TransTermHP. That design capability is a parts library with a
combinatorial shuffle, not a fitted sequence-to-activity model; no model object
exists in the repository. The README's citation and website links are unfilled
placeholders and no publication describing the tool is indexed in PubMed, so
there is no validation evidence — for UTEX 2973 or any organism — to assess.
Organism applicability therefore cannot be established either way for the
prediction capability, because that capability is absent; for the design
capability the quantitative library is yeast-specific and the bacterial promoter
carries no strength value. Licence is MIT.

**Intake check:** _to be completed by the coordinator._

### D1 result, O_trna-identification-viewer, returned 2026-09-30

Not a CS claim row — this answers dependency D1 directly.

**Verdict:** GtRNAdb contributes no new tRNA loci for this genome.

**Sources:** `https://gtrnadb.ucsc.edu/genomes/bacteria/Syne_UTEX_2973/` and its
`-stats.html` sibling, read 2026-09-30; compared against
`data/trna/independent_run/trnascan.stats` in this repository.

**Returned text:** GtRNAdb's UTEX 2973 entry is a tRNAscan-SE v2.0.2 (February
2019) bacterial-mode Infernal run against assembly `GCA_000817325.1`
(`ASM81732v1`), the GenBank counterpart of the pinned `GCF_000817325.1`. The
repository's pinned v2.0.12 run reproduces it exactly on every reported
statistic, including 2,744,626 bases read, 48 first-pass candidates, 45
Infernal-confirmed tRNAs, 44 decoding the standard 20 amino acids, 1 predicted
pseudogene, 0 introns, and the full per-isotype anticodon breakdown. GtRNAdb is
therefore the same tool on the same assembly at an older version, not an
independent source. Its only content absent from this repository is
presentational — HMM and 2'-structure score breakdowns, alignments, mature-tRNA
FASTA — plus the identity of the three first-pass candidates Infernal dropped.

**Intake check:** _to be completed by the coordinator._

### BioCyc availability, six strains, returned 2026-09-30

**Verdict:** three of six have a PGDB; three do not.

**Sources:** `https://biocyc.org/organism-summary?orgid=…` per strain and
`?object=SYNEL`, plus `https://biocyc.org/biocyc-pgdb-list.shtml`, all read
2026-09-30 against BioCyc version 30.0; invalid-orgid control
`?orgid=GCF_999999999`.

**Returned text:** the tables in 1.1 and 1.2. Note the fallback behaviour: an
invalid orgid returns HTTP 200 and a complete *E. coli* K-12 MG1655 page, so a
status code is not evidence that a strain's database exists.

**Intake check:** _to be completed by the coordinator._

## 5. New Claude Science items proposed

Existing queue rows — Package B, Package D, Package C at scale, the crosswalk
second check, and the data-use audit — are unchanged and still stand. These are
additions.

### 5.1 The UTEX 2973 16S rRNA 3'-end, and why it is the highest-value new row

Both prediction tools in this batch take an anti-Shine-Dalgarno sequence as a
parameter and both default to the *E. coli* value: the RBS Calculator's `rRNA`
defaults to `"acctcctta"`, and iDOG's `rRNA_sequence` to `"ACCUCCUUA"`.

That single parameter is what makes a translation-initiation prediction organism-
specific. Run at its default against UTEX 2973 sequence, the RBS Calculator is
not predicting UTEX 2973 initiation — it is predicting *E. coli* initiation on
cyanobacterial sequence, and nothing in either ticket currently catches that.

This is bounded, falsifiable, and checkable: determine the 3' terminal sequence
of the UTEX 2973 16S rRNA from the pinned assembly's own rRNA annotation, with
the locus and coordinates quoted. It is a prerequisite for *any* meaningful
output from either tool, and neither ticket has a claim row for it. Proposed as
a shared claim referenced by both.

### 5.2 A bounded package on the PCC 7942 curated regulatory content

`SYNEL` is Tier 2 curated and reports 1,976 transcription units. The
regulatory-site-viewer-layers ticket needs future feature types, and the
recoding-regulatory-site ticket's D1 needs a sourced site-type review — and
currently has no dispatchable package at all.

Proposed package, one row per regulatory object class (transcription unit,
promoter, terminator, transcription-factor binding site, regulatory
interaction): definition and coordinate convention, curated versus predicted
with evidence codes, coverage, the assembly `SYNEL` is built on, identifier
namespace and documented mapping route to UTEX 2973 loci, quoted access and
redistribution terms with their location, and the explicit limit that a
PCC 7942 coordinate never transfers onto the UTEX chromosome axis.

### 5.3 The recoding-metric D1 review is one owner answer from dispatchable

[O_recoding-regulatory-site-change](../tickets/O_recoding-regulatory-site-change__20260930.md)
states its package "is not yet dispatchable" and omits it from the queue. But
its return format is already fully specified — one row per site type, with
definition, assay basis, strain and build, coordinate convention, candidate
datasets, coverage, sources, and interpretation limits. The only missing input
is the owner's initial scope list in clarifying question 1, which is a decision,
not a research gap. Worth saying so in the ticket, so it is not read as blocked
on evidence it is not actually waiting for.

### 5.4 Two proposed claim rows for the iDOG refit, when the owner picks it up

Not dispatchable now — the owner is doing their own code and literature review
first, and these should be scoped against what that review concludes. Recorded
here so the direction is not lost, and so the two problems stay separated. The
existing CS-1 covers neither.

**Proposed CS-2 — provenance and transferability of the promoter library.**
Whether the 48 `YP` promoters and their strength values come from a published
synthetic-promoter study, and under what measurement (reporter, units,
condition, strain). The `Strength` column is a bare number with no units and no
citation anywhere in the repository, and the `Core` index implies a published
element decomposition. Without that, the library cannot be reused as training
data or compared against anything. Unblocks: whether the library is a usable
worked example or an undocumented artifact.

**Proposed CS-3 — label availability for a UTEX 2973 promoter model.** Whether
any measured promoter-strength or promoter-activity dataset exists for
*Synechococcus elongatus* UTEX 2973 or an admissible sister strain, beyond the
Tan 2018 TSS evidence already shipped. This is the binding constraint on a
refit: a strength predictor needs sequence–activity pairs, and the 2026-09-28
sweep found no functional-genomics deposits for four of the six strains and
exactly one for UTEX 2973. Unblocks: whether a refit targets strength
prediction, location prediction, or neither.

Keep these distinct from CS-1. CS-1 asks whether iDOG predicts promoter
locations — answered, no. Neither of these asks that.

### 5.6 Proposed package: curated ortholog annotation from SYNEL and EcoCyc

Dispatchable once the owner confirms scope. The orthology backbone and the
join are already built and returned (1.6); what needs a session is the curated
content behind the 879 E. coli-orthologous and 1,376 PCC 7942-orthologous loci,
and the terms under which any of it can be republished.

Return format, one row per `(locus_tag, source_database)` pair: source database
and its tier, database version, the orthology relation and its basis (shared KO,
with the KO id), the curated content available for that ortholog (function,
complex, pathway, regulatory interaction, evidence code), whether each item is
curated from experiment or computationally inferred, the upstream citation,
quoted access and redistribution terms with their location, and the proposed
evidence basis under the data contract. Explicitly report loci where the
ortholog exists but carries no curated content beyond what RefSeq already
provides — on present evidence that will be a large fraction, and a row saying
so is the point.

Two hard boundaries for this package, both from the data contract: an *E. coli*
result supports a conserved bacterial function and does **not** establish
cyanobacteria-specific regulation, condition-specific expression, or UTEX 2973
essentiality; and a Tier 3 PGDB's pathway assignments are PathoLogic inferences,
so they are predictions and may not be displayed as measurement.

Two licence questions gate republication, not retrieval, and belong in
[source-ledger.md](../../validation/source-ledger.md): KEGG's reuse terms for
KO assignments obtained through the REST API, and BioCyc's academic versus
commercial licence routes for PGDB content. This session read public pages only
and made no licence determination.

### 5.7 Recurring: a BioCyc release watch

Version 30.0 is current. The three absent strains could acquire Tier 3 PGDBs in
a later release; conversely the two Tier 3 databases are regenerated per release
and their counts will drift. A one-row recheck at each BioCyc version bump is
cheap, and it keeps the availability finding in 1.1 from silently going stale —
which matters precisely because that finding is being used to rank three
tickets last rather than to retire them.

## 6. Helper functions worth building in-repo

These are in-repo work under the capability split; they are listed here because
this session's probes are what identified them.

1. **An orgid resolver with fallback detection.** The E. coli fallback is a trap
   that will recur for every strain and every future BioCyc probe. A helper that
   asserts the returned page's organism name matches the requested strain — and
   fails loudly otherwise — turns a silent wrong answer into an error. The same
   pattern generalises to any database that serves a default record rather than
   a 404. `tools/` already holds `annotation_release.py` and
   `sister_strain_crosswalk.py`; this belongs beside them.
2. **An anti-SD extractor.** Given the pinned assembly and its rRNA annotation,
   return the 16S 3' terminal sequence with locus and coordinates, so the value
   feeding any initiation model is derived and provenanced rather than defaulted.
   Pairs with 5.1.
3. **A tRNAscan-SE score-to-category mapper.** Only once CS-1 returns. The
   repository already holds per-locus `scan_score` values in
   `comparison.json`; what it lacks is a defensible mapping from score to
   displayed evidence category. Building the mapper before the claim returns
   would invert the dependency.
4. **Extend the existing capability probe.** The `cyano-capability-probe` skill
   already re-verifies literature and omics archives. BioCyc and GtRNAdb are now
   confirmed reachable from a Claude Science session, both by owner grant on
   2026-09-30. Adding them — with the fallback control as part of the BioCyc
   check — keeps the handoff contract's capability section accurate.

## 7. What a future Mythos or Fable iteration still needs

Gaps that are not inaccuracies, but that will cost a future session a round trip
if left unstated:

- **Say which failures were tool reach and which were the source.** Two tickets
  record a page as unreadable; both pages are fine. The handoff contract already
  draws this distinction for `journals.asm.org`. Tickets should apply it, so
  "could not read" carries whether the refusal came from the sandbox or the
  server.
- **State the assembly for every strain in every ticket.** The BioCyc tickets
  name strains, not assemblies. PCC 7942 has three; GtRNAdb uses the GenBank
  accession where the repository pins RefSeq. Verified current RefSeq
  assemblies: UTEX 2973 `GCF_000817325.1` (taxid 1350461, Complete),
  PCC 7942 `GCF_000012525.1` (taxid 1140, Complete), PCC 6301
  `GCF_000010065.1` (taxid 269084, Complete), PCC 6311 `GCF_022984265.1`
  (taxid 2883261, Chromosome), PCC 7943 `GCF_022984345.1` (taxid 115747,
  Chromosome), UTEX 3055 `GCF_003957805.1` (Complete).
- **Record the negative results.** Three BioCyc absences, one GtRNAdb
  duplication, one absent promoter-location predictor. Each is a real result
  that prevents a repeat investigation, and each is lost if the ticket is simply
  deleted at cleanup rather than distilled. Note that "the capability is absent"
  is not the same finding as "the tool is not worth pursuing" — the iDOG ticket
  is the case in point, and conflating the two would have closed it wrongly.
- **Inventory the whole tree before concluding a capability is absent.** The
  ticket already warns that a README omission is not proof of absence. This
  session demonstrated the stronger version: a *truncated file listing* is not
  proof of absence either. iDOG's promoter library sits in a data directory that
  the README never mentions and that fell outside a 40-of-44 listing. For a
  capability verdict, clone and search the full tree, including files that are
  shipped only as bytecode.
- **Note the tool-era problem explicitly.** The RBS Calculator is Python 2 from
  2015 and iDOG targets Python 3.7 with pinned 2019-era dependencies. Both
  tickets treat integration effort as an open question; the answer is that
  neither runs on a current interpreter without work.

## 8. Higher-value data types than the current queue targets

The owner asked which data types would be worth more than the BioCyc/KEGG
material the 2026-09-30 queue is built around. Ranked against the project's
actual objective — predicting fitness outcomes of recoding schemes, and locating
regulatory sites that recoding might disturb — not against general interest.

### 8.0 A finding that reframes all of it

**UTEX 2973 has no UniProtKB entries at all.** A UniProtKB search on
`organism_id:1350461` returns **0** results, while the proteome record
`UP000031358` still advertises 2,641 proteins and BUSCO 99% completeness
(`synechococcales_odb10`, 784/788 complete). The sequences exist only in
**UniParc** — 3,677 archive entries, which carry no annotation. By contrast
PCC 7942 (`organism_id:1140`) has **2,751** UniProtKB entries and is the
reference proteome; PCC 6301 has 2,564.

Everything keyed on a UniProt accession is therefore unreachable for this strain
directly: UniProtKB curation, InterPro, Pfam, and AlphaFold DB. AlphaFold's API
accepts `Q31QF4` (PCC 7942) and rejects a RefSeq `WP_` accession. This is a
second, independent reason PCC 7942 is the hub — and it is not recorded in any
ticket.

### 8.1 Rank 1 — computed on this project's own sequences

These need no cross-organism transfer at all. Under the data contract they are
`proxy` (computed from the UTEX 2973 sequence), which outranks the `transferred`
basis that everything in the BioCyc and KEGG queue would carry.

**InterPro / Pfam domain annotation, run directly on the 2,715 proteins.**
Coverage benchmark from PCC 7942, whose proteins are near-identical: **86.8%
InterPro, 84.0% Pfam**. Compare the repository's current position — 58.3% GO
IEA, and 51.0% for the KEGG KO layer a BioCyc/KEGG ticket would add. InterPro is
roughly **28 points above the pinned GO layer** and 36 above KO, at a stronger
evidence basis, from a tool that runs on the sequences already in the tree.
Treat 86.8% as an estimate for UTEX 2973, not a measurement on it.

**Predicted structure, and structure-based remote homology search.** This is the
one thing that attacks the wall in 1.6. Of PCC 7942's 360 `Uncharacterized`
entries, only **88 carry an InterPro domain — but 358 of 360 have an AlphaFold
model.** Structure exists precisely where sequence-level annotation fails, and
structural comparison (Foldseek against AFDB and the PDB) detects homology below
the sequence-similarity floor that defeated every layer measured in 1.6. For the
394 loci where GO, KO, and *E. coli* orthology all return nothing, this is the
only remaining route to a function hypothesis.

It also gives [folding-compute-backend](../tickets/O_folding-compute-backend__20260930.md)
a concrete first workload, which that ticket currently lacks: fold the
unannotated subset locally, or map to PCC 7942 AlphaFold models via the
orthology already returned in
[`cyano_ortholog_annotation_20260930.tsv`](cyano_ortholog_annotation_20260930.tsv).
Any function assigned this way is a **prediction**, and the
no-prediction-as-measurement boundary applies in full.

### 8.2 Rank 2 — the assays that measure what recoding actually perturbs

**Ribosome profiling.** The single most relevant assay to this project's
objective. Recoding changes synonymous codons; what that perturbs is elongation
rate, ribosome pausing, internal Shine–Dalgarno-driven stalling, and translation
efficiency — and ribosome profiling measures all four directly. Every other
layer in the queue is an annotation *about* a gene; this measures the process
recoding acts on.

GEO holds **zero** ribosome-profiling records for *Synechococcus elongatus*,
confirming the 2026-09-28 sweep. It holds **18 for cyanobacteria generally, all
in *Synechocystis* sp. PCC 6803**, including a combined initiation- and
termination-site ribosome-profiling study defining small proteins, and
disome/trisome TTS-seq series. Two consequences: PCC 6803 ribo-seq is available
as rank-3 transferred evidence under the contract's ordering, and generating
ribosome profiling in UTEX 2973 or PCC 7942 is plausibly the highest-value
experiment available to this project. No amount of database work substitutes.

**Fitness screens across conditions (Tn-seq / RB-TnSeq).** The project already
carries Adomako 2022 PCC 7942 essentiality at one condition. A fitness *model*
wants fitness *labels*, and condition-resolved fitness is the closest thing to a
direct label the literature can supply. A GEO query for *S. elongatus* Tn-seq,
transposon sequencing, or essentiality returns **28** records, which Package A
did not specifically target. Worth a scoped sweep of its own.

### 8.3 Rank 3 — cheap, computable, and specific to recoding

**Conservation depth across cyanobacteria.** A per-gene measure of how deeply
conserved a locus is, computed from orthologs. It is a well-supported proxy for
functional constraint, it is cheap, and it is the one use that gives UTEX 3055
a real job — as an outgroup that makes a conservation gradient measurable rather
than as a thin annotation source. This is the concrete form of Q1.

**An internal Shine–Dalgarno inventory.** Synonymous substitution creates and
destroys internal SD-like motifs, which cause ribosome pausing; this is a known
failure mode of aggressive recoding and is computable from the project's own
sequence. It depends on the UTEX 2973 16S 3'-end determination already proposed
in 5.1, and it is exactly the sort of feature a recoding-fitness model needs and
a pathway database cannot supply. iDOG's internal-RBS removal option (1.4) is
the design-side counterpart of the same concept.

**Protein abundance.** A strong covariate for fitness cost, and the PCC 7942
proteomics candidates already in the Package A table are the nearest source.

### 8.4 What this implies about the current queue

BioCyc Tier 3 pathway inference and KEGG KO are the *lowest*-value items
measured here: KO reaches 51.0% where InterPro reaches an estimated 86.8%, both
are homology-derived from overlapping evidence, both arrive as `transferred` or
predicted rather than computed from this genome, and neither touches the 394
unannotated loci. The curated PCC 7942 (`SYNEL`) and EcoCyc content in 5.6 keeps
its value, because curated experimental context is not something InterPro or a
structure predictor produces — but the per-strain BioCyc pulls do not.

None of this closes or reprioritises a ticket. It is evidence for the owner's
scoping decisions in section 10, and the data types above would each need their
own ticket, licence check, and admission run.

## 9. Proposed new tickets

Candidates arising from sections 1.6 and 8. **These are proposals, not tickets.**
Opening one is in-repo bookkeeping and belongs to the agents here; each also
carries a question the owner should answer before it is worth opening at all.
None of them displaces or closes anything already in the queue.

### 9.0 Duplicate check, 2026-09-30

Run against all 18 open tickets and `docs/validation/` before drafting the list
below, per the convention the 2026-09-30 tickets follow. Two candidates turned
out to have prior art and are **not** proposed as new tickets:

- **InterProScan is already ranked roadmap item 4** in
  [future-data-roadmap.md](../../validation/future-data-roadmap.md), with the
  local-run mode, the FASTA-identifier-plus-SHA-256 join, the release-pinning
  requirement, and the computational-annotation label already specified. This
  session adds only a reason to promote it: the measured coverage gap in 8.1
  (an estimated 86.8% against the pinned GO layer's 58.3%) was not previously
  quantified. **Action: raise its rank, do not open a ticket.**
- **Conservation is already ranked roadmap item 2**, sourced from the Adomako
  2022 pangenome (3,079 genes, 2,632 core). The outgroup framing in 8.3 is a
  refinement of that item, not a new one. **Action: note the outgroup use on
  the existing row.**

The rest have no match in any open ticket or validation document:
`Foldseek`, `AlphaFold`, `structure predict`, `Pfam`, `Shine`/`anti-SD`,
`Tn-seq`/`RB-TnSeq`, and `conservation depth` all return zero ticket hits.

### 9.1 The proposals

| Id | Proposed ticket | Scope in one line | Motivating evidence | Question to answer first |
| --- | --- | --- | --- | --- |
| **P1** | `O_structure-remote-homology` | Predict structures for the unannotated subset and search them against AFDB/PDB with Foldseek to propose functions where sequence homology fails | 8.1 — of PCC 7942's 360 `Uncharacterized` entries, 88 have an InterPro domain but **358 of 360 have an AlphaFold model**; 0 of this repo's 394 hypotheticals have an *E. coli* ortholog | Is a structure-derived function *hypothesis* something you want surfaced in the viewer at all, given it can never be more than a prediction? |
| **P2** | `O_uniprot-accession-bridge` | Document and test a route from UTEX 2973 loci to UniProt accessions, since the strain has none of its own | 8.0 — `organism_id:1350461` returns **0** UniProtKB entries; sequences are UniParc-only; AlphaFold, InterPro and Pfam are all UniProt-keyed | Should the bridge run through PCC 7942 orthologs, or should UniProt-keyed resources simply be recomputed locally on UTEX sequences instead? |
| **P3** | `O_ribosome-profiling-evidence` | Assess *Synechocystis* PCC 6803 ribosome profiling as rank-3 transferred evidence, and record what in-house ribo-seq would provide | 8.2 — **zero** ribo-seq records for *S. elongatus*; **18** for cyanobacteria, all PCC 6803, including combined TIS/TTS profiling | PCC 6803 is outside the admitted sister-strain set and far more distant. Is ribo-seq from it usable evidence for you, or only a methods reference? |
| **P4** | `O_fitness-screen-sweep` | Sweep condition-resolved fitness and transposon screens for *S. elongatus* beyond the single admitted Adomako condition | 8.2 — a GEO query for *S. elongatus* Tn-seq/transposon/essentiality returns **28** records that Package A did not target | Is condition-resolved fitness the label you actually want for the recoding model, and which conditions matter? |
| **P5** | `O_internal-sd-inventory` | Inventory internal Shine–Dalgarno-like motifs across CDSs and track which a recoding scheme creates or destroys | 8.3 — computable from this project's own sequence; a known failure mode of aggressive recoding; iDOG implements the design-side counterpart (1.4) | Depends on CS proposal 5.1 (the UTEX 16S 3′ end). Do you want this as a recoding-risk metric in its own right, or only as an input to the fitness model? |
| **P6** | `O_ortholog-curated-annotation` | Pull curated functional context for UTEX loci from `SYNEL` (Tier 2) and EcoCyc via the returned KO orthology | 1.6, 5.6 — 879 loci have an *E. coli* ortholog, 1,376 a PCC 7942 one; the join is already built and returned | This is Q2. Does it replace the six per-strain BioCyc tickets, sit alongside them, or not get opened? |

### 9.2 Notes that apply to all six

- **Every one is gated on a licence question that is not settled here.** KEGG
  reuse terms, BioCyc academic-versus-commercial routes, AlphaFold DB and PDB
  terms, InterPro member-database terms, and per-deposit terms for any GEO
  series all belong in
  [source-ledger.md](../../validation/source-ledger.md), decided in this
  repository, not by this session.
- **P1, P5 and parts of P2 produce predictions, not measurements.** Each would
  need the prediction label carried through display, export, and accessible
  description, under the boundary the data contract already sets.
- **P1 gives [folding-compute-backend](../tickets/O_folding-compute-backend__20260930.md)
  its first concrete workload.** That ticket asks in its clarifying question 1
  which algorithms are intended and for what outputs; P1 is a candidate answer
  for the protein half. The two are complementary — P1 is the scientific layer,
  the backend ticket is where it runs — and neither should absorb the other.
- **P3 and P4 are sweeps, so they are Claude Science work packages** under
  [Work packages](../../validation/claude-science-handoff.md#work-packages),
  not in-repo tickets with a claim row. P1, P2, P5 and P6 are in-repo work with
  external dependencies, so they follow the ordinary claim-gating pattern.
- **Priority among them is not proposed.** On the evidence in section 8 the
  ordering would be P1, then P3, then the rest — but that ranking depends on
  whether the immediate objective is annotating the unannotated third of the
  genome or building fitness labels, which is the owner's call.

## 10. Clarifying questions for the owner

**No ticket was closed, resolved, renamed, parked, or folded by this session,
and none should be on the strength of it.** All eighteen open tickets remain
open and the active one remains active; `docs/notes/tickets/` was not modified.
Every finding above is one dependency row answered, never a verdict on whether a
ticket is worth doing — that is a scoping judgement resting on scientific
intent, and under
[the hard boundaries](../../validation/claude-science-handoff.md#hard-boundaries)
it stays with the lab.

The next model to pick these up should **put these questions to the owner and
wait**, not infer answers from the evidence below. Each names the finding that
raises it, so the question can be asked without re-deriving the work.

| Id | Ticket | Finding | Question for the owner |
| --- | --- | --- | --- |
| Q1 | biocyc-pcc-6311, -7943, -3055 | No PGDB, no KEGG genome, no functional-genomics deposits; UniProt proteomes exist but are automatic and rest on the same homology evidence already covered | These three add no annotation the pinned RefSeq and GO layers do not already carry. Is there a comparative use that still makes them worth keeping — gene presence/absence across the clade, or confirming a locus is conserved? In particular, is **UTEX 3055's greater divergence an asset** here, as an outgroup for a conservation score, rather than the deficiency this return has been treating it as? |
| Q2 | all six BioCyc tickets | Homolog evidence concentrates in two curated databases (`SYNEL`, EcoCyc), not in six strains | Should the per-strain tickets give way to one ortholog-annotation ticket organised by database, or do you want per-strain tickets retained because strain identity matters to how you will read the evidence? |
| Q3 | trna-identification-viewer | GtRNAdb reproduces the pinned v2.0.12 run exactly; it holds 3 dropped first-pass candidates and a score breakdown the repo does not record | Are those three dropped candidates and the HMM/2'-structure score breakdown worth retrieving, or is the real want the viewer feature over the 45 loci you already have? |
| Q4 | biocyc-utex-2973 | Tier 3 uncurated, regenerated from the RefSeq annotation already pinned; the additive layer is 1,969 PathoLogic-inferred transcription units and an inferred pathway set | Is a clearly-labelled *predicted* pathway and operon layer useful to you, or does the no-prediction-as-measurement rule make it more cost than value in this interface? |
| Q5 | biocyc-pcc-7942 | `SYNEL` is Tier 2 curated, 1,976 transcription units, and PCC 7942 holds all the sister-strain functional-genomics data | Do you want curated PCC 7942 pathway and regulatory content as a `transferred` sister-strain layer? Related unknown: this session did not determine which PCC 7942 assembly `SYNEL` is built on, and three exist |
| Q6 | ortholog annotation (proposed) | 879 loci have an *E. coli* ortholog; 0 of the 394 hypotheticals do | Given that this cannot name the unnamed genes, is curated *E. coli* experimental context on already-named loci worth a display layer — and at rank 4 in the evidence order, would you show it at all, or hold it as export-only? |
| Q7 | rbs-calculator | GPL v3.0, Python 2, requires separately-licensed NuPACK; exactly one PubMed record pairs the tool with any cyanobacterium, in *Synechocystis* not *Synechococcus* | Is porting v1.0 worth it, or would you rather the assessment consider the current Salis-lab version or a different initiation model? Your clarifying question 6 asks this; the licence and runtime findings now give it a cost side |
| Q8 | folding-compute-backend | Bouchet access is not yet held, so no workload/host matrix can be measured; the arm64 constraint on bundled binaries is already visible | Should this ticket wait for Bouchet, or should the Mac mini and Jetson be specified and benchmarked first so the cluster is an addition rather than a prerequisite? |

The iDOG ticket is deliberately absent: the owner has already answered it
(1.4a), and it is held open pending their own code and literature review.

## 11. Method and boundaries

Probes were run 2026-09-30 from a Claude Science session with this repository
mounted read-write. `biocyc.org` and `gtrnadb.ucsc.edu` were refused by the
sandbox allowlist and granted on request, one domain per approval — the same
pattern the handoff contract records for the 2026-09-28 session. GitHub, the
GitHub API, NCBI Datasets, and NCBI E-utilities were already reachable.

Negative findings rest on two independent routes each, because the primary route
fails silently: BioCyc absence is asserted only where both the orgid probe and
the published PGDB list agree, with an invalid-orgid control establishing what a
miss looks like.

**One correction was made to this return after it was first delivered.** The
iDOG capability finding in 1.4 originally stated that the repository contained
no promoter machinery. It does — a 48-entry strength-annotated promoter library
and an operon designer that consumes it. The cause was a truncated file listing
(40 of 44 entries) combined with a search scoped to five modules rather than the
tree, and the owner identified it. Section 1.4 is now built from a full clone
with every file searched, including the bytecode-only modules. The queue
recommendation for that ticket changed as a result, and the ticket is held open
by owner instruction; the superseded recommendation to close it is withdrawn in
1.4a. Everything else in this return was derived independently of that error and
is unaffected.

This return contains no admission decision, no licence permission, no
identifier join, and no lab decision. **It also closes nothing.** An earlier
draft recommended closing or parking three tickets and folding three others;
those recommendations are withdrawn, because judging that a ticket has no value
is a scoping decision resting on scientific intent this session cannot see. All
eighteen open tickets stay open, and what were verdicts are now the questions in
section 10. The BioCyc access terms in 3.5 and 3.22
are observations for the source ledger, not permissions. Every count attributed
to a repository file was read from that file in this session. The queue order in
section 2 is a recommendation for the coordinator; this session did not modify
`docs/notes/tickets/INDEX.md` or any ticket, so that nothing here collides with
the DEM-174 repair in flight on `fix/dem-171-review`.
