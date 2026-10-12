# O_overlap-length-filter-color__20261012 — Open

Scope: Add gene filtering and colouring by 5′ and 3′ overlap length in base pairs.
Status: open
Opened: 2026-10-12
Updated: 2026-10-12

## Current State

Requested by the owner. The existing overlapping-gene (OG) layer supplies shared
intervals and categorical overlap controls; this ticket adds numerical,
end-specific controls. Implementation is unclaimed.

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
