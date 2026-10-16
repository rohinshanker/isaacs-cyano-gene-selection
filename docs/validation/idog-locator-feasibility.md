# iDOG reuse and native promoter-location design

## Decision and scope

Build a native promoter locator as a separate component, with its actual scoring
model named. Recovering iDOG's missing Python source is not a prerequisite for
that component. iDOG supplies construct-design machinery; it supplies neither
an identified native promoter-location model nor UTEX calibration data.

The owner requested promoter **locations**, not promoter design, and authorized
investigating a new locator around iDOG. That investigation supports a separate
scanner with optional, independently evaluated RBS/terminator context. Wrapping
iDOG's existing entry points would not provide the requested promoter scores.
Do not call another model's predictions “iDOG promoter predictions.”

This is a feasibility and implementation contract. It admits no new prediction
layer, makes no claim of regulatory function, and does not change the existing
Tan TSS or RNA-folding features. The remaining new-site and recoding calculation
belongs to [regulatory-site changes](../notes/tickets/O_recoding-regulatory-site-change__20260930.md).

## Pinned source and missing code

The inspected [iDOG tree](https://github.com/jayman1466/iDOG/tree/9d71187f0b2eb27ee681918927e12850470a0688)
is commit `9d71187f0b2eb27ee681918927e12850470a0688`; public `master` still
resolved to that commit when checked on 2026-10-15. Its 44 tracked files include
nine Python sources and 21 CPython 3.7 bytecode files. Twelve bytecode modules
have no matching `.py` source. Source absence and absence of a locator are
different findings.

The readable modules are `RNAfold_wrapper`, `codon_opt`, `create_RBS`,
`dG_tot_calc`, `detailed_output`, `dnaplotlib`, `orf_recode`, `plot_operon`, and
`transterm_wrapper`. The missing source modules are `config`, `countwords`,
`create_RBS_web`, `create_RBS_webwrapper`, `hello`, `models`, `operon_design`,
`refactor_pipeline`, `refactor_pipeline_web`, `web_codon_opt`, `web_create_RBS`,
and `web_operon_design`.

All 21 bytecode files, including those twelve, were decoded with xdis 6.3.0
without importing or executing iDOG. Nested code objects and call paths show:

| Missing source module | Bytecode-confirmed role |
| --- | --- |
| `config` | Flask application configuration. |
| `countwords` | Fetch a URL and count whitespace-separated words. |
| `create_RBS_web`, `create_RBS_webwrapper`, `web_create_RBS` | RBS generation and asynchronous job/result wrappers. |
| `hello` | Flask forms/routes dispatching RBS generation, codon optimization and operon design. |
| `models` | Database records for those submissions and their results, not a fitted prediction model. |
| `operon_design`, `web_operon_design` | Select yeast/T7 parts, recode submitted genes, concatenate a construct, write GenBank and plot it. |
| `refactor_pipeline` | Standalone demonstration of codon/RBS redesign and terminator checking. |
| `refactor_pipeline_web` | Callable design pipeline used by construct assembly. |
| `web_codon_opt` | Queue/database wrapper around codon optimization. |

The operon modules' `SeqFeature` coordinates annotate their newly assembled
constructs. They do not identify sites in an input native genome. Their fixed
T7 sequence is `TAATACGACTCACTATAGGG`; promoter strengths come from selected
library rows rather than a fitted sequence scorer. No native promoter locator
was found in the inspected source, bytecode or assets. This conclusion is scoped
to the pinned tree, not hypothetical private code or later versions.

`create_RBS.py:13` accepts an ORF and target translation-initiation rate;
`codon_opt.py:16` accepts an amino-acid sequence and returns a redesigned CDS
and RBS; `transterm_wrapper.py:10` screens terminators. These contracts do not
locate promoters. The RBS thermodynamic source is present. The private `DNAc`
dependency of the separate Salis RBS Calculator v2.1.1 harness is not an iDOG
promoter-locator dependency.

## Asset and runtime boundaries

The 48-row `yeast_elements/promoters.csv` stores named designed parts, strengths,
sequences and core indices. It is not a fitted genomic locator. Its 25-row
terminator companion has no strength column. An exact sequence match to a library
part could be reported as a part match; it would not establish endogenous UTEX
promoter activity. No such matching layer is admitted here.

The [Patel et al. paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC10619838/)
identifies iDOG as its code and describes synthetic hybrid expression constructs.
Figure 3 distinguishes T7-controlled prokaryotic expression from yeast
minipromoters. This supports the design interpretation; it is not a native UTEX
promoter-location benchmark. The earlier report that no paper names iDOG was
incorrect and must not be reused.

| Component | Reuse boundary |
| --- | --- |
| Design/web modules available only as `.pyc` | Obtain source for maintainable reuse of those modules; a new independent scanner does not import them. |
| RBS design and internal-RBS screening | Optional separate translation-context calculation, with host/rRNA assumptions and its own evaluation. Not promoter evidence. |
| TransTermHP wrapper/binary | Optional separate intrinsic-terminator context. Prefer the existing [standalone pinned pilot](regulatory-transterm.md), not the bundled x86-64 Linux binary on this arm64 Mac. |
| RNA utilities and plotting | Generic functionality already available in this project; importing the old iDOG application is unnecessary. |
| Yeast promoter library and fixed phage parts | Design assets, not a cyanobacterial training set or native promoter-location model. |

The root iDOG `LICENSE` is MIT. This does not replace dependency-specific terms:
the bundled TransTermHP has no accompanying source/licence file in this tree;
the standalone source contract preserves its GPL terms. `dnaplotlib.py` declares
MIT and its own author attribution. Preserve upstream notices for anything
actually reused; do not redistribute the entire dependency bundle under the
root MIT label.

The README documents Linux testing, Python 3.7, “biopython ... 1.7.6” as written,
Pillow 6.2.0 and ViennaRNA 2.4.14 executables. The sources also import Matplotlib;
NuPoP/Rscript is a separate nucleosome-plot path. Relative file paths and
external-command output parsing require work before portable application reuse.
The static audit is not a successful execution of iDOG. None of these legacy
runtime dependencies is mandatory for a scanner that does not import iDOG.

## Data readiness

| Input or decision | Available basis | Necessity and remaining limit |
| --- | --- | --- |
| Native sequence and annotation | Pinned UTEX `GCF_000817325.1`, three replicons; FASTA/GFF and existing sequence/coordinate checks | Mandatory. Preserve accession, assembly, strand, circular origin and actual CDS segments. An ortholog match does not transfer a promoter coordinate. |
| Executable scoring basis | Separately pinned [Promoter Calculator v1.0 preparation and pilot](regulatory-promoter.md) | Suitable first engineering baseline, explicitly using its E. coli model identity. Not a fitted UTEX model or an iDOG implementation. No new model training is required for that baseline. |
| Native initiation anchors | Admitted Tan gTSS extract: 2,475 unique strand/replicon/position identities associated with 1,820 source locus tags | Available for bounded localization checks. Repeated conditions are not independent loci; TSS points are not complete promoter boundaries. Other admitted TSS classes remain distinct. |
| Conditions | Control, dark, high light and high temperature measurements, with source provenance | Retain metadata; do not infer strength or a negative site from missing activity in one condition. |
| Native background and leakage partitions | Genome and anchors permit deterministic windows, overlapping-window groups and sequence-similarity checks | Mandatory before evaluation. The existing pilot excludes repeated loci, overlapping windows and identical/reverse-complement sequences; broader homology grouping and held-out genomic controls are still needed for generalization claims. |
| Confirmed promoter boundaries and negatives | Not supplied by the admitted gTSS extract | Not required to compute exploratory scores. Required evidence for claimed boundary accuracy, specificity or biological false-positive rates. Unknown/unassayed regions are not negatives. |
| Donor promoter/regulon evidence | Related-strain sources are candidates under the [transfer contract](regulatory-transfer.md) | Optional improvement. Admit exact artifacts and unique strand-aware interval mappings separately; retain donor and native identities. |
| Site-selection rule and biological acceptance | No calibrated UTEX threshold established | Raw-score/localization work can proceed. A finite displayed call set needs an explicit reproducible selection rule; no arbitrary score becomes a probability or an accuracy claim. |

Tan's paper reports 4,808 TSSs over its four tested conditions; the admitted
gTSS extract above is a particular 2,475-site subset, not that full total.

## Concrete locator and recoding proposal

Use the existing Promoter Calculator preparation as a separately named scorer
behind a small local batch interface. This is a recommended implementation
basis, not a silent replacement of iDOG or authorization to label its scores
validated. Begin with UTEX; assess donors and E. coli separately rather than
pooling their validation populations.

1. **Inputs:** exact assembly/replicon and native interval, oriented sequence,
   original-versus-recoded sequence identity, active scheme and occurrence
   distribution, pinned model/preparation hashes, parameters and coverage mask.
   Build recoded sequence through the project's existing recoding contract,
   preserving the protected initiation triplet, terminal-stop convention and
   focal-gene-only edits. Only coordinates in the focal CDS are edited; a base
   shared with a neighboring gene necessarily changes at that same coordinate.
   Do not independently recode the neighboring gene as part of this comparison.
2. **Coordinates:** score both strands in transcription orientation. Preserve a
   native coordinate for every input base, including circular wrap and split
   intervals. Retain model component intervals separately from the predicted
   start point. Use the checked conversions in the Promoter Calculator contract;
   its `run()` forward/reverse keys cannot be mixed as one coordinate convention.
3. **Coverage:** score only starts with full model context (`67 <= i <= L-20`
   for zero-based oriented start index `i`). Tiling needs context on both sides
   and one canonical owner per scored genomic start. Reject noncanonical bases
   or record an explicit unevaluated region. Window-edge truncation must not
   manufacture a changed/lost site.
4. **Output:** per-start raw energy/model-rate curves and component spans, with
   method, model host, sequence and parameter identities. Preserve all tied
   optima. A selected call additionally records its exact selection rule and
   coverage denominator. The model rate is not a measured UTEX transcription
   rate. Keep site/strand identities distinct from the genes they overlap.
5. **Comparison:** compute both sequences with the same scoring and selection
   settings. Join starts by native replicon, strand and position. Distinguish
   score changes, edited component bases, and calls gained/lost under the stated
   rule. Keep the old coordinate visible for a lost call. Classify missing
   coverage as not evaluated, never lost/unchanged. Do not call predicted gain
   or loss a demonstrated transcriptional effect.
6. **Presentation after admission:** an optional computed track in both gene
   viewers, showing the start point and model component spans, exact affected
   bases and source/model details. Per-gene counts may include each overlapping
   site once, with both strands and evaluated denominators. Preserve native
   measured TSSs as a separate layer. Reuse the existing source visibility,
   tooltip, missingness, export and translucent computed-origin contracts.

No remote service is needed to evaluate this local batch design. Browser
on-demand scoring would additionally require a measured runtime/packaging
decision; a Python-only pilot does not establish browser compatibility.

## Evaluation and release boundary

The existing gTSS pilot is the executable localization baseline. It scores 41
starts within ±20 nt of each anchor with complete model context, reports ties,
and pairs each input with a composition-preserving shuffle. Its ±5-nt summary
is descriptive, not a learned calling threshold or a genome-wide performance
estimate. A second iDOG benchmark would have no promoter model to exercise.

For a new scanner, freeze evaluation cohorts before tuning. Group all conditions
of a locus, physically overlapping windows and identified homologous sequences
in the same partition. Keep matched native genomic controls distinct from
shuffles and experimentally established negatives. Report eligible/evaluated
denominators, localization curves and tie-aware ranks, plus score distributions
and background call burden. Do not fit a threshold on the reported test set.
Any chosen display threshold is an exploratory selection policy until supported
by suitable validation; no minimum coverage approval is required by the owner.

Required implementation checks cover both strands, circular origins, split CDSs,
overlaps, window tiling, exact sequence slices, noncanonical/short inputs, score
ties, all active recoding controls, unchanged pairs, gained/lost calls,
unavailable evidence, source selection, per-gene deduplication, export replay,
and failed/cancelled/stale calculations. Run the project gates and rendered
mobile/tablet/desktop checks before any browser integration.

## Reproduce the static audit

[The source inventory](idog-source-inventory.json) pins all 44 paths, sizes and
SHA-256 values. It contains metadata, not third-party source or bytecode. Use a
fresh ignored checkout and a separate Python 3.12 environment for the
[cross-version disassembler](https://github.com/rocky/python-xdis):

```sh
git clone https://github.com/jayman1466/iDOG .playwright-cli/idog-audit
git -C .playwright-cli/idog-audit checkout --detach 9d71187f0b2eb27ee681918927e12850470a0688
python3.12 -m venv .playwright-cli/idog-audit-venv
.playwright-cli/idog-audit-venv/bin/python -m pip install xdis==6.3.0
```

From the repository root, verify the complete tracked inventory, then decode
every bytecode module. `--no-show-source` prevents reading the old source paths
embedded in bytecode. Inspect the emitted nested functions and calls; a filename
or string search alone is not a capability audit.

```python
import hashlib
import json
from pathlib import Path
import subprocess

inventory = json.loads(Path('docs/validation/idog-source-inventory.json').read_text())
repo = Path('.playwright-cli/idog-audit')
paths = subprocess.check_output(
    ['git', '-C', str(repo), 'ls-tree', '-r', '--name-only', inventory['commit']],
    text=True).splitlines()
assert paths == [row['path'] for row in inventory['files']]
output = Path('.playwright-cli/idog-disassembly')
output.mkdir(exist_ok=False)
for row in inventory['files']:
    source = repo / row['path']
    data = source.read_bytes()
    assert len(data) == row['bytes']
    assert hashlib.sha256(data).hexdigest() == row['sha256']
    if source.suffix == '.pyc':
        with (output / (source.stem + '.txt')).open('w') as handle:
            subprocess.run([
                '.playwright-cli/idog-audit-venv/bin/pydisasm',
                '--no-show-source', '-F', 'extended', str(source),
            ], stdout=handle, check=True)
```

No upstream Python function, web server or binary is executed by this procedure.
Decoding a legacy module establishes inspectability, not a maintained source
distribution or runtime compatibility.

## Source receipts

Retrieved on 2026-10-15; quotations were matched mechanically to the retrieved
text. These receipts support capability and input interpretation, not admission
of a new regulatory layer.

| Source and location | Located evidence | SHA-256 of retrieved bytes |
| --- | --- | --- |
| [iDOG README at the pinned commit](https://raw.githubusercontent.com/jayman1466/iDOG/9d71187f0b2eb27ee681918927e12850470a0688/README.md), Getting Started / prerequisites | “local command line versions of the RBS generator and Codon Optimizer” | `f38ab3f7e4b9f75627adb9dae8464f2dc46a19ef3d66690639fe4380042ad554` |
| [iDOG LICENSE](https://raw.githubusercontent.com/jayman1466/iDOG/9d71187f0b2eb27ee681918927e12850470a0688/LICENSE), first line | “MIT License” | `85e80ab312d3bd0d8eef956d8dff361db48ca0ce178b3ff9257adc286d1a200f` |
| [Patel et al. 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC10619838/), Figure 3A and data/code availability | “controlled by T7 promoters in prokaryotes and minipromoters in yeast”; “Code used in this study can be found at” precedes the iDOG URL | `86d9c83535a6c2eed684b8de13db5c45876e7987bfd2460f4b5a960c5ce57d96` |
| [Tan et al. 2018 XML](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6091082/fullTextXML), Results / Figure 1 | “4808 TSSs, including 2475 gTSSs” and “at least one of the tested culture conditions” | `7063969b6577a330390269bec64df5f22c696203239257cb06fc21ef5148f7d8` |

The Patel Europe PMC XML endpoint returned HTTP 500; the public PMC article
served its text directly. No login, challenge solving or access workaround was
used. This paper exists and is relevant to design capability; it does not fill
the native promoter-location validation gap.
