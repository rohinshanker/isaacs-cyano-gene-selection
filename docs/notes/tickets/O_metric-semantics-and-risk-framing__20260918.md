# O_metric-semantics-and-risk-framing__20260918 — Open

- **Scope**: Scientific meaning, directionality, provenance wording, and displayed burden conventions.
- **Status**: open
- **Opened**: 2026-09-18
- **Updated**: 2026-09-18
- **Priority**: P0 — candidate choice is unsafe when labels imply meaning the data does not carry.

## Current State

Verified on viewer commit `fd0e42981ba4347189e27faf25e1e8f3aee42524`.

- All 33 pipeline metric descriptions in `site/data/meta.json` equal their short
  labels. The detail panel consequently describes ENC as “ENC”, CPS as
  “Codon-pair score”, and so on, without definition, direction, window, or caveat.
- Delta cells color every positive value green and every negative value red.
  That is defensible for ΔCAI/ΔtAI under the documented interpretation, but it
  falsely implies that higher GC3 or ENC is universally beneficial and lower is
  universally harmful.
- The optional PCC 7942 expression overlay is from another strain of the same
  species, but the page repeatedly calls it “a different organism”. The strong
  caveat is correct; the taxonomic wording is not.
- The scheme picker reports raw genome occurrences for sense codons even though
  position zero is never recoded. For example it shows 18,659 GTG occurrences,
  while 356 are initiation codons and only 18,303 are editable; TTG is similarly
  20,427 total versus 20,324 editable.
- “Recoding-risk space” is an unsupervised PCA over risk-related features, not a
  calibrated risk or fitness model. The name and copy need to keep that boundary
  explicit until experimental outcomes exist.

## Proposed Resolution

- Extend each metric definition with a full plain-language definition, formula or
  window, source, missing-value policy, interpretation, and directionality
  (`higher_better`, `lower_better`, `target_range`, or `neutral/contextual`).
- Drive delta colour and benefit/harm language from that metadata. Neutral signs
  should use neutral diverging styling and print only direction of change.
- Correct strain/species wording at the provenance helper so every consumer gets
  the same text.
- Publish total and editable codon occurrence counts separately; picker burden
  copy must use the same position-zero convention as the live scan.
- Rename the unsupervised view to “recoding-feature space” or label it prominently
  as similarity, not predicted fitness.
- Harden the contract validator so label-only descriptions and inconsistent
  directionality metadata fail the build.

## Verification

- Every metric has a substantive definition and tested display direction.
- Known examples establish that ΔCAI/ΔtAI warnings and neutral GC3/ENC changes are
  not conflated.
- PCC 7942 is consistently described as another strain, with the existing
  condition and provenance caveats intact.
- Displayed editable counts equal a direct scan that excludes position zero.
- No unsupervised projection is presented as a validated fitness prediction.

## Cleanup

When resolved, freeze the metric-semantics schema and examples in
`docs/validation/`, update its index, and remove this ticket and its index row.
