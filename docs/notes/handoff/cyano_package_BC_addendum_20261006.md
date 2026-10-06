# Package B and C addendum, 2026-10-06

In-repository extraction from the papers Claude Science could not read, under
the owner's decision of 2026-10-05 that an in-repository read with a mechanical
quote match is sufficient ([ticket](../tickets/O_unreadable-literature-workarounds__20261005.md)).

- Table: `cyano_package_BC_addendum_20261006.tsv`, SHA-256 `aada503cbd79909ec66c2a32344942661ca4a59326313bfccfe8211b1b6f1d3f`, 15 data rows in
  the package B columns. Each row names the package B data row it amends in
  `status`; `conditions` repeats that row's `CONDITION SET | SAMPLES` head and then
  only the axes the papers settle, each as `axis = value [location (doc); quote: "..."]`;
  `replicates` and `licence` carry the same form. `licence` holds the article
  terms in package C's `ARTICLE TERMS` / `DIVERGENCE` / `RECOMMENDATION` wording.
  "Not reported" means the whole article and supplement were read and are silent.
- Sources: the five papers and supplements the owner placed in the private drop
  folder (`~/Desktop/coding_stuff/ISAACS-LAB/private-literature/`, outside the
  repository, never committed), plus Vijayan 2009's PMC article page read with a
  plain client. Text was extracted with `pdftotext` in reading order, `.docx`
  supplements by stripping `word/document.xml`, workbooks as pipe-joined rows.
- Document keys in the locations: `puszynska2017_main`, `puszynska2017_tableS6`,
  `markson2013_main`, `markson2013_supp`, `markson2013_tableS7`, `vijayan2009_pmc`,
  `vijayan2009_si`, `santosmerino2024_main`, `santosmerino2024_supp`,
  `vicente2019_main`. Quotes are as the extraction reads them; where a PDF's
  symbol glyphs were lost (degree and micro signs in Puszyńska and Markson) the
  row says so.
- Check: `./.venv/bin/python tools/check_addendum_quotes.py
  docs/notes/handoff/cyano_package_BC_addendum_20261006.tsv --texts <dir>` with the
  ten `<doc>.txt` files regenerated from the drop folder. Result on 2026-10-06:
  70 of 70 quotations matched.
- Intake and the ledger decisions it changed are recorded in the ticket.
- Re-score: `cyano_package_D_rescore_20261006.tsv`, SHA-256 `b9b56c092cb2da938e93a61dc716283a8d1910603e0f5c509458af01c4bc8720`, the 19
  PXD036717 pairs of package D scored again with the addendum's values under the
  contract thresholds and D.7's rules; two extra columns name the package D row
  and its earlier verdict. 15 move from undecidable to not comparable, none
  escalates.
