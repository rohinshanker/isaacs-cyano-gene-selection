# Recovering condition metadata

Keep archive observations, condition-field intake, the default comparability
screen, and lab pair judgements separate. Public sample attributes can fill a
missing field only for the samples and condition they actually describe.

## Prioritising a missing field

`tools/rank_condition_gaps.py` reads a pair table, ordered row-numbered rescoring
overlays, and a reviewed field/text inventory. It calls no model or network.
An inventory must pin each input table's bytes, name its reviewer, and cover
every exact effective field/text value. New values require review; they never
receive a status by substring matching. TypeSafe may propose classifications,
but inspect ambiguous values and validate classifications against the actual
condition contract before pinning them.

```sh
.venv/bin/python tools/rank_condition_gaps.py \
  docs/notes/handoff/cyano_package_D_pairs_20261004.tsv \
  docs/notes/handoff/cyano_condition_gap_inventory_20261007.json \
  /tmp/condition-gap-ranking.tsv \
  --rescore docs/notes/handoff/cyano_package_D_rescore_20261006.tsv
.venv/bin/python -m pytest -q tests/test_rank_condition_gaps.py
```

The ranking preserves not reported, not retrieved, partial, conflicting and
uncertain fields. Reported values can still fail a comparison. A named medium
is present even when a recipe comparison remains unresolved. Continuous light
needs no diel photoperiod, stationary phase needs no OD, and OD730/A730 is
accepted like OD750 under the owner's condition contract. A cell that explicitly
says the sampling/labeling OD is missing remains partial even when an earlier
maintenance OD and phase are stated; preserve that caveat rather than assuming
the same density at every processing step.

`all_pairs` counts a cell's reach across the entire snapshot;
`undecidable_pairs` counts its reach among undecidable pairs. Both count each
pair once, including a source cell appearing on both sides. The combined
culture axis has separate format and phase cells. `last_blocker_pairs` counts
pairs for which recovering that one cell could remove the last missing-data
blocker. It is conditional, not a guaranteed new verdict: the recovered value
still needs scoring. An undecidable axis whose fields are already present stays
an independent unresolved-screen blocker. Counts are not additive across cells.
`pair_rows` lists one-based rows from the original pair table, restricted to
undecidable pairs; its length equals `undecidable_pairs`, not `all_pairs`.

The inventory's `confidence` is the proposing model's confidence before review,
not a probability that the reviewed status is true. The reviewed categorical
status, any `model_status` and `review_note`, and the exact input value remain
available in the inventory; ranking never thresholds that confidence. Apply a
spectrum-class correction consistently across the inventory: changing only one
of equivalent white-light descriptions can produce misleading opportunity
counts, even when the underlying default screens are unchanged.

These are counts from the pinned pair snapshot, not a live catalogue of all
evidence. In particular, the accepted BC addendum already establishes the
GSE50920 flask temperature as not reported; the original pair cell still says
not retrieved. Its unresolved numeric value needs a depositor answer, not another
reading of that paper. Read accepted addenda alongside the ranking when choosing
retrievals, and preserve historical source text rather than relabelling it silently.

An overlay must name the original pair and its one-based Package D row; duplicate,
out-of-range or conflicting revisions are rejected. A revised condition row is
refreshed wherever that source row appears. Unchanged pair screens remain their
recorded results until explicitly rescored. Lab judgements are never inferred
from default screen results.

## Replaying the current screen

`tools/rescore_condition_pairs.py` is the canonical deterministic replay. It uses
the immutable 941 Package D pair identities, the reviewed compact condition
records, accepted addenda and the separate owner-judgement file. It writes a
current screen, a per-cell provenance/uncertainty inventory and a ranking. It does
not modify Package D or apply an owner judgement to `default_verdict`.

```sh
.venv/bin/python tools/rescore_condition_pairs.py \
  docs/notes/handoff/cyano_package_D_pairs_20261004.tsv \
  docs/notes/handoff/cyano_condition_gap_inventory_20261007.json \
  docs/notes/handoff/cyano_dataset_condition_records_20261007.json \
  data/expression/pair_judgements.json \
  docs/notes/handoff/cyano_condition_pair_screen_current_20261007.tsv \
  docs/notes/handoff/cyano_condition_gap_inventory_current_20261007.json \
  docs/notes/handoff/cyano_condition_gap_ranking_current_20261007.tsv \
  --historical-rescore docs/notes/handoff/cyano_package_D_rescore_20261006.tsv \
  --bc-addendum docs/notes/handoff/cyano_package_BC_addendum_20261006.tsv \
  --archive-addendum docs/notes/handoff/cyano_package_B_archive_addendum_20261007.json \
  --archive-intake docs/notes/handoff/cyano_archive_condition_intake_20261007.tsv \
  --manual-supplement docs/notes/handoff/cyano_archive_condition_manual_supplement_20261007.json \
  --paper-addendum docs/notes/handoff/cyano_condition_paper_addendum_20261007.json \
  --pride-check docs/notes/handoff/cyano_pride_condition_check_20261007.json
```

The replay uses exact IDs and typed numeric intervals. Flux ranges are compared
as complete ranges; a profile reported only by its peak remains unknown rather
than a constant at that peak. Identical reviewed spectrum classes pass, distinct
reviewed classes fail, and a missing class stays unknown. Owner J1 is displayed
separately and never mutates the default screen. A known component failure remains
decisive when another component is unknown.

Only explicitly named exponential/held sampling phases compare by overlapping
OD. A bare OD preserves its numeric value but does not establish the phase;
stationary sampling needs no OD. Stock, maintenance or dilution OD is never
transferred into sampling. Comparable culture classes are planktonic and biofilm.
Reported formats outside those classes remain labelled as reported and cannot
pass the default. Overrides bind exact row/accession and source values, with
manual evidence pinned by hash. Unreviewed type labels and uncovered gap statuses
are errors, and a `present` audit entry cannot describe a remaining gap.

The generated current artifacts contain verdict counts and source pins;
replay them rather than using counts from an earlier snapshot. There is no
`escalate` verdict because the owner rejected a fixed narrow-miss boundary.
Bicarbonate concentration is not a gas CO₂ percentage.

Verified source absences and conflicts are accepted unknown outcomes. They do
not keep the recovery implementation open. Track optional depositor follow-up in
[the correspondence ticket](../notes/tickets/O_depositor-condition-correspondence__20261007.md),
where the owner or a labmate sends prepared queries. No source-reported value is
assigned while waiting for a reply.

## Archive retrieval and intake

1. Fetch the full GEO SOFT record. Follow its exact BioSample, SRA and BioProject
   relations; a free-text search returning no hits is not proof of no deposit.
   For a SuperSeries or mixed assay, retain the sample and assay arms separately.
2. Fetch BioSample XML and SRA/ENA sample, experiment and run records. Reconcile
   archive identifiers and sample sets. A GEO sample, a sequencing experiment,
   a run and a biological replicate are different objects. Multiple runs or
   pooled cultures never establish independent biological replication.
3. Save the source URL, field/location, verbatim quotation, retrieval date,
   SHA-256 and sample scope. Re-match quoted text mechanically against the saved
   record. Check each piece of a composite quote and any attached file's hash.
4. Prepare a Package B addendum. Preserve contradictions and missingness; do not
   inherit a value from another study, maintenance phase or laboratory setup.
   Reading an archive that omits a value does not establish that its paper also
   omits it. An inaccessible paper remains not retrieved.
5. Intake the affected condition row, then rescore affected pairs explicitly.
   Keep original pair rows and identify replacements by their exact row and
   source condition IDs. Rebuild the inventory and ranking after the rescore.

For quoted addenda using the repository's existing document-key format:

```sh
.venv/bin/python tools/check_addendum_quotes.py ADDENDUM.tsv --texts SOURCE_TEXTS
```

An email reply records sender, date, accession, affected samples and the actual
answer. The owner or labmate sends depositor questions. Record no value while
waiting. A lab attestation requires its own owner-approved status and is never
labelled as a source-reported value.

## Per-gene tables and reprocessing

Check a uniformly processed public compendium before paying to reconstruct raw
reads. Pin a repository commit and the matrix, sample metadata and annotation
files separately. Verify unique IDs, finite numbers, exact sample-column sets
and declared units. Match samples by archive IDs, never by column order. A
compendium's curated metadata is evidence requiring its own source review,
not an automatic replacement for archive or paper metadata.

Do not join gene matrices to a gene-information table by row order. Verify the
identifier namespace and annotation release; annotation tables and quantitative
matrices in the same repository may use different locus namespaces. Calibration
artifacts stay outside `data/` and `site/` until ordinary admission passes.

A raw-read pilot needs pinned run accessions and file hashes, a reference FASTA
and annotation with matching replicons and release, immutable tool/container
versions, explicit layout and strand handling, and a sample-to-condition map.
Technical runs can be merged only after their relation to one biological sample
is verified. Pooling or one sample per condition permits count/QC inspection,
not estimation of a within-condition biological replicate band. Keep raw counts,
length-normalised values and within-study contrasts distinct.

Before scheduling a pilot, verify the actual execution host, tools, storage and
resource limits. A cluster account alone does not establish a configured
workspace, scheduler route or runnable job. Use the independent
[compute-backend ticket](../notes/tickets/O_folding-compute-backend__20260930.md)
for those setup dependencies.
