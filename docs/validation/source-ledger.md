# Source-ledger integrity

The reader-facing Citations & sources tab is driven by
`site/data/citations.json`. Keep **primary data** before
**methods, design, validation & software**. Each entry needs a traceable source
URL, an accurate citation, and a sentence saying exactly what this release used.
Do not list a paper merely considered for future integration as current data.

For each repository file offered as a download, set `filename` to the exact
basename of `repoPath` and `url` to the corresponding GitHub raw URL. The browser
fetches the bytes and saves a Blob under that name because cross-origin links to
raw TSV files may open inline. Keep the View source fallback for offline/CORS
failures. Label original NCBI files and project-derived tables differently; do
not call an extracted or normalized table the publisher's unmodified file. The
large gitignored genome inputs are retrieved at build time and cannot be
offered as downloads from this repository.

When a source or a retained file changes, update the ledger in the same patch.
`tests/test_citations_manifest.py` checks that every retained annotation input,
declared expression table, and key derived evidence table is represented by a
tracked file with an exact filename and URL. The site module tests cover
manifest loading, URL safety, and download-response handling:

```sh
.venv/bin/python -m pytest -q tests/test_citations_manifest.py
node --test tests/js/citations.test.mjs
```

For a release, also open the actual site at mobile, tablet, and desktop widths;
verify source ordering, no horizontal overflow, keyboard tab navigation, map
restoration, and one successful browser download with its exact suggested
filename. Check browser console errors. Preserve source-specific limitations:
Tan et al. 2018 has two biological cultures per condition and measures TSS
initiation, not gene-body abundance; GSE205444 measures PCC 7942, not UTEX
2973; tRNA genomic copy counts and CAI/tAI are proxies, not abundance assays.
The Adomako 2022 article's Data Set S1 legend specifies CC BY 4.0 for the
workbook; the spreadsheet does not repeat the notice. The data set
republishes Rubin 2015 PCC 7942 essentiality calls; cite both studies and label
the exact-join UTEX presentation as a cross-strain assumption. The original
Rubin Dataset S3 is not redistributed. The cited similar-growth observation in
Ungerer et al. 2018 applies at PCC-compatible light, not at the strains' differing
optima or at Rubin's assay conditions.
Retain the GO release/date, CC BY attribution and disclaimer, and ViennaRNA's
custom license and bundled component notices.

The trRosettaRNA hand-off cites the 2026 Nature Protocols server protocol and the
2023 Nature Communications method paper with complete authorship and DOI metadata.
The public server and official standalone package document the submission and custom
secondary-structure formats. This repository prepares inputs only: no submitted
sequence or returned model becomes project provenance automatically. Keep the
external server terms and privacy setting separate from the standalone Apache-2.0
code and the separate PyRosetta licence.
