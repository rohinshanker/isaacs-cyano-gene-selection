# O_trna-identification-viewer__20260930 — Open

- **Scope:** Assess UTEX 2973 GtRNAdb/tRNAscan-SE evidence for identifying tRNA
  genes or candidate sequence regions; consider tRNA evidence filtering/coloring
  and viewer support, with a reusable approach for future sister-strain data or
  pinned local tRNAscan-SE runs.
- **Status:** open
- **Opened:** 2026-09-30
- **Updated:** 2026-10-07

## Current State

Owner sources:
[UTEX 2973 GtRNAdb page](https://gtrnadb.ucsc.edu/genomes/bacteria/Syne_UTEX_2973/)
and [tRNAscan-SE code](https://github.com/UCSC-LoweLab/tRNAscan-SE).
The GtRNAdb URL could not be read on 2026-09-30 because the agent's web tool was
refused the host — the refusal came from the tool, not from the server. The page is
reachable, and a Claude Science session read it the same day once the owner granted
`gtrnadb.ucsc.edu` to that session's allowlist. Its assembly, release, and
available artifacts are now determined; see the D1 result block below. **Its terms
are not:** no licence or terms statement appears on either GtRNAdb page or in its
download bundle, and the return quotes none, so admitting any GtRNAdb artifact
still waits on that question. The code README describes tRNA-gene prediction from
FASTA sequences; this is pre-grounding, not verification of score semantics or
biological function.

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

The strain in scope is *Synechococcus* sp. UTEX 2973, RefSeq assembly
`GCF_000817325.1` (taxid 1350461, Complete), which this repository pins; GtRNAdb
runs on its GenBank counterpart `GCA_000817325.1`. Both runs read 48 first-pass
candidates and confirm 45.

## Owner review scope, 2026-10-07

The owner requested a detailed first-version proposal whose only pending action
is their reading it. That proposal is ready in
[O_review-trna-viewer__20261007](O_review-trna-viewer__20261007.md): a separate
chromosome track, searchable locus list and inspection panel over the **44
RefSeq-annotated loci plus the one additional predicted pseudogene candidate**
already held in the pinned comparison. The candidate is explicitly distinguished
and excluded from the existing copy-count model.

The review has no scientific, access or compute dependency. After the owner
records that they have read it, implementation proceeds here against the reviewed
specification and its stated defaults. No new GtRNAdb artifact, tRNAscan-SE run,
probability label, confidence threshold, secondary-structure screen or tAI change
is required for this bounded version. The broader questions and CS-1 below apply
only to later additions; they do not hold this review or its first-version work.

## Claude Science claims

| Id | Claim | Why the work depends on it | Answer that unblocks | Evidence expected | Pre-grounding | Status |
| --- | --- | --- | --- | --- | --- | --- |
| CS-1 | A tRNAscan-SE score can be mapped to a calibrated probability of tRNA-gene identity in the evaluation population selected for this feature, now known to be the 45 Infernal-confirmed tRNA loci on this genome rather than an open-ended genome-wide screen. | A future numeric coloring/filtering option labelled “likelihood” or probability; not the bounded viewer or its owner review. | Supported with a validated calibration and its domain, or refuted/uncheckable so the proposed metric uses accurately labelled scores/categories instead. | Resolvable score definitions and applicable calibration/evaluation evidence, including target population and limitations. | Existing validation establishes computational plausibility and concordance, not calibrated probabilities, expression, or charging. | pending; future scoring option only |

Follow [Claude Science handoff](../../validation/claude-science-handoff.md) for
external source, licence, and scientific-semantic evidence. A new GtRNAdb artifact
requires a bounded research package and admission checks when selected. The
current claim is queued for later; no dispatch is authorized by opening this ticket.

## Dependencies and assessment

| Id | Prerequisite | Dependent step |
| --- | --- | --- |
| D1 | Existing run/annotation inventory and GtRNAdb identity/release comparison | Identify genuinely new evidence without repeating completed work |
| D2 | Owner reads the complete first-version proposal linked above; broader choices below are reserved for extensions | Implement the bounded existing-evidence viewer |
| D3 | Source/score semantics (CS-1 only for a future probability option), licences, and provenance | Approve future metric labels and admit new external artifacts; no new artifact is needed for the first version |
| D4 | Exact sequence/coordinate mapping for each admitted strain and release | Place or associate tRNA features correctly |
| D5 | Reviewed initial UI/data contract; no metric threshold in the first version. Any future metric/threshold needs its own evidence | Implement the bounded viewer, then assess separately requested extensions |

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
the [pinned gene's sequence close-up](../../validation/gene-sequence-closeup.md)
may inspect tRNA sequences if its feature population is extended. Coordinate
feature rendering
with [the shared marker representation](../../validation/data-contract.md#the-shared-marker-representation), while keeping
tRNA genes distinct from regulatory sites. No whole-ticket dependency is imposed.

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

**Intake check:** `claude-evidence-analyst (Multica DEM-193), 2026-10-02: both GtRNAdb pages, tRNAscan-SE v2.0.2 run of 2019-04-23 in bacterial Infernal mode, assembly GCA_000817325.1 (identical to the pinned GCF_000817325.1 per the NCBI assembly report), every statistic and the full anticodon table against data/trna/independent_run/trnascan.stats, and all 45 loci against trnascan.out resolved; the statement that GtRNAdb holds the identity of the three dropped first-pass candidates did not resolve — GtRNAdb publishes only the count 48, which the repository’s own trnascan.stats also records`

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
   Q3, raised by the 2026-09-30 return; unanswered: "Are those three dropped
   candidates and the HMM/2'-structure score breakdown worth retrieving, or is the
   real want the viewer feature over the 45 loci you already have?" Intake found the
   premise about the three candidates does not hold: GtRNAdb publishes only the
   count 48, which this repository's own `trnascan.stats` already records, and
   nothing in its pages or bundle enumerates the three.
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

Documentation update verified 2026-10-07: the 32-ticket filename/H1/status,
main-queue membership and local-link checks passed; `git diff --check` was clean.
Required gates on the isolated docs worktree: `npm test` 1,116 passed;
`.venv/bin/python -m pytest -q` 494 passed, 1 skipped, 36 subtests;
`.venv/bin/python tools/validate_contract.py` 116 passed, 0 failed, 1 declared
skip. This pass changed no application code, release data or browser UI;
implementation-specific validation remains separate.

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

## Owner approval, 2026-10-08

The bounded first version specified in O_review-trna-viewer__20261007 is approved
after its summary was presented in the UI-closeout session. Use 44 annotated loci
plus the one separately flagged predicted pseudogene candidate, hidden by default;
independent selection, a separate searchable chromosome track/list and detail with
genomic sequence and source/scan fields. Preserve tAI/CDS populations and all
evidence limits. CS-1 is not a prerequisite for this bounded version.

## Approved bounded specification

## What the viewer is for

The site currently plots protein-coding genes. A tRNA is a noncoding RNA locus
with its own identity and genome position; assigning it to the nearest
protein-coding gene would obscure what the evidence describes. The viewer would
let a reader locate and inspect the tRNA loci underlying the existing genomic
copy-count model, without changing the protein-gene map or its metrics.

The existing inventory is **44 RefSeq-annotated loci**, each concordant with the
pinned local tRNAscan-SE run, plus **one additional predicted pseudogene
candidate**. The 45 entries must not be presented as 45 functional tRNAs.

## First-version interaction

1. **Find loci.** An opened "tRNA loci" section in the Chromosome view lists the
   44 annotated loci and reports the additional candidate separately. Search by
   locus identifier, amino-acid/isotype label or genomic anticodon. Filter the
   list by those recorded fields or strand. The candidate has its own explicit
   show/hide control and is hidden by default; the header still states that it
   exists. No numeric confidence cutoff is needed.
2. **See their positions.** A separately labelled tRNA track uses the existing
   chromosome/replicon coordinate scale and strand conventions. Its visibility
   control affects only this track. Annotated loci and the predicted candidate
   use distinct shapes as well as labels. Where markers share screen pixels,
   a count and an inspectable list keep every locus reachable; zooming reveals
   their individual positions.
3. **Inspect one entry.** Selecting a list row or marker opens a tRNA detail
   panel and can centre its chromosome location. Selection is independent of
   the protein-coding gene pin and shortlist. The panel shows identifier where
   one exists, replicon, native start/end, strand, length, RefSeq product and
   genomic anticodon, the local scan's isotype/anticodon, annotation-versus-scan
   status, and links to the pinned evidence. It preserves the source's labels
   instead of silently collapsing `Ile2`/`fMet` naming into another source's
   wording.
4. **Inspect sequence.** Show the genomic locus sequence in transcription
   orientation using the existing genome extraction conventions. For an
   annotated locus, show the genomic and model-effective anticodon separately
   where the current tAI convention distinguishes them. This is a genomic
   sequence, not a measured mature or modified tRNA sequence. Protein-codon
   recoding controls do not apply to this noncoding locus.
5. **Read the candidate honestly.** The extra call has no RefSeq locus tag.
   Give it a stable identity derived from the pinned run and genomic location,
   not an invented RefSeq identifier. At
   `NZ_CP006471.1:2275064-2275124` on the plus strand, it is flagged `pseudo`
   with isotype `Undet` and anticodon `NNN`. Display those as undetermined, not
   as an amino acid or known decoding assignment. It is excluded from the
   existing 44-locus copy-count model.
6. **Use it accessibly.** All controls, rows and markers work by keyboard,
   pointer and touch. Selected/focused entries remain visible after filtering
   and resizing. Loading, failure with retry, an empty filtered list and an
   organism without this layer each have a truthful state.

## Evidence and limits

Use `data/trna/independent_run/comparison.json`, `comparison.tsv`,
`trnascan.out`, the existing input manifest and pinned genome/GFF. The comparison
holds coordinates, strand, locus identifiers for the 44 annotated entries,
anticodons, scan labels and pseudogene flags; its extra-call record holds the
candidate. [trna-annotation-validation.md](../../validation/trna-annotation-validation.md)
records the exact run and computational-evidence boundary.

The initial detail panel does not turn the recorded scan score into a probability
or biological confidence scale. Predicted secondary-structure drawings and 3D
folding are outside this version; the existing structure output has not undergone
an independent arm-level completeness screen. A GtRNAdb pull, new scan, scoring
metric, E. coli comparison or sister-strain layer is not a prerequisite.

The viewer establishes where these annotation/prediction records sit and what
they say. It does not establish mature expression, charging or decoding activity.
Current tAI values, copy counts, amino-acid exclusions and recoding calculations
stay under their existing validated contracts.

## Implementation contract after review

Publish a compact per-organism tRNA layer with the input/run identity, assembly,
stable feature IDs and coordinate/evidence fields. Keep it separate from the CDS
`genes.json` population and budget. Reuse the existing loader, manifest/digest,
chromosome rendering and detail-panel patterns. Parse the validated comparison;
do not rerun tRNAscan-SE or invent nearest-gene joins.

Initial coverage is UTEX 2973 only. For other organisms, state that this viewer
layer is unavailable until an explicitly validated layer is configured. Full
test coverage must pin all 44 concordant records, the additional candidate,
identity/order/coordinate integrity, both strands, overlaps, missing values,
loading/failure/retry, filtering and selection isolation. Render the real app at
375, 768, 1280 and 1440 px and test keyboard/touch interactions before completion.


Implementation is active in DEM-320 under cyano-source-ingestion; the viewer is not yet reported complete.
