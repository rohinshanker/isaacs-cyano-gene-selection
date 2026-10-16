# A_idog-promoter-prediction__20260930 — Active

- **Scope:** Investigate building a new promoter-location predictor around iDOG
  for native UTEX 2973 sequence, with exploratory predictions and explicit
  code/model, evaluation and coordinate requirements for viewer integration.
- **Status:** active
- **Opened:** 2026-09-30
- **Updated:** 2026-10-15
- **Requested future models:** Mythos 5.1 / Fable 5.1. Reserved for future assessment;
  neither availability nor a provider/transport identifier is assumed. Confirm
  routing under the current agent policy when needed; these are not verified
  runtime identifiers or a requirement to wait for an unavailable model.

## Current State

The code-grounded feasibility assessment is complete and awaiting independent
review before closure. [The durable contract](../../validation/idog-locator-feasibility.md)
records every missing module's decoded role, source inventory, runtime/licence
boundaries, mandatory/optional data requirements and a concrete native-scanning,
paired-recoding and evaluation proposal. All 44 tracked paths, nine source
modules and 21 bytecode modules at the pinned public commit were inspected;
no iDOG code was executed. The exact recipe verifies every file hash and
reproduces disassembly with isolated xdis 6.3.0.

This completes investigation, not a prediction-layer release. New-promoter
calculation and display remain explicitly in
[the regulatory-site changes ticket](O_recoding-regulatory-site-change__20260930.md).
There is no owner decision needed to establish missing-code necessity: none of
the twelve missing design/web sources is a dependency of the proposed separate
scanner. The existing Promoter Calculator is the recommended separately named
baseline; iDOG's own design/terminator/RBS parts are not relabelled promoter
predictions. The old finding of absent capability alone is not this resolution;
the new data, architecture, evaluation and integration assessment is included.

Findings tracked for this assessment:
- **IDOG-1:** complete independent bytecode inspection; resolved by the pinned
  inventory and decoded module roles in the feasibility contract.
- **IDOG-2:** preserve a concrete new-locator path and evaluation/data limits;
  resolved by the feasibility contract and explicit continuing recoding scope.
- **IDOG-REVIEW:** open pending the independent exact-patch review.

Verification: `npm test` 1,668 passed; project venv pytest 2,383 passed,
16 skipped and 51 subtests; default contract 130 passed, 0 failed, one declared
contiguity skip. Browser/UI and release payloads are unchanged; no rendered
feature or biological performance is claimed.

Owned by **cyano-regulatory-sites**, 2026-10-15, in the isolated
`work/idog-feasibility-20261015` worktree. Complete the authorized new-locator
feasibility investigation: exact code gaps and necessity, source-pinned runtime
assessment, data requirements, and a concrete implementation/evaluation proposal.
No promoter predictions are admitted by this assessment.


Owner direction, 2026-10-14 (R1): the goal is **promoter-location prediction**,
not promoter design, and implementation is authorized. The owner explicitly
selected **investigate building a new locator around iDOG** after being told
that the inspected public code contains no locator. The previous personal-review
and execution hold is released. The absence finding is not reversed by this
permission: a new genomic-sequence-to-position/scoring component must be built
and evaluated, rather than presented as an existing iDOG capability.

The owner also asked which iDOG source is missing and whether that source is
necessary. Distinguish unavailable source for bytecode modules from the entirely
absent locator/model. The RBS Calculator's missing-code ticket remains separate.
Rough cross-organism exploratory assessment remains authorized by the earlier
2026-10-09 direction; no validated-UTEX claim follows from authorization.

Owner supplied [jayman1466/iDOG](https://github.com/jayman1466/iDOG), pinned at
commit `9d71187f0b2eb27ee681918927e12850470a0688` (2022-04-01, head of `master`),
**MIT licensed**. The name expands to **inter-Domain Operon Generator**. Record the
repository URL and that expansion in any literature search: the bare acronym also
names a canine genomics resource, `iDog` at CNCB/NGDC
(<https://ngdc.cncb.ac.cn/idog/>, PMID 39526388; first described in
PMID 30371881), so a sweep on "iDOG" alone returns dog genome results.

The strain in scope is *Synechococcus* sp. UTEX 2973, RefSeq assembly
`GCF_000817325.1` (taxid 1350461, Complete) — the assembly this repository pins.

A full-tree inventory at that commit (44 files; nine source modules and twelve
shipped only as bytecode) establishes what the tool does:

- **Promoter design exists.** `operon_design`, shipped as bytecode only, reads
  `yeast_elements/promoters.csv` and `yeast_elements/terminators.csv`, carries a
  hardcoded Bacteriophage T7 promoter (`TAATACGACTCACTATAGGG`) and T7 terminator,
  assembles these with generated RBSs and codon-optimized CDSs into an annotated
  GenBank record, and renders it through dnaplotlib promoter glyphs.
- **The promoter library is the substantive asset:** 48 promoters `YP1`-`YP48`,
  columns `Promoter_name`, `Strength`, `Sequence`, `Core`; strengths 49.94 to
  1080.93, a 21.6-fold span; nine `Core` values (0-8); lengths 161, 171, and
  181 nt; a `ccgcgcc` spacer and a `TATAAAAG` TATA box in 48 of 48. The 25
  terminators have no strength column.
- **It is a strength-annotated parts library with a combinatorial shuffle, not a
  fitted sequence-to-activity model.** No model object exists anywhere in the
  tree, and the bacterial case is a single fixed T7 sequence with no strength
  value.
- **Promoter-*location* prediction is absent.** No module takes genomic sequence
  and returns promoter positions. That is what CS-1 asks, and it is refuted; see
  the result block below.

**Design and location prediction are different problems with different labels,
and stay separate here.** This ticket's title and CS-1 are both about location
prediction; the owner confirmed that design is outside this goal. Predicting promoter
strength needs sequence-activity pairs; locating candidates needs a separate
positional evaluation. Tan 2018 supplies native UTEX TSS evidence across four
conditions, not complete promoter boundaries or a promoter-strength benchmark.
Its condition measurements are not independent loci for train/test splitting.

The former review hold and design interpretation are superseded by the owner's
2026-10-14 direction. CS-1's absent-capability verdict remains evidence for the
new-locator work, not grounds to claim a ready predictor. There is no model to
refit: `promoters.csv` is a lookup table, and its `Core` index and shared
`ccgcgcc`/`TATAAAAG` scaffold show the 48 rows sample a designed combinatorial
space rather than natural promoter diversity.

Reuse constraints already established at that commit:

- **No cyanobacterial codon table.** `codon_tables/` holds `escherichia_coli`,
  `bacillus_subtilis`, and `saccharomyces_cerevisiae` only, and `codon_opt.py:16`
  defaults to `escherichia_coli`.
- **The bundled TransTermHP is an x86-64 Linux ELF binary**, and the README states
  that arm64 requires recompiling from source. That constraint is shared with the
  fallback devices in
  [folding-compute-backend](O_folding-compute-backend__20260930.md).
- **The anti-Shine-Dalgarno parameter defaults to an *E. coli* value.**
  `create_RBS` takes an `rRNA_sequence` parameter defaulting to `"ACCUCCUUA"`, so
  an iDOG run at defaults does not predict UTEX 2973 initiation. The UTEX 2973
  value is derived inside this repository rather than requested from Claude
  Science: `tools/rrna_3prime.py`, documented in
  [annotation-release-readiness.md](../../validation/annotation-release-readiness.md#deriving-annotated-16s-rrna-3-termini),
  reports `ACCUCCUUU` at the annotated 3' end of both 16S copies,
  `M744_RS03180` and `M744_RS13280`, against the *E. coli* default `ACCUCCUUA`.
  The two differ only at the final base. That is the sequence at each annotated
  boundary, with no processing-site evidence behind it; it is not a validated
  anti-Shine-Dalgarno sequence, and it does not decide what sequence either tool
  should be given. The
  [RBS Calculator](O_rbs-calculator-gene-visualizer__20260930.md) defaults the
  same parameter the same way.

The requested outcome is a feasibility decision with evidence, followed by a
concrete gene-visualizer proposal only if the method is suitable. A finding that
iDOG cannot do the intended task is a valid finding about the capability, not a
reason to close the ticket. Do not turn this assessment into an unapproved
promoter-model development project. No iDOG code has been run, adapted, or
integrated here.

## Claude Science claims

| Id | Claim | Why the work depends on it | Answer that unblocks | Evidence expected | Pre-grounding | Status |
| --- | --- | --- | --- | --- | --- | --- |
| CS-1 | iDOG's implemented method supports promoter-location prediction in UTEX 2973 with evidence of applicability to that organism. | Adopting or describing iDOG output as promoter predictions in the gene visualizer. | Supported with an identified method and applicable validation; refuted or uncheckable redirects the feasibility decision without integrating predictions. | Pinned code functions, method documentation and resolvable validation sources; distinguish code capability from biological applicability. | A full-tree inventory at commit `9d71187` finds promoter *design* machinery and a 48-entry strength-annotated promoter library, but no module that returns promoter positions. | refuted 2026-09-30 |

Route external scientific applicability and validation evidence through
[Claude Science](../../validation/claude-science-handoff.md). The future model
assesses code and integration; an owner-returned scientific result and its intake
check remain necessary for the dependent step. No research dispatch is authorized
by opening this ticket.

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

**Intake check:** `claude-evidence-analyst (Multica DEM-193), 2026-10-02: repository at commit 9d71187 (2022-04-01), 44-file tree, nine source and twelve bytecode-only modules, MIT LICENSE, promoters.csv (48 rows, 49.94 to 1080.93, nine Core values, ccgcgcc and TATAAAAG in 48/48), 25 terminators without strengths, hardcoded T7 promoter, absence of any genomic-sequence-to-promoter-position function across the full tree including bytecode, and both PubMed queries returning zero all resolved; the statement that no publication describing the tool is indexed in PubMed did not resolve — PMID 35366417 (Patel JR et al., Cell 2022, PMC10619838) names github.com/jayman1466/iDOG as its code, PMID 40671632 cites the tool by name, and the quoted author query used initials JM where PubMed indexes Patel JR`

Intake found PMID 35366417 (Patel JR et al., *Cell* 2022, PMC10619838), which
names `github.com/jayman1466/iDOG` as its code and describes a 48-promoter
library; whether that paper validates anything about iDOG is not judged here.

## Missing source and the new locator

Checked 2026-10-14 by `cyano-regulatory-sites` against the complete pinned
[Git tree](https://github.com/jayman1466/iDOG/tree/9d71187f0b2eb27ee681918927e12850470a0688),
with read-only scout DEM-407. No bytecode was decompiled or executed in this check.

- Available Python source modules: `RNAfold_wrapper`, `codon_opt`, `create_RBS`, `dG_tot_calc`, `detailed_output`, `dnaplotlib`, `orf_recode`, `plot_operon`, `transterm_wrapper`.
- Bytecode-only modules without matching Python source: `config`, `countwords`, `create_RBS_web`, `create_RBS_webwrapper`, `hello`, `models`, `operon_design`, `refactor_pipeline`, `refactor_pipeline_web`, `web_codon_opt`, `web_create_RBS`, `web_operon_design`.
- In particular, `operon_design.py` is absent; the repository ships
  `__pycache__/operon_design.cpython-37.pyc`. Missing source impedes inspection,
  maintenance and portable reuse of that existing pipeline/web application.
- A separate native-sequence scanner and integration interface do not require
  those design/web modules. There is no identified promoter-location model to
  recover by obtaining their source: the earlier capability audit remains the
  basis for the absence finding. The public promoter CSV and fixed T7 insert
  are design assets, not a genomic-position scoring model.
- `create_RBS.py` and `dG_tot_calc.py` are present. The separate RBS Calculator
  v2.1.1 harness's private `DNAc` dependency is not an iDOG locator dependency.

The new work should define a strand-aware scanner/scorer with explicit native
intervals and score semantics, and an adapter for any useful iDOG components.
Choose and justify the scoring basis before implementation; parts lookup alone
cannot supply it. Evaluate on held-out loci with native genomic/background
controls and preserve source/model versions, parameters and coverage. Tan TSSs
and the existing promoter pilot support localization checks, not complete
promoter boundaries or a validated UTEX model. This is the authorized development
scope, not a claim that a new locator is already implemented.

Reproducible inventory: `git ls-tree -r --name-only` at the pinned commit, compare
root `.py` stems with `__pycache__/*.cpython-37.pyc` stems. Source receipts:
`README.md` SHA-256 `f38ab3f7e4b9f75627adb9dae8464f2dc46a19ef3d66690639fe4380042ad554`; `yeast_elements/promoters.csv` SHA-256 `0e75223494bc452ade4ceaba56f2fe8d15bd1b16e00be0386c64e9ddbe6336b8`.

## Dependencies and work

### Rough transfer route and limits

Use iDOG's RBS/terminator components only for the capabilities their actual
implementation supports. A bacterial model could score native UTEX sequence
under explicit host assumptions; conserved donor regions could supply additional
candidates under a checked local alignment. The yeast promoter library cannot
be re-labelled a cyanobacterial model, and a fixed T7 promoter does not locate
native promoters without the corresponding polymerase system. These are not
resolved by accepting low confidence. Obtaining the twelve bytecode-only modules'
source remains useful for inspection and portability, not proof of a missing
genomic promoter predictor.

Standalone TransTermHP has its own independent assessment. The
[shared transfer assessment](../../validation/regulatory-transfer.md)
records native UTEX scoring, PCC 7942 transcript-end evidence (Cascino 2026,
GSE309256) and UTEX reporter-part evidence (Gale 2021), with located primary-source
receipts S3/S4. Intrinsic terminator candidates cover only one termination
mechanism; donor transcript ends and reporter strengths are not native UTEX
termination coordinates or calibrated model confidence. RBS scoring retains its
[own code-access and host-input ticket](O_rbs-calculator-gene-visualizer__20260930.md).
No iDOG execution or new promoter-model development was performed by this
documentation update; the owner has now authorized investigation and implementation.

1. **Code feasibility:** Pin an iDOG commit; inspect relevant functions, input and
   output contracts, dependencies, runtime compatibility, and code/asset licences.
   Establish whether a promoter predictor actually exists, could be reused through
   a small supported adaptation, or is outside iDOG's purpose. A README omission
   alone is not proof of absence, and neither is an omission from a file listing:
   the 2026-09-30 return first missed the promoter library because its inventory
   was truncated at 40 of 44 entries. Clone and search the full tree, bytecode-only
   modules included, before concluding a capability is absent. Record code evidence
   for the verdict.
2. **Scientific applicability (CS-1):** Establish the method's intended organisms,
   training/validation basis, outputs, limitations, and applicability to UTEX 2973.
   Do not equate translation-initiation or terminator scores with promoter scores.
3. **Data readiness:** Inventory existing inputs and identify mandatory versus
   beneficial additions. Investigate strand-aware genomic flanks, gene starts and
   operon/transcription-unit context, experimentally supported TSS/promoter labels,
   suitable negative examples, condition metadata, and regulatory annotations.
   These are candidate needs to assess, not established requirements of iDOG.
   For each actual gap, state why it matters, source options, mapping requirements,
   whether sister-strain evidence is valid, and whether it gates feasibility or
   only improves performance.
4. **Evaluation:** If justified, specify and run a bounded benchmark after
   activation. Define suitable held-out data, leakage controls, baselines,
   localization tolerance, false-positive costs, and acceptance thresholds before
   evaluating. Report measured performance and coverage; do not invent thresholds
   or claim validated performance from a demonstration.
5. **Integration decision:** Recommend use, limited use, or rejection with reasons.
   If supported, propose gene-visualizer positions, strand, score/evidence labels,
   uncertainty and missing-data states, coordinate mapping, and compute location.
   Implementation requires an approved definition and passing applicable gates.

Related data work:
[consolidated BioCyc assessment](O_biocyc-ortholog-annotations__20261014.md)
may supply native and sister-strain annotations; [cross-strain data scan](O_cross-strain-data-scan__20260927.md)
may supply TSS and other suitable evidence. Depend on identified artifacts and
admission checks, not completion of whole tickets. Discovery and code assessment
can proceed without waiting for data collection once this ticket is activated.

The [regulatory-site recoding metric](O_recoding-regulatory-site-change__20260930.md)
may later consume explicitly exploratory predictions, but this ticket does not establish
regulatory function or recoding effects. Predicted sites must remain distinguishable
from measured sites; sister-strain coordinates never become UTEX coordinates.

## Clarifying questions for later

1. **Answered 2026-10-14:** find native promoter locations; investigate a new
   locator around iDOG. Promoter design is not the requested goal.
2. Is the initial target UTEX 2973 only, or should the method be assessed on sister
   strains too, with separate validity and evidence labels?
3. If iDOG supplies RBS/terminator tools but no suitable promoter predictor, should
   the ticket conclude with that finding or expand to a comparison of alternatives?
   **Answered 2026-10-14:** investigate building a new locator around iDOG.
   The former personal-review hold is released; do not silently substitute a
   different predictor and call its outputs iDOG predictions.
4. What data and annotation improvements should be prioritized if required inputs
   or credible evaluation labels are missing? Is experimental validation in scope?
5. What precision, recall, localization accuracy, and uncertainty would justify
   displaying predictions, and what false-positive rate is acceptable?
6. Should predictions be shown as a track, gene-detail annotation, optional score,
   or some combination? Should they update under the active recoding scheme?
7. When available, should Mythos 5.1 and Fable 5.1 both assess this, or should one
   implement the assessment and the other review it? Confirm provider and runtime.

## Acceptance criteria

- Deliver a code-grounded feasibility verdict, scientific evidence status, and
  explicit data-gap table separating mandatory and optional improvements.
- Identify the licence, runtime, coordinate, and evaluation constraints that
  affect reuse; preserve unsupported or unavailable findings explicitly.
- Supply an integration proposal only when supported, with prediction/evidence
  distinctions and tests for every proposed computational path.
- Resolve blocking owner questions before implementing or shipping predictions.

## Verification

Transfer-planning update checked by `cyano-regulatory-sites`, 2026-10-09:
open status, retained execution/closure hold, local links and source-receipt
references verified. Corrected the stale single-condition description of Tan
2018 against S9 (four conditions). Source evidence is preserved
in [the transfer contract](../../validation/regulatory-transfer.md#primary-source-evidence-receipts).
No iDOG code, prediction layer or UI changed.

Future work: reproducible pinned-code assessment and benchmark; then `npm test`,
`.venv/bin/python -m pytest -q`, and `.venv/bin/python tools/validate_contract.py`.
Gene-visualizer changes require the UI render/inspect/repair skill and real
mobile, tablet, and desktop renders, including uncertain and missing predictions.

## Cleanup

On resolution, rename the ticket/H1 to resolved and record final validation.
Distill reusable method, evidence, data-readiness, and validation contracts into
`docs/validation/`, update its index, then delete the resolved ticket and remove
its live queue and pending-claim entries. Do not retain task narration.
