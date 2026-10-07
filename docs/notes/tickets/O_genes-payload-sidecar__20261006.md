# O_genes-payload-sidecar__20261006 — Open

- **Scope:** Keep `genes.json` inside its per-gene budget by moving the two
  largest per-gene fields out of the file the map waits for, and bring the
  chromosome loading bar back whenever a data file is requested after the first
  load cycle has settled. Covers `scripts/`, `tools/`, `site/`,
  `docs/validation/data-contract.md`,
  `docs/validation/progressive-loading.md`, and their tests.
- **Status:** active
- **Opened:** 2026-10-06
- **Updated:** 2026-10-07

## Current State

Nothing is implemented. The split the data contract names as the remedy for an
oversized core payload has never been built, and the budget is nearly spent.

Measured on the shipped release, 2026-10-06:

| Quantity | UTEX 2973 | E. coli K-12 MG1655 |
| ---: | ---: | ---: |
| plotted genes | 2,715 | 4,287 |
| `genes.json` bytes | 5,169,989 | 8,042,652 |
| bytes per gene | 1,904 | 1,876 |
| budget, bytes per gene | 2,000 | 2,000 |
| headroom, bytes per gene | 96 | 124 |
| `rscu` bytes per gene | 394 | not measured |
| `codons` bytes per gene | 299 | not measured |
| per gene without both fields | 1,211 | not measured |

After integration on `main` at `deeabc3`, measured on the published files:

| Quantity | UTEX 2973 | E. coli K-12 MG1655 |
| ---: | ---: | ---: |
| `genes.json` bytes | 4,079,627 | 6,310,634 |
| bytes per gene | 1,503 | 1,472 |
| headroom, bytes per gene | 497 | 528 |
| `codon_rscu.json` bytes | 1,112,123 | 1,736,346 |

Two findings decide the shape of the work.

**`rscu` has no browser consumer.** Across all of `site/` the only reference is
`dataset.meta.rscuOrder`, read for feature labels at
`site/js/core/projection-help.js:58`. The per-gene 59-float array is read only
offline, by `tools/validate_contract.py:629`, `tools/audit_pca_length.py:59`,
and `scripts/build_features.py:1310`, which fits the native codon PCA whose
result already ships separately as `codon_pca.json`. The field is 21% of the
critical-path payload and the page never opens it. Moving it changes no runtime
behaviour and recovers four times the current headroom on its own.

**`codons` is on the critical path.** `buildCoreDataset` in
`site/js/core/dataset.js:107` and `:134` decodes every gene's packed string to
build the scheme-metric arrays, so target counts, every delta against wild type,
and the map's scheme-dependent colour all rest on it. The gene sequence view,
the folding and Rosetta hand-offs, and the export manifest read it too. Moving
this field is a real change to what the page waits for, not a transparent one.

The architecture already has the right precedent. `expression_layers.json` is a
joined sidecar whose gene order is checked before the join, and
`site/js/core/data-files.js` declares a tier per file under a stated rule: every
file starts downloading at once, and a tier says what the page waits for and
draws first, never what it delays. The budget gate is
`GENES_JSON_BYTES_PER_GENE` with `check_genes_json_budget` in
`tools/validate_contract.py`, called at `:1785`.

The queue has more than thirty sources waiting under
[O_licence-unblocked-sources__20261006](O_licence-unblocked-sources__20261006.md).
Per-gene additions land against 96 bytes, and the budget gate is
release-blocking, so the next few additions stop a publish until this is done.

## Requirements

1. **Done 2026-10-07, integrated on `main` at `deeabc3`** (DEM-266 result
   `841477a`). `rscu` now ships as `codon_rscu.json` per organism, keyed to
   `genes.json` order by `geneIds`, with the browser never fetching it. The core
   payload dropped as measured below. Original requirement:
   **move `rscu` out of `genes.json` first, as its own change.** Publish it as a
   separate file beside the other payloads, keyed to `genes.json` order the way
   `expression_layers.json` is. Nothing in `site/` requests it, so it joins no
   tier and the browser must not fetch it. `meta.rscuOrder` stays in `meta.json`
   as the column order. Point the three offline readers at the new file.
2. **Decide `codons` separately and record the decision.** After step 1 the
   budget is comfortable, so this is a choice rather than a forced move. If it
   does move, it is a declared tier-1 file, because the page cannot draw
   scheme-dependent colour without it: its absence reads as loading and never as
   missing, and no scheme metric, delta, or target count may be drawn, exported,
   or ranked from a partial decode. Do not move it merely because the contract's
   original sentence named it.
3. **Done 2026-10-07, on `main` at `a9ccd3b` and `1f7aba4`.** Delivered by the
   loading stream, which owns this surface. The cycle restarts automatically
   when a settled loader moves to pending, names the exact filename, keeps the
   old byte total out of the denominator in both preview treatments, preserves a
   concurrent resource load, and settles into a terminal error with retry.
   `docs/validation/progressive-loading.md` was updated in the same commit.
   Verified by that stream at 375, 768, 1280 and 1440 px with one bar on a real
   after-settle request. Confirmed here independently: both commits touch only
   `site/js/ui/load-progress.js`, its contract and its tests, with no payload,
   pipeline, budget-gate, data-contract or index edit, and
   `node --test tests/js/load-progress.test.mjs` reports 31 passed, 0 failed.
   The original requirement, kept for the record: once the first cycle has
   completed and the progress presentation is hidden, any newly requested data
   file brings the same chromosome bar back, with its subtext naming the file
   being loaded, settling again on completion or on an actionable failure,
   covering a sidecar fetched on demand, a newly selected dataset, and an
   organism change, with no second meter. Once
   the first cycle has completed and the progress presentation is hidden, any
   newly requested data file brings the same chromosome bar back, with its
   subtext naming the file being loaded, and settles again on completion or on an
   actionable failure. This covers a sidecar fetched on demand, a newly selected
   dataset, and an organism change. The single-surface rule, completion
   semantics, and the audit of existing loading entry points stay with
   [A_unify-chromosome-loading__20261006](A_unify-chromosome-loading__20261006.md);
   coordinate per-dataset loading with
   [O_data-sources-selection__20261005](O_data-sources-selection__20261005.md).
   Do not add a second meter.
4. **Hold the integrity rules.** Every generated file stays byte-for-byte
   reproducible except `meta.builtAt`, and
   `tools/build_data_manifest.py build` runs last. The new file gets its manifest
   entry with byte size and SHA-256, and the site addresses it by digest.
5. **Keep the budget gate meaningful.** It must keep measuring the file the map
   waits for, for every organism, from that file's own gene count. Add the
   checks the sidecar precedent already has: gene order against `genes.json`,
   column count against `meta.rscuOrder`, coverage, and no value duplicated
   between the two files.
6. **Preserve missing-value semantics.** A null stays null in the new file and
   renders as unknown. Loading is not missing, and absent is not zero.
7. **Amend both contracts in the same patch.** The data contract's size-budget
   section currently prescribes a remedy that does not exist and names both
   fields together; it must describe what was actually built. Record the tier,
   the join, and the bar's return in
   `docs/validation/progressive-loading.md`.

## Ownership and parallel work

**Dispatched 2026-10-07.** The payload stream is Multica issue DEM-266, assigned
to `claude-implementer` on an isolated worktree off `main` at `faded9d`, carrying
requirements 1, 4, 5, 6 and the data-contract half of 7 with the loading surface
excluded by name. The loading stream was handed requirement 3 and the
progressive-loading half of 7 in the session already holding that surface. The
third live session was told this ticket is claimed. The coordinator is the
interactive session `cyano-contract-audit`.

Recorded 2026-10-07 to keep concurrent sessions off each other's files. Three
cyano sessions and the loading issues DEM-261, DEM-263 and DEM-265 are live, and
the loading surface is already owned elsewhere. Requirements split by stream:

| Requirements | Stream | Owner | May touch |
| --- | --- | --- | --- |
| 1, 4, 5, 6, and the data-contract half of 7 | payload | this ticket, dispatched to a single implementer in an isolated worktree | `scripts/`, `tools/`, `site/data/`, `site/js/core/data-files.js` only if a file entry is needed, `docs/validation/data-contract.md`, `tests/` |
| 3, and the progressive-loading half of 7 | loading surface | [A_unify-chromosome-loading__20261006](A_unify-chromosome-loading__20261006.md) and its live run | `site/js/ui/load-progress.js`, `site/js/app.js` boot and reveal, `site/index.html`, the loading stylesheet, `docs/validation/progressive-loading.md` |
| 2 | decided, no work | — | — |

Rules while both streams are open:

- The payload stream must not edit `docs/validation/progressive-loading.md`,
  `site/js/ui/load-progress.js`, the loading markup or its stylesheet, and must
  not add a progress surface. If the sidecar ever needs a browser fetch, it
  states the need here and the loading stream implements it.
- The loading stream must not edit `genes.json`, the pipeline, the budget gate,
  or the data contract's size-budget section.
- Index ownership is scoped, corrected 2026-10-07 after the loading stream
  reported that the first wording blocked its own completion cleanup. The
  coordinator owns only the two rows for this ticket and for
  [A_unify-chromosome-loading__20261006](A_unify-chromosome-loading__20261006.md),
  and owns integration. Every other stream keeps the repository's standing rule
  that a resolved ticket's row is removed during its own cleanup. A stream whose
  row the coordinator holds sends its acceptance status and the coordinator
  removes the row then, never before.
- `site/data/` is regenerated only by the payload stream. Because the content
  manifest is the loading bar's denominator, the loading stream rebases onto the
  payload commit rather than regenerating data itself.

## Implementation Notes

- Pipeline: `scripts/build_features.py` writes `rscu` today at `:1289` and
  consumes the matrix at `:1310`. The PCA fit reads the in-memory matrix, so it
  does not need the field to ship in the core file.
- Site: `site/js/core/data-files.js` for the file table and tiers,
  `site/js/core/dataset.js` for the join and the codon scan,
  `site/js/ui/load-progress.js` and `site/js/app.js` for the bar's return.
- Fixtures are generated, not committed, so `tests/fixtures/make_fixture.mjs`
  needs the new shape and both fixture variants must still build.
- E. coli publishes its own release root, so the new file is per-organism and
  an unconfigured organism's absence must stay truthful.

## Verification

Payload stream verified and integrated 2026-10-07 at `deeabc3`, run
independently by the coordinator before the merge, not taken on report:

| Gate | Result |
| --- | --- |
| `validate_contract.py`, UTEX 2973 | 116 passed, 0 failed, 1 skipped |
| `validate_contract.py`, E. coli | 76 passed, 0 failed, 1 skipped |
| `check_live_metrics.mjs`, both organisms | `failed=0`, parity within `1e-6` |
| `check_utex_build_identity.py` | byte-identical, `meta.builtAt` the only normalization |
| `pytest -q` | 494 passed, 1 skipped, 36 subtests |
| `npm test` | 1,109 passed, 0 failed |
| `build_data_manifest.py check` | manifest matches the files beside it |
| module preloads, load bar | both match |

Each validator's sole skip is the declared spliced-CDS contiguity exemption, so
the release gate's `skipped=1` expectation still holds. The pass count rose from
110 to 116 for UTEX, the six new checks being the sidecar gate. No rendered
browser validation was run or needed for the payload change, which has no
visible surface; the loading stream's own rendered checks cover requirement 3.

Loading stream verified by its owner and confirmed here; see requirement 3.

Remaining before this ticket resolves:

- The progressive-loading half of requirement 7, against the now-published tier
  and join, owned by the loading stream.
- Manifest-dependent loading verification against `deeabc3`, owned by the
  loading stream, since the content manifest its bar reads as a denominator has
  changed.

Earlier scoping, kept for the record:

- `.venv/bin/python tools/validate_contract.py --data-dir site/data --raw-dir data/raw`
  and the same with `--organism ecoli-k12-mg1655`, reporting the new file's
  checks and both organisms' budget figures.
- `node tools/check_live_metrics.mjs` for both organisms, with metric parity
  unchanged within `1e-6`, which is the check that catches a decode the split
  broke.
- `npm test`, `.venv/bin/python -m pytest -q`,
  `.venv/bin/python tools/check_utex_build_identity.py`, and
  `.venv/bin/python tools/build_data_manifest.py check`.
- Rendered checks at 375, 768, 1280, and 1440 px with a throttled network: one
  progress bar only, the bar returning for a post-settle file request with
  correct subtext, no premature completion, no horizontal overflow, no console
  errors, and reduced motion respected. A forced failure on the new file must
  settle into an actionable retry rather than an endless bar.

Ticket-creation checks, 2026-10-06, against the working tree before any code
change: measurements above computed from the shipped `site/data/genes.json`;
consumers of both fields enumerated by search across `site/`, `tools/`,
`scripts/`, and `tests/`. The gates below were run at creation and describe the
tree as it stands, not the requested behaviour, which remains unimplemented:
`git diff --check` printed nothing; `.venv/bin/python tools/validate_contract.py`
reported 110 passed, 0 failed, with the one declared spliced-CDS contiguity
skip; `npm test` reported 1,094 passed, 0 failed;
`.venv/bin/python -m pytest -q` reported 486 passed, 1 skipped, 36 subtests
passed. No application code changed for ticket creation.

## Cleanup

On acceptance, rename the file and H1 to `R_`, set `Status: resolved`, and
record final validation. Distil the payload-split rule, the new file's contract,
and the bar's post-settle return into `docs/validation/data-contract.md` and
`docs/validation/progressive-loading.md`, update `docs/validation/INDEX.md`,
then delete this ticket and remove its queue row.
