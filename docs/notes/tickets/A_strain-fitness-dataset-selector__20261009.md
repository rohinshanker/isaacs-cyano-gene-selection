# A_strain-fitness-dataset-selector__20261009 — Active

- **Scope:** Provide a dataset selector in Strain fitness when a suitable dataset has not already been selected elsewhere.
- **Status:** active
- **Opened:** 2026-10-09
- **Updated:** 2026-10-10

## Current State

Owned by `cyano-ui-fixes` (`80c81443-1791314087`), which owns integration
and closure. Runtime implementation is committed as `824793e` in the isolated
`work/strain-fitness-selector-20261010` worktree. Multica DEM-350 implemented
it; independent Claude review DEM-354 returned the findings below; repairs and targeted confirmation are in progress. This ticket remains
active until that audit is resolved.

The panel now uses an organism-owned catalogue and lazy, independently
validated load records. Data Sources exposes a separately typed whole-strain
choice; no per-gene source alias can inherit into the panel. Both exports name
the actual dataset and selection origin. No measurements or new datasets were
admitted.

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
| FDS-R8 | open | Final review's non-blocking harness notes: reset the retry resolver between scenarios and measure overflow in the malformed-fitness map render. |
| FDS-R1 | open | Retry loses keyboard focus when its button is replaced during loading and success; restore a stable panel focus target and test real keyboard retry. |
| FDS-R2 | open | Schema and rejected-fetch errors must name the selected catalogue id and actual file, never a hardcoded filename or an unqualified transport message. |
| FDS-R3 | `2b7d5f5` | Replace task-specific runbook commands and narration with reusable instructions. |
| FDS-R4 | open | Record the deliberate URL policy for the effective default dataset id, including reproducibility when catalogue order changes. |
| FDS-R5 | open | Remove the now write-only panel `built` flag. |
| FDS-R6 | open | Remove the duplicate absent-state harness assertion. |
| FDS-R7 | open | Use reader-facing selection-origin labels in the context status line. |
| FDS-C5 | open | Restore the real-browser regression proving a malformed fitness dataset leaves the gene map usable. |
| FDS-C3 | open | Real keyboard Space on the shared whole-strain checkbox moves focus to BODY after rerender. Keep focus on the matching control across shared/local choice and loader updates. |
| FDS-C4 | open | The dataset label must describe the whole study fitness collection, which includes controls and partially recoded backgrounds; calling it only Syn61 growth narrows the apparent measured scope. |
| FDS-C2 | open | A selected gene-level Nyerges source must never become a whole-strain choice through a catalogue alias. The external-selection path needs explicit whole-strain typing and a real shared-control route; synthetic browser cases must not relabel actual gene datasets as compatible. |
| FDS-C1 | open | The new per-dataset loader must verify response byte size and SHA-256 against the release manifest, including stale-cache reload and hard failure on mismatch; a digest in the URL alone does not establish integrity. |

## Verification

Implementation `824793e` passed 1,489 JavaScript tests; 958 Python tests
and 46 subtests, with one declared skip; annotation verification/reproduction
and readiness checks; and contract/live-metric checks for all five organisms.
The RNA browser gate passed all 32 parity cases, lifecycle, UI source coverage,
exports and breakpoint checks with no unexpected diagnostics.

The real browser covered local and shared selection, URL restore, foreign
organism rejection, missing/error/retry states, multiple and ambiguous synthetic
catalogues, races, filters, both exports, keyboard operation and focus. Renders
at 375, 768, 1280 and 1440 px plus 959/960 and 1239/1240 edges passed without
page overflow or unexpected browser errors. Screenshots were inspected.
The independent export oracle preserved measurement rows, units and source
headers for 65 selections. Actual browser downloads retained all 69 growth
records and 5,280 wells. No formal axe audit was run; the repository does not
install axe. No visual baselines changed.

Transient evidence is in `/tmp/cyano-fitness-selector-20261010/`;
`coordinator-evidence.md`, `implementer-evidence.md`, the browser outputs and
`release/results.json` identify the exact commands and artifacts. Independent
review and ticket closure are still pending.

## Cleanup

The implementing session owns closure and records every remaining finding.
Distill selection inheritance and provenance rules into
[strain-fitness.md](../../validation/strain-fitness.md) and the applicable
selection runbook; update the validation index and follow the required
resolved-ticket lifecycle.
