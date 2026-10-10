# O_documentation-link-integrity__20261009 — Open

- **Scope:** Repair verified stale internal documentation links left by earlier ticket cleanup and validation-document renames.
- **Status:** open
- **Opened:** 2026-10-09
- **Updated:** 2026-10-09

## Current State

Found during tRNA-tab validation by DEM-341; `cyano-ui-fixes` independently
verified these 15 missing-file targets. They predate the tRNA placement change
and none occurs in its changed validation documents. Implementation is
unassigned. The worker also reported possible broken heading anchors; those
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
the tRNA integration baseline. No documents have been repaired by this ticket.
Before closure, verify relative paths and rendered Markdown anchors in the
changed documents and run the repository gates.

## Cleanup

The claiming session owns closure. Retain only reusable link-checking guidance
if needed; follow the resolved-ticket lifecycle and remove this queue row last.
