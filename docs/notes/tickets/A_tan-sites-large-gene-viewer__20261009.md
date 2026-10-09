# A_tan-sites-large-gene-viewer__20261009 — Active

- **Scope:** Make the admitted Tan initiation sites appear reliably in the larger gene sequence visualizer.
- **Status:** active
- **Opened:** 2026-10-09
- **Updated:** 2026-10-09

## Current State

Owned by `cyano-ui-fixes` for implementation, integration and closure. Work started
2026-10-09 under the owner's request to complete unblocked tickets. The owner wants Tan initiation sites on the **larger gene
visualizer**, interpreted as the sequence close-up below Chromosome/Gene.

At baseline `d507cfd`, this viewer already has a Tan marker adapter, an independent
**Show Tan 2018 start sites** control, and native-coordinate placement. Its
sequence follows the pinned gene, not a hovered gene. The ticket therefore owns
the reported visibility/discoverability issue, including whether the selected
gene, upstream extent, loading state, saved marker visibility, or camera window
explains missing marks. Source inspection has not reproduced the owner's screen
or established the cause. Reuse the admitted Tan data and existing implementation.

## Acceptance

- Reproduce the reported absence in the real larger viewer and make placeable
  Tan sites clearly visible for the selected gene. Keep the show/hide control
  discoverable, with state independent of the smaller viewer and chromosome
  track; distinguish a saved hidden state from missing evidence.
- Check the initial 30-nt upstream extent and the adjustable larger windows.
  If a site lies outside the shown sequence or camera window, explain that and
  offer the existing window/navigation controls; do not imply that no site exists.
- Place sites at their published native genomic coordinates on the corresponding
  sequence bases. Retain published gene-model distances separately, including
  any placement discrepancy. Never move an out-of-range site onto an unrelated
  base or borrow coordinates from another strain.
- Preserve source/condition details, overlapping-site inspection, hover and
  keyboard outlines, and the complete site list. Keep absent, loading,
  failure/retry, hidden, and unplaceable states distinct.
- Preserve sequence navigation, recoding display, pinned-gene behavior, and
  independent marker visibility through gene changes, tab changes, reload,
  and shared links. This ticket does not calculate or admit new predictors.

## Verification

Ticket-only intake; no UI behavior or data has changed. Intake validation on
2026-10-09 passed metadata/link checks and the repository gates: 1,395 JavaScript
tests; 925 Python tests and 36 subtests with one skip; 119 contract checks with
one declared skip. This validates the baseline, not a repair of the reported UI.

Before closure, use the UI render skill at mobile, tablet, and desktop widths.
Check a locus with a site inside the short window, one requiring a larger upstream
window, overlapping sites, both strands, and a locus with no mapped site. Exercise
pin versus hover, camera reset/pan, marker visibility, source details, keyboard
focus, reload, and loading/failure states. Run the gates in `AGENTS.md`.

## Cleanup

The implementing session owns closure and records every remaining finding.
Distill any corrected visibility/window rules into
[gene-sequence-closeup.md](../../validation/gene-sequence-closeup.md) and the
marker-state runbook; update the validation index and follow the required
resolved-ticket lifecycle.

## Related predictor status at intake

[The selected-methods ticket](A_regulatory-methods-shortlist__20261008.md) and
[regulatory-methods.md](../../validation/regulatory-methods.md) record source and
runtime assessments, not new admitted regulatory-site outputs. RBS code/API
access remains open, and iDOG retains the owner's review hold. Existing ViennaRNA
folding and tRNA validation do not constitute newly published regulatory-site
prediction layers. The computed-tag/overlap/hover display contract is implemented;
method-specific producers and their evaluated outputs remain separate work.
