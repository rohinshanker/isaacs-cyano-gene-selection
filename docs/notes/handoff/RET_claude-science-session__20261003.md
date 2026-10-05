# RET_claude-science-session__20261003 — Claude Science session return

**Read this before picking up any ticket that consumes package B.**

```
requester:   owner
target:      mythos / fable
ticket:      docs/notes/tickets/O_claude-science-offload__20260927.md
package:     B, condition metadata per candidate study
scope:       this file and docs/notes/handoff/cyano_package_B_conditions_20261003.tsv.
             No code, data, site file, existing ticket, validation document, or
             index row was modified by this session
acceptance:  the hard boundaries and results-block format in
             docs/validation/claude-science-handoff.md
status:      returned
opened:      20261003
updated:     20261003
```

Everything below is **evidence and recommendation**. Nothing here admits a
source, grants a licence, performs a join, or settles a lab decision. No row
judges whether two studies are comparable; that is package D.

## B.1 What was returned

| | |
| --- | --- |
| Table | [`cyano_package_B_conditions_20261003.tsv`](cyano_package_B_conditions_20261003.tsv) |
| Rows | **88** data rows plus one header row |
| Bytes | 259507 |
| SHA-256 | `fa65266cd402ae974c072e9ad587bd990773d2df002eb08ed856ba4bca0c750e` |
| Input | `cyano_package_A_candidates_20260928.tsv`, SHA-256 recomputed on the mounted file as `d6f456174fd10cb4cd265a342134de5e5de0d6580ebc0c93fc1d8b149073001f` — **matches** the value in the dispatch |
| Columns | strain, assay, conditions, replicates, build, licence, artifact, checksum, per_gene_table, mapping_route, status, source — in that order, no others |

The 88 rows cover all **57** in-scope input candidates with no omissions
and no additions: 34 GEO transcriptomics series, 14 PRIDE proteomics projects,
and 9 RefSeq annotation rows. `GSE106824` is absent by instruction. The row
count exceeds 57 because a study with several growth conditions returns one row
per condition set, as the package requires: the 48 assay records resolve to
**79** condition-set rows, and the 9 annotation records to 9 rows.

Status distribution: **58 candidate**,
**29 escalate**,
**1 rejected**.

### Axis coverage across the 79 assay rows

| Axis | reported | not reported | not retrieved |
| --- | --- | --- | --- |
| temperature | 68 | 5 | 6 |
| light_intensity | 66 | 6 | 6 |
| light_regime | 67 | 9 | 2 |
| co2 | 41 | 24 | 14 |
| medium | 73 | 3 | 3 |
| culture_format | 72 | 3 | 4 |
| growth_phase | 60 | 7 | 12 |
| replicates | 46 | 27 | 6 |

`not reported` and `not retrieved` are **different claims** and the table keeps
them apart. `not reported` means the sources that were read state nothing on
that axis, and the primary methods source *was* readable, so absence is
established. `not retrieved` means the primary methods source could not be read
in this session, so absence is **not** established and the cell carries the
reason. Section B.3 lists every record in the second class. Nothing was
estimated from a similar study.

### Cell format

`conditions` is one cell per row holding, in order, the condition-set label, the
samples it covers, then each axis as `axis = value [location; quote: "…"]`,
joined by ` ;; `. Values are given **as reported**, in the source's own units;
where a unit conversion is definitional it is appended as a separate
`unit_conversion = …` segment rather than applied to the value. `replicates` is
a separate column with the same `value [location; quote]` shape.

Every quote in the table is a **verbatim** substring of the record it cites.
This was enforced mechanically, not by eye: all **513** quotes were
re-matched against the retrieved source bytes after Unicode normalisation;
511 matched exactly and 2 matched only after
undoing a PDF line-break hyphenation in the PNAS limonene paper. None was
accepted unmatched.

## B.2 The two intake corrections, checked

Both corrections in the dispatch are **confirmed** against the GEO
`!Sample_library_strategy` fields, retrieved 2026-10-03:

- **GSE106824** — 12 samples, all `ChIP-Seq`, `!Series_type = Genome
  binding/occupancy profiling by high throughput sequencing`. Treated as
  rejected and skipped, as instructed.
- **GSE103606** — 106 samples, **94 `RNA-Seq` and 12 `ChIP-Seq`**, exactly as
  stated. Conditions are returned for the 94 RNA-Seq samples. The 12 ChIP-Seq
  samples (GSM2854964–GSM2854975) share the growth-protocol text of condition
  set 2 and are named there as excluded, so the exclusion is auditable rather
  than silent.

## B.3 What could not be read, and whose refusal it was

**No request in this session was refused by the sandbox allowlist.** Every
failure below came from the source. Nothing was worked around: no User-Agent
was altered, no mirror or archive proxy was used, and the PMC proof-of-work
challenge was not solved.

### B.3.1 In PMC but outside the Europe PMC open-access subset (4 papers, 9 records)

`…/europepmc/webservices/rest/<PMCID>/fullTextXML` answers **HTTP 500** — not
404 — for these; NCBI `efetch db=pmc` returns front matter with no `<body>`; and
`https://pmc.ncbi.nlm.nih.gov/articles/<PMCID>/pdf/` answers with a
proof-of-work challenge page. `…/supplementaryFiles` returns an empty stub.

| Paper | Records affected |
| --- | --- |
| Markson et al. 2013 Cell, PMID 24315105, PMC3935230 | GSE50908, GSE50919, GSE50920, GSE50922, GSE51112, GSE52486 |
| Vijayan et al. 2009 PNAS, PMID 20018699, PMC2799730 | GSE18902 |
| Guerreiro et al. 2014 MCP, PMID 24677030, PMC4125736 | PXD000510 |
| Plant Physiol. 2022, PMID 35201348, PMC9157067 | PXD027430 |

For the six Markson series and GSE18902 this costs little: the GEO
`!Sample_growth_protocol_ch1` fields for those records are unusually complete
(turbidostat volume, modified BG-11 recipe, 25 µmol photons m⁻² s⁻¹, 1% CO₂,
30 °C, OD₇₅₀ setpoint), so only replicate structure is left open. For PXD000510
and PXD027430 it costs most of the row.

### B.3.2 Gold open access with no usable deposit location (1 paper, 6 records)

Puszyńska & O'Shea 2017, PMID 29241543, doi `10.1016/j.celrep.2017.11.067`,
affects **GSE103462, GSE103463, GSE103606, GSE103644, GSE103704, GSE105774**.
The article is gold OA under CC BY-NC-ND, but it has **no PMC deposit**
(NCBI ID converter: "Identifier not found in PMC") and the only full-text
location advertised by Unpaywall and OpenAlex is an `http://`-only publisher
PDF, which this session's fetcher refuses on an https-only policy. This is a
route limitation rather than a paywall; if the owner wants those six rows
completed, the cheapest fix is to supply the PDF directly. The GEO growth
protocols still give temperature, photon flux, spectrum, medium, vessel and
light regime for all six.

### B.3.3 Paywalled or with no resolvable OA location (2 papers, 2 records)

- PMID 31161548, doi `10.1007/s11356-019-05057-6` (**GSE102914**) — closed
  access, no OA location in Unpaywall or OpenAlex.
- PMID 37925065, doi `10.1016/j.ymben.2023.11.001` (**PXD036717**) — hybrid,
  but no resolvable OA location and no PMC deposit.

### B.3.4 No publication to read (4 records)

**GSE225426, GSE311172, PXD010000, PXD023591** carry no publication link in the
archive record, and none was found by Europe PMC accession search or by title
search. For these the deposit *is* the study, so axes the deposit omits are
returned as `not reported` rather than `not retrieved`. GSE311172's GEO growth
protocol is nevertheless the single richest in the set.

### B.3.5 One retrieval that did succeed and is worth recording

For **PXD005851** the paper states that per-organism growth conditions live only
in a supplementary table. That table was retrieved through the Europe PMC
per-file route the handoff contract already records:
`…/europepmc/webservices/rest/PMC5705920/supplementaryFiles` returned 16 files,
of which `mbo006173609st1.xls` (49,152 bytes, SHA-256
`c0bea2222143063edb39ed79b993d7afa9fdc1506cc3c1f7b1ac3f1cdf8ef258`) carries a
per-organism row. Its *Synechococcus elongatus* PCC 7942 entry reads
Temperature `22°C`, `No shaking`, `Aerobic`, `ATCC 616 Medium BG-11 for
Blue-Green Algae`, source `ATCC 33912`.

## B.4 What was found wrong in the input

Twelve findings. The first two confirm the dispatch; the rest are new.

1. **GSE106824 is ChIP-Seq only** — confirmed, 12/12 samples.
2. **GSE103606 is mixed 94 RNA-seq / 12 ChIP-seq** — confirmed.
3. **GSE104204 is also mixed and was not flagged.** `!Sample_library_strategy`
   gives **37 ChIP-Seq and 60 RNA-Seq** samples on one platform (GPL17750). The
   input labels it `transcriptomics (RNA-seq)` without qualification. Returned
   as `escalate`. GSM2792386 ("Mock ChIP") is an equal-mass pool spanning both
   acclimation conditions and belongs to no single condition set.
4. **GSE50922 is a four-platform SuperSeries and was not flagged.** 108 samples:
   **71 array** (GPL9534), **19 ChIP-Seq** (GPL17750/GPL13530/GPL16957) and
   **18 RNA-Seq** (GPL17750). Four distinct growth protocols are present; the
   assay split cuts across them, so the four condition sets returned do not
   align one-to-one with the assay arms. Returned as `escalate`.
5. **GSE205443 is not transcriptomics at all.** All 25 samples carry
   `library_strategy = OTHER` on GPL32315 and are RB-TnSeq fitness-screen
   samples. The input labels it `transcriptomics (RNA-seq)`. It may still be
   wanted — as a fitness screen, which is the subject of proposed ticket
   `O_fitness-screen-sweep` — but not as an expression layer. Returned as
   `escalate`.
6. **GSE205445 is 25 RB-TnSeq plus 21 RNA-seq**, sharing its RB-TnSeq GSM range
   with GSE205443. Condition sets 1–3 are the fitness arm, set 4 the expression
   arm. Several of its sets use **conditioned medium**, which the data contract
   states is never comparable to fresh medium; the sets name which is which.
7. **GSE335065 contains a non-target organism.** 9 of 36 samples
   (GSM9805358–GSM9805366, GPL37104) list organism
   `Synechococcus elongatus PCC 7942 = FACHB-805; Rhodotorula toruloides` and
   are mixed co-culture. Four condition sets are returned so the co-culture arm
   can be held out.
8. **PXD011485 is *Synechococcus elongatus* PCC 11801, not PCC 7942.** This
   answers the input's own open question on that row. PCC 11801 is **not one of
   the six strains in the Adomako 2022 pangenome**, so the carried-over mapping
   route (`UniProt accession -> exact shared-protein crosswalk`) has no basis
   and the cell says so. Note separately that the deposit's protein
   identification used the PCC 7942 UniProt FASTA as a close homolog — that is
   a search-database choice inside the deposit, not a crosswalk, and must not be
   read as one.
9. **PXD014590 is *Synechococcus elongatus* UTEX 2973 — the genome of record.**
   This answers the input's other open question. No cross-strain transfer is
   involved, so the carried-over mapping route is wrong in the opposite
   direction: the row needs a UTEX 2973 route, not a crosswalk.
10. **Three PRIDE projects are multi-organism aggregations**: PXD005851 (48
    bacteria, 6 phyla; a second cyanobacterium, *Cyanobacterium stanieri*, is
    also present), PXD010000 (51 organisms), PXD044412 (4 organisms, 2 of them
    cyanobacteria). Only the *S. elongatus* arm is extracted in each case.
11. **GSE252562 contradicts itself.** GSM8003249–GSM8003251 and
    GSM8003267–GSM8003269 are titled `…8 cycles LD8:16…` while their
    `characteristics` field reads `treatment: 8 cycles of LD16:8`. The
    photoperiod of those six samples cannot be resolved from the record. Do not
    assign them to either photoperiod set without asking the depositors.
12. **GSE122841 has no replicates despite saying it does.**
    `!Series_overall_design` states sequencing was performed "in triplicate",
    but the series contains 4 GSMs — one per genotype × condition. Separately,
    the paper's own Methods paragraph gives both "for 2 days" and "for 7 days"
    for the same 2.5 mM H₂O₂ exposure, while GEO says 2 days.

Two further rows carry an **unresolved conflict** rather than an error, and say
so in `status`: GSE237858 (GEO gives ~40 µE m⁻² s⁻¹ for the sequenced cultures,
the paper's general Methods gives 50 µE m⁻² s⁻¹) and GSE227397 (GEO omits light
intensity and CO₂; the paper's general growth paragraph supplies them but ties
them to its ¹⁴C and biochemical assays, not to the RNA-seq cultures).

Two rows are associated with a publication **indirectly** and are marked so:
GSE140121 (PMID 32194605 matches the series title exactly and the GEO
contributor list matches the author list in order, but the paper never cites the
accession) and GSE327989 (PMID 42045357 matches title and contributors, but the
paper cites DDBJ PRJDB39746).

## B.5 Observations held for package D, not decided here

These are values, not comparability judgements. They are recorded because they
sit outside the tolerance bands in
[data-contract.md](../../validation/data-contract.md) "Condition comparability"
and will matter when that package runs.

- **GSE102914** grows at **20 °C** in **EPA Very Soft Water**, not BG-11.
- **PXD005851** grows the *S. elongatus* arm at **22 °C**, unshaken.
- **PXD014590** (UTEX 2973) grows at **37 °C** under **500 µmol photons
  m⁻² s⁻¹** and 5% CO₂.
- **GSE311172** runs at **760 µmol photons m⁻² s⁻¹**, and its varied axis is
  **O₂ saturation (0–476% of air)**, which is not one of the contract's axes.
- **PXD011485** varies CO₂ across 0.04%, 0.5%, 1% and 10% — four condition sets
  that straddle the contract's ambient/elevated boundary within one deposit.
- **CO₂ is the weakest axis in the set**: 41 of 79 assay rows report it.
  **Replicate structure is the second weakest**: 46 of 79 state it, and
  where a count was only countable from the GEO sample list the cell says
  "not stated" and gives the count separately, never as a stated value.

## B.6 Capability notes for the handoff contract

Re-verified or newly established 2026-10-03, for
[claude-science-handoff.md](../../validation/claude-science-handoff.md):

- **Europe PMC `fullTextXML` returns HTTP 500, not 404, for a PMC record
  outside the OA subset.** A 500 from that endpoint is therefore not evidence of
  a transient fault; it is the normal answer for a non-OA deposit. 19 of 26
  PMCIDs in this package returned full text; 7 returned 500.
- **NCBI `efetch db=pmc` is a useful second route and recovered 2 of those 7**
  (PMC11473183, Science 2024; PMC4477845, Curr. Biol. 2014) with a full
  `<body>`. For the other 5 it returns front matter only. Try it before
  declaring a PMC record unreadable.
- **`pmc.ncbi.nlm.nih.gov/articles/<PMCID>/pdf/` serves a proof-of-work
  challenge** to automated clients. Not solved here, and no agent should.
- **Europe PMC `supplementaryFiles` works and is the route for per-organism
  methods tables** — confirmed again on PMC5705920 (16 files). It returns a
  short empty XML stub, not an error, for a non-OA record.
- **PRIDE REST v3** (`/pride/ws/archive/v3/projects/<PXD>`) serves title,
  description, sample and data protocols, organism list and publication
  references, and was the source for every PXD row.
- **The NCBI PMC ID converter disagrees with Europe PMC** in one direction worth
  knowing: Europe PMC's `resultType=core` search returned no PMCID for PMID
  35201348, while `idconv` resolved it to PMC9157067. Query both.
- **No domain in this package required a new allowlist grant.** Hosts used:
  `ncbi.nlm.nih.gov`, `eutils.ncbi.nlm.nih.gov`, `ebi.ac.uk`,
  `api.openalex.org`, and `osti.gov` (via the article fetcher, for the PNAS
  limonene deposit).

## B.7 Method and boundaries

Archive metadata was retrieved first and treated as a first-class source: GEO
SOFT records (`acc.cgi?targ=all&form=text&view=brief`) for all 34 series,
grouped by identical `!Sample_growth_protocol_ch1` / `!Sample_treatment_protocol_ch1`
text so that condition sets follow the depositor's own grouping rather than a
guess; PRIDE REST v3 for all 14 projects. Publications were resolved through
Europe PMC and the NCBI ID converter, and full text was taken by deposit only —
Europe PMC, PMC, Unpaywall, Semantic Scholar, in that order. Extraction ran
per record against the retrieved bytes, and every emitted quote was then
re-matched against those bytes mechanically; an unmatched quote was not allowed
into the table.

Boundaries observed: no licence permission is decided — the `licence` column is
carried over from the input unchanged and still reads "Recommendation only". No
locus join is invented; where the carried-over `mapping_route` is contradicted
by a corrected strain the cell says the route does not apply and preserves the
input value verbatim rather than substituting a new one. No prediction is
reported as a measurement. No comparability judgement is made. Every claim
carries a checkable source. Nothing outside the package's scope was attempted,
and no file other than this one and the table was created or modified.


## C.1 Package C — licence and redistribution terms per artifact

Dispatched 2026-10-02 against the same input and the same 57 in-scope rows. This
section is **evidence and recommendation only**. No licence permission is
decided here; the decision belongs in
[source-ledger.md](../../validation/source-ledger.md).

| | |
| --- | --- |
| Table | [`cyano_package_C_licences_20261003.tsv`](cyano_package_C_licences_20261003.tsv) |
| Rows | **57** data rows plus one header row — one per artifact, no condition-set expansion |
| Bytes | 191403 |
| SHA-256 | `5d8b1a99a72708c02946879accf9ea553edee3150a61407fb23475ef9697241c` |
| Input | `cyano_package_A_candidates_20260928.tsv`, SHA-256 recomputed as `d6f456174fd10cb4cd265a342134de5e5de0d6580ebc0c93fc1d8b149073001f` — matches |

Status: **37 candidate**, **20 escalate**, 0 rejected. Every `licence` cell is built from
four labelled parts — `REPOSITORY TERMS`, `PER-FILE NOTICE`, `ARTICLE TERMS`,
`DIVERGENCE` — followed by a `RECOMMENDATION` segment that is explicitly marked
as a recommendation and never as a permission.

`conditions` and `replicates` are carried over from package A **unchanged**, as
this package's return format requires. They are superseded by
[`cyano_package_B_conditions_20261003.tsv`](cyano_package_B_conditions_20261003.tsv);
read the two tables together and take those two columns from B.

### Why the `checksum` column is empty on every row

The package's hard boundary is "do not download a data file beyond what is
needed to read its terms". **No candidate artifact carries an embedded licence
notice**, so no data file needed to be retrieved and none was. The files this
session did retrieve are the governing-text pages and the PMC records; their
SHA-256 values and retrieval dates are carried inside the `licence` and `source`
cells where they belong, not in `checksum`:

- NCBI *Policies and Disclaimers*, `https://www.ncbi.nlm.nih.gov/home/about/policies/`
  — retrieved 2026-10-03, SHA-256 `8ad8f6f186ca51ec73a5fb8935ecfa17b8cbaad300b7025b381898ab72621869`
- EMBL-EBI *Terms of Use*, `https://www.ebi.ac.uk/about/terms-of-use/`, stamped
  "Last revised: 5th February 2024" — retrieved 2026-10-03, SHA-256 `f3c148e6b91501af2a516e24edf0be61c21e2ce1b4e9f40bd834c606f1f23ae9`

## C.2 The finding that matters most: PRIDE splits on a date, GEO never grants

**PRIDE declares a licence per project, and the 14 projects split cleanly.** The
field is `license` in the PRIDE REST v3 record:

| PRIDE `license` | Projects | Submitted |
| --- | --- | --- |
| `Creative Commons Public Domain (CC0)` | PXD011485, PXD014590, PXD019731, PXD023591, PXD027430, PXD030282, PXD036717, PXD044412, PXD062851, PXD074299 | 2018-10 onward |
| `EBI terms of use` | PXD000510, PXD005105, PXD005851, PXD010000 | 2014 to 2018-06 |

This is the only **affirmative grant over a deposited artifact** anywhere in the
57 rows. CC0 is a grant; "EBI terms of use" is not — the EMBL-EBI page says
EMBL-EBI "imposes no additional restriction … than those provided by the data
owner", which is a disclaimer of EBI's own claims, not a licence from the
depositor. The four pre-2018 projects therefore carry no licence over their
files, and their rows say so.

**GEO and RefSeq never grant anything.** NCBI's Molecular Data Usage paragraph
is quoted in full on every NCBI row, and it cuts both ways: *"NCBI itself places
no restrictions on the use or distribution of the data contained therein. Nor do
we accept data when the submitter has requested restrictions on reuse or
redistribution."* — but also *"NCBI cannot provide comment or unrestricted
permission concerning the use, copying, or distribution of the information
contained in the molecular databases."* No GEO series and no RefSeq assembly in
this set carries a per-file licence field or a per-file notice; the `PER-FILE
NOTICE = none` segment on each row records that as a checked absence rather than
an omission.

**The RefSeq rows are the one place a public-domain statement applies**, and
only to one layer. NCBI's *Copyright Status of Webpages* section says
*"Information that is created by or for the US government on this site is within
the public domain."* A PGAP annotation is computed by NCBI and falls under that
sentence; the submitted assembly sequence inside the same GCF accession is
submitter data and falls under Molecular Data Usage instead. The nine annotation
rows state both and warn that the two layers in one accession do not share a
status.

## C.3 Article terms, and where they diverge from the artifact

Across the 57 rows the article side resolves as: **24 openly licensed**,
**10 non-open**, **10 unreadable**, **13 not applicable** (the deposit has no
linked publication). Each row quotes the article's `<permissions>` block
verbatim from the PMC record.

The acceptance criterion asks for divergence to be shown where it exists. Three
distinct shapes appeared:

1. **Grant on the artifact, non-open article** — the cleanest case and the one
   that resolves in the repository's favour. **PXD027430** is CC0 at PRIDE while
   its article is under the Oxford University Press *Standard Journals
   Publication Model*. The CC0 declaration reaches the deposited mass-spectrometry
   files; the OUP notice does not. Same shape for **PXD036717**, whose article
   could not be read at all but whose files are CC0 regardless. These rows are
   `candidate` because the artifact's licence question is settled.
2. **No grant on the artifact, all-rights-reserved article** — the riskiest
   combination, and the largest single group. The six Markson 2013 GEO series
   (**GSE50908, GSE50919, GSE50920, GSE50922, GSE51112, GSE52486**) sit behind
   an article whose PMC permissions block reads *"© 2013 Elsevier Inc. All
   rights reserved."* **PXD000510** sits behind *"© 2014 by The American Society
   for Biochemistry and Molecular Biology, Inc."* **GSE252562** and **GSE59112**
   sit behind the PMC text-mining notice, *"This file is available for text
   mining. It may also be used consistent with the principles of fair use under
   the copyright law."* — which is a permission to text-mine the PMC copy, not a
   licence over the GEO files. In all nine rows **nothing licenses
   redistribution of the artifact**, and the status says so.
3. **Per-file legends that differ from the article** — the Adomako 2022 pattern
   the dispatch names. It appears once in this set, and it is ASM again:
   **PXD005851**'s article (mBio, PMC5705920) carries an individual legend on
   each supplementary table — *"Copyright © 2017 Nakayasu et al. This content is
   distributed under the terms of the Creative Commons Attribution 4.0
   International license."* — while the article body and the PRIDE deposit say
   nothing of the kind. 6 of the 154 `<supplementary-material>` legends examined
   across all 29 PMC records carried licence language, and all 6 are from that
   one ASM article. **Outside ASM journals, the per-file legend route returns
   nothing in this set**, which is worth recording in the handoff contract: the
   route works, but the per-file notices largely do not exist.

## C.4 Artifacts whose governing text could not be read

**No request in this package was refused by the sandbox allowlist.** Two
retrievals were refused by the source and were left alone:

- `https://www.ncbi.nlm.nih.gov/geo/info/disclaimer.html` and
  `https://www.ncbi.nlm.nih.gov/geo/info/faq.html` returned a **reCAPTCHA
  browser-check page** rather than content. Not worked around. The NCBI
  *Policies and Disclaimers* page is the parent document for the same databases
  and was readable, so the GEO rows are not short of governing text — but the
  GEO-specific disclaimer page itself was not read.
- `https://www.ebi.ac.uk/pride/markdownpage/datapolicy` returns a
  JavaScript-only shell with no text in the HTML. The PRIDE per-project
  `license` field and the EMBL-EBI Terms of Use carry the same ground and were
  readable.

Ten rows (nine artifacts' worth of articles) have **article** terms that could
not be read. All are source-side, and all for reasons already established in
§B.3:

| Article | Rows affected | Why |
| --- | --- | --- |
| PMID 29241543, Cell Reports | GSE103462, GSE103463, GSE103606, GSE103644, GSE103704, GSE105774 | gold OA but no PMC deposit, so no `<permissions>` block by the Europe PMC route |
| PMID 20018699, PMC2799730, PNAS 2009 | GSE18902 | in PMC outside the OA subset; `fullTextXML` 500, `efetch` front matter has no permissions block |
| PMID 27911807, PMC5167140, PNAS 2016 | PXD005105 | same |
| PMID 31161548, Env Sci Pollut Res | GSE102914 | closed access, no PMC deposit, Europe PMC `license` field empty |
| PMID 37925065, Metab Eng | PXD036717 | hybrid, no resolvable OA location, no PMC deposit — row is still `candidate` because the PRIDE files are CC0 |

Thirteen rows have **no article at all** to read: the nine RefSeq annotations,
plus GSE225426, GSE311172, PXD010000 and PXD023591, whose deposits carry no
publication link. Those rows say `not applicable` rather than `not read`, since
there is nothing that could have diverged.

## C.5 Capability notes to add to the handoff contract

- **PRIDE REST v3 exposes a per-project `license` field.** This was not in the
  contract's capability list and it is the single most useful licence field in
  the package. `https://www.ebi.ac.uk/pride/ws/archive/v3/projects/<PXD>` →
  `license`. Values seen: `Creative Commons Public Domain (CC0)` and
  `EBI terms of use`. The field also dates the policy change: every project
  published from 2019 onward in this set is CC0.
- **The Europe PMC per-file legend route works but usually finds nothing.** 154
  `<supplementary-material>` blocks across 29 PMC records yielded licence text
  in 6, all from one ASM article. The route should stay in the contract, but a
  ticket should not assume a per-file legend exists.
- **NCBI `efetch db=pmc` returns the `<permissions>` block even when it withholds
  the body.** That is how the Elsevier, ASBMB and OUP notices above were read
  for records Europe PMC refuses with HTTP 500. Useful: a non-OA PMC record is
  unreadable for *methods* but often readable for *terms*.
- **`ncbi.nlm.nih.gov/geo/info/*.html` is behind a reCAPTCHA check** for
  automated clients, while `ncbi.nlm.nih.gov/home/about/policies/` is not. Point
  licence questions at the policies page.
- **`ebi.ac.uk/pride/markdownpage/*` is client-rendered** and returns no text to
  a plain fetch; use the REST record instead.

## C.6 Method and boundaries for package C

Repository terms were taken from the repository's own record in every case: the
GEO SOFT record and NCBI's policies page for the 34 GEO series, the PRIDE REST
v3 record and the EMBL-EBI Terms of Use for the 14 PRIDE projects, and NCBI's
policies page for the 9 RefSeq assemblies. Article terms were taken from the
`<permissions>` block of the PMC record, by Europe PMC `fullTextXML` where the
deposit is in the open-access subset and by NCBI `efetch db=pmc` otherwise. Each
of the five governing quotations from the two terms pages was re-matched against
the retrieved page bytes before being written, and the page checksums are
recorded above. `journals.asm.org` was not contacted.

Boundaries observed: no licence permission is decided — every row ends in a
segment explicitly labelled as a recommendation, and each one points at
`source-ledger.md` for the decision. No data file was downloaded. No join was
invented; `mapping_route` is carried over verbatim. Every claim carries a
checkable source. No file other than this one and the two tables was created or
modified.


## D.1 Data-use audit — how the shipped data is used, derived, and described

Ticket `docs/notes/tickets/O_claude-science-data-use-audit__20260928.md`, dispatched
2026-10-02. **Findings only.** No code, data, site file, ticket or validation
document was changed. Nothing below resolves rows 13 to 15 of
[AAA-biological-decisions-to-review.md](../../validation/AAA-biological-decisions-to-review.md).

| | |
| --- | --- |
| Findings table | [`cyano_data_use_audit_20261003.tsv`](cyano_data_use_audit_20261003.tsv) |
| Markdown rendering | [`cyano_data_use_audit_20261003.md`](cyano_data_use_audit_20261003.md) |
| Findings | **10** |
| Bytes | 14636 |
| SHA-256 | `708a3294f993fc1574f76ef6a969e519721a4c21816c262f3db9fe19d60e4913` |
| Commit audited | `70bc59004337b5f0db7811dd829474efda4e98a4` on `main` |

**The tree is not clean, and two of the findings sit in modified files.** At the
time of the audit `main` is at `70bc5900` with 28 files carrying uncommitted
modifications, including **`site/js/ui/chromosome-view.js`** and
**`site/js/ui/gene-viewer.js`**. Findings A-02 and A-07 cite the working-tree
contents of those two files, not the pushed commit. Everything else sits in
unmodified files or in `site/data/`, which is clean.

Severity: 2 high (A-01, A-02), 1 medium (A-04),
7 low (A-03, A-05, A-06, A-07, A-08, A-09, A-10). By category: 3 document drift,
3 disallowed fill, 2 meaning drift, 1 denominator or scale error, 1 prose
overstatement.

### The two that can change a scientific conclusion

**A-01, the comparison views clamp 16% of the measured-expression genes into one
bucket.** `compare-model.js` sets `Z_LIMIT = 3` and clamps every robust z-score
to it. Recomputing the same robust scale the code uses — median and
1.4826 × MAD, IQR fallback — over the shipped `genes.json`: **421 of 2,551
valued genes (16.5%) exceed |z| = 3 on `expression`, and 272 of 1,727 (15.7%) on
`tssInitiation`**, with maximum robust z of 432.3 and 378.4. Seven of the 35
registry metrics clamp more than 5% of their valued genes. In the radar and
parallel-coordinates views every one of those genes is drawn at the rim,
indistinguishable from a gene at exactly z = 3, and nothing marks a value as
clamped. These are the two metrics a reader is most likely to compare two
shortlisted candidates on. `candidate-comparison-and-export.md` does not mention
the clamp.

**A-02, the gene visualizer and the chromosome view place the same TSS up to
198 nt apart.** The gene visualizer draws each Tan 2018 gTSS at
`offset: -site.sourceStartDistanceNt` — the published distance measured back
from *this* release's start — while the chromosome view draws the published
*absolute* coordinate. Both are documented and both are defensible; what no
document records is that they disagree. Recomputing the implied distance from
`genes.json` starts against the positions in `tss_evidence.json`: **2,196 of
2,432 gTSS rows agree exactly (90.3%), 236 rows over 178 of the 1,789 loci do
not**, differing by 3 to 198 nt with a median of 34.5. For **15 sites the
published position now falls inside the current CDS** (implied distance
negative, to −146 nt) — the gene visualizer still draws them upstream. A reader
taking a promoter boundary from one panel and checking it on the other gets two
answers, with nothing saying which is which. This bears directly on open lab
decision row 8.

### The rest, in one line each

- **A-03 (document drift).** `live-metrics.js` mean-imputes missing cells before
  the risk and perturbation PCAs. The behaviour is disclosed to the reader in
  `projection-help.js` and sanctioned by `metric-explanations.md:7`
  ("mean-imputing nonfinite cells"), but the authoritative data contract says
  nulls never become a zero or a median and records no exception. No gene is
  affected today — none of the feature columns has a null in the shipped
  release — so this is a conflict between two validation documents over a
  currently dormant mechanism, not a wrong value on screen.
- **A-04 (prose overstatement).** The length histogram's accessible label,
  caption and per-bin tooltips assert a blue/grey split by "the selected range"
  for every cohort, but the range bounds are passed as null whenever the cohort
  is not CDS length, so the chart is uniformly blue and no filter was applied.
  The component's own text summary gates the identical clause correctly three
  lines earlier. A screen-reader user has only the label.
- **A-05, A-06, A-07, A-08 (meaning drift / disallowed fill, all latent).** Four
  places where a real value and an absent one would be rendered the same, none
  of which fires on the shipped release: a hardcoded "Dark vs control" prefix on
  warnings that each carry their own `comparison` field; a truthiness guard that
  would drop a start distance of exactly 0 (which does not occur in that file,
  but occurs 47 times in the sibling Table S1 extract); `formatCount(model.lengthCodons ?? 0)`,
  the only place in the interface that would write a missing count as "0", in a
  module whose header says a missing value is an em-space; and `?? 0` on PCA
  loadings, which also feeds the ranking that chooses which contributors are
  shown.
- **A-09 (document drift).** The pipeline writes `expressionPercentile` on the
  average-rank convention, reaching exactly 1.0; the browser's `percentileRank`
  uses mid-rank, topping out at 0.999804 on the same column. The gap is 1.97e-4
  and changes no conclusion — but `metric-convention-parity.md` exists precisely
  to stop one quantity having two definitions, and it has no row for this one.
- **A-10 (document drift).** `meta.json` carries both TSS coverage numbers — 926
  genes without a mapped TSS (so 1,789 with one) and "available for 1,727 of
  2,715 genes" — with no field saying which layer each counts.
  `data-contract.md:608` explains the split; `meta.json`, which is what the site
  loads, does not.

### What was checked and found correct

15 areas, listed in full in the Markdown rendering. The ones worth naming here:

- **Every shipped value reproduces its pinned source.** All 1,727 rows of the Tan
  2018 initiation table and all 2,551 rows of the GSE205444 abundance table match
  `genes.json` exactly, with no mismatches and no shipped value absent from the
  source.
- **The Tan 2018 metadata is accurate against the paper.** The control condition
  (33 °C, 50 µmol photons m⁻² s⁻¹, 3% CO₂), the ≥300-raw-read discovery
  threshold and the two replicate cultures per condition all match the Methods
  verbatim, and the pinned Table S1 extract honours the threshold — the minimum
  row-maximum raw count across all 2,475 gTSS rows is exactly 300. The paper's
  own Results-versus-Methods conflict on high-light duration is recorded in the
  provenance file and left unasserted, which is the right handling.
- **Initiation is never called abundance.** All six user-facing strings that put
  a TSS next to abundance wording are disclaimers.
- **The essentiality layer reproduces its contract exactly** — 2,542 admitted
  joins, 660/154/1,617/71/1/39 and 173 unknown — and no ambiguous, not-analyzed
  or absent call is rendered as non-essential.
- **Borrowed evidence never wins implicitly.** `orderTrafficCandidates` ranks on
  `provenance.isTargetOrganism` exactly as the contract requires, and
  `defaultTrafficCandidate` cannot select a borrowed assay.
- **`paintPriority` gates the valued tier on `hasValue`**, so its finiteness
  guard cannot lift a gene with no value above one that has one.
- **The two percentile populations are deliberate and documented** — the axis
  ranks the filter-visible cohort, the ramp and the detail rank every valued
  gene — and `explicit-metric-axes.md` says so.

### What could not be checked

- **The deployed site was not fetched.** Every check ran against the mounted
  tree, so nothing here confirms the deployed build matches it.
- **No browser was run.** A-01 and A-04 are derived from the source that produces
  the pixels, not from a render; both are worth confirming on screen before a fix
  is designed.
- **The per-file semantic sweep is not exhaustive.** A model-assisted read covered
  49 of 84 file chunks. The other 35 — including `app.js`, `chromosome-view.js`
  chunk 0, `filters.js`, `compare.js` and `panel-designer.js` — were covered by
  targeted pattern sweeps for the named hazards (null-to-zero and null-to-false
  coercion, percentile and z-score populations, clamping, mean or median
  imputation, initiation-versus-abundance wording, every `formatCount` argument)
  plus direct reading of every match. A prose defect in those files matching none
  of those patterns would not have been caught.
- **Rubin 2015 and Adomako 2022 were not re-read.** The essentiality claims were
  checked against `pcc-essentiality.md` and the shipped JSON, which agree
  exactly. Tan 2018 was read in full.

### Three candidates raised and rejected

Recorded so a later audit does not re-raise them. "TypeSafe Jev" is **not** a
fabricated provenance label — it is the pinned `jev-1.13.0` judgment model
documented in `cai-reference-set.md` and carried in the data files. "Lab-reviewed
category" in the search results is **accurate** — `scoreReviewedCategory` reads
only `reviewedFunctionLabels`. And `paintTss` drawing absolute Tan 2018
coordinates is **not** a cross-strain coordinate violation: Tan 2018 measured
UTEX 2973 itself on CP006471/2/3, the genome of record, and the paper-era caveat
concerns the gene model rather than the assembly. The real defect there is the
divergence between the two views, filed as A-02.

### Method and boundaries for this package

Values were re-derived from the shipped files rather than read from the
documents that describe them: coverage counts, percentile conventions, robust
z-scores, essentiality distributions and the TSS start-distance comparison were
all recomputed in a kernel against `site/data/*.json` and `data/expression/*.tsv`.
Tan et al. 2018 was retrieved by deposit (Unpaywall → the publisher's open-access
PDF; gold OA, CC BY) and its Methods read against the metric descriptions. Every
quoted fragment in the findings table was re-matched mechanically against the
file it is attributed to before the table was written; none was accepted
unmatched. Each finding names the file and line or the data field, and the
contract clause or source sentence it rests on.

Boundaries observed: no fix, no patch and no edited repository file — the only
files this package created are the two audit artifacts and this section. No
dataset was admitted, downloaded or proposed. No open lab question was resolved;
where one bears on a finding (rows 8 and 13-15) the finding says so and stops.
Uncertainty is reported in each row's Confidence field rather than resolved.


## A.1 Package A — correction of one returned row

Ticket `docs/notes/tickets/O_claude-science-offload__20260927.md`, dispatched
2026-10-02. Evidence only. No admission, no licence permission, no join.

| | |
| --- | --- |
| Corrected table | [`cyano_package_A_candidates_20261003.tsv`](cyano_package_A_candidates_20261003.tsv) |
| Rows | 74 data rows plus one header row, unchanged |
| Bytes | 44278 |
| SHA-256 | `b93b079861f18d7daf72391e49b8eb12db3fe581dbd08dbb5a4550f6291916ea` |
| Supersedes | `cyano_package_A_candidates_20260928.tsv` (SHA-256 recomputed on the mounted file as `d6f456174fd10cb4cd265a342134de5e5de0d6580ebc0c93fc1d8b149073001f`, matching the dispatch). The 2026-09-28 file is left in place. |

### Rows that changed

**One cell, on one row.** The edit was made at byte level on the 2026-09-28 file
so that nothing else could move; a cell-by-cell comparison of the two tables
reports exactly one difference.

| Row | Column | Before | After |
| --- | --- | --- | --- |
| data row 11 (`GEO GSE106824; PMID 29241543`) | `status` | `candidate` | `rejected: ChIP-seq is not an admitted data type` |

The new value is byte-identical to the `status` already carried by the twelve
other ChIP-seq rejections in the table, so the rejection reason reads the same
everywhere. The candidate count falls from 58 to 57 and the ChIP-seq rejections
rise from 12 to 13.

### CLAIM: GSE106824 is ChIP-seq — **confirmed**

Retrieved 2026-10-03 from
`https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE106824&targ=all&form=text&view=brief`
(78565 bytes, SHA-256 `d4a29fc474eda17b6d6aee56795fcee227d79279d0ef9b5a9cf8f65d44dab2fc`).

GEO fields read, and what they say:

- **`!Sample_library_strategy`** — present on all 12 samples, and **`ChIP-Seq`
  on all 12**. No sample carries `RNA-Seq`, and no sample is missing the field.
- **`!Sample_library_source`** — `genomic` on all 12, not `transcriptomic`.
  This is an independent GEO field agreeing with the first.
- **`!Series_type`** — `Genome binding/occupancy profiling by high throughput
  sequencing`, with no expression-profiling type on the series.
- **`!Series_title`** — "Analysis of RNA polymerase stalling index in wild type
  and the rel- strain of Synechococcus elongatus PCC7942 - chromatin
  immunoprecipitation followed by sequencing during exposure to darkness (cells
  grown in light/dark conditions)".
- **`!Series_summary`** — "We performed ChIP-seq experiments using wild type and
  the rel- strain at dusk, during…".
- **`!Sample_organism_ch1`** — `Synechococcus elongatus PCC 7942 = FACHB-805` on
  all 12; **`!Sample_platform_id`** — `GPL16957` on all 12.

The twelve samples are `GSM2854964, GSM2854965, GSM2854966, GSM2854967, GSM2854968, GSM2854969,`
`GSM2854970, GSM2854971, GSM2854972, GSM2854973, GSM2854974, GSM2854975`.

The row's own `conditions` cell already carried the giveaway — it reads
`chip antibody=Mouse IgG whole molecule (J…` — which is a ChIP characteristic
field that no RNA-seq sample has. Five independent GEO fields agree. The
reclassification is made.

### Sibling check: GSE103606 is 94 RNA-seq + 12 ChIP-seq — **confirmed exactly**

Retrieved 2026-10-03 from the same endpoint for `GSE103606`
(441401 bytes, SHA-256 `fe403811bf2e867886a4d2b47eb3aac2f28df5fe3df6595187bf7143bdc4a6f8`).

- **`!Sample_library_strategy`** over all 106 samples: **`RNA-Seq` 94,
  `ChIP-Seq` 12.** Both counts are exactly as the intake note found. No sample
  is missing the field.
- **`!Sample_library_source`** independently splits the same way: `transcriptomic`
  94, `genomic` 12.
- **`!Series_type`** carries **both** `Expression profiling by high throughput
  sequencing` and `Genome binding/occupancy profiling by high throughput
  sequencing`.
- `!Sample_organism_ch1` is `Synechococcus elongatus PCC 7942 = FACHB-805` and
  `!Sample_platform_id` is `GPL16957` for all 106.

The row is left as a candidate, unchanged, as the dispatch directs.

### One thing the dispatch did not name, found while checking

**GSE103606 is a SuperSeries, and GSE106824 is one of its SubSeries.** This is
in `!Series_relation` on both records:

- `GSE106824` carries `SubSeries of: GSE103606`.
- `GSE103606` carries `SuperSeries of:` **`GSE103462`, `GSE103463`, `GSE103644`,
  `GSE103704`, `GSE105774`, `GSE106824`**.

The containment is exact, not approximate, and it was checked by comparing GSM
sets rather than counts:

- The 12 `ChIP-Seq` samples of GSE103606 are **the same twelve GSM accessions**
  as GSE106824 — identical sets, not merely equal counts.
- The 94 `RNA-Seq` samples of GSE103606 are **exactly the union** of the five
  other SubSeries: GSE103462 (8) + GSE103463 (8) + GSE103644 (6) + GSE103704
  (36) + GSE105774 (36) = 94, every one of them present in GSE103606 and the
  union equal to its RNA-Seq set.
- The two sets together account for all 106 samples with nothing left over.

**Why intake may care.** All seven accessions are separate rows in this table.
After this correction, six of them remain candidates: the SuperSeries GSE103606
and the five RNA-seq SubSeries. Those six rows describe **94 samples, not 188** —
the SuperSeries row and the five SubSeries rows are the same material counted
twice. Anything downstream that counts candidate studies, sums samples, or
treats each row as an independent dataset will double-count this experiment. No
row is changed for it here; that is an intake decision, and the dispatch limits
this package to one row.

### A second inconsistency on the corrected row, not acted on

The corrected row's `assay` cell still reads `transcriptomics (RNA-seq)`, while
the twelve other ChIP-seq rejections in the table read
`ChIP-seq (not an admitted data type)` in that column. Making the row match its
siblings would be a second one-cell change. The dispatch names the
reclassification and says to change no other row, so the edit was kept to the
`status` cell alone and the mismatch is reported here instead of resolved. If
intake wants the `assay` cell aligned, it is a one-cell follow-up.

### Method and boundaries

Both GEO records were re-fetched live on 2026-10-03 rather than read from any
earlier copy, and their retrieved bytes are checksummed above so the fields
quoted here can be re-read from the same material. Every count in this section
comes from parsing `!Sample_library_strategy` out of the retrieved SOFT records,
not from the series-level summary. No publisher host was contacted and no
network grant was needed. The corrected table was produced by editing one field
of the 2026-09-28 file in place at byte level and then verified by a
cell-by-cell comparison against it; no other row, column, or file was touched.
