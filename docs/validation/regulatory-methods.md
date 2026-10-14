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
| iDOG / TransTermHP | [iDOG](https://github.com/jayman1466/iDOG) design/screening components; [TransTermHP 2.09](https://transterm.cbcb.umd.edu/) intrinsic terminators | iDOG's promoter-parts library is distinct from genomic promoter-location prediction. Its owner-review hold remains. The [standalone pilot](regulatory-transterm.md) pins native inputs, annotation context and score semantics separately. |
| Promoter Calculator | [v1.0 source](https://github.com/hsalis/SalisLabCode/blob/46da9132740bce30bccd107f02808adf2215e2f0/Promoter_Calculator/Promoter_Calculator_v1_0.py), sigma-70 promoter/TSS model | The [pinned preparation and gTSS pilot](regulatory-promoter.md) adapt the public Python 2 source and evaluate native localization/control scores while preserving coefficients and GPL v3-or-later terms. Apart from the explicit in-vitro mode, other organism names use E. coli calibration constants. A UTEX string is not a UTEX calibration. |
| ViennaRNA | Existing [2.7.2 folding contract](rna-folding.md), folding/accessibility comparisons | The [native accessibility producer](regulatory-accessibility.md) preserves model, window, temperature, segment and strand/circular-coordinate identity. A structure or accessibility value alone is not a regulatory-site call. |
| STREME | [MEME Suite 5.5.9](https://meme-suite.org/meme-software/index.html), enriched motif discovery | The [native gTSS pilot](regulatory-streme.md) pins blocked discovery/evaluation cohorts, composition-preserving controls and explicit PWM ranking. Motif discovery and genomic site scanning are distinct steps. |
| Rfam + Infernal | [Rfam release 15.1](https://ftp.ebi.ac.uk/pub/databases/Rfam/CURRENT/README) family models; [Infernal 1.1.5](http://eddylab.org/infernal/) searches | The [RF01116 pilot](regulatory-rfam.md) pins family bytes, gathering cutoffs and native coordinates with Infernal 1.1.5. A new family search remains computed evidence; the pilot does not admit a browser layer. |
| IntaRNA | [v3.4.1](https://github.com/BackofenLab/IntaRNA/releases/tag/v3.4.1), candidate RNA interactions | The [bounded window pilot](regulatory-intarna.md) pins runtime/query/target identities, seed/accessibility parameters and native coordinates. Approximate RNA boundaries and control interactions prevent established-target claims. |

These are source-pinned candidate and executable-pilot boundaries. They are not a record of seven deployed predictors or validated UTEX
regulatory annotations. The existing ViennaRNA and tRNA pipelines keep their
own validated contracts. The [transfer contract](regulatory-transfer.md) retains
source evidence and limits; [browser-layer admission](../notes/tickets/O_regulatory-layer-admission__20261014.md)
remains separate from these non-release producers.

## Local accessibility indexing

ViennaRNA 2.7.2 provides local unpaired-segment probabilities through
`RNA.pfl_fold_up(sequence, ulength, window_size, max_bp_span)`. The returned matrix
is indexed by **segment end**: `matrix[end][length]` describes the oriented
one-based interval `[end-length+1, end]`. Rows where `end < length` are padding,
not measured zero accessibility. The installed Python docstring's statement that
the row is the segment start disagrees with both the runtime and
[the pinned C implementation](https://github.com/ViennaRNA/ViennaRNA/blob/v2.7.2/src/ViennaRNA/partfunc/pf_window.c#L1559).
The source defines the stretch as starting at `i-x+1`; `store_pU_callback` keeps
that row index. Check the runtime with a sequence that cannot pair:

```python
import RNA
assert RNA.__version__ == "2.7.2"
p = RNA.pfl_fold_up("A" * 30, 10, 20, 15)
assert all(p[end][10] == 0 for end in range(1, 10))  # invalid padding
assert all(abs(p[end][10] - 1) < 1e-12 for end in range(10, 31))
```

For a native window whose one-based start is `w`, a segment ending at `e` with
length `k` maps to `[w+e-k, w+e-1]` on the plus strand. For an oriented reverse
complement of window length `L`, it maps to `[w+L-e, w+L-e+k-1]` on the minus
strand. A regulatory consumer must preserve window identity, orientation,
segment length, folding window, maximum pairing span and model temperature.
The simplified wrapper uses default model settings; use the documented
`fold_compound.probs_window()` interface for custom model settings. Neither
unpaired probability nor MFE is a probability of regulatory function.

## Local STREME build

Use the author's [MEME Suite 5.5.9 archive](https://meme-suite.org/meme/meme-software/5.5.9/meme-5.5.9.tar.gz),
SHA-256 `0406fb7b1dc27f6aab3d6d3a29ecdf617bbdd946690cfa97ca2129bc210bfd12`.
Verify it before extraction. Keep the archive and generated files in ignored
scratch, and retain its `COPYING` file. That file states the source terms for
“educational, research and non-profit purposes”; this recipe does not make a
separate permission or source-admission decision.

Inside a fresh extracted source tree, the following builds only the selected
STREME executable and its libraries with an isolated installation prefix. Supply
the absolute path to the project Python interpreter; no shared installation or
shell-profile change is needed.

```sh
./configure --prefix="$PWD/../local" --enable-serial --disable-web \
  --enable-build-libxml2 --enable-build-libxslt \
  --with-python=/absolute/path/to/project/.venv/bin/python
make -C src/libxml2 -j2
make -C src/libxslt -j2
make -C src dir.h projrel.h citation.js.h
make -C src -j2 streme
src/streme --version
```

The generated headers are prerequisites when selecting the `streme` target
rather than the suite's default target. Record the archive, binary, compiler,
input, flags and output hashes. Runtime success and deterministic motif output
are not motif-boundary accuracy or UTEX validation. In particular, a motif may
capture only part of a planted pattern; evaluate recovery independently before
using such a check as an accuracy benchmark. The [native pilot](regulatory-streme.md) supplies explicit foreground/control
cohorts and independent locus/overlap/similarity blocks. Its window ranking is
separate from selecting and admitting a genomic motif-site scanner.
