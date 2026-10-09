# A_regulatory-methods-shortlist__20261008 — Active

Scope: Assess computational candidates for RBS and other regulatory/cryptic-site predictions requested by the owner, using repository/open-ticket context and primary sources.
Status: active
Opened: 2026-10-08
Updated: 2026-10-09

## Current State

Owner direction, 2026-10-09: investigate transfer from other cyanobacteria,
E. coli and other prokaryotes for **very rough UTEX regulatory-site candidates**
where evaluated UTEX sites are missing. This ticket owns Promoter Calculator,
standalone TransTermHP, STREME, Rfam/Infernal, IntaRNA and new ViennaRNA regulatory
uses; RBS and iDOG retain their linked tickets. Evidence assessment and ticket
updates are authorized. No new predictor was run or prediction layer published
in this pass. Lack of UTEX validation is a label/evaluation limitation, not by
itself a reason to reject exploratory candidates. Existing source/runtime,
coordinate and licence requirements remain; the iDOG execution hold remains.

Implementation resumed by the owner on 2026-10-08; this supersedes the earlier record-only instruction in this ticket. `cyano-ui-fixes` owns coordination/integration/closure. Standing claim-specific and source-access constraints still apply.

Owner: cyano-source-ingestion. Code baseline 7bf8811 in isolated worktree
worktrees/ui-choices-20261008. This is a candidate shortlist, not method execution,
new source admission, genomic remapping or a calibrated-confidence claim.

## Owner selection, 2026-10-08

**Record only; do not work on these methods or their viewer changes yet.**
Include RBS Calculator, iDOG/TransTermHP, Promoter Calculator, ViennaRNA, STREME,
Rfam + Infernal, and IntaRNA. The broader assessment table below is retained as
research context; it does not add independently approved methods beyond this list.
In particular, the earlier SD baseline and MEME/FIMO suggestions were not
explicitly selected in this answer.

For methods that "dont follow the recommendation that i requested", the owner
requests slightly transparent annotation-tag coloring and lower visual precedence
when multiple annotations overlap. Preserve the criterion as given; the affected
method set and opacity value need clarification before implementation. Lower
precedence must retain inspectable annotation identity, coordinates and evidence.
Every such gene annotation, including initiation and termination sites on genes,
gets an outline on hover in both gene viewers. The display requirements are also
recorded in O_gene-sequence-structural-features__20261007.

This is method-scope selection, not validated UTEX function, source admission,
runtime/version/parameter selection or release of the existing iDOG owner hold.

| Candidate | Proposed use | Relationship and limit |
| --- | --- | --- |
| RBS Calculator | Score translation initiation at annotated and alternative/internal starts; compare native/recoded sequence | Primary owner-requested candidate. Existing v1.0 ticket owns runtime/licence/method assessment. Host-specific applicability and parameters require verification. |
| SD complementarity baseline | Locate upstream complementary intervals and spacing as a simple comparison | Already proposed in gene-feature/RBS tickets; annotated 16S terminus is not a validated anti-SD boundary. No function claim from a match alone. |
| iDOG components | Compare internal-RBS/terminator screening and design components | Existing held iDOG ticket. Parts/design functionality is distinct from genomic promoter-location prediction; owner hold stays in force. |
| Promoter Calculator | Sigma-70 promoter/TSS and cryptic promoter candidates, including sequences within constructs | A real predictor candidate distinct from iDOG's promoter parts library. UTEX applicability not established by its E. coli-oriented validation. T7 model only for relevant T7 systems. |
| TransTermHP | Intrinsic/rho-independent terminators, including internal candidates | Already bundled by iDOG; not a general predictor for all termination mechanisms. Scores need domain evaluation. |
| STREME/MEME + FIMO | Discover enriched motifs then scan relevant motif models for candidate sites | Can use admitted TSS-anchored sequences and suitable controls. Training/evaluation split, matched backgrounds and multiple-testing control are necessary. Motif hit is not demonstrated regulation. |
| ViennaRNA RNAfold/RNAplfold/RNAup | Structure, local accessibility and RNA-interaction comparisons | Existing exact browser ViennaRNA 2.7.2 folding engine and folding ticket. Extend only after explicit model/input contracts; structure alone does not establish a regulatory element. |
| Rfam + Infernal | Known structured RNA family homologues, including regulatory RNA families | Existing independent tRNA/Infernal context supplies tooling knowledge, not validation of new families. Novel unrelated RNAs may be missed. |
| IntaRNA | Candidate sRNA/antisense target interactions with accessibility and seed constraints | Additional interaction-level candidate; requires relevant RNA sequences and organism evaluation. |

Initial assessment priority: RBS Calculator and internal-start scoring, Promoter
Calculator and TransTermHP, then motif discovery/scanning; RNA family/interaction
methods complement them. Compare original and recoded sequences to identify
created/strengthened or disrupted candidates. Keep scores and sequence edits
separate from verified biological function and measured Tan evidence.

Related tickets: O_rbs-calculator-gene-visualizer__20260930,
O_idog-promoter-prediction__20260930, the completed gene-sequence-closeup.md contract,
O_recoding-regulatory-site-change__20260930, O_folding-compute-backend__20260930,
and BioCyc/cross-strain annotation assessments. BioCyc/EcoCyc records are annotation
cross-checks, not interchangeable prediction methods or cross-strain coordinates.

## Current accessible versions and dependencies, 2026-10-09

The owner authorized evaluation of current accessible versions and local
computation where supported. The source reads below establish availability and
code contracts; no new regulatory prediction layer is admitted by this assessment.

| Selected method | Verified current source/runtime | Remaining method-specific input or access |
| --- | --- | --- |
| RBS Calculator | Public SalisLabCode head `46da913`; its v2.1.1 test imports a private `DNAc` package. Original v1.0 remains Python 2/NUPACK dependent. | Owner has no existing code/API/runtime access and explicitly retains this dependency as open. No surrogate SD scan is substituted. |
| iDOG / TransTermHP | Existing iDOG review/hold retained; standalone author download is TransTermHP 2.09 C++ source. | iDOG execution still waits on the owner's own review. Standalone intrinsic-terminator evaluation needs a reproducible tool build and its stated score/input contract. |
| Promoter Calculator | Public v1.0 at SalisLabCode `46da913`, GPL v3 or later; implementation still contains Python 2 syntax. Organism names other than the explicit E. coli or in-vitro modes fall through to E. coli calibration constants. | Python 3 compatibility/evaluation and explicit model/host labels before scores are published; selecting UTEX as a string does not supply UTEX calibration. |
| ViennaRNA | Existing project Python/browser model is 2.7.2; Python-library smoke returned a finite MFE/structure. | Structure/accessibility is computational evidence, not a validated regulatory-site call; select windows/parameters for any new annotation method. |
| STREME | Current author MEME Suite source download is 5.5.9. | Foreground/control cohort and evaluation split are required for motif discovery; a discovered motif alone is not an admitted site layer. |
| Rfam + Infernal | Current official Rfam release is 15.1; existing user-owned `trna-validate` environment has Infernal 1.1.5. | Pin family models/cutoffs and native input coordinates. Fresh cmsearch matches are calculated outputs even though their models come from a library. |
| IntaRNA | Current official release tag is v3.4.1. | Query/target RNAs, accessibility/seed parameters and an evaluated local runtime are required for an interaction layer. |

The record-origin distinction is now resolved: newly calculated outputs receive
translucent tags/lower overlap priority; annotations retrieved from a library are
sourced records. Keep origin independent from measurement/prediction confidence.
The generic rendering/hover contract is implemented by the gene-viewer stream;
source-specific data producers remain separate from this shortlist.

Located short quotations were mechanically matched against downloaded primary
source bytes. Receipts, line locations, hashes and snapshots are in
`.playwright-cli/ui-open-tickets-20261008/regulatory-assessment/` in the integration
worktree; `located-quotations.json` records each match. Public source reads require
no account/privacy escalation. No private RBS code or NUPACK was accessed, no
new tool environment was installed, and no iDOG run was launched.

## Cross-organism transfer assessment, 2026-10-09

The routes below are proposals inferred from the cited capabilities and evidence,
not completed UTEX benchmarks. Prefer close Synechococcus donors such as PCC 7942
or PCC 6301 when the particular locus and surrounding sequence are conserved;
use other cyanobacteria next and distant bacterial models as weaker priors.
Relatedness alone does not establish conserved regulation. Eukaryotic or phage
parts do not become ordinary cyanobacterial promoters by sequence similarity.

| Method / owning ticket | Concrete rough-prediction route | Limits and smallest useful evaluation |
| --- | --- | --- |
| [RBS Calculator](O_rbs-calculator-gene-visualizer__20260930.md) | Once executable code is available, score native UTEX initiation contexts with pinned model/host parameters; use conserved donor start-region alignments as supporting evidence. | PCC 6803 experiments reported poor relative-expression prediction [S1]. Treat outputs as candidate initiation contexts, not measured binding boundaries or reliable rates. Compare rankings with independent translation/reporter evidence where available; RNA abundance alone is not an RBS benchmark. Code access remains open. |
| [iDOG](O_idog-promoter-prediction__20260930.md) | Assess reusable RBS and terminator components under their own contracts; use bacterial/cyanobacterial parts as comparison inputs where appropriate. | Its yeast promoter library and fixed T7 promoter do not supply a native UTEX promoter locator. Preserve the owner hold and bytecode/source gaps. Standalone TransTermHP is the practical independent route; do not call another predictor's output iDOG promoter predictions. |
| Promoter Calculator | Run the pinned E. coli sigma-70 model on native UTEX windows on both strands as an explicitly out-of-domain ranking. Conserved donor promoter regions supply additional candidates, checked against native sequence. | The paper's in-vivo tests use E. coli [S2], not UTEX calibration. Test localization/enrichment near held-out Tan TSSs, separating alternative starts and conditions from independent loci. A TSS is an initiation anchor, not a complete promoter boundary; do not convert raw counts into calibrated promoter strength. Runtime compatibility is still outstanding. |
| TransTermHP | Score native UTEX sequence for intrinsic terminator candidates, then compare with uniquely aligned PCC 7942 transcript-end contexts. Cascino 2026 / GSE309256 is a concrete donor-data candidate [S3]. Gale 2021's UTEX-tested terminator parts can support a separate sequence-level check [S4]. | This addresses intrinsic terminators only. PCC 7942 intrinsic features cover a minority of transcript units [S3]; a transcript end need not be a termination site. Report candidate recovery and shuffled-background hits separately from termination efficiency. Gale's reporter-part strengths transfer poorly between hosts [S4]; they are not native genomic coordinates. Tool scores are not calibrated UTEX probabilities. |
| STREME | Discover motifs in TSS-anchored native UTEX sequences and, separately, admitted donor promoter/regulon cohorts; compare them and score motifs against native UTEX sequence. | Use length/composition-matched controls and an independent locus/ortholog-block test set. STREME's final motifs include its internal holdout [S5], so that holdout is not an external generalization test. Its sites output covers the discovery input; new-sequence scanning needs an explicitly chosen, evaluated scanner (FIMO is a candidate, not a newly selected method). A motif hit alone does not identify a regulator or establish function. |
| Rfam + Infernal | Search native UTEX sequence with pinned covariance models and their family-specific gathering cutoffs [S6]; prioritize cyanobacterial regulatory families, with Yfr1/RF01116 as one concrete candidate [S7]. | This transfers sequence/structure family models, not donor coordinates. Report homology and family identity, not demonstrated regulatory action. Separate regulatory families from tRNA/rRNA/other RNA classes; retain overlaps/truncation and unmatched regions. Check conserved donor homologues and native transcript evidence, without treating missing expression or missing family hits as negatives. |
| IntaRNA | Identify native UTEX homologues of candidate sRNAs, then predict interactions against native target transcripts. Yfr1 has an IntaRNA precedent in Prochlorococcus MED4 [S8]; Tan reports a UTEX PsrR1 homologue [S9]. Conserved donor seed/target regions are supporting evidence. | Confirm both RNA identities, transcript boundaries and the interacting sequences; gene orthology alone does not transfer a target interaction. Recompute accessibility and interaction energies [S10]; compare with shuffled queries, seed-disrupting controls and held-out interactions where available. The Yfr1 paper used a heterologous reporter assay, not UTEX validation. Energy or complementarity alone is not evidence of regulation. |
| ViennaRNA | Recompute native UTEX local structure/accessibility in candidate intervals, using conserved donor RNA structures as supporting context. RNAplfold explicitly supplies unpaired-region probabilities [S11]. | This is transferable thermodynamic calculation, not a regulatory-site detector by itself. Retain exact sequence/window/temperature settings, examine sensitivity to them and matched backgrounds, and combine with independent family/TSS/terminator evidence. Existing browser folding is not validation of this new annotation use. |

### Shared transfer and evaluation contract

- GSE309256 and the papers' supplementary site/part tables are candidate inputs.
  This pass read the papers, not those datasets; exact files, assembly identity,
  source terms and sequence joins still need intake before use.
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

### Primary-source evidence receipts

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
| S2: [LaFleur et al. 2022](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9440211/fullTextXML) | Results, four test datasets: “inside E. coli cells” | `b0418e683a6fd23906dc3e8329ef74dd166298aab39c64b54ec1f96428b2d625` |
| S3: [Cascino et al. 2026](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC13289151/fullTextXML) | Introduction; Results on intrinsic termination; data availability: “only 22% of all TUs” | `395f7369492c25359e86df0ae479d864ddb14edd35100dc7fefdfd10a356b279` |
| S4: [Gale et al. 2021](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC7843447/fullTextXML) | Results, UTEX terminator library / Fig. 4: “correlation of TE values between UTEX 2973 and E. coli was low” | `a392ca971b6ab1e75f754ef125a01edc82d72a0c5d5ee17487fdca15f3347350` |
| S5: [STREME manual](https://meme-suite.org/meme/doc/streme.html) | --hofract: “The letter frequencies in the final motifs reported by STREME are based on all primary sequences, including those in the hold-out set.” | `0c6304ce737ff25d914443290e22bec860d08c5e5ed3848dedf7bc5cbf1415a7` |
| S6: [Rfam genome annotation documentation source](https://raw.githubusercontent.com/Rfam/rfam-docs/master/docs/source/genome-annotation.rst) | Opening paragraph; --cut_ga: “The Rfam library of covariance models can be used to search sequences” | `96c1d7ea64650381292733cff2457c289abb7c8161faa98bada76f0d601e1ee2` |
| S7: [Rfam RF01116, release 15.1](https://rfam.org/family/RF01116) | JSON rfam.description / cm.cutoffs: “Cyanobacterial functional RNA 1” | `b48fb2b880ea556a2ef0f9d420a071c48a7904781f15b024fdf3f0112b7cd4d0` |
| S8: [Richter et al. 2010](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC2796815/fullTextXML) | Abstract Results; Methods reporter assay: “We show that Yfr1 inhibits the translation of two predicted targets.” | `8a2c5cc84eb9bc2f68aa991e4ffc10b3c3a6ae40009547cd7cd3c2b35a2d81c8` |
| S9: [Tan et al. 2018](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6091082/fullTextXML) | Results, PsrR1 homology: “was identified as a homolog of the sRNA PsrR1” | `7063969b6577a330390269bec64df5f22c696203239257cb06fc21ef5148f7d8` |
| S10: [IntaRNA v3.4.1 README](https://raw.githubusercontent.com/BackofenLab/IntaRNA/v3.4.1/README.md) | Opening capability description: “Efficient RNA-RNA interaction prediction incorporating accessibility and seeding of interaction sites” | `67ae5c17c94ccff9a68484d4b7fefb950587dc22b0f85d91afd8c3742c0c0fc8` |
| S11: [RNAplfold manual](https://www.tbi.univie.ac.at/RNA/ViennaRNA/doc/html/man/RNAplfold.html) | Description, unpaired regions: “probability that a stretch of x consequtive nucleotides is unpaired” | `b94acfbb25b2735761d3f5993cd233dd24b0ce3bc55c4d626749c093d876e140` |

## Verification

Transfer-planning update checked by `cyano-regulatory-sites`, 2026-10-09:
all five affected ticket identities, live queue/local links and transfer anchors
pass; all 11 quotes match their retrieved sources and hashes. `git diff --check`
passes. Repository gates: `npm test` 1,415 passed; pytest 938 passed, 1 skipped,
36 subtests passed; contract 119 passed, 0 failed, 1 declared skip. Documentation
only: no new predictor, data layer or UI was run/changed. All method tickets stay
open/active for their remaining work.

Primary source capability descriptions were retrieved and short located quotations
matched mechanically on 2026-10-08. Receipt/raw snapshots are in ignored
.playwright-cli/regulatory-shortlist-20261008. Rfam's plain HTTP client got 403;
the public-page web extraction was readable and its processed snippet is hashed
separately, never represented as raw HTML. No restricted session was accessed.
No model was executed, fitted, benchmarked or admitted into the browser here.
Documentation gates at baseline 7bf8811 passed: JS 1,274; pytest 783 with 1 skip
and 36 subtests; contract 116 with 1 declared skip. Local queue links and
filename/H1/status fields checked; no browser UI changed in this documentation.

| Source | Retrieved | Located quotation | Checksum |
| --- | --- | --- | --- |
| [rbs](https://raw.githubusercontent.com/hsalis/salis-lab-protocol-book/master/design/rbs-calculator.md) | 2026-10-08 | receipts.json key `rbs`; exact text match | `fc731f1b4b472289734728d2b9506c38e7080bc3cebaa0cf59ee6b3bf6286396` |
| [idog](https://raw.githubusercontent.com/jayman1466/iDOG/master/README.md) | 2026-10-08 | receipts.json key `idog`; exact text match | `f38ab3f7e4b9f75627adb9dae8464f2dc46a19ef3d66690639fe4380042ad554` |
| [promoter](https://raw.githubusercontent.com/hsalis/SalisLabCode/master/README.md) | 2026-10-08 | receipts.json key `promoter`; exact text match | `b1711fdd648548d3e781ec230f8d2581e6a4fc83d0647ecbe35b16aed019bf43` |
| [transterm](https://transterm.cbcb.umd.edu/) | 2026-10-08 | receipts.json key `transterm`; exact text match | `7fc019a884e82e183dc54fafe22c7058b9fa2f3c9c26d0a1a5670dd23737cb59` |
| [fimo](https://meme-suite.org/meme/doc/fimo.html) | 2026-10-08 | receipts.json key `fimo`; exact text match | `b0a45f1705f9fac0198ffd89a40709cf527fd97b0462c43e7ba6869c95dd1415` |
| [streme](https://meme-suite.org/meme/doc/streme.html) | 2026-10-08 | receipts.json key `streme`; exact text match | `0c6304ce737ff25d914443290e22bec860d08c5e5ed3848dedf7bc5cbf1415a7` |
| [rna-accessibility](https://www.tbi.univie.ac.at/RNA/ViennaRNA/doc/html/man/RNAplfold.html) | 2026-10-08 | receipts.json key `rna-accessibility`; exact text match | `b94acfbb25b2735761d3f5993cd233dd24b0ce3bc55c4d626749c093d876e140` |
| [rfam](https://docs.rfam.org/en/latest/genome-annotation.html) | 2026-10-08 | receipts.json key `rfam`; exact text match | `2fc8d475ed43843613bd1ce0de51e537ddae50ca483a94249dd57e5ce49049d2` |
| [intarna](https://raw.githubusercontent.com/BackofenLab/IntaRNA/master/README.md) | 2026-10-08 | receipts.json key `intarna`; exact text match | `af1ef24850c0ce05df5b3c652bc136992aff6ef013f1262cd23abf4a2cfe7ceb` |

## Cleanup

Transfer accepted candidate scope and remaining method/input/evaluation decisions
into their owning method tickets. Retain the existing iDOG hold. Distill only
reusable verified contracts after methods are evaluated; do not turn this candidate
list into a record of validated UTEX predictions. Resolve with named closer and
all findings, then R-rename/distill/index/remove last.
