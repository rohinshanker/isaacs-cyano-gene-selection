# A_strain-fitness-dataset-selector__20261009 — Active

- **Scope:** Provide a dataset selector in Strain fitness when a suitable dataset has not already been selected elsewhere.
- **Status:** active
- **Opened:** 2026-10-09
- **Updated:** 2026-10-10

## Current State

Opened by `cyano-ui-fixes` at the owner's request. Claimed 2026-10-10 by
`cyano-ui-fixes` (`80c81443-1791314087`), which owns integration and closure.
Implementation runs in an isolated worktree from main `24490ea`; no other live
session is implementing this selector. The prior scoping owner completed only
its navigation/documentation batch and left this separate engineering task open. The existing Strain fitness panel has strain, condition,
and substrate/well filters over one loaded layer; these are not dataset choices.
No dedicated open ticket for this selector was found in the live queue.

Engineering scoping by `cyano-regulatory-sites` / DEM-346 on 2026-10-10:
the loader currently has one `strainFitness` file/slot and only Syn61 publishes
a whole-strain dataset. Existing `sources` / `typeSources` choices identify
gene-level datasets and cannot identify that payload. Completing this ticket
therefore requires a whole-strain dataset catalogue, compatible external-choice
representation, per-dataset load/retry state, and selection identity in both
strain exports, beyond adding a dropdown. Keep this as a separate engineering
task; it is not part of the small documentation/navigation batch. Existing
gene-fitness screens must remain incompatible with whole-strain selection.

Owner rule: **Strain fitness has its own dataset selector unless a dataset is
already selected elsewhere.** Reuse an existing compatible fitness selection
when it unambiguously identifies the dataset for this section. Otherwise expose
the local selector. A gene-expression, axis, or unrelated organism selection
does not count as a compatible strain-fitness choice.

## Acceptance

- Show the active dataset's identity and where its selection came from. Reuse
  a compatible selection from elsewhere without prompting for a
  duplicate choice; update when that selection changes.
- With no compatible external choice, let the reader choose among admitted
  strain-fitness datasets within this section. If multiple external choices
  leave the active dataset ambiguous, expose the selector rather than silently
  choosing or pooling them.
- Keep dataset selection distinct from the existing strain/condition filters.
  Reconcile those filters when the dataset changes, so stale IDs do not yield
  misleading results. Keep results, units, source disclosure, and exports tied
  to the dataset actually used.
- Use existing selection/loading infrastructure where compatible; preserve
  organism isolation and unrelated analysis state. Do not add whole-strain
  measurements to per-gene axes or merge them with gene-fitness screens.
- Handle zero, one, and multiple available datasets and loading/failure/retry
  states. Coordinate overlapping data/state edits with
  [the recoded-data owner](A_recoded-ecoli-multiomics__20261007.md) and
  [Data Sources](O_data-sources-selection__20261005.md); this ticket does not
  admit new datasets or take over their outstanding source work.

## Implementation findings

| ID | State | Requirement |
| --- | --- | --- |
| FDS-C3 | open | Real keyboard Space on the shared whole-strain checkbox moves focus to BODY after rerender. Keep focus on the matching control across shared/local choice and loader updates. |
| FDS-C4 | open | The dataset label must describe the whole study fitness collection, which includes controls and partially recoded backgrounds; calling it only Syn61 growth narrows the apparent measured scope. |
| FDS-C2 | open | A selected gene-level Nyerges source must never become a whole-strain choice through a catalogue alias. The external-selection path needs explicit whole-strain typing and a real shared-control route; synthetic browser cases must not relabel actual gene datasets as compatible. |
| FDS-C1 | open | The new per-dataset loader must verify response byte size and SHA-256 against the release manifest, including stale-cache reload and hard failure on mismatch; a digest in the URL alone does not establish integrity. |

## Verification

Ticket-only intake; the current UI has not changed. Intake validation on
2026-10-09 passed metadata/link checks and the repository gates: 1,395 JavaScript
tests; 925 Python tests and 36 subtests with one skip; 119 contract checks with
one declared skip. This validates the baseline, not the unimplemented selector.

For implementation, test no external selection, compatible selection, unrelated
selection, ambiguous selection, and later selection changes. Check filtering,
source/units/export consistency, organism switching, and missing/error states.
Render at mobile, tablet, and desktop widths, including keyboard selector use.
Run the gates in `AGENTS.md`.

## Cleanup

The implementing session owns closure and records every remaining finding.
Distill selection inheritance and provenance rules into
[strain-fitness.md](../../validation/strain-fitness.md) and the applicable
selection runbook; update the validation index and follow the required
resolved-ticket lifecycle.
