# A_ui-closeout-safe-batch__20261007 — Active

Scope: Coordinate isolated UI closeout, implement clear presentation requests, collect pending owner decisions, and verify inherited mobile Data Selection findings.
Status: active
Opened: 2026-10-07
Updated: 2026-10-07

## Current State

Owner: `cyano-source-ingestion` (80c81443-1791314087). Canonical repository:
`/Users/Rohin/Desktop/coding_stuff/ISAACS-LAB/isaacs-cyano-gene-selection`.
Coordination worktree: `../worktrees/ui-closeout-20261007`, branch
`work/ui-closeout-20261007`, base `cd66c5753c77f4564b2e58b443abe9918f289f22`.
Keep main and other sessions' files, servers, and browser sessions untouched.

First implementation slice: Compare Measurement Limits disclosure; rename/order
Chromosome/Gene third after Metric X vs Y; group chromosome marker, replicon, and
coordinate-transfer copy in a collapsed Chromosome Viewer Info disclosure.
Implemented on local result `699b389ee4ed57ec2dc7afadfe5c4f301de7ed5d`, including
the scoped Data Selection wrapping/hover repairs and corrected loading helper.
Independent exact-patch review: DEM-307 approved cd66c57..699b389 with no material
defects; all seven acceptance criteria hold. Main remains untouched by this
session; the patch is available for coordinated integration after review.

Chromosome performance remains open and is now reproduced in default UTEX at
1440×900, Chromium/normal CPU, local data, empty shortlist and inactive recoding.
Repeated warm measurement changes spend 1.78–1.80s synchronously for protein,
1.92–1.93s for initiation and 2.47–2.48s for transcript abundance. A CPU sample
of abundance spent 2.53s in the change event, with repeated `typeGroups` calls
at core/type-metrics.js:66 dominating the sampled time; app.js `contributing`
and pooled-metric provenance/read getters also contribute. This isolates a warm
processing bottleneck; it is not a completed cold-load/pan/hover profile or fix.
Reports: chromosome-default-profile.txt and chromosome-cpu-profile.txt in the
task artifact directory. Exact original four-dataset/device context is optional
and still requested from the owner.
Original UI tickets remain under their opening session until ownership transfers;
do not delete or close another session's ticket. Return exact patch and rendered
evidence before integration. No data, scientific method, or pooling changes.

Local integration/closure ownership for the three original presentation tickets
has been asked explicitly because project AGENTS.md reserves closure to their
owning session. It remains pending; no original ticket has been closed.
Canonical main currently has an active proteomics ingestion staged/in progress,
including type-metrics and release payload changes. Keep this branch isolated;
coordinate a clean integration point with that owner and rerun combined gates
against the resulting main baseline rather than disturbing their index.

DEM-307 observations retained with the approved result:

- UI-REVIEW-1 open: pre-existing shared active-chip hover contrast remains poor
  outside `.data-selection`, including the organism header and condition grid.
- UI-REVIEW-2 open: the order-insensitive ALL_TABS copy in
  tests/js/organism-isolation.test.mjs:66 still uses the old order.
- UI-REVIEW-3 open: the wrapping helper documents its default-UTEX requirement but
  has no early guard; an E. coli caller receives a locator timeout.
- UI-REVIEW-4 informational: `clippedChips` guards possible truncation but does
  not cover the present overlap defect. The identity-geometry and contrast checks
  are proven by the reviewer's mutation probe: reverting the CSS produces 24
  overflowing rows at 375px and changes contrast from 7.02 to 1.178.

These do not block the approved bounded UI slice; the parent stays active.

Owner questions submitted together: independent X/Y/PCA committed selections;
loading reveal and progress defaults; RBS method, scope, outputs, computation and
exploratory-evidence policy; tRNA proposal review; original-source downloads;
remaining human clutter marks; chromosome lag interaction/environment details.
Additional question: expand, adjust, or retain the current 30 upstream bases for
Tan sites outside the shipped sequence extent.
Owner answer 2026-10-07: offer an adjustable upstream window. This choice is
resolved; extend pinned native sequence coverage and controls under the existing
coordinate/evidence contract. Retain 30 bases as the initial setting unless the
implementation's verified usability requires a different proposed default.
Clear placement/disclosure requests need no additional product clarification.

Contract-audit session confirmed base cd66c57 and owns no in-flight site files.
Its package E closure preserves three unassigned 375px mockup findings:
UI-MOBILE-1 condition strip clipped after light column; UI-MOBILE-2 spectrum code
overlaps light-regime bar; UI-MOBILE-3 phase chips truncate. They were checked
against the current panel and not reproduced: the condition table scrolls to its
last column and spectrum/phase copy wraps. Original mockup observations remain
preserved in canonical `docs/validation/comparability-pilot-evidence.md`; a later
change to that mockup still needs its own verification.
Other session coordination messages encountered occupied composers; no duplicate
send or composer manipulation attempted.

Live inspection at base cd66c57 found the condition table horizontally scrollable
at 375/768px, with spectrum/phase text wrapping, so UI-MOBILE-1/2/3 are not yet
reproduced in the inspected current rows. A distinct defect, UI-MOBILE-4, resolved
by `02b1a6d`:
long strain chips in the dataset identity flex row force it wider than its cell;
GSE311172_ad2_0_o2 measures 494px inside a 125px identity row at 375px viewport.
Repair is limited to shrinking the identity flex child and wrapping its chips.
UI-MOBILE-5 resolved by `02b1a6d`: selected data-type tabs showed white text on the pale hover
background (rgb 228,238,243). A scoped active-hover rule retains the accent
background. The rendered regression checks both label geometry and text contrast.
UI-VALIDATION-1 resolved by `00c4cb7`: the existing chromosome/loading helper used the ignored
`?organism=` parameter and therefore falsely calls a UTEX render E. coli. Repair
uses canonical `?org=`, normalizes the default route, and asserts organism identity.

## Verification

Final code result 699b389: npm test 1,274 passed; pytest 768 passed, 1 skipped,
36 subtests; validate_contract 116 passed, 1 declared contiguity skip. The initial
worker Python gate lacked ignored raw sources; existing pinned canonical inputs
were linked into this isolated worktree for the passing combined gate.

Actual published UTEX and E. coli data rendered at 375×812, 768×1024, 1280×800,
1440×900. Both disclosures start closed and show full current text when opened;
keyboard collapse and tab identity/order pass, with no page overflow or runtime
errors. Worker additionally checked no-limit absence, tab arrow keys, live
zoom/filter/marker/colour updates and breakpoint sides. Its transient artifact
directory was removed at run cleanup; coordinator regenerated durable screenshots
and semantic snapshots for the final combined patch. Data Selection wrapping
matrix covers three data types, 1319/1321 widths, readable selected hover at
7.02:1, horizontal condition access and Escape/focus restoration; diagnostic
failure injection is caught. Corrected loading helper passes downloads at four
widths, failure/Retry, reduced motion, deep link and asserted E. coli identity.

Application: http://127.0.0.1:8792/ from this worktree, verified by listener cwd.
Artifacts: `.playwright-cli/cyano-ui-closeout-20261007/`, including combined-render,
wrapping, loading-helper and diagnostic-probe reports, full gate logs, final
disclosure images and semantic snapshots. No dependency or baseline changes;
automated axe is unavailable, so accessibility checks use native semantics,
keyboard/focus, rendered visibility and contrast. No physical iOS hardware check.

## Cleanup

Before closing, record closing session/date and disposition of every open finding.
Retain pending owner questions and unresolved UI findings in their owning tickets.
Distill reusable contracts into docs/validation, update its index, then perform
R-rename/status/validation and delete this ticket and its queue row last.
