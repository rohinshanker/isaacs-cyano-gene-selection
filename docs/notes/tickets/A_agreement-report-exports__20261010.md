# A_agreement-report-exports__20261010 — Active

- **Scope:** Reproducible statistics-only JSON and replicate/response TSV exports from an existing full processed-expression agreement report.
- **Status:** active
- **Opened:** 2026-10-10
- **Updated:** 2026-10-10

## Current State

Claimed by `cyano-regulatory-sites` (session `e6e54b6e-1791581192`) for the
owner's next small unblocked implementation batch. Baseline `9f3b7aa`; isolated
integration branch `work/agreement-exports-20261010`. The other chat owns the
Strain fitness selector; its files, runtime and browsers are excluded.

This is a bounded reproducibility prerequisite of S6 in
[Data Sources](O_data-sources-selection__20261005.md). The existing agreement
generator emits full per-gene vectors, while the preserved statistics summary
and two review tables have no reusable export command. The existing
[agreement contract](../../validation/expression-agreement.md) defines their
statistics, missingness and interpretation; this ticket changes serialization,
not scientific methods, source admission or the site's display.

## Acceptance

- Add a standalone CLI that reads a full schema-1 agreement report and writes
  statistics-only JSON plus the existing replicate and response TSV layouts.
  Keep the numerical generator and frozen reports unchanged.
- Preserve metadata, denominators, nulls, zero values, limitations and caveats.
  Omit only layer `means` and contrast `vector` fields from the JSON, declare
  which vectors were omitted, and leave the input object unchanged.
- Validate unique identities and cross-references before writing. Reject
  malformed/non-finite values and summary-only input clearly rather than
  creating a misleading export. Record exact input bytes/hash and exporter
  identity; never claim the current runtime generated pre-existing statistics.
- Use CSV-aware TSV serialization. Retain the established column order and
  missing-value representation. Exports must be deterministic.
- Preflight all output paths: no publication into `data/` or `site/`, no
  input/source overwrite through ordinary paths, symlinks or aliases, and no
  two output destinations naming the same file. Invalid input/path requests
  leave existing destinations intact.
- Ship meaningful unit and CLI tests. Reproduce the existing tables from a
  regenerated full report and compare all exported statistics to the current
  preserved summary. No new data or prediction layer is published.

## Verification

`tools/export_expression_agreement.py` and
`tests/test_export_expression_agreement.py` are implemented on the implementer's
task branch and await independent exact-patch review.
`.venv/bin/python -m pytest -q tests/test_export_expression_agreement.py` passes
85 focused checks: nulls, zeros and explicit reasons; input non-mutation; TSV
quoting of tabs, newlines, quotes and carriage returns; duplicate layer, stratum
and contrast identities; broken layer and contrast cross-references;
denominators disagreeing with their own vectors; non-finite and overflowed
numbers; summary-only and malformed input; destination preflight through paths,
symlinks and hard links; destinations left intact after a rejected request; and
byte-identical repeat exports. Two of them reproduce the preserved replicate and
response tables byte for byte from the shipped current summary and pin the
exported JSON layout to it. Whole-suite collection is clean (1044 tests).

Coordinator-owned and still pending: `npm test`, `.venv/bin/python -m pytest -q`,
`.venv/bin/python tools/validate_contract.py`, and the real-data pass —
regenerate a full report, export it, and compare every statistic with the
current preserved summary, expecting only the `export` and `implementation`
provenance difference recorded in
[the agreement contract](../../validation/expression-agreement.md). No visible
UI changes. Final push must include the earlier completed commits and pass the
repository deployment workflow.

## Cleanup

Coordinator owns closure. Record every review finding and its resolution,
name the closing session/date, and distill CLI reproduction and provenance
rules into `docs/validation/expression-agreement.md` and its index. Then follow
the resolved-ticket lifecycle; leave Data Sources open for its remaining UI
and admission work.
