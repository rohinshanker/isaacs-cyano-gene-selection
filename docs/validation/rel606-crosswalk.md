# REL606 to MG1655 crosswalk, and how it was verified

Built by `tools/rel606_crosswalk.py` into
`data/annotation/rel606-mg1655-crosswalk-v1.tsv`. It exists so the AG3C series
(Houser 2015, Caglar 2017), the only *E. coli* data found that measures
transcript and protein from aliquots of the same flasks in biological
triplicate, can be placed beside this viewer's K-12 MG1655 genes. AG3C is
measured in *E. coli* B str. REL606.

## Inputs, pinned

| Assembly | Role | Verification |
| --- | --- | --- |
| `GCF_000017985.1` (REL606) | source strain | the protein FASTA, feature table and GFF each matched NCBI's own MD5 manifest on retrieval, 2026-10-07 |
| `GCF_000005845.2` (MG1655) | this viewer's genome of record | the repository's existing pinned genome |

The genome files are gitignored; the crosswalk and the MD5 manifest are tracked.

## Why the repository's existing rule does not apply

The cyanobacterial crosswalk joins on an identical RefSeq `WP_` accession.
MG1655's curated record uses `NP_` accessions, so no protein accession is ever
shared with REL606 and that rule would return nothing. Tier 1 below applies the
same criterion at the sequence level, which is what a `WP_` accession means.

## Tiers, strictest first

A locus is assigned by the first tier that claims it, and every tier abstains
rather than guesses.

| Tier | Rule | Pairs |
| --- | --- | ---: |
| 1 | identical protein sequence, unique on both sides | 2,163 |
| 2 | equal length, ungapped identity ≥ 90%, reciprocal best, no tie | 1,512 |
| 3 | gapped alignment, identity ≥ 50% and coverage ≥ 60%, reciprocal best | 169 |
| | **total one-to-one pairs** | **3,844** |

That is 92.2% of REL606's protein-coding loci and 89.6% of MG1655's. Two
sequences held by more than one locus ship as `identical-paralogs` ambiguity
rows naming no partner. 3,728 pairs also carry the 2009 legacy `ECB_` tag, which
is the identifier the AG3C matrices are keyed by.

**No aligner is installed for the bulk of this.** After tier 1, 97% of the
remaining proteins have an equal-length counterpart, because orthologs between
two *E. coli* strains differ by substitutions far more often than by indels. An
equal-length comparison is exact rather than approximate. Only the remainder is
aligned.

Gene order is an independent check and never a criterion. It separates the tiers
as it should: 100% syntenic for tier 1, 99.8% for tier 2, 92.9% for tier 3.

## Verification by exact alignment

Reproduce by re-deriving every assignment with Needleman-Wunsch dynamic
programming over candidates of **all** lengths, which is the assumption the fast
tiers do not test. Biopython's aligner is exact, not a seed-and-extend
heuristic, so it is more rigorous per comparison than DIAMOND; its only weakness
is throughput, which is why discovery used the tiers and only verification uses
it. The run takes about four minutes.

The candidate set always includes the already-assigned partner, so the existing
answer gets no advantage from the prefilter. The prefilter missed an assigned
partner **zero** times in 4,167 loci, which is the evidence that it is adequate.

| Outcome | Count |
| --- | ---: |
| assigned pairs confirmed to be the best available partner | 3,835 |
| assigned pairs where another scored higher | 9 |
| unassigned loci with no qualifying partner at all | 253 |
| unassigned loci whose best partner belongs to a better-matched gene | 62 |
| unassigned loci that are recorded ambiguity rows | 2 |
| unassigned loci in a multi-way paralog tie | 5 |
| **genuine misses** | **1** |

The nine and the sixty-two are not errors. This check asks only "does anything
score higher", while the crosswalk also enforces one-to-one, so a higher-scoring
partner that already belongs to a strictly better match is correctly refused.
Every one of the nine resolves that way; several of the rival pairs sit at 1.000
identity.

The five ties are insertion-sequence paralogs: `b0299` is wanted by two REL606
loci at 1.000 and 0.997, and `b0022` by three at 0.934 each. Assigning any one
would be a guess, so none is assigned.

**The single genuine miss** is `ECB_RS06335`, whose best partner `b4419` scores
0.971, is unclaimed, and was not reached because the pair differs in length and
did not come back reciprocal. It is left unassigned. One locus in 4,167 is
0.024%, and the failure direction is abstention rather than a wrong pair, which
is the direction that cannot corrupt a transferred measurement.

## Agreement with the independent study

The returned package `P-ECOLI-OMICS` built the same crosswalk with DIAMOND
2.2.8, a different algorithm in a different codebase.

| Measure | This build | The returned study |
| --- | ---: | ---: |
| one-to-one pairs | 3,844 | 3,817 |
| AG3C matrix rows reaching a gene | 3,718 of 4,196 | 3,709 of 4,196 |

Two unrelated methods agreeing to within half a percent, with synteny separating
the tiers the same way in both, is the reason to trust either. A third check
with DIAMOND would add independence from a shared implementation mistake, not
rigour; the exact alignment above is already the stricter test.

## What this does not establish

Orthology is an inference about shared ancestry, not a measurement, so no
alignment makes it certain. What is established is narrower and worth stating
plainly: under exact alignment, no better unclaimed partner exists for any
assigned pair but one, and the crosswalk's errors are abstentions rather than
wrong pairs.

A crosswalk is also not permission. Transferring an AG3C value onto an MG1655
gene remains a cross-strain transfer, it must name REL606 wherever it is shown,
and it stays subject to the admission contract.
