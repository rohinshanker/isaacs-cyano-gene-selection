# A_condition-metadata-gaps__20261005 — Active

- **Scope:** Fill, or formally give up on, the growth-condition values and per-gene
  tables that are missing from the candidate datasets, so that pairs stop being
  undecidable for want of metadata. Covers `docs/`, a ranking script under `tools/`,
  and the approved preparation of a reprocessing pilot outside the release.
- **Status:** active
- **Opened:** 2026-10-05
- **Updated:** 2026-10-07

## Current state

Opened at the owner's request. Package D (intake passed 2026-10-06; original counts below)
returns 178 pairs as undecidable because a value is missing, not because the studies
differ. CO₂ is undecidable on 744 of 941 pairs, culture format and phase on 735,
light regime on 651. GSE122841 alone sits in 55 undecidable pairs. Separately, the
methods memo's keyword count finds no per-gene table recorded for 32 of 57
transcriptomics rows and for any of the 22 proteomics rows, so that provisional keyword count is not a current processed-table inventory.
Agreement statistics still need verified per-sample tables and replication. Register rows covered:
MET-02, MET-03, MET-08 to MET-10, NA-01 to NA-04, LIC-01.

## Active implementation, 2026-10-07

The offline ranking tool and reviewed inventory are implemented. They use the
original Package D table plus the 2026-10-06 rescore: 941 pairs, 163 undecidable,
32 escalated and 746 not comparable. The 252 exact field/text variants were
classified by Jev 1.13.0 and inspected by the coordinator; the ranking contains
142 missing/incomplete/uncertain field cells. One cell is the conditional last
metadata blocker for a pair: GSE50920's flask temperature (row 48, one pair).
GSE122841 rows 17 and 18 affect 30 and 25 undecidable pairs respectively, with
multiple missing fields on each. These counts describe the default screen,
not the owner's separate pair judgements, including conditional J2. The row-48
temperature cell remains historically not retrieved in the pair table, while
the accepted BC addendum already established it as not reported; a depositor
answer is needed rather than another paper retrieval.

Inputs and output:

- `tools/rank_condition_gaps.py` and `tests/test_rank_condition_gaps.py`;
- `docs/notes/handoff/cyano_condition_gap_inventory_20261007.json`;
- `docs/notes/handoff/cyano_condition_gap_ranking_20261007.tsv`.

The archive sweep is complete: 43 GEO series plus PRIDE/ArrayExpress records,
287 retrievals, and 180 candidate rows with 93 quoted passages. Independent
intake re-fetched 80 sources and re-matched all 93 quotations. It accepted
148 corrected/scoped statements, held 29 and rejected 3 proposed values;
these are evidence decisions, not source admission. The reviewer caught a
100 mE-to-micro-unit conversion, overstated ChIP replication, stress-only
medium transferred to controls, and several sampling/OD scope errors.

Artifacts are `cyano_archive_condition_candidates_20261007.*`, the preserved
analyst dossier, `cyano_archive_condition_intake_20261007.*`, and the scoped
`cyano_package_B_archive_addendum_20261007.json`. The corrected retrieval
catalogue points the obsolete SAMD/SAMN misresolution at its retained wrong
response; all 287 current path/hash associations match their files. The
coordinator additionally read the 24 model-only negative cells and accepted
only narrow series/protocol/characteristic-field absence statements in
`cyano_archive_condition_manual_supplement_20261007.json`; no statement is
extended to unread papers. PXD023591 was checked separately and provides no
culture-condition fill; its 37/45°C protocol temperatures are digestion,
not growth. No depositor messages were sent.

`cyano_dataset_condition_records_20261007.json` replaces the working compact
snapshot for new work: GSE311172 continuity is unknown, GSE252562's mixed
short-day aggregate has no unconditional photoperiod, and GSE237858's
reported fluorescent lamp description is restored without inventing spectrum
equivalence. The archive/paper flux disagreement stays open. All 39 GSE311172
pair screens need to withdraw inferred temporal comparisons; rows 442, 473 and
725 require independent spectrum screening, with no replacement pass/fail
invented. The row-35 GSE252562 aggregate also needs explicit migration or
rescoring before use. The ranking above remains the pinned historical pair
snapshot, not a claim that these newly reviewed conditions have already been
fully rescored or admitted.

The GSE227397 paper was directly retrieved and quoted/matched: its general
growth Methods state the 12-h L/D cycle, 50 photon flux and 50 mM NaHCO3
supplement, while the RNA-seq section names the deposit. This narrows the
archive-only photoperiod hold; the bicarbonate is not a gas CO2 percentage.
The location/scope and SHA-256 are in
`cyano_condition_paper_addendum_20261007.json`.

The public-compendium calibration download is done under the
existing approval:
`cyano_imodulon_calibration_20261007.json` pins commit and file hashes. Both
2,669-by-300 matrices have unique gene/profile IDs, finite values and exact
experiment-column agreement with the 300 metadata rows. The gene-info table
and matrices have the same 2,669 exact mixed-namespace IDs
(2,661 `Synpcc7942_`, 8 `HTX97_RS`) in different orders; no positional join,
UTEX mapping or source admission was attempted. The 300 profiles contain 291
nonempty distinct run accessions and 9 profiles without a run accession; they
are not automatically 300 distinct biological replicates.
The source files remain in `/tmp/cyano-condition-calibration-20261007`.
The raw-read job plan is prepared as
`cyano_raw_read_pilot_plan_20261007.json`: GSE122841's four exact GSM/BioSample/
SRX/SRR relationships, eight paired FASTQ URLs with archive MD5/byte pins
(6,615,553,907 compressed bytes), matching two-replicon GCF_000012525.1
FASTA/GFF SHA-256 pins, SBRG pipeline commit and nine immutable container
digests. The job envelope is 8 CPU/8 GB per large task, one large task at once,
80 GB scratch and 12 h initial wall time; it is a planning envelope, not a
measured runtime. Nextflow 22.10.0 is the paper's version and is not installed
here. Neither raw files nor a job were run. Strand inference and unresolved
biological replication remain explicit, so no replicate-band inference follows
from the plan. The local Docker daemon has 4 CPUs and about 5.8 GiB memory; 48 GiB disk
is free, below this prepared full-pilot envelope. Cluster execution waits on the compute-backend ticket's configured route/workspace.

## Work

1. **Automated: rank what is worth chasing.** A script over the package D table
   lists every missing cell with the number of undecidable pairs it sits in and how
   many would become decidable if it alone were filled. People then chase the top of
   that list, not all of it. Ships with a test over the package D table.
2. **Automated: look where the sweeps did not.** For each series, read the BioSample
   and SRA run attributes, which sometimes carry growth conditions that the GEO
   series record omits. These are public records the agents can reach. A value found
   there is quoted with its field name and enters as a package B addendum through
   intake.
3. **Manual: the papers.** Most missing cells are behind the eight unread papers;
   see [O_unreadable-literature-workarounds__20261005](O_unreadable-literature-workarounds__20261005.md).
   Done for five of them on 2026-10-06: the addendum
   (`docs/notes/handoff/cyano_package_BC_addendum_20261006.tsv`) fills PXD036717's
   whole condition set, GSE102914's growth phase and replicates, and the
   replicate structure of GSE18902, GSE51112 and the Puszyńska series; it
   settles as "not reported" (read and silent) CO₂ and growth phase for the
   Puszyńska series, light intensity and CO₂ for GSE102914, and the flask
   temperature for GSE50920 and GSE50922. Those cells stay undecidable for want
   of a value the authors never gave; only a depositor reply (item 4) can fill
   them.
4. **Manual: write to depositors.** The agents draft, the owner or a labmate sends,
   and a reply is quoted with its date. Nothing is assigned until a reply arrives.

   | Record | Ask |
   | --- | --- |
   | GSE122841 | CO₂, light, replicate count; the record says "in triplicate" and holds four samples |
   | GSE252562 | Which photoperiod the six samples titled `LD8:16` with characteristics `LD16:8` had |
   | GSE45762 | Which sample each count column is; the workbook's header and its sample sheet disagree on the time point |
   | GSE237858, GSE227397 | Which light value applies to the sequenced cultures; GEO and the paper differ |
   | GSE225426, GSE311172, PXD023591 | Growth conditions, and an explicit reuse statement; none has a publication |
   | GSE140121, GSE327989 | Confirmation that the matching paper describes this deposit |
   | Golden/O'Shea laboratories | Flask temperature for GSE50920/GSE50922; J1 spectrum equivalence is already owner-decided. J2 is conditionally displayed pending the authors' answer in [O_comparability-lab-judgements__20261005](O_comparability-lab-judgements__20261005.md) |

5. **Lab knowledge, kept apart from sources.** A labmate who knows a group's
   standard setup may record it, but as a lab attestation with name and date, never
   as a reported value. If this route is wanted, the condition record gains a fifth
   status beside reported, not reported, not retrieved and conflicting; that is a
   contract change for the owner.
6. **Missing per-gene tables.** Three routes, cheapest first.
   - The PCC 7942 iModulon compendium already ranked third in the
     [roadmap](../../validation/future-data-roadmap.md#ranked-candidates): about 300
     profiles processed by one pipeline, in a repository under an MIT licence. It
     would give uniformly processed values for many of these series without any
     compute here, and would also test whether the pilot's study effect is
     biology or pipeline. It is not admitted; calibration downloads were approved on
     2026-10-05 in the source ledger. Calibration does not admit it.
   - Supplementary tables of the papers, where a licence covers them, as with
     PXD005851's Table S1.
   - Uniform reprocessing from raw reads. **Approved by the owner 2026-10-05.**
     **Compute update, 2026-10-07:** Bouchet is available to the owner, but the
     Spinup/OOD choice and cluster agents/workspace are not set up. Cluster
     execution waits on D1b in
     [O_folding-compute-backend__20260930](O_folding-compute-backend__20260930.md).
     Prepare the pinned input/pipeline/job plan independently; do not claim a
     runnable cluster workspace yet. A one-series pilot can still use an
     available local machine under the existing approval.
7. **Eleven sources with no metadata at all yet.** Nine series the first sweep
   mislabelled as ChIP-seq and two it never saw, listed in the scan ticket's
   correction of 2026-10-05. Each needs its conditions extracted and the source terms recorded for correct
   attribution. The owner's 2026-10-06 distribution rule removes the old licence
   hold; admission and access terms still apply.
8. **Coverage and negative evidence.** Tan 2018 remains the admitted start-site
   evidence used by the current UTEX view. That is not evidence of no public
   sister-strain start/termination deposits: the scan's correction already lists
   GSE29264 as a PCC 7942 start-site candidate and the roadmap lists GSE309256
   as a termination candidate. This ticket admits neither. Recheck the current
   source register before treating an old sweep's negative finding as a reason
   to generate new data or widen organism scope.

## Depositor queries — prepared, not sent

Use the subjects and bodies below with the corresponding submitter or authors.
Every answer needs a dated reply, explicit sample scope and source intake.
There is no permission question here: the owner or labmate sends these messages
under the ticket's established workflow. Reuse permission is not re-requested;
the owner's citation-only distribution decision of 2026-10-06 applies.

### GSE50920 / GSE50922 — temperature of clock-rescue flask cultures

Hello,

We are comparing the S. elongatus PCC 7942 expression datasets GSE50920 and
GSE51112, keeping experimental conditions separate. For the BG-11M tissue-culture
flask / clock-rescue samples in GSE50920 and the matching GSE50922 sample arm,
could you confirm the actual growth and sampling temperature? The flask methods
we read specify light, CO2, buffer and dilution, but do not give that temperature.
Please distinguish these flask cultures from the turbidostat cultures reported
at 30°C and identify the GSM samples to which your answer applies. A protocol
or sample sheet would help us record it accurately. Thank you.

### GSE122841 — culture conditions and sequencing replication

Hello,

We are checking the four deposited samples in GSE122841 (WT/OsTPX, normal/H2O2).
Could you confirm, for each condition, the photon flux, lamp/spectrum, light/dark
schedule, CO2/air supply, culture medium and vessel, and growth phase or OD at RNA
harvest? We would also appreciate the number of independent biological cultures
sequenced for each deposited sample, whether cultures were pooled, and whether
there are separate biological-replicate read files. The study describes
triplicate sequencing while GEO lists one sample for each of the four conditions;
we want to represent that relationship accurately. Thank you.

### GSE252562 — contradictory LD8:16 / LD16:8 labels

Hello,

Could you confirm the actual photoperiod for the six GSE252562 samples whose
titles say LD8:16 and whose characteristics say LD16:8? Please identify the GSM
accessions, the hours of light and dark in the experiment, and which deposited
labels should be corrected. Could you also confirm that the maintenance lamp
and temperature described in the protocol applied during the treatment cycles?
A corrected sample sheet would resolve the ambiguity. Thank you.

### GSE45762 — processed-count column identity

Hello,

We are checking the processed-count workbook deposited under GSE45762. Could you
provide a mapping of each count column to its GSM sample, genotype, time point
and biological replicate? Its column labels and sample sheet give inconsistent
time-point assignments, so we have kept this study out of cross-study comparisons.
Please indicate which labels are correct and whether any column pools cultures.
A corrected workbook or explicit column-to-sample sheet would be ideal. Thank you.

### GSE237858 — light at RNA sampling

Hello,

For your dataset GSE237858, could you confirm the photon flux,
lamp/spectrum and light/dark schedule that applied specifically to the sequenced
cultures at sampling? The deposit and article do not give a single unambiguous
RNA-sampling light description. Please distinguish RNA-seq cultures from other
cultivation or photobioreactor experiments, identify the GSM samples, and confirm
the CO2/air regime and harvest growth phase/OD for those samples. Thank you.

### GSE227397 — light at RNA sampling

Hello,

For your dataset GSE227397, could you confirm the photon flux,
lamp/spectrum and light/dark schedule that applied specifically to the sequenced
cultures at sampling? The deposit and article do not give a single unambiguous
RNA-sampling light description. Please distinguish RNA-seq cultures from other
cultivation or photobioreactor experiments, identify the GSM samples, and confirm
the CO2/air regime and harvest growth phase/OD for those samples. Thank you.

### GSE225426 — unreported growth details

Hello,

We are curating the experimental conditions for your deposit GSE225426. Could you provide a condition-by-sample sheet giving
temperature, photon flux, lamp/spectrum, light/dark schedule, CO2/air supply,
medium, culture format and growth phase/OD at harvest? Please distinguish
independent biological cultures, pooled cultures and technical runs, and identify
any article or supplementary methods describing this deposit. We will retain
separate conditions and cite your data and methods. Thank you.

### GSE311172 — unreported growth details

Hello,

We are curating the experimental conditions for your deposit GSE311172. Could you provide a condition-by-sample sheet giving
temperature, photon flux, lamp/spectrum, light/dark schedule, CO2/air supply,
medium, culture format and growth phase/OD at harvest? Please distinguish
independent biological cultures, pooled cultures and technical runs, and identify
any article or supplementary methods describing this deposit. We will retain
separate conditions and cite your data and methods. Thank you.

### PXD023591 — unreported growth details

Hello,

We are curating the experimental conditions for your deposit PXD023591. Could you provide a condition-by-sample sheet giving
temperature, photon flux, lamp/spectrum, light/dark schedule, CO2/air supply,
medium, culture format and growth phase/OD at harvest? Please distinguish
independent biological cultures, pooled cultures and technical runs, and identify
any article or supplementary methods describing this deposit. We will retain
separate conditions and cite your data and methods. Thank you.

### GSE140121 — article/deposit association

Hello,

Could you confirm which publication and methods apply to your GEO deposit
GSE140121, including the GSM samples and the processed-table
columns covered by that publication? Our record has an indirect article
association rather than an explicit accession link. Please also clarify the
independent biological-replicate count and any pooling, and the CO2 and
lamp/spectrum at RNA harvest where these were not reported. Thank you.

### GSE327989 — article/deposit association

Hello,

Could you confirm which publication and methods apply to your GEO deposit
GSE327989, including the GSM samples and the processed-table
columns covered by that publication? Our record has an indirect article
association rather than an explicit accession link. Please also clarify the
independent biological-replicate count and any pooling, and the CO2 and
lamp/spectrum at RNA harvest where these were not reported. Thank you.

Each draft is addressed to its corresponding study's submitter. No messages
have been sent.

### Additional depositor drafts from intake

**GSE114693 — flux units, assay-specific replication and the missing WT arm**

Hello,

The GSE114693 growth protocol writes 100 mE and mmoles photons. Could you
confirm the intended numerical photon flux and unit for the RNA-seq cultures?
Please also map biological cultures to the RNA-seq and ChIP samples separately:
the RNA-seq records have two biological labels, while each ChIP time point has
only label 1. The design mentions WT RNA-seq, but no deposited RNA-seq sample
is labelled WT; which samples or accession provide that arm? Thank you.

**GSE311172 — adapted-population column identity**

Hello,

In addition to the growth conditions requested above, could you map every
processed-count column to its GSM/SRX/SRR and adapted-population identity?
Seven listed positions contain five discrepant population prefixes between
the GEO labels and the A/B count matrix. Please identify the correct labels
and confirm that the two runs per experiment are technical runs of one
library, rather than independent biological cultures. Thank you.

**E-MEXP-1657 — unit spelling and paired-array culture provenance**

Hello,

Could you confirm the photon-flux unit in E-MEXP-1657's growth protocol and
provide the culture-to-array mapping for its 11 paired two-colour arrays?
Please distinguish the with/without-iron source channels, dye orientations,
independent cultures and any splits of one culture. The SDRF repeats rows
for derived files, so we do not count those as additional cultures. Thank you.

**GSE335065 — timed axenic controls and experimental setup**

Hello,

Could you map the nine Se_ax_90/140/190 samples to their actual experimental
setup and independent cultures? The series includes tube perturbations,
membrane-separated bioreactors and mixed bioreactors; the timed axenic labels
do not establish which setup those controls used. Please include culture
volume/format and harvest growth phase or OD for those samples. Thank you.

## Verification

Documentation update verified 2026-10-07: the 32-ticket filename/H1/status,
main-queue membership and local-link checks passed; `git diff --check` was clean.
Required gates on the isolated docs worktree: `npm test` 1,116 passed;
`.venv/bin/python -m pytest -q` 494 passed, 1 skipped, 36 subtests;
`.venv/bin/python tools/validate_contract.py` 116 passed, 0 failed, 1 declared
skip. This pass changed no application code, release data or browser UI;
implementation-specific validation remains separate.

Focused ranking verification: 16 tests passed, including the actual 941-pair
table, checked-in output replay, source-pin failures, both-side and format/phase
gaps, unresolved comparisons, duplicate/invalid overlays and exact cell review.
Independent review (DEM-281) accepted the final ranking source at `5fcd66d`
after the output line-ending, bare-OD consistency and vocabulary checks were
repaired. Its suggested two additional vocabulary tests were added; all 16
focused tests pass. Final combined repository gates passed: `npm test` 1,148; pytest 510 passed,
1 skipped and 36 subtests; contract 116 passed, 0 failed, 1 declared skip.
Archive intake and the remaining field-specific limits are recorded above.

Every filled value carries a quote and location or a dated reply, enters
as an addendum through intake, and triggers a re-score of the affected pairs. A lab
attestation is never rendered as a reported value. Nothing is estimated from a
similar study.

## Cleanup

On resolution, distil the depositor-query and addendum routine into
[claude-science-handoff.md](../../validation/claude-science-handoff.md), update
`validation/INDEX.md` if its row changes, then delete this ticket and its index row.
