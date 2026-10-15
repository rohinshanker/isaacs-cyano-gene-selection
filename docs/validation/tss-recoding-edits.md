# Sequence edits at reported TSS positions

The per-gene comparison uses the admitted native Tan 2018 TSS records and the
active recoding scheme. It counts recorded sites whose base changes inside the
focal CDS. It does not predict a new promoter, remove an original TSS coordinate,
or establish a change in transcription or regulatory function. The broader
regulatory-site prediction work remains separate.

## Sites and sequence

Use the same physical site index as [neighbouring regulatory sites](neighbor-regulatory-sites.md),
but include every admitted site inside the focal CDS: self-associated,
neighbour-associated and unassigned. Source ownership does not change whether a
base is inside a CDS. Both strands count. Identity includes study, type, native
replicon, position and strand; repeated conditions or source associations count
once. Opposite-strand sites at the same base count as two site identities, so the
metric is a count of sites with edited bases, not distinct nucleotide positions.
A site shared by two CDSs is evaluated separately for each gene.

Only actual CDS segments contribute. Exclude splice gaps and display padding;
keep circular-origin joins and minus-strand coordinates exact. Compare the focal
gene's independently recoded sequence, including the separately stored terminal
stop. The initiation triplet stays unchanged, and distributed substitutions reset
their occurrence counters for each gene, following the existing scheme contract.
This comparison does not construct a conflict-resolved recoded chromosome when
CDSs overlap.

The displayed original and recoded bases name their orientation. Focal-CDS
transcription orientation and TSS-strand orientation differ by complementation
when the strands oppose. Keep the native site position, strand, source identifiers
and associations available after an edit. A reported TSS is one genomic base;
no multi-base promoter footprint is inferred from it. See the
[Tan source contract](../../data/expression/TAN2018_TSS_PROVENANCE.md).

## Counts and availability

Expose the number of edited site identities alongside the number of evaluated
recorded sites. A valid comparison with zero edits is distinct from an
unevaluated comparison. A CDS with no admitted sites has zero recorded sites;
that is not evidence of promoter absence. An identity scheme is an evaluated
unchanged sequence.

Missing, loading, failed, unsupported or deselected Tan evidence yields no data,
not zero. A sequence/coordinate mismatch also remains unevaluated. The condition
selector affects evidence availability, not site coordinates; all Tan condition
layers retain the same admitted positions. Replacing a payload, switching the
scheme or changing organisms must invalidate the appropriate cached comparison.
Visibility controls affect drawing, not the numerical result. Readiness and
initial file promotion include both `tssEvidence` and `regulatoryTss` for colors,
axes and numeric filters. Automatic scales wait for both payloads; a saved
explicit scale stays the reader's choice.

Native sequence validation and site-to-codon/occurrence mapping are cached
separately from scheme results. A scheme change compares the recorded site bases
against the new substitutions without rebuilding complete per-base models for
every CDS. Exporting other schemes retains the current scheme's cached result.
Even a gene with no recorded sites must pass sequence/coordinate validation
before receiving evaluated zero counts.

## Browser and export

The numeric metric **Edited TSS sites in CDS** uses key
`editedTssSitesInCds`. **Evaluated recorded TSS in CDS** provides its denominator
as `evaluatedTssSitesInCds`. The ordinary numeric registry supplies coloring,
axes and custom filters. Saved color/filter state uses those keys and the usual
scheme state. The edited count is scheme-dependent and cannot be a fixed
panel-design constraint; the panel engine also rejects restored/manual attempts
to use it that way. The evaluated-site denominator is scheme-independent and can
be constrained. The sequence-edit inspection disclosure in both compact viewers
and the expanded sequence view lists each original site, edit state and base
pair; the expanded view can center a selected site for exact-base inspection.
Keep start-site visibility controls effective while preserving the counts/list.

Exports recompute both counts for each exported scheme, rather than copying the
currently displayed scheme's values. Undefined counts are blank. The row's
`tssRecodingStatus` and `tssRecodingReason` explain evaluation, and the manifest
retains the source and sequence-edit definition alongside each scheme identity.

## Verification

`tests/js/tss-recoding-oracle.test.mjs` independently enumerates the shipped
source rows, decodes the published codon alphabet, orders actual CDS intervals
and applies explicit identity, amber, Syn61 and alternating-replacement rules.
Its reference calculation does not call production coordinate or recoding
helpers. It checks every site's original coordinate, source IDs, both oriented
base pairs, edit state and both per-gene counts. The native release has 2,773
site/gene observations across 2,715 evaluable CDSs; 1,139 CDSs have no recorded
site. The explicit Syn61 map edits 35 site/gene observations in 35 genes, and
`TAG → TAA` edits one. These are sequence-overlap regression anchors, not
experimental outcomes or predictions of regulatory disruption.

Focused synthetic tests cover sequence and coordinate failures, both strands,
segment boundaries and gaps, circular joins, duplicate identities, start/stop
rules, distributed schemes and evidence state transitions. Keep browser checks
for color selection, source and scheme updates, both compact viewers, expanded
exact-base inspection, saved state and exports. Use the repository's UI skill at
mobile, tablet and desktop widths, including breakpoint neighbours; inspect the
actual renders and keyboard/focus behavior. Run the repository's three required
gates after integration.

Serve the repository root on an unused port. In a uniquely named Playwright CLI
session, open `/site/?uiArtifacts=/absolute/ignored/artifact/directory` and run:

```sh
node --test tests/js/tss-recoding.test.mjs tests/js/tss-recoding-oracle.test.mjs
playwright-cli -s=YOUR_SESSION run-code --filename=tools/ui/check_tss_recoding.js
playwright-cli -s=YOUR_SESSION run-code --filename=tools/ui/check_tss_recoding_repairs.js
```

Reopen the URL with `uiArtifacts` before each harness. The browser checks use
real release records and controlled loading/failure states. The repair checks
cover saved/late metric selection with either payload delayed, explicit scale
preservation, fixed panel constraints and repeated scheme timings. Inspect its screenshots and semantic snapshots; a CLI `### Error` is a
failure even if the command exits zero. Keep failure fixtures consistent with
published integrity requirements and do not bypass the data loader.
