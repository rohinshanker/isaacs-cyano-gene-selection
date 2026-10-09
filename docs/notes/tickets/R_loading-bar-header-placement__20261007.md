# R_loading-bar-header-placement__20261007 — Resolved

Scope: Move the additional, post-reveal loading bar from the top of the center panel into the empty area beneath the top-right Jump to map / Reset panel widths controls.
Status: resolved
Opened: 2026-10-07
Updated: 2026-10-09

## Current State

Opened for later at the owner's request. No implementation started.

The owner reports that the current center-panel placement causes the menu bar
to resize and leaves blank space when the additional loading bar disappears.
The requested destination is the empty area below the top-right buttons; showing
or hiding progress must not change the menu/header dimensions or leave a gap in
the center panel.

The source identifies this as the post-reveal `#load-tail` host, before
`#panel-tabs` in `site/index.html`. `site/js/ui/load-progress.js` moves the same
progress presentation into it after the initial reveal. `.load-tail` in
`site/css/app.css` reserves a minimum height of `3.75rem`. This is source context,
not a rendered reproduction of the reported defect.

Opening baseline: canonical Desktop checkout, `main` at
`fb9747e6c3a4ed26f778e72a653c174beead9500`. Existing uncommitted Data Sources
changes include unrelated additions in `site/css/app.css`; preserve them.

## Acceptance

- Additional loading progress appears beneath the top-right Jump to map / Reset
  panel widths controls, using the existing empty area.
- Starting, updating, completing, and hiding progress do not resize the
  menu/header, move its buttons, or shift the center-panel tabs and content.
- The former center-panel host leaves no reserved blank strip after completion.
- Progress remains readable at responsive widths; failure messages and Retry
  remain visible and keyboard reachable without overlapping the buttons.
- Preserve the initial empty-shell loading presentation and truthful progress,
  status, retry, and reduced-motion behavior.

## Affected Area and Clarification

Before implementation and again at resolution, compare the header controls,
center-panel tabs, and loading hosts against the opening baseline. Record whether
intervening work changed this area, how that affects the requested placement,
and whether anything needs owner clarification. State explicitly when no
clarification is needed; do not silently resolve against a different layout.

Related: `A_loading-scramble-and-progress__20261006.md` holds the separate owner
choices for reveal timing and grouped/continuous progress. This ticket changes
placement and layout stability, not those pending presentation defaults.

Implementation on `work/ui-loading-20261008` moves the one post-reveal
presentation into a fixed-height slot beneath the top-right controls and removes
the centre-panel host. Toggling the settled presentation on the rendered page
produced 0 px change in controls, slot, main and tab x/y/width/height. No owner
clarification is needed: the intervening layout still has the named controls and
the requested empty header area. Integration and closure remain with the
coordinator.

## Verification

Final branch verification: `npm test` passed 1,342; `.venv/bin/python -m
pytest -q` passed 891 with 1 skip and 36 subtests; `.venv/bin/python
tools/validate_contract.py` passed 117 with 1 declared skip. Focused loading,
layout, overlay and chromosome checks passed 150. The real-app matrix rendered
and inspected screenshots plus semantic snapshots at 375x812, 768x1024,
1280x800 and 1440x900, and breakpoint screenshots at 959/960 and 1239/1240.
The browser check reported no runtime errors or failed requests outside the
deliberately aborted failure scenario.

Ticket opening: source locations and the related loading ticket inspected;
queue link checked. UI behavior has not been rendered or changed.

At implementation, render the actual application at 375, 768, 1280, and 1440 px
widths and around affected breakpoints. Inspect loading, settled, later-download,
failure/Retry, long-status, and reduced-motion states, including Reset panel widths
shown and hidden. Compare header/button/tab geometry before, during, and after
progress; inspect screenshots, keyboard access, overflow, and runtime diagnostics.
Run focused loading/layout checks and all repository completion gates.

## Cleanup

When implemented and verified, report the affected-area change and clarification
assessment to the owner, rename/status-mark this ticket resolved, and record final
validation. Distill reusable placement and layout-stability guidance into
`docs/validation/progressive-loading.md` and, if needed, the responsive-workspace
contract; update `docs/validation/INDEX.md`. Then delete the resolved ticket and
remove its queue row. Keep unrelated loading-default and clutter-review work open.

## Closure, 2026-10-09

Closing session: cyano-ui-fixes (80c81443-1791314087).
Findings: Loading review approved8d20969; no remaining placement findings.
Final verification: npm1,395 passed; pytest925 passed,1skip/36subtests;
contract119 passed,1declaredskip. Combined actualUTEX/E.coli four-width matrix
passed withzerooverflow/unexpecteddiagnostics; applicable authored/independent
matrices and8-width gene checks are retained in ignored scoped evidence.
Reviewed finallocalhost http://127.0.0.1:8830/ was opened in Google Chrome for
the owner on2026-10-09 before resolution; server belongs to this worktree.
Reusable contracts are in ../../validation/progressive-loading.md and its index.
Cleanup: resolve/rename, verify queue and links, then delete this ticket last.
