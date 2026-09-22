# O_deprioritize-cai-tai-defaults__20260922 — Open

- Scope: viewer defaults for axes, colour, sort order, detail-panel field
  order, and the guided panel objective; documentation of metric weight.
- Status: open
- Opened: 2026-09-22
- Updated: 2026-09-22 (implemented on feat/deprioritize-cai-tai)

## Current State

CAI and tAI are reproducible conventions, not measured biology. CAI uses a
frozen 71-locus product-name reference that is not measured high expression,
and tAI uses genomic tRNA gene copy counts that are not tRNA abundance,
charging, or decoding measurement (`docs/validation/current-design-answers.md`,
`docs/validation/cai-reference-set.md`). They should not be weighted strongly
when the lab reads a candidate, and the viewer currently gives them default
prominence: the **Metric X vs Y** tab opens on CDS length versus CAI
(`DEFAULT_METRIC_AXES` in `site/js/core/metric-axes.js`), and both scores sit
among the first metrics shown for a locus.

Keep the data. Do not remove CAI, tAI, or any derived field from the datasets,
the metric registry, the filters, the selectors, or the export. Deprioritize
them as defaults instead:

- Default axes, default colour choices, default sort orders, and default
  detail-panel field order should prefer actual biological measurements for
  UTEX 2973 even when replicate counts are low. Admitted examples are Tan 2018
  TSS evidence and differential comparisons, tested UTEX alleles from Ungerer
  2018, and admitted PCC 7942 essentiality with its cross-strain wording.
  Measured data with few replicates still rank above a codon-usage convention.
- CAI and tAI remain selectable everywhere they are today and keep their
  current explanations and citations. They move below measured evidence in
  every default ordering and are not a fresh-view axis or colour.
- The guided panel objective (`docs/validation/guided-panel-design.md`) must
  not let CAI or tAI dominate the default baseline feature list; review their
  weight there and record the decision.
- Where a low-replicate measurement is shown as a default, state the replicate
  count or condition limit next to it rather than hiding the measurement.
- Add a short note in the metric explanations that CAI and tAI are
  convention-derived indices to be read as supporting context, not as the
  primary evidence for a candidate.

Changed defaults must keep URL precedence rules: an encoded nondefault axis
or colour still wins over the new fresh-view default
(`docs/validation/explicit-metric-axes.md`,
`docs/validation/viewer-interaction-state.md`).

Implemented on `feat/deprioritize-cai-tai` (commits 9fc4b8a, 90887f2):

- `DEFAULT_METRIC_AXES` is CDS length against `tssInitiation`, resolved from
  declared provenance, and the axis note states that measurement's replicate
  count and coverage. `applyDecoded` still lets `ax`/`ay` and `c` win.
- Registry family order, the colour and axis selectors, the gene-detail groups,
  the comparison and pairwise-delta tables, the add-filter list, the default
  comparison axes, and the guided panel's baseline feature list all put measured
  evidence first and CAI/tAI last. Both stay selectable, exported, and cited.
- Metric explanations gained a **How to weigh it** row: CAI, tAI, and the proxy
  are named convention-derived supporting context; a measured metric states its
  replicate count, condition, and coverage there.
- Guided panel decision recorded in `docs/validation/guided-panel-design.md`:
  keep CAI and tAI, unweighted, listed last; the objective is unchanged and
  `panel-golden.test.mjs` passes as shipped.
- One deliberate exception: the fresh-view **colour** stays GC3. Rendering
  showed a linear ramp over the heavy-tailed TSS counts (median 828, maximum
  near 324,000) colours about nine genes in ten identically, hiding the
  measurement. Reason recorded in `current-design-answers.md`; a bounded native
  measurement would take the default with no code change. This is the one
  bullet a reviewer should accept or overturn.

## Verification

Pending: unit tests for the new fresh-view defaults and for URL override of
those defaults; export manifest still records CAI and tAI when selected;
rendered inspection of the fresh Metric X vs Y tab, colour selector order,
detail-panel field order, and guided panel defaults at desktop and narrow
breakpoints per the `ui-render-inspect-repair` skill; existing metric parity
tests unchanged.

## Cleanup

Record the default-priority rule in
`docs/validation/current-design-answers.md`,
`docs/validation/explicit-metric-axes.md`, and
`docs/validation/guided-panel-design.md` as applicable, update
`docs/validation/INDEX.md`, then delete this ticket and its queue row.
