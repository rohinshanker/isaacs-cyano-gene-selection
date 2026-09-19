# A_data-annotation-release-readiness__20260918 — Active

- **Scope**: `isaacs-cyano-gene-selection` after the pipeline and site work in
  `A_gene-diversity-site__20260918.md` is integrated.
- **Status**: active
- **Opened**: 2026-09-18
- **Updated**: 2026-09-18

## Current State

`main` at `26e4d586b40a765a9623248ec52f2b9c675ed586` is a strong data and
contract scaffold, not yet a working application. It has the verified genome,
expression fallback, tRNA table, contract, validator, and Pages workflow, but no
tracked pipeline, generated JSON, tests, or browser page. Those implementation
streams are active in separate worktrees and must not be duplicated here.

The authoritative genome is RefSeq `GCF_000817325.1` (ASM81732v1), taxid
1350461. The checked-in raw inputs use NCBI RefSeq annotation release
`GCF_000817325.1-RS_2026_05_13` (PGAP 6.11, 2026-05-13), but that annotation
release is not yet frozen explicitly in the contract. Nine required downloads
match NCBI's MD5 manifest. The manifest also lists richer files that have not
been acquired, including the GO annotation, protein GenPept, annotation hashes,
assembly statistics, and feature counts.

The current expression overlay contains 2,551 unique, finite, non-negative
values from PCC 7942, not UTEX 2973. An independent reconstruction using the
current PCC 7942 GFF reproduced all 2,551 retained mappings exactly through
`old_locus_tag -> locus_tag -> protein_id -> M744_RS locus_tag`. This means
`data/expression/PROVENANCE.md` lines 73–76 are stale: the current PCC GFF does
carry the `Synpcc7942_####` old locus tags. The eight ambiguous duplicated-
protein loci remain correctly excluded. There is still no public tidy per-gene
UTEX 2973 abundance matrix; PRJNA420395 provides the biologically matched raw
dRNA-seq/TSS resources and would require a separate quantification workflow.

### Coordinator disposition of the blocking findings, 2026-09-18

| # | Finding | Status |
| --- | --- | --- |
| 1 | Terminal stop not recoverable | **Fixed** in contract `138508e`. `terminalStop`, `translationalException`, and `cdsSegments` added, with denominator and position-zero rules stated. Both agents notified mid-run. |
| 2 | Validator's protein check was fake | **Fixed** in `d612b69`. Real translation against `protein_id`, plus an assertion that the four dual-locus proteins appear for both loci. All 2,715 genes pass. |
| 3 | Contiguity assertion wrong for `prfB` | **Fixed** in `7ec46af`. The three spliced CDSs are exempted and named. |
| 4 | Contract said 2,711 and used an excluded pseudogene as its example | **Fixed** in `138508e`. Corrected to 2,715 and to `M744_RS11720` (`rpsL`) with measured values. |
| 5 | Pages workflow had no gate | **Fixed** in `d612b69`. Deployment now needs genome checksum verification, an explicit organism-identity check, contract validation, and the test suite. |
| 6 | Expression provenance stale about `old_locus_tag` | **Conceded and fixed.** The reviewer was right; see the paragraph below. `PROVENANCE.md` now documents the verified gene-level route and the full 2,551-row reproduction. |

**Finding 5 is correct, and an earlier revision of this section wrongly disputed it.**
That dispute was based on a parse that filtered to `CDS` features. `old_locus_tag`
appears only on gene-level features, so the check returned zero and the wrong
conclusion followed. `GCF_000012525.1` does carry `old_locus_tag=Synpcc7942_####` on
2,670 gene features and 4 pseudogene features.

Re-running the verification through the correct route reproduced **all 2,551 shipped
mappings exactly, with zero contradictions and none unreproduced**, matching the
reviewer's result. `data/expression/PROVENANCE.md` now documents that route.

One related trap is recorded there: `prfB` (`M744_RS00920`) has a joined CDS, so the
GFF emits two CDS rows sharing one `protein_id` and one `locus_tag`. Testing
uniqueness by row count rather than by distinct locus tag makes that protein look
ambiguous and silently drops the gene. Exactly four proteins are genuinely ambiguous.

### Blocking review findings

1. The data contract removes each terminal stop from `genes.json.codons` while
   also defining stop-codon replacement such as `TAG -> TAA`. The browser cannot
   recover a gene's terminal stop, count stop-target burden, or reconstruct the
   full recoded CDS. The included set contains 1,071 TAG-, 895 TAA-, and 749
   TGA-ending genes, so this is not an edge case.
2. `tools/validate_contract.py` does not perform its claimed protein comparison.
   It reads `protein.faa.gz` and checks only that records exist. It also validates
   reconciliation by counts rather than independently deriving the exact included
   and excluded locus-tag sets, accepts malformed/duplicated metadata structures,
   and skips required raw-data checks when inputs are absent.
3. The validator's contiguous coordinate assertion is wrong for the genuine
   programmed-frame-shift gene `prfB` (`M744_RS00920`), whose CDS is
   `join(169621..169692,169694..170743)`. The delivered pipeline candidate's 18
   tests pass, but the independent validator fails this record.
4. The frozen contract gives `meta.geneCount` as 2,711 even though the required
   included set is 2,715, and its example gene `M744_RS03825` is one of the seven
   excluded pseudogenes.
5. The Pages workflow uploads `site/` without a build, contract validation, test,
   or rendered-UI gate. The public GitHub repository currently has no remote
   branch and Pages is disabled, so no deployment exists yet.

## TypeSafe candidates in this repository

Standing policy is to prefer TypeSafe's System One model (Jev) over frontier-model
credits for bounded semantic judgments. See the "TypeSafe First for Bounded Judgments"
section of the global working policy at `~/.codex/AGENTS.md`.

**Blocked:** no API key, SDK, or MCP server exists on this machine, so nothing below
can run yet. The skill is documentation only.

Two places here qualify, and the first fixes a defect the review already found.

### 1. CAI reference-set selection (`scripts/build_features.py:49-67`)

The reference set is chosen by substring matching on product names, with a hand-patched
exclusion: `"ribosomal protein" in product and "transferase" not in product`. That
carve-out is the tell. The independent review found **two substring false positives**
in the resulting 71-gene set, and false positives here shift CAI for every gene, since
CAI is measured against this reference.

This is a judgment pretending to be a rule. A Noul question, "is this product a
ribosomal protein or a highly expressed housekeeping protein suitable for a CAI
reference set", returns a calibrated probability per product with an explicit
no-match outcome, and the threshold can be set on inspected data rather than guessed.

### 2. Functional category and pathway annotation

The original handoff asks for functional category and pathway as colouring dimensions,
and they remain unimplemented. A Choice question over a defined category set covers it.

Note that **394 genes, 14.5 percent, are annotated "hypothetical protein"** and carry
no information to classify. The category set needs an explicit unknown outcome, and the
site must not let an unknown masquerade as a category.

### Cost

| Measure | Value |
| --- | --- |
| Distinct product strings | 1,768 |
| Approximate tokens across them | 8,200 |
| Jev input pricing | $42 per billion tokens, output free |

Even allowing generous per-question overhead across all 1,768 products, both jobs
together cost well under one cent. Neither needs a frontier model.

Validate before adopting: hand-check a sample against the current substring result,
record the threshold and its evidence, and keep the raw probabilities so a threshold
change does not require rerunning inference.

## Next Steps

### P0 — Make the existing contract lossless and testable

- Preserve the terminal stop per gene, either in the packed sequence or a required
  `terminalStop` field. Define whether burden/fraction denominators include it and
  test full-CDS reconstruction for TAG, TAA, and TGA targets.
- Define initiation-codon semantics. Alternative bacterial starts must translate as
  methionine at position zero even though the same triplet has its standard internal
  amino-acid meaning.
- Represent discontinuous CDSs or translational exceptions explicitly. At minimum,
  carry CDS segments and the `ribosomal_slippage`/programmed-frameshift flag for
  `M744_RS00920`; never make genomic span equal coding length by silently changing
  the coordinates.
- Correct the 2,711/2,715 contract example and replace the pseudogene example with
  an included locus.
- Turn the protein gate into a real check: join each locus to `protein_id`, translate
  its reconstructed CDS with table 11, compare the sequence, and handle the four
  protein accessions shared by two loci without deduplicating genes.
- Add negative validator tests for duplicate RSCU codons, invalid/self/unknown
  replacement maps, duplicate or unknown CAI reference loci, invented exclusions,
  malformed arrays, missing raw inputs, stale checksums, and expression provenance.

### P1 — Freeze and reproduce the annotation layer

- Record assembly accession, RefSeq annotation name/date, PGAP version, retrieval
  date, direct URL, byte size, and MD5 for every input in a machine-readable
  manifest. Fail builds if the release or checksum changes unexpectedly.
- Download and assess the remaining files in the current NCBI directory, especially
  `annotation_hashes.txt`, `gene_ontology.gaf.gz`, `protein.gpff.gz`,
  `feature_count.txt`, and `assembly_stats.txt`. Keep only inputs that feed a
  documented feature or validation gate.
- Generate a versioned identifier crosswalk with one row per relationship, not one
  row per assumed gene: current and old UTEX locus tags, gene symbol, `protein_id`,
  sequence accession, coordinates/CDS segments, PCC 7942 ortholog, and any accepted
  UniProt/KEGG identifier. Preserve one-to-many mappings and label ambiguity.
- Parse and expose annotation evidence that changes recoding risk: pseudogene/partial
  flags, ribosomal slippage, overlapping CDSs, nearby non-coding RNAs, plasmid versus
  chromosome, and annotation confidence/inference.

Primary sources:

- [NCBI assembly and annotation](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_000817325.1/)
- [NCBI assembly file directory](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/817/325/GCF_000817325.1_ASM81732v1/)
- [UniProt UTEX 2973 proteome candidate](https://www.uniprot.org/proteomes/UP000031358)

### P2 — Replace heuristic biological context with evidence where available

- Import GO terms from the matching RefSeq release and assess EC/pathway coverage.
  Store source, evidence code, release, and mapping method; do not collapse conflicting
  annotations into an unqualified label.
- Evaluate the PCC 7942 genome-wide essentiality dataset as a cross-strain annotation.
  Map by the versioned crosswalk, retain essential/beneficial/unknown evidence and
  coverage, and label it as PCC 7942 rather than UTEX 2973. Essentiality should be a
  caution/selection feature, not an automatic exclusion without a lab decision.
- Use the UTEX 2973 primary-transcriptome study for TSS and transcription-unit evidence.
  Keep experimentally supported units separate from distance-inferred operons and show
  method/confidence in the UI.
- Evaluate CyanoOmicsDB only as a secondary discovery/cross-check source. Never replace
  the frozen RefSeq coordinate model without a documented reconciliation.

Primary references:

- [UTEX 2973 primary transcriptome (Tan et al. 2018)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6091082/)
- [PRJNA420395 raw UTEX 2973 sequencing](https://www.ncbi.nlm.nih.gov/bioproject/PRJNA420395)
- [PCC 7942 essential gene set (Rubin et al. 2015)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4672817/)
- [CyanoOmicsDB resource paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC8728175/)

### P3 — Make abundance data replaceable without losing provenance

- Check in a reproducible PCC 7942 mapping script or generated crosswalk, source-file
  checksum, exact sample IDs, averaging rule, and an exclusion ledger that accounts for
  all 164 missing target genes. Correct the stale provenance statement.
- Replace the implicit "drop a TSV in the directory" rule with an explicit selected
  dataset manifest. It must name organism/strain, annotation release, assay, sample IDs,
  condition, replicates, units/normalization, source URL/checksum, mapping artifact, and
  licence/redistribution status. The build must reject multiple unselected datasets or
  metadata that do not match the table.
- Keep GSE205444 opt-in, visibly labelled PCC 7942, and include unmeasured genes by
  default. Do not treat DESeq2 normalized counts as comparable across unrelated studies.
- If native UTEX abundance is required, scope a separate alignment/quantification task
  for PRJNA420395 or obtain new RNA-seq/Ribo-seq/proteomics under the lab's intended
  light, temperature, CO2, and growth-phase conditions. Preserve condition-specific
  values rather than presenting a pooled universal expression score.

Current fallback source:

- [GSE205444 processed PCC 7942 expression](https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE205444)

### P4 — Integrate and release only behind gates

- Integrate the pipeline and site only after their exact final commits receive the
  planned cross-provider reviews. Re-run all tests and the hardened validator on the
  merged tree.
- Add CI that installs the recorded environment, runs unit/integration/negative tests,
  builds or verifies generated data, runs the independent validator with raw fixtures,
  and only then uploads the Pages artifact.
- Render and inspect the real site at desktop and narrow viewports. Verify stop-codon
  presets, expression warnings, missing-data controls, annotation evidence labels,
  filtering, shortlist comparisons, URL/local-storage round trips, accessibility, and
  the published performance budgets.
- Decide whether `file://` is truly supported. Test it in the target browsers; if JSON
  fetches or ES modules require HTTP, remove the local-file promise and document a
  one-command local static server.
- Push `main`, enable GitHub Pages, and run a post-deploy smoke test only with explicit
  user authorization.

## Verification

This ticket is complete when all of the following hold:

- The merged repository rebuilds from checksum-verified, release-pinned inputs and all
  tests, the independent validator, and rendered UI checks pass.
- Exactly 2,715 included and seven excluded unique locus tags reconcile to the raw CDS
  set; full CDSs including terminal stops reconstruct and translate correctly.
- Programmed frameshifts and other annotation exceptions are represented and tested.
- Every external annotation reports source organism, release, evidence, mapping method,
  coverage, ambiguity, and unmatched counts. One-to-many mappings are never silently
  collapsed.
- The expression overlay is reproducible from its source matrix and manifest, all 164
  missing values have an accounted reason, and the UI cannot imply it is UTEX data.
- Pages deploys only after automated gates pass, and the deployed application receives
  a recorded smoke test.

## Cleanup

When resolved, move reusable source-manifest, identifier-crosswalk, annotation-evidence,
expression-import, and release-gate procedures into `docs/validation/`, update its
index, remove this ticket from the live queue, and delete the resolved ticket. Do not
retain downloaded working files or one-off audit output.
