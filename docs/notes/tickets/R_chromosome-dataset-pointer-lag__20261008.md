# R_chromosome-dataset-pointer-lag__20261008 — Resolved

Scope: Diagnose and remove mouse-movement lag in the chromosome viewer while dataset-based coloring is active.
Status: resolved
Opened: 2026-10-08
Updated: 2026-10-09

## Current State

Closed by `cyano-general-ticket-closing` (`bfdd1b08-1791384632`) on
2026-10-09. Implementation, exact-patch review and final validation are complete;
no findings or audits remain open. The isolated implementation branch is
`fix/chromosome-pointer-lag-20261008`; its reviewed application result is
`4e5ca40e1104093c4a07e3ff1877ef98f4137267`.

The measured delay was in the shared gene detail panel, not chromosome hit
testing or dataset lookup. Every hover built 59 metric rows and prepared their
percentiles, although 48 rows in 11 families were inside closed disclosures.
The panel now creates rows for open families only and creates a closed family's
current table when the reader opens it. Expanded families rebuild from the
current gene, source selection and late-arriving values on every panel update.
It adds no hover delay and suppresses no interaction update.

Three bounded findings were fixed:

| ID | Finding | Resolution |
| --- | --- | --- |
| PTR-1 | Closed metric families built hidden rows and percentile cohorts on every gene preview. | `dcb9b6252dc745a9f7febbe15db07f198d273e83` defers their tables until open. |
| PTR-2 | A real open/close change could be lost if a gene/source update replaced the panel before Chrome delivered the native `toggle`. | `1e36ddb71e3316a5246ec2268bdc7d20ff8dea24` captures changed attached disclosure states before replacement and rejects detached queued work. |
| PTR-3 | Chrome's automatic `toggle` after construction set `open=true` could turn an untouched scheme-dependent default into remembered user state. | `4e5ca40e1104093c4a07e3ff1877ef98f4137267` ignores a toggle whose state has not changed from the disclosure's constructed/restored value. |

DEM-326 approved exact code `4e5ca40`: the reviewer independently exercised
pending, empty, stale, late-value, source-change, coalesced and untouched-default
transitions and a rendered keyboard path. No application-code finding remains.

## Baseline and Target

The fresh baseline used shipped UTEX 2973 data in Headless Chrome 154 on macOS,
1440×900 at DPR 1, with no CPU or network throttling and the whole
`NZ_CP006471.1` replicon (1–2,690,418) visible. Each scenario began after a
fresh document navigation and first gene detail, followed by warm movement.
Defaults were the published selection: protein abundance was informed by
`PXD062851_dia`; initiation by its only source, `TAN2018_TSS`; transcript
abundance by `GSE205444`, `GSE327989_wt_day4`, `GSE79726_control_24h`,
`GSE79726_n_plus_48h` and `GSE225426_wt_control`. The four-source transcript
case used `GSE205444`, `GSE288532_subjective_day`,
`GSE288532_subjective_night` and `GSE222067_wt_0mM_NaCl`.

First pointer entry was 43.4 ms for native GC3, 40.8 ms for protein abundance,
42.7 ms for initiation, 35.2 ms for default transcript abundance and 36.8 ms
for the four-source transcript pool. GC3, protein and initiation entry produced
64, 53 and 55 ms long tasks. Hit testing and `setInteraction` were at most 0.5
and 0.2 ms; first paint was 7.0–7.9 ms. Warm movement across 40 genes had
3.2–3.4 ms median handlers and 3.8–4.9 ms p95 handlers, with 3.8–4.5 ms median
and 4.3–5.7 ms p95 frames. An original x80/x81 sample crossed adjacent crowded
columns, so it is retained as `adjacentColumns20` and is not claimed as
same-gene evidence.

The explicit target was no interaction long task, first entry below 25 ms, and
warm pointer handlers and canvas frames below 16.7 ms at p95 on this machine.
On exact result `4e5ca40`, first entry was 17.3 ms GC3, 19.4 ms protein, 20.0 ms
initiation, 13.5 ms default transcript and 13.2 ms four-source transcript, with
no long tasks. Warm cross-gene handler p95 was 3.4–4.4 ms and frame p95 was
5.6–7.5 ms. Twenty repeated events at one exact coordinate retained the same
locus with 0.1 ms handler p95 and made no `setInteraction` or paint call.

## Acceptance

- Reproduced native and dataset-colored pointer entry, same-gene movement,
  gene-to-gene movement and exit against real shipped data, with exact browser,
  viewport, zoom, source, cache state and timing evidence.
- Preserved hit targets, current detail values, highlighting, click pin,
  pointer-exit pin fallback, ArrowRight/Enter selection, drag/pan and wheel zoom.
- Preserved closed/open disclosure state and summary focus. Every expanded
  family has current rows; stale detached and automatic native toggle events
  cannot build obsolete rows or freeze conditional defaults.
- Preserved default, individual, named and pooled quantity semantics,
  missingness, scale behavior, late values and organism isolation. Initiation is
  correctly treated as a one-source quantity rather than a pool.
- Kept the loading/default/header, tRNA, annotation, scale and regulatory UI
  work owned by the other sessions out of this patch.

## Verification

Focused checks passed on `4e5ca40`:

```sh
node --test tests/js/source-selection.test.mjs tests/js/type-metrics.test.mjs tests/js/chromosome-view.test.mjs tests/js/side-panel-lazy.test.mjs tests/js/gene-view-start-site-visibility.test.mjs
# 117 passed
node tools/check_chromosome_metrics.mjs --max-ms=100
node tools/check_chromosome_metrics.mjs --uncached
```

Cached and uncached sweeps kept identical source lists and hashes for protein
default/1/4/9-source, initiation default, and transcript default/1/4/54-source
cases. The four-source transcript hash is
`7b4f40397716647124a5f9bae9c1d1c1878e68f7e1c845c2a07a4c8ea39cec86`;
the named `GSE205444` hash is
`c22be3a686eb234cf269d1989b4855f5d79668d95a1f386bd7bd10fae0586445`.

All repository gates passed after temporarily linking the ignored pinned raw
inputs and canonical virtual environment into the worktree, then removing those
links:

```sh
npm test
# 1,338 passed
.venv/bin/python -m pytest -q
# 891 passed, 1 skipped, 36 subtests passed
.venv/bin/python tools/validate_contract.py
# 117 passed, 1 skipped
```

The exact-code UTEX browser matrix used the four transcript sources above at
375×812, 768×1024, 1280×800 and 1440×900. It crossed at least three genes at
each width, opened Base composition and rebuilt its 11 current rows across a
gene change, verified exact-coordinate same-gene movement, pin/exit fallback,
keyboard selection, zoom and pan, and found no runtime error or horizontal or
canvas overflow. Normal motion, reduced motion at 375 and 1440, and the
published light scheme under a dark OS preference were rendered and visually
inspected. Breakpoint checks at 959/960 and 1239/1240 also had no overflow.

The coordinator's independent source-state replay on exact `4e5ca40` covered a
four-source pool, named source, subset/restoration, filter/clear, all five
scatter entrypoints, chromosome return and hash reload. Pooled, restored,
returned and reloaded arrays all contained 2,715 genes with the same hash above;
hover caused no full model update and runtime errors were empty. Its independent
Syn61 matrix covered 16 cases: four widths by three-source RNA abundance pool,
named Nyerges 10 log2 fold change, named Nyerges 12 p-value and named Nyerges 16
translation-efficiency log2 fold change. Every case had 3,191 finite values of
3,549 passing genes, correct pooled/single-source metadata, working pan, zoom
and keyboard selection, and no runtime error or overflow.

Local immutable evidence is in
`.playwright-cli/pointer-lag-20261008/timing-baseline.json`,
`timing-after.json`, `final-browser.json`, `default-toggle-after.json` and the
`after-*.png` captures. Coordinator evidence is in
`.playwright-cli/pointer-review-20261008/source-state.json`, `syn61.json`, their
result transcripts and breakpoint/Syn61 screenshots. Both evidence directories
are archived in the canonical checkout; `pointer-lag-20261008/evidence.json`
pins their result digests and reviewed application commit. Timings are
development-Mac measurements rather than a device-wide
service-level guarantee.

## Cleanup

PTR-1, PTR-2 and PTR-3 are resolved by the commits listed above. DEM-326 approved
the final application commit in comment `01a11ed4-de86-725f-b068-613a078909a8`.
No later reader needs ticket-only guidance: the lazy-table, current-value and
queued/native-toggle contracts are distilled into
`docs/validation/chromosome-view.md` and indexed in `docs/validation/INDEX.md`.
The incoming loading-ticket link now points to that durable contract. Remove
this resolved ticket after recording closure; retain the archived local evidence
and remove only this session's temporary worktrees.
