# Cyano condition metadata gaps: public sample and run evidence (DEM-280)

- **Analyst:** claude-evidence-analyst, run of 2026-10-07 (UTC retrievals 14:59 to 15:18).
- **Coordinator:** interactive Codex agent-deck session bfdd1b08-1791384632 (cyano-general-ticket-closing).
- **Parent ticket:** `docs/notes/tickets/O_condition-metadata-gaps__20261005.md`, work item 2.
- **Worktree:** `/Users/Rohin/multica_workspaces_desktop-api.multica.ai/demeter-5df2b7b4e167/dem-280-e449c0e66276/worktree`, branch `agent/claude-evidence-analyst/dem-280`, baseline `357379f4ff7307c40791bf140aef6ae905bfc1fb` (worktree baseline commit `9396e45`). **No file in the repository was changed and no commit was made**; every deliverable sits under `/tmp/cyano-condition-20261007` as the handoff directed.
- **Boundary:** archive attributes are evidence, not resolved conditions. Nothing here admits a source, edits release data, decides a licence, or sends a query. Values below enter only as package B addendum candidates through the coordinator's intake.

## 1. Question and the decision it informs

From the handoff: "Retrieve BioSample and SRA/ENA sample/run attributes for candidate GEO series missing growth metadata, prioritizing GSE122841, GSE252562, GSE45762, GSE237858, GSE227397, GSE225426, GSE311172, GSE140121, GSE327989 and the eleven missed/misclassified records in cross-strain ticket. Expand to remaining candidate GEO series if feasible, report complete attempted coverage and every unretrieved record; do not infer unreported values from other studies."

The decision it informs is work item 2 of the parent ticket: which missing growth-condition cells can be filled from public archive records (and so stop making pairs undecidable), which are contradicted inside the archives, and which can only be filled by a depositor reply (work item 4).

## 2. Headline findings

1. **GEO-brokered BioSample, SRA and ENA records mirror the GEO sample characteristics verbatim.** For 41 of the 43 GEO series they add no growth-condition field that GEO lacks. The SRA study abstract is GEO's summary and overall design joined; the SRA library-construction protocol is GEO's extract protocol. The two exceptions are deposits not brokered by GEO: GSE327989 (DDBJ) and GSE79726 (user-submitted BioSamples); their extra fields are `sample_type`, `isolation_source` and replicate descriptions, none a growth condition (rows CR-044 and the GSE79726 inventory).
2. **Fourteen expression-array series have no BioSample or SRA record at all** (GSE14225, GSE22468, GSE28430, GSE42542, GSE47015, GSE48901, GSE55637, GSE102914, GSE18902, GSE50908, GSE50919, GSE50920, GSE52486, GSE59112; BioProject-to-BioSample link count 0). GEO is their only public archive record.
3. **The eleven reinstated records now have first condition sets, quoted from the archives** (rows CR-045 to CR-148): temperature, light intensity, light regime, culture format and replicate structure for the seven Kondo-laboratory arrays (medium, CO2, lamp class and growth phase are not in GEO for any of them); complete sets for GSE114693 (except growth temperature), GSE29264 (RNA-seq arm) and E-MEXP-1657 (except light regime); medium, replicates and a caveated growth phase for PXD082340.
4. **For the nine priority series the archives settle structure and expose contradictions, not the missing values.** GSE122841 and GSE140121 say "in triplicate" but hold one BioSample, one SRA experiment and one run per genotype x condition (CR-001, CR-036). GSE252562's six samples titled "8 cycles LD8:16" carry the attribute "8 cycles of LD16:8" in GEO, BioSample and ENA alike, while the SRA title repeats the GEO title (CR-008 to CR-011). GSE45762's archives map every run to a titled sample and carry no "Sample N" numbering, so they cannot arbitrate the workbook's header-versus-sample-sheet disagreement (CR-015, CR-016). GSE311172's archive never states whether light was continuous (package B's "continuous" is an inference, CR-032), holds two runs per experiment matching the stated technical replicates (CR-033), and its count matrix shifts the adapted-population label for seven samples (CR-034). No archive links a publication for GSE225426, GSE311172, GSE140121, GSE327989, GSE114693, GSE28430 or GSE47015 (CR-031, CR-035, CR-041, CR-042, CR-117 and the source table).
5. **Light intensity and CO2 for GSE122841, GSE140121 and GSE227397, CO2 for GSE252562, GSE237858 and GSE225426, and growth phase for most of them, are silent in every archive field read** (hand-read, with the bounded Jev check agreeing). Only depositor replies can fill them.
6. **Coverage:** 287 retrievals, all HTTP 200; 43 GEO series (1,256 GEO samples), 852 BioSample records, 852 SRA experiments with 879 runs, 852 ENA sample records, 43 BioProject records, 9 GEO processed supplementary files, the PRIDE project, file listing and sample-annotation workbook for PXD082340, and the BioStudies record, IDF and SDRF for E-MEXP-1657. No record was refused; no CAPTCHA, meter or credential was met. Raw reads were not downloaded.

## 3. Candidate sources

One row per record. "Archive fields beyond GEO" lists the BioSample, SRA or ENA field names whose words are absent from the GEO fields of the same samples, after dropping boilerplate (titles, accessions, library descriptors, the loader attribute, the abstract and library protocol copies). Match to the question is exact for every record: organism *Synechococcus elongatus* PCC 7942 as deposited (GSE227397 and GSE288532 are deposited as "Synechococcus elongatus" without a strain in the organism field, as package B already notes), the archive record of the very deposit the condition record describes.

| Record | Group | GEO samples | BioSample | SRA exp / runs | ENA samples | Publication linked (GEO / BioProject) | Archive fields beyond GEO (non-boilerplate) | Candidate rows |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GSE122841 | priority | 4 | 4 | 4 / 4 | 4 | 30619416 / 30619416 | none | 7 |
| GSE252562 | priority | 36 | 36 | 36 / 36 | 36 | 39236161 / 39236161 | none | 7 |
| GSE45762 | priority | 17 | 17 | 17 / 17 | 17 | 23919451 / 23919451 | none | 4 |
| GSE237858 | priority | 12 | 12 | 12 / 12 | 12 | 38739791 / 38739791 | none | 4 |
| GSE227397 | priority | 24 | 24 | 24 / 24 | 24 | 37349485 / 37349485 | none | 4 |
| GSE225426 | priority | 10 | 10 | 10 / 10 | 10 | none / none | none | 5 |
| GSE311172 | priority | 23 | 23 | 23 / 46 | 23 | none / none | none | 4 |
| GSE140121 | priority | 4 | 4 | 4 / 4 | 4 | none / none | none | 6 |
| GSE327989 | priority | 12 | 12 | 12 / 12 | 12 | none / none | comment; description; isolation_source; sample.description; sample_type | 3 |
| GSE14225 | reinstated (eleven) | 104 | 0 | 0 / 0 | 0 | 19666549 / 19666549 | none | 9 |
| GSE22468 | reinstated (eleven) | 29 | 0 | 0 / 0 | 0 | 21896749 / 21896749 | none | 9 |
| GSE28430 | reinstated (eleven) | 21 | 0 | 0 / 0 | 0 | none / none | none | 9 |
| GSE42542 | reinstated (eleven) | 4 | 0 | 0 / 0 | 0 | 23913328 / 23913328 | none | 9 |
| GSE47015 | reinstated (eleven) | 9 | 0 | 0 / 0 | 0 | none / none | none | 9 |
| GSE48901 | reinstated (eleven) | 12 | 0 | 0 / 0 | 0 | 24244001 / 24244001 | none | 9 |
| GSE55637 | reinstated (eleven) | 28 | 0 | 0 / 0 | 0 | 26058805 / 26058805 | none | 9 |
| GSE114693 | reinstated (eleven) | 78 | 78 | 78 / 78 | 78 | none / none | source_name | 11 |
| GSE29264 | reinstated (eleven) | 13 | 9 | 9 / 9 | 9 | 21612627 / 21612627 | read_name_barcode_proc_directive | 9 |
| GSE102914 | remaining candidate | 16 | 0 | 0 / 0 | 0 | 31161548 / 31161548 | none | 3 |
| GSE103462 | remaining candidate | 8 | 8 | 8 / 8 | 8 | 29241543 / 29241543 | none | 2 |
| GSE103463 | remaining candidate | 8 | 8 | 8 / 8 | 8 | 29241543 / 29241543 | none | 2 |
| GSE103606 | remaining candidate | 106 | 106 | 106 / 106 | 106 | 29241543 / 29241543 | none | 0 |
| GSE103644 | remaining candidate | 6 | 6 | 6 / 6 | 6 | 29241543 / 29241543 | none | 2 |
| GSE103704 | remaining candidate | 36 | 36 | 36 / 36 | 36 | 29241543 / 29241543 | none | 3 |
| GSE104203 | remaining candidate | 60 | 60 | 60 / 60 | 60 | 29239721 / 29239721 | perturbation | 0 |
| GSE104204 | remaining candidate | 97 | 97 | 97 / 97 | 97 | 29239721 / 29239721 | perturbation | 0 |
| GSE105774 | remaining candidate | 36 | 36 | 36 / 36 | 36 | 29241543 / 29241543 | none | 2 |
| GSE18902 | remaining candidate | 23 | 0 | 0 / 0 | 0 | 20018699 / 20018699 | none | 1 |
| GSE205443 | remaining candidate | 25 | 25 | 25 / 27 | 25 | 35814646 / 35814646 | none | 1 |
| GSE205445 | remaining candidate | 46 | 46 | 46 / 48 | 46 | 35814646 / 35814646 | none | 0 |
| GSE222067 | remaining candidate | 12 | 12 | 12 / 12 | 12 | 36819058 / 36819058 | none | 3 |
| GSE254350 | remaining candidate | 32 | 32 | 32 / 32 | 32 | 39188729 / 39188729 | none | 1 |
| GSE288532 | remaining candidate | 30 | 30 | 30 / 30 | 30 | 40055679 / 40055679 | none | 0 |
| GSE335065 | remaining candidate | 36 | 36 | 36 / 36 | 36 | 39455633 / 39455633 | none | 3 |
| GSE50908 | remaining candidate | 13 | 0 | 0 / 0 | 0 | 24315105 / 24315105 | none | 0 |
| GSE50919 | remaining candidate | 2 | 0 | 0 / 0 | 0 | 24315105 / 24315105 | none | 0 |
| GSE50920 | remaining candidate | 49 | 0 | 0 / 0 | 0 | 24315105 / 24315105 | none | 1 |
| GSE50922 | remaining candidate | 108 | 37 | 37 / 37 | 37 | 24315105 / 24315105 | time since iptg addition | 0 |
| GSE51112 | remaining candidate | 18 | 18 | 18 / 18 | 18 | 24315105 / 24315105 | time since iptg addition | 0 |
| GSE52486 | remaining candidate | 7 | 0 | 0 / 0 | 0 | 24315105 / 24315105 | none | 0 |
| GSE59112 | remaining candidate | 12 | 0 | 0 / 0 | 0 | 25127221 / 25127221 | none | 2 |
| GSE79726 | remaining candidate | 6 | 6 | 6 / 6 | 6 | 27488818 / none | comment; description; isolation_source; sample_type | 3 |
| GSE89999 | remaining candidate | 24 | 24 | 24 / 24 | 24 | 28430105 / 28430105 | none | 1 |
| PXD082340 | reinstated (eleven) | n/a (PRIDE: 18 RAW files, 6 strains x 3) | n/a | n/a | n/a | none (references empty) | PRIDE project protocols, sample annotation workbook | 11 |
| E-MEXP-1657 | reinstated (eleven) | n/a (ArrayExpress: 22 source names, 11 two-colour arrays) | n/a | n/a | n/a | title only, no DOI/PMID | IDF grow protocol, SDRF factors | 10 |

## 4. Extracted values

All values are in `candidate_rows.tsv` (180 rows, one per dataset x condition set x field; the same rows as JSON in `candidate_rows.json`). Each row carries the proposed value, unit and status, the archive record and field, the verbatim quote, the request URL, the UTC retrieval time, the local snapshot path and its SHA-256, the mechanical quote-match result, the sample scope, the conflicts and notes. Status vocabulary: `reported`, `reported with caveat`, `conflicting (...)`, `not reported in archive`, plus a few descriptive statuses for structural rows. Quote check: 93 of 93 quoted rows re-matched against their own snapshot after NFKC normalisation and whitespace collapse (the repository's `tools/check_addendum_quotes.py` rule), every snapshot SHA-256 recomputed and equal to the manifest value; 87 rows are absence claims and carry no quote. Of the 89 "not reported in archive" rows, 65 were hand-read by the analyst and 24 (rows CR-157 to CR-180, the remaining candidate series' gap cells) rest on the bounded Jev check only, as their notes say.

### 4.1 Priority nine (rows CR-001 to CR-044)

| Series | What the archives add | Rows |
| --- | --- | --- |
| GSE122841 | 4 GSM = 4 SAMN = 4 SRX = 4 SRR against "in triplicate" (conflict); BG11 named only in the H2O2 clause of a protocol attached to the normal samples (caveated fill); shaking stated; light, regime, lamp, CO2 silent | CR-001 to CR-007 |
| GSE252562 | the LD8:16/LD16:8 contradiction is inside every archive copy (GEO title vs characteristic, BioSample title vs attribute, ENA attribute, SRA title); the overall design also mis-defines the short day; count-matrix columns are MJ ids with no photoperiod; 3 titled replicates per group; CO2 and phase silent | CR-008 to CR-014 |
| GSE45762 | run-to-sample mapping unambiguous by title (17 = 17 = 17 = 17) but the archives carry no sample numbering; workbook header and Sample Info sheet disagree as recorded; initial OD730 0.15 at inoculation; light continuity silent | CR-015 to CR-018 |
| GSE237858 | ~40 µE is the only archive statement (BioSample/SRA/ENA have no protocol field); lamp "fluorescent" is in package B though null in the condition-record JSON; CO2 and phase silent | CR-019 to CR-022 |
| GSE227397 | a 12 h light / 12 h dark alternation at sampling (caveated); light intensity, lamp and CO2 silent | CR-023 to CR-026 |
| GSE225426 | 2 samples per condition (A, B) across titles and the two processed workbooks, kind not stated; CO2, format, phase silent; no publication in GEO, BioProject or SRA | CR-027 to CR-031 |
| GSE311172 | light regime not stated (package B inferred "continuous"); 2 runs per experiment = stated technical replicates, 46 count columns; count-matrix population labels shifted against titles and characteristics; no publication | CR-032 to CR-035 |
| GSE140121 | same triplicate-versus-4-records conflict as GSE122841; light, regime, lamp, CO2 silent (package B's light value is from the title-matched paper); no publication link | CR-036 to CR-041 |
| GSE327989 | DDBJ deposit, no publication link anywhere; "harvested after 4 days" is a time, not a phase (package B's "exponential" is from the paper); the extra BioSample fields are not conditions | CR-042 to CR-044 |

### 4.2 The eleven reinstated records (rows CR-045 to CR-148)

| Record | Condition set now quoted from the archive | Silent in the archive |
| --- | --- | --- |
| GSE14225 (104) | 30 °C; 46 µmol photons m-2 s-1 (light samples); LL (70) or DD (30, 3 with rifampicin) per title; continuous culture; two independent experiments per course (single for rifampicin) | lamp, CO2, medium, phase |
| GSE22468 (29) | 30 °C; DD after two 12:12 cycles; continuous culture; two independent experiments; the 46 µmol value sits only on the gDNA reference sample | light intensity of the DD samples, lamp, CO2, medium, phase |
| GSE28430 (21) | 30 °C; LL after two 12:12 cycles; continuous culture; one time course per genotype; the 46 µmol value sits only on the gDNA reference sample; no publication link | light intensity of the LL samples, lamp, CO2, medium, phase |
| GSE42542 (4) | 30 °C; 40.5 µmol; LL; continuous culture; one sample per condition | lamp, CO2, medium, phase |
| GSE47015 (9) | 30 °C; 40 µmol; LL; continuous culture; a single experiment; no publication link | lamp, CO2, medium, phase |
| GSE48901 (12) | 30 °C; 40 µmol; LL after two 12:12 cycles from a continuous culture; a single experiment | lamp, CO2, medium, phase |
| GSE55637 (28) | 30 °C; 40 µmol; light or dark from ZT 12; continuous culture; duplicate experiments (quadruplicate at light 0 min) | lamp, CO2, medium, phase |
| GSE114693 (78: 6 ChIP + 72 RNA-seq) | 100 µE cool fluorescent; 1% CO2 bubbled; BG-11 (+ HEPES-KOH; characteristics say BG-11M; + IPTG for the OX-D53E sets); tissue culture flasks; OD750 held near 0.3; two 12:12 cycles then constant light (sigF2delta) or light + IPTG (OX-D53E family); 2 biological replicates per time point; no publication link; the overall design's wild-type RNA-seq has no wild-type sample | growth temperature (30 °C appears only in the ChIP rifampicin step) |
| GSE29264 (13: 3 RNA-seq + 6 ChIP + 4 tiling) | 30 °C; ~25 µmol cool white fluorescent; 1% CO2 at 500 mL/min; modified BG-11 (FeNH4 citrate 0.0010 g/L, citric acid 0.00066 g/L); 6-L spinner flask continuous culture at OD750 0.15; two 12 h cycles then LL; RNA-seq = one pooled 76-96 h sample in 3 technical replicates | none for the RNA-seq arm |
| PXD082340 (18 RAW) | BG11; 7-day cultures resuspended to OD750 = 1 (caveat: resuspension, not growth density); 3 independent cultures x 6 strains per the sample-annotation workbook; licence field CC0; LFQ workbook and pdResult listed, not retrieved; no publication | temperature, light, regime, lamp, CO2, format |
| E-MEXP-1657 (22 source names, 11 arrays) | 250 mL gas wash bottles; BG11 (Rippka 1989) with or without iron; 2% CO2-enriched air bubbled; 30 °C water bath; 100 µmol fluorescent bulbs; inoculated at OD750 0.3, harvested at 24 h or 72 h; 3 biological cultures (2 for K10) in dye-swap pairs; publication title only | light regime |

### 4.3 Remaining 25 candidate series (rows CR-149 to CR-180)

**Coordinator request of 2026-10-07 15:03 UTC (GSE50920 / GSE50922 flask temperature):** hand-read after the request. The 49 GSE50920 flask array samples carry no temperature in any GEO field (growth protocol on both channels, treatment protocol, characteristics, summary, design); the series has no BioSample or SRA record (BioProject PRJNA219376 links none). Inside the SuperSeries GSE50922 the same 49 samples carry the same protocol, and its 37 BioSample/SRA records belong only to the GSE51093 ChIP-seq and GSE51112 RNA-seq samples. GSE51112's own flask protocol states 30 °C (already package B row 53); it is recorded beside the GSE50920 absence and not transferred (rows CR-154 to CR-156). The one last-blocker pair the coordinator named therefore stays undecidable on the archive side. J1 (the turbidostat lamp) was not reopened; no row touches it.

Hand-authored fills: GSE335065 row 41 culture format (50 mL vented tubes, 25 mL) and replicates (2 to 3 biological) with the caveat that the tube-experiment membership is given only by title prefix (CR-149, CR-150); GSE18902 experiment 1 = 16 samples, experiment 2 = 7 (CR-151); GSE103704 two replicates per genotype x time from the characteristics (CR-152); GSE205443 flask-format CO2 silent, since the bubbling-tube statements belong to the other format (CR-153); GSE50920 and GSE50922 flask temperature as above (CR-154 to CR-156). The other 24 rows record, per gap cell of the condition-records JSON, that the archive is silent under the bounded check (Jev max p < 0.5 on every protocol, characteristic, summary and design text); none of those cells was hand-read in this sweep, and their notes say so. Four mixed or SuperSeries records (GSE103606, GSE104204, GSE205445, GSE50922) have no condition set of their own and get no rows; their subseries do.

## 5. Assessment

Per source type, as evidence for condition cells:

- **GEO series and sample records:** admit as the archive statement of record for every series; they were already package B's archive source, and this sweep re-read them in full. The new material is the eleven records' condition sets and the structural rows.
- **BioSample, SRA experiment/run and ENA sample records:** admit with caveat. For GEO-brokered deposits they are copies of GEO and settle only counts (samples, experiments, runs) and non-GEO-brokered extras. They never fill a condition cell that GEO leaves empty in this candidate set.
- **BioProject records:** admit for one fact only, whether a publication is linked.
- **GEO processed supplementary tables and the PRIDE sample-annotation workbook:** admit with caveat as sample-identity and replicate-structure evidence (column headers, Sample Info sheets); none carries a growth condition.
- **Jev bounded check:** an aid to reading, recorded in `jev_cache.jsonl`, `jev_axes_results.json` and `jev_validation.json`; not itself evidence. Validation on the 20 hand-read records (180 record x axis cells): 176 agree at threshold 0.5. The four disagreements: GSE122841 culture format ("with shaking", Jev 0.31, analyst yes); GSE47015 lamp (Jev 0.52 on "time: LL36 (hour 12)", analyst no); GSE47015 and GSE48901 replicates ("a single experiment", Jev 0.21 and 0.47, analyst yes). Short sample codes drew spurious 0.5 to 0.7 answers on several axes and were excluded from the summaries (`kind = sample source name`).

Against the parent ticket's depositor-query table (work item 4), what the archives settle and what remains:

| Record | Settled by the archives | Still for the depositor |
| --- | --- | --- |
| GSE122841 | exactly one deposited record per condition in GEO, BioSample, SRA and ENA; BG11 named only in the H2O2 clause | CO2, light; whether the triplicate was pooled or never deposited |
| GSE252562 | the six samples' titles and attributes disagree in every archive; no archive copy or processed file resolves it | which photoperiod the six had |
| GSE45762 | raw reads map to titled samples unambiguously; the workbook's own two sheets disagree | which count column is which sample |
| GSE237858, GSE227397 | GEO is the only archive statement of light (~40 µE for GSE237858; none for GSE227397) | which light value applies |
| GSE225426, GSE311172, PXD023591 | no publication linked for GSE225426 and GSE311172; CO2, format, phase (GSE225426) and light regime (GSE311172) not stated; PXD023591 was outside this sweep's record list | growth conditions and reuse statement |
| GSE140121, GSE327989 | no archive links a paper to either deposit | confirmation that the matched paper describes the deposit |

## 6. Recommendation

Treat the BioSample/SRA/ENA route as exhausted for this candidate set: it fills no missing growth-condition cell, and further time there would be wasted. Take the eleven records' condition sets (CR-045 to CR-148) and the priority structural and conflict rows (CR-001 to CR-044) into package B intake as addendum candidates; keep every "not reported in archive" row as the documented absence that justifies the depositor queries. Confidence that the archives hold no further growth-condition value for these 45 records: high for the 20 hand-read records, moderate for the 25 remaining series (bounded check only, 25 cells). The most likely way this is wrong: a growth value hidden in a field type I did not parse, such as a GEO sample `Sample_data_processing` line or a per-sample supplementary file name; the novelty check covered the fields listed in each absence row's notes and nothing else. Evidence that would change the recommendation: a non-GEO-brokered BioSample with a growth attribute for any series (none found), or a depositor reply.

## 7. Sources searched, not found, and access notes

- **Every requested record was retrieved** (manifest: 287 rows, all HTTP 200, 104,979,407 bytes). Nothing was refused by a CAPTCHA, a meter or a credential wall; no credential was used; NCBI E-utilities were called without an API key at 0.4 s spacing.
- **Not retrieved by design:** raw reads (SRA runs, PRIDE RAW), the PRIDE LFQ workbook and pdResult, every paper. The paper-side conflicts the ticket records (GSE237858, GSE227397, GSE140121, GSE327989) were not re-read here.
- **EBI BioSamples search** by external reference returned no hit for GSE122841 and was not used further; the ENA browser XML endpoint served the same samples. **ENA portal `filereport`** answered the probe in 21 s and was not used beyond it; the SRA experiment XML already carries run attributes.
- **NCBI `efetch db=biosample` with DDBJ accessions (SAMD...) returned the NCBI records of the same number (SAMN...).** The wrong file is kept as `cache/biosample/WRONG_GSE327989_SAMN_misresolved.xml`; the correct records were fetched by UID after `esearch` on `SAMD...[accn]` (manifest rows `esearch_biosample_accn`, second `biosample_efetch_xml` for GSE327989).
- **A batched `efetch db=sra` of eight ids returned seven packages** (GSE103462, SRX3159653 missing); it was re-fetched singly and recorded (`cache/sra/GSE103462_part1.xml`).
- **The BioProject-to-BioSample `elink` count is tripled** (three linkset names); only its zero/non-zero reading was used.
- **The condition-records JSON is a parse of package B, not package B itself**: it reads `spec` null for GSE237858 where package B says "fluorescent (class not specified)"; the gap index in section 4.3 inherits that.
- **GSE327989's GEO record has no BioProject relation**; its BioProject (PRJDB39746) was taken from the SRA study XML. GSE79726 likewise (PRJNA315938).
- **The scratch directory is shared.** Files not written by this run appeared in `/tmp/cyano-condition-20261007` at 10:58 to 10:59 local time, about a minute after this run created the directory: `judge_gap_cells.py`, `gap_values.json`, `gap_request_0..5.json`, `gap_response_0..5.json`, `gap_judgments.json` and a `typesafe-docs/` directory. Their content (a Jev Choice classification of condition-cell availability, "present / partial / not reported / not retrieved / conflicting / uncertain") looks like another worker's pass over the same ticket. They were neither used nor altered here and are excluded from the hash table below; the coordinator should check which run owns them.

## 8. Method and reproducibility

Scripts under `/tmp/cyano-condition-20261007/scripts/`, run with `python3 -I` against the downloaded files in a separate directory: `fetch_all.py` (GEO full text, BioSample and SRA via E-utilities, ENA sample XML, PRIDE v3, BioStudies; manifest rows with URL, UTC time, status, bytes, SHA-256), the inline BioProject, supplementary-file and PRIDE-workbook fetches recorded in the same manifest, `extract.py` (records.json), `inventory.py` (distinct texts per series with the mechanical novelty flag), `jev_axes.py` (nine Noul questions per distinct text, `jev-1.13.0`, 914 distinct texts, 1,375,509 input tokens summed over the 1,294 text uses, 0 errors), `jev_validation.py`, `rows.py` (the candidate rows) and `quote_check.py`. Jev was used only to rank where to read; every proposed value was read and quoted by the analyst and re-matched by code. No keyword matching was used as a semantic classifier; the novelty flag is a verbatim-substring check and is labelled as such.

## 9. Unresolved questions for the coordinator

1. Whether a medium named only in the stress clause of a protocol attached to the normal samples (GSE122841, CR-002) counts as reported, with caveat, or stays not reported.
2. Whether package B's inferred light regimes (GSE311172 "continuous", CR-032) should be relabelled as not reported, and whether the condition-record JSON's null lamp class for GSE237858 is a parse defect to fix at intake.
3. Whether the GSE311172 and GSE45762 label discrepancies (CR-034, CR-015/016) go into the depositor queries, since they bear on which sample a processed column is rather than on a growth condition.
4. PXD023591 is named in the ticket's query table but was not in the GEO-series list this handoff gave; it was not swept.
5. The GSE114693 wild-type RNA-seq named in the overall design has no wild-type sample in the series (CR-118); whether to ask the depositor or to look for it in GSE50922/GSE104203.

## 10. Deliverable files (SHA-256 at hand-off)

| File | Bytes | SHA-256 |
| --- | --- | --- |
| `candidate_rows.tsv` | 196,980 | `03dddb5614b9b9fa99adc3d2957de505a844cfd4be1912004cd7356635440563` |
| `candidate_rows.json` | 265,872 | `2e650339f28677362b7dc8a40d6493f11e1ec39e70759571e17f280194c7215d` |
| `manifest.tsv` | 112,088 | `8ce7cd8593417ab2f692eb140bc35878b64606150a2af6bb2c6615b0ca81dd23` |
| `records.json` | 13,890,357 | `86e394991c9f87b7c25945055501d3034f7613e32a1ac40e7dcbf7fabb6a1e8c` |
| `inventory.json` | 2,484,504 | `a7dc45cfb4057b0144041476e3024650c795b1d6d6d63345ec8c955f05b6de55` |
| `jev_cache.jsonl` | 523,269 | `5df848928c2527a1a3251739b2e3902f5c0d337a2669efda14966fb48c9450d7` |
| `jev_axes_results.json` | 691,246 | `6448dc8c0b729c867acaa76e67343ee7c7553e2484ab00ad37de050eb53d5352` |
| `jev_validation.json` | 21,356 | `f3eeb5b728e4f0743553a5208cd00167e91b954cdc70b68e67fed860b831725c` |
| `geo_series_summary.json` | 42,304 | `5419aa331a1c685808901eec16e53397982eafdd22ca7204200d528e9f7d7d47` |
| `bioproject_records.json` | 6,896 | `a8354f2ddc9fec694c4e5e041732d8912ebb31a6c379fbd5a8c8f7d9e6a38a5b` |
| `bioproject_biosample_links.json` | 5,689 | `46279070f3a154aef9472e94ad0528e451dd6a0db84019af086c2acb7eb15e8a` |
| `sources_table.md` | 4,581 | `b6758aabf223908a040adea950d8eefdf1d4800fd9a8cb95213925d1daa4e239` |
| `existing_conditions.txt` | 208,840 | `64ff8ee2164d766ab37aa3829fd15c9d6d598cf7c5c96a558a649f394e947bd1` |
| `scripts/axis_gaps.py` | 1,868 | `383d1570759e31b76c08e40397fe24579db418eeed2681f6b7a90ee9dc079083` |
| `scripts/axis_summary.py` | 1,940 | `00ca6efba31989ac0ff78f4cf152484877722654348ff743f241389fbf9b5d11` |
| `scripts/extract.py` | 12,821 | `f9c456f346bc062b7e3e049488e3014af8c02b3bc365be174f0f59efacb8dc0f` |
| `scripts/fetch_all.py` | 8,524 | `d7b2e0bfa62a55dde2c8bb6feb3e340f63a407eca2aa6e236ff9aa29e772fbad` |
| `scripts/geoview.py` | 916 | `2927207b2639a52e721e827f5401d9d4890697e84a96eacbe52cb91e944990c2` |
| `scripts/inventory.py` | 8,258 | `4d9391a8cbb0ef49e1f5a27e2d44d2fa5de7bffd46a9863fd1c382daa6398b83` |
| `scripts/jev_axes.py` | 10,545 | `0aabeed1d0cf769ba4c789221638ab9b4d54db4a0f807513deda8bdc907049f3` |
| `scripts/jev_validation.py` | 2,565 | `cda412a4e1d3211853ee624bb7c433b8753974abe4b0027223918924c828d567` |
| `scripts/novel.py` | 932 | `e5c4da98e44bc74090d605133fe1df036a7f4741bc877a20216678522b7919a0` |
| `scripts/novel_strict.py` | 1,139 | `1f2375e8506a837b7d0c274453687e10e6c850ec358e05212c473580295ef03b` |
| `scripts/quote_check.py` | 3,653 | `3b5b28a323bf245d702b5b0d3b50be40659262e934d0390821e575b3f2c39adb` |
| `scripts/rows.py` | 52,896 | `81db32441482ae6ebca12a3f8e8432493451311c8e3570a9dfbf7412f73e736d` |
| `cache/` | 287 retrievals | per-file SHA-256 in `manifest.tsv` |
