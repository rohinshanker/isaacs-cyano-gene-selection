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

Implemented by `codex-implementer` on 2026-10-09 for DEM-334; coordinator
integration and closure remain pending. The initial 30-nt sequence remains the
default. When an admitted site is outside it but placeable in an existing exact
sidecar, the control and complete site list remain discoverable, the status names
the current-window reason, and **Show nearest site** expands to the smallest
declared window that can reveal it. Repeated **Show next site** actions reveal
successively more distant rows; **Go to nearest site** centres an already drawn,
off-camera mark. Missing-coordinate, wrong-replicon and otherwise unreachable
rows are counted separately from rows a larger exact sequence can reveal, and
retain their row-level reason. Hidden state remains distinct and disables
navigation.

Real data checks covered plus-strand `M744_RS00025` (30→60 nt reveal),
minus-strand `M744_RS00045` (30→60→500→1,000 nt), overlapping rows at
`M744_RS10630`, narrow-camera navigation and hidden state. Real-browser checks
passed at 375×812, 768×1024, 960×900, 1240×900, 1280×800 and 1440×900 with no
horizontal overflow, console error or failed request. Keyboard paths passed;
touch tapping remains unverified because the available browser context did not
expose touch input.

Final repository gates passed after copying the canonical checkout's verified,
gitignored raw inputs into this isolated worktree: 1,402 JavaScript tests; 938
Python tests and 36 subtests with one skip; 119 contract checks with one declared
skip. The implementation reuses the admitted Tan data; no scientific source,
coordinate, evidence row or admission changed.

Before closure, use the UI render skill at mobile, tablet, and desktop widths.
Check a locus with a site inside the short window, one requiring a larger upstream
window, overlapping sites, both strands, and a locus with no mapped site. Exercise
pin versus hover, camera reset/pan, marker visibility, source details, keyboard
focus, reload, and loading/failure states. Run the gates in `AGENTS.md`.

## Cleanup

The coordinator owns closure and records every remaining finding.
Distill any corrected visibility/window rules into
[gene-sequence-closeup.md](../../validation/gene-sequence-closeup.md) and the
marker-state runbook; update the validation index and follow the required
resolved-ticket lifecycle.

## Integration findings

- **TAN-2:** mixed expandable and permanently unplaceable rows are counted
  separately by `cd7e8ef`; no larger-window promise is made for an unreachable row.
- **TAN-3:** repeated keyboard reveals on `M744_RS00045` lost focus to the checkbox
  after the first expansion. The repair retains action focus while further
  navigation remains and returns to the checkbox when the action finishes or is
  disabled. Final validation and independent review are pending.

## Related predictor status at intake

[The selected-methods ticket](A_regulatory-methods-shortlist__20261008.md) and
[regulatory-methods.md](../../validation/regulatory-methods.md) record source and
runtime assessments, not new admitted regulatory-site outputs. RBS code/API
access remains open, and iDOG retains the owner's review hold. Existing ViennaRNA
folding and tRNA validation do not constitute newly published regulatory-site
prediction layers. The computed-tag/overlap/hover display contract is implemented;
method-specific producers and their evaluated outputs remain separate work.

- **DEM-336-F1:** camera-only completion dropped focus to the document. Fixed by
  `f531145`; unit and real-browser completion/focus regressions pass.
- **DEM-336-F2:** repeated camera actions alternated between the nearer pair of
  three sites. The action now advances through transcription order and wraps;
  labelled **Go to next site**, with two complete cycles tested on both strands
  and in the browser. Final review pending.
- **DEM-336-F6:** the long navigation-status layout lacked mobile/tablet evidence.
  The browser contract now captures it at 375, 768 and 1440 px and checks overflow;
  emulated-touch marker/pan checks are recorded separately. Final review pending.
