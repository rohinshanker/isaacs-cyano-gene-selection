# R_chromosome-measurement-performance__20261007 — Resolved

Scope: Restore responsive chromosome interactions for protein abundance, transcript initiation and transcript abundance, including default, four-source and maximum selections.
Status: resolved
Opened: 2026-10-07
Updated: 2026-10-08

## Outcome

Closed by `cyano-general-ticket-closing` (`bfdd1b08-1791384632`) on 2026-10-08.
The owner identified pan or zoom as the slowest interaction. Profiling isolated
its entry delay: the preceding hover repeatedly rebuilt dataset groups during
whole-genome metric reads, then rebuilt the chromosome colour model.

| Finding | Resolution |
| --- | --- |
| PERF-1: per-gene source-group reconstruction | `65d1add`: immutable source-membership snapshot; values and registry metrics stay live |
| PERF-2: full colour-model refresh on hover/keyboard preview | `65d1add`: update emphasis and detail while retaining coordinates, colours, layers and controls |
| PERF-3: source change throws on chromosome before refreshing values | `42e8801`: dispatch the active view once through `renderAll`; real-browser regression fails on the old call and passes the repair |

The scout's proposed pending-rank concern does not reproduce under the atomic
layer-loading contract: the finite-value guard prevents caching ranks for an
unknown layer. The new late-arrival regression checks exact pooled values.
REV-1 is resolved by `42e8801` (the same defect as PERF-3). REV-2 is resolved
by `e510d2e`: the ticket distinguishes failed old source-switch artifacts from
passing integration evidence and names the verified target. REV-3, REV-4 and
REV-5 are resolved by `e510d2e`: freeze cached input containers with mutation
assertions, call the fixture 2,715 metric reads, and explicitly distinguish the
single-source initiation duplicate cases from pooled abundance coverage.
REV-6 is resolved by `2279d3e`: clear the temporary filter through the real
control and assert that both the pool and all 2,715 passing genes survive
reload. The existing filter-bound rounding and percentile invalidation noted
by the reviewer are unchanged, outside this patch and not findings against it.
Independent Claude review DEM-317 approved `2279d3e` with all six REV findings
resolved. Main then advanced to `dd6314d` before landing, so this session kept
the ticket active for integration and preserved the added owner clarification
(Chrome on macOS, defaults for all three measurement types).

INT-1 is resolved by `b689c77`: main's new declared non-pooling quantities use
the shared `informingOfType` rule in both cached and uncached paths. The cache
retains selected membership separately from contributing membership, preserving
one source's values and the complete selection count in the disclosure. The
new declared-quantity tests and 272 comparisons over the shipped UTEX and Syn61
catalogues agree with the uncached rules.

Final independent review DEM-317 approves `b689c77` with INT-1 correct
(comment `01a11a02-2d60-7db3-8f6a-531015126231`). INT-A and INT-B are resolved
by `f23791b`: save and checksum the 272-comparison output, and explicitly state
that multiple selected non-pooling sources are tested with synthetic fixtures;
each shipped Syn61 non-pooling type contains only one dataset. The reviewer
also independently checked 227,454 membership lookups and 240 full Syn61
value/disclosure comparisons with zero mismatches, and reran all 1,337 JS tests.
No unresolved finding remains against this ticket. The prior approved UI and
recoded-organism integrations are preserved, including the stable `chromosome`
ID, Chromosome/Gene label and third-tab position. The earlier isolated closure
never landed on main; this record supersedes it for the combined target.

## Verification

Baseline reproduction used `38520a5` (source-data baseline `4826fa1`); final
combined validation used `b689c77` on top of main `dd6314d`. Local Headless
Chrome 154, UTEX 2973, 2,715 CDSs, 1440 × 900, no CPU/network throttling.
Fourteen cold/warm cases cover all three defaults, one/four/all abundance
contributors (9 protein, 54 transcript).
The provisional four RNA-seq sources are `GSE205444`,
`GSE288532_subjective_day`, `GSE288532_subjective_night` and
`GSE222067_wt_0mM_NaCl`. The owner's original four IDs remain unknown; the default
reproduction and pan/zoom clarification were sufficient. No further owner
clarification is needed.

- Whole-genome warm metric sweeps: 388–458 ms before, 0.27–35.1 ms after; all nine
  selected-source lists and Float64 value-array SHA-256 hashes agree exactly.
- Repeated settled hover: roughly 1.6–2.5 seconds before, 2.8–5.0 ms after.
  Warm entry before the 54-source drag: 2,543.4 ms before, 3.4 ms after.
- Sustained 40-move drag and 40-event wheel: handlers at most 0.5/0.5 ms,
  frames at most 4.4 ms, no long tasks. Across the 14-case matrix, canvas frames
  at most 8.0 ms. First-use detail-percentile work remains 42–75 ms and is
  reported separately; these are local development measurements, not a
  device-independent guarantee.
- Transfer/resource timing, JSON parsing, core/expression application, pooled
  sweeps and interactions were profiled separately. CPU sampling identified
  `typeGroups` as dominant; rendering itself was not the multi-second stall.
- Normal-motion loading/settled rendering: 24 cases at 375, 768, 1280 and 1440 px,
  all three defaults and multi-source choices. Initiation has only one source:
  four cases repeat its default, giving 20 distinct width/selection combinations.
  Hover, keyboard preview/pin, pan/zoom, hidden-gene controls, selected-gene ARIA,
  geometry and runtime diagnostics pass. Final combined viewports and loading
  captures inspected; original full canvas matrix inspected.
- Browser regression passes named source, removal/restoration, exact pooled
  hashes, filtering, all five scatter views, shared-link reload and responsive
  breakpoints 959/960 and 1239/1240. No runtime/console/request errors; no
  horizontal overflow. Keyboard and semantic accessibility checked; no axe
  dependency added. No visual baselines changed.
- Syn61 rendered check: 16 cases across the same four widths for pooled RNA
  abundance, RNA log2FC, P-values and TE log2FC. All 16 sources stay selected;
  abundance pools three, and each non-pooling type reads its declared single
  source. Hover, keyboard/pin, pan/zoom, counts, ARIA and runtime checks pass.
- Final gates: `npm test` 1,337 passed; `pytest -q` 891 passed, 1 skipped,
  36 subtests passed; `validate_contract.py` 117 passed, 0 failed, one existing
  declared spliced-CDS exemption.

Affected-area comparison against opening `b769ee1`: application/chromosome
wiring and paint priority were unchanged before this task. Intervening fitness,
E. coli and signed protein-ratio changes are retained. This repair changes
source resolution, preview refresh and active-view dispatch; no measurement,
missingness, rank-pooling, loading-progress or coordinate contract changes.
The owner reports Chrome on macOS; measurements use local headless Chrome 154.
Other browsers/devices were not profiled. Transient evidence remains in the task-scoped ignored `.playwright-cli`
directories, including exact selections and before/after runtime data.

## Cleanup

Reusable snapshot/refresh contracts, bounds and profiling/browser-check commands
are in `docs/validation/chromosome-view.md`, indexed in `docs/validation/INDEX.md`.
No required information remains only in this ticket. Record resolution, then
delete this resolved file last and remove its live queue row. Other tickets and
all unrelated untracked files remain owned by their sessions.
