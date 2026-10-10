# Strain fitness layer

Whole-strain fitness datasets are the first admitted layers whose row unit is a
strain rather than a gene. They colour no gene, filter no map, and are reachable
only from the **Strain fitness** tab. The schema reader is
`site/js/core/strain-fitness.js`; catalogue selection and loading are in
`site/js/core/strain-fitness-datasets.js`; the tab is
`site/js/ui/strain-fitness.js`.

Each organism owns a `strainFitnessDatasets` catalogue. An organism with no
entries makes no request; every admitted entry has a stable id, visible label,
and payload file. The file itself still declares which organism and assembly it
belongs to, and the validator refuses a mismatch. Never add a whole-strain
catalogue entry to a metric, colour, axis, or gene-filter registry: those
registries contain per-gene values, and no gene has one of these.

The catalogue loader is independent of the staged gene loader and starts the
active payload lazily when the tab is rendered. Each dataset has its own
idle/loading/ready/failed record and retry attempt. Nothing the map or gene
detail draws waits on it. A response is stored only under the dataset id that
requested it; attempt tokens also prevent an older request from replacing a
newer retry. Manifest-addressed responses must match both the declared byte
length and SHA-256. A stale cached response is reloaded once; a second mismatch
fails closed. The single-step `loadDataset` tool contract still validates the
legacy `strain_fitness.json` path for directory validators.

## Dataset selection

The local whole-strain choice is `fitnessDatasetId` (`fd` in a shared link).
It is separate from strain, condition, search, and page filters. Switching the
dataset clears those subordinate filters and page before the new payload is
shown, so ids from one schema cannot silently filter another.

Data Sources carries whole-strain choices in its separately typed
`strainFitnessSources` collection (`fds` in a shared link). Its checkboxes use
catalogue ids directly. Exactly one checked dataset takes over and the local
selector is hidden. With two or more checked, the app never pools or chooses:
it keeps the local choice, shows the selector, and states the ambiguity. A
per-gene source id has no representation path into this collection, even when
it shares a study or citation with the whole-strain payload.

## Schema

One file, `schemaVersion: 1`. Strains, conditions and plates are declared once
and referenced by id, so a label cannot disagree with itself between rows and
the file stays small over several thousand wells. `growth` and `biolog` may each
be `null`; at least one must be present.

```jsonc
{
  "schemaVersion": 1,
  "organismId": "ecoli-k12-mg1655",      // must equal the organism on screen
  "genome": { "accession": "GCF_000005845.2" },  // must equal meta.genome.accession
  "provenanceClass": "published",        // or "synthetic-test-fixture"
  "source": {
    "citation": "Nyerges et al. 2026, Nature",   // required
    "doi": "10.1038/...",                // or null
    "studyId": "PMID42331836",           // or null; the short name a row carries
    "sheet": "Fitness_Source_data",      // or null
    "sourceFile": "Supplementary_Data_2.xlsx",   // required
    "sourceFileSha256": "<64 hex>",      // required: the layer is pinned
    "retrieved": "2026-10-07",           // required, YYYY-MM-DD
    "comparedAgainst": "MDS42"           // or null when the source names none
  },
  "strains": [
    { "id": "mds42", "label": "MDS42",   // label is the source's exact wording
      "scheme": { "label": "native", "recoded": false, "segments": null } }
  ],
  "conditions": [
    { "id": "lb-37", "label": "LB, 37 °C, 200 rpm", "description": null }
  ],
  "growth": {
    "units": { "doublingTime": "minutes", "maximumOd600": "OD600, 1 cm path" },
    "metadata": { "replicateDefinition": "biological replicate", "...": "..." },
    "records": [{
      "id": "g-mds42-lb",
      "strainId": "mds42", "conditionId": "lb-37",
      "growthStatus": "reported",        // or "no_growth_detected"
      "doublingTimeMinutes": 24.5, "doublingTimeSdMinutes": 0.8,
      "doublingTimeReplicates": [{ "replicate": 1, "value": 24.1 }],
      "maximumOd600": 1.82, "maximumOd600Sd": 0.05,
      "maximumOd600Replicates": [{ "replicate": 1, "value": 1.8 }]
    }]
  },
  "biolog": {
    "units": {                            // all three required, no defaults
      "value": "maximum curve height, arbitrary units as the source reports them",
      "reference": "MDS42 in the same well",
      "normalization": "none"
    },
    "metadata": { "incubationHours": 48, "...": "..." },
    "plates": [{ "id": "PM1", "label": "PM1 carbon sources" }],
    "records": [{
      "id": "b-mds42-PM1-A01",
      "strainId": "mds42", "conditionId": "biolog-48h", "plateId": "PM1",
      "well": "A01", "substrate": "D-glucose", "value": -0.03
    }]
  }
}
```

## What the validator refuses

Fail-closed: a file that fails any of these does not load, and the tab says the
layer could not be read rather than drawing part of it.

- A `schemaVersion` other than 1, an `organismId` that is not the organism on
  screen, a `genome.accession` that is not `meta.json`'s, or a
  `provenanceClass` outside `published` / `synthetic-test-fixture`.
- A source with no citation, no `sourceFile`, no 64-hex `sourceFileSha256`, or
  no ISO `retrieved` date.
- **A unit, reference or normalization the file does not declare.** Nothing
  here supplies a default. A unit the site invented would be the site's claim
  and not the source's, which matters most for the Biolog values: this build
  asserts nothing about their scale and repeats the source's words verbatim.
- A strain with no explicit scheme. `native` is stated, never implied by an
  absent field: an unmodified parent is a labelled arm of the experiment, and a
  blank scheme cell would read as unknown.
- Two strains or two conditions under one label, a repeated record id, the same
  strain/condition/plate/well measured twice, or a declared strain or condition
  that no record measures.
- **A `no_growth_detected` row carrying a doubling time**, and any doubling
  time of `0`. Zero minutes reads as infinitely fast growth.
- A measurement that is not a JSON number. A `"0"` from a spreadsheet export
  that meant "no value" cannot enter as a measurement; `null` is unmeasured and
  `0` is a measured zero, and the two are distinct everywhere.
- A standard deviation with no value behind it, a negative SD, a negative
  maximum OD600, a well outside `A01`–`H12`, or a replicate series with a
  repeated or non-positive replicate number. Replicate numbers are explicit, so
  a source reporting replicates 1 and 3 is never read as 1 and 2.

Biolog values are signed on purpose: a value below its reference is a result.

## What the tab shows

Every displayed value names its strain, scheme and condition in its own row,
and the persistent selected-context line above the tables names the selection
and the source for the tables as a whole. The declared unit sits under its
column name. A synthetic file carries a warning banner.

Filters are strain-and-scheme, condition, and a substrate/well/plate search.
The well table pages at 40 rows; the page is a reading convenience, and both
exports cover the whole selection rather than the page.

Three states, three sentences, which must not borrow each other's wording:

| State | What the tab says |
| --- | --- |
| the organism admits no dataset | `Strain fitness measurements are unavailable in this dataset.` |
| the active dataset is still in flight | active dataset identity plus `Loading strain fitness measurements…` |
| the active dataset failed | active dataset identity plus `Strain fitness measurements could not be loaded.`, its named error, and `Retry this dataset` |

A malformed layer leaves the gene application untouched: the map, its colours
and every other tab still work.

## Export

Two TSVs, `growthTsv` and `wellsTsv`. Each is a `#`-prefixed preamble of fixed
key-value lines — catalogue dataset id and label, selection origin and origin
ids, organism, provenance class, citation, DOI, study id, source file and its
SHA-256, retrieval date, comparison strain, every declared unit, the subordinate
strain/condition/search selection, and the row count — then a header row, then
the rows. Download names include the catalogue dataset id.

Rows are sorted by strain, condition, plate, well and record id, not by their
order in the file, so one selection is one byte string however the source was
written. `NA` marks an absent value, never an empty cell, so a missing value and
a zero stay distinguishable in the same column. Tabs and newlines inside a
source label are collapsed to spaces. Replicates are written `1=24.1;2=NA;3=25`.

## Validation

Automated: `tests/js/strain-fitness.test.mjs` (schema refusals, filtering, and
export determinism), `tests/js/strain-fitness-datasets.test.mjs` (zero/one/many
catalogues, shared-choice resolution, per-dataset load/failure/retry and races),
and `tests/js/strain-fitness-panel.test.mjs` (rendered states and identity).
They read the layer the fixture generator builds, so the fixture and reader
cannot drift.

Fixtures: `npm run generate:test-fixtures` writes
`tests/fixtures/data-strain-fitness/`, which carries every state the panel must
draw — a strain that did not grow, a measured zero beside an unmeasured null, a
replicate series missing replicate 2, and signed Biolog values. It declares
itself `synthetic-test-fixture`; nothing in it is a measurement.

Rendered, from this checkout on a task-specific port:

```sh
python3 -m http.server 8886 --bind 127.0.0.1 --directory "$PWD"
mkdir -p /tmp/cyano-fitness-selector-20261010/implementer
PLAYWRIGHT_MCP_OUTPUT_DIR="$PWD/.playwright-cli/<session>" playwright-cli -s=<session> \
  open "http://127.0.0.1:8886/site/index.html?uiArtifacts=/tmp/cyano-fitness-selector-20261010/implementer"
playwright-cli -s=<session> run-code --filename=tools/ui/check_strain_fitness.js
```

Use session `browsercyano-fitness-impl-1010` for DEM-350. The check renders the
real production Syn61 catalogue, an absent UTEX catalogue, and temporary
synthetic local-multiple, external, ambiguous, invalid, error/retry, and race
states. Synthetic catalogues and payloads exist only in Playwright network
routes. It covers 375, 768, 1280 and 1440 widths and exact edges 959/960 and
1239/1240. It fails on page overflow, content outside the panel, inaccessible
table overflow, clipped cells, unexpected console/page errors, or failed
requests.

Inspect the screenshots as well as the assertions. Two repairs came from
looking rather than from asserting: `overflow-wrap: anywhere` on automatic
table layout collapsed the strain column to one character per line, which the
fixed `colgroup` widths now prevent; and the shared `.numeric` rule's
`white-space: nowrap` kept a declared unit and a replicate series on one line
and cut them off inside their columns, which `.fitness-table .numeric` now
overrides. Both were invisible to an assertion on text content.

Also apply the repository's [release gate](release-gate.md) before publication.


Replicate values obey their measurement's bounds: a doubling time is positive
and an OD value is nonnegative. A `no_growth_detected` record cannot contain a
measured doubling-time replicate; absent replicates stay null. Segment fields
hold the segment set alone, with medium and stage retained separately in the
condition and source strain label. Source metadata acronyms such as SD and
OD600 retain their capitalization.
