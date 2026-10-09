# A_pages-deployment-repair__20261009 — Active

- **Scope:** Restore GitHub Pages deployment and verify the published organism views.
- **Status:** active
- **Opened:** 2026-10-09
- **Updated:** 2026-10-09

## Current State

Owner: `cyano-ui-fixes`. Isolated branch `fix/pages-deployment-20261009`, baseline
`a0c4be1`. The owner reports that the additional organisms are visible locally
but absent from GitHub Pages despite a successful push and hard refresh.

Run [37893905711](https://github.com/rohinshanker/isaacs-cyano-gene-selection/actions/runs/37893905711)
failed validation and skipped deployment. The preceding push failed the same
job. Pages still serves the earlier successful release `be5b3b3`.

Open findings:

- **DEP-1 fixed in this patch:** CI generates only two fixture variants, omitting
  `data-strain-fitness/strain_fitness.json`; the site tests fail with ENOENT.
- **DEP-2 fixed in this patch:** CI never fetches the pinned recoded source spreadsheets. Three
  pipeline tests fail because `Supplementary_Data_2.xlsx` is missing.
- **DEP-3 fixed in this patch:** Organism-specific CI gates still list only UTEX and MG1655,
  omitting the shipped MDS42, DH10B and Syn61 records.
- **DEP-4 open:** Prior completion reporting checked push success but did not
  verify Actions deployment or the live Pages content.
- **DEP-5 fixed in this patch:** Extending the live-metric gate to Syn61 exposed a harness bug:
  it loads the selected data directory without passing the browser organism
  record, so Syn61's valid parent-reference layer is rejected. The browser
  already supplies this record. The single-step loader now forwards the optional
  record, the CLI supplies it, and a real Syn61 CLI regression test covers it.

## Acceptance

Use the shared fixture generator and checksum-verified source fetcher in CI.
Keep failed gates blocking deploy; include every shipped organism in the
organism-specific checks. Reproduce from this clean worktree without linking
ignored source inputs from another checkout. Obtain a successful main workflow
run and verify the live deployed selector and all five organism views. Existing
queued UI redesign and Syn57/Pichea work remain separate tickets.

## Verification

The failing run's full log is retained outside the repository under
`/tmp/cyano-pages-repair-20261009/`. Clean-checkout validation passed: 1,396 JavaScript tests; 925 Python tests and
36 subtests (one skip); contract, manifest and live-metric checks for all five
organisms; and every other workflow gate. Inputs were fetched from their pinned
upstreams without linked raw-data directories. Successful deployment and rendered
live-site checks remain in progress. Browser
session: `pages-deployment-20261009`; renders will be stored in the worktree's
ignored `.playwright-cli/pages-deployment-20261009/` directory.

## Cleanup

The owning session must name the closer and resolve each DEP finding before
closure. Distill clean-checkout CI inputs and post-push deployment verification
into `docs/validation/`, update its index, then use the resolved-ticket lifecycle
and delete the resolved ticket last.
