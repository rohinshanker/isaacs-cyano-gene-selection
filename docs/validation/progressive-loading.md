# Progressive loading

Reusable contract for how the site loads: which file lands in which tier, how
each file is addressed and cached, what a view shows while its file is in flight,
what the visitor sees before and at the reveal, and the checks a change here has
to pass.

The loader is `loadDatasetStaged` in `site/js/core/dataset.js`, over the file
registry in `site/js/core/data-files.js`. The page side is `boot` and the
functions around it in `site/js/app.js`. Everything below is a property of the
first two unless it names another file.

## Loading is not missing

The one rule every other section serves. A file that has not landed has
**unknown** content. Its place is taken by a statement that it is loading, or
that it could not be loaded, and never by the sentence a view uses when the
evidence is absent, and never by a zero.

Each file is in one of four states, `FILE_STATE` in `data-files.js`: `loading`,
`ready`, `absent` (an optional file this deployment does not publish), and
`failed` (could not be read, or failed its validation). `dataset.files[key]`
carries the state, and `pendingState`, `isLoading`, `hasFailed` and
`firstUnsettled` are the only ways a view asks. A dataset built without the
loader has no record and reads as fully settled, which is what keeps every test
and tool that builds one by hand unchanged.

What each reader shows while its file is `loading` or `failed`:

| File | Reader | Instead of |
| --- | --- | --- |
| `source-derived-categories-v1.json` | Scatter maps, chromosome view, legend, colour explanation, gene detail | every CDS in one neutral colour, the legend's single row "Function categories are loading"; never "Unknown or unclassified" |
| `length_cohorts.json` | Protein evidence filter, Lengths tab | a waiting fieldset and a loading note; never "unavailable in this dataset" |
| `codon_pca.json` | Loadings table | a loading note; never an empty table |
| `excluded.json` | Provenance row | "loading…"; never `0` |
| `tss_evidence.json` | Gene visualizer, gene detail, basis tags, chromosome tick row | "start sites are still loading"; basis tags read "Table S1 sites not loaded"; never "No Tan 2018 start site maps" |
| `annotations.json`, `go-term-names-v1.json` | Gene detail, gene search | a loading section; a GO search miss says GO annotations are still loading |
| `candidate_evidence.json`, `go-iea-essentiality-v1.json` | Gene detail | a loading section; never an absent disclosure |
| `regulatory_tss.json` | Regulatory sites tab | a loading note; never "unavailable in this dataset" |

**The category colour is the case that decides the design.** The fresh view
colours by function category. On the reviewed table alone about a dozen CDSs
would take a colour and some 1,350 categorised ones would draw as unknown, which
is a claim about each of them. So while the derived categories are loading the
model is `pendingFunctionCategories`: the same shape as the resolved one, every
CDS in one extra bucket drawn in `PENDING_CATEGORY_COLOR`, nothing counted, and
no source toggles. The reviewed rows are held back too: a legend naming a dozen
categories over a map that cannot show the rest invites reading the rest as
absent. A pending point is a plain disc with no dark border, because the border
is the mark of lab review and a point that has not loaded has no evidence tier.

**The start-site basis is loading-aware without knowing about loading.** The
loader joins a row list onto every gene, empty where no site maps. A gene with no
list at all is therefore one whose site layer has not been joined, and
`tssInitiationBasis` says "Table S1 sites not loaded" with a site count of null.
A joined empty list is a known zero and still says so. This is why the comparison
table is not blocked while the file loads: each cell states its own basis
truthfully.

**Exports wait.** `exportBlockedReason` in `core/export-manifest.js` names the
file an export is waiting on, over `EXPORT_FILE_KEYS`, and `buildExport` itself
throws that reason, so no caller can write a manifest in which a not-yet-loaded
field appears as an empty one. Panel design reads tier 1 only and is not blocked;
its export is.

## Tiers

Tiers say what the page waits for and what it draws first.

| Tier | Files | The page becomes |
| --- | --- | --- |
| 1 | `meta.json`, `genes.json`, `function-categories-v1.json` | Usable: every map's points, the chromosome view, selectors, search by locus and product, registry filters, the shortlist |
| 2 | `annotations.json`, `candidate_evidence.json`, `source-derived-categories-v1.json`, `length_cohorts.json`, `codon_pca.json`, `excluded.json` | Coloured by function category; protein filter; loadings |
| 3 | `tss_evidence.json`, `expression_layers.json`, `go-iea-essentiality-v1.json`, `go-term-names-v1.json` | Complete in gene detail, condition-resolved measurements, the gene visualizer, and the chromosome tick row |
| 4 | `regulatory_tss.json` | Complete on the Regulatory sites tab |

`citations.json` is outside the tiers. Its own loader asks for it at start-up,
through the manifest like every other file; it never blocks the usable-page
reveal, but it joins the active chromosome-progress cycle so that cycle cannot
announce completion while the ledger remains in flight. The Citations tab keeps
its own loading, absent and empty states. A published ledger that cannot be read
or validated is a failed resource with Retry; an unpublished one is absent.

**The tiers follow what a file's validation reads, not only what it feeds.**
`validateSourceDerivedCategories` checks every derived category against the
candidate evidence's PCC joins and against each gene's GO annotations, so the
derived categories cannot be validated without `candidate_evidence.json` and
`annotations.json`. Those two are therefore tier 2, with the colour they make
possible. `DATA_FILES[...].needs` records each such dependency, and a file is
applied only after the files it needs have settled. A file whose dependency
failed is `failed` with a message naming the file it was waiting on, and its
`blockedBy` says which.

**`pcc7942-essentiality-v1.json` is published and never fetched.** It is an input
to `candidate_evidence.json`. It is in the manifest, because the manifest lists
everything published, and in no tier.

**`codon_rscu.json` is published and never fetched.** This per-organism offline
sidecar carries `{schemaVersion, geneIds, rscu}`; its `geneIds` must match the
adjacent `genes.json` order, and its columns follow `meta.rscuOrder`. It has no
`DATA_FILES` entry, tier, or browser join. The manifest includes its byte size
and digest, but the bar's denominator excludes it because the browser does not
request it. Packed `codons` remain in the tier-1 `genes.json`. The offline join
and coverage gates are in the [data contract](data-contract.md#codon_rscujson).

**`annotations.json` and `tss_evidence.json` are required when `meta.json`
declares them**, which the shipped one does. Their absence is that file's
failure, with the single-step loader's own message, and no longer the whole
page's.

**Staging changes when a check runs, never whether.** `buildCoreDataset` indexes
tier 1; `DATA_APPLIERS` holds one validator-and-join per later file, each
throwing the message the single-step loader threw. `loadDataset` is the staged
loader awaited to the end, with any failure thrown as before and the cause thrown
ahead of a file that was only blocked by it, so the two cannot drift. An applier
validates the whole file before it joins any of it: a file that fails half way
leaves no gene carrying evidence its neighbours lack.

### A link is opened onto its own data

`promotedFileKeys` in `app.js` lists the later files the reveal also waits for.
A fresh view waits for none. A link that filters by category waits for the
derived categories; one that filters by protein evidence or opens the Lengths tab
waits for the length inventory; one that opens Regulatory sites waits for that
table; one that pins a gene waits for every file the gene detail reads. A link's
protein filter and category filter are **kept, not dropped**, while their file
loads and while it has failed and may be retried, and applied when it lands; a
filter is dropped only once its file is known not to be published. Dropping it on
a failed request rewrote the link's hash and left the filter cleared after a
successful retry.

### Pacing the tiers

Every file used to be asked for at once. That shares the connection between
them, so the gene file, the largest and the one the map waits for, finished last:
on the throttled profile below the map became usable at 17.3 s, the same moment
as everything else, and staging bought nothing.

Each later tier is therefore released only when the tiers before it are all but
in: when no more than `TIER_LEAD_BYTES` (128 kB) of them is outstanding, or they
have all finished. The lead exists to cover the round trip a new request needs
before its first byte, so the connection is never idle between tiers and the
total time stays what it was. It is a byte count and not a fraction because the
cost of releasing early is paid on what remains: at an 85% lead the gene file's
last 780 kB shared the link with five files and took 4.6 s. Without a manifest
there are no sizes to pace by and every file goes out at once, as before. A retry
is one file asked for on its own and waits behind nothing.

Measured in Chromium against `python3 -m http.server`, cache disabled, 750 kB/s
down, 80 ms latency, uncompressed, two runs each:

| | Map usable | Category colour | Complete |
| --- | ---: | ---: | ---: |
| Before, `315f7a0`, one parallel fetch | 17.5 s | 17.5 s | 17.5 s |
| Staged, all files at once | 17.3 s | 17.3 s | 17.4 s |
| Staged, 85% lead | 12.3 s | 15.7 s | 17.2 s |
| Staged, 128 kB lead | 9.1 s | 13.1 s | 17.2 s |

The published host compresses JSON in transit, so real times are shorter; the
ordering is what the table shows. About 1.0 MB of unbundled JavaScript competes
with the gene file for the first two seconds on this profile.

## The content manifest and the cache

`site/data/data-manifest.json`, written by `tools/build_data_manifest.py`, lists
every published JSON file with its byte size and SHA-256. The loader reads it
first, always revalidated, and uses it twice.

**The size is the loading bar's denominator.** The response stream yields decoded
bytes whatever compression the host applied, so bytes received over manifest
bytes is exact. Without a manifest the bar counts files settled over files
requested, which is coarser but never claims a size it does not know. A settled
file counts whole whatever became of it, so a missing or failed file cannot hold
the bar short of full.

**The digest is the cache key.** Each file is requested as
`<name>?v=<first 16 hex of its SHA-256>` with `cache: 'force-cache'`, so a repeat
visit reads the data from the browser cache without asking the server. That is
safe because a file whose content changes is requested under a different
address.

**`meta.builtAt` was rejected as the key**, and this is the reason the manifest
exists. A dozen tools rewrite single files in `site/data` without touching
`meta.json`, so a build timestamp would have pinned visitors to a superseded
file.

**The key is only as good as the manifest, so the manifest is gated three
times**: `tools/build_data_manifest.py check`, `validate_data_manifest` in
`tools/validate_contract.py` (which recomputes every digest without importing the
builder), and the deploy workflow. **Run `tools/build_data_manifest.py build`
after any tool that writes `site/data`.**

**The manifest says what is published, in both directions.** An optional file it
does not list is `absent` with no request made. A file it does list exists, so a
404 for it is a deployment fault, `failed` with a retry, and never evidence that
is absent: treating it as absent drew 2,703 genes as unknown and allowed an
export, from one transient fault. Not found means not published only when there
is no manifest to say otherwise.

**Every copy received under a key is verified before it is parsed**
(`matchesManifest`): its size, and then its SHA-256, because two releases of a
file can be the same length, and a copy that is the right size and the wrong
content is exactly the stale copy a content-addressed cache must never show. The
build-time gates establish that the manifest matches the files; they cannot
establish which bytes a visitor received. A copy that fails is asked for once
more under the same address with `cache: 'reload'`, which also evicts the stale
copy the cache held there. If the server still answers with bytes that are not
the file the manifest names, as it can while a deploy's manifest has reached an
edge before its data file, **nothing is shown**: the file is `failed` with "does
not match the published data manifest; the site may be mid-update" and a retry.
A retry is verified the same way. Where the platform has no `crypto.subtle`, a
page served over plain HTTP from a host other than localhost, only the size is
checked.

A file's dependency can be retried while the file itself is still downloading.
The file then waits for the retry rather than validating against data that is on
its way.

### Starting before the script

Two classic inline scripts in `site/index.html` run before any module. The first
is the `file:` notice. The second asks for the manifest and the tier 1 files as
soon as the document is parsed, so the gene file is already downloading while
the browser is still fetching the module graph. `adoptingFetch` in
`core/early-data.js` hands those requests to the loader by exact address, and
waits on the script's `ready` promise first, which is what guarantees a file is
never requested twice. `tests/js/early-data.test.mjs` evaluates the page's own
script and holds its addresses and options equal to `dataRequest`'s.

The module graph itself is listed as `<link rel="modulepreload">`, one per
statically imported module, so it is fetched in one round rather than a level at
a time. The list is generated by `node tools/build_module_preloads.mjs` and
`tests/js/module-preloads.test.mjs` fails when it falls behind.

## A file that fails

A later file that cannot be read, or fails its validation, is `failed`, and the
page stays usable. The chromosome presentation's host at the top of the map card
lists it with the loader's exact message and a **Retry** control (`LoadProgress`
in `ui/load-progress.js`).
The failure list has its own persistent polite live region, separate from the
progress presentation: once the completed bar is hidden, a newly failed file is
still announced with its error and any Retry action. The announcement changes
only when the failure summary changes, so progress renders do not repeat it.
`retry(key)` asks the server for that one file again with `cache: 'reload'`,
verifies it like any other copy, then re-applies the files that were only waiting
on it without downloading them again. A file blocked by another has no Retry of its own; it is
retried by retrying the one it waited on.

A tier 1 failure cannot be worked around, since nothing can be drawn. It is
reported in the status notice with the same wording as before and a Retry that
runs the whole load again; the files that did arrive come back from the cache.
An optional tier 1 file that is published but unreadable also fails tier 1,
rather than colouring every reviewed gene as unknown.

`loadDataset` keeps the single-step rule for tools and tests: an optional file
that could not be fetched is absent.

## The loading presentation

Owner requirements and decisions of 2026-09-30, in the order the visitor meets
them.

**An empty shell.** The page opens as an empty version of itself: the header
bar, the left column, the right column, and the centre area, with only an empty
grid and the loading bar in the centre, and no text. `body.is-loading` does this
by hiding the *children* of each box with `visibility`, which keeps every box its
real size: the bars and columns are the page's own, not a separate skeleton that
could drift from it. On one column the centre leads, so the grid is within view
on a phone. The status line is in the document for assistive technology and is
visually hidden until it carries a failure.

**A chromosome loading bar.** Drawn like the chromosome track: an axis with
genes above and below it, lit from left to right as data arrives. How many are
lit is never more than the fraction loaded. They are a fixed deterministic
picture, not the release's genes, which have not arrived when the bar first
draws, so nothing about them can be read as data. It is a `progressbar` whose
value text names the tier in plain words and, once tier 1 is built, the release
and its gene count.

**The whole track is in the page, not added by the script.** Built by
`ui/load-progress.js` alone, the bar was a bare axis with no value text until the
module graph had arrived, the first second and a half of the wait on the
throttled profile and the part where a visitor decides whether the page is
working. `node tools/build_load_bar.mjs` writes the marks into `site/index.html`
from the same `loadBarGenes` the script uses; the script adopts them rather than
rebuilding, and `tests/js/load-progress.test.mjs` fails when the two differ. An
unlit gene is faint and neutral, so the bar reads as a chromosome from the first
paint; a gene's colour is a custom property rather than `fill`, which is what
lets the stylesheet dim it.

**A segment just appears.** It takes its colour the instant the progress reaches
it, with no grow, fade, or other transition, by owner decision of 2026-09-30:
easing each segment in made the blocky load read as fluid again, which is what
the uneven blocks exist to avoid. `tests/js/loading-shell.test.mjs` holds the
segment rules free of any transition, transform, or animation.

**The bar measures the whole active cycle.** The staged dataset is one source of
progress and independently fetched resources join it through
`beginResource`/`settleResource`. At start-up this includes `citations.json`.
The dataset keeps its byte-accurate manifest fraction; when unlike resources are
combined, each resource is one file-equivalent alongside the dataset's file
equivalents. A newly discovered resource therefore extends the denominator
before it can settle, and the cycle cannot report 100% while that work remains.
Once a cycle has completed, a citation download, an on-demand RNA-folding run,
or a per-file retry starts a fresh chromosome cycle rather than moving a
completed bar backwards. Folding is an unknown-byte activity: the bar never
mislabels its completed/total gene counts as bytes, while the folding panel's
persistent status reports those real counts and the exact active scheme.

Received bytes are not completion. A response whose last byte has arrived stays
below 100% until its validation and apply step settles; the same rule applies to
independent resources. Failed and absent work is settled work, so it may complete
the cycle while its actionable state remains visible. Per-file retries extend an
active cycle without dropping another pending file or independent resource. A
retry begun during the completed-bar hold invalidates that older hold, so its
callback cannot hide newly pending work. Each citation-download click has its
own progress identity, including simultaneous controls that request the same URL.

The URL still decides readiness: `promotedFileKeys` names later files whose
content the initial view needs before reveal. That readiness gate does not
change what the bar measures.

**The production default fills in uneven blocks, with pauses, over at least 1.5 seconds.** The
owner's decision: "1.5s, but have the load look a bit like a natural load rather
than a streamline (have it pause/jump and have a load a bit more blockily)".
`loadSchedule` lays the minimum out as 7 to 12 steps, each a moment and the
fraction the bar may show from then on. One block is 22% of the bar and one is
3.5%; one pause is 27% of the time to the last block and one is 3.5%; the rest
are uneven, so it reads as neither a ramp nor a metronome. The generator is
seeded, so the schedule is the same on every visit: with the default it is nine
blocks, the last at 1,357 ms. Time is counted from navigation, so the wait for
the script is part of the minimum and not added to it. A whole-dataset Retry
starts the schedule again from that moment.

**What the bar shows is never ahead of what has arrived.** `displayedFraction`
is the largest scheduled block that both the clock and the real fraction have
reached. On a fast connection the schedule paces the bar; on a slow one the data
does, in the same blocks, trailing the real fraction by no more than one of
them once the minimum has passed. A bar run on the clock alone would light genes
for data that has not come. Assistive technology is given the real fraction, in
`aria-valuenow` and `aria-valuetext`, and not the displayed one: the pacing is
for the eye, and a reader told the paced figure would be told less than has
loaded.

**The reveal.** `boot` builds the page on tier 1 while the shell hides it, then
waits for the promoted files (`load.when(promoted)`) and the presentation
minimum (`loadProgress.ready()`). Neither wait delays a request. `revealPage`
removes `is-loading`, shows the sections below the workspace, and moves the same
chromosome presentation from the empty grid to the reserved progress host at
the top of the map card. Later tiers continue there; no second meter is built.
The uneven-block clock continues after that move, so a fast later resource or
retry completes its minimum schedule and hold without needing another network
progress event.
The page was built while the shell hid it, so the reveal only uncovers it; the
canvases are measured then, because they were built inside a frame that was not
displayed. The shell status line is hidden at the same moment; the bar and its
concise `role="status"` subtext continue to announce the active stage.

**The visit lands at the top of the page.** The owner's decision: "once the
loading bar finishes, the website should scroll back up to the top rather than
staying at the map". `revealPage` calls
`window.scrollTo({ top: 0, behavior: 'instant' })` before the map and the text
start, wherever the shell had been scrolled to, and under reduced motion too.
Nothing holds the map in view. The cost is known and accepted with the decision.
The grid is the map canvas's own box in width and height, but not in position:
at the reveal the tabs, the blurb and the toolbar reappear above the map, and on
one column the controls column returns above the whole map card. The map
therefore lands 471 to 2,884 px below where the grid stood, so on a phone the
fill-in plays off screen and on a laptop mostly below the fold. That is a
consequence of the owner's choice, not a defect to repair.

**The text locks in from base pairs** (`ui/text-scramble.js`). Each text grows
left to right as random A, T, G and C that keep flipping, and locks into its
real characters behind them. Two fronts cross it, both from `scrambleProgress`:

- The **lock front** is the readable text. Text locks at 50 letters per second,
  with a maximum duration of 2.5 seconds per text. A text of `n` characters,
  spaces included, takes `n / 50` seconds; one longer than 125 characters locks
  faster, so that its last character locks at exactly 2,500 ms. The front is
  `floor(speed × elapsed)` characters, and all of them
  once that duration has passed.
- The **trail front** is the flipping edge. The owner's decision: "the trail
  should start as 10 letters ahead and should extend faster than the letters lock
  by 1.5x, so that it leads and finishes while the text lock has to catch up".
  It is `floor(10 + 1.5 × speed × elapsed)` characters, never behind the lock
  front and never past the end. A text of ten characters or fewer is all
  flipping from the first frame; a 100 character text has its trail at the end
  at 1.2 s and its last character locked at 2 s.

A letter flips every `flipFastMs`, 40 ms, while the lock front is ten or more
letters behind it, and waits longer in proportion as the front closes, up to
`flipSlowMs`, 170 ms, just before it locks (`flipInterval`), so the eye can
follow each one landing. Whitespace is never scrambled, so words keep their
shape and lines keep their breaks. The real text is in the document throughout
and is restored exactly on finish or cancel. A text the page re-renders or
rewrites during the run is dropped and simply shows its final text.

**Form text animates too.** The owner's decision: "have buttons and labels also
fill in with the text animation". Beside every text node,
`collectScrambleTargets` gathers the `placeholder` of each `input` and
`textarea` and the text of the option each `select` is showing: left as finished
text among the flipping letters, they were a seam in the reveal. The options a
dropdown is not showing are left alone, since nobody can see them, and a
`textarea`'s content is never animated. The placeholder attribute and the
option's text are rewritten in place and come back exact, like a text node.
`hidden`, `.visually-hidden` and `data-no-scramble` opt an element out with
everything inside it.

**Each element is held only while its own text is flipping.** The owner element,
which is a text node's parent or the control whose placeholder or shown option
is animating, carries `aria-busy`, `aria-hidden` and `inert` from the first
frame, and gets back exactly the attributes it had the moment the last of its
own text locks. A screen reader therefore reads the final text once and never
the flipping letters, and the keyboard cannot land on a control that is not
being announced; `aria-hidden` alone left the header's buttons in the tab order.
An element with several texts of its own waits for the last of them, and an
element inside a held one is out of reach with it until that one is released.
The roots the page passes (the header, `main`, and the three sections below the
workspace) are not held as roots: an element is held only for text it directly
contains.
The hold is per element because a text may take up to 2.5 seconds. Held as
whole regions, every region would stay hidden from assistive technology and
closed to the keyboard and the pointer until its longest text had locked: up to
2.5 seconds after the reveal in which nothing in it could be used. Held per
element, a button with a three letter label is usable 60 ms after the reveal
while a long paragraph elsewhere is still locking.

**The map fills in alongside** (`startIntro` in `ui/scatter.js`). The owner's
decision: "all points appear in .7s and all colour by 1.2s", both counted from
the reveal. Each point has a fixed threshold from an integer hash of its index.
It appears when the appear progress passes its threshold, as a plain neutral
disc, and takes its real style when the colour progress does. Paint order among
coloured points is the shared rule; not-yet-coloured points are underneath.
Points with no value and filtered out points appear on schedule but never take
the neutral colour, since it means "has a colour, not shown yet". It runs only
when the tab on screen is a scatter map. When the categories land after the
points have appeared, the colour half runs again over the same 1.2 s rather than
every point changing at once; the owner kept this second wave for a slow
connection. An intro still running when they land takes the colours up itself.

**The same chromosome continues after reveal**, with small subtext naming the
active tier or resource. Its host reserves the same height after completion, so
the map controls do not jump when the presentation hides. A failure remains in
that host with its message and Retry. Citation source downloads and on-demand
RNA folding use the same resource API and start a fresh chromosome cycle; their
own panels remain the actionable fallback if a request fails, so those resources
do not duplicate errors in the loading host. Organism changes are full navigations
and begin the same whole-load cycle for the newly selected organism. The current
dataset selectors do not issue requests on selection: every selectable layer is
already one of the staged files, so its progress belongs to the initial cycle.

**Requests after settle reuse this surface.** A loader snapshot that adds a
pending file, or changes a settled file back to loading, automatically starts
another cycle. The subtext names the requested filename. Its denominator covers
the newly pending files and any independent resource still in flight; bytes from
the previous completed cycle are excluded in both production and review modes.
The old completion hold cannot hide this work. EOF still waits for validation
and application, and a failure settles with its existing actionable Retry.
On-demand fetches outside the staged loader must call `beginResource` before the
request, report received bytes when measurable, then `settleResource` on success
or failure. A future lazy dataset selector follows that same contract; changing
selection alone does not manufacture a loading cycle.

### Timing

Every tunable is in `LOAD_TIMING` in `site/js/ui/load-timing.js` and nowhere
else.

| Tunable | In `LOAD_TIMING` | Default | Address-bar override |
| --- | --- | ---: | --- |
| Minimum bar time | `minimumBarMs` | 1,500 ms | `load-min` |
| Letters the trail starts ahead of the lock | `scramble.leadLetters` | 10 | `load-lead` |
| Speed at which readable text locks | `scramble.lockLettersPerSecond` | 50 letters/s | `load-letters` |
| Trail speed, as a multiple of the lock speed | `scramble.trailRatio` | 1.5 | `load-trail` |
| Longest any one text may take | `scramble.maxDurationMs` | 2,500 ms | `load-text-max` |
| Flip interval while the lock is far behind | `scramble.flipFastMs` | 40 ms | `load-flip-fast` |
| Flip interval just before a letter locks | `scramble.flipSlowMs` | 170 ms | `load-flip-slow` |
| Map points all appeared | `mapIntro.appearMs` | 700 ms | `load-map-appear` |
| Map points all coloured | `mapIntro.colourMs` | 1,200 ms | `load-map-colour` |

An override is a query parameter, read once at start-up, used only when it is a
finite number from 0 to 60,000, and never written to the URL hash, which is
analysis state and is unchanged by any of this. `?load-log` prints per-file
timings and the three `cyano:` performance marks (`core`, `revealed`, `settled`)
to the console; the marks are always recorded.

**Two things are fixed in `ui/load-progress.js` and have no override**: the
150 ms of `FULL_HOLD_MS`, and the shape of the schedule.

**The minimum is a floor.** The schedule's last block lands a little short of
the minimum, by a share that grows with it, so the full bar is held for whichever
is longer: the 150 ms that lets it be seen, or the rest of the minimum. Held for
the 150 ms alone, a two-second minimum revealed the page at 1.96 s.

**Reduced motion skips all presentation**: the scramble, the map fill-in, the
minimum bar time, and the hold on the full bar. The bar then shows the real
fraction as it arrives, and the page shows its final state, at its top, as soon
as it is built and its promoted files are in.

A browser refuses to run `requestAnimationFrame` as a method of anything but its
own window. The default frame functions of the scramble and of the bar are
therefore wrapped, not passed by reference, and a test for each mimics the
browser's check to hold that: the first version of the scramble passed every
injected-clock test and stopped the real page with no text on it.

### Owner-review variants

The alternatives below are query-only and do not change the approved production
defaults. `load-review=a`, `b`, or `c` enables the shared truthful state model;
`load-progress=grouped` or `continuous` chooses only how that state is drawn.
Invalid or absent selectors fall back to production behavior.

| Variant | Gate |
| --- | --- |
| A | Core, URL context, promoted dependencies, initial view, then a clean animation frame |
| B | The same gate, followed by a presentation-only 1,000 ms hold; requests continue and progress does not advance on the timer |
| C | A measured received-byte fraction of at least 50%, plus every A readiness condition; no measurable byte total or terminal failures making halfway unreachable fall back to A |

Both progress modes consume one snapshot. Transfer progress is actual bytes
received over published bytes for the size-known files in the active cycle,
including measurable independent resources. Unsized work retains its own file
count and activity state; it never discards known byte progress. Once the known
bytes arrive, unsized pending work keeps the same bar active without a numeric
claim. Manifest-absent files and resources are excluded. Settlement never
fabricates bytes. If no file has a byte total, the display uses terminal files
over registered files. An undiscovered work set has no `aria-valuenow`.

The halfway gate compares received bytes directly, including partial failed
transfers. A terminal error's settled percentage never counts as transfer.
If failure makes halfway unreachable, the gate releases to readiness so the
usable page and its actionable error remain available.

Once all known bytes have arrived but validation, application, context, state,
initial-view, or final-geometry tasks remain, the same chromosome switches to a
named Preparing activity state. Preparation is completed registered tasks over
registered tasks; it is not assigned byte weight. Activity gently pulses the
existing track without advancing its completed extent, and reduced motion
disables that animation. The status is excluded from text scrambling. Initial
tiers retain their approved organism-specific wording; post-settle requests
name the file. A failed cycle preserves the received-byte extent, removes its
numeric completion claim, and terminates with Retry. Grouped mode gives known
files byte-weighted slots (equal file slots only when none has a size);
continuous mode sums the same known bytes. Neither review path calls
`loadSchedule()`.

Review mode also enables a coherent-block scramble curve through 1, 12, 40, and
160 characters at 250, 350, 600, and 1,000 ms, capped at 1,000 ms. Inline text
in a paragraph, heading, or label shares a front; controls remain atomic and
release after their own duration. Final block height and control width are
reserved while text is short. Landing-driven replacements with unchanged
content inherit the original deadline; new landing content receives one local
bounded reveal, and a user rerender does not restart page-wide decoration.

Repeatable comparison URLs (append an organism/hash as needed):

```text
/?load-review=a&load-progress=grouped&load-log
/?load-review=a&load-progress=continuous&load-log
/?load-review=b&load-progress=grouped&load-log
/?load-review=b&load-progress=continuous&load-log
/?load-review=c&load-progress=grouped&load-log
/?load-review=c&load-progress=continuous&load-log
```

Use DevTools network profiles of 750 kB/s with 80 ms latency and 300 kB/s with
150 ms latency, with cache disabled for fresh runs and enabled for the paired
cached runs. CPU 4× slowdown is a responsiveness check, not a source of progress.

## Decisions on the original suggestions

| # | Suggestion | Decision |
| --- | --- | --- |
| S1 | Skeleton placeholders | Approved, then superseded by the owner's empty shell; loading notes stand in for evidence after the reveal |
| S2 | Preload hints | Approved. Built as an early inline fetch plus module preloads, which starts tier 1 before the script is parsed without depending on how a browser matches a preload to a `fetch` |
| S3 | Cache keyed on the release | Approved. Keyed on each file's content digest, not `meta.builtAt` |
| S4 | Split `genes.json` | The original broad split was declined; a later payload ticket moved unused per-gene RSCU to `codon_rscu.json`. Packed codons remain in the core file. |
| S5 | Release identity early | Approved. In the bar's value text throughout its shell and post-reveal positions |
| S6 | Per-file retry | Approved |
| S7 | Streamed map drawing | Declined; conflicts with validating the file whole |
| S8 | Load timing flag | Approved, as `?load-log` |

## Checks

```sh
npm test
.venv/bin/python -m pytest -q
.venv/bin/python tools/validate_contract.py
.venv/bin/python tools/build_data_manifest.py check
node tools/build_module_preloads.mjs --check
node tools/build_load_bar.mjs --check
```

Unit coverage:

- `tests/js/staged-loader.test.mjs`: registry order and dependencies; the map
  usable on tier 1 with a later file in flight; manifest addressing and the
  no-manifest fallback; streamed progress; the size-mismatch re-read; absent
  against failed; tier 1 failure; required-by-meta files; validate-then-join;
  parity with the single-step loader on the published data; whole-cycle progress and retry;
  tier pacing.
- `tests/js/loading-states.test.mjs`: every reader in the table above, the export
  gate, and the borderless pending disc.
- `tests/js/load-progress.test.mjs`, `tests/js/early-data.test.mjs`,
  `tests/js/load-timing.test.mjs`, `tests/js/text-scramble.test.mjs`,
  `tests/js/scatter-intro.test.mjs`, `tests/js/module-preloads.test.mjs`,
  `tests/js/loading-shell.test.mjs`.
- `tests/test_data_manifest.py`: the builder and both gates.

Rendered validation is required for any change here. A fast local connection
hides every state this document is about, so throttle the network and disable
the cache, then check at **375, 768, 1280 and 1440 px**:

- the shell: no visible text, the grid within the viewport, the whole track
  present and a value text set before the page's script has run, `aria-valuenow`
  and the value text then reporting the real fraction while the genes light in
  blocks that never run ahead of it, no horizontal overflow;
- the bar on a fast connection, with no throttle: filling in visibly uneven
  steps with pauses over at least 1.5 s from navigation, and seen full before
  the map replaces it;
- the reveal: the page at its top; text growing as flipping letters and locking
  left to right behind them; each input's placeholder and the option each
  dropdown shows animating with the rest and ending exact; each element usable
  the moment its own text has locked, while longer texts are still running; map
  points appearing and then colouring, wherever the map sits in the page; the
  status line hidden;
- everything settled: no element carrying an `aria-busy`, `aria-hidden` or
  `inert` it did not have before the reveal, and every text, placeholder and
  shown option its final self;
- tier 1 landed and tier 2 not: neutral points, the legend's single loading row,
  and the same chromosome bar naming the tier in flight;
- everything landed: the chromosome presentation hidden, the legend and counts
  as on a normal load, with its reserved host preventing a late layout jump;
- one later file failing: the page usable, the progress host listing it with its message,
  Retry recovering it;
- a pinned-gene link: the reveal no earlier than that gene's evidence, and no
  loading note in its detail card;
- reduced motion: the final page at its top with no animation, no minimum wait
  and no hold on the full bar;
- a clean console throughout, and the three `cyano:` marks in order.

Re-measure the table under "Pacing the tiers" on the same profile after any
change to the loader, and record it here rather than estimating it.
