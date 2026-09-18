# O_guided-gene-panel-design__20260918 — Open

- **Scope**: Deterministic generation of a diverse 6–10-gene experimental panel across recoding schemes.
- **Status**: open
- **Opened**: 2026-09-18
- **Updated**: 2026-09-18
- **Priority**: P1 feature — this is the shortest path from the viewer to a defensible fitness experiment.

## Current State

The viewer can filter, inspect, search, and manually shortlist genes, but it cannot
answer the experimental-design question: which 6–10 genes provide the most
informative spread of baseline properties and scheme-induced perturbations subject
to lab constraints? It also compares genes under only one active scheme at a time.

“Different in every metric” is not generally achievable because metrics are
correlated and some requirements conflict. Picking the farthest points in raw
units would over-weight long-scale or redundant fields and could select genes that
are diverse for only one unimportant reason.

## Proposed Resolution

Add a **Design a panel** workflow with:

1. A target size from 6 to 10, an optional seed set that must remain, selected
   recoding schemes, and explicit include/exclude lists.
2. Hard constraints such as minimum CAI/tAI or expression, measured-expression
   requirement, length/burden ranges, chromosome/plasmid, and default exclusion
   of translational exceptions or overlapping/ambiguous loci. Borrowed PCC 7942
   expression must remain opt-in and visibly labelled.
3. A curated, non-redundant feature set spanning baseline translation, structure,
   context, edit burden, local clustering, and per-scheme deltas. Robust percentile
   scaling and an explicit missing-data policy prevent units and unknowns from
   controlling the result.
4. A deterministic constrained space-filling objective: maximin distance for
   broad coverage, optionally combined with ridge-stabilized D-optimality for
   parameter identifiability. Seed genes initialize the design; greedy additions
   maximize the documented objective with stable tie-breaking.
5. A result explanation for every added gene: nearest selected neighbor, the
   metric ranges/quantile bins it expands, constraints it satisfies, and any
   caveat. Show coverage before/after and let the user lock, remove, or regenerate.
6. A gene×scheme matrix and export through the versioned research manifest. Do not
   call the output a fitness prediction until measured outcomes are supplied and a
   model is validated.

This is ordinary deterministic filtering and optimization, not a semantic LLM
judgment. Functional-category enrichment can be added once the evidence-backed
annotations in `O_data-annotation-release-readiness__20260918.md` exist.

## Verification

- Synthetic fixtures with a known optimum verify anchors, hard constraints,
  scaling invariance, deterministic tie-breaking, missing values, and correlated
  metrics.
- The selected panel is stable under display-unit changes and reports why every
  gene was chosen.
- A real-data golden case expands a supplied seed set to exactly 10 genes and
  demonstrates broader selected-feature coverage than random and naive farthest-
  point baselines without violating constraints.
- Render and inspect configuration, progress, infeasible-constraint, result,
  manual-edit, and multi-scheme states at all required viewports.
- The exported design round-trips with exact genes, schemes, constraints,
  objective settings, dataset identity, and metric values.

## Cleanup

When resolved, document the optimization objective, default feature set, missing-
data policy, golden validation case, and export contract in `docs/validation/`,
update its index, and remove this ticket and its index row.
