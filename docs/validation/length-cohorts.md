# Length cohort contract

Run `python3 tools/length_cohorts.py check` after reacquiring the pinned
RefSeq release or changing the site gene set. To regenerate deliberately, run
`python3 tools/length_cohorts.py build`, review the diff, then run the check.
The builder verifies the GFF SHA-256 from the protein evidence release and
joins every plotted locus to an admitted RefSeq protein identity.

`site/data/length_cohorts.json` contains 2,776 annotated loci in
`GCF_000817325.1-RS_2026_05_13`: 2,769 RefSeq `gene` features and seven
`pseudogene` features. The former comprise 2,715 protein-coding genes and 54
noncoding RNA genes. The 2,715 plotted CDSs all have exact RefSeq protein
records, but only 2,711 unique protein accessions because four IDs are shared
between pairs of loci. A RefSeq record is protein identity evidence, not direct
proteomics detection.

`geneSpanNt` is the inclusive feature span (`end - start + 1`).
`cdsLengthNt` is the plotted, joined CDS length including the terminal stop.
These must remain separate: joined `prfB` is 1,123 nt by gene span and 1,122 nt
by CDS length. Pseudogene CDS features are excluded from the plotted cohort,
but their gene spans remain in the annotated-locus chart.

The histogram cohort changes only the histogram. The map, its existing size
filter, and its projection remain the 2,715 screened CDSs. Length bounds are
inclusive integer nucleotides. Shortlist rows remain present when outside the
map filters; CSV rows record `passesCurrentFilters`, and the export manifest
records range and protein-evidence selections. URL keys `lc` and `pr` carry
the chart cohort and RefSeq record filter; the existing `f` key carries the
CDS length range.

For rendered keyboard validation, open the Lengths tab, focus “At least”,
enter 201, press Tab, enter 2001 in “At most,” and press Tab. The first Tab
must focus the maximum input; the URL must contain
`f=lengthNt%3A201%3A2001`. Changing the cohort must leave its selector
focused for another keyboard change.

CDSs below 75 nt receive an annotation review flag without exclusion. The
current release has zero below 75 nt and one exactly 75 nt
(`M744_RS14315`). Direct UTEX 2973 proteomics detection is visible but
unavailable: public PASS00399 files have a search FASTA and unfiltered hits,
without a reproducible accepted per-locus result list under the study's
criteria. See [protein-evidence.md](protein-evidence.md) before changing that
status.
