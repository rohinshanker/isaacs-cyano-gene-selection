# A_processed-expression-agreement__20261007 — Active

- **Scope:** Reproducible agreement statistics from admitted RNA-seq tables that retain sample columns; calibration output only, no release-layer or UI change.
- **Status:** active
- **Opened:** 2026-10-07
- **Updated:** 2026-10-07

## Current State

Coordinator: agent-deck `cyano-source-ingestion` (`80c81443-1791314087`). Canonical repository: `/Users/Rohin/Desktop/coding_stuff/ISAACS-LAB/isaacs-cyano-gene-selection`; isolated branch `work/expression-agreement-20261007`, baseline `50b9150`.

PRIDE ingestion belongs to `cyano-sci-ticket-closing`; raw-read reprocessing and condition-pair rescoring belong to `cyano-general-ticket-closing`. This scope owns a separate statistics tool, explicit sample/contrast plan, tests, and reproducible calibration report. It does not change their source readers, manifests, tickets or release data.

Use the owner's J6 rule: level Spearman correlation beside within-condition replicate correlations, and fold-change agreement where each contrast has its own control. No pass mark or automatic pair judgement. Biological replicates, unknown replicate types, time points, fractions and pooled samples remain distinct. Outputs retain missingness and gene denominators. Time-course means are labelled, and replicate correlations are calculated within exact time strata.

## Verification

Plan pins and all selected table columns verified against the 19 cached files
from 18 admitted studies: 53 layers, 52 explicit control-relative contrasts,
26 response pairs. Each biological stratum matches its specification's replicate
count. An independent arithmetic/rank calculation predicts 1,378 level pairs
and 166 within-stratum sample pairs. Implementation delegated to Multica DEM-293
in its separate project-linked worktree; integration owns the plan and docs.

Pending tool/reference comparison, independent patch review and repository gates.

## Cleanup

Distill reusable method and reproduction commands into `docs/validation/expression-agreement.md`; remove this ticket and its index row after final validation. Existing package E pilot intake and raw reprocessing remain their own work.
