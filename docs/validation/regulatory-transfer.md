# Cross-organism regulatory prediction contract

The owner-selected methods are RBS Calculator, iDOG/standalone TransTermHP,
Promoter Calculator, ViennaRNA, STREME, Rfam/Infernal and IntaRNA. FIMO and other
methods appearing in candidate literature are not implicitly selected. The
[method contracts](regulatory-methods.md) distinguish runtime results from
biological evidence and browser admission. RBS access and the newly authorized
iDOG locator investigation retain their own tickets. The iDOG review hold was
released on 2026-10-14; this does not establish a locator in its public code.

Cross-organism transfer supplies exploratory candidates, not established UTEX
regulatory function. Use the method-specific runbooks for executable pilots. Prefer close Synechococcus donors such as PCC 7942
or PCC 6301 when the particular locus and surrounding sequence are conserved;
use other cyanobacteria next and distant bacterial models as weaker priors.
Relatedness alone does not establish conserved regulation. Eukaryotic or phage
parts do not become ordinary cyanobacterial promoters by sequence similarity.

| Method / owning ticket | Concrete rough-prediction route | Limits and smallest useful evaluation |
| --- | --- | --- |
| [RBS Calculator](../notes/tickets/O_rbs-calculator-gene-visualizer__20260930.md) | Once executable code is available, score native UTEX initiation contexts with pinned model/host parameters; use conserved donor start-region alignments as supporting evidence. | PCC 6803 experiments reported poor relative-expression prediction [S1]. Treat outputs as candidate initiation contexts, not measured binding boundaries or reliable rates. Compare rankings with independent translation/reporter evidence where available; RNA abundance alone is not an RBS benchmark. Code access remains open. |
| [iDOG](../notes/tickets/O_idog-promoter-prediction__20260930.md) | Investigate a new promoter locator around iDOG under the owner's 2026-10-14 direction; reused RBS/terminator components retain their own contracts. | Its yeast promoter library and fixed T7 promoter do not supply a native UTEX promoter locator. The review hold is released; source/bytecode gaps and missing locator/model remain distinct. Standalone TransTermHP remains independent; do not call another predictor's output iDOG promoter predictions. |
| Promoter Calculator | Run the pinned E. coli sigma-70 model on native UTEX windows on both strands as an explicitly out-of-domain ranking. Conserved donor promoter regions supply additional candidates, checked against native sequence. | The paper's in-vivo tests use E. coli [S2], not UTEX calibration. Test localization/enrichment near held-out Tan TSSs, separating alternative starts and conditions from independent loci. A TSS is an initiation anchor, not a complete promoter boundary; do not convert raw counts into calibrated promoter strength. The [native gTSS pilot](regulatory-promoter.md#native-gtss-localization-pilot) provides a bounded localization/ranking check; biological calibration and genome-wide specificity remain separate. |
| TransTermHP | Score native UTEX sequence for intrinsic terminator candidates, then compare with uniquely aligned PCC 7942 transcript-end contexts. Cascino 2026 / GSE309256 is a concrete donor-data candidate [S3]. Gale 2021's UTEX-tested terminator parts can support a separate sequence-level check [S4]. | This addresses intrinsic terminators only. PCC 7942 intrinsic features cover a minority of transcript units [S3]; a transcript end need not be a termination site. Report candidate recovery and shuffled-background hits separately from termination efficiency. Gale's reporter-part strengths transfer poorly between hosts [S4]; they are not native genomic coordinates. Tool scores are not calibrated UTEX probabilities. |
| STREME | Discover motifs in TSS-anchored native UTEX sequences and, separately, admitted donor promoter/regulon cohorts; compare them and score motifs against native UTEX sequence. | Use length/composition-matched controls and an independent locus/ortholog-block test set. STREME's final motifs include its internal holdout [S5], so that holdout is not an external generalization test; the [pilot](regulatory-streme.md) keeps its evaluation cohort outside discovery. Its sites output covers the discovery input; new-sequence scanning needs an explicitly chosen, evaluated scanner (FIMO is a candidate, not a newly selected method). Genome-wide repeated words can enrich against shuffles without being TSS-specific; retain blocked native genomic comparisons as well. A motif hit alone does not identify a regulator or establish function. |
| Rfam + Infernal | Search native UTEX sequence with pinned covariance models and their family-specific gathering cutoffs [S6]; prioritize cyanobacterial regulatory families, with Yfr1/RF01116 as one concrete candidate [S7]. | This transfers sequence/structure family models, not donor coordinates. Report homology and family identity, not demonstrated regulatory action. Separate regulatory families from tRNA/rRNA/other RNA classes; retain overlaps/truncation and unmatched regions. Check conserved donor homologues and native transcript evidence, without treating missing expression or missing family hits as negatives. |
| IntaRNA | Identify native UTEX homologues of candidate sRNAs, then predict interactions against native target transcripts. Yfr1 has an IntaRNA precedent in Prochlorococcus MED4 [S8]; Tan reports a UTEX PsrR1 homologue [S9]. Conserved donor seed/target regions are supporting evidence. | Confirm both RNA identities, transcript boundaries and the interacting sequences; gene orthology alone does not transfer a target interaction. Recompute accessibility and interaction energies [S10]; compare with shuffled queries, seed-disrupting controls and held-out interactions where available. The Yfr1 paper used a heterologous reporter assay, not UTEX validation. Energy or complementarity alone is not evidence of regulation. |
| ViennaRNA | Recompute native UTEX local structure/accessibility in candidate intervals, using conserved donor RNA structures as supporting context. RNAplfold explicitly supplies unpaired-region probabilities [S11]. | This is transferable thermodynamic calculation, not a regulatory-site detector by itself. Retain exact sequence/window/temperature settings, examine sensitivity to them and matched backgrounds, and combine with independent family/TSS/terminator evidence. Existing browser folding is not validation of this new annotation use. |

## Transfer and evaluation contract

- GSE309256 and the papers' supplementary site/part tables are candidate inputs.
  Paper-level evidence alone does not admit their tables: exact files, assembly
  identity, source terms and sequence joins require intake before use.
- Distinguish **model transfer** (score native UTEX sequence), **homology-based
  candidate placement** (derive a new UTEX interval from an explicit alignment),
  and **donor-only evidence** (retain donor coordinates). Never relabel a donor
  coordinate or an orthologous protein match as a native regulatory site.
- A proposed placement needs pinned assemblies, strand-aware local alignment,
  conserved flanking context and an unambiguous interval. Preserve source and
  inferred coordinates separately; reject ambiguous/indel-disrupted placements
  or leave them donor-only. This does not change existing coordinate-admission
  rules or authorize a new layer before that contract is implemented.
- Label future results `exploratory prediction`, recording model/training host,
  donor strain/evidence, native sequence identity, mapping basis, parameters,
  raw score/units and known limitations. Model confidence and E-values are not
  calibrated probabilities of regulatory activity in UTEX. Newly computed tags
  retain the existing translucent/lower-priority rendering contract.
- Keep native measurements separate. Missing sites, absent RNA measurements and
  unassayed conditions are unknowns. Shuffled/matched backgrounds estimate a
  null hit rate, not biological false-positive rates against proven negatives.
- Prevent homologues, overlapping regions and repeated condition measurements
  leaking between training/tuning and evaluation. Report coverage, localization
  and ranking checks separately; no invented accuracy threshold or claim of
  comprehensive detection. Donor validation does not establish UTEX validation.
- For future recoding comparisons, recompute the same method on both sequences.
  A changed score or interval is a predicted change, not a demonstrated change in
  regulatory function. Retain method/version and coverage in the denominator.

## Primary-source evidence receipts

Retrieved by `cyano-regulatory-sites` on 2026-10-09. Each short quote below was
matched mechanically to normalized text from the retrieved bytes; SHA-256 hashes
are of those bytes. S3 is the **published 2026 article**, superseding the initially
found 2025 preprint for this assessment. Public Europe PMC XML, official docs/code
and Rfam's JSON response were used; a PMC browser challenge and Rfam docs HTTP 403
were not solved. Official Rfam documentation source was publicly readable.
This is evidence intake for the proposals, not dataset admission or a licence
decision.

| ID / retrieved source | Located quote | Raw SHA-256 |
| --- | --- | --- |
| S1: [Sebesta & Peebles 2020](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6940699/fullTextXML) | Discussion: “The RBS Calculator poorly predicted the relative expression of bisabolene synthase in S. 6803.” | `eed6bc4d8c21b65d6d76e9b906b0fad38b0000ca98647ba60d8bd77d7a776416` |
| S2: [LaFleur et al. 2022](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9440211/fullTextXML) | Results, three in-vivo test datasets (fourth dataset in vitro): “inside E. coli cells” | `b0418e683a6fd23906dc3e8329ef74dd166298aab39c64b54ec1f96428b2d625` |
| S3: [Cascino et al. 2026](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC13289151/fullTextXML) | Introduction; Results on intrinsic termination; data availability: “only 22% of all TUs” | `395f7369492c25359e86df0ae479d864ddb14edd35100dc7fefdfd10a356b279` |
| S4: [Gale et al. 2021](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC7843447/fullTextXML) | Results, UTEX terminator library / Fig. 4: “correlation of TE values between UTEX 2973 and E. coli was low” | `a392ca971b6ab1e75f754ef125a01edc82d72a0c5d5ee17487fdca15f3347350` |
| S5: [STREME manual](https://meme-suite.org/meme/doc/streme.html) | --hofract: “including those in the hold-out set” | `0c6304ce737ff25d914443290e22bec860d08c5e5ed3848dedf7bc5cbf1415a7` |
| S6: [Rfam genome annotation documentation source](https://raw.githubusercontent.com/Rfam/rfam-docs/master/docs/source/genome-annotation.rst) | Opening paragraph; --cut_ga: “The Rfam library of covariance models can be used to search sequences” | `96c1d7ea64650381292733cff2457c289abb7c8161faa98bada76f0d601e1ee2` |
| S7: [Rfam RF01116, release 15.1](https://rfam.org/family/RF01116) | JSON rfam.description / cm.cutoffs: “Cyanobacterial functional RNA 1” | `b48fb2b880ea556a2ef0f9d420a071c48a7904781f15b024fdf3f0112b7cd4d0` |
| S8: [Richter et al. 2010](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC2796815/fullTextXML) | Abstract Results; Methods reporter assay: “We show that Yfr1 inhibits the translation of two predicted targets.” | `8a2c5cc84eb9bc2f68aa991e4ffc10b3c3a6ae40009547cd7cd3c2b35a2d81c8` |
| S9: [Tan et al. 2018](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6091082/fullTextXML) | Results, PsrR1 homology: “was identified as a homolog of the sRNA PsrR1” | `7063969b6577a330390269bec64df5f22c696203239257cb06fc21ef5148f7d8` |
| S10: [IntaRNA v3.4.1 README](https://raw.githubusercontent.com/BackofenLab/IntaRNA/v3.4.1/README.md) | Opening capability description: “Efficient RNA-RNA interaction prediction incorporating accessibility and seeding of interaction sites” | `67ae5c17c94ccff9a68484d4b7fefb950587dc22b0f85d91afd8c3742c0c0fc8` |
| S11: [RNAplfold manual](https://www.tbi.univie.ac.at/RNA/ViennaRNA/doc/html/man/RNAplfold.html) | Description, unpaired regions: “probability that a stretch of x consequtive nucleotides is unpaired” | `b94acfbb25b2735761d3f5993cd233dd24b0ce3bc55c4d626749c093d876e140` |
