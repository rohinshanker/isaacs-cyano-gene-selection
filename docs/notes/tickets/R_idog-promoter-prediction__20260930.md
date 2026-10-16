# R_idog-promoter-prediction__20260930 — Resolved

Scope: Investigate a new promoter locator around iDOG, determine exactly which source is missing and whether it is necessary, and define data, runtime and evaluation requirements.
Status: resolved
Opened: 2026-09-30
Updated: 2026-10-15

## Outcome

Closed by **cyano-regulatory-sites**, 2026-10-15. The complete investigation,
not merely the absent-capability finding, is resolved. The pinned 44-file tree,
nine Python sources and all 21 bytecodes were inspected. The twelve source-less
modules implement design/web/job functions and are not dependencies of a new
independent native-sequence locator. No native promoter locator or fitted model
was found in that tree. No upstream application code was executed.

[The durable feasibility contract](../../validation/idog-locator-feasibility.md)
preserves the module roles, source pins, reproducible static audit, published
paper correction, runtime/licence limits, mandatory/optional data requirements,
and concrete scanner, paired-recoding, evaluation and viewer proposal.
The recommended baseline is the separately named, already selected Promoter
Calculator. Its outputs are not iDOG predictions or validated UTEX measurements.

What remains: scanner implementation, explicit call-selection policy, broader
held-out/native-background evaluation, recoding comparison and browser admission
remain in [regulatory-site changes](O_recoding-regulatory-site-change__20260930.md).
No new prediction layer shipped. The RBS Calculator code-access hold and remote
compute prerequisites remain in their existing tickets. No owner decision is
needed to establish the missing-code necessity finding.

## Finding dispositions

- **IDOG-1:** full independent bytecode inspection and source inventory; resolved
  by `94aeed8`, independently reproduced by DEM-430.
- **IDOG-2:** concrete new-locator path, data/evaluation limits and retained
  implementation scope; resolved by `94aeed8`, accepted by DEM-430.
- **IDOG-COORD-1:** clarify that overlapping CDSs share edited genomic bases
  without independently recoding the neighbor; resolved by `8afa8be`.
- **IDOG-R1:** preserve the rRNA-default evidence referred to by the RBS ticket;
  resolved by `158977e`, confirmed in the bounded DEM-430 recheck.
- **IDOG-REVIEW:** resolved by DEM-430's review of `c74b0ffd..8afa8be` and
  confirmation of `8afa8be..158977e`; no actionable finding remains. The first
  Claude run ended under its provider's biology-content filter and supplied no
  approval; the independent Codex fallback supplied the completed review.
- **CS-1:** the old claim of an existing iDOG UTEX promoter-location capability
  remains refuted for the pinned tree; the durable contract preserves the
  distinction from the owner's newly investigated, separate locator.

## Verification

- `npm test`: 1,668 passed.
- Project venv `python -m pytest -q`: 2,383 passed, 16 skipped, 51 subtests.
- `tools/validate_contract.py`: 130 passed, zero failed, one declared split-CDS
  contiguity exemption.
- Documented static recipe: all 44 source sizes/hashes matched; 21 bytecodes
  decoded with isolated xdis 6.3.0. Both coordinator and reviewer reproduced it.
- Source quotations rematched; 2,475 unique gTSS positions and 1,820 source locus
  tags independently reproduced. Relative links and heading fragments resolve.
- Shared ticket-context checker: all six configured documentation scopes passed;
  this project was additionally checked locally because it is not in that
  checker's hard-coded scope list. `git diff --check` passed.
- No UI, runtime implementation or release-data bytes changed; no browser or
  biological-performance verification is claimed for a new predictor.

## Cleanup

Reusable guidance is in the indexed feasibility contract and source inventory;
the continuing implementation scope is explicitly linked above. The live queue
row is removed. Delete this resolved ticket only after committing this closure.
