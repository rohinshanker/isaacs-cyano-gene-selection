# A_loading-scramble-and-progress__20261006 — Active

Scope: Select and promote the loading/reveal presentation in `site/` after the owner's visual comparison.
Status: active
Opened: 2026-10-06
Updated: 2026-10-09

## Current State

Implementation resumed by the owner on 2026-10-08; this supersedes the earlier record-only instruction in this ticket. `cyano-ui-fixes` owns coordination/integration/closure. Standing claim-specific and source-access constraints still apply.

Engineering is implemented, integrated on `main`, and accepted by independent
DEM-267 review of `06ab535`. The owner selected B with a 500 ms hold on
2026-10-08 and instructed that the decision be recorded without implementation.
Production retains its previously selected 1,500 ms minimum, block schedule and
50-letter/s text timing. The alternatives are query-only and do not change
analysis hashes or saved state. The owner authorized publication of completed
engineering commits on main; applying the newly selected default is on hold.

The review packet with all six live URLs is in the canonical ignored directory
`.playwright-cli/cyano-ui-resume/animation/owner-choice.md`. The canonical site is
served on `http://127.0.0.1:8786/` from `site/`. Ask only for the remaining visual
choices; do not rerun broad implementation or review.

| Choice | Behavior |
| --- | --- |
| A | Reveal after required data, context, view and a clean frame are ready |
| B | The same readiness, plus a presentation-only 500 ms hold selected by the owner; the existing preview uses 1,000 ms until implementation resumes |
| C | At least 50% of measurable known bytes plus readiness; no byte total or an unreachable terminal failure falls back to readiness with an actionable error |
| Grouped | Known files occupy byte-weighted chromosome slots; unsized work stays separate |
| Continuous | The same known-byte totals form one aggregate extent |

Both treatments retain actual byte progress alongside unsized work, keep the
same bar active through application/preparation, preserve partial error extents,
provide visible activity without percentage advancement, respect reduced motion,
and keep status readable. Initial stages retain organism-specific wording;
post-settle file requests, including Retry, identify the filename as required
by the sidecar ticket's requirement 3. That deliberate post-settle copy does not
change approved production timing or its initial tier wording.

Review text uses coherent blocks at 1/12/40/160-character anchors of
250/350/600/1,000 ms, capped at 1,000 ms. Inline flow geometry and controls are
reserved in one batched read/write pass and restored exactly. New landing
content receives one bounded local reveal only in review mode; unchanged
replacements inherit their deadline. Ordinary user changes do not restart it.
The RSCU sidecar is integrated, has no browser tier/fetch, and is excluded from
progress. Packed codons remain in the core file.

## Owner requirement, 2026-10-08

The owner wants continuing visible activity so waiting/preparation does not look
like a frozen screen. A/B/C are reveal gates; grouped/continuous are byte-progress
geometry. Current code pulses during indeterminate preparation/unknown-size work;
known-byte network stalls and B's final presentation hold are not guaranteed to
keep moving. Proposed completion contract: activity remains visible whenever work
is pending, while the measured completed extent advances only for actual work.
Recommendation supplied: A readiness plus continuous aggregate progress, with a
separate activity cue. The owner selected **B, but 0.5 s**, after that explanation.
This means readiness plus a 500 ms presentation hold. Continuing activity remains
a requirement through known-byte stalls, preparation and the final hold; measured
extent changes only for actual completed work. Grouped/continuous geometry was
not explicitly selected in this answer and remains a separate pending choice.
**Record only; do not change code, production defaults or previews yet.**

The owner's later instruction to proceed supersedes the record-only hold.
Implementation on `work/ui-loading-20261008` promotes B/500 ms and continuous
truthful aggregate progress to production, with activity through transfer stalls,
preparation and the hold. Default `cyano:core` to `cyano:revealed` measured
637.8 ms on a warm local load; reduced motion measured 130.1 ms with no animation,
confirming the 500 ms hold was removed. Integration and closure remain with the
coordinator.

## Verification

Final branch verification: `npm test` passed 1,348; `.venv/bin/python -m
pytest -q` passed 891 with 1 skip and 36 subtests; `.venv/bin/python
tools/validate_contract.py` passed 117 with 1 declared skip. Focused loading,
layout, overlay and chromosome checks passed 150. The real-app matrix rendered
and inspected screenshots plus semantic snapshots at 375x812, 768x1024,
1280x800 and 1440x900, and breakpoint screenshots at 959/960 and 1239/1240.
The browser check reported no runtime errors or failed requests outside the
deliberately aborted failure scenario.

Follow-up review reproduced and repaired four selected-operation lifecycle
regressions: a failed landing now retains Retry, cached colour changes refresh
their filters and source disclosure, named and pooled source changes supersede
or restore pending work, and Function category aggregates its annotation,
candidate-evidence and derived-category dependencies. The exact real-app
failure, cached-source and three-file pending sequences pass alongside the
final responsive matrix.

Final combined gates: `npm test` 1,116 passed; pytest 494 passed, 1 skipped,
36 subtests; contract 116 passed, 1 declared contiguity skip. Manifest, module
preloads and generated loading-bar checks pass. Focused loading/shell tests
42 passed, scramble 30 passed. DEM-267 accepted all five findings and related
cycle/failure/readiness cases on the exact source tree; no blocking findings
remain. Actual post-settle filename copy is retained per the explicit requirement.

The final matrix passes all 24 A/B/C × grouped/continuous × 375/768/1280/1440
scenarios, covering fresh slow/moderate/local and cache-enabled warm/measured
navigations with distinct query tags. Zero final overflow, failures, busy/inert
state, or page/console/request errors; one bar; `codon_rscu.json` never requested.
The 4× CPU mobile interaction completed in 525 ms while text was settling.
Relevant reveal and settled frames were inspected at all four widths. Earlier
`matrix-invalid-hashnav/` evidence is excluded.

Additional real-app checks cover missing ledger at measured 52% reveal, terminal
failure below halfway with usable Retry, post-settle downloads, reduced motion,
deep links and organism changes. Controlled component snapshots in the real app
host/CSS verify mixed-size work, preparation overlap and activity opacity changing
without completed extent changing. Those are distinct from real fetch checks.
Reservation trace: 568 layouts / 70.361 ms before, 1 layout / 3.838 ms after.
Slow production has no busy/inert additions beyond its original animation cap;
review mode retains local reveals. Real iOS hardware was unavailable.

Artifacts are under `.playwright-cli/cyano-ui-resume/`: `final-matrix-report.json`,
`final-matrix/`, `c-fallbacks-report.json`, `activity-report.json`,
`preparation-overlap-report.json`, `late-default-report.json`, and
`scramble-repair/`. Reusable contracts and tuning/review steps are in
`docs/validation/progressive-loading.md`; test logs are `combined-*.log`.

## Cleanup

Apply the owner's A/B/C and grouped/continuous selections as the production
defaults, update the timing/progress contract and relevant expectations, and run
focused rendered checks plus required gates on that final change. Then complete
the normal R-rename/status/verification/deletion lifecycle and remove its queue
row. Keep the separate human clutter audit open for marks.
