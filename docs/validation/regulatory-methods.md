# Regulatory annotation methods

## Record origin and viewer behavior

Keep how a record was obtained separate from its biological evidence. An
annotation retrieved from a library is a sourced record; a newly calculated
prediction is computed, including a new Infernal search using a library model.
Do not infer origin from the tool name, display text, measurement label or score.
Computed tags have translucent coloring and lower overlap priority than sourced
annotations. Every overlapping record remains inspectable. Both gene viewers
provide hover and keyboard outlines, including initiation and termination sites.

An available marker type does not imply an admitted dataset. Publish a new layer
only with its source/model version, native input identity, parameters, coordinate
basis, score meaning and applicable validation under the existing
[data contract](data-contract.md) and [source ledger](source-ledger.md).
Model scores, RNA structures and motif/family matches do not establish measured
regulation or calibrated biological probability.

## Selected methods and reproducible boundaries

| Method | Source and useful output | Input/runtime boundary |
| --- | --- | --- |
| RBS Calculator | [Public Salis-lab model harness](https://github.com/hsalis/SalisLabCode/blob/46da9132740bce30bccd107f02808adf2215e2f0/ModelTestSystem/examples/RBS/test_RBS_Calculator_v2_1_1.py), translation-initiation modeling | The public v2.1.1 harness imports private `DNAc` code. Original v1.0 needs Python 2 and NUPACK. Code/API/backend access is an open dependency; do not substitute an SD scan under this name. |
| iDOG / TransTermHP | [iDOG](https://github.com/jayman1466/iDOG) design/screening components; [TransTermHP 2.09](https://transterm.cbcb.umd.edu/) intrinsic terminators | iDOG's promoter-parts library is distinct from genomic promoter-location prediction. Its owner-review hold remains. Evaluate standalone terminator inputs and score semantics separately. |
| Promoter Calculator | [v1.0 source](https://github.com/hsalis/SalisLabCode/blob/46da9132740bce30bccd107f02808adf2215e2f0/Promoter_Calculator/Promoter_Calculator_v1_0.py), sigma-70 promoter/TSS model | Source still has Python 2 syntax and GPL v3-or-later terms. Apart from the explicit in-vitro mode, other organism names use E. coli calibration constants. A UTEX string is not a UTEX calibration. |
| ViennaRNA | Existing [2.7.2 folding contract](rna-folding.md), folding/accessibility comparisons | Preserve model, window and parameter identity. A structure or accessibility value alone is not a regulatory-site call. |
| STREME | [MEME Suite 5.5.9](https://meme-suite.org/meme-software/index.html), enriched motif discovery | Pin foreground, controls and evaluation split. Motif discovery and genomic site scanning are distinct steps. |
| Rfam + Infernal | [Rfam release 15.1](https://ftp.ebi.ac.uk/pub/databases/Rfam/CURRENT/README) family models; [Infernal 1.1.5](http://eddylab.org/infernal/) searches | Pin family models/cutoffs and query coordinates. Existing `trna-validate` environment has Infernal 1.1.5; this does not admit a new family layer. |
| IntaRNA | [v3.4.1](https://github.com/BackofenLab/IntaRNA/releases/tag/v3.4.1), candidate RNA interactions | Query/target RNAs, seed/accessibility parameters and coordinate provenance are required. |

These are candidate/runtime boundaries verified against primary sources on
2026-10-09. They are not a record of seven deployed predictors or validated UTEX
regulatory annotations. The existing ViennaRNA and tRNA pipelines keep their
own validated contracts; source-specific additions require evaluated producers.
