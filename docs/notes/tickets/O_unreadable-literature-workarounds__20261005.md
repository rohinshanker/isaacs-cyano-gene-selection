# O_unreadable-literature-workarounds__20261005 — Open

- **Scope:** Get the methods and licence text of the papers Claude Science could not
  read, by routes that circumvent nothing, and return the extracted values through
  intake. Covers `docs/` only; no paper is committed to this public repository.
- **Status:** open
- **Opened:** 2026-10-05
- **Updated:** 2026-10-05

## Current state

Opened at the owner's request. Packages B and C could not read eight papers, and the
methods memo read 15 of its 44 sources from abstracts only. Those gaps leave 11
licence decisions undetermined and feed most of package D's 178 undecidable pairs.
Register rows covered: LIT-01 to LIT-09, AUD-03.

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

## Verification

Not started. Each extracted value carries its quote and location and is re-matched
against the saved text. No PDF, page or supplement is committed. A ledger row
changes only after intake of the addendum.

## Cleanup

On resolution, fold the working routes into
[claude-science-handoff.md](../../validation/claude-science-handoff.md), update
`validation/INDEX.md` if its row changes, then delete this ticket and its index row.
