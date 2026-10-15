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

## Owner Decisions, 2026-10-15

- **Three states:** function unknown; domain or family known, role unclear;
  named. Labels read "Function unknown" and "Domain or family known; role
  unclear".
- **Only non-named genes are labelled;** no label means named.
- **DUF/UPF are unknown.** A family name that names an activity
  ("recombinase family protein") is named; uninformative families are
  domain-only.
- **Surfaces:** all seven current ones, plus a function-status filter in the
  custom filters panel.
- **Jev classification is acceptable on the site, disclosed as model-assigned.**
  Below the confidence threshold the exact rules decide, but the gene's Jev
  ranking and its confidence are still shown.
- **Evaluation:** an agent labels a stratified sample of about 200 product names
  per organism; the owner spot-checks disagreements.
- **UTEX reviewed category:** when it disagrees with this label, show both and
  note the disagreement in the gene panel; a test reports the counts.
- **Jev labels are a committed file, not regenerated each release.** Rerun
  Jev only on purpose; builds do not need the TypeSafe key.
- **TypeSafe budget:** do not fully deplete the monthly TypeSafe limit. If a
  limit is reached, stop, record progress here, and finish the run later
  rather than dropping or approximating the remaining names.

## Plan

1. Exact rule: DUF/UPF as unknown; update `tests/js/annotation-records.test.mjs`
   per-organism counts.
2. Jev classifier over product names (unknown / domain or family only / named /
   unclear) with a per-gene label, ranking and confidence; exact rules decide
   below the threshold. Record the evaluation against the labelled sample and
   set the threshold from it.
3. Three-state labels in the seven surfaces with the model-assigned disclosure,
   the filter, an export column, and the UTEX disagreement note and test.

## Acceptance Criteria

- DUF/UPF CDSs carry the unknown-function note everywhere the note appears;
  per-organism counts are asserted.
- The UTEX category cross-check reports its counts in a test.
- Jev evaluation recorded with the field; low-confidence genes show the Jev
  ranking and confidence alongside the exact-rule result.
- Filter and export column cover the three states.
- Rendered check of the note in each surface; gates pass; the contract section
  is updated.

## Verification

Counts above came from a read-only scan of the shipped products. Nothing
implemented yet.

## Cleanup

Distill the final rule into `viewer-interaction-state.md`, then delete this
ticket and its index row.
