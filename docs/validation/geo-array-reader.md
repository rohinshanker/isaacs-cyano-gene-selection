# GEO microarray measurements

The seven admitted PCC 7942 series provide processed sample tables in GEO SOFT
and Series Matrix formats. Their raw supplementary archives are not the only
available measurements. The owner authorized separate deposited samples on
2026-10-14, with the authors' probe averaging disclosed. No new physical-probe
reduction or normalization is performed.

## Inputs and rebuild

[`geo_array_sources.json`](../../data/expression/ingest/geo_array_sources.json)
pins both processed representations, GPL9534, the published dye-swap summary,
sample membership, conditions, citations and source-specific pooling rules.
Retrieval checks were performed on 2026-10-14. Raw supplementary links are source
references, not a claim that their contents were fetched or processed.

```sh
.venv/bin/python tools/ingest_geo_arrays.py
.venv/bin/python scripts/build_features.py
.venv/bin/python tools/promote_expression_agreement.py
.venv/bin/python tools/build_data_manifest.py build
.venv/bin/python -m pytest -q tests/test_geo_array.py tests/test_ingest_geo_arrays.py tests/test_expression_table.py
```

The ingestion command verifies immutable compressed-byte hashes before use,
compares every SOFT value string with the independently served series matrix,
and checks each embedded platform table against the pinned GPL9534 table.
It retains a lossless processed-evidence document for every study under
`data/interim/geo-arrays/`, including repeated metadata, original value strings,
positional platform columns, unmapped features and raw supplementary URLs.
These documents reproduce from pinned inputs and remain outside the release.
Existing unrelated manifest entries are retained.

The generic `reader.format: geo-soft` route in `tools/ingest_expression.py`
requires an explicit `sourceId`, `platformId`, `idColumn`, and, for a gene
projection, `mappingPattern`. Optional `sampleIds` selects samples explicitly.
It accepts only one sample per layer and `as-deposited` normalization. A separate
GPL can be supplied as a checksum-pinned `platformFile`; duplicate
platform definitions are rejected. Source-specific summaries use the separate
array admission command rather than weakening this generic preservation rule.

## Quantities and mapping

| Series | Individual samples | Quantity | Features / mapped UTEX genes |
| --- | ---: | --- | ---: |
| GSE50908 | 13 | Normalized log2 timepoint/reference-pool ratio | 2,723 / 2,551 |
| GSE50919 | 2 | Normalized log2 Cy3/Cy5 ratio; biological orientation differs | 2,723 / 2,551 |
| GSE50920 | 49 | Normalized log2 sample/reference-pool ratio | 2,723 / 2,551 |
| GSE52486 | 7 | Normalized log2 timepoint/reference-pool ratio | 2,723 / 2,551 |
| GSE18902 | 23 | Normalized log2 sample/experiment-reference ratio | 2,723 / 2,551 |
| GSE59112 | 12 | Normalized time-course profile | 1,739 / 1,673 |
| GSE102914 | 16 | Normalized signal | 2,395 / 2,259 |

The first five preserve the authors' four-probe averages. GSE102914 also
publishes means of four probes per gene. GSE59112 normalizes log intensities
against spike-ins. Its processing description says WT mean zero and amplitude
two, but the deposited WT values have per-ORF mean approximately zero (within 1e-8, allowing for deposited
rounding) and peak-to-trough one
across six time points. The build verifies those observed properties and retains
the values without rescaling. Mutant profiles remain relative to WT and are not
re-centred.
Its profile is neither absolute RNA abundance nor a between-gene abundance
scale, so it belongs to the separate **Temporal profile** metric family.

The three explicit array quantities preserve numeric precision and never pool
automatically. They remain separate from RNA-seq. A named optional summary is
one dataset selected explicitly, not a default aggregate of checked arrays.
The array log-ratio sources belong to **Fold change**, normalized signal to
**Expression**, and profiles to **Temporal profile**. This also keeps ratios
and temporal profiles out of abundance-based low-traffic filtering.

The join is exact `ID_REF → GPL9534 ID → ORF → PCC 7942 old-locus crosswalk →
UTEX locus`. GPL9534 has 2,723 unique features, 2,715 nonempty unique ORF
identifiers and eight blank ORFs. Nonempty numeric and suffixed source identifiers
are retained exactly; no spelling repair or symbol guess is made. The existing
one-to-one crosswalk determines which reach UTEX. Unmapped features and absent
measurements remain unknown. Every browser layer is labelled PCC 7942 evidence
transferred to UTEX 2973.

## Optional summaries

- **GSE50919:** `(GSM1232426 - GSM1232427) / 2`, oriented ΔrpaA/WT. Both arrays
  use Cy3/Cy5; their biological assignments reverse. The build verifies those
  assignments and compares all 2,715 projected ORFs against the independently
  deposited published comparison, joined by its JGI feature ID. The tolerance
  is 0.005000001, matching the published table's two-decimal precision. This
  combines a dye swap, not independent biological cultures.
- **GSE102914:** four optional arithmetic means, each restricted to the four
  biological replicates of one treatment at five hours. The build requires
  identical sample-source, treatment and processing metadata within the group.
  The original four-probe reduction and normalization are retained. No treatment
  is combined with another, and no new probe-level or differential-expression
  statistic is inferred.
- **Other series:** no new summary is admitted. Time points, genotypes and
  experiments remain separate. GSE50920's replicate-specific reference pools
  and its Loess-only pool-versus-pool contrast are not treated as a common
  quantitative reference. GSE59112's amplitude-normalized profiles are not
  averaged into abundance.

Only genes present in every constituent enter a summary; missing values are
never substituted with zero. No cross-study comparability judgement authorizes
automatic numerical pooling of these measurements.

## Verification before publication

Run the repository and [release gates](release-gate.md). Rebuild into a temporary
output directory and compare all 127 TSVs and their manifest entries with the
release; the seven source hashes, 122 original samples and five summaries must
match exactly. Existing gene payloads and pre-existing measured values must be
unchanged. Validate the three separate array types, default individual sample,
sample switching, explicit summary selection, missing genes, provenance and
export in the real application at mobile, tablet, desktop and wide widths.
Review source terms in the [ledger](source-ledger.md); permissions to display
these deposits do not confer a new upstream open licence.

The repeatable browser check uses the existing global Playwright CLI without
project dependencies. Serve the repository root on an unused owned port and
open `/site/?arrayArtifacts=<absolute ignored artifact directory>` in a unique
Playwright session; run `playwright-cli -s=SESSION run-code
--filename=tools/check_array_browser.js`. It checks all three types, radio and
keyboard switching, explicit summaries, transfer/probe-processing disclosures,
abundance exclusion, overflow at eight widths, and runtime/network diagnostics.
Inspect its screenshots as well as the returned report.

GSM1267085 is explicitly labelled log2(control clock-rescue pool / ΔrpaA
clock-rescue pool), Cy3/Cy5, using its channel metadata and Loess-only exception.
The deposit's VALUE header repeats the time-course wording; it remains in the
lossless evidence, with the discrepancy disclosed in the browser. Each GSE50919
individual sample also states its own numerator/denominator; only the optional
dye-swap mean changes orientation.
