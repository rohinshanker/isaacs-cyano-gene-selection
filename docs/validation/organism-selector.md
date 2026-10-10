# Organism selector and per-organism isolation

Reusable contract for showing more than one organism: how the page knows which
one it is showing, what keeps two organisms apart, how to add a third, and the
checks a change here has to pass.

The registry is `site/js/core/organisms.js`, with one record per organism under
`site/js/core/organisms/`. The selector is `site/js/ui/organism-selector.js`.

## How the organism is resolved

**The address names it, in the query string.** `?org=ecoli-k12-mg1655` is
E. coli K-12 MG1655. No `org` is the default organism, `utex2973`, so every link
written before there was a second organism keeps its meaning, and the canonical
cyanobacterial address carries no `org`. The hash carries the view and is read
under the organism the address names; it has no organism of its own.

**A switch is a full page navigation.** Cyanobacteria is a direct link. The
Recoded E. Coli disclosure contains ordinary links for Syn57 design and the
exact Syn61Δ3(ev5) strain; the conventional E. coli disclosure contains links
for MG1655, MDS42, and DH10B. The browser resets every module, worker, cache, listener, and
the DOM on the way. There is no in-page dataset swap and none should be added.

## Navigation grouping

There are exactly three top-level controls, in this order: **Cyanobacteria**,
**Recoded E. Coli**, **E. coli**. Both E. coli groups are disclosures with real
links. Recoded choices are **Syn57 design**, then **Syn61Δ3(ev5) strain**, with
no fresh default: outside those organisms the trigger names only the group.
The selected recoded trigger and link expose the current page. The conventional
links are **MG1655**, **MDS42 public reference**, and **DH10B public reference**,
in that order. Syn57 is the complete publisher design, not a measured isolate;
its source and interpretation contract is [syn57-design.md](syn57-design.md). MG1655 is shown as the default when no conventional
strain is in view; its accessible name says `default`, not `selected`. On a conventional-strain page the trigger names that strain,
and both the trigger and its matching link expose the current page.

The words "public reference" are part of both affected option labels and the
selected-strain label. Grouping never weakens the organism record's longer
public-reference caveats or implies that either assembly is an experimental
stock. Every option keeps a real `href`; copying, modified clicking, and direct
navigation therefore retain the exact `org` id and that organism's remembered
hash.

Each disclosure uses a button with `aria-expanded` and `aria-controls`, followed
by a named list of links. Enter or Space toggles it; Arrow Down/Up opens it at
the first/last strain; Arrow keys, Home, and End move among links. Escape closes
it and returns focus to the trigger. Tabbing out or pressing elsewhere closes it
without trapping focus.

Each fixed dropdown uses `positionViewportOverlay` to keep a 16 px margin at
both viewport edges and follows scroll, resize, and changes to the header or
trigger size while open. A short trigger can wrap to the left edge on phones;
right-aligning a wider menu to it clips labels without increasing the page's
`scrollWidth`. Check the menu's own bounding rectangle for every strain label,
including the shorter default/MG1655 label. Use CSS gaps for separator spacing;
leading text whitespace can collapse at flex-item boundaries.

The selector mounts once per document. Its outside-press listener lasts until
full-page navigation; resize/scroll listeners and geometry observation run only
while the menu is open. The registry-to-navigation test requires every organism
to appear exactly once, so adding a record also requires choosing its group.

**It is known before the first request.** The classic inline script in
`site/index.html` reads `org`, sets the tab title, and starts the manifest and
tier 1 downloads from that organism's directory. The module resolves the same
directory by `resolveDataDirectory` and adopts those requests by exact address,
so nothing is fetched twice. The inline script cannot import the registry, so it
holds each organism's directory, title, **and tier 1 file list** itself. That
list is `coreFileNames(organism)` in `core/data-files.js`, which is the loader's
own `publishesFile` rule: a study-bound layer the record does not declare is not
asked for here either, whatever the manifest lists, because a request the loader
never makes is one nothing adopts and a layer recorded absent must be absent
without a request. `tests/js/organisms.test.mjs` runs the page's real script
against the real `loadDatasetStaged` for every organism, including against a
manifest that lists an undeclared study-bound file, and fails when the two ask
for different addresses or for anything else.

| Address | Organism | Data directory |
| --- | --- | --- |
| no `org` | default | `data/` |
| `?org=utex2973` | default; the address is rewritten without `org`, hash kept | `data/` |
| `?org=ecoli-k12-mg1655` | E. coli | `data/organisms/ecoli-k12-mg1655/` |
| `?org=ecoli-mds42-public-reference` | MDS42 public reference | `data/organisms/ecoli-mds42-public-reference/` |
| `?org=ecoli-dh10b-public-reference` | DH10B public reference | `data/organisms/ecoli-dh10b-public-reference/` |
| `?org=ecoli-syn61-delta3-ev5` | Syn61 delta 3 evolved variant 5 | `data/organisms/ecoli-syn61-delta3-ev5/` |
| `?org=ecoli-syn57-design` | Ec_Syn57 complete design; no measured isolate | `data/organisms/ecoli-syn57-design/` |
| `?org=<anything else>` | default; `org` **and the hash** are removed, and the page announces it | `data/` |
| any of the above with `&data=<dir>` | unchanged | `<dir>/` |

An unknown `org` drops the hash because the hash was written under an organism
the page cannot identify, so it cannot be read as the default's. `?data=`
overrides where the files are and never which organism the page is; the loader
still refuses a directory that holds another assembly (below). It does not follow
a switch, because it was written for the organism being left.

## What keeps two organisms apart

| Guarantee | Where | Pinned by |
| --- | --- | --- |
| Data is read only from the organism's own directory | `resolveDataDirectory`, the inline script | `organisms.test.mjs` |
| A directory holding another assembly is a failed load, never a drawn page | `requireGenomeOfRecord` in `core/dataset.js` | `organism-isolation.test.mjs` |
| A study-bound layer is requested only for an organism that declares it | `publishesLayer`, `STUDY_LAYER_KEYS` | `organism-isolation.test.mjs` |
| No storage key is shared | `storageKeys` | `organisms.test.mjs`, `organism-isolation.test.mjs` |
| A link's colour sources and fresh axes are the organism's own | `core/url-state.js` | `organism-isolation.test.mjs` |
| No sentence, key, description, or export names the other organism | records, `organismOf(dataset)` | the two sweep tests in `organism-isolation.test.mjs` |
| The replicon model is the organism's, verified against `meta.json` | `repliconTracks(genes, meta, organism.genome)` | `organism-isolation.test.mjs`, `chromosome-view.test.mjs` |

**Study-bound layers.** Six data files carry one study's evidence in that
study's own schema: `functionCategories`, `sourceDerivedCategories`,
`candidateEvidence`, `goIeaEssentiality`, `tssEvidence`, `regulatoryTss`. Their
readers name the study. Each is loaded only for an organism whose record
declares it under `layers`, with the labels its views read; for any other
organism it is `absent` without a request, whatever the directory or its
manifest holds. Every other file is organism-neutral and loads when published.

**Truthful absence.** A layer an organism does not declare is handled the way
the page handles an optional file that is not published: its section, colour
option, filter, column, manifest key, and caveat are not drawn or written, and a
tab whose whole content is that layer keeps its place and says the table is
unavailable. Nothing is said about what was found, because nothing was looked
for: an organism with no start-site layer is never told that no start site maps
to a gene.

An unavailable state is one short line and nothing else. "The regulatory
start-site table is unavailable in this dataset." is the shape; the Lengths and
Citations tabs say the same of their own layer. A tab's introductory blurb goes
with its content: the Citations blurb promises what each entry says and the
Lengths blurb a comparison and a range control, so with no ledger or no length
inventory published there is no blurb either. None of these name a file to publish
or a directory to put it in — a release that does not publish a layer is not a
deployment to be repaired, and one directory would be the wrong one for every
organism but the default.

**Where organism wording lives.** A sentence that states an organism fact is in
its record, or composed from the record's names, or read from the dataset's own
`meta.json`. `copy.metricOrigin`, when declared, is a noun phrase: the
metric-help branches supply their own pipeline, proxy or live-calculation prefix.
Every method citation exposed by a metric or projection must resolve through
that organism's citation ledger. A module that draws takes the organism from `organismOf(dataset)`
or as an argument. A dataset built by hand, as tests and tools build them,
carries no organism and is the default's, which is what keeps every earlier
test unchanged; the page's loader always stamps one.

**Saved state.** Saved schemes, the shortlist, the comparison's chosen metrics,
the panel widths, and the last view are kept under the organism's
`storageNamespace`. The default organism's are the keys the site has always
used (`cyano.schemes.v1` and the rest), so nothing saved before is lost.

**View memory.** The page writes the current hash to the organism's
`last-view` key whenever it writes the address. It never reads it back itself.
Only a selector link carries it, so choosing an organism returns to the view it
was last left in, while a bare link opens that organism's fresh view with, as
before, this browser's saved shortlist.

A link is only as good as its address, and an address is read without a click:
"Copy link address", a middle or modified click, a drag. Every option is
therefore rewritten on the `storage` event — the only notice this tab gets that
another one saved a view — and again on `pointerdown`, `contextmenu`, `keydown`
and `click`, each of which precedes anything that can read the attribute. A
copied link and a followed link give the same address.

**Exports.** The manifest carries `organism` (id, label, species, strain,
assembly). A file name carries the record's `exportTag`; the default organism's
is null, so its file names are unchanged.

## Adding an organism

1. Add a record file under `site/js/core/organisms/` with every field the
   contract at the top of `organisms.js` lists, and add it to `ORGANISMS`.
   Declare a study-bound layer only with the labels its views read.
2. Put its id in the intended navigation group in `ui/organism-selector.js`;
   do not infer conventional or recoded membership from species alone.
3. Add its directory and title to the table in the inline script in
   `site/index.html`.
4. Add its tier 1 file list to that same table, from `coreFileNames`.
5. Add a profile to `tests/fixtures/make_fixture.mjs` if its tests need data,
   with its replicon lengths: the generator bounds every coordinate it places to
   the replicon, scaling the gaps it drew when a realistic gene count would run
   past the end, and refuses a count whose coding sequence cannot fit at all.
6. Run `node tools/build_module_preloads.mjs`, then the gates.

### What its dataset must declare

What the code actually enforces, and where, because the two checks are in
different places and fail differently.

| The dataset declares | Checked by | A mismatch |
| --- | --- | --- |
| `meta.genome.accession` exactly equal to the record's `genome.accession` | `requireGenomeOfRecord` in `core/dataset.js`, before the dataset is built | fails the core load: the page shows the load error and draws nothing |
| `meta.genome.totalLength` equal to the sum of the record's replicon `lengthBp` | `repliconTracks` in `core/chromosome-model.js`, not the core loader | the map and every other tab still draw; the chromosome view reports the problem and refuses its axis |
| each gene's `seqid` naming one of the record's replicons | `sameReplicon`, through `repliconTracks` | that CDS has no axis, and the chromosome view says which replicon is not of the genome of record |

**`seqid` is matched on the bare sequence name, not the exact accession.**
`sameReplicon` normalises through `normalizeAccession`, which strips an `NZ_`
prefix and the version suffix and upper-cases the rest, so a gene on
`NC_000913`, `NC_000913.2` or `NC_000913.999` is drawn on the axis the record
labels `NC_000913.3`. This is the behaviour the cyanobacterial model has always
had, and it is there because `genes.json` writes `NZ_CP006471.1` where a
start-site extract writes `CP006471`; it is deliberately kept. Exactness is the
assembly accession's job, and that is checked above, before anything is drawn.

**An optional file is published, or declared, never one without the other.**
Two fields in `meta.json` turn an optional file into a required one. Declaring
either without publishing its file fails that layer: the genes still load and
the page stays usable, with the file's state `failed` and its sections showing
the error. Only the all-at-once `loadDataset` wrapper rejects outright.

- `meta.annotationRelease` makes `annotations.json` mandatory, and that file
  must carry a record for **every** gene — a file covering some of them fails
  rather than annotating a subset.
- `meta.tssEvidenceSource` makes `tss_evidence.json` mandatory. An organism
  that declares no `tssEvidence` layer never has that file requested, so for it
  the field must be **absent**: declaring it gives a start-site layer that can
  only fail.

**Published GO names must cover the GO relationships that are joined.**
`go-term-names-v1.json` is optional, but when it is published every `goId` in
any gene's `annotationEvidence.goAnnotations` must have a name in it, or the
file fails. Deriving the names file from the relationships actually present is
what makes this hold by construction; `tests/fixtures/make_fixture.mjs
--with-annotations` does exactly that.

A new study-bound evidence layer for an organism other than the default needs
its reader generalised first: those validators check the default organism's
files. The two organism-neutral annotation files above need no record change at
all — an organism publishes them by publishing them.

## Checks

```sh
npm test
.venv/bin/python -m pytest -q
.venv/bin/python tools/validate_contract.py
node tools/build_module_preloads.mjs --check
```

Unit coverage: `tests/js/organisms.test.mjs` (registry, resolution, canonical
address, storage keys, the inline script run against the real loader, the static
page against the default record), `tests/js/organism-isolation.test.mjs`
(loader gating and the assembly check, the replicon model, links, storage, view
memory, both sweeps, export naming, and the annotated release),
`tests/js/organism-selector.test.mjs` (grouping, disclosure keyboard/focus
behavior, link freshness, the identity rewrite, truthful absence), and
`tests/js/fixture-generator.test.mjs`
(each organism's fixture, its coordinate bounds at a realistic gene count, and
the default fixtures against digests pinned outside the generator).

Rendered validation is required for any change here, at **375, 768, 1280 and
1440 px**, with a clean console. The second organism's fixtures are written by
`npm run generate:test-fixtures` to `tests/fixtures/data-ecoli/` and, with its
annotation layer, `tests/fixtures/data-ecoli-annotated/`; serve either at its
registry directory, or pass it as `?org=ecoli-k12-mg1655&data=<dir>`. For a
realistic size, write one with
`node tests/fixtures/make_fixture.mjs --organism ecoli-k12-mg1655 --genes 4287`.

For grouped-navigation geometry, open the real site with an absolute
`?uiArtifacts=<directory>` value and run
`playwright-cli -s=<task-session> run-code --filename=tools/ui/check_organism_navigation.js`.
It keeps the menu open while moving default, MG1655, MDS42, and DH10B through
320, 375, 420, 439, 440, 768, 1280, and 1440 px, asserting both viewport edges,
rendered separator spacing, option clipping, live anchor resizing, accessible
default/selected names, keyboard dismissal and focus return.

- the default view and existing shareable links (one with a scheme, one with a
  pinned gene and shortlist, one on the chromosome tab) read exactly as before;
- the selector: three top-level controls in the contracted order; the three
  conventional links and current strain; visible public-reference labels and
  focus ring; pointer, Enter, Space, arrows, Escape and Tab operation; no
  horizontal overflow;
- all six direct organism addresses: exact id, design/strain and genome identity, data
  directory and selected navigation state;
- each non-default organism: map, gene detail, chromosome view, filters, legend, the
  tabs whose layers are absent, a scheme applied, and an export, with no name of
  the other organism anywhere;
- switching there and back with state in each: each returns to its own view,
  saved schemes and shortlists stay apart, back and forward follow, and a copied
  link restores in a fresh tab;
- every request of a load is inside that organism's directory, each once;
- a missing data directory shows the load error with the selector still usable,
  never another organism's data;
- an unknown `org` shows the default organism under a corrected address.
