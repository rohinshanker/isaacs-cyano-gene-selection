# O_ui-clutter-human-audit__20261005 — Open

- **Scope:** A person, not an agent, walks the rendered site and marks what can be
  removed, merged, or moved behind a help icon, so that explanation stops competing
  with the data. Agents prepare the walk and apply the marked changes. Covers
  `site/` and the validation documents that fix the affected wording.
- **Status:** open
- **Opened:** 2026-10-05
- **Updated:** 2026-10-05

## Current state

Opened at the owner's request, for later. It is not started and blocks nothing. The
owner's rule, given 2026-10-05: tooltips and explanations are welcome when they
disturb the interface as little as possible. A small help or info icon opens a
popover on hover or click; a longer explanation opens in a side or centre peek. The
audit applies that rule to what is already shipped and to the Data Sources section
once it exists.

## Work

1. **Prepare.** Agents capture every view at desktop and tablet widths and list each
   standing explanatory line, caption, legend note and caveat with its location and
   the contract clause that requires it, if one does.
2. **Walk.** The owner or a labmate marks each item: keep as is, move behind an
   icon, move into a peek, merge, or remove. The annotated-screenshot review in the
   agents' browser tooling can collect the marks on the live page.
3. **Apply.** One change per view. A caveat the data contract requires may move
   behind an icon but is never deleted, and its accessible text stays reachable by
   keyboard and screen reader.

## Verification

Not started. Each applied change is rendered at mobile, tablet and desktop widths
and re-checked by the person who marked it. The gates run after each change.

## Cleanup

On resolution, record the help-icon and peek pattern in
[responsive-workspace.md](../../validation/responsive-workspace.md), update
`validation/INDEX.md` if its row changes, then delete this ticket and its index row.
