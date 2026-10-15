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

- UI-1 — resolved by `add2bd1` (worker `5fdcae9`): sticky row labels stay
  fully visible after horizontal keyboard scrolling. Final rendered bounds checks
  and inspected mobile/tablet/desktop/wide screenshots confirm the repair.

- R-1 — open: review found that another gene completing a fold rebuilds the
  earlier result, collapsing expanded details and losing keyboard focus/scroll.
  Original implementer DEM-419 owns the progress-preservation repair; review
  DEM-420 will confirm its exact fix commit.

- R-2 — open: repeated progress rebuilds add avoidable rendering cost. The same
  retained-node repair addresses this finding.
- R-3 — open: comparison accessible names need gene identity, and exact partner
  information needs a keyboard-readable alternative to hover titles.
- R-4 — open: the new definition link navigates away and loses in-tab results;
  open it in a separate tab, matching the existing external handoff.
- N-1 — open: explain highlighting and underlining in the displayed legend.
- N-2 — open: correct the definition receipt's paraphrase of upstream's
  same-length recommendation; the local equal-length validation remains strict.

- R-5 — open: characters could bleed into the left padding beside sticky row
  labels while horizontally scrolling. Move that padding onto the opaque sticky
  labels and test hit coverage at the left edge across scroll offsets.
- N-3 — open: the partner disclosure's accessible name must contain its complete
  visible label. Retain the gene/window identity after that label.

## Verification

Implementation `add2bd1`, native oracles `039176e`, preload `1ba4ba5`.
21 focused tests pass; comparison core has 100% line/branch/function coverage.
Native ViennaRNA 2.7.2 independently matches all counts and changed positions in
64 windows; committed WASM test checks exact native structures and pair distances.
Existing sequence and energy expectations are unchanged.

Required gates: npm 1,652 passed; Python 2,311 passed, 14 skipped, 51 subtests;
contract 130 passed, 0 failed, 1 declared spliced-CDS exemption. Module preloads
match the graph. The integration UI comparison passes ten widths (375, 768,
959/960/961, 1239/1240/1241, 1280, 1440), real-worker changed and identity results,
expanded/collapsed, keyboard and far scrolling, missing/invalid results, and input
invalidation. No unexpected browser diagnostics or page overflow. Semantic and
visual inspection completed; no screenshot baselines or dependencies added.
Repository-local axe is absent; keyboard/focus/semantic checks were performed.

The worker and final integration broader browser regressions passed cancellation, retry, cache, partial
failure, offline/unsupported/empty and stale-result cases with full folding-panel
source coverage, 32 exact worker-parity cases and ten cache hits. DEM-420
independent review remains pending. Reusable contracts are in `docs/validation/rna-folding.md`.

## Cleanup

Owner closes only after all findings have a disposition. Preserve comparison and
validation contracts in `docs/validation/rna-folding.md`, resolve/rename this ticket,
remove its index row, then delete it last. Keep the parent folding ticket open.
