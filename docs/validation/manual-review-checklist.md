# Next steps and validation checklist

Use this document as the single handoff checklist for reviewing a candidate
panel and publishing the UTEX 2973 gene-selection site. Automated checks prove
that data and outputs reproduce in the tested environment; they do not decide
whether a biological design is appropriate or replace a dependency/toolchain
reproducibility policy.

## Current status

- [x] Requested features and fixes are implemented locally on `main`.
- [x] Candidate shortlist and **About this dataset** are in the center column.
- [x] The guided panel designer, exact RNA folding, URL sharing, annotation
  evidence, tutorials, responsive layout, and release gates are integrated.
- [x] The last local run passed 273 JavaScript tests, 132 Python tests, 18
  annotation-readiness tests, 62 contract checks with one declared
  discontinuous-CDS exemption, all live-genome checks, and the complete
  real-browser RNA-folding matrix with no uncovered UI lines or diagnostics.
- [ ] The scientific choices below have been reviewed by the lab.
- [ ] External evidence sources have each been acquired or explicitly waived.
- [ ] The repository has been pushed and GitHub Pages has been enabled.
- [ ] The deployed site has passed the smoke test below.

The requested implementation is integrated locally. Automated local checks are
marked separately from human interface acceptance. Scientific sign-off,
evidence/licensing decisions, push/Pages authorization, and the deployed-site
smoke test remain external or manual release requirements.

## Recommended order

1. Run the site locally and complete the interface checks.
2. Create the intended 6–10-gene panel and complete its biological review.
3. Record the external-evidence decisions.
4. Run the complete automated gate on the exact commit to publish.
5. Review the Git diff and authorize the push and Pages deployment.
6. Smoke-test the deployed URL and record the release details.

Do not use a generated panel as an experiment plan until steps 1–3 are complete.
Do not publish until the automated gate passes on a clean worktree.

## 1. Open and inspect the local site

From the repository root:

```sh
python3 -m http.server 8000 --directory site
```

Open <http://localhost:8000/>. Do not open `site/index.html` with `file://`;
browsers block the module, JSON, worker, and WebAssembly requests it needs.

Record the review environment:

| Item | Value |
| --- | --- |
| Review date | |
| Reviewer | |
| Commit (`git rev-parse HEAD`) | |
| Browser and version | |
| Desktop operating system | |
| Phone/tablet and browser | |

### Layout and accessibility

- [ ] At 375 px, 768 px, 959/960 px, 1239/1240 px, 1280×800, and 1440 px widths, the
  document has no horizontal scrollbar.
- [ ] The center-column order is map, comparison, panel designer, candidate
  shortlist, and **About this dataset**, followed by gene detail in logical
  reading order.
- [ ] The designer, shortlist help, dataset provenance, and annotation evidence
  stay collapsed until requested and do not make the default page feel crowded.
- [ ] At 1240 px and wider, the gene detail is a bounded, sticky third column.
- [ ] Below 1240 px, gene detail returns to document flow and **Jump to selected
  gene detail** reaches it.
- [ ] **Jump to map** and the keyboard skip control focus the map without changing
  the URL hash or clearing a scheme, filter, shortlist, or pinned gene.
- [ ] With 10 candidates, scroll the shared and pairwise comparison tables
  horizontally. Their complete guidance stays wrapped and visible above the
  columns, and the page itself never scrolls sideways.
- [ ] In Pairwise delta at 1280×800, **A − B** and **Relative size** are visible
  without scrolling; raw A/B values remain available to the right. At narrow
  widths the guidance explicitly tells the reader to scroll.
- [ ] With no saved scheme, the saved-scheme selector, **Load**, and **Delete**
  are disabled. Selecting a real saved scheme enables the actions; deleting it
  clears and disables them again.
- [ ] Tab order follows the visible workflow. Focus is always visible.
- [ ] The detail panel responds correctly to Arrow, Page Up, Page Down, Home,
  and End, and hands scrolling back to the page at its boundary.
- [ ] Text, controls, tables, and disclosures remain readable at 200% zoom.
- [ ] The browser console contains no unexpected errors or warnings.

### Main workflow

- [ ] Search by locus tag, gene symbol, product term, and the `rubisco` alias.
- [ ] Pin and unpin genes with mouse, touch, and keyboard controls.
- [ ] Zoom and navigate the map without losing the selected gene.
- [ ] Add and remove candidates and inspect a ten-gene comparison in table,
  radar, and parallel-coordinate views.
- [ ] Confirm unknown measurements render as unknown, not zero or median.
- [ ] Change the recoding scheme and confirm burden and comparison values update.
- [ ] Copy a shared URL, open it in a new tab, and confirm schemes, filters,
  shortlist, pins, and selection are restored.
- [ ] Use browser Back and Forward and confirm live state follows the URL.
- [ ] Activate numeric, activity, translational-exception, and measured-only
  filters together; **Clear all filters** resets all of them and removes their
  URL fields in one action.
- [ ] Export the shortlist and manifest, then import the manifest and confirm the
  same ordered panel, scheme map, constraints, and source metadata return.

### New feature checks

- [ ] Open the guided panel designer and generate a feasible 6–10-gene panel.
- [ ] Confirm required genes appear, excluded genes do not, hard bounds are
  honored, and a blank bound with **Require a value** still rejects unknowns.
- [ ] Confirm each selected gene explains the feature-space contribution it
  makes and the reported eligible-gene count matches the actual pool.
- [ ] After generating a panel, change its size, a range, and a selected scheme.
  **Settings changed** must say that the visible result/export still uses the
  last design; **Regenerate panel** must update the result and remove the notice.
- [ ] Select a saved scheme in the designer, add another scheme that sorts
  before it, and confirm the selection does not move. Same-map schemes with
  different names remain independently selectable; deleting one clears it.
- [ ] Enable borrowed expression and confirm PCC 7942 abundance is clearly
  labelled **measured elsewhere**, while native UTEX 2973 TSS is labelled
  **measured in this organism** and is not called abundance.
- [ ] Fold a shortlisted gene under the active scheme. Inspect wild-type and
  recoded structures, MFE, and delta-MFE for both windows.
- [ ] Cancel a fold, repeat it to exercise the cache, and test an offline/error
  state. The interface must remain usable in every state.
- [ ] Open **Annotation evidence and recoding context** in gene detail. Confirm
  replicon, annotation method, inference, overlaps, nearby RNA, and GO rows are
  legible and attribution is present.
- [ ] Confirm coordinate proximity is not described as regulation and GO rows
  are not presented as invented pathways or broad functional categories.

## 2. Review the actual biological panel

Complete this section for the exact exported manifest that may become an
experiment plan. Keep that manifest with the lab record.

| Item | Pass condition | Notes or evidence |
| --- | --- | --- |
| Strain | Every sequence and measurement is identified as UTEX 2973 or clearly labelled as cross-strain evidence. | |
| Locus identity | Every required, excluded, and selected locus tag matches the current strain inventory. | |
| Gene model | Coordinates and starts are checked against `GCF_000817325.1-RS_2026_05_13`, especially if an older 2017 design is being reused. | |
| Product | Product descriptions and annotation evidence support the intended interpretation. | |
| Recoding map | Every source and replacement codon is intentional and synonymous where claimed. | |
| Initiation | Codon position zero remains untouched, including non-ATG starts. | |
| Stops | TAA, TAG, and TGA handling is intentional; terminal-stop edits are counted separately from sense-codon burden. | |
| `prfB` | `M744_RS00920` is excluded or its programmed frameshift and split CDS have been explicitly reviewed. | |
| Genomic context | Overlapping CDSs, discontinuous CDSs, partial loci, pseudogenes, and nearby non-coding RNAs have been reviewed. | |
| Hard constraints | Required/excluded genes, metric bounds, and missing-value policy match the design intent. | |
| Missing data | **Require a value** is enabled wherever an unknown measurement is unacceptable. | |
| Diversity rationale | Each selected gene adds a useful, understandable distinction rather than only improving an opaque score. | |
| Expression | Borrowed PCC 7942 abundance is off unless cross-strain evidence is deliberately wanted. | |
| Native TSS | UTEX 2973 TSS is interpreted as initiation evidence, not transcript abundance. | |
| Folding | MFE and structure changes are treated as hypotheses for follow-up, not proof of expression, fitness, or viability. | |
| Reproducibility | Re-importing the saved manifest recreates the same ordered panel and settings. | |

Panel record:

| Item | Value |
| --- | --- |
| Manifest filename and SHA-256 | |
| Panel size | |
| Selected locus tags in order | |
| Recoding scheme name | |
| Required loci | |
| Excluded loci | |
| Borrowed PCC 7942 expression used? | Yes / No |
| Scientific reviewer and date | |
| Approved for experimental planning? | Yes / No |

Stop and investigate if a locus tag points to a different gene model than the
one used for primers, guides, or constructs. The current annotation differs in
boundary from the older 2017 annotation for 288 shared genes.

## 3. Resolve external evidence and licensing decisions

An explicit, documented waiver is acceptable. A silent guess or a product-name
substitute is not. Record the decision, rationale, source version, license, and
reviewer for every row.

| Source or review | Current limitation | Allowed decision | Recorded decision |
| --- | --- | --- | --- |
| UniProt | The 2026-09-18 check returned no records for proteome `UP000031358` / taxid 1350461. | Recheck and import a pinned result, or waive. | |
| Rubin PCC 7942 essentiality | Redistribution terms for a checked-in derivative are not sufficiently explicit. | Obtain permission/license clarity, link without redistribution if appropriate, or waive. | |
| KEGG | No release-pinned, licensed bulk artifact is established. | Acquire under acceptable terms, or waive. | |
| CyanoOmicsDB | No release-pinned, licensed bulk artifact is established. | Acquire under acceptable terms, or waive. | |
| CAI reference-set audit | Product-name classifications have not had a TypeSafe/Jev bounded-classification audit because credentials are unavailable. | Supply credentials and validate on a reviewed sample, or accept and document the existing reviewed rule. | |

If TypeSafe/Jev is used, record:

- [ ] Exact candidate labels and explicit no-match outcome.
- [ ] Reviewed evaluation sample and ground truth.
- [ ] Decision threshold chosen from observed errors and consequences.
- [ ] False-positive and false-negative counts.
- [ ] Model/service version and run date.
- [ ] Final accepted reference-set changes, if any.

Preserve NCBI, Gene Ontology, expression-study, and ViennaRNA attribution in
redistributed data, screenshots, presentations, and publications. Gene Ontology
data are redistributed here under CC BY 4.0; keep the notice and description of
mapping changes in `data/annotation/PROVENANCE.md`.

## 4. Run the complete automated gate

Run from the repository root on the exact commit intended for publication. If
the raw files are missing, first run `./tools/fetch_genome.sh data/raw` and
`python3 tools/annotation_release.py fetch`.

Complete the [README setup](../../README.md#rebuilding) first. CI's reference
environment is Python 3.12 and Node 22. The browser procedure also requires
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

Also run the real-browser procedure in
[`rna-folding.md`](rna-folding.md#browser-regression). It is intentionally a
local release gate because the repository does not install a browser automation
dependency in CI.

Expected results for the current implementation:

- [ ] All 15 pinned annotation inputs verify.
- [ ] All four generated annotation artifacts reproduce byte-for-byte.
- [ ] 18 readiness and negative-fixture tests pass.
- [ ] Contract validator reports `passed=62 failed=0 skipped=1`; the sole skip
  is the declared contiguity exemption for the three discontinuous CDSs.
- [ ] Every live-genome check passes, including protein preservation and metric
  parity within `1e-6`.
- [ ] 273 JavaScript tests pass, including static HTML/CSS, module, worker, and
  required runtime-asset resolution.
- [ ] 132 Python tests pass.
- [ ] The RNA-folding browser check passes all 32 parity cases, lifecycle
  states, UI source coverage, current breakpoint widths, and diagnostic checks.
- [ ] Both working-tree and reviewed-commit-range `git diff --check` commands
  print nothing.
- [ ] `git status --short` prints nothing after any intentionally regenerated
  fixtures or artifacts are handled.

Any checksum, organism, accession, release, contract, parity, or test failure is
release-blocking. Do not update a checksum or expected count until the upstream
change has been identified and deliberately accepted.

Validation record:

| Item | Value |
| --- | --- |
| Commit tested | |
| Gate date | |
| Operator | |
| Local result | Pass / Fail |
| CI run URL | |
| Exceptions | |

## 5. Pre-publication review

- [ ] Review `git log --oneline` and the full diff against the remote branch.
- [ ] Confirm no credentials, private data, unpublished lab notes, or temporary
  browser/test artifacts are tracked.
- [ ] Confirm `site/data/genes.json` remains below the 6 MB interaction budget.
- [ ] Confirm the dataset and annotation release IDs shown in the site match the
  manifest and exported files.
- [ ] Confirm all external-source decisions above are recorded.
- [ ] Confirm all required attributions and licenses are present.
- [ ] Decide whether floating minimum Python dependency versions and major-tagged
  GitHub Actions are an accepted maintenance risk, or separately adopt a tested
  dependency lock and action-SHA policy before release.
- [ ] Obtain explicit authorization to push `main` and enable GitHub Pages.

The push and Pages setting are intentional external changes. They have not been
performed as part of local implementation.

## 6. Publish and smoke-test

After authorization:

1. Push the reviewed `main` commit to the intended GitHub remote.
2. In repository settings, select **GitHub Actions** as the Pages source.
3. Wait for `.github/workflows/pages.yml` to finish both `validate` and `deploy`.
4. Record the workflow URL, deployed commit, and Pages URL below.
5. Run the production smoke test.

Production smoke test:

- [ ] The Pages URL loads over HTTPS without console or network errors.
- [ ] The map and all 2,715 site genes load.
- [ ] Search, filters, schemes, selection, and map controls work.
- [ ] A shared URL restores the intended state in a fresh browser session.
- [ ] Shortlist CSV/manifest export and manifest import work.
- [ ] `site/data/annotations.json` loads and a gene's collapsed annotation
  evidence renders correctly.
- [ ] ViennaRNA WebAssembly loads and a fold completes; cancellation still works.
- [ ] Desktop and phone layouts have no horizontal overflow.
- [ ] Dataset provenance and third-party attribution are visible.

Release record:

| Item | Value |
| --- | --- |
| Deployed commit | |
| GitHub Actions run | |
| Pages URL | |
| Deployment date | |
| Smoke-test browser/device | |
| Smoke-test result | Pass / Fail |
| Reviewer | |

## 7. Completion criteria

The work is fully resolved only when all of the following are true:

- [ ] The intended panel has a completed biological review and saved manifest.
- [ ] Every external evidence source has an acquisition or waiver decision.
- [ ] The full automated gate passes on the deployed commit.
- [ ] The reviewed commit is pushed and Pages deployment succeeds.
- [ ] The production smoke test passes and the release record is complete.
- [ ] `A_gene-diversity-site__20260918` and
  `A_data-annotation-release-readiness__20260918` are resolved according to the
  repository ticket lifecycle: preserve only reusable runbook guidance, remove
  their index rows, and delete the resolved ticket files.

## Issues found during review

Record defects here or open a new ticket if they require code, data, or
configuration changes.

| Date | Area | Observation | Severity | Resolution or ticket |
| --- | --- | --- | --- | --- |
| | | | | |
