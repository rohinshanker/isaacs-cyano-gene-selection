# Validation and experimental-use checklist

Use this document to validate and publish the UTEX 2973 gene-selection site, and
to review an exact exported panel before experimental use. Those are separate
acceptance decisions. Automated checks prove that data and outputs reproduce in
the tested environment; they do not approve a biological design or replace a
dependency/toolchain reproducibility policy.

The production site is
[rohinshanker.github.io/isaacs-cyano-gene-selection](https://rohinshanker.github.io/isaacs-cyano-gene-selection/).

## Recommended order

For a site release, complete the interface checks, confirm the external-source
dispositions, run the complete gate on the intended commit, review the diff,
deploy, and smoke-test production. Review an exact exported 6–10-gene panel under
section 2 only when it may become an experiment plan. Site publication does not
require choosing or approving a panel; experimental use does.

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

## 3. Confirm external evidence and licensing decisions

An explicit, documented waiver is acceptable. A silent guess or a product-name
substitute is not. Record the decision, rationale, source version, license, and
reviewer for every row.

| Source or review | Current release disposition | Admission condition for a future release |
| --- | --- | --- |
| UniProt | Waived; no UniProt assertions. Release `2026_03` returned zero records for proteome `UP000031358` and taxid 1350461 on 2026-09-19. | Nonempty dated export, checksum, and explicit RefSeq relationships. |
| Rubin PCC 7942 essentiality | Waived; no calls or derivative table redistributed. | Recorded redistribution terms plus an ambiguity-preserving, visibly cross-strain join. |
| KEGG | Waived; no KEGG relationships included. | Authorized access, pinned artifact, acceptable publication terms, and explicit identifier links. |
| CyanoOmicsDB | Waived; no bulk data imported. | Verify the exact artifact version, bytes, data licence, and UTEX mapping. |
| CAI reference-set audit | The published set remains a reproducible reference convention, not measured high expression. See [`cai-reference-set.md`](cai-reference-set.md). | Independently reviewed labels and a validated change policy before changing membership. |

These dispositions are release decisions, not claims that the sources lack value.
The ranked acquisition backlog and per-source gates are in
[`future-data-roadmap.md`](future-data-roadmap.md).

Any TypeSafe/Jev audit record must preserve the exact labels and no-match
outcome, the reviewed evaluation sample and its limitations, error counts,
model/service version, run date, threshold or explicit no-automatic-change
policy, and the final human decision. The current CAI audit records all of these
in [`cai-reference-set.md`](cai-reference-set.md).

Preserve NCBI, Gene Ontology, expression-study, and ViennaRNA attribution in
redistributed data, screenshots, presentations, and publications. Gene Ontology
data are redistributed here under CC BY 4.0; keep the notice and description of
mapping changes in `data/annotation/PROVENANCE.md`.

## 4. Run the complete automated gate

Run from the repository root on the exact commit intended for publication. If
the raw files are missing, first run `./tools/fetch_genome.sh data/raw` and
`python3 tools/annotation_release.py fetch`.

Do not publish until the automated gate passes and the intended commit has a
clean worktree.

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
- [ ] 20 readiness, audit-integrity, and negative-fixture tests pass.
- [ ] Contract validator reports `passed=62 failed=0 skipped=1`; the sole skip
  is the declared contiguity exemption for the three discontinuous CDSs.
- [ ] Every live-genome check passes, including protein preservation and metric
  parity within `1e-6`.
- [ ] 276 JavaScript tests pass, including static HTML/CSS, module, worker, and
  required runtime-asset resolution.
- [ ] 134 Python tests pass.
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
- [ ] Confirm the intended commit is on `main` and Pages still uses the gated
  GitHub Actions workflow.

## 6. Publish and smoke-test

1. Push the reviewed `main` commit to the intended GitHub remote.
2. Confirm Pages uses **GitHub Actions** as its source.
3. Wait for `.github/workflows/pages.yml` to finish both `validate` and `deploy`.
4. Record the workflow URL, deployed commit, and Pages URL below.
5. Run the production smoke test.

Production smoke test:

- [ ] The Pages URL loads over HTTPS without console or network errors.
- [ ] The map and all 2,715 site genes load.
- [ ] Search, filters, schemes, selection, and map controls work.
- [ ] A shared URL restores the intended state in a fresh browser session.
- [ ] Shortlist CSV and manifest export work; the automated gate covers panel-manifest
  round-trip import.
- [ ] `site/data/annotations.json` loads and a gene's collapsed annotation
  evidence renders correctly.
- [ ] ViennaRNA WebAssembly loads and a fold completes; cancellation still works.
- [ ] Desktop and phone layouts have no horizontal overflow.
- [ ] Dataset provenance and third-party attribution are visible.

Release record:

This is a reusable template. Store completed values with the lab's release
record rather than turning this validation document into a release history.

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

A **site release** is complete when every included or omitted external source has
an explicit disposition, the full automated gate passes on the deployed commit,
the gated Pages workflow succeeds, and the production smoke test passes.

An **experimental panel review** is complete only when the exact exported
manifest has a scientific reviewer, the section 2 checks are recorded with the
lab record, and the reviewer explicitly approves or rejects experimental use.
Never infer panel approval from a successful site release.

Open a ticket for any defect that requires code, data, or configuration changes;
do not use this reusable checklist as a defect ledger.
