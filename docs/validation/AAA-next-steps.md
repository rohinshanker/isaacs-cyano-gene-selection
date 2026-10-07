# Next steps for the owner

Written 2026-10-06, current at 2026-10-07. Everything here needs a person: a
browser check the agents may not pass, an email only the lab can send, or a
record only you can make. Each item names where its result goes. Agents keep
this file current; when an item is done, its ticket records the date and the
item is removed here.

**Done on 2026-10-07 and removed from this list.** The Fitness Browser pages and
PCC 7942 tables are saved in the private drop folder and verified complete, so
[fitness-screen source and selection contract](fitness-screen-data.md)
records their pins and admission. All four PMC method papers are saved, filed under paper titles,
and mapped to their PMC ids in
[A_pmc-gated-method-papers__20261006](../notes/tickets/A_pmc-gated-method-papers__20261006.md).
The SRI notification about EcoCyc-derived content was sent, recorded in
[A_add-ecoli-organism__20261005](../notes/tickets/A_add-ecoli-organism__20261005.md).
The question to the O'Shea lab about the flask-culture temperature was sent,
recorded under J2 in
[O_comparability-lab-judgements__20261005](../notes/tickets/O_comparability-lab-judgements__20261005.md).

Three items remain. Items 5 and 6 are deferred by you rather than blocked;
item 7 is new on 2026-10-07 and it does block a dataset.

## 5. Three optional depositor emails, saved for later

**Your decision, 2026-10-07: save these for later.** Nothing waits on them; they
only upgrade fields that are already published as honestly unknown.

Ticket: [A_licence-unblocked-sources__20261006](../notes/tickets/A_licence-unblocked-sources__20261006.md).

**All three datasets shipped on 2026-10-07 and nothing waits on these emails.**
Re-reading the GEO records showed the conditions were in the deposits all along,
so each series was ingested with what its record states and the few genuinely
silent fields marked "not reported". A reply would upgrade those fields from
"not reported" to a quoted value, which also lets the dataset be judged
comparable to others. Without a reply the data stay published and usable, just
less comparable. Send these if and when you like.

Standing fallback, your decision of 2026-10-07: where a row does depend on a
depositor, wait four weeks with one follow-up at two, then ship with the
unanswered fields marked and the query left recorded. Nothing is dropped for
silence.

What each email would still buy:

| Email | What it would upgrade |
| --- | --- |
| 5a GSE252562 | Which photoperiod the disputed eight-cycle set had; it ships now with its light regime recorded as conflicting |
| 5b GSE225426 | The culture vessel and the CO₂ condition, neither reported anywhere |
| 5c GSE311172 | Which adapted population five withheld condition sets came from, and the medium-light irradiance |

A cheaper route for 5a: GSE252562's series cites Jabbur and colleagues,
*Science* 385, 1105-1111 (2024), PMID 39236161, PMC11473183. It is a
photoperiodism paper and its methods very likely settle the photoperiod. It sits
outside the open-access subset, so the agents cannot read it and both the
full-text and supplementary routes were tried and refused. You can read it.

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

This one has a sharper question than growth conditions. GEO's sample list and
the deposited count matrix disagree about which adapted population five of the
condition sets came from: GEO labels three samples AD1 where the matrix column
says AD2, and two samples AD2 where the matrix says AD3. Those five sets are
withheld for that reason, so this reply would release real data rather than only
annotate it.

Subject: Growth conditions for GEO series GSE311172

> Dear colleagues,
>
> We are building a public research resource in the Isaacs lab at Yale that
> compares published Synechococcus elongatus expression datasets by their growth
> conditions, and we would like to include GSE311172, your oxidative-stress and
> adaptive-evolution time series in the PCC 7942 CscB/SPS strain.
>
> The growth protocol in the record is unusually complete and we have used it.
> Two things we could not resolve from the record alone:
>
> First, the sample list and the deposited count matrix appear to disagree on
> which adapted population some samples came from. The samples the series record
> labels AD1 at 445% O2 air saturation, including the planktonic and biofilm
> pair, are named AD2 in the matrix columns, and the two labelled AD2 at 468%
> and 476% are named AD3 in the matrix. Could you confirm which is right?
>
> Second, the record distinguishes a medium-light and a high-light arm but gives
> one irradiance, 760 umol photons m-2 s-1. What was the medium-light value?
>
> Any of these you can give is useful; we record the rest as not reported.
>
> Thank you for your time,
> [name, Isaacs lab, Yale University]

Record each reply, with its date, in
[the depositor-correspondence ticket](../notes/tickets/O_depositor-condition-correspondence__20261007.md);
the agents then upgrade the condition record and, for
GSE311172, ingest the five withheld sets. Note that the query table
there also asks these depositors for "an explicit reuse statement": that part is
obsolete since your decision of 2026-10-06 that every source is permitted with
citation, and the drafts above leave it out.

## 6. The other depositor queries, declined for now

**Your decision, 2026-10-07: you are not going to do this work for now.**

The depositor questions stay on record, unasked, in
[the correspondence ticket](../notes/tickets/O_depositor-condition-correspondence__20261007.md).
Nothing in the release waits on them: every affected value is already published
as reported, not reported, or conflicting, according to what its source
actually says.

**Standing requirement you set with that decision, which is engineering work,
not an owner errand.** The site must say that confirming the actual amounts
would require contacting the depositors. A reader looking at a condition the
site shows as unknown should be able to tell that it is unknown because the
source never stated it and only the depositor could settle it, rather than
because the project did not look. This belongs with the condition-metadata and
Data Sources work, and is recorded for the session that owns it; it is the only
item on this list that is an agent's job rather than yours.

## 7. The PNAS limonene paper's supplementary protein table

**New on 2026-10-07, and this one blocks real data.** Your decision that day was
to ship PXD005105 from the paper's published values rather than have the agents
derive their own, so this is the step that unblocks it.

Ticket: [A_licence-unblocked-sources__20261006](../notes/tickets/A_licence-unblocked-sources__20261006.md), row 7.

**What is needed:** the supplementary material of *Enhanced limonene production
in cyanobacteria reveals photosynthesis limitations*, PNAS 2016;113(50), PMID
27911807, PMC5167140, doi:10.1073/pnas.1613340113. The table wanted is the
proteomics one, reporting NSAF or equivalent per-protein values for the wild
type and the limonene strains. Saving it to the private drop folder is enough;
the agents read it from there.

**Why the agents cannot get it.** The PRIDE deposit holds exactly two files, an
8.1 GB `RAW.zip` and a 944 MB `SEARCH.zip`, confirmed against the PRIDE v3
listing, the FTP directory and the deposit's own `README.txt`. The search
archive was downloaded and opened on 2026-10-07 and holds 118 unfiltered
ProLuCID `.sqt` files rather than the authors' DTASelect output, with the decoys
still in them: in one file, 10,882 of 21,349 top-ranked matches are
reversed-sequence decoys, a 49% false-discovery rate, so counting them as
deposited would give a quantity about half of which is noise. The filtering the
authors performed was never deposited. PMC5167140 is not open access through the
Europe PMC API, and LIT-08 and LIT-09 of the blocked-task register forbid
working around the PMC challenge, changing User-Agent or using a mirror, so a
person reading it in a browser is the route.

**What it buys:** a wild-type proteome, which the release still does not have.
The deposit covers nine samples, three biological replicates each of the wild
type, L1115 and L1118, where the only proteomics strain shipped so far is the
engineered L1118 from a different deposit. The condition record is already
written and waiting, and the archive is cached with its checksum recorded in the
ticket, so nothing needs downloading again.

**If the table does not exist or is not usable,** say so and the fallback is the
option you did not take on 2026-10-07: have the agents do the false-discovery
filtering themselves and label the layer as this project's own derivation rather
than the depositors' published values.
