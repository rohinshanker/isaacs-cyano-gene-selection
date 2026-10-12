# O_recoded-genome-functional-annotations__20261012 — Open

Scope: Add missing functional annotations to recoded-scheme genomes from the corresponding nonrecoded genome.
Status: open
Opened: 2026-10-12
Updated: 2026-10-12

## Current State

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

## Verification

Pending implementation: independent crosswalk checks; exact/preserved-protein,
ambiguous, absent and altered-gene fixtures; regression tests for existing target
annotations and all affected organisms; rendered search/filter/colour/detail
checks; required repository and release gates.

## Cleanup

Remain open until an implementation owner claims it. Preserve reusable join,
provenance and release checks in docs/validation before resolving; delete the
resolved ticket last. Do not absorb another session's active recoded-data work.
