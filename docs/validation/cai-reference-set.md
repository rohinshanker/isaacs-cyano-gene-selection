# CAI reference-set selection and semantic audit

The published CAI values use a fixed 71-locus reference set selected from the
current 2,715-gene release. This is a reproducible codon-usage convention, not a
measurement or proof of high expression.

## Deterministic selection contract

`scripts/build_features.py:is_cai_reference` lowercases the RefSeq product and
selects it when either condition holds:

- it contains `ribosomal protein` but not `transferase`; or
- it contains one of `translation elongation factor`, `translation initiation
  factor`, `translation termination factor`, `chaperonin`, `DNA-directed RNA
  polymerase subunit`, or `ATP synthase subunit`.

The rule produces 71 references: 53 ribosomal proteins, two matched translation
elongation factors, four initiation factors, no matched termination factors, two
chaperonins, three RNA-polymerase subunits, and seven ATP-synthase subunits. The
published locus list exactly reproduces that result. The build requires at least
30 references and then derives Sharp–Li relative-adaptiveness weights from their
CDSs.

## TypeSafe/Jev audit

On 2026-09-19, every product annotation was independently classified through the
TypeSafe System One HTTP API with pinned model `jev-1.13.0`. Each of the 2,715
requests contained only `{locus_tag, gene_symbol, product}`. The deterministic
selection and rule reason were held back until inference was complete.

The Choice labels were the seven categories above plus:

- `no_match` for an explicitly different or accessory/modifying/regulatory
  protein; and
- `insufficient_evidence` for a hypothetical, generic, truncated, or ambiguous
  annotation.

Definitions explicitly excluded ribosome assembly, maturation, binding,
silencing, and modifying factors; release-factor modifiers; sigma factors;
co-chaperonins and unrelated chaperones; ATPases outside ATP synthase; and other
accessory proteins. One candidate was sent per request. A superseded pilot that
placed 30 unrelated annotations in shared state produced cross-record
contamination, so multi-record state must not be reused for this judgment.

Reproducibility identifiers:

| Item | Value |
| --- | --- |
| Model | `jev-1.13.0` requested and returned for 2,715/2,715 calls |
| Inventory SHA-256 | `1b8fb871a3293f5687d4fbdff611db0b11fa0a026ff84c2c065a53f6bcd7e08c` |
| Blinded candidates SHA-256 | `c9dc172007e07df51a6e15e4c0a8d67326d45bc862e188afd184a66e32589304` |
| Rubric version / SHA-256 | `2026-09-19.1` / `319cc22b858b2fa9bacea2ba46f6de0dcc2fb43620e460625c3cc8f3402b2b9e` |
| Predeclared labels SHA-256 | `2e9d1cdbec0c53651d792d13042de33d8e4d0a156d1be2028c452415b3edf34e` |

The frozen rubric, predeclared evaluation labels, run manifest, consolidated
2,715-result JSONL, summary, and disagreement review are retained in
[`data/audits/cai-reference-set/`](../../data/audits/cai-reference-set/README.md).
Raw HTTP envelopes are intentionally omitted; they add 23 MB of duplicated
transport data and contain no additional decision-relevant fields beyond the
retained blinded contract and typed results.

All 2,715 typed responses passed schema, probability, ordering, input-hash,
blinding, and credential-leak checks. The predeclared 28-case evaluation set had
28 exact label matches and 28 binary membership matches. That set contains clear
positive, negative, and insufficient-evidence examples selected before the final
run; it is a software validation sample, not an independent biological ground
truth.

## Disagreement review

Jev and the deterministic membership agreed for 2,704 genes. The 11 differences
were reviewed against the frozen semantic rubric:

| Locus | Product | Jev result | Review disposition |
| --- | --- | --- | --- |
| `M744_RS00920` | peptide chain release factor 2 | add: termination factor | Rubric-consistent nomenclature miss |
| `M744_RS01275` | ATP synthase F1 subunit delta | add: ATP synthase | Rubric-consistent word-order miss |
| `M744_RS01290` | ATP synthase F0 subunit C | add: ATP synthase | Rubric-consistent word-order miss |
| `M744_RS03255` | elongation factor P | add: elongation factor | Rubric-consistent missing `translation` synonym |
| `M744_RS04290` | peptide chain release factor 3 | add: termination factor | Rubric-consistent nomenclature miss |
| `M744_RS04390` | 30S ribosomal protein PSRP-3 | remove: `no_match` | Keep; the annotation explicitly says ribosomal protein and the model result was weak (`p=0.51`, confidence `0.44`) |
| `M744_RS04530` | ATP synthase F1 subunit epsilon | add: ATP synthase | Rubric-consistent word-order miss |
| `M744_RS05110` | peptide chain release factor 1 | add: termination factor | Rubric-consistent nomenclature miss |
| `M744_RS05740` | elongation factor G | add: elongation factor | Rubric-consistent missing `translation` synonym |
| `M744_RS11730` | elongation factor G | add: elongation factor | Rubric-consistent missing `translation` synonym |
| `M744_RS11735` | elongation factor Tu | add: elongation factor | Rubric-consistent missing `translation` synonym |

The ten additions show that substring matching is not a complete semantic
classifier. They do not establish that those proteins belong in a high-expression
CAI reference. Conversely, the low-confidence exclusion does not justify removing
an explicitly annotated ribosomal protein.

## Release decision

Keep the 71-locus set unchanged for this release. Automatic membership changes
are disabled: there is no probability threshold at which Jev output mutates the
reference set. A `0.8` declared-choice probability and confidence cutoff was used
only to broaden the human review queue, never to accept a change. Every membership
disagreement is review-required regardless of probability.

A future change needs an independently curated biological reference policy and
held-out evaluation by product family. Freeze the accepted locus manifest, then
rebuild all CAI weights, gene values, high-expression replacements, proxy ranks,
and downstream panels, and rerun the complete contract and rendered-browser gates.
TypeSafe remains appropriate for semantic review; exact joins, membership,
arithmetic, and release admission remain deterministic code and human decisions.
