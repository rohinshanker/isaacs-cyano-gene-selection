# Manual review checklist

Automated checks establish reproducibility and interface correctness. They do
not make biological or release decisions. Complete the relevant sections below
before using a panel as an experiment plan or publishing the site.

## Panel and recoding design

- Confirm every required, excluded, and selected locus tag against the lab's
  current strain inventory and annotation notes.
- Read each selected gene's product, translational-exception, discontinuous-CDS,
  overlap, nearby-noncoding-RNA, and missing-data warnings. Do not treat a panel
  score as a fitness or viability prediction.
- Confirm the active recoding schemes and substitutions. Pay special attention
  to stop-codon changes and `prfB`, whose programmed frameshift makes ordinary
  recoding assumptions unsafe.
- Review the panel's constraints, eligible count, feature list, and per-gene
  explanation in the exported manifest. Check that **Require a value** is set
  wherever an unknown measurement is unacceptable.
- Leave PCC 7942 expression off unless cross-strain abundance is intentionally
  part of the design. If enabled, review its organism, condition, coverage, and
  missing values separately from native UTEX 2973 TSS initiation evidence.
- Inspect exact RNA-folding results for the shortlisted genes and chosen scheme.
  Treat MFE and structure changes as hypotheses for follow-up, not proof of
  expression or growth effects.
- Re-import the saved manifest and verify that it recreates the same ordered
  panel before recording the design in a lab protocol.

## Evidence and licensing

- Decide whether to acquire or explicitly waive the currently unavailable
  UniProt, Rubin PCC 7942 essentiality, KEGG, and CyanoOmicsDB layers. Never fill
  an absent source with a product-name inference.
- Audit the CAI reference-set product classifications when TypeSafe/Jev
  credentials become available, then record the evaluated threshold and sample.
- Preserve NCBI, Gene Ontology, expression-study, and ViennaRNA attribution when
  redistributing the data or screenshots outside this repository.

## Interface and release

- At desktop and phone widths, open the designer, a ten-gene shortlist, dataset
  provenance, and a long gene detail. Confirm the center column is readable,
  detail remains reachable, and the page has no horizontal scrolling.
- Exercise map keyboard pinning, touch zoom, search, a shared URL, browser
  Back/Forward, shortlist export/import, and folding cancellation/offline errors
  in the browsers the lab will support.
- Before publication, review the exact Git diff, authorize the remote push and
  GitHub Pages change, wait for every release gate, and smoke-test the deployed
  URL plus downloaded CSV/manifest files. Record the deployed commit.
