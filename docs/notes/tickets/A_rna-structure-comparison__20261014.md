# A_rna-structure-comparison__20261014 — Active

- **Scope:** Local original-versus-recoded RNA secondary-structure comparison, split from D12 in the folding-compute-backend ticket.
- **Status:** active
- **Opened:** 2026-10-14
- **Updated:** 2026-10-14
- **Owner:** cyano-regulatory-sites

## Current State

Implement a bounded comparison of the existing ViennaRNA MFE structures for the
90-nt genomic start window and first 100 CDS nt. Show retained/lost/gained predicted
base pairs, their symmetric-difference distance, and positions whose pairing partner
changes. Expandable sequence/dot-bracket details distinguish nucleotide edits from
pairing changes. Preserve current folding settings, exact sequences, caching,
cancellation and stale-result behavior. Invalid/missing results are unavailable,
never zero. These are model comparisons, not measured structures, accessibility
probabilities, expression effects or biological harm scores.

Worktree: `work/rna-structure-comparison-20261014`, baseline `2ebc5dd`.
Separate from the active annotation-search work; do not interrupt other sessions.
The parent ticket retains remote-compute access/service decisions and larger workloads.

## Findings

- UI-1 — open: initial expanded alignment screenshots clipped the row labels
  after horizontal keyboard scroll. The implementer is checking the sticky-label
  fix and must replace the evidence with renders from the final patch.

## Verification

Pending focused core/UI tests, real-worker browser inspection at mobile/tablet/
desktop/wide and layout breakpoints, independent patch review, and repository gates.

## Cleanup

Owner closes only after all findings have a disposition. Preserve comparison and
validation contracts in `docs/validation/rna-folding.md`, resolve/rename this ticket,
remove its index row, then delete it last. Keep the parent folding ticket open.
