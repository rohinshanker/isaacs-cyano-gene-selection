# O_source-derived-category-colour__20260922 — Open

- Scope: Function category colour layer; annotation-source toggles; category legend counts; build-time category derivation from PCC 7942 and GO IEA data; function-category contract change.
- Status: open (implemented on `feat/source-derived-colour`; awaiting the owner's accept/reject decision)
- Opened: 2026-09-22
- Updated: 2026-09-22

## Requires your validation

The derived layer, its Jev rubric, and its thresholds need your acceptance
before the lab relies on the colours. The implementer builds it under
explicit evidence labels and records the calibration; you then accept or
reject in `docs/validation/AAA-biological-decisions-to-review.md`. The 13
reviewed assignments are never changed by this work.

## Scope change (2026-09-22, owner)

The annotation-source toggles govern **function-category colouring and the
category legend counts only**. The detail panel, tables, panel-designer list,
search suggestions, and export always show every source; the single-source
blanking views and the `as` URL field are removed with a versioned migration.
The toggles sit inside the legend directly above the reviewed-categories
section, shown only when Colour by is Function category, and that section's
title states what is counted under the enabled sources.

## Current State

Implemented on branch `feat/source-derived-colour` (DEM-109) under the scope
change above and the later precedence note (UTEX > PCC > GO, conflicts
coloured by the highest-priority enabled source and named in the detail
panel and export). Awaiting the owner's decision in row 12 of
`docs/validation/AAA-biological-decisions-to-review.md`. Three checkboxes in
the legend govern colouring and counts (URL field `cs`; the old `as` field is
dropped on decode); `site/data/source-derived-categories-v1.json` pins
Jev-judged categories from PCC 7942 product names (1,093 of 2,542 assigned
at P ≥ 0.8) and GO IEA terms (1,028 of 1,584). UTEX alone colours 12 CDSs,
UTEX with PCC 1,096, all three 1,364 with 13 conflicts. Evidence, threshold
calibration, and the spot check are in
`docs/validation/source-derived-categories.md`. The text below records the
state this ticket started from.

**Colour by → Function category** colours only the 13 lab-reviewed UTEX 2973
assignments in `site/data/function-categories-v1.json`; the other 2,703 CDSs
draw as unknown. The contract in `docs/validation/function-categories.md`
states that IEA GO relationships and product-name substrings must not create
category assignments. The **Annotation source** control is a single choice
(All sources, UTEX 2973, PCC 7942, GO IEA) and the legend counts come from
the reviewed table alone (`counts`, `unknownCount`, `multipleCount` in
`site/js/core/function-categories.js`).

Change this so the PCC 7942 and GO IEA datasets can also drive category
colour when they are turned on, and so the legend counts reflect the datasets
currently selected:

- **Per-source toggles.** Three checkboxes, UTEX 2973, PCC 7942, and GO IEA, inside the legend above
  the category section, replace the single-choice annotation source. All three on is
  today's All sources view; exactly one on is today's single-source view, so
  the blank-field rule in `docs/validation/data-contract.md` still holds for
  each source. Migrate the URL field `as` under the existing versioned
  conventions so old links keep their meaning; a fresh view starts with all
  sources on.
- **Source-derived categories, built offline and pinned.** Add a versioned
  `site/data` file that assigns each CDS a category from each non-reviewed
  source, using the same 11-label vocabulary: from GO IEA, a judgment over the
  locus's GO terms; from PCC 7942, a judgment over the joined PCC product
  name (and its GO terms if a pinned PCC GAF is admitted). These are semantic
  judgments over natural-language fields, so use TypeSafe Jev at build time
  under a frozen, blinded rubric with predeclared evaluation labels, pinned
  results, calibration on real loci, a blinded spot check, and an offline
  `--check`, following `docs/validation/go-iea-essentiality-context.md` and
  `cai-reference-set.md`. Keep rules and thresholds in code. No keyword or
  substring matching. The build never runs in the browser or in CI with the
  API key.
- **Colour resolution.** With the sources that are on, a CDS takes the
  lab-reviewed UTEX category when one exists, otherwise the PCC-derived
  category, otherwise the GO-derived category (UTEX > PCC > GO). When enabled
  sources disagree, the CDS is coloured by the highest-priority enabled source
  and the detail panel and export list each source's category with an
  explicit conflict note; conflicts never use the multiple-functions bucket.
  Derived colour is never shown as reviewed: the legend, detail panel, and
  export label the evidence (`reviewed`, `pcc-7942-derived`,
  `go-iea-derived`) and the derived layer uses a visibly distinct marker
  treatment so reviewed and computational colour are never confused.
- **Legend counts.** Each category row shows the number of CDSs resolved to
  that category under the currently enabled sources, and the unknown and
  multiple-functions rows recount accordingly; the title states which sources
  are counted. Counts change live when a toggle flips, and the hover, click,
  and multi-select filter from the category legend keep working on the
  resolved category.
- **Contract change.** Update `function-categories.md` to permit
  source-derived colour under explicit evidence labels while keeping the rule
  that derived categories never enter the reviewed table, never change the 13
  reviewed rows, and never appear without their source label. Record the new
  file in `data-contract.md`, carry the Gene Ontology CC BY 4.0 and
  Adomako/Rubin attributions, and add a row to
  `AAA-biological-decisions-to-review.md` so the lab can accept or reject the
  derived layer and its thresholds.
- Export records the enabled sources, each CDS's resolved category, its
  evidence label, and every per-source category so a file cannot be mistaken
  for the reviewed-only view.

Depends on nothing open; it builds on the merged category legend filter and
the annotation-source accessor in `site/js/core/annotation-source.js`.

## Verification

Pending: build `--check` passes offline without the API key; unit tests for
the toggle migration of `as`, the precedence and disagreement rules, the
live legend counts under every toggle combination, and export fields;
contract validator green; rendered inspection at desktop and about 390 px of
the legend counts changing as sources toggle, the distinct derived marker,
the detail panel for a reviewed locus, a derived-only locus, and a
disagreeing locus, per the `ui-render-inspect-repair` skill.

## Cleanup

Distill the derivation rubric, thresholds, and evaluation into a new
`docs/validation/source-derived-categories.md`, update
`function-categories.md`, `data-contract.md`,
`viewer-interaction-state.md`, and `docs/validation/INDEX.md`, then delete
this ticket and its queue row.
