# O_log-percentile-axis-option__20260922 — Open

- Scope: Metric X vs Y plot axis scaling; metric registry and URL state for an axis-scale choice; export manifest.
- Status: open (implementation complete; handed to coordinator for integration and review)
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

Done. `site/js/core/metric-axes.js` gained per-axis `linear`/`log10`/`percentile`
scales (`buildMetricAxesProjection`, `log10Availability`, `log10DisabledReason`,
`axisTitle`); `site/js/core/url-state.js` encodes them as `xs`/`ys`, nondefault
only, with no version migration needed; `site/index.html` and `site/js/app.js`
add X/Y scale selectors that disable Log10 with a reason+count when the current
metric has a non-positive finite value, and fall a stale request back to linear.
The export `viewState` records `axisXScale`/`axisYScale` beside `axisX`/`axisY`;
CSV values stay raw. New unit tests: 7 in `tests/js/metric-axes.test.mjs`
(linear default, log10 transform, log10-unavailable + reason, percentile over
the visible cohort including a filtered-out gene, missing values, unavailable
axis under every scale), 1 in `tests/js/scatter-navigation.test.mjs` (tick
distinctness for log10/percentile ranges at fine spacing), 3 in
`tests/js/url-state.test.mjs` (scale round-trip, malformed scale dropped, old
hash with no scale fields stays linear), 1 in `tests/js/export-manifest.test.mjs`
(scales recorded in the manifest, CSV unaffected). `npm test`: 465/465 pass.
Rendered inspection (Playwright, `python3 -m http.server` over the real
dataset) at 1440×900 and 390×844: default plot (squashed, as described),
Y=log10 (spread, title "TSS initiation (UTEX 2973), log10"), X=percentile +
Y=log10 together (title "CDS length, percentile"), the disabled-log10 case on
ΔCAI (all-zero with no scheme active: "log10 is unavailable for ΔCAI: 2715
values are zero or negative"), 6 zoom-in steps on the log10 Y axis (ticks
3.55-3.95 in 0.05 steps, all distinct), a full URL round-trip (fresh load from
a copied `xs=percentile&ys=log10` hash), an old `ver=2` hash (decodes to
linear/CDS length vs CAI, unchanged), and a shortlist export (manifest
`viewState.axisXScale`/`axisYScale` present, CSV `lengthNt`/etc. raw). Zero
console errors throughout every check.

Gates: `npm test` 465/465; `python -m pytest -q` 301 passed, 22 subtests,
2 skipped (skips pre-exist, unrelated to this change); `tools/validate_contract.py`
81 passed, 1 skip (pre-existing, declared spliced-CDS exemption); `node
tools/check_live_metrics.mjs` 14/14 passed; `git diff --check` against base
commit clean.

## Cleanup

Distill the scale semantics into `docs/validation/explicit-metric-axes.md`:
done (new "Per-axis scale" section). Per the coordinator's handoff for this
run, this ticket is not deleted and `docs/validation/INDEX.md` is not edited;
that remains for the coordinator's integration pass.
