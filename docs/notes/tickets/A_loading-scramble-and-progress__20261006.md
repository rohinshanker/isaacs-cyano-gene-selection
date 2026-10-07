# A_loading-scramble-and-progress__20261006 — Active

- **Scope:** Initial loading presentation in `site/`: visible ATCG scrambling
  across text blocks, reveal timing, stage subtext, and engaging progress tied
  to actual files and website readiness. Prepare options for owner review under
  network throttling.
- **Status:** active
- **Opened:** 2026-10-06
- **Updated:** 2026-10-06

## Current State

The owner reports that after the loading bar finishes, most text settles too
quickly to see its ATCG animation, while one large block takes much longer.
Architecture and owner-review variant preparation are active. The three prior
interaction fixes are being completed in parallel; the visual choice remains
open for the owner, as requested.

Source inspection: `revealPage()` in `site/js/app.js` reveals the page and starts
`TextScramble`. `scrambleProgress()` in `site/js/ui/text-scramble.js` currently
uses text-node length at 50 letters/s, capped at 2,500 ms by
`site/js/ui/load-timing.js`. A three-character node therefore settles in 60 ms.
This can explain fleeting short labels but is not a verified diagnosis of the
reported regression; inspect rerenders, frame timing, and block coverage too.
`loadSchedule()` in `site/js/ui/load-progress.js` imposes decorative scheduled
steps on actual progress. The existing chromosome-loading ticket is active and
its code now includes stage subtext; recheck its outcome when this work starts.

## Requirements

1. Make the ATCG scramble perceptible for every eligible visible text block,
   including short labels, headings, and paragraphs. Shorter blocks should
   finish faster than longer ones, with a bounded maximum so a large paragraph
   does not keep settling conspicuously after everything else. Preserve final
   text, whitespace/layout, current deliberate exclusions, accessibility, and
   reduced-motion behavior.
2. Investigate timing per text node versus per coherent text block, rerenders
   that replace animated nodes, and main-thread contention at reveal. Tune a
   perceptible minimum and a compact duration range. Initial comparison values
   could be about 200–350 ms for short blocks, 350–600 ms for medium blocks, and
   900–1,200 ms at the long end; these are proposals for visual review, not fixed
   acceptance thresholds. Avoid a slow global animation that holds every control.
3. Evaluate the owner's suggestion of roughly one extra second before the full
   reveal, allowing content preparation to settle and the animation to run
   smoothly. Compare it with yielding/chunking expensive preparation and starting
   the animation on a clean frame. A timer alone does not prove the lag is fixed.
   Treat any purely visual hold as presentation timing rather than invented file
   progress; do not delay network requests to manufacture the pause.
4. If not already implemented when this ticket is reached, add concise text
   directly below the loading bar naming what is currently loading. If upstream
   work supplies it, verify it remains correct throughout this reveal sequence,
   including slow stages, preparation, failures, and retries.
5. When loading is noticeable, the bar must reflect actual loaded files and
   website content readiness instead of a performative jump schedule. Use known
   byte totals where available, honest file/group completion otherwise, and real
   preparation/render milestones for website content. Define each phase and its
   denominator. Unknown work must remain an activity state until measurable;
   do not infer completed work from elapsed time. Smooth only progress supported
   by completed work and preserve truthful failure/absent/retry states.
6. Preserve the single chromosome progress surface and complete-cycle rules in
   [progressive-loading.md](../../validation/progressive-loading.md). Progress,
   stage subtext, and completion must agree even when content is revealed early.

## Reveal Options for Owner Review

- **After readiness:** Keep the initial page reveal after the required content
  is ready, with a visibly balanced scramble across blocks. Compare immediate
  reveal with the suggested roughly one-second preparation/presentation window.
- **At halfway:** Alternatively, start text scrambling and let text and elements
  appear when real loading progress reaches about 50%. Start each block only
  when its content is available; retain pending states for later content and keep
  the loading bar active until the whole cycle settles. Show what happens when
  50% is reached before essential content is ready. Revealing content may push
  the PCA map below the viewport, as the owner noted: present that layout tradeoff
  explicitly in the visual review, including whether reserving space helps.

These are alternatives to compare, not a decision to ship the halfway option.

## Loading Ontologies / Animation Options

All options must share the truthful progress contract above. Compare a small
number on the same throttled loads; the owner will judge the visual pacing.

| Option | Progress meaning and animation | Tradeoff |
| --- | --- | --- |
| File/group segments | One segment per large file or coherent group of small files; size by known work where available. Fill fluidly from streamed/completed work, then pause until the next group starts delivering work. | Closest to the owner's example; makes load structure visible, but parallel groups need explicit aggregation rather than an invented serial schedule. |
| Continuous byte progress | Smooth the measured aggregate byte fraction; hold when transfers stall. Stage subtext names the active work, followed by real preparation/readiness steps. | Most directly reflects transfer volume; small but expensive preparation work needs its own visible stage. |
| Pipeline milestones | Use explicit Fetch, Prepare, and Ready phases, subdivided by real files or preparation tasks. Animate each advance only after measured work supports it. | Explains why content is not ready after transfer; phase weights must have a stated basis instead of decorative percentages. |
| Hybrid chromosome segments | Use real file/group progress for segment completion, with a subtle moving activity highlight inside the active segment while waiting. Pause the completed extent when no new work lands. | Adds engaging motion during stalls without claiming extra progress; activity and completed extent must remain distinguishable. |

Suggested first comparison: file/group segments versus continuous byte progress;
add the hybrid activity treatment if actual stalls otherwise look frozen.

## Verification

Implementation verification is pending. Acceptance requires:

- Tests for perceptible short/medium/long timing, exact final text, block coverage,
  rerenders/cancellation, reduced motion, and the selected reveal trigger.
- Progress tests for streamed files, grouped small files, concurrent work,
  unknown totals, preparation, cached loads, stalls, failures/retry, and later
  resources. No elapsed-time advance beyond measured work or premature finish.
- Use the `ui-render-inspect-repair` skill to render the real site at mobile,
  tablet, and desktop widths. Compare cached and uncached visits with no
  throttling, moderate throttling, and slow throttling; capture a recording or
  frame sequence showing short and long blocks, bar pacing, stage subtext, and
  the PCA map's position for each reveal option. Inspect main-thread/frame timing
  during preparation and scramble, and verify ordinary controls stay responsive.
- Prepare repeatable DevTools throttling steps and tuning URLs using existing
  `load-*` timing parameters. The owner will manually review loading bars and may
  request small visual timing changes; leave the visual choice open for that
  review rather than declaring a preferred ontology approved.
- Run repository gates: `npm test`, `.venv/bin/python -m pytest -q`, and
  `.venv/bin/python tools/validate_contract.py`, plus the applicable manifest,
  preload, and loading-shell checks in the progressive-loading contract.

Ticket intake: read the live queue, the active chromosome-loading ticket, and
the current reveal, scramble timing, and progress-schedule source. No application
code changed for ticket creation.

Ticket-creation checks passed: ticket identity, required fields, unique queue
link, validation link, whitespace, `git diff --check`, `npm test` (1,086 passed),
`.venv/bin/python -m pytest -q` (486 passed, 1 skipped, 36 subtests passed), and
`.venv/bin/python tools/validate_contract.py` (110 passed, 1 skipped). These check
the current working tree; animation changes and owner visual review are pending.

## Cleanup

On acceptance of the implementation and owner's visual choice, resolve the
filename, H1, and status; record final validation. Distill the selected progress
meaning, timing rules, and repeatable throttling review into
`docs/validation/progressive-loading.md`, update `docs/validation/INDEX.md`, then
delete the resolved ticket and remove its queue row.
