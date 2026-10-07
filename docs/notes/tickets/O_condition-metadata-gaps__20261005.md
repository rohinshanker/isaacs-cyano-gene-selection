# O_condition-metadata-gaps__20261005 — Open

- **Scope:** Fill, or formally give up on, the growth-condition values and per-gene
  tables that are missing from the candidate datasets, so that pairs stop being
  undecidable for want of metadata. Covers `docs/`, a ranking script under `tools/`,
  and, if the owner approves, a reprocessing pilot outside the release.
- **Status:** open
- **Opened:** 2026-10-05
- **Updated:** 2026-10-07

## Current state

Opened at the owner's request. Package D (intake pending; counts recomputed here)
returns 178 pairs as undecidable because a value is missing, not because the studies
differ. CO₂ is undecidable on 744 of 941 pairs, culture format and phase on 735,
light regime on 651. GSE122841 alone sits in 55 undecidable pairs. Separately, the
methods memo's keyword count finds no per-gene table recorded for 32 of 57
transcriptomics rows and for any of the 22 proteomics rows, so most agreement
statistics cannot be computed from deposits as they stand. Register rows covered:
MET-02, MET-03, MET-08 to MET-10, NA-01 to NA-04, LIC-01.

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
   | Golden and O'Shea laboratories | The turbidostat lamp; this is question J1 of [O_comparability-lab-judgements__20261005](O_comparability-lab-judgements__20261005.md) |

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
   correction of 2026-10-05. Each needs its conditions extracted and its licence
   terms read before anything else.
8. **Established absences.** No ribosome-profiling, TIS, TSS or TTS data exists for
   any admitted strain beyond Tan 2018; PCC 6311, PCC 7943 and UTEX 3055 have no
   functional-genomics deposits; UTEX 2973 has no UniProtKB entries. No workaround
   exists short of generating data or widening the admitted organisms, which is the
   owner's scope decision and is not reopened here.

## Verification

Documentation update verified 2026-10-07: the 32-ticket filename/H1/status,
main-queue membership and local-link checks passed; `git diff --check` was clean.
Required gates on the isolated docs worktree: `npm test` 1,116 passed;
`.venv/bin/python -m pytest -q` 494 passed, 1 skipped, 36 subtests;
`.venv/bin/python tools/validate_contract.py` 116 passed, 0 failed, 1 declared
skip. This pass changed no application code, release data or browser UI;
implementation-specific validation remains separate.

Not started. Every filled value carries a quote and location or a dated reply, enters
as an addendum through intake, and triggers a re-score of the affected pairs. A lab
attestation is never rendered as a reported value. Nothing is estimated from a
similar study.

## Cleanup

On resolution, distil the depositor-query and addendum routine into
[claude-science-handoff.md](../../validation/claude-science-handoff.md), update
`validation/INDEX.md` if its row changes, then delete this ticket and its index row.
