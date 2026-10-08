# Recoded E. coli evidence for D4 and D5

Question from DEM-309: “For each of five Supplementary Data 3 sheets establish reference strain for each RNA/RIBO fold-change column and Delta_LFC” and “Identify which exact genomes can be built without raw-read assembly and which cannot.” The coordinator additionally requested Biolog units and growth replicate semantics.

Prepared by **codex-reviewer / DEM-309**, 2026-10-07 America/New_York (retrieval date **2026-10-08 UTC**), for agent-deck cyano-ticket-closing. Assigned baseline: `be5b3b3d3c15c443fe555ada851683e7ea2f7bd8`. Actual managed-worktree base: `2db9d3ebeed7f30bd40516649bd040568fc61971`, the runtime's snapshot of canonical uncommitted work. Only this dossier and its two companions belong to this handoff. No source/data admission, genome construction, ticket closure, or remote push was performed.

**Decision:** D4's contrast identities and reported quantities are established. Exact normalization details remain incompletely specified. D5's design segment coordinates and the exact **Syn61∆3(ev5)** accession are established; an exact reconstruction of the partially recoded isolates is **not** established. The workbook contains **seven named omics profiles**, including debugged Seg30–35, but does not establish seven individually identified genome sequences.

Companions: `recoded_ecoli_evidence__20261007.json` contains full retrieval URLs, byte sizes, SHA-256 hashes, mechanically matched quotes, every omics column header, all 74 SRA run records, numerical checks, and unresolved facts. `recoded_ecoli_evidence__20261007.segments.tsv` contains all 88 design segment features with explicit 1-based inclusive coordinates and original feature indices. Evidence recommendations below do not themselves admit data or authorize a locus join.

## Located sources and assessment

The [article](https://doi.org/10.1038/s41467-026-74300-9), PMID 42331836 / PMC13287592, and its publisher-deposited [Europe PMC supplementary bundle](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC13287592/supplementaryFiles) were fetched afresh. Every member of the nested Source Data archive matched the corresponding canonical input byte-for-byte. Source IDs below resolve to the companion manifest; its hashes describe the files actually read.

| Source ID | Primary artifact and located evidence | Match and assessment |
| --- | --- | --- |
| article | FullTextXML: Sec10, Sec17, Sec19, Sec27, Sec28 | Exact study; admit with normalization and wavelength caveats |
| data1 | Supplementary Data 1, `Strains & Plasmids!A2:D12`; construct and deletion-cassette sheets | Exact strain inventory; D2 explicitly identifies ev5 accession; constructs alone are not isolate genomes |
| data2 | Supplementary Data 2, `Fitness_Source_data!A1:Y70`, `Biolog_Source_data!A1:B9`, eleven 96-row assay sheets | Exact measurements; admit with no-growth, aggregation and strain-label caveats below |
| data3 | Supplementary Data 3, `Legend!B3:C9`, row 1 and all data rows of five sheets | Exact processed omics; admit with explicit contrast and normalization limits |
| data4 | Supplementary Data 4, `Identified_DNA_synthesis_errors!A1:H953` | 952 synthesis-error rows; historical errors, not a complete final-isolate patch |
| data5 | Supplementary Data 5, eight sheets including separate unedited/debugged Seg30–35 | Exact mutation evidence for named variants; insufficient for all profiled genomes |
| data6 | Supplementary Data 6, MDS42 and Syn61 cryptic-ORF tables | Exact ORF evidence; no segment boundaries or ev5 reconstruction manifest |
| data7 | Supplementary Data 7, `Ec_Syn57_troubleshooting` | Descriptive edit history; insufficient as a coordinate-resolved genome patch |
| design | `Ec_Syn57.gb`, `misc_feature` records with segment note | Exact complete design; reject as a profiled partial-isolate genome |
| moesm1 | Supplementary Information PDF: p5 Note 5, p30 Fig. 18, p33 Fig. 20, Supplementary Method 1 | Exact final supplement; the three named pages were rendered and visually inspected |
| moesm6 | Figure Source Data workbook, `Supplementary Figure 18` and `Supplementary Figure 20` | Exact independent table locations for the Seg30–35 contrasts |
| sra | PRJNA1088510 runinfo: Run, SampleName, LibraryStrategy, BioSample | Exact deposited sample names; no separately named debugged RNA/Ribo set |
| AP012306.1 | [MDS42 GenBank record](https://www.ncbi.nlm.nih.gov/nuccore/AP012306.1), source and ORIGIN | Exact public parent reference; partial match to the study's sequenced stock |
| CP000948.1 | [DH10B GenBank record](https://www.ncbi.nlm.nih.gov/nuccore/CP000948.1), source and ORIGIN | Exact public parent reference; study-stock equality unverified |
| CP116771.1 | [Syn61 delta3(ev5) GenBank record](https://www.ncbi.nlm.nih.gov/nuccore/CP116771.1), source and ORIGIN | Exact named evolved strain; usable without raw-read assembly |
| software | [Zenodo 19682030](https://doi.org/10.5281/zenodo.19682030), `churchlab/recoli57` v1.0.0 | Historical 2016 design scripts, not a final 2026 isolate recipe |

Crossref's current record contains no correction/update relationship, and the Europe PMC core record contains no correction/retraction entry. An exact-DOI correction search found no notice. Zenodo reports this as its latest version. These are bounded checks as of retrieval, not a guarantee against later corrections.

## D4: contrasts, quantities and provenance

All fold changes below have **test/reference** orientation. The same reference applies to both read-count LFC columns, both EdgeR LFC columns and Delta_LFC within a sheet.

| Supplementary Data 3 sheet | Test | Reference | Replicate RPKM columns | Fold-change columns | Gene rows |
| --- | --- | --- | --- | --- | ---: |
| `Seg9-18_36-44_46-49_51-59` | Named partially recoded MDS42 derivative | MDS42 | Control RNA C:E, test RNA F:H; control Ribo I:K, test Ribo L:N | RNA O/P; Ribo R/S; Delta U | 3,642 |
| `Seg30-35` | Unedited Seg30–35 profile | MDS42 | Test RNA C:E, Ribo F:H; reference replicates absent from this sheet | RNA I/J; Ribo L/M; Delta O | 3,641 |
| `Seg30-35_debugged` | Debugged Seg30–35 profile | **Seg30–35 unedited** | Control RNA C:E, test RNA F:H; control Ribo I:K, test Ribo L:N | RNA O/P; Ribo R/S; Delta U | 3,634 |
| `Seg70-81` | DH10B-derived Seg70–81 | **DH10B** | Control RNA C:E, test RNA F:H; control Ribo I:K, test Ribo L:N | RNA O/P; Ribo R/S; Delta U | 4,258 |
| `Syn61_delta3_ev5` | Syn61∆3(ev5) | **MDS42** | Test RNA C:E, Ribo I:K; reference replicates absent from this sheet | RNA L/M; Ribo O/P; Delta R | 3,640 |

The explicit headers establish three contrasts. Supplementary Fig. 18 names MDS42 for Seg30–35; its figure-source table matches all **3,641** Seg30–35 Ribo EdgeR/P-value pairs exactly. Fig. 20 names the unedited/debugged contrast; all **3,634** corresponding pairs match. Article Sec10 explicitly identifies MDS42 for both Syn61 transcriptome and translatome comparisons. The figure captions' occasional DH10B-as-MDS42 label and `50-59` instead of `51-59` conflict with the actual workbook headers and SRA names; do not propagate those caption shortcuts.

| Field | Meaning and safe label | Limits |
| --- | --- | --- |
| `*_rpkm` | Source-reported RNA abundance or ribosome-footprint coverage, RPKM (reads per kilobase per million); three separate replicate columns | The exact library-size denominator, filtering and CDS-length implementation are not supplied; do not relabel TPM, counts or protein abundance |
| Syn61 `F:H`, `*_reads` | Three **Ribo read-count** columns | These are additional columns, not RPKM; integral counts must retain their own basis |
| `RNA_LFC`, `RIBO_LFC` | Source-reported log2 change calculated from read counts | Aggregation and zero/pseudocount rules are not specified; not reproducible merely as log2 of mean supplied RPKM |
| `RNA_LFC_EdgeR`, `RIBO_LFC_EdgeR` | Source-reported EdgeR log2 change | Sec19 names EdgeR 4.0.12; exact normalization, design matrix and filtering choices are not supplied |
| `RNA_P-value`, `RIBO_P-value` | Reported P-value for the corresponding assay | Supplementary figure captions describe adjusted P-values. Preserve this provenance; the adjustment procedure and family are not specified. Do not silently declare BH/FDR |
| `Delta_LFC` | Log2 change in translation efficiency, test/reference | **RIBO_LFC minus RNA_LFC**, not the difference of EdgeR estimates and not absolute translation efficiency |
| `Gene`, `Description` | Author row key and description | Mixed symbols, disambiguation suffixes and 53 `ECDH10B_RS…` keys in Seg70–81; not a universal locus-tag namespace |

Mechanical check: all **18,704** numeric Delta_LFC rows equal `RIBO_LFC - RNA_LFC` within 0.00010001, consistent with four-decimal rounding. Dash-marked rows are missing, not zero. All row identifiers are unique within their sheet; preserve suffixes such as `_1` and `_2`. The two Seg30–35 sheets have slightly different unedited-control RPKMs (e.g. thrL RNA replicate 1 is 1919.90477 versus 1919.75643); retain each published table's own controls, not a silently deduplicated copy.

**Condition match:** Sec19 describes paired RNA/Ribo libraries from three independent starter cultures, grown in LBL at 37°C/250 rpm to OD600 0.40–0.45 without growth antibiotics. Assay references were assembled/reannotated by the authors using MG1655 U00096.3 annotation homology; that is not evidence that rows are MG1655 loci or that stock genomes equal public parent accessions. Exact source-to-genome joins remain the coordinator's separate validation.

**Roster:** SRA contains 18 RNA and 18 Ribo runs: MDS42, DH10B, three partial Syn57 groups and Syn61∆3(ev5), each with three replicates. Supplementary Data 3 adds the debugged profile. Thus the six-record ticket inventory omitted a real measured condition, but the seventh profile cannot yet be declared one identified genome: Data 5 lists three debugged clones, and neither the sheet nor located supplement maps its three RNA/Ribo replicates to Clone 1/2/3. Do not merge this condition into unedited Seg30–35, select a clone by guess, or add organism records as a consequence of this evidence handoff. The MDS42 RNA control is labeled MDS42; its recA genotype must not be inferred solely from fitness-sheet ΔrecA controls.

## D5: genomes and segment evidence

| Genome artifact | Length | Can be used without raw-read assembly? | Identity boundary |
| --- | ---: | --- | --- |
| Ec_Syn57 design | 3,973,902 bp | Yes, exact published design | Not a measured isolate; Q2 permits its separately labeled use |
| AP012306.1 | 3,976,195 bp | Yes, exact public MDS42 reference | Not the exact study stock: Sec17 reports a 51-bp mrcB–hemL insertion absent from this accession |
| CP000948.1 | 4,686,137 bp | Yes, exact public DH10B reference | Equality to the supplier stock used here is not established |
| CP116771.1 | 3,977,501 bp | **Yes, the named evolved Syn61∆3(ev5) strain** | Data 1 `Strains & Plasmids!D2` explicitly cites it; GenBank source strain agrees. Do not replace with Syn61 design or Ec_Syn57 |
| Each profiled partial Syn57 isolate | Not established here | **No complete exact sequence established from retrieved processed artifacts** | Needs a matching released assembly or validated reconstruction from all edits and structural changes; read assembly is one possible route, not proven uniquely necessary |
| Debugged Seg30–35 | Not established here | No | Also needs clone/replicate identity; three candidate clone edit lists are not interchangeable |

File hashes for the three freshly fetched accession records are respectively `2790c379990112abbf8357f0fa3c39797850357582255f0f3db5b6913f25109c`, `1bdf5f5991d7ddea5919d7fb722f700084c9faf5cbec8481fc2a9c15ceeec754`, and `5e9ec698aea8de2e227670bec48251c05264dc92aebe637bbb2e99194dd48417`. The companion additionally pins their sequence-only hashes, so annotation-only changes can be distinguished from sequence changes. Ec_Syn57's file hash is `8c61aeebfb8fef71a9d01ceba2a2acdb8babdf96ac0aa01aae36b10d08f77f96`.

**Located segment annotation:** `misc_feature` + `/note="Geneious type: segment"` + `/standard_name`. There are 88 features covering segment numbers 0–86, with segment 10 split into `seg10_A` and `seg10_B`. Revised names include `seg5_2`, `seg22_3`, `seg61_2`, `seg64_3`. These suffixes must survive extraction.

| Profile's selected block | First–last coordinates on **Ec_Syn57 design**, 1-based inclusive | Caution |
| --- | --- | --- |
| Seg9–18 | 404,328–856,008 | Includes both 10A and 10B, whose annotations overlap |
| Seg36–44 | 1,634,697–2,046,443 | Separate block; excludes segment 45 |
| Seg46–49 | 2,090,966–2,272,085 | One-base gap between segment feature annotations |
| Seg51–59 | 2,317,534–2,730,295 | Excludes segment 50 |
| Seg30–35, both profiles | 1,360,444–1,634,696 | 1,405-bp gap between seg32 and seg33 features contains the inverted infC/rpmI/rplT unit |
| Seg70–81 | 3,195,108–3,742,394 | These are not DH10B coordinates |

The table gives **block envelopes**, not validated native-genome replacement intervals. The TSV preserves the individual source features. Globally there are five annotation overlaps (1,896, 129, 100, 3,029 and 108 bp) and two gaps (1,405 and 1 bp). A naïve concatenation duplicates overlap sequence; a naïve feature union drops the essential-gene unit in the seg32/33 gap. Supplementary Method 1, Segment 32, independently explains the relocated antisense expression unit. Segment boundaries therefore require explicit coordinate reconciliation and edit provenance, not a fixed offset or an assumed 50-kbp grid.

Why exact partial genomes remain unresolved:

- Data 4 records original synthesis errors, some later repaired. Data 5 is not a uniformly complete variant file: e.g. `E_coli_DH10B_Seg_70-81!A2:F2` describes a transposase insertion but leaves its mutation cell blank. Neither inserted sequence nor a complete structural patch is supplied there.
- Data 5's large composite strain is `MDS42_d_recA_Seg_9-18_36-59`, which includes segments 45 and 50; it is not the omics profile `Seg9-18_36-44_46-49_51-59`. SRA has WGS pairs for both names. Do not borrow the former's mutations for the latter.
- The seven SRA WGS groups comprise Seg1–8, Seg19–29, Seg30–35, Seg70–81, Seg82–0, and both large composite variants. There is no separately named debugged WGS group or Seg60–69 group in this runinfo snapshot. The WGS roster, omics roster and physical strain inventory are different inventories.
- Data 5's debugged sheet reports clone-specific 5′ UTRs and promoter insertions, not an accessioned genome or a mapping from assay replicate to clone. Source Data 2 independently lists three debugged clone growth rows (41–43).
- DH10B construction changed recA: Supplementary Method 1, p55, describes reversal of recA1 followed by deletion; Data 1 names the final Seg70–81 strain ΔrecA. A DH10B-plus-design-segments sequence that retains public-reference recA1 is not this isolate.

Zenodo's archive contains `src/refactor_config.py` (`GENOME_SOURCE` points to `data/mds42_full.gbk`) and `src/post_processing/genome_segment_partitioner.py`. The latter accepts already-chosen segment start/end positions to partition DNA for synthesis. The README identifies the 2016 design workflow. No final 2026 per-isolate boundary/mutation manifest was found. Its historical scripts do not resolve the later debugging history, and were not executed.

## Supplementary Data 2: growth and Biolog

**Growth:** actual nonempty strain rows are **69**, not 73 (worksheet dimensions include trailing blank rows): 52 numeric growth records and 17 no-growth records. B/D contain mean doubling time (minutes) and maximum OD600; C/E contain reported SD; F:O and P:Y contain ten corresponding replicates. All 52 numeric rows reproduce the means and **population SD (`ddof=0`)**, within 2.42×10⁻¹³. Do not recompute with sample SD (`ddof=1`). The prose calls these biological replicates; the sheet provides ten measurements per row, not an independent starter-culture mapping for each column.

Sec27 specifies 2×YT or M9 + 2% D-glucose, aerobic 37°C microplate growth, 800 rpm, OD600 every nine minutes, GrowthRates 4.4. M9 rows are separately labeled. Long-term no-growth assessment used three cultures over 14 days; it is not ten zero doubling times. Preserve `0 (no growth detected)` as a categorical outcome with unavailable doubling time. Numeric zero OD/SD/replicate placeholders on those rows must not be read as measured kinetic estimates.

**Biolog:** eleven sheets each contain five plate blocks × 96 wells = 480 entries. Columns D/I/N/S/X are reported `Max Height`; retain plate, well, substrate and exact source sheet. These are comparisons against MDS42, supported by `Biolog_Source_data!A1` and Note 5's definition as differences in maximal optical density. They are not absolute growth, percentages or fold changes. Negative values must survive. The two underlying independent replicate measurements are not separately supplied in these tables.

Sec28 describes PM01/02/04/06/09, 37°C for 48 h, measurements every 20 minutes, with plate-specific nutrient supplementation. It specifies **590 nm** acquisition but later calls the averaged values **OD600**. Therefore label conservatively as **source-reported Biolog Max Height difference vs MDS42 (optical-density basis; wavelength inconsistent in source)**. The exact background subtraction, curve processing and per-well normalization cannot be recovered from the supplied summary tables. Do not claim a fully specified OD600 assay.

| Numeric check | Workbook sum over 480 wells | Workbook mean | Article Table 1 |
| --- | ---: | ---: | ---: |
| Syn61∆3(ev5) | −31.87072466 | −0.06639734 | −31.87 |
| Seg30–35 | −8.03012464 | −0.01672943 | −8.03 |
| Seg9–18/36–44/46–49/51–59 | −52.85655083 | −0.11011781 | −52.86 |

The published score numerically matches the **sum of per-well entries**, whereas Note 5/Table 1 use mean language. Report a reproduced sum as a sum, not a 480-environment mean. This does not resolve whether the authors meant averaging the two replicates before summation. All eleven sums/means are in the companion.

Keep `MDS42_Seg80-0` unresolved: the physical/WGS strain is Seg82–0, while this Biolog sheet says Seg80–0. Its sum is −10.286431, also not the Table 1 Strain 10 value −10.26 after ordinary two-decimal rounding. Neither renaming nor overwriting values is justified by the located evidence. Growth, Biolog and omics condition rows with the same segment labels also need explicit evolved/troubleshot-stage matching before cross-assay attachment.

## Mechanical verification and remaining claim gates

All 12 short quotes in the JSON were mechanically located after whitespace normalization. Examples: article Sec19, “three independent replicates” and “using the standard settings”; PDF p30, “parental MDS42”; PDF p33, “its final, debugged variant”; Data 1 D2, “GenBank: CP116771.1”. Each entry includes source hash and location. Workbook headers, numeric checks and GenBank coordinates were read from fresh files, not copied from the ticket. No semantic classification service was required: these checks were exact lookups/arithmetic, with the remaining provenance assessment performed explicitly.

| Claim gate | Result and dependent work |
| --- | --- |
| D4-reference | **Verified:** all five contrast references, including debugged/unedited and Syn61/MDS42 |
| D4-basis | **Verified with caveat:** reported RPKM, read-count LFC, EdgeR LFC, P-values and Delta_LFC are distinct; missing detailed normalization stays visible |
| D4-debug-identity | **Open:** replicate-to-clone/raw-run mapping; gates an exact genome assignment to the debugged profile |
| D5-Syn61 | **Verified:** CP116771.1; no raw-read assembly needed for this named evolved genome |
| D5-segments | **Verified on design only:** all 88 source features; no parental coordinate join implied |
| D5-isolates | **Open:** exact native intervals, stock differences, structural variants and final mutation history for each partial isolate |
| Fitness-basis | **Open in part:** Biolog wavelength/processing and mean/sum wording conflict; growth summaries and no-growth semantics established |
| Fitness-identity | **Open:** Seg80–0/Seg82–0 discrepancy and cross-assay evolution-stage identity |

**Recommendation and confidence:** high confidence in the located column labels, arithmetic, accession identity and design feature extraction. Use CP116771.1 for the named ev5 genome, keep exact public-parent references labeled as references, and admit the complete Ec_Syn57 design only under its own design identity. Source-reported omics can be retained with explicit comparisons and normalization caveats; genomic placement still requires a validated join. Do not declare D5 globally closed. The most likely way the negative reconstruction conclusion is wrong is an additional released author assembly or supplementary mapping outside the retrieved bundle; an accessioned per-isolate assembly plus assay/clone mapping would change it immediately.

## Search/access limits and validation

Searched the fresh article/XML, Supplementary Data 1–7, figure Source Data, relevant Supplementary Information sections, reporting summary/peer-review text, the complete SRA runinfo inventory and Zenodo archive. Targeted text searches included `RPKM`, `Biolog`, `Max Height`, `normaliz`, `debugged`, `genome sequence`, `Segment 30`, `Segment 70`, and `recA`. The exact-DOI correction query and `19682030 Syn57` search are recorded here. Read-only public routes required no account or credential action.

Addgene 239395 and 239397 were inaccessible via web and returned HTTP 403 to a plain direct request; no bypass was attempted. Addgene 174514 was readable, but no accession claim depends on it. No claim is made that missing mappings do not exist elsewhere. No raw sequencing reads were assembled and no Claude Science application was used. Canonical `AGENTS.override.md` and `CLAUDE.md` were absent.

Repository gates on the final documentation-only patch:

| Gate | Observed result |
| --- | --- |
| Evidence checks | 24 hashed sources, 12 mechanically matched quotes, all 5 sheets, 18,704 Delta checks, 88 segment features, growth means/population SD and 74 SRA records verified |
| `npm test` | 1,269 passed, **3 failed**: existing count assertions in `metric-family-order.test.mjs:154` (65 vs 64), `metric-help.test.mjs:25` (215 vs 214), `staged-loader.test.mjs:804` (162 vs 161) |
| `.venv/bin/python -m pytest -q` | 779 passed, **4 failed**, 1 skipped, 36 subtests passed; failures in citation inventory (`wang-2016-limonene`), source count (164 vs 163), PXD005105 `ratio` versus expected `abundance` column, and metric count (197 vs 196) |
| `.venv/bin/python tools/validate_contract.py` | 116 passed, 0 failed, 1 declared spliced-CDS exemption |

The first Python run also lacked nine UTEX raw inputs. Copying those existing canonical files into this worktree resolved those input-dependent failures; the results above are from the recheck. `git diff` confirms no changes to `site/`, `tests/`, `tools/`, `scripts/` or tracked `data/` against actual base `2db9d3e`, so the remaining failures belong to the inherited snapshot and were not repaired in this evidence-only assignment. No UI files changed; rendered browser validation is not applicable. All D4/D5/Fitness claim gates above remain explicit; the parent ticket is still open.
