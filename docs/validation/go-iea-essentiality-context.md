# GO IEA essentiality context and annotation discrepancies

`site/data/go-iea-essentiality-v1.json` gives every plotted UTEX 2973 CDS an
essentiality evidence tier and lists every place where its GO IEA terms
disagree with another annotation. The GO tier is a computational fallback. It
is not a knockout result, an essentiality call, or a UTEX 2973 measurement.

```sh
python3 tools/build_go_iea_essentiality.py --check   # offline; CI runs this
python3 tools/build_go_iea_essentiality.py --spot-check-replay   # the reviewed sheet, exactly
python3 tools/build_go_iea_essentiality.py --spot-check-sheet --seed N   # a fresh draw
python3 -m pytest -q tests/test_go_iea_essentiality.py
node --test tests/js/go-iea-essentiality.test.mjs tests/js/export-manifest.test.mjs \
  tests/js/panel-golden.test.mjs
```

## Precedence

Each locus takes the first tier that applies:

1. **Tested UTEX 2973 allele.** These are the three Ungerer et al. 2018 loci.
2. **Admitted PCC 7942 call.** The exact-join status must be `essential`,
   `beneficial`, or `non-essential`, as described in
   [pcc-essentiality.md](pcc-essentiality.md).
3. **GO IEA context.** The locus's GO IEA terms must be judged to place the
   protein in a core cellular process.
4. **Unknown.**

`ambiguous`, `missing`, and `not_analyzed` PCC states are not determinate calls.
Those loci, and the unjoined `unknown` loci, are eligible for the fallback. Their
PCC state stays visible beside the tier. The guided panel objective reads none
of these tiers. `tests/js/panel-golden.test.mjs` proves the real ten-gene design
is unchanged with the file removed and with every locus forced to the GO tier.

## Essentiality-relevant rule

Only a **core-cellular-process** judgment counts as essentiality-relevant
context. Raw GO row count never counts. Peripheral or generic terms are not
evidence of non-essentiality; such loci stay unknown.

The frozen rubric in `data/audits/go-iea-essentiality/rubric.json` defines a
core process as one that a growing photoautotrophic bacterium depends on:

- ribosome, translation, and aminoacyl-tRNA synthesis;
- the core RNA polymerase, chromosome replication, and cell division;
- ATP synthase;
- photosystems, cytochrome b6f, and photosynthetic electron transport;
- Calvin-cycle or carboxysome CO₂ fixation;
- biosynthesis of amino acids, nucleotides, essential cofactors, chlorophyll,
  carotenoids, fatty acids, membrane lipids, lipid A, and peptidoglycan;
- Sec, Tat, SRP, or YidC protein translocation; and
- rRNA or tRNA maturation.

Regulators, signalling, DNA repair, stress responses, and chaperones outside
those processes are excluded. The rubric also requires terms to name a specific
process, activity, or complex. Ligand binding, broad enzyme classes, and
membrane location are generic.

## Jev judgments

TypeSafe `jev-1.13.0` answers two blinded requests per GO-annotated locus.
There are 1,584 such loci, so 3,168 requests were run on 2026-09-22 for about
2.56 million input tokens. No request state contains a locus tag, PCC status,
tested-allele flag, or tier; `pinned_results` rejects any state that does.

**Context request.** The state holds only the GO terms, each with aspect,
relation, and term name. One Choice question selects `core_cellular_process`,
`peripheral_or_conditional_process`, or `too_generic`. Its instruction is:

> Using only the Gene Ontology terms in `go_annotations`, decide what kind of
> cellular role they assign to this protein from a photosynthetic cyanobacterium.

The product name is withheld, so the GO context cannot echo the annotation it
is later compared with.

**Discrepancy request.** The state adds the UTEX 2973 RefSeq product and gene
symbol. It also adds the PCC 7942 RefSeq product when the joined PCC locus has
a different product text, which is 105 of the 2,542 joins. When the joined
product text is identical, no separate question is asked: the UTEX-product
answer is the judgment for both sources, and a flagged locus receives a
PCC-product note that names the PCC locus and says the judgment is shared.
Where the lab reviewed a category other than Unknown, that category is added
too. One Noul is asked per present field. The UTEX question is:

> Do the GO terms in `go_annotations` contradict the UTEX 2973 RefSeq product
> name in `annotations.utex_2973_refseq_product`?

The PCC-product and reviewed-category questions use the same wording with their
own field. All three share criteria. A contradiction is a specific term that is
incompatible with the annotation. Broader, narrower, generic, or uninformative
annotations such as hypothetical or DUF names are not contradictions.

**PCC-call discrepancy** is a code rule, not a model question. It is reported
when the GO context is core-cellular-process and the admitted PCC 7942 call is
`non-essential`. `beneficial` or `essential` calls are never flagged, and
peripheral GO context never contradicts an essential call.

## Thresholds and why

| Policy | Threshold |
| --- | --- |
| GO context is core | P(core) ≥ 0.9 |
| GO context is not core | P(core) ≤ 0.2 |
| Product or category contradiction | Noul ≥ 0.8 |

Between 0.2 and 0.9 the context is `uncertain` and adds no essentiality context.

**Calibration against real PCC calls.** The table covers the 1,470 GO-annotated
loci that have a determinate PCC 7942 call. That call was never shown to Jev.

| P(core) | Loci | PCC essential fraction |
| --- | --- | --- |
| < 0.2 | 849 | 0.14 |
| 0.2–0.5 | 78 | 0.26 |
| 0.5–0.8 | 70 | 0.40 |
| 0.8–0.9 | 35 | 0.51 |
| 0.9–0.95 | 28 | 0.50 |
| ≥ 0.95 | 410 | 0.73 |

The genome-wide essential fraction among determinate calls is 0.27. The GO
context therefore carries real signal, but even the top band is far from a
call. That is why it ranks below every measured source and uses cautious wording.

**Consequence.** A false GO fallback could make an unmeasured gene look
important and steer a recoding choice. A missed one leaves the locus unknown,
which is today's state. The core threshold was drafted at 0.8. The blinded spot
check found three over-calls at P(core) 0.80–0.87: sulfate assimilation, the
pentose-phosphate shunt, and a phycobilin lyase. It was then raised to 0.9,
removing seven fallback loci. Because the spot check informed this choice, its
agreement at 0.9 is not an independent estimate.

**Contradiction threshold.** All ten predeclared negatives scored ≤ 0.08.
At or above 0.8, the five real UTEX-product flags are each a genuine
disagreement between sources:

- `M744_RS00595`: SecG annotated with sialic acid transport.
- `M744_RS05510`: NblA annotated as a sensor kinase.
- `M744_RS08930`: CbiB annotated with threonine-phosphate decarboxylase (CobD)
  activity.
- `M744_RS04120`: RuvX annotated with rRNA processing.
- `M744_RS08520`: ClcA annotated as a voltage-gated channel rather than an
  exchanger.

The 0.6–0.8 band was reviewed by hand and is mostly compatible pairs. Examples
are signal peptidase II with aspartic endopeptidase, and RNase PH with tRNA
nucleotidyltransferase. A lower threshold would publish false disagreements.
All five UTEX-product flags have an accepted PCC join whose product text is
identical, so each also carries a PCC-product note at the same probability.
The one PCC-product flag from its own question is `M744_RS13955`. Its
ferrochelatase GO terms contradict PCC 7942's older product name,
“chlorophyll a/b-binding protein”.

## Published counts

| Tier | Loci |
| --- | --- |
| Tested UTEX allele | 3 |
| Admitted PCC call | 2,431 |
| GO IEA context | 31 |
| Unknown | 250 |

Of 281 fallback-eligible loci, 112 have GO terms.

| Discrepancy | Loci |
| --- | --- |
| UTEX product | 5 |
| PCC 7942 product | 6 |
| Reviewed category | 0 |
| PCC call | 104 |
| Any | 109 |

Five of the six PCC-product notes reuse the UTEX-product judgment for identical
text; the sixth is judged on its own differing text.

## Evaluation and blinded spot check

The predeclared evaluation set was committed before inference in `cee9427`. It
has 27 context cases on real loci and 19 discrepancy cases. The discrepancy
cases are real pairs plus constructed swaps that pair one locus's GO terms with
an unrelated product or category.

| Check | Result |
| --- | --- |
| Context choice, exact | 27 of 27 |
| Non-core cases published as core | 0 of 15 |
| Discrepancy at 0.8 | 17 of 19 |

The two discrepancy misses were swaps that Jev under-scored:

- ChlG paired with CheW terms scored 0.47.
- A pigment category paired with chromate-transport terms scored 0.67.

Recall on subtle contradictions is therefore limited. A missing note does not
certify agreement.

The spot check drew a seeded, stratified sample of 34 loci: 12 fallback, 6
contradiction, and 16 other. The sample and its draw thresholds are pinned in
`spot-check.json`. Both sheets show GO terms and annotations only.
`--spot-check-replay` reproduces the reviewed locus list exactly from the
recorded seed and thresholds and fails if it cannot; `--spot-check-sheet` draws
a fresh sample at the current thresholds, and `--seed` gives it a new seed.
Because the core threshold moved from 0.8 to 0.9 after the review, a fresh
draw at the default seed is not the reviewed sample. The reviewer was the
implementing agent, not an independent biologist. The reviewer had already
seen the top-ranked contradiction list when choosing thresholds, so five
contradiction rows were not blind to their rank.

| Spot check at published thresholds | Agreement |
| --- | --- |
| Core context | 32 of 34 |
| Contradiction | 34 of 34 |

Both core disagreements are conservative under-calls:

- `M744_RS03775`: S-adenosylmethionine synthesis, P(core) 0.87.
- `M744_RS01095`: transsulfuration, P(core) 0.76.

This is software validation, not biological ground truth. A priority locus that
relies on the GO tier still needs lab review.

## Display and export contract

The candidate detail panel states the tier and its rank among the four. For a
GO-tier or unknown locus it adds the GO wording, which is dashed and set apart
from the PCC badge. Every discrepancy is listed as its own note, and the panel
states that neither source is preferred. The GO tier and its notes render and
export in every view: the legend's colour-source checkboxes govern function
category colour and legend counts only and never blank evidence.

The browser loader and `tools/validate_contract.py` each hold the thresholds
above as their own constants. Both refuse a file whose policy thresholds
differ, whose context label disagrees with its probability, whose judged
discrepancy falls below the threshold, or whose PCC-call note is present or
absent against the rule. A supplied label is never trusted.

The CSV adds four columns: `essentialityEvidenceTier`, `goIeaEssentialityContext`,
`goIeaCoreProcessProbability`, and `annotationDiscrepancies`, which joins notes
with ` | `. The manifest carries each gene's full record, plus the dataset's
attribution, judgment, policy, and counts, and a caveat.

## Attribution and change policy

GO data are © 1999–2026 Gene Ontology Consortium under CC BY 4.0. The artifact
repeats that attribution and points to `data/annotation/PROVENANCE.md`. The
build fails if that notice disappears.

Changing a threshold needs no inference: edit the constant, rebuild, and
re-read this evidence. Changing the rubric, GO release, products, or reviewed
categories changes request hashes. `--check` then fails until
`TYPESAFE_API_KEY=… python3 tools/build_go_iea_essentiality.py --judge`
re-pins the affected requests, and those changes need a fresh evaluation and
spot check. Never call the API from the browser or from tests.
