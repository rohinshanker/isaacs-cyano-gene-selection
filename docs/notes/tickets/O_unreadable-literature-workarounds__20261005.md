# O_unreadable-literature-workarounds__20261005 — Open

- **Scope:** Get the methods and licence text of the papers Claude Science could not
  read, by routes that circumvent nothing, and return the extracted values through
  intake. Covers `docs/` only; no paper is committed to this public repository.
- **Status:** open
- **Opened:** 2026-10-05
- **Updated:** 2026-10-06

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

## Work in progress, paused 2026-10-06

The addendum extraction from the five supplied papers is read and verified but
not yet written. Pick up here.

**Done.** All five papers and supplements were read from the drop folder
(`~/Desktop/coding_stuff/ISAACS-LAB/private-literature/`), text extracted with
`pdftotext` in reading order (no `-layout`, which interleaves columns), the two
`.docx` supplements by stripping `word/document.xml`, the Table S6 and Table S7
workbooks exported as pipe-joined rows. Vijayan 2009's main text was read from
its PMC article page with a plain client. Every quote below was found verbatim in
those texts after NFKC normalisation and whitespace collapsing.
`tools/check_addendum_quotes.py` (with `tests/test_check_addendum_quotes.py`) does
that match for an addendum TSV against a directory of `<doc>.txt` files; a
location names its document as `(<doc>)`, a composite quote joins pieces with
`||`. Document keys used: `puszynska2017_main`, `puszynska2017_tableS6`,
`markson2013_main`, `markson2013_supp`, `markson2013_tableS7`, `vijayan2009_pmc`,
`vijayan2009_si`, `santosmerino2024_main`, `santosmerino2024_supp`,
`vicente2019_main`. The text directory was in the session scratchpad and must be
regenerated from the drop folder before the check is rerun.

**Findings, by Package B row.**

| Row | Artifact | What the papers give |
| --- | --- | --- |
| 3, 4, 7, 8, 16 | GSE103462, GSE103463, GSE103644, GSE103704, GSE105774 (Puszyńska 2017) | CO₂: not reported (the whole text names medium, temperature, light and entrainment only: "Cell cultures of wild-type and mutant cells were grown in BG-11 medium at 30 C under illumination with cool fluorescent light at 40 mE m2 s1 (micromoles of photons per square meters per second) unless indicated otherwise in figure legends." — symbols as extracted). Growth phase: not reported as OD or phase; Table S6 lists the number of cells harvested per sample. Replicates: two biological replicates per strain and time point ("Each point represents the mean expression value of two biological replicates."; Table S6 rows `dawn, replicate 1` / `replicate 2`). Licence: "This is an open access article under the CC BY-NC-ND license (http://creativecommons.org/licenses/by-nc-nd/4.0/)." |
| 21 | GSE18902 (Vijayan 2009) | Replicates: one 60-h time course ("Samples were collected every 4 h for 60 h from T = 24 to T = 84 h"), no biological replicate per time point. Lamp: not named ("approximately 25 μmol photons m −2 s −1 white light, bubbled with 500 mL/min 1% CO 2 in air, maintained at 30 °C"); the Supporting Information holds dataset descriptions and figure legends only. Licence: the PMC page shows only the generic PMC copyright notice, no open licence. |
| 46, 47, 48, 51, 53, 54 | Markson 2013 series | Turbidostat cultures "as described previously (Vijayan et al., 2009)"; flask cultures: "cultures were grown in tissue culture flasks illuminated with 100 mE m-2 s-1 (mmoles photons m-2 s-1) of cool fluorescent light and bubbled continuously with 1% CO2 in air, with the OD750 maintained near 0.3 by diluting the cultures every four hours with fresh medium. Medium was supplemented with 10 mM HEPES-KOH pH 8.0 maintain the pH." — no temperature anywhere in the paper or supplement, so GSE50920 and GSE50922 row 51 become "not reported" (J2 stays open). Replicates: no count stated for the array series; Table S7C lists one RNA-seq sample per time point and condition (`WT ZT 24 | 1416579`, `OX-D53E + IPTG 0 | 766983`); the supplement names "a previously unpublished biological replicate time course 28 hr in length (V. Vijayan, personal communication)", consistent with GSE52486's titles but not stated as such. Licence unchanged (© 2013 Elsevier). |
| 75 | PXD036717 (Santos-Merino 2024) | "grown in BG11 medium supplemented with 1 g L− 1 HEPES to a final pH of 8.3 with NaOH. Flasks were cultured in a Multitron incubator (Infors HT) at 32 ◦ C supplemented with 2% CO2 with ~150 μmol photons m− 2 s− 1 of continuous light provided by Sylvania 15 W Gro-Lux fluorescent bulbs and shaken at 150 rpm. Cultures were back-diluted daily to an OD750 of 0.3"; labeling: 50 mL cultures resuspended with biotin phenol and "incubated for 30 min in the growing conditions of S. elongatus cultures" (supplement); OD at labeling and IPTG induction before labeling not stated. Replicates: "three biological replicates for each strain". Licence: CC BY-NC-ND (same sentence as Puszyńska). |
| 1, 2 | GSE102914 (Vicente 2019) | "grown in BG11 medium (Sigma-Aldrich) under constant temperature (20 °C), rotary agitation (100 rpm) with circadian period (16:8). Cells in exponential phase of growth (OD730nm =0.24) were harvested"; exposure: "Cells were exposed at 20 °C under 100 rpm agitation and continuous light." Light intensity and CO₂: not reported anywhere. Replicates: "Four independent replicates were performed for microarray analysis", "four biological replicates hybridized on two slides". Licence: "© Springer-Verlag GmbH Germany, part of Springer Nature 2019", no open licence. |

**Next steps.** (1) Write `docs/notes/handoff/cyano_package_BC_addendum_20261006.tsv`
in the Package B columns, one row per artifact condition set above, cited axes
only, with a short manifest `.md` beside it naming the texts and the check
command; run the checker and record the count here. (2) Ledger: under the
existing rules, the five Puszyńska series and GSE102914 move from undetermined to
not permitted (CC BY-NC-ND and all-rights-reserved articles; link-only), GSE18902
to not permitted (no open licence on the article page), PXD036717 stays permitted
(CC0 files; article NC-ND noted as divergence); update the counts line. (3) Note
the filled cells in the condition-gaps ticket and mark J2 as answered "no
temperature in the paper either". (4) The ticket index row and the Package D
re-score of the affected pairs follow intake.

## Verification

Not started. Each extracted value carries its quote and location and is re-matched
against the saved text. No PDF, page or supplement is committed. A ledger row
changes only after intake of the addendum.

## Cleanup

On resolution, fold the working routes into
[claude-science-handoff.md](../../validation/claude-science-handoff.md), update
`validation/INDEX.md` if its row changes, then delete this ticket and its index row.
