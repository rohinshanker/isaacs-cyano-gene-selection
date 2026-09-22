# O_log-percentile-axis-option__20260922 — Open

- Scope: Metric X vs Y plot axis scaling; metric registry and URL state for an axis-scale choice; export manifest.
- Status: open
- Opened: 2026-09-22
- Updated: 2026-09-22

## Current State

The fresh Metric X vs Y plot now opens on CDS length versus Tan 2018 TSS
initiation. TSS initiation counts are heavy-tailed (median about 828, maximum
about 324,000), so on a linear axis roughly nine genes in ten sit below 5,000
on an axis that reaches 324,000 and the default plot is honest but squashed.
`docs/validation/explicit-metric-axes.md` and `current-design-answers.md`
describe the linear axes; `site/js/ui/scatter.js` draws them with
`niceTicks` and `formatTick`.

Add a per-axis scale option so the default plot is readable without changing
the underlying numbers:

- Offer **linear** (default), **log10**, and **percentile** for each axis of
  the Metric X vs Y plot. Log applies only to metrics whose values are all
  positive; zero or negative values under log are shown as unavailable with
  the count, not dropped silently. Percentile ranks the finite values of the
  visible cohort and is labelled as a rank, not a value.
- Ticks and labels must state the scale (for example "TSS initiation, log10"
  or "TSS initiation, percentile") and `formatTick` must keep adjacent ticks
  distinct at every zoom level, as the CAI/tAI review required.
- Encode the choice in URL state with the existing versioned conventions in
  `site/js/core/url-state.js`; a fresh view stays linear, an explicit choice
  wins, and old hashes decode unchanged.
- Record the axis scales in the export manifest beside the axis keys so a
  file cannot be mistaken for a linear plot.
- Do not change the fixed PCA, UMAP, risk, or perturbation maps; this is the
  metric plot only. Do not publish a new TSS percentile field to
  `site/data`; compute the rank in the browser from the visible cohort so
  filters change it predictably.

## Verification

Pending: unit tests for log and percentile transforms including zero and
negative handling, tick distinctness under both scales across zoom levels,
URL round-trip and legacy-hash decode, and manifest fields; rendered
inspection of the default plot under all three scales at desktop and about
390 px, per the `ui-render-inspect-repair` skill; existing metric-axes and
scatter-navigation tests green.

## Cleanup

Distill the scale semantics into `docs/validation/explicit-metric-axes.md`,
update `docs/validation/INDEX.md`, then delete this ticket and its queue row.
