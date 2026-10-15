# R_ortholog-product-text__20261014 — Resolved

Scope: Resolve BIO-06 by decoding escaped commas when reading the pinned ortholog evidence table, without modifying its original bytes or admitting a browser layer.
Status: resolved
Opened: 2026-10-14
Updated: 2026-10-14

## Outcome

Owned by **cyano-regulatory-sites**, isolated from the annotation-search and
public-deployment-check sessions. This bounded correction is split from
[BioCyc annotations](O_biocyc-ortholog-annotations__20261014.md), which remains
open for its separate access, source, join and admission dependencies.

**BIO-06 — resolved by `3c5fac8`:** 46 of the 2,715 product values retain GFF `%2C` escapes.
Use-time decoding is already specified by the
[BioCyc contract](../../validation/biocyc-annotations.md). Keep the frozen
returned table and its checksum unchanged. Decode only encoded commas in the
product column, once; preserve every other field, row order and literal plus.

## Acceptance Criteria

- A small reusable reader/CLI reads the pinned table with explicit integrity and
  schema checks, returns decoded product text and retains access to original text.
- A complete export path writes a corrected derivative without overwriting the
  source; no locus join, inferred annotation or browser admission occurs.
- Real-table regression verifies all 46 changes and every untouched cell;
  synthetic cases cover unchanged text, literal plus, escaped percent, malformed
  rows and identifiers, source checksum mismatch and output safety.
- Record this engineering decision and resolve BIO-06 in the parent ticket and
  current blocker register without changing other findings.

## Verification

Multica DEM-418 implemented `ac50f4b`, integrated as `3c5fac8`. Coordinator
`cyano-regulatory-sites` reviewed both files independently and found no remaining
implementation defect. All 37 focused tests pass. An independent byte-level
export check confirms exactly 46 comma substitutions, every other byte unchanged,
and all 2,715 decoded products equal the existing native gene product strings.
The source still has SHA-256
`e49f7d8f7d328cfc3b7e4e9f50c4a802f450f32cbc782b8fd9428eb3a01ec861`.

JavaScript gate: 1,635 passed. Contract gate: 130 passed, zero failed, one
declared spliced-CDS exemption. First full Python gate: 2,262 passed, 14 skipped,
51 subtests passed. Main's independent deployment-check work was merged in
`496423e`; the merged Python gate passed: 2,311 tests, 14 skipped and 51
subtests passed. JavaScript, release datasets and
the contract validator are identical before and after that merge. No visible
UI or release dataset changed.

## Cleanup

Closing session must list findings and final checks, distill reusable reader and
integrity guidance into the BioCyc contract, rename to resolved, remove this row
from the live queue, and delete the resolved ticket last. Preserve the parent
BioCyc ticket and the original returned evidence.

## Closure

Closed by **cyano-regulatory-sites** on **2026-10-14**. **BIO-06 is resolved by
`3c5fac8`**, independently reviewed by the coordinator against the source bytes
and exported derivative. No finding against this bounded correction remains
open. The parent BioCyc ticket remains open and retains BIO-01/02/03/05 and its
separate access, assembly, source and join dependencies.

The BioCyc validation contract contains the reusable source pin, one-pass
product-only decode rule, API/CLI usage, export digest and regression checks.
The parent ticket and current intake disposition point there. The original
returned table, all original audit observations, and every other intake row
remain unchanged. No information needed for future use lives only in this
ticket. Remove its index row, then delete the resolved ticket as the last step.
