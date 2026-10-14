# R_regulatory-methods-shortlist__20261008 — Resolved

Scope: Complete the selected regulatory-method assessment and reproducible native-UTEX pilots, with independent review and explicit transfer/evaluation limits.
Status: resolved
Opened: 2026-10-08
Updated: 2026-10-14

## Outcome

**Closed by `cyano-regulatory-sites` on 2026-10-14**, after the owner requested
completion and every implementation/review finding was resolved. Work remains in isolated worktrees; other Agent
Deck sessions have not been contacted or interrupted. Canonical baseline was
`40047f0`; the coordinator merged other-session main through `b4092f5` without
changing its work. No browser regulatory layer is admitted by this ticket.

Six selected methods now have executable, source-pinned non-release pilots:
Promoter Calculator, standalone TransTermHP, STREME, Rfam/Infernal RF01116,
ViennaRNA accessibility and IntaRNA. The owner permits very rough native-sequence
predictions using models/evidence from other bacteria without UTEX calibration;
that limits claims, rather than prohibiting exploratory calculations.

The [RBS Calculator ticket](O_rbs-calculator-gene-visualizer__20260930.md) stays
open for the missing complete code. The [iDOG ticket](O_idog-promoter-prediction__20260930.md)
stays open under the owner's execution/closure hold. FIMO and an SD-only substitute
remain unselected. Neither a donor coordinate nor a protein orthologue establishes
a native regulatory interval.

All six executable pilot scopes are complete. DEM-397, DEM-398 and DEM-399
accepted the exact new producer repairs; the earlier Promoter preparation,
TransTermHP and Rfam reviews remain accepted. All repository gates pass, with
only the declared source-cache/contiguity skips below.

## Current Evaluation Evidence

- **Promoter Calculator:** all 2,475 admitted Tan gTSS anchors considered;
  1,597 windows selected before scoring, excluding 613 repeated loci, 264
  overlapping windows and one duplicate sequence. With explicit numerical ties,
  native any/all best starts within five bases are **900/890**, controls **398/383**;
  median anchor ranks are **6/22**. These are cohort localization/ranking results,
  not genome-wide specificity or calibrated UTEX strength. Corrected report
  SHA-256 `f4021ed3941a66b656df9e40f4a6a406b4cf59c651ec00dd7c54865080ebbc5f`.
  DEM-398 independently accepted `194397c` at integration snapshot `f8d4700`;
  all raw score curves remain unchanged from the initial run.
- **Standalone TransTermHP:** three-replicon native/shuffle pilot yields
  **860/319** candidates. Native sequence and hairpin/tail scoring were independently
  checked. Intrinsic-only scope, annotation-dependent null and uncovered
  origin-spanning intervals remain explicit. DEM-372 accepted all repairs.
- **STREME:** 400 discovery and 200 external windows, with 1,548 locus/overlap/
  similarity blocks over 2,475 anchors. External/native and null-trained shuffle
  AUCs are **0.624425/0.52345**, but three matched genomic samples give gTSS-vs-genomic
  AUCs **0.4801375/0.46725/0.51885**. The motif therefore has **no demonstrated TSS
  specificity** in these comparisons. Genomic-vs-shuffle AUCs are
  **0.6107875/0.6504125/0.596825**. All 908 sampling decisions, exclusions and scores
  were independently replayed. The original planted motif recovers a shifted
  **7/8 bases**, not its exact consensus. DEM-398 accepted `82ac870` (worker `720cd21`).
  Corrected result SHA-256 `c8b2647f5763513b11788c201e068730474ab214bc50c58d34eed24bc54a4600`.
- **Rfam/Infernal:** RF01116 returns one native 63-nt plus-strand homology interval,
  `NZ_CP006471.1:1364716–1364778`. Family homology does not establish full transcript
  ends or regulatory function. DEM-375 accepted all coordinate/provenance/I/O repairs.
- **ViennaRNA accessibility:** six native windows yield **2,313** exact segment
  probabilities, including nine origin-crossing segments, independently checked
  against native extraction and the actual engine. Window/temperature sensitivity
  can reverse native-vs-shuffle ranking; accessibility alone does not identify a
  regulatory site. DEM-397 accepted `6630492` (worker `bd4beb1`) after repeating all
  three original findings; **93 focused tests pass**, and baseline/45°C TSVs remain
  byte-identical to their original numerical outputs.
- **IntaRNA:** the initial isolated v3.4.1 runtime passes upstream API/CLI checks
  (3,859 assertions/30 API cases). The bounded three-query-window by three-target
  pilot gives default interactions **5/9**, shuffled **8/9**, disrupted **4/5**,
  whole-input-window folding **6/9**, and six-base seed **8/9**. All default ±50-nt
  query-window interactions lie outside the RF01116 core. These are computational
  window interactions, not recovered or validated native targets. Repair `b636f02` (worker `a01bd6e`) preserves all numerical results, adds
  explicit personality and runtime identity, and passes **94 focused tests**.
  Rebuilt upstream API/CLI checks pass; DEM-399 independently accepted all five
  repair findings at `b636f02`. Default/renamed regular copies retain 44 runs and
  32 interactions; real SIGTERM/SIGINT timing probes leave no partial outputs,
  scratch or orphaned owned children.

These final Promoter/STREME summaries supersede earlier counts/interpretations.
Raw reports and receipts are under `/tmp/cyano-regulatory-completion-20261014/`;
portable recipes, identities, source evidence and scientific limits are distilled
in the linked validation contracts, not dependent on that temporary directory.

## Findings and Review Ownership

| Finding identifiers | Resolution / remaining owner |
| --- | --- |
| P1, P2, P3, P4, P5 | `4c59426`; original Promoter context, pin, path, host-label and source fixes accepted by DEM-371. |
| P6 | `ab1a471`; documentation/current-state fix accepted by DEM-371. |
| TT1, TT2 | `ba6f70b`; FASTA/header and partial-write fixes accepted by DEM-372. |
| TT3, TT4, TT5, TT6, TT7 | `e6f13bb`; annotation, boundary, digest, build and pin-contract fixes accepted by DEM-372. |
| TT8, TT9, TT10, TT11, TT12 | `bb1038b`; schema, compatibility, parent errors, cleanup and one-base-minus handling accepted by DEM-372. |
| RF1, RF3, RF4, RF5, RF6, RF7 | `7f460a7`; pins, provenance, source terms, circular/raw coordinates and shuffled labels accepted by DEM-375. |
| RF2 | `7f460a7`, final partial-write repair `0fd5e35`; accepted by DEM-375 with real OS failure probes. |
| V1 | `ab1a471`; segment-end indexing, padding and all-A oracle preserved in the accessibility contract. |
| S1 | `366921a`, retained by `82ac870`; quantitative shifted 7/8 recovery replaces the exact-consensus claim; DEM-398 independently verified it. |
| PR1, PR2, PR3 | `194397c`; tolerance/ranks, three in-vivo plus one in-vitro source wording, and inert sigma metadata fixed. DEM-398 accepted at `f8d4700`. |
| ST1, ST2 | `82ac870`; blocked genomic comparisons/interpretation and interruption/cleanup semantics fixed. DEM-398 accepted at `f8d4700`. |
| VA1, VA2, VA3 | `6630492`; parameter-cache identity, surfaced cleanup failures and snapshot input provenance fixed. DEM-397 independently accepted worker `bd4beb1`. |
| I-BUILD-1, I-BUILD-2, I-CLI-1, I-TEST-1 | Initial runtime/wrapper fixes in `a292532` and recipe/manifests in `7055890`/`f7fc41c`; revised isolated recipe in `b636f02` is independently accepted by DEM-399. |
| I-REV-1 | `b636f02`; verified exact-archive extraction replaces environment creation. DEM-399 accepted the recipe and identities. Coordinator removed only this task's prior registry line and empty cache directories; shared registry SHA remained `f67374b8bd50bd1a1e475b50361b2b6e1b51ba7dab39ae9f0ad513aa8d2c0c97` before/after the repair checks. |
| I-REV-2 | `b636f02`; explicit IntaRNA3 personality; DEM-399 reproduced exact numerical equivalence with a renamed regular binary. |
| I-REV-3 | `b636f02`; finite whole-input-window context, reused query shuffles and partial/complete core exclusion stated; DEM-399 accepted. |
| I-REV-4 | `b636f02`; owned-child/output/temp cleanup, signal status and handler restoration; DEM-399 accepted 94 tests and real signal timing probes. |
| I-REV-5 | `b636f02`; complete build recipe, package/runtime/library identities and consistent arm64 evidence; DEM-399 accepted. |
| I-SCI-1 | **open**, retained in [regulatory-layer admission](O_regulatory-layer-admission__20261014.md#open-scientific-dependencies): full UTEX Yfr1 transcript ends and actual target interactions are unestablished. This gates those biological claims, not the explicitly approximate computational-window producer. |

No unresolved implementation or audit finding remains. I-SCI-1 is retained in
the admission ticket because the completed pilot does not assert the biological
identity/function it gates. The reviewer's informational fullhelp notice and
103-nt pairing-span wording are clarified in the runbook against pinned source
receipt I8 and the explicit model settings; optional loader hardening was not a
finding or acceptance condition.

## Durable Knowledge and Remaining Work

The [method contracts](../../validation/regulatory-methods.md) link all six
producers and reproducible build/validation recipes. The
[transfer contract](../../validation/regulatory-transfer.md) preserves model-transfer,
alignment and donor-only distinctions, source receipts S1–S11, evidence labels,
evaluation controls and same-model recoding comparisons. Method runbooks preserve
all additional source/runtime/model pins and interpretation rules. Receipt links
were redirected from this retiring ticket to those durable contracts.

The separate [admission ticket](O_regulatory-layer-admission__20261014.md) owns
browser-layer selection, native site-scanning/coverage choices and I-SCI-1.
No published website annotations are implied by completing these pilots. RBS and
iDOG retain their existing owners and holds. No cluster access is required for
these completed local pilots.

## Verification

Initial integration at `f7fc41c`: JavaScript **1,584 passed**; Python **2,025 passed,
8 skipped, 51 subtests passed**; contract **130 passed, 0 failed, 1 declared skip**.
Actual Promoter, STREME, IntaRNA and Infernal inputs were supplied.

After merging main through `b4092f5`, JavaScript again has **1,584 passed, 0 skipped**;
contract **130 passed, 0 failed, 1 declared spliced-CDS contiguity skip**. DEM-398's
repair recheck has **125 focused tests passed** with actual model/runtime and no
skips. DEM-397 has **93 passed**, no skips. Final Python at `b636f02`, with all real regulatory tools and pinned inputs, has
**2,082 passed, 8 skipped, 51 subtests passed**. All regulatory tests ran. The eight
source-cache skips are Syn57 annotation, GO OBO and six existing Tan workbook/
article/archive checks. Changed Markdown links and all 27 remaining open/active ticket identities,
statuses and queue entries pass. `git diff --check` passes.

## Cleanup

Reusable contracts and source receipts are distilled into validation runbooks
and indexed. All links to the retiring ticket were redirected. Remove only this
queue row and commit this named resolution, then delete the resolved ticket last.
I-SCI-1, RBS and iDOG dependencies remain explicitly owned in their open tickets.
No one-off execution ledger is added to permanent documentation.
