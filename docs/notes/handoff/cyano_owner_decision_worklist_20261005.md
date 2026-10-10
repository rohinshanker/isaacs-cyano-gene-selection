# Owner decision working list, 2026-10-05

Moved here on 2026-10-05 from `docs/validation/AAAA-new-bio-decisions-to-review.md`,
which is now the lab-facing review document and holds only the questions for the
lab, with background. This file keeps the owner's working list as it stood: every
question's state, the owner-only questions, and the queue of work each answer
releases.

The working list of every scientific and scope decision this project is waiting on,
as of 2026-10-05. It holds the fifteen standing lab decisions, the ten comparability
questions J1 to J10 raised by the Claude Science pair scoring and pilot, the other
owner questions that hold tickets open, and the work each answer releases.
[AAA-biological-decisions-to-review.md](../../validation/AAAA-new-bio-decisions-to-review.md#evidence-boundary-for-each-question)
keeps the full evidence boundary for rows 1 to 15; this document keeps their state.

**How to answer.** Reply by id with a decision and, where it is a judgement, its
basis. "Don't know" and "leave as is" are answers. Each decision is recorded with
your name and the date; a labmate's answer is recorded under theirs.

## 1. Comparability questions, J1 to J10

Evidence: `docs/notes/handoff/RET_claude-science-session__20261004.md` (pair
scoring, 941 pairs, none comparable under the thresholds alone) and
`docs/notes/handoff/cyano_comparability_pilot_20261005.md` with its figure.

| Id | Question | State | What is needed from you |
| --- | --- | --- | --- |
| J1 | Do GSE18902, GSE50908, GSE50919 and GSE52486 describe one turbidostat with one lamp, so their spectrum class agrees? | **Decided 2026-10-05, owner:** yes, the spectrum class agrees. All six pairs among the four series now pass every axis. Markson 2013, supplement: turbidostat cultures were grown "as described previously (Vijayan et al., 2009)". Vijayan 2009, Methods: "approximately 25 μmol photons m−2 s−1 white light, bubbled with 500 mL/min 1% CO2 in air, maintained at 30 °C", OD₇₅₀ 0.15. One apparatus by the authors' own citation. Neither paper names the lamp. All four are microarray series | Nothing |
| J2 | Is GSE50920 (array) comparable with GSE51112 (RNA-seq)? | Open, and less pressing after J5: it sets an array against RNA-seq. Markson's supplement gives the flask cultures 100 µE cool fluorescent light, 1% CO₂, OD₇₅₀ near 0.3, and no temperature | A judgement, or leave it |
| J3 | Is OD₇₃₀ or A₇₃₀ acceptable where the contract says OD₇₅₀? | **Decided 2026-10-05, owner:** yes, close enough. In the data contract | Nothing |
| J4 | What is a "narrow miss": 3 °C, a light ratio of 1.5 and a CO₂ factor of 3, as the scoring chose, or another boundary, or none? | **Decided 2026-10-05, owner:** no fixed boundary; it may be drawn wide because the condition scales show how far apart two datasets are. Revisited if the groups look wrong | Nothing for now |
| J5 | Are array and RNA-seq one transcriptomics data type or two? | **Decided 2026-10-05, owner:** an array is usable as transcriptomics, or proteomics for a protein array, but covers only chosen targets. Arrays are listed apart by default, and the RNA-seq selection has an option to include them | Nothing |
| J6 | What counts as data evidence that two datasets are one condition? | **Decided 2026-10-05, owner:** fold-change agreement and level correlation against each dataset's replicate band; distribution comparison is a units check only | Nothing |
| J7 | The literature offers no numerical comparability threshold. Set one, or judge case by case? | **Decided 2026-10-05, owner,** through the confirmed instruction: no pass mark, a person judges each pair from the statistics and the conditions | Nothing, unless a number is wanted after all |
| J8 | No cross-study sample pair reaches the replicate band. Is pooling levels across studies off the table unless the data are reprocessed uniformly? | **Decided 2026-10-05, owner:** proceed with reprocessing | Nothing |
| J9 | Is condition-resolved fitness (RB-TnSeq, GSE205443) a wanted data type? | **Decided 2026-10-05, owner:** yes, in its own tab. Admitted as a data type in the data contract; the work is [O_fitness-screen-data-type__20261005](../../validation/fitness-screen-data.md) | Nothing |
| J10 | The 32 escalated pairs, one by one: may each share a layer? | **Reviewed 2026-10-05, owner:** 23 may share, 5 keep separate, 1 undecided, 3 left blank; three of the 23 are qualified or conditional (pairs 9, 10 and 24). The table is in section 1b | Pairs 8, 11 and 30 were extrapolated on 2026-10-05 at the owner's instruction (8 undecided as pair 7, 11 and 30 may share); pair 7 stays the owner's "maybe" |

Also decided 2026-10-05 and recorded in the contract: decisions D1 to D5 of your
2026-10-04 instruction stand as written; any number of datasets may be shown at
once as separate layers; two datasets share a layer only on a recorded judgement.

## 1b. Pair judgements from the review sheet

The table of the owner's 32 entries and the rules stated along the way now live
in one place, under "Pair judgements from the review sheet" in
[AAAA-new-bio-decisions-to-review.md](../../validation/AAAA-new-bio-decisions-to-review.md#pair-judgements-from-the-review-sheet).

## 2. Standing lab decisions, rows 1 to 15

The questions are verbatim from the earlier list.

| # | Decision to review | Where it stands | What would move it |
| --- | --- | --- | --- |
| 1 | For an actual 6–10-gene panel, are the selected loci, gene models, recoding map, and constraints appropriate for the intended experiment? | Standing. Asked afresh for every exported panel | A named panel to review |
| 2 | Should any of the ten audited CAI-reference candidates enter a revised reference set, and what independent evidence defines a suitable reference? | Open. The 71 loci stay fixed | Independent expression evidence; reprocessed PCC 7942 data would be the first candidate |
| 3 | Is genomic tRNA copy-number adaptiveness a useful proxy for this panel, and what evidence would justify a later expression or charging tier? | Open. 44 tRNAs confirmed computationally; tAI unchanged | A tRNA abundance or charging dataset; none is known |
| 4 | What evidence would justify labelling a UTEX 2973 protein as directly detected? | Open, with new evidence. The condition sweep found PXD014590, a native UTEX 2973 top-down proteome under a CC0 licence | A decision on whether PXD014590 is worth an admission attempt |
| 5 | Which functional claims are safe to use for priority genes, especially when based on homologs or computational GO? | Standing. Reviewed per priority gene | A list of priority genes |
| 6 | Which sources and transfer model should supply a best-available gene-body expression estimate? | Advanced 2026-10-05: reprocessing approved, comparability evidence fixed. The choice of sources and model is still open | The reprocessing pilot and the pair judgements |
| 7 | Should PCC 7942 evidence influence any panel choice, and under which cross-strain caveats? | Standing. Borrowed evidence stays opt-in and labelled | A panel-level decision |
| 8 | Can Tan 2018 start sites support a proposed regulatory interpretation or construct boundary? | Open, with new evidence. The gene visualizer and the chromosome view place 236 of 2,432 sites differently, by 3 to 198 nt, and 15 published positions now fall inside the current CDS | **Which placement a construct boundary should follow:** the published distance, or the published coordinate |
| 9 | Does a short gene's native PCA position reflect meaningful codon use for the proposed experiment? | Standing. Tied to whether the native PCA is retired (section 3) | The PCA retirement answer |
| 10 | Are the rare-codon and local-folding conventions useful for the planned perturbation? | Standing. Model outputs, not measurements | Gene-specific experiments |
| 11 | How should the two Tan 2018 TSS layers reconcile their locus sets? | Decided 2026-09-22 by the owner: keep independent layers, pending lab review | A labmate's review, or nothing |
| 12 | Accept or reject the source-derived category layer, its rubric, and its 0.8 threshold. | Awaiting your decision since 2026-09-22 | Accept, reject, or draw the blinded holdout first |
| 13 | Confirm the condition-comparability thresholds before any multi-dataset layer ships. | **Decided 2026-10-05:** the thresholds are a default screen, not the gate; J3, J4 and J5 answered | Nothing, unless the groups look wrong once built |
| 14 | Which specific dataset pairs are biologically comparable, case by case? | **Rule decided 2026-10-05.** First judgement recorded: the four turbidostat series share a spectrum class (J1) | J10, the review sheet |
| 15 | Is UTEX 3055 close enough for each admitted data type, given its real gene-content difference? | Admitted in its own tier. No functional-genomics data exists for it, so only annotation transfer is live | Q1 in section 3 |

## 3. Other owner questions that hold tickets open

| Id | Question, in short | Holds |
| --- | --- | --- |
| Q1 | Do PCC 6311, PCC 7943 and UTEX 3055 have a comparative use, such as UTEX 3055 as an outgroup for conservation? | Three BioCyc tickets with no database behind them |
| Q2 | One ortholog-annotation ticket organised by database, or six per-strain BioCyc tickets? | All six BioCyc tickets |
| Q3 | For tRNA, are the three dropped candidates and score breakdown wanted, and does "how likely" mean the tool score or a calibrated probability? | tRNA viewer ticket |
| Q4 | Is a clearly labelled predicted pathway and operon layer for UTEX 2973 wanted? | BioCyc UTEX 2973 ticket |
| Q5 | Is curated PCC 7942 pathway and regulatory content wanted as a transferred layer? | BioCyc PCC 7942 ticket |
| Q6 | Is curated *E. coli* context on already-named loci worth a display layer, or export only? | Proposed ortholog work |
| Q7 | Port RBS Calculator v1.0, or assess a current version or another model? | RBS ticket |
| Q8 | Wait for Bouchet, or benchmark the Mac mini and Jetson first? | Folding backend ticket; also where reprocessing runs |
| S3 | Is the audience the recoding-panel workflow or general *S. elongatus* lookup? | Scan ticket; a schema change if the second |
| S4 | Is the native codon-space PCA retired now that the chromosome tab exists, and do the live risk and perturbation PCAs stay? | Scan ticket; row 9 |
| R1 to R8 | The eight clarifying questions of the regulatory-site viewer, starting with which toggle types come first | Regulatory-site viewer ticket |
| C1 | Which regulatory-site types should the recoding metric consider first? | Recoding ticket, one answer from starting |
| A3 | Keep the live PCAs' mean-imputation of a missing cell, or drop such a gene as the precomputed maps do? | Audit-fixes ticket, contract wording |
| T1 | Ratify the list of changes that must be verified before landing, now that Claude Science is the last resort | Topology ticket |

## 4. What can be done now

**No Claude Science handoff remains.** The four rows left in the pending queue are
all in-repository work now: the pair scoring is back and needs only intake; the
two-row relabel of the condition table is made locally; and the tRNA and RBS
claims are researched here. What still needs a person is listed at the end of
this section.

Nothing below waits on a further answer. The order is by how much each releases.

| # | Work | Ticket | Closes or releases |
| --- | --- | --- | --- |
| 1 | Run intake on the pair scoring and on the dataset-selector return with `docs/notes/handoff/INTAKE_PROMPT_20261005_rev1.txt` | Offload, scan | The offload ticket nears closure; the J10 review sheet |
| 2 | Extract conditions, replicates and licence lines from the five supplied papers and the five PMC pages; return them as an addendum; update the ledger rows; re-score the pairs with the OD rule | Unreadable literature, metadata gaps | The literature ticket; up to 11 undetermined ledger rows; many of the 178 undecidable pairs |
| 3 | Make the nine audit fixes: seven mechanical, two with a rendered check | Audit fixes | Both audit tickets |
| 4 | Research the tRNA score question and the RBS validation question here, now that they need not go to Claude Science | tRNA, RBS | Both claims; each ticket then waits only on Q3 or Q7 |
| 5 | Read the 35 audit file chunks the audit did not cover | Evidence gaps | Full audit coverage |
| 6 | Re-implement the pilot with confidence intervals on the seven tables and the iModulon compendium | Evidence gaps, metadata gaps | A reproducible basis for J6; a test of whether the study effect is pipeline or biology |
| 7 | Start a reprocessing pilot on one permitted series | Metadata gaps | The per-gene tables most agreement statistics need |
| 8 | Confirm the five code gaps, open the prerequisites ticket, write structured condition records for the two shipped sources, then build the Data Sources section and its centre peek | Scan step 6 | The dataset selection feature with the sources already shipped |
| 9 | Render the PRIDE policy and NUPACK licence pages; compare the deployed site with the tree; rank missing cells by pairs unlocked; read BioSample and SRA attributes; draft the depositor emails for you to send | Gated pages, metadata gaps | Most of the gated-pages ticket |
| 10 | Track the 2026-09-30 return and its ortholog table, and commit the work of 2026-10-05 | — | A clean tree for the steps above |
| 11 | Extract conditions and licence terms for the eleven reinstated and newly found sources: seven expression arrays and two RNA-seq series that the first sweep mislabelled ChIP-seq, one new CC0 proteome, and one ArrayExpress-only array study | Scan, metadata gaps | Up to eleven more datasets for the data selection window, and the first sister-strain TSS candidate (GSE29264) |

**Needs you present or your answer first.**

- The BioCyc session: you sign in, an agent reads the pages with you there. Q2
  first, since it decides which pages.
- Q1 and Q2 together decide six tickets. C1 starts the recoding ticket. Row 12 has
  waited longest.
- The UI clutter walk, later:
  [O_ui-clutter-human-audit__20261005](../tickets/O_ui-clutter-human-audit__20261005.md).
