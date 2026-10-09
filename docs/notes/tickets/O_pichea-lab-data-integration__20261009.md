# O_pichea-lab-data-integration__20261009 — Open

- **Scope:** Integrate Pichea into the visualizer using the lab's own data after the owner supplies it.
- **Status:** open
- **Opened:** 2026-10-09
- **Updated:** 2026-10-09

## Current State

Opened by `cyano-ui-fixes` at the owner's request. Implementation is unassigned
and has not started. The owner will download the lab's data later; data intake
and integration wait for that handoff. No files or source access have been
requested or downloaded under this ticket.

**Pichea** preserves the owner's current spelling. Confirm the intended species,
strain, and display name from the supplied data before registering an organism;
do not infer an assembly or substitute a public organism for the lab's record.

## Intake and implementation

When the owner provides the local data location:

1. Inventory the files and their formats, versions, dates, checksums, lab/source
   provenance, and sharing/publication constraints. Confirm which inputs are
   allowed in the repository or deployed viewer before copying lab data there.
2. Establish the exact species/strain, genome of record, replicons, annotation
   version, genetic code, locus identifiers, strand conventions, and coordinate
   basis. Require explicit mappings for any data using different identifiers or
   a different assembly; report unmapped records rather than guessing joins.
3. Identify the available measurement types, units, sample/condition metadata,
   replicates, normalization, and evidence labels. Admit only supported layers
   with traceable source and genome links.
4. Assess the existing builder and visualizer contracts against the supplied
   organism's sequence and annotation structure, including CDS/transcript
   handling where applicable. Implement and test any needed adaptations before
   exposing metrics that depend on them; do not borrow organism-specific model
   parameters without evidence.
5. Add the admitted organism with independent routing, data storage, remembered
   views, export identity, and source disclosure. Agree its selector placement
   with the owner once its identity is established; the owner has not specified
   its position relative to the three existing groups.

The input-dependent steps above wait on the owner's download. Inventory/check
contracts and the existing organism integration pattern can be reviewed without
that data; a missing download does not justify claiming unsupported layers or
silently selecting another reference.

## Verification

Ticket-only intake; no data or UI behavior has changed. Intake validation,
2026-10-09: ticket metadata and queue links passed; `npm test` passed 1,395 tests;
`pytest -q` passed 925 tests and 36 subtests with one skip; the contract validator
passed 119 checks with one declared skip. These gates validate the current
baseline, not the unimplemented lab-data integration.

Implementation acceptance requires a reproducible build from the supplied
inputs, recorded provenance and checksums, validated sequence/annotation and
coordinate joins, correct units/evidence labels, and explicit missing-data and
failure states. Test organism routing, storage/export isolation, and supported
metrics. Render the real gene/chromosome and available data views at mobile,
tablet, and desktop widths. Run the gates in `AGENTS.md`.

## Cleanup

The implementing session owns closure. Record remaining findings and any owner
data decisions, distill reusable lab-data intake and organism-specific contracts
into `docs/validation/`, update the validation index, then remove this ticket and
its queue row through the required resolved-ticket lifecycle.
