# A_regulatory-methods-shortlist__20261008 — Active

Scope: Assess computational candidates for RBS and other regulatory/cryptic-site predictions requested by the owner, using repository/open-ticket context and primary sources.
Status: active
Opened: 2026-10-08
Updated: 2026-10-08

## Current State

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
O_idog-promoter-prediction__20260930, O_gene-sequence-structural-features__20261007,
O_recoding-regulatory-site-change__20260930, O_folding-compute-backend__20260930,
and BioCyc/cross-strain annotation assessments. BioCyc/EcoCyc records are annotation
cross-checks, not interchangeable prediction methods or cross-strain coordinates.

## Verification

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
