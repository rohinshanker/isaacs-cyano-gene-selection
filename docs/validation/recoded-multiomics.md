# Recoded E. coli: source and admission contract

The Syn61∆3(ev5) page uses the deposited evolved genome **GCA_028355435.1,
CP116771.1**, 3,977,501 bp. Nyerges 2026 Supplementary Data 1, `Strains &
Plasmids!D2`, names this accession. Its 3,690 annotated CDS records yield 3,549
plotted genes and 141 exclusions under the ordinary CDS contract. Neither the
complete Ec_Syn57 design nor another Syn61 generation substitutes for it.

The [source dossier](../notes/handoff/recoded_ecoli_evidence__20261007.md) and
its JSON companion locate the primary evidence and checksums. The study is
[Nyerges et al. 2026](https://doi.org/10.1038/s41467-026-74300-9), Supplementary
Data 1–7. The article is CC BY-NC-ND 4.0. Project-derived numerical tables are
attributed and labelled as derived under the owner's 2026-10-06 source-ledger
decision; they are not described as unmodified publisher files.

## Reproduce

Run from the repository root, with its Python environment installed:

```sh
.venv/bin/python tools/fetch_recoded_ecoli.py
bash tools/fetch_genome.sh --organism ecoli-syn61-delta3-ev5
.venv/bin/python scripts/build_features.py --organism ecoli-syn61-delta3-ev5
.venv/bin/python tools/ingest_recoded_multiomics.py
.venv/bin/python scripts/build_features.py --organism ecoli-syn61-delta3-ev5
.venv/bin/python tools/build_data_manifest.py build --organism ecoli-syn61-delta3-ev5
```

The versioned genome and source tables provide the initial input artifacts.
The ingestion command reads source cells,
recreates the join audit and sixteen typed TSVs, and writes the separate fitness
artifact and organism-specific citation ledger. The second feature build joins
the tables. Source archive and member SHA-256 checks happen before replacement;
the genome downloader verifies NCBI's MD5s and the build verifies assembly,
strain, taxid and chromosome length. Keep all source pins; a changed download
requires evidence review, not a replacement checksum chosen to pass the build.

## Syn61 gene join and quantities

`tools/ingest_recoded_multiomics.py` joins only exact, case-sensitive source
`Gene` names to a unique `gene` attribute among **all** annotated CP116771.1
gene features. Uniqueness includes features excluded from the map. It never
strips author suffixes, substitutes aliases, uses fuzzy matching, or transfers
values through MG1655. A sole candidate must also survive CDS filtering and
have the identical plotted gene name. All 3,640 source rows appear in
`gene-join-audit.json`: 3,192 map, 423 have no match, 24 are ambiguous and one
uniquely named gene is excluded from the map. These omissions stay absent.

The `Syn61_delta3_ev5` sheet supplies sixteen separately typed fields:

| Source columns | Quantity | Interpretation |
| --- | --- | --- |
| C:E | Three RNA RPKM replicates | Source-reported gene-body RNA abundance |
| F:H | Three Ribo read-count replicates | Integer ribosome-footprint counts, not RPKM |
| I:K | Three Ribo RPKM replicates | Footprint coverage, not protein abundance |
| L, O | RNA/Ribo log2 fold changes | Source read-count calculation, Syn61/MDS42 |
| M, P | RNA/Ribo EdgeR log2 changes | Separate EdgeR calculation, Syn61/MDS42 |
| N, Q | Reported P-values | Figure captions say adjusted; adjustment method/family unspecified |
| R | Translation-efficiency log2 change | `RIBO_LFC - RNA_LFC`, not an EdgeR difference or absolute TE |

Every TSV names its quantity and source gene key. Every manifest entry names
its literal workbook column, checksum, culture condition, replicate count and
contrast reference. Cultures were paired for RNA/Ribo, grown in LBL at 37 °C,
250 rpm, to OD600 0.40–0.45. Detailed RPKM denominators/filtering, non-EdgeR
pseudocount rules and EdgeR normalization/design settings are not fully supplied;
values remain as deposited. Do not reconstruct a fold change from supplied
RPKMs and label it as the source estimate. Signed values, measured zero, tiny
P-values and missing cells are distinct and must survive serialization.

## Whole-strain fitness

`strain_fitness.json` contains 69 growth records for 48 source-labelled growth
strains and 5,280 Biolog well values
from eleven source sheets. It is a **study comparison view**, whose records
name many strains; being available on the Syn61 page does not make every row a
Syn61 measurement. It colors no gene. See [strain-fitness.md](strain-fitness.md)
for its schema and browser behavior.

Keep each source row or sheet identity separate across assays. Similar segment
names do not establish matching evolved/troubleshot stages. In particular,
`MDS42_Seg80-0` stays under its deposited name; it is not silently renamed
Seg82–0. Record IDs retain source sheet ordinal, row and column; sheet names
appear in strain labels. The raw growth-cell audit retains the exact labels and
sentinels behind the interpreted values.

The 52 numeric growth records have ten published measurements, source means
and population SD (`ddof=0`). The 17 `0 (no growth detected)` rows are
categorical outcomes. All numeric placeholders on those rows become null in
the interpreted layer, including doubling time and OD; their original zeros
remain only in the source-cell audit. They are not ten zero-minute doubling
times or ten independently measured growth curves. M9-labelled rows are mapped
explicitly by pinned source row to M9 + 2% D-glucose; the remaining growth rows
use 2×YT, at 37 °C. An explicit pinned-row crosswalk pairs the 21 M9 rows with
their corresponding rich-medium strain; evolved/troubleshot stages remain
separate. This crosswalk is not a cross-assay identity claim.

Biolog entries are signed Max Height differences versus MDS42. Keep plate,
well, substrate, source sheet and negative values. The source inconsistently
names 590 nm and OD600, and does not supply exact per-well processing. Use the
declared optical-density-basis caveat instead of claiming a fully specified
OD600 assay. The published summary score numerically matches a sum over 480
wells despite mean wording; the interface does not invent a cross-well mean.

## Scheme and projections

The observed residual metric counts TCA/TCG in the decoded included CDS body,
including the annotated start triplet, and terminal TAG once per gene. The
3,549 included genes carry 148 target codons under this convention. Zero is a
real count. This is a sequence-derived observation, not simulated editing and
not a claim about excluded CDSs, untranslated ORFs or all genomic triplets.

The original Syn61 prescription is TCG→AGC, TCA→AGT and TAG→TAA, each at 100%
per target, as stated by the Chin lab in [Addgene #174513, Depositor
Comments](https://www.addgene.org/174513/), citing Fredens et al. 2019,
DOI `10.1038/s41586-019-1192-5`. That ancestral design prescription is distinct
from the deposited ev5 sequence and does not establish its entire edit history.
The source text was retrieved through the web reader on 2026-10-08; a direct
HTTP request returned 403, so no full-HTML checksum is asserted. The located
excerpt and its checksum are retained in
`data/recoded/syn61-design-evidence.json`; that checksum describes only the
located excerpt, not the full webpage.

Own-fit PCA standardizes 59 RSCU features within this genome. Its distances
describe surviving synonymous variation. A parent-reference view must name the
exact public reference and explain that removed codons can dominate apparent
separation. Public MDS42 and DH10B references are not established as the exact
2026 experimental stocks. The self-contained projection payload contract is
in [recoded-reference-projection.md](recoded-reference-projection.md); nothing
may fetch another organism's live data directory as an implicit parent.

## Admission gates that remain scientific

Partial Syn57 isolates need exact stock sequences, validated native/design
coordinate reconciliation and final structural/mutation histories. The 88
design segment features include overlaps and gaps; a simple concatenation or
fixed offset is invalid. Debugged Seg30–35 additionally needs assay
replicate-to-clone identity. The complete design is separately usable as a
design but cannot receive measurements from a partial isolate.

## Checks

The source-to-output tests recompute all admitted values from pinned workbooks,
check every gene join outcome and verify no-growth interpretation, signed wells,
source identity and exact culture metadata. Required gates:

```sh
npm test
.venv/bin/python -m pytest -q
.venv/bin/python tools/validate_contract.py
.venv/bin/python tools/validate_contract.py --organism ecoli-syn61-delta3-ev5
.venv/bin/python tools/build_data_manifest.py check --organism ecoli-syn61-delta3-ev5
```

Render the real Syn61 route at 375×812, 768×1024, 1280×800 and 1440×900. Check
scheme visibility, residual counts 0/1, separate omics quantities, missing
values, the study fitness view, filtering, keyboard navigation, exact download
names and citations. Native-organism routes must retain their own labels,
state and datasets.
