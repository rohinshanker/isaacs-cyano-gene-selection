# O_data-use-audit-fixes__20261004 — Open

- **Scope:** The code fixes accepted at intake of the 2026-10-03 Claude Science
  data-use audit, one change per finding, each with its own review, regression
  check where the defect is mechanically detectable, and validation-document
  update. Covers `site/js/`, `tools/`, `tests/`, and `docs/validation/`.
- **Status:** open
- **Opened:** 2026-10-04
- **Updated:** 2026-10-04

## Current state

Opened by the intake recorded in
[O_claude-science-data-use-audit__20260928](O_claude-science-data-use-audit__20260928.md#triage-2026-10-04).
The findings are in
`docs/notes/handoff/cyano_data_use_audit_20261003.md`; every location and number
was re-verified on the working tree of 2026-10-04. Two findings (A-03, A-09) were
fixed in documents at intake and are not repeated here except where code remains.
Nothing below changes what a displayed value means, its basis label, or a
caveat's substance; each item adds a label or removes a silent coercion, which
the handoff contract leaves to the agents here.

## Work

One change per item. Items 1 to 3 change what is drawn and need rendered
validation at mobile, tablet, and desktop widths; the rest are mechanical and
need a unit test.

1. **A-01, high.** The radar and parallel-coordinates views clamp robust z to
   ±3 (`Z_LIMIT` in `site/js/ui/compare-model.js`) and nothing marks a clamped
   value. On the shipped release 16.5% of `expression` and 15.7% of
   `tssInitiation` values are clamped. First confirm the rim placement on screen,
   as the audit asks. Then mark a clamped value as clamped in both views, the
   legend, and the accessible description, state the clamp in
   [candidate-comparison-and-export.md](../../validation/candidate-comparison-and-export.md),
   and add a test over the shipped data pinning the clamped counts. The clamp
   itself is a visual encoding and may stay; hiding it may not.
2. **A-02, high.** The gene visualizer draws each Tan 2018 gTSS at the published
   start distance (`tssMarks` in `site/js/core/gene-view-model.js`); the
   chromosome view draws the published absolute coordinate (`paintTss` in
   `site/js/ui/chromosome-view.js`). 236 of 2,432 rows disagree by 3 to 198 nt
   and 15 published positions now fall inside the current CDS. Both placements
   are documented and defensible; the defect is that neither view nor document
   says they differ. Label the divergence where each site is drawn, state it in
   [controls-column-and-resets.md](../../validation/controls-column-and-resets.md)
   and [chromosome-view.md](../../validation/chromosome-view.md), and pin the
   236/15 counts with a test over the shipped data. Which placement a construct
   boundary should follow is the lab's call (row 8 of the biological-decisions
   list); do not pick one here.
3. **A-04, medium.** `site/js/ui/length-explorer.js` passes null range bounds for
   every cohort other than CDS length, so the chart is uniformly blue, while its
   `aria-label`, caption, and per-bin titles still describe a blue/grey split by
   "the selected range". Gate those three strings on `cohort.field ===
   'cdsLengthNt'` exactly as the text summary already does, and test the
   gene-span cohort's label.
4. **A-05, low.** `site/js/ui/regulatory-sites.js` prefixes every source warning
   with "Dark vs control" and ignores the warning's own `comparison` field. Build
   the prefix from `comparison`, and test a non-dark warning.
5. **A-06, low.** The same file gates the start-distance note on truthiness, so a
   distance of exactly 0 (47 occurrences in the Table S1 extract) would lose both
   the number and the "not recalculated" caveat. Use the finiteness test the three
   sibling paths use, and test a zero.
6. **A-07, low.** `site/js/ui/gene-viewer.js` renders `lengthCodons ?? 0` as
   "0 sense codons". Render a missing count as `MISSING`, as `format.js`
   promises; consider giving `formatCount` a missing guard so no caller can do
   this again. Test a null.
7. **A-08, low.** `site/js/ui/loadings.js` scores and draws `pc[0] ?? 0` and
   `pc[1] ?? 0`. A missing component must rank as unknown and draw as missing,
   not as zero. Test a loading with a missing component.
8. **A-09, low.** The pipeline writes `expressionPercentile` on the average-rank
   convention and the browser's `percentileRank` uses mid-rank; the gap is at most
   1/(2n). Pick one convention, make both sides use it, add it to the parity
   checks, and update the row recorded in
   [metric-convention-parity.md](../../validation/metric-convention-parity.md).
9. **A-10, low.** `meta.json` carries `genesWithoutMappedTss` (926, the site-row
   layer: 1,789 with a site) and "available for 1,727 of 2,715 genes" (the pooled
   score) with no field naming which layer each counts. Add the layer name
   beside each count in the pipeline that writes `meta.json`, and let the contract
   test pin both numbers against the shipped columns.

## Verification

Not started. Each item re-runs the gates:

```sh
npm test
.venv/bin/python -m pytest -q
.venv/bin/python tools/validate_contract.py
```

Items 1 to 3 also need rendered checks at mobile, tablet, and desktop widths,
with the accessible description read, per the project rule for UI changes.

## Cleanup

On resolution, record in each affected `docs/validation/` document the rule the
fix enforces and whether the defect was mechanically detectable; note in
[O_claude-science-data-use-audit__20260928](O_claude-science-data-use-audit__20260928.md)
that its ticketed findings are closed; update `validation/INDEX.md` if a row
changes; then delete this ticket and its index row.
