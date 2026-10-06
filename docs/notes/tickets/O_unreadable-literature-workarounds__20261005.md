# O_unreadable-literature-workarounds__20261005 — Open

- **Scope:** Get the methods and licence text of the papers Claude Science could not
  read, by routes that circumvent nothing, and return the extracted values through
  intake. Covers `docs/` only; no paper is committed to this public repository.
- **Status:** open
- **Opened:** 2026-10-05
- **Updated:** 2026-10-06

## Current state

Opened at the owner's request. Packages B and C could not read eight papers, and the
methods memo read 15 of its 44 sources from abstracts only. Those gaps left 11
licence decisions undetermined and fed most of package D's 178 undecidable pairs.
On 2026-10-06 the five owner-supplied papers and Vijayan 2009's PMC page were
read and returned as the package B and C addendum (intake below); 7 of the 11
undetermined decisions are now taken. Register rows covered: LIT-01 to LIT-09,
AUD-03.

Probed from this repository 2026-10-05 with a plain client, no altered User-Agent:

| Paper | Needed for | Claude Science result | Probe from here |
| --- | --- | --- | --- |
| Markson 2013, PMC3935230 | six GEO series; turbidostat lamp | Europe PMC 500, efetch front matter only | PMC article page served, 222 KB, with Experimental Procedures. The word "turbidostat" is not in it, so the apparatus detail is probably in the supplement |
| Vijayan 2009, PMC2799730 | GSE18902 methods and licence | same | PMC article page served, 177 KB, with Methods |
| Guerreiro 2014, PMC4125736 | PXD000510 | same | PMC article page served, 255 KB |
| Plant Physiol. 2022, PMC9157067 | PXD027430, licence already permitted | same | PMC article page served, 271 KB, with Materials and methods |
| PNAS 2016, PMC5167140 | PXD005105 licence line | no permissions block | PMC article page served; 12 package B quotes matched on it 2026-10-04 |
| Puszyńska 2017, Cell Reports | six GEO series, methods and licence | only an http PDF, refused by the session's fetcher | DOI resolves to a script redirect; a plain client gets no article |
| Metab. Eng. 2023 | PXD036717 | no open location | not probed; subscription article |
| Env. Sci. Pollut. Res. 2019 | GSE102914 | closed access | not probed; subscription article |

The PMC PDF address still answers with a proof-of-work challenge. It is not solved.

## Work

1. **Automated, verified route: the PMC article page.** The in-repository agents read
   the five PMC records above from their article pages, one named article at a time,
   never in bulk. They extract the missing condition values, replicate structure and
   licence line as quotes with locations, and re-match every quote mechanically. The
   text is kept outside the working tree.
2. **Manual: supplements.** The Markson and Vijayan supplements are not on the
   article page and Europe PMC returns none for a non-open record. The owner saves
   each supplement into the drop folder.
3. **Manual: Cell Reports 2017.** The owner saves the open-access PDF and supplement
   from the article page into the drop folder.
4. **Manual: the two subscription articles.** Yale library access, an interlibrary
   request, or the author's accepted manuscript on request. Nothing else.
5. **The 15 abstract-only method sources.** List them from
   `cyano_comparability_methods_citations_20261005.tsv`, read the ones with a deposit
   by the routes above, and mark every memo claim that still rests on an abstract.
6. **Return path.** Extracted values come back as an addendum table in
   `docs/notes/handoff/` in package B's and C's formats, go through intake, and only
   then change a ledger decision or a package D re-score.

## Decisions for the owner

- **Supplied files, decided 2026-10-05.** The owner will download the papers and
  place them in `~/Desktop/coding_stuff/ISAACS-LAB/private-literature/`, outside this
  public repository. Its `README.md` lists each paper in full, the file name to use,
  what to save, and what is being looked for. Five are needed from the owner; for the
  rest the main text is readable from PMC and only a supplement would help.
- **Who verifies, decided 2026-10-05.** The in-repository extraction with a
  mechanical quote match is sufficient; it does not go back through Claude Science,
  which the owner now reserves for cases with no other route.
- **Files supplied 2026-10-05.** All five papers are in the drop folder with their
  supplements: Markson 2013 (article, eight supplementary files), Puszyńska 2017
  (article, six workbooks), Vijayan 2009 (supporting information, two workbooks),
  Santos-Merino 2024 (article, supplementary files), Vicente 2019 (article, two
  supplementary files). A first read already answered part of question J1; see
  [O_comparability-lab-judgements__20261005](O_comparability-lab-judgements__20261005.md).
  The full extraction into a package B and C addendum is the next step and is not
  started.

## Addendum intake, 2026-10-06

All five supplied papers and their supplements were read in full; the two
subscription articles (work item 4) came through the owner's library access.
Return: [`cyano_package_BC_addendum_20261006.tsv`](../handoff/cyano_package_BC_addendum_20261006.tsv),
SHA-256 `aada503cbd79909ec66c2a32344942661ca4a59326313bfccfe8211b1b6f1d3f`, 15 rows, with its manifest
[`cyano_package_BC_addendum_20261006.md`](../handoff/cyano_package_BC_addendum_20261006.md).

| Check | Result |
| --- | --- |
| Identifiers resolve | Every row amends a named package B data row (1, 2, 3, 4, 7, 8, 16, 21, 46, 47, 48, 51, 53, 54, 75) and carries that row's artifact, strain, assay and table cells unchanged. |
| Quotations | 70 of 70 re-matched mechanically by `tools/check_addendum_quotes.py` against the reading-order texts of the ten documents, after NFKC normalisation, control-byte removal and whitespace collapsing; composites checked piece by piece. |
| Not reported versus not retrieved | Every former `not retrieved` cell these papers cover is now `not reported` (read and silent) or a value with its quote. Light intensity and CO₂ for GSE102914, CO₂ and growth phase for the Puszyńska series, and the flask-culture temperature for GSE50920 and GSE50922 row 51 are silent in the papers. |
| Boundaries | No join, no comparability verdict; licence cells are recommendations and the decisions were taken in the ledger under its existing rules. |

**What the papers settle.** Puszyńska 2017: two biological replicates per
strain and time point, CC BY-NC-ND. Vijayan 2009: one 60-h time course sampled
every 4 h, lamp not named, no open licence on the PMC page. Markson 2013: no
temperature for the flask cultures anywhere, so J2 stays open; one RNA-seq
sample per time point (Table S7C); the turbidostat is Vijayan's by citation.
Santos-Merino 2024: 32 °C, ~150 µmol continuous light from Sylvania 15 W Gro-Lux
fluorescent bulbs, 2% CO₂, BG11 with 1 g/L HEPES pH 8.3, shaken flasks diluted
daily to OD₇₅₀ 0.3, three biological replicates, CC BY-NC-ND article over CC0
files. Vicente 2019: 20 °C, 16:8 photoperiod for the stock and continuous light
during exposure, exponential phase OD₇₃₀ 0.24, four biological replicates on two
slides, publisher copyright.

**Ledger changes** (rules unchanged): GSE103462, GSE103463, GSE103644,
GSE103704, GSE105774, GSE102914 and GSE18902 move from undetermined to not
permitted, link-only; PXD036717 stays permitted under its CC0 files.

**Package D re-score, 2026-10-06.** Of the cells the addendum changed, only
PXD036717's bear on a verdict: every other change turns `not retrieved` into
`not reported`, which package D already scored as undecidable. Its 19 pairs were
re-scored against the contract's thresholds and D.7's rules with the new values
([`cyano_package_D_rescore_20261006.tsv`](../handoff/cyano_package_D_rescore_20261006.tsv),
SHA-256 `b9b56c092cb2da938e93a61dc716283a8d1910603e0f5c509458af01c4bc8720`, package D's columns plus the original row and verdict): 15
undecidable pairs become not comparable (light intensity fails on 13, 150 µmol
against 20 to 500; temperature fails against the 22, 37 and 38 °C partners; the
diel PXD000510 fails the regime), 1 stays not comparable, 3 stay undecidable
(PXD023591, PXD027430 and PXD030282's log/stationary set report nothing), and
none escalates: PXD005105 and PXD030282's cultivation sets each miss narrowly
on two axes (light 1.5×, CO₂ 2.5×), which is two misses, not one. The
format-and-phase axis stays undecidable on every pair because PXD036717's OD at
labeling is not stated.

**Work item 5, probed 2026-10-06.** The memo already marks every claim that
rests on an abstract "(abstract only)" at first use, and the companion table's
`retrieved_via` column says "ABSTRACT ONLY" on the 15 rows (1, 2, 4, 7, 8, 11,
12, 18, 20, 23, 26, 27, 29, 33, 41), so the marking is done. Four of the 15 have
a PMC deposit (MAQC 2006 PMC3272078, Lin 2014 PMC4260565, Reese 2013
PMC3810845, Evans 2017 PMC6171491). On 2026-10-06 the PMC article page answered
each with a proof-of-work interstitial instead of the article (3.5 KB of
challenge script, not solved, per the gated-pages ticket) and Europe PMC's
`fullTextXML` returned HTTP 500 for all four, as for the other non-open
deposits. The other eleven are subscription articles. None of the 15 bears on a
ledger decision or a condition cell; they support statistics-method statements
whose abstracts state the claim. Reading them is left to the owner's browser if
wanted; nothing else waits on it.

**Still open.** The ticket index row, which another session holds. The two optional supplements (Singh 2022, Guerreiro 2014) were not
supplied and are not needed for any ledger decision.

## Verification

Not started. Each extracted value carries its quote and location and is re-matched
against the saved text. No PDF, page or supplement is committed. A ledger row
changes only after intake of the addendum.

## Cleanup

On resolution, fold the working routes into
[claude-science-handoff.md](../../validation/claude-science-handoff.md), update
`validation/INDEX.md` if its row changes, then delete this ticket and its index row.
