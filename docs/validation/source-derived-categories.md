# Source-derived function categories

`site/data/source-derived-categories-v1.json` gives every plotted UTEX 2973 CDS
a function category judged from each non-reviewed annotation source: the joined
PCC 7942 RefSeq product name, and the locus's GO IEA terms. Both use the lab's
eleven-label vocabulary from `site/data/function-categories-v1.json`. They are
computational judgments under explicit evidence labels. They never enter the
reviewed table, never change its 13 rows, and never colour a point without
their label.

```sh
python3 tools/build_source_derived_categories.py --check   # offline; CI runs this
python3 tools/build_source_derived_categories.py --spot-check-replay   # the reviewed sheet, exactly
python3 tools/build_source_derived_categories.py --spot-check-sheet --seed N   # a fresh draw
python3 -m pytest -q tests/test_source_derived_categories.py
node --test tests/js/source-derived-categories.test.mjs tests/js/annotation-source.test.mjs \
  tests/js/url-state.test.mjs tests/js/export-manifest.test.mjs tests/js/legend.test.mjs
```

**Status: awaiting the owner's decision.** The layer is built, labelled, and
gated, but the lab has not accepted its rubric or threshold. The row in
[AAA-biological-decisions-to-review.md](AAA-biological-decisions-to-review.md)
records what to accept or reject.

## Colour resolution

With the annotation-source toggles, a CDS's colour is resolved in this order:

1. **Reviewed.** When UTEX 2973 is on and the locus has a lab-reviewed row,
   that row is the colour, including the one row reviewed as unknown. Two
   reviewed ids use the multiple-functions bucket. Evidence label `reviewed`.
2. **Derived.** Otherwise each enabled derived source contributes its assigned
   category, if any. One source, or two that agree, colours the point with the
   labels `pcc-7942-derived` and/or `go-iea-derived`.
3. **Disagreement.** Two enabled derived sources that assign different
   categories send the locus to the multiple-functions bucket; the detail panel
   and export name each source's category.
4. **Unknown.** No enabled source assigns anything.

UTEX 2973 alone is exactly the previous reviewed-only view. Every toggle off
leaves every CDS unknown and every annotation field blank.

Derived colour uses a hollow marker: a white disc with the category colour as
ring and centre dot, at the same area as a reviewed filled circle. The legend
carries one row per marker, counts each category under the enabled sources,
states in its title which sources are counted, and summarises how many points
are coloured by review, by each derived source, by both, or by neither.

## Blinded judgments

TypeSafe `jev-1.13.0` answers one Choice per source and locus. The frozen
rubric in `data/audits/source-derived-categories/rubric.json` defines the
eleven options with an `includes` list for each and a shared evidence policy:
judge only the text in the state, choose `unknown-or-unclassified` for
hypothetical, domain, family, DUF, or generic-term names, and choose
`other-characterized` only for a specific function outside the nine named
categories.

**GO IEA request.** The state holds only the GO terms, each with aspect,
relation, and term name. The instruction is:

> Using only the Gene Ontology terms in `go_annotations`, choose the one broad
> function category that best describes this protein from a photosynthetic
> cyanobacterium.

**PCC 7942 request.** The state holds only the joined PCC 7942 product name.
The instruction is the same with `pcc_7942_refseq_product`. No pinned PCC 7942
GAF is admitted, so PCC GO terms are not judged.

No request contains a locus tag, gene symbol, UTEX product, reviewed category,
essentiality status, or the other source's annotation; `pinned_results` rejects
any state that does. Each judgment is therefore independent of the reviewed
table and of the other source it is later compared with.

On 2026-09-22 the 63 evaluation cases and then 4,126 requests were run: 2,542
PCC 7942 products at accepted joins and 1,584 GO-annotated loci, for about
10.27 million input tokens.

## Assignment rule and threshold

A source assigns its most likely category when that category is not
`unknown-or-unclassified` and its probability is at least the threshold.

| Policy | Threshold |
| --- | --- |
| Derived category assigned | P(most likely) ≥ 0.8 |

The threshold was drafted at 0.6 in the predeclared evaluation set and raised
to 0.8 from the cross-source calibration below, before the spot check was
drawn, so the spot check is an independent estimate at the published value.

**Cross-source calibration.** Both sources were judged blind to each other, so
where both name a specific category their agreement is real signal about a
probability band. The table relates each source's P(most likely) to agreement
with the other source's assignment at 0.8, over the 1,514 loci with both
judgments.

| P(most likely) | PCC 7942 loci | Agree with GO | GO IEA loci | Agree with PCC |
| --- | --- | --- | --- | --- |
| < 0.4 | 1 | 1.00 | 4 | 0.50 |
| 0.4–0.6 | 28 | 0.68 | 17 | 0.59 |
| 0.6–0.8 | 61 | 0.80 | 37 | 0.76 |
| 0.8–0.9 | 62 | 0.94 | 38 | 0.95 |
| 0.9–0.95 | 80 | 0.96 | 45 | 0.93 |
| ≥ 0.95 | 616 | 0.99 | 675 | 0.99 |

Below 0.8 roughly one assignment in five would disagree with the other source;
at or above 0.8 fewer than one in ten. Raising the threshold from 0.6 to 0.8
removed 137 PCC and 109 GO assignments.

**Reviewed loci.** The 13 reviewed rows were never shown to Jev. Every judged
source agrees with the reviewed category on all 12 classified rows (10 PCC,
9 GO judgments, all at P ≥ 0.95), and the row reviewed as unknown, a
hypothetical protein, was judged unknown by PCC 7942 at 1.00.

**Consequence.** A wrong derived colour publishes a false category on the map
and in the export; a missed one leaves the locus unknown, which is today's
state. The hollow marker and evidence label limit the first harm, so the
threshold was set where cross-source agreement first exceeds 0.9 rather than
at the 0.95 band, which would drop a further 205 assignments.

## Published counts

| Source | Judged | Assigned at 0.8 | Most likely unknown | Below threshold |
| --- | --- | --- | --- | --- |
| PCC 7942 product | 2,542 | 1,093 | 1,226 | 223 |
| GO IEA terms | 1,584 | 1,028 | 363 | 193 |

Where both sources assign a category (758 loci) they agree on 745 and disagree
on 13.

| Category | PCC 7942 | GO IEA | All sources on |
| --- | --- | --- | --- |
| Photosynthetic light reactions | 80 | 51 | 88 |
| Carbon and nutrient metabolism | 211 | 210 | 282 |
| ATP production and respiration | 51 | 19 | 56 |
| Pigment and cofactor biosynthesis | 109 | 111 | 133 |
| Translation and protein maintenance | 144 | 140 | 168 |
| DNA and RNA processing | 101 | 107 | 122 |
| Transport and envelope | 214 | 227 | 276 |
| Signaling and circadian regulation | 96 | 87 | 118 |
| Stress and repair | 47 | 39 | 56 |
| Other characterized | 40 | 37 | 52 |
| Multiple functions | 0 | 0 | 13 |
| Unknown or unclassified | 1,449 | 556 | 1,351 |

With all sources on, 13 loci are coloured by review, 332 by PCC 7942 alone,
268 by GO IEA alone, 752 by both in agreement, 13 by disagreement, and 1,350
by neither. Legend counts under every other toggle combination are pinned in
`summary.json` under `legendByToggle`, and the browser test proves the
page resolves the same numbers.

The 13 disagreements are all rubric-boundary cases rather than nonsense, for
example RbfA (translation by product, rRNA processing by GO term), NdhS
(respiration by product, photosynthetic electron transport by GO term), alanine
racemase (amino acid metabolism by product, peptidoglycan biosynthesis by GO
term), and the known ferrochelatase locus whose PCC product is still
"chlorophyll a/b-binding protein".

## Evaluation and blinded spot check

The predeclared evaluation set was committed before inference in `ece02c3`. It
has 31 GO cases and 32 PCC cases on real loci, three per category where the
release offered them, plus no-function controls.

| Check | Result |
| --- | --- |
| GO IEA exact choice | 31 of 31 |
| PCC 7942 exact choice | 31 of 32 |
| Wrong category assigned at 0.8 | 0 of 63 |
| Assigned exactly as labelled at 0.8 | 59 of 63 |

The PCC miss is `BrnT family toxin`, judged unknown at 0.55 because the rubric
treats family names as stating no function; it is a conservative under-call.
The four label-correct cases that fell below the threshold are RecA (0.63,
repair versus DNA processing), PilT (0.64), an FtsI-family transpeptidase
(0.76), and the same toxin. None publishes a wrong colour.

The spot check drew a seeded sample of 34 loci at the published threshold: 10
where the sources disagree, 8 where they agree, 8 with one assigning source,
and 8 judged without assignment. The sheet shows product names and GO terms
only. The reviewer labelled each source separately before joining. The
reviewer was the implementing agent, not a biologist, and had printed 25
disagreeing loci with their answers while choosing the threshold; seven sample
rows were in that list or already known from the GO IEA audit, and
`spot-check.json` names them.

| Spot check at 0.8 | Agreement |
| --- | --- |
| GO IEA assignment | 26 of 28 |
| PCC 7942 assignment | 24 of 34 |
| PCC 7942 most likely category | 28 of 34 |

Both GO disagreements are the transhydrogenase locus (reviewer: respiration;
Jev below threshold) and GatB (reviewer: unknown for an enzyme-class term; Jev:
carbon metabolism at 0.88). Of the ten PCC disagreements, seven are
conservative: Jev assigned nothing where the reviewer named a category (two
below threshold at 0.41 and 0.47, three family-named enzymes read as unknown,
one at 0.79, one flavodoxin at 0.60). Three are real category errors at
0.80–0.84: two amino-acid-named enzymes on cofactor pathways, PanB and
L-aspartate oxidase, were read as carbon metabolism rather than cofactor
biosynthesis, and `class II glutamine amidotransferase` was read as carbon
metabolism where the reviewer saw no stated process.

**Known failure mode.** A product name that reads as amino acid or sugar
chemistry but sits on a cofactor or envelope pathway is classified by its
chemistry. The GO source usually carries the pathway term and disagrees, which
sends such loci to the multiple-functions bucket rather than a wrong single
colour; with PCC 7942 alone they colour as carbon metabolism.

This is software validation, not biological ground truth. A locus whose colour
rests on a derived source needs lab review before anyone relies on it.

## Display and export contract

The browser loader and `tools/validate_contract.py` each hold the threshold
and evidence labels as their own constants. Both refuse a file whose
vocabulary differs from the reviewed table, whose PCC judgment is present
without an accepted join or absent with one, whose GO judgment is present
without GO terms or absent with them, or whose assigned category disagrees
with its probability. A supplied category is never trusted. The validator
also recomputes the all-sources legend counts with the resolution rules above
and requires every reviewed row to colour by review.

The detail panel shows the resolved category, its evidence labels, and one
line per enabled source: the reviewed labels, or each derived source's
category with its probability, the joined PCC locus, and, when nothing was
assigned, the most likely category and why it was withheld. Disagreement is
stated in words. The attribution and model are repeated beneath.

The CSV adds five columns: `functionCategoryEvidence`, `pcc7942DerivedCategory`,
`pcc7942DerivedProbability`, `goIeaDerivedCategory`, and
`goIeaDerivedProbability`. `functionCategory` is the resolved bucket under the
enabled sources; with UTEX 2973 off it is blank unless an enabled derived
source judged the locus. The manifest records the enabled sources in
`annotationSource.enabled`, each gene's evidence labels and per-source
judgments, and the dataset's attribution, judgment, policy, and counts.

## Attribution and change policy

GO data are © 1999–2026 Gene Ontology Consortium under CC BY 4.0; the
artifact repeats that notice and points to `data/annotation/PROVENANCE.md`,
and the build fails if the notice disappears. PCC 7942 product names come
from the NCBI RefSeq annotation of GCF_000012525.1; the joins come from
Adomako et al. 2022 Data Set S1 (CC BY 4.0), republishing Rubin et al. 2015,
as admitted in [pcc-essentiality.md](pcc-essentiality.md). Applying a PCC
7942 category to a UTEX 2973 locus is a shared-protein assumption.

| Item | Value |
| --- | --- |
| Model | `jev-1.13.0` requested and returned for 4,126 of 4,126 calls |
| Rubric version / SHA-256 | `2026-09-22.1` / `bb642cb045da1972998c1d54ac7b249d009226c7453bdd48259ced4159808457` |
| Predeclared labels SHA-256 | `37baaf0ba074bd50bc587d3e2ee8210d06836a6c416233b2b01af26675a160f0` |
| Pinned results SHA-256 | `5fda6a69c75527c65861adca2af9f7b03957e28529f14e9183124f880f3bc38e` |
| Spot check SHA-256 | `07c68dfc0795724a17d93700a0fc41287993e9d14f064ac35f1c7c530b69ba8c` |

Changing the threshold needs no inference: edit the constant in the build
tool, the browser module, and the validator, rebuild, and re-read this
evidence. Changing the rubric, the vocabulary, the GO release, the PCC
products, or the joins changes request hashes; `--check` then fails until
`TYPESAFE_API_KEY=… python3 tools/build_source_derived_categories.py --judge`
re-pins the affected requests, and those changes need a fresh evaluation and
spot check. Never call the API from the browser or from tests.
