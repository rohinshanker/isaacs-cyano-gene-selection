# A_data-annotation-release-readiness__20260918 — Active

- **Scope**: Release-pinned annotation, external biological evidence, and gated publication.
- **Status**: active
- **Opened**: 2026-09-18
- **Updated**: 2026-09-19

## Current State

The repository now has a deterministic release-readiness layer for RefSeq
`GCF_000817325.1`, annotation `GCF_000817325.1-RS_2026_05_13` (PGAP 6.11).
The 15-input manifest records release identity, URLs, byte sizes, retrieval data,
and checksums. Four generated artifacts reproduce byte-for-byte:

- 22,356 ambiguity-preserving identifier relationships;
- 2,776 per-locus annotation-evidence records;
- 3,898 GO relationships covering 1,584 loci; and
- a release summary with mapping and evidence coverage.

The evidence layer preserves the four genuinely shared protein identifiers,
three discontinuous CDSs, split `prfB`, 401 overlapping-CDS pairs, 100 nearby
non-coding-RNA relationships, seven pseudogenes, four partial loci, inference
strings, replicon identity, and 895 loci with EC evidence. Exact PCC 7942 mapping
covers 2,648 UTEX loci and labels every ambiguous relationship.

The site build now verifies and exact-joins the release evidence into a separate
annotation payload for all 2,715 displayed genes. Gene detail presents it in a
collapsed disclosure with coordinate-evidence and GO interpretation guidance;
the core gene payload remains under its 6 MB budget. GO Consortium attribution,
CC BY 4.0 terms, release identity, and checksums travel with the site metadata.

Expression is selected by manifest rather than file presence. The PCC 7942
GSE205444 overlay remains visibly borrowed and opt-in; the native UTEX 2973 TSS
source remains a TSS signal rather than being mislabelled as abundance. Missing
measurements remain unknown. The build, UI, and export carry source identity and
caveats dynamically.

Pages CI fetches and verifies the raw genome, verifies the annotation manifest
and generated artifacts, runs readiness/negative tests, validates the contract
against raw FASTA/GFF/proteins, checks live browser metrics, creates both fixture
variants, and runs the JavaScript and Python suites before upload.

Reusable procedures are in
`docs/validation/annotation-release-readiness.md` and the other validation
runbooks. Current local verification: 15 inputs, four generated artifacts, 18
readiness tests, 62 contract checks with one declared spliced-CDS skip, 132
Python tests, 273 JavaScript tests, and all live-genome checks pass.

## Remaining External Decisions

This ticket stays active because the following cannot be completed honestly from
the available redistributable sources or without user authorization:

- The 2026-09-18 UniProt check returned no records for proteome
  `UP000031358`/taxid 1350461.
- Rubin PCC 7942 essentiality does not provide sufficiently explicit
  redistribution terms for a checked-in derivative.
- No release-pinned, licensed KEGG or CyanoOmicsDB bulk artifact has been
  established.
- The CAI reference set still uses a reviewed product-name rule. TypeSafe/Jev
  would be appropriate for the bounded classification audit, but this machine
  has no usable API key, SDK, or MCP connection; no silent heuristic replacement
  was made.
- GitHub Pages has not been enabled or pushed, because deployment and the
  post-deploy smoke test require explicit user authorization.

## Verification

Before resolution, acquire or explicitly waive each external evidence source,
record its redistribution decision and coverage, run the full gated workflow,
authorize deployment, and record a smoke test against the deployed URL. Never
substitute inferred pathway, essentiality, or functional-category claims for a
missing licensed source.

## Cleanup

When those decisions are complete, update the durable release-readiness runbook,
remove this ticket from the live index, and delete it.
