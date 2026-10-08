# Strain fitness layer

`strain_fitness.json` is the first admitted layer whose row unit is a strain
rather than a gene. It colours no gene, filters no map, and is reachable only
from the **Strain fitness** tab. The reader is `site/js/core/strain-fitness.js`;
the tab is `site/js/ui/strain-fitness.js`.

The layer is **organism-neutral**. It is not in `STUDY_LAYER_KEYS`, so the
loader asks for it in every organism's data directory and a release that does
not publish it settles as `absent`. The file itself declares which organism and
assembly it belongs to, and the validator refuses it against the dataset's own
— without that, a file copied into the wrong data directory would be drawn
under another organism's labels. Never add `strainFitness` to a metric, colour,
or axis registry: those are registries of per-gene values, and no gene has one
of these.

It loads in **tier 5**, alone, after every per-gene layer. Nothing the map or
the gene detail draws waits on it, which is why a file that cannot be read
costs only its own tab.

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
| the release publishes no layer | `Strain fitness measurements are unavailable in this dataset.` |
| the file is still in flight | `Loading strain fitness measurements…` |
| the file failed its schema | `Strain fitness measurements could not be loaded.` plus the loading tail's named failure and its Retry |

A malformed layer leaves the gene application untouched: the map, its colours
and every other tab still work.

## Export

Two TSVs, `growthTsv` and `wellsTsv`. Each is a `#`-prefixed preamble of fixed
key-value lines — organism, provenance class, citation, DOI, study id, source
file and its SHA-256, retrieval date, comparison strain, every declared unit,
the selection, and the row count — then a header row, then the rows.

Rows are sorted by strain, condition, plate, well and record id, not by their
order in the file, so one selection is one byte string however the source was
written. `NA` marks an absent value, never an empty cell, so a missing value and
a zero stay distinguishable in the same column. Tabs and newlines inside a
source label are collapsed to spaces. Replicates are written `1=24.1;2=NA;3=25`.

## Validation

Automated: `tests/js/strain-fitness.test.mjs` (schema refusals, selection,
export determinism, and the layer through the staged loader) and
`tests/js/strain-fitness-panel.test.mjs` (the rendered states). Both read the
layer the fixture generator builds, so the fixture and the reader cannot drift.

Fixtures: `npm run generate:test-fixtures` writes
`tests/fixtures/data-strain-fitness/`, which carries every state the panel must
draw — a strain that did not grow, a measured zero beside an unmeasured null, a
replicate series missing replicate 2, and signed Biolog values. It declares
itself `synthetic-test-fixture`; nothing in it is a measurement.

Rendered, from this checkout on a task-specific port:

```sh
python3 -m http.server <port> --bind 127.0.0.1 --directory "$PWD"
mkdir -p .playwright-cli/<session>/data-malformed
cp tests/fixtures/data-strain-fitness/*.json .playwright-cli/<session>/data-malformed/
# Give the copy a no-growth row with a doubling time, which the schema refuses:
python3 -c "import json,pathlib;p=pathlib.Path('.playwright-cli/<session>/data-malformed/strain_fitness.json');d=json.loads(p.read_text());d['growth']['records'][5]['doublingTimeMinutes']=90;p.write_text(json.dumps(d,indent=1)+chr(10))"
PLAYWRIGHT_MCP_OUTPUT_DIR="$PWD/.playwright-cli/<session>" playwright-cli -s=<session> \
  open "http://127.0.0.1:<port>/site/index.html?uiArtifacts=$PWD/.playwright-cli/<session>"
playwright-cli -s=<session> run-code --filename=tools/ui/check_strain_fitness.js
```

The check script names its own fixture directories and uses
`.playwright-cli/dem-312-strain-fitness/data-malformed/` for the malformed one;
point it elsewhere by editing `fixtures` at the top of the script. It walks full
data, the no-growth row, the expanded units block, a narrowed selection, a
keyboard pass over the tablist and the panel's controls, both downloads, the
absent layer and the malformed one, at 375, 768, 1280 and 1440 and on both
sides of the 960 px and 1240 px column breakpoints. It fails on page overflow,
on anything outside the panel, on a table that escapes its scroller or cannot
be scrolled to, on a cell clipped inside its own column, and on any console or
page error other than the 404 an absent optional file produces.

Inspect the screenshots as well as the assertions. Two repairs came from
looking rather than from asserting: `overflow-wrap: anywhere` on automatic
table layout collapsed the strain column to one character per line, which the
fixed `colgroup` widths now prevent; and the shared `.numeric` rule's
`white-space: nowrap` kept a declared unit and a replicate series on one line
and cut them off inside their columns, which `.fitness-table .numeric` now
overrides. Both were invisible to an assertion on text content.

Also apply the repository's [release gate](release-gate.md) before publication.
