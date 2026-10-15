# A_regulatory-layer-admission__20261014 — Active

Scope: Select and admit browser-facing exploratory regulatory predictions from the evaluated local methods, with method-specific coverage, native coordinates and honest evidence labels.
Status: active
Opened: 2026-10-14
Updated: 2026-10-14

## Current State

Owned by **cyano-regulatory-sites** (2026-10-14), isolated branch
`work/rfam-admission-20261014` from `7dedca7`. Selected release: exactly the
RF01116/Yfr1 native family-homology interval; no additional family or method.
The intergenic interval is displayed as genomic context without assigning it
to a neighboring CDS. Full transcript boundaries and interaction targets remain
unknown (I-SCI-1); they are not claims of this release.

Other active sessions retain filter/neighbor-count and microarray ownership.
This session does not interrupt them, alter their worktrees, or publish their
unpushed commits.

The completed regulatory-method shortlist provides reproducible
non-release pilots with independent review. This ticket owns source/layer selection and browser
admission; it does not reclassify pilot results as measured regulatory function.
The owner permits very rough predictions transferred from other bacteria even
without evaluated UTEX sites. Missing UTEX calibration limits the claims, rather
than prohibiting an explicitly exploratory layer.

The [method contracts](../../validation/regulatory-methods.md) and
[transfer contract](../../validation/regulatory-transfer.md) retain inputs,
coordinates, score semantics, controls and source evidence. Fresh predictions
remain computed records, with the existing translucent/lower-priority viewer
contract. Donor coordinates never become native coordinates without an explicit
native-sequence calculation or checked alignment.

## Method-specific admission work

| Method | Available basis | Required before a browser layer |
| --- | --- | --- |
| Promoter Calculator | Pinned E. coli model, exact native-window scoring and Tan gTSS localization/control evaluation | Define genome-wide candidate selection and coverage, preserve all context at tiled/circular boundaries, label raw scores and rates as out-of-domain model outputs; the measured-anchor sample does not establish genome-wide specificity. |
| Standalone TransTermHP | Pinned three-replicon native/shuffled pilot with separate hairpin/tail intervals | Admit intrinsic-terminator candidates under the source ledger, retain uncovered origin-spanning regions and annotation-dependent scoring; donor transcript ends and reporter efficiencies are separate evidence. |
| STREME | Native discovery/external-evaluation cohorts and descriptive PWM ranking | Choose a specific motif and site-scanning contract before emitting a genomic layer. The offline window scorer is not a calibrated site scanner. FIMO remains unselected; no new tool is implicitly authorized by its mention. Preserve locus/overlap/homology blocks, null controls and native genomic comparisons. The current motif does not show gTSS enrichment over the sampled genomic backgrounds and must not be labelled a promoter-specific motif. |
| Rfam/Infernal | Pinned RF01116/Yfr1 family-homology pilot | Decide whether to publish RF01116 alone or an explicit additional-family list, retain gathering thresholds, truncation, circular search coverage and raw/native coordinates. A family interval is not a full transcript or established regulatory action. |
| ViennaRNA | Local accessibility probabilities with exact oriented/native segment coordinates | Decide how accessibility supports a separately identified candidate interval; retain window/span/temperature sensitivity. Accessibility alone must not create a regulatory-site/function claim. |
| IntaRNA | Explicit query/target window interaction calculations and controls | Identify query/target sequences and transcript-boundary evidence, or retain approximate-window sensitivity labels. A Yfr1 homology interval or TSS anchor is not a confirmed transcript. No inferred target interaction becomes a validated native target. |

[RBS Calculator](O_rbs-calculator-gene-visualizer__20260930.md) retains its
missing-code dependency. [iDOG](O_idog-promoter-prediction__20260930.md) now owns
the authorized investigation of a new promoter locator (2026-10-14); its former
review hold is released, but the public code still supplies no locator. Neither
method is implicitly added to this ticket's implementation scope.

## Open Scientific Dependencies

- **I-SCI-1 — open; explicitly transferred to
  [Yfr1 transcript/interaction evidence](O_yfr1-transcript-interaction-evidence__20261014.md).** The admitted annotation,
  RF01116 homology interval and retrieved Tan/Richter evidence do not establish
  full native UTEX Yfr1 transcript ends or the pilot's proposed target
  interactions. Resolve with source-backed transcript/interaction evidence
  before claiming those identities or functions. Explicit computational-window
  comparisons may remain exploratory, with boundaries and sensitivity visible.
  This does not block the completed runtime/window producer, and must not be
  lost when the shortlist ticket closes.

## Acceptance Criteria

- Select a concrete method/output layer, record immutable source/model/input
  files and terms under the existing admission contract, and preserve unresolved
  inputs explicitly. Do not expand to every candidate family or method by default.
- Publish only native-sequence intervals whose strand, assembly, circular-wrap,
  score/units, output origin and coverage can be verified. Retain source and
  inferred coordinates separately for any transferred evidence.
- Keep exploratory predictions, family homology, measured TSSs and missing
  evidence distinguishable in both gene viewers, chromosome view and exports.
  Do not present a probability, E-value, motif score or model rate as measured
  UTEX regulatory activity. Missing/unassayed sites remain unknown.
- Validate any new selection threshold on independent loci with appropriate
  controls; report coverage and ranking/localization separately. Shuffled
  controls do not supply biological false-positive rates.
- Independently review the exact producer/payload/labels and render any changed
  UI at mobile, tablet and desktop widths before publishing.

## Verification

Producer/data/source slice `7dedca7..de8c0ec` independently accepted by
Multica DEM-416 (Codex reviewer), with 275 focused tests passing and no skips.
The reviewer re-fetched Rfam 15.1 receipts/library, reproduced the model digest,
verified native replay/rotated circular cases and confirmed citation terms.

Producer DEM-414 findings are retained explicitly:
- **RFAM-1 (manifest) — resolved by `de8c0ec`.** New payload and citation hashes
  are included in the rebuilt data manifest.
- **RFAM-2 (no-hit coverage wording) — resolved by `de8c0ec`.** The pilot and
  fresh release now distinguish a searched family without a GA match from
  other families not evaluated. Only the provenance coverage sentence changed;
  all native values and the TSV remained identical.
- **RFAM-3 (38.0 serialization) — informational, no defect.** JSON's `38.0`
  and JavaScript's `38` represent the same published GA bit score.
- **I-SCI-1 — open**, owned by the separate Yfr1 evidence ticket above; no
  transcript or interaction claim is admitted here.

Coordinator citation renders at 375×812, 768×1024, 1280×800 and 1440×900 show
readable source/method cards, working keyboard focus and no horizontal overflow.
All eight screenshots and the semantic snapshot were inspected; console errors
and warnings were zero. Browser download-byte verification awaits publication.

Integrated UI commit `c01ef97` (worker `d495854`) passes `npm test`: 1,606
passed, none skipped. Full Python gate: 2,125 passed, 13 skipped, 51 subtests
passed. `tools/validate_contract.py`: 130 passed, zero failed, one declared
spliced-CDS exemption. Working tree and whitespace checks are clean.

DEM-413 rendered both gene viewers, chromosome and sequence on native/chromosome
routes at all four required sizes plus 599/601 and 1239/1241 px. Checks cover
exact native bases, independent toggles, hover/keyboard focus, caller rebuilds,
expanded evidence, full JSON export, no-match, unevaluated E. coli, loading and
failed-layer states. The failure fixture's deliberate 503 is the only expected
resource error. No normal-runtime errors or accidental overflow; manual semantic
and keyboard checks passed. No Playwright Test/axe installation or screen-reader
session is claimed. Coordinator integration smoke check confirms all four views
with the final payload and no runtime errors.

Independent final UI review DEM-417 found RV-1–RV-4 on `c01ef97`:
- **RV-1 — fixed in `0ffe9e9`, confirmation pending:** Inspect now refreshes
  coordinates, pan controls, accessible summaries and the linked tRNA viewport.
- **RV-2 — fixed in `0ffe9e9`, confirmation pending:** computed intervals use
  teal bars/triangular heads and visible per-view legends, distinct from purple
  measured TSS marks. Hidden/loading/failed Tan copy no longer calls the shared
  marker lane empty.
- **RV-3 — fixed in `0ffe9e9`, confirmation pending:** RF01116-only sequence
  rows retain geometry and focus when hidden, including Tan loading/failure.
- **RV-4 — fixed in `0ffe9e9`, confirmation pending:** upstream context is
  labelled as a minimum and the disclosure shows each limitation once; full
  raw search coverage remains in the JSON download.

Reviewer rerenders replaced inaccurate worker loading-state evidence and
confirmed the desktop disclosure/whole-chromosome view. Coordinator rerenders
cover the corrected patch and mobile disclosure. Final confirmation and public
raw-download verification remain pending. Do not close before they pass.

## Cleanup

Keep the separate RBS dependency and iDOG ownership intact. When the selected layer scope is
complete, name the closing session and every finding/resolution, distill reusable
admission/validation rules, resolve by R-rename, remove the queue row and delete
the resolved ticket last. Further unselected methods remain optional, not an
unbounded completion obligation.
