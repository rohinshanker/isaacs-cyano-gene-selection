# R_rna-structure-comparison__20261014 — Resolved

- **Scope:** Local original-versus-recoded RNA secondary-structure comparison, split from D12 in the folding-compute-backend ticket.
- **Status:** resolved
- **Opened:** 2026-10-14
- **Updated:** 2026-10-14
- **Closing owner:** cyano-regulatory-sites, 2026-10-14.

## Outcome

The shortlist folding panel now compares retained/lost/gained predicted pairs,
base-pair distance, changed partner positions and nucleotide edits for both existing
windows. Expandable alignments and keyboard-readable partner lists preserve exact
window positions. Invalid results are unavailable, not zero. Progress retains
completed nodes and interaction state. Existing computation, model, privacy and
cache contracts are preserved. Remote services and larger workloads remain in the
open parent folding-compute-backend ticket; no other session's ticket is closed.

## Findings

- UI-1: resolved `add2bd1`; sticky labels stay intact when scrolling.
- R-1: resolved `0c9dca5`; progress retains open state, focus and scroll.
- R-2: resolved `0c9dca5`; completed result nodes are retained, avoiding repeated comparison/render work.
- R-3: resolved `0c9dca5`; gene-specific accessible names and keyboard-readable exact partner lists.
- R-4: resolved `0c9dca5`; external definition opens separately and preserves results.
- N-1: resolved `0c9dca5`; visible highlight/underline/marker legend.
- N-2: resolved `e48d5cb`; source says same-length pair tables should be used; strict equal-length validation is the local contract.
- R-5: resolved `2f6b25a`; opaque sticky-label padding covers the left edge at all scroll positions.
- N-3: resolved `2f6b25a`; partner accessible name contains the complete visible label.

No scoped finding remains open. DEM-420 independently accepted the exact code
commit `2f6b25ad0c409cc45f65c1c3896ec28bd5aabd97` after confirming all dispositions.

## Verification

- npm: 1,653 passed. Python: 2,311 passed, 14 skipped, 51 subtests passed.
  Contract validator: 130 passed, 0 failed, 1 declared spliced-CDS exemption.
- Native ViennaRNA 2.7.2 independently matches all 64 fixture windows; existing
  sequence/energy expectations are unchanged. The new comparison core has 100%
  line/branch/function coverage, and the full browser regression has no uncovered
  folding-panel source lines.
- Real app at ten widths: 375, 768, 959/960/961, 1239/1240/1241, 1280, 1440.
  Expanded/collapsed, identity/changed predictions, missing output, keyboard,
  partner lists, popup, progress retention, cache, cancellation/retry, partial
  failure, offline, unsupported and empty states passed. No unexpected diagnostics
  or page overflow. Screenshots and semantic snapshots inspected.
- Independent 79-gene lifecycle check preserves focus/open/scroll. Progressive
  300-result rendering fell from 1,570 ms to 18 ms in the reviewer's same-session
  probe. Every 1-pixel scroll offset at mobile/desktop passes edge coverage;
  restoring old CSS fails the regression. Module-preload and diff checks pass.
- Keyboard and Chromium accessibility-tree checks passed. No screen-reader
  session or automated axe scan; the repository does not install axe.

## Cleanup

Reusable computation, source receipt, native oracle, UI lifecycle and browser
validation contracts are in `docs/validation/rna-folding.md` and its index.
The parent records the remaining remote-compute scope. Remove this resolved file
last after committing this resolution and removing its live queue row.
