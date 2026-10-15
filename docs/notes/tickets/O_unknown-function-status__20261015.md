# O_unknown-function-status__20261015 — Open

Scope: Extend the D10 unknown-function label so DUF/UPF products are labelled, and settle how partially characterised products are shown.
Status: open
Opened: 2026-10-15
Updated: 2026-10-15

## Current State

Opened by the owner, 2026-10-15, after a review found the D10 rule too narrow.
`hasUnknownFunction` in `site/js/core/annotation-records.js` labels only exact
"hypothetical protein" and "uncharacterized protein" forms. CDSs named for a
domain of unknown function (DUF) or an uncharacterized protein family (UPF) go
unlabelled, so their silence reads as "function known". Measured on the shipped
products, 2026-10-15:

| Organism | CDSs | Labelled | Unlabelled DUF/UPF |
| --- | --- | --- | --- |
| UTEX 2973 | 2,715 | 394 | 153 |
| E. coli K-12 MG1655 | 4,287 | 107 | 230 |
| E. coli DH10B | 4,227 | 42 | 149 |
| E. coli MDS42 | 3,586 | 93 | 129 |
| Syn57 design | 3,588 | 62 | 170 |
| Syn61 | 3,549 | 31 | 124 |

No shipped product uses the phrase "of unknown function"; no other hypothetical
or uncharacterized form is missed. A further grey zone names only a domain or
family ("helix-turn-helix domain-containing protein", "cupin domain-containing
protein", "TIGR... family protein"): neither known nor unknown.

The label appears in search results, side panel, gene viewer, sequence view,
shortlist, compare and panel designer. Contract:
[Noncoding genes and pseudogenes in search](../../validation/viewer-interaction-state.md#noncoding-genes-and-pseudogenes-in-search).

## Plan

1. **DUF/UPF — no owner decision needed.** Label DUF and UPF products as
   unknown function; both are formal unknown-function designations, so this
   stays an exact rule. Update the per-organism counts in
   `tests/js/annotation-records.test.mjs`, which currently asserts DUF names
   are unlabelled.
2. **Cross-check — no owner decision needed.** Test and report disagreements
   between this label and UTEX's reviewed "Unknown or unclassified" function
   category (1,351 genes); show disagreements, do not hide them.
3. **Owner decision required before work.** A third state, "domain or family
   only", and a status shown for every CDS rather than a label on some.
4. **After 3.** Classify product names with TypeSafe Jev (unknown / domain or
   family only / named / unclear) once per pipeline release, shipped as a
   per-gene field; exact rules stay for controlled forms. Score against a
   hand-labelled sample per organism and record the evaluation with the field.
   Add the status to the export.

## Acceptance Criteria

- DUF/UPF CDSs carry the unknown-function note everywhere the note appears;
  per-organism counts are asserted.
- The category cross-check reports its counts in a test.
- Steps 3 and 4 proceed only after the owner settles the states; otherwise
  they are recorded as declined.
- Rendered check of the note in each surface; gates pass; the contract section
  is updated.

## Verification

Counts above came from a read-only scan of the shipped products. Nothing
implemented yet.

## Cleanup

Distill the final rule into `viewer-interaction-state.md`, then delete this
ticket and its index row.
