# A_gene-diversity-site__20260918 — Active

- **Scope**: `isaacs-cyano-gene-selection` — genome feature pipeline and the interactive
  gene-diversity site published to GitHub Pages.
- **Status**: active
- **Opened**: 2026-09-18
- **Updated**: 2026-09-18

## Current State

Baseline established by the interactive coordinator:

- Genome downloaded and verified: RefSeq `GCF_000817325.1` (ASM81732v1),
  *Synechococcus elongatus* UTEX 2973, taxid 1350461. All nine downloaded files
  pass NCBI MD5. Total length 2,744,626 bp matches the assembly report exactly.
- Content validated: 2,715 protein-coding genes, 2,723 CDS features, 2,722 CDS
  sequences, 7 pseudogenes, 44 tRNA genes, 6 rRNA genes. One CDS is not a
  multiple of three and two carry internal stops; these are excluded by rule.
- Python 3.12 virtualenv at `.venv` with numpy 2.5.3, pandas 3.0.6, scipy 1.18.1,
  scikit-learn 1.9.1, biopython 1.88, umap-learn 0.5.12, ViennaRNA 2.7.2, pytest 9.1.1.
  ViennaRNA folding smoke-tested.
- Data contract frozen at `docs/validation/data-contract.md`.

### Decisions

- A recoding scheme is a **codon-to-codon map**, not a set of forbidden codons.
  Replacements prefill from genome-wide synonymous frequency and stay editable.
- Every target-dependent metric is computed in the browser from a packed codon
  string, so trying a new scheme never requires rerunning the pipeline.
- RNA folding is precomputed for wild type only. Recoded folding runs on demand
  for shortlisted candidate genes.
- All four optional feature blocks are in scope: 5′ folding energy, codon-pair
  scores, rare-codon runs, and genomic context.
- The candidate comparison panel ships all three views as tabs: z-scored radar,
  parallel coordinates, and pairwise delta.
- Expression data comes from a published dataset that must be located and
  validated against this annotation, not from CAI/tAI proxies.

### Work Streams

| Stream | Owner | Branch | State |
| --- | --- | --- | --- |
| Feature pipeline | `codex-implementer` | `feat/pipeline` | dispatched |
| Interactive site | `claude-implementer` | `feat/site` | dispatched |
| Expression dataset | `codex-scout` | read-only | dispatched |

Cross-provider review follows integration: `claude-reviewer` on the Codex
pipeline patch, `codex-reviewer` on the Claude site patch.

## Verification

Required before resolution:

- Pipeline unit tests cover every metric against hand-computed fixtures.
- ENC, CAI, tAI, and RSCU validated against an independent implementation on a
  sample of genes.
- Gene count assertion holds and `excluded.json` accounts for every dropped CDS.
- Site rendered and inspected per `ui-render-inspect-repair`, across routes,
  viewports, and states. Source inspection alone is not sufficient.
- Scheme round-trip: applying a map and reconstructing the protein yields the
  wild-type protein for every gene.

## Cleanup

On resolution, distil the reusable pipeline and validation guidance into
`docs/validation/`, update `docs/validation/INDEX.md`, delete this ticket, and
remove its row from `docs/notes/tickets/INDEX.md`.
