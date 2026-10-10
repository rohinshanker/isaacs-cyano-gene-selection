# A_trna-viewer-tab__20261009 — Active

- **Scope:** Give the tRNA viewer its own application tab.
- **Status:** active
- **Opened:** 2026-10-09
- **Updated:** 2026-10-09

## Current State

Owned by `cyano-ui-fixes`; implementation begins after the worktree audit.
A scoped implementer uses its own worktree; this session retains integration,
independent review, owner preview and closure. PCA wheel zoom remains owned
by `cyano-regulatory-sites` in its separate worktree. At baseline `4ad4163`, the tRNA viewer is embedded below the
CDS viewer in Chromosome/Gene. Move the full tRNA viewer into a separate
application tab, using the existing tab framework.

## Acceptance

- Provide a clearly named tRNA tab containing its track, search/filter controls,
  locus list, and independent sequence/detail view. Avoid duplicating the full
  viewer in Chromosome/Gene.
- Preserve the existing annotation/source labels, genomic versus model-effective
  anticodons, transcription-oriented sequence, and hidden-by-default predicted
  candidate. This is a placement change, not new biological evidence.
- Keep tRNA selection independent of protein-gene pinning, shortlist, filters,
  and metrics. Preserve supported tRNA state when switching tabs.
- Define how native-coordinate navigation reaches the chromosome view and how
  any retained chromosome tRNA overlay shares the coordinate window without
  sharing protein-gene selection.
- Integrate tab routing, active-tab indication, direct links, reload, and
  keyboard navigation. Keep unavailable, loading, failure/retry, and ready states
  truthful for each organism; request only declared tRNA inputs.

## Verification

Ticket-only intake; the current UI has not changed. Intake validation on
2026-10-09 passed metadata/link checks and the repository gates: 1,395 JavaScript
tests; 925 Python tests and 36 subtests with one skip; 119 contract checks with
one declared skip. This validates the baseline, not the unimplemented tab.

Before implementation closure, use the UI render skill to exercise the tRNA tab
and return to Chromosome/Gene at mobile, tablet, and desktop widths. Check search,
filters, selection, coordinate navigation, source details, candidate visibility,
keyboard focus, direct links/reload, and unavailable/loading/error states. Run
the gates in `AGENTS.md`. Before resolving this tRNA viewer ticket, open the
localhost preview for the owner to view, as required by their earlier decision.

## Cleanup

The implementing session owns closure and records every remaining finding.
Update [chromosome-view.md](../../validation/chromosome-view.md),
[trna-annotation-validation.md](../../validation/trna-annotation-validation.md),
and the tab-state runbook with reusable placement/state rules; update the
validation index and follow the required resolved-ticket lifecycle.
