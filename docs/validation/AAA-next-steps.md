# Next steps for the owner

Written 2026-10-06. Everything here needs a person: a browser check the agents
may not pass, an email only the lab can send, or a record only you can make.
Each item names where its result goes. Agents keep this file current; when an
item is done, its ticket records the date and the item is removed here.

## 1. Fitness Browser: terms and the PCC 7942 tables

Ticket: [O_fitness-browser-access__20261006](../notes/tickets/O_fitness-browser-access__20261006.md).
Every page the agents request answers with a Cloudflare bot check, which they do
not solve. You pass it once in your own browser and save what the ingestion
needs into the private drop folder
`~/Desktop/coding_stuff/ISAACS-LAB/private-literature/fitness-browser/` (create
it; nothing there is ever committed).

1. Open https://fit.genomics.lbl.gov/ and clear the bot check.
2. Open the site's "About" or help page from the front-page links and save it as
   `about.html` (File > Save Page As, "Webpage, Complete" or HTML only). This is
   where its reuse terms and the citation it asks for live; if a separate
   "terms" or "license" link exists, save that too as `terms.html`.
3. From the front page choose the organism *Synechococcus elongatus* PCC 7942
   (the Fitness Browser calls it `SynE`). On the organism page, follow the
   "Download" or "data" link. Save:
   - the gene fitness table (one row per gene, one column per experiment; the
     site names it like `fit_organism_SynE.tab` or offers "fitness values"),
   - the experiments table (one row per experiment with its condition,
     medium, temperature and time; named like `expsUsed` or "experiment
     metadata"),
   - the genes table if offered (locus tags and descriptions).
   Keep the site's own file names.
4. Note the date you downloaded and the page URL of each file in a short
   `README.txt` in that folder.
5. Tell the agent the folder is filled. It reads the terms, records a ledger
   row and citation entry, and ingests the fitness columns under the existing
   RB-TnSeq fitness type with one layer per condition set.

## 2. PMC pages behind the proof-of-work check

Ticket: [O_pmc-gated-method-papers__20261006](../notes/tickets/O_pmc-gated-method-papers__20261006.md).
PMC article pages now answer the agents with a proof-of-work interstitial. Nothing
in the data waits on these; the four papers only back statements in the
comparability methods memo that their abstracts already state. If you want them
read in full anyway:

1. Open each link below, let the check complete, and save the page as HTML into
   `~/Desktop/coding_stuff/ISAACS-LAB/private-literature/pmc/` with the PMC id
   as the file name:
   - https://pmc.ncbi.nlm.nih.gov/articles/PMC3272078/ (MAQC Consortium 2006)
   - https://pmc.ncbi.nlm.nih.gov/articles/PMC4260565/ (Lin et al. 2014)
   - https://pmc.ncbi.nlm.nih.gov/articles/PMC3810845/ (Reese et al. 2013)
   - https://pmc.ncbi.nlm.nih.gov/articles/PMC6171491/ (Evans et al. 2017)
2. Tell the agent. It re-matches the memo's claims against the full text and
   changes the "(abstract only)" marks it can.

If the interstitial keeps appearing for the agents on other PMC articles, the
same route applies: open, clear, save, point the agent at the file.

## 3. Notify SRI about EcoCyc-derived content

Ticket: [A_add-ecoli-organism__20261005](../notes/tickets/A_add-ecoli-organism__20261005.md).
SRI's open-database terms for BioCyc ask to be notified when a site makes
EcoCyc-derived content available. The site publishes gene data derived from the
EcoCyc-derived RefSeq annotation of E. coli K-12 MG1655; it redistributes no
EcoCyc file.

Recipient: BioCyc support at SRI International, `biocyc-support@ai.sri.com`
(the address BioCyc's pages give for support; confirm it on the contact page of
biocyc.org before sending, since the agents do not open BioCyc pages).

Subject: Notification of EcoCyc-derived content on a public research site

Draft:

> Dear BioCyc team,
>
> Per the BioCyc open-database terms, this is to notify you that a public,
> non-commercial research site from the Isaacs lab at Yale, the Synechococcus
> elongatus recoding-diversity map
> (https://rohinshanker.github.io/isaacs-cyano-gene-selection/), now includes an
> Escherichia coli K-12 MG1655 view built from the NCBI RefSeq assembly
> GCF_000005845.2, whose annotation NCBI attributes to EcoCyc. The site shows
> per-gene data derived from that annotation (gene models, codon metrics and
> derived categories). It cites NCBI RefSeq, EcoCyc (Keseler et al. 2021) with
> the BioCyc attribution statement and a link to www.biocyc.org, and Blattner
> et al. 1997, in its citations ledger. No EcoCyc file is redistributed, and no
> BioCyc web service or download is used by the site.
>
> Please let us know if a different attribution wording or a logo placement is
> wanted.
>
> With thanks,
> [name, Isaacs lab, Yale University]

After sending, record the date and time in the E. coli ticket under "Decided:
publishing data derived from this annotation" (the agent will do this if you
give it the date).

## 4. Ask the O'Shea lab about the flask-culture temperature (J2)

Decision taken 2026-10-06: GSE50920 and GSE51112 are displayed together despite
the missing temperature, as conditional pair judgement 33, and the question is
marked for later resolution. The pair stays together whether the answer is
"30 °C", "don't know" or nothing; a different temperature would separate them.

Recipients: the corresponding author of both papers is Erin K. O'Shea
(`erin_oshea@harvard.edu` as printed in Cell 2013 and PNAS 2009; she has since
moved to HHMI, so the Harvard address may bounce and the HHMI office is the
fallback). The first authors, Joseph S. Markson (Cell 2013) and Vikram Vijayan
(PNAS 2009), ran the cultures; their current addresses are not in the papers
and would need a search. Send to O'Shea and, if findable, Markson.

Is the paper too old for this to be reasonable? Partly. The 2013 article is
thirteen years old, the lab has dispersed, and an incubator setting is the kind
of detail a corresponding author rarely retrieves after that long. The question
is small and the same lab's turbidostat papers state 30 °C, so the likely answer
is "30 °C, as in our other work", which an author can give from memory. A short
email costs little; expect a low reply rate and do not wait on it.

Subject: Growth temperature of the flask cultures in Markson et al., Cell 2013

Draft:

> Dear Dr O'Shea,
>
> We are building a public research resource in the Isaacs lab at Yale that
> compares published Synechococcus elongatus expression datasets by their growth
> conditions, including GSE50920 and GSE51112 from Markson et al., Cell 2013
> (155:1396). The Extended Experimental Procedures give the tissue-culture-flask
> cultures 100 µmol photons m⁻² s⁻¹ of cool fluorescent light, 1% CO₂, OD₇₅₀
> near 0.3 and 10 mM HEPES-KOH, but we could not find the incubation
> temperature of those flask cultures in the article or supplement. The
> turbidostat cultures follow Vijayan et al. 2009 at 30 °C.
>
> Could you confirm the temperature of the flask cultures, and, if it is
> known, the lamp used for the "white light" in the turbidostat? "We don't
> remember" is a useful answer too; we record the question as open.
>
> Thank you for your time,
> [name, Isaacs lab, Yale University]

Record any reply with its date in
[O_comparability-lab-judgements__20261005](../notes/tickets/O_comparability-lab-judgements__20261005.md)
under J2; the agent then settles pair judgement 33.

## 5. Write to three depositors (blocks two ticket rows)

Ticket: [A_licence-unblocked-sources__20261006](../notes/tickets/A_licence-unblocked-sources__20261006.md),
rows 3 and 4, by your decision of 2026-10-07 to wait for the depositors.

**Sending these does not unblock the rows; the replies do.** The question in each
case is what the condition record must say, so the dataset cannot be ingested
with the answer left open. Expect a low reply rate and do not hold other work on
them. If no reply arrives, the standing alternative is to ship each series with
the disputed axis recorded as `conflicting` or `not reported`, which is a
decision for you, not a default.

One cheaper route first: GSE252562's series now cites a publication the earlier
sweep did not have, Johnson and colleagues, *Science* 385, 1105-1111 (2024),
PMID 39236161, PMC11473183. It is a photoperiodism paper, so its methods almost
certainly state which photoperiod each sample had. It is not in the open-access
subset, so the agents cannot read it, but you can. If its methods settle the
question, quote it into the ticket and item 5a needs no email at all.

### 5a. GSE252562, the photoperiod of six samples

Recipient: Carl Hirschie Johnson, Vanderbilt University,
`carl.h.johnson@vanderbilt.edu` (the GEO submitter contact for the series).

Subject: Photoperiod of six samples in GEO series GSE252562

> Dear Professor Johnson,
>
> We are building a public research resource in the Isaacs lab at Yale that
> compares published Synechococcus elongatus expression datasets by their growth
> conditions, and we are including GSE252562 from your photoperiodism work.
>
> In that series, six samples are titled `LD8:16` while their sample
> characteristics field records `LD16:8`. We cannot tell from the record which
> photoperiod those cultures actually had, and we would rather not guess.
>
> Could you confirm which is correct for those six samples? If the published
> methods already settle it, a pointer to the relevant section is just as
> useful.
>
> Thank you for your time,
> [name, Isaacs lab, Yale University]

### 5b. GSE225426, growth conditions

Recipient: Hakuto Kageyama, Meijo University, `kageyama@meijo-u.ac.jp`.

Subject: Growth conditions for GEO series GSE225426

> Dear Dr Kageyama,
>
> We are building a public research resource in the Isaacs lab at Yale that
> compares published Synechococcus elongatus expression datasets by their growth
> conditions, and we would like to include GSE225426, your transcriptome
> analysis of PCC 7942 under salt and protein-synthesis-inhibiting stress.
>
> The GEO record does not state the growth conditions, and we could not find an
> associated publication. So that we describe the data accurately rather than
> leaving the fields blank, could you tell us, for the sequenced cultures: the
> incubation temperature, the light intensity and whether light was continuous
> or on a light-dark cycle, the CO2 condition if any, the medium, the culture
> vessel, and the number of biological replicates per condition?
>
> Any of these you can give is useful; we record the rest as not reported.
>
> Thank you for your time,
> [name, Isaacs lab, Yale University]

### 5c. GSE311172, growth conditions

Recipient: the Predictive Phenomics Initiative, Pacific Northwest National
Laboratory, Richland WA. **GEO publishes no contact email for this series**, so
this one needs a route before it can be sent: the "Contact" link on the GEO
series page reaches the submitter, and BioProject PRJNA1368742 is the other
handle. Worth a minute to find a named person before sending.

Subject: Growth conditions for GEO series GSE311172

> Dear colleagues,
>
> We are building a public research resource in the Isaacs lab at Yale that
> compares published Synechococcus elongatus expression datasets by their growth
> conditions, and we would like to include GSE311172, your oxidative-stress and
> adaptive-evolution time series in the PCC 7942 CscB/SPS strain.
>
> The GEO record describes turbidostatic cultivation with manipulated oxygen but
> does not give the full growth conditions, and we could not find an associated
> publication. Could you tell us, for the sequenced cultures: the incubation
> temperature, the light intensity and regime, the CO2 and oxygen set points,
> the medium, and the number of biological replicates per time point?
>
> Any of these you can give is useful; we record the rest as not reported.
>
> Thank you for your time,
> [name, Isaacs lab, Yale University]

Record each reply, with its date, in
[O_condition-metadata-gaps__20261005](../notes/tickets/O_condition-metadata-gaps__20261005.md)
under work item 4; the agents then ingest the series. Note that the query table
there also asks these depositors for "an explicit reuse statement": that part is
obsolete since your decision of 2026-10-06 that every source is permitted with
citation, and the drafts above leave it out.

## 6. Where the other depositor queries are

The eight depositor questions (GSE122841, GSE252562, GSE45762, GSE237858 and
GSE227397, GSE225426, GSE311172 and PXD023591, GSE140121 and GSE327989, and the
turbidostat lamp above) are the table under work item 4 of
[O_condition-metadata-gaps__20261005](../notes/tickets/O_condition-metadata-gaps__20261005.md).
Each row is one record and the exact ask; the GEO contact for a series is on its
GEO page under "Contact name". A reply is quoted with its date and enters through
the addendum route (`tools/check_addendum_quotes.py`).
