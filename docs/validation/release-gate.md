# Release gate

Distilled on 2026-10-06 from the retired `AAA-manual-review-checklist.md`: the
automated gate, the pre-publication review and the production smoke test, which
every site release still runs. The biological panel review that document also
held is now in
[AAAA-new-bio-decisions-to-review.md](AAAA-new-bio-decisions-to-review.md#before-an-exported-panel-becomes-an-experiment);
the external-source dispositions it listed are the
[source ledger](source-ledger.md) and the
[roadmap register](future-data-roadmap.md). The interface walk-through it opened
with is the subject of the UI-clutter audit ticket. Completed values (commit,
operator, run URL, result) belong with the lab's release record, not here.

## The automated gate

Run from the repository root on the exact commit intended for publication. If
the raw files are missing, fetch each published organism with
`bash tools/fetch_genome.sh --organism ID`, run
`python3 tools/annotation_release.py fetch` for annotation companions, and run
`python3 tools/fetch_recoded_ecoli.py` for the recoded source workbooks. The latter
verifies the pinned archive and every extracted member before they are used.
Use a fresh checkout when changing CI input setup; linking an existing raw-data
directory can conceal a missing fetch step.

Recoded downloads retry transient transport errors at most three times, with
5- and 10-second delays. Partial transfers are discarded; existing destination
files remain intact until a complete transfer succeeds. HTTP access/not-found
errors and failed size/digest checks remain hard failures. CI caches only the
pinned containing archive under the fetcher hash, with no broad restore key;
every cache hit still passes archive and extracted-member verification.

Do not publish until the automated gate passes and the intended commit has a
clean worktree.

Complete the [README setup](../../README.md#rebuilding) first. CI's reference
environment is Python 3.12 and Node 24. The browser procedure also requires
`playwright-cli` on `PATH`; if it is unavailable, record browser validation as
incomplete rather than treating the non-browser tests as a substitute.

```sh
python3 tools/annotation_release.py verify
python3 tools/annotation_release.py check
python3 -m unittest discover -s tests/readiness -p 'test_*.py'
python3 tools/validate_contract.py --data-dir site/data --raw-dir data/raw
node tools/check_live_metrics.mjs
npm test
./.venv/bin/python -m pytest -q
git fetch origin
git diff --check
git diff --check "$(git merge-base origin/main HEAD)" HEAD
git status --short
```

The workflow's organism list must cover every published record in
`config/organisms.json`. Run the contract, data-manifest and live-metric checks
with `--organism ID` for each record. The live-metric harness must pass that
organism's browser registry record to the loader so declared companion layers
are checked in the correct context.

CI generates fixtures with `npm run generate:test-fixtures`, the same shared
script invoked by local `npm test`. Do not copy a partial list of generator
commands into the workflow. New input-fetch steps must also participate in the
final failure-aggregation gate; a missing or changed source must block deploy.

Also run the real-browser procedure in
[`rna-folding.md`](rna-folding.md#browser-regression). It is intentionally a
local release gate because the repository does not install a browser automation
dependency in CI.

Expected results for the current implementation:

- [ ] All 15 pinned annotation inputs verify.
- [ ] All four generated annotation artifacts reproduce byte-for-byte.
- [ ] All readiness, audit-integrity, and negative-fixture tests pass.
- [ ] Contract validator reports `failed=0 skipped=1` with its own current pass count (110 on 2026-10-06); the sole skip
  is the declared contiguity exemption for the three discontinuous CDSs.
- [ ] Every live-genome check passes, including protein preservation and metric
  parity within `1e-6`.
- [ ] All JavaScript tests pass, including static HTML/CSS, module, worker, and
  required runtime-asset resolution.
- [ ] All Python tests pass.
- [ ] The RNA-folding browser check passes all 32 parity cases, lifecycle
  states, UI source coverage, current breakpoint widths, and diagnostic checks.
- [ ] Both working-tree and reviewed-commit-range `git diff --check` commands
  print nothing.
- [ ] `git status --short` prints nothing after any intentionally regenerated
  fixtures or artifacts are handled.

Any checksum, organism, accession, release, contract, parity, or test failure is
release-blocking. Do not update a checksum or expected count until the upstream
change has been identified and deliberately accepted.

## Pre-publication review

- [ ] Review `git log --oneline` and the full diff against the remote branch.
- [ ] Confirm no credentials, private data, unpublished lab notes, or temporary
  browser/test artifacts are tracked.
- [ ] Confirm every published `genes.json` remains at or below the 2,000-byte-per-gene budget
  (`tools/validate_contract.py` reports the figures for each organism).
- [ ] Confirm the dataset and annotation release IDs shown in the site match the
  manifest and exported files.
- [ ] Confirm every source the release shows has its ledger row and citation entry.
- [ ] Confirm all required attributions and licenses are present.
- [ ] Decide whether floating minimum Python dependency versions and major-tagged
  GitHub Actions are an accepted maintenance risk, or separately adopt a tested
  dependency lock and action-SHA policy before release.
- [ ] Confirm the intended commit is on `main` and Pages still uses the gated
  GitHub Actions workflow.

## Publish and smoke-test

1. Push the reviewed `main` commit to the intended GitHub remote.
2. Confirm Pages uses **GitHub Actions** as its source.
3. Wait for `.github/workflows/pages.yml` to finish both `validate` and `deploy`
   successfully for the pushed SHA. A successful Git push alone does not update
   Pages; failed validation leaves the last successful release live.
   Steps using `continue-on-error` can display a successful conclusion despite
   a failed outcome. Use the final aggregation gate and complete job result;
   do not infer success from the workflow advancing to a later step.
4. Record the workflow URL, deployed commit, and Pages URL in the lab release record.
5. Run the production smoke test. Check deployed module/data bytes against the
   intended commit if the site still appears old; a hard refresh cannot repair
   a skipped deployment. Do not report publication complete until both the
   workflow and live-content checks succeed.

Production smoke test:

- [ ] The Pages URL loads over HTTPS without console or network errors.
- [ ] Every shipped organism can be selected and its expected gene count loads:
  UTEX 2973, MG1655, MDS42 public reference, DH10B public reference, and Syn61.
- [ ] Search, filters, schemes, selection, and map controls work.
- [ ] A shared URL restores the intended state in a fresh browser session.
- [ ] Shortlist CSV and manifest export work; the automated gate covers panel-manifest
  round-trip import.
- [ ] `site/data/annotations.json` loads and a gene's collapsed annotation
  evidence renders correctly.
- [ ] ViennaRNA WebAssembly loads and a fold completes; cancellation still works.
- [ ] Desktop and phone layouts have no horizontal overflow.
- [ ] Dataset provenance and third-party attribution are visible.

A site release is complete when every source it shows is cited, the full
automated gate passes on the deployed commit, the gated Pages workflow succeeds,
and the production smoke test passes. Open a ticket for any defect; this runbook
is not a defect ledger.
