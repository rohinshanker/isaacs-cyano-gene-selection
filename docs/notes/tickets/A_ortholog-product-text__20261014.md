# A_ortholog-product-text__20261014 — Active

Scope: Resolve BIO-06 by decoding escaped commas when reading the pinned ortholog evidence table, without modifying its original bytes or admitting a browser layer.
Status: active
Opened: 2026-10-14
Updated: 2026-10-14

## Current State

Owned by **cyano-regulatory-sites**, isolated from the annotation-search and
public-deployment-check sessions. This bounded correction is split from
[BioCyc annotations](O_biocyc-ortholog-annotations__20261014.md), which remains
open for its separate access, source, join and admission dependencies.

**BIO-06 — open:** 46 of the 2,715 product values retain GFF `%2C` escapes.
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

Pending implementation, focused tests, full repository gates and coordinator
review of the exact patch. No visible UI change is intended.

## Cleanup

Closing session must list findings and final checks, distill reusable reader and
integrity guidance into the BioCyc contract, rename to resolved, remove this row
from the live queue, and delete the resolved ticket last. Preserve the parent
BioCyc ticket and the original returned evidence.
