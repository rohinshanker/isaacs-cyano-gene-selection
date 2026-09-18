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

| Stream | Owner | Issue | Branch | State |
| --- | --- | --- | --- | --- |
| Feature pipeline | `codex-implementer` | DEM-27 | `feat/pipeline` | running |
| Interactive site | `claude-specialist` | DEM-28 | `feat/site` | running |
| Expression dataset | `codex-scout` | DEM-29 | read-only | **resolved** |

### Expression outcome (DEM-29, resolved 2026-09-18)

No public per-gene abundance table exists for UTEX 2973. The only genuine UTEX
transcriptomic study (Tan et al. 2018, PRJNA420395) publishes transcription-start-site
and coverage data, not a gene-level matrix, and quantifying it needs an alignment
pipeline that is out of scope.

The best available substitute is GSE205444, measured in **PCC 7942** in a biofilm and
conditioned-media experiment. The coordinator independently re-derived the identifier
join and found a real defect: the four proteins encoded at two loci each caused two
distinct PCC genes to collapse onto one UTEX tag, with candidate values differing up
to twentyfold. All eight affected loci are excluded rather than guessed, leaving
2,551 of 2,715 genes covered.

**Decision.** Ship it as a labelled opt-in overlay, not the default axis. The
low-traffic threshold defaults to CAI and tAI, which come from this genome. Caveats
live in `data/expression/PROVENANCE.md`, and the loader is generic so a real UTEX
table can replace it with no code change. This is a deviation worth the user's
attention: they asked for real published data, and the honest finding is that the
available data is from a different strain under unusual conditions.

The site went to `claude-specialist` rather than `claude-implementer` because it
carries live in-browser PCA, a packed-codon scan under a latency budget, and three
comparison views. That is frontier-judgment UI work, not a clear bounded slice.

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
