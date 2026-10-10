# A_documentation-link-integrity__20261009 — Active

- **Scope:** Repair verified stale internal documentation links left by earlier ticket cleanup and validation-document renames.
- **Status:** active
- **Opened:** 2026-10-09
- **Updated:** 2026-10-10

## Current State

Claimed by `cyano-regulatory-sites` (session `e6e54b6e-1791581192`) on
2026-10-10 for isolated delegated implementation. Coordinator branch
`work/small-unblocked-20261010`, baseline `5431386`. Other chat worktrees,
browsers and processes are out of scope.

Found during tRNA-tab validation by DEM-341; `cyano-ui-fixes` independently
verified these 15 missing-file targets. They predate the tRNA placement change
and none occurs in its changed validation documents. Implementation is delegated under the coordinator above. The worker also reported possible broken heading anchors; those
need a Markdown-aware verification before they are treated as defects.

| Source file | Missing target |
| --- | --- |
| `docs/notes/handoff/RET_claude-science-session__20260930.md` | `../tickets/A_zoomed-out-visual-priority__20260929.md` |
| `docs/notes/handoff/RET_claude-science-session__20260930.md` | `../tickets/O_pinned-gene-sequence-viewer__20260930.md` |
| `docs/notes/handoff/RET_claude-science-session__20261003.md` | `../../validation/AAA-biological-decisions-to-review.md` |
| `docs/notes/handoff/cyano_owner_decision_worklist_20261005.md` | `../../validation/AAA-biological-decisions-to-review.md` |
| `docs/notes/handoff/cyano_owner_decision_worklist_20261005.md` | `../tickets/O_fitness-screen-data-type__20261005.md` |
| `docs/notes/handoff/RET_claude-science-session__20260928.md` | `../tickets/O_claude-science-offload__20260927.md#confirmed-2026-09-28` |
| `docs/notes/handoff/RET_claude-science-session__20260928.md` | `../tickets/O_agent-topology-and-handoff__20260928.md` |
| `docs/notes/handoff/RET_claude-science-session__20261004.md` | `../../validation/AAA-biological-decisions-to-review.md` |
| `docs/validation/source-derived-categories.md` | `AAA-biological-decisions-to-review.md` |
| `docs/validation/pcc-essentiality.md` | `AAA-manual-review-checklist.md#2-review-the-actual-biological-panel` |
| `docs/validation/AAAA-new-bio-decisions-to-review.md` | `../notes/tickets/O_trna-identification-viewer__20260930.md` |
| `docs/validation/AAAA-new-bio-decisions-to-review.md` | `AAA-manual-review-checklist.md#2-review-the-actual-biological-panel` |
| `docs/validation/AAAA-new-bio-decisions-to-review.md` | `AAA-biological-decisions-to-review.md` |
| `docs/validation/current-design-answers.md` | `AAA-biological-decisions-to-review.md` |
| `docs/validation/current-design-answers.md` | `AAA-manual-review-checklist.md` |

## Acceptance

- Replace stale links with the current reusable contract or preserved handoff
  section that carries the same decision or evidence. Do not resurrect resolved
  tickets solely as link destinations.
- Preserve source claims, owner decisions, admission boundaries and frozen
  handoff wording; change only the link destination or a necessary short label.
- Verify each destination and heading. Inventory any confirmed remaining anchor
  defects rather than accepting the earlier checker's count uncritically.

## Verification

A fresh file-existence walk confirmed the listed targets are absent on main and
the tRNA integration baseline. On 2026-10-10, the 15 listed links were repointed
to their current validation contracts or preserved sections. A scoped checker
resolved every relative file target and GitHub-style heading fragment in all
nine affected documents. It also recognizes explicit HTML anchors: the earlier
suspected `#what-must-not-land-without-a-claude-science-claim-or-package`
finding is valid because `claude-science-handoff.md` preserves that exact anchor.
No additional file or anchor defects remain in the affected documents.

The coordinator still owns the repository-wide gates and ticket closure.

## Cleanup

The claiming session owns closure. Retain only reusable link-checking guidance
if needed; follow the resolved-ticket lifecycle and remove this queue row last.
