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

Public archive retrieval is running as DEM-280 and the Tan display pass as
DEM-279, coordinated by agent-deck session bfdd1b08-1791384632. The archive
worker writes only its dossier/source cache outside the release. Source intake,
updated condition records and rescoring wait on checked results, not on the
whole ticket. The public-compendium calibration download is done under the
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
from the plan. The local Docker daemon responds; cluster execution
waits on the compute-backend ticket's configured route/workspace.

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
Independent review of commit `bdb4b15` (DEM-281) accepted the logic and
returned an output line-ending fix, a bare-OD consistency correction and two
mutation-test gaps; all are corrected and the fix is returning for confirmation. Final combined
repository gates and archive intake remain to be recorded.

Every filled value carries a quote and location or a dated reply, enters
as an addendum through intake, and triggers a re-score of the affected pairs. A lab
attestation is never rendered as a reported value. Nothing is estimated from a
similar study.

## Cleanup

On resolution, distil the depositor-query and addendum routine into
[claude-science-handoff.md](../../validation/claude-science-handoff.md), update
`validation/INDEX.md` if its row changes, then delete this ticket and its index row.
