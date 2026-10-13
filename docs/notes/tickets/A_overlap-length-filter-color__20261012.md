# A_overlap-length-filter-color__20261012 — Active

Scope: Add gene filtering and colouring by 5′ and 3′ overlap length in base pairs.
Status: active
Opened: 2026-10-12
Updated: 2026-10-12

## Current State

Requested by the owner. The existing overlapping-gene (OG) layer supplies shared
intervals and categorical overlap controls; this ticket adds numerical,
end-specific controls. Owner: cyano-regulatory-sites (Agent Deck
`e6e54b6e-1791581192`). Work is isolated on
`work/overlap-length-20261012` in
`/Users/Rohin/Desktop/coding_stuff/ISAACS-LAB/worktrees/overlap-length-20261012`.
Baseline: `b6a6604b940f5efad7bfdea97a5fd0b8656d8745`. Preserve the separate
Tan condition-selection session and its branch; merge its completed changes
before final integration when available. Do not edit another session's worktree,
restart its servers, or contact/interrupt its active run.

## Implementation contract

Coordinator: cyano-regulatory-sites. Implementer: Multica DEM-385, isolated in
`work/overlap-length-impl-20261012` from `ffbfa0b`; coordinator integrates and
closes the ticket. No other session or worktree is to be interrupted.

Count the union of shared bases continuously inward from each transcriptional
end, stopping at the first uncovered base or real inter-segment gap. Crossing
the circular origin is continuous. Internal-only overlaps contribute zero;
multiple partners never double-count within an end. A fully covered continuous
gene contributes its length to each end, so the requested sum can be twice its
length. Unknown strand or unsupported origin-piece ordering stays unavailable.

Coordinator verification includes an independent per-base oracle over 3,000
seeded small genomes, followed by exact-patch review and rendered checks.
The initial pure metric agrees with the independent oracle and all 21,952
shipped gene records across six organisms. Final integrated checks remain
pending; no feature has shipped yet.

### Findings

- **OL1 — fixed in `6685917`, independent review pending:** derive applier lengths from the validated dataset
  `index.replicons`, not the global shipped-organism lookup. A valid custom
  replicon must produce values and survive removal/reapplication correctly.
  The applier now reads validated dataset lengths; custom-replicon removal
  and reapplication tests pass. Pure metric arithmetic is unaffected.

## Requested behaviour

- **Filters:** an overlap-length control lets the user choose either **5′** or
  **3′**, then enter a **minimum** and **maximum** length in **bp** for that end.
  Bounds are inclusive; an empty bound is unrestricted. Clearing the control
  removes this constraint. Reject negative, fractional or reversed bounds with
  a clear inline explanation.
- **Color by:** add three numerical options: **5′ overlap length**, **3′ overlap
  length**, and **5′ + 3′ overlap length**. The third is the arithmetic sum of the
  two end-specific values. Legends identify the selected quantity and bp units.
- Compose the numerical filter with existing filters and keep the selected
  colour metric independent of the chosen filter end. Follow existing reset,
  saved-state/share-link, and organism-switch conventions.

## Acceptance criteria

- Interpret 5′ and 3′ relative to the focal gene's annotated strand, including
  reverse-strand and circular-origin cases; genomic left/right is insufficient.
- Derive values from the existing native OG shared intervals and feature
  geometry. Preserve its partner coverage, including annotated noncoding and
  unplotted partners. Hiding a partner must not change the values.
- Specify and test the counting rule for overlaps touching each end, wholly
  internal/nested overlaps, multiple partners, split features and a partner
  covering both ends. Count repeated shared bases only once within an end's
  metric, and explain any bases contributing to both terms of the requested sum.
- Known absence of overlap is **0 bp**. Missing overlap data or indeterminate
  end orientation remains unavailable, never silently zero. Preserve existing
  suspended-filter and neutral-colour behaviour when required data are missing.
- Reuse a single derived metric contract for filtering, colouring, displayed
  values and persisted selections; preserve the existing categorical OG controls.

Relevant contracts: [overlapping genes](../../validation/gene-overlaps.md) and
[native neighbouring genes](../../validation/gene-neighbours.md).

## Verification

Before implementation closes: test exact min/max boundaries, one-sided ranges,
zero and unavailable values, invalid input, both strands, one-base overlaps,
multiple/contained partners, split and origin-wrapping genes, arithmetic sums,
filter composition, hidden-partner invariance and saved-state restoration.
Render the actual controls and colour legends at mobile, tablet and desktop
widths, including keyboard interaction and organism switching. Run all required
repository gates and record the results in this ticket.

## Cleanup

Remain open until claimed and implemented. The owning implementation session
must record outstanding findings and final validation, distil the reusable metric
and UI contracts into docs/validation, then resolve and remove this ticket and
its queue row under the repository's closure rules.
