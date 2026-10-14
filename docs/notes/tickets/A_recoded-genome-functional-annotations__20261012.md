# A_recoded-genome-functional-annotations__20261012 — Active

Scope: Add missing functional annotations to recoded-scheme genomes from the corresponding nonrecoded genome.
Status: active
Opened: 2026-10-12
Updated: 2026-10-14

## Current State

Claimed 2026-10-14 by cyano-lit-unreach (Agent Deck 80c81443-1791314087), which owns integration and closure. Work is isolated on work/recoded-functional-20261014, based on b4092f5; other sessions and the separately owned recoded multi-omics work remain untouched.

Requested by the owner while reviewing viewer disclosures. No existing ticket owns
this transfer; the recoded multi-omics ticket owns assay/clone and partial-genome
work, which remains separate. This ticket records future work, not an annotation
import or a claim that recoded gene function has been experimentally verified.

Inventory each shipped recoded genome, initially Syn57 and Syn61, and distinguish
missing gene products, gene symbols, functional categories and GO annotations
from annotations already supplied by its native source. Identify the exact
nonrecoded parental/reference release for each target before transferring values.

## Acceptance criteria

- Use a reproducible source-to-target locus crosswalk supported by source records
  and sequence correspondence. Synonymous recoding can preserve protein identity;
  gene names or shared coordinates alone are insufficient evidence for a join.
- Preserve existing target annotations. Transfer only missing supported fields;
  report disagreements, ambiguous/multiple matches, deleted genes, modified
  proteins and unmatched loci explicitly without silently assigning a function.
- Keep target genomic coordinates and native feature identity. Record source
  genome/release/locus, functional evidence, join method and transfer provenance.
  Inherited function is labelled as transferred annotation, not lab review or a
  measurement of the recoded strain.
- Expose admitted annotations consistently in gene detail, search, functional
  filters and colouring. Preserve source precedence and unknown states.
- Verify source access, attribution/licence and release integrity under the
  existing annotation admission contract before publishing any new layer.

## Source and implementation decisions

- Implementation: Multica DEM-401 in the separate
  `work/recoded-functional-impl-20261014` worktree; coordinator owns this ticket.
- Existing admitted MG1655 UniProtKB/GOA release is the annotation reference;
  exact parent-stock equivalence is not asserted. Source pins and fresh terms
  receipts are recorded in the handoff JSON linked from the source ledger.
- Baseline inventory: Syn57 has 3,588 included genes, no empty published names or
  products; Syn61 has 3,549, 46 empty published names and no empty published products. Neither has
  a rich annotation layer. MG1655 has curated function and evidence-coded GO,
  but no admitted broad reviewed categories. Those categories stay unknown.
- Independent packed-sequence check normalizes only bacterial initiation to M:
  reciprocal unique MG1655 protein matches cover 3,542 Syn57 and 3,234 Syn61
  genes. Eight/two target genes respectively have ambiguous exact matches;
  38/313 have no exact match. These are baseline checks, not released counts.

Native source refinement: Syn57 `yddH` and `iroK` have only `standard_name`,
without `gene` or `product` qualifiers; the published names and "uncharacterized
design CDS" products are builder fallbacks. Their absent fields must remain
separate from genuine native annotations. Native EC qualifiers occur on 1,432
plotted Syn57 and 1,411 plotted Syn61 genes (1,437/1,414 across all source CDSs).

Syn61 also carries structured `GO_function`/`GO_process`/`GO_component` records
inside CDS notes (1,698 source CDSs; 1,649 plotted genes and 3,985 plotted GO relationships), despite having no GO db_xrefs or dedicated
GO qualifiers. Preserve them as native computational annotation with source
provenance; do not overwrite them with reference GO. Syn57 source notes contain
no GO identifiers. Counts and admission are checked again on the final payload.

## Findings

Coordinator source/acceptance checks, pending final implementation:

| Id | Finding | Status |
| --- | --- | --- |
| RFA-01 | Functional filtering/colouring must select real inherited GO terms; detail/search or annotation-coverage colours alone do not satisfy the ticket. Negative, conflicting, ND and missing evidence remain distinct. | open |
| RFA-02 | Native EC qualifiers and structured GO annotations embedded in Syn61 GenBank notes must be preserved and inventoried separately from transferred GO. | open |
| RFA-03 | Syn57 `yddH`/`iroK` generated product placeholders must not be mistaken for a native product qualifier. | open |
| RFA-04 | A UniProt entry without function text must not be counted as an actual curated function statement. | open |

No independent final-patch audit has run yet; closure awaits that audit and
resolution of any findings it returns.

## Verification

Pending implementation: independent crosswalk checks; exact/preserved-protein,
ambiguous, absent and altered-gene fixtures; regression tests for existing target
annotations and all affected organisms; rendered search/filter/colour/detail
checks; required repository and release gates.

## Cleanup

The owning session will close this ticket after independent review and all acceptance checks. Preserve reusable join,
provenance and release checks in docs/validation before resolving; delete the
resolved ticket last. Do not absorb another session's active recoded-data work.
