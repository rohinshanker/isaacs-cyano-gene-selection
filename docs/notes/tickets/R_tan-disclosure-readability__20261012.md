# R_tan-disclosure-readability__20261012 — Resolved

Scope: Concise tan disclosure titles, skimmable paragraphs/lists and unified collapsed Controls guidance across chromosome/scatter/sequence views.
Status: resolved
Opened: 2026-10-12
Updated: 2026-10-12

## Current State

Owner: cyano-ui-fixes. User requests removing redundant / information title suffixes
and breaking dense lists into bullets or paragraphs. Work is isolated from active
regulatory/source work in work/tan-disclosure-readability-20261012, based on 90bcf91.
Preserve evidence wording, source labels, links and collapsed/keyboard behavior.
Owner steering: merge chromosome navigation and class-hover guidance into one
Controls disclosure, adapt it for other tabs/data types, and open the separate
recoded-genome functional-annotation transfer ticket.

## Verification

Implemented subject-only titles, structured provenance/condition/caveat lists and
stable Controls disclosures for chromosome, five scatter tabs and expanded sequence.

- JavaScript: 1,521 tests pass. Python: 1,371 pass, 2 expected skips and 51
  subtests pass on the isolated patch. All six organism contract, manifest and
  live-metric checks pass; annotation verify/check and readiness pass.
- Browser: 375, 768, 959/960, 1239/1240, 1280 and 1440 px; collapsed/expanded,
  keyboard, focus persistence, class/category/numeric guidance, unavailable
  projection, source lists, aliases and licence links pass with no runtime or
  console errors and no horizontal overflow. Native details/list semantics checked.
- RNA browser regression: all 32 parity cases, lifecycle, exports and UI states
  pass. No visual baseline changes or new test dependencies.
- Evidence: /tmp/cyano-tan-disclosures-20261012. An initial performance test run
  under concurrent Python/browser load failed its timing budget; unchanged test
  and code passed on rerun after that load finished. Keyboard automation now
  waits until the existing text entrance animation removes inert.

No open audit findings against this work. Concurrent main (0100c6d) merged
cleanly; the combined Python suite passes 1,682 tests and 51 subtests with 10
expected skips for optional scientific runtimes/source inputs. UI source and
scientific payloads are unchanged by that merge. Pages/public verification follows
publication under the existing release gate.

## Cleanup

Closed by cyano-ui-fixes on 2026-10-12. No open findings; no unfinished UI work.
Reusable presentation, stable Controls and accessibility rules are distilled in
[responsive-workspace.md](../../validation/responsive-workspace.md). The requested
[recoded-genome annotation ticket](O_recoded-genome-functional-annotations__20261012.md)
remains open. No other session's ticket is closed. Remove this resolved ticket
last; clean only this worktree/server after deployment verification. Existing
owner preview on port 8871 remains untouched.
