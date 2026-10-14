# O_regulatory-layer-admission__20261014 — Open

Scope: Select and admit browser-facing exploratory regulatory predictions from the evaluated local methods, with method-specific coverage, native coordinates and honest evidence labels.
Status: open
Opened: 2026-10-14
Updated: 2026-10-14

## Current State

Unassigned. The regulatory-method shortlist owns reproducible non-release pilots and their
independent review. This ticket owns subsequent source/layer selection and browser
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
missing-code dependency. [iDOG](O_idog-promoter-prediction__20260930.md) retains
the owner's execution hold. Neither is executable scope for this ticket.

## Open Scientific Dependencies

- **I-SCI-1 — open; owner: this admission ticket.** The admitted annotation,
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

This is an admission queue entry, not evidence that a new browser layer ships.
Run the applicable method runbook, data/annotation contracts, repository gates,
coordinate oracles and rendered UI checks for each selected implementation.

## Cleanup

Keep RBS and iDOG ownership/holds unchanged. When the selected layer scope is
complete, name the closing session and every finding/resolution, distill reusable
admission/validation rules, resolve by R-rename, remove the queue row and delete
the resolved ticket last. Further unselected methods remain optional, not an
unbounded completion obligation.
