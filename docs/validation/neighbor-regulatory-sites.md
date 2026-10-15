# Neighbouring regulatory sites in CDS

`core/neighbor-sites.js` derives one relation from the admitted Tan 2018
`tss_evidence.json` and `regulatory_tss.json` records. It is native to UTEX 2973,
assembly GCF_000817325.1. Replicons must match the pinned versioned accession or
its published unversioned source alias. Other organism or assembly coordinates
never join. Neither initiation scores nor source gene-model distances supply
coordinates. No RBS coordinate layer is published; RBS is explicitly unavailable.
See the [admitted source contract](data-contract.md#the-shared-marker-representation)
and [Tan provenance](../../data/expression/TAN2018_TSS_PROVENANCE.md).

A site counts when its point lies in the inclusive union of the focal gene's
actual CDS segments and has an exact native source association to another gene.
Split-CDS gaps and display padding are excluded. Strand does not restrict
membership; the detail labels its relation to the focal strand. Origin order and
compact offsets use the shared transcription-piece helper; sequence positions
use the exact sequence-column map.

Physical sites deduplicate by source study, type, strand, native replicon and
base. Condition repeats and multiple owners do not add counts. Every source ID,
association, condition, raw record and recorded warning remains inspectable.
A self-only site is excluded; a self-and-other site retains both associations.
Orphan and unresolved native-association records remain explicit in the focal
list but do not create an owner or contribute to its neighbouring-gene count.
Their coordinates and source records remain readable; they offer no marker
inspection action because they have no resolved neighbouring-gene marker.
Antisense locus associations are source context, not proven regulation;
Table S8 potential-target hypotheses do not produce extra associations.

The loader builds the index when either payload lands. Filtering, categorical
colour, counts and viewer marks read that same index, independently of the
current mask or nearest plotted neighbour. All four Tan condition selectors and
the explicit legacy pooled choice retain identical Table S1 site coordinates.
Removing every Tan initiation source or failing/loading either site payload or
the informing initiation payload suspends narrowing and marks consistently.
Unavailable is unknown, never a count of zero or “without overlap”.
The unavailable filter is explicit; saved with/without narrowing is suspended.

## The count

Owner request, 2026-10-13. A gene's total is the number of distinct admitted
sites inside the union of its actual CDS segments, boundaries inclusive, that a
source associates with another resolved gene. Same- and opposite-strand sites
count alike, the strand relation being the site's strand against the focal
CDS's, so two same-strand and three opposite-strand sites total five. A site's
identity is study, type, replicon, base and strand, so opposite-strand sites at
one base are two, and repeated conditions or several owners of one site are one.
`relation.count`, `model.siteCounts`, the colour metric, the count filter, the
site list, both compact gene viewers, the expanded sequence view and the export
all read this one number. Display zoom, hidden marks and filtered-out
neighbouring genes never change it.

- **Colour.** The Neighbouring-gene TSS in CDS option, still first in Genomic
  context, draws the count on the numeric ramps and Scale control
  (`neighborSiteCountMetric`). Its legend lists one row per count present, with
  its gene total and its exact drawn colour, then the unavailable genes in the
  no-value colour. A site file still loading names itself as the metric's
  `fileKey`, so the scale chosen over no values is chosen again when it lands.
- **Filter.** An inclusive *At least*/*At most* range on the count sits in the
  same fieldset and applies together with the shortcuts above it. With recorded
  overlap is the same as at least 1 and Without the same as at most 0; neither is
  rewritten as a range. A saved range is suspended, never applied, while the
  evidence is unavailable, and an inverted range keeps nothing and says so.
- **Saved state.** `nc` carries `min:max`, either side blank when open, and is
  omitted with no range, which is what every earlier link drew, so no version
  bump. `ns` keeps its four values and meanings. Clear all filters clears both.
  The export manifest records `countRange`, `effectiveCountRange` and
  `countSuspended` beside the existing status fields.
- **Export.** `neighborTssSitesInCds` follows `tssMappedSiteCount` and belongs
  to the TSS evidence layer, so an organism without the layer omits it. It is
  blank, not zero, while the evidence is unavailable.

Colour changes preserve the shared explanation disclosure structure. Check
round trips between neighbouring-site, numerical and other categorical colours
in both chromosome and scatter views, including live shared-link changes.
Shared categorical help must not label site-evidence classes as function
categories or imply lab-reviewed/source-derived provenance for these sites.

The `ns` share-link field carries `any`, `with`, `without` or `unavailable`;
fresh links omit `any`. Clear all filters clears it. Selection reset preserves
analysis filters, existing self-TSS visibility and the source-selection contract.
Existing per-organism storage and navigation carry this field with the view.
Exported `viewState` preserves the requested mode. `filterState.neighborSiteFilter`
records effective narrowing, with `neighborSiteFilterStatus` carrying requested
and effective modes, suspension, evidence availability and its reason. A suspended
with/without request therefore exports an effective `any`, matching the CSV's
`passesCurrentFilters` values.

Purple line markers centre on the native base inside the compact CDS track
and align to that base in the expanded sequence's Sites row. Each recorded TSS
is one genomic base, not a measured multi-base promoter or RBS footprint.
At nucleotide zoom, a purple underline spans exactly that base column in the
Original and Recoded rows, leaving both letters readable. Separate sites never
highlight the intervening bases; reverse-strand, split-CDS and circular-origin
positions use the same exact coordinate mapping. The persistent inspection list exposes every crowded
site and selectable source-associated gene. On the chromosome, N/Shift+N walks
all sites in the current camera, including coincident marks and sites belonging
to hidden genes; Enter focuses their list. Repeated pointer/touch clicks cycle
sites sharing pixels. At dense chromosome zoom, line markers and their pointer
targets are suppressed when fewer than 12 pixels per mark are available; N and
the list still inspect every site, with the active site drawn explicitly. This
keeps gene colours and gene selection usable. Every line marker has a contrasting
outline, including on a CDS with the same categorical colour. The active
chromosome line is painted last and has a two-pixel teal ring isolated by white
on both sides, so it remains distinguishable from inactive lines on purple CDS.
Both gene viewers
explain the line separately from self-associated start sites.
Site action keys contain structured source identifiers. Focus restoration must
compare these as opaque dataset values rather than interpolate them into CSS
selectors. Exercise associated-gene navigation from the gene-detail viewer as
well as the expanded sequence; the selected gene and shared URL must both change.
Existing per-view TSS visibility controls govern both
self-associated and neighbouring Tan marks. Hidden marks have no pointer or keyboard targets; lists
and evidence counts remain, with an explicit hidden-state explanation. A gene
with only neighbouring markers still has its control.

Run `tests/js/neighbor-site-count.test.mjs` for the count, its range filter,
saved state and the shipped-data comparison against an independent enumeration.
Run `tests/js/neighbor-sites.test.mjs` for segment boundaries/gaps, both strands,
origin ordering, identities, self/multiple/unassigned source links, condition
repeats, source suspension and the independent shipped-data membership oracle.
For rendered checks, serve the repository root on an unused port. Open
`http://127.0.0.1:PORT/site/index.html?uiArtifacts=ABSOLUTE_ARTIFACT_DIRECTORY` in
a unique Playwright CLI session; create the artifact directory first. Serving
`site/` directly also works; both helpers resolve the current app directory. Run
`tools/ui/check_neighbor_sites.js` and `tools/ui/check_neighbor_sites_states.js`
with `playwright-cli -s=SESSION run-code --filename=SCRIPT`. Inspect their
screenshots and semantic output. Treat a CLI `### Error` as failure even when
its process exits zero. The state check exercises loading, failure/retry,
conditions, empty results and coincident sites; its synthetic payload must carry
matching manifest bytes and SHA-256 rather than bypassing release integrity.
The repository's three full gates and all-organism release checks remain required.
For active-state contrast and zoom-limit feedback, run
`tools/ui/check_neighbor_sites_repair.js` in the same manner. Compare inactive,
Inspect and keyboard-N states on purple CDS at 375/1280 px and 1×/4× device pixel
ratio; inspect the screenshots as well as the ring pixel/width assertions.
No visual baselines change.
