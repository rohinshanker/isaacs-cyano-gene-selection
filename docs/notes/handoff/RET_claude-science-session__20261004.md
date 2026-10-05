# RET_claude-science-session__20261004 — Claude Science session return

**Read this before picking up any ticket that consumes package D.**

```
requester:   owner
target:      mythos / fable
ticket:      docs/notes/tickets/O_claude-science-offload__20260927.md
package:     D, candidate pair comparability
scope:       this file and docs/notes/handoff/cyano_package_D_pairs_20261004.tsv.
             No code, data, site file, existing ticket, validation document, or
             index row was modified by this session
acceptance:  the hard boundaries and results-block format in
             docs/validation/claude-science-handoff.md
status:      returned
opened:      20261004
updated:     20261004
```

Everything below is **evidence and recommendation**. No pair is admitted, no
threshold is set, and no escalated pair is resolved. Rows 13 to 15 of
[AAA-biological-decisions-to-review.md](../../validation/AAA-biological-decisions-to-review.md)
stay with the lab.

## D.1 What was returned

| | |
| --- | --- |
| Table | [`cyano_package_D_pairs_20261004.tsv`](cyano_package_D_pairs_20261004.tsv) |
| Rows | **941** data rows plus one header row, one per pair |
| Bytes | 4279541 |
| SHA-256 | `9a45d8384a23ecbf2ea2619043d5610a11d096912020878bd95df59f91ff799c` |
| Input | `cyano_package_B_conditions_20261003.tsv`, the table accepted at intake 2026-10-04, SHA-256 recomputed on the mounted file as `fa65266cd402ae974c072e9ad587bd990773d2df002eb08ed856ba4bca0c750e` — **matches** |

**The repository's thresholds and the paste's summary of them agree**, clause for
clause, so there is nothing to report under "if the table in the repository
differs from this summary, the repository wins". The scoring used
`data-contract.md`, "Condition comparability", as the authority.

## D.2 The headline: no pair is comparable, and that is a data-completeness result

| Verdict | Pairs |
| --- | --- |
| comparable | **0** |
| escalate | 32 |
| undecidable | 178 |
| not comparable | 731 |

Not one of the 941 pairs clears all six axes. The reason is **not** that the
candidates are biologically far apart — it is that the condition metadata is too
incomplete to certify any pair, and where it is complete the studies genuinely
differ. Of the six axes, the median pair passes **2**:

| Axes passed | Pairs |
| --- | --- |
| 0 of 6 | 127 |
| 1 of 6 | 292 |
| 2 of 6 | 366 |
| 3 of 6 | 134 |
| 4 of 6 | 15 |
| 5 of 6 | 7 |

A practical reading: **the lab cannot pool any two of these datasets today**, and
the single cheapest thing that would change that is getting spectrum class, CO₂
regime and an OD at sampling onto the records that lack them.

## D.3 The seven nearest misses

These pass five axes and fail none. Each is **undecidable on exactly one axis**,
and in six of the seven that axis is unresolved for the same reason: both sides
say "white light" and both explicitly decline to name the class.

| Artifact A | Artifact B | Unresolved axis |
| --- | --- | --- |
| GSE18902 | GSE50908 | light_regime |
| GSE18902 | GSE50919 | light_regime |
| GSE18902 | GSE52486 | light_regime |
| GSE50908 | GSE50919 | light_regime |
| GSE50908 | GSE52486 | light_regime |
| GSE50919 | GSE52486 | light_regime |
| GSE50920 | GSE51112 | temperature |

The first six are the Vijayan/Markson turbidostat family — same apparatus, same
modified BG-11, 25 µmol photons m⁻² s⁻¹, 1% CO₂, 30 °C, OD₇₅₀ 0.15 held by a
turbidostat on both sides. Temperature, light intensity, CO₂, medium, format and
phase all pass. **An earlier pass of this scoring called them comparable.** They
were changed to undecidable on a deliberate reading: the contract requires "same
spectrum class", and two records that each say the class is unspecified do not
establish that their classes agree. Matching one unknown against another is not
evidence. If the lab judges that these four records describe one apparatus — which
the shared protocol text suggests — this is the set most likely to become the
repository's first comparable group, and the question is a one-line one: what
lamp did the Golden/O'Shea turbidostat use. That judgement is row 14's, not this
package's.

The seventh, GSE50920 against GSE51112, is unresolved only because **GSE50920
reports no temperature at all**; everything else passes, including OD₇₅₀ 0.3 on
both sides.

## D.4 Where the escalations sit

32 pairs fail exactly one axis narrowly:
26 on light_intensity, 6 on co2.

**The word "narrowly" is mine, not the contract's**, and the lab should know the
rule I used before relying on the count: a single failing axis is escalated when
the temperature gap is at most 3 °C, or the light-intensity ratio at most 1.5, or
the CO₂ factor at most 3 — that is, within about half a step beyond the
threshold. Redrawing that boundary moves pairs between `escalate` and
`not comparable` and changes nothing else. The `axes_passed` column lets the lab
re-rank these without re-reading the table: most escalated pairs pass only two or
three other axes, so a narrow miss is rarely the only thing standing in the way.

## D.5 Which pairs were formed, and which were not

The 63 scored condition sets come from the 88 package B rows after **25
exclusions**, each for a stated reason:

| Excluded | Count | Why |
| --- | --- | --- |
| Annotation rows | 9 | The assay has no growth condition; package B returned them "not applicable" |
| PXD010000 | 1 | Rejected in package B: the deposit reports no growth conditions for any organism |
| SuperSeries rows | 13 | GSE103606, GSE104204, GSE50922, GSE205445 |
| Pre-sampling stages | 2 | Row 1 (GSE102914 stock culture before Zn exposure) and row 60 (PXD005105 seed inoculum) describe a culture stage that was not sampled |

**The SuperSeries exclusion was verified against GEO, not assumed.** For each of
the four, `!Series_relation` names its SubSeries and the SubSeries sample sets
union exactly to the SuperSeries sample set, with nothing left over: GSE103606 =
103462 + 103463 + 103644 + 103704 + 105774 + 106824 (106 samples); GSE104204 =
104202 + 104203 (97); GSE205445 = 205443 + 205444 (46); GSE50922 = 50908 + 50919
+ 50920 + 51093 + 51112 + 52486 (108). Scoring both a SuperSeries and its
SubSeries would double-count the same material on both sides of a pair. The
SubSeries that are **not** in package A are all ChIP-seq, except GSE205444, which
is the PCC 7942 expression table the release already ships.

Two further rules shaped the table. **Pairs within one artifact are not scored**
(32 such combinations): two condition sets of one study are already separate
layers, and the contract's question is whether two *datasets* may be pooled.
**Pairs across data types are not scored**: transcriptomics, proteomics and the
RB-TnSeq fitness screen are separate, as the dispatch directs. GSE205443's three
sets are the only fitness-screen units, and since they share one accession they
yield no pairs at all — the screen appears in the table's unit count but
contributes zero rows.

One observation the lab may want, offered as a fact rather than a verdict:
**array and RNA-seq series were pooled into one "transcriptomics" data type.**
The first six nearest misses in D.3 are array-against-array, but **the seventh
is not**: GSE50920 is an array series and GSE51112 is RNA-seq. So the one
cross-platform pair in the nearest-miss set is live, and if the lab means
platform when it says data type, that grouping is the line to redraw — and that
pair is the first one it would remove.

## D.6 Suspected errors in the input, reported not altered

No condition value was re-extracted or changed. Three things in the accepted
package B table are worth the lab's eye:

1. **Two `not retrieved` labels that intake already caught.** Data rows 31
   (GSE225426) and 70 (PXD023591) carry `not retrieved` where package B's own
   rule in B.3.4 says a publication-less deposit reports `not reported`. Package
   D treats those ten cells as not reported, exactly as the queue row says, so
   the pending relabel changes no verdict here.
2. **Row 81 is the UTEX 2973 genome of record mislabelled `PCC 6301`.** Intake
   found this and recorded it rejected. It is an annotation row, so it was
   excluded from pairing regardless and affects nothing in this table.
3. **Wavelength is not uniform across the OD values**, and the contract names
   OD₇₅₀ specifically. Of the condition sets that report a density at sampling,
   some report OD₇₅₀ and some OD₇₃₀, and a handful report A₇₃₀. A pair whose two
   sides use different wavelengths is returned `undecidable` on the format-and-phase
   axis rather than being converted, because no calibration between the two is
   given in the sources. That is a reporting difference in the literature, not an
   error package B introduced.

## D.7 How a pair was scored

Each axis returns `pass`, `fail` or `undecidable`, and the row's verdict follows
the dispatch's acceptance rules: any `fail` makes a pair `not comparable` unless
it is a single narrow miss, which escalates; otherwise any `undecidable` makes
the pair `undecidable`; only a clean sweep is `comparable`.

Values were read **only** from the accepted package B table. The parse was
checked by hand rather than trusted: an early automated pass misread "29 ± 2 °C"
as a point value, took inoculation densities for sampling densities on six rows,
and dropped the OD₇₅₀ that four turbidostat records do state at sampling. Every
growth-phase value in the final scoring was set by reading the cell. Three other
readings worth stating, because they are judgements:

- **"Room temperature" and a relative light change are not quantities.** Row 24
  gives "room temperature" and rows 11 and 12 give a 10-fold change against
  another condition rather than a flux. Those axes are `undecidable`, not
  estimated.
- **A tolerance band is honoured as a band.** "29 ± 2 °C" is scored as 27–31 °C,
  so it is a standard-regime value that overlaps 30 °C rather than a point.
- **Entrainment before continuous sampling is continuous.** A culture entrained
  on a diel cycle and then released into constant light for sampling is scored
  `continuous`, because that is the regime the sampled material was in; the
  entrainment history is kept in the condition-set text.

Each row carries both source cells verbatim from package B, so every value in a
verdict can be traced to the sentence or metadata field package B cited for it.

## D.8 Boundaries observed

No pair is admitted; the table is evidence. The thresholds were applied, never
set — where a pair sits near one, it is escalated with its axis named rather than
judged. No escalated pair is resolved, and UTEX 3055 does not appear in the
candidate set at all, so row 15 is untouched. No condition value was re-extracted,
altered, or filled in; the three suspected input errors above are reported for the
owner and intake to act on. Nothing outside this scope was attempted, and no file
other than this one and the table was created or modified.
