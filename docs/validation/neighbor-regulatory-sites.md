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
Antisense locus associations are source context, not proven regulation;
Table S8 potential-target hypotheses do not produce extra associations.

The loader builds the index when either payload lands. Filtering, categorical
colour, counts and viewer marks read that same index, independently of the
current mask or nearest plotted neighbour. All four Tan condition selectors and
the explicit legacy pooled choice retain identical Table S1 site coordinates.
Removing every Tan initiation source or failing/loading either site payload or
the informing initiation payload suspends narrowing and marks consistently.
Unavailable is a third colour bucket, never a count of zero or “without overlap”.
The unavailable filter is explicit; saved with/without narrowing is suspended.

The `ns` share-link field carries `any`, `with`, `without` or `unavailable`;
fresh links omit `any`. Clear all filters clears it. Selection reset preserves
analysis filters, existing self-TSS visibility and the source-selection contract.
Existing per-organism storage and navigation carry this field with the view.

Purple diamonds centre on the native base inside the compact CDS track and
expanded sequence track. The persistent inspection list exposes every crowded
site and selectable source-associated gene. On the chromosome, N/Shift+N walks
all sites in the current camera, including coincident marks and sites belonging
to hidden genes; Enter focuses their list. Repeated pointer/touch clicks cycle
sites sharing pixels. Existing per-view TSS visibility controls govern both
self-associated and neighbouring Tan marks. Hidden marks have no pointer or keyboard targets; lists
and evidence counts remain, with an explicit hidden-state explanation. A gene
with only neighbouring markers still has its control.

Run `tests/js/neighbor-sites.test.mjs` for segment boundaries/gaps, both strands,
origin ordering, identities, self/multiple/unassigned source links, condition
repeats, source suspension and the independent shipped-data membership oracle.
For rendered checks, serve `site/` on an unused port. Open
`http://127.0.0.1:PORT/index.html?uiArtifacts=ABSOLUTE_ARTIFACT_DIRECTORY` in a
unique Playwright CLI session; create the artifact directory first. Run
`tools/ui/check_neighbor_sites.js` and `tools/ui/check_neighbor_sites_states.js`
with `playwright-cli -s=SESSION run-code --filename=SCRIPT`. Inspect their
screenshots and semantic output. Treat a CLI `### Error` as failure even when
its process exits zero. The state check exercises loading, failure/retry,
conditions, empty results and coincident sites; its synthetic payload must carry
matching manifest bytes and SHA-256 rather than bypassing release integrity.
The repository's three full gates and all-organism release checks remain required.
No visual baselines change.
