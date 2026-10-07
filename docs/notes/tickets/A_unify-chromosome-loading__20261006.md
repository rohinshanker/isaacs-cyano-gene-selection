# A_unify-chromosome-loading__20261006 — Active

- **Scope:** Consolidate the site's loading progress under the main chromosome-style
  bar, including later data stages and subsequent organism or dataset loads.
  Covers `site/`, loading tests, and `docs/validation/progressive-loading.md`.
- **Status:** active
- **Opened:** 2026-10-06
- **Updated:** 2026-10-06

## Current State

Opened at the owner's request. The owner reports a secondary loading bar appearing
after the chromosome bar finishes. Source inspection confirms that
`site/js/ui/load-progress.js` switches from the chromosome bar to a separate slim
"tail" meter after the page reveal, while later files continue loading. This
sequence has not been reproduced in a browser for this ticket. Implementation
has not started.

## Requirements

1. Use the main chromosome-style bar as the single progress surface for all
   loading. Later tiers must continue within that presentation rather than
   appearing as a secondary bar after it finishes.
2. Small subtext directly below the chromosome bar may name what is currently
   loading, for example "Loading gene annotations" or "Loading regulatory sites".
   Keep it concise and update it as the active work changes.
3. Define completion across the whole load cycle. The bar must not announce 100%
   or disappear while work belonging to that cycle remains in flight. Progress
   must reflect actual work, including work discovered during loading, without
   an apparent finish followed by another progress bar.
4. Audit every loading entry point: initial boot, later tiers, independently
   fetched resources such as citations, organism changes, selected datasets, and
   retries. Route their progress through the same presentation; coordinate
   per-dataset loading with
   [O_data-sources-selection__20261005](O_data-sources-selection__20261005.md).
5. Preserve truthful loading, absent, and failed data states, per-file retry,
   accessible progress/status announcements, reduced-motion behavior, and
   responsive layout. A failed request must settle into an actionable error
   rather than leaving an endless loading bar or claiming successful completion.
   Contextual notes describing unavailable or pending evidence may remain;
   progress meters belong to the chromosome bar.

## Implementation Notes

- Start with `site/js/ui/load-progress.js`, boot/reveal coordination in
  `site/js/app.js`, the loading markup in `site/index.html`, and its stylesheet.
- The current [progressive-loading contract](../../validation/progressive-loading.md)
  explicitly specifies the second tail meter. Update that contract and the tests
  with this owner-requested behavior.
- Choose whether the chromosome bar remains visible after an early page reveal
  or the reveal waits for the full cycle. Either approach must meet the single-bar
  and truthful-completion requirements; the owner has not specified this timing.

## Verification

Implementation verification is pending. Acceptance requires:

- Tests covering progress across early and later stages, concurrent loads,
  completion, failed/absent files, retry, and organism/dataset transitions.
- Rendered checks with cache disabled and a throttled network at 375, 768, 1280,
  and 1440 px: only one progress bar, stage subtext below it, no premature
  completion, no overflow or disruptive layout shift, and no console errors.
- A fast cached visit, a deep link requiring later data, a failed-file retry,
  an organism change, and reduced motion; verify accessible status text agrees
  with the visible state.
- Repository gates: `npm test`, `.venv/bin/python -m pytest -q`, and
  `.venv/bin/python tools/validate_contract.py`; run the loading contract's
  manifest, module-preload, and load-bar checks where applicable.

Ticket intake: checked the live queue, confirmed the canonical checkout's Git
remote, and identified the two progress surfaces in source. No application code
changed for ticket creation.

Ticket-creation checks passed: `git diff --check`, `npm test` (1,065 tests),
`.venv/bin/python -m pytest -q` (473 passed, 1 skipped), and
`.venv/bin/python tools/validate_contract.py` (110 passed, 1 skipped). These check
the current working tree; the requested loading behavior remains unimplemented.

## Cleanup

On implementation acceptance, resolve the filename, H1, and status; record final
validation. Distill the reusable single-bar and completion rules into
`docs/validation/progressive-loading.md`, update `docs/validation/INDEX.md`, then
delete the resolved ticket and remove its queue row.
