# R_pages-deployment-repair__20261009 — Resolved

- **Scope:** Restore GitHub Pages deployment and verify the published organism views.
- **Status:** resolved
- **Opened:** 2026-10-09
- **Updated:** 2026-10-09

## Outcome

Closed by owning session `cyano-ui-fixes` on 2026-10-09. Repair commit
`bb1abea0ea01b05084d853d96be3f23add5fca17` is on `main` and deployed by
[successful run 37895536320](https://github.com/rohinshanker/isaacs-cyano-gene-selection/actions/runs/37895536320).
Both validation and deployment succeeded. No findings remain open in this repair.

- **DEP-1 resolved by bb1abea:** CI uses the shared fixture generator, including
  the strain-fitness fixture previously missing from the test run.
- **DEP-2 resolved by bb1abea:** CI fetches and verifies the pinned recoded source
  spreadsheets. Fetch failure participates in the deployment-blocking gate.
- **DEP-3 resolved by bb1abea:** All five shipped organisms receive contract,
  manifest and live-metric validation.
- **DEP-4 resolved by bb1abea and run 37895536320:** Push success is no longer
  treated as deployment success. Both Actions jobs passed; deployed source/data
  hashes match this commit and all five live organism views were rendered.
- **DEP-5 resolved by bb1abea:** The single-step loader forwards optional organism
  context; the live-metric CLI supplies the selected registry record. A real
  Syn61 CLI regression test covers its parent-reference layer.

The strain-navigation redesign, Syn57 and Pichea additions, scale-icon alignment,
map-button spacing and other existing UI tickets remain in the live queue. They
were not included in this deployment repair.

## Verification

Fresh source fetches without linked raw inputs passed checksum and identity
checks. Local and GitHub validation passed: 1,396 JavaScript tests, 925 Python
tests and 36 subtests (one skip), all five organisms' contract/manifest/live-metric
gates, and all other workflow gates.

The live Pages site rendered UTEX 2973, MG1655, MDS42 public reference, DH10B public
reference and Syn61 at 375, 768, 1280 and 1440 px. All 20 states showed the selected
organism, expected gene count, visible map and no horizontal overflow. Browser
console, runtime and request diagnostics were empty. Keyboard selection, visible
focus, Syn61 strain-fitness data and its MDS42-reference map passed. Screenshots
were captured after the text reveal settled. No visual baselines changed.
Accessibility verification was scoped to navigation, names, selected state and
visible keyboard focus; no new automated accessibility dependency was installed.

Transient screenshots, reports, live file hashes and reproduction script are in
`.playwright-cli/pages-deployment-20261009/` in the isolated
`ISAACS-LAB/worktrees/pages-deployment-20261009` checkout. CI/local logs are in
`/tmp/cyano-pages-repair-20261009/`.

## Cleanup

Reusable input-fetch, fixture-generation, all-organism gate and post-push
verification guidance was distilled into `docs/validation/release-gate.md`; its
validation index row was updated in bb1abea. No ticket-only operational guidance
remains. Remove the live queue row, record this resolved state, then delete this
resolved ticket last. Retain transient evidence outside tracked documentation.
