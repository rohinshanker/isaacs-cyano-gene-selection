# Biological questions for the Isaacs lab

This site is an interactive map of the coding genome of *Synechococcus elongatus*
UTEX 2973, built to help choose which genes to target for genome recoding. It lets
you filter the 2,715 protein-coding genes screened for recoding down to the ones
worth a second look, see where each one sits in codon-usage and recoding-risk
space, and build a shortlist of candidates to compare side by side before
designing a construct. You can try it yourself at
[rohinshanker.github.io/isaacs-cyano-gene-selection](https://rohinshanker.github.io/isaacs-cyano-gene-selection/).

This document collects the open lab-review questions, with enough background that
you can answer without having seen the tool before.

**How to answer.** Each item ends with a "Reviewer and date" line and one
"Decision" line per decision it needs; fill those in, or reply by item id. A judgement with its basis is the most useful
answer, but "don't know," "leave as is for now," and answering only the items you
have an opinion on are all genuinely useful too — you do not need to answer
everything, and you do not need any code or repository access. Each answer is
recorded with your name, the date, the decision and its basis.

**If nobody answers.** Nothing here blocks the site from being used as it is
currently labelled. An unanswered item simply means the site keeps its present,
clearly captioned behaviour until someone weighs in.

## Where to start

Four items have either waited longest or would unblock the most downstream work:
**12** (a colour layer awaiting a yes/no since 2026-09-22), **11** (the owner's
2026-09-22 choice of independent layers remains open for lab review), **8** (which
placement of a start site a construct boundary should trust — the kind of answer
that affects real construct design), and **J10** (the 32 escalated dataset pairs:
review the owner's entries and their qualifications, including "maybe" at pair 7
and blank entries at pairs 8, 11 and 30). Everything else is ordered by theme.

## Glossary

A few terms the items below use the way this project uses them, not necessarily
the way you'd expect from the literature.

- **Recoding scheme / panel.** A *scheme* is a codon-to-codon substitution map
  (for example, reassigning the amber stop codon). A *panel* is the shortlist of
  6–10 genes chosen, under one or more schemes, for an actual recoding experiment.
- **UTEX 2973 and its sister strains.** UTEX 2973 is the strain this site is built
  on. Four other *S. elongatus*-type strains (PCC 6301, PCC 6311, PCC 7942, PCC
  7943) are close enough to sometimes stand in for a missing UTEX 2973
  measurement; a fifth, UTEX 3055, is admitted too but is more diverged and has
  real gene-content differences. A value read from one of these and mapped onto a
  UTEX 2973 gene is called **borrowed** or **transferred** evidence; the site
  always says which strain it came from and by which mapping route, and never
  shows it as if it were a UTEX 2973 measurement.
- **Admitting a source / a tier.** A dataset is **admitted** once its licence,
  identifiers, and strain mapping have been checked and it is allowed to display
  on the site at all. Admitted strains sit in two **tiers**: the four close
  strains, and UTEX 3055 as a more divergent, separately handled tier.
- **A layer.** One selectable dataset or evidence source, shown on its own rather
  than merged with another. Two datasets become one layer only on a recorded human
  judgement that they are measuring comparable conditions (see "condition
  comparability" below); until then, each stays its own layer, and any number of
  layers can be shown together.
- **CAI reference set.** The Codon Adaptation Index score for a gene is calculated
  against a fixed list of 71 genes assumed to be highly expressed (mostly
  ribosomal/housekeeping genes). It is a usage convention, not a measurement of
  expression.
- **tAI.** A second codon-usage score, calculated from how many copies of each
  decoding tRNA gene the genome carries — not from measured tRNA abundance or
  charging.
- **TSS and TIS.** *TSS* means transcription start site, where transcription
  begins; *TIS* means translation initiation site, where translation begins. The
  project keeps them strictly separate.
- **The two Tan 2018 start-site layers.** The site carries two layers derived from
  Tan et al. 2018: the published start-site rows from the study's Table S1, and a
  per-gene initiation score derived here by summing mean counts over a separate,
  fixed set of start-site features. Their gene-association rules and gene
  coverage differ, and neither is gene-body transcript abundance.
- **GO IEA.** Gene Ontology annotations inferred automatically rather than
  curated from an experiment. The site labels them as computational suggestions.
- **Source-derived function-category layer.** An automatically generated "what
  kind of gene is this" label, produced by an AI classification model reading
  product names and GO terms from other sources, as distinct from the much smaller
  set of categories a person has actually reviewed and approved.
- **Condition comparability / a "pair."** Two published datasets are a candidate
  "pair" for comparison when they measure the same kind of thing (for example,
  both are transcriptomics). They only become comparable — eligible to share a
  layer — if a person judges their growth conditions close enough, informed by
  condition metadata and agreement statistics planned for the dataset comparison
  feature.
- **Native codon-space PCA.** A fixed scatter-plot projection of each gene's codon
  usage pattern (not its expression), computed once from the genome and never
  recomputed when you change filters.

---

## Function and pathway annotation

**Background.** The site already shows separately labelled computational function
categories derived from PCC 7942 product names and GO terms, alongside a much
smaller set of categories a person has reviewed. BioCyc pathway, operon, and
regulatory layers are proposals; no BioCyc data has been admitted or displayed.

**12. "Accept or reject the source-derived category layer, its rubric, and its 0.8
threshold."**

- Why it matters: this layer would colour and let you filter by function for far
  more genes than the handful reviewed by a person — useful for triage, but only
  if its error rate is acceptable for how you'd actually use it.
- Options: accept the layer as built; accept it but ask for a different confidence
  threshold than 0.8; reject it, which means removing the derived layer; or ask
  for a properly blinded accuracy check first.
- What's known and not known: an AI classification model assigned a function
  category from borrowed PCC 7942 product names (1,093 of 2,542 mappable genes)
  and separately from computational GO terms (1,028 of 1,584 genes); where both
  methods assign a category they agree on 745 of 758 genes. There are 13 reviewed
  rows: 12 classified genes and one explicit unknown. The agent spot check
  deliberately oversampled disagreements; seven rows had already been seen with
  their answers. The assigned cases contained one GO error in 22 and three PCC
  errors in 22, concentrated in amino-acid-named cofactor enzymes. This is not a
  population error estimate, and 0.8 remains a provisional agreement/coverage
  threshold pending a fresh blinded holdout. The reviewed table is unchanged; its
  categories take precedence when UTEX 2973 is enabled. See
  [the full method and numbers](source-derived-categories.md).
- Useful expertise: a gene-function specialist.
- Reviewer and date:
- Decision (accept as built, change the threshold, reject, or blinded check first):
- Decision (threshold, if changed from 0.8):

**5. "Which functional claims are safe to use for priority genes, especially when
based on homologs or computational GO?"**

- Why it matters: a wrong functional claim could misdirect which genes you treat
  as safe to recode or avoid.
- Options: this is reviewed case by case rather than decided as a rule; name the
  priority genes you want checked and the basis (tested allele, homolog, or
  computational GO) will be surfaced for each.
- What's known and not known: three UTEX genes (`atpA`, `ppnK`, `rpaA`) have
  actual tested-allele phenotype data from Ungerer et al. 2018 and are shown
  first. The site's GO terms are all GO IEA, labelled as suggestions, and never
  used to assign a reviewed function category. See
  [protein evidence](protein-evidence.md) and
  [the function-category contract](function-categories.md).
- Useful expertise: a gene-function specialist.
- Reviewer and date:
- Decision (priority genes to check, and any claim to retract):

**Q4. "Is a clearly labelled predicted pathway and operon layer for UTEX 2973
wanted?"**

- Why it matters: BioCyc, a collection of pathway/genome databases, offers UTEX
  2973 pathway and operon predictions the site's genome annotation does not have —
  but they are predictions, generated on an older annotation of the same genome,
  not measurements.
- Options: build the layer with explicit "predicted" labelling; decline it as not
  worth the added complexity for a prediction rather than a measurement.
- What's known and not known: BioCyc version 30.0 serves UTEX 2973 as an
  uncurated database generated in 2020, with 1,969 computationally predicted
  transcription units. The download page says data-file access requires a licence
  and a paid subscription. Authenticated download has not been tested, and
  artifact-specific reuse and redistribution permission remains unresolved. See
  [the UTEX 2973 pathway-database assessment](../notes/tickets/O_biocyc-utex-2973-data__20260930.md).
- Reviewer and date:
- Decision (build the predicted layer, or decline):

**Q5. "Is curated PCC 7942 pathway and regulatory content wanted as a transferred
layer?"**

- Why it matters: PCC 7942's BioCyc database is more carefully curated than UTEX
  2973's own, but it describes a different (if closely related) strain.
- Options: bring it in as an explicitly cross-strain layer, the same way borrowed
  PCC 7942 essentiality already works; leave it out.
- What's known and not known: PCC 7942's is BioCyc's one "Curated"-tier database
  among the six strains checked; which exact PCC 7942 genome assembly it is built
  on has not been determined. The download page says data-file access requires a
  licence and a paid subscription. Authenticated download has not been tested, and
  artifact-specific reuse and redistribution permission remains unresolved. See
  [the PCC 7942 pathway-database assessment](../notes/tickets/O_biocyc-pcc-7942-data__20260930.md).
- Reviewer and date:
- Decision (bring in the curated PCC 7942 layer, or leave it out):

**Q6. "Is curated *E. coli* context on already-named loci worth a display layer, or
export only?"**

- Why it matters: *E. coli* is a far more distant comparison than any admitted
  sister strain, so where it sits in the project's evidence order decides whether
  its context is worth showing at all.
- Options: show it as a visible layer on genes that already have a name from
  another source; keep it available only in exports rather than on-screen; skip it.
- What's known and not known: when quality and biological relevance are otherwise
  comparable, conserved bacterial-model evidence follows sister-strain and broader
  cyanobacterial evidence and precedes sequence-derived proxies. The returned table
  identifies 879 UTEX loci sharing a KEGG orthology group with *E. coli* K-12; it
  is not an admitted locus join. Among the currently hypothetical products, 391
  have neither GO nor KEGG orthology evidence in the annotation the site uses, and
  this table does not supply names for them. See
  [the ortholog table and its limits](../notes/tickets/O_biocyc-utex-2973-data__20260930.md)
  and [the cross-organism evidence contract](data-contract.md#evidence-coverage-and-cross-organism-transfer).
- Reviewer and date:
- Decision (visible layer, export only, or skip):

---

## Where Tan 2018 transcription-start evidence is placed

**Background.** Tan et al. 2018 is the one native UTEX 2973 transcription-start
dataset the site has, measured under control, dark, high-light, and
high-temperature conditions with two biological replicates per condition. It is
shown two ways: as individual start-site marks in the per-gene viewer, and as
ticks along the whole-chromosome view. Both start from the same published data but
are placed differently, which is the subject of two of the items below.

**8. "Can Tan 2018 start sites support a proposed regulatory interpretation or
construct boundary?"**

- Why it matters: if you use a Tan 2018 start-site position to set a construct
  boundary, which of two different placements you use could matter, and in some
  cases changes whether the position falls inside or outside the gene.
- Options: use the distance-from-start-codon placement the gene viewer shows; use
  the absolute chromosome coordinate the chromosome view shows; treat the two as
  equally unreliable for this purpose and look at the raw evidence case by case.
- What's known and not known: of 2,475 published gene-associated start-site rows,
  2,432 map to 1,789 current genes. The gene viewer applies the published start
  distance to the current gene start; the chromosome view uses the published
  absolute coordinate. For 236 mapped rows over 178 genes these differ by 3–198 nt
  (median 34.5 nt); 15 published coordinates fall inside the current coding
  sequence. Both views will label the divergence wherever it occurs. These counts
  measure initiation, not abundance; coordinate proximity alone does not establish
  regulation. Locus review must also consider the reported high-light duration
  discrepancy and source-table conflicts. See
  [the Tan 2018 measurement scope and limits](../../data/expression/TAN2018_TSS_PROVENANCE.md#what-it-measures-and-what-it-does-not).
- Useful expertise: a transcriptomics or regulatory-genomics reviewer.
- Reviewer and date:
- Decision (which placement a construct boundary trusts: the published start distance or the published coordinate):
- Decision (whether a start site alone supports a regulatory interpretation):

**11. "How should the two Tan 2018 TSS layers reconcile their locus sets?"**
*Decided 2026-09-22 by the repository owner, still open for your review:* keep
them as two independent layers rather than merging them.

- Why it matters: the two Tan 2018 artifacts don't cover quite the same set of
  genes, so merging them one way or another changes what counts as "no evidence"
  for a given gene.
- Options (the three considered): intersect the two lists, keeping only the 1,317
  genes both cover, without imputation; keep the union (2,199 genes), filling each
  layer's gaps with a labelled qualitative fallback from the other; or keep them
  fully independent, as currently shipped, each with its own 1,789/1,727-gene
  coverage and the reason for every gap shown.
- What's known and not known: the owner chose independent layers because the two
  artifacts use different association rules: intersection discards evidence for
  882 loci, while qualitative fallback places two derivations under one metric.
  None of the three options requires inventing a numeric value. A from-scratch
  rebuild that made the two layers coincide by construction would be a different,
  not-yet-built option. See
  [the exact mismatch and its reasoning](../../data/expression/TAN2018_TSS_PROVENANCE.md#exact-layer-mismatch).
- Useful expertise: a transcriptomics or regulatory-genomics reviewer.

**Shared background for R1, R2, R5 and R6.** The chromosome view's controls decide
what regulatory evidence you can see and switch on or off at a glance, versus what
stays buried in a detail view. The per-gene view shows 2,432 mapped
gene-associated TSS rows. A separate Regulatory sites tab already holds antisense,
internal, and orphan/novel Tan sites. Other proposed site types need admitted
data. See
[the regulatory-site layer questions](../notes/tickets/O_regulatory-site-viewer-layers__20260930.md)
and [the non-gene-linked Tan sites](../../data/expression/TAN2018_TSS_PROVENANCE.md#non-gtss-regulatory-evidence).
- Reviewer and date:
- Decision (keep independent layers, or reconcile, and how):

**R1. "Which distinct toggle types are wanted initially: TSS, TIS, TTS, promoters,
RBS, binding sites, or broader categories?"**

- Why it matters: this sets which kind of regulatory evidence the project pursues
  and displays first.
- Options: start with only transcription start sites, already shipped, and add
  types later as they are admitted; prioritise a different type first — initiation
  sites, termination sites, promoters, ribosome-binding sites, or binding sites;
  or ask for broader categories rather than individual types.
- What's known and not known: only Tan 2018 transcription start sites are
  admitted so far, so this is about priority order for data not yet in hand.
- Reviewer and date:
- Decision (toggle types wanted first):

**R2. "Should chromosome toggles expose Tan antisense, internal, and orphan/novel
sites as separate types, including sites not associated with a plotted gene?"**

- Why it matters: these sites are real measurements already in hand, and whether
  they appear on the chromosome decides if you can see antisense or internal
  initiation near a candidate gene without opening a separate tab.
- Options: expose antisense, internal, and orphan/novel sites as their own
  chromosome toggles; keep them lumped with the gene-associated sites; leave them
  in the separate Regulatory sites tab only.
- What's known and not known: 1,380 antisense, 724 internal, and 229
  orphan/novel Tan sites are extracted and held in the Regulatory sites tab; they
  do not duplicate the gene-associated rows.
- Reviewer and date:
- Decision (antisense, internal and orphan sites as separate types, and sites with no plotted gene):

**R5. "Should you be able to select source, measured versus predicted evidence, and
experimental condition independently of site type?"**

- Why it matters: whether a site is measured or predicted, and under which growth
  condition it was seen, changes how much weight you would give it — which only
  helps if you can isolate those axes while you look.
- Options: give source/dataset, measured-versus-predicted, and experimental
  condition their own independent controls; fold them into the site-type controls;
  show them only as labels in a detail view.
- What's known and not known: the Tan sites carry their source condition, so the
  condition axis has real values today; measured-versus-predicted only becomes a
  distinction once predicted site types are admitted.
- Reviewer and date:
- Decision (source, measured-versus-predicted and condition selectable independently of site type):

**R6. "How should overlapping sites, shared-gene associations, uncertain intervals,
and gene-relative evidence without a chromosome position be presented?"**

- Why it matters: several Tan sites can sit within a few nucleotides of each other
  or be associated with the same gene, and some evidence is positioned only
  relative to a gene — how that is drawn decides whether you read the density and
  the uncertainty correctly.
- Options: name which of these cases need their own visual treatment, and what
  each should show: overlapping sites, several sites sharing one gene, intervals
  with real positional uncertainty, and evidence with no chromosome position at
  all.
- What's known and not known: the overlap case is already real, not hypothetical —
  at one gene the closest marks sit nearer together than the marks are wide, so
  they merge into a cluster that is no longer separately readable, though every
  site is still drawn and individually labelled. No treatment for overlap,
  interval uncertainty, or position-free evidence has been designed; this answer
  is what a design waits on.
- Reviewer and date:
- Decision (overlapping sites):
- Decision (shared-gene associations):
- Decision (uncertain intervals):
- Decision (gene-relative evidence with no chromosome position):

**C1. "Which regulatory-site types should the recoding metric consider first?"**

- Why it matters: a proposed colour option would describe regulatory-site changes
  under recoding — but only for the site types it is told to check.
- Options: promoters, transcription-factor binding sites, terminators,
  ribosome-binding sites, or regulatory RNA elements, in any order or combination.
- What's known and not known: whether "changed" means an edited base, a changed
  motif or prediction, or evidence of altered function remains undecided. This
  item chooses the site types for the initial evidence review; implementation also
  needs admitted data and a metric definition. See
  [the proposed recoding regulatory-site metric](../notes/tickets/O_recoding-regulatory-site-change__20260930.md).
- Reviewer and date:
- Decision (site types the recoding metric considers first):

---

## Comparing datasets across studies

**Background.** The project is building a way to show several published
transcriptomics and proteomics datasets on one gene at once, which first requires
deciding which published datasets are similar enough in their growth conditions to
share a layer, versus be kept apart. The default screen compares six axes:
temperature (within 2 °C and the same standard/elevated regime); light intensity
(within ±25% and on the same side of 400 µmol photons m⁻² s⁻¹); light regime
(spectrum and continuous/diel photoperiod); CO₂ (same regime, and within a factor
of two when elevated); medium; and culture format/growth phase. These are evidence
for a recorded human judgement, not an automatic pooling rule. See
[the full bounds](data-contract.md#condition-comparability).

**J2. "Is GSE50920 (array) comparable with GSE51112 (RNA-seq)?"**

- Why it matters: this is a real candidate pair, and it also tests whether an array
  dataset and an RNA-seq dataset should ever be treated as comparable at all (a
  separate, already-decided rule keeps arrays listed apart by default, with an
  option to include them).
- Options: judge the pair comparable; judge it not comparable; leave it undecided.
- What's known and not known: Markson's supplement gives the flask cultures about
  100 µE of cool fluorescent light, 1% CO₂, and an optical density near 0.3, with
  no temperature reported, so temperature cannot be checked against the default
  screen for this pair. The recorded screen passed the other five axes, including
  OD₇₅₀ 0.3 on both sides; temperature was unresolved. See
  [the recorded pair judgements](../notes/tickets/O_comparability-lab-judgements__20261005.md).
- Reviewer and date:
- Decision (comparable, keep separate, or leave undecided):

**J10. "The 32 escalated pairs, one by one: may each share a layer?"**

- Why it matters: these judgements determine which pairs may share a layer and
  which should remain separate. A pair shares a layer only on a recorded
  affirmative judgement, retaining any conditions on that judgement, under the
  rule in item 14 below.
- Options: for each pair, "may share a layer," "should stay separate," or "don't
  know yet" are all useful answers, and so is disagreeing with a judgement already
  recorded; you don't need to get through all 32 at once.
- What's known and not known: each of the 32 pairs fails one condition axis under
  the default screen: 26 on light intensity and six on CO₂. Eight pass three other
  axes and 24 pass two; the remaining axes are unresolved. Keep "not reported"
  separate from "not retrieved": an unread source may still contain the value.
  Uniform reprocessing can supply agreement statistics; it does not recover
  unrecorded culture conditions. The owner's entries are recorded below. The
  sheet contains 23 affirmative entries, including qualified entries for pairs 9,
  10 and 24; five entries reject the comparison or refer back to a rejection (20
  and 26 to 29), with an explicit 80–90 light qualification in pair 26. Pair 7
  says "maybe"; pairs 8, 11 and 30 are blank. Each entry and its qualifications
  are reproduced under
  [Pair judgements from the review sheet](#pair-judgements-from-the-review-sheet)
  for review. A judgement on the four unsettled pairs, or a disagreement with any
  other entry, is what is asked here. The
  [pair review sheet](../notes/handoff/cyano_escalated_pairs_review_20261005.md)
  places each pair's conditions and source text side by side.
- Useful expertise: a transcriptomics, proteomics, or physiology reviewer, matched
  to each pair's data type.
- Reviewer and date:
- Decision (any pair whose entry changes, by pair number, with the new judgement):

---

## A best-available gene-body expression estimate

**6. "Which sources and transfer model should supply a best-available gene-body
expression estimate?"**

- Why it matters: no admitted dataset measures how much transcript each UTEX 2973
  gene actually carries, so any expression-weighted choice of recoding targets
  currently rests on a proxy rather than a measurement.
- Options: use admitted sister-strain evidence; extend to other organisms under a
  documented transfer model; or retain the present labelled values while more
  evidence is gathered.
- What's known and not known: Tan 2018 measures initiation, not gene-body
  abundance. No replicated genome-wide native abundance matrix is admitted.
  Reprocessing was approved by the owner on 2026-10-05; the sources and transfer
  model remain open. Any combined estimate needs a common scale, locus mapping,
  conditions, uncertainty, and a direct-only view. See
  [the cross-organism evidence contract](data-contract.md#evidence-coverage-and-cross-organism-transfer)
  and [what the Tan data does and does not measure](../../data/expression/TAN2018_TSS_PROVENANCE.md#what-it-measures-and-what-it-does-not).
- Useful expertise: cyanobacterial transcriptomics, comparative genomics, and
  statistics.
- Reviewer and date:
- Decision (sources to supply the estimate):
- Decision (transfer model):

---

## Sister-strain evidence

**Background.** Besides UTEX 2973 itself, the site can borrow evidence from four
closely related *S. elongatus*-type strains and, more cautiously, from the more
diverged UTEX 3055. A borrowed value is always labelled with its source strain and
never presented as a UTEX 2973 measurement. Existing mapping routes differ by
strain: exact shared-protein matches where available, and supported
pangenome-row mappings otherwise; each transferred value must record its route and
ambiguity. See
[the admitted strains and their mapping routes](data-contract.md#sister-strains-admitted-for-utex-2973-data).

**Q1. "Do PCC 6311, PCC 7943 and UTEX 3055 have a comparative use, such as UTEX
3055 as an outgroup for conservation?"**

- Why it matters: the recorded searches found no functional-genomics deposits for
  these three strains, so the only value they can add right now is as a comparison
  point — for example, using how conserved a gene is across them as its own kind
  of evidence.
- Options: yes, keep pursuing these strains for a conservation-style comparative
  use (and say what that use should be); no, their value doesn't justify further
  work until real data exists for them; treat UTEX 3055's greater divergence
  specifically as useful (an outgroup) rather than simply as a gap.
- What's known and not known: the recorded searches found no functional-genomics
  deposit for PCC 6311, PCC 7943, or UTEX 3055; search absence is not evidence
  that no such data exists. See
  [the recorded cross-strain sweep](../notes/tickets/O_cross-strain-data-scan__20260927.md).
- Useful expertise: a comparative-genomics reviewer.
- Reviewer and date:
- Decision (comparative use of PCC 6311 and PCC 7943, if any):
- Decision (UTEX 3055 as a conservation outgroup):

**15. "Is UTEX 3055 close enough for each admitted data type, given its real
gene-content difference?"**

- Why it matters: UTEX 3055 genuinely has genes the closer sister strains don't,
  and vice versa, so a missing UTEX 3055 value at a given UTEX 2973 gene is often
  a real biological difference, not a failed measurement — using it incorrectly
  could make you mistake absence of data for absence of the gene, or the reverse.
- Options: for each future data type, should UTEX 3055's admission stand, require
  extra caveats, or be reconsidered?
- What's known and not known: UTEX 3055 is already admitted, in its own tier, for
  the listed data types. The recorded search currently supplies annotation
  evidence, not a functional-genomics deposit. It carries 303 pangenome CDS rows
  absent from all five close-cluster strains, including UTEX 2973, and 134 UTEX
  2973 CDSs have no UTEX 3055 counterpart. See
  [the admitted data types and the coverage caveat](data-contract.md#sister-strains-admitted-for-utex-2973-data).
- Useful expertise: a comparative-genomics reviewer.
- Reviewer and date:
- Decision (annotation transfer from UTEX 3055):
- Decision (quantitative data types from UTEX 3055):

**7. "Should PCC 7942 evidence influence any panel choice, and under which
cross-strain caveats?"**

- Why it matters: using a different strain's screen to decide a UTEX 2973 gene is
  safe to recode is an assumption layered on top of that strain's own growth
  conditions.
- Options: the site displays labelled PCC 7942 essentiality evidence at admitted
  exact joins. Borrowed PCC 7942 abundance is opt-in; essentiality is not used by
  the panel objective as a fitness or viability prediction. Should either influence
  this panel's biological review, and under what caveats?
- What's known and not known: the PCC 7942 essentiality calls come from a
  transposon screen (Rubin et al. 2015) under that strain's own growth conditions,
  joined to UTEX 2973 only at exact, unambiguous shared-protein matches; a
  published comparison (Ungerer et al. 2018) found similar growth between the two
  strains at one shared light level but different optimal growth overall, and a
  missing or ambiguous essentiality call never means "confirmed non-essential." See
  [the essentiality transfer policy](pcc-essentiality.md).
- Useful expertise: a comparative-genomics or experimental reviewer.
- Reviewer and date:
- Decision (may PCC 7942 evidence influence a panel choice):
- Decision (caveats that must accompany it):

---

## tRNA evidence and translation initiation

**Background.** The genome's 44 annotated tRNA genes have been independently
re-confirmed by rerunning the standard tRNA-detection tool, which also flagged one
additional, lower-confidence candidate. Separately, the project is assessing
whether an existing ribosome-binding-site prediction tool could add anything useful
here.

**3. "Is genomic tRNA copy-number adaptiveness a useful proxy for this panel, and
what evidence would justify a later expression or charging tier?"**

- Why it matters: the site's tAI uses genomic tRNA copy counts as a proxy; whether
  that proxy is useful for this panel is the question, and it matters if you are
  relying on tAI to judge whether a recoded gene will translate well.
- Options: continue treating tRNA gene copy number as a usable proxy, as now;
  flag it as insufficient without real tRNA abundance or charging data; specify
  what data (if any you know of) would let the project build a genuine
  expression- or charging-based tier instead.
- What's known and not known: all 44 annotated tRNA genes are confirmed by an
  independent rerun. This supports computational plausibility, not tRNA abundance,
  charging, or decoding; no such dataset for this organism is currently known to
  the project. See [the tRNA validation](trna-annotation-validation.md).
- Useful expertise: a tRNA/translation specialist.
- Reviewer and date:
- Decision (copy-number adaptiveness as a proxy for this panel):
- Decision (evidence that would justify an expression or charging tier):

**Q3. "For tRNA, are the three dropped candidates and score breakdown wanted, and
does 'how likely' mean the tool score or a calibrated probability?"**

- Why it matters: if a future tRNA-confidence display calls something a
  "likelihood," that word needs to mean a real, checked probability rather than a
  relabelled raw tool score — otherwise it risks reading as more certain than it
  is.
- Options: are the detection-score components and any recoverable rejected
  candidates useful, or is a viewer of the 45 confirmed loci enough? If a score is
  displayed, should it be a raw score, an evidence category, or a calibrated
  probability?
- What's known and not known: the three borderline candidates the original 48-gene
  first pass considered and then dropped cannot currently be identified by name —
  the standard reference database that was checked publishes only the count, 48,
  and nothing in it enumerates the three. Whether a fresh scan would recover them
  is not established. See
  [the tRNA viewer questions](../notes/tickets/O_trna-identification-viewer__20260930.md).
- Useful expertise: a tRNA/translation specialist.
- Reviewer and date:
- Decision (retrieve the three dropped candidates and the score breakdown):
- Decision ("how likely" means the tool score or a calibrated probability):

**Q7. "Port RBS Calculator v1.0, or assess a current version or another model?"**

- Why it matters: this tool predicts translation-initiation strength from
  sequence, which could help judge whether a recoded start region still translates
  well — but the available version is old, requires a software port, and uses an
  *E. coli* anti-Shine-Dalgarno default.
- Options: invest the effort to port the old version 1.0; look instead at whatever
  the method's current version is; consider a different initiation-prediction
  model altogether; decide the evidence case isn't strong enough yet to pursue any
  of them.
- What's known and not known: the recorded PubMed search found one cyanobacterial
  application, PMID 31908923 in *Synechocystis* PCC 6803, and none for
  *Synechococcus* or UTEX 2973. This is pre-grounding; validation applicable to
  UTEX 2973 remains unresolved. See
  [the RBS Calculator assessment](../notes/tickets/O_rbs-calculator-gene-visualizer__20260930.md).
- Reviewer and date:
- Decision (port v1.0, assess the current version, or another model):

---

## CAI reference set

**2. "Should any of the ten audited CAI-reference candidates enter a revised
reference set, and what independent evidence defines a suitable reference?"**

- Why it matters: the CAI score used throughout the site is calculated against a
  fixed list of 71 presumed highly-expressed genes; changing that list requires
  recomputing CAI weights, gene scores, dependent proxy ranks, and downstream
  panels.
- Options: keep the 71-gene list as is; add some or all of ten specific candidate
  genes an automated semantic audit flagged as plausible additions; name a
  different standard entirely (for example, built from real expression data once
  it exists).
- What's known and not known: the ten candidates were flagged by an automated
  check for plausible product-name agreement with the existing list, not by any
  independent expression measurement, so product-name agreement is the only
  evidence behind them so far. See
  [the audit and exact 71 loci](cai-reference-set.md).
- Useful expertise: a translation/physiology reviewer.
- Reviewer and date:
- Decision (candidates to admit to the reference set, if any):
- Decision (independent evidence that defines a suitable reference):

---

## Protein detection evidence

**4. "What evidence would justify labelling a UTEX 2973 protein as directly
detected?"**

- Why it matters: right now no UTEX 2973 gene can be labelled as having its
  protein directly detected (as opposed to annotated from sequence), which could
  matter if you want to prioritise genes with confirmed translation.
- Options: pursue admitting a specific newly identified proteomics dataset toward
  building a real per-locus detected list; decide the effort isn't worth it yet;
  name a different, stronger evidentiary bar.
- What's known and not known: every plotted gene already has a matching RefSeq
  protein sequence record, which is annotation, not detection. Direct detection is
  unavailable, not negative. A UTEX 2973 native proteomics deposit, PXD014590, has
  since been found under a fully open CC0 licence over its deposited files and is a
  candidate for a real "directly detected" layer, but no one has yet decided
  whether pursuing its admission is worth the effort, and it is not an admitted
  detection list. See [the protein evidence contract](protein-evidence.md) and
  [candidate proteomics deposit and reuse status](source-ledger.md).
- Useful expertise: a proteomics specialist and source curator.
- Reviewer and date:
- Decision (evidence that justifies "directly detected"):

---

## Codon-usage space and the three PCA plots

**Background.** The native codon-space PCA is fixed. The recoding-risk and
perturbation PCAs recompute for the recoding scheme; filters do not refit their
axes. The chromosome view is a separate view, and retiring a PCA remains an open
decision.

**9. "Does a short gene's native PCA position reflect meaningful codon use for the
proposed experiment?"**

- Why it matters: a short gene naturally has fewer codons to estimate a usage
  pattern from, so its position on this plot may be noisier than a long gene's,
  which matters if you're reading an outlier position as biologically meaningful.
- Options: treat a short gene's position with caution case by case, as now; set an
  explicit minimum length below which a position isn't shown or trusted; something
  else.
- What's known and not known: downsampling shows that limited codon sampling
  contributes to, but does not fully explain, the short-gene shift. A fixed
  below-75-nucleotide flag exists for annotation review; nothing currently plotted
  falls below it. See [the length-sensitivity audit](pca-length-sensitivity.md).
- Useful expertise: a quantitative-genomics reviewer.
- Reviewer and date:
- Decision (how a short gene's PCA position is to be read):

**S4. "Is the native codon-space PCA retired now that the chromosome tab exists,
and do the live risk and perturbation PCAs stay?"**

- Why it matters: the chromosome view can show much of the same per-gene
  codon-usage information along the genome, which raises whether keeping the
  separate fixed plot is still worth its own tab — but retiring a view means also
  retiring its audit trail and documentation.
- Options: retire the fixed native codon-space plot, keeping the two
  scheme-dependent risk and perturbation plots; keep all three; retire something
  else.
- What's known and not known: the chromosome view shipped as an additional tab,
  not a replacement, so retiring the older plot is a distinct, deliberate step
  that has not been taken. See
  [the open scope and retirement questions](../notes/tickets/O_cross-strain-data-scan__20260927.md).
- Reviewer and date:
- Decision (retire the native codon-space PCA):
- Decision (live risk and perturbation PCAs stay):

---

## Rare-codon and folding conventions

**10. "Are the rare-codon and local-folding conventions useful for the planned
perturbation?"**

- Why it matters: both of these are model-based conventions, not measurements, and
  using either to judge whether a specific recoding edit is safe is a bigger claim
  than either was built to support on its own.
- Options: continue using them as supporting, exploratory signals, as now; use
  them more heavily for specific gene-level decisions once there's a concrete
  perturbation in mind; discount them.
- What's known and not known: "rare codon" here means a sense codon whose
  within-amino-acid frequency across the included UTEX 2973 CDSs is below 0.1 — a
  usage-frequency rule, not a measured translation-speed threshold. The folding
  numbers (minimum free energy, before and after recoding) are model outputs from
  a real folding algorithm run locally, not experimentally measured stability. See
  [the folding contract](rna-folding.md) and
  [metric conventions](current-design-answers.md#what-do-rare-codon-cai-and-tai-mean-here).
- Useful expertise: a translation or RNA-structure reviewer.
- Reviewer and date:
- Decision (rare-codon convention):
- Decision (local-folding convention):

---

## The exported panel itself

**1. "For an actual 6–10-gene panel, are the selected loci, gene models, recoding
map, and constraints appropriate for the intended experiment?"**

- Why it matters: the export records a computational design, not a biological
  sign-off, so the named panel needs its own biological review every time one is
  exported for a real experiment.
- Options: this is a standing check asked afresh for each exported panel, not a
  one-time decision; share a specific exported panel whenever you want it
  reviewed.
- What's known and not known: for each exported panel, review the locus
  identities as exported, starts, overlaps, joined CDS segments, terminal stops, `prfB` frameshift,
  substitution map, and experimental constraints. See
  [the panel review checklist](AAA-manual-review-checklist.md#2-review-the-actual-biological-panel).
- Useful expertise: an experimental lead and a genome-annotation reviewer.
- Reviewer and date:
- Decision (for the named panel: loci, gene models, recoding map and constraints):

---

## Who the tool is for

**S3. "Is the audience the recoding-panel workflow or general *S. elongatus*
lookup?"**

- Why it matters: this tool is currently built and scoped around a specific
  workflow — filtering, scoring, and shortlisting the genes screened for recoding
  — rather than as a general-purpose UTEX 2973 gene browser; broadening that would
  mean adding genes and features (RNAs, pseudogenes, and so on) that sit outside
  today's screened set.
- Options: keep the current recoding-panel scope; broaden it to general
  *S. elongatus* gene lookup, understanding that this changes the underlying data
  the site loads, not just the display.
- What's known and not known: broadening scope is recorded as a schema change to
  the data the site loads. See
  [the open scope question](../notes/tickets/O_cross-strain-data-scan__20260927.md).
- Reviewer and date:
- Decision (recoding-panel workflow, or general lookup):

---

## Already decided: tell us if you disagree

These are biological or interpretive calls the project has already made. Unless a
row says otherwise, each was decided by the repository owner on 2026-10-05. They
are recorded here so labmates can object or request review. No response leaves the
recorded decision unchanged; it does not record a labmate's agreement.

| Id | Decision | Basis |
| --- | --- | --- |
| J1 | GSE18902, GSE50908, GSE50919 and GSE52486 are treated as sharing one light-spectrum class, so all six pairs among those four series pass the condition screen. | Markson 2013's supplement says its turbidostat cultures followed Vijayan et al. 2009. Vijayan reports approximately 25 µmol photons m⁻² s⁻¹ white light, 1% CO₂, 30 °C and OD₇₅₀ 0.15. Neither names the lamp; the owner judged the spectrum class to agree. |
| J3 | An OD₇₃₀ or A₇₃₀ reading is accepted as equivalent to the OD₇₅₀ the condition screen otherwise asks for. | The two wavelengths are considered close enough in practice for this purpose. |
| J4 | There is no fixed "narrow miss" boundary (for example, 3 °C or a 1.5× light ratio) for flagging a close-but-failing condition match; the gap itself is shown instead. | The condition scales show the distance on each axis, so the owner allowed a wide review boundary and will revisit it if the groups look wrong. |
| J5 | Microarray and RNA-seq datasets are treated as two groups by default (arrays listed apart), with an option to view them combined under transcriptomics. | An array measures only the targets its designers chose, not the whole transcriptome, so it is a narrower measurement than RNA-seq even when both are "transcriptomics." |
| J6 | Two datasets are judged comparable using fold-change agreement (where each has its own control) and level correlation against each dataset's own replicate variation; raw distribution shape is used only as a units and sanity check. | In a seven-table PCC 7942 pilot, whole-distribution comparisons reflected study and platform effects. Fold-change correlations recovered two light-decrease contrast pairs from two studies; this result is provisional, with no confidence intervals. |
| J7 | No fixed numerical comparability threshold is set; a person judges each dataset pair individually using the condition screen and statistics as evidence, not a pass/fail rule. | No published, validated numerical equivalence threshold for these conditions was found in the literature search performed for this project. |
| J8 | Proceed with uniform reprocessing from raw reads. Selection of sources and the expression-transfer model remains open under item 6. | In that pilot, none of 7,812 cross-study sample pairs reached the pooled within-study Spearman replicate bound of 0.939, including the similar-control pairs. |
| J9 | Condition-resolved fitness screening data (a different kind of measurement from gene expression) is admitted as its own, separate data type and its own tab, never mixed onto an expression scale. | This is a clearly distinct biological measurement (gene-knockout fitness under selection, not transcript or protein level), and treating it as such avoids conflating two different kinds of evidence. |
| 13 | The six condition axes described above are used as a default screen and a piece of displayed evidence, not as the sole gate for whether two datasets can be shown together. | These bounds were drawn from documented physiological differences already described for this organism and its relatives, not from a published equivalence study, so treating them as evidence rather than as an automatic rule reflects that they are a starting approximation. |
| 14 | A dataset pair shares a display layer only once a person records that judgement, made from the condition screen and the agreement statistics together; any number of datasets that haven't been judged comparable can still be shown at once as separate, clearly labelled layers. | A pair can fail one condition axis narrowly and still be worth showing together, or pass every axis on paper and still not be comparable biologically — a fixed rule can't capture that, but a visible, attributed per-pair judgement can. |

## Pair judgements from the review sheet

The state of J10. Transcribed into this document on 2026-10-05 from the owner's
[pair review sheet](../notes/handoff/cyano_escalated_pairs_review_20261005.md),
which was generated that day. The sheet's reviewer cells read "rohin, 8/5/26" or
"rohin 8/5/26" for pairs 1 and 2 and "rohin 8/5" for pairs 3 to 8, and are blank
for pairs 9 to 32; those dates have not been reconciled. The owner's words are
reproduced verbatim; the last column is an agent's reading, and the original
words and qualifications govern. "May share" means the pair is not kept apart
for its one narrow miss; most of these pairs still have unreported axes. The row beside each dataset is its row in the
condition table the sheet quotes.

| # | Dataset A | Dataset B | Narrow axis | Owner's entry | Read as |
| --- | --- | --- | --- | --- | --- |
| 1 | GSE18902 (row 21) | GSE254350 (row 37) | co2 | may share layer | may share |
| 2 | GSE225426 (row 31) | GSE59112 (row 55) | light_intensity | may share | may share |
| 3 | GSE254350 (row 37) | GSE50908 (row 46) | co2 | may share | may share |
| 4 | GSE254350 (row 37) | GSE50919 (row 47) | co2 | may share | may share |
| 5 | GSE254350 (row 37) | GSE52486 (row 54) | co2 | may share | may share |
| 6 | PXD005105 (row 59) | PXD074299 (row 78) | light_intensity | may share | may share |
| 7 | PXD030282 (row 72) | PXD062851 (row 77) | light_intensity | maybe - the 75-100 lighting is a bit too distant from 50 lighting as it has changing conditions. note this for future pairs as well, and maybe it can be filed into its own subcategories | undecided; changing-light concern and possible subcategories |
| 8 | PXD030282 (row 74) | PXD062851 (row 77) | light_intensity | — | no entry |
| 9 | GSE103462 (row 3) | GSE254350 (row 37) | light_intensity | mostly fine. | qualified affirmative: mostly fine |
| 10 | GSE103462 (row 3) | GSE327989 (row 40) | light_intensity | fine but see if CO2 conditions can be retrieved. if not, take note | affirmative; retrieve CO₂ conditions or record that they remain unavailable |
| 11 | GSE103462 (row 3) | GSE45762 (row 45) | light_intensity | — | no entry |
| 12 | GSE103463 (row 4) | GSE254350 (row 37) | light_intensity | fine | may share |
| 13 | GSE103463 (row 4) | GSE327989 (row 40) | light_intensity | fine | may share |
| 14 | GSE103463 (row 4) | GSE45762 (row 45) | light_intensity | fine | may share |
| 15 | GSE103644 (row 7) | GSE254350 (row 37) | light_intensity | fine | may share |
| 16 | GSE103644 (row 7) | GSE327989 (row 40) | light_intensity | fine | may share |
| 17 | GSE103644 (row 7) | GSE45762 (row 45) | light_intensity | fine | may share |
| 18 | GSE103704 (row 8) | GSE254350 (row 37) | light_intensity | fine | may share |
| 19 | GSE103704 (row 8) | GSE45762 (row 45) | light_intensity | fine | may share |
| 20 | GSE104203 (row 11) | GSE254350 (row 37) | co2 | no, changing conditions + different may not be comparable | keep separate |
| 21 | GSE104203 (row 12) | GSE254350 (row 37) | co2 | fine | may share |
| 22 | GSE105774 (row 16) | GSE254350 (row 37) | light_intensity | fine | may share |
| 23 | GSE105774 (row 16) | GSE45762 (row 45) | light_intensity | fine | may share |
| 24 | GSE140121 (row 19) | GSE327989 (row 40) | light_intensity | fine, as long as the lights arent changing in one and constant on the other | conditional affirmative: neither side may have changing light while the other is constant |
| 25 | GSE140121 (row 20) | GSE327989 (row 40) | light_intensity | fine | may share |
| 26 | GSE140121 (row 19) | GSE45762 (row 45) | light_intensity | a bit too far, as 120 is too high. if it lies within 80-90 that is fine, but if not that is too different | separate at 120; acceptable if the relevant light lies within 80–90 |
| 27 | GSE140121 (row 20) | GSE45762 (row 45) | light_intensity | once again very close except for light. see previous | refers to pair 26's light qualification |
| 28 | GSE140121 (row 19) | GSE59112 (row 55) | light_intensity | no, see above | no; refers to the preceding light concern |
| 29 | GSE140121 (row 20) | GSE59112 (row 55) | light_intensity | no | keep separate |
| 30 | GSE254350 (row 37) | GSE89999 (row 57) | light_intensity | — | no entry |
| 31 | GSE45762 (row 45) | GSE89999 (row 57) | light_intensity | fine | may share |
| 32 | PXD062851 (row 77) | PXD074299 (row 78) | light_intensity | fine | may share |

**Extrapolated entries, 2026-10-05.** The owner asked that the blank pairs be
settled by extrapolation from the judgements already given on the same studies.
These three are the agent's extrapolations, not the owner's words, and the owner
may overrule any of them:

- Pair 8 (PXD030282 row 74 against PXD062851 row 77): the same two studies and
  the same light values as pair 7, so it takes pair 7's entry: undecided, with
  the changing-light concern.
- Pair 11 (GSE103462 at 40 µE, entrained then constant light, against GSE45762
  at 60 µmol): the same values and regime as pairs 14 and 17, which the owner
  marked "fine": may share.
- Pair 30 (GSE254350 at 30 µmol against GSE89999 at 40 µE): the owner accepted
  GSE89999 against GSE45762 at 60 µmol (pair 31, "fine") and GSE254350 against
  the circadian array series (pairs 1, 3, 4 and 5, "may share"); the light ratio
  here is smaller than in pair 31: may share.

Pair 7 stays undecided; it is the owner's own "maybe".

Rules the owner stated along the way, to apply to later pairs:

- Light at 50 against 75 to 100 µmol is "a bit too distant" when one side has
  changing conditions; such sets may belong in their own subcategory (pair 7).
- A culture under changing light is not comparable with one under constant light
  (pairs 20 and 24).
- For pair 26, against 60 µmol photons m⁻² s⁻¹, 120 is too high but 80 to 90
  would be acceptable; pair 27 refers back to that qualification. Pairs 28 and 29
  reject the 80–120 against 50–55 comparison.
- Pair 10 is fine, but the missing CO₂ condition should be chased, and noted if it
  cannot be found.

For the fuller evidence trail behind any of the decided or open items above —
exact figures, citations, and the reviewer roles suggested for each — see
[the companion evidence document](AAA-biological-decisions-to-review.md).
