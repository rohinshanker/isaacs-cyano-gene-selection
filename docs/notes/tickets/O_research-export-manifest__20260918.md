# O_research-export-manifest__20260918 — Open

- **Scope**: Reproducible export of shortlisted genes and scheme-dependent measurements.
- **Status**: open
- **Opened**: 2026-09-18
- **Updated**: 2026-09-18
- **Priority**: P0 — exported live metrics cannot currently be traced to the scheme that produced them.

## Current State

`ShortlistPanel.buildCsv()` exports every current metric but only identifies a row
with gene fields. It does not export the active scheme map or name, genome and
annotation build, data checksums, expression source/condition, metric definitions,
terminal stop, translational exception, operon/overlap context, or recoded
sequence. The filename is always `recoding-candidates.csv`.

Because target burden and every delta change when the scheme changes, two exports
from different schemes can contain different numbers with no machine-readable way
to tell which is which. This is especially unsafe for the intended workflow of
testing the same genes under multiple recoding schemes.

## Proposed Resolution

- Define a versioned experimental-design manifest containing dataset identity and
  checksums, annotation release, generation time, complete scheme map/name,
  selected genes, metric definitions/units, provenance, and caveats.
- Keep a flat CSV for analysis, but include a stable manifest identifier and
  explicit scheme identifier per row. For multi-scheme export, use one row per
  gene×scheme rather than widening columns indefinitely.
- Include the exact wild-type and recoded CDS (or validated FASTA companions),
  terminal stop, exception/segment flags, and context needed to reconstruct every
  reported live metric.
- Use collision-resistant filenames that include the scheme and export timestamp.

## Verification

- Re-import an export into a clean browser/process and reproduce every live metric
  and protein-identity check exactly.
- Two schemes applied to the same shortlist remain distinguishable without relying
  on filenames or human memory.
- Missing PCC 7942 expression remains null and carries source/condition metadata.
- Export tests cover commas/newlines, unnamed schemes, all three stop codons,
  non-ATG starts, spliced CDSs, and translational exceptions.

## Cleanup

When resolved, freeze the manifest schema and round-trip command in
`docs/validation/`, update its index, and remove this ticket and its index row.
