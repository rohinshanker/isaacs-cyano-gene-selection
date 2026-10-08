# O_review-trna-viewer__20261007 — Open

- **Scope:** Owner-readable specification of the first UTEX 2973 tRNA viewer,
  using the existing pinned annotation and tRNAscan-SE comparison. This ticket
  prepares the review; the linked implementation ticket owns code and UI work.
- **Status:** open
- **Opened:** 2026-10-07
- **Updated:** 2026-10-08

## Current State

The owner approved the bounded first version on 2026-10-08 after its complete
in-chat summary. The specification transfers to the implementation ticket; this
review ticket is ready for its documented closure lifecycle. No source
download, new scan, Claude Science answer, compute host, probability calibration
or additional biological decision is needed for this bounded version.

The owner requested this ticket on 2026-10-07: "open a ticket for this explaining
what the tRNA viewer would do in detail that is only blocked by me reading it".
This does not record the proposal as already reviewed or implemented.

After review, implementation continues in
[O_trna-identification-viewer__20260930](O_trna-identification-viewer__20260930.md).
That ticket's broader research options are separate from this first version.

## Owner approval

Approved 2026-10-08 in this session after the full bounded summary was presented: 44 annotated loci plus the separately labelled, initially hidden pseudogene candidate; searchable separate track/list/detail and genomic sequence; independent selection; current tAI/CDS models unchanged; no probability or mature/structure claim. Transfer the specification to O_trna-identification-viewer__20260930 for implementation.

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

## Verification

Documentation update verified 2026-10-07: the 32-ticket filename/H1/status,
main-queue membership and local-link checks passed; `git diff --check` was clean.
Required gates on the isolated docs worktree: `npm test` 1,116 passed;
`.venv/bin/python -m pytest -q` 494 passed, 1 skipped, 36 subtests;
`.venv/bin/python tools/validate_contract.py` 116 passed, 0 failed, 1 declared
skip. This pass changed no application code, release data or browser UI;
implementation-specific validation remains separate.

Preparation checked `comparison.json`: 44 concordant, 0 discordant, 0 unresolved,
1 scan-only candidate; the candidate's fields match the location and flags above.
The existing validation document and loader contracts were read. No viewer behavior has been implemented or rendered.

## Cleanup

Record the owner's review here and transfer the reviewed specification and any
edits to the implementation ticket. Resolve with the normal R-rename and dated
verification, then delete this review ticket and remove its queue row. Distil
the final implemented tRNA-layer/UI contract into `docs/validation/` only when
the implementation and its validation are complete.
