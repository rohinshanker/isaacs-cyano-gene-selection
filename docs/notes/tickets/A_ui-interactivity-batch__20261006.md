# A_ui-interactivity-batch__20261006 — Active

Scope: Coordinate the open UI/interactivity fixes in the canonical Desktop checkout.
Status: active
Opened: 2026-10-06
Updated: 2026-10-07

## Current State

Resumed at the owner's request. Final confirmation of the original interaction
fixes and completion of the preserved animation variants are active. Nothing has
been pushed or deployed.
Canonical repository: `/Users/Rohin/Desktop/coding_stuff/ISAACS-LAB/isaacs-cyano-gene-selection`, branch `main`.

Implemented and committed through `966dc85`: condition guides reaching the actual
count, responsive/keyboard/focus repairs, maximum-filter scrolling, per-source
provenance with compact contributing-source export summaries, instant exact-text
hints, one chromosome loading surface, concurrent retry/download bookkeeping,
truthful completion and persistent failure announcements. Three original UI
tickets remain Active until final independent confirmation and cleanup. Loading
correctness was approved by DEM-260; a separately verified folding bridge now
routes the remaining native meter through the chromosome activity surface.
The last guide focus repair covers responsive DOM order, scroll preservation,
sticky-header occlusion and fractional scroll rounding; final confirmation is
active in DEM-259.

Independent reviews DEM-259 (guides/export/hints) and DEM-260 (loading) were
cancelled during their confirmation passes. Their original findings were repaired;
no final approval was returned. Reuse these issues for fresh bounded confirmation
on the exact resumed patch. Original implementations/repairs are DEM-256/257/261.
Read the review threads before dispatching; do not duplicate active assignments.

The new animation ticket is [A_loading-scramble-and-progress__20261006](A_loading-scramble-and-progress__20261006.md).
Read-only architecture plan and baseline evidence are in DEM-262. DEM-263's
implementation was cancelled on pause. Multica automatically preserved its
uncommitted work as `1e432bc` (baseline `0ef6879`), also anchored by
`wip/ui-loading-animation-paused-20261006`. This is unreviewed, incomplete WIP:
12 files, query-only reveal/progress variants and coherent-block timing. Do not
cherry-pick it blindly to main. Resume in an isolated worktree, inspect its diff
and last tests, finish rendering/validation, then obtain the owner's visual
choice before changing production defaults. The managed worktree was removed.
A scoped binary patch and full run trace are saved under the artifact directory.
Focused WIP tests passed, and a first A/grouped desktop trace was captured; the
full variant matrix and full gates were not completed. WIP query selectors are
`load-review=a|b|c` and `load-progress=grouped|continuous` (with `load-log` for
measurement). These are preview selectors, not approved production defaults.

The owner explicitly leaves [O_ui-clutter-human-audit__20261005](O_ui-clutter-human-audit__20261005.md)
open for human marks. Its screenshot/text packet was prepared; final refresh was
interrupted by pause. Existing wording stays unchanged. Data Sources retains
its data-admission/statistical stages, and other scientific UI extensions retain
their recorded evidence/owner-decision gates.

## Verification

On integrated main application code (`a3efdd1`, with only a subsequent test-helper
change at `966dc85`): `npm test` 1,092 passed; pytest 486 passed, 1 skipped,
36 subtests; contract 110 passed, 1 skipped; preload/load-bar checks passed.
Rendered guide/hint checks pass at 375/768/1280/1440 and around 600/1320 breakpoints,
including grouped/flat/filtered/empty/max-filter/scroll/close/focus states. Loading
checks pass for default nonzero timing, fast downloads at four widths, failed-file
retry, reduced motion, chromosome deep link and E. coli. Unexpected runtime errors
were zero in these completed checks. Real iOS hardware was not verified.

Artifacts: `/Users/Rohin/Desktop/coding_stuff/ISAACS-LAB/isaacs-cyano-gene-selection/.playwright-cli/cyano-ui-fixes/`.
Key reports: `repaired-guides-report.json`, `final-hints-report.json`,
`final-loading-report.json`, `final-npm.log`, `final-pytest.log`,
`final-contract.log`. Saved animation work: `paused-animation.patch`,
`paused-animation-run.json`, and `animation-baseline/`.
Reusable browser checks are under `tools/ui/`; open the real app with
`?uiArtifacts=<absolute ignored artifact directory>` and use a unique Playwright
session/port after verifying server identity. No visual reference baselines changed.

The shared ticket checker passes its six configured scopes; this repository uses
both plain and bold metadata conventions, so a separate identity/field/index check
passed all 32 queue tickets before this coordinator ticket was added.

## Cleanup

After resume: finish confirmation of the original three fixes, finish the animation
comparison and owner's choice, rerun affected/full gates as needed, then apply the
normal R-rename/status/verification/distillation/deletion lifecycle. Keep the human
clutter ticket open until the owner supplies marks. Retain only reusable contracts
in validation docs; this handoff belongs in the active ticket until work completes.
