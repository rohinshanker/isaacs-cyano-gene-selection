# Proteomics deposit readers

What a PRIDE proteomics deposit actually serves, which reader takes it, and the
counting and sign rules each one commits to. Written from the four deposits
admitted by 2026-10-07: PXD062851, PXD030282, PXD000510, PXD005851 and
PXD005105.

## Read the deposit before planning the work

A PRIDE file category is not a promise about content. `SEARCH.zip` in
PXD005105 is categorised SEARCH and holds 118 ProLuCID `.sqt` files, which are
unfiltered candidate matches with the decoys still in them, not the authors'
filtered protein list. In `wild type -1/wt-1.sqt`, 10,882 of 21,349 rank-1
matches are `Reverse_` decoys, a 49% false-discovery rate, so counting those
spectra as deposited would produce a quantity about half of which is noise.
The filtering the authors ran, and the NSAF values PRIDE advertises as the
quantification method, were never deposited.

Check three things before committing to a deposit:

1. The PRIDE v3 file listing, the FTP directory and the deposit's `README.txt`,
   which can disagree. Page the v3 listing: it returns 100 files at a time, so
   a 865-file deposit looks like 100 unless `page` is advanced.
2. Whether a `generated/` subdirectory exists. PXD000510's mzTab files live
   there and are absent from the top-level listing.
3. The mzTab `MTD mzTab-type` line. `Identification` means there is no
   reporter-ion or abundance column whatever the study measured, so a TMT
   experiment can deposit results that carry none of its quantification.

A deposit that serves no protein-level table is not automatically out. The
article's supplement may carry the published values, and a partial published
result is still a complete result: PXD005105 ships from 95 proteins because
that is what the paper published, not as a sample of something larger.

## Which reader takes what

All three live in `tools/ingest_expression.py` and are selected by
`reader.format`.

| Format | Takes | Value read |
| --- | --- | --- |
| `dtaselect` | DTASelect filter reports in a zip, one member per run | the report's own `Spectrum Count` |
| `mztab` | an mzTab 1.0 protein table, gzipped or not | `num_psms_ms_run[1]` by default, any `countColumn` |
| `mzidentml` | an mzIdentML 1.1 search result, streamed | unique rank-1 matches per protein |

`mztab` reads the `PRH`/`PRT` sections only, drops a row flagged in
`opt_global_cv_PRIDE:0000303_Decoy_hit`, and skips a protein whose count cell
is empty or `null` rather than reading it as zero.

`mzidentml` parses with `iterparse`, because a deposited search result does not
fit in memory as a tree. It counts a match only when it is rank 1, passes the
search's own threshold, has `MS-GF:QValue` at or below `qValueMax` (0.01 by
default), and all of its non-decoy evidence names one protein. **A spectrum
whose peptide is shared between proteins is counted for neither, not for each**,
because counting it for each inflates every protein it touches; in PXD005851's
first BG-11 run that sets aside 854 matches of about 17,100. Accessions of the
form `sp|P06539|PHCB_SYNE7` reduce to the UniProt accession.

Both counting readers produce spectral counts. That is a coarse abundance
measure favouring long and readily ionised proteins, and the caveat of every
layer built from one says so.

## A ratio is not an amount

Owner decision, 2026-10-07: a ratio-to-reference result ships as a signed layer
listed apart from abundances and labelled as a ratio. Two mechanisms enforce
that, and a new ratio layer needs both.

`assayKind` in `site/js/core/type-metrics.js` returns `ratio` when the source's
`assay` contains the word, giving the layer its own type key and its own
"… ratio (<platform>)" label. Without it the layer falls through to `abundance`
and is rank-pooled with real abundance deposits, averaging a fold change into
measurements of how much protein is present. The spec controls this through its
`assay` string, so a ratio layer must name itself one.

`scripts/expression_table.py` heads the value column `ratio` for a signed
source that is not a fitness screen, and `build_features.py` checks the header
with the same rule. Otherwise a downloaded file offers a negative amount of
protein.

## Check the sign convention against the numbers

A published "fold change" column may be log2, a plain ratio, or a signed fold
where a ratio below 1 is written as its negative reciprocal, and the three are
not distinguishable by eye. Test all three against the deposit's own
per-condition values before labelling the layer.

PXD005105's Dataset S1 matches signed WT/L1118 on all 95 rows and matches
neither signed L1118/WT nor log2 on any, which the appendix caption confirms:
"fold change between WT and L1118 proteins". A negative value therefore means
the protein is **higher in the engineered strain**. The signed-fold convention
also leaves no value between -1 and 1, and the shipped table has none, which is
a cheap check that the convention survived ingestion.

## Identifiers and what they cost

Every proteomics deposit here keys on UniProt accession and routes
accession → ordered locus → UTEX locus tag, one-to-one at both hops. The losses
are real and worth predicting before promising coverage: of PXD005105's 95
accessions, 6 reach no single ordered locus and 1 is dropped at the crosswalk,
leaving 88. An accession naming several ordered loci is ambiguous and is
dropped, which is why C-phycocyanin beta, `P06539`, is absent from PXD005851's
layers despite being among the most-counted proteins in every run.

## Publisher files an agent cannot fetch

PNAS answers an automated client with HTTP 403 on every `suppl_file` path,
including one a person downloads successfully in a browser, and PMC serves a
proof-of-work challenge. Do not work around either: no User-Agent change, no
mirror (LIT-08 and LIT-09 of the blocked-task register).

Declare the file `"manual": true` in the spec's `files` entry. `fetch` then
refuses to request the URL at all, requires the file to be staged at
`data/interim/expression/<name>`, and still verifies the pinned checksum, so a
challenge page cannot land in the staging directory as the pinned input. The
owner saves the file by hand and an agent stages it.

## Verifying a shipped layer

Recompute one value end to end from the deposited file rather than trusting the
pipeline, and pick a protein you can identify:

- PXD000510: `O05161` has 62 of 47,943 PSMs in the first window, 1293.2023 cpm,
  reaching `M744_RS04390` through `Synpcc7942_2345`.
- PXD005851: allophycocyanin beta, `Q31RG1`, gives 13030.9177, 13424.4720 and
  11892.3558 cpm across the three BG-11 replicates, mean 12782.5818, shipped
  against `Synpcc7942_0326`.
- PXD005105: `Q31MQ3` carries -5.8751 in Dataset S1 and against
  `M744_RS07950` here.

A spectral-count layer should be dominated by phycobilisome subunits and the
RuBisCO large subunit. If it is not, the parse is wrong.
