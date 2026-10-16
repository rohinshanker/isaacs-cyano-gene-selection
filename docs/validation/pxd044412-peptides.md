# PXD044412 analyzed-peptide reader

`tools/pxd044412_peptides.py` reads the authors' PCC 7942 Supplementary Data S3
from [Sporre et al. (2023)](https://doi.org/10.1038/s42003-023-05318-8).
It preserves analyzed peptide comparisons and derives conservative summaries
for source proteins. It does not admit a browser layer, infer UTEX coordinates,
reconstruct MSstats, or reinterpret these values as protein abundance.

## Input and source pins

The paper links [Figshare Supplemental Datasets v1](https://doi.org/10.6084/m9.figshare.23939604.v1).
S3 is file `41985861`, “S3. Detected peptides in all experiments with Synechococcus
PCC7942.tsv”: **395,211,418 bytes**, SHA-256
`c6cb4794f0a1ff854899b83ddec2ebbef20577387c262b279a6f2519be9a06b5`.
The full download also matches Figshare's MD5. The dataset metadata declares
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); this is separate from the PRIDE archive's CC0 grant. Attribute the
article and versioned dataset, identify the derived summary, and retain the
licence link. Full inputs and generated exports are not committed.

[Source receipts](../../data/audits/pxd044412/source-manifest.json) retain the
artifact and metadata hashes, UTC retrieval times, article quote locations and
pinned author-code revisions. Direct reads verified the paper's technical-replicate
and significance descriptions. The author code illustrates its conventions;
its configured example is not an execution receipt for the entire deposited S3.

The PRIDE listing has 2,002 unique entries over 21 pages, including seven
`quant_report_7942_20210329_*.elib.peptides.txt` intensity reports. Those are not the
reader's input. S3 provides **42 literal comparison labels over 21 metabolites**,
with already analyzed fold changes and adjusted p-values. A filename shortlist
of the seven PRIDE arms therefore understates the available analyzed evidence.

## Preservation and evidence semantics

The input has 38 exact headers. The reader verifies the checksum before exposing
values, streams rows, and preserves every parsed cell string and its source-row
reference. Alternative pins through the Python API require separate source/format
review; the CLI accepts only this pinned version. Annotations and identifiers remain source evidence. In particular,
`Entry` and ordered-locus text are not independently validated UTEX joins.

Numeric zero stays numeric. Missing or invalid statistical cells remain explicit;
they cannot become zero, a valid p-value, or negative interaction evidence.
The source `Sign` label is retained separately from the strict adjusted-p
comparison (`adj.pvalue < 0.01`), with disagreement visible. Literal `Label`
values are not converted into unverified molar concentrations. `BioReplicate`
is retained verbatim; its constant value of `1` does not establish a biological
replicate count. The source field `MissingPercentage` is not rescaled: observed
values range from 0 to 0.25, while `ImputationPercentage` is 0 in this pinned file.

All 391,900 source `issue` cells are `NA`, and no statistic is unavailable or
nonfinite. S3 therefore cannot assess one-condition-missing comparisons omitted
upstream; a negative summary does not rule out that evidence. The pinned author script
`ms_analysis_20220405.R:188` removes infinite fold changes before export, a plausible
explanation for this omission, not a verified account of how S3 was produced.

Summaries use each observed source `Entry`/`Label` pair separately:

| State | Meaning |
| --- | --- |
| `significant_peptide_evidence` | At least one evaluable, unambiguous peptide meets the source significance rule. This is LiP-SMap evidence, not confirmed binding. |
| `no_significant_peptide_evidence` | There are evaluable, unambiguous peptides and none meets that rule; the statement applies only to evaluated evidence. |
| `not_evaluated` | No evaluable unambiguous peptide supports a unique-protein assessment, including groups containing only ambiguous assignments. |

`ambig=yes` rows remain in the lossless export but cannot support unique-protein
calls. This restriction makes the summary deliberately more conservative than
counting every expanded author assignment. No fold changes are averaged or
maximized into a protein measurement, no different comparisons are pooled, and
unobserved protein/comparison pairs are not fabricated as zero rows. Counts,
peptide identities, source rows and flags preserve the route to each result.
All outputs declare `releaseEligible: false`.

## Reproduce and inspect

Stage the exact source under the ignored `data/interim/` tree, then run:

```sh
.venv/bin/python tools/pxd044412_peptides.py \
  --input data/interim/pxd044412/S3-pcc7942.tsv \
  --output-dir data/interim/pxd044412/reader-output
```

Use a new output directory. `rows.jsonl.gz` preserves parsed source cells;
`summary.json` records the pin, method, audit counts and protein/comparison
summaries. The reader refuses existing output destinations and does not leave a
successful-looking bundle after checksum or parsing failure.

The [independent native audit](../../data/audits/pxd044412/native-summary.json)
pins these whole-file checks, derived separately from the reader:

| Check | Expected |
| --- | ---: |
| Source rows / distinct source entries / peptide strings | 391,900 / 2,148 / 18,641 |
| Comparison labels / observed protein-comparison pairs | 42 / 67,276 |
| Ambiguous rows / author-significant ambiguous rows | 4,494 / 70 |
| Author-significant rows / unambiguous significant rows | 7,012 / 6,942 |
| Significant / evaluated without significance / not evaluated groups | 3,830 / 63,152 / 294 |
| Source Sign/adjusted-p disagreements / duplicate evidence keys | 0 / 0 |

Recheck each per-label count as well as these totals. Audit examples include
`P11004/FBP_1` (14 evaluated peptides, none significant), `Q31L13/FBP_2` (22
peptides, three significant), and `Q9KHA8/FBP_1` (eight ambiguous rows, not
evaluated for unique-protein evidence). These are source comparisons, not counts
of confirmed interactions or UTEX genes.

## Admission boundary

The owner approved a separate interaction evidence type (D11). Browser admission
still needs the source-specific condition record, identity/crosswalk validation,
review of excluded/ambiguous evidence, a distinct interaction quantity and
missingness presentation, citations/terms, and rendered checks. The reader
performs none of those approvals. The [data-sources ticket](../notes/tickets/O_data-sources-selection__20261005.md)
retains that work; the existing [admission contract](future-data-roadmap.md#admission-contract)
and [measurement contract](measured-quantity-contract.md) continue to apply.
