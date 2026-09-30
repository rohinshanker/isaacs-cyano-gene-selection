# O_trna-identification-viewer__20260930 — Open

- **Scope:** Assess UTEX 2973 GtRNAdb/tRNAscan-SE evidence for identifying tRNA
  genes or candidate sequence regions; consider tRNA evidence filtering/coloring
  and viewer support, with a reusable approach for future sister-strain data or
  pinned local tRNAscan-SE runs.
- **Status:** open
- **Opened:** 2026-09-30
- **Updated:** 2026-09-30

## Current State

Owner sources:
[UTEX 2973 GtRNAdb page](https://gtrnadb.ucsc.edu/genomes/bacteria/Syne_UTEX_2973/)
and [tRNAscan-SE code](https://github.com/UCSC-LoweLab/tRNAscan-SE).
The GtRNAdb URL could not be read through the web tool on 2026-09-30; its assembly,
release, available artifacts, and terms remain unverified. The code README
describes tRNA-gene prediction from FASTA sequences; this is pre-grounding, not
verification of score semantics or biological function.

**Duplicate check, 2026-09-30:** Searched the canonical project ticket queue,
ISAACS-LAB site/pipeline worktree ticket directories, and workspace ticket queue
for tRNA, tRNAscan-SE, and GtRNAdb work. No equivalent open ticket for tRNA
identification filtering/coloring was found. Older worktree annotation-readiness
tickets mention the tRNA table but do not specify this feature.

Related work is already completed and must be reused:
[trna-annotation-validation.md](../../validation/trna-annotation-validation.md)
records prior validation (DEM-61), with a pinned tRNAscan-SE 2.0.12 bacterial-mode
run on `GCF_000817325.1`, concordance for 44 RefSeq tRNA loci, and one additional
low-confidence pseudogene candidate. Outputs are in `data/trna/independent_run/`
and comparison code/tests in `tools/trna_validate.py` and
`tests/test_trna_validate.py`. This new ticket does not recreate that validation
or reopen its settled lab decisions. No new scan, data admission, or UI work has
started.

## Claude Science claims

| Id | Claim | Why the work depends on it | Answer that unblocks | Evidence expected | Pre-grounding | Status |
| --- | --- | --- | --- | --- | --- | --- |
| CS-1 | A tRNAscan-SE score can be mapped to a calibrated probability of tRNA-gene identity in the evaluation population selected for this feature. | Labelling numeric coloring/filtering as “likelihood” or probability rather than a tool score or evidence category. | Supported with a validated calibration and its domain, or refuted/uncheckable so the proposed metric uses accurately labelled scores/categories instead. | Resolvable score definitions and applicable calibration/evaluation evidence, including target population and limitations. | Existing validation establishes computational plausibility and concordance, not calibrated probabilities, expression, or charging. | pending |

Follow [Claude Science handoff](../../validation/claude-science-handoff.md) for
external source, licence, and scientific-semantic evidence. A new GtRNAdb artifact
requires a bounded research package and admission checks when selected. The
current claim is queued for later; no dispatch is authorized by opening this ticket.

## Dependencies and assessment

| Id | Prerequisite | Dependent step |
| --- | --- | --- |
| D1 | Existing run/annotation inventory and GtRNAdb identity/release comparison | Identify genuinely new evidence without repeating completed work |
| D2 | Owner decisions on feature population and display below | Define data schema and filtering/coloring target |
| D3 | Source/score semantics (CS-1 if probability is intended), licences, and provenance | Approve metric labels and admit selected external artifacts |
| D4 | Exact sequence/coordinate mapping for each admitted strain and release | Place or associate tRNA features correctly |
| D5 | Approved metric, thresholds, and UI contracts | Implement filtering/coloring and visualization |

Assess annotated tRNA genes, additional predicted loci, low-confidence or
pseudogene calls, and any overlaps with plotted CDSs as distinct states. Decide
whether “gene” includes noncoding tRNA loci or means a predicted interval inside
an existing CDS. The current CDS population must not gain arbitrary tRNA scores
through nearest-gene joins, and absence of a scan is not a negative result.

Inventory available identity/isotype, anticodon, coordinate/strand, sequence,
structure, score, and flags, preserving their documented meanings. Compare
GtRNAdb to the pinned assembly and existing results before selecting additions.
For local scans, pin software, models, settings, input hashes, and outputs; rerun
only for a concrete new scope, changed version/input, or reproducibility need.

Reuse the existing computational-plausibility boundary: predicted/annotated tRNA
does not establish mature expression, charging, or decoding activity. Preserve
current tAI and genomic copy counts; conflicting calls are sensitivity scenarios
pending review, not automatic updates to tAI.

Future sister-strain assessment should reuse the source inventory and run contract,
but verify each genome and mapping independently. Sister-strain genomic positions
must not be placed on the UTEX chromosome axis. Record unavailable database pages,
ambiguous mappings, and unsupported data types explicitly.

Related: [cross-strain scan](O_cross-strain-data-scan__20260927.md) and
[BioCyc assessment](O_biocyc-utex-2973-data__20260930.md) may supply annotations;
[pinned sequence viewer](O_pinned-gene-sequence-viewer__20260930.md) may inspect
tRNA sequences if its feature population is extended. Coordinate feature rendering
with [viewer layers](O_regulatory-site-viewer-layers__20260930.md), while keeping
tRNA genes distinct from regulatory sites. No whole-ticket dependency is imposed.

## Clarifying questions for later

1. Should the feature show the already annotated tRNA loci, discover additional
   candidates genome-wide, score user-selected sequences, inspect CDS overlaps,
   or combine these uses?
2. Should tRNA genes become a separate chromosome/search feature class, or should
   coloring/filtering apply to the existing protein-coding gene population?
3. Does “how likely” mean tool detection score, confidence/evidence category,
   pseudogene status, or a calibrated probability? What thresholds are useful?
4. Should GtRNAdb supply a separate comparison layer or reconcile the existing
   pinned run? How should disagreements and low-confidence calls appear?
5. Which sister strains should be considered next, and should their data remain
   separate evidence layers rather than being transferred to native UTEX features?
6. Should tRNA structure, anticodon, and isotype be displayed alongside sequence,
   and should tRNA loci be pinnable in the gene visualizer?
7. Are scans precomputed during data builds or requested interactively? If a backend
   is needed, assess that separately instead of assuming browser compatibility.

## Acceptance criteria

- Reuse completed validation; document what GtRNAdb or a new scan actually adds.
- Define the feature population, join/coordinate rules, metric meaning, thresholds,
  and missing/uncertain/pseudogene states before implementation.
- Any likelihood label is scientifically supported; otherwise use an accurately
  named score/category with its limitations explicitly stated.
- Preserve existing tAI and settled lab decisions; proposed changes require
  separate evidence and owner decisions.
- Future implementation tests cover all added paths and malformed, missing,
  conflicting, both-strand, overlapping, and unmatched features.

## Verification

Ticket creation verified 2026-09-30: duplicate-check findings, fields, dependency
links, live index entry, and CS-1 queue row checked; `git diff --check` passed.
Repository gates passed: `npm test` (659 tests), pytest (332 passed, 1 skipped,
24 subtests passed), and contract validation (96 passed, 0 failed, 1 declared
skip). No new prediction, source intake, or rendered behavior was validated here.

Future implementation: source/assembly/hash checks and independent mapping/score
fixtures; `npm test`, `.venv/bin/python -m pytest -q`, and
`.venv/bin/python tools/validate_contract.py`. Use the UI render/inspect/repair
skill for actual mobile, tablet, and desktop views of filtering/coloring, tRNA
inspection, uncertainty, and missing-data states.

## Cleanup

On resolution, rename the ticket/H1 to resolved and record final validation.
Distill reusable tRNA feature, source, score, and viewer contracts into
`docs/validation/`, update its index, then delete the resolved ticket and remove
its live queue and pending-claim entries. Do not retain task histories.
