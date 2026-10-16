# E. coli CAI reference membership evidence

The MG1655 reference remains the 81 members defined in the
[CAI selection contract](cai-reference-set.md). The owner directed evidence review
with membership retained on 2026-10-14. This bounded review of five primary
publications supports the distinctions below; it does not establish a universally
optimal reference set or authorize changing the published weights.

## Interpretation by locus

| Locus | Supported evidence | Reference-set implication |
| --- | --- | --- |
| `b2891/prfB` | Native MG1655 ribosome profiling measures translation of the programmed-frameshift RF2 gene (S4). | Frameshifting is a CDS/translation issue, not by itself an exclusion criterion. Retain current membership; one condition does not establish constitutively high expression. |
| `b0296/ykgM` | Zinc/Zur-dependent regulation and ribosome incorporation are supported by S1–S3. | Treat this as a conditional ribosomal paralogue. Its inclusion is a convention, not evidence of unconditional high expression. |
| `b4506/ykgO` | MG1655 tagged-protein and transcript measurements support zinc/Zur regulation (S1). S2's microarray did not assay this gene. | Retain the conditional-paralogue caveat. Missing assay coverage is not zero expression. |
| `b4147/efp` | EF-P relieves selected proline-associated translation stalls in MG1655-derived strains (S5). | The functional name does not prove high abundance; specialization alone does not justify exclusion either. Retain current membership. |

For a future reference explicitly intended to represent constitutive high
expression, `ykgM` and `ykgO` need particular scrutiny. The reviewed evidence does
not establish universal near-silence in rich media: tagged YkgO was lower in LB
than the tested minimal medium (S1), while loss of Zur increased YkgM incorporation
into MG1655 ribosomes (S3). Neither result supplies absolute whole-cell abundance
across all growth conditions.

S4 Table 2, row `prfB (RF2)`, native `RF2K-12` column, reports **736.7 ± 113.7
ribosome-footprint RPKM** (mean ± SEM), in MG1655 MOPS-complete glucose at 37°C.
Table 1 identifies the native strain. This is ribosome density, not protein copies
or a high-expression membership threshold.

## Evidence scope

| Source | Studied material and measurement | Limit that must travel with the claim |
| --- | --- | --- |
| S1 | MG1655 and a Zur-deletion derivative; chromosomal SPA-tagged YkgO, transcript measurements, M63/zinc and LB/minimal-medium comparisons | Tagged protein; not a separate absolute YkgM protein measurement. |
| S2 | BW25113 under zinc depletion; transcript assays | Not MG1655. Methods name BW25113, Results spell BW21135; preserve that discrepancy. Recombinant BL21 protein work is separate. `ykgO` was absent from the microarray. |
| S3 | MG1655 and derivatives, exponential LB; purified-ribosome proteomics | L31p means YkgM; incorporation into ribosomes is not whole-cell abundance. The L31 reporter is not a direct YkgM abundance assay. |
| S4 | Native MG1655 and release-factor derivatives; ribosome profiling | Keep native and mutant columns separate; one-condition density is not constitutive protein abundance. |
| S5 | MG1655-derived auxotrophic/deletion strains; SILAC proteomics in MOPS minimal medium | Specialized EF-P function, not an abundance calibration in unchanged MG1655. |

## Source receipts

Retrieved 2026-10-16 UTC. Each quotation below was mechanically matched after
parsing the fetched HTML/XML and collapsing whitespace, with no wording changes.
Hashes identify the exact retrieved bytes; a later live HTML response may differ.
Full papers remain retrieval inputs rather than redistributed repository data.

### S1 — Hemm et al. (2009)

[Small Stress Response Proteins in Escherichia coli: Proteins Missed by Classical Proteomic Studies](https://pmc.ncbi.nlm.nih.gov/articles/PMC2798279/). DOI `10.1128/JB.00872-09`; PMID `19734316`.

> ykgM-ykgO-SPA mRNA levels and YkgO-SPA protein levels were strongly repressed by zinc

Location: Results, ykgM-ykgO is repressed by Zur, section #sec12, first paragraph; Figure 3B (#f3).

Retrieved: `2026-10-16T19:53:30.938661+00:00`; [retrieval endpoint](https://pmc.ncbi.nlm.nih.gov/articles/PMC2798279/).
SHA-256: `280bbcbafa635ff48283ff70b1bebe6a4046c919fd8a173278b1851b42e10bf9`.

### S2 — Hensley et al. (2012; online 2011)

[Characterization of Zn(II)-responsive ribosomal proteins YkgM and L31 in E. coli](https://pmc.ncbi.nlm.nih.gov/articles/PMC3325339/). DOI `10.1016/j.jinorgbio.2011.11.022`; PMID `22196016`.

> The most up-regulated gene in our studies was ykgM.

Location: Discussion, #S17, paragraph #P32.

Retrieved: `2026-10-16T19:53:30.918362+00:00`; [retrieval endpoint](https://pmc.ncbi.nlm.nih.gov/articles/PMC3325339/).
SHA-256: `3b6cb48d506f5d1aab57346f7a0bb302d87d948b047acbef9a61c13ed85516b0`.

### S3 — Rasmussen et al. (2022)

[Zur and zinc increase expression of E. coli ribosomal protein L31 through RNA-mediated repression of the repressor L31p](https://pmc.ncbi.nlm.nih.gov/articles/PMC9825181/). DOI `10.1093/nar/gkac1086`; PMID `36533433`.

> ribosomal incorporation of L31 was lower and L31p incorporation higher in Δzur cells

Location: Results §zur increases l31 mRNA levels and L31 incorporation into ribosomes, #SEC3-3, second paragraph; Figure 3B (#F3).

Retrieved: `2026-10-16T19:53:11.237712+00:00`; [retrieval endpoint](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9825181/fullTextXML).
SHA-256: `c18bff66811317754abde20a65226ea892721f4a43b7ce790932740da33c056e`.

### S4 — Baggett, Zhang and Gross (2017)

[Global analysis of translation termination in E. coli](https://pmc.ncbi.nlm.nih.gov/articles/PMC5373646/). DOI `10.1371/journal.pgen.1006676`; PMID `28301469`.

> The translation of prfB is regulated through a programmed +1 frameshift at codon 26

Location: Results, Release factor expression (#sec005), Figure 3 caption (#pgen.1006676.g003).

Retrieved: `2026-10-16T19:53:01.374568+00:00`; [retrieval endpoint](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC5373646/fullTextXML).
SHA-256: `2ff9143574126f2fad3d36afcffdb05e811afb8f9b1346d30c22daf34975d09f`.

### S5 — Peil et al. (2013)

[Distinct XPPX sequence motifs induce ribosome stalling, which is rescued by the translation elongation factor EF-P](https://pmc.ncbi.nlm.nih.gov/articles/PMC3780873/). DOI `10.1073/pnas.1310642110`; PMID `24003132`.

> the major role for EF-P in the cell is the relief of translational stalling at proline-containing motifs

Location: Discussion (#s7), first paragraph, final sentence.

Retrieved: `2026-10-16T19:53:30.778658+00:00`; [retrieval endpoint](https://pmc.ncbi.nlm.nih.gov/articles/PMC3780873/).
SHA-256: `4d9b58317a1a30199277dba3223a1868db2544aac8c0a010d17cbbf8a98fd84a`.

## Rechecking the release and a future change

At published baseline `3f4ad333efa8eae2f637e5b14ad24052211758d3`, recomputing
`scripts/build_features.py:is_cai_reference` with the MG1655 rule over
`site/data/organisms/ecoli-k12-mg1655/genes.json` exactly reproduces the ordered
81-locus manifest in the sibling `meta.json`. All four reviewed genes are present.
The published `prfB` entry already declares `ribosomal_slippage`, two CDS
segments and 365 sense codons; this review identifies no plain-span CDS defect.

To repeat a source check, fetch its recorded endpoint, compute SHA-256, parse
HTML with BeautifulSoup `get_text("", strip=False)` or XML with concatenated
ElementTree `itertext()`, collapse whitespace, and match the quoted passage at
its stated section. For the S4 value, inspect XML table
`pgen.1006676.t002`, row `prfB (RF2)`, first data column, including its header and
caption. Recheck strain identity in Table 1; do not substitute a mutant column.

Any membership change still needs a curated biological policy with explicit
strain/condition goals and held-out evaluation, followed by the full rebuilding
and release checks in the selection contract. Essentiality, a functional product
name, and CAI computed from the same reference set are not independent expression
validation. Existing NCM3722/REL606 expression layers retain the transfer limits
in the [E. coli expression contract](ecoli-expression-sources.md).
