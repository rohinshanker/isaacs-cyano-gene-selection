# Borrowed PCC 7942 essentiality for UTEX 2973 candidate review

## Source and evidence boundary

[Rubin et al. 2015](https://doi.org/10.1073/pnas.1519220112) measured the
fitness of a PCC 7942 transposon library, calling 718 of its 2,723 genes
essential. This is a PCC 7942 observation under its laboratory conditions,
not a UTEX 2973 knockout experiment or a prediction of a recoding outcome.
Rubin used BG-11 at 30 °C, with solid and liquid outgrowths and several light
levels; its final categories combine evidence across those regimes. “Beneficial”
means insertions reduced PCC fitness, distinct from “essential.” The authors
state that calls can change under other growth conditions.
The four control outgrowths used solid BG-11 at 116, liquid BG-11 at 60 or 199,
and a photobioreactor at 500 µmol photons m⁻² s⁻¹; these were not the growth
comparison conditions in Ungerer et al. 2018.

The release obtains per-gene calls from [Adomako et al. 2022 Data Set
S1](https://doi.org/10.1128/mbio.00862-22), sheet `PG_metadata`, column
`PCC 7942 essentiality`. That paper attributes the essentiality values to
Rubin and publishes PCC 7942 and UTEX 2973 locus IDs in the same pangenome
rows. The article's Data Set S1 legend names Adomako et al. as copyright
holders and states **CC BY 4.0**; the spreadsheet does not include that notice.
The original Rubin Dataset S3 is not redistributed. The
unmodified Adomako workbook is pinned at
`data/essentiality/source/mbio.00862-22-s0001.xlsx` (1,359,396 bytes,
SHA-256 `b988b744c4c939ce6f47232eacfc30338907a9b911830999eb23414cbe6c331b`).
It was obtained from the [Europe PMC supplemental-file
endpoint](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9239245/supplementaryFiles).
Derived calls cite both papers and retain Adomako's attribution and licence.

## Cross-strain interpretation

[Ungerer et al. 2018](https://doi.org/10.1128/mBio.02327-17) reports that
UTEX 2973 and PCC 7942 grew at similar rates under PCC-compatible light of
400 µmol photons m⁻² s⁻¹. The same study found different growth optima and
much faster UTEX 2973 growth at higher light. Its routine comparison used
38 °C and 5% CO₂ for both but different light levels, whereas Rubin's screen
used PCC 7942 at 30 °C. The condition-specific similarity is relevant context;
it does **not** validate essentiality transfer. Every displayed PCC call is a
**cross-strain assumption** when used to evaluate a UTEX target. The lab must
review a priority locus and obtain UTEX-specific evidence before claiming it
is essential in UTEX 2973.

Join a current UTEX CDS only when Adomako's `UTEX 2973 NCBI` tag identifies
it, that pangenome row supplies a PCC 7942 NCBI tag, and the pinned RefSeq
crosswalk has exactly one `pcc7942_ortholog` for the UTEX locus matching that
PCC tag, and no other plotted UTEX locus is admitted to the same PCC tag. The
crosswalk is based on an exact shared RefSeq protein accession.
Keep every unmatched, absent, conflicting, and multiply mapped row visibly
unknown. A source `ambiguous`, `not_analyzed`, or blank call retains that state;
none becomes `non-essential`. Exact identity is evidence for the join, not
proof that knockout phenotypes transfer.

For the pinned release, 2,542 of 2,715 plotted CDSs have an admitted exact
join: 660 are `essential`, 154 `beneficial`, 1,617 `non-essential`, 71
`ambiguous`, 1 `not_analyzed`, and 39 have a missing source call. The other
173 have no admitted join and remain `unknown`. These counts are for the
mapped UTEX candidate set, not Rubin's full PCC genome denominator.

The derived data are separate from tested UTEX `atpA`, `ppnK`, and `rpaA`
alleles. Candidate details show those UTEX results first. The PCC badge,
assay context, citations, and export fields retain source strain and
assumption wording. The panel objective does not use borrowed essentiality
as a fitness or viability prediction.

## Precedence and GO IEA fallback

Candidate evidence uses one precedence: tested UTEX allele, then admitted PCC
7942 call, then GO IEA context, then unknown. Only `essential`, `beneficial`,
and `non-essential` count as an admitted call. A locus whose PCC state is
`ambiguous`, `missing`, `not_analyzed`, or unjoined `unknown` may show GO IEA
context. That happens only when TypeSafe Jev judges its IEA terms to place the
protein in a core cellular process. It is labelled computational inference, not
a knockout result, and it never reaches the panel objective. It also never
changes the PCC status, which stays visible.

Where GO context is core but the admitted PCC call is `non-essential`, the
panel and export state the disagreement. Neither source is preferred. The rule,
thresholds, calibration, and blinded spot check are in
[go-iea-essentiality-context.md](go-iea-essentiality-context.md).

## Rebuild and review

Use the pinned workbook, `site/data/genes.json`, and the release-pinned
`identifier-crosswalk-v1.tsv` as build inputs. Check the source SHA-256 and
the exactness of the join before regenerating the site artifact. The CI build
check, Python tests, candidate-evidence check, and JavaScript unit tests check
deterministic output and missingness, while
the [manual review checklist](AAA-manual-review-checklist.md#2-review-the-actual-biological-panel)
governs use of a borrowed call in an experimental panel. If the workbook,
annotation release, or mapping policy changes, recheck all calls and source
conditions before publishing.

```sh
python3 tools/build_pcc7942_essentiality.py --check
python3 tools/candidate_evidence.py check
python3 -m pytest -q tests/test_pcc7942_essentiality.py tests/test_candidate_evidence.py
node --test tests/js/candidate-evidence.test.mjs tests/js/export-manifest.test.mjs
```
