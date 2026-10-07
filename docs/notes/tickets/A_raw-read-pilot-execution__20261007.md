# A_raw-read-pilot-execution__20261007 — Active

- **Scope:** Execute the separately approved, non-release GSE122841 four-library
  raw-read pilot from the pinned plan, retaining count, QC and per-gene outputs
  without inferring biological replication, pooling studies or admitting a layer.
- **Status:** active
- **Opened:** 2026-10-07
- **Updated:** 2026-10-07

## Current State

Preparation is complete in
`docs/notes/handoff/cyano_raw_read_pilot_plan_20261007.json`: the four exact
GSM/BioSample/SRX/SRR relationships, eight FASTQ URLs and archive MD5/byte pins,
two-replicon reference checksums, pipeline commit, container digests and resource
envelope are fixed. That preparation fulfilled the condition-metadata ticket's
approved scope; this ticket owns the broader execution that began afterward.

Execution is active outside the release at
`/Users/Rohin/Desktop/coding_stuff/ISAACS-LAB/calibration/cyano-raw-pilot-20261007`.
All eight FASTQs for SRR8237705–SRR8237708 match their pinned byte counts and
MD5 values and have recorded SHA-256 values; all four run reports and metadata
files are present. Amazon Corretto Java 11 and a task-local pinned Nextflow
22.10.0 drive a queue-size-one profile capped at 2 CPUs and 2 GB per process.
The nine pinned containers completed every stage of the synthetic pipeline, and
the 100,000-read real-data probe completed with consistent output. The first full
real library is running through that bounded profile. No four-library result,
final QC set or per-gene table is complete yet.

## Boundaries

- Keep downloads, pipeline work and outputs outside the release tree.
- Verify every input against its recorded MD5, byte count and SHA-256 before use.
- Use the pinned pipeline and containers; record any deliberate deviation before
  comparing outputs.
- Report per-library QC, counts and per-gene results. The unresolved culture map
  means these outputs do not establish independent biological replicate bands.
- Do not pool studies, perform a UTEX locus join, admit a source or publish a
  layer from this pilot.

## Verification

Before resolution, verify all eight FASTQs and both reference artifacts, retain
the exact command/config and software/container identities, confirm every required
pipeline stage completed for all four libraries, and record QC/count/per-gene
output checksums. State failed or partial libraries explicitly. Compare the real
run with the synthetic and bounded real-data probes only for pipeline integrity;
do not use those probes as biological validation.

## Cleanup

On resolution, distil reusable execution and integrity checks into
[condition-metadata-recovery.md](../../validation/condition-metadata-recovery.md),
update `docs/validation/INDEX.md` only if its coverage text changes, then delete
this ticket and remove its live queue row. Keep scientific outputs and immutable
input/provenance artifacts; do not retain a terminal transcript or task history.
