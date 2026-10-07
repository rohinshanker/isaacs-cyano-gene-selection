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

Two items remain, both deferred by you rather than blocked.

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
Data Sources work, and is recorded for the session that owns it; it is the last
open item on this list and the only one that is an agent's job rather than
yours.
