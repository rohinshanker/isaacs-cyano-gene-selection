# A_ui-interactivity-batch__20261006 — Active

Scope: Coordinate open UI/interactivity fixes in the canonical Desktop checkout.
Status: active
Opened: 2026-10-06
Updated: 2026-10-07

## Current State

Work is resumed on `main` in
`/Users/Rohin/Desktop/coding_stuff/ISAACS-LAB/isaacs-cyano-gene-selection`.
Committed fixes include condition guides reaching the count, responsive reading
order and visible row focus, maximum-filter scrolling, source provenance and
compact export summaries, exact-text instant hints, and a single chromosome bar
for staged files, downloads, retries and RNA folding. Post-settle file requests
start another cycle on that same surface; concurrent work excludes old-cycle
bytes. No changes have been pushed or deployed.

Original loading correctness was accepted by DEM-260. DEM-259 is confirming the
last row-focus repair at `d5efb53`; other guide/export/hint findings were accepted.
DEM-267 independently reviews the completed query-only animation variants.
`e410150` additionally constrains animation width reservations during responsive
reflow; `a9ccd3b` and `1f7aba4` cover post-settle loader requests. Confirm those
small follow-up commits on the final combined tree before resolving loading.

The animation implementation is integrated. The owner's reveal choice (A/B/C)
and progress choice (grouped/continuous) remain pending; production defaults
stay unchanged. The review packet and six live URLs are in
`.playwright-cli/cyano-ui-resume/animation/owner-choice.md`, served at port 8786.
Valid 24-scenario evidence is under `cyano-ui-fixes/dem263-resume/matrix/`;
`matrix-invalid-hashnav/` is diagnostic-only and excluded.

The human clutter audit stays open for marks, as explicitly requested. Its
refreshed 20-render/211-entry packet is under `cyano-ui-resume/`. Data Sources
and scientific UI extensions retain their recorded admission and owner gates.
The payload sidecar is owned by `cyano-contract-audit`/DEM-266. This stream must
not edit its payload, pipeline, budget or size contract; verify manifest-related
loading after that coordinator integrates its result. That coordinator owns
`tickets/INDEX.md`, including cleanup row removals.

## Verification

Combined gates: JavaScript 1,108 passed; Python 486 passed, 1 skipped,
36 subtests; contract 110 passed, 1 skipped. Final full gates are being checked
against the final follow-up tree. Focused interaction/scramble/loading tests:
83 passed; post-settle and concurrent-resource loading tests: 31 passed.
Rendered guide/focus states pass at 375/768/1280/1440 and 599/601/1319/1321,
with no runtime errors. Real post-settle requests return the one chromosome bar
and name the file at all four widths; completion, failure/retry, reduced motion,
chromosome deep link and E. coli navigation pass in production and A/grouped.
Real iOS hardware was not available.

Artifacts: `.playwright-cli/cyano-ui-resume/`, particularly
`guides-row-context-report.json`, `final-focused-tests.log`,
`late-cycle-tests.log`, `late-default-report.json`, `late-requests-report.json`,
`combined-npm.log` and `combined-contract.log`. Original and folding evidence
remain under `.playwright-cli/cyano-ui-fixes/` and `.playwright-cli/dem-265-folding-8792/`.
Reusable UI checks live under `tools/ui/`; use a unique browser session and
verified server with an absolute ignored `uiArtifacts` directory.

## Cleanup

Resolve accepted original UI tickets after final confirmation and gates. Keep
reusable rules in the existing validation documents and complete the normal
R-rename/status/verification/deletion lifecycle, coordinating INDEX removals
with its owner. Animation remains active until the owner's visual choice is
applied and verified. Keep the clutter audit open for human marks.
