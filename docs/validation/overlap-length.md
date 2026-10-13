# End-specific overlap lengths

The three numerical metrics extend the [native OG relation](gene-overlaps.md)
without changing its annotation coverage, strand classes or genomic intervals.
All annotated partners count, including noncoding and unplotted genes.

## Counting contract

`site/js/core/overlap-length.js` defines `endOverlapLengths`. Union partners'
shared intervals, then count covered bases continuously inward from each focal
transcriptional end. Stop at the first uncovered base or real CDS-segment gap.
The circular-origin junction is continuous; internal-only overlaps contribute
zero to both ends. Coordinates are 1-based and inclusive, and reverse-strand
genes exchange the genomic directions of their ends.

| Field | Quantity in bp |
| --- | --- |
| `overlap5PrimeNt` | Contiguous shared bases inward from the 5′ end |
| `overlap3PrimeNt` | Contiguous shared bases inward from the 3′ end |
| `overlapTotalNt` | Arithmetic sum of the two end lengths |

A base counts once within an end, irrespective of partner count. A fully covered
continuous gene contributes its length to each end, so the sum can be twice its
length. Known zero means no end overlap, not absence of internal overlaps.
Missing data, unknown focal strand and unsupported origin joins with more than
two pieces remain unavailable. These annotation-derived lengths do not predict
regulatory effects.

The dataset applier computes and caches the fields after OG validation, using
the validated index's own replicon lengths. Removing the layer removes the
fields; reapplication recomputes them. Filters and partner visibility cannot
change the values. No additional genomic payload is published.

## Controls and persistence

**Overlap length** selects one end and optional inclusive minimum and maximum.
Blank means unbounded. Bounds must be nonnegative safe integers with minimum
no greater than maximum. Invalid drafts remain visible with an inline error;
the last valid range remains applied. Clear this control or all filters to
remove the range. It composes with other filters and their legend previews.
Choosing an end with both bounds blank creates no filter, saved URL field or
blocking data dependency. The chosen end remains ready for input. Clearing the
overlap control moves keyboard focus to its minimum field.

Without the OG layer the range is suspended. Individual unavailable lengths
stay visible with an explanation; they never become zero. The independent
**Color by** choices use the normal numerical scales, bp legends and neutral
unavailable colour. Gene detail and exports read the same cached fields.
Loading, failed and absent layers omit the numerical ramp and value count while
retaining the map's unavailable, filtered, shortlisted and pinned marker key.
Chromosome legends use their own marker conventions.
Exports carry known zero as zero, unavailable as blank, and the applied range
in their manifest. The metric registry owns the three numerical CSV columns;
do not also add them to identity columns. Regression checks require each header
exactly once, because parsers can silently collapse duplicate headers.

State is `overlapLengthFilter: {end, min, max}` or `null`. URL field `ol`
encodes `end,min,max`, where end is `5prime` or `3prime` and empty bounds are
unrestricted. Omission means unfiltered; malformed values are ignored. Existing
URL versions retain their meaning. Each organism's saved view owns its range
and colour choice; restoring a view clears stale invalid drafts.

## Regression checks

```sh
node --test tests/js/overlap-length.test.mjs tests/js/overlap-length-oracle.test.mjs tests/js/gene-overlaps.test.mjs tests/js/export-manifest.test.mjs tests/js/legend.test.mjs
```

The independent oracle expands 3,000 seeded small genomes and walks individual
bases without production interval arithmetic. Preserve both strands, duplicate
and nested partners, origin wrapping, actual gaps, unavailable context and full
coverage in its fixtures. Applier tests must exercise exact and aliased replicon
accessions through removal and reapplication, using the validated layer's lengths.

Render map and chromosome views at 375, 768, 1280 and 1440 pixels and around
affected breakpoints. Check all three colours, zero/empty-result ranges,
invalid text, keyboard focus, clear/reset, URL restoration, organism switching,
and OG/essentiality selection and preview composition. Exercise loading,
absent/failed data and successful retry. Inspect help and gene values as well
as controls, collect diagnostics, and run the repository completion gates.
Test invalid-draft clearing through real organism and URL navigation; the app's
explicit view restoration owns that reset.
