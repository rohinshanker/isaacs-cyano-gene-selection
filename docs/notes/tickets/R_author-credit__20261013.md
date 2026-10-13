# R_author-credit__20261013 — Resolved

Scope: Shared author credits on the initial loading screen and every organism description.
Status: resolved
Opened: 2026-10-13
Updated: 2026-10-13

## Outcome

Closed by cyano-ui-fixes on 2026-10-13. “By Rohin Shanker” appears above the
initial loading bar and as a smaller subtitle beneath all six organism descriptions.
The initial copy is hidden in compact post-reveal progress. No open findings.
AUTHOR-1: narrow-screen hidden descriptions displaced the initial credit below
view; resolved by 7918c44. Rule-order compatibility retained by 291ccee.

## Verification

All six organisms passed loading and ready geometry/visibility checks at
375×812, 768×1024, 1280×800 and 1440×900; rendered screenshots inspected.
Reduced-motion and 959/960/1239/1240 px boundaries passed. Late-file loading
retains one header credit, and a failed load preserves organism navigation.
No unexpected console errors, page exceptions, failed requests or horizontal
overflow. Exact author text is outside the live progress region; semantic
snapshot and manual visibility/contrast checks passed. Axe is not installed.
No visual baselines changed.

npm test: 1,584 passed. pytest: 1,751 passed, 16 optional-input skips,
51 subtests passed. Data contract: 130 passed, one declared spliced-CDS skip.
Module-preload and diff-integrity checks passed. Runtime target 291ccee.
Transient evidence: /tmp/cyano-author-credit-20261013/.

## Cleanup

Reusable visibility, narrow-screen and accessibility rules are distilled into
progressive-loading.md and indexed. No unique reusable information remains
here. Remove this resolved ticket last. Publication and live verification follow
integration; preserve other sessions and their worktrees.
