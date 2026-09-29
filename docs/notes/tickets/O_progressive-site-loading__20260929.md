# O_progressive-site-loading__20260929 — Open

- **Scope:** Revise how the site loads. Replace the blank page and its single
  "Loading gene data…" line with a complete-looking shell that is present from the
  first paint, a loading-bar overlay that reports real progress, and data fetched
  in priority order so the map is usable before the secondary evidence arrives.
  Covers `site/index.html`, `site/css/`, `site/js/app.js`,
  `site/js/core/dataset.js`, their tests, and the validation documents that state
  the loading and missing-value rules. No change to `site/data/*.json` content or
  to any displayed value.
- **Status:** open
- **Opened:** 2026-09-29
- **Updated:** 2026-09-29

## Current state

Nothing has been built. The owner asked for this ticket on 2026-09-29 and asked
that no work begin yet.

How the site loads today, read from `main` at `19a3569`:

- `site/index.html` ships the whole page structure, but `<main id="main">`, the
  compare section, the panel-design section, and the footer all carry `hidden`
  until the data has loaded. What the visitor sees in the meantime is the header
  and one line, `<p id="load-status">Loading gene data…</p>`.
- `boot()` in `site/js/app.js` awaits `loadDataset()` and only then un-hides
  everything and builds the map, the selectors, and the panels.
- `loadDataset()` in `site/js/core/dataset.js` requests all thirteen data files in
  one `Promise.all`, with no ordering, and resolves only when the slowest one has
  arrived and every validation and join has run. The citations manifest is fetched
  beside it and is already non-blocking.
- Every request uses `cache: 'no-cache'`, so each visit revalidates every file.
- There is no progress signal of any kind: no bar, no count, no per-file state.

The thirteen files total about 12.4 MB uncompressed. The published host compresses
JSON in transit, so the transferred size is smaller, but the ordering is what
matters here:

| File | Bytes | What it feeds |
| --- | ---: | --- |
| `genes.json` | 5,169,989 | Every map, every metric, the chromosome view, search, the shortlist |
| `annotations.json` | 1,587,449 | Gene detail annotation evidence, GO rows |
| `regulatory_tss.json` | 1,572,876 | Regulatory sites tab |
| `tss_evidence.json` | 1,193,977 | Per-gene Tan 2018 start sites, gene visualizer, chromosome tick row |
| `source-derived-categories-v1.json` | 612,250 | Derived function-category colour |
| `pcc7942-essentiality-v1.json` | 603,979 | Borrowed essentiality in gene detail |
| `candidate_evidence.json` | 542,111 | Candidate evidence in gene detail and comparison |
| `go-iea-essentiality-v1.json` | 454,699 | GO IEA essentiality context |
| `length_cohorts.json` | 449,136 | Lengths tab, protein-evidence filter |
| `go-term-names-v1.json` | 126,065 | GO term names in gene detail |
| `citations.json` | 27,145 | Citations tab, source lines |
| `meta.json` | 26,958 | Metric registry, release identity, every label |
| `function-categories-v1.json` | 7,250 | Reviewed function-category colour, the fresh-view default |
| `codon_pca.json`, `excluded.json` | 5,774 | PCA loadings table, excluded-loci note |

## Requirements from the owner

1. **The shell is present from the first paint.** Everything that needs no data is
   rendered immediately: the header, the tab row, the controls column with its
   panels, the map frame, the gene detail column, the comparison and panel-design
   sections. The page should look complete rather than blank.
2. **A loading-bar overlay for the data**, showing real progress.
3. **Data loads by priority.** Genes matter more than TSS data; the order below is
   the proposal.
4. **Still fast and efficient.** Progress reporting and staging must not make the
   total load slower than the present single parallel fetch.
5. **Suggestions are proposals.** Anything beyond the three items above is listed
   under "Suggestions for approval" and is built only after the owner approves it.

## Proposed design, for the implementer to confirm or correct

### Priority tiers

All tiers start downloading at once, so the network is never idle; priority
decides what the page *waits for* and what it renders first, not what it delays.

| Tier | Files | The page becomes |
| --- | --- | --- |
| 1, blocking | `meta.json`, `genes.json`, `function-categories-v1.json` | Usable: map drawn in the fresh-view colour, tabs, selectors, search, filters on registry metrics, shortlist, chromosome view |
| 2, colour and filter evidence | `source-derived-categories-v1.json`, `length_cohorts.json`, `codon_pca.json`, `excluded.json` | Complete on the default view: derived category colour, protein-evidence filter, loadings table |
| 3, per-gene evidence | `tss_evidence.json`, `annotations.json`, `candidate_evidence.json`, `pcc7942-essentiality-v1.json`, `go-iea-essentiality-v1.json`, `go-term-names-v1.json` | Complete in gene detail, the gene visualizer, and the chromosome tick row |
| 4, tab-specific | `regulatory_tss.json`, `citations.json` | Complete on the Regulatory sites and Citations tabs |

A shared link changes what is blocking: a hash that opens the Regulatory sites tab
or pins a gene promotes the files that view needs into the waited-for set, so a
link never opens onto a view still missing its own data.

### Shell

Remove `hidden` from the structural containers and render them in a not-yet-loaded
state: panels present with their headings and disabled controls, the map frame at
its final size with no marks, the tab row present with tabs disabled until tier 1
lands. Layout must not shift when data arrives; each container reserves its final
dimensions under [responsive-workspace.md](../../validation/responsive-workspace.md).

### Loading bar

A determinate bar over the map frame, not a full-page blocker, so the shell stays
visible behind it. It reports bytes received over bytes expected across the tiers,
names the tier in progress in plain words, and is announced to assistive
technology through a `progressbar` role with a throttled live description. It
leaves when tier 1 has rendered; tiers 2 to 4 continue under a slim, non-blocking
indicator so the visitor can already work.

## Constraints that are not negotiable

These come from contracts this repository already holds, and the ticket must not
weaken them:

- **Loading is not missing.** A value whose file has not arrived yet must render as
  *loading*, visibly distinct from *absent*. It must never appear as zero, as
  unknown, as "no evidence", or as an empty outline that reads as a missing
  measurement, under the missing-value rules in
  [data-contract.md](../../validation/data-contract.md) and
  [candidate-comparison-and-export.md](../../validation/candidate-comparison-and-export.md).
  A gene detail card opened before tier 3 lands says its evidence is still
  loading; it does not say the gene has none.
- **Exports wait.** An export, a panel design, or a comparison that reads a field
  from a tier that has not landed is blocked with a stated reason until it has,
  so a partial dataset can never be written into a manifest.
- **Validation and joins still run.** Every check `loadDataset` performs today
  still runs on every file; staging changes when, not whether. A file that fails
  validation reports the failure exactly as it does now.
- **Optional files stay optional.** A missing optional file completes its tier
  rather than holding the bar at less than full.
- **The `file:` notice still works.** The classic inline script that explains why
  a double-clicked page cannot load must keep running before any module does.
- **URL state is unchanged.** No change to the hash format, its version, or its
  precedence, per [viewer-interaction-state.md](../../validation/viewer-interaction-state.md).
- **No new dependency**, and no service worker without explicit approval below.

## Suggestions for approval

Each is independent. None is built until the owner approves it, here, by name.

| # | Suggestion | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- | --- |
| S1 | Skeleton placeholders in the panels and the gene detail card, in the shape of the content to come | The page reads as complete and stable while loading | Small CSS; must respect reduced-motion | pending |
| S2 | Preload hints (`<link rel="preload">`) for the tier 1 files and the entry module | Tier 1 starts downloading before the script is parsed | None of substance; must list the right files | pending |
| S3 | Replace `cache: 'no-cache'` with revalidation keyed on the release identifier in `meta.json` | Repeat visits load from cache; the largest single speed gain available | A stale-data risk if the key is wrong, so it needs a test that a new release always refetches | pending |
| S4 | Split `genes.json` into a small core (coordinates, identity, default metrics) and a deferred remainder | Tier 1 shrinks from about 5.2 MB to a fraction of it | A pipeline and data-contract change, outside this ticket's stated scope; would need its own ticket | pending |
| S5 | Show the release identity and gene count in the shell as soon as `meta.json` lands | The visitor sees what is loading within the first moments | None of substance | pending |
| S6 | A per-tier retry control when one file fails, instead of failing the whole page | One flaky request no longer costs the visit | More states to test; failure wording must stay exact | pending |
| S7 | Draw the map progressively as `genes.json` streams in | Marks appear before the file completes | Streaming JSON parsing is complex and conflicts with validating the file whole; likely not worth it | pending |
| S8 | Record and display load timing in the console, behind a query flag | Makes the "still fast" requirement measurable on real devices | None of substance | pending |

## Acceptance criteria

- The first paint shows the full shell at mobile, tablet, and desktop widths, with
  no layout shift when data arrives.
- The loading bar is determinate, reaches completion, and is announced accessibly.
- The map is interactive after tier 1 alone, measured on a throttled connection.
- Time to a complete page is no worse than `main` at `19a3569` on the same
  throttled profile, measured and recorded, not estimated.
- A gene detail card opened before its evidence lands shows a loading state, and
  the same card after landing shows the same values `main` shows today.
- A shared link to each tab, and one with a pinned gene, opens onto a view that
  has its own data.
- One failing optional file, one failing required file, and an offline reload each
  behave as specified, with the exact message shown.
- An export attempted before its tiers land is refused with a reason.

## Verification

Not started. This is visible UI work: render the real site over HTTP and inspect
the loading sequence itself, on a throttled network profile, at mobile, tablet,
and desktop widths, with reduced motion on and off. Source inspection is not
enough, and a fast local connection hides every state this ticket is about.
Record the before and after timings. Then the three gates:

```sh
npm test
.venv/bin/python -m pytest -q
.venv/bin/python tools/validate_contract.py
```

Review by the other provider's reviewer on the exact commit, with an independent
rendered inspection of the loading states, as the chromosome tab had.

## Claude Science claims

None. This ticket changes when values appear, never what they mean, so none of the
five triggers in
[claude-science-handoff.md](../../validation/claude-science-handoff.md#what-must-not-land-without-a-claude-science-claim-or-package)
fires. If the work is found to change a label, a caveat, or a missing-value
rendering, that step stops and a claim row is added here.

## Cleanup

On resolution, distil the tier table, the loading-versus-missing rule, the
export gate, and the throttled rendered checks into a loading contract in
`docs/validation/`, update `validation/INDEX.md`, record each suggestion's final
decision there, then delete this ticket and its index row.
