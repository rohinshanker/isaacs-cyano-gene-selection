# A_gene-diversity-site__20260918 — Active

- **Scope**: UTEX 2973 feature pipeline and interactive gene-diversity site.
- **Status**: active
- **Opened**: 2026-09-18
- **Updated**: 2026-09-19

## Current State

The local application is complete and integrated. It contains the release-pinned
2,715-gene dataset; exact browser/pipeline metric parity; manifest-selected PCC
7942 expression plus native UTEX TSS evidence; map/search/filter/detail and
comparison workflows; reproducible shortlist export; live versioned URL state;
keyboard/touch map controls; a deterministic guided 6–10-gene panel designer;
and exact on-demand ViennaRNA folding for recoded shortlisted genes.
The gene detail also exposes a compact, collapsed release-evidence view for
annotation method, replicon, overlaps, nearby non-coding RNA, and evidence-coded
GO relationships without enlarging the default workspace.

The desktop workspace keeps map, comparison, the compact panel entry point,
shortlist, and provenance together in the center column. Detail is bounded and
sticky on wide screens and follows logical source order on narrow screens.
Tutorials explain maps, sharing, scheme semantics, panel selection, shortlist
flow, and RNA folding without expanding the default page.

The final audit also keeps in-page map navigation from erasing shared URL state,
clears all numeric and categorical filter channels atomically, scopes native TSS
provenance and coverage to TSS rather than PCC abundance, discovers sparse
metrics independent of gene order, preserves saved panel-scheme selections
through list changes, and retains the selected-detail shortcut until the sticky
third column actually begins. Pairwise comparison now leads with the signed
difference, generated panels mark changed settings without announcing the whole
result to screen readers, inapplicable saved-scheme actions are disabled, and
provenance counts use the same readable number formatting as the rest of the UI.

Current merged verification passes:

- 273 JavaScript tests;
- 132 Python tests;
- 62 contract checks with one declared spliced-CDS contiguity skip;
- all live-genome metric/protein checks;
- 15 release inputs and four generated annotation artifacts;
- 18 annotation-readiness/negative tests; and
- 32 browser/Python folding parity cases, ten-gene responsiveness/cache, all
  folding lifecycle states, and responsive rendered checks with no overflow or
  unexpected console errors.

## Remaining Work

Publication is intentionally not implicit. The repository has not been pushed
and GitHub Pages has not been enabled because that is an external state change
requiring explicit user authorization. The active annotation-readiness ticket
also records optional external evidence/licensing decisions that must not be
filled with heuristic substitutes.

## Verification

To resolve this umbrella ticket, authorize the intended Git remote push and
Pages publication, let the gated workflow pass, then record a smoke test against
the deployed URL. Review the manual scientific/licensing decisions listed in the
handoff before treating a generated panel as an experiment plan.

## Cleanup

After deployment validation, update only reusable runbook guidance, remove this
ticket from the live index, and delete it.
